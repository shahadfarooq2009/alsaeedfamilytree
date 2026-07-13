#!/usr/bin/env python3
"""
Remove baked-in gray/white checkerboard from branch PNG assets.

Reads numbered originals (1.png … 9.png) — never overwrites them.
Writes cleaned RGBA PNGs with canonical names into the same branches folder.

Preview: frontend/public/previews/branch-assets-cleaned.html
"""

from __future__ import annotations

import sys
from collections import Counter, deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRANCH_DIR = ROOT / "frontend" / "src" / "assets" / "family-tree" / "raw" / "branches"
PREVIEW_DIR = ROOT / "frontend" / "public" / "previews"
PREVIEW_HTML = PREVIEW_DIR / "branch-assets-cleaned.html"

# Numbered upload -> canonical output (verified by size/orientation analysis).
SOURCE_MAP: list[tuple[str, str]] = [
    ("1.png", "branch-medium-right.png"),
    ("2.png", "branch-main-left.png"),
    ("3.png", "branch-small-right.png"),
    ("4.png", "branch-medium-left.png"),
    ("5.png", "branch-small-left.png"),
    ("6.png", "branch-main-right.png"),
    ("7.png", "twig-right.png"),
    ("8.png", "twig-left.png"),
    ("9.png", "hanging-stem.png"),
]

OUTPUT_NAMES = [out for _, out in SOURCE_MAP]

HARD_TOL = 18.0
SOFT_TOL = 34.0
FLOOD_TOL = 32.0
DEFRINGE_TOL = 16.0
DEFRINGE_MAX_ALPHA = 205


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

    samples.extend(
        [rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]],
    )

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


def is_protected_branch_wood(rgb: np.ndarray) -> np.ndarray:
    """Preserve bark, twigs, warm highlights — not checker neutrals."""
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)

    warm = (r >= g - 18) & (g >= b - 22)
    wood = warm & (r > 72) & (g > 58) & (b > 48) & (r < 252)
    bark_gray = (
        (np.abs(r - g) < 28)
        & (np.abs(g - b) < 28)
        & (r > 95)
        & (r < 238)
        & (g > 85)
    )
    dark_bark = (r < 115) & (g < 108) & (b < 100) & (r > 35)
    highlight = (r > 175) & warm & (r - b > 8)

    return wood | bark_gray | dark_bark | highlight


