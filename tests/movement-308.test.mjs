import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const movement = catalog.movements[307];
const model = createMovementModel(movement);
const data = model.root.userData;
const g = data.geometry;
const period = g.pendulumPeriod;

const polygonVertices = (multipolygon) => multipolygon.flat(2);
const rotate = ([x, y], angle) => [
  x * Math.cos(angle) - y * Math.sin(angle),
  x * Math.sin(angle) + y * Math.cos(angle),
];
const leverWorld = (lift) => g.leverOutline.map((polygon) => polygon.map(
  (ring) => ring.map((point) => data.leverPoint(point, lift)),
));
const clickWorld = (offset, angle) => g.clickOutline.map((polygon) => polygon.map(
  (ring) => ring.map((point) => data.clickLocalToWorld(point, offset, angle)),
));
const polygonGap = (a, b) => Math.min(
  ...polygonVertices(a).map((point) => data.signedDistance(point, b)),
  ...polygonVertices(b).map((point) => data.signedDistance(point, a)),
);
const nibGap = (state) => {
  const face = g.nibFaceAtContact + state.pendulumOffset;
  const x0 = face - g.nibWidth;
  const wheel = data.wheelOutlineAt(state.wheelAdvance);
  const rect = [[[[x0, g.nibBottom], [face, g.nibBottom], [face, g.nibTop], [x0, g.nibTop], [x0, g.nibBottom]]]];
  return polygonGap(rect, wheel);
};
const pinGap = (state) => {
  const head = g.leverHeadOutline.map((polygon) => polygon.map(
    (ring) => ring.map((point) => data.leverPoint(point, state.leverLift)),
  ));
  return polygonGap(head, data.wheelOutlineAt(state.wheelAdvance));
};
test('308 reproduces Brown’s plate: pendulum P, P, hooked wheel under a cock, lever Q, click C and pallet I', () => {
  assert.equal(movement.id, 308);
  assert.equal(data.fidelity, 'authored');
  const roles = [];
  model.root.traverse((object) => { if (object.userData.role) roles.push(object.userData.role); });
  for (const role of [
    'pendulum-P-P-and-web', 'fixed-wheel-cock', 'cock-fixing-screw',
    'hooked-tooth-escape-wheel', 'Q-bell-crank', 'click-C-hooked-plate',
    'pallet-I-plate', 'click-C-rest-stop-pin', 'click-C-yield-stop-pin',
  ]) assert.ok(roles.includes(role), `missing ${role}`);
  for (const pattern of [/bob/, /rod/, /sixty/, /upright/, /marker|live-/]) {
    assert.ok(!roles.some((role) => pattern.test(role)), `undrawn part ${pattern}`);
  }
  assert.equal(g.toothCount, 6);
  // p93: Q is a broad bell crank whose hooked head locks the wheel in the
  // wheel's own plane; no rear lock pin.
  assert.ok(!roles.includes('Q-locking-pin'));
  assert.ok(roles.includes('Q-hooked-head-in-wheel-plane'));
  const head = new THREE.Box3().setFromObject(data.blocks.leverHead);
  const wheel = new THREE.Box3().setFromObject(data.blocks.wheelPlate);
  assert.ok(head.min.z >= wheel.min.z - 1e-9 && head.max.z <= wheel.max.z + 1e-9, 'head in the wheel plane');
  // p94: the hook's end seats against the locked tooth's leading face,
  // 12 px (0.216) inside the tip circle, not on the tip.
  const hookDepth = g.tipRadius - Math.hypot(...g.lockPinCenter);
  assert.ok(Math.abs(hookDepth - 12 * g.rasterScale) < 1e-9, `hook depth ${hookDepth}`);
  assert.ok(g.tipRadius - hookDepth - g.lockPinRadius < 0.8 * g.tipRadius, 'hook end reaches a fifth of the way down the tooth');
  assert.equal(data.blocks.click.parent, data.blocks.pendulum);
  assert.equal(data.blocks.palletPlate.parent, data.blocks.pendulum);
  assert.equal(data.blocks.lever.parent, model.root);
  // Front elevation like the engraving.
  const direction = data.cameraDirection.clone().normalize();
  assert.ok(direction.z > 0.99);
  assert.equal(data.hideGround, true);
  assert.match(data.reconstructionNote, /Inferred, not drawn/);
});

