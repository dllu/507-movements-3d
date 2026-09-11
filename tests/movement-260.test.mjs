import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
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

test('movement 260 is the source twin-reduction rotating-nut differential screw', () => {
  const movement = catalog.movements[259];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    geometry,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 260);
  assert.equal(movement.number, '260');
  assert.equal(movement.title, 'Twin-Pinion Differential Screw Drive');
  assert.equal(movement.category, 'Differential & variable drives');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'common-input-twin-spur-reductions-driving-rotating-nut-differential-screw-translation',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /shaft-A-rigidly-carries-long-pinion-F-and-pinion-B/);
  assert.match(mechanism, /wheel-D-rigid-with-screw-C/);
  assert.match(mechanism, /axially-fixed-wheel-E/);
  assert.equal(blocks.longPinionF.parent, blocks.inputAssembly);
  assert.equal(blocks.pinionB.parent, blocks.inputAssembly);
  assert.equal(blocks.wheelD.parent, blocks.screwAssembly);
  assert.equal(blocks.screwCore.parent, blocks.screwAssembly);
  assert.equal(blocks.externalThread.parent, blocks.screwAssembly);
  assert.equal(blocks.wheelE.parent, blocks.nutAssembly);
  assert.equal(blocks.internalThread.parent, blocks.nutAssembly);
  assert.equal(blocks.nutAssembly.userData.axiallyFixed, true);
  assert.deepEqual(
    [
      geometry.pinionFTeeth,
      geometry.wheelDTeeth,
      geometry.pinionBTeeth,
      geometry.wheelETeeth,
    ],
    [10, 102, 19, 93],
  );
  assert.equal(
    transmission.differentialTravelLaw,
    'x=(screw-lead/(2*pi))*(wheel-D-angle-wheel-E-nut-angle)',
  );
  disposeModel(model.root);
});

