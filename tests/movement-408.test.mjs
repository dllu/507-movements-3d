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
  'two-preset-leg-centrolinead-sliding-on-two-fixed-board-pins-with-blade-concurrent-at-inaccessible-vanishing-point';

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function cross2(left, right) {
  return left.x * right.y - left.y * right.x;
}

function wrappedAngleDifference(left, right) {
  return Math.atan2(Math.sin(left - right), Math.cos(left - right));
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

test('movement 408 is one rigid two-leg centrolinead sliding on two fixed board pins', () => {
  const movement = catalog.movements[407];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 408);
  assert.equal(movement.number, '408');
  assert.equal(movement.category, 'Universal joints');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /one rigid centrolinead/);
  assert.match(data.mechanism, /two fixed board pins/);
  assert.match(data.mechanism, /one inaccessible vanishing point/);
  assert.equal(degreesOfFreedom.planarRigidBodyCoordinates, 3);
  assert.equal(degreesOfFreedom.scalarContactConstraints, 2);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.deepEqual(degreesOfFreedom.inputs,
    ['manual sweep of the centrolinead joint between the pins']);
  assert.equal(blocks.instrument.parent, model.root);
  assert.equal(blocks.blade.parent, blocks.instrument);
  assert.equal(blocks.legs.upper.body.parent, blocks.instrument);
  assert.equal(blocks.legs.lower.body.parent, blocks.instrument);
  assert.equal(blocks.fixedPins.upper.group.parent, model.root);
  assert.equal(blocks.fixedPins.lower.group.parent, model.root);

  const roles = [];
  const belts = [];
  const toothedObjects = [];
  const rigidInstruments = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.teeth) toothedObjects.push(object);
    if (object.userData.role
      === 'single-rigid-centrolinead-after-both-leg-angles-are-clamped') {
      rigidInstruments.push(object);
    }
  });
  assert.equal(rigidInstruments.length, 1);
  assert.deepEqual(belts, []);
  assert.deepEqual(toothedObjects, []);
  for (const role of [
    'upper-fixed-board-pin',
    'lower-fixed-board-pin',
    'upper-adjustable-leg-body',
    'lower-adjustable-leg-body',
    'upper-working-back-edge-through-joint-center',
    'lower-working-back-edge-through-joint-center',
    'long-straight-blade-whose-upper-drawing-edge-crosses-joint-center',
    'moving-center-joint-at-intersection-of-three-working-lines',
    'visible-arc-of-circle-through-two-pins-joint-and-vanishing-point',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 408 records Brown’s plate, written setup, and unavailable-animation boundary', () => {
  const movement = catalog.movements[407];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate408;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_408.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /drawing edge of blade and back of movable legs should intersect center of joint/);
  assert.match(movement.description, /legs forming it may form unequal angles with blade/);
  assert.match(movement.description, /a pin is inserted vertically for instrument to work against/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.jointApproximatePixels, [169, 264]);
  assert.deepEqual(plate.headApproximateBoundsPixels, [63, 204, 192, 354]);
  assert.deepEqual(plate.bladeApproximateBoundsPixels, [169, 252, 506, 278]);
  assert.deepEqual(plate.upperLegEndApproximatePixels, [39, 62]);
  assert.deepEqual(plate.lowerLegEndApproximatePixels, [29, 462]);
  assert.deepEqual(plate.constructionCircleApproximateBoundsPixels,
    [188, 54, 332, 196]);
  assert.deepEqual(plate.constructionChordApproximatePixels,
    [307, 72, 326, 161]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.engravingEvidence,
    /one long blade.*two separately clamped oblique legs/);
  assert.match(evidence.reconstructionDisclosure,
    /symmetric pin setting.*exact concyclic and line-contact construction/);
  assert.match(sourceReference.historicalGeometry,
    /studs, moving joint, and vanishing point lie on one circle/);
  disposeModel(model.root);
});

