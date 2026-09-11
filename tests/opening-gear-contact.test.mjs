import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

test('027 rollers enter real radial channels, touch their walls, and clear the backing and driver plate', () => {
  const model = createMovementModel(catalog.movements[26]);
  const { driven, driver, rollers } = model.root.userData.blocks;
  const width = driven.userData.slotWidth;
  const meshes = [];
  driven.traverse((part) => { if (part.isMesh) meshes.push(part); });
  let centralPassages = 0;
  for (let sample = 0; sample <= 47; sample += 1) {
    model.update(2 * Math.PI / 1.08 * sample / 47, 0);
    model.root.updateMatrixWorld(true);
    const inverse = driven.userData.rotor.matrixWorld.clone().invert();
    for (const [index, roller] of rollers.entries()) {
      const contact = model.root.userData.contacts[index];
      const center = roller.getWorldPosition(new THREE.Vector3());
      roller.traverse((part) => {
        const positions = part.geometry?.attributes.position;
        if (!positions) return;
        for (let i = 0; i < positions.count; i += 1) {
          const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(part.matrixWorld).applyMatrix4(inverse);
          assert.ok(point.z > driven.userData.floorZ, 'roller clears the groove floor');
          if (point.z >= driven.userData.wallTopZ) continue;
          const nearestLine = Math.min(...[0, 1, 2].map((line) =>
            Math.abs(point.x * Math.sin(line * Math.PI / 3) - point.y * Math.cos(line * Math.PI / 3))));
          assert.ok(nearestLine <= width / 2 + 2e-6, 'actual roller vertices stay inside the open channel');
        }
      });
      const direction = new THREE.Vector3(-contact.grooveLineDirection.y, contact.grooveLineDirection.x, 0);
      const ray = new THREE.Raycaster(center, direction, 0, 0.5);
      const hits = ray.intersectObjects(meshes, false);
      if (contact.engaged) {
        assert.ok(hits.length > 0, 'a solid wall exists where the roller drives');
        assert.ok(Math.abs(hits[0].distance - model.root.userData.geometry.rollerRadius) < 2e-6,
          'the roller touches the actual wall surface');
      } else {
        centralPassages += 1;
        assert.ok(hits.length === 0 || hits[0].distance > model.root.userData.geometry.rollerRadius + 1e-5,
          'the passing roller is not falsely reported as engaged');
      }
    }
    const plate = driver.userData.rotor.children.find((part) => part.geometry?.type === 'ExtrudeGeometry');
    const box = new THREE.Box3().setFromObject(plate);
    assert.ok(box.min.z > driven.userData.wallTopZ + 0.02, 'the carrier clears the raised channel walls');
  }
  assert.ok(centralPassages > 0);
});

test('028 crowned roller meets the disk without flange penetration through driving and adjustment', () => {
  const model = createMovementModel(catalog.movements[27]);
  const { roller } = model.root.userData.blocks;
  for (let sample = 0; sample <= 79; sample += 1) {
    model.update(model.root.userData.animationTiming.authoredCyclePeriod * sample / 79, 0);
    model.root.updateMatrixWorld(true);
    let minimumGap = Infinity;
    roller.traverse((part) => {
      const positions = part.geometry?.attributes.position;
      if (!positions) return;
      for (let i = 0; i < positions.count; i += 1) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(part.matrixWorld);
        minimumGap = Math.min(minimumGap, point.y - model.root.userData.geometry.diskSurfaceY);
      }
    });
    assert.ok(minimumGap >= model.root.userData.kinematics.liftClearance - 1e-6, 'no roller geometry enters the disk');
    assert.ok(minimumGap < model.root.userData.kinematics.liftClearance + 0.0003, 'the actual crown reaches its contact level');
  }
});

test('032 source-sized friction wheels meet without their actual treads or face hardware crossing', () => {
  const model = createMovementModel(catalog.movements[31]);
  const { driver, driven } = model.root.userData.blocks;
  assert.ok(Math.abs(driver.userData.radius / driven.userData.radius - 5 / 8) < 1e-12);
  for (let sample = 0; sample <= 47; sample += 1) {
    model.update(2 * Math.PI / 1.4 * sample / 47, 0);
    model.root.updateMatrixWorld(true);
    let gap = 0;
    for (const [wheel, mate, direction] of [[driver, driven, -1], [driven, driver, 1]]) {
      wheel.traverse((part) => {
        const positions = part.geometry?.attributes.position;
        if (!positions) return;
        for (let i = 0; i < positions.count; i += 1) {
          const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(part.matrixWorld);
          assert.ok(Math.hypot(point.x - mate.position.x, point.y - mate.position.y) >= mate.userData.radius - 1e-6,
            'wheel faces, treads, and indices clear the mating cylinder');
        }
      });
      const hits = new THREE.Raycaster(new THREE.Vector3(-direction * 0.01, 0, 0), new THREE.Vector3(direction, 0, 0), 0, 0.02)
        .intersectObject(wheel.userData.tread, false);
      assert.ok(hits.length > 0, 'the rendered tread reaches the contact neighborhood');
      gap += hits[0].distance - 0.01;
    }
    assert.ok(gap < 0.0005, 'the tessellated round treads meet within half a thousandth');
  }
});
