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

test('movement 309 is Mudge’s two-arbor escapement with two weighted pallets and two independent half-forks', () => {
  const movement = catalog.movements[308];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    presentation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 309);
  assert.equal(movement.number, '309');
  assert.equal(movement.title, 'Mudge’s gravity escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'mudge-two-arbor-weighted-pallet-gravity-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /two independent weighted pallets A\/P and B\/Q/);
  assert.match(mechanism, /separate adjacent arbors C/);
  assert.match(mechanism, /advances half a pitch/);
  assert.match(mechanism, /weight-controlled impulse directly/);
  assert.match(presentation, /lifting face and locking stop/);
  assert.match(presentation, /long half-forks P\/Q/);
  assert.equal(transmission.impulsesPerPendulumCycle, 2);
  assert.deepEqual(transmission.impulsesPerVibration, [1, 1]);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.leftPallet.group.parent, model.root);
  assert.equal(blocks.rightPallet.group.parent, model.root);
  assert.notEqual(blocks.leftPallet.group, blocks.rightPallet.group);
  assert.equal(blocks.leftPallet.forkPin.parent,
    blocks.leftPallet.group);
  assert.equal(blocks.rightPallet.forkPin.parent,
    blocks.rightPallet.group);
  assert.equal(blocks.leftPallet.weight.parent,
    blocks.leftPallet.group);
  assert.equal(blocks.rightPallet.weight.parent,
    blocks.rightPallet.group);
  assert.equal(blocks.pendulumAssembly.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  // The four spokes are windows cut in the one-piece wheel plate.
  assert.equal(blocks.spokeMeshes.length, 0);
  const wheelPlate = blocks.wheelRotor.children.find((child) =>
    child.userData.role === 'thirty-pointed-escape-wheel-teeth');
  assert.equal(wheelPlate.geometry.userData.spokedWheel.spokes, 4);
  assert.equal(blocks.frameBearings.length, 4);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    /independent-weighted-gravity-pallet$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /gravity-impulse-weight$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /fork-pin-[PQ]$/.test(role)).length, 2);
  // Each pallet is one flat plate in the wheel's plane carrying its lifting
  // face and locking stop (no separate pads or nibs at other depths).
  assert.equal(roles.filter((role) =>
    /pallet-plate-with-lifting-face-and-stop$/.test(role)).length, 2);
  for (const pallet of [blocks.leftPallet, blocks.rightPallet]) {
    const box = new THREE.Box3().setFromObject(pallet.arm);
    assert.ok(box.max.z - box.min.z < 0.28, 'plate lies within the wheel plane');
    assert.equal(pallet.liftFace, pallet.arm);
    assert.equal(pallet.lockingNib, pallet.arm);
  }
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 309 records Brown’s measured elevation and Beckett’s complete Mudge operating sequence', () => {
  const movement = catalog.movements[308];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate309;
  const beckett = sourceReference.beckettConstructionReference;
  const britannica = sourceReference.britannicaReference;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.match(sourceAnimation.referenceScope, /separate pallet arbors C/);
  assert.match(sourceAnimation.referenceScope, /terminal nib locks/);
  assert.match(sourceAnimation.referenceScope, /clockwise B-to-A/);
  assert.match(sourceAnimation.referenceScope, /no-gap handoff/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_309.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterWheelCenter,
    new THREE.Vector2(258, 319));
  assert.deepEqual(plate.rasterWheelTop,
    new THREE.Vector2(257, 148));
  assert.deepEqual(plate.rasterLeftArbor,
    new THREE.Vector2(242, 28));
  assert.deepEqual(plate.rasterRightArbor,
    new THREE.Vector2(272, 28));
  assert.deepEqual(plate.rasterLeftPalletB,
    new THREE.Vector2(102, 210));
  assert.deepEqual(plate.rasterRightPalletA,
    new THREE.Vector2(414, 208));
  assert.deepEqual(plate.rasterForkPinQ,
    new THREE.Vector2(220, 501));
  assert.deepEqual(plate.rasterForkPinP,
    new THREE.Vector2(290, 500));
  assert.match(plate.inferredTopology, /thirty-tooth wheel/);
  assert.match(plate.symmetryReconstruction, /averaged/);
  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 0, 'source wheel center');
  near(sourcePointToModel(plate.rasterWheelTop)
    .distanceTo(geometry.wheelCenter),
  geometry.toothTipRadius, 1e-15, 'source wheel tip radius');
  vectorNear(sourcePointToModel(plate.rasterLeftArbor),
    geometry.mappedLeftArbor, 0, 'mapped left arbor');
  vectorNear(sourcePointToModel(plate.rasterRightArbor),
    geometry.mappedRightArbor, 0, 'mapped right arbor');
  near(geometry.palletPivotX,
    (Math.abs(geometry.mappedLeftArbor.x)
      + Math.abs(geometry.mappedRightArbor.x)) / 2,
  0, 'mirror reconstruction averages the arbor offsets');
  near(geometry.forkWorldX,
    (Math.abs(geometry.mappedForkPinP.x)
      + Math.abs(geometry.mappedForkPinQ.x)) / 2,
  0, 'mirror reconstruction averages P and Q');

  assert.equal(beckett.figure, 21);
  assert.equal(beckett.page, 76);
  assert.equal(beckett.publicationEdition, 8);
  assert.equal(beckett.publicationYear, 1903);
  assert.match(beckett.operatingEvidence, /nib a or b/);
  assert.match(beckett.operatingEvidence, /P or Q/);
  assert.match(beckett.operatingEvidence, /falls beyond its pickup/);
  assert.match(beckett.theoryEvidence, /beta equal to gamma/i);
  assert.match(beckett.theoryEvidence, /continuously in contact/);
  assert.equal(britannica.figure, 17);
  assert.equal(britannica.page, 544);
  assert.equal(britannica.publicationYear, 1911);
  assert.match(britannica.operatingEvidence, /opposite tooth raises/);
  assert.match(sourceReference.museumContext.historicalEvidence,
    /falling through repeatable distances/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 309 advances a thirty-tooth wheel exactly half a clockwise pitch per vibration', () => {
  const model = createMovementModel(catalog.movements[308]);
  const {
    geometry,
    stateAtTime,
    toothTipAt,
    transmission,
  } = model.root.userData;

  assert.equal(geometry.toothCount, 30);
  near(geometry.toothPitch, FULL_TURN / 30, 1e-15,
    'thirty-tooth pitch');
  near(geometry.wheelAdvancePerBeat, geometry.toothPitch / 2, 0,
    'half a pitch per vibration');
  near(geometry.wheelAdvancePerCycle, geometry.toothPitch, 0,
    'one pitch per full pendulum cycle');
  near(geometry.leftLockAngle - geometry.rightLockAngle,
    geometry.lockStationSeparationTeeth * geometry.toothPitch,
  1e-15, 'six-and-a-half-pitch lock-station separation');
  // Brown's locked B tooth stands in notch b at 129.4 degrees; the mirrored
  // stations 129/51 are six and a half pitches apart, so a fallen pallet's
  // stop still hangs over the middle of a tooth space.
  assert.equal(geometry.lockStationSeparationTeeth, 6.5);
  near(geometry.leftLockAngle, THREE.MathUtils.degToRad(129), 1e-15,
    'B locks where Brown draws the tooth in notch b');
  assert.equal(transmission.toothCount, 30);
  assert.equal(transmission.stepsPerPendulumCycle, 2);
  assert.equal(transmission.wheelCyclesPerRevolution, 30);

  for (let cycle = -2; cycle <= 16; cycle += 1) {
    const start = stateAtTime(cycle * geometry.pendulumPeriod);
    const between = stateAtTime((cycle + 0.6)
      * geometry.pendulumPeriod);
    const end = stateAtTime((cycle + 1)
      * geometry.pendulumPeriod);
    near(between.wheelAngle - start.wheelAngle,
      -geometry.toothPitch / 2, 1e-12,
      `first clockwise half pitch in cycle ${cycle}`);
    near(end.wheelAngle - start.wheelAngle,
      -geometry.toothPitch, 1e-12,
      `one clockwise pitch in cycle ${cycle}`);
    assert.equal(start.startingLeftToothIndex,
      positiveModulo(cycle, geometry.toothCount));
    assert.equal(start.rightToothIndex,
      positiveModulo(start.startingLeftToothIndex - 6,
        geometry.toothCount));
    vectorNear(toothTipAt(
      start.wheelAngle,
      start.startingLeftToothIndex,
    ), start.activeLockPoint, 1e-14,
    `starting left tooth ${cycle}`);
  }
  const start = stateAtTime(0);
  const closure = stateAtTime(30 * geometry.pendulumPeriod);
  near(closure.wheelAngle - start.wheelAngle,
    -FULL_TURN, 1e-12, 'thirty pendulum cycles close one wheel turn');
  disposeModel(model.root);
});

