import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
import {makeSpringSectorDynamics} from './lib/spring-sector-dynamics.mjs';
import {makeSpringSectorLoads} from './lib/spring-sector-loads.mjs';
import {makeSpringSectorSavedContact} from './lib/spring-sector-saved-contact.mjs';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';

const inputs = JSON.parse(process.env.PROBE_INPUTS ?? '["artifacts/review/083-continuous-quarter-ms-dynamics.json","artifacts/review/083-continuous-eighth-ms-dynamics.json"]');
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-input-loading-study';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const data = inputs.map(file => JSON.parse(fs.readFileSync(file)));
for (const d of data) {
  assert.equal(d.failures.length, 0); assert.deepEqual(d.parameters, data[0].parameters);
  for (const s of d.sources) assert.equal(hash(s.file), s.sha256, s.file);
}
const model = makeSpringSectorCandidate(), u = model.root.userData, physics = makeSpringSectorDynamics(model, data[0].parameters);
const loads = makeSpringSectorLoads(model, physics), savedContact = makeSpringSectorSavedContact(model, physics);
const files = [...new Set([...inputs, 'scripts/check-spring-sector-loads.mjs', 'scripts/lib/spring-sector-loads.mjs',
  'scripts/lib/spring-sector-saved-contact.mjs', ...data.flatMap(d => d.sources.map(s => s.file))])];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const issues = [], formulas = {poses: 0, tetrahedra: 0, kineticError: 0, potentialError: 0, momentumError: 0,
  rodPositionError: 0, rodAngleError: 0, rodDerivativeError: 0, inertiaDerivativeError: 0, potentialDerivativeError: 0};
