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
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
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

test('movement 236 is one lever, two alternating pawls, and one fifteen-tooth ratchet', () => {
  const movement = catalog.movements[235];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 236);
  assert.equal(movement.number, '236');
  assert.equal(movement.title, 'Alternating Two-Pawl Ratchet');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'alternating-two-pawl-nearly-continuous-fifteen-tooth-ratchet',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.longPawlDrivesFirstHalf, true);
  assert.equal(transmission.shortPawlDrivesSecondHalf, true);
  assert.equal(transmission.wheelDwellsOnlyAtLeverReversals, true);
  near(transmission.outputTeethPerLeverCycle, 2, 2e-14,
    'two tooth pitches per lever oscillation');
  assert.equal(blocks.ratchet.parent, model.root);
  assert.equal(blocks.lever.parent, model.root);
  assert.equal(blocks.longPawl.parent, model.root);
  assert.equal(blocks.shortPawl.parent, model.root);
  assert.notEqual(blocks.longPawl, blocks.shortPawl);
  assert.equal(blocks.ratchet.userData.teeth, 15);
  assert.equal(blocks.ratchet.userData.profilePoints.length, 45);
  assert.equal(blocks.leverJoints.length, 3);
  disposeModel(model.root);
});

test('movement 236 preserves the measured engraving layout and solved handoff', () => {
  const model = createMovementModel(catalog.movements[235]);
  const {
    geometry,
    sourceReference,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const plate = sourceReference.plate236;

  assert.deepEqual(plate.rasterWheelCenter.toArray(), [285, 335]);
  assert.deepEqual(plate.rasterFulcrum.toArray(), [326, 140]);
  assert.deepEqual(plate.rasterLongPawlPivot.toArray(), [242, 130]);
  assert.deepEqual(plate.rasterShortPawlPivot.toArray(), [372, 178]);
  assert.deepEqual(plate.rasterHandleEnd.toArray(), [48, 113]);
  assert.deepEqual(plate.rasterLongPawlNose.toArray(), [205, 305]);
  assert.deepEqual(plate.rasterShortPawlNose.toArray(), [260, 243]);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.inferredRatchetTeeth, 15);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.match(plate.inferredTopology, /two alternately driving hinged pawls/);
  assert.deepEqual(sourceReference.primaryScan, {
    edition: 21,
    printedPage: 61,
    publicationYear: 1908,
  });

  near(geometry.sourceScale, 0.016, 0, 'engraving scale');
  near(geometry.toothPitch, FULL_TURN / 15, 0, 'fifteen-tooth pitch');
  near(geometry.longDriveFaceFraction, 0, 0,
    'long pawl seats at the rising-flank outer corner');
  near(geometry.shortDriveFaceFraction, 0, 0,
    'short pawl seats at the rising-flank outer corner');
  assert.ok(Math.abs(geometry.handoffError) < 3e-14);
  near(
    geometry.shortStartAngle - geometry.longStartAngle,
    geometry.handoffTarget,
    3e-14,
    'the two selected tooth faces share one ratchet phase',
  );
  assert.ok(THREE.MathUtils.radToDeg(geometry.leverAmplitude) > 14.9);
  assert.ok(THREE.MathUtils.radToDeg(geometry.leverAmplitude) < 15.05);
  const source = stateAtCycleCoordinate(geometry.sourceCyclePhase);
  near(source.leverAngle, 0, 2e-17, 'engraving lever pose');
  vectorNear(source.longAnchor, geometry.sourceLongAnchor, 2e-15,
    'engraving long-pawl pivot');
  vectorNear(source.shortAnchor, geometry.sourceShortAnchor, 2e-15,
    'engraving short-pawl pivot');
  vectorNear(
    source.longTipCenter,
    new THREE.Vector2(-1.28, 0.48),
    0.33,
    'source nose region with mechanically inferred outer-corner seating',
  );
  disposeModel(model.root);
});

test('movement 236 long pawl drives one exact pitch with rigid contact', () => {
  const model = createMovementModel(catalog.movements[235]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  const samples = 16_384;
  let previousWheelAngle = -Infinity;
  let maximumWheelSpeed = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const coordinate = 0.5 * sample / samples;
    const state = stateAtCycleCoordinate(coordinate);
    assert.equal(state.stage, 'long-pawl-b-drives-short-pawl-c-resets');
    assert.equal(state.longDriving, true);
    assert.equal(state.shortDriving, false);
    assert.equal(state.activePawl, 'long-b');
    assert.ok(Math.abs(state.longProfileClearance) < 3e-12);
    assert.ok(state.shortProfileClearance >= -3e-12);
    assert.ok(state.activePawlLengthError < 3e-12);
    assert.ok(state.contactCenterError < 3e-12);
    assert.ok(state.activeTipVelocityError < 3e-12);
    assert.ok(state.activeCompressionTorque > 0.28);
    assert.ok(state.wheelAngle >= previousWheelAngle - 2e-13);
    assert.ok(state.wheelAngularSpeed >= -2e-12);
    previousWheelAngle = state.wheelAngle;
    maximumWheelSpeed = Math.max(maximumWheelSpeed, state.wheelAngularSpeed);
  }
  const handoff = stateAtCycleCoordinate(0.5);
  near(handoff.wheelAngle, geometry.toothPitch, 3e-15,
    'long pawl advances one pitch');
  near(handoff.wheelAngularSpeed, 0, 2e-15,
    'wheel stops only at the lever reversal');
  assert.ok(maximumWheelSpeed > 0.31);
  disposeModel(model.root);
});

