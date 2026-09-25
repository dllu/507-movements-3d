import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
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

function vector2Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function vector3Near(actual, expected, tolerance, message) {
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

test('movement 338 is the upper-radius vibrating-rod parallel motion', () => {
  const movement = catalog.movements[337];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    contacts,
    degreesOfFreedom,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 338);
  assert.equal(movement.number, '338');
  assert.equal(movement.title,
    'parallel motion with the radius bar above the beam');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'beam-centered-vibrating-rod-with-upper-fixed-radius-parallel-motion');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /centered-vibrating-rod-L-R-U/);
  assert.match(mechanism, /upper-radius-bar-F-U/);
  assert.match(mechanism, /lower-end-L/);
  assert.match(transmission.exactRigidConstraints,
    /\|L-R\|=\|R-U\|=2/);
  assert.match(transmission.exactRigidConstraints, /\|F-U\|=4\.25455/);
  assert.match(transmission.straightness, /near-vertical 3\.9996-unit stroke/);
  assert.equal(degreesOfFreedom.mechanism, 1);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.beam.parent, model.root);
  assert.equal(blocks.vibratingRod.parent, model.root);
  assert.equal(blocks.radiusBar.parent, model.root);
  assert.equal(blocks.output.parent, model.root);
  assert.equal(blocks.beamBody.parent, blocks.beam);
  assert.equal(blocks.vibratingMidpointAnchor.parent, blocks.vibratingRod);
  assert.equal(blocks.pistonRod.parent, blocks.output);
  assert.equal(blocks.jointPins.L.parent, blocks.output);
  assert.equal(blocks.jointPins.R.parent, blocks.beam);
  assert.equal(blocks.jointPins.U.parent, blocks.radiusBar);
  assert.equal(contacts.beamPivotO.movingMember, blocks.beam);
  assert.equal(contacts.radiusPivotF.movingMember, blocks.radiusBar);
  assert.deepEqual(contacts.beamAtR.members,
    [blocks.beam, blocks.vibratingRod]);
  assert.deepEqual(contacts.radiusAtU.members,
    [blocks.vibratingRod, blocks.radiusBar]);
  assert.deepEqual(contacts.pistonAtL.members,
    [blocks.vibratingRod, blocks.output]);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'sixteen-unit-rocking-beam-with-right-pin-R').length, 1);
  assert.equal(roles.filter((role) => role ===
    'four-unit-vibrating-rod-L-R-U-centered-on-beam').length, 1);
  assert.equal(roles.filter((role) => role ===
    'four-point-two-five-four-five-five-unit-upper-radius-bar-F-U').length,
  1);
  assert.equal(roles.filter((role) => role ===
    'piston-rod-carried-by-lower-vibrating-rod-end-L').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 338 preserves every official source coordinate and length', () => {
  const movement = catalog.movements[337];
  const model = createMovementModel(movement);
  const {
    geometry,
    modelPointToOfficialAnimationRaster,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const official = sourceAnimation.officialGeometry;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.durationSeconds, 4);
  assert.deepEqual(sourceAnimation.officialFunctionChain, [
    'add_stat',
    'add_rot',
    'add_c_rod_r',
    'add_rot_to',
    'add_c_rod_r',
    'add_rot_to',
    'add_tx',
  ]);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_338.html');
  assert.match(sourceAnimation.referenceScope, /centered four-unit/);
  assert.match(sourceAnimation.reconstructionDifference,
    /4\.254550197-unit distance/);

  assert.deepEqual(official.beamPivotO, new THREE.Vector2(0, 0));
  assert.equal(official.beamHalfRadius, 8);
  assert.deepEqual(official.hiddenCrankCenter,
    new THREE.Vector2(-8, -10));
  assert.equal(official.hiddenCrankRadius, 2);
  assert.equal(official.hiddenDriveRodLength, 10);
  assert.equal(official.inputPhaseOffsetTurns, 0.125);
  assert.equal(official.vibratingRodHalfLength, 2);
  assert.equal(official.vibratingRodLength, 4);
  assert.deepEqual(official.radiusPivotF,
    new THREE.Vector2(3.74545, 2));
  assert.deepEqual(official.radiusReferencePoint,
    new THREE.Vector2(7.935364, 2.738795));
  near(official.canvasRadiusConstraintLength, 4.254550197073834, 2e-15,
    'canvas rounded-reference radius');
  assert.equal(official.radiusBarLength, 4.25455);
  assert.deepEqual(official.strokeLine, [
    new THREE.Vector2(8, -1),
    new THREE.Vector2(8, -9),
  ]);
  assert.equal(official.canvasPistonRodLength, 16);

  near(geometry.beamHalfRadius, 8 * geometry.sourceScale, 0,
    'scaled beam half-radius');
  near(geometry.hiddenCrankRadius, 2 * geometry.sourceScale, 0,
    'scaled hidden crank');
  near(geometry.hiddenDriveRodLength, 10 * geometry.sourceScale, 0,
    'scaled hidden connecting rod');
  near(geometry.vibratingRodHalfLength, 2 * geometry.sourceScale, 0,
    'scaled vibrating half-rod');
  near(geometry.vibratingRodLength, 4 * geometry.sourceScale, 0,
    'scaled complete vibrating rod');
  near(geometry.radiusBarLength, 4.25455 * geometry.sourceScale, 0,
    'scaled stated F-U bar');
  near(geometry.canvasRadiusConstraintLength
    - geometry.radiusBarLength,
  (official.canvasRadiusConstraintLength - official.radiusBarLength)
    * geometry.sourceScale,
  1e-15,
  'scaled source rounding discrepancy');
  vector2Near(geometry.radiusPivotF,
    new THREE.Vector2(3.74545, 2).multiplyScalar(geometry.sourceScale),
  0, 'scaled upper pivot F');

  assert.equal(sourceReference.brownPlate338.imageWidth, 525);
  assert.equal(sourceReference.brownPlate338.imageHeight, 525);
  assert.match(sourceReference.brownPlate338.inferredTopology,
    /above the beam/);
  assert.deepEqual(sourceReference.officialAnimationView, {
    canvasHeight: 525,
    canvasWidth: 525,
    minimum: new THREE.Vector2(-2.207959, -6),
    viewHeight: 12,
    viewWidth: 12,
  });
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    edition: 21,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.officialDescription, movement.description);
  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(-2.207959, -6).multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(0, 525), 0, 'official lower-left view corner');
  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(9.792041, 6).multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(525, 0), 1.2e-13,
  'official upper-right view corner');
  disposeModel(model.root);
});

