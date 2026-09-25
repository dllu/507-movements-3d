import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
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

test('movement 356 is Bohnenberger’s three-ring spherical-rotor machine', () => {
  const movement = catalog.movements[355];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    degreesOfFreedom,
    fidelity,
    mechanism,
    sourceReference,
  } = model.root.userData;

  assert.equal(movement.id, 356);
  assert.equal(movement.number, '356');
  assert.equal(movement.category, 'Presses & clamps');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype, 'three-ring-inertial-axis-gimbal');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /Bohnenberger-heavy-ball-B/);
  assert.match(mechanism, /smallest-ring-A2/);
  assert.match(mechanism, /middle-ring-A1/);
  assert.match(mechanism, /outer-ring-A/);
  assert.match(mechanism, /right-angle-vertical-diameter/);
  assert.match(mechanism, /rotor-axis-fixed/);
  assert.equal(degreesOfFreedom.mechanism, 3);
  assert.match(degreesOfFreedom.input, /rapid spin of heavy ball B/);
  assert.match(degreesOfFreedom.output,
    /two mutually perpendicular frictionless gimbal rotations/);
  assert.match(degreesOfFreedom.externalDemonstrationInput,
    /operator slowly reorients outer ring A/);

  assert.equal(blocks.outerYawGroup.parent, model.root);
  assert.equal(blocks.outerRing.parent, blocks.outerYawGroup);
  assert.equal(blocks.middleYawGroup.parent, blocks.outerYawGroup);
  assert.equal(blocks.middleRing.parent, blocks.middleYawGroup);
  assert.equal(blocks.innerPitchGroup.parent, blocks.middleYawGroup);
  assert.equal(blocks.innerRing.parent, blocks.innerPitchGroup);
  assert.equal(blocks.ballSpinRotor.parent, blocks.innerPitchGroup);
  assert.equal(blocks.heavyBall.parent, blocks.ballSpinRotor);
  assert.equal(blocks.rotorShaft.parent, blocks.ballSpinRotor);
  assert.equal(blocks.middlePivotBearings.length, 2);
  assert.equal(blocks.middlePivotPins.length, 2);
  assert.equal(blocks.innerPivotBearings.length, 2);
  assert.equal(blocks.innerPivotPins.length, 2);
  assert.equal(blocks.rotorBearingHousings.length, 2);
  // Brown inks edges; the model has no dark rims, outlines or equator lines.
  for (const name of ['rotorBearingRims', 'lowerYawBearing', 'ballEquator', 'baseOutline', 'outerEdgeLines']) {
    assert.equal(blocks[name], undefined, name);
  }
  assert.equal(blocks.ballSpinIndexes.length, 4);
  assert.equal(blocks.shaftCaps.length, 2);
  assert.equal(blocks.supportColumn.parent, model.root);

  assert.deepEqual(sourceReference.labels, {
    A: 'outer supported ring',
    A1: 'middle ring on the vertical diameter pivots of A',
    A2: 'smallest ring on pivots perpendicular to those of A1',
    B: 'heavy spherical rotor whose shaft runs in bearings in A2',
  });
  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.ok(roles.includes('outer-ring-A'));
  assert.ok(roles.includes('middle-ring-A1'));
  assert.ok(roles.includes('smallest-ring-A2'));
  assert.ok(roles.includes('rapidly-rotating-heavy-ball-B'));
  assert.equal(roles.some((role) => /press|belt|pulley/.test(role)), false);
  disposeModel(model.root);
});