test('movement 236 short pawl continues counterclockwise through the return stroke', () => {
  const model = createMovementModel(catalog.movements[235]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  const samples = 16_384;
  let previousWheelAngle = geometry.toothPitch;
  let maximumWheelSpeed = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const coordinate = 0.5 + 0.5 * sample / samples;
    const state = stateAtCycleCoordinate(coordinate);
    assert.equal(state.stage, 'short-pawl-c-drives-long-pawl-b-resets');
    assert.equal(state.longDriving, false);
    assert.equal(state.shortDriving, true);
    assert.equal(state.activePawl, 'short-c');
    assert.ok(Math.abs(state.shortProfileClearance) < 3e-12);
    assert.ok(state.longProfileClearance >= -3e-12);
    assert.ok(state.activePawlLengthError < 3e-12);
    assert.ok(state.contactCenterError < 4e-12);
    assert.ok(state.activeTipVelocityError < 3e-12);
    assert.ok(state.activeCompressionTorque > 0.28);
    assert.ok(state.wheelAngle >= previousWheelAngle - 2e-13);
    assert.ok(state.wheelAngularSpeed >= -2e-12);
    previousWheelAngle = state.wheelAngle;
    maximumWheelSpeed = Math.max(maximumWheelSpeed, state.wheelAngularSpeed);
  }
  const closure = stateAtCycleCoordinate(1);
  near(closure.wheelAngle, 2 * geometry.toothPitch, 6e-15,
    'short pawl adds the second exact pitch');
  near(closure.wheelAngularSpeed, 0, 2e-15,
    'second reversal is the other instantaneous dwell');
  assert.ok(maximumWheelSpeed > 0.31);
  disposeModel(model.root);
});

test('movement 236 returned pawls remain rigid, smooth, and outside every tooth', () => {
  const model = createMovementModel(catalog.movements[235]);
  const { stateAtCycleCoordinate } = model.root.userData;
  const samples = 32_768;
  let previousLongTip = null;
  let previousShortTip = null;
  let maximumLongStep = 0;
  let maximumShortStep = 0;
  let maximumLongClearance = 0;
  let maximumShortClearance = 0;
  for (let sample = 0; sample <= samples; sample += 1) {
    const coordinate = sample / samples;
    const state = stateAtCycleCoordinate(coordinate);
    assert.ok(state.longProfileClearance >= -3e-12);
    assert.ok(state.shortProfileClearance >= -3e-12);
    assert.equal(state.returnedPawlLiftedClear, true);
    assert.ok(state.longPawlLengthError < 3e-12);
    assert.ok(state.shortPawlLengthError < 3e-12);
    if (previousLongTip) {
      maximumLongStep = Math.max(
        maximumLongStep,
        state.longTipCenter.distanceTo(previousLongTip),
      );
      maximumShortStep = Math.max(
        maximumShortStep,
        state.shortTipCenter.distanceTo(previousShortTip),
      );
    }
    previousLongTip = state.longTipCenter;
    previousShortTip = state.shortTipCenter;
    maximumLongClearance = Math.max(
      maximumLongClearance,
      state.longProfileClearance,
    );
    maximumShortClearance = Math.max(
      maximumShortClearance,
      state.shortProfileClearance,
    );
  }
  assert.ok(maximumLongStep < 2.7e-4,
    `long-pawl maximum sample step ${maximumLongStep}`);
  assert.ok(maximumShortStep < 2.2e-4,
    `short-pawl maximum sample step ${maximumShortStep}`);
  assert.ok(maximumLongClearance > 0.65);
  assert.ok(maximumShortClearance > 0.25);
  disposeModel(model.root);
});

