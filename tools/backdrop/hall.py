"""Chapter 1 'hall' backdrop, modelled and lit in Blender, rendered as four layers (far / mid / floor / near).
Run:  blender -b -P tools/backdrop/hall.py -- OUTDIR [samples] [width] [variant: hall | arena] [chapter 1-10]
Each layer is rendered with the others as holdouts, so shadows and bounce light between layers are baked in while the layers stay separable.
Writes OUTDIR/{far,mid,floor,near}.png (RGBA) and OUTDIR/lights.json (torch positions in 960x480 stage pixels)."""
import bpy, math, json, os, sys, random
from mathutils import Euler
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'out'
SAMPLES = int(argv[1]) if len(argv) > 1 else 96
W = int(argv[2]) if len(argv) > 2 else 960
H = W // 2
VARIANT = argv[3] if len(argv) > 3 else 'hall'
ARENA = VARIANT == 'arena'
CH = int(argv[4]) if len(argv) > 4 else 1
os.makedirs(OUT, exist_ok=True)
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def hexc(h, k=1.0):
    h = h.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return ((r ** 2.2) * k, (g ** 2.2) * k, (b ** 2.2) * k, 1.0)


# ------------------------------------------------------------------ chapter themes (palette from src/content/chapters.ts)
PAL = {  # sky, far, mid, near, light, fog
    1: ('#12161c', '#222a33', '#33404c', '#1c232b', '#ffc86a', '#4a5866'), 2: ('#101420', '#1e2638', '#303c58', '#171d2c', '#9ac4ff', '#48587a'),
    3: ('#1a1210', '#3a2418', '#5c3a22', '#2a1a12', '#ff8a2a', '#6a4a38'), 4: ('#0e1218', '#1e262e', '#2c3844', '#141a22', '#d0e0ff', '#3e4c5c'),
    5: ('#14121a', '#2c2638', '#463c58', '#1c1826', '#ffd890', '#5a4e6a'), 6: ('#0a1416', '#143036', '#1f4a50', '#0c1c20', '#8affd0', '#2a5a5e'),
    7: ('#12101c', '#241e3c', '#3a3060', '#171328', '#c8b4ff', '#4e4478'), 8: ('#06060c', '#12121e', '#20202e', '#0a0a12', '#b484ff', '#2e2e44'),
    9: ('#1a0806', '#4a1a10', '#7a2c16', '#2a0e08', '#ffa030', '#8a3a22'), 10: ('#0c0608', '#2a1218', '#4a1e24', '#14080c', '#ff5a20', '#5a2a30'),
}
TORCH = {1: (1.0, 0.55, 0.2), 2: (0.45, 0.65, 1.0), 3: (1.0, 0.45, 0.1), 4: (0.8, 0.88, 1.0), 5: (1.0, 0.75, 0.4), 6: (0.35, 1.0, 0.75), 7: (0.7, 0.55, 1.0), 8: (0.65, 0.4, 1.0), 9: (1.0, 0.5, 0.12), 10: (1.0, 0.3, 0.1)}
MOON = {1: (0.62, 0.78, 1.0), 2: (0.55, 0.7, 1.0), 3: (1.0, 0.5, 0.25), 4: (0.85, 0.92, 1.0), 5: (1.0, 0.8, 0.5), 6: (0.4, 1.0, 0.8), 7: (0.7, 0.55, 1.0), 8: (0.6, 0.4, 1.0), 9: (1.0, 0.45, 0.15), 10: (1.0, 0.35, 0.15)}
SKY = {1: ('#3d4f72', 0.8), 2: ('#4a5f9a', 0.8), 3: ('#a8481a', 1.6), 4: ('#9db4d8', 1.2), 5: ('#b08a50', 0.9), 6: ('#2a8a8a', 1.0), 7: ('#5a44a0', 0.9), 8: ('#2a1a4a', 0.6), 9: ('#c8401a', 1.5), 10: ('#d8501a', 1.6)}
FEATURES = {1: [], 2: ['balcony'], 3: ['lava', 'furnace'], 4: ['steps'], 5: ['banners'], 6: ['water'], 7: ['shelves'], 8: ['void', 'crystals'], 9: ['lava'], 10: ['bridge']}
P_SKY, P_FAR, P_MID, P_NEAR, P_LIGHT, P_FOG = PAL[CH]
FEAT = FEATURES[CH]
EXPO = {1: 0.9, 2: 0.85, 3: 0.3, 4: 0.8, 5: 0.7, 6: 0.5, 7: 0.6, 8: 0.6, 9: 0.25, 10: 0.25}      # exposure of the hall (the arena is half of it)
TORCHK = {1: 1.0, 2: 1.0, 3: 0.4, 4: 1.0, 5: 0.7, 6: 0.6, 7: 0.7, 8: 0.7, 9: 0.35, 10: 0.35}              # torch power scale
MOONK = {1: 1.0, 2: 1.0, 3: 0.3, 4: 0.9, 5: 0.6, 6: 0.5, 7: 0.6, 8: 0.7, 9: 0.3, 10: 0.3}              # moonlight scale
PSTYLE = {1: (12, 1.0), 2: (10, 0.8), 3: (8, 1.0), 4: (12, 0.9), 5: (16, 1.35), 6: (12, 1.0), 7: (4, 1.0), 8: (7, 0.9), 9: (10, 1.15), 10: (12, 1.0)}   # pillar sides, radius scale


