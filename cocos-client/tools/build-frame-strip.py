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


def center_on_canvas(
    image: Image.Image,
    size: tuple[int, int],
    padding: int = 28,
    vertical_align: str = "center",
) -> Image.Image:
    inner_size = (size[0] - 2 * padding, size[1] - 2 * padding)
    if padding < 0 or inner_size[0] <= 0 or inner_size[1] <= 0:
        raise ValueError(f"Padding {padding} leaves no drawable area in frame {size[0]}x{size[1]}")
    if vertical_align not in ("center", "bottom"):
        raise ValueError(f"Unsupported vertical alignment: {vertical_align}")

    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    subject = image.copy()
    subject.thumbnail(inner_size, Image.Resampling.LANCZOS)
    x = (size[0] - subject.width) // 2
    y = (size[1] - subject.height) // 2 if vertical_align == "center" else size[1] - padding - subject.height
    canvas.alpha_composite(subject, (x, y))
    return canvas


def pack_horizontal_strip(frames: list[Image.Image], frame_size: tuple[int, int]) -> Image.Image:
    strip = Image.new("RGBA", (frame_size[0] * len(frames), frame_size[1]), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * frame_size[0], 0))
    return strip


def slice_sheet_columns(sheet: Image.Image, columns: int) -> list[Image.Image]:
    if columns <= 0 or sheet.width % columns != 0:
        raise ValueError(f"Sheet width {sheet.width} is not evenly divisible by {columns} columns")
    cell_width = sheet.width // columns
    return [sheet.crop((index * cell_width, 0, (index + 1) * cell_width, sheet.height)) for index in range(columns)]


def build_frame_strip(
    input_dir: Path | None,
    input_sheet: Path | None,
    sheet_columns: int,
    output: Path,
    frame_size: tuple[int, int],
    limit: int | None,
    padding: int = 28,
    vertical_align: str = "center",
) -> None:
    if padding < 0 or frame_size[0] - 2 * padding <= 0 or frame_size[1] - 2 * padding <= 0:
        raise SystemExit(
            f"Padding {padding} leaves no drawable area in frame {frame_size[0]}x{frame_size[1]}"
        )

    if input_sheet:
        with Image.open(input_sheet) as sheet:
            source_frames = slice_sheet_columns(sheet.convert("RGBA"), sheet_columns)
    else:
        sources = sorted(input_dir.glob("*.png")) if input_dir else []
        if limit:
            sources = sources[:limit]
        if not sources:
            raise SystemExit(f"No PNG frames found in {input_dir}")
        source_frames = []
        for source in sources:
            with Image.open(source) as image:
                source_frames.append(image.convert("RGBA"))

    frames = [
        center_on_canvas(trim_alpha_bounds(image), frame_size, padding, vertical_align)
        for image in source_frames
    ]

    output.parent.mkdir(parents=True, exist_ok=True)
    pack_horizontal_strip(frames, frame_size).save(output, "PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Trim, center, and pack AI-generated PNG frames into a Cocos strip.")
    inputs = parser.add_mutually_exclusive_group(required=True)
    inputs.add_argument("--input-dir", type=Path, help="Directory containing source PNG sequence frames.")
    inputs.add_argument("--input-sheet", type=Path, help="One evenly divided horizontal source sheet.")
    parser.add_argument("--sheet-columns", type=int, default=1, help="Number of equal columns in --input-sheet.")
    parser.add_argument("--output", required=True, type=Path, help="Output horizontal strip PNG path.")
    parser.add_argument("--frame-width", type=int, default=256)
    parser.add_argument("--frame-height", type=int, default=256)
    parser.add_argument("--padding", type=int, default=28, help="Transparent padding inside each output frame.")
    parser.add_argument("--vertical-align", choices=("center", "bottom"), default="center")
    parser.add_argument("--limit", type=int, default=None, help="Optional maximum number of frames to pack.")
    args = parser.parse_args()

    build_frame_strip(
        args.input_dir,
        args.input_sheet,
        args.sheet_columns,
        args.output,
        (args.frame_width, args.frame_height),
        args.limit,
        args.padding,
        args.vertical_align,
    )


if __name__ == "__main__":
    main()