test('movement 309 alternates P and Q without a detached gap and raises only the outgoing pallet', () => {
  const model = createMovementModel(catalog.movements[308]);
  const {
    geometry,
    stateAtCyclePhase,
    timeline,
    transmission,
  } = model.root.userData;

  for (let index = 0; index < 241; index += 1) {
    const phase = index / 240;
    const state = stateAtCyclePhase(phase);
    assert.ok(['left', 'right'].includes(state.forkContactSide));
    assert.ok(state.forkContactError < 5e-14,
      `exact fork contact at phase ${phase}`);
  }
  assert.equal(stateAtCyclePhase(
    geometry.leftPickupPhase - 1e-6,
  ).forkContactSide, 'right');
  assert.equal(stateAtCyclePhase(
    geometry.leftPickupPhase + 1e-6,
  ).forkContactSide, 'left');
  assert.equal(stateAtCyclePhase(
    geometry.rightPickupPhase - 1e-6,
  ).forkContactSide, 'left');
  assert.equal(stateAtCyclePhase(
    geometry.rightPickupPhase + 1e-6,
  ).forkContactSide, 'right');

  const leftUnlock = stateAtCyclePhase(
    (geometry.leftPickupPhase + geometry.leftUnlockPhase) / 2,
  );
  assert.equal(leftUnlock.mode,
    'left-fork-Q-lifts-and-unlocks-pallet-B');
  assert.equal(leftUnlock.pendulumRaisedPalletSide, 'left');
  assert.equal(leftUnlock.trainCoupledToPendulum, true);
  assert.ok(leftUnlock.leftPalletMagnitude > geometry.cockedMagnitude);
  near(leftUnlock.rightPalletMagnitude,
    geometry.fallenMagnitude, 0, 'right pallet waits fallen');

  const rightUnlock = stateAtCyclePhase(
    (geometry.rightPickupPhase + geometry.rightUnlockPhase) / 2,
  );
  assert.equal(rightUnlock.mode,
    'right-fork-P-lifts-and-unlocks-pallet-A');
  assert.equal(rightUnlock.pendulumRaisedPalletSide, 'right');
  assert.equal(rightUnlock.trainCoupledToPendulum, true);
  assert.ok(rightUnlock.rightPalletMagnitude > geometry.cockedMagnitude);
  near(rightUnlock.leftPalletMagnitude,
    geometry.fallenMagnitude, 0, 'left pallet waits fallen');
  assert.match(transmission.palletHandoff, /beta equals gamma/);
  assert.match(transmission.palletHandoff, /always in contact/);
  assert.deepEqual(timeline.schedule, [
    'right-weighted-pallet-falls-with-pendulum',
    'left-fork-Q-lifts-and-unlocks-pallet-B',
    'wheel-cocks-right-weighted-pallet-A',
    'left-pallet-carried-to-outer-turn',
    'left-weighted-pallet-falls-with-pendulum',
    'right-fork-P-lifts-and-unlocks-pallet-A',
    'wheel-cocks-left-weighted-pallet-B',
    'right-pallet-carried-to-outer-turn',
  ]);
  disposeModel(model.root);
});

