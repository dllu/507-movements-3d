import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else if (object.material) {
      materials.add(object.material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 278 is the bilateral rope-tension-released Otis elevator safety stop', () => {
  const movement = catalog.movements[277];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 278);
  assert.equal(movement.number, '278');
  assert.equal(
    movement.title,
    'Otis Spring-Triggered Elevator Safety Stop',
  );
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'rope-tension-spring-trip-bilateral-elevator-safety-stop',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one hoisting rope a/);
  assert.match(mechanism, /vertical pin b/);
  assert.match(mechanism, /transverse spring c/);
  assert.match(mechanism, /two rigid elbow levers/);
  assert.match(mechanism, /both pawls d simultaneously/);
  assert.match(mechanism, /fixed upward-hook racks A/);
  assert.equal(transmission.bilateral, true);

  assert.equal(blocks.carriage.parent, model.root);
  vectorNear(blocks.carriage.userData.axis, Y_AXIS, 0, 'platform guide axis');
  assert.equal(blocks.leftUpright.parent, model.root);
  assert.equal(blocks.rightUpright.parent, model.root);
  assert.equal(blocks.rackTeeth.length, 28);
  assert.ok(blocks.rackTeeth.every((tooth) => tooth.parent === model.root));
  assert.equal(blocks.leftLever.parent, blocks.carriage);
  assert.equal(blocks.rightLever.parent, blocks.carriage);
  vectorNear(blocks.leftLever.userData.axis, Z_AXIS, 0,
    'left lever axis');
  vectorNear(blocks.rightLever.userData.axis, Z_AXIS, 0,
    'right lever axis');
  assert.equal(blocks.leftUpperArm.parent, blocks.leftLever);
  assert.equal(blocks.rightUpperArm.parent, blocks.rightLever);
  assert.equal(blocks.leftLowerArm.parent, blocks.leftLever);
  assert.equal(blocks.rightLowerArm.parent, blocks.rightLever);
  assert.equal(blocks.leftPawl.parent, blocks.carriage);
  assert.equal(blocks.rightPawl.parent, blocks.carriage);
  assert.equal(blocks.pinAssembly.parent, blocks.carriage);
  assert.equal(blocks.slidingEye.parent, blocks.pinAssembly);
  assert.notEqual(blocks.slidingEye.parent, blocks.leftUpperArm);
  assert.notEqual(blocks.slidingEye.parent, blocks.rightUpperArm);
  assert.equal(blocks.spring.parent, blocks.carriage);
  assert.equal(blocks.upperRope.parent, model.root);
  assert.equal(blocks.lowerRope.parent, model.root);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => /rigid-elbow-lever$/.test(role))
    .length, 2);
  assert.equal(roles.filter((role) => /guided-safety-pawl-d$/.test(role))
    .length, 2);
  assert.equal(roles.filter((role) => /upward-hook-rack-tooth/.test(role))
    .length, 28);
  assert.equal(roles.filter((role) => /belt|pulley/.test(role)).length, 0);
  disposeModel(model.root);
});