def L(h, k):
    h = h.lstrip('#')
    return '#%02x%02x%02x' % tuple(min(255, int(int(h[i:i + 2], 16) * k)) for i in (0, 2, 4))


FOG = hexc(L(P_FOG, 0.69))
FOG_DENS = 0.012


# ------------------------------------------------------------------ materials
def fog_wrap(nt, shader_out, out_node):
    """mix toward the fog colour by view depth, so the far parts of the hall sit back in haze (baked per object, so it survives the layer split)"""
    cam = nt.nodes.new('ShaderNodeCameraData')
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = -FOG_DENS
    ex = nt.nodes.new('ShaderNodeMath'); ex.operation = 'EXPONENT'
    inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0
    emi = nt.nodes.new('ShaderNodeEmission'); emi.inputs[0].default_value = FOG; emi.inputs[1].default_value = 0.55
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(cam.outputs['View Z Depth'], mul.inputs[0]); nt.links.new(mul.outputs[0], ex.inputs[0]); nt.links.new(ex.outputs[0], inv.inputs[1])
    nt.links.new(inv.outputs[0], mix.inputs[0]); nt.links.new(shader_out, mix.inputs[1]); nt.links.new(emi.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out_node.inputs['Surface'])


def new_mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    return m, nt, out


def stone(name, c1, c2, scale=1.0, rough=0.85, bump=0.5, bricks=None, moss=0.0):
    m, nt, out = new_mat(name)
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs[3].default_value = (scale,) * 3
    nt.links.new(tc.outputs['Object'], mp.inputs[0])
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3.0; nz.inputs['Detail'].default_value = 8; nz.inputs['Roughness'].default_value = 0.7
    nt.links.new(mp.outputs[0], nz.inputs['Vector'])
    vo = nt.nodes.new('ShaderNodeTexVoronoi'); vo.feature = 'F1'; vo.inputs['Scale'].default_value = 5.0
    nt.links.new(mp.outputs[0], vo.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = c1; ramp.color_ramp.elements[1].color = c2
    nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac'])
    base = ramp.outputs['Color']; height = nz.outputs['Fac']
    if bricks:
        br = nt.nodes.new('ShaderNodeTexBrick'); br.inputs['Scale'].default_value = bricks[0]
        br.inputs['Mortar Size'].default_value = 0.02; br.inputs['Brick Width'].default_value = bricks[1]; br.inputs['Row Height'].default_value = bricks[2]
        br.inputs['Color1'].default_value = c1; br.inputs['Color2'].default_value = c2; br.inputs['Mortar'].default_value = (0.01, 0.012, 0.016, 1)
        nt.links.new(mp.outputs[0], br.inputs['Vector'])
        mixc = nt.nodes.new('ShaderNodeMix'); mixc.data_type = 'RGBA'; mixc.blend_type = 'MULTIPLY'; mixc.inputs['Factor'].default_value = 0.6
        nt.links.new(br.outputs['Color'], mixc.inputs[6]); nt.links.new(ramp.outputs['Color'], mixc.inputs[7])
        base = mixc.outputs[2]
        add = nt.nodes.new('ShaderNodeMath'); add.operation = 'MULTIPLY'
        nt.links.new(br.outputs['Fac'], add.inputs[0]); nt.links.new(nz.outputs['Fac'], add.inputs[1]); height = add.outputs[0]
    bm = nt.nodes.new('ShaderNodeBump'); bm.inputs['Strength'].default_value = bump; bm.inputs['Distance'].default_value = 0.08
    nt.links.new(height, bm.inputs['Height'])
    pb = nt.nodes.new('ShaderNodeBsdfPrincipled'); pb.inputs['Roughness'].default_value = rough
    nt.links.new(base, pb.inputs['Base Color']); nt.links.new(bm.outputs['Normal'], pb.inputs['Normal'])
    if moss > 0:
        # moss creeps on up-facing surfaces and in the low spots
        geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(geo.outputs['Normal'], sep.inputs[0])
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs[1].default_value = 0.3; mr.inputs[2].default_value = 0.9
        nt.links.new(sep.outputs['Z'], mr.inputs[0])
        mr2 = nt.nodes.new('ShaderNodeMapRange'); mr2.inputs[1].default_value = 0.35; mr2.inputs[2].default_value = 0.65
        nt.links.new(vo.outputs['Distance'], mr2.inputs[0])
        mm = nt.nodes.new('ShaderNodeMath'); mm.operation = 'MULTIPLY'; mm.inputs[1].default_value = moss
        mul2 = nt.nodes.new('ShaderNodeMath'); mul2.operation = 'MULTIPLY'
        nt.links.new(mr.outputs[0], mul2.inputs[0]); nt.links.new(mr2.outputs[0], mul2.inputs[1]); nt.links.new(mul2.outputs[0], mm.inputs[0])
        mc = nt.nodes.new('ShaderNodeMix'); mc.data_type = 'RGBA'; mc.inputs[7].default_value = hexc('#2f4a2c')
        nt.links.new(mm.outputs[0], mc.inputs['Factor']); nt.links.new(base, mc.inputs[6]); nt.links.new(mc.outputs[2], pb.inputs['Base Color'])
    fog_wrap(nt, pb.outputs[0], out)
    return m


def emissive(name, color, strength, fogged=False):
    m, nt, out = new_mat(name)
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value = color; e.inputs[1].default_value = strength
    if fogged:
        fog_wrap(nt, e.outputs[0], out)
    else:
        nt.links.new(e.outputs[0], out.inputs['Surface'])
    return m


M_WALL = stone('wall', hexc(L(P_FAR, 1.25)), hexc(L(P_MID, 1.75)), 0.5, 0.9, 1.4, bricks=(1.6, 0.9, 0.5), moss=0.5)
M_PILLAR = stone('pillar', hexc(L(P_MID, 1.03)), hexc(L(P_MID, 1.7)), 0.6, 0.8, 0.5, bricks=(5.0, 1.0, 0.28), moss=0.35)
M_FLOOR = stone('floor', hexc(L(P_FAR, 0.93)), hexc(L(P_MID, 1.45)), 0.7, 0.55, 1.2, bricks=(0.9, 1.0, 0.6), moss=0.6)
M_ROCK = stone('rock', hexc(L(P_FAR, 1.12)), hexc(L(P_MID, 1.35)), 1.4, 0.95, 1.0, moss=0.8)
M_CEIL = stone('ceiling', hexc(L(P_SKY, 1.3)), hexc(L(P_FAR, 1.25)), 0.5, 0.95, 0.5)
M_GATE = (emissive('ember-glow', hexc('#5a2410'), 0.9) if CH == 1 else emissive('ember-glow', hexc(SKY[CH][0]), SKY[CH][1] * 0.8)) if ARENA else emissive('moonlit-sky', hexc(SKY[CH][0]), SKY[CH][1])
M_BAY = stone('bay', hexc(L(P_SKY, 0.9)), hexc(L(P_FAR, 1.15)), 0.8, 0.9, 1.0, bricks=(1.6, 0.9, 0.5))
M_FLAME = emissive('flame', hexc('#ffb040'), 14.0)
M_IRON = stone('iron', hexc('#16181c'), hexc('#2d3138'), 2.0, 0.5, 0.4)

# ------------------------------------------------------------------ geometry
groups = {'far': [], 'mid': [], 'floor': [], 'near': []}


def reg(g, o):
    groups[g].append(o)
    return o


def box(name, g, loc, size, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; o.scale = size
    o.data.materials.append(mat); bpy.ops.object.transform_apply(scale=True)
    return reg(g, o)


def cyl(name, g, loc, r, h, mat, verts=14, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; o.data.materials.append(mat)
    return reg(g, o)


def bevel(o, w=0.08, seg=2):
    m = o.modifiers.new('bev', 'BEVEL'); m.width = w; m.segments = seg; m.limit_method = 'ANGLE'


def rock(name, g, loc, s):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = s
    o.rotation_euler = Euler((random.random() * 3, random.random() * 3, random.random() * 3))
    tex = bpy.data.textures.new('rk' + name, 'CLOUDS'); tex.noise_scale = 0.9; tex.noise_depth = 3
    d = o.modifiers.new('disp', 'DISPLACE'); d.texture = tex; d.strength = 0.5; d.mid_level = 0.45
    o.data.materials.append(M_ROCK); bpy.ops.object.shade_flat()
    return reg(g, o)


ROOM_W = 60
box('floor', 'floor', (0, 12, -0.25) if 'void' in FEAT else (0, 20, -0.25), (16 if 'bridge' in FEAT else ROOM_W, 24 if 'void' in FEAT else 46, 0.5), M_FLOOR)
WALL_Y = 28.0
wall = box('backwall', 'far', (0, WALL_Y + 1.0, 7.5), (ROOM_W, 2.0, 15.0), M_WALL)


def cutter(name, x, w, h):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, WALL_Y + 1.0, h / 2))
    c = bpy.context.active_object; c.scale = (w, 4.0, h); c.name = name
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=w / 2, depth=4.0, location=(x, WALL_Y + 1.0, h), rotation=(math.pi / 2, 0, 0))
    a = bpy.context.active_object; a.name = name + 'arch'
    return [c, a]


