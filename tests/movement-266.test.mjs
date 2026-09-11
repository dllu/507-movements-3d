import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
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

test('movement 266 is one translating shaft with two differential screw pitches', () => {
  const movement = catalog.movements[265];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
  } = model.root.userData;

  assert.equal(movement.id, 266);
  assert.equal(movement.number, '266');
  assert.equal(
    movement.title,
    'Two-Pitch Differential Screw and Sliding Bearing',
  );
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'same-hand-two-pitch-translating-shaft-fixed-nut-differential-moving-bearing',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one-shaft-carries-coarse-and-fine/);
  assert.match(mechanism, /fixed-bearing/);
  assert.match(mechanism, /pitch-difference/);

  assert.equal(blocks.fixedThread.parent, blocks.shaftRotor);
  assert.equal(blocks.movingThread.parent, blocks.shaftRotor);
  assert.equal(blocks.shaftCore.parent, blocks.shaftRotor);
  assert.equal(blocks.handleBar.parent, blocks.shaftRotor);
  assert.equal(blocks.handleIndex.parent, blocks.shaftRotor);
  assert.equal(blocks.fixedBearing.userData.axiallyFixed, true);
  assert.equal(blocks.fixedBearing.userData.nonrotating, true);
  assert.equal(blocks.movingBearing.userData.axiallyFixed, false);
  assert.equal(blocks.movingBearing.userData.nonrotating, true);
  assert.equal(blocks.movingFoot.parent, blocks.movingBearing);
  assert.equal(blocks.movingStandard.parent, blocks.movingBearing);
  assert.equal(blocks.movingContactMarker.parent, blocks.movingBearing);
  assert.equal(blocks.fixedThread.userData.handedness, 1);
  assert.equal(
    blocks.fixedThread.userData.handedness,
    blocks.movingThread.userData.handedness,
  );
  assert.ok(
    blocks.fixedThread.userData.pitch > blocks.movingThread.userData.pitch,
  );
  disposeModel(model.root);
});

