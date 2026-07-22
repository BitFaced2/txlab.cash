import { Circle, Container, Graphics, Sprite, Text } from "pixi.js";
import { C, hslToHex } from "./palette";
import type { TexKit } from "./textures";
import { GEOM, mono, type SceneRefs } from "./world";
import { Anims, Camera, easeInOutCubic, easeOutBounce, easeOutCubic } from "./effects";

/* Block discovery is a memoryless lottery: exponential inter-arrival times.
   Mean 40 sim-seconds ≈ a compressed 10-minute BCH average. */
const BLOCK_MEAN = 40;
const BLOCK_MIN = 8;
const BLOCK_MAX = 120;
/* Our node verifies every block, but almost never mines one. */
const LOCAL_MINE_P = 0.12;

const SPAWN_MIN = 2.5;
const SPAWN_MAX = 5.5;
const CLONE_MIN = 18;
const CLONE_MAX = 34;
const MAX_CREATURES = 24;
const MALFORMED_RATE = 0.06;
const DUCT_RATE = 0.3;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randi = (a: number, b: number) => Math.floor(rand(a, b + 1));
const pick = <T,>(arr: T[]) => arr[randi(0, arr.length - 1)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const hexc = (n: number) => "0123456789abcdef"[n & 15];
const shortId = () => {
  let s = "";
  for (let i = 0; i < 6; i++) s += hexc(randi(0, 15));
  return s;
};
const hashHue = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return h % 360;
};
const expDelay = () => clamp(-BLOCK_MEAN * Math.log(1 - Math.random()), BLOCK_MIN, BLOCK_MAX);

export type TxType = "plain" | "fungible" | "nft" | "nft-mint";

export const TYPE_LABEL: Record<TxType, string> = {
  plain: "plain BCH",
  fungible: "BCH + fungible CashTokens",
  nft: "BCH + NFT pet",
  "nft-mint": "NFT mint (minting authority)",
};

/* ── Waypoint steps ── */
type Step =
  | { kind: "walk"; x: number; y: number; speed: number }
  | { kind: "tube"; toY: number }
  | { kind: "wait"; t: number }
  | { kind: "call"; fn: () => void };

type Phase =
  | "pipeline" | "lounging" | "boarding" | "staged"
  | "sealed" | "zapped" | "rejected" | "gone";

interface CreatureOpts {
  type?: TxType;
  tokenHue?: number;
  utxo?: string;
  imposterOf?: number | null;
  isUser?: boolean;
  malformed?: boolean;
  origin: "pod" | "duct";
}

export class Creature {
  id: number;
  txid = shortId();
  x: number;
  y: number;
  phase: Phase = "pipeline";
  type: TxType;
  tokenHue: number;
  tokenCount: number;
  isUser: boolean;
  utxo: string;
  categoryId = shortId();
  vsize: number;
  imposterOf: number | null;
  malformed: boolean;
  origin: "pod" | "duct";
  sealedHeight: number | null = null;
  shieldUntil = 0;
  wiggle = rand(0, Math.PI * 2);
  walkPhase = 0;

  route: Step[] = [];
  onRouteDone: (() => void) | null = null;

  wx = 0;
  wy = 0;
  waitUntil = 0;

  c = new Container();
  body = new Container();
  selRing = new Container();
  label: Text | null = null;
  private shield: Graphics;
  private userRing: Container | null = null;
  private mintHalo: Sprite | null = null;
  private legL: Graphics;
  private legR: Graphics;
  private pets: Sprite[] = [];
  private trail: { x: number; y: number }[] = [];
  private prevX: number;
  private prevY: number;

  constructor(id: number, x: number, y: number, opts: CreatureOpts, T: TexKit) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.type = opts.type ?? Creature.roll();
    this.tokenHue = opts.tokenHue ?? hashHue(shortId());
    this.tokenCount =
      this.type === "fungible" ? randi(3, 6) :
      this.type === "nft" || this.type === "nft-mint" ? 1 : 0;
    this.isUser = !!opts.isUser;
    this.utxo = opts.utxo ?? shortId();
    this.imposterOf = opts.imposterOf ?? null;
    this.malformed = !!opts.malformed;
    this.origin = opts.origin;
    this.vsize = randi(192, 260) + this.tokenCount * 34 +
      (this.type === "nft" || this.type === "nft-mint" ? 40 : 0);

    const isClone = this.imposterOf !== null;
    const liquid = isClone ? C.danger : C.bch400;
    const liquidDeep = isClone ? 0x8a2f38 : C.bch600;

