import assert from 'node:assert/strict';
import test, {after} from 'node:test';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {makeWeightedClutch} from '../src/simulation/weighted-clutch.js';
import profile from '../src/data/weighted-clutch-profile.js';
import {makeWeightedClutchDistributedCandidate} from '../scripts/lib/weighted-clutch-distributed-candidate.mjs';
import {makeWeightedClutchNativeJawsPruned} from '../scripts/lib/weighted-clutch-native-jaws-pruned.mjs';
import {makeWeightedClutchNativeStud} from '../scripts/lib/weighted-clutch-native-stud.mjs';
import {makeWeightedClutchNativeCouplings} from '../scripts/lib/weighted-clutch-native-couplings.mjs';
import {makeWeightedClutchNativeKey} from '../scripts/lib/weighted-clutch-native-key.mjs';
import {createMovementModel} from '../src/simulation/registry.js';
import {MovementEngine} from '../src/simulation/engine.js';
const catalog = JSON.parse(readFileSync(new URL('../src/data/movements.json', import.meta.url)));

const model = makeWeightedClutch(), u = model.root.userData;
const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
function dispose(model) {
  const geometries = new Set(), materials = new Set();
  model.root.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) for (const m of [o.material].flat()) materials.add(m); });
  for (const g of geometries) g.dispose(); for (const m of materials) m.dispose();
}
after(() => dispose(model));

test('087 promoted solids and articulation match the independently checked reconstruction', () => {
  const candidate = makeWeightedClutchDistributedCandidate(profile.options), v = candidate.root.userData;
  assert.deepEqual(u.source, v.source); assert.deepEqual(u.geometry, v.geometry);
  assert.deepEqual(u.families, v.families); assert.equal(Object.keys(u.parts).length, 213);
  for (const [name, mesh] of Object.entries(u.parts)) {
    const other = v.parts[name];
    for (const [key, attribute] of Object.entries(mesh.geometry.attributes)) assert.deepEqual(attribute.array, other.geometry.attributes[key].array, name + '/' + key);
    assert.deepEqual(mesh.geometry.index?.array, other.geometry.index?.array, name + ' faces');
  }
  for (const time of [0, .9, 1.22, 1.35, 8, 12.2, 13.05, 13.35, 23.99, 24.01, 49]) {
    const state = u.stateAtTime(time); model.update(time); candidate.setCoordinates(state.q, state.inputAngle);
    for (const [name, mesh] of Object.entries(u.parts)) assert.deepEqual(mesh.matrixWorld.elements, v.parts[name].matrixWorld.elements, name + ' transform');
  }
  dispose(candidate);
});

test('087 repeats two connected reversals while the input and gear rotations stay continuous', () => {
  assert.equal(profile.playbackPeriod, 24); near(profile.period, 37.5 * Math.PI);
  assert.equal(profile.provenance.endpointReplaced, false);
  for (let k = 1; k <= 5; k++) near(profile.samples[0][k], profile.samples.at(-1)[k], 1e-11);
  for (const time of [NaN, Infinity, -Infinity]) assert.throws(() => model.update(time), /Nonfinite/);
  assert.deepEqual(u.stateAtTime(-1), u.stateAtTime(0));
  for (let i = 0; i <= 300; i++) {
    const time = i * 24 / 300, a = u.stateAtTime(time), b = u.stateAtTime(time + 24);
    for (let k = 0; k < 5; k++) near(a.q[k], b.q[k]);
    near(b.inputAngle - a.inputAngle, profile.omegaInput * profile.period);
  }
  const seam = (profile.period - profile.phaseOffset) / model.motion.rate;
  for (let cycle = 0; cycle < 4; cycle++) {
    const time = seam + cycle * 24, a = u.stateAtTime(time - 1e-7), b = u.stateAtTime(time + 1e-7);
    for (let k = 0; k < 5; k++) near(a.q[k], b.q[k], 2e-7);
    model.update(time - 1e-7); const before = u.gears.input.userData.rotor.rotation.z;
    model.update(time + 1e-7); near(u.gears.input.userData.rotor.rotation.z - before, 2e-7 * model.motion.rate * profile.omegaInput);
  }
});

