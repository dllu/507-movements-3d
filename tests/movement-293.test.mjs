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

test('movement 293 is a two-tooth-system single-beat duplex escapement, not bevel gearing', () => {
  const movement = catalog.movements[292];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 293);
  assert.equal(movement.number, '293');
  assert.equal(movement.title, 'Duplex escapement, for watches…');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'fifteen-tooth-single-beat-duplex-watch-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /long in-plane locking teeth C\/D/);
  assert.match(mechanism, /short axial crown impulse pins a/);
  assert.match(mechanism, /notched frictional-rest roller A/);
  assert.match(mechanism, /silent beat/);
  assert.equal(transmission.toothCount, 15);
  assert.equal(transmission.lockingToothCount, 15);
  assert.equal(transmission.impulsePinCount, 15);
  assert.equal(transmission.singleBeat, true);
  assert.match(transmission.direction, /clockwise/);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.balance.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.lockingWheel.parent, blocks.wheelRotor);
  assert.equal(blocks.lockingRoller.parent, blocks.balance);
  assert.equal(blocks.impulsePalletBody.parent, blocks.balance);
  assert.equal(blocks.impulsePalletArm.parent, blocks.balance);
  assert.equal(blocks.impulsePins.length, 15);
  assert.equal(blocks.spokeMeshes.length, 4);
  assert.equal(blocks.balanceSpokes.length, 3);
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'escape-wheel axis');
  vectorNear(blocks.balance.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'balance axis');

  for (let index = 0; index < blocks.impulsePins.length; index += 1) {
    assert.equal(blocks.impulsePins[index].userData.index, index);
    assert.equal(blocks.impulsePins[index].position.z > 0, true);
  }
  assert.ok(blocks.impulsePalletBody.position.z > 0);
  assert.ok(blocks.lockingRoller.position.z < blocks.impulsePalletBody.position.z);
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'short-axial-crown-impulse-pin-a').length, 15);
  assert.equal(roles.filter((role) =>
    role === 'fifteen-long-in-plane-locking-teeth-C-D').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'notched-frictional-rest-locking-roller-A').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'working-face-of-impulse-pallet-B').length, 1);
  assert.equal(roles.some((role) => /generic|procedural|bevel/.test(role)),
    false);
  disposeModel(model.root);
});

test('movement 293 records Brown’s measured roller, pallet, two tooth rows, and source limits', () => {
  const movement = catalog.movements[292];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate293;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /two wheel-tooth systems/);
  assert.match(sourceAnimation.referenceScope, /notched roller A/);
  assert.match(sourceAnimation.referenceScope, /silent return beat/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_293.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 12);
  assert.deepEqual(plate.rasterBalanceCenterA,
    new THREE.Vector2(268, 110));
  assert.deepEqual(plate.rasterWheelCenter,
    new THREE.Vector2(264, 649));
  assert.deepEqual(plate.rasterNotchMouth,
    new THREE.Vector2(247, 151));
  assert.deepEqual(plate.rasterPalletTipB,
    new THREE.Vector2(328, 303));
  assert.deepEqual(plate.rasterLeftLockingToothD,
    new THREE.Vector2(70, 198));
  assert.deepEqual(plate.rasterRightLockingToothC,
    new THREE.Vector2(461, 202));
  assert.deepEqual(plate.rasterCrownPins, [
    new THREE.Vector2(198, 308),
    new THREE.Vector2(326, 303),
    new THREE.Vector2(439, 362),
  ]);
  assert.equal(plate.rasterLockingTipRadius, 493);
  assert.equal(plate.rasterImpulsePinRadius, 354);
  assert.match(plate.inferredTopology, /long radial locking teeth C\/D/);
  assert.match(plate.inferredTopology, /axial crown pins a/);
  vectorNear(sourcePointToModel(plate.rasterBalanceCenterA),
    geometry.balanceCenter, 0, 'source balance center A');
  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 0, 'source wheel center');
  near(geometry.lockingToothTipRadius + geometry.rollerRadius,
    geometry.centerDistance, 0, 'derived lock center distance');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.periodReference.publicationYear, 1911);
  assert.match(sourceReference.periodReference.description,
    /short upright pins impulse pallet P once per oscillation/);
  disposeModel(model.root);
});

test('movement 293 holds each long tooth on roller A throughout frictional rest', () => {
  const model = createMovementModel(catalog.movements[292]);
  const {
    geometry,
    lockPoint,
    stateAtCyclePhase,
  } = model.root.userData;
  let restSamples = 0;

  for (let sample = 0; sample <= 16000; sample += 1) {
    const state = stateAtCyclePhase(sample / 16000);
    if (state.contactMode !== 'frictional-rest') continue;
    restSamples += 1;
    assert.equal(state.wheelAngularSpeed, 0);
    assert.equal(state.wheelAngularAcceleration, 0);
    vectorNear(state.activeLockingToothPoint, lockPoint, 2e-15,
      `fixed locking point at ${sample}`);
    near(state.contact.pointError, 0, 2e-15,
      `roller/tooth closure at ${sample}`);
    near(state.contact.rollerRadiusError, 0, 5e-16,
      `roller radius at ${sample}`);
    near(state.contact.normalVelocityError, 0, 5e-15,
      `frictional-rest normal velocity at ${sample}`);
    assert.ok(Number.isFinite(state.contact.relativeSlipSpeed));
  }
  assert.ok(restSamples > 12000);
  near(lockPoint.distanceTo(geometry.balanceCenter),
    geometry.rollerRadius, 5e-16, 'world lock radius');
  disposeModel(model.root);
});

