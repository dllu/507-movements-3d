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

function nearVector(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function rotate2(point, angle) {
  return point.clone().rotateAround(new THREE.Vector2(0, 0), angle);
}

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 396 is Reed’s one escape wheel, one balance, and opposite-side crooked lever with all named pallets', () => {
  const movement = catalog.movements[395];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 396);
  assert.equal(movement.number, '396');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(
    movement.archetype,
    'reed-hybrid-lever-and-chronometer-escapement-with-alternating-indirect-and-direct-impulse',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /wheel-A/);
  assert.match(data.mechanism, /lever-pallet-g/);
  assert.match(data.mechanism, /chronometer-pallet-j/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 1);
  assert.match(degreesOfFreedom.inputs[0], /balance-wheel vibration/);
  assert.ok(blocks.escapeWheel.parent === model.root, 'blocks.escapeWheel parent');
  assert.ok(blocks.balance.parent === model.root, 'blocks.balance parent');
  assert.ok(blocks.lever.parent === model.root, 'blocks.lever parent');
  assert.ok(blocks.fixedFrame.parent === model.root, 'blocks.fixedFrame parent');
  assert.ok(blocks.palletF.parent === blocks.lever, 'blocks.palletF parent');
  assert.ok(blocks.palletG.parent === blocks.lever, 'blocks.palletG parent');
  assert.ok(blocks.roller.parent === blocks.balance, 'blocks.roller parent');
  assert.ok(blocks.rollerPin.parent === blocks.balance, 'blocks.rollerPin parent');
  assert.ok(blocks.chronometerPalletJ.parent === blocks.balance, 'blocks.chronometerPalletJ parent');
  assert.equal(blocks.bankingPins.length, 2);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'clockwise-stepping-escape-wheel-A',
    'escape-wheel-spindle-a',
    'oscillating-balance-B-with-roller-h-pin-i-and-direct-pallet-j',
    'balance-staff-b',
    'balance-roller-h',
    'roller-impulse-pin-i',
    'chronometer-impulse-pallet-j-with-its-arm-on-balance-staff',
    'pivoted-crooked-lever-C-with-anchor-crosspiece-h',
    'lever-C-one-plate-with-fork-e-crook-d-and-tail',
    'one-piece-anchor-cross-piece-h-with-pallets-g-and-f',
    'lever-guard-pin-k-against-balance-roller-h',
    'fixed-banking-pin-l',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 396 identifies Brown’s static plate and Reed patent US31999A as the operating source', () => {
  const movement = catalog.movements[395];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate396;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_396.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /G\. P\. Reed.*patent anchor and lever/);
  assert.match(movement.description, /whole impulse.*one direction.*lever/);
  assert.match(movement.description, /opposite direction.*directly/);
  assert.match(movement.description, /locking and unlocking.*once/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /US31999A/);
  assert.equal(sourceReference.patent.number, 'US31999A');
  assert.equal(sourceReference.patent.date, '1861-04-09');
  assert.match(sourceReference.patent.inventor, /George P\. Reed/);
  assert.equal(
    sourceReference.patent.url,
    'https://patents.google.com/patent/US31999A/en',
  );
  assert.deepEqual(Object.keys(evidence.patentElements), [
    'A', 'B', 'C', 'f', 'g', 'h', 'i', 'j', 'k', 'l',
  ]);
  assert.match(evidence.patentSequence, /g unlock.*f lock/);
  assert.match(evidence.patentSequence, /f unlock.*direct impulse.*g lock/);
  assert.match(evidence.reconstructionDisclosure, /Twelve teeth/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.escapeWheelApproximateCenterPixels, [335, 273]);
  assert.deepEqual(plate.balanceApproximateCenterPixels, [169, 275]);
  assert.deepEqual(plate.leverStaffApproximatePixels, [446, 276]);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  disposeModel(model.root);
});

