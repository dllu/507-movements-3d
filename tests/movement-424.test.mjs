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
  'oblong-square-cylinder-with-horizontal-frame-piston-containing-vertical-piston-directly-on-crank-wrist';
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

function sameAngle(actual, expected, tolerance, message) {
  near(Math.sin(actual), Math.sin(expected), tolerance, `${message} sine`);
  near(Math.cos(actual), Math.cos(expected), tolerance, `${message} cosine`);
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

test('movement 424 nests horizontally sliding frame piston B and vertically sliding piston C inside fixed A', () => {
  const movement = catalog.movements[423];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 424);
  assert.equal(movement.number, '424');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /Fixed oblong-square cylinder A/);
  assert.match(data.mechanism, /frame piston B.*translates horizontally/);
  assert.match(data.mechanism, /piston C.*translates vertically relative to B/);
  assert.match(data.mechanism, /wrist a is rigidly attached.*center of C/);
  assert.match(data.mechanism, /cannot reach a dead point together/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.pistonBHorizontalPositionIndependent, false);
  assert.equal(degreesOfFreedom.pistonCVerticalPositionWithinBIndependent,
    false);
  assert.equal(blocks.cylinderA.parent, model.root);
  assert.equal(blocks.pistonB.parent, model.root);
  assert.equal(blocks.pistonC.parent, model.root);
  assert.equal(blocks.pistonBTopWall.parent, blocks.pistonB);
  assert.equal(blocks.pistonBBottomWall.parent, blocks.pistonB);
  assert.equal(blocks.pistonCBody.parent, blocks.pistonC);
  assert.equal(blocks.pistonCWristBearing.parent, blocks.pistonC);
  assert.equal(blocks.crankWristA.parent, blocks.crankRotor);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'fixed-oblong-square-cylinder-A',
    'horizontally-sliding-square-frame-piston-B',
    'vertically-sliding-piston-C-nested-within-B',
    'single-crank-wrist-a-directly-driving-piston-C',
    'fixed-axis-main-shaft-b',
    'fixed-left-steam-port-for-horizontal-piston-B',
    'fixed-right-steam-port-for-horizontal-piston-B',
    'fixed-top-steam-port-for-vertical-piston-C',
    'fixed-bottom-steam-port-for-vertical-piston-C',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 424 records Root’s A–C description and exact four-part official Canvas dimensions', () => {
  const movement = catalog.movements[423];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate424;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_424.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /“cylinder,” A.*oblong square/);
  assert.match(movement.description, /two pistons, B and C/);
  assert.match(movement.description, /former working horizontally/);
  assert.match(movement.description, /latter working vertically within it/);
  assert.match(movement.description, /wrist, a.*main shaft, b/);
  assert.match(movement.description, /without dead points/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.officialCanvasCyclePeriod, 4);
  assert.equal(sourceAnimation.officialCanvasCyclesPerMinute, 15);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(
    dynamics.pressureExpansionCutoffExhaustLeakageFrictionInertiaAndLoadsModeled,
    false,
  );
  assert.match(dynamics.portIndicationLaw, /Brown supplies no valve gear/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.crankMainShaftBApproximatePixels, [260, 286]);
  assert.deepEqual(plate.crankWristAApproximatePixels, [308, 321]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.officialCanvasEvidence,
    /A inner half-dimensions \(16\.5,11\.5\)/);
  assert.match(evidence.officialCanvasEvidence,
    /B outer half-dimensions \(11\.5,11\.5\)/);
  assert.match(evidence.officialCanvasEvidence,
    /C center=\(4\*cos\(inputAngle\),4\*sin\(inputAngle\)\)/);
  assert.match(evidence.reconstructionDisclosure,
    /no absolute scale.*port timing.*pressure cycle/);
  disposeModel(model.root);
});

