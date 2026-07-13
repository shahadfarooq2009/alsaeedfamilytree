from PIL import Image
import numpy as np

LOGO = r"c:\xampp\htdocs\family tree\frontend\src\assets\family-tree\reference\family-logo.png"
BEIGE = np.array([250, 247, 239], dtype=np.uint8)

img = Image.open(LOGO).convert("RGBA")
arr = np.array(img)
h, w = arr.shape[:2]
cx, cy = w / 2, h / 2
max_r = min(cx, cy)

yy, xx = np.ogrid[:h, :w]
dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
norm = dist / max_r

rgb = arr[:, :, :3].astype(np.float32)
saturation = (rgb.max(axis=2) - rgb.min(axis=2)) / (rgb.max(axis=2) + 1e-6)

ring_outer = 0.465
ring_inner = 0.385

is_gold = (
    (rgb[:, :, 0] > 110)
    & (rgb[:, :, 1] > 80)
    & (rgb[:, :, 2] < 160)
    & (saturation > 0.04)
)
is_tree = (arr[:, :, 3] > 80) & ~is_gold & (norm < ring_inner * 0.97)

out = np.zeros_like(arr)
inside_fill = norm < ring_inner

out[inside_fill, :3] = BEIGE
out[inside_fill, 3] = 255

out[is_gold & (norm <= ring_outer)] = arr[is_gold & (norm <= ring_outer)]
out[is_tree] = arr[is_tree]

# Hard clip — no halo outside the logo circle
out[norm > ring_outer] = [0, 0, 0, 0]

Image.fromarray(out, "RGBA").save(LOGO, optimize=True)
print(f"Fixed {LOGO}")
