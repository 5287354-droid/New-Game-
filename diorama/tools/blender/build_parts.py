"""ジオラマ魔物記: 魔物パーツを bpy で作り、assets/models/parts.glb に書き出す。

使い方:  python3 tools/blender/build_parts.py [出力パス]

規格(docs/ART_BIBLE.md と同じ):
- Blender 座標で -Y が正面、+Z が上。書き出すと three.js では +Z が正面、+Y が上になる
- 胴: body_<型>   空オブジェクト socket_head / socket_back / socket_tail を子に持つ
- パーツ: head_<種> / back_<種> / tail_<種>  原点がつなぎ目
- マテリアルのスロットは body / accent / eye の3つだけ。色と質感は実行時に素材ごとに塗る
- 目は全種共通: 半径 0.07 のガラス玉、左右の間隔 0.13、頭の正面の面に置く
"""
import math
import sys

import bpy

OUT = sys.argv[-1] if sys.argv[-1].endswith('.glb') else 'assets/models/parts.glb'

bpy.ops.wm.read_factory_settings(use_empty=True)
MATS = {}
for name, col in (('body', (0.8, 0.8, 0.8, 1)), ('accent', (0.3, 0.3, 0.3, 1)), ('eye', (0.05, 0.05, 0.05, 1))):
    m = bpy.data.materials.new(name)
    m.diffuse_color = col
    m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = col
    MATS[name] = m


def _sel(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def P(kind, loc=(0, 0, 0), scl=(1, 1, 1), rot=(0, 0, 0), mat='body', sub=0, bevel=0.0, seg=14,
      bend=0.0, taper=0.0, noise=0.0, minor=0.25):
    """プリミティブを1つ作り、モディファイアを適用して返す。"""
    if sub and kind in ('sphere', 'cyl', 'cone', 'torus'):
        seg = min(seg, 10)  # 細分割するものは元を粗くして三角形数を抑える
    if kind == 'sphere':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(6, seg // 2), radius=1)
    elif kind == 'ico':
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
    elif kind == 'cube':
        bpy.ops.mesh.primitive_cube_add(size=2)
    elif kind == 'cyl':
        bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=1, depth=2)
    elif kind == 'cone':
        bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=1, radius2=0, depth=2)
    elif kind == 'torus':
        bpy.ops.mesh.primitive_torus_add(major_segments=seg, minor_segments=8, major_radius=1, minor_radius=minor)
    elif kind == 'plane':
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=6, y_subdivisions=6, size=2)
    else:
        raise ValueError(kind)
    o = bpy.context.active_object
    o.scale = scl
    o.rotation_euler = [math.radians(a) for a in rot]
    o.location = loc
    o.data.materials.append(MATS[mat])
    if kind == 'plane':
        sol = o.modifiers.new('sol', 'SOLIDIFY')
        sol.thickness = 0.04
    if bevel:
        b = o.modifiers.new('bev', 'BEVEL')
        b.width = bevel
        b.segments = 2
        b.limit_method = 'ANGLE'
    if sub:
        s = o.modifiers.new('sub', 'SUBSURF')
        s.levels = sub
        s.render_levels = sub
    if taper:
        t = o.modifiers.new('tap', 'SIMPLE_DEFORM')
        t.deform_method = 'TAPER'
        t.factor = taper
        t.deform_axis = 'Z'
    if bend:
        t = o.modifiers.new('bend', 'SIMPLE_DEFORM')
        t.deform_method = 'BEND'
        t.angle = math.radians(bend)
        t.deform_axis = 'Z'
    if noise:
        tex = bpy.data.textures.new('n', 'CLOUDS')
        tex.noise_scale = 0.6
        d = o.modifiers.new('disp', 'DISPLACE')
        d.texture = tex
        d.strength = noise
        d.mid_level = 0.5
    _sel([o])
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    for mod in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


def eyes(y, z, x=0.13, r=0.07):
    """全種共通のガラス玉の目。y は頭の正面の面(マイナスが前)。"""
    out = []
    for sx in (-1, 1):
        out.append(P('sphere', (sx * x, y + r * 0.45, z), (r, r, r), mat='eye', seg=12))
    return out


