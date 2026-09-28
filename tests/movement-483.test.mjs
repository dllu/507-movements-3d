import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

// Pass 74: Brown's plate rebuilt element by element (see docs/p74-b-review.md).

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const FULL_TURN = Math.PI * 2;

function movementModel() {
  const movement = catalog.movements[482];
  return { model: createMovementModel(movement), movement };
}

function near(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`);
}

function disposeModel(root) {
  root.traverse((object) => {
    object.geometry?.dispose();
    for (const material of [].concat(object.material ?? [])) material.dispose();
  });
}

function roles(root) {
  const out = [];
  root.traverse((object) => {if (object.userData.role) out.push(object.userData.role);});
  return out;
}

test('movement 483 has the parts Brown draws: two double bellows, flag rods, valve B under its C bracket, outlet column and dial-work box', () => {
  const { model, movement } = movementModel();
  const { blocks, fidelity } = model.root.userData;
  assert.equal(movement.id, 483);
  assert.equal(fidelity, 'authored');
  const found = roles(model.root);
  for (const role of [
    'bellows-like-measuring-chamber-A', 'bellows-like-measuring-chamber-A-prime',
    'fixed-outer-end-board-of-A', 'fixed-inner-end-board-of-A', 'fixed-inner-end-board-of-A-prime', 'fixed-outer-end-board-of-A-prime',
    'fixed-central-partition-between-A-and-A-prime', 'moving-plate-of-A', 'moving-plate-of-A-prime',
    'vertical-flag-rod-of-A-prime', 'D-cup-valve-B-turning-on-its-seat', 'fixed-C-bracket-carrying-spindle-of-B',
    'fixed-outlet-column-from-exhaust-of-B', 'fixed-dial-work-case-at-upper-right',
  ]) assert.ok(found.includes(role), role);
  // Brown draws the dial-work box plain: no dials, pointers or gas beads.
  assert.ok(!found.some((role) => /register-dial|pointer|gas-marker/.test(role)));
  assert.equal(blocks.leather.length, 4);
  disposeModel(model.root);
});

test('movement 483 opens in Brown’s pose: A′ at the end of its stroke with its inner leather closed up, A at mid-stroke', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  let leftMin = Infinity, leftMax = -Infinity, rightMin = Infinity, rightMax = -Infinity;
  for (let i = 0; i < 720; i += 1) {
    const state = stateAtTime(geometry.cycleDuration * i / 720);
    leftMin = Math.min(leftMin, state.left.plateX);leftMax = Math.max(leftMax, state.left.plateX);
    rightMin = Math.min(rightMin, state.right.plateX);rightMax = Math.max(rightMax, state.right.plateX);
  }
  const start = stateAtTime(0);
  near(start.right.plateX, rightMin, 1e-6, 'A′ plate at its inner end');
  // A quarter turn from its dead point A is near (not exactly at) the middle
  // of its stroke, since the flag motion is not sinusoidal; Brown draws it
  // at 196 px, x = -1.32.
  near(start.left.plateX, (leftMin + leftMax) / 2, 0.2, 'A plate near mid-stroke');
  near(start.left.plateX, -1.32, 0.1, 'A plate where Brown draws it');
  // Brown's plate at 305 px lies at x = 0.86.
  near(start.right.plateX, 0.86, 0.06, 'A′ plate where Brown draws it');
  disposeModel(model.root);
});

test('movement 483 linkage closes exactly: rocker arms, links, flags and the crank keep their lengths', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const L = geometry.layout;
  for (let i = 0; i <= 96; i += 1) {
    const state = stateAtTime(geometry.cycleDuration * i / 96);
    for (const side of ['left', 'right']) {
      const spec = geometry.linkages[side], s = state[side];
      near(Math.hypot(s.armTip[0] - spec.rod[0], s.armTip[1] - spec.rod[1]), spec.armLength, 1e-9, `${side} arm`);
      near(Math.hypot(s.armTip[0] - s.crankPin[0], s.armTip[1] - s.crankPin[1]), spec.linkLength, 1e-9, `${side} link`);
      near(Math.hypot(s.crankPin[0] - L.crankCenter[0], s.crankPin[1] - L.crankCenter[1]), L.crankRadius, 1e-9, `${side} crank`);
      near(Math.hypot(s.plateX - s.flagTip[0], 0 - s.flagTip[1]), spec.flagLink, 1e-9, `${side} flag link`);
    }
  }
  disposeModel(model.root);
});

test('movement 483 plates stay inside their leather, and each rocker is symmetric: dead points half a turn apart, sides a quarter turn apart', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const n = 1440;
  const lengths = [];
  for (let i = 0; i < n; i += 1) lengths.push(stateAtTime(geometry.cycleDuration * i / n).spaceLengths);
  for (const row of lengths) for (const length of row) assert.ok(length > 0.38 && length < 1.53, `segment length ${length}`);
  const extremeIndex = (k, pick) => {
    const column = lengths.map((row) => row[k]);
    return column.indexOf(pick(...column));
  };
  const turns = (a, b) => THREE.MathUtils.euclideanModulo(b - a, n) / n;
  for (const k of [0, 2]) near(turns(extremeIndex(k, Math.max), extremeIndex(k, Math.min)), 0.5, 2 / n, `space ${k} closes for half a turn`);
  const quarter = turns(extremeIndex(2, Math.min), extremeIndex(0, Math.min));
  near(Math.min(quarter, 1 - quarter), 0.25, 3 / n, 'A and A′ a quarter turn apart');
  for (const k of [0, 1, 2, 3]) near(geometry.strokeLengths[k], 1.04, 0.02, `stroke ${k}`);
  disposeModel(model.root);
});

test('movement 483 valve B exhausts each space exactly while it closes and admits gas while it opens', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const n = 720, dt = geometry.cycleDuration / n;
  let covered = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i * dt;
    const now = stateAtTime(t), next = stateAtTime(t + dt / 10);
    now.ports.forEach((port, k) => {
      const rate = next.spaceLengths[k] - now.spaceLengths[k];
      if (port.state === 'exhaust') assert.ok(rate <= 1e-9, `${port.key} exhausts while closing at ${t}`);
      if (port.state === 'admit') assert.ok(rate >= -1e-9, `${port.key} admits while opening at ${t}`);
      if (port.state === 'covered') covered += 1;
    });
    // Every moment one space of each chamber side is admitting or exhausting.
    assert.ok(now.ports.filter((port) => port.state !== 'covered').length >= 2);
  }
  assert.ok(covered / (4 * n) < 0.2, 'ports are covered only briefly at the dead points');
  // Four ports on a circle a quarter turn apart round the central exhaust.
  const angles = geometry.spaces.map((space) => space.portAngle).sort((a, b) => a - b);
  for (let k = 1; k < 4; k += 1) near(angles[k] - angles[k - 1], Math.PI / 2, 0.02, 'port spacing');
  disposeModel(model.root);
});

test('movement 483 renders every joint on its pin and loops seamlessly', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const world = (object) => object.getWorldPosition(new THREE.Vector3());
  for (const t of [0, 1.3, 2.9, 4.4, 6.1, 7.7]) {
    model.update(t);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(t);
    near(blocks.movingA.group.position.x, state.left.plateX, 1e-12, 'plate A');
    near(blocks.movingAPrime.group.position.x, state.right.plateX, 1e-12, 'plate A′');
    near(blocks.spindle.rotation.y, -state.crankAngle, 1e-12, 'spindle');
    // Flag links run from the arm's joint pin to the plate pin.
    for (const [links, rod, plate, side] of [[blocks.flagLinksA, blocks.rodA, blocks.movingA, 'left'], [blocks.flagLinksAPrime, blocks.rodAPrime, blocks.movingAPrime, 'right']]) {
      links.forEach((link, index) => {
        const start = world(link), joint = world(rod.flagJointPins[index]);
        near(Math.hypot(start.x - joint.x, start.z - joint.z), 0, 1e-9, `${side} flag joint`);
        const end = new THREE.Vector3(geometry.linkages[side].flagLink, 0, 0).applyMatrix4(link.matrixWorld);
        const pin = world(plate.pins[index]);
        near(Math.hypot(end.x - pin.x, end.z - pin.z), 0, 1e-9, `${side} plate pin`);
      });
    }
    const crankEnd = new THREE.Vector3(geometry.linkages.right.linkLength, 0, 0).applyMatrix4(blocks.crankLinkAPrime.matrixWorld);
    const crankPin = world(blocks.crankPins[0]);
    near(Math.hypot(crankEnd.x - crankPin.x, crankEnd.z - crankPin.z), 0, 1e-9, 'crank pin of A′');
  }
  const a = stateAtTime(0), b = stateAtTime(geometry.cycleDuration);
  near(a.left.plateX, b.left.plateX, 1e-9, 'loop A');
  near(a.right.plateX, b.right.plateX, 1e-9, 'loop A′');
  near(THREE.MathUtils.euclideanModulo(b.crankAngle - a.crankAngle, FULL_TURN), 0, 1e-9, 'one spindle turn');
  near(b.cumulativeMeasuredVolume, geometry.volumePerRevolution, 1e-12, 'four space volumes per turn');
  disposeModel(model.root);
});

test('movement 483 hides A’s undrawn flag rod: inside A’s outer end board below, straight behind the outlet column above the shelf (pass 95)', () => {
  const { model } = movementModel();
  const { geometry } = model.root.userData;
  const L = geometry.layout;
  const [rodX, rodZ] = geometry.linkages.left.rod;
  const rodRadius = 0.055;
  // Within the outer end board of A (x from the wall to the end-board face).
  assert.ok(rodX - rodRadius > -L.wallInnerX && rodX + rodRadius < -L.endBoardFaceX, 'rod inside the end board');
  assert.ok(rodZ > L.backZ && rodZ < L.bellowsHalfDepth, 'rod within the board depth');
  // Behind the outlet column (outer radius 0.20) in the front view.
  assert.ok(Math.abs(rodX - L.columnCenter[0]) + rodRadius < 0.20 - 0.02, 'column covers the rod');
  assert.ok(rodZ < L.columnCenter[1] - 0.20, 'rod behind the column');
  disposeModel(model.root);
});
