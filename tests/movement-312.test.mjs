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

test('movement 312 is Bloxam’s two-wheel, two-arm gravity escapement rather than a generic escapement', () => {
  const movement = catalog.movements[311];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    presentation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 312);
  assert.equal(movement.number, '312');
  assert.equal(movement.title, 'Bloxam’s gravity escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'bloxam-coaxial-nine-tooth-inner-lift-outer-lock-gravity-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one rigid arbor/);
  assert.match(mechanism, /larger nine-tooth escape wheel/);
  assert.match(mechanism, /smaller nine-tooth pallet wheel/);
  assert.match(mechanism, /acting faces trail by 10 degrees/);
  assert.match(mechanism, /outer detents stop the large wheel/);
  assert.match(mechanism, /fork pins E and F embrace/);
  assert.match(presentation, /no fly/);

  assert.equal(blocks.escapeWheelAssembly.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheelAssembly);
  assert.equal(blocks.outerEscapeWheel.parent, blocks.wheelRotor);
  assert.equal(blocks.palletWheel.parent, blocks.wheelRotor);
  assert.notEqual(blocks.outerEscapeWheel, blocks.palletWheel);
  assert.equal(blocks.leftGravityArm.group.parent, model.root);
  assert.equal(blocks.rightGravityArm.group.parent, model.root);
  assert.notEqual(blocks.leftGravityArm.group,
    blocks.rightGravityArm.group);
  assert.equal(blocks.outerTeeth.length, 9);
  assert.equal(blocks.outerSpokes.length, 9);
  assert.equal(blocks.outerActingFaces.length, 9);
  assert.equal(blocks.palletWheelTeeth.length, 9);
  assert.equal(transmission.wheelsFixedOnSameArbor, true);
  assert.equal(transmission.escapeAndPalletWheelAngularSpeedRatio, 1);
  assert.match(transmission.fly, /^none:/);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    /^outer-locking-tooth-\d-of-9$/.test(role)).length, 9);
  assert.equal(roles.filter((role) =>
    /^curved-pallet-wheel-tooth-\d-of-9$/.test(role)).length, 9);
  assert.equal(roles.filter((role) =>
    /independent-gravity-arm$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /adjustable-fork-pin-[EF]$/.test(role)).length, 2);
  assert.equal(roles.some((role) => /fly/i.test(role)), false);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 312 preserves Bloxam’s primary dimensions, slopes, timing angles, and Brown landmarks', () => {
  const movement = catalog.movements[311];
  const model = createMovementModel(movement);
  const {
    fixedLockPointForSide,
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const original = sourceReference.originalBloxamPaper;
  const plate = sourceReference.brownPlate312;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /no working canvas animation/);
  assert.match(sourceAnimation.referenceScope, /20-degree wheel steps/);
  assert.match(sourceAnimation.referenceScope, /10-degree inner-face lag/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_312.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(original.publicationYear, 1853);
  assert.equal(original.googleBooksVolumeId, '5PxDAQAAMAAJ');
  assert.deepEqual(original.pages, [143, 144, 145]);
  assert.equal(original.armAxisDistanceInches, 3);
  assert.equal(original.detentArmLengthInches, 2.82);
  assert.equal(original.escapeWheelDiameterInches, 2.05);
  assert.equal(original.palletWheelPrimitiveDiameterInches, 0.2);
  assert.equal(original.innerWheelTeeth, 9);
  assert.equal(original.nominalArmLiftArcMinutes, 40);
  assert.equal(original.pendulumPickupArcMinutes, 20);
  assert.equal(original.pendulumUnlockArcMinutes, 40);
  assert.equal(original.outerToothFaceSlopeDegrees, 2);
  assert.equal(original.detentFaceSlopeDegrees, 8);
  assert.equal(original.actingFacePhaseLagDegrees, 10);

  near(geometry.armAxisDistance, 6, 0,
    'three-inch axis spacing at two model units per inch');
  near(geometry.historicalEscapeWheelRadius, 2.05, 0,
    'published 2.05-inch diameter');
  near(geometry.palletWheelPrimitiveRadius, 0.2, 0,
    'published 0.2-inch primitive diameter');
  near(geometry.publishedDetentArmLength, 5.64, 0,
    'published 2.82-inch arm-to-detent distance');
  near(geometry.constructedDetentArmLength / geometry.modelUnitsPerInch,
    2.8190778623577253, 2e-15, 'exact tangent length');
  assert.ok(Math.abs(geometry.tangentLengthRoundingError)
    < 0.002 * geometry.modelUnitsPerInch);
  near(geometry.outerToothFaceSlope,
    THREE.MathUtils.degToRad(2), 0, 'two-degree tooth face');
  near(geometry.detentFaceSlope,
    THREE.MathUtils.degToRad(8), 0, 'eight-degree detent face');
  near(geometry.palletWheelFacePhaseOffset,
    -THREE.MathUtils.degToRad(10), 0,
    'small-wheel acting face is ten degrees behind');
  near(geometry.pickupAngle / THREE.MathUtils.degToRad(1 / 60),
    20, 2e-14, 'twenty-minute pickup');
  near(geometry.unlockAngle / THREE.MathUtils.degToRad(1 / 60),
    40, 2e-14, 'forty-minute unlock');
  near(geometry.pendulumAmplitude / THREE.MathUtils.degToRad(1 / 60),
    100, 2e-14, 'one-degree-forty-minute amplitude');
  assert.ok(geometry.unlockAngle
    <= geometry.maximumDocumentedUnlockAngle);

  for (const side of [-1, 1]) {
    const lock = fixedLockPointForSide(side);
    const wheelRadius = lock.clone().sub(geometry.wheelCenter);
    const detentArm = geometry.armPivot.clone().sub(lock);
    near(wheelRadius.dot(detentArm), 0, 4e-15,
      `${side < 0 ? 'A' : 'B'} tangent construction`);
    near(wheelRadius.length(), geometry.lockingRadius, 2e-15,
      `${side < 0 ? 'A' : 'B'} locking radius`);
    near(detentArm.length(), geometry.constructedDetentArmLength,
      2e-15, `${side < 0 ? 'A' : 'B'} detent-arm length`);
  }

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterWheelCenter, new THREE.Vector2(260, 378));
  assert.deepEqual(plate.rasterWheelBottom, new THREE.Vector2(260, 520));
  assert.deepEqual(plate.rasterArmPivotC, new THREE.Vector2(258, 23));
  assert.deepEqual(plate.rasterLeftStopA, new THREE.Vector2(132, 320));
  assert.deepEqual(plate.rasterRightStopB, new THREE.Vector2(399, 357));
  assert.deepEqual(plate.rasterLeftForkPinE, new THREE.Vector2(215, 428));
  assert.deepEqual(plate.rasterRightForkPinF, new THREE.Vector2(278, 352));
  vectorNear(sourcePointToModel(plate.rasterArmPivotC),
    geometry.mappedArmPivotC, 0, 'mapped C');
  vectorNear(sourcePointToModel(plate.rasterLeftStopA),
    geometry.mappedLeftStopA, 0, 'mapped A');
  vectorNear(sourcePointToModel(plate.rasterRightStopB),
    geometry.mappedRightStopB, 0, 'mapped B');
  assert.match(plate.schematicScaleNotice, /Bloxam’s full-size measurements/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  assert.match(sourceReference.grimthorpeReference.constructionEvidence,
    /nine teeth/);
  assert.match(sourceReference.britannicaReference.constructionEvidence,
    /small wheel near the arbor lifts/);
  disposeModel(model.root);
});