def join(name, objs, socket_children=None):
    objs = [o for o in objs if o]
    _sel(objs)
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    bpy.ops.object.shade_smooth()
    # 多面体らしい物(折り紙など)は名前に _flat をつけて角を立てる
    if name.endswith('_flat'):
        bpy.ops.object.shade_flat()
        o.name = name[:-5]
        o.data.name = name[:-5]
    for sname, pos in (socket_children or {}).items():
        e = bpy.data.objects.new(sname, None)
        bpy.context.scene.collection.objects.link(e)
        e.empty_display_size = 0.1
        e.location = pos
        e.parent = o
    return o


# ------------------------------------------------------------------ 胴(体の型)
def bodies():
    # まる: ころんとした胴 + 小さな足
    join('body_maru', [
        P('sphere', (0, 0, 0.36), (0.42, 0.40, 0.36), sub=1),
        P('sphere', (-0.2, -0.05, 0.08), (0.13, 0.16, 0.09), mat='accent'),
        P('sphere', (0.2, -0.05, 0.08), (0.13, 0.16, 0.09), mat='accent'),
        P('sphere', (0, -0.33, 0.33), (0.2, 0.06, 0.18), mat='accent'),  # おなか
    ], {'socket_head': (0, -0.04, 0.66), 'socket_back': (0, 0.34, 0.42), 'socket_tail': (0, 0.38, 0.18)})
    # しずく: 下がふくらんだ雫。足なし
    join('body_shizuku', [
        P('sphere', (0, 0, 0.32), (0.4, 0.38, 0.32), sub=1),
        P('cone', (0, 0.02, 0.7), (0.3, 0.28, 0.25), sub=1),
        P('torus', (0, 0, 0.06), (0.36, 0.34, 0.5), mat='accent', minor=0.18, seg=20),
    ], {'socket_head': (0, -0.08, 0.72), 'socket_back': (0, 0.3, 0.42), 'socket_tail': (0, 0.36, 0.12)})
    # 四つ足: 横長の胴 + 4本の脚
    legs = []
    for lx in (-0.22, 0.22):
        for ly in (-0.3, 0.3):
            legs.append(P('cyl', (lx, ly, 0.16), (0.09, 0.09, 0.16), sub=1))
            legs.append(P('sphere', (lx, ly - 0.03, 0.03), (0.11, 0.13, 0.05), mat='accent'))
    join('body_yotsuashi', [P('sphere', (0, 0, 0.46), (0.34, 0.55, 0.28), sub=1)] + legs,
         {'socket_head': (0, -0.5, 0.62), 'socket_back': (0, 0.0, 0.72), 'socket_tail': (0, 0.55, 0.5)})
    # 鳥: たまご形 + 細い脚 + くちばし受け
    join('body_tori', [
        P('sphere', (0, 0, 0.48), (0.34, 0.38, 0.4), sub=1),
        P('cyl', (-0.12, 0, 0.12), (0.03, 0.03, 0.12), mat='accent'),
        P('cyl', (0.12, 0, 0.12), (0.03, 0.03, 0.12), mat='accent'),
        P('cube', (-0.12, -0.06, 0.02), (0.07, 0.1, 0.02), mat='accent', bevel=0.02),
        P('cube', (0.12, -0.06, 0.02), (0.07, 0.1, 0.02), mat='accent', bevel=0.02),
    ], {'socket_head': (0, -0.12, 0.84), 'socket_back': (0, 0.26, 0.58), 'socket_tail': (0, 0.38, 0.38)})
    # へび: 玉が5つつながって S 字に
    segs = []
    pts = [(0, -0.42, 0.34), (0.12, -0.18, 0.2), (0.0, 0.08, 0.16), (-0.14, 0.32, 0.14), (-0.04, 0.54, 0.11)]
    for i, p in enumerate(pts):
        r = 0.22 - i * 0.025
        segs.append(P('sphere', p, (r, r, r * 0.9), sub=1, mat='body' if i % 2 == 0 else 'accent', seg=8))
    join('body_hebi', segs, {'socket_head': (0, -0.5, 0.52), 'socket_back': (0.0, 0.06, 0.32), 'socket_tail': (-0.04, 0.66, 0.12)})
    # 人形: 胴 + 手足。しっぽのソケットは右手(手持ち)
    join('body_ningyo', [
        P('cyl', (0, 0, 0.42), (0.22, 0.18, 0.2), sub=1),
        P('sphere', (0, 0, 0.62), (0.24, 0.2, 0.07), mat='accent'),
        P('cyl', (-0.1, 0, 0.12), (0.075, 0.075, 0.13), sub=1, mat='accent'),
        P('cyl', (0.1, 0, 0.12), (0.075, 0.075, 0.13), sub=1, mat='accent'),
        P('cyl', (-0.3, 0, 0.42), (0.06, 0.06, 0.16), rot=(0, 20, 0), sub=1),
        P('cyl', (0.3, -0.04, 0.42), (0.06, 0.06, 0.16), rot=(-20, -20, 0), sub=1),
        P('sphere', (-0.35, 0, 0.27), (0.07, 0.07, 0.07), mat='accent'),
        P('sphere', (0.36, -0.1, 0.28), (0.07, 0.07, 0.07), mat='accent'),
    ], {'socket_head': (0, 0, 0.66), 'socket_back': (0, 0.2, 0.46), 'socket_tail': (0.36, -0.12, 0.28)})


