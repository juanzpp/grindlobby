import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = resolve(process.cwd(), 'assets/login-reference.webp.b64');
const output = resolve(process.cwd(), 'public/assets/login-blueprint.webp');

const encoded = readFileSync(source, 'utf8').replace(/\s+/g, '');
const bytes = Buffer.from(encoded, 'base64');

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, bytes);
console.log(`login desktop asset materialized: ${bytes.length} bytes`);
