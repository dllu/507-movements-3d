import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeSelectorRackFreeCandidate} from './lib/selector-rack-free-candidate.mjs';
import {makeSelectorRackDynamics} from './lib/selector-rack-dynamics.mjs';
import {surfaceTriangles, solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport, verifyStudySources, freezeStudySources} from './lib/study-report-io.mjs';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/084-planar-corrected-guide-pulses.json.gz';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/084-first-planar-reactions';
const data = readStudyReport(input); verifyStudySources(data.sources); assert.equal(data.failures.length, 0);
const model = makeSelectorRackFreeCandidate(), u = model.root.userData, physics = makeSelectorRackDynamics(model, data.parameters);
const bodies = new Map(physics.contact.bodies.map(b => [b.name, b]));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1], cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const rotate = (p, q) => [Math.cos(q) * p[0] - Math.sin(q) * p[1], Math.sin(q) * p[0] + Math.cos(q) * p[1]];
const transformed = (points, q, translation) => points.map(p => rotate(p, q).map((v, i) => v + translation[i]));
const index = new Map();
function boundary(mesh, point, outward) {
  if (!index.has(mesh.name)) index.set(mesh.name, {solid: solidSurface(mesh.geometry), triangles: surfaceTriangles(mesh.geometry).map(t =>
    ({t, normal: t.getNormal(new THREE.Vector3()), box: new THREE.Box3().setFromPoints([t.a, t.b, t.c])}))});
  const {solid, triangles} = index.get(mesh.name), inverse = mesh.matrixWorld.clone().invert();
  const local = new THREE.Vector3(...point, 0).applyMatrix4(inverse), target = new THREE.Vector3(...outward, 0).transformDirection(inverse);
  const distance = solid.distance(local), normals = [], closest = new THREE.Vector3(); let supportingError = 0, nonplanar = 0;
  for (const {t, normal, box} of triangles) {
    if (box.distanceToPoint(local) > 1e-7 || t.closestPointToPoint(local, closest).distanceTo(local) > 1e-7) continue;
    if (!normals.some(n => n.distanceTo(normal) < 1e-10)) normals.push(normal);
    nonplanar = Math.max(nonplanar, Math.abs(normal.z));
    for (const p of [t.a, t.b, t.c]) supportingError = Math.max(supportingError, p.clone().sub(local).dot(target));
  }
  let cone = Infinity;
  for (const [i, a] of normals.entries()) {
    cone = Math.min(cone, a.clone().multiplyScalar(Math.max(0, a.dot(target))).distanceTo(target));
    for (const b of normals.slice(i + 1)) {
      const det = a.x * b.y - a.y * b.x; if (Math.abs(det) < 1e-12) continue;
      const wa = (target.x * b.y - target.y * b.x) / det, wb = (a.x * target.y - a.y * target.x) / det;
      if (wa < -1e-8 || wb < -1e-8) continue;
      cone = Math.min(cone, a.clone().multiplyScalar(Math.max(0, wa)).addScaledVector(b, Math.max(0, wb)).distanceTo(target));
    }
  }
  return {distance, cone, supportingError, nonplanar, faces: normals.length};
}
const counts = {intervals: 0, reactions: 0, boundaries: 0}, errors = {tangent: 0, gap: 0, normal: 0, boundary: 0, cone: 0,
  supporting: 0, jacobian: 0, input: 0, momentum: 0, position: 0, energyIdentity: 0};