def build_alpha(rgb: np.ndarray, c1: np.ndarray, c2: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    dist = checker_distance(rgb, c1, c2)
    protected = is_protected_branch_wood(rgb)

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

    interior = protected & ~bg
    alpha[interior] = 255

    return alpha, dist, bg


def defringe_halos(
    rgb: np.ndarray,
    alpha: np.ndarray,
    dist: np.ndarray,
    bg: np.ndarray,
) -> np.ndarray:
    out = alpha.copy()
    semi = (out > 0) & (out < DEFRINGE_MAX_ALPHA)
    neutral = (
        (np.abs(rgb[:, :, 0].astype(int) - rgb[:, :, 1].astype(int)) < 12)
        & (np.abs(rgb[:, :, 1].astype(int) - rgb[:, :, 2].astype(int)) < 12)
    )
    halo = semi & neutral & (dist <= DEFRINGE_TOL) & ~is_protected_branch_wood(rgb)

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

    out[is_protected_branch_wood(rgb) & ~bg] = np.maximum(
        out[is_protected_branch_wood(rgb) & ~bg],
        200,
    )
    return out


def restore_edge_antialias(alpha: np.ndarray, bg: np.ndarray) -> np.ndarray:
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


def remove_checkerboard(rgb: np.ndarray) -> np.ndarray:
    c1, c2 = detect_checker_colors(rgb)
    alpha, dist, bg = build_alpha(rgb, c1, c2)
    alpha = defringe_halos(rgb, alpha, dist, bg)
    alpha = restore_edge_antialias(alpha, bg)
    return np.dstack([rgb, alpha]), c1, c2


def verify_output(path: Path) -> dict[str, object]:
    with Image.open(path) as img:
        if img.mode != "RGBA":
            raise ValueError(f"expected RGBA, got {img.mode}")
        arr = np.array(img)
        alpha = arr[:, :, 3]
        opaque = int(np.sum(alpha > 250))
        transparent = int(np.sum(alpha < 10))
        semi = int(alpha.size - opaque - transparent)
        if transparent == 0:
            raise ValueError("no transparent pixels")
        if opaque == 0:
            raise ValueError("no opaque branch pixels — shape lost?")

        # Corners should be transparent
        corners = [
            alpha[0, 0],
            alpha[0, -1],
            alpha[-1, 0],
            alpha[-1, -1],
        ]
        if any(c > 20 for c in corners):
            raise ValueError(f"corners not transparent: {corners}")

        return {
            "size": img.size,
            "opaque_pct": round(100.0 * opaque / alpha.size, 1),
            "transparent_pct": round(100.0 * transparent / alpha.size, 1),
            "semi_pct": round(100.0 * semi / alpha.size, 1),
        }


def write_preview_html() -> None:
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    panels: list[str] = []
    for name in OUTPUT_NAMES:
        src = f"./branches/{name}"
        for bg_label, bg_css in [
            ("أبيض", "#ffffff"),
            ("داكن", "#2f3628"),
            ("أخضر", "#6f8a57"),
        ]:
            panels.append(
                f"""
    <div class="panel">
      <div class="label">{name} — {bg_label}</div>
      <div class="stage" style="background:{bg_css}">
        <img src="{src}" alt="{name}" />
      </div>
    </div>""",
            )

    html = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>Branch assets — transparency preview</title>
  <style>
    body {{ font-family: system-ui, sans-serif; margin: 24px; background: #f3efe6; color: #2f3628; }}
    h1 {{ font-size: 1.25rem; }}
    p {{ color: #5c6652; font-size: 0.9rem; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }}
    .panel {{ border-radius: 12px; overflow: hidden; border: 1px solid #d8d2c6; background: #fff; }}
    .label {{ padding: 8px 12px; font-size: 0.75rem; font-weight: 600; background: #faf7f0; }}
    .stage {{ min-height: 160px; display: flex; align-items: center; justify-content: center; padding: 12px; }}
    img {{ max-width: 100%; max-height: 200px; object-fit: contain; }}
  </style>
</head>
<body>
  <h1>معاينة أصول الأغصان — خلفية شفافة</h1>
  <p>للمراجعة فقط. الملفات الأصلية 1.png–9.png لم تُستبدَل.</p>
  <div class="grid">
    {''.join(panels)}
  </div>
</body>
</html>
"""
    PREVIEW_HTML.write_text(html, encoding="utf-8")


def copy_for_preview(name: str) -> None:
    """Copy cleaned asset to public/previews/branches for static serving."""
    src = BRANCH_DIR / name
    dst = PREVIEW_DIR / "branches" / name
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as img:
        img.save(dst, format="PNG")


def process_one(src_name: str, out_name: str, index: int, total: int) -> None:
    src = BRANCH_DIR / src_name
    dst = BRANCH_DIR / out_name

    if not src.is_file():
        raise FileNotFoundError(f"missing source: {src}")

    if dst.exists() and dst.name in {s for _, s in SOURCE_MAP}:
        pass  # overwrite previous cleaned output only, never 1.png–9.png

    print(f"[{index}/{total}] {src_name} -> {out_name}", flush=True)

    with Image.open(src) as img:
        rgb = np.array(img.convert("RGB"))

    rgba, c1, c2 = remove_checkerboard(rgb)
    print(f"    checker colors: {c1.tolist()} / {c2.tolist()}")

    out_img = Image.fromarray(rgba.astype(np.uint8), mode="RGBA")
    out_img.save(dst, format="PNG")

    stats = verify_output(dst)
    print(
        f"    OK  {stats['size']}  opaque={stats['opaque_pct']}%  "
        f"transparent={stats['transparent_pct']}%  semi={stats['semi_pct']}%",
    )

    copy_for_preview(out_name)


def main() -> int:
    BRANCH_DIR.mkdir(parents=True, exist_ok=True)
    total = len(SOURCE_MAP)
    failed: list[str] = []

    print(f"Branch cleanup -> {BRANCH_DIR}\n")

    for index, (src_name, out_name) in enumerate(SOURCE_MAP, start=1):
        try:
            process_one(src_name, out_name, index, total)
        except Exception as exc:  # noqa: BLE001
            failed.append(f"{src_name} -> {out_name}: {exc}")
            print(f"    FAILED: {exc}")

    write_preview_html()
    print(f"\nPreview HTML -> {PREVIEW_HTML}")
    print("Open: http://localhost:5173/previews/branch-assets-cleaned.html")

    print("\n=== Summary ===")
    if failed:
        for item in failed:
            print(f"  ! {item}")
        return 1

    print(f"  All {total} branch assets processed and verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