test('movement 309 holds alternate teeth at fixed terminal nibs with no recoil until the pendulum unlocks them', () => {
  const model = createMovementModel(catalog.movements[308]);
  const {
    blocks,
    fixedLockPointForSide,
    geometry,
    stateAtCyclePhase,
    transmission,
  } = model.root.userData;
  const samples = [0.04, 0.20, 0.30, 0.47, 0.61, 0.80, 0.97];

  for (const phase of samples) {
    const state = stateAtCyclePhase(phase);
    assert.equal(state.wheelLocked, true,
      `wheel locked at phase ${phase}`);
    assert.equal(state.wheelStepActive, false);
    near(state.wheelAngularSpeed, 0, 1e-10,
      `no recoil at phase ${phase}`);
    near(state.lockContactError, 0, 2e-14,
      `exact nib contact at phase ${phase}`);
    vectorNear(state.activeLockPoint,
      fixedLockPointForSide(state.activeLockSide === 'right' ? 1 : -1),
      2e-14, `fixed lock station at phase ${phase}`);
  }
  assert.equal(blocks.leftPallet.lockFacePoints.length, 9);
  assert.equal(blocks.rightPallet.lockFacePoints.length, 9);
  assert.equal(blocks.leftPallet.lockingNib.parent,
    blocks.leftPallet.group);
  assert.equal(blocks.rightPallet.lockingNib.parent,
    blocks.rightPallet.group);
  assert.match(transmission.locking, /without wheel motion/);
  assert.match(transmission.locking, /P or Q lifts/);
  disposeModel(model.root);
});

