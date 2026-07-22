import { Container, Graphics, Sprite, Text } from "pixi.js";
import { C, MONO } from "./palette";
import type { TexKit } from "./textures";

export const VIEW_W = 1400;
export const VIEW_H = 900;
export const FLOOR_Y = 700;
export const WALK_Y = 640;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
/** true exactly once when t crosses mark (given previous frame's t) */
export const crossed = (prev: number, t: number, mark: number) => prev < mark && t >= mark;

export function mono(
  text: string, size: number, color: number,
  opts: { ls?: number; weight?: "400" | "600" | "700"; anchor?: number; alpha?: number } = {},
): Text {
  const t = new Text({
    text,
    style: { fontFamily: MONO, fontSize: size, fill: color, letterSpacing: opts.ls ?? 0, fontWeight: opts.weight ?? "600" },
  });
  t.resolution = 2;
  if (opts.anchor !== undefined) t.anchor.set(opts.anchor);
  if (opts.alpha !== undefined) t.alpha = opts.alpha;
  return t;
}

/* ── Shared flask-creature drawing (hero uses s=1, extras smaller) ── */
export function flaskGraphic(s: number, liquid: number, liquidDeep: number) {
  const c = new Container();
  const body = new Container();

  const legL = new Graphics().roundRect(-4.5 * s, 0, 9 * s, 24 * s, 4.5 * s).fill(0x9fb8ac);
  legL.position.set(-15 * s, 27 * s);
  const legR = new Graphics().roundRect(-4.5 * s, 0, 9 * s, 24 * s, 4.5 * s).fill(0x9fb8ac);
  legR.position.set(15 * s, 27 * s);
  body.addChild(legL, legR);

  const f = new Graphics();
  f.roundRect(-15 * s, -66 * s, 30 * s, 15 * s, 4.5 * s).fill(0x8a6a4a);
  f.rect(-12 * s, -51 * s, 24 * s, 24 * s).fill({ color: 0x22302a, alpha: 0.5 });
  f.circle(0, 6 * s, 33 * s).fill({ color: 0x22302a, alpha: 0.5 });
  f.circle(0, 12 * s, 25.5 * s).fill({ color: liquid, alpha: 0.95 });
  f.circle(0, 12 * s, 25.5 * s).stroke({ width: 3 * s, color: liquidDeep, alpha: 0.7 });
  f.circle(-10.5 * s, 24 * s, 3.3 * s).fill({ color: 0xffffff, alpha: 0.5 });
  f.circle(7.5 * s, 28.5 * s, 2.4 * s).fill({ color: 0xffffff, alpha: 0.4 });
  f.circle(0, 6 * s, 33 * s).stroke({ width: 3.6 * s, color: 0x9fb8ac, alpha: 0.85 });
  f.rect(-12 * s, -51 * s, 24 * s, 24 * s).stroke({ width: 3 * s, color: 0x9fb8ac, alpha: 0.7 });
  f.ellipse(-13.5 * s, -9 * s, 5.4 * s, 10.8 * s).fill({ color: 0xffffff, alpha: 0.22 });
  f.circle(-10.5 * s, 7.5 * s, 4.2 * s).fill(C.canvas);
  f.circle(10.5 * s, 7.5 * s, 4.2 * s).fill(C.canvas);
  f.moveTo(-7.5 * s, 21 * s).quadraticCurveTo(0, 27 * s, 7.5 * s, 21 * s).stroke({ width: 3.3 * s, color: C.canvas, cap: "round" });
  body.addChild(f);
  c.addChild(body);
  return { c, body, legL, legR };
}

export class Hero {
  c = new Container();
  body: Container;
  private legL: Graphics;
  private legR: Graphics;
  private ring: Container;
  private pets: Sprite[] = [];
  private trail: { x: number; y: number }[] = [];
  walkPhase = 0;
  x = 200;
  y = WALK_Y;

