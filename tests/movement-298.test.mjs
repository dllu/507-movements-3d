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

test('movement 298 is one vertical-verge watch escapement with its complete contrate train', () => {
  const movement = catalog.movements[297];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 298);
  assert.equal(movement.number, '298');
  assert.equal(movement.title, 'Old-fashioned watch verge escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'vertical-verge-watch-escapement-with-balance-and-contrate-train');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /horizontal three-spoke balance C/);
  assert.match(mechanism, /vertical staff carrying two angular verge pallets/);
  assert.match(mechanism, /thirteen-tooth perpendicular crown wheel/);
  assert.match(mechanism, /eight-leaf pinion/);
  assert.match(mechanism, /thirty-two-tooth contrate train wheel/);
  assert.equal(transmission.crownWheelTeeth, 13);
  assert.equal(transmission.escapePinionTeeth, 8);
  assert.equal(transmission.trainWheelTeeth, 32);
  assert.equal(transmission.activePalletContactsAtOnce, 1);

  assert.equal(blocks.crownWheel.parent, model.root);
  assert.equal(blocks.crownShaft.parent, model.root);
  assert.equal(blocks.verge.parent, model.root);
  assert.equal(blocks.balanceStaff.parent, blocks.verge);
  assert.equal(blocks.balanceWheel.parent, blocks.verge);
  assert.equal(blocks.rightPallet.pallet.parent, blocks.verge);
  assert.equal(blocks.leftPallet.pallet.parent, blocks.verge);
  assert.equal(blocks.escapePinion.parent, model.root);
  assert.equal(blocks.trainWheel.parent, model.root);
  assert.equal(blocks.trainShaft.parent, model.root);
  assert.equal(blocks.trainContactMarker.parent, model.root);
  vectorNear(blocks.crownWheel.userData.worldAxis,
    new THREE.Vector3(1, 0, 0), 2e-15, 'horizontal crown arbor');
  vectorNear(blocks.escapePinion.userData.worldAxis,
    new THREE.Vector3(1, 0, 0), 2e-15, 'coaxial escape pinion');
  vectorNear(blocks.verge.userData.worldAxis,
    new THREE.Vector3(0, 1, 0), 2e-15, 'vertical balance staff');
  vectorNear(blocks.balanceWheel.userData.worldAxis,
    new THREE.Vector3(0, 1, 0), 2e-15, 'horizontal balance plane');
  vectorNear(blocks.trainWheel.userData.worldAxis,
    new THREE.Vector3(0, 1, 0), 2e-15, 'perpendicular train arbor');
  near(blocks.crownWheel.userData.worldAxis.dot(
    blocks.verge.userData.worldAxis,
  ), 0, 2e-15, 'crown and verge axes are perpendicular');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role === 'balance-C-spoke').length, 3);
  assert.equal(roles.filter((role) =>
    role === 'axial-saw-tooth').length, 13);
  assert.equal(roles.filter((role) =>
    role === 'axial-contrate-train-tooth').length, 32);
  assert.equal(roles.filter((role) =>
    /pallet-A-contact-face$/.test(role)).length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 298 records Brown’s balance C, perpendicular stack, arrow, and unavailable animation', () => {
  const movement = catalog.movements[297];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToPresentation,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate298;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /balance C/);
  assert.match(sourceAnimation.referenceScope, /vertical verge/);
  assert.match(sourceAnimation.referenceScope, /perpendicular train wheel/);
  assert.match(sourceAnimation.referenceScope, /recoil\/contact law/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_298.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.rasterBalanceCenterC,
    new THREE.Vector2(267, 119));
  assert.deepEqual(plate.rasterBalanceHub,
    new THREE.Vector2(267, 116));
  assert.deepEqual(plate.rasterCrownWheelCenter,
    new THREE.Vector2(233, 281));
  assert.deepEqual(plate.rasterEscapePinionCenter,
    new THREE.Vector2(97, 282));
  assert.deepEqual(plate.rasterTrainWheelCenter,
    new THREE.Vector2(119, 355));
  assert.deepEqual(plate.rasterDirectionArrow,
    new THREE.Vector2(187, 370));
  assert.deepEqual(plate.rasterLabelC,
    new THREE.Vector2(374, 136));
  assert.deepEqual(plate.rasterBalanceOuterBounds, {
    bottom: 195,
    left: 18,
    right: 507,
    top: 37,
  });
  assert.deepEqual(plate.rasterCrownWheelBounds, {
    bottom: 358,
    left: 198,
    right: 273,
    top: 201,
  });
  assert.deepEqual(plate.rasterBalanceStaffEndpoints, [
    new THREE.Vector2(266, 96),
    new THREE.Vector2(267, 420),
  ]);
  assert.deepEqual(plate.rasterCrownArborEndpoints, [
    new THREE.Vector2(7, 282),
    new THREE.Vector2(257, 282),
  ]);
  assert.equal(plate.modeledCrownToothCount, 13);
  assert.match(plate.toothCountBasis, /historically required odd/);
  assert.match(plate.inferredTopology, /horizontal balance wheel C/);
  assert.match(plate.inferredTopology, /vertical two-pallet verge/);
  assert.match(plate.inferredTopology, /orthogonal train wheel/);

  vectorNear(
    sourcePointToPresentation(plate.rasterCrownWheelCenter),
    new THREE.Vector2(0, 0),
    0,
    'source crown-wheel origin',
  );
  near(geometry.sourceScale,
    geometry.bodyRadius / 78.5, 0, 'vertical crown scale');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.periodReference.publicationYear, 1911);
  assert.match(sourceReference.periodReference.description,
    /old vertical watch escapement/);
  assert.match(sourceReference.periodReference.description,
    /crown wheel and pallets/);
  disposeModel(model.root);
});

