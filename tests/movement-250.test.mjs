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

const FULL_TURN = Math.PI * 2;

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
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

test('movement 250 supports one shaft journal on exactly two rolling wheels', () => {
  const movement = catalog.movements[249];
  const model = createMovementModel(movement);
  const {
    archetype,
    fidelity,
    mechanism,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 250);
  assert.equal(movement.number, '250');
  assert.equal(movement.title, 'Two-Wheel Anti-Friction Shaft Bearing');
  assert.equal(movement.category, 'Friction drives');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'shaft-journal-supported-by-two-circumferential-wheels-with-exact-no-slip-ratio',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'small-main-shaft-journal-rolls-without-slip-on-two-large-circumferential-support-wheels-whose-fixed-pivots-replace-one-ordinary-bearing',
  );
  assert.equal(transmission.contactCount, 2);
  assert.equal(transmission.contactType, 'external-pure-rolling');
  assert.equal(transmission.supportWheelCount, 2);
  assert.equal(transmission.supportToShaftSpeedRatio, -0.12);
  assert.equal(transmission.axiallySeparatedSupportWheels, true);
  assert.equal(transmission.fullClosureDriverTurns, 25);
  assert.equal(transmission.fullClosureSupportTurns, -3);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  disposeModel(model.root);
});

test('movement 250 preserves the official dimensions, pivots, and rates', () => {
  const movement = catalog.movements[249];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.plate250;

  assert.equal(sourceReference.officialDescription, movement.description);
  assert.deepEqual(sourceAnimation.officialModelRadii, {
    journal: 0.6,
    mainFlywheel: 4,
    supportWheel: 5,
  });
  assert.deepEqual(sourceAnimation.officialAngularRateMultipliers, {
    mainShaft: 1,
    supportWheels: -0.12,
  });
  vectorNear(
    sourceAnimation.officialSupportPivots[0],
    new THREE.Vector2(-4, -3.919184),
    0,
    'official left support pivot',
  );
  vectorNear(
    sourceAnimation.officialSupportPivots[1],
    new THREE.Vector2(4, -3.919184),
    0,
    'official right support pivot',
  );
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 5);
  assert.equal(plate.officialAnimationAvailable, true);
  assert.equal(plate.view, 'front-elevation-through-three-parallel-wheel-axes');
  assert.deepEqual(plate.rasterFrameBounds, {
    bottom: 450,
    left: 135,
    right: 394,
    top: 220,
  });
  assert.deepEqual(plate.rasterJournal, {
    centerX: 266,
    centerY: 141,
    radius: 17,
  });
  assert.deepEqual(plate.rasterMainFlywheel, {
    centerX: 266,
    centerY: 141,
    outerRadius: 90,
  });
  assert.deepEqual(plate.rasterSupportWheels, [
    { centerX: 175, centerY: 241, outerRadius: 119 },
    { centerX: 354, centerY: 241, outerRadius: 119 },
  ]);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 63,
    edition: 21,
    illustrationPage: 62,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 250 has two exact tangencies without wheel interpenetration', () => {
  const model = createMovementModel(catalog.movements[249]);
  const { geometry, stateAtTime } = model.root.userData;
  const state = stateAtTime(0);

  near(geometry.centerDistance, 5.6, 0, 'nominal center distance');
  near(
    Math.hypot(geometry.supportCenterX, geometry.supportCenterY),
    geometry.centerDistance,
    1e-15,
    'derived support center distance',
  );
  for (const contact of [
    state.leftRollingContact,
    state.rightRollingContact,
  ]) {
    near(contact.centerDistance, 5.6, 1e-15, 'contact center distance');
    near(contact.contactGap, 0, 1e-15, 'journal-to-wheel contact gap');
    near(contact.driverRadialVector.length(), 0.6, 1e-15,
      'journal contact radius');
    near(contact.supportRadialVector.length(), 5, 1e-15,
      'support-wheel contact radius');
    near(contact.contact3D.z, contact.axialPlane, 0,
      'contact lies in its support plane');
  }
  assert.deepEqual(geometry.supportWheelAxialPlanes, [0.22, 0.78]);
  near(geometry.supportWheelAxialClearance, 0.16, 1e-15,
    'support-wheel axial clearance');
  assert.ok(geometry.supportWheelAxialClearance > 0.159);
  assert.ok(
    geometry.supportWheelAxialPlanes[1]
      - geometry.supportWheelAxialPlanes[0]
      > 2 * geometry.supportRimHalfThickness,
  );
  assert.ok(2 * geometry.supportCenterX < 2 * geometry.supportOuterRadius,
    'the projected wheels overlap but their axial planes do not');
  disposeModel(model.root);
});