  constructor(T: TexKit) {
    const sh = new Sprite(T.dotWhite);
    sh.anchor.set(0.5);
    sh.tint = 0x000000;
    sh.alpha = 0.4;
    sh.position.set(0, 52);
    sh.width = 70;
    sh.height = 16;
    this.c.addChild(sh);

    const glow = new Sprite(T.glowGreen);
    glow.anchor.set(0.5);
    glow.width = glow.height = 170;
    glow.alpha = 0.5;
    glow.blendMode = "add";
    this.c.addChild(glow);

    const fg = flaskGraphic(1, C.bch400, C.bch600);
    this.body = fg.body;
    this.legL = fg.legL;
    this.legR = fg.legR;

    this.ring = new Container();
    for (let i = 0; i < 12; i++) {
      const d = new Sprite(T.dotWhite);
      d.anchor.set(0.5);
      d.tint = C.neon300;
      d.width = d.height = 10;
      const a = (i / 12) * Math.PI * 2;
      d.position.set(Math.cos(a) * 62, Math.sin(a) * 62);
      this.ring.addChild(d);
    }
    this.c.addChild(this.ring);

    for (let i = 0; i < 3; i++) {
      const p = new Sprite(T.dotWhite);
      p.anchor.set(0.5);
      p.tint = 0xe8b547;
      p.width = p.height = 20;
      this.c.addChild(p);
      this.pets.push(p);
    }

    this.c.addChild(fg.c);
    this.c.position.set(this.x, this.y);
  }

  update(dt: number, moving: boolean, time: number) {
    if (moving) {
      this.walkPhase += dt * 9;
      this.legL.rotation = Math.sin(this.walkPhase) * 0.5;
      this.legR.rotation = Math.sin(this.walkPhase + Math.PI) * 0.5;
      this.body.y = -Math.abs(Math.sin(this.walkPhase)) * 4;
    } else {
      this.legL.rotation *= 0.85;
      this.legR.rotation *= 0.85;
      this.body.y = Math.sin(time * 2.4) * 2.5;
    }
    this.ring.rotation += dt * 0.9;

    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > 70) this.trail.pop();
    this.pets.forEach((p, i) => {
      const pt = this.trail[Math.min(this.trail.length - 1, (i + 1) * 12)] ?? this.trail[0];
      p.position.set(pt.x - this.x, pt.y - this.y + 34 + Math.sin(time * 3 + i) * 3);
      p.visible = this.c.visible;
    });

    this.c.position.set(this.x, this.y);
  }
}

/** Background flask citizen — bobs in place, optional token pet. */
export class BgFlask {
  c: Container;
  body: Container;
  label: Text | null = null;
  baseX: number;
  baseY: number;

  constructor(T: TexKit, x: number, y: number, liquid = C.bch400, pet?: number, labelTxt?: string) {
    const fg = flaskGraphic(0.78, liquid, C.bch600);
    this.c = fg.c;
    this.body = fg.body;
    this.baseX = x;
    this.baseY = y;
    const glow = new Sprite(T.glowGreen);
    glow.anchor.set(0.5);
    glow.width = glow.height = 120;
    glow.alpha = 0.4;
    glow.blendMode = "add";
    this.c.addChildAt(glow, 0);
    if (pet !== undefined) {
      const p = new Sprite(T.dotWhite);
      p.anchor.set(0.5);
      p.tint = pet;
      p.width = p.height = 16;
      p.position.set(-42, 30);
      this.c.addChild(p);
    }
    if (labelTxt) {
      this.label = mono(labelTxt, 13, C.bch400, { anchor: 0.5 });
      this.label.position.set(0, -84);
      this.label.visible = false;
      this.c.addChild(this.label);
    }
    this.c.position.set(x, y);
  }

  bob(time: number, phase: number) {
    this.body.y = Math.sin(time * 2.2 + phase) * 3;
    this.c.position.set(this.baseX, this.baseY);
  }
}

/* ── Layers + parallax ── */
export interface RideLayers {
  back: Container;
  main: Container;
  lights: Container;
  fore: Container;
  all: Container[];
}

export function makeLayers(stage: Container): RideLayers {
  const back = new Container();
  const main = new Container();
  const lights = new Container();
  const fore = new Container();
  const all = [back, main, lights, fore];
  all.forEach((l) => {
    l.visible = false;
    stage.addChild(l);
  });
  return { back, main, lights, fore, all };
}

export function applyParallax(L: RideLayers, camX: number, zoom: number) {
  const F: [Container, number][] = [[L.back, 0.8], [L.main, 1], [L.lights, 1], [L.fore, 1.3]];
  for (const [layer, f] of F) {
    layer.x = -camX * f + VIEW_W / 2 - VIEW_W * (1 - f) / 2;
    layer.scale.set(zoom);
    layer.y = (1 - zoom) * (VIEW_H / 2);
  }
}