test('movement 408 source setting places both pins, the joint, and inaccessible point on one exact circle', () => {
  const model = createMovementModel(catalog.movements[407]);
  const data = model.root.userData;
  const { geometry, sourcePose } = data;
  const circlePoints = [
    geometry.upperPin,
    geometry.lowerPin,
    geometry.sourceJoint,
    geometry.vanishingPoint,
  ];

  for (const point of circlePoints) {
    near(point.distanceTo(geometry.locusCircleCenter),
      geometry.locusCircleRadius, 5e-16,
    'construction-circle radius');
  }
  near(geometry.locusCircleRadius,
    geometry.vanishingDistance / 2, 0,
  'diameter from source joint to vanishing point');
  near(geometry.upperPin.x, geometry.lowerPin.x, 0,
    'fixed-pin chord is transverse');
  near(geometry.upperPin.y, -geometry.lowerPin.y, 0,
    'selected pin setting is symmetric');
  near(sourcePose.bladeAngle, 0, 0, 'horizontal source blade');
  vectorNear(sourcePose.joint, geometry.sourceJoint, 0,
    'source joint');
  assert.ok(geometry.maximumJointCircleAngle < geometry.pinCircleAngle,
    'working joint arc remains between the pins');
  assert.ok(geometry.vanishingPoint.x < -3.8,
    'vanishing point lies beyond the visible left board edge');

  vectorNear(geometry.upperLegDirectionLocal,
    geometry.upperPin.clone().sub(geometry.sourceJoint).normalize(),
    0, 'upper leg preset through source pin');
  vectorNear(geometry.lowerLegDirectionLocal,
    geometry.lowerPin.clone().sub(geometry.sourceJoint).normalize(),
    0, 'lower leg preset through source pin');
  disposeModel(model.root);
});

test('movement 408 preserves circle, blade concurrency, and both fixed pin contacts throughout the sweep', () => {
  const model = createMovementModel(catalog.movements[407]);
  const { geometry, stateAtTime } = model.root.userData;
  let maximumCircleResidual = 0;
  let maximumBladeResidual = 0;
  let maximumUpperResidual = 0;
  let maximumLowerResidual = 0;
  let minimumUpperCoordinate = Infinity;
  let maximumUpperCoordinate = -Infinity;
  let minimumLowerCoordinate = Infinity;
  let maximumLowerCoordinate = -Infinity;

  for (let sample = -10000; sample <= 20000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 10000);
    maximumCircleResidual = Math.max(maximumCircleResidual,
      Math.abs(state.concyclicJointResidual));
    maximumBladeResidual = Math.max(maximumBladeResidual,
      Math.abs(state.bladeVanishingResidual));
    maximumUpperResidual = Math.max(maximumUpperResidual,
      Math.abs(state.upperPinLineResidual));
    maximumLowerResidual = Math.max(maximumLowerResidual,
      Math.abs(state.lowerPinLineResidual));
    minimumUpperCoordinate = Math.min(minimumUpperCoordinate,
      state.upperContactCoordinate);
    maximumUpperCoordinate = Math.max(maximumUpperCoordinate,
      state.upperContactCoordinate);
    minimumLowerCoordinate = Math.min(minimumLowerCoordinate,
      state.lowerContactCoordinate);
    maximumLowerCoordinate = Math.max(maximumLowerCoordinate,
      state.lowerContactCoordinate);
  }
  assert.ok(maximumCircleResidual < 5e-16);
  assert.ok(maximumBladeResidual < 3.5e-16);
  assert.ok(maximumUpperResidual < 5e-16);
  assert.ok(maximumLowerResidual < 5e-16);
  assert.ok(minimumUpperCoordinate > 0);
  assert.ok(minimumLowerCoordinate > 0);
  assert.ok(maximumUpperCoordinate < geometry.visibleLegLength);
  assert.ok(maximumLowerCoordinate < geometry.visibleLegLength);
  disposeModel(model.root);
});

test('movement 408 keeps both leg settings rigid while the drawing edge always aims at the same point', () => {
  const model = createMovementModel(catalog.movements[407]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 720; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 720);
    near(wrappedAngleDifference(
      state.upperLegDirection.angle() - state.bladeAngle,
      geometry.upperLegAngleRelativeToBlade,
    ), 0, 8e-16,
    'fixed upper leg angle');
    near(wrappedAngleDifference(
      state.lowerLegDirection.angle() - state.bladeAngle,
      geometry.lowerLegAngleRelativeToBlade,
    ), 0, 8e-16,
    'fixed lower leg angle');
    near(cross2(
      state.vanishingPoint.clone().sub(state.joint),
      state.bladeDirection,
    ), 0, 3.5e-16, 'fixed vanishing-point concurrency');
    near(state.bladeAngle, state.jointCircleAngle / 2, 0,
      'inscribed-angle relation');
  }
  disposeModel(model.root);
});

