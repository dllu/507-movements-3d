import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

test('043 has short source-proportioned tooth faces instead of teeth extending almost to the apex', () => {
  const model = createMovementModel(catalog.movements[42]);
  for (const gear of [model.root.userData.blocks.driver, model.root.userData.blocks.driven]) {
    const positions = gear.userData.toothMeshes[0].geometry.attributes.position;
    let toe = 0;
    let heel = 0;
    for (let i = 0; i < positions.count; i += 1) {
      const radius = Math.hypot(positions.getX(i), positions.getY(i));
      if (positions.getZ(i) < 1.2) toe = Math.max(toe, radius);
      else heel = Math.max(heel, radius);
    }
    assert.ok(toe / heel > 0.58 && toe / heel < 0.65, 'toe is approximately three-fifths of the heel in the source');
  }
});

test('043 the front shaft runs on past the intersection while the rear one stops clear of it', () => {
  const model = createMovementModel(catalog.movements[42]);
  model.root.updateMatrixWorld(true);
  const { driverShaft, drivenShaft } = model.root.userData.blocks;
  const shaftSurface = (shaft) => {
    const points = [];
    shaft.traverse((object) => {
      const positions = object.geometry?.attributes.position;
      if (!positions) return;
      for (let i = 0; i < positions.count; i += 1) {
        points.push(new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld));
      }
    });
    return points;
  };
  const apex = model.root.localToWorld(model.root.userData.gearContact.apex.clone());
  // Plate 43 draws the upper shaft continuing past the crossing.
  const driverAxis = model.root.localToWorld(model.root.userData.gearContact.driverAxis.clone())
    .sub(model.root.localToWorld(new THREE.Vector3())).normalize();
  const reach = Math.min(...shaftSurface(driverShaft).map((point) => point.clone().sub(apex).dot(driverAxis)));
  assert.ok(reach < -0.5, `the upper shaft runs on past the apex (${reach})`);
  for (const point of shaftSurface(drivenShaft)) assert.ok(point.distanceTo(apex) > 0.15);
  const endpoints = [driverShaft, drivenShaft].map((shaft) => [-1, 1].map((sign) => (
    new THREE.Vector3(0, 0, sign * shaft.userData.length / 2).applyMatrix4(shaft.matrixWorld)
  )));
  for (const [index, shaft] of [driverShaft, drivenShaft].entries()) {
    const [start, end] = endpoints[1 - index];
    const axis = end.clone().sub(start);
    for (const point of shaftSurface(shaft)) {
      const fraction = THREE.MathUtils.clamp(point.clone().sub(start).dot(axis) / axis.lengthSq(), 0, 1);
      const closest = start.clone().addScaledVector(axis, fraction);
      assert.ok(point.distanceTo(closest) > 0.085, 'shaft skin clears the other shaft (radius 0.075) by 0.01');
    }
  }
});
