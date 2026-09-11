import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeDualBeltSpeeds } from '../src/simulation/dual-belt-speeds.js';
import { surfaceTriangles, surfacePoints, solidSurface } from './helpers/solid-surface.mjs';
import { triangleTree, meshPairDistance } from '../scripts/lib/star-mangle-pair-distance.mjs';

const model = makeDualBeltSpeeds(), { parts, blocks, geometry: p, motion } = model.root.userData;
const setTime = time => { model.update(time); model.root.updateMatrixWorld(true); };
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);

test('060 has ten closed solids with consistent outward normals and independent bearings', () => {
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
  assert.equal(Object.keys(parts).length, 10);
  assert.equal(parts.fixedLeftPulley.parent, blocks.output);
  assert.equal(parts.fixedRightPulley.parent, blocks.output);
  assert.equal(parts.outputShaft.parent, blocks.output);
  assert.equal(parts.looseLeftPulley.parent, blocks.looseLeft);
  assert.equal(parts.looseRightPulley.parent, blocks.looseRight);
  assert.notEqual(blocks.looseLeft, blocks.output);
  assert.notEqual(blocks.looseRight, blocks.output);
  setTime(0);
  const envelope = name => new THREE.Box3().setFromObject(parts[name], true);
  const large = envelope('largeDriver'), small = envelope('smallDriver');
  assert.ok(large.max.z < small.min.z, 'large upper pulley is at source left');
  assert.ok(envelope('fixedRightPulley').min.z - envelope('fixedLeftPulley').max.z > 0.9,
    'the two lower pulley banks retain the exposed shaft gap in Brown');
  // Independent side-elevation ink measurements from the unchanged scan.
  for (const [name, top, bottom] of [['largeDriver', 105, 625], ['smallDriver', 228, 521],
    ['looseLeftPulley', 794, 1297], ['fixedLeftPulley', 794, 1297],
    ['fixedRightPulley', 792, 1300], ['looseRightPulley', 792, 1302]]) {
    const bounds = envelope(name);
    assert.ok(Math.abs(1047 - 200 * bounds.max.y - top) <= 7);
    assert.ok(Math.abs(1047 - 200 * bounds.min.y - bottom) <= 7);
  }
});

test('060 loose-pulley bores clear the moving output shaft and both installed bands clear all treads', () => {
  const lower = ['looseLeftPulley', 'fixedLeftPulley', 'fixedRightPulley', 'looseRightPulley'];
  const pairs = [['outputShaft', 'looseLeftPulley'], ['outputShaft', 'looseRightPulley'],
    ...['leftBelt', 'rightBelt'].flatMap(band => ['largeDriver', 'smallDriver', ...lower].map(pulley => [band, pulley]))];
  const data = Object.fromEntries([...new Set(pairs.flat())].map(name => [name,
    { mesh: parts[name], points: surfacePoints(parts[name].geometry), solid: solidSurface(parts[name].geometry) }]));
  for (const time of [0.731, 2.55, 2.85, 3.15, 4.127, 5.85, 6.15, 6.45]) {
    setTime(time);
    for (const [first, second] of pairs) for (const [a, b] of [[data[first], data[second]], [data[second], data[first]]]) {
      const transform = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for (const point of a.points) {
        const q = point.clone().applyMatrix4(transform);
        if (b.solid.inside(q)) assert.ok(b.solid.distance(q) < 1e-6, `${first}/${second}: no penetration`);
      }
    }
  }
});

test('060 both flat bands contact their driving drum and selected or bridging lower treads', () => {
  const lower = ['looseLeftPulley', 'fixedLeftPulley', 'fixedRightPulley', 'looseRightPulley'];
  const trees = Object.fromEntries(Object.entries(parts).map(([name, mesh]) => [name, triangleTree(mesh.geometry)]));
  for (let stage = 0; stage < 2; stage += 1) for (const shift of [false, true]) {
    setTime(stage * p.stageDuration + (shift ? p.dwellDuration + p.shiftDuration / 2 : 0.917));
    const state = model.root.userData.kinematics;
    for (const [i, band] of ['leftBelt', 'rightBelt'].entries()) {
      assert.equal(parts[band].visible, true, 'both complete physical bands remain installed');
      assert.equal(parts[band].userData.crossSection, 'rectangular');
      const names = [i === 0 ? 'largeDriver' : 'smallDriver', lower[state.fromLanes[i]],
        ...(shift ? [lower[state.toLanes[i]]] : [])];
      for (const name of names) {
        const transform = parts[name].matrixWorld.clone().invert().multiply(parts[band].matrixWorld);
        const result = meshPairDistance(trees[band], trees[name], transform, 0.001);
        assert.ok(result.witness && result.distance > 0.00012 && result.distance < 0.00020,
          `${band}/${name}: actual positive working contact gap`);
      }
    }
    if (shift) {
      assert.ok(['driverSpeed', 'outputSpeed', 'looseLeftSpeed', 'looseRightSpeed'].every(key => state[key] === 0));
      assert.ok(state.beltLinearSpeeds.every(speed => speed === 0));
      assert.ok(state.beltAxialSpeeds[0] * state.beltAxialSpeeds[1] > 0,
        'both bands move in the same axial direction during each stopped shift');
    } else {
      assert.ok(state.driverSpeed > 0 && state.outputSpeed > 0);
      if (stage === 0) {
        assert.ok(state.looseLeftSpeed > state.outputSpeed);
        near(state.looseRightSpeed, 0);
        near(state.outputSpeed / state.driverSpeed, (0.7325 + 0.01015) / (1.2625 + 0.01015));
      } else {
        near(state.looseLeftSpeed, 0);
        assert.ok(state.looseRightSpeed > 0 && state.looseRightSpeed < state.outputSpeed,
          'the unselected right loose pulley turns independently of the quicker shaft');
        near(state.outputSpeed / state.driverSpeed, (1.3 + 0.01015) / (1.2625 + 0.01015));
      }
    }
  }
});