const issues = [], totals = {inputWork: 0, camWork: 0, selectorWork: 0, damping: 0, plasticStepLoss: 0, contactDriftWork: 0, energyChange: 0};
const record = issue => {if (issues.length < 40) issues.push(issue);};
for (let i = 1; i < data.rows.length; i++) {
  const r = data.rows[i], before = data.rows[i - 1], k = physics.input(r.time), dt = r.time - before.time;
  assert(dt > 0 && r.x.every(Number.isFinite) && r.v.every(Number.isFinite));
  model.setState({camAngle: k.camAngle, selectorY: k.selectorY, center: r.x.slice(0, 2), frameAngle: r.x[2]});
  const impulse = [0, 0, 0]; let camWork = 0, selectorWork = 0, driftWork = 0; counts.intervals++;
  for (const saved of r.contacts) {
    assert(saved.impulse > 0 && Number.isFinite(saved.impulse)); counts.reactions++;
    const body = bodies.get(saved.key), A = transformed(physics.contact.frame[saved.frameCell].points, r.x[2], r.x.slice(0, 2));
    const B = transformed(body.cells[saved.bodyCell].points, body.input === 'cam' ? k.camAngle : 0, [0, body.input === 'selector' ? k.selectorY : 0]);
    const edgePoints = saved.owner === 'frame' ? A : B, p = edgePoints[saved.edge], q = edgePoints[(saved.edge + 1) % edgePoints.length];
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]), n = [-(q[1] - p[1]) / length * saved.sign, (q[0] - p[0]) / length * saved.sign];
    const t = [-n[1], n[0]], av = A.map(p => dot(p, n)), bv = B.map(p => dot(p, n)), low = Math.min(...av), high = Math.max(...bv);
    const faceA = A.filter((_, j) => Math.abs(av[j] - low) < 1e-12).map(p => dot(p, t));
    const faceB = B.filter((_, j) => Math.abs(bv[j] - high) < 1e-12).map(p => dot(p, t));
    const tangent = -saved.J[2] - cross(r.x.slice(0, 2), n), lo = Math.max(Math.min(...faceA), Math.min(...faceB)), hi = Math.min(Math.max(...faceA), Math.max(...faceB));
    const tangentError = Math.max(0, lo - tangent, tangent - hi), pointA = n.map((v, j) => low * v + tangent * t[j]), pointB = n.map((v, j) => high * v + tangent * t[j]);
    const J = [...n, cross(pointA.map((v, j) => v - r.x[j]), n)], camJacobian = body.input === 'cam' ? -cross(pointB, n) : 0;
    const selectorJacobian = body.input === 'selector' ? -n[1] : 0, normalError = Math.hypot(...n.map((v, j) => v - saved.normal[j]));
    const inputError = Math.max(Math.abs(camJacobian - saved.camJacobian), Math.abs(selectorJacobian - saved.selectorJacobian));
    const name = saved.key === 'cam' ? 'singleWorkingCam' : saved.key.startsWith('pin') ? 'suspensionPin' + saved.key.slice(3)
      : saved.key === 'shaft' ? 'fixedCamAxle' : 'rackGuide' + saved.key[5];
    const checks = [boundary(u.parts.slottedRackFrame, pointA, n.map(v => -v)), boundary(u.parts[name], pointB, n)]; counts.boundaries += 2;
    for (const check of checks) {errors.boundary = Math.max(errors.boundary, check.distance); errors.cone = Math.max(errors.cone, check.cone); errors.supporting = Math.max(errors.supporting, check.supportingError);}
    errors.tangent = Math.max(errors.tangent, tangentError); errors.gap = Math.max(errors.gap, Math.abs(low - high)); errors.normal = Math.max(errors.normal, normalError);
    errors.jacobian = Math.max(errors.jacobian, ...J.map((v, j) => Math.abs(v - saved.J[j]))); errors.input = Math.max(errors.input, inputError);
    if (tangentError > 2e-7 || Math.abs(low - high) > 2e-7 || inputError > 2e-6 || normalError > 1e-8 ||
      checks.some(c => c.distance > 1e-7 || c.cone > 2e-5 || c.supportingError > 2e-7 || c.nonplanar > 1e-7))
      record({kind: 'reaction', index: i, time: r.time, id: saved.id, tangentError, gap: low - high, inputError, checks, pointA, pointB});
    J.forEach((v, j) => impulse[j] += v * saved.impulse);
    const inputNormalVelocity = camJacobian * k.camVelocity + selectorJacobian * k.selectorVelocity;
    camWork -= camJacobian * k.camVelocity * saved.impulse; selectorWork -= selectorJacobian * k.selectorVelocity * saved.impulse;
    driftWork += (J.reduce((sum, v, j) => sum + v * r.v[j], 0) + inputNormalVelocity) * saved.impulse;
  }
  const F = physics.forces(), {inertia, damping, gravity} = physics.parameters;
  const residual = r.v.map((v, j) => inertia[j] * (v - before.v[j]) + dt * (damping[j] * v - F[j]) - impulse[j]);
  errors.momentum = Math.max(errors.momentum, ...residual.map(Math.abs));
  errors.position = Math.max(errors.position, ...r.x.map((v, j) => Math.abs(v - before.x[j] - dt * r.v[j])));
  const energyChange = r.v.reduce((sum, v, j) => sum + inertia[j] * (v * v - before.v[j] ** 2) / 2, gravity * (r.x[1] - before.x[1]));
  const drag = dt * r.v.reduce((sum, v, j) => sum + damping[j] * v * v, 0);
  const loss = r.v.reduce((sum, v, j) => sum + inertia[j] * (v - before.v[j]) ** 2 / 2, 0);
  const energyResidual = energyChange - camWork - selectorWork + drag + loss - driftWork;
  errors.energyIdentity = Math.max(errors.energyIdentity, Math.abs(energyResidual));
  totals.energyChange += energyChange; totals.camWork += camWork; totals.selectorWork += selectorWork; totals.inputWork += camWork + selectorWork;
  totals.damping += drag; totals.plasticStepLoss += loss; totals.contactDriftWork += driftWork;
  if (Math.max(...residual.map(Math.abs)) > 1e-7 || Math.abs(energyResidual) > 1e-8) record({kind: 'balance', index: i, residual, energyResidual});
}
const sources = freezeStudySources([input, 'scripts/check-selector-rack-reactions.mjs', ...data.sources.map(s => s.file)], prefix);
const report = {movement: 84, status: 'free-planar-rack-spatial-reaction-and-energy-audit', passed: !issues.length && counts.reactions > 0,
  productionChanged: false, mechanicsPassed: false, input, counts, errors, totals, issues, sources,
  qualification: 'Stored generalized impulses determine a required point-force location, which must lie in both supporting-feature intervals and on both complete mesh boundaries with admissible outward normals. Frame moment, prescribed-input work and backward-Euler momentum/energy identities are reconstructed. Contact drift work is reported rather than called damping. This does not establish time-step accuracy, continuous clearance or material stresses.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined}); if (!report.passed) process.exitCode = 1;
