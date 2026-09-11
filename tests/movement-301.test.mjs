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

test('movement 301 is the side elevation of the single-pallet Debaufre escapement', () => {
  const movement = catalog.movements[300];
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

  assert.equal(movement.id, 301);
  assert.equal(movement.number, '301');
  assert.equal(movement.title,
    'Debaufre double-wheel frictional-rest escapement — side elevation');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'debaufre-rigid-double-ratchet-wheel-single-d-pallet-frictional-rest-side-elevation');
  assert.equal(archetype, movement.archetype);
  assert.equal(presentation, 'side elevation');
  assert.equal(presentationView, 'side');
  assert.equal(pairedMechanismKey,
    'brown-300-301-debaufre-double-wheel-escapement');
  assert.match(mechanism, /rigidly coaxial and half a tooth pitch apart/);
  assert.match(mechanism, /one short D-section pallet/);
  assert.equal(transmission.wheelsRigidlyCoupled, true);
  assert.equal(transmission.activeContactsAtOnce, 1);
  assert.equal(transmission.palletCount, 1);

  assert.equal(blocks.frontWheel.parent, model.root);
  assert.equal(blocks.rearWheel.parent, model.root);
  assert.equal(blocks.commonEscapeArbor.parent, model.root);
  assert.equal(blocks.palletAssembly.parent, model.root);
  vectorNear(blocks.frontWheel.userData.worldAxis,
    new THREE.Vector3(0, 0, 1), 0, 'coaxial wheel direction');
  vectorNear(blocks.palletAssembly.userData.worldAxis,
    new THREE.Vector3(1, 0, 0), 0, 'end-on balance direction');
  assert.ok(model.cameraDirection.clone().normalize().dot(
    new THREE.Vector3(1, 0, 0),
  ) > 0.98, 'default camera reads the balance staff end-on');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'debaufre-undercut-ratchet-tooth').length, 24);
  assert.equal(roles.filter((role) =>
    role === 'single-d-section-frictional-rest-pallet').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 301 records Brown’s wheel spacing, pallet outline, and disabled animation', () => {
  const movement = catalog.movements[300];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const side = sourceReference.plate301;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_301.html');
  assert.match(sourceAnimation.referenceScope, /paired side elevation/);
  assert.match(sourceAnimation.referenceScope, /single D-section pallet/);
  assert.equal(sourceReference.sourceUrl,
    'https://507movements.com/mm_301.html');
  assert.equal(sourceReference.pairedSourceUrl,
    'https://507movements.com/mm_300.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(side.imageWidth, 525);
  assert.equal(side.imageHeight, 525);
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
  assert.match(side.inferredTopology, /one common arbor/);
  assert.match(side.inferredTopology, /single D-section pallet centered/);
  assert.equal(sourceReference.plate300.modeledTeethPerWheel, 12);
  assert.equal(sourceReference.plate300.modeledProjectedToothStations, 24);
  assert.equal(sourceReference.periodReference.author, 'Thomas Reid');
  assert.equal(sourceReference.periodReference.figure,
    'Plate VIII, figure 45');
  assert.match(sourceReference.periodReference.description,
    /short cut-away cylindrical pallet/);
  assert.match(sourceReference.periodReference.description,
    /tooth of the other wheel drops/);
  disposeModel(model.root);
});

test('movement 301 exposes two separated wheel planes around the broad face of one D-pallet', () => {
  const model = createMovementModel(catalog.movements[300]);
  const { blocks, geometry, transmission } = model.root.userData;

  near(blocks.frontWheel.position.z,
    geometry.wheelPlaneOffset, 0, 'front plane coordinate');
  near(blocks.rearWheel.position.z,
    -geometry.wheelPlaneOffset, 0, 'rear plane coordinate');
  near(blocks.frontWheel.position.z - blocks.rearWheel.position.z,
    2 * geometry.wheelPlaneOffset, 0, 'visible axial wheel spacing');
  assert.ok(geometry.palletRadius > geometry.wheelPlaneOffset,
    'D-pallet face spans both tooth planes');
  assert.ok(geometry.wheelDepth < geometry.wheelPlaneOffset / 4,
    'the two escape wheels remain thin and separate');
  near(geometry.rearMountPhase - geometry.frontMountPhase,
    geometry.halfToothPitch, 1e-16, 'half-pitch tooth offset');
  near(THREE.MathUtils.radToDeg(geometry.halfToothPitch),
    15, 2e-15, 'fifteen-degree offset');
  assert.equal(blocks.palletBody.parent, blocks.palletAssembly);
  assert.equal(blocks.palletTopEdge.parent, blocks.palletAssembly);
  assert.equal(blocks.palletHub.parent, blocks.palletAssembly);
  assert.equal(blocks.impulseLips.length, 2);
  for (const [index, lip] of blocks.impulseLips.entries()) {
    assert.equal(lip.parent, blocks.palletAssembly);
    near(Math.abs(lip.position.z), geometry.wheelPlaneOffset, 0,
      `lip ${index} lies in its wheel plane`);
    near(lip.userData.chamferAngle, Math.PI / 4, 0,
      `lip ${index} has Reid's flange angle`);
  }
  assert.equal(transmission.wheelTeethEach, 12);
  assert.equal(transmission.commonArbor, true);
  assert.equal(transmission.toothSetsAlternate, true);
  disposeModel(model.root);
});

