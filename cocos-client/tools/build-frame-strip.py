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


def content_touches_equal_boundaries(sheet: Image.Image, columns: int, band: int = 2) -> bool:
    alpha = sheet.convert("RGBA").getchannel("A")
    cell_width = sheet.width // columns
    for index in range(1, columns):
        boundary = index * cell_width
        if alpha.crop((max(0, boundary - band), 0, min(sheet.width, boundary + band), sheet.height)).getbbox():
            return True
    return False


def extract_sheet_components(sheet: Image.Image, columns: int) -> tuple[list[Image.Image], bool]:
    try:
        import cv2
        import numpy as np
    except ImportError as error:
        raise RuntimeError("--extract-components requires OpenCV and NumPy") from error

    rgba = np.asarray(sheet.convert("RGBA"))
    mask = (rgba[:, :, 3] > 8).astype("uint8")
    count, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, 8)
    components = sorted(range(1, count), key=lambda label: int(stats[label, cv2.CC_STAT_AREA]), reverse=True)
    if len(components) < columns:
        raise ValueError(f"Sheet contains only {len(components)} visible components for {columns} columns")

    seeds = sorted(components[:columns], key=lambda label: float(centroids[label][0]))
    cell_width = sheet.width / columns
    crosses_boundaries = any(
        int(stats[label, cv2.CC_STAT_LEFT]) < index * cell_width
        or int(stats[label, cv2.CC_STAT_LEFT] + stats[label, cv2.CC_STAT_WIDTH]) > (index + 1) * cell_width
        for index, label in enumerate(seeds)
    )

    seed_boxes = []
    for label in seeds:
        x, y, width, height = (int(value) for value in stats[label, :4])
        seed_boxes.append((x, y, x + width - 1, y + height - 1))

    def distance_to_box(cx: float, cy: float, box: tuple[int, int, int, int]) -> float:
        dx = max(box[0] - cx, 0, cx - box[2])
        dy = max(box[1] - cy, 0, cy - box[3])
        return dx * dx + dy * dy

    groups = [[] for _ in range(columns)]
    for label in components:
        if int(stats[label, cv2.CC_STAT_AREA]) < 4:
            continue
        cx, cy = (float(value) for value in centroids[label])
        owner = min(range(columns), key=lambda index: distance_to_box(cx, cy, seed_boxes[index]))
        groups[owner].append(label)

    frames = []
    for group in groups:
        group_mask = np.isin(labels, group)
        pixels = np.zeros_like(rgba)
        pixels[group_mask] = rgba[group_mask]
        frames.append(Image.fromarray(pixels, "RGBA"))
    return frames, crosses_boundaries


def build_frame_strip(
    input_dir: Path | None,
    input_sheet: Path | None,
    sheet_columns: int,
    extract_components: bool,
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
            rgba_sheet = sheet.convert("RGBA")
            if rgba_sheet.width % sheet_columns != 0:
                raise ValueError(
                    f"Sheet width {rgba_sheet.width} is not evenly divisible by {sheet_columns} columns"
                )
            if extract_components:
                source_frames, crossed = extract_sheet_components(rgba_sheet, sheet_columns)
                if crossed:
                    print("Detected subject content that crosses equal column boundaries; reconstructed frames by component ownership.")
            else:
                if content_touches_equal_boundaries(rgba_sheet, sheet_columns):
                    raise ValueError(
                        "Subject content crosses equal column boundaries; rerun with --extract-components"
                    )
                source_frames = slice_sheet_columns(rgba_sheet, sheet_columns)
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
    parser.add_argument("--sheet-columns", type=int, default=None, help="Number of action columns in --input-sheet.")
    parser.add_argument("--extract-components", action="store_true", help="Reconstruct crossing subjects before packing a sheet.")
    parser.add_argument("--output", required=True, type=Path, help="Output horizontal strip PNG path.")
    parser.add_argument("--frame-width", type=int, default=256)
    parser.add_argument("--frame-height", type=int, default=256)
    parser.add_argument("--padding", type=int, default=28, help="Transparent padding inside each output frame.")
    parser.add_argument("--vertical-align", choices=("center", "bottom"), default="center")
    parser.add_argument("--limit", type=int, default=None, help="Optional maximum number of frames to pack.")
    args = parser.parse_args()

    if args.input_sheet and args.sheet_columns is None:
        parser.error("--sheet-columns is required with --input-sheet")
    if args.input_dir and args.sheet_columns is not None:
        parser.error("--sheet-columns is only valid with --input-sheet")
    if args.input_dir and args.extract_components:
        parser.error("--extract-components is only valid with --input-sheet")
    if args.input_sheet and args.limit is not None:
        parser.error("--limit cannot be used with --input-sheet")
    if args.sheet_columns is not None and args.sheet_columns <= 0:
        parser.error("--sheet-columns must be greater than zero")

    build_frame_strip(
        args.input_dir,
        args.input_sheet,
        args.sheet_columns,
        args.extract_components,
        args.output,
        (args.frame_width, args.frame_height),
        args.limit,
        args.padding,
        args.vertical_align,
    )


if __name__ == "__main__":
    main()
