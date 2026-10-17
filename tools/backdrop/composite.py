"""Stack the four rendered layers (far, mid, floor, near) into one preview PNG.  python -I composite.py DIR OUT.png"""
import sys, os
from PIL import Image
d, out = sys.argv[1], sys.argv[2]
im = None
for n in ('far', 'floor', 'mid', 'near'):
    l = Image.open(os.path.join(d, n + '.png')).convert('RGBA')
    im = l if im is None else Image.alpha_composite(im, l)
bg = Image.new('RGBA', im.size, (0, 0, 0, 255)); bg.alpha_composite(im); bg.convert('RGB').save(out)
