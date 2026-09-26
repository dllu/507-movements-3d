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
  'preloaded-tension-compression-helical-spring-assisted-full-rotation-crank-rocker-treadle-through-both-dead-centers';

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

function cross2(left, right) {
  return left.x * right.y - left.y * right.x;
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

test('movement 416 is one full-turn crank B, one pitman, one rocking treadle, and one coiled spring A on its arbor', () => {
  const movement = catalog.movements[415];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 416);
  assert.equal(movement.number, '416');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /Crank B.*one continuous turn/);
  assert.match(data.mechanism, /constant-length pitman/);
  assert.match(data.mechanism, /positive tangential torque at both/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.elasticEnergyStates, 1);
  assert.equal(degreesOfFreedom.pitmanLengthIndependent, false);
  assert.equal(degreesOfFreedom.treadleAngleIndependent, false);
  assert.equal(blocks.crankArm.parent, blocks.flywheelRotor);
  assert.equal(blocks.crankPin.parent, blocks.flywheelRotor);
  assert.equal(blocks.treadleJointPin.parent, blocks.treadleRotor);
  assert.equal(blocks.pitman.parent, model.root);
  assert.equal(blocks.spring.parent, model.root);
  assert.equal(blocks.springAnchorPin.parent, blocks.fixedFrame);

  const roles = [];
  const belts = [];
  const springs = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.role
      === 'coiled-spring-A-on-fixed-arbor-with-tail-to-crank-pin-B') {
      springs.push(object);
    }
  });
  assert.deepEqual(belts, []);
  assert.equal(springs.length, 1);
  for (const role of [
    'continuous-full-rotation-flywheel-and-crank-B-rotor',
    'rigid-crank-B-arm',
    'white-crank-B-pin-and-spring-attachment',
    'rocking-foot-treadle-input',
    'constant-length-pitman-from-crank-B-to-treadle',
    'coiled-spring-A-on-fixed-arbor-with-tail-to-crank-pin-B',
    'fixed-arbor-A-carrying-spring-inner-end',
    'arbor-A-key-holding-spring-inner-end',
    'rigid-treadle-lever-with-intermediate-pivot-lug',
  ]) assert.ok(roles.includes(role), role);
  // Brown draws a plain flywheel disc, a slim treadle bar on a pivot lug
  // between its ends, and no frame, base, standards or spring stud.
  for (const role of [
    'white-full-rotation-flywheel-index',
    'white-treadle-rocking-index',
    'flywheel-spoke-fast-on-crankshaft',
    'broad-treadle-foot-pad',
    'fixed-treadle-machine-foundation',
    'fixed-flywheel-bearing-standard',
    'fixed-flywheel-standard-brace',
    'fixed-treadle-pivot-pedestal',
    'fixed-spring-anchor-standard',
    'fixed-spring-A-anchor-bracket',
    'helical-spring-A-between-fixed-eye-and-crank-eye',
  ]) assert.ok(!roles.includes(role), role);
  // The treadle pivot lies between its tip and its pitman joint.
  const { geometry } = data;
  const tipX = geometry.treadlePivot.x - 1.9;
  assert.ok(geometry.treadlePivot.x > tipX + 1.5);
  assert.ok(geometry.treadlePivot.x < geometry.treadlePivot.x + geometry.treadleJointRadius);
  disposeModel(model.root);
});

