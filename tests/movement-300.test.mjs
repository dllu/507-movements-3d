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

test('movement 300 is the front elevation of one Debaufre double-wheel escapement', () => {
  const movement = catalog.movements[299];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    pairedMechanismKey,
    presentation,
    presentationView,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 300);
  assert.equal(movement.number, '300');
  assert.equal(movement.title,
    'Debaufre double-wheel frictional-rest escapement — front elevation');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'debaufre-rigid-double-ratchet-wheel-single-d-pallet-frictional-rest-front-elevation');
  assert.equal(archetype, movement.archetype);
  assert.equal(presentation, 'front elevation');
  assert.equal(presentationView, 'front');
  assert.equal(pairedMechanismKey,
    'brown-300-301-debaufre-double-wheel-escapement');
  assert.match(mechanism, /two thin twelve-tooth/);
  assert.match(mechanism, /rigidly coaxial/);
  assert.match(mechanism, /one short D-section pallet/);
  assert.equal(transmission.wheelsRigidlyCoupled, true);
  assert.equal(transmission.toothSetsAlternate, true);
  assert.equal(transmission.activeContactsAtOnce, 1);
  assert.equal(transmission.palletCount, 1);

  assert.equal(blocks.frontWheel.parent, model.root);
  assert.equal(blocks.rearWheel.parent, model.root);
  assert.equal(blocks.commonEscapeArbor.parent, model.root);
  assert.equal(blocks.palletAssembly.parent, model.root);
  assert.equal(blocks.palletBody.parent, blocks.palletAssembly);
  assert.equal(blocks.balanceStaff.parent, blocks.palletAssembly);
  assert.equal(blocks.impulseLips.length, 2);
  vectorNear(blocks.frontWheel.userData.worldAxis,
    new THREE.Vector3(0, 0, 1), 0, 'front wheel arbor');
  vectorNear(blocks.rearWheel.userData.worldAxis,
    new THREE.Vector3(0, 0, 1), 0, 'rear wheel arbor');
  vectorNear(blocks.palletAssembly.userData.worldAxis,
    new THREE.Vector3(1, 0, 0), 0, 'balance staff');
  near(blocks.frontWheel.userData.worldAxis.dot(
    blocks.palletAssembly.userData.worldAxis,
  ), 0, 0, 'escape and balance axes are orthogonal');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'debaufre-undercut-ratchet-tooth').length, 24);
  assert.equal(roles.filter((role) =>
    role === 'single-d-section-frictional-rest-pallet').length, 1);
  assert.equal(roles.filter((role) =>
    /forty-five-degree-impulse-flange$/.test(role)).length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 300 records both Brown elevations and Reid’s period construction', () => {
  const movement = catalog.movements[299];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToPresentation,
    sourceReference,
  } = model.root.userData;
  const front = sourceReference.plate300;
  const side = sourceReference.plate301;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /front elevation/);
  assert.match(sourceAnimation.referenceScope, /paired side elevation/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_300.html');
  assert.equal(sourceReference.pairedSourceUrl,
    'https://507movements.com/mm_301.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(front.imageWidth, 525);
  assert.equal(front.imageHeight, 525);
  assert.equal(front.measurementUncertaintyPixels, 8);
  assert.deepEqual(front.rasterWheelCenter, new THREE.Vector2(267, 166));
  assert.deepEqual(front.rasterPalletCenter, new THREE.Vector2(244, 401));
  assert.deepEqual(front.rasterWheelBounds, {
    bottom: 395,
    left: 31,
    right: 492,
    top: 22,
  });
  assert.deepEqual(front.rasterBalanceStaffEndpoints, {
    left: new THREE.Vector2(57, 398),
    right: new THREE.Vector2(472, 407),
  });
  assert.equal(front.modeledTeethPerWheel, 12);
  assert.equal(front.modeledProjectedToothStations, 24);
  assert.match(front.toothCountBasis, /twenty-four alternating/);
  assert.match(front.inferredTopology, /superposed equal ratchet wheels/);
  assert.match(front.inferredTopology, /one edge-on pallet/);

  assert.equal(side.measurementUncertaintyPixels, 7);
  assert.deepEqual(side.rasterEscapeArborCenter,
    new THREE.Vector2(263, 93));
  assert.deepEqual(side.rasterWheelPlanes, { front: 330, rear: 201 });
  assert.deepEqual(side.rasterPalletJournal,
    new THREE.Vector2(263, 437));
  assert.deepEqual(side.rasterPalletBounds, {
    bottom: 521,
    left: 181,
    right: 345,
    top: 417,
  });
  assert.match(side.inferredTopology, /two parallel wheel planes/);
  assert.match(side.inferredTopology, /single D-section pallet/);
  vectorNear(
    sourcePointToPresentation(front.rasterWheelCenter),
    new THREE.Vector2(0, geometry.wheelCenterY),
    0,
    'source wheel center',
  );
  near(
    sourcePointToPresentation(front.rasterPalletCenter).y,
    geometry.wheelCenterY - geometry.wheelContactRadius,
    0,
    'source center spacing sets contact radius',
  );
  assert.equal(sourceReference.periodReference.author, 'Thomas Reid');
  assert.equal(sourceReference.periodReference.publicationYear, 1847);
  assert.equal(sourceReference.periodReference.figure,
    'Plate VIII, figure 45');
  assert.match(sourceReference.periodReference.description,
    /teeth opposite the middle/);
  assert.match(sourceReference.periodReference.description,
    /rounded flange to impulse/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 300 builds one half-pitch pair on a common arbor around one pallet', () => {
  const model = createMovementModel(catalog.movements[299]);
  const { blocks, geometry, transmission } = model.root.userData;

  assert.equal(blocks.frontWheel.userData.teeth, 12);
  assert.equal(blocks.rearWheel.userData.teeth, 12);
  assert.equal(blocks.frontWheel.userData.toothMeshes.length, 12);
  assert.equal(blocks.rearWheel.userData.toothMeshes.length, 12);
  // Ordinary four-spoked wheels (Brown cuts off the upper two spokes), each
  // one plate from the shared builder with plain sharp spoke corners.
  for (const wheel of [blocks.frontWheel, blocks.rearWheel]) {
    const params = wheel.userData.plate.geometry.userData.spokedWheel;
    assert.equal(params.spokes, 4);
    assert.equal(params.rimFillet, 0);
    assert.equal(params.hubFillet, 0);
    const angles = wheel.userData.spokeAngles;
    for (let index = 1; index < 4; index += 1) {
      near(angles[index] - angles[index - 1], Math.PI / 2, 1e-12, 'spokes 90 degrees apart');
    }
    // Down-left spoke about 37 degrees off the vertical, as drawn.
    near(1.5 * Math.PI - angles[2], THREE.MathUtils.degToRad(37), 1e-12, 'plate spoke phase');
    assert.ok(wheel.userData.toothMeshes.every((tooth) => !tooth.visible),
      'visible teeth are part of the plate');
  }
  near(blocks.frontWheel.position.z,
    geometry.wheelPlaneOffset, 0, 'front wheel plane');
  near(blocks.rearWheel.position.z,
    -geometry.wheelPlaneOffset, 0, 'rear wheel plane');
  near(blocks.frontWheel.userData.mountPhase,
    geometry.frontMountPhase, 0, 'front mounted phase');
  near(blocks.rearWheel.userData.mountPhase,
    geometry.rearMountPhase, 0, 'rear mounted phase');
  near(geometry.rearMountPhase - geometry.frontMountPhase,
    geometry.halfToothPitch, 1e-16, 'structural half-pitch offset');
  near(THREE.MathUtils.radToDeg(geometry.halfToothPitch),
    15, 2e-15, 'fifteen-degree projected alternation');
  near(geometry.palletThickness,
    2 * geometry.wheelContactRadius
      * Math.sin(geometry.impulseAdvance / 2),
  0, 'pallet thickness spans the symmetric impulse chord');
  assert.equal(blocks.palletBody.userData.profile,
    'short-cylinder-with-half-cut-away');
  for (const lip of blocks.impulseLips) {
    near(lip.userData.chamferAngle, Math.PI / 4, 0,
      'historical forty-five-degree flange');
  }
  assert.equal(transmission.commonArbor, true);
  assert.equal(transmission.wheelTeethEach, 12);
  near(transmission.rearToFrontMountPhaseDegrees, 15, 2e-15,
    'reported half-pitch mounting phase');
  assert.equal(transmission.frictionalRest, true);
  assert.match(transmission.topology, /two-rigid-coaxial-half-pitch/);
  disposeModel(model.root);
});

test('movement 300 alternates exactly one tooth contact across two finite drops', () => {
  const model = createMovementModel(catalog.movements[299]);
  const { stateAtCycleCoordinate } = model.root.userData;
  const seenWheels = new Set();
  const seenStages = new Set();
  let contactSamples = 0;
  let dropSamples = 0;
  let maximumPhaseError = 0;

  for (let index = 0; index <= 32768; index += 1) {
    const state = stateAtCycleCoordinate(index / 32768);
    for (const value of [
      state.palletAngle,
      state.palletAngularAcceleration,
      state.palletAngularSpeed,
      state.wheelAngle,
      state.wheelAngularAcceleration,
      state.wheelAngularSpeed,
    ]) assert.ok(Number.isFinite(value), 'state remains finite');
    seenStages.add(state.stage);
    assert.equal(state.activeWheel === null, state.freeDrop);
    assert.equal(state.contact === null, state.freeDrop);
    if (state.contact) {
      contactSamples += 1;
      seenWheels.add(state.activeWheel);
      assert.equal(state.contact.wheel, state.activeWheel);
      assert.equal(state.contact.directImpulse, state.directImpulse);
      assert.equal(state.contact.frictionalRest, state.frictionalRest);
      assert.equal(state.contact.slidingContact, true);
      near(state.contact.normalSeparation, 0, 0,
        `contact closure at sample ${index}`);
      near(state.contact.normalVelocityError, 0, 0,
        `normal speed closure at sample ${index}`);
      vectorNear(state.contact.toothTip,
        state.contact.palletSurfacePoint, 0,
        `tooth and pallet surface coincide at sample ${index}`);
      maximumPhaseError = Math.max(
        maximumPhaseError,
        Math.abs(state.contact.toothPhaseError),
      );
      if (state.frictionalRest) {
        near(state.wheelAngularSpeed, 0, 0,
          `dead rest at sample ${index}`);
      }
    } else {
      dropSamples += 1;
      assert.ok(state.freeDropState);
      assert.ok(state.dropProgress >= 0 && state.dropProgress <= 1);
      assert.notEqual(state.approachingWheel, state.departingWheel);
    }
  }

  assert.deepEqual([...seenWheels].sort(), ['front', 'rear']);
  assert.deepEqual([...seenStages].sort(), [
    'front-direct-impulse',
    'front-frictional-rest',
    'front-to-rear-free-drop',
    'rear-direct-impulse',
    'rear-frictional-rest',
    'rear-to-front-free-drop',
  ]);
  assert.ok(contactSamples > 30000, 'contact occupies most of the cycle');
  assert.ok(dropSamples > 2000, 'both finite drops remain visible');
  assert.ok(maximumPhaseError < 2e-15,
    `exact alternating tooth phase: ${maximumPhaseError}`);
  disposeModel(model.root);
});

test('movement 300 holds both wheels together, impulses, drops, and advances one tooth per cycle', () => {
  const model = createMovementModel(catalog.movements[299]);
  const { geometry, stateAtCycleCoordinate, transmission } =
    model.root.userData;
  const source = stateAtCycleCoordinate(0);
  const half = stateAtCycleCoordinate(0.5);
  const closure = stateAtCycleCoordinate(1);
  near(half.wheelAngle - source.wheelAngle,
    geometry.halfToothPitch, 0, 'half a tooth pitch per beat');
  near(closure.wheelAngle - source.wheelAngle,
    geometry.toothPitch, 0, 'one tooth pitch per oscillation');
  near(closure.palletAngle, source.palletAngle, 0,
    'pallet closes one oscillation');
  assert.equal(transmission.wheelAdvancePerBeatInToothPitches, 0.5);
  assert.equal(transmission.wheelAdvancePerOscillationInToothPitches, 1);

  const firstImpulseStart = stateAtCycleCoordinate(
    geometry.firstImpulseStartPhase,
  );
  const firstRelease = stateAtCycleCoordinate(geometry.firstReleasePhase);
  const firstCatch = stateAtCycleCoordinate(geometry.firstCatchPhase);
  const secondImpulseStart = stateAtCycleCoordinate(
    geometry.secondImpulseStartPhase,
  );
  const secondRelease = stateAtCycleCoordinate(geometry.secondReleasePhase);
  const secondCatch = stateAtCycleCoordinate(geometry.secondCatchPhase);
  near(firstRelease.wheelAngle - firstImpulseStart.wheelAngle,
    geometry.impulseAdvance, 2e-16, 'equal front impulse advance');
  near(firstCatch.wheelAngle - firstRelease.wheelAngle,
    geometry.dropAngle, 2e-16, 'front-to-rear drop');
  near(secondRelease.wheelAngle - secondImpulseStart.wheelAngle,
    geometry.impulseAdvance, 2e-16, 'equal rear impulse advance');
  near(secondCatch.wheelAngle - secondRelease.wheelAngle,
    geometry.dropAngle, 3e-16, 'rear-to-front drop');
  near(stateAtCycleCoordinate(geometry.firstImpulseStartPhase * 0.5).wheelAngle,
    source.wheelAngle, 0, 'front dead-rest interval');
  near(stateAtCycleCoordinate(
    (geometry.firstCatchPhase + geometry.secondImpulseStartPhase) / 2,
  ).wheelAngle, geometry.halfToothPitch, 0, 'rear dead-rest interval');

  let previous = source.wheelAngle;
  for (let index = 1; index <= 16384; index += 1) {
    const angle = stateAtCycleCoordinate(index / 16384).wheelAngle;
    assert.ok(angle >= previous - 2e-15,
      'common escape arbor never recoils');
    previous = angle;
  }
  disposeModel(model.root);
});

test('movement 300 analytic pallet and common-wheel rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[299]);
  const { stateAtTime } = model.root.userData;
  const h = 1e-5;
  for (const time of [
    0.2, 0.8, 0.91, 1.05, 1.2, 1.5,
    2.2, 2.8, 2.91, 3.05, 3.2, 3.7,
  ]) {
    const before = stateAtTime(time - h);
    const state = stateAtTime(time);
    const after = stateAtTime(time + h);
    const palletSpeed = (
      after.palletAngle - before.palletAngle
    ) / (2 * h);
    const palletAcceleration = (
      after.palletAngle - 2 * state.palletAngle + before.palletAngle
    ) / h ** 2;
    const wheelSpeed = (
      after.wheelAngle - before.wheelAngle
    ) / (2 * h);
    const wheelAcceleration = (
      after.wheelAngle - 2 * state.wheelAngle + before.wheelAngle
    ) / h ** 2;
    near(palletSpeed, state.palletAngularSpeed, 2e-9,
      `pallet speed at ${time}`);
    near(palletAcceleration, state.palletAngularAcceleration, 1.1e-5,
      `pallet acceleration at ${time}`);
    // The drop is 0.45 of a half pitch in 0.035 cycle, so the central
    // difference's h^2 error on the drop speed is about 2e-8.
    near(wheelSpeed, state.wheelAngularSpeed, 4e-8,
      `common wheel speed at ${time}`);
    near(wheelAcceleration, state.wheelAngularAcceleration, 2e-5,
      `common wheel acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 300 renderer keeps both wheels locked and exposes the one live contact', () => {
  const model = createMovementModel(catalog.movements[299]);
  const { blocks, stateAtTime } = model.root.userData;

  for (const time of [0, 0.8, 0.95, 1.2, 1.5, 2.8, 2.95, 3.2, 3.7, 4]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.frontWheel.userData.rotor.rotation.z,
      state.wheelAngle, 0, `front wheel at ${time}`);
    near(blocks.rearWheel.userData.rotor.rotation.z,
      state.wheelAngle, 0, `rear wheel at ${time}`);
    near(blocks.commonEscapeArbor.userData.rotor.rotation.z,
      state.wheelAngle, 0, `common arbor at ${time}`);
    near(blocks.palletAssembly.rotation.x,
      state.palletAngle, 0, `pallet at ${time}`);
    near(blocks.frontWheel.userData.angularSpeed,
      state.wheelAngularSpeed, 0, `front rate at ${time}`);
    near(blocks.rearWheel.userData.angularSpeed,
      state.wheelAngularSpeed, 0, `rear rate at ${time}`);
    near(blocks.palletAssembly.userData.angularSpeed,
      state.palletAngularSpeed, 0, `pallet rate at ${time}`);
    assert.equal(blocks.frontContactMarker.visible, false,
      'front diagnostic witness never renders through the parts');
    assert.equal(blocks.rearContactMarker.visible, false,
      'rear diagnostic witness never renders through the parts');
    assert.equal(blocks.frontContactMarker.userData.active,
      state.activeWheel === 'front');
    assert.equal(blocks.rearContactMarker.userData.active,
      state.activeWheel === 'rear');
    if (state.contact) {
      vectorNear(
        (state.activeWheel === 'front'
          ? blocks.frontContactMarker
          : blocks.rearContactMarker).position,
        state.contact.point,
        0,
        `hidden witness tracks the working point at ${time}`,
      );
    }
    assert.equal(
      model.root.userData.contacts.frontWheelToSinglePallet !== null,
      state.activeWheel === 'front',
    );
    assert.equal(
      model.root.userData.contacts.rearWheelToSinglePallet !== null,
      state.activeWheel === 'rear',
    );
    near(model.root.userData.kinematics.wheelAngle,
      state.wheelAngle, 0, `published state at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 300 publishes its reviewed cycle and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[299]);
  const {
    animationTiming,
    canonicalTimes,
    geometry,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  assert.equal(canonicalTimes.sourcePose, 0);
  assert.equal(canonicalTimes.cycleClosure, 4);
  assert.ok(canonicalTimes.firstImpulseMidpoint
    < canonicalTimes.firstFreeDropMidpoint);
  assert.ok(canonicalTimes.firstFreeDropMidpoint
    < canonicalTimes.rearRest);
  assert.ok(canonicalTimes.secondImpulseMidpoint
    < canonicalTimes.secondFreeDropMidpoint);
  assert.equal(animationTiming.authoredCyclePeriod, geometry.cyclePeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);

  const start = stateAtTime(0);
  for (let cycle = 1; cycle <= 12; cycle += 1) {
    const closure = stateAtTime(cycle * geometry.cyclePeriod);
    near(closure.palletAngle, start.palletAngle, 0,
      `pallet closes cycle ${cycle}`);
    near(closure.wheelAngle - start.wheelAngle,
      cycle * geometry.toothPitch, 2e-15,
      `common pair advances ${cycle} teeth`);
  }
  near(
    stateAtTime(12 * geometry.cyclePeriod).wheelAngle
      - start.wheelAngle,
    Math.PI * 2,
    2e-15,
    'twelve oscillations close both escape wheels',
  );
  assert.match(sourceReference.plate300.inferredTopology,
    /half-pitch tooth sets/);

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