test('movement 396 retains its nominal point-lock construction separately from the finite playback', () => {
  const model = createMovementModel(catalog.movements[395]);
  const data = model.root.userData;
  const { constraintResiduals, geometry } = data;

  for (const [name, residual] of Object.entries(constraintResiduals)) {
    near(residual, 0, 3e-16, name);
  }
  near(geometry.toothPitch, Math.PI * 2 / geometry.toothCount,
    0, 'escape-wheel angular pitch');
  assert.equal(geometry.toothCount, 12);
  near(geometry.wheelAdvancePerHalfBeat, geometry.toothPitch / 2,
    0, 'half-pitch release');
  near(geometry.wheelAdvancePerBalanceCycle, geometry.toothPitch,
    0, 'one pitch per balance cycle');
  near(geometry.contactGAtNegativeBank.length(),
    geometry.wheelToothTipRadius, 3e-16, 'g lock radius');
  near(geometry.contactFAtPositiveBank.length(),
    geometry.wheelToothTipRadius, 3e-16, 'f lock radius');
  nearVector(
    geometry.leverPivot.clone().add(rotate2(
      geometry.palletGLocal,
      -geometry.leverAmplitude,
    )),
    geometry.contactGAtNegativeBank,
    3e-16,
    'g negative-bank construction',
  );
  nearVector(
    geometry.leverPivot.clone().add(rotate2(
      geometry.palletFLocal,
      geometry.leverAmplitude,
    )),
    geometry.contactFAtPositiveBank,
    3e-16,
    'f positive-bank construction',
  );
  assert.ok(geometry.balanceCenter.x < -geometry.wheelToothTipRadius);
  assert.ok(geometry.leverPivot.x > geometry.wheelToothTipRadius);
  disposeModel(model.root);
});

test('movement 396 follows patent figures 1-3: g unlocks, supports the lever impulse, and f catches', () => {
  const model = createMovementModel(catalog.movements[395]);
  const data = model.root.userData;
  const { stateAtTime, timeline, transmission } = data;
  const sample = (halfPhase) => stateAtTime(
    timeline.balancePeriod * halfPhase / 2,
  );
  const before = sample(0.20);
  // The fork pin, not a timetable, now decides when g unlocks.
  const impulse = Array.from({length: 2000}, (_, i) => sample(i / 2000)).find((s) => s.leverImpulseActive);
  const after = sample(0.80);
  assert.ok(impulse, 'a lever impulse occurs');

  assert.equal(before.halfBeatIndex, 0);
  assert.equal(before.activeLockPallet, 'g');
  assert.equal(before.scheduledImpulseType, 'lever-transmitted');
  assert.equal(impulse.impulseType,
    'lever-transmitted-impulse-through-g-C-e-i');
  assert.equal(impulse.leverImpulseActive, true);
  assert.equal(impulse.directImpulseActive, false);
  assert.deepEqual(impulse.forcePath, [
    'escape-wheel-A-tooth',
    'lever-impulse-pallet-g',
    'crooked-lever-C-and-fork-e',
    'roller-pin-i',
    'balance-B',
  ]);
  assert.equal(after.activeLockPallet, 'f');
  assert.equal(after.unlockedOnceThisHalfBeat, true);
  assert.equal(after.relockedOnceThisHalfBeat, true);
  assert.match(transmission.lockSequence,
    /g -> impulse through lever -> f/);
  disposeModel(model.root);
});

