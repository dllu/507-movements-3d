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

test('movement 307 separates its three long locking teeth from three inner impulse pins and four pendulum pallets', () => {
  const movement = catalog.movements[306];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    presentation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 307);
  assert.equal(movement.number, '307');
  assert.equal(movement.title,
    'Beckett three-legged dead escapement with separate locking teeth and impulse pins');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'clockwise-three-leg-two-plane-long-dead-lock-teeth-and-inner-impulse-pins');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /three long outer teeth lock alternately/);
  assert.match(mechanism, /three separate short pins pointing backward/);
  assert.match(mechanism, /D and E in the front plane/);
  assert.match(mechanism, /A and B near the arbor in the rear plane/);
  assert.match(presentation, /distinct front locking and rear impulse planes/);
  assert.equal(transmission.lockingToothCount, 3);
  assert.equal(transmission.impulsePinCount, 3);
  assert.equal(transmission.axialSystems, 2);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.palletAssembly.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.plate.parent, blocks.palletAssembly);
  assert.equal(blocks.plateCarrier.parent, blocks.palletAssembly);
  assert.equal(blocks.stopD.parent, blocks.plateCarrier);
  assert.equal(blocks.stopE.parent, blocks.plateCarrier);
  assert.equal(blocks.palletA.parent, blocks.plateCarrier);
  assert.equal(blocks.palletB.parent, blocks.plateCarrier);
  assert.equal(blocks.longToothMeshes.length, 3);
  assert.equal(blocks.impulsePins.length, 3);
  assert.equal(blocks.faceEdges.length, 4);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'long-outer-locking-tooth-only').length, 3);
  assert.equal(roles.filter((role) =>
    role === 'short-inner-backward-pointing-impulse-pin').length, 3);
  assert.equal(roles.filter((role) =>
    /concentric-dead-stop$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /generated-inner-pin-impulse-face$/.test(role)).length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 307 records Brown, Beckett figure 18, and the contemporary construction description', () => {
  const movement = catalog.movements[306];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate307;
  const construction = sourceReference.periodConstructionReference;
  const britannica = sourceReference.britannicaConstructionReference;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.match(sourceAnimation.referenceScope, /long outer locking teeth/);
  assert.match(sourceAnimation.referenceScope, /backward-pointing inner impulse pins/);
  assert.match(sourceAnimation.referenceScope, /D\/E in the front locking plane/);
  assert.match(sourceAnimation.sourceUrl,
    /507movements\.com\/mm_307\.html/);
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterPendulumPivot,
    new THREE.Vector2(291, 28));
  assert.deepEqual(plate.rasterWheelCenter,
    new THREE.Vector2(263, 359));
  assert.deepEqual(plate.rasterPalletA,
    new THREE.Vector2(307, 333));
  assert.deepEqual(plate.rasterPalletB,
    new THREE.Vector2(254, 397));
  assert.deepEqual(plate.rasterStopD,
    new THREE.Vector2(79, 355));
  assert.deepEqual(plate.rasterStopE,
    new THREE.Vector2(452, 351));
  assert.deepEqual(plate.rasterOpeningBounds, {
    bottom: 404,
    left: 113,
    right: 428,
    top: 307,
  });
  assert.match(plate.inferredTopology, /two axial working planes/);
  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 1e-14, 'source wheel center');

  assert.equal(construction.author,
    'Edmund Beckett, Lord Grimthorpe');
  assert.equal(construction.figure, 18);
  assert.equal(construction.page, 72);
  assert.equal(construction.publicationEdition, 8);
  assert.equal(construction.publicationYear, 1903);
  assert.match(construction.benefits, /reduce pallet friction/);
  assert.match(construction.benefits, /longer pendulum swing/);
  assert.match(construction.url, /campaners\.com/);
  assert.equal(britannica.figure, 8);
  assert.equal(britannica.publicationYear, 1878);
  assert.match(britannica.details, /lock only on dead pallets D and E/);
  assert.match(britannica.details, /pins set in the wheel and pointing backward/);
  assert.match(britannica.url, /wikisource\.org/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 307 keeps the outer dead-lock and inner impulse systems radially and axially distinct', () => {
  const model = createMovementModel(catalog.movements[306]);
  const { blocks, geometry, palletFaces, transmission } = model.root.userData;

  assert.equal(geometry.toothCount, 3);
  near(geometry.toothPitch, FULL_TURN / 3, 1e-15,
    'three-leg pitch');
  assert.ok(geometry.longToothRadius
    > 4 * geometry.impulsePinOrbitRadius);
  assert.ok(geometry.lockPlaneZ > geometry.impulsePlaneZ);
  assert.ok(geometry.lockPlaneZ - geometry.wheelDepth / 2
    > geometry.impulsePlaneZ + geometry.impulsePinLength / 2,
  'the front locks do not overlap the rear pins axially');
  assert.ok(blocks.longToothMeshes.every((tooth, index) =>
    tooth.parent === blocks.wheelRotor
      && tooth.userData.index === index
      && tooth.position.z === geometry.lockPlaneZ));
  assert.ok(blocks.impulsePins.every((pin, index) =>
    pin.parent === blocks.wheelRotor
      && pin.userData.index === index
      && pin.userData.pointsBackward === true
      && pin.position.z === geometry.impulsePlaneZ));
  for (const pin of blocks.impulsePins) {
    near(Math.hypot(pin.position.x, pin.position.y),
      geometry.impulsePinOrbitRadius, 1e-15, 'inner pin orbit');
  }
  assert.equal(palletFaces.D.function, 'dead locking only');
  assert.equal(palletFaces.E.function, 'dead locking only');
  assert.equal(palletFaces.A.function, 'impulse only');
  assert.equal(palletFaces.B.function, 'impulse only');
  assert.equal(palletFaces.D.axialPlaneZ, geometry.lockPlaneZ);
  assert.equal(palletFaces.E.axialPlaneZ, geometry.lockPlaneZ);
  assert.equal(palletFaces.A.axialPlaneZ, geometry.impulsePlaneZ);
  assert.equal(palletFaces.B.axialPlaneZ, geometry.impulsePlaneZ);
  assert.match(transmission.lockSystem, /long outer teeth.*D\/E/);
  assert.match(transmission.impulseSystem, /inner pins.*A\/B/);
  disposeModel(model.root);
});

