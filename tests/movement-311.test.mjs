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

test('movement 311 is two offset three-legged wheels, one lifting-pin set, and two between-wheel gravity arms', () => {
  const movement = catalog.movements[310];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    presentation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 311);
  assert.equal(movement.number, '311');
  assert.equal(movement.title, 'Double three-legged gravity escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'denison-double-offset-three-legged-exclusive-stop-gravity-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /double three-legged gravity escapement/);
  assert.match(mechanism, /front wheel ABC and rear wheel abc/);
  assert.match(mechanism, /offset by 60 degrees/);
  assert.match(mechanism, /one shared set of three axial pins/);
  assert.match(mechanism, /right stop D can lock only front ABC/);
  assert.match(mechanism, /left stop E can lock only rear abc/);
  assert.match(presentation, /six interleaved locking legs/);
  assert.match(presentation, /pallets between those planes/);
  assert.equal(transmission.lockingWheels, 2);
  assert.equal(transmission.liftingPinSets, 1);
  assert.equal(transmission.liftingPins, 3);

  assert.equal(blocks.escapeWheelAssembly.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheelAssembly);
  assert.equal(blocks.frontWheelABC.group.parent, blocks.wheelRotor);
  assert.equal(blocks.rearWheelabc.group.parent, blocks.wheelRotor);
  assert.equal(blocks.flyRotor.parent, blocks.escapeWheelAssembly);
  assert.equal(blocks.leftGravityArm.group.parent, model.root);
  assert.equal(blocks.rightGravityArm.group.parent, model.root);
  assert.notEqual(blocks.frontWheelABC.group, blocks.rearWheelabc.group);
  assert.notEqual(blocks.leftGravityArm.group,
    blocks.rightGravityArm.group);
  assert.equal(blocks.frontWheelABC.legs.length, 3);
  assert.equal(blocks.rearWheelabc.legs.length, 3);
  assert.equal(blocks.frontWheelABC.tips.length, 3);
  assert.equal(blocks.rearWheelabc.tips.length, 3);
  assert.deepEqual(blocks.frontWheelABC.legs.map(({ userData }) =>
    userData.label), ['A', 'B', 'C']);
  assert.deepEqual(blocks.rearWheelabc.legs.map(({ userData }) =>
    userData.label), ['a', 'b', 'c']);
  assert.equal(blocks.liftingPinMeshes.length, 3);
  assert.equal(blocks.flyVanes.length, 2);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    /^front-ABC-locking-leg-[ABC]$/.test(role)).length, 3);
  assert.equal(roles.filter((role) =>
    /^rear-abc-locking-leg-[abc]$/.test(role)).length, 3);
  assert.equal(roles.filter((role) =>
    /^one-shared-lifting-pin-\d-of-3$/.test(role)).length, 3);
  assert.equal(roles.filter((role) =>
    /between-wheels-gravity-arm$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /exclusive-locking-stop-[DE]-face$/.test(role)).length, 2);
  assert.equal(roles.some((role) =>
    /generic|procedural|single-three-legged/.test(role)), false);
  disposeModel(model.root);
});

