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
  'rhine-reaction-ferry-with-fixed-anchor-taut-radius-rope-stream-deflected-rudder-and-bank-to-bank-circular-arc';
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

test('movement 447 has one fixed anchor, one taut rope, a ferry, and a stream-deflecting rudder', () => {
  const movement = catalog.movements[446];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, constraints, degreesOfFreedom } = data;

  assert.equal(movement.id, 447);
  assert.equal(movement.number, '447');
  assert.equal(movement.category, 'Miscellaneous mechanisms');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.anchor.parent, model.root);
  assert.equal(blocks.boat.parent, model.root);
  assert.equal(blocks.rudderPivot.parent, blocks.boat);
  assert.equal(blocks.rudderBlade.parent, blocks.rudderPivot);
  assert.equal(blocks.rope.parent, model.root);
  assert.equal(blocks.river.parent, model.root);
  assert.equal(constraints.anchorFixed, true);
  assert.equal(constraints.ropeInextensibleAndTaut, true);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.ropeLengthIndependent, false);
  assert.equal(degreesOfFreedom.rudderIndependent, false);
  assert.equal(degreesOfFreedom.boatHeadingIndependent, false);

  const ropes = [];
  const belts = [];
  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.isRope) ropes.push(object);
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.deepEqual(ropes, [blocks.rope]);
  assert.deepEqual(belts, []);
  for (const role of [
    'fixed-anchor-center-of-ferry-arc',
    'single-taut-anchor-rope',
    'reaction-ferry-moving-on-anchor-centered-arc',
    'boat-hull-radial-to-anchor',
    'operator-reversed-rudder-pivot',
    'stream-deflecting-rudder-blade',
    'river-current-driving-rudder-downstream',
    'fixed-downstream-current-arrow-drawn-by-brown',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 447 source evidence and hydrodynamic simplifications are explicit', () => {
  const movement = catalog.movements[446];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate447;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_447.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /passing a boat from one shore.*to the other/);
  assert.match(movement.description, /action of the stream on the rudder/);
  assert.match(movement.description, /arc of a circle.*center.*anchor/);
  assert.match(movement.description, /holds the boat from floating down the stream/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(dynamics.fullHullRudderFreeSurfaceHydrodynamicsModeled, false);
  assert.match(dynamics.steeringSchedule,
    /prescribes a smooth cosine rudder reversal.*does not claim to solve/);
  assert.match(dynamics.streamModel,
    /uniform downstream current.*rudder lift and cable sag are not solved/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateAnchorCenterPixels, [76, 253]);
  assert.deepEqual(plate.approximateBowAttachmentPixels, [231, 255]);
  assert.deepEqual(plate.approximateRudderCenterPixels, [408, 259]);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence,
    /two river banks.*downstream current arrow.*one line.*oblique stern rudder/);
  assert.match(evidence.reconstructionDisclosure,
    /no river width, anchor offset, rope length.*independently engineered/);
  disposeModel(model.root);
});

