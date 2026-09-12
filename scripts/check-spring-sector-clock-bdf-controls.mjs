import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringSectorVariableBdfIntegrator} from './lib/spring-sector-variable-bdf-integrator.mjs';
import {makeSpringSectorClockBdfIntegrator} from './lib/spring-sector-clock-bdf-integrator.mjs';
import {advanceSpringSectorVariableBdfStep} from './lib/spring-sector-variable-bdf-step.mjs';
import {advanceSpringSectorClockBdfStep} from './lib/spring-sector-clock-bdf-step.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-clock-bdf-controls';
const snapshotFile = 'artifacts/review/083-variable-bdf-tenth-us-stall-snapshot.json';
const snapshot = JSON.parse(fs.readFileSync(snapshotFile)), g = snapshot.growth;
assert(g.nextRequestedStep > g.oldGrowthLimit);
const allowance = 8 * Number.EPSILON * Math.max(1, Math.abs(g.time), Math.abs(g.time + g.nextRequestedStep));
assert(g.nextRequestedStep <= 2 * g.representedStep + allowance);
assert(g.ratio < 2.001);

const physics = {parameters: {inertia: [1], damping: [0], coulomb: 0}, forces: () => [-9.81],
  constraints: () => ({rows: [], gaps: {clearance: 1}})};
const runs = [];
for (const start of [2, 4, 8, 16]) for (const factory of [makeSpringSectorVariableBdfIntegrator, makeSpringSectorClockBdfIntegrator]) {
  const initial = {time: start, x: [0], v: [0], active: []};
  const r = factory(physics, initial, {eventStep: 1e-7, minimumStep: 1e-7 / 128});
  for (let i = 0; i < 4; i++) assert(r.advance(.00025));
  const last = r.rows.at(-1), duration = last.time - start;
  const positionError = Math.abs(last.x[0] + 4.905 * duration ** 2), velocityError = Math.abs(last.v[0] + 9.81 * duration);
  let maximumRatio = 0;
  for (const row of r.rows) if (row.method === 'variable-bdf2') {
    maximumRatio = Math.max(maximumRatio, row.stepRatio);
    assert(row.stepRatio <= 2.001 && row.historyFactor < .801);
  }
  assert(positionError < 1e-10 && velocityError < 1e-9);
  if (factory === makeSpringSectorClockBdfIntegrator) assert(r.rows.length < 100);
  runs.push({start, factory: factory.name, intervals: r.rows.length - 1, duration, positionError, velocityError, maximumRatio});
}
assert(runs.some(r => r.factory === 'makeSpringSectorVariableBdfIntegrator' && r.intervals > 10000));

// Where both guards allow a step, the equations and every stored diagnostic
// are unchanged. Include unequal steps and a translated absolute clock.
const parity = [];
for (const time of [0, 2, 16]) for (const ratio of [.25, .5, 1, 1.5]) {
  const dt = .001 * ratio, previous = {time: time - .001, x: [.1], v: [-.2], active: []};
  const state = {time, x: [.099], v: [-.21], active: []};
  const old = advanceSpringSectorVariableBdfStep(physics, state, previous, dt);
  const corrected = advanceSpringSectorClockBdfStep(physics, state, previous, dt);
  assert.deepEqual(corrected, old); parity.push({time, ratio});
}
const zero = {time: 0, x: [0], v: [0], active: []};
assert.throws(() => advanceSpringSectorClockBdfStep(physics, zero, {...zero, time: -.001}, .003), /clock-rounding bound/);

const files = ['scripts/check-spring-sector-clock-bdf-controls.mjs', 'scripts/lib/spring-sector-clock-bdf-integrator.mjs',
  'scripts/lib/spring-sector-clock-bdf-step.mjs', 'scripts/lib/spring-sector-variable-bdf-integrator.mjs',
  'scripts/lib/spring-sector-variable-bdf-step.mjs', 'scripts/lib/spring-sector-dynamics.mjs',
  'scripts/lib/alternating-peg-dynamics-study.mjs', 'scripts/lib/jointed-tappet-dynamics-study.mjs', snapshotFile];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report = {movement: 83, status: 'clock-rounding-step-growth-controls', passed: true, productionChanged: false, mechanicsPassed: false,
  reproducedPredicate: g, clockAllowance: allowance, runs, exactStepParityCases: parity.length, sources,
  qualification: 'The saved stalled predicate is reproduced. Translated-clock ballistic controls distinguish excessive subdivision from physical error, and the corrected guard allows bounded growth at four clock origins. Accepted-step equations are unchanged in twelve exact comparisons. This does not establish finer-event finite-sector motion agreement or qualify its existing fixed-ratio audit tolerances.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined});