test('movement 338 hidden crank drives one exact finite-rod rocking beam', () => {
  const model = createMovementModel(catalog.movements[337]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 8192);
    near(state.inputCrankPin.distanceTo(geometry.hiddenCrankCenter),
      geometry.hiddenCrankRadius, 9e-16,
    `hidden crank radius at ${sample}`);
    near(state.beamNegativePoint.distanceTo(state.inputCrankPin),
      geometry.hiddenDriveRodLength, 4e-15,
    `hidden connecting rod at ${sample}`);
    near(state.beamNegativePoint.distanceTo(geometry.beamPivotO),
      geometry.beamHalfRadius, 2e-15,
    `negative beam half at ${sample}`);
    near(state.beamPointR.distanceTo(geometry.beamPivotO),
      geometry.beamHalfRadius, 2e-15,
    `positive beam half O-R at ${sample}`);
    vector2Near(state.beamNegativePoint,
      state.beamPointR.clone().multiplyScalar(-1), 0,
    `opposed beam stations at ${sample}`);
    near(state.beam.angle,
      Math.atan2(state.beamPointR.y, state.beamPointR.x), 0,
    `beam angle at ${sample}`);
  }
  assert.ok(geometry.minimumBeamAngle < -0.2523);
  assert.ok(geometry.minimumBeamAngle > -0.2524);
  assert.ok(geometry.maximumBeamAngle > 0.2532);
  assert.ok(geometry.maximumBeamAngle < 0.2533);
  disposeModel(model.root);
});