test('movement 250 obeys both rolling constraints over its full marked closure', () => {
  const model = createMovementModel(catalog.movements[249]);
  const { geometry, stateAtTime } = model.root.userData;
  let maximumPhaseError = 0;
  let maximumVelocityError = 0;
  let maximumVectorVelocityError = 0;

  for (let sample = 0; sample <= 65536; sample += 1) {
    const time = geometry.fullMarkedAssemblyClosure * sample / 65536;
    const state = stateAtTime(time);
    assert.equal(state.rollingContactsNoSlip, true);
    near(state.leftSupportAngleUnwrapped, state.rightSupportAngleUnwrapped, 0,
      `matching support-wheel angles at ${sample}`);
    for (const contact of [
      state.leftRollingContact,
      state.rightRollingContact,
    ]) {
      maximumPhaseError = Math.max(
        maximumPhaseError,
        Math.abs(contact.rollingPhaseError),
      );
      maximumVelocityError = Math.max(
        maximumVelocityError,
        Math.abs(contact.rollingVelocityError),
      );
      maximumVectorVelocityError = Math.max(
        maximumVectorVelocityError,
        contact.tangentialVelocityError.length(),
      );
    }
  }
  assert.ok(maximumPhaseError < 1.5e-14);
  assert.equal(maximumVelocityError, 0);
  assert.ok(maximumVectorVelocityError < 2.4e-16);
  near(
    geometry.supportAngularSpeed,
    -geometry.driverAngularSpeed
      * geometry.journalRadius / geometry.supportOuterRadius,
    0,
    'external rolling speed ratio',
  );
  disposeModel(model.root);
});

test('movement 250 reduces journal sliding to small support-axle sliding', () => {
  const model = createMovementModel(catalog.movements[249]);
  const { geometry, stateAtTime, transmission } = model.root.userData;
  const state = stateAtTime(1.234);

  near(state.ordinaryJournalSlidingSpeed, 0.6, 0,
    'ordinary-bearing sliding speed');
  near(state.supportAxleSlidingSpeed, 0.0216, 1e-16,
    'rolling-support axle sliding speed');
  near(
    state.supportAxleSlidingSpeed / state.ordinaryJournalSlidingSpeed,
    0.036,
    1e-16,
    'remaining sliding-speed fraction',
  );
  near(transmission.ordinaryJournalSlidingSpeed, 0.6, 0,
    'transmission ordinary-bearing comparison');
  near(transmission.supportAxleSlidingSpeed, 0.0216, 1e-16,
    'transmission support-axle comparison');
  assert.ok(state.leftRollingContact.tangentialVelocityError.length() < 2.4e-16);
  assert.ok(geometry.supportAxleRadius < geometry.journalRadius);
  disposeModel(model.root);
});