test('movement 311 preserves Brown’s measured plate and the documented Denison construction', () => {
  const movement = catalog.movements[310];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate311;
  const awci = sourceReference.awciSingleDoubleComparison;
  const britannica = sourceReference.britannicaConstructionReference;
  const goodrich = sourceReference.goodrichLayoutReference;
  const trinity = sourceReference.trinityOperatingReference;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.match(sourceAnimation.referenceScope, /two named locking wheels/);
  assert.match(sourceAnimation.referenceScope, /60-degree wheel offset/);
  assert.match(sourceAnimation.referenceScope, /friction fly/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_311.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 263);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterWheelCenter,
    new THREE.Vector2(128, 270));
  assert.deepEqual(plate.rasterLeftPalletArbor,
    new THREE.Vector2(118, 31));
  assert.deepEqual(plate.rasterRightPalletArbor,
    new THREE.Vector2(140, 32));
  assert.deepEqual(plate.rasterPendulumSuspension,
    new THREE.Vector2(129, 10));
  assert.deepEqual(plate.rasterLeftStopE,
    new THREE.Vector2(28, 228));
  assert.deepEqual(plate.rasterRightStopD,
    new THREE.Vector2(230, 219));
  assert.deepEqual(plate.rasterLeftBeatPin,
    new THREE.Vector2(115, 489));
  assert.deepEqual(plate.rasterRightBeatPin,
    new THREE.Vector2(140, 488));
  assert.deepEqual(plate.rasterLiftingPins, [
    new THREE.Vector2(123, 267),
    new THREE.Vector2(129, 265),
    new THREE.Vector2(130, 272),
  ]);
  assert.deepEqual(plate.rasterFrontLegTipsABC, [
    new THREE.Vector2(221, 215),
    new THREE.Vector2(128, 377),
    new THREE.Vector2(42, 229),
  ]);
  assert.deepEqual(plate.rasterRearLegTipsabc, [
    new THREE.Vector2(127, 164),
    new THREE.Vector2(183, 329),
    new THREE.Vector2(35, 337),
  ]);
  assert.match(plate.inferredTopology, /two coaxial three-legged wheels/);
  assert.match(plate.inferredTopology, /one set of three axial lifting pins/);
  assert.match(plate.inferredTopology, /D reaches only ABC/);

  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 0, 'mapped wheel center');
  vectorNear(sourcePointToModel(plate.rasterLeftPalletArbor),
    geometry.mappedLeftPalletArbor, 0, 'mapped left arbor');
  vectorNear(sourcePointToModel(plate.rasterRightPalletArbor),
    geometry.mappedRightPalletArbor, 0, 'mapped right arbor');
  vectorNear(sourcePointToModel(plate.rasterLeftStopE),
    geometry.mappedLeftStopE, 0, 'mapped E');
  vectorNear(sourcePointToModel(plate.rasterRightStopD),
    geometry.mappedRightStopD, 0, 'mapped D');
  near(geometry.lockingLegRadius,
    geometry.meanSourceLockingRadius * geometry.sourceScale,
  1e-15, 'outer radius uses the measured D/E mean');

  assert.equal(awci.publicationYear, 1979);
  assert.match(awci.operatingEvidence, /second three-legged member/);
  assert.match(awci.operatingEvidence, /120 degrees to 60 degrees/);
  assert.equal(britannica.figure, 20);
  assert.equal(britannica.publicationEdition, 11);
  assert.match(britannica.operatingEvidence, /like a lantern pinion/);
  assert.match(britannica.operatingEvidence, /60 degrees apart/);
  assert.deepEqual(goodrich.figures, [47, 48]);
  assert.match(goodrich.layoutEvidence, /pallets act between the wheels/);
  assert.match(trinity.operatingEvidence, /matching arm’s locking block/);
  assert.match(trinity.operatingEvidence, /Three black lifting pins/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 311 interleaves the rigid wheel sides by 60 degrees and advances one combined position per vibration', () => {
  const model = createMovementModel(catalog.movements[310]);
  const {
    blocks,
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;

  near(geometry.lockingLegPitch, FULL_TURN / 3, 1e-15,
    'three equal legs on each wheel side');
  near(geometry.rearWheelPhaseOffset, FULL_TURN / 6, 1e-15,
    'rear wheel is offset by half a three-leg pitch');
  near(blocks.frontWheelABC.group.rotation.z, 0, 0,
    'front ABC datum');
  near(blocks.rearWheelabc.group.rotation.z,
    geometry.rearWheelPhaseOffset, 0, 'rear abc datum');
  near(geometry.wheelAdvancePerBeat, FULL_TURN / 6, 1e-15,
    'sixty-degree beat step');
  near(geometry.wheelAdvancePerCycle, FULL_TURN / 3, 1e-15,
    'two beat steps per pendulum cycle');
  assert.equal(transmission.wheelPhaseOffsetDegrees, 60);
  assert.equal(transmission.wheelAdvancePerBeatDegrees, 60);
  assert.equal(transmission.stepsPerPendulumCycle, 2);
  assert.equal(transmission.wheelCyclesPerRevolution, 3);
  assert.match(transmission.direction, /counterclockwise/);

  for (const phase of [0, 0.19, 0.38, 0.61, 0.88, 1]) {
    const wheelAngle = model.root.userData.stateAtCyclePhase(
      phase,
    ).wheelAngle;
    const combinedAngles = [];
    for (let index = 0; index < 3; index += 1) {
      combinedAngles.push(positiveModulo(
        wheelAngle + index * geometry.lockingLegPitch,
        FULL_TURN,
      ));
      combinedAngles.push(positiveModulo(
        wheelAngle + geometry.rearWheelPhaseOffset
          + index * geometry.lockingLegPitch,
        FULL_TURN,
      ));
    }
    combinedAngles.sort((a, b) => a - b);
    for (let index = 0; index < combinedAngles.length; index += 1) {
      const next = index === combinedAngles.length - 1
        ? combinedAngles[0] + FULL_TURN
        : combinedAngles[index + 1];
      near(next - combinedAngles[index], FULL_TURN / 6, 2e-14,
        `six-position spacing at phase ${phase}`);
    }
  }

  for (let cycle = -2; cycle <= 4; cycle += 1) {
    const start = stateAtTime(cycle * geometry.pendulumPeriod);
    const afterOneBeat = stateAtTime((cycle + 0.6)
      * geometry.pendulumPeriod);
    const end = stateAtTime((cycle + 1)
      * geometry.pendulumPeriod);
    near(afterOneBeat.wheelAngle - start.wheelAngle,
      geometry.wheelAdvancePerBeat, 1e-12,
      `first sixty-degree step in cycle ${cycle}`);
    near(end.wheelAngle - start.wheelAngle,
      geometry.wheelAdvancePerCycle, 1e-12,
      `two sixty-degree steps in cycle ${cycle}`);
    assert.equal(start.startingLeftLegIndex,
      positiveModulo(-cycle, 3));
    assert.equal(start.rightLandingLegIndex,
      positiveModulo(2 - cycle, 3));
    assert.equal(start.landingLeftLegIndex,
      positiveModulo(2 - cycle, 3));
  }
  const start = stateAtTime(0);
  const closure = stateAtTime(3 * geometry.pendulumPeriod);
  near(closure.wheelAngle - start.wheelAngle,
    FULL_TURN, 1e-12,
    'three pendulum cycles close both wheel sides after one turn');
  near(closure.pendulumAngle, start.pendulumAngle, 1e-15,
    'pendulum closes with the wheel assembly');
  disposeModel(model.root);
});

