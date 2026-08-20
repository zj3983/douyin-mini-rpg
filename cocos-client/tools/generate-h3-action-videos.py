#!/usr/bin/env python3
"""Generate H3 pilot action videos through the local HTTP bridge."""

import argparse
import base64
import json
import math
import mimetypes
import re
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath, PureWindowsPath
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen


CLIENT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MANIFEST = "art-source/h3-pilot/pilot.json"
HTTP_TIMEOUT_CAP_SECONDS = 30.0
MAX_JSON_RESPONSE_BYTES = 2 * 1024 * 1024
STATE_VERSION = 1
JOB_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
TASK_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$")
DATA_URI_PATTERN = re.compile(
    r"data:[^\s,]+(?:;[^\s,]+)*,[^\s\"']+",
    re.IGNORECASE,
)
LONG_BASE64_PATTERN = re.compile(r"[A-Za-z0-9+/]{80,}={0,2}")
VALID_STATES = {"submitting", "processing", "completed", "failed"}
VIDEO_CONTENT_TYPES = {"video/mp4", "application/octet-stream"}


class ClientError(Exception):
    """A user-facing error whose message is safe to print and persist."""


class RemoteTaskFailed(ClientError):
    """The bridge reported a terminal generation failure."""


def safe_message(value) -> str:
    text = " ".join(str(value).replace("\x00", " ").split())
    text = DATA_URI_PATTERN.sub("[redacted data URI]", text)
    text = LONG_BASE64_PATTERN.sub("[redacted base64]", text)
    if not text:
        return "operation failed"
    if len(text) > 400:
        return f"{text[:397]}..."
    return text


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def nonnegative_float(raw: str) -> float:
    try:
        value = float(raw)
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be a number") from error
    if not math.isfinite(value) or value < 0:
        raise argparse.ArgumentTypeError("must be a finite number greater than or equal to zero")
    return value


def positive_float(raw: str) -> float:
    value = nonnegative_float(raw)
    if value <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return value


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Generate resumable H3 Ref2V action videos through a local bridge."
    )
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST)
    parser.add_argument("--run-root", required=True)
    parser.add_argument("--job", action="append", dest="job_ids")
    parser.add_argument("--poll-seconds", type=nonnegative_float, default=15.0)
    parser.add_argument("--timeout-seconds", type=positive_float, default=10800.0)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def normalized_path(raw, label: str) -> str:
    if not isinstance(raw, str) or not raw or "\x00" in raw:
        raise ClientError(f"{label} must be a non-empty path")
    return raw.replace("\\", "/")


def resolve_inside(
    root: Path,
    raw,
    label: str,
    *,
    require_relative: bool = False,
    reject_parent_parts: bool = False,
) -> Path:
    root = root.resolve()
    normalized = normalized_path(raw, label)
    portable_path = PurePosixPath(normalized)
    windows_path = PureWindowsPath(raw)

    if reject_parent_parts and ".." in portable_path.parts:
        raise ClientError(f"{label} must not contain parent traversal")
    if require_relative and (portable_path.is_absolute() or windows_path.is_absolute()):
        raise ClientError(f"{label} must be relative")

    candidate = Path(normalized)
    if windows_path.is_absolute() and not candidate.is_absolute():
        raise ClientError(f"{label} is outside cocos-client")
    resolved = (candidate if candidate.is_absolute() else root / candidate).resolve()
    try:
        resolved.relative_to(root)
    except ValueError as error:
        raise ClientError(f"{label} is outside cocos-client") from error
    return resolved


def require_file(path: Path, label: str, *, nonempty: bool = True) -> None:
    if not path.is_file():
        raise ClientError(f"{label} does not exist or is not a file")
    if nonempty and path.stat().st_size <= 0:
        raise ClientError(f"{label} is empty")


