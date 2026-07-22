import { Container, Graphics, Rectangle, Sprite, Text } from "pixi.js";
import { C, MONO } from "./palette";
import type { TexKit } from "./textures";

/**
 * The facility is one BCH full node, drawn as a Fallout-Shelter-style
 * cutaway: discrete lit room-boxes carved into dark rock, connected by
 * pneumatic tubes. Each room is a real node subsystem:
 *   roof — broadcast antenna (peer propagation)
 *   01 SYNTHESIS   — wallet: tx construction & signing
 *   02 VALIDATION  — script/sig checks, mempool admission
 *   03 MEMPOOL     — accepted txs wait (first-seen, DSProofs)
 *   04 MINING      — candidate assembly, CTOR, hash search
 *   05 ARCHIVE     — the chain: confirmed forever
 */

/* ── Geometry shared with the sim (unchanged — routes still valid) ── */
export const GEOM = {
  TOWER: { x1: 120, x2: 1280, y1: 96, y2: 884 },
  F1PATH: 246,
  F2PATH: 388,
  F4PATH: 726,
  VIV: { minX: 230, maxX: 1080, minY: 472, maxY: 596 },
  TUBE1: { x: 1160, y1: 246, y2: 388 },
  TUBE2: { x: 230, y1: 388, y2: 482 },
  TUBE3: { x: 1105, y1: 596, y2: 726 },
  POD: { x: 310, y: 246 },
  SCAN: { x: 660, y: 388 },
  VENT: { x: 1128, y: 522 },
  SLOT0X: 300,
  SLOTW: 66,
  REACTORX: 1120,
  DISPENSER: { x: 990, y: 700 },
  ARCH: { y: 826, newestX: 1080, gap: 148 },
  ANTENNA: { x: 1040, y: 36 },
  FREIGHT: { x: 1245, y: 812 },
};

/* Room interior boxes (x, y, w, h) — paths above run inside these. */
const ROOMS = {
  synthesis: { x: 140, y: 112, w: 1120, h: 148 },
  validation: { x: 140, y: 276, w: 1120, h: 126 },
  vivarium: { x: 140, y: 418, w: 1120, h: 192 },
  reactor: { x: 140, y: 626, w: 1120, h: 114 },
  archive: { x: 140, y: 756, w: 1120, h: 128 },
};

export interface Layers {
  bg: Container;
  mid: Container;
  links: Container;
  chars: Container;
  lights: Container;
  particles: Container;
}

export interface SceneRefs {
  pipeLeds: Sprite[];
  neonSigns: { obj: Container; phase: number }[];
  lampBulbs: Sprite[];
  lampCones: Sprite[];
  breathers: { obj: Container; phase: number }[];
  blinkers: { obj: Container; phase: number }[];
  plantLeaves: Container[];
  /* synthesis */
  pourArm: Container;
  podGlow: Sprite;
  scientistZone: Container;
  vialSlots: Container;
  /* validation */
  beam: Graphics;
  botEye: Sprite;
  /* vivarium */
  clockHand: Graphics;
  clockText: Text;
  guardZone: Container;
  guardBody: Container;
  /* reactor */
  rotor: Container;
  gaugeNeedle: Graphics;
  reactorGlow: Sprite;
  beltG: Graphics;
  reactorZone: Container;
  candSlots: Container;
  candCount: Text;
  /* archive */
  blockStack: Container;
  /* sky */
  skylineWindows: Sprite[];
  antennaLight: Sprite;
  /* staff */
  janitor: Container;
}

export function mono(
  text: string, size: number, color: number,
  opts: { ls?: number; weight?: "400" | "600" | "700"; anchor?: number } = {},
): Text {
  const t = new Text({
    text,
    style: {
      fontFamily: MONO,
      fontSize: size,
      fill: color,
      letterSpacing: opts.ls ?? 0,
      fontWeight: opts.weight ?? "600",
    },
  });
  t.resolution = 2.5;
  if (opts.anchor !== undefined) t.anchor.set(opts.anchor);
  return t;
}

function shadow(parent: Container, x: number, y: number, rx: number, ry: number, alpha = 0.35) {
  const g = new Graphics().ellipse(x, y, rx, ry).fill({ color: 0x000000, alpha });
  parent.addChild(g);
  return g;
}

/* ── Room-box builder: back wall, wash light, ceiling fixtures, frame, plate ── */
interface RoomSpec {
  x: number; y: number; w: number; h: number;
  wash: number; washAlpha: number;
  lightXs: number[]; lightCol: number;
  accent: number;
  num: string; title: string; sub: string; phase: number;
}

function roomBox(layers: Layers, T: TexKit, refs: SceneRefs, r: RoomSpec) {
  /* back wall — bright enough to read as a lit room against the dark rock */
  const g = new Graphics();
  g.rect(r.x, r.y, r.w, r.h).fill(0x202a24);
  g.rect(r.x, r.y, r.w, Math.min(34, r.h * 0.25)).fill({ color: 0x2a362f, alpha: 0.8 });
  for (let px = r.x + 160; px < r.x + r.w - 20; px += 160) {
    g.moveTo(px, r.y + 6).lineTo(px, r.y + r.h - 6).stroke({ width: 1, color: 0x141b17, alpha: 0.8 });
  }
  g.rect(r.x, r.y + r.h - 8, r.w, 8).fill(0x151c18);
  g.rect(r.x, r.y, r.w, 3).fill(0x33403a);
  layers.bg.addChild(g);

  /* ceiling cable sag between fixtures */
  if (r.lightXs.length > 1) {
    const cable = new Graphics();
    for (let i = 0; i < r.lightXs.length - 1; i++) {
      const a = r.lightXs[i];
      const b = r.lightXs[i + 1];
      cable.moveTo(a, r.y + 8).quadraticCurveTo((a + b) / 2, r.y + 26, b, r.y + 8)
        .stroke({ width: 1.5, color: 0x1d2420 });
    }
    layers.bg.addChild(cable);
  }

  /* color wash — the room's light temperature */
  const wash = new Sprite(T.glowWhiteBig);
  wash.tint = r.wash;
  wash.anchor.set(0.5);
  wash.position.set(r.x + r.w / 2, r.y + r.h / 2);
  wash.width = r.w * 1.2;
  wash.height = r.h * 1.9;
  wash.alpha = r.washAlpha;
  wash.blendMode = "add";
  layers.lights.addChild(wash);

  /* ceiling light fixtures + pools */
  for (const lx of r.lightXs) {
    const fix = new Graphics();
    fix.roundRect(lx - 26, r.y + 3, 52, 5, 2.5).fill(C.lineMid);
    fix.roundRect(lx - 22, r.y + 6, 44, 3, 1.5).fill({ color: r.lightCol, alpha: 0.95 });
    layers.bg.addChild(fix);
    const glow = new Sprite(T.glowWhite);
    glow.tint = r.lightCol;
    glow.anchor.set(0.5);
    glow.position.set(lx, r.y + 8);
    glow.width = 100;
    glow.height = 40;
    glow.blendMode = "add";
    glow.alpha = 0.9;
    layers.lights.addChild(glow);
    refs.lampBulbs.push(glow);
    const pool = new Sprite(T.coneWhite);
    pool.tint = r.lightCol;
    pool.anchor.set(0.5, 0);
    pool.position.set(lx, r.y + 9);
    pool.width = 190;
    pool.height = Math.min(r.h - 10, 190);
    pool.blendMode = "add";
    pool.alpha = 0.8;
    layers.lights.addChild(pool);
    refs.lampCones.push(pool);
  }

  /* frame */
  const f = new Graphics();
  f.rect(r.x - 5, r.y - 5, r.w + 10, r.h + 10).stroke({ width: 10, color: 0x232b26 });
  f.moveTo(r.x - 10, r.y - 10).lineTo(r.x + r.w + 10, r.y - 10).stroke({ width: 1.5, color: 0x39443d });
  f.moveTo(r.x - 10, r.y + r.h + 10).lineTo(r.x + r.w + 10, r.y + r.h + 10).stroke({ width: 1.5, color: 0x060908 });
  for (const [bx, by] of [
    [r.x - 5, r.y - 5], [r.x + r.w + 5, r.y - 5],
    [r.x - 5, r.y + r.h + 5], [r.x + r.w + 5, r.y + r.h + 5],
  ]) {
    f.circle(bx, by, 2.4).fill(0x0b0f0d).circle(bx, by, 2.4).stroke({ width: 1, color: 0x39443d });
  }
  layers.bg.addChild(f);

  /* numbered plate — accent-colored per room */
  const plate = new Container();
  plate.position.set(r.x + 18, r.y + 12);
  const numT = mono(r.num, 15, r.accent, { ls: 1 });
  const titleT = mono(r.title, 15, r.accent, { ls: 2 });
  titleT.position.set(numT.width + 12, 0);
  const dot = new Graphics().circle(numT.width + 6, 10, 1.5).fill({ color: r.accent, alpha: 0.6 });
  const subT = mono(r.sub, 7.5, C.fgMute, { ls: 0.5, weight: "400" });
  subT.position.set(0, 21);
  const halo = new Sprite(T.glowWhite);
  halo.tint = r.accent;
  halo.anchor.set(0, 0.5);
  halo.position.set(-10, 10);
  halo.width = numT.width + titleT.width + 52;
  halo.height = 46;
  halo.alpha = 0.16;
  halo.blendMode = "add";
  const underline = new Graphics()
    .moveTo(0, 17).lineTo((numT.width + titleT.width + 12) * 0.85, 17)
    .stroke({ width: 1, color: r.accent, alpha: 0.5 });
  plate.addChild(halo, numT, dot, titleT, underline, subT);
  layers.mid.addChild(plate);
  refs.neonSigns.push({ obj: plate, phase: r.phase });
}

