#!/usr/bin/env python3
"""Extract deterministic RGBA action frames from completed H3 pilot videos."""

import argparse
import hashlib
import importlib.util
import json
import math
import os
import re
import secrets
import shutil
import stat
import subprocess
import sys
import tempfile
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any

from PIL import Image, UnidentifiedImageError


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = "art-source/h3-pilot/pilot.json"
DEFAULT_SOURCE_ROOT = "art-source/vertical-slice"
REPORT_NAME = "extraction-report.json"
REPORT_VERSION = 1
FRAME_SIZE = (768, 1344)
ALLOWED_ACTORS = ("qinglan", "moss-wolf")
SAFE_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:[-_][a-z0-9]+)*$")
_BACKGROUND_REMOVER = None


class ExtractionError(Exception):
    """A deterministic validation or extraction failure safe to show to users."""


def build_parser():
    parser = argparse.ArgumentParser(
        description="Extract deterministic transparent frames from H3 pilot MP4 files."
    )
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST)
    parser.add_argument("--run-root", required=True)
    parser.add_argument(
        "--actor",
        action="append",
        choices=ALLOWED_ACTORS,
        dest="actors",
        default=[],
    )
    parser.add_argument("--ffmpeg", default="ffmpeg")
    return parser


def _absolute(path: Path) -> Path:
    return Path(os.path.abspath(os.fspath(path)))


def _lexists(path: Path) -> bool:
    return os.path.lexists(os.fspath(path))


def _is_link_or_reparse(path: Path) -> bool:
    try:
        metadata = path.lstat()
    except OSError:
        return False
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    return path.is_symlink() or bool(
        getattr(metadata, "st_file_attributes", 0) & reparse_flag
    )


def _assert_no_link_chain(path: Path, label: str) -> None:
    absolute = _absolute(path)
    anchor = Path(absolute.anchor)
    current = anchor
    parts = absolute.parts[1:] if absolute.anchor else absolute.parts
    for part in parts:
        current = current / part
        if _lexists(current) and _is_link_or_reparse(current):
            raise ExtractionError(f"{label} contains a symlink or reparse point")


def _normalized_path(raw: Any, label: str) -> str:
    if not isinstance(raw, (str, os.PathLike)):
        raise ExtractionError(f"{label} must be a path")
    value = os.fspath(raw)
    if not isinstance(value, str) or not value or "\x00" in value:
        raise ExtractionError(f"{label} must be a non-empty path")
    return value.replace("\\", "/")


def _resolve_inside(
    root: Path,
    raw: Any,
    label: str,
    *,
    require_relative: bool = False,
    reject_parent_parts: bool = False,
) -> Path:
    root = _absolute(root)
    _assert_no_link_chain(root, f"{label} root")
    normalized = _normalized_path(raw, label)
    posix_path = PurePosixPath(normalized)
    windows_path = PureWindowsPath(os.fspath(raw))
    if require_relative and (posix_path.is_absolute() or windows_path.is_absolute()):
        raise ExtractionError(f"{label} must be relative")
    if reject_parent_parts and ".." in posix_path.parts:
        raise ExtractionError(f"{label} contains unsafe parent traversal")

    candidate = Path(normalized)
    if windows_path.is_absolute() and not candidate.is_absolute():
        raise ExtractionError(f"{label} is outside the project root")
    candidate = _absolute(candidate if candidate.is_absolute() else root / candidate)
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise ExtractionError(f"{label} is outside the project root") from error

    _assert_no_link_chain(candidate, label)
    resolved_root = root.resolve(strict=False)
    resolved_candidate = candidate.resolve(strict=False)
    try:
        resolved_candidate.relative_to(resolved_root)
    except ValueError as error:
        raise ExtractionError(f"{label} resolves outside the project root") from error
    return candidate


def _require_directory(path: Path, label: str) -> None:
    if not path.is_dir():
        raise ExtractionError(f"{label} does not exist or is not a directory")
    _assert_no_link_chain(path, label)