test('movement 307 advances exactly sixty clockwise degrees per beat while alternating all three wheel members', () => {
  const model = createMovementModel(catalog.movements[306]);
  const { geometry, stateAtTime } = model.root.userData;
  const indices = [];

  for (let beat = -2; beat <= 6; beat += 1) {
    const start = stateAtTime(beat * geometry.halfBeatDuration);
    const end = stateAtTime((beat + 1) * geometry.halfBeatDuration);
    near(end.wheelAngle - start.wheelAngle,
      -geometry.wheelAdvancePerBeat, 1e-12,
      `clockwise sixty-degree advance at beat ${beat}`);
    assert.equal(start.startingLockSide,
      positiveModulo(beat, 2) === 0 ? 'D-left' : 'E-right');
    assert.equal(start.impulsePallet,
      positiveModulo(beat, 2) === 0 ? 'A-upper' : 'B-lower');
    indices.push(start.startIndex);
  }
  assert.deepEqual(indices.slice(2, 8), [0, 2, 1, 0, 2, 1]);
  near(geometry.wheelAdvancePerBeat, Math.PI / 3, 1e-15,
    'one half pitch per beat');
  const start = stateAtTime(0);
  const end = stateAtTime(6 * geometry.halfBeatDuration);
  near(end.wheelAngle - start.wheelAngle,
    -FULL_TURN, 1e-12, 'one clockwise wheel turn in six beats');
  disposeModel(model.root);
});

