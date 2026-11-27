"""ジオラマ魔物記: 魔物パーツを bpy で作り、assets/models/parts.glb に書き出す。

使い方:  python3 tools/blender/build_parts.py [出力パス.glb]
規格のチェック:  python3 tools/blender/check_parts.py   (結果は docs/FORGE.md と同じ表)

規格(docs/FORGE.md):
- Blender 座標で -Y が正面、+Z が上。書き出すと three.js では +Z が正面、+Y が上になる
- 胴: body_<型>  原点 = 足もとの中心。空オブジェクト socket_head_<型> / socket_back_<型> / socket_tail_<型> を子に持つ
  (GLTFLoader は名前の「.」を消すので、番号つきの名前は使わない。読む側は前方一致 socket_head で探す)
- パーツ: head_<種> / back_<種> / tail_<種>  原点 = つなぎ目(ソケットの位置に置く)
- マテリアルのスロットは body / accent / eye の3つだけ。色と質感は実行時に素材ごとに塗る(src/forge/forge.js)
- eye スロットは「目のガラス玉」だけに使う。全種共通: 半径 EYE_R の玉を左右 ±EYE_X に2つ、頭の正面
- 三角形: 胴 ≤ 1000、頭 ≤ 1300、背中 ≤ 900、しっぽ ≤ 700 → どんな組み合わせ(おさがり)でも 1体 ≤ 3900
- 何度流しても同じバイト列になる(面と頂点の順番を正規化、ハッシュの種を固定)
"""
import math
import os
import sys

# glTF 書き出しの中で使われる dict/set の順番を固定する(PYTHONHASHSEED は起動時にしか効かない)
if os.environ.get('PYTHONHASHSEED') != '0':
    os.environ['PYTHONHASHSEED'] = '0'
    os.execv(sys.executable, [sys.executable] + sys.argv)

import bpy  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = sys.argv[-1] if sys.argv[-1].endswith('.glb') else os.path.join(ROOT, 'assets', 'models', 'parts.glb')

EYE_R = 0.075   # 目のガラス玉の半径(全種共通)
EYE_X = 0.135   # 左右の間隔の半分
LIMITS = {'body': 1000, 'head': 1300, 'back': 900, 'tail': 700}

bpy.ops.wm.read_factory_settings(use_empty=True)
MATS = {}
for name, col in (('body', (0.8, 0.8, 0.8, 1)), ('accent', (0.3, 0.3, 0.3, 1)), ('eye', (0.05, 0.05, 0.05, 1))):
    m = bpy.data.materials.new(name)
    m.diffuse_color = col
    m.use_backface_culling = True   # → glTF の doubleSided: false
    MATS[name] = m
MAT_ORDER = ['body', 'accent', 'eye']


def _sel(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def P(kind, loc=(0, 0, 0), scl=(1, 1, 1), rot=(0, 0, 0), mat='body', sub=0, bevel=0.0, seg=16, rings=0,
      bend=0.0, taper=0.0, twist=0.0, noise=0.0, minor=0.25, minor_seg=8, depth=2.0):
    """プリミティブを1つ作り、モディファイアを適用して返す。"""
    if kind == 'sphere':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings or max(4, seg // 2), radius=1)
    elif kind == 'ico':
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=max(1, min(3, seg)), radius=1)
    elif kind == 'cube':
        bpy.ops.mesh.primitive_cube_add(size=2)
    elif kind == 'cyl':
        bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=1, depth=2)
    elif kind == 'cone':
        bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=1, radius2=0, depth=2)
    elif kind == 'frustum':
        bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=1, radius2=minor, depth=2)
    elif kind == 'torus':
        bpy.ops.mesh.primitive_torus_add(major_segments=seg, minor_segments=minor_seg, major_radius=1, minor_radius=minor)
    elif kind == 'plane':
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=4, y_subdivisions=4, size=2)
    else:
        raise ValueError(kind)
    o = bpy.context.active_object
    o.scale = scl
    o.rotation_euler = [math.radians(a) for a in rot]
    o.location = loc
    o.data.materials.append(MATS[mat])
    if kind == 'plane':
        sol = o.modifiers.new('sol', 'SOLIDIFY')
        sol.thickness = 0.035
        sol.offset = 0
    if bevel:
        b = o.modifiers.new('bev', 'BEVEL')
        b.width = bevel
        b.segments = 2
        b.limit_method = 'ANGLE'
    if sub:
        s = o.modifiers.new('sub', 'SUBSURF')
        s.levels = sub
        s.render_levels = sub
    for kindm, val in (('TAPER', taper), ('TWIST', twist), ('BEND', bend)):
        if val:
            t = o.modifiers.new(kindm, 'SIMPLE_DEFORM')
            t.deform_method = kindm
            if kindm == 'TAPER':
                t.factor = val
            else:
                t.angle = math.radians(val)
            t.deform_axis = 'Z'
    if noise:
        tex = bpy.data.textures.new('n', 'CLOUDS')
        tex.noise_scale = 0.5
        d = o.modifiers.new('disp', 'DISPLACE')
        d.texture = tex
        d.texture_coords = 'GLOBAL'
        d.strength = noise
        d.mid_level = 0.5
    _sel([o])
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    for mod in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


def ribbon(pts, w=0.05, h=0.022, mat='body', axis=(1, 0, 0)):
    """点の列に沿った四角い断面の帯(ゼンマイのうず巻きなど)。axis は帯の幅の向き。"""
    import mathutils
    A = mathutils.Vector(axis)
    verts, faces = [], []
    n = len(pts)
    for i, p in enumerate(pts):
        p = mathutils.Vector(p)
        t = (mathutils.Vector(pts[min(i + 1, n - 1)]) - mathutils.Vector(pts[max(i - 1, 0)])).normalized()
        nrm = t.cross(A).normalized()
        for sa, sb in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            verts.append(tuple(p + A * (sa * w / 2) + nrm * (sb * h / 2)))
    for i in range(n - 1):
        for k in range(4):
            a, b = i * 4 + k, i * 4 + (k + 1) % 4
            faces.append((a, b, b + 4, a + 4))
    faces.append((3, 2, 1, 0))
    faces.append(tuple((n - 1) * 4 + k for k in range(4)))
    me = bpy.data.meshes.new('ribbon')
    me.from_pydata(verts, [], faces)
    me.materials.append(MATS[mat])
    o = bpy.data.objects.new('ribbon', me)
    bpy.context.scene.collection.objects.link(o)
    return o


