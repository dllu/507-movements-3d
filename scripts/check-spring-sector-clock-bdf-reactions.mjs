import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {readStudyReport, freezeStudySources} from './lib/study-report-io.mjs';
import * as THREE from 'three';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
import {makeSpringSectorFastDynamics} from './lib/spring-sector-fast-dynamics.mjs';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/083-clock-bdf-tenth-us-full-quarter-ms.json';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-clock-bdf-tenth-us-full-quarter-ms-reactions';
const stride = Number(process.env.PROBE_STRIDE ?? 1);
const startIndex = Number(process.env.PROBE_START_INDEX ?? 1), requestedEndIndex = Number(process.env.PROBE_END_INDEX ?? Number.MAX_SAFE_INTEGER);
const supportTolerance = Number(process.env.PROBE_SUPPORT_TOLERANCE ?? 1e-12);
assert(Number.isInteger(startIndex) && startIndex >= 1 && Number.isInteger(requestedEndIndex) && requestedEndIndex > startIndex);
assert(supportTolerance > 0 && Number.isFinite(supportTolerance));
assert(Number.isInteger(stride) && stride > 0);
const data = readStudyReport(input), model = makeSpringSectorCandidate();
const endIndex = Math.min(requestedEndIndex, data.rows.length);
const physics = makeSpringSectorFastDynamics(model, data.parameters), u = model.root.userData;
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(data.failures.length, 0);
for (const source of data.sources) assert.equal(hash(source.file), source.sha256, source.file);
const files = [...new Set([input, 'scripts/check-spring-sector-clock-bdf-reactions.mjs', 'scripts/lib/spring-sector-fast-dynamics.mjs', 'scripts/lib/spring-sector-fast-contact.mjs', ...data.sources.map(s => s.file)])];
const sources = freezeStudySources([...files, 'scripts/lib/study-report-io.mjs'], prefix);
const v3 = a => new THREE.Vector3(...a), cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
const sub2 = (a, b) => a.map((v, i) => v - b[i]);
const distance2 = (a, b) => Math.hypot(...sub2(a, b));
function hull(points) {
  const sorted = points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const unique = sorted.filter((p, i) => !i || distance2(p, sorted[i - 1]) > 1e-10);
  if (unique.length < 3) return unique;
  const chain = values => {
    const out = [];
    for (const p of values) {
      while (out.length > 1 && cross2(sub2(out.at(-1), out.at(-2)), sub2(p, out.at(-1))) <= 1e-14) out.pop();
      out.push(p);
    }
    return out;
  };
  return [...chain(unique).slice(0, -1), ...chain([...unique].reverse()).slice(0, -1)];
}
const segments = points => points.length === 1 ? [[points[0], points[0]]]
  : points.map((p, i) => [p, points[(i + 1) % points.length]]);
function closestFeatures(a, b) {
  let best = {distance: Infinity};
  const consider = (A, B) => {const distance = distance2(A, B); if (distance < best.distance) best = {A, B, distance};};
  const contained = (point, polygon) => polygon.length >= 3 && segments(polygon)
    .every(([a, b]) => cross2(sub2(b, a), sub2(point, a)) >= -1e-13);
  for (const A of a) {
    if (contained(A, b)) consider(A, A);
    for (const [B, C] of segments(b)) {
      const d = sub2(C, B), length = d[0] ** 2 + d[1] ** 2;
      const t = length ? Math.max(0, Math.min(1, sub2(A, B).reduce((s, v, i) => s + v * d[i], 0) / length)) : 0;
      consider(A, B.map((v, i) => v + t * d[i]));
    }
  }
  for (const B of b) {
    if (contained(B, a)) consider(B, B);
    for (const [A, C] of segments(a)) {
      const d = sub2(C, A), length = d[0] ** 2 + d[1] ** 2;
      const t = length ? Math.max(0, Math.min(1, sub2(B, A).reduce((s, v, i) => s + v * d[i], 0) / length)) : 0;
      consider(A.map((v, i) => v + t * d[i]), B);
    }
  }
  for (const [A, B] of segments(a)) for (const [C, D] of segments(b)) {
    const r = sub2(B, A), s = sub2(D, C), denominator = cross2(r, s);
    if (Math.abs(denominator) < 1e-14) continue;
    const t = cross2(sub2(C, A), s) / denominator, w = cross2(sub2(C, A), r) / denominator;
    if (t >= 0 && t <= 1 && w >= 0 && w <= 1) {const p = A.map((v, i) => v + t * r[i]); consider(p, p);}
  }
  return best;
}

