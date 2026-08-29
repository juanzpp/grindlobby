import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const partsDir = resolve(process.cwd(), 'assets/login-reference-desktop.parts');
const output = resolve(process.cwd(), 'public/assets/login-blueprint.webp');

const partNames = readdirSync(partsDir)
  .filter((name) => /^part_\d+$/.test(name))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (!partNames.length) {
  throw new Error('desktop login background parts not found');
}

const encoded = partNames
  .map((name) => readFileSync(resolve(partsDir, name), 'utf8').replace(/\s+/g, ''))
  .join('');
const bytes = Buffer.from(encoded, 'base64');

if (bytes.length < 15000) {
  throw new Error(`unexpected desktop login background size: ${bytes.length}`);
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, bytes);
console.log(`login desktop asset materialized: ${bytes.length} bytes from ${partNames.length} parts`);
