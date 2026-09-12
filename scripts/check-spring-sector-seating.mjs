import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
import {makeSpringSectorContact} from './lib/spring-sector-contact.mjs';
import {surfaceTriangles, solidSurface} from '../tests/helpers/solid-surface.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-first-finite-seating';
const model = makeSpringSectorCandidate(), u = model.root.userData, contact = makeSpringSectorContact(model);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sources = ['scripts/check-spring-sector-seating.mjs', 'scripts/lib/spring-sector-candidate.mjs',
  'scripts/lib/spring-sector-contact.mjs', 'scripts/lib/spring-sector-linkage.mjs', 'scripts/lib/spring-sector-source.mjs',
  'scripts/lib/spring-rack-coil.mjs', 'tests/helpers/solid-surface.mjs', 'src/simulation/finite-plate-geometry.js',
  'src/simulation/clutch-section-geometry.js', 'src/simulation/primitives.js'].map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const rows = [], pitch = 2 * Math.PI / u.geometry.wheelTeeth; let pruneChecks = 0;
for (let i = 0; i <= 8; i++) for (let j = 0; j <= 12; j++) {
  const q = -.22 + i * .055, theta = j * pitch / 12, seats = [];
  for (let side = 0; side < 2; side++) {
    const result = contact.seat(q, theta, side, {lower: -.06, upper: .18});
    if ([0, 4, 8].includes(i) && [0, 5, 12].includes(j)) {
      const full = contact.seat(q, theta, side, {lower: -.06, upper: .18, prune: false});
      assert.equal(result.lift, full.lift); assert.deepEqual(result.contact, full.contact); pruneChecks++;
    }
    assert(result.contact && result.bodyPlaneGap > 0); seats.push(result);
  }
  model.setState({shaftAngle: q, wheelAngle: theta, lifts: seats.map(s => s.lift)});
  const input = u.state.input;
  const actualPin = new THREE.Vector3(...u.linkage.pin, u.geometry.wheelPitchRadius).applyMatrix4(u.blocks.rod.matrixWorld);
  const crankPin = u.parts.inputPin.getWorldPosition(new THREE.Vector3());
  assert(actualPin.distanceTo(crankPin) < 1e-12);
  assert(Math.abs(input.lengthResidual) < 1e-12);
  const remote = new THREE.Vector3(...u.linkage.end, u.geometry.wheelPitchRadius).applyMatrix4(u.blocks.rod.matrixWorld);
  assert(remote.distanceTo(new THREE.Vector3(...input.remotePin, u.geometry.wheelPitchRadius)) < 1e-12);
  rows.push({shaftAngle: q, wheelAngle: theta, lifts: seats.map(s => s.lift), seats, input,
    pinResidual: actualPin.distanceTo(crankPin), remoteResidual: remote.distanceTo(new THREE.Vector3(...input.remotePin, u.geometry.wheelPitchRadius))});
}

// Independent actual-triangle edge/interior intersections. Splitting an edge
// at its ray/triangle crossings detects penetration even when ordinary mesh
// vertices and centroids miss a small edge/edge contact patch.
function edgeInteriors(from, to) {
  const target = solidSurface(to.geometry), triangles = surfaceTriangles(to.geometry), unique = new Map();
  const matrix = to.matrixWorld.clone().invert().multiply(from.matrixWorld);
  for (const t of surfaceTriangles(from.geometry)) {
    const points = [t.a, t.b, t.c];
    for (let i = 0; i < 3; i++) {
      const a = points[i], b = points[(i + 1) % 3], ka = a.toArray().join(','), kb = b.toArray().join(',');
      const key = ka < kb ? ka + '/' + kb : kb + '/' + ka;
      if (!unique.has(key)) unique.set(key, [a.clone().applyMatrix4(matrix), b.clone().applyMatrix4(matrix)]);
    }
  }
  let maximumDepth = 0, crossingIntervals = 0, witness = null;
  const hit = new THREE.Vector3(), ray = new THREE.Ray();
  for (const [a, b] of unique.values()) {
    const length = a.distanceTo(b); if (length < 1e-10) continue;
    ray.set(a, b.clone().sub(a).divideScalar(length));
    const edgeBox = new THREE.Box3().setFromPoints([a, b]); if (!edgeBox.intersectsBox(target.box)) continue;
    const knots = [0, length];
    for (const t of triangles) if (ray.intersectTriangle(t.a, t.b, t.c, false, hit)) {
      const distance = hit.distanceTo(a); if (distance > 1e-10 && distance < length - 1e-10) knots.push(distance);
    }
    knots.sort((a, b) => a - b);
    for (let i = 1; i < knots.length; i++) {
      if (knots[i] - knots[i - 1] < 1e-9) continue;
      const point = ray.at((knots[i] + knots[i - 1]) / 2, new THREE.Vector3());
      if (!target.inside(point)) continue;
      const depth = target.distance(point); if (depth < 1e-8) continue;
      crossingIntervals++;
      if (depth > maximumDepth) {maximumDepth = depth; witness = point.clone().applyMatrix4(to.matrixWorld).toArray();}
    }
  }
  return {maximumDepth, crossingIntervals, witness};
}
const initialAngle = .07233930452344918, seat = contact.seat(0, initialAngle, 0, {lower: -.06, upper: .18});
const intersections = [];
for (const offset of [0, -1e-4]) {
  model.setState({wheelAngle: initialAngle, lifts: [seat.lift + offset, seat.lift]});
  const sector = u.parts.frontSector, tooth = u.parts[seat.contact.tooth];
  const directions = [edgeInteriors(sector, tooth), edgeInteriors(tooth, sector)];
  const maximumDepth = Math.max(...directions.map(r => r.maximumDepth));
  if (offset === 0) assert.equal(maximumDepth, 0);
  else assert(maximumDepth > 1e-7, 'Lowered negative control must penetrate actual triangles');
  intersections.push({offset, sector: sector.name, tooth: tooth.name, maximumDepth, directions});
}
for (const source of sources) assert.equal(hash(source.file), source.sha256, source.file);
const report = {movement: 83, status: 'finite-seating-geometry-check', passed: true, productionChanged: false, mechanicsPassed: false,
  convexSectorCells: contact.cells.map(c => c.length), convexCrownTeeth: contact.teeth.length,
  poses: rows.length, minimumLift: Math.min(...rows.flatMap(r => r.lifts)), maximumLift: Math.max(...rows.flatMap(r => r.lifts)),
  minimumBodyPlaneGap: Math.min(...rows.flatMap(r => r.seats.map(s => s.bodyPlaneGap))), pruneChecks,
  rows, intersections, sources,
  qualification: '117 independent geometry poses, not an animation or force solution. Exact convex-cell SAT translation intervals use rendered Float32 faces with 2e-9 padding. Eighteen unpruned comparisons and actual-triangle positive/negative seating controls are independent checks. The sampled parameter grid does not establish a continuous angular envelope, spring self-clearance, support loads or dynamics.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, rows: undefined, sources: undefined});