test('movement 396 follows patent figures 3-4-1: f unlocks, j receives direct impulse, and g catches', () => {
  const model = createMovementModel(catalog.movements[395]);
  const data = model.root.userData;
  const { stateAtTime, timeline, transmission } = data;
  const sample = (halfPhase) => stateAtTime(
    timeline.balancePeriod * (1 + halfPhase) / 2,
  );
  const before = sample(0.20);
  const impulse = Array.from({length: 4000}, (_, i) => sample(i / 4000)).find((s) => s.directImpulseActive);
  const after = sample(0.90);
  assert.ok(impulse, 'a direct impulse occurs');

  assert.equal(before.halfBeatIndex, 1);
  assert.equal(before.activeLockPallet, 'f');
  assert.equal(before.scheduledImpulseType, 'direct-chronometer-pallet');
  assert.equal(impulse.impulseType, 'direct-chronometer-impulse-to-j');
  assert.equal(impulse.leverImpulseActive, false);
  assert.equal(impulse.directImpulseActive, true);
  assert.deepEqual(impulse.forcePath, [
    'escape-wheel-A-tooth',
    'chronometer-impulse-pallet-j',
    'balance-B',
  ]);
  assert.ok(!impulse.forcePath.some((element) => /lever-C/.test(element)));
  assert.equal(after.activeLockPallet, 'g');
  assert.equal(after.unlockedOnceThisHalfBeat, true);
  assert.equal(after.relockedOnceThisHalfBeat, true);
  assert.match(transmission.lockSequence, /direct impulse -> g/);
  disposeModel(model.root);
});

test('movement 396 permits exactly one impulse path at a time and exactly one unlock/relock sequence per half-beat', () => {
  const model = createMovementModel(catalog.movements[395]);
  const data = model.root.userData;
  const { stateAtTime, timeline } = data;
  let previousHalfBeat = null;
  let impulseEntries = 0;
  let previousImpulseActive = false;
  const entriesByHalfBeat = new Map();

  for (let sample = -30000; sample <= 30000; sample += 1) {
    const state = stateAtTime(
      timeline.balancePeriod * sample / 12000,
    );
    assert.equal(
      Number(state.leverImpulseActive) + Number(state.directImpulseActive),
      Number(state.impulseActive),
    );
    if (state.impulseActive) {
      assert.equal(state.activeLockPallet, null);
      assert.ok(state.wheelAngularSpeed < 0);
    } else if (state.stableLock) {
      assert.ok(state.activeLockPallet === 'f'
        || state.activeLockPallet === 'g');
      near(state.wheelAngularSpeed, 0, 1e-8, 'locked wheel speed');
    }
    if (state.halfBeatIndex !== previousHalfBeat) {
      previousHalfBeat = state.halfBeatIndex;
      previousImpulseActive = false;
    }
    if (state.impulseActive && !previousImpulseActive) {
      impulseEntries += 1;
      entriesByHalfBeat.set(
        state.halfBeatIndex,
        (entriesByHalfBeat.get(state.halfBeatIndex) ?? 0) + 1,
      );
    }
    previousImpulseActive = state.impulseActive;
  }
  assert.ok(impulseEntries >= 10);
  for (const entries of entriesByHalfBeat.values()) assert.equal(entries, 1);
  disposeModel(model.root);
});

