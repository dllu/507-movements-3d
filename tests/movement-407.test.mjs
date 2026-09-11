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
  'cord-set-inextensible-elastic-wood-half-arch-clamped-tangent-to-jamb-with-locked-apex-slide-and-tip-pencil';

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

test('movement 407 is one elastic arch bar, one slotted base and locked slide, one cord, one fulcrum, and one tip pencil', () => {
  const movement = catalog.movements[406];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 407);
  assert.equal(movement.number, '407');
  assert.equal(movement.category, 'Springs & balances');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /one elastic wood arch bar/);
  assert.match(data.mechanism, /base fulcrum preserves tangency/);
  assert.match(data.mechanism, /cord runs from its pencil-carrying tip/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.deepEqual(degreesOfFreedom.inputs,
    ['operator cord take-up after locking the apex slide']);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(blocks.elasticBar.parent, model.root);
  assert.equal(blocks.baseBar.parent, model.root);
  assert.equal(blocks.slot.parent, model.root);
  assert.equal(blocks.slide.parent, model.root);
  assert.equal(blocks.cord.parent, model.root);
  assert.equal(blocks.pencil.parent, model.root);
  assert.equal(blocks.fulcrumPiece.parent, model.root);
  assert.equal(blocks.jambs.length, 2);

  const roles = [];
  const bars = [];
  const cords = [];
  const belts = [];
  const gears = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.role?.startsWith('single-inextensible-elastic')) {
      bars.push(object);
    }
    if (object.userData.role?.startsWith('single-working-cord')) {
      cords.push(object);
    }
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.teeth) gears.push(object);
  });
  assert.equal(bars.length, 1);
  assert.equal(cords.length, 1);
  assert.deepEqual(belts, []);
  assert.deepEqual(gears, []);
  for (const role of [
    'horizontal-slotted-bar-set-on-springing-line',
    'longitudinal-slot-in-horizontal-bar',
    'apex-position-slide-locked-in-horizontal-slot',
    'slide-pin-carrying-cord-loop',
    'cord-loop-around-slide-pin',
    'base-fulcrum-piece-maintaining-tangency-to-jamb',
    'single-inextensible-elastic-wood-arch-bar-fixed-at-left-springing',
    'upper-working-edge-tangent-to-jamb-and-meeting-apex',
    'pencil-secured-at-elastic-bar-and-cord-connection',
    'selected-left-half-of-pointed-arch',
    'mirrored-right-half-completing-pointed-arch',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 407 records Brown’s plate, written setup, and unavailable-animation boundary', () => {
  const movement = catalog.movements[406];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate407;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_407.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Horizontal bar is slotted/);
  assert.match(movement.description, /slide having pin for loop of cord/);
  assert.match(movement.description, /Arch bar of elastic wood/);
  assert.match(movement.description, /upper edge on springing line/);
  assert.match(movement.description, /tangential relation to jamb/);
  assert.match(movement.description, /pencil is secured.*connection with cord/);
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
  assert.deepEqual(plate.springingApproximatePixels, [72, 414]);
  assert.deepEqual(plate.apexApproximatePixels, [419, 113]);
  assert.deepEqual(plate.jambApproximateBoundsPixels, [72, 12, 95, 365]);
  assert.deepEqual(plate.horizontalBarApproximateBoundsPixels,
    [22, 387, 501, 444]);
  assert.deepEqual(plate.slotApproximateBoundsPixels,
    [134, 404, 475, 427]);
  assert.deepEqual(plate.slidePinApproximatePixels, [419, 420]);
  assert.deepEqual(plate.fulcrumApproximateBoundsPixels,
    [70, 352, 134, 416]);
  assert.equal(evidence.explicitInBrownDescription.length, 8);
  assert.match(evidence.engravingEvidence,
    /one nearly vertical cord.*one thick elastic strip/);
  assert.match(evidence.reconstructionDisclosure,
    /uniform-curvature intermediate setup shapes.*independently synthesized/);
  disposeModel(model.root);
});

