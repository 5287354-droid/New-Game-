#!/usr/bin/env python3
"""統合版の新しい仕組み(天候・きらり・寄り道・みちくさ点・地域図鑑・負けの罰・流星石)のグラフ。
調整前(tools/sim/out_before)と調整後(tools/sim/out)を並べる。使い方: python3 tools/sim/plot2.py [after_dir] [before_dir] [png_dir]"""
import json, os, sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

HERE = os.path.dirname(os.path.abspath(__file__))
AFTER = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'out')
BEFORE = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'out_before')
PNG = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, '..', '..', 'docs', 'update', 'balance')
os.makedirs(PNG, exist_ok=True)
plt.rcParams.update({'figure.dpi': 110, 'axes.spines.top': False, 'axes.spines.right': False, 'axes.grid': True, 'grid.alpha': .25})
for f in ['Noto Sans CJK JP', 'Noto Sans JP', 'IPAexGothic', 'IPAGothic', 'TakaoPGothic', 'VL Gothic', 'DejaVu Sans']:
    if any(f == x.name for x in matplotlib.font_manager.fontManager.ttflist):
        plt.rcParams['font.family'] = f
        break
jp = plt.rcParams['font.family'][0] != 'DejaVu Sans'
L = (lambda a, b: a) if jp else (lambda a, b: b)
CB, CA = '#9aa5b1', '#e9a23b'


def load(d, n):
    p = os.path.join(d, n + '.json')
    return json.load(open(p))['result'] if os.path.exists(p) else None


def save(fig, n):
    fig.tight_layout(); fig.savefig(os.path.join(PNG, n + '.png')); plt.close(fig); print('saved', n)


# 1. 天候限定種に出会うまで
a, b = load(AFTER, 'wxfind'), load(BEFORE, 'wxfind')
if a and b:
    ks = list(a)
    fig, axs = plt.subplots(1, 2, figsize=(11, 4), sharey=True)
    for ax, mode, t in zip(axs, ['target', 'idle'], [L('天気を狙って行く(予報を見て時間を送る)', 'target the weather'), L('狙わず、その探索先で戦い続ける', 'idle (keep fighting)')]):
        w = .38
        for i, (d, c, lab) in enumerate([(b, CB, L('調整前', 'before')), (a, CA, L('調整後', 'after'))]):
            v = [min(600, (d[k][mode]['mle'] or 600)) for k in ks]
            ax.bar([j + (i - .5) * w for j in range(len(ks))], v, w, color=c, label=lab)
            for j, x in enumerate(v): ax.text(j + (i - .5) * w, x * 1.05, f'{x:.0f}', ha='center', fontsize=6)
        ax.set_yscale('log'); ax.set_xticks(range(len(ks))); ax.set_xticklabels([k.split('@')[0][:6] + ('\n' + k.split('@')[1][:4] if k.startswith('hoshi') else '') for k in ks], fontsize=7, rotation=20); ax.set_title(t, fontsize=9)
    axs[0].axhspan(.5, 10, color='gold', alpha=.2); axs[0].text(0, 8, L('目標 10分以内', 'target <=10 min'), fontsize=8)
    axs[1].axhspan(30, 90, color='gold', alpha=.2); axs[1].text(0, 70, L('目標 約1時間', 'target ~1 h'), fontsize=8)
    axs[0].set_ylabel(L('出会うまでの平均(分, 対数)', 'minutes to meet (log)')); axs[0].legend(fontsize=8)
    save(fig, 'weather_meet')

