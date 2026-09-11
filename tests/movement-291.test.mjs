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

test('movement 291 separates Arnold’s balance, two springs, stop, and wheel', () => {
  const movement = catalog.movements[290];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 291);
  assert.equal(movement.number, '291');
  assert.equal(movement.title,
    'Arnold’s chronometer or free escapement, sometimes used in watches');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'arnold-twelve-tooth-detached-free-chronometer-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /stud a depresses light passing spring f/);
  assert.match(mechanism, /hook k/);
  assert.match(mechanism, /stop d/);
  assert.match(mechanism, /impulse notch g/);
  assert.equal(transmission.toothCount, 12);
  assert.match(transmission.direction, /clockwise/);
  assert.match(transmission.balanceInteraction, /only during the return/);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.balance.parent, model.root);
  assert.equal(blocks.mainDetentSpring.parent, model.root);
  assert.equal(blocks.passingSpring.parent, model.root);
  assert.equal(blocks.detentStopD.parent, model.root);
  assert.equal(blocks.hookK.parent, model.root);
  assert.equal(blocks.fixedScrewB.parent, model.root);
  assert.equal(blocks.impulsePallet.parent, blocks.balance);
  assert.equal(blocks.operatingStud.parent, blocks.balance);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.toothedDisk.parent, blocks.wheelRotor);
  assert.equal(blocks.mainDetentSpring.userData.segments.length, 16);
  assert.equal(blocks.passingSpring.userData.segments.length, 18);
  vectorNear(blocks.balance.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'balance axis');
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'escape-wheel axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'twelve-source-counted-ratchet-teeth-on-wheel-B'
  ).length, 1);
  assert.equal(roles.filter((role) =>
    role === 'light-one-way-passing-spring-f-held-by-stud-i'
  ).length, 1);
  assert.equal(roles.filter((role) =>
    role === 'main-detent-leaf-spring-A-fixed-at-b'
  ).length, 1);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 291 records Brown’s unavailable animation and measured plate', () => {
  const movement = catalog.movements[290];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate291;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /detailed one-way sequence/);
  assert.match(sourceAnimation.referenceScope, /event order/);
  assert.match(sourceAnimation.referenceScope, /independently reconstructed/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_291.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.equal(plate.countedToothCount, 12);
  assert.equal(plate.rasterBalanceRadius, 56);
  assert.equal(plate.rasterEscapeWheelTipRadius, 122);
  assert.deepEqual(plate.rasterBalanceCenterA,
    new THREE.Vector2(82, 180));
  assert.deepEqual(plate.rasterEscapeWheelCenterB,
    new THREE.Vector2(146, 331));
  assert.deepEqual(plate.rasterFixedSpringScrewB,
    new THREE.Vector2(466, 201));
  assert.deepEqual(plate.rasterPassingSpringStudI,
    new THREE.Vector2(327, 174));
  assert.deepEqual(plate.rasterHookK,
    new THREE.Vector2(143, 183));
  assert.deepEqual(plate.rasterDetentStopD,
    new THREE.Vector2(193, 213));
  assert.deepEqual(plate.rasterImpulseNotchG,
    new THREE.Vector2(101, 236));
  assert.deepEqual(plate.rasterDirectionArrow,
    new THREE.Vector2(58, 128));
  assert.match(plate.inferredTopology, /twelve-tooth clockwise/);
  assert.match(plate.inferredTopology, /stop d/);
  assert.match(plate.inferredTopology, /notch g/);
  vectorNear(sourcePointToModel(plate.rasterBalanceCenterA),
    geometry.balanceCenter, 0, 'source balance center');
  vectorNear(sourcePointToModel(plate.rasterEscapeWheelCenterB),
    geometry.escapeWheelCenter, 0, 'source escape-wheel center');
  near(geometry.balanceRadius,
    plate.rasterBalanceRadius * geometry.sourceScale, 0,
  'source balance radius');
  near(geometry.toothTipRadius,
    plate.rasterEscapeWheelTipRadius * geometry.sourceScale, 0,
  'source escape-wheel radius');
  const wheelDirectionFromBalance = geometry.escapeWheelCenter.clone()
    .sub(geometry.balanceCenter);
  const wheelDirectionAngle = Math.atan2(
    wheelDirectionFromBalance.y,
    wheelDirectionFromBalance.x,
  );
  assert.ok(wheelDirectionAngle > geometry.balanceRimGapStart);
  assert.ok(wheelDirectionAngle < geometry.balanceRimGapEnd);
  near(geometry.balanceRimArc,
    Math.PI * 2
      - (geometry.balanceRimGapEnd - geometry.balanceRimGapStart), 0,
  'source-shaped balance rim excludes notch-g sector');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 291 passing spring is one-way and the balance is detached elsewhere', () => {
  const model = createMovementModel(catalog.movements[290]);
  const {
    canonicalStates,
    geometry,
    stateAtCyclePhase,
  } = model.root.userData;
  const outward = canonicalStates.outwardPassing;
  const detached = canonicalStates.detachedQuarter;
  const hookStart = canonicalStates.returnHookStart;
  const release = canonicalStates.toothRelease;
  const returning = canonicalStates.returnPassing;
  const relocked = canonicalStates.relocked;

  assert.equal(outward.outwardPassing, true);
  assert.ok(outward.outwardPassingDeflection > 0.26);
  assert.equal(outward.hookEngaged, false);
  assert.equal(outward.detentLift, 0);
  assert.equal(outward.wheelLocked, true);
  assert.equal(outward.balanceFree, true);
  assert.match(outward.stage, /depresses-light-spring-only/);

  assert.equal(detached.outwardPassing, false);
  assert.equal(detached.hookEngaged, false);
  assert.equal(detached.wheelLocked, true);
  assert.equal(detached.balanceFree, true);
  assert.match(detached.stage, /detached-free-balance/);

  assert.equal(hookStart.hookEngaged, true);
  assert.equal(hookStart.wheelLocked, true);
  assert.equal(hookStart.balanceFree, false);
  assert.match(hookStart.stage, /hooks-and-lifts/);
  assert.equal(release.hookEngaged, true);
  assert.equal(release.detentLift, geometry.maximumDetentLift);
  assert.equal(release.wheelUnlocked, true);
  assert.equal(release.stepProgress, 0);
  assert.equal(returning.hookEngaged, true);
  assert.equal(returning.impulseContactActive, true);
  assert.ok(returning.balanceAngularSpeed > 0);
  assert.ok(returning.returnPassingDeflection > 0.06);
  assert.equal(relocked.wheelLocked, true);
  assert.equal(relocked.stepProgress, 1);

  let loadedSamples = 0;
  for (let sample = 0; sample <= 10000; sample += 1) {
    const state = stateAtCyclePhase(sample / 10000);
    if (!state.balanceFree) loadedSamples += 1;
    if (state.outwardPassing) {
      assert.equal(state.detentLift, 0);
      assert.equal(state.wheelLocked, true);
    }
  }
  assert.ok(loadedSamples < 1900);
  assert.ok(loadedSamples > 1700);
  disposeModel(model.root);
});

