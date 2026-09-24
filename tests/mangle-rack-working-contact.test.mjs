import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredGearMovement as create } from '../src/simulation/authored-gears.js';
import { auditMangleRackProfile } from './helpers/mangle-rack-profile.mjs';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

for (const id of [197, 198]) {
  test(`${id} finite teeth remain clear and have close resisting load faces on both runs and turns`, () => {
    const model = create({ id }), by = auditMangleRackProfile(model, id);
    assert.equal(Object.keys(by).length, 4);
    for (const [branch, result] of Object.entries(by)) {
      assert.ok(result.minGap > -1e-6, `${branch} clearance ${result.minGap}`);
      assert.ok(result.maxOverlap < 1e-10, `${branch} overlap ${result.maxOverlap}`);
      assert.ok(result.maxDriveGap < (id === 197 ? 0.0013 : 0.0007), `${branch} working gap ${result.maxDriveGap}`);
      assert.ok(result.minDriveMoment > (id === 197 ? 0.5 : 0.2), `${branch} resisting moment ${result.minDriveMoment}`);
    }
    console.log(id, by);
  });
  test(`${id} original penetrating witnesses now clear actual solid triangles`, () => {
    const model = create({ id }), d = model.root.userData, b = d.blocks;
    // The same spatial witness occurs at complementary time after reversing197.
    const time = id === 197 ? d.transmission.cyclePeriod - 12.43547092 : 4.36332313;
    model.update(time); model.root.updateMatrixWorld(true);
    const tooth = (id === 197 ? b.rackPins : b.rackTeeth)[id === 197 ? 4 : 34];
    const gear = b.pinion.userData.rotor.children[0], field = solidSurface(gear.geometry);
    const matrix = gear.matrixWorld.clone().invert().multiply(tooth.matrixWorld);
    const gap = Math.min(...surfacePoints(tooth.geometry).map(p => field.signedDistance(p.applyMatrix4(matrix))));
    assert.ok(gap > -1e-6 && gap < 0.003, `former interference: ${gap}`);
  });
  test(`${id} state queries do not allocate meshes and visible full-cycle vertices fit`, () => {
    const model = create({ id }), d = model.root.userData, snapshot = () => {
      const out = []; model.root.traverse(o => out.push([o, o.geometry])); return out;
    }, before = snapshot(), point = new THREE.Vector3();
    for (let i = 0; i <= 64; i++) {
      const time = d.transmission.cyclePeriod * i / 64;
      d.stateAtTime(time); model.update(time); model.root.updateMatrixWorld(true);
      model.root.traverse(o => {
        if (!o.isMesh || !o.visible || !o.material.visible) return;
        assert.equal(o.material.fog, false);
        for (let j = 0; j < o.geometry.attributes.position.count; j++) {
          point.fromBufferAttribute(o.geometry.attributes.position, j).applyMatrix4(o.matrixWorld);
          assert.ok(d.sweptBounds.containsPoint(point), `${o.userData.role} ${point.toArray()}`);
          // 198 frames its whole stroke; 197 frames the source pose.
          if (i === 0 || id === 198) assert.ok(d.cameraFitBounds.containsPoint(point), `framed ${o.userData.role} ${point.toArray()}`);
        }
      });
    }
    assert.deepEqual(snapshot(), before);
    assert.equal(d.sourceAnimation.registeredModel, `mm_${id}`);
    assert.ok(d.minimumDisplayCycleSeconds >= 9);
  });
}

test('197 finite end guides engage the collar plane and bored slider clears its shaft', () => {
  const model = create({ id: 197 }), d = model.root.userData, b = d.blocks;
  const slider = solidSurface(b.shaftSlider.geometry);
  for (let i = 0; i < 64; i++) {
    const angle = i * Math.PI / 32;
    assert.ok(slider.signedDistance(new THREE.Vector3(0.073 * Math.cos(angle), 0.073 * Math.sin(angle), 0)) > 0.0028);
  }
  for (const [name, guide] of [['rightRackExtreme', b.rightEndGuide], ['leftRackExtreme', b.leftEndGuide]]) {
    model.update(d.canonicalTimes[name]); model.root.updateMatrixWorld(true);
    const collarBounds = new THREE.Box3().setFromObject(b.shaftGuideFollower), guideBounds = new THREE.Box3().setFromObject(guide);
    assert.ok(Math.min(collarBounds.max.z, guideBounds.max.z) - Math.max(collarBounds.min.z, guideBounds.min.z) > 0.1299);
    const field = solidSurface(guide.geometry), matrix = guide.matrixWorld.clone().invert().multiply(b.shaftGuideFollower.matrixWorld);
    const gap = Math.min(...surfacePoints(b.shaftGuideFollower.geometry).map(p => field.signedDistance(p.applyMatrix4(matrix))));
    assert.ok(gap > 0.0078 && gap < 0.0081, `end guide clearance ${gap}`);
  }
});

test('198 fixed shaft clears the rear opening and front cross-tie throughout the lift', () => {
  const model = create({ id: 198 }), d = model.root.userData, b = d.blocks;
  const fields = [b.carrierPlate, b.slotRail].map(mesh => [mesh, solidSurface(mesh.geometry)]);
  for (let sample = 0; sample <= 64; sample++) {
    model.update(d.transmission.cyclePeriod * sample / 64); model.root.updateMatrixWorld(true);
    for (const [mesh, field] of fields) {
      const inv = mesh.matrixWorld.clone().invert(), z = mesh === b.carrierPlate ? -0.4 : -0.3;
      for (let i = 0; i < 32; i++) {
        const a = Math.PI * i / 16, point = new THREE.Vector3(0.08 * Math.cos(a), 0.08 * Math.sin(a), z).applyMatrix4(inv);
        assert.ok(field.signedDistance(point) > 0.0088);
      }
    }
    const tie = new THREE.Box3().setFromObject(b.carrierCrossTie), shaft = new THREE.Box3().setFromObject(b.pinionShaft);
    assert.ok(tie.min.z - shaft.max.z > 0.0449);
  }
});

test('198 suspension eyes and fixed guide rollers have finite journals and rail clearance', () => {
  const model = create({ id: 198 }), d = model.root.userData, b = d.blocks;
  for (const rod of [b.topSuspensionRod, b.bottomSuspensionRod]) {
    const field = solidSurface(rod.children[0].geometry);
    for (const x of [0, d.geometry.linkLength]) for (let i = 0; i < 32; i++) {
      const a = i * Math.PI / 16;
      assert.ok(field.signedDistance(new THREE.Vector3(x + 0.135 * Math.cos(a), 0.135 * Math.sin(a), 0)) > 0.0028);
    }
  }
  for (const roller of b.guideRollers) {
    const field = solidSurface(roller.userData.hub.geometry);
    assert.ok(field.signedDistance(new THREE.Vector3(0.058, 0, 0)) > 0.0029);
    const edge = roller.userData.verticalSign > 0 ? d.geometry.frameTop : d.geometry.frameHalfHeight;
    assert.ok(Math.abs(roller.position.y) - d.geometry.guideRollerRadius - edge - 0.0525 > 0.0019);
    assert.ok(Math.abs(roller.position.y) - d.geometry.guideRollerRadius - edge - 0.0525 < 0.0021);
  }
});
