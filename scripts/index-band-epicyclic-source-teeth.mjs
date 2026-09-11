import { readFile, writeFile } from 'node:fs/promises';

const source = JSON.parse(await readFile('artifacts/review/057-source-pitch-measurement.json', 'utf8'));
const records = [];
for (const gear of source.gears) {
  const [threshold, sign, expected] = { sun: [150, 1, 18], planet: [85, 1, 10], ring: [300, -1, 34] }[gear.name];
  const mask = Array(4096).fill(null);
  for (const sample of gear.samples) mask[Math.round(sample.angle / (2 * Math.PI) * 4096) % 4096]
    = sample.dark > 0 && sign * sample.minimum >= sign * threshold;
  // Close only sub-degree gaps in the scan. Never bridge excluded occlusions.
  for (let i = 0; i < 4096; i += 1) if (mask[i] === true && mask[(i + 1) % 4096] === false) {
    let j = 1; while (j <= 12 && mask[(i + j) % 4096] === false) j += 1;
    if (j <= 12 && mask[(i + j) % 4096] === true) for (let k = 1; k < j; k += 1) mask[(i + k) % 4096] = true;
  }
  const start = mask.findIndex(v => v !== true), clusters = [], rejected = []; let run = [];
  for (let k = 1; k <= 4096; k += 1) {
    const i = (start + k) % 4096;
    if (mask[i] === true) run.push(i);
    else if (run.length) {
      const angle = Math.atan2(run.reduce((s, i) => s + Math.sin(2 * Math.PI * i / 4096), 0),
        run.reduce((s, i) => s + Math.cos(2 * Math.PI * i / 4096), 0)) * 180 / Math.PI;
      const truncated = mask[(run[0] + 4095) % 4096] === null || mask[(run.at(-1) + 1) % 4096] === null;
      const record = { angle: (angle + 360) % 360, width: run.length * 360 / 4096, truncated };
      (run.length >= 23 && !truncated ? clusters : rejected).push(record); run = [];
    }
  }
  const fits = [];
  for (let teeth = gear.candidates[0]; teeth <= gear.candidates[1]; teeth += 1) {
    const pitch = 360 / teeth; let best = Infinity, bestPhase = 0;
    for (let step = 0; step < 10000; step += 1) {
      const phase = pitch * step / 10000;
      const squared = clusters.reduce((s, v) => { const residual = v.angle - phase - pitch * Math.round((v.angle - phase) / pitch); return s + residual ** 2; }, 0);
      if (squared < best) { best = squared; bestPhase = phase; }
    }
    fits.push({ teeth, phase: bestPhase, rmsDegrees: Math.sqrt(best / clusters.length) });
  }
  const fit = fits.find(v => v.teeth === expected), pitch = 360 / expected;
  for (const v of clusters) {
    v.index = ((Math.round((v.angle - fit.phase) / pitch) % expected) + expected) % expected;
    v.residualDegrees = v.angle - fit.phase - pitch * Math.round((v.angle - fit.phase) / pitch);
  }
  records.push({ name: gear.name, threshold, sign, expected, clusters, rejected, fits: fits.sort((a, b) => a.rmsDegrees - b.rmsDegrees) });
}
const report = { source: '../reference/brown-057-detail.png', method: 'Unseeded angular plateaus of the first visible ink boundary; existing occlusion masks retained, sub-degree gaps closed, plateaus narrower than 2 degrees or truncated by a mask reported separately. Tooth counts are fitted only after plateau extraction. Missing and worn teeth remain uncertain.', gears: records };
await writeFile('artifacts/review/057-indexed-source-teeth.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(records.map(v => ({ name: v.name, visiblePlateaus: v.clusters.length, bestFits: v.fits.slice(0, 3), selected: v.fits.find(f => f.teeth === v.expected) })), null, 2));
