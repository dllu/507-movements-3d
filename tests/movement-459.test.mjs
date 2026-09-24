import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const ARCHETYPE =
  'wind-wheel-rocking-worm-two-opposed-worm-wheels-one-rope-two-buckets-and-trip-tappet-reversal';
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

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 459 contains the wind rotor, one rocking worm, two coaxial wheel-pulley assemblies, one rope, two buckets, and one trip tappet', () => {
  const movement = catalog.movements[458];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 459);
  assert.equal(movement.number, '459');
  assert.equal(movement.title, 'Reciprocating lift for wells');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.windRotor.parent, model.root);
  assert.equal(blocks.flexibleCoupling.parent, model.root);
  assert.equal(blocks.wormCarrier.parent, model.root);
  assert.equal(blocks.worm.parent, blocks.wormCarrier);
  assert.equal(blocks.leftAssembly.gear.parent, model.root);
  assert.equal(blocks.leftAssembly.pulley.parent, model.root);
  assert.equal(blocks.rightAssembly.gear.parent, model.root);
  assert.equal(blocks.rightAssembly.pulley.parent, model.root);
  assert.equal(blocks.continuousRope.parent, model.root);
  assert.equal(blocks.leftUpperArc.parent, blocks.continuousRope);
  assert.equal(blocks.rightUpperArc.parent, blocks.continuousRope);
  assert.equal(blocks.leftRopeLeg.parent, blocks.continuousRope);
  assert.equal(blocks.rightRopeLeg.parent, blocks.continuousRope);
  assert.equal(blocks.leftBucket.bucket.parent, model.root);
  assert.equal(blocks.rightBucket.bucket.parent, model.root);
  assert.equal(blocks.tappet.parent, model.root);
  assert.equal(blocks.selectorLink.parent, model.root);
  assert.equal(geometry.wheelTeeth, 12);
  assert.equal(geometry.wormStarts, 1);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.bucketMotionIndependent, false);
  assert.equal(degreesOfFreedom.pulleyRotationIndependent, false);
  assert.equal(degreesOfFreedom.selectorIndependent, false);
  assert.equal(degreesOfFreedom.tappetIndependent, false);
  assert.equal(degreesOfFreedom.wormWheelRotationIndependent, false);

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.equal(roles.filter((role) =>
    /worm-wheel-on-common-axis-with-rope-pulley/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /rope-pulley-rigidly-coaxial-with-worm-wheel/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /bucket-pivoted-at-the-rope-end/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    role === 'one-continuous-rope-over-two-coaxially-driven-pulleys-with-two-bucket-ends').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'single-start-spiral-alternately-meshing-one-worm-wheel-at-a-time').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'central-vibrating-tappet-struck-by-each-ascending-bucket').length, 1);
  assert.equal(roles.some((role) => /tracer|marker|bead|sphere/i.test(role)),
    false, 'no decorative moving rope markers');
  disposeModel(model.root);
});

test('movement 459 source record preserves Brown’s six-part automatic reversing chain without inventing animation timing', () => {
  const movement = catalog.movements[458];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate459;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_459.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /horizontal wind-wheel/);
  assert.match(movement.description, /shaft which carries spiral thread/);
  assert.match(movement.description, /act on one worm-wheel at a time/);
  assert.match(movement.description, /pulleys over which passes rope/);
  assert.match(movement.description, /bucket at each extremity/);
  assert.match(movement.description, /vibrating tappet.*bucket strikes/);
  assert.match(movement.description, /traverses spiral from one wheel to other/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(sourceAnimation.sourcePrescribedNormalizedTiming, false);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence,
    /horizontal wind rotor.*vertical coupled spiral.*two equal side-by-side toothed wheels.*elevated left bucket dumping/);
  assert.match(evidence.reconstructionDisclosure,
    /no tooth count, worm pitch or hand.*12:1 single-start worm ratio.*independently engineered/);
  assert.match(dynamics.driveModel,
    /one constant rate.*exact 12:1 ratio.*turns freely/);
  assert.match(dynamics.tripModel,
    /rising full bucket strikes the low end of the rocking tappet.*pushes it.*throws the worm across/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateWindWheelCenterPixels, [273, 56]);
  assert.deepEqual(plate.approximateLeftWheelCenterPixels, [226, 190]);
  assert.deepEqual(plate.approximateTappetPivotPixels, [274, 319]);
  assert.deepEqual(plate.approximateLeftBucketCenterPixels, [214, 370]);
  disposeModel(model.root);
});