test('movement 260 preserves its unavailable labeled source elevation', () => {
  const movement = catalog.movements[259];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.plate260;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 6);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterAxisY, { input: 94, screw: 301 });
  assert.deepEqual(plate.rasterPinionFBounds, {
    bottom: 111,
    left: 98,
    right: 327,
    top: 76,
  });
  assert.deepEqual(plate.rasterWheelDBounds, {
    bottom: 490,
    left: 241,
    right: 280,
    top: 112,
  });
  assert.deepEqual(plate.rasterPinionBBounds, {
    bottom: 129,
    left: 394,
    right: 438,
    top: 62,
  });
  assert.deepEqual(plate.rasterWheelEBounds, {
    bottom: 466,
    left: 393,
    right: 438,
    top: 130,
  });
  assert.match(plate.inferredTopology, /two external spur reductions/);
  assert.match(plate.inferredTopology, /axially fixed rotating nut wheel/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 67,
    edition: 21,
    illustrationPage: 66,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 260 matches measured gear and long-pinion proportions', () => {
  const model = createMovementModel(catalog.movements[259]);
  const { geometry, sourceReference } = model.root.userData;
  const plate = sourceReference.plate260;
  const rasterPinionFRadius = (
    plate.rasterPinionFBounds.bottom - plate.rasterPinionFBounds.top
  ) / 2;
  const rasterWheelDRadius = (
    plate.rasterWheelDBounds.bottom - plate.rasterWheelDBounds.top
  ) / 2;
  const rasterPinionBRadius = (
    plate.rasterPinionBBounds.bottom - plate.rasterPinionBBounds.top
  ) / 2;
  const rasterWheelERadius = (
    plate.rasterWheelEBounds.bottom - plate.rasterWheelEBounds.top
  ) / 2;
  const rasterLongPinionWidth =
    plate.rasterPinionFBounds.right - plate.rasterPinionFBounds.left;
  const rasterWheelDWidth =
    plate.rasterWheelDBounds.right - plate.rasterWheelDBounds.left;
  const rasterWheelEWidth =
    plate.rasterWheelEBounds.right - plate.rasterWheelEBounds.left;
  const rasterAxisSeparation =
    plate.rasterAxisY.screw - plate.rasterAxisY.input;

  near(geometry.pinionFRadius / geometry.wheelDRadius,
    rasterPinionFRadius / rasterWheelDRadius, 0.008,
    'F-to-D radius ratio');
  near(geometry.pinionBRadius / geometry.wheelERadius,
    rasterPinionBRadius / rasterWheelERadius, 0.008,
    'B-to-E radius ratio');
  near(geometry.wheelDRadius / geometry.wheelERadius,
    rasterWheelDRadius / rasterWheelERadius, 0.035,
    'D-to-E radius ratio');
  near(geometry.commonCenterDistance / geometry.wheelDRadius,
    rasterAxisSeparation / rasterWheelDRadius, 0.008,
    'axis-separation-to-D-radius ratio');
  near(geometry.longPinionFaceWidth / geometry.wheelDRadius,
    rasterLongPinionWidth / rasterWheelDRadius, 0.008,
    'long-F-face-to-D-radius ratio');
  near(geometry.wheelDFaceWidth / geometry.wheelDRadius,
    rasterWheelDWidth / rasterWheelDRadius, 0.04,
    'D-face-to-radius ratio');
  near(geometry.narrowGearFaceWidth / geometry.wheelERadius,
    rasterWheelEWidth / rasterWheelERadius, 0.01,
    'E-face-to-radius ratio');
  for (const [radius, teeth, label] of [
    [geometry.pinionFRadius, geometry.pinionFTeeth, 'F'],
    [geometry.wheelDRadius, geometry.wheelDTeeth, 'D'],
    [geometry.pinionBRadius, geometry.pinionBTeeth, 'B'],
    [geometry.wheelERadius, geometry.wheelETeeth, 'E'],
  ]) {
    near(2 * radius / teeth, geometry.commonModule, 2e-17,
      `${label} common module`);
  }
  near(geometry.pinionFRadius + geometry.wheelDRadius,
    geometry.commonCenterDistance, 0, 'F-D center distance');
  near(geometry.pinionBRadius + geometry.wheelERadius,
    geometry.commonCenterDistance, 5e-16, 'B-E center distance');
  disposeModel(model.root);
});

test('movement 260 satisfies both external-gear phase and pitch-speed laws', () => {
  const model = createMovementModel(catalog.movements[259]);
  const { geometry, stateAtTime, timeline, transmission } = model.root.userData;
  let maximumPhaseError = 0;
  let maximumPitchSpeedError = 0;
  let maximumDRatioError = 0;
  let maximumERatioError = 0;

  for (let sample = 0; sample <= 16384; sample += 1) {
    const time = timeline.demonstrationPeriod * sample / 16384;
    const state = stateAtTime(time);
    maximumPhaseError = Math.max(
      maximumPhaseError,
      Math.abs(state.externalMeshPhaseErrorFD),
      Math.abs(state.externalMeshPhaseErrorBE),
    );
    maximumPitchSpeedError = Math.max(
      maximumPitchSpeedError,
      Math.abs(state.wheelDMeshPitchSpeedError),
      Math.abs(state.wheelEMeshPitchSpeedError),
    );
    maximumDRatioError = Math.max(
      maximumDRatioError,
      Math.abs(
        state.wheelDUnwrappedAngle
          - transmission.pinionFToWheelDRatio * state.inputUnwrappedAngle,
      ),
    );
    maximumERatioError = Math.max(
      maximumERatioError,
      Math.abs(
        state.wheelEUnwrappedAngle
          - transmission.pinionBToWheelERatio * state.inputUnwrappedAngle,
      ),
    );
  }
  assert.ok(maximumPhaseError < 4e-12);
  assert.ok(maximumPitchSpeedError < 2e-15);
  assert.ok(maximumDRatioError < 2e-15);
  assert.ok(maximumERatioError < 2e-15);
  near(transmission.pinionFToWheelDRatio,
    -geometry.pinionFTeeth / geometry.wheelDTeeth, 0,
    'F-D external ratio');
  near(transmission.pinionBToWheelERatio,
    -geometry.pinionBTeeth / geometry.wheelETeeth, 0,
    'B-E external ratio');
  disposeModel(model.root);
});

