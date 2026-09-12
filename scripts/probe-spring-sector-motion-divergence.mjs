import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import springSectorSource from './lib/spring-sector-source.mjs';

const comparisonFile = process.env.PROBE_COMPARISON ?? 'artifacts/review/083-fast-bdf-sixteen-refinement.json';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-fast-bdf-second-cycle-divergence';
const read = file => JSON.parse(fs.readFileSync(file));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const comparison = read(comparisonFile); assert.equal(comparison.comparisons.length, 1);
const pair = comparison.comparisons[0], inputs = [pair.coarse, pair.fine], data = inputs.map(read);
for (const d of [comparison, ...data]) for (const s of d.sources) {
  assert.equal(hash(s.file), s.sha256, s.file);
  if (s.archive) assert.equal(hash(s.archive), s.sha256, s.archive);
}
assert.deepEqual(data[0].rows[0], data[1].rows[0]);
assert.deepEqual(data[0].parameters, data[1].parameters);
const start = data[0].rows[0].time, end = data[0].rows.at(-1).time;
assert(Math.abs(end - data[1].rows.at(-1).time) < 1e-8);
const sourceFile = 'scripts/lib/spring-sector-source.mjs';
const scale = springSectorSource.scale;
assert(Number.isFinite(scale) && scale > 0 && comparison.wheelRadius > 0);
const multipliers = [scale * comparison.wheelRadius, scale, scale];
const pointers = [0, 0], thresholds = [.1, .25, .5, 1, 2, 4, 8], firstCrossings = [];
const bins = Array.from({length: Math.ceil((end - start) / .5)}, (_, i) => ({start: start + i * .5, maximumPixels: 0}));
const summary = row => ({time: row.time, x: row.x, v: row.v, active: row.active, method: row.method, contacts: row.contacts});
const times = [...new Set(data.flatMap(d => d.rows.map(r => r.time)))].sort((a, b) => a - b);
let maximumPixels = 0;
for (const time of times) {
  const x = data.map((d, i) => {
    while (pointers[i] < d.rows.length - 2 && d.rows[pointers[i] + 1].time < time) pointers[i]++;
    const a = d.rows[pointers[i]], b = d.rows[pointers[i] + 1];
    const f = Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time)));
    return a.x.map((v, j) => v + f * (b.x[j] - v));
  });
  const differences = x[0].map((v, i) => Math.abs(v - x[1][i]) * multipliers[i]);
  const pixels = Math.max(...differences); maximumPixels = Math.max(maximumPixels, pixels);
  const bin = bins[Math.min(bins.length - 1, Math.floor((time - start) / .5))];
  if (pixels > bin.maximumPixels) Object.assign(bin, {maximumPixels: pixels, time, differences});
  while (thresholds.length && pixels > thresholds[0]) firstCrossings.push({thresholdPixels: thresholds.shift(), time, pixels, differences,
    brackets: data.map((d, i) => ({file: inputs[i], index: pointers[i], before: summary(d.rows[pointers[i]]), after: summary(d.rows[pointers[i] + 1])}))});
}
assert.equal(maximumPixels, pair.maximumPixels);
assert.equal(times.length, pair.unionKnots);
const transitionWindows = firstCrossings.filter(c => [.25, 1].includes(c.thresholdPixels)).map(c => ({
  thresholdPixels: c.thresholdPixels, center: c.time,
  runs: data.map((d, i) => ({file: inputs[i], transitions: d.rows.filter(r => r.transition && Math.abs(r.time - c.time) <= .04).map(summary)})),
}));
const sources = [...new Set([comparisonFile, ...inputs, 'scripts/probe-spring-sector-motion-divergence.mjs', sourceFile])].map((file, i) => {
  // The original reports already carry immutable source archives. Only the
  // small diagnostic sources need a new copy; all input bytes are hashed.
  const archive = file.endsWith('.mjs') ? prefix + '-source-' + i + '.txt' : undefined;
  if (archive) fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const report = {movement: 83, status: 'motion-divergence-onset-diagnostic', productionChanged: false, mechanicsPassed: false,
  inputs, maximumPixels, targetPixels: comparison.targetPixels, unionKnots: times.length, bins, firstCrossings, transitionWindows, sources,
  qualification: 'Reproduces the complete comparison maximum and union-knot count, then records the first threshold crossings and nearby stored contact changes. This locates accumulated trajectory disagreement; it does not identify its cause, estimate continuum error or qualify playback.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({maximumPixels, firstCrossings: firstCrossings.map(({thresholdPixels, time, pixels}) => ({thresholdPixels, time, pixels}))});
