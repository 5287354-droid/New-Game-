"""parts.glb の規格を自動で調べる(Blender なしで動く。glb を直接読む)。

使い方:
  python3 tools/blender/check_parts.py              # 調べて表を出す(違反があれば終了コード 1)
  python3 tools/blender/check_parts.py --repro      # build_parts.py を2回流して、バイト列が同じかも確かめる
  python3 tools/blender/check_parts.py --write      # docs/FORGE.md の「自動チェック」の節を書きかえる

調べること:
  1. 全パーツの三角形数(胴 ≤1000・頭 ≤1300・背中 ≤900・しっぽ ≤700)
  2. マテリアルのスロットは body / accent / eye だけ。eye は頭のパーツだけ
  3. 目のガラス玉の規格: 頭ごとに左右2つ、半径 0.075・左右の間隔 ±0.135(誤差 0.004)
  4. 胴6型それぞれに socket_head / socket_back / socket_tail が1つずつ(名前に「.」なし)
  5. 20種それぞれに head_ / back_ / tail_ がある(data/monsters.json と照らす)
  6. 組み立て後の三角形数(20種)と、おさがりで一番重くなる組み合わせ ≤ 4000
"""
import hashlib
import json
import os
import struct
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
GLB = os.path.join(ROOT, 'assets', 'models', 'parts.glb')
LIMITS = {'body': 1000, 'head': 1300, 'back': 900, 'tail': 700}
TRI_LIMIT = 4000
EYE_R, EYE_X, TOL = 0.075, 0.135, 0.004
SLOTS = {'body', 'accent', 'eye'}
CTYPE = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def load(path):
    b = open(path, 'rb').read()
    assert b[:4] == b'glTF', 'glb ではない'
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack('<I', b[off:off + 4])[0]
    return j, b[off + 8:off + 8 + bl]


def accessor(j, binb, i):
    a = j['accessors'][i]
    v = j['bufferViews'][a['bufferView']]
    fmt, size = CTYPE[a['componentType']]
    n = NCOMP[a['type']]
    start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = v.get('byteStride', size * n)
    out = []
    for k in range(a['count']):
        o = start + k * stride
        out.append(struct.unpack('<' + fmt * n, binb[o:o + size * n]))
    return out


def check(path=GLB):
    j, binb = load(path)
    mats = [m['name'] for m in j.get('materials', [])]
    errors = []
    nodes = j['nodes']
    parts = {}     # name -> {tris, slots, eyes}
    sockets = {}   # body type -> [names]
    for n in nodes:
        name = n.get('name', '')
        if 'mesh' in n:
            if any(abs(t) > 1e-6 for t in n.get('translation', [0, 0, 0])):
                errors.append(f'{name}: 原点がつなぎ目(0,0,0)にない {n.get("translation")}')
            mesh = j['meshes'][n['mesh']]
            tris, slots, eye_pts = 0, set(), []
            for p in mesh['primitives']:
                cnt = j['accessors'][p['indices']]['count'] if 'indices' in p else j['accessors'][p['attributes']['POSITION']]['count']
                tris += cnt // 3
                mname = mats[p['material']] if 'material' in p else '(なし)'
                slots.add(mname)
                if mname == 'eye':
                    eye_pts += accessor(j, binb, p['attributes']['POSITION'])
            parts[name] = {'tris': tris, 'slots': sorted(slots), 'eye_pts': eye_pts}
            for c in n.get('children', []):
                cn = nodes[c].get('name', '')
                if cn.startswith('socket_'):
                    sockets.setdefault(name.replace('body_', ''), []).append(cn)
    # 1・2・3
    eyes = {}
    for name, p in sorted(parts.items()):
        kind = name.split('_')[0]
        if kind not in LIMITS:
            errors.append(f'{name}: 名前が規格外(body_/head_/back_/tail_)')
            continue
        if p['tris'] > LIMITS[kind]:
            errors.append(f'{name}: 三角形 {p["tris"]} > {LIMITS[kind]}')
        bad = set(p['slots']) - SLOTS
        if bad:
            errors.append(f'{name}: 規格外のマテリアル {sorted(bad)}')
        if 'eye' in p['slots'] and kind != 'head':
            errors.append(f'{name}: eye スロットは頭のパーツだけ')
        if kind == 'head':
            pts = p['eye_pts']
            if not pts:
                errors.append(f'{name}: 目のガラス玉がない')
                continue
            res = []
            for side in (-1, 1):
                q = [v for v in pts if v[0] * side > 0]
                if not q:
                    errors.append(f'{name}: 目が片方しかない')
                    continue
                lo = [min(v[i] for v in q) for i in range(3)]
                hi = [max(v[i] for v in q) for i in range(3)]
                r = max((hi[i] - lo[i]) / 2 for i in range(3))
                cx = (hi[0] + lo[0]) / 2
                res.append((round(r, 4), round(cx, 4), round((hi[1] + lo[1]) / 2, 3)))
                if abs(r - EYE_R) > TOL or abs(abs(cx) - EYE_X) > TOL:
                    errors.append(f'{name}: 目の規格はずれ 半径 {r:.3f} 位置 x {cx:.3f}')
            if len(res) == 2 and abs(res[0][2] - res[1][2]) > 1e-3:
                errors.append(f'{name}: 左右の目の高さがちがう')
            eyes[name] = res
    # 4
    for body, names in sorted(sockets.items()):
        for k in ('head', 'back', 'tail'):
            hit = [s for s in names if s.startswith('socket_' + k)]
            if len(hit) != 1:
                errors.append(f'body_{body}: socket_{k} が {len(hit)} 個')
        for s in names:
            if '.' in s:
                errors.append(f'body_{body}: ソケット名に「.」 {s}(GLTFLoader で消える)')
    # 5・6
    mons = json.load(open(os.path.join(ROOT, 'data', 'monsters.json'), encoding='utf-8'))
    species = mons['species']
    bodies = sorted(mons['bodies'])
    for b in bodies:
        if 'body_' + b not in parts:
            errors.append(f'body_{b} がない')
        if b not in sockets:
            errors.append(f'body_{b} にソケットがない')
    table = []
    for s in species:
        row = {'no': s['no'], 'id': s['id'], 'name': s['name'], 'body': s['body']}
        for k in ('head', 'back', 'tail'):
            nm = f'{k}_{s["id"]}'
            if nm not in parts:
                errors.append(f'{nm} がない')
                row[k] = 0
            else:
                row[k] = parts[nm]['tris']
        row['bodyTris'] = parts.get('body_' + s['body'], {}).get('tris', 0)
        row['total'] = row['bodyTris'] + row['head'] + row['back'] + row['tail']
        if row['total'] > TRI_LIMIT:
            errors.append(f'{s["id"]}: 組み立て後 {row["total"]} > {TRI_LIMIT}')
        table.append(row)
    mx = {k: max(parts[f'{k}_{s["id"]}']['tris'] for s in species if f'{k}_{s["id"]}' in parts) for k in ('head', 'back', 'tail')}
    worst = {b: parts.get('body_' + b, {}).get('tris', 0) + mx['head'] + mx['back'] + mx['tail'] for b in bodies}
    for b, w in worst.items():
        if w > TRI_LIMIT:
            errors.append(f'おさがりの最悪の組み合わせ body_{b}: {w} > {TRI_LIMIT}')
    return {'parts': parts, 'sockets': sockets, 'table': table, 'worst': worst, 'maxPart': mx, 'eyes': eyes,
            'errors': errors, 'bytes': os.path.getsize(path), 'sha256': hashlib.sha256(open(path, 'rb').read()).hexdigest(),
            'totalTris': sum(p['tris'] for p in parts.values())}