# ------------------------------------------------------------------ 種ごとのパーツ
def nejiko():
    join('head_nejiko', [
        P('cyl', (0, 0, 0.26), (0.36, 0.34, 0.26), bevel=0.06, seg=20),
        P('torus', (0, 0, 0.52), (0.36, 0.34, 0.4), mat='accent', minor=0.12, seg=20),
        P('cyl', (0, 0, 0.56), (0.12, 0.12, 0.05), mat='accent'),
    ] + eyes(-0.34, 0.3))
    key = [P('cyl', (0, 0.12, 0), (0.05, 0.05, 0.12), rot=(90, 0, 0), mat='accent')]
    for sx in (-1, 1):
        key.append(P('sphere', (sx * 0.2, 0.26, 0.06), (0.18, 0.04, 0.13), mat='accent', sub=1))
    join('back_nejiko', key)
    join('tail_nejiko', [P('torus', (0, 0.06 + i * 0.06, 0.02 + i * 0.02), (0.08, 0.08, 0.2), rot=(90, 0, 0), mat='accent', minor=0.25, seg=12) for i in range(4)])


def perari():
    join('head_perari_flat', [
        P('cone', (0, 0, 0.3), (0.42, 0.34, 0.32), seg=4, rot=(0, 0, 45)),
        P('plane', (0.16, 0.1, 0.5), (0.22, 0.16, 1), rot=(30, -20, 0), mat='accent', bend=40),
    ] + eyes(-0.24, 0.22))
    join('back_perari_flat', [
        P('plane', (-0.18, 0.1, 0.1), (0.24, 0.16, 1), rot=(70, 0, 30), bend=60),
        P('plane', (0.18, 0.1, 0.1), (0.24, 0.16, 1), rot=(70, 0, -30), bend=60),
    ])
    join('tail_perari', [P('torus', (0, 0.16, 0.08), (0.16, 0.16, 0.3), rot=(0, 90, 0), mat='accent', minor=0.15, seg=16)])


def inky():
    join('head_inky', [
        P('sphere', (0, 0, 0.24), (0.38, 0.36, 0.28), sub=1),
        P('cyl', (0, 0, 0.5), (0.17, 0.17, 0.08)),
        P('cyl', (0, 0, 0.62), (0.13, 0.13, 0.07), mat='accent', bevel=0.02),
    ] + eyes(-0.34, 0.26))
    join('back_inky', [P('sphere', (0.12 * math.sin(i * 2.1), 0.08 + 0.04 * i, 0.06 + 0.1 * i), (0.09, 0.09, 0.12), mat='accent', sub=1) for i in range(3)])
    join('tail_inky', [P('sphere', (0, 0.18, 0.0), (0.2, 0.26, 0.05), mat='accent', sub=1),
                       P('sphere', (0.1, 0.42, 0.0), (0.08, 0.08, 0.03), mat='accent')])