test('movements 300 and 301 are distinct projections of exactly the same mechanism state', () => {
  const front = createMovementModel(catalog.movements[299]);
  const side = createMovementModel(catalog.movements[300]);
  assert.notEqual(front.root, side.root);
  assert.equal(front.root.userData.presentation, 'front elevation');
  assert.equal(side.root.userData.presentation, 'side elevation');
  assert.ok(front.cameraDirection.clone().normalize().dot(
    new THREE.Vector3(0, 0, 1),
  ) > 0.95, '300 looks along the escape arbor');
  assert.ok(side.cameraDirection.clone().normalize().dot(
    new THREE.Vector3(1, 0, 0),
  ) > 0.98, '301 looks along the balance staff');
  assert.ok(front.cameraDirection.clone().normalize().dot(
    side.cameraDirection.clone().normalize(),
  ) < 0.35, 'the source projections are nearly perpendicular');

  for (const key of [
    'dropAngle',
    'firstCatchPhase',
    'firstImpulseStartPhase',
    'firstReleasePhase',
    'frontMountPhase',
    'halfToothPitch',
    'impulseAdvance',
    'palletAmplitude',
    'palletThickness',
    'rearMountPhase',
    'secondCatchPhase',
    'secondImpulseStartPhase',
    'secondReleasePhase',
    'toothCount',
    'toothPitch',
    'wheelContactRadius',
    'wheelPlaneOffset',
  ]) near(
    side.root.userData.geometry[key],
    front.root.userData.geometry[key],
    0,
    `shared geometry ${key}`,
  );

  for (const coordinate of [0, 0.1, 0.24, 0.3, 0.5, 0.74, 0.8, 0.95, 1]) {
    const frontState = front.root.userData.stateAtCycleCoordinate(coordinate);
    const sideState = side.root.userData.stateAtCycleCoordinate(coordinate);
    assert.equal(sideState.stage, frontState.stage);
    assert.equal(sideState.activeWheel, frontState.activeWheel);
    near(sideState.palletAngle, frontState.palletAngle, 0,
      `shared pallet state at ${coordinate}`);
    near(sideState.wheelAngle, frontState.wheelAngle, 0,
      `shared wheel state at ${coordinate}`);
  }
  disposeModel(front.root);
  disposeModel(side.root);
});

