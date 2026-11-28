// 曲(すべてオリジナル。村のオルゴールの主題を、エリアごとに編成を変えて展開する)
// 主題はハ長調で書き、曲ごとに key(半音)で移す。短調の曲は minorize() で短調にする。
import { mel, chords, arp, comp, bass, drums, cat, rep, rest, tr, vol, minorize, stacc, mix, slice, seq } from './theory.js';

// ---- 主題「ネジマキのうた」(16小節 = 64拍) ----
// A: ゼンマイを巻くように上がる動機(ソ・ド・ミ)で始まり、B で高い所へ広がる
export const THEME_A =
  'G4:.5 C5:.5 E5 D5:.5 C5:.5 G5 | A5:1.5 G5:.5 E5 C5 | F5 A5:.5 G5:.5 F5 E5 | D5:2 E5:.5 D5:.5 B4 | ' +
  'G4:.5 C5:.5 E5 D5:.5 C5:.5 C6 | B5:1.5 G5:.5 E5 B4 | C5 A5 G5:.5 F5:.5 D5 | C5:3 r';
export const THEME_B =
  'A5 C6 A5:.5 G5:.5 F5 | G5 B5 G5:.5 F5:.5 D5 | E5:.5 F5:.5 G5 B5 G5 | A5:2 E5 C5 | ' +
  'D5 F5:.5 A5:.5 C6 A5 | B5 G5:.5 A5:.5 B5 D6 | C6 G5 A5:.5 G5:.5 F5 | E5 D5:2 r';

export const CH_A = 'C Am F G C Em F:2 G:2 C';
export const CH_B = 'F G Em Am Dm G C:2 F:2 G';
export const CHM_A = 'Cm Ab Fm G Cm Eb Fm:2 G:2 Cm';
export const CHM_B = 'Fm G Eb Ab Ddim G Cm:2 Fm:2 G';

const A = () => mel(THEME_A);
const B = () => mel(THEME_B);
const chA = () => chords(CH_A);
const chB = () => chords(CH_B);
const ch = () => chords(CH_A + ' ' + CH_B);
const chmA = () => chords(CHM_A);
const chmB = () => chords(CHM_B);
const chm = () => chords(CHM_A + ' ' + CHM_B);
const minA = () => minorize(A(), chmA());
const minB = () => minorize(B(), chmB());
const minTheme = () => cat(minA(), minB());

// 1つの音を置く
const one = (b, n, d = 1, v = 0.8, len = null) => seq([{ b, d, n, v }], len ?? b + d);
// 何拍ごとかに同じ音
const every = (len, step, n, v = 0.6, from = 0) => {
  const ev = [];
  for (let b = from; b < len - 1e-6; b += step) ev.push({ b, d: 1, n, v });
  return seq(ev, len);
};

const T = (inst, s, o = {}) => ({ inst, seq: s, vol: o.vol ?? 1, pan: o.pan ?? 0, rev: o.rev ?? 0.2 });

