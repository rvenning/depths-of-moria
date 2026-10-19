"""Lay rendered frames side by side on a dark ground.  python -I strip.py OUT.png IN.png [IN.png ...]"""
import sys
from PIL import Image
out, ins = sys.argv[1], sys.argv[2:]
ims = [Image.open(p).convert('RGBA') for p in ins]
h = max(i.height for i in ims); w = sum(i.width for i in ims)
sheet = Image.new('RGBA', (w, h), (38, 32, 51, 255)); x = 0
for im in ims:
    sheet.alpha_composite(im, (x, h - im.height)); x += im.width
sheet.convert('RGB').save(out)
