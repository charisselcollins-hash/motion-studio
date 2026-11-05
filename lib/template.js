import { ease, progress, spring, inOut, text } from '../lib/motion.js';

export default {
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 4, // seconds
  background: '#0e0e12',
  // audio: 'assets/music.mp3',

  // Optional: load images/fonts once before rendering.
  // async setup() { return { logo: await loadImage('/assets/logo.png') }; },

  // Draw one frame. `t` is the time in seconds.
  render(ctx, t, { width, height }) {
    const s = spring(t, 0.2);
    const fade = inOut(t, 0, 4, 0.5);
    text(ctx, '__TITLE__', width / 2, height / 2 + (1 - s) * 80, {
      size: 140,
      weight: 800,
      alpha: fade,
    });
    const line = progress(t, 0.5, 0.8, ease.outExpo);
    ctx.fillStyle = '#7c5cff';
    ctx.globalAlpha = fade;
    ctx.fillRect(width / 2 - 300 * line, height / 2 + 110, 600 * line, 8);
  },
};