test('movement 356 preserves the source proportions without claiming a source animation', () => {
  const movement = catalog.movements[355];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.brownPlate356;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_356.html');
  assert.match(movement.description, /three rings, A, A1, A2/);
  assert.match(movement.description, /pivots at right angles/);
  assert.match(movement.description, /axis of a heavy ball, B/);
  assert.match(movement.description, /axis will continue in the same direction/);
  assert.match(movement.description, /resist a considerable pressure/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);

  assert.deepEqual(plate.gimbalCenter.toArray(), [263, 231]);
  assert.deepEqual(plate.outerTop.toArray(), [263, 70]);
  assert.deepEqual(plate.outerBottom.toArray(), [263, 392]);
  assert.deepEqual(plate.outerLeft.toArray(), [101, 231]);
  assert.deepEqual(plate.outerRight.toArray(), [425, 231]);
  assert.deepEqual(plate.middleTop.toArray(), [262, 95]);
  assert.deepEqual(plate.middleBottom.toArray(), [262, 390]);
  assert.deepEqual(plate.innerEndOne.toArray(), [172, 163]);
  assert.deepEqual(plate.innerEndTwo.toArray(), [363, 300]);
  assert.deepEqual(plate.ballLeft.toArray(), [181, 231]);
  assert.deepEqual(plate.ballRight.toArray(), [346, 231]);
  assert.deepEqual(plate.pedestalFloor.toArray(), [263, 487]);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 11);

  near(geometry.sourceOuterRadiusPixels, 161, 0,
    'outer ring raster radius');
  near(geometry.sourceMiddleRadiusPixels, 147.5, 0,
    'middle ring raster radius');
  near(geometry.sourceInnerRadiusPixels, 124, 0,
    'inner ring raster radius');
  near(geometry.sourceBallRadiusPixels, 82.5, 0,
    'ball raster radius');
  near(geometry.outerRadius / geometry.sourceScale, 161, 4e-14,
    'scaled outer radius');
  near(geometry.middleRadius / geometry.sourceScale, 147.5, 2e-14,
    'scaled middle radius');
  near(geometry.innerRadius / geometry.sourceScale, 124, 2e-14,
    'scaled inner radius');
  near(geometry.ballRadius / geometry.sourceScale, 82.5, 2e-14,
    'scaled ball radius');
  assert.ok(geometry.outerRadius > geometry.middleRadius);
  assert.ok(geometry.middleRadius > geometry.innerRadius);
  assert.ok(geometry.innerRadius > geometry.ballRadius);
  disposeModel(model.root);
});

