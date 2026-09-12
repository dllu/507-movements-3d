import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport, verifyStudySources, freezeStudySources} from './lib/study-report-io.mjs';

const files = JSON.parse(process.env.PROBE_INPUTS ?? '["artifacts/review/084-planar-corrected-guide-pulses.json.gz","artifacts/review/084-planar-half-ms-pulses.json.gz"]');
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/084-planar-half-ms-refinement';
assert.equal(files.length, 2);
const data = files.map(readStudyReport);
for (const d of data) {
  verifyStudySources(d.sources); assert.equal(d.failures.length, 0);
  assert(Math.abs(d.rows.at(-1).time - d.rows[0].time - d.duration) < 1e-8);
  for (const [i, r] of d.rows.entries()) {assert(Number.isFinite(r.time)); assert(r.x.length === 3 && r.x.every(Number.isFinite));
    if (i) assert(r.time > d.rows[i - 1].time);}
}
assert.deepEqual(data[0].parameters, data[1].parameters); assert.deepEqual(data[0].rows[0], data[1].rows[0]);
assert.equal(data[0].duration, data[1].duration); assert(data[1].dt < data[0].dt);
assert.equal(data[0].vertexRadius, data[1].vertexRadius);
const times = [...new Set(data.flatMap(d => d.rows.map(r => r.time)))].sort((a, b) => a - b), pointers = [0, 0];
const sample = (d, t, j) => {
  while (pointers[j] < d.rows.length - 2 && d.rows[pointers[j] + 1].time < t) pointers[j]++;
  const a = d.rows[pointers[j]], b = d.rows[pointers[j] + 1], f = Math.max(0, Math.min(1, (t - a.time) / (b.time - a.time)));
  return a.x.map((v, i) => v + f * (b.x[i] - v));
};
let maximumPixels = 0, worst = null, firstTargetCrossing = null;
for (const time of times) {
  const a = sample(data[0], time, 0), b = sample(data[1], time, 1), translation = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const rotation = data[0].vertexRadius * Math.abs(a[2] - b[2]), pixels = 240 * (translation + rotation);
  if (pixels > maximumPixels) {maximumPixels = pixels; worst = {time, a, b, translationPixels: 240 * translation, rotationPixels: 240 * rotation};}
  if (!firstTargetCrossing && pixels > .25) firstTargetCrossing = {time, pixels};
}
const sources = freezeStudySources([...files, 'scripts/compare-selector-rack-dynamics.mjs', 'scripts/lib/study-report-io.mjs'], prefix);
const report = {movement: 84, status: 'free-rack-rigid-body-motion-refinement', passed: maximumPixels <= .25, targetPixels: .25,
  productionChanged: false, mechanicsPassed: false, files, unionKnots: times.length, maximumPixels, worst, firstTargetCrossing, sources,
  qualification: 'The common input and initial state are checked. At union knots, center displacement plus mesh radius times angular difference bounds every free-frame vertex. This bound is convex on each pair of piecewise-linear state segments, so endpoint maxima cover those saved interpolants. This is observed time-step agreement, not a continuum error bound or contact/clearance proof.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined}); if (!report.passed) process.exitCode = 1;