test('movement 311 puts both pallets between the wheel planes and makes D and E axially exclusive', () => {
  const model = createMovementModel(catalog.movements[310]);
  const {
    blocks,
    geometry,
    stateAtCyclePhase,
    transmission,
    wheelForSide,
  } = model.root.userData;

  assert.ok(geometry.rearWheelPlaneZ < geometry.leftPalletPlaneZ);
  assert.ok(geometry.leftPalletPlaneZ < geometry.rightPalletPlaneZ);
  assert.ok(geometry.rightPalletPlaneZ < geometry.frontWheelPlaneZ);
  near(blocks.rearWheelabc.group.position.z,
    geometry.rearWheelPlaneZ, 0, 'rear abc plane');
  near(blocks.frontWheelABC.group.position.z,
    geometry.frontWheelPlaneZ, 0, 'front ABC plane');
  near(blocks.leftGravityArm.group.position.z,
    geometry.leftPalletPlaneZ, 0, 'left E arm between wheels');
  near(blocks.rightGravityArm.group.position.z,
    geometry.rightPalletPlaneZ, 0, 'right D arm between wheels');
  assert.equal(blocks.leftGravityArm.group.userData.lockingWheel,
    'rear-abc');
  assert.equal(blocks.rightGravityArm.group.userData.lockingWheel,
    'front-ABC');
  assert.equal(wheelForSide(-1), 'rear-abc');
  assert.equal(wheelForSide(1), 'front-ABC');
  assert.deepEqual(transmission.locking, {
    leftE: 'rear wheel abc only',
    rightD: 'front wheel ABC only',
  });

  model.root.updateWorldMatrix(true, true);
  const leftStopBounds = new THREE.Box3().setFromObject(
    blocks.leftGravityArm.stopStem,
  );
  const rightStopBounds = new THREE.Box3().setFromObject(
    blocks.rightGravityArm.stopStem,
  );
  assert.ok(leftStopBounds.max.z < 0,
    'left E stop stays wholly on the rear side');
  assert.ok(rightStopBounds.min.z > 0,
    'right D stop stays wholly on the front side');
  near(leftStopBounds.min.z,
    geometry.rearWheelPlaneZ - geometry.lockingWheelDepth / 2,
  5e-7, 'E reaches the rear abc outer face');
  near(rightStopBounds.max.z,
    geometry.frontWheelPlaneZ + geometry.lockingWheelDepth / 2,
  5e-7, 'D reaches the front ABC outer face');

  for (const pin of blocks.liftingPinMeshes) {
    const bounds = new THREE.Box3().setFromObject(pin);
    assert.ok(bounds.min.z < geometry.rearWheelPlaneZ
      + geometry.lockingWheelDepth / 2,
    `${pin.userData.role} enters the rear wheel side`);
    assert.ok(bounds.max.z > geometry.frontWheelPlaneZ
      - geometry.lockingWheelDepth / 2,
    `${pin.userData.role} enters the front wheel side`);
  }

  for (const phase of [0.04, 0.20, 0.32, 0.98]) {
    const state = stateAtCyclePhase(phase);
    assert.equal(state.activeLockSide, 'left');
    assert.equal(state.activeLockWheel, 'rear-abc');
  }
  for (const phase of [0.48, 0.62, 0.70, 0.82]) {
    const state = stateAtCyclePhase(phase);
    assert.equal(state.activeLockSide, 'right');
    assert.equal(state.activeLockWheel, 'front-ABC');
  }
  disposeModel(model.root);
});

