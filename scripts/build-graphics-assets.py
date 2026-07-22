#!/usr/bin/env python3
"""Build the generated pitch and ball game assets."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


def build_pitch(source: Path) -> Image.Image:
    return Image.open(source).convert("RGB").resize(
        (2688, 3392), Image.Resampling.LANCZOS
    )


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