test('087 finite rod pins close throughout the swing and both seated output directions occur', () => {
  let left = 0, right = 0;
  const rodEnd = new THREE.Vector3(), pin = new THREE.Vector3(), p = u.linkage.parameters;
  for (let i = 0; i <= 400; i++) {
    const time = i * 24 / 400, state = u.stateAtTime(time); model.update(time);
    for (const [part, x] of [['leverRodPin', 0], ['bellRodPin', p.rodLength]]) {
      rodEnd.set(x, 0, 0).applyMatrix4(u.blocks.rod.matrixWorld); u.parts[part].getWorldPosition(pin);
      near(rodEnd.x, pin.x); near(rodEnd.y, pin.y);
    }
    const next = u.stateAtTime(time + 1e-5), speed = (next.q[3] - state.q[3]) / 1e-5;
    if (state.q[2] < -.2468 && Math.abs(speed + .12 * model.motion.rate) < 1e-5) left++;
    if (state.q[2] > .00018 && Math.abs(speed - .12 * model.motion.rate) < 1e-5) right++;
    assert.ok(Math.abs(state.q[3] - state.q[4]) < .006253, 'shaft feather exceeds native key clearance');
  }
  assert.ok(left > 100 && right > 100, 'both jaw seats transmit sustained rotation');
  near(u.gears.E.position.y, 0); near(u.gears.E.position.distanceTo(u.gears.pinion.position), 0);
  assert.ok(u.sourceAdjustments.maximumDisplacement <= 32 + 1e-8);
});

test('087 native jaw faces remain clear over four playback periods, including both transfers', t => {
  const jaws = makeWeightedClutchNativeJawsPruned(model), stud = makeWeightedClutchNativeStud(model);
  const coupling = makeWeightedClutchNativeCouplings(model), key = makeWeightedClutchNativeKey(model);
  const localTimes = [...Array.from({length: 17}, (_, i) => profile.period * i / 16)];
  const arrivals = profile.events.filter(e => e.kind === 'next-stud');
  for (const event of arrivals) for (let i = 0; i <= 24; i++) localTimes.push(event.time + i * 8 / 24);
  let minimumJawGap = Infinity, minimumStudGap = Infinity, minimumCouplingGap = Infinity, samples = 0;
  for (let cycle = 1; cycle <= 4; cycle++) for (const localTime of localTimes) {
    const time = (localTime - profile.phaseOffset) / model.motion.rate + cycle * 24;
    const {q, inputAngle} = u.stateAtTime(time);
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const gap = jaws.evaluate(side, q[4] + sign * u.geometry.mainRatio * inputAngle, q[2]).gap;
      minimumJawGap = Math.min(minimumJawGap, gap); assert.ok(gap > -1e-6, `${side} jaw intersects at ${time}: ${gap}`);
    }
    const gap = stud.evaluate(q[0], q[3] / u.geometry.eRatio).gap;
    minimumStudGap = Math.min(minimumStudGap, gap); assert.ok(gap > -1e-6, 'stud intersects bell crank');
    for (const c of [...coupling.query(q), ...key.query(q)]) {
      minimumCouplingGap = Math.min(minimumCouplingGap, c.gap); assert.ok(c.gap > -1e-6, c.kind + ' intersects');
    }
    samples++;
  }
  t.diagnostic(JSON.stringify({samples, minimumJawGap, minimumStudGap, minimumCouplingGap}));
});

test('087 fitted camera contains moving rendered solids at narrow, square and wide aspect ratios', () => {
  const registered = createMovementModel(catalog.movements[86]);
  const camera = new THREE.PerspectiveCamera(36, 1, .05, 100);
  const controls = {target: new THREE.Vector3(), update() {camera.lookAt(this.target); camera.updateMatrixWorld(true);}};
  const engine = {model: registered, camera, controls, container: {clientWidth: 1000, clientHeight: 1000}};
  const point = new THREE.Vector3();
  for (const aspect of [.7, 1, 2.4]) {
    engine.container.clientWidth = aspect * 1000; registered.update(0);
    MovementEngine.prototype.fitCamera.call(engine, registered.cameraDirection);
    for (const time of [0, .8, 1.3, 8, 12.8, 13.5, 18, 23.9, 47.9]) {
      registered.update(time);
      registered.root.traverseVisible(o => {
        const p = o.geometry?.attributes.position; if (!p) return;
        for (let i = 0; i < p.count; i++) {
          point.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).project(camera);
          assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && Math.abs(point.z) < 1, 'moving mesh outside fitted camera');
        }
      });
    }
  }
  assert.equal(registered.root.userData.hideGround, true);
  assert.ok(registered.root.userData.animationTiming.displayCycleDuration >= 24);
  dispose(registered);
});
