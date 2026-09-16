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
  'sliding-square-against-directrix-with-taut-focus-thread-and-pencil-bight-tracing-parabola';

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

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

test('movement 406 is one translating square, one fixed straightedge, one two-leg thread, one focus, and one pencil', () => {
  const movement = catalog.movements[405];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 406);
  assert.equal(movement.number, '406');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /one square slides by its stock/);
  assert.match(data.mechanism, /one constant-length thread/);
  assert.match(data.mechanism, /equal focus and directrix distances/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.deepEqual(degreesOfFreedom.inputs,
    ['manual horizontal translation of the square']);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(blocks.straightedge.parent, model.root);
  assert.equal(blocks.square.parent, model.root);
  assert.equal(blocks.stock.parent, blocks.square);
  assert.equal(blocks.blade.parent, blocks.square);
  assert.equal(blocks.threadAnchor.parent, blocks.square);
  assert.equal(blocks.focusCord.parent, model.root);
  assert.equal(blocks.bladeCord.parent, model.root);
  assert.equal(blocks.focusPin.parent, model.root);
  assert.equal(blocks.pencil.parent, model.root);

  const roles = [];
  const belts = [];
  const gears = [];
  const threadSegments = [];
  const squares = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.teeth) gears.push(object);
    if (object.userData.role?.startsWith('taut-thread-segment')) {
      threadSegments.push(object);
    }
    if (object.userData.role?.startsWith('single-rigid-square')) {
      squares.push(object);
    }
  });
  assert.deepEqual(belts, []);
  assert.deepEqual(gears, []);
  assert.equal(threadSegments.length, 2);
  assert.equal(squares.length, 1);
  for (const role of [
    'fixed-straightedge-with-near-edge-coincident-with-directrix',
    'white-near-edge-marking-the-directrix',
    'single-rigid-square-sliding-with-stock-against-straightedge',
    'square-stock-maintaining-contact-with-directrix-straightedge',
    'square-blade-perpendicular-to-directrix-and-parallel-to-axis',
    'fixed-parabola-focus-thread-pin',
    'thread-end-looped-on-focus-pin',
    'thread-end-fixed-to-free-end-of-square-blade',
    'pencil-held-in-thread-bight-and-against-square-blade',
    'required-parabola-locus-equal-focus-and-directrix-distance',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 406 records Brown’s plate, written construction, and unavailable-animation boundary', () => {
  const movement = catalog.movements[405];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate406;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_406.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /base, altitude, focus, and directrix/);
  assert.match(movement.description, /straight edge.*coinciding with directrix/);
  assert.match(movement.description, /square with stock against the same/);
  assert.match(movement.description, /blade is parallel with the axis/);
  assert.match(movement.description, /pencil in bight of thread/);
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
  assert.deepEqual(plate.straightedgeApproximateBoundsPixels,
    [35, 99, 501, 148]);
  assert.equal(plate.bladeWorkingXApproximatePixels, 165);
  assert.deepEqual(plate.focusApproximatePixels, [220, 223]);
  assert.deepEqual(plate.vertexApproximatePixels, [220, 191]);
  assert.deepEqual(plate.bladeEndApproximatePixels, [165, 498]);
  assert.deepEqual(plate.baseEndpointsApproximatePixels,
    [52, 466, 390, 466]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence,
    /horizontal straightedge.*translating square/);
  assert.match(evidence.reconstructionDisclosure,
    /equal focus\/directrix distance and constant thread length are exact/);
  disposeModel(model.root);
});