test('movement 307 holds each long tooth without recoil on a generated concentric D or E dead face', () => {
  const model = createMovementModel(catalog.movements[306]);
  const {
    geometry,
    palletFaces,
    stateAtTime,
  } = model.root.userData;

  for (let beat = 0; beat < 4; beat += 1) {
    const startTime = beat * geometry.halfBeatDuration;
    const expectedSide = beat % 2 === 0 ? 'D-left' : 'E-right';
    const expectedIndex = positiveModulo(-beat, 3);
    const samples = [0.04, 0.16, 0.30, 0.40].map((halfPhase) =>
      stateAtTime(startTime + halfPhase * geometry.halfBeatDuration));
    for (const state of samples) {
      assert.equal(state.activeSystem, 'outer-lock');
      assert.equal(state.contactKind, 'dead-lock');
      assert.equal(state.startingLockSide, expectedSide);
      assert.equal(state.activeIndex, expectedIndex);
      assert.match(state.activeFace, /concentric-dead-stop$/);
      near(state.contactError, 0, 2e-15,
        `exact ${expectedSide} contact`);
      near(state.wheelAngularSpeed, 0, 1e-10,
        `${expectedSide} has no recoil`);
      near(state.activePoint.distanceTo(geometry.palletPivot),
        geometry.deadStopRadius, 1e-14,
        `${expectedSide} constant dead-face radius`);
    }
    for (const state of samples.slice(1)) {
      near(state.wheelAngle, samples[0].wheelAngle, 0,
        `${expectedSide} wheel remains stationary`);
      vectorNear(state.activePoint, samples[0].activePoint, 1e-14,
        `${expectedSide} holds one fixed tooth point`);
    }
  }
  near(palletFaces.D.radiusFromPalletPivot,
    geometry.deadStopRadius, 0, 'D dead radius');
  near(palletFaces.E.radiusFromPalletPivot,
    geometry.deadStopRadius, 0, 'E dead radius');
  assert.match(model.root.userData.transmission.recoil,
    /none while D or E is engaged/);
  disposeModel(model.root);
});

test('movement 307 generates exact alternating A/B direct-impulse contacts from the inner pins', () => {
  const model = createMovementModel(catalog.movements[306]);
  const {
    geometry,
    impulsePinCenterAt,
    palletFaces,
    stateAtTime,
  } = model.root.userData;

  for (let beat = 0; beat < 4; beat += 1) {
    const expectedPallet = beat % 2 === 0 ? 'A-upper' : 'B-lower';
    const expectedPalletSpeedSign = beat % 2 === 0 ? 1 : -1;
    for (const fraction of [0, 0.2, 0.5, 0.8, 1]) {
      const halfPhase = THREE.MathUtils.lerp(
        geometry.releaseHalfPhase,
        geometry.impulseEndHalfPhase,
        fraction,
      );
      const state = stateAtTime(
        (beat + halfPhase) * geometry.halfBeatDuration,
      );
      assert.equal(state.activeSystem, 'inner-impulse');
      assert.equal(state.contactKind, 'direct-impulse');
      assert.equal(state.impulsePallet, expectedPallet);
      assert.match(state.activeFace,
        new RegExp(`^${expectedPallet}-generated-impulse-pallet$`));
      near(state.contactError, 0, 2e-15,
        `exact ${expectedPallet} generated contact`);
      vectorNear(state.activePoint,
        impulsePinCenterAt(state.wheelAngle, state.activeIndex),
        1e-14, `${expectedPallet} active pin center`);
      assert.equal(Math.sign(state.palletAngularSpeed),
        expectedPalletSpeedSign);
    }
    const midpoint = stateAtTime((beat + THREE.MathUtils.lerp(
      geometry.releaseHalfPhase,
      geometry.impulseEndHalfPhase,
      0.5,
    )) * geometry.halfBeatDuration);
    assert.ok(midpoint.wheelAngularSpeed < 0,
      `${expectedPallet} receives clockwise wheel impulse`);
  }
  assert.equal(palletFaces.A.points.length, 41);
  assert.equal(palletFaces.B.points.length, 41);
  assert.ok(palletFaces.A.points.every((point) => point.isVector2));
  assert.ok(palletFaces.B.points.every((point) => point.isVector2));
  disposeModel(model.root);
});

