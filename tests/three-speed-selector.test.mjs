import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeThreeSpeedSelector } from '../src/simulation/three-speed-selector.js';
import { surfacePoints, solidSurface } from './helpers/solid-surface.mjs';
import { gearBoundary, boundaryIndex, planarPairDistance } from '../scripts/lib/coaxial-planar-distance.mjs';
import { triangleTree, meshPairDistance } from '../scripts/lib/star-mangle-pair-distance.mjs';

const model = makeThreeSpeedSelector(), { parts, blocks, geometry: p, motion } = model.root.userData;
const setTime = time => { model.update(time); model.root.updateMatrixWorld(true); };
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);
// Every indexed triangle, including slivers that the shared surface helper drops,
// so each face stays aligned with its vertex normals and closes the edge graph.
const indexedTriangles = g => Array.from({ length: (g.index?.count ?? g.attributes.position.count) / 3 }, (_, i) => new THREE.Triangle(...[0, 1, 2]
  .map(j => new THREE.Vector3().fromBufferAttribute(g.attributes.position, g.index ? g.index.getX(3 * i + j) : 3 * i + j))));

test('058 has seventeen closed solids with consistent outward normals and independent bearings', () => {
  for (const [name, mesh] of Object.entries(parts)) {
    const g = mesh.geometry, edges = new Map(); let volume = 0;
    for (const [i, face] of indexedTriangles(g).entries()) {
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
  assert.equal(Object.keys(parts).length, 17);
  for (let i = 0; i < 3; i += 1) {
    assert.equal(parts[`inputGear${i}`].parent, blocks.inputs[i]);
    assert.equal(parts[`inputShaft${i}`].parent, blocks.inputs[i]);
    assert.equal(parts[`inputPulley${i}`].parent, blocks.inputs[i]);
    assert.equal(parts[`outputGear${i}`].parent, blocks.output);
  }
  assert.notEqual(parts.loosePulley.parent, blocks.inputs[0]);
});

test('058 has separate working flanks for driving and back-driving every gear pair', () => {
  for (let pair = 0; pair < 3; pair += 1) {
    const input = parts[`inputGear${pair}`], output = parts[`outputGear${pair}`];
    const points = gearBoundary(input), target = boundaryIndex(gearBoundary(output));
    const times = [];
    for (let i = 0; i < 257; i += 1) {
      // Invert the first engaged dwell to cover one complete relative output tooth.
      const progress = 2 * Math.PI / p.driverTurnPerDwell * p.outputTeeth[0]
        / (p.inputTeeth[0] * p.outputTeeth[pair]) * (i + 0.317) / 257;
      let low = 0, high = 1;
      for (let step = 0; step < 50; step += 1) {
        const u = (low + high) / 2;
        if (u ** 3 * (10 - 15 * u + 6 * u ** 2) < progress) low = u; else high = u;
      }
      times.push(p.stageDuration + p.dwellDuration * (low + high) / 2);
    }
    for (let stage = 1; stage < 6; stage += 1) times.push(stage * p.stageDuration + 0.917);
    for (const time of times) {
      setTime(time);
      const transform = output.matrixWorld.clone().invert().multiply(input.matrixWorld);
      const state = model.root.userData.kinematics;
      for (const direction of [-1, 1]) {
        const accepts = (a, b) => direction * (b.y * (a.x - b.x) - b.x * (a.y - b.y)) > 0;
        const result = planarPairDistance(points, target, transform, 0.005, accepts);
        assert.equal(result.intersections, 0, 'both tooth skins remain disjoint');
        assert.ok(result.witness && result.distance > 0.00002 && result.distance < 0.000035, 'each flank retains a small working gap');
        const { a, b } = result.witness;
        const nx = (a.x - b.x) / result.distance, ny = (a.y - b.y) / result.distance;
        const inputTorque = (a.x - transform.elements[12]) * ny - (a.y - transform.elements[13]) * nx;
        const outputTorque = b.y * nx - b.x * ny;
        const inputPower = inputTorque * state.inputSpeeds[pair], outputPower = outputTorque * state.outputSpeed;
        assert.ok(direction * outputTorque > 0, 'the chosen compressive normal provides the requested torque');
        assert.ok(Math.abs(inputPower + outputPower) / Math.max(Math.abs(inputPower), Math.abs(outputPower)) < 0.0025,
          'rendered flank normals conserve pairwise power within tessellation error');
        if (direction === (state.selected === pair + 1 ? -1 : 1)) {
          assert.ok(state.selected === pair + 1 ? outputPower > 0 : inputPower > 0,
            'the selected input drives the output; the output drives each unselected member');
        }
      }
    }
  }
});

test('058 real nested bores clear the independently rotating shafts and gear bodies', () => {
  const pairs = [['inputShaft0', 'loosePulley'], ['inputShaft0', 'inputShaft1'], ['inputShaft0', 'inputShaft2'],
    ['inputShaft0', 'inputGear1'], ['inputShaft0', 'inputGear2'], ['inputShaft1', 'inputShaft2'], ['inputShaft1', 'inputGear2']];
  const names = [...new Set(pairs.flat())];
  const data = Object.fromEntries(names.map(name => [name, { mesh: parts[name], solid: solidSurface(parts[name].geometry), points: surfacePoints(parts[name].geometry) }]));
  for (const time of [0, 0.731, 4.19, 7.51, 11.13, 17.57]) {
    setTime(time);
    for (const [first, second] of pairs) for (const [a, b] of [[data[first], data[second]], [data[second], data[first]]]) {
      const transform = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for (const point of a.points) {
        const q = point.clone().applyMatrix4(transform);
        if (b.solid.inside(q)) assert.ok(b.solid.distance(q) < 1e-6, `${first}/${second}: no shaft or bore penetration`);
      }
    }
  }
});

test('058 flat belt remains in contact with every lane and bridges both treads during a stopped shift', () => {
  const names = ['driverDrum', 'loosePulley', 'inputPulley0', 'inputPulley1', 'inputPulley2'];
  const trees = Object.fromEntries(['belt', ...names].map(name => [name, triangleTree(parts[name].geometry)]));
  const solids = Object.fromEntries(names.map(name => [name, solidSurface(parts[name].geometry)]));
  const points = surfacePoints(parts.belt.geometry);
  assert.equal(parts.belt.userData.crossSection, 'rectangular');
  assert.ok(p.beltWidth > 15 * p.beltThickness);
  for (let stage = 0; stage < 4; stage += 1) for (const shifting of [false, true]) {
    const time = stage * p.stageDuration + (shifting ? p.dwellDuration + p.shiftDuration / 2 : 0.731);
    setTime(time);
    const state = model.root.userData.kinematics;
    const contactLanes = shifting ? [state.selected, state.next] : [state.selected];
    for (const name of names) {
      const transform = parts[name].matrixWorld.clone().invert().multiply(parts.belt.matrixWorld);
      for (const point of points) {
        const q = point.clone().applyMatrix4(transform);
        assert.equal(solids[name].inside(q), false, `${name}: no belt intrusion`);
      }
      const lane = name === 'loosePulley' ? 0 : Number(name.at(-1)) + 1;
      if (name !== 'driverDrum' && !contactLanes.includes(lane)) continue;
      const result = meshPairDistance(trees.belt, trees[name], transform, 0.001);
      assert.ok(result.witness && result.distance > 0.00012 && result.distance < 0.00020, `${name}: actual working tread contact`);
    }
    if (shifting) {
      assert.ok(state.driverSpeed === 0 && state.outputSpeed === 0);
      assert.ok(state.inputSpeeds.every(speed => speed === 0));
      assert.ok(Math.abs(state.beltAxialSpeed) > 0.1);
    } else {
      const selectedSpeed = state.selected === 0 ? state.looseSpeed : state.inputSpeeds[state.selected - 1];
      near(selectedSpeed, state.driverSpeed);
      near(state.beltLinearSpeed, -p.beltPitchRadius * selectedSpeed);
    }
  }
});

test('058 shaft ratios, stopped traversals and belt material flow survive arbitrary seeking', () => {
  const dt = 1e-5;
  const boundaries = p.selectionSequence.flatMap((_, stage) => [stage * p.stageDuration, stage * p.stageDuration + p.dwellDuration]);
  const times = [-31.37, -2.17, 0.811, 2.79, 4.32, 7.39, 11.27, 17.63, 25.79, ...boundaries];
  for (const time of times) {
    setTime(time);
    const state = model.root.userData.kinematics, before = motion.atTime(time - dt), after = motion.atTime(time + dt);
    const matrices = Object.values(parts).map(mesh => mesh.matrixWorld.clone());
    const colors = parts.belt.geometry.attributes.position.array.slice();
    for (const [angle, speed] of [['driverAngle', 'driverSpeed'], ['outputAngle', 'outputSpeed'], ['looseAngle', 'looseSpeed'], ['beltZ', 'beltAxialSpeed'], ['beltDistance', 'beltLinearSpeed']]) {
      near((after[angle] - before[angle]) / (2 * dt), state[speed], 2e-7);
    }
    for (let i = 0; i < 3; i += 1) {
      near((after.inputAngles[i] - before.inputAngles[i]) / (2 * dt), state.inputSpeeds[i], 2e-7);
      near(p.inputTeeth[i] * state.inputSpeeds[i] + p.outputTeeth[i] * state.outputSpeed, 0);
      near(p.inputTeeth[i] * state.inputAngles[i] + p.outputTeeth[i] * state.outputAngle, 0);
    }
    setTime(time + 5.31); setTime(time);
    Object.values(parts).forEach((mesh, i) => assert.ok(mesh.matrixWorld.equals(matrices[i])));
    assert.deepEqual(parts.belt.geometry.attributes.position.array, colors);
  }
  for (const time of boundaries) {
    const before = motion.atTime(time - dt), after = motion.atTime(time + dt);
    near(before.driverSpeed, 0, 1e-8); near(after.driverSpeed, 0, 1e-8);
    near((after.driverSpeed - before.driverSpeed) / (2 * dt), 0, 0.0001);
    near((after.beltAxialSpeed - before.beltAxialSpeed) / (2 * dt), 0, 0.0002);
  }
});
