import { Container, Graphics, Sprite, Text } from "pixi.js";
import { C } from "./palette";
import type { TexKit } from "./textures";
import type { Particles } from "./effects";
import {
  BgFlask, FLOOR_Y, WALK_Y,
  clamp, crossed, gem, makeLayers, mono, rand, roomShell, roundel, signage, tubeAt, tubeDownAt,
} from "./rideCore";
import { enterViaTube, exitViaTube } from "./rideCore";
import type { ActDef, RideLayers } from "./rideCore";

const camFollow = (worldW: number) => (_t: number, heroX: number) =>
  clamp(heroX + 130, 700, worldW - 700);

/* ═══════════ ACT 1 — ORIGIN (the wallet workbench) ═══════════ */
export function buildAct1(stage: Container, T: TexKit, particles: Particles): ActDef {
  const W = 2200;
  const L = makeLayers(stage);
  roomShell(L, T, {
    w: W, wallCol: 0x2a2721, topCol: 0x363228,
    fixtures: [500, 1000], fixTint: 0xffd9a0,
    washTint: 0xffd678, washAlpha: 0.1, pillars: [300, 1900],
  });
  signage(L, T, 350, 120, "THE WALLET", "WHERE TRANSACTIONS ARE BORN — OUTSIDE THE NODE", 0xffd678);

  // window with the node building in the distance
  const win = new Container();
  win.position.set(1550, 300);
  const wg = new Graphics();
  wg.roundRect(-160, -170, 320, 280, 8).fill(0x05080a);
  wg.roundRect(-160, -170, 320, 280, 8).stroke({ width: 8, color: 0x3a352b });
  for (let i = 0; i < 22; i++) wg.circle(rand(-145, 145), rand(-158, 60), rand(0.5, 1.4)).fill({ color: 0xdde5e0, alpha: rand(0.3, 0.7) });
  // distant node tower
  wg.rect(40, -60, 70, 160).fill(0x101913);
  for (let fy = -48; fy < 90; fy += 26) wg.rect(52, fy, 12, 8).fill({ color: C.bch500, alpha: 0.6 });
  for (let fy = -48; fy < 90; fy += 26) wg.rect(78, fy, 12, 8).fill({ color: C.bch500, alpha: 0.35 });
  wg.moveTo(75, -60).lineTo(75, -92).stroke({ width: 2, color: 0x39463e });
  wg.circle(75, -94, 3).fill(C.danger);
  wg.circle(75, -20, 9).fill({ color: C.bch500, alpha: 0.9 });
  win.addChild(wg);
  const winLbl = mono("the node — 1 hop away", 9, C.fgMute, { anchor: 0.5, weight: "400" });
  winLbl.position.set(0, 128);
  win.addChild(winLbl);
  L.back.addChild(win);

  // workbench
  const bench = new Graphics();
  bench.rect(660, 560, 500, 18).fill(0x3a3128);
  bench.rect(660, 560, 500, 5).fill(0x4a4033);
  bench.rect(690, 578, 16, 122).fill(0x2b241d);
  bench.rect(1114, 578, 16, 122).fill(0x2b241d);
  L.main.addChild(bench);

  // input vials on a small rack (pivot at body center so tilting reads naturally)
  const vials: Graphics[] = [];
  for (let i = 0; i < 2; i++) {
    const v = new Graphics();
    v.roundRect(-10, -34, 20, 34, 7).fill({ color: i ? C.neon400 : C.bch400, alpha: 0.85 });
    v.roundRect(-6, -42, 12, 8, 2).fill(0x4a5850);
    v.pivot.set(0, -17);
    v.position.set(740 + i * 44, 543);
    L.main.addChild(v);
    vials.push(v);
  }
  const vialLbl = mono("YOUR UTXOs", 10, C.fgMute, { anchor: 0.5, ls: 1, weight: "400" });
  vialLbl.position.set(762, 470);
  L.main.addChild(vialLbl);

  // mixing station glass dome at hero birth spot
  const dome = new Graphics();
  dome.moveTo(830, 560).quadraticCurveTo(830, 420, 910, 420).quadraticCurveTo(990, 420, 990, 560)
    .stroke({ width: 4, color: 0x9fb8ac, alpha: 0.5 });
  L.main.addChild(dome);

  // output tags
  const tag1 = mono("→ merchant   0.50 BCH", 13, C.bch400, { weight: "400" });
  tag1.position.set(1010, 470);
  tag1.alpha = 0;
  const tag2 = mono("→ you (change) 0.49 BCH", 13, C.fgMid, { weight: "400" });
  tag2.position.set(1010, 494);
  tag2.alpha = 0;
  L.main.addChild(tag1, tag2);

  // FORKID stamp arm above the dome
  const stamp = new Container();
  stamp.position.set(910, 200);
  const sg = new Graphics();
  sg.rect(-10, -60, 20, 70).fill(0x39463e);
  sg.roundRect(-34, 10, 68, 26, 5).fill(0x2c3a32);
  sg.roundRect(-34, 10, 68, 26, 5).stroke({ width: 2, color: C.bch700 });
  stamp.addChild(sg);
  const stampLbl = mono("SIGHASH_FORKID", 10, C.bch400, { anchor: 0.5, ls: 1 });
  stampLbl.position.set(0, 23);
  stamp.addChild(stampLbl);
  L.main.addChild(stamp);

  tubeAt(L, 2080);

  let prevT = -1;
  const act: ActDef = {
    title: "ORIGIN — THE WALLET",
    dur: 25.4,
    worldW: W,
    L,
    captions: [
      [0.5, 5.5, "Every transaction is born in a wallet — outside the node. This one is yours."],
      [5.8, 10.5, "Inputs: two of your unspent coins — UTXOs — poured in whole. Coins are never edited, only consumed."],
      [10.8, 14.8, "Outputs written: the payment, and your change. New coins, formed from the old."],
      [15, 18.8, "Signed and sealed — SIGHASH_FORKID makes it valid on Bitcoin Cash and nowhere else."],
      [19.2, 24.6, "Time to travel. Every node on the network will hear about this within a second."],
    ],
    heroAt(t) {
      if (t < 6) return { x: 910, y: 508, moving: false, visible: false };
      // stays on the bench through the FORKID stamping
      if (t < 16.6) return { x: 910, y: 508, moving: false, visible: true };
      if (t < 17.6) {
        const k = (t - 16.6);
        return { x: 910 + k * 90, y: 508 + Math.sin(k * Math.PI) * -40 + k * 132, moving: true, visible: true };
      }
      return exitViaTube(t, 17.6, 1000, 2080, 175, -1);
    },
    camX: camFollow(W),
    update(t, dt) {
      // input vials: lift off the rack, tilt over the dome, pour, return spent
      for (let i = 0; i < 2; i++) {
        const v = vials[i];
        const rx = 740 + i * 44;
        const hx = i === 0 ? 872 : 948;
        const rot = i === 0 ? 2.1 : -2.1;
        const ease = (k: number) => k * k * (3 - 2 * k);
        if (t < 3.4) {
          v.position.set(rx, 543);
          v.rotation = 0;
          v.alpha = 1;
        } else if (t < 4.1) {
          const e = ease((t - 3.4) / 0.7);
          v.position.set(rx + (hx - rx) * e, 543 + (452 - 543) * e);
          v.rotation = rot * e;
        } else if (t < 6.6) {
          v.position.set(hx, 452);
          v.rotation = rot;
          if (Math.random() < 0.65) {
            particles.spawn({
              tex: T.dotWhite, tint: i ? C.neon400 : C.bch400,
              x: hx + (i === 0 ? 16 : -16) + rand(-3, 3), y: 462,
              vx: (910 - hx) * 0.9 + rand(-8, 8), vy: rand(60, 110),
              life: 0.55, r0: 0.28, r1: 0.1, a0: 0.9, a1: 0.15,
            });
          }
        } else if (t < 7.3) {
          const e = ease((t - 6.6) / 0.7);
          v.position.set(hx + (rx - hx) * e, 452 + (543 - 452) * e);
          v.rotation = rot * (1 - e);
        } else {
          v.position.set(rx, 543);
          v.rotation = 0;
          v.alpha = 0.35; // spent — consumed whole
        }
      }
      if (crossed(prevT, t, 6)) {
        for (let i = 0; i < 18; i++) {
          const a = rand(0, Math.PI * 2);
          particles.spawn({
            tex: T.dotWhite, tint: C.bch400, x: 910, y: 508,
            vx: Math.cos(a) * rand(30, 120), vy: Math.sin(a) * rand(30, 120),
            life: rand(0.5, 1), r0: 0.35, r1: 0.05, a0: 1, a1: 0,
          });
        }
      }
      tag1.alpha = clamp((t - 8) / 0.8, 0, 1);
      tag2.alpha = clamp((t - 8.8) / 0.8, 0, 1);
      // stamp drops at 15.2
      const sk = t < 15 ? 0 : t < 15.5 ? (t - 15) / 0.5 : t < 16.2 ? 1 : Math.max(0, 1 - (t - 16.2) / 0.6);
      stamp.y = 200 + sk * 240;
      if (crossed(prevT, t, 15.5)) {
        for (let i = 0; i < 14; i++) {
          const a = rand(-Math.PI, 0);
          particles.spawn({
            tex: T.dotWhite, tint: C.bch400, x: 910, y: 470,
            vx: Math.cos(a) * rand(40, 140), vy: Math.sin(a) * rand(20, 80),
            life: rand(0.4, 0.8), r0: 0.3, r1: 0.05, a0: 1, a1: 0,
          });
        }
      }
      prevT = t;
    },
    reset() {
      prevT = -1;
      stamp.y = 200;
      tag1.alpha = 0;
      tag2.alpha = 0;
      vials.forEach((v, i) => {
        v.rotation = 0;
        v.alpha = 1;
        v.position.set(740 + i * 44, 543);
      });
    },
  };
  return act;
}