    const sh = new Sprite(T.dotWhite);
    sh.anchor.set(0.5);
    sh.tint = 0x000000;
    sh.alpha = 0.4;
    sh.blendMode = "normal";
    sh.position.set(0, 17);
    sh.width = 22;
    sh.height = 6;
    this.c.addChild(sh);

    const glow = new Sprite(isClone ? T.glowRed : T.glowGreen);
    glow.anchor.set(0.5);
    glow.width = glow.height = 54;
    glow.alpha = 0.5;
    glow.blendMode = "add";
    this.body.addChild(glow);

    if (this.type === "nft-mint") {
      this.mintHalo = new Sprite(T.ringNeon);
      this.mintHalo.anchor.set(0.5);
      this.mintHalo.width = this.mintHalo.height = 42;
      this.mintHalo.blendMode = "add";
      this.body.addChild(this.mintHalo);
    }

    this.legL = new Graphics().roundRect(-1.5, 0, 3, 8, 1.5).fill(0x9fb8ac);
    this.legL.position.set(-5, 9);
    this.legR = new Graphics().roundRect(-1.5, 0, 3, 8, 1.5).fill(0x9fb8ac);
    this.legR.position.set(5, 9);
    this.body.addChild(this.legL, this.legR);

    const flask = new Graphics();
    flask.roundRect(-5, -22, 10, 5, 1.5).fill(0x8a6a4a);
    if (this.type === "nft-mint") {
      flask.poly([-5, -22, -3, -27, -1, -23, 1, -28, 3, -23, 5, -27, 5, -22]).fill(C.neon400);
    }
    flask.rect(-4, -17, 8, 8).fill({ color: 0x22302a, alpha: 0.5 });
    flask.circle(0, 2, 11).fill({ color: 0x22302a, alpha: 0.5 });
    flask.circle(0, 4, 8.5).fill({ color: liquid, alpha: 0.95 });
    flask.circle(0, 4, 8.5).stroke({ width: 1, color: liquidDeep, alpha: 0.7 });
    flask.circle(-3.5, 8, 1.1).fill({ color: 0xffffff, alpha: 0.5 });
    flask.circle(2.5, 9.5, 0.8).fill({ color: 0xffffff, alpha: 0.4 });
    flask.circle(0, 2, 11).stroke({ width: 1.2, color: 0x9fb8ac, alpha: 0.85 });
    flask.rect(-4, -17, 8, 8).stroke({ width: 1, color: 0x9fb8ac, alpha: 0.7 });
    flask.ellipse(-4.5, -3, 1.8, 3.6).fill({ color: 0xffffff, alpha: 0.22 });
    if (isClone) flask.roundRect(-8, 0, 16, 4.5, 2).fill({ color: 0x000000, alpha: 0.6 });
    flask.circle(-3.5, 2.5, 1.4).fill(C.canvas);
    flask.circle(3.5, 2.5, 1.4).fill(C.canvas);
    flask.moveTo(-2.5, 7).quadraticCurveTo(0, 9, 2.5, 7).stroke({ width: 1.1, color: C.canvas, cap: "round" });
    this.body.addChild(flask);

    /* DSProof shield badge (shown briefly when this tx survives a double-spend attempt) */
    this.shield = new Graphics();
    this.shield.moveTo(0, -36).lineTo(6, -33).lineTo(6, -27).quadraticCurveTo(6, -22, 0, -20)
      .quadraticCurveTo(-6, -22, -6, -27).lineTo(-6, -33).closePath()
      .fill({ color: C.bch500, alpha: 0.9 });
    this.shield.moveTo(-2.5, -28).lineTo(-0.5, -25.5).lineTo(3, -31).stroke({ width: 1.4, color: C.canvas, cap: "round" });
    this.shield.visible = false;
    this.c.addChild(this.shield);

    if (this.type === "fungible") {
      const col = hslToHex(this.tokenHue, 70, 60);
      for (let i = 0; i < this.tokenCount; i++) {
        const p = new Sprite(T.dotWhite);
        p.anchor.set(0.5);
        p.tint = col;
        p.width = p.height = 7;
        p.blendMode = "normal";
        this.c.addChild(p);
        this.pets.push(p);
      }
    } else if (this.type === "nft" || this.type === "nft-mint") {
      const col = hslToHex(this.tokenHue, 75, 55);
      const p = new Sprite(T.dotWhite);
      p.anchor.set(0.5);
      p.tint = col;
      p.width = p.height = 10;
      p.blendMode = "normal";
      this.c.addChild(p);
      this.pets.push(p);
    }