def eyes(y, z, tilt=0.0):
    """全種共通のガラス玉の目。y は頭の正面の面の位置(マイナスが前)、z は目の高さ。"""
    out = []
    for sx in (-1, 1):
        out.append(P('sphere', (sx * EYE_X, y + EYE_R * 0.35, z), (EYE_R, EYE_R, EYE_R), mat='eye', seg=12, rings=8))
    return out


def _q(v):
    r = round(v, 5)
    return 0.0 if r == 0 else r


def canon(o):
    """頂点と面の順番を、座標だけで決まる順に並べ直す(bpy の並列処理で順番が毎回変わるため)。"""
    me = o.data
    vs = [tuple(_q(c) for c in v.co) for v in me.vertices]
    polys = [(p.material_index, p.use_smooth, list(p.vertices)) for p in me.polygons]
    nb = [[] for _ in vs]
    for _, _, pv in polys:
        for i in pv:
            nb[i].extend(vs[j] for j in pv if j != i)
    order = sorted(range(len(vs)), key=lambda i: (vs[i], sorted(nb[i])))
    remap = {old: new for new, old in enumerate(order)}
    faces = []
    for mi, sm, pv in polys:
        f = [remap[i] for i in pv]
        k = f.index(min(f))
        f = f[k:] + f[:k]
        faces.append((mi, sm, f))
    faces.sort(key=lambda t: (t[0], t[2]))
    mats = [m for m in me.materials]
    nm = bpy.data.meshes.new(o.name + '_c')
    nm.from_pydata([vs[i] for i in order], [], [f for _, _, f in faces])
    for m in mats:
        nm.materials.append(m)
    for p, (mi, sm, _) in zip(nm.polygons, faces):
        p.material_index = mi
        p.use_smooth = sm
    nm.update()
    o.data = nm
    bpy.data.meshes.remove(me)
    nm.name = o.name


def join(name, objs, sockets=None, flat=False):
    objs = [o for o in objs if o]
    _sel(objs)
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.active_object
    # 原点を世界の原点にそろえる(= つなぎ目 / 足もと)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # マテリアルのスロットを body/accent/eye の順にそろえる(使っていないものは入れない)
    used = {o.data.materials[p.material_index].name for p in o.data.polygons}
    old = [m.name for m in o.data.materials]
    new = [n for n in MAT_ORDER if n in used]
    idx = {i: new.index(n) for i, n in enumerate(old) if n in new}
    pm = [idx[p.material_index] for p in o.data.polygons]
    o.data.materials.clear()
    for n in new:
        o.data.materials.append(MATS[n])
    for p, mi in zip(o.data.polygons, pm):
        p.material_index = mi
        p.use_smooth = not flat
    o.name = name
    canon(o)
    for kind, pos in (sockets or {}).items():
        e = bpy.data.objects.new('socket_%s_%s' % (kind, name.split('_', 1)[1]), None)
        bpy.context.scene.collection.objects.link(e)
        e.empty_display_size = 0.1
        e.parent = o
        e.location = pos   # 親の原点 = 世界の原点なので、そのまま世界の座標
    return o


