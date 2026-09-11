import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url), { PNG } = require('../node_modules/playwright-core/lib/utilsBundle.js');
const png = PNG.sync.read(await readFile('artifacts/reference/brown-060-detail.png'));
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const rois = [
  ['large-driver', 420, 540, 60, 680], ['small-driver', 850, 955, 180, 575],
  ['driver-shaft-left', 155, 285, 320, 435], ['driver-shaft-middle', 580, 710, 320, 435], ['driver-shaft-right', 1000, 1090, 320, 435],
  ['loose-left', 395, 415, 760, 1320], ['fast-left', 460, 535, 760, 1320],
  ['fast-right', 815, 828, 760, 1320], ['loose-right', 865, 950, 760, 1320],
  ['output-shaft-left', 140, 285, 980, 1110], ['output-shaft-middle', 580, 700, 980, 1110], ['output-shaft-right', 1000, 1135, 980, 1110],
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
const report = { source: '../reference/brown-060-detail.png', method: 'Read-only columnwise first/last dark pixel inside explicitly selected unoccluded source regions; medians limit wear and ink noise.', rows };
await writeFile('artifacts/review/060-source-envelope-measurement.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(rows.map(({ columns, ...row }) => row), null, 2));
