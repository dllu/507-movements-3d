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
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
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

test('movement 308 is Airy’s single-pallet detached pendulum escapement with independent Q and pendulum click C', () => {
  const movement = catalog.movements[307];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    presentation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 308);
  assert.equal(movement.number, '308');
  assert.equal(movement.title,
    'Airy single-beat detached pendulum escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'airy-sixty-pin-single-pallet-spring-detent-alternate-vibration-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /independent lever Q normally locks/);
  assert.match(mechanism, /pendulum-mounted one-way click C lifts Q/);
  assert.match(mechanism, /sole pallet I/);
  assert.match(mechanism, /rest of both vibrations detached/);
  assert.match(presentation, /distinct wheel, detent, click, and pallet/);
  assert.equal(transmission.impulsesPerPendulumCycle, 1);
  assert.deepEqual(transmission.impulsesPerVibration, [1, 0]);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.detentAssembly.parent, model.root);
  assert.equal(blocks.pendulumAssembly.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.clickAssembly.parent, blocks.pendulumAssembly);
  assert.equal(blocks.palletI.parent, blocks.pendulumAssembly);
  assert.equal(blocks.pendulumRod.parent, blocks.pendulumAssembly);
  assert.equal(blocks.detentCatch.parent, blocks.detentAssembly);
  assert.equal(blocks.detentRail.parent, blocks.detentAssembly);
  assert.equal(blocks.wheelPins.length, 60);
  assert.equal(blocks.spokeMeshes.length, 3);
  assert.equal(blocks.clickBankingPins.length, 2);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'perpendicular-escape-wheel-pin').length, 60);
  assert.equal(roles.filter((role) =>
    role === 'single-generated-impulse-pallet-I').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'independent-locking-lever-Q').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'pendulum-mounted-pivoting-click-C').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 308 records Brown’s Q/C/I elevation, Airy’s original paper, Beckett figure 19, and Greenwich service', () => {
  const movement = catalog.movements[307];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate308;
  const airy = sourceReference.airyOriginalPaper;
  const beckett = sourceReference.beckettConstructionReference;
  const greenwich = sourceReference.greenwichClockReference;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.match(sourceAnimation.referenceScope, /Q\/C\/I topology/);
  assert.match(sourceAnimation.referenceScope, /sixty perpendicular pins/);
  assert.match(sourceAnimation.referenceScope, /one impulse in two vibrations/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_308.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterWheelCenter,
    new THREE.Vector2(236, 219));
  assert.deepEqual(plate.rasterWheelTop,
    new THREE.Vector2(252, 154));
  assert.deepEqual(plate.rasterDetentPivotQ,
    new THREE.Vector2(304, 158));
  assert.deepEqual(plate.rasterClickPivotC,
    new THREE.Vector2(240, 354));
  assert.deepEqual(plate.rasterPalletI,
    new THREE.Vector2(281, 278));
  assert.deepEqual(plate.rasterDirectionArrow, {
    end: new THREE.Vector2(218, 404),
    start: new THREE.Vector2(338, 404),
  });
  assert.match(plate.inferredTopology, /one pendulum P/);
  assert.match(plate.inferredTopology, /independently pivoted lever Q/);
  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 0, 'source wheel center');
  near(sourcePointToModel(plate.rasterWheelTop)
    .distanceTo(geometry.wheelCenter),
  geometry.pinOrbitRadius, 1e-15, 'source wheel working radius');
  vectorNear(sourcePointToModel(plate.rasterDetentPivotQ),
    geometry.detentPivot, 0, 'source Q pivot');
  vectorNear(sourcePointToModel(plate.rasterClickPivotC),
    geometry.clickPivotAtRest, 0, 'source C pivot');

  assert.equal(airy.author, 'George Biddell Airy');
  assert.equal(airy.publicationYear, 1830);
  assert.equal(airy.publicationVolume, 3);
  assert.equal(airy.publicationPart, 1);
  assert.equal(airy.plate, 2);
  assert.deepEqual(airy.pages, [105, 128]);
  assert.equal(airy.readDate, '1826-11-26');
  assert.match(airy.paper, /Theory of Escapements/);
  assert.match(airy.construction, /sixty pins perpendicular/);
  assert.match(airy.construction, /FG the spring detent/);
  assert.match(airy.construction, /KL the very weak one-way passing spring/);
  assert.match(airy.result, /one impulse in two vibrations/);
  assert.match(airy.url, /circuitousroot\.com/);
  assert.equal(beckett.figure, 19);
  assert.equal(beckett.page, 73);
  assert.equal(beckett.publicationEdition, 8);
  assert.equal(beckett.publicationYear, 1903);
  assert.match(beckett.operatingEvidence, /single pallet CP/);
  assert.match(beckett.operatingEvidence, /thirty pounds/);
  assert.equal(greenwich.completed, 1871);
  assert.equal(greenwich.maker, 'E. Dent & Co.');
  assert.match(greenwich.operation, /alternate vibration/);
  assert.match(greenwich.operation, /alternate seconds/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 308 uses sixty equally spaced axial pins and advances one clockwise pin pitch per full pendulum cycle', () => {
  const model = createMovementModel(catalog.movements[307]);
  const {
    blocks,
    geometry,
    pinCenterAt,
    stateAtTime,
    transmission,
  } = model.root.userData;

  assert.equal(geometry.pinCount, 60);
  near(geometry.pinPitch, FULL_TURN / 60, 1e-15,
    'sixty-pin pitch');
  near(geometry.wheelAdvancePerCycle, geometry.pinPitch, 0,
    'one pitch per cycle');
  near(geometry.detentLockAngle - geometry.impulseContactStartAngle,
    geometry.lockPinOffset * geometry.pinPitch, 1e-15,
    'twelve-pin separation between impulse and lock stations');
  assert.equal(transmission.pinCount, 60);
  assert.equal(transmission.wheelCyclesPerRevolution, 60);
  near(transmission.wheelAdvancePerCycleRadians,
    geometry.pinPitch, 0, 'published pitch advance');

  for (const [index, pin] of blocks.wheelPins.entries()) {
    assert.equal(pin.userData.index, index);
    assert.equal(pin.parent, blocks.wheelRotor);
    near(Math.hypot(pin.position.x, pin.position.y),
      geometry.pinOrbitRadius, 1e-14, `pin ${index} orbit`);
    near(pin.position.z, geometry.pinCenterZ, 0,
      `pin ${index} axial center`);
  }
  const indices = [];
  for (let cycle = -2; cycle <= 61; cycle += 1) {
    const start = stateAtTime(cycle * geometry.pendulumPeriod);
    const end = stateAtTime((cycle + 1) * geometry.pendulumPeriod);
    near(end.wheelAngle - start.wheelAngle,
      -geometry.pinPitch, 1e-12,
      `clockwise one-pitch step in cycle ${cycle}`);
    indices.push(start.impulsePinIndex);
    assert.equal(start.impulsePinIndex,
      positiveModulo(cycle, geometry.pinCount));
    vectorNear(pinCenterAt(
      start.wheelAngle,
      start.startingLockPinIndex,
    ), geometry.fixedDetentLockPoint, 2e-14,
    `starting lock pin ${cycle}`);
  }
  assert.deepEqual(indices.slice(2, 7), [0, 1, 2, 3, 4]);
  const start = stateAtTime(0);
  const closure = stateAtTime(60 * geometry.pendulumPeriod);
  near(closure.wheelAngle - start.wheelAngle,
    -FULL_TURN, 1e-12, 'sixty cycles close one wheel turn');
  disposeModel(model.root);
});

