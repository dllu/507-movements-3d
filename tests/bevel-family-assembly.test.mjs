import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';

function bounds(object) { return new THREE.Box3().setFromObject(object, true); }

test('200 input journal clears the independent common spindle', () => {
  const model = createAuthoredGearMovement({id: 200});
  const {blocks} = model.root.userData;
  for (let i = 0; i <= 64; i++) {
    model.update(i / 64 * model.root.userData.transmission.inputCyclePeriod);
    const input = bounds(blocks.inputShaft);
    const spindle = bounds(blocks.commonSpindle);
    assert.ok(input.min.x - spindle.max.x > 0.024);
  }
});

test('226 blind journals clear F and the planet has a genuine journal bore', () => {
  const model = createAuthoredGearMovement({id: 226});
  const {blocks, geometry} = model.root.userData;
  const f = bounds(blocks.shaftF);
  assert.ok(bounds(blocks.inputShaft).min.y - f.max.y > 0.05);
  // p93-fc: D's stud now stands radially in a spider boss fast on F; its
  // root clears F's surface and is seated inside that boss.
  const stud = bounds(blocks.planetAxle);
  const spider = bounds(blocks.spiderBossD);
  assert.ok(stud.min.z - f.max.z > 0.015, `stud root ${stud.min.z} clears F`);
  assert.ok(stud.min.z < spider.max.z - 0.05, 'stud root is seated in the spider boss');
  assert.ok(stud.min.x >= spider.min.x && stud.max.x <= spider.max.x, 'stud lies over the spider boss');
  const gear = blocks.planetGearD;
  const hub = gear.userData.hub.geometry.attributes.position;
  let minimumRadius = Infinity;
  for (let i = 0; i < hub.count; i++) {
    minimumRadius = Math.min(minimumRadius, Math.hypot(hub.getX(i), hub.getY(i)));
  }
  const pin = blocks.planetAxle.userData.rotor.children[0].geometry.attributes.position;
  let pinRadius = 0;
  for (let i = 0; i < pin.count; i++) {
    pinRadius = Math.max(pinRadius, Math.hypot(pin.getX(i), pin.getZ(i)));
  }
  assert.ok(Math.abs(pinRadius - 0.066) < 1e-6);
  assert.ok(minimumRadius - pinRadius > 0.0015,
    `planet journal bore ${minimumRadius} clears its ${pinRadius} radius pin`);
  assert.equal(blocks.planetSupportRear.parent, blocks.carrierAssembly);
  assert.equal(blocks.planetSupportFront.parent, blocks.carrierAssembly);
  // These supports lie beyond the gear's radial and front axial envelopes.
  assert.ok(bounds(blocks.planetSupportRear).min.y > geometry.outerDistance + geometry.toothHeight);
  assert.ok(bounds(blocks.planetSupportFront).min.z > geometry.outerDistance + geometry.toothHeight);
  for (let i = 0; i <= 64; i++) {
    model.update(i / 64 * geometry.inputCyclePeriod);
    model.root.updateMatrixWorld(true);
    const positions = blocks.planetAxle.userData.rotor.children[0].geometry.attributes.position;
    const mesh = blocks.planetAxle.userData.rotor.children[0];
    for (let j = 0; j < positions.count; j++) {
      const p = new THREE.Vector3().fromBufferAttribute(positions, j).applyMatrix4(mesh.matrixWorld);
      assert.ok(Math.hypot(p.y, p.z) > geometry.centralShaftRadius + 0.015);
    }
  }
});

test('226 input bevel stays at the shared pitch apex through a full revolution', () => {
  const model = createAuthoredGearMovement({id: 226});
  const {blocks, geometry} = model.root.userData;
  for (let i = 0; i <= 64; i++) {
    model.update(i / 64 * geometry.inputCyclePeriod);
    model.root.updateMatrixWorld(true);
    const actualApex = blocks.inputGearB.getWorldPosition(new THREE.Vector3());
    assert.ok(actualApex.distanceTo(geometry.stageOneApex) < 1e-12);
    const shaft = blocks.inputShaft.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(shaft.x - geometry.stageOneApex.x) < 1e-12);
    assert.ok(Math.abs(shaft.z - geometry.stageOneApex.z) < 1e-12);
  }
});
