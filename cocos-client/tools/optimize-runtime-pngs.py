from __future__ import annotations

import argparse
import json
import math
import tempfile
from pathlib import Path

from PIL import Image


def discover_runtime_pngs(project_root: Path) -> list[Path]:
    assets_root = project_root / "assets" / "resources" / "Assets"
    paths: list[Path] = []

    actor_root = assets_root / "ActorAtlases"
    if actor_root.is_dir():
        paths.extend(
            path
            for actor_dir in actor_root.iterdir()
            if actor_dir.is_dir()
            for path in actor_dir.iterdir()
            if path.is_file() and path.name.lower() == "atlas.png"
        )

    world_root = assets_root / "World"
    if world_root.is_dir():
        paths.extend(path for path in world_root.rglob("*") if path.is_file() and path.suffix.lower() == ".png")

    generated_root = assets_root / "Generated" / "Atlases"
    if generated_root.is_dir():
        paths.extend(
            path for path in generated_root.iterdir() if path.is_file() and path.suffix.lower() == ".png"
        )

    return sorted(paths, key=lambda path: path.relative_to(project_root).as_posix())


def _rgba_pixels(path: Path) -> tuple[tuple[int, int], bytes]:
    with Image.open(path) as image:
        image.load()
        rgba = image.convert("RGBA")
        return rgba.size, rgba.tobytes()


def _rgb_psnr(source_rgba: bytes, candidate_rgba: bytes) -> float:
    squared_error = 0
    channel_count = 0
    for offset in range(0, len(source_rgba), 4):
        for channel in range(3):
            difference = source_rgba[offset + channel] - candidate_rgba[offset + channel]
            squared_error += difference * difference
            channel_count += 1
    if squared_error == 0:
        return 999.0
    mse = squared_error / channel_count
    return 10.0 * math.log10((255.0 * 255.0) / mse)


def validate_candidate(source: Path, candidate: Path, *, min_psnr: float = 42.0) -> dict[str, object]:
    source_size, source_rgba = _rgba_pixels(source)
    candidate_size, candidate_rgba = _rgba_pixels(candidate)
    candidate_bytes = candidate.stat().st_size

    if candidate_size != source_size:
        return {"candidateBytes": candidate_bytes, "psnr": None, "accepted": False, "reason": "dimensions-changed"}

    if source_rgba[3::4] != candidate_rgba[3::4]:
        return {"candidateBytes": candidate_bytes, "psnr": None, "accepted": False, "reason": "alpha-changed"}

    psnr = _rgb_psnr(source_rgba, candidate_rgba)
    if psnr < min_psnr:
        return {"candidateBytes": candidate_bytes, "psnr": psnr, "accepted": False, "reason": "psnr-below-threshold"}

    if candidate_bytes >= source.stat().st_size:
        return {"candidateBytes": candidate_bytes, "psnr": psnr, "accepted": False, "reason": "not-smaller"}

    return {"candidateBytes": candidate_bytes, "psnr": psnr, "accepted": True, "reason": None}


def _write_candidate(source: Path, candidate: Path) -> None:
    with Image.open(source) as image:
        image.load()
        rgba = image.convert("RGBA")
        red, green, blue, alpha = rgba.split()
        conservative_lut = [value & 0xFE for value in range(256)]
        optimized = Image.merge(
            "RGBA",
            (red.point(conservative_lut), green.point(conservative_lut), blue.point(conservative_lut), alpha),
        )
        optimized.save(candidate, format="PNG", optimize=True, compress_level=9)


def optimize_png(source: Path, *, apply: bool, min_psnr: float = 42.0) -> dict[str, object]:
    source = Path(source)
    original_bytes = source.stat().st_size
    temporary = tempfile.NamedTemporaryFile(
        mode="wb",
        prefix=f".{source.name}.",
        suffix=".tmp",
        dir=source.parent,
        delete=False,
    )
    candidate = Path(temporary.name)
    temporary.close()

    try:
        _write_candidate(source, candidate)
        validation = validate_candidate(source, candidate, min_psnr=min_psnr)
        result: dict[str, object] = {
            "path": source.as_posix(),
            "originalBytes": original_bytes,
            **validation,
        }
        if result["accepted"] and apply:
            candidate.replace(source)
        return result
    finally:
        candidate.unlink(missing_ok=True)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Safely optimize runtime PNG assets.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="Evaluate candidates without modifying sources.")
    mode.add_argument("--apply", action="store_true", help="Replace sources with accepted candidates.")
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="Cocos client root (defaults to the script's parent project).",
    )
    parser.add_argument("--min-psnr", type=float, default=42.0)
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    project_root = args.project_root.resolve()
    results: list[dict[str, object]] = []

    for path in discover_runtime_pngs(project_root):
        relative_path = path.relative_to(project_root).as_posix()
        try:
            result = optimize_png(path, apply=args.apply, min_psnr=args.min_psnr)
        except Exception as error:
            raise RuntimeError(f"Failed to optimize {relative_path}: {error}") from error
        result["path"] = relative_path
        results.append(result)
        print(json.dumps(result, separators=(",", ":"), sort_keys=True))

    original_bytes = sum(int(result["originalBytes"]) for result in results)
    final_bytes = sum(
        int(result["candidateBytes"]) if result["accepted"] else int(result["originalBytes"])
        for result in results
    )
    totals = {
        "totals": {
            "files": len(results),
            "accepted": sum(bool(result["accepted"]) for result in results),
            "originalBytes": original_bytes,
            "candidateBytes": final_bytes,
            "savedBytes": original_bytes - final_bytes,
        }
    }
    print(json.dumps(totals, separators=(",", ":"), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
