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

test('movement 299 is one clock verge, weighted foliot, and perpendicular crown wheel', () => {
  const movement = catalog.movements[298];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 299);
  assert.equal(movement.number, '299');
  assert.equal(movement.title,
    'Old-fashioned clock verge-and-foliot escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'recoiling-verge-and-weighted-foliot-clock-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /weighted horizontal foliot/);
  assert.match(mechanism, /vertical two-pallet verge/);
  assert.match(mechanism, /odd thirteen-tooth crown wheel/);
  assert.equal(transmission.crownWheelTeeth, 13);
  assert.equal(transmission.activePalletContactsAtOnce, 1);
  assert.equal(transmission.foliotWeightsAdjustRate, true);

  assert.equal(blocks.crownWheel.parent, model.root);
  assert.equal(blocks.crownShaft.parent, model.root);
  assert.equal(blocks.verge.parent, model.root);
  assert.equal(blocks.vergeStaff.parent, blocks.verge);
  // The foliot is built on the verge, but Brown's cropped detail does not
  // show it, so the source presentation detaches it.
  assert.equal(blocks.foliot.parent, null);
  // Brown draws no rotation witness mark on the crown wheel either.
  assert.deepEqual(model.root.userData.sourcePresentation.removedRoles,
    ['crown-wheel-rotation-witness', 'weighted-horizontal-foliot-regulator']);
  assert.equal(blocks.foliotBar.parent, blocks.foliot);
  assert.equal(blocks.rightPallet.pallet.parent, blocks.verge);
  assert.equal(blocks.leftPallet.pallet.parent, blocks.verge);
  vectorNear(blocks.crownWheel.userData.worldAxis,
    new THREE.Vector3(1, 0, 0), 2e-15, 'horizontal crown arbor');
  vectorNear(blocks.verge.userData.worldAxis,
    new THREE.Vector3(0, 1, 0), 2e-15, 'vertical verge staff');
  vectorNear(blocks.foliot.userData.worldAxis,
    new THREE.Vector3(0, 1, 0), 2e-15, 'foliot rotation axis');
  near(blocks.crownWheel.userData.worldAxis.dot(
    blocks.verge.userData.worldAxis,
  ), 0, 2e-15, 'crown and verge axes are perpendicular');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role === 'axial-saw-tooth').length,
    13);
  assert.equal(roles.filter((role) =>
    /pallet-A-contact-face$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /adjustable-foliot-weight$/.test(role)).length, 0);
  assert.equal(blocks.foliotWeights.filter((weight) =>
    /adjustable-foliot-weight$/.test(weight.userData.role)).length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 299 records Brown’s edge-on crown and measured angular pallets', () => {
  const movement = catalog.movements[298];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToPresentation,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate299;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /edge-on crown wheel/);
  assert.match(sourceAnimation.referenceScope, /central verge journal/);
  assert.match(sourceAnimation.referenceScope, /weighted foliot/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_299.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.rasterVergeJournal,
    new THREE.Vector2(293, 178));
  assert.deepEqual(plate.rasterLeftPalletTip,
    new THREE.Vector2(207, 319));
  assert.deepEqual(plate.rasterRightPalletTip,
    new THREE.Vector2(438, 218));
  assert.deepEqual(plate.rasterLeftCrownContact,
    new THREE.Vector2(108, 329));
  assert.deepEqual(plate.rasterRightCrownContact,
    new THREE.Vector2(337, 329));
  assert.deepEqual(plate.rasterLeftToothApex,
    new THREE.Vector2(191, 205));
  assert.deepEqual(plate.rasterRightToothApex,
    new THREE.Vector2(439, 218));
  assert.deepEqual(plate.rasterCrownBounds, {
    bottom: 395,
    left: 15,
    right: 511,
    top: 204,
  });
  near(plate.sourcePalletIncludedAngleDegrees,
    105.95806810320178, 1e-12, 'measured plate pallet angle');
  near(geometry.sourcePalletIncludedAngle,
    THREE.MathUtils.degToRad(plate.sourcePalletIncludedAngleDegrees),
    2e-16, 'stored plate pallet angle');
  assert.equal(plate.modeledCrownToothCount, 13);
  assert.match(plate.toothCountBasis, /mandatory odd count/);
  assert.match(plate.inferredTopology, /crown wheel shown nearly edge-on/);
  assert.match(plate.inferredTopology, /two angular pallet blades/);
  assert.match(plate.inferredTopology, /foliot is historically implied/);
  vectorNear(
    sourcePointToPresentation(plate.rasterVergeJournal),
    new THREE.Vector2(),
    0,
    'source verge journal origin',
  );
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.periodReference.publicationYear, 2020);
  assert.match(sourceReference.periodReference.description,
    /saw-tooth crown wheel/);
  assert.match(sourceReference.periodReference.description,
    /recoil before reversal/);
  disposeModel(model.root);
});

