import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringSectorGuidedCandidate} from './lib/spring-sector-guided-candidate.mjs';
import {makeSpringSectorDynamics} from './lib/spring-sector-dynamics.mjs';
import {makeSpringSectorLoads} from './lib/spring-sector-loads.mjs';
import {makeSpringSectorSavedContact} from './lib/spring-sector-saved-contact.mjs';
import {springSectorBdfLoadInterval} from './lib/spring-sector-bdf-loads.mjs';
import {makeSpringSectorBdfIntegrator} from './lib/spring-sector-bdf-integrator.mjs';

const inputs = JSON.parse(process.env.PROBE_INPUTS ?? '["artifacts/review/083-bdf-full-one-ms.json","artifacts/review/083-bdf-full-half-ms.json"]');
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-bdf-input-energy';
const formulaFile = 'artifacts/review/083-circular-hub-input-loading.json';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
const formula = read(formulaFile), data = inputs.map(read);
assert(formula.passed && formula.candidate === 'conformal-guides');
for (const report of [formula, ...data]) for (const s of report.sources) {
  assert.equal(hash(s.file), s.sha256, s.file);
  if (s.archive) assert.equal(hash(s.archive), s.sha256, s.archive);
}
for (const d of data) {assert.equal(d.failures.length, 0); assert.deepEqual(d.parameters, data[0].parameters);}
const model = makeSpringSectorGuidedCandidate(), physics = makeSpringSectorDynamics(model, data[0].parameters);
const loads = makeSpringSectorLoads(model, physics), contact = makeSpringSectorSavedContact(model, physics);
assert.deepEqual(loads.masses, formula.masses);
const files = [...new Set(['scripts/check-spring-sector-bdf-energy.mjs', 'scripts/lib/spring-sector-bdf-loads.mjs',
  'scripts/lib/spring-sector-loads.mjs', 'scripts/lib/spring-sector-saved-contact.mjs', 'scripts/lib/spring-sector-guided-candidate.mjs',
  formulaFile, ...inputs, ...data.flatMap(d => d.sources.map(s => s.file))])];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const issues = [], controls = [];
const terms = ['change', 'inputWork', 'dampingWork', 'loadWork', 'velocityHistoryWork', 'springHistoryWork',
  'energyHistoryWork', 'contactVelocityWork', 'correctedResidual'];
