#!/usr/bin/env python3
import argparse
import json
import math
import os
import re
import shutil
import tempfile
from collections import deque
from pathlib import Path, PurePosixPath, PureWindowsPath
from statistics import median
from typing import Any

from PIL import Image, ImageDraw, ImageFont


SOURCE_MODES = {"layered-keyframes", "pose-video", "frame-sequence"}
QUALITY_KEYS = (
    "maxCenterDrift",
    "maxScaleDrift",
    "minAlphaCoverage",
    "maxAlphaCoverage",
    "safePadding",
)
DEFAULT_QUALITY = {
    "maxCenterDrift": 0.08,
    "maxScaleDrift": 0.12,
    "minAlphaCoverage": 0.02,
    "maxAlphaCoverage": 0.72,
    "safePadding": 0.08,
}
ALPHA_VISIBILITY_THRESHOLD = 8
CONTACT_THUMBNAIL_SIZE = (160, 200)
CONTACT_SHEET_PIXEL_BUDGET = 12_000_000
PORTABLE_ACTOR_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
PORTABLE_FOLDER = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
WINDOWS_RESERVED_NAMES = {
    "con",
    "prn",
    "aux",
    "nul",
    *(f"com{index}" for index in range(1, 10)),
    *(f"lpt{index}" for index in range(1, 10)),
}


def _as_size(value: Any, label: str) -> tuple[int, int]:
    if not isinstance(value, list) or len(value) != 2:
        raise ValueError(f"{label} must be [width, height]")
    width, height = value
    if type(width) is not int or type(height) is not int:
        raise ValueError(f"{label} dimensions must be integers")
    if width <= 0 or height <= 0 or width * 5 != height * 4:
        raise ValueError(f"{label} must be a positive 4:5 size")
    return width, height


def _visible_alpha_mask(image: Image.Image):
    return image.getchannel("A").point(
        lambda alpha: 255 if alpha >= ALPHA_VISIBILITY_THRESHOLD else 0
    )


def _bbox_or_error(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = _visible_alpha_mask(image).getbbox()
    if bbox is None:
        raise ValueError("frame has no visible subject")
    return bbox


def remove_small_alpha_components(image: Image.Image, min_area=16):
    source = image.convert("RGBA")
    width, height = source.size
    alpha = source.getchannel("A")
    pixels = alpha.load()
    visited = bytearray(width * height)
    output = source.load()
    for start_y in range(height):
        for start_x in range(width):
            offset = start_y * width + start_x
            if visited[offset] or pixels[start_x, start_y] == 0:
                continue
            queue = deque([(start_x, start_y)])
            visited[offset] = 1
            component = []
            while queue:
                x, y = queue.popleft()
                component.append((x, y))
                for nx in range(max(0, x - 1), min(width, x + 2)):
                    for ny in range(max(0, y - 1), min(height, y + 2)):
                        neighbor = ny * width + nx
                        if not visited[neighbor] and pixels[nx, ny] > 0:
                            visited[neighbor] = 1
                            queue.append((nx, ny))
            if len(component) < min_area:
                for x, y in component:
                    red, green, blue, alpha_value = output[x, y]
                    output[x, y] = (red, green, blue, 0)
    return source


def normalize_frame(image: Image.Image, frame_size, padding_ratio, anchor):
    target_width, target_height = _as_size(list(frame_size), "frame_size")
    if not 0 <= padding_ratio < 0.4:
        raise ValueError("padding_ratio must be in [0, 0.4)")
    anchor_x = float(anchor.get("x", 0.5))
    anchor_y = float(anchor.get("y", 0.85))
    if not 0 <= anchor_x <= 1 or not 0 <= anchor_y <= 1:
        raise ValueError("anchor must be normalized")

    source = image.convert("RGBA")
    left, top, right, bottom = _bbox_or_error(source)
    subject = source.crop((left, top, right, bottom))
    safe_width = target_width * (1 - padding_ratio * 2)
    safe_height = target_height * (1 - padding_ratio * 2)
    scale = min(safe_width / subject.width, safe_height / subject.height)
    resized = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )

    frame = Image.new("RGBA", (target_width, target_height), (0, 0, 0, 0))
    paste_x = round(target_width * anchor_x - resized.width * anchor_x)
    paste_y = round(target_height * anchor_y - resized.height * anchor_y)
    paste_x = max(round(target_width * padding_ratio), min(round(target_width * (1 - padding_ratio) - resized.width), paste_x))
    paste_y = max(round(target_height * padding_ratio), min(round(target_height * (1 - padding_ratio) - resized.height), paste_y))
    frame.alpha_composite(resized, (paste_x, paste_y))
    return remove_small_alpha_components(frame)