test('movement 299 builds an adjustable two-weight foliot and an open odd-tooth crown', () => {
  const model = createMovementModel(catalog.movements[298]);
  const { blocks, geometry, transmission } = model.root.userData;

  assert.equal(blocks.foliotWeights.length, 2);
  near(blocks.foliotWeights[0].position.y,
    -geometry.foliotWeightOffset, 0, 'left foliot weight station');
  near(blocks.foliotWeights[1].position.y,
    geometry.foliotWeightOffset, 0, 'right foliot weight station');
  near(blocks.foliotWeights[0].position.y
    + blocks.foliotWeights[1].position.y,
  0, 0, 'foliot weights balance around staff');
  near(blocks.foliotBar.geometry.parameters.height,
    geometry.foliotBarLength, 0, 'full foliot bar length');
  near(blocks.foliot.position.x,
    geometry.foliotPositionOnStaff, 0, 'foliot sits at top of staff');
  assert.equal(blocks.foliotHub.parent, blocks.foliot);
  assert.equal(blocks.foliotIndex.parent, blocks.foliot);
  near(THREE.MathUtils.radToDeg(geometry.foliotAmplitude),
    45, 1e-14, 'historical broad foliot half-swing');

  assert.equal(blocks.crownWheel.userData.teeth, 13);
  assert.equal(blocks.crownWheel.userData.toothMeshes.length, 13);
  assert.equal(blocks.crownWheel.userData.toothTips.length, 13);
  // Brown draws the solid band under the teeth.
  assert.equal(blocks.crownWheel.userData.body.visible, true);
  assert.equal(blocks.crownRim.parent,
    blocks.crownWheel.userData.rotor);
  assert.equal(blocks.crownSpokes.length, 4);
  blocks.crownSpokes.forEach((spoke, index) => {
    assert.equal(spoke.parent, blocks.crownWheel.userData.rotor);
    assert.equal(spoke.userData.index, index);
  });
  assert.equal(transmission.oddCrownToothCountRequired, true);
  near(geometry.toothPitch, Math.PI * 2 / 13, 0,
    'thirteen-tooth pitch');
  near(THREE.MathUtils.radToDeg(geometry.palletIncludedAngle),
    100, 1e-14, 'modeled pallet included angle');
  assert.ok(geometry.palletFaceSpan > 0, 'working face has positive span');
  assert.ok(transmission.dropPerBeatInDegrees > 1.5);
  assert.ok(transmission.dropPerBeatInDegrees < 3);
  disposeModel(model.root);
});