// 曲の形: { bpm, bpb(1小節の拍), key, len(拍), loopStart(拍), swing, gain(音量の補正), rev(残響の量), tracks, label, scoring }
const SONG_DEFS = {
  // 村: オルゴールだけ。主題をそのまま
  village: () => ({
    label: 'ネジマキ村', bpm: 92, key: 5, rev: 0.32,
    scoring: 'オルゴール(主旋律)・オルゴール(分散和音)・低いオルゴール(ベース)・チェレスタ(Bで飾り)',
    tracks: [
      T('musicBox', cat(A(), B()), { vol: 1, pan: 0.05, rev: 0.35 }),
      T('musicBox', cat(arp(chA(), { pat: [0, 2, 1, 2], step: 1, center: 55, v: 0.45 }), arp(chB(), { pat: [0, 1, 2, 3, 2, 1, 2, 1], step: 0.5, center: 55, v: 0.4 })), { vol: 0.75, pan: -0.25, rev: 0.3 }),
      T('lowBox', bass(ch(), { pat: 'R . 5 .', step: 1, center: 41, v: 0.6 }), { vol: 0.8, pan: 0, rev: 0.15 }),
      T('celesta', cat(rest(32), arp(chB(), { pat: [4, '-', '-', '-', '-', 3, '-', '-'], step: 0.5, center: 79, v: 0.4 })), { vol: 0.7, pan: 0.35, rev: 0.45 }),
    ],
  }),

  // つみき野: 口笛と木琴。はねるリズム
  tsumiki: () => ({
    label: 'つみき野', bpm: 116, key: 7, swing: 0.14, rev: 0.2,
    scoring: '口笛(主旋律)・木琴(Aは裏拍の和音、Bは分散和音と合いの手)・マリンバ(ベース)・木魚と シェイカー',
    tracks: [
      T('whistle', cat(A(), B()), { vol: 1, pan: 0.1, rev: 0.28 }),
      T('xylo', cat(comp(chA(), { rhythm: '.x.x.x.x', step: 0.5, center: 67, v: 0.4, size: 3 }), arp(chB(), { pat: [0, 1, 2, 3, 4, 3, 2, 1], step: 0.5, center: 67, v: 0.42 })), { vol: 0.8, pan: -0.3, rev: 0.15 }),
      T('xylo', cat(rest(28), mel('G5:.5 A5:.5 B5:.5 D6:.5'), rest(28), mel('D6:.5 B5:.5 G5:.5 E5:.5')), { vol: 0.8, pan: 0.4 }),
      T('marimba', bass(ch(), { pat: 'R 5 8 5', step: 1, center: 43, v: 0.65 }), { vol: 0.9, rev: 0.1 }),
      T('kit', rep(drums('..w...w.', { w: 'wood' }, { step: 0.5, v: 0.55 }), 16), { vol: 0.8, pan: 0.25, rev: 0.1 }),
      T('kit', rep(drums('sSsSsSsS', { s: 'shaker' }, { step: 0.5, v: 0.6 }), 16), { vol: 0.8, pan: -0.15, rev: 0.05 }),
    ],
  }),

  // ランプの森: 低いオルゴールと鈴。短調・ゆっくり
  forest: () => ({
    label: 'ランプの森', bpm: 70, key: 2, rev: 0.48,
    scoring: '低いオルゴール(主旋律を1オクターブ下・短調)・低いオルゴール(分散和音)・鈴(4小節ごと)・小さなベル・暗いパッド',
    tracks: [
      T('lowBox', tr(minTheme(), -12), { vol: 1, pan: 0, rev: 0.45 }),
      T('lowBox', arp(chm(), { pat: [0, 2, 1, 2], step: 1, center: 48, v: 0.42 }), { vol: 0.75, pan: -0.3, rev: 0.4 }),
      T('darkPad', comp(chm(), { rhythm: 'x', step: 4, center: 55, v: 0.5, dur: 4 }), { vol: 0.8, rev: 0.5 }),
      T('bell', arp(chm(), { pat: [4, '-', '-', '-', '-', '-', 3, '-', '-', '-', '-', '-', '-', '-', '-', '-'], step: 0.5, center: 84, v: 0.3 }), { vol: 0.7, pan: 0.4, rev: 0.6 }),
      T('suzu', every(64, 16, 103, 0.7), { vol: 0.8, pan: 0.5, rev: 0.6 }),
      T('suzu', every(64, 16, 98, 0.5, 8), { vol: 0.8, pan: -0.5, rev: 0.6 }),
    ],
  }),

  // ゼンマイ時計塔: チクタクの打楽器と金管。4拍で振り子が1往復
  tower: () => ({
    label: 'ゼンマイ時計塔', bpm: 108, key: -3, rev: 0.3,
    scoring: 'チク(1・3拍)タク(2・4拍)・金管(Aの主旋律・短調)・オルゴール(Bの主旋律を1オクターブ上)・金管の和音(B)・チューバ(ベース)・時計の鐘(A・Bの頭)',
    tracks: [
      T('kit', rep(drums('t.k.t.k.', { t: 'tick', k: 'tock' }, { step: 0.5, v: 0.7 }), 16), { vol: 0.9, pan: 0.15, rev: 0.15 }),
      T('kit', rep(cat(rest(15), drums('r', { r: 'ratchet' }, { step: 1, v: 0.7 })), 4), { vol: 0.8, pan: -0.35, rev: 0.2 }),
      T('brass', cat(minA(), rest(32)), { vol: 0.95, pan: 0.05, rev: 0.3 }),
      T('musicBox', cat(rest(32), tr(minB(), 12)), { vol: 0.95, pan: 0.1, rev: 0.35 }),
      T('musicBox', cat(arp(chmA(), { pat: [0, 1, 2, 1], step: 0.5, center: 60, v: 0.35 }), rest(32)), { vol: 0.7, pan: -0.3, rev: 0.3 }),
      T('horns', cat(rest(32), comp(chmB(), { rhythm: 'x', step: 4, center: 57, v: 0.7, dur: 3.6 })), { vol: 0.8, pan: -0.15, rev: 0.35 }),
      T('tuba', bass(chm(), { pat: 'R . 5 .', step: 1, center: 40, v: 0.65 }), { vol: 0.85, rev: 0.15 }),
      T('chime', mix(one(0, 60, 2, 0.6, 64), one(0, 55, 2, 0.5, 64), one(32, 60, 2, 0.5, 64), one(32, 67, 2, 0.4, 64)), { vol: 0.75, pan: 0.3, rev: 0.5 }),
    ],
  }),

  // 戦闘: 前奏4小節のあと、主題(短調)を金管とオルゴールで
  battle: () => {
    const intro = mix(
      bass(chords('Cm:12 Ab:2 G:2'), { pat: 'R R 8 R 5 R b7 R', step: 0.5, center: 36, v: 0.8 }),
    );
    const introBrass = cat(rep(mel('C4+Eb4+G4:.5! r:2 C4+Eb4+G4:.5 r:1'), 3), mel('G4:.5 Ab4:.5 B4:.5 C5:.5 D5:.5 Eb5:.5 F5:.5 G5:.5!'));
    return {
      label: '戦闘', bpm: 152, key: 4, loopStart: 16, rev: 0.16,
      scoring: '前奏4小節(ベースの刻み・金管の合図)→ 金管(主旋律・短調)・オルゴール(1オクターブ上で重ねる)・シンセベース(8分)・ドラム・弦のパッド',
      tracks: [
        T('brass', cat(introBrass, minTheme()), { vol: 0.9, pan: 0, rev: 0.2 }),
        T('musicBox', cat(rest(16), tr(minTheme(), 12)), { vol: 0.65, pan: 0.2, rev: 0.25 }),
        T('synthBass', cat(intro, bass(chm(), { pat: 'R R 8 R R R 8 R', step: 0.5, center: 36, v: 0.75 })), { vol: 0.85, rev: 0.05 }),
        T('kit', cat(rep(drums('K...K...K...KK..', { k: 'kick' }, { step: 0.5, v: 0.7 }), 1), drums('K...K...K.s.s.ss', { k: 'kick', s: 'snare' }, { step: 0.5, v: 0.6 }),
          rep(cat(rep(drums('KhShKhSh', { k: 'kick', h: 'hat', s: 'snare' }, { step: 0.5, v: 0.62 }), 3), drums('KhShKKSS', { k: 'kick', h: 'hat', s: 'snare' }, { step: 0.5, v: 0.62 })), 4)), { vol: 0.85, rev: 0.06 }),
        T('kit', cat(rest(16), one(0, 'crash', 1, 0.6, 64)), { vol: 0.8, pan: -0.2, rev: 0.1 }),
        T('pad', cat(rest(16), comp(chm(), { rhythm: 'x', step: 4, center: 60, v: 0.55, dur: 4 })), { vol: 0.8, pan: -0.1, rev: 0.25 }),
      ],
    };
  },

  // ぬし戦(カゲボウシ): 影(A)と光(B)が8小節ごとに入れかわる
  nushi: () => {
    const ost = (list) => arp(list, { pat: [0, 4, 3, 4, 1, 4, 3, 4], step: 0.5, center: 50, v: 0.5 });
    return {
      label: 'ぬし戦', bpm: 138, key: 2, loopStart: 8, rev: 0.3,
      scoring: '前奏2小節(低いオルゴールの刻み)→ 影の8小節: 低いオルゴールの刻み・低い主旋律を金管の和音で重ねる・ティンパニ / 光の8小節: 高いオルゴールの主旋律・鈴・ドラム。暗いパッド',
      tracks: [
        T('lowBox', cat(ost(chords('Cm Db')), ost(chm())), { vol: 0.85, pan: -0.2, rev: 0.3 }),
        T('lowBox', cat(rest(8), tr(minA(), -12), rest(32)), { vol: 1, pan: 0.05, rev: 0.35 }),
        T('horns', cat(rest(8), tr(minA(), -12), rest(32)), { vol: 0.9, pan: 0.15, rev: 0.3 }),
        T('musicBox', cat(rest(8), rest(32), tr(minB(), 12)), { vol: 0.95, pan: 0.1, rev: 0.4 }),
        T('suzu', cat(rest(40), every(32, 2, 101, 0.6)), { vol: 0.8, pan: 0.45, rev: 0.5 }),
        T('kit', cat(drums('T.......T...T.T.', { t: 'timp' }, { step: 0.5, v: 0.7 }),
          rep(drums('T..t..T.....t.t.', { t: 'timp' }, { step: 0.5, v: 0.6 }), 4),
          rep(drums('KhShKhShKhShKKSh', { k: 'kick', h: 'hat', s: 'snare' }, { step: 0.5, v: 0.6 }), 4)), { vol: 0.85, rev: 0.12 }),
        T('darkPad', cat(comp(chords('Cm Db'), { rhythm: 'x', step: 4, center: 55, v: 0.55, dur: 4 }), comp(chm(), { rhythm: 'x', step: 4, center: 55, v: 0.55, dur: 4 })), { vol: 0.8, rev: 0.4 }),
        T('tuba', cat(rest(8), bass(chm(), { pat: 'R . . . 5 . . .', step: 0.5, center: 38, v: 0.6 })), { vol: 0.8, rev: 0.12 }),
      ],
    };
  },

  // ボス戦(トケイモリ): 鐘が鳴って始まる。チクタクが8分で走る
  boss: () => {
    const tt = (n) => rep(drums('tktktktk', { t: 'tick', k: 'tock' }, { step: 0.5, v: 0.6 }), n);
    return {
      label: 'ボス戦', bpm: 164, key: 0, loopStart: 16, rev: 0.22,
      scoring: '前奏4小節(時計の鐘・チクタクが4分→8分へ)→ チクタク(8分)・金管(主旋律・短調)・オルゴール(1オクターブ上)・金管の和音(裏拍)・チューバ・ティンパニとドラム',
      tracks: [
        T('chime', cat(mix(one(0, 48, 3, 0.8, 16), one(0, 55, 3, 0.6, 16), one(4, 48, 3, 0.8, 16), one(8, 48, 3, 0.8, 16), one(12, 47, 2, 0.7, 16)), one(0, 48, 3, 0.7, 64)), { vol: 0.8, pan: 0.2, rev: 0.5 }),
        T('kit', cat(rep(drums('t.k.t.k.', { t: 'tick', k: 'tock' }, { step: 0.5, v: 0.6 }), 2), tt(2), tt(16)), { vol: 0.8, pan: 0.25, rev: 0.12 }),
        T('brass', cat(rest(12), mel('G4:.5 Ab4:.5 B4:.5 D5:.5 F5:.5 Ab5:.5 B5:.5 D6:.5!'), minTheme()), { vol: 0.95, rev: 0.22 }),
        T('musicBox', cat(rest(16), tr(minTheme(), 12)), { vol: 0.6, pan: -0.15, rev: 0.25 }),
        T('horns', cat(rest(16), comp(chm(), { rhythm: '.x.x.x.x', step: 0.5, center: 60, v: 0.7, dur: 0.4 })), { vol: 0.8, pan: -0.25, rev: 0.2 }),
        T('tuba', cat(rest(16), bass(chm(), { pat: 'R . R 5 R . b7 5', step: 0.5, center: 36, v: 0.65 })), { vol: 0.85, rev: 0.08 }),
        T('kit', cat(drums('T.......T.......T.......TtTtTtTt', { t: 'timp' }, { step: 0.5, v: 0.6 }),
          rep(cat(rep(drums('K..KS..KK..KS.S.', { k: 'kick', s: 'snare' }, { step: 0.5, v: 0.62 }), 3), drums('K..KS..KK.SSSSSS', { k: 'kick', s: 'snare' }, { step: 0.5, v: 0.62 })), 2)), { vol: 0.85, rev: 0.06 }),
        T('kit', cat(rest(16), one(0, 'crash', 1, 0.6, 32), one(0, 'crash', 1, 0.5, 32)), { vol: 0.8, pan: -0.2, rev: 0.1 }),
      ],
    };
  },

  // タイトル: オルゴールと、三連符で転がるチェレスタ
  title: () => ({
    label: 'タイトル', bpm: 80, key: 3, rev: 0.45,
    scoring: 'オルゴール(主旋律)・チェレスタ(三連符の分散和音)・弦のパッド(ごく小さく)・低いオルゴール(各小節の頭)',
    tracks: [
      T('musicBox', cat(A(), B()), { vol: 1, pan: 0, rev: 0.45 }),
      T('celesta', arp(ch(), { pat: [0, 1, 2, 3, 2, 1], step: 1 / 3, center: 55, v: 0.32 }), { vol: 0.75, pan: -0.25, rev: 0.45 }),
      T('pad', comp(ch(), { rhythm: 'x', step: 4, center: 57, v: 0.4, dur: 4 }), { vol: 0.7, pan: 0.2, rev: 0.5 }),
      T('lowBox', bass(ch(), { pat: 'R . . .', step: 1, center: 41, v: 0.5 }), { vol: 0.8, rev: 0.3 }),
    ],
  }),

  // 作業台: B から始まる。セブンスの和音・歩くベース・小さな金づち
  workbench: () => {
    const jB = chords('FM7 G7 Em7 Am7 Dm7 G7 CM7:2 FM7:2 G7');
    const jA = chords('CM7 Am7 FM7 G7 CM7 Em7 FM7:2 G7:2 C6');
    const j = chords('FM7 G7 Em7 Am7 Dm7 G7 CM7:2 FM7:2 G7 CM7 Am7 FM7 G7 CM7 Em7 FM7:2 G7:2 C6');
    return {
      label: '作業台', bpm: 88, key: -2, swing: 0.1, rev: 0.25,
      scoring: 'チェレスタ(主旋律。B→Aの順)・オルゴール(裏拍の和音)・はじくベース(歩く)・小さな金づちとシェイカー',
      tracks: [
        T('celesta', cat(B(), A()), { vol: 1, pan: 0.05, rev: 0.3 }),
        T('musicBox', cat(comp(jB, { rhythm: '..x...x.', step: 0.5, center: 64, v: 0.3, size: 4 }), comp(jA, { rhythm: '..x...x.', step: 0.5, center: 64, v: 0.3, size: 4 })), { vol: 0.75, pan: -0.25, rev: 0.25 }),
        T('pluckBass', bass(j, { pat: 'R 3 5 3', step: 1, center: 40, v: 0.6 }), { vol: 0.9, rev: 0.08 }),
        T('kit', rep(drums('..t..t.t', { t: 'tap' }, { step: 0.5, v: 0.55 }), 16), { vol: 0.8, pan: 0.3, rev: 0.15 }),
        T('kit', rep(drums('s.s.s.s.', { s: 'shaker' }, { step: 0.5, v: 0.5 }), 16), { vol: 0.7, pan: -0.3, rev: 0.05 }),
      ],
    };
  },

  // エンディング: ぜんぶの楽器が集まる
  ending: () => {
    const e = chords('Cadd9 Am7 FM7 G Cadd9 Em7 FM7:2 G:2 C FM7 G Em7 Am7 Dm7 G C/E:2 F:2 Gsus4:2 G:2');
    return {
      label: 'エンディング', bpm: 72, key: 2, rev: 0.45,
      scoring: 'オルゴール(Aの主旋律)・口笛とオルゴール(B、1オクターブちがいで)・弦のパッド・オルゴールの分散和音・低いオルゴールのベース・ベル(区切り)',
      tracks: [
        T('musicBox', cat(A(), vol(tr(B(), 12), 0.55)), { vol: 1, pan: 0, rev: 0.45 }),
        T('whistle', cat(rest(32), B()), { vol: 0.9, pan: 0.15, rev: 0.4 }),
        T('pad', comp(e, { rhythm: 'x', step: 4, center: 60, v: 0.55, dur: 4 }), { vol: 0.8, rev: 0.5 }),
        T('musicBox', arp(e, { pat: [0, 1, 2, 3, 2, 1, 2, 3], step: 0.5, center: 55, v: 0.32 }), { vol: 0.7, pan: -0.3, rev: 0.4 }),
        T('lowBox', bass(e, { pat: 'R . . 5', step: 1, center: 41, v: 0.55 }), { vol: 0.85, rev: 0.25 }),
        T('bell', mix(one(0, 84, 2, 0.4, 64), one(32, 79, 2, 0.4, 64), one(60, 84, 2, 0.3, 64)), { vol: 0.75, pan: 0.4, rev: 0.6 }),
      ],
    };
  },
};

