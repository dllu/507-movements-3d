import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeCoaxialDifferentSpeeds } from '../src/simulation/coaxial-gears.js';
import { surfaceTriangles, surfacePoints, solidSurface } from './helpers/solid-surface.mjs';
import { gearBoundary, boundaryIndex, planarPairDistance } from '../scripts/lib/coaxial-planar-distance.mjs';

const model = makeCoaxialDifferentSpeeds(), { parts, blocks, geometry: p } = model.root.userData;
const setTime = time => { model.update(time); model.root.updateMatrixWorld(true); };

test('055 has seven closed solids, outward corner normals and genuinely bored concentric supports', () => {
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
  assert.equal(Object.keys(parts).length, 7);
  assert.equal(parts.ringMesh.geometry.parameters.options.bevelEnabled, false, 'zero chamfer produces no degenerate bevel layers');
  assert.equal(parts.outputShaft.parent, parts.gearAMesh.parent);
  assert.equal(parts.pinionShaft.parent, parts.pinionMesh.parent);
  assert.equal(parts.sleeve.parent, parts.ringMesh.parent);
  assert.notEqual(parts.outputShaft.parent, parts.sleeve.parent);
});

test('055 actual tooth boundaries retain both working contacts with compressive torque', () => {
  const input = gearBoundary(parts.pinionMesh), period = 2 * Math.PI / (p.pinionTeeth * p.inputSpeed);
  const times = Array.from({ length: 257 }, (_, i) => period * (i + 0.319) / 257);
  times.push(0.13259277696437288, 0.11678018545632016, 0.14603529411764707);
  for (const [mesh, speed] of [[parts.gearAMesh, -p.inputSpeed * 10 / 17], [parts.ringMesh, p.inputSpeed * 10 / 37]]) {
    const target = boundaryIndex(gearBoundary(mesh));
    for (const time of times) {
      setTime(time); const transform = mesh.matrixWorld.clone().invert().multiply(parts.pinionMesh.matrixWorld);
      const result = planarPairDistance(input, target, transform);
      assert.equal(result.intersections, 0, `no tooth crossing at ${time}`);
      assert.ok(result.distance > 0.000015 && result.distance < 0.00005, `working contact gap ${result.distance}`);
      const { a, b } = result.witness, nx = (b.x - a.x) / result.distance, ny = (b.y - a.y) / result.distance;
      const outputPower = (b.x * ny - b.y * nx) * speed;
      const inputPower = ((a.x - transform.elements[12]) * ny - (a.y - transform.elements[13]) * nx) * p.inputSpeed;
      assert.ok(inputPower > 0 && outputPower > 0, 'the pinion pushes both outputs in their actual directions');
      assert.ok(Math.abs(inputPower - outputPower) / Math.max(inputPower, outputPower) < 0.005, 'polygonal contact normals agree with the constant gear ratio');
    }
  }
});

test('055 independent shaft and sleeve preserve opposite output directions at fixed ratios', () => {
  const dt = 1e-5;
  for (const time of [-2.31, 0, 0.151, 1.4, 7.399, 37.17]) {
    setTime(time); const before = { ...model.root.userData.kinematics };
    const matrices = [parts.gearAMesh, parts.pinionMesh, parts.ringMesh].map(m => m.matrixWorld.clone());
    setTime(time + dt); const after = model.root.userData.kinematics;
    for (const [key, speed] of [['pinionAngle', Math.PI], ['gearAAngle', -Math.PI * 10 / 17], ['gearCAngle', Math.PI * 10 / 37]]) {
      assert.ok(Math.abs((after[key] - before[key]) / dt - speed) < 1e-8);
    }
    setTime(time - 3); setTime(time);
    [parts.gearAMesh, parts.pinionMesh, parts.ringMesh].forEach((mesh, i) => assert.ok(mesh.matrixWorld.equals(matrices[i]), 'seeking does not alter the state'));
    const a = parts.gearAMesh.getWorldPosition(new THREE.Vector3()), c = parts.ringMesh.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.hypot(a.x - c.x, a.y - c.y) < 1e-12, 'both output axes remain concentric');
    assert.ok(Math.abs(blocks.pinionB.position.length() - 1.35) < 1e-12);
  }
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 2, 'one input revolution is displayed in two seconds');
});

test('055 independently moving hardware clears the pinion and concentric shaft throughout rotation', () => {
  const bodies = [['gearAMesh', 'outputShaft'], ['pinionMesh', 'pinionShaft'], ['ringMesh', 'backplate', 'sleeve']];
  const data = Object.fromEntries(Object.entries(parts).map(([name, mesh]) => [name, { mesh, solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry) }]));
  let checks = 0;
  for (let phase = 0; phase < 13; phase += 1) {
    setTime(7.4 * (phase + 0.217) / 13);
    for (let i = 0; i < bodies.length; i += 1) for (let j = i + 1; j < bodies.length; j += 1) for (const aName of bodies[i]) for (const bName of bodies[j]) {
      if ((aName === 'gearAMesh' && bName === 'pinionMesh') || (aName === 'pinionMesh' && bName === 'ringMesh')) continue;
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
  assert.ok(checks > 4_000_000, 'both directions of the actual surfaces were sampled');
});
