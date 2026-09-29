/**
 * Scroll engine for the life-of-a-transaction story.
 *
 * The page is a list of step cards. Whichever card sits nearest the middle
 * of the viewport is "active". Each step maps to a camera window, a hero
 * position, a mood, and a set of cumulative flags. Flags become classes on
 * the stage SVG (`f-filled`, `f-signed`, …) and CSS does the animating, so
 * scrolling forward and backward both work for free.
 */

export interface Cam {
  x: number;
  y: number;
  z: number;
}

export interface StepState {
  cam: Cam;
  hx: number;
  /** hero baseline y (default 560, the floor) and scale (default 1) */
  hy?: number;
  hs?: number;
  mood: string;
  flags: string[];
  /** index into the script trace when this step is one opcode of the check */
  op?: number;
}

const CAM1: Cam = { x: 0, y: 0, z: 1 };
const CAM2: Cam = { x: 1200, y: 0, z: 1 };
const CAM3: Cam = { x: 2400, y: 0, z: 1 };
const CAM3_ZOOM: Cam = { x: 2650, y: 135, z: 1.6 };
const CAM4: Cam = { x: 3600, y: 0, z: 1 };
const CAM5: Cam = { x: 4800, y: 0, z: 1 };
const CAM6: Cam = { x: 6000, y: 0, z: 1 };

/** Ordered steps. Flags accumulate; a later step inherits every earlier flag. */
export const STEPS: [string, StepState][] = [
  ["born", { cam: CAM1, hx: 600, mood: "blank", flags: [] }],
  ["inputs", { cam: CAM1, hx: 600, mood: "calm", flags: ["filled"] }],
  ["outputs", { cam: CAM1, hx: 600, mood: "calm", flags: ["outputs"] }],
  ["sign", { cam: CAM1, hx: 600, mood: "proud", flags: ["signed"] }],
  ["sealed", { cam: CAM1, hx: 600, mood: "proud", flags: ["txid"] }],
  ["leave", { cam: CAM1, hx: 1110, mood: "excited", flags: ["door"] }],

  ["broadcast", { cam: CAM2, hx: 1300, mood: "excited", flags: ["net0"] }],
  ["gossip", { cam: CAM2, hx: 1620, mood: "excited", flags: ["net1", "net2"] }],
  ["everywhere", { cam: CAM2, hx: 1960, mood: "excited", flags: ["net3"] }],
  ["arrive", { cam: CAM2, hx: 2280, mood: "nervous", flags: ["nodedoor"] }],

  ["gauntlet", { cam: CAM3, hx: 2470, mood: "nervous", flags: ["corridor"] }],
  ["check-form", { cam: CAM3, hx: 2560, mood: "nervous", flags: ["st1"] }],
  ["check-utxo", { cam: CAM3, hx: 2672, mood: "nervous", flags: ["st2"] }],
  ["check-script", { cam: CAM3_ZOOM, hx: 2960, mood: "nervous", flags: ["st3"] }],
  // op-0 … op-N are generated at runtime from the trace length
  ["check-fee", { cam: CAM3, hx: 3120, mood: "calm", flags: ["st3ok", "st4"] }],
  ["check-seen", { cam: CAM3, hx: 3318, mood: "nervous", flags: ["st5", "clone"] }],
  ["admitted", { cam: CAM3, hx: 3540, mood: "joy", flags: ["bounced", "gate"] }],

  ["pool", { cam: CAM4, hx: 3780, hy: 522, mood: "calm", flags: ["pool"] }],
  ["rules", { cam: CAM4, hx: 3920, hy: 522, mood: "calm", flags: ["rules"] }],
  ["waiting", { cam: CAM4, hx: 4080, hy: 522, mood: "calm", flags: ["clock"] }],
  ["block-found", { cam: CAM4, hx: 4540, mood: "excited", flags: ["drain"] }],

  ["block-arrives", { cam: CAM5, hx: 4900, mood: "excited", flags: ["header"] }],
  ["ctor", { cam: CAM5, hx: 5340, mood: "nervous", flags: ["ctor"] }],
  ["coinbase", { cam: CAM5, hx: 5340, mood: "calm", flags: ["coinbase"] }],
  ["sealed-in", { cam: CAM5, hx: 5700, hy: 492, hs: 0.42, mood: "joy", flags: ["inblock"] }],

  ["archive", { cam: CAM6, hx: 6500, hy: 497, hs: 0.3, mood: "proud", flags: ["archive"] }],
  ["conf-1", { cam: CAM6, hx: 6500, hy: 497, hs: 0.3, mood: "proud", flags: ["conf1"] }],
  ["conf-6", { cam: CAM6, hx: 6500, hy: 497, hs: 0.3, mood: "calm", flags: ["conf6"] }],
  ["outputs-born", { cam: CAM6, hx: 6500, hy: 497, hs: 0.3, mood: "rest", flags: ["born"] }],
  ["end", { cam: CAM6, hx: 6500, hy: 497, hs: 0.3, mood: "rest", flags: [] }],
];