test('308 starts at the drawn pose, with C just meeting Q on the leftward swing', () => {
  const state = data.stateAtTime(0);
  assert.ok(Math.abs(state.pendulumOffset) < 1e-9);
  assert.ok(state.pendulumVelocity < 0);
  assert.ok(state.wheelAdvance < 1e-3);
  const gap = polygonGap(leverWorld(state.leverLift), clickWorld(0, state.clickAngle));
  assert.ok(gap >= g.clearance - 1e-6 && gap < g.clearance + 0.003, `C-Q gap ${gap}`);
});

test('308 advances exactly one tooth per pendulum cycle, only while swinging left', () => {
  let before = data.stateAtTime(0);
  let leftImpulse = 0;
  let rightImpulse = 0;
  for (let i = 1; i <= 8000; i += 1) {
    const state = data.stateAtTime(2 * period * i / 8000);
    const step = before.wheelAngle - state.wheelAngle;
    assert.ok(step >= -1e-12, 'wheel never recoils');
    assert.ok(step < 0.03, 'wheel position continuous');
    assert.ok(Math.abs(state.leverLift - before.leverLift) < 0.01, 'Q continuous');
    assert.ok(Math.abs(state.clickAngle - before.clickAngle) < 0.02, 'C continuous');
    if (step > 1e-12) assert.ok(state.pendulumVelocity < 0, 'wheel moves only on the leftward swing');
    if (state.leverLift > 0) assert.ok(state.pendulumVelocity <= 0, 'C lifts Q only leftward');
    if (state.clickAngle > 0) assert.ok(state.pendulumVelocity >= 0, 'C yields only rightward');
    if (state.impulseActive) {
      if (state.pendulumVelocity < 0) leftImpulse += 1; else rightImpulse += 1;
    }
    before = state;
  }
  assert.ok(leftImpulse > 100);
  assert.equal(rightImpulse, 0);
  const a = data.stateAtTime(0.3);
  const b = data.stateAtTime(0.3 + period);
  assert.ok(Math.abs(a.wheelAngle - b.wheelAngle - g.toothPitch) < 1e-9);
});

test('308 finite outlines: Q hook, pallet I nib, Q and C never interpenetrate, and Q relocks every tooth', () => {
  let minimumPin = Infinity;
  let minimumNib = Infinity;
  let minimumClick = Infinity;
  let impulseNib = Infinity;
  for (let i = 0; i <= 1600; i += 1) {
    const state = data.stateAtTime(period * i / 1600);
    minimumPin = Math.min(minimumPin, pinGap(state));
    const nib = nibGap(state);
    minimumNib = Math.min(minimumNib, nib);
    if (state.impulseActive) impulseNib = Math.min(impulseNib, nib);
    minimumClick = Math.min(minimumClick, polygonGap(
      leverWorld(state.leverLift),
      clickWorld(state.pendulumOffset, state.clickAngle),
    ));
    if (state.locked) assert.equal(state.leverLift === 0 || state.wheelAdvance === 0, true);
    if (state.wheelAdvance >= g.toothPitch - 1e-9) assert.equal(state.leverLift, 0, 'Q is down when the wheel relocks');
  }
  // Tables hold the nominal clearance at their rows; linear interpolation
  // between rows may give back up to three quarters of it, never more.
  const floor = g.clearance / 4;
  assert.ok(minimumPin >= floor, `pin ${minimumPin}`);
  assert.ok(minimumNib >= floor, `nib ${minimumNib}`);
  assert.ok(minimumClick >= floor, `click ${minimumClick}`);
  console.log({ minimumPin, minimumNib, minimumClick, impulseNib });
  assert.ok(impulseNib < 4 * g.clearance, `impulse contact is maintained: ${impulseNib}`);
});

test('308 geometry buffers stay fixed while animating', () => {
  const saved = [];
  model.root.traverse((object) => { if (object.geometry) saved.push([object, object.geometry]); });
  for (let i = 0; i <= 16; i += 1) model.update(period * i / 16);
  for (const [object, geometry] of saved) assert.equal(object.geometry, geometry);
  model.root.traverse((object) => {
    for (const material of [].concat(object.material ?? [])) assert.equal(material.fog, false);
  });
  const bounds = new THREE.Box3().setFromObject(model.root);
  assert.ok(bounds.max.x - bounds.min.x < 10);
});