/* ── Set-building helpers ── */
export interface ShellOpts {
  w: number;
  wallCol?: number;
  topCol?: number;
  conveyor?: boolean;
  fixtures?: number[];
  fixTint?: number;
  washTint: number;
  washAlpha: number;
  pillars?: number[];
  skipWall?: boolean;
}

export function roomShell(L: RideLayers, T: TexKit, o: ShellOpts): { beltDashes: Graphics } {
  if (!o.skipWall) {
    const wall = new Graphics();
    const wc = o.wallCol ?? 0x233029;
    wall.rect(-400, 0, o.w + 800, 760).fill(wc);
    wall.rect(-400, 0, o.w + 800, 110).fill({ color: o.topCol ?? 0x2c3a32, alpha: 0.9 });
    for (let px = -240; px < o.w + 400; px += 240) {
      wall.moveTo(px, 12).lineTo(px, 748).stroke({ width: 2, color: 0x141b16, alpha: 0.8 });
    }
    wall.rect(-400, 748, o.w + 800, 14).fill(0x141b16);
    wall.roundRect(-400, 40, o.w + 800, 16, 8).fill({ color: 0xffffff, alpha: 0.05 });
    wall.roundRect(-400, 64, o.w + 800, 9, 4.5).fill({ color: 0x000000, alpha: 0.15 });
    L.back.addChild(wall);
  }

  const floor = new Graphics();
  floor.rect(-400, FLOOR_Y, o.w + 800, 200).fill(0x18211b);
  for (let px = -400; px < o.w + 400; px += 120) {
    floor.rect(px, FLOOR_Y, 60, 200).fill({ color: 0x1c2620, alpha: 0.8 });
  }
  floor.moveTo(-400, FLOOR_Y).lineTo(o.w + 400, FLOOR_Y).stroke({ width: 3, color: 0x39463e });
  if (o.conveyor) {
    floor.rect(-400, FLOOR_Y - 8, o.w + 800, 20).fill(0x121a15);
    floor.rect(-400, FLOOR_Y - 8, o.w + 800, 5).fill(0x2e3a33);
    for (let px = -360; px < o.w + 400; px += 90) {
      floor.circle(px, FLOOR_Y + 22, 11).fill(0x141b17).circle(px, FLOOR_Y + 22, 11).stroke({ width: 3, color: 0x2e3a33 });
    }
  }
  L.main.addChild(floor);
  const beltDashes = new Graphics();
  L.main.addChild(beltDashes);

  for (const lx of o.fixtures ?? []) {
    const fix = new Graphics();
    fix.roundRect(lx - 45, 8, 90, 10, 5).fill(0x39463e);
    fix.roundRect(lx - 38, 14, 76, 5, 2.5).fill({ color: o.fixTint ?? 0xdff4ff, alpha: 0.95 });
    L.main.addChild(fix);
    const pool = new Sprite(T.coneWhite);
    pool.tint = o.fixTint ?? 0xcfeaff;
    pool.anchor.set(0.5, 0);
    pool.position.set(lx, 18);
    pool.width = 400;
    pool.height = 690;
    pool.alpha = 0.5;
    pool.blendMode = "add";
    L.lights.addChild(pool);
  }

  const wash = new Sprite(T.glowWhiteBig);
  wash.tint = o.washTint;
  wash.anchor.set(0.5);
  wash.position.set(o.w / 2, 420);
  wash.width = o.w * 1.1;
  wash.height = 1000;
  wash.alpha = o.washAlpha;
  wash.blendMode = "add";
  L.lights.addChild(wash);

  for (const px of o.pillars ?? []) {
    const pillar = new Graphics();
    pillar.rect(px - 55, -40, 110, 980).fill(0x0a0e0c);
    pillar.rect(px - 55, -40, 12, 980).fill(0x141b17);
    pillar.rect(px + 43, -40, 12, 980).fill(0x060908);
    L.fore.addChild(pillar);
  }
  const rail = new Graphics();
  rail.rect(-600, 856, o.w * 1.6, 16).fill(0x111713);
  rail.rect(-600, 852, o.w * 1.6, 5).fill(0x1c2620);
  for (let px = -560; px < o.w * 1.5; px += 160) rail.rect(px, 868, 10, 40).fill(0x141b17);
  L.fore.addChild(rail);

  return { beltDashes };
}

