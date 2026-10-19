"""Prototype: a Blender-modelled Aragorn rendered as sprite frames (idle, breathe, wind-up, strike, thrust).
Run:  blender -b -P tools/sprites/aragorn.py -- OUTDIR [width]     (frame is 4:5 of 72x92, so width 288 = 4x the game cell)"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from common import *

a = args()
OUT = a[0] if a else 'out'
W = int(a[1]) if len(a) > 1 else 288
H = round(W * 92 / 72)
os.makedirs(OUT, exist_ok=True)
scene = reset()

SKIN, HAIR = mat('skin', '#e6aa7c', 0.55), mat('hair', '#4d3220', 0.8)
TUNIC, CLOAK, TROUSER = mat('tunic', '#55914a', 0.8), mat('cloak', '#2f6e55', 0.85), mat('trouser', '#80593a', 0.85)
BOOT, BELT, GOLD = mat('boot', '#3b2717', 0.7), mat('belt', '#5d3b1e', 0.7), mat('gold', '#e0b040', 0.35)
STEEL, EYE, SHIRT = mat('steel', '#d6dde8', 0.25), mat('eye', '#14110f', 0.4), mat('shirt', '#cfd6c0', 0.8)

root = pivot('root', (0, 0, 0)); root.rotation_euler = (0, 0, math.radians(-28))
body = pivot('body', (0, 0, 0.82), root)                      # hips: everything above bends from here
torso = pivot('torso', (0, 0, 0), body)

# legs (near leg is at -y, toward the camera)
legs = []
for side, y in (('near', -0.13), ('far', 0.13)):
    hip = pivot(f'hip_{side}', (0, y, 0), body)
    cyl(f'leg_{side}', (0, 0, -0.30), 0.115, 0.62, TROUSER, hip)
    box(f'boot_{side}', (0.07, 0, -0.66), (0.34, 0.2, 0.2), BOOT, hip, bevel=0.05)
    legs.append(hip)

# torso, belt, tunic skirt
sphere('chest', (0, 0, 0.32), (0.33, 0.27, 0.42), TUNIC, torso)
sphere('shirt', (0.04, -0.05, 0.62), (0.2, 0.2, 0.1), SHIRT, torso)
cyl('belt', (0, 0, 0.06), 0.3, 0.1, BELT, torso, r2=0.31)
box('buckle', (0.05, -0.28, 0.06), (0.1, 0.03, 0.1), GOLD, torso, bevel=0.01)
cyl('skirt', (0, 0, -0.1), 0.34, 0.26, TUNIC, torso, r2=0.28)

# cloak: a long panel hanging behind, swaying
cape = pivot('cape', (-0.2, 0, 0.62), torso)
cn = cyl('cloak', (-0.12, 0, -0.55), 0.36, 1.3, CLOAK, cape, r2=0.16)
cn.scale = (0.45, 1.0, 1.0)
sphere('cloakshoulder', (-0.1, 0, 0.0), (0.3, 0.4, 0.14), CLOAK, cape)

# head
head = pivot('head', (0.0, 0, 0.78), torso)
sphere('skull', (0.02, 0, 0.5), (0.4, 0.37, 0.41), SKIN, head)
sphere('hair', (-0.07, 0.0, 0.62), (0.43, 0.4, 0.34), HAIR, head)
sphere('hairback', (-0.28, 0, 0.36), (0.22, 0.3, 0.42), HAIR, head)
for y in (-0.12, 0.12):
    sphere(f'fringe{y}', (0.13, y, 0.78), (0.2, 0.17, 0.12), HAIR, head)
eyes = [sphere(f'eye{x}', (x, -0.355, 0.53), (0.05, 0.03, 0.065), EYE, head) for x in (0.1, 0.27)]
sphere('nose', (0.24, -0.37, 0.43), (0.06, 0.05, 0.06), mat('nose', '#d49468', 0.6), head)
sphere('brow', (0.18, -0.35, 0.63), (0.17, 0.04, 0.035), HAIR, head)

# arms and sword
arms = {}
for side, y in (('near', -0.37), ('far', 0.37)):
    sh = pivot(f'shoulder_{side}', (0, y, 0.55), torso)
    sphere(f'delt_{side}', (0, 0, 0), (0.13, 0.13, 0.13), TUNIC, sh)
    cyl(f'uarm_{side}', (0, 0, -0.2), 0.095, 0.42, TUNIC, sh)
    el = pivot(f'elbow_{side}', (0, 0, -0.4), sh)
    cyl(f'farm_{side}', (0, 0, -0.19), 0.085, 0.4, TUNIC, el)
    hand = pivot(f'hand_{side}', (0, 0, -0.4), el)
    sphere(f'fist_{side}', (0, 0, 0), (0.1, 0.1, 0.1), SKIN, hand)
    arms[side] = (sh, el, hand)
hand = arms['near'][2]
sw = pivot('sword', (0, 0, 0), hand)
box('grip', (0, 0, -0.05), (0.05, 0.05, 0.22), BELT, sw, bevel=0.01)
box('guard', (0, 0, -0.17), (0.07, 0.34, 0.06), GOLD, sw, bevel=0.015)
box('pommel', (0, 0, 0.07), (0.09, 0.09, 0.09), GOLD, sw, bevel=0.03)
box('blade', (0, 0, -0.62), (0.05, 0.15, 0.82), STEEL, sw, bevel=0.012)
box('tip', (0, 0, -1.08), (0.04, 0.09, 0.12), STEEL, sw, rot=(0, 0, 0), bevel=0.01)
# the sword continues the forearm (blade along -z, away from the hand)

meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o not in eyes]
if 'outline' in a:
    outline(meshes, 0.03)        # (the prototype outlines in post, on the pixel grid, instead)
lights()
camera(2.95, 1.38, W, H)
dev = setup_render(48)
print('device', dev)

POSES = {
    #            lean  shoulder elbow  far_sh far_el  legs    cape  bob  head
    'idle0':   (0,    -25,     -125,  8,     -12,    0,      0,    0,   0),
    'idle1':   (0,    -22,     -128,  10,    -14,    0,      4,    0.02, 2),
    'wind':    (-7,   150,     -10,   -20,   -40,    -8,     14,   0,   -4),
    'strike0': (8,    -70,     -20,   30,    -20,    12,     -10,  -0.02, 4),
    'strike1': (11,   -82,     -8,    40,    -30,    16,     -16,  -0.03, 6),
    'thrust1': (13,   -72,     -2,    25,    -10,    20,     -18,  -0.03, 5),
}


def pose(p):
    lean, sh, el, fsh, fel, leg, cp, bob, hd = p
    body.location.z = 0.82 + bob
    torso.rotation_euler = (0, math.radians(lean), 0)
    arms['near'][0].rotation_euler = (0, math.radians(sh), 0); arms['near'][1].rotation_euler = (0, math.radians(el), 0)
    arms['far'][0].rotation_euler = (0, math.radians(fsh), 0); arms['far'][1].rotation_euler = (0, math.radians(fel), 0)
    legs[0].rotation_euler = (0, math.radians(leg), 0); legs[1].rotation_euler = (0, math.radians(-leg * 0.7), 0)
    cape.rotation_euler = (0, math.radians(cp), 0)
    head.rotation_euler = (0, math.radians(hd * 0.5 - lean * 0.4), 0)


for name, p in POSES.items():
    pose(p)
    render(os.path.join(OUT, f'aragorn_{name}.png'))
    print('rendered', name)