/* ═══════════ ACT 2 — TRANSMISSION (the node, outside) ═══════════ */
export function buildAct2(stage: Container, T: TexKit, particles: Particles): ActDef {
  const W = 2400;
  const L = makeLayers(stage);
  roomShell(L, T, { w: W, skipWall: true, washTint: 0x0ac18e, washAlpha: 0.05, pillars: [] });

  // night sky + far peers
  const sky = new Graphics();
  sky.rect(-400, -40, W + 800, 790).fill(0x05080a);
  for (let i = 0; i < 90; i++) sky.circle(rand(-380, W + 380), rand(-20, 600), rand(0.4, 1.5)).fill({ color: 0xdde5e0, alpha: rand(0.25, 0.7) });
  for (const [bx, bh] of [[150, 90], [330, 130], [520, 70]] as const) {
    sky.rect(bx, 700 - bh, 80, bh).fill(0x0d1410);
    for (let wy = 700 - bh + 12; wy < 690; wy += 22) sky.rect(bx + 14, wy, 10, 6).fill({ color: C.bch500, alpha: 0.4 });
    sky.circle(bx + 40, 700 - bh - 8, 2.5).fill({ color: C.danger, alpha: 0.8 });
  }
  const skyLbl = mono("other nodes — thousands of them", 10, C.fgDim, { weight: "400" });
  skyLbl.position.set(180, 420);
  sky.rect(0, 0, 0, 0);
  L.back.addChild(sky);
  L.back.addChild(skyLbl);

  // THE BUILDING (main layer for crispness)
  const bld = new Container();
  const bg = new Graphics();
  bg.rect(1500, 60, 860, 640).fill(0x1a211c);
  bg.rect(1500, 60, 860, 14).fill(0x2c3a32);
  bg.rect(1488, 48, 884, 16).fill(0x39463e);
  // window rows (the five floors, glowing)
  const floorCols = [0x0ac18e, 0x8fd8ff, 0xffd678, 0xff8c3c, 0x7fc4ff];
  floorCols.forEach((fc, fi) => {
    for (let wx = 1540; wx < 2330; wx += 90) {
      bg.roundRect(wx, 110 + fi * 118, 56, 72, 4).fill({ color: fc, alpha: 0.16 });
      bg.roundRect(wx, 110 + fi * 118, 56, 72, 4).stroke({ width: 2, color: 0x39463e });
    }
  });
  // antenna
  bg.moveTo(2160, 48).lineTo(2200, -60).lineTo(2240, 48).stroke({ width: 3, color: 0x39463e });
  bg.circle(2200, -64, 5).fill(C.danger);
  // intake port
  bg.circle(1500, WALK_Y, 52).fill(0x0b0f0d);
  bg.circle(1500, WALK_Y, 52).stroke({ width: 6, color: 0x4a5850 });
  bg.circle(1500, WALK_Y, 38).stroke({ width: 3, color: C.bch700, alpha: 0.7 });
  bld.addChild(bg);
  const intakeLbl = mono("P2P INTAKE", 11, C.bch400, { anchor: 0.5, ls: 1.5 });
  intakeLbl.position.set(1500, 540);
  bld.addChild(intakeLbl);
  const fullNode = mono("FULL NODE", 34, C.fg, { ls: 10, weight: "700" });
  fullNode.position.set(1690, 84);
  bld.addChild(fullNode);
  L.main.addChild(bld);
  roundel(L, T, 1930, 330, 1.25, true);

  const antGlow = new Sprite(T.glowRed);
  antGlow.anchor.set(0.5);
  antGlow.position.set(2200, -64);
  antGlow.width = antGlow.height = 40;
  antGlow.blendMode = "add";
  L.main.addChild(antGlow);

  // capsule around the hero
  const capsule = new Graphics();
  capsule.ellipse(0, 0, 58, 74).stroke({ width: 5, color: 0x9fd8f0, alpha: 0.9 });
  capsule.ellipse(0, 0, 58, 74).fill({ color: 0x9fd8f0, alpha: 0.12 });
  capsule.visible = false;
  L.main.addChild(capsule);

  let prevT = -1;
  const act: ActDef = {
    title: "TRANSMISSION",
    dur: 20,
    worldW: W,
    L,
    captions: [
      [0.5, 5.5, "Broadcast. Your transaction travels the peer-to-peer network — node to node, no middleman."],
      [6, 11, "This is a Bitcoin Cash full node: it keeps the rules, the mempool, and the entire chain. Nobody owns the network."],
      [11.5, 14.8, "Thousands of nodes just like it will see your transaction within about one second."],
      [15.2, 19.2, "Incoming transaction. Let's follow it inside."],
    ],
    heroAt(t) {
      if (t < 13.5) return { x: Math.min(1420, 150 + t * 105), y: WALK_Y, moving: t < 12.5, visible: true };
      if (t < 15) return { x: 1420, y: WALK_Y, moving: false, visible: true };
      return { x: 1420 + (t - 15) * 220, y: WALK_Y, moving: false, visible: t < 15.6 };
    },
    camX: (t, hx) => (t < 12 ? clamp(hx + 130, 700, W - 700) : Math.min(1660, clamp(hx + 130, 700, W - 700))),
    update(t, _dt) {
      antGlow.alpha = 0.5 + Math.sin(t * 3) * 0.4;
      if (t > 14.6 && t < 15.9) {
        capsule.visible = true;
        const hp = act.heroAt(t);
        capsule.position.set(hp.x, hp.y - 10);
        capsule.alpha = t < 15.4 ? 1 : Math.max(0, 1 - (t - 15.4) / 0.4);
        // speed streaks behind the capsule during the whoosh
        if (t > 15) {
          for (let i = 0; i < 2; i++) {
            particles.spawn({
              tex: T.dotWhite, tint: 0x9fd8f0,
              x: hp.x - rand(20, 90), y: hp.y - 10 + rand(-24, 24),
              vx: -rand(150, 260), vy: 0,
              life: 0.35, r0: 0.5, r1: 0.1, a0: 0.8, a1: 0,
            });
          }
        }
      } else capsule.visible = false;
      if (crossed(prevT, t, 15.7)) {
        for (let i = 0; i < 16; i++) {
          particles.spawn({
            tex: T.dotWhite, tint: C.bch400, x: 1500, y: WALK_Y - 10,
            vx: rand(-60, 60), vy: rand(-60, 60),
            life: rand(0.4, 0.8), r0: 0.3, r1: 0.05, a0: 1, a1: 0,
          });
        }
      }
      // periodic antenna broadcast rings
      if (Math.floor(t * 0.5) !== Math.floor(prevT * 0.5) && t > 1) {
        particles.spawn({ tex: T.ringGreen, x: 2200, y: -64, life: 1.2, r0: 0.2, r1: 2.2, a0: 0.6, a1: 0 });
      }
      prevT = t;
    },
    reset() {
      prevT = -1;
      capsule.visible = false;
    },
  };
  return act;
}

