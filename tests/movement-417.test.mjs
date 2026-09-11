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
  'horizontal-bent-shaft-transverse-crank-journal-double-ball-socket-oblique-rod-to-single-axis-slide';

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

test('movement 417 is one bent shaft A in bearing D, one double-socket rod B, and one rectilinear slide C', () => {
  const movement = catalog.movements[416];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 417);
  assert.equal(movement.number, '417');
  assert.equal(movement.category, 'Cranks & reciprocation');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /Horizontal shaft A rotates in fixed bearing D/);
  assert.match(data.mechanism, /parallel offset journal/);
  assert.match(data.mechanism, /spatial square-root closure/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.slidePositionIndependent, false);
  assert.equal(degreesOfFreedom.rodOrientationIndependent, false);
  assert.equal(degreesOfFreedom.upperSocketRotationIndependent, false);
  assert.equal(degreesOfFreedom.lowerSocketRotationIndependent, false);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(blocks.mainShaft.parent, blocks.shaftRotor);
  assert.equal(blocks.bentWeb.parent, blocks.shaftRotor);
  assert.equal(blocks.bentJournal.parent, blocks.shaftRotor);
  assert.equal(blocks.inputWheel.parent, blocks.shaftRotor);
  assert.equal(blocks.bearingD.parent, blocks.fixedFrame);
  assert.equal(blocks.rodB.parent, model.root);
  assert.equal(blocks.slideC.parent, model.root);
  assert.equal(blocks.upperBall.parent, model.root);
  assert.equal(blocks.lowerBall.parent, blocks.slideC);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'continuous-horizontal-shaft-A-rotor',
    'fixed-bearing-D-around-shaft-A',
    'radial-bend-at-end-of-shaft-A',
    'offset-parallel-bent-journal-of-shaft-A',
    'constant-length-oblique-double-socket-rod-B',
    'upper-universal-socket-of-rod-B',
    'lower-universal-socket-in-slide-C',
    'rectilinearly-reciprocating-slide-C',
    'fixed-single-axis-horizontal-guide-for-C',
    'white-shaft-A-rotation-index',
    'white-slide-C-linear-position-index',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 417 records Brown’s shaft, sockets, slide, half-turn overlay, and unavailable-animation boundary', () => {
  const movement = catalog.movements[416];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourcePose, sourceReference } = data;
  const plate = sourceReference.brownPlate417;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_417.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /Continuous circular motion into a rectilinear reciprocating/);
  assert.match(movement.description,
    /shaft, A, working in a fixed bearing, D, is bent on one end/);
  assert.match(movement.description,
    /socket at the upper end of a rod, B/);
  assert.match(movement.description,
    /lower end.*works in a socket in the slide, C/);
  assert.match(movement.description, /made half a revolution/);
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
    dynamics.backlashClearanceElasticityInertiaLoadsAndForcesModeled,
    false,
  );
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.bentShaftAApproximateBoundsPixels,
    [123, 80, 294, 218]);
  assert.deepEqual(plate.rodBApproximateBoldEndpointsPixels,
    [[159, 169], [241, 388]]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.engravingEvidence,
    /horizontal shaft.*offset parallel journal.*oblique rod B/);
  assert.match(evidence.reconstructionDisclosure,
    /exact three-dimensional rod closure determines C/);
  near(
    sourcePose.dottedAfterHalfRevolution.shaftAngle
      - sourcePose.bold.shaftAngle,
    Math.PI,
    4e-16,
    'source bold/dotted angular separation',
  );
  disposeModel(model.root);
});

test('movement 417 bent journal follows one transverse circle while slide C remains on one exact X guide', () => {
  const model = createMovementModel(catalog.movements[416]);
  const { geometry, stateAtShaftAngle } = model.root.userData;
  const shaftAxisPoint = new THREE.Vector3(
    geometry.bentJournalX,
    geometry.shaftAxisY,
    geometry.shaftAxisZ,
  );
  let minimumZ = Infinity;
  let maximumZ = -Infinity;

  for (let sample = -30000; sample <= 60000; sample += 1) {
    const state = stateAtShaftAngle(Math.PI * 2 * sample / 30000);
    near(state.upperSocket.x, geometry.bentJournalX, 0,
      'journal x fixed');
    near(state.upperSocket.distanceTo(shaftAxisPoint),
      geometry.crankRadius, 3e-16,
      'journal transverse circle');
    near(state.lowerSocket.x, state.slideX, 0, 'lower socket follows C');
    near(state.lowerSocket.y, geometry.slideAxisY, 0,
      'slide guide y');
    near(state.lowerSocket.z, geometry.slideAxisZ, 0,
      'slide guide z');
    minimumZ = Math.min(minimumZ, state.upperSocket.z);
    maximumZ = Math.max(maximumZ, state.upperSocket.z);
  }
  near(minimumZ, -geometry.crankRadius, 0,
    'journal front transverse extreme');
  near(maximumZ, geometry.crankRadius, 0,
    'journal rear transverse extreme');
  disposeModel(model.root);
});

