import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredRopeSteeringMovement} from '../src/simulation/authored-rope-steering.js';
import {LaidRopeGeometry} from '../src/simulation/laid-rope.js';

test('490 retains GPU buffers while matching the shared laid-rope surface throughout steering', () => {
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
    const state = data.stateAtTime(data.geometry.cycleDuration * i / 64);
    assert.equal(geometry.type, 'LaidRopeGeometry');
    assert.equal(geometry.userData.travel, state.ropeDisplacement,
      'the rope lay travels with the analytic drum payout');
    const reference = new LaidRopeGeometry(data.ropePathState.curve, 420,
      data.geometry.ropeRadius, 7, false, {travel: state.ropeDisplacement});
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

test('490 fixed-length rope ends follow actual tiller clamps throughout the helm cycle', () => {
  const model = createAuthoredRopeSteeringMovement({id: 490});
  const data = model.root.userData;
  const clamps = data.blocks.tiller.children.filter(o => o.userData.role === 'fixed-rope-end-clamp-on-tiller');
  const lengths = [];
  for (let i = 0; i <= 64; i++) {
    model.update(data.geometry.cycleDuration * i / 64);
    model.root.updateMatrixWorld(true);
    lengths.push(data.ropePathState.pathLength);
    const points = data.ropePathState.points;
    for (const clamp of clamps) {
      const end = clamp.position.y > 0 ? points[0] : points.at(-1);
      assert.ok(clamp.getWorldPosition(new THREE.Vector3()).distanceTo(end) < 1e-12,
        `rope disconnected from rendered clamp at pose ${i}`);
    }
  }
  // Cubic interpolation and arc-length quadrature leave a small numerical
  // residual; the previous taut path varied by more than one percent.
  assert.ok((Math.max(...lengths) - Math.min(...lengths)) / Math.min(...lengths) < 1e-5);
});
