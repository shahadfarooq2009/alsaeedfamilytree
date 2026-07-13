from PIL import Image
import numpy as np

SRC = r"C:\Users\shahad\.cursor\projects\c-xampp-htdocs-family-tree\assets\c__Users_shahad_AppData_Roaming_Cursor_User_workspaceStorage_6b9d4d72abb4ae0282467413090986b1_images_image-1117f2a6-8512-4999-90c0-474bce009f0f.png"
OUT = r"c:\xampp\htdocs\family tree\frontend\src\assets\family-tree\reference\family-logo.png"

img = Image.open(SRC).convert("RGBA")
arr = np.array(img, dtype=np.float32)
rgb = arr[:, :, :3]

h, w = rgb.shape[:2]
corners = np.vstack([
    rgb[0:40, 0:40].reshape(-1, 3),
    rgb[0:40, w - 40 : w].reshape(-1, 3),
    rgb[h - 40 : h, 0:40].reshape(-1, 3),
    rgb[h - 40 : h, w - 40 : w].reshape(-1, 3),
])
bg = np.median(corners, axis=0)
dist_bg = np.linalg.norm(rgb - bg, axis=2)

brightness = rgb.mean(axis=2)
max_c = rgb.max(axis=2)
min_c = rgb.min(axis=2)
saturation = (max_c - min_c) / (max_c + 1e-6)

mask_light = (brightness > 205) & (saturation < 0.18)
mask_bg = dist_bg < 42

mask_green = (
    (rgb[:, :, 1] > rgb[:, :, 0] + 4)
    & (rgb[:, :, 1] > rgb[:, :, 2] - 8)
    & (saturation > 0.05)
)

mask_gold = (
    (rgb[:, :, 0] > 120)
    & (rgb[:, :, 1] > 90)
    & (rgb[:, :, 2] < 150)
    & (saturation > 0.06)
    & (brightness < 230)
)

mask_dark = brightness < 115

remove = (mask_bg | mask_light) & ~(mask_green | mask_gold | mask_dark)

alpha = np.where(remove, 0.0, 255.0)
arr_out = arr.copy()
arr_out[:, :, 3] = np.clip(alpha, 0, 255)

Image.fromarray(arr_out.astype(np.uint8), "RGBA").save(OUT, optimize=True)
print(f"Saved {OUT}")
