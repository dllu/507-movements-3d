import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport, verifyStudySources, freezeStudySources} from './lib/study-report-io.mjs';

const inputs = JSON.parse(process.env.PROBE_INPUTS ?? '["artifacts/review/083-variable-bdf-full-quarter-ms.json","artifacts/review/083-clock-bdf-tenth-us-full-quarter-ms.json"]');
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-clock-tenth-us-event-refinement';
const core = r => Object.fromEntries(['time', 'x', 'v', 'active'].map(k => [k, r[k]]));
const runs = inputs.map(specification => {
  const files = Array.isArray(specification) ? specification : [specification]; assert(files.length);
  const segments = files.map(readStudyReport), first = segments[0], joins = [];
  for (const [i, d] of segments.entries()) {
    verifyStudySources(d.sources); assert.equal(d.failures.length, 0); assert(d.continuousPrimary.passed);
    assert.equal(d.continuousPrimary.acceptedIntervals, d.rows.length - 1);
    for (const key of ['parameters', 'rawMass', 'dt', 'eventStep', 'minimumStep']) assert.deepEqual(d[key], first[key], key);
    if (i) {
      const previous = segments[i - 1];
      assert.deepEqual(core(d.rows[0]), core(previous.rows.at(-1)), 'Exact carried state required');
      assert.equal(d.resumeFile, files[i - 1]); assert.equal(d.startIndex, previous.rows.length - 1);
      assert.equal(d.rows[1].method, 'backward-euler'); assert(d.rows[1].dt <= d.eventStep * (1 + 1e-8));
      joins.push({time: d.rows[0].time, previous: files[i - 1], continuation: files[i], exactCarriedState: true});
    }
  }
  return {files, joins, dt: first.dt, eventStep: first.eventStep, parameters: first.parameters,
    rows: segments.flatMap((d, i) => i ? d.rows.slice(1) : d.rows)};
});
assert(runs.length >= 2);
for (const d of runs) {
  assert.deepEqual(d.parameters, runs[0].parameters); assert.deepEqual(d.rows[0], runs[0].rows[0]);
  assert(Math.abs(d.rows.at(-1).time - runs[0].rows.at(-1).time) < 1e-8);
}
const model = makeSpringSectorCandidate(), u = model.root.userData; let wheelRadius = 0;
for (const [name, mesh] of Object.entries(u.parts)) if (u.families[name] === 'wheel') {
  mesh.updateMatrix();
  for (const triangle of surfaceTriangles(mesh.geometry)) for (const p of [triangle.a, triangle.b, triangle.c]) {
    p.applyMatrix4(mesh.matrix); wheelRadius = Math.max(wheelRadius, Math.hypot(p.x, p.z));
  }
}
const targetPixels = .25, comparisons = [];
for (let pair = 1; pair < runs.length; pair++) {
  const a = runs[pair - 1], b = runs[pair];
  assert(b.dt <= a.dt && b.eventStep <= a.eventStep && (b.dt < a.dt || b.eventStep < a.eventStep));
  const times = [...new Set([...a.rows.map(r => r.time), ...b.rows.map(r => r.time)])].sort((a, b) => a - b);
  const pointers = [0, 0], bodies = ['wheel', 'frontSector', 'rearSector'].map(family => ({family, maximumPixels: 0}));
  const sample = (d, time, i) => {
    while (pointers[i] < d.rows.length - 2 && d.rows[pointers[i] + 1].time < time) pointers[i]++;
    const A = d.rows[pointers[i]], B = d.rows[pointers[i] + 1];
    const f = Math.max(0, Math.min(1, (time - A.time) / (B.time - A.time)));
    return A.x.map((v, j) => v + f * (B.x[j] - v));
  };
  let firstTargetCrossing = null;
  for (const time of times) {
    const x = sample(a, time, 0), y = sample(b, time, 1), differences = [];
    for (let i = 0; i < 3; i++) {
      const difference = Math.abs(x[i] - y[i]), pixels = difference * u.source.scale * (i === 0 ? wheelRadius : 1);
      differences.push(pixels);
      if (pixels > bodies[i].maximumPixels) Object.assign(bodies[i], {maximumPixels: pixels, time, coordinateDifference: difference});
    }
    if (!firstTargetCrossing && Math.max(...differences) > targetPixels)
      firstTargetCrossing = {time, differences, bracketIndices: [...pointers]};
  }
  comparisons.push({coarseSegments: a.files, fineSegments: b.files, coarseStep: a.dt, fineStep: b.dt,
    coarseEventStep: a.eventStep, fineEventStep: b.eventStep, unionKnots: times.length, bodies,
    maximumPixels: Math.max(...bodies.map(body => body.maximumPixels)), firstTargetCrossing});
}
const files = [...runs.flatMap(r => r.files), 'scripts/compare-spring-sector-refinement.mjs',
  'scripts/lib/study-report-io.mjs', 'scripts/lib/spring-sector-candidate.mjs', 'tests/helpers/solid-surface.mjs'];
const sources = freezeStudySources(files, prefix);
const report = {movement: 83, status: 'segmented-step-and-event-motion-comparison', productionChanged: false, mechanicsPassed: false,
  passed: comparisons.at(-1).maximumPixels <= targetPixels, targetPixels, wheelRadius, comparisons,
  runs: runs.map(({rows, parameters, ...r}) => ({...r, states: rows.length, start: rows[0].time, end: rows.at(-1).time})), sources,
  qualification: 'Union knots bound differences of the saved piecewise-linear free coordinates. The wheel mesh radius converts angular difference to a displacement bound; prescribed shaft motion and physical parameters agree. Segment joins carry exact states and retain explicit numerical restarts. Step size or event resolution decreases, with implementation provenance recorded separately. This is observed agreement, not a continuum-error, full spring/hardware displacement or periodic-playback proof.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined}); if (!report.passed) process.exitCode = 1;
