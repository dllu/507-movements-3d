import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
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

test('movement 282 is one disk-pin slotted lever with rack and weight outputs', () => {
  const movement = catalog.movements[281];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 282);
  assert.equal(movement.number, '282');
  assert.equal(movement.title,
    'Eccentric-Pin Slotted Lever, Rack and Weight');
  assert.equal(movement.category, 'Toothed gearing');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'eccentric-disk-pin-slotted-lever-sector-rack-cord-weight');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one continuously revolving disk/);
  assert.match(mechanism, /single straight slot/);
  assert.match(mechanism, /lower toothed sector drives one horizontal rack/);
  assert.match(mechanism, /one inextensible cord over one fixed pulley/);
  assert.deepEqual(transmission.outputs, [
    'alternate horizontal rectilinear rack motion',
    'alternate perpendicular vertical weight motion',
  ]);

  assert.equal(blocks.disk.parent, model.root);
  assert.equal(blocks.diskRotor.parent, blocks.disk);
  assert.equal(blocks.diskBody.parent, blocks.diskRotor);
  assert.equal(blocks.drivePin.parent, blocks.diskRotor);
  assert.equal(blocks.lever.parent, model.root);
  assert.equal(blocks.leverBody.parent, blocks.lever);
  assert.equal(blocks.slotFloor.parent, null);
  assert.equal(blocks.slotFloor.visible, false);
  assert.equal(blocks.sector.parent, blocks.lever);
  assert.ok(blocks.sectorTeeth.every(tooth => !tooth.visible));
  assert.equal(blocks.rack.parent, model.root);
  assert.equal(blocks.rackBody.parent, blocks.rack);
  assert.ok(blocks.rackTeeth.every(({ parent }) => parent === blocks.rack));
  assert.equal(blocks.pulley.parent, model.root);
  assert.equal(blocks.pulleyRotor.parent, blocks.pulley);
  assert.equal(blocks.cord.parent, model.root);
  assert.equal(blocks.weight.parent, model.root);
  vectorNear(blocks.disk.userData.axis, Z_AXIS, 0, 'disk axis');
  vectorNear(blocks.lever.userData.axis, Z_AXIS, 0, 'lever axis');
  vectorNear(blocks.pulley.userData.axis, Z_AXIS, 0, 'pulley axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'disk-fixed-pin-sliding-in-lever-slot').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'lever-rigid-lower-toothed-sector-body').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'horizontal-reciprocating-rack').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'single-inextensible-cord-over-fixed-pulley').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'purely-vertical-reciprocating-weight').length, 1);
  assert.equal(roles.some((role) => /generic|procedural|gear-pair/.test(role)),
    false);
  disposeModel(model.root);
});

