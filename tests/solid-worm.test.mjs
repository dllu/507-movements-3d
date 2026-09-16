import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeSolidWorm } from '../src/simulation/solid-worm.js';

for (const handedness of [-1, 1]) {
  test(`solid worm ${handedness} has pitched integral flanks and an open bore`, () => {
    const radius = 0.30, pitch = 0.26, length = pitch * 3, shaftRadius = 0.14;
    const worm = makeSolidWorm({ radius, pitch, length, shaftRadius, handedness });
    const thread = worm.userData.thread;
    const p = thread.geometry.attributes.position;
    const boreRadius = worm.userData.boreRadius;
    let minimumRadius = Infinity;
    for (let i = 0; i < p.count; i += 1) {
      minimumRadius = Math.min(minimumRadius, Math.hypot(p.getX(i), p.getY(i)));
    }
    assert.ok(Math.abs(minimumRadius - boreRadius) < 1e-7);
    // Raycast the actual visible solid in its local frame, independently of
    // its analytic pitch-reference samples. The crest must follow its hand.
    const mesh = new THREE.Mesh(thread.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.updateMatrixWorld(true);
    function surfaceRadius(z, angle) {
      const radial = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
      const ray = new THREE.Raycaster(radial.clone().multiplyScalar(1).setZ(z), radial.clone().negate());
      const hit = ray.intersectObject(mesh)[0];
      assert.ok(hit, 'radial ray reaches the solid surface');
      return Math.hypot(hit.point.x, hit.point.y);
    }
    for (const z of [-pitch * 0.71, -pitch * 0.17, pitch * 0.41]) {
      const crest = handedness * 2 * Math.PI * (z + length / 2) / pitch;
      assert.ok(Math.abs(surfaceRadius(z, crest) - (radius + pitch / Math.PI)) < 0.0003);
      assert.ok(Math.abs(surfaceRadius(z, crest + Math.PI) - worm.userData.rootRadius) < 0.0003);
    }
    const boreRay = new THREE.Raycaster(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1));
    assert.equal(boreRay.intersectObject(mesh).length, 0, 'axial ray passes through the bore');
    thread.geometry.dispose(); thread.material.dispose(); mesh.material.dispose();
  });
}