test('movement 416 records Brown’s dead-center purpose, labeled spring/crank, plate topology, and unavailable animation', () => {
  const movement = catalog.movements[415];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate416;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_416.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /assisting the crank of a treadle motion over the dead-centers/);
  assert.match(movement.description, /helical spring, A/);
  assert.match(movement.description,
    /move the crank, B, in direction at right-angles to dead-centers/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /marks its Animated control unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(
    dynamics.gravityDampingInertiaFootLoadsAndBearingFrictionModeled,
    false,
  );
  assert.equal(dynamics.helicalSpringLaw,
    'force=-springRate*(length-neutralLength)');
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.flywheelApproximateBoundsPixels,
    [213, 48, 469, 304]);
  assert.deepEqual(plate.crankBPinApproximatePixels, [270, 164]);
  assert.deepEqual(plate.pitmanApproximateEndpointsPixels,
    [[270, 164], [350, 439]]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence,
    /flywheel and crank B.*long pitman.*rocking treadle/);
  assert.match(evidence.reconstructionDisclosure,
    /neutral spring length halfway between the two toggle lengths/);
  disposeModel(model.root);
});

test('movement 416 exact four-bar closure keeps both moving pins on their circles and the pitman length invariant', () => {
  const model = createMovementModel(catalog.movements[415]);
  const { geometry, stateAtCrankAngle } = model.root.userData;
  let maximumLengthResidual = 0;
  let minimumTreadleAngle = Infinity;
  let maximumTreadleAngle = -Infinity;

  for (let sample = -30000; sample <= 60000; sample += 1) {
    const angle = Math.PI * 2 * sample / 30000;
    const state = stateAtCrankAngle(angle);
    maximumLengthResidual = Math.max(maximumLengthResidual,
      Math.abs(state.pitmanLengthResidual));
    near(state.crankPin.distanceTo(geometry.wheelCenter),
      geometry.crankRadius, 5e-16, 'crank-pin circle');
    near(state.treadleJoint.distanceTo(geometry.treadlePivot),
      geometry.treadleJointRadius, 9e-16, 'treadle-joint circle');
    near(state.pitmanVector.length(), geometry.pitmanLength, 3e-15,
      'pitman closure');
    minimumTreadleAngle = Math.min(minimumTreadleAngle,
      state.treadleAngle);
    maximumTreadleAngle = Math.max(maximumTreadleAngle,
      state.treadleAngle);
  }
  assert.ok(maximumLengthResidual < 3e-15);
  near(minimumTreadleAngle, geometry.minimumTreadleAngle, 2e-8,
    'minimum treadle angle');
  near(maximumTreadleAngle, geometry.maximumTreadleAngle, 2e-8,
    'maximum treadle angle');
  // Brown's crank throw and short fulcrum-to-joint arm rock the treadle
  // through about 86 degrees.
  assert.ok(maximumTreadleAngle - minimumTreadleAngle > 1.49);
  assert.ok(maximumTreadleAngle - minimumTreadleAngle < 1.52);
  disposeModel(model.root);
});

test('movement 416 analytic four-bar velocity and acceleration satisfy differentiated pitman closure', () => {
  const model = createMovementModel(catalog.movements[415]);
  const { geometry, stateAtCrankAngle } = model.root.userData;
  let maximumVelocityResidual = 0;
  let maximumAccelerationResidual = 0;

  for (let sample = 0; sample <= 72000; sample += 1) {
    const angle = Math.PI * 2 * sample / 72000;
    const state = stateAtCrankAngle(angle);
    const crankAcceleration = state.crankUnit.clone()
      .multiplyScalar(-geometry.crankRadius * state.crankSpeed ** 2)
      .addScaledVector(
        state.crankTangent,
        geometry.crankRadius * state.crankAcceleration,
      );
    const treadleAcceleration = state.treadleUnit.clone()
      .multiplyScalar(
        -geometry.treadleJointRadius
          * state.treadleAngularSpeed ** 2,
      )
      .addScaledVector(
        state.treadleTangent,
        geometry.treadleJointRadius
          * state.treadleAngularAcceleration,
      );
    const relativeAcceleration = treadleAcceleration.sub(
      crankAcceleration,
    );
    const accelerationResidual = state.relativeVelocity.lengthSq()
      + state.pitmanVector.dot(relativeAcceleration);
    maximumVelocityResidual = Math.max(maximumVelocityResidual,
      Math.abs(state.pitmanVelocityConstraintResidual));
    maximumAccelerationResidual = Math.max(maximumAccelerationResidual,
      Math.abs(accelerationResidual));
  }
  assert.ok(maximumVelocityResidual < 2e-15);
  assert.ok(maximumAccelerationResidual < 3.2e-15);
  disposeModel(model.root);
});