cutters = []
for x in (-20, -12, 12, 20):
    cutters += cutter(f'bay{x}', x, 5.2, 7.0)
cutters += cutter('gate', 0, 10.0, 9.0)
for i, c in enumerate(cutters):
    m = wall.modifiers.new(f'cut{i}', 'BOOLEAN'); m.object = c; m.operation = 'DIFFERENCE'; m.solver = 'EXACT'
    c.hide_render = True; c.display_type = 'WIRE'
box('sky', 'far', (0, WALL_Y + 7.0, 6.0), (60, 0.2, 40), M_GATE)
for x in (-20, -12, 12, 20):
    box(f'bayback{x}', 'far', (x, WALL_Y + 3.0, 4.0), (7.0, 0.3, 9.0), M_BAY)
for i in range(9):
    rock(f'gaterock{i}', 'far', (random.uniform(-4.5, 4.5), WALL_Y - 1.0 + random.uniform(-1, 2.5), random.uniform(0.2, 1.4)), (random.uniform(0.7, 1.9), random.uniform(0.6, 1.4), random.uniform(0.5, 1.2)))
box('ceiling', 'far', (0, 16, 15.2), (ROOM_W, 40, 1.0), M_CEIL)

torches = []


def torch(g, x, y, z, color=None, power=3500):
    color = color or TORCH[CH]
    box(f'tb{x}{y}', g, (x, y, z - 0.35), (0.14, 0.14, 0.5), M_IRON)
    # no flame mesh: the game animates its own flame at the light's position (the light still lights the room)
    ld = bpy.data.lights.new(f'tl{x}{y}', 'POINT'); ld.energy = power * TORCHK[CH]; ld.color = color; ld.shadow_soft_size = 0.25
    lo = bpy.data.objects.new(f'tl{x}{y}', ld); lo.location = (x, y, z + 0.1); bpy.context.collection.objects.link(lo)
    torches.append(lo)


