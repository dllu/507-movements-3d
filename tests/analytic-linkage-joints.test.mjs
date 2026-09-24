import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredCrankMovement } from '../src/simulation/authored-cranks.js';
import { createAuthoredRhombusLinkageMovement } from '../src/simulation/authored-rhombus-linkages.js';

const worldBox = object => new THREE.Box3().setFromObject(object);

test('231 shafts run away from the coupler layer and no undrawn bearing link is shown', () => {
  const model = createAuthoredCrankMovement({ id: 231 });
  const { blocks, geometry: g } = model.root.userData;
  model.root.updateMatrixWorld(true);
  // Brown draws neither the bearing link nor the bearings.
  for (const part of [blocks.groundPlate, ...blocks.fixedBearings, ...blocks.groundEyeLiners]) {
    assert.equal(part.parent, null);
  }
  const couplerMinZ = g.couplerPlaneZ - g.couplerDepth / 2;
  const couplerMaxZ = g.couplerPlaneZ + g.couplerDepth / 2;
  const inputShaft = worldBox(blocks.inputShaft.userData.parts.shaft);
  const outputShaft = worldBox(blocks.outputShaft.userData.parts.shaft);
  assert.ok(inputShaft.max.z < couplerMinZ - 0.1, 'input shaft runs back from the coupler');
  assert.ok(outputShaft.min.z > couplerMaxZ + 0.1, 'output shaft runs forward from the coupler');
  // Even so, the coupler's outline stays clear of both shaft projections.
  const segment = new THREE.Line3(), nearest = new THREE.Vector3();
  for (let i = 0; i <= 720; i++) {
    const s = model.root.userData.stateAtDriverAngle(i * Math.PI / 360);
    segment.set(s.inputPin.clone().setZ(0), s.outputPin.clone().setZ(0));
    for (const pivot of [g.inputPivot, g.outputPivot]) {
      segment.closestPointToPoint(pivot, true, nearest);
      assert.ok(nearest.distanceTo(pivot) > g.shaftRadius + g.couplerEyeOuterRadius);
    }
  }
  assert.equal(model.root.userData.hideGround, true);
});

test('273 visible joint bores are open and every eye clears its pin', () => {
  const model = createAuthoredRhombusLinkageMovement({ id: 273 });
  const { blocks, geometry: g } = model.root.userData;
  const eyes = [...blocks.linkMeshes, ...Object.values(blocks.rods).map(rod => rod.userData.blocks.eye)];
  model.root.updateMatrixWorld(true);
  for (const eye of eyes) {
    for (const bore of eye.geometry.userData.bores) {
      // Ray samples fill the pin cross-section and must escape through actual
      // triangles. Metadata alone cannot prove that the hole was triangulated.
      for (let i = 0; i < 16; i++) {
        const theta = i * Math.PI / 8;
        const p = eye.localToWorld(new THREE.Vector3(
          bore.x + g.pinRadius * Math.cos(theta),
          bore.y + g.pinRadius * Math.sin(theta), 2));
        assert.equal(new THREE.Raycaster(p, new THREE.Vector3(0, 0, -1))
          .intersectObject(eye, false).length, 0);
      }
    }
  }
  // Layer intervals bound all four links through the complete analytic stroke.
  assert.ok(g.frontLinkPlaneZ - g.linkDepth / 2 > g.rodRadius);
  assert.ok(g.rearLinkPlaneZ + g.linkDepth / 2 < -g.rodRadius);
  assert.ok(g.pinSpan / 2 > g.frontLinkPlaneZ + g.linkDepth / 2);
  const guideBoxes = Object.values(blocks.guides).flatMap(guide => guide.userData.jaws.map(worldBox));
  for (let i = 0; i <= 360; i++) {
    model.update(g.cyclePeriod * i / 360);
    for (const rod of Object.values(blocks.rods)) {
      // Corner eye / fixed-guide clearance in XY, including finite eye radius.
      for (const box of guideBoxes) {
        const x = Math.max(box.min.x, Math.min(box.max.x, rod.position.x));
        const y = Math.max(box.min.y, Math.min(box.max.y, rod.position.y));
        assert.ok(Math.hypot(x - rod.position.x, y - rod.position.y) > 0.21);
      }
    }
  }
  assert.equal(model.root.userData.hideGround, true);
});
