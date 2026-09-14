import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createMovementModel, applyDisplayTiming } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
const movement = JSON.parse(fs.readFileSync('src/data/movements.json')).movements[135];
test('136 spherical follower clears the actual cam mesh and follows the envelope', () => {
  const model = createMovementModel(movement), u = model.root.userData, d = u.geometry, b = u.blocks;
  let minimumGap = Infinity, oldMinimum = Infinity, maxNormalError = 0;
  const triangle = new THREE.Triangle(), nearest = new THREE.Vector3();
  const positions = b.toothedRim.geometry.attributes.position;
  const distanceToMesh = point => {
    let minimum = Infinity;
    for (let j = 0; j < positions.count; j += 3) {
      triangle.a.fromBufferAttribute(positions,j);triangle.b.fromBufferAttribute(positions,j+1);triangle.c.fromBufferAttribute(positions,j+2);
      minimum = Math.min(minimum, point.distanceTo(triangle.closestPointToPoint(point, nearest)));
    }
    return minimum;
  };
  try {
    for (let i = 0; i <= 720; i++) {
      const time = d.toothCyclePeriod * i / 720, state = u.stateAtTime(time);
      model.update(time);model.root.updateMatrixWorld(true);
      const center = b.followerTip.getWorldPosition(new THREE.Vector3());
      minimumGap = Math.min(minimumGap, distanceToMesh(b.toothedRim.worldToLocal(center.clone())) - d.followerTipRadius);
      const old = new THREE.Vector3(d.wheelCenter.x + u.toothProfileAtAngle(state.driverAngle).faceCoordinate + .018 + d.followerTipRadius, d.contactY,d.contactZ);
      oldMinimum = Math.min(oldMinimum,distanceToMesh(b.toothedRim.worldToLocal(old)) - d.followerTipRadius);
      assert(state.envelope.radialCoordinate > d.rimInnerRadius && state.envelope.radialCoordinate < d.wheelOuterRadius);
      maxNormalError = Math.max(maxNormalError, Math.abs(state.normalVelocityError));
      assert(state.springLength > 0 && state.springCompression > 0);
      assert(b.follower.position.distanceTo(state.followerPosition) < 1e-12);
      const h = 1e-5;
      const before = u.stateAtTime(time-h), after = u.stateAtTime(time+h);
      assert(Math.abs((after.followerPosition.x-before.followerPosition.x)/(2*h)-state.axialVelocity) < 2e-4);
      assert(Math.abs((after.axialVelocity-before.axialVelocity)/(2*h)-state.axialAcceleration) < .03);
    }
    console.log({minimumGap, oldMinimum, maxNormalError});
    assert(minimumGap > 0, 'sphere must clear all rendered triangles');
    assert(minimumGap < .002, 'follower must stay near the cam');
    assert(oldMinimum < -.05, 'old point-contact motion must visibly intersect a flank');
    assert(maxNormalError < 1e-6);
    applyDisplayTiming(model, movement);
    assert.equal(u.animationTiming.displayCycleDuration, 16);
    assert(u.hideGround && u.supportsRestart);
  } finally { disposeObject3D(model.root); }
});
