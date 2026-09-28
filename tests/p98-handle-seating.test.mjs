// Pass 98 (user: "make all the handles have the cylindrical portion be flush
// with the back side of the lever"): each crank's turned grip is one lathe
// whose shank runs through the arm it stands on and ends HANDLE_BACK_RECESS
// inside the arm's far face, concentric with the arm's round end.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { HANDLE_BACK_RECESS, handleShank, turnedHandleGeometry } from '../src/simulation/turned-handle.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));

test('turned handle shank is opt-in and ends the recess inside the back face', () => {
  const side = [[0.1, 0], [0.075, 0.185], [0.085, 0.37], [0.15, 0.574], [0.175, 0.74]];
  const plain = turnedHandleGeometry({ height: 0.47, side });
  plain.computeBoundingBox();
  assert.equal(plain.boundingBox.min.y, 0);
  const seated = turnedHandleGeometry({ height: 0.47, side, shank: handleShank(0.11) });
  seated.computeBoundingBox();
  assert.ok(Math.abs(seated.boundingBox.min.y + (0.11 - 0.012 - HANDLE_BACK_RECESS)) < 1e-6);
});

// [id, grip role, lever role]
const CASES = [
  [266, 'crank-grip-pointing-outboard', 'crank-arm-eye-carrying-grip'],
  [285, 'tailstock-t-crank-turning-grip', 'tailstock-t-crank-bar'],
  [358, 'source-visible-fusee-crank-handle', 'source-visible-fusee-crank-arm'],
  [361, 'upper-shaft-crank-handle', 'right-hand-crank-fast-on-upper-shaft'],
  [366, 'free-hand-grip-on-input-crank', 'radial-hand-crank-arm'],
  [368, 'free-turning-hand-crank-turned-knob', 'input-crank-arm'],
  [370, 'free-turning-hand-handle', 'opposite-hand-handle-crank-arm'],
  [379, 'free-turning-upper-crank-hand-knob', 'radial-upper-hand-crank-rigid-with-drill-spindle'],
  [380, 'upper-drill-crank-hand-knob', 'upper-hand-crank-rigid-with-inner-drill-spindle'],
  [413, 'lower-wheel-crank-handle-grip', 'left-rigid-v-groove-flank'],
  [417, 'input-crank-handle-on-arm', 'input-crank-arm-fast-on-shaft-A'],
  [506, 'driver-A-hand-grip', 'hand-crank-rigid-with-driver-A'],
];

for (const [id, gripRole, leverRole] of CASES) {
  test(`movement ${id}: the grip runs through its arm, flush with the far face`, () => {
    const model = createMovementModel(catalog.movements[id - 1]);
    model.update(0, 0);
    model.root.updateMatrixWorld(true);
    let grip = null, lever = null;
    model.root.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.role === gripRole) grip = o;
      if (o.userData.role === leverRole) lever = o;
    });
    assert.ok(grip && lever, 'grip and lever found');
    assert.equal(grip.geometry.type, 'LatheGeometry', 'one turned piece');
    const box = new THREE.Box3().setFromBufferAttribute(grip.geometry.attributes.position);
    // The lathe axis is local y unless a rotation was baked into the buffer
    // (285's grip is turned onto local x): the longest extent.
    const size = box.getSize(new THREE.Vector3()).toArray();
    const k = size.indexOf(Math.max(...size));
    const end = (v) => new THREE.Vector3().setComponent(k, v);
    const base = grip.localToWorld(end(box.min.getComponent(k)));
    const tip = grip.localToWorld(end(box.max.getComponent(k)));
    const axis = tip.clone().sub(base).normalize();
    // The lever's faces along the grip's axis line.
    const material = lever.material;
    const side = material.side;
    material.side = THREE.DoubleSide;
    const hits = new THREE.Raycaster(tip.clone().addScaledVector(axis, 5), axis.clone().negate())
      .intersectObject(lever, false).map((h) => h.distance);
    material.side = side;
    assert.ok(hits.length >= 2, 'the grip axis pierces its arm (concentric, not on an edge)');
    const far = tip.clone().addScaledVector(axis, 5 - Math.max(...hits));
    const gap = far.clone().sub(base).dot(axis);
    assert.ok(Math.abs(gap + HANDLE_BACK_RECESS) < 2e-3, `shank ends ${-gap} inside the far face`);
    model.dispose?.();
  });
}