test('movement 459 source pose places the full left bucket at its tappet and the empty right bucket at the well', () => {
  const model = createMovementModel(catalog.movements[458]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  assert.equal(sourcePose.mode,
    'left-full-bucket-strikes-tappet-and-drives-worm-off-left-wheel');
  assert.equal(sourcePose.engagedWheel, 'left');
  near(sourcePose.leftBailY, geometry.highBailY, 0,
    'left bucket high');
  near(sourcePose.rightBailY, geometry.lowBailY, 0,
    'right bucket low');
  near(sourcePose.leftWaterFraction, 1, 0, 'left bucket full');
  near(sourcePose.rightWaterFraction, 0, 0, 'right bucket empty');
  near(source.selectorX, -geometry.engagementShift, 0,
    'worm initially at left release position');
  near(source.tappetLeftTip.y, source.leftBailY, 2e-16,
    'ascending left bucket reaches low tappet end');
  assert.ok(source.tappetRightTip.y > source.tappetLeftTip.y);
  near(source.leftBucketPivot.y, source.leftBailY, 0,
    'rope joins left bucket handle pivot');
  near(source.rightBucketPivot.y, source.rightBailY, 0,
    'rope joins right bucket handle pivot');
  disposeModel(model.root);
});

test('movement 459 alternates contact-driven trips, free crossings, and right and left full-bucket lifts', () => {
  const model = createMovementModel(catalog.movements[458]);
  const { geometry, stateAtInputAngle, timeline } = model.root.userData;
  const atPhase = (phase) => stateAtInputAngle(FULL_TURN * phase);
  const freeMiddle = (timeline.leavePhaseEnd + timeline.freePhaseEnd) / 2;
  const leftDump = atPhase(freeMiddle);
  const rightLift = atPhase(0.30);
  const rightDump = atPhase(0.5 + freeMiddle);
  const leftLift = atPhase(0.80);

  assert.equal(atPhase(timeline.leavePhaseEnd / 2).mode,
    'left-full-bucket-strikes-tappet-and-drives-worm-off-left-wheel');
  assert.equal(atPhase(timeline.leavePhaseEnd / 2).engagedWheel, 'left');
  assert.equal(leftDump.mode,
    'left-high-bucket-dumps-and-trips-worm-toward-right-wheel');
  assert.equal(leftDump.engagedWheel, null);
  near(leftDump.ropeSpeed, 0, 0, 'rope held while the worm crosses');
  near(leftDump.selectorX, 0, 2e-16, 'worm crossing center');
  assert.ok(leftDump.leftBucketTilt < -0.7 * geometry.maximumBucketTilt,
    'left bucket tipping outward');
  assert.ok(leftDump.leftWaterFraction < 0.9 && leftDump.rightWaterFraction > 0.1);

  assert.equal(rightLift.mode,
    'right-worm-wheel-raises-right-full-bucket-and-lowers-left-empty-bucket');
  assert.equal(rightLift.engagedWheel, 'right');
  assert.ok(rightLift.ropeSpeed > 0);
  assert.ok(rightLift.rightBucketVelocityY > 0);
  assert.ok(rightLift.leftBucketVelocityY < 0);
  near(rightLift.leftWaterFraction, 0, 0, 'left empty while descending');
  near(rightLift.rightWaterFraction, 1, 0, 'right full while rising');

  assert.equal(rightDump.mode,
    'right-high-bucket-dumps-and-trips-worm-toward-left-wheel');
  assert.equal(rightDump.engagedWheel, null);
  near(rightDump.ropeSpeed, 0, 0, 'rope held for right dump');
  near(rightDump.selectorX, 0, 2e-16, 'worm returning through center');
  assert.ok(rightDump.rightBucketTilt > 0.7 * geometry.maximumBucketTilt,
    'right bucket tipping outward');

  assert.equal(leftLift.mode,
    'left-worm-wheel-raises-left-full-bucket-and-lowers-right-empty-bucket');
  assert.equal(leftLift.engagedWheel, 'left');
  assert.ok(leftLift.ropeSpeed < 0);
  assert.ok(leftLift.leftBucketVelocityY > 0);
  assert.ok(leftLift.rightBucketVelocityY < 0);
  near(leftLift.leftWaterFraction, 1, 0, 'left full while rising');
  near(leftLift.rightWaterFraction, 0, 0, 'right empty while descending');
  assert.equal(timeline.stages.length, 6);
  disposeModel(model.root);
});

test('movement 459 one rope remains constant-length and makes the bucket ends exactly opposed', () => {
  const model = createMovementModel(catalog.movements[458]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);
  const bailSum = source.leftBailY + source.rightBailY;
  for (let sample = 0; sample < 20000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    near(state.leftVerticalLength + state.fixedRopeLength
      + state.rightVerticalLength, geometry.totalRopeLength, 3e-15,
    `rope segment sum at ${sample}`);
    near(state.totalRopeLength, geometry.totalRopeLength, 3e-15,
      `reported rope length at ${sample}`);
    near(state.leftBailY + state.rightBailY, bailSum, 5e-16,
      `opposed endpoints at ${sample}`);
    near(state.leftBucketVelocityY + state.rightBucketVelocityY, 0, 0,
      `opposed endpoint speed at ${sample}`);
    near(state.pulleyAngle,
      state.ropeDisplacement / geometry.pulleyRadius, 0,
    `no-slip pulley angle at ${sample}`);
    near(state.pulleyAngularSpeed,
      state.ropeSpeed / geometry.pulleyRadius, 0,
    `no-slip pulley speed at ${sample}`);
    near(state.pulleyAngularAcceleration,
      state.ropeAcceleration / geometry.pulleyRadius, 0,
    `no-slip pulley acceleration at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 459 rocking carrier selects exactly one worm wheel and leaves positive clearance to the other', () => {
  const model = createMovementModel(catalog.movements[458]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  for (const phase of [0.11, 0.19, 0.31, 0.49]) {
    const state = stateAtInputAngle(FULL_TURN * phase);
    assert.equal(state.engagedWheel, 'right');
    near(state.selectorX, geometry.engagementShift, 0,
      `right selector at ${phase}`);
    near(state.carrierAngle, geometry.engagedCarrierAngle, 0,
      `right carrier tilt at ${phase}`);
    near(state.rightMeshClearance, 0, 6e-17,
      `right contact at ${phase}`);
    near(state.activeContactClearance, 0, 6e-17,
      `active right contact at ${phase}`);
    near(state.leftMeshClearance, 2 * geometry.engagementShift, 2e-16,
      `left disengagement at ${phase}`);
  }
  for (const phase of [0.61, 0.69, 0.81, 0.99]) {
    const state = stateAtInputAngle(FULL_TURN * phase);
    assert.equal(state.engagedWheel, 'left');
    near(state.selectorX, -geometry.engagementShift, 0,
      `left selector at ${phase}`);
    near(state.carrierAngle, -geometry.engagedCarrierAngle, 0,
      `left carrier tilt at ${phase}`);
    near(state.leftMeshClearance, 0, 6e-17,
      `left contact at ${phase}`);
    near(state.activeContactClearance, 0, 6e-17,
      `active left contact at ${phase}`);
    near(state.rightMeshClearance, 2 * geometry.engagementShift, 2e-16,
      `right disengagement at ${phase}`);
  }
  for (const phase of [0.05, 0.55]) {
    const state = stateAtInputAngle(FULL_TURN * phase);
    assert.equal(state.engagedWheel, null);
    assert.equal(state.activeContactClearance, null);
    assert.ok(state.leftMeshClearance > 0.07);
    assert.ok(state.rightMeshClearance > 0.07);
  }
  disposeModel(model.root);
});

test('movement 459 obeys the single-start worm ratio and pitch-line velocity in either selected direction', () => {
  const model = createMovementModel(catalog.movements[458]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  near(geometry.axialPitch,
    FULL_TURN * geometry.wheelPitchRadius / geometry.wheelTeeth, 0,
  'worm axial pitch matches wheel circular pitch');
  // Half a pulley turn per lift lowers the bucket into the well past
  // Brown's ground line: six worm turns per lift.
  near(geometry.wormTurnsPerLift, 6, 1e-15, 'six worm turns per lift');
  // Twelve driven turns plus two half-turn free crossings.
  near(geometry.wormTurnsPerCycle, 13, 2e-15, 'integer cycle closure');

  for (let sample = 0; sample < 16000; sample += 1) {
    const phase = sample / 16000;
    const state = stateAtInputAngle(FULL_TURN * phase);
    near(state.wormAngularSpeed,
      geometry.wormTravelPerCycle * geometry.inputAngularSpeed / FULL_TURN, 0,
      `wind wheel turns at one constant rate at ${sample}`);
    if (state.engagedWheel) {
      near(state.meshPhaseInvariant, 0, 5e-14, // angles up to 26*pi
        `worm mesh phase at ${sample}`);
      near(state.wormThreadAxialSpeed,
        state.engagedWheelContactTangentialSpeed, 7e-15,
      `pitch-line velocity at ${sample}`);
      const expectedWormSpeed = state.engagedWheel === 'right'
        ? geometry.wheelTeeth * state.pulleyAngularSpeed
        : -geometry.wheelTeeth * state.pulleyAngularSpeed;
      near(state.wormAngularSpeed, expectedWormSpeed, 4e-15,
        `worm ratio at ${sample}`);
    } else {
      near(state.pulleyAngularSpeed, 0, 0,
        `rope held while the worm crosses at ${sample}`);
      const reach = geometry.pinReach + geometry.threadReach;
      assert.ok(state.leftMeshClearance > reach
        && state.rightMeshClearance > reach,
      `turning thread clears both pin rings at ${sample}`);
    }
  }
  const closure = stateAtInputAngle(FULL_TURN - 1e-12);
  near(THREE.MathUtils.euclideanModulo(closure.wormAngle + Math.PI, FULL_TURN)
    - Math.PI, 0, 2e-11, 'worm returns to its angular datum after 13 turns'); // constant-rate worm 1e-12 short of the period
  disposeModel(model.root);
});

test('movement 459 each rising bucket drives the tappet off its wheel, and selector, dumping and water stay continuous', () => {
  const model = createMovementModel(catalog.movements[458]);
  const { geometry, stateAtInputAngle, timeline } = model.root.userData;
  const atPhase = (phase) => stateAtInputAngle(FULL_TURN * phase);
  // The bucket strikes the tappet and pushes it until the thread leaves
  // the pins: tappet tip and bail stay together while that wheel drives.
  for (let sample = 0; sample <= 200; sample += 1) {
    const u = timeline.leavePhaseEnd * sample / 201;
    const left = atPhase(u);
    const right = atPhase(0.5 + u);
    near(left.tappetLeftTip.y, left.leftBailY, 2e-15, `left push at ${u}`);
    near(right.tappetRightTip.y, right.rightBailY, 2e-15, `right push at ${u}`);
    assert.equal(left.engagedWheel, 'left');
    assert.equal(right.engagedWheel, 'right');
  }
  // The selector is C1 through the push, the free crossing and the take-up.
  for (const boundary of [timeline.leavePhaseEnd, timeline.freePhaseEnd,
    timeline.enterPhaseEnd, 0.5 + timeline.leavePhaseEnd,
    0.5 + timeline.freePhaseEnd, 0.5 + timeline.enterPhaseEnd]) {
    const before = atPhase(boundary - 1e-10);
    const after = atPhase(boundary + 1e-10);
    near(after.selectorX, before.selectorX, 1e-9, `selector at ${boundary}`);
    near(after.selectorSpeed, before.selectorSpeed, 1e-6,
      `selector speed at ${boundary}`);
  }
  for (const phase of [0, 0.1, 0.5, 0.6]) {
    const state = atPhase(phase);
    near(state.leftWaterFractionRate, 0, 3e-14,
      `left water flow stationary at phase ${phase}`);
    near(state.rightWaterFractionRate, 0, 3e-14,
      `right water flow stationary at phase ${phase}`);
    near(state.leftWaterFractionAcceleration, 0, 5e-12,
      `left water C2 at phase ${phase}`);
    near(state.rightWaterFractionAcceleration, 0, 5e-12,
      `right water C2 at phase ${phase}`);
  }
  for (const [phase, side] of [[0.05, 'left'], [0.55, 'right']]) {
    const state = atPhase(phase);
    near(state[`${side}BucketTiltSpeed`], 0, 4e-14,
      `${side} bucket stops at maximum tip`);
    near(state[`${side}BucketTiltAcceleration`], 0, 2e-11,
      `${side} bucket tip is C2 at midpoint`);
  }
  assert.ok(timeline.enterPhaseEnd < geometry.exchangeLeftEndPhase);
  disposeModel(model.root);
});

test('movement 459 analytic rope and carrier derivatives agree with finite differences', () => {
  const model = createMovementModel(catalog.movements[458]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const step = 1e-6;
  for (const angle of [0.19, 0.46, 1.72, 2.47, 3.31, 3.56, 4.62, 5.48]) {
    const before = stateAtInputAngle(angle - step);
    const state = stateAtInputAngle(angle);
    const after = stateAtInputAngle(angle + step);
    const numericRopeSpeed = (after.ropeDisplacement
      - before.ropeDisplacement) * geometry.inputAngularSpeed / (2 * step);
    const numericRopeAcceleration = (after.ropeSpeed
      - before.ropeSpeed) * geometry.inputAngularSpeed / (2 * step);
    const numericSelectorSpeed = (after.selectorX - before.selectorX)
      * geometry.inputAngularSpeed / (2 * step);
    const numericCarrierSpeed = (after.carrierAngle - before.carrierAngle)
      * geometry.inputAngularSpeed / (2 * step);
    const numericCarrierAcceleration = (after.carrierAngularSpeed
      - before.carrierAngularSpeed) * geometry.inputAngularSpeed
      / (2 * step);
    near(state.ropeSpeed, numericRopeSpeed, 3e-9,
      `rope velocity at ${angle}`);
    near(state.ropeAcceleration, numericRopeAcceleration, 3e-8,
      `rope acceleration at ${angle}`);
    near(state.selectorSpeed, numericSelectorSpeed, 5e-10,
      `selector velocity at ${angle}`);
    near(state.carrierAngularSpeed, numericCarrierSpeed, 5e-10,
      `carrier angular velocity at ${angle}`);
    // Central differences (step 1e-6) of the steeper take-up selector.
    near(state.carrierAngularAcceleration,
      numericCarrierAcceleration, 5e-9,
    `carrier angular acceleration at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 459 renderer maps the reversing state while fixed wheel axes and frame remain stationary', () => {
  const model = createMovementModel(catalog.movements[458]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [blocks.base, blocks.support, blocks.flexibleCoupling,
    blocks.leftAssembly.gear, blocks.leftAssembly.pulley,
    blocks.rightAssembly.gear, blocks.rightAssembly.pulley,
    blocks.tappetPivotAxle, blocks.well, blocks.wellWater];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());
  const wheelPhase = Math.PI / (2 * geometry.wheelTeeth);

  for (const phase of [0, 0.05, 0.1, 0.3, 0.5, 0.55, 0.6, 0.8, 1]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    near(blocks.windRotor.rotation.y, state.wormAngle, 0,
      `wind rotor at ${phase}`);
    near(blocks.wormCarrier.rotation.z, state.carrierAngle, 0,
      `worm carrier at ${phase}`);
    near(blocks.worm.userData.rotor.rotation.z, state.wormAngle, 0,
      `worm rotation at ${phase}`);
    // Each pin ring is phased to the thread it is taken up by.
    near(blocks.leftAssembly.gear.userData.rotor.rotation.z,
      wheelPhase + state.pulleyAngle - geometry.leftMeshPhase / geometry.wheelTeeth, 2e-16,
    `left wheel at ${phase}`);
    near(blocks.rightAssembly.gear.userData.rotor.rotation.z,
      wheelPhase + state.pulleyAngle + geometry.rightMeshPhase / geometry.wheelTeeth, 2e-16,
    `right wheel at ${phase}`);
    near(blocks.leftAssembly.pulley.userData.rotor.rotation.z,
      state.pulleyAngle, 0, `left pulley at ${phase}`);
    near(blocks.rightAssembly.pulley.userData.rotor.rotation.z,
      state.pulleyAngle, 0, `right pulley at ${phase}`);
    vectorNear(blocks.leftBucket.bucket.position,
      state.leftBucketPivot, 0, `left bucket pivot at ${phase}`);
    vectorNear(blocks.rightBucket.bucket.position,
      state.rightBucketPivot, 0, `right bucket pivot at ${phase}`);
    near(blocks.leftBucket.bucket.rotation.z, state.leftBucketTilt, 0,
      `left bucket tilt at ${phase}`);
    near(blocks.rightBucket.bucket.rotation.z, state.rightBucketTilt, 0,
      `right bucket tilt at ${phase}`);
    near(blocks.leftBucket.water.rotation.z,
      -state.leftBucketTilt, 0, `left water remains level at ${phase}`);
    near(blocks.rightBucket.water.rotation.z,
      -state.rightBucketTilt, 0, `right water remains level at ${phase}`);
    near(blocks.tappet.rotation.z, state.tappetAngle, 0,
      `tappet angle at ${phase}`);
    vectorNear(blocks.selectorBearing.position,
      state.lowerBearing, 0, `selector bearing at ${phase}`);
    near(blocks.leftRopeLeg.scale.y, state.leftVerticalLength, 5e-16,
      `left rope leg at ${phase}`);
    near(blocks.rightRopeLeg.scale.y, state.rightVerticalLength, 5e-16,
      `right rope leg at ${phase}`);
    model.root.updateMatrixWorld(true);
    const leftBodyCenter = blocks.leftBucket.body.getWorldPosition(
      new THREE.Vector3(),
    );
    const rightBodyCenter = blocks.rightBucket.body.getWorldPosition(
      new THREE.Vector3(),
    );
    vectorNear(leftBodyCenter, state.leftBucketCenter, 5e-16,
      `left body center at ${phase}`);
    vectorNear(rightBodyCenter, state.rightBucketCenter, 5e-16,
      `right body center at ${phase}`);
    fixedBlocks.forEach((block, index) => vectorNear(
      block.position,
      fixedPositions[index],
      0,
      `fixed apparatus at ${phase}`,
    ));
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  near(closure.ropeDisplacement, source.ropeDisplacement, 0,
    'rope cycle closure');
  near(THREE.MathUtils.euclideanModulo(geometry.wormTravelPerCycle, FULL_TURN),
    0, 2e-14, 'worm geometry closes after an integer turn count');
  disposeModel(model.root);
});

test('movement 459 has finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement459 = catalog.movements[458];
  const movement507 = catalog.movements[506];
  const model459 = createMovementModel(movement459);
  const model507 = createMovementModel(movement507);
  model459.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model459.root);

  for (const value of [bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z]) assert.ok(Number.isFinite(value));
  assert.ok(bounds.max.x > bounds.min.x);
  assert.ok(bounds.max.y > bounds.min.y);
  assert.ok(bounds.max.z > bounds.min.z);
  assert.equal(movement459.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model459.root);
  disposeModel(model507.root);
});
