import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const build = () => createMovementModel(
  catalog.movements.find(({ id }) => id === 73),
);
const zRange = (object) => {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  return [box.min.z, box.max.z];
};
const leafStopGap = (curve, center, geometry, samples = 160) => {
  let gap = Infinity;
  for (let sample = 0; sample <= samples; sample += 1) {
    const point = curve.getPoint(sample / samples);
    gap = Math.min(gap, Math.hypot(point.x - center.x, point.y - center.y)
      - geometry.leafRadius - geometry.stopPadRadius);
  }
  return gap;
};

test('movement 73 shows only D, A, springs B and C and C’s fixed block', () => {
  const model = build();
  const { blocks } = model.root.userData;
  let meshes = 0;
  model.root.traverse((object) => {
    if (!object.isMesh) return;
    meshes += 1;
    assert.notEqual(object.material.color.getHex(), 0xffffff);
  });
  assert.equal(meshes, 11);
  for (const name of ['baseRail', 'centerPost', 'shaftBridge', 'springPost']) {
    assert.equal(blocks[name], undefined);
  }
  assert.equal(blocks.driverIndicator.isMesh, undefined);
  assert.equal(blocks.ratchetIndicator.isMesh, undefined);
  assert.ok(model.cameraDirection.z > Math.abs(model.cameraDirection.x) * 8);
});

test('movement 73 layers D, A and both springs without axial overlap', () => {
  const model = build();
  const { blocks, geometry } = model.root.userData;
  const [, sleeveFront] = zRange(blocks.driverSleeve);
  const [ratchetBack] = zRange(blocks.ratchet);
  assert.ok(sleeveFront < ratchetBack - 0.005, 'D’s sleeve stops behind A and its hub');
  assert.ok(geometry.driverBoreRadius > blocks.ratchetShaft.userData.radius + 0.05,
    'D turns loose on A’s shaft');
  const strongBottom = geometry.strongSpringPlaneZ - geometry.leafRadius;
  assert.ok(zRange(blocks.catchClamp)[1] < strongBottom, 'B’s clamp passes under C');
  assert.ok(zRange(blocks.catchPad)[1] < strongBottom, 'B’s pad passes under C');
  assert.ok(zRange(blocks.catchClamp)[0] >= geometry.driverPlaneZ + geometry.driverDepth / 2 - 1e-12,
    'B’s clamp stands on D’s face');
});

test('movement 73 keeps B’s leaf off C’s stop while it carries a tooth', () => {
  const model = build();
  const { geometry, stateAtTime } = model.root.userData;
  let minimum = Infinity;
  let sagged = Infinity;
  for (let sample = 0; sample <= 1200; sample += 1) {
    const state = stateAtTime(geometry.driverCyclePeriod * sample / 1200);
    const center = state.stopContact.center;
    minimum = Math.min(minimum, leafStopGap(state.catchCurveWorld, center, geometry));
    if (state.indexing) {
      const [mount, , , , tip] = state.catchCurveWorld.points;
      const chord = new THREE.LineCurve3(mount, tip);
      sagged = Math.min(sagged, leafStopGap(chord, center, geometry));
    }
  }
  assert.ok(minimum > 0.05, `B clears C’s stop pad by ${minimum}`);
  assert.ok(sagged < -0.03, 'a leaf cutting inside the crest circle would hit C’s stop');
});
