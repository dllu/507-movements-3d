import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
const movement = JSON.parse(fs.readFileSync('src/data/movements.json')).movements[135];
const box = o => new THREE.Box3().setFromObject(o,true);
test('136 side-view dimensions follow the engraving and the bearing fits its shaft', () => {
  const model = createMovementModel(movement), {geometry:d,blocks:b} = model.root.userData;
  try {
    model.update(0);model.root.updateMatrixWorld(true);
    const projectX = x => 124 + (x-d.wheelCenter.x-d.baseBackX)/d.sourceScale;
    assert(Math.abs(projectX(b.fixedGuideSleeve.position.x)-414) < 1e-10);
    assert(Math.abs(projectX(box(b.movingSpringCollar).max.x)-284) < .1);
    assert(Math.abs(projectX(box(b.followerRod).max.x)-510) < .1);
    assert(Math.abs(d.shaftRadius/d.sourceScale-23.5) < 1e-12);
    assert(Math.abs(d.hubRadius/d.sourceScale-50) < 1e-12);
    const shaft=box(b.inputShaft),bearing=box(b.shaftBearing);
    assert(shaft.min.x < bearing.min.x && shaft.max.x > bearing.max.x);
    assert(bearing.max.x < box(b.wheelHub).min.x);
    assert(box(b.shaftPedestal).max.y < shaft.min.y);
    assert(box(b.shaftPedestal).intersectsBox(bearing));
    assert(box(b.shaftPedestal).intersectsBox(box(b.baseRail)));
    assert(box(b.wheelHub).intersectsBox(box(b.wheelBody)));
    const holes=b.shaftBearing.geometry.parameters.shapes.holes;
    assert.equal(holes.length,1);
    assert(holes[0].getPoints(128).every(p=>Math.abs(p.length()-d.shaftRadius-.003)<1e-12));
    assert((d.shaftRadius+.003)*Math.cos(Math.PI/128)>d.shaftRadius);
    assert(projectX(3.35)-414>80,'former guide position must fail source alignment');
    for(let i=0;i<=72;i++){
      model.update(i*d.toothCyclePeriod/72);model.root.updateMatrixWorld(true);
      assert(box(b.followerRod).max.x>box(b.fixedGuideSleeve).max.x);
      assert(box(b.followerRod).min.x<box(b.fixedSpringSeat).min.x);
    }
  } finally { disposeObject3D(model.root); }
});
