"""Comparison sheet: the game's current sprites, the Blender sprites pixelised to the same grid, and the hi-res renders.
python -I compare.py OUT.png DIR HERO_OR_ENEMY  (hero: aragorn / enemy: rat)"""
import sys, os
from PIL import Image, ImageDraw
out, d, kind = sys.argv[1], sys.argv[2], sys.argv[3]
S = 4
rows = []
if kind == 'aragorn':
    game = ['idle0', 'idle1', 'wind0', 'strike0', 'strike1', 'thrust2']
    mine = ['idle0', 'idle1', 'wind', 'strike0', 'strike1', 'thrust1']
else:
    game = ['idle0']; mine = ['idle0', 'idle1', 'wind', 'strike', 'step0', 'step1']


def load(p):
    return Image.open(p).convert('RGBA')


g = [load(os.path.join(d, f'game_{kind}_{n}.png')) for n in game]
px = [load(os.path.join(d, f'px_{kind}_{n}.png')) for n in mine]
hi = [load(os.path.join(d, f'{kind}_{n}.png')) for n in mine]
cell_w = max(max(i.width for i in px), max(i.width for i in g)) * S
cell_h = max(max(i.height for i in px), max(i.height for i in g)) * S
hh = max(i.height for i in hi); hw = max(i.width for i in hi)
W = max(len(g), len(px)) * cell_w; Wh = len(hi) * hw
sheet = Image.new('RGBA', (max(W, Wh), cell_h * 2 + hh + 60), (38, 32, 51, 255)); dr = ImageDraw.Draw(sheet)
y = 0
dr.text((4, y + 2), 'current game sprites', fill=(230, 230, 230)); y += 14
for i, im in enumerate(g):
    sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (i * cell_w, y + cell_h - im.height * S))
y += cell_h + 4
dr.text((4, y + 2), 'Blender, pixelised to the same grid', fill=(230, 230, 230)); y += 14
for i, im in enumerate(px):
    sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (i * cell_w, y + cell_h - im.height * S))
y += cell_h + 4
dr.text((4, y + 2), 'Blender, as rendered', fill=(230, 230, 230)); y += 14
for i, im in enumerate(hi):
    sheet.alpha_composite(im, (i * hw, y + hh - im.height))
sheet.convert('RGB').save(out)