test('movement 312 fixes both nine-tooth wheels to one arbor and advances exactly 20 degrees per vibration', () => {
  const model = createMovementModel(catalog.movements[311]);
  const {
    blocks,
    geometry,
    stateAtTime,
    transmission,
    wheelAngleAtCycleStart,
  } = model.root.userData;

  near(geometry.toothPitch, FULL_TURN / 9, 0,
    'nine-tooth pitch');
  near(geometry.wheelAdvancePerBeat, FULL_TURN / 18, 0,
    'twenty-degree beat step');
  near(geometry.wheelAdvancePerCycle, FULL_TURN / 9, 0,
    'forty-degree pendulum-cycle step');
  near(blocks.outerEscapeWheel.rotation.z, 0, 0,
    'large wheel datum');
  near(blocks.palletWheel.rotation.z,
    geometry.palletWheelFacePhaseOffset, 0,
    'small wheel rigid ten-degree phase datum');
  assert.equal(blocks.outerEscapeWheel.parent, blocks.wheelRotor);
  assert.equal(blocks.palletWheel.parent, blocks.wheelRotor);
  assert.equal(transmission.wheelAdvancePerBeatDegrees, 20);
  assert.equal(transmission.wheelAdvancePerCycleDegrees, 40);
  assert.equal(transmission.stepsPerPendulumCycle, 2);
  assert.equal(transmission.mechanismClosurePendulumCycles, 9);
  assert.equal(transmission.escapeAndPalletWheelAngularSpeedRatio, 1);
  assert.match(transmission.direction, /counterclockwise/);

  for (let cycle = -3; cycle <= 10; cycle += 1) {
    const start = stateAtTime(cycle * geometry.pendulumPeriod);
    const afterOneBeat = stateAtTime(
      (cycle + 0.6) * geometry.pendulumPeriod,
    );
    const end = stateAtTime((cycle + 1) * geometry.pendulumPeriod);
    near(start.wheelAngle, wheelAngleAtCycleStart(cycle), 2e-15,
      `cycle ${cycle} datum`);
    near(afterOneBeat.wheelAngle - start.wheelAngle,
      geometry.wheelAdvancePerBeat, 2e-14,
      `cycle ${cycle} first vibration`);
    near(end.wheelAngle - start.wheelAngle,
      geometry.wheelAdvancePerCycle, 2e-14,
      `cycle ${cycle} two vibrations`);
    assert.equal(start.startingLeftOuterToothIndex,
      positiveModulo(4 - cycle, 9));
    assert.equal(start.rightLandingOuterToothIndex,
      positiveModulo(-cycle, 9));
    assert.equal(start.leftLandingOuterToothIndex,
      positiveModulo(3 - cycle, 9));
    assert.equal(start.rightLiftInnerToothIndex,
      positiveModulo(7 - cycle, 9));
    assert.equal(start.leftLiftInnerToothIndex,
      positiveModulo(2 - cycle, 9));
  }

  for (const phase of [0, 0.24, 0.37, 0.55, 0.75, 0.87, 0.98]) {
    const state = model.root.userData.stateAtCyclePhase(phase);
    near(state.outerWheelAngle, state.wheelAngle, 0,
      `outer angle at ${phase}`);
    near(state.palletWheelAngle - state.outerWheelAngle,
      geometry.palletWheelFacePhaseOffset, 4e-17,
      `fixed inner phase at ${phase}`);
    near(state.outerWheelAngularSpeed,
      state.palletWheelAngularSpeed, 0,
      `equal rigid wheel speed at ${phase}`);
    near(state.outerWheelAngularSpeed,
      state.wheelAngularSpeed, 0,
      `common rotor speed at ${phase}`);
  }
  const closure = stateAtTime(9 * geometry.pendulumPeriod);
  const start = stateAtTime(0);
  near(closure.wheelAngle - start.wheelAngle, FULL_TURN, 2e-15,
    'nine pendulum cycles close one wheel revolution');
  near(closure.pendulumAngle, start.pendulumAngle, 0,
    'pendulum closes with the wheels');
  disposeModel(model.root);
});

