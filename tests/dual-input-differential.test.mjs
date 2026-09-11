import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeDualInputDifferential } from '../src/simulation/dual-input-differential.js';
import { surfaceTriangles, surfacePoints, solidSurface } from './helpers/solid-surface.mjs';
import { MovementEngine } from '../src/simulation/engine.js';
import { createMovementModel } from '../src/simulation/registry.js';
import { readFile } from 'node:fs/promises';
import { triangleTree, meshPairDistance } from '../scripts/lib/star-mangle-pair-distance.mjs';

const model = makeDualInputDifferential(), { parts, blocks, geometry: p, motion } = model.root.userData;
const setTime = time => { model.update(time); model.root.updateMatrixWorld(true); };
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);

test('062 has nineteen closed solids with consistent outward normals and independent bearings', () => {
  for (const configuration of ['open', 'crossed']) {
    model.root.userData.setConfiguration(configuration);
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
  }
  assert.equal(Object.keys(parts).length, 19);
  for (const [name, top, bottom] of [['driverDrum',141,695],['sideDriverDrum',264,554],['loosePulley',791,1361],
    ['directPulley',793,1363],['carrierPulley',792,1363],['sidePulley',791,1361]]) {
    setTime(0); const box = new THREE.Box3().setFromObject(parts[name],true);
    assert.ok(Math.abs(1066 - 200 * box.max.y - top) < 14);
    assert.ok(Math.abs(1066 - 200 * box.min.y - bottom) < 14);
  }
  for (const gear of Object.values(model.root.userData.gears)) {
    const { pitchConeAngle: delta, innerDistance, outerDistance, mesh } = gear.userData;
    const outer = outerDistance / Math.cos(delta) ** 2, inner = innerDistance / Math.cos(delta) ** 2;
    for (let i=0;i<mesh.geometry.attributes.position.count;i+=1) {
      const point = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);
      const end = point.z + Math.hypot(point.x,point.y) * Math.tan(delta);
      assert.ok(Math.min(Math.abs(end-inner),Math.abs(end-outer)) < 2e-7,
        'every heel/toe vertex lies on a cone normal to the pitch generator');
    }
  }
});

test('062 bores, planet spindle and supporting webs clear independently moving members', () => {
  const pairs = [['outputShaft', 'loosePulley'], ['outputShaft', 'sideGearBody'],
    ['sideGearBody', 'carrierPulley'], ['planetSpindle', 'planetBody'],
    ['innerSpindleCollar', 'planetBody'], ['outerSpindleCollar', 'planetBody'],
    ['carrierPulley', 'sideGearTeeth'], ['outputShaft', 'planetSpindle']];
  const data = Object.fromEntries([...new Set(pairs.flat())].map(name => [name,
    { mesh: parts[name], solid: solidSurface(parts[name].geometry), points: surfacePoints(parts[name].geometry), tree: triangleTree(parts[name].geometry) }]));
  for (const configuration of ['open', 'crossed']) for (const time of [0.811, 2.5, 6.0]) {
    model.root.userData.setConfiguration(configuration);
    setTime(time);
    for (const [first, second] of pairs) {
      const a = data[first], b = data[second], transform = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      const contact = meshPairDistance(a.tree, b.tree, transform, 0.01);
      assert.ok(contact.distance > 0.004, `${first}/${second}: genuine skin clearance, including crossed-shaft failure mode`);
      for (const [from, to] of [[a, b], [b, a]]) {
        const matrix = to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
        for (const point of from.points) assert.equal(to.solid.inside(point.clone().applyMatrix4(matrix)), false,
          `${first}/${second}: no full containment in a false solid bore`);
      }
    }
  }
});

