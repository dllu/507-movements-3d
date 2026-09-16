import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredRopeSteeringMovement} from '../src/simulation/authored-rope-steering.js';

test('490 retains GPU buffers while reproducing the original tube surface throughout steering', () => {
  const model = createAuthoredRopeSteeringMovement({id: 490});
  const data = model.root.userData, geometry = data.blocks.rope.geometry;
  const attributes = Object.fromEntries(Object.entries(geometry.attributes));
  const arrays = Object.fromEntries(Object.entries(attributes).map(([key, value]) => [key, value.array]));
  const index = geometry.index;
  let disposals = 0;
  geometry.addEventListener('dispose', () => disposals++);
  for (let i = 0; i <= 64; i++) {
    model.update(data.geometry.cycleDuration * i / 64);
    assert.equal(data.blocks.rope.geometry, geometry);
    assert.equal(geometry.index, index);
    for (const key of Object.keys(attributes)) {
      assert.equal(geometry.attributes[key], attributes[key]);
      assert.equal(geometry.attributes[key].array, arrays[key]);
    }
    const reference = new THREE.TubeGeometry(data.ropePathState.curve, 220,
      data.geometry.ropeRadius, 7, false);
    for (const key of ['position', 'normal']) {
      const actual = geometry.attributes[key].array, expected = reference.attributes[key].array;
      assert.equal(actual.length, expected.length);
      for (let j = 0; j < actual.length; j++) {
        assert.ok(Math.abs(actual[j] - expected[j]) < 1e-6,
          `${key} changed at pose ${i}, coordinate ${j}`);
      }
    }
    reference.computeBoundingBox();
    assert.ok(geometry.boundingBox.equals(reference.boundingBox));
    reference.dispose();
  }
  assert.equal(disposals, 0);
  assert.equal(data.hideGround, true);
  assert.equal(data.animationTiming.targetCycleDuration, data.geometry.cycleDuration);
});