const meshes = Object.entries(u.parts).filter(([name]) => loads.masses[u.families[name]]), tetrahedra = [];
for (const [name, mesh] of meshes) for (const triangle of surfaceTriangles(mesh.geometry)) {
  const v = [triangle.a, triangle.b, triangle.c];
  tetrahedra.push({name, points: [new THREE.Vector3(), ...v], mass: physics.parameters.density * v[0].dot(v[1].clone().cross(v[2])) / 6});
}
formulas.tetrahedra = tetrahedra.length;
for (let i = 0; i < 17; i++) {
  const row = {time: (i + .17) * 8 / 17, x: [.081 * i, .06 + .03 * Math.sin(i), .06 + .03 * Math.cos(i)],
    v: [.12 * Math.cos(i), .31 * Math.sin(i + .1), -.27 * Math.cos(i + .3)]};
  const expected = loads.state(row), h = 1e-5, matrices = [], qMatrices = [];
  for (const delta of [-h, 0, h]) {
    model.setState({shaftAngle: physics.input(row.time + delta).q, wheelAngle: row.x[0] + delta * row.v[0],
      lifts: row.x.slice(1).map((v, j) => v + delta * row.v[j + 1])});
    matrices.push(Object.fromEntries(meshes.map(([name, mesh]) => [name, mesh.matrixWorld.clone()])));
  }
  for (const delta of [-h, h]) {
    model.setState({shaftAngle: expected.k.q + delta, wheelAngle: row.x[0], lifts: row.x.slice(1)});
    qMatrices.push(Object.fromEntries(meshes.map(([name, mesh]) => [name, mesh.matrixWorld.clone()])));
  }
  let kinetic = 0, potential = 0, momentum = 0;
  for (const tetra of tetrahedra) {
    const points = tetra.points.map(p => ({point: p.clone().applyMatrix4(matrices[1][tetra.name]),
      velocity: p.clone().applyMatrix4(matrices[2][tetra.name]).sub(p.clone().applyMatrix4(matrices[0][tetra.name])).multiplyScalar(.5 / h),
      derivative: p.clone().applyMatrix4(qMatrices[1][tetra.name]).sub(p.clone().applyMatrix4(qMatrices[0][tetra.name])).multiplyScalar(.5 / h)}));
    const velocity = points.reduce((s, p) => s.add(p.velocity), new THREE.Vector3());
    const derivative = points.reduce((s, p) => s.add(p.derivative), new THREE.Vector3());
    kinetic += tetra.mass / 40 * (velocity.lengthSq() + points.reduce((s, p) => s + p.velocity.lengthSq(), 0));
    momentum += tetra.mass / 20 * (velocity.dot(derivative) + points.reduce((s, p) => s + p.velocity.dot(p.derivative), 0));
    potential += tetra.mass * physics.parameters.gravity / 4 * points.reduce((s, p) => s + p.point.y, 0);
  }
  for (let j = 0; j < 2; j++) potential += .5 * physics.parameters.stiffness[j] * (row.x[j + 1] - physics.parameters.freeLift[j]) ** 2;
  formulas.kineticError = Math.max(formulas.kineticError, Math.abs(kinetic - expected.kinetic));
  formulas.potentialError = Math.max(formulas.potentialError, Math.abs(potential - expected.potential));
  formulas.momentumError = Math.max(formulas.momentumError, Math.abs(momentum - expected.momentum));
  const q = expected.k.q, a = loads.rodAt(q - h), b = loads.rodAt(q + h), rod = expected.rod, actual = u.linkage.atAngle(q);
  formulas.rodPositionError = Math.max(formulas.rodPositionError, Math.abs(rod.slider - actual.slider));
  formulas.rodAngleError = Math.max(formulas.rodAngleError, Math.abs(rod.angle - actual.angleDelta));
  formulas.rodDerivativeError = Math.max(formulas.rodDerivativeError, Math.abs((b.slider - a.slider) / (2 * h) - rod.sliderQ),
    Math.abs((b.sliderQ - a.sliderQ) / (2 * h) - rod.sliderQQ), Math.abs((b.angle - a.angle) / (2 * h) - rod.aq),
    Math.abs((b.aq - a.aq) / (2 * h) - rod.aqq));
  formulas.inertiaDerivativeError = Math.max(formulas.inertiaDerivativeError, Math.abs((b.M - a.M) / (2 * h) - rod.Mq));
  formulas.potentialDerivativeError = Math.max(formulas.potentialDerivativeError, Math.abs((b.U - a.U) / (2 * h) - rod.Uq));
  formulas.poses++;
}
if (Object.entries(formulas).some(([k, v]) => k.endsWith('Error') && v > 2e-6)) issues.push({kind: 'mesh-or-derivative-formulas', formulas});
const contactsCheck = {states: 0, contacts: 0, gapError: 0, jacobianError: 0, inputError: 0, missing: 0};
for (const d of data) for (let sample = 1; sample <= 128; sample++) {
  const row = d.rows[Math.floor((d.rows.length - 1) * sample / 128)];
  const full = new Map(physics.constraints(row.x, row.time).rows.map(r => [r.id, r])); contactsCheck.states++;
  for (const s of row.contacts) {
    const a = full.get(s.id), b = savedContact.at(row, s); contactsCheck.contacts++;
    if (!a) {contactsCheck.missing++; continue;}
    contactsCheck.gapError = Math.max(contactsCheck.gapError, Math.abs(a.gap - b.gap));
    contactsCheck.jacobianError = Math.max(contactsCheck.jacobianError, ...a.J.map((v, i) => Math.abs(v - b.J[i])));
    contactsCheck.inputError = Math.max(contactsCheck.inputError, Math.abs(b.inputJacobian + (a.feature?.gradient.shaft ?? 0)));
  }
}
if (contactsCheck.missing || Math.max(contactsCheck.gapError, contactsCheck.jacobianError, contactsCheck.inputError) > 1e-9)
  issues.push({kind: 'saved-contact-reconstruction', contactsCheck});
