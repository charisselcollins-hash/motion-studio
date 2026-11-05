// Render a scene to out/<scene>.mp4 (or a single PNG still with --still).
//
//   npm run render -- intro
//   npm run render -- intro --still 2.5      (PNG of the frame at 2.5s)
//   npm run render -- intro --from 1 --to 3  (only seconds 1–3)
//   npm run render -- --all
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { startServer, listScenes, ROOT } from './server.mjs';

const require = createRequire(import.meta.url);

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    console.error('Playwright not found. Install it with:\n  npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }
}

const isNum = (s) => s != null && s !== '' && !Number.isNaN(Number(s));

function parseArgs(argv) {
  const opts = { scenes: [], crf: 18 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') opts.all = true;
    else if (a === '--still') opts.still = isNum(argv[i + 1]) ? Number(argv[++i]) : 0;
    else if (isNum(a) && opts.still === 0) opts.still = Number(a); // npm run still -- intro 2.5
    else if (a === '--from') opts.from = Number(argv[++i]);
    else if (a === '--to') opts.to = Number(argv[++i]);
    else if (a === '--crf') opts.crf = Number(argv[++i]);
    else if (a === '--out') opts.out = argv[++i];
    else opts.scenes.push(a);
  }
  if (opts.all) opts.scenes = listScenes();
  return opts;
}

async function renderScene(browser, port, name, opts) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error(`[${name}] ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/?scene=${encodeURIComponent(name)}&render`);
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 30000 });
  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error(`Scene "${name}" failed to load: ${err}`);

  const cfg = await page.evaluate(() => window.__config);
  await page.setViewportSize({ width: cfg.width, height: cfg.height });
  const outDir = path.join(ROOT, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  if (opts.still != null) {
    const frame = Math.min(cfg.totalFrames - 1, Math.round(opts.still * cfg.fps));
    const data = await page.evaluate((f) => window.__frame(f), frame);
    const file = opts.out ?? path.join(outDir, 'stills', `${name}-${frame}.png`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    console.log(`Still → ${path.relative(ROOT, file)}`);
    await page.close();
    return file;
  }

  const first = opts.from != null ? Math.round(opts.from * cfg.fps) : 0;
  const last = opts.to != null ? Math.min(cfg.totalFrames, Math.round(opts.to * cfg.fps)) : cfg.totalFrames;
  const file = opts.out ?? path.join(outDir, `${name}.mp4`);

  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(cfg.fps), '-i', '-'];
  const audio = cfg.audio && path.join(ROOT, cfg.audio);
  if (audio && fs.existsSync(audio)) {
    args.push('-ss', String(first / cfg.fps), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest');
  } else if (cfg.audio) {
    console.warn(`Audio file not found, rendering silent: ${cfg.audio}`);
  }
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', String(opts.crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file);

  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => {
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))));
  });

  const started = Date.now();
  const count = last - first;
  for (let f = first; f < last; f++) {
    const data = await page.evaluate((n) => window.__frame(n), f);
    const buf = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    const n = f - first + 1;
    if (process.stdout.isTTY) process.stdout.write(`\r[${name}] frame ${n}/${count}`);
    else if (n % Math.max(1, Math.round(count / 10)) === 0 || n === count) console.log(`[${name}] frame ${n}/${count}`);
  }
  ff.stdin.end();
  await done;
  await page.close();
  if (process.stdout.isTTY) process.stdout.write('\n');
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const mb = (fs.statSync(file).size / 1e6).toFixed(2);
  console.log(`Rendered → ${path.relative(ROOT, file)} (${count} frames, ${mb} MB, ${secs}s)`);
  return file;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.scenes.length) {
    console.log(`Usage: npm run render -- <scene> [--still <sec>] [--from <sec>] [--to <sec>] [--crf <n>]\nScenes: ${listScenes().join(', ') || '(none)'}`);
    process.exit(1);
  }
  if (opts.still == null && spawnSync('ffmpeg', ['-version']).status !== 0) {
    console.error('ffmpeg not found. Install it (e.g. apt-get install -y ffmpeg).');
    process.exit(1);
  }
  const known = listScenes();
  for (const s of opts.scenes) {
    if (!known.includes(s)) {
      console.error(`Unknown scene "${s}". Available: ${known.join(', ')}`);
      process.exit(1);
    }
  }

  const { chromium } = loadPlaywright();
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    for (const name of opts.scenes) await renderScene(browser, server.address().port, name, opts);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
