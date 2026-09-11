import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url), { PNG } = require('../node_modules/playwright-core/lib/utilsBundle.js');
const png = PNG.sync.read(await readFile('artifacts/reference/brown-061-detail.png'));
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const rois = [
  ['driver-drum', 500, 750, 95, 700],
  ['driver-shaft-left', 180, 285, 325, 445], ['driver-shaft-right', 820, 975, 325, 445],
  ['neutral-pulley', 358, 370, 795, 1385], ['direct-pulley', 505, 590, 790, 1385],
  ['carrier-pulley', 640, 735, 790, 1385], ['output-shaft-left', 215, 330, 1000, 1130],
  ['brake-drum-left', 790, 820, 970, 1190], ['brake-drum-right', 880, 903, 970, 1190],
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
const report = { source: '../reference/brown-061-detail.png', method: 'Read-only columnwise first/last dark pixel inside explicitly selected unoccluded source regions; medians limit wear and ink noise.', rows };
await writeFile('artifacts/review/061-source-envelope-measurement.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(rows.map(({ columns, ...row }) => row), null, 2));
