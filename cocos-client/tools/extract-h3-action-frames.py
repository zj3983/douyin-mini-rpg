#!/usr/bin/env python3
"""Extract deterministic RGBA action frames from completed H3 pilot videos."""

import argparse
from collections import deque
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
DEFAULT_FFMPEG_TIMEOUT_SECONDS = 30.0
TRANSACTION_JOURNAL_VERSION = 1
FRAME_SIZE = (768, 1344)
MINIMUM_MOTION_SAFE_MARGIN_RATIO = 0.04
ALLOWED_ACTORS = ("qinglan", "moss-wolf")
MATTE_CLEANUP_NONE = "none"
MATTE_CLEANUP_DARK_SUBJECT_WHITE_MATTE = "dark-subject-white-matte"
ALLOWED_MATTE_CLEANUP_MODES = (
    MATTE_CLEANUP_NONE,
    MATTE_CLEANUP_DARK_SUBJECT_WHITE_MATTE,
)
DARK_SUBJECT_WHITE_MINIMUM_CHANNEL = 232
DARK_SUBJECT_WHITE_MAXIMUM_CHROMA = 18
DARK_SUBJECT_WHITE_MINIMUM_COMPONENT_PIXELS = 128
SAFE_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:[-_][a-z0-9]+)*$")
TRANSACTION_TOKEN_PATTERN = re.compile(r"^[0-9a-f]{16}$")
STAGING_ROOT_PATTERN = re.compile(r"^\.h3-extraction-[A-Za-z0-9._-]+$")
REPORT_CANDIDATE_PATTERN = re.compile(r"^\.extraction-report-[A-Za-z0-9._-]+\.tmp$")
_BACKGROUND_REMOVER = None


class ExtractionError(Exception):
    """A deterministic validation or extraction failure safe to show to users."""


