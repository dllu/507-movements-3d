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

test('movement 296 is one detached roller-pin lever escapement, not a generic anchor', () => {
  const movement = catalog.movements[295];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 296);
  assert.equal(movement.number, '296');
  assert.equal(movement.title, 'Lever escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'fifteen-tooth-detached-double-beat-roller-pin-lever-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /15-tooth clockwise escape wheel/);
  assert.match(mechanism, /two pallets on anchor B/);
  assert.match(mechanism, /single roller pin on D enters fork notch E/);
  assert.match(mechanism, /detached for the remainder/);
  assert.equal(transmission.toothCount, 15);
  assert.equal(transmission.palletCount, 2);
  assert.equal(transmission.oneRollerPin, true);
  assert.equal(transmission.balanceImpulseCountPerOscillation, 2);
  assert.equal(transmission.balanceIsDetachedOutsideForkWindow, true);
  assert.match(transmission.direction, /clockwise/);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.palletFork.parent, model.root);
  assert.equal(blocks.balance.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.anchorBody.parent, blocks.palletFork);
  assert.equal(blocks.forkLever.parent, blocks.palletFork);
  assert.equal(blocks.impulsePin.parent, blocks.balance);
  assert.equal(blocks.wheelTeeth.length, 15);
  assert.equal(blocks.palletBlocks.length, 2);
  assert.equal(blocks.palletLockEdges.length, 2);
  assert.equal(blocks.palletImpulseEdges.length, 2);
  assert.equal(blocks.forkTines.length, 2);
  assert.equal(blocks.forkTineEdges.length, 2);
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'escape-wheel axis');
  vectorNear(blocks.palletFork.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'pallet-fork axis B');
  vectorNear(blocks.balance.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'balance axis D');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'pointed-lever-escape-wheel-tooth').length, 15);
  assert.equal(roles.filter((role) => /jewelled-pallet-block$/.test(role))
    .length, 2);
  assert.equal(roles.filter((role) =>
    /working-face-of-fork-notch-E$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    role === 'balance-roller-impulse-pin-entering-notch-E').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 296 records Brown’s A–E layout, arrows, and unavailable animation', () => {
  const movement = catalog.movements[295];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate296;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /wheel A/);
  assert.match(sourceAnimation.referenceScope, /anchor B/);
  assert.match(sourceAnimation.referenceScope, /fork notch E/);
  assert.match(sourceAnimation.referenceScope, /15-degree detached fork window/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_296.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.rasterPalletPivotB, new THREE.Vector2(297, 51));
  assert.deepEqual(plate.rasterWheelCenterA, new THREE.Vector2(300, 286));
  assert.deepEqual(plate.rasterBalanceCenterD, new THREE.Vector2(76, 76));
  assert.deepEqual(plate.rasterForkNotchE, new THREE.Vector2(116, 76));
  assert.deepEqual(plate.rasterLeverEndC, new THREE.Vector2(485, 75));
  assert.deepEqual(plate.rasterLeftPallet, new THREE.Vector2(177, 119));
  assert.deepEqual(plate.rasterRightPallet, new THREE.Vector2(401, 119));
  assert.deepEqual(plate.rasterBalanceDirectionArrow,
    new THREE.Vector2(15, 82));
  assert.deepEqual(plate.rasterWheelDirectionArrow,
    new THREE.Vector2(483, 156));
  assert.equal(plate.rasterWheelOuterRadius, 198);
  assert.equal(plate.visibleWheelToothCount, 15);
  assert.match(plate.inferredTopology, /one clockwise 15-tooth wheel A/);
  assert.match(plate.inferredTopology, /one rigid E-C lever/);

  vectorNear(sourcePointToModel(plate.rasterPalletPivotB),
    geometry.palletPivot, 0, 'source pivot B');
  vectorNear(sourcePointToModel(plate.rasterWheelCenterA),
    geometry.wheelCenter, 0, 'source wheel center A');
  vectorNear(sourcePointToModel(plate.rasterBalanceCenterD),
    geometry.balanceCenter, 0, 'source balance center D');
  near(plate.rasterWheelOuterRadius * geometry.sourceScale,
    geometry.wheelToothTipRadius, 0,
  'source wheel radius');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.periodReference.publicationYear, 1911);
  assert.equal(sourceReference.periodReference.figure, 4);
  assert.match(sourceReference.periodReference.description,
    /15 degrees past center/);
  disposeModel(model.root);
});

