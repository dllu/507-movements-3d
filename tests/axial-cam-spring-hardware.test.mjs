import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
const movement = JSON.parse(fs.readFileSync('src/data/movements.json')).movements[135];
const box = o => new THREE.Box3().setFromObject(o, true);
test('136 spring retains wire thickness and length between connected bored seats', () => {
  const model = createMovementModel(movement), u = model.root.userData, d = u.geometry, b = u.blocks;
  const spring = b.compressionSpring, positions = spring.geometry.attributes.position;
  const array = positions.array;
  try {
    for (let i = 0; i <= 72; i++) {
      model.update(d.toothCyclePeriod * i / 72); model.root.updateMatrixWorld(true);
      const data = spring.geometry.userData.coil;
      assert(Math.abs(data.currentLength-data.referenceLength) < 1e-11);
      assert(spring.scale.distanceTo(new THREE.Vector3(1,1,1)) < 1e-12);
      assert.equal(spring.geometry.attributes.position.array, array);
      for (let ring = 0; ring <= data.segments; ring += 16) {
        const center = new THREE.Vector3();
        for (let j = 0; j < data.sides; j++) center.add(new THREE.Vector3().fromBufferAttribute(positions,ring*data.sides+j));
        center.divideScalar(data.sides);
        for (let j = 0; j < data.sides; j++) {
          assert(Math.abs(center.distanceTo(new THREE.Vector3().fromBufferAttribute(positions,ring*data.sides+j))-d.springWireRadius) < 2e-7);
        }
      }
      assert(data.radius-d.springWireRadius > d.followerRodRadius);
      assert(data.radius+d.springWireRadius < d.springRadius+.075);
      const sb = box(spring);
      assert(Math.abs(sb.min.x-box(b.movingSpringCollar).max.x) < 3e-7);
      assert(Math.abs(sb.max.x-box(b.fixedSpringSeat).min.x) < 3e-7);
      assert(box(b.fixedSpringSeat).intersectsBox(box(b.fixedGuideSleeve)));
      assert(box(b.guidePost).max.y < box(b.followerRod).min.y);
      assert(box(b.guideBrace).intersectsBox(box(b.guideFrontFoot)));
      assert(box(b.guideFrontFoot).intersectsBox(box(b.guideBaseFoot)));
      for (const part of [b.fixedSpringSeat,b.fixedGuideSleeve]) {
        const holes = part.geometry.parameters.shapes.holes;
        assert.equal(holes.length,1);
        assert(holes[0].getPoints(128).every(p=>p.length()>d.followerRodRadius+.0049));
      }
    }
  } finally { disposeObject3D(model.root); }
});
