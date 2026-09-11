import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url), { PNG } = require('../node_modules/playwright-core/lib/utilsBundle.js');
const png = PNG.sync.read(await readFile('artifacts/reference/brown-059-detail.png'));
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const rois = [
  ['gear-stack-0', 415, 465, 700, 1330], ['gear-stack-1', 1060, 1100, 560, 1190],
  ['main-input-shaft', 485, 590, 780, 875], ['input-sleeve', 915, 1030, 740, 900],
  ['output-shaft-0', 485, 585, 1060, 1140], ['output-shaft-1', 920, 1020, 1060, 1140],
  ['driver-shaft', 485, 575, 200, 295], ['driver-drum', 700, 925, 0, 495],
  ['lower-pulley-0', 680, 690, 580, 1060], ['lower-pulley-1', 720, 775, 580, 1060], ['lower-pulley-2', 820, 880, 580, 1060],
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
const report = { source: '../reference/brown-059-detail.png', method: 'Read-only columnwise first/last dark pixel inside explicitly selected unoccluded source regions; medians limit wear and ink noise. Gear-stack extents include both meshing wheels and do not count teeth.', rows };
await writeFile('artifacts/review/059-source-envelope-measurement.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(rows.map(({ columns, ...row }) => row), null, 2));
