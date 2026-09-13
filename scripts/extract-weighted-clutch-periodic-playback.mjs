import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport, freezeStudySources, verifyStudySources} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/087-periodic-playback';
const tolerance = 2e-8, period = 37.5 * Math.PI, files = [], closures = [];
let playback;
function read(file) { files.push(file); return readStudyReport(file); }
function bracket(rows, time) {
  assert(time >= rows[0].time && time <= rows.at(-1).time);
  let lo = 0, hi = rows.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (rows[mid].time <= time) lo = mid; else hi = mid; }
  return [lo, hi];
}
function interpolate(rows, time) {
  const [lo, hi] = bracket(rows, time), a = rows[lo], b = rows[hi], f = (time - a.time) / (b.time - a.time);
  return {time, q: a.q.map((x, i) => x + f * (b.q[i] - x)), v: a.v.map((x, i) => x + f * (b.v[i] - x))};
}
for (const direction of ['CW', 'CCW']) {
  const stem = 'artifacts/review/087-sequence-' + direction;
  const names = direction === 'CW' ? [stem + '-fine-segment-1.json.gz', stem + '-fine-segment-2.json.gz'] :
    [stem + '-fine-segment-1.json.gz', stem + '-resumed-fine-segment-2.json.gz', stem + '-fifth-fine-segment-3.json.gz'];
  const reports = names.map(read);
  for (let i = 0; i < reports.length; i++) {
    const r = reports[i]; verifyStudySources(r.sources); assert(r.settled && !r.error);
    if (i) assert.deepEqual(r.start, reports[i - 1].end);
  }
  const start = reports[0].start, endTime = start.time + period;
  const all = reports.flatMap((r, i) => r.rows.slice(i ? 1 : 0)), end = interpolate(all, endTime);
  const coordinateDifference = end.q.map((x, i) => Math.abs(x - start.q[i]));
  const velocityDifference = end.v.map((x, i) => Math.abs(x - start.v[i]));
  assert(Math.max(...coordinateDifference) < 1e-11 && Math.max(...velocityDifference) < 1e-11);
  // The endpoint is the measured, interpolated state. Never substitute start.q.
  closures.push({direction, inputs: names, startTime: start.time, endTime, period, start, end,
    coordinateDifference, velocityDifference, endpointReplaced: false});
  if (direction !== 'CCW') continue;
  const rows = [start, ...all.filter(r => r.time > start.time && r.time < endTime), end];
  const events = reports.flatMap(r => r.events).filter(e => e.time >= start.time && e.time <= endTime);
  const keep = new Set([0, rows.length - 1]);
  for (const event of events) { const [lo, hi] = bracket(rows, event.time); keep.add(lo); keep.add(hi); if (lo) keep.add(lo - 1); }
  const boundaries = [...keep].sort((a, b) => a - b), stack = boundaries.slice(1).map((b, i) => [boundaries[i], b]);
  while (stack.length) {
    const [lo, hi] = stack.pop(), a = rows[lo], b = rows[hi]; let worst = -1, maximum = tolerance;
    for (let i = lo + 1; i < hi; i++) {
      const f = (rows[i].time - a.time) / (b.time - a.time);
      const error = Math.max(...a.q.map((x, k) => Math.abs(x + f * (b.q[k] - x) - rows[i].q[k])));
      if (error > maximum) { maximum = error; worst = i; }
    }
    if (worst !== -1) { keep.add(worst); stack.push([lo, worst], [worst, hi]); }
  }
  const reduced = [...keep].sort((a, b) => a - b).map(i => rows[i]);
  let maximumError = 0;
  for (const row of rows) {
    const q = interpolate(reduced, row.time).q;
    maximumError = Math.max(maximumError, ...q.map((x, i) => Math.abs(x - row.q[i])));
  }
  assert(maximumError <= tolerance);
  playback = {movement: 87, options: reports[0].options, period, playbackPeriod: 24,
    modelStartTime: start.time, inputAtStart: reports[0].profile.input0 + reports[0].profile.omegaInput * start.time,
    omegaInput: reports[0].profile.omegaInput, phaseOffset: reports[0].nextStud.time - .2 - start.time,
    coordinates: ['leverAngle', 'shifterAngle', 'clutchShift', 'shaftAngle', 'clutchAngle'],
    samples: reduced.map(r => [r.time - start.time, ...r.q]),
    events: events.map(e => ({kind: e.kind, time: e.time - start.time})),
    reduction: {originalStates: rows.length, retainedStates: reduced.length, tolerance, maximumError,
      method: 'Piecewise linear reduction with event boundaries retained; error checked at every original knot, bounding the difference between the two linear interpolants.'},
    provenance: {inputs: names, periodDerivation: '27 jaw pitches / (1.4 * abs(omegaInput)); two reversals return the shaft, clutch and linkage coordinates. Input angle continues unwrapped.',
      friction: reports[0].friction, endpointReplaced: false,
      qualification: 'Playback of a contact-integrated reconstruction. Geometry retains the documented distributed source-fit adjustments. This table does not establish source acceptance or continuous solid clearance.'}};
}
files.push('scripts/extract-weighted-clutch-periodic-playback.mjs');
const sources = freezeStudySources(files, prefix); verifyStudySources(sources);
fs.writeFileSync(prefix + '-profile.json', JSON.stringify(playback) + '\n', {flag: 'wx'});
fs.writeFileSync(prefix + '-closure.json', JSON.stringify({movement: 87, sources, closures,
  reduction: playback.reduction, passed: true, productionChanged: false, candidateIntegrated: false}, null, 2) + '\n', {flag: 'wx'});
console.log({closures: closures.map(c => ({direction: c.direction, q: Math.max(...c.coordinateDifference), v: Math.max(...c.velocityDifference)})),
  period, reduction: playback.reduction, bytes: fs.statSync(prefix + '-profile.json').size});