test('movement 311 hands the pendulum continuously between arms and follows the documented eight-event sequence', () => {
  const model = createMovementModel(catalog.movements[310]);
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
    'pendulum-lifts-left-arm-and-releases-rear-wheel-at-E');
  assert.equal(leftUnlock.pendulumRaisedPalletSide, 'left');
  assert.equal(leftUnlock.activeLockWheel, 'rear-abc');
  assert.equal(leftUnlock.trainCoupledToPendulum, true);
  near(leftUnlock.rightPalletMagnitude,
    geometry.fallenMagnitude, 0, 'right arm waits fallen');
  const firstStep = stateAtCyclePhase(
    (geometry.leftUnlockPhase + geometry.firstWheelStepEndPhase) / 2,
  );
  assert.equal(firstStep.mode,
    'shared-pin-cocks-right-arm-between-wheels');
  assert.equal(firstStep.activeLiftSide, 'right');
  assert.equal(firstStep.trainCoupledToPendulum, false);

  const rightUnlock = stateAtCyclePhase(
    (geometry.rightPickupPhase + geometry.rightUnlockPhase) / 2,
  );
  assert.equal(rightUnlock.mode,
    'pendulum-lifts-right-arm-and-releases-front-wheel-at-D');
  assert.equal(rightUnlock.pendulumRaisedPalletSide, 'right');
  assert.equal(rightUnlock.activeLockWheel, 'front-ABC');
  assert.equal(rightUnlock.trainCoupledToPendulum, true);
  near(rightUnlock.leftPalletMagnitude,
    geometry.fallenMagnitude, 0, 'left arm waits fallen');
  const secondStep = stateAtCyclePhase(
    (geometry.rightUnlockPhase + geometry.secondWheelStepEndPhase) / 2,
  );
  assert.equal(secondStep.mode,
    'shared-pin-cocks-left-arm-between-wheels');
  assert.equal(secondStep.activeLiftSide, 'left');
  assert.equal(secondStep.trainCoupledToPendulum, false);

  assert.deepEqual(timeline.schedule, [
    'right-gravity-arm-falls-with-pendulum',
    'left-arm-lifts-and-releases-rear-abc-at-E',
    'assembly-turns-60-degrees-and-shared-pin-cocks-right-arm',
    'front-ABC-locks-exclusively-at-right-D',
    'left-gravity-arm-falls-with-pendulum',
    'right-arm-lifts-and-releases-front-ABC-at-D',
    'assembly-turns-60-degrees-and-shared-pin-cocks-left-arm',
    'rear-abc-locks-exclusively-at-left-E',
  ]);
  disposeModel(model.root);
});