test('movement 296 derives the fork engagement window from fifteen balance degrees', () => {
  const model = createMovementModel(catalog.movements[295]);
  const {
    blocks,
    geometry,
    stateAtTime,
  } = model.root.userData;

  const entry = stateAtTime(
    geometry.pinEngagementHalfPhase * geometry.halfBeatDuration,
  );
  const exit = stateAtTime(
    geometry.pinDisengagementHalfPhase * geometry.halfBeatDuration,
  );
  near(entry.balanceAngle, -geometry.statedDisengagementAngle, 3e-16,
    'pin enters fifteen degrees before center');
  near(exit.balanceAngle, geometry.statedDisengagementAngle, 5e-16,
    'pin leaves fifteen degrees past center');
  near(geometry.pinEngagementHalfPhase
      + geometry.pinDisengagementHalfPhase,
  1, 0, 'symmetric fork window');
  assert.equal(entry.forkPinContactActive, true);
  assert.equal(exit.forkPinContactActive, true);
  assert.equal(stateAtTime((geometry.pinEngagementHalfPhase - 1e-6)
    * geometry.halfBeatDuration).forkPinContactActive, false);
  assert.equal(stateAtTime((geometry.pinDisengagementHalfPhase + 1e-6)
    * geometry.halfBeatDuration).forkPinContactActive, false);
  near(blocks.impulsePin.position.z,
    geometry.forkPlaneZ + 0.16, 0, 'roller pin crosses fork plane');
  assert.ok(blocks.rollerDisk.position.z > geometry.forkPlaneZ);
  disposeModel(model.root);
});

test('movement 296 has two distinct generated notch flanks exactly one pin diameter apart', () => {
  const model = createMovementModel(catalog.movements[295]);
  const {
    forkTineFaceFrame,
    forkTineFacePoints,
    geometry,
  } = model.root.userData;
  const upper = forkTineFacePoints(1, 121);
  const lower = forkTineFacePoints(-1, 121);

  assert.equal(upper.length, 121);
  assert.equal(lower.length, 121);
  assert.ok(upper[0].distanceTo(upper.at(-1)) > 0.9);
  assert.ok(lower[0].distanceTo(lower.at(-1)) > 0.9);
  for (let index = 0; index < upper.length; index += 1) {
    const reverseIndex = lower.length - 1 - index;
    near(upper[index].distanceTo(lower[reverseIndex]),
      2 * geometry.balancePinRadius, 3e-12,
    `fork gap at sample ${index}`);
  }
  const middlePhase = 0.5;
  const upperFrame = forkTineFaceFrame(1, middlePhase);
  const lowerFrame = forkTineFaceFrame(-1, middlePhase);
  vectorNear(
    upperFrame.point.clone().add(lowerFrame.point).multiplyScalar(0.5),
    upperFrame.center,
    3e-12,
    'pin center lies midway between notch flanks',
  );
  near(upperFrame.center.distanceTo(upperFrame.point),
    geometry.balancePinRadius, 3e-16, 'upper pin-radius offset');
  near(lowerFrame.center.distanceTo(lowerFrame.point),
    geometry.balancePinRadius, 3e-16, 'lower pin-radius offset');
  disposeModel(model.root);
});