test('movement 301 shows one alternating contact and two real free drops from the side', () => {
  const model = createMovementModel(catalog.movements[300]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  const seen = new Set();
  let restSamples = 0;
  let impulseSamples = 0;
  let dropSamples = 0;
  let maximumPhaseError = 0;

  for (let index = 0; index <= 24576; index += 1) {
    const state = stateAtCycleCoordinate(index / 24576);
    if (state.contact) {
      seen.add(state.activeWheel);
      assert.equal(state.freeDrop, false);
      assert.equal(state.contact.wheelPlane,
        state.activeWheel === 'front'
          ? geometry.wheelPlaneOffset
          : -geometry.wheelPlaneOffset);
      near(state.contact.normalSeparation, 0, 0,
        `surface closure at ${index}`);
      vectorNear(state.contact.toothTip,
        state.contact.palletSurfacePoint, 0,
        `single contact point at ${index}`);
      maximumPhaseError = Math.max(
        maximumPhaseError,
        Math.abs(state.contact.toothPhaseError),
      );
      if (state.frictionalRest) {
        restSamples += 1;
        near(state.wheelAngularSpeed, 0, 0,
          `stationary frictional rest at ${index}`);
      } else {
        impulseSamples += 1;
        assert.equal(state.directImpulse, true);
      }
    } else {
      dropSamples += 1;
      assert.equal(state.freeDrop, true);
      assert.ok(state.freeDropState);
      assert.notEqual(state.approachingWheel, state.departingWheel);
    }
  }
  assert.deepEqual([...seen].sort(), ['front', 'rear']);
  assert.ok(restSamples > 19000);
  assert.ok(impulseSamples > 3000);
  assert.ok(dropSamples > 1600);
  assert.ok(maximumPhaseError < 2e-15,
    `half-pitch contact closure: ${maximumPhaseError}`);

  const firstDrop = stateAtCycleCoordinate(
    (geometry.firstReleasePhase + geometry.firstCatchPhase) / 2,
  );
  const secondDrop = stateAtCycleCoordinate(
    (geometry.secondReleasePhase + geometry.secondCatchPhase) / 2,
  );
  assert.equal(firstDrop.departingWheel, 'front');
  assert.equal(firstDrop.approachingWheel, 'rear');
  assert.equal(secondDrop.departingWheel, 'rear');
  assert.equal(secondDrop.approachingWheel, 'front');
  disposeModel(model.root);
});

test('movement 301 keeps both wheel rates identical and advances without recoil', () => {
  const model = createMovementModel(catalog.movements[300]);
  const { geometry, stateAtCycleCoordinate, stateAtTime } =
    model.root.userData;
  const start = stateAtCycleCoordinate(0);
  const half = stateAtCycleCoordinate(0.5);
  const end = stateAtCycleCoordinate(1);
  near(half.wheelAngle - start.wheelAngle,
    geometry.halfToothPitch, 0, 'one alternating tooth station per beat');
  near(end.wheelAngle - start.wheelAngle,
    geometry.toothPitch, 0, 'one wheel tooth per oscillation');
  near(end.palletAngle, start.palletAngle, 0, 'pallet cycle closure');

  let previous = start.wheelAngle;
  for (let index = 1; index <= 8192; index += 1) {
    const state = stateAtCycleCoordinate(index / 8192);
    assert.ok(state.wheelAngle >= previous - 2e-15,
      'rigid wheel pair never recoils');
    previous = state.wheelAngle;
  }

  const h = 1e-5;
  for (const time of [0.4, 0.9, 1.05, 1.2, 1.8, 2.4, 2.9, 3.05, 3.2, 3.8]) {
    const before = stateAtTime(time - h);
    const state = stateAtTime(time);
    const after = stateAtTime(time + h);
    const wheelSpeed = (
      after.wheelAngle - before.wheelAngle
    ) / (2 * h);
    const palletSpeed = (
      after.palletAngle - before.palletAngle
    ) / (2 * h);
    near(wheelSpeed, state.wheelAngularSpeed, 2e-8,
      `common wheel speed at ${time}`);
    near(palletSpeed, state.palletAngularSpeed, 2e-9,
      `pallet speed at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 301 renderer preserves wheel spacing and publishes the side-view contact', () => {
  const model = createMovementModel(catalog.movements[300]);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.8, 0.95, 1.2, 1.5, 2.8, 2.95, 3.2, 3.7, 4]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.frontWheel.position.z,
      geometry.wheelPlaneOffset, 0, `front plane at ${time}`);
    near(blocks.rearWheel.position.z,
      -geometry.wheelPlaneOffset, 0, `rear plane at ${time}`);
    near(blocks.frontWheel.userData.rotor.rotation.z,
      state.wheelAngle, 0, `front angle at ${time}`);
    near(blocks.rearWheel.userData.rotor.rotation.z,
      state.wheelAngle, 0, `rear angle at ${time}`);
    near(blocks.commonEscapeArbor.userData.rotor.rotation.z,
      state.wheelAngle, 0, `common arbor at ${time}`);
    near(blocks.frontWheel.userData.angularSpeed,
      blocks.rearWheel.userData.angularSpeed, 0,
      `rigid pair speed at ${time}`);
    near(blocks.palletAssembly.rotation.x,
      state.palletAngle, 0, `D-pallet angle at ${time}`);
    assert.equal(blocks.frontContactMarker.visible,
      state.activeWheel === 'front');
    assert.equal(blocks.rearContactMarker.visible,
      state.activeWheel === 'rear');
    assert.equal(
      model.root.userData.contacts.frontWheelToSinglePallet !== null,
      state.activeWheel === 'front',
    );
    assert.equal(
      model.root.userData.contacts.rearWheelToSinglePallet !== null,
      state.activeWheel === 'rear',
    );
  }
  disposeModel(model.root);
});

test('movement 301 closes the common mechanism and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[300]);
  const {
    animationTiming,
    canonicalTimes,
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  assert.equal(canonicalTimes.sourcePose, 0);
  assert.equal(canonicalTimes.cycleClosure, 4);
  assert.ok(canonicalTimes.firstCatch
    < canonicalTimes.secondImpulseMidpoint);
  assert.ok(canonicalTimes.secondImpulseMidpoint
    < canonicalTimes.secondCatch);
  assert.equal(animationTiming.authoredCyclePeriod, geometry.cyclePeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(transmission.wheelAdvancePerBeatInToothPitches, 0.5);
  assert.equal(transmission.wheelAdvancePerOscillationInToothPitches, 1);

  const start = stateAtTime(0);
  for (let cycle = 1; cycle <= 12; cycle += 1) {
    const closure = stateAtTime(cycle * geometry.cyclePeriod);
    near(closure.palletAngle, start.palletAngle, 0,
      `side-view pallet closes cycle ${cycle}`);
    near(closure.wheelAngle - start.wheelAngle,
      cycle * geometry.toothPitch, 2e-15,
      `side-view pair advances ${cycle} teeth`);
  }
  near(
    stateAtTime(12 * geometry.cyclePeriod).wheelAngle
      - start.wheelAngle,
    Math.PI * 2,
    2e-15,
    'twelve oscillations close both wheels',
  );

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