test('movement 407 derives an exact constant-length circular half-arch tangent to the jamb and its pointed mirror', () => {
  const model = createMovementModel(catalog.movements[406]);
  const data = model.root.userData;
  const { geometry, sourcePose } = data;
  const maximumPath = data.pathAtBend(1);

  near(geometry.maximumTurningAngle,
    2 * Math.atan(geometry.halfSpan / geometry.rise), 0,
  'turning angle from prescribed span and rise');
  near(geometry.finalCircleRadius,
    geometry.rise / Math.sin(geometry.maximumTurningAngle), 0,
  'circle radius from rise and turning angle');
  near(geometry.elasticBarLength,
    geometry.finalCircleRadius * geometry.maximumTurningAngle, 0,
  'constant working-edge length');
  vectorNear(maximumPath.outerPoints[0],
    new THREE.Vector2(geometry.leftSpringingX, geometry.springingY),
    0, 'left springing point');
  vectorNear(maximumPath.tip, geometry.apex, 0, 'selected apex');
  vectorNear(data.tangentOnWorkingEdge(0, 1),
    new THREE.Vector2(0, 1), 0, 'vertical jamb tangent');

  let maximumCircleResidual = 0;
  for (const point of maximumPath.outerPoints) {
    maximumCircleResidual = Math.max(
      maximumCircleResidual,
      Math.abs(point.distanceTo(geometry.finalLeftCircleCenter)
        - geometry.finalCircleRadius),
    );
  }
  assert.ok(maximumCircleResidual < 4.5e-16);
  const rightSpringing = new THREE.Vector2(
    geometry.rightSpringingX,
    geometry.springingY,
  );
  near(rightSpringing.distanceTo(geometry.finalRightCircleCenter),
    geometry.finalCircleRadius, 4.5e-16,
  'mirrored right springing on circle');
  near(geometry.apex.distanceTo(geometry.finalRightCircleCenter),
    geometry.finalCircleRadius, 4.5e-16,
  'apex on mirrored circle');
  assert.ok(Math.abs(Math.cos(geometry.maximumTurningAngle)) > 0.13,
    'the mirrored halves meet with a point, not a horizontal tangent');
  near(sourcePose.bend, 1, 0, 'source pose at greatest bend');
  vectorNear(sourcePose.pencilPoint, geometry.apex, 0,
    'source pencil at apex');
  disposeModel(model.root);
});

test('movement 407 keeps one fixed base point, one vertical base tangent, and one inextensible edge throughout setup', () => {
  const model = createMovementModel(catalog.movements[406]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  let maximumBaseResidual = 0;
  let maximumTangencyResidual = 0;
  let maximumPolylineResidual = 0;
  let minimumBend = Infinity;
  let maximumBend = -Infinity;
  let minimumCordLength = Infinity;
  let maximumCordLength = -Infinity;
  let minimumTakeUp = Infinity;
  let maximumTakeUp = -Infinity;

  for (let sample = -10000; sample <= 20000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 10000);
    maximumBaseResidual = Math.max(maximumBaseResidual,
      Math.abs(state.basePositionResidual));
    maximumTangencyResidual = Math.max(maximumTangencyResidual,
      Math.abs(state.baseTangencyResidual));
    maximumPolylineResidual = Math.max(maximumPolylineResidual,
      Math.abs(state.barPolylineLengthResidual));
    minimumBend = Math.min(minimumBend, state.bend);
    maximumBend = Math.max(maximumBend, state.bend);
    minimumCordLength = Math.min(minimumCordLength,
      state.workingCordLength);
    maximumCordLength = Math.max(maximumCordLength,
      state.workingCordLength);
    minimumTakeUp = Math.min(minimumTakeUp, state.cordTakeUp);
    maximumTakeUp = Math.max(maximumTakeUp, state.cordTakeUp);
    assert.equal(state.path.outerPoints.length,
      geometry.barSampleCount);
    assert.equal(state.path.innerPoints.length,
      geometry.barSampleCount);
    vectorNear(state.path.tip, state.tip, 1e-13,
      'analytic and sampled tip');
    assert.equal(state.barAnalyticLengthResidual, 0);
  }
  assert.equal(maximumBaseResidual, 0);
  assert.equal(maximumTangencyResidual, 0);
  assert.ok(maximumPolylineResidual < 6.9e-6);
  near(minimumBend, 0, 0, 'minimum bend');
  near(maximumBend, 1, 0, 'maximum bend');
  near(minimumCordLength,
    geometry.apex.y - geometry.slidePin.y, 0,
  'vertical cord at apex');
  near(maximumCordLength, geometry.relaxedCordLength, 0,
    'relaxed working cord length');
  near(minimumTakeUp, 0, 0, 'no take-up when straight');
  assert.ok(maximumTakeUp > 2.27);
  disposeModel(model.root);
});

