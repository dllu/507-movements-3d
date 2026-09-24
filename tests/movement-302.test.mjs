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

test('movement 302 is the sideways two-weight crown-wheel escapement', () => {
  const movement = catalog.movements[301];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    presentation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 302);
  assert.equal(movement.number, '302');
  assert.equal(movement.title,
    'Two-weight balance crown-wheel verge escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'sideways-two-weight-balance-on-two-pallet-verge-and-horizontal-crown-wheel');
  assert.equal(archetype, movement.archetype);
  assert.match(presentation, /crown wheel held sideways/);
  assert.match(mechanism, /two-weight balance C/);
  assert.match(mechanism, /pallets A and B/);
  assert.match(mechanism, /recoils before reversal/);
  assert.equal(transmission.balanceType, 'rigid two-weight balance');
  assert.equal(transmission.activePalletContactsAtOnce, 1);
  assert.equal(transmission.palletsShareBalanceArbor, true);

  assert.equal(blocks.crownWheel.parent, model.root);
  assert.equal(blocks.crownShaft.parent, model.root);
  assert.equal(blocks.drivePinion.parent, model.root);
  assert.equal(blocks.verge.parent, model.root);
  assert.equal(blocks.balanceAssembly.parent, blocks.verge);
  assert.equal(blocks.balanceStaff.parent, blocks.verge);
  assert.equal(blocks.balanceArm.parent, blocks.balanceAssembly);
  assert.equal(blocks.balanceMasses.length, 2);
  assert.equal(blocks.palletCarriers.length, 2);
  assert.equal(blocks.crownWheel.userData.toothMeshes.length, 21);
  vectorNear(blocks.crownWheel.userData.worldAxis,
    new THREE.Vector3(0, 1, 0), 1e-15, 'vertical crown arbor');
  vectorNear(blocks.balanceStaff.userData.worldAxis,
    new THREE.Vector3(0, 0, 1), 1e-15, 'out-of-page balance arbor');
  assert.ok(model.cameraDirection.clone().normalize().dot(
    new THREE.Vector3(0, 0, 1),
  ) > 0.995, 'default camera closely follows Brown’s front elevation');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role.endsWith('source-pose-balance-weight')).length, 2);
  assert.equal(roles.filter((role) =>
    role.endsWith('pallet-carrier-arm')).length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 302 records Brown’s elevation and Denison’s period explanation', () => {
  const movement = catalog.movements[301];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.plate302;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_302.html');
  assert.match(sourceAnimation.referenceScope, /vertical crown arbor/);
  assert.match(sourceAnimation.referenceScope, /two pallets A and B/);
  assert.equal(sourceReference.sourceUrl, movement.sourceUrl);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(sourceReference.primaryScan.illustrationPage, 74);
  assert.equal(sourceReference.primaryScan.descriptionPage, 75);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.rasterBalancePivotC,
    new THREE.Vector2(266, 201));
  assert.deepEqual(plate.rasterCrownWheelBounds, {
    bottom: 303,
    left: 97,
    right: 425,
    top: 235,
  });
  assert.deepEqual(plate.rasterCrownArborEndpoints, [
    new THREE.Vector2(264, 303),
    new THREE.Vector2(264, 501),
  ]);
  assert.deepEqual(plate.rasterUpperWeightBounds, {
    bottom: 101,
    left: 176,
    right: 267,
    top: 7,
  });
  assert.deepEqual(plate.rasterLowerWeightBounds, {
    bottom: 419,
    left: 297,
    right: 392,
    top: 317,
  });
  assert.deepEqual(plate.rasterDrivePinionBounds, {
    bottom: 485,
    left: 238,
    right: 291,
    top: 442,
  });
  assert.match(plate.inferredTopology, /edge-on horizontal crown wheel D/);
  assert.match(plate.inferredTopology, /front\/back pallets A and B/);
  assert.equal(sourceReference.periodReference.author,
    'Edmund Beckett Denison');
  assert.equal(sourceReference.periodReference.figure, 'Figure 4');
  assert.equal(sourceReference.periodReference.printedPage, 23);
  assert.equal(sourceReference.periodReference.publicationYear, 1857);
  assert.match(sourceReference.periodReference.description,
    /continuing balance motion drives the wheel backward/);
  disposeModel(model.root);
});