test('movement 356 keeps every consecutive bearing axis at a right angle', () => {
  const model = createMovementModel(catalog.movements[355]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;

  for (let index = 0; index <= 4096; index += 1) {
    const time = geometry.cyclePeriod * index / 4096;
    const state = stateAtTime(time);
    near(state.middlePivotAxis.length(), 1, 3e-16,
      `unit A-A1 pivot axis ${index}`);
    near(state.innerPivotAxis.length(), 1, 3e-16,
      `unit A1-A2 pivot axis ${index}`);
    near(state.rotorAxis.length(), 1, 3e-16,
      `unit A2-B bearing axis ${index}`);
    near(state.middlePivotAxis.dot(state.innerPivotAxis), 0, 4e-16,
      `A-A1 perpendicular to A1-A2 ${index}`);
    near(state.innerPivotAxis.dot(state.rotorAxis), 0, 5e-16,
      `A1-A2 perpendicular to ball shaft ${index}`);
    near(state.middlePivotCenters[0].distanceTo(state.gimbalCenter),
      geometry.middlePivotOffset, 9e-16,
      `lower A-A1 pivot radius ${index}`);
    near(state.middlePivotCenters[1].distanceTo(state.gimbalCenter),
      geometry.middlePivotOffset, 9e-16,
      `upper A-A1 pivot radius ${index}`);
    near(state.innerPivotCenters[0].distanceTo(state.gimbalCenter),
      geometry.innerPivotOffset, 9e-16,
      `first A1-A2 pivot radius ${index}`);
    near(state.innerPivotCenters[1].distanceTo(state.gimbalCenter),
      geometry.innerPivotOffset, 9e-16,
      `second A1-A2 pivot radius ${index}`);
    near(state.rotorBearingCenters[0].distanceTo(state.gimbalCenter),
      geometry.rotorBearingOffset, 9e-16,
      `first A2-B bearing radius ${index}`);
    near(state.rotorBearingCenters[1].distanceTo(state.gimbalCenter),
      geometry.rotorBearingOffset, 9e-16,
      `second A2-B bearing radius ${index}`);
    near(state.supportPointError, 0, 2e-15,
      `fixed lower support point ${index}`);
    vectorNear(state.outerBottomSupportPoint,
      new THREE.Vector3(0, geometry.outerBottomY, 0), 2e-15,
      `outer-ring support closure ${index}`);
  }
  assert.match(data.transmission.bearingSequence,
    /three consecutive right-angle axes/);
  disposeModel(model.root);
});

test('movement 356 compensates cage motion with an inertially fixed rotor axis', () => {
  const model = createMovementModel(catalog.movements[355]);
  const data = model.root.userData;
  const { dynamics, geometry, stateAtTime } = data;
  const fixedAxis = geometry.fixedRotorAxis;
  const referenceState = stateAtTime(0);
  const differenceStep = 1e-6;

  for (let index = 0; index <= 4096; index += 1) {
    const time = geometry.cyclePeriod * index / 4096;
    const state = stateAtTime(time);
    vectorNear(state.rotorAxis, fixedAxis, 8e-16,
      `fixed inertial axis ${index}`);
    near(state.rotorAxisError, 0, 8e-16,
      `reported inertial-axis error ${index}`);
    near(state.yawCancellationError, 0, 5e-16,
      `outer/middle yaw cancellation ${index}`);
    near(state.gimbalCompensationRateError, 0, 0,
      `outer/middle rate cancellation ${index}`);
    near(state.middleWorldAngularSpeed, 0, 0,
      `stationary middle-ring world attitude ${index}`);
    near(state.middleWorldQuaternion.angleTo(
      referenceState.middleWorldQuaternion), 0, 4e-8,
    `fixed middle-ring world quaternion ${index}`);
    vectorNear(state.rotorAxisDriftRate, new THREE.Vector3(), 0,
      `zero rotor-axis drift ${index}`);
    vectorNear(state.spinAngularMomentumRate, new THREE.Vector3(), 0,
      `constant spin momentum ${index}`);
    vectorNear(state.spinAngularMomentum,
      fixedAxis.clone().multiplyScalar(
        dynamics.spinAngularMomentumMagnitude,
      ), 3e-14, `constant spin momentum vector ${index}`);
  }

  for (const fraction of [0.07, 0.19, 0.33, 0.58, 0.72, 0.91]) {
    const time = fraction * geometry.cyclePeriod;
    const previous = stateAtTime(time - differenceStep);
    const next = stateAtTime(time + differenceStep);
    const state = stateAtTime(time);
    near((next.outerYaw - previous.outerYaw) / (2 * differenceStep),
      state.outerYawAngularSpeed, 4e-10,
      `outer-yaw rate ${fraction}`);
    near((next.outerYawAngularSpeed - previous.outerYawAngularSpeed)
      / (2 * differenceStep), state.outerYawAngularAcceleration, 4e-10,
    `outer-yaw acceleration ${fraction}`);
    near((next.middleRelativeYaw - previous.middleRelativeYaw)
      / (2 * differenceStep), state.middleRelativeAngularSpeed, 4e-10,
    `middle compensation rate ${fraction}`);
  }
  assert.match(data.transmission.axisPreservation, /cancel exactly/);
  assert.match(data.transmission.demonstrationScope,
    /explicit demonstration input/);
  disposeModel(model.root);
});

test('movement 356 quantifies the spinning ball’s resistance to pressure', () => {
  const model = createMovementModel(catalog.movements[355]);
  const { dynamics, geometry, transmission } = model.root.userData;

  near(dynamics.ballSpinInertia,
    2 * dynamics.ballMass * geometry.ballRadius ** 2 / 5, 0,
    'solid-sphere axial inertia');
  near(dynamics.shaftSpinInertia,
    0.5 * dynamics.shaftMass * geometry.rotorShaftRadius ** 2, 0,
    'shaft axial inertia');
  near(dynamics.hubSpinInertia,
    0.5 * dynamics.hubMass * geometry.hubRadius ** 2, 0,
    'hub axial inertia');
  near(dynamics.rotorSpinInertia,
    dynamics.ballSpinInertia
      + dynamics.shaftSpinInertia
      + dynamics.hubSpinInertia,
    0, 'complete rotor axial inertia');
  near(dynamics.spinAngularMomentumMagnitude,
    dynamics.rotorSpinInertia * dynamics.ballSpinAngularSpeed, 0,
    'spinning-ball angular momentum');
  near(dynamics.spinKineticEnergy,
    0.5 * dynamics.rotorSpinInertia
      * dynamics.ballSpinAngularSpeed ** 2,
    0, 'spinning-ball kinetic energy');
  near(dynamics.transverseTorqueForReferenceSlew,
    dynamics.spinAngularMomentumMagnitude
      * dynamics.referenceAxisSlewRate,
    0, 'pressure torque for reference slew');
  near(dynamics.axisSlewRateForTransverseTorque(
    dynamics.transverseTorqueForReferenceSlew),
  dynamics.referenceAxisSlewRate, 0, 'torque-to-axis-rate law');
  near(dynamics.axisSlewRateForTransverseTorque(
    dynamics.transverseTorqueForReferenceSlew * 2),
  dynamics.referenceAxisSlewRate * 2, 0, 'double torque double slew');
  near(dynamics.angularImpulseForAxisDeflection(0), 0, 0,
    'zero deflection impulse');
  near(dynamics.angularImpulseForAxisDeflection(Math.PI),
    2 * dynamics.spinAngularMomentumMagnitude, 0,
    'reversal angular impulse');
  assert.match(transmission.gyroscopicResistance,
    /torque divided by its magnitude/);
  disposeModel(model.root);
});

test('movement 356 renderer binds all three gimbal axes and the ball shaft', () => {
  const model = createMovementModel(catalog.movements[355]);
  const data = model.root.userData;
  const { blocks, contacts, geometry } = data;

  for (const fraction of [0, 0.125, 0.25, 0.5, 0.75, 0.999]) {
    const time = fraction * geometry.cyclePeriod;
    const state = data.stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);

    near(blocks.outerYawGroup.rotation.y, state.outerYaw, 2e-15,
      `rendered outer yaw ${fraction}`);
    near(blocks.middleYawGroup.rotation.y,
      state.middleRelativeYaw, 2e-15,
      `rendered middle compensation ${fraction}`);
    near(blocks.innerPitchGroup.rotation.x, state.innerPitch, 0,
      `rendered inner pitch ${fraction}`);
    near(blocks.ballSpinRotor.rotation.z, state.ballSpinAngle, 2e-14,
      `rendered ball spin ${fraction}`);
    vectorNear(
      blocks.outerYawGroup.getWorldPosition(new THREE.Vector3()),
      state.gimbalCenter,
      0,
      `rendered gimbal center ${fraction}`,
    );
    vectorNear(
      blocks.heavyBall.getWorldPosition(new THREE.Vector3()),
      state.ballCenter,
      2e-15,
      `rendered heavy-ball center ${fraction}`,
    );

    const renderedMiddleAxis = Y_AXIS.clone().applyQuaternion(
      blocks.outerYawGroup.getWorldQuaternion(new THREE.Quaternion()),
    );
    const renderedInnerAxis = X_AXIS.clone().applyQuaternion(
      blocks.middleYawGroup.getWorldQuaternion(new THREE.Quaternion()),
    );
    const renderedRotorAxis = Z_AXIS.clone().applyQuaternion(
      blocks.innerPitchGroup.getWorldQuaternion(new THREE.Quaternion()),
    );
    vectorNear(renderedMiddleAxis, state.middlePivotAxis, 3e-16,
      `rendered A-A1 axis ${fraction}`);
    vectorNear(renderedInnerAxis, state.innerPivotAxis, 5e-16,
      `rendered A1-A2 axis ${fraction}`);
    vectorNear(renderedRotorAxis, state.rotorAxis, 7e-16,
      `rendered A2-B axis ${fraction}`);

    blocks.middlePivotBearings.forEach((bearing, index) => {
      vectorNear(bearing.getWorldPosition(new THREE.Vector3()),
        state.middlePivotCenters[index], 2e-15,
        `rendered A-A1 pivot ${index} ${fraction}`);
    });
    blocks.innerPivotBearings.forEach((bearing, index) => {
      vectorNear(bearing.getWorldPosition(new THREE.Vector3()),
        state.innerPivotCenters[index], 2e-15,
        `rendered A1-A2 pivot ${index} ${fraction}`);
    });
    blocks.rotorBearingHousings.forEach((bearing, index) => {
      vectorNear(bearing.getWorldPosition(new THREE.Vector3()),
        state.rotorBearingCenters[index], 2e-15,
        `rendered A2-B bearing ${index} ${fraction}`);
    });
    near(contacts.outerSupport.centerError, 0, 2e-15,
      `reported outer support ${fraction}`);
    near(contacts.middleRingPivots.axisOrthogonalityError, 0, 4e-16,
      `reported first right angle ${fraction}`);
    near(contacts.rotorBearings.axisOrthogonalityError, 0, 5e-16,
      `reported second right angle ${fraction}`);
  }

  assert.equal(blocks.ballSpinIndexes.length, 4,
    'the ball spin indexes stay as blocks for review');
  for (const index of blocks.ballSpinIndexes) {
    assert.equal(index.parent, null, 'Brown draws the ball plain: no spin stripes or dots');
  }
  let meshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  // 38 less 11 ink rims, edge lines and the equator line, less 4 spin indexes.
  assert.equal(meshCount, 23);
  disposeModel(model.root);
});

