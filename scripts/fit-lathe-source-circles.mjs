import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url), { PNG } = require('../node_modules/playwright-core/lib/utilsBundle.js');
const png = PNG.sync.read(await readFile('artifacts/reference/brown-056-detail.png'));
const dark = (x, y) => png.data[4 * (Math.round(y) * png.width + Math.round(x))] < 85;
const solve = (matrix, rhs) => {
  const rows = matrix.map((r, i) => [...r, rhs[i]]);
  for (let j = 0; j < rhs.length; j += 1) {
    let pivot = j; for (let k = j + 1; k < rhs.length; k += 1) if (Math.abs(rows[k][j]) > Math.abs(rows[pivot][j])) pivot = k;
    [rows[j], rows[pivot]] = [rows[pivot], rows[j]]; const divisor = rows[j][j]; rows[j] = rows[j].map(v => v / divisor);
    for (let k = 0; k < rhs.length; k += 1) if (k !== j) { const factor = rows[k][j]; rows[k] = rows[k].map((v, i) => v - factor * rows[j][i]); }
  }
  return rows.map(r => r.at(-1));
};
const fit = points => {
  const matrix = Array.from({ length: 3 }, () => [0, 0, 0]), rhs = [0, 0, 0];
  for (const { x, y } of points) {
    const v = [2 * x, 2 * y, 1], square = x * x + y * y;
    for (let i = 0; i < 3; i += 1) { rhs[i] += v[i] * square; for (let j = 0; j < 3; j += 1) matrix[i][j] += v[i] * v[j]; }
  }
  const [x, y, c] = solve(matrix, rhs), radius = Math.sqrt(c + x * x + y * y);
  return { x, y, radius, rms: Math.sqrt(points.reduce((sum, p) => sum + (Math.hypot(p.x - x, p.y - y) - radius) ** 2, 0) / points.length) };
};
const specs = [
  { name: 'large-gear-smooth-rim', center: [420, 667], radii: [300, 390], angles: [30, 305], exclude: [[110, 125]] },
  { name: 'largest-pulley-outer', center: [905, 665], radii: [415, 450], angles: [-70, 125], exclude: [[20, 42]] },
  { name: 'middle-pulley-outer', center: [905, 665], radii: [332, 380], angles: [-60, 125], exclude: [[20, 42]] },
  { name: 'smallest-pulley-outer', center: [905, 665], radii: [265, 310], angles: [-35, 120], exclude: [[20, 42]] },
];
const report = [];
for (const spec of specs) {
  const points = [];
  for (let angle = spec.angles[0]; angle <= spec.angles[1]; angle += 0.4) {
    if (spec.exclude.some(([a, b]) => angle >= a && angle <= b)) continue;
    const rad = angle * Math.PI / 180; let low = null, high = null;
    for (let r = spec.radii[0]; r <= spec.radii[1]; r += 0.25) {
      if (dark(spec.center[0] + r * Math.cos(rad), spec.center[1] - r * Math.sin(rad))) { low ??= r; high = r; }
      else if (low !== null) break;
    }
    if (low === null || high - low < 1) continue;
    const r = (low + high) / 2; points.push({ x: spec.center[0] + r * Math.cos(rad), y: spec.center[1] - r * Math.sin(rad) });
  }
  const initial = fit(points), selected = points.filter(p => Math.abs(Math.hypot(p.x - initial.x, p.y - initial.y) - initial.radius) < 8);
  report.push({ ...spec, rawPoints: points.length, fit: fit(selected), points: selected });
}
await writeFile('artifacts/review/056-source-circle-fits.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.map(({ name, fit, points }) => ({ name, fit, samples: points.length })), null, 2));
