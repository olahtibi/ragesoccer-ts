#!/usr/bin/env python3
"""Assemble the generated graphics sources into deterministic game assets."""

from __future__ import annotations

import argparse
import colorsys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


FRAME_WIDTH = 40
FRAME_HEIGHT = 64
DIRECTIONS = 8
RUN_FRAMES = 8
KICK_FRAMES = 4


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 24 else 0)
    return alpha.getbbox()


def fit_frame(cell: Image.Image, mirror: bool = False) -> Image.Image:
    bbox = alpha_bbox(cell)
    frame = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT))
    if bbox is None:
        return frame
    sprite = cell.crop(bbox)
    if mirror:
        sprite = sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    scale = min(38 / sprite.width, 61 / sprite.height)
    size = (
        max(1, round(sprite.width * scale)),
        max(1, round(sprite.height * scale)),
    )
    sprite = sprite.resize(size, Image.Resampling.LANCZOS)
    x = (FRAME_WIDTH - sprite.width) // 2
    y = 62 - sprite.height
    frame.alpha_composite(sprite, (x, y))
    return frame


def grid_cell(
    image: Image.Image, columns: int, rows: int, column: int, row: int
) -> Image.Image:
    left = round(column * image.width / columns)
    right = round((column + 1) * image.width / columns)
    top = round(row * image.height / rows)
    bottom = round((row + 1) * image.height / rows)
    return image.crop((left, top, right, bottom))


def build_player_sheet(
    idle_source: Path, run_source: Path, kick_source: Path
) -> Image.Image:
    idle = Image.open(idle_source).convert("RGBA")
    run = Image.open(run_source).convert("RGBA")
    kick = Image.open(kick_source).convert("RGBA")
    sheet = Image.new("RGBA", (FRAME_WIDTH * 8, FRAME_HEIGHT * 24))

    for direction in range(DIRECTIONS):
        frame = fit_frame(grid_cell(idle, 8, 1, direction, 0))
        sheet.alpha_composite(frame, (0, direction * FRAME_HEIGHT))

        for phase in range(RUN_FRAMES):
            frame = fit_frame(grid_cell(run, 8, 8, phase, direction))
            sheet.alpha_composite(
                frame,
                (phase * FRAME_WIDTH, (8 + direction) * FRAME_HEIGHT),
            )

    # The kick source supplied six useful directional rows. West and northwest
    # are exact mirrors of east and northeast so timing and anchors stay equal.
    kick_rows = ((0, False), (1, False), (2, False), (3, False),
                 (4, False), (5, False), (2, True), (1, True))
    for direction, (source_row, mirror) in enumerate(kick_rows):
        for phase in range(KICK_FRAMES):
            frame = fit_frame(
                grid_cell(kick, 4, 8, phase, source_row), mirror=mirror
            )
            sheet.alpha_composite(
                frame,
                (phase * FRAME_WIDTH, (16 + direction) * FRAME_HEIGHT),
            )
    return sheet


def recolor_away(sheet: Image.Image) -> Image.Image:
    pixels = []
    for red, green, blue, alpha in sheet.getdata():
        hue, saturation, lightness = colorsys.rgb_to_hls(
            red / 255, green / 255, blue / 255
        )
        if alpha and saturation > 0.45 and (hue < 0.045 or hue > 0.96):
            red_f, green_f, blue_f = colorsys.hls_to_rgb(0.62, lightness, saturation)
            red, green, blue = (
                round(red_f * 255),
                round(green_f * 255),
                round(blue_f * 255),
            )
        pixels.append((red, green, blue, alpha))
    result = Image.new("RGBA", sheet.size)
    result.putdata(pixels)
    return result


def load_font(size: int) -> ImageFont.ImageFont:
    candidates = (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    )
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()


def build_pitch(source: Path) -> Image.Image:
    pitch = Image.open(source).convert("RGB").resize(
        (2688, 3392), Image.Resampling.LANCZOS
    )
    draw = ImageDraw.Draw(pitch)
    font = load_font(27)
    sponsors = (
        ("RAGE COLA", "#c83b32"),
        ("TURBO BOOT", "#234e91"),
        ("MEGA BYTE", "#6f348a"),
        ("GOAL OIL", "#c87a18"),
        ("KICKR", "#19776c"),
    )
    board_left = 344
    board_right = 2344
    board_width = (board_right - board_left) // len(sponsors)
    for y in (278, 3092):
        for index, (label, color) in enumerate(sponsors):
            left = board_left + index * board_width
            right = board_left + (index + 1) * board_width - 6
            draw.rounded_rectangle(
                (left, y, right, y + 58), radius=5, fill=color,
                outline="#e6dfc8", width=3
            )
            box = draw.textbbox((0, 0), label, font=font)
            text_width = box[2] - box[0]
            draw.text(
                ((left + right - text_width) / 2, y + 12),
                label,
                font=font,
                fill="#fffbe8",
                stroke_width=1,
                stroke_fill="#1b1b1b",
            )
    return pitch


def build_ball_sheet() -> Image.Image:
    sheet = Image.new("RGBA", (16 * 9, 16))
    panel_offsets = ((0, 0), (1, 0), (1, 1), (0, 1),
                     (-1, 1), (-1, 0), (-1, -1), (0, -1))
    for phase, (dx, dy) in enumerate(panel_offsets):
        frame = Image.new("RGBA", (16, 16))
        draw = ImageDraw.Draw(frame)
        draw.ellipse((1, 1, 14, 14), fill="#f2f0e7", outline="#34383c", width=1)
        draw.polygon(
            ((7 + dx, 5 + dy), (10 + dx, 6 + dy), (10 + dx, 9 + dy),
             (7 + dx, 11 + dy), (5 + dx, 8 + dy)),
            fill="#252a2e",
        )
        draw.line((5 + dx, 8 + dy, 2, 6), fill="#666967")
        draw.line((10 + dx, 6 + dy, 13, 4), fill="#666967")
        draw.line((10 + dx, 9 + dy, 13, 11), fill="#666967")
        draw.point((4, 3), fill="#ffffff")
        sheet.alpha_composite(frame, (phase * 16, 0))
    shadow = Image.new("RGBA", (16, 16))
    ImageDraw.Draw(shadow).ellipse((1, 5, 14, 11), fill=(15, 20, 22, 92))
    sheet.alpha_composite(shadow, (16 * 8, 0))
    return sheet


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pitch", type=Path, required=True)
    parser.add_argument("--idle", type=Path, required=True)
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--kick", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)

    home = build_player_sheet(args.idle, args.run, args.kick)
    away = recolor_away(home)
    build_pitch(args.pitch).save(args.out_dir / "pitch-v2.png", optimize=True)
    home.save(args.out_dir / "player-sprite-home-v2.png", optimize=True)
    away.save(args.out_dir / "player-sprite-away-v2.png", optimize=True)
    build_ball_sheet().save(args.out_dir / "ball-v2.png", optimize=True)


if __name__ == "__main__":
    main()