test('movement 250 renders distinct rotating members and a fixed pedestal', () => {
  const model = createMovementModel(catalog.movements[249]);
  const { blocks, stateAtTime } = model.root.userData;
  const fixedTransforms = [blocks.frame, blocks.base, ...blocks.pivotCaps]
    .map((object) => ({
      object,
      position: object.position.clone(),
      quaternion: object.quaternion.clone(),
    }));

  assert.equal(blocks.mainFlywheelSpokes.length, 4);
  assert.equal(blocks.leftSupportSpokes.length, 8);
  assert.equal(blocks.rightSupportSpokes.length, 8);
  assert.equal(blocks.leftSupportWheel.userData.axialPlane, 0.22);
  assert.equal(blocks.rightSupportWheel.userData.axialPlane, 0.78);
  assert.equal(blocks.leftSupportIndex.userData.initialAngle, Math.PI);
  assert.equal(blocks.rightSupportIndex.userData.initialAngle, 0);
  assert.match(blocks.mainFlywheelIndex.userData.role, /white/);
  assert.match(blocks.shaftJournalIndex.userData.role, /white/);
  assert.match(blocks.leftSupportIndex.userData.role, /white/);
  assert.match(blocks.rightSupportIndex.userData.role, /white/);
  assert.equal(blocks.contactMarkers.length, 2);
  assert.equal(blocks.frame.userData.fixed, true);
  assert.equal(blocks.base.userData.fixed, true);

  for (const time of [0, 0.4, 2.7, 11.1, 47.3]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.mainRotor.rotation.z, state.driverAngle, 0,
      `main render angle at ${time}`);
    near(blocks.leftSupportWheel.rotation.z, state.leftSupportAngle, 0,
      `left render angle at ${time}`);
    near(blocks.rightSupportWheel.rotation.z, state.rightSupportAngle, 0,
      `right render angle at ${time}`);
    for (const fixed of fixedTransforms) {
      vectorNear(fixed.object.position, fixed.position, 0,
        `fixed position at ${time}`);
      near(fixed.object.quaternion.angleTo(fixed.quaternion), 0, 0,
        `fixed orientation at ${time}`);
    }
  }
  vectorNear(blocks.mainRotor.position, new THREE.Vector3(), 0,
    'main shaft center remains fixed');
  disposeModel(model.root);
});

test('movement 250 keeps the slow support phase continuous across shaft turns', () => {
  const model = createMovementModel(catalog.movements[249]);
  const { geometry, stateAtTime } = model.root.userData;
  const period = geometry.inputCyclePeriod;
  const step = 1e-5;
  const rateAt = (time, key) => (
    stateAtTime(time + step)[key] - stateAtTime(time - step)[key]
  ) / (2 * step);

  for (const time of [0.7, period - 0.3, period + 0.4, 19.2]) {
    near(rateAt(time, 'driverAngleUnwrapped'), 1, 1e-9,
      `driver rate at ${time}`);
    near(rateAt(time, 'leftSupportAngleUnwrapped'), -0.12, 1e-10,
      `left support rate at ${time}`);
    near(rateAt(time, 'rightSupportAngleUnwrapped'), -0.12, 1e-10,
      `right support rate at ${time}`);
  }

  const oneTurn = stateAtTime(period);
  near(oneTurn.driverAngle, 0, 0, 'wrapped driver after one turn');
  near(oneTurn.driverAngleUnwrapped, FULL_TURN, 0,
    'unwrapped driver after one turn');
  near(oneTurn.leftSupportAngleUnwrapped, -0.12 * FULL_TURN, 0,
    'support phase retained after one driver turn');
  near(oneTurn.leftSupportAngle, 0.88 * FULL_TURN, 1e-15,
    'wrapped support phase after one driver turn');
  assert.equal(oneTurn.inputCycleCoordinate, 0);
  assert.notEqual(oneTurn.leftSupportAngle, 0);

  const before = stateAtTime(period - step);
  const after = stateAtTime(period + step);
  near(
    after.leftSupportAngleUnwrapped - before.leftSupportAngleUnwrapped,
    -0.12 * 2 * step,
    1e-15,
    'support phase is continuous across input boundary',
  );
  disposeModel(model.root);
});

test('movement 250 closes all marked members after 25 shaft turns and leaves 269 authored', () => {
  const movement250 = catalog.movements[249];
  const model250 = createMovementModel(movement250);
  const {
    animationTiming,
    geometry,
    stateAtTime,
  } = model250.root.userData;
  const closure = stateAtTime(geometry.fullMarkedAssemblyClosure);

  near(geometry.fullMarkedAssemblyClosure, 25 * FULL_TURN, 0,
    'full marked assembly closure');
  near(closure.driverAngleUnwrapped, 25 * FULL_TURN, 0,
    'driver makes 25 turns');
  near(closure.leftSupportAngleUnwrapped, -3 * FULL_TURN, 0,
    'support wheels make three reverse turns');
  assert.equal(closure.driverAngle, 0);
  assert.equal(closure.leftSupportAngle, 0);
  assert.equal(closure.rightSupportAngle, 0);
  assert.equal(closure.fullAssemblyCoordinate, 0);
  assert.equal(closure.inputCycleCoordinate, 0);
  near(animationTiming.authoredCyclePeriod, FULL_TURN, 0,
    'display timing follows one shaft revolution');
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model250.root);
  disposeModel(model289.root);
});
