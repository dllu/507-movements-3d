import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
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

function vector3Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function worldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
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

test('movement 352 is one redirected single-rope Chinese windlass', () => {
  const movement = catalog.movements[351];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    contacts,
    degreesOfFreedom,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 352);
  assert.equal(movement.number, '352');
  assert.equal(movement.title,
    'Another arrangement of the Chinese windlass illustrated by 129 of this table');
  assert.equal(movement.category, 'Ropes, belts & pulleys');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'redirected-single-rope-Chinese-differential-windlass');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one-continuous-rope/);
  assert.match(mechanism, /larger-and-unwinds-from-the-smaller/);
  assert.match(mechanism, /left-fixed-redirect/);
  assert.match(mechanism, /one-small-moving-load-sheave/);
  assert.match(mechanism, /exact-three-dimensional-tangencies/);
  assert.equal(degreesOfFreedom.mechanism, 1);
  assert.match(degreesOfFreedom.input, /common horizontal windlass shaft/);
  assert.match(degreesOfFreedom.output, /single rope bight/);
  assert.match(transmission.constantLengthConstraint,
    /one nominal rope length/);
  assert.match(transmission.movingPulleySpin,
    /R_large \+ R_small/);

  assert.equal(blocks.frame.parent, model.root);
  assert.equal(blocks.windlass.parent, model.root);
  assert.equal(blocks.windlassRotor.parent, blocks.windlass);
  assert.equal(blocks.largeBarrel.parent, blocks.windlassRotor);
  assert.equal(blocks.smallBarrel.parent, blocks.windlassRotor);
  assert.equal(blocks.inputShaft.parent, blocks.windlassRotor);
  assert.equal(blocks.barrelFlanges.length, 4);
  blocks.barrelFlanges.forEach((flange) => {
    assert.equal(flange.parent, blocks.windlassRotor);
  });
  assert.equal(blocks.leftGuide.pulley.parent, model.root);
  assert.equal(blocks.rightGuide.pulley.parent, model.root);
  assert.equal(blocks.leftGuide.axle.parent, model.root);
  assert.equal(blocks.rightGuide.axle.parent, model.root);
  assert.equal(blocks.movingBlock.parent, model.root);
  assert.equal(blocks.movingPulley.parent, blocks.movingBlock);
  assert.equal(blocks.movingAxle.parent, blocks.movingBlock);
  assert.equal(blocks.hook.parent, blocks.movingBlock);
  assert.equal(blocks.load.parent, blocks.movingBlock);
  assert.equal(blocks.rope.parent, model.root);
  assert.equal(blocks.ropeMesh.parent, blocks.rope);
  assert.equal(blocks.rope.userData.ropeCount, 1);
  assert.equal(blocks.rope.userData.physicalCable, true);
  assert.equal(blocks.ropeMarkers.length, 11);
  blocks.ropeMarkers.forEach((marker) => {
    assert.equal(marker.parent, blocks.rope);
  });

  assert.equal(contacts.ropeLength.count, 1);
  assert.match(contacts.ropeLength.type, /one-inextensible-continuous-rope/);
  assert.equal(contacts.leftFixedGuideRope.pulley,
    blocks.leftGuide.pulley);
  assert.equal(contacts.rightFixedGuideRope.pulley,
    blocks.rightGuide.pulley);
  assert.equal(contacts.movingPulleyRope.pulley, blocks.movingPulley);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'one-continuous-rope-large-barrel-left-guide-moving-bight-right-guide-small-barrel').length, 1);
  assert.equal(roles.filter((role) =>
    /fixed-rope-redirect-sheave$/.test(role)).length, 2);
  assert.equal(roles.filter((role) => role ===
    'small-moving-sheave-on-single-rope-bight').length, 1);
  assert.equal(roles.filter((role) => role ===
    'white-Lagrangian-marker-on-single-rope').length, 11);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)),
    false);
  disposeModel(model.root);
});