test('movement 407 analytic tip and cord rates match finite differences and both setup reversals are smooth', () => {
  const model = createMovementModel(catalog.movements[406]);
  const { geometry, stateAtTime } = model.root.userData;
  const velocityEpsilon = 1e-6;
  const accelerationEpsilon = 1e-4;

  for (const time of [0.17, 0.71, 1.43, 2.28, 3.72, 4.84, 5.61]) {
    const before = stateAtTime(time - velocityEpsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + velocityEpsilon);
    const beforeAcceleration = stateAtTime(time - accelerationEpsilon);
    const afterAcceleration = stateAtTime(time + accelerationEpsilon);
    near(state.bendRate,
      (after.bend - before.bend) / (2 * velocityEpsilon),
      2.4e-10, 'bend rate');
    const finiteTipVelocity = after.tip.clone()
      .sub(before.tip)
      .multiplyScalar(1 / (2 * velocityEpsilon));
    vectorNear(state.tipVelocity, finiteTipVelocity, 1e-9,
      'tip velocity');
    const finiteTipAcceleration = afterAcceleration.tipVelocity.clone()
      .sub(beforeAcceleration.tipVelocity)
      .multiplyScalar(1 / (2 * accelerationEpsilon));
    vectorNear(state.tipAcceleration, finiteTipAcceleration, 2e-8,
      'tip acceleration');
    near(state.workingCordSpeed,
      (after.workingCordLength - before.workingCordLength)
        / (2 * velocityEpsilon),
    8e-10, 'working cord rate');
  }
  for (const time of [0, geometry.cycleDuration / 2,
    geometry.cycleDuration]) {
    const state = stateAtTime(time);
    near(state.bendRate, 0, 0, 'reversal bend rate');
    near(state.bendAcceleration, 0, 0,
      'reversal bend acceleration');
    vectorNear(state.tipVelocity, new THREE.Vector2(), 0,
      'reversal tip velocity');
    vectorNear(state.tipAcceleration, new THREE.Vector2(), 0,
      'reversal tip acceleration');
  }
  assert.match(stateAtTime(0).bendLaw.direction, /relaxing/);
  assert.match(stateAtTime(geometry.cycleDuration / 2).bendLaw.direction,
    /bending-to-apex/);
  disposeModel(model.root);
});

test('movement 407 update binds the dynamic ribbon, tip pencil, and both cord endpoints in real 3D contact', () => {
  const model = createMovementModel(catalog.movements[406]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const positions = blocks.elasticBar.geometry.getAttribute('position');
  const sourcePositions = Array.from(positions.array);

  assert.equal(positions.usage, THREE.DynamicDrawUsage);
  assert.equal(positions.count, geometry.barSampleCount * 4);
  assert.equal(blocks.workingEdge.geometry.getAttribute('position').count,
    geometry.barSampleCount);
  for (const fraction of [0, 0.13, 0.31, 0.5, 0.79, 1]) {
    const time = geometry.cycleDuration * fraction;
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    vectorNear(blocks.pencil.position,
      new THREE.Vector3(state.tip.x, state.tip.y, 0), 0,
    'rendered pencil at bar tip');
    const cordStart = blocks.cord.localToWorld(
      new THREE.Vector3(0, -0.5, 0),
    );
    const cordEnd = blocks.cord.localToWorld(
      new THREE.Vector3(0, 0.5, 0),
    );
    vectorNear(cordStart,
      new THREE.Vector3(state.slidePin.x, state.slidePin.y, 0.33),
      1e-13, 'rendered cord at slide loop');
    vectorNear(cordEnd,
      new THREE.Vector3(state.tip.x, state.tip.y, 0.33),
      1e-13, 'rendered cord at tip collar');
    const collar = blocks.pencil.children.find(({ userData }) =>
      userData.role === 'white-cord-and-bar-tip-connection-collar');
    vectorNear(collar.getWorldPosition(new THREE.Vector3()), cordEnd,
      1e-13, 'tip collar and cord endpoint');
    const pencilPoint = blocks.pencil.children.find(({ userData }) =>
      userData.role === 'pencil-point-on-drawing-board');
    near(pencilPoint.getWorldPosition(new THREE.Vector3()).z,
      -0.265, 0, 'pencil tip on board');
    assert.equal(data.contacts.slideInHorizontalSlot.locked, true);
    near(data.contacts.barAtFixedClamp.positionResidual, 0, 0,
      'rendered clamp position');
    near(data.contacts.barAtFixedClamp.tangencyResidual, 0, 0,
      'rendered clamp tangency');
  }
  model.update(geometry.cycleDuration / 2);
  assert.notDeepEqual(Array.from(positions.array), sourcePositions);
  model.update(geometry.cycleDuration);
  assert.deepEqual(Array.from(positions.array), sourcePositions);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier', () => {
  const movement507 = catalog.movements[506];
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
});
