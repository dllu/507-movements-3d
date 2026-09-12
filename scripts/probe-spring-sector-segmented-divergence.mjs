import fs from 'node:fs';
import assert from 'node:assert/strict';
import springSectorSource from './lib/spring-sector-source.mjs';
import {readStudyReport, verifyStudySources, freezeStudySources} from './lib/study-report-io.mjs';

const comparisonFile = process.env.PROBE_COMPARISON ?? 'artifacts/review/083-packed-clock-tenth-us-sixteen-refinement.json';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-packed-clock-tenth-us-divergence';
const comparison = readStudyReport(comparisonFile);
verifyStudySources(comparison.sources); assert.equal(comparison.comparisons.length, 1);
const pair = comparison.comparisons[0];
const inputs = [pair.coarseSegments ?? [pair.coarse], pair.fineSegments ?? [pair.fine]];
const core = row => Object.fromEntries(['time', 'x', 'v', 'active'].map(key => [key, row[key]]));
const data = inputs.map(files => {
  assert(files.length > 0);
  const segments = files.map(readStudyReport), first = segments[0];
  for (const [i, segment] of segments.entries()) {
    verifyStudySources(segment.sources);
    assert.equal(segment.failures.length, 0); assert(segment.continuousPrimary.passed);
    assert.equal(segment.continuousPrimary.acceptedIntervals, segment.rows.length - 1);
    for (const key of ['parameters', 'dt', 'eventStep', 'minimumStep']) assert.deepEqual(segment[key], first[key]);
    if (i) {
      assert.equal(segment.resumeFile, files[i - 1]);
      assert.equal(segment.startIndex, segments[i - 1].rows.length - 1);
      assert.deepEqual(core(segment.rows[0]), core(segments[i - 1].rows.at(-1)));
    }
  }
  const rows = segments.flatMap((segment, i) => i ? segment.rows.slice(1) : segment.rows);
  for (const [i, row] of rows.entries()) {
    assert(Number.isFinite(row.time));
    for (const key of ['x', 'v']) {assert.equal(row[key].length, 3); assert(row[key].every(Number.isFinite));}
    if (i) assert(row.time > rows[i - 1].time);
  }
  return {rows, parameters: first.parameters};
});
assert.deepEqual(data[0].rows[0], data[1].rows[0]);
assert.deepEqual(data[0].parameters, data[1].parameters);
const start = data[0].rows[0].time, end = data[0].rows.at(-1).time;
assert(Math.abs(end - data[1].rows.at(-1).time) < 1e-8);
const scale = springSectorSource.scale;
assert(Number.isFinite(scale) && scale > 0 && comparison.wheelRadius > 0);
const multipliers = [scale * comparison.wheelRadius, scale, scale];
const pointers = [0, 0], thresholds = [.001, .01, .025, .05, .1, .25, .5, 1, 2, 4, 8], firstCrossings = [];
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
    brackets: data.map((d, i) => ({files: inputs[i], index: pointers[i], before: summary(d.rows[pointers[i]]), after: summary(d.rows[pointers[i] + 1])}))});
}
assert.equal(maximumPixels, pair.maximumPixels);
assert.equal(times.length, pair.unionKnots);
const transitionWindows = firstCrossings.filter(c => [.025, .25, 1].includes(c.thresholdPixels)).map(c => ({
  thresholdPixels: c.thresholdPixels, center: c.time,
  runs: data.map((d, i) => ({files: inputs[i], transitions: d.rows.filter(r => r.transition && Math.abs(r.time - c.time) <= .04).map(summary)})),
}));
const sources = freezeStudySources([comparisonFile, ...inputs.flat(), 'scripts/probe-spring-sector-segmented-divergence.mjs',
  'scripts/lib/spring-sector-source.mjs', 'scripts/lib/study-report-io.mjs'], prefix);
const report = {movement: 83, status: 'segmented-motion-divergence-onset-diagnostic', productionChanged: false, mechanicsPassed: false,
  inputs, maximumPixels, targetPixels: comparison.targetPixels, unionKnots: times.length, bins, firstCrossings, transitionWindows, sources,
  qualification: 'Reproduces the complete comparison maximum and union-knot count after verifying source bytes and exact segment joins, then records first threshold crossings and nearby stored contact changes. This locates accumulated disagreement; it does not identify its cause, estimate continuum error or qualify playback.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({maximumPixels, firstCrossings: firstCrossings.map(({thresholdPixels, time, pixels}) => ({thresholdPixels, time, pixels}))});
