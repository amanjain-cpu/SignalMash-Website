"""Pixel comparison of two screenshots, for scripts/visual-compare.mjs.

    python -I scripts/lib/pixel-diff.py live.png local.png diff.png

Prints "<percent> of pixels differ (<w>x<h> vs <w>x<h>)" and writes a diff image: differing
pixels in red over a faded copy of the live screenshot. A pixel counts as different when any
colour channel differs by more than 24 of 255, which ignores anti-aliasing noise.
"""
import sys
from PIL import Image, ImageChops

live_path, local_path, diff_path = sys.argv[1:4]
live = Image.open(live_path).convert("RGB")
local = Image.open(local_path).convert("RGB")

w, h = max(live.width, local.width), max(live.height, local.height)
a = Image.new("RGB", (w, h), "white"); a.paste(live)
b = Image.new("RGB", (w, h), "white"); b.paste(local)

delta = ImageChops.difference(a, b).convert("L").point(lambda v: 255 if v > 24 else 0)
changed = sum(1 for v in delta.getdata() if v)

overlay = Image.blend(a, Image.new("RGB", (w, h), "white"), 0.7)
overlay.paste(Image.new("RGB", (w, h), (230, 0, 0)), mask=delta)
overlay.save(diff_path)

size = f"{live.width}x{live.height} vs {local.width}x{local.height}"
print(f"{100 * changed / (w * h):6.3f}% of pixels differ ({size})")
