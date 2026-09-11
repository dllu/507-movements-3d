import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const FULL_TURN = Math.PI * 2;

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
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

test('movement 310 is one three-legged wheel with three shared lifting pins and two independent gravity arms', () => {
  const movement = catalog.movements[309];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    presentation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 310);
  assert.equal(movement.number, '310');
  assert.equal(movement.title, 'Three-legged gravity escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'denison-single-three-legged-three-pin-two-arm-gravity-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /single three-legged gravity escapement/);
  assert.match(mechanism, /one wheel carries three long locking legs/);
  assert.match(mechanism, /shared set of three central lifting pins/);
  assert.match(mechanism, /stop D or E/);
  assert.match(mechanism, /120-degree counterclockwise step/);
  assert.match(presentation, /left B\/D arm behind/);
  assert.match(presentation, /right A\/E arm in front/);
  assert.equal(transmission.lockingWheels, 1);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.flyRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.leftGravityArm.group.parent, model.root);
  assert.equal(blocks.rightGravityArm.group.parent, model.root);
  assert.notEqual(blocks.leftGravityArm.group,
    blocks.rightGravityArm.group);
  assert.ok(blocks.leftGravityArm.group.position.z < 0);
  assert.ok(blocks.rightGravityArm.group.position.z > 0);
  assert.equal(blocks.lockingLegMeshes.length, 3);
  assert.equal(blocks.lockingLegTipMeshes.length, 3);
  assert.equal(blocks.liftingPinMeshes.length, 3);
  assert.equal(blocks.flyVanes.length, 2);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    /^locking-leg-\d-of-3$/.test(role)).length, 3);
  assert.equal(roles.filter((role) =>
    /^shared-central-lifting-pin-\d-of-3$/.test(role)).length, 3);
  assert.equal(roles.filter((role) =>
    /independent-weighted-gravity-arm$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /inner-lifting-face-[AB]$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /outer-locking-stop-[DE]-face$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /one-wheel-three-leg-locking-rotor/.test(role)).length, 1);
  assert.equal(roles.some((role) =>
    /second-locking-wheel|double-three-legged|generic|procedural/.test(role)),
  false);
  disposeModel(model.root);
});