test('movement 299 alternates one exact pallet contact around two finite free drops', () => {
  const model = createMovementModel(catalog.movements[298]);
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
      state.foliotAngle,
      state.foliotAngularAcceleration,
      state.foliotAngularSpeed,
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
      assert.ok(state.freeDropState, 'drop exposes both adjacent teeth');
      assert.ok(state.dropProgress >= 0 && state.dropProgress <= 1,
        'drop progress stays normalized');
    }
  }

  assert.deepEqual([...seenPallets].sort(), ['left', 'right']);
  assert.ok(contactSamples > 31000, 'contact occupies most of cycle');
  assert.ok(freeDropSamples > 800, 'both finite drops are sampled');
  assert.ok(minimumCoordinate >= -5e-14,
    `contact stays beyond root: ${minimumCoordinate}`);
  assert.ok(maximumCoordinate <= 1 + 5e-14,
    `contact stays before release edge: ${maximumCoordinate}`);
  assert.ok(maximumNormalVelocityError < 4e-15,
    `exact normal velocity closure: ${maximumNormalVelocityError}`);

  const firstDrop = stateAtCycleCoordinate(
    (geometry.firstReleasePhase + geometry.firstCatchPhase) / 2,
  );
  const secondDrop = stateAtCycleCoordinate(
    (geometry.secondReleasePhase + geometry.secondCatchPhase) / 2,
  );
  assert.equal(stateAtCycleCoordinate(0.1).activePallet, 'right');
  assert.equal(firstDrop.activePallet, null);
  assert.equal(firstDrop.approachingPallet, 'left');
  assert.equal(stateAtCycleCoordinate(0.6).activePallet, 'left');
  assert.equal(secondDrop.activePallet, null);
  assert.equal(secondDrop.approachingPallet, 'right');
  disposeModel(model.root);
});

test('movement 299 recoils, drops forward, and advances one crown tooth per foliot oscillation', () => {
  const model = createMovementModel(catalog.movements[298]);
  const { geometry, stateAtCycleCoordinate, transmission } =
    model.root.userData;
  const source = stateAtCycleCoordinate(0);
  const half = stateAtCycleCoordinate(0.5);
  const closure = stateAtCycleCoordinate(1);
  near(half.crownWheelAngle - source.crownWheelAngle,
    geometry.toothPitch / 2, 2e-16, 'one half-tooth per beat');
  near(closure.crownWheelAngle - source.crownWheelAngle,
    geometry.toothPitch, 2e-16, 'one tooth per foliot oscillation');
  near(closure.foliotAngle, source.foliotAngle, 0,
    'foliot closes one oscillation');
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
        'free crown drop never reverses');
      previousAngle = angle;
    }
  }

  const observed = new Set();
  for (let index = 0; index < 4096; index += 1) {
    const state = stateAtCycleCoordinate(index / 4096);
    if (state.activePallet && state.recoil) {
      observed.add(`${state.activePallet}-recoil`);
    }
    if (state.activePallet && state.directImpulse) {
      observed.add(`${state.activePallet}-impulse`);
    }
  }
  assert.deepEqual([...observed].sort(), [
    'left-impulse',
    'left-recoil',
    'right-impulse',
    'right-recoil',
  ]);

  for (const boundary of [
    geometry.firstReleasePhase,
    geometry.firstCatchPhase,
    geometry.secondReleasePhase,
    geometry.secondCatchPhase,
  ]) {
    const epsilon = 1e-9;
    const before = stateAtCycleCoordinate(boundary - epsilon);
    const after = stateAtCycleCoordinate(boundary + epsilon);
    near(before.crownWheelAngle, after.crownWheelAngle, 1e-8,
      `position-continuous crown handoff at ${boundary}`);
    near(before.foliotAngle, after.foliotAngle, 1e-8,
      `continuous foliot at ${boundary}`);
  }
  disposeModel(model.root);
});

