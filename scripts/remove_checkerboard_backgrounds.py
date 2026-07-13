#!/usr/bin/env python3
"""
Fast first-pass checkerboard background removal for family-tree PNG assets.

Input:  frontend/src/assets/family-tree/raw/
Output: frontend/src/assets/family-tree/processed/

Originals are never modified.
"""

from __future__ import annotations

import sys
from collections import Counter, deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "frontend" / "src" / "assets" / "family-tree" / "raw"
OUT_DIR = ROOT / "frontend" / "src" / "assets" / "family-tree" / "processed"

HARD_TOL = 24.0
SOFT_TOL = 40.0


def detect_checker_colors(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    h, w, _ = rgb.shape
    corners = np.array(
        [rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]],
        dtype=np.uint8,
    )
    quant = [tuple((px // 8) * 8) for px in corners]
    top = [np.array(c, dtype=np.uint8) for c, _ in Counter(quant).most_common(2)]
    if len(top) == 1:
        return top[0], np.array([192, 192, 192], dtype=np.uint8)
    if float(np.mean(top[0])) < float(np.mean(top[1])):
        top[0], top[1] = top[1], top[0]
    return top[0], top[1]


def checker_distance(rgb: np.ndarray, c1: np.ndarray, c2: np.ndarray) -> np.ndarray:
    rgbf = rgb.astype(np.float32)
    d1 = np.linalg.norm(rgbf - c1.astype(np.float32), axis=2)
    d2 = np.linalg.norm(rgbf - c2.astype(np.float32), axis=2)
    return np.minimum(d1, d2)


def border_flood(checker_like: np.ndarray) -> np.ndarray:
    h, w = checker_like.shape
    bg = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    def seed(y: int, x: int) -> None:
        if checker_like[y, x]:
            q.append((y, x))

    for x in range(w):
        seed(0, x)
        seed(h - 1, x)
    for y in range(h):
        seed(y, 0)
        seed(y, w - 1)

    while q:
        y, x = q.popleft()
        if bg[y, x]:
            continue
        if not checker_like[y, x]:
            continue
        bg[y, x] = True
        if y > 0:
            q.append((y - 1, x))
        if y < h - 1:
            q.append((y + 1, x))
        if x > 0:
            q.append((y, x - 1))
        if x < w - 1:
            q.append((y, x + 1))

    return bg


def remove_checkerboard(rgb: np.ndarray) -> np.ndarray:
    c1, c2 = detect_checker_colors(rgb)
    dist = checker_distance(rgb, c1, c2)
    checker_like = dist <= SOFT_TOL
    bg = border_flood(checker_like)

    alpha = np.full(dist.shape, 255, dtype=np.uint8)
    alpha[bg & (dist <= HARD_TOL)] = 0
    feather = bg & (dist > HARD_TOL)
    if np.any(feather):
        alpha[feather] = np.clip(
            ((dist[feather] - HARD_TOL) / max(SOFT_TOL - HARD_TOL, 1e-6)) * 255.0,
            0,
            255,
        ).astype(np.uint8)

    return np.dstack([rgb, alpha])


def process_file(src: Path) -> None:
    rel = src.relative_to(RAW_DIR)
    dst = OUT_DIR / rel
    dst.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(src) as img:
        rgba = np.array(img.convert("RGBA"))
    rgb = rgba[:, :, :3]
    out = remove_checkerboard(rgb)

    Image.fromarray(out.astype(np.uint8), mode="RGBA").save(dst, format="PNG")

    if not np.any(out[:, :, 3] < 250):
        raise ValueError("no transparent pixels produced")


def main() -> int:
    if not RAW_DIR.is_dir():
        print(f"ERROR: raw directory not found: {RAW_DIR}")
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(RAW_DIR.rglob("*.png")) + sorted(RAW_DIR.rglob("*.PNG"))
    files = sorted({f.resolve() for f in files})

    if not files:
        print(f"No PNG files in {RAW_DIR}")
        return 1

    completed: list[str] = []
    failed: list[str] = []

    print(f"Processing {len(files)} file(s) from {RAW_DIR}")
    print(f"Output -> {OUT_DIR}\n")

    for index, src in enumerate(files, start=1):
        rel = src.relative_to(RAW_DIR).as_posix()
        print(f"[{index}/{len(files)}] {rel} ... ", end="", flush=True)
        try:
            process_file(src)
            completed.append(rel)
            print("OK")
        except Exception as exc:  # noqa: BLE001
            failed.append(f"{rel}: {exc}")
            print(f"FAILED ({exc})")

    print("\n=== Summary ===")
    print(f"Completed ({len(completed)}):")
    for name in completed:
        print(f"  + {name}")
    print(f"Failed ({len(failed)}):")
    for name in failed:
        print(f"  ! {name}")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
