// Pass 96 (lane p96-fd-A): depth layout of the gravity escapements 309-312.
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

test('309: the suspension stud spans only the arbor hubs, not a long bar', () => {
  const { root } = load(309);
  const [stud] = byRole(root, /^fixed-pendulum-suspension-stud-end$/);
  const [hub] = byRole(root, /independent-arbor-C$/);
  const s = box(stud), h = box(hub);
  assert.ok(Math.abs(s.min.z - h.min.z) < 1e-6 && Math.abs(s.max.z - h.max.z) < 1e-6, 'stud depth equals the arbor hub depth');
});

test('310: the rod hangs behind the whole escapement and the legs carry their round tips', () => {
  const { root } = load(310);
  const g = root.userData.geometry;
  const rod = box(byRole(root, /^pendulum-rod-between-alternating-beat-pins$/)[0]);
  let rearmost = Infinity;
  for (const mesh of byRole(root, /./)) {
    if (/pendulum|beat-pin|suspension|witness|live-/.test(mesh.userData.role)) continue;
    rearmost = Math.min(rearmost, box(mesh).min.z);
  }
  assert.ok(rod.max.z < rearmost, `rod front ${rod.max.z} behind every other part (${rearmost})`);
  // Lifting pins end just past the lift pads' outer faces.
  for (const pin of root.userData.blocks.liftingPinMeshes) {
    assert.ok(box(pin).max.z - box(pin).min.z <= 2 * (0.27 + 0.07 + 0.02) + 1e-6);
  }
  // No separate hardened-tip stud: the tip is the leg's own outline.
  assert.equal(byRole(root, /hardened/).length, 0);
  assert.deepEqual(root.userData.blocks.lockingLegTipMeshes, root.userData.blocks.lockingLegMeshes);
});

test('311: the rod hangs just in front of the arbor end; tips are part of the legs', () => {
  const { root } = load(311);
  const rod = box(byRole(root, /^double-gravity-escapement-pendulum-rod$/)[0]);
  const shaft = box(byRole(root, /^common-double-wheel-escape-arbor$/)[0]);
  const gap = rod.min.z - shaft.max.z;
  assert.ok(gap > 0 && gap < 0.05, `rod clears the arbor end by ${gap}`);
  assert.equal(byRole(root, /hardened/).length, 0);
});

test('312: E and F are flat tabs of the arm metal; the rod sits just in front of the arbor', () => {
  const { root } = load(312);
  const g = root.userData.geometry;
  for (const letter of ['E', 'F']) {
    const [tab] = byRole(root, new RegExp(`fork-pin-${letter}$`));
    assert.equal(tab.geometry.type, 'ExtrudeGeometry');
    const arm = byRole(root, letter === 'E' ? /^left-A-E-thin-tubular-main-arm$/ : /^right-B-F-thin-tubular-main-arm$/)[0];
    assert.equal(tab.material, arm.material, `${letter} is the arm's own metal`);
    tab.geometry.computeBoundingBox();
    const b = tab.geometry.boundingBox;
    assert.ok(Math.abs((b.max.x - b.min.x) / 2 - g.forkPinRadius) < 1e-6, 'bearing ends where the round pin was');
    assert.ok(b.max.y - b.min.y < b.max.x - b.min.x, 'oblong, as Brown draws');
  }
  const rod = box(byRole(root, /^bloxam-pendulum-rod$/)[0]);
  const shaft = box(byRole(root, /^common-arbor-rigidly-fixing-both-nine-tooth-wheels$/)[0]);
  const gap = rod.min.z - shaft.max.z;
  assert.ok(gap > 0 && gap < 0.05, `rod clears the arbor end by ${gap}`);
  const hub = box(byRole(root, /^large-escape-wheel-hub$/)[0]);
  assert.ok(shaft.min.z < hub.min.z && shaft.min.z > hub.min.z - 0.1, 'arbor ends just behind the large hub');
});