test('movement 291 stop d holds one exact tooth and catches its successor', () => {
  const model = createMovementModel(catalog.movements[290]);
  const {
    geometry,
    stateAtCyclePhase,
    stateAtTime,
  } = model.root.userData;
  let lockedSamples = 0;
  for (let sample = 0; sample <= 10000; sample += 1) {
    const state = stateAtCyclePhase(sample / 10000);
    if (!state.wheelLocked) continue;
    lockedSamples += 1;
    near(state.wheelAngularSpeed, 0, 0,
      `locked wheel speed at ${sample}`);
    near(state.wheelAngularAcceleration, 0, 0,
      `locked wheel acceleration at ${sample}`);
    assert.ok(state.lockingToothIndex >= 0);
    assert.ok(state.lockingToothIndex < geometry.toothCount);
    near(state.lockingPointError, 0, 3e-15,
      `stop-d tooth closure at ${sample}`);
    vectorNear(state.lockingToothPoint,
      geometry.lockingPoint, 3e-15,
    `fixed stop-d contact at ${sample}`);
  }
  assert.ok(lockedSamples > 8700);
  const beforeRelease = stateAtCyclePhase(
    geometry.releaseStartPhase - 1e-8,
  );
  const afterRelock = stateAtCyclePhase(
    geometry.relockPhase + 1e-8,
  );
  assert.equal(beforeRelease.lockingToothIndex, 10);
  assert.equal(afterRelock.lockingToothIndex, 11);
  vectorNear(beforeRelease.lockingToothPoint,
    afterRelock.lockingToothPoint, 3e-15,
  'successive tooth at same stop');

  const start = stateAtTime(0.83);
  const nextCycle = stateAtTime(0.83 + geometry.balancePeriod);
  near(nextCycle.wheelAngle - start.wheelAngle,
    -geometry.toothPitch, 9e-16, 'one clockwise tooth per cycle');
  near(nextCycle.balanceAngle, start.balanceAngle, 8e-16,
    'balance oscillation closure');
  near(nextCycle.balanceAngularSpeed,
    start.balanceAngularSpeed, 8e-16, 'balance speed closure');
  assert.equal(nextCycle.stage, start.stage);
  disposeModel(model.root);
});

