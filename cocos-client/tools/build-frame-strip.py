import argparse
from pathlib import Path

from PIL import Image


def trim_alpha_bounds(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        return rgba
    return rgba.crop(bounds)


def center_on_canvas(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    subject = image.copy()
    subject.thumbnail((size[0], size[1]), Image.Resampling.LANCZOS)
    x = (size[0] - subject.width) // 2
    y = (size[1] - subject.height) // 2
    canvas.alpha_composite(subject, (x, y))
    return canvas


def pack_horizontal_strip(frames: list[Image.Image], frame_size: tuple[int, int]) -> Image.Image:
    strip = Image.new("RGBA", (frame_size[0] * len(frames), frame_size[1]), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * frame_size[0], 0))
    return strip


def build_frame_strip(input_dir: Path, output: Path, frame_size: tuple[int, int], limit: int | None) -> None:
    sources = sorted(input_dir.glob("*.png"))
    if limit:
        sources = sources[:limit]
    if not sources:
        raise SystemExit(f"No PNG frames found in {input_dir}")

    frames = []
    for source in sources:
        image = Image.open(source)
        frames.append(center_on_canvas(trim_alpha_bounds(image), frame_size))

    output.parent.mkdir(parents=True, exist_ok=True)
    pack_horizontal_strip(frames, frame_size).save(output, "PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Trim, center, and pack AI-generated PNG frames into a Cocos strip.")
    parser.add_argument("--input-dir", required=True, type=Path, help="Directory containing source PNG sequence frames.")
    parser.add_argument("--output", required=True, type=Path, help="Output horizontal strip PNG path.")
    parser.add_argument("--frame-width", type=int, default=256)
    parser.add_argument("--frame-height", type=int, default=256)
    parser.add_argument("--limit", type=int, default=None, help="Optional maximum number of frames to pack.")
    args = parser.parse_args()

    build_frame_strip(args.input_dir, args.output, (args.frame_width, args.frame_height), args.limit)


if __name__ == "__main__":
    main()
