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
  'opposed-single-acting-quadrant-piston-four-bars-sharing-one-continuous-crank-with-overlapping-power-strokes';
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

test('movement 423 is two opposed single-acting pistons B joined by two rods to one common crank pin D', () => {
  const movement = catalog.movements[422];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 423);
  assert.equal(movement.number, '423');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /two opposed single-acting piston rockers B/);
  assert.match(data.mechanism, /very same pin.*crank D/);
  assert.match(data.mechanism, /one operating degree of freedom/);
  assert.match(data.mechanism, /no crank dead point/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.topPistonAngleIndependent, false);
  assert.equal(degreesOfFreedom.bottomPistonAngleIndependent, false);
  assert.equal(degreesOfFreedom.inductionValveAngleIndependent, false);
  assert.equal(blocks.topPiston.parent, model.root);
  assert.equal(blocks.bottomPiston.parent, model.root);
  assert.equal(blocks.topPistonArm.parent, blocks.topPiston);
  assert.equal(blocks.bottomPistonArm.parent, blocks.bottomPiston);
  assert.equal(blocks.commonCrankPin.parent, blocks.crankRotor);
  assert.equal(blocks.crankArm.parent, blocks.crankRotor);
  assert.equal(blocks.topConnectingRod.parent, model.root);
  assert.equal(blocks.bottomConnectingRod.parent, model.root);
  assert.equal(blocks.inductionValveA.parent, model.root);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.filter((role) => role ===
    'single-common-crank-pin-D-shared-by-both-connecting-rods').length, 1);
  for (const role of [
    'top-single-acting-piston-B',
    'bottom-single-acting-piston-B',
    'top-connecting-rod-from-B-to-common-crank-pin-D',
    'bottom-connecting-rod-from-B-to-common-crank-pin-D',
    'continuously-rotating-common-crank-D',
    'single-rocking-induction-valve-a-for-both-outer-spaces',
    'common-central-exhaust-space-between-the-two-pistons',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 423 records Root’s source construction and the official eight-part Canvas evidence', () => {
  const movement = catalog.movements[422];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate423;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_423.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /two single-acting pistons, B, B/);
  assert.match(movement.description, /both connected with one crank, D/);
  assert.match(movement.description, /outer sides.*alternately/);
  assert.match(movement.description, /space between the pistons/);
  assert.match(movement.description, /about two-thirds/);
  assert.match(movement.description, /no dead points/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.officialCanvasCyclePeriod, 4);
  assert.equal(sourceAnimation.officialCanvasCyclesPerMinute, 15);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(dynamics.commonCentralSpaceExhausted, true);
  assert.equal(dynamics.pressureExpansionCutoffLeakageFrictionAndValveFlowModeled,
    false);
  assert.match(dynamics.valveIndicators, /not separate valves/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.topFixedPivotApproximatePixels, [108, 269]);
  assert.deepEqual(plate.bottomFixedPivotApproximatePixels, [428, 274]);
  assert.deepEqual(plate.commonCrankCenterApproximatePixels, [272, 270]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.officialCanvasEvidence,
    /fixed B pivots.*-3\.509319.*3\.509319/);
  assert.match(evidence.officialCanvasEvidence,
    /4\.5-unit radius.*3-unit length/);
  assert.match(evidence.officialCanvasEvidence,
    /positive circle-intersection branch/);
  assert.match(evidence.reconstructionDisclosure,
    /no absolute dimensions.*cutoff law.*pressure history/);
  disposeModel(model.root);
});