    this.c.addChild(this.body);

    if (this.isUser) {
      this.userRing = new Container();
      for (let i = 0; i < 10; i++) {
        const d = new Sprite(T.dotWhite);
        d.anchor.set(0.5);
        d.tint = C.neon300;
        d.width = d.height = 4;
        const a = (i / 10) * Math.PI * 2;
        d.position.set(Math.cos(a) * 22, Math.sin(a) * 22);
        this.userRing.addChild(d);
      }
      this.c.addChild(this.userRing);
    }

    for (let i = 0; i < 12; i++) {
      const d = new Sprite(T.dotWhite);
      d.anchor.set(0.5);
      d.tint = C.fg;
      d.width = d.height = 3;
      const a = (i / 12) * Math.PI * 2;
      d.position.set(Math.cos(a) * 19, Math.sin(a) * 19);
      this.selRing.addChild(d);
    }
    this.selRing.visible = false;
    this.c.addChild(this.selRing);

    this.c.position.set(x, y);
    this.c.scale.set(1.15);
    this.c.eventMode = "static";
    this.c.cursor = "pointer";
    this.c.hitArea = new Circle(0, 0, 22);
  }

  static roll(): TxType {
    const r = Math.random();
    if (r < 0.05) return "nft";
    if (r < 0.25) return "fungible";
    return "plain";
  }

  showLabel(T: TexKit) {
    if (!this.label) {
      this.label = mono(this.txid, 6, C.bch400, { anchor: 0.5 });
      this.label.position.set(0, -34);
      this.c.addChild(this.label);
    }
    this.label.visible = true;
  }

  update(dt: number, time: number) {
    if (this.phase === "sealed" || this.phase === "gone") return;

    let moving = false;
    let inTube = false;

    if (this.route.length > 0) {
      const step = this.route[0];
      if (step.kind === "walk") {
        const dx = step.x - this.x;
        const dy = step.y - this.y;
        const dist = Math.hypot(dx, dy);
        const d = step.speed * dt;
        if (dist < 2.5) {
          this.x = step.x;
          this.y = step.y;
          this.route.shift();
        } else {
          this.x += (dx / dist) * Math.min(d, dist);
          this.y += (dy / dist) * Math.min(d, dist);
          moving = true;
        }
      } else if (step.kind === "tube") {
        inTube = true;
        this.y += 210 * dt;
        if (this.y >= step.toY) {
          this.y = step.toY;
          this.route.shift();
        }
      } else if (step.kind === "wait") {
        step.t -= dt;
        if (step.t <= 0) this.route.shift();
      } else {
        this.route.shift();
        step.fn();
        if (this.phase === "zapped" || this.phase === "rejected") return;
      }
      if (this.route.length === 0 && this.onRouteDone) {
        const cb = this.onRouteDone;
        this.onRouteDone = null;
        cb();
      }
    } else if (this.phase === "lounging") {
      if (time > this.waitUntil) {
        this.wx = rand(GEOM.VIV.minX + 15, GEOM.VIV.maxX - 15);
        this.wy = rand(GEOM.VIV.minY + 10, GEOM.VIV.maxY - 10);
        this.waitUntil = time + rand(3, 8);
      }
      const dx = this.wx - this.x;
      const dy = this.wy - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 2.5) {
        const d = 24 * dt;
        this.x += (dx / dist) * Math.min(d, dist);
        this.y += (dy / dist) * Math.min(d, dist);
        moving = true;
      }
    }

    if (inTube) {
      this.body.scale.set(0.55, 1.25);
    } else {
      const vx = (this.x - this.prevX) / Math.max(dt, 1e-4);
      const vy = (this.y - this.prevY) / Math.max(dt, 1e-4);
      const v = Math.hypot(vx, vy);
      const stretch = 1 + Math.min(0.12, v / 750);
      this.body.scale.set(stretch, 1 / stretch);
    }
    this.prevX = this.x;
    this.prevY = this.y;

    if (moving && !inTube) {
      this.walkPhase += dt * 11;
      this.legL.rotation = Math.sin(this.walkPhase) * 0.55;
      this.legR.rotation = Math.sin(this.walkPhase + Math.PI) * 0.55;
    } else {
      this.legL.rotation *= 0.8;
      this.legR.rotation *= 0.8;
    }

    this.wiggle += dt * 3;
    const bob = !moving && !inTube && this.phase === "lounging" ? Math.sin(this.wiggle) * 1.3 : 0;
    this.c.position.set(this.x, this.y + bob);

    this.shield.visible = time < this.shieldUntil;

    if (this.pets.length) {
      this.trail.unshift({ x: this.x, y: this.y + bob });
      if (this.trail.length > 80) this.trail.pop();
      this.pets.forEach((p, i) => {
        const idx = Math.min(this.trail.length - 1, (i + 1) * 7);
        const pt = this.trail[idx] ?? this.trail[this.trail.length - 1];
        const bobP = Math.sin(this.wiggle + i) * 1.2;
        p.position.set(pt.x - this.x, pt.y - (this.y + bob) + 8 + bobP);
        p.visible = !inTube;
      });
    }

    if (this.userRing) this.userRing.rotation += dt * 1.1;
    if (this.selRing.visible) this.selRing.rotation -= dt * 0.9;
    if (this.mintHalo) {
      const t = (Math.sin(time * 4) + 1) / 2;
      this.mintHalo.alpha = 0.15 + t * 0.6;
      this.mintHalo.scale.set(0.37 + t * 0.07);
    }
  }
}

