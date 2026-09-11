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

test('movement 314 is the single-impulse lever chronometer, not movement 296 with recolored pallets', () => {
  const movement = catalog.movements[313];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 314);
  assert.equal(movement.number, '314');
  assert.equal(movement.title, 'Lever chronometer escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'fifteen-tooth-single-impulse-lever-chronometer-alternating-long-short-lock-transfer-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /15-tooth clockwise escape wheel/);
  assert.match(mechanism, /pallets A and B, which have no impulse faces/);
  assert.match(mechanism, /directly impulses the sole balance-mounted pallet C/);
  assert.match(mechanism, /short unpowered transfer back to A/);

  assert.equal(transmission.toothCount, 15);
  assert.equal(transmission.leverPalletCount, 2);
  assert.equal(transmission.leverPalletImpulseFaceCount, 0);
  assert.equal(transmission.balanceMountedImpulsePalletCount, 1);
  assert.equal(transmission.balanceImpulseCountPerOscillation, 1);
  assert.equal(transmission.wheelReleasesPerOscillation, 2);
  assert.equal(transmission.balanceIsDetachedOutsideForkWindow, true);
  assert.match(transmission.direction, /clockwise/);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.palletLever.parent, model.root);
  assert.equal(blocks.balance.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.directPalletC.parent, blocks.balance);
  assert.equal(blocks.directPalletCarrier.parent, blocks.balance);
  assert.equal(blocks.balancePin.parent, blocks.balance);
  assert.equal(blocks.bankingTail.parent, blocks.palletLever);
  assert.equal(blocks.wheelTeeth.length, 15);
  assert.equal(blocks.palletBlocks.length, 2);
  assert.equal(blocks.palletLockEdges.length, 2);
  assert.equal(blocks.forkTines.length, 2);
  assert.equal(blocks.forkTineEdges.length, 2);
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'escape-wheel axis');
  vectorNear(blocks.palletLever.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'locking-lever axis');
  vectorNear(blocks.balance.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'balance axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'pointed-lever-chronometer-escape-wheel-tooth').length, 15);
  assert.equal(roles.filter((role) =>
    /^locking-only-pallet-[AB]-with-no-impulse-face$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    role === 'single-balance-mounted-direct-impulse-pallet-C').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'single-balance-roller-pin-driving-locking-lever-both-ways')
    .length, 1);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 314 records Brown’s plate and Grimthorpe’s exact A-C-B-return sequence', () => {
  const movement = catalog.movements[313];
  const model = createMovementModel(movement);
  const {
    canonicalTimes,
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.brownPlate314;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /15-tooth wheel/);
  assert.match(sourceAnimation.referenceScope, /exact A-to-B direct-impulse/);
  assert.match(sourceAnimation.referenceScope, /lift and drop angles are not dimensioned/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_314.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 12);
  assert.deepEqual(plate.rasterWheelCenter, new THREE.Vector2(175, 275));
  assert.deepEqual(plate.rasterBalanceCenter, new THREE.Vector2(373, 115));
  assert.deepEqual(plate.rasterLeverPivot, new THREE.Vector2(375, 200));
  assert.deepEqual(plate.rasterBalancePin, new THREE.Vector2(373, 159));
  assert.deepEqual(plate.rasterImpulseStartC, new THREE.Vector2(281, 145));
  assert.deepEqual(plate.rasterPalletA, new THREE.Vector2(349, 299));
  assert.deepEqual(plate.rasterPalletBFreeTip, new THREE.Vector2(203, 397));
  assert.deepEqual(plate.rasterLeftBank, new THREE.Vector2(324, 477));
  assert.deepEqual(plate.rasterRightBank, new THREE.Vector2(424, 467));
  assert.equal(plate.rasterWheelOuterRadius, 168);
  assert.equal(plate.rasterBalanceOuterRadius, 84);
  assert.equal(plate.visibleWheelToothCount, 15);
  assert.match(plate.inferredTopology, /locking-only pallets A and B/);
  assert.match(plate.inferredTopology, /direct impulse pallet C/);

  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 0, 'source wheel center');
  vectorNear(sourcePointToModel(plate.rasterBalanceCenter),
    geometry.balanceCenter, 0, 'source balance center');
  vectorNear(sourcePointToModel(plate.rasterLeverPivot),
    geometry.leverPivot, 0, 'source lever pivot');
  near(plate.rasterWheelOuterRadius * geometry.sourceScale,
    geometry.wheelToothTipRadius, 0, 'source wheel radius');
  near(plate.rasterBalanceOuterRadius * geometry.sourceScale,
    geometry.balanceRimRadius, 0, 'source balance radius');
  const start = stateAtTime(canonicalTimes.directImpulseStart);
  assert.equal(start.directImpulseActive, true);
  assert.ok(start.impulseToothPoint.distanceTo(
    sourcePointToModel(plate.rasterImpulseStartC),
  ) <= plate.measurementUncertaintyPixels * geometry.sourceScale);

  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  const period = sourceReference.grimthorpeFigure77;
  assert.equal(period.author, 'Edmund Beckett, Lord Grimthorpe');
  assert.equal(period.edition, 8);
  assert.equal(period.figure, 77);
  assert.equal(period.page, 234);
  assert.equal(period.publicationYear, 1903);
  assert.match(period.description, /A unlocks as direct impulse begins at C/);
  assert.match(period.description, /intervening tooth lands on B/);
  assert.match(period.description, /short non-impulse movement back to A/);
  assert.match(period.url, /gutenberg\.org\/ebooks\/17576/);
  assert.equal(sourceReference.historicalExample.publicationYear, 1959);
  assert.match(sourceReference.historicalExample.description,
    /union chronometer/);
  assert.match(sourceReference.historicalExample.description,
    /Loveday, Wakefield No\. 1356/);
  disposeModel(model.root);
});

