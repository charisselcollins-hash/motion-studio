# Motion Studio

Motion graphics videos written as code. Each scene is a JavaScript file that draws one frame on a canvas for a given time `t`. A headless browser renders every frame and ffmpeg encodes them into an MP4.

No npm install needed. It uses Node, Playwright (with Chromium) and ffmpeg.

## Commands

```bash
npm run new my-scene             # create scenes/my-scene.js from the template
npm run preview                  # live preview at http://localhost:3000
npm run still -- my-scene 2.5    # PNG of the frame at 2.5s → out/stills/
npm run render -- my-scene       # full video → out/my-scene.mp4
npm run render:all               # render every scene
```

Render options: `--from <sec>`, `--to <sec>`, `--crf <n>` (lower = higher quality, default 18), `--out <file>`.

In the preview, Space plays/pauses and ←/→ step one frame. Reload the page to see code changes.

## Writing a scene

```js
import { ease, progress, spring, text } from '../lib/motion.js';

export default {
  width: 1920, height: 1080, fps: 30, duration: 4,
  background: '#0e0e12',
  audio: 'assets/music.mp3',      // optional, muxed into the MP4

  async setup() { /* optional: load images/fonts, return state */ },

  render(ctx, t, { width, height, frame, duration, state }) {
    const s = spring(t, 0.2);                       // springs in at 0.2s
    text(ctx, 'Hello', width / 2, height / 2 + (1 - s) * 80, { size: 140 });
  },
};
```

`render` must depend only on `t` (and `state` from setup). Never use `Math.random()` or the clock directly. Use `random(seed)` instead, so every render looks the same.

## Helpers in `lib/motion.js`

| Helper | What it does |
| --- | --- |
| `progress(t, start, dur, ease)` | 0→1 over a time window |
| `interpolate(t, [in…], [out…], ease)` | map time to values, multi-keyframe |
| `spring(t, start, {stiffness, damping})` | physical spring 0→1 with overshoot |
| `inOut(t, start, end, fade)` | fade in, hold, fade out |
| `stagger(i, each, start)` | start time for item `i` in a sequence |
| `ease.*` | linear, quad, cubic, quart, expo, back, elastic, bounce, `bezier(...)` |
| `text`, `circle`, `rect`, `group` | drawing shortcuts (`group` moves/rotates/scales/fades) |
| `mixColor`, `withAlpha` | color blending |
| `random(seed)`, `noise(x, seed)` | seeded randomness and smooth noise |
| `loadImage`, `loadFont` | load files from `assets/` inside `setup()` |

Anything else works too: the full Canvas 2D API (gradients, paths, clipping, filters, blend modes) is available on `ctx`.

## Layout

```
scenes/     your videos, one file per scene
lib/        motion.js helpers, player.html (preview + render page), template.js
scripts/    render, preview, new-scene CLI
assets/     images, fonts, audio
out/        rendered MP4s (committed); out/stills/ is ignored
```
