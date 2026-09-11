import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeLatheGearEngagement } from '../src/simulation/lathe-gear-engagement.js';
import { surfaceTriangles, surfacePoints, solidSurface } from './helpers/solid-surface.mjs';
import { gearBoundary, boundaryIndex, planarPairDistance } from '../scripts/lib/coaxial-planar-distance.mjs';
import { camContactSamples } from '../scripts/lib/lathe-lever-cam-contact.mjs';

const model = makeLatheGearEngagement(), { parts, blocks, geometry: p } = model.root.userData;
const setTime = time => { model.update(time); model.root.updateMatrixWorld(true); };

test('056 has sixteen closed solids with outward normals and real bores', () => {
  for (const [name, mesh] of Object.entries(parts)) {
    const g = mesh.geometry, edges = new Map(); let volume = 0;
    for (const [i, face] of surfaceTriangles(g).entries()) {
      assert.ok(face.getArea() > 1e-20, `${name}: nonzero face`);
      const normal = face.getNormal(new THREE.Vector3());
      for (let j = 0; j < 3; j += 1) {
        const index = g.index ? g.index.getX(3 * i + j) : 3 * i + j;
        assert.ok(normal.dot(new THREE.Vector3().fromBufferAttribute(g.attributes.normal, index)) > 0, `${name}: outward corner normal`);
      }
      volume += face.a.dot(face.b.clone().cross(face.c)) / 6;
      const keys = [face.a, face.b, face.c].map(v => v.toArray().map(x => Math.round(x * 1e7)).join(','));
      for (let j = 0; j < 3; j += 1) {
        const a = keys[j], b = keys[(j + 1) % 3], key = a < b ? `${a}/${b}` : `${b}/${a}`;
        const edge = edges.get(key) ?? { count: 0, direction: 0 };
        edge.count += 1; edge.direction += a < b ? 1 : -1; edges.set(key, edge);
      }
    }
    assert.ok(volume > 0, `${name}: positive volume`);
    assert.ok([...edges.values()].every(e => e.count === 2 && e.direction === 0), `${name}: closed oriented edges`);
  }
  assert.equal(Object.keys(parts).length, 16);
  assert.equal(parts.largeGear.parent, parts.outputShaft.parent);
  assert.equal(parts.pinion.parent, parts.inputShaft.parent);
  assert.equal(parts.pinion.parent, parts.pulley.parent);
  assert.notEqual(parts.slider.parent, parts.outputShaft.parent, 'the sliding bearing does not rotate with the shaft');
});

test('056 independently moving hardware clears throughout lever withdrawal and return', () => {
  const bodies = [['largeGear', 'frontWeb', 'outputShaft'], ['pinion', 'inputShaft', 'pulley'],
    ['frame', 'bearingCap', 'topLip', 'foot', 'footBand', 'rearSupport', 'pivotShaft', 'pivotCap'], ['slider'], ['leverPlate']];
  const data = Object.fromEntries(Object.entries(parts).map(([name, mesh]) => [name, { mesh, solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry) }]));
  let checks = 0;
  for (let phase = 0; phase < 13; phase += 1) {
    setTime(p.cycleDuration * phase / 12);
    for (let i = 0; i < bodies.length; i += 1) for (let j = i + 1; j < bodies.length; j += 1) for (const aName of bodies[i]) for (const bName of bodies[j]) {
      if (aName === 'largeGear' && bName === 'pinion') continue;
      const first = data[aName], second = data[bName];
      for (const [a, b] of [[first, second], [second, first]]) {
        const matrix = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
        if (!a.solid.box.clone().applyMatrix4(matrix).intersectsBox(b.solid.box)) continue;
        for (const point of a.points) {
          const q = point.clone().applyMatrix4(matrix); checks += 1;
          if (b.solid.inside(q)) assert.ok(b.solid.distance(q) < 1e-6, `${aName}/${bName}: hardware penetration`);
        }
      }
    }
  }
  assert.ok(checks > 7_000_000, 'both directions of the actual surfaces were sampled');
});

