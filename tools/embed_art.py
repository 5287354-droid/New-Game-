"""art/original/<魔生物id>.jpg|png をゲーム用に縮小し、src/game.html の ART に埋めこむ。
使いかた: python3 tools/embed_art.py
"""
import base64, io, os, re, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src', 'game.html')
ODIR = os.path.join(ROOT, 'art', 'original')
SIZE = 384
art = {}
for fn in sorted(os.listdir(ODIR)):
    sid, ext = os.path.splitext(fn)
    if ext.lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
        continue
    im = Image.open(os.path.join(ODIR, fn)).convert('RGB')
    w, h = im.size; s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((SIZE, SIZE), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=78, method=6)
    art[sid] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
s = open(SRC, encoding='utf8').read()
block = '/*ART-START*/const ART={' + ','.join(f"{k}:'{v}'" for k, v in art.items()) + '};/*ART-END*/'
if '/*ART-START*/' in s:
    s = re.sub(r'/\*ART-START\*/.*?/\*ART-END\*/', lambda m: block, s, flags=re.S)
else:
    k = '/* ========== 描画パーツ ========== */'
    assert s.count(k) == 1
    s = s.replace(k, block + '\n' + k)
open(SRC, 'w', encoding='utf8').write(s)
print('embedded', list(art), sum(len(v) for v in art.values()) // 1024, 'KB')
