import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringSectorEventBdfIntegrator} from './lib/spring-sector-event-bdf-integrator.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-event-bdf-controls';
const floor = {parameters: {inertia: [1], damping: [0], coulomb: 0}, forces: () => [-9.81],
  constraints: x => ({rows: [{id: 'floor', J: [1], gap: x[0], inputNormalVelocity: 0}], gaps: {floor: x[0]}})};
const release = {...floor, constraints: (x, t) => ({rows: [{id: 'floor', J: [1], gap: x[0] + 5 * t * t,
  inputNormalVelocity: 10 * t}], gaps: {floor: x[0] + 5 * t * t}})};
const issues = [], releaseRuns = [], impactRuns = [];
for (const [dt, eventStep] of [[.01, 1e-6], [.005, 1e-6], [.0025, 1e-6], [.01, 5e-7], [.01, 2.5e-7]]) {
  const r = makeSpringSectorEventBdfIntegrator(release, {time: 0, x: [0], v: [0], active: ['floor']},
    {eventStep, minimumStep: eventStep / 128});
  for (let i = 0; i < Math.round(.5 / dt); i++) assert(r.advance(dt));
  const last = r.rows.at(-1), firstReleaseTime = r.rows.find(row => row.active.length === 0)?.time;
  const velocityError = Math.abs(last.v[0] + 9.81 * last.time), positionError = Math.abs(last.x[0] + 4.905 * last.time ** 2);
  const contactSteps = r.rows.slice(1).filter(row => row.contacts.length);
  const maximumContactImpulse = Math.max(0, ...contactSteps.flatMap(row => row.contacts.map(c => c.impulse)));
  const run = {dt, eventStep, firstReleaseTime, velocityError, positionError, maximumContactImpulse, intervals: r.rows.length - 1};
  releaseRuns.push(run);
  // The first BE contact remains an event-resolution error, rather than an
  // exact zero-force solution. Bound it by that small resolution, and verify
  // that reducing the event step reduces the velocity error below.
  if (!(firstReleaseTime <= 2 * eventStep) || velocityError > 5 * eventStep || maximumContactImpulse > 5 * eventStep)
    issues.push({kind: 'release-resolution', run});
}
for (const i of [3, 4]) {
  const previous = i === 3 ? releaseRuns[0] : releaseRuns[i - 1];
  if (previous.velocityError / releaseRuns[i].velocityError < 1.95) issues.push({kind: 'event-step-refinement', i});
}
for (let i = 1; i < 3; i++) if (releaseRuns[i - 1].positionError / releaseRuns[i].positionError < 3.7)
  issues.push({kind: 'smooth-position-refinement', i});
for (const dt of [.01, .005, .0025]) {
  const eventStep = 1e-6;
  const r = makeSpringSectorEventBdfIntegrator(floor, {time: 0, x: [.1], v: [-1], active: []},
    {eventStep, minimumStep: eventStep / 128});
  for (let i = 0; i < Math.round(.5 / dt); i++) assert(r.advance(dt));
  const first = r.rows.findIndex(row => row.active.includes('floor'));
  const after = r.rows.slice(first), stoppingDelay = after.find(row => Math.abs(row.v[0]) < 1e-10).time - after[0].time;
  const maximumReboundSpeed = Math.max(0, ...after.map(row => row.v[0]));
  const relaxationSteps = after.slice(1, 3).map(row => row.dt);
  const run = {dt, eventStep, firstContactTime: after[0].time, stoppingDelay, maximumReboundSpeed, relaxationSteps}; impactRuns.push(run);
  if (stoppingDelay > 2 * eventStep || maximumReboundSpeed > 1e-10 || relaxationSteps.some(step => step > eventStep))
    issues.push({kind: 'impact-relaxation', run});
}
const files = ['scripts/check-spring-sector-event-bdf-controls.mjs', 'scripts/lib/spring-sector-event-bdf-integrator.mjs',
  'scripts/lib/spring-sector-bdf-step.mjs', 'scripts/lib/spring-sector-dynamics.mjs',
  'scripts/lib/alternating-peg-dynamics-study.mjs', 'scripts/lib/jointed-tappet-dynamics-study.mjs'];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report = {movement: 83, status: 'bounded-startup-and-post-impact-bdf-controls', passed: issues.length === 0,
  productionChanged: false, mechanicsPassed: false, releaseRuns, impactRuns, issues, sources,
  qualification: 'Startup and two stable post-event intervals use at most eventStep. The original exact immediate-release control remains a failure at finite event resolution; these controls measure and bound its residual error and demonstrate refinement. No general event-detection guarantee or finite-sector motion acceptance follows.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined});
if (!report.passed) process.exitCode = 1;
