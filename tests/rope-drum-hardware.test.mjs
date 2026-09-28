import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import clip from 'polygon-clipping';
import { createMovementModel } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
const movement = JSON.parse(fs.readFileSync('src/data/movements.json')).movements[133];
const box = o => new THREE.Box3().setFromObject(o);
const polygon = shape => {
  const p = shape.extractPoints(64);
  return [p.shape, ...p.holes].map(r => r.map(v => [v.x, v.y]));
};
test('134 cage: spokes join hub and rims, beams join both end wheels, support clears the shaft', () => {
  const model = createMovementModel(movement);
  const { blocks: b, geometry: d } = model.root.userData;
  try {
    model.root.updateMatrixWorld(true);
    for (const spoke of b.spokes) {
      const rim = spoke.userData.end === 'front' ? b.frontRim : b.rearFlange;
      const shape = polygon(spoke.geometry.parameters.shapes);
      for (const part of [b.hub, rim]) {
        assert.ok(clip.intersection(shape, polygon(part.geometry.parameters.shapes)).length > 0, 'spoke meets hub and rim');
        assert.ok(box(part).intersectsBox(box(spoke)), 'overlap in depth');
      }
      // Spoke faces sit inside the rim faces: no coincident planes.
      assert.ok(box(spoke).max.z < box(rim).max.z - .004 && box(spoke).min.z > box(rim).min.z + .004);
    }
    for (const beam of b.beams) {
      assert.ok(box(beam).intersectsBox(box(b.rearFlange)) && box(beam).intersectsBox(box(b.frontRim)));
      assert.ok(box(beam).max.z > box(b.frontRim).max.z + .01, 'beam end face stands proud of the rim');
    }
    const beamShape = b.beams[0].geometry.parameters.shapes.getPoints(32);
    assert.ok(Math.min(...beamShape.map(p => p.x)) > d.rimInnerRadius, 'beam foot sits in the rim, off its bore');
    assert.ok(Math.abs(Math.max(...beamShape.map(p => p.x)) - d.beamTopRadius) < 1e-9);
    assert.equal(b.hub.geometry.parameters.shapes.holes.length, 1);
    assert.ok(box(b.hub).max.z > box(b.frontRim).max.z + .02, 'hub ring stands proud');
    const bore = b.rearBearing.geometry.parameters.shapes.holes[0].getPoints(128);
    assert.ok(bore.every(p => p.length() > d.shaftRadius));
    assert.ok(box(b.rearBearing).max.z < box(b.hub).min.z);
    assert.ok(box(b.inputShaft).min.z < box(b.rearBearing).min.z);
    assert.ok(box(b.pedestal).max.y < -d.shaftRadius);
    assert.ok(box(b.pedestal).intersectsBox(box(b.rearBearing)) && box(b.pedestal).intersectsBox(box(b.pedestalFoot)));
  } finally { disposeObject3D(model.root); }
});
