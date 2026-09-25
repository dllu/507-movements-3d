import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createMovementModel, applyDisplayTiming } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
import { MAX_SUSTAINED_DISPLAY_ANGULAR_SPEED } from '../src/simulation/display-timing.js';
const movement = JSON.parse(fs.readFileSync('src/data/movements.json')).movements[133];
test('134 finite helical rope clears its flange and both free spans', () => {
  const model = createMovementModel(movement);
  const { geometry: d, blocks: b } = model.root.userData;
  const curve = b.rope.userData.curve;
  try {
    assert(curve.wrap.getPoint(0).distanceTo(curve.wrap.getPoint(1)) > 2 * d.ropeRadius);
    for (let i = 0; i <= 720; i++) {
      const t = i / 720, p = curve.wrap.getPoint(t);
      assert(Math.abs(Math.hypot(p.x, p.y) - d.ropeRadius - d.drumContactBedRadius) < 1e-12);
      assert(Math.abs(p.z) + d.ropeRadius < d.drumWidth / 2, 'rope must remain between flanges');
      const opposite = t < .5 ? curve.rightSpan : curve.leftSpan;
      const line = new THREE.Line3(opposite.v1, opposite.v2);
      assert(p.distanceTo(line.closestPointToPoint(p, true, new THREE.Vector3())) > 2 * d.ropeRadius,
        'free span must clear the other end of the wrap');
      const contact = model.root.userData.wrappedContactStateAtAngle(t * 2 * Math.PI, d.drumAngularSpeed);
      const expectedCreep = 2 * d.ropeLinearSpeed * Math.sin(Math.atan(d.axialSlope) / 2);
      assert(Math.abs(contact.noSlipVelocityError.length() - expectedCreep) < 1e-12);
      assert(Math.abs(contact.ropeVelocity.length() - d.ropeLinearSpeed) < 1e-12);
    }
    const oldRopeFrontZ = d.drumWidth / 2 + d.ropeRadius * 1.78;
    assert(oldRopeFrontZ - d.ropeRadius > d.drumWidth / 2, 'former wrap sat outside its contact bed');
    const positions = b.ropeMesh.geometry.attributes.position.array;
    model.update(.5); model.update(1);
    assert.equal(b.ropeMesh.geometry.attributes.position.array, positions, 'playback must reuse rope geometry');
    // Pass 55 (p55-ends) ran both free spans on to storage reels beyond the
    // plate. The reels turn with the rope at no slip, so they are now the
    // fastest visible part and the sustained display-speed cap, not the old
    // 4 s default, sets the cycle (about 4.81 s).
    const reel = model.root.userData.ropeReels[0].userData.rotor;
    model.update(0); const reelStart = reel.rotation.z; model.update(.5);
    const reelSpeed = (reel.rotation.z - reelStart) / .5;
    applyDisplayTiming(model, movement);
    const timing = model.root.userData.animationTiming;
    assert(Math.abs(timing.sustainedVisibleAngularSpeed - reelSpeed) < 1e-9);
    assert(Math.abs(timing.displayCycleDuration
      - timing.authoredCyclePeriod * reelSpeed / MAX_SUSTAINED_DISPLAY_ANGULAR_SPEED) < 1e-9);
    assert(timing.displayCycleDuration > 4 && timing.displayCycleDuration < 5);
    assert(model.root.userData.hideGround && model.root.userData.supportsRestart);
  } finally { disposeObject3D(model.root); }
});
