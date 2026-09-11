import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { helicalSurfaceQuery } from './helpers/helical-surface.mjs';
import { probeCrossedHelicalContact } from './helpers/crossed-helical-contact.mjs';
const catalog = JSON.parse(fs.readFileSync(new URL('../src/data/movements.json', import.meta.url)));

function dispose(model) {
  model.root.traverse((object) => {
    object.geometry?.dispose();
    object.material?.dispose();
  });
}

test('042 surface queries agree with independent rays through the rendered involute helices', () => {
  const model = createMovementModel(catalog.movements[41]);
  for (const gear of [model.root.userData.blocks.driver, model.root.userData.blocks.driven]) {
    const d = gear.userData;
    const query = helicalSurfaceQuery(d.body.geometry);
    const mesh = new THREE.Mesh(d.body.geometry, d.body.material);
    for (let sample = 0; sample < 24; sample += 1) {
      const angle = (sample + 0.371) * 2.399963229728653;
      const z = (THREE.MathUtils.euclideanModulo(sample * 0.618033988749895 + 0.173, 1) - 0.5) * d.faceWidth;
      const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
      const point = direction.clone().multiplyScalar(d.pitchRadius).setZ(z);
      const hit = query.radial(point);
      const outer = d.tipRadius + 0.1;
      const ray = new THREE.Raycaster(direction.clone().multiplyScalar(outer).setZ(z), direction.clone().negate());
      const hits = ray.intersectObject(mesh, false);
      assert.ok(hits.length > 0);
      assert.ok(Math.abs(hit.surface - (outer - hits[0].distance)) < 2e-7,
        'the fast cross-section query matches a ray/triangle intersection');
      const surfacePoint = direction.clone().multiplyScalar(hit.surface).setZ(z);
      assert.ok(query.distance(surfacePoint, hit) < 2e-7, 'the reported point lies on actual triangles');
    }
  }
  dispose(model);
});

test('042 actual tooth faces clear and remain engaged on the reconstructed shallow skew axes', () => {
  const model = createMovementModel(catalog.movements[41]);
  const report = probeCrossedHelicalContact(model, 64);
  assert.ok(report.checked > 2_000_000);
  assert.ok(report.maxPenetration < 2e-6, JSON.stringify(report.worst));
  assert.ok(report.maxGap < 0.0015, `maximum sampled working gap ${report.maxGap}`);
  console.log('042 sampled surface checks', report.checked, 'maximum working gap', report.maxGap);
  dispose(model);
});

test('042 hubs and shafts remain clear of the other rotating gear', () => {
  const model = createMovementModel(catalog.movements[41]);
  const { driver, driven, driverShaft, drivenShaft } = model.root.userData.blocks;
  for (let sample = 0; sample <= 64; sample += 1) {
    model.update(model.root.userData.geometry.inputPeriod * sample / 64, 0);
    model.root.updateMatrixWorld(true);
    const upper = new THREE.Box3().setFromObject(driver.userData.body, true);
    const lower = new THREE.Box3().setFromObject(driven.userData.body, true);
    for (const part of [driver.userData.hub, driverShaft]) {
      assert.ok(new THREE.Box3().setFromObject(part, true).min.y - lower.max.y > 0.69);
    }
    for (const part of [driven.userData.hub, drivenShaft]) {
      assert.ok(upper.min.y - new THREE.Box3().setFromObject(part, true).max.y > 0.58);
    }
  }
  dispose(model);
});
