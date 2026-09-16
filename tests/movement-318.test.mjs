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

function planarNear(actual, expected, tolerance, message) {
  near(
    Math.hypot(actual.x - expected.x, actual.y - expected.y),
    0,
    tolerance,
    message,
  );
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

test('movement 318 is one complete curb-pin watch regulator, not a generic escapement', () => {
  const movement = catalog.movements[317];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    massModel,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 318);
  assert.equal(movement.number, '318');
  assert.match(movement.title, /^Watch regulator/);
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'adjustable-curb-pin-watch-balance-spring-regulator');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /turns concentrically/);
  assert.match(mechanism, /two curb pins/);
  assert.match(mechanism, /toward FAST/);
  assert.match(mechanism, /shortening the vibrating spring/);
  assert.match(mechanism, /square-root stiffness law/);
  assert.equal(transmission.curbPinCount, 2);
  assert.match(transmission.neutralPoint, /P/);
  assert.match(transmission.frequencyLaw, /sqrt/);
  assert.match(transmission.springStiffnessLaw,
    /inversely proportional/);
  assert.equal(massModel.balance.spokeCount, 3);
  assert.equal(massModel.spring.uniformStrip, true);
  assert.ok(massModel.balance.inertia > 0);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.balanceAssembly.parent, model.root);
  assert.equal(blocks.regulatorCarrier.parent, model.root);
  assert.equal(blocks.fixedRing.parent, blocks.fixedFrame);
  assert.equal(blocks.balanceRim.parent, blocks.balanceAssembly);
  assert.equal(blocks.balanceStaff.parent, blocks.balanceAssembly);
  assert.equal(blocks.pointer.parent, blocks.regulatorCarrier);
  assert.equal(blocks.curbPins.length, 2);
  assert.equal(blocks.balanceSpokes.length, 3);
  assert.equal(blocks.springSegments.length, 180);
  assert.equal(blocks.springSamples.length, 181);
  assert.deepEqual(blocks.balanceAssembly.userData.axis,
    new THREE.Vector3(0, 0, 1));
  assert.deepEqual(blocks.regulatorCarrier.userData.axis,
    new THREE.Vector3(0, 0, 1));

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'curb-pin-forming-neutral-point-P').length, 2);
  assert.equal(roles.filter((role) =>
    role === 'flat-spiral-balance-spring-segment').length, 180);
  assert.equal(roles.filter((role) =>
    role === 'balance-wheel-spoke').length, 3);
  assert.equal(roles.filter((role) =>
    role === 'fixed-outer-balance-spring-stud-R').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 318 records every functional landmark and the unavailable official animation', () => {
  const movement = catalog.movements[317];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToNeutralFront,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.brownPlate318;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /three-spoke balance/);
  assert.match(sourceAnimation.referenceScope, /paired curb pins at P/);
  assert.match(sourceAnimation.referenceScope, /fixed outer stud R/);
  assert.match(sourceAnimation.referenceScope, /SLOW–FAST scale/);
  assert.match(sourceAnimation.referenceScope, /not dimensioned/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_318.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 11);
  assert.deepEqual(plate.rasterCenter, new THREE.Vector2(260, 207));
  assert.deepEqual(plate.rasterBalanceTop,
    new THREE.Vector2(260, 5));
  assert.deepEqual(plate.rasterBalanceBottom,
    new THREE.Vector2(260, 409));
  assert.deepEqual(plate.rasterBalanceLeft,
    new THREE.Vector2(59, 207));
  assert.deepEqual(plate.rasterBalanceRight,
    new THREE.Vector2(464, 207));
  assert.deepEqual(plate.rasterStudR,
    new THREE.Vector2(172, 199));
  assert.deepEqual(plate.rasterCurbP,
    new THREE.Vector2(268, 293));
  assert.deepEqual(plate.rasterPointerTip,
    new THREE.Vector2(260, 486));
  assert.match(plate.inferredTopology, /three-spoke balance/);
  assert.match(plate.inferredTopology, /two curb pins defining P/);

  near((plate.rasterBalanceBottom.y - plate.rasterBalanceTop.y)
      * geometry.sourceScale / 2,
    geometry.balanceOuterRadius, 0, 'source balance radius');
  near((plate.rasterPointerTip.y - plate.rasterCenter.y)
      * geometry.sourceScale,
    geometry.pointerRadius, 0, 'source pointer radius');
  const neutral = stateAtTime(0);
  const sourceTolerance = plate.measurementUncertaintyPixels
    * geometry.sourceScale;
  planarNear(sourcePointToNeutralFront(plate.rasterBalanceTop),
    neutral.balanceIndex.position, sourceTolerance,
  'source balance index at top');
  planarNear(sourcePointToNeutralFront(plate.rasterStudR),
    neutral.fixedOuterStud.position, sourceTolerance,
  'source fixed outer stud R');
  planarNear(sourcePointToNeutralFront(plate.rasterCurbP),
    neutral.curbCenter.position, sourceTolerance,
  'source neutral point P');
  planarNear(sourcePointToNeutralFront(plate.rasterPointerTip),
    neutral.pointerTip.position, sourceTolerance,
  'source regulator pointer');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 318 spring is continuous from the rotating staff through P to fixed stud R', () => {
  const model = createMovementModel(catalog.movements[317]);
  const {
    baselinePolarAtArcLength,
    geometry,
    spiralArcLengthAtParameter,
    stateAtTime,
  } = model.root.userData;

  near(spiralArcLengthAtParameter(0), 0, 0,
    'inner spring arc origin');
  near(spiralArcLengthAtParameter(1), geometry.innerSpiralLength,
    4e-15, 'inner spiral exact arc length');
  const join = baselinePolarAtArcLength(geometry.innerSpiralLength);
  near(join.radius, geometry.springOuterRadius, 0,
    'spiral joins terminal coil at fixed radius');
  near(join.angle, geometry.innerSpiralJoinAngle, 0,
    'spiral join angle');
  const outer = baselinePolarAtArcLength(geometry.totalSpringLength);
  near(outer.radius, geometry.springOuterRadius, 0,
    'terminal coil radius');
  near(outer.angle, geometry.outerStudAngle, 4e-15,
    'terminal coil ends at stud R');

  for (const time of [0, 1.31, 5, 8.77, 15, 19.61]) {
    const state = stateAtTime(time);
    const innerPoint = state.springPointAtArcLength(0);
    const curbPoint = state.springPointAtArcLength(
      state.activeSpringLength,
    );
    const outerPoint = state.springPointAtArcLength(
      geometry.totalSpringLength,
    );
    vectorNear(innerPoint.position,
      state.springInnerAttachment.position, 2e-15,
    `inner attachment at ${time}`);
    vectorNear(curbPoint.position, state.curbCenter.position, 4e-14,
      `spring passes exactly between curb pins at ${time}`);
    vectorNear(outerPoint.position, state.fixedOuterStud.position,
      2e-15, `outer attachment remains fixed at ${time}`);
    near(curbPoint.elasticTwist, 0, 2e-15,
      `neutral point P has no elastic twist at ${time}`);
    assert.equal(outerPoint.active, false);
    assert.equal(innerPoint.active, true);
    const justInside = state.springPointAtArcLength(
      state.activeSpringLength - 1e-8,
    );
    const justOutside = state.springPointAtArcLength(
      state.activeSpringLength + 1e-8,
    );
    assert.ok(justInside.position.distanceTo(justOutside.position) < 3e-8,
      `spring is position-continuous through P at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 318 curb position, active length, stiffness, and natural frequency obey one exact law', () => {
  const model = createMovementModel(catalog.movements[317]);
  const { geometry, massModel, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 32768; sample += 1) {
    const time = geometry.adjustmentCyclePeriod * sample / 32768;
    const state = stateAtTime(time);
    const lengthFromCurbAngle = geometry.innerSpiralLength
      + geometry.springOuterRadius * (
        geometry.innerSpiralJoinAngle - state.curbAngle
      );
    near(state.activeSpringLength, lengthFromCurbAngle, 4e-15,
      `curb-selected active length at ${sample}`);
    near(state.springStiffness,
      massModel.spring.referenceStiffness
        * geometry.referenceActiveLength / state.activeSpringLength,
    2e-13, `inverse-length stiffness at ${sample}`);
    near(state.naturalAngularFrequency,
      Math.sqrt(state.springStiffness / massModel.balance.inertia),
    9e-16, `physical natural frequency at ${sample}`);
    near(state.naturalAngularFrequency,
      geometry.referenceBalanceAngularFrequency * state.frequencyRatio,
    9e-16, `rate ratio at ${sample}`);
    near(state.activeSpringLength * state.frequencyRatio ** 2,
      geometry.referenceActiveLength, 5e-15,
    `length-frequency invariant at ${sample}`);
    assert.ok(state.activeSpringLength > geometry.innerSpiralLength,
      `P stays on terminal coil at ${sample}`);
    assert.ok(state.activeSpringLength < geometry.totalSpringLength,
      `P remains before R at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 318 moves right for FAST and left for SLOW with visibly different vibration rates', () => {
  const model = createMovementModel(catalog.movements[317]);
  const { canonicalTimes, geometry, stateAtTime } = model.root.userData;
  const neutral = stateAtTime(canonicalTimes.neutralRising);
  const fast = stateAtTime(canonicalTimes.fast);
  const slow = stateAtTime(canonicalTimes.slow);

  assert.equal(neutral.regulatorSetting, 'neutral');
  assert.equal(fast.regulatorSetting,
    'toward-fast-shorter-active-spring');
  assert.equal(slow.regulatorSetting,
    'toward-slow-longer-active-spring');
  assert.ok(fast.regulatorAngle > 0);
  assert.ok(slow.regulatorAngle < 0);
  assert.ok(fast.pointerTip.position.x > 0,
    'FAST is right on Brown’s scale');
  assert.ok(slow.pointerTip.position.x < 0,
    'SLOW is left on Brown’s scale');
  assert.ok(fast.activeSpringLength < neutral.activeSpringLength);
  assert.ok(slow.activeSpringLength > neutral.activeSpringLength);
  assert.ok(fast.springStiffness > neutral.springStiffness);
  assert.ok(slow.springStiffness < neutral.springStiffness);
  near(fast.frequencyRatio, 1 + geometry.frequencyExcursion, 0,
    'fast rate');
  near(slow.frequencyRatio, 1 - geometry.frequencyExcursion, 0,
    'slow rate');
  assert.ok(fast.naturalAngularFrequency
    > slow.naturalAngularFrequency);

  const comparisonHalfWindow = 1.25;
  const fastPhaseAdvance = stateAtTime(
    canonicalTimes.fast + comparisonHalfWindow,
  ).unwrappedBalancePhase - stateAtTime(
    canonicalTimes.fast - comparisonHalfWindow,
  ).unwrappedBalancePhase;
  const slowPhaseAdvance = stateAtTime(
    canonicalTimes.slow + comparisonHalfWindow,
  ).unwrappedBalancePhase - stateAtTime(
    canonicalTimes.slow - comparisonHalfWindow,
  ).unwrappedBalancePhase;
  assert.ok(fastPhaseAdvance > slowPhaseAdvance,
    'the balance traverses more phase around the FAST dwell');
  disposeModel(model.root);
});