test('movement 308 couples P only for the leftward unlock and impulse and leaves the return vibration detached', () => {
  const model = createMovementModel(catalog.movements[307]);
  const {
    geometry,
    stateAtCyclePhase,
    timeline,
    transmission,
  } = model.root.userData;
  const unlockMiddle = (geometry.unlockStartPhase
    + geometry.impulseStartPhase) / 2;
  const impulseMiddle = (geometry.impulseStartPhase
    + geometry.impulseEndPhase) / 2;
  const bypassMiddle = (geometry.bypassStartPhase
    + geometry.bypassEndPhase) / 2;

  for (const phase of [0.03, 0.12, 0.38, 0.49, 0.55, 0.66, 0.90]) {
    const state = stateAtCyclePhase(phase);
    assert.equal(state.detachedFromEscapeWheel, true,
      `detached at phase ${phase}`);
    assert.equal(state.trainCoupledToPendulum, false,
      `uncoupled at phase ${phase}`);
    assert.equal(state.impulseActive, false);
  }
  const unlock = stateAtCyclePhase(unlockMiddle);
  assert.equal(unlock.unlockActive, true);
  assert.equal(unlock.trainCoupledToPendulum, true);
  assert.equal(unlock.detachedFromEscapeWheel, false);
  assert.ok(unlock.palletAngularSpeed < 0);
  const impulse = stateAtCyclePhase(impulseMiddle);
  assert.equal(impulse.impulseActive, true);
  assert.equal(impulse.impulseDirection, 'leftward');
  assert.equal(impulse.trainCoupledToPendulum, true);
  assert.ok(impulse.palletAngularSpeed < 0);
  const bypass = stateAtCyclePhase(bypassMiddle);
  assert.equal(bypass.bypassActive, true);
  assert.equal(bypass.contactKind, 'one-way-click-bypass');
  assert.equal(bypass.detachedFromEscapeWheel, true);
  assert.equal(bypass.trainCoupledToPendulum, false);
  assert.ok(bypass.palletAngularSpeed > 0);
  assert.match(transmission.detachment, /rightward return/);
  assert.match(transmission.impulseArc, /one degree before center/);
  assert.deepEqual(timeline.schedule, [
    'detached-leftward-approach',
    'C-click-lifts-Q-detent',
    'I-pallet-leftward-impulse',
    'detached-leftward-overswing',
    'detached-rightward-return',
    'C-click-pushed-aside-by-Q',
    'detached-rightward-overswing',
  ]);
  disposeModel(model.root);
});

