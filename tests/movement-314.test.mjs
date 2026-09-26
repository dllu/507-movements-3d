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

function disposeModel(root) {
  root.traverse((object) => {
    object.geometry?.dispose();
    for (const material of [].concat(object.material ?? [])) material.dispose();
  });
}

const create = () => createMovementModel(catalog.movements[313]);

test('movement 314 is Brown’s thirteen-tooth lever chronometer in flat parts', () => {
  const movement = catalog.movements[313];
  const model = create();
  const { archetype, blocks, fidelity, mechanism, transmission, geometry } = model.root.userData;

  assert.equal(movement.id, 314);
  assert.equal(movement.title, 'Lever chronometer escapement');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype, movement.archetype);
  assert.match(archetype, /^thirteen-tooth-single-impulse-lever-chronometer/);
  assert.match(mechanism, /13-tooth clockwise escape wheel/);
  assert.match(mechanism, /pallets A and B on a crescent/);
  assert.match(mechanism, /short unpowered transfer back to A/);

  // Brown's plate: thirteen tips 27.7 degrees apart (circle fit to the free
  // tips, centre (176, 275), radius 176 px).
  assert.equal(transmission.toothCount, 13);
  assert.equal(geometry.toothCount, 13);
  assert.equal(transmission.leverPalletImpulseFaceCount, 0);
  assert.equal(transmission.balanceMountedImpulsePalletCount, 1);
  assert.equal(blocks.wheelPlate.parent, blocks.wheelRotor);
  assert.equal(blocks.crescent.parent, blocks.palletLever);
  assert.equal(blocks.leverBody.parent, blocks.palletLever);
  assert.equal(blocks.directPalletC.parent, blocks.balance);
  assert.equal(blocks.balancePin.parent, blocks.balance);
  assert.equal(blocks.balanceDisc.parent, blocks.balance);

  // One mesh per part; no witness marks, face highlights or front brackets.
  const roles = [];
  model.root.traverse((object) => { if (object.isMesh) roles.push(object.userData.role ?? ''); });
  assert.equal(roles.filter((role) => /marker|witness|index|working-face|cock|stand/.test(role)).length, 0);
  assert.equal(roles.filter((role) => /tooth/.test(role) && !/wheel-plate$/.test(role)).length, 0, 'teeth are part of the wheel plate');
  disposeModel(model.root);
});

test('movement 314 follows the plate: lever arbor on the crescent, pin, balance and A', () => {
  const model = create();
  const { geometry, sourcePointToModel, sourceReference, stateAtTime, canonicalTimes } = model.root.userData;
  const plate = sourceReference.brownPlate314;
  assert.equal(plate.visibleWheelToothCount, 13);
  near(sourcePointToModel(plate.rasterLeverPivot).distanceTo(geometry.leverPivot), 0, 1e-12, 'lever arbor');
  near(sourcePointToModel(plate.rasterBalanceCenter).distanceTo(geometry.balanceCenter), 0, 1e-12, 'balance');
  near(plate.rasterWheelOuterRadius * geometry.sourceScale, geometry.wheelToothTipRadius, 1e-12, 'tip radius');
  // The lever arbor is the large circle on the crescent, below the balance
  // on the same vertical.
  assert.ok(Math.abs(plate.rasterLeverPivot.x - plate.rasterBalanceCenter.x) < 2);
  assert.ok(plate.rasterLeverPivot.y > 350);
  // Time 0 is the plate's pose: balance near its middle, A still locking the
  // tooth Brown draws under it.
  const start = stateAtTime(0);
  near(start.balanceAngle, 0, 1e-12, 'balance at the plate pose');
  assert.equal(start.lockingPallet, 'A');
  assert.ok(start.lockingToothPoint.distanceTo(sourcePointToModel(plate.rasterPalletA))
    <= plate.measurementUncertaintyPixels * geometry.sourceScale);
  // The impulse tooth is the one Brown draws at C.
  const tooth = model.root.userData.toothTipPoint(start.wheelAngle, 2);
  assert.ok(tooth.distanceTo(sourcePointToModel(plate.rasterImpulseStartC))
    <= 2 * plate.measurementUncertaintyPixels * geometry.sourceScale);
  assert.ok(canonicalTimes.impulseCatch > canonicalTimes.aRelease);
  disposeModel(model.root);
});

