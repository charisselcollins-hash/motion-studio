#!/usr/bin/env node
// Render a video to out/<name>.mp4 at 30 fps.
//
//   node render.mjs videos/hello.html            full video
//   node render.mjs hello                        same thing (looks in videos/)
//   node render.mjs hello --stills 3             3 PNG stills in out/stills/
//
// A video is an HTML file that sets window.DURATION (seconds),
// window.SIZE ([width, height]) and window.render(t).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const FPS = 30;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

// ---- Arguments ----
const args = process.argv.slice(2);
let input = null;
let stills = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--stills') {
    stills = Number(args[++i] ?? 3);
    if (!Number.isInteger(stills) || stills < 1) fail('--stills needs a whole number, e.g. --stills 3');
  } else if (!input) {
    input = args[i];
  } else {
    fail(`Unexpected argument: ${args[i]}`);
  }
}
if (!input) fail('Usage: node render.mjs <video.html | name> [--stills N]');

const candidates = [input, path.join(ROOT, 'videos', input), path.join(ROOT, 'videos', `${input}.html`)];
const file = candidates.map((p) => path.resolve(p)).find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
if (!file) fail(`Video not found: ${input}`);
const name = path.basename(file, path.extname(file));

// ---- Tools ----
let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  fail('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
}
if (stills == null && spawnSync('ffmpeg', ['-version']).status !== 0) {
  fail('ffmpeg is not installed. On Ubuntu/Debian: apt-get install -y ffmpeg');
}

// ---- Load the video page ----
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(`Could not load ${r.url()}`));

  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  if (errors.length) throw new Error(`The video page has errors:\n  ${errors.join('\n  ')}`);

  const { duration, size, hasRender, animations } = await page.evaluate(() => ({
    duration: window.DURATION,
    size: window.SIZE,
    hasRender: typeof window.render === 'function',
    animations: document.getAnimations().length,
  }));
  if (!(typeof duration === 'number' && duration > 0)) throw new Error('window.DURATION must be a number of seconds, e.g. 3');
  if (!(Array.isArray(size) && size.length === 2 && size.every((n) => Number.isInteger(n) && n > 0))) {
    throw new Error('window.SIZE must be [width, height], e.g. [1920, 1080]');
  }
  if (!hasRender) throw new Error('window.render(t) must be a function');
  if (animations) console.warn(`Warning: ${animations} CSS animation(s)/transition(s) found. They are switched off; use render(t) instead.`);

  // Freeze any CSS animations or transitions so frames only depend on render(t).
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  const [width, height] = size;
  await page.setViewportSize({ width, height });

  const totalFrames = Math.max(1, Math.round(duration * FPS));
  const capture = async (frame) => {
    await page.evaluate((t) => window.render(t), frame / FPS);
    if (errors.length) throw new Error(`render(${(frame / FPS).toFixed(3)}) failed:\n  ${errors.join('\n  ')}`);
    return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
  };

  // ---- Stills ----
  if (stills != null) {
    const dir = path.join(OUT, 'stills');
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < stills; i++) {
      // Evenly spaced through the video, e.g. 3 stills of a 3s video → 0.5s, 1.5s, 2.5s.
      const frame = Math.min(totalFrames - 1, Math.round(((i + 0.5) / stills) * duration * FPS));
      const png = await capture(frame);
      const out = path.join(dir, `${name}-${(frame / FPS).toFixed(2)}s.png`);
      fs.writeFileSync(out, png);
      console.log(`Still → ${path.relative(ROOT, out)}`);
    }
  } else {
    // ---- Full video ----
    fs.mkdirSync(OUT, { recursive: true });
    const out = path.join(OUT, `${name}.mp4`);
    const ffmpeg = spawn('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', // H.264 needs even dimensions
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', out,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const finished = new Promise((resolve, reject) => {
      ffmpeg.on('error', reject);
      ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed (exit ${code})`))));
    });

    const started = Date.now();
    for (let f = 0; f < totalFrames; f++) {
      const png = await capture(f);
      if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
      if (process.stdout.isTTY) process.stdout.write(`\rFrame ${f + 1}/${totalFrames}`);
    }
    ffmpeg.stdin.end();
    await finished;
    if (process.stdout.isTTY) process.stdout.write('\n');
    const mb = (fs.statSync(out).size / 1e6).toFixed(2);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`Video → ${path.relative(ROOT, out)} (${totalFrames} frames, ${width}x${height}, ${mb} MB, ${secs}s)`);
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
