# Motion Studio

Motion graphics written as code. See README.md for commands and the scene API.

## Environment (cloud session)
- ffmpeg: install with `apt-get install -y ffmpeg` (already present in the base image).
- Headless browser: Playwright with the pre-installed Chromium (`require('playwright')`, `chromium.launch()`). Do not run `playwright install` or add playwright to package.json.

## Working on scenes
- Scenes live in `scenes/<name>.js`; helpers in `lib/motion.js`.
- `render(ctx, t)` must be deterministic: use `random(seed)` / `noise()`, never `Math.random()` or `Date.now()`.
- Check work visually with `npm run still -- <scene> <sec> --out <scratchpad>/x.png` and look at the PNG before rendering the full video.

## Rendering rule
Every time a video is rendered, save the MP4 in `out/`, commit it, and push to the working branch so it can be downloaded from GitHub.
