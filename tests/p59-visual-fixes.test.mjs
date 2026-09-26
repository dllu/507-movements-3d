import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { hasRotationIndicator } from '../src/simulation/rotation-indicator.js';
import { PALETTE } from '../src/simulation/primitives.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const build = (id) => createMovementModel(catalog.movements[id - 1]);
const byRole = (root, role) => {
  const found = [];
  root.traverse((object) => { if ((object.userData.role || object.name) === role) found.push(object); });
  return found;
};
const ink = new THREE.Color(PALETTE.ink);
const isInk = (mesh) => [mesh.material].flat().some((material) => material.color?.equals(ink));

test('028 turntable facing is the disk colour and carries the standard cue', () => {
  const { root } = build(28);
  const meshes = [];
  root.traverse((object) => { if (object.isMesh && object.geometry.type === 'CylinderGeometry' && object.geometry.parameters.radiusTop > 1) meshes.push(object); });
  assert.ok(meshes.length >= 2);
  for (const mesh of meshes) {
    assert.ok(!isInk(mesh), 'no black facing');
    assert.ok(hasRotationIndicator(mesh));
  }
});

test('047 both turned clutch members carry the cue', () => {
  const { root } = build(47);
  const cued = [];
  root.traverse((object) => { if (object.isMesh && hasRotationIndicator(object)) cued.push(object); });
  assert.ok(cued.length >= 2);
});

test('323 has no white collar standing for Brown\'s letter C', () => {
  assert.equal(byRole(build(323).root, 'visible-axle-C-identification-collar').length, 0);
});

test('334 and 346 draw no black strips or tops as rims', () => {
  for (const mesh of byRole(build(334).root, 'roller-A-contact-wear-strip-on-rack-back')) assert.ok(!isInk(mesh));
  const root = build(346).root;
  for (const role of ['fixed-table-bed-top-edge', 'fixed-gland-collar-1', 'fixed-gland-collar-2']) {
    const [mesh] = byRole(root, role);
    assert.ok(mesh && !isInk(mesh), role);
  }
});

test('348 disk A caps shade flat (no sliver seam)', () => {
  const [disk] = byRole(build(348).root, 'disk-A-actual-crossed-through-slot-body');
  const position = disk.geometry.attributes.position, normal = disk.geometry.attributes.normal;
  let caps = 0;
  for (let vertex = 0; vertex < position.count; vertex += 3) {
    const z = position.getZ(vertex);
    if (z !== position.getZ(vertex + 1) || z !== position.getZ(vertex + 2)) continue;
    caps += 1;
    for (let k = 0; k < 3; k += 1) assert.ok(Math.abs(Math.abs(normal.getZ(vertex + k)) - 1) < 1e-6);
  }
  assert.ok(caps > 50);
});

test('361 hand wheel faces shade flat and carry the cue', () => {
  const [wheel] = byRole(build(361).root, 'left-handwheel-fast-on-upper-shaft');
  assert.ok(hasRotationIndicator(wheel));
  const position = wheel.geometry.attributes.position, normal = wheel.geometry.attributes.normal;
  const half = 0.15;
  let faceVertices = 0;
  for (let index = 0; index < position.count; index += 1) {
    // Lathe Y is the axis; face vertices lie on y = +-half inside the rim.
    if (Math.abs(Math.abs(position.getY(index)) - half) > 1e-6) continue;
    const radius = Math.hypot(position.getX(index), position.getZ(index));
    if (radius > 0.7495) continue;
    // The face's own outer ring (not one shared with the rounded rim).
    if (radius > 0.5) faceVertices += 1;
    const direction = new THREE.Vector3().fromBufferAttribute(normal, index).normalize();
    assert.ok(Math.abs(Math.abs(direction.y) - 1) < 1e-6, 'flat face normal');
  }
  assert.ok(faceVertices > 50);
});

test('282 disk hub stands proud of the disk and axle faces', () => {
  const root = build(282).root;
  root.updateMatrixWorld(true);
  const [hub] = byRole(root, 'fixed-disk-axis-hub');
  const [disk] = byRole(root, 'solid-driving-disk');
  const [axle] = byRole(root, 'rear-disk-axle');
  const box = (object) => new THREE.Box3().setFromObject(object);
  assert.ok(box(hub).max.z > box(disk).max.z + 0.01 && box(hub).max.z > box(axle).max.z + 0.005);
  assert.ok(box(hub).min.z < box(disk).min.z - 0.01);
});
