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
  assert.match(data.mechanism, /inclined bent end with B held square to it/);
  assert.match(data.mechanism, /slides through a swivel socket in slide C/);
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
  assert.equal(blocks.shaftCollar.parent, blocks.shaftRotor);
  assert.equal(blocks.rodB.parent, blocks.rodBody);
  assert.equal(blocks.upperSocketCup.parent, blocks.rodBody);
  assert.equal(blocks.rodBody.parent, model.root);
  assert.equal(blocks.slideC.parent, model.root);
  assert.equal(blocks.upperBall.parent, blocks.rodBody);
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
    'knuckle-at-bend-of-shaft-A',
    'collar-at-bend-of-shaft-A',
    'inclined-bent-end-of-shaft-A',
    'square-rod-B-sliding-through-socket-in-C',
    'head-A-turning-on-bent-end',
    'lower-universal-socket-in-slide-C',
    'rectilinearly-reciprocating-slide-C',
    'fixed-plank-bed-and-guide-for-slide-C',
    'fixed-T-standard-D-under-bearing',
    'input-crank-arm-fast-on-shaft-A',
    'input-crank-handle-on-arm',
  ]) assert.ok(roles.includes(role), role);
  // Brown draws no rails, wheel or white indices.
  for (const role of roles) assert.doesNotMatch(role, /^white-(?:shaft|slide)-|input-wheel|single-axis-horizontal-guide/);
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
    /head A on its bent left end.*leaning a little to the right.*leaning the other way/);
  assert.match(evidence.reconstructionDisclosure,
    /B held square to the bent end determines C exactly/);
  near(
    sourcePose.dottedAfterHalfRevolution.shaftAngle
      - sourcePose.bold.shaftAngle,
    Math.PI,
    4e-16,
    'source bold/dotted angular separation',
  );
  disposeModel(model.root);
});

test('movement 417 rod root turns on the inclined bent end while slide C remains on one exact X guide', () => {
  const model = createMovementModel(catalog.movements[416]);
  const { geometry, stateAtShaftAngle } = model.root.userData;
  const bend = new THREE.Vector3(geometry.bendX, geometry.shaftAxisY,
    geometry.shaftAxisZ);
  const axis = new THREE.Vector3(1, 0, 0);

  for (let sample = -30000; sample <= 60000; sample += 1) {
    const state = stateAtShaftAngle(Math.PI * 2 * sample / 30000);
    near(state.bentEnd.length(), 1, 3e-16, 'unit bent-end direction');
    near(Math.acos(-state.bentEnd.dot(axis)),
      geometry.bentEndInclination, 2e-8, 'constant bend angle');
    vectorNear(state.upperSocket,
      bend.clone().addScaledVector(state.bentEnd, geometry.rodRootOnBentEnd),
      5e-16, 'rod root on the bent end');
    near(state.lowerSocket.x, state.slideX, 0, 'lower socket follows C');
    near(state.lowerSocket.y, geometry.slideAxisY, 0, 'slide guide y');
    near(state.lowerSocket.z, geometry.slideAxisZ, 0, 'slide guide z');
  }
  disposeModel(model.root);
});

test('movement 417 rod B stays square to the bent end, leans opposite ways in Brown’s bold and dotted poses and reaches both slide extremes', () => {
  const model = createMovementModel(catalog.movements[416]);
  const { geometry, stateAtShaftAngle, sourcePose } = model.root.userData;
  let maximumSquareness = 0;
  let minimumTip = Infinity;
  let maximumTip = -Infinity;

  for (let sample = 0; sample <= 80000; sample += 1) {
    const state = stateAtShaftAngle(Math.PI * 2 * sample / 80000);
    maximumSquareness = Math.max(maximumSquareness,
      Math.abs(state.rodSquarenessResidual));
    near(state.slideX, geometry.bendX + (geometry.transverseCenterDistance
      * Math.sin(geometry.bentEndInclination) * Math.cos(state.shaftAngle)
      - geometry.rodRootOnBentEnd) / Math.cos(geometry.bentEndInclination),
    0, 'harmonic slide law');
    assert.ok(state.rodEngagedLength >= geometry.rodEngagedLengthMinimum - 1e-12);
    assert.ok(state.rodEngagedLength <= geometry.rodEngagedLengthMaximum + 1e-12);
    minimumTip = Math.min(minimumTip, state.rodTipBeyondSocket);
    maximumTip = Math.max(maximumTip, state.rodTipBeyondSocket);
  }
  assert.ok(maximumSquareness < 1e-15);
  near(minimumTip, geometry.rodTipBeyondSocket, 1e-9, 'B never leaves the socket');
  assert.ok(maximumTip < 0.22, 'B end stays inside C, above the plank');
  const bold = stateAtShaftAngle(geometry.sourceShaftAngle);
  const dotted = stateAtShaftAngle(geometry.sourceShaftAngle + Math.PI);
  near(bold.slideX, geometry.slideMaximumX, 0, 'bold-pose slide extreme');
  near(dotted.slideX, geometry.slideMinimumX, 0, 'dotted-pose slide extreme');
  near(bold.slideX - dotted.slideX, geometry.slideStroke, 0,
    'full slide stroke');
  near(geometry.slideStroke, 2 * geometry.harmonicAmplitude, 1e-15,
    'stroke is twice the harmonic amplitude');
  // Brown: B leans a little right in bold, the other way in dotted.
  near(bold.rodLeanFromVertical, geometry.bentEndInclination, 1e-12,
    'bold lean equals the bend angle, lower end to the right');
  near(dotted.rodLeanFromVertical, -geometry.bentEndInclination, 1e-12,
    'dotted lean mirrors it');
  near(sourcePose.bold.rodLeanFromVertical, bold.rodLeanFromVertical, 0,
    'recorded bold lean');
  assert.ok(bold.upperSocket.y < geometry.shaftAxisY, 'bold head tipped down');
  assert.ok(dotted.upperSocket.y > geometry.shaftAxisY, 'dotted head tipped up');
  disposeModel(model.root);
});

