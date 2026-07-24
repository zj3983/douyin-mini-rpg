#!/usr/bin/env python3
import argparse
import json
import math
from pathlib import Path
from typing import Any
from collections import deque

from PIL import Image


SOURCE_MODES = {"layered-keyframes", "pose-video", "frame-sequence"}
QUALITY_KEYS = (
    "maxCenterDrift",
    "maxScaleDrift",
    "minAlphaCoverage",
    "maxAlphaCoverage",
    "safePadding",
)


def _as_size(value: Any, label: str) -> tuple[int, int]:
    if not isinstance(value, list) or len(value) != 2:
        raise ValueError(f"{label} must be [width, height]")
    width, height = int(value[0]), int(value[1])
    if width <= 0 or height <= 0 or width * 5 != height * 4:
        raise ValueError(f"{label} must be a positive 4:5 size")
    return width, height


def _bbox_or_error(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
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
    visible = sum(1 for alpha in image.getchannel("A").getdata() if alpha > 0)
    if visible < width * height * 0.02:
        raise ValueError("subject is too small")
    return True


def pack_action(frames, frame_size, max_texture_size=4096):
    width, height = _as_size(list(frame_size), "frame_size")
    if not frames:
        raise ValueError("action must contain at least one frame")
    columns = max(1, min(len(frames), max_texture_size // width))
    rows = (len(frames) + columns - 1) // columns
    if rows * height > max_texture_size:
        raise ValueError("action exceeds max texture size")
    atlas = Image.new("RGBA", (columns * width, rows * height), (0, 0, 0, 0))
    rects = []
    for index, frame in enumerate(frames):
        if frame.size != (width, height):
            raise ValueError("all packed frames must match frame_size")
        x = (index % columns) * width
        y = (index // columns) * height
        atlas.alpha_composite(frame, (x, y))
        rects.append({"x": x, "y": y, "w": width, "h": height})
    return atlas, rects


def _load_action_frames(action_config, source_root: Path, frame_size, anchor):
    action_dir = source_root / action_config["source"]
    files = sorted(action_dir.glob("*.png"))
    expected_count = int(action_config["frames"])
    if len(files) != expected_count:
        raise FileNotFoundError(f"{action_dir} expected {expected_count} png frames, found {len(files)}")
    frames = [
        normalize_frame(Image.open(path), frame_size, 0.10, anchor)
        for path in files
    ]
    for frame in frames:
        validate_subject(frame, 0.10)
    return frames


def build_actor(source_config, source_root, output_root):
    source_root = Path(source_root)
    output_root = Path(output_root)
    actor_id = source_config["id"]
    folder = source_config.get("folder") or "".join(part.title() for part in actor_id.split("-"))
    frame_size = _as_size(source_config["runtimeFrameSize"], "runtimeFrameSize")
    anchor = source_config["anchor"]
    actor_dir = output_root / "Assets" / "ActorAtlases" / folder
    actor_dir.mkdir(parents=True, exist_ok=True)

    actions = []
    for action_name, action_config in source_config["actions"].items():
        frames = _load_action_frames(action_config, source_root, frame_size, anchor)
        atlas, rects = pack_action(frames, frame_size)
        atlas_path = actor_dir / f"{action_name}.png"
        atlas.save(atlas_path)
        relative_atlas = f"Assets/ActorAtlases/{folder}/{action_name}.png"
        actions.append({
            "name": action_name,
            "atlas": relative_atlas,
            "fps": action_config.get("fps", 8),
            "loop": bool(action_config.get("loop", False)),
            "order": list(range(len(rects))),
            "frames": rects,
        })

    return {
        "id": actor_id,
        "type": source_config.get("type", "monster"),
        "atlas": actions[0]["atlas"],
        "frameSize": {"w": frame_size[0], "h": frame_size[1]},
        "anchor": source_config["anchor"],
        "actions": actions,
    }


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
        _as_size(actor.get("masterFrameSize"), f"{actor_id}.masterFrameSize")
        _as_size(actor.get("runtimeFrameSize"), f"{actor_id}.runtimeFrameSize")
        _validate_actor_quality(actor_id, actor.get("quality"))
        if not isinstance(actor.get("actions"), dict) or not actor["actions"]:
            raise ValueError(f"{actor_id} must define actions")
        for action_name, action in actor["actions"].items():
            _validate_action(actor_id, action_name, action)
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--actor", action="append", default=[])
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    data = check_source_manifest(root)
    if args.check:
        print("vertical slice atlas source manifest ok")
        return
    selected = args.actor or list(data["actors"].keys())
    source_root = root / data.get("sourceRoot", "art-source/vertical-slice")
    output_root = root / "assets/resources"
    built_actors = [build_actor(data["actors"][actor_id], source_root, output_root) for actor_id in selected]
    existing_actors = [] if not args.actor else _load_existing_runtime_actors(root / "assets/Data/animation-atlas.json")
    actors = merge_actor_manifests(existing_actors, built_actors)
    write_manifest(actors, root / "assets/Data/animation-atlas.json", root / "assets/resources/Data/animation-atlas.json")


if __name__ == "__main__":
    main()