test('movement 417 exact spatial square-root law preserves rod B and reaches Brown’s opposed half-turn slide extremes', () => {
  const model = createMovementModel(catalog.movements[416]);
  const { geometry, stateAtShaftAngle } = model.root.userData;
  let maximumLengthResidual = 0;
  let maximumPositionResidual = 0;

  for (let sample = 0; sample <= 80000; sample += 1) {
    const state = stateAtShaftAngle(Math.PI * 2 * sample / 80000);
    maximumLengthResidual = Math.max(maximumLengthResidual,
      Math.abs(state.rodLengthResidual));
    maximumPositionResidual = Math.max(maximumPositionResidual,
      Math.abs(state.rodPositionConstraintResidual));
    near(state.slideX,
      geometry.bentJournalX + Math.sqrt(
        geometry.socketRodLength ** 2
          - state.transverseDistanceSquared,
      ), 0, 'spatial slide law');
  }
  assert.ok(maximumLengthResidual < 5e-16);
  assert.ok(maximumPositionResidual < 1.8e-15);
  const bold = stateAtShaftAngle(geometry.sourceShaftAngle);
  const dotted = stateAtShaftAngle(geometry.sourceShaftAngle + Math.PI);
  near(bold.slideX, geometry.slideMaximumX, 0,
    'bold-pose slide extreme');
  near(dotted.slideX, geometry.slideMinimumX, 0,
    'dotted-pose slide extreme');
  near(bold.slideX - dotted.slideX, geometry.slideStroke, 0,
    'full slide stroke');
  near(bold.upperSocket.y, geometry.shaftAxisY - geometry.crankRadius,
    0, 'bold lower journal position');
  near(dotted.upperSocket.y,
    geometry.shaftAxisY + geometry.crankRadius,
    0, 'dotted upper journal position');
  disposeModel(model.root);
});

test('movement 417 differentiated position law satisfies rod velocity and acceleration constraints throughout', () => {
  const model = createMovementModel(catalog.movements[416]);
  const { stateAtShaftAngle } = model.root.userData;
  let maximumVelocityResidual = 0;
  let maximumAccelerationResidual = 0;

  for (let sample = -40000; sample <= 80000; sample += 1) {
    const state = stateAtShaftAngle(Math.PI * 2 * sample / 40000);
    maximumVelocityResidual = Math.max(maximumVelocityResidual,
      Math.abs(state.rodVelocityConstraintResidual));
    maximumAccelerationResidual = Math.max(maximumAccelerationResidual,
      Math.abs(state.rodAccelerationConstraintResidual));
    vectorNear(state.lowerSocketVelocity,
      new THREE.Vector3(state.slideSpeed, 0, 0), 0,
      'lower socket velocity follows X guide');
    vectorNear(state.lowerSocketAcceleration,
      new THREE.Vector3(state.slideAcceleration, 0, 0), 0,
      'lower socket acceleration follows X guide');
  }
  assert.ok(maximumVelocityResidual < 3.4e-16);
  assert.ok(maximumAccelerationResidual < 5e-16);
  disposeModel(model.root);
});

