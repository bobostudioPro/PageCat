import { cp, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const from = join(root, 'node_modules/pdfjs-dist');
const to = join(root, 'public/pdfjs');
await mkdir(to, { recursive: true });
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  await mkdir(join(to, dir), { recursive: true });
  await cp(join(from, dir), join(to, dir), { recursive: true });
}
console.log('pdf.js assets copied to public/pdfjs');
