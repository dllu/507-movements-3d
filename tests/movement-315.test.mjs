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
const DOWN = new THREE.Vector3(0, -1, 0);

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

test('movement 315 is one spindle-driven conical pendulum with the historical topology', () => {
  const movement = catalog.movements[314];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    constraints,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 315);
  assert.equal(movement.number, '315');
  assert.equal(movement.title,
    'Conical pendulum, hung by a thin piece of round wire');
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'vertical-spindle-crank-driven-constant-angle-conical-pendulum');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /single horizontal crank/);
  assert.match(mechanism, /fixed-length pendulum/);
  assert.match(mechanism, /thin round top wire flexes/);
  assert.match(mechanism, /constant-angle cone/);

  assert.equal(transmission.angularVelocityRatio, 1);
  assert.equal(transmission.spindleTurnsPerPendulumRevolution, 1);
  assert.equal(transmission.pendulumRevolutionsPerSpindleTurn, 1);
  assert.match(transmission.input, /vertical spindle/);
  assert.match(transmission.output, /conical revolution/);
  assert.equal(constraints.lowerJointCoincidentForAllTime, true);
  assert.equal(constraints.spindleAxisCollinearWithConeAxis, true);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.spindleRotor.parent, model.root);
  assert.equal(blocks.pendulumCarrier.parent, model.root);
  assert.equal(blocks.crankArm.parent, blocks.spindleRotor);
  assert.equal(blocks.wristPin.parent, blocks.spindleRotor);
  assert.equal(blocks.flexureWire.parent, blocks.pendulumCarrier);
  assert.equal(blocks.rigidRod.parent, blocks.pendulumCarrier);
  assert.equal(blocks.bob.parent, blocks.pendulumCarrier);
  assert.equal(blocks.lowerSocket.parent, blocks.pendulumCarrier);
  assert.deepEqual(blocks.spindleRotor.userData.axis,
    new THREE.Vector3(0, 1, 0));
  assert.deepEqual(blocks.pendulumCarrier.userData.axis,
    new THREE.Vector3(0, 1, 0));

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'thin-round-flexure-suspension-wire').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'rigid-pendulum-rod-describing-cone').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'cylindrical-conical-pendulum-bob').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'single-horizontal-radius-crank-arm').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'vertical-rotating-driving-spindle').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 315 records the Brown plate and explicitly handles its perspective projection', () => {
  const movement = catalog.movements[314];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePlatePointToIdealFront,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.brownPlate315;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /thin round suspension wire/);
  assert.match(sourceAnimation.referenceScope, /lower-end crank connection/);
  assert.match(sourceAnimation.referenceScope, /does not dimension depth/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_315.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 10);
  assert.deepEqual(plate.rasterTopHangerCenter,
    new THREE.Vector2(261, 31));
  assert.deepEqual(plate.rasterTopSuspension,
    new THREE.Vector2(263, 56));
  assert.deepEqual(plate.rasterRigidRodStart,
    new THREE.Vector2(269, 82));
  assert.deepEqual(plate.rasterBobCenter,
    new THREE.Vector2(326, 310));
  assert.equal(plate.rasterBobAxialExtent, 67);
  assert.equal(plate.rasterBobHalfWidth, 26);
  assert.deepEqual(plate.rasterLowerJoint,
    new THREE.Vector2(344, 378));
  assert.deepEqual(plate.rasterSpindleAxisAtArm,
    new THREE.Vector2(256, 393));
  assert.deepEqual(plate.rasterArmOuterTip,
    new THREE.Vector2(376, 367));
  assert.deepEqual(plate.rasterUpperBearingCenter,
    new THREE.Vector2(256, 421));
  assert.deepEqual(plate.rasterDriveCollarCenter,
    new THREE.Vector2(258, 461));
  assert.deepEqual(plate.rasterFootCenter,
    new THREE.Vector2(258, 505));
  assert.match(plate.inferredTopology, /one fixed top flexure/);
  assert.match(plate.inferredTopology, /one lower crank wrist/);
  assert.match(plate.perspectiveIdealization, /seven-pixel/);
  assert.match(plate.perspectiveIdealization, /exactly vertical/);

  near(
    (plate.rasterLowerJoint.x - plate.rasterSpindleAxisAtArm.x)
      * geometry.sourceScale,
    geometry.crankRadius,
    0,
    'plate-derived crank radius',
  );
  const sourceTolerance = plate.measurementUncertaintyPixels
    * geometry.sourceScale;
  vectorNear(sourcePlatePointToIdealFront(plate.rasterLowerJoint),
    stateAtTime(0).wristCenter, 1e-15,
  'source lower joint maps to source-pose wrist');
  assert.ok(sourcePlatePointToIdealFront(plate.rasterTopSuspension)
    .distanceTo(geometry.topAnchor) < sourceTolerance,
  'source hanger/spindle mismatch remains inside drawing uncertainty');
  assert.ok(sourcePlatePointToIdealFront(plate.rasterBobCenter)
    .distanceTo(stateAtTime(0).bobCenter) < sourceTolerance,
  'source bob center agrees with ideal conical geometry');

  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 315 keeps the crank wrist and pendulum end coincident over a dense full turn', () => {
  const model = createMovementModel(catalog.movements[314]);
  const {
    geometry,
    stateAtTime,
  } = model.root.userData;

  for (let sample = 0; sample <= 32768; sample += 1) {
    const time = geometry.cyclePeriod * sample / 32768;
    const state = stateAtTime(time);
    near(state.wristCenter.y, geometry.crankPlaneY, 0,
      `wrist height at ${sample}`);
    near(state.horizontalRadius, geometry.crankRadius, 8e-16,
      `wrist circle radius at ${sample}`);
    near(state.verticalDrop, geometry.verticalDrop, 9e-16,
      `vertical drop at ${sample}`);
    near(state.rodLength, geometry.rodLength, 2e-15,
      `rod length at ${sample}`);
    near(state.pendulumDirection.length(), 1, 4e-16,
      `unit rod direction at ${sample}`);
    near(state.pendulumDirection.dot(DOWN),
      Math.cos(geometry.coneHalfAngle), 4e-16,
    `constant cone half-angle at ${sample}`);
    vectorNear(state.crankWristCenter, state.pendulumLowerJoint,
      9e-16, `coincident lower joint at ${sample}`);
    near(state.lowerJointError, 0, 9e-16,
      `lower joint error at ${sample}`);
    near(state.lowerJointContact.pointError, 0, 9e-16,
      `contact error at ${sample}`);
    vectorNear(state.quaternionDirection, state.pendulumDirection,
      5e-16, `render quaternion direction at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 315 wire, rod, and bob remain one straight pendulum from the fixed top', () => {
  const model = createMovementModel(catalog.movements[314]);
  const {
    geometry,
    stateAtTime,
  } = model.root.userData;

  for (const time of [0, 0.19, 0.73, 1, 1.84, 2, 2.91, 3, 3.77, 4]) {
    const state = stateAtTime(time);
    vectorNear(
      state.flexureEnd,
      geometry.topAnchor.clone().addScaledVector(
        state.pendulumDirection,
        geometry.flexureLength,
      ),
      0,
      `flexure end at ${time}`,
    );
    vectorNear(
      state.bobCenter,
      geometry.topAnchor.clone().addScaledVector(
        state.pendulumDirection,
        geometry.bobDistanceFromTop,
      ),
      0,
      `bob center collinearity at ${time}`,
    );
    near(state.bobCenter.clone().sub(geometry.topAnchor)
      .cross(state.pendulumDirection).length(), 0, 9e-16,
    `bob is on rod axis at ${time}`);
    near(state.flexureEnd.clone().sub(geometry.topAnchor)
      .cross(state.pendulumDirection).length(), 0, 3e-16,
    `wire is on rod axis at ${time}`);
  }

  const quarterStates = [0, 1, 2, 3].map((time) => stateAtTime(time));
  vectorNear(quarterStates[0].wristCenter,
    new THREE.Vector3(geometry.crankRadius, geometry.crankPlaneY, 0),
    0, 'source/right position');
  vectorNear(quarterStates[1].wristCenter,
    new THREE.Vector3(0, geometry.crankPlaneY, -geometry.crankRadius),
    2e-16, 'rear position');
  vectorNear(quarterStates[2].wristCenter,
    new THREE.Vector3(-geometry.crankRadius, geometry.crankPlaneY, 0),
    4e-16, 'left position');
  vectorNear(quarterStates[3].wristCenter,
    new THREE.Vector3(0, geometry.crankPlaneY, geometry.crankRadius),
    7e-16, 'front position');
  disposeModel(model.root);
});

test('movement 315 has analytic uniform circular rates and one-to-one spindle transmission', () => {
  const model = createMovementModel(catalog.movements[314]);
  const {
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const expectedSpeed = geometry.crankRadius
    * geometry.spindleAngularSpeed;
  const expectedAcceleration = geometry.crankRadius
    * geometry.spindleAngularSpeed ** 2;

  for (let sample = 0; sample <= 16000; sample += 1) {
    const state = stateAtTime(
      geometry.cyclePeriod * sample / 16000,
    );
    near(state.wristVelocity.length(), expectedSpeed, 2e-15,
      `uniform wrist speed at ${sample}`);
    near(state.wristAcceleration.length(), expectedAcceleration, 3e-15,
      `centripetal acceleration at ${sample}`);
    near(state.wristCenter.clone().setY(0).dot(state.wristVelocity),
      0, 4e-15, `radial/tangent orthogonality at ${sample}`);
    near(state.wristVelocity.dot(state.wristAcceleration),
      0, 1.4e-14, `constant-speed derivative at ${sample}`);
    near(state.spindleAngularSpeed,
      geometry.spindleAngularSpeed, 0,
    `spindle speed at ${sample}`);
    near(state.spindleAngularAcceleration, 0, 0,
      `spindle angular acceleration at ${sample}`);
  }

  const epsilon = 1e-5;
  for (const time of [0.13, 0.71, 1.42, 2.09, 2.88, 3.61]) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    vectorNear(
      after.wristCenter.clone().sub(before.wristCenter)
        .multiplyScalar(1 / (2 * epsilon)),
      state.wristVelocity,
      1e-9,
      `finite-difference wrist velocity at ${time}`,
    );
    vectorNear(
      after.wristVelocity.clone().sub(before.wristVelocity)
        .multiplyScalar(1 / (2 * epsilon)),
      state.wristAcceleration,
      3e-9,
      `finite-difference wrist acceleration at ${time}`,
    );
    vectorNear(
      after.bobCenter.clone().sub(before.bobCenter)
        .multiplyScalar(1 / (2 * epsilon)),
      state.bobVelocity,
      1e-9,
      `finite-difference bob velocity at ${time}`,
    );
  }

  for (const time of [0, 0.27, 1.33, 2.51, 3.99]) {
    const state = stateAtTime(time);
    const closure = stateAtTime(time + geometry.cyclePeriod);
    near(closure.unwrappedSpindleAngle - state.unwrappedSpindleAngle,
      Math.PI * 2, 1e-15, `one spindle turn at ${time}`);
    vectorNear(closure.wristCenter, state.wristCenter, 5e-15,
      `wrist cycle closure at ${time}`);
    vectorNear(closure.bobCenter, state.bobCenter, 5e-15,
      `bob cycle closure at ${time}`);
  }
  assert.equal(transmission.angularVelocityRatio, 1);
  disposeModel(model.root);
});

test('movement 315 renderer binds both moving assemblies to the same exact joint', () => {
  const model = createMovementModel(catalog.movements[314]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const markerWorld = new THREE.Vector3();
  const socketWorld = new THREE.Vector3();

  assert.equal(model.root.userData.groundFloorY, -5.68);
  assert.ok(model.root.userData.cameraFitBounds.isBox3);
  assert.ok(model.root.userData.cameraFitBounds.min.z < -geometry.crankRadius);
  assert.ok(model.root.userData.cameraFitBounds.max.z > geometry.crankRadius);
  assert.equal(blocks.wristOrbit.userData.nonPhysicalReference, true);
  assert.equal(blocks.wristOrbit.castShadow, false);
  assert.equal(blocks.wristOrbit.receiveShadow, false);

  for (const time of [
    canonicalTimes.sourcePose,
    canonicalTimes.rear,
    canonicalTimes.left,
    canonicalTimes.front,
    canonicalTimes.cycleClosure,
    0.43,
    2.71,
  ]) {
    const expected = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.spindleRotor.rotation.y, expected.spindleAngle, 0,
      `rendered spindle angle at ${time}`);
    near(Math.abs(blocks.pendulumCarrier.quaternion.dot(
      expected.pendulumQuaternion,
    )), 1, 3e-16, `rendered pendulum quaternion at ${time}`);
    blocks.jointMarker.getWorldPosition(markerWorld);
    blocks.lowerSocket.getWorldPosition(socketWorld);
    vectorNear(markerWorld, expected.wristCenter, 7e-16,
      `rendered crank wrist at ${time}`);
    vectorNear(socketWorld, expected.pendulumLowerJoint, 2e-15,
      `rendered pendulum end at ${time}`);
    vectorNear(markerWorld, socketWorld, 2e-15,
      `rendered coincident joint at ${time}`);
    near(model.root.userData.contacts.lowerJoint.pointError,
      0, 9e-16, `published joint contact at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 315 uses its authored four-second cycle and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[314]);
  const {
    animationTiming,
    geometry,
    timeline,
  } = model.root.userData;

  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(timeline.demonstrationPeriod, geometry.cyclePeriod);
  assert.deepEqual(timeline.schedule, [
    'vertical-spindle-turns-uniformly',
    'single-radius-arm-carries-lower-wrist-on-horizontal-circle',
    'fixed-length-pendulum-maintains-constant-cone-angle',
    'thin-round-top-wire-flexes-about-fixed-suspension',
    'pendulum-and-spindle-complete-one-revolution-together',
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