test('movement 416 spring A supplies positive tangential crank torque at both exact treadle dead centers', () => {
  const model = createMovementModel(catalog.movements[415]);
  const { deadCenterStates, geometry } = model.root.userData;

  assert.equal(geometry.deadCenterAngles.length, 2);
  assert.equal(deadCenterStates.length, 2);
  near(
    Math.abs(geometry.deadCenterAngles[1] - geometry.deadCenterAngles[0]),
    Math.PI,
    0.08,
    'opposed dead-center angles',
  );
  near(deadCenterStates[0].springExtension,
    -deadCenterStates[1].springExtension, 4e-16,
    'equal opposite dead-center preload');
  assert.equal(deadCenterStates[0].springCondition, 'tension');
  assert.equal(deadCenterStates[1].springCondition, 'compression');
  for (const [index, state] of deadCenterStates.entries()) {
    near(state.deadCenterMoment, 0, 2e-15,
      `zero treadle leverage at dead center ${index}`);
    assert.ok(state.springTorque > 0.25,
      `spring assists positive rotation at dead center ${index}`);
    assert.ok(state.tangentialSpringForce > 0.40,
      `positive tangential force at dead center ${index}`);
    near(state.springTorque,
      geometry.crankRadius * state.tangentialSpringForce,
      2e-16, `torque decomposition at dead center ${index}`);
  }
  disposeModel(model.root);
});