test('movement 314 locks on A and B without advance or recoil', () => {
  const model = create();
  const { geometry, palletLockPoints, stateAtTime } = model.root.userData;
  const counts = { A: 0, B: 0 };
  for (const name of ['A', 'B']) {
    const points = palletLockPoints(name, 41);
    // Each face is an arc about the lever arbor.
    const radius = points[0].length();
    for (const p of points) near(p.length(), radius, 1e-12, `${name} face concentric with the arbor`);
    assert.ok(points[0].distanceTo(points.at(-1)) > 0.1, `${name} has a finite lock`);
  }
  for (let i = 0; i <= 8000; i += 1) {
    const state = stateAtTime(geometry.balancePeriod * i / 8000);
    if (!state.lockingContactActive) continue;
    counts[state.lockingContact.pallet] += 1;
    near(state.wheelAngularSpeed, 0, 0, 'wheel stopped while locked');
    near(state.lockingContact.pointError, 0, 1e-12, 'tip on the face');
    near(state.lockingContact.normalVelocityError, 0, 1e-9, 'no normal slip');
  }
  assert.ok(counts.A > 2000 && counts.B > 2000);
  disposeModel(model.root);
});

test('movement 314 wheel drops onto the straight blade C and drives it', () => {
  const model = create();
  const { geometry, stateAtTime, canonicalTimes } = model.root.userData;
  let samples = 0;
  for (let i = 0; i <= 8000; i += 1) {
    const state = stateAtTime(geometry.balancePeriod * i / 8000);
    if (!state.directImpulseActive) continue;
    samples += 1;
    const c = state.directImpulseContact;
    near(c.pointError, 0, 1e-9, 'tooth tip on C’s straight face');
    assert.ok(c.bladeS >= 0 && c.bladeS <= geometry.cBladeEndS + 1e-9, 'contact on the blade');
    near(c.normalVelocityError, 0, 1e-6, 'matched normal speed');
    assert.ok(c.pushesForward, 'the tooth pushes C, not the reverse');
    assert.ok(state.balanceAngularSpeed > 0 && state.wheelAngularSpeed < 0);
  }
  assert.ok(samples > 150);
  // The freed wheel only accelerates, so it must be moving faster than C to
  // catch it: the catch is a strike that slows the wheel to C's speed. At
  // slide-off the wheel keeps its speed.
  {
    const t = canonicalTimes.impulseCatch;
    const before = stateAtTime(t - 1e-7);
    const after = stateAtTime(t + 1e-7);
    assert.ok(before.wheelAngularSpeed < after.wheelAngularSpeed - 0.1, 'the wheel strikes C faster than C moves');
    assert.ok(after.wheelAngularSpeed < 0, 'and then drives it');
    const drop = [];
    for (let i = 1; i < 50; i += 1) drop.push(stateAtTime(canonicalTimes.aRelease + (t - canonicalTimes.aRelease) * i / 50));
    for (let i = 1; i < drop.length; i += 1) {
      assert.ok(drop[i].wheelAngularSpeed < drop[i - 1].wheelAngularSpeed, 'the free wheel never slows before it meets C');
    }
  }
  {
    const t = canonicalTimes.impulseEnd;
    near(stateAtTime(t - 1e-7).wheelAngularSpeed, stateAtTime(t + 1e-7).wheelAngularSpeed, 2e-3, 'slide-off speed continuity');
  }
  // C is as long as the locked teeth allow it to pass back between them
  // (Brown draws about 1.70-1.74; from about 1.68 no wheel phase clears).
  assert.ok(geometry.cReachRadius >= 1.6 && geometry.cReachRadius < 1.68);
  disposeModel(model.root);
});

