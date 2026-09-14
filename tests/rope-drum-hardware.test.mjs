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
test('134 traced spokes join hub and rim; bored support clears the shaft', () => {
  const model = createMovementModel(movement);
  const { blocks: b, geometry: d } = model.root.userData;
  try {
    model.root.updateMatrixWorld(true);
    const spoke = polygon(b.spokes[0].geometry.parameters.shapes);
    for (const part of [b.hub, b.contactBed]) {
      assert(clip.intersection(spoke, polygon(part.geometry.parameters.shapes)).length > 0,
        'spoke must intersect both castings in frontal projection');
      assert(box(part).intersectsBox(box(b.spokes[0])), 'castings must overlap in depth');
    }
    for (const p of b.spokes[0].geometry.parameters.shapes.getPoints(128)) {
      assert(p.length() < d.drumContactBedRadius - .05, 'spoke must stay beneath rope bed');
    }
    assert.equal(b.hub.geometry.parameters.shapes.holes.length, 1);
    const bore = b.rearBearing.geometry.parameters.shapes.holes[0].getPoints(128);
    assert(bore.every(p => p.length() > d.shaftHoleRadius));
    assert((d.shaftHoleRadius + .003) * Math.cos(Math.PI / 48) > d.shaftHoleRadius);
    assert(box(b.rearBearing).max.z < box(b.hub).min.z);
    assert(box(b.inputShaft).min.z < box(b.rearBearing).min.z);
    assert(box(b.inputShaft).max.z > box(b.rearBearing).max.z);
    assert(box(b.pedestal).max.y < -d.shaftHoleRadius);
    assert(box(b.pedestal).intersectsBox(box(b.rearBearing)));
    assert(box(b.pedestal).intersectsBox(box(b.pedestalFoot)));
    assert.equal(b.frontOuterOutline.visible, false);
    for (const plate of b.rimSeparators) {
      assert(box(plate).min.z < box(b.frontFlange).max.z, 'divider must join rim face');
      assert(box(plate).max.z > box(b.frontFlange).max.z + .002, 'divider face must avoid z-fighting');
    }
  } finally { disposeObject3D(model.root); }
});
