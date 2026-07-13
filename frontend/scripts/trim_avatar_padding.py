"""Trim transparent padding from avatar PNGs after background removal."""

from __future__ import annotations

from pathlib import Path

from PIL import Image


def trim_transparency(image: Image.Image, padding: int = 8) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.split()[-1]
    bbox = alpha.getbbox()
    if not bbox:
        return rgba

    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(rgba.width, right + padding)
    bottom = min(rgba.height, bottom + padding)
    return rgba.crop((left, top, right, bottom))


def main() -> None:
    avatars_dir = Path(__file__).resolve().parents[1] / "src" / "assets" / "avatars"

    for path in sorted(avatars_dir.glob("avatar-*.png")):
        image = Image.open(path)
        trimmed = trim_transparency(image)
        trimmed.save(path, format="PNG", optimize=True)
        print(f"{path.name}: {image.size} -> {trimmed.size}")


if __name__ == "__main__":
    main()
