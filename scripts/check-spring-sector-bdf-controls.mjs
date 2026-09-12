import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringSectorBdfIntegrator} from './lib/spring-sector-bdf-integrator.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-bdf-controls';
const empty = () => ({rows: [], gaps: {clearance: 1}});
const oscillator = {parameters: {inertia: [1], damping: [.2], coulomb: 0},
  forces: x => [-4 * x[0]], constraints: empty};
const exact = t => {
  const w = Math.sqrt(3.99), e = Math.exp(-.1 * t);
  return {x: e * (Math.cos(w * t) + .1 / w * Math.sin(w * t)), v: -4 / w * e * Math.sin(w * t)};
};
const runs = [];
for (const dt of [.04, .02, .01]) {
  const integration = makeSpringSectorBdfIntegrator(oscillator, {time: 0, x: [1], v: [0], active: []},
    {eventStep: dt / 64, minimumStep: dt / 8192});
  for (let i = 0; i < Math.round(4 / dt); i++) assert(integration.advance(dt));
  const final = integration.rows.at(-1), target = exact(final.time);
  const positionError = Math.abs(final.x[0] - target.x), velocityError = Math.abs(final.v[0] - target.v);
  const maximumMomentumResidual = Math.max(...integration.rows.slice(1).map(row => row.momentumResidual ?? 0));
  assert(maximumMomentumResidual < 1e-9);
  runs.push({dt, positionError, velocityError, maximumMomentumResidual, bdfSteps: integration.rows.filter(row => row.method === 'bdf2').length});
}
for (let i = 1; i < runs.length; i++) {
  assert(runs[i - 1].positionError / runs[i].positionError > 3.7);
  assert(runs[i - 1].velocityError / runs[i].velocityError > 3.7);
}

const floor = t => .2 * t * t;
const movingFloor = {...oscillator, parameters: {inertia: [1], damping: [0], coulomb: 0}, forces: () => [-9.81],
  constraints: (x, t) => ({rows: [{id: 'floor', J: [1], gap: x[0] - floor(t), inputNormalVelocity: -.4 * t}], gaps: {floor: x[0] - floor(t)}})};
const guided = makeSpringSectorBdfIntegrator(movingFloor, {time: 0, x: [0], v: [0], active: ['floor']},
  {eventStep: .001 / 64, minimumStep: .001 / 8192});
for (let i = 0; i < 1000; i++) assert(guided.advance(.001));
const movingFloorPositionError = Math.max(...guided.rows.map(row => Math.abs(row.x[0] - floor(row.time))));
const movingFloorFinalVelocityError = Math.abs(guided.rows.at(-1).v[0] - .4 * guided.rows.at(-1).time);
assert(movingFloorPositionError < 1e-12); assert(movingFloorFinalVelocityError < 1e-10);
assert(guided.rows.slice(1).every(row => row.contacts.length === 1 && row.contacts[0].impulse > 0));

const fixedFloor = {...movingFloor, constraints: x => ({rows: [{id: 'floor', J: [1], gap: x[0], inputNormalVelocity: 0}], gaps: {floor: x[0]}})};
const analyticImpactTime = (Math.sqrt(1 + 2 * 9.81 * .1) - 1) / 9.81;
const impactRefinement = [];
let impact;
for (const dt of [.01, .005, .0025]) {
  impact = makeSpringSectorBdfIntegrator(fixedFloor, {time: 0, x: [.1], v: [-1], active: []},
    {eventStep: dt * dt / 64, minimumStep: dt * dt / 8192});
  for (let i = 0; i < Math.round(1 / dt); i++) assert(impact.advance(dt));
  const measuredImpactTime = impact.rows.find(row => row.active.includes('floor')).time;
  impactRefinement.push({dt, measuredImpactTime, timeError: Math.abs(measuredImpactTime - analyticImpactTime)});
}
for (let i = 1; i < impactRefinement.length; i++) assert(impactRefinement[i - 1].timeError / impactRefinement[i].timeError > 3.7);
const landed = impact.rows.filter(row => row.active.includes('floor'));
assert(landed.length > 50);
const maximumReboundSpeed = Math.max(0, ...landed.map(row => row.v[0]));
assert(maximumReboundSpeed < 1e-10);
assert(impact.rows.every(row => row.x[0] >= -2e-9));
assert(landed.slice(2).every(row => Math.abs(row.x[0]) < 1e-12 && Math.abs(row.v[0]) < 1e-10));
const measuredImpactTime = landed[0].time;
assert(Math.abs(measuredImpactTime - analyticImpactTime) < .00006);
// A velocity history containing the impact must never feed a multistep
// update, even when the identity of the active surface has stopped changing.
const firstLanding = impact.rows.indexOf(landed[0]);
assert(impact.rows.slice(firstLanding, firstLanding + 3).every(row => row.method === 'backward-euler'));
const files = ['scripts/check-spring-sector-bdf-controls.mjs', 'scripts/lib/spring-sector-bdf-integrator.mjs',
  'scripts/lib/spring-sector-bdf-step.mjs', 'scripts/lib/spring-sector-dynamics.mjs',
  'scripts/lib/alternating-peg-dynamics-study.mjs', 'scripts/lib/jointed-tappet-dynamics-study.mjs'];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report = {movement: 83, status: 'isolated-bdf-controls', passed: true, productionChanged: false, mechanicsPassed: false,
  oscillator: runs, movingFloorPositionError, movingFloorFinalVelocityError,
  plasticImpact: {analyticImpactTime, measuredImpactTime, refinement: impactRefinement, maximumReboundSpeed, firstLanding,
    rejectedTrials: impact.rejectedSteps.length, intervals: impact.rows.length - 1}, sources,
  qualification: 'Analytic smooth and moving-constraint controls plus a plastic landing without a history-induced rebound. These do not qualify the finite spring-sector mechanism or its energy balance.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(report);