test('movement 308 Q locks successive wheel pins without recoil throughout every detached arc', () => {
  const model = createMovementModel(catalog.movements[307]);
  const {
    geometry,
    pinCenterAt,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const freePhases = [0.02, 0.10, 0.16, 0.34, 0.44, 0.56, 0.66, 0.72, 0.86, 0.96];

  for (let cycle = 0; cycle < 4; cycle += 1) {
    for (const phase of freePhases) {
      const state = stateAtTime(
        (cycle + phase) * geometry.pendulumPeriod,
      );
      assert.equal(state.detentLocked, true,
        `Q locked at cycle ${cycle}, phase ${phase}`);
      near(state.detentAngle, 0, 0,
        `Q rests at cycle ${cycle}, phase ${phase}`);
      near(state.wheelAngularSpeed, 0, 1e-10,
        `no recoil at cycle ${cycle}, phase ${phase}`);
      vectorNear(state.lockPinPoint,
        geometry.fixedDetentLockPoint, 2e-14,
        `fixed lock station at cycle ${cycle}, phase ${phase}`);
      vectorNear(pinCenterAt(state.wheelAngle, state.activeLockPinIndex),
        state.lockPinPoint, 1e-14,
        `active Q lock pin at cycle ${cycle}, phase ${phase}`);
    }
  }
  near(geometry.detentCatchFacePointAtRest.distanceTo(
    geometry.fixedDetentLockPoint,
  ), geometry.pinRadius, 1e-15,
  'Q catch face touches rather than intersects the pin center');
  near(geometry.detentCatchCenterAtRest.distanceTo(
    geometry.fixedDetentLockPoint,
  ), geometry.pinRadius
    + geometry.detentCatchTangentialThickness / 2, 1e-15,
  'Q catch body is tangentially offset');
  assert.match(transmission.recoil, /none/);
  disposeModel(model.root);
});

test('movement 308 gives one exact symmetric direct impulse through pallet I on each leftward passage', () => {
  const model = createMovementModel(catalog.movements[307]);
  const {
    geometry,
    impulsePallet,
    pinCenterAt,
    stateAtTime,
  } = model.root.userData;

  near(geometry.impulseStartAngle,
    THREE.MathUtils.degToRad(1), 0, 'impulse begins one degree early');
  near(geometry.impulseEndAngle,
    THREE.MathUtils.degToRad(-1), 0, 'impulse ends one degree late');
  near(geometry.impulseStartAngle + geometry.impulseEndAngle,
    0, 0, 'impulse is symmetric around center');
  assert.equal(impulsePallet.label, 'I');
  assert.match(impulsePallet.function, /only impulse pallet/);
  assert.match(impulsePallet.function, /leftward vibration/);
  assert.equal(impulsePallet.points.length, 49);

  for (let cycle = 0; cycle < 5; cycle += 1) {
    for (const fraction of [0, 0.2, 0.5, 0.8, 1]) {
      const phase = THREE.MathUtils.lerp(
        geometry.impulseStartPhase,
        geometry.impulseEndPhase,
        fraction,
      );
      const state = stateAtTime(
        (cycle + phase) * geometry.pendulumPeriod,
      );
      assert.equal(state.impulseActive, true);
      assert.equal(state.contactKind, 'single-pallet-direct-impulse');
      assert.equal(state.activeImpulsePinIndex,
        positiveModulo(cycle, geometry.pinCount));
      assert.equal(state.impulseDirection, 'leftward');
      assert.ok(state.palletAngularSpeed < 0);
      near(state.impulseContactError, 0, 2e-15,
        `exact pallet I contact in cycle ${cycle}`);
      vectorNear(state.activeImpulsePoint,
        pinCenterAt(state.wheelAngle, state.activeImpulsePinIndex),
        1e-14, `active impulse pin in cycle ${cycle}`);
    }
    const midpoint = stateAtTime((cycle
      + (geometry.impulseStartPhase + geometry.impulseEndPhase) / 2)
      * geometry.pendulumPeriod);
    assert.ok(midpoint.wheelAngularSpeed < 0,
      `clockwise wheel impulse in cycle ${cycle}`);
  }
  const impulseStart = stateAtTime(
    geometry.impulseStartPhase * geometry.pendulumPeriod,
  );
  const impulseEnd = stateAtTime(
    geometry.impulseEndPhase * geometry.pendulumPeriod,
  );
  near(impulseStart.palletAngle, geometry.impulseStartAngle, 1e-15,
    'start pendulum angle');
  near(impulseEnd.palletAngle, geometry.impulseEndAngle, 1e-15,
    'end pendulum angle');
  near(impulseEnd.wheelAdvance - impulseStart.wheelAdvance,
    geometry.pinPitch, 1e-15, 'one-pitch impulse advance');
  disposeModel(model.root);
});

test('movement 308 click C lifts Q only in its banked direction and pivots harmlessly aside on return', () => {
  const model = createMovementModel(catalog.movements[307]);
  const {
    geometry,
    stateAtCyclePhase,
    transmission,
  } = model.root.userData;
  const unlockStart = stateAtCyclePhase(geometry.unlockStartPhase);
  const unlockMiddle = stateAtCyclePhase(
    (geometry.unlockStartPhase + geometry.impulseStartPhase) / 2,
  );
  const impulseStart = stateAtCyclePhase(geometry.impulseStartPhase);

  assert.equal(unlockStart.contactKind, 'unlocking-click-contact');
  near(unlockStart.detentAngle, 0, 1e-15, 'Q starts seated');
  near(unlockStart.clickAngle, 0, 0, 'C is banked for unlocking');
  near(unlockStart.passingContactError, 0, 1e-14,
    'C first touches Q');
  assert.ok(unlockMiddle.detentAngle < 0);
  near(unlockMiddle.clickAngle, 0, 0,
    'C remains banked while lifting Q');
  assert.ok(unlockMiddle.passingContactError < 0.02);
  near(impulseStart.detentAngle,
    geometry.detentLiftAngle, 1e-15, 'Q reaches full release');
  near(impulseStart.wheelAdvance, 0, 1e-15,
    'wheel waits until Q is clear');

  const bypassStart = stateAtCyclePhase(geometry.bypassStartPhase);
  const bypassMiddle = stateAtCyclePhase(
    (geometry.bypassStartPhase + geometry.bypassEndPhase) / 2,
  );
  const bypassEnd = stateAtCyclePhase(geometry.bypassEndPhase);
  assert.equal(bypassStart.contactKind, 'one-way-click-bypass');
  assert.equal(bypassMiddle.contactKind, 'one-way-click-bypass');
  assert.equal(bypassEnd.contactKind, 'one-way-click-bypass');
  near(bypassStart.detentAngle, 0, 0, 'Q stays locked at bypass start');
  near(bypassMiddle.detentAngle, 0, 0, 'Q stays locked during bypass');
  near(bypassEnd.detentAngle, 0, 0, 'Q stays locked at bypass end');
  assert.ok(bypassMiddle.clickAngle < 0,
    'C pivots away from its unlocking bank');
  near(bypassMiddle.clickAngle,
    geometry.clickMaximumDeflection, 1e-15,
    'C reaches its smooth return deflection');
  assert.ok(bypassMiddle.passingContactError <= 0.046,
    'Q remains on the finite-width yielding face of C');
  near(bypassEnd.clickAngle, 0, 1e-15,
    'C returns smoothly to its bank');
  near(bypassEnd.wheelAngle, bypassStart.wheelAngle, 0,
    'return bypass never unlocks or moves the wheel');
  assert.equal(bypassMiddle.detachedFromEscapeWheel, true);
  assert.match(transmission.returnPass, /pivots aside/);
  assert.match(transmission.returnPass, /without releasing Q/);
  disposeModel(model.root);
});

test('movement 308 renderer follows wheel, pendulum, Q, C, and all live contacts while movement 339 remains authored', () => {
  const movement = catalog.movements[307];
  const model = createMovementModel(movement);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const phases = [
    0,
    geometry.unlockStartPhase,
    (geometry.unlockStartPhase + geometry.impulseStartPhase) / 2,
    geometry.impulseStartPhase,
    (geometry.impulseStartPhase + geometry.impulseEndPhase) / 2,
    geometry.impulseEndPhase,
    0.42,
    0.62,
    geometry.bypassStartPhase,
    (geometry.bypassStartPhase + geometry.bypassEndPhase) / 2,
    geometry.bypassEndPhase,
    0.94,
    1,
  ];

  for (const phase of phases) {
    const time = phase * geometry.pendulumPeriod;
    model.update(time, 0.016);
    const state = stateAtTime(time);
    near(blocks.pendulumAssembly.rotation.z,
      state.palletAngle, 0, `pendulum angle at phase ${phase}`);
    near(blocks.wheelRotor.rotation.z,
      state.wheelAngle, 0, `wheel angle at phase ${phase}`);
    near(blocks.detentAssembly.rotation.z,
      state.detentAngle, 0, `Q angle at phase ${phase}`);
    near(blocks.clickAssembly.rotation.z,
      state.clickAngle, 0, `C angle at phase ${phase}`);
    assert.equal(blocks.impulseMarker.visible,
      state.impulseContactPoint !== null);
    assert.equal(blocks.clickContactMarker.visible,
      state.unlockActive || state.bypassActive);
    assert.equal(blocks.lockMarker.visible, state.detentLocked);
    assert.equal(blocks.impulseMarker.userData.activePinIndex,
      state.activeImpulsePinIndex);
    assert.equal(blocks.lockMarker.userData.activePinIndex,
      state.activeLockPinIndex);
    if (state.impulseContactPoint) {
      vectorNear(new THREE.Vector2(
        blocks.impulseMarker.position.x,
        blocks.impulseMarker.position.y,
      ), state.impulseContactPoint, 1e-12,
      `impulse marker at phase ${phase}`);
    }
  }
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, geometry.pendulumPeriod);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  assertReadableTiming(model.root.userData.animationTiming);

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
