import { Texture } from "pixi.js";
import { rgba } from "./palette";

function canvasOf(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d")! };
}

/** Soft radial glow — the workhorse for lights, halos, and bloom seeds. */
export function glowTex(size: number, color: number, innerAlpha = 1): Texture {
  const { c, ctx } = canvasOf(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, rgba(color, innerAlpha));
  g.addColorStop(0.4, rgba(color, innerAlpha * 0.35));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
}

/** Hard-cored particle dot with a soft rim. */
export function dotTex(size: number, color: number): Texture {
  const { c, ctx } = canvasOf(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, rgba(color, 1));
  g.addColorStop(0.55, rgba(color, 0.9));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
}

/** White dot for tint-at-use particles/pets. */
export function whiteDotTex(size: number): Texture {
  return dotTex(size, 0xffffff);
}

/** Sphere-shaded character body: light source up-left. */
export function blobTex(size: number, hi: number, mid: number, lo: number): Texture {
  const { c, ctx } = canvasOf(size, size);
  const g = ctx.createRadialGradient(
    size * 0.38, size * 0.3, size * 0.04,
    size * 0.5, size * 0.52, size * 0.52,
  );
  g.addColorStop(0, rgba(hi, 1));
  g.addColorStop(0.45, rgba(mid, 1));
  g.addColorStop(1, rgba(lo, 1));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(size / 2, size / 2, size * 0.48, size * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  return Texture.from(c);
}

/** Trapezoid light cone fading downward. */
export function coneTex(w: number, h: number, color: number, alpha: number): Texture {
  const { c, ctx } = canvasOf(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  const topW = w * 0.16;
  ctx.beginPath();
  ctx.moveTo(w / 2 - topW / 2, 0);
  ctx.lineTo(w / 2 + topW / 2, 0);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  return Texture.from(c);
}

/** Teardrop flame, yellow core to red rim. */
export function flameTex(w: number, h: number): Texture {
  const { c, ctx } = canvasOf(w, h);
  const g = ctx.createRadialGradient(w / 2, h * 0.72, 1, w / 2, h * 0.62, h * 0.62);
  g.addColorStop(0, "rgba(255,240,180,1)");
  g.addColorStop(0.35, "rgba(255,179,71,0.95)");
  g.addColorStop(0.75, "rgba(255,85,51,0.75)");
  g.addColorStop(1, "rgba(255,85,51,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.bezierCurveTo(w * 0.92, h * 0.45, w * 0.86, h * 0.8, w / 2, h);
  ctx.bezierCurveTo(w * 0.14, h * 0.8, w * 0.08, h * 0.45, w / 2, 0);
  ctx.closePath();
  ctx.fill();
  return Texture.from(c);
}

/** Thin blurred ring — whistle pulses, selection pops. */
export function ringTex(size: number, color: number): Texture {
  const { c, ctx } = canvasOf(size, size);
  ctx.strokeStyle = rgba(color, 1);
  ctx.lineWidth = size * 0.05;
  ctx.filter = `blur(${size * 0.02}px)`;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  return Texture.from(c);
}

/** Film grain. */
export function noiseTex(size: number): Texture {
  const { c, ctx } = canvasOf(size, size);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 14; // very faint
  }
  ctx.putImageData(img, 0, 0);
  return Texture.from(c);
}

/** Screen-space vignette. */
export function vignetteTex(w: number, h: number): Texture {
  const { c, ctx } = canvasOf(w, h);
  const g = ctx.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.6, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return Texture.from(c);
}

/** Vertical wall gradient with a green undertone. */
export function wallTex(w: number, h: number): Texture {
  const { c, ctx } = canvasOf(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#131a16");
  g.addColorStop(0.5, "#0d1210");
  g.addColorStop(1, "#0b0f0d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return Texture.from(c);
}

/** Small monitor-screen gradient. */
export function screenTex(w: number, h: number): Texture {
  const { c, ctx } = canvasOf(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#14523d");
  g.addColorStop(1, "#0a2f23");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return Texture.from(c);
}

export interface TexKit {
  glowGreen: Texture;
  glowGreenBig: Texture;
  glowWhite: Texture;
  glowWhiteBig: Texture;
  coneWhite: Texture;
  glowOrange: Texture;
  glowOrangeBig: Texture;
  glowPurple: Texture;
  glowLamp: Texture;
  glowRed: Texture;
  dotEmber: Texture;
  dotDust: Texture;
  dotWhite: Texture;
  blobGreen: Texture;
  blobRed: Texture;
  blobGrey: Texture;
  coneLamp: Texture;
  coneGreen: Texture;
  flame: Texture;
  ringGreen: Texture;
  ringRed: Texture;
  ringNeon: Texture;
  noise: Texture;
  vignette: Texture;
  wall: Texture;
  screen: Texture;
}

export function buildTextures(): TexKit {
  return {
    glowGreen: glowTex(128, 0x0ac18e),
    glowGreenBig: glowTex(256, 0x0ac18e),
    glowWhite: glowTex(128, 0xffffff),
    glowWhiteBig: glowTex(256, 0xffffff),
    coneWhite: coneTex(200, 380, 0xffffff, 0.22),
    glowOrange: glowTex(128, 0xffb347),
    glowOrangeBig: glowTex(256, 0xff8c3c),
    glowPurple: glowTex(128, 0xb26eff),
    glowLamp: glowTex(128, 0xffd678),
    glowRed: glowTex(128, 0xe85d6b),
    dotEmber: dotTex(24, 0xffb347),
    dotDust: dotTex(16, 0xd8e2dc),
    dotWhite: whiteDotTex(24),
    blobGreen: blobTex(64, 0x7ff0cf, 0x0ac18e, 0x067458),
    blobRed: blobTex(64, 0xffb3ba, 0xe85d6b, 0x8a2f38),
    blobGrey: blobTex(64, 0xc9d1cc, 0x99a39d, 0x646d67),
    coneLamp: coneTex(200, 380, 0xffd678, 0.22),
    coneGreen: coneTex(160, 300, 0x3fe5b5, 0.16),
    flame: flameTex(48, 72),
    ringGreen: ringTex(96, 0x3fe5b5),
    ringRed: ringTex(96, 0xe85d6b),
    ringNeon: ringTex(96, 0xb26eff),
    noise: noiseTex(256),
    vignette: vignetteTex(1400, 900),
    wall: wallTex(64, 900),
    screen: screenTex(44, 30),
  };
}