test('movement 312 alternates no-recoil A and B outer locks and keeps exactly one inner pallet supported', () => {
  const model = createMovementModel(catalog.movements[311]);
  const {
    fixedLockPointForSide,
    geometry,
    outerToothTipAt,
    stateAtCyclePhase,
  } = model.root.userData;

  for (const phase of [0.02, 0.22, 0.30, 0.48, 0.62, 0.74, 0.80, 0.97]) {
    const state = stateAtCyclePhase(phase);
    assert.equal(state.wheelLocked, true,
      `outer wheel locked at phase ${phase}`);
    assert.equal(state.wheelStepActive, false);
    near(state.wheelAngularSpeed, 0, 1e-9,
      `no recoil at phase ${phase}`);
    near(state.lockContactError, 0, 2e-15,
      `exact outer lock contact at phase ${phase}`);
    const side = state.activeLockSide === 'right' ? 1 : -1;
    vectorNear(state.activeLockPoint,
      fixedLockPointForSide(side), 2e-15,
      `fixed ${state.activeLockSide} lock station at ${phase}`);
    vectorNear(state.activeLockPoint,
      outerToothTipAt(state.wheelAngle, state.activeLockToothIndex),
      0, `indexed outer tooth at ${phase}`);
  }
  for (const phase of [0.04, 0.24, 0.30, 0.95, 0.99]) {
    assert.equal(stateAtCyclePhase(phase).activeLockSide, 'left');
  }
  for (const phase of [0.46, 0.60, 0.74, 0.80]) {
    assert.equal(stateAtCyclePhase(phase).activeLockSide, 'right');
  }
  for (const phase of [0.34, 0.37, 0.40, 0.84, 0.87, 0.90]) {
    const state = stateAtCyclePhase(phase);
    assert.equal(state.wheelLocked, false);
    assert.equal(state.wheelStepActive, true);
    assert.equal(state.activeLockSide, null);
    assert.equal(state.activeLockPoint, null);
  }

  const expectedInnerSequence = [
    [0.10, 'left', 'left-A-rests-on-pallet-wheel'],
    [0.30, 'right', 'right-B-deposited-on-lowest'],
    [0.37, 'right', 'small-wheel-curved-tooth-raises-right-B'],
    [0.60, 'right', 'right-B-rests-on-raised'],
    [0.80, 'left', 'left-A-deposited-on-upper'],
    [0.87, 'left', 'small-wheel-curved-tooth-raises-left-A'],
    [0.97, 'left', 'left-A-rests-on-raised'],
  ];
  for (const [phase, side, mode] of expectedInnerSequence) {
    const state = stateAtCyclePhase(phase);
    assert.equal(state.activeInnerContactSide, side);
    assert.match(state.innerContactMode, new RegExp(mode));
    assert.ok(Number.isInteger(state.activeInnerToothIndex));
    assert.ok(state.activeInnerToothIndex >= 0
      && state.activeInnerToothIndex < geometry.toothCount);
    near(state.innerContactError, 0, 2e-15,
      `one exact inner support at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 312 generates exact plane-pallet contacts on curved small-wheel teeth throughout both lifts', () => {
  const model = createMovementModel(catalog.movements[311]);
  const {
    geometry,
    palletContactAt,
    palletFaceLocalPointAt,
    palletWheelToothPointAt,
    stateAtCyclePhase,
  } = model.root.userData;

  near(geometry.nominalArmLift,
    THREE.MathUtils.degToRad(40 / 60), 0,
    'nominal forty-minute arm lift');
  near(geometry.primitiveRightLift / THREE.MathUtils.degToRad(1 / 60),
    38.00072508089486, 2e-12,
    'right primitive-circle lift is a little under forty minutes');
  near(geometry.primitiveLeftLift / THREE.MathUtils.degToRad(1 / 60),
    -40.45808408016355, 2e-12,
    'left primitive-circle lift is a little over forty minutes');
  near(geometry.palletWheelPrimitiveRadius
    / geometry.historicalEscapeWheelRadius,
  0.2 / 2.05, 2e-16, 'published inner-to-outer radius ratio');
  assert.ok(geometry.lockingRadius
    > geometry.palletWheelPrimitiveRadius * 10);

  const lifts = [
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
  for (const lift of lifts) {
    let previousAdvance = -Infinity;
    for (const fraction of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const phase = THREE.MathUtils.lerp(lift.start, lift.end, fraction);
      const state = stateAtCyclePhase(phase);
      const progress = state.innerContactProgress;
      const contact = palletContactAt(lift.sideSign, progress);
      const localPoint = palletFaceLocalPointAt(lift.sideSign, progress);
      const faceDirection = new THREE.Vector2(
        Math.cos(-Math.PI / 2 - (
          lift.sideSign > 0
            ? geometry.rightFallenAngle
            : geometry.leftFallenAngle
        )),
        Math.sin(-Math.PI / 2 - (
          lift.sideSign > 0
            ? geometry.rightFallenAngle
            : geometry.leftFallenAngle
        )),
      );
      assert.equal(state.wheelStepActive, true);
      assert.equal(state.activeInnerContactSide, lift.side);
      assert.equal(state.trainRaisingArmSide, lift.side);
      assert.equal(state.trainCoupledToPendulum, false);
      assert.ok(state.wheelAdvance >= previousAdvance - 2e-14);
      assert.ok(contact.contactRadius > 0.18
        && contact.contactRadius < 0.22);
      near(faceDirection.x * localPoint.y
        - faceDirection.y * localPoint.x,
      0, 3e-15, `${lift.side} pallet face stays radial at ${fraction}`);
      vectorNear(state.activeInnerPoint,
        palletWheelToothPointAt(
          state.wheelAngle,
          state.activeInnerToothIndex,
          contact.contactRadius,
        ),
        0, `${lift.side} indexed small tooth at ${fraction}`);
      near(state.innerContactError, 0, 2e-15,
        `${lift.side} exact curved-tooth contact at ${fraction}`);
      previousAdvance = state.wheelAdvance;
    }
    const start = stateAtCyclePhase(lift.start);
    const middle = stateAtCyclePhase((lift.start + lift.end) / 2);
    const end = stateAtCyclePhase(lift.end);
    near(start.wheelAngularSpeed, 0, 2e-7,
      `${lift.side} step starts without a velocity jump`);
    assert.ok(middle.wheelAngularSpeed > 0);
    near(end.wheelAngularSpeed, 0, 2e-7,
      `${lift.side} step lands without a velocity jump`);
    near(end.wheelAdvance - start.wheelAdvance,
      geometry.wheelAdvancePerBeat, 2e-15,
      `${lift.side} consumes one half-pitch`);
  }

  const rightStart = palletContactAt(1, 0);
  const rightEnd = palletContactAt(1, 1);
  const leftStart = palletContactAt(-1, 0);
  const leftEnd = palletContactAt(-1, 1);
  near(rightStart.toothAngle, -Math.PI / 2, 0,
    'B is deposited on the lowest tooth');
  near(rightEnd.toothAngle, -Math.PI / 2 + geometry.wheelAdvancePerBeat,
    0, 'lowest tooth lifts B through twenty wheel degrees');
  near(leftStart.toothAngle, Math.PI / 2, 0,
    'A is deposited on the opposed upper tooth');
  near(leftEnd.toothAngle, Math.PI / 2 + geometry.wheelAdvancePerBeat,
    0, 'upper tooth lifts A through twenty wheel degrees');
  disposeModel(model.root);
});

test('movement 312 follows the 20/40-arcminute pendulum handoff and supplies equal isolated gravity impulses', () => {
  const model = createMovementModel(catalog.movements[311]);
  const {
    geometry,
    gravityPotentialAt,
    stateAtCyclePhase,
    timeline,
    transmission,
  } = model.root.userData;

  for (let index = 0; index <= 360; index += 1) {
    const phase = index / 360;
    const state = stateAtCyclePhase(phase);
    assert.ok(['left', 'right'].includes(state.beatContactSide));
    near(state.beatContactError, 0, 2e-15,
      `exact E/F fork contact at phase ${phase}`);
  }
  assert.equal(stateAtCyclePhase(
    geometry.leftPickupPhase - 1e-7,
  ).beatContactSide, 'right');
  assert.equal(stateAtCyclePhase(
    geometry.leftPickupPhase + 1e-7,
  ).beatContactSide, 'left');
  assert.equal(stateAtCyclePhase(
    geometry.rightPickupPhase - 1e-7,
  ).beatContactSide, 'left');
  assert.equal(stateAtCyclePhase(
    geometry.rightPickupPhase + 1e-7,
  ).beatContactSide, 'right');

  const leftRelease = stateAtCyclePhase(
    (geometry.leftPickupPhase + geometry.leftUnlockPhase) / 2,
  );
  assert.equal(leftRelease.mode,
    'pendulum-lifts-left-A-from-20-to-40-arcminutes');
  assert.equal(leftRelease.pendulumRaisedArmSide, 'left');
  assert.equal(leftRelease.activeLockSide, 'left');
  assert.equal(leftRelease.trainCoupledToPendulum, true);
  near(leftRelease.rightArmAngle,
    geometry.rightFallenAngle, 0, 'B waits deposited');
  const rightRelease = stateAtCyclePhase(
    (geometry.rightPickupPhase + geometry.rightUnlockPhase) / 2,
  );
  assert.equal(rightRelease.mode,
    'pendulum-lifts-right-B-from-20-to-40-arcminutes');
  assert.equal(rightRelease.pendulumRaisedArmSide, 'right');
  assert.equal(rightRelease.activeLockSide, 'right');
  assert.equal(rightRelease.trainCoupledToPendulum, true);
  near(rightRelease.leftArmAngle,
    geometry.leftFallenAngle, 0, 'A waits deposited');

  const rightDrop = gravityPotentialAt(1, geometry.rightCockedAngle)
    - gravityPotentialAt(1, geometry.rightFallenAngle);
  const leftDrop = gravityPotentialAt(-1, geometry.leftCockedAngle)
    - gravityPotentialAt(-1, geometry.leftFallenAngle);
  assert.ok(rightDrop > 0);
  near(leftDrop, rightDrop, 2e-14,
    'mirror arms provide equal gravity energy');
  near(geometry.rightGravityPotentialDrop, rightDrop, 0,
    'right drop is published');
  near(geometry.leftGravityPotentialDrop, leftDrop, 0,
    'left drop is published');
  assert.match(transmission.gravityIsolation, /train raises the resting opposite arm/);

  const rightImpulse = stateAtCyclePhase(0.25);
  assert.equal(rightImpulse.effectiveGravityImpulseActive, true);
  assert.equal(rightImpulse.gravityDescentSide, 'right');
  assert.equal(rightImpulse.beatContactSide, 'right');
  assert.equal(rightImpulse.gravityImpulseIsolatedFromTrain, true);
  assert.equal(rightImpulse.trainCoupledToPendulum, false);
  assert.ok(rightImpulse.pendulumAngularSpeed < 0);
  const leftImpulse = stateAtCyclePhase(0.75);
  assert.equal(leftImpulse.effectiveGravityImpulseActive, true);
  assert.equal(leftImpulse.gravityDescentSide, 'left');
  assert.equal(leftImpulse.beatContactSide, 'left');
  assert.equal(leftImpulse.gravityImpulseIsolatedFromTrain, true);
  assert.equal(leftImpulse.trainCoupledToPendulum, false);
  assert.ok(leftImpulse.pendulumAngularSpeed > 0);

  assert.deepEqual(timeline.schedule, [
    'right-B-descends-with-pendulum-while-left-A-locks',
    'right-B-is-deposited-on-lowest-inner-wheel-tooth',
    'pendulum-lifts-left-A-from-20-to-40-arcminutes-and-unlocks',
    'both-rigid-wheels-advance-20-degrees-while-inner-wheel-cocks-right-B',
    'right-B-outer-stop-locks-the-larger-wheel',
    'left-A-descends-with-pendulum-and-is-deposited-on-upper-tooth',
    'pendulum-lifts-right-B-from-20-to-40-arcminutes-and-unlocks',
    'both-rigid-wheels-advance-20-degrees-while-inner-wheel-cocks-left-A',
    'left-A-outer-stop-locks-the-larger-wheel',
  ]);
  disposeModel(model.root);
});

test('movement 312 remains continuous and finite across every event and across its nine-cycle closure', () => {
  const model = createMovementModel(catalog.movements[311]);
  const { geometry, stateAtTime } = model.root.userData;
  const boundaries = [
    geometry.leftPickupPhase,
    geometry.leftUnlockPhase,
    geometry.firstWheelStepEndPhase,
    0.5,
    geometry.leftEffectiveImpulseStartPhase,
    geometry.rightPickupPhase,
    geometry.rightUnlockPhase,
    geometry.secondWheelStepEndPhase,
    1,
  ];
  const continuousKeys = [
    'wheelAngle',
    'leftArmAngle',
    'rightArmAngle',
    'pendulumAngle',
  ];
  for (const boundary of boundaries) {
    const before = stateAtTime((boundary - 1e-8) * geometry.pendulumPeriod);
    const after = stateAtTime((boundary + 1e-8) * geometry.pendulumPeriod);
    for (const key of continuousKeys) {
      near(after[key], before[key], 2e-8,
        `${key} continuous across phase ${boundary}`);
    }
  }

  for (let cycle = -2; cycle <= 10; cycle += 1) {
    let previousWheelAngle = -Infinity;
    for (let sample = 0; sample <= 240; sample += 1) {
      const time = (cycle + sample / 240) * geometry.pendulumPeriod;
      const state = stateAtTime(time);
      for (const [key, value] of Object.entries(state)) {
        if (typeof value === 'number') {
          assert.ok(Number.isFinite(value),
            `${key} finite at cycle ${cycle}, sample ${sample}`);
        }
      }
      assert.ok(state.wheelAngle >= previousWheelAngle - 2e-14,
        `wheel never recoils at cycle ${cycle}, sample ${sample}`);
      assert.ok(state.innerContactError < 2e-15);
      assert.ok(state.beatContactError < 2e-15);
      assert.ok((state.lockContactError ?? 0) < 4e-15);
      previousWheelAngle = state.wheelAngle;
    }
  }

  for (const phase of [
    geometry.leftUnlockPhase,
    geometry.firstWheelStepEndPhase,
    geometry.rightUnlockPhase,
    geometry.secondWheelStepEndPhase,
  ]) {
    near(model.root.userData.stateAtCyclePhase(phase).wheelAngularSpeed,
      0, 2e-7, `C2 wheel-step endpoint at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 312 renderer follows the analytical mechanism and leaves movement 339 as the authored frontier', () => {
  const movement = catalog.movements[311];
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
    near(blocks.wheelRotor.rotation.z,
      state.wheelAngle, 0, `common wheel angle at ${phase}`);
    near(blocks.outerEscapeWheel.rotation.z,
      0, 0, `outer-wheel datum at ${phase}`);
    near(blocks.palletWheel.rotation.z,
      geometry.palletWheelFacePhaseOffset, 0,
      `small-wheel ten-degree lag at ${phase}`);
    near(blocks.leftGravityArm.group.rotation.z,
      state.leftArmAngle, 0, `A angle at ${phase}`);
    near(blocks.rightGravityArm.group.rotation.z,
      state.rightArmAngle, 0, `B angle at ${phase}`);
    near(blocks.pendulumAssembly.rotation.z,
      state.pendulumAngle, 0, `pendulum angle at ${phase}`);
    assert.equal(blocks.outerLockMarker.visible, state.wheelLocked);
    assert.equal(blocks.beatContactMarker.userData.contactSide,
      state.beatContactSide);
    assert.equal(blocks.innerContactMarker.userData.contactSide,
      state.activeInnerContactSide);
    assert.equal(blocks.innerContactMarker.userData.toothIndex,
      state.activeInnerToothIndex);
    assert.equal(blocks.outerLockMarker.userData.contactSide,
      state.activeLockSide);
    vectorNear(new THREE.Vector2(
      blocks.beatContactMarker.position.x,
      blocks.beatContactMarker.position.y,
    ), state.beatContactPoint, 1e-12,
    `rendered fork contact at ${phase}`);
    vectorNear(new THREE.Vector2(
      blocks.innerContactMarker.position.x,
      blocks.innerContactMarker.position.y,
    ), state.activeInnerPoint, 1e-12,
    `rendered pallet contact at ${phase}`);
  }
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, geometry.pendulumPeriod);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  assertReadableTiming(model.root.userData.animationTiming);
  assert.ok(model.root.userData.cameraFitBounds.isBox3);
  assert.equal(model.root.userData.cameraDistanceScale, 1.12);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x,
    'oblique view exposes the two wheel planes');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
