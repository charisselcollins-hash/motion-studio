// Live preview in the browser: npm run preview  →  http://localhost:3000
import { startServer } from './server.mjs';

const port = Number(process.env.PORT ?? 3000);
const server = await startServer(port);
console.log(`Motion Studio preview → http://localhost:${server.address().port}`);
console.log('Pick a scene, then Space = play/pause, ←/→ = step a frame. Reload to see code changes.');