test('movement 307 partitions every beat into inner-pin impulse and a finite eight-degree free drop', () => {
  const model = createMovementModel(catalog.movements[306]);
  const {
    geometry,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;

  near(geometry.impulseAdvance + geometry.clearanceDropAngle,
    geometry.wheelAdvancePerBeat, 1e-15,
    'impulse and free drop partition one beat');
  near(geometry.clearanceDropAngle,
    THREE.MathUtils.degToRad(8), 0, 'eight-degree free drop');
  assert.ok(geometry.impulseEndHalfPhase < geometry.landingHalfPhase);
  near(geometry.landingHalfPhase - geometry.impulseEndHalfPhase,
    geometry.clearanceDropDuration, 1e-15,
    'finite drop interval');

  for (let beat = 0; beat < 4; beat += 1) {
    const impulseEnd = stateAtTime(
      (beat + geometry.impulseEndHalfPhase)
        * geometry.halfBeatDuration,
    );
    const dropMiddle = stateAtTime(
      (beat + (geometry.impulseEndHalfPhase
        + geometry.landingHalfPhase) / 2)
        * geometry.halfBeatDuration,
    );
    const landing = stateAtTime(
      (beat + geometry.landingHalfPhase)
        * geometry.halfBeatDuration,
    );
    assert.equal(impulseEnd.activeSystem, 'inner-impulse');
    assert.equal(dropMiddle.activeSystem, null);
    assert.equal(dropMiddle.activeIndex, null);
    assert.equal(dropMiddle.activePoint, null);
    assert.equal(dropMiddle.contactKind, 'clearance-drop');
    assert.match(dropMiddle.mode, /free-drop$/);
    assert.equal(landing.activeSystem, 'outer-lock');
    near(landing.beatAdvance - impulseEnd.beatAdvance,
      geometry.clearanceDropAngle, 1e-12,
      `eight-degree clearance drop at beat ${beat}`);
  }
  assert.match(transmission.clearance, /eight-degree free wheel drop/);
  assert.equal(timeline.demonstrationPeriod, geometry.pendulumPeriod);
  assert.equal(timeline.schedule.filter((entry) =>
    entry.includes('free-drop')).length, 2);
  disposeModel(model.root);
});

test('movement 307 renderer follows the solved two-system state and leaves movement 339 as the next authored frontier', () => {
  const movement = catalog.movements[306];
  const model = createMovementModel(movement);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const phaseSamples = [
    0,
    geometry.releaseHalfPhase,
    (geometry.releaseHalfPhase + geometry.impulseEndHalfPhase) / 2,
    (geometry.impulseEndHalfPhase + geometry.landingHalfPhase) / 2,
    geometry.landingHalfPhase,
    0.82,
    1,
    1 + geometry.releaseHalfPhase,
    1 + (geometry.releaseHalfPhase + geometry.impulseEndHalfPhase) / 2,
    1 + (geometry.impulseEndHalfPhase + geometry.landingHalfPhase) / 2,
    1 + geometry.landingHalfPhase,
    2,
  ];

  for (const halfCoordinate of phaseSamples) {
    const time = halfCoordinate * geometry.halfBeatDuration;
    model.update(time, 0.016);
    const state = stateAtTime(time);
    near(blocks.palletAssembly.rotation.z,
      state.palletAngle, 0, `pallet angle at ${time}`);
    near(blocks.wheelRotor.rotation.z,
      state.wheelAngle, 0, `wheel angle at ${time}`);
    assert.equal(blocks.contactMarker.visible,
      state.contactPoint !== null);
    assert.equal(blocks.contactMarker.userData.activeFace,
      state.activeFace);
    assert.equal(blocks.contactMarker.userData.activeIndex,
      state.activeIndex);
    assert.equal(blocks.contactMarker.userData.activeSystem,
      state.activeSystem);
    if (state.contactPoint) {
      vectorNear(new THREE.Vector2(
        blocks.contactMarker.position.x,
        blocks.contactMarker.position.y,
      ), state.contactPoint, 1e-12, `contact marker at ${time}`);
      near(blocks.contactMarker.position.z,
        state.activeSystem === 'outer-lock'
          ? geometry.contactMarkerZ.lock
          : geometry.contactMarkerZ.impulse,
        0, `contact marker plane at ${time}`);
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