/* ═══════════ ACT 3 — VALIDATION HALL ═══════════ */
export function buildAct3(stage: Container, T: TexKit, particles: Particles, lightsRef: { toLocal: (p: any) => any }): ActDef {
  const W = 2800;
  const SCAN_X = 1400;
  const L = makeLayers(stage);
  const { beltDashes } = roomShell(L, T, {
    w: W, conveyor: true,
    fixtures: [400, 1000, 1600, 2200], fixTint: 0xcfeaff,
    washTint: 0x9fd8f0, washAlpha: 0.1, pillars: [350, 950, 2550],
  });

  const ghost = mono("03", 200, 0x8fd8ff, { weight: "700", alpha: 0.06 });
  ghost.position.set(120, 90);
  L.back.addChild(ghost);
  signage(L, T, 1050, 120, "VALIDATION HALL", "EVERY NODE CHECKS EVERY TRANSACTION — TRUST NOBODY, VERIFY EVERYTHING", 0x8fd8ff);
  roundel(L, T, 2280, 220, 1, true);

  const ledger = new Container();
  ledger.position.set(1900, 420);
  const lg = new Graphics();
  lg.roundRect(-130, -70, 260, 140, 6).fill(0x1a2620);
  lg.roundRect(-130, -70, 260, 140, 6).stroke({ width: 3, color: 0x39463e });
  for (let r = 0; r < 4; r++) for (let k = 0; k < 8; k++) {
    lg.moveTo(-108 + k * 28, -40 + r * 26).lineTo(-92 + k * 28, -40 + r * 26)
      .stroke({ width: 2.5, color: r === 0 ? C.bch500 : C.fgDim, alpha: 0.7 });
  }
  ledger.addChild(lg);
  const ledLbl = mono("SEEN LEDGER — FIRST SPEND WINS", 11, C.fgMute, { anchor: 0.5, ls: 1.5, weight: "400" });
  ledLbl.position.set(0, 90);
  ledger.addChild(ledLbl);
  L.back.addChild(ledger);
  const backLane = new Graphics();
  backLane.rect(1500, 560, 1100, 10).fill(0x1a241e);
  backLane.rect(1500, 560, 1100, 3).fill(0x2e3a33);
  L.back.addChild(backLane);

  tubeAt(L, 120);
  tubeDownAt(L, 2680);

  const rack = new Graphics();
  rack.roundRect(560, 420, 130, 272, 6).fill(0x222d26);
  rack.roundRect(560, 420, 130, 14, 6).fill(0x39463e);
  for (let ry = 448; ry < 668; ry += 34) rack.roundRect(574, ry, 102, 24, 3).fill(0x121a15);
  L.main.addChild(rack);

  const arch = new Graphics();
  arch.roundRect(SCAN_X - 130, 330, 44, 372, 8).fill(0x2c3a32);
  arch.roundRect(SCAN_X - 130, 330, 44, 372, 8).stroke({ width: 3, color: 0x4a5850 });
  arch.roundRect(SCAN_X + 86, 330, 44, 372, 8).fill(0x2c3a32);
  arch.roundRect(SCAN_X + 86, 330, 44, 372, 8).stroke({ width: 3, color: 0x4a5850 });
  arch.roundRect(SCAN_X - 140, 300, 280, 44, 10).fill(0x2c3a32);
  arch.roundRect(SCAN_X - 140, 300, 280, 44, 10).stroke({ width: 3, color: 0x4a5850 });
  arch.roundRect(SCAN_X - 140, 300, 280, 10, 10).fill(0x4a5850);
  arch.roundRect(SCAN_X - 98, 344, 12, 350, 6).fill({ color: 0x8fd8ff, alpha: 0.3 });
  arch.roundRect(SCAN_X + 98, 344, 12, 350, 6).fill({ color: 0x8fd8ff, alpha: 0.3 });
  L.main.addChild(arch);
  const archLbl = mono("SCRIPT SCANNER", 13, 0x8fd8ff, { anchor: 0.5, ls: 2 });
  archLbl.position.set(SCAN_X, 282);
  L.main.addChild(archLbl);
  const beam = new Graphics();
  beam.moveTo(0, 348).lineTo(0, 692).stroke({ width: 6, color: 0xbfe8ff, alpha: 0.8 });
  beam.position.set(SCAN_X, 0);
  beam.blendMode = "add";
  L.lights.addChild(beam);

  const OPS = ["OP_DUP", "OP_HASH160", "<pubKeyHash>", "OP_EQUALVERIFY", "OP_CHECKSIG", "SIGHASH_FORKID"];
  const stackPanel = new Container();
  stackPanel.position.set(1580, 380);
  const spg = new Graphics();
  spg.roundRect(0, 0, 250, 276, 8).fill(0x101813);
  spg.roundRect(0, 0, 250, 276, 8).stroke({ width: 3, color: 0x39463e });
  spg.roundRect(0, 0, 250, 34, 8).fill(0x1c2620);
  stackPanel.addChild(spg);
  const spTitle = mono("STACK MACHINE", 12, 0x8fd8ff, { ls: 2 });
  spTitle.position.set(14, 9);
  stackPanel.addChild(spTitle);
  const opTexts: Text[] = OPS.map((op, i) => {
    const t = mono(op, 14, C.fgMute, { weight: "400" });
    t.position.set(20, 48 + i * 31);
    t.alpha = 0.35;
    stackPanel.addChild(t);
    return t;
  });
  const verdict = mono("…", 16, C.fgDim, { weight: "700" });
  verdict.position.set(20, 240);
  stackPanel.addChild(verdict);
  L.main.addChild(stackPanel);

  const bot = new Container();
  bot.position.set(1240, 640);
  const bg2 = new Graphics();
  bg2.ellipse(0, 52, 40, 9).fill({ color: 0x000000, alpha: 0.35 });
  bg2.roundRect(-30, -36, 60, 66, 20).fill(0x39463e);
  bg2.roundRect(-30, -36, 60, 20, 20).fill(0x4a5850);
  bg2.circle(0, -46, 5).fill(C.bch500);
  bg2.roundRect(-18, -18, 36, 13, 6.5).fill(0x0b0f0d);
  bot.addChild(bg2);
  const botPupil = new Graphics().circle(0, -11.5, 4).fill(C.bch400);
  bot.addChild(botPupil);
  L.main.addChild(bot);

  const clone = new Container();
  const cg = new Graphics();
  cg.circle(0, 4, 22).fill({ color: 0x22302a, alpha: 0.5 });
  cg.circle(0, 8, 17).fill({ color: C.danger, alpha: 0.95 });
  cg.circle(0, 4, 22).stroke({ width: 2.4, color: 0x9fb8ac, alpha: 0.85 });
  cg.roundRect(-10, -14, 20, 10, 3).fill(0x8a6a4a);
  cg.roundRect(-11, 0, 22, 6.5, 3).fill({ color: 0x000000, alpha: 0.6 });
  cg.circle(-7, 4, 2.8).fill(C.canvas);
  cg.circle(7, 4, 2.8).fill(C.canvas);
  clone.addChild(cg);
  const cloneGlow = new Sprite(T.glowRed);
  cloneGlow.anchor.set(0.5);
  cloneGlow.width = cloneGlow.height = 110;
  cloneGlow.alpha = 0.5;
  cloneGlow.blendMode = "add";
  clone.addChildAt(cloneGlow, 0);
  clone.position.set(2650, 545);
  clone.visible = false;
  L.back.addChild(clone);

  let prevT = -1;
  const act: ActDef = {
    title: "VALIDATION HALL",
    dur: 29.6,
    worldW: W,
    L,
    captions: [
      [0.5, 6.5, "Inside the node. This hall has one job: prove your transaction — without trusting anyone."],
      [7, 12.5, "Locking script meets unlocking script. Every full node runs this check itself, for every transaction on earth."],
      [13, 19.5, "Op by op, the stack machine verifies your signature — sealed with SIGHASH_FORKID, valid only on Bitcoin Cash."],
      [20, 25, "A double-spend just tried the back lane. First-seen wins — rejected, and a DSProof warns the whole network in seconds."],
      [25.5, 28.6, "VALID. Your transaction is real. Next stop: the mempool."],
    ],
    heroAt(t) {
      const enter = enterViaTube(t, 120);
      if (enter) return enter;
      if (t < 10.5) return { x: Math.min(SCAN_X - 10, 120 + (t - 1.3) * 138), y: WALK_Y, moving: true, visible: true };
      if (t < 19.5) return { x: SCAN_X - 10, y: WALK_Y, moving: false, visible: true };
      return exitViaTube(t, 19.5, SCAN_X - 10, 2680, 150, 1);
    },
    camX: camFollow(W),
    update(t, dt) {
      const hp = act.heroAt(t);
      const moving = hp.moving;
      beltDashes.clear();
      if (moving) {
        const off = (t * 90) % 45;
        for (let px = -400 + off; px < W + 400; px += 45) beltDashes.moveTo(px, FLOOR_Y + 2).lineTo(px + 18, FLOOR_Y + 2);
        beltDashes.stroke({ width: 4, color: C.bch500, alpha: 0.35 });
      }
      const scanning = t >= 10.5 && t < 19.5;
      beam.visible = scanning;
      if (scanning) {
        beam.x = SCAN_X + Math.sin(t * 3.2) * 88;
        beam.alpha = 0.5 + Math.sin(t * 10) * 0.3;
      }
      const lit = scanning || t >= 19.5 ? clamp(Math.floor((t - 11) / 1.15), 0, OPS.length) : 0;
      opTexts.forEach((o, i) => {
        const on = i < lit;
        o.alpha = on ? 1 : 0.35;
        o.style.fill = on ? C.bch400 : C.fgMute;
      });
      for (let i = 0; i < OPS.length; i++) {
        if (crossed(prevT, t, 11 + (i + 1) * 1.15)) {
          for (let k = 0; k < 5; k++) {
            particles.spawn({
              tex: T.dotWhite, tint: C.bch400,
              x: 1610 + rand(0, 140), y: 380 + 56 + i * 31,
              vx: rand(-20, 20), vy: rand(-40, -10),
              life: 0.5, r0: 0.25, r1: 0.05, a0: 1, a1: 0,
            });
          }
        }
      }
      if (t >= 18.2) {
        verdict.text = "VALID ✓";
        verdict.style.fill = C.bch400;
      } else {
        verdict.text = "…";
        verdict.style.fill = C.fgDim;
      }
      if (crossed(prevT, t, 18.2)) {
        for (let i = 0; i < 24; i++) {
          const a = rand(0, Math.PI * 2);
          const sp = rand(60, 220);
          particles.spawn({
            tex: T.dotWhite, tint: i % 3 ? C.bch500 : C.bch400,
            x: SCAN_X, y: 520, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            ay: 150, life: rand(0.5, 1), r0: rand(0.2, 0.45), r1: 0.05, a0: 1, a1: 0,
          });
        }
      }
      // clone cameo
      if (t >= 19.5 && t < 25.5) {
        clone.visible = true;
        const cx = Math.max(2030, 2650 - (t - 19.5) * 260);
        if (cx > 2030) {
          clone.x = cx;
          clone.alpha = 1;
          clone.scale.set(1);
        } else {
          clone.x = 2030;
          const k = clamp((t - 19.5 - (2650 - 2030) / 260) / 0.5, 0, 1);
          clone.alpha = 1 - k;
          clone.scale.set(1 + k * 0.6);
          if (crossed(prevT, t, 19.5 + (2650 - 2030) / 260)) {
            const lp = lightsRef.toLocal(clone.getGlobalPosition());
            for (let i = 0; i < 16; i++) {
              const a = rand(0, Math.PI * 2);
              particles.spawn({
                tex: T.dotWhite, tint: C.danger, x: lp.x, y: lp.y,
                vx: Math.cos(a) * rand(30, 120), vy: Math.sin(a) * rand(30, 120),
                life: rand(0.4, 0.8), r0: 0.3, r1: 0.05, a0: 1, a1: 0,
              });
            }
            particles.spawn({ tex: T.ringRed, x: lp.x, y: lp.y, life: 0.7, r0: 0.4, r1: 1.6, a0: 0.9, a1: 0 });
          }
        }
      } else clone.visible = false;
      botPupil.x = scanning ? Math.sin(t * 3.2) * 6 : (hp.x - 1240) * 0.004;
      void dt;
      prevT = t;
    },
    reset() {
      prevT = -1;
      clone.visible = false;
      clone.alpha = 1;
      clone.position.set(2650, 545);
      verdict.text = "…";
    },
  };
  return act;
}

