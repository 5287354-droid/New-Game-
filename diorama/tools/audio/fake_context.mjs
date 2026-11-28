// テスト用のにせ AudioContext。WebAudio の約束ごと(指数ランプは正の値・時定数は正・stop は start のあと…)を確かめる
export class FakeParam {
  constructor(v = 0) { this.value = v; this.events = 0; }
  chk(v, t) {
    if (!Number.isFinite(v)) throw new Error('値が数でない: ' + v);
    if (!Number.isFinite(t) || t < 0) throw new Error('時刻がおかしい: ' + t);
    this.events++;
    return this;
  }
  setValueAtTime(v, t) { return this.chk(v, t); }
  linearRampToValueAtTime(v, t) { return this.chk(v, t); }
  exponentialRampToValueAtTime(v, t) { if (!(v > 0)) throw new Error('指数ランプは正の値だけ: ' + v); return this.chk(v, t); }
  setTargetAtTime(v, t, tc) { if (!(tc > 0)) throw new Error('時定数は正: ' + tc); return this.chk(v, t); }
  cancelScheduledValues(t) { return this.chk(0, t); }
}

class Node {
  constructor(ctx) { this.ctx = ctx; this.outs = 0; ctx.stats.nodes++; }
  connect(n) { if (!n) throw new Error('つなぎ先がない'); this.outs++; return n; }
  disconnect() { this.outs = 0; }
}

class Source extends Node {
  start(t = 0) { if (!Number.isFinite(t)) throw new Error('start'); this.t0 = t; this.ctx.stats.sources++; this.ctx.stats.lastStart = Math.max(this.ctx.stats.lastStart, t); }
  stop(t = 0) { if (!Number.isFinite(t)) throw new Error('stop'); if (this.t0 === undefined) throw new Error('start の前に stop'); if (t < this.t0) throw new Error('stop が start より前'); }
}

export class FakeAudioContext {
  constructor(opts = {}) {
    this.sampleRate = opts.sampleRate ?? 44100;
    this.currentTime = 0;
    this.state = 'suspended';
    this.stats = { nodes: 0, sources: 0, lastStart: 0 };
    this.destination = new Node(this);
    this.baseLatency = 0.01;
  }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  createGain() { const n = new Node(this); n.gain = new FakeParam(1); return n; }
  createStereoPanner() { const n = new Node(this); n.pan = new FakeParam(0); return n; }
  createBiquadFilter() { const n = new Node(this); n.type = 'lowpass'; n.frequency = new FakeParam(350); n.Q = new FakeParam(1); n.gain = new FakeParam(0); return n; }
  createConvolver() { const n = new Node(this); n.buffer = null; return n; }
  createDynamicsCompressor() {
    const n = new Node(this);
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new FakeParam(0);
    return n;
  }
  createOscillator() { const n = new Source(this); n.type = 'sine'; n.frequency = new FakeParam(440); n.detune = new FakeParam(0); return n; }
  createBufferSource() { const n = new Source(this); n.buffer = null; n.loop = false; n.playbackRate = new FakeParam(1); return n; }
  createBuffer(ch, len, sr) {
    if (!(len > 0)) throw new Error('長さ0のバッファ');
    const data = Array.from({ length: ch }, () => new Float32Array(len));
    return { numberOfChannels: ch, length: len, sampleRate: sr, getChannelData: (c) => data[c] };
  }
}
