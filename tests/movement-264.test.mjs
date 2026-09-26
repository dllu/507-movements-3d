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

function radialDistance(point, origin, axis) {
  const offset = point.clone().sub(origin);
  offset.addScaledVector(axis, -offset.dot(axis));
  return offset.length();
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

test('movement 264 is the one-tooth-difference twin worm-wheel differential', () => {
  const movement = catalog.movements[263];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    geometry,
    mechanism,
  } = model.root.userData;

  assert.equal(movement.id, 264);
  assert.equal(movement.number, '264');
  assert.equal(
    movement.title,
    'One-Tooth-Difference Twin Worm-Wheel Differential',
  );
  assert.equal(movement.category, 'Worm gearing');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'single-start-common-worm-driving-equal-diameter-100-and-101-tooth-differential-wheels',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one-single-start-common-worm/);
  assert.match(mechanism, /100-tooth-wheel-gains-one-revolution/);
  assert.deepEqual(
    [geometry.wheel100Teeth, geometry.wheel101Teeth],
    [100, 101],
  );
  assert.equal(blocks.wheel100Teeth.length, 100);
  assert.equal(blocks.wheel101Teeth.length, 101);
  assert.notEqual(blocks.wheel100, blocks.wheel101);
  assert.notEqual(
    blocks.wheel100.userData.rotor,
    blocks.wheel101.userData.rotor,
  );
  assert.equal(blocks.outerSleeve.parent, blocks.wheel100.userData.rotor);
  assert.equal(
    blocks.wheel100Pointer.parent,
    blocks.wheel100.userData.rotor,
  );
  assert.equal(
    blocks.wheel101Pointer.parent,
    blocks.wheel101.userData.rotor,
  );
  disposeModel(model.root);
});

test('movement 264 preserves the measured unavailable source engraving', () => {
  const movement = catalog.movements[263];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.plate264;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 3);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.equal(plate.rasterCommonAxisY, 296);
  assert.deepEqual(plate.rasterWheelRimCenterXs, [241, 296]);
  assert.deepEqual(plate.rasterWheelFaceEdgesX, [[223, 259], [280, 312]]);
  assert.deepEqual(plate.rasterWormCenter, { x: 267, y: 69 });
  assert.equal(plate.rasterWormOuterRadius, 51);
  assert.equal(plate.rasterWormBoreRadius, 24);
  assert.deepEqual(plate.rasterShaftEndpointsX, [86, 388]);
  assert.deepEqual(plate.rasterPointerRoots, [
    { x: 340, y: 296 },
    { x: 367, y: 296 },
  ]);
  assert.deepEqual(plate.rasterPointerTips, [
    { x: 340, y: 84 },
    { x: 367, y: 51 },
  ]);
  assert.deepEqual(plate.rasterPointerTailYs, [329, 337]);
  assert.match(plate.inferredTopology, /one end-on common worm/);
  assert.match(plate.inferredTopology, /separate long output pointers/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 67,
    edition: 21,
    illustrationPage: 66,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 264 matches the equal rims, worm, and pointer proportions', () => {
  const model = createMovementModel(catalog.movements[263]);
  const { blocks, geometry, sourceReference } = model.root.userData;
  const plate = sourceReference.plate264;
  const rasterWheelRadius = plate.rasterWheelOuterRadius;
  const rasterRimSeparation = plate.rasterWheelRimCenterXs[1]
    - plate.rasterWheelRimCenterXs[0];
  const rasterPointerLengths = plate.rasterPointerRoots.map(
    (root, index) => root.y - plate.rasterPointerTips[index].y,
  );

  near(
    blocks.wheel100.userData.pitchRadius,
    blocks.wheel101.userData.pitchRadius,
    0,
    'equal wheel pitch radii',
  );
  near(
    blocks.wheel100.userData.outerRadius,
    blocks.wheel101.userData.outerRadius,
    0,
    'equal wheel outside diameters',
  );
  near(
    geometry.wormPitchRadius / geometry.wheelOuterRadius,
    plate.rasterWormOuterRadius / rasterWheelRadius,
    0.015,
    'worm-to-wheel radius ratio',
  );
  near(
    geometry.wheelAxialSeparation / geometry.wheelOuterRadius,
    rasterRimSeparation / rasterWheelRadius,
    0.01,
    'side-by-side rim separation',
  );
  near(
    geometry.wheel100PointerLength / geometry.wheelPitchRadius,
    rasterPointerLengths[0] / rasterWheelRadius,
    0.015,
    '100-tooth pointer length',
  );
  near(
    geometry.wheel101PointerLength / geometry.wheelPitchRadius,
    rasterPointerLengths[1] / rasterWheelRadius,
    0.025,
    '101-tooth pointer length',
  );
  near(
    geometry.wheel101CircularPitch / geometry.wheel100CircularPitch,
    100 / 101,
    2e-16,
    'equal-diameter pitch accommodation',
  );
  disposeModel(model.root);
});