test('movement 260 screw travel is exactly the wheel-speed difference times lead', () => {
  const model = createMovementModel(catalog.movements[259]);
  const { geometry, stateAtTime, timeline, transmission } = model.root.userData;
  const step = 1e-6;
  let maximumPositionError = 0;
  let maximumRateError = 0;
  let maximumNumericalRateError = 0;

  for (let sample = 1; sample < 8192; sample += 1) {
    const time = timeline.demonstrationPeriod * sample / 8192;
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    maximumPositionError = Math.max(
      maximumPositionError,
      Math.abs(
        state.screwTranslation
          - geometry.screwLeadPerRadian * state.relativeThreadRotation,
      ),
    );
    maximumRateError = Math.max(
      maximumRateError,
      Math.abs(
        state.screwAxialVelocity
          - geometry.screwLeadPerRadian
            * (state.screwAngularSpeed - state.nutAngularSpeed),
      ),
    );
    const numericalVelocity = (
      after.screwTranslation - before.screwTranslation
    ) / (2 * step);
    maximumNumericalRateError = Math.max(
      maximumNumericalRateError,
      Math.abs(numericalVelocity - state.screwAxialVelocity),
    );
    near(state.threadPhaseError, 0, 2e-15,
      `thread phase at ${sample}`);
  }
  assert.ok(maximumPositionError < 2e-16);
  assert.ok(maximumRateError < 2e-16);
  assert.ok(maximumNumericalRateError < 2e-9);
  near(
    transmission.differentialTravelRateForAngularSpeeds(2.5, 2.5),
    0,
    0,
    'equal wheel velocities produce no screw travel',
  );
  near(
    transmission.differentialTravelRateForAngularSpeeds(2.5, 1.2),
    geometry.screwLeadPerRadian * 1.3,
    0,
    'unequal wheel velocities produce differential travel',
  );
  assert.equal(transmission.rightHandThreadAssumption, true);
  disposeModel(model.root);
});

test('movement 260 keeps E fixed, D meshed across travel, and both threads engaged', () => {
  const model = createMovementModel(catalog.movements[259]);
  const { blocks, geometry, stateAtTime, timeline } = model.root.userData;
  let minimumFaceOverlap = Infinity;
  let minimumThreadEngagement = Infinity;
  let maximumNutAxialError = 0;
  let maximumWheelEAxialError = 0;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(
      timeline.demonstrationPeriod * sample / 8192,
    );
    minimumFaceOverlap = Math.min(
      minimumFaceOverlap,
      state.longPinionFaceOverlap,
    );
    minimumThreadEngagement = Math.min(
      minimumThreadEngagement,
      state.threadEngagementLength,
    );
    maximumNutAxialError = Math.max(
      maximumNutAxialError,
      Math.abs(state.nutAxialPosition - geometry.fixedGearStationX),
    );
    maximumWheelEAxialError = Math.max(
      maximumWheelEAxialError,
      Math.abs(state.wheelEAxialPosition - geometry.fixedGearStationX),
    );
  }
  near(minimumFaceOverlap, geometry.wheelDFaceWidth, 3e-16,
    'D remains fully within long F face');
  near(minimumThreadEngagement, geometry.nutWidth, 3e-16,
    'full nut thread remains engaged');
  near(maximumNutAxialError, 0, 0, 'nut axial fixation');
  near(maximumWheelEAxialError, 0, 0, 'wheel E axial fixation');
  assert.ok(geometry.threadRadialClearance > 0);
  assert.equal(blocks.externalThread.userData.rightHanded, true);
  assert.equal(blocks.internalThread.userData.rightHanded, true);
  near(blocks.externalThread.userData.lead, geometry.screwLead, 0,
    'external lead');
  near(blocks.internalThread.userData.lead, geometry.screwLead, 0,
    'internal lead');
  assert.ok(
    blocks.externalThread.userData.xStart
      > geometry.wheelDNominalX + geometry.wheelDFaceWidth / 2,
  );
  assert.ok(
    blocks.externalThread.userData.xEnd
      <= geometry.screwCoreLength / 2 + 0.45,
  );
  assert.equal(blocks.fixedNutBearing.parent, blocks.frame);
  assert.notEqual(blocks.nutAssembly.parent, blocks.frame);
  disposeModel(model.root);
});