# ================================================================== 胴(体の型)
def bodies():
    # まる: ころんとした胴 + 小さな足 + おなか
    join('body_maru', [
        P('sphere', (0, 0, 0.34), (0.42, 0.4, 0.34), seg=20, rings=10),
        P('sphere', (-0.2, -0.06, 0.07), (0.14, 0.17, 0.08), mat='accent', seg=10, rings=6),
        P('sphere', (0.2, -0.06, 0.07), (0.14, 0.17, 0.08), mat='accent', seg=10, rings=6),
        P('sphere', (0, -0.31, 0.3), (0.22, 0.08, 0.2), mat='accent', seg=14, rings=8),
        P('sphere', (-0.4, -0.04, 0.32), (0.08, 0.08, 0.12), seg=10, rings=6),  # 手
        P('sphere', (0.4, -0.04, 0.32), (0.08, 0.08, 0.12), seg=10, rings=6),
    ], {'head': (0, -0.02, 0.6), 'back': (0, 0.36, 0.38), 'tail': (0, 0.36, 0.14)})
    # しずく: 下がふくらみ、上がとがった雫 + すその輪
    join('body_shizuku', [
        P('sphere', (0, 0, 0.3), (0.4, 0.38, 0.3), seg=20, rings=12),
        P('frustum', (0, 0, 0.6), (0.33, 0.31, 0.16), minor=0.45, seg=20),
        P('torus', (0, 0, 0.07), (0.37, 0.35, 0.45), mat='accent', minor=0.2, seg=24),
    ], {'head': (0, -0.04, 0.74), 'back': (0, 0.32, 0.4), 'tail': (0, 0.36, 0.1)})
    # 四つ足: 横長の胴 + 4本の脚 + ひづめ
    legs = []
    for lx in (-0.21, 0.21):
        for ly in (-0.3, 0.3):
            legs.append(P('cyl', (lx, ly, 0.2), (0.085, 0.085, 0.18), seg=10))
            legs.append(P('sphere', (lx, ly - 0.03, 0.04), (0.11, 0.13, 0.055), mat='accent', seg=10, rings=6))
    join('body_yotsuashi', [P('sphere', (0, 0, 0.48), (0.33, 0.52, 0.27), seg=18, rings=10),
                            P('sphere', (0, -0.04, 0.38), (0.2, 0.36, 0.14), mat='accent', seg=12, rings=6)] + legs,
         {'head': (0, -0.48, 0.66), 'back': (0, 0.02, 0.72), 'tail': (0, 0.52, 0.52)})
    # 鳥: たまご形 + 細い脚 + 水かき
    join('body_tori', [
        P('sphere', (0, 0, 0.48), (0.33, 0.37, 0.4), seg=20, rings=12),
        P('sphere', (0, -0.22, 0.44), (0.22, 0.14, 0.26), mat='accent', seg=12, rings=8),
        P('cyl', (-0.12, 0, 0.12), (0.03, 0.03, 0.12), mat='accent', seg=8),
        P('cyl', (0.12, 0, 0.12), (0.03, 0.03, 0.12), mat='accent', seg=8),
        P('cone', (-0.12, -0.08, 0.02), (0.1, 0.13, 0.02), mat='accent', seg=3, rot=(0, 0, 30)),
        P('cone', (0.12, -0.08, 0.02), (0.1, 0.13, 0.02), mat='accent', seg=3, rot=(0, 0, 30)),
    ], {'head': (0, -0.1, 0.84), 'back': (0, 0.24, 0.6), 'tail': (0, 0.36, 0.36)})
    # へび: 玉が5つつながって S 字に。頭の方を持ち上げる
    segs = []
    pts = [(0, -0.36, 0.36), (0.13, -0.14, 0.22), (0.0, 0.1, 0.16), (-0.15, 0.32, 0.13), (-0.05, 0.52, 0.1)]
    for i, p in enumerate(pts):
        r = 0.22 - i * 0.026
        segs.append(P('sphere', p, (r, r, r * 0.88), mat='body' if i % 2 == 0 else 'accent', seg=14, rings=8))
    join('body_hebi', segs, {'head': (0, -0.46, 0.54), 'back': (0.0, 0.1, 0.3), 'tail': (-0.06, 0.62, 0.1)})
    # 人形: 胴 + 手足。しっぽのソケットは右手(手持ち)
    join('body_ningyo', [
        P('frustum', (0, 0, 0.42), (0.24, 0.19, 0.22), minor=0.8, seg=14),
        P('sphere', (0, 0, 0.63), (0.25, 0.21, 0.07), mat='accent', seg=14, rings=6),
        P('cyl', (-0.1, 0, 0.12), (0.075, 0.075, 0.13), mat='accent', seg=10),
        P('cyl', (0.1, 0, 0.12), (0.075, 0.075, 0.13), mat='accent', seg=10),
        P('sphere', (-0.1, -0.04, 0.02), (0.09, 0.12, 0.04), seg=10, rings=6),
        P('sphere', (0.1, -0.04, 0.02), (0.09, 0.12, 0.04), seg=10, rings=6),
        P('cyl', (-0.3, 0, 0.44), (0.06, 0.06, 0.16), rot=(0, 20, 0), seg=10),
        P('cyl', (0.3, -0.04, 0.42), (0.06, 0.06, 0.16), rot=(-20, -20, 0), seg=10),
        P('sphere', (-0.35, 0, 0.28), (0.075, 0.075, 0.075), mat='accent', seg=10, rings=6),
        P('sphere', (0.36, -0.1, 0.28), (0.075, 0.075, 0.075), mat='accent', seg=10, rings=6),
    ], {'head': (0, 0, 0.68), 'back': (0, 0.2, 0.46), 'tail': (0.36, -0.12, 0.28)})


# ================================================================== 種ごとのパーツ
# 64px でも見分けるための「決め手の形」を、種ごとに1つずつ持たせる(docs/FORGE.md の表)
def nejiko():
    # 決め手: 横に大きく張り出した、ねじ巻きの鍵(背中)
    join('head_nejiko', [
        P('cyl', (0, 0, 0.27), (0.37, 0.35, 0.27), bevel=0.05, seg=20),
        P('torus', (0, 0, 0.47), (0.37, 0.35, 0.5), mat='accent', minor=0.1, seg=20, minor_seg=6),
        P('torus', (0, 0, 0.05), (0.37, 0.35, 0.5), mat='accent', minor=0.1, seg=20, minor_seg=6),
        P('cyl', (0, 0, 0.58), (0.1, 0.1, 0.06), mat='accent', seg=6, bevel=0.015),  # 六角ボルト
    ] + eyes(-0.35, 0.28))
    key = [P('cyl', (0, 0.12, 0.02), (0.045, 0.045, 0.13), rot=(90, 0, 0), mat='accent', seg=10)]
    for sx in (-1, 1):
        key.append(P('torus', (sx * 0.24, 0.26, 0.1), (0.2, 0.2, 0.3), rot=(90, 0, 0), mat='accent', minor=0.35, seg=16, minor_seg=6))
    key.append(P('sphere', (0, 0.26, 0.1), (0.07, 0.05, 0.07), mat='accent', seg=10, rings=6))
    join('back_nejiko', key)
    join('tail_nejiko', [P('torus', (0, 0.05 + i * 0.065, 0.04 + i * 0.03), (0.09, 0.09, 0.22), rot=(90, 0, 0), mat='accent', minor=0.28, seg=10, minor_seg=6) for i in range(4)])


def perari():
    # 決め手: とがった紙のテント形の頭と、はね上がった角の折り返し
    join('head_perari', [
        P('cone', (0, 0, 0.36), (0.44, 0.38, 0.36), seg=4, rot=(0, 0, 45)),
        P('plane', (0.2, 0.06, 0.62), (0.2, 0.14, 1), rot=(40, -30, 10), mat='accent', bend=50),
    ] + eyes(-0.2, 0.2), flat=True)
    join('back_perari', [
        P('plane', (-0.22, 0.08, 0.16), (0.26, 0.16, 1), rot=(70, 10, 35), bend=70),
        P('plane', (0.22, 0.08, 0.16), (0.26, 0.16, 1), rot=(70, -10, -35), bend=70),
    ], flat=True)
    join('tail_perari', [P('plane', (0, 0.2, 0.0), (0.07, 0.24, 1), rot=(20, 0, 0), mat='accent', bend=-90, twist=30),
                         P('cone', (0, 0.42, -0.08), (0.07, 0.04, 0.012), seg=3, rot=(0, 0, 90), mat='accent')], flat=True)