def _require_nonempty_file(path: Path, label: str) -> None:
    if not path.is_file():
        raise ExtractionError(f"{label} does not exist or is not a file")
    _assert_no_link_chain(path, label)
    try:
        size = path.stat().st_size
    except OSError as error:
        raise ExtractionError(f"could not inspect {label}") from error
    if size <= 0:
        raise ExtractionError(f"{label} is empty")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
    except OSError as error:
        raise ExtractionError(f"could not hash {path.name}") from error
    return digest.hexdigest()


def _load_manifest(path: Path):
    _require_nonempty_file(path, "manifest")
    try:
        payload = path.read_bytes()
    except OSError as error:
        raise ExtractionError("could not read manifest") from error

    def reject_constant(_value):
        raise ExtractionError("manifest samples must be finite numbers")

    try:
        manifest = json.loads(payload.decode("utf-8"), parse_constant=reject_constant)
    except UnicodeDecodeError as error:
        raise ExtractionError("manifest is not valid UTF-8") from error
    except json.JSONDecodeError as error:
        raise ExtractionError(
            f"manifest is not valid JSON at line {error.lineno} column {error.colno}"
        ) from error
    return manifest, hashlib.sha256(payload).hexdigest()


def _nonempty_string(record: dict, key: str, label: str) -> str:
    value = record.get(key)
    if not isinstance(value, str) or not value:
        raise ExtractionError(f"{label}.{key} must be a non-empty string")
    return value


def _safe_id(value: str, label: str) -> str:
    if not SAFE_ID_PATTERN.fullmatch(value):
        raise ExtractionError(f"{label} is an unsafe identifier")
    return value


def _validate_video_path(run_root: Path, actor: str, raw: Any, label: str):
    normalized = _normalized_path(raw, label)
    portable = PurePosixPath(normalized)
    windows = PureWindowsPath(os.fspath(raw))
    if portable.is_absolute() or windows.is_absolute() or ".." in portable.parts:
        raise ExtractionError(f"{label} contains unsafe traversal or an absolute path")
    if len(portable.parts) != 2 or portable.parts[0] != actor:
        raise ExtractionError(f"{label} must stay inside the {actor} video directory")
    if portable.suffix.lower() != ".mp4":
        raise ExtractionError(f"{label} must be an MP4 path")
    video_root = _resolve_inside(run_root, "videos", "run videos directory", require_relative=True)
    path = _resolve_inside(
        video_root,
        portable.as_posix(),
        label,
        require_relative=True,
        reject_parent_parts=True,
    )
    return path, portable.as_posix()