/** Soft cast shadow on the back wall behind a prop. */
function wallShadow(layers: Layers, cx: number, cy: number, w: number, h: number) {
  const g = new Graphics()
    .roundRect(cx - w / 2 + 7, cy - h / 2 + 9, w, h, 8)
    .fill({ color: 0x000000, alpha: 0.28 });
  layers.bg.addChild(g);
}

/** Dashed walk-lane striping along a floor path. */
function walkLane(layers: Layers, y: number, x1: number, x2: number) {
  const g = new Graphics();
  for (let x = x1; x < x2; x += 30) {
    g.roundRect(x, y + 19, 16, 2.5, 1).fill({ color: 0x39443d, alpha: 0.55 });
  }
  layers.bg.addChild(g);
}

/** Small wall monitor with a blinking readout. */
function wallMonitor(layers: Layers, T: TexKit, refs: SceneRefs, x: number, y: number, col: number) {
  const m = new Graphics();
  m.roundRect(x - 21, y - 14, 42, 28, 2.5).fill(C.elevated);
  m.roundRect(x - 21, y - 14, 42, 4, 2.5).fill(C.lineHi);
  m.roundRect(x - 17, y - 9, 34, 19, 1.5).fill(0x0c1210);
  m.roundRect(x - 13, y - 5, 20, 2, 1).fill({ color: col, alpha: 0.7 });
  m.roundRect(x - 13, y - 1, 26, 2, 1).fill({ color: col, alpha: 0.45 });
  m.roundRect(x - 13, y + 3, 14, 2, 1).fill({ color: col, alpha: 0.55 });
  layers.mid.addChild(m);
  const led = new Sprite(T.glowWhite);
  led.tint = col;
  led.anchor.set(0.5);
  led.position.set(x + 13, y + 6);
  led.width = led.height = 10;
  led.blendMode = "add";
  layers.lights.addChild(led);
  refs.pipeLeds.push(led);
}

/** Stack of supply crates. */
function crates(layers: Layers, x: number, y: number) {
  const g = new Graphics();
  g.ellipse(x, y + 3, 26, 4).fill({ color: 0x000000, alpha: 0.3 });
  g.roundRect(x - 22, y - 18, 26, 20, 2).fill(C.elevated);
  g.roundRect(x - 22, y - 18, 26, 4, 2).fill(C.lineHi);
  g.roundRect(x - 2, y - 16, 22, 18, 2).fill(C.line);
  g.roundRect(x - 2, y - 16, 22, 3.5, 2).fill(C.lineMid);
  g.roundRect(x - 14, y - 34, 22, 17, 2).fill(C.line);
  g.roundRect(x - 14, y - 34, 22, 3.5, 2).fill(C.lineHi);
  g.moveTo(x - 14, y - 26).lineTo(x + 8, y - 26).stroke({ width: 2.5, color: C.warn, alpha: 0.35 });
  layers.mid.addChild(g);
}

/** Tiny hazard placard. */
function placard(layers: Layers, x: number, y: number) {
  const g = new Graphics();
  g.roundRect(x - 9, y - 6, 18, 12, 1.5).fill(0x111613);
  g.roundRect(x - 9, y - 6, 18, 12, 1.5).stroke({ width: 1, color: C.lineMid });
  for (let k = 0; k < 3; k++) {
    g.moveTo(x - 6 + k * 6, y + 4).lineTo(x - 2 + k * 6, y - 4).stroke({ width: 2, color: C.warn, alpha: 0.55 });
  }
  layers.mid.addChild(g);
}

/** Small staff blob (scientist / guard / bot bodies share this base). */
function staff(
  T: TexKit,
  kind: "scientist" | "guard" | "bot",
): { c: Container; body: Container; eyes: Container } {
  const c = new Container();
  const body = new Container();
  c.addChild(body);

  if (kind === "bot") {
    const g = new Graphics();
    g.roundRect(-12, -14, 24, 26, 8).fill(C.lineMid);
    g.roundRect(-12, -14, 24, 8, 8).fill(C.lineHi);
    g.circle(0, -18, 2).fill(C.bch500);
    g.moveTo(0, -16).lineTo(0, -14).stroke({ width: 1.5, color: C.lineHi });
    body.addChild(g);
    const eyes = new Container();
    const eyeG = new Graphics().roundRect(-7, -6, 14, 5, 2.5).fill(C.canvas);
    const pupil = new Graphics().circle(0, -3.5, 1.6).fill(C.bch400);
    eyes.addChild(eyeG, pupil);
    body.addChild(eyes);
    return { c, body, eyes };
  }

  const b = new Sprite(T.blobGrey);
  b.anchor.set(0.5);
  b.width = 46;
  b.height = 42;
  body.addChild(b);

  const face = new Graphics();
  const eyes = new Container();
  const eyeG = new Graphics()
    .circle(-7, -3, 2).fill(C.canvas)
    .circle(7, -3, 2).fill(C.canvas);
  eyes.addChild(eyeG);
  face.moveTo(-4, 6).quadraticCurveTo(0, 9, 4, 6).stroke({ width: 1.5, color: C.canvas, cap: "round" });
  body.addChild(face, eyes);

  const acc = new Graphics();
  if (kind === "scientist") {
    acc.circle(-7, -14, 5).stroke({ width: 1.6, color: C.warn });
    acc.circle(7, -14, 5).stroke({ width: 1.6, color: C.warn });
    acc.moveTo(-2, -14).lineTo(2, -14).stroke({ width: 1.6, color: C.warn });
    acc.moveTo(-18, -10).quadraticCurveTo(-24, -20, -16, -22).stroke({ width: 3, color: C.fgMid, cap: "round" });
    acc.moveTo(-10, -18).quadraticCurveTo(-12, -28, -4, -26).stroke({ width: 3, color: C.fgMid, cap: "round" });
    acc.moveTo(10, -18).quadraticCurveTo(14, -28, 20, -22).stroke({ width: 3, color: C.fgMid, cap: "round" });
    acc.moveTo(-10, 8).lineTo(0, 14).lineTo(10, 8).lineTo(10, 19).lineTo(-10, 19).closePath().fill(C.fg);
    acc.moveTo(0, 14).lineTo(0, 19).stroke({ width: 0.8, color: C.lineMid });
  } else {
    acc.ellipse(0, -19, 17, 2.5).fill(C.canvas);
    acc.moveTo(-12, -19).quadraticCurveTo(-12, -29, 0, -29).quadraticCurveTo(12, -29, 12, -19).closePath().fill(C.canvas);
    acc.moveTo(-11, -21).lineTo(11, -21).stroke({ width: 1.4, color: C.bch500 });
    acc.moveTo(-9, 7).lineTo(0, 13).lineTo(9, 7).lineTo(9, 18).lineTo(-9, 18).closePath().fill({ color: C.lineMid, alpha: 0.9 });
    acc.circle(0, 11, 1.1).fill(C.warn);
    acc.roundRect(12, 3, 9, 5, 1).fill(C.neon400);
    acc.circle(21, 5.5, 1.8).fill(C.neon400);
  }
  body.addChild(acc);
  return { c, body, eyes };
}