/* ═══════════════════ The simulation ═══════════════════ */

export interface SimHooks {
  addToast(kind: "dsproof" | "good" | "info", text: string): void;
  renderInspector(): void;
  updateReadouts(): void;
  onSynth(): void;
  onScanPass(x: number, y: number): void;
  onScanZap(x: number, y: number): void;
  onBroadcast(): void;
  onWhistle(): void;
  onReject(x: number, y: number): void;
  onDSProof(): void;
  onSeal(local: boolean): void;
  onCoinbase(): void;
  onAbsorb(x: number, y: number): void;
  onUtxoCycle(spent: number, created: number): void;
  onSelect(cr: Creature): void;
}

export class Sim {
  time = 0;
  speed = 1;
  paused = false;
  nextId = 1;
  blockHeight = 892000;
  lastBlockAt = 0;
  nextBlockAt = expDelay();
  nextSpawnAt = 1.2;
  nextCloneAt = 16;
  phase: "running" | "boarding" | "sorting" | "sealing" | "arriving" | "landing" = "running";
  phaseUntil = 0;
  lastBlockLocal = false;
  dsproofs = 0;
  selectedId: number | null = null;
  creatures: Creature[] = [];
  all = new Map<number, Creature>();
  blocks: { height: number; count: number; local: boolean }[] = [];
  private staged: Creature[] = [];
  private pendingSeal: Creature[] = [];
  private candDirty = true;

  constructor(
    private T: TexKit,
    private refs: SceneRefs,
    private charsLayer: Container,
    private linksLayer: Container,
    private anims: Anims,
    private camera: Camera,
    private hooks: SimHooks,
  ) {}

  private register(cr: Creature) {
    cr.c.on("pointertap", (e) => {
      e.stopPropagation();
      this.hooks.onSelect(cr);
    });
    this.charsLayer.addChild(cr.c);
    this.creatures.push(cr);
    this.all.set(cr.id, cr);
  }

  spawnFromPod(opts: Partial<{ type: TxType; isUser: boolean }> = {}): Creature | null {
    if (this.creatures.length >= MAX_CREATURES) return null;
    const malformed = !opts.isUser && Math.random() < MALFORMED_RATE;
    const cr = new Creature(this.nextId++, GEOM.POD.x, GEOM.POD.y - 26, {
      type: opts.type, isUser: opts.isUser, malformed, origin: "pod",
    }, this.T);
    this.register(cr);
    this.hooks.onSynth();

    cr.c.alpha = 0;
    cr.body.scale.set(0.2);
    this.anims.add(0.45, (t) => {
      cr.c.alpha = t;
      cr.body.scale.set(0.2 + easeOutCubic(t) * 0.8);
    });

    cr.phase = "pipeline";
    cr.route = [
      { kind: "wait", t: 0.5 },
      { kind: "walk", x: GEOM.POD.x + 60, y: GEOM.F1PATH, speed: 60 },
      { kind: "walk", x: GEOM.TUBE1.x, y: GEOM.F1PATH, speed: 60 },
      { kind: "tube", toY: GEOM.F2PATH },
      { kind: "walk", x: GEOM.SCAN.x + 40, y: GEOM.F2PATH, speed: 65 },
      { kind: "walk", x: GEOM.SCAN.x, y: GEOM.F2PATH, speed: 40 },
      { kind: "wait", t: 0.8 },
      { kind: "call", fn: () => this.resolveScan(cr) },
      { kind: "walk", x: GEOM.TUBE2.x, y: GEOM.F2PATH, speed: 65 },
      { kind: "tube", toY: GEOM.TUBE2.y2 },
      { kind: "walk", x: rand(GEOM.VIV.minX + 30, GEOM.VIV.maxX - 200), y: rand(GEOM.VIV.minY + 20, GEOM.VIV.maxY - 10), speed: 55 },
    ];
    cr.onRouteDone = () => {
      cr.phase = "lounging";
      cr.waitUntil = this.time + rand(1, 4);
      this.candDirty = true;
      this.hooks.onBroadcast();
    };
    return cr;
  }

