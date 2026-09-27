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

function vector2Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function vector3Near(actual, expected, tolerance, message) {
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

test('movement 337 is the midpoint vibrating-rod parallel motion', () => {
  const movement = catalog.movements[336];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    contacts,
    degreesOfFreedom,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 337);
  assert.equal(movement.number, '337');
  assert.equal(movement.title,
    'parallel motion with a midpoint piston on a short vibrating rod');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'beam-midpoint-vibrating-rod-and-fixed-radius-parallel-motion');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /short-vibrating-rod-B-C-D/);
  assert.match(mechanism, /fixed-radius-rod-F-D/);
  assert.match(mechanism, /midpoint-C/);
  assert.match(transmission.exactRigidConstraints, /\|B-D\|=5\.582196/);
  assert.match(transmission.exactRigidConstraints, /C=\(B\+D\)\/2/);
  assert.match(transmission.straightness, /near-vertical 6\.839-unit stroke/);
  assert.equal(degreesOfFreedom.mechanism, 1);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.beam.parent, model.root);
  assert.equal(blocks.vibratingRod.parent, model.root);
  assert.equal(blocks.radiusRod.parent, model.root);
  assert.equal(blocks.output.parent, model.root);
  assert.equal(blocks.beamBody.parent, blocks.beam);
  assert.equal(blocks.pistonRod.parent, blocks.output);
  assert.equal(blocks.jointPins.B.parent, blocks.beam);
  assert.equal(blocks.jointPins.C.parent, blocks.output);
  assert.equal(blocks.jointPins.D.parent, blocks.radiusRod);
  assert.equal(blocks.vibratingRodMidpointAnchor.parent,
    blocks.vibratingRod);
  assert.equal(contacts.beamPivotO.movingMember, blocks.beam);
  assert.equal(contacts.radiusPivotF.movingMember, blocks.radiusRod);
  assert.deepEqual(contacts.beamAtB.members,
    [blocks.beam, blocks.vibratingRod]);
  assert.deepEqual(contacts.pistonAtC.members,
    [blocks.vibratingRod, blocks.output]);
  assert.deepEqual(contacts.radiusAtD.members,
    [blocks.vibratingRod, blocks.radiusRod]);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'twenty-unit-rocking-beam-with-left-pin-B').length, 1);
  assert.equal(roles.filter((role) => role ===
    'short-five-point-five-eight-two-one-nine-six-unit-vibrating-rod-B-D')
    .length, 1);
  assert.equal(roles.filter((role) => role ===
    'ten-unit-fixed-radius-rod-F-D').length, 1);
  assert.equal(roles.filter((role) => role ===
    'piston-rod-attached-to-vibrating-rod-midpoint-C').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 337 preserves the official rounded rays and all pivots', () => {
  const movement = catalog.movements[336];
  const model = createMovementModel(movement);
  const {
    geometry,
    modelPointToOfficialAnimationRaster,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const official = sourceAnimation.officialGeometry;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.durationSeconds, 4);
  assert.deepEqual(sourceAnimation.officialFunctionChain, [
    'add_stat',
    'add_pos_interp',
    'add_c_rod_r',
    'add_rot_to',
    'add_tx',
  ]);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_337.html');
  assert.match(sourceAnimation.referenceScope, /midpoint C/);
  assert.match(sourceAnimation.reconstructionDifference,
    /none in kinematics/);

  assert.deepEqual(official.beamPivotO, new THREE.Vector2(0, 0));
  assert.deepEqual(official.beamUpperDirection,
    new THREE.Vector2(9.396926, 3.420201));
  assert.deepEqual(official.beamLowerDirection,
    new THREE.Vector2(9.396926, -3.420201));
  assert.equal(official.beamPinRadius, 10);
  assert.equal(official.vibratingRodLength, 5.582196);
  assert.equal(official.vibratingRodMidpointDistance, 2.791098);
  assert.deepEqual(official.radiusPivotF,
    new THREE.Vector2(-19.0375, -5.498592));
  assert.deepEqual(official.radiusReferencePoint,
    new THREE.Vector2(-9.0375, -5.498592));
  near(official.radiusRodLength, 10, 2e-15,
    'official F-D radius');
  assert.equal(official.nominalPistonLineX, -9.51875);
  assert.equal(official.canvasPistonRodLength, 20);
  near(geometry.beamHalfSwing,
    Math.atan2(3.420201, 9.396926), 0,
  'rounded official beam half-swing');
  assert.ok(Math.abs(geometry.beamHalfSwing - Math.PI / 9) < 3.4e-8);
  near(geometry.beamPinRadius, 10 * geometry.sourceScale, 0,
    'scaled O-B beam radius');
  near(geometry.vibratingRodLength, 5.582196 * geometry.sourceScale, 0,
    'scaled B-D vibrating rod');
  near(geometry.vibratingRodMidpointDistance,
    2.791098 * geometry.sourceScale, 0,
  'scaled B-C midpoint station');
  near(geometry.radiusRodLength, 10 * geometry.sourceScale, 6e-16,
    'scaled F-D radius rod');
  vector2Near(geometry.radiusPivotF,
    new THREE.Vector2(-19.0375, -5.498592)
      .multiplyScalar(geometry.sourceScale),
  0, 'scaled fixed pivot F');

  assert.equal(sourceReference.brownPlate337.imageWidth, 525);
  assert.equal(sourceReference.brownPlate337.imageHeight, 525);
  assert.match(sourceReference.brownPlate337.inferredTopology,
    /exact midpoint C/);
  assert.deepEqual(sourceReference.officialAnimationView, {
    canvasHeight: 525,
    canvasWidth: 525,
    minimum: new THREE.Vector2(-20.683712, -15.631788),
    viewHeight: 24,
    viewWidth: 24,
  });
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    edition: 21,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.officialDescription, movement.description);
  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(-20.683712, -15.631788)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(0, 525), 0, 'official lower-left view corner');
  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(3.316288, 8.368212)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(525, 0), 1.2e-13,
  'official upper-right view corner');
  disposeModel(model.root);
});