test('movement 406 derives the exact parabola, base, altitude, focus, directrix, and thread length', () => {
  const model = createMovementModel(catalog.movements[405]);
  const data = model.root.userData;
  const { geometry, sourcePose } = data;

  near(geometry.directrixY, geometry.focalLength, 0,
    'directrix above vertex by focal length');
  vectorNear(geometry.focus,
    new THREE.Vector2(0, -geometry.focalLength), 0,
  'focus below vertex by focal length');
  vectorNear(geometry.vertex, new THREE.Vector2(0, 0), 0,
    'vertex at origin');
  near(geometry.threadLength, geometry.bladeLength, 0,
    'thread equals directrix-to-anchor blade length');
  near(geometry.targetBaseY,
    -(geometry.targetHalfWidth ** 2) / (4 * geometry.focalLength),
  0, 'base chord height');

  for (let sample = 0; sample <= 20000; sample += 1) {
    const x = THREE.MathUtils.lerp(
      -geometry.targetHalfWidth,
      geometry.targetHalfWidth,
      sample / 20000,
    );
    const point = new THREE.Vector2(x, data.parabolaY(x));
    near(point.distanceTo(geometry.focus),
      geometry.directrixY - point.y, 8.9e-16,
    'target point equal focus/directrix distances');
    near(point.y + point.x ** 2 / (4 * geometry.focalLength),
      0, 0, 'target analytic parabola');
  }
  near(sourcePose.squareOffset, geometry.sourceSquareOffset, 1.1e-15,
    'source square offset from plate proportions');
  assert.ok(sourcePose.squareOffset < 0);
  assert.match(sourcePose.setting, /left of the focus axis/);
  disposeModel(model.root);
});

test('movement 406 closes blade contact, equal-distance locus, stock contact, and thread length at every pose', () => {
  const model = createMovementModel(catalog.movements[405]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  let maximumEquationResidual = 0;
  let maximumDirectrixResidual = 0;
  let maximumThreadResidual = 0;
  let maximumBladeResidual = 0;
  let maximumStockResidual = 0;
  let minimumBladeSegmentLength = Infinity;
  let maximumPerpendicularDistance = -Infinity;

  for (let sample = -10000; sample <= 20000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 10000);
    maximumEquationResidual = Math.max(maximumEquationResidual,
      Math.abs(state.parabolaEquationResidual));
    maximumDirectrixResidual = Math.max(maximumDirectrixResidual,
      Math.abs(state.directrixDistanceResidual));
    maximumThreadResidual = Math.max(maximumThreadResidual,
      Math.abs(state.threadLengthResidual));
    maximumBladeResidual = Math.max(maximumBladeResidual,
      Math.abs(state.pencilBladeResidual));
    maximumStockResidual = Math.max(maximumStockResidual,
      Math.abs(state.stockContactResidual));
    minimumBladeSegmentLength = Math.min(minimumBladeSegmentLength,
      state.bladeSegmentLength);
    maximumPerpendicularDistance = Math.max(maximumPerpendicularDistance,
      state.perpendicularDistance);
    near(state.focusSegmentLength, state.perpendicularDistance,
      4.5e-16, 'focus/directrix equality');
    near(state.focusSegmentLength + state.bladeSegmentLength,
      geometry.threadLength, 0, 'thread closure');
    assert.ok(state.pencilPoint.y <= 1e-15);
    assert.ok(state.bladeSegmentLength > 0);
  }
  assert.equal(maximumEquationResidual, 0);
  assert.ok(maximumDirectrixResidual < 4.5e-16);
  assert.equal(maximumThreadResidual, 0);
  assert.equal(maximumBladeResidual, 0);
  assert.equal(maximumStockResidual, 0);
  assert.ok(minimumBladeSegmentLength > .94);
  assert.ok(maximumPerpendicularDistance < geometry.bladeLength);
  disposeModel(model.root);
});