def inky():
    # 決め手: インク壺の首とふた(頭の上が細く立つ)
    join('head_inky', [
        P('sphere', (0, 0, 0.24), (0.38, 0.36, 0.26), seg=18, rings=10),
        P('cyl', (0, 0, 0.52), (0.16, 0.16, 0.08), seg=14),
        P('cyl', (0, 0, 0.66), (0.19, 0.19, 0.07), mat='accent', bevel=0.02, seg=14),
        P('sphere', (0.0, -0.3, 0.06), (0.16, 0.08, 0.06), mat='accent', seg=10, rings=6),  # たれたインク
    ] + eyes(-0.33, 0.26))
    join('back_inky', [P('sphere', (0.1 * math.sin(i * 2.1), 0.06 + 0.05 * i, 0.08 + 0.15 * i), (0.09 - 0.015 * i,) * 2 + (0.13 - 0.02 * i,), mat='accent', seg=12, rings=8, taper=-0.6) for i in range(3)])
    join('tail_inky', [P('cyl', (0, 0.14, 0.04), (0.035, 0.035, 0.14), rot=(80, 0, 0), seg=8),
                       P('cone', (0, 0.36, 0.08), (0.08, 0.08, 0.13), rot=(-80, 0, 0), mat='accent', seg=10)])


def koroishi():
    # 決め手: 横に平たく大きい、でこぼこの河原石の頭(上に何も立たない)
    join('head_koroishi', [P('ico', (0, 0, 0.2), (0.5, 0.44, 0.26), seg=2, noise=0.07)] + eyes(-0.41, 0.22))
    join('back_koroishi', [P('ico', (0.13 * (i - 1), 0.06 + 0.02 * (i % 2), 0.08 + 0.06 * (i % 2)), (0.12, 0.11, 0.1), mat='accent', seg=1, noise=0.03) for i in range(3)] +
         [P('sphere', (0, 0.03, 0.18), (0.18, 0.12, 0.05), mat='accent', seg=10, rings=5)])  # こけ
    join('tail_koroishi', [P('ico', (0.03 * i, 0.07 + 0.13 * i, 0.04 - 0.01 * i), (0.1 - i * 0.02,) * 3, mat='accent', seg=1, noise=0.02) for i in range(3)])


def watabou():
    # 決め手: 綿毛のかんむり(頭の上に放射状の玉)と、玉を連ねた綿のつばさ
    puffs = [P('sphere', (0.2 * math.cos(a), 0.18 * math.sin(a), 0.3), (0.16, 0.16, 0.15), seg=9, rings=6)
             for a in [i * math.pi / 3 + 0.3 for i in range(6)]]
    crown = [P('sphere', (0.12 * math.cos(a), 0.12 * math.sin(a), 0.6), (0.07, 0.07, 0.07), mat='accent', seg=6, rings=4)
             for a in [i * math.pi * 2 / 5 for i in range(5)]]
    join('head_watabou', puffs + crown + [P('sphere', (0, 0, 0.36), (0.26, 0.25, 0.24), seg=14, rings=8),
                                          P('cyl', (0, 0, 0.52), (0.015, 0.015, 0.08), mat='accent', seg=6),
                                          P('cone', (0, -0.34, 0.22), (0.07, 0.09, 0.09), rot=(90, 0, 0), mat='accent', seg=8)] + eyes(-0.3, 0.34))
    wing = []
    for sx in (-1, 1):
        for j in range(3):
            wing.append(P('sphere', (sx * (0.24 + 0.14 * j), 0.04, 0.16 + 0.09 * j), (0.15 - 0.02 * j, 0.09, 0.13 - 0.015 * j), seg=10, rings=6))
    join('back_watabou', wing)
    join('tail_watabou', [P('sphere', (0.07 * (i - 1), 0.12 + 0.03 * (i % 2), 0.05 * i), (0.1, 0.12, 0.1), seg=10, rings=6, mat='accent') for i in range(3)])


def matchbo():
    # 決め手: 縦に長いマッチの頭と、その上で燃える炎
    join('head_matchbo', [
        P('sphere', (0, -0.02, 0.26), (0.28, 0.3, 0.32), seg=16, rings=10),
        P('cone', (0, 0.0, 0.76), (0.17, 0.17, 0.26), mat='accent', seg=12, bend=30),
        P('sphere', (0, 0.0, 0.55), (0.14, 0.14, 0.12), mat='accent', seg=10, rings=6),
    ] + eyes(-0.28, 0.24))
    join('back_matchbo', [P('cube', (math.sin(math.radians(a)) * 0.16, 0.0, 0.2), (0.035, 0.035, 0.24), rot=(0, a, 0), bevel=0.01) for a in (-28, 0, 28)] +
         [P('sphere', (math.sin(math.radians(a)) * 0.38, 0, 0.44), (0.055, 0.055, 0.07), mat='accent', seg=8, rings=5) for a in (-28, 0, 28)])
    join('tail_matchbo', [P('cube', (0, 0.15, 0.04), (0.04, 0.17, 0.04), bevel=0.01),
                          P('sphere', (0, 0.33, 0.04), (0.06, 0.06, 0.06), mat='accent', seg=8, rings=5, noise=0.02)])


