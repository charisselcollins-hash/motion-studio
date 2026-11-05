# Motion Studio

## Environment (cloud session)
- ffmpeg: install with `apt-get install -y ffmpeg` (already present in the base image).
- Headless browser: Playwright with the pre-installed Chromium (`require('playwright')`, `chromium.launch()`). Do not run `playwright install`.

## Rendering rule
Every time a video is rendered, save the MP4 in `out/`, commit it, and push to the working branch so it can be downloaded from GitHub.
