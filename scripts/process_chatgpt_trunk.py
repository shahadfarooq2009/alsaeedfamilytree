#!/usr/bin/env python3
"""One-off: clean checkerboard from ChatGPT trunk replacement image."""

from __future__ import annotations

import shutil
import sys
from collections import Counter, deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "frontend" / "src" / "assets" / "family-tree" / "processed" / (
    "ChatGPT Image Jul 1, 2026, 12_03_34 AM.png"
)
BACKUP = ROOT / "frontend" / "src" / "assets" / "family-tree" / "raw" / (
    "ChatGPT Image Jul 1, 2026, 12_03_34 AM.png"
)
OUT = SRC
PREVIEW_IMG = ROOT / "frontend" / "public" / "previews" / "chatgpt-trunk-cleaned.png"
PREVIEW_HTML = ROOT / "frontend" / "public" / "previews" / "chatgpt-trunk-cleaned.html"

HARD_TOL = 20.0
SOFT_TOL = 36.0
FLOOD_TOL = 34.0
DEFRINGE_TOL = 18.0
DEFRINGE_MAX_ALPHA = 210


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
    samples.extend([rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]])

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
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    warm = (r >= g - 6) & (g >= b - 10)
    gold = (r > 140) & (g > 110) & (b < 175) & warm
    ivory = (r > 200) & (g > 190) & (b > 160) & (r - b > 12)
    bark = (r > 45) & (r < 200) & (g > 35) & (b > 25) & (r >= g - 5)
    return gold | ivory | bark


def clean(rgb: np.ndarray) -> np.ndarray:
    c1, c2 = detect_checker_colors(rgb)
    print(f"Checker colors: {c1.tolist()} / {c2.tolist()}")
    dist = checker_distance(rgb, c1, c2)
    protected = is_protected_foreground(rgb)
    bg = border_flood(dist <= FLOOD_TOL)

    alpha = np.full(dist.shape, 255, dtype=np.uint8)
    alpha[bg & (dist <= HARD_TOL)] = 0
    feather = bg & (dist > HARD_TOL) & (dist < SOFT_TOL)
    if np.any(feather):
        alpha[feather] = np.clip(
            ((dist[feather] - HARD_TOL) / max(SOFT_TOL - HARD_TOL, 1e-6)) * 255.0,
            0,
            255,
        ).astype(np.uint8)

    alpha[protected & ~bg] = 255

    semi = (alpha > 0) & (alpha < DEFRINGE_MAX_ALPHA)
    neutral = (
        (np.abs(rgb[:, :, 0].astype(int) - rgb[:, :, 1].astype(int)) < 10)
        & (np.abs(rgb[:, :, 1].astype(int) - rgb[:, :, 2].astype(int)) < 10)
    )
    halo = semi & neutral & (dist <= DEFRINGE_TOL) & ~is_protected_foreground(rgb)
    dilated_bg = bg.copy()
    for _ in range(3):
        dilated_bg[1:, :] |= dilated_bg[:-1, :]
        dilated_bg[:-1, :] |= dilated_bg[1:, :]
        dilated_bg[:, 1:] |= dilated_bg[:, :-1]
        dilated_bg[:, :-1] |= dilated_bg[:, 1:]
    alpha[halo & dilated_bg] = 0

    return np.dstack([rgb, alpha])


def write_preview_html() -> None:
    PREVIEW_HTML.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW_HTML.write_text(
        """<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>ChatGPT Trunk — Background Removal Preview</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; background: #f3efe6; color: #2f3628; }
    h1 { font-size: 1.25rem; margin-bottom: 8px; }
    p { color: #5c6652; font-size: 0.9rem; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
    .panel { border-radius: 12px; overflow: hidden; border: 1px solid #d8d2c6; }
    .label { padding: 10px 12px; font-size: 0.85rem; font-weight: 600; background: #fff; }
    .stage { min-height: 280px; display: flex; align-items: center; justify-content: center; padding: 16px; }
    img { max-width: 100%; max-height: 360px; object-fit: contain; }
    .white { background: #ffffff; }
    .dark { background: #2f3628; }
    .green { background: #6f8a57; }
  </style>
</head>
<body>
  <h1>معاينة الجذع — خلفية شفافة</h1>
  <p>للمراجعة فقط. لم يتم تحديث أصول الإنتاج بعد.</p>
  <div class="grid">
    <div class="panel">
      <div class="label">أبيض</div>
      <div class="stage white"><img src="./chatgpt-trunk-cleaned.png" alt="on white" /></div>
    </div>
    <div class="panel">
      <div class="label">داكن</div>
      <div class="stage dark"><img src="./chatgpt-trunk-cleaned.png" alt="on dark" /></div>
    </div>
    <div class="panel">
      <div class="label">أخضر</div>
      <div class="stage green"><img src="./chatgpt-trunk-cleaned.png" alt="on green" /></div>
    </div>
  </div>
</body>
</html>
""",
        encoding="utf-8",
    )


def main() -> int:
    if not SRC.is_file():
        print(f"Source not found: {SRC}")
        return 1

    BACKUP.parent.mkdir(parents=True, exist_ok=True)
    if not BACKUP.exists():
        shutil.copy2(SRC, BACKUP)
        print(f"Backup saved -> {BACKUP}")

    with Image.open(SRC) as img:
        rgb = np.array(img.convert("RGB"))
        size = img.size

    print(f"Processing {size[0]}x{size[1]} ...")
    rgba = clean(rgb)

    transparent_pct = 100.0 * float(np.sum(rgba[:, :, 3] < 250)) / rgba[:, :, 3].size
    print(f"Transparent pixels: {transparent_pct:.1f}%")

    out_img = Image.fromarray(rgba.astype(np.uint8), mode="RGBA")
    out_img.save(OUT, format="PNG")
    print(f"Saved cleaned -> {OUT}")

    PREVIEW_IMG.parent.mkdir(parents=True, exist_ok=True)
    out_img.save(PREVIEW_IMG, format="PNG")
    print(f"Preview copy -> {PREVIEW_IMG}")

    write_preview_html()
    print(f"Preview HTML -> {PREVIEW_HTML}")
    print("Open: http://localhost:5173/previews/chatgpt-trunk-cleaned.html")
    return 0


if __name__ == "__main__":
    sys.exit(main())
