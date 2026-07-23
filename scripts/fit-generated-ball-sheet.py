#!/usr/bin/env python3
"""Fit a generated nine-item ball strip to the game's 16 px sprite grid."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


FRAME_SIZE = 16
BALL_SIZE = 14
FRAME_COUNT = 9


def occupied_column_runs(alpha: Image.Image) -> list[tuple[int, int]]:
    occupied = [alpha.crop((x, 0, x + 1, alpha.height)).getbbox() is not None
                for x in range(alpha.width)]
    runs: list[tuple[int, int]] = []
    start: int | None = None
    for x, has_content in enumerate((*occupied, False)):
        if has_content and start is None:
            start = x
        elif not has_content and start is not None:
            runs.append((start, x))
            start = None
    return runs


def content_crop(image: Image.Image, left: int, right: int) -> Image.Image:
    strip = image.crop((left, 0, right, image.height))
    bounds = strip.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("sprite contains no visible pixels")
    return strip.crop(bounds)


def build_sheet(source: Path) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    runs = occupied_column_runs(image.getchannel("A"))
    if len(runs) != FRAME_COUNT:
        raise ValueError(f"expected {FRAME_COUNT} sprites, found {len(runs)}")

    sheet = Image.new("RGBA", (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE))
    for phase, (left, right) in enumerate(runs[:8]):
        ball = content_crop(image, left, right)
        ball.thumbnail((BALL_SIZE, BALL_SIZE), Image.Resampling.LANCZOS)
        x = phase * FRAME_SIZE + (FRAME_SIZE - ball.width) // 2
        y = (FRAME_SIZE - ball.height) // 2
        sheet.alpha_composite(ball, (x, y))

    shadow = content_crop(image, *runs[8])
    shadow = shadow.resize((14, 5), Image.Resampling.LANCZOS)
    sheet.alpha_composite(shadow, (8 * FRAME_SIZE + 1, 6))
    return sheet


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    build_sheet(args.source).save(args.out, optimize=True)


if __name__ == "__main__":
    main()
