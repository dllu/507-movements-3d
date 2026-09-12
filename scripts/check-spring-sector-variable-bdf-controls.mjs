import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringSectorVariableBdfIntegrator} from './lib/spring-sector-variable-bdf-integrator.mjs';
import {makeSpringSectorEventBdfIntegrator} from './lib/spring-sector-event-bdf-integrator.mjs';
import {advanceSpringSectorVariableBdfStep} from './lib/spring-sector-variable-bdf-step.mjs';
import {advanceSpringSectorBdfStep} from './lib/spring-sector-bdf-step.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-variable-bdf-controls';
const empty = () => ({rows: [], gaps: {clearance: 1}});
const parameters = {inertia: [1], damping: [0], coulomb: 0};
const ballistic = {parameters, forces: () => [-9.81], constraints: empty};
const initial = {time: 0, x: [0], v: [0], active: []};
const integrate = (factory, physics, state, dt, end, eventStep = 1e-6, pattern = [1, .25, .5, .125]) => {
  const r = factory(physics, state, {eventStep, minimumStep: eventStep / 128});
  for (let i = 0; r.rows.at(-1).time < end - 1e-12; i++)
    assert(r.advance(Math.min(end - r.rows.at(-1).time, dt * pattern[i % pattern.length])));
  assert.equal(r.failures.length, 0);
  for (let i = 1; i < r.rows.length; i++) {
    const row = r.rows[i];
    if (row.method === 'variable-bdf2') {
      assert(row.stepRatio > 0 && row.stepRatio <= 2 + 1e-8);
      assert(row.historyFactor <= .8 + 1e-8);
      assert((row.momentumResidual ?? 0) < 1e-9);
    }
    if (row.transition) assert(row.dt <= eventStep * (1 + 1e-9));
  }
  return r;
};

// A quadratic trajectory is differentiated exactly by the nonuniform BDF
// formula. This checks unequal intervals against analytic motion, including
// a moving contact whose reaction supplies its known acceleration.
const quadratic = [];
for (const ratio of [.125, .5, 1, 2]) for (const constrained of [false, true]) {
  const h = .013, dt = ratio * h;
  const physics = constrained ? {parameters, forces: () => [-9.81], constraints: (x, t) => ({
    rows: [{id: 'floor', J: [1], gap: x[0] - t * t, inputNormalVelocity: -2 * t}], gaps: {floor: x[0] - t * t},
  })} : {parameters, forces: () => [2], constraints: empty};
  const state = {...initial, active: constrained ? ['floor'] : []}, earlier = {...state, time: -h, x: [h * h], v: [-2 * h]};
  const result = advanceSpringSectorVariableBdfStep(physics, state, earlier, dt); assert(result.okay);
  const xError = Math.abs(result.state.x[0] - dt * dt), vError = Math.abs(result.state.v[0] - 2 * dt);
  assert(xError < 1e-14 && vError < 1e-13);
  if (constrained) {
    assert.equal(result.diagnostic.contacts.length, 1);
    assert(Math.abs(result.diagnostic.contacts[0].impulse - result.diagnostic.forceWeight * 11.81) < 1e-13);
  }
  if (ratio === 1) {
    const original = advanceSpringSectorBdfStep(physics, state, earlier, dt); assert(original.okay);
    assert(Math.abs(original.state.x[0] - result.state.x[0]) < 1e-14);
    assert(Math.abs(original.state.v[0] - result.state.v[0]) < 1e-13);
  }
  quadratic.push({ratio, constrained, xError, vError});
}
assert.throws(() => advanceSpringSectorVariableBdfStep(ballistic, initial, {...initial, time: -.01}, .021), /growth at most two/);

const freefall = [makeSpringSectorEventBdfIntegrator, makeSpringSectorVariableBdfIntegrator].map(factory => {
  const r = integrate(factory, ballistic, initial, .01, 1), last = r.rows.at(-1);
  return {factory: factory.name, intervals: r.rows.length - 1, positionError: Math.abs(last.x[0] + 4.905 * last.time ** 2),
    velocityError: Math.abs(last.v[0] + 9.81 * last.time)};
});
assert(freefall[1].positionError < 1e-9 && freefall[1].velocityError < 1e-9);
assert(freefall[0].positionError > 100 * freefall[1].positionError);