test('movement 278 records Brown’s arrested pose, unavailable animation, and the Otis patent constraint', () => {
  const model = createMovementModel(catalog.movements[277]);
  const {
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.plate278;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /official Movement 278 page marks its animation unavailable/);
  assert.match(sourceAnimation.reason, /original Otis patent specification/);
  assert.equal(sourceReference.officialDescription,
    catalog.movements[277].description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 5);
  assert.deepEqual(plate.rasterEye, { x: 264, y: 268 });
  assert.deepEqual(plate.rasterLeftPivot, { x: 151, y: 249 });
  assert.deepEqual(plate.rasterRightPivot, { x: 377, y: 249 });
  assert.deepEqual(plate.rasterLeftLowerJoint, { x: 164, y: 318 });
  assert.deepEqual(plate.rasterRightLowerJoint, { x: 364, y: 318 });
  assert.deepEqual(plate.rasterLeftPawlTip, { x: 88, y: 318 });
  assert.deepEqual(plate.rasterRightPawlTip, { x: 440, y: 318 });
  assert.deepEqual(plate.rasterRopeEye, { x: 264, y: 97 });
  assert.match(plate.inferredTopology, /one moving platform B/);
  assert.match(plate.inferredTopology, /inner arms overlap in a sliding eye/);
  assert.match(plate.inferredTopology, /two outward-moving safety pawls d/);

  const source = stateAtTime(0);
  assert.equal(source.caught, true);
  assert.match(source.stage, /source-arrested/);
  vectorNear(
    new THREE.Vector2(source.pinEye.x, source.pinEye.y),
    sourcePointToModel(plate.rasterEye),
    4e-17,
    'source sliding-eye center',
  );
  for (const [key, error] of Object.entries(
    plate.sourceIdealizationPixelErrors,
  )) {
    assert.ok(error <= plate.measurementUncertaintyPixels,
      `${key} remains within source uncertainty: ${error}px`);
  }
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 73,
    edition: 21,
    illustrationPage: 72,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.primaryPatent.patentNumber, 'US31128A');
  assert.equal(sourceReference.primaryPatent.inventor, 'E. G. Otis');
  assert.equal(sourceReference.primaryPatent.patentDate, '1861-01-15');
  assert.equal(
    sourceReference.primaryPatent.title,
    'Improvement in Hoisting Apparatus',
  );
  assert.match(sourceReference.primaryPatent.evidence, /upward-hook racks/);
  assert.match(sourceReference.primaryPatent.evidence, /overlapping inner lever ends/);
  assert.match(sourceReference.primaryPatent.evidence, /rope pull is lost/);
  disposeModel(model.root);
});

test('movement 278 preserves two rigid mirrored elbows while their inner arms slide through one eye', () => {
  const model = createMovementModel(catalog.movements[277]);
  const { geometry, stateAtTime, transmission } = model.root.userData;
  let maximumEyeError = 0;
  let maximumLowerArmError = 0;
  let maximumPawlLengthError = 0;
  let maximumMirrorError = 0;

  for (let index = 0; index <= 32768; index += 1) {
    const time = model.root.userData.timeline.cyclePeriod * index / 32768;
    const state = stateAtTime(time);
    const leftEyeDistance = geometry.leverHalfSpan
      / Math.cos(state.leverAngle);
    const leftEyeOnArm = geometry.leftPivot.clone().add(
      new THREE.Vector3(
        Math.cos(state.leverAngle),
        Math.sin(state.leverAngle),
        0,
      ).multiplyScalar(leftEyeDistance),
    );
    const rightEyeOnArm = geometry.rightPivot.clone().add(
      new THREE.Vector3(
        -Math.cos(state.leverAngle),
        Math.sin(state.leverAngle),
        0,
      ).multiplyScalar(leftEyeDistance),
    );
    maximumEyeError = Math.max(
      maximumEyeError,
      state.eyeClosureError,
      new THREE.Vector2(leftEyeOnArm.x, leftEyeOnArm.y).distanceTo(
        new THREE.Vector2(state.pinEye.x, state.pinEye.y),
      ),
      new THREE.Vector2(rightEyeOnArm.x, rightEyeOnArm.y).distanceTo(
        new THREE.Vector2(state.pinEye.x, state.pinEye.y),
      ),
    );
    maximumLowerArmError = Math.max(
      maximumLowerArmError,
      Math.abs(state.leftLowerJoint.distanceTo(geometry.leftPivot)
        - geometry.lowerArmLength),
      Math.abs(state.rightLowerJoint.distanceTo(geometry.rightPivot)
        - geometry.lowerArmLength),
    );
    maximumPawlLengthError = Math.max(
      maximumPawlLengthError,
      Math.abs(state.leftPawlTip.distanceTo(state.leftLowerJoint)
        - geometry.pawlLength),
      Math.abs(state.rightPawlTip.distanceTo(state.rightLowerJoint)
        - geometry.pawlLength),
    );
    maximumMirrorError = Math.max(
      maximumMirrorError,
      Math.abs(state.leftLowerJoint.x + state.rightLowerJoint.x),
      Math.abs(state.leftLowerJoint.y - state.rightLowerJoint.y),
      Math.abs(state.leftPawlTip.x + state.rightPawlTip.x),
      Math.abs(state.leftPawlTip.y - state.rightPawlTip.y),
    );
    assert.ok(leftEyeDistance < geometry.upperArmVisibleLength);
  }

  assert.ok(maximumEyeError < 5e-16,
    `sliding-eye closure ${maximumEyeError}`);
  assert.ok(maximumLowerArmError < 3e-16,
    `lower-arm length error ${maximumLowerArmError}`);
  assert.ok(maximumPawlLengthError < 3e-16,
    `pawl length error ${maximumPawlLengthError}`);
  assert.ok(maximumMirrorError < 3e-16,
    `bilateral mirror error ${maximumMirrorError}`);
  assert.match(transmission.constraintLaw, /inner arm slides through the vertical eye/);
  assert.match(transmission.constraintLaw, /halfSpan\*tan\(leverAngle\)/);
  disposeModel(model.root);
});

