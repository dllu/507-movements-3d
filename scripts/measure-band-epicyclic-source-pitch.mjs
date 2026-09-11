import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url), { PNG } = require('../node_modules/playwright-core/lib/utilsBundle.js');
const png = PNG.sync.read(await readFile('artifacts/reference/brown-057-detail.png'));
const gears = [
  { name: 'sun', center: [719, 870], radii: [124, 174], candidates: [16, 28], excluded: [[240, 300]] },
  { name: 'planet', center: [727, 1095], radii: [65, 111], candidates: [6, 16], excluded: [[60, 125], [230, 305]] },
  { name: 'ring', center: [721, 870], radii: [288, 338], candidates: [30, 50], excluded: [[65, 105], [250, 287]] },
];
const report = [];
for (const gear of gears) {
  const samples = [];
  for (let i = 0; i < 4096; i += 1) {
    const angle = 2 * Math.PI * i / 4096, degrees = angle * 180 / Math.PI;
    if (gear.excluded.some(([a, b]) => degrees >= a && degrees <= b)) continue;
    let dark = 0, maximum = gear.radii[0], minimum = gear.radii[1];
    for (let r = gear.radii[0]; r <= gear.radii[1]; r += 0.5) {
      const x = Math.round(gear.center[0] + r * Math.cos(angle)), y = Math.round(gear.center[1] - r * Math.sin(angle));
      if (png.data[4 * (y * png.width + x)] < 85) { dark += 1; maximum = r; minimum = Math.min(minimum, r); }
    }
    samples.push({ angle, dark, maximum, minimum });
  }
  const scores = key => {
    const mean = samples.reduce((sum, s) => sum + s[key], 0) / samples.length, result = [];
    for (let teeth = gear.candidates[0]; teeth <= gear.candidates[1]; teeth += 1) {
      let real = 0, imaginary = 0, total = 0;
      for (const s of samples) {
        const value = s[key] - mean; real += value * Math.cos(teeth * s.angle); imaginary += value * Math.sin(teeth * s.angle); total += Math.abs(value);
      }
      result.push({ teeth, amplitude: Math.hypot(real, imaginary) / total });
    }
    return result.sort((a, b) => b.amplitude - a.amplitude);
  };
  report.push({ ...gear, scores: scores('dark'), outsideScores: scores('maximum'), insideScores: scores('minimum'), samples });
}
await writeFile('artifacts/review/057-source-pitch-measurement.json', JSON.stringify({ source: '../reference/brown-057-detail.png',
  method: 'Read-only mean-centered angular Fourier measurements, with belt and gear occlusions excluded. Initial count evidence, not a dimensional specification.', gears: report }, null, 2) + '\n');
console.log(JSON.stringify(report.map(v => ({ name: v.name, darkness: v.scores.slice(0, 3), outer: v.outsideScores.slice(0, 3), inner: v.insideScores.slice(0, 3) })), null, 2));