/** Override a step's hero x (used to put a live transaction in its sorted slot). */
export function setStepHx(id: string, hx: number) {
  for (const [sid, st] of STEPS) if (sid === id) st.hx = hx;
}

export function expandSteps(traceLength: number): [string, StepState][] {
  const out: [string, StepState][] = [];
  for (const [id, st] of STEPS) {
    out.push([id, st]);
    if (id === "check-script") {
      for (let i = 0; i < traceLength; i++) {
        out.push([`op-${i}`, { cam: CAM3_ZOOM, hx: 2960, mood: i === traceLength - 1 ? "calm" : "nervous", flags: [], op: i }]);
      }
    }
  }
  return out;
}

export interface Resolved {
  id: string;
  index: number;
  state: StepState;
  flags: Set<string>;
}

export function resolve(steps: [string, StepState][]): Resolved[] {
  const acc = new Set<string>();
  return steps.map(([id, state], index) => {
    for (const f of state.flags) acc.add(f);
    return { id, index, state, flags: new Set(acc) };
  });
}

/* ───────────────────────── engine ───────────────────────── */

export interface EngineOpts {
  stage: SVGSVGElement;
  onStep: (r: Resolved, prev: Resolved | null) => void;
}

export function startEngine(steps: [string, StepState][], opts: EngineOpts) {
  const resolved = resolve(steps);
  const byId = new Map(resolved.map((r) => [r.id, r]));
  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-step]"));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let current: Resolved | null = null;
  let walkTimer = 0;

  const apply = (r: Resolved) => {
    const prev = current;
    current = r;
    const { stage } = opts;
    const st = r.state;

    // camera: the world group scales then translates so (cam.x, cam.y) lands top-left
    stage.style.setProperty("--cam-x", `${st.cam.x}`);
    stage.style.setProperty("--cam-y", `${st.cam.y}`);
    stage.style.setProperty("--cam-z", `${st.cam.z}`);
    stage.style.setProperty("--hx", `${st.hx}`);
    stage.style.setProperty("--hy", `${st.hy ?? 560}`);
    stage.style.setProperty("--hs", `${st.hs ?? 1}`);
    stage.dataset.mood = st.mood;
    stage.dataset.step = r.id;

    // flags → classes
    for (const c of Array.from(stage.classList)) if (c.startsWith("f-")) stage.classList.remove(c);
    for (const f of r.flags) stage.classList.add(`f-${f}`);

    // walking animation while the hero is in transit
    if (prev && prev.state.hx !== st.hx && !reduced) {
      const dist = Math.abs(prev.state.hx - st.hx);
      const dur = Math.min(1600, 500 + dist * 1.2);
      stage.style.setProperty("--walk-dur", `${dur}ms`);
      stage.classList.add("walking");
      stage.classList.toggle("facing-left", st.hx < prev.state.hx);
      window.clearTimeout(walkTimer);
      walkTimer = window.setTimeout(() => stage.classList.remove("walking"), dur);
    }

    cards.forEach((c) => c.classList.toggle("is-active", c.dataset.step === r.id));
    opts.onStep(r, prev);
  };

  // Active card = the last card whose top has crossed 55% of the viewport.
  let ticking = false;
  const pick = () => {
    ticking = false;
    const line = window.innerHeight * 0.55;
    let active: HTMLElement | null = null;
    for (const c of cards) {
      if (c.getBoundingClientRect().top <= line) active = c;
      else break;
    }
    const id = active?.dataset.step ?? cards[0]?.dataset.step;
    if (!id) return;
    const r = byId.get(id);
    if (r && r !== current) apply(r);
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(pick);
    }
  };
  // Debug / stage-inspector mode: ?step=<id> pins the stage to one step and
  // ignores scrolling; add &solo=1 to hide everything but the stage.
  const params = new URLSearchParams(location.search);
  const pinned = params.get("step");
  if (pinned && byId.has(pinned)) {
    if (params.get("solo")) document.body.classList.add("solo");
    apply(byId.get(pinned)!);
    return { resolved, jump: (id: string) => { const r = byId.get(id); if (r) apply(r); }, destroy() {} };
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  // deep links: /#sealed lands on that step with the stage already in place
  const jumpTo = (id: string, smooth: boolean) =>
    document.querySelector<HTMLElement>(`[data-step="${id}"]`)?.scrollIntoView({ behavior: smooth && !reduced ? "smooth" : "auto", block: "center" });
  const hashId = () => decodeURIComponent(location.hash.slice(1));
  const onHash = () => { if (byId.has(hashId())) jumpTo(hashId(), true); };
  const onLoad = () => { if (hashId() && byId.has(hashId())) jumpTo(hashId(), false); pick(); };
  if (hashId() && byId.has(hashId())) jumpTo(hashId(), false);
  window.addEventListener("hashchange", onHash);
  window.addEventListener("load", onLoad);
  pick();

  return {
    resolved,
    jump(id: string) {
      history.replaceState(null, "", `${location.search}#${id}`);
      jumpTo(id, true);
    },
    /** Stop listening; used before the page re-renders for a different transaction. */
    destroy() {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("load", onLoad);
      current = null;
    },
  };
}
