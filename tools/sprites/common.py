"""Shared Blender helpers for the sprite prototype: a posable stylised character built from primitives, a toon-ish light rig,
an inverted-hull outline, and an orthographic side camera framed like the game's 72x92 sprite cell.
Run inside Blender:  blender -b -P script.py -- OUTDIR [width]"""
import bpy, math, os, sys
from mathutils import Vector, Euler


def args():
    return sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def hexc(h, k=1.0):
    h = h.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return ((r ** 2.2) * k, (g ** 2.2) * k, (b ** 2.2) * k, 1.0)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


MATS = {}


def mat(name, color, rough=0.7, emit=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = hexc(color); b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = hexc(color); b.inputs['Emission Strength'].default_value = emit
    MATS[name] = m
    return m


def _finish(o, m, parent, name, smooth=True):
    o.name = name
    o.data.materials.append(m)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    if parent is not None:
        o.parent = parent
    return o


def sphere(name, loc, scale, m, parent=None, seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1.0, location=loc)
    o = bpy.context.active_object; o.scale = scale
    return _finish(o, m, parent, name)


def cyl(name, loc, r, h, m, parent=None, rot=(0, 0, 0), verts=20, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=h, location=loc, rotation=rot)
    return _finish(bpy.context.active_object, m, parent, name)


def box(name, loc, size, m, parent=None, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        md = o.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = 3
    return _finish(o, m, parent, name, smooth=bool(bevel))


def pivot(name, loc, parent=None):
    e = bpy.data.objects.new(name, None); e.location = loc; bpy.context.collection.objects.link(e)
    if parent is not None:
        e.parent = parent
    return e


def outline(objs, thickness=0.03, color='#0b0a10'):
    """inverted-hull outline: a copy pushed outward along its normals, back faces only, flat dark"""
    m = bpy.data.materials.new('outline'); m.use_nodes = True; m.use_backface_culling = True
    nt = m.node_tree; nt.nodes.clear()
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = hexc(color); em.inputs[1].default_value = 1.0
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); geo = nt.nodes.new('ShaderNodeNewGeometry'); mx = nt.nodes.new('ShaderNodeMixShader')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    # the flipped shell: only the faces that point away from the camera (the rim behind the figure) are drawn, back faces are clear
    nt.links.new(geo.outputs['Backfacing'], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs[0])
    for o in objs:
        if o.type != 'MESH':
            continue
        sol = o.modifiers.new('outline', 'SOLIDIFY'); sol.thickness = thickness; sol.offset = 1.0; sol.use_flip_normals = True
        sol.material_offset = len(o.data.materials)
        o.data.materials.append(m)


def lights(key=(1.0, 0.92, 0.8), fill=(0.55, 0.65, 1.0)):
    k = bpy.data.lights.new('key', 'SUN'); k.energy = 3.2; k.color = key
    ko = bpy.data.objects.new('key', k); bpy.context.collection.objects.link(ko)
    ko.rotation_euler = (math.radians(50), math.radians(-30), math.radians(-35))        # from the upper left, in front
    f = bpy.data.lights.new('fill', 'SUN'); f.energy = 1.1; f.color = fill
    fo = bpy.data.objects.new('fill', f); bpy.context.collection.objects.link(fo)
    fo.rotation_euler = (math.radians(70), math.radians(25), math.radians(140))
    w = bpy.data.worlds.new('w'); bpy.context.scene.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.5, 0.55, 0.65, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.9


def camera(frame_h=2.6, center_z=1.25, w=288, h=368, y=-12.0):
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = frame_h; cd.sensor_fit = 'VERTICAL'
    co = bpy.data.objects.new('cam', cd); bpy.context.collection.objects.link(co)
    co.location = (0, y, center_z); co.rotation_euler = (math.radians(90), 0, 0)
    sc = bpy.context.scene; sc.camera = co
    sc.render.resolution_x = w; sc.render.resolution_y = h; sc.render.film_transparent = True
    return co


def setup_render(samples=64):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
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
    sc.cycles.device = 'GPU' if dev != 'CPU' else 'CPU'
    sc.cycles.samples = samples; sc.cycles.use_denoising = False; sc.cycles.max_bounces = 3
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    sc.render.filter_size = 0.8
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    return dev


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