test('movement 291 releases exactly one monotonic clockwise tooth step', () => {
  const model = createMovementModel(catalog.movements[290]);
  const {
    geometry,
    stateAtCyclePhase,
  } = model.root.userData;
  const start = stateAtCyclePhase(geometry.releaseStartPhase);
  const end = stateAtCyclePhase(geometry.relockPhase);
  assert.equal(start.stepProgress, 0);
  assert.equal(end.stepProgress, 1);
  near(start.wheelAngularSpeed, 0, 0, 'release starts from rest');
  near(end.wheelAngularSpeed, 0, 0, 'relock ends at rest');
  near(end.wheelAngle - start.wheelAngle,
    -geometry.toothPitch, 3e-16, 'one-tooth released step');

  let previousProgress = start.stepProgress;
  let previousAngle = start.wheelAngle;
  for (let sample = 1; sample < 1000; sample += 1) {
    const phase = THREE.MathUtils.lerp(
      geometry.releaseStartPhase,
      geometry.relockPhase,
      sample / 1000,
    );
    const state = stateAtCyclePhase(phase);
    assert.equal(state.wheelUnlocked, true);
    assert.ok(state.stepProgress > previousProgress);
    assert.ok(state.wheelAngle < previousAngle);
    assert.ok(state.wheelAngularSpeed < 0);
    previousProgress = state.stepProgress;
    previousAngle = state.wheelAngle;
    if (state.stepProgress < 0.89) {
      near(state.detentLift, geometry.maximumDetentLift, 0,
        `stop clear through passing tooth at ${sample}`);
    }
  }
  disposeModel(model.root);
});

test('movement 291 tooth-to-notch-g impulse contact closes exactly', () => {
  const model = createMovementModel(catalog.movements[290]);
  const {
    geometry,
    impulseLocalContactPointAtPhase,
    impulseProfile,
    stateAtCyclePhase,
  } = model.root.userData;
  assert.equal(impulseProfile.sourceLabel, 'g');
  assert.equal(impulseProfile.points.length, 49);
  assert.ok(impulseProfile.concentricRadiusRange > 0.27);
  near(-geometry.toothLeanAngle,
    geometry.toothProfileTipOffset, 0,
  'analytic contact uses rendered tooth-tip offset');

  let impulseSamples = 0;
  for (let sample = 0; sample <= 10000; sample += 1) {
    const state = stateAtCyclePhase(sample / 10000);
    if (!state.impulseContactActive) continue;
    impulseSamples += 1;
    assert.ok(state.impulseToothIndex >= 0);
    assert.ok(state.impulseToothIndex < geometry.toothCount);
    assert.ok(state.balanceAngularSpeed > 0);
    assert.ok(state.wheelAngularSpeed < 0);
    near(state.impulseContact.pointError, 0, 4e-15,
      `impulse point closure at ${sample}`);
    near(state.impulseContact.normalVelocityError, 0, 2e-15,
      `impulse normal velocity at ${sample}`);
    vectorNear(state.impulseContact.localPoint,
      impulseLocalContactPointAtPhase(state.cyclePhase), 0,
    `impulse pallet material point at ${sample}`);
    assert.ok(state.impulseContact.relativeSlipSpeed > 0);
  }
  assert.ok(impulseSamples > 690);
  assert.ok(impulseSamples < 710);
  disposeModel(model.root);
});

