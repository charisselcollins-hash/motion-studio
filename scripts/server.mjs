// Tiny static server for the player, scenes, lib and assets.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4',
};

export function listScenes() {
  const dir = path.join(ROOT, 'scenes');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)).sort();
}

export function startServer(port = 0) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/scenes') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(listScenes()));
    }
    const rel = url.pathname === '/' ? 'lib/player.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}