test('056 actual involute contours retain contact under load and separate during the free run', () => {
  const input = gearBoundary(parts.pinion), target = boundaryIndex(gearBoundary(parts.largeGear));
  const times = Array.from({ length: 193 }, (_, i) => p.cycleDuration * i / 192);
  for (let i = 0; i < 129; i += 1) {
    const turns = (i + 0.31) / (129 * p.pinionTeeth); let lo = 0, hi = 1;
    for (let step = 0; step < 50; step += 1) {
      const u = (lo + hi) / 2;
      if (u ** 3 * (10 - 15 * u + 6 * u ** 2) < turns) lo = u; else hi = u;
    }
    times.push(p.runDuration * (lo + hi) / 2);
  }
  for (const time of times) {
    setTime(time); const state = model.root.userData.kinematics;
    const transform = parts.largeGear.matrixWorld.clone().invert().multiply(parts.pinion.matrixWorld);
    const result = planarPairDistance(input, target, transform);
    assert.equal(result.intersections, 0, `no tooth crossing at ${time}`);
    if (state.branch === 'disengaged-run') {
      assert.ok(result.distance >= 0.01, 'the pinion turns with visible clearance from the stationary large gear');
    } else if (state.engaged) {
      assert.ok(result.distance > 0.000015 && result.distance < 0.00005, `working contact gap ${result.distance}`);
      if (state.inputSpeed < 1e-8) continue;
      const { a, b } = result.witness, nx = (b.x - a.x) / result.distance, ny = (b.y - a.y) / result.distance;
      const inputPower = ((a.x - transform.elements[12]) * ny - (a.y - transform.elements[13]) * nx) * state.inputSpeed;
      const outputPower = (b.x * ny - b.y * nx) * state.outputSpeed;
      assert.ok(inputPower > 0 && outputPower > 0, 'the actual flank normal transmits compressive torque');
      assert.ok(Math.abs(inputPower - outputPower) / Math.max(inputPower, outputPower) < 0.005);
    }
  }
});

test('056 stops both shafts before shifting and returns to mesh without jumps or remembered state', () => {
  const dt = 1e-5;
  for (const time of [-7.201, -0.03, 0.371, 2.41, 2.93, 3.61, 4.42, 6.01, 6.91, 7.2, 17.23]) {
    setTime(time); const state = { ...model.root.userData.kinematics };
    const angles = [blocks.input.rotation.z, blocks.output.rotation.z, blocks.lever.rotation.z], x = blocks.output.position.x;
    const matrices = Object.values(parts).map(mesh => mesh.matrixWorld.clone());
    setTime(time + dt);
    const derivatives = [(blocks.input.rotation.z - angles[0]) / dt, (blocks.output.rotation.z - angles[1]) / dt,
      (blocks.lever.rotation.z - angles[2]) / dt, (blocks.output.position.x - x) / dt];
    for (const [i, expected] of [state.inputSpeed, state.outputSpeed, state.leverAngularSpeed, state.outputLinearSpeed].entries()) {
      assert.ok(Math.abs(derivatives[i] - expected) < 0.0001, `actual motion derivative at ${time}`);
    }
    if (state.branch.startsWith('stopped-')) {
      assert.equal(derivatives[0], 0); assert.equal(derivatives[1], 0);
    }
    if (state.branch === 'disengaged-run') assert.equal(derivatives[1], 0);
    setTime(time + 1.37); setTime(time);
    Object.values(parts).forEach((mesh, i) => assert.ok(mesh.matrixWorld.equals(matrices[i]), 'seeking restores the same physical pose'));
    assert.equal(blocks.output.position.y, 0); assert.equal(parts.slider.position.x, blocks.output.position.x);
  }
  for (const time of [0, 2.4, 3.6, 6, 7.2, 9.6, 10.8, 13.2, 14.4]) {
    setTime(time - dt); const before = Object.values(parts).map(mesh => mesh.matrixWorld.clone());
    setTime(time + dt);
    Object.values(parts).forEach((mesh, i) => assert.ok(mesh.matrixWorld.elements.every((v, j) => Math.abs(v - before[i].elements[j]) < 1e-8), 'stopped stage boundaries are continuous'));
  }
});

test('056 actual cam walls push the sliding shaft in both directions with consistent work', () => {
  const report = camContactSamples(model, 33);
  assert.equal(report.summary.intersections, 0);
  assert.ok(report.summary.minimumGap > 0.000025 && report.summary.maximumGap < 0.00007);
  assert.ok(report.summary.minimumInputPower > 0 && report.summary.minimumOutputPower > 0);
  assert.ok(report.summary.maximumPowerResidual < 0.01, 'actual slot normals agree with lever torque and slider travel');
});
