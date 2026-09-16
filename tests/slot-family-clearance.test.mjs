import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredLinkageMovement } from '../src/simulation/authored-linkages.js';
import { createAuthoredGearMovement } from '../src/simulation/authored-gears.js';
import { createAuthoredCrossedSlotMovement } from '../src/simulation/authored-crossed-slots.js';
import { disposeObject3D as disposeModel } from '../src/simulation/dispose-model.js';

// Rays pass through the finite rendered triangles, not through nominal slot
// metadata. Probe the complete pin cross-section, including reversal poses.
function assertOpenDisc(mesh, center, radius, label) {
  const ray = new THREE.Raycaster();
  for (let i = -1; i < 32; i += 1) {
    const angle = i * Math.PI / 16;
    const point = center.clone();
    if (i >= 0) { point.x += radius * Math.cos(angle); point.y += radius * Math.sin(angle); }
    ray.set(new THREE.Vector3(point.x, point.y, 10), new THREE.Vector3(0, 0, -1));
    assert.equal(ray.intersectObject(mesh, false).length, 0, `${label}: disc sample ${i}`);
  }
}

test('203: rendered curved slot and output eye clear the finite follower throughout the stroke', () => {
  const model = createAuthoredLinkageMovement({ id: 203 });
  const { blocks: b, geometry: g } = model.root.userData;
  for (let i = 0; i <= 64; i += 1) {
    model.update(8 * i / 64); model.root.updateMatrixWorld(true);
    const center = b.followerPin.getWorldPosition(new THREE.Vector3());
    for (const mesh of [b.curvedPlate, b.outputArmBody, b.followerBoss]) {
      assertOpenDisc(mesh, center, g.followerPinRadius * 0.999, `203 t=${i / 8} ${mesh.userData.role}`);
    }
  }
  assert.equal(model.root.userData.hideGround, true);
  disposeModel(model.root);
});

test('210: rendered slot and bored roller leave space for the finite roller and its axle', () => {
  const model = createAuthoredGearMovement({ id: 210 });
  const { blocks: b, geometry: g, canonicalTimes } = model.root.userData;
  model.root.updateMatrixWorld(true);
  for (const guide of b.guideAssemblies) {
    assert.ok(new THREE.Box3().setFromObject(guide).max.z < -g.armDepth / 2 - 0.02,
      'the entire fixed guide stays behind the rocking plate');
  }
  const times = [...Object.values(canonicalTimes), ...Array.from({ length: 65 }, (_, i) => 10 * i / 64)];
  for (const time of times) {
    model.update(time); model.root.updateMatrixWorld(true);
    const center = b.followerRoller.getWorldPosition(new THREE.Vector3());
    assertOpenDisc(b.plate, center, g.followerRadius, `210 plate t=${time}`);
    assertOpenDisc(b.followerBody, center, g.followerRadius * 0.34, `210 axle t=${time}`);
  }
  assert.equal(model.root.userData.hideGround, true);
  disposeModel(model.root);
});

test('252: neither crossbar nor stiffening web closes the bottom ends of the oblique slots', () => {
  const model = createAuthoredCrossedSlotMovement({ id: 252 });
  const { blocks: b, geometry: g } = model.root.userData;
  for (let i = 0; i <= 40; i += 1) {
    model.update(8 * i / 40); model.root.updateMatrixWorld(true);
    for (const pin of [b.leftRollerPin, b.rightRollerPin]) {
      const center = pin.getWorldPosition(new THREE.Vector3());
      for (const mesh of [b.crossbar, b.lowerWeb, b.leftArm, b.rightArm, b.topRail, b.bottomRail]) {
        assertOpenDisc(mesh, center, g.pinRadius * model.root.scale.x, `252 ${i} ${mesh.userData.role}`);
      }
    }
  }
  assert.equal(model.root.userData.hideGround, true);
  disposeModel(model.root);
});