test('movement 311 holds exact no-recoil outer locks and cocks the opposite arm on exact generated inner faces', () => {
  const model = createMovementModel(catalog.movements[310]);
  const {
    fixedLockPointForSide,
    geometry,
    liftFaceLocalPointAt,
    liftingPinAt,
    palletWorldPoint,
    stateAtCyclePhase,
  } = model.root.userData;

  for (const phase of [0.04, 0.20, 0.32, 0.48, 0.70, 0.82, 0.98]) {
    const state = stateAtCyclePhase(phase);
    assert.equal(state.wheelLocked, true,
      `assembly locked at phase ${phase}`);
    assert.equal(state.wheelStepActive, false);
    near(state.wheelAngularSpeed, 0, 1e-9,
      `no wheel recoil at phase ${phase}`);
    near(state.lockContactError, 0, 3e-14,
      `exact exclusive stop contact at phase ${phase}`);
    const side = state.activeLockSide === 'right' ? 1 : -1;
    vectorNear(state.activeLockPoint,
      fixedLockPointForSide(side), 3e-14,
      `fixed outer stop station at phase ${phase}`);
    near(state.activeLockPoint.distanceTo(geometry.wheelCenter),
      geometry.lockingLegRadius, 2e-14,
      `outer locking radius at phase ${phase}`);
  }

  assert.ok(geometry.liftingPinRadius < geometry.lockingLegRadius / 10,
    'lifting pins act near the arbor while locks act at the leg tips');
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
  for (const step of steps) {
    let previousAdvance = -Infinity;
    let previousMagnitude = geometry.fallenMagnitude;
    for (const fraction of [0, 0.2, 0.5, 0.8, 1]) {
      const phase = THREE.MathUtils.lerp(step.start, step.end, fraction);
      const state = stateAtCyclePhase(phase);
      const magnitude = step.side === 'right'
        ? state.rightPalletMagnitude
        : state.leftPalletMagnitude;
      assert.equal(state.wheelStepActive, true);
      assert.equal(state.wheelLocked, false);
      assert.equal(state.activeLiftSide, step.side);
      assert.equal(state.trainRaisingPalletSide, step.side);
      assert.equal(state.trainCoupledToPendulum, false);
      assert.ok(state.wheelAdvance >= previousAdvance - 1e-14);
      assert.ok(magnitude >= previousMagnitude - 1e-14);
      near(state.liftContactError, 0, 3e-14,
        `exact ${step.side} shared-pin contact at ${fraction}`);
      vectorNear(state.activeLiftPoint,
        liftingPinAt(state.wheelAngle, state.activeLiftPinIndex),
        2e-14, `${step.side} active shared pin at ${fraction}`);
      near(state.activeLiftPoint.distanceTo(geometry.wheelCenter),
        geometry.liftingPinRadius, 2e-14,
        `${step.side} lift remains at the inner radius`);
      vectorNear(palletWorldPoint(
        step.sideSign,
        liftFaceLocalPointAt(step.sideSign, state.liftProgress),
        magnitude,
      ), state.activeLiftPoint, 3e-14,
      `${step.side} generated lift face at ${fraction}`);
      previousAdvance = state.wheelAdvance;
      previousMagnitude = magnitude;
    }
    const start = stateAtCyclePhase(step.start);
    const middle = stateAtCyclePhase((step.start + step.end) / 2);
    const end = stateAtCyclePhase(step.end);
    near(start.wheelAngularSpeed, 0, 2e-7,
      `${step.side} step starts smoothly`);
    assert.ok(middle.wheelAngularSpeed > 0);
    near(end.wheelAngularSpeed, 0, 2e-7,
      `${step.side} step lands smoothly`);
    near(end.wheelAdvance - start.wheelAdvance,
      geometry.wheelAdvancePerBeat, 2e-15,
      `${step.side} lift consumes one sixty-degree step`);
  }
  disposeModel(model.root);
});

