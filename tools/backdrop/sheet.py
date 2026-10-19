"""Contact sheet of composite previews.  python -I sheet.py OUT.png DIR [DIR ...]  (each DIR holds comp.png)"""
import sys, os
from PIL import Image, ImageDraw
out, dirs = sys.argv[1], sys.argv[2:]
cols = 2; w, h = 640, 320
rows = (len(dirs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * (h + 18)), (20, 20, 24)); d = ImageDraw.Draw(sheet)
for i, p in enumerate(dirs):
    im = Image.open(os.path.join(p, 'comp.png')).resize((w, h)); x, y = (i % cols) * w, (i // cols) * (h + 18)
    sheet.paste(im, (x, y + 18)); d.text((x + 4, y + 3), os.path.basename(p), fill=(220, 220, 220))
sheet.save(out)