test('movement 337 follows the official smooth rocking-beam law', () => {
  const model = createMovementModel(catalog.movements[336]);
  const { canonicalStates, geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 8192);
    const sine = Math.sin(state.inputAngle);
    const cosine = Math.cos(state.inputAngle);
    near(state.beam.angle, -geometry.beamHalfSwing * sine, 0,
      `beam angle at ${sample}`);
    near(state.beam.angularVelocity,
      -geometry.beamHalfSwing * cosine * geometry.inputAngularSpeed, 0,
    `beam angular velocity at ${sample}`);
    near(state.beam.angularAcceleration,
      geometry.beamHalfSwing * sine * geometry.inputAngularSpeed ** 2, 5e-16,
    `beam angular acceleration at ${sample}`);
    near(state.pointB.distanceTo(geometry.beamPivotO),
      geometry.beamPinRadius, 9e-16,
    `constant beam radius O-B at ${sample}`);
    vector2Near(state.pointB, new THREE.Vector2(
      -geometry.beamPinRadius * Math.cos(state.beam.angle),
      -geometry.beamPinRadius * Math.sin(state.beam.angle),
    ), 0, `beam pin B transform at ${sample}`);
  }
  near(canonicalStates.upperPistonReversal.beam.angle,
    -geometry.beamHalfSwing, 0, 'upper-reversal beam angle');
  near(canonicalStates.lowerPistonReversal.beam.angle,
    geometry.beamHalfSwing, 0, 'lower-reversal beam angle');
  near(canonicalStates.beamLevelDescending.beam.angle, 0, 0,
    'starting level beam');
  near(canonicalStates.beamLevelAscending.beam.angle, 0, 5e-17,
    'opposite level beam');
  disposeModel(model.root);
});