def koroishi():
    join('head_koroishi', [P('ico', (0, 0, 0.24), (0.38, 0.34, 0.27), noise=0.08, sub=1)] + eyes(-0.33, 0.25))
    join('back_koroishi', [P('ico', (0.12 * (i - 1), 0.05, 0.08 + 0.05 * (i % 2)), (0.11, 0.1, 0.09), mat='accent', noise=0.04) for i in range(3)])
    join('tail_koroishi', [P('ico', (0, 0.08 + 0.14 * i, 0.02), (0.1 - i * 0.02,) * 3, mat='accent', noise=0.03) for i in range(3)])


def watabou():
    puffs = [P('sphere', (0.16 * math.cos(a), 0.14 * math.sin(a), 0.28 + 0.05 * math.sin(3 * a)), (0.2, 0.2, 0.18), seg=12)
             for a in [i * math.pi / 3 for i in range(6)]]
    join('head_watabou', puffs + [P('sphere', (0, 0, 0.38), (0.22, 0.22, 0.2), seg=12),
                                  P('cone', (0, -0.36, 0.22), (0.06, 0.08, 0.08), rot=(90, 0, 0), mat='accent')] + eyes(-0.32, 0.32))
    wing = []
    for sx in (-1, 1):
        for j in range(3):
            wing.append(P('sphere', (sx * (0.24 + 0.12 * j), 0.04, 0.12 + 0.06 * j), (0.14, 0.08, 0.12), seg=12))
    join('back_watabou', wing)
    join('tail_watabou', [P('sphere', (0.06 * (i - 1), 0.12, 0.04 * i), (0.1, 0.12, 0.1), seg=12, mat='accent') for i in range(3)])


def matchbo():
    join('head_matchbo', [
        P('sphere', (0, -0.04, 0.2), (0.3, 0.36, 0.26), sub=1),
        P('cone', (0, 0.02, 0.6), (0.18, 0.18, 0.26), mat='accent', sub=1, bend=25),
    ] + eyes(-0.38, 0.22))
    join('back_matchbo', [P('cube', (0, 0.0, 0.2), (0.035, 0.035, 0.24), rot=(0, a, 0), bevel=0.01) for a in (-30, 30)] +
         [P('sphere', (math.sin(math.radians(a)) * 0.24, 0, 0.42), (0.06, 0.06, 0.07), mat='accent') for a in (-30, 30)])
    join('tail_matchbo', [P('cube', (0, 0.14, 0.04), (0.04, 0.16, 0.04), bevel=0.01),
                          P('sphere', (0, 0.3, 0.04), (0.06, 0.06, 0.06), mat='accent', noise=0.02)])


def origarasu():
    join('head_origarasu_flat', [
        P('ico', (0, 0, 0.26), (0.3, 0.32, 0.3)),
        P('cone', (0, -0.42, 0.22), (0.1, 0.1, 0.2), seg=4, rot=(90, 0, 0), mat='accent'),
        P('cone', (0, 0.1, 0.56), (0.12, 0.06, 0.12), seg=3, rot=(-30, 0, 0)),
    ] + eyes(-0.27, 0.32))
    join('back_origarasu_flat', [P('cone', (sx * 0.34, 0.06, 0.12), (0.34, 0.1, 0.03), seg=3, rot=(0, sx * -15, sx * 90)) for sx in (-1, 1)])
    join('tail_origarasu_flat', [P('cone', (0.1 * (i - 1), 0.24, 0.06), (0.06, 0.2, 0.02), seg=3, rot=(90, 0, (i - 1) * 25), mat='accent') for i in range(3)])


