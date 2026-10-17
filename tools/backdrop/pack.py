"""Pack a rendered backdrop set into public/backdrops as lossy WebP (alpha kept) and write its manifest entry.
python -I pack.py RENDER_DIR CHAPTER VARIANT"""
import sys, os, json
from PIL import Image
src, chapter, variant = sys.argv[1], sys.argv[2], sys.argv[3]
root = os.path.join('public', 'backdrops'); os.makedirs(root, exist_ok=True)
name = f'c{chapter}-{variant}'
total = 0
for layer in ('far', 'mid', 'floor', 'near'):
    im = Image.open(os.path.join(src, layer + '.png')).convert('RGBA')
    p = os.path.join(root, f'{name}-{layer}.webp'); im.save(p, 'WEBP', quality=90, method=6, alpha_quality=90); total += os.path.getsize(p)
lights = json.load(open(os.path.join(src, 'lights.json')))
mp = os.path.join(root, 'manifest.json')
m = json.load(open(mp)) if os.path.exists(mp) else {}
m[f'{chapter}:{variant}'] = {'name': name, 'lights': lights, 'bytes': total}
json.dump(m, open(mp, 'w'), indent=1)
print(name, total // 1024, 'KB')