# 2. 寄り道ボーナス
a, b = load(AFTER, 'bonus'), load(BEFORE, 'bonus')
if a:
    fig, axs = plt.subplots(1, 3, figsize=(12, 3.8))
    for key, col in [('urayama_lv8', '#2a9d8f'), ('okumori_lv16', '#c8553d')]:
        ds = sorted(a[key], key=int)
        base = a[key]['0']
        axs[0].plot([int(d) for d in ds], [a[key][d]['expPerH'] / base['expPerH'] for d in ds], 'o-', color=col, label=key + ' ' + L('経験値', 'exp'))
        axs[0].plot([int(d) for d in ds], [a[key][d]['yenPerH'] / base['yenPerH'] for d in ds], 's--', color=col, label=key + ' ' + L('円', 'yen'))
    axs[0].plot(range(6), [1 + .1 * d for d in range(6)], 'k:', label=L('式 1+0.1×段', 'formula'))
    axs[0].axhspan(1.3, 1.5, color='gold', alpha=.25); axs[0].axhline(2, color='r', ls='--', lw=1); axs[0].set_xlabel(L('寄り道の段', 'detour stage')); axs[0].set_ylabel(L('段0に対する倍率(測定のゆれあり)', 'ratio vs stage 0')); axs[0].legend(fontsize=6); axs[0].set_ylim(.5, 2.3)
    axs[0].set_title(L('寄り道ボーナスの倍率(目標1.3-1.5倍, 2倍まで)', 'bonus ratio'), fontsize=9)
    for key, col in [('urayama_lv8', '#2a9d8f'), ('okumori_lv16', '#c8553d')]:
        ds = sorted(a[key], key=int)
        axs[1].plot([int(d) for d in ds], [a[key][d]['kPerH'] for d in ds], 'o-', color=col, label=key)
    axs[1].set_xlabel(L('寄り道の段', 'detour stage')); axs[1].set_ylabel(L('きらり/時(草むらで戦い続けた場合)', 'kirari / h (grinding)')); axs[1].legend(fontsize=7); axs[1].set_title(L('きらりを踏む回数/時', 'kirari hits / h'), fontsize=9)
    ks = [('aze_lv5', '0'), ('urayama_lv8', '0'), ('okumori_lv16', '0')]
    nn = [a[k][d]['shinyNPerH'] for k, d in ks]; kk = [a[k][d]['shinyKPerH'] for k, d in ks]; hh = [a[k][d]['shinyHPerH'] for k, d in ks]
    x = range(len(ks))
    axs[2].bar(x, nn, color='#7a8a99', label=L('通常', 'normal')); axs[2].bar(x, kk, bottom=nn, color='#e9a23b', label=L('きらり', 'kirari')); axs[2].bar(x, hh, bottom=[p + q for p, q in zip(nn, kk)], color='#5aa7ff', label=L('星降り', 'hoshi'))
    for i, k in enumerate(ks):
        tot = a[k[0]][k[1]]['shinyPerH']; axs[2].text(i, tot, f'{tot:.2f}', ha='center', va='bottom', fontsize=8)
    axs[2].axhspan(.5, 1, color='gold', alpha=.2); axs[2].set_xticks(list(x)); axs[2].set_xticklabels([k[0] for k in ks], fontsize=7); axs[2].legend(fontsize=7); axs[2].set_title(L('色違い/時(草むら100%・段0)', 'shiny / h'), fontsize=9)
    save(fig, 'bonus_kirari_shiny')

# 3. みちくさ点
a, b = load(AFTER, 'points'), load(BEFORE, 'points')
if a:
    fig, axs = plt.subplots(1, 2, figsize=(11, 3.8))
    c = a['cum']; axs[0].plot([0] + [x['t'] for x in c], [0] + [x['p'] for x in c], color=CA, lw=2)
    for pt, lab in [(300, L('才能のかけら 300', 'saino 300')), (2500, L('名人 2500', 'title 2500')), (3000, L('天賦の宝珠 3000', 'tenpu 3000'))]:
        axs[0].axhline(pt, color='gray', ls=':'); axs[0].text(0.05, pt + 40, lab, fontsize=7)
    axs[0].axhline(400, color='r', ls='--', lw=1); axs[0].text(0.05, 440, L('調整前の天賦 400', 'tenpu before 400'), fontsize=7, color='r')
    axs[0].axhspan(.7 * a['total'], .8 * a['total'], color='gold', alpha=.25)
    axs[0].set_xlabel(L('全マップを順に歩き切った経過時間(時間)', 'hours (clear every map in order)')); axs[0].set_ylabel(L('累計みちくさ点', 'cumulative points')); axs[0].set_title(L('みちくさ点のたまりかた(帯=総点の7-8割)', 'points pace'), fontsize=9)
    order = a['order']; names = {'komorebi': 'こもれび', 'kasumi': '霞ヶ丘', 'shiomi': '潮見浜', 'tengu': '天狗岳', 'mayoiga': 'マヨイガ', 'ryuhyo': '流氷岬', 'hinoshima': '火ノ島', 'sango': '珊瑚島', 'yomi': '黄泉ヶ原'}
    axs[1].bar([names[t] if jp else t for t in order], [a['byTown'][t]['pts'] for t in order], color=CA)
    for i, t in enumerate(order): axs[1].text(i, a['byTown'][t]['pts'], f"{a['byTown'][t]['sec'] / 60:.0f}min", ha='center', va='bottom', fontsize=7)
    axs[1].tick_params(axis='x', labelsize=7, rotation=20); axs[1].set_title(L('町ごとの点(棒の上は歩き切る分)', 'points per town'), fontsize=9)
    save(fig, 'points')