/* ═══════════════════════ Scene builder ═══════════════════════ */
export function buildScene(layers: Layers, T: TexKit): SceneRefs {
  const refs: SceneRefs = {
    pipeLeds: [],
    neonSigns: [],
    lampBulbs: [],
    lampCones: [],
    breathers: [],
    blinkers: [],
    plantLeaves: [],
    pourArm: new Container(),
    podGlow: new Sprite(),
    scientistZone: new Container(),
    vialSlots: new Container(),
    beam: new Graphics(),
    botEye: new Sprite(),
    clockHand: new Graphics(),
    clockText: mono("T+0s", 7, C.fgMid, { anchor: 0.5 }),
    guardZone: new Container(),
    guardBody: new Container(),
    rotor: new Container(),
    gaugeNeedle: new Graphics(),
    reactorGlow: new Sprite(),
    beltG: new Graphics(),
    reactorZone: new Container(),
    candSlots: new Container(),
    candCount: mono("empty", 6.5, C.fgMute, { weight: "400" }),
    blockStack: new Container(),
    skylineWindows: [],
    antennaLight: new Sprite(),
    janitor: new Container(),
  };

  const G = GEOM;

  /* ─── Sky ─── */
  const sky = new Graphics();
  sky.rect(0, 0, 1400, G.TOWER.y1).fill(0x070a09);
  layers.bg.addChild(sky);
  const stars = new Graphics();
  for (let i = 0; i < 46; i++) {
    stars.circle(Math.random() * 1400, Math.random() * (G.TOWER.y1 - 18), Math.random() * 0.9 + 0.3)
      .fill({ color: 0xdde5e0, alpha: 0.25 + Math.random() * 0.4 });
  }
  layers.bg.addChild(stars);
  const skyline = new Graphics();
  for (const [bx, by, bw, bh] of [[8, 58, 52, 38], [66, 72, 42, 24], [1288, 54, 48, 42], [1342, 70, 40, 26]]) {
    skyline.rect(bx, by, bw, bh).fill(0x101612);
    skyline.rect(bx, by, bw, 3).fill(C.line);
  }
  layers.bg.addChild(skyline);
  for (const [wx, wy] of [[28, 72], [50, 82], [86, 84], [1308, 68], [1330, 80], [1358, 82]]) {
    const w = new Sprite(T.glowGreen);
    w.anchor.set(0.5);
    w.position.set(wx, wy);
    w.width = w.height = 16;
    w.alpha = 0.25;
    w.blendMode = "add";
    layers.lights.addChild(w);
    refs.skylineWindows.push(w);
  }

  /* ─── Rock surround ─── */
  const rock = new Graphics();
  rock.rect(0, G.TOWER.y1 - 4, 1400, 900 - G.TOWER.y1 + 4).fill(0x050706);
  // strata
  for (let i = 0; i < 7; i++) {
    const sy = G.TOWER.y1 + 60 + i * 110 + (i % 2) * 30;
    rock.moveTo(0, sy);
    for (let sx = 0; sx <= 1400; sx += 140) {
      rock.quadraticCurveTo(sx + 70, sy + (sx / 140 % 2 === 0 ? 10 : -8), sx + 140, sy);
    }
    rock.stroke({ width: 7, color: 0x090c0a, alpha: 0.8 });
  }
  // buried boulders
  for (let i = 0; i < 26; i++) {
    const bx = Math.random() < 0.5 ? Math.random() * 110 : 1290 + Math.random() * 105;
    const by = G.TOWER.y1 + 20 + Math.random() * 760;
    rock.ellipse(bx, by, 6 + Math.random() * 14, 4 + Math.random() * 9)
      .fill({ color: 0x0a0d0b, alpha: 0.9 });
  }
  layers.bg.addChild(rock);

  /* ─── Building shell (concrete mass the rooms are cut into) ─── */
  const shell = new Graphics();
  shell.rect(G.TOWER.x1, G.TOWER.y1, G.TOWER.x2 - G.TOWER.x1, G.TOWER.y2 - G.TOWER.y1).fill(0x1a211c);
  // roof cap
  shell.rect(G.TOWER.x1 - 12, G.TOWER.y1 - 10, G.TOWER.x2 - G.TOWER.x1 + 24, 12).fill(C.lineMid);
  shell.rect(G.TOWER.x1 - 12, G.TOWER.y1 - 10, G.TOWER.x2 - G.TOWER.x1 + 24, 3).fill(C.lineHi);
  // footing
  shell.rect(G.TOWER.x1 - 16, G.TOWER.y2, G.TOWER.x2 - G.TOWER.x1 + 32, 10).fill(C.lineMid);
  shell.moveTo(0, G.TOWER.y2 + 10).lineTo(1400, G.TOWER.y2 + 10).stroke({ width: 1.5, color: 0x0a0d0b });
  layers.bg.addChild(shell);
  const plaque = mono("BCH FULL NODE — est. 2017 — txlab.cash", 7, C.fgDim, { weight: "400", ls: 1 });
  plaque.position.set(G.TOWER.x1 + 10, G.TOWER.y2 + 14);
  layers.mid.addChild(plaque);

  /* ─── Broadcast antenna on the roof ─── */
  const ant = new Graphics();
  ant.moveTo(G.ANTENNA.x - 14, G.TOWER.y1 - 8).lineTo(G.ANTENNA.x, G.ANTENNA.y).lineTo(G.ANTENNA.x + 14, G.TOWER.y1 - 8)
    .stroke({ width: 2, color: C.lineMid });
  ant.moveTo(G.ANTENNA.x - 9, 72).lineTo(G.ANTENNA.x + 9, 72).stroke({ width: 1.5, color: C.lineMid });
  ant.moveTo(G.ANTENNA.x - 5, 52).lineTo(G.ANTENNA.x + 5, 52).stroke({ width: 1.5, color: C.lineMid });
  layers.mid.addChild(ant);
  const antLight = new Sprite(T.glowRed);
  antLight.anchor.set(0.5);
  antLight.position.set(G.ANTENNA.x, G.ANTENNA.y - 2);
  antLight.width = antLight.height = 22;
  antLight.blendMode = "add";
  layers.lights.addChild(antLight);
  refs.antennaLight = antLight;
  const antSign = mono("// BROADCAST", 8, C.fgDim, { ls: 1, weight: "400" });
  antSign.position.set(G.ANTENNA.x + 28, 44);
  layers.mid.addChild(antSign);

  /* ─── The five rooms ─── */
  roomBox(layers, T, refs, {
    ...ROOMS.synthesis, wash: 0x0ac18e, washAlpha: 0.11,
    lightXs: [480, 760], lightCol: 0xbfffe9, accent: C.bch400,
    num: "01", title: "SYNTHESIS LAB", sub: "a wallet builds the tx — inputs chosen, outputs written, signatures applied", phase: 0,
  });
  roomBox(layers, T, refs, {
    ...ROOMS.validation, wash: 0x9fd8f0, washAlpha: 0.085,
    lightXs: [420, 840], lightCol: 0xdff4ff, accent: 0x8fd8ff,
    num: "02", title: "VALIDATION", sub: "the node checks every script & signature itself — it trusts nobody", phase: 2.1,
  });
  roomBox(layers, T, refs, {
    ...ROOMS.vivarium, wash: 0xffd678, washAlpha: 0.1,
    lightXs: [], lightCol: 0xffd678, accent: 0xffd678, // pendants below provide the light
    num: "03", title: "MEMPOOL VIVARIUM", sub: "accepted txs wait for a block — first-seen, no fee auction", phase: 4.4,
  });
  roomBox(layers, T, refs, {
    ...ROOMS.reactor, wash: 0xff8c3c, washAlpha: 0.1,
    lightXs: [560, 900], lightCol: 0xffc9a0, accent: 0xffa04d,
    num: "04", title: "MINING REACTOR", sub: "CTOR order, then the hash lottery", phase: 3.2,
  });
  roomBox(layers, T, refs, {
    ...ROOMS.archive, wash: 0x6fb7ff, washAlpha: 0.09,
    lightXs: [400, 700], lightCol: 0xbcd9ff, accent: 0x7fc4ff,
    num: "05", title: "ARCHIVE (BLOCKCHAIN)", sub: "the chain — kept by every node", phase: 5.5,
  });

  /* walk lanes along the pipeline paths */
  walkLane(layers, GEOM.F1PATH, 240, 1140);
  walkLane(layers, GEOM.F2PATH, 200, 1180);
  walkLane(layers, GEOM.F4PATH, 250, 1030);

  /* greebles: monitors, crates, hazard placards */
  wallMonitor(layers, T, refs, 950, 190, C.bch400);
  wallMonitor(layers, T, refs, 210, 352, 0x8fd8ff);
  wallMonitor(layers, T, refs, 330, 806, 0x7fc4ff);
  crates(layers, 1230, 396);
  crates(layers, 226, 856);
  placard(layers, GEOM.TUBE1.x + 26, GEOM.TUBE1.y1 - 16);
  placard(layers, GEOM.TUBE3.x + 26, GEOM.TUBE3.y1 - 16);

  /* cast shadows behind the major props */
  wallShadow(layers, 180, 218, 92, 66);
  wallShadow(layers, 310, 206, 112, 104);
  wallShadow(layers, 600, 180, 112, 68);
  wallShadow(layers, 1060, 226, 76, 70);
  wallShadow(layers, 660, 346, 76, 94);
  wallShadow(layers, 840, 342, 58, 96);
  wallShadow(layers, 970, 334, 118, 58);
  wallShadow(layers, 700, 572, 196, 54);
  wallShadow(layers, 320, 540, 84, 96);
  wallShadow(layers, 450, 526, 44, 92);
  wallShadow(layers, 563, 671, 252, 52);
  wallShadow(layers, 870, 700, 74, 52);
  wallShadow(layers, 990, 702, 42, 56);
  wallShadow(layers, 1180, 698, 158, 122);
  wallShadow(layers, 1245, 812, 42, 72);

  /* ─── Pneumatic tubes (punch through the slabs) ─── */
  const tubes = new Graphics();
  for (const t of [G.TUBE1, G.TUBE2, G.TUBE3]) {
    tubes.roundRect(t.x - 13, t.y1 - 34, 26, t.y2 - t.y1 + 40, 12).fill({ color: 0x27352d, alpha: 0.7 });
    tubes.roundRect(t.x - 13, t.y1 - 34, 26, t.y2 - t.y1 + 40, 12).stroke({ width: 2, color: 0x4a5850, alpha: 0.95 });
    tubes.moveTo(t.x - 8, t.y1 - 30).lineTo(t.x - 8, t.y2).stroke({ width: 1.5, color: 0xffffff, alpha: 0.16 });
    tubes.roundRect(t.x - 15, t.y1 - 36, 30, 8, 3).fill(C.lineHi);
    tubes.roundRect(t.x - 15, t.y2 - 4, 30, 8, 3).fill(C.lineHi);
    // mid-span mounting bracket
    const my = (t.y1 + t.y2) / 2;
    tubes.rect(t.x - 17, my - 3, 4, 6).fill(C.lineHi);
    tubes.rect(t.x + 13, my - 3, 4, 6).fill(C.lineHi);
  }
  layers.mid.addChild(tubes);
  for (const t of [G.TUBE1, G.TUBE2, G.TUBE3]) {
    const led = new Sprite(T.glowGreen);
    led.anchor.set(0.5);
    led.position.set(t.x, (t.y1 + t.y2) / 2);
    led.width = 30;
    led.height = 60;
    led.alpha = 0.2;
    led.blendMode = "add";
    layers.lights.addChild(led);
    refs.pipeLeds.push(led);
  }

  /* ═══ 01 SYNTHESIS ═══ */
  // vial rack (the UTXO set)
  const rack = new Container();
  rack.position.set(180, 192);
  const rackG = new Graphics();
  rackG.roundRect(-42, 0, 84, 54, 2).fill(C.elevated);
  rackG.roundRect(-42, 0, 84, 4, 2).fill(C.lineHi);
  rackG.moveTo(-38, 18).lineTo(38, 18).stroke({ width: 1.5, color: C.lineMid });
  rackG.moveTo(-38, 36).lineTo(38, 36).stroke({ width: 1.5, color: C.lineMid });
  rack.addChild(rackG);
  rack.addChild(refs.vialSlots); // dynamic vials — the UTXO set, cycled on every block
  const rackLbl = mono("UTXO REAGENTS", 6, C.fgDim, { anchor: 0.5, ls: 0.5, weight: "400" });
  rackLbl.position.set(0, 62);
  rack.addChild(rackLbl);
  layers.mid.addChild(rack);

  // chalkboard with a tx diagram
  const board = new Container();
  board.position.set(600, 178);
  const bg2 = new Graphics();
  bg2.roundRect(-52, -30, 104, 62, 2).fill(0x101c16);
  bg2.roundRect(-52, -30, 104, 62, 2).stroke({ width: 2.5, color: 0x3a3126 });
  bg2.circle(-30, -8, 7).stroke({ width: 1.2, color: 0x9fb8ac, alpha: 0.7 });
  bg2.circle(-30, 14, 7).stroke({ width: 1.2, color: 0x9fb8ac, alpha: 0.7 });
  bg2.roundRect(2, -4, 18, 14, 2).stroke({ width: 1.2, color: 0x9fb8ac, alpha: 0.7 });
  bg2.moveTo(-23, -8).lineTo(2, 0).stroke({ width: 1, color: 0x9fb8ac, alpha: 0.5 });
  bg2.moveTo(-23, 14).lineTo(2, 6).stroke({ width: 1, color: 0x9fb8ac, alpha: 0.5 });
  bg2.moveTo(20, 3).lineTo(38, 3).stroke({ width: 1, color: C.bch400, alpha: 0.6 });
  bg2.moveTo(34, -1).lineTo(38, 3).lineTo(34, 7).stroke({ width: 1, color: C.bch400, alpha: 0.6 });
  board.addChild(bg2);
  const bLbl = mono("in → tx → out", 5.5, C.fgDim, { anchor: 0.5, weight: "400" });
  bLbl.position.set(0, 40);
  board.addChild(bLbl);
  layers.mid.addChild(board);

  // synthesis pod
  const pod = new Container();
  pod.position.set(G.POD.x, G.POD.y);
  layers.mid.addChild(pod);
  shadow(pod, 0, 14, 52, 5);
  const podG = new Graphics();
  podG.roundRect(-52, 4, 104, 10, 2).fill(C.line);
  podG.rect(-52, 4, 104, 3).fill(C.lineMid);
  podG.rect(-44, 14, 7, 24).fill(C.lineMid);
  podG.rect(37, 14, 7, 24).fill(C.lineMid);
  podG.circle(0, -32, 26).fill({ color: 0x14261f, alpha: 0.75 });
  podG.circle(0, -32, 26).stroke({ width: 1.6, color: 0x9fb8ac, alpha: 0.85 });
  podG.rect(-7, -74, 14, 18).fill({ color: 0x14261f, alpha: 0.75 });
  podG.rect(-7, -74, 14, 18).stroke({ width: 1.4, color: 0x9fb8ac, alpha: 0.7 });
  podG.roundRect(-10, -80, 20, 7, 2).fill(C.lineMid);
  podG.moveTo(-24, -26).quadraticCurveTo(0, -36, 24, -26).lineTo(22, -18)
    .quadraticCurveTo(0, -8, -22, -18).closePath().fill({ color: C.bch500, alpha: 0.8 });
  podG.circle(0, -22, 20).fill({ color: C.bch500, alpha: 0.35 });
  podG.ellipse(-9, -40, 5, 9).fill({ color: 0xffffff, alpha: 0.1 });
  pod.addChild(podG);
  const podLbl = mono("SYNTHESIS POD", 6, C.fgDim, { anchor: 0.5, ls: 0.5, weight: "400" });
  podLbl.position.set(0, 24);
  pod.addChild(podLbl);
  const podGlow = new Sprite(T.glowGreen);
  podGlow.anchor.set(0.5);
  podGlow.position.set(G.POD.x, G.POD.y - 30);
  podGlow.width = 130;
  podGlow.height = 110;
  podGlow.alpha = 0.4;
  podGlow.blendMode = "add";
  layers.lights.addChild(podGlow);
  refs.podGlow = podGlow;

  // the scientist
  const sciC = new Container();
  sciC.position.set(390, 218);
  layers.mid.addChild(sciC);
  shadow(sciC, 0, 30, 18, 3.5, 0.3);
  const sci = staff(T, "scientist");
  sciC.addChild(sci.c);
  refs.breathers.push({ obj: sci.body, phase: 0.4 });
  refs.blinkers.push({ obj: sci.eyes, phase: 1.1 });
  const pourArm = new Container();
  pourArm.position.set(-10, 2);
  const pag = new Graphics();
  pag.moveTo(0, 0).lineTo(-26, -10).stroke({ width: 5, color: C.fgMid, cap: "round" });
  pag.roundRect(-33, -22, 8, 14, 3).fill({ color: C.bch400, alpha: 0.9 });
  pag.roundRect(-32, -25, 6, 3, 1).fill(C.lineHi);
  pourArm.addChild(pag);
  sci.c.addChild(pourArm);
  refs.pourArm = pourArm;
  refs.scientistZone = sciC;
  sciC.eventMode = "static";
  sciC.cursor = "pointer";
  sciC.hitArea = new Rectangle(-30, -40, 60, 80);

  // FORKID stamp station
  const stampC = new Container();
  stampC.position.set(870, G.F1PATH);
  const stampG = new Graphics();
  stampG.rect(-4, -66, 8, 40).fill(C.lineMid);
  stampG.roundRect(-16, -70, 32, 8, 2).fill(C.lineMid);
  stampG.roundRect(-12, -30, 24, 10, 2).fill(C.elevated);
  stampG.roundRect(-12, -30, 24, 10, 2).stroke({ width: 1, color: C.bch700 });
  stampC.addChild(stampG);
  const stampLbl = mono("FORKID SEAL", 6, C.bch400, { anchor: 0.5, ls: 0.5 });
  stampLbl.position.set(0, -80);
  stampC.addChild(stampLbl);
  layers.mid.addChild(stampC);

  // token annex
  const annex = new Container();
  annex.position.set(1060, 200);
  const anG = new Graphics();
  anG.roundRect(-34, -10, 68, 62, 2).fill(C.elevated);
  anG.roundRect(-34, -10, 68, 4, 2).fill(C.lineHi);
  anG.roundRect(-26, -2, 52, 38, 2).fill({ color: 0x14261f, alpha: 0.7 });
  anG.roundRect(-26, -2, 52, 38, 2).stroke({ width: 1.2, color: 0x9fb8ac, alpha: 0.6 });
  anG.poly([-10, 26, -6, 18, -2, 24, 2, 16, 6, 24, 10, 18, 12, 26]).fill(C.neon400);
  anG.roundRect(-12, 26, 24, 4, 1).fill(C.neon600);
  annex.addChild(anG);
  const anLbl = mono("TOKEN ANNEX", 6.5, C.neon400, { anchor: 0.5, ls: 1 });
  anLbl.position.set(0, -20);
  annex.addChild(anLbl);
  layers.mid.addChild(annex);
  const anGlow = new Sprite(T.glowPurple);
  anGlow.anchor.set(0.5);
  anGlow.position.set(1060, 220);
  anGlow.width = 90;
  anGlow.height = 70;
  anGlow.alpha = 0.35;
  anGlow.blendMode = "add";
  layers.lights.addChild(anGlow);
  refs.pipeLeds.push(anGlow);

  /* ═══ 02 VALIDATION ═══ */
  // conveyor
  const conv = new Graphics();
  conv.rect(160, G.F2PATH + 6, 1040, 6).fill(C.line);
  conv.rect(160, G.F2PATH + 6, 1040, 2).fill(C.lineHi);
  for (let x = 180; x < 1190; x += 90) conv.circle(x, G.F2PATH + 14, 4).fill(C.surface).circle(x, G.F2PATH + 14, 4).stroke({ width: 1.4, color: C.lineMid });
  layers.mid.addChild(conv);

  // server rack (back wall)
  const rack2 = new Container();
  rack2.position.set(840, 340);
  const r2g = new Graphics();
  r2g.roundRect(-26, -44, 52, 92, 3).fill(C.elevated);
  r2g.roundRect(-26, -44, 52, 5, 3).fill(C.lineHi);
  for (let ry = -34; ry < 40; ry += 14) {
    r2g.roundRect(-20, ry, 40, 10, 1.5).fill(0x101613);
  }
  rack2.addChild(r2g);
  layers.mid.addChild(rack2);
  for (let k = 0; k < 5; k++) {
    const led = new Sprite(T.glowGreen);
    led.anchor.set(0.5);
    led.position.set(824 + (k % 2) * 30, 312 + k * 14);
    led.width = led.height = 10;
    led.blendMode = "add";
    layers.lights.addChild(led);
    refs.pipeLeds.push(led);
  }

  // scanner arch
  const scan = new Container();
  scan.position.set(G.SCAN.x, G.SCAN.y);
  const scanG = new Graphics();
  scanG.roundRect(-34, -78, 10, 84, 3).fill(C.lineMid);
  scanG.roundRect(24, -78, 10, 84, 3).fill(C.lineMid);
  scanG.roundRect(-34, -84, 68, 10, 3).fill(C.lineMid);
  scanG.roundRect(-34, -84, 68, 3, 3).fill(C.lineHi);
  scanG.roundRect(-28, -76, 4, 78, 2).fill({ color: 0x8fd8ff, alpha: 0.3 });
  scanG.roundRect(24, -76, 4, 78, 2).fill({ color: 0x8fd8ff, alpha: 0.3 });
  // status stack-light on top
  scanG.roundRect(-4, -96, 8, 12, 2).fill(0x101613);
  scanG.circle(0, -92, 2.4).fill(C.bch500);
  scan.addChild(scanG);
  const scanLbl = mono("SCRIPT SCANNER", 6.5, C.bch400, { anchor: 0.5, ls: 0.5 });
  scanLbl.position.set(0, -104);
  scan.addChild(scanLbl);
  layers.mid.addChild(scan);
  refs.beam.moveTo(0, -74).lineTo(0, 4).stroke({ width: 2.5, color: 0xbfe8ff, alpha: 0.8 });
  refs.beam.position.set(G.SCAN.x, G.SCAN.y);
  refs.beam.blendMode = "add";
  layers.lights.addChild(refs.beam);
  const scanGlow = new Sprite(T.glowWhite);
  scanGlow.tint = 0x9fd8f0;
  scanGlow.anchor.set(0.5);
  scanGlow.position.set(G.SCAN.x, G.SCAN.y - 36);
  scanGlow.width = 110;
  scanGlow.height = 110;
  scanGlow.alpha = 0.3;
  scanGlow.blendMode = "add";
  layers.lights.addChild(scanGlow);

  // inspector bot
  const botC = new Container();
  botC.position.set(590, G.F2PATH - 12);
  layers.mid.addChild(botC);
  shadow(botC, 0, 26, 13, 3, 0.3);
  const bot = staff(T, "bot");
  botC.addChild(bot.c);
  refs.blinkers.push({ obj: bot.eyes, phase: 3.3 });

  // SEEN ledger
  const ledger = new Container();
  ledger.position.set(970, 332);
  const ledG = new Graphics();
  ledG.roundRect(-56, -26, 112, 52, 3).fill(C.surface);
  ledG.roundRect(-56, -26, 112, 52, 3).stroke({ width: 1.5, color: C.lineMid });
  for (let r = 0; r < 3; r++) {
    for (let k = 0; k < 6; k++) {
      ledG.moveTo(-44 + k * 16, -12 + r * 13).lineTo(-36 + k * 16, -12 + r * 13)
        .stroke({ width: 1.2, color: r === 0 && k < 4 ? C.bch500 : C.fgDim, alpha: 0.7 });
    }
  }
  ledger.addChild(ledG);
  const ledLbl = mono("SEEN LEDGER — FIRST SPEND WINS", 6, C.fgMute, { anchor: 0.5, ls: 0.5, weight: "400" });
  ledLbl.position.set(0, 34);
  ledger.addChild(ledLbl);
  layers.mid.addChild(ledger);

  /* ═══ 03 MEMPOOL VIVARIUM ═══ */
  const wallSigns: [number, string, string, number][] = [
    [548, "32 MB", "CAPACITY · NEVER FULL", C.neon400],
    [680, "1 sat/vB", "FLAT. ALWAYS.", C.bch400],
    [812, "NO RBF", "FIRST SEEN WINS", C.danger],
  ];
  for (const [x, big, small, col] of wallSigns) {
    const p = new Container();
    p.position.set(x, 452);
    const bgG = new Graphics()
      .roundRect(-42, -20, 84, 44, 3).fill(C.surface)
      .roundRect(-42, -20, 84, 44, 3).stroke({ width: 1.5, color: C.lineMid });
    const t1 = mono(big, 11, col, { anchor: 0.5, weight: "700" });
    t1.position.set(0, -6);
    const t2 = mono(small, 5.5, C.fgDim, { anchor: 0.5, ls: 0.5 });
    t2.position.set(0, 10);
    p.addChild(bgG, t1, t2);
    layers.mid.addChild(p);
  }

  // block clock — time SINCE the last block (blocks are a lottery, not a schedule)
  const clock = new Container();
  clock.position.set(1000, 456);
  const clockLblT = mono("// LAST BLOCK", 7, C.fgDim, { ls: 1, anchor: 0.5 });
  clockLblT.position.set(0, -28);
  const clockFace = new Graphics();
  clockFace.circle(0, 0, 21).fill(C.lineMid);
  clockFace.circle(0, 0, 18).fill(C.surface).circle(0, 0, 18).stroke({ width: 1, color: C.lineHi });
  for (const [x1, y1, x2, y2] of [[0, -16, 0, -13], [16, 0, 13, 0], [0, 16, 0, 13], [-16, 0, -13, 0]]) {
    clockFace.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 1, color: C.fgDim });
  }
  clockFace.circle(0, 0, 2).fill(C.bch500);
  const hand = new Graphics();
  hand.moveTo(0, 0).lineTo(0, -13).stroke({ width: 1.5, color: C.bch500, cap: "round" });
  refs.clockText.position.set(0, 30);
  clock.addChild(clockLblT, clockFace, hand, refs.clockText);
  layers.mid.addChild(clock);
  refs.clockHand = hand;

  // glass habitat
  const viv = new Graphics();
  viv.roundRect(210, 464, 890, 146, 6).fill({ color: C.bch500, alpha: 0.03 });
  viv.roundRect(210, 464, 890, 146, 6).stroke({ width: 2, color: 0x9fb8ac, alpha: 0.35 });
  viv.moveTo(240, 472).lineTo(300, 472).stroke({ width: 4, color: 0xffffff, alpha: 0.05 });
  viv.moveTo(330, 478).lineTo(370, 478).stroke({ width: 3, color: 0xffffff, alpha: 0.04 });
  layers.lights.addChild(viv);

  // couch
  const couch = new Container();
  couch.position.set(700, 585);
  layers.mid.addChild(couch);
  shadow(couch, 0, 18, 92, 6, 0.4);
  const sg = new Graphics();
  sg.roundRect(-80, -30, 160, 22, 6).fill(C.lineMid);
  sg.roundRect(-80, -30, 160, 5, 6).fill(C.lineHi);
  sg.roundRect(-80, -10, 160, 20, 4).fill(C.elevated);
  sg.roundRect(-75, -13, 73, 10, 4).fill(C.line);
  sg.roundRect(2, -13, 73, 10, 4).fill(C.line);
  sg.roundRect(-89, -27, 12, 38, 5).fill(C.lineMid);
  sg.roundRect(77, -27, 12, 38, 5).fill(C.lineMid);
  for (const lx of [-76, 70]) sg.roundRect(lx, 10, 5, 7, 2).fill(C.line);
  couch.addChild(sg);
  const pillow = new Graphics().roundRect(-9, -8, 18, 16, 4).fill(C.neon600);
  pillow.position.set(-60, -16);
  pillow.rotation = -0.17;
  couch.addChild(pillow);

  // coffee machine
  const coffee = new Container();
  coffee.position.set(320, 556);
  layers.mid.addChild(coffee);
  shadow(coffee, 6, 52, 34, 4);
  const cg = new Graphics();
  cg.roundRect(-20, 14, 56, 38, 2).fill(C.line);
  cg.rect(-20, 14, 56, 3).fill(C.lineHi);
  cg.roundRect(-14, -28, 42, 42, 4).fill(C.elevated);
  cg.roundRect(-14, -28, 42, 7, 4).fill(C.lineHi);
  cg.roundRect(-6, -14, 15, 10, 1).fill(C.canvas);
  cg.rect(-1, -4, 7, 4).fill(C.lineMid);
  cg.moveTo(-1, 5).lineTo(6, 5).lineTo(5, 11).lineTo(0, 11).closePath().fill(C.fg);
  coffee.addChild(cg);
  const coffeeLed = new Sprite(T.glowGreen);
  coffeeLed.anchor.set(0.5);
  coffeeLed.position.set(322, 547);
  coffeeLed.width = coffeeLed.height = 14;
  coffeeLed.blendMode = "add";
  layers.lights.addChild(coffeeLed);
  refs.pipeLeds.push(coffeeLed);

  // water cooler
  const cooler = new Container();
  cooler.position.set(450, 552);
  layers.mid.addChild(cooler);
  shadow(cooler, 0, 56, 18, 3.5);
  const wg = new Graphics();
  wg.ellipse(0, -28, 12, 5.5).fill(C.lineMid);
  wg.moveTo(-12, -28).quadraticCurveTo(-12, -6, -9, 2).lineTo(9, 2).quadraticCurveTo(12, -6, 12, -28).closePath()
    .fill({ color: C.bch500, alpha: 0.45 });
  wg.roundRect(-11, 2, 22, 52, 2).fill(C.elevated);
  wg.rect(-11, 2, 4, 52).fill(C.lineHi);
  wg.roundRect(-7, 16, 6, 4, 1).fill(C.bch500);
  wg.roundRect(1, 16, 6, 4, 1).fill(C.danger);
  cooler.addChild(wg);

  // plants
  for (const [px, flip] of [[250, 1], [1050, -1]] as const) {
    const plant = new Container();
    plant.position.set(px, 588);
    layers.mid.addChild(plant);
    shadow(plant, 0, 22, 13, 2.8);
    const leaves = new Container();
    const lg = new Graphics();
    lg.moveTo(0, 2).quadraticCurveTo(-13 * flip, -10, -10 * flip, -25).quadraticCurveTo(-1 * flip, -16, 0, 2).closePath().fill(C.bch700);
    lg.moveTo(0, 2).quadraticCurveTo(12 * flip, -12, 16 * flip, -22).quadraticCurveTo(6 * flip, -19, 0, 2).closePath().fill(C.bch600);
    lg.moveTo(0, 2).quadraticCurveTo(-3 * flip, -19, 1 * flip, -31).quadraticCurveTo(6 * flip, -17, 0, 2).closePath().fill({ color: C.bch500, alpha: 0.85 });
    leaves.addChild(lg);
    plant.addChild(leaves);
    refs.plantLeaves.push(leaves);
    const pot = new Graphics();
    pot.poly([-8, 0, 8, 0, 6, 8, -6, 8]).fill(C.lineMid);
    pot.poly([-6, 8, 6, 8, 5, 21, -5, 21]).fill(C.line);
    plant.addChild(pot);
  }

  // pendant lamps — hung inside the habitat glass
  for (const lx of [480, 880]) {
    const lampG = new Graphics()
      .moveTo(lx, 466).lineTo(lx, 478).stroke({ width: 1.5, color: C.lineMid })
      .poly([lx - 13, 490, lx - 9, 477, lx + 9, 477, lx + 13, 490]).fill(C.lineMid);
    layers.mid.addChild(lampG);
    const bulb = new Sprite(T.glowLamp);
    bulb.anchor.set(0.5);
    bulb.position.set(lx, 490);
    bulb.width = bulb.height = 36;
    bulb.blendMode = "add";
    layers.lights.addChild(bulb);
    refs.lampBulbs.push(bulb);
    const cone = new Sprite(T.coneLamp);
    cone.anchor.set(0.5, 0);
    cone.position.set(lx, 490);
    cone.width = 150;
    cone.height = 118;
    cone.blendMode = "add";
    layers.lights.addChild(cone);
    refs.lampCones.push(cone);
  }

  // P2P duct
  const vent = new Container();
  vent.position.set(G.VENT.x + 30, G.VENT.y);
  const ventG = new Graphics();
  ventG.roundRect(-16, -20, 32, 40, 3).fill(C.elevated);
  ventG.roundRect(-16, -20, 32, 40, 3).stroke({ width: 1.5, color: C.lineMid });
  for (let k = -12; k <= 12; k += 6) ventG.moveTo(-11, k).lineTo(11, k).stroke({ width: 2, color: C.line });
  vent.addChild(ventG);
  const ventLbl = mono("P2P DUCT", 6, C.fgMute, { anchor: 0.5, ls: 0.5, weight: "400" });
  ventLbl.position.set(0, 30);
  vent.addChild(ventLbl);
  layers.mid.addChild(vent);

  // security guard
  const guardC = new Container();
  guardC.position.set(1035, 570);
  layers.mid.addChild(guardC);
  shadow(guardC, 0, 26, 16, 3.2, 0.3);
  const guard = staff(T, "guard");
  guardC.addChild(guard.c);
  refs.guardBody = guard.body;
  refs.breathers.push({ obj: guard.body, phase: 2 });
  refs.blinkers.push({ obj: guard.eyes, phase: 2.6 });
  refs.guardZone = guardC;
  guardC.eventMode = "static";
  guardC.cursor = "pointer";
  guardC.hitArea = new Rectangle(-24, -36, 48, 70);

  /* ═══ 04 MINING REACTOR ═══ */
  refs.beltG.position.set(0, 0);
  layers.mid.addChild(refs.beltG);
  const beltBase = new Graphics();
  beltBase.rect(230, G.F4PATH + 8, 810, 7).fill(C.line);
  beltBase.rect(230, G.F4PATH + 8, 810, 2).fill(C.lineHi);
  for (let x = 250; x < 1030; x += 78) beltBase.circle(x, G.F4PATH + 17, 4.5).fill(C.surface).circle(x, G.F4PATH + 17, 4.5).stroke({ width: 1.4, color: C.lineMid });
  layers.mid.addChild(beltBase);
  const beltLbl = mono("CTOR CONVEYOR — SORTED BY TXID", 6, C.fgMute, { ls: 1, weight: "400" });
  beltLbl.position.set(540, G.F4PATH + 22);
  layers.mid.addChild(beltLbl);

  // wall pipes with a valve
  const wallPipes = new Graphics();
  wallPipes.roundRect(700, 658, 280, 6, 3).fill(C.lineMid);
  wallPipes.roundRect(810, 656, 8, 10, 2).fill(C.lineHi);
  wallPipes.circle(920, 661, 6).stroke({ width: 2, color: C.lineHi });
  wallPipes.moveTo(916, 657).lineTo(924, 665).stroke({ width: 1.5, color: C.lineHi });
  layers.mid.addChild(wallPipes);

  // candidate block display — the node's block template, rebuilt continuously
  const cand = new Container();
  cand.position.set(440, 648);
  const candG = new Graphics();
  candG.roundRect(0, 0, 246, 46, 4).fill(C.surface);
  candG.roundRect(0, 0, 246, 46, 4).stroke({ width: 1.5, color: C.lineMid });
  candG.roundRect(8, 20, 230, 18, 2).fill({ color: 0x0b1410, alpha: 0.9 });
  cand.addChild(candG);
  const candLbl = mono("CANDIDATE BLOCK — CTOR ORDER", 6.5, C.bch400, { ls: 0.5 });
  candLbl.position.set(8, 6);
  refs.candCount.position.set(160, 7);
  refs.candSlots.position.set(12, 24);
  cand.addChild(candLbl, refs.candCount, refs.candSlots);
  layers.mid.addChild(cand);

  // control console
  const console_ = new Container();
  console_.position.set(750, 700);
  const conG = new Graphics();
  conG.poly([-38, 22, 38, 22, 30, 2, -30, 2]).fill(C.elevated);
  conG.poly([-30, 2, 30, 2, 26, -6, -26, -6]).fill(C.lineHi);
  conG.roundRect(-22, -4, 18, 7, 1).fill({ color: C.bch500, alpha: 0.5 });
  conG.roundRect(2, -4, 18, 7, 1).fill({ color: C.warn, alpha: 0.5 });
  console_.addChild(conG);
  layers.mid.addChild(console_);

  // reactor chamber
  const reactor = new Container();
  reactor.position.set(G.REACTORX + 60, G.F4PATH - 20);
  layers.mid.addChild(reactor);
  shadow(reactor, 0, 56, 80, 7);
  const rg = new Graphics();
  rg.roundRect(-75, -66, 150, 118, 8).fill(C.elevated);
  rg.roundRect(-75, -66, 150, 10, 8).fill(C.lineHi);
  rg.roundRect(-75, -66, 150, 118, 8).stroke({ width: 1.5, color: C.line });
  rg.roundRect(-80, 10, 14, 42, 3).fill(C.line);
  rg.roundRect(-80, 10, 14, 6, 3).fill(C.warn);
  rg.circle(0, -8, 34).fill(0x0b1410);
  rg.circle(0, -8, 34).stroke({ width: 2.5, color: C.lineHi });
  for (const [bx, by] of [[-30, -38], [30, -38], [-30, 22], [30, 22]]) rg.circle(bx, by, 2).fill(C.lineHi);
  reactor.addChild(rg);
  const rotor = new Container();
  rotor.position.set(0, -8);
  const rotG = new Graphics();
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    rotG.moveTo(0, 0).lineTo(Math.cos(a) * 26, Math.sin(a) * 26).stroke({ width: 5, color: 0xff8c3c, alpha: 0.9, cap: "round" });
  }
  rotG.circle(0, 0, 7).fill(0xffb347);
  rotor.addChild(rotG);
  reactor.addChild(rotor);
  refs.rotor = rotor;
  const reactLbl = mono("HASH CENTRIFUGE", 6, 0xffa04d, { anchor: 0.5, ls: 0.5 });
  reactLbl.position.set(0, -78);
  reactor.addChild(reactLbl);
  const reactorGlow = new Sprite(T.glowOrangeBig);
  reactorGlow.anchor.set(0.5);
  reactorGlow.position.set(G.REACTORX + 60, G.F4PATH - 28);
  reactorGlow.width = 220;
  reactorGlow.height = 170;
  reactorGlow.alpha = 0.3;
  reactorGlow.blendMode = "add";
  layers.lights.addChild(reactorGlow);
  refs.reactorGlow = reactorGlow;
  refs.reactorZone = reactor;
  reactor.eventMode = "static";
  reactor.cursor = "pointer";
  reactor.hitArea = new Rectangle(-80, -70, 160, 125);

  // ASERT gauge
  const gauge = new Container();
  gauge.position.set(870, 682);
  const gg = new Graphics();
  gg.roundRect(-34, -6, 68, 40, 3).fill(C.surface);
  gg.roundRect(-34, -6, 68, 40, 3).stroke({ width: 1.5, color: C.lineMid });
  gg.arc(0, 22, 22, Math.PI, 0).stroke({ width: 2, color: C.lineMid });
  gg.moveTo(-22, 22).lineTo(-18, 22).stroke({ width: 1.5, color: C.fgDim });
  gg.moveTo(22, 22).lineTo(18, 22).stroke({ width: 1.5, color: C.fgDim });
  gg.moveTo(0, 0).lineTo(0, 4).stroke({ width: 1.5, color: C.fgDim });
  gauge.addChild(gg);
  const needle = new Graphics();
  needle.moveTo(0, 0).lineTo(0, -18).stroke({ width: 2, color: C.warn, cap: "round" });
  needle.position.set(0, 22);
  gauge.addChild(needle);
  refs.gaugeNeedle = needle;
  const gLbl = mono("ASERT — RETARGETS EVERY BLOCK", 5.5, C.fgMute, { anchor: 0.5, weight: "400" });
  gLbl.position.set(0, 42);
  gauge.addChild(gLbl);
  layers.mid.addChild(gauge);

  // coinbase dispenser
  const disp = new Container();
  disp.position.set(G.DISPENSER.x, G.DISPENSER.y);
  const dg = new Graphics();
  dg.roundRect(-18, -24, 36, 52, 3).fill(C.elevated);
  dg.roundRect(-18, -24, 36, 5, 3).fill(C.lineHi);
  dg.roundRect(-12, 8, 24, 12, 2).fill(0x0b0f0d);
  dg.circle(0, -10, 7).stroke({ width: 1.6, color: C.warn });
  dg.moveTo(-2.5, -10).lineTo(2.5, -10).stroke({ width: 1.6, color: C.warn });
  disp.addChild(dg);
  const dLbl = mono("COINBASE", 5.5, C.fgMute, { anchor: 0.5, ls: 0.5, weight: "400" });
  dLbl.position.set(0, 36);
  disp.addChild(dLbl);
  layers.mid.addChild(disp);

  // janitor bot
  const janC = new Container();
  janC.position.set(500, G.F4PATH - 8);
  layers.mid.addChild(janC);
  const jan = staff(T, "bot");
  janC.addChild(jan.c);
  const broom = new Graphics();
  broom.moveTo(10, 4).lineTo(20, 14).stroke({ width: 2, color: C.lineHi });
  broom.roundRect(17, 13, 10, 4, 1).fill(C.warn);
  janC.addChild(broom);
  refs.janitor = janC;
  refs.blinkers.push({ obj: jan.eyes, phase: 4.6 });

  /* ═══ 05 ARCHIVE ═══ */
  // shelf rail + upright supports
  const rail = new Graphics();
  rail.roundRect(160, 862, 1040, 5, 2).fill(C.lineMid);
  for (let x = 200; x < 1200; x += 120) {
    rail.circle(x, 872, 5).fill(C.surface).circle(x, 872, 5).stroke({ width: 1.6, color: C.lineMid });
  }
  for (const sx of [180, 1180]) {
    rail.rect(sx - 3, 772, 6, 90).fill(C.line);
    rail.rect(sx - 3, 772, 2, 90).fill(C.lineHi);
  }
  layers.bg.addChild(rail);

  // block freight hatch — where blocks found elsewhere arrive from the network
  const freight = new Container();
  freight.position.set(G.FREIGHT.x, G.FREIGHT.y);
  const frG = new Graphics();
  frG.roundRect(-18, -34, 36, 68, 4).fill(C.elevated);
  frG.roundRect(-18, -34, 36, 68, 4).stroke({ width: 2, color: C.lineMid });
  for (let k = 0; k < 4; k++) {
    frG.moveTo(-14, -26 + k * 8).lineTo(-6 + k * 2, -34 + k * 8).stroke({ width: 2.5, color: C.warn, alpha: 0.4 });
  }
  frG.roundRect(-14, 10, 28, 18, 2).fill(0x0b0f0d);
  freight.addChild(frG);
  const frLbl = mono("BLOCK FREIGHT", 5.5, C.fgMute, { anchor: 0.5, ls: 0.5, weight: "400" });
  frLbl.position.set(0, 44);
  const frLbl2 = mono("from peers", 5, C.fgDim, { anchor: 0.5, weight: "400" });
  frLbl2.position.set(0, 54);
  freight.addChild(frLbl, frLbl2);
  layers.mid.addChild(freight);

  refs.blockStack.position.set(0, 0);
  layers.mid.addChild(refs.blockStack);

  return refs;
}
