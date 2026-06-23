import os
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = r"C:\Users\maxim\documents\kemet\public\Creature.png"
OUT_DIR = r"C:\Users\maxim\documents\kemet\public\creatures"
os.makedirs(OUT_DIR, exist_ok=True)

# Names in actual visual grid order, top-to-bottom, left-to-right (row 0 = top of image)
GRID = [
    ["Serpent", "Devoreuse-des-Mondes", "Bouliste", "Elephant"],
    ["Scorpion", "Scarabee", "Momie", "Sphinx"],
    ["Sphinx-Volant", "Bouquetin", "Minotaure", "Cerbere"],
    ["Chiron", "Meduse", "Kraken", None],
]

OUT_SIZE = 256
PADDING_RATIO = 0.04
BG_TOLERANCE = 20

im = Image.open(SRC).convert("RGB")
arr = np.array(im)
h, w, _ = arr.shape

# Background mask via flood fill from all border pixels (handles big checkerboard region
# even when it's not perfectly uniform color, by tolerance-based region growing).
visited = np.zeros((h, w), dtype=bool)
bg_mask = np.zeros((h, w), dtype=bool)

# Use a fast approach: treat any pixel close to a "light, low-contrast" reference as background
# seed, then grow via flood fill using scipy on a binary similarity map per local seed isn't
# trivial; instead do a tolerance flood fill with a stack but vectorized via repeated dilation.

# Step 1: build an initial candidate background mask: pixels close to the four corner colors.
corner_colors = [arr[0, 0], arr[0, w - 1], arr[h - 1, 0], arr[h - 1, w - 1]]


def close_to_any(pixel_arr, colors, tol):
    mask = np.zeros((h, w), dtype=bool)
    for c in colors:
        diff = np.abs(pixel_arr.astype(np.int16) - c.astype(np.int16))
        mask |= np.all(diff <= tol, axis=-1)
    return mask

candidate = close_to_any(arr, corner_colors, BG_TOLERANCE)

# Step 2: keep only the connected component(s) of "candidate" that touch the image border
# (so isolated light-colored artwork pixels in the middle aren't wrongly removed).
labeled, num = ndimage.label(candidate, structure=np.ones((3, 3)))
border_labels = set(labeled[0, :].tolist()) | set(labeled[-1, :].tolist()) | \
    set(labeled[:, 0].tolist()) | set(labeled[:, -1].tolist())
border_labels.discard(0)
bg_mask = np.isin(labeled, list(border_labels))

# Foreground = everything not background
fg_mask = ~bg_mask

# Connected components of the foreground = individual creature medallions (+ maybe noise)
fg_labeled, fg_num = ndimage.label(fg_mask, structure=np.ones((3, 3)))
sizes = ndimage.sum(fg_mask, fg_labeled, range(1, fg_num + 1))

# Expect 15 medallions; take the largest 15 components
order = np.argsort(sizes)[::-1]
top_labels = [i + 1 for i in order[:15]]

components = []
for lbl in top_labels:
    ys, xs = np.where(fg_labeled == lbl)
    cy, cx = ys.mean(), xs.mean()
    components.append({
        "label": lbl,
        "centroid": (cy, cx),
        "bbox": (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1),
    })

# Assign each component to its grid slot by centroid position
cell_w = w / 4
cell_h = h / 4
assigned = {}
for comp in components:
    cy, cx = comp["centroid"]
    col = min(3, int(cx // cell_w))
    row = min(3, int(cy // cell_h))
    name = GRID[row][col]
    assigned[name] = comp

missing = [GRID[r][c] for r in range(4) for c in range(4) if GRID[r][c] and GRID[r][c] not in assigned]
if missing:
    print("WARNING missing components for:", missing)

rgba_full = im.convert("RGBA")
full_arr = np.array(rgba_full)
full_arr[..., 3] = np.where(fg_mask, 255, 0)

for name, comp in assigned.items():
    x0, y0, x1, y1 = comp["bbox"]
    # mask out everything not belonging to this connected component (avoids neighbor bleed)
    region_mask = (fg_labeled[y0:y1, x0:x1] == comp["label"])
    region = full_arr[y0:y1, x0:x1].copy()
    region[..., 3] = np.where(region_mask, region[..., 3], 0)

    region_img = Image.fromarray(region, mode="RGBA")

    side = max(region_img.width, region_img.height)
    pad = int(side * PADDING_RATIO)
    canvas_side = side + pad * 2
    canvas = Image.new("RGBA", (canvas_side, canvas_side), (0, 0, 0, 0))
    ox = (canvas_side - region_img.width) // 2
    oy = (canvas_side - region_img.height) // 2
    canvas.paste(region_img, (ox, oy), region_img)

    canvas = canvas.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)
    canvas.save(os.path.join(OUT_DIR, f"{name}.png"))
    print("saved", name, "bbox", comp["bbox"])