test('movement 310 records Brown’s measured plate and the historical single-wheel operating evidence', () => {
  const movement = catalog.movements[309];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate310;
  const report = sourceReference.contemporaryDenisonReport;
  const awci = sourceReference.awciOperatingReference;
  const benson = sourceReference.bensonFrontElevation;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.match(sourceAnimation.referenceScope, /one three-legged wheel/);
  assert.match(sourceAnimation.referenceScope, /three long locking teeth/);
  assert.match(sourceAnimation.referenceScope, /120-degree release/);
  assert.match(sourceAnimation.referenceScope, /halves it to 60 degrees/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_310.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 263);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterWheelCenter,
    new THREE.Vector2(133, 301));
  assert.deepEqual(plate.rasterLeftPalletArbor,
    new THREE.Vector2(112, 65));
  assert.deepEqual(plate.rasterRightPalletArbor,
    new THREE.Vector2(142, 65));
  assert.deepEqual(plate.rasterPendulumSuspension,
    new THREE.Vector2(133, 32));
  assert.deepEqual(plate.rasterLeftLiftFaceB,
    new THREE.Vector2(99, 286));
  assert.deepEqual(plate.rasterRightLiftFaceA,
    new THREE.Vector2(154, 319));
  assert.deepEqual(plate.rasterLeftStopD,
    new THREE.Vector2(50, 321));
  assert.deepEqual(plate.rasterRightStopE,
    new THREE.Vector2(215, 302));
  assert.deepEqual(plate.rasterLeftBeatPin,
    new THREE.Vector2(109, 479));
  assert.deepEqual(plate.rasterRightBeatPin,
    new THREE.Vector2(164, 470));
  assert.deepEqual(plate.rasterLiftingPins, [
    new THREE.Vector2(122, 294),
    new THREE.Vector2(134, 285),
    new THREE.Vector2(144, 298),
  ]);
  assert.match(plate.inferredTopology, /one three-legged locking wheel/);
  assert.match(plate.inferredTopology, /one shared set of three/);
  assert.match(plate.singleWheelEvidence,
    /Brown 311 explicitly introduces two locking wheels/);
  assert.match(plate.symmetryReconstruction, /averaged/);

  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 0, 'mapped wheel center');
  vectorNear(sourcePointToModel(plate.rasterLeftPalletArbor),
    geometry.mappedLeftPalletArbor, 0, 'mapped left arbor');
  vectorNear(sourcePointToModel(plate.rasterRightPalletArbor),
    geometry.mappedRightPalletArbor, 0, 'mapped right arbor');
  vectorNear(sourcePointToModel(plate.rasterLeftStopD),
    geometry.mappedLeftStopD, 0, 'mapped D');
  vectorNear(sourcePointToModel(plate.rasterRightStopE),
    geometry.mappedRightStopE, 0, 'mapped E');
  near(geometry.palletPivotX,
    (Math.abs(geometry.mappedLeftPalletArbor.x)
      + Math.abs(geometry.mappedRightPalletArbor.x)) / 2,
  0, 'paired arbor offsets are averaged');
  near(geometry.beatPinWorldX,
    (Math.abs(geometry.mappedLeftBeatPin.x)
      + Math.abs(geometry.mappedRightBeatPin.x)) / 2,
  0, 'paired lower beat-pin offsets are averaged');
  near(geometry.lockingLegRadius,
    geometry.meanSourceLockingRadius * geometry.sourceScale,
  1e-15, 'outer radius uses the measured D/E mean');

  assert.equal(report.meetingDate, '1853-02-07');
  assert.equal(report.publicationYear, 1853);
  assert.match(report.operatingEvidence, /three pins near its center/);
  assert.match(report.operatingEvidence, /three long teeth/);
  assert.match(report.operatingEvidence, /fan-fly/);
  assert.equal(awci.publicationYear, 1979);
  assert.match(awci.operatingEvidence, /central pin raises the opposite/);
  assert.match(awci.operatingEvidence, /single design turns 120 degrees/);
  assert.match(awci.operatingEvidence, /second three-legged member.*60 degrees/);
  assert.match(awci.operatingEvidence, /fly limits/);
  assert.equal(benson.page, 151);
  assert.equal(benson.publicationYear, 1875);
  assert.match(benson.operatingEvidence, /three central lifting pins/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 310 advances the one three-leg wheel counterclockwise by exactly 120 degrees per vibration', () => {
  const model = createMovementModel(catalog.movements[309]);
  const {
    geometry,
    lockingLegTipAt,
    stateAtTime,
    transmission,
  } = model.root.userData;

  near(geometry.lockingLegPitch, FULL_TURN / 3, 1e-15,
    'three equally spaced locking legs');
  near(geometry.wheelAdvancePerBeat, FULL_TURN / 3, 1e-15,
    'one-hundred-twenty-degree beat step');
  near(geometry.wheelAdvancePerCycle, 2 * FULL_TURN / 3, 1e-15,
    'two beat steps per pendulum cycle');
  near(geometry.leftLockAngle - geometry.rightLockAngle,
    geometry.lockingLegPitch, 1e-15,
    'the two stop radii are one leg pitch apart');
  assert.equal(transmission.wheelAdvancePerBeatDegrees, 120);
  assert.equal(transmission.stepsPerPendulumCycle, 2);
  assert.equal(transmission.wheelCyclesPerRevolution, 1.5);
  assert.equal(transmission.mechanismClosurePendulumCycles, 3);
  assert.equal(transmission.wheelRevolutionsPerMechanismClosure, 2);
  assert.match(transmission.direction, /counterclockwise/);

  for (let cycle = -2; cycle <= 4; cycle += 1) {
    const start = stateAtTime(cycle * geometry.pendulumPeriod);
    const between = stateAtTime((cycle + 0.6)
      * geometry.pendulumPeriod);
    const end = stateAtTime((cycle + 1)
      * geometry.pendulumPeriod);
    near(between.wheelAngle - start.wheelAngle,
      geometry.wheelAdvancePerBeat, 1e-12,
      `first counterclockwise step in cycle ${cycle}`);
    near(end.wheelAngle - start.wheelAngle,
      geometry.wheelAdvancePerCycle, 1e-12,
      `two counterclockwise steps in cycle ${cycle}`);
    assert.equal(start.startingLeftLegIndex,
      positiveModulo(cycle, 3));
    assert.equal(start.rightLandingLegIndex,
      positiveModulo(cycle + 1, 3));
    assert.equal(start.landingLeftLegIndex,
      positiveModulo(cycle + 1, 3));
    vectorNear(lockingLegTipAt(
      start.wheelAngle,
      start.startingLeftLegIndex,
    ), start.activeLockPoint, 2e-14,
    `left locking leg at cycle ${cycle}`);
  }
  const start = stateAtTime(0);
  const oneWheelTurn = stateAtTime(1.5 * geometry.pendulumPeriod);
  near(oneWheelTurn.wheelAngle - start.wheelAngle,
    FULL_TURN, 1e-12,
    'three vibrations advance the one wheel through one revolution');
  const closure = stateAtTime(3 * geometry.pendulumPeriod);
  near(closure.wheelAngle - start.wheelAngle,
    2 * FULL_TURN, 1e-12,
    'three pendulum cycles close pendulum and wheel after two turns');
  disposeModel(model.root);
});