export function signage(L: RideLayers, T: TexKit, x: number, y: number, title: string, sub: string, accent: number, size = 40) {
  const sign = new Container();
  sign.position.set(x, y);
  const signT = mono(title, size, accent, { ls: 8, weight: "700" });
  const halo = new Sprite(T.glowWhite);
  halo.tint = accent;
  halo.anchor.set(0, 0.5);
  halo.position.set(-30, size * 0.6);
  halo.width = signT.width + 120;
  halo.height = size * 2.6;
  halo.alpha = 0.18;
  halo.blendMode = "add";
  const signSub = mono(sub, 11, C.fgMute, { ls: 2, weight: "400" });
  signSub.position.set(2, size * 1.45);
  sign.addChild(halo, signT, signSub);
  L.back.addChild(sign);
  return sign;
}

export function roundel(L: RideLayers, T: TexKit, x: number, y: number, s = 1, labels = true) {
  const r = new Container();
  r.position.set(x, y);
  r.scale.set(s);
  const rg = new Graphics();
  rg.circle(0, 0, 64).fill(C.bch500);
  rg.circle(0, 0, 64).stroke({ width: 4, color: 0x0a8f6b });
  rg.circle(0, 0, 52).stroke({ width: 2.5, color: 0xffffff, alpha: 0.85 });
  r.addChild(rg);
  const bMark = mono("B", 62, 0xffffff, { weight: "700", anchor: 0.5 });
  bMark.rotation = -0.24;
  bMark.position.set(0, 2);
  r.addChild(bMark);
  if (labels) {
    const l1 = mono("BITCOIN CASH FULL NODE", 12, C.fg, { ls: 2, anchor: 0.5 });
    l1.position.set(0, 92);
    const l2 = mono("BCHN v28.0 · chain: BCH · peers: 14", 9, C.fgMute, { anchor: 0.5, weight: "400" });
    l2.position.set(0, 110);
    r.addChild(l1, l2);
  }
  L.back.addChild(r);
  const glow = new Sprite(T.glowGreen);
  glow.anchor.set(0.5);
  glow.position.set(x, y);
  glow.width = 300 * s;
  glow.height = 300 * s;
  glow.alpha = 0.3;
  glow.blendMode = "add";
  L.back.addChild(glow);
  return r;
}

export function tubeAt(L: RideLayers, x: number, topY = -20, h = 700) {
  const tube = new Graphics();
  tube.roundRect(x - 42, topY, 84, h, 30).fill({ color: 0x27352d, alpha: 0.65 });
  tube.roundRect(x - 42, topY, 84, h, 30).stroke({ width: 4, color: 0x4a5850, alpha: 0.95 });
  tube.moveTo(x - 26, topY + 20).lineTo(x - 26, topY + h - 40).stroke({ width: 4, color: 0xffffff, alpha: 0.12 });
  tube.roundRect(x - 48, topY + h - 24, 96, 20, 8).fill(0x39463e);
  L.main.addChild(tube);
}

/** Floor-mounted down-pipe: an open-top tube through the floor, for descents. */
export function tubeDownAt(L: RideLayers, x: number, topY = 610, h = 320) {
  const tube = new Graphics();
  tube.roundRect(x - 42, topY, 84, h, 30).fill({ color: 0x27352d, alpha: 0.65 });
  tube.roundRect(x - 42, topY, 84, h, 30).stroke({ width: 4, color: 0x4a5850, alpha: 0.95 });
  tube.moveTo(x - 26, topY + 16).lineTo(x - 26, topY + h - 20).stroke({ width: 4, color: 0xffffff, alpha: 0.12 });
  tube.roundRect(x - 48, topY - 6, 96, 20, 8).fill(0x39463e);
  // collar where it meets the floor
  tube.roundRect(x - 52, FLOOR_Y - 6, 104, 12, 5).fill(0x39463e);
  L.main.addChild(tube);
}