test('movement 299 analytic foliot and crown rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[298]);
  const { stateAtTime } = model.root.userData;
  const h = 1e-5;
  for (const time of [0.2, 0.7, 1.0, 1.6, 1.9, 2.2, 2.7, 3.0, 3.6, 3.9]) {
    const before = stateAtTime(time - h);
    const state = stateAtTime(time);
    const after = stateAtTime(time + h);
    const foliotSpeed = (
      after.foliotAngle - before.foliotAngle
    ) / (2 * h);
    const foliotAcceleration = (
      after.foliotAngle - 2 * state.foliotAngle + before.foliotAngle
    ) / h ** 2;
    const crownSpeed = (
      after.crownWheelAngle - before.crownWheelAngle
    ) / (2 * h);
    const crownAcceleration = (
      after.crownWheelAngle - 2 * state.crownWheelAngle
      + before.crownWheelAngle
    ) / h ** 2;
    near(foliotSpeed, state.foliotAngularSpeed, 2e-9,
      `foliot speed at ${time}`);
    near(foliotAcceleration, state.foliotAngularAcceleration, 8e-6,
      `foliot acceleration at ${time}`);
    near(crownSpeed, state.crownWheelAngularSpeed, 1e-8,
      `crown speed at ${time}`);
    near(crownAcceleration, state.crownWheelAngularAcceleration, 3e-5,
      `crown acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 299 renderer binds the foliot, crown, witnesses, and contact state', () => {
  const model = createMovementModel(catalog.movements[298]);
  const { blocks, stateAtTime } = model.root.userData;

  for (const time of [0, 0.8, 1.39, 1.7, 2.4, 3.39, 3.7, 4]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.verge.rotation.x, state.foliotAngle, 0,
      `rendered foliot at ${time}`);
    near(blocks.crownWheel.userData.rotor.rotation.z,
      state.crownWheelAngle, 0, `rendered crown wheel at ${time}`);
    near(blocks.crownShaft.userData.rotor.rotation.z,
      state.crownWheelAngle, 0, `rendered crown shaft at ${time}`);
    near(blocks.verge.userData.angularSpeed,
      state.foliotAngularSpeed, 0, `reported verge speed at ${time}`);
    near(blocks.foliot.userData.angularSpeed,
      state.foliotAngularSpeed, 0, `reported foliot speed at ${time}`);
    near(blocks.crownWheel.userData.angularSpeed,
      state.crownWheelAngularSpeed, 0, `reported crown speed at ${time}`);
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

test('movement 299 publishes its reviewed cycle and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[298]);
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
    near(closure.foliotAngle, start.foliotAngle, 0,
      `foliot closes cycle ${cycle}`);
    near(closure.crownWheelAngle - start.crownWheelAngle,
      cycle * geometry.toothPitch, 2e-15,
      `crown advances ${cycle} teeth`);
  }
  near(
    stateAtTime(13 * geometry.cyclePeriod).crownWheelAngle
      - start.crownWheelAngle,
    Math.PI * 2,
    2e-15,
    'thirteen oscillations close the crown wheel',
  );
  assert.match(sourceReference.plate299.inferredTopology,
    /one crown wheel shown nearly edge-on/);

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});

test('movement 299 crown teeth are Brown’s raked saw teeth with no flat gaps', () => {
  const model = createMovementModel(catalog.movements[298]);
  const wheel = model.root.userData.blocks.crownWheel.userData;
  const { toothPitch } = model.root.userData.geometry;
  near(wheel.toothRakeAngle, 0.35 * toothPitch, 1e-15, 'raked leading face');
  near(wheel.toothBackAngle, toothPitch + wheel.toothRakeAngle, 1e-15,
    'each back starts at the foot of the tooth behind');
  for (const tooth of wheel.toothMeshes) {
    const p = tooth.geometry.attributes.position;
    const angle = tooth.userData.mountAngle;
    let tipZ = -Infinity;
    for (let i = 0; i < p.count; i += 1) tipZ = Math.max(tipZ, p.getZ(i));
    for (let i = 0; i < p.count; i += 1) {
      const offset = Math.atan2(Math.sin(Math.atan2(p.getY(i), p.getX(i)) - angle),
        Math.cos(Math.atan2(p.getY(i), p.getX(i)) - angle));
      assert.ok(offset < 1e-6, 'no material ahead of the tip');
      // Below half height the raked face lies at least half the rake behind.
      if (p.getZ(i) < tipZ / 2) {
        assert.ok(offset < -wheel.toothRakeAngle / 2 + 1e-6,
          'lower leading face is raked back from the tip');
      }
    }
  }
  disposeModel(model.root);
});
