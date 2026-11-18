#!/usr/bin/env python3
"""tools/sim/out/*.json から docs/update/balance/*.png を作る。使い方: python3 tools/sim/plot.py [out_dir] [png_dir]"""
import json, os, sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'out')
PNG = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, '..', '..', 'docs', 'update', 'balance')
os.makedirs(PNG, exist_ok=True)
plt.rcParams.update({'figure.dpi': 110, 'axes.spines.top': False, 'axes.spines.right': False, 'axes.grid': True, 'grid.alpha': .25})
for f in ['Noto Sans CJK JP', 'Noto Sans JP', 'IPAexGothic', 'IPAGothic', 'TakaoPGothic', 'VL Gothic', 'DejaVu Sans']:
    if any(f == x.name for x in matplotlib.font_manager.fontManager.ttflist):
        plt.rcParams['font.family'] = f
        break
NAME = {'ibote': 'イボテ', 'happadanuki': 'ハッパダヌキ', 'yamoryu': 'ヤモリュ'}
COL = {'ibote': '#2a9d8f', 'happadanuki': '#e9a23b', 'yamoryu': '#c8553d'}
EN = {'ibote': 'ibote', 'happadanuki': 'happadanuki', 'yamoryu': 'yamoryu'}
jp = plt.rcParams['font.family'][0] != 'DejaVu Sans'
nm = lambda k: NAME[k] if jp else EN[k]
L = (lambda a, b: a) if jp else (lambda a, b: b)


def load(n):
    p = os.path.join(OUT, n + '.json')
    return json.load(open(p))['result'] if os.path.exists(p) else None


def save(fig, n):
    fig.tight_layout(); fig.savefig(os.path.join(PNG, n + '.png')); plt.close(fig); print('saved', n)


r = load('opening')
if r:
    fig, ax = plt.subplots(figsize=(6.5, 3.8))
    ks = [k for k in r if k in NAME]
    v = [r[k]['win'] * 100 for k in ks]
    err = [[(r[k]['win'] - r[k]['ci'][0]) * 100 for k in ks], [(r[k]['ci'][1] - r[k]['win']) * 100 for k in ks]]
    ax.bar([nm(k) for k in ks], v, yerr=err, color=[COL[k] for k in ks], capsize=4)
    ax.axhline(95, color='k', ls='--', lw=1); ax.text(2.45, 96, L('目標 95%', 'target 95%'), ha='right', fontsize=8)
    for i, x in enumerate(v): ax.text(i, x / 2, f'{x:.0f}%', ha='center', color='w', fontsize=12)
    if 't812' not in r and 'talent812' in r:
        t = r['talent812']; ax.scatter(range(len(ks)), [t[k]['win'] * 100 for k in ks], marker='D', color='k', zorder=5, label=L('才能8-12に固定', 'talent 8-12')); ax.legend(loc='upper left', fontsize=8)
    ax.set_ylim(0, 105); ax.set_ylabel(L('勝率(%)', 'win rate (%)')); ax.set_title(L('最初の草むらの最初の1戦(オート, 各1000戦)', 'first battle at the first grass (auto, 1000 each)'))
    save(fig, 'opening_winrate')
    fig, ax = plt.subplots(figsize=(6.5, 3.8)); w = .25
    for i, k in enumerate(ks):
        b = r[k]['byN']; ax.bar([j + (i - 1) * w for j in range(2)], [100 * b[str(n)][0] / max(1, b[str(n)][1]) for n in (1, 2)], w, color=COL[k], label=nm(k))
    ax.set_xticks([0, 1]); ax.set_xticklabels([L('敵1体', '1 foe'), L('敵2体', '2 foes')]); ax.set_ylabel(L('勝率(%)', 'win rate (%)')); ax.legend(); ax.set_title(L('敵の数ごとの勝率', 'win rate by foe count'))
    save(fig, 'opening_by_foes')

