import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
const movement = JSON.parse(fs.readFileSync('src/data/movements.json')).movements[132];
const box = part => new THREE.Box3().setFromObject(part);

test('133 fitted bearings support the shafts without blocking their bores', () => {
  const model = createMovementModel(movement);
  const b = model.root.userData.blocks;
  try {
    model.root.updateMatrixWorld(true);
    for (const [bearing, shaft, hub, support] of [
      [b.sectorBearing, b.sectorPivotShaft, b.sectorHub, b.sectorPedestal],
      [b.pinionBearing, b.inputShaft, b.pinionHub, b.pinionBracket],
    ]) {
      const radius = shaft.geometry.parameters.radiusTop;
      const shape = bearing.geometry.parameters.shapes;
      assert.equal(shape.holes.length, 1);
      const bore = shape.holes[0].getPoints(128);
      for (const p of bore) assert(Math.abs(p.length() - radius - .003) < 1e-12);
      assert((radius + .003) * Math.cos(Math.PI / (2 * bearing.geometry.parameters.options.curveSegments)) > radius);
      const axis = shaft.getWorldPosition(new THREE.Vector3());
      const center = bearing.getWorldPosition(new THREE.Vector3());
      assert(Math.hypot(axis.x - center.x, axis.y - center.y) < 1e-12);
      assert(box(shaft).min.z < box(bearing).min.z);
      assert(box(shaft).max.z > box(bearing).max.z);
      assert(box(bearing).max.z < box(hub).min.z, 'stationary bearing must clear rotating hub');
      assert(box(bearing).intersectsBox(box(support)), 'sleeve must join a frame support');
      assert(box(support).max.y < axis.y - radius, 'support must stay below shaft');
    }
    assert.equal(b.sectorHub.geometry.parameters.shapes.holes.length, 1);
    assert.equal(b.sectorRim.geometry.parameters.shapes.holes.length, 3);
    const bore = b.sectorHub.geometry.parameters.shapes.holes[0].getPoints(128);
    assert(bore.every(p => p.length() > b.sectorPivotShaft.geometry.parameters.radiusTop));
  } finally {
    disposeObject3D(model.root);
  }
});
