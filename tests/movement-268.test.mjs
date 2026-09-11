import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
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

test('movement 268 is the crank-driven fixed-roller tangent rod', () => {
  const movement = catalog.movements[267];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
  } = model.root.userData;

  assert.equal(movement.id, 268);
  assert.equal(movement.number, '268');
  assert.equal(
    movement.title,
    'Crank-Driven Tangent Oscillating Rod and Guide Roller',
  );
  assert.equal(movement.category, 'Cranks & reciprocation');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'rotating-crank-pin-driving-fixed-roller-tangent-oscillating-reciprocating-rod',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /uniform-crank-pin/);
  assert.match(mechanism, /selected-upper-tangent/);
  assert.match(mechanism, /slides-reciprocally/);
  assert.equal(blocks.crankDisk.parent, blocks.crankRotor);
  assert.equal(blocks.crankArm.parent, blocks.crankRotor);
  assert.equal(blocks.crankPin.parent, blocks.crankRotor);
  assert.equal(blocks.rodBody.parent, blocks.rod);
  assert.equal(blocks.rodEye.parent, blocks.rod);
  assert.equal(blocks.rodWorkingFace.parent, blocks.rod);
  assert.equal(blocks.guideRotor.parent, blocks.guideAssembly);
  assert.equal(blocks.guideAxle.parent, blocks.guideAssembly);
  assert.notEqual(blocks.guideAxle.parent, blocks.guideRotor);
  assert.equal(blocks.guideRoller.parent, blocks.guideRotor);
  assert.notEqual(blocks.rod, blocks.crankRotor);
  assert.notEqual(blocks.guideRotor, blocks.crankRotor);
  disposeModel(model.root);
});

