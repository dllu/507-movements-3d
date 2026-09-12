import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeTreadleRatchetCandidate} from './lib/treadle-ratchet-candidate.mjs';
import {makeTreadleRatchetDynamics} from './lib/treadle-ratchet-dynamics.mjs';
import {makeTreadleRatchetLoads} from './lib/treadle-ratchet-loads.mjs';
const inputs = JSON.parse(process.env.PROBE_INPUTS ?? '["artifacts/review/082-source-seat-dynamics.json"]');
const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/082-first-linkage-loads.json';
const first = JSON.parse(fs.readFileSync(inputs[0])), candidate = makeTreadleRatchetCandidate(first.geometry), u = candidate.root.userData;
const physics = makeTreadleRatchetDynamics(candidate, first.parameters), loads = makeTreadleRatchetLoads(candidate, physics);
const files = [...inputs, 'scripts/check-treadle-ratchet-loads.mjs', 'scripts/lib/treadle-ratchet-loads.mjs',
  'scripts/lib/treadle-ratchet-dynamics.mjs', 'scripts/lib/treadle-ratchet-input.mjs', 'scripts/lib/treadle-ratchet-contact.mjs',
  'scripts/lib/treadle-ratchet-candidate.mjs', 'scripts/lib/treadle-ratchet-linkage.mjs', 'src/simulation/finite-plate-geometry.js'];
const sources = files.map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt';
  fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const formulas = {poses: 0, tetrahedra: 0, kineticError: 0, potentialError: 0, inertiaDerivativeError: 0, potentialDerivativeError: 0, inputPositionError: 0};