test('movement 236 output is nearly continuous and dwells only at reversals', () => {
  const model = createMovementModel(catalog.movements[235]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  for (let sample = 1; sample < 32_768; sample += 1) {
    const coordinate = sample / 32_768;
    if (Math.abs(coordinate - 0.5) < 1e-10) continue;
    const state = stateAtCycleCoordinate(coordinate);
    assert.ok(state.wheelAngularSpeed > 0,
      `positive output speed at ${coordinate}`);
    assert.equal(state.wheelDwelling, false);
  }
  for (const coordinate of [0, 0.5, 1]) {
    const state = stateAtCycleCoordinate(coordinate);
    assert.equal(state.inputReversing, true);
    assert.equal(state.wheelDwelling, true);
    near(state.wheelAngularSpeed, 0, 2e-15,
      `instantaneous dwell at ${coordinate}`);
  }
  near(
    stateAtCycleCoordinate(0.5).wheelAngle
      - stateAtCycleCoordinate(0).wheelAngle,
    geometry.toothPitch,
    3e-15,
    'first half-stroke travel',
  );
  near(
    stateAtCycleCoordinate(1).wheelAngle
      - stateAtCycleCoordinate(0.5).wheelAngle,
    geometry.toothPitch,
    4e-15,
    'second half-stroke travel',
  );
  disposeModel(model.root);
});

test('movement 236 reported speeds match finite differences for both pawls', () => {
  const model = createMovementModel(catalog.movements[235]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  const coordinateStep = 1e-6;
  const secondsPerCoordinate = 1 / geometry.cyclesPerSecond;
  const speedAt = (coordinate, key) => {
    const before = stateAtCycleCoordinate(coordinate - coordinateStep)[key];
    let after = stateAtCycleCoordinate(coordinate + coordinateStep)[key];
    while (after - before > Math.PI) after -= FULL_TURN;
    while (after - before < -Math.PI) after += FULL_TURN;
    return (after - before) / (2 * coordinateStep * secondsPerCoordinate);
  };
  for (const coordinate of [0.07, 0.13, 0.24, 0.37,
    0.63, 0.74, 0.88, 0.93]) {
    const state = stateAtCycleCoordinate(coordinate);
    near(state.leverAngularSpeed, speedAt(coordinate, 'leverAngle'), 2e-7,
      `lever speed at ${coordinate}`);
    near(state.wheelAngularSpeed, speedAt(coordinate, 'wheelAngle'), 2e-7,
      `wheel speed at ${coordinate}`);
    near(state.longPawlAngularSpeed,
      speedAt(coordinate, 'longPawlAngle'), 2e-7,
      `long-pawl speed at ${coordinate}`);
    near(state.shortPawlAngularSpeed,
      speedAt(coordinate, 'shortPawlAngle'), 2e-7,
      `short-pawl speed at ${coordinate}`);
  }
  disposeModel(model.root);
});

test('movement 236 renderer binds both pawls and closes before movement 339', () => {
  const model = createMovementModel(catalog.movements[235]);
  const {
    animationTiming,
    blocks,
    geometry,
    stateAtCycleCoordinate,
    transmission,
  } = model.root.userData;

  for (const time of [0, 1, 2, 3]) {
    model.update(time);
    const state = model.root.userData.kinematics;
    near(blocks.lever.userData.rotor.rotation.z, state.leverAngle, 0,
      `rendered lever at ${time}`);
    near(blocks.ratchet.userData.rotor.rotation.z, state.wheelAngle, 0,
      `rendered ratchet at ${time}`);
    near(blocks.ratchetShaft.userData.rotor.rotation.z, state.wheelAngle, 0,
      `rendered output shaft at ${time}`);
    vectorNear(
      new THREE.Vector2(blocks.longPawl.position.x, blocks.longPawl.position.y),
      state.longAnchor,
      0,
      `rendered long-pawl anchor at ${time}`,
    );
    vectorNear(
      new THREE.Vector2(
        blocks.shortPawl.position.x,
        blocks.shortPawl.position.y,
      ),
      state.shortAnchor,
      0,
      `rendered short-pawl anchor at ${time}`,
    );
    near(blocks.longPawl.rotation.z, state.longPawlAngle, 0,
      `rendered long pawl at ${time}`);
    near(blocks.shortPawl.rotation.z, state.shortPawlAngle, 0,
      `rendered short pawl at ${time}`);
    vectorNear(
      new THREE.Vector2(
        blocks.activeContactMarker.position.x,
        blocks.activeContactMarker.position.y,
      ),
      state.activeProfilePoint,
      0,
      `rendered active contact at ${time}`,
    );
  }
  assert.equal(animationTiming.authoredCyclePeriod, transmission.cyclePeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  near(stateAtCycleCoordinate(15).wheelAngle, 2 * FULL_TURN, 2e-14,
    'fifteen lever cycles close two wheel revolutions');
  model.root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model.root)
    .getSize(new THREE.Vector3());
  assert.ok(size.x > 5.5);
  assert.ok(size.y > 5.4);
  assert.ok(size.z > 1.2);
  let meshCount = 0;
  model.root.traverse((object) => { if (object.isMesh) meshCount += 1; });
  assert.ok(meshCount >= 22);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model289.root);
});