/** Block crystal gem. */
export function gem(T: TexKit, o: { r: number; dots: number; label?: string; face?: boolean; accent?: number }) {
  const acc = o.accent ?? 0x7fc4ff;
  const c = new Container();
  const g = new Graphics();
  const r = o.r;
  const pts = [-r, r * 0.17, -r * 0.65, -r * 0.57, r * 0.65, -r * 0.57, r, r * 0.17, r * 0.52, r * 0.74, -r * 0.52, r * 0.74];
  g.ellipse(0, r * 0.87, r * 1.1, r * 0.13).fill({ color: 0x000000, alpha: 0.4 });
  g.poly(pts).fill({ color: 0x10283a, alpha: 0.92 });
  g.poly(pts).stroke({ width: 3, color: acc, alpha: 0.9 });
  g.moveTo(-r * 0.65, -r * 0.57).lineTo(-r * 0.22, r * 0.74).stroke({ width: 1.5, color: 0x9fc8e0, alpha: 0.25 });
  g.moveTo(r * 0.65, -r * 0.57).lineTo(r * 0.22, r * 0.74).stroke({ width: 1.5, color: 0x9fc8e0, alpha: 0.25 });
  g.moveTo(-r, r * 0.17).lineTo(r, r * 0.17).stroke({ width: 1.5, color: 0x9fc8e0, alpha: 0.18 });
  for (let k = 0; k < o.dots; k++) {
    const gx = rand(-r * 0.55, r * 0.55);
    const gy = rand(-r * 0.3, r * 0.5);
    g.circle(gx, gy, r * 0.07).fill({ color: 0x8fd4ff, alpha: 0.75 });
  }
  c.addChild(g);
  if (o.face) {
    const face = new Graphics();
    face.circle(0, r * 0.05, r * 0.22).fill({ color: C.bch400, alpha: 0.9 });
    face.circle(-r * 0.08, r * 0.01, r * 0.035).fill(C.canvas);
    face.circle(r * 0.08, r * 0.01, r * 0.035).fill(C.canvas);
    face.moveTo(-r * 0.06, r * 0.12).quadraticCurveTo(0, r * 0.17, r * 0.06, r * 0.12)
      .stroke({ width: 2.5, color: C.canvas, cap: "round" });
    c.addChild(face);
  }
  if (o.label) {
    const l = mono(o.label, 14, acc, { anchor: 0.5 });
    l.position.set(0, -r * 0.82);
    c.addChild(l);
  }
  const glow = new Sprite(T.glowWhite);
  glow.tint = acc;
  glow.anchor.set(0.5);
  glow.width = r * 3.2;
  glow.height = r * 2.6;
  glow.alpha = 0.25;
  glow.blendMode = "add";
  c.addChildAt(glow, 0);
  return c;
}

/* ── Hero pose + tube-transit choreography ── */
export interface HeroPose {
  x: number;
  y: number;
  moving: boolean;
  visible: boolean;
  /** in-tube squeeze: body x-scale (0.55 = fully squeezed) */
  squeezeX?: number;
  /** landing squash: body y-scale (bounces back to 1) */
  squashY?: number;
}

export const TUBE_ENTER_DUR = 1.3;

/** Arrival: slide down the tube squeezed, land with a squash-bounce. */
export function enterViaTube(t: number, tubeX: number): HeroPose | null {
  if (t >= TUBE_ENTER_DUR) return null;
  const slide = TUBE_ENTER_DUR - 0.45;
  if (t < slide) {
    const k = t / slide;
    return { x: tubeX, y: WALK_Y - (1 - k * k) * 560, moving: false, visible: true, squeezeX: 0.55 };
  }
  const k = (t - slide) / 0.45;
  const squashY = k < 0.4 ? 0.62 : 0.62 + ((k - 0.4) / 0.6) * 0.38;
  return { x: tubeX, y: WALK_Y, moving: false, visible: true, squashY };
}

/** Departure: walk to the tube, squeeze in, whoosh out of frame. dir: -1 up, +1 down. */
export function exitViaTube(t: number, te: number, fromX: number, tubeX: number, walkSpeed: number, dir: 1 | -1): HeroPose {
  const dist = Math.abs(tubeX - fromX);
  const arrive = te + dist / walkSpeed;
  if (t < arrive) {
    return { x: fromX + Math.sign(tubeX - fromX) * walkSpeed * (t - te), y: WALK_Y, moving: true, visible: true };
  }
  const k = t - arrive;
  if (k < 0.35) return { x: tubeX, y: WALK_Y, moving: false, visible: true, squeezeX: 1 - (k / 0.35) * 0.45 };
  const k2 = k - 0.35;
  return { x: tubeX, y: WALK_Y + dir * k2 * k2 * 2400, moving: false, visible: k2 < 0.55, squeezeX: 0.55 };
}

/* ── Act contract ── */
export interface ActDef {
  title: string;
  dur: number;
  worldW: number;
  L: RideLayers;
  captions: [number, number, string][];
  heroAt(t: number): HeroPose;
  camX(t: number, heroX: number): number;
  zoom?(t: number): number;
  update(t: number, dt: number): void;
  reset(): void;
}
