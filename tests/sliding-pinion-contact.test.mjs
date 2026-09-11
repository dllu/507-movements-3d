import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

function boundsIn(part, reference) {
  const transform = reference.matrixWorld.clone().invert().multiply(part.matrixWorld);
  const bounds = new THREE.Box3();
  const positions = part.geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(transform));
  }
  return bounds;
}

test('035 has a real sliding fit, shaft bores, and a clear tension spring pulling toward the ellipse', () => {
  const model = createMovementModel(catalog.movements[34]);
  const { barPlate, slottedBar, bearingTongue, bearingFlange, bearingCarriage,
    spring, pinion, innerSpringAnchor, outerSpringAnchor } = model.root.userData.blocks;
  const geometry = model.root.userData.geometry;
  for (let phase = 0; phase <= 32; phase += 1) {
    model.update(geometry.carrierCycleDuration * phase / 32, 0);
    model.root.updateMatrixWorld(true);
    const tongue = boundsIn(bearingTongue, slottedBar);
    const flange = boundsIn(bearingFlange, slottedBar);
    const plate = boundsIn(barPlate, slottedBar);
    assert.ok(flange.min.z > plate.max.z + 0.024, 'the retaining flange slides above the rail faces');
    assert.ok(tongue.min.x > geometry.slotStartRadius && tongue.max.x < geometry.slotEndRadius,
      'the tongue never enters a rounded slot end');
    for (const side of [-1, 1]) {
      const start = new THREE.Vector3(tongue.getCenter(new THREE.Vector3()).x, 0, geometry.barZ);
      const origin = start.applyMatrix4(slottedBar.matrixWorld);
      const direction = new THREE.Vector3(0, side, 0).transformDirection(slottedBar.matrixWorld);
      const hits = new THREE.Raycaster(origin, direction, 0, 0.2).intersectObject(barPlate, false);
      assert.ok(hits.length > 0, 'the actual slot has a solid guiding wall');
      const edge = side < 0 ? -tongue.min.y : tongue.max.y;
      assert.ok(hits[0].distance - edge > 0.0049 && hits[0].distance - edge < 0.0051,
        'the tongue retains a 0.005 running clearance on each side');
    }
    for (const [part, reference, z, shaftRadius] of [[bearingTongue, bearingCarriage, 0.27, 0.06],
      [bearingFlange, bearingCarriage, 0.34, 0.06], [barPlate, slottedBar, geometry.barZ, 0.08]]) {
      for (let sample = 0; sample < 16; sample += 1) {
        const angle = 2 * Math.PI * sample / 16;
        const origin = new THREE.Vector3(0, 0, z).applyMatrix4(reference.matrixWorld);
        const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).transformDirection(reference.matrixWorld);
        const hits = new THREE.Raycaster(origin, direction, 0, 0.15).intersectObject(part, false);
        assert.ok(hits.length && hits[0].distance > shaftRadius + 0.0018,
          'the rotating shaft fits inside the actual bearing bore');
      }
    }
    const springBounds = boundsIn(spring.userData.mesh, slottedBar);
    assert.ok(springBounds.min.z > flange.max.z + 0.009,
      'the spring wire clears the whole flange and bar throughout extension');
    const towardAnchor = innerSpringAnchor.getWorldPosition(new THREE.Vector3())
      .sub(outerSpringAnchor.getWorldPosition(new THREE.Vector3()));
    towardAnchor.z = 0;
    towardAnchor.normalize();
    const normal = model.root.userData.ellipsePinionContact.normal;
    assert.ok(towardAnchor.x * normal.x + towardAnchor.y * normal.y < -0.9,
      'spring tension has an inward normal component that keeps the teeth engaged');
    assert.ok(model.root.userData.kinematics.springExtension > 0.119,
      'the spring remains in tension at the minimum center distance');
    let wireLength = 0;
    let before = spring.userData.curve.getPoint(0);
    for (let sample = 1; sample <= 8192; sample += 1) {
      const point = spring.userData.curve.getPoint(sample / 8192);
      wireLength += point.distanceTo(before);
      before = point;
    }
    assert.ok(Math.abs(wireLength - geometry.springWireLength) < 0.00002,
      'spring extension changes the helix geometry without stretching its wire');
    const pinionFrame = pinion.userData.rotor;
    const mesh = spring.userData.mesh;
    const transform = pinionFrame.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
    const positions = mesh.geometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(transform);
      assert.ok(Math.abs(point.z) > 0.39 || Math.hypot(point.x, point.y) > 0.061,
        'spring wire clears the pinion shaft');
    }
  }
});
