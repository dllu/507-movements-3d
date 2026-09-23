import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { densePoints } from './helpers/dense-points.mjs';
import { solidSurface } from './helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const CONTACT_TOLERANCE = 1e-5;

function rendered(group) {
  const meshes = [];
  group.traverse((object) => {
    if (!object.isMesh) return;
    for (let node = object; node; node = node.parent) if (!node.visible) return;
    meshes.push(object);
  });
  return meshes.map((mesh) => ({ mesh, points: densePoints(mesh.geometry, 0.04), field: solidSurface(mesh.geometry) }));
}

function deepest(source, target) {
  const relative = target.mesh.matrixWorld.clone().invert().multiply(source.mesh.matrixWorld);
  const q = new THREE.Vector3();
  let depth = 0;
  for (const point of source.points) {
    q.copy(point).applyMatrix4(relative);
    if (target.field.box.containsPoint(q) && target.field.inside(q)) depth = Math.max(depth, target.field.distance(q));
  }
  return depth;
}

function worstPenetration(model, phases = 97) {
  const { blocks } = model.root.userData;
  const verge = rendered(blocks.verge), crown = rendered(blocks.crownWheel);
  let worst = { depth: 0 };
  for (let i = 0; i < phases; i += 1) {
    const time = 4 * i / (phases - 1);
    model.update(time); model.root.updateMatrixWorld(true);
    const boxes = new Map([...verge, ...crown].map((item) => [item,
      item.field.box.clone().applyMatrix4(item.mesh.matrixWorld).expandByScalar(0.01)]));
    for (const a of verge) for (const b of crown) {
      if (!boxes.get(a).intersectsBox(boxes.get(b))) continue;
      const depth = Math.max(deepest(a, b), deepest(b, a));
      if (depth > worst.depth) worst = { depth, time, pair: `${a.mesh.userData.role} x ${b.mesh.userData.role}` };
    }
  }
  return worst;
}

for (const id of [234, 299, 302]) {
  test(`${id} verge pallets and crown saw teeth only touch at the working tip`, () => {
    const model = createMovementModel(catalog.movements[id - 1]);
    const worst = worstPenetration(model);
    assert.ok(worst.depth < CONTACT_TOLERANCE, `${worst.pair} penetrates ${worst.depth} at ${worst.time}`);
    const { blocks } = model.root.userData;
    for (const marker of [blocks.rightContactMarker, blocks.leftContactMarker]) assert.equal(marker.visible, false);
  });
}

test('crown teeth are saw teeth with axial leading faces and outer tips on the contact orbit', () => {
  const model = createMovementModel(catalog.movements[233]);
  const wheel = model.root.userData.blocks.crownWheel.userData;
  for (const tooth of wheel.toothMeshes) {
    const p = tooth.geometry.attributes.position, angle = tooth.userData.mountAngle;
    const tangent = new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0);
    const offsets = [...Array(p.count).keys()].map((i) => new THREE.Vector3().fromBufferAttribute(p, i).dot(tangent));
    assert.ok(Math.max(...offsets) < 1e-6, 'no material ahead of the leading face');
    assert.ok(Math.min(...offsets) < -0.5, 'long inclined back');
    const tipZ = Math.max(...[...Array(p.count).keys()].map((i) => p.getZ(i)));
    const tipRadii = [...Array(p.count).keys()].filter((i) => Math.abs(p.getZ(i) - tipZ) < 1e-6)
      .map((i) => Math.hypot(p.getX(i), p.getY(i)));
    assert.ok(Math.abs(Math.max(...tipRadii) - wheel.contactRadius) < 1e-6, 'outer tip corner is the contact point');
  }
});

test('negative control: the former right-pallet body side intrudes into the teeth', () => {
  const model = createMovementModel(catalog.movements[233]);
  const { rightPallet } = model.root.userData.blocks;
  rightPallet.face.position.y *= -1;
  assert.ok(worstPenetration(model, 49).depth > 0.02);
});
