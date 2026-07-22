import { Application, Container, Rectangle, Sprite } from "pixi.js";
import { AdvancedBloomFilter } from "pixi-filters";
import { buildTextures } from "./textures";
import { Particles } from "./effects";
import { applyParallax, clamp, Hero, VIEW_H, VIEW_W, WALK_Y, type ActDef } from "./rideCore";
import { C } from "./palette";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
import { buildAct1, buildAct2, buildAct3, buildAct4, buildAct5, buildAct6 } from "./rideActs";

/**
 * THE RIDE — controller.
 * Six acts, played in sequence with tube-transit fades. The hero (your
 * transaction) persists across acts; each act owns its parallax stage set.
 */
export async function bootRide() {
  const host = document.querySelector<HTMLElement>("[data-ride-canvas]");
  if (!host) return;
  const captionEl = document.querySelector<HTMLElement>("[data-caption]")!;
  const actEl = document.querySelector<HTMLElement>("[data-act-label]")!;
  const fadeEl = document.querySelector<HTMLElement>("[data-fade]")!;

  try { await (document as any).fonts?.ready; } catch { /* ok */ }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const app = new Application();
  await app.init({
    width: VIEW_W, height: VIEW_H, antialias: true, background: 0x070a09,
    resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
  });
  host.appendChild(app.canvas);
  app.canvas.classList.add("ride-canvas");
  app.canvas.setAttribute("role", "img");
  app.canvas.setAttribute("aria-label", "The Ride — an animated journey of one Bitcoin Cash transaction through a full node");

  const T = buildTextures();

  const fxLayer = new Container();
  const particles = new Particles(fxLayer, reduced ? 100 : 400);

  const acts: ActDef[] = [
    buildAct1(app.stage, T, particles),
    buildAct2(app.stage, T, particles),
    buildAct3(app.stage, T, particles, fxLayer),
    buildAct4(app.stage, T, particles),
    buildAct5(app.stage, T, particles),
    buildAct6(app.stage, T, particles),
  ];

  // screen-space dressing above all acts
  const vig = new Sprite(T.vignette);
  app.stage.addChild(vig);
  const grain = new Sprite(T.noise);
  grain.width = VIEW_W;
  grain.height = VIEW_H;
  grain.alpha = 0.4;
  app.stage.addChild(grain);
  app.stage.filters = [new AdvancedBloomFilter({ threshold: 0.45, bloomScale: 0.75, brightness: 1, blur: 6, quality: 4 })];
  app.stage.filterArea = new Rectangle(0, 0, VIEW_W, VIEW_H);

  const hero = new Hero(T);

  /* ── Sequencing ── */
  let ai = 0;
  let tAct = 0;
  let mode: "play" | "out" | "in" = "in";
  let fade = 1;
  let capIdx = -1;
  let lastPoseKind: "none" | "squeeze" | "squash" = "none";

  const params = new URLSearchParams(location.search);
  ai = clamp((parseInt(params.get("act") ?? "1", 10) || 1) - 1, 0, acts.length - 1);
  tAct = clamp(parseFloat(params.get("t") ?? "0") || 0, 0, acts[ai].dur - 0.1);

  function enterAct(i: number) {
    acts.forEach((a, k) => a.L.all.forEach((l) => (l.visible = k === i)));
    acts[i].L.lights.addChild(fxLayer);
    acts[i].L.main.addChild(hero.c);
    capIdx = -1;
    captionEl.classList.remove("cap-show");
  }
  enterAct(ai);

  function restartAll() {
    acts.forEach((a) => a.reset());
    ai = 0;
    tAct = 0;
    enterAct(0);
  }

  document.querySelector("[data-replay]")?.addEventListener("click", () => {
    restartAll();
    mode = "in";
    fade = 0.8;
  });

  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.1);

    /* fade state machine */
    if (mode === "play") {
      tAct += dt;
      if (tAct >= acts[ai].dur) {
        mode = "out";
      }
    } else if (mode === "out") {
      fade = Math.min(1, fade + dt / 0.55);
      if (fade >= 1) {
        if (ai < acts.length - 1) {
          ai++;
          tAct = 0;
          acts[ai].reset();
          enterAct(ai);
        } else {
          restartAll();
        }
        mode = "in";
      }
    } else {
      fade = Math.max(0, fade - dt / 0.55);
      if (fade <= 0) mode = "play";
    }
    fadeEl.style.opacity = String(clamp(fade, 0, 1));

    /* current act */
    const act = acts[ai];
    const t = Math.min(tAct, act.dur);
    const hp = act.heroAt(t);
    hero.c.visible = hp.visible;
    hero.x = hp.x;
    hero.y = hp.y;
    hero.update(dt, hp.moving, t);

    /* tube-transit poses: squeeze in the pipe, squash on landing */
    if (hp.squeezeX !== undefined) hero.body.scale.set(hp.squeezeX, 1 + (1 - hp.squeezeX) * 0.9);
    else if (hp.squashY !== undefined) hero.body.scale.set(1 + (1 - hp.squashY) * 0.7, hp.squashY);
    else hero.body.scale.set(1, 1);
    const poseKind = hp.squashY !== undefined ? "squash" : hp.squeezeX !== undefined ? "squeeze" : "none";
    if (poseKind === "squash" && lastPoseKind === "squeeze") {
      for (let i = 0; i < 12; i++) {
        particles.spawn({
          tex: T.dotDust, x: hp.x + rand(-32, 32), y: WALK_Y + 46,
          vx: rand(-80, 80), vy: rand(-40, -8),
          life: rand(0.3, 0.6), r0: rand(0.3, 0.5), r1: 0.1, a0: 0.7, a1: 0, add: false,
        });
      }
    }
    if (poseKind === "squeeze" && Math.abs(hp.y - WALK_Y) > 40 && hp.visible) {
      for (let i = 0; i < 2; i++) {
        particles.spawn({
          tex: T.dotWhite, tint: C.bch400, x: hp.x + rand(-8, 8), y: hp.y + rand(-40, 40),
          vx: 0, vy: 0, life: 0.25, r0: 0.3, r1: 0.08, a0: 0.7, a1: 0,
        });
      }
    }
    lastPoseKind = poseKind;

    const camX = act.camX(t, hp.x);
    const zoom = (act.zoom?.(t) ?? 1) * (1 + (reduced ? 0 : Math.sin(t * 0.3) * 0.012));
    applyParallax(act.L, camX, zoom);

    act.update(t, dt);
    particles.update(dt);

    /* captions */
    const active = act.captions.findIndex(([a, b]) => t >= a && t < b);
    if (active !== capIdx) {
      capIdx = active;
      if (active === -1) {
        captionEl.classList.remove("cap-show");
      } else {
        captionEl.textContent = act.captions[active][2];
        captionEl.classList.add("cap-show");
      }
    }
    actEl.textContent = `ACT ${ai + 1} / ${acts.length} · ${act.title} · T+${t.toFixed(1)}s`;
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) app.ticker.stop();
    else app.ticker.start();
  });
}