def _positive_float(raw: str) -> float:
    try:
        value = float(raw)
    except (TypeError, ValueError) as error:
        raise argparse.ArgumentTypeError("must be a number") from error
    if not math.isfinite(value) or value <= 0:
        raise argparse.ArgumentTypeError("must be a finite number greater than zero")
    return value


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
    parser.add_argument(
        "--ffmpeg-timeout-seconds",
        type=_positive_float,
        default=DEFAULT_FFMPEG_TIMEOUT_SECONDS,
    )
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
        matte_cleanup = raw_job.get("matteCleanup", MATTE_CLEANUP_NONE)
        if matte_cleanup not in ALLOWED_MATTE_CLEANUP_MODES:
            raise ExtractionError(
                f"{label}.matteCleanup must be one of: "
                + ", ".join(ALLOWED_MATTE_CLEANUP_MODES)
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
                "matte_cleanup": matte_cleanup,
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
    minimum_margin = min(
        left / image.width,
        top / image.height,
        (image.width - right) / image.width,
        (image.height - bottom) / image.height,
    )
    if minimum_margin < MINIMUM_MOTION_SAFE_MARGIN_RATIO:
        raise ExtractionError(
            f"{label} has insufficient motion-safe margin: "
            f"{minimum_margin:.4f} below {MINIMUM_MOTION_SAFE_MARGIN_RATIO:.4f}"
        )
    return [left, top, right, bottom]


def _remove_large_near_white_components(image: Image.Image) -> Image.Image:
    source = image.copy()
    width, height = source.size
    pixels = source.load()
    candidates = bytearray(width * height)
    pixel_bytes = source.tobytes()
    for offset in range(width * height):
        byte_offset = offset * 4
        red = pixel_bytes[byte_offset]
        green = pixel_bytes[byte_offset + 1]
        blue = pixel_bytes[byte_offset + 2]
        alpha = pixel_bytes[byte_offset + 3]
        if (
            alpha > 0
            and min(red, green, blue) >= DARK_SUBJECT_WHITE_MINIMUM_CHANNEL
            and max(red, green, blue) - min(red, green, blue)
            <= DARK_SUBJECT_WHITE_MAXIMUM_CHROMA
        ):
            candidates[offset] = 1

    visited = bytearray(width * height)
    for seed in range(width * height):
        if visited[seed] or not candidates[seed]:
            continue
        visited[seed] = 1
        queue = deque([seed])
        component = []
        while queue:
            offset = queue.popleft()
            component.append(offset)
            x = offset % width
            for neighbor in (
                offset - 1 if x > 0 else None,
                offset + 1 if x + 1 < width else None,
                offset - width if offset >= width else None,
                offset + width if offset + width < width * height else None,
            ):
                if (
                    neighbor is not None
                    and not visited[neighbor]
                    and candidates[neighbor]
                ):
                    visited[neighbor] = 1
                    queue.append(neighbor)
        if len(component) >= DARK_SUBJECT_WHITE_MINIMUM_COMPONENT_PIXELS:
            for offset in component:
                x = offset % width
                y = offset // width
                red, green, blue, _alpha = pixels[x, y]
                pixels[x, y] = (red, green, blue, 0)
    return source


def _apply_matte_cleanup(image: Image.Image, mode: str) -> Image.Image:
    if mode == MATTE_CLEANUP_NONE:
        return image
    if mode == MATTE_CLEANUP_DARK_SUBJECT_WHITE_MATTE:
        return _remove_large_near_white_components(image)
    raise ExtractionError(f"unknown matte cleanup mode: {mode}")


def prepare_extracted_png(
    path: Path,
    label: str = "extracted frame",
    matte_cleanup: str = MATTE_CLEANUP_NONE,
):
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
    cleaned = _apply_matte_cleanup(cleaned, matte_cleanup)
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
    timeout_seconds: float,
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
            timeout=timeout_seconds,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except subprocess.TimeoutExpired as error:
        raise ExtractionError(
            f"ffmpeg timed out after {timeout_seconds:g} seconds for {label}"
        ) from error
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


def _actor_journal_path(source_root: Path, actor: str) -> Path:
    if actor not in ALLOWED_ACTORS:
        raise ExtractionError(f"unknown journal actor {actor}")
    return source_root / f".{actor}.h3-extraction-journal.json"


def _action_backup_path(target: Path, token: str) -> Path:
    return target.with_name(f".{target.name}.h3-backup-{token}")


def _report_backup_path(report_path: Path, token: str) -> Path:
    return report_path.with_name(f".{REPORT_NAME}.h3-backup-{token}")


def _inject_fault(fault_injector, phase: str, when: str, **context) -> None:
    if fault_injector is not None:
        fault_injector(phase, when, context)


def _write_json_atomic(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.write-{secrets.token_hex(6)}")
    try:
        with temporary.open("w", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if _lexists(temporary):
            temporary.unlink()


def _write_actor_journal(path: Path, journal: dict) -> None:
    _write_json_atomic(path, journal)


def _replace_with_fault(
    source: Path,
    target: Path,
    phase: str,
    fault_injector,
    **context,
) -> None:
    _inject_fault(fault_injector, phase, "before", **context)
    os.replace(source, target)
    _inject_fault(fault_injector, phase, "after", **context)


def _journal_entry_paths(source_root: Path, journal: dict, entry: dict):
    actor = journal["actor"]
    action = entry["action"]
    target = _resolve_inside(
        source_root,
        f"{actor}/{action}",
        f"journal target {actor}/{action}",
        require_relative=True,
        reject_parent_parts=True,
    )
    staged = _resolve_inside(
        source_root,
        f"{journal['stagingRoot']}/{actor}/{action}",
        f"journal staged action {actor}/{action}",
        require_relative=True,
        reject_parent_parts=True,
    )
    backup = _resolve_inside(
        source_root,
        f"{actor}/.{action}.h3-backup-{journal['token']}",
        f"journal backup {actor}/{action}",
        require_relative=True,
        reject_parent_parts=True,
    )
    return target, staged, backup


def _journal_report_paths(run_root: Path, journal: dict):
    report = journal["report"]
    target = _resolve_inside(run_root, REPORT_NAME, "journal report target", require_relative=True)
    staged = _resolve_inside(
        run_root,
        report["staged"],
        "journal staged report",
        require_relative=True,
        reject_parent_parts=True,
    )
    backup = _resolve_inside(
        run_root,
        f".{REPORT_NAME}.h3-backup-{journal['token']}",
        "journal report backup",
        require_relative=True,
        reject_parent_parts=True,
    )
    return target, staged, backup


def _validate_actor_journal(journal: Any, expected_actor: str) -> dict:
    if not isinstance(journal, dict) or journal.get("version") != TRANSACTION_JOURNAL_VERSION:
        raise ExtractionError("invalid H3 extraction transaction journal version")
    actor = journal.get("actor")
    if actor != expected_actor or actor not in ALLOWED_ACTORS:
        raise ExtractionError("H3 extraction journal actor mismatch")
    token = journal.get("token")
    if not isinstance(token, str) or not TRANSACTION_TOKEN_PATTERN.fullmatch(token):
        raise ExtractionError("invalid H3 extraction transaction token")
    selected = journal.get("selectedActors")
    if (
        not isinstance(selected, list)
        or not selected
        or len(set(selected)) != len(selected)
        or any(value not in ALLOWED_ACTORS for value in selected)
        or selected != [value for value in ALLOWED_ACTORS if value in selected]
        or actor not in selected
    ):
        raise ExtractionError("invalid H3 extraction journal actor set")
    if journal.get("coordinator") != selected[0]:
        raise ExtractionError("invalid H3 extraction journal coordinator")
    if journal.get("state") not in {
        "prepared",
        "installed",
        "committed",
        "cleanup-pending",
        "recovery-failed",
    }:
        raise ExtractionError("invalid H3 extraction journal state")
    staging_root = journal.get("stagingRoot")
    if not isinstance(staging_root, str) or not STAGING_ROOT_PATTERN.fullmatch(staging_root):
        raise ExtractionError("invalid H3 extraction journal staging root")
    entries = journal.get("entries")
    if not isinstance(entries, list) or not entries:
        raise ExtractionError("H3 extraction journal entries must be non-empty")
    seen_actions = set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise ExtractionError("invalid H3 extraction journal entry")
        action = entry.get("action")
        if (
            not isinstance(action, str)
            or not SAFE_ID_PATTERN.fullmatch(action)
            or action in seen_actions
            or type(entry.get("targetExisted")) is not bool
            or entry.get("state") not in {
                "prepared",
                "backing-up",
                "backed-up",
                "installing",
                "installed",
                "rolling-back",
                "rolled-back",
            }
        ):
            raise ExtractionError("invalid H3 extraction journal entry metadata")
        seen_actions.add(action)
    report = journal.get("report")
    if actor == selected[0]:
        if (
            not isinstance(report, dict)
            or type(report.get("targetExisted")) is not bool
            or report.get("state") not in {
                "prepared",
                "backing-up",
                "backed-up",
                "installing",
                "installed",
                "rolling-back",
                "rolled-back",
            }
            or not isinstance(report.get("staged"), str)
            or not REPORT_CANDIDATE_PATTERN.fullmatch(report["staged"])
        ):
            raise ExtractionError("invalid H3 extraction journal report entry")
    elif report is not None:
        raise ExtractionError("only the H3 extraction coordinator may own the report entry")
    if not isinstance(journal.get("recoveryErrors", []), list):
        raise ExtractionError("invalid H3 extraction journal recovery errors")
    return journal


def _read_actor_journal(path: Path, actor: str) -> dict:
    _require_nonempty_file(path, f"{actor} extraction journal")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ExtractionError(f"could not read {actor} extraction journal") from error
    return _validate_actor_journal(value, actor)


def _load_transaction_journals(source_root: Path, run_root: Path):
    loaded = {}
    for actor in ALLOWED_ACTORS:
        path = _actor_journal_path(source_root, actor)
        if _lexists(path):
            loaded[actor] = {"path": path, "journal": _read_actor_journal(path, actor)}
    if not loaded:
        return {}

    first = next(iter(loaded.values()))["journal"]
    selected = first["selectedActors"]
    token = first["token"]
    staging_root = first["stagingRoot"]
    coordinator = first["coordinator"]
    for actor, record in loaded.items():
        journal = record["journal"]
        if (
            journal["selectedActors"] != selected
            or journal["token"] != token
            or journal["stagingRoot"] != staging_root
            or journal["coordinator"] != coordinator
        ):
            raise ExtractionError("conflicting H3 extraction transaction journals")
        for entry in journal["entries"]:
            _journal_entry_paths(source_root, journal, entry)
        if journal["report"] is not None:
            _journal_report_paths(run_root, journal)

    if coordinator not in loaded:
        for record in loaded.values():
            _remove_path(record["path"])
        orphan_staging = _resolve_inside(
            source_root,
            staging_root,
            "orphan H3 staging root",
            require_relative=True,
            reject_parent_parts=True,
        )
        _remove_path(orphan_staging)
        for candidate in run_root.glob(".extraction-report-*.tmp"):
            _assert_no_link_chain(candidate, "orphan extraction report candidate")
            _remove_path(candidate)
        return {}
    if set(loaded) != set(selected) and loaded[coordinator]["journal"]["state"] not in {
        "committed",
        "cleanup-pending",
    }:
        raise ExtractionError("incomplete H3 extraction journal set")
    return loaded


def _build_transaction_journals(
    staged_actions: list[dict],
    report_candidate: Path,
    report_path: Path,
    source_root: Path,
    run_root: Path,
    selected_actors: list[str],
):
    selected_actors = list(selected_actors)
    if (
        not selected_actors
        or selected_actors != [actor for actor in ALLOWED_ACTORS if actor in selected_actors]
        or len(set(selected_actors)) != len(selected_actors)
    ):
        raise ExtractionError("transaction actors must be unique and canonical")
    source_root = _absolute(source_root)
    run_root = _absolute(run_root)
    report_candidate = _absolute(report_candidate)
    report_path = _absolute(report_path)
    if report_path != run_root / REPORT_NAME or report_candidate.parent != run_root:
        raise ExtractionError("transaction report paths are outside the run root")
    if not REPORT_CANDIDATE_PATTERN.fullmatch(report_candidate.name):
        raise ExtractionError("transaction report candidate has an unsafe name")

    staging_roots = set()
    grouped = {actor: [] for actor in selected_actors}
    for staged in staged_actions:
        actor = staged.get("actor")
        action = staged.get("action")
        if actor not in grouped or not isinstance(action, str) or not SAFE_ID_PATTERN.fullmatch(action):
            raise ExtractionError("transaction contains an unsafe actor action")
        target = _absolute(Path(staged["target"]))
        staged_path = _absolute(Path(staged["staged"]))
        expected_target = source_root / actor / action
        if target != expected_target or staged_path.name != action or staged_path.parent.name != actor:
            raise ExtractionError("transaction action paths do not match actor ownership")
        staging_root = staged_path.parent.parent
        if staging_root.parent != source_root or not STAGING_ROOT_PATTERN.fullmatch(staging_root.name):
            raise ExtractionError("transaction staging root is unsafe")
        _assert_no_link_chain(target, f"transaction target {actor}/{action}")
        _assert_no_link_chain(staged_path, f"transaction staged action {actor}/{action}")
        staging_roots.add(staging_root)
        grouped[actor].append({"action": action, "targetExisted": _lexists(target), "state": "prepared"})
    if len(staging_roots) != 1 or any(not grouped[actor] for actor in selected_actors):
        raise ExtractionError("transaction must stage every selected actor under one root")
    staging_root = staging_roots.pop()
    token = secrets.token_hex(8)
    coordinator = selected_actors[0]
    journals = {}
    for actor in selected_actors:
        journal = {
            "version": TRANSACTION_JOURNAL_VERSION,
            "token": token,
            "actor": actor,
            "coordinator": coordinator,
            "selectedActors": selected_actors,
            "state": "prepared",
            "stagingRoot": staging_root.name,
            "entries": grouped[actor],
            "report": None,
            "recoveryErrors": [],
        }
        if actor == coordinator:
            journal["report"] = {
                "staged": report_candidate.name,
                "targetExisted": _lexists(report_path),
                "state": "prepared",
            }
        path = _actor_journal_path(source_root, actor)
        if _lexists(path):
            raise ExtractionError(f"unfinished extraction journal already exists for {actor}")
        journals[actor] = {"path": path, "journal": journal}

    written = []
    try:
        for actor in [value for value in selected_actors if value != coordinator] + [coordinator]:
            record = journals[actor]
            _write_actor_journal(record["path"], record["journal"])
            written.append(record["path"])
    except Exception:
        for path in written:
            _remove_path(path)
        raise
    return journals


def _journal_for_action(journals: dict, actor: str, action: str):
    record = journals[actor]
    for entry in record["journal"]["entries"]:
        if entry["action"] == action:
            return record, entry
    raise ExtractionError(f"transaction journal is missing {actor}/{action}")


def _rollback_action_entry(
    source_root: Path,
    record: dict,
    entry: dict,
    fault_injector,
) -> None:
    if entry["state"] == "rolled-back":
        return
    journal = record["journal"]
    target, _staged, backup = _journal_entry_paths(source_root, journal, entry)
    actor = journal["actor"]
    action = entry["action"]
    previous_state = entry["state"]
    entry["state"] = "rolling-back"
    _write_actor_journal(record["path"], journal)
    if entry["targetExisted"]:
        if _lexists(backup):
            if _lexists(target):
                _remove_path(target)
            _replace_with_fault(
                backup,
                target,
                "rollback-action-restore",
                fault_injector,
                actor=actor,
                action=action,
            )
        elif not _lexists(target) or previous_state not in {
            "prepared",
            "backing-up",
            "rolling-back",
        }:
            raise ExtractionError(f"missing rollback backup for {actor}/{action}")
    elif _lexists(target):
        _remove_path(target)
    entry["state"] = "rolled-back"
    _write_actor_journal(record["path"], journal)


def _rollback_report_entry(
    run_root: Path,
    record: dict,
    fault_injector,
) -> None:
    journal = record["journal"]
    entry = journal["report"]
    if entry["state"] == "rolled-back":
        return
    target, _staged, backup = _journal_report_paths(run_root, journal)
    previous_state = entry["state"]
    entry["state"] = "rolling-back"
    _write_actor_journal(record["path"], journal)
    if entry["targetExisted"]:
        if _lexists(backup):
            if _lexists(target):
                _remove_path(target)
            _replace_with_fault(
                backup,
                target,
                "rollback-report-restore",
                fault_injector,
                actor=journal["actor"],
            )
        elif not _lexists(target) or previous_state not in {
            "prepared",
            "backing-up",
            "rolling-back",
        }:
            raise ExtractionError("missing rollback backup for extraction report")
    elif _lexists(target):
        _remove_path(target)
    entry["state"] = "rolled-back"
    _write_actor_journal(record["path"], journal)


def _record_cleanup_warnings(report: dict, report_path: Path, warnings: list[str]) -> dict:
    existing = report.get("warnings", [])
    merged = list(existing) if isinstance(existing, list) else []
    for warning in warnings:
        if warning not in merged:
            merged.append(warning)
    report["warnings"] = merged
    candidate = _write_report_candidate(report, report_path.parent)
    try:
        os.replace(candidate, report_path)
    finally:
        if _lexists(candidate):
            candidate.unlink()
    return report


def _mark_cleanup_pending(journals: dict, warnings: list[str]) -> None:
    for record in journals.values():
        journal = record["journal"]
        journal["state"] = "cleanup-pending"
        journal["recoveryErrors"] = list(
            dict.fromkeys(journal.get("recoveryErrors", []) + warnings)
        )
        try:
            _write_actor_journal(record["path"], journal)
        except Exception:
            pass


def _cleanup_committed_transaction(
    source_root: Path,
    run_root: Path,
    journals: dict,
    report: dict,
    fault_injector=None,
):
    errors = []
    coordinator = journals[next(iter(journals))]["journal"]["coordinator"]
    for actor in journals[coordinator]["journal"]["selectedActors"]:
        if actor not in journals:
            continue
        record = journals[actor]
        journal = record["journal"]
        for entry in journal["entries"]:
            _target, staged, backup = _journal_entry_paths(source_root, journal, entry)
            for kind, path in (("staged", staged), ("backup", backup)):
                if not _lexists(path):
                    continue
                try:
                    if kind == "backup":
                        _inject_fault(
                            fault_injector,
                            "cleanup-backup",
                            "before",
                            actor=actor,
                            action=entry["action"],
                        )
                    _remove_path(path)
                    if kind == "backup":
                        _inject_fault(
                            fault_injector,
                            "cleanup-backup",
                            "after",
                            actor=actor,
                            action=entry["action"],
                        )
                except Exception:
                    errors.append(f"cleanup pending for {actor}/{entry['action']} {kind}")
    coordinator_record = journals[coordinator]
    report_target, report_staged, report_backup = _journal_report_paths(
        run_root,
        coordinator_record["journal"],
    )
    for kind, path in (("staged report", report_staged), ("report backup", report_backup)):
        if not _lexists(path):
            continue
        try:
            if kind == "report backup":
                _inject_fault(fault_injector, "cleanup-backup", "before", actor=coordinator, report=True)
            _remove_path(path)
            if kind == "report backup":
                _inject_fault(fault_injector, "cleanup-backup", "after", actor=coordinator, report=True)
        except Exception:
            errors.append(f"cleanup pending for extraction {kind}")

    staging_root = _resolve_inside(
        source_root,
        coordinator_record["journal"]["stagingRoot"],
        "committed H3 staging root",
        require_relative=True,
        reject_parent_parts=True,
    )
    try:
        _remove_path(staging_root)
    except Exception:
        errors.append("cleanup pending for extraction staging root")

    if errors:
        _mark_cleanup_pending(journals, errors)
        try:
            return _record_cleanup_warnings(report, report_target, errors)
        except Exception:
            report["warnings"] = list(dict.fromkeys(report.get("warnings", []) + errors))
            return report

    deletion_errors = []
    ordered_records = [journals[coordinator]] + [
        record for actor, record in journals.items() if actor != coordinator
    ]
    for record in ordered_records:
        try:
            _remove_path(record["path"])
        except Exception:
            deletion_errors.append(
                f"cleanup pending for {record['journal']['actor']} transaction journal"
            )
    if deletion_errors:
        _mark_cleanup_pending(
            {
                actor: record
                for actor, record in journals.items()
                if _lexists(record["path"])
            },
            deletion_errors,
        )
        try:
            return _record_cleanup_warnings(report, report_target, deletion_errors)
        except Exception:
            report["warnings"] = list(
                dict.fromkeys(report.get("warnings", []) + deletion_errors)
            )
    return report


def _cleanup_orphan_staging(source_root: Path, run_root: Path) -> None:
    for staging in source_root.glob(".h3-extraction-*"):
        _assert_no_link_chain(staging, "orphan H3 extraction staging")
        _remove_path(staging)
    for candidate in run_root.glob(".extraction-report-*.tmp"):
        _assert_no_link_chain(candidate, "orphan extraction report candidate")
        _remove_path(candidate)
    for actor in ALLOWED_ACTORS:
        pattern = f"..{actor}.h3-extraction-journal.json.write-*"
        for temporary in source_root.glob(pattern):
            _assert_no_link_chain(temporary, "orphan extraction journal write")
            _remove_path(temporary)


def recover_incomplete_extractions(
    source_root,
    run_root,
    *,
    fault_injector=None,
):
    source_root = _absolute(Path(source_root))
    run_root = _absolute(Path(run_root))
    _require_directory(source_root, "source root")
    _require_directory(run_root, "run root")
    journals = _load_transaction_journals(source_root, run_root)
    if not journals:
        _cleanup_orphan_staging(source_root, run_root)
        return []
    first_journal = next(iter(journals.values()))["journal"]
    coordinator = first_journal["coordinator"]
    coordinator_record = journals[coordinator]
    committed = coordinator_record["journal"]["state"] in {
        "committed",
        "cleanup-pending",
    }
    report_path = run_root / REPORT_NAME
    if committed:
        _require_nonempty_file(report_path, "committed extraction report")
        try:
            report = json.loads(report_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ExtractionError("committed extraction report is unreadable") from error
        before = len(report.get("warnings", [])) if isinstance(report.get("warnings", []), list) else 0
        report = _cleanup_committed_transaction(
            source_root,
            run_root,
            journals,
            report,
            fault_injector,
        )
        return report.get("warnings", [])[before:]

    errors = []
    try:
        _rollback_report_entry(run_root, coordinator_record, fault_injector)
    except Exception as error:
        errors.append(f"report rollback failed: {error}")
    selected = coordinator_record["journal"]["selectedActors"]
    for actor in reversed(selected):
        record = journals[actor]
        for entry in reversed(record["journal"]["entries"]):
            try:
                _rollback_action_entry(source_root, record, entry, fault_injector)
            except Exception as error:
                errors.append(f"{actor}/{entry['action']} rollback failed: {error}")
    if errors:
        for record in journals.values():
            record["journal"]["state"] = "recovery-failed"
            record["journal"]["recoveryErrors"] = errors
            _write_actor_journal(record["path"], record["journal"])
        raise ExtractionError("H3 extraction rollback incomplete: " + "; ".join(errors))

    cleanup_errors = []
    for record in journals.values():
        journal = record["journal"]
        for entry in journal["entries"]:
            _target, staged, backup = _journal_entry_paths(source_root, journal, entry)
            for label, path in (("staged", staged), ("backup", backup)):
                try:
                    _remove_path(path)
                except Exception:
                    cleanup_errors.append(f"rollback cleanup pending for {journal['actor']}/{entry['action']} {label}")
    report_target, report_staged, report_backup = _journal_report_paths(
        run_root,
        coordinator_record["journal"],
    )
    for label, path in (("staged report", report_staged), ("report backup", report_backup)):
        try:
            _remove_path(path)
        except Exception:
            cleanup_errors.append(f"rollback cleanup pending for {label}")
    staging_root = source_root / coordinator_record["journal"]["stagingRoot"]
    try:
        _remove_path(staging_root)
    except Exception:
        cleanup_errors.append("rollback cleanup pending for staging root")
    if cleanup_errors:
        for record in journals.values():
            record["journal"]["state"] = "recovery-failed"
            record["journal"]["recoveryErrors"] = cleanup_errors
            _write_actor_journal(record["path"], record["journal"])
        raise ExtractionError("H3 extraction rollback cleanup incomplete")
    for record in journals.values():
        _remove_path(record["path"])
    return []


def _publish_transaction(
    staged_actions: list[dict],
    report_candidate: Path,
    report_path: Path,
    *,
    source_root: Path,
    run_root: Path,
    selected_actors: list[str],
    report: dict,
    fault_injector=None,
):
    journals = _build_transaction_journals(
        staged_actions,
        report_candidate,
        report_path,
        source_root,
        run_root,
        selected_actors,
    )
    coordinator = selected_actors[0]
    commit_recorded = False
    try:
        for staged in staged_actions:
            actor = staged["actor"]
            action = staged["action"]
            record, entry = _journal_for_action(journals, actor, action)
            journal = record["journal"]
            target, staged_path, backup = _journal_entry_paths(source_root, journal, entry)
            target.parent.mkdir(parents=True, exist_ok=True)
            _assert_no_link_chain(target.parent, "target action parent")
            if entry["targetExisted"]:
                entry["state"] = "backing-up"
                _write_actor_journal(record["path"], journal)
                _replace_with_fault(
                    target,
                    backup,
                    "action-backup",
                    fault_injector,
                    actor=actor,
                    action=action,
                )
                entry["state"] = "backed-up"
                _write_actor_journal(record["path"], journal)
            entry["state"] = "installing"
            _write_actor_journal(record["path"], journal)
            _replace_with_fault(
                staged_path,
                target,
                "action-install",
                fault_injector,
                actor=actor,
                action=action,
            )
            entry["state"] = "installed"
            _write_actor_journal(record["path"], journal)

        coordinator_record = journals[coordinator]
        coordinator_journal = coordinator_record["journal"]
        report_entry = coordinator_journal["report"]
        report_target, report_staged, report_backup = _journal_report_paths(
            run_root,
            coordinator_journal,
        )
        if report_entry["targetExisted"]:
            report_entry["state"] = "backing-up"
            _write_actor_journal(coordinator_record["path"], coordinator_journal)
            _replace_with_fault(
                report_target,
                report_backup,
                "report-backup",
                fault_injector,
                actor=coordinator,
            )
            report_entry["state"] = "backed-up"
            _write_actor_journal(coordinator_record["path"], coordinator_journal)
        report_entry["state"] = "installing"
        _write_actor_journal(coordinator_record["path"], coordinator_journal)
        _replace_with_fault(
            report_staged,
            report_target,
            "report-install",
            fault_injector,
            actor=coordinator,
        )
        report_entry["state"] = "installed"
        _write_actor_journal(coordinator_record["path"], coordinator_journal)

        for actor, record in journals.items():
            record["journal"]["state"] = "installed"
            _write_actor_journal(record["path"], record["journal"])
        coordinator_journal["state"] = "committed"
        _write_actor_journal(coordinator_record["path"], coordinator_journal)
        commit_recorded = True
        _inject_fault(fault_injector, "commit-recorded", "after", actor=coordinator)
        for actor, record in journals.items():
            if actor == coordinator:
                continue
            record["journal"]["state"] = "committed"
            _write_actor_journal(record["path"], record["journal"])
    except Exception as error:
        if not commit_recorded:
            try:
                persisted = _read_actor_journal(
                    journals[coordinator]["path"],
                    coordinator,
                )
                commit_recorded = persisted["state"] in {
                    "committed",
                    "cleanup-pending",
                }
            except Exception:
                pass
        if commit_recorded:
            warnings = ["post-commit transaction finalization required recovery"]
            _mark_cleanup_pending(journals, warnings)
            try:
                report = _record_cleanup_warnings(report, report_path, warnings)
            except Exception:
                report["warnings"] = list(
                    dict.fromkeys(report.get("warnings", []) + warnings)
                )
            return _cleanup_committed_transaction(
                source_root,
                run_root,
                journals,
                report,
                fault_injector,
            )
        try:
            recover_incomplete_extractions(
                source_root,
                run_root,
                fault_injector=fault_injector,
            )
        except Exception as recovery_error:
            raise ExtractionError(
                f"atomic publication failed and rollback was incomplete: {recovery_error}"
            ) from error
        raise ExtractionError(
            f"atomic publication failed and previous state was restored: {error}"
        ) from error

    return _cleanup_committed_transaction(
        source_root,
        run_root,
        journals,
        report,
        fault_injector,
    )


def _stage_extraction(
    jobs: list[dict],
    selected: list[str],
    targets: dict,
    executable: str,
    staging_root: Path,
    ffmpeg_timeout_seconds: float,
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
                        ffmpeg_timeout_seconds,
                    )
                    bounds = prepare_extracted_png(
                        frame_path,
                        frame_label,
                        matte_cleanup=job["matte_cleanup"],
                    )
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
                    "matteCleanup": job["matte_cleanup"],
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
    ffmpeg_timeout_seconds=DEFAULT_FFMPEG_TIMEOUT_SECONDS,
    project_root=None,
    source_root=None,
    fault_injector=None,
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
    recover_incomplete_extractions(source_root, run_root)
    if any(_lexists(_actor_journal_path(source_root, actor)) for actor in ALLOWED_ACTORS):
        raise ExtractionError("previous committed extraction cleanup is still pending")
    try:
        ffmpeg_timeout_seconds = _positive_float(ffmpeg_timeout_seconds)
    except argparse.ArgumentTypeError as error:
        raise ExtractionError("ffmpeg timeout must be a finite number greater than zero") from error
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
            ffmpeg_timeout_seconds,
        )
        report = {
            "version": REPORT_VERSION,
            "manifestSha256": manifest_hash,
            "actors": actor_reports,
        }
        report_candidate = _write_report_candidate(report, run_root)
        report = _publish_transaction(
            staged_actions,
            report_candidate,
            report_path,
            source_root=source_root,
            run_root=run_root,
            selected_actors=selected,
            report=report,
            fault_injector=fault_injector,
        )
        report_candidate = None
        return report
    finally:
        has_active_journal = any(
            _lexists(_actor_journal_path(source_root, actor)) for actor in ALLOWED_ACTORS
        )
        if not has_active_journal:
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
            ffmpeg_timeout_seconds=args.ffmpeg_timeout_seconds,
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
