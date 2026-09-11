import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { boundaryIndex, planarPairDistance } from '../scripts/lib/coaxial-planar-distance.mjs';

const rectangle = (left, bottom, right, top) => [
  { x: left, y: bottom }, { x: right, y: bottom }, { x: right, y: top }, { x: left, y: top },
];

test('planar witness filtering preserves the default nearest contour result', () => {
  const input = rectangle(0, 0, 1, 1), target = boundaryIndex(rectangle(1.003, 0, 2, 1));
  const transform = new THREE.Matrix4();
  const unfiltered = planarPairDistance(input, target, transform);
  assert.ok(Math.abs(unfiltered.distance - 0.003) < 1e-12);
  assert.deepEqual(planarPairDistance(input, target, transform, 0.01, () => true), unfiltered);
  const rejected = planarPairDistance(input, target, transform, 0.01, () => false);
  assert.equal(rejected.witness, null); assert.equal(rejected.intersections, 0);
});

test('rejecting all load witnesses cannot hide actual contour crossings', () => {
  const input = rectangle(0, 0, 1, 1), target = boundaryIndex(rectangle(0.5, -0.5, 1.5, 0.5));
  const transform = new THREE.Matrix4();
  const unfiltered = planarPairDistance(input, target, transform);
  const rejected = planarPairDistance(input, target, transform, 0.01, () => false);
  assert.equal(unfiltered.distance, 0); assert.equal(unfiltered.intersections, 2);
  assert.equal(rejected.witness, null); assert.equal(rejected.intersections, 2);
});