r = load('sequence')
if r:
    fig, axs = plt.subplots(1, 2, figsize=(10, 3.8), sharey=True)
    for ax, lab, t in zip(axs, ['solo', 'party3'], [L('相棒1体のみ', 'lead only'), L('3体パーティ', 'party of 3')]):
        for k, d in r[lab].items():
            xs = [i + 1 for i, x in enumerate(d['byIdx']) if x['win'] is not None and x['n'] >= 20]
            ax.plot(xs, [d['byIdx'][i - 1]['win'] * 100 for i in xs], 'o-', color=COL[k], label=nm(k))
        ax.axhline(85, color='k', ls='--', lw=1); ax.axvline(3.5, color='gray', ls=':')
        ax.set_title(t); ax.set_xlabel(L('何戦目か', 'battle #'))
    axs[0].set_ylabel(L('勝率(%) 回復しながら連戦', 'win rate (%)')); axs[0].legend(); axs[0].text(12, 86, L('目標 85%(4戦目以降)', 'target 85% (4th+)'), ha='right', fontsize=8)
    fig.suptitle(L('続けて戦ったときの勝率(あぜ道, オート)', 'win rate over consecutive battles'))
    save(fig, 'sequence_winrate')

r = load('field')
if r:
    fig, axs = plt.subplots(1, 2, figsize=(10, 3.8), sharey=True)
    for ax, key, t in zip(axs, ['urayama', 'aze'], [L('裏山(昼)', 'Urayama (day)'), L('あぜ道(昼)', 'Aze (day)')]):
        for k, d in r[key].items():
            ax.plot([x['lv'] for x in d['day']], [x['win'] * 100 for x in d['day']], 'o-', color=COL[k], label=nm(k))
        ax.axhspan(60, 80, color='gold', alpha=.18); ax.set_title(t); ax.set_xlabel(L('先頭のLv', 'lead Lv'))
    axs[0].set_ylabel(L('勝率(%) 1体で出発', 'win rate (%) solo')); axs[0].legend(); axs[0].text(5, 62, L('目標 60-80%', 'target 60-80%'), fontsize=8)
    save(fig, 'field_winrate')
    fig, ax = plt.subplots(figsize=(6.5, 3.8))
    for lab, ls in [('day', '-'), ('night', '--'), ('day_party3', ':')]:
        ys = [sum(x['win'] for x in r['urayama'][k][lab][i:i + 1]) for k in r['urayama'] for i in range(1)]
        n = len(r['urayama'])
        lv = [x['lv'] for x in r['urayama']['ibote'][lab]]
        ax.plot(lv, [sum(r['urayama'][k][lab][j]['win'] for k in r['urayama']) / n * 100 for j in range(len(lv))], ls, marker='o', label={'day': L('昼 1体', 'day solo'), 'night': L('夜 1体', 'night solo'), 'day_party3': L('昼 3体', 'day party3')}[lab])
    ax.axhspan(60, 80, color='gold', alpha=.18); ax.set_xlabel(L('先頭のLv', 'lead Lv')); ax.set_ylabel(L('勝率(%) 3体平均', 'win rate (%) avg')); ax.legend(); ax.set_title(L('裏山: 昼・夜・仲間の数', 'Urayama: day/night/party'))
    save(fig, 'urayama_variants')

r = load('income')
if r:
    fig, axs = plt.subplots(1, 3, figsize=(11, 3.6)); ks = list(r)
    for ax, key, t in zip(axs, ['expPerH', 'yenPerH', 'encPerH'], [L('経験値/時', 'exp / h'), L('円(純)/時', 'yen (net) / h'), L('遭遇数/時', 'encounters / h')]):
        ax.bar(ks, [r[k][key] for k in ks], color=['#2a9d8f', '#e9a23b', '#c8553d']); ax.set_title(t); ax.tick_params(axis='x', labelsize=8)
        for i, k in enumerate(ks): ax.text(i, r[k][key], f'{r[k][key]:.0f}', ha='center', va='bottom', fontsize=9)
    save(fig, 'income')