test('movement 293 releases through A and transfers the powered beat through crown pin and pallet B', () => {
  const model = createMovementModel(catalog.movements[292]);
  const {
    geometry,
    impulsePalletFrameAtPhase,
    notchFrameAtPhase,
    stateAtCyclePhase,
  } = model.root.userData;
  let releaseSamples = 0;
  let impulseSamples = 0;
  let flightSamples = 0;

  for (let sample = 0; sample <= 20000; sample += 1) {
    const phase = sample / 20000;
    const state = stateAtCyclePhase(phase);
    if (state.contactMode === 'powered-notch-release') {
      releaseSamples += 1;
      const frame = notchFrameAtPhase(phase, 'release');
      vectorNear(state.contact.localPoint, frame.point, 0,
        `powered notch material point at ${sample}`);
      near(state.contact.pointError, 0, 2e-15,
        `powered notch point closure at ${sample}`);
      near(state.contact.normalVelocityError, 0, 2e-9,
        `powered notch normal velocity at ${sample}`);
      assert.equal(state.lockingToothIndex, 0);
      assert.equal(state.singleBeatImpulseActive, false);
    } else if (state.contactMode === 'crown-pin-impulse') {
      impulseSamples += 1;
      const frame = impulsePalletFrameAtPhase(phase);
      vectorNear(state.contact.localPoint, frame.point, 0,
        `pallet B material point at ${sample}`);
      near(state.contact.pointError, 0, 2e-15,
        `crown-pin impulse closure at ${sample}`);
      near(state.contact.pinRadiusError, 0, 4e-16,
        `crown-pin radius at ${sample}`);
      near(state.contact.normalVelocityError, 0, 2e-9,
        `crown-pin impulse normal velocity at ${sample}`);
      assert.equal(state.activeImpulsePinIndex, 0);
      assert.equal(state.singleBeatImpulseActive, true);
      near(state.contact.pinSurfacePoint.distanceTo(
        state.activeImpulsePinCenter,
      ), geometry.impulsePinRadius, 4e-16,
      `pin surface distance at ${sample}`);
    } else if (
      phase > geometry.impulseEnd
      && phase < geometry.landing
    ) {
      flightSamples += 1;
      assert.equal(state.contactMode, null);
      assert.equal(state.contactActive, false);
    }
  }
  assert.ok(releaseSamples > 450);
  assert.ok(impulseSamples > 1000);
  assert.ok(flightSamples > 850);
  disposeModel(model.root);
});

test('movement 293 has one powered beat and one non-escaping silent recoil per oscillation', () => {
  const model = createMovementModel(catalog.movements[292]);
  const {
    canonicalStates,
    geometry,
    lockPoint,
    notchFrameAtPhase,
    stateAtCyclePhase,
  } = model.root.userData;
  let silentSamples = 0;
  let positiveRecoilRates = 0;
  let returningRecoilRates = 0;

  assert.equal(canonicalStates.impulseMiddle.contactMode,
    'crown-pin-impulse');
  assert.equal(canonicalStates.silentMiddle.contactMode,
    'silent-notch-recoil');
  assert.equal(canonicalStates.silentMiddle.singleBeatImpulseActive, false);
  near(canonicalStates.silentMiddle.recoil,
    geometry.recoilAmplitude, 2e-17, 'maximum silent recoil');
  assert.equal(canonicalStates.silentStart.lockingToothIndex, 1);
  assert.equal(canonicalStates.silentEnd.lockingToothIndex, 1);

  for (let sample = 0; sample <= 12000; sample += 1) {
    const phase = sample / 12000;
    const state = stateAtCyclePhase(phase);
    if (state.contactMode !== 'silent-notch-recoil') continue;
    silentSamples += 1;
    assert.equal(state.singleBeatImpulseActive, false);
    assert.equal(state.lockingToothIndex, 1);
    assert.ok(state.recoil >= 0);
    assert.ok(state.recoil <= geometry.recoilAmplitude + 2e-17);
    const frame = notchFrameAtPhase(phase, 'silent');
    vectorNear(state.contact.localPoint, frame.point, 0,
      `silent notch material point at ${sample}`);
    near(state.contact.pointError, 0, 2e-15,
      `silent notch closure at ${sample}`);
    near(state.contact.normalVelocityError, 0, 2e-9,
      `silent notch normal velocity at ${sample}`);
    if (phase < geometry.silentMiddle
      && state.wheelAngularSpeed > 1e-8) positiveRecoilRates += 1;
    if (phase > geometry.silentMiddle
      && state.wheelAngularSpeed < -1e-8) returningRecoilRates += 1;
  }
  assert.ok(silentSamples > 1050);
  assert.ok(positiveRecoilRates > 500);
  assert.ok(returningRecoilRates > 500);
  vectorNear(canonicalStates.silentStart.activeLockingToothPoint,
    lockPoint, 2e-15, 'silent beat begins at same lock point');
  vectorNear(canonicalStates.silentEnd.activeLockingToothPoint,
    lockPoint, 2e-15, 'silent beat returns same tooth to lock');
  disposeModel(model.root);
});