test('060 material flow agrees with the actual neutral-fiber curve tangent on both upper and lower wraps', () => {
  const counts = [0, 0, 0, 0];
  for (const time of [0.731, 1.527, 3.827, 4.781]) {
    setTime(time);
    const state = model.root.userData.kinematics;
    assert.ok(Math.abs(state.beltLinearSpeeds[0]) > Math.abs(state.beltLinearSpeeds[1]),
      'the large and small upper pulleys give their bands different linear speeds');
    for (const [i, name] of ['leftBelt', 'rightBelt'].entries()) {
      const curve = parts[name].userData.curve, speed = state.beltLinearSpeeds[i];
      const lowerOmega = i === 0 ? (state.mode === 'slow' ? state.looseLeftSpeed : state.outputSpeed)
        : (state.mode === 'slow' ? state.outputSpeed : state.looseRightSpeed);
      for (let sample = 0; sample < 1024; sample += 1) {
        const u = (sample + 0.371) / 1024, q = curve.getPointAt(u), tangent = curve.getTangentAt(u);
        let centerY, omega, wrap;
        if (q.y > p.driverHeight + 0.1 && Math.abs(Math.hypot(q.x, q.y - p.driverHeight) - p.driverPitchRadii[i]) < 1e-8) {
          centerY = p.driverHeight; omega = state.driverSpeed; wrap = 0;
        } else if (q.y < -0.1 && Math.abs(Math.hypot(q.x, q.y) - p.lowerPitchRadius) < 1e-8) {
          centerY = 0; omega = lowerOmega; wrap = 1;
        } else continue;
        const error = Math.hypot(tangent.x * speed + omega * (q.y - centerY), tangent.y * speed - omega * q.x) / Math.abs(speed);
        assert.ok(error < 1e-9, `${name}: correct flow direction and no neutral-fiber slip`);
        counts[2 * i + wrap] += 1;
      }
    }
  }
  assert.ok(counts.every(count => count > 400), 'each band has independently checked upper and lower wraps');
});

test('060 group motion, belt translation and color flow are repeatable through negative and multiple cycles', () => {
  const dt = 1e-5, groups = ['driver', 'output', 'looseLeft', 'looseRight'], bands = ['leftBelt', 'rightBelt'];
  const boundaries = [0, p.dwellDuration, p.stageDuration, p.stageDuration + p.dwellDuration, p.cycleDuration];
  for (const time of [-13.37, -2.11, 0.731, 2.85, 3.827, 6.15, 9.14, 13.79, ...boundaries]) {
    setTime(time - dt);
    const beforeAngles = groups.map(name => blocks[name].rotation.z), beforeZ = bands.map(name => parts[name].position.z);
    const before = model.root.userData.kinematics;
    setTime(time + dt);
    const afterAngles = groups.map(name => blocks[name].rotation.z), afterZ = bands.map(name => parts[name].position.z);
    const after = model.root.userData.kinematics;
    setTime(time);
    const state = model.root.userData.kinematics;
    groups.forEach((name, i) => near((afterAngles[i] - beforeAngles[i]) / (2 * dt), state[`${name}Speed`], 2e-7));
    bands.forEach((name, i) => {
      near((afterZ[i] - beforeZ[i]) / (2 * dt), state.beltAxialSpeeds[i], 2e-7);
      near((after.beltDistances[i] - before.beltDistances[i]) / (2 * dt), state.beltLinearSpeeds[i], 2e-7);
    });
    const matrices = Object.values(parts).map(mesh => mesh.matrixWorld.clone());
    const colors = bands.map(name => parts[name].geometry.attributes.color.array.slice());
    setTime(time + 9.317); setTime(time);
    Object.values(parts).forEach((mesh, i) => assert.ok(mesh.matrixWorld.equals(matrices[i])));
    bands.forEach((name, i) => assert.deepEqual(parts[name].geometry.attributes.color.array, colors[i]));
  }
  for (const time of boundaries) {
    const before = motion.atTime(time - dt), after = motion.atTime(time + dt);
    near(before.driverSpeed, 0, 1e-8); near(after.driverSpeed, 0, 1e-8);
    near((after.driverSpeed - before.driverSpeed) / (2 * dt), 0, 0.0001);
    after.beltAxialSpeeds.forEach((speed, i) => near((speed - before.beltAxialSpeeds[i]) / (2 * dt), 0, 0.0002));
  }
});
