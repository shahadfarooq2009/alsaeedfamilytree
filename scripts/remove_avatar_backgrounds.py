"""Remove baked-in checkerboard backgrounds from avatar PNGs."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image
from rembg import remove


def main() -> int:
    avatars_dir = Path(__file__).resolve().parents[1] / "src" / "assets" / "avatars"
    files = sorted(avatars_dir.glob("avatar-*.png"))

    if not files:
        print("No avatar PNG files found.", file=sys.stderr)
        return 1

    for path in files:
        print(f"Processing {path.name}...")
        with path.open("rb") as handle:
            raw = handle.read()

        output = remove(raw)

        image = Image.open(__import__("io").BytesIO(output)).convert("RGBA")
        image.save(path, format="PNG", optimize=True)
        print(f"  Saved transparent PNG ({path.stat().st_size // 1024} KB)")

    print(f"Done — processed {len(files)} avatars.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
