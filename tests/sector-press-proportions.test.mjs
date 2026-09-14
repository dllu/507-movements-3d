import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
const movement = JSON.parse(fs.readFileSync('src/data/movements.json')).movements[132];

test('133 frontal landmarks fit the engraving within four pixels', () => {
  const model = createMovementModel(movement);
  try {
    model.update(0);
    model.root.updateMatrixWorld(true);
    const { blocks: b, stateAtTime } = model.root.userData;
    const scale = 2.94 / Math.hypot(129, 187);
    const project = p => [231 + p.x / scale, 466 - p.y / scale];
    const state = stateAtTime(0);
    const cap = new THREE.Box3().setFromObject(b.topCap);
    const platen = new THREE.Box3().setFromObject(b.platenBody);
    const samples = [
      [b.pinionAssembly.position, [360, 279]],
      [state.sectorPinPoint, [308, 470]],
      [state.platenPinPoint, [230, 222]],
      [state.crankHandleEndPoint, [459, 279]],
      [new THREE.Vector3(cap.min.x, cap.max.y), [106, 30]],
      [new THREE.Vector3(cap.max.x, cap.max.y), [360, 30]],
      [new THREE.Vector3(platen.min.x, platen.max.y), [148, 184]],
      [new THREE.Vector3(platen.max.x, platen.min.y), [317, 202]],
    ];
    let maximumError = 0;
    for (const [point, expected] of samples) {
      const actual = project(point);
      maximumError = Math.max(maximumError, Math.hypot(actual[0] - expected[0], actual[1] - expected[1]));
    }
    console.log({ maximumLandmarkErrorPixels: maximumError });
    assert(maximumError < 4.01);
    assert(Math.abs((9.558199 * .42) / scale - Math.hypot(77, 244)) > 50,
      'former rod length must fail the engraving comparison');
  } finally {
    disposeObject3D(model.root);
  }
});