def validate_subject(frame: Image.Image, padding_ratio):
    image = frame.convert("RGBA")
    left, top, right, bottom = _bbox_or_error(image)
    width, height = image.size
    margin = min(left / width, top / height, (width - right) / width, (height - bottom) / height)
    if margin < padding_ratio - 0.015:
        raise ValueError(f"subject margin {margin:.3f} below requested padding {padding_ratio:.3f}")
    visible = sum(
        1
        for alpha in image.getchannel("A").getdata()
        if alpha >= ALPHA_VISIBILITY_THRESHOLD
    )
    if visible < width * height * 0.02:
        raise ValueError("subject is too small")
    return True


def frame_metrics(frame: Image.Image):
    image = frame.convert("RGBA")
    left, top, right, bottom = _bbox_or_error(image)
    width, height = image.size
    if width <= 0 or height <= 0:
        raise ValueError("frame dimensions must be positive")
    visible_width = right - left
    visible_height = bottom - top
    visible_pixels = sum(
        1
        for alpha in image.getchannel("A").getdata()
        if alpha >= ALPHA_VISIBILITY_THRESHOLD
    )
    return {
        "bounds": [left, top, right, bottom],
        "center": [
            (left + right) / (2 * width),
            (top + bottom) / (2 * height),
        ],
        "scale": [visible_width / width, visible_height / height],
        "alphaCoverage": visible_pixels / (width * height),
        "edgeMargins": [
            left / width,
            top / height,
            (width - right) / width,
            (height - bottom) / height,
        ],
    }


def analyze_action(frames, quality):
    if not frames:
        raise ValueError("action frames must not be empty")
    _validate_actor_quality("action", quality)

    metrics = []
    for index, frame in enumerate(frames):
        try:
            current = frame_metrics(frame)
        except ValueError as error:
            raise ValueError(f"frame {index} has no visible subject") from error
        coverage = current["alphaCoverage"]
        if not quality["minAlphaCoverage"] <= coverage <= quality["maxAlphaCoverage"]:
            raise ValueError(
                f"frame {index} alpha coverage {coverage:.6f} outside "
                f"[{quality['minAlphaCoverage']:.6f}, {quality['maxAlphaCoverage']:.6f}]"
            )
        minimum_margin = min(current["edgeMargins"])
        safe_edge = quality["safePadding"] - 0.015
        if minimum_margin < safe_edge:
            raise ValueError(
                f"frame {index} violates safe edge: margin {minimum_margin:.6f} below {safe_edge:.6f}"
            )
        metrics.append(current)

    median_center = [
        median(frame["center"][0] for frame in metrics),
        median(frame["center"][1] for frame in metrics),
    ]
    center_drift = max(
        math.dist(frame["center"], median_center)
        for frame in metrics
    )

    median_scale = [
        median(frame["scale"][0] for frame in metrics),
        median(frame["scale"][1] for frame in metrics),
    ]
    scale_drift = max(
        abs(frame["scale"][axis] - median_scale[axis]) / median_scale[axis]
        for frame in metrics
        for axis in range(2)
    )

    if center_drift > quality["maxCenterDrift"]:
        raise ValueError(
            f"center drift {center_drift:.6f} exceeds {quality['maxCenterDrift']:.6f}"
        )
    if scale_drift > quality["maxScaleDrift"]:
        raise ValueError(
            f"scale drift {scale_drift:.6f} exceeds {quality['maxScaleDrift']:.6f}"
        )

    return {
        "frameCount": len(metrics),
        "centerDrift": center_drift,
        "scaleDrift": scale_drift,
        "medianCenter": median_center,
        "medianScale": median_scale,
        "alphaCoverage": {
            "min": min(frame["alphaCoverage"] for frame in metrics),
            "max": max(frame["alphaCoverage"] for frame in metrics),
            "median": median(frame["alphaCoverage"] for frame in metrics),
        },
        "minimumEdgeMargin": min(min(frame["edgeMargins"]) for frame in metrics),
        "frames": metrics,
    }


