// Pass 99 (lane p99-d-A): shorter beat pins and fork tabs in 310-312.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const load = (id) => createMovementModel(catalog.movements[id - 1]);
const byRole = (root, pattern) => {
  const found = [];
  root.traverse((object) => { if (object.isMesh && pattern.test(object.userData.role ?? '')) found.push(object); });
  return found;
};
const box = (object) => { object.updateWorldMatrix(true, false); return new THREE.Box3().setFromObject(object); };

test('310: the deep beat collar reaches to just behind arm B, so the beat pins are short', () => {
  const { root } = load(310);
  const collar = box(byRole(root, /^pendulum-beat-collar-where-both-legs-end$/)[0]);
  const rod = box(byRole(root, /^pendulum-rod-between-alternating-beat-pins$/)[0]);
  const arms = ['left', 'right'].map((side) => {
    const meshes = byRole(root, new RegExp(`^${side}-.*gravity-arm-bow`));
    assert.ok(meshes.length > 0, `${side} bow found`);
    return meshes.map(box).reduce((a, b) => a.union(b));
  });
  const rearArmBack = Math.min(...arms.map((b) => b.min.z));
  assert.ok(collar.min.z <= rod.min.z + 1e-6, 'the collar clamps the rod');
  assert.ok(collar.max.z < rearArmBack && collar.max.z > rearArmBack - 0.05,
    `collar front ${collar.max.z} just behind the rear arm (${rearArmBack})`);
  const lengths = byRole(root, /-pendulum-beat-pin$/).map((pin) => {
    const b = box(pin);
    assert.ok(b.min.z < collar.max.z - 0.1, 'each pin bears on the collar over its depth');
    return b.max.z - b.min.z;
  }).sort((a, b) => a - b);
  assert.equal(lengths.length, 2);
  assert.ok(lengths[0] < 0.30 && lengths[1] < 0.85, `beat pins ${lengths}`);
});

test('311: the wheels sit just clear of the pallets and the impulse pins are shorter', () => {
  const { root } = load(311);
  const g = root.userData.geometry;
  assert.ok(g.frontWheelPlaneZ < 0.34 && g.rearWheelPlaneZ > -0.34);
  const lengths = byRole(root, /-pendulum-impulse-pin$/).map((pin) => {
    const b = box(pin);
    return b.max.z - b.min.z;
  });
  assert.equal(lengths.length, 2);
  for (const length of lengths) assert.ok(length < 0.9, `impulse pin ${length}`);
  const rod = byRole(root, /^double-gravity-escapement-pendulum-rod$/)[0];
  assert.equal(rod.userData.seeThrough, true, 'the rod Brown breaks off is see-through');
});
