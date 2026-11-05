# Motion Studio

Motion graphics videos written as code. Each video is one HTML file. A headless browser (Playwright) draws every frame and ffmpeg joins the frames into an MP4.

## Requirements

- Node.js 18+
- Playwright with Chromium: `npm i -D playwright && npx playwright install chromium`
- ffmpeg with libx264 (e.g. `apt-get install -y ffmpeg` or `brew install ffmpeg`)

## Usage

```bash
node render.mjs videos/hello.html      # full video → out/hello.mp4 (30 fps)
node render.mjs hello                  # same, looks in videos/
node render.mjs hello --stills 3       # 3 evenly spaced PNGs → out/stills/
```

## Making a video

Create `videos/<name>.html`. It must:

1. Set `window.DURATION` (seconds) and `window.SIZE` (`[width, height]`).
2. Define `window.render(t)`, which draws the exact frame at time `t` seconds.
3. Link `../brand.css` to use your colors and fonts (`var(--color-primary)`, `var(--font-display)`, …).

```html
<link rel="stylesheet" href="../brand.css">
<h1 id="title">Hi</h1>
<script>
  window.DURATION = 3;
  window.SIZE = [1920, 1080];
  window.render = (t) => {
    const p = Math.min(1, t / 1);                 // 0→1 over the first second
    title.style.opacity = p;
    title.style.transform = `translateY(${(1 - p) * 50}px)`;
  };
</script>
```

Rules that keep every render identical:

- Everything on screen depends only on `t`.
- No CSS animations or transitions (the renderer switches them off and warns), no `setTimeout`/`setInterval`/`requestAnimationFrame`, no `Date.now()`, no `Math.random()` (use a seeded random function if you need randomness).

`videos/hello.html` is a working example with easing helpers you can copy.

## Files

```
brand.css      brand colors and fonts (CSS variables)
render.mjs     the renderer
videos/        one HTML file per video
out/           rendered MP4s (committed); out/stills/ is not committed
```