test('movement 337 closes both rigid rods and keeps C at the exact midpoint', () => {
  const model = createMovementModel(catalog.movements[336]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 8192);
    near(state.pointD.distanceTo(state.pointB),
      geometry.vibratingRodLength, 4e-15,
    `short rod B-D at ${sample}`);
    near(state.pointD.distanceTo(geometry.radiusPivotF),
      geometry.radiusRodLength, 4e-15,
    `fixed radius rod F-D at ${sample}`);
    near(state.pointC.distanceTo(state.pointB),
      geometry.vibratingRodMidpointDistance, 2.5e-15,
    `B-C midpoint half at ${sample}`);
    near(state.pointC.distanceTo(state.pointD),
      geometry.vibratingRodMidpointDistance, 2.5e-15,
    `C-D midpoint half at ${sample}`);
    vector2Near(state.pointC,
      state.pointB.clone().add(state.pointD).multiplyScalar(0.5), 0,
    `exact midpoint construction at ${sample}`);
    vector2Near(state.pointCVelocity,
      state.pointBVelocity.clone().add(state.pointDVelocity)
        .multiplyScalar(0.5), 0,
    `midpoint velocity at ${sample}`);
    vector2Near(state.pointCAcceleration,
      state.pointBAcceleration.clone().add(state.pointDAcceleration)
        .multiplyScalar(0.5), 0,
    `midpoint acceleration at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 337 quantifies the genuine near-straight midpoint locus', () => {
  const model = createMovementModel(catalog.movements[336]);
  const { canonicalStates, geometry, stateAtTime } = model.root.userData;
  let maximumDeviation = 0;
  let minimumX = Infinity;
  let maximumX = -Infinity;
  let minimumY = Infinity;
  let maximumY = -Infinity;

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 16384);
    maximumDeviation = Math.max(maximumDeviation,
      Math.abs(state.pistonLateralDeviation));
    minimumX = Math.min(minimumX, state.pointC.x);
    maximumX = Math.max(maximumX, state.pointC.x);
    minimumY = Math.min(minimumY, state.pointC.y);
    maximumY = Math.max(maximumY, state.pointC.y);
  }
  near(maximumDeviation, geometry.maximumLateralDeviation, 3e-9,
    'maximum midpoint lateral deviation');
  near(minimumX, geometry.minimumPistonX, 3e-9,
    'minimum midpoint abscissa');
  near(maximumX, geometry.maximumPistonX, 3e-9,
    'maximum midpoint abscissa');
  near((minimumX + maximumX) / 2, geometry.nominalPistonLineX, 2e-11,
    'symmetric nominal piston line');
  near(minimumY, geometry.minimumPistonY, 3e-9,
    'minimum midpoint ordinate');
  near(maximumY, geometry.maximumPistonY, 3e-9,
    'maximum midpoint ordinate');
  near(maximumY - minimumY, geometry.outputStroke, 3e-9,
    'midpoint piston stroke');
  assert.ok(maximumDeviation / geometry.sourceScale > 0.01427);
  assert.ok(maximumDeviation / geometry.sourceScale < 0.01428);
  assert.ok(geometry.outputStroke / geometry.sourceScale > 6.8391);
  assert.ok(geometry.outputStroke / geometry.sourceScale < 6.8392);
  assert.ok(canonicalStates.upperPistonReversal.pointC.y
    > canonicalStates.beamLevelDescending.pointC.y);
  assert.ok(canonicalStates.lowerPistonReversal.pointC.y
    < canonicalStates.beamLevelDescending.pointC.y);
  assert.ok(geometry.maximumLateralDeviation > 0,
    'the historical parallel motion is approximate rather than forced straight');
  disposeModel(model.root);
});

test('movement 337 analytic beam and linkage rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[336]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-5;
  const pointFields = [
    ['pointB', 'pointBVelocity', 'pointBAcceleration'],
    ['pointC', 'pointCVelocity', 'pointCAcceleration'],
    ['pointD', 'pointDVelocity', 'pointDAcceleration'],
  ];

  for (const time of [0.13, 0.46, 0.88, 1.27, 1.69, 2.14, 2.57, 3.02, 3.48, 3.81]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    for (const [pointKey, velocityKey, accelerationKey] of pointFields) {
      vector2Near(after[pointKey].clone().sub(before[pointKey])
        .multiplyScalar(1 / (2 * step)), state[velocityKey], 2.6e-9,
      `${pointKey} velocity at ${time}`);
      vector2Near(after[velocityKey].clone().sub(before[velocityKey])
        .multiplyScalar(1 / (2 * step)), state[accelerationKey], 7e-9,
      `${pointKey} acceleration at ${time}`);
    }
    near((after.beam.angle - before.beam.angle) / (2 * step),
      state.beam.angularVelocity, 1.4e-10,
    `beam angular velocity at ${time}`);
    near((after.beam.angularVelocity - before.beam.angularVelocity)
      / (2 * step), state.beam.angularAcceleration, 4e-10,
    `beam angular acceleration at ${time}`);
    for (const link of ['vibratingRod', 'radiusRod']) {
      near((after[link].angle - before[link].angle) / (2 * step),
        state[link].angularVelocity, 1.8e-9,
      `${link} angular velocity at ${time}`);
      near((after[link].angularVelocity - before[link].angularVelocity)
        / (2 * step), state[link].angularAcceleration, 5e-9,
      `${link} angular acceleration at ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 337 renderer binds B, midpoint C, D, and both fixed pivots', () => {
  const model = createMovementModel(catalog.movements[336]);
  const {
    animationTiming,
    blocks,
    contacts,
    stateAtTime,
  } = model.root.userData;
  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  model.root.updateMatrixWorld(true);
  const fixedFrameMatrix = blocks.fixedFrame.matrixWorld.clone();
  for (const time of [0, 0.31, 0.77, 1.22, 1.68, 2.13, 2.61, 3.08, 3.54, 4]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.beam.rotation.z, state.beam.angle, 0,
      `rendered beam angle at ${time}`);
    near(blocks.vibratingRod.rotation.z, state.vibratingRod.angle, 0,
      `rendered B-D angle at ${time}`);
    near(blocks.radiusRod.rotation.z, state.radiusRod.angle, 0,
      `rendered F-D angle at ${time}`);
    vector3Near(blocks.pointBAnchor.getWorldPosition(new THREE.Vector3()),
      new THREE.Vector3(state.pointB.x, state.pointB.y, 0.04),
    8e-16, `beam pin B at ${time}`);
    vector3Near(blocks.vibratingRodStartAnchor.getWorldPosition(
      new THREE.Vector3()),
    new THREE.Vector3(state.pointB.x, state.pointB.y, 0.39),
    0, `short rod at B at ${time}`);
    vector3Near(blocks.vibratingRodMidpointAnchor.getWorldPosition(
      new THREE.Vector3()),
    new THREE.Vector3(state.pointC.x, state.pointC.y, 0.39),
    1.3e-15, `short rod midpoint C at ${time}`);
    vector3Near(blocks.vibratingRodEndAnchor.getWorldPosition(
      new THREE.Vector3()),
    new THREE.Vector3(state.pointD.x, state.pointD.y, 0.39),
    2e-15, `short rod at D at ${time}`);
    vector3Near(blocks.radiusRodEndAnchor.getWorldPosition(
      new THREE.Vector3()),
    new THREE.Vector3(state.pointD.x, state.pointD.y, 0.70),
    3e-15, `radius rod at D at ${time}`);
    vector3Near(blocks.outputAnchor.getWorldPosition(new THREE.Vector3()),
      new THREE.Vector3(state.pointC.x, state.pointC.y, 0.90),
    0, `piston point C at ${time}`);
    vector3Near(contacts.beamAtB.point,
      new THREE.Vector3(state.pointB.x, state.pointB.y, 0.30), 0,
    `live B contact at ${time}`);
    vector3Near(contacts.pistonAtC.point,
      new THREE.Vector3(state.pointC.x, state.pointC.y, 0.63), 0,
    `live C contact at ${time}`);
    vector3Near(contacts.radiusAtD.point,
      new THREE.Vector3(state.pointD.x, state.pointD.y, 0.55), 0,
    `live D contact at ${time}`);
    assert.ok(blocks.fixedFrame.matrixWorld.equals(fixedFrameMatrix));
  }

  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 8.4, 'radius pin F through the far beam boss');
  assert.ok(size.y > 3.9, 'beam top through the lower piston-rod end');
  assert.ok(size.z > 1.2,
    'beam, short rod, radius rod and front piston rod occupy depth');
  const drawnRoles = [];
  model.root.traverse((object) => drawnRoles.push(object.userData.role ?? ''));
  // Pin F is a bare short stub: no bracket or column carries it.
  assert.equal(drawnRoles.some((role) => /bed-rail|upright|standard|guide-rail|piston-head|foot|floor-column|bracket-of-radius-pin-F/.test(role)), false,
    'Brown draws no engine bed, standards, piston guides or piston head');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const model336 = createMovementModel(catalog.movements[335]);
  assert.equal(model336.root.userData.fidelity, 'authored');
  assert.notEqual(model336.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(model336.root.userData.blocks.rockshaft.parent,
    model336.root.userData.blocks.fixedFrame);
  disposeModel(model336.root);
  disposeModel(model.root);
});

test('movement 337 closes exactly and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[336]);
  const { blocks, canonicalTimes, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);
  near(closure.phase, start.phase, 0, 'source phase closure');
  near(closure.inputAngle, start.inputAngle, 0, 'input phase closure');
  near(closure.beam.angle, start.beam.angle, 9e-17,
    'rocking-beam closure');
  vector2Near(closure.pointB, start.pointB, 9e-16, 'B closure');
  vector2Near(closure.pointC, start.pointC, 1e-15, 'C closure');
  vector2Near(closure.pointD, start.pointD, 1e-15, 'D closure');
  near(closure.unwrappedInputAngle, Math.PI * 2, 0,
    'one unwrapped input turn');
  model.update(canonicalTimes.cycleClosure);
  near(blocks.beam.rotation.z, start.beam.angle, 9e-17,
    'rendered beam closure');
  vector3Near(blocks.output.position,
    new THREE.Vector3(start.pointC.x, start.pointC.y, 0), 1e-15,
  'rendered piston closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