test('movement 310 alternates its two lower beat pins continuously and lifts only the outgoing arm to unlock', () => {
  const model = createMovementModel(catalog.movements[309]);
  const {
    geometry,
    stateAtCyclePhase,
    timeline,
  } = model.root.userData;

  for (let index = 0; index <= 240; index += 1) {
    const phase = index / 240;
    const state = stateAtCyclePhase(phase);
    assert.ok(['left', 'right'].includes(state.beatContactSide));
    assert.ok(state.beatContactError < 5e-13,
      `exact beat-pin contact at phase ${phase}`);
  }
  assert.equal(stateAtCyclePhase(
    geometry.leftPickupPhase - 1e-6,
  ).beatContactSide, 'right');
  assert.equal(stateAtCyclePhase(
    geometry.leftPickupPhase + 1e-6,
  ).beatContactSide, 'left');
  assert.equal(stateAtCyclePhase(
    geometry.rightPickupPhase - 1e-6,
  ).beatContactSide, 'left');
  assert.equal(stateAtCyclePhase(
    geometry.rightPickupPhase + 1e-6,
  ).beatContactSide, 'right');

  const leftUnlock = stateAtCyclePhase(
    (geometry.leftPickupPhase + geometry.leftUnlockPhase) / 2,
  );
  assert.equal(leftUnlock.mode,
    'pendulum-lifts-left-arm-and-releases-stop-D');
  assert.equal(leftUnlock.pendulumRaisedPalletSide, 'left');
  assert.equal(leftUnlock.trainCoupledToPendulum, true);
  assert.ok(leftUnlock.leftPalletMagnitude > geometry.cockedMagnitude);
  near(leftUnlock.rightPalletMagnitude,
    geometry.fallenMagnitude, 0, 'right arm remains fallen');

  const rightUnlock = stateAtCyclePhase(
    (geometry.rightPickupPhase + geometry.rightUnlockPhase) / 2,
  );
  assert.equal(rightUnlock.mode,
    'pendulum-lifts-right-arm-and-releases-stop-E');
  assert.equal(rightUnlock.pendulumRaisedPalletSide, 'right');
  assert.equal(rightUnlock.trainCoupledToPendulum, true);
  assert.ok(rightUnlock.rightPalletMagnitude > geometry.cockedMagnitude);
  near(rightUnlock.leftPalletMagnitude,
    geometry.fallenMagnitude, 0, 'left arm remains fallen');
  assert.deepEqual(timeline.schedule, [
    'right-weighted-arm-falls-with-pendulum',
    'pendulum-lifts-left-arm-and-releases-stop-D',
    'wheel-turns-120-degrees-and-central-pin-cocks-right-A',
    'right-stop-E-locks-the-single-wheel',
    'left-weighted-arm-falls-with-pendulum',
    'pendulum-lifts-right-arm-and-releases-stop-E',
    'wheel-turns-120-degrees-and-central-pin-cocks-left-B',
    'left-stop-D-locks-the-single-wheel',
  ]);
  disposeModel(model.root);
});