def _validate_manifest(manifest: Any, run_root: Path):
    if not isinstance(manifest, dict):
        raise ExtractionError("manifest must be a JSON object")
    if type(manifest.get("version")) is not int:
        raise ExtractionError("manifest.version must be an integer")
    duration = manifest.get("duration")
    if (
        isinstance(duration, bool)
        or not isinstance(duration, (int, float))
        or not math.isfinite(duration)
        or duration <= 0
    ):
        raise ExtractionError("manifest.duration must be a positive finite number")
    raw_jobs = manifest.get("jobs")
    if not isinstance(raw_jobs, list) or not raw_jobs:
        raise ExtractionError("manifest.jobs must be a non-empty array")

    jobs = []
    seen_job_ids = set()
    seen_actions = {actor: set() for actor in ALLOWED_ACTORS}
    for job_index, raw_job in enumerate(raw_jobs):
        label = f"manifest.jobs[{job_index}]"
        if not isinstance(raw_job, dict):
            raise ExtractionError(f"{label} must be an object")
        job_id = _safe_id(_nonempty_string(raw_job, "id", label), f"{label}.id")
        if job_id in seen_job_ids:
            raise ExtractionError(f"manifest contains duplicate job id {job_id}")
        seen_job_ids.add(job_id)
        actor = _nonempty_string(raw_job, "actor", label)
        if actor not in ALLOWED_ACTORS:
            raise ExtractionError(f"{label} has unknown actor {actor}")
        action = _safe_id(
            _nonempty_string(raw_job, "action", label),
            f"{label}.action",
        )
        video_path, video_relative = _validate_video_path(
            run_root,
            actor,
            _nonempty_string(raw_job, "video", label),
            f"{label}.video",
        )
        raw_outputs = raw_job.get("outputs")
        if not isinstance(raw_outputs, list) or not raw_outputs:
            raise ExtractionError(f"{label}.outputs must be a non-empty array")

        outputs = []
        for output_index, raw_output in enumerate(raw_outputs):
            output_label = f"{label}.outputs[{output_index}]"
            if not isinstance(raw_output, dict):
                raise ExtractionError(f"{output_label} must be an object")
            output_action = _safe_id(
                _nonempty_string(raw_output, "action", output_label),
                f"{output_label}.action",
            )
            if output_action in seen_actions[actor]:
                raise ExtractionError(
                    f"manifest contains duplicate output action {actor}/{output_action}"
                )
            seen_actions[actor].add(output_action)
            samples = raw_output.get("samples")
            if not isinstance(samples, list) or not samples:
                raise ExtractionError(f"{output_label}.samples must be a non-empty array")
            normalized_samples = []
            previous = None
            for sample_index, sample in enumerate(samples):
                sample_label = f"{output_label}.samples[{sample_index}]"
                if (
                    isinstance(sample, bool)
                    or not isinstance(sample, (int, float))
                    or not math.isfinite(sample)
                ):
                    raise ExtractionError(f"{sample_label} must be a finite number")
                value = float(sample)
                if value < 0:
                    raise ExtractionError(
                        f"{sample_label} must be greater than or equal to zero"
                    )
                if value >= float(duration):
                    raise ExtractionError(
                        f"{sample_label} must be less than manifest duration"
                    )
                if previous is not None and value <= previous:
                    raise ExtractionError(
                        f"{output_label}.samples must be strictly increasing without duplicates"
                    )
                normalized_samples.append(sample)
                previous = value
            outputs.append({"action": output_action, "samples": normalized_samples})

        jobs.append(
            {
                "id": job_id,
                "actor": actor,
                "action": action,
                "video_path": video_path,
                "video_relative": video_relative,
                "outputs": outputs,
            }
        )
    return jobs


def _select_actors(jobs: list[dict], requested):
    requested = [] if requested is None else list(requested)
    seen = set()
    for actor in requested:
        if actor not in ALLOWED_ACTORS:
            raise ExtractionError(f"unknown actor selection: {actor}")
        seen.add(actor)
    present = [actor for actor in ALLOWED_ACTORS if any(job["actor"] == actor for job in jobs)]
    if not requested:
        return present
    missing = sorted(seen.difference(present))
    if missing:
        raise ExtractionError(f"selected actor has no manifest jobs: {missing[0]}")
    return [actor for actor in ALLOWED_ACTORS if actor in seen]


def _resolve_ffmpeg(raw: Any) -> str:
    normalized = _normalized_path(raw, "ffmpeg")
    executable = shutil.which(normalized)
    if executable is None:
        raise ExtractionError("ffmpeg executable not found")
    path = Path(executable)
    if not path.is_file():
        raise ExtractionError("ffmpeg executable does not exist or is not a file")
    return os.fspath(path)


def _load_background_remover():
    global _BACKGROUND_REMOVER
    if _BACKGROUND_REMOVER is not None:
        return _BACKGROUND_REMOVER
    builder_path = Path(__file__).resolve().with_name("build-vertical-slice-atlases.py")
    if not builder_path.is_file():
        raise ExtractionError("vertical slice atlas builder is missing")
    spec = importlib.util.spec_from_file_location("vertical_slice_atlas_builder_h3", builder_path)
    if spec is None or spec.loader is None:
        raise ExtractionError("could not load vertical slice atlas builder")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    remover = getattr(module, "remove_border_connected_checkerboard", None)
    if not callable(remover):
        raise ExtractionError("atlas builder background remover is unavailable")
    _BACKGROUND_REMOVER = remover
    return remover


