# Motion Studio

Motion graphics written as code. See README.md for the video format and commands.

## Environment (cloud session)
- ffmpeg: install with `apt-get install -y ffmpeg` (already present in the base image).
- Headless browser: Playwright with the pre-installed Chromium. Do not run `playwright install` or add playwright to package.json.

## Video format
- One HTML file per video in `videos/`. It sets `window.DURATION`, `window.SIZE` and `window.render(t)`.
- Frames must depend only on `t`: no CSS animations/transitions, timers, `Date.now()` or `Math.random()`.
- Colors and fonts come from `brand.css` CSS variables; link it with `../brand.css`.

## Workflow
1. Check a video with `node render.mjs <name> --stills 3` and look at the PNGs in `out/stills/`.
2. Render with `node render.mjs <name>` → `out/<name>.mp4` at 30 fps.

## Rendering rule
Every time a video is rendered, commit the MP4 in `out/` and push to the working branch so it can be downloaded from GitHub.