test('movement 408 analytic joint and blade rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[407]);
  const { stateAtTime } = model.root.userData;
  const velocityEpsilon = 1e-6;
  const accelerationEpsilon = 1e-4;

  for (const time of [0.17, 0.83, 1.61, 2.49, 3.57, 4.72, 6.31]) {
    const before = stateAtTime(time - velocityEpsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + velocityEpsilon);
    const beforeAcceleration = stateAtTime(time - accelerationEpsilon);
    const afterAcceleration = stateAtTime(time + accelerationEpsilon);
    const finiteJointVelocity = after.joint.clone()
      .sub(before.joint)
      .multiplyScalar(1 / (2 * velocityEpsilon));
    const finiteJointAcceleration = afterAcceleration.jointVelocity.clone()
      .sub(beforeAcceleration.jointVelocity)
      .multiplyScalar(1 / (2 * accelerationEpsilon));
    vectorNear(state.jointVelocity, finiteJointVelocity, 6e-10,
      'joint velocity');
    vectorNear(state.jointAcceleration, finiteJointAcceleration, 8e-9,
      'joint acceleration');
    near(state.bladeAngularSpeed,
      (after.bladeAngle - before.bladeAngle) / (2 * velocityEpsilon),
      1.5e-10, 'blade angular speed');
    near(state.bladeAngularAcceleration,
      (afterAcceleration.bladeAngularSpeed
        - beforeAcceleration.bladeAngularSpeed)
        / (2 * accelerationEpsilon),
    1e-9, 'blade angular acceleration');
  }
  disposeModel(model.root);
});

test('movement 408 traverses both excursions, reverses smoothly, and closes at the source pose', () => {
  const model = createMovementModel(catalog.movements[407]);
  const { geometry, stateAtTime } = model.root.userData;
  const source = stateAtTime(0);
  const upper = stateAtTime(geometry.cycleDuration / 4);
  const center = stateAtTime(geometry.cycleDuration / 2);
  const lower = stateAtTime(3 * geometry.cycleDuration / 4);
  const closure = stateAtTime(geometry.cycleDuration);

  near(source.jointCircleAngle, 0, 0, 'source circle angle');
  near(upper.jointCircleAngle, geometry.maximumJointCircleAngle, 0,
    'upper excursion');
  near(center.jointCircleAngle, 0, 6e-17, 'middle source crossing');
  near(lower.jointCircleAngle, -geometry.maximumJointCircleAngle, 0,
    'lower excursion');
  vectorNear(closure.joint, source.joint, 6e-16, 'cycle closure');
  near(closure.bladeAngle, source.bladeAngle, 6e-17,
    'blade-angle closure');
  near(upper.jointCircleAngularSpeed, 0, 3e-17,
    'upper smooth reversal');
  near(lower.jointCircleAngularSpeed, 0, 8e-17,
    'lower smooth reversal');
  assert.ok(source.jointCircleAngularSpeed > 0);
  assert.ok(center.jointCircleAngularSpeed < 0);
  disposeModel(model.root);
});

test('movement 408 update moves one rigid instrument while both pin axes remain fixed in world space', () => {
  const model = createMovementModel(catalog.movements[407]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const upperPinWorld = blocks.fixedPins.upper.group.position.clone();
  const lowerPinWorld = blocks.fixedPins.lower.group.position.clone();

  for (const fraction of [0, 0.11, 0.25, 0.43, 0.68, 0.75, 1]) {
    const time = geometry.cycleDuration * fraction;
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    vectorNear(blocks.instrument.position,
      new THREE.Vector3(state.joint.x, state.joint.y, 0.04), 0,
    'rendered rigid-instrument joint');
    near(blocks.instrument.rotation.z, state.bladeAngle, 0,
      'rendered rigid-instrument angle');
    vectorNear(blocks.centralJoint.getWorldPosition(new THREE.Vector3()),
      new THREE.Vector3(state.joint.x, state.joint.y, 0.10), 2e-16,
    'rendered central joint');
    vectorNear(blocks.fixedPins.upper.group.position, upperPinWorld, 0,
      'upper pin stays fixed');
    vectorNear(blocks.fixedPins.lower.group.position, lowerPinWorld, 0,
      'lower pin stays fixed');
    assert.equal(data.contacts.upperLegBackEdgeToFixedPin.active, true);
    assert.equal(data.contacts.lowerLegBackEdgeToFixedPin.active, true);
    near(data.contacts.upperLegBackEdgeToFixedPin.lineResidual,
      state.upperPinLineResidual, 0, 'rendered upper contact');
    near(data.contacts.lowerLegBackEdgeToFixedPin.lineResidual,
      state.lowerPinLineResidual, 0, 'rendered lower contact');
  }
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier', () => {
  const movement507 = catalog.movements[506];
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
});