def _draw_checkerboard(image: Image.Image, cell_size=8):
    draw = ImageDraw.Draw(image)
    colors = ((54, 60, 72, 255), (76, 84, 98, 255))
    for y in range(0, image.height, cell_size):
        for x in range(0, image.width, cell_size):
            color = colors[((x // cell_size) + (y // cell_size)) % 2]
            draw.rectangle((x, y, x + cell_size - 1, y + cell_size - 1), fill=color)


def _ascii_label(value: str, limit=14):
    cleaned = "".join(character if 32 <= ord(character) < 127 else "?" for character in value)
    return cleaned[:limit]


def _contact_thumbnail(frame: Image.Image):
    thumbnail = frame.convert("RGBA")
    thumbnail.thumbnail(CONTACT_THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
    return thumbnail


def write_contact_sheet(action_frames, path):
    if not action_frames:
        raise ValueError("contact sheet requires at least one action")
    if any(not frames for frames in action_frames.values()):
        raise ValueError("contact sheet actions require at least one frame")
    frame_width, frame_height = CONTACT_THUMBNAIL_SIZE
    frame_count = max(len(frames) for frames in action_frames.values())
    label_width = 112
    gutter = 8
    row_height = frame_height + gutter * 2
    width = label_width + frame_count * (frame_width + gutter) + gutter
    height = len(action_frames) * row_height
    if width * height > CONTACT_SHEET_PIXEL_BUDGET:
        raise ValueError(
            f"contact sheet layout exceeds pixel budget: {width * height} > "
            f"{CONTACT_SHEET_PIXEL_BUDGET}"
        )
    sheet = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    _draw_checkerboard(sheet)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for row, (action_name, frames) in enumerate(action_frames.items()):
        row_y = row * row_height
        draw.rectangle((0, row_y, label_width - 1, row_y + row_height - 1), fill=(22, 27, 38, 235))
        draw.text((gutter, row_y + gutter), _ascii_label(action_name), fill=(238, 242, 250, 255), font=font)
        for column, frame in enumerate(frames):
            thumbnail = _contact_thumbnail(frame)
            x = label_width + gutter + column * (frame_width + gutter)
            x += (frame_width - thumbnail.width) // 2
            y = row_y + gutter + (frame_height - thumbnail.height) // 2
            sheet.alpha_composite(thumbnail, (x, y))
            draw.text((x, row_y + 1), str(column), fill=(238, 242, 250, 255), font=font)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path, format="PNG", optimize=False, compress_level=9)
    return path


def _validate_actor_id(actor_id: Any):
    if not isinstance(actor_id, str) or not PORTABLE_ACTOR_ID.fullmatch(actor_id):
        raise ValueError("actor id must be a portable lowercase hyphenated slug")
    if actor_id.casefold() in WINDOWS_RESERVED_NAMES:
        raise ValueError(f"actor id {actor_id!r} is reserved on Windows")
    return actor_id


def _validate_actor_folder(folder: Any):
    if not isinstance(folder, str) or not PORTABLE_FOLDER.fullmatch(folder):
        raise ValueError("actor folder must be one portable path component")
    if folder.casefold() in WINDOWS_RESERVED_NAMES:
        raise ValueError(f"actor folder {folder!r} is reserved on Windows")
    return folder


def _resolve_actor_output_directory(output_root: Path, folder: str):
    resolved_output_root = Path(output_root).resolve()
    actor_root = (resolved_output_root / "Assets" / "ActorAtlases").resolve()
    try:
        actor_root.relative_to(resolved_output_root)
    except ValueError as error:
        raise ValueError("actor atlas root must stay inside output root") from error

    actor_dir = (actor_root / folder).resolve()
    try:
        actor_dir.relative_to(actor_root)
    except ValueError as error:
        raise ValueError("actor folder must stay inside actor atlas root") from error
    if actor_dir.parent != actor_root:
        raise ValueError("actor folder must be one direct actor atlas component")
    return actor_dir


def _report_output_path(report_root: Path, filename: str):
    root = report_root.resolve()
    output = (root / filename).resolve()
    try:
        output.relative_to(root)
    except ValueError as error:
        raise ValueError("report output must stay inside report root") from error
    if output.parent != root:
        raise ValueError("report output must stay directly inside report root")
    return output


def write_actor_report(
    *,
    actor_id,
    source_modes,
    action_frames,
    source_metrics,
    runtime_metrics,
    atlas_dimensions,
    warnings,
    report_root,
    status="candidate",
):
    actor_id = _validate_actor_id(actor_id)
    report_root = Path(report_root).resolve()
    report_root.mkdir(parents=True, exist_ok=True)
    contact_sheet_name = f"{actor_id}-contact-sheet.png"
    contact_sheet_path = _report_output_path(report_root, contact_sheet_name)
    write_contact_sheet(action_frames, contact_sheet_path)
    actions = {
        action_name: {
            "sourceMetrics": source_metrics[action_name],
            "runtimeMetrics": runtime_metrics[action_name],
        }
        for action_name in source_modes
    }
    report = {
        "status": status,
        "actorId": actor_id,
        "sourceModes": source_modes,
        "actions": actions,
        "atlasDimensions": atlas_dimensions,
        "warnings": list(warnings),
        "contactSheet": contact_sheet_name,
    }
    report_path = _report_output_path(report_root, f"{actor_id}-report.json")
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return report


def pack_action(frames, frame_size, max_texture_size=2048):
    width, height = _as_size(list(frame_size), "frame_size")
    if not frames:
        raise ValueError("action must contain at least one frame")
    if width > max_texture_size or height > max_texture_size:
        raise ValueError(f"action exceeds {max_texture_size} texture size")
    columns = max(1, min(len(frames), max_texture_size // width))
    rows = (len(frames) + columns - 1) // columns
    output_width = columns * width
    output_height = rows * height
    if output_width > max_texture_size or output_height > max_texture_size:
        raise ValueError(f"action exceeds {max_texture_size} texture size")
    atlas = Image.new("RGBA", (output_width, output_height), (0, 0, 0, 0))
    rects = []
    for index, frame in enumerate(frames):
        if frame.size != (width, height):
            raise ValueError("all packed frames must match frame_size")
        x = (index % columns) * width
        y = (index // columns) * height
        atlas.alpha_composite(frame, (x, y))
        rects.append({"x": x, "y": y, "w": width, "h": height})
    return atlas, rects


def _load_action_source_frames(action_config, source_root: Path):
    action_dir = source_root / action_config["source"]
    files = sorted(action_dir.glob("*.png"))
    expected_count = int(action_config["frames"])
    if len(files) != expected_count:
        raise FileNotFoundError(f"{action_dir} expected {expected_count} png frames, found {len(files)}")
    frames = []
    for path in files:
        with Image.open(path) as image:
            frames.append(image.convert("RGBA"))
    return frames


def _normalize_action_frames(source_frames, frame_size, anchor):
    frames = [
        normalize_frame(frame, frame_size, 0.10, anchor)
        for frame in source_frames
    ]
    for frame in frames:
        validate_subject(frame, 0.10)
    return frames


def build_actor(source_config, source_root, output_root, report_root=None, report_status="candidate"):
    source_root = Path(source_root)
    output_root = Path(output_root)
    actor_id = _validate_actor_id(source_config["id"])
    configured_folder = source_config.get("folder")
    folder = _validate_actor_folder(
        "".join(part.title() for part in actor_id.split("-"))
        if configured_folder is None
        else configured_folder
    )
    frame_size = _as_size(source_config["runtimeFrameSize"], "runtimeFrameSize")
    anchor = source_config["anchor"]
    actor_dir = _resolve_actor_output_directory(output_root, folder)
    actor_dir.mkdir(parents=True, exist_ok=True)

    quality = source_config.get("quality", DEFAULT_QUALITY)
    actions = []
    action_frames = {}
    source_metrics = {}
    runtime_metrics = {}
    atlas_dimensions = {}
    source_modes = {}
    for action_name, action_config in source_config["actions"].items():
        source_frames = _load_action_source_frames(action_config, source_root)
        source_metrics[action_name] = analyze_action(source_frames, quality)
        frames = _normalize_action_frames(source_frames, frame_size, anchor)
        del source_frames
        action_frames[action_name] = [_contact_thumbnail(frame) for frame in frames]
        runtime_metrics[action_name] = analyze_action(frames, quality)
        source_modes[action_name] = action_config.get("sourceMode", "frame-sequence")
        atlas, rects = pack_action(frames, frame_size)
        atlas_dimensions[action_name] = [atlas.width, atlas.height]
        atlas_path = actor_dir / f"{action_name}.png"
        atlas.save(atlas_path)
        relative_atlas = f"Assets/ActorAtlases/{folder}/{action_name}.png"
        action = {
            "name": action_name,
            "atlas": relative_atlas,
            "fps": action_config.get("fps", 8),
            "loop": bool(action_config.get("loop", False)),
            "order": list(range(len(rects))),
            "frames": rects,
        }
        events = action_config.get("events", [])
        if events:
            action["events"] = [
                {"name": event["name"], "at": float(event["time"])}
                for event in events
            ]
        actions.append(action)

    actor = {
        "id": actor_id,
        "type": source_config.get("type", "monster"),
        "atlas": actions[0]["atlas"],
        "frameSize": {"w": frame_size[0], "h": frame_size[1]},
        "anchor": source_config["anchor"],
        "actions": actions,
    }
    if report_root is not None:
        write_actor_report(
            actor_id=actor_id,
            source_modes=source_modes,
            action_frames=action_frames,
            source_metrics=source_metrics,
            runtime_metrics=runtime_metrics,
            atlas_dimensions=atlas_dimensions,
            warnings=[],
            report_root=report_root,
            status=report_status,
        )
    return actor


def write_manifest(actors, source_path, resource_path):
    manifest = {
        "version": 2,
        "framePacking": "vertical-slice-action-atlases",
        "actors": actors,
    }
    payload = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    source_path = Path(source_path)
    resource_path = Path(resource_path)
    source_path.parent.mkdir(parents=True, exist_ok=True)
    resource_path.parent.mkdir(parents=True, exist_ok=True)
    source_path.write_text(payload, encoding="utf-8")
    resource_path.write_text(payload, encoding="utf-8")
    return manifest


def merge_actor_manifests(existing_actors, updated_actors):
    by_id = {actor["id"]: actor for actor in existing_actors}
    ordered_ids = []
    for actor in existing_actors:
        actor_id = actor["id"]
        if actor_id not in ordered_ids:
            ordered_ids.append(actor_id)
    for actor in updated_actors:
        actor_id = actor["id"]
        by_id[actor_id] = actor
        if actor_id not in ordered_ids:
            ordered_ids.append(actor_id)
    return [by_id[actor_id] for actor_id in ordered_ids]


def _load_existing_runtime_actors(path: Path):
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    actors = data.get("actors", [])
    if not isinstance(actors, list):
        raise ValueError("existing animation manifest actors must be a list")
    return actors


def select_actor_ids(data, requested):
    actors = data.get("actors", {})
    if not isinstance(actors, dict) or not actors:
        raise ValueError("source manifest must define actors")
    if not requested:
        return list(actors.keys())
    if any(not isinstance(actor_id, str) or not actor_id.strip() for actor_id in requested):
        raise ValueError("selected actor ids must be non-empty")
    if len(set(requested)) != len(requested):
        raise ValueError("selected actor ids must not contain duplicates")
    unknown = [actor_id for actor_id in requested if actor_id not in actors]
    if unknown:
        raise ValueError(f"unknown actor ids: {', '.join(unknown)}")
    return list(requested)


def _candidate_actor_root(candidate_root: Path, actor_id: str):
    actor_id = _validate_actor_id(actor_id)
    root = Path(candidate_root).resolve()
    candidate = (root / actor_id).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise ValueError("candidate actor path must stay inside candidate root") from error
    return candidate


def _build_actor_candidate(source_config, source_root, actor_root, status="candidate"):
    actor_root = Path(actor_root)
    return build_actor(
        source_config,
        source_root,
        actor_root,
        actor_root / "reports",
        report_status=status,
    )


def _replace_paths_atomically(replacements):
    token = next(tempfile._get_candidate_names())
    applied = []
    try:
        for replacement, target in replacements:
            replacement = Path(replacement)
            target = Path(target)
            target.parent.mkdir(parents=True, exist_ok=True)
            backup = target.with_name(f".{target.name}.backup-{token}")
            if backup.exists():
                if backup.is_dir():
                    shutil.rmtree(backup)
                else:
                    backup.unlink()
            had_target = target.exists()
            if had_target:
                os.replace(target, backup)
            try:
                os.replace(replacement, target)
            except Exception:
                if had_target and backup.exists():
                    os.replace(backup, target)
                raise
            applied.append((target, backup, had_target))
    except Exception:
        for target, backup, had_target in reversed(applied):
            if target.exists():
                if target.is_dir():
                    shutil.rmtree(target)
                else:
                    target.unlink()
            if had_target and backup.exists():
                os.replace(backup, target)
        raise
    for _, backup, had_target in applied:
        if had_target and backup.exists():
            if backup.is_dir():
                shutil.rmtree(backup)
            else:
                backup.unlink()


def build_candidate_actors(data, selected_actor_ids, source_root, candidate_root):
    selected = select_actor_ids(data, selected_actor_ids)
    candidate_root = Path(candidate_root)
    candidate_root.mkdir(parents=True, exist_ok=True)
    built = []
    for actor_id in selected:
        target = _candidate_actor_root(candidate_root, actor_id)
        stage = Path(tempfile.mkdtemp(prefix=f".{actor_id}-", dir=candidate_root))
        try:
            actor = _build_actor_candidate(data["actors"][actor_id], source_root, stage)
            _replace_paths_atomically([(stage, target)])
            built.append(actor)
        except Exception:
            if stage.exists():
                shutil.rmtree(stage)
            raise
    return built


def _manifest_payload(actors):
    return (json.dumps({
        "version": 2,
        "framePacking": "vertical-slice-action-atlases",
        "actors": actors,
    }, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def promote_selected_actors(
    data,
    selected_actor_ids,
    source_root,
    candidate_root,
    runtime_output_root,
    source_manifest_path,
    resource_manifest_path,
):
    selected = select_actor_ids(data, selected_actor_ids)
    candidate_root = Path(candidate_root).resolve()
    candidate_root.parent.mkdir(parents=True, exist_ok=True)
    transaction = Path(tempfile.mkdtemp(prefix=".animation-promotion-", dir=candidate_root.parent))
    source_manifest_path = Path(source_manifest_path)
    resource_manifest_path = Path(resource_manifest_path)
    runtime_output_root = Path(runtime_output_root)
    replacements = []
    try:
        built = []
        for actor_id in selected:
            actor_root = transaction / "candidates" / actor_id
            actor = _build_actor_candidate(data["actors"][actor_id], source_root, actor_root)
            report_path = actor_root / "reports" / f"{actor_id}-report.json"
            report = json.loads(report_path.read_text(encoding="utf-8"))
            if report.get("warnings"):
                raise ValueError(f"{actor_id} candidate report contains warnings")
            report["status"] = "approved"
            report_path.write_text(
                json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )
            built.append(actor)

        existing_actors = _load_existing_runtime_actors(source_manifest_path)
        merged_actors = merge_actor_manifests(existing_actors, built)
        payload = _manifest_payload(merged_actors)
        manifest_stage = transaction / "manifests"
        manifest_stage.mkdir(parents=True, exist_ok=True)
        staged_source_manifest = manifest_stage / "source.json"
        staged_resource_manifest = manifest_stage / "resource.json"
        staged_source_manifest.write_bytes(payload)
        staged_resource_manifest.write_bytes(payload)

        runtime_stage = transaction / "runtime"
        for actor_id in selected:
            config = data["actors"][actor_id]
            folder = _validate_actor_folder(config.get("folder") or "".join(part.title() for part in actor_id.split("-")))
            candidate_actor = transaction / "candidates" / actor_id
            source_actor_dir = _resolve_actor_output_directory(candidate_actor, folder)
            staged_actor_dir = runtime_stage / folder
            shutil.copytree(source_actor_dir, staged_actor_dir)
            runtime_actor_dir = _resolve_actor_output_directory(runtime_output_root, folder)
            replacements.append((staged_actor_dir, runtime_actor_dir))

            staged_candidate = transaction / "approved" / actor_id
            shutil.copytree(candidate_actor, staged_candidate)
            replacements.append((staged_candidate, _candidate_actor_root(candidate_root, actor_id)))

        replacements.extend([
            (staged_source_manifest, source_manifest_path),
            (staged_resource_manifest, resource_manifest_path),
        ])
        _replace_paths_atomically(replacements)
        return built
    finally:
        if transaction.exists():
            shutil.rmtree(transaction)


def _load_source_manifest(root: Path):
    path = root / "assets/Data/vertical-slice-animation-sources.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _validate_actor_quality(actor_id: str, quality: Any):
    if not isinstance(quality, dict):
        raise ValueError(f"{actor_id}.quality must be an object")
    for key in QUALITY_KEYS:
        if key not in quality or not _is_number(quality[key]):
            raise ValueError(f"{actor_id}.quality.{key} must be numeric")
    for key in ("maxCenterDrift", "maxScaleDrift", "minAlphaCoverage", "maxAlphaCoverage"):
        if not 0 <= quality[key] <= 1:
            raise ValueError(f"{actor_id}.quality.{key} must be in [0, 1]")
    if not 0 <= quality["safePadding"] < 0.4:
        raise ValueError(f"{actor_id}.quality.safePadding must be in [0, 0.4)")
    if quality["minAlphaCoverage"] >= quality["maxAlphaCoverage"]:
        raise ValueError(f"{actor_id}.quality alpha coverage minimum must be below maximum")


def _validate_anchor(actor_id: str, anchor: Any):
    if not isinstance(anchor, dict):
        raise ValueError(f"{actor_id}.anchor must be an object")
    for coordinate in ("x", "y"):
        value = anchor.get(coordinate)
        if not _is_number(value) or not 0 <= value <= 1:
            raise ValueError(f"{actor_id}.anchor.{coordinate} must be numeric and in [0, 1]")


def _validate_source_path(label: str, source: Any):
    if not isinstance(source, str) or not source.strip() or source != source.strip():
        raise ValueError(f"{label} source must be a non-empty relative path")
    normalized = source.replace("\\", "/")
    windows_path = PureWindowsPath(source)
    posix_path = PurePosixPath(normalized)
    if windows_path.is_absolute() or windows_path.drive or posix_path.is_absolute():
        raise ValueError(f"{label} source must be relative")
    if any(part in ("", ".", "..") for part in normalized.split("/")):
        raise ValueError(f"{label} source must not contain empty or traversal segments")


def _validate_action(actor_id: str, action_name: str, action: Any):
    label = f"{actor_id}/{action_name}"
    if not isinstance(action, dict):
        raise ValueError(f"{label} must be an object")

    frames = action.get("frames")
    if not isinstance(frames, int) or isinstance(frames, bool) or not 1 <= frames <= 16:
        raise ValueError(f"{label} frames must be an integer in [1, 16]")

    fps = action.get("fps")
    if not _is_number(fps) or not 1 <= fps <= 24:
        raise ValueError(f"{label} fps must be numeric and in [1, 24]")

    if action.get("sourceMode") not in SOURCE_MODES:
        raise ValueError(f"{label} sourceMode must be one of {sorted(SOURCE_MODES)}")

    _validate_source_path(label, action.get("source"))

    if type(action.get("loop")) is not bool:
        raise ValueError(f"{label} loop must be boolean")

    events = action.get("events", [])
    if not isinstance(events, list):
        raise ValueError(f"{label} events must be an array")
    previous_time = None
    for event in events:
        if not isinstance(event, dict):
            raise ValueError(f"{label} event must be an object")
        name = event.get("name")
        time = event.get("time")
        if not isinstance(name, str) or not name.strip():
            raise ValueError(f"{label} event name must be non-empty")
        if not _is_number(time) or not 0 < time < 1:
            raise ValueError(f"{label} event time must be strictly between 0 and 1")
        if previous_time is not None and time <= previous_time:
            raise ValueError(f"{label} event times must be strictly increasing")
        previous_time = time


def check_source_manifest(root: Path):
    data = _load_source_manifest(root)
    if data.get("version") != 2:
        raise ValueError("source manifest version must be 2")
    actors = data.get("actors")
    if not isinstance(actors, dict) or not actors:
        raise ValueError("source manifest must define actors")
    for actor_id, actor in actors.items():
        _validate_actor_id(actor_id)
        if not isinstance(actor, dict):
            raise ValueError(f"{actor_id} must be an object")
        declared_id = actor.get("id")
        if not isinstance(declared_id, str) or not declared_id.strip() or declared_id != actor_id:
            raise ValueError(f"{actor_id}.id must be non-empty and match its actor key")
        if actor.get("folder") is not None:
            _validate_actor_folder(actor["folder"])
        _as_size(actor.get("masterFrameSize"), f"{actor_id}.masterFrameSize")
        _as_size(actor.get("runtimeFrameSize"), f"{actor_id}.runtimeFrameSize")
        _validate_anchor(actor_id, actor.get("anchor"))
        _validate_actor_quality(actor_id, actor.get("quality"))
        if not isinstance(actor.get("actions"), dict) or not actor["actions"]:
            raise ValueError(f"{actor_id} must define actions")
        for action_name, action in actor["actions"].items():
            _validate_action(actor_id, action_name, action)
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--promote", action="store_true")
    parser.add_argument("--actor", action="append", default=[])
    parser.add_argument("--report-root")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    data = check_source_manifest(root)
    if args.check:
        if args.promote or args.actor or args.report_root:
            parser.error("--check is read-only and cannot be combined with build options")
        print("vertical slice atlas source manifest ok")
        return
    selected = select_actor_ids(data, args.actor)
    source_root = root / data.get("sourceRoot", "art-source/vertical-slice")
    candidate_root = Path(args.report_root) if args.report_root else root / "artifacts/animation-candidates"
    if args.promote:
        promote_selected_actors(
            data,
            selected,
            source_root,
            candidate_root,
            root / "assets/resources",
            root / "assets/Data/animation-atlas.json",
            root / "assets/resources/Data/animation-atlas.json",
        )
        print(f"promoted {len(selected)} actor atlas candidate(s)")
    else:
        build_candidate_actors(data, selected, source_root, candidate_root)
        print(f"built {len(selected)} actor atlas candidate(s) under {candidate_root}")


if __name__ == "__main__":
    main()
