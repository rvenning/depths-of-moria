"""Prototype: a Blender-modelled Tunnel Rat as sprite frames (idle, breathe, wind-up, strike, two steps). Faces left, like the game's enemies.
Run:  blender -b -P tools/sprites/rat.py -- OUTDIR [width]"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from common import *

a = args()
OUT = a[0] if a else 'out'
W = int(a[1]) if len(a) > 1 else 320
H = round(W * 3 / 4)
os.makedirs(OUT, exist_ok=True)
scene = reset()

FUR, FUR2, PINK = mat('fur', '#7a5a42', 0.9), mat('fur2', '#5a4030', 0.9), mat('pink', '#d89a9a', 0.6)
EYE, TOOTH, CLAW = mat('eye', '#e83a2a', 0.3, emit=1.2), mat('tooth', '#f0e8d0', 0.4), mat('claw', '#2a2018', 0.6)

root = pivot('root', (0, 0, 0)); root.rotation_euler = (0, 0, math.radians(20))      # turned a little toward the camera (it faces -x)
body = pivot('body', (0, 0, 0.5), root)
sphere('torso', (0.1, 0, 0.05), (0.62, 0.34, 0.36), FUR, body)
sphere('haunch', (0.45, 0, 0.0), (0.42, 0.36, 0.4), FUR, body)
sphere('belly', (0.05, -0.08, -0.12), (0.5, 0.28, 0.2), mat('belly', '#a88868', 0.9), body)
# head
head = pivot('head', (-0.62, 0, 0.12), body)
sphere('skull', (0, 0, 0.05), (0.32, 0.27, 0.27), FUR, head)
sn = cyl('snout', (-0.3, 0, -0.04), 0.17, 0.42, FUR, head, rot=(0, math.radians(90), 0), r2=0.06)
sphere('nose', (-0.52, 0, -0.03), (0.06, 0.06, 0.06), PINK, head)
for y in (-0.16, 0.16):
    sphere(f'ear{y}', (0.08, y * 1.2, 0.3), (0.12, 0.05, 0.14), PINK, head)
    sphere(f'earf{y}', (0.1, y * 1.2, 0.27), (0.15, 0.06, 0.17), FUR2, head)
eyes = [sphere(f'eye{y}', (-0.17, y, 0.13), (0.055, 0.04, 0.055), EYE, head) for y in (-0.2, 0.2)]
jaw = pivot('jaw', (-0.1, 0, -0.1), head)
sphere('chin', (-0.18, 0, -0.04), (0.2, 0.12, 0.06), FUR2, jaw)
for y in (-0.04, 0.04):
    box(f'fang{y}', (-0.33, y, 0.04), (0.03, 0.025, 0.08), TOOTH, jaw, bevel=0.005)
    box(f'tooth{y}', (-0.3, y, 0.3 * 0 - 0.02), (0.03, 0.025, 0.07), TOOTH, head, bevel=0.005)
whisk = []
for y in (-0.1, 0.1):
    for k, tilt in enumerate((-12, 8)):
        cyl(f'whisker{y}{k}', (-0.46, y * 1.6, 0.0 + k * 0.03), 0.006, 0.36, mat('whisker', '#d8d0c0', 0.5), head, rot=(math.radians(90 + tilt), 0, math.radians(90 + (-1 if y < 0 else 1) * 25)))
# legs
legs = {}
for name, (x, y) in {'fl': (-0.35, -0.2), 'fr': (-0.35, 0.2), 'bl': (0.5, -0.22), 'br': (0.5, 0.22)}.items():
    hip = pivot(f'hip_{name}', (x, y, -0.1), body)
    cyl(f'leg_{name}', (0, 0, -0.17), 0.075 if name[0] == 'b' else 0.06, 0.34, FUR2, hip)
    sphere(f'paw_{name}', (-0.04, 0, -0.35), (0.12, 0.08, 0.05), PINK, hip)
    legs[name] = hip
# tail: a curving chain
tail = pivot('tail', (0.8, 0, -0.02), body)
segs = []
parent = tail
for i in range(7):
    seg = pivot(f'tseg{i}', (0.0 if i == 0 else 0.17, 0, 0), parent)
    cyl(f'tail{i}', (0.09, 0, 0), 0.05 - i * 0.004, 0.2, PINK, seg, rot=(0, math.radians(90), 0))
    segs.append(seg); parent = seg

lights()
camera(1.8, 0.84, W, H)
dev = setup_render(48)
if 'outline' in a:
    outline([o for o in bpy.data.objects if o.type == 'MESH' and o not in eyes], 0.02)


def pose(lean, head_pitch, jaw_open, step, bob, tail_curl, tail_lift):
    body.location.z = 0.5 + bob
    body.rotation_euler = (0, math.radians(lean), 0)
    head.rotation_euler = (0, math.radians(head_pitch), 0)
    jaw.rotation_euler = (0, math.radians(jaw_open), 0)
    legs['fl'].rotation_euler = (0, math.radians(step), 0); legs['br'].rotation_euler = (0, math.radians(step), 0)
    legs['fr'].rotation_euler = (0, math.radians(-step), 0); legs['bl'].rotation_euler = (0, math.radians(-step), 0)
    tail.rotation_euler = (0, math.radians(tail_lift), 0)
    for s in segs:
        s.rotation_euler = (0, math.radians(tail_curl), 0)


POSES = {
    #          lean  headp  jaw  step  bob   curl  lift
    'idle0':  (0,    0,     0,   0,    0,    -9,   -20),
    'idle1':  (0,    -3,    2,   0,    0.02, -11,   -26),
    'wind':   (-12,  -14,   6,   0,    0.04, -14,   -34),        # rears back
    'strike': (6,    16,    38,  -10,  -0.08, -6,   -4),         # lunges, jaws open
    'step0':  (0,    0,     0,   22,   0.0,  -9,   -20),
    'step1':  (0,    0,     0,   -22,  0.03, -9,   -22),
}
for name, p in POSES.items():
    pose(*p)
    render(os.path.join(OUT, f'rat_{name}.png'))
    print('rendered', name)