test('movement 314 pallet A and B profiles remain exact locking faces with zero wheel impulse', () => {
  const model = createMovementModel(catalog.movements[313]);
  const {
    canonicalTimes,
    geometry,
    palletLockPoints,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const contactCounts = new Map([['A', 0], ['B', 0]]);

  assert.equal(transmission.leverPalletImpulseFaceCount, 0);
  for (const name of ['A', 'B']) {
    const points = palletLockPoints(name, 81);
    assert.equal(points.length, 81);
    assert.ok(points[0].distanceTo(points.at(-1)) > 0.012,
      `${name} has a finite locking slide`);
  }

  for (let sample = 0; sample <= 24000; sample += 1) {
    const state = stateAtTime(
      geometry.balancePeriod * sample / 24000,
    );
    if (!state.lockingContactActive) {
      assert.equal(state.lockingContact, null);
      continue;
    }
    contactCounts.set(state.lockingContact.pallet,
      contactCounts.get(state.lockingContact.pallet) + 1);
    assert.equal(state.lockingContact.mode, 'locking-only-no-impulse');
    near(state.lockingContact.pointError, 0, 5e-15,
      `locking point closure at ${sample}`);
    near(state.lockingContact.normalVelocityError, 0, 4e-9,
      `locking normal velocity at ${sample}`);
    near(state.wheelAngularSpeed, 0, 0,
      `wheel is stopped on a locking pallet at ${sample}`);
  }
  assert.ok(contactCounts.get('A') > 10000);
  assert.ok(contactCounts.get('B') > 10000);

  const aLocked = stateAtTime(canonicalTimes.aLocked);
  const bLanding = stateAtTime(canonicalTimes.bLanding);
  const bLocked = stateAtTime(canonicalTimes.bLocked);
  const aRelock = stateAtTime(canonicalTimes.aRelock);
  assert.equal(aLocked.lockingPallet, 'A');
  assert.equal(bLanding.lockingPallet, 'B');
  assert.equal(bLocked.lockingPallet, 'B');
  assert.equal(aRelock.lockingPallet, 'A');
  assert.equal(aLocked.directImpulseActive, false);
  assert.equal(bLocked.directImpulseActive, false);
  disposeModel(model.root);
});

test('movement 314 roller pin drives the locking lever on both passages and then detaches', () => {
  const model = createMovementModel(catalog.movements[313]);
  const {
    blocks,
    forkTineFaceFrame,
    forkTineFacePoints,
    geometry,
    stateAtTime,
  } = model.root.userData;

  const firstEntry = stateAtTime(
    geometry.pinEngagementHalfPhase * geometry.halfBeatDuration,
  );
  const firstExit = stateAtTime(
    geometry.pinDisengagementHalfPhase * geometry.halfBeatDuration,
  );
  const secondEntry = stateAtTime(
    geometry.halfBeatDuration
      + geometry.pinEngagementHalfPhase * geometry.halfBeatDuration,
  );
  const secondExit = stateAtTime(
    geometry.halfBeatDuration
      + geometry.pinDisengagementHalfPhase * geometry.halfBeatDuration,
  );
  near(firstEntry.balanceAngle, -geometry.statedLeverDetachAngle, 4e-16,
    'acting pin entry at minus fifteen degrees');
  near(firstExit.balanceAngle, geometry.statedLeverDetachAngle, 5e-16,
    'acting pin exit at plus fifteen degrees');
  near(secondEntry.balanceAngle, geometry.statedLeverDetachAngle, 5e-16,
    'return pin entry at plus fifteen degrees');
  near(secondExit.balanceAngle, -geometry.statedLeverDetachAngle, 6e-16,
    'return pin exit at minus fifteen degrees');
  assert.equal(firstEntry.forkPinContactActive, true);
  assert.equal(firstExit.forkPinContactActive, true);
  assert.equal(stateAtTime((geometry.pinEngagementHalfPhase - 1e-6)
    * geometry.halfBeatDuration).forkPinContactActive, false);
  assert.equal(stateAtTime((geometry.pinDisengagementHalfPhase + 1e-6)
    * geometry.halfBeatDuration).forkPinContactActive, false);
  assert.ok(blocks.balancePin.position.z - 0.37 < geometry.leverPlaneZ);
  assert.ok(blocks.balancePin.position.z + 0.37 > geometry.leverPlaneZ);

  const actingFace = forkTineFacePoints(1, 121);
  const returnFace = forkTineFacePoints(-1, 121);
  for (let index = 0; index < actingFace.length; index += 1) {
    near(actingFace[index].distanceTo(returnFace.at(-index - 1)),
      2 * geometry.balancePinRadius, 5e-16,
    `fork gap at sample ${index}`);
  }
  for (const side of [1, -1]) {
    const frame = forkTineFaceFrame(side, 0.5);
    near(frame.center.distanceTo(frame.point),
      geometry.balancePinRadius, 4e-16,
    `${side} fork face is one pin radius from center`);
  }

  const tineCounts = new Map([['acting-side', 0], ['return-side', 0]]);
  for (let sample = 0; sample <= 20000; sample += 1) {
    const state = stateAtTime(
      geometry.balancePeriod * sample / 20000,
    );
    assert.equal(state.balanceDetached, !state.forkPinContactActive);
    if (!state.forkPinContactActive) continue;
    tineCounts.set(state.forkPinContact.tine,
      tineCounts.get(state.forkPinContact.tine) + 1);
    assert.match(state.forkPinContact.mode, /^balance-pin-/);
    assert.doesNotMatch(state.forkPinContact.mode, /fork-drives/);
    near(state.forkPinContact.pointError, 0, 2e-15,
      `fork point closure at ${sample}`);
    near(state.forkPinContact.pinRadiusError, 0, 5e-16,
      `fork pin radius at ${sample}`);
    near(state.forkPinContact.normalVelocityError, 0, 8e-9,
      `fork normal velocity at ${sample}`);
  }
  assert.ok(tineCounts.get('acting-side') > 1300);
  assert.ok(tineCounts.get('return-side') > 1300);
  disposeModel(model.root);
});

test('movement 314 gives one exact direct impulse at C from A release through B landing', () => {
  const model = createMovementModel(catalog.movements[313]);
  const {
    canonicalTimes,
    directImpulsePoints,
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  let directSamples = 0;

  const profile = directImpulsePoints(121);
  assert.equal(profile.length, 121);
  assert.ok(profile[0].distanceTo(profile.at(-1)) > 0.20);
  near(profile[0].length(), profile.at(-1).length(), 0.004,
    'C working face stays nearly circular about balance staff');

  for (let sample = 0; sample <= 30000; sample += 1) {
    const state = stateAtTime(
      geometry.balancePeriod * sample / 30000,
    );
    if (!state.directImpulseActive) {
      assert.equal(state.directImpulseContact, null);
      continue;
    }
    directSamples += 1;
    assert.equal(state.actingHalfBeat, true);
    assert.equal(state.halfBeatIndex, 0);
    assert.equal(state.currentPallet, 'A');
    assert.equal(state.nextPallet, 'B');
    assert.equal(state.lockingContactActive, false);
    assert.equal(state.shortTransferActive, false);
    assert.equal(state.directImpulseContact.mode,
      'escape-tooth-directly-impulses-balance-pallet-C');
    assert.ok(state.balanceAngularSpeed > 0);
    assert.ok(state.wheelAngularSpeed <= 0);
    near(state.directImpulseContact.pointError, 0, 1e-15,
      `direct C point closure at ${sample}`);
    near(state.directImpulseContact.normalVelocityError, 0, 4e-9,
      `direct C normal velocity at ${sample}`);
  }
  assert.ok(directSamples > 1700);
  assert.equal(transmission.balanceImpulseCountPerOscillation, 1);

  const epsilon = 1e-8;
  const before = stateAtTime(canonicalTimes.directImpulseStart - epsilon);
  const start = stateAtTime(canonicalTimes.directImpulseStart);
  const beforeLanding = stateAtTime(canonicalTimes.bLanding - epsilon);
  const landing = stateAtTime(canonicalTimes.bLanding);
  assert.equal(before.lockingPallet, 'A');
  assert.equal(before.lockingContactActive, true);
  assert.equal(start.lockingContactActive, false);
  assert.equal(start.directImpulseActive, true);
  assert.equal(start.impulseToothIndex, 2);
  near(Math.atan2(start.impulseToothPoint.y, start.impulseToothPoint.x),
    geometry.directImpulseStartAngle, 3e-16,
  'direct impulse starts at C engraving angle');
  assert.equal(beforeLanding.directImpulseActive, true);
  assert.equal(landing.directImpulseActive, false);
  assert.equal(landing.lockingPallet, 'B');
  assert.equal(landing.lockingContactActive, true);
  assert.equal(landing.lockingToothIndex, 14);
  vectorNear(landing.lockingToothPoint,
    landing.lockingContact.expectedPoint, 5e-15,
  'tooth between A and B lands exactly on B');
  disposeModel(model.root);
});

test('movement 314 return unlocks B for only the short unpowered transfer to A', () => {
  const model = createMovementModel(catalog.movements[313]);
  const {
    canonicalTimes,
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const epsilon = 1e-8;
  const returnReleaseTime = geometry.halfBeatDuration
    + geometry.palletReleaseHalfPhase * geometry.halfBeatDuration;
  const beforeRelease = stateAtTime(returnReleaseTime - epsilon);
  const release = stateAtTime(returnReleaseTime);
  const middle = stateAtTime(canonicalTimes.shortTransferMid);
  const beforeLanding = stateAtTime(canonicalTimes.aRelock - epsilon);
  const landing = stateAtTime(canonicalTimes.aRelock);

  assert.equal(beforeRelease.lockingPallet, 'B');
  assert.equal(beforeRelease.lockingContactActive, true);
  assert.equal(release.lockingContactActive, false);
  assert.equal(release.shortTransferActive, true);
  for (const state of [release, middle, beforeLanding]) {
    assert.equal(state.actingHalfBeat, false);
    assert.equal(state.shortTransferActive, true);
    assert.equal(state.directImpulseActive, false);
    assert.equal(state.directImpulseContact, null);
    assert.equal(state.lockingContactActive, false);
    assert.match(state.wheelEvent, /short-unpowered-B-to-A-transfer/);
  }
  assert.ok(middle.balanceAngularSpeed < 0);
  assert.ok(middle.wheelAngularSpeed < 0);
  assert.equal(landing.shortTransferActive, false);
  assert.equal(landing.lockingContactActive, true);
  assert.equal(landing.lockingPallet, 'A');
  vectorNear(landing.lockingToothPoint,
    landing.lockingContact.expectedPoint, 5e-15,
  'short transfer lands exactly on A');
  near(landing.wheelAngle - stateAtTime(geometry.halfBeatDuration).wheelAngle,
    -transmission.shortReturnAdvance, 2e-16,
  'return wheel advance is only the short residual');
  assert.ok(transmission.shortReturnAdvance
    < transmission.longImpulseAdvance / 2);
  disposeModel(model.root);
});

test('movement 314 advances one pitch per oscillation with analytic C2 rates and no recoil', () => {
  const model = createMovementModel(catalog.movements[313]);
  const {
    geometry,
    stateAtTime,
    transmission,
    wheelAngleAtHalfLanding,
  } = model.root.userData;

  near(transmission.longImpulseAdvance,
    geometry.toothPitch * 0.75, 0, 'long acting advance');
  near(transmission.shortReturnAdvance,
    geometry.toothPitch * 0.25, 2e-17, 'short return advance');
  near(transmission.longImpulseAdvance + transmission.shortReturnAdvance,
    geometry.toothPitch, 0, 'long plus short equals one tooth pitch');
  near(wheelAngleAtHalfLanding(1) - wheelAngleAtHalfLanding(0),
    -geometry.longImpulseAdvance, 0, 'A-to-B landing advance');
  near(wheelAngleAtHalfLanding(2) - wheelAngleAtHalfLanding(1),
    -geometry.shortReturnAdvance, 2e-16, 'B-to-A landing advance');

  for (const time of [0.17, 0.82, 1.03, 1.74, 2.91, 3.43]) {
    near(stateAtTime(time + geometry.balancePeriod).wheelAngle
        - stateAtTime(time).wheelAngle,
    -geometry.toothPitch, 1.2e-15,
    `wheel one-pitch closure at ${time}`);
    near(stateAtTime(time + geometry.balancePeriod).balanceAngle,
      stateAtTime(time).balanceAngle, 1.2e-15,
    `balance closure at ${time}`);
    near(stateAtTime(time + geometry.balancePeriod).leverAngle,
      stateAtTime(time).leverAngle, 1.2e-15,
    `lever closure at ${time}`);
  }

  let previous = stateAtTime(0).wheelAngle;
  for (let sample = 1; sample <= 30000; sample += 1) {
    const state = stateAtTime(
      geometry.balancePeriod * sample / 30000,
    );
    assert.ok(state.wheelAngle <= previous + 2e-15,
      `clockwise wheel never recoils at ${sample}`);
    previous = state.wheelAngle;
  }

  for (const halfBeatOffset of [0, geometry.halfBeatDuration]) {
    for (const halfPhase of [
      geometry.palletReleaseHalfPhase,
      geometry.pinDisengagementHalfPhase,
    ]) {
      const state = stateAtTime(
        halfBeatOffset + halfPhase * geometry.halfBeatDuration,
      );
      near(state.wheelAngularSpeed, 0, 1e-14,
        `wheel C1 boundary at ${halfBeatOffset + halfPhase}`);
      near(state.wheelAngularAcceleration, 0, 2e-13,
        `wheel C2 boundary at ${halfBeatOffset + halfPhase}`);
    }
  }

  const epsilon = 1e-5;
  for (const time of [0.40, 0.88, 0.99, 1.08, 2.40, 2.88, 2.99, 3.08]) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near((after.balanceAngle - before.balanceAngle) / (2 * epsilon),
      state.balanceAngularSpeed, 9e-10,
    `balance speed at ${time}`);
    near((after.leverAngle - before.leverAngle) / (2 * epsilon),
      state.leverAngularSpeed, 1.2e-7,
    `lever speed at ${time}`);
    near((after.leverAngularSpeed - before.leverAngularSpeed)
        / (2 * epsilon),
    state.leverAngularAcceleration, 1.5e-6,
    `lever acceleration at ${time}`);
    near((after.wheelAngle - before.wheelAngle) / (2 * epsilon),
      state.wheelAngularSpeed, 2e-7,
    `wheel speed at ${time}`);
    near((after.wheelAngularSpeed - before.wheelAngularSpeed)
        / (2 * epsilon),
    state.wheelAngularAcceleration, 1.2e-5,
    `wheel acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 314 renderer binds all three contact chains and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[313]);
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
    'A-locks-while-balance-is-detached',
    'balance-pin-enters-fork-and-unlocks-A',
    'escape-tooth-directly-impulses-balance-pallet-C',
    'intervening-tooth-lands-on-B-as-direct-impulse-ends',
    'balance-returns-and-pin-unlocks-B',
    'wheel-makes-short-unpowered-transfer-from-B-to-A',
    'A-relocks-and-balance-detaches',
  ]);

  for (const [name, contact] of Object.entries(
    geometry.bankingContactPoints,
  )) {
    near(contact.distanceTo(geometry.bankingPinCenters[name]),
      geometry.bankingPinRadius, 3e-16,
    `${name} bank is tangent to lever tail`);
    const pin = blocks.bankingPins[name === 'left' ? 0 : 1];
    vectorNear(new THREE.Vector2(pin.position.x, pin.position.y),
      geometry.bankingPinCenters[name], 0,
    `${name} rendered bank position`);
  }

  for (const time of [0, 0.4, 0.88, 0.91, 1.03, 1.15,
    2.40, 2.88, 2.91, 3.03, 3.15, 4]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.balance.rotation.z, expected.balanceAngle, 0,
      `rendered balance at ${time}`);
    near(blocks.palletLever.rotation.z, expected.leverAngle, 0,
      `rendered locking lever at ${time}`);
    near(blocks.wheelRotor.rotation.z, expected.wheelAngle, 0,
      `rendered wheel at ${time}`);
    assert.equal(blocks.lockingContactMarker.visible,
      expected.lockingContactActive);
    assert.equal(blocks.directImpulseMarker.visible,
      expected.directImpulseActive);
    assert.equal(blocks.forkPinContactMarker.visible,
      expected.forkPinContactActive);
    assert.equal(Boolean(model.root.userData.contacts.lockingPallet),
      expected.lockingContactActive);
    assert.equal(Boolean(model.root.userData.contacts.directImpulseC),
      expected.directImpulseActive);
    assert.equal(Boolean(model.root.userData.contacts.forkPin),
      expected.forkPinContactActive);
    if (expected.lockingContactActive) {
      near(model.root.userData.contacts.lockingPallet.pointError,
        0, 5e-15, `rendered lock contact at ${time}`);
    }
    if (expected.directImpulseActive) {
      near(model.root.userData.contacts.directImpulseC.pointError,
        0, 1e-15, `rendered direct contact at ${time}`);
    }
    if (expected.forkPinContactActive) {
      near(model.root.userData.contacts.forkPin.pointError,
        0, 2e-15, `rendered fork contact at ${time}`);
    }
  }

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