test('movement 406 thread rates cancel and analytic square/pencil kinematics match finite differences', () => {
  const model = createMovementModel(catalog.movements[405]);
  const { geometry, stateAtTime } = model.root.userData;
  let maximumRateResidual = 0;
  for (let sample = -10000; sample <= 20000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 10000);
    maximumRateResidual = Math.max(maximumRateResidual,
      Math.abs(state.segmentRateCancellationResidual));
  }
  assert.ok(maximumRateResidual < 4.5e-16);

  const velocityEpsilon = 1e-6;
  const accelerationEpsilon = 1e-4;
  for (const time of [0.17, 0.9, 1.8, 3.05, 4.2, 5.7, 7.4]) {
    const before = stateAtTime(time - velocityEpsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + velocityEpsilon);
    const beforeAcceleration = stateAtTime(time - accelerationEpsilon);
    const afterAcceleration = stateAtTime(time + accelerationEpsilon);
    near(state.squareSpeed,
      (after.squareOffset - before.squareOffset) / (2 * velocityEpsilon),
      3e-9, 'square speed');
    near(state.pencilVerticalSpeed,
      (after.pencilPoint.y - before.pencilPoint.y)
        / (2 * velocityEpsilon),
    3e-9, 'pencil vertical speed');
    const finiteVelocity = after.pencilPoint.clone()
      .sub(before.pencilPoint)
      .multiplyScalar(1 / (2 * velocityEpsilon));
    vectorNear(state.pencilVelocity, finiteVelocity, 4e-9,
      'pencil velocity');
    const finiteAcceleration = afterAcceleration.pencilVelocity.clone()
      .sub(beforeAcceleration.pencilVelocity)
      .multiplyScalar(1 / (2 * accelerationEpsilon));
    vectorNear(state.pencilAcceleration, finiteAcceleration, 1.2e-8,
      'pencil acceleration');
    near(state.focusSegmentRate,
      (after.focusSegmentLength - before.focusSegmentLength)
        / (2 * velocityEpsilon),
    3e-9, 'focus-side thread rate');
  }
  disposeModel(model.root);
});

test('movement 406 traverses both sides through the vertex and reverses smoothly at the finite blade limits', () => {
  const model = createMovementModel(catalog.movements[405]);
  const { geometry, stateAtTime } = model.root.userData;
  const phaseTime = (targetPhase) => geometry.cycleDuration
    * positiveModulo(targetPhase - geometry.sourcePhaseOffset, 1);
  const leftExtreme = stateAtTime(phaseTime(0.75));
  const rightExtreme = stateAtTime(phaseTime(0.25));
  const firstVertex = stateAtTime(phaseTime(0));
  const secondVertex = stateAtTime(phaseTime(0.5));

  near(leftExtreme.squareOffset, -geometry.maximumSquareOffset, 0,
    'left square limit');
  near(rightExtreme.squareOffset, geometry.maximumSquareOffset, 0,
    'right square limit');
  near(leftExtreme.squareSpeed, 0, 3e-16,
    'left smooth reversal');
  near(rightExtreme.squareSpeed, 0, 1.1e-16,
    'right smooth reversal');
  for (const vertexState of [firstVertex, secondVertex]) {
    near(vertexState.squareOffset, 0, 4.6e-16,
      'vertex square coordinate');
    vectorNear(vertexState.pencilPoint, geometry.vertex, 4.6e-16,
      'pencil through vertex');
    near(vertexState.pencilVerticalSpeed, 0, 6.8e-16,
      'horizontal tangent at vertex');
  }
  disposeModel(model.root);
});

