import { Container, Sprite, Texture } from "pixi.js";

/* ── Easing ── */
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutBounce = (t: number) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

/* ── Anim runner: tiny tween list driven by sim time (freezes on pause) ── */
interface Anim {
  age: number;
  dur: number;
  update: (t01: number) => void;
  done?: () => void;
}

export class Anims {
  private list: Anim[] = [];

  add(dur: number, update: (t01: number) => void, done?: () => void) {
    this.list.push({ age: 0, dur, update, done });
  }

  tween(
    obj: any, prop: string, from: number, to: number, dur: number,
    ease: (t: number) => number = easeInOutCubic, done?: () => void,
  ) {
    this.add(dur, (t) => { obj[prop] = from + (to - from) * ease(t); }, done);
  }

  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i];
      a.age += dt;
      const t = Math.min(1, a.age / a.dur);
      a.update(t);
      if (t >= 1) {
        this.list.splice(i, 1);
        a.done?.();
      }
    }
  }
}

/* ── Particles ── */
interface Particle {
  s: Sprite;
  x: number; y: number;
  vx: number; vy: number;
  ax: number; ay: number;
  age: number; life: number;
  r0: number; r1: number;
  a0: number; a1: number;
  vr: number;
  wobble: number; wFreq: number; wPhase: number;
}

export interface SpawnOpts {
  tex: Texture;
  x: number; y: number;
  vx?: number; vy?: number;
  ax?: number; ay?: number;
  life?: number;
  r0?: number; r1?: number;
  a0?: number; a1?: number;
  vr?: number;
  wobble?: number; wFreq?: number;
  tint?: number;
  add?: boolean;
}

export class Particles {
  private live: Particle[] = [];
  private pool: Sprite[] = [];

  constructor(private layer: Container, private max = 600) {}

  spawn(o: SpawnOpts) {
    if (this.live.length >= this.max) return;
    const s = this.pool.pop() ?? new Sprite();
    s.texture = o.tex;
    s.anchor.set(0.5);
    s.tint = o.tint ?? 0xffffff;
    s.blendMode = o.add === false ? "normal" : "add";
    s.rotation = Math.random() * Math.PI * 2;
    this.layer.addChild(s);
    this.live.push({
      s,
      x: o.x, y: o.y,
      vx: o.vx ?? 0, vy: o.vy ?? 0,
      ax: o.ax ?? 0, ay: o.ay ?? 0,
      age: 0, life: o.life ?? 1,
      r0: o.r0 ?? 1, r1: o.r1 ?? 1,
      a0: o.a0 ?? 1, a1: o.a1 ?? 0,
      vr: o.vr ?? 0,
      wobble: o.wobble ?? 0, wFreq: o.wFreq ?? 3,
      wPhase: Math.random() * Math.PI * 2,
    });
  }

  update(dt: number) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        this.layer.removeChild(p.s);
        this.pool.push(p.s);
        this.live.splice(i, 1);
        continue;
      }
      p.vx += p.ax * dt;
      p.vy += p.ay * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const wob = p.wobble ? Math.sin(p.age * p.wFreq + p.wPhase) * p.wobble : 0;
      p.s.position.set(p.x + wob, p.y);
      p.s.rotation += p.vr * dt;
      const r = p.r0 + (p.r1 - p.r0) * t;
      p.s.scale.set(r);
      p.s.alpha = p.a0 + (p.a1 - p.a0) * t;
    }
  }
}

/* ── Camera: pivot-based pan/zoom + ambient drift + shake ── */
export class Camera {
  private tx = 700; private ty = 450; private ts = 1;
  private cx = 700; private cy = 450; private cs = 1;
  private shakeAmp = 0;

  constructor(private world: Container, private reduced: boolean) {
    world.position.set(700, 450);
    world.pivot.set(700, 450);
  }

  focus(x: number, y: number, scale: number) {
    if (this.reduced) return;
    this.tx = x; this.ty = y; this.ts = scale;
  }

  neutral() {
    this.tx = 700; this.ty = 450; this.ts = 1;
  }

  shake(strength: number) {
    if (this.reduced) return;
    this.shakeAmp = Math.max(this.shakeAmp, strength);
  }

  update(dt: number, time: number) {
    const k = Math.min(1, dt * 3.2);
    this.cx += (this.tx - this.cx) * k;
    this.cy += (this.ty - this.cy) * k;
    this.cs += (this.ts - this.cs) * k;

    // Ambient drift only when at neutral-ish zoom
    const driftX = this.reduced ? 0 : Math.sin(time * 0.13) * 5 * (2 - this.cs);
    const driftY = this.reduced ? 0 : Math.cos(time * 0.09) * 3 * (2 - this.cs);

    let sx = 0; let sy = 0;
    if (this.shakeAmp > 0.15) {
      sx = (Math.random() * 2 - 1) * this.shakeAmp;
      sy = (Math.random() * 2 - 1) * this.shakeAmp;
      this.shakeAmp *= Math.pow(0.0025, dt); // fast decay
    } else {
      this.shakeAmp = 0;
    }

    this.world.pivot.set(this.cx + driftX + sx, this.cy + driftY + sy);
    this.world.scale.set(this.cs);
  }
}