// Constant-mass quadratic/linear controls have an exact discrete energy
// identity, independently of how closely they approximate continuous motion.
for (const kind of ['oscillator', 'plastic-impact']) {
  const spring = kind === 'oscillator' ? 4 : 0, gravity = spring ? 0 : 9.81;
  const parameters = {inertia: [1, 1, 1], damping: [0, spring ? .2 : 0, 0], coulomb: 0, stiffness: [spring, 0], load: 0};
  const p = {parameters, forces: x => [0, -spring * x[1] - gravity, 0], constraints: x => spring
    ? {rows: [], gaps: {clearance: 1}}
    : {rows: [{id: 'floor', J: [0, 1, 0], gap: x[1], inputNormalVelocity: 0}], gaps: {floor: x[1]}}};
  const analyticLoads = {masses: {wheel: {Iy: 1}}, state: row => ({
    energy: row.v.reduce((sum, v) => sum + v * v / 2, 0) + spring * row.x[1] ** 2 / 2 + gravity * row.x[1],
    momentum: 0, Tq: 0, Uq: 0, M: 0, k: {v: 0}, rod: {sliderQ: 1},
    sectors: [{mass: 1, coupling: 0}, {mass: 1, coupling: 0}],
  })};
  const initial = {time: 0, x: [0, spring ? 1 : .1, 0], v: [0, spring ? 0 : -1, 0], active: []};
  const integration = makeSpringSectorBdfIntegrator(p, initial, {eventStep: 1e-6, minimumStep: 1e-8});
  for (let i = 0; i < 100; i++) assert(integration.advance(.01));
  let maximumResidual = 0, sumResidual = 0, historyWork = 0;
  for (let i = 1; i < integration.rows.length; i++) {
    const r = springSectorBdfLoadInterval(analyticLoads, parameters, integration.rows[i - 2], integration.rows[i - 1], integration.rows[i],
      integration.rows[i].contacts.map(c => ({...c, J: [0, 1, 0], inputJacobian: 0})));
    maximumResidual = Math.max(maximumResidual, Math.abs(r.correctedResidual)); sumResidual += r.correctedResidual;
    historyWork += r.velocityHistoryWork + r.springHistoryWork + r.energyHistoryWork;
  }
  const result = {kind, intervals: integration.rows.length - 1, maximumResidual, sumResidual, historyWork}; controls.push(result);
  if (maximumResidual > 1e-9 || Math.abs(sumResidual) > 1e-9) issues.push({kind: 'analytic-energy-control', result});
}
const runs = [];
for (const [index, d] of data.entries()) {
  const totals = Object.fromEntries(terms.map(key => [key, 0])), byMethod = {};
  let maximumCumulativeResidual = 0, maximumMomentumResidual = 0, maximumRodWorkError = 0, maximumBackwardEulerParityError = 0;
  let positiveInputWork = 0, negativeInputWork = 0, maximumStepResidual = 0, maximumInputForce = -Infinity, minimumInputForce = Infinity;
  let minimumRodImpulse = Infinity, maximumRodImpulse = -Infinity;
  let positiveHistoryWork = 0, negativeHistoryWork = 0, minimumSliderDerivative = Infinity, impulses = 0;
  for (let i = 1; i < d.rows.length; i++) {
    const before = d.rows[i - 1], after = d.rows[i], earlier = d.rows[i - 2], contacts = after.contacts.map(c => contact.at(after, c));
    assert(contacts.every(c => Number.isFinite(c.impulse) && c.impulse >= 0)); impulses += contacts.length;
    const r = springSectorBdfLoadInterval(loads, physics.parameters, earlier, before, after, contacts);
    if (!byMethod[after.method]) byMethod[after.method] = {intervals: 0, ...Object.fromEntries(terms.map(key => [key, 0]))};
    byMethod[after.method].intervals++;
    for (const key of terms) {assert(Number.isFinite(r[key])); totals[key] += r[key]; byMethod[after.method][key] += r[key];}
    const history = r.velocityHistoryWork + r.springHistoryWork + r.energyHistoryWork;
    if (history >= 0) positiveHistoryWork += history; else negativeHistoryWork += history;
    maximumCumulativeResidual = Math.max(maximumCumulativeResidual, Math.abs(totals.correctedResidual));
    maximumStepResidual = Math.max(maximumStepResidual, Math.abs(r.correctedResidual));
    maximumRodWorkError = Math.max(maximumRodWorkError, Math.abs(r.rodWork - r.inputWork));
    minimumSliderDerivative = Math.min(minimumSliderDerivative, Math.abs(r.sliderQ));
    maximumInputForce = Math.max(maximumInputForce, r.inputForce); minimumInputForce = Math.min(minimumInputForce, r.inputForce);
    minimumRodImpulse = Math.min(minimumRodImpulse, r.rodImpulse); maximumRodImpulse = Math.max(maximumRodImpulse, r.rodImpulse);
    if (r.inputWork >= 0) positiveInputWork += r.inputWork; else negativeInputWork += r.inputWork;
    const bdf = after.method === 'bdf2', weight = (after.time - before.time) * (bdf ? 2 / 3 : 1);
    const forces = physics.forces(after.x, after.time);
    for (let axis = 0; axis < 3; axis++) {
      const velocityHistory = before.v[axis] + (bdf ? (before.v[axis] - earlier.v[axis]) / 3 : 0);
      const residual = physics.parameters.inertia[axis] * (after.v[axis] - velocityHistory)
        - weight * (forces[axis] - physics.parameters.damping[axis] * after.v[axis])
        - contacts.reduce((sum, c) => sum + c.impulse * c.J[axis], 0);
      maximumMomentumResidual = Math.max(maximumMomentumResidual, Math.abs(residual));
    }
    if (!bdf) {
      const old = loads.interval(before, after, contacts);
      for (const key of ['change', 'inputWork', 'rodWork', 'inputImpulse', 'rodImpulse', 'inputForce', 'dampingWork', 'loadWork', 'contactVelocityWork', 'correctedResidual'])
        maximumBackwardEulerParityError = Math.max(maximumBackwardEulerParityError, Math.abs(r[key] - old[key]));
      maximumBackwardEulerParityError = Math.max(maximumBackwardEulerParityError,
        Math.abs(r.velocityHistoryWork - old.velocityChangeLoss), Math.abs(r.springHistoryWork - old.springChangeLoss), Math.abs(r.energyHistoryWork));
    }
  }
  const scale = positiveInputWork - negativeInputWork + totals.dampingWork + Math.abs(totals.loadWork) + positiveHistoryWork - negativeHistoryWork;
  const normalizedEnergyResidual = maximumCumulativeResidual / scale;
  const run = {file: inputs[index], dt: d.dt, intervals: d.rows.length - 1, impulses, totals, byMethod, positiveInputWork, negativeInputWork,
    positiveHistoryWork, negativeHistoryWork, maximumCumulativeResidual, maximumStepResidual, normalizedEnergyResidual,
    maximumMomentumResidual, maximumRodWorkError, maximumBackwardEulerParityError, minimumSliderDerivative,
    minimumInputForce, maximumInputForce, minimumRodImpulse, maximumRodImpulse};
  runs.push(run);
  if (normalizedEnergyResidual > 2e-5 || maximumMomentumResidual > 1e-7 || maximumRodWorkError > 1e-9 || maximumBackwardEulerParityError > 1e-10
    || minimumSliderDerivative < loads.inputTransmissionBound.minimumAbsSliderDerivative) issues.push({kind: 'energy-or-input-balance', file: inputs[index]});
}
for (const source of sources) assert.equal(hash(source.file), source.sha256, source.file);
const report = {movement: 83, status: 'method-specific-five-family-input-energy-audit', passed: issues.length === 0,
  productionChanged: false, mechanicsPassed: false, candidate: 'conformal-guide', controls, runs, issues, sources,
  formulaEvidence: {file: formulaFile, formulas: formula.formulas, identicalMasses: true}, inputTransmissionBound: loads.inputTransmissionBound,
  qualification: 'The unchanged full mesh energy and input momentum are evaluated with each method’s difference operator. BDF equation impulses are multiplied by dt/(2*dt/3) for endpoint work quadrature. Signed velocity, spring and energy history exchanges are reported explicitly, not labelled physical damping. Analytic quadratic controls and backward-Euler parity check the algebra. The residual measures remaining input/geometry quadrature error; it is not a continuum motion bound. Force estimates are from normalized rigid-body endpoint equations, not material stress or finite impact-force predictions. Motion refinement, repeat behavior and production integration remain separate.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined, runs: runs.map(({byMethod, ...run}) => run)});
if (!report.passed) process.exitCode = 1;