test('movement 309 uses each released wheel step to cock only the opposite weighted pallet along an exact acting face', () => {
  const model = createMovementModel(catalog.movements[308]);
  const {
    geometry,
    liftFaceLocalPointAt,
    palletWorldPoint,
    stateAtCyclePhase,
    toothTipAt,
  } = model.root.userData;
  const steps = [
    {
      end: geometry.firstWheelStepEndPhase,
      side: 'right',
      sideSign: 1,
      start: geometry.leftUnlockPhase,
    },
    {
      end: geometry.secondWheelStepEndPhase,
      side: 'left',
      sideSign: -1,
      start: geometry.rightUnlockPhase,
    },
  ];

  for (const step of steps) {
    let previousMagnitude = geometry.fallenMagnitude;
    for (const fraction of [0, 0.2, 0.5, 0.8, 1]) {
      const phase = THREE.MathUtils.lerp(step.start, step.end, fraction);
      const state = stateAtCyclePhase(phase);
      const magnitude = step.side === 'right'
        ? state.rightPalletMagnitude
        : state.leftPalletMagnitude;
      assert.equal(state.wheelStepActive, true);
      assert.equal(state.activeLiftSide, step.side);
      assert.equal(state.trainRaisingPalletSide, step.side);
      assert.equal(state.trainCoupledToPendulum, false);
      assert.equal(state.wheelLocked, false);
      assert.ok(magnitude >= previousMagnitude - 1e-14);
      near(state.liftContactError, 0, 3e-14,
        `exact ${step.side} acting-face contact at ${fraction}`);
      vectorNear(state.activeLiftPoint,
        toothTipAt(state.wheelAngle, state.activeLiftToothIndex),
        2e-14, `${step.side} active lifting tooth at ${fraction}`);
      const localPoint = liftFaceLocalPointAt(
        step.sideSign,
        state.liftProgress,
      );
      vectorNear(palletWorldPoint(
        step.sideSign,
        localPoint,
        magnitude,
      ), state.activeLiftPoint, 3e-14,
      `${step.side} generated acting face at ${fraction}`);
      previousMagnitude = magnitude;
    }
    const start = stateAtCyclePhase(step.start);
    const end = stateAtCyclePhase(step.end);
    const startMagnitude = step.side === 'right'
      ? start.rightPalletMagnitude
      : start.leftPalletMagnitude;
    const endMagnitude = step.side === 'right'
      ? end.rightPalletMagnitude
      : end.leftPalletMagnitude;
    near(startMagnitude, geometry.fallenMagnitude, 1e-15,
      `${step.side} starts fallen`);
    near(endMagnitude, geometry.cockedMagnitude, 1e-15,
      `${step.side} finishes cocked`);
    near(end.wheelAdvance - start.wheelAdvance,
      geometry.toothPitch / 2, 2e-15,
      `${step.side} cocking consumes exactly half a pitch`);
  }
  disposeModel(model.root);
});