def read_json_file(path: Path, label: str):
    require_file(path, label)
    try:
        return json.loads(path.read_bytes().decode("utf-8"))
    except UnicodeDecodeError as error:
        raise ClientError(f"{label} is not valid UTF-8") from error
    except json.JSONDecodeError as error:
        raise ClientError(f"{label} is not valid JSON at line {error.lineno} column {error.colno}") from error
    except OSError as error:
        raise ClientError(f"could not read {label}") from error


def require_nonempty_string(record: dict, key: str, label: str) -> str:
    value = record.get(key)
    if not isinstance(value, str) or not value:
        raise ClientError(f"{label}.{key} must be a non-empty string")
    return value


def validate_bridge_url(raw) -> str:
    if not isinstance(raw, str) or not raw:
        raise ClientError("manifest.bridgeUrl must be a non-empty HTTP URL")
    parts = urlsplit(raw)
    if (
        parts.scheme not in {"http", "https"}
        or not parts.hostname
        or parts.username is not None
        or parts.password is not None
        or parts.query
        or parts.fragment
    ):
        raise ClientError("manifest.bridgeUrl must be a plain HTTP URL without credentials, query, or fragment")
    return raw.rstrip("/")


def validate_download_url(raw) -> str:
    if not isinstance(raw, str) or not raw:
        raise ClientError("completed task is missing a download URL")
    parts = urlsplit(raw)
    if (
        parts.scheme not in {"http", "https"}
        or not parts.hostname
        or parts.username is not None
        or parts.password is not None
        or parts.fragment
    ):
        raise ClientError("completed task returned an invalid download URL")
    return raw


def validate_manifest(manifest, run_root: Path):
    if not isinstance(manifest, dict):
        raise ClientError("manifest must be a JSON object")
    if type(manifest.get("version")) is not int:
        raise ClientError("manifest.version must be an integer")

    bridge_url = validate_bridge_url(manifest.get("bridgeUrl"))
    model = require_nonempty_string(manifest, "model", "manifest")
    width = manifest.get("width")
    height = manifest.get("height")
    duration = manifest.get("duration")
    if type(width) is not int or width <= 0:
        raise ClientError("manifest.width must be a positive integer")
    if type(height) is not int or height <= 0:
        raise ClientError("manifest.height must be a positive integer")
    if (
        isinstance(duration, bool)
        or not isinstance(duration, (int, float))
        or not math.isfinite(duration)
        or duration <= 0
    ):
        raise ClientError("manifest.duration must be a positive finite number")

    raw_jobs = manifest.get("jobs")
    if not isinstance(raw_jobs, list) or not raw_jobs:
        raise ClientError("manifest.jobs must be a non-empty array")

    video_root = resolve_inside(run_root, "videos", "run videos directory", require_relative=True)
    jobs = []
    seen_ids = set()
    seen_videos = set()
    for index, raw_job in enumerate(raw_jobs):
        label = f"manifest.jobs[{index}]"
        if not isinstance(raw_job, dict):
            raise ClientError(f"{label} must be an object")

        job_id = require_nonempty_string(raw_job, "id", label)
        if not JOB_ID_PATTERN.fullmatch(job_id):
            raise ClientError(f"{label}.id is not a safe job id")
        if job_id in seen_ids:
            raise ClientError(f"manifest contains duplicate job id {job_id}")
        seen_ids.add(job_id)

        seed = raw_job.get("seed")
        if type(seed) is not int:
            raise ClientError(f"{label}.seed must be an integer")

        reference_raw = require_nonempty_string(raw_job, "reference", label)
        reference_path = resolve_inside(
            CLIENT_ROOT,
            reference_raw,
            f"{job_id} reference",
            require_relative=True,
            reject_parent_parts=True,
        )
        require_file(reference_path, f"{job_id} reference")
        reference_mime, _encoding = mimetypes.guess_type(reference_path.name)
        if not reference_mime or not reference_mime.startswith("image/"):
            raise ClientError(f"{job_id} reference does not have a recognized image MIME type")

        prompt_raw = require_nonempty_string(raw_job, "prompt", label)
        prompt_path = resolve_inside(
            CLIENT_ROOT,
            prompt_raw,
            f"{job_id} prompt",
            require_relative=True,
            reject_parent_parts=True,
        )
        require_file(prompt_path, f"{job_id} prompt")
        try:
            prompt_text = prompt_path.read_bytes().decode("utf-8")
        except UnicodeDecodeError as error:
            raise ClientError(f"{job_id} prompt is not valid UTF-8") from error
        except OSError as error:
            raise ClientError(f"could not read {job_id} prompt") from error
        if not prompt_text.strip():
            raise ClientError(f"{job_id} prompt is empty")

        video_raw = require_nonempty_string(raw_job, "video", label)
        target_path = resolve_inside(
            video_root,
            video_raw,
            f"{job_id} video",
            require_relative=True,
            reject_parent_parts=True,
        )
        if target_path.suffix.lower() != ".mp4":
            raise ClientError(f"{job_id} video must end in .mp4")
        portable_video = target_path.relative_to(video_root).as_posix()
        video_key = portable_video.casefold()
        if video_key in seen_videos:
            raise ClientError(f"manifest contains duplicate video path {portable_video}")
        seen_videos.add(video_key)

        jobs.append(
            {
                "id": job_id,
                "seed": seed,
                "reference_path": reference_path,
                "reference_mime": reference_mime,
                "prompt_text": prompt_text,
                "target_path": target_path,
                "manifest_video": portable_video,
                "state_video": target_path.relative_to(run_root).as_posix(),
            }
        )

    return {
        "bridge_url": bridge_url,
        "model": model,
        "width": width,
        "height": height,
        "duration": duration,
        "video_root": video_root,
        "jobs": jobs,
    }