// ジングル(1回だけ鳴る。BGM を下げて重ねる)
const JINGLE_DEFS = {
  victory: () => ({
    label: '勝利', bpm: 150, key: 0, rev: 0.25, once: true,
    tracks: [
      T('brass', mel('G4:.33 C5:.33 E5:.34 G5:1 E5:.5 G5:.5 C6:3!', 0.85), { vol: 1, rev: 0.25 }),
      T('musicBox', tr(mel('G4:.33 C5:.33 E5:.34 G5:1 E5:.5 G5:.5 C6:3!', 0.8), 12), { vol: 0.7, pan: 0.2, rev: 0.3 }),
      T('horns', cat(rest(3), mel('E4+G4+C5:3', 0.8)), { vol: 0.9, pan: -0.2, rev: 0.3 }),
      T('tuba', mel('C3:1 r:1 G2:.5 G2:.5 C3:3', 0.8), { vol: 0.9, rev: 0.1 }),
      T('kit', cat(drums('T.T.TtTt', { t: 'timp' }, { step: 0.25, v: 0.6 }), rest(1), one(0, 'crash', 1, 0.6, 1)), { vol: 0.8, rev: 0.1 }),
    ],
  }),
  scout: () => ({
    label: 'スカウト成功', bpm: 140, key: 2, rev: 0.4, once: true,
    tracks: [
      T('musicBox', mel('C5:.25 E5:.25 G5:.25 C6:.25 E6:.25 G6:.25 C7:2', 0.8), { vol: 1, rev: 0.4 }),
      T('bell', cat(rest(1.5), mel('C6+G6:2', 0.6)), { vol: 0.8, pan: 0.3, rev: 0.5 }),
      T('suzu', mix(one(0, 103, 1, 0.6, 2), one(1.5, 101, 1, 0.8, 3)), { vol: 0.9, pan: -0.3, rev: 0.5 }),
      T('pad', cat(rest(1.5), mel('C4+E4+G4:2', 0.5)), { vol: 0.8, rev: 0.4 }),
    ],
  }),
  breed: () => ({
    label: '配合完成', bpm: 120, key: 5, rev: 0.45, once: true,
    tracks: [
      T('kit', drums('r.r.R...', { r: 'ratchet' }, { step: 0.25, v: 0.8 }), { vol: 0.9, rev: 0.2 }),
      T('musicBox', cat(rest(1.5), mel('C6:.25 E6:.25 G6:.25 B6:.25 D7:.5 C7:2.5!', 0.75)), { vol: 1, pan: 0.1, rev: 0.45 }),
      T('celesta', cat(rest(2.5), mel('C5+E5+G5+B5:3', 0.6)), { vol: 0.85, pan: -0.2, rev: 0.45 }),
      T('bell', cat(rest(3), mel('C6:2', 0.5)), { vol: 0.8, pan: 0.35, rev: 0.6 }),
      T('pad', cat(rest(2.5), mel('C4+E4+G4+B4:3', 0.5)), { vol: 0.8, rev: 0.5 }),
    ],
  }),
  levelup: () => ({
    label: 'レベルアップ', bpm: 180, key: 0, rev: 0.25, once: true,
    tracks: [
      T('xylo', mel('C5:.5 E5:.5 G5:.5 C6:2!', 0.8), { vol: 1, rev: 0.2 }),
      T('musicBox', tr(mel('C5:.5 E5:.5 G5:.5 C6:2!', 0.7), 12), { vol: 0.75, pan: 0.2, rev: 0.3 }),
      T('bell', cat(rest(1.5), mel('G6:1', 0.4)), { vol: 0.7, pan: -0.3, rev: 0.4 }),
    ],
  }),
};

