// Procedural sci-fi sound effects via Web Audio API.
// Mirrors audio.py — same synthesis math, AudioBuffer instead of pygame.sndarray.

const SAMPLE_RATE = 44100;

function envelope(n, attack = 0.005, release = 0.08) {
  let a = Math.max(1, Math.floor(attack * SAMPLE_RATE));
  let r = Math.max(1, Math.floor(release * SAMPLE_RATE));
  a = Math.min(a, Math.floor(n / 2));
  r = Math.min(r, Math.max(1, n - a));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = 1;
  for (let i = 0; i < a; i++) out[i] = a === 1 ? 1 : i / (a - 1);
  for (let i = 0; i < r; i++) out[n - r + i] = r === 1 ? 0 : 1 - i / (r - 1);
  return out;
}

function sweep(f0, f1, duration, kind = "sine") {
  const n = Math.floor(duration * SAMPLE_RATE);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const freq = n === 1 ? f0 : f0 + (f1 - f0) * (i / (n - 1));
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    if (kind === "sine") out[i] = Math.sin(phase);
    else if (kind === "square") out[i] = Math.sin(phase) >= 0 ? 1 : -1;
    else if (kind === "saw") {
      const norm = phase / (2 * Math.PI);
      out[i] = 2 * (norm - Math.floor(0.5 + norm));
    }
  }
  return out;
}

function tone(freq, duration, kind = "sine") {
  return sweep(freq, freq, duration, kind);
}

function add(...arrs) {
  const n = Math.max(...arrs.map((a) => a.length));
  const out = new Float32Array(n);
  for (const a of arrs) for (let i = 0; i < a.length; i++) out[i] += a[i];
  return out;
}

function mulScalar(arr, s) {
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = arr[i] * s;
  return out;
}

function mulArr(a, b) {
  const n = Math.min(a.length, b.length);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = a[i] * b[i];
  return out;
}

export class Audio {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.enabled = false;
  }

  init() {
    if (this.ctx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx({ sampleRate: SAMPLE_RATE });
      this._build();
      this.enabled = true;
    } catch (e) {
      console.warn("[audio] disabled:", e);
    }
  }

  _build() {
    // pickup / button click — short low descending "tup"
    {
      const s = sweep(320, 140, 0.035);
      const e = envelope(s.length, 0.0008, 0.028);
      this.buffers.pick = this._toBuffer(mulArr(s, e), 0.26);
    }

    // place — snappy low "thock" when piece locks into the grid
    {
      const n = Math.floor(0.05 * SAMPLE_RATE);
      const body = add(tone(110, 0.05, "square"), mulScalar(tone(180, 0.05, "sine"), 0.5));
      this.buffers.place = this._toBuffer(mulArr(body, envelope(n, 0.0008, 0.04)), 0.34);
    }

    // invalid — low buzz
    {
      const s = tone(150, 0.12, "square");
      this.buffers.invalid = this._toBuffer(mulArr(s, envelope(s.length, 0.003, 0.05)), 0.18);
    }

    // line clear — rising chord shimmer
    {
      const d = 0.4;
      const n = Math.floor(d * SAMPLE_RATE);
      const s = add(
        sweep(520, 1900, d),
        mulScalar(sweep(780, 2850, d), 0.55),
        mulScalar(sweep(1040, 3800, d), 0.3),
      );
      this.buffers.clear = this._toBuffer(mulArr(s, envelope(n, 0.003, 0.18)), 0.3);
    }

    // multi clear — chord + low boom
    {
      const d = 0.5;
      const n = Math.floor(d * SAMPLE_RATE);
      const chord = add(
        sweep(520, 2100, d),
        mulScalar(sweep(780, 3100, d), 0.6),
        mulScalar(sweep(1040, 4100, d), 0.35),
      );
      const boom = mulScalar(
        mulArr(sweep(140, 70, d, "saw"), envelope(n, 0.005, 0.3)),
        0.9,
      );
      const mix = add(chord, boom);
      this.buffers.multi_clear = this._toBuffer(mulArr(mix, envelope(n, 0.003, 0.22)), 0.38);
    }

    // game over — long descending tone
    {
      const d = 0.7;
      const n = Math.floor(d * SAMPLE_RATE);
      const s = add(sweep(700, 80, d, "saw"), mulScalar(sweep(350, 40, d), 0.4));
      this.buffers.game_over = this._toBuffer(mulArr(s, envelope(n, 0.01, 0.35)), 0.3);
    }
  }

  _toBuffer(samples, volume = 0.35) {
    const buf = this.ctx.createBuffer(1, samples.length, SAMPLE_RATE);
    const data = buf.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      data[i] = Math.max(-1, Math.min(1, samples[i] * volume));
    }
    return buf;
  }

  play(name) {
    if (!this.enabled) return;
    if (this.ctx.state === "suspended") this.ctx.resume();
    const buf = this.buffers[name];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.start();
  }
}
