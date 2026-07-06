import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svgPath = join(root, 'assets/icon.svg');
const svg = readFileSync(svgPath, 'utf8');
const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  });
  const png = resvg.render().asPng();
  writeFileSync(join(root, `public/icon-${size}.png`), png);
  console.log(`wrote public/icon-${size}.png`);
}