test('movement 293 advances exactly one clockwise tooth per full balance oscillation', () => {
  const model = createMovementModel(catalog.movements[292]);
  const {
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  near(transmission.oscillationAdvance, geometry.toothPitch, 0,
    'one tooth per oscillation');

  for (const time of [0.17, 0.82, 1.04, 1.47, 2.88, 3.39]) {
    const state = stateAtTime(time);
    const next = stateAtTime(time + geometry.balancePeriod);
    near(next.balanceAngle, state.balanceAngle, 9e-16,
      `balance closure at ${time}`);
    near(next.wheelAngle - state.wheelAngle,
      -geometry.toothPitch, 9e-16,
    `clockwise tooth advance at ${time}`);
    assert.equal(next.activeImpulsePinIndex,
      (state.activeImpulsePinIndex + 1) % geometry.toothCount);
    assert.equal(next.lockingToothIndex,
      (state.lockingToothIndex + 1) % geometry.toothCount);
  }

  const beforeStep = stateAtTime(geometry.releaseStart
    * geometry.balancePeriod).wheelAngle;
  const landed = stateAtTime(geometry.landing
    * geometry.balancePeriod).wheelAngle;
  near(landed - beforeStep, -geometry.toothPitch, 4e-16,
    'powered step and drop total one tooth');
  const silentStartAngle = stateAtTime(geometry.silentStart
    * geometry.balancePeriod).wheelAngle;
  const silentEndAngle = stateAtTime(geometry.silentEnd
    * geometry.balancePeriod).wheelAngle;
  near(silentEndAngle, silentStartAngle, 3e-16,
    'silent beat has zero net escape');
  disposeModel(model.root);
});

test('movement 293 analytic balance and wheel rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[292]);
  const { stateAtTime } = model.root.userData;
  const epsilon = 1e-5;

  for (const time of [0.4, 0.84, 0.88, 0.96, 1.04, 1.18, 1.4,
    2.4, 2.88, 3, 3.12, 3.4]) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near((after.balanceAngle - before.balanceAngle) / (2 * epsilon),
      state.balanceAngularSpeed, 8e-10,
    `balance speed at ${time}`);
    near((after.balanceAngularSpeed - before.balanceAngularSpeed)
        / (2 * epsilon),
    state.balanceAngularAcceleration, 2e-9,
    `balance acceleration at ${time}`);
    near((after.wheelAngle - before.wheelAngle) / (2 * epsilon),
      state.wheelAngularSpeed, 5e-9,
    `wheel speed at ${time}`);
    near((after.wheelAngularSpeed - before.wheelAngularSpeed)
        / (2 * epsilon),
    state.wheelAngularAcceleration, 8e-8,
    `wheel acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 293 renderer binds both axial systems, both beats, cycle, and next draft', () => {
  const model = createMovementModel(catalog.movements[292]);
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

  for (const phase of [0.10, 0.215, 0.25, 0.30, 0.50, 0.72,
    0.75, 0.78, 0.90]) {
    const time = phase * geometry.balancePeriod;
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.balance.rotation.z, expected.balanceAngle, 0,
      `rendered balance at ${phase}`);
    near(blocks.wheelRotor.rotation.z, expected.wheelAngle, 0,
      `rendered duplex wheel at ${phase}`);
    assert.equal(model.root.userData.contacts.mode,
      expected.contactMode);
    assert.equal(model.root.userData.contacts.activeLockingToothIndex,
      expected.lockingToothIndex);
    assert.equal(model.root.userData.contacts.activeImpulsePinIndex,
      expected.activeImpulsePinIndex);
    assert.equal(blocks.lockContactMarker.visible,
      expected.contactActive
        && expected.contactMode !== 'crown-pin-impulse');
    assert.equal(blocks.impulseContactMarker.visible,
      expected.contactMode === 'crown-pin-impulse');
    if (expected.contactActive) {
      near(model.root.userData.contacts.pointError, 0, 2e-15,
        `rendered contact closure at ${phase}`);
    }
  }

  model.update(0.73);
  const startBalanceAngle = blocks.balance.rotation.z;
  const startWheelAngle = blocks.wheelRotor.rotation.z;
  model.update(0.73 + geometry.balancePeriod);
  near(blocks.balance.rotation.z, startBalanceAngle, 8e-16,
    'rendered balance closure');
  near(blocks.wheelRotor.rotation.z - startWheelAngle,
    -geometry.toothPitch, 9e-16,
  'rendered one-tooth advance');

  const movement507 = catalog.movements[506];
  const model294 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model294.root.userData.fidelity, 'authored');
  disposeModel(model294.root);
  disposeModel(model.root);
});