test('movement 447 bow remains exactly on the anchor-centered circular locus', () => {
  const model = createMovementModel(catalog.movements[446]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  for (let sample = -12000; sample <= 24000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 12000);
    const anchorToBow = state.bowPoint.clone().sub(state.anchorPoint);
    near(anchorToBow.length(), geometry.tetherLength, 9e-16,
      `constant rope radius at ${sample}`);
    vectorNear(anchorToBow.clone().normalize(), state.radial, 3e-16,
      `radial rope direction at ${sample}`);
    near(state.radial.dot(state.tangent), 0, 2e-16,
      `orthogonal path tangent at ${sample}`);
    near(state.boatCenter.clone().sub(state.bowPoint)
      .cross(state.radial).length(), 0, 6e-16,
    `boat center remains radial at ${sample}`);
    near(state.sternPoint.clone().sub(state.bowPoint).length(),
      geometry.sternFromBow, 9e-16,
    `stern outward of bow at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 447 traverses both banks and reverses its rudder smoothly at the correct half-cycle', () => {
  const model = createMovementModel(catalog.movements[446]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const atPhase = (phase) => stateAtInputAngle(FULL_TURN * phase);
  const centerPositive = atPhase(0);
  const positiveBank = atPhase(0.25);
  const centerNegative = atPhase(0.5);
  const negativeBank = atPhase(0.75);

  near(centerPositive.traverseAngle, 0, 0, 'source centerline');
  near(centerPositive.rudderAngle, geometry.maximumRudderAngle, 0,
    'source rudder directs positive crossing');
  near(positiveBank.traverseAngle, geometry.maximumTraverseAngle, 0,
    'positive bank extremum');
  near(positiveBank.traverseAngularSpeed, 0, 1e-16,
    'zero speed at positive bank');
  near(positiveBank.rudderAngle, 0, 1e-16,
    'rudder crosses neutral at positive bank');
  near(centerNegative.traverseAngle, 0, 1e-16,
    'opposite center crossing');
  near(centerNegative.rudderAngle, -geometry.maximumRudderAngle, 0,
    'rudder reversed for negative crossing');
  near(negativeBank.traverseAngle, -geometry.maximumTraverseAngle, 0,
    'negative bank extremum');
  near(negativeBank.traverseAngularSpeed, 0, 2e-16,
    'zero speed at negative bank');
  assert.equal(centerPositive.crossingDirection,
    'crossing-toward-positive-bank');
  assert.equal(centerNegative.crossingDirection,
    'crossing-toward-negative-bank');
  assert.equal(positiveBank.crossingDirection, 'turning-at-bank');
  assert.equal(negativeBank.crossingDirection, 'turning-at-bank');
  disposeModel(model.root);
});

test('movement 447 analytical bow velocity and acceleration agree with finite differences', () => {
  const model = createMovementModel(catalog.movements[446]);
  const { stateAtInputAngle } = model.root.userData;
  const speed = 0.73;
  const step = 1e-5;
  for (const angle of [-4.7, -1.1, 0.3, 2.2, 6.8]) {
    const before = stateAtInputAngle(angle - step, speed).bowPoint;
    const center = stateAtInputAngle(angle, speed);
    const after = stateAtInputAngle(angle + step, speed).bowPoint;
    const numericalDerivativePerAngle = after.clone().sub(before)
      .multiplyScalar(1 / (2 * step));
    const numericalVelocity = numericalDerivativePerAngle
      .multiplyScalar(speed);
    vectorNear(center.bowVelocity, numericalVelocity, 2e-9,
      `bow velocity at ${angle}`);
    const numericalAcceleration = after.clone()
      .addScaledVector(center.bowPoint, -2)
      .add(before)
      .multiplyScalar(speed ** 2 / step ** 2);
    vectorNear(center.bowAcceleration, numericalAcceleration, 2e-5,
      `bow acceleration at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 447 renderer keeps the rope endpoints exact and maps boat and rudder transforms to state', () => {
  const model = createMovementModel(catalog.movements[446]);
  const { blocks, geometry, ropeEndpoints, stateAtTime, update } =
    model.root.userData;
  const anchorPosition = blocks.anchor.position.clone();
  const bankPositions = [blocks.nearBank.position.clone(),
    blocks.farBank.position.clone()];

  for (const phase of [0, 0.125, 0.25, 0.375, 0.5, 0.625,
    0.75, 0.875, 1]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    model.root.updateMatrixWorld(true);
    vectorNear(blocks.boat.position, state.bowPoint, 0,
      `boat bow transform at ${phase}`);
    near(blocks.boat.rotation.y, -state.boatHeadingAngle, 0,
      `radial boat yaw at ${phase}`);
    near(blocks.rudderPivot.rotation.y, state.rudderAngle, 0,
      `rudder transform at ${phase}`);
    near(blocks.rope.scale.y, geometry.tetherLength, 5e-16,
      `rendered rope length at ${phase}`);
    const endpoints = ropeEndpoints();
    vectorNear(endpoints.start, state.anchorPoint, 8e-16,
      `rendered anchor endpoint at ${phase}`);
    vectorNear(endpoints.end, state.bowPoint, 8e-16,
      `rendered bow endpoint at ${phase}`);
    vectorNear(blocks.anchor.position, anchorPosition, 0,
      `fixed anchor at ${phase}`);
    vectorNear(blocks.nearBank.position, bankPositions[0], 0,
      `fixed near bank at ${phase}`);
    vectorNear(blocks.farBank.position, bankPositions[1], 0,
      `fixed far bank at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 447 keeps the whole ferry conservatively inside the two banks and closes without a jump', () => {
  const model = createMovementModel(catalog.movements[446]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  for (let sample = 0; sample < 20000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    assert.ok(Math.abs(state.sternPoint.z) + 0.82
      < geometry.riverHalfWidth,
    `conservative hull clearance at sample ${sample}`);
  }
  const source = stateAtInputAngle(0);
  const closure = stateAtInputAngle(FULL_TURN);
  vectorNear(closure.bowPoint, source.bowPoint, 0,
    'bow cycle closure');
  vectorNear(closure.boatCenter, source.boatCenter, 0,
    'boat cycle closure');
  near(closure.rudderAngle, source.rudderAngle, 0,
    'rudder cycle closure');
  vectorNear(closure.bowVelocity, source.bowVelocity, 0,
    'velocity cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 6.2);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier', () => {
  const movement447 = catalog.movements[446];
  const movement507 = catalog.movements[506];
  const model447 = createMovementModel(movement447);
  const model507 = createMovementModel(movement507);

  assert.equal(movement447.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model447.root);
  disposeModel(model507.root);
});