test('movement 309 gives equal isolated gravity impulses from equal pallet falls on alternate vibrations', () => {
  const model = createMovementModel(catalog.movements[308]);
  const {
    geometry,
    gravityPotentialAt,
    stateAtCyclePhase,
    transmission,
    weightCenterAt,
  } = model.root.userData;
  const rightDrop = gravityPotentialAt(1, geometry.cockedMagnitude)
    - gravityPotentialAt(1, geometry.fallenMagnitude);
  const leftDrop = gravityPotentialAt(-1, geometry.cockedMagnitude)
    - gravityPotentialAt(-1, geometry.fallenMagnitude);

  near(rightDrop, geometry.netGravityPotentialDrop, 1e-14,
    'right fixed potential drop');
  near(leftDrop, rightDrop, 1e-14,
    'mirror pallets provide equal potential drops');
  assert.ok(rightDrop > 0);
  near(transmission.equalImpulseEnergyPerSide,
    rightDrop, 1e-14, 'published equal impulse energy');
  near(weightCenterAt(1, geometry.cockedMagnitude).y
    - weightCenterAt(1, geometry.fallenMagnitude).y,
  rightDrop / geometry.standardGravity, 1e-14,
  'right weight supplies the potential drop');

  const rightImpulse = stateAtCyclePhase(0.25);
  assert.equal(rightImpulse.effectiveGravityImpulseActive, true);
  assert.equal(rightImpulse.gravityDescentSide, 'right');
  assert.equal(rightImpulse.forkContactSide, 'right');
  assert.equal(rightImpulse.impulseDirection, 'leftward');
  assert.equal(rightImpulse.gravityImpulseIsolatedFromTrain, true);
  assert.equal(rightImpulse.trainCoupledToPendulum, false);
  assert.ok(rightImpulse.pendulumAngularSpeed < 0);

  const leftImpulse = stateAtCyclePhase(0.75);
  assert.equal(leftImpulse.effectiveGravityImpulseActive, true);
  assert.equal(leftImpulse.gravityDescentSide, 'left');
  assert.equal(leftImpulse.forkContactSide, 'left');
  assert.equal(leftImpulse.impulseDirection, 'rightward');
  assert.equal(leftImpulse.gravityImpulseIsolatedFromTrain, true);
  assert.equal(leftImpulse.trainCoupledToPendulum, false);
  assert.ok(leftImpulse.pendulumAngularSpeed > 0);
  near(rightImpulse.rightPalletMagnitude,
    leftImpulse.leftPalletMagnitude, 2e-15,
    'mirror impulse geometry at center');
  assert.match(transmission.effectiveImpulseArc,
    /2.5 degrees before center to 2.5 degrees after center/);
  assert.match(transmission.gravityIsolation,
    /fixed weight and fall/);
  disposeModel(model.root);
});