test('movement 417 differentiated laws satisfy the squareness rate constraint throughout', () => {
  const model = createMovementModel(catalog.movements[416]);
  const { stateAtShaftAngle } = model.root.userData;
  let maximumRateResidual = 0;

  for (let sample = -40000; sample <= 80000; sample += 1) {
    const state = stateAtShaftAngle(Math.PI * 2 * sample / 40000);
    maximumRateResidual = Math.max(maximumRateResidual,
      Math.abs(state.rodSquarenessRateResidual));
    vectorNear(state.lowerSocketVelocity,
      new THREE.Vector3(state.slideSpeed, 0, 0), 0,
      'lower socket velocity follows X guide');
    vectorNear(state.lowerSocketAcceleration,
      new THREE.Vector3(state.slideAcceleration, 0, 0), 0,
      'lower socket acceleration follows X guide');
  }
  assert.ok(maximumRateResidual < 1e-15);
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
  assert.ok(geometry.slideStroke > 1.2);
  disposeModel(model.root);
});

test('movement 417 bent end is truly spatial: the rod root swings to either side of the plane at quarter turns', () => {
  const model = createMovementModel(catalog.movements[416]);
  const { geometry, stateAtShaftAngle } = model.root.userData;
  const front = stateAtShaftAngle(Math.PI / 2);
  const rear = stateAtShaftAngle(Math.PI * 3 / 2);
  const depth = geometry.rodRootOnBentEnd * Math.sin(geometry.bentEndInclination);

  near(front.upperSocket.z, -depth, 1e-15, 'front root excursion');
  near(rear.upperSocket.z, depth, 1e-15, 'rear root excursion');
  near(front.slideX, rear.slideX, 1e-15,
    'equal slide position at opposed depth poses');
  near(front.rodVector.z, depth, 1e-15, 'front rod depth component');
  near(rear.rodVector.z, -depth, 1e-15, 'rear rod depth component');
  disposeModel(model.root);
});

test('movement 417 analytic root and slide derivatives match finite differences', () => {
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
    const numericalUpperAcceleration = after.upperSocketVelocity.clone()
      .sub(before.upperSocketVelocity)
      .multiplyScalar(1 / (2 * timeStep));
    near(numericalSlideSpeed, state.slideSpeed, 4e-10,
      `slide speed at ${angle}`);
    near(numericalSlideAcceleration, state.slideAcceleration, 8e-10,
      `slide acceleration at ${angle}`);
    vectorNear(numericalUpperVelocity, state.upperSocketVelocity, 5e-11,
      `upper socket velocity at ${angle}`);
    vectorNear(numericalUpperAcceleration, state.upperSocketAcceleration, 5e-10,
      `upper socket acceleration at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 417 update binds shaft rotation, slide translation, rod B square to the bent end, and head A to one state', () => {
  const model = createMovementModel(catalog.movements[416]);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.6, 1.4, 2.2, 3, 3.8, 4.7, 5.5]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.shaftRotor.rotation.x, state.shaftAngle, 0,
      'shaft A update');
    near(blocks.slideC.position.x, state.slideX, 0,
      'slide C update');
    model.root.updateMatrixWorld(true);
    vectorNear(blocks.rodBody.position, state.upperSocket, 0,
      'rod root update');
    const rodAxis = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(blocks.rodBody.quaternion);
    const headAxis = new THREE.Vector3(-1, 0, 0)
      .applyQuaternion(blocks.rodBody.quaternion);
    vectorNear(rodAxis, state.rodVector.clone().normalize(), 1e-15,
      'rod B points at C');
    vectorNear(headAxis, state.bentEnd, 1e-15, 'head A along the bent end');
    const tip = new THREE.Vector3(0, geometry.rodTipLength, 0)
      .applyMatrix4(blocks.rodBody.matrixWorld);
    near(tip.distanceTo(state.upperSocket), geometry.rodTipLength, 1e-14,
      'rigid rod length');
    near(tip.distanceTo(state.lowerSocket), state.rodTipBeyondSocket, 1e-14,
      'rod passes through the socket');
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