// 曲ごとの音量の補正(tools/audio/levels.mjs で測って、RMS がそろうように決めた値)
export const SONG_TRIM = {
  village: 0.779, tsumiki: 0.996, forest: 0.735, tower: 1.203, battle: 0.739, nushi: 0.479, boss: 0.816, title: 0.927, workbench: 1.058, ending: 0.924,
  victory: 1.13, scout: 1.258, breed: 1.6, levelup: 1.845,
};

export const SONG_NAMES = Object.keys(SONG_DEFS);
export const JINGLE_NAMES = Object.keys(JINGLE_DEFS);

const CACHE = new Map();
// 曲を「時刻順のイベントの列」にする。{ ...曲の情報, ev:[{b,d,n,v,ti}], len, loopStart }
export function compile(name) {
  if (CACHE.has(name)) return CACHE.get(name);
  const def = SONG_DEFS[name] || JINGLE_DEFS[name];
  if (!def) throw new Error('曲がない: ' + name);
  const s = def();
  const len = s.len ?? Math.max(...s.tracks.map((t) => t.seq.len));
  const ev = [];
  s.tracks.forEach((t, ti) => {
    for (const e of t.seq.ev) {
      const k = typeof e.n === 'string' ? 0 : s.key || 0;
      const ns = Array.isArray(e.n) ? e.n : [e.n];
      for (const n of ns) ev.push({ b: e.b, d: e.d, n: typeof n === 'string' ? n : n + k, v: e.v, ti });
    }
  });
  ev.sort((a, b) => a.b - b.b || a.ti - b.ti);
  const out = {
    name, ...s, bpb: s.bpb ?? 4, len, loopStart: s.loopStart ?? 0, swing: s.swing ?? 0,
    gain: SONG_TRIM[name] ?? 1, ev, once: !!s.once,
  };
  CACHE.set(name, out);
  return out;
}

export function songInfo(name) {
  const s = compile(name);
  return { name, label: s.label, bpm: s.bpm, bpb: s.bpb, key: s.key, len: s.len, loopStart: s.loopStart, scoring: s.scoring, once: s.once };
}