test('movement 352 preserves the engraving and movement 129 relationship honestly', () => {
  const model = createMovementModel(catalog.movements[351]);
  const { geometry, sourceAnimation, sourceReference } =
    model.root.userData;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_352.html');
  assert.equal(sourceAnimation.presentationTiming.durationSeconds, 8.4);
  assert.equal(sourceAnimation.presentationTiming.reversibleSineDrive,
    true);
  assert.equal(sourceAnimation.presentationTiming.sourcePrescribed, false);
  assert.equal(sourceAnimation.referenceMovement129.sourceUrl,
    'https://507movements.com/mm_129.html');
  assert.match(sourceAnimation.referenceMovement129.law,
    /half the difference/);
  assert.match(sourceAnimation.referenceScope, /two upper redirect sheaves/);
  assert.match(sourceAnimation.referenceScope, /one continuous rope/);

  near(geometry.largeBarrelPitchRadius, 32 * 0.014, 0,
    'engraving-scaled large barrel');
  near(geometry.smallBarrelPitchRadius, 22 * 0.014, 0,
    'engraving-scaled small barrel');
  near(geometry.fixedGuidePitchRadius, 16 * 0.014, 0,
    'engraving-scaled fixed redirects');
  near(geometry.movingPulleyPitchRadius, 9 * 0.014, 0,
    'engraving-scaled moving sheave');
  near(geometry.barrelRadiusDifference,
    geometry.largeBarrelPitchRadius
      - geometry.smallBarrelPitchRadius,
    0, 'barrel-radius difference');
  near(geometry.barrelRadiusSum,
    geometry.largeBarrelPitchRadius
      + geometry.smallBarrelPitchRadius,
    0, 'barrel-radius sum');
  near(
    model.root.userData.transmission
      .referenceParallelLegTravelPerRevolutionValue,
    Math.PI * geometry.barrelRadiusDifference,
    0,
    'movement 129 parallel-leg travel law',
  );
  near(geometry.pulleyAxis.length(), 1, 3e-16,
    'shared sheave axis is normalized');
  near(geometry.planeHorizontal.length(), 1, 2e-16,
    'free-rope plane horizontal is normalized');
  near(geometry.pulleyAxis.dot(geometry.planeHorizontal), 0, 6e-17,
    'pulley axis normal to rope plane');
  near(geometry.pulleyAxis.dot(new THREE.Vector3(0, 1, 0)), 0, 0,
    'pulley axis horizontal');
  assert.ok(Math.abs(geometry.pulleyAxis.z) < 1,
    'opposite barrel contacts make this a genuinely tilted 3D reeving');

  const plate = sourceReference.brownPlate352;
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.deepEqual(plate.rasterShaftCenter,
    new THREE.Vector2(287, 410));
  assert.deepEqual(plate.rasterLeftGuideCenter,
    new THREE.Vector2(225, 162));
  assert.deepEqual(plate.rasterRightGuideCenter,
    new THREE.Vector2(341, 160));
  assert.deepEqual(plate.rasterMovingPulleyCenter,
    new THREE.Vector2(288, 187));
  assert.match(plate.inferredTopology,
    /one rope connects unequal coaxial lower barrels/);
  disposeModel(model.root);
});

test('movement 352 keeps one exact rope length across its entire shaft range', () => {
  const model = createMovementModel(catalog.movements[351]);
  const {
    geometry,
    movingYAtShaftAngle,
    ropeGeometryAtShaftAngle,
  } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const shaftAngle = THREE.MathUtils.lerp(
      -geometry.shaftAngleAmplitude,
      geometry.shaftAngleAmplitude,
      sample / 8192,
    );
    const solved = movingYAtShaftAngle(shaftAngle);
    const rope = ropeGeometryAtShaftAngle(shaftAngle);
    near(solved.metrics.freeLength, solved.targetFreeLength, 6e-15,
      `implicit free-length solution ${sample}`);
    near(rope.largeWoundLength,
      geometry.baseLargeWoundLength
        + geometry.largeBarrelPitchRadius * shaftAngle,
      0, `large wound length ${sample}`);
    near(rope.smallWoundLength,
      geometry.baseSmallWoundLength
        - geometry.smallBarrelPitchRadius * shaftAngle,
      0, `small wound length ${sample}`);
    near(rope.largeWoundLength + rope.metrics.freeLength
      + rope.smallWoundLength,
    geometry.nominalRopeLength, 2e-14,
    `one total rope length ${sample}`);
    near(rope.curve.getLength(), geometry.nominalRopeLength, 2e-14,
      `rendered material-coordinate length ${sample}`);
    near(rope.segmentLengths.reduce((sum, value) => sum + value, 0),
      geometry.nominalRopeLength, 2e-14,
    `nine segment lengths sum ${sample}`);
    assert.equal(rope.curves.length, 9);
    assert.equal(rope.transitionDistances.length, 8);
    rope.transitionContinuity.forEach((transition, index) => {
      near(transition.pointError, 0, 5e-16,
        `rope transition point ${sample},${index}`);
      near(transition.tangentDot, 1, 6e-16,
        `rope transition tangent ${sample},${index}`);
    });
  }
  disposeModel(model.root);
});