const oscillator = {parameters: {...parameters, damping: [.2]}, forces: x => [-4 * x[0]], constraints: empty};
const exact = t => {
  const w = Math.sqrt(3.99), e = Math.exp(-.1 * t);
  return {x: e * (Math.cos(w * t) + .1 / w * Math.sin(w * t)), v: -4 / w * e * Math.sin(w * t)};
};
const oscillatorRuns = [.04, .02, .01].map(dt => {
  const r = integrate(makeSpringSectorVariableBdfIntegrator, oscillator, {...initial, x: [1]}, dt, 4);
  const last = r.rows.at(-1), target = exact(last.time);
  return {dt, positionError: Math.abs(last.x[0] - target.x), velocityError: Math.abs(last.v[0] - target.v)};
});
for (let i = 1; i < oscillatorRuns.length; i++) {
  assert(oscillatorRuns[i - 1].positionError / oscillatorRuns[i].positionError > 3.5);
  assert(oscillatorRuns[i - 1].velocityError / oscillatorRuns[i].velocityError > 3.5);
}

const floor = {...ballistic, constraints: x => ({rows: [{id: 'floor', J: [1], gap: x[0], inputNormalVelocity: 0}], gaps: {floor: x[0]}})};
const analyticImpactTime = (Math.sqrt(1 + 2 * 9.81 * .1) - 1) / 9.81;
const impacts = [.01, .005, .0025].map(dt => {
  const r = integrate(makeSpringSectorVariableBdfIntegrator, floor, {...initial, x: [.1], v: [-1]}, dt, .5);
  const index = r.rows.findIndex(row => row.active.includes('floor')), landed = r.rows.slice(index);
  assert(index > 0); assert(landed.every(row => row.x[0] >= -2e-9));
  const firstContactTime = landed[0].time, timeError = Math.abs(firstContactTime - analyticImpactTime);
  const maximumReboundSpeed = Math.max(0, ...landed.map(row => row.v[0]));
  const stoppingDelay = landed.find(row => Math.abs(row.v[0]) < 1e-10).time - firstContactTime;
  assert(timeError < 2e-6 && maximumReboundSpeed < 1e-10 && stoppingDelay < 2e-6);
  assert(landed.slice(0, 3).every(row => row.method === 'backward-euler'));
  return {dt, firstContactTime, timeError, maximumReboundSpeed, stoppingDelay};
});
const release = {...floor, constraints: (x, t) => ({rows: [{id: 'floor', J: [1], gap: x[0] + 5 * t * t,
  inputNormalVelocity: 10 * t}], gaps: {floor: x[0] + 5 * t * t}})};
const releases = [1e-6, 5e-7, 2.5e-7].map(eventStep => {
  const r = integrate(makeSpringSectorVariableBdfIntegrator, release, {...initial, active: ['floor']}, .01, .5, eventStep);
  const last = r.rows.at(-1), firstReleaseTime = r.rows.find(row => !row.active.length).time;
  const velocityError = Math.abs(last.v[0] + 9.81 * last.time), positionError = Math.abs(last.x[0] + 4.905 * last.time ** 2);
  assert(firstReleaseTime <= 2 * eventStep && velocityError < 5 * eventStep && positionError < 3 * eventStep);
  return {eventStep, firstReleaseTime, velocityError, positionError};
});
for (let i = 1; i < releases.length; i++) assert(releases[i - 1].velocityError / releases[i].velocityError > 1.95);

const files = ['scripts/check-spring-sector-variable-bdf-controls.mjs', 'scripts/lib/spring-sector-variable-bdf-integrator.mjs',
  'scripts/lib/spring-sector-variable-bdf-step.mjs', 'scripts/lib/spring-sector-event-bdf-integrator.mjs',
  'scripts/lib/spring-sector-bdf-step.mjs', 'scripts/lib/spring-sector-dynamics.mjs',
  'scripts/lib/alternating-peg-dynamics-study.mjs', 'scripts/lib/jointed-tappet-dynamics-study.mjs'];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report = {movement: 83, status: 'variable-step-bdf-analytic-controls', passed: true, productionChanged: false, mechanicsPassed: false,
  quadratic, freefall, oscillatorRuns, analyticImpactTime, impacts, releases, sources,
  qualification: 'Quadratic motion/reactions, ragged-step freefall, smooth convergence, plastic stopping and bounded release error pass analytic controls. These controls do not establish finite-sector motion agreement, energy balance, spatial reactions, support behavior or final playback.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined});