def origarasu():
    # 決め手: 左右に大きく広げた三角の折り羽と、長いくちばし
    join('head_origarasu', [
        P('ico', (0, 0, 0.26), (0.3, 0.32, 0.3), seg=1),
        P('cone', (0, -0.44, 0.22), (0.1, 0.1, 0.24), seg=4, rot=(90, 0, 0), mat='accent'),
        P('cone', (0, 0.12, 0.58), (0.13, 0.06, 0.14), seg=3, rot=(-35, 0, 0)),
    ] + eyes(-0.27, 0.32), flat=True)
    join('back_origarasu', [P('cone', (sx * 0.4, 0.08, 0.2), (0.42, 0.12, 0.03), seg=3, rot=(0, sx * -25, sx * 90)) for sx in (-1, 1)] +
         [P('cone', (sx * 0.24, 0.1, 0.12), (0.22, 0.1, 0.03), seg=3, rot=(0, sx * -5, sx * 90), mat='accent') for sx in (-1, 1)], flat=True)
    join('tail_origarasu', [P('cone', (0.11 * (i - 1), 0.26, 0.08), (0.07, 0.22, 0.02), seg=3, rot=(80, 0, (i - 1) * 28), mat='accent') for i in range(3)], flat=True)


def jarihebi():
    # 決め手: 平たい頭と、背中に並んだ砂利のとげ
    join('head_jarihebi', [
        P('sphere', (0, -0.1, 0.17), (0.3, 0.42, 0.18), seg=16, rings=10, noise=0.04),
        P('cone', (0, -0.52, 0.12), (0.12, 0.08, 0.04), rot=(90, 0, 0), mat='accent', seg=8),
        P('ico', (-0.16, 0.12, 0.3), (0.07,) * 3, mat='accent', seg=1),
        P('ico', (0.16, 0.12, 0.3), (0.07,) * 3, mat='accent', seg=1),
    ] + eyes(-0.32, 0.26))
    join('back_jarihebi', [P('cone', (0, -0.22 + 0.15 * i, 0.12), (0.075, 0.075, 0.16), mat='accent', seg=6) for i in range(4)])
    join('tail_jarihebi', [P('ico', (0, 0.1 + 0.1 * i, 0.06 * i), (0.07 + 0.01 * (i == 3),) * 3, mat='accent', seg=1, noise=0.02) for i in range(4)])


def felton():
    # 決め手: ななめに突き出たぬい針と糸の輪 + 頭の上の2つのぽんぽん
    join('head_felton', [
        P('sphere', (0, 0, 0.3), (0.38, 0.36, 0.32), seg=18, rings=10, noise=0.025),
        P('cyl', (-0.16, 0.0, 0.66), (0.02, 0.02, 0.08), rot=(0, -20, 0), mat='accent', seg=6),
        P('cyl', (0.16, 0.0, 0.66), (0.02, 0.02, 0.08), rot=(0, 20, 0), mat='accent', seg=6),
        P('sphere', (-0.2, 0.0, 0.76), (0.08, 0.08, 0.08), mat='accent', seg=10, rings=6),
        P('sphere', (0.2, 0.0, 0.76), (0.08, 0.08, 0.08), mat='accent', seg=10, rings=6),
    ] + eyes(-0.34, 0.32))
    join('back_felton', [P('cyl', (0.12, 0.08, 0.3), (0.025, 0.025, 0.36), rot=(-25, 35, 0), mat='accent', seg=8),
                         P('cone', (0.33, 0.24, 0.6), (0.025, 0.025, 0.06), rot=(-25, 35, 0), mat='accent', seg=8),
                         P('torus', (0.0, 0.0, 0.08), (0.08, 0.08, 0.08), rot=(0, 90, 0), mat='accent', minor=0.3, seg=10, minor_seg=6),
                         P('torus', (-0.12, 0.06, 0.24), (0.1, 0.1, 0.1), rot=(20, 70, 0), minor=0.1, seg=12, minor_seg=4)])
    join('tail_felton', [P('sphere', (0, 0.15, 0.06), (0.15, 0.15, 0.15), mat='accent', seg=12, rings=8, noise=0.03)])


def hotarubin():
    # 決め手: 背の高いびんの頭(コルク栓)と、うすいガラスの羽
    join('head_hotarubin', [
        P('cyl', (0, 0, 0.26), (0.28, 0.28, 0.26), bevel=0.08, seg=16),
        P('frustum', (0, 0, 0.6), (0.24, 0.24, 0.1), minor=0.5, seg=16),
        P('cyl', (0, 0, 0.74), (0.11, 0.11, 0.06), seg=12),
        P('cyl', (0, 0, 0.86), (0.1, 0.1, 0.07), mat='accent', bevel=0.02, seg=12),
    ] + eyes(-0.28, 0.3))
    join('back_hotarubin', [P('sphere', (sx * 0.3, 0.06, 0.24), (0.3, 0.025, 0.16), rot=(0, sx * -35, sx * 15), mat='accent', seg=14, rings=6) for sx in (-1, 1)] +
         [P('sphere', (sx * 0.22, 0.08, 0.08), (0.18, 0.02, 0.09), rot=(0, sx * 10, sx * 25), mat='accent', seg=12, rings=6) for sx in (-1, 1)])
    join('tail_hotarubin', [P('cyl', (0, 0.1, 0.02), (0.015, 0.015, 0.1), rot=(70, 0, 0), mat='accent', seg=6),
                            P('sphere', (0, 0.22, 0.08), (0.09, 0.09, 0.09), mat='accent', seg=12, rings=8)])