test('movement 338 closes the centered vibrating rod and upper radius bar', () => {
  const model = createMovementModel(catalog.movements[337]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 8192);
    near(state.pointL.distanceTo(state.beamPointR),
      geometry.vibratingRodHalfLength, 4e-15,
    `L-R half-rod at ${sample}`);
    near(state.pointU.distanceTo(state.beamPointR),
      geometry.vibratingRodHalfLength, 4e-15,
    `R-U half-rod at ${sample}`);
    near(state.pointU.distanceTo(state.pointL),
      geometry.vibratingRodLength, 6e-15,
    `complete L-U vibrating rod at ${sample}`);
    near(state.pointU.distanceTo(geometry.radiusPivotF),
      geometry.radiusBarLength, 6e-15,
    `fixed upper radius F-U at ${sample}`);
    vector2Near(state.beamPointR,
      state.pointL.clone().add(state.pointU).multiplyScalar(0.5), 1e-15,
    `R is exact rod center at ${sample}`);
    vector2Near(state.pointL,
      state.beamPointR.clone().multiplyScalar(2).sub(state.pointU), 0,
    `lower piston point extrapolation at ${sample}`);
    vector2Near(state.pointLVelocity,
      state.beamPointRVelocity.clone().multiplyScalar(2)
        .sub(state.pointUVelocity), 0,
    `lower piston velocity at ${sample}`);
    vector2Near(state.pointLAcceleration,
      state.beamPointRAcceleration.clone().multiplyScalar(2)
        .sub(state.pointUAcceleration), 0,
    `lower piston acceleration at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 338 exposes the true near-straight lower-end piston locus', () => {
  const model = createMovementModel(catalog.movements[337]);
  const { geometry, stateAtTime } = model.root.userData;
  let maximumDeviation = 0;
  let maximumCanvasDifference = 0;
  let maximumCanvasRadiusResidual = 0;
  let minimumX = Infinity;
  let maximumX = -Infinity;
  let minimumY = Infinity;
  let maximumY = -Infinity;

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 16384);
    maximumDeviation = Math.max(maximumDeviation,
      Math.abs(state.pistonLateralDeviation));
    maximumCanvasDifference = Math.max(maximumCanvasDifference,
      state.pistonDifferenceFromCanvas);
    maximumCanvasRadiusResidual = Math.max(maximumCanvasRadiusResidual,
      Math.abs(state.officialCanvasApproximation.radiusBarResidual));
    minimumX = Math.min(minimumX, state.pointL.x);
    maximumX = Math.max(maximumX, state.pointL.x);
    minimumY = Math.min(minimumY, state.pointL.y);
    maximumY = Math.max(maximumY, state.pointL.y);
  }
  near(maximumDeviation, geometry.maximumLateralDeviation, 3e-9,
    'maximum piston lateral deviation');
  near(maximumCanvasDifference, geometry.maximumPistonDifferenceFromCanvas,
    3e-12, 'maximum physical-versus-canvas piston difference');
  near(maximumCanvasRadiusResidual,
    geometry.canvasRadiusConstraintLength - geometry.radiusBarLength,
  4e-15, 'constant rounded source radius residual');
  near(minimumX, geometry.minimumPistonX, 3e-9,
    'minimum piston abscissa');
  near(maximumX, geometry.maximumPistonX, 3e-9,
    'maximum piston abscissa');
  near(minimumY, geometry.minimumPistonY, 3e-9,
    'minimum piston ordinate');
  near(maximumY, geometry.maximumPistonY, 3e-9,
    'maximum piston ordinate');
  near(maximumY - minimumY, geometry.outputStroke, 3e-9,
    'piston stroke');
  assert.ok(maximumDeviation / geometry.sourceScale > 0.01621);
  assert.ok(maximumDeviation / geometry.sourceScale < 0.01622);
  assert.ok(geometry.outputStroke / geometry.sourceScale > 3.9996);
  assert.ok(geometry.outputStroke / geometry.sourceScale < 3.9997);
  assert.ok(maximumCanvasDifference / geometry.sourceScale < 0.000000243);
  assert.ok(geometry.maximumLateralDeviation > 0,
    'the historical parallel motion is approximate rather than forced straight');
  disposeModel(model.root);
});

test('movement 338 analytic crank and linkage rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[337]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-5;
  const pointFields = [
    ['inputCrankPin', 'inputCrankPinVelocity', 'inputCrankPinAcceleration'],
    ['beamNegativePoint', 'beamNegativeVelocity', 'beamNegativeAcceleration'],
    ['beamPointR', 'beamPointRVelocity', 'beamPointRAcceleration'],
    ['pointU', 'pointUVelocity', 'pointUAcceleration'],
    ['pointL', 'pointLVelocity', 'pointLAcceleration'],
  ];

  for (const time of [0.13, 0.45, 0.86, 1.29, 1.71, 2.16, 2.58, 3.03, 3.47, 3.82]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    for (const [pointKey, velocityKey, accelerationKey] of pointFields) {
      vector2Near(after[pointKey].clone().sub(before[pointKey])
        .multiplyScalar(1 / (2 * step)), state[velocityKey], 3e-9,
      `${pointKey} velocity at ${time}`);
      vector2Near(after[velocityKey].clone().sub(before[velocityKey])
        .multiplyScalar(1 / (2 * step)), state[accelerationKey], 8e-9,
      `${pointKey} acceleration at ${time}`);
    }
    for (const link of ['beam', 'vibratingRod', 'radiusBar']) {
      near((after[link].angle - before[link].angle) / (2 * step),
        state[link].angularVelocity, 2e-9,
      `${link} angular velocity at ${time}`);
      near((after[link].angularVelocity - before[link].angularVelocity)
        / (2 * step), state[link].angularAcceleration, 7e-9,
      `${link} angular acceleration at ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 338 renderer binds L, R, U, and the above-beam radius', () => {
  const model = createMovementModel(catalog.movements[337]);
  const {
    animationTiming,
    blocks,
    contacts,
    geometry,
    stateAtTime,
  } = model.root.userData;
  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  model.root.updateMatrixWorld(true);
  const fixedFrameMatrix = blocks.fixedFrame.matrixWorld.clone();
  for (const time of [0, 0.32, 0.76, 1.21, 1.67, 2.12, 2.58, 3.05, 3.53, 4]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.beam.rotation.z, state.beam.angle, 0,
      `rendered beam angle at ${time}`);
    near(blocks.vibratingRod.rotation.z, state.vibratingRod.angle, 0,
      `rendered L-U angle at ${time}`);
    near(blocks.radiusBar.rotation.z, state.radiusBar.angle, 0,
      `rendered F-U angle at ${time}`);
    vector3Near(blocks.beamPointRAnchor.getWorldPosition(new THREE.Vector3()),
      new THREE.Vector3(state.beamPointR.x, state.beamPointR.y, 0.04),
    1.2e-15, `beam center pin R at ${time}`);
    vector3Near(blocks.vibratingRodStartAnchor.getWorldPosition(
      new THREE.Vector3()),
    new THREE.Vector3(state.pointL.x, state.pointL.y, 0.39),
    0, `vibrating rod at L at ${time}`);
    vector3Near(blocks.vibratingMidpointAnchor.getWorldPosition(
      new THREE.Vector3()),
    new THREE.Vector3(state.beamPointR.x, state.beamPointR.y, 0.39),
    2e-15, `vibrating rod midpoint R at ${time}`);
    vector3Near(blocks.vibratingRodEndAnchor.getWorldPosition(
      new THREE.Vector3()),
    new THREE.Vector3(state.pointU.x, state.pointU.y, 0.39),
    3e-15, `vibrating rod at U at ${time}`);
    vector3Near(blocks.radiusBarStartAnchor.getWorldPosition(
      new THREE.Vector3()),
    new THREE.Vector3(geometry.radiusPivotF.x,
      geometry.radiusPivotF.y, 0.70),
    0, `fixed radius origin F at ${time}`);
    vector3Near(blocks.radiusBarEndAnchor.getWorldPosition(
      new THREE.Vector3()),
    new THREE.Vector3(state.pointU.x, state.pointU.y, 0.70),
    4e-15, `radius bar at U at ${time}`);
    vector3Near(blocks.outputAnchor.getWorldPosition(new THREE.Vector3()),
      new THREE.Vector3(state.pointL.x, state.pointL.y, 0.57),
    0, `piston point L at ${time}`);
    vector3Near(contacts.beamAtR.point,
      new THREE.Vector3(state.beamPointR.x, state.beamPointR.y, 0.35), 0,
    `live R contact at ${time}`);
    vector3Near(contacts.radiusAtU.point,
      new THREE.Vector3(state.pointU.x, state.pointU.y, 0.55), 0,
    `live U contact at ${time}`);
    vector3Near(contacts.pistonAtL.point,
      new THREE.Vector3(state.pointL.x, state.pointL.y, 0.52), 0,
    `live L contact at ${time}`);
    assert.ok(blocks.fixedFrame.matrixWorld.equals(fixedFrameMatrix));
  }

  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 7.6, 'whole sixteen-unit beam, bosses included');
  assert.ok(size.y > 3.0);
  assert.ok(size.z > 1.1,
    'beam, centered rod, upper radius bar and piston use depth');
  const drawnRoles = [];
  model.root.traverse((object) => drawnRoles.push(object.userData.role ?? ''));
  // The one plain column carrying radius pin F's wall flange (so the flange
  // does not float) is the only support added below the plate's crop.
  assert.equal(drawnRoles.some((role) => /bed-rail|upright|standard|guide-rail|piston-head|foot/.test(role)
    && !role.startsWith('fixed-floor-column-carrying-radius-pin-F-flange')), false,
    'Brown draws no engine bed, standards, piston guides or piston head');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const model337 = createMovementModel(catalog.movements[336]);
  assert.equal(model337.root.userData.fidelity, 'authored');
  assert.notEqual(model337.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(model337.root.userData.blocks.vibratingRodMidpointAnchor.parent,
    model337.root.userData.blocks.vibratingRod);
  disposeModel(model337.root);
  disposeModel(model.root);
});

test('movement 338 closes exactly and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[337]);
  const { blocks, canonicalTimes, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);
  near(closure.phase, start.phase, 0, 'source phase closure');
  near(closure.inputAngle, start.inputAngle, 9e-16,
    'timing-crank phase closure');
  vector2Near(closure.inputCrankPin, start.inputCrankPin, 1e-15,
    'timing crank-pin closure');
  near(closure.beam.angle, start.beam.angle, 9e-17,
    'rocking-beam closure');
  vector2Near(closure.beamPointR, start.beamPointR, 1e-15,
    'R closure');
  vector2Near(closure.pointU, start.pointU, 1e-15, 'U closure');
  vector2Near(closure.pointL, start.pointL, 1e-15, 'L closure');
  near(closure.unwrappedInputAngle, Math.PI * 2, 0,
    'one unwrapped timing turn');
  model.update(canonicalTimes.cycleClosure);
  near(blocks.beam.rotation.z, start.beam.angle, 9e-17,
    'rendered beam closure');
  vector3Near(blocks.output.position,
    new THREE.Vector3(start.pointL.x, start.pointL.y, 0), 1e-15,
  'rendered piston closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