test('movement 424 reproduces the official component dimensions and cardinal source poses after one uniform scale', () => {
  const model = createMovementModel(catalog.movements[423]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;

  near(geometry.crankRadius,
    geometry.sourceCrankRadius * geometry.sourceScale, 0,
    'scaled source crank radius');
  near(geometry.cylinderInnerHalfWidth,
    geometry.sourceCylinderInnerHalfWidth * geometry.sourceScale, 0,
    'scaled A half-width');
  near(geometry.cylinderInnerHalfHeight,
    geometry.sourceCylinderInnerHalfHeight * geometry.sourceScale, 0,
    'scaled A half-height');
  near(geometry.pistonBOuterHalfWidth,
    geometry.sourcePistonBOuterHalfWidth * geometry.sourceScale, 0,
    'scaled B outer half-width');
  near(geometry.pistonBInnerHalfHeight,
    geometry.sourcePistonBInnerHalfHeight * geometry.sourceScale, 0,
    'scaled B inner half-height');
  near(geometry.pistonCHalfWidth,
    geometry.sourcePistonCHalfWidth * geometry.sourceScale, 0,
    'scaled C half-width');
  near(geometry.pistonCHalfHeight,
    geometry.sourcePistonCHalfHeight * geometry.sourceScale, 0,
    'scaled C half-height');

  const right = stateAtInputAngle(0);
  const top = stateAtInputAngle(Math.PI / 2);
  const left = stateAtInputAngle(Math.PI);
  const bottom = stateAtInputAngle(Math.PI * 3 / 2);
  vectorNear(right.crankPin,
    new THREE.Vector3(geometry.crankRadius, 0, 0), 0,
    'right wrist pose');
  vectorNear(top.crankPin,
    new THREE.Vector3(0, geometry.crankRadius, 0), 6e-17,
    'top wrist pose');
  vectorNear(left.crankPin,
    new THREE.Vector3(-geometry.crankRadius, 0, 0), 1.1e-16,
    'left wrist pose');
  vectorNear(bottom.crankPin,
    new THREE.Vector3(0, -geometry.crankRadius, 0), 1.7e-16,
    'bottom wrist pose');
  vectorNear(sourcePose.crankPin, right.crankPin, 0,
    'recorded source crank pose');
  vectorNear(sourcePose.pistonBCenter, right.pistonBCenter, 0,
    'recorded source B pose');
  vectorNear(sourcePose.pistonCCenter, right.pistonCCenter, 0,
    'recorded source C pose');
  disposeModel(model.root);
});

test('movement 424 maintains exact orthogonal nesting and positive end clearances throughout the crank circle', () => {
  const model = createMovementModel(catalog.movements[423]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let minimumBLeftClearance = Infinity;
  let minimumBRightClearance = Infinity;
  let minimumCBottomClearance = Infinity;
  let minimumCTopClearance = Infinity;

  for (let sample = -60000; sample <= 120000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 60000);
    near(state.crankPinCircleResidual, 0, 3.4e-16,
      'crank circle');
    near(state.pistonBHorizontalClosureResidual, 0, 0,
      'B follows wrist x');
    near(state.pistonCCrankWristClosureResidual, 0, 0,
      'C center is wrist a');
    near(state.pistonCHorizontalNestingResidual, 0, 0,
      'C has no x travel relative to B');
    near(state.pistonCRelativeToB.x, 0, 0,
      'C relative motion is vertical');
    near(state.pistonCCenter.x, state.pistonBCenter.x, 0,
      'B and C share x coordinate');
    minimumBLeftClearance = Math.min(minimumBLeftClearance,
      state.pistonBLeftClearance);
    minimumBRightClearance = Math.min(minimumBRightClearance,
      state.pistonBRightClearance);
    minimumCBottomClearance = Math.min(minimumCBottomClearance,
      state.pistonCBottomClearance);
    minimumCTopClearance = Math.min(minimumCTopClearance,
      state.pistonCTopClearance);
  }
  near(minimumBLeftClearance, geometry.cylinderEndClearance, 5e-16,
    'B left end clearance');
  near(minimumBRightClearance, geometry.cylinderEndClearance, 5e-16,
    'B right end clearance');
  near(minimumCBottomClearance, geometry.pistonCEndClearance, 5e-16,
    'C bottom end clearance');
  near(minimumCTopClearance, geometry.pistonCEndClearance, 5e-16,
    'C top end clearance');
  assert.ok(geometry.cylinderEndClearance > 0);
  assert.ok(geometry.pistonCEndClearance > 0);
  near(geometry.pistonBOuterHalfHeight,
    geometry.cylinderInnerHalfHeight, 0,
    'B seals against A top and bottom');
  near(geometry.pistonCHalfWidth, geometry.pistonBInnerHalfWidth, 0,
    'C seals against B left and right');
  disposeModel(model.root);
});

test('movement 424 analytic B and C kinematics satisfy exact component derivative constraints', () => {
  const model = createMovementModel(catalog.movements[423]);
  const { stateAtInputAngle } = model.root.userData;

  for (let sample = -60000; sample <= 120000; sample += 1) {
    const angle = FULL_TURN * sample / 60000;
    const speed = 1.27 + 0.22 * Math.cos(angle * 0.81);
    const acceleration = -0.31 * Math.sin(angle * 0.63);
    const state = stateAtInputAngle(angle, speed, acceleration);
    near(state.pistonBVelocity.y, 0, 0,
      'B velocity is horizontal');
    near(state.pistonBAcceleration.y, 0, 0,
      'B acceleration is horizontal');
    near(state.pistonCRelativeVelocity.x, 0, 0,
      'C relative velocity is vertical');
    near(state.pistonCRelativeAcceleration.x, 0, 0,
      'C relative acceleration is vertical');
    vectorNear(state.pistonCAbsoluteVelocity,
      state.crankPinVelocity, 0, 'C and wrist absolute velocity');
    vectorNear(state.pistonCAbsoluteAcceleration,
      state.crankPinAcceleration, 0, 'C and wrist absolute acceleration');
    near(state.pistonBVelocity.x, state.crankPinVelocity.x, 0,
      'B takes wrist x velocity');
    near(state.pistonCRelativeVelocity.y, state.crankPinVelocity.y, 0,
      'C takes wrist y velocity relative to B');
  }
  disposeModel(model.root);
});

test('movement 424 analytic crank, B, and C derivatives match finite differences', () => {
  const model = createMovementModel(catalog.movements[423]);
  const { stateAtInputAngle } = model.root.userData;
  const angleStep = 1e-5;

  for (const angle of [0.13, 0.57, 1.04, 1.52, 2.08, 2.61, 3.09,
    3.66, 4.18, 4.72, 5.24, 5.78, 6.11]) {
    const state = stateAtInputAngle(angle);
    const timeStep = angleStep / state.inputSpeed;
    const before = stateAtInputAngle(angle - angleStep);
    const after = stateAtInputAngle(angle + angleStep);
    const numericalCrankVelocity = after.crankPin.clone()
      .sub(before.crankPin)
      .multiplyScalar(1 / (2 * timeStep));
    const numericalCrankAcceleration = after.crankPinVelocity.clone()
      .sub(before.crankPinVelocity)
      .multiplyScalar(1 / (2 * timeStep));
    const numericalBVelocity = after.pistonBCenter.clone()
      .sub(before.pistonBCenter)
      .multiplyScalar(1 / (2 * timeStep));
    const numericalCRelativeVelocity = after.pistonCRelativeToB.clone()
      .sub(before.pistonCRelativeToB)
      .multiplyScalar(1 / (2 * timeStep));
    vectorNear(numericalCrankVelocity, state.crankPinVelocity, 3e-10,
      `crank velocity at ${angle}`);
    vectorNear(numericalCrankAcceleration, state.crankPinAcceleration, 4e-10,
      `crank acceleration at ${angle}`);
    vectorNear(numericalBVelocity, state.pistonBVelocity, 3e-10,
      `B velocity at ${angle}`);
    vectorNear(numericalCRelativeVelocity,
      state.pistonCRelativeVelocity, 3e-10,
      `C relative velocity at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 424 complementary horizontal and vertical moment arms rigorously exclude a crank dead point', () => {
  const model = createMovementModel(catalog.movements[423]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let minimumAvailableTorque = Infinity;

  for (let sample = -100000; sample <= 200000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 100000);
    near(state.horizontalPistonTorqueArm, -state.crankPin.y, 0,
      'horizontal piston moment arm');
    near(state.verticalPistonTorqueArm, state.crankPin.x, 0,
      'vertical piston moment arm');
    near(state.torqueArmNormResidual, 0, 3.4e-16,
      'complementary moment-arm identity');
    near(
      state.horizontalPistonTorqueArm ** 2
        + state.verticalPistonTorqueArm ** 2,
      geometry.crankRadius ** 2,
      4.5e-16,
      'sum of squared moment arms',
    );
    minimumAvailableTorque = Math.min(minimumAvailableTorque,
      state.maximumAvailableUnitForceTorque);
  }
  near(minimumAvailableTorque,
    geometry.crankRadius / Math.sqrt(2), 1.1e-5,
    'worst-case available unit-force torque');
  assert.ok(minimumAvailableTorque > 0);

  const right = stateAtInputAngle(0);
  const top = stateAtInputAngle(Math.PI / 2);
  const left = stateAtInputAngle(Math.PI);
  const bottom = stateAtInputAngle(Math.PI * 3 / 2);
  assert.equal(right.verticalPistonForceDirection, 'up');
  assert.equal(top.horizontalPistonForceDirection, 'left');
  assert.equal(left.verticalPistonForceDirection, 'down');
  assert.equal(bottom.horizontalPistonForceDirection, 'right');
  disposeModel(model.root);
});

test('movement 424 four fixed black ports select the pressure sides required for positive crank torque', () => {
  const model = createMovementModel(catalog.movements[423]);
  const { stateAtInputAngle } = model.root.userData;

  const right = stateAtInputAngle(0);
  const top = stateAtInputAngle(Math.PI / 2);
  const left = stateAtInputAngle(Math.PI);
  const bottom = stateAtInputAngle(Math.PI * 3 / 2);
  assert.equal(right.pistonCBottomPortOpening, 1);
  assert.equal(right.pistonCTopPortOpening, 0);
  assert.equal(top.pistonBRightPortOpening, 1);
  assert.equal(top.pistonBLeftPortOpening, 0);
  assert.equal(left.pistonCTopPortOpening, 1);
  assert.equal(left.pistonCBottomPortOpening, 0);
  assert.equal(bottom.pistonBLeftPortOpening, 1);
  assert.equal(bottom.pistonBRightPortOpening, 0);

  for (let sample = 0; sample <= 100000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 100000);
    assert.ok(state.pistonBLeftPortOpening === 0
      || state.pistonBRightPortOpening === 0);
    assert.ok(state.pistonCTopPortOpening === 0
      || state.pistonCBottomPortOpening === 0);
    near(state.portOpeningMagnitudeSquared, 1, 5.6e-16,
      'orthogonal port magnitude identity');
  }
  disposeModel(model.root);
});

test('movement 424 update keeps B on its horizontal guide and C on the crank wrist inside B', () => {
  const model = createMovementModel(catalog.movements[423]);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.29, 0.73, 1.16, 1.59, 2.04, 2.51, 2.97,
    3.41, 3.86, 4.32]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.pistonB.position.x, state.pistonBCenter.x, 0,
      'B horizontal update');
    near(blocks.pistonB.position.y, 0, 0, 'B guide y');
    vectorNear(blocks.pistonC.position, state.pistonCCenter, 0,
      'C center follows wrist');
    sameAngle(blocks.crankRotor.rotation.z, state.crankAngle, 1.2e-16,
      'crank update');
    near(blocks.leftPortIndicator.scale.x,
      0.56 + state.pistonBLeftPortOpening, 0,
      'left port indication');
    near(blocks.rightPortIndicator.scale.x,
      0.56 + state.pistonBRightPortOpening, 0,
      'right port indication');
    near(blocks.topPortIndicator.scale.x,
      0.56 + state.pistonCTopPortOpening, 0,
      'top port indication');
    near(blocks.bottomPortIndicator.scale.x,
      0.56 + state.pistonCBottomPortOpening, 0,
      'bottom port indication');
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  vectorNear(closure.crankPin, source.crankPin, 0,
    'crank cycle closure');
  vectorNear(closure.pistonBCenter, source.pistonBCenter, 0,
    'B cycle closure');
  vectorNear(closure.pistonCCenter, source.pistonCCenter, 0,
    'C cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.cycleDuration);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 424 nested-piston geometry', () => {
  const movement424 = catalog.movements[423];
  const movement507 = catalog.movements[506];
  const model424 = createMovementModel(movement424);
  const model507 = createMovementModel(movement507);

  assert.equal(movement424.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model424.root);
  disposeModel(model507.root);
});