/* ═══════════ ACT 4 — MEMPOOL VIVARIUM ═══════════ */
export function buildAct4(stage: Container, T: TexKit, particles: Particles): ActDef {
  const W = 2400;
  const L = makeLayers(stage);
  roomShell(L, T, {
    w: W, wallCol: 0x2b2a21, topCol: 0x363427,
    fixtures: [500, 1100, 1700], fixTint: 0xffd9a0,
    washTint: 0xffd678, washAlpha: 0.11, pillars: [560, 2520],
  });
  signage(L, T, 700, 120, "THE MEMPOOL", "EVERY VALID TX FLOATS HERE UNTIL A BLOCK — FIRST-SEEN, NO FEE AUCTION", 0xffd678);
  tubeAt(L, 120);

  // POOL RULES board — the gag that's also the lesson
  const rules = new Container();
  rules.position.set(1520, 300);
  const rg2 = new Graphics();
  rg2.roundRect(-140, -84, 280, 168, 6).fill(0x1a2620);
  rg2.roundRect(-140, -84, 280, 168, 6).stroke({ width: 3, color: 0x39463e });
  rules.addChild(rg2);
  const rt = mono("POOL RULES", 17, 0xffd678, { anchor: 0.5, ls: 3, weight: "700" });
  rt.position.set(0, -60);
  const rl1 = mono("1. FIRST SEEN, FIRST SERVED", 11.5, C.fgMid, { weight: "400" });
  rl1.position.set(-120, -34);
  const rl2 = mono("2. NO RUNNING (NO RBF)", 11.5, C.fgMid, { weight: "400" });
  rl2.position.set(-120, -8);
  const rl3 = mono("3. EVERYONE GETS IN — 32 MB", 11.5, C.fgMid, { weight: "400" });
  rl3.position.set(-120, 18);
  const rl4 = mono("4. ~1 sat/vB. ALWAYS.", 11.5, C.fgMid, { weight: "400" });
  rl4.position.set(-120, 44);
  rules.addChild(rt, rl1, rl2, rl3, rl4);
  L.back.addChild(rules);
  // wall clock
  const clock = new Container();
  clock.position.set(1250, 300);
  const cf = new Graphics();
  cf.circle(0, 0, 52).fill(0x39463e);
  cf.circle(0, 0, 45).fill(0x1a2620).circle(0, 0, 45).stroke({ width: 2.5, color: 0x4a5850 });
  cf.circle(0, 0, 4).fill(C.bch500);
  clock.addChild(cf);
  const hand = new Graphics().moveTo(0, 0).lineTo(0, -33).stroke({ width: 3.5, color: C.bch500, cap: "round" });
  clock.addChild(hand);
  const clockLbl = mono("SINCE LAST BLOCK", 9, C.fgMute, { anchor: 0.5, ls: 1, weight: "400" });
  clockLbl.position.set(0, 70);
  clock.addChild(clockLbl);
  L.back.addChild(clock);

  // ── THE POOL ──
  const pool = new Graphics();
  pool.roundRect(846, 686, 828, 16, 5).fill(0x7a7f6c);
  pool.roundRect(846, 686, 828, 5, 5).fill(0x9aa08a);
  pool.rect(860, 700, 800, 135).fill(0x0d3b35);
  L.main.addChild(pool);
  // drain hatch + stencil revealed when the water goes
  const drainG = new Graphics();
  drainG.ellipse(1260, 833, 34, 8).fill(0x06110f);
  for (const gx of [-22, -11, 0, 11, 22]) drainG.rect(1258 + gx, 827, 3, 12).fill(0x1a2a26);
  L.main.addChild(drainG);
  const stencil = mono("→ BLOCK ASSEMBLY, BELOW", 13, 0x9ff0d8, { anchor: 0.5, ls: 2, weight: "400" });
  stencil.position.set(1260, 800);
  stencil.alpha = 0;
  L.main.addChild(stencil);
  const vortex = new Graphics();
  L.main.addChild(vortex);
  const waterG = new Graphics();
  L.main.addChild(waterG);
  const poolGlow = new Sprite(T.glowGreen);
  poolGlow.anchor.set(0.5);
  poolGlow.position.set(1260, 760);
  poolGlow.width = 900;
  poolGlow.height = 220;
  poolGlow.alpha = 0.35;
  poolGlow.blendMode = "add";
  L.lights.addChild(poolGlow);
  const waterSurf = new Graphics();
  L.main.addChild(waterSurf);

  // diving board
  const board = new Graphics();
  board.rect(806, 690, 24, 10).fill(0x39463e);
  board.roundRect(730, 676, 128, 12, 5).fill(0x8fd8ff);
  board.roundRect(730, 676, 128, 4, 5).fill(0xbfe8ff);
  L.main.addChild(board);
  // ladder out
  const ladder = new Graphics();
  ladder.roundRect(1646, 640, 6, 70, 3).fill(0xb8c4bc);
  ladder.roundRect(1674, 640, 6, 70, 3).fill(0xb8c4bc);
  for (const ry of [656, 676, 696]) ladder.roundRect(1646, ry, 34, 5, 2.5).fill(0xb8c4bc);
  L.main.addChild(ladder);
  // deck: umbrella, loungers, beach ball
  const deck = new Graphics();
  deck.rect(1836, 470, 8, 218).fill(0xd0d6c8);
  deck.moveTo(1720, 480).quadraticCurveTo(1840, 380, 1960, 480).lineTo(1930, 480)
    .quadraticCurveTo(1900, 455, 1870, 480).lineTo(1840, 480)
    .quadraticCurveTo(1810, 455, 1780, 480).lineTo(1750, 480)
    .quadraticCurveTo(1735, 468, 1720, 480).closePath().fill(C.warn);
  for (const lx of [1900, 2060]) {
    deck.roundRect(lx, 660, 120, 10, 4).fill(0x4a453a);
    deck.moveTo(lx + 6, 660).lineTo(lx - 24, 612).stroke({ width: 8, color: 0x4a453a, cap: "round" });
    deck.roundRect(lx + 10, 670, 6, 20, 2).fill(0x39352c);
    deck.roundRect(lx + 100, 670, 6, 20, 2).fill(0x39352c);
  }
  deck.circle(1770, 674, 16).fill(0xf0f0e8);
  deck.moveTo(1754, 674).quadraticCurveTo(1770, 664, 1786, 674).quadraticCurveTo(1770, 684, 1754, 674).closePath().fill(C.danger);
  deck.circle(1770, 674, 16).stroke({ width: 2, color: 0x39352c, alpha: 0.4 });
  L.main.addChild(deck);

  // hero's inflatable ring + the fleet of floaties
  const heroRing = new Graphics();
  heroRing.ellipse(0, 0, 44, 14).stroke({ width: 12, color: 0xff8fb3 });
  heroRing.ellipse(0, 0, 44, 14).stroke({ width: 3, color: 0xffc2d6, alpha: 0.7 });
  heroRing.visible = false;
  L.main.addChild(heroRing);
  const floatTints = [0xffb3c6, 0x8fd8ff, 0xffe08a];
  const floaties = floatTints.map((ft) => {
    const f = new Graphics();
    f.ellipse(0, 0, 38, 12).stroke({ width: 10, color: ft });
    L.main.addChild(f);
    return f;
  });

  // fellow residents, already in the pool
  const bgs = [
    new BgFlask(T, 1150, 652, C.bch400, 0xe8b547),
    new BgFlask(T, 1320, 652, C.bch400),
    new BgFlask(T, 1480, 652, C.bch400, C.neon400),
  ];
  bgs.forEach((b) => L.main.addChild(b.c));
  // one of them brought sunglasses
  const shades = new Graphics().roundRect(-13, 1, 26, 6, 3).fill({ color: 0x0a0a0a, alpha: 0.9 });
  bgs[1].body.addChild(shades);

  // klaxon wash
  const klaxon = new Sprite(T.glowWhiteBig);
  klaxon.tint = C.bch400;
  klaxon.anchor.set(0.5);
  klaxon.position.set(W / 2, 400);
  klaxon.width = W * 1.2;
  klaxon.height = 1100;
  klaxon.alpha = 0;
  klaxon.blendMode = "add";
  L.lights.addChild(klaxon);

  let prevT = -1;
  const act: ActDef = {
    title: "MEMPOOL POOL PARTY",
    dur: 24.9,
    worldW: W,
    L,
    captions: [
      [0.5, 5.2, "The mempool. Literally — the pool. Every valid transaction floats here until a block comes."],
      [6.2, 10.8, "No fee auction, no VIP section. 32 MB of room means everyone who pays ~1 sat/byte gets a float."],
      [11.2, 15.8, "House rules: first seen, first served — and no replacements (no RBF). Conflicting spends bounce at the gate."],
      [16.2, 20.4, "How long do they float? Blocks are a lottery — ten minutes on average, never on schedule."],
      [20.8, 24.2, "A block! And the pool drains — every transaction swept down into it. See you below."],
    ],
    heroAt(t) {
      const enter = enterViaTube(t, 120);
      if (enter) return enter;
      if (t < 5.4) return { x: Math.min(820, 120 + (t - 1.3) * 170), y: WALK_Y, moving: true, visible: true };
      if (t < 6.1) {
        const k = (t - 5.4) / 0.7;
        return { x: 820 + k * 160, y: WALK_Y - Math.sin(k * Math.PI) * 130 + k * 12, moving: false, visible: true };
      }
      const wl = t < 21 ? 700 : Math.min(830, 700 + ((t - 21) / 2.0) * 130);
      if (t < 21) return { x: 980 + Math.sin(t * 0.5) * 14, y: 652 + Math.sin(t * 1.6) * 4, moving: false, visible: true };
      if (t < 22.3) {
        const k = (t - 21) / 1.3;
        const fx = 980 + Math.sin(21 * 0.5) * 14;
        return { x: fx + (1260 - fx) * k + Math.sin(t * 6) * (1 - k) * 10, y: wl - 48 + Math.sin(t * 3) * 3, moving: false, visible: true };
      }
      if (t < 23.1) {
        const k = (t - 22.3) / 0.8;
        return { x: 1260, y: wl - 48 + k * 140, moving: false, visible: k < 0.75, squeezeX: 0.55 };
      }
      return { x: 1260, y: 960, moving: false, visible: false };
    },
    camX: camFollow(W),
    update(t, _dt) {
      // water shimmer
      waterSurf.clear();
      for (let wx = 870; wx < 1650; wx += 46) {
        const wy = 702 + Math.sin(t * 2 + wx * 0.05) * 2.5;
        waterSurf.moveTo(wx, wy).lineTo(wx + 26, wy);
      }
      waterSurf.stroke({ width: 2.5, color: 0x9ff0d8, alpha: 0.35 });

      const wl = t < 21 ? 700 : Math.min(830, 700 + ((t - 21) / 2.0) * 130);

      // dynamic water level + stencil reveal
      waterG.clear();
      if (wl < 833) {
        waterG.rect(860, wl, 800, 835 - wl).fill({ color: C.bch500, alpha: 0.35 });
        waterG.rect(860, wl, 800, Math.min(26, 835 - wl)).fill({ color: 0x9ff0d8, alpha: 0.12 });
      }
      stencil.alpha = clamp((wl - 785) / 45, 0, 1);

      // drain vortex while draining
      vortex.clear();
      if (t > 20.9 && t < 23.3) {
        for (let k = 0; k < 3; k++) {
          const a0 = t * 5 + k * 2.1;
          vortex.moveTo(1260 + Math.cos(a0) * 30, wl + 2 + Math.sin(a0) * 6)
            .quadraticCurveTo(1260 + Math.cos(a0 + 1.2) * 18, wl + 6, 1260, wl + 10)
            .stroke({ width: 2.5, color: 0x9ff0d8, alpha: 0.5 });
        }
        if (Math.random() < _dt * 20) {
          const a = rand(0, Math.PI * 2);
          const r = rand(40, 200);
          particles.spawn({
            tex: T.dotWhite, tint: 0x9ff0d8, x: 1260 + Math.cos(a) * r, y: wl + rand(0, 10),
            vx: -Math.cos(a) * r * 1.6, vy: rand(30, 80),
            life: 0.6, r0: 0.25, r1: 0.06, a0: 0.7, a1: 0,
          });
        }
      }

      // floaters: bob, then spiral down the drain — the rings stay behind
      const BX = [1150, 1320, 1480];
      bgs.forEach((b, i) => {
        const ds = 21.1 + i * 0.35;
        if (t < ds) {
          b.c.alpha = 1;
          b.c.scale.set(1);
          b.c.position.set(BX[i], Math.min(652, wl - 48) + Math.sin(t * 1.5 + i * 2) * 4);
        } else {
          const k = clamp((t - ds) / 0.55, 0, 1);
          b.c.position.set(BX[i] + (1260 - BX[i]) * k, wl - 48 + k * 90);
          b.c.scale.set(1 - k * 0.5);
          b.c.alpha = 1 - Math.max(0, k - 0.7) / 0.3;
        }
        floaties[i].position.set(
          t < ds ? b.c.x : 1260 + (BX[i] - 1260) * 0.4 + (i - 1) * 60,
          Math.min(wl, 828) - 4 + Math.sin(t * 1.8 + i) * 2,
        );
        floaties[i].visible = true;
      });

      // hero's ring: along for the float, abandoned at the drain
      const hp = act.heroAt(t);
      heroRing.visible = t > 6.05;
      if (t < 22.3) heroRing.position.set(hp.x, hp.y + 30);
      else heroRing.position.set(heroRing.x, Math.min(wl, 828) - 6 + Math.sin(t * 1.8) * 2);

      // clock: normal, then time-lapse spin during the "lottery" caption
      const spin = t > 16 && t < 20 ? 4.5 : 0.12;
      hand.rotation += spin * _dt * Math.PI;

      // cannonball splash
      if (crossed(prevT, t, 6.05)) {
        for (let i = 0; i < 22; i++) {
          const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
          particles.spawn({
            tex: T.dotWhite, tint: 0xbff5e2, x: 980, y: 700,
            vx: Math.cos(a) * rand(60, 240), vy: Math.sin(a) * rand(80, 260),
            ay: 420, life: rand(0.4, 0.9), r0: rand(0.25, 0.5), r1: 0.06, a0: 0.95, a1: 0,
          });
        }
        particles.spawn({ tex: T.ringGreen, x: 980, y: 700, life: 0.7, r0: 0.3, r1: 1.7, a0: 0.8, a1: 0 });
      }

      // klaxon at 20.6
      if (t > 20.6) klaxon.alpha = Math.max(0, Math.sin((t - 20.6) * 9) * 0.35) * Math.max(0, 1 - (t - 20.6) / 3.5);
      if (crossed(prevT, t, 20.6)) {
        for (let i = 0; i < 16; i++) {
          particles.spawn({
            tex: T.dotWhite, tint: C.bch400, x: rand(900, 1600), y: rand(660, 700),
            vx: rand(-40, 40), vy: rand(-90, -30),
            life: rand(0.4, 0.8), r0: 0.3, r1: 0.05, a0: 0.9, a1: 0,
          });
        }
      }

      // ambient pool bubbles
      if (Math.random() < _dt * 4 && t < 21) {
        particles.spawn({
          tex: T.dotWhite, tint: 0x9ff0d8, x: rand(880, 1640), y: rand(710, 810),
          vx: 0, vy: -rand(20, 40), life: rand(0.6, 1.2), r0: 0.12, r1: 0.05, a0: 0.5, a1: 0,
        });
      }
      prevT = t;
    },
    reset() {
      prevT = -1;
      klaxon.alpha = 0;
      hand.rotation = 0;
      heroRing.visible = false;
      bgs.forEach((b) => {
        b.c.alpha = 1;
        b.c.scale.set(1);
      });
      floaties.forEach((f) => (f.visible = true));
    },
  };
  return act;
}

