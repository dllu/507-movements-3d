import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredGabDisengagerMovement} from '../src/simulation/authored-gab-disengagers.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';

for (const id of [186, 187]) test(`${id}: finite cam toe remains tangent to its shoulder and opposes lifting torque`, () => {
  const model = createAuthoredGabDisengagerMovement({id}), {blocks: b, geometry: g} = model.root.userData;
  const shoe = b.camSupportShoe.children[0], toe = b.camContactNose, cam = b.camLever ?? b.upperCamHandle;
  const positions = toe.geometry.attributes.position, shoeSize = shoe.geometry.parameters;
  let greatestGap = 0, uncorrectedPenetration = 0, largestRocking = 0;
  try {
    for (let frame = 0; frame <= 1024; frame++) {
      model.update(g.cyclePeriod * frame / 1024);model.root.updateMatrixWorld(true);
      const state = model.root.userData.kinematics;
      largestRocking = Math.max(largestRocking, Math.abs(state.camRockingCorrection));
      const matrix = shoe.matrixWorld.clone().invert().multiply(toe.matrixWorld);
      let closest, minimum = Infinity, minZ = Infinity, maxZ = -Infinity;
      for (let i = 0; i < positions.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix);
        const gap = point.y - shoeSize.height / 2;
        if (gap < minimum) {minimum = gap;closest = point;}
        minZ = Math.min(minZ, point.z);maxZ = Math.max(maxZ, point.z);
      }
      greatestGap = Math.max(greatestGap, minimum);
      assert.ok(minimum >= -1e-7, `toe penetrates the shoe at ${frame}: ${minimum}`);
      assert.ok(minimum < 5e-5, `toe loses contact at ${frame}: ${minimum}`);
      assert.ok(Math.abs(closest.x) < shoeSize.width / 2, 'tangent falls on the finite shoulder');
      assert.ok(Math.min(maxZ, shoeSize.depth / 2) - Math.max(minZ, -shoeSize.depth / 2) > .03,
        'toe and shoulder overlap in depth, so contact is functional');
      const arm = state.camContactPoint.clone().sub(state.camPivot), normal = state.camSupportNormal;
      assert.ok(arm.x * normal.y - arm.y * normal.x < -.1,
        'upward shoulder reaction supplies the opposing moment for operator lift');
      // Removing the solved rocking motion restores overlap: the check cannot
      // pass merely because the contacting bodies were separated in depth.
      cam.rotation.z = state.handleAngle;model.root.updateMatrixWorld(true);
      const center = toe.getWorldPosition(new THREE.Vector3()).applyMatrix4(shoe.matrixWorld.clone().invert());
      uncorrectedPenetration = Math.max(uncorrectedPenetration, g.camToeRadius + shoeSize.height / 2 - center.y);
    }
    assert.ok(greatestGap > 0 && largestRocking > .01);
    assert.ok(uncorrectedPenetration > .02, 'control must expose the original rigid-angle incompatibility');
  } finally {disposeObject3D(model.root);}
});