test('movement 296 detaches the balance except while its one roller pin occupies E', () => {
  const model = createMovementModel(catalog.movements[295]);
  const {
    geometry,
    stateAtTime,
  } = model.root.userData;
  const tineCounts = new Map([['upper', 0], ['lower', 0]]);

  for (let sample = 0; sample <= 20000; sample += 1) {
    const time = geometry.balancePeriod * sample / 20000;
    const state = stateAtTime(time);
    assert.equal(state.balanceDetached, !state.forkPinContactActive);
    if (!state.forkPinContactActive) {
      assert.equal(state.forkPinContact, null);
      continue;
    }
    tineCounts.set(state.forkPinContact.tine,
      tineCounts.get(state.forkPinContact.tine) + 1);
    near(state.forkPinContact.pointError, 0, 2e-15,
      `pin/fork point closure at ${sample}`);
    near(state.forkPinContact.pinRadiusError, 0, 6e-16,
      `pin radius at ${sample}`);
    near(state.forkPinContact.normalVelocityError, 0, 2e-7,
      `pin/fork normal velocity at ${sample}`);
    assert.ok(Number.isFinite(state.forkPinContact.relativeSlipSpeed));
  }
  assert.ok(tineCounts.get('upper') > 1400);
  assert.ok(tineCounts.get('lower') > 1400);
  disposeModel(model.root);
});

test('movement 296 alternates exact pallet locks and impulses around one free drop', () => {
  const model = createMovementModel(catalog.movements[295]);
  const {
    geometry,
    palletImpulsePoints,
    palletLockPoints,
    stateAtTime,
  } = model.root.userData;
  const sideCounts = new Map([['left', 0], ['right', 0]]);
  let impulseCount = 0;
  let dropCount = 0;

  for (const side of [1, -1]) {
    const lock = palletLockPoints(side, 81);
    const impulse = palletImpulsePoints(side, 81);
    vectorNear(lock.at(-1), impulse[0], 0,
      `${side} lock/impulse profile join`);
    assert.ok(impulse[0].distanceTo(impulse.at(-1)) > 0.45);
  }

  for (let sample = 0; sample <= 24000; sample += 1) {
    const state = stateAtTime(
      geometry.balancePeriod * sample / 24000,
    );
    if (state.wheelContactActive) {
      sideCounts.set(state.wheelContact.palletSide,
        sideCounts.get(state.wheelContact.palletSide) + 1);
      near(state.wheelContact.pointError, 0, 6e-15,
        `wheel/pallet closure at ${sample}`);
      near(state.wheelContact.normalVelocityError, 0, 2e-7,
        `wheel/pallet normal velocity at ${sample}`);
      if (state.wheelContactMode === 'pallet-impulse') {
        impulseCount += 1;
        assert.ok(state.wheelAngularSpeed <= 1e-14);
        assert.equal(state.forkPinContactActive, true);
      } else {
        assert.equal(state.wheelAngularSpeed, 0);
      }
    } else {
      dropCount += 1;
      assert.equal(state.wheelEvent, 'free-drop');
      assert.ok(state.wheelAngularSpeed <= 0);
    }
  }
  assert.ok(sideCounts.get('left') > 10000);
  assert.ok(sideCounts.get('right') > 10000);
  assert.ok(impulseCount > 1900);
  assert.ok(dropCount > 800);
  disposeModel(model.root);
});