// Reconstruct a common contact point from the supporting vertex/edge/face
// hulls. The solver stores only a separating axis, not these contact points.
function contactPoints(row, side, state) {
  const n = v3(row.feature.limiting.normal), sector = u.parts[side ? 'rearSector' : 'frontSector'];
  const tooth = u.parts[row.feature.tooth], toothCell = physics.contact.teeth.find(t => t.name === tooth.name).cell;
  const A = physics.contact.cells[side][row.feature.cell].vertices.map(p => v3(p).applyMatrix4(sector.matrixWorld));
  const B = toothCell.vertices.map(p => v3(p).applyMatrix4(tooth.matrixWorld));
  const low = Math.min(...A.map(p => p.dot(n))), high = Math.max(...B.map(p => p.dot(n)));
  const reference = Math.abs(n.x) < .8 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const tangent = reference.addScaledVector(n, -reference.dot(n)).normalize(), other = n.clone().cross(tangent);
  const project = points => hull(points.map(p => [p.dot(tangent), p.dot(other)]));
  const selectedA = A.filter(p => Math.abs(p.dot(n) - low) < supportTolerance);
  const selectedB = B.filter(p => Math.abs(p.dot(n) - high) < supportTolerance);
  const near = closestFeatures(project(selectedA), project(selectedB));
  const restore = (p, normal) => tangent.clone().multiplyScalar(p[0]).addScaledVector(other, p[1]).addScaledVector(n, normal);
  return {sector, tooth, n, A: restore(near.A, low), B: restore(near.B, high),
    supportGap: low - high, tangentGap: near.distance, selected: [selectedA.length, selectedB.length]};
}
const surfaces = new Map();
function coneResidual(normals, target) {
  let best = 1;
  const solve = selected => {
    const matrix = selected.map(a => [...selected.map(b => a.dot(b)), a.dot(target)]), size = selected.length;
    for (let k = 0; k < size; k++) {
      let pivot = k; for (let j = k + 1; j < size; j++) if (Math.abs(matrix[j][k]) > Math.abs(matrix[pivot][k])) pivot = j;
      if (Math.abs(matrix[pivot][k]) < 1e-12) return;
      [matrix[k], matrix[pivot]] = [matrix[pivot], matrix[k]];
      const divisor = matrix[k][k]; for (let j = k; j <= size; j++) matrix[k][j] /= divisor;
      for (let i = 0; i < size; i++) if (i !== k) {const f = matrix[i][k]; for (let j = k; j <= size; j++) matrix[i][j] -= f * matrix[k][j];}
    }
    if (matrix.some(row => row[size] < -1e-8)) return;
    const result = new THREE.Vector3(); selected.forEach((n, i) => result.addScaledVector(n, matrix[i][size]));
    best = Math.min(best, result.distanceTo(target));
  };
  for (let i = 0; i < normals.length; i++) {
    solve([normals[i]]);
    for (let j = i + 1; j < normals.length; j++) {
      solve([normals[i], normals[j]]);
      for (let k = j + 1; k < normals.length; k++) solve([normals[i], normals[j], normals[k]]);
    }
  }
  return best;
}
function boundary(mesh, point, outward) {
  if (!surfaces.has(mesh.name)) surfaces.set(mesh.name, surfaceTriangles(mesh.geometry)
    .map(t => ({t, box: new THREE.Box3().setFromPoints([t.a, t.b, t.c]), normal: t.getNormal(new THREE.Vector3())})));
  const inverse = mesh.matrixWorld.clone().invert(), local = point.clone().applyMatrix4(inverse);
  const direction = outward.clone().transformDirection(inverse), normals = [], near = new THREE.Vector3();
  let distance = Infinity, supportingError = 0, incident = 0;
  for (const {t, box, normal} of surfaces.get(mesh.name)) {
    if (box.distanceToPoint(local) > Math.max(1e-7, distance)) continue;
    const d = t.closestPointToPoint(local, near).distanceTo(local); distance = Math.min(distance, d);
    if (d > 1e-7) continue;
    incident++;
    if (!normals.some(n => n.distanceTo(normal) < 1e-10)) normals.push(normal);
    for (const vertex of [t.a, t.b, t.c]) supportingError = Math.max(supportingError, vertex.clone().sub(local).dot(direction));
  }
  return {distance, incident, normals: normals.length, coneResidual: coneResidual(normals, direction), supportingError};
}

