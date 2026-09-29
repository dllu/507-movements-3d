import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
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

test('movement 281 is one revolving face groove driving one fixed-pivot lever', () => {
  const movement = catalog.movements[280];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
  } = model.root.userData;

  assert.equal(movement.id, 281);
  assert.equal(movement.number, '281');
  assert.equal(movement.title, 'Closed-Groove Disk Lever Oscillator');
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'revolving-face-groove-fixed-pin-lever-oscillator');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one rigid disk revolves/);
  assert.match(mechanism, /one pin fixed to the long right-hand lever/);
  assert.match(mechanism, /one closed groove/);
  assert.match(mechanism, /one smooth angular vibration/);

  assert.equal(blocks.disk.parent, model.root);
  assert.equal(blocks.diskRotor.parent, blocks.disk);
  assert.equal(blocks.diskBody.parent, blocks.diskRotor);
  assert.equal(blocks.grooveOuter.parent, blocks.diskRotor);
  assert.equal(blocks.grooveFloor.parent, blocks.diskRotor);
  assert.equal(blocks.lever.parent, model.root);
  assert.ok(blocks.leverBody.parent === blocks.lever, 'lever body on the lever');
  assert.equal(blocks.followerBracket.parent, blocks.lever);
  assert.equal(blocks.followerPin.parent, blocks.lever);
  assert.equal(blocks.leverPivotPin.parent, model.root);
  vectorNear(blocks.disk.userData.axis, Z_AXIS, 0, 'disk axis');
  vectorNear(blocks.lever.userData.axis, Z_AXIS, 0, 'lever axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role === 'closed-face-groove-outer-walls')
    .length, 1);
  assert.equal(roles.filter((role) =>
    role === 'fixed-pin-sliding-in-disk-face-groove').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'fixed-pivot-groove-driven-vibrating-lever').length, 1);
  assert.equal(roles.filter((role) => /belt|pulley|gear|ratchet/.test(role))
    .length, 0);
  disposeModel(model.root);
});