test('movement 356 closes its handling cycle and leaves 364 authored', () => {
  const model = createMovementModel(catalog.movements[355]);
  const data = model.root.userData;
  const { animationTiming, geometry } = data;
  const start = data.stateAtTime(0);
  const finish = data.stateAtTime(geometry.cyclePeriod);

  near(animationTiming.authoredCyclePeriod, 6, 0,
    'six-second authored handling cycle');
  near(animationTiming.targetCycleDuration, 2, 0,
    'standard display cycle');
  assertReadableTiming(animationTiming);
  near(finish.cycleCoordinate - start.cycleCoordinate, 1, 0,
    'one handling cycle');
  near(finish.outerYaw, start.outerYaw, 3e-16,
    'outer-ring yaw closure');
  near(finish.middleRelativeYaw, start.middleRelativeYaw, 3e-16,
    'middle-ring compensation closure');
  near(finish.ballSpinAngle - start.ballSpinAngle,
    Math.PI * 2 * 18, 2e-14, 'eighteen ball turns');
  near(finish.ballSpinTurns, 18, 0, 'ball turn count');
  vectorNear(finish.rotorAxis, start.rotorAxis, 7e-16,
    'inertial-axis closure');
  vectorNear(finish.spinAngularMomentum, start.spinAngularMomentum,
    3e-14, 'angular-momentum closure');

  model.update(0);
  model.root.updateMatrixWorld(true);
  const startIndexes = data.blocks.ballSpinIndexes.map((index) => (
    index.getWorldPosition(new THREE.Vector3())
  ));
  model.update(geometry.cyclePeriod);
  model.root.updateMatrixWorld(true);
  data.blocks.ballSpinIndexes.forEach((index, indexNumber) => {
    vectorNear(index.getWorldPosition(new THREE.Vector3()),
      startIndexes[indexNumber], 4e-14,
      `rendered ball-index closure ${indexNumber}`);
  });

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