test('movement 311 supplies equal isolated gravity impulses and a correctly coupled friction fly', () => {
  const model = createMovementModel(catalog.movements[310]);
  const {
    blocks,
    effectiveCenterOfMassAt,
    geometry,
    gravityPotentialAt,
    sourceReference,
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
    'mirror arms provide equal potential drops');
  assert.ok(rightDrop > 0);
  near(transmission.equalImpulseEnergyPerSide,
    rightDrop, 1e-14, 'published equal impulse energy');
  near(effectiveCenterOfMassAt(1, geometry.cockedMagnitude).y
    - effectiveCenterOfMassAt(1, geometry.fallenMagnitude).y,
  rightDrop / (geometry.weightedArmMass * geometry.standardGravity),
  1e-14, 'arm centre of mass supplies the potential drop');

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

  assert.equal(blocks.flyRotor.parent, blocks.escapeWheelAssembly);
  assert.match(sourceReference.britannicaConstructionReference
    .operatingEvidence, /friction fly|60 degrees apart/i);
  assert.match(transmission.flyCoupling, /friction-spring fly/);
  assert.match(transmission.flyCoupling, /same angular rate/);
  for (const phase of [0, 0.2, 0.38, 0.48, 0.7, 0.88, 0.98, 1]) {
    const state = stateAtCyclePhase(phase);
    near(state.flyAngle - state.wheelAngle,
      Math.PI / 5, 1e-14, `normal no-slip fly phase at ${phase}`);
    near(state.flyAngularSpeed, state.wheelAngularSpeed,
      0, `friction fly follows the escape arbor at ${phase}`);
  }
  assert.ok(stateAtCyclePhase(0.38).wheelAngularSpeed > 0);
  assert.ok(stateAtCyclePhase(0.88).wheelAngularSpeed > 0);
  near(stateAtCyclePhase(0.2).wheelAngularSpeed, 0, 1e-9,
    'wheel and fly rest at E');
  near(stateAtCyclePhase(0.7).wheelAngularSpeed, 0, 1e-9,
    'wheel and fly rest at D');
  disposeModel(model.root);
});

test('movement 311 renderer follows the analytical solution and leaves movement 339 at the authored frontier', () => {
  const movement = catalog.movements[310];
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
      state.wheelAngle, 0, `double-wheel angle at phase ${phase}`);
    near(blocks.frontWheelABC.group.rotation.z,
      0, 0, `front datum at phase ${phase}`);
    near(blocks.rearWheelabc.group.rotation.z,
      geometry.rearWheelPhaseOffset, 0,
      `rear sixty-degree offset at phase ${phase}`);
    near(blocks.flyRotor.rotation.z,
      state.flyAngle, 0, `fly angle at phase ${phase}`);
    near(blocks.leftGravityArm.group.rotation.z,
      state.leftPalletAngle, 0, `left arm at phase ${phase}`);
    near(blocks.rightGravityArm.group.rotation.z,
      state.rightPalletAngle, 0, `right arm at phase ${phase}`);
    assert.equal(blocks.wheelLiftMarker.userData.active,
      state.wheelStepActive);
    assert.equal(blocks.lockMarker.userData.active, state.wheelLocked);
    for (const marker of [blocks.beatContactMarker,
      blocks.wheelLiftMarker, blocks.lockMarker]) {
      assert.equal(marker.visible, false,
        `${marker.userData.role} is a diagnostic locus inside the parts`);
    }
    assert.equal(blocks.beatContactMarker.userData.contactSide,
      state.beatContactSide);
    assert.equal(blocks.wheelLiftMarker.userData.contactSide,
      state.activeLiftSide);
    assert.equal(blocks.lockMarker.userData.contactSide,
      state.activeLockSide);
    assert.equal(blocks.lockMarker.userData.lockingWheel,
      state.activeLockWheel);
    vectorNear(new THREE.Vector2(
      blocks.beatContactMarker.position.x,
      blocks.beatContactMarker.position.y,
    ), state.beatContactPoint, 1e-12,
    `beat contact marker at phase ${phase}`);
  }
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, geometry.pendulumPeriod);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  assertReadableTiming(model.root.userData.animationTiming);
  assert.ok(model.root.userData.cameraFitBounds.isBox3);
  assert.equal(model.root.userData.cameraDistanceScale, 1.18);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x,
    'default oblique elevation exposes the separated wheel planes');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