test('movement 310 holds alternate outer leg tips at D and E without wheel recoil', () => {
  const model = createMovementModel(catalog.movements[309]);
  const {
    blocks,
    fixedLockPointForSide,
    geometry,
    stateAtCyclePhase,
    transmission,
  } = model.root.userData;
  const samples = [0.04, 0.20, 0.32, 0.48, 0.61, 0.82, 0.98];

  for (const phase of samples) {
    const state = stateAtCyclePhase(phase);
    assert.equal(state.wheelLocked, true,
      `single wheel locked at phase ${phase}`);
    assert.equal(state.wheelStepActive, false);
    near(state.wheelAngularSpeed, 0, 1e-9,
      `no recoil at phase ${phase}`);
    near(state.lockContactError, 0, 3e-14,
      `exact D/E contact at phase ${phase}`);
    const side = state.activeLockSide === 'right' ? 1 : -1;
    vectorNear(state.activeLockPoint,
      fixedLockPointForSide(side), 3e-14,
      `fixed outer stop station at phase ${phase}`);
    near(state.activeLockPoint.distanceTo(geometry.wheelCenter),
      geometry.lockingLegRadius, 2e-14,
      `outer locking radius at phase ${phase}`);
  }
  assert.equal(blocks.leftGravityArm.lockFacePoints.length, 21);
  assert.equal(blocks.rightGravityArm.lockFacePoints.length, 21);
  assert.equal(blocks.leftGravityArm.lockFace.parent,
    blocks.leftGravityArm.group);
  assert.equal(blocks.rightGravityArm.lockFace.parent,
    blocks.rightGravityArm.group);
  assert.match(transmission.locking, /stop D or E/);
  assert.match(transmission.locking, /no wheel recoil/);
  disposeModel(model.root);
});

