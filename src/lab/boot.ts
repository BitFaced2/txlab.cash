import { Application, Container, Graphics, Rectangle, Sprite } from "pixi.js";
import { AdvancedBloomFilter } from "pixi-filters";
import { C } from "./palette";
import { buildTextures } from "./textures";
import { buildScene, GEOM, mono, type Layers } from "./world";
import { Sim, TYPE_LABEL, type Creature, type TxType } from "./sim";
import { Anims, Camera, Particles } from "./effects";

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export async function bootLab() {
  const host = document.querySelector<HTMLElement>("[data-lab-canvas]");
  if (!host) return;

  try { await (document as any).fonts?.ready; } catch { /* font fallback is fine */ }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const app = new Application();
  await app.init({
    width: 1400,
    height: 900,
    antialias: true,
    background: C.canvas,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  host.appendChild(app.canvas);
  app.canvas.classList.add("diorama-canvas");
  app.canvas.setAttribute("role", "img");
  app.canvas.setAttribute(
    "aria-label",
    "Animated cutaway laboratory showing the life cycle of a Bitcoin Cash transaction inside a full node",
  );

  /* ── Layers ── */
  const world = new Container();
  const layers: Layers = {
    bg: new Container(),
    mid: new Container(),
    links: new Container(),
    chars: new Container(),
    lights: new Container(),
    particles: new Container(),
  };
  layers.links.addChild(new Graphics());
  world.addChild(layers.bg, layers.mid, layers.links, layers.chars, layers.lights, layers.particles);
  app.stage.addChild(world);

  const T = buildTextures();

  const vig = new Sprite(T.vignette);
  app.stage.addChild(vig);
  const grain = new Sprite(T.noise);
  grain.width = 1400;
  grain.height = 900;
  grain.alpha = 0.5;
  app.stage.addChild(grain);

  app.stage.filters = [
    new AdvancedBloomFilter({
      threshold: 0.45,
      bloomScale: 0.7,
      brightness: 1.0,
      blur: 5,
      quality: 4,
    }),
  ];
  app.stage.filterArea = new Rectangle(0, 0, 1400, 900);

  const refs = buildScene(layers, T);
  const anims = new Anims();
  const camera = new Camera(world, reduced);
  const particles = new Particles(layers.particles, reduced ? 150 : 600);

  /* ── DOM overlay handles ── */
  const $ = <E extends HTMLElement>(sel: string) => document.querySelector<E>(sel)!;
  const readoutHeight = $("[data-readout-height]");
  const readoutMempool = $("[data-readout-mempool]");
  const readoutSealed = $("[data-readout-sealed]");
  const readoutDsproof = $("[data-readout-dsproof]");
  const inspector = $("[data-inspector]");
  const toasts = $("[data-toasts]");
  const sendBtn = $<HTMLButtonElement>("[data-send-btn]");
  const sendMenu = $("[data-send-menu]");
  const pauseBtn = $<HTMLButtonElement>("[data-pause-btn]");
  const pauseIcon = document.querySelector<SVGElement>("[data-pause-icon]")!;
  const playIcon = document.querySelector<SVGElement>("[data-play-icon]")!;
  const pauseLabel = $("[data-pause-label]");
  const speedInput = $<HTMLInputElement>("[data-speed]");
  const speedValue = $("[data-speed-value]");

  function addToast(kind: "dsproof" | "good" | "info", text: string) {
    const t = document.createElement("div");
    t.className = `toast toast-${kind}`;
    t.textContent = text;
    toasts.appendChild(t);
    while (toasts.children.length > 4) toasts.firstElementChild?.remove();
    setTimeout(() => {
      t.classList.add("toast-out");
      setTimeout(() => t.remove(), 400);
    }, 5000);
  }

  function updateReadouts() {
    readoutHeight.textContent = sim.blockHeight.toLocaleString();
    readoutDsproof.textContent = String(sim.dsproofs);
    if (sim.blocks.length && sim.blocks[0].height === sim.blockHeight) {
      const b = sim.blocks[0];
      readoutSealed.textContent = `#${b.height.toLocaleString()} · ${b.count} tx${b.count === 1 ? "" : "s"} · ${b.local ? "ours" : "peer"}`;
    }
  }

  function selectCreature(cr: Creature) {
    const prev = sim.selectedId === null ? undefined : sim.all.get(sim.selectedId);
    if (prev) prev.selRing.visible = false;
    sim.selectedId = cr.id;
    cr.selRing.visible = true;
    renderInspector();
  }

  function deselect() {
    if (sim.selectedId === null) return;
    const prev = sim.all.get(sim.selectedId);
    if (prev) prev.selRing.visible = false;
    sim.selectedId = null;
    renderInspector();
  }

  function statusOf(cr: Creature): string {
    if (cr.phase === "rejected")
      return `<span class="ins-bad">rejected on arrival — double-spend (first-seen)</span>`;
    if (cr.phase === "zapped") return `<span class="ins-bad">rejected at validation</span>`;
    if (cr.sealedHeight !== null)
      return `<span class="ins-good">sealed in block #${cr.sealedHeight.toLocaleString()}</span>`;
    if (cr.phase === "boarding" || cr.phase === "staged") return "being sealed into a block";
    if (cr.phase === "lounging") return "in the mempool vivarium";
    return cr.origin === "pod" ? "in synthesis / validation" : "arriving via P2P duct";
  }

  function renderInspector() {
    const cr = sim.selectedId === null ? undefined : sim.all.get(sim.selectedId);
    if (!cr || cr.phase === "gone") {
      inspector.hidden = true;
      return;
    }

    let note: string;
    if (cr.imposterOf !== null) {
      note = `Second spend of utxo <b>${cr.utxo}…</b> — another tx spent it first. The node rejects it instantly (first-seen, no RBF) and broadcasts a DSProof so wallets and merchants hear about the attempt within seconds.`;
    } else if (cr.type === "nft-mint") {
      note = `The crown = minting authority. This creature can spawn new tokens of its category.`;
    } else if (cr.origin === "duct") {
      note = `Relayed from a peer node — most of the network's transactions arrive through the P2P duct, not our own synthesis pod.`;
    } else {
      note = `Every valid tx boards the next block — 32 MB of room means no fee auction. Flat ~1 sat/byte.`;
    }

    const tokenRow =
      cr.tokenCount > 0
        ? `<div><span>tokens</span><span>${
            cr.type === "fungible"
              ? `${cr.tokenCount} ducklings · cat ${cr.categoryId}…`
              : `NFT · cat ${cr.categoryId}…`
          }</span></div>`
        : "";

    inspector.innerHTML = `
      <div class="ins-head">
        <span>// TX INSPECTOR</span>
        <button type="button" data-inspector-close aria-label="Close inspector">×</button>
      </div>
      <div class="ins-rows">
        <div><span>txid</span><span>${cr.txid}…${cr.isUser ? " (yours)" : ""}</span></div>
        <div><span>type</span><span>${TYPE_LABEL[cr.type]}</span></div>
        <div><span>spends</span><span>utxo ${cr.utxo}…</span></div>
        <div><span>size</span><span>${cr.vsize} B</span></div>
        <div><span>fee</span><span>${cr.vsize} sats · 1 sat/B</span></div>
        ${tokenRow}
        <div><span>status</span><span>${statusOf(cr)}</span></div>
      </div>
      <p class="ins-note">${note}</p>
    `;
    inspector.hidden = false;
  }

  /* ── UTXO vial rack (the chainstate, rendered) ── */
  const VIAL_COLS = [C.bch400, C.neon400, C.warn, C.bch500, C.neon300, C.bch400];
  const vialColors: number[] = [...VIAL_COLS];
  function renderVials() {
    refs.vialSlots.removeChildren().forEach((ch) => ch.destroy());
    vialColors.forEach((vc, i) => {
      const row = Math.floor(i / 3);
      const vg = new Graphics();
      const vx = -26 + (i % 3) * 26;
      const vy = 4 + row * 18;
      vg.roundRect(vx - 3.5, vy, 7, 12, 2.5).fill({ color: vc, alpha: 0.8 });
      vg.roundRect(vx - 2, vy - 3, 4, 3, 1).fill(C.lineHi);
      refs.vialSlots.addChild(vg);
    });
  }
  renderVials();

  /* ── Hooks ── */
  let whistleUntil = 0;

  const sim = new Sim(T, refs, layers.chars, layers.links, anims, camera, {
    addToast,
    renderInspector,
    updateReadouts,
    onSelect: selectCreature,
    onSynth() {
      anims.add(0.7, (t) => {
        refs.pourArm.rotation = Math.sin(t * Math.PI) * -0.7;
      });
      for (let i = 0; i < (reduced ? 4 : 12); i++) {
        particles.spawn({
          tex: T.dotWhite, tint: C.bch400,
          x: GEOM.POD.x + rand(-18, 18), y: GEOM.POD.y - 30 + rand(-14, 6),
          vx: rand(-12, 12), vy: rand(-55, -25),
          life: rand(0.5, 1.1),
          r0: rand(0.12, 0.3), r1: 0.05, a0: 0.9, a1: 0,
          wobble: 3, wFreq: 4,
        });
      }
      refs.podGlow.alpha = 0.75;
      // one reagent vial pulses — an input being committed
      const idx = Math.floor(rand(0, 6));
      const vial = refs.vialSlots.children[idx];
      if (vial) {
        anims.add(0.6, (t) => {
          vial.alpha = 1 - Math.sin(t * Math.PI) * 0.6;
        });
      }
    },
    onScanPass(x, y) {
      for (let i = 0; i < 6; i++) {
        particles.spawn({
          tex: T.dotWhite, tint: C.bch400, x: x + rand(-10, 10), y,
          vx: rand(-15, 15), vy: rand(-40, -15),
          life: 0.5, r0: 0.2, r1: 0.05, a0: 1, a1: 0,
        });
      }
    },
    onScanZap(x, y) {
      for (let i = 0; i < (reduced ? 6 : 16); i++) {
        const a = rand(0, Math.PI * 2);
        const sp = rand(40, 160);
        particles.spawn({
          tex: T.dotWhite, tint: C.danger, x, y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          ay: 200, life: rand(0.35, 0.7),
          r0: rand(0.2, 0.4), r1: 0.05, a0: 1, a1: 0,
        });
      }
      camera.shake(2);
    },
    onBroadcast() {
      for (let i = 0; i < 3; i++) {
        particles.spawn({
          tex: T.ringGreen, x: GEOM.ANTENNA.x, y: GEOM.ANTENNA.y,
          life: 0.9 + i * 0.25, r0: 0.1 + i * 0.1, r1: 1.4 + i * 0.5,
          a0: 0.7, a1: 0,
        });
      }
      refs.skylineWindows.forEach((w) => (w.alpha = 0.9));
    },
    onWhistle() {
      whistleUntil = sim.time + 0.65;
    },
    onReject(x, y) {
      for (let i = 0; i < 14; i++) {
        const a = rand(0, Math.PI * 2);
        const sp = rand(40, 150);
        particles.spawn({
          tex: T.dotWhite, tint: C.danger, x, y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
          ay: 160, life: rand(0.4, 0.8),
          r0: rand(0.2, 0.4), r1: 0.05, a0: 1, a1: 0,
        });
      }
      // big red ✗ stamp
      particles.spawn({
        tex: T.ringRed, x, y, life: 0.6,
        r0: 0.3, r1: 1.2, a0: 0.9, a1: 0,
      });
    },
    onDSProof() {
      // red warning rings from the antenna — merchants hear about it in seconds
      for (let i = 0; i < 3; i++) {
        particles.spawn({
          tex: T.ringRed, x: GEOM.ANTENNA.x, y: GEOM.ANTENNA.y,
          life: 0.8 + i * 0.22, r0: 0.1 + i * 0.1, r1: 1.5 + i * 0.5,
          a0: 0.8, a1: 0,
        });
      }
      refs.antennaLight.alpha = 1;
      refs.skylineWindows.forEach((w) => (w.alpha = 0.9));
    },
    onSeal(local) {
      if (local) {
        const rx = GEOM.REACTORX + 60;
        for (let i = 0; i < (reduced ? 8 : 26); i++) {
          const a = rand(0, Math.PI * 2);
          const sp = rand(50, 200);
          particles.spawn({
            tex: T.dotWhite, tint: i % 3 === 0 ? C.bch400 : C.bch500,
            x: rx + rand(-30, 30), y: GEOM.F4PATH - 28,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            ay: 220, life: rand(0.5, 1.0),
            r0: rand(0.15, 0.35), r1: 0.04, a0: 1, a1: 0,
          });
        }
        refs.reactorGlow.alpha = 0.8;
        flash.alpha = 0.22;
      } else {
        // freight hatch flash — the block came from outside
        for (let i = 0; i < (reduced ? 4 : 12); i++) {
          particles.spawn({
            tex: T.dotWhite, tint: C.bch400,
            x: GEOM.FREIGHT.x + rand(-10, 10), y: GEOM.FREIGHT.y + rand(-20, 20),
            vx: rand(-90, -30), vy: rand(-30, 30),
            life: rand(0.4, 0.8),
            r0: rand(0.15, 0.3), r1: 0.04, a0: 1, a1: 0,
          });
        }
        particles.spawn({
          tex: T.ringGreen, x: GEOM.FREIGHT.x, y: GEOM.FREIGHT.y,
          life: 0.7, r0: 0.2, r1: 1.3, a0: 0.8, a1: 0,
        });
        flash.alpha = 0.12;
      }
    },
    onCoinbase() {
      const cap = new Container();
      const capG = new Graphics();
      capG.roundRect(-8, -5, 16, 10, 5).fill(C.warn);
      capG.roundRect(-8, -5, 16, 5, 5).fill(0xf3cd7c);
      cap.addChild(capG);
      const t = mono("+3.125 BCH — ours!", 8, C.warn, { anchor: 0.5 });
      t.position.set(0, -18);
      cap.addChild(t);
      cap.position.set(GEOM.DISPENSER.x, GEOM.DISPENSER.y + 12);
      layers.mid.addChild(cap);
      anims.add(1.6, (k) => {
        cap.y = GEOM.DISPENSER.y + 12 - k * 46;
        cap.alpha = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
      }, () => cap.destroy({ children: true }));
    },
    onAbsorb(x, y) {
      for (let i = 0; i < 5; i++) {
        particles.spawn({
          tex: T.dotWhite, tint: C.bch400, x: x + rand(-6, 6), y: y + rand(-6, 6),
          vx: rand(-15, 15), vy: rand(-30, -8),
          life: rand(0.4, 0.8),
          r0: rand(0.15, 0.3), r1: 0.04, a0: 0.9, a1: 0,
        });
      }
    },
    onUtxoCycle(spent, created) {
      // spent outputs leave the set; the block's new outputs slide in
      const indices = new Set<number>();
      while (indices.size < Math.min(spent, 3)) indices.add(Math.floor(rand(0, 6)));
      indices.forEach((i) => {
        vialColors[i] = pickVial();
      });
      renderVials();
      indices.forEach((i) => {
        const vial = refs.vialSlots.children[i];
        if (vial) {
          vial.alpha = 0;
          anims.tween(vial, "alpha", 0, 1, 0.9);
        }
      });
      particles.spawn({
        tex: T.ringGreen, x: 180, y: 214, life: 0.8,
        r0: 0.3, r1: 1.1, a0: 0.6, a1: 0,
      });
      void created;
    },
  });

  const VIAL_CHOICES = [C.bch400, C.bch500, C.neon400, C.neon300, C.warn];
  function pickVial() {
    return VIAL_CHOICES[Math.floor(rand(0, VIAL_CHOICES.length))];
  }

  const flash = new Sprite(T.glowGreenBig);
  flash.width = 1400 * 1.6;
  flash.height = 900 * 1.6;
  flash.anchor.set(0.5);
  flash.position.set(700, 450);
  flash.blendMode = "add";
  flash.alpha = 0;
  app.stage.addChild(flash);

  /* ── Scene interactions ── */
  refs.scientistZone.on("pointertap", (e) => {
    e.stopPropagation();
    if (sim.phase !== "running" || sim.paused) return;
    const cr = sim.spawnFromPod();
    if (cr) addToast("info", `Scientist: "Fresh synthesis! Say hello to ${cr.txid}…"`);
  });
  refs.guardZone.on("pointertap", (e) => {
    e.stopPropagation();
    addToast("info", `Security: "Double-spends? The seen ledger bounces those before they get past the duct. I'm mostly here for the vibes."`);
  });
  refs.reactorZone.on("pointertap", (e) => {
    e.stopPropagation();
    addToast("info", `Reactor: every hash is a fresh lottery ticket — most blocks are found by someone else, and that's fine. We verify.`);
  });

  const bgCatcher = new Graphics().rect(0, 0, 1400, 900).fill({ color: 0x000000, alpha: 0.001 });
  bgCatcher.eventMode = "static";
  bgCatcher.on("pointertap", () => deselect());
  layers.bg.addChildAt(bgCatcher, 0);

  inspector.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-inspector-close]")) deselect();
  });

  /* ── Controls ── */
  sendBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = sendMenu.hidden;
    sendMenu.hidden = !opening;
    sendBtn.setAttribute("aria-expanded", String(opening));
  });
  sendMenu.querySelectorAll<HTMLButtonElement>("[data-send-type]").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      sendMenu.hidden = true;
      sendBtn.setAttribute("aria-expanded", "false");
      const cr = sim.spawnFromPod({ isUser: true, type: b.dataset.sendType as TxType });
      if (cr) selectCreature(cr);
    });
  });
  document.addEventListener("click", () => {
    if (!sendMenu.hidden) {
      sendMenu.hidden = true;
      sendBtn.setAttribute("aria-expanded", "false");
    }
  });

  pauseBtn.addEventListener("click", () => {
    sim.paused = !sim.paused;
    pauseBtn.setAttribute("aria-pressed", String(sim.paused));
    pauseIcon.style.display = sim.paused ? "none" : "inline-block";
    playIcon.style.display = sim.paused ? "inline-block" : "none";
    pauseLabel.textContent = sim.paused ? "Play" : "Pause";
  });

  speedInput.addEventListener("input", () => {
    sim.speed = parseFloat(speedInput.value);
    speedValue.textContent = `${sim.speed}×`;
  });

  /* ── Ambient systems ── */
  let dustAcc = 0;
  let podAcc = 0;
  let emberAcc = 0;
  let rotorBoost = 0;

  function ambient(dt: number, time: number) {
    const spin = sim.phase === "sealing" ? 14 : 2.2 + rotorBoost;
    refs.rotor.rotation += dt * spin;
    rotorBoost = Math.max(0, rotorBoost - dt * 4);
    refs.reactorGlow.alpha = Math.max(0.28, refs.reactorGlow.alpha - dt * 0.5);
    refs.podGlow.alpha = Math.max(0.4, refs.podGlow.alpha - dt * 0.5);

    refs.beam.x = GEOM.SCAN.x + Math.sin(time * 2.2) * 20;
    refs.beam.alpha = 0.5 + Math.sin(time * 9) * 0.25;

    refs.antennaLight.alpha = Math.max(0.45 + Math.sin(time * 3.2) * 0.4, refs.antennaLight.alpha - dt * 0.8);
    refs.skylineWindows.forEach((w) => (w.alpha = Math.max(0.25, w.alpha - dt * 0.5)));

    refs.lampBulbs.forEach((b, i) => (b.alpha = 0.9 + Math.sin(time * 2 + i) * 0.08));
    refs.lampCones.forEach((cn, i) => (cn.alpha = 0.78 + Math.sin(time * 1.6 + i * 2) * 0.08));
    refs.pipeLeds.forEach((l, i) => (l.alpha = 0.55 + Math.sin(time * 2.6 + i * 1.4) * 0.3));
    refs.neonSigns.forEach(({ obj, phase }) => {
      const cyc = (time + phase) % 9;
      obj.alpha = cyc > 8.2 && cyc < 8.45 ? 0.55 : 1;
    });

    refs.breathers.forEach(({ obj, phase }) => {
      const s = Math.sin((time + phase) * 2);
      obj.scale.set(1 + s * 0.02, 1 - s * 0.02);
    });
    refs.blinkers.forEach(({ obj, phase }) => {
      const cyc = (time + phase) % 5.2;
      obj.scale.y = cyc > 4.95 && cyc < 5.1 ? 0.12 : 1;
    });
    refs.plantLeaves.forEach((p, i) => (p.rotation = Math.sin(time * 1.1 + i * 2.7) * 0.035));
    const jx = 620 + Math.sin(time * 0.14) * 260;
    refs.janitor.scale.x = Math.cos(time * 0.14) >= 0 ? 1 : -1;
    refs.janitor.x = jx;

    if (sim.time < whistleUntil) refs.guardBody.scale.set(1.12);
    else if (refs.guardBody.scale.x > 1.1) refs.guardBody.scale.set(1);

    const belt = refs.beltG;
    belt.clear();
    if (sim.phase === "sorting" || sim.phase === "sealing") {
      const off = (time * 60) % 24;
      for (let x = 230 + off; x < 1030; x += 24) {
        belt.moveTo(x, GEOM.F4PATH + 11).lineTo(x + 10, GEOM.F4PATH + 11);
      }
      belt.stroke({ width: 2, color: C.bch500, alpha: 0.5 });
    }

    if (reduced || dt <= 0) return;

    podAcc += dt * 2.4;
    while (podAcc > 1) {
      podAcc -= 1;
      particles.spawn({
        tex: T.dotWhite, tint: C.bch400,
        x: GEOM.POD.x + rand(-14, 14), y: GEOM.POD.y - 22,
        vx: rand(-4, 4), vy: rand(-20, -10),
        life: rand(0.6, 1.2),
        r0: rand(0.08, 0.18), r1: 0.04, a0: 0.6, a1: 0,
        wobble: 2, wFreq: 3,
      });
    }

    emberAcc += dt * 3;
    while (emberAcc > 1) {
      emberAcc -= 1;
      particles.spawn({
        tex: T.dotEmber,
        x: GEOM.REACTORX + 60 + rand(-30, 30), y: GEOM.F4PATH - 70,
        vx: rand(-8, 8), vy: rand(-30, -12),
        life: rand(0.7, 1.4),
        r0: rand(0.1, 0.25), r1: 0.04, a0: 0.8, a1: 0,
        wobble: 2, wFreq: 3,
      });
    }

    dustAcc += dt * 2.2;
    while (dustAcc > 1) {
      dustAcc -= 1;
      const lx = Math.random() < 0.5 ? 480 : 880;
      particles.spawn({
        tex: T.dotDust,
        x: lx + rand(-55, 55), y: rand(490, 600),
        vx: rand(-4, 4), vy: rand(3, 9),
        life: rand(2.5, 5),
        r0: rand(0.06, 0.16), r1: rand(0.06, 0.16),
        a0: 0.5, a1: 0,
        wobble: rand(3, 8), wFreq: rand(0.4, 1.2),
      });
    }
  }

  /* ── Main loop ── */
  updateReadouts();
  readoutSealed.textContent = "—";
  sim.seed();

  app.ticker.add((ticker) => {
    const rawDt = Math.min(ticker.deltaMS / 1000, 0.1);
    const dt = sim.paused ? 0 : rawDt * sim.speed;

    sim.update(dt);
    anims.update(dt);
    particles.update(dt);
    ambient(dt, sim.time);
    camera.update(rawDt, sim.time);

    /* time-since-last-block clock: one hand revolution per 60s */
    const elapsed = sim.time - sim.lastBlockAt;
    refs.clockHand.rotation = ((elapsed % 60) / 60) * Math.PI * 2;
    refs.clockText.text = `T+${Math.floor(elapsed)}s · avg ~${40}s`;

    if (flash.alpha > 0) flash.alpha = Math.max(0, flash.alpha - rawDt * 0.5);

    readoutMempool.textContent = `${sim.creatures.filter((c) => c.phase === "lounging").length} txs`;
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) app.ticker.stop();
    else app.ticker.start();
  });
}
