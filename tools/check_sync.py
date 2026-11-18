#!/usr/bin/env python3
"""game.html の「歩けるマップ」部分と src/parts/overworld.js が一致するか検査する。
使い方: python3 tools/check_sync.py   (一致で 0、ずれで 1 を返し、差分の先頭を表示)"""
import sys, difflib, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
START = '/* ========== ミチクサ: 歩けるマップ ========== */'
END = '/* ========== ユーティリティ ========== */'
g = (root / 'src/game.html').read_text(encoding='utf-8')
a = g.index(START); b = g.index(END, a)
html = g[a:b].strip().split('\n')
js = (root / 'src/parts/overworld.js').read_text(encoding='utf-8')
j = js.index(START)
e = js.find(END, j)
js = (js[j:e] if e >= 0 else js[j:]).strip().split('\n')
if html == js:
    print('check_sync: OK (%d lines)' % len(html)); sys.exit(0)
d = list(difflib.unified_diff(js, html, 'overworld.js', 'game.html', lineterm='', n=0))
print('check_sync: NG (%d diff lines)' % len(d)); print('\n'.join(x[:160] for x in d[:30])); sys.exit(1)
