// Demo scene: shows springs, staggered text, easing, shapes and seeded randomness.
import {
  ease, progress, interpolate, spring, stagger, inOut,
  text, group, circle, rect, withAlpha, random, noise, FONT,
} from '../lib/motion.js';

const ACCENT = '#7c5cff';
const ACCENT_2 = '#22d3ee';
const WARM = '#ff6b9a';

// Seeded layout: same particles on every frame.
const rnd = random(7);
const particles = Array.from({ length: 70 }, () => ({
  x: rnd(), y: rnd(), r: 2 + rnd() * 5, speed: 0.2 + rnd() * 0.6, seed: rnd() * 100,
  color: [ACCENT, ACCENT_2, WARM][Math.floor(rnd() * 3)],
}));

export default {
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 6,
  background: '#0b0b12',

  render(ctx, t, { width: W, height: H, duration }) {
    const cx = W / 2, cy = H / 2;
    const outro = 1 - progress(t, duration - 0.6, 0.6, ease.inCubic);

    // Soft background glow that drifts.
    const gx = cx + noise(t * 0.3, 1) * 300;
    const gy = cy + noise(t * 0.3, 2) * 150;
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, 900);
    glow.addColorStop(0, withAlpha(ACCENT, 0.28 * outro));
    glow.addColorStop(1, withAlpha(ACCENT, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Floating particles.
    const pIn = progress(t, 0, 1.2, ease.outCubic) * outro;
    for (const p of particles) {
      const x = p.x * W + noise(t * p.speed, p.seed) * 60;
      const y = ((p.y * H - t * 40 * p.speed) % H + H) % H;
      circle(ctx, x, y, p.r, withAlpha(p.color, 0.5 * pIn));
    }

    // Expanding rings.
    for (let i = 0; i < 3; i++) {
      const p = progress(t, stagger(i, 0.15, 0.1), 1.6, ease.outExpo);
      ctx.beginPath();
      ctx.arc(cx, cy, 120 + p * (260 + i * 110), 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(i === 1 ? ACCENT_2 : ACCENT, (1 - p) * 0.8);
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Logo mark: a spinning rounded square that springs in.
    const logo = spring(t, 0.3, { stiffness: 140, damping: 11 });
    group(ctx, {
      x: cx, y: cy - 150,
      scale: logo * outro,
      rotate: interpolate(t, [0.3, 1.6], [-Math.PI / 2, Math.PI / 4], ease.outCubic),
    }, () => {
      const g = ctx.createLinearGradient(-70, -70, 70, 70);
      g.addColorStop(0, ACCENT);
      g.addColorStop(1, ACCENT_2);
      rect(ctx, -70, -70, 140, 140, g, 32);
      rect(ctx, -26, -26, 52, 52, '#0b0b12', 14);
    });

    // Title: each word springs up in turn.
    const words = ['Motion', 'as', 'Code'];
    ctx.font = `800 150px ${FONT}`;
    const gap = 40;
    const widths = words.map((w) => ctx.measureText(w).width);
    let x = cx - (widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1)) / 2;
    words.forEach((w, i) => {
      const s = spring(t, stagger(i, 0.12, 0.9), { stiffness: 180, damping: 16 });
      const a = progress(t, stagger(i, 0.12, 0.9), 0.3) * outro;
      text(ctx, w, x + widths[i] / 2, cy + 70 + (1 - s) * 90, {
        size: 150, weight: 800, alpha: a, color: i === 2 ? ACCENT_2 : '#ffffff',
      });
      x += widths[i] + gap;
    });

    // Underline sweep.
    const sweep = progress(t, 1.6, 0.9, ease.inOutExpo);
    const lw = 720;
    const lg = ctx.createLinearGradient(cx - lw / 2, 0, cx + lw / 2, 0);
    lg.addColorStop(0, ACCENT);
    lg.addColorStop(1, WARM);
    ctx.globalAlpha = outro;
    rect(ctx, cx - lw / 2, cy + 175, lw * sweep, 8, lg, 4);
    ctx.globalAlpha = 1;

    // Subtitle with letter spacing that tightens as it fades in.
    const sub = inOut(t, 2.2, duration, 0.7);
    text(ctx, 'RENDERED WITH PLAYWRIGHT + FFMPEG', cx, cy + 250, {
      size: 30, weight: 500, color: '#a5a5b8', alpha: sub,
      letterSpacing: interpolate(t, [2.2, 3.2], [24, 8], ease.outCubic),
    });

    // Frame counter in the corner.
    text(ctx, `${t.toFixed(2)}s`, W - 60, H - 50, {
      size: 24, weight: 500, align: 'right', color: '#55556a', alpha: pIn,
    });
  },
};