test('movement 281 records its unavailable animation and measured groove fit', () => {
  const model = createMovementModel(catalog.movements[280]);
  const {
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.plate281;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason,
    /official Movement 281 page marks its animation unavailable/);
  assert.match(sourceAnimation.reason, /smooth periodic closed constraint/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_281.html');
  assert.equal(sourceReference.officialDescription,
    catalog.movements[280].description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 6);
  assert.deepEqual(plate.rasterDiskCenter, { x: 256, y: 238 });
  assert.deepEqual(plate.rasterDiskTop, { x: 256, y: 109 });
  assert.deepEqual(plate.rasterDiskBottom, { x: 256, y: 367 });
  assert.deepEqual(plate.rasterLeverPivot, { x: 348, y: 65 });
  assert.deepEqual(plate.rasterFollowerPin, { x: 361, y: 238 });
  assert.deepEqual(plate.rasterLeverGrip, { x: 438, y: 438 });
  assert.equal(plate.rasterGrooveCenterline.length, 11);
  assert.match(plate.inferredTopology, /one closed face groove/);
  assert.match(plate.fitMethod, /three-harmonic periodic lever law/);
  assert.match(plate.fitMethod, /false lever reversals/);
  for (const [point, error] of Object.entries(plate.grooveFitPixelErrors)) {
    assert.ok(error <= plate.measurementUncertaintyPixels,
      `${point} groove fit is ${error}px from the plate`);
  }
  assert.ok(Math.max(...Object.values(plate.grooveFitPixelErrors)) < 3.82);
  for (const [feature, error] of Object.entries(
    plate.sourceIdealizationPixelErrors,
  )) {
    assert.ok(error <= plate.measurementUncertaintyPixels,
      `${feature} is ${error}px from the plate`);
  }
  vectorNear(sourcePointToModel(plate.rasterDiskCenter),
    new THREE.Vector2(0, 0), 0, 'source disk center');
  vectorNear(stateAtTime(0).followerPin,
    new THREE.Vector3(1.26, 0, 0), 0, 'source follower pin');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 75,
    edition: 21,
    illustrationPage: 74,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 281 pin lies on the exact rotating groove centerline at every angle', () => {
  const model = createMovementModel(catalog.movements[280]);
  const {
    geometry,
    grooveCurve,
    groovePointAtDiskAngle,
    stateAtDiskAngle,
  } = model.root.userData;
  let minimumOuterClearance = Infinity;
  let minimumHubClearance = Infinity;

  for (let index = 0; index <= 8192; index += 1) {
    const diskAngle = Math.PI * 2 * index / 8192;
    const state = stateAtDiskAngle(diskAngle);
    near(state.followerArmLengthError, 0, 5e-16,
      `fixed follower radius at ${index}`);
    near(state.grooveCenterlineError, 0, 5e-16,
      `groove centerline contact at ${index}`);
    const transformedGroovePoint = state.groovePointLocal.clone()
      .applyAxisAngle(Z_AXIS, diskAngle);
    vectorNear(transformedGroovePoint, state.followerPin, 1e-15,
      `disk-frame groove transform at ${index}`);
    const declaredGroovePoint = groovePointAtDiskAngle(diskAngle);
    near(state.groovePointLocal.x, declaredGroovePoint.x, 0,
      `declared groove x at ${index}`);
    near(state.groovePointLocal.y, declaredGroovePoint.y, 0,
      `declared groove y at ${index}`);
    minimumOuterClearance = Math.min(minimumOuterClearance,
      state.diskOuterGrooveClearance);
    minimumHubClearance = Math.min(minimumHubClearance,
      state.grooveHubClearance);
    near(state.pinRadialClearance,
      geometry.grooveHalfWidth - geometry.followerPinRadius, 0,
    `pin wall clearance at ${index}`);
  }
  vectorNear(grooveCurve.getPoint(0), grooveCurve.getPoint(1), 5e-16,
    'rendered groove is closed');
  assert.ok(minimumOuterClearance > 0.10,
    `outer groove clearance ${minimumOuterClearance}`);
  assert.ok(minimumHubClearance > 0.25,
    `hub groove clearance ${minimumHubClearance}`);
  near(geometry.grooveHalfWidth - geometry.followerPinRadius, 0.035, 0,
    'follower-to-groove radial clearance');
  disposeModel(model.root);
});

test('movement 281 produces exactly one smooth lever vibration per disk turn', () => {
  const model = createMovementModel(catalog.movements[280]);
  const {
    geometry,
    leverLawAtDiskAngle,
    stateAtDiskAngle,
    timeline,
    transmission,
  } = model.root.userData;
  assert.equal(timeline.diskTurnsPerCycle, 1);
  assert.equal(timeline.leverTurningAngles.length, 2);
  let derivativeSignChanges = 0;
  let previousDerivative = leverLawAtDiskAngle(0).firstDerivative;
  let sampledMinimum = Infinity;
  let sampledMaximum = -Infinity;
  for (let index = 1; index <= 32768; index += 1) {
    const angle = Math.PI * 2 * index / 32768;
    const law = leverLawAtDiskAngle(angle);
    if (law.firstDerivative * previousDerivative < 0) {
      derivativeSignChanges += 1;
    }
    previousDerivative = law.firstDerivative;
    sampledMinimum = Math.min(sampledMinimum, law.leverAngle);
    sampledMaximum = Math.max(sampledMaximum, law.leverAngle);
  }
  assert.equal(derivativeSignChanges, 2);
  for (const turningAngle of timeline.leverTurningAngles) {
    near(leverLawAtDiskAngle(turningAngle).firstDerivative, 0, 2e-16,
      `lever dead center at disk angle ${turningAngle}`);
  }
  near(sampledMinimum, geometry.minimumLeverAngle, 2e-8,
    'single sampled clockwise extreme');
  near(sampledMaximum, geometry.maximumLeverAngle, 2e-8,
    'single sampled counterclockwise extreme');
  near(transmission.leverAngularStroke,
    geometry.maximumLeverAngle - geometry.minimumLeverAngle, 0,
  'declared lever stroke');
  assert.ok(transmission.leverAngularStroke > 0.375);
  assert.match(transmission.output, /one smooth fixed-pivot angular lever vibration/);
  near(stateAtDiskAngle(0).leverAngle,
    stateAtDiskAngle(Math.PI * 2).leverAngle, 0,
  'periodic lever law');
  disposeModel(model.root);
});

test('movement 281 keeps positive sliding travel inside the closed groove', () => {
  const model = createMovementModel(catalog.movements[280]);
  const {
    geometry,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;
  let minimumSlidingSpeed = Infinity;
  let maximumSlidingSpeed = 0;
  for (let index = 0; index <= 8192; index += 1) {
    const state = stateAtTime(timeline.cyclePeriod * index / 8192);
    minimumSlidingSpeed = Math.min(minimumSlidingSpeed,
      state.grooveSlidingSpeed);
    maximumSlidingSpeed = Math.max(maximumSlidingSpeed,
      state.grooveSlidingSpeed);
    near(state.grooveSlidingVelocityLocal.length(),
      state.grooveSlidingSpeed, 0,
    `reported sliding speed at ${index}`);
    assert.ok(state.diskOuterGrooveClearance > 0,
      `groove stays inside disk at ${index}`);
    assert.ok(state.grooveHubClearance > 0,
      `groove stays outside hub at ${index}`);
  }
  assert.ok(minimumSlidingSpeed > 0.84,
    `minimum groove sliding speed ${minimumSlidingSpeed}`);
  assert.ok(maximumSlidingSpeed < 2.12,
    `maximum groove sliding speed ${maximumSlidingSpeed}`);
  near(transmission.pinSlotRadialClearance,
    geometry.grooveHalfWidth - geometry.followerPinRadius, 0,
  'declared pin-slot clearance');
  assert.match(transmission.closedGrooveConstraint,
    /zero centerline error/);
  disposeModel(model.root);
});

test('movement 281 analytic lever, pin, and groove rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[280]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-4;

  for (const time of [0.1, 0.35, 0.7, 1.1, 1.45, 1.9, 2.2, 2.6,
    3.1, 3.6, 3.9]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    const vectorVelocity = (key) => after[key].clone().sub(before[key])
      .multiplyScalar(1 / (2 * step));
    const vectorAcceleration = (key) => after[key].clone().add(before[key])
      .addScaledVector(state[key], -2)
      .multiplyScalar(1 / step ** 2);
    near((after.leverAngle - before.leverAngle) / (2 * step),
      state.leverAngularSpeed, 1e-8,
    `lever angular speed at ${time}`);
    near((after.leverAngle - 2 * state.leverAngle + before.leverAngle)
      / step ** 2, state.leverAngularAcceleration, 8e-8,
    `lever angular acceleration at ${time}`);
    vectorNear(vectorVelocity('followerPin'), state.followerPinVelocity,
      2e-8, `follower pin velocity at ${time}`);
    vectorNear(vectorAcceleration('followerPin'),
      state.followerPinAcceleration, 2e-7,
    `follower pin acceleration at ${time}`);
    vectorNear(vectorVelocity('groovePointLocal'),
      state.grooveSlidingVelocityLocal, 4e-8,
    `disk-frame groove velocity at ${time}`);
    vectorNear(vectorAcceleration('groovePointLocal'),
      state.grooveSlidingAccelerationLocal, 2e-7,
    `disk-frame groove acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 281 renderer binds disk, groove, follower pin, lever, and indexes', () => {
  const model = createMovementModel(catalog.movements[280]);
  const {
    animationTiming,
    blocks,
    cameraFitBounds,
    stateAtTime,
  } = model.root.userData;
  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.ok(blocks.diskIndex.parent === null, 'undrawn disk index removed');
  assert.ok(blocks.leverIndex.parent === null, 'undrawn lever index removed');
  assert.equal(blocks.followerHead.parent, blocks.lever);
  const renderedBounds = new THREE.Box3();

  for (const time of [0, 0.43, 0.91, 1.37, 1.92, 2.46, 3.03, 3.61, 4]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.diskRotor.rotation.z, expected.diskAngle, 0,
      `rendered disk angle at ${time}`);
    near(blocks.lever.rotation.z, expected.leverAngle, 0,
      `rendered lever angle at ${time}`);
    near(blocks.disk.userData.angularSpeed, expected.angularSpeed, 0,
      `rendered disk speed at ${time}`);
    near(blocks.lever.userData.angularSpeed,
      expected.leverAngularSpeed, 0,
    `rendered lever speed at ${time}`);
    model.root.updateMatrixWorld(true);
    const renderedPin = blocks.followerPin.getWorldPosition(
      new THREE.Vector3(),
    );
    near(renderedPin.x, expected.followerPin.x, 6e-16,
      `rendered follower x at ${time}`);
    near(renderedPin.y, expected.followerPin.y, 6e-16,
      `rendered follower y at ${time}`);
    near(model.root.userData.contacts.followerGroove.centerlineError,
      expected.grooveCenterlineError, 0,
    `rendered groove contact at ${time}`);
    near(model.root.userData.contacts.followerGroove.radialClearance,
      expected.pinRadialClearance, 0,
    `rendered groove clearance at ${time}`);
    renderedBounds.union(new THREE.Box3().setFromObject(model.root, true));
  }
  assert.equal(cameraFitBounds.containsBox(renderedBounds), true);
  disposeModel(model.root);
});

test('movement 281 closes after one disk turn while movement 339 remains authored', () => {
  const model = createMovementModel(catalog.movements[280]);
  const {
    blocks,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.cyclePeriod);

  near(closure.diskAngle - start.diskAngle, Math.PI * 2, 0,
    'one disk turn');
  near(closure.leverAngle, start.leverAngle, 0, 'lever closure');
  near(closure.leverAngularSpeed, start.leverAngularSpeed, 5e-17,
    'lever speed closure');
  near(closure.leverAngularAcceleration, start.leverAngularAcceleration,
    2e-16, 'lever acceleration closure');
  vectorNear(closure.followerPin, start.followerPin, 0,
    'follower pin closure');
  vectorNear(closure.groovePointLocal, start.groovePointLocal, 4e-16,
    'disk-frame groove closure');
  assert.equal(closure.cycleIndex, 1);
  assert.equal(closure.cycleTime, 0);

  model.update(0);
  const startDisk = blocks.diskRotor.quaternion.clone();
  const startLever = blocks.lever.quaternion.clone();
  model.update(timeline.cyclePeriod);
  near(blocks.diskRotor.quaternion.angleTo(startDisk), 0, 0,
    'rendered disk closure');
  near(blocks.lever.quaternion.angleTo(startLever), 0, 0,
    'rendered lever closure');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});

test('movement 281 carries its fulcrum on a brace behind the disk, not an undrawn right standard', () => {
  const model = createMovementModel(catalog.movements[280]);
  const { blocks } = model.root.userData;
  model.root.updateMatrixWorld(true);
  assert.equal(blocks.leverSupport, undefined);
  const pin = new THREE.Box3().setFromObject(blocks.leverPivotPin);
  const brace = new THREE.Box3().setFromObject(blocks.upperCrossBrace);
  const bearing = new THREE.Box3().setFromObject(blocks.rearBearing);
  const disk = new THREE.Box3().setFromObject(blocks.diskBody);
  assert.ok(pin.min.z < brace.max.z, 'fulcrum pin reaches the rear brace');
  assert.ok(brace.max.z < disk.min.z && bearing.max.z < disk.min.z,
    'brace and bearing stay behind the disk');
  const hub = new THREE.Box3().setFromObject(blocks.diskHub);
  assert.ok(hub.min.z < bearing.max.z, 'disk shaft runs in the rear bearing');
  // p104: the brace ends in a round eye concentric with the fulcrum pin.
  const pinCenter = new THREE.Vector3();
  pin.getCenter(pinCenter);
  const eyeCenter = new THREE.Vector3().setFromMatrixPosition(blocks.upperCrossBrace.matrixWorld);
  assert.ok(Math.hypot(eyeCenter.x - pinCenter.x, eyeCenter.y - pinCenter.y) < 1e-9, 'brace eye concentric with the fulcrum');
  const pinRadius = (pin.max.x - pin.min.x) / 2;
  assert.ok(blocks.upperCrossBrace.userData.eyeRadius > pinRadius + 0.08, 'eye surrounds the pin');
  assert.equal(blocks.upperCrossBrace.geometry.type, 'ExtrudeGeometry');
  disposeModel(model.root);
});