const issues = [], counts = {states: 0, reactions: 0, boundaries: 0, guides: 0, missing: 0};
const errors = {tangentGap: 0, supportGap: 0, boundary: 0, cone: 0, supporting: 0, jacobian: 0, input: 0, momentum: 0};
const totals = [0, 1].map(() => ({positiveWheelImpulse: 0, negativeWheelImpulse: 0, contacts: 0}));
const reverse = [], pitch = 2 * Math.PI / u.geometry.wheelTeeth;
const record = issue => {if (issues.length < 40) issues.push(issue);};
for (let index = startIndex; index < Math.min(endIndex, data.rows.length); index += stride) {
  const state = data.rows[index], before = data.rows[index - 1], k = physics.input(state.time);
  model.setState({shaftAngle: k.q, wheelAngle: state.x[0], lifts: state.x.slice(1)});
  const rows = new Map(physics.constraints(state.x, state.time).rows.map(r => [r.id, r]));
  const impulse = [0, 0, 0], bySide = [0, 0]; counts.states++;
  for (const saved of state.contacts) {
    counts.reactions++; const r = rows.get(saved.id);
    if (!r) {counts.missing++; record({kind: 'missing', index, id: saved.id}); continue;}
    r.J.forEach((v, i) => impulse[i] += v * saved.impulse);
    if (!r.feature) {counts.guides++; continue;}
    const side = Number(r.id.split(':')[0]), c = contactPoints(r, side, state), speed = c.n.dot(new THREE.Vector3(-Math.sin(k.q), Math.cos(k.q), 0));
    const Jwheel = -c.n.dot(new THREE.Vector3(c.B.z, 0, -c.B.x)) / speed;
    const Jinput = c.n.dot(new THREE.Vector3(-c.A.y, c.A.x, 0)) / speed;
    const jacobianError = Math.abs(Jwheel - r.J[0]), inputError = Math.abs(Jinput * k.v - r.inputNormalVelocity);
    const boundaries = [boundary(c.sector, c.A, c.n.clone().negate()), boundary(c.tooth, c.B, c.n)]; counts.boundaries += 2;
    errors.tangentGap = Math.max(errors.tangentGap, c.tangentGap); errors.supportGap = Math.max(errors.supportGap, Math.abs(c.supportGap));
    errors.jacobian = Math.max(errors.jacobian, jacobianError); errors.input = Math.max(errors.input, inputError);
    for (const b of boundaries) {
      errors.boundary = Math.max(errors.boundary, b.distance); errors.cone = Math.max(errors.cone, b.coneResidual);
      errors.supporting = Math.max(errors.supporting, b.supportingError);
    }
    if (c.tangentGap > 2e-7 || Math.abs(c.supportGap) > 2e-7 || jacobianError > 2e-6 || inputError > 2e-6
      || boundaries.some(b => b.distance > 1e-7 || b.coneResidual > 2e-5 || b.supportingError > 2e-7))
      record({kind: 'reaction', index, time: state.time, id: r.id, tangentGap: c.tangentGap, supportGap: c.supportGap,
        jacobianError, inputError, selected: c.selected, boundaries, A: c.A.toArray(), B: c.B.toArray(), normal: c.n.toArray()});
    const wheelImpulse = saved.impulse * Jwheel;
    totals[side][wheelImpulse >= 0 ? 'positiveWheelImpulse' : 'negativeWheelImpulse'] += wheelImpulse;
    totals[side].contacts++; bySide[side] += wheelImpulse;
  }
  const force = physics.forces(state.x, state.time), dt = state.time - before.time;
  assert(dt > 0 && Math.abs(dt - state.dt) < 2e-12);
  assert(['variable-bdf2', 'backward-euler'].includes(state.method));
  const bdf = state.method === 'variable-bdf2', previous = data.rows[index - 2];
  if (bdf) {
    assert(previous); assert(before.time > previous.time);
    const clockAllowance = 16 * Number.EPSILON * Math.max(1, Math.abs(state.time), Math.abs(before.time), Math.abs(previous.time));
    assert(dt / (before.time - previous.time) <= 2.002);
    assert(dt <= 2 * (before.time - previous.time) + clockAllowance);
    assert.deepEqual([...state.active].sort(), [...before.active].sort());
    assert.deepEqual([...before.active].sort(), [...previous.active].sort());
  }
  const ratio = bdf ? dt / (before.time - previous.time) : 1;
  const factor = bdf ? ratio * ratio / (1 + 2 * ratio) : 0;
  const scale = bdf ? dt * (1 + ratio) / (1 + 2 * ratio) : dt;
  const history = before.v.map((v, i) => bdf ? v + (v - previous.v[i]) * factor : v);
  const residual = state.v.map((v, i) => data.parameters.inertia[i] * (v - history[i])
    - scale * (force[i] - data.parameters.damping[i] * v) - impulse[i]);
  errors.momentum = Math.max(errors.momentum, ...residual.map(Math.abs));
  if (Math.max(...residual.map(Math.abs)) > 1e-7) record({kind: 'momentum', index, residual});
  if (state.v[0] < 0) reverse.push({time: state.time, velocity: state.v[0], teeth: (state.x[0] - data.rows[0].x[0]) / pitch, wheelImpulse: bySide});
  if (counts.states % 500 === 0) console.log({states: counts.states, reactions: counts.reactions, issues: issues.length});
}
for (const source of sources) assert.equal(hash(source.file), source.sha256, source.file);
const report = {movement: 83, status: 'precise-spatial-contact-reaction-audit', productionChanged: false, mechanicsPassed: false,
  passed: issues.length === 0 && counts.reactions > 0 && counts.missing === 0, input, stride, startIndex, endIndex, supportTolerance, counts, errors, totals, reverse, issues, sources,
  qualification: 'Recorded positive impulses are reconstructed at independent supporting-feature intersection points. Both complete mesh boundaries, outward normal cones and incident-face support halfspaces are checked; point-force wheel/input Jacobians and the recorded method’s discrete free-coordinate momentum are compared independently. Nonuniform BDF2 uses its two-state history and ratio-dependent force weight; its impulses are BDF equation impulses. This does not prove feature transitions between saved states, continuous clearance, energy balance or time-step convergence.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, reverse: {states: reverse.length, first: reverse[0]}, sources: undefined});
if (!report.passed) process.exitCode = 1;