  spawnFromDuct(opts: Partial<{ type: TxType; utxo: string; tokenHue: number; imposterOf: number | null }> = {}): Creature | null {
    if (this.creatures.length >= MAX_CREATURES) return null;
    const cr = new Creature(this.nextId++, GEOM.VENT.x, GEOM.VENT.y, {
      type: opts.type, utxo: opts.utxo, tokenHue: opts.tokenHue,
      imposterOf: opts.imposterOf ?? null, origin: "duct",
    }, this.T);
    this.register(cr);
    cr.c.alpha = 0;
    this.anims.tween(cr.c, "alpha", 0, 1, 0.4);
    cr.phase = "pipeline";
    cr.route = [
      { kind: "walk", x: rand(GEOM.VIV.minX + 60, GEOM.VIV.maxX - 60), y: rand(GEOM.VIV.minY + 20, GEOM.VIV.maxY - 10), speed: 55 },
    ];
    cr.onRouteDone = () => {
      cr.phase = "lounging";
      cr.waitUntil = this.time + rand(1, 4);
      this.candDirty = true;
    };
    return cr;
  }

  private resolveScan(cr: Creature) {
    if (cr.malformed) {
      cr.phase = "zapped";
      cr.route = [];
      cr.onRouteDone = null;
      this.hooks.onScanZap(cr.x, cr.y - 20);
      this.hooks.addToast("info", `✗ Malformed tx ${cr.txid}… rejected at validation — never reaches the mempool`);
      this.anims.add(0.4, (t) => {
        cr.c.alpha = 1 - t;
        cr.body.scale.set(1 - t * 0.5);
      }, () => this.remove(cr));
    } else {
      this.hooks.onScanPass(cr.x, cr.y - 30);
    }
  }

  private remove(cr: Creature) {
    this.creatures = this.creatures.filter((c) => c.id !== cr.id);
    cr.phase = "gone";
    cr.c.destroy({ children: true });
    this.candDirty = true;
    if (this.selectedId === cr.id) this.hooks.renderInspector();
  }

  /* ── Double-spends: rejected on sight, DSProof broadcast. No game. ── */
  spawnClone() {
    const victims = this.creatures.filter(
      (c) => c.phase === "lounging" && c.imposterOf === null && !c.isUser,
    );
    if (!victims.length) return;
    const victim = pick(victims);
    const cr = this.spawnFromDuct({
      type: victim.type === "nft-mint" ? "nft" : victim.type,
      tokenHue: victim.tokenHue,
      utxo: victim.utxo,
      imposterOf: victim.id,
    });
    if (!cr) return;
    /* it barely gets a few steps in before the ledger check bounces it */
    cr.route = [
      { kind: "walk", x: GEOM.VENT.x - rand(60, 110), y: GEOM.VENT.y + rand(-15, 25), speed: 60 },
      { kind: "wait", t: rand(0.4, 0.8) },
      { kind: "call", fn: () => this.rejectClone(cr, victim.id) },
    ];
    this.hooks.addToast("dsproof", `⚠ Second spend of utxo ${cr.utxo}… arrived from a peer — checking the seen ledger…`);
  }

  private rejectClone(cr: Creature, victimId: number) {
    cr.phase = "rejected";
    cr.route = [];
    cr.onRouteDone = null;
    this.dsproofs += 1;
    this.hooks.updateReadouts();

    this.creatures = this.creatures.filter((c) => c.id !== cr.id);
    this.candDirty = true;
    this.hooks.onReject(cr.x, cr.y);
    this.hooks.onDSProof();
    this.hooks.onWhistle();

    const victim = this.all.get(victimId);
    if (victim && victim.phase === "lounging") victim.shieldUntil = this.time + 6;

    this.anims.add(0.45, (t) => {
      cr.c.alpha = 1 - t;
      cr.body.scale.set(1 + t * 0.9);
      cr.body.rotation = t * 0.35;
    }, () => {
      cr.c.destroy({ children: true });
      cr.phase = "gone";
    });

    this.hooks.addToast(
      "good",
      `✓ Rejected on arrival — first-seen wins. DSProof broadcast: peers & merchants warned in seconds.`,
    );
    if (this.selectedId === cr.id) this.hooks.renderInspector();
  }