test('movement 291 analytic wheel and balance rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[290]);
  const { stateAtTime } = model.root.userData;
  const epsilon = 2e-5;
  for (const time of [0.16, 0.80, 1.64, 1.80, 1.94, 2.06,
    2.18, 2.22, 2.80, 3.60]) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near((after.balanceAngle - before.balanceAngle) / (2 * epsilon),
      state.balanceAngularSpeed, 3e-9,
    `balance speed at ${time}`);
    near((after.balanceAngularSpeed - before.balanceAngularSpeed)
        / (2 * epsilon),
    state.balanceAngularAcceleration, 4e-9,
    `balance acceleration at ${time}`);
    near((after.wheelAngle - before.wheelAngle) / (2 * epsilon),
      state.wheelAngularSpeed, 2e-8,
    `wheel speed at ${time}`);
    near((after.wheelAngularSpeed - before.wheelAngularSpeed)
        / (2 * epsilon),
    state.wheelAngularAcceleration, 6e-8,
    `wheel acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 291 renderer binds both leaves, contacts, cycle, and next draft', () => {
  const model = createMovementModel(catalog.movements[290]);
  const {
    animationTiming,
    blocks,
    geometry,
    mainSpringPointsAtLift,
    passingSpringPointsAtState,
    passingStudPoseAtState,
    stateAtTime,
    timeline,
  } = model.root.userData;
  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(timeline.demonstrationPeriod, 4);

  for (const phase of [0, 0.25, 0.41, 0.435, 0.478, 0.50,
    0.548, 0.56, 0.75, 1]) {
    const time = phase * geometry.balancePeriod;
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.balance.rotation.z, expected.balanceAngle, 0,
      `rendered balance at ${phase}`);
    near(blocks.wheelRotor.rotation.z, expected.wheelAngle, 0,
      `rendered escape wheel at ${phase}`);
    assert.equal(blocks.lockMarker.visible, expected.wheelLocked);
    assert.equal(blocks.impulseMarker.visible,
      expected.impulseContactActive);
    const mainPoints = mainSpringPointsAtLift(expected.detentLift);
    vectorNear(new THREE.Vector2(
      blocks.hookK.position.x,
      blocks.hookK.position.y,
    ), new THREE.Vector2(
      mainPoints.at(-1).x,
      mainPoints.at(-1).y,
    ), 0, `rendered hook k at ${phase}`);
    const passingPoints = passingSpringPointsAtState(expected);
    const passingStudPose = passingStudPoseAtState(expected);
    vectorNear(new THREE.Vector2(
      blocks.passingStudI.position.x,
      blocks.passingStudI.position.y,
    ), new THREE.Vector2(
      passingStudPose.center.x,
      passingStudPose.center.y,
    ), 0, `rendered stud i center at ${phase}`);
    near(blocks.passingStudI.scale.y,
      passingStudPose.top.distanceTo(passingStudPose.bottom), 0,
    `rendered stud i span at ${phase}`);
    vectorNear(new THREE.Vector2(
      passingStudPose.top.x,
      passingStudPose.top.y,
    ), new THREE.Vector2(
      passingPoints[0].x,
      passingPoints[0].y,
    ), 0, `stud i reaches passing spring at ${phase}`);
    if (expected.wheelLocked) {
      assert.equal(model.root.userData.contacts.mode, 'detent-stop-d');
      near(model.root.userData.contacts.detent.pointError,
        0, 3e-15, `rendered detent closure at ${phase}`);
    } else if (expected.impulseContactActive) {
      assert.equal(model.root.userData.contacts.mode, 'impulse-notch-g');
      near(model.root.userData.contacts.impulse.pointError,
        0, 4e-15, `rendered impulse closure at ${phase}`);
    } else {
      assert.equal(model.root.userData.contacts.mode, 'unlocked-flight');
    }
  }

  model.update(0.83);
  const startBalanceAngle = blocks.balance.rotation.z;
  const startWheelAngle = blocks.wheelRotor.rotation.z;
  model.update(0.83 + geometry.balancePeriod);
  near(blocks.balance.rotation.z, startBalanceAngle, 8e-16,
    'rendered balance closure');
  near(blocks.wheelRotor.rotation.z - startWheelAngle,
    -geometry.toothPitch, 9e-16, 'rendered one-tooth advance');

  const movement292 = catalog.movements[291];
  const model292 = createMovementModel(movement292);
  assert.equal(movement292.id, 292);
  assert.equal(movement292.fidelity, 'authored');
  assert.equal(movement292.archetype,
    'forty-eight-alternating-front-rear-stud-deadbeat-escapement');
  assert.equal(model292.root.userData.fidelity, 'authored');
  disposeModel(model292.root);
  disposeModel(model.root);
});