test('movement 352 solves every fixed and moving sheave tangency in one tilted plane', () => {
  const model = createMovementModel(catalog.movements[351]);
  const { geometry, ropeGeometryAtShaftAngle } = model.root.userData;

  for (let sample = 0; sample <= 1024; sample += 1) {
    const shaftAngle = THREE.MathUtils.lerp(
      -geometry.shaftAngleAmplitude,
      geometry.shaftAngleAmplitude,
      sample / 1024,
    );
    const rope = ropeGeometryAtShaftAngle(shaftAngle);
    const leftFixedRadius = rope.leftFixedInnerContact.clone()
      .sub(geometry.leftFixedCenter);
    const rightFixedRadius = rope.rightFixedInnerContact.clone()
      .sub(geometry.rightFixedCenter);
    const leftMovingRadius = rope.leftMovingContact.clone()
      .sub(rope.movingCenter);
    const rightMovingRadius = rope.rightMovingContact.clone()
      .sub(rope.movingCenter);
    const leftLeg = rope.leftMovingContact.clone()
      .sub(rope.leftFixedInnerContact).normalize();
    const rightLeg = rope.rightFixedInnerContact.clone()
      .sub(rope.rightMovingContact).normalize();
    near(leftFixedRadius.length(), geometry.fixedGuidePitchRadius,
      4e-16, `left fixed radius ${sample}`);
    near(rightFixedRadius.length(), geometry.fixedGuidePitchRadius,
      4e-16, `right fixed radius ${sample}`);
    near(leftMovingRadius.length(), geometry.movingPulleyPitchRadius,
      3e-16, `left moving radius ${sample}`);
    near(rightMovingRadius.length(), geometry.movingPulleyPitchRadius,
      3e-16, `right moving radius ${sample}`);
    near(leftFixedRadius.dot(leftLeg), 0, 5e-16,
      `left fixed tangent ${sample}`);
    near(leftMovingRadius.dot(leftLeg), 0, 3e-16,
      `left moving tangent ${sample}`);
    near(rightFixedRadius.dot(rightLeg), 0, 5e-16,
      `right fixed tangent ${sample}`);
    near(rightMovingRadius.dot(rightLeg), 0, 3e-16,
      `right moving tangent ${sample}`);
    for (const [name, point] of [
      ['left outer', geometry.leftOuterContact],
      ['left fixed inner', rope.leftFixedInnerContact],
      ['left moving', rope.leftMovingContact],
      ['moving center', rope.movingCenter],
      ['right moving', rope.rightMovingContact],
      ['right fixed inner', rope.rightFixedInnerContact],
      ['right outer', geometry.rightOuterContact],
    ]) {
      near(point.clone().sub(geometry.exitMidpoint)
        .dot(geometry.pulleyAxis), 0, 3e-16,
      `${name} in common rope plane ${sample}`);
    }
  }
  disposeModel(model.root);
});

