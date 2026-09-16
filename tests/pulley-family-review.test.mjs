import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAuthoredPulleyFormMovement } from '../src/simulation/authored-pulley-forms.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

for (const id of [255, 256, 257, 258, 259]) {
  test(`${id}: pulley and hub have finite through-bores instead of intersecting the shaft`, () => {
    const model = createAuthoredPulleyFormMovement({ id });
    const { blocks, geometry } = model.root.userData;
    model.root.updateMatrixWorld(true);
    const body = blocks.pulleyBody ?? blocks.tread;
    for (const [mesh, innerRadius, outerRadius] of [
      [blocks.hub, geometry.shaftRadius, geometry.hubRadius],
      [body, geometry.hubRadius, geometry.treadRadius ?? geometry.grooveRootRadius],
      ...(blocks.flanges ?? []).map(mesh => [mesh, geometry.hubRadius, geometry.flangeRadius]),
    ]) {
      const rayHits = (radius) => {
        const scale = model.root.scale.x;
        const ray = new THREE.Raycaster(
          new THREE.Vector3(-10, radius * scale, 0), new THREE.Vector3(1, 0, 0),
        );
        return ray.intersectObject(mesh, false);
      };
      assert.equal(rayHits(innerRadius * 0.98).length, 0, `${mesh.userData.role} leaves the axis clear`);
      assert.ok(rayHits((innerRadius + outerRadius) / 2).length > 0, 'annular cap remains solid');
      assert.ok(mesh.geometry.userData.boreRadius > innerRadius);
      const positions = mesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i += 1) {
        assert.ok(Number.isFinite(positions.getX(i) + positions.getY(i) + positions.getZ(i)));
      }
    }
    assert.equal(model.root.userData.hideGround, true);
    model.root.traverse(object => {
      if (object.material) assert.equal(object.material.fog, false);
    });
    for (const time of [0, 0.2, 0.9, 1.5, 4, 10, 100]) {
      model.update(time);
      model.root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model.root, true);
      const fit = model.root.userData.cameraFitBounds.clone().expandByScalar(0.03);
      assert.ok(fit.containsBox(bounds), 'full rotation remains inside the fitting bounds');
    }
    disposeObject3D(model.root);
  });
}

test('255: axial widths and shaft extent match the source edge elevation', () => {
  const model = createAuthoredPulleyFormMovement({ id: 255 });
  const g = model.root.userData.geometry;
  const sourceScale = (465 - 49) / (2 * g.flangeRadius);
  assert.ok(Math.abs(g.shaftLength * sourceScale - (448 - 98)) < 2);
  assert.ok(Math.abs(g.treadWidth * sourceScale - (300 - 233)) < 2);
  assert.ok(Math.abs((g.treadWidth + 2 * g.flangeThickness) * sourceScale - (321 - 211)) < 4);
  disposeObject3D(model.root);
});

test('258: V flanks and end faces retain distinct normals at sharp profile corners', () => {
  const model = createAuthoredPulleyFormMovement({ id: 258 });
  const { blocks, geometry } = model.root.userData;
  const p = blocks.pulleyBody.geometry.attributes.position;
  const n = blocks.pulleyBody.geometry.attributes.normal;
  let positiveFlank = false, negativeFlank = false, endFace = false;
  for (let i = 0; i < p.count; i += 1) {
    // Geometry's revolution axis is Y before the mesh rotates it onto X.
    if (Math.abs(p.getY(i)) < 1e-7) {
      positiveFlank ||= n.getY(i) > 0.8;
      negativeFlank ||= n.getY(i) < -0.8;
    }
    if (Math.abs(p.getY(i) - geometry.pulleyHalfWidth) < 1e-6) {
      endFace ||= n.getY(i) > 0.999;
    }
  }
  assert.ok(positiveFlank && negativeFlank, 'the V root has two flank normals, not one rounded normal');
  assert.ok(endFace, 'the annular end cap is flat');
  disposeObject3D(model.root);
});