def jarihebi():
    join('head_jarihebi', [
        P('sphere', (0, -0.08, 0.16), (0.28, 0.4, 0.17), noise=0.05, sub=1),
        P('cone', (0, -0.48, 0.12), (0.12, 0.08, 0.04), rot=(90, 0, 0), mat='accent'),
    ] + eyes(-0.3, 0.26, x=0.15))
    join('back_jarihebi', [P('cone', (0, -0.12 + 0.12 * i, 0.12), (0.07, 0.07, 0.13), mat='accent', seg=6) for i in range(3)])
    join('tail_jarihebi', [P('ico', (0, 0.1 + 0.1 * i, 0.08 * i), (0.07,) * 3, mat='accent', noise=0.02) for i in range(4)])


def felton():
    join('head_felton', [
        P('sphere', (0, 0, 0.3), (0.38, 0.36, 0.32), sub=1, noise=0.02),
        P('cone', (-0.2, 0.04, 0.62), (0.09, 0.07, 0.14), rot=(0, -20, 0), sub=1),
        P('cone', (0.2, 0.04, 0.62), (0.09, 0.07, 0.14), rot=(0, 20, 0), sub=1),
        P('torus', (0, -0.34, 0.14), (0.1, 0.05, 0.3), rot=(90, 0, 0), mat='accent', minor=0.3, seg=12),
    ] + eyes(-0.34, 0.34))
    join('back_felton', [P('cyl', (0, 0.06, 0.18), (0.025, 0.025, 0.3), rot=(-30, 30, 0), mat='accent'),
                         P('torus', (0.1, 0.12, 0.42), (0.05, 0.05, 0.05), rot=(0, 90, 0), mat='accent', minor=0.3, seg=10)])
    join('tail_felton', [P('sphere', (0, 0.16, 0.04), (0.14, 0.14, 0.14), mat='accent', noise=0.03, sub=1),
                         P('cyl', (0.0, 0.3, 0.0), (0.02, 0.02, 0.12), rot=(80, 0, 0), mat='accent')])


def hotarubin():
    join('head_hotarubin', [
        P('cyl', (0, 0, 0.26), (0.3, 0.3, 0.26), sub=1, seg=16),
        P('cyl', (0, 0, 0.6), (0.12, 0.12, 0.1)),
        P('cyl', (0, 0, 0.74), (0.1, 0.1, 0.06), mat='accent', bevel=0.02),
    ] + eyes(-0.3, 0.3))
    join('back_hotarubin', [P('sphere', (sx * 0.3, 0.06, 0.18), (0.28, 0.03, 0.14), rot=(0, sx * -30, sx * 15), mat='accent', sub=1) for sx in (-1, 1)])
    join('tail_hotarubin', [P('sphere', (0, 0.12, 0.0), (0.08, 0.1, 0.1), mat='accent', sub=1),
                            P('cone', (0, 0.22, 0.0), (0.04, 0.04, 0.08), rot=(-90, 0, 0), mat='accent')])


def zenmainu():
    join('head_zenmainu', [
        P('cube', (0, 0, 0.26), (0.28, 0.26, 0.24), bevel=0.08),
        P('cube', (0, -0.32, 0.18), (0.14, 0.12, 0.1), bevel=0.04),
        P('sphere', (0, -0.44, 0.22), (0.05, 0.04, 0.04), mat='accent'),
        P('cube', (-0.3, 0.04, 0.26), (0.04, 0.12, 0.2), rot=(0, 15, 0), mat='accent', bevel=0.03),
        P('cube', (0.3, 0.04, 0.26), (0.04, 0.12, 0.2), rot=(0, -15, 0), mat='accent', bevel=0.03),
    ] + eyes(-0.26, 0.34))
    join('back_zenmainu', [P('cyl', (0, 0, 0.12), (0.2, 0.2, 0.04), rot=(90, 0, 0), mat='accent', bevel=0.02, seg=12),
                           P('torus', (0, -0.02, 0.12), (0.14, 0.14, 0.5), rot=(90, 0, 0), minor=0.12, seg=16),
                           P('cyl', (0, 0, 0.0), (0.04, 0.04, 0.1))])
    join('tail_zenmainu', [P('cyl', (0, 0.14, 0.16), (0.025, 0.025, 0.18), rot=(-40, 0, 0), mat='accent'),
                           P('sphere', (0, 0.26, 0.3), (0.06,) * 3)])


