import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';

// Playwright already bundles this read-only PNG decoder. No browser or
// image conversion is needed while the app's WebGL regression sweep runs.
const require = createRequire(import.meta.url), { PNG } = require('../node_modules/playwright-core/lib/utilsBundle.js');
const png = PNG.sync.read(await readFile('artifacts/reference/brown-056-detail.png'));
const report = [];
for (const center of [[420, 667], [430, 650], [440, 650], [444.3812455943572, 649.3836301494903]]) {
  const n = 4096, values = [];
  for (let i = 0; i < n; i += 1) {
    const angle = 2 * Math.PI * i / n, degrees = angle * 180 / Math.PI;
    if (degrees < 60 || degrees > 305 || (degrees > 110 && degrees < 125)) continue;
    let outer = 350;
    for (let r = 350; r <= 430; r += 0.5) {
      const x = Math.round(center[0] + r * Math.cos(angle)), y = Math.round(center[1] - r * Math.sin(angle));
      if (png.data[4 * (y * png.width + x)] < 85) outer = r;
    }
    values.push({ angle, outer });
  }
  const mean = values.reduce((sum, v) => sum + v.outer, 0) / values.length, scores = [];
  for (let teeth = 32; teeth <= 50; teeth += 1) {
    let real = 0, imaginary = 0, weight = 0;
    for (const v of values) { const delta = v.outer - mean; real += delta * Math.cos(teeth * v.angle); imaginary += delta * Math.sin(teeth * v.angle); weight += Math.abs(delta); }
    scores.push({ teeth, amplitude: Math.hypot(real, imaginary) / weight });
  }
  scores.sort((a, b) => b.amplitude - a.amplitude); report.push({ center, scores, values });
}
await writeFile('artifacts/review/056-source-pitch-measurement.json', JSON.stringify({ source: '../reference/brown-056-detail.png',
  method: 'Mean-centered Fourier score of the outer dark boundary, with headstock/pulley/handle occlusions excluded. This is initial evidence, not a confirmed tooth count.', report }, null, 2) + '\n');
console.log(JSON.stringify(report.map(v => ({ center: v.center, candidates: v.scores.slice(0, 5) })), null, 2));
