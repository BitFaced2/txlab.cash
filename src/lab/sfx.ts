/**
 * Tiny synthesized SFX engine — WebAudio oscillators + filtered noise.
 * No audio assets; every sound is generated. The AudioContext starts
 * suspended until the browser sees a user gesture (autoplay policy) —
 * we hook the first pointer/key event to resume it.
 */
class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private ready(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        this.enabled = false;
        return null;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
      const resume = () => this.ctx?.resume();
      document.addEventListener("pointerdown", resume, { once: true });
      document.addEventListener("keydown", resume, { once: true });
    }
    return this.ctx;
  }

  private tone(
    freq: number, dur: number,
    opts: { type?: OscillatorType; vol?: number; glide?: number; delay?: number } = {},
  ) {
    const ctx = this.ready();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const o = ctx.createOscillator();
    o.type = opts.type ?? "sine";
    o.frequency.setValueAtTime(freq, t0);
    if (opts.glide) o.frequency.exponentialRampToValueAtTime(Math.max(30, opts.glide), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(opts.vol ?? 0.4, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private hiss(dur: number, from: number, to: number, vol: number, delay = 0) {
    const ctx = this.ready();
    if (!ctx || !this.master) return;
    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(Math.max(50, from), t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(50, to), t0 + dur);
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.1);
  }

  /* ── one-shots ── */
  whoosh() { this.hiss(0.5, 500, 3500, 0.5); }
  cameraWhoosh() { this.hiss(0.45, 300, 1800, 0.22); }
  suction() { this.hiss(0.35, 2500, 600, 0.45); this.tone(300, 0.3, { glide: 90, vol: 0.15 }); }
  thunk() { this.tone(120, 0.15, { glide: 55, vol: 0.6 }); this.hiss(0.06, 1200, 400, 0.25); }
  stamp() { this.tone(95, 0.2, { glide: 50, vol: 0.7 }); this.hiss(0.1, 2000, 300, 0.3); }
  beep(i = 0) { this.tone(620 + i * 90, 0.08, { type: "square", vol: 0.1 }); }
  ping(i = 0) { this.tone(1200 + i * 70, 0.12, { glide: 900 + i * 70, vol: 0.1 }); }
  ding() { this.tone(880, 0.5, { vol: 0.18 }); this.tone(1760, 0.4, { vol: 0.07 }); }
  chime() { [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 0.55, { vol: 0.16, delay: i * 0.09 })); }
  buzz() { this.tone(110, 0.35, { type: "sawtooth", vol: 0.22 }); this.tone(104, 0.35, { type: "sawtooth", vol: 0.18 }); }
  klaxon() {
    [0, 0.28].forEach((d) => {
      this.tone(440, 0.22, { type: "square", vol: 0.13, delay: d });
      this.tone(300, 0.22, { type: "square", vol: 0.13, delay: d + 0.14 });
    });
  }
  splash() { this.hiss(0.6, 2500, 250, 0.6); }
  gurgle() { for (let i = 0; i < 5; i++) this.tone(180 + Math.random() * 160, 0.12, { glide: 120, vol: 0.13, delay: i * 0.11 }); }
  pour() { this.hiss(1.6, 900, 1400, 0.16); }
  spring() { this.tone(220, 0.35, { glide: 150, vol: 0.2 }); this.tone(180, 0.25, { glide: 240, vol: 0.12, delay: 0.12 }); }
  crystal() { this.tone(660, 1.1, { type: "triangle", vol: 0.15 }); this.tone(990, 0.9, { type: "triangle", vol: 0.09, delay: 0.05 }); }
}

export const sfx = new Sfx();