test('movement 266 preserves the measured unavailable source engraving', () => {
  const movement = catalog.movements[265];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.plate266;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.equal(plate.rasterShaftAxisY, 237);
  assert.equal(plate.rasterFixedBearingCenterX, 149);
  assert.equal(plate.rasterMovingBearingCenterX, 374);
  assert.deepEqual(plate.rasterFixedThreadBounds, { left: 94, right: 211 });
  assert.deepEqual(plate.rasterMovingThreadBounds, { left: 332, right: 431 });
  assert.deepEqual(plate.rasterSmoothShaftBounds, { left: 211, right: 332 });
  assert.deepEqual(plate.rasterBaseBounds, {
    bottom: 344,
    left: 51,
    right: 505,
    top: 313,
  });
  assert.deepEqual(plate.rasterMovingFootBounds, {
    bottom: 314,
    left: 318,
    right: 440,
    top: 296,
  });
  assert.match(plate.inferredTopology, /two separated same-hand thread regions/);
  assert.match(plate.inferredTopology, /base-fixed threaded bearing/);
  assert.match(plate.inferredTopology, /free to slide/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 67,
    edition: 21,
    illustrationPage: 66,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 266 reproduces the source pitch ordering and proportions', () => {
  const model = createMovementModel(catalog.movements[265]);
  const { geometry, sourceReference } = model.root.userData;
  const plate = sourceReference.plate266;
  const rasterPitchRatio = plate.rasterFixedThreadPitch
    / plate.rasterMovingThreadPitch;

  near(
    geometry.fixedThreadPitch / geometry.movingThreadPitch,
    rasterPitchRatio,
    2e-16,
    'coarse-to-fine pitch ratio',
  );
  assert.ok(geometry.fixedThreadStart < geometry.fixedBearingX);
  assert.ok(geometry.fixedBearingX < geometry.fixedThreadEnd);
  assert.ok(
    geometry.movingThreadStart < geometry.movingBearingInitialX,
  );
  assert.ok(geometry.movingBearingInitialX < geometry.movingThreadEnd);
  assert.ok(geometry.fixedThreadEnd < geometry.movingThreadStart);
  assert.ok(geometry.shaftCoreStart < geometry.fixedThreadStart);
  assert.ok(geometry.movingThreadEnd < geometry.shaftCoreEnd);
  near(
    geometry.pitchDifference,
    geometry.fixedThreadPitch - geometry.movingThreadPitch,
    0,
    'modeled pitch difference',
  );
  near(
    geometry.maximumShaftTranslation,
    geometry.fixedThreadPitch * geometry.inputMaximumTurns,
    0,
    'finite shaft excursion',
  );
  near(
    geometry.maximumBearingTravel,
    geometry.pitchDifference * geometry.inputMaximumTurns,
    0,
    'finite bearing excursion',
  );
  disposeModel(model.root);
});

test('movement 266 obeys the exact two-pitch differential displacement law', () => {
  const model = createMovementModel(catalog.movements[265]);
  const { geometry, transmission } = model.root.userData;
  let maximumShaftError = 0;
  let maximumBearingError = 0;

  for (let sample = 0; sample <= 4096; sample += 1) {
    const turns = geometry.inputMaximumTurns * sample / 4096;
    const inputAngle = turns * FULL_TURN;
    const state = transmission.configurationAtInputAngle(inputAngle);
    const expectedShaftTravel = geometry.fixedThreadPitch * turns;
    const expectedBearingTravel = geometry.pitchDifference * turns;
    maximumShaftError = Math.max(
      maximumShaftError,
      Math.abs(state.shaftTranslation - expectedShaftTravel),
    );
    maximumBearingError = Math.max(
      maximumBearingError,
      Math.abs(state.bearingTravel - expectedBearingTravel),
    );
    near(
      state.movingBearingX,
      geometry.movingBearingInitialX + expectedBearingTravel,
      4e-16,
      `moving-bearing position at sample ${sample}`,
    );
    near(
      transmission.bearingTravelForInputAngle(inputAngle),
      expectedBearingTravel,
      2e-16,
      `transmission helper at sample ${sample}`,
    );
  }
  assert.ok(maximumShaftError < 5e-16);
  assert.ok(maximumBearingError < 2e-16);
  near(
    transmission.bearingTravelForPitches(FULL_TURN, 0.25, 0.25),
    0,
    0,
    'equal pitches produce zero differential travel',
  );
  assert.equal(transmission.equalPitchesProduceZeroTravel, true);
  near(
    transmission.shaftTravelPerRevolution,
    geometry.fixedThreadPitch,
    0,
    'coarse-thread shaft travel per revolution',
  );
  near(
    transmission.bearingTravelPerRevolution,
    geometry.fixedThreadPitch - geometry.movingThreadPitch,
    0,
    'pitch-difference bearing travel per revolution',
  );
  disposeModel(model.root);
});

test('movement 266 keeps both nut phases fixed and both threads engaged', () => {
  const model = createMovementModel(catalog.movements[265]);
  const { stateAtTime, timeline } = model.root.userData;
  let maximumFixedPhaseError = 0;
  let maximumMovingPhaseError = 0;
  let minimumEngagementMargin = Infinity;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(
      timeline.demonstrationPeriod * sample / 8192,
    );
    maximumFixedPhaseError = Math.max(
      maximumFixedPhaseError,
      Math.abs(state.fixedThreadPhaseError),
    );
    maximumMovingPhaseError = Math.max(
      maximumMovingPhaseError,
      Math.abs(state.movingThreadPhaseError),
    );
    minimumEngagementMargin = Math.min(
      minimumEngagementMargin,
      state.fixedThreadEngagementLeft,
      state.fixedThreadEngagementRight,
      state.movingThreadEngagementLeft,
      state.movingThreadEngagementRight,
    );
  }
  assert.ok(maximumFixedPhaseError < 2e-14);
  assert.ok(maximumMovingPhaseError < 2e-14);
  assert.ok(minimumEngagementMargin > 0.149);
  disposeModel(model.root);
});

test('movement 266 analytic speeds and accelerations match finite differences', () => {
  const model = createMovementModel(catalog.movements[265]);
  const { geometry, stateAtTime } = model.root.userData;
  const derivativeStep = 1e-5;
  let maximumShaftSpeedError = 0;
  let maximumBearingSpeedError = 0;
  let maximumShaftAccelerationError = 0;
  let maximumBearingAccelerationError = 0;

  for (const time of [0.4, 1.1, 2.3, 3.8, 5.4, 6.4, 7.7, 9.2, 10.8, 11.6]) {
    const before = stateAtTime(time - derivativeStep);
    const state = stateAtTime(time);
    const after = stateAtTime(time + derivativeStep);
    maximumShaftSpeedError = Math.max(
      maximumShaftSpeedError,
      Math.abs(
        (after.shaftTranslation - before.shaftTranslation)
          / (2 * derivativeStep) - state.shaftAxialVelocity,
      ),
    );
    maximumBearingSpeedError = Math.max(
      maximumBearingSpeedError,
      Math.abs(
        (after.bearingTravel - before.bearingTravel)
          / (2 * derivativeStep) - state.bearingAxialVelocity,
      ),
    );
    maximumShaftAccelerationError = Math.max(
      maximumShaftAccelerationError,
      Math.abs(
        (after.shaftAxialVelocity - before.shaftAxialVelocity)
          / (2 * derivativeStep) - state.shaftAxialAcceleration,
      ),
    );
    maximumBearingAccelerationError = Math.max(
      maximumBearingAccelerationError,
      Math.abs(
        (after.bearingAxialVelocity - before.bearingAxialVelocity)
          / (2 * derivativeStep) - state.bearingAxialAcceleration,
      ),
    );
    near(state.fixedBearingX, geometry.fixedBearingX, 0,
      `fixed bearing station at ${time}`);
  }
  assert.ok(maximumShaftSpeedError < 2e-10);
  assert.ok(maximumBearingSpeedError < 5e-11);
  assert.ok(maximumShaftAccelerationError < 2e-10);
  assert.ok(maximumBearingAccelerationError < 5e-11);
  disposeModel(model.root);
});