def _validate_final_frame(image: Image.Image, label: str):
    if image.mode != "RGBA":
        raise ExtractionError(f"{label} must be RGBA")
    if image.size != FRAME_SIZE:
        raise ExtractionError(f"{label} has incorrect dimensions")
    alpha = image.getchannel("A")
    minimum_alpha, maximum_alpha = alpha.getextrema()
    bounds = alpha.getbbox()
    if bounds is None or maximum_alpha == 0:
        raise ExtractionError(f"{label} is fully transparent")
    if minimum_alpha > 0:
        raise ExtractionError(f"{label} has no transparent background")
    left, top, right, bottom = bounds
    if left <= 0 or top <= 0 or right >= image.width or bottom >= image.height:
        raise ExtractionError(f"{label} subject touches the frame boundary")
    return [left, top, right, bottom]


def prepare_extracted_png(path: Path, label: str = "extracted frame"):
    _require_nonempty_file(path, label)
    try:
        with Image.open(path) as source:
            source.load()
            if source.format != "PNG":
                raise ExtractionError(f"{label} is not a PNG")
            if source.size != FRAME_SIZE:
                raise ExtractionError(f"{label} has incorrect dimensions")
            if source.mode not in {"RGB", "RGBA"}:
                raise ExtractionError(f"{label} must be RGB or RGBA")
            rgba = source.convert("RGBA")
    except ExtractionError:
        raise
    except (OSError, UnidentifiedImageError) as error:
        raise ExtractionError(f"{label} is not a valid PNG") from error

    cleaned = _load_background_remover()(rgba)
    bounds = _validate_final_frame(cleaned, label)
    processed_path = path.with_name(f".{path.name}.processed")
    try:
        cleaned.save(processed_path, format="PNG", compress_level=9, optimize=False)
        with Image.open(processed_path) as persisted:
            persisted.load()
            if persisted.format != "PNG" or persisted.mode != "RGBA":
                raise ExtractionError(f"{label} did not persist as RGBA PNG")
            persisted_bounds = _validate_final_frame(persisted, label)
        os.replace(processed_path, path)
    finally:
        if _lexists(processed_path):
            processed_path.unlink()
    if persisted_bounds != bounds:
        raise ExtractionError(f"{label} alpha bounds changed while saving")
    return bounds


