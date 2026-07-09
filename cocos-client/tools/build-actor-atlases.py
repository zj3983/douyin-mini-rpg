import json
from pathlib import Path

from PIL import Image


FRAME_SIZE = (256, 256)


CHARACTER_ACTIONS = {
    "idle": {"fps": 6, "loop": True},
    "move": {"fps": 8, "loop": True},
    "cast": {"fps": 10, "loop": False},
    "hurt": {"fps": 8, "loop": False},
}


MONSTER_ACTIONS = {
    "idle": {"fps": 6, "loop": True},
    "move": {"fps": 8, "loop": True},
    "attack": {"fps": 10, "loop": False},
    "hurt": {"fps": 8, "loop": False},
    "death": {"fps": 8, "loop": False},
}


def actor_folder(actor_id: str) -> str:
    return "".join(part.capitalize() for part in actor_id.split("-"))


def read_strip(path: Path) -> list[Image.Image]:
    strip = Image.open(path).convert("RGBA")
    frame_count = strip.width // strip.height
    return [strip.crop((index * strip.height, 0, (index + 1) * strip.height, strip.height)) for index in range(frame_count)]


def pack_actor_atlas(assets_root: Path, actor_id: str, actor_type: str, motion_frames: dict, action_rules: dict) -> dict:
    rows = []
    actions = []
    max_width = 0

    for row_index, (action, rules) in enumerate(action_rules.items()):
      frames = read_strip(assets_root / motion_frames[action])
      row_width = FRAME_SIZE[0] * len(frames)
      max_width = max(max_width, row_width)
      rows.append((action, frames, rules))

    atlas = Image.new("RGBA", (max_width, FRAME_SIZE[1] * len(rows)), (0, 0, 0, 0))

    for row_index, (action, frames, rules) in enumerate(rows):
        rects = []
        for frame_index, frame in enumerate(frames):
            x = frame_index * FRAME_SIZE[0]
            y = row_index * FRAME_SIZE[1]
            atlas.alpha_composite(frame, (x, y))
            rects.append({"x": x, "y": y, "w": FRAME_SIZE[0], "h": FRAME_SIZE[1]})

        actions.append({
            "name": action,
            "atlas": f"Assets/ActorAtlases/{actor_folder(actor_id)}/atlas.png",
            "fps": rules["fps"],
            "loop": rules["loop"],
            "order": list(range(len(rects))),
            "frames": rects,
        })

    atlas_path = assets_root / f"Assets/ActorAtlases/{actor_folder(actor_id)}/atlas.png"
    atlas_path.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(atlas_path, "PNG", optimize=True)

    return {
        "id": actor_id,
        "type": actor_type,
        "atlas": f"Assets/ActorAtlases/{actor_folder(actor_id)}/atlas.png",
        "frameSize": {"w": FRAME_SIZE[0], "h": FRAME_SIZE[1]},
        "actions": actions,
    }


def main() -> None:
    root = Path.cwd()
    assets_root = root / "assets" / "resources"
    catalog = json.loads((root / "assets" / "Data" / "asset-catalog.json").read_text(encoding="utf-8"))

    actors = []
    for character in catalog["characters"]:
        actors.append(pack_actor_atlas(assets_root, character["id"], "character", character["motionFrames"], CHARACTER_ACTIONS))

    for monster in catalog["monsters"]:
        actors.append(pack_actor_atlas(assets_root, monster["id"], "monster", monster["motionFrames"], MONSTER_ACTIONS))

    manifest = {
        "version": 1,
        "framePacking": "single-atlas-per-actor",
        "actors": actors,
    }
    (root / "assets" / "Data" / "animation-atlas.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