def pillar(g, x, y, r=1.0, h=12.5, broken=False):
    hh = h * (random.uniform(0.28, 0.5) if broken else 1.0)
    base = box(f'pb{x}{y}', g, (x, y, 0.4), (r * 2.9, r * 2.9, 0.8), M_PILLAR); bevel(base, 0.07)
    sh = cyl(f'ps{x}{y}', g, (x, y, 0.8 + hh / 2), r * PSTYLE[CH][1], hh, M_PILLAR, verts=PSTYLE[CH][0]); sh.rotation_euler = (0, 0, random.random()); bevel(sh, 0.04)
    if not broken:
        cap = box(f'pc{x}{y}', g, (x, y, 0.8 + hh + 0.4), (r * 2.6, r * 2.6, 0.9), M_PILLAR); bevel(cap, 0.08)
        box(f'rib{x}{y}', g, (x, y, 0.8 + hh + 1.2), (r * 1.6, 9.0, 1.2), M_CEIL)
    else:
        for i in range(4):
            rock(f'prub{x}{y}{i}', g, (x + random.uniform(-2.2, 2.2), y + random.uniform(-2, 2), random.uniform(0.2, 0.6)), (random.uniform(0.4, 1.0),) * 3)


for i, x in enumerate((-30, -22, -14, -7, 0, 7, 14, 22, 30)):
    if ARENA and x in (-7, 0, 7):
        continue          # keep the gate and its portcullis in view
    if 'bridge' in FEAT and abs(x) > 10:
        continue          # nothing stands in the abyss
    pillar('far', x, 22.0, 1.15, 13.0, broken=(i == 2))