test('movement 417 slide moves monotonically between its two reversals and returns over the second half-turn', () => {
  const model = createMovementModel(catalog.movements[416]);
  const { geometry, stateAtShaftAngle } = model.root.userData;
  let previous = Infinity;

  for (let sample = 0; sample <= 30000; sample += 1) {
    const angle = Math.PI * sample / 30000;
    const state = stateAtShaftAngle(angle);
    assert.ok(state.slideX <= previous + 2e-15);
    assert.ok(state.slideSpeed <= 2e-15);
    previous = state.slideX;
  }
  previous = -Infinity;
  for (let sample = 0; sample <= 30000; sample += 1) {
    const angle = Math.PI + Math.PI * sample / 30000;
    const state = stateAtShaftAngle(angle);
    assert.ok(state.slideX >= previous - 2e-15);
    assert.ok(state.slideSpeed >= -2e-15);
    previous = state.slideX;
  }
  near(stateAtShaftAngle(0).slideSpeed, 0, 0,
    'bold-pose reversal speed');
  near(Math.abs(stateAtShaftAngle(Math.PI).slideSpeed), 0, 2e-16,
    'dotted-pose reversal speed');
  assert.ok(geometry.slideStroke > 1.45);
  disposeModel(model.root);
});

test('movement 417 socket geometry is truly spatial rather than a disguised planar crank-slider', () => {
  const model = createMovementModel(catalog.movements[416]);
  const { geometry, stateAtShaftAngle } = model.root.userData;
  const front = stateAtShaftAngle(Math.PI / 2);
  const rear = stateAtShaftAngle(Math.PI * 3 / 2);

  near(front.upperSocket.z, -geometry.crankRadius, 0,
    'front journal excursion');
  near(rear.upperSocket.z, geometry.crankRadius, 0,
    'rear journal excursion');
  near(front.slideX, rear.slideX, 0,
    'equal slide position at opposed depth poses');
  near(front.rodVector.z, geometry.crankRadius, 0,
    'front rod depth component');
  near(rear.rodVector.z, -geometry.crankRadius, 0,
    'rear rod depth component');
  assert.ok(Math.abs(front.rodVector.z) > 0.5);
  disposeModel(model.root);
});

test('movement 417 analytic journal and slide derivatives match finite differences', () => {
  const model = createMovementModel(catalog.movements[416]);
  const { stateAtShaftAngle } = model.root.userData;
  const angularStep = 1e-5;

  for (const angle of [0.17, 0.64, 1.2, 1.9, 2.6, 3.4, 4.1, 4.8, 5.6,
    6.05]) {
    const state = stateAtShaftAngle(angle);
    const timeStep = angularStep / state.shaftSpeed;
    const before = stateAtShaftAngle(angle - angularStep);
    const after = stateAtShaftAngle(angle + angularStep);
    const numericalSlideSpeed = (after.slideX - before.slideX)
      / (2 * timeStep);
    const numericalSlideAcceleration = (
      after.slideSpeed - before.slideSpeed
    ) / (2 * timeStep);
    const numericalUpperVelocity = after.upperSocket.clone()
      .sub(before.upperSocket)
      .multiplyScalar(1 / (2 * timeStep));
    near(numericalSlideSpeed, state.slideSpeed, 4e-10,
      `slide speed at ${angle}`);
    near(numericalSlideAcceleration, state.slideAcceleration, 8e-10,
      `slide acceleration at ${angle}`);
    vectorNear(numericalUpperVelocity, state.upperSocketVelocity, 5e-11,
      `upper socket velocity at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 417 update binds shaft rotation, slide translation, rod length, and moving upper socket to one state', () => {
  const model = createMovementModel(catalog.movements[416]);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.6, 1.4, 2.2, 3, 3.8, 4.7, 5.5]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.shaftRotor.rotation.x, state.shaftAngle, 0,
      'shaft A update');
    near(blocks.slideC.position.x, state.slideX, 0,
      'slide C update');
    near(blocks.rodB.scale.y, geometry.socketRodLength, 5e-16,
      'rod B rendered length');
    vectorNear(blocks.upperBall.position, state.upperSocket, 0,
      'upper ball update');
    vectorNear(blocks.upperSocketCup.position, state.upperSocket, 0,
      'upper socket cup update');
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  sameAngle(closure.shaftAngle, source.shaftAngle, 0,
    'shaft cycle closure');
  near(closure.slideX, source.slideX, 0, 'slide cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.cycleDuration);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 417 bent-shaft geometry', () => {
  const movement417 = catalog.movements[416];
  const movement507 = catalog.movements[506];
  const model417 = createMovementModel(movement417);
  const model507 = createMovementModel(movement507);

  assert.equal(movement417.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model417.root);
  disposeModel(model507.root);
});