def rousokun():
    drips = [P('sphere', (0.25 * math.cos(a), 0.25 * math.sin(a) - 0.02, 0.38 - 0.12 * ((i * 7) % 3) / 2), (0.06, 0.06, 0.12), seg=10) for i, a in enumerate([0.5, 1.9, 3.3, 4.6])]
    join('head_rousokun', [
        P('cyl', (0, 0, 0.24), (0.3, 0.3, 0.24), sub=1, seg=16),
        P('cyl', (0, 0, 0.52), (0.015, 0.015, 0.06), mat='accent'),
        P('sphere', (0, 0, 0.7), (0.1, 0.1, 0.17), mat='accent', sub=1),
    ] + drips + eyes(-0.3, 0.26))
    join('back_rousokun', [P('torus', (0, 0.06, 0.12), (0.2, 0.2, 0.3), rot=(90, 0, 0), mat='accent', minor=0.15, seg=16)])
    join('tail_rousokun', [P('sphere', (0, 0.14, 0.0), (0.12, 0.2, 0.05), sub=1)])


def tsumiking():
    crown = [P('cone', (0.12 * math.cos(a), 0.12 * math.sin(a), 0.62), (0.05, 0.05, 0.08), seg=4, mat='accent') for a in [i * math.pi / 2.5 for i in range(5)]]
    join('head_tsumiking_flat', [
        P('cube', (0, 0, 0.24), (0.3, 0.28, 0.24), bevel=0.03),
        P('cyl', (0, 0, 0.52), (0.16, 0.16, 0.04), mat='accent', seg=10),
    ] + crown + eyes(-0.28, 0.26))
    join('back_tsumiking_flat', [P('cube', (0, 0.06, 0.12), (0.18, 0.06, 0.12), bevel=0.02),
                                 P('cube', (0.05, 0.08, 0.32), (0.12, 0.05, 0.08), mat='accent', rot=(0, 0, 10), bevel=0.02)])
    join('tail_tsumiking_flat', [P('cyl', (0, 0, 0.12), (0.025, 0.025, 0.24), mat='accent'),
                                 P('cube', (0, 0, 0.38), (0.06, 0.06, 0.06), bevel=0.015)])


def kamishibai():
    join('head_kamishibai_flat', [
        P('cube', (0, 0.02, 0.3), (0.36, 0.06, 0.3), mat='accent', bevel=0.02),
        P('cube', (0, -0.05, 0.3), (0.28, 0.03, 0.22)),
        P('cube', (0, 0.0, 0.64), (0.12, 0.04, 0.05), mat='accent', bevel=0.01),
    ] + eyes(-0.1, 0.34))
    join('back_kamishibai', [P('cyl', (0, 0.06, 0.16), (0.07, 0.07, 0.26), rot=(0, 90, 0), sub=1),
                             P('cyl', (0, 0.06, 0.16), (0.03, 0.03, 0.34), rot=(0, 90, 0), mat='accent')])
    join('tail_kamishibai', [P('cube', (sx * 0.04, 0, 0.14), (0.025, 0.025, 0.16), rot=(0, sx * 10, 0), mat='accent', bevel=0.01) for sx in (-1, 1)])