const tetra = [], meshes = Object.entries(u.parts).filter(([name]) => loads.masses[u.families[name]]), issues = [];
for (const [name, mesh] of meshes) {
  const g = mesh.geometry, p = g.attributes.position, index = g.index;
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const v = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j));
    tetra.push({name, points: [new THREE.Vector3(), ...v], mass: v[0].dot(v[1].clone().cross(v[2])) / 6 * physics.parameters.density});
  }
}
formulas.tetrahedra = tetra.length;
for (let i = 0; i < 17; i++) {
  const row = {time: (i + .17) * 4 / 17, x: [.021 * i, .2 * Math.sin(i), -.15 * Math.cos(i)], v: [.12 * Math.cos(i), .31 * Math.sin(i + .1), -.27 * Math.cos(i + .3)]};
  const expected = loads.state(row), h = 1e-5, matrices = [];
  for (const delta of [-h, 0, h]) {
    candidate.setState({time: row.time + delta, wheelAngle: row.x[0] + delta * row.v[0],
      pawlAngles: row.x.slice(1).map((v, j) => v + delta * row.v[j + 1])});
    matrices.push(Object.fromEntries(meshes.map(([name, mesh]) => [name, mesh.matrixWorld.clone()])));
  }
  let kinetic = 0, potential = 0;
  for (const t of tetra) {
    const points = t.points.map(p => {
      const a = p.clone().applyMatrix4(matrices[0][t.name]), b = p.clone().applyMatrix4(matrices[1][t.name]), c = p.clone().applyMatrix4(matrices[2][t.name]);
      return {point: b, velocity: c.sub(a).multiplyScalar(.5 / h)};
    });
    const total = points.reduce((s, p) => s.add(p.velocity), new THREE.Vector3());
    kinetic += t.mass * (total.lengthSq() + points.reduce((s, p) => s + p.velocity.lengthSq(), 0)) / 40;
    potential += t.mass * 9.81 * points.reduce((s, p) => s + p.point.y, 0) / 4;
  }
  for (let j = 0; j < 2; j++) {
    const l = expected.limbs[j], a = loads.limb(j, l.q - h), b = loads.limb(j, l.q + h);
    potential -= physics.parameters.preload[j] * (row.x[j + 1] - l.beta);
    formulas.inertiaDerivativeError = Math.max(formulas.inertiaDerivativeError, Math.abs((b.M - a.M) / (2 * h) - l.Mq));
    const springDerivative = physics.parameters.preload[j] * l.betaQ;
    formulas.potentialDerivativeError = Math.max(formulas.potentialDerivativeError, Math.abs((b.U - a.U) / (2 * h) + springDerivative - l.Uq));
    formulas.inputPositionError = Math.max(formulas.inputPositionError, ...l.P.map((v, axis) => Math.abs(v - expected.k.pawls[j].pivot[axis])));
  }
  formulas.poses++;
  formulas.kineticError = Math.max(formulas.kineticError, Math.abs(kinetic - expected.kinetic));
  formulas.potentialError = Math.max(formulas.potentialError, Math.abs(potential - expected.potential));
}
if (Math.max(formulas.kineticError, formulas.potentialError, formulas.inertiaDerivativeError, formulas.potentialDerivativeError) > 2e-6 || formulas.inputPositionError > 1e-12) issues.push({kind: 'mesh-or-derivative-formulas', formulas});
const runs = [];
for (const file of inputs) {
  const data = JSON.parse(fs.readFileSync(file));
  assert.deepEqual(data.parameters, first.parameters); assert.deepEqual(data.geometry, first.geometry); assert.equal(data.failures.length, 0);
  const totals = Object.fromEntries(['change', 'inputWork', 'footWork', 'dampingWork', 'velocityChangeLoss', 'contactVelocityWork', 'correctedResidual'].map(key => [key, 0]));
  let minimumStrapForce = Infinity, maximumStrapForce = 0, minimumFootImpulse = Infinity, maximumFootForce = 0;
  let maximumMomentumResidual = 0, maximumStrapPowerResidual = 0, minimumVelocityChangeLoss = Infinity, missing = 0;
  let oneFootNegativeTension = 0, oneFootPullingForce = 0, negativeFootWork = 0, positiveFootWork = 0, cumulative = 0, maximumCumulativeResidual = 0;
  const samples = [];
  for (let i = 1; i < data.rows.length; i++) {
    const before = data.rows[i - 1], after = data.rows[i], dt = after.time - before.time;
    const rows = new Map(physics.constraints(after.x, after.time).rows.map(r => [r.id, r])), contacts = [];
    for (const c of after.contacts) {
      const actual = rows.get(c.id); if (!actual) {missing++; continue;}
      contacts.push({...actual, impulse: c.impulse});
    }
    const r = loads.interval(before, after, contacts), F = physics.forces(after.x, after.time);
    for (const key of Object.keys(totals)) totals[key] += r[key];
    minimumStrapForce = Math.min(minimumStrapForce, r.strapImpulse / dt); maximumStrapForce = Math.max(maximumStrapForce, r.strapImpulse / dt);
    minimumFootImpulse = Math.min(minimumFootImpulse, ...r.footImpulse); maximumFootForce = Math.max(maximumFootForce, ...r.footImpulse.map(v => v / dt));
    maximumStrapPowerResidual = Math.max(maximumStrapPowerResidual, Math.abs(r.strapPowerResidual));
    minimumVelocityChangeLoss = Math.min(minimumVelocityChangeLoss, r.velocityChangeLoss);
    if (r.oneFootStrapImpulse < -1e-9) oneFootNegativeTension++;
    if (r.descendingFootImpulse < -1e-9) oneFootPullingForce++;
    if (r.footWork < 0) negativeFootWork += r.footWork; else positiveFootWork += r.footWork;
    cumulative += r.correctedResidual; maximumCumulativeResidual = Math.max(maximumCumulativeResidual, Math.abs(cumulative));
    for (let j = 0; j < 3; j++) {
      const residual = physics.parameters.inertia[j] * (after.v[j] - before.v[j]) + dt * physics.parameters.damping[j] * after.v[j] - dt * F[j]
        - contacts.reduce((s, c) => s + c.impulse * c.J[j], 0);
      maximumMomentumResidual = Math.max(maximumMomentumResidual, Math.abs(residual));
    }
    if (i % 500 === 0) {samples.push({time: after.time, strapForce: r.strapImpulse / dt, footForce: r.footImpulse.map(v => v / dt), cumulativeResidual: cumulative}); console.log(samples.at(-1));}
  }
  const normalizedEnergyResidual = maximumCumulativeResidual / (Math.abs(totals.inputWork) + totals.dampingWork + totals.velocityChangeLoss);
  const run = {file, dt: data.dt, intervals: data.rows.length - 1, totals, normalizedEnergyResidual, maximumCumulativeResidual,
    minimumStrapForce, maximumStrapForce, minimumFootImpulse, maximumFootForce, maximumMomentumResidual, maximumStrapPowerResidual,
    minimumVelocityChangeLoss, oneFootNegativeTension, oneFootPullingForce, negativeFootWork, positiveFootWork, missing, samples};
  runs.push(run);
  if (missing || maximumMomentumResidual > 1e-7 || maximumStrapPowerResidual > 1e-7 || minimumStrapForce <= 0 || minimumFootImpulse < -1e-9 || minimumVelocityChangeLoss < -1e-10) issues.push({kind: 'loading-balance', file});
}
const last = runs.at(-1), refinement = runs.length < 2 ? null : last.maximumCumulativeResidual < runs.at(-2).maximumCumulativeResidual;
if (refinement === false || (refinement && last.normalizedEnergyResidual > .001)) issues.push({kind: 'energy-refinement', refinement, residual: last.normalizedEnergyResidual});
const report = {movement: 82, status: 'rigid-linkage-energy-and-foot-loading-study', productionChanged: false, mechanicsPassed: false,
  passed: issues.length === 0, refinement, formulas, runs, masses: loads.masses, issues, sources,
  qualification: loads.qualification + ' A positive minimum strap tension and downward forces at both feet establish a feasible ideal loading, allowing an ascending foot to absorb work. The descending-foot-only alternative is reported separately. Energy residual includes backward-Euler velocity-change loss and endpoint contact work; two or more runs are needed to assess refinement.'};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, runs: runs.map(r => ({...r, samples: undefined})), sources: undefined, masses: undefined});
if (!report.passed) process.exitCode = 1;
