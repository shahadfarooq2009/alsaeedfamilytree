from PIL import Image
import numpy as np

SRC = r"C:\Users\shahad\.cursor\projects\c-xampp-htdocs-family-tree\assets\c__Users_shahad_AppData_Roaming_Cursor_User_workspaceStorage_6b9d4d72abb4ae0282467413090986b1_images_image-1117f2a6-8512-4999-90c0-474bce009f0f.png"
OUT = r"c:\xampp\htdocs\family tree\frontend\src\assets\family-tree\reference\family-logo.png"
BEIGE = np.array([250, 247, 239], dtype=np.uint8)

img = Image.open(SRC).convert("RGBA")
arr = np.array(img, dtype=np.float32)
rgb = arr[:, :, :3]
alpha = arr[:, :, 3]

h, w = rgb.shape[:2]
cx, cy = w / 2, h / 2
max_r = min(cx, cy)

yy, xx = np.ogrid[:h, :w]
dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
norm = dist / max_r

brightness = rgb.mean(axis=2)
max_c = rgb.max(axis=2)
min_c = rgb.min(axis=2)
saturation = (max_c - min_c) / (max_c + 1e-6)

corners = np.vstack([
    rgb[0:30, 0:30].reshape(-1, 3),
    rgb[0:30, w - 30 : w].reshape(-1, 3),
    rgb[h - 30 : h, 0:30].reshape(-1, 3),
    rgb[h - 30 : h, w - 30 : w].reshape(-1, 3),
])
bg = np.median(corners, axis=0)
dist_bg = np.linalg.norm(rgb - bg, axis=2)

is_gold = (
    (rgb[:, :, 0] > 105)
    & (rgb[:, :, 1] > 78)
    & (rgb[:, :, 2] < 165)
    & (saturation > 0.035)
    & (brightness < 235)
)
is_tree = (
    (alpha > 60)
    & ~is_gold
    & (norm < 0.40)
    & (
        ((rgb[:, :, 1] > rgb[:, :, 0] + 2) & (saturation > 0.04))
        | (brightness < 120)
    )
)

ring_outer = 0.448
ring_inner = 0.368

out = np.zeros((h, w, 4), dtype=np.uint8)

inside = norm < ring_inner
out[inside, :3] = BEIGE
out[inside, 3] = 255

gold_pixels = is_gold & (norm <= ring_outer)
out[gold_pixels] = arr[gold_pixels].astype(np.uint8)

tree_pixels = is_tree
out[tree_pixels] = arr[tree_pixels].astype(np.uint8)

# Remove any light page fill between ring and clip edge
light_halo = (
    (norm > ring_inner)
    & (norm <= ring_outer + 0.02)
    & ~gold_pixels
    & ~tree_pixels
)
out[light_halo] = [0, 0, 0, 0]

out[norm > ring_outer] = [0, 0, 0, 0]

Image.fromarray(out, "RGBA").save(OUT, optimize=True)
print(f"Saved {OUT}")
