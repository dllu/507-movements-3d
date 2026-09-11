import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url), { PNG } = require('../node_modules/playwright-core/lib/utilsBundle.js');
const png = PNG.sync.read(await readFile('artifacts/reference/brown-062-detail.png'));
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const rois = [
  ['driver-drum-left', 385, 445, 115, 720], ['driver-drum-right', 565, 705, 115, 720],
  ['small-driver-left', 745, 785, 235, 575], ['small-driver-right', 890, 995, 235, 575],
  ['driver-shaft-left', 160, 345, 330, 455], ['driver-shaft-right', 1040, 1140, 335, 455],
  ['neutral-pulley-left', 435, 447, 785, 1380], ['direct-pulley', 565, 640, 785, 1380],
  ['carrier-pulley', 685, 765, 785, 1380], ['side-input-pulley-right', 875, 883, 785, 1380],
  ['output-shaft-left', 200, 400, 985, 1120], ['output-shaft-right', 920, 1080, 985, 1120],
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
const report = { source: '../reference/brown-062-detail.png', method: 'Read-only columnwise first/last dark pixel inside explicitly selected unoccluded source regions; medians limit wear and ink noise.', rows };
await writeFile('artifacts/review/062-source-envelope-measurement.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(rows.map(({ columns, ...row }) => row), null, 2));
