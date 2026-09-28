import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { upperFreeStop } from '../src/simulation/quadrant-catch-finite-parts.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));

test('movement 184 shows the 183 gear reflected top to bottom, tappet at the top descending onto the upper handle', () => {
  const movement = catalog.movements[183];
  assert.equal(movement.id, 184);
  const model = createMovementModel(movement), d = model.root.userData;
  const m183 = createMovementModel(catalog.movements[182]).root.userData;
  assert.equal(d.fidelity, 'authored');
  assert.match(d.mechanism, /^top-position-descending/);
  // Plate 184 is plate 183 flipped top to bottom: the same solved pose,
  // presented through one top-to-bottom reflection of the whole gear.
  const reflection = d.blocks.plate184Reflection;
  assert.ok(reflection && reflection.parent === model.root);
  assert.deepEqual(reflection.scale.toArray(), [1, -1, 1]);
  // The root holds only the reflected gear: the reconstructed fixed supports
  // are not presented (p60 support policy).
  assert.deepEqual(model.root.children, [reflection]);
  const s = d.stateAtTime(0), s183 = m183.stateAtTime(0);
  assert.equal(s.phase, s183.phase);
  assert.equal(s.upperAngle, s183.upperAngle);
  assert.equal(s.lowerAngle, s183.lowerAngle);
  // In the reflected view the tappet stands by the upper shaft and moves
  // down (source y grows upward in the flipped view) onto the upper handle.
  const tappetY = (t) => { model.update(t); model.root.updateMatrixWorld(true); return d.blocks.tappet.getWorldPosition(new THREE.Vector3()).y; };
  // The ball-lever shaft (183's lower one) is the upper shaft in this view.
  const ballShaftY = () => d.blocks.lowerShaft.getWorldPosition(new THREE.Vector3()).y;
  const hookShaftY = () => d.blocks.upperShaft.getWorldPosition(new THREE.Vector3()).y;
  const y0 = tappetY(0);
  assert.ok(ballShaftY() > hookShaftY());
  assert.ok(Math.abs(y0 - ballShaftY()) < Math.abs(y0 - hookShaftY()));
  assert.ok(tappetY(0.2) < y0);
  assert.ok(upperFreeStop > 0);
  assert.notEqual(m183.mechanism, d.mechanism);
});

test('movement 184 hangs both back-weight rods down from Brown\'s mid-height pins', () => {
  const model = createMovementModel(catalog.movements[183]), d = model.root.userData, b = d.blocks;
  const at = (o) => o.getWorldPosition(new THREE.Vector3());
  for (const t of [0, 3, 6, 9, 12, 15]) {
    model.update(t); model.root.updateMatrixWorld(true);
    const ballShaft = at(b.lowerShaft), wingShaft = at(b.upperShaft);
    const ballPin = at(b.lowerWeightPin), wingPin = at(b.upperWeightPin);
    if (t === 0) {
      // Plate pose: the ball handle's pin down-right of its (upper) shaft, the
      // wing handle's pin up-left of its (lower) shaft, both between the shafts.
      assert.ok(ballPin.x > ballShaft.x && ballPin.y < ballShaft.y && ballPin.y > wingShaft.y);
      assert.ok(wingPin.x < wingShaft.x && wingPin.y > wingShaft.y && wingPin.y < ballShaft.y);
    }
    for (const [rod, pin] of [[b.lowerWeightRod, ballPin], [b.upperWeightRod, wingPin]]) {
      const box = new THREE.Box3().setFromObject(rod);
      // The rod's round eye is concentric with the pin; the bar hangs below.
      assert.ok(box.max.y <= pin.y + 0.11 && box.min.y < pin.y - 1, `rod hangs down from its pin at t=${t}`);
      // Each weight keeps turning its handle the same way as in 183: the pin
      // stays on the same side of its shaft through the swing.
    }
    assert.ok(ballPin.x > ballShaft.x);
    assert.ok(wingPin.x < wingShaft.x);
  }
  // The wing's tip carries no eye: its only eye hole is on the hidden arm,
  // which lies with the other weight arm in the rear plane.
  assert.equal(b.upperWeightArm.userData.role, 'upper-handle-weightArm');
  b.upperWeightArm.geometry.computeBoundingBox(); b.pistonRod.geometry.computeBoundingBox();
  assert.ok(b.upperWeightArm.geometry.boundingBox.max.z < b.pistonRod.geometry.boundingBox.min.z);
});