test('movement 264 indexes one tooth on each wheel per worm revolution', () => {
  const model = createMovementModel(catalog.movements[263]);
  const { geometry, stateAtWormTurns, transmission } = model.root.userData;
  let maximumPhaseError = 0;
  let maximumWheel100RatioError = 0;
  let maximumWheel101RatioError = 0;
  let maximumGainError = 0;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const wormTurns = 10100 * sample / 8192;
    const state = stateAtWormTurns(wormTurns);
    maximumPhaseError = Math.max(
      maximumPhaseError,
      Math.abs(state.meshPhaseError100),
      Math.abs(state.meshPhaseError101),
    );
    maximumWheel100RatioError = Math.max(
      maximumWheel100RatioError,
      Math.abs(state.wheel100Revolutions + wormTurns / 100),
    );
    maximumWheel101RatioError = Math.max(
      maximumWheel101RatioError,
      Math.abs(state.wheel101Revolutions + wormTurns / 101),
    );
    maximumGainError = Math.max(
      maximumGainError,
      Math.abs(state.fastWheelGainRevolutions - wormTurns / 10100),
    );
    near(
      state.teethPassedAtWheel100Contact,
      wormTurns,
      0,
      `100-tooth passages at sample ${sample}`,
    );
    near(
      state.teethPassedAtWheel101Contact,
      wormTurns,
      0,
      `101-tooth passages at sample ${sample}`,
    );
  }
  assert.ok(maximumPhaseError < 2e-9);
  assert.ok(maximumWheel100RatioError < 3e-14);
  assert.ok(maximumWheel101RatioError < 3e-14);
  assert.ok(maximumGainError < 4e-15);
  near(transmission.wheel100Ratio, -1 / geometry.wheel100Teeth, 0,
    '100-tooth ratio');
  near(transmission.wheel101Ratio, -1 / geometry.wheel101Teeth, 0,
    '101-tooth ratio');
  assert.equal(transmission.toothPassesPerWormRevolution, 1);
  disposeModel(model.root);
});

test('movement 264 gains exactly one wheel revolution after 10,100 worm turns', () => {
  const model = createMovementModel(catalog.movements[263]);
  const { stateAtWormTurns, timeline, transmission } = model.root.userData;
  const state = stateAtWormTurns(100 * 101);

  assert.equal(transmission.fullBeatWormRevolutions, 10100);
  assert.equal(timeline.fullBeatWormRevolutions, 10100);
  near(state.wheel100Revolutions, -101, 2e-14,
    '100-tooth wheel revolutions');
  near(state.wheel101Revolutions, -100, 2e-14,
    '101-tooth wheel revolutions');
  near(state.fastWheelGainRevolutions, 1, 4e-15,
    'one accumulated relative revolution');
  near(state.wheel100Angle, 0, 0, '100-tooth beat closure');
  near(state.wheel101Angle, 0, 0, '101-tooth beat closure');
  near(state.wormAngle, 0, 0, 'worm beat closure');
  near(transmission.fastWheelGainPerWormTurn, 1 / 10100, 0,
    'differential beat ratio');
  disposeModel(model.root);
});

test('movement 264 uses one common orthogonal worm at both pitch contacts', () => {
  const model = createMovementModel(catalog.movements[263]);
  const { blocks, geometry } = model.root.userData;
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));

  assert.equal(
    roles.filter((role) => role
      === 'one-single-start-worm-spanning-both-equal-diameter-wheels').length,
    1,
  );
  assert.equal(
    roles.filter((role) => role === 'white-common-worm-speed-index').length,
    1,
  );
  near(geometry.axesOrthogonality, 0, 0, 'orthogonal shaft axes');
  near(
    radialDistance(
      geometry.wheel100ContactPoint,
      geometry.wheel100Center,
      geometry.commonWheelAxis,
    ),
    geometry.wheelPitchRadius,
    2e-16,
    '100-tooth pitch contact',
  );
  near(
    radialDistance(
      geometry.wheel101ContactPoint,
      geometry.wheel101Center,
      geometry.commonWheelAxis,
    ),
    geometry.wheelPitchRadius,
    2e-16,
    '101-tooth pitch contact',
  );
  for (const [point, label] of [
    [geometry.wheel100ContactPoint, '100-tooth worm contact'],
    [geometry.wheel101ContactPoint, '101-tooth worm contact'],
  ]) {
    near(
      radialDistance(point, geometry.wormCenter, geometry.wormAxis),
      geometry.wormPitchRadius,
      2e-16,
      label,
    );
  }
  assert.ok(geometry.wormCoreRadius > .45);
  assert.equal(blocks.worm.userData.toothProfile, 'axial-straight-flanked-worm');
  near(
    blocks.wheel100ContactMarker.position.distanceTo(
      geometry.wheel100ContactPoint,
    ),
    0,
    0,
    'rendered 100-tooth contact marker',
  );
  near(
    blocks.wheel101ContactMarker.position.distanceTo(
      geometry.wheel101ContactPoint,
    ),
    0,
    0,
    'rendered 101-tooth contact marker',
  );
  disposeModel(model.root);
});

