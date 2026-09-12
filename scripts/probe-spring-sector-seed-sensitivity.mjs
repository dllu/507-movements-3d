import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport, verifyStudySources, freezeStudySources} from './lib/study-report-io.mjs';
import springSectorSource from './lib/spring-sector-source.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-packed-clock-graze-seed-sensitivity';
const inputs = JSON.parse(process.env.PROBE_INPUTS ?? '["artifacts/review/083-packed-clock-coarse-seed-graze-thirtysecond-ms.json.gz","artifacts/review/083-packed-clock-shared-graze-thirtysecond-ms.json.gz"]');
const comparisonFile = 'artifacts/review/083-packed-clock-tenth-us-sixteen-sixteenth-refinement.json';
const comparison = readStudyReport(comparisonFile); verifyStudySources(comparison.sources);
assert.equal(inputs.length, 2);
const data = inputs.map(readStudyReport), seeds = [];
const core = row => Object.fromEntries(['time', 'x', 'v', 'active'].map(key => [key, row[key]]));
const code = d => d.sources.filter(s => !s.file.startsWith('artifacts/')).map(({file, sha256}) => ({file, sha256}));
for (const d of data) {
  verifyStudySources(d.sources); assert.equal(d.failures.length, 0); assert(d.continuousPrimary.passed);
  assert.equal(d.continuousPrimary.acceptedIntervals, d.rows.length - 1);
  for (const key of ['parameters', 'rawMass', 'dt', 'eventStep', 'minimumStep', 'duration']) assert.deepEqual(d[key], data[0][key]);
  assert.deepEqual(code(d), code(data[0]));
  const parent = readStudyReport(d.resumeFile); verifyStudySources(parent.sources);
  assert.deepEqual(core(d.rows[0]), core(parent.rows[d.startIndex]));
  assert(Math.abs(d.rows.at(-1).time - d.rows[0].time - d.duration) < 1e-8);
  assert.equal(d.rows[1].method, 'backward-euler'); assert(d.rows[1].dt <= d.eventStep);
  for (const [i, row] of d.rows.entries()) {
    assert(Number.isFinite(row.time));
    for (const key of ['x', 'v']) {assert.equal(row[key].length, 3); assert(row[key].every(Number.isFinite));}
    if (i) assert(row.time > d.rows[i - 1].time);
  }
  seeds.push({file: d.resumeFile, index: d.startIndex, state: core(d.rows[0])});
}
const startDifference = Math.abs(data[0].rows[0].time - data[1].rows[0].time);
assert(startDifference < 1e-8);
assert(Math.abs(data[0].rows.at(-1).time - data[1].rows.at(-1).time) < 1e-8);
const scale = springSectorSource.scale, multipliers = [scale * comparison.wheelRadius, scale, scale];
const pointers = [0, 0], times = [...new Set(data.flatMap(d => d.rows.map(r => r.time)))].sort((a, b) => a - b);
const bodies = ['wheel', 'frontSector', 'rearSector'].map(family => ({family, maximumPixels: 0}));
let firstTargetCrossing = null;
for (const time of times) {
  const x = data.map((d, i) => {
    while (pointers[i] < d.rows.length - 2 && d.rows[pointers[i] + 1].time < time) pointers[i]++;
    const a = d.rows[pointers[i]], b = d.rows[pointers[i] + 1];
    const f = Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time)));
    return a.x.map((v, j) => v + f * (b.x[j] - v));
  });
  const differences = x[0].map((v, i) => Math.abs(v - x[1][i]) * multipliers[i]);
  for (const [i, pixels] of differences.entries()) if (pixels > bodies[i].maximumPixels)
    Object.assign(bodies[i], {maximumPixels: pixels, time});
  if (!firstTargetCrossing && Math.max(...differences) > comparison.targetPixels) firstTargetCrossing = {time, differences};
}
const omega = 2 * Math.PI / data[0].parameters.period;
const observationWindow = [12.68, 12.74];
const transitions = data.map((d, i) => ({file: inputs[i], rows: d.rows.filter(r => r.transition
  && r.time >= observationWindow[0] && r.time <= observationWindow[1]).map(r => ({...core(r), contacts: r.contacts}))}));
const initialPositionDifferencePixels = data[0].rows[0].x.map((v, i) => Math.abs(v - data[1].rows[0].x[i]) * multipliers[i]);
const sources = freezeStudySources([comparisonFile, ...inputs, ...seeds.map(s => s.file),
  'scripts/probe-spring-sector-seed-sensitivity.mjs', 'scripts/lib/study-report-io.mjs', 'scripts/lib/spring-sector-source.mjs'], prefix);
const report = {movement: 83, status: 'saved-state-grazing-sensitivity-diagnostic', productionChanged: false,
  mechanicsPassed: false, candidateIntegrated: false, verifiedInputs: true, inputs, seeds,
  dt: data[0].dt, eventStep: data[0].eventStep, duration: data[0].duration,
  codeAndPhysicalParametersIdentical: true, startTimeDifference: startDifference,
  inputAngleDifferenceBoundAtEqualElapsedTime: data[0].parameters.amplitude * omega * startDifference,
  inputVelocityDifferenceBoundAtEqualElapsedTime: data[0].parameters.amplitude * omega ** 2 * startDifference,
  initialPositionDifferencePixels, initialVelocityDifference: data[0].rows[0].v.map((v, i) => v - data[1].rows[0].v[i]),
  wheelRadius: comparison.wheelRadius, scale, targetPixels: comparison.targetPixels, unionKnots: times.length,
  maximumPixels: Math.max(...bodies.map(b => b.maximumPixels)), bodies, firstTargetCrossing, observationWindow, transitions, sources,
  qualification: 'Both runs use the same fine base step, event window, solver code and physical parameters, with exact states carried from different parent histories near twelve seconds. Represented start times differ slightly; analytic input bounds report that offset. The observed contact histories and displacement growth show sensitivity to these saved states. This is not a refinement comparison from identical initial data, a continuum-error bound, or a playback qualification.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined, seeds: undefined, transitions: transitions.map(r => ({file: r.file,
  rows: r.rows.map(row => ({time: row.time, active: row.active}))}))});
