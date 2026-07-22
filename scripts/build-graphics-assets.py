#!/usr/bin/env python3
"""Build the generated pitch and ball game assets."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


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
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)

    build_pitch(args.pitch).save(args.out_dir / "pitch-v2.png", optimize=True)
    build_ball_sheet().save(args.out_dir / "ball-v2.png", optimize=True)


if __name__ == "__main__":
    main()