test('movement 302 builds one odd-tooth crown wheel under one rigid weighted balance', () => {
  const model = createMovementModel(catalog.movements[301]);
  const { blocks, geometry, transmission } = model.root.userData;

  // Brown draws about ten fine teeth across the edge-on band.
  assert.equal(geometry.toothCount, 21);
  assert.equal(geometry.toothCount % 2, 1);
  near(geometry.toothPitch, 2 * Math.PI / 21, 1e-15,
    'twenty-one-tooth pitch');
  near(geometry.halfToothPitch, geometry.toothPitch / 2, 0,
    'one beat advance');
  // Brown's saw teeth stand about 0.85-1 of the plain band depth.
  assert.ok(geometry.toothTipZ / geometry.bodyDepth > 0.85);
  assert.ok(geometry.toothTipZ / geometry.bodyDepth < 1.25,
    'axial teeth retain Brown’s compact edge-view proportions');
  // Brown's A and B hang from C in a 57-degree V (Denison's text says
  // about a right angle; the plate wins).
  near(THREE.MathUtils.radToDeg(geometry.palletIncludedAngle),
    57, 1e-12, 'Brown\'s narrow V of pallets');
  assert.equal(transmission.oddCrownToothCountRequired, true);
  assert.equal(transmission.crownWheelTeeth, 21);
  assert.equal(transmission.pinionRigidlyCoaxialWithCrownWheel, true);
  near(blocks.crownWheel.userData.worldAxis.dot(
    blocks.balanceStaff.userData.worldAxis,
  ), 0, 1e-15, 'perpendicular escape and balance arbors');
  vectorNear(blocks.drivePinion.userData.worldAxis,
    blocks.crownWheel.userData.worldAxis, 1e-15,
    'drive pinion shares crown arbor');

  const firstCenter = blocks.balanceMasses[0].position;
  const secondCenter = blocks.balanceMasses[1].position;
  vectorNear(firstCenter.clone().add(secondCenter),
    new THREE.Vector3(), 1e-15, 'opposite balance masses');
  near(firstCenter.length(), geometry.balanceMassDistance, 1e-15,
    'first mass radius');
  near(secondCenter.length(), geometry.balanceMassDistance, 1e-15,
    'second mass radius');
  near(blocks.balanceMasses[0].geometry.parameters.radius,
    geometry.balanceMassRadius, 0, 'equal upper mass size');
  near(blocks.balanceMasses[1].geometry.parameters.radius,
    geometry.balanceMassRadius, 0, 'equal lower mass size');

  model.update(0, 0);
  model.root.updateMatrixWorld(true);
  const hub = blocks.balanceHub.getWorldPosition(new THREE.Vector3());
  const upper = blocks.balanceMasses[0].getWorldPosition(
    new THREE.Vector3(),
  ).sub(hub);
  near(Math.atan2(upper.y, upper.x), geometry.sourcePoseArmAngle,
    1e-12, 'engraved balance-arm diagonal');
  disposeModel(model.root);
});

test('movement 302 alternates one exact pallet contact across two finite drops', () => {
  const model = createMovementModel(catalog.movements[301]);
  const states = [];
  let priorFreeDrop = false;
  let dropEntries = 0;
  const contactedPallets = new Set();

  for (let index = 0; index <= 4000; index += 1) {
    const state = model.root.userData.stateAtCycleCoordinate(index / 4000);
    states.push(state);
    if (state.freeDrop && !priorFreeDrop) dropEntries += 1;
    priorFreeDrop = state.freeDrop;
    if (state.activePallet) contactedPallets.add(state.activePallet);

    assert.equal(state.freeDrop, state.activePallet === null);
    assert.equal(state.contact === null, state.activePallet === null);
    if (state.contact) {
      assert.ok(state.contact.contactCoordinate >= -1e-9);
      assert.ok(state.contact.contactCoordinate <= 1 + 1e-9);
      near(state.contact.palletPlaneSeparation, 0, 4e-15,
        `contact plane at sample ${index}`);
      near(state.contact.toothPhaseError, 0, 2e-15,
        `tooth phase at sample ${index}`);
      near(state.contact.normalVelocityError, 0, 4e-15,
        `normal closure rate at sample ${index}`);
    } else {
      assert.ok(state.freeDropState);
      assert.ok(state.freeDropState.progress >= 0);
      assert.ok(state.freeDropState.progress <= 1);
    }
  }

  assert.equal(dropEntries, 2);
  assert.deepEqual([...contactedPallets].sort(), ['left', 'right']);
  const dropStates = states.filter(({ freeDrop }) => freeDrop);
  // Each drop lasts about 0.025 cycle with Brown's narrow V and short
  // release.
  assert.ok(dropStates.length > 150,
    'both drops occupy visible finite intervals');
  assert.ok(dropStates.every(({ wheelAngularSpeed }) =>
    wheelAngularSpeed >= -1e-10), 'both free drops advance the wheel');
  disposeModel(model.root);
});

