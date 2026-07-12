import argparse
import json
from collections import deque
from pathlib import Path

from PIL import Image


FRAME_SIZE = 256
GRID_COLUMNS = 4
GRID_ROWS = 5
SAFE_EXTENT = int(FRAME_SIZE * 0.8)
SOURCE_INSET_RATIO = 0.07
ACTION_ROWS = {
    "idle": (0, 2, 6, True),
    "move": (1, 4, 8, True),
    "attack": (2, 4, 10, False),
    "hurt": (3, 2, 8, False),
    "death": (4, 4, 8, False),
}


def actor_folder(actor_id: str) -> str:
    return "".join(part.capitalize() for part in actor_id.split("-"))


def update_actor(manifest: dict, actor_id: str, atlas_path: str) -> None:
    actor = next(item for item in manifest["actors"] if item["id"] == actor_id)
    actor["atlas"] = atlas_path
    actor["frameSize"] = {"w": FRAME_SIZE, "h": FRAME_SIZE}
    actor["actions"] = []
    for name, (row, count, fps, loop) in ACTION_ROWS.items():
        frames = [
            {
                "x": column * FRAME_SIZE,
                "y": row * FRAME_SIZE,
                "w": FRAME_SIZE,
                "h": FRAME_SIZE,
            }
            for column in range(count)
        ]
        actor["actions"].append({
            "name": name,
            "atlas": atlas_path,
            "fps": fps,
            "loop": loop,
            "order": list(range(count)),
            "frames": frames,
        })


def normalize_grid(source: Image.Image) -> Image.Image:
    atlas = Image.new(
        "RGBA",
        (FRAME_SIZE * GRID_COLUMNS, FRAME_SIZE * GRID_ROWS),
        (0, 0, 0, 0),
    )
    for row in range(GRID_ROWS):
        source_top = round(row * source.height / GRID_ROWS)
        source_bottom = round((row + 1) * source.height / GRID_ROWS)
        for column in range(GRID_COLUMNS):
            source_left = round(column * source.width / GRID_COLUMNS)
            source_right = round((column + 1) * source.width / GRID_COLUMNS)
            inset_x = round((source_right - source_left) * SOURCE_INSET_RATIO)
            inset_y = round((source_bottom - source_top) * SOURCE_INSET_RATIO)
            cell = source.crop((
                source_left + inset_x,
                source_top + inset_y,
                source_right - inset_x,
                source_bottom - inset_y,
            ))
            bounds = cell.getchannel("A").getbbox()
            if bounds is None:
                continue
            subject = cell.crop(bounds)
            scale = min(SAFE_EXTENT / subject.width, SAFE_EXTENT / subject.height, 1.0)
            size = (
                max(1, round(subject.width * scale)),
                max(1, round(subject.height * scale)),
            )
            subject = subject.resize(size, Image.Resampling.LANCZOS)
            frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
            frame.alpha_composite(subject, ((FRAME_SIZE - subject.width) // 2, (FRAME_SIZE - subject.height) // 2))
            frame = remove_edge_fragments(frame)
            atlas.alpha_composite(frame, (column * FRAME_SIZE, row * FRAME_SIZE))
    return atlas


def remove_edge_fragments(frame: Image.Image) -> Image.Image:
    alpha = frame.getchannel("A")
    pixels = alpha.load()
    visited = bytearray(FRAME_SIZE * FRAME_SIZE)
    components = []

    for start_y in range(FRAME_SIZE):
        for start_x in range(FRAME_SIZE):
            offset = start_y * FRAME_SIZE + start_x
            if visited[offset] or pixels[start_x, start_y] <= 12:
                continue
            queue = deque([(start_x, start_y)])
            visited[offset] = 1
            points = []
            while queue:
                x, y = queue.popleft()
                points.append((x, y))
                for nx in range(max(0, x - 1), min(FRAME_SIZE, x + 2)):
                    for ny in range(max(0, y - 1), min(FRAME_SIZE, y + 2)):
                        neighbor = ny * FRAME_SIZE + nx
                        if not visited[neighbor] and pixels[nx, ny] > 12:
                            visited[neighbor] = 1
                            queue.append((nx, ny))
            components.append(points)

    if not components:
        return frame

    largest = max(components, key=len)
    largest_xs = [point[0] for point in largest]
    largest_ys = [point[1] for point in largest]
    largest_box = (min(largest_xs), min(largest_ys), max(largest_xs), max(largest_ys))
    edge = (FRAME_SIZE - SAFE_EXTENT) // 2 + 4
    output = frame.copy()
    output_pixels = output.load()
    for component in components:
        if component is largest or len(component) < 4:
            continue
        xs = [point[0] for point in component]
        ys = [point[1] for point in component]
        touches_safe_edge = (
            min(xs) <= edge
            or min(ys) <= edge
            or max(xs) >= FRAME_SIZE - edge - 1
            or max(ys) >= FRAME_SIZE - edge - 1
        )
        horizontal_gap = max(largest_box[0] - max(xs) - 1, min(xs) - largest_box[2] - 1, 0)
        vertical_gap = max(largest_box[1] - max(ys) - 1, min(ys) - largest_box[3] - 1, 0)
        detached_from_subject = horizontal_gap > 6 or vertical_gap > 6
        if touches_safe_edge or detached_from_subject:
            for x, y in component:
                output_pixels[x, y] = (0, 0, 0, 0)

    bounds = output.getchannel("A").getbbox()
    if bounds is None:
        return output
    subject = output.crop(bounds)
    scale = min(SAFE_EXTENT / subject.width, SAFE_EXTENT / subject.height, 1.0)
    size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    normalized = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    normalized.alpha_composite(subject, ((FRAME_SIZE - subject.width) // 2, (FRAME_SIZE - subject.height) // 2))
    normalized.putdata([
        pixel if pixel[3] > 12 else (0, 0, 0, 0)
        for pixel in normalized.get_flattened_data()
    ])
    return normalized


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("actor_id")
    parser.add_argument("source", type=Path)
    args = parser.parse_args()

    root = Path.cwd()
    atlas_rel = f"Assets/ActorAtlases/{actor_folder(args.actor_id)}/atlas.png"
    atlas_path = root / "assets" / "resources" / atlas_rel
    atlas_path.parent.mkdir(parents=True, exist_ok=True)

    source = Image.open(args.source).convert("RGBA")
    atlas = normalize_grid(source)
    atlas.save(atlas_path, "PNG", optimize=True)

    source_manifest_path = root / "assets" / "Data" / "animation-atlas.json"
    resource_manifest_path = root / "assets" / "resources" / "Data" / "animation-atlas.json"
    manifest = json.loads(source_manifest_path.read_text(encoding="utf-8"))
    update_actor(manifest, args.actor_id, atlas_rel)
    encoded = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    source_manifest_path.write_text(encoded, encoding="utf-8")
    resource_manifest_path.write_text(encoded, encoding="utf-8")


if __name__ == "__main__":
    main()