def _run_ffmpeg(
    executable: str,
    video_path: Path,
    sample: float,
    output_path: Path,
    label: str,
):
    command = [
        executable,
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        f"{sample:.3f}",
        "-i",
        os.fspath(video_path),
        "-frames:v",
        "1",
        "-vf",
        "scale=768:1344:flags=lanczos",
        "-y",
        os.fspath(output_path),
    ]
    try:
        completed = subprocess.run(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except OSError as error:
        raise ExtractionError(f"ffmpeg failed to start for {label}") from error
    if completed.returncode != 0:
        raise ExtractionError(f"ffmpeg failed with non-zero exit status for {label}")
    if not output_path.is_file() or output_path.stat().st_size <= 0:
        raise ExtractionError(f"ffmpeg failed to produce a non-empty PNG for {label}")


def _validate_source_targets(source_root: Path, jobs: list[dict], selected: list[str]):
    targets = {}
    for job in jobs:
        if job["actor"] not in selected:
            continue
        for output in job["outputs"]:
            relative = PurePosixPath(job["actor"], output["action"])
            target = _resolve_inside(
                source_root,
                relative.as_posix(),
                f"target action {relative.as_posix()}",
                require_relative=True,
                reject_parent_parts=True,
            )
            if _lexists(target) and not target.is_dir():
                raise ExtractionError(
                    f"target action {relative.as_posix()} exists and is not a directory"
                )
            targets[(job["actor"], output["action"])] = target
    return targets


def _remove_path(path: Path) -> None:
    if not _lexists(path):
        return
    if _is_link_or_reparse(path) or not path.is_dir():
        path.unlink()
    else:
        shutil.rmtree(path)


def _write_report_candidate(report: dict, run_root: Path) -> Path:
    text = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    descriptor, raw_path = tempfile.mkstemp(
        prefix=".extraction-report-",
        suffix=".tmp",
        dir=run_root,
    )
    candidate = Path(raw_path)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        parsed = json.loads(candidate.read_text(encoding="utf-8"))
        if parsed != report:
            raise ExtractionError("extraction report verification failed")
        return candidate
    except Exception:
        if _lexists(candidate):
            candidate.unlink()
        raise


def _rollback_publication(records: list[dict], report_record: dict | None) -> list[str]:
    errors = []
    if report_record is not None:
        report_path = report_record["target"]
        report_backup = report_record["backup"]
        try:
            if report_record["published"] and _lexists(report_path):
                _remove_path(report_path)
            if report_record["old_moved"] and _lexists(report_backup):
                os.replace(report_backup, report_path)
        except OSError as error:
            errors.append(f"report rollback failed: {error}")
    for record in reversed(records):
        target = record["target"]
        backup = record["backup"]
        try:
            if record["published"] and _lexists(target):
                _remove_path(target)
            if record["old_moved"] and _lexists(backup):
                os.replace(backup, target)
        except OSError as error:
            errors.append(f"action rollback failed: {error}")
    return errors


def _publish_transaction(
    staged_actions: list[dict],
    report_candidate: Path,
    report_path: Path,
) -> None:
    token = secrets.token_hex(8)
    records = []
    report_record = None
    try:
        for staged in staged_actions:
            target = staged["target"]
            backup = target.with_name(f".{target.name}.h3-backup-{token}")
            if _lexists(backup):
                raise ExtractionError("action backup collision")
            record = {
                "target": target,
                "backup": backup,
                "old_moved": False,
                "published": False,
            }
            records.append(record)
            target.parent.mkdir(parents=True, exist_ok=True)
            _assert_no_link_chain(target.parent, "target action parent")
            if _lexists(target):
                os.replace(target, backup)
                record["old_moved"] = True
            os.replace(staged["staged"], target)
            record["published"] = True

        report_backup = report_path.with_name(f".{REPORT_NAME}.h3-backup-{token}")
        if _lexists(report_backup):
            raise ExtractionError("report backup collision")
        report_record = {
            "target": report_path,
            "backup": report_backup,
            "old_moved": False,
            "published": False,
        }
        if _lexists(report_path):
            os.replace(report_path, report_backup)
            report_record["old_moved"] = True
        os.replace(report_candidate, report_path)
        report_record["published"] = True
    except Exception as error:
        rollback_errors = _rollback_publication(records, report_record)
        if rollback_errors:
            raise ExtractionError(
                f"publication failed and rollback was incomplete: {'; '.join(rollback_errors)}"
            ) from error
        if isinstance(error, ExtractionError):
            raise
        raise ExtractionError("atomic publication failed; previous actions were restored") from error

    for record in records:
        if record["old_moved"] and _lexists(record["backup"]):
            _remove_path(record["backup"])
    if report_record["old_moved"] and _lexists(report_record["backup"]):
        _remove_path(report_record["backup"])


def _stage_extraction(
    jobs: list[dict],
    selected: list[str],
    targets: dict,
    executable: str,
    staging_root: Path,
):
    video_hashes = {}
    actor_reports = []
    staged_actions = []
    for actor in selected:
        job_reports = []
        for job in jobs:
            if job["actor"] != actor:
                continue
            video_path = job["video_path"]
            if video_path not in video_hashes:
                video_hashes[video_path] = _sha256(video_path)
            video_hash = video_hashes[video_path]
            output_reports = []
            for output in job["outputs"]:
                action = output["action"]
                staged_action = staging_root / actor / action
                staged_action.mkdir(parents=True, exist_ok=False)
                frame_reports = []
                for index, sample in enumerate(output["samples"]):
                    name = f"{index:02d}.png"
                    frame_path = staged_action / name
                    frame_label = f"{job['id']}/{action}/{name}"
                    _run_ffmpeg(
                        executable,
                        video_path,
                        float(sample),
                        frame_path,
                        frame_label,
                    )
                    bounds = prepare_extracted_png(frame_path, frame_label)
                    frame_reports.append(
                        {
                            "index": index,
                            "sample": sample,
                            "file": name,
                            "sourceVideoSha256": video_hash,
                            "outputSha256": _sha256(frame_path),
                            "dimensions": [FRAME_SIZE[0], FRAME_SIZE[1]],
                            "alphaBounds": bounds,
                        }
                    )
                expected_names = [f"{index:02d}.png" for index in range(len(output["samples"]))]
                actual_names = sorted(path.name for path in staged_action.iterdir())
                if actual_names != expected_names:
                    raise ExtractionError(f"staged action {actor}/{action} has unexpected files")
                staged_actions.append(
                    {
                        "actor": actor,
                        "action": action,
                        "staged": staged_action,
                        "target": targets[(actor, action)],
                    }
                )
                output_reports.append(
                    {
                        "action": action,
                        "samples": output["samples"],
                        "frames": frame_reports,
                    }
                )
            job_reports.append(
                {
                    "id": job["id"],
                    "action": job["action"],
                    "video": f"videos/{job['video_relative']}",
                    "videoSha256": video_hash,
                    "outputs": output_reports,
                }
            )
        actor_reports.append({"actor": actor, "jobs": job_reports})
    return actor_reports, staged_actions


def extract_action_frames(
    manifest_path,
    run_root,
    *,
    actors=None,
    ffmpeg="ffmpeg",
    project_root=None,
    source_root=None,
):
    project_root = _absolute(PROJECT_ROOT if project_root is None else Path(project_root))
    _require_directory(project_root, "project root")
    manifest_path = _resolve_inside(project_root, manifest_path, "manifest path")
    run_root = _resolve_inside(project_root, run_root, "run root")
    _require_directory(run_root, "run root")
    source_root = _resolve_inside(
        project_root,
        DEFAULT_SOURCE_ROOT if source_root is None else source_root,
        "source root",
    )
    source_root.mkdir(parents=True, exist_ok=True)
    _assert_no_link_chain(source_root, "source root")
    executable = _resolve_ffmpeg(ffmpeg)
    manifest, manifest_hash = _load_manifest(manifest_path)
    jobs = _validate_manifest(manifest, run_root)
    selected = _select_actors(jobs, actors)
    for job in jobs:
        if job["actor"] in selected:
            _require_nonempty_file(job["video_path"], f"video for {job['id']}")
    targets = _validate_source_targets(source_root, jobs, selected)
    report_path = _resolve_inside(run_root, REPORT_NAME, "extraction report", require_relative=True)
    if _lexists(report_path) and (not report_path.is_file() or _is_link_or_reparse(report_path)):
        raise ExtractionError("extraction report target must be a regular non-link file")

    staging_root = Path(tempfile.mkdtemp(prefix=".h3-extraction-", dir=source_root))
    report_candidate = None
    try:
        actor_reports, staged_actions = _stage_extraction(
            jobs,
            selected,
            targets,
            executable,
            staging_root,
        )
        report = {
            "version": REPORT_VERSION,
            "manifestSha256": manifest_hash,
            "actors": actor_reports,
        }
        report_candidate = _write_report_candidate(report, run_root)
        _publish_transaction(staged_actions, report_candidate, report_path)
        report_candidate = None
        return report
    finally:
        if report_candidate is not None and _lexists(report_candidate):
            report_candidate.unlink()
        if _lexists(staging_root):
            _remove_path(staging_root)


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    try:
        report = extract_action_frames(
            args.manifest,
            args.run_root,
            actors=args.actors,
            ffmpeg=args.ffmpeg,
            project_root=PROJECT_ROOT,
        )
    except (ExtractionError, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    frame_count = sum(
        len(output["frames"])
        for actor in report["actors"]
        for job in actor["jobs"]
        for output in job["outputs"]
    )
    print(
        f"extracted {frame_count} frame(s) for {len(report['actors'])} actor(s); "
        f"report={REPORT_NAME}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
