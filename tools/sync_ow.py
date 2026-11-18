#!/usr/bin/env python3
"""game.html の歩けるマップ部分を src/parts/overworld.js に書き写す(ずれを直す用)。"""
import pathlib
root = pathlib.Path(__file__).resolve().parent.parent
S = '/* ========== ミチクサ: 歩けるマップ ========== */'; E = '/* ========== ユーティリティ ========== */'
g = (root / 'src/game.html').read_text(encoding='utf-8'); a = g.index(S); b = g.index(E, a)
(root / 'src/parts/overworld.js').write_text(g[a:b].strip() + '\n', encoding='utf-8')