const runs = [];
for (const [index, d] of data.entries()) {
  const totals = Object.fromEntries(['change', 'inputWork', 'rodWork', 'dampingWork', 'loadWork', 'velocityChangeLoss',
    'springChangeLoss', 'contactVelocityWork', 'correctedResidual'].map(k => [k, 0]));
  let cumulative = 0, maximumCumulativeResidual = 0, maximumMomentumResidual = 0, maximumRodWorkError = 0;
  let minimumVelocityLoss = Infinity, minimumSliderDerivative = Infinity, minimumInputForce = Infinity, maximumInputForce = -Infinity;
  let minimumRodImpulse = Infinity, maximumRodImpulse = -Infinity;
  let impulses = 0, negativeInputWork = 0, positiveInputWork = 0; const samples = [], forceExtrema = {};
  for (let i = 1; i < d.rows.length; i++) {
    const before = d.rows[i - 1], after = d.rows[i], dt = after.time - before.time;
    const contacts = after.contacts.map(s => savedContact.at(after, s));
    assert(contacts.every(c => Number.isFinite(c.impulse) && c.impulse >= 0)); impulses += contacts.length;
    const r = loads.interval(before, after, contacts), forces = physics.forces(after.x, after.time);
    for (const key of Object.keys(totals)) totals[key] += r[key];
    cumulative += r.correctedResidual; maximumCumulativeResidual = Math.max(maximumCumulativeResidual, Math.abs(cumulative));
    maximumRodWorkError = Math.max(maximumRodWorkError, Math.abs(r.rodWork - r.inputWork));
    minimumVelocityLoss = Math.min(minimumVelocityLoss, r.velocityChangeLoss);
    minimumSliderDerivative = Math.min(minimumSliderDerivative, Math.abs(r.sliderQ));
    const event = {time: after.time, force: r.inputForce, rodImpulse: r.rodImpulse, inputImpulse: r.inputImpulse,
      velocityChange: after.v.map((v, j) => v - before.v[j]), contacts: after.contacts.map(c => c.id)};
    if (r.inputForce < minimumInputForce) {minimumInputForce = r.inputForce; forceExtrema.minimum = event;}
    if (r.inputForce > maximumInputForce) {maximumInputForce = r.inputForce; forceExtrema.maximum = event;}
    minimumRodImpulse = Math.min(minimumRodImpulse, r.rodImpulse); maximumRodImpulse = Math.max(maximumRodImpulse, r.rodImpulse);
    if (r.inputWork >= 0) positiveInputWork += r.inputWork; else negativeInputWork += r.inputWork;
    for (let j = 0; j < 3; j++) {
      const residual = physics.parameters.inertia[j] * (after.v[j] - before.v[j]) - dt * (forces[j] - physics.parameters.damping[j] * after.v[j])
        - contacts.reduce((sum, c) => sum + c.impulse * c.J[j], 0);
      maximumMomentumResidual = Math.max(maximumMomentumResidual, Math.abs(residual));
    }
    if (i % 2000 === 0) samples.push({time: after.time, inputForce: r.inputForce, cumulativeResidual: cumulative});
  }
  const scale = positiveInputWork - negativeInputWork + totals.dampingWork + totals.velocityChangeLoss + totals.springChangeLoss + Math.abs(totals.loadWork);
  const normalizedEnergyResidual = maximumCumulativeResidual / scale;
  const run = {file: inputs[index], dt: d.dt, intervals: d.rows.length - 1, impulses, totals, positiveInputWork, negativeInputWork,
    maximumCumulativeResidual, normalizedEnergyResidual, maximumMomentumResidual, maximumRodWorkError, minimumVelocityLoss,
    minimumSliderDerivative, minimumInputForce, maximumInputForce, minimumRodImpulse, maximumRodImpulse, forceExtrema, samples};
  runs.push(run); console.log({...run, samples: undefined});
  assert(minimumSliderDerivative >= loads.inputTransmissionBound.minimumAbsSliderDerivative);
  if (maximumMomentumResidual > 1e-7 || maximumRodWorkError > 1e-9 || minimumVelocityLoss < -1e-10 || !(minimumSliderDerivative > .1))
    issues.push({kind: 'loading-balance', file: inputs[index]});
}
const refinement = runs.length < 2 ? null : runs.at(-1).maximumCumulativeResidual < runs.at(-2).maximumCumulativeResidual;
if (refinement === false || runs.at(-1).normalizedEnergyResidual > .001) issues.push({kind: 'energy-refinement', refinement});
for (const s of sources) assert.equal(hash(s.file), s.sha256, s.file);
const report = {movement: 83, status: 'rigid-family-input-loading-and-energy', productionChanged: false, mechanicsPassed: false,
  passed: issues.length === 0, formulas, contactsCheck, refinement, runs, masses: loads.masses,
  inputTransmissionBound: loads.inputTransmissionBound, issues, sources,
  qualification: loads.qualification + ' Signed input force permits both pushing and pulling, and the drive can absorb work. Energy accounting explicitly includes backward-Euler velocity and spring-position losses and endpoint contact work. Refinement of this balance does not establish trajectory convergence.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({passed: report.passed, formulas, contactsCheck, refinement, issues}); if (!report.passed) process.exitCode = 1;
