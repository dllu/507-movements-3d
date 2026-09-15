import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeGovernorBevelPair } from '../src/simulation/mujoco-ball-governor/bevel-pair.js';

test('161 input tooth envelope matches the engraved 34.5-pixel radius', () => {
  const pair = makeGovernorBevelPair();
  try {
    const { parts } = pair.root.userData;
    const positions = parts.inputTooth0.geometry.attributes.position;
    let outer = 0, inner = Infinity;
    for (let i = 0; i < positions.count; i += 1) {
      const radius = Math.hypot(positions.getX(i), positions.getY(i));
      outer = Math.max(outer, radius);
      inner = Math.min(inner, radius);
    }
    assert.ok(Math.abs(outer / .018 - 34.5) < .001);
    assert.ok(inner / .018 > 22 && inner / .018 < 25, 'narrow annular tooth face');
    for (const part of Object.values(parts)) assert.equal(part.material.fog, false);
  } finally {
    pair.dispose();
  }
});

test('161 perpendicular bevel pitch velocities agree and retain unwrapped spindle travel', () => {
  const pair = makeGovernorBevelPair();
  try {
    const { blocks, parameters: p } = pair.root.userData;
    const rotations = angle => {
      pair.update(angle);
      return [blocks.input.rotation.z, blocks.output.rotation.z];
    };
    const start = rotations(0), end = rotations(40.31373645412623);
    const inputRate = (end[0] - start[0]) / 40.31373645412623;
    const outputRate = (end[1] - start[1]) / 40.31373645412623;
    const contact = new THREE.Vector3(0, -p.inputRadius, -p.outputRadius);
    const inputVelocity = new THREE.Vector3(0, 0, -inputRate).cross(contact);
    const outputVelocity = new THREE.Vector3(0, -outputRate, 0).cross(contact);
    assert.ok(inputVelocity.distanceTo(outputVelocity) < 1e-12);
    assert.ok(Math.abs(end[0] - start[0]) > 2 * Math.PI);
    assert.deepEqual(rotations(0), start, 'seeking restores the same tooth phase');
  } finally {
    pair.dispose();
  }
});