test('movement 352 gives all three sheaves their exact no-slip spin rates', () => {
  const model = createMovementModel(catalog.movements[351]);
  const { geometry, stateAtShaftKinematics } = model.root.userData;
  const errorKeys = [
    'largeDrumNoSlipError',
    'smallDrumNoSlipError',
    'leftFixedOuterNoSlipError',
    'leftFixedInnerNoSlipError',
    'leftMovingNoSlipError',
    'rightMovingNoSlipError',
    'rightFixedInnerNoSlipError',
    'rightFixedOuterNoSlipError',
  ];

  for (let sample = 0; sample <= 4096; sample += 1) {
    const u = sample / 4096;
    const shaftAngle = THREE.MathUtils.lerp(
      -geometry.shaftAngleAmplitude,
      geometry.shaftAngleAmplitude,
      u,
    );
    const shaftAngularVelocity = 1.7 * Math.cos(9 * u)
      + 0.23;
    const shaftAngularAcceleration = -0.83 * Math.sin(7 * u);
    const state = stateAtShaftKinematics({
      shaftAngle,
      shaftAngularAcceleration,
      shaftAngularVelocity,
    });
    near(state.leftGuideAngularVelocity,
      geometry.largeBarrelPitchRadius * shaftAngularVelocity
        / geometry.fixedGuidePitchRadius,
      4e-16, `left guide speed ratio ${sample}`);
    near(state.rightGuideAngularVelocity,
      geometry.smallBarrelPitchRadius * shaftAngularVelocity
        / geometry.fixedGuidePitchRadius,
      4e-16, `right guide speed ratio ${sample}`);
    near(state.movingPulleyAngularVelocity,
      -geometry.barrelRadiusSum * shaftAngularVelocity
        / (2 * geometry.movingPulleyPitchRadius),
      9e-16, `moving sheave speed ratio ${sample}`);
    near(state.leftGuideAcceleration,
      geometry.largeBarrelPitchRadius * shaftAngularAcceleration
        / geometry.fixedGuidePitchRadius,
      4e-16, `left guide acceleration ratio ${sample}`);
    near(state.rightGuideAcceleration,
      geometry.smallBarrelPitchRadius * shaftAngularAcceleration
        / geometry.fixedGuidePitchRadius,
      4e-16, `right guide acceleration ratio ${sample}`);
    near(state.movingPulleyAngularAcceleration,
      -geometry.barrelRadiusSum * shaftAngularAcceleration
        / (2 * geometry.movingPulleyPitchRadius),
      9e-16, `moving sheave acceleration ratio ${sample}`);
    near(state.ropeLengthRateError, 0, 2e-16,
      `rope length-rate closure ${sample}`);
    errorKeys.forEach((key) => {
      near(state[key].length(), 0, 9e-16,
        `${key} ${sample}`);
    });
    if (shaftAngularVelocity > 0) {
      assert.ok(state.leftGuideAngularVelocity > 0);
      assert.ok(state.rightGuideAngularVelocity > 0);
      assert.ok(state.movingPulleyAngularVelocity < 0);
      assert.ok(state.largeWoundLength
        > geometry.baseLargeWoundLength
          - geometry.largeBarrelPitchRadius
            * geometry.shaftAngleAmplitude - 1e-15);
    }
  }
  disposeModel(model.root);
});

