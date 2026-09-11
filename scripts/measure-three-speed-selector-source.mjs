import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url), { PNG } = require('../node_modules/playwright-core/lib/utilsBundle.js');
const png = PNG.sync.read(await readFile('artifacts/reference/brown-058-detail.png'));
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const rois = [
  ['gear-stack-0', 150, 195, 620, 1270], ['gear-stack-1', 315, 365, 600, 1220], ['gear-stack-2', 495, 550, 520, 1160],
  ['main-input-shaft', 225, 280, 695, 835], ['first-input-sleeve', 390, 460, 690, 840], ['second-input-sleeve', 590, 650, 680, 850],
  ['output-shaft-0', 225, 285, 985, 1090], ['output-shaft-1', 390, 460, 985, 1090],
  ['driver-shaft', 450, 620, 195, 290], ['driver-drum', 730, 985, 0, 485],
  ['lower-pulley-0', 700, 760, 520, 1010], ['lower-pulley-1', 820, 880, 520, 1010], ['lower-pulley-2', 940, 1000, 520, 1010],
];
const rows = rois.map(([name, x0, x1, y0, y1]) => {
  const columns = [];
  for (let x = x0; x <= x1; x += 1) {
    const dark = [];
    for (let y = y0; y <= y1; y += 1) if (png.data[4 * (y * png.width + x)] < 85) dark.push(y);
    if (dark.length) columns.push({ x, top: dark[0], bottom: dark.at(-1), center: (dark[0] + dark.at(-1)) / 2 });
  }
  return { name, roi: [x0, x1, y0, y1], top: median(columns.map(v => v.top)), bottom: median(columns.map(v => v.bottom)), center: median(columns.map(v => v.center)), columns };
});
const report = { source: '../reference/brown-058-detail.png', method: 'Read-only columnwise first/last dark pixel inside explicitly selected unoccluded source regions; medians limit wear and ink noise. Gear-stack extents include both meshing wheels and do not count teeth.', rows };
await writeFile('artifacts/review/058-source-envelope-measurement.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(rows.map(({ columns, ...row }) => row), null, 2));
