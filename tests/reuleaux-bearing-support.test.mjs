import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
const movement = JSON.parse(fs.readFileSync('src/data/movements.json')).movements[134];
const box = o => new THREE.Box3().setFromObject(o, true);
test('135 bearing fits its shaft and all fixed supports join the base', () => {
  const model = createMovementModel(movement);
  const { blocks: b } = model.root.userData;
  try {
    model.root.updateMatrixWorld(true);
    const shaft = box(b.inputShaft), bearing = box(b.rearBearing);
    const radius = b.inputShaft.geometry.parameters.radiusTop;
    const holes = b.rearBearing.geometry.parameters.shapes.holes;
    assert.equal(holes.length, 1);
    assert(holes[0].getPoints(128).every(p => Math.abs(p.length() - radius - .003) < 1e-12));
    assert((radius + .003) * Math.cos(Math.PI / 128) > radius);
    assert(shaft.min.z < bearing.min.z && shaft.max.z > bearing.max.z);
    assert(bearing.max.z < box(b.carrierDisk).min.z);
    for (const support of b.bearingSupports) {
      assert(box(support).intersectsBox(bearing));
      assert(box(support).intersectsBox(box(b.baseRail)));
      assert(box(support).max.y < shaft.min.y, 'A-frame must stay below shaft');
    }
    for (const rail of b.guideRails) assert(box(rail).intersectsBox(box(b.baseRail)));
    assert(.31 - .075 - radius > .06, 'former decorative ring did not fit shaft');
  } finally { disposeObject3D(model.root); }
});