test('movement 352 output law and smooth reversals match finite differences', () => {
  const model = createMovementModel(catalog.movements[351]);
  const {
    canonicalStates,
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const velocityStep = 2e-5;
  const accelerationStep = 2e-4;

  for (const time of [0.11, 0.63, 1.22, 1.77, 2.31, 3.04,
    3.69, 4.33, 5.05, 5.71, 6.46, 7.12, 7.83]) {
    const state = stateAtTime(time);
    const beforeV = stateAtTime(time - velocityStep);
    const afterV = stateAtTime(time + velocityStep);
    near(state.movingPulleyVelocityY,
      (afterV.movingPulleyCenter.y - beforeV.movingPulleyCenter.y)
        / (2 * velocityStep),
      5e-9, `analytic load velocity ${time}`);
    near(state.shaftAngularVelocity,
      (afterV.shaftAngle - beforeV.shaftAngle)
        / (2 * velocityStep),
      2e-9, `analytic shaft velocity ${time}`);
    const beforeA = stateAtTime(time - accelerationStep);
    const afterA = stateAtTime(time + accelerationStep);
    near(state.movingPulleyAccelerationY,
      (afterA.movingPulleyVelocityY
        - beforeA.movingPulleyVelocityY)
        / (2 * accelerationStep),
      4e-8, `analytic load acceleration ${time}`);
    near(state.shaftAngularAcceleration,
      (afterA.shaftAngularVelocity - beforeA.shaftAngularVelocity)
        / (2 * accelerationStep),
      3e-8, `analytic shaft acceleration ${time}`);
  }

  near(canonicalStates.raisedReversal.shaftAngle,
    geometry.shaftAngleAmplitude, 0, 'raised shaft reversal');
  near(canonicalStates.loweredReversal.shaftAngle,
    -geometry.shaftAngleAmplitude, 0, 'lowered shaft reversal');
  near(canonicalStates.raisedReversal.shaftAngularVelocity,
    0, 2e-16, 'raised reversal speed');
  near(canonicalStates.loweredReversal.shaftAngularVelocity,
    0, 4e-16, 'lowered reversal speed');
  assert.ok(canonicalStates.raisedReversal.movingPulleyCenter.y
    > canonicalStates.sourcePoseRising.movingPulleyCenter.y);
  assert.ok(canonicalStates.sourcePoseRising.movingPulleyCenter.y
    > canonicalStates.loweredReversal.movingPulleyCenter.y);
  assert.notEqual(
    canonicalStates.raisedReversal.tangentMetrics
      .travelPerShaftRadian,
    canonicalStates.loweredReversal.tangentMetrics
      .travelPerShaftRadian,
    'the shallow redirected legs make vertical travel genuinely nonlinear',
  );
  assert.deepEqual(canonicalTimes, {
    sourcePoseRising: 0,
    raisedReversal: 2.1,
    sourcePoseDescending: 4.2,
    loweredReversal: 6.300000000000001,
    cycleClosure: 8.4,
  });
  disposeModel(model.root);
});

test('movement 352 renderer and material markers follow the exact rope state', () => {
  const model = createMovementModel(catalog.movements[351]);
  const { blocks, contacts, geometry } = model.root.userData;

  for (const time of [0, 0.37, 1.05, 1.72, 2.1, 2.66,
    3.44, 4.2, 4.91, 5.73, 6.3, 6.94, 7.65, 8.4]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    near(blocks.windlassRotor.rotation.x, state.shaftAngle, 0,
      `rendered common shaft angle ${time}`);
    near(blocks.leftGuide.pulley.userData.rotor.rotation.z,
      state.leftGuideAngle, 0, `left guide angle ${time}`);
    near(blocks.rightGuide.pulley.userData.rotor.rotation.z,
      state.rightGuideAngle, 0, `right guide angle ${time}`);
    near(blocks.movingPulley.userData.rotor.rotation.z,
      state.movingPulleyAngle, 0, `moving sheave angle ${time}`);
    vector3Near(blocks.movingBlock.position,
      state.movingPulleyCenter, 0, `moving block center ${time}`);
    near(blocks.rope.userData.length, geometry.nominalRopeLength,
      9e-15, `rendered rope length ${time}`);
    blocks.ropeMarkers.forEach((marker, index) => {
      vector3Near(marker.position,
        state.ropeCurve.getPointAtDistance(
          geometry.markerMaterialDistances[index],
        ), 0, `material marker ${index} ${time}`);
    });
    const expectedContacts = [
      geometry.largeRopeExit,
      geometry.leftOuterContact,
      state.leftFixedInnerContact,
      state.leftMovingContact,
      state.rightMovingContact,
      state.rightFixedInnerContact,
      geometry.rightOuterContact,
      geometry.smallRopeExit,
    ];
    blocks.contactMarkers.forEach((marker, index) => {
      vector3Near(worldPosition(marker), expectedContacts[index], 0,
        `visible contact marker ${index} ${time}`);
    });
    near(contacts.ropeLength.error, state.ropeLengthError, 0,
      `reported rope-length error ${time}`);
    near(contacts.ropeLength.rateError, state.ropeLengthRateError, 0,
      `reported rope-rate error ${time}`);
    vector3Near(contacts.movingPulleyRope.leftContactPoint,
      state.leftMovingContact, 0, `reported left moving contact ${time}`);
    vector3Near(contacts.movingPulleyRope.rightContactPoint,
      state.rightMovingContact, 0, `reported right moving contact ${time}`);
    near(contacts.movingPulleyRope.leftNoSlipError.length(),
      0, 9e-16, `reported left no slip ${time}`);
    near(contacts.movingPulleyRope.rightNoSlipError.length(),
      0, 9e-16, `reported right no slip ${time}`);
  }
  disposeModel(model.root);
});

test('movement 352 closes smoothly and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[351]);
  const { geometry, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const finish = stateAtTime(geometry.cyclePeriod);
  near(finish.drivePhase, start.drivePhase, 0, 'drive-phase closure');
  near(finish.shaftAngle, start.shaftAngle, 0, 'shaft-angle closure');
  near(finish.shaftAngularVelocity, start.shaftAngularVelocity, 0,
    'shaft-rate closure');
  near(finish.shaftAngularAcceleration,
    start.shaftAngularAcceleration, 0,
    'shaft-acceleration closure');
  vector3Near(finish.movingPulleyCenter,
    start.movingPulleyCenter, 0, 'moving-block closure');
  near(finish.movingPulleyVelocityY, start.movingPulleyVelocityY, 0,
    'moving-block speed closure');
  near(finish.movingPulleyAccelerationY,
    start.movingPulleyAccelerationY, 0,
    'moving-block acceleration closure');
  near(finish.leftGuideAngle, start.leftGuideAngle, 0,
    'left guide angle closure');
  near(finish.rightGuideAngle, start.rightGuideAngle, 0,
    'right guide angle closure');
  near(finish.movingPulleyAngle, start.movingPulleyAngle, 0,
    'moving sheave angle closure');
  near(finish.ropeLengthError, start.ropeLengthError, 0,
    'rope-length closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model507.root);
});
