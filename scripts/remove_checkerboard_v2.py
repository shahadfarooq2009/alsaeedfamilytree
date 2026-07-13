#!/usr/bin/env python3
"""
Second-pass checkerboard cleanup for selected family-tree assets.

Reads:   frontend/src/assets/family-tree/raw/
Writes:  frontend/src/assets/family-tree/processed-v2/

Does not modify raw/ or processed/ (v1).
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter, deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "frontend" / "src" / "assets" / "family-tree" / "raw"
V1_DIR = ROOT / "frontend" / "src" / "assets" / "family-tree" / "processed"
OUT_DIR = ROOT / "frontend" / "src" / "assets" / "family-tree" / "processed-v2"

# Slightly tighter hard cut; soft feather only on flooded background.
HARD_TOL = 20.0
SOFT_TOL = 36.0
FLOOD_TOL = 34.0

# Defringe neutral gray halos at semi-transparent edge pixels.
DEFRINGE_TOL = 18.0
DEFRINGE_MAX_ALPHA = 210


def resolve_raw_path(name: str) -> Path | None:
    """Match user filename to on-disk raw asset (handles .png.png suffix)."""
    candidates = [
        RAW_DIR / name,
        RAW_DIR / f"{name}.png",
        RAW_DIR / f"{name}.png.png",
    ]
    if not name.lower().endswith(".png"):
        candidates.insert(0, RAW_DIR / f"{name}.png")

    for path in candidates:
        if path.is_file():
            return path

    # Fuzzy: stem match
    stem = Path(name).stem.replace(".png", "")
    for path in sorted(RAW_DIR.glob("*.png")):
        if path.stem.replace(".png", "") == stem or path.name.startswith(stem):
            return path
    return None


def detect_checker_colors(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    h, w, _ = rgb.shape
    border = max(3, min(h, w) // 24)
    samples: list[np.ndarray] = []

    for y in range(border):
        for x in range(w):
            samples.append(rgb[y, x])
    for y in range(h - border, h):
        for x in range(w):
            samples.append(rgb[y, x])
    for y in range(h):
        for x in range(border):
            samples.append(rgb[y, x])
        for x in range(w - border, w):
            samples.append(rgb[y, x])

    corners = [rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]]
    samples.extend(corners)

    quant = [tuple((px // 8) * 8) for px in samples]
    top = [np.array(c, dtype=np.uint8) for c, _ in Counter(quant).most_common(6)]

    best = (top[0], top[1] if len(top) > 1 else np.array([192, 192, 192], dtype=np.uint8))
    best_dist = -1.0
    for i in range(len(top)):
        for j in range(i + 1, len(top)):
            d = float(np.linalg.norm(top[i].astype(float) - top[j].astype(float)))
            if d > best_dist:
                best_dist = d
                best = (top[i], top[j])

    c1, c2 = best
    if float(np.mean(c1)) < float(np.mean(c2)):
        c1, c2 = c2, c1
    return c1, c2


def checker_distance(rgb: np.ndarray, c1: np.ndarray, c2: np.ndarray) -> np.ndarray:
    rgbf = rgb.astype(np.float32)
    d1 = np.linalg.norm(rgbf - c1.astype(np.float32), axis=2)
    d2 = np.linalg.norm(rgbf - c2.astype(np.float32), axis=2)
    return np.minimum(d1, d2)


def border_flood(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    bg = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    def seed(y: int, x: int) -> None:
        if mask[y, x]:
            q.append((y, x))

    for x in range(w):
        seed(0, x)
        seed(h - 1, x)
    for y in range(h):
        seed(y, 0)
        seed(y, w - 1)

    while q:
        y, x = q.popleft()
        if bg[y, x] or not mask[y, x]:
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


def is_protected_foreground(rgb: np.ndarray) -> np.ndarray:
    """Keep ivory, gold, olive, and warm botanical tones."""
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)

    warm = (r >= g - 6) & (g >= b - 10)
    gold = (r > 150) & (g > 120) & (b < 170) & warm
    ivory = (r > 210) & (g > 200) & (b > 170) & (r - b > 18)
    olive = (g > r - 8) & (g > 80) & (b < g) & (r < 190)
    dark_branch = (r < 120) & (g < 110) & (b < 100)

    return gold | ivory | olive | dark_branch


def build_alpha(rgb: np.ndarray, c1: np.ndarray, c2: np.ndarray) -> np.ndarray:
    dist = checker_distance(rgb, c1, c2)
    protected = is_protected_foreground(rgb)

    checker_like = dist <= FLOOD_TOL
    bg = border_flood(checker_like)

    alpha = np.full(dist.shape, 255, dtype=np.uint8)
    alpha[bg & (dist <= HARD_TOL)] = 0

    feather = bg & (dist > HARD_TOL) & (dist < SOFT_TOL)
    if np.any(feather):
        alpha[feather] = np.clip(
            ((dist[feather] - HARD_TOL) / max(SOFT_TOL - HARD_TOL, 1e-6)) * 255.0,
            0,
            255,
        ).astype(np.uint8)

    # Never punch holes in protected botanical pixels unless clearly on flooded bg.
    interior_protected = protected & ~bg
    alpha[interior_protected] = 255

    return alpha, dist, bg


def defringe_halos(rgb: np.ndarray, alpha: np.ndarray, dist: np.ndarray, bg: np.ndarray) -> np.ndarray:
    """Remove gray checker halos on semi-transparent edge pixels."""
    out = alpha.copy()
    semi = (out > 0) & (out < DEFRINGE_MAX_ALPHA)
    neutral_gray = (
        (np.abs(rgb[:, :, 0].astype(int) - rgb[:, :, 1].astype(int)) < 10)
        & (np.abs(rgb[:, :, 1].astype(int) - rgb[:, :, 2].astype(int)) < 10)
    )
    halo = semi & neutral_gray & (dist <= DEFRINGE_TOL) & ~is_protected_foreground(rgb)

    # Only defringe near known background or image border.
    h, w = out.shape
    border = max(3, min(h, w) // 24)
    near_edge = np.zeros_like(out, dtype=bool)
    near_edge[:border, :] = True
    near_edge[-border:, :] = True
    near_edge[:, :border] = True
    near_edge[:, -border:] = True

    dilated_bg = bg.copy()
    for _ in range(3):
        dilated_bg[1:, :] |= dilated_bg[:-1, :]
        dilated_bg[:-1, :] |= dilated_bg[1:, :]
        dilated_bg[:, 1:] |= dilated_bg[:, :-1]
        dilated_bg[:, :-1] |= dilated_bg[:, 1:]

    halo &= dilated_bg | near_edge
    out[halo] = 0

    # Restore protected pixels accidentally caught.
    out[is_protected_foreground(rgb) & ~bg] = np.maximum(
        out[is_protected_foreground(rgb) & ~bg], 200
    )
    return out


def restore_edge_antialias(alpha: np.ndarray, bg: np.ndarray) -> np.ndarray:
    """Strengthen thin anti-aliased foreground edges adjacent to background."""
    out = alpha.copy()
    fg = out > 220
    edge = fg.copy()
    edge[1:, :] &= ~fg[:-1, :]
    edge[:-1, :] &= ~fg[1:, :]
    edge[:, 1:] &= ~fg[:, :-1]
    edge[:, :-1] &= ~fg[:, 1:]

    dilated_bg = bg.copy()
    for _ in range(2):
        dilated_bg[1:, :] |= dilated_bg[:-1, :]
        dilated_bg[:-1, :] |= dilated_bg[1:, :]
        dilated_bg[:, 1:] |= dilated_bg[:, :-1]
        dilated_bg[:, :-1] |= dilated_bg[:, 1:]

    reinforce = edge & dilated_bg
    out[reinforce] = np.maximum(out[reinforce], 235)
    return out


def remove_checkerboard_v2(rgb: np.ndarray) -> np.ndarray:
    c1, c2 = detect_checker_colors(rgb)
    alpha, dist, bg = build_alpha(rgb, c1, c2)
    alpha = defringe_halos(rgb, alpha, dist, bg)
    alpha = restore_edge_antialias(alpha, bg)
    return np.dstack([rgb, alpha])


def process_file(src: Path) -> str:
    rel = src.name
    dst = OUT_DIR / rel
    dst.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(src) as img:
        rgba = np.array(img.convert("RGBA"))
    rgb = rgba[:, :, :3]
    out = remove_checkerboard_v2(rgb)

    Image.fromarray(out.astype(np.uint8), mode="RGBA").save(dst, format="PNG")

    if not np.any(out[:, :, 3] < 250):
        raise ValueError("no transparent pixels produced")

    return rel


def main() -> int:
    parser = argparse.ArgumentParser(description="Second-pass checkerboard cleanup")
    parser.add_argument("files", nargs="+", help="Filenames to reprocess")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    completed: list[str] = []
    failed: list[str] = []

    print(f"Second-pass output -> {OUT_DIR}\n")

    for index, name in enumerate(args.files, start=1):
        print(f"[{index}/{len(args.files)}] {name} ... ", end="", flush=True)
        src = resolve_raw_path(name)
        if src is None:
            failed.append(f"{name}: not found in {RAW_DIR}")
            print("FAILED (not found)")
            continue
        try:
            rel = process_file(src)
            completed.append(rel)
            print(f"OK -> {rel}")
        except Exception as exc:  # noqa: BLE001
            failed.append(f"{name}: {exc}")
            print(f"FAILED ({exc})")

    print("\n=== Summary ===")
    print(f"Completed ({len(completed)}):")
    for item in completed:
        print(f"  + {item}")
    print(f"Failed ({len(failed)}):")
    for item in failed:
        print(f"  ! {item}")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