test('movement 302 recoils, gives direct impulse, and advances one tooth per cycle', () => {
  const model = createMovementModel(catalog.movements[301]);
  const { geometry, stateAtCycleCoordinate, transmission } =
    model.root.userData;
  const sideRates = {
    left: { maximum: -Infinity, minimum: Infinity },
    right: { maximum: -Infinity, minimum: Infinity },
  };
  const dropAngles = [];

  for (let index = 0; index <= 8000; index += 1) {
    const state = stateAtCycleCoordinate(index / 8000);
    if (state.activePallet) {
      const rates = sideRates[state.activePallet];
      rates.minimum = Math.min(rates.minimum, state.wheelAngularSpeed);
      rates.maximum = Math.max(rates.maximum, state.wheelAngularSpeed);
    }
    if (state.freeDrop) dropAngles.push(state.wheelAngle);
  }
  for (const side of ['left', 'right']) {
    assert.ok(sideRates[side].minimum < -1e-3,
      `${side} pallet produces visible recoil`);
    assert.ok(sideRates[side].maximum > 1e-2,
      `${side} pallet produces direct impulse`);
  }
  for (let index = 1; index < dropAngles.length; index += 1) {
    const delta = dropAngles[index] - dropAngles[index - 1];
    if (delta < -geometry.toothPitch / 2) continue;
    assert.ok(delta >= -1e-9, 'each individual drop is monotonic');
  }

  const start = stateAtCycleCoordinate(0);
  const half = stateAtCycleCoordinate(0.5);
  const end = stateAtCycleCoordinate(1);
  near(end.balanceAngle, start.balanceAngle, 2e-15,
    'balance cycle closure');
  near(end.wheelAngle - start.wheelAngle, geometry.toothPitch, 2e-15,
    'one crown tooth per oscillation');
  near(half.teethAdvanced, 0.5, 2e-15,
    'half a tooth after one beat');
  near(end.teethAdvanced, 1, 2e-15,
    'one tooth after two beats');
  near(transmission.contactAdvancePerBeatInToothPitches
    + transmission.dropPerBeatInToothPitches,
  0.5, 2e-15, 'contact plus drop equals one half-pitch');
  assert.equal(transmission.recoil, true);
  disposeModel(model.root);
});

test('movement 302 analytic balance and crown-wheel rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[301]);
  const stateAtTime = model.root.userData.stateAtTime;
  const epsilon = 1e-5;

  for (const time of [0.82, 1.42, 2.42, 3.22]) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near(
      (after.balanceAngle - before.balanceAngle) / (2 * epsilon),
      state.balanceAngularSpeed,
      2e-9,
      `balance rate at t=${time}`,
    );
    near(
      (after.wheelAngle - before.wheelAngle) / (2 * epsilon),
      state.wheelAngularSpeed,
      2e-8,
      `crown rate at t=${time}`,
    );
    near(state.drivePinionAngularSpeed, state.crownWheelAngularSpeed,
      0, `rigid pinion rate at t=${time}`);
  }
  disposeModel(model.root);
});

test('movement 302 renderer follows the solved balance, wheel, and live contact', () => {
  const model = createMovementModel(catalog.movements[301]);
  const { blocks, canonicalTimes, stateAtTime } = model.root.userData;

  for (const time of [
    0,
    canonicalTimes.firstFreeDropMidpoint,
    canonicalTimes.leftRecoilMidpoint,
    canonicalTimes.leftImpulseMidpoint,
    canonicalTimes.secondFreeDropMidpoint,
    canonicalTimes.rightRecoilMidpoint,
    canonicalTimes.rightImpulseMidpoint,
  ]) {
    model.update(time, 0.016);
    const state = stateAtTime(time);
    near(blocks.verge.rotation.x, state.balanceAngle, 0,
      `balance render at t=${time}`);
    near(blocks.crownWheel.userData.rotor.rotation.z,
      state.crownWheelAngle, 0, `crown render at t=${time}`);
    near(blocks.crownShaft.userData.rotor.rotation.z,
      state.crownWheelAngle, 0, `crown arbor render at t=${time}`);
    near(blocks.drivePinion.userData.rotor.rotation.z,
      state.drivePinionAngle, 0, `pinion render at t=${time}`);
    assert.equal(blocks.leftContactMarker.visible, false);
    assert.equal(blocks.leftContactMarker.userData.active,
      state.activePallet === 'left');
    assert.equal(blocks.rightContactMarker.visible, false);
    assert.equal(blocks.rightContactMarker.userData.active,
      state.activePallet === 'right');
    const contactValues = Object.values(model.root.userData.contacts)
      .filter((contact) => contact !== null);
    assert.equal(contactValues.length, 1,
      `one contact or one free-drop record at t=${time}`);
  }
  assert.equal(blocks.toothWitness.parent,
    blocks.crownWheel.userData.rotor);
  assert.equal(blocks.balanceWitness.parent, blocks.balanceAssembly);
  disposeModel(model.root);
});

test('movement 302 closes in four authored seconds and leaves movement 507 authored', () => {
  const movement = catalog.movements[301];
  const model = createMovementModel(movement);
  const timing = model.root.userData.animationTiming;
  const { geometry, stateAtTime } = model.root.userData;

  assert.equal(geometry.cyclePeriod, 4);
  assert.equal(timing.authoredCyclePeriod, 4);
  assert.equal(timing.targetCycleDuration, 2);
  assertReadableTiming(timing);
  const start = stateAtTime(0);
  const end = stateAtTime(4);
  near(end.balanceAngle, start.balanceAngle, 2e-15,
    'four-second balance closure');
  near(end.wheelAngle - start.wheelAngle, geometry.toothPitch, 2e-15,
    'four-second crown advance');
  assert.equal(start.activePallet, 'right');
  assert.equal(start.sourcePose, true);

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