def zenmainu():
    # 決め手: 四角い犬の顔とたれ耳 + 背中に立つ大きなうず巻きゼンマイ
    join('head_zenmainu', [
        P('cube', (0, 0, 0.26), (0.27, 0.25, 0.23), bevel=0.07),
        P('cube', (0, -0.32, 0.18), (0.14, 0.12, 0.1), bevel=0.04),
        P('sphere', (0, -0.44, 0.23), (0.05, 0.04, 0.04), mat='accent', seg=8, rings=5),
        P('cube', (-0.3, 0.04, 0.18), (0.04, 0.12, 0.2), rot=(0, 25, 0), mat='accent', bevel=0.03),
        P('cube', (0.3, 0.04, 0.18), (0.04, 0.12, 0.2), rot=(0, -25, 0), mat='accent', bevel=0.03),
    ] + eyes(-0.25, 0.34))
    pts = []
    for i in range(46):
        a = i * 0.3
        r = 0.04 + 0.0115 * a
        pts.append((0.0, r * math.cos(a), 0.32 + r * math.sin(a)))
    join('back_zenmainu', [ribbon(pts, w=0.09, h=0.03, mat='accent'),
                           P('cyl', (0, 0, 0.32), (0.05, 0.05, 0.07), rot=(0, 90, 0), seg=10),
                           P('cyl', (0, 0, 0.14), (0.035, 0.035, 0.14), seg=8)])
    join('tail_zenmainu', [P('torus', (0, 0.06 + i * 0.05, 0.06 + i * 0.05), (0.05, 0.05, 0.16), rot=(45, 0, 0), mat='accent', minor=0.3, seg=8, minor_seg=4) for i in range(4)] +
         [P('sphere', (0, 0.3, 0.3), (0.06,) * 3, seg=8, rings=5)])


def rousokun():
    # 決め手: ずんぐり太いロウソクの頭と大きな炎 + 横に張り出した燭台の皿と取っ手(背中)
    drips = [P('sphere', (0.33 * math.cos(a), 0.33 * math.sin(a), 0.36 - 0.1 * (i % 3)), (0.065, 0.065, 0.15), seg=8, rings=6) for i, a in enumerate([0.4, 1.5, 2.6, 3.6, 4.6, 5.5])]
    join('head_rousokun', [
        P('cyl', (0, 0, 0.23), (0.34, 0.34, 0.23), seg=18),
        P('sphere', (0, 0, 0.46), (0.34, 0.34, 0.05), seg=18, rings=4),
        P('cyl', (0, 0, 0.53), (0.018, 0.018, 0.06), mat='accent', seg=6),
        P('sphere', (0, 0, 0.78), (0.15, 0.15, 0.24), mat='accent', seg=12, rings=8, taper=-0.8),
    ] + drips + eyes(-0.34, 0.24))
    join('back_rousokun', [P('cyl', (0, 0.0, 0.02), (0.3, 0.3, 0.025), rot=(90, 0, 0), mat='accent', seg=18, bevel=0.01),
                           P('torus', (0.34, 0.03, 0.06), (0.12, 0.12, 0.4), rot=(90, 0, 0), mat='accent', minor=0.25, seg=12, minor_seg=6)])
    join('tail_rousokun', [P('sphere', (0, 0.16, -0.02), (0.15, 0.22, 0.045), seg=12, rings=6),
                           P('sphere', (0.06, 0.3, -0.02), (0.07, 0.07, 0.03), seg=8, rings=4)])


def tsumiking():
    # 決め手: 立方体の頭とギザギザの冠 + 背中に積んだつみきの城
    crown = [P('cone', (0.14 * math.cos(a), 0.14 * math.sin(a), 0.6), (0.055, 0.055, 0.1), seg=4, mat='accent') for a in [i * math.pi / 2.5 for i in range(5)]]
    join('head_tsumiking', [
        P('cube', (0, 0, 0.25), (0.3, 0.28, 0.25), bevel=0.03),
        P('cyl', (0, 0, 0.52), (0.18, 0.18, 0.03), mat='accent', seg=10),
    ] + crown + eyes(-0.28, 0.26), flat=True)
    join('back_tsumiking', [P('cube', (0, 0.08, 0.12), (0.2, 0.08, 0.12), bevel=0.015),
                            P('cube', (-0.1, 0.08, 0.32), (0.07, 0.07, 0.08), mat='accent', bevel=0.015),
                            P('cube', (0.1, 0.08, 0.32), (0.07, 0.07, 0.08), mat='accent', bevel=0.015),
                            P('cone', (0, 0.08, 0.5), (0.1, 0.08, 0.1), seg=4, rot=(0, 0, 45))], flat=True)
    join('tail_tsumiking', [P('cyl', (0, 0, 0.14), (0.025, 0.025, 0.26), mat='accent', seg=8),
                            P('cube', (0, 0, 0.42), (0.065, 0.065, 0.065), bevel=0.015, rot=(0, 45, 45))], flat=True)


def kamishibai():
    # 決め手: 横に広くうすい紙芝居の枠の頭(上に取っ手)
    join('head_kamishibai', [
        P('cube', (0, 0.02, 0.3), (0.42, 0.07, 0.3), mat='accent', bevel=0.02),
        P('cube', (0, -0.05, 0.3), (0.34, 0.02, 0.23)),
        P('cube', (0, 0.0, 0.64), (0.14, 0.05, 0.04), mat='accent', bevel=0.01),
        P('cube', (-0.44, 0.0, 0.3), (0.03, 0.06, 0.22), mat='accent', bevel=0.01),
        P('cube', (0.44, 0.0, 0.3), (0.03, 0.06, 0.22), mat='accent', bevel=0.01),
    ] + eyes(-0.1, 0.34))
    join('back_kamishibai', [P('cyl', (0, 0.07, 0.18), (0.08, 0.08, 0.26), rot=(0, 90, 0), seg=12),
                             P('cyl', (0, 0.07, 0.18), (0.03, 0.03, 0.34), rot=(0, 90, 0), mat='accent', seg=8),
                             P('plane', (0, 0.12, 0.02), (0.24, 0.12, 1), rot=(80, 0, 0))])
    join('tail_kamishibai', [P('cube', (sx * 0.045, 0, 0.14), (0.028, 0.028, 0.17), rot=(0, sx * 12, 0), mat='accent', bevel=0.01) for sx in (-1, 1)])