test('movement 309 renderer follows both pallets, wheel, pendulum, and live contacts while movement 339 remains authored', () => {
  const movement = catalog.movements[308];
  const model = createMovementModel(movement);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const phases = [
    0,
    geometry.rightEffectiveImpulseStartPhase,
    0.25,
    geometry.leftPickupPhase,
    geometry.leftUnlockPhase,
    (geometry.leftUnlockPhase + geometry.firstWheelStepEndPhase) / 2,
    geometry.firstWheelStepEndPhase,
    0.5,
    0.75,
    geometry.rightPickupPhase,
    geometry.rightUnlockPhase,
    (geometry.rightUnlockPhase + geometry.secondWheelStepEndPhase) / 2,
    geometry.secondWheelStepEndPhase,
    1,
  ];

  for (const phase of phases) {
    const time = phase * geometry.pendulumPeriod;
    model.update(time, 0.016);
    const state = stateAtTime(time);
    near(blocks.pendulumAssembly.rotation.z,
      state.pendulumAngle, 0, `pendulum angle at phase ${phase}`);
    near(blocks.wheelRotor.rotation.z,
      state.wheelAngle, 0, `wheel angle at phase ${phase}`);
    near(blocks.leftPallet.group.rotation.z,
      state.leftPalletAngle, 0, `left pallet at phase ${phase}`);
    near(blocks.rightPallet.group.rotation.z,
      state.rightPalletAngle, 0, `right pallet at phase ${phase}`);
    assert.equal(blocks.wheelLiftMarker.userData.active,
      state.wheelStepActive);
    assert.equal(blocks.lockMarker.userData.active, state.wheelLocked);
    for (const marker of [blocks.forkContactMarker,
      blocks.wheelLiftMarker, blocks.lockMarker]) {
      assert.equal(marker.visible, false,
        `${marker.userData.role} is a diagnostic locus inside the parts`);
    }
    assert.equal(blocks.forkContactMarker.userData.contactSide,
      state.forkContactSide);
    assert.equal(blocks.wheelLiftMarker.userData.contactSide,
      state.activeLiftSide);
    assert.equal(blocks.lockMarker.userData.contactSide,
      state.activeLockSide);
    vectorNear(new THREE.Vector2(
      blocks.forkContactMarker.position.x,
      blocks.forkContactMarker.position.y,
    ), state.forkContactPoint, 1e-12,
    `fork marker at phase ${phase}`);
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

test("movement 309 cuts Brown's slanted ratchet teeth and joins each pallet arm to its arbor eye", () => {
  const model = createMovementModel(catalog.movements[308]);
  const root = model.root;
  let teeth;
  const plates = [];
  root.traverse((o) => {
    if (o.userData.role === 'thirty-pointed-escape-wheel-teeth') teeth = o;
    if (/pallet-plate-with-lifting-face-and-stop/.test(o.userData.role ?? '')) plates.push(o);
  });
  // Per tooth, the flank on the clockwise side of the tip is nearly radial
  // and the counterclockwise back is long: the outline points near the tip
  // circle lean one way.
  const position = teeth.geometry.attributes.position;
  const tip = 2.25, root2 = 1.98, pitch = FULL_TURN / 30;
  const offsets = { lead: [], back: [] };
  for (let i = 0; i < position.count; i += 1) {
    const r = Math.hypot(position.getX(i), position.getY(i));
    if (Math.abs(r - root2) > 1e-3) continue;
    const a = Math.atan2(position.getY(i), position.getX(i));
    // angle from the nearest tip station (tips at k * pitch in the plate frame)
    const d = ((a / pitch) % 1 + 1) % 1;
    if (d < 0.1) offsets.back.push(d); else if (d > 0.9) offsets.lead.push(d);
  }
  assert.ok(offsets.lead.length > 0, 'a root point just clockwise of each tip (radial face)');
  assert.equal(offsets.back.length, 0, 'no root point just counterclockwise of a tip (sloping back)');
  assert.ok(tip > root2);
  // Each pallet plate reaches its arbor: material at the arbor's centre.
  assert.equal(plates.length, 2);
  for (const plate of plates) {
    plate.geometry.computeBoundingBox();
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
    const hits = [0.13, -0.13].flatMap((dx) => {
      ray.set(new THREE.Vector3(dx, 0, 5), new THREE.Vector3(0, 0, -1));
      return ray.intersectObject(new THREE.Mesh(plate.geometry));
    });
    assert.ok(hits.length >= 2, `${plate.userData.role} surrounds its arbor`);
  }
  // ... and the arm is continuous from the eye outward.
  for (const plate of plates) {
    const ray = new THREE.Raycaster();
    const mesh = new THREE.Mesh(plate.geometry);
    const side = plate.userData.role.startsWith('right') ? 1 : -1;
    let gaps = 0;
    for (let k = 0; k <= 20; k += 1) {
      // Along the arm from the eye toward the weight stem, in the plate frame.
      const t = k / 20 * 0.8;
      ray.set(new THREE.Vector3(side * 0.6 * t, -0.8 * t, 5), new THREE.Vector3(0, 0, -1));
      if (!ray.intersectObject(mesh).length) gaps += 1;
    }
    assert.equal(gaps, 0, `${plate.userData.role} arm runs unbroken into its eye`);
  }
  disposeLike(root);
});
function disposeLike(root) { root.traverse((o) => o.geometry?.dispose?.()); }