test('062 actual opposed bevel flanks transmit both torque directions through a tooth period', () => {
  const sourceTree = triangleTree(parts.planetTeeth.geometry);
  for (const configuration of ['open', 'crossed']) for (const name of ['outputGearTeeth', 'sideGearTeeth']) for (const direction of [-1, 1]) {
    model.root.userData.setConfiguration(configuration);
    const axisSign = name === 'outputGearTeeth' ? -1 : 1;
    const faces = surfaceTriangles(parts[name].geometry).filter(face => {
      const center = face.getMidpoint(new THREE.Vector3()), normal = face.getNormal(new THREE.Vector3());
      return direction * axisSign * -center.clone().cross(normal).z > 0.1 * Math.hypot(center.x, center.y);
    });
    const targetTree = triangleTree(new THREE.BufferGeometry().setFromPoints(faces.flatMap(({ a,b,c }) => [a,b,c])));
    for (let i = 0; i < 9; i += 1) {
      const delta = motion.plans[configuration].deltas[2];
      const progress = (2 * Math.PI / p.sideTeeth) / (delta.output - delta.carrier) * (i + 0.317) / 9;
      let low = 0, high = 1;
      for (let step = 0; step < 50; step += 1) {
        const u = (low + high) / 2;
        if (u ** 3 * (10 - 15 * u + 6 * u ** 2) < progress) low = u; else high = u;
      }
      setTime(p.stageStarts[2] + p.dwellDurations[2] * (low + high) / 2);
      const state = model.root.userData.kinematics, a = parts.planetTeeth, b = parts[name];
      const contact = meshPairDistance(sourceTree, targetTree, b.matrixWorld.clone().invert().multiply(a.matrixWorld), 0.001);
      assert.ok(contact.witness && contact.distance > 0.00002 && contact.distance < 0.00008);
      const pa = new THREE.Vector3().fromArray(contact.witness.a).applyMatrix4(b.matrixWorld);
      const pb = new THREE.Vector3().fromArray(contact.witness.b).applyMatrix4(b.matrixWorld);
      const normal = pb.clone().sub(pa).normalize(), apex = new THREE.Vector3(0,0,p.bevelCenterZ);
      const axis = new THREE.Vector3(Math.cos(state.carrierAngle),Math.sin(state.carrierAngle),0);
      const torqueA = pa.clone().sub(apex).cross(normal.clone().negate()).dot(axis);
      const torqueB = pb.clone().sub(apex).cross(normal).z;
      assert.ok(direction * torqueB > 0, 'the actual compressive normal provides the requested torque direction');
      const powerA = torqueA * state.planetSpeed;
      const powerB = torqueB * ((name === 'outputGearTeeth' ? state.outputSpeed : state.sideSpeed) - state.carrierSpeed);
      assert.ok(Math.abs(powerA + powerB) / Math.max(Math.abs(powerA),Math.abs(powerB)) < 0.004,
        'actual contact normals conserve pairwise power in the carrier frame within tessellation error');
    }
  }
});

test('062 both installed flat bands retain working contact during every selection and stopped shift', () => {
  const lower = ['loosePulley', 'directPulley', 'carrierPulley'];
  for (const configuration of ['open', 'crossed']) {
    model.root.userData.setConfiguration(configuration);
    const names = ['belt', 'sideBelt', 'driverDrum', 'sideDriverDrum', 'sidePulley', ...lower];
    const trees = Object.fromEntries(names.map(name => [name, triangleTree(parts[name].geometry)]));
    const check = (a, b) => {
      const contact = meshPairDistance(trees[a], trees[b], parts[b].matrixWorld.clone().invert().multiply(parts[a].matrixWorld), 0.001);
      assert.ok(contact.witness && contact.distance > 0.00012 && contact.distance < 0.00020, `${configuration}: ${a}/${b} contact`);
    };
    for (let stage = 0; stage < 4; stage += 1) {
      setTime(p.stageStarts[stage] + p.dwellDurations[stage] / 2);
      check('belt', 'driverDrum'); check('belt', lower[p.selectionSequence[stage]]);
      check('sideBelt', 'sideDriverDrum'); check('sideBelt', 'sidePulley');
      setTime(p.stageStarts[stage] + p.dwellDurations[stage] + p.shiftDuration / 2);
      check('belt', lower[p.selectionSequence[stage]]);
      check('belt', lower[p.selectionSequence[(stage + 1) % 4]]);
      assert.ok(parts.belt.visible && parts.sideBelt.visible, 'both installed bands remain present');
    }
  }
});