test('movement 310 uses a near-center pin to cock only the opposite A or B arm along an exact generated face', () => {
  const model = createMovementModel(catalog.movements[309]);
  const {
    geometry,
    liftFaceLocalPointAt,
    liftingPinAt,
    palletWorldPoint,
    stateAtCyclePhase,
    transmission,
  } = model.root.userData;
  const steps = [
    {
      end: geometry.firstWheelStepEndPhase,
      side: 'right',
      sideSign: 1,
      start: geometry.leftUnlockPhase,
    },
    {
      end: geometry.secondWheelStepEndPhase,
      side: 'left',
      sideSign: -1,
      start: geometry.rightUnlockPhase,
    },
  ];

  assert.ok(geometry.liftingPinRadius < geometry.lockingLegRadius / 5);
  near(transmission.innerToOuterRadiusRatio,
    geometry.liftingPinRadius / geometry.lockingLegRadius,
  0, 'published lifting-to-locking radius ratio');
  for (const step of steps) {
    let previousMagnitude = geometry.fallenMagnitude;
    for (const fraction of [0, 0.2, 0.5, 0.8, 1]) {
      const phase = THREE.MathUtils.lerp(step.start, step.end, fraction);
      const state = stateAtCyclePhase(phase);
      const magnitude = step.side === 'right'
        ? state.rightPalletMagnitude
        : state.leftPalletMagnitude;
      assert.equal(state.wheelStepActive, true);
      assert.equal(state.activeLiftSide, step.side);
      assert.equal(state.trainRaisingPalletSide, step.side);
      assert.equal(state.trainCoupledToPendulum, false);
      assert.equal(state.wheelLocked, false);
      assert.ok(magnitude >= previousMagnitude - 1e-14);
      near(state.liftContactError, 0, 3e-14,
        `exact ${step.side} central-pin contact at ${fraction}`);
      vectorNear(state.activeLiftPoint,
        liftingPinAt(state.wheelAngle, state.activeLiftPinIndex),
        2e-14, `${step.side} active central pin at ${fraction}`);
      near(state.activeLiftPoint.distanceTo(geometry.wheelCenter),
        geometry.liftingPinRadius, 2e-14,
        `${step.side} contact remains on inner radius`);
      const localPoint = liftFaceLocalPointAt(
        step.sideSign,
        state.liftProgress,
      );
      vectorNear(palletWorldPoint(
        step.sideSign,
        localPoint,
        magnitude,
      ), state.activeLiftPoint, 3e-14,
      `${step.side} generated A/B face at ${fraction}`);
      previousMagnitude = magnitude;
    }
    const start = stateAtCyclePhase(step.start);
    const end = stateAtCyclePhase(step.end);
    const startMagnitude = step.side === 'right'
      ? start.rightPalletMagnitude
      : start.leftPalletMagnitude;
    const endMagnitude = step.side === 'right'
      ? end.rightPalletMagnitude
      : end.leftPalletMagnitude;
    near(startMagnitude, geometry.fallenMagnitude, 1e-15,
      `${step.side} arm starts fallen`);
    near(endMagnitude, geometry.cockedMagnitude, 1e-15,
      `${step.side} arm finishes cocked`);
    near(end.wheelAdvance - start.wheelAdvance,
      geometry.wheelAdvancePerBeat, 2e-15,
      `${step.side} pin lift consumes one 120-degree step`);
  }
  assert.match(transmission.lifting, /three shared axial pins/);
  assert.match(transmission.lifting, /opposite A or B arm/);
  disposeModel(model.root);
});

test('movement 310 gives equal isolated gravity impulses and its arbor fly follows the solved wheel rate', () => {
  const model = createMovementModel(catalog.movements[309]);
  const {
    effectiveCenterOfMassAt,
    geometry,
    gravityPotentialAt,
    stateAtCyclePhase,
    transmission,
  } = model.root.userData;
  const rightDrop = gravityPotentialAt(1, geometry.cockedMagnitude)
    - gravityPotentialAt(1, geometry.fallenMagnitude);
  const leftDrop = gravityPotentialAt(-1, geometry.cockedMagnitude)
    - gravityPotentialAt(-1, geometry.fallenMagnitude);

  near(rightDrop, geometry.netGravityPotentialDrop, 1e-14,
    'right fixed potential drop');
  near(leftDrop, rightDrop, 1e-14,
    'mirror gravity arms provide equal potential drops');
  assert.ok(rightDrop > 0);
  near(transmission.equalImpulseEnergyPerSide,
    rightDrop, 1e-14, 'published equal impulse energy');
  near(effectiveCenterOfMassAt(1, geometry.cockedMagnitude).y
    - effectiveCenterOfMassAt(1, geometry.fallenMagnitude).y,
  rightDrop / (geometry.weightedArmMass * geometry.standardGravity),
  1e-14, 'right arm centre of mass supplies the potential drop');

  const rightImpulse = stateAtCyclePhase(0.25);
  assert.equal(rightImpulse.effectiveGravityImpulseActive, true);
  assert.equal(rightImpulse.gravityDescentSide, 'right');
  assert.equal(rightImpulse.beatContactSide, 'right');
  assert.equal(rightImpulse.impulseDirection, 'leftward');
  assert.equal(rightImpulse.gravityImpulseIsolatedFromTrain, true);
  assert.equal(rightImpulse.trainCoupledToPendulum, false);
  assert.ok(rightImpulse.pendulumAngularSpeed < 0);
  const leftImpulse = stateAtCyclePhase(0.75);
  assert.equal(leftImpulse.effectiveGravityImpulseActive, true);
  assert.equal(leftImpulse.gravityDescentSide, 'left');
  assert.equal(leftImpulse.beatContactSide, 'left');
  assert.equal(leftImpulse.impulseDirection, 'rightward');
  assert.equal(leftImpulse.gravityImpulseIsolatedFromTrain, true);
  assert.equal(leftImpulse.trainCoupledToPendulum, false);
  assert.ok(leftImpulse.pendulumAngularSpeed > 0);
  near(rightImpulse.rightPalletMagnitude,
    leftImpulse.leftPalletMagnitude, 2e-15,
    'mirror impulse geometry at center');

  for (const phase of [0, 0.2, 0.38, 0.48, 0.7, 0.88, 0.98, 1]) {
    const state = stateAtCyclePhase(phase);
    near(state.flyAngle - state.wheelAngle,
      Math.PI / 6, 1e-14, `fixed fly phase at ${phase}`);
    near(state.flyAngularSpeed, state.wheelAngularSpeed,
      0, `fly shares wheel speed at ${phase}`);
  }
  assert.ok(stateAtCyclePhase(0.38).wheelAngularSpeed > 0);
  assert.ok(stateAtCyclePhase(0.88).wheelAngularSpeed > 0);
  near(stateAtCyclePhase(0.2).wheelAngularSpeed, 0, 1e-9,
    'fly and wheel stop at D');
  near(stateAtCyclePhase(0.7).wheelAngularSpeed, 0, 1e-9,
    'fly and wheel stop at E');
  assert.match(transmission.flyCoupling, /same normal-operation angle/);
  disposeModel(model.root);
});

