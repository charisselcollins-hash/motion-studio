// Create a new scene from the template: npm run new my-scene
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './server.mjs';

const name = process.argv[2];
if (!name || !/^[a-z0-9][a-z0-9-_]*$/i.test(name)) {
  console.error('Usage: npm run new <scene-name>   (letters, numbers, dashes)');
  process.exit(1);
}
const file = path.join(ROOT, 'scenes', `${name}.js`);
if (fs.existsSync(file)) {
  console.error(`scenes/${name}.js already exists`);
  process.exit(1);
}
const template = fs.readFileSync(path.join(ROOT, 'lib', 'template.js'), 'utf8');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, template.replaceAll('__TITLE__', name));
console.log(`Created scenes/${name}.js`);
console.log(`Preview: npm run preview   Render: npm run render -- ${name}`);