def haribote():
    # 決め手: 上に長くのびた馬の顔と、たてがみ
    mane = [P('cube', (0, 0.1 + 0.07 * i, 0.62 - 0.07 * i), (0.035, 0.05, 0.09), mat='accent', rot=(-30, 0, 0)) for i in range(5)]
    join('head_haribote', [
        P('cube', (0, -0.06, 0.4), (0.17, 0.16, 0.26), bevel=0.05, rot=(-20, 0, 0)),
        P('cube', (0, -0.28, 0.24), (0.15, 0.2, 0.12), bevel=0.05),
        P('cone', (-0.11, 0.06, 0.72), (0.05, 0.04, 0.1), seg=4),
        P('cone', (0.11, 0.06, 0.72), (0.05, 0.04, 0.1), seg=4),
    ] + mane + eyes(-0.2, 0.48), flat=True)
    join('back_haribote', [P('cube', (0, 0, 0.04), (0.26, 0.2, 0.04), mat='accent', bevel=0.03),
                           P('cube', (0, -0.15, 0.1), (0.1, 0.03, 0.06), bevel=0.02),
                           P('cube', (0, 0.17, 0.08), (0.12, 0.03, 0.05), bevel=0.02)] +
         [P('cube', (sx * 0.27, 0, -0.12), (0.015, 0.05, 0.14), mat='accent') for sx in (-1, 1)])
    join('tail_haribote', [P('cyl', (0, 0.06, 0.0), (0.03, 0.03, 0.08), rot=(70, 0, 0), seg=8)] +
         [P('plane', (0.06 * (i - 1), 0.24, -0.06 - 0.03 * (i % 2)), (0.045, 0.18, 1), rot=(65, 0, (i - 1) * 18), mat='accent') for i in range(3)], flat=True)


def hibachineko():
    # 決め手: とがった猫耳とひげ + 背中の火鉢と炭
    join('head_hibachineko', [
        P('sphere', (0, 0, 0.28), (0.36, 0.32, 0.27), seg=18, rings=10),
        P('cone', (-0.21, 0.02, 0.58), (0.11, 0.07, 0.17), rot=(0, -18, 0), seg=8),
        P('cone', (0.21, 0.02, 0.58), (0.11, 0.07, 0.17), rot=(0, 18, 0), seg=8),
        P('cone', (-0.2, -0.03, 0.56), (0.06, 0.03, 0.1), rot=(0, -18, 0), mat='accent', seg=6),
        P('cone', (0.2, -0.03, 0.56), (0.06, 0.03, 0.1), rot=(0, 18, 0), mat='accent', seg=6),
        P('sphere', (0, -0.32, 0.2), (0.05, 0.03, 0.035), mat='accent', seg=8, rings=5),
    ] + [P('cyl', (sx * 0.34, -0.22, 0.17 + dz), (0.008, 0.008, 0.13), rot=(0, 90, sx * (10 + dz * 200)), mat='accent', seg=4) for sx in (-1, 1) for dz in (0, 0.05)]
         + eyes(-0.3, 0.3))
    join('back_hibachineko', [P('frustum', (0, 0, 0.12), (0.23, 0.23, 0.12), minor=0.8, bevel=0.03, mat='accent', seg=14),
                              P('cyl', (0, 0, 0.245), (0.18, 0.18, 0.01), seg=14)] +
         [P('ico', (0.08 * math.cos(a), 0.08 * math.sin(a), 0.28), (0.055,) * 3, mat='accent', seg=1, noise=0.02) for a in (0, 2.1, 4.2)] +
         [P('cone', (0, 0, 0.42), (0.08, 0.08, 0.13), seg=8, bend=20)])
    join('tail_hibachineko', [P('cyl', (sx * 0.04, 0.2, 0.18), (0.016, 0.016, 0.26), rot=(-50, sx * 6, 0), mat='accent', seg=6) for sx in (-1, 1)] +
         [P('torus', (0, 0.05, 0.05), (0.05, 0.05, 0.05), rot=(0, 90, 0), minor=0.35, seg=8, minor_seg=4)])


def nuihebi():
    # 決め手: まるい頭のつぎあてと縫い目、ふさふさの綿のしっぽ
    join('head_nuihebi', [
        P('sphere', (0, -0.06, 0.22), (0.33, 0.4, 0.24), seg=18, rings=10),
        P('cube', (0, -0.5, 0.14), (0.025, 0.1, 0.01), mat='accent'),
        P('cube', (0.14, 0.02, 0.44), (0.11, 0.11, 0.012), rot=(10, 0, 20), mat='accent'),
        P('cube', (-0.2, 0.1, 0.38), (0.07, 0.07, 0.012), rot=(-30, 30, 0), mat='accent'),
    ] + eyes(-0.36, 0.3))
    join('back_nuihebi', [P('cube', (0.06 * (i - 1), 0.04, 0.03 + 0.012 * i), (0.09, 0.09, 0.015), rot=(0, 0, 25 * i), mat='accent') for i in range(3)])
    join('tail_nuihebi', [P('cyl', (0, 0.07, 0.0), (0.045, 0.045, 0.07), rot=(90, 0, 0), mat='accent', seg=10)] +
         [P('sphere', (0.06 * math.cos(a), 0.22, 0.06 * math.sin(a)), (0.07, 0.1, 0.07), seg=8, rings=5) for a in [i * 2.1 for i in range(3)]])