test('movement 266 renderer binds the shaft, bearings, and visible indices', () => {
  const model = createMovementModel(catalog.movements[265]);
  const { blocks, stateAtTime } = model.root.userData;
  const fixedBearingPosition = blocks.fixedBearing.position.clone();
  const fixedSupportPosition = blocks.fixedSupport.position.clone();
  const screwThreads = [];
  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.screwThread) screwThreads.push(object);
    roles.push(object.userData.role ?? '');
  });

  assert.equal(screwThreads.length, 2);
  assert.equal(
    roles.filter((role) => role === 'white-input-handle-rotation-index').length,
    1,
  );
  assert.equal(
    roles.filter((role) => role
      === 'white-index-showing-differential-bearing-travel').length,
    1,
  );
  assert.equal(
    roles.filter((role) => role
      === 'movable-bearing-standard-rigidly-joining-bearing-to-sliding-foot').length,
    1,
  );

  for (const time of [0, 1.2, 3.7, 6, 7.8, 10.4, 12]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.shaft.position.x, state.shaftTranslation, 0,
      `rendered shaft translation at ${time}`);
    near(blocks.shaftRotor.rotation.z, state.inputAngle, 0,
      `rendered shaft angle at ${time}`);
    near(blocks.movingBearing.position.x, state.movingBearingX, 0,
      `rendered moving-bearing station at ${time}`);
    near(blocks.fixedBearing.position.distanceTo(fixedBearingPosition), 0, 0,
      `fixed bearing remains immobile at ${time}`);
    near(blocks.fixedSupport.position.distanceTo(fixedSupportPosition), 0, 0,
      `fixed standard remains immobile at ${time}`);
    near(blocks.movingBearing.position.y, 0, 0,
      `moving bearing remains on its axial guide at ${time}`);
    near(blocks.movingBearing.position.z, 0, 0,
      `moving bearing cannot rotate off its guide at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 266 reverses smoothly, closes exactly, and leaves 269 authored', () => {
  const model = createMovementModel(catalog.movements[265]);
  const {
    animationTiming,
    canonicalTimes,
    driveSchedule,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const start = stateAtTime(canonicalTimes.sourcePose);
  const maximum = stateAtTime(canonicalTimes.maximumForwardTravel);
  const closure = stateAtTime(canonicalTimes.cycleClosure);

  assert.match(driveSchedule.input, /three-turn-forward/);
  assert.equal(driveSchedule.sourcePrescribesReversal, false);
  assert.match(driveSchedule.purpose, /without teleporting/);
  near(maximum.inputAngleUnwrapped, geometry.inputMaximumAngle, 0,
    'maximum input excursion');
  near(maximum.shaftTranslation, geometry.maximumShaftTranslation, 0,
    'maximum shaft excursion');
  near(maximum.bearingTravel, geometry.maximumBearingTravel, 0,
    'maximum differential excursion');
  near(maximum.inputAngularSpeed, 0, 0, 'smooth input reversal');
  near(maximum.shaftAxialVelocity, 0, 0, 'smooth shaft reversal');
  near(maximum.bearingAxialVelocity, 0, 0, 'smooth bearing reversal');
  near(closure.inputAngleUnwrapped, start.inputAngleUnwrapped, 0,
    'input closure');
  near(closure.shaftTranslation, start.shaftTranslation, 0,
    'shaft closure');
  near(closure.bearingTravel, start.bearingTravel, 0,
    'bearing closure');
  near(closure.inputAngularSpeed, start.inputAngularSpeed, 0,
    'angular-rate closure');
  assert.equal(timeline.demonstrationPeriod, 12);
  assert.equal(animationTiming.authoredCyclePeriod, 12);
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