def haribote():
    mane = [P('cube', (0, 0.06 + 0.07 * i, 0.5 - 0.04 * i), (0.03, 0.04, 0.08), mat='accent') for i in range(4)]
    join('head_haribote_flat', [
        P('cube', (0, -0.1, 0.3), (0.18, 0.34, 0.2), bevel=0.04, rot=(-25, 0, 0)),
        P('cone', (-0.12, 0.12, 0.56), (0.05, 0.04, 0.1), seg=4),
        P('cone', (0.12, 0.12, 0.56), (0.05, 0.04, 0.1), seg=4),
    ] + mane + eyes(-0.2, 0.42, x=0.15))
    join('back_haribote', [P('cube', (0, 0, 0.04), (0.28, 0.2, 0.04), mat='accent', bevel=0.03),
                           P('cube', (0, -0.14, 0.1), (0.1, 0.03, 0.06), bevel=0.02)])
    join('tail_haribote_flat', [P('plane', (0.06 * (i - 1), 0.2, -0.04 * i), (0.04, 0.2, 1), rot=(70, 0, (i - 1) * 15), mat='accent') for i in range(3)])


def hibachineko():
    join('head_hibachineko', [
        P('sphere', (0, 0, 0.28), (0.36, 0.32, 0.28), sub=1),
        P('cone', (-0.2, 0.02, 0.56), (0.1, 0.06, 0.14), rot=(0, -15, 0), sub=1),
        P('cone', (0.2, 0.02, 0.56), (0.1, 0.06, 0.14), rot=(0, 15, 0), sub=1),
        P('sphere', (0, -0.32, 0.2), (0.05, 0.03, 0.04), mat='accent'),
    ] + [P('cyl', (sx * 0.3, -0.26, 0.2 + dz), (0.008, 0.008, 0.14), rot=(0, 90, sx * 10), mat='accent') for sx in (-1, 1) for dz in (0, 0.05)]
         + eyes(-0.3, 0.32))
    join('back_hibachineko', [P('cyl', (0, 0, 0.12), (0.22, 0.22, 0.12), bevel=0.04, mat='accent', seg=16),
                              P('cyl', (0, 0, 0.25), (0.18, 0.18, 0.02))] +
         [P('ico', (0.08 * math.cos(a), 0.08 * math.sin(a), 0.3), (0.05,) * 3, mat='accent', noise=0.02) for a in (0, 2.1, 4.2)])
    join('tail_hibachineko', [P('torus', (0, 0.2, 0.18), (0.16, 0.16, 0.16), rot=(0, 90, 0), minor=0.22, seg=12),
                              P('sphere', (0, 0.22, 0.38), (0.07, 0.07, 0.11), mat='accent', sub=1)])


def nuihebi():
    join('head_nuihebi', [
        P('sphere', (0, -0.06, 0.2), (0.32, 0.4, 0.22), sub=1),
        P('cube', (0, -0.5, 0.12), (0.02, 0.1, 0.01), mat='accent'),
        P('cube', (0.12, 0.0, 0.42), (0.1, 0.1, 0.01), rot=(10, 0, 20), mat='accent'),
    ] + eyes(-0.34, 0.3))
    join('back_nuihebi', [P('cube', (0.05 * (i - 1), 0.04, 0.02 + 0.01 * i), (0.08, 0.08, 0.015), rot=(0, 0, 20 * i), mat='accent') for i in range(3)])
    join('tail_nuihebi', [P('cyl', (0, 0.08, 0.0), (0.04, 0.04, 0.08), rot=(90, 0, 0), mat='accent')] +
         [P('cyl', (0.02 * (i - 2), 0.22, -0.04), (0.012, 0.012, 0.1), rot=(70, 0, 0), mat='accent') for i in range(5)])


def burikishi():
    join('head_burikishi', [
        P('cyl', (0, 0, 0.28), (0.3, 0.3, 0.28), bevel=0.05, seg=16),
        P('sphere', (0, 0, 0.56), (0.3, 0.3, 0.14), sub=1),
        P('cube', (0, -0.3, 0.3), (0.2, 0.02, 0.025), mat='eye'),
        P('cone', (0, 0.06, 0.82), (0.05, 0.16, 0.2), rot=(-20, 0, 0), mat='accent', sub=1),
    ] + eyes(-0.3, 0.42, x=0.11, r=0.06))
    join('back_burikishi', [P('cyl', (0, 0.06, 0.18), (0.26, 0.26, 0.03), rot=(90, 0, 0), bevel=0.02, seg=18, mat='accent'),
                            P('sphere', (0, 0.02, 0.18), (0.08, 0.04, 0.08))])
    join('tail_burikishi', [P('cube', (0, 0, 0.38), (0.035, 0.012, 0.3), mat='accent', bevel=0.008),
                            P('cube', (0, 0, 0.06), (0.1, 0.03, 0.025)),
                            P('cyl', (0, 0, -0.02), (0.025, 0.025, 0.06))])