def burikishi():
    # 決め手: 円筒のかぶとの羽かざり + 丸いたて + 長いけん
    join('head_burikishi', [
        P('cyl', (0, 0, 0.28), (0.3, 0.3, 0.28), bevel=0.05, seg=16),
        P('sphere', (0, 0, 0.56), (0.3, 0.3, 0.13), seg=16, rings=6),
        P('cube', (0, -0.3, 0.15), (0.18, 0.02, 0.025), mat='accent'),
        P('cone', (0, 0.1, 0.86), (0.05, 0.2, 0.24), rot=(-25, 0, 0), mat='accent', seg=8),
        P('cyl', (0, 0.0, 0.66), (0.03, 0.03, 0.06), mat='accent', seg=6),
    ] + eyes(-0.3, 0.36))
    join('back_burikishi', [P('cyl', (0, 0.06, 0.2), (0.28, 0.28, 0.03), rot=(90, 0, 0), bevel=0.02, seg=18, mat='accent'),
                            P('sphere', (0, 0.1, 0.2), (0.08, 0.04, 0.08), seg=10, rings=6),
                            P('cube', (0, 0.1, 0.2), (0.025, 0.012, 0.22)),
                            P('cube', (0, 0.1, 0.2), (0.22, 0.012, 0.025))])
    join('tail_burikishi', [P('cube', (0, 0, 0.42), (0.04, 0.012, 0.34), mat='accent', bevel=0.008),
                            P('cone', (0, 0, 0.8), (0.04, 0.012, 0.05), seg=4, rot=(0, 0, 45), mat='accent'),
                            P('cube', (0, 0, 0.07), (0.12, 0.03, 0.025)),
                            P('cyl', (0, 0, -0.02), (0.025, 0.025, 0.07), seg=8)])


def kageboushi():
    # 決め手: 大きなつばのとんがり帽子(いちばん横に広い頭)
    # 決め手: 横に広いつばと、ななめに折れた高いシルクハット(影の紳士)
    join('head_kageboushi', [
        P('sphere', (0, 0, 0.2), (0.27, 0.25, 0.23), seg=16, rings=10),
        P('cyl', (0, 0, 0.37), (0.56, 0.48, 0.02), mat='accent', seg=24, bend=8),
        P('frustum', (0.04, 0.04, 0.66), (0.24, 0.23, 0.3), minor=1.15, mat='accent', seg=16, bend=-28),
        P('cyl', (0, 0, 0.43), (0.255, 0.245, 0.04), seg=16),
    ] + eyes(-0.23, 0.2))
    join('back_kageboushi', [P('cone', (0, 0.12, 0.0), (0.42, 0.16, 0.38), rot=(180, 0, 0), seg=12),
                             P('torus', (0, 0.04, 0.32), (0.18, 0.12, 0.4), mat='accent', minor=0.22, seg=12, minor_seg=6)])
    join('tail_kageboushi', [P('plane', (0, 0.0, -0.18), (0.09, 0.2, 1), rot=(90, 0, 90), mat='accent', bend=40, twist=40),
                             P('sphere', (0, 0, 0.0), (0.06, 0.06, 0.06), seg=8, rings=5)])


def tokeimori():
    # 決め手: 平たいヤモリの顔(上に飛び出た目の台)+ 背中の大きな文字盤 + 振り子のしっぽ
    join('head_tokeimori', [
        P('sphere', (0, -0.14, 0.16), (0.36, 0.44, 0.15), seg=18, rings=10),
        P('sphere', (-EYE_X, -0.12, 0.27), (0.13, 0.12, 0.11), seg=12, rings=8),
        P('sphere', (EYE_X, -0.12, 0.27), (0.13, 0.12, 0.11), seg=12, rings=8),
        P('cube', (0, -0.55, 0.11), (0.2, 0.02, 0.01), mat='accent'),
    ] + eyes(-0.22, 0.3))
    ticks = [P('cube', (0.27 * math.sin(i * math.pi / 6), 0.27 * math.cos(i * math.pi / 6), 0.1), (0.016, 0.035, 0.01), rot=(0, 0, -i * 30), mat='accent') for i in range(12)]
    join('back_tokeimori', [P('cyl', (0, 0, 0.04), (0.36, 0.36, 0.04), mat='accent', bevel=0.02, seg=24),
                            P('cyl', (0, 0, 0.09), (0.31, 0.31, 0.01), seg=24),
                            P('cube', (0, -0.09, 0.11), (0.018, 0.15, 0.01), mat='accent'),
                            P('cube', (0.07, 0.0, 0.115), (0.11, 0.014, 0.01), mat='accent'),
                            P('cyl', (0, 0, 0.12), (0.03, 0.03, 0.02), mat='accent', seg=8)] + ticks)
    join('tail_tokeimori', [P('sphere', (0.05 * math.sin(i), 0.12 + 0.15 * i, 0.12 - 0.035 * i), (0.11 - 0.017 * i, 0.12, 0.075 - 0.01 * i), seg=10, rings=6) for i in range(5)] +
         [P('cyl', (0, 0.78, 0.0), (0.09, 0.09, 0.02), mat='accent', seg=12)])


bodies()
SPECIES = (nejiko, perari, inky, koroishi, watabou, matchbo, origarasu, jarihebi, felton, hotarubin, zenmainu,
           rousokun, tsumiking, kamishibai, haribote, hibachineko, nuihebi, burikishi, kageboushi, tokeimori)
for fn in SPECIES:
    fn()

# 使い終わった作業用のデータを消す(書き出しには出ないが、念のため)
for t in list(bpy.data.textures):
    bpy.data.textures.remove(t)

# 規格のチェック(くわしくは check_parts.py): 三角形数とマテリアルのスロット
tri_total = 0
bad = []
for o in sorted(bpy.context.scene.objects, key=lambda o: o.name):
    if o.type != 'MESH':
        continue
    o.data.calc_loop_triangles()
    n = len(o.data.loop_triangles)
    tri_total += n
    names = [m.name for m in o.data.materials]
    assert set(names) <= set(MAT_ORDER), (o.name, names)
    lim = LIMITS[o.name.split('_')[0]]
    if n > lim:
        bad.append((o.name, n, lim))
print('PARTS', len([o for o in bpy.context.scene.objects if o.type == 'MESH']), 'TRIS', tri_total)
for b in bad:
    print('OVER', *b)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True,
                          export_materials='EXPORT', export_normals=True, export_texcoords=False,
                          export_extras=False)
print('WROTE', OUT)
if bad:
    sys.exit(1)