test('movement 423 reproduces the official source pose and clockwise common-crank samples', () => {
  const model = createMovementModel(catalog.movements[422]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  vectorNear(source.crankPin,
    new THREE.Vector3(-0.395084, 1.133097, 0), 3e-16,
    'official initial common crank pin');
  vectorNear(source.topPiston.wristPin,
    new THREE.Vector3(-1.3827932953201596, 3.965839548827576, 0),
    8e-15, 'official initial top wrist');
  vectorNear(source.bottomPiston.wristPin,
    new THREE.Vector3(-0.5879736582027953, -1.8606955077998322, 0),
    8e-15, 'official initial bottom wrist');
  vectorNear(sourcePose.crankPin, source.crankPin, 0,
    'recorded source crank pin');
  vectorNear(sourcePose.topWristPin, source.topPiston.wristPin, 0,
    'recorded source top wrist');
  vectorNear(sourcePose.bottomWristPin, source.bottomPiston.wristPin, 0,
    'recorded source bottom wrist');
  near(source.crankAngle, geometry.sourceCrankAngle, 0,
    'source crank angle');

  const quarter = stateAtInputAngle(Math.PI / 2);
  vectorNear(quarter.crankPin,
    new THREE.Vector3(1.133097, 0.395084, 0), 3e-16,
    'clockwise quarter-turn crank pin');
  vectorNear(quarter.topPiston.wristPin,
    new THREE.Vector3(-0.22108774440131174, 3.0720569582627804, 0),
    2e-6, 'official quarter-cycle top wrist');
  vectorNear(quarter.bottomPiston.wristPin,
    new THREE.Vector3(-0.4380690869765054, -2.1605838644571422, 0),
    2e-6, 'official quarter-cycle bottom wrist');
  assert.ok(quarter.crankAngularSpeed < 0);
  disposeModel(model.root);
});

test('movement 423 holds both exact four-bar closures on the official positive circle-intersection branches', () => {
  const model = createMovementModel(catalog.movements[422]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let minimumInnerMargin = Infinity;
  let minimumOuterMargin = Infinity;
  let maximumRodResidual = 0;
  let maximumPistonResidual = 0;

  for (let sample = -50000; sample <= 100000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 50000);
    near(state.crankPin.distanceTo(geometry.crankCenter),
      geometry.crankRadius, 4e-16, 'common crank radius');
    near(state.crankPinClosureResidual, 0, 0,
      'identical crank pin in both closures');
    for (const [name, piston, pivot] of [
      ['top', state.topPiston, geometry.topFixedPivot],
      ['bottom', state.bottomPiston, geometry.bottomFixedPivot],
    ]) {
      near(piston.wristPin.distanceTo(pivot),
        geometry.pistonRockerRadius, 2.3e-15,
        `${name} fixed piston radius`);
      near(piston.wristPin.distanceTo(state.crankPin),
        geometry.connectingRodLength, 2.3e-15,
        `${name} connecting-rod length`);
      assert.ok(piston.branchCross > 0, `${name} positive branch`);
      assert.ok(piston.intersectionHeight > 0,
        `${name} distinct circle intersections`);
      minimumInnerMargin = Math.min(minimumInnerMargin,
        piston.assemblyInnerMargin);
      minimumOuterMargin = Math.min(minimumOuterMargin,
        piston.assemblyOuterMargin);
      maximumRodResidual = Math.max(maximumRodResidual,
        Math.abs(piston.connectingRodLengthResidual));
      maximumPistonResidual = Math.max(maximumPistonResidual,
        Math.abs(piston.pistonRadiusResidual));
    }
  }
  assert.ok(minimumInnerMargin > 0.80);
  assert.ok(minimumOuterMargin > 2.79);
  assert.ok(maximumRodResidual < 2.3e-15);
  assert.ok(maximumPistonResidual < 1.8e-15);
  disposeModel(model.root);
});

test('movement 423 differentiated closures satisfy rod velocity and acceleration constraints', () => {
  const model = createMovementModel(catalog.movements[422]);
  const { stateAtInputAngle } = model.root.userData;
  let maximumVelocityResidual = 0;
  let maximumAccelerationResidual = 0;

  for (let sample = -50000; sample <= 100000; sample += 1) {
    const angle = FULL_TURN * sample / 50000;
    const inputSpeed = 1.41 + 0.19 * Math.cos(angle);
    const inputAcceleration = -0.37 * Math.sin(angle * 0.73);
    const state = stateAtInputAngle(
      angle,
      inputSpeed,
      inputAcceleration,
    );
    for (const piston of [state.topPiston, state.bottomPiston]) {
      maximumVelocityResidual = Math.max(maximumVelocityResidual,
        Math.abs(piston.connectingRodVelocityConstraintResidual));
      maximumAccelerationResidual = Math.max(maximumAccelerationResidual,
        Math.abs(piston.connectingRodAccelerationConstraintResidual));
      near(piston.wristPinVelocity.dot(piston.pistonRadial),
        0, 2e-15, 'wrist velocity tangential to piston orbit');
      near(piston.pistonAngularSpeed,
        piston.pistonAnglePrime * inputSpeed, 0,
        'piston chain-rule speed');
      near(piston.pistonAngularAcceleration,
        piston.pistonAngleSecond * inputSpeed ** 2
          + piston.pistonAnglePrime * inputAcceleration,
        0, 'piston chain-rule acceleration');
    }
  }
  assert.ok(maximumVelocityResidual < 4.5e-15);
  assert.ok(maximumAccelerationResidual < 1.8e-14);
  disposeModel(model.root);
});

test('movement 423 analytic piston and wrist derivatives match finite differences', () => {
  const model = createMovementModel(catalog.movements[422]);
  const { stateAtInputAngle } = model.root.userData;
  const angleStep = 1e-5;

  for (const angle of [0.11, 0.49, 0.93, 1.44, 2.02, 2.58, 3.12,
    3.69, 4.22, 4.77, 5.31, 5.89, 6.13]) {
    const state = stateAtInputAngle(angle);
    const timeStep = angleStep / state.inputSpeed;
    const before = stateAtInputAngle(angle - angleStep);
    const after = stateAtInputAngle(angle + angleStep);
    const numericalCrankVelocity = after.crankPin.clone()
      .sub(before.crankPin)
      .multiplyScalar(1 / (2 * timeStep));
    vectorNear(numericalCrankVelocity, state.crankPinVelocity, 4e-10,
      `crank-pin velocity at ${angle}`);
    for (const key of ['topPiston', 'bottomPiston']) {
      const piston = state[key];
      const numericalAngularSpeed = (
        after[key].pistonAngle - before[key].pistonAngle
      ) / (2 * timeStep);
      const numericalAngularAcceleration = (
        after[key].pistonAngularSpeed - before[key].pistonAngularSpeed
      ) / (2 * timeStep);
      const numericalWristVelocity = after[key].wristPin.clone()
        .sub(before[key].wristPin)
        .multiplyScalar(1 / (2 * timeStep));
      near(numericalAngularSpeed, piston.pistonAngularSpeed, 4e-10,
        `${key} angular speed at ${angle}`);
      near(numericalAngularAcceleration, piston.pistonAngularAcceleration,
        1.3e-9, `${key} angular acceleration at ${angle}`);
      vectorNear(numericalWristVelocity, piston.wristPinVelocity, 2e-9,
        `${key} wrist velocity at ${angle}`);
    }
  }
  disposeModel(model.root);
});

test('movement 423 gives each B about two-thirds of a turn of power action with overlap and no dead point', () => {
  const model = createMovementModel(catalog.movements[422]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  near(THREE.MathUtils.radToDeg(geometry.powerStrokeAngularSpan),
    221.03700663795757, 2e-8, 'power-stroke crank span');
  near(geometry.powerStrokeFraction, 0.6139916851054377, 2e-15,
    'power-stroke turn fraction');
  near(geometry.returnStrokeAngularSpan
    + geometry.powerStrokeAngularSpan, FULL_TURN, 0,
    'power and return partition');
  near(geometry.totalPowerOverlapAngularSpan,
    2 * geometry.powerStrokeAngularSpan - FULL_TURN, 0,
    'two overlap intervals combined');
  assert.ok(geometry.powerStrokeFraction > 0.60);
  assert.ok(geometry.powerStrokeFraction < 2 / 3);
  assert.ok(geometry.totalPowerOverlapAngularSpan > 1.43);

  let minimumPoweredPistons = 2;
  let overlapSamples = 0;
  for (let sample = 0; sample < 200000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 200000);
    minimumPoweredPistons = Math.min(minimumPoweredPistons,
      state.poweredPistonCount);
    if (state.poweredPistonCount === 2) overlapSamples += 1;
  }
  assert.equal(minimumPoweredPistons, 1);
  assert.ok(overlapSamples > 45000);
  assert.ok(overlapSamples < 46200);

  const topPowerMiddle = stateAtInputAngle(
    (geometry.topOuterReversalInputAngle
      + geometry.topInnerReversalInputAngle) / 2,
  );
  assert.equal(topPowerMiddle.topPowerActive, true);
  const bottomPowerMiddle = stateAtInputAngle(
    (geometry.bottomOuterReversalInputAngle
      + FULL_TURN + geometry.bottomInnerReversalInputAngle) / 2,
  );
  assert.equal(bottomPowerMiddle.bottomPowerActive, true);
  disposeModel(model.root);
});

test('movement 423 one induction valve a alternately selects the two outer spaces in exact source phase', () => {
  const model = createMovementModel(catalog.movements[422]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  const changeover0 = stateAtInputAngle(0);
  const topAdmission = stateAtInputAngle(Math.PI / 2);
  const changeover1 = stateAtInputAngle(Math.PI);
  const bottomAdmission = stateAtInputAngle(Math.PI * 3 / 2);
  near(changeover0.valveAngle, geometry.valveCenterAngle, 0,
    'initial valve changeover');
  near(changeover1.valveAngle, geometry.valveCenterAngle, 6e-17,
    'opposite valve changeover');
  near(topAdmission.valveAngle, geometry.sourceValvePose1Angle, 0,
    'top-space source valve endpoint');
  near(bottomAdmission.valveAngle, geometry.sourceValvePose0Angle, 0,
    'bottom-space source valve endpoint');
  assert.equal(topAdmission.inductionValveRoute, 'top-outer-side');
  assert.equal(topAdmission.topInductionOpening, 1);
  assert.equal(topAdmission.bottomInductionOpening, 0);
  assert.equal(bottomAdmission.inductionValveRoute, 'bottom-outer-side');
  assert.equal(bottomAdmission.topInductionOpening, 0);
  assert.equal(bottomAdmission.bottomInductionOpening, 1);

  for (let sample = 0; sample <= 100000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 100000);
    near(state.valvePhaseConstraintResidual, 0, 5.6e-17,
      'source valve phase residual');
    assert.ok(state.topInductionOpening === 0
      || state.bottomInductionOpening === 0);
    near(state.inductionOpeningSum,
      Math.abs(Math.sin(state.inputAngle)), 0,
      'single-valve complementary opening');
  }
  disposeModel(model.root);
});

test('movement 423 update binds both piston rockers, both rods, common crank D, and valve a to one state', () => {
  const model = createMovementModel(catalog.movements[422]);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.31, 0.78, 1.19, 1.67, 2.08, 2.56, 3.03,
    3.49, 3.88, 4.37]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.crankRotor.rotation.z, state.crankAngle, 1.2e-16,
      'common crank update');
    sameAngle(blocks.topPiston.rotation.z,
      state.topPiston.pistonAngle, 1.2e-16, 'top piston update');
    sameAngle(blocks.bottomPiston.rotation.z,
      state.bottomPiston.pistonAngle, 1.2e-16, 'bottom piston update');
    sameAngle(blocks.inductionValveA.rotation.z,
      state.valveAngle, 1.2e-16, 'single induction valve update');
    near(blocks.topConnectingRod.scale.y,
      geometry.connectingRodLength, 2e-15, 'top displayed rod length');
    near(blocks.bottomConnectingRod.scale.y,
      geometry.connectingRodLength, 2e-15, 'bottom displayed rod length');
    near(blocks.topAdmissionIndicator.scale.x,
      0.58 + 1.05 * state.topInductionOpening, 0,
      'top admission indication');
    near(blocks.bottomAdmissionIndicator.scale.x,
      0.58 + 1.05 * state.bottomInductionOpening, 0,
      'bottom admission indication');
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  vectorNear(closure.crankPin, source.crankPin, 0,
    'common crank cycle closure');
  near(closure.topPiston.pistonAngle, source.topPiston.pistonAngle, 0,
    'top piston cycle closure');
  near(closure.bottomPiston.pistonAngle, source.bottomPiston.pistonAngle, 0,
    'bottom piston cycle closure');
  near(closure.valveAngle, source.valveAngle, 0,
    'induction valve cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.cycleDuration);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 423 double-quadrant geometry', () => {
  const movement423 = catalog.movements[422];
  const movement507 = catalog.movements[506];
  const model423 = createMovementModel(movement423);
  const model507 = createMovementModel(movement507);

  assert.equal(movement423.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model423.root);
  disposeModel(model507.root);
});