test('movement 396 escape wheel advances clockwise half a pitch per impulse and one full pitch per balance cycle', () => {
  const model = createMovementModel(catalog.movements[395]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  let previousAngle = Infinity;

  for (let sample = -24000; sample <= 48000; sample += 1) {
    const state = stateAtTime(
      timeline.balancePeriod * sample / 24000,
    );
    assert.ok(state.wheelAngle <= previousAngle + 3e-15);
    assert.ok(state.wheelAngularSpeed <= 1e-15);
    previousAngle = state.wheelAngle;
  }
  for (const halfIndex of Array.from({ length: 25 }, (_, index) => index - 12)) {
    const start = stateAtTime(
      geometry.halfBeatDuration * (halfIndex + 0.137),
    );
    const next = stateAtTime(
      geometry.halfBeatDuration * (halfIndex + 1.137),
    );
    // g's lock rest is exact; f's locking arc is sampled at 480 chords, so
    // f's rest differs from the exact half pitch by under 1e-8 rad.
    near(next.wheelAngle - start.wheelAngle,
      -geometry.wheelAdvancePerHalfBeat, 1e-8,
      'one half-pitch per impulse');
  }
  for (const cycle of Array.from({ length: 19 }, (_, index) => index - 9)) {
    const start = stateAtTime(
      timeline.balancePeriod * (cycle + 0.271),
    );
    const end = stateAtTime(
      timeline.balancePeriod * (cycle + 1.271),
    );
    near(end.wheelAngle - start.wheelAngle,
      -geometry.toothPitch, 6e-15,
      'one full tooth pitch per balance cycle');
  }
  disposeModel(model.root);
});

test('movement 396 reports finite stable locks and keeps balance and lever motion continuous and periodic', () => {
  const model = createMovementModel(catalog.movements[395]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  for (const time of [0, 1.6, 2.4, 3.8, 4.4]) {
    const state=stateAtTime(time);
    assert.equal(state.lockContact.stable,true);
    assert.ok(['f','g'].includes(state.activeLockPallet));
    assert.equal(state.lockContact.pointCoincidenceError,null);
  }
  for (const phase of [-3.17, -0.29, 0.13, 0.71, 2.42]) {
    const start = stateAtTime(timeline.balancePeriod * phase);
    const end = stateAtTime(timeline.balancePeriod * (phase + 1));
    near(end.balanceAngle, start.balanceAngle, 3e-15,
      'balance angle period closure');
    near(end.balanceAngularSpeed, start.balanceAngularSpeed, 8e-15,
      'balance speed period closure');
    near(end.leverAngle, start.leverAngle, 3e-15,
      'lever angle period closure');
    near(end.wheelAngle - start.wheelAngle,
      -geometry.toothPitch, 3e-15, 'wheel cycle phase closure');
  }
  for (const boundary of [0, 1, 2, -1]) {
    const time = boundary * geometry.halfBeatDuration;
    const before = stateAtTime(time - 1e-9);
    const at = stateAtTime(time);
    near(before.balanceAngle, at.balanceAngle, 1e-9,
      'balance half-beat continuity');
    near(before.leverAngle, at.leverAngle, 1e-12,
      'lever half-beat continuity');
    near(before.wheelAngle, at.wheelAngle, 1e-12,
      'wheel half-beat continuity');
  }
  disposeModel(model.root);
});

test('movement 396 update binds all three rotors and reports the correct exclusive impulse or lock contact', () => {
  const model = createMovementModel(catalog.movements[395]);
  const data = model.root.userData;
  const { blocks, stateAtTime, timeline } = data;

  for (const halfCoordinate of [0.20, 0.50, 0.80, 1.20, 1.50, 1.80]) {
    const time = timeline.balancePeriod * halfCoordinate / 2;
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.escapeWheel.rotation.z, expected.wheelAngle, 0,
      'rendered escape-wheel angle');
    near(blocks.balance.rotation.z, expected.balanceAngle, 0,
      'rendered balance angle');
    near(blocks.lever.rotation.z, expected.leverAngle, 0,
      'rendered lever angle');
    assert.equal(data.contacts.leverImpulseG.active,
      expected.leverImpulseActive);
    assert.equal(data.contacts.directChronometerImpulseJ.active,
      expected.directImpulseActive);
    assert.equal(data.contacts.wheelLock.active,
      expected.activeLockPallet !== null);
    assert.equal(data.contacts.wheelLock.pallet,
      expected.activeLockPallet);
    assert.ok(
      Number(data.contacts.leverImpulseG.active)
        + Number(data.contacts.directChronometerImpulseJ.active)
        + Number(data.contacts.wheelLock.active) <= 1,
    );
    near(blocks.palletG.parent.rotation.z, expected.leverAngle, 0,
      'pallet g inherits lever rotation');
    near(blocks.chronometerPalletJ.parent.rotation.z,
      expected.balanceAngle, 0,
      'pallet j inherits balance rotation');
  }
  disposeModel(model.root);
});

test('movement 396 factory is isolated before movement 507', () => {
  const model396 = createMovementModel(catalog.movements[395]);
  const model507 = createMovementModel(catalog.movements[506]);
  assert.equal(model396.root.userData.fidelity, 'authored');
  assert.equal(
    model396.root.userData.archetype,
    'reed-hybrid-lever-and-chronometer-escapement-with-alternating-indirect-and-direct-impulse',
  );
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(catalog.movements[506].fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model396.root);
  disposeModel(model507.root);
});