test('movement 298 builds the source three-spoke balance and a true odd-tooth crown wheel', () => {
  const model = createMovementModel(catalog.movements[297]);
  const { blocks, geometry, transmission } = model.root.userData;

  assert.equal(blocks.balanceSpokes.length, 3);
  assert.equal(blocks.balanceRim.parent, blocks.balanceWheel);
  assert.equal(blocks.balanceHub.parent, blocks.balanceWheel);
  assert.equal(blocks.balanceIndex.parent, blocks.balanceWheel);
  near(blocks.balanceWheel.position.x,
    geometry.balanceCenterOnStaff, 0, 'balance center on staff');
  near(blocks.balanceRim.geometry.parameters.radius,
    geometry.balanceRadius, 0, 'balance rim radius');
  blocks.balanceSpokes.forEach((spoke, index) => {
    assert.equal(spoke.parent, blocks.balanceWheel);
    assert.equal(spoke.userData.index, index);
    near(spoke.rotation.z, index * Math.PI * 2 / 3, 0,
      `balance spoke ${index} phase`);
  });
  assert.equal(blocks.balanceStaff.userData.role,
    'vertical-balance-staff');
  near(geometry.staffLength, 10, 0, 'full staff length');

  assert.equal(blocks.crownWheel.userData.teeth, 13);
  assert.equal(blocks.crownWheel.userData.toothMeshes.length, 13);
  assert.equal(blocks.crownWheel.userData.toothTips.length, 13);
  assert.equal(blocks.crownWheel.userData.body.visible, false);
  assert.equal(blocks.crownOpenRim.parent,
    blocks.crownWheel.userData.rotor);
  assert.equal(blocks.crownSpokes.length, 4);
  blocks.crownSpokes.forEach((spoke, index) => {
    assert.equal(spoke.parent, blocks.crownWheel.userData.rotor);
    assert.equal(spoke.userData.index, index);
  });
  assert.equal(transmission.oddCrownToothCountRequired, true);
  near(geometry.toothPitch, Math.PI * 2 / 13, 0,
    'thirteen-tooth pitch');
  blocks.crownWheel.userData.toothTips.forEach((tip, index) => {
    near(Math.hypot(tip.x, tip.y), geometry.contactRadius, 5e-16,
      `crown tooth ${index} contact orbit`);
    near(tip.z, geometry.toothTipZ, 0,
      `crown tooth ${index} axial tip`);
  });
  near(geometry.palletReleaseDistance - geometry.palletRootDistance,
    geometry.palletFaceSpan, 0, 'trimmed working pallet span');
  assert.ok(geometry.palletFaceSpan > 0, 'pallet face has positive span');
  near(THREE.MathUtils.radToDeg(geometry.palletIncludedAngle),
    100, 1e-14, 'historical pallet included angle');
  near(THREE.MathUtils.radToDeg(geometry.balanceAmplitude),
    35, 1e-14, 'legible balance half-swing');
  disposeModel(model.root);
});