# 4. 地域コンプの時間
a, b = load(AFTER, 'region'), load(BEFORE, 'region')
if a and b:
    ks = list(a); fig, ax = plt.subplots(figsize=(8, 3.8)); w = .38
    ax.bar([i - w / 2 for i in range(len(ks))], [b[k]['p50'] for k in ks], w, color=CB, label=L('調整前', 'before'))
    ax.bar([i + w / 2 for i in range(len(ks))], [a[k]['p50'] for k in ks], w, color=CA, label=L('調整後', 'after'))
    ax.axhspan(30, 60, color='gold', alpha=.25); ax.set_xticks(range(len(ks))); ax.set_xticklabels(ks, fontsize=7); ax.set_ylabel(L('コンプまで 中央値(分)', 'median min')); ax.legend(); ax.set_title(L('地域図鑑のコンプ時間(目標 30-60分)', 'region complete time'), fontsize=9)
    save(fig, 'region_time')

# 5. 負けの罰
a, b = load(AFTER, 'penalty'), load(BEFORE, 'penalty')
if a:
    ks = list(a); fig, axs = plt.subplots(1, 2, figsize=(10, 3.8)); w = .38
    for ax, key, t in zip(axs, ['yenNetPerH', 'lossPerH'], [L('円(差し引き)/時', 'net yen / h'), L('負け/時', 'losses / h')]):
        ax.bar([i - w / 2 for i in range(len(ks))], [a[k]['old'][key] for k in ks], w, color=CB, label=L('旧(所持金の1/2)', 'old 1/2'))
        ax.bar([i + w / 2 for i in range(len(ks))], [a[k]['new'][key] for k in ks], w, color=CA, label=L('新(1/4・上限)', 'new 1/4 capped'))
        ax.set_xticks(range(len(ks))); ax.set_xticklabels(ks, fontsize=7, rotation=15); ax.set_title(t, fontsize=9); ax.axhline(0, color='k', lw=.8)
    axs[0].legend(fontsize=8)
    save(fig, 'penalty')

# 6. 流星石
a = load(AFTER, 'stars')
if a:
    fig, ax = plt.subplots(figsize=(7, 3.8))
    parts = [(L('従来の1回きり', 'old one-time'), sum(a['base'].values()) + a['oldMsStars'], '#9aa5b1'), (L('地域コンプ', 'region'), a['regStars'], '#e9a23b'), (L('踏破100%', 'foot 100%'), a['stampStars'], '#c8553d'), (L('記念品(新)', 'dex ms new'), a['newMsStars'], '#2a9d8f')]
    bot = 0
    for lab, v, c in parts: ax.bar(0, v, bottom=bot, color=c, label=f'{lab} {v}'); bot += v
    ax.bar(1, 19 * 30, color='#9aa5b1', label=L('ログイン+ミッション 30日', 'login+missions 30d')); ax.bar(2, 10 * 30, color='#c8553d', label=L('みちくさ帳★10×30日(調整前)', 'mchi 10x30d before')); ax.bar(3, 5 * 30, color='#e9a23b', label=L('みちくさ帳★5×30日(調整後)', 'mchi 5x30d after'))
    ax.set_xticks(range(4)); ax.set_xticklabels([L('1回きり', 'one-time'), L('30日', '30d'), L('30日', '30d'), L('30日', '30d')], fontsize=8); ax.legend(fontsize=7); ax.set_ylabel(L('流星石 ★', 'stars'))
    ax.set_title(L('流星石の流入(ガチャ 1回★100・天井100回=★10000)', 'star inflow'), fontsize=9)
    save(fig, 'stars')