if ARENA:
    # the boss room: pillars only at the edges, a ring dais in the middle, braziers and a portcullis in the gate
    for x in (-13.5, 13.5):
        pillar('mid', x, 13.5, 1.3, 13.0, broken=(x > 0))
    dais = cyl('dais', 'floor', (0, 17.0, 0.2), 9.5, 0.4, M_PILLAR, verts=40); bevel(dais, 0.08)
    cyl('dais2', 'floor', (0, 17.0, 0.45), 7.4, 0.12, M_FLOOR, verts=40)
    for x in (-8.5, 8.5):
        cyl(f'brz{x}', 'floor', (x, 15.0, 0.9), 0.18, 1.6, M_IRON, verts=8)
        bowl = cyl(f'bowl{x}', 'floor', (x, 15.0, 1.9), 0.75, 0.5, M_IRON, verts=16); bevel(bowl, 0.05)
        torch('floor', x, 15.0, 2.45, color=TORCH[CH], power=7000)
    for i in range(-5, 6):
        cyl(f'bar{i}', 'far', (i * 0.85, WALL_Y + 0.4, 4.6), 0.07, 9.0, M_IRON, verts=6)
    for k in (1.5, 4.0, 6.5):
        box(f'rail{k}', 'far', (0, WALL_Y + 0.4, k), (10.0, 0.14, 0.14), M_IRON)
elif 'bridge' in FEAT:
    for x in (-7.2, 7.2):
        pillar('mid', x, 13.5, 1.3, 13.0)
        torch('mid', x * 0.9, 11.9, 5.2)
elif 'void' in FEAT:
    for x in (-13.5, -3.2, 3.2):
        pillar('mid', x, 13.5, 1.3, 13.0, broken=(x != 3.2))
    torch('mid', 3.2, 11.9, 5.2)
else:
    for x in (-13.5, -3.2, 3.2):
        pillar('mid', x, 13.5, 1.3, 13.0)
    pillar('mid', 13.5, 13.5, 1.3, 13.0, broken=True)
    for x in (-3.2, 3.2):
        torch('mid', x, 11.9, 5.2)
for x in (-14.0, 14.0):
    torch('far', x, 21.0, 5.0)
for x in (-16.0, -6.5, 6.5, 16.0):
    torch('far', x, WALL_Y - 0.2, 5.5, power=3500 if ARENA else 9000)
for i in range(16):
    rock(f'floorrock{i}', 'floor', (random.uniform(-14, 14), random.uniform(6.5, 24), 0.0), (random.uniform(0.25, 0.8), random.uniform(0.25, 0.7), random.uniform(0.15, 0.5)))
pillar('near', -9.0, 0.5, 1.2, 12.0)
pillar('near', 9.4, 1.5, 1.2, 12.0, broken=True)
for i in range(6):
    rock(f'nearrock{i}', 'near', (random.choice((-1, 1)) * random.uniform(6.5, 11), random.uniform(-1, 3), 0.0), (random.uniform(0.5, 1.1),) * 3)
for i in range(7):
    x = random.uniform(-9, 9)
    bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=random.uniform(0.35, 0.8), radius2=0.02, depth=random.uniform(1.5, 3.5), location=(x, random.uniform(-1.0, 3.0), 12.5), rotation=(math.pi, 0, 0))
    o = bpy.context.active_object; o.data.materials.append(M_ROCK); reg('near', o)