def kageboushi():
    join('head_kageboushi', [
        P('sphere', (0, 0, 0.2), (0.28, 0.26, 0.24), sub=1),
        P('cyl', (0, 0, 0.36), (0.56, 0.5, 0.025), mat='accent', seg=24),
        P('cone', (0, 0.04, 0.58), (0.26, 0.24, 0.24), mat='accent', bend=-20, sub=1),
    ] + eyes(-0.24, 0.2))
    join('back_kageboushi', [P('cone', (0, 0.12, 0.0), (0.4, 0.14, 0.36), rot=(180, 0, 0), sub=1),
                             P('torus', (0, 0.04, 0.32), (0.16, 0.1, 0.4), mat='accent', minor=0.2, seg=12)])
    join('tail_kageboushi', [P('cyl', (0, 0, 0.1), (0.008, 0.008, 0.12), mat='accent'),
                             P('cube', (0, 0, -0.06), (0.07, 0.07, 0.09), mat='accent', bevel=0.02),
                             P('sphere', (0, 0, -0.06), (0.05, 0.05, 0.06), mat='eye')])


def tokeimori():
    join('head_tokeimori', [
        P('sphere', (0, -0.1, 0.16), (0.36, 0.42, 0.16), sub=1),
        P('sphere', (-0.2, -0.02, 0.28), (0.12, 0.12, 0.12), sub=1),
        P('sphere', (0.2, -0.02, 0.28), (0.12, 0.12, 0.12), sub=1),
        P('cube', (0, -0.48, 0.1), (0.2, 0.02, 0.01), mat='accent'),
    ] + eyes(-0.06, 0.3, x=0.2, r=0.07))
    join('back_tokeimori', [P('cyl', (0, 0, 0.04), (0.32, 0.32, 0.04), mat='accent', bevel=0.02, seg=24),
                            P('cyl', (0, 0, 0.09), (0.28, 0.28, 0.01), seg=24),
                            P('cube', (0, -0.08, 0.11), (0.015, 0.14, 0.01), mat='eye'),
                            P('cube', (0.06, 0.0, 0.115), (0.1, 0.012, 0.01), mat='eye')] +
         [P('cube', (0.24 * math.sin(i * math.pi / 6), 0.24 * math.cos(i * math.pi / 6), 0.1), (0.015, 0.03, 0.01), rot=(0, 0, -i * 30), mat='accent') for i in range(12)])
    join('tail_tokeimori', [P('sphere', (0.06 * math.sin(i), 0.12 + 0.16 * i, 0.12 - 0.03 * i), (0.12 - 0.02 * i, 0.12, 0.08 - 0.01 * i), seg=12) for i in range(5)])


bodies()
for fn in (nejiko, perari, inky, koroishi, watabou, matchbo, origarasu, jarihebi, felton, hotarubin, zenmainu,
           rousokun, tsumiking, kamishibai, haribote, hibachineko, nuihebi, burikishi, kageboushi, tokeimori):
    fn()

# 規格のチェック: 三角形数とマテリアルのスロット
tri_total = 0
for o in bpy.context.scene.objects:
    if o.type != 'MESH':
        continue
    o.data.calc_loop_triangles()
    n = len(o.data.loop_triangles)
    tri_total += n
    names = {m.name for m in o.data.materials}
    assert names <= {'body', 'accent', 'eye'}, (o.name, names)
    if n > 1800: print('BIG', o.name, n)
print('PARTS', len([o for o in bpy.context.scene.objects if o.type == 'MESH']), 'TRIS', tri_total)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True,
                          export_materials='EXPORT', export_normals=True)
print('WROTE', OUT)