def repro():
    outs = []
    for i in (1, 2):
        out = f'/tmp/forge_repro_{i}.glb'
        subprocess.run([sys.executable, os.path.join(HERE, 'build_parts.py'), out], check=True, capture_output=True)
        outs.append(hashlib.sha256(open(out, 'rb').read()).hexdigest())
    return outs


def markdown(r, rep=None):
    L = []
    L.append(f'- 対象: `assets/models/parts.glb`  {r["bytes"]:,} バイト  sha256 `{r["sha256"][:16]}…`')
    L.append(f'- パーツ {len(r["parts"])} 個(胴6 + 20種×3)、三角形の合計 {r["totalTris"]:,}')
    if rep:
        L.append(f'- 2回ビルドしたバイト列: {"**同じ**" if rep[0] == rep[1] else "**ちがう**"}(`{rep[0][:12]}` / `{rep[1][:12]}`)')
    L.append(f'- 違反: **{len(r["errors"])} 件**' + ('' if not r['errors'] else ''))
    for e in r['errors']:
        L.append(f'  - {e}')
    L.append('')
    L.append('| No | 種 | 型 | 胴 | 頭 | 背中 | しっぽ | **組み立て後** |')
    L.append('|---:|---|---|---:|---:|---:|---:|---:|')
    for t in r['table']:
        L.append(f'| {t["no"]} | {t["name"]} | {t["body"]} | {t["bodyTris"]} | {t["head"]} | {t["back"]} | {t["tail"]} | **{t["total"]:,}** |')
    tot = sum(t['total'] for t in r['table'])
    L.append(f'| | 20体の合計 | | | | | | **{tot:,}** |')
    L.append('')
    L.append(f'おさがりで一番重くなる組み合わせ(その型の胴 + 頭の最大 {r["maxPart"]["head"]} + 背中の最大 {r["maxPart"]["back"]} + しっぽの最大 {r["maxPart"]["tail"]}):')
    L.append('')
    L.append('| 型 | ' + ' | '.join(r['worst']) + ' |')
    L.append('|---|' + '---:|' * len(r['worst']))
    L.append('| 最悪の△ | ' + ' | '.join(f'{v:,}' for v in r['worst'].values()) + ' |')
    L.append('')
    L.append('ソケット: ' + '、'.join(f'{b}({", ".join(sorted(s))})' for b, s in sorted(r['sockets'].items())))
    L.append('')
    L.append('全パーツの三角形とスロット:')
    L.append('')
    L.append('| パーツ | △ | スロット | パーツ | △ | スロット | パーツ | △ | スロット |')
    L.append('|---|---:|---|---|---:|---|---|---:|---|')
    items = sorted(r['parts'].items())
    for i in range(0, len(items), 3):
        cells = []
        for name, p in items[i:i + 3]:
            cells += [f'`{name}`', str(p['tris']), '/'.join(p['slots'])]
        cells += [''] * (9 - len(cells))
        L.append('| ' + ' | '.join(cells) + ' |')
    return '\n'.join(L)


if __name__ == '__main__':
    r = check()
    rep = repro() if '--repro' in sys.argv else None
    md = markdown(r, rep)
    print(md)
    if '--write' in sys.argv:
        p = os.path.join(ROOT, 'docs', 'FORGE.md')
        s = open(p, encoding='utf-8').read()
        a, b = '<!-- check_parts:begin -->', '<!-- check_parts:end -->'
        i, k = s.index(a) + len(a), s.index(b)
        open(p, 'w', encoding='utf-8').write(s[:i] + '\n' + md + '\n' + s[k:])
        print('wrote docs/FORGE.md')
    bad = bool(r['errors']) or (rep and rep[0] != rep[1])
    sys.exit(1 if bad else 0)