test('062 actual shaft motion and material flow preserve the differential and belt speed relations in both configurations', () => {
  const groups = ['driver', 'side', 'output', 'carrier', 'planet', 'loose'], dt = 1e-5;
  let wrapSamples = 0;
  for (const configuration of ['open', 'crossed']) {
    model.root.userData.setConfiguration(configuration);
    for (const time of [-31.37, -1e-15, 0.2, 0.95, 2.7, 4.25, 5.91, 7.55, 9.21, 10.85, 17.61]) {
      setTime(time - dt); const before = groups.map(name => blocks[name].rotation.z), beforeFlow = model.root.userData.kinematics;
      setTime(time + dt); const after = groups.map(name => blocks[name].rotation.z), afterFlow = model.root.userData.kinematics;
      setTime(time); const state = model.root.userData.kinematics;
      groups.forEach((name, i) => near((after[i] - before[i]) / (2 * dt), state[`${name}Speed`], 2e-7));
      near((afterFlow.beltDistance - beforeFlow.beltDistance) / (2 * dt), state.beltLinearSpeed, 2e-7);
      near((afterFlow.sideBeltDistance - beforeFlow.sideBeltDistance) / (2 * dt), state.sideBeltLinearSpeed, 2e-7);
      near(state.outputSpeed + state.sideSpeed, 2 * state.carrierSpeed);
      near(state.planetSpeed * p.planetTeeth, p.sideTeeth * (state.outputSpeed - state.carrierSpeed));
      near(state.planetSpeed * p.planetTeeth, p.sideTeeth * (state.carrierSpeed - state.sideSpeed));
      near(state.sideSpeed, state.orientationSign * p.sideRatio * state.driverSpeed);
      if (state.selected === 2) near(state.carrierSpeed, p.mainRatio * state.driverSpeed);
      else near(state.outputSpeed, p.mainRatio * state.driverSpeed);
      if (state.inputStopped) assert.ok(groups.every(name => state[`${name}Speed`] === 0));
      const matrices = Object.values(parts).map(mesh => mesh.matrixWorld.clone());
      const colors = [parts.belt, parts.sideBelt].map(mesh => mesh.geometry.attributes.color.array.slice());
      setTime(time + 13.711); setTime(time);
      Object.values(parts).forEach((mesh, i) => assert.ok(mesh.matrixWorld.equals(matrices[i])));
      [parts.belt, parts.sideBelt].forEach((mesh, i) => assert.deepEqual(mesh.geometry.attributes.color.array, colors[i]));
      if (state.driverSpeed <= 1e-6) continue;
      for (const [mesh, speed, lowerOmega] of [
        [parts.belt, state.beltLinearSpeed, state.selected === 1 ? state.outputSpeed : state.carrierSpeed],
        [parts.sideBelt, state.sideBeltLinearSpeed, state.sideSpeed],
      ]) {
        const curve = mesh.userData.curve, lengths = curve.getCurveLengths();
        for (let i = 0; i < 256; i += 1) {
          const u = (i + 0.371) / 256, distance = curve.getUtoTmapping(u) * lengths.at(-1);
          const component = lengths.findIndex(end => distance <= end);
          if (![1, 3].includes(component) || Math.min(distance - lengths[component - 1], lengths[component] - distance) < 0.01) continue;
          const q = curve.getPointAt(u), tangent = curve.getTangentAt(u);
          const centerY = component === 3 ? p.driverHeight : 0, omega = component === 3 ? state.driverSpeed : lowerOmega;
          const residual = Math.hypot(tangent.x * speed + omega * (q.y - centerY), tangent.y * speed - omega * q.x, tangent.z * speed) / Math.abs(speed);
          assert.ok(residual < 1e-9, `${configuration}: actual neutral-fiber wrap velocity`); wrapSamples += 1;
        }
      }
    }
  }
  assert.ok(wrapSamples > 2000);
});