/* ═══════════ ACT 5 — THE BLOCK EVENT ═══════════ */
export function buildAct5(stage: Container, T: TexKit, particles: Particles): ActDef {
  const W = 2400;
  const L = makeLayers(stage);
  const { beltDashes } = roomShell(L, T, {
    w: W, wallCol: 0x2b241d, topCol: 0x38302a,
    conveyor: true,
    fixtures: [500, 1100], fixTint: 0xffc9a0,
    washTint: 0xff8c3c, washAlpha: 0.1, pillars: [250],
  });
  signage(L, T, 500, 120, "THE BLOCK", "FOUND ELSEWHERE — VERIFIED HERE. CTOR ORDER, NO FAVORITES", 0xffa04d);

  // freight gate on the right
  const gate = new Graphics();
  gate.rect(2200, 100, 30, 600).fill(0x39463e);
  for (let k = 0; k < 6; k++) gate.moveTo(2204, 140 + k * 90).lineTo(2226, 110 + k * 90).stroke({ width: 6, color: C.warn, alpha: 0.4 });
  L.main.addChild(gate);

  // the arriving crystal
  const crystal = gem(T, { r: 170, dots: 8, label: "#892,014", accent: 0x7fc4ff });
  crystal.position.set(2600, 520);
  L.main.addChild(crystal);
  const gantryBeam = new Graphics();
  gantryBeam.moveTo(0, 120).lineTo(0, 420).stroke({ width: 8, color: 0xbfe8ff, alpha: 0.7 });
  gantryBeam.blendMode = "add";
  gantryBeam.visible = false;
  L.lights.addChild(gantryBeam);
  const blockValid = mono("BLOCK VALID ✓", 22, C.bch400, { anchor: 0.5, weight: "700" });
  blockValid.position.set(1860, 240);
  blockValid.alpha = 0;
  L.main.addChild(blockValid);

  // lineup: 3 residents with wristband ids (hero id shown too)
  const IDS = ["1f", "7a", "c3"];
  const SORTED_SLOTS = [900, 1010, 1120, 1230]; // final CTOR positions
  const bgs = [
    new BgFlask(T, 1000, WALK_Y + 6, C.bch400, undefined, `7a41…`),
    new BgFlask(T, 870, WALK_Y + 6, C.bch400, 0xe8b547, `1f09…`),
    new BgFlask(T, 1280, WALK_Y + 6, C.bch400, undefined, `c3d2…`),
  ];
  bgs.forEach((b) => L.main.addChild(b.c));
  // hero label
  const heroLabel = mono("a3f2… (you)", 13, C.neon300, { anchor: 0.5 });
  heroLabel.visible = false;
  L.main.addChild(heroLabel);
  void IDS;

  let prevT = -1;
  const act: ActDef = {
    title: "THE BLOCK EVENT",
    dur: 27,
    worldW: W,
    L,
    captions: [
      [0.5, 6, "Down the drain, into the block chamber. A miner found this block — and our node still verifies every transaction in it."],
      [6.5, 11.5, "Block checks out. Now everyone lines up in canonical order — sorted by txid. No fee priority, no favorites. That's CTOR."],
      [12, 16.5, "The miner earns the coinbase — 3.125 BCH plus everyone's fees. That's who mining pays, and why they hurry."],
      [17, 22, "One by one, into the block. The crystal holds them all — permanently."],
      [22.5, 26.2, "One block. One confirmation. Yours, forever."],
    ],
    heroAt(t) {
      // rains in from the drained pool above
      if (t < 0.5) return { x: 1150, y: -140, moving: false, visible: false };
      if (t < 1.15) {
        const k = (t - 0.5) / 0.65;
        return { x: 1150, y: -140 + (WALK_Y + 140) * k * k, moving: false, visible: true, squeezeX: 0.85 };
      }
      if (t < 1.6) {
        const k = (t - 1.15) / 0.45;
        const squashY = k < 0.4 ? 0.62 : 0.62 + ((k - 0.4) / 0.6) * 0.38;
        return { x: 1150, y: WALK_Y, moving: false, visible: true, squashY };
      }
      if (t < 8) return { x: 1150, y: WALK_Y, moving: false, visible: true };
      // CTOR: hero's a3f2 sorts FIRST → slides to slot 1 during 8-10
      if (t < 10) return { x: 1150 + (SORTED_SLOTS[0] - 1150) * ((t - 8) / 2), y: WALK_Y, moving: true, visible: true };
      if (t < 17.5) return { x: SORTED_SLOTS[0], y: WALK_Y, moving: false, visible: true };
      // absorbed LAST at ~21
      if (t < 21) return { x: SORTED_SLOTS[0], y: WALK_Y, moving: false, visible: true };
      if (t < 22.2) {
        const k = (t - 21) / 1.2;
        return { x: SORTED_SLOTS[0] + (1900 - SORTED_SLOTS[0]) * k, y: WALK_Y - k * 120, moving: false, visible: k < 0.92 };
      }
      return { x: 1900, y: 460, moving: false, visible: false };
    },
    camX: (t, hx) => {
      const base = clamp(hx + 200, 700, W - 700);
      if (t < 2.4) return 1080;
      if (t < 4) return 1080 + (1550 - 1080) * ((t - 2.4) / 1.6);
      if (t < 5) return 1550 + (base - 1550) * (t - 4);
      if (t < 16) return base;
      const k = clamp((t - 16) / 1.2, 0, 1);
      return base + (1550 - base) * k;
    },
    update(t, dt) {
      // crystal slides in after the rain-in beat
      crystal.x = t < 2.5 ? 2600 : t < 5.2 ? 2600 - ((t - 2.5) / 2.7) * 700 : 1900;
      const verifying = t >= 5.2 && t < 7;
      gantryBeam.visible = verifying;
      if (verifying) {
        gantryBeam.x = 1900 + Math.sin(t * 2.8) * 150;
        gantryBeam.alpha = 0.4 + Math.sin(t * 9) * 0.25;
      }
      blockValid.alpha = t >= 7 && t < 9.5 ? clamp((t - 7) * 3, 0, 1) * clamp((9.5 - t), 0, 1) : 0;
      if (crossed(prevT, t, 7)) {
        for (let i = 0; i < 18; i++) {
          const a = rand(0, Math.PI * 2);
          particles.spawn({
            tex: T.dotWhite, tint: 0x7fc4ff, x: 1900, y: 460,
            vx: Math.cos(a) * rand(50, 180), vy: Math.sin(a) * rand(50, 180),
            life: rand(0.5, 1), r0: 0.35, r1: 0.05, a0: 1, a1: 0,
          });
        }
      }
      // labels on during lineup/sort
      const labelsOn = t >= 7 && t < 18;
      bgs.forEach((b) => {
        if (b.label) b.label.visible = labelsOn;
      });
      heroLabel.visible = labelsOn;
      const hp = act.heroAt(t);
      heroLabel.position.set(hp.x, WALK_Y - 100);
      // CTOR shuffle at 8-10: 1f→slot2, 7a→slot3, c3→slot4 (hero a3→slot1 via heroAt)
      const sortK = clamp((t - 8) / 2, 0, 1);
      const ease = sortK * sortK * (3 - 2 * sortK);
      bgs[1].baseX = 870 + (SORTED_SLOTS[1] - 870) * ease;   // 1f09
      bgs[0].baseX = 1000 + (SORTED_SLOTS[2] - 1000) * ease; // 7a41
      bgs[2].baseX = 1280 + (SORTED_SLOTS[3] - 1280) * ease; // c3d2
      bgs.forEach((b, i) => {
        const fs = 0.7 + i * 0.25;
        if (t < fs) {
          b.c.position.set(b.baseX, -160);
        } else if (t < fs + 0.6) {
          const k = (t - fs) / 0.6;
          b.c.position.set(b.baseX, -140 + (WALK_Y + 6 + 140) * k * k);
        } else {
          b.bob(t, i);
        }
      });
      // absorption: residents slide into the crystal at 17.5/18.7/19.9; hero at 21 (heroAt)
      [1, 0, 2].forEach((bi, order) => {
        const start = 17.5 + order * 1.2;
        if (t >= start) {
          const k = clamp((t - start) / 1.1, 0, 1);
          const b = bgs[bi];
          b.baseX = SORTED_SLOTS[order + 1] + (1900 - SORTED_SLOTS[order + 1]) * k;
          b.c.y = WALK_Y + 6 - k * 120;
          b.c.alpha = k < 0.9 ? 1 : 1 - (k - 0.9) * 10;
          if (b.label) b.label.visible = false;
        }
      });
      for (const [mark] of [[18.5], [19.7], [20.9], [22.1]] as const) {
        if (crossed(prevT, t, mark)) {
          for (let i = 0; i < 10; i++) {
            const a = rand(0, Math.PI * 2);
            particles.spawn({
              tex: T.dotWhite, tint: 0x8fd4ff, x: 1900 + Math.cos(a) * 100, y: 470 + Math.sin(a) * 80,
              vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 50,
              life: 0.6, r0: 0.3, r1: 0.05, a0: 0.9, a1: 0,
            });
          }
        }
      }
      beltDashes.clear();
      void dt;
      prevT = t;
    },
    reset() {
      prevT = -1;
      crystal.position.set(2600, 520);
      blockValid.alpha = 0;
      bgs[0].baseX = 1000; bgs[0].c.y = 0; bgs[0].c.alpha = 1;
      bgs[1].baseX = 870; bgs[1].c.y = 0; bgs[1].c.alpha = 1;
      bgs[2].baseX = 1280; bgs[2].c.y = 0; bgs[2].c.alpha = 1;
    },
  };
  return act;
}