  /* ── Block cycle: usually the network finds it; rarely, we do ── */
  private triggerBlock() {
    const eligible = this.creatures.filter((c) => c.phase === "lounging");
    if (Math.random() < LOCAL_MINE_P && eligible.length > 0) this.startLocalMine(eligible);
    else this.startExternalBlock(eligible);
  }

  private startLocalMine(eligible: Creature[]) {
    this.phase = "boarding";
    this.phaseUntil = this.time + 2.6;
    this.lastBlockLocal = true;

    eligible.sort((a, b) => (a.txid < b.txid ? -1 : 1));
    this.staged = eligible;
    eligible.forEach((cr, i) => {
      cr.phase = "boarding";
      const slotX = GEOM.SLOT0X + i * GEOM.SLOTW;
      cr.route = [
        { kind: "walk", x: GEOM.TUBE3.x, y: GEOM.VIV.maxY, speed: 95 },
        { kind: "tube", toY: GEOM.F4PATH },
        { kind: "walk", x: slotX, y: GEOM.F4PATH, speed: 110 },
      ];
      cr.onRouteDone = () => {
        cr.phase = "staged";
        cr.showLabel(this.T);
      };
    });
    this.candDirty = true;
    this.camera.focus(750, 640, 1.06);
    this.hooks.addToast("good", `⛏ Our centrifuge found a valid hash! Assembling the block ourselves…`);
    this.hooks.renderInspector();
  }

  private startSorting() {
    this.phase = "sorting";
    this.phaseUntil = this.time + 1.3;
    this.staged.forEach((cr, i) => {
      if (cr.phase !== "staged") {
        cr.route = [];
        cr.onRouteDone = null;
        cr.x = GEOM.SLOT0X + i * GEOM.SLOTW;
        cr.y = GEOM.F4PATH;
        cr.phase = "staged";
        cr.showLabel(this.T);
        cr.c.alpha = 1;
      }
    });
  }

  private startSealing() {
    this.phase = "sealing";
    this.phaseUntil = this.time + 1.2;
    const n = this.staged.length;
    this.staged.forEach((cr, i) => {
      const delay = (n - 1 - i) * 0.07;
      const fromX = cr.x;
      const total = 0.55 + delay;
      this.anims.add(total, (t) => {
        const local = Math.min(1, Math.max(0, (t * total - delay) / 0.55));
        const k = easeInOutCubic(local);
        cr.x = fromX + (GEOM.REACTORX - fromX) * k;
        cr.c.alpha = k > 0.75 ? Math.max(0, 1 - (k - 0.75) * 4) : 1;
      });
    });
  }

  private startExternalBlock(eligible: Creature[]) {
    this.phase = "arriving";
    this.phaseUntil = this.time + 1.6;
    this.lastBlockLocal = false;
    this.pendingSeal = eligible;

    eligible.forEach((cr, i) => {
      cr.phase = "boarding"; // no longer wanders; dissolving
      cr.route = [];
      cr.onRouteDone = null;
      const delay = i * 0.05;
      const total = 0.6 + delay;
      this.anims.add(total, (t) => {
        const local = Math.min(1, Math.max(0, (t * total - delay) / 0.6));
        cr.c.alpha = 1 - local;
        cr.body.scale.set(1 - local * 0.4);
      }, () => {
        this.hooks.onAbsorb(cr.x, cr.y);
      });
    });
    this.candDirty = true;
    this.camera.focus(950, 750, 1.04);
    this.hooks.addToast("info", `⛓ A block was found elsewhere on the network — verifying it against our mempool…`);
  }

