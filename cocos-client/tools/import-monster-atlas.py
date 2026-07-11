import argparse
import json
from pathlib import Path

from PIL import Image


FRAME_SIZE = 256
GRID_COLUMNS = 4
GRID_ROWS = 5
SAFE_EXTENT = int(FRAME_SIZE * 0.8)
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
            cell = source.crop((source_left, source_top, source_right, source_bottom))
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
            x = column * FRAME_SIZE + (FRAME_SIZE - subject.width) // 2
            y = row * FRAME_SIZE + (FRAME_SIZE - subject.height) // 2
            atlas.alpha_composite(subject, (x, y))
    return atlas


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