test('movement 278 keeps both pawls clear throughout normal hoisting and lowering', () => {
  const model = createMovementModel(catalog.movements[277]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  let minimumRackClearance = Infinity;
  let maximumRopeGap = 0;

  for (let index = 0; index <= 16384; index += 1) {
    const time = timeline.recoveryEnd
      + (timeline.normalLowerEnd - timeline.recoveryEnd)
      * index / 16384;
    const state = stateAtTime(time);
    minimumRackClearance = Math.min(
      minimumRackClearance,
      state.lateralRackClearance,
    );
    maximumRopeGap = Math.max(maximumRopeGap, state.ropeGap);
    near(state.springRelease, 0, 0, `spring restrained at ${time}`);
    near(state.ropeTension, 1, 0, `rope tension at ${time}`);
    assert.equal(state.contactActive, false);
    assert.equal(state.caught, false);
    assert.ok(Math.abs(state.leftPawlTip.x) < geometry.rackToothTipX);
    assert.ok(Math.abs(state.rightPawlTip.x) < geometry.rackToothTipX);
  }

  const start = stateAtTime(timeline.recoveryEnd);
  const raised = stateAtTime(timeline.hoistEnd);
  const failureReady = stateAtTime(timeline.normalLowerEnd);
  near(start.platformY, 0, 0, 'normal-travel start height');
  near(raised.platformY, geometry.hoistHeight, 0, 'normal hoist height');
  near(raised.platformSpeed, 0, 0, 'zero speed at hoist reversal');
  near(failureReady.platformY, geometry.rackPitch, 0,
    'one pitch above arrest seat before failure');
  near(failureReady.platformSpeed, 0, 0,
    'zero speed at selected failure instant');
  assert.ok(start.lateralRackClearance > 0.08);
  near(minimumRackClearance, start.lateralRackClearance, 2e-15,
    'constant normal pawl clearance');
  near(maximumRopeGap, 0, 0, 'taut rope has no break gap');
  assert.ok(stateAtTime(2.6).platformSpeed > 0);
  assert.ok(stateAtTime(4.0).platformSpeed < 0);
  disposeModel(model.root);
});

test('movement 278 extends into open rack gaps and catches both pawls after exactly one pitch of drop', () => {
  const model = createMovementModel(catalog.movements[277]);
  const { geometry, stateAtTime, timeline, transmission } = model.root.userData;
  let previousRelease = -Infinity;
  let previousPlatformY = Infinity;
  let minimumVerticalClearanceWhileEntered = Infinity;
  let maximumAsymmetry = 0;

  for (let index = 0; index <= 32768; index += 1) {
    const time = timeline.normalLowerEnd
      + (timeline.catchTime - timeline.normalLowerEnd)
      * index / 32768;
    const state = stateAtTime(time);
    assert.ok(state.springRelease >= previousRelease - 2e-15);
    assert.ok(state.platformY <= previousPlatformY + 2e-15);
    previousRelease = state.springRelease;
    previousPlatformY = state.platformY;
    maximumAsymmetry = Math.max(
      maximumAsymmetry,
      state.leftPawlGlobal.distanceTo(
        new THREE.Vector3(
          -state.rightPawlGlobal.x,
          state.rightPawlGlobal.y,
          state.rightPawlGlobal.z,
        ),
      ),
    );
    if (state.engagementDepth > 0) {
      minimumVerticalClearanceWhileEntered = Math.min(
        minimumVerticalClearanceWhileEntered,
        state.verticalCatchClearance,
      );
    }
  }

  const failureReady = stateAtTime(timeline.normalLowerEnd);
  const caught = stateAtTime(timeline.catchTime);
  near(failureReady.platformY - caught.platformY,
    geometry.rackPitch, 0, 'one-rack-pitch failure drop');
  near(caught.platformY, geometry.sourcePlatformY, 0,
    'arrested source platform height');
  near(caught.springRelease, 1, 0, 'spring fully released');
  near(caught.ropeTension, 0, 0, 'broken rope carries no tension');
  assert.ok(caught.ropeGap > geometry.maximumRopeGap);
  assert.ok(caught.engagementDepth > 0.047);
  near(caught.verticalCatchClearance, 0, 2e-16,
    'pawl underside on hook seat');
  assert.equal(caught.caught, true);
  assert.ok(minimumVerticalClearanceWhileEntered >= -2e-15,
    `pawl crossed a tooth before capture: ${minimumVerticalClearanceWhileEntered}`);
  assert.ok(maximumAsymmetry < 3e-16,
    `bilateral failure asymmetry ${maximumAsymmetry}`);
  assert.match(transmission.failureLaw, /both pawls into the rack gaps/);
  assert.match(transmission.failureLaw, /one short pitch of descent/);
  assert.match(transmission.failureLaw, /same pair of upward-hook tooth seats/);
  disposeModel(model.root);
});

test('movement 278 analytic platform, lever, eye, and pawl rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[277]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-4;
  for (const time of [
    1.05, 1.30, 1.55,
    2.20, 2.60, 3.00,
    3.70, 4.00, 4.30,
    4.75, 5.10, 5.45,
  ]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    const speed = (key) => (after[key] - before[key]) / (2 * step);
    const acceleration = (key) => (
      after[key] - 2 * state[key] + before[key]
    ) / step ** 2;
    near(speed('platformY'), state.platformSpeed, 5e-8,
      `platform speed at ${time}`);
    near(acceleration('platformY'), state.platformAcceleration, 4e-7,
      `platform acceleration at ${time}`);
    near(speed('leverAngle'), state.leverAngularSpeed, 5e-8,
      `lever speed at ${time}`);
    near(acceleration('leverAngle'), state.leverAngularAcceleration, 4e-7,
      `lever acceleration at ${time}`);
    near(
      (after.pinEye.y - before.pinEye.y) / (2 * step),
      state.pinEyeSpeed,
      5e-8,
      `eye speed at ${time}`,
    );
    near(
      (after.pinEye.y - 2 * state.pinEye.y + before.pinEye.y) / step ** 2,
      state.pinEyeAcceleration,
      4e-7,
      `eye acceleration at ${time}`,
    );
    const pawlSpeed = after.leftPawlGlobal.clone()
      .sub(before.leftPawlGlobal)
      .multiplyScalar(1 / (2 * step));
    const pawlAcceleration = after.leftPawlGlobal.clone()
      .add(before.leftPawlGlobal)
      .addScaledVector(state.leftPawlGlobal, -2)
      .multiplyScalar(1 / step ** 2);
    vectorNear(pawlSpeed, state.leftPawlGlobalVelocity, 5e-8,
      `left pawl speed at ${time}`);
    vectorNear(pawlAcceleration, state.leftPawlGlobalAcceleration, 4e-7,
      `left pawl acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 278 update binds platform travel, mirrored levers, spring, split rope, and catch contacts', () => {
  const model = createMovementModel(catalog.movements[277]);
  const {
    animationTiming,
    blocks,
    cameraFitBounds,
    stateAtTime,
    timeline,
  } = model.root.userData;
  assert.equal(animationTiming.authoredCyclePeriod, 8);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);

  for (const time of [0, 1.3, 2.6, 4.0, 5.1, timeline.catchTime, 8]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.carriage.position.y, expected.platformY, 0,
      `rendered platform at ${time}`);
    near(blocks.leftLever.rotation.z, expected.leverAngle, 0,
      `left lever rotation at ${time}`);
    near(blocks.rightLever.rotation.z, -expected.leverAngle, 0,
      `right lever rotation at ${time}`);
    for (const [side, joint, tip] of [['left', expected.leftLowerJoint, expected.leftPawlTip], ['right', expected.rightLowerJoint, expected.rightPawlTip]]) {
      const mesh=blocks[side+'Pawl'].children[0];
      vectorNear(mesh.position,joint,0,`${side} bored pawl joint at ${time}`);
      const end=new THREE.Vector3(model.root.userData.geometry.pawlLength,0,0).applyQuaternion(mesh.quaternion).add(mesh.position);
      vectorNear(end,tip,1e-14,`${side} finite pawl tip at ${time}`);
    }
    vectorNear(blocks.lowerJointPins[0].position,
      expected.leftLowerJoint, 0, `left joint pin at ${time}`);
    vectorNear(blocks.lowerJointPins[1].position,
      expected.rightLowerJoint, 0, `right joint pin at ${time}`);
    near(blocks.pinAssembly.position.y, expected.pinEye.y, 0,
      `rendered rope pin at ${time}`);
    vectorNear(blocks.spring.userData.center,
      expected.springContact, 0, `spring center at ${time}`);
    vectorNear(blocks.upperRope.userData.brokenEnd,
      expected.upperBrokenEnd, 0, `upper rope end at ${time}`);
    vectorNear(blocks.lowerRope.userData.brokenEnd,
      expected.lowerBrokenEnd, 0, `lower rope end at ${time}`);
    vectorNear(blocks.lowerRope.userData.attachment,
      expected.ropeEye, 0, `rope attachment at ${time}`);
    near(model.root.userData.contacts.rope.gap,
      expected.ropeGap, 0, `rope gap at ${time}`);
    assert.equal(model.root.userData.contacts.leftPawlRack.active,
      expected.caught);
    assert.equal(model.root.userData.contacts.rightPawlRack.active,
      expected.caught);
  }

  const renderedBounds = new THREE.Box3();
  for (let index = 0; index <= 128; index += 1) {
    model.update(timeline.cyclePeriod * index / 128);
    model.root.updateMatrixWorld(true);
    renderedBounds.union(new THREE.Box3().setFromObject(model.root, true));
  }
  assert.equal(cameraFitBounds.containsBox(renderedBounds), true);
  disposeModel(model.root);
});

test('movement 278 closes its arrested demonstration exactly while movement 339 remains authored', () => {
  const model = createMovementModel(catalog.movements[277]);
  const { stateAtTime, timeline } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.cyclePeriod);

  near(closure.platformY, start.platformY, 0, 'platform closure');
  near(closure.platformSpeed, start.platformSpeed, 0,
    'platform speed closure');
  near(closure.leverAngle, start.leverAngle, 0, 'lever closure');
  near(closure.pinEye.y, start.pinEye.y, 0, 'sliding-eye closure');
  vectorNear(closure.leftLowerJoint, start.leftLowerJoint, 0,
    'left elbow closure');
  vectorNear(closure.rightLowerJoint, start.rightLowerJoint, 0,
    'right elbow closure');
  vectorNear(closure.leftPawlTip, start.leftPawlTip, 0,
    'left pawl closure');
  vectorNear(closure.rightPawlTip, start.rightPawlTip, 0,
    'right pawl closure');
  near(closure.ropeGap, start.ropeGap, 0, 'broken-rope pose closure');
  near(closure.verticalCatchClearance, 0, 2e-16,
    'catch contact closure');
  assert.equal(start.caught, true);
  assert.equal(closure.caught, true);
  assert.equal(closure.cycleIndex, 1);

  model.update(0);
  const sourceCarriageY = model.root.userData.blocks.carriage.position.y;
  const sourceLeftLever = model.root.userData.blocks.leftLever.quaternion.clone();
  model.update(timeline.cyclePeriod);
  near(model.root.userData.blocks.carriage.position.y,
    sourceCarriageY, 0, 'rendered platform closure');
  near(model.root.userData.blocks.leftLever.quaternion.angleTo(
    sourceLeftLever,
  ), 0, 0, 'rendered lever closure');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