def select_jobs(jobs: list[dict], requested_ids):
    if requested_ids is None:
        return jobs
    if len(set(requested_ids)) != len(requested_ids):
        raise ClientError("selected job ids must not be repeated")
    jobs_by_id = {job["id"]: job for job in jobs}
    unknown = [job_id for job_id in requested_ids if job_id not in jobs_by_id]
    if unknown:
        raise ClientError(f"unknown selected job id {safe_message(unknown[0])}")
    return [jobs_by_id[job_id] for job_id in requested_ids]


def bounded_http_timeout(limit: float | None = None) -> float:
    if limit is None:
        return HTTP_TIMEOUT_CAP_SECONDS
    return max(0.05, min(HTTP_TIMEOUT_CAP_SECONDS, limit))


def request_json(method: str, url: str, operation: str, *, payload=None, timeout=None):
    body = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = Request(url, data=body, headers=headers, method=method)

    try:
        with urlopen(request, timeout=bounded_http_timeout(timeout)) as response:
            content_type = response.headers.get_content_type().lower()
            if content_type != "application/json" and not content_type.endswith("+json"):
                raise ClientError(f"{operation} returned non-JSON content")
            response_body = response.read(MAX_JSON_RESPONSE_BYTES + 1)
    except HTTPError as error:
        error.close()
        raise ClientError(f"{operation} returned HTTP {error.code}") from error
    except (URLError, TimeoutError, OSError) as error:
        raise ClientError(f"{operation} request failed") from error

    if len(response_body) > MAX_JSON_RESPONSE_BYTES:
        raise ClientError(f"{operation} returned an oversized JSON response")
    try:
        value = json.loads(response_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ClientError(f"{operation} returned invalid JSON") from error
    if not isinstance(value, dict):
        raise ClientError(f"{operation} returned a non-object JSON response")
    return value


def check_health(bridge_url: str, timeout_seconds: float) -> str:
    health = request_json(
        "GET",
        f"{bridge_url}/health",
        "bridge health check",
        timeout=timeout_seconds,
    )
    if health.get("status") != "ready":
        raise ClientError("bridge health status is not ready")
    version = health.get("version")
    if isinstance(version, bool) or not isinstance(version, (str, int, float)):
        raise ClientError("bridge health response is missing version")
    return safe_message(version)


def validate_task_id(raw) -> str:
    if not isinstance(raw, str) or not TASK_ID_PATTERN.fullmatch(raw):
        raise ClientError("bridge returned an invalid task_id")
    return raw


def encode_reference(path: Path, mime_type: str) -> str:
    try:
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    except OSError as error:
        raise ClientError("could not read a job reference image") from error
    return f"data:{mime_type};base64,{encoded}"


def submit_job(config: dict, job: dict, timeout_seconds: float) -> str:
    payload = {
        "model": config["model"],
        "prompt": job["prompt_text"],
        "width": config["width"],
        "height": config["height"],
        "duration": config["duration"],
        "n": 1,
        "seed": job["seed"],
        "reference_images": [encode_reference(job["reference_path"], job["reference_mime"])],
    }
    response = request_json(
        "POST",
        f"{config['bridge_url']}/v1/video/generations",
        f"{job['id']} submission",
        payload=payload,
        timeout=timeout_seconds,
    )
    return validate_task_id(response.get("task_id"))


def poll_task(config: dict, job: dict, task_id: str, poll_seconds: float, timeout_seconds: float) -> str:
    deadline = time.monotonic() + timeout_seconds
    reported_processing = False
    status_url = f"{config['bridge_url']}/v1/video/generations/{quote(task_id, safe='')}"
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ClientError(f"{job['id']} timed out waiting for task completion")
        status_response = request_json(
            "GET",
            status_url,
            f"{job['id']} status poll",
            timeout=remaining,
        )
        status = status_response.get("status")
        if status == "processing":
            if not reported_processing:
                print(f"[{job['id']}] processing")
                reported_processing = True
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise ClientError(f"{job['id']} timed out waiting for task completion")
            time.sleep(min(poll_seconds, remaining))
            continue
        if status == "completed":
            metadata = status_response.get("metadata")
            if not isinstance(metadata, dict):
                raise ClientError(f"{job['id']} completed response is missing metadata")
            return validate_download_url(status_response.get("url"))
        if status == "failed":
            raise RemoteTaskFailed(f"{job['id']} generation failed")
        raise ClientError(f"{job['id']} status response has an invalid status")


def download_video(url: str, target: Path, job_id: str, timeout_seconds: float) -> None:
    validate_download_url(url)
    target.parent.mkdir(parents=True, exist_ok=True)
    part_path = target.with_name(f"{target.name}.part")
    part_path.unlink(missing_ok=True)
    installed = False
    request = Request(url, headers={"Accept": "video/mp4"}, method="GET")
    try:
        try:
            with urlopen(request, timeout=bounded_http_timeout(timeout_seconds)) as response:
                final_url = response.geturl()
                validate_download_url(final_url)
                content_type = response.headers.get_content_type().lower()
                if content_type not in VIDEO_CONTENT_TYPES:
                    raise ClientError(f"{job_id} download returned an invalid Content-Type")
                with part_path.open("wb") as output:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        output.write(chunk)
        except HTTPError as error:
            error.close()
            raise ClientError(f"{job_id} download returned HTTP {error.code}") from error
        except (URLError, TimeoutError, OSError) as error:
            raise ClientError(f"{job_id} download failed") from error

        if not part_path.is_file() or part_path.stat().st_size <= 0:
            raise ClientError(f"{job_id} download was empty")
        part_path.replace(target)
        installed = True
    finally:
        if not installed:
            part_path.unlink(missing_ok=True)


def normalize_state_entry(raw_entry, jobs_by_id: dict[str, dict]) -> dict:
    if not isinstance(raw_entry, dict):
        raise ClientError("jobs.json contains a non-object job entry")
    job_id = raw_entry.get("id")
    if not isinstance(job_id, str) or job_id not in jobs_by_id:
        raise ClientError("jobs.json contains an unknown job id")
    job = jobs_by_id[job_id]
    if raw_entry.get("seed") != job["seed"]:
        raise ClientError(f"jobs.json seed does not match manifest for {job_id}")
    if raw_entry.get("video") not in {job["state_video"], job["manifest_video"]}:
        raise ClientError(f"jobs.json video does not match manifest for {job_id}")

    status = raw_entry.get("status")
    if status not in VALID_STATES:
        raise ClientError(f"jobs.json status is invalid for {job_id}")
    task_id = raw_entry.get("taskId")
    if task_id is not None:
        task_id = validate_task_id(task_id)
    if status in {"processing", "completed"} and task_id is None:
        raise ClientError(f"jobs.json is missing taskId for {job_id}")

    started_at = raw_entry.get("startedAt")
    if not isinstance(started_at, str) or not started_at:
        started_at = utc_now()
    completed_at = raw_entry.get("completedAt")
    if not isinstance(completed_at, str):
        completed_at = None
    error = raw_entry.get("error")
    if not isinstance(error, str):
        error = None
    elif error:
        error = safe_message(error)

    return {
        "id": job_id,
        "taskId": task_id,
        "status": status,
        "seed": job["seed"],
        "video": job["state_video"],
        "startedAt": started_at,
        "completedAt": completed_at,
        "error": error,
    }


def load_state(state_path: Path, jobs: list[dict]) -> list[dict]:
    if not state_path.exists():
        return []
    state = read_json_file(state_path, "jobs.json")
    if not isinstance(state, dict) or state.get("version") != STATE_VERSION:
        raise ClientError("jobs.json has an unsupported state version")
    raw_entries = state.get("jobs")
    if not isinstance(raw_entries, list):
        raise ClientError("jobs.json jobs must be an array")

    jobs_by_id = {job["id"]: job for job in jobs}
    entries = []
    seen_ids = set()
    for raw_entry in raw_entries:
        entry = normalize_state_entry(raw_entry, jobs_by_id)
        if entry["id"] in seen_ids:
            raise ClientError(f"jobs.json contains duplicate job id {entry['id']}")
        seen_ids.add(entry["id"])
        entries.append(entry)
    return entries


def write_state(state_path: Path, entries: list[dict]) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            newline="\n",
            dir=state_path.parent,
            prefix=".jobs-",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
            json.dump(
                {"version": STATE_VERSION, "jobs": entries},
                temporary,
                ensure_ascii=True,
                indent=2,
            )
            temporary.write("\n")
        temporary_path.replace(state_path)
    except (OSError, TypeError, ValueError) as error:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        raise ClientError("could not atomically write jobs.json") from error


def upsert_entry(entries: list[dict], entry: dict) -> None:
    for index, existing in enumerate(entries):
        if existing["id"] == entry["id"]:
            entries[index] = entry
            return
    entries.append(entry)


def new_state_entry(job: dict) -> dict:
    return {
        "id": job["id"],
        "taskId": None,
        "status": "submitting",
        "seed": job["seed"],
        "video": job["state_video"],
        "startedAt": utc_now(),
        "completedAt": None,
        "error": None,
    }


def persist_entry(state_path: Path, entries: list[dict], entry: dict) -> None:
    upsert_entry(entries, entry)
    write_state(state_path, entries)


def process_job(
    config: dict,
    job: dict,
    state_path: Path,
    entries: list[dict],
    poll_seconds: float,
    timeout_seconds: float,
):
    entries_by_id = {entry["id"]: entry for entry in entries}
    entry = entries_by_id.get(job["id"])
    target = job["target_path"]
    target.with_name(f"{target.name}.part").unlink(missing_ok=True)

    if entry is not None and entry["status"] == "completed" and target.is_file() and target.stat().st_size > 0:
        entry["error"] = None
        persist_entry(state_path, entries, entry)
        print(f"[{job['id']}] skipped completed video={job['state_video']}")
        return "skipped", 0

    submissions = 0
    if entry is None:
        entry = new_state_entry(job)
        persist_entry(state_path, entries, entry)
        try:
            task_id = submit_job(config, job, timeout_seconds)
        except ClientError as error:
            entry["status"] = "failed"
            entry["completedAt"] = utc_now()
            entry["error"] = safe_message(error)
            persist_entry(state_path, entries, entry)
            raise
        entry["taskId"] = task_id
        entry["status"] = "processing"
        entry["error"] = None
        persist_entry(state_path, entries, entry)
        submissions = 1
        print(f"[{job['id']}] submitted taskId={task_id}")
    else:
        if entry["status"] == "failed":
            raise ClientError(f"{job['id']} has a retained failed task")
        if entry["status"] == "submitting" or entry["taskId"] is None:
            raise ClientError(f"{job['id']} cannot safely resume without a taskId")
        task_id = entry["taskId"]
        print(f"[{job['id']}] resuming taskId={task_id}")

    try:
        download_url = poll_task(config, job, task_id, poll_seconds, timeout_seconds)
    except RemoteTaskFailed as error:
        entry["status"] = "failed"
        entry["completedAt"] = utc_now()
        entry["error"] = safe_message(error)
        persist_entry(state_path, entries, entry)
        raise
    except ClientError as error:
        entry["error"] = safe_message(error)
        persist_entry(state_path, entries, entry)
        raise

    entry["status"] = "completed"
    entry["completedAt"] = utc_now()
    entry["error"] = None
    persist_entry(state_path, entries, entry)
    try:
        download_video(download_url, target, job["id"], timeout_seconds)
    except ClientError as error:
        entry["error"] = safe_message(error)
        persist_entry(state_path, entries, entry)
        raise

    entry["error"] = None
    persist_entry(state_path, entries, entry)
    print(f"[{job['id']}] completed video={job['state_video']}")
    return "completed", submissions


def run_client(args) -> int:
    manifest_path = resolve_inside(CLIENT_ROOT, args.manifest, "manifest path")
    run_root = resolve_inside(CLIENT_ROOT, args.run_root, "run root")
    manifest = read_json_file(manifest_path, "manifest")
    config = validate_manifest(manifest, run_root)
    selected_jobs = select_jobs(config["jobs"], args.job_ids)

    bridge_version = check_health(
        config["bridge_url"],
        bounded_http_timeout(args.timeout_seconds),
    )
    print(f"bridge ready version={bridge_version}")
    if args.dry_run:
        print(f"selected jobs={len(selected_jobs)} submissions=0 dry-run=true")
        return 0

    try:
        run_root.mkdir(parents=True, exist_ok=True)
        config["video_root"].mkdir(parents=True, exist_ok=True)
    except OSError as error:
        raise ClientError("could not create run directories") from error

    state_path = resolve_inside(run_root, "jobs.json", "jobs state path", require_relative=True)
    entries = load_state(state_path, config["jobs"])
    completed = 0
    skipped = 0
    submissions = 0
    for job in selected_jobs:
        outcome, job_submissions = process_job(
            config,
            job,
            state_path,
            entries,
            args.poll_seconds,
            args.timeout_seconds,
        )
        submissions += job_submissions
        if outcome == "completed":
            completed += 1
        else:
            skipped += 1

    print(
        f"selected jobs={len(selected_jobs)} submissions={submissions} "
        f"completed={completed} skipped={skipped}"
    )
    return 0


def main(argv=None) -> int:
    try:
        return run_client(parse_args(argv))
    except ClientError as error:
        print(f"error: {safe_message(error)}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("error: interrupted", file=sys.stderr)
        return 130
    except Exception as error:  # Keep unexpected failures from echoing request payloads.
        print(f"error: unexpected {type(error).__name__}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