test('movement 282 records its unavailable animation and measured source pose', () => {
  const model = createMovementModel(catalog.movements[281]);
  const {
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.plate282;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason,
    /official Movement 282 page marks its animation unavailable/);
  assert.match(sourceAnimation.reason, /exact crank-pin\/straight-slot/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_282.html');
  assert.equal(sourceReference.officialDescription,
    catalog.movements[281].description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 6);
  assert.deepEqual(plate.rasterDiskCenter, { x: 256, y: 269 });
  assert.deepEqual(plate.rasterDrivePin, { x: 300, y: 215 });
  assert.deepEqual(plate.rasterLeverPivot, { x: 259, y: 422 });
  assert.deepEqual(plate.rasterGuidePin, { x: 319, y: 96 });
  assert.deepEqual(plate.rasterCordAttachment, { x: 325, y: 69 });
  assert.deepEqual(plate.rasterPulleyCenter, { x: 455, y: 52 });
  assert.deepEqual(plate.rasterWeightTop, { x: 472, y: 267 });
  assert.match(plate.inferredTopology, /one fixed-axis disk/);
  assert.match(plate.inferredTopology, /one rigid lower sector/);
  for (const [side, error] of Object.entries(
    plate.diskRadiusFitPixelErrors,
  )) {
    assert.ok(error <= plate.measurementUncertaintyPixels,
      `${side} disk radius fit error is ${error}px`);
  }
  for (const [feature, error] of Object.entries(
    plate.sourcePoseFitPixelErrors,
  )) {
    if (feature === 'weightTop') continue;
    assert.ok(error <= plate.measurementUncertaintyPixels,
      `${feature} source fit error is ${error}px`);
  }
  assert.ok(plate.sourcePoseFitPixelErrors.weightTop > 63);
  near(plate.sourcePoseFitPixelErrors.weightTop,
    plate.fullStrokeCableLengthExtensionPixels, 2e-13,
  'deliberate full-stroke cord extension');
  assert.match(plate.weightPlacementNote, /less cord/);
  assert.match(plate.weightPlacementNote, /below the pulley/);
  vectorNear(sourcePointToModel(plate.rasterDiskCenter),
    new THREE.Vector2(0, 0), 0, 'source disk center');
  vectorNear(stateAtTime(0).drivePin,
    new THREE.Vector3(0.528, 0.648, 0), 0,
  'source drive pin');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 75,
    edition: 21,
    illustrationPage: 74,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 282 keeps the revolving pin in one finite straight slot', () => {
  const model = createMovementModel(catalog.movements[281]);
  const {
    geometry,
    stateAtDiskAngle,
    transmission,
  } = model.root.userData;
  let minimumEndClearance = Infinity;

  for (let index = 0; index <= 8192; index += 1) {
    const diskAngle = FULL_TURN * index / 8192;
    const state = stateAtDiskAngle(diskAngle);
    near(state.drivePin.distanceTo(new THREE.Vector3(0, 0, 0)),
      geometry.crankRadius, 5e-16,
    `fixed crank radius at ${index}`);
    near(state.slotCenterlineError, 0, 1.5e-15,
      `pin-slot centerline at ${index}`);
    vectorNear(state.reconstructedDrivePin, state.drivePin, 1.5e-15,
      `reconstructed slot point at ${index}`);
    near(state.guideArcError, 0, 9e-16,
      `concentric upper guide at ${index}`);
    assert.ok(state.slotCoordinate > geometry.slotMinimumRadius,
      `pin above lower slot end at ${index}`);
    assert.ok(state.slotCoordinate < geometry.slotMaximumRadius,
      `pin below upper slot end at ${index}`);
    minimumEndClearance = Math.min(
      minimumEndClearance,
      state.slotEndClearance,
    );
  }
  assert.ok(minimumEndClearance > 0.071,
    `minimum slot-end clearance ${minimumEndClearance}`);
  near(minimumEndClearance, geometry.minimumSlotEndClearance, 1e-6,
    'declared dense slot clearance');
  near(transmission.slotRadialClearance,
    geometry.slotHalfWidth - geometry.drivePinRadius, 0,
  'pin-to-slot side clearance');
  near(transmission.slotRadialClearance, 0.003, 2e-17,
    'visible pin-to-slot side clearance');
  assert.match(transmission.slotConstraint,
    /disk-fixed pin = lever pivot/);
  disposeModel(model.root);
});

test('movement 282 makes exactly one smooth bar vibration per disk turn', () => {
  const model = createMovementModel(catalog.movements[281]);
  const {
    geometry,
    stateAtDiskAngle,
    timeline,
    transmission,
  } = model.root.userData;
  let derivativeSignChanges = 0;
  let previousSpeed = stateAtDiskAngle(0).leverAngularSpeed;
  let sampledMinimum = Infinity;
  let sampledMaximum = -Infinity;

  for (let index = 1; index <= 32768; index += 1) {
    const state = stateAtDiskAngle(FULL_TURN * index / 32768);
    if (state.leverAngularSpeed * previousSpeed < 0) {
      derivativeSignChanges += 1;
    }
    previousSpeed = state.leverAngularSpeed;
    sampledMinimum = Math.min(sampledMinimum, state.leverAngle);
    sampledMaximum = Math.max(sampledMaximum, state.leverAngle);
  }
  assert.equal(timeline.diskTurnsPerCycle, 1);
  assert.equal(timeline.leverTurningDiskAngles.length, 2);
  assert.equal(derivativeSignChanges, 2);
  for (const diskAngle of timeline.leverTurningDiskAngles) {
    near(stateAtDiskAngle(diskAngle).leverAngularSpeed, 0, 7e-16,
      `lever dead center at disk angle ${diskAngle}`);
  }
  near(sampledMinimum, geometry.minimumLeverAngle, 2e-8,
    'sampled clockwise extreme');
  near(sampledMaximum, geometry.maximumLeverAngle, 2e-8,
    'sampled counterclockwise extreme');
  near(transmission.leverAngularStroke,
    geometry.maximumLeverAngle - geometry.minimumLeverAngle, 0,
  'declared angular stroke');
  assert.ok(transmission.leverAngularStroke > 0.945);
  near(stateAtDiskAngle(0).leverAngle,
    stateAtDiskAngle(FULL_TURN).leverAngle, 3e-16,
  'periodic lever constraint');
  disposeModel(model.root);
});

test('movement 282 sector and rack retain exact pitch-line rolling', () => {
  const model = createMovementModel(catalog.movements[281]);
  const {
    geometry,
    stateAtDiskAngle,
    transmission,
  } = model.root.userData;
  let minimumRackX = Infinity;
  let maximumRackX = -Infinity;

  near(geometry.rackPitch,
    geometry.sectorPitchRadius * geometry.sectorAngularPitch, 0,
  'common circular pitch');
  assert.equal(geometry.sectorEquivalentToothCount, 16);
  assert.equal(geometry.sectorToothCount, 7);
  assert.equal(geometry.rackToothCount, 12);
  for (let index = 0; index <= 8192; index += 1) {
    const state = stateAtDiskAngle(FULL_TURN * index / 8192);
    near(state.rackVelocity.x, state.rackPitchTangentialSpeed, 0,
      `pitch velocity at ${index}`);
    near(state.rackNoSlipError, 0, 0,
      `sector-rack no-slip error at ${index}`);
    near(state.rackVelocity.y, 0, 0,
      `rack perpendicular velocity at ${index}`);
    near(state.rackX / geometry.rackPitch,
      state.leverAngleFromSource / geometry.sectorAngularPitch, 4e-16,
    `rack tooth phase at ${index}`);
    minimumRackX = Math.min(minimumRackX, state.rackX);
    maximumRackX = Math.max(maximumRackX, state.rackX);
  }
  near(maximumRackX - minimumRackX, transmission.rackStroke, 3e-8,
    'rack stroke from sector angular stroke');
  assert.ok(transmission.rackStroke > 0.487);
  assert.match(transmission.rackNoSlipLaw,
    /rack-speed = sector-pitch-radius/);
  disposeModel(model.root);
});

test('movement 282 cord stays tangent and drives one clear vertical weight', () => {
  const model = createMovementModel(catalog.movements[281]);
  const {
    geometry,
    stateAtDiskAngle,
    transmission,
  } = model.root.userData;
  let maximumWeightY = -Infinity;
  let minimumWeightY = Infinity;
  let minimumIncomingLength = Infinity;
  let minimumPulleyClearance = Infinity;
  let minimumRackClearance = Infinity;
  let minimumVerticalLength = Infinity;

  for (let index = 0; index <= 8192; index += 1) {
    const state = stateAtDiskAngle(FULL_TURN * index / 8192);
    near(state.cableLengthError, 0, 0,
      `inextensible cable at ${index}`);
    near(state.cableTangencyError, 0, 2e-15,
      `incoming pulley tangency at ${index}`);
    near(state.pulleyNoSlipError, 0, 5e-16,
      `pulley no-slip error at ${index}`);
    near(state.pulleyAngularSpeed * geometry.pulleyRunningRadius,
      state.weightVerticalSpeed, 5e-16,
    `pulley surface speed at ${index}`);
    near(state.weightTop.x, state.exitTangentPoint.x, 0,
      `vertical cord x at ${index}`);
    near(state.weightVelocity.x, 0, 0,
      `weight horizontal velocity at ${index}`);
    near(state.weightVelocity.z, 0, 0,
      `weight depth velocity at ${index}`);
    const verticalLength = state.exitTangentPoint.y - state.weightTop.y;
    const pulleyClearance = verticalLength - geometry.pulleyOuterRadius;
    const rackClearance = state.weightTop.y - geometry.weightHeight
      - (geometry.rackPitchY + geometry.toothHeight / 2);
    minimumVerticalLength = Math.min(minimumVerticalLength, verticalLength);
    minimumPulleyClearance = Math.min(
      minimumPulleyClearance,
      pulleyClearance,
    );
    minimumRackClearance = Math.min(minimumRackClearance, rackClearance);
    minimumIncomingLength = Math.min(
      minimumIncomingLength,
      state.cableIncomingLength,
    );
    minimumWeightY = Math.min(minimumWeightY, state.weightTop.y);
    maximumWeightY = Math.max(maximumWeightY, state.weightTop.y);
  }
  assert.ok(minimumIncomingLength > 0.70);
  assert.ok(minimumVerticalLength >= transmission.minimumVerticalCableLength);
  assert.ok(minimumPulleyClearance > 0.10,
    `weight-to-pulley clearance ${minimumPulleyClearance}`);
  assert.ok(minimumRackClearance > 0.006,
    `weight-to-rack clearance ${minimumRackClearance}`);
  near(maximumWeightY - minimumWeightY, transmission.weightStroke, 2e-8,
    'vertical weight stroke');
  assert.ok(transmission.weightStroke > 3.52);
  assert.match(transmission.cableConstraint, /is constant/);
  assert.match(transmission.pulleyNoSlipLaw,
    /vertical-cord-speed \/ running-radius/);
  disposeModel(model.root);
});

test('movement 282 analytic pin, lever, rack, cord, and weight rates agree', () => {
  const model = createMovementModel(catalog.movements[281]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-4;

  for (const time of [0.09, 0.31, 0.68, 1.03, 1.41, 1.82, 2.17,
    2.59, 3.04, 3.47, 3.88]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    const scalarVelocity = (key) => (after[key] - before[key])
      / (2 * step);
    const scalarAcceleration = (key) => (
      after[key] - 2 * state[key] + before[key]
    ) / step ** 2;
    const vectorVelocity = (key) => after[key].clone().sub(before[key])
      .multiplyScalar(1 / (2 * step));
    const vectorAcceleration = (key) => after[key].clone().add(before[key])
      .addScaledVector(state[key], -2)
      .multiplyScalar(1 / step ** 2);

    near(scalarVelocity('leverAngle'), state.leverAngularSpeed, 2e-8,
      `lever angular speed at ${time}`);
    near(scalarAcceleration('leverAngle'),
      state.leverAngularAcceleration, 2e-7,
    `lever angular acceleration at ${time}`);
    near(scalarVelocity('slotCoordinate'), state.slotSlidingSpeed, 2e-8,
      `pin sliding speed at ${time}`);
    near(scalarAcceleration('slotCoordinate'),
      state.slotSlidingAcceleration, 3e-7,
    `pin sliding acceleration at ${time}`);
    vectorNear(vectorVelocity('drivePin'), state.drivePinVelocity, 2e-8,
      `drive-pin velocity at ${time}`);
    vectorNear(vectorAcceleration('drivePin'),
      state.drivePinAcceleration, 3e-7,
    `drive-pin acceleration at ${time}`);
    near(scalarVelocity('rackX'), state.rackVelocity.x, 2e-8,
      `rack velocity at ${time}`);
    near(scalarAcceleration('rackX'), state.rackAcceleration.x, 3e-7,
      `rack acceleration at ${time}`);
    vectorNear(vectorVelocity('cableAttachment'),
      state.cableAttachmentVelocity, 1.2e-7,
    `cord-eye velocity at ${time}`);
    vectorNear(vectorAcceleration('cableAttachment'),
      state.cableAttachmentAcceleration, 1e-6,
    `cord-eye acceleration at ${time}`);
    near((after.weightTop.y - before.weightTop.y) / (2 * step),
      state.weightVerticalSpeed, 1.2e-7,
    `weight velocity at ${time}`);
    near((after.weightTop.y - 2 * state.weightTop.y + before.weightTop.y)
      / step ** 2, state.weightVerticalAcceleration, 1e-6,
    `weight acceleration at ${time}`);
    near(scalarVelocity('pulleyAngle'), state.pulleyAngularSpeed, 6e-7,
      `pulley speed at ${time}`);
    near(scalarAcceleration('pulleyAngle'),
      state.pulleyAngularAcceleration, 6e-6,
    `pulley acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 282 renderer follows all constraints and closes before 283', () => {
  const model = createMovementModel(catalog.movements[281]);
  const {
    animationTiming,
    blocks,
    stateAtTime,
    timeline,
  } = model.root.userData;
  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(blocks.guidePin.parent, blocks.lever);
  for (const index of [blocks.diskIndex, blocks.pulleyIndex,
    blocks.rackIndex, blocks.weightIndex]) {
    assert.equal(index.parent, null, 'undrawn white index removed');
  }

  for (const time of [0, 0.37, 0.82, 1.26, 1.73, 2.19, 2.67, 3.14,
    3.62, 4]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.diskRotor.rotation.z, expected.diskAngle, 0,
      `rendered disk angle at ${time}`);
    near(blocks.lever.rotation.z, expected.leverAngle, 0,
      `rendered lever angle at ${time}`);
    near(blocks.rack.position.x, expected.rackX, 0,
      `rendered rack x at ${time}`);
    near(blocks.pulleyRotor.rotation.z, expected.pulleyAngle, 0,
      `rendered pulley angle at ${time}`);
    near(blocks.weight.position.x, expected.weightCenter.x, 0,
      `rendered weight x at ${time}`);
    near(blocks.weight.position.y, expected.weightCenter.y, 0,
      `rendered weight y at ${time}`);
    near(blocks.incomingCord.scale.y, expected.cableIncomingLength, 2e-15,
      `rendered incoming cord length at ${time}`);
    model.root.updateMatrixWorld(true);
    const renderedDrivePin = model.root.worldToLocal(
      blocks.drivePin.getWorldPosition(new THREE.Vector3()),
    );
    near(renderedDrivePin.x, expected.drivePin.x, 7e-16,
      `rendered drive pin x at ${time}`);
    near(renderedDrivePin.y, expected.drivePin.y, 7e-16,
      `rendered drive pin y at ${time}`);
    near(model.root.userData.contacts.drivePinSlot.centerlineError,
      expected.slotCenterlineError, 0,
    `rendered slot contact at ${time}`);
    near(model.root.userData.contacts.rackSector.noSlipError,
      expected.rackNoSlipError, 0,
    `rendered rack contact at ${time}`);
    near(model.root.userData.contacts.ropePulley.cableLengthError,
      expected.cableLengthError, 0,
    `rendered cable constraint at ${time}`);
  }

  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.cyclePeriod);
  near(closure.diskAngle - start.diskAngle, FULL_TURN, 0,
    'one disk turn');
  near(closure.leverAngle, start.leverAngle, 3e-16,
    'lever closure');
  near(closure.slotCoordinate, start.slotCoordinate, 5e-16,
    'slot-coordinate closure');
  near(closure.rackX, start.rackX, 2e-16, 'rack closure');
  near(closure.pulleyAngle, start.pulleyAngle, 3e-15,
    'pulley closure');
  vectorNear(closure.drivePin, start.drivePin, 3e-16,
    'drive-pin closure');
  vectorNear(closure.weightTop, start.weightTop, 5e-16,
    'weight closure');

  model.update(0);
  const startDisk = blocks.diskRotor.quaternion.clone();
  const startLever = blocks.lever.quaternion.clone();
  const startPulley = blocks.pulleyRotor.quaternion.clone();
  model.update(timeline.cyclePeriod);
  near(blocks.diskRotor.quaternion.angleTo(startDisk), 0, 0,
    'rendered disk closure');
  near(blocks.lever.quaternion.angleTo(startLever), 0, 0,
    'rendered lever closure');
  near(blocks.pulleyRotor.quaternion.angleTo(startPulley), 0, 0,
    'rendered pulley closure');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