  private landBlock() {
    this.phase = "landing";
    this.phaseUntil = this.time + 1.4;
    this.blockHeight += 1;
    this.lastBlockAt = this.time;

    const sealedList = this.lastBlockLocal ? this.staged : this.pendingSeal;
    const sealed = sealedList.length;

    this.blocks.unshift({ height: this.blockHeight, count: sealed, local: this.lastBlockLocal });
    if (this.blocks.length > 5) this.blocks.pop();
    this.renderBlocks(this.lastBlockLocal ? "drop" : "slide");

    sealedList.forEach((cr) => {
      cr.sealedHeight = this.blockHeight;
      if (cr.isUser)
        this.hooks.addToast("good", `✓ Your tx ${cr.txid}… sealed into block #${this.blockHeight.toLocaleString()}`);
      this.creatures = this.creatures.filter((c) => c.id !== cr.id);
      cr.phase = "sealed";
      cr.c.destroy({ children: true });
    });
    this.staged = [];
    this.pendingSeal = [];

    this.camera.shake(this.lastBlockLocal ? 7 : 4);
    this.camera.focus(950, 760, 1.05);
    this.hooks.onSeal(this.lastBlockLocal);
    if (this.lastBlockLocal) this.hooks.onCoinbase();

    /* UTXO matter-cycle: spent outputs leave the set, new ones enter */
    this.hooks.onUtxoCycle(Math.min(sealed, 3), Math.min(sealed + 1, 3));

    this.anims.tween(this.refs.gaugeNeedle, "rotation", this.refs.gaugeNeedle.rotation, rand(-0.5, 0.5), 0.8, easeInOutCubic);
    this.candDirty = true;
    this.hooks.updateReadouts();
    this.hooks.renderInspector();
  }

  private endLanding() {
    this.phase = "running";
    this.nextBlockAt = this.time + expDelay();
    this.camera.neutral();
  }

  renderBlocks(animate: "none" | "drop" | "slide") {
    this.refs.blockStack.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    this.blocks.forEach((b, i) => {
      const crystal = this.buildCrystal(b, i === 0);
      crystal.position.set(GEOM.ARCH.newestX - i * GEOM.ARCH.gap, GEOM.ARCH.y);
      this.refs.blockStack.addChild(crystal);
      if (i === 0 && animate === "drop") {
        this.anims.tween(crystal, "y", GEOM.ARCH.y - 90, GEOM.ARCH.y, 0.8, easeOutBounce);
      } else if (i === 0 && animate === "slide") {
        this.anims.tween(crystal, "x", GEOM.FREIGHT.x + 60, GEOM.ARCH.newestX, 0.9, easeOutCubic);
      }
    });
  }

  private buildCrystal(b: { height: number; count: number; local: boolean }, highlight: boolean): Container {
    const c = new Container();
    const g = new Graphics();
    g.ellipse(0, 40, 52, 6).fill({ color: 0x000000, alpha: 0.4 });
    g.poly([-46, 8, -30, -26, 30, -26, 46, 8, 24, 34, -24, 34]).fill({ color: 0x10283a, alpha: 0.92 });
    g.poly([-46, 8, -30, -26, 30, -26, 46, 8, 24, 34, -24, 34])
      .stroke({ width: highlight ? 2 : 1.2, color: highlight ? 0x7fc4ff : 0x9fc8e0, alpha: highlight ? 1 : 0.5 });
    g.moveTo(-30, -26).lineTo(-10, 34).stroke({ width: 0.8, color: 0x9fc8e0, alpha: 0.25 });
    g.moveTo(30, -26).lineTo(10, 34).stroke({ width: 0.8, color: 0x9fc8e0, alpha: 0.25 });
    g.moveTo(-46, 8).lineTo(46, 8).stroke({ width: 0.8, color: 0x9fc8e0, alpha: 0.18 });
    const n = Math.min(b.count, 9);
    for (let k = 0; k < n; k++) {
      const gx = -24 + (k % 3) * 24 + rand(-4, 4);
      const gy = -12 + Math.floor(k / 3) * 15 + rand(-3, 3);
      g.circle(gx, gy, 3.4).fill({ color: 0x8fd4ff, alpha: 0.75 });
      g.circle(gx - 1, gy - 1, 1).fill({ color: 0xffffff, alpha: 0.35 });
    }
    c.addChild(g);

    const h = mono(`#${b.height.toLocaleString()}`, 9, highlight ? 0x7fc4ff : C.fgMid, { anchor: 0.5 });
    h.position.set(0, -38);
    const src = b.local ? "OURS" : "peer";
    const cnt = mono(
      b.count === 0 ? `coinbase only · ${src}` : `${b.count} tx${b.count === 1 ? "" : "s"} · ${src}`,
      6, b.local ? C.warn : C.fgMute, { anchor: 0.5, weight: "400" },
    );
    cnt.position.set(0, 46);
    c.addChild(h, cnt);

    if (highlight) {
      const glow = new Sprite(this.T.glowWhite);
      glow.tint = 0x7fc4ff;
      glow.anchor.set(0.5);
      glow.position.set(0, 4);
      glow.width = 170;
      glow.height = 140;
      glow.alpha = 0.4;
      glow.blendMode = "add";
      c.addChildAt(glow, 0);
    }
    return c;
  }

