import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredCrankMovement } from '../src/simulation/authored-cranks.js';
import { createAuthoredRhombusLinkageMovement } from '../src/simulation/authored-rhombus-linkages.js';

const worldBox = object => new THREE.Box3().setFromObject(object);

test('231 shafts pass through the fixed bearings and rotating hubs clear the ground plate', () => {
  const model = createAuthoredCrankMovement({ id: 231 });
  const { blocks, geometry: g } = model.root.userData;
  model.root.updateMatrixWorld(true);
  const ground = worldBox(blocks.groundPlate);
  for (const assembly of [blocks.inputShaft, blocks.outputShaft]) {
    const shaft = worldBox(assembly.userData.parts.shaft);
    assert.ok(shaft.min.z < ground.min.z && shaft.max.z > ground.max.z);
    const hub = worldBox(assembly.userData.parts.hub);
    assert.ok(hub.max.z < ground.min.z || hub.min.z > ground.max.z);
  }
  for (const bearing of blocks.fixedBearings) {
    const box = worldBox(bearing);
    assert.ok(box.min.z > g.inputCrankPlaneZ + g.crankDepth / 2 + 0.008);
    assert.ok(box.max.z < g.outputCrankPlaneZ - g.crankDepth / 2 - 0.008);
  }
  // The forward output shaft extends through the coupler's Z plane. Verify
  // geometric clearance over a full revolution, not just joint closure.
  const segment = new THREE.Line3(), nearest = new THREE.Vector3();
  for (let i = 0; i <= 720; i++) {
    const s = model.root.userData.stateAtDriverAngle(i * Math.PI / 360);
    segment.set(s.inputPin.clone().setZ(0), s.outputPin.clone().setZ(0));
    segment.closestPointToPoint(g.outputPivot, true, nearest);
    assert.ok(nearest.distanceTo(g.outputPivot) > g.shaftRadius + g.couplerEyeOuterRadius);
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
