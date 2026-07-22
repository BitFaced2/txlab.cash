/** Numeric mirror of the site palette in global.css — Pixi wants ints. */
export const C = {
  canvas: 0x0b0f0d,
  surface: 0x141917,
  elevated: 0x1c2320,
  line: 0x232b27,
  lineMid: 0x2e3833,
  lineHi: 0x3a453f,
  fg: 0xe8ecea,
  fgMid: 0xb4bdb8,
  fgMute: 0x7b857f,
  fgDim: 0x4a544f,
  bch400: 0x3fe5b5,
  bch500: 0x0ac18e,
  bch600: 0x089674,
  bch700: 0x067458,
  neon300: 0xc79dff,
  neon400: 0xb26eff,
  neon500: 0x9d4edd,
  neon600: 0x7b33b8,
  warn: 0xe8b547,
  danger: 0xe85d6b,
  ember: 0xffb347,
  flame: 0xff5533,
  flameHot: 0xffd28a,
  lamp: 0xffd678,
};

export const MONO = '"JetBrains Mono", ui-monospace, monospace';

export const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
export const rgba = (n: number, a: number) =>
  `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;

export function hslToHex(h: number, s: number, l: number): number {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return (
    (Math.round(f(0) * 255) << 16) |
    (Math.round(f(8) * 255) << 8) |
    Math.round(f(4) * 255)
  );
}