test('movement 310 renderer follows the solved wheel, fly, arms, pendulum and live contacts before movement 339', () => {
  const movement = catalog.movements[309];
  const model = createMovementModel(movement);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const phases = [
    0,
    0.25,
    geometry.leftPickupPhase,
    geometry.leftUnlockPhase,
    (geometry.leftUnlockPhase + geometry.firstWheelStepEndPhase) / 2,
    geometry.firstWheelStepEndPhase,
    0.5,
    0.75,
    geometry.rightPickupPhase,
    geometry.rightUnlockPhase,
    (geometry.rightUnlockPhase + geometry.secondWheelStepEndPhase) / 2,
    geometry.secondWheelStepEndPhase,
    1,
  ];

  for (const phase of phases) {
    const time = phase * geometry.pendulumPeriod;
    model.update(time, 0.016);
    const state = stateAtTime(time);
    near(blocks.pendulumAssembly.rotation.z,
      state.pendulumAngle, 0, `pendulum angle at phase ${phase}`);
    near(blocks.wheelRotor.rotation.z,
      state.wheelAngle, 0, `single wheel angle at phase ${phase}`);
    near(blocks.flyRotor.rotation.z,
      state.flyAngle, 0, `fly angle at phase ${phase}`);
    near(blocks.leftGravityArm.group.rotation.z,
      state.leftPalletAngle, 0, `left arm at phase ${phase}`);
    near(blocks.rightGravityArm.group.rotation.z,
      state.rightPalletAngle, 0, `right arm at phase ${phase}`);
    assert.equal(blocks.wheelLiftMarker.visible,
      state.wheelStepActive);
    assert.equal(blocks.lockMarker.visible, state.wheelLocked);
    assert.equal(blocks.beatContactMarker.userData.contactSide,
      state.beatContactSide);
    assert.equal(blocks.wheelLiftMarker.userData.contactSide,
      state.activeLiftSide);
    assert.equal(blocks.lockMarker.userData.contactSide,
      state.activeLockSide);
    vectorNear(new THREE.Vector2(
      blocks.beatContactMarker.position.x,
      blocks.beatContactMarker.position.y,
    ), state.beatContactPoint, 1e-12,
    `beat contact marker at phase ${phase}`);
  }
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, geometry.pendulumPeriod);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  assertReadableTiming(model.root.userData.animationTiming);

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