test('movement 264 renders the exact same-direction rates and readable indices', () => {
  const model = createMovementModel(catalog.movements[263]);
  const {
    blocks,
    driveSchedule,
    stateAtTime,
    timeline,
  } = model.root.userData;

  assert.equal(driveSchedule.sourcePrescribesAbsoluteSpeed, false);
  assert.equal(driveSchedule.sourcePrescribesDirection, false);
  assert.match(driveSchedule.referenceDisplayCycle, /full-202-second-beat/);
  for (const time of [0, 0.08, 1.7, 4, 8, 23.4]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.worm.userData.rotor.rotation.z, state.wormAngle, 0,
      `rendered worm angle at ${time}`);
    near(blocks.wheel100.userData.rotor.rotation.z, state.wheel100Angle, 0,
      `rendered 100-tooth angle at ${time}`);
    near(blocks.wheel101.userData.rotor.rotation.z, state.wheel101Angle, 0,
      `rendered 101-tooth angle at ${time}`);
    near(blocks.innerShaft.userData.rotor.rotation.z, state.wheel101Angle, 0,
      `rendered inner shaft angle at ${time}`);
    assert.ok(state.wormAngularSpeed > 0);
    assert.ok(state.wheel100AngularSpeed < 0);
    assert.ok(state.wheel101AngularSpeed < 0);
    assert.ok(Math.abs(state.wheel100AngularSpeed)
      > Math.abs(state.wheel101AngularSpeed));
    near(state.wheel100ToothPassRate, state.wormRevolutionRate, 0,
      `100-tooth pass rate at ${time}`);
    near(state.wheel101ToothPassRate, state.wormRevolutionRate, 2e-15,
      `101-tooth pass rate at ${time}`);
  }
  const oneReferenceTurn = stateAtTime(timeline.demonstrationPeriod);
  near(oneReferenceTurn.wheel100Angle, 0, 0,
    '100-tooth reference turn');
  near(oneReferenceTurn.wheel101Angle, FULL_TURN / 101, 2e-15,
    '101-tooth pointer trails visibly');
  assert.equal(blocks.wormIndex.parent, blocks.worm.userData.rotor);
  assert.equal(blocks.wheel100PointerTip.parent, blocks.wheel100Pointer);
  assert.equal(blocks.wheel101PointerTip.parent, blocks.wheel101Pointer);
  disposeModel(model.root);
});

test('movement 264 stays continuous, closes its beat, and leaves 269 authored', () => {
  const model = createMovementModel(catalog.movements[263]);
  const { animationTiming, blocks, stateAtTime, timeline } = model.root.userData;
  const epsilon = 1e-6;

  // The display loop is the whole beat, played in real time, so the 1%
  // difference visibly accumulates: the needles part by about 18 degrees in
  // 10 s and by a whole turn over the seamless loop.
  near(animationTiming.authoredCyclePeriod, timeline.fullBeatPeriod, 0,
    'display loop is the full beat');
  near(timeline.fullBeatPeriod, 202, 1e-9, 'full beat');
  assert.equal(animationTiming.playbackTimeScale, 1);
  near(animationTiming.displayCycleDuration, 202, 1e-9, 'display loop');
  const gainIn10s = stateAtTime(10).fastWheelGainAngle * 180 / Math.PI;
  assert.ok(Math.abs(gainIn10s) > 15, `needles part ${gainIn10s} degrees in 10 s`);
  assert.ok(Math.abs(stateAtTime(0.5).wheel100AngularSpeed) < 2 * Math.PI,
    'the wheels and needles turn under one revolution per second');
  const endState = stateAtTime(timeline.fullBeatPeriod);
  near(Math.cos(endState.wormAngle), 1, 1e-9, 'worm closes the loop');
  near(Math.cos(endState.wheel100Angle), 1, 1e-9, '100-tooth wheel closes the loop');
  near(Math.cos(endState.wheel101Angle), 1, 1e-9, '101-tooth wheel closes the loop');
  model.update(timeline.demonstrationPeriod - epsilon);
  const before100 = blocks.wheel100.userData.rotor.quaternion.clone();
  const before101 = blocks.wheel101.userData.rotor.quaternion.clone();
  model.update(timeline.demonstrationPeriod + epsilon);
  const after100 = blocks.wheel100.userData.rotor.quaternion.clone();
  const after101 = blocks.wheel101.userData.rotor.quaternion.clone();
  const angleBetween = (left, right) => 2 * Math.acos(
    Math.min(1, Math.abs(left.dot(right))),
  );
  assert.ok(angleBetween(before100, after100) < 2e-5);
  assert.ok(angleBetween(before101, after101) < 2e-5);

  const closure = stateAtTime(timeline.fullBeatPeriod);
  near(closure.wormAngle, 0, 0, 'full-beat worm closure');
  near(closure.wheel100Angle, 0, 0, 'full-beat 100-tooth closure');
  near(closure.wheel101Angle, 0, 0, 'full-beat 101-tooth closure');
  near(closure.fastWheelGainRevolutions, 1, 4e-15,
    'full-beat relative gain');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