# ------------------------------------------------------------------ chapter features
M_LAVA = emissive('lava', hexc('#ff5a10'), 3.5)
if 'water' in FEAT:
    m_, nt_, out_ = new_mat('water')
    pb_ = nt_.nodes.new('ShaderNodeBsdfPrincipled'); pb_.inputs['Base Color'].default_value = hexc('#06262a'); pb_.inputs['Roughness'].default_value = 0.04
    nt_.links.new(pb_.outputs[0], out_.inputs['Surface'])
    for i in range(7):
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=1.0, depth=0.05, location=(random.uniform(-15, 15), random.uniform(7, 25), 0.03))
        o = bpy.context.active_object; o.scale = (random.uniform(3.5, 7.5), random.uniform(1.8, 3.5), 1.0); o.data.materials.append(m_); reg('floor', o)
if 'lava' in FEAT:
    for i, x in enumerate((-12.5, -5.5, 6.5, 13.0)):
        box(f'lava{i}', 'floor', (x + random.uniform(-1, 1), 17.0, 0.02), (random.uniform(0.35, 0.8), 21.0, 0.05), M_LAVA, rot=(0, 0, random.uniform(-0.18, 0.18)))
        ld = bpy.data.lights.new(f'll{i}', 'AREA'); ld.energy = 1500; ld.color = (1.0, 0.45, 0.12); ld.shape = 'RECTANGLE'; ld.size = 0.8; ld.size_y = 16
        lo = bpy.data.objects.new(f'll{i}', ld); lo.location = (x, 17.0, 0.6); lo.rotation_euler = (0, 0, 0); bpy.context.collection.objects.link(lo)
if 'furnace' in FEAT:
    for x in (-24, 24):
        box(f'furnace{x}', 'far', (x, WALL_Y - 1.0, 3.2), (6.5, 3.0, 6.4), M_IRON)
        box(f'mouth{x}', 'far', (x, WALL_Y - 2.55, 2.2), (3.4, 0.2, 2.6), M_LAVA)
        torch('far', x, WALL_Y - 3.0, 2.2, color=TORCH[CH], power=6500)
if 'balcony' in FEAT:
    box('ledge', 'far', (0, WALL_Y - 0.9, 7.6), (58, 1.8, 0.5), M_PILLAR)
    for i in range(-14, 15):
        box(f'bal{i}', 'far', (i * 2.0, WALL_Y - 1.7, 8.3), (0.22, 0.22, 1.1), M_PILLAR)
    box('rail', 'far', (0, WALL_Y - 1.7, 8.9), (58, 0.25, 0.22), M_PILLAR)
if 'steps' in FEAT:
    for i in range(14):
        box(f'step{i}', 'far', (0, WALL_Y + 1.5 + i * 0.9, 0.35 * (i + 1)), (9.0, 0.95, 0.7 + 0.35 * i), M_PILLAR)
if 'banners' in FEAT:
    M_BANNER = stone('banner', hexc('#6a1620'), hexc('#a8283a'), 1.5, 0.9, 0.5)
    for x in (-26, -18, -10, -3.5, 3.5, 10, 18, 26):
        box(f'banner{x}', 'far', (x, WALL_Y - 0.15, 8.2), (1.9, 0.12, 6.5), M_BANNER)
        box(f'bandet{x}', 'far', (x, WALL_Y - 0.25, 8.2), (0.5, 0.06, 3.5), emissive(f'bg{x}', hexc('#d8b050'), 0.6))
if 'shelves' in FEAT:
    M_SHELF = stone('shelf', hexc('#241a2a'), hexc('#3e2e48'), 1.2, 0.9, 1.0)
    cols = [hexc(h) for h in ('#7a2430', '#2c4a7a', '#3a6a3a', '#8a6a24', '#5a2a7a', '#2a6a6a')]
    mats = [stone(f'bk{i}', c, c, 1.0, 0.8, 0.2) for i, c in enumerate(cols)]
    for x in range(-27, 28, 6):
        if abs(x) < 6:
            continue
        box(f'shelf{x}', 'far', (x, WALL_Y - 0.6, 6.5), (4.4, 1.0, 12.6), M_SHELF)
        for row in range(7):
            bx = x - 1.9
            while bx < x + 1.9:
                w = random.uniform(0.12, 0.3)
                box(f'bk{x}{row}{bx:.2f}', 'far', (bx + w / 2, WALL_Y - 1.15, 1.2 + row * 1.6 + 0.6), (w, 0.35, random.uniform(1.0, 1.35)), random.choice(mats))
                bx += w + 0.02
