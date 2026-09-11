import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { gravityTumblerPlateProfile, tumblerSource } from '../src/simulation/gravity-tumbler-plate.js';
import { tumblerSourcePoints } from '../scripts/lib/gravity-tumbler-source-points.mjs';
import { makeGravityTumblerMotion } from '../src/simulation/gravity-tumbler-motion.js';
import { createMovementModel, applyDisplayTiming } from '../src/simulation/registry.js';
import { surfaceTriangles, surfacePoints, solidSurface } from './helpers/solid-surface.mjs';
import { triangleTree, meshPairDistance } from '../scripts/lib/star-mangle-pair-distance.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));
const model = createMovementModel(catalog.movements[66]), { parts, geometry: p, motion, blocks } = model.root.userData;
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} versus ${b}`);

test('067 gravity and inertia agree with the actual uniform component solids', () => {
  model.update(0); model.root.updateMatrixWorld(true);
  let momentX = 0, momentY = 0, inertia = 0;
  for (const [name, mass] of [['tumblerPlate', p.plateMass],
    ['weightSleeve', p.sleeveMass], ['halfCutSleeveEnd', p.collarMass]]) {
    const matrix = blocks.weight.matrixWorld.clone().invert().multiply(parts[name].matrixWorld);
    let volume = 0, x = 0, y = 0, radialMoment = 0;
    for (const face of surfaceTriangles(parts[name].geometry)) {
      const [a, b, c] = [face.a, face.b, face.c].map(q => q.clone().applyMatrix4(matrix));
      const v = a.dot(b.clone().cross(c)) / 6; volume += v;
      x += v * (a.x + b.x + c.x) / 4; y += v * (a.y + b.y + c.y) / 4;
      for (const axis of ['x', 'y']) radialMoment += v / 10 * (a[axis] ** 2 + b[axis] ** 2 + c[axis] ** 2
        + a[axis] * b[axis] + a[axis] * c[axis] + b[axis] * c[axis]);
    }
    assert.ok(volume > 0); momentX += mass * x / volume; momentY += mass * y / volume;
    inertia += mass * radialMoment / volume;
  }
  near(momentX, p.massMomentX, 1e-7); near(momentY, p.massMomentY, 1e-7);
  near(inertia, p.inertia, 1e-5); // The analytic circular sections bound their 512-sided meshes.
});

test('067 free flight and both inelastic stops preserve the energy balance', () => {
  for (const damping of [0, 1.5, 2.8, 4, 6]) {
    const m = makeGravityTumblerMotion({ damping });
    assert.ok(m.summary.maximumEnergyResidual < 1e-7);
    assert.equal(m.summary.finalMode, 'lower');
    assert.ok(m.events.some(e => e.kind === 'lower-impact'));
    if (damping === 0) assert.ok(m.events.some(e => e.kind === 'upper-impact'));
    for (const e of m.events.filter(e => e.kind.endsWith('impact'))) {
      assert.ok(e.kind === 'lower-impact' ? e.impulse > 0 : e.impulse < 0);
      assert.ok(e.impactLoss > 0); near(e.energyResidual, 0, 1e-10);
    }
  }
  assert.ok(motion.summary.maximumLead < p.availableLead - 0.16);
  assert.ok(motion.summary.maximumSpeed > 2.1 && motion.summary.maximumSpeed < 2.3);
});

test('067 pose derivatives follow gravity and passive drag through repeated cycles', () => {
  const h = 2e-6;
  for (let i = 0; i < 601; i++) {
    const time = p.cycleDuration * (i + 0.237) / 601, a = motion.atTime(time);
    const before = motion.atTime(time - h), after = motion.atTime(time + h);
    const acceleration = (after.weightAngularSpeed - before.weightAngularSpeed) / (2 * h);
    const torque = -p.gravity * (p.massMomentX * Math.cos(a.weightAngle) - p.massMomentY * Math.sin(a.weightAngle));
    near(p.inertia * acceleration, torque - p.damping * a.weightAngularSpeed + a.pinTorque, 1e-5);
    assert.ok(a.lead >= -1e-12 && a.lead < p.availableLead);
    if (a.pinEngaged) assert.ok(a.pinTorque >= 0);
    for (const cycle of [-2, 1, 5]) {
      const b = motion.atTime(time + cycle * p.cycleDuration);
      near(b.weightAngle - a.weightAngle, cycle * 2 * Math.PI, 1e-11);
      near(b.weightAngularSpeed, a.weightAngularSpeed, 1e-11);
    }
  }
});

test('067 release and catch converge when the integration step changes', () => {
  const coarse = makeGravityTumblerMotion({ step: 0.001 }), fine = makeGravityTumblerMotion({ step: 0.00025 });
  near(motion.torque(p.releaseAngle), p.damping * p.driverSpeed);
  near(coarse.events[1].time, fine.events[1].time, 1e-8);
  for (let i = 0; i < 601; i++) {
    const time = p.cycleDuration * (i + 0.319) / 601, a = coarse.atTime(time), b = fine.atTime(time);
    near(a.weightAngle, b.weightAngle, 1e-7); near(a.weightAngularSpeed, b.weightAngularSpeed, 1e-7);
  }
});

test('067 the finite pin transmits positive lifting and catch forces at its actual corner', () => {
  const pinTree = triangleTree(parts.drivingPin.geometry), collarTree = triangleTree(parts.halfCutSleeveEnd.geometry);
  for (const time of [0, 8.54, 10.13, 12.31, 14.81]) {
    model.update(time); model.root.updateMatrixWorld(true);
    const result = meshPairDistance(pinTree, collarTree,
      parts.halfCutSleeveEnd.matrixWorld.clone().invert().multiply(parts.drivingPin.matrixWorld), 0.01);
    assert.ok(result.witness); near(result.distance, p.contactClearance, 1e-7);
    const a = new THREE.Vector3().fromArray(result.witness.a).applyMatrix4(parts.halfCutSleeveEnd.matrixWorld);
    const b = new THREE.Vector3().fromArray(result.witness.b).applyMatrix4(parts.halfCutSleeveEnd.matrixWorld);
    const normal = b.clone().sub(a).normalize(), outputMoment = b.clone().cross(normal).z;
    assert.ok(outputMoment > 0.34); near(a.clone().cross(normal).z, outputMoment);
    assert.ok(motion.atTime(time).pinTorque / outputMoment > 0);
  }
});

test('067 all physical solids have positive volume, outward normals and paired edges', () => {
  for (const [name, mesh] of Object.entries(parts)) {
    const g = mesh.geometry, edges = new Map(); let volume = 0;
    for (const [i, face] of surfaceTriangles(g).entries()) {
      const cross = face.b.clone().sub(face.a).cross(face.c.clone().sub(face.a));
      if (cross.lengthSq() < 1e-22) continue;
      const normal = new THREE.Vector3();
      for (let j = 0; j < 3; j++) normal.add(new THREE.Vector3().fromBufferAttribute(g.attributes.normal, g.index ? g.index.getX(i * 3 + j) : i * 3 + j));
      assert.ok(cross.dot(normal) > 0, name); volume += face.a.dot(face.b.clone().cross(face.c)) / 6;
      const keys = [face.a, face.b, face.c].map(q => q.toArray().map(x => Math.round(x * 1e9)).join(','));
      for (let j = 0; j < 3; j++) {
        const a = keys[j], b = keys[(j + 1) % 3], key = a < b ? `${a}/${b}` : `${b}/${a}`;
        const e = edges.get(key) ?? { count: 0, direction: 0 }; e.count++; e.direction += a < b ? 1 : -1; edges.set(key, e);
      }
    }
    assert.ok(volume > 0, name); assert.ok([...edges.values()].every(e => e.count === 2 && e.direction === 0), name);
  }
});

test('067 sleeves, pin and scalloped plate clear the independent shaft and worm hardware', () => {
  const pairs = [['frontInputShaft', 'weightSleeve'], ['frontInputShaft', 'halfCutSleeveEnd'],
    ['drivingPin', 'halfCutSleeveEnd'], ['drivingPin', 'tumblerPlate'], ['wormThread', 'tumblerPlate'], ['wormWheel', 'tumblerPlate']];
  const data = Object.fromEntries([...new Set(pairs.flat())].map(name => [name,
    { solid: solidSurface(parts[name].geometry), points: surfacePoints(parts[name].geometry) }]));
  for (const time of [0, 0.847, 2.9, 4.9, 8.53512, 8.53514, 12]) {
    model.update(time); model.root.updateMatrixWorld(true);
    for (const [a, b] of pairs) for (const [from, to] of [[a, b], [b, a]]) {
      const matrix = parts[to].matrixWorld.clone().invert().multiply(parts[from].matrixWorld);
      const { solid } = data[to], samples = data[from].points;
      for (let i = 0; i < samples.length; i += 7) {
        const q = samples[i].clone().applyMatrix4(matrix);
        assert.ok(!solid.inside(q) || solid.distance(q) < 1e-6, `${from}/${to} at ${time}`);
      }
    }
  }
});

test('067 the shifted worm has separated working flanks with compatible force power', () => {
  const worm = parts.wormThread, wheel = parts.wormWheel, wormTree = triangleTree(worm.geometry);
  const faces = surfaceTriangles(wheel.geometry).filter(face => {
    const q = face.getMidpoint(new THREE.Vector3()), n = face.getNormal(new THREE.Vector3());
    return -q.clone().cross(n).z > Math.hypot(q.x, q.y) * 0.1;
  });
  const wheelTree = triangleTree(new THREE.BufferGeometry().setFromPoints(faces.flatMap(f => [f.a, f.b, f.c])));
  for (const phase of [0.137, 0.419, 0.813]) {
    model.update(phase * 2 * Math.PI / (p.wheelTeeth * p.driverSpeed)); model.root.updateMatrixWorld(true);
    const result = meshPairDistance(wormTree, wheelTree, wheel.matrixWorld.clone().invert().multiply(worm.matrixWorld), 0.025);
    assert.ok(result.witness && result.distance > 0.000001 && result.distance < 0.00006);
    const a = new THREE.Vector3().fromArray(result.witness.a).applyMatrix4(wheel.matrixWorld);
    const b = new THREE.Vector3().fromArray(result.witness.b).applyMatrix4(wheel.matrixWorld), n = b.clone().sub(a).normalize();
    const out = b.clone().cross(n).z;
    const input = a.clone().sub(new THREE.Vector3(p.wormOffset, -p.wormCenterDistance, 0)).cross(n.clone().negate()).dot(new THREE.Vector3(-1, 0, 0));
    assert.ok(out > 0); assert.ok(Math.abs(out + input * p.wheelTeeth) / Math.max(out, Math.abs(input * p.wheelTeeth)) < 0.02);
  }
});

test('067 limits the visible worm to one turn per second and honors slower playback', () => {
  const timing = applyDisplayTiming(model, catalog.movements[66]).root.userData.animationTiming;
  near(timing.displayCycleDuration, 24, 1e-7);
  near(p.wheelTeeth * p.driverSpeed * timing.playbackTimeScale, 2 * Math.PI, 1e-7);
  near(applyDisplayTiming(model, catalog.movements[66], 40).root.userData.animationTiming.displayCycleDuration, 40);
  applyDisplayTiming(model, catalog.movements[66]);
});

test('067 the scalloped plate follows independent source boundary readings', () => {
  const { anchor, scale } = tumblerSource, path = gravityTumblerPlateProfile().contours.shape;
  for (const [x, y] of tumblerSourcePoints.plate) {
    const q = new THREE.Vector2((x - anchor[0]) / scale, (anchor[1] - y) / scale);
    let distance = Infinity;
    for (let i = 0; i < path.length; i++) {
      const a = path[i], b = path[(i + 1) % path.length], direction = b.clone().sub(a);
      const t = direction.lengthSq() ? THREE.MathUtils.clamp(q.clone().sub(a).dot(direction) / direction.lengthSq(), 0, 1) : 0;
      distance = Math.min(distance, q.distanceTo(a.clone().addScaledVector(direction, t)));
    }
    assert.ok(distance * scale < 13, String([x, y]));
  }
  near(p.plateArea, 9.311551027363338, 1e-8);
  assert.ok(p.plateCentroidX > 0.21 && p.plateCentroidY > 0.93);
});
