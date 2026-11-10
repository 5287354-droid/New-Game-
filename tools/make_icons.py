"""ミチクサ鉄道のアイコン: 夜の草むらと、ローカル線の電車(32pxのドット絵を拡大)"""
from PIL import Image, ImageDraw
import os, sys
out = sys.argv[1] if len(sys.argv) > 1 else 'icons'
os.makedirs(out, exist_ok=True)

def base(n=32, pad=0):
    im = Image.new('RGB', (n, n), '#0c1120'); d = ImageDraw.Draw(im)
    R = lambda x, y, w, h, c: d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)
    o = pad
    R(0, 0, n, n, '#141c36')
    for x, y in [(4, 4), (9, 2), (26, 6), (21, 3), (14, 7)]: R(x, y, 1, 1, '#c8d0f0')
    R(23 - o, 4 + o, 4, 4, '#f4f0d8'); R(24 - o, 4 + o, 3, 1, '#141c36')
    # 線路
    R(0, 20, n, 1, '#8a8a92'); R(0, 23, n, 1, '#8a8a92')
    for x in range(1, n, 4): R(x, 21, 2, 2, '#5a4030')
    # 電車(黄色い一両)
    R(5 + o, 12, 20 - 2 * o, 8, '#f2b13c'); R(5 + o, 18, 20 - 2 * o, 2, '#c88a1a'); R(6 + o, 11, 18 - 2 * o, 1, '#f2b13c')
    for x in range(7 + o, 23 - o, 5): R(x, 13, 3, 3, '#ffe9a8')
    R(5 + o, 16, 20 - 2 * o, 1, '#1b2133')
    R(8 + o, 20, 2, 2, '#1b2133'); R(20 - o, 20, 2, 2, '#1b2133')
    # 手前の草むら
    for x in range(0, n, 3):
        h = 4 + (x * 7) % 3
        R(x, n - h, 1, h, '#3e9a44'); R(x + 1, n - h + 1, 1, h - 1, '#2c7a36')
    R(0, n - 2, n, 2, '#2c7a36')
    for x, y in [(6, 25), (17, 27), (27, 24)]: R(x, y, 1, 1, '#e8ff8a')
    return im

for name, size, pad in [('icon-192.png', 192, 0), ('icon-512.png', 512, 0), ('apple-touch-icon.png', 180, 0)]:
    base().resize((size, size), Image.NEAREST).save(os.path.join(out, name))
# マスカブル: 余白を足して中央に
m = Image.new('RGB', (40, 40), '#141c36'); m.paste(base(), (4, 4)); m.resize((512, 512), Image.NEAREST).save(os.path.join(out, 'icon-maskable-512.png'))
print('icons ok')
