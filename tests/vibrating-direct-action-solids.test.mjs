import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredVibratingRodParallelMotion } from '../src/simulation/authored-vibrating-rod-parallel-motions.js';
import { createAuthoredDirectActionParallelMotion } from '../src/simulation/authored-direct-action-parallel-motions.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

for (const id of [337, 338, 339, 340, 341]) test(`${id}: finite rod eyes clear real moving pins throughout the stroke`, () => {
  const model = (id >= 339 ? createAuthoredDirectActionParallelMotion : createAuthoredVibratingRodParallelMotion)({ id });
  const rods = [];
  model.root.traverse(object => { if (object.userData.bores) rods.push(object); });
  assert.ok(rods.length >= 2);
  const ray = new THREE.Raycaster();
  let matchingPins = 0;
  for (let sample = 0; sample <= 32; sample += 1) {
    model.update(4 * sample / 32); model.root.updateMatrixWorld(true);
    for (const mesh of rods) for (const bore of mesh.userData.bores) {
      const center = new THREE.Vector3(bore.x, bore.y, 0).applyMatrix4(mesh.matrixWorld);
      const pin = Object.values(model.root.userData.blocks.jointPins).find(pin => {
        const p = pin.getWorldPosition(new THREE.Vector3());
        return Math.hypot(p.x - center.x, p.y - center.y) < 1e-8;
      });
      if (!pin) {
        const slab = new THREE.Box3().setFromObject(mesh);
        let engaged = false;
        model.root.traverse(shaft => {
          if (shaft.geometry?.type !== 'CylinderGeometry') return;
          const p = shaft.getWorldPosition(new THREE.Vector3());
          if (Math.hypot(p.x - center.x, p.y - center.y) > 1e-8
            || shaft.geometry.parameters.radiusTop >= bore.radius) return;
          const bounds = new THREE.Box3().setFromObject(shaft);
          if (bounds.min.z <= slab.min.z && bounds.max.z >= slab.max.z) engaged = true;
        });
        assert.ok(engaged, 'stationary axle spans the full thickness of its bored radius bar');
        continue;
      }
      matchingPins += 1;
      const radius = pin.geometry.parameters.radiusTop;
      const pinBounds = new THREE.Box3().setFromObject(pin);
      const rodBounds = new THREE.Box3().setFromObject(mesh);
      assert.ok(pinBounds.min.z <= rodBounds.min.z + 1e-7 && pinBounds.max.z >= rodBounds.max.z - 1e-7,
        `pin spans ${mesh.userData.role}: ${pinBounds.min.z}..${pinBounds.max.z} against ${rodBounds.min.z}..${rodBounds.max.z}`);
      assert.ok(radius < bore.radius, `pin fits ${mesh.userData.role}`);
      for (let i = 0; i < 16; i += 1) {
        const angle = i * Math.PI / 8;
        ray.set(new THREE.Vector3(center.x + radius * Math.cos(angle),
          center.y + radius * Math.sin(angle), 10), new THREE.Vector3(0, 0, -1));
        assert.equal(ray.intersectObject(mesh, false).length, 0, 'real pin cross-section clears rendered eye');
      }
    }
  }
  assert.ok(matchingPins >= 2 * 33);
  assert.equal(model.root.userData.hideGround, true);
  disposeObject3D(model.root);
});



test('339: the finite slider occupies the guide depth and its pin clears the block', () => {
  const { root, update } = createAuthoredDirectActionParallelMotion({ id: 339 });
  const b = root.userData.blocks;
  const ray = new THREE.Raycaster();
  for (let sample = 0; sample <= 64; sample += 1) {
    update(4 * sample / 64); root.updateMatrixWorld(true);
    const block = new THREE.Box3().setFromObject(b.sliderBlock);
    const rails = b.slotRails.map(rail => new THREE.Box3().setFromObject(rail));
    const support = new THREE.Box3().setFromObject(b.slotSupport);
    assert.ok(support.max.z < block.min.z, 'backing clears the sliding block');
    assert.ok(rails.every(rail => support.intersectsBox(rail)), 'backing joins both rails');
    assert.ok(b.archMembers.some(member => support.intersectsBox(new THREE.Box3().setFromObject(member))),
      'slot support reaches the fixed engine arch');
    assert.ok(block.min.y > rails[0].max.y && block.max.y < rails[1].min.y);
    for (const rail of rails) {
      assert.ok(block.min.z > rail.min.z && block.max.z < rail.max.z,
        'the whole slider thickness sits inside the rails');
      assert.ok(block.min.x > rail.min.x && block.max.x < rail.max.x);
    }
    const center = b.jointPins.B.getWorldPosition(new THREE.Vector3());
    const radius = b.jointPins.B.geometry.parameters.radiusTop;
    ray.set(new THREE.Vector3(center.x + 0.5 * block.getSize(new THREE.Vector3()).x * 0.9, center.y, 10),
      new THREE.Vector3(0, 0, -1));
    assert.equal(ray.intersectObject(b.sliderBlock, false).length > 0, true, 'negative control: the block face is solid');
    for (let i = 0; i < 16; i += 1) {
      ray.set(new THREE.Vector3(center.x + radius * Math.cos(i * Math.PI / 8),
        center.y + radius * Math.sin(i * Math.PI / 8), 10), new THREE.Vector3(0, 0, -1));
      assert.equal(ray.intersectObject(b.sliderBlock, false).length, 0);
    }
  }
  disposeObject3D(root);
});

for (const id of [339, 340, 341]) test(`${id}: fixed radius bearing clears the rotating bar`, () => {
  const { root, update } = createAuthoredDirectActionParallelMotion({ id });
  const b = root.userData.blocks;
  for (let i = 0; i <= 16; i += 1) {
    update(4 * i / 16); root.updateMatrixWorld(true);
    const bearing = new THREE.Box3().setFromObject(b.radiusBearing);
    const rod = new THREE.Box3().setFromObject(b.radiusBar);
    assert.ok(bearing.max.z < rod.min.z || bearing.min.z > rod.max.z,
      'the fixed bearing or bracket lies wholly behind or in front of the bar');
  }
  disposeObject3D(root);
});