test('movement 406 finite cord follows tangent wraps while its guide and pencil retain the ideal locus', () => {
  const model = createMovementModel(catalog.movements[405]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;

  for (const cycleFraction of [0, 0.11, 0.27, 0.49, 0.72, 0.93, 1]) {
    const time = geometry.cycleDuration * cycleFraction;
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.square.position.x, state.squareOffset, 0,
      'rendered square translation');
    near(blocks.square.rotation.z, 0, 0,
      'square remains unrotated');
    vectorNear(blocks.pencil.position,
      new THREE.Vector3(state.pencilPoint.x, state.pencilPoint.y, 0),
      0, 'rendered pencil location');

    const focusStart = blocks.focusCord.localToWorld(
      new THREE.Vector3(0, -0.5, 0),
    );
    const focusEnd = blocks.focusCord.localToWorld(
      new THREE.Vector3(0, 0.5, 0),
    );
    const bladeStart = blocks.bladeCord.localToWorld(
      new THREE.Vector3(0, -0.5, 0),
    );
    const bladeEnd = blocks.bladeCord.localToWorld(
      new THREE.Vector3(0, 0.5, 0),
    );
    const expectedFocus = new THREE.Vector3(
      state.focus.x,
      state.focus.y,
      0.215,
    );
    const expectedBight = new THREE.Vector3(
      state.pencilPoint.x,
      state.pencilPoint.y,
      0.255,
    );
    const expectedBladeEnd = new THREE.Vector3(
      state.bladeEnd.x,
      state.bladeEnd.y,
      0.295,
    );
    near(focusStart.distanceTo(expectedFocus), .100, 1e-13, 'focus wrap radius');
    near(focusEnd.distanceTo(expectedBight.clone().setZ(.215)), .113, 1e-13, 'pencil wrap radius');
    near(focusEnd.clone().sub(focusStart).dot(focusStart.clone().sub(expectedFocus)), 0, 1e-13, 'common tangent at focus');
    near(focusEnd.clone().sub(focusStart).dot(focusEnd.clone().sub(expectedBight.clone().setZ(.215))), 0, 1e-13, 'common tangent at pencil');
    expectedBladeEnd.x += .113;
    vectorNear(bladeStart, expectedBight.clone().add(new THREE.Vector3(.113,0,.040)), 1e-13, 'vertical tangent leaving pencil');
    vectorNear(bladeEnd, expectedBladeEnd, 1e-13, 'blade anchor');
    vectorNear(blocks.threadAnchor.getWorldPosition(new THREE.Vector3()),expectedBladeEnd,1e-13,'visible anchor');
    const bight = blocks.pencil.children.find(({ userData }) =>
      userData.role === 'white-thread-bight-around-pencil');
    vectorNear(bight.getWorldPosition(new THREE.Vector3()),
      expectedBight, 0, 'pencil-bight contact');
    const wrapPositions=bight.geometry.attributes.position;
    const capStart=bight.localToWorld(new THREE.Vector3().fromBufferAttribute(wrapPositions,wrapPositions.count-2));
    const capEnd=bight.localToWorld(new THREE.Vector3().fromBufferAttribute(wrapPositions,wrapPositions.count-1));
    vectorNear(capStart,focusEnd,1e-8,'helical wrap joins free leg');
    vectorNear(capEnd,bladeStart,1e-8,'helical wrap joins guide leg');
    const ringCenter=i=>bight.localToWorld(new THREE.Vector3().fromBufferAttribute(wrapPositions,i*13).add(new THREE.Vector3().fromBufferAttribute(wrapPositions,i*13+6)).multiplyScalar(.5));
    assert.ok(ringCenter(1).sub(ringCenter(0)).normalize().dot(focusEnd.clone().sub(focusStart).normalize())>.998,'smooth free-leg tangent join');
    assert.ok(ringCenter(96).sub(ringCenter(95)).normalize().dot(bladeEnd.clone().sub(bladeStart).normalize())>.998,'smooth guide-leg tangent join');
    assert.ok(bladeStart.z-focusEnd.z>.05,'leg separation exceeds the cord diameter');
    const point = blocks.pencil.children.find(({ userData }) =>
      userData.role === 'pencil-point-on-parabola');
    near(point.getWorldPosition(new THREE.Vector3()).z, -0.248, 0,
      'pencil tip at board face');
    near(data.contacts.stockToStraightedge.residual, 0, 0,
      'rendered stock/directrix contact');
    near(data.contacts.threadAtBladeEnd.totalLengthResidual, 0, 0,
      'rendered thread closure');
  }
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier', () => {
  const movement507 = catalog.movements[506];
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
});
