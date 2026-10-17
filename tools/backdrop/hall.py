"""Chapter 1 'hall' backdrop, modelled and lit in Blender, rendered as four layers (far / mid / floor / near).
Run:  blender -b -P tools/backdrop/hall.py -- OUTDIR [samples] [width] [variant: hall | arena]
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
os.makedirs(OUT, exist_ok=True)
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def hexc(h, k=1.0):
    h = h.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return ((r ** 2.2) * k, (g ** 2.2) * k, (b ** 2.2) * k, 1.0)


FOG = hexc('#33404f')
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


M_WALL = stone('wall', hexc('#2b3641'), hexc('#5a6f84'), 0.5, 0.9, 1.4, bricks=(1.6, 0.9, 0.5), moss=0.5)
M_PILLAR = stone('pillar', hexc('#34414f'), hexc('#566a7e'), 0.6, 0.8, 0.5, bricks=(5.0, 1.0, 0.28), moss=0.35)
M_FLOOR = stone('floor', hexc('#1f2832'), hexc('#4a5e72'), 0.7, 0.55, 1.2, bricks=(0.9, 1.0, 0.6), moss=0.6)
M_ROCK = stone('rock', hexc('#262f39'), hexc('#44546a'), 1.4, 0.95, 1.0, moss=0.8)
M_CEIL = stone('ceiling', hexc('#171d25'), hexc('#2a3440'), 0.5, 0.95, 0.5)
M_GATE = emissive('ember-glow', hexc('#5a2410'), 0.9) if ARENA else emissive('moonlit-sky', hexc('#3d4f72'), 0.8)
M_BAY = stone('bay', hexc('#10161d'), hexc('#26313d'), 0.8, 0.9, 1.0, bricks=(1.6, 0.9, 0.5))
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
box('floor', 'floor', (0, 20, -0.25), (ROOM_W, 46, 0.5), M_FLOOR)
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
# the gate's sky shows only in the middle: darken everything beyond the gate's sides
for i in range(9):
    rock(f'gaterock{i}', 'far', (random.uniform(-4.5, 4.5), WALL_Y - 1.0 + random.uniform(-1, 2.5), random.uniform(0.2, 1.4)), (random.uniform(0.7, 1.9), random.uniform(0.6, 1.4), random.uniform(0.5, 1.2)))
box('ceiling', 'far', (0, 16, 15.2), (ROOM_W, 40, 1.0), M_CEIL)

torches = []


def torch(g, x, y, z, color=(1.0, 0.55, 0.2), power=3500):
    box(f'tb{x}{y}', g, (x, y, z - 0.35), (0.14, 0.14, 0.5), M_IRON)
    # no flame mesh: the game animates its own flame at the light's position (the light still lights the room)
    ld = bpy.data.lights.new(f'tl{x}{y}', 'POINT'); ld.energy = power; ld.color = color; ld.shadow_soft_size = 0.25
    lo = bpy.data.objects.new(f'tl{x}{y}', ld); lo.location = (x, y, z + 0.1); bpy.context.collection.objects.link(lo)
    torches.append(lo)


def pillar(g, x, y, r=1.0, h=12.5, broken=False):
    hh = h * (random.uniform(0.28, 0.5) if broken else 1.0)
    base = box(f'pb{x}{y}', g, (x, y, 0.4), (r * 2.9, r * 2.9, 0.8), M_PILLAR); bevel(base, 0.07)
    sh = cyl(f'ps{x}{y}', g, (x, y, 0.8 + hh / 2), r, hh, M_PILLAR, verts=12); sh.rotation_euler = (0, 0, random.random()); bevel(sh, 0.04)
    if not broken:
        cap = box(f'pc{x}{y}', g, (x, y, 0.8 + hh + 0.4), (r * 2.6, r * 2.6, 0.9), M_PILLAR); bevel(cap, 0.08)
        box(f'rib{x}{y}', g, (x, y, 0.8 + hh + 1.2), (r * 1.6, 9.0, 1.2), M_CEIL)
    else:
        for i in range(4):
            rock(f'prub{x}{y}{i}', g, (x + random.uniform(-2.2, 2.2), y + random.uniform(-2, 2), random.uniform(0.2, 0.6)), (random.uniform(0.4, 1.0),) * 3)


for i, x in enumerate((-30, -22, -14, -7, 0, 7, 14, 22, 30)):
    if ARENA and x in (-7, 0, 7):
        continue          # keep the gate and its portcullis in view
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
        torch('floor', x, 15.0, 2.45, color=(1.0, 0.42, 0.14), power=7000)
    for i in range(-5, 6):
        cyl(f'bar{i}', 'far', (i * 0.85, WALL_Y + 0.4, 4.6), 0.07, 9.0, M_IRON, verts=6)
    for k in (1.5, 4.0, 6.5):
        box(f'rail{k}', 'far', (0, WALL_Y + 0.4, k), (10.0, 0.14, 0.14), M_IRON)
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

# ------------------------------------------------------------------ light
moon = bpy.data.lights.new('moon', 'AREA'); moon.energy = 9000 if ARENA else 32000; moon.color = (1.0, 0.5, 0.3) if ARENA else (0.62, 0.78, 1.0); moon.shape = 'RECTANGLE'; moon.size = 9; moon.size_y = 11
mo = bpy.data.objects.new('moon', moon); mo.location = (0, WALL_Y + 4, 5.0); mo.rotation_euler = (math.radians(90 + 8), 0, math.radians(180)); bpy.context.collection.objects.link(mo)
world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
bgn = world.node_tree.nodes['Background']; bgn.inputs[0].default_value = (0.05, 0.075, 0.11, 1); bgn.inputs[1].default_value = 1.4

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
scene.view_settings.look = 'None'; scene.view_settings.exposure = 0.45 if ARENA else 0.9
print('render device', dev)

bpy.context.view_layer.update()
lights = []
for lo in torches:
    p = world_to_camera_view(scene, cam, lo.location)
    if 0 <= p.x <= 1 and 0 <= p.y <= 1:
        lights.append({'x': round(p.x * 960), 'y': round((1 - p.y) * 480), 'r': 150, 'color': '#ffc86a', 'flicker': 0.35})
json.dump(lights, open(os.path.join(OUT, 'lights.json'), 'w'))

for layer in groups:
    for g, objs in groups.items():
        for o in objs:
            o.is_holdout = (g != layer)
    scene.render.filepath = os.path.join(OUT, layer + '.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', layer)