test('movement 416 linear spring force is conservative and exchanges zero net work over a crank turn', () => {
  const model = createMovementModel(catalog.movements[415]);
  const { geometry, stateAtCrankAngle } = model.root.userData;
  const samples = 100000;
  const step = Math.PI * 2 / samples;
  let previous = stateAtCrankAngle(0);
  let integratedWork = 0;
  let minimumLength = Infinity;
  let maximumLength = -Infinity;

  for (let sample = 0; sample <= samples; sample += 1) {
    const state = stateAtCrankAngle(step * sample);
    near(state.springForceOnCrank.dot(state.springAxisUnit),
      -geometry.springRate * state.springExtension, 4e-15,
      'linear spring force law');
    near(state.springPotentialEnergy,
      geometry.springRate * state.springExtension ** 2 / 2, 0,
      'spring energy law');
    minimumLength = Math.min(minimumLength, state.springLength);
    maximumLength = Math.max(maximumLength, state.springLength);
    if (sample > 0) {
      integratedWork += (previous.springTorque + state.springTorque)
        * step / 2;
    }
    previous = state;
  }
  near(integratedWork, 0, 1.1e-14, 'closed-cycle spring work');
  near(minimumLength, geometry.minimumSpringLength, 1e-7,
    'minimum spring length');
  near(maximumLength, geometry.maximumSpringLength, 1e-7,
    'maximum spring length');
  near(stateAtCrankAngle(geometry.springMinimumLengthAngle).springLength,
    geometry.minimumSpringLength, 5e-16,
    'analytic minimum spring length');
  near(stateAtCrankAngle(geometry.springMaximumLengthAngle).springLength,
    geometry.maximumSpringLength, 5e-16,
    'analytic maximum spring length');

  const derivativeStep = 1e-5;
  for (const angle of [0.2, 0.8, 1.7, 2.6, 3.4, 4.2, 5.3, 6.0]) {
    const before = stateAtCrankAngle(angle - derivativeStep);
    const state = stateAtCrankAngle(angle);
    const after = stateAtCrankAngle(angle + derivativeStep);
    const energyDerivative = (
      after.springPotentialEnergy - before.springPotentialEnergy
    ) / (2 * derivativeStep);
    near(energyDerivative, -state.springTorque, 2e-10,
      `spring conservative torque at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 416 makes one uniform crank turn per cycle while the treadle rocks without branch switching', () => {
  const model = createMovementModel(catalog.movements[415]);
  const { geometry, stateAtTime } = model.root.userData;
  let previousUnwrappedTreadleAngle = stateAtTime(0).treadleAngle;
  let maximumTreadleStep = 0;

  for (let sample = 0; sample < 36000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 36000);
    near(state.crankSpeed, geometry.crankAngularSpeed, 0,
      'uniform crank speed');
    near(state.crankAcceleration, 0, 0, 'zero crank acceleration');
    maximumTreadleStep = Math.max(maximumTreadleStep,
      Math.abs(state.treadleAngle - previousUnwrappedTreadleAngle));
    previousUnwrappedTreadleAngle = state.treadleAngle;
  }
  assert.ok(maximumTreadleStep < 0.00016);
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  sameAngle(closure.crankAngle, source.crankAngle, 0,
    'crank cycle closure');
  sameAngle(closure.treadleAngle, source.treadleAngle, 0,
    'treadle cycle closure');
  near(closure.springLength, source.springLength, 0,
    'spring cycle closure');
  assert.equal(model.root.userData.motion.crankTurnsPerCycle, 1);
  disposeModel(model.root);
});

test('movement 416 analytic treadle motion and crank-pin velocity match finite differences', () => {
  const model = createMovementModel(catalog.movements[415]);
  const { stateAtCrankAngle } = model.root.userData;
  const angularStep = 1e-5;

  for (const angle of [0.11, 0.63, 1.2, 1.9, 2.7, 3.5, 4.3, 5.1, 5.9]) {
    const state = stateAtCrankAngle(angle);
    const timeStep = angularStep / state.crankSpeed;
    const before = stateAtCrankAngle(angle - angularStep);
    const after = stateAtCrankAngle(angle + angularStep);
    const numericalTreadleSpeed = (
      after.treadleAngle - before.treadleAngle
    ) / (2 * timeStep);
    const numericalTreadleAcceleration = (
      after.treadleAngularSpeed - before.treadleAngularSpeed
    ) / (2 * timeStep);
    const numericalCrankPinVelocity = after.crankPin.clone()
      .sub(before.crankPin)
      .multiplyScalar(1 / (2 * timeStep));
    near(numericalTreadleSpeed, state.treadleAngularSpeed, 3e-10,
      `treadle speed at ${angle}`);
    near(numericalTreadleAcceleration,
      state.treadleAngularAcceleration, 5e-10,
      `treadle acceleration at ${angle}`);
    vectorNear(numericalCrankPinVelocity, state.crankPinVelocity, 5e-11,
      `crank-pin velocity at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 416 update binds crank, treadle, pitman, and deforming spring to one exact state', () => {
  const model = createMovementModel(catalog.movements[415]);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.7, 1.5, 2.4, 3.2, 4.1, 5.3]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.flywheelRotor.rotation.z, state.crankAngle, 0,
      'flywheel/crank update');
    near(blocks.treadleRotor.rotation.z, state.treadleAngle, 0,
      'treadle update');
    near(blocks.pitman.geometry.userData.bores[1].x, geometry.pitmanLength, 3e-15,
      'rendered pitman length');
    near(blocks.spring.userData.attachmentDistance, state.springLength, 0,
      'rendered spring length');
    vectorNear(blocks.spring.position, geometry.springAnchor, 0,
      'spring fixed endpoint');
  }
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.cycleDuration);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 416 treadle geometry', () => {
  const movement416 = catalog.movements[415];
  const movement507 = catalog.movements[506];
  const model416 = createMovementModel(movement416);
  const model507 = createMovementModel(movement507);

  assert.equal(movement416.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model416.root);
  disposeModel(model507.root);
});
