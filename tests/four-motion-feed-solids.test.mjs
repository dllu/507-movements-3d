import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredFourMotionFeedMovement} from '../src/simulation/authored-four-motion-feeds.js';
import {sphereFaceSupport} from '../src/simulation/sphere-face-support.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface, surfacePoints} from './helpers/solid-surface.mjs';

function assertClearCycle(model, pairs, samples = 128) {
  const meshes = object => {const result = [];object.traverse(child => {if (child.isMesh) result.push(child);});return result;};
  const queries = pairs.flatMap(([a, b]) => meshes(a).flatMap(ma => meshes(b).flatMap(mb => [[ma, mb], [mb, ma]])))
    .map(([from, to]) => ({from, to, points: surfacePoints(from.geometry), surface: solidSurface(to.geometry)}));
  for (let frame = 0; frame <= samples; frame++) {
    model.update(frame * model.root.userData.motion.cycleDuration / samples);
    model.root.updateMatrixWorld(true);
    for (const {from, to, points, surface} of queries) {
      if (!new THREE.Box3().setFromObject(from).intersectsBox(new THREE.Box3().setFromObject(to))) continue;
      const matrix = to.matrixWorld.clone().invert().multiply(from.matrixWorld);
      for (const p of points) {
        const q = p.clone().applyMatrix4(matrix);
        assert.ok(!surface.inside(q) || surface.distance(q) < 2e-7,
          `${from.userData.role} enters ${to.userData.role} at frame ${frame}`);
      }
    }
  }
}

test('sphere/face support includes finite edge contact as well as inclined face contact', () => {
  const r = .2;
  const face = sphereFaceSupport([[[ -1, -2, -2], [1, 2, -2], [0, 0, 2]]], r)(0, 0);
  assert.ok(Math.abs(face.x - r * Math.sqrt(1.25)) < 1e-14);
  assert.ok(Math.abs(face.normal[0] - 1 / Math.sqrt(1.25)) < 1e-14);
  const edge = sphereFaceSupport([[[0, 0, 0], [0, 1, 0], [0, 0, 1]]], r)(.6, .6);
  assert.ok(Math.abs(edge.x - Math.sqrt(.02)) < 1e-14, 'sphere touches the finite hypotenuse');
  assert.deepEqual(edge.point, [0, .5, .5]);
});

test('400: both finite cam contacts remain near tangent and carry the required output reaction', () => {
  const model = createAuthoredFourMotionFeedMovement({id: 400}), u = model.root.userData, b = u.blocks;
  const cam = b.cam.userData, a = b.carrierA.userData, f = b.feedBarB.userData;
  try {
    const radial = solidSurface(cam.radialBody.geometry), axial = solidSurface(cam.axialFace.geometry);
    let nominalPenetration = 0, largestTimingShift = 0;
    for (let frame = 0; frame <= 1024; frame++) {
      model.update(frame * u.motion.cycleDuration / 1024);model.root.updateMatrixWorld(true);
      const state = u.kinematics;
      for (const [button, surface, target, min, max] of [
        [f.followerPad, radial, cam.radialBody, .00002, .00011],
        [a.projectionContact, axial, cam.axialFace, -1e-12, 1e-12],
      ]) {
        const center = button.getWorldPosition(new THREE.Vector3()).applyMatrix4(target.matrixWorld.clone().invert());
        const gap = surface.distance(center) - .08;
        assert.ok(gap >= min && gap <= max, `${button.userData.role} gap ${gap}`);
        if (button === a.projectionContact) {
          center.x += state.nominalCarrierX - state.carrierX;
          nominalPenetration = Math.max(nominalPenetration, .08 - surface.distance(center));
        }
      }
      assert.ok(state.axialContact.normal[0] > .49, 'face normal has a substantial feed-driving component');
      const radialMoment = (state.followerPadCenterWorld.x - state.carrierX - u.geometry.pivotX) * state.radialNormal.y;
      // The plate-sized cam (radius 0.60) steepens the rise: the minimum moment is 2.044.
      assert.ok(radialMoment > 2.0, 'radial reaction supplies the lifting moment about B pivot');
      largestTimingShift = Math.max(largestTimingShift, state.carrierX - state.nominalCarrierX);
      if (state.carrierVelocity < -1e-6) {
        const workTop = b.workPlateLeft.position.y + .06;
        for (const tooth of f.teeth) {
          const tip = tooth.getWorldPosition(new THREE.Vector3());
          assert.ok(workTop - tip.y > .0299, 'actual teeth return below the finite work surface');
        }
      }
    }
    // The thin plate-width cam (0.32 feed stroke) gives a 0.0158 nominal penetration and 0.0196 timing shift.
    assert.ok(nominalPenetration > .012, 'restoring the nominal point-follower law must fail finite contact');
    assert.ok(largestTimingShift > .017 && largestTimingShift < .022, 'finite contact correction is real and bounded');
  } finally {disposeObject3D(model.root);}
});

test('400: finite followers, fork, pivot and feeder clear their complete operating strokes', () => {
  const model = createAuthoredFourMotionFeedMovement({id: 400}), b = model.root.userData.blocks;
  const c = b.cam.userData, a = b.carrierA.userData, f = b.feedBarB.userData;
  try {
    assertClearCycle(model, [
      [f.followerPad, c.radialBody], [a.projectionContact, c.radialBody], [a.projectionContact, c.axialFace],
      [a.projection, c.radialBody], [a.projection, c.axialFace],
      ...[a.projectionContact, f.followerPad, a.projection].flatMap(follower =>
        [c.faceRim, c.index].map(detail => [follower, detail])),
      [b.feedBarB, b.workPlateLeft], [b.feedBarB, b.workPlateRight],
      [b.carrierA, b.feedBarB],
      ...b.shaftBearings.flatMap(support => [[c.shaft, support], [c.shaft, support.userData.bearing],
        [c.radialBody, support.userData.bearing], [c.axialFace, support.userData.bearing]]),
    ]);
    assert.equal(model.root.userData.hideGround, true);
    model.root.traverse(object => {
      for (const material of object.material ? [].concat(object.material) : []) assert.equal(material.fog, false);
    });

  } finally {disposeObject3D(model.root);}
});
