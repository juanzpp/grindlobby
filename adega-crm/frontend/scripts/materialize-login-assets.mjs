import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function materializeParts(partsDirName, outputPath, minimumBytes = 15000) {
  const partsDir = resolve(process.cwd(), partsDirName);
  const output = resolve(process.cwd(), outputPath);
  const partNames = readdirSync(partsDir)
    .filter((name) => /^part_\d+$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (!partNames.length) throw new Error(`asset parts not found: ${partsDirName}`);
  const encoded = partNames
    .map((name) => readFileSync(resolve(partsDir, name), 'utf8').replace(/\s+/g, ''))
    .join('');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length < minimumBytes) throw new Error(`unexpected asset size for ${outputPath}: ${bytes.length}`);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, bytes);
  console.log(`asset materialized: ${outputPath} (${bytes.length} bytes)`);
}

function materializeBase64(sourcePath, outputPath, minimumBytes = 10000) {
  const encoded = readFileSync(resolve(process.cwd(), sourcePath), 'utf8').replace(/\s+/g, '');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length < minimumBytes) throw new Error(`unexpected asset size for ${outputPath}: ${bytes.length}`);
  const output = resolve(process.cwd(), outputPath);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, bytes);
  console.log(`asset materialized: ${outputPath} (${bytes.length} bytes)`);
}

// Legacy materialized asset remains available for older/mobile styling.
materializeParts('assets/login-reference-desktop.parts', 'public/assets/login-blueprint.webp');

// Blueprint 03 desktop scene. This is a clean scene asset, not a screenshot of the login UI;
// all inputs, buttons, status and authentication flows remain live DOM/UI.
materializeBase64('assets/login-blueprint-03.avif.b64', 'public/assets/login-blueprint-03.avif');