if 'crystals' in FEAT:
    M_CRY = emissive('crystal', hexc('#6a40c8'), 2.2)
    for i in range(14):
        x = random.uniform(-26, 26); y = random.choice((random.uniform(5, 8), random.uniform(23, 27)))
        bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=random.uniform(0.3, 0.7), radius2=0.03, depth=random.uniform(1.4, 3.8), location=(x, y, 0.8), rotation=(random.uniform(-0.3, 0.3), random.uniform(-0.3, 0.3), 0))
        o = bpy.context.active_object; o.data.materials.append(M_CRY); reg('floor' if y > 20 else 'near', o)
        if i % 3 == 0:
            ld = bpy.data.lights.new(f'cl{i}', 'POINT'); ld.energy = 900; ld.color = (0.65, 0.4, 1.0)
            lo = bpy.data.objects.new(f'cl{i}', ld); lo.location = (x, y, 1.6); bpy.context.collection.objects.link(lo)
if 'bridge' in FEAT:
    # the floor is a stone span; fire glows far below to either side
    box('abyss', 'floor', (0, 20, -5.0), (ROOM_W + 40, 80, 0.2), emissive('abyss', hexc('#ff4010'), 1.3))
    for sx in (-1, 1):
        for k in range(6):
            box(f'parapet{sx}{k}', 'floor', (sx * 8.3, 6 + k * 3.6, 0.9), (0.7, 2.6, 1.6), M_PILLAR)

# ------------------------------------------------------------------ light
moon = bpy.data.lights.new('moon', 'AREA'); moon.energy = (9000 if ARENA else 32000) * MOONK[CH]; moon.color = TORCH[CH] if ARENA else MOON[CH]; moon.shape = 'RECTANGLE'; moon.size = 9; moon.size_y = 11
mo = bpy.data.objects.new('moon', moon); mo.location = (0, WALL_Y + 4, 5.0); mo.rotation_euler = (math.radians(90 + 8), 0, math.radians(180)); bpy.context.collection.objects.link(mo)
world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
bgn = world.node_tree.nodes['Background']; bgn.inputs[0].default_value = (0.05, 0.075, 0.11, 1) if CH == 1 else hexc(L(P_FOG, 0.8)); bgn.inputs[1].default_value = 1.4

# ------------------------------------------------------------------ camera
cam_data = bpy.data.cameras.new('cam'); cam_data.lens = 30; cam_data.sensor_width = 36; cam_data.clip_end = 400
cam = bpy.data.objects.new('cam', cam_data); bpy.context.collection.objects.link(cam); scene.camera = cam
cam.location = (0, -12.0, 7.0); cam.rotation_euler = (math.radians(90 - 4.4), 0, 0)
cam_data.shift_y = 0.0

scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
dev = 'CPU'
for kind in ('OPTIX', 'CUDA'):
    try:
        prefs.compute_device_type = kind; prefs.get_devices()
        gpus = [d for d in prefs.devices if d.type == kind]
        if gpus:
            for d in prefs.devices:
                d.use = d.type == kind
            dev = kind
            break
    except Exception:
        pass
scene.cycles.device = 'GPU' if dev != 'CPU' else 'CPU'
c = scene.cycles; c.samples = SAMPLES; c.use_denoising = True; c.max_bounces = 5; c.sample_clamp_indirect = 5.0
try:
    c.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
scene.render.resolution_x = W; scene.render.resolution_y = H; scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'; scene.view_settings.exposure = EXPO[CH] * (0.5 if ARENA else 1.0)
print('render device', dev)

bpy.context.view_layer.update()
lights = []
for lo in torches:
    p = world_to_camera_view(scene, cam, lo.location)
    if 0 <= p.x <= 1 and 0 <= p.y <= 1:
        lights.append({'x': round(p.x * 960), 'y': round((1 - p.y) * 480), 'r': 150, 'color': '#%02x%02x%02x' % tuple(int(c * 255) for c in lo.data.color), 'flicker': 0.35})
json.dump(lights, open(os.path.join(OUT, 'lights.json'), 'w'))

for layer in groups:
    for g, objs in groups.items():
        for o in objs:
            o.is_holdout = (g != layer)
    scene.render.filepath = os.path.join(OUT, layer + '.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', layer)