test('movement 314 advances one pitch per oscillation, long then short, never recoiling', () => {
  const model = create();
  const { geometry, stateAtTime, transmission } = model.root.userData;
  near(transmission.longImpulseAdvance + transmission.shortReturnAdvance, geometry.toothPitch, 1e-15, 'one pitch');
  assert.ok(transmission.shortReturnAdvance < transmission.longImpulseAdvance / 2);
  for (const t of [0.17, 0.82, 1.03, 1.74, 2.91, 3.43]) {
    near(stateAtTime(t + geometry.balancePeriod).wheelAngle - stateAtTime(t).wheelAngle,
      -geometry.toothPitch, 1e-12, `pitch closure at ${t}`);
    near(stateAtTime(t + geometry.balancePeriod).leverAngle, stateAtTime(t).leverAngle, 1e-12, 'lever closure');
  }
  // Free motion is smooth; the speed changes abruptly only at the three
  // strikes (on C, on B and on A), and a strike only ever slows the wheel.
  const { canonicalTimes } = model.root.userData;
  const strikes = [canonicalTimes.impulseCatch, canonicalTimes.bLanding, canonicalTimes.aRelock];
  let previous = stateAtTime(0).wheelAngle;
  let previousSpeed = stateAtTime(0).wheelAngularSpeed;
  let struck = 0;
  for (let i = 1; i <= 20000; i += 1) {
    const time = geometry.balancePeriod * i / 20000;
    const state = stateAtTime(time);
    assert.ok(state.wheelAngle <= previous + 1e-12, `no recoil at ${i}`);
    const step = geometry.balancePeriod / 20000;
    if (strikes.some((t) => t > time - step + 1e-12 && t <= time + 1e-12)) {
      assert.ok(Math.abs(state.wheelAngularSpeed) < Math.abs(previousSpeed), `a strike slows the wheel at ${i}`);
      struck += 1;
    } else {
      assert.ok(Math.abs(state.wheelAngularSpeed - previousSpeed) < 0.05, `smooth wheel speed at ${i}`);
    }
    previous = state.wheelAngle;
    previousSpeed = state.wheelAngularSpeed;
  }
  assert.equal(struck, 3);
  disposeModel(model.root);
});

test('movement 314 roller pin turns the lever through the fork and banks it', () => {
  const model = create();
  const { geometry, stateAtTime, forkTineFacePoints } = model.root.userData;
  near(Math.abs(stateAtTime(0).leverAngle), 0, 0.02, 'lever near mid-throw in the plate pose');
  const acting = forkTineFacePoints(1, 61);
  const returning = forkTineFacePoints(-1, 61);
  for (let i = 0; i < acting.length; i += 1) {
    near(acting[i].distanceTo(returning.at(-1 - i)), 2 * geometry.balancePinRadius, 1e-12, 'fork gap = pin diameter');
  }
  let engaged = 0;
  for (let i = 0; i <= 4000; i += 1) {
    const state = stateAtTime(geometry.balancePeriod * i / 4000);
    if (!state.forkPinContactActive) {
      near(Math.abs(state.leverAngle), geometry.leverAmplitude, 1e-12, 'lever banked while detached');
      continue;
    }
    engaged += 1;
    near(state.forkPinContact.pointError, 0, 1e-9, 'fork contact');
    near(state.forkPinContact.normalVelocityError, 0, 1e-6, 'fork normal speed');
  }
  assert.ok(engaged > 1000);
  disposeModel(model.root);
});

test('movement 314 renderer follows the analytic state and leaves 507 authored', () => {
  const model = create();
  const { animationTiming, blocks, stateAtTime } = model.root.userData;
  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assertReadableTiming(animationTiming);
  for (const time of [0, 0.4, 0.9, 1.3, 2.4, 3.1]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.balance.rotation.z, expected.balanceAngle, 0, 'balance');
    near(blocks.palletLever.rotation.z, expected.leverAngle, 0, 'lever');
    near(blocks.wheelRotor.rotation.z, expected.wheelAngle, 0, 'wheel');
  }
  const model507 = createMovementModel(catalog.movements[506]);
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