test('movement 296 advances half a pitch per beat with analytic balance, fork, and wheel rates', () => {
  const model = createMovementModel(catalog.movements[295]);
  const {
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;

  near(transmission.halfBeatAdvance, geometry.halfToothPitch, 0,
    'half pitch per vibration');
  near(transmission.oscillationAdvance, geometry.toothPitch, 0,
    'one tooth per oscillation');
  for (const time of [0.23, 0.79, 1.42, 2.61, 3.75]) {
    near(stateAtTime(time + geometry.halfBeatDuration).wheelAngle
        - stateAtTime(time).wheelAngle,
    -geometry.halfToothPitch, 8e-16,
    `half-beat advance at ${time}`);
    near(stateAtTime(time + geometry.balancePeriod).wheelAngle
        - stateAtTime(time).wheelAngle,
    -geometry.toothPitch, 9e-16,
    `oscillation advance at ${time}`);
    near(stateAtTime(time + geometry.balancePeriod).balanceAngle,
      stateAtTime(time).balanceAngle, 9e-16,
    `balance closure at ${time}`);
    near(stateAtTime(time + geometry.balancePeriod).forkAngle,
      stateAtTime(time).forkAngle, 9e-16,
    `fork closure at ${time}`);
  }

  let previous = stateAtTime(0).wheelAngle;
  for (let sample = 1; sample <= 24000; sample += 1) {
    const state = stateAtTime(
      geometry.balancePeriod * sample / 24000,
    );
    assert.ok(state.wheelAngle <= previous + 2e-15,
      `no clockwise recoil at sample ${sample}`);
    previous = state.wheelAngle;
  }

  const epsilon = 1e-5;
  for (const halfPhase of [0.20, 0.445, 0.495, 0.55, 0.70]) {
    const time = halfPhase * geometry.halfBeatDuration;
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near((after.balanceAngle - before.balanceAngle) / (2 * epsilon),
      state.balanceAngularSpeed, 8e-10,
    `balance speed at ${halfPhase}`);
    near((after.forkAngle - before.forkAngle) / (2 * epsilon),
      state.forkAngularSpeed, 8e-8,
    `fork speed at ${halfPhase}`);
    near((after.forkAngularSpeed - before.forkAngularSpeed)
        / (2 * epsilon),
    state.forkAngularAcceleration, 7e-7,
    `fork acceleration at ${halfPhase}`);
    near((after.wheelAngle - before.wheelAngle) / (2 * epsilon),
      state.wheelAngularSpeed, 1.2e-7,
    `wheel speed at ${halfPhase}`);
    near((after.wheelAngularSpeed - before.wheelAngularSpeed)
        / (2 * epsilon),
    state.wheelAngularAcceleration, 6e-6,
    `wheel acceleration at ${halfPhase}`);
  }
  disposeModel(model.root);
});

test('movement 296 renderer binds both contact chains and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[295]);
  const {
    animationTiming,
    blocks,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(timeline.demonstrationPeriod, 4);
  assert.deepEqual(timeline.schedule, [
    'balance-free-current-pallet-locked',
    'roller-pin-enters-E-and-unlocks',
    'escape-tooth-impulses-pallet-fork-and-balance',
    'wheel-drops-to-opposite-pallet',
    'roller-pin-leaves-E-and-balance-is-free',
    'same-sequence-in-opposite-direction',
  ]);

  for (const time of [0, 0.4, 0.89, 0.99, 1.10, 1.40,
    2.40, 2.89, 2.99, 3.10, 3.40, 4]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.balance.rotation.z, expected.balanceAngle, 0,
      `rendered balance at ${time}`);
    near(blocks.palletFork.rotation.z, expected.forkAngle, 0,
      `rendered fork at ${time}`);
    near(blocks.wheelRotor.rotation.z, expected.wheelAngle, 0,
      `rendered wheel at ${time}`);
    assert.equal(blocks.palletContactMarker.visible,
      expected.wheelContactActive);
    assert.equal(blocks.pinContactMarker.visible,
      expected.forkPinContactActive);
    assert.equal(model.root.userData.contacts.activeToothIndex,
      expected.activeToothIndex);
    assert.equal(model.root.userData.contacts.activePalletSide,
      expected.activePalletSide);
    if (expected.wheelContactActive) {
      near(model.root.userData.contacts.wheelPallet.pointError, 0, 4e-15,
        `rendered wheel contact at ${time}`);
    }
    if (expected.forkPinContactActive) {
      near(model.root.userData.contacts.forkPin.pointError, 0, 2e-15,
        `rendered pin contact at ${time}`);
    }
  }

  model.update(0.73);
  const startBalanceAngle = blocks.balance.rotation.z;
  const startForkAngle = blocks.palletFork.rotation.z;
  const startWheelAngle = blocks.wheelRotor.rotation.z;
  model.update(0.73 + geometry.balancePeriod);
  near(blocks.balance.rotation.z, startBalanceAngle, 9e-16,
    'rendered balance closure');
  near(blocks.palletFork.rotation.z, startForkAngle, 9e-16,
    'rendered fork closure');
  near(blocks.wheelRotor.rotation.z - startWheelAngle,
    -geometry.toothPitch, 9e-16, 'rendered one-tooth advance');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