r = load('shiny')
if r:
    fig, axs = plt.subplots(1, 2, figsize=(9, 3.6)); ks = list(r)
    axs[0].bar(ks, [r[k]['shinyPerH'] for k in ks], color='#e9a23b'); axs[0].axhspan(.5, 1, color='gold', alpha=.25); axs[0].set_title(L('色違いの遭遇/時(目標 0.5-1)', 'shiny / h (target .5-1)'))
    axs[1].bar(ks, [r[k]['metalPerH'] for k in ks], color='#7a8a99'); axs[1].set_title(L('メタル系の遭遇/時', 'metal / h'))
    for ax, key in zip(axs, ['shinyPerH', 'metalPerH']):
        for i, k in enumerate(ks): ax.text(i, r[k][key], f'{r[k][key]:.2f}', ha='center', va='bottom')
    save(fig, 'shiny_metal')

r = load('scout')
if r:
    fig, axs = plt.subplots(1, 2, figsize=(10, 3.8))
    ks = list(r); w = .26
    for i, (key, lab) in enumerate([('full', L('HP満タン', 'full HP')), ('half', L('HP半分', 'half HP')), ('quarter', L('HP1/4', 'quarter HP'))]):
        axs[0].bar([j + (i - 1) * w for j in range(len(ks))], [r[k]['mean'][key] * 100 for k in ks], w, label=lab)
    axs[0].set_xticks(range(len(ks))); axs[0].set_xticklabels(ks, rotation=20, fontsize=7); axs[0].set_ylabel(L('成功率(%) 出現率で加重', 'success % (weighted)')); axs[0].legend(fontsize=8)
    axs[0].set_title(L('スカウト成功率(おにぎりなし)', 'scout success (no onigiri)'))
    k0 = ks[0]; axs[1].bar([f'{i*10}-{i*10+10}%' for i in range(10)], [h * 100 for h in r[k0]['hist']], color='#2a9d8f'); axs[1].tick_params(axis='x', labelsize=7, rotation=45)
    axs[1].set_title(L(f'成功率の分布 ({k0}, HP 100/50/25%)', f'distribution ({k0})')); axs[1].set_ylabel(L('割合(%)', 'share %'))
    save(fig, 'scout')

r = load('metal')
if r:
    fig, ax = plt.subplots(figsize=(6.5, 3.8)); ks = list(r)
    b = [0] * len(ks)
    for key, lab, c in [('killed', L('倒した', 'defeated'), '#2a9d8f'), ('fled', L('逃げられた', 'fled'), '#e9a23b'), ('lose', L('負けた', 'lost'), '#c8553d')]:
        v = [r[k][key] * 100 for k in ks]; ax.bar(ks, v, bottom=b, label=lab, color=c); b = [x + y for x, y in zip(b, v)]
    ax.legend(); ax.set_ylabel('%'); ax.set_title(L('メタル系との戦闘結果(オート)', 'metal fights (auto)')); ax.tick_params(axis='x', labelsize=8)
    save(fig, 'metal')

r = load('boss')
if r:
    fig, axs = plt.subplots(1, 2, figsize=(10, 3.8))
    for lab, ls in [('solo', '-'), ('party3', '--')]:
        ks = [k for k in r if k.startswith(lab)]
        th = [int(k.split('thr')[1]) for k in ks]
        bl = sorted([v for v in r.get('byLv', {}).values() if v['party'] == (1 if lab == 'solo' else 3)], key=lambda v: v['lv'])
        axs[0].plot([v['lv'] for v in bl], [v['win'] * 100 for v in bl], ls, marker='o', label=L('相棒のみ' if lab == 'solo' else '3体', lab))
        axs[1].plot(th, [r[k]['minutes']['p50'] for k in ks], ls, marker='o', label=L('相棒のみ' if lab == 'solo' else '3体', lab))
    axs[0].set_xlabel(L('先頭のLv(仲間は-1)', 'lead Lv')); axs[0].set_ylabel(L('ぬし戦の勝率(%) 満タンで挑戦', 'boss win %')); axs[0].set_title(L('裏山のぬし: Lvごとの勝率', 'boss win by Lv'), fontsize=9); axs[1].set_title(L('新規ゲームからぬし撃破まで', 'new game to boss clear'), fontsize=9); axs[0].legend()
    axs[1].set_xlabel(L('挑戦するLv', 'Lv at challenge')); axs[1].set_ylabel(L('撃破までの時間 中央値(分)', 'time to clear, median (min)')); axs[1].legend()
    save(fig, 'boss')