/* ═══════════ ACT 6 — THE ARCHIVE (epilogue) ═══════════ */
export function buildAct6(stage: Container, T: TexKit, particles: Particles): ActDef {
  const W = 2000;
  const L = makeLayers(stage);
  roomShell(L, T, {
    w: W, wallCol: 0x1f2630, topCol: 0x2a3340,
    fixtures: [500, 1000, 1500], fixTint: 0xbcd9ff,
    washTint: 0x6fb7ff, washAlpha: 0.1,
  });
  signage(L, T, 780, 120, "THE ARCHIVE", "THE BLOCKCHAIN — KEPT BY EVERY NODE, FOREVER", 0x7fc4ff);

  // shelf rail
  const rail = new Graphics();
  rail.roundRect(-200, 700, W + 400, 10, 4).fill(0x39463e);
  L.main.addChild(rail);

  // older blocks receding (back layer, smaller)
  for (let i = 0; i < 4; i++) {
    const g = gem(T, { r: 78 - i * 10, dots: 6 - i, label: `#${(892013 - i).toLocaleString()}`, accent: 0x5f94c4 });
    g.position.set(950 - i * 260, 600);
    g.alpha = 0.75 - i * 0.12;
    L.back.addChild(g);
  }

  // OUR crystal (hero inside, waving)
  const ours = gem(T, { r: 120, dots: 5, label: "#892,014", face: true, accent: 0x7fc4ff });
  ours.position.set(2300, 570);
  L.main.addChild(ours);

  // later blocks pile in behind ours — confirmations, made visible
  const later1 = gem(T, { r: 92, dots: 7, label: "#892,015", accent: 0x5f94c4 });
  later1.position.set(2350, 585);
  L.main.addChild(later1);
  const later2 = gem(T, { r: 88, dots: 5, label: "#892,016", accent: 0x5f94c4 });
  later2.position.set(2350, 588);
  L.main.addChild(later2);

  const confLbl = mono("CONFIRMATIONS: 1", 18, 0x7fc4ff, { anchor: 0.5, weight: "700" });
  confLbl.position.set(1400, 330);
  confLbl.alpha = 0;
  L.main.addChild(confLbl);

  // vial return pod
  const pod = new Container();
  const pg = new Graphics();
  pg.roundRect(-26, -40, 52, 80, 22).fill({ color: 0x27352d, alpha: 0.9 });
  pg.roundRect(-26, -40, 52, 80, 22).stroke({ width: 3, color: 0x4a5850 });
  pg.roundRect(-14, -20, 12, 26, 4).fill({ color: C.bch400, alpha: 0.9 });
  pg.roundRect(2, -20, 12, 26, 4).fill({ color: C.fgMid, alpha: 0.9 });
  pod.addChild(pg);
  const podLbl = mono("new UTXOs → future spends", 10, C.fgMute, { anchor: 0.5, weight: "400" });
  podLbl.position.set(0, 62);
  pod.addChild(podLbl);
  pod.position.set(1750, 900);
  pod.visible = false;
  L.main.addChild(pod);

  let prevT = -1;
  const act: ActDef = {
    title: "THE ARCHIVE",
    dur: 24,
    worldW: W,
    L,
    captions: [
      [0.5, 5.5, "Sealed in block #892,014 — recorded by every node on the network. There is no undo."],
      [6, 11, "Each new block on top is another confirmation. The deeper you are, the harder history is to rewrite."],
      [11.5, 16.5, "And your outputs? They're UTXOs now — fresh reagents on someone's wallet shelf. The cycle continues."],
      [17, 23.2, "This is Bitcoin Cash: peer-to-peer electronic cash — built, checked, and kept by everyone. Ride again?"],
    ],
    heroAt() {
      return { x: -500, y: WALK_Y, moving: false, visible: false };
    },
    camX: (t) => (t < 14 ? 1400 : 1400 - Math.min(150, (t - 14) * 40)),
    zoom: (t) => (t < 14 ? 1 : Math.max(0.82, 1 - (t - 14) * 0.03)),
    update(t, _dt) {
      // our crystal slides onto the shelf
      ours.x = t < 3 ? 2300 - (t / 3) * 900 : 1400;
      // confirmations tick as new blocks physically arrive behind ours
      confLbl.alpha = clamp((t - 3.2) / 0.6, 0, 1);
      const confs = t < 7 ? 1 : t < 11 ? 2 : 3;
      confLbl.text = `CONFIRMATIONS: ${confs}`;
      const slideIn = (start: number, target: number, obj: Container) => {
        if (t < start) obj.x = 2350;
        else {
          const k = clamp((t - start) / 1.1, 0, 1);
          obj.x = 2350 + (target - 2350) * (1 - (1 - k) * (1 - k));
        }
      };
      slideIn(7, 1720, later1);
      slideIn(11, 1990, later2);
      for (const mark of [7, 11]) {
        if (crossed(prevT, t, mark)) {
          particles.spawn({ tex: T.ringGreen, x: 1400, y: 330, life: 0.8, r0: 0.3, r1: 1.4, a0: 0.8, a1: 0 });
          for (let i = 0; i < 10; i++) {
            particles.spawn({
              tex: T.dotWhite, tint: 0x8fd4ff, x: 1400 + rand(-60, 60), y: 330 + rand(-20, 20),
              vx: rand(-30, 30), vy: rand(-50, -10),
              life: 0.7, r0: 0.25, r1: 0.05, a0: 0.9, a1: 0,
            });
          }
        }
      }
      for (const [mark, gx, gy] of [[8.1, 1720, 585], [12.1, 1990, 588]] as const) {
        if (crossed(prevT, t, mark)) {
          particles.spawn({ tex: T.ringGreen, x: gx, y: gy, life: 0.7, r0: 0.4, r1: 1.5, a0: 0.7, a1: 0 });
        }
      }
      // vial pod rises during the UTXO caption
      if (t > 11.5 && t < 17.5) {
        pod.visible = true;
        pod.y = 900 - clamp((t - 11.5) / 2, 0, 1) * 420;
        pod.alpha = t < 16 ? 1 : Math.max(0, 1 - (t - 16) / 1.2);
      } else pod.visible = false;
      prevT = t;
    },
    reset() {
      prevT = -1;
      ours.x = 2300;
      later1.x = 2350;
      later2.x = 2350;
      confLbl.alpha = 0;
      pod.visible = false;
    },
  };
  return act;
}
