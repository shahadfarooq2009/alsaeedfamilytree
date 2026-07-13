#!/usr/bin/env python3
"""Progressive 4× upscale for tree background — preserves aspect ratio, no crop."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = (
    ROOT
    / "frontend"
    / "src"
    / "assets"
    / "family-tree"
    / "reference"
    / "tree-background.png"
)
DEFAULT_OUT = DEFAULT_SRC
SCALE = 4


def progressive_lanczos(img: Image.Image, target_scale: int) -> Image.Image:
    """Upscale in 2× steps — cleaner than a single large jump."""
    current = img.convert("RGBA") if img.mode != "RGBA" else img.copy()
    remaining = target_scale
    while remaining > 1:
        step = 2 if remaining >= 2 else remaining
        new_size = (current.width * step, current.height * step)
        current = current.resize(new_size, Image.Resampling.LANCZOS)
        remaining //= step
    return current


def edge_aware_refine(img: Image.Image) -> Image.Image:
    """
    Gentle detail recovery after upscale:
    - very light unsharp mask (no harsh halos)
    - micro-contrast on luminance only
    """
    rgb = img.convert("RGB")
    sharpened = rgb.filter(ImageFilter.UnsharpMask(radius=1.15, percent=85, threshold=4))

    # Blend 72% sharpened / 28% original to avoid plastic look
    base = np.asarray(rgb, dtype=np.float32)
    sharp = np.asarray(sharpened, dtype=np.float32)
    blended = (sharp * 0.72 + base * 0.28).clip(0, 255).astype(np.uint8)
    return Image.fromarray(blended, mode="RGB")


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT
    scale = int(sys.argv[3]) if len(sys.argv) > 3 else SCALE

    if not src.is_file():
        print(f"Source not found: {src}")
        return 1

    with Image.open(src) as img:
        orig_size = img.size
        print(f"Source: {orig_size[0]}x{orig_size[1]} ({src.name})")

        upscaled = progressive_lanczos(img, scale)
        refined = edge_aware_refine(upscaled)

        out.parent.mkdir(parents=True, exist_ok=True)
        refined.save(out, format="PNG", compress_level=3)
        print(f"Saved: {out}")
        print(f"Output: {refined.size[0]}x{refined.size[1]} ({scale}×)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
