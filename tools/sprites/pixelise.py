"""Turn Blender sprite frames into game-cell pixel sprites: box-downsample, hard alpha, one shared palette per set, then a dark
selective outline on the pixel grid (as the game's own engine draws it).
python -I pixelise.py OUTDIR PREFIX FACTOR COLOURS FRAME [FRAME ...]    writes OUTDIR/px_<frame>.png at native size"""
import sys, os
from PIL import Image

out, prefix, factor, ncol = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
names = sys.argv[5:]
src = [Image.open(os.path.join(out, f'{prefix}_{n}.png')).convert('RGBA') for n in names]


def down(im):
    w, h = im.width // factor, im.height // factor
    # premultiplied box filter so edges do not pick up the transparent black
    px = im.load(); small = Image.new('RGBA', (w, h))
    sp = small.load()
    for y in range(h):
        for x in range(w):
            r = g = b = a = 0
            for dy in range(factor):
                for dx in range(factor):
                    R, G, B, A = px[x * factor + dx, y * factor + dy]
                    r += R * A; g += G * A; b += B * A; a += A
            n = factor * factor
            if a > 0:
                sp[x, y] = (round(r / a), round(g / a), round(b / a), round(a / n))
    return small


smalls = [down(i) for i in src]
# one palette from every frame's opaque pixels
tile = Image.new('RGB', (sum(s.width for s in smalls), max(s.height for s in smalls)))
x = 0
for s in smalls:
    rgb = Image.new('RGB', s.size); rgb.paste(s.convert('RGB'), mask=s.split()[3].point(lambda v: 255 if v >= 128 else 0))
    tile.paste(rgb, (x, 0)); x += s.width
pal = tile.quantize(colors=ncol, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
for n, s in zip(names, smalls):
    a = s.split()[3].point(lambda v: 255 if v >= 128 else 0)
    q = s.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB')
    res = Image.new('RGBA', s.size, (0, 0, 0, 0)); res.paste(q, mask=a)
    rp, ap = res.load(), a.load(); w, h = s.size
    # outline: every empty pixel beside an opaque one becomes a dark shade of that neighbour
    ol = res.copy(); op = ol.load()
    for y in range(h):
        for x in range(w):
            if ap[x, y]:
                continue
            best = None
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                X, Y = x + dx, y + dy
                if 0 <= X < w and 0 <= Y < h and ap[X, Y]:
                    c = rp[X, Y]
                    if best is None or sum(c[:3]) < sum(best[:3]):
                        best = c
            if best:
                op[x, y] = (int(best[0] * 0.22), int(best[1] * 0.22), int(best[2] * 0.26), 255)
    ol.save(os.path.join(out, f'px_{prefix}_{n}.png'))
print('ok', len(names), 'frames', smalls[0].size)