test('062 changing installed configuration replaces one band and restarts the engine deterministically', () => {
  const engine = Object.create(MovementEngine.prototype);
  Object.assign(engine, { model, elapsed: 6, playing: false, clock: { getDelta() {} },
    updateGroundClearance() { model.root.updateMatrixWorld(true); }, fitCamera(direction) { this.fittedDirection = direction; } });
  model.root.userData.setConfiguration('open'); setTime(6);
  const mesh = parts.sideBelt, oldGeometry = mesh.geometry; let disposed = false;
  oldGeometry.addEventListener('dispose', () => { disposed = true; });
  assert.equal(engine.setConfiguration('crossed'), true);
  assert.equal(engine.elapsed, 0); assert.equal(engine.playing, false);
  assert.equal(model.root.userData.kinematics.time, 0);
  assert.equal(model.root.userData.configuration, 'crossed');
  assert.equal(mesh, parts.sideBelt); assert.notEqual(mesh.geometry, oldGeometry); assert.equal(disposed, true);
  const positions = mesh.geometry.attributes.position.array.slice();
  const matrices = Object.values(parts).map(part => part.matrixWorld.clone());
  engine.playing = true; engine.setConfiguration('open'); engine.setConfiguration('crossed');
  assert.equal(engine.playing, true); assert.deepEqual(mesh.geometry.attributes.position.array, positions);
  assert.throws(() => engine.setConfiguration('invalid'), RangeError);
  for (const enabled of [false, true]) {
    model.root.userData.setSectionView(enabled); model.root.updateMatrixWorld(true);
    Object.values(parts).forEach((part, i) => assert.ok(part.matrixWorld.equals(matrices[i])));
    assert.equal(model.root.userData.sectionCaps.visible, enabled);
  }
});

test('062 measured playback covers the faster crossed configuration', async () => {
  const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
  const profiles = JSON.parse(await readFile('src/data/display-profiles.json', 'utf8')).profiles[62];
  assert.deepEqual(profiles.configurationMeasurements.map(row => row.configuration), ['open', 'crossed']);
  assert.ok(profiles.configurationMeasurements[1].peakVisibleAngularSpeed > profiles.configurationMeasurements[0].peakVisibleAngularSpeed);
  assert.equal(profiles.sustainedVisibleAngularSpeed, Math.max(...profiles.configurationMeasurements.map(row => row.sustainedVisibleAngularSpeed)));
  const actual = createMovementModel(catalog.movements[61]), scale = actual.root.userData.animationTiming.playbackTimeScale;
  const previous = new THREE.Quaternion(), next = new THREE.Quaternion(), dt = 1e-5;
  for (const configuration of ['open', 'crossed']) {
    actual.root.userData.setConfiguration(configuration);
    for (let i = 0; i < 33; i += 1) for (const name of ['driver', 'output', 'side', 'carrier', 'planet']) {
      const time = p.cycleDuration * i / 32, group = actual.root.userData.blocks[name];
      actual.update(time); actual.root.updateMatrixWorld(true); group.getWorldQuaternion(previous);
      actual.update(time + dt); actual.root.updateMatrixWorld(true); group.getWorldQuaternion(next);
      const delta = previous.clone().invert().multiply(next).normalize();
      const speed = 2 * Math.atan2(Math.hypot(delta.x, delta.y, delta.z), Math.abs(delta.w)) / dt;
      assert.ok(speed * scale < 3 * Math.PI * 2, `${configuration}/${name}: readable visible shaft speed`);
    }
  }
});
