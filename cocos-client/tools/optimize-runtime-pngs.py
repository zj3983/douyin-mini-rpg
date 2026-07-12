from __future__ import annotations

import argparse
import io
import json
import math
import os
import stat
import tempfile
from pathlib import Path

from PIL import Image


def _is_reparse_point(path: Path) -> bool:
    try:
        path_stat = path.lstat()
    except FileNotFoundError:
        return False
    file_attributes = getattr(path_stat, "st_file_attributes", 0)
    reparse_attribute = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0)
    return path.is_symlink() or path.is_junction() or bool(file_attributes & reparse_attribute)


def _reject_reparse_point(path: Path) -> None:
    if _is_reparse_point(path):
        raise RuntimeError(f"Refusing symbolic link, junction, or reparse point: {path}")


def _validate_allowed_root(root: Path, project_root: Path) -> Path | None:
    if not root.exists() and not _is_reparse_point(root):
        return None

    current = root
    while True:
        _reject_reparse_point(current)
        if current == project_root:
            break
        if current.parent == current:
            raise RuntimeError(f"Allowed PNG root is outside project root: {root}")
        current = current.parent

    resolved_project = project_root.resolve(strict=True)
    resolved_root = root.resolve(strict=True)
    if not resolved_root.is_relative_to(resolved_project):
        raise RuntimeError(f"Allowed PNG root escapes project root: {root}")
    return resolved_root


def _validate_candidate_path(candidate: Path, allowed_root: Path, resolved_root: Path) -> Path:
    current = candidate
    while True:
        _reject_reparse_point(current)
        if current == allowed_root:
            break
        if current.parent == current:
            raise RuntimeError(f"Runtime PNG is outside allowed root: {candidate}")
        current = current.parent

    resolved_candidate = candidate.resolve(strict=True)
    if not resolved_candidate.is_relative_to(resolved_root):
        raise RuntimeError(f"Runtime PNG escapes allowed root: {candidate}")
    return candidate


def discover_runtime_pngs(project_root: Path) -> list[Path]:
    project_root = Path(project_root).absolute()
    assets_root = project_root / "assets" / "resources" / "Assets"
    paths: list[Path] = []

    actor_root = assets_root / "ActorAtlases"
    resolved_actor_root = _validate_allowed_root(actor_root, project_root)
    if resolved_actor_root is not None:
        for actor_dir in sorted(actor_root.iterdir(), key=lambda path: path.name):
            _reject_reparse_point(actor_dir)
            if not actor_dir.is_dir():
                continue
            for candidate in actor_dir.iterdir():
                if candidate.name.lower() == "atlas.png":
                    paths.append(_validate_candidate_path(candidate, actor_root, resolved_actor_root))

    world_root = assets_root / "World"
    resolved_world_root = _validate_allowed_root(world_root, project_root)
    if resolved_world_root is not None:
        for directory, directory_names, file_names in os.walk(world_root, followlinks=False):
            directory_path = Path(directory)
            directory_names.sort()
            file_names.sort()
            for directory_name in directory_names:
                _reject_reparse_point(directory_path / directory_name)
            for file_name in file_names:
                candidate = directory_path / file_name
                if candidate.suffix.lower() == ".png":
                    paths.append(_validate_candidate_path(candidate, world_root, resolved_world_root))

    generated_root = assets_root / "Generated" / "Atlases"
    resolved_generated_root = _validate_allowed_root(generated_root, project_root)
    if resolved_generated_root is not None:
        for candidate in generated_root.iterdir():
            if candidate.suffix.lower() == ".png":
                paths.append(_validate_candidate_path(candidate, generated_root, resolved_generated_root))

    return sorted(paths, key=lambda path: path.relative_to(project_root).as_posix())


def _rgba_pixels(source: Path | bytes) -> tuple[tuple[int, int], bytes]:
    image_source = io.BytesIO(source) if isinstance(source, bytes) else source
    with Image.open(image_source) as image:
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
        return math.inf
    mse = squared_error / channel_count
    return 10.0 * math.log10((255.0 * 255.0) / mse)


def _validate_candidate_bytes(source: Path, candidate_data: bytes, *, min_psnr: float) -> dict[str, object]:
    source_size, source_rgba = _rgba_pixels(source)
    candidate_size, candidate_rgba = _rgba_pixels(candidate_data)
    candidate_bytes = len(candidate_data)

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


def validate_candidate(source: Path, candidate: Path, *, min_psnr: float = 42.0) -> dict[str, object]:
    return _validate_candidate_bytes(source, candidate.read_bytes(), min_psnr=min_psnr)


def _encode_candidate(source: Path) -> bytes:
    with Image.open(source) as image:
        image.load()
        rgba = image.convert("RGBA")
        red, green, blue, alpha = rgba.split()
        conservative_lut = [value & 0xFE for value in range(256)]
        optimized = Image.merge(
            "RGBA",
            (red.point(conservative_lut), green.point(conservative_lut), blue.point(conservative_lut), alpha),
        )
        candidate = io.BytesIO()
        optimized.save(candidate, format="PNG", optimize=True, compress_level=9)
        return candidate.getvalue()


def _replace_with_validated_bytes(source: Path, candidate_data: bytes) -> None:
    temporary = tempfile.NamedTemporaryFile(
        mode="wb",
        prefix=f".{source.name}.",
        suffix=".tmp",
        dir=source.parent,
        delete=False,
    )
    candidate = Path(temporary.name)

    try:
        temporary.write(candidate_data)
        temporary.flush()
        os.fsync(temporary.fileno())
        temporary.close()
        candidate.replace(source)
    finally:
        if not temporary.closed:
            temporary.close()
        candidate.unlink(missing_ok=True)


def optimize_png(source: Path, *, apply: bool, min_psnr: float = 42.0) -> dict[str, object]:
    source = Path(source)
    original_bytes = source.stat().st_size
    candidate_data = _encode_candidate(source)
    validation = _validate_candidate_bytes(source, candidate_data, min_psnr=min_psnr)
    result: dict[str, object] = {
        "path": source.as_posix(),
        "originalBytes": original_bytes,
        **validation,
    }
    if result["accepted"] and apply:
        _replace_with_validated_bytes(source, candidate_data)
    return result


def _json_safe(value: object) -> object:
    if isinstance(value, float) and math.isinf(value):
        return "infinite"
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    return value


def _print_json(value: object) -> None:
    print(json.dumps(_json_safe(value), allow_nan=False, separators=(",", ":"), sort_keys=True))


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Safely optimize runtime PNG assets.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="Evaluate candidates without modifying sources.")
    mode.add_argument("--apply", action="store_true", help="Replace sources with accepted candidates.")
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).absolute().parent.parent,
        help="Cocos client root (defaults to the script's parent project).",
    )
    parser.add_argument("--min-psnr", type=float, default=42.0)
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    project_root = args.project_root.absolute()
    results: list[dict[str, object]] = []

    for path in discover_runtime_pngs(project_root):
        relative_path = path.relative_to(project_root).as_posix()
        try:
            result = optimize_png(path, apply=args.apply, min_psnr=args.min_psnr)
        except Exception as error:
            raise RuntimeError(f"Failed to optimize {relative_path}: {error}") from error
        result["path"] = relative_path
        results.append(result)
        _print_json(result)

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
    _print_json(totals)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