test('movement 268 preserves the public engraving and available source animation', () => {
  const movement = catalog.movements[267];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.plate268;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.match(sourceAnimation.referenceScope, /qualitative topology only/);
  assert.match(sourceAnimation.referenceScope, /derived independently/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 6);
  assert.equal(plate.officialAnimationAvailable, true);
  assert.deepEqual(plate.rasterCrankCenter, { x: 448, y: 260 });
  assert.equal(plate.rasterCrankDiskRadius, 65);
  assert.deepEqual(plate.rasterCrankPinSource, { x: 463, y: 214 });
  assert.deepEqual(plate.rasterGuideCenter, { x: 113, y: 263 });
  assert.equal(plate.rasterGuideRollerRadius, 31);
  assert.deepEqual(plate.rasterRodLeftEndSource, { x: 14, y: 228 });
  assert.equal(plate.rasterRodThickness, 15);
  assert.match(plate.inferredTopology, /crank disk and crank pin/);
  assert.match(plate.inferredTopology, /tangent above/);
  assert.match(plate.inferredTopology, /oscillates and slides/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 67,
    edition: 21,
    illustrationPage: 66,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 268 matches the measured crank, roller, rod, and source pose', () => {
  const model = createMovementModel(catalog.movements[267]);
  const { geometry, sourceReference, stateAtTime } = model.root.userData;
  const plate = sourceReference.plate268;
  const rasterCenterSeparation = plate.rasterCrankCenter.x
    - plate.rasterGuideCenter.x;
  const rasterCrankRadius = Math.hypot(
    plate.rasterCrankPinSource.x - plate.rasterCrankCenter.x,
    plate.rasterCrankPinSource.y - plate.rasterCrankCenter.y,
  );
  const rasterRodLength = Math.hypot(
    plate.rasterCrankPinSource.x - plate.rasterRodLeftEndSource.x,
    plate.rasterCrankPinSource.y - plate.rasterRodLeftEndSource.y,
  );
  const rasterCrankAngle = Math.atan2(
    plate.rasterCrankCenter.y - plate.rasterCrankPinSource.y,
    plate.rasterCrankPinSource.x - plate.rasterCrankCenter.x,
  );
  const rasterRodAngle = Math.atan2(
    plate.rasterRodLeftEndSource.y - plate.rasterCrankPinSource.y,
    plate.rasterCrankPinSource.x - plate.rasterRodLeftEndSource.x,
  );
  const source = stateAtTime(0);

  near(
    geometry.centerSeparation / geometry.crankDiskRadius,
    rasterCenterSeparation / plate.rasterCrankDiskRadius,
    0.05,
    'guide-to-crank center separation',
  );
  near(
    geometry.crankRadius / geometry.crankDiskRadius,
    rasterCrankRadius / plate.rasterCrankDiskRadius,
    0.015,
    'crank throw ratio',
  );
  near(
    geometry.guideRollerRadius / geometry.crankDiskRadius,
    plate.rasterGuideRollerRadius / plate.rasterCrankDiskRadius,
    0.004,
    'guide roller ratio',
  );
  near(
    geometry.rodLength / geometry.crankDiskRadius,
    rasterRodLength / plate.rasterCrankDiskRadius,
    0.1,
    'rod length ratio',
  );
  near(
    geometry.rodHalfWidth * 2 / geometry.crankDiskRadius,
    plate.rasterRodThickness / plate.rasterCrankDiskRadius,
    0.022,
    'rod thickness ratio',
  );
  near(geometry.sourceCrankAngle, rasterCrankAngle,
    THREE.MathUtils.degToRad(0.2), 'source crank phase');
  near(source.rodAngle, rasterRodAngle,
    THREE.MathUtils.degToRad(0.6), 'source tangent rod angle');
  near(source.freeEndPosition.distanceTo(source.crankPinPosition),
    geometry.rodLength, 1e-15, 'source rigid rod length');
  disposeModel(model.root);
});

test('movement 268 maintains exact solid tangency throughout the crank turn', () => {
  const model = createMovementModel(catalog.movements[267]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  let maximumCenterlineRadiusError = 0;
  let maximumPhysicalRadiusError = 0;
  let maximumCoincidenceError = 0;
  let maximumNormalOffsetError = 0;
  let maximumRodLengthError = 0;
  let minimumLeftContactMargin = Infinity;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(
      timeline.demonstrationPeriod * sample / 8192,
    );
    maximumCenterlineRadiusError = Math.max(
      maximumCenterlineRadiusError,
      Math.abs(
        state.centerlineTangentPoint.distanceTo(geometry.guideCenter)
          - geometry.effectiveGuideRadius,
      ),
    );
    maximumPhysicalRadiusError = Math.max(
      maximumPhysicalRadiusError,
      Math.abs(
        state.physicalContactPoint.distanceTo(geometry.guideCenter)
          - geometry.guideRollerRadius,
      ),
    );
    maximumCoincidenceError = Math.max(
      maximumCoincidenceError,
      state.physicalContactCoincidenceError,
    );
    maximumNormalOffsetError = Math.max(
      maximumNormalOffsetError,
      Math.abs(
        state.contactNormalDistanceFromRodCenterline
          + geometry.rodHalfWidth,
      ),
    );
    maximumRodLengthError = Math.max(
      maximumRodLengthError,
      Math.abs(
        state.freeEndPosition.distanceTo(state.crankPinPosition)
          - geometry.rodLength,
      ),
    );
    minimumLeftContactMargin = Math.min(
      minimumLeftContactMargin,
      geometry.rodLength - state.tangentLength,
    );
    near(
      state.physicalContactPoint.clone().sub(state.crankPinPosition)
        .dot(state.rodAxis),
      -state.tangentLength,
      6e-15,
      `contact longitudinal coordinate at sample ${sample}`,
    );
  }
  assert.ok(maximumCenterlineRadiusError < 8e-16);
  assert.ok(maximumPhysicalRadiusError < 2e-16);
  assert.ok(maximumCoincidenceError < 3e-15);
  assert.ok(maximumNormalOffsetError < 7e-16);
  assert.ok(maximumRodLengthError < 2e-15);
  assert.ok(minimumLeftContactMargin > 1.07);
  disposeModel(model.root);
});

test('movement 268 produces one exact longitudinal reciprocation per turn', () => {
  const model = createMovementModel(catalog.movements[267]);
  const {
    canonicalTimes,
    geometry,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;
  const nearest = stateAtTime(canonicalTimes.nearestToGuide);
  const farthest = stateAtTime(canonicalTimes.farthestFromGuide);
  let minimumLength = Infinity;
  let maximumLength = -Infinity;

  near(nearest.tangentLength, geometry.tangentLengthMinimum, 0,
    'nearest tangent length');
  near(farthest.tangentLength, geometry.tangentLengthMaximum, 0,
    'farthest tangent length');
  near(nearest.tangentLengthVelocity, 0, 2e-16,
    'nearest smooth longitudinal reversal');
  near(farthest.tangentLengthVelocity, 0, 2e-16,
    'farthest smooth longitudinal reversal');
  near(
    farthest.tangentLength - nearest.tangentLength,
    geometry.longitudinalStroke,
    0,
    'exact longitudinal stroke',
  );
  near(transmission.longitudinalStroke, geometry.longitudinalStroke, 0,
    'transmission stroke metadata');

  for (let sample = 0; sample <= 8192; sample += 1) {
    const crankAngle = FULL_TURN * sample / 8192;
    const tangentLength = transmission.tangentLengthAtCrankAngle(crankAngle);
    minimumLength = Math.min(minimumLength, tangentLength);
    maximumLength = Math.max(maximumLength, tangentLength);
  }
  near(minimumLength, geometry.tangentLengthMinimum, 0,
    'dense minimum tangent length');
  near(maximumLength, geometry.tangentLengthMaximum, 0,
    'dense maximum tangent length');
  assert.equal(timeline.demonstrationPeriod, 6);
  disposeModel(model.root);
});

test('movement 268 analytic rates and passive roller no-slip law are exact', () => {
  const model = createMovementModel(catalog.movements[267]);
  const { geometry, stateAtTime } = model.root.userData;
  const derivativeStep = 1e-5;
  let maximumPinVelocityError = 0;
  let maximumRodRateError = 0;
  let maximumSlideRateError = 0;
  let maximumGuideRateError = 0;
  let maximumContactVelocityError = 0;
  let maximumNoSlipError = 0;
  let minimumGuideRate = Infinity;
  let maximumGuideRate = -Infinity;

  for (const time of [0.17, 0.63, 1.24, 1.93, 2.71, 3.48, 4.26, 5.11, 5.73]) {
    const before = stateAtTime(time - derivativeStep);
    const state = stateAtTime(time);
    const after = stateAtTime(time + derivativeStep);
    const numericalPinVelocity = after.crankPinPosition.clone()
      .sub(before.crankPinPosition)
      .multiplyScalar(1 / (2 * derivativeStep));
    const numericalContactVelocity = after.physicalContactPoint.clone()
      .sub(before.physicalContactPoint)
      .multiplyScalar(1 / (2 * derivativeStep));
    maximumPinVelocityError = Math.max(
      maximumPinVelocityError,
      numericalPinVelocity.distanceTo(state.crankPinVelocity),
    );
    maximumRodRateError = Math.max(
      maximumRodRateError,
      Math.abs(
        (after.rodAngle - before.rodAngle) / (2 * derivativeStep)
          - state.rodAngularSpeed,
      ),
    );
    maximumSlideRateError = Math.max(
      maximumSlideRateError,
      Math.abs(
        (after.tangentLength - before.tangentLength) / (2 * derivativeStep)
          - state.tangentLengthVelocity,
      ),
    );
    maximumGuideRateError = Math.max(
      maximumGuideRateError,
      Math.abs(
        (after.guideRollerAngleUnwrapped - before.guideRollerAngleUnwrapped)
          / (2 * derivativeStep) - state.guideRollerAngularSpeed,
      ),
    );
    maximumContactVelocityError = Math.max(
      maximumContactVelocityError,
      numericalContactVelocity.distanceTo(state.contactPointVelocity),
    );
    maximumNoSlipError = Math.max(
      maximumNoSlipError,
      Math.abs(state.noSlipTangentialError),
    );
    minimumGuideRate = Math.min(minimumGuideRate, state.guideRollerAngularSpeed);
    maximumGuideRate = Math.max(maximumGuideRate, state.guideRollerAngularSpeed);
    near(
      state.guideSurfaceTangentialSpeed,
      -state.guideRollerAngularSpeed * geometry.guideRollerRadius,
      0,
      `roller surface speed at ${time}`,
    );
  }
  assert.ok(maximumPinVelocityError < 5e-11);
  assert.ok(maximumRodRateError < 3e-11);
  assert.ok(maximumSlideRateError < 2e-10);
  assert.ok(maximumGuideRateError < 4e-10);
  assert.ok(maximumContactVelocityError < 3e-11);
  assert.ok(maximumNoSlipError < 5e-16);
  assert.ok(minimumGuideRate < 0);
  assert.ok(maximumGuideRate > 0);
  disposeModel(model.root);
});

test('movement 268 renderer binds crank, tangent rod, contact, and roller', () => {
  const model = createMovementModel(catalog.movements[267]);
  const { blocks, stateAtTime } = model.root.userData;
  const guidePosition = blocks.guideAssembly.position.clone();
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));

  assert.equal(
    roles.filter((role) => role === 'uniformly-rotating-input-crank-and-disk').length,
    1,
  );
  assert.equal(
    roles.filter((role) => role
      === 'rigid-oscillating-rod-sliding-reciprocally-over-fixed-guide-roller').length,
    1,
  );
  assert.equal(
    roles.filter((role) => role === 'passive-no-slip-guide-roller').length,
    1,
  );
  assert.equal(
    roles.filter((role) => role === 'exact-moving-rod-guide-roller-contact').length,
    1,
  );
  assert.equal(
    roles.filter((role) => role === 'white-input-disk-face-index').length,
    1,
  );
  assert.equal(
    roles.filter((role) => role === 'white-guide-roller-spin-index').length,
    1,
  );
  assert.equal(
    roles.filter((role) => role === 'white-rigid-rod-reciprocation-index').length,
    1,
  );

  for (const time of [0, 0.8, 1.8, 2.7, 4.1, 4.8, 6]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.crankRotor.rotation.z, state.crankAngle, 0,
      `rendered crank angle at ${time}`);
    near(blocks.rod.position.x, state.crankPinPosition.x, 0,
      `rendered rod pin x at ${time}`);
    near(blocks.rod.position.y, state.crankPinPosition.y, 0,
      `rendered rod pin y at ${time}`);
    near(blocks.rod.rotation.z, state.rodAngle, 0,
      `rendered rod angle at ${time}`);
    near(blocks.guideRotor.rotation.z, state.guideRollerAngle, 0,
      `rendered guide-roller angle at ${time}`);
    near(blocks.contactMarker.position.x, state.physicalContactPoint.x, 0,
      `rendered contact x at ${time}`);
    near(blocks.contactMarker.position.y, state.physicalContactPoint.y, 0,
      `rendered contact y at ${time}`);
    vectorNear(blocks.guideAssembly.position, guidePosition, 0,
      `fixed guide center at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 268 closes one exact turn and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[267]);
  const {
    animationTiming,
    canonicalTimes,
    driveSchedule,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);

  assert.equal(
    driveSchedule.input,
    'source-required-uniform-continuous-crank-rotation',
  );
  assert.equal(driveSchedule.sourcePrescribesDirection, false);
  assert.match(driveSchedule.purpose, /complete oscillation/);
  near(closure.crankAngle, start.crankAngle, 0, 'crank visual closure');
  near(closure.crankAngleUnwrapped - start.crankAngleUnwrapped, FULL_TURN,
    0, 'one input turn');
  vectorNear(closure.crankPinPosition, start.crankPinPosition, 2e-15,
    'crank-pin closure');
  vectorNear(closure.freeEndPosition, start.freeEndPosition, 2e-15,
    'free-end closure');
  vectorNear(closure.physicalContactPoint, start.physicalContactPoint, 2e-15,
    'contact closure');
  near(closure.rodAngle, start.rodAngle, 2e-17,
    'rod-angle closure');
  near(closure.tangentLength, start.tangentLength, 2e-15,
    'longitudinal closure');
  near(closure.guideRollerAngle, start.guideRollerAngle, 0,
    'guide-roller visual closure');
  near(closure.guideRollerAngleUnwrapped, start.guideRollerAngleUnwrapped,
    4e-15, 'guide-roller material closure');
  near(closure.rodAngularSpeed, start.rodAngularSpeed, 2e-16,
    'rod-rate closure');
  assert.equal(timeline.demonstrationPeriod, 6);
  assert.equal(animationTiming.authoredCyclePeriod, 6);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