test('movement 318 analytic regulator and balance rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[317]);
  const { stateAtTime } = model.root.userData;
  const epsilon = 1e-5;

  for (const time of [0.37, 2.13, 5.31, 8.77, 12.42, 16.81, 19.33]) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near((after.activeSpringLength - before.activeSpringLength)
        / (2 * epsilon),
      state.activeSpringLengthVelocity, 1e-9,
    `active-length velocity at ${time}`);
    near((after.activeSpringLengthVelocity
        - before.activeSpringLengthVelocity) / (2 * epsilon),
      state.activeSpringLengthAcceleration, 1e-9,
    `active-length acceleration at ${time}`);
    near((after.regulatorAngle - before.regulatorAngle)
        / (2 * epsilon),
      state.regulatorAngularVelocity, 5e-10,
    `regulator velocity at ${time}`);
    near((after.regulatorAngularVelocity
        - before.regulatorAngularVelocity) / (2 * epsilon),
      state.regulatorAngularAcceleration, 2e-10,
    `regulator acceleration at ${time}`);
    near((after.unwrappedBalancePhase - before.unwrappedBalancePhase)
        / (2 * epsilon),
      state.balancePhaseRate, 1e-9,
    `balance phase rate at ${time}`);
    near((after.balanceAngle - before.balanceAngle) / (2 * epsilon),
      state.balanceAngularVelocity, 2e-9,
    `balance velocity at ${time}`);
    near((after.balanceAngularVelocity - before.balanceAngularVelocity)
        / (2 * epsilon),
      state.balanceAngularAcceleration, 8e-9,
    `balance acceleration at ${time}`);
    vectorNear(after.pointerTip.position.clone()
      .sub(before.pointerTip.position).multiplyScalar(1 / (2 * epsilon)),
    state.pointerTip.velocity, 3e-9,
    `pointer velocity at ${time}`);
    vectorNear(after.balanceIndex.velocity.clone()
      .sub(before.balanceIndex.velocity).multiplyScalar(1 / (2 * epsilon)),
    state.balanceIndex.acceleration, 2e-8,
    `balance-index acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 318 renderer binds wheel, lever, curb pins, spring boundary, and fixed stud', () => {
  const model = createMovementModel(catalog.movements[317]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const indexWorld = new THREE.Vector3();
  const pointerWorld = new THREE.Vector3();
  const leftPinWorld = new THREE.Vector3();
  const rightPinWorld = new THREE.Vector3();
  const studWorld = new THREE.Vector3();
  const segmentStart = new THREE.Vector3();
  const segmentEnd = new THREE.Vector3();

  assert.equal(blocks.fixedStudR.parent, model.root);
  assert.equal(blocks.springSegments[0].castShadow, false);
  assert.equal(blocks.springSegments[0].receiveShadow, false);
  assert.equal(model.root.userData.groundFloorY, -5.65);
  assert.ok(model.root.userData.cameraFitBounds.isBox3);
  assert.ok(model.root.userData.cameraFitBounds.max.x > geometry.balanceOuterRadius);

  for (const time of [
    canonicalTimes.neutralRising,
    canonicalTimes.fast,
    canonicalTimes.neutralFalling,
    canonicalTimes.slow,
    canonicalTimes.cycleClosure,
    2.31,
    17.42,
  ]) {
    const expected = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.balanceAssembly.rotation.z, expected.balanceAngle, 0,
      `rendered balance angle at ${time}`);
    near(blocks.regulatorCarrier.rotation.z,
      expected.regulatorAngle, 0,
    `rendered regulator angle at ${time}`);
    blocks.balanceIndex.getWorldPosition(indexWorld);
    blocks.pointer.getWorldPosition(pointerWorld);
    blocks.curbPins[0].getWorldPosition(leftPinWorld);
    blocks.curbPins[1].getWorldPosition(rightPinWorld);
    blocks.fixedStudR.getWorldPosition(studWorld);
    vectorNear(indexWorld, expected.balanceIndex.position, 2e-15,
      `rendered balance index at ${time}`);
    vectorNear(pointerWorld, expected.pointerTip.position, 2e-15,
      `rendered pointer at ${time}`);
    vectorNear(leftPinWorld.clone().add(rightPinWorld)
      .multiplyScalar(0.5), expected.curbCenter.position, 3e-15,
    `rendered neutral point P at ${time}`);
    vectorNear(studWorld, expected.fixedOuterStud.position, 0,
      `rendered fixed stud R at ${time}`);

    let activeCount = 0;
    let inactiveCount = 0;
    for (const index of [0, 40, 100, 153, 165, 179]) {
      const segment = blocks.springSegments[index];
      const startState = expected.springPointAtArcLength(
        blocks.springSamples[index].arcLength,
      );
      const endState = expected.springPointAtArcLength(
        blocks.springSamples[index + 1].arcLength,
      );
      segmentStart.set(0, -0.5, 0).applyMatrix4(segment.matrixWorld);
      segmentEnd.set(0, 0.5, 0).applyMatrix4(segment.matrixWorld);
      vectorNear(segmentStart, startState.position, 3e-15,
        `spring segment ${index} start at ${time}`);
      vectorNear(segmentEnd, endState.position, 3e-15,
        `spring segment ${index} end at ${time}`);
    }
    for (const segment of blocks.springSegments) {
      if (segment.userData.active) activeCount += 1;
      else inactiveCount += 1;
    }
    assert.ok(activeCount > 150,
      `most spring is active at ${time}`);
    assert.ok(inactiveCount > 0,
      `outer section beyond P is inactive at ${time}`);
    near(model.root.userData.regulatorState.activeSpringLength,
      expected.activeSpringLength, 0,
    `published active length at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 318 closes one regulator cycle and ten balance vibrations before movement 339', () => {
  const model = createMovementModel(catalog.movements[317]);
  const {
    animationTiming,
    canonicalTimes,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);

  assert.equal(animationTiming.authoredCyclePeriod, 20);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(timeline.demonstrationPeriod,
    geometry.adjustmentCyclePeriod);
  near(closure.unwrappedAdjustmentAngle - start.unwrappedAdjustmentAngle,
    Math.PI * 2, 0, 'one regulator cycle');
  near((closure.unwrappedBalancePhase - start.unwrappedBalancePhase)
      / (Math.PI * 2),
    geometry.balanceCyclesPerAdjustmentCycle, 0,
  'ten balance vibrations');
  near(closure.regulatorAngle, start.regulatorAngle, 0,
    'regulator closure');
  near(closure.balanceAngle, start.balanceAngle, 0,
    'balance closure');
  vectorNear(closure.curbCenter.position, start.curbCenter.position, 0,
    'curb closure');
  vectorNear(closure.springInnerAttachment.position,
    start.springInnerAttachment.position, 0,
  'inner spring closure');
  assert.deepEqual(timeline.schedule, [
    'neutral-source-setting-with-inner-spring-flexing',
    'lever-and-curb-pins-move-right-toward-FAST',
    'shorter-active-spring-increases-balance-frequency',
    'lever-crosses-neutral-and-moves-left-toward-SLOW',
    'longer-active-spring-decreases-balance-frequency',
    'ten-balance-vibrations-and-one-regulator-cycle-close-exactly',
  ]);

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
