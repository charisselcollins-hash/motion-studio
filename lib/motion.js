// Motion helpers for scenes. Everything here is a pure function of time,
// so every frame renders the same way in preview and in the final video.

export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, p) => a + (b - a) * p;

// ---------- Easing ----------
export const ease = {
  linear: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
  inCubic: (x) => x ** 3,
  outCubic: (x) => 1 - (1 - x) ** 3,
  inOutCubic: (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  inQuart: (x) => x ** 4,
  outQuart: (x) => 1 - (1 - x) ** 4,
  inOutQuart: (x) => (x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2),
  inExpo: (x) => (x === 0 ? 0 : 2 ** (10 * x - 10)),
  outExpo: (x) => (x === 1 ? 1 : 1 - 2 ** (-10 * x)),
  inOutExpo: (x) =>
    x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2,
  inBack: (x) => 2.70158 * x ** 3 - 1.70158 * x * x,
  outBack: (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2,
  inOutBack: (x) => {
    const c = 1.70158 * 1.525;
    return x < 0.5
      ? ((2 * x) ** 2 * ((c + 1) * 2 * x - c)) / 2
      : ((2 * x - 2) ** 2 * ((c + 1) * (x * 2 - 2) + c) + 2) / 2;
  },
  outElastic: (x) =>
    x === 0 ? 0 : x === 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  outBounce: (x) => {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  },
  // CSS-style cubic-bezier: ease.bezier(0.2, 0.8, 0.2, 1)
  bezier: (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      let t = x;
      for (let i = 0; i < 8; i++) {
        const d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= (sx(t) - x) / d;
      }
      return sy(clamp(t));
    };
  },
};

// ---------- Timing ----------

// 0→1 progress of an animation that starts at `start` seconds and lasts `duration`.
export function progress(t, start, duration, easing = ease.linear) {
  if (duration <= 0) return t >= start ? 1 : 0;
  return easing(clamp((t - start) / duration));
}

// Map t from an input range to an output range, with easing. Clamped by default.
// interpolate(t, [0, 1], [0, 500], ease.outCubic)
// Multi-point: interpolate(t, [0, 1, 2], [0, 100, 0])
export function interpolate(t, input, output, easing = ease.linear, { clamp: doClamp = true } = {}) {
  if (t <= input[0] && doClamp) return output[0];
  if (t >= input[input.length - 1] && doClamp) return output[output.length - 1];
  let i = 0;
  while (i < input.length - 2 && t > input[i + 1]) i++;
  const p = (t - input[i]) / (input[i + 1] - input[i]);
  return lerp(output[i], output[i + 1], easing(doClamp ? clamp(p) : p));
}

// Physical spring from 0 to 1, starting at `start` seconds. Overshoots when damping is low.
export function spring(t, start = 0, { stiffness = 170, damping = 18, mass = 1 } = {}) {
  const time = t - start;
  if (time <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * time) * (Math.cos(wd * time) + ((zeta * w0) / wd) * Math.sin(wd * time));
  }
  return 1 - Math.exp(-w0 * time) * (1 + w0 * time);
}

// Start time for item i in a staggered list.
export const stagger = (i, each, start = 0) => start + i * each;

// Animate in, hold, animate out. Returns 0→1→0.
export function inOut(t, start, end, fade = 0.4, easing = ease.outCubic) {
  return Math.min(progress(t, start, fade, easing), 1 - progress(t, end - fade, fade, ease.inCubic));
}

// ---------- Color ----------
function parseHex(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

export function mixColor(a, b, p) {
  const ca = parseHex(a), cb = parseHex(b);
  const [r, g, bl] = [0, 1, 2].map((i) => Math.round(lerp(ca[i], cb[i], p)));
  return `rgba(${r},${g},${bl},${lerp(ca[3], cb[3], p)})`;
}

export function withAlpha(hex, alpha) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------- Randomness ----------
// Seeded random so "random" layouts look the same on every frame and every render.
export function random(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1D noise in roughly [-1, 1].
export function noise(x, seed = 0) {
  const hash = (n) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u);
}

// ---------- Drawing ----------
export const FONT = '"Inter", "Helvetica Neue", Arial, sans-serif';

// Draw text. Options: size, weight, color, align, baseline, font, letterSpacing, alpha.
export function text(ctx, str, x, y, o = {}) {
  ctx.save();
  ctx.font = `${o.weight ?? 600} ${o.size ?? 64}px ${o.font ?? FONT}`;
  ctx.fillStyle = o.color ?? '#fff';
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.baseline ?? 'middle';
  if (o.letterSpacing != null) ctx.letterSpacing = `${o.letterSpacing}px`;
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.fillText(str, x, y);
  const width = ctx.measureText(str).width;
  ctx.restore();
  return width;
}

// Run `fn` with the canvas moved/rotated/scaled/faded, then restore.
export function group(ctx, { x = 0, y = 0, rotate = 0, scale = 1, alpha = 1 } = {}, fn) {
  ctx.save();
  ctx.translate(x, y);
  if (rotate) ctx.rotate(rotate);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;
  fn();
  ctx.restore();
}

export function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function rect(ctx, x, y, w, h, fill, radius = 0) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

// Load an image from assets/ (call inside a scene's async setup()).
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${src}`));
    img.src = src;
  });
}

// Load a font file from assets/ (call inside setup()). Then use its family name in text().
export async function loadFont(family, src, descriptors = {}) {
  const face = new FontFace(family, `url(${src})`, descriptors);
  await face.load();
  document.fonts.add(face);
}