test('movement 260 renderer shows a smooth reversible differential excursion', () => {
  const model = createMovementModel(catalog.movements[259]);
  const {
    blocks,
    canonicalTimes,
    driveSchedule,
    stateAtTime,
  } = model.root.userData;
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));

  assert.equal(driveSchedule.sourcePrescribesDriveSchedule, false);
  assert.match(driveSchedule.inputExcursion, /smooth-forward-eight-turn/);
  assert.match(driveSchedule.purpose, /without-teleporting/);
  assert.equal(
    roles.filter((role) => role === 'white-driving-shaft-A-speed-index').length,
    1,
  );
  assert.equal(
    roles.filter((role) => role === 'white-screw-C-speed-and-travel-index').length,
    1,
  );
  assert.equal(
    roles.filter((role) => role === 'moving-pitch-contact-F-to-D').length,
    1,
  );
  assert.equal(
    roles.filter((role) => role === 'fixed-pitch-contact-B-to-E').length,
    1,
  );
  const start = stateAtTime(canonicalTimes.start);
  const forward = stateAtTime(3);
  const maximum = stateAtTime(canonicalTimes.maximumTravel);
  const reverse = stateAtTime(9);
  assert.ok(forward.inputAngularSpeed > 0);
  assert.ok(reverse.inputAngularSpeed < 0);
  near(start.inputAngularSpeed, 0, 0, 'start at rest');
  near(maximum.inputAngularSpeed, 0, 2e-15, 'smooth reversal at rest');
  near(maximum.screwTranslation, model.root.userData.geometry.maximumScrewTravel,
    2e-16, 'maximum screw travel');

  for (const time of [0, 1.2, 3, 6, 8.4, 11.9]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.inputAssembly.rotation.x, state.inputAngle, 0,
      `rendered input angle at ${time}`);
    near(blocks.screwAssembly.rotation.x, state.screwAngle, 0,
      `rendered screw angle at ${time}`);
    near(blocks.screwAssembly.position.x, state.screwTranslation, 0,
      `rendered screw translation at ${time}`);
    near(blocks.nutAssembly.rotation.x, state.nutAngle, 0,
      `rendered nut angle at ${time}`);
    near(blocks.nutAssembly.position.x, 0, 0,
      `fixed nut assembly x at ${time}`);
    near(blocks.contactMarkerFD.position.x, state.wheelDAxialPosition, 0,
      `moving F-D contact at ${time}`);
    near(blocks.contactMarkerBE.position.x,
      model.root.userData.geometry.fixedGearStationX, 0,
      `fixed B-E contact at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 260 closes exactly in twelve seconds and leaves 269 authored', () => {
  const model = createMovementModel(catalog.movements[259]);
  const { animationTiming, stateAtTime, timeline } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.cycleClosure);

  near(animationTiming.authoredCyclePeriod, 12, 0, 'authored cycle period');
  near(animationTiming.targetCycleDuration, 2, 0, 'display period');
  assertReadableTiming(animationTiming);
  for (const key of [
    'inputAngle',
    'nutAngle',
    'screwAngle',
    'screwTranslation',
    'wheelDAngle',
    'wheelDAxialPosition',
    'wheelEAngle',
    'wheelEAxialPosition',
  ]) {
    near(closure[key], start[key], 0, `${key} closure`);
  }

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
