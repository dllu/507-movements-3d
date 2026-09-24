import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {applyDisplayTiming} from '../src/simulation/display-timing.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface} from './helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const movement = catalog.movements[186];

function withModel(run) {
  const model = createMovementModel(movement);
  try { return run(model, model.root.userData); } finally { disposeObject3D(model.root); }
}
const worldXY = (object, local = new THREE.Vector3()) => {
  object.updateWorldMatrix(true, false);
  return local.clone().applyMatrix4(object.matrixWorld);
};
const toRaster = (u, p) => u.sourceRasterFromPoint(p.x, p.y);
function near(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`);
}

test('187: catalog entry, authored contract and real-time display pace', () => withModel((model, u) => {
  assert.equal(movement.id, 187);
  assert.equal(movement.title, 'Two-Handle Cam-Lift Gab Disengaging Gear');
  assert.equal(movement.description, '187 and 188. Modifications of 186.');
  assert.equal(u.fidelity, 'authored');
  assert.equal(u.hideGround, true);
  assert.equal(u.geometry.cyclePeriod, 16);
  assert.equal(u.animationTiming.authoredCyclePeriod, 16);
  assert.equal(u.minimumDisplayCycleSeconds, 16);
  applyDisplayTiming(model, movement);
  near(u.animationTiming.displayCycleDuration, 16, 1e-9, 'display cycle plays in real time');
  assert.equal(typeof u.stateAtTime(0).stage, 'string');
  assert.ok(u.jointChecks.length >= 4);
  assert.equal(u.rigidBodies.length, 3);
  for (const [plate, pin] of u.jointChecks) {
    assert.ok(plate.isMesh);
    assert.equal(pin.geometry.type, 'CylinderGeometry');
  }
  model.root.traverse((object) => {
    for (const material of [object.material].flat()) if (material) assert.equal(material.fog, false);
    // Brown draws no frame, bearings, markers or index dots.
    assert.doesNotMatch(object.userData.role ?? '', /frame|marker|index|bearing|base/);
  });
  const others = [186, 188, 189].map((id) => createMovementModel(catalog.movements[id - 1]));
  try {
    for (const other of others) {
      assert.equal(other.root.userData.fidelity, 'authored');
      assert.notEqual(other.root.userData.mechanism, u.mechanism);
    }
  } finally { others.forEach((other) => disposeObject3D(other.root)); }
}));

test('187: t = 0 reproduces the plate landmarks', () => withModel((model, u) => {
  model.update(0);
  const b = u.blocks, g = u.geometry;
  const shaft = toRaster(u, worldXY(b.valveRocker));
  near(shaft.x, 313, 0.5, 'rockshaft x'); near(shaft.y, 111, 0.5, 'rockshaft y');
  const pin = toRaster(u, worldXY(b.valvePin));
  near(pin.x, 313, 0.5, 'gab pin x'); near(pin.y, 237.5, 0.5, 'gab pin y');
  const pivot = toRaster(u, worldXY(b.pivotPin));
  near(pivot.x, 319, 0.5, 'upper-handle pivot x'); near(pivot.y, 198, 0.5, 'upper-handle pivot y');
  near(g.pinRadius / g.sourceUnitsPerPixel, 16, 0.5, 'pin radius');
  near(g.crownRadius / g.sourceUnitsPerPixel, 56, 1, 'crown radius');
  const box = (mesh) => {
    mesh.updateWorldMatrix(true, false);
    const bounds = new THREE.Box3().setFromObject(mesh);
    const a = toRaster(u, bounds.min), c = toRaster(u, bounds.max);
    return {left: a.x, right: c.x, top: c.y, bottom: a.y};
  };
  const rod = box(b.rodBody);
  near(rod.left, 15, 2, 'broken rod end'); near(rod.right, 510, 3, 'lower grip end');
  near(rod.bottom, 258, 1, 'rod lower edge'); near(rod.top, 181.5, 1.5, 'crown top');
  const handle = box(b.upperHandleBody);
  near(handle.top, 174, 1, 'upper handle top edge'); near(handle.right, 505, 2, 'upper grip end');
  near(handle.left, 253, 20, 'upper handle (cam lobe hidden behind the crown)');
  const arm = box(b.valveArm);
  near(arm.top, 76, 2, 'rockshaft boss top'); near(arm.bottom, 283, 1.5, 'lower eye below the rod');
  // Stage at t = 0 is the engaged, running plate pose.
  const state = u.stateAtTime(0);
  assert.equal(state.gabEngaged, true);
  near(state.armAngle, 0, 1e-12, 'plate shows the valve arm plumb');
}));

test('187: every pinned joint stays assembled and bored over the cycle', () => withModel((model, u) => {
  const b = u.blocks, g = u.geometry;
  const checks = u.jointChecks.map(([plate, pin]) => ({plate, pin, surface: solidSurface(plate.geometry)}));
  // The gab pin also crosses the cam handle and rod layers.
  checks.push(...[b.upperHandleBody, b.rodBody].map((plate) => ({plate, pin: b.valvePin, surface: solidSurface(plate.geometry)})));
  const shaftRest = new THREE.Vector3(g.shaftCenter[0], g.shaftCenter[1], 0);
  for (let frame = 0; frame <= 96; frame++) {
    model.update(g.cyclePeriod * frame / 96);
    model.root.updateMatrixWorld(true);
    // shaft stays on its fixed axis; the arm rotates about it
    assert.ok(worldXY(b.valveShaft).setZ(0).distanceTo(shaftRest) < 1e-9);
    assert.ok(worldXY(b.valveRocker).distanceTo(shaftRest) < 1e-9);
    // pivot pin centre is the upper handle's rotation centre
    assert.ok(worldXY(b.pivotPin).setZ(0).distanceTo(worldXY(b.upperHandle).setZ(0)) < 1e-9);
    // gab pin centre is the arm's pin eye centre
    const eye = worldXY(b.valveArm, new THREE.Vector3(0, -g.armLength, 0)).setZ(0);
    assert.ok(worldXY(b.valvePin).setZ(0).distanceTo(eye) < 1e-9);
    for (const {plate, pin, surface} of checks) {
      const transform = plate.matrixWorld.clone().invert().multiply(pin.matrixWorld);
      const {radiusTop: radius, height} = pin.geometry.parameters;
      for (let axial = 0; axial <= 8; axial++) for (let k = 0; k < 32; k++) {
        const theta = k * Math.PI / 16;
        const point = new THREE.Vector3(radius * Math.cos(theta), height * (axial / 8 - 0.5), radius * Math.sin(theta))
          .applyMatrix4(transform);
        assert.equal(surface.inside(point), false, `${pin.userData.role} inside ${plate.userData.role} at frame ${frame}`);
      }
    }
  }
}));

test('187: gab captures the pin while running and the cam lifts it just clear', () => withModel((model, u) => {
  const g = u.geometry, s = g.sourceUnitsPerPixel;
  let engagedSamples = 0, clearSamples = 0;
  for (let i = 0; i <= 1600; i++) {
    const t = g.cyclePeriod * i / 1600, state = u.stateAtTime(t);
    // the cam bears on the pin top (within 0.02 source px) and never penetrates it
    assert.ok(state.camGap >= 0, `cam penetrates pin at ${t}`);
    assert.ok(state.camGap < 4e-4, `cam loses the pin at ${t}`);
    if (state.gabEngaged) {
      engagedSamples++;
      // pin seated in the slot: centred laterally and bearing on its crown
      assert.ok(Math.hypot(...state.pinInGab) < 1e-12);
      assert.ok(g.slotHalfWidth - g.pinRadius <= 0.005);
    }
    if (state.stage === 'gab-held-clear-of-pin') {
      clearSamples++;
      assert.ok(state.gabClearance > 1.5 * s && state.gabClearance < 5 * s, 'lift just clears the pin');
      near(state.armAngle, 0, 1e-12, 'valve arm rests plumb while the gab is off');
    }
    if (/engaged-eccentric/.test(state.stage)) assert.equal(state.gabLift, 0);
  }
  assert.ok(engagedSamples > 800 && clearSamples > 100);
  // the cam touches the pin at every handle angle and the lift rises monotonically
  for (let i = 0; i <= 200; i++) {
    const gap = u.camGapAt(g.maximumHandleAngle * i / 200);
    assert.ok(gap >= 0 && gap < 4e-4);
  }
  let previous = 0;
  for (let t = g.lift.start; t <= g.lift.end; t += 0.01) {
    const lift = u.stateAtTime(t).gabLift;
    assert.ok(lift >= previous - 1e-9, `lift reverses at ${t}`);
    previous = lift;
  }
  const top = u.stateAtTime(8);
  assert.ok(top.gabLift / s > 37 && top.gabLift / s < 42);
}));

test('187: motion is smooth, loops seamlessly and plays at a natural pace', () => withModel((model, u) => {
  const g = u.geometry, dt = 1 / 240;
  const sample = (t) => {
    const k = u.stateAtTime(t);
    return [k.rodOffset[0], k.rodOffset[1], k.handleAngle * 0.5, k.armAngle * g.armLength];
  };
  let maxAccel = 0, peakInputRate = 0, peakHandleRate = 0;
  for (let i = 0; i < g.cyclePeriod / dt; i++) {
    const t = i * dt, a = sample(t - dt), b = sample(t), c = sample(t + dt);
    for (let j = 0; j < 4; j++) maxAccel = Math.max(maxAccel, Math.abs(a[j] - 2 * b[j] + c[j]) / dt ** 2);
    const k = u.stateAtTime(t);
    peakInputRate = Math.max(peakInputRate, k.inputRate);
    peakHandleRate = Math.max(peakHandleRate, Math.abs(k.handleRate));
  }
  // bounded second differences: no velocity jumps anywhere, including the wrap at t = 16 -> 0
  assert.ok(maxAccel < 3, `max acceleration ${maxAccel}`);
  const a = sample(g.cyclePeriod - 1e-6), b = sample(1e-6);
  for (let j = 0; j < 4; j++) near(a[j], b[j], 1e-4, 'cycle wraps continuously');
  // eccentric turns take at least 2 s; handle moves over ~2 s
  assert.ok(2 * Math.PI / peakInputRate >= 2.4, `eccentric turn ${2 * Math.PI / peakInputRate} s`);
  assert.ok(g.lift.end - g.lift.start >= 1.5 && g.lower.end - g.lower.start >= 1.5);
  assert.ok(peakHandleRate < 0.7, 'upper handle turns at a hand pace');
  // the rod reciprocates engaged, then stops at mid-stroke before lifting
  const stroke = [];
  for (let t = -4; t <= 4; t += 0.05) stroke.push(u.stateAtTime(t).rodOffset[0]);
  near(Math.max(...stroke) / g.sourceUnitsPerPixel, 12, 0.3, 'rod half-stroke');
  near(u.stateAtTime(g.lift.start).rodOffset[0], 0, 1e-9, 'stopped at mid-stroke');
}));