  /* ── Candidate block display: the template we'd mine, CTOR-sorted ── */
  private updateCandidate() {
    const lounging = this.creatures
      .filter((c) => c.phase === "lounging" && c.imposterOf === null)
      .sort((a, b) => (a.txid < b.txid ? -1 : 1));
    this.refs.candSlots.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    const maxShow = 18;
    lounging.slice(0, maxShow).forEach((cr, i) => {
      const dot = new Graphics();
      const col = cr.type === "nft-mint" ? C.neon400 : cr.type === "fungible" ? hslToHex(cr.tokenHue, 70, 60) : C.bch500;
      dot.roundRect(i * 12, 0, 9, 10, 2).fill({ color: col, alpha: 0.85 });
      this.refs.candSlots.addChild(dot);
    });
    const bytes = lounging.reduce((s, c) => s + c.vsize, 0);
    this.refs.candCount.text = lounging.length === 0
      ? "empty — coinbase only"
      : `${lounging.length} tx · ${(bytes / 1000).toFixed(1)} kB`;
  }

  /* ── Hammer / foundry pod ── */
  swingHammer() {
    /* retained name: scientist pour animation is triggered via onSynth */
  }

  /* ── Frame update ── */
  update(dt: number) {
    this.time += dt;

    if (dt > 0) {
      if (this.phase === "running" && this.time >= this.nextBlockAt) {
        this.triggerBlock();
      } else if (this.phase !== "running" && this.time >= this.phaseUntil) {
        if (this.phase === "boarding") this.startSorting();
        else if (this.phase === "sorting") this.startSealing();
        else if (this.phase === "sealing") this.landBlock();
        else if (this.phase === "arriving") this.landBlock();
        else if (this.phase === "landing") this.endLanding();
      }

      if (this.phase === "running" && this.time >= this.nextSpawnAt) {
        if (Math.random() < DUCT_RATE) this.spawnFromDuct();
        else this.spawnFromPod();
        this.nextSpawnAt = this.time + rand(SPAWN_MIN, SPAWN_MAX);
      }

      if (this.phase === "running" && this.time >= this.nextCloneAt) {
        this.spawnClone();
        this.nextCloneAt = this.time + rand(CLONE_MIN, CLONE_MAX);
      }
    }

    this.creatures.forEach((cr) => cr.update(dt, this.time));

    if (this.candDirty) {
      this.candDirty = false;
      this.updateCandidate();
    }

    /* DSProof gossip links (brief — clones die fast now) */
    const lg = this.linksLayer.children[0] as Graphics;
    lg.clear();
    const dashOffset = (this.time * 26) % 12;
    for (const cr of this.creatures) {
      if (cr.imposterOf === null) continue;
      const victim = this.all.get(cr.imposterOf);
      if (!victim || victim.phase !== "lounging") continue;
      const dx = victim.x - cr.x;
      const dy = victim.y - cr.y;
      const len = Math.hypot(dx, dy);
      if (len < 4) continue;
      const ux = dx / len;
      const uy = dy / len;
      for (let d = dashOffset; d < len; d += 12) {
        const e = Math.min(d + 6, len);
        lg.moveTo(cr.x + ux * d, cr.y + uy * d).lineTo(cr.x + ux * e, cr.y + uy * e);
      }
    }
    lg.stroke({ width: 1.4, color: C.danger, alpha: 0.6 });
  }

  seed() {
    for (let i = 0; i < 6; i++) {
      const cr = this.spawnFromDuct();
      if (cr) {
        cr.x = rand(GEOM.VIV.minX + 30, GEOM.VIV.maxX - 30);
        cr.y = rand(GEOM.VIV.minY + 15, GEOM.VIV.maxY - 10);
        cr.route = [];
        cr.onRouteDone = null;
        cr.phase = "lounging";
        cr.c.alpha = 1;
        cr.waitUntil = this.time + rand(0, 4);
      }
    }
    for (let i = 1; i <= 3; i++) {
      this.blocks.push({ height: this.blockHeight - i + 1, count: randi(4, 14), local: i === 3 });
    }
    this.renderBlocks("none");
    this.candDirty = true;
  }
}