test('movement 298 alternates one exact pallet contact around two finite free drops', () => {
  const model = createMovementModel(catalog.movements[297]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  const seenPallets = new Set();
  let contactSamples = 0;
  let freeDropSamples = 0;
  let maximumNormalVelocityError = 0;
  let minimumCoordinate = Infinity;
  let maximumCoordinate = -Infinity;

  for (let index = 0; index <= 32768; index += 1) {
    const state = stateAtCycleCoordinate(index / 32768);
    for (const value of [
      state.balanceAngle,
      state.balanceAngularAcceleration,
      state.balanceAngularSpeed,
      state.crownWheelAngle,
      state.crownWheelAngularAcceleration,
      state.crownWheelAngularSpeed,
    ]) assert.ok(Number.isFinite(value), 'state remains finite');

    assert.equal(state.activePallet === null, state.freeDrop);
    assert.equal(state.contact === null, state.freeDrop);
    if (state.contact) {
      contactSamples += 1;
      seenPallets.add(state.activePallet);
      maximumNormalVelocityError = Math.max(
        maximumNormalVelocityError,
        Math.abs(state.contact.normalVelocityError),
      );
      minimumCoordinate = Math.min(
        minimumCoordinate,
        state.contact.contactCoordinate,
      );
      maximumCoordinate = Math.max(
        maximumCoordinate,
        state.contact.contactCoordinate,
      );
      near(state.contact.palletPlaneSeparation, 0, 5e-15,
        `contact plane closure at sample ${index}`);
      near(state.contact.toothPhaseError, 0, 5e-15,
        `tooth phase closure at sample ${index}`);
      assert.ok(
        Math.abs(state.contact.palletWidthOffset)
          <= geometry.palletWidth / 2 + 2e-15,
        `tooth remains within pallet width at sample ${index}`,
      );
    } else {
      freeDropSamples += 1;
      assert.ok(state.freeDropState, 'free drop exposes both nearby teeth');
      assert.ok(state.dropProgress >= 0 && state.dropProgress <= 1,
        'drop progress stays normalized');
    }
  }

  assert.deepEqual([...seenPallets].sort(), ['left', 'right']);
  assert.ok(contactSamples > 25000, 'pallet contact occupies most of cycle');
  assert.ok(freeDropSamples > 1000, 'both finite drops are sampled');
  assert.ok(minimumCoordinate >= -5e-14,
    `contact stays beyond root: ${minimumCoordinate}`);
  assert.ok(maximumCoordinate <= 1 + 5e-14,
    `contact stays before release edge: ${maximumCoordinate}`);
  assert.ok(maximumNormalVelocityError < 2e-15,
    `exact contact normal velocity: ${maximumNormalVelocityError}`);

  const right = stateAtCycleCoordinate(0.1);
  const firstDrop = stateAtCycleCoordinate(
    (geometry.firstReleasePhase + geometry.firstCatchPhase) / 2,
  );
  const left = stateAtCycleCoordinate(0.6);
  const secondDrop = stateAtCycleCoordinate(
    (geometry.secondReleasePhase + geometry.secondCatchPhase) / 2,
  );
  assert.equal(right.activePallet, 'right');
  assert.equal(firstDrop.activePallet, null);
  assert.equal(firstDrop.approachingPallet, 'left');
  assert.equal(left.activePallet, 'left');
  assert.equal(secondDrop.activePallet, null);
  assert.equal(secondDrop.approachingPallet, 'right');
  disposeModel(model.root);
});

test('movement 298 visibly recoils, drops forward, and advances one crown tooth per oscillation', () => {
  const model = createMovementModel(catalog.movements[297]);
  const { geometry, stateAtCycleCoordinate, transmission } =
    model.root.userData;
  const source = stateAtCycleCoordinate(0);
  const half = stateAtCycleCoordinate(0.5);
  const closure = stateAtCycleCoordinate(1);
  near(half.crownWheelAngle - source.crownWheelAngle,
    geometry.toothPitch / 2, 2e-16, 'one tooth half-step');
  near(closure.crownWheelAngle - source.crownWheelAngle,
    geometry.toothPitch, 2e-16, 'one tooth per balance oscillation');
  near(closure.balanceAngle, source.balanceAngle, 0,
    'balance closes one oscillation');
  assert.equal(transmission.outputAdvancePerBeatInToothPitches, 0.5);
  assert.equal(transmission.outputAdvancePerOscillationInToothPitches, 1);

  const firstRelease = stateAtCycleCoordinate(geometry.firstReleasePhase);
  const firstCatch = stateAtCycleCoordinate(geometry.firstCatchPhase);
  const secondRelease = stateAtCycleCoordinate(geometry.secondReleasePhase);
  const secondCatch = stateAtCycleCoordinate(geometry.secondCatchPhase);
  near(firstCatch.crownWheelAngle - firstRelease.crownWheelAngle,
    geometry.dropAngle, 3e-16, 'first forward free drop');
  near(secondCatch.crownWheelAngle - secondRelease.crownWheelAngle,
    geometry.dropAngle, 4e-16, 'second forward free drop');
  near(firstCatch.crownWheelAngle - half.crownWheelAngle,
    geometry.recoilAngle, 3e-16, 'left-pallet recoil');
  near(secondCatch.crownWheelAngle - closure.crownWheelAngle,
    geometry.recoilAngle, 3e-16, 'right-pallet recoil');
  assert.ok(geometry.dropAngle > 0, 'drop is positive');
  assert.ok(geometry.recoilAngle > 0, 'recoil is positive');

  for (const [start, end] of [
    [geometry.firstReleasePhase, geometry.firstCatchPhase],
    [geometry.secondReleasePhase, geometry.secondCatchPhase],
  ]) {
    let previousAngle = stateAtCycleCoordinate(start).crownWheelAngle;
    for (let index = 1; index <= 4096; index += 1) {
      const phase = THREE.MathUtils.lerp(start, end, index / 4096);
      const angle = stateAtCycleCoordinate(phase).crownWheelAngle;
      assert.ok(angle >= previousAngle - 2e-15,
        'free drop never reverses');
      previousAngle = angle;
    }
  }

  let sawRightRecoil = false;
  let sawLeftRecoil = false;
  let sawRightImpulse = false;
  let sawLeftImpulse = false;
  for (let index = 0; index < 4096; index += 1) {
    const state = stateAtCycleCoordinate(index / 4096);
    if (state.activePallet === 'right' && state.recoil) {
      sawRightRecoil = true;
    }
    if (state.activePallet === 'left' && state.recoil) {
      sawLeftRecoil = true;
    }
    if (state.activePallet === 'right' && state.directImpulse) {
      sawRightImpulse = true;
    }
    if (state.activePallet === 'left' && state.directImpulse) {
      sawLeftImpulse = true;
    }
  }
  assert.equal(sawRightRecoil, true);
  assert.equal(sawLeftRecoil, true);
  assert.equal(sawRightImpulse, true);
  assert.equal(sawLeftImpulse, true);

  for (const boundary of [
    geometry.firstReleasePhase,
    geometry.firstCatchPhase,
    geometry.secondReleasePhase,
    geometry.secondCatchPhase,
  ]) {
    const epsilon = 1e-9;
    const before = stateAtCycleCoordinate(boundary - epsilon);
    const after = stateAtCycleCoordinate(boundary + epsilon);
    near(before.crownWheelAngle, after.crownWheelAngle, 5e-9,
      `position-continuous handoff at ${boundary}`);
    near(before.balanceAngle, after.balanceAngle, 1e-8,
      `continuous balance at ${boundary}`);
  }
  disposeModel(model.root);
});

test('movement 298 keeps the eight-leaf pinion in exact pitch mesh with the orthogonal contrate wheel', () => {
  const model = createMovementModel(catalog.movements[297]);
  const {
    blocks,
    geometry,
    stateAtCycleCoordinate,
    transmission,
  } = model.root.userData;

  assert.equal(blocks.trainTeeth.length, 32);
  assert.equal(blocks.trainSpokes.length, 4);
  near(geometry.pinionPitchRadius / geometry.trainPitchRadius,
    1 / 4, 0, '8:32 pitch-radius ratio');
  near(Math.PI * 2 * geometry.pinionPitchRadius / geometry.pinionTeeth,
    Math.PI * 2 * geometry.trainPitchRadius / geometry.trainTeeth,
    1e-16, 'one common circular pitch');
  near(transmission.pinionToTrainAngularRatio,
    1 / 4, 0, 'reported angular ratio');

  blocks.trainTeeth.forEach((tooth, index) => {
    assert.equal(tooth.parent, blocks.trainWheel.userData.rotor);
    assert.equal(tooth.userData.index, index);
    near(Math.hypot(tooth.position.x, tooth.position.y),
      geometry.trainPitchRadius, 5e-16,
      `contrate tooth ${index} pitch station`);
    near(tooth.position.z, 0.10, 0,
      `contrate tooth ${index} projects axially`);
  });

  for (let index = 0; index <= 32768; index += 1) {
    const state = stateAtCycleCoordinate(index / 32768);
    near(state.trainWheelAngle,
      state.crownWheelAngle / 4, 2e-16,
      `train angle ratio at sample ${index}`);
    near(state.trainWheelAngularSpeed,
      state.crownWheelAngularSpeed / 4, 2e-16,
      `train speed ratio at sample ${index}`);
    vectorNear(state.trainContact.pinionVelocity,
      state.trainContact.trainVelocity, 2e-16,
      `no-slip train contact at sample ${index}`);
    vectorNear(state.trainContact.surfaceVelocityError,
      new THREE.Vector3(), 2e-16,
      `zero train surface error at sample ${index}`);
  }
  vectorNear(blocks.trainContactMarker.position,
    stateAtCycleCoordinate(0).trainContact.contactPoint, 0,
    'visible marker lies at the fixed pitch contact');
  disposeModel(model.root);
});

test('movement 298 analytic rates match finite differences and drive every rendered rotor', () => {
  const model = createMovementModel(catalog.movements[297]);
  const { blocks, stateAtTime } = model.root.userData;
  const h = 1e-5;
  for (const time of [0.2, 0.7, 1.0, 1.5, 1.9, 2.2, 2.7, 3.0, 3.5, 3.9]) {
    const before = stateAtTime(time - h);
    const state = stateAtTime(time);
    const after = stateAtTime(time + h);
    const balanceSpeed = (
      after.balanceAngle - before.balanceAngle
    ) / (2 * h);
    const balanceAcceleration = (
      after.balanceAngle - 2 * state.balanceAngle + before.balanceAngle
    ) / h ** 2;
    const crownSpeed = (
      after.crownWheelAngle - before.crownWheelAngle
    ) / (2 * h);
    const crownAcceleration = (
      after.crownWheelAngle - 2 * state.crownWheelAngle
      + before.crownWheelAngle
    ) / h ** 2;
    const trainSpeed = (
      after.trainWheelAngle - before.trainWheelAngle
    ) / (2 * h);
    near(balanceSpeed, state.balanceAngularSpeed, 2e-9,
      `balance speed at ${time}`);
    near(balanceAcceleration, state.balanceAngularAcceleration, 7e-6,
      `balance acceleration at ${time}`);
    near(crownSpeed, state.crownWheelAngularSpeed, 1e-8,
      `crown speed at ${time}`);
    near(crownAcceleration, state.crownWheelAngularAcceleration, 2e-5,
      `crown acceleration at ${time}`);
    near(trainSpeed, state.trainWheelAngularSpeed, 3e-9,
      `train speed at ${time}`);
  }

  for (const time of [0, 0.8, 1.34, 1.75, 2.4, 3.34, 3.8, 4]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.verge.rotation.x, state.balanceAngle, 0,
      `rendered balance at ${time}`);
    near(blocks.crownWheel.userData.rotor.rotation.z,
      state.crownWheelAngle, 0, `rendered crown wheel at ${time}`);
    near(blocks.crownShaft.userData.rotor.rotation.z,
      state.crownWheelAngle, 0, `rendered crown shaft at ${time}`);
    near(blocks.escapePinion.userData.rotor.rotation.z,
      state.crownWheelAngle, 0, `rendered escape pinion at ${time}`);
    near(blocks.trainWheel.userData.rotor.rotation.z,
      state.trainWheelAngle, 0, `rendered train wheel at ${time}`);
    near(blocks.trainShaft.userData.rotor.rotation.z,
      state.trainWheelAngle, 0, `rendered train shaft at ${time}`);
    near(blocks.verge.userData.angularSpeed,
      state.balanceAngularSpeed, 0, `reported balance speed at ${time}`);
    near(blocks.crownWheel.userData.angularSpeed,
      state.crownWheelAngularSpeed, 0, `reported crown speed at ${time}`);
    near(blocks.trainWheel.userData.angularSpeed,
      state.trainWheelAngularSpeed, 0, `reported train speed at ${time}`);
    assert.equal(blocks.rightContactMarker.visible, false);
    assert.equal(blocks.rightContactMarker.userData.active,
      state.activePallet === 'right');
    assert.equal(blocks.leftContactMarker.visible, false);
    assert.equal(blocks.leftContactMarker.userData.active,
      state.activePallet === 'left');
    near(model.root.userData.kinematics.cycleCoordinate,
      state.cycleCoordinate, 0, `published state coordinate at ${time}`);
    near(model.root.userData.kinematics.crownWheelAngle,
      state.crownWheelAngle, 0, `published crown state at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 298 publishes a reviewed four-second cycle and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[297]);
  const {
    animationTiming,
    canonicalTimes,
    geometry,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  assert.equal(canonicalTimes.sourcePose, 0);
  assert.equal(canonicalTimes.cycleClosure, 4);
  assert.ok(canonicalTimes.firstFreeDropMidpoint > 0);
  assert.ok(canonicalTimes.leftRecoilMidpoint
    < canonicalTimes.leftImpulseMidpoint);
  assert.ok(canonicalTimes.secondFreeDropMidpoint
    < canonicalTimes.rightRecoilMidpoint);
  assert.equal(animationTiming.authoredCyclePeriod, geometry.cyclePeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);

  const start = stateAtTime(0);
  for (let cycle = 1; cycle <= 13; cycle += 1) {
    const closure = stateAtTime(cycle * geometry.cyclePeriod);
    near(closure.balanceAngle, start.balanceAngle, 0,
      `balance closes cycle ${cycle}`);
    near(closure.crownWheelAngle - start.crownWheelAngle,
      cycle * geometry.toothPitch, 2e-15,
      `crown advances ${cycle} teeth`);
    near(closure.trainWheelAngle - start.trainWheelAngle,
      cycle * geometry.toothPitch / 4, 6e-16,
      `train preserves ratio through cycle ${cycle}`);
  }
  near(
    stateAtTime(13 * geometry.cyclePeriod).crownWheelAngle
      - start.crownWheelAngle,
    Math.PI * 2,
    2e-15,
    'thirteen oscillations close the crown wheel',
  );
  assert.match(sourceReference.plate298.inferredTopology,
    /one horizontal balance wheel C/);

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
