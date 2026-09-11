import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
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

test('movement 280 is a four-bar-driven two-jaw friction windlass', () => {
  const movement = catalog.movements[279];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
  } = model.root.userData;

  assert.equal(movement.id, 280);
  assert.equal(movement.number, '280');
  assert.equal(movement.title, 'Two-Jaw Friction-Clutch Windlass Drive');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'four-bar-two-jaw-friction-windlass-staggered-holding-pawls');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one alternating long hand lever/);
  assert.match(mechanism, /one rigid coupler/);
  assert.match(mechanism, /two-jaw cast-iron block/);
  assert.match(mechanism, /clamps the rim/);
  assert.match(mechanism, /downstroke releases and slides/);
  assert.match(mechanism, /two staggered pawls/);

  assert.equal(blocks.wheel.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.wheel);
  assert.equal(blocks.ratchetWheel.parent, blocks.wheelRotor);
  assert.equal(blocks.windlassBarrel.parent, blocks.wheelRotor);
  assert.equal(blocks.shortLever.parent, model.root);
  assert.equal(blocks.clampShoe.parent, blocks.shortLever);
  assert.equal(blocks.handLever.parent, model.root);
  assert.equal(blocks.connectingRod.parent, model.root);
  vectorNear(blocks.wheel.userData.axis, Z_AXIS, 0, 'wheel axis');
  vectorNear(blocks.shortLever.userData.axis, Z_AXIS, 0,
    'short lever axis');
  vectorNear(blocks.handLever.userData.axis, Z_AXIS, 0,
    'hand lever axis');
  assert.equal(blocks.jawSides.length, 2);
  assert.equal(blocks.jawFlanges.length, 2);
  assert.equal(blocks.ratchetTeeth.length, 36);
  assert.ok(blocks.ratchetTeeth.every((tooth) =>
    tooth.parent === blocks.ratchetWheel));
  assert.equal(blocks.upperPawl.parent, model.root);
  assert.equal(blocks.lowerPawl.parent, model.root);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => /cast-iron-rim-jaw$/.test(role))
    .length, 2);
  assert.equal(roles.filter((role) =>
    /inward-flange-against-inner-rim$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /staggered-holding-pawl$/.test(role)).length, 2);
  assert.equal(roles.filter((role) => /one-way-backstop-ratchet-tooth/.test(role))
    .length, 36);
  assert.equal(roles.filter((role) => /belt|pulley|gear-pair/.test(role)).length,
    0);
  disposeModel(model.root);
});

test('movement 280 records the unavailable animation and measured Brown plate', () => {
  const model = createMovementModel(catalog.movements[279]);
  const {
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const plate = sourceReference.plate280;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason,
    /official Movement 280 page labels the animation unavailable/);
  assert.match(sourceAnimation.reason, /printed clamp, drive, release/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_280.html');
  assert.equal(sourceReference.officialDescription,
    catalog.movements[279].description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 6);
  assert.deepEqual(plate.rasterWheelCenter, { x: 132, y: 356 });
  assert.deepEqual(plate.rasterWheelOuterRight, { x: 244, y: 356 });
  assert.deepEqual(plate.rasterWheelInnerRight, { x: 220, y: 356 });
  assert.deepEqual(plate.rasterShortLeverPivot, { x: 263, y: 359 });
  assert.deepEqual(plate.rasterLowerLinkPin, { x: 351, y: 357 });
  assert.deepEqual(plate.rasterHandlePivot, { x: 408, y: 73 });
  assert.deepEqual(plate.rasterUpperLinkPin, { x: 350, y: 79 });
  assert.deepEqual(plate.rasterUpperPawlPivot, { x: 247, y: 232 });
  assert.deepEqual(plate.rasterLowerPawlPivot, { x: 247, y: 276 });
  assert.match(plate.inferredTopology, /one two-jaw rim block/);
  assert.match(plate.inferredTopology, /two staggered holding pawls/);
  for (const [feature, error] of Object.entries(
    plate.sourceIdealizationPixelErrors,
  )) {
    assert.ok(error <= plate.measurementUncertaintyPixels,
      `${feature} is ${error}px from its measured source point`);
  }
  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    new THREE.Vector2(0, 0), 0, 'plate wheel center');
  vectorNear(sourcePointToModel(plate.rasterWheelOuterRight),
    new THREE.Vector2(1.568, 0), 2e-16, 'plate wheel radius');
  const sourceState = stateAtTime(timeline.sourceTime);
  vectorNear(sourceState.upperPin,
    new THREE.Vector3(3.052, 3.878, 0), 2e-15,
    'source upper coupler pin');
  vectorNear(sourceState.lowerPin,
    new THREE.Vector3(3.066, -0.014, 0), 2e-15,
    'source lower coupler pin');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 75,
    edition: 21,
    illustrationPage: 74,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 280 solves one continuous closed four-bar branch exactly', () => {
  const model = createMovementModel(catalog.movements[279]);
  const {
    fourBar,
    geometry,
    stateAtInputAngle,
  } = model.root.userData;
  let previousRockerAngle = -Infinity;

  for (let index = 0; index <= 4096; index += 1) {
    const inputAngle = THREE.MathUtils.lerp(
      geometry.inputReturnAngle,
      geometry.inputPowerAngle,
      index / 4096,
    );
    const state = stateAtInputAngle(inputAngle, -0.7, 0.2);
    near(state.upperPin.distanceTo(fourBar.handlePivot),
      fourBar.inputCrankLength, 7e-16,
      `input crank length at ${index}`);
    near(state.lowerPin.distanceTo(fourBar.shortLeverPivot),
      fourBar.rockerLength, 7e-16,
      `short rocker length at ${index}`);
    near(state.lowerPin.distanceTo(state.upperPin),
      fourBar.couplerLength, 1.5e-15,
      `coupler length at ${index}`);
    near(state.couplerLengthError, 0, 1.5e-15,
      `reported coupler error at ${index}`);
    near(state.rockerLengthError, 0, 7e-16,
      `reported rocker error at ${index}`);
    assert.ok(Number.isFinite(state.rockerAngularSpeed));
    assert.ok(Number.isFinite(state.rockerAngularAcceleration));
    assert.ok(state.rockerAngle >= previousRockerAngle - 1e-14,
      `four-bar branch does not fold at ${index}`);
    previousRockerAngle = state.rockerAngle;
  }
  near(stateAtInputAngle(geometry.inputReturnAngle).rockerAngle,
    geometry.minimumRockerAngle, 0, 'released rocker limit');
  near(stateAtInputAngle(geometry.inputEngageAngle).rockerAngle,
    geometry.engageRockerAngle, 0, 'clamp engagement rocker angle');
  near(stateAtInputAngle(geometry.inputPowerAngle).rockerAngle,
    geometry.maximumRockerAngle, 0, 'power rocker limit');
  near(stateAtInputAngle(geometry.sourceInputAngle).rockerAngle,
    geometry.sourceRockerAngle, 7e-16, 'engraved rocker angle');
  disposeModel(model.root);
});

test('movement 280 clamps only for the clockwise power stroke and releases on return', () => {
  const model = createMovementModel(catalog.movements[279]);
  const {
    geometry,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;
  const stageSamples = [
    [0.10, 'bottom-handle-dwell-wheel-held'],
    [0.45, 'upstroke-clamp-takeup-wheel-held'],
    [1.35, 'upstroke-rim-clamped-friction-drive'],
    [2.25, 'top-handle-dwell-rim-clamped'],
    [3.05, 'downstroke-clamp-released-wheel-held'],
    [3.90, 'bottom-handle-dwell-wheel-held'],
  ];
  for (const [time, expectedStage] of stageSamples) {
    assert.equal(stateAtTime(time).stage, expectedStage);
  }

  let previousWheelAngle = stateAtTime(0).wheelAngle;
  for (let index = 0; index <= 8192; index += 1) {
    const time = timeline.cyclePeriod * index / 8192;
    const state = stateAtTime(time);
    assert.ok(state.shoeGap >= 0, `shoe gap at ${index}`);
    assert.ok(state.shoeGap <= geometry.maximumShoeGap + 1e-15,
      `bounded shoe gap at ${index}`);
    assert.ok(state.wheelAngularSpeed <= 1e-14,
      `wheel never reverses at ${index}`);
    assert.ok(state.wheelAngle <= previousWheelAngle + 1e-14,
      `wheel angle is monotonic at ${index}`);
    if (Math.abs(state.wheelAngularSpeed) > 1e-12) {
      assert.equal(state.driving, true);
      assert.equal(state.clampActive, true);
      near(state.shoeGap, 0, 0, `closed shoe at ${index}`);
      near(state.noSlipArcSpeedError, 0, 3e-17,
        `no-slip arc speed at ${index}`);
      assert.equal(state.outputDirection, 'clockwise');
    } else if (!state.driving) {
      assert.equal(state.outputDirection, 'held');
    }
    if (/takeup|released/.test(state.stage)) {
      near(state.wheelAngularSpeed, 0, 0,
        `wheel held while shoe is free at ${index}`);
    }
    previousWheelAngle = state.wheelAngle;
  }
  const end = stateAtTime(timeline.cyclePeriod);
  near(end.wheelAngle, -geometry.outputStopPitch, 0,
    'one half-tooth clockwise advance');
  near(geometry.contactLeverRadius / geometry.wheelContactRadius,
    transmission.outputRatio, 0, 'friction arc ratio');
  assert.match(transmission.clampSequence, /smooth gap take-up/);
  assert.match(transmission.inputOutputDirection, /downward return leaves/);
  disposeModel(model.root);
});

test('movement 280 staggered pawls alternate at every half-tooth output stop', () => {
  const model = createMovementModel(catalog.movements[279]);
  const {
    geometry,
    pawlStateAtWheelAngle,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;

  near(geometry.outputStopPitch, geometry.ratchetToothPitch / 2, 0,
    'two staggered stops per ratchet tooth');
  assert.equal(transmission.outputStopsPerRatchetTooth, 2);
  assert.equal(timeline.inputStrokesPerRatchetTurn, 72);
  for (let stopIndex = 0; stopIndex <= 16; stopIndex += 1) {
    const wheelAngle = -stopIndex * geometry.outputStopPitch;
    const pawls = pawlStateAtWheelAngle(wheelAngle);
    assert.equal(pawls.holdingPawl,
      stopIndex % 2 === 0 ? 'upper' : 'lower');
    near(stopIndex % 2 === 0
      ? pawls.upperClearance
      : pawls.lowerClearance, 0, 4e-18,
    `seated pawl at stop ${stopIndex}`);
    const state = stateAtTime(stopIndex * timeline.cyclePeriod);
    near(state.wheelAngle, wheelAngle, 1e-15,
      `output stop ${stopIndex}`);
    assert.equal(state.holdingPawl,
      stopIndex % 2 === 0 ? 'upper' : 'lower');
  }

  for (let index = 0; index <= 4096; index += 1) {
    const state = stateAtTime(timeline.cyclePeriod * index / 4096);
    assert.ok(state.upperClearance >= 0, `upper pawl gap at ${index}`);
    assert.ok(state.lowerClearance >= 0, `lower pawl gap at ${index}`);
    if (Math.abs(state.wheelAngularSpeed) < 1e-12) {
      assert.notEqual(state.holdingPawl, 'neither-during-forward-index',
        `one pawl holds stationary wheel at ${index}`);
    }
  }
  assert.match(transmission.antiRollback, /staggered by one half/);
  disposeModel(model.root);
});

test('movement 280 analytic linkage and wheel rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[279]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-4;

  for (const time of [0.30, 0.45, 0.60, 0.85, 1.10, 1.50, 1.90,
    2.55, 2.80, 3.10, 3.50]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    const vectorVelocity = (key) => after[key].clone().sub(before[key])
      .multiplyScalar(1 / (2 * step));
    const vectorAcceleration = (key) => after[key].clone().add(before[key])
      .addScaledVector(state[key], -2)
      .multiplyScalar(1 / step ** 2);
    vectorNear(vectorVelocity('upperPin'), state.upperPinVelocity, 5e-8,
      `upper pin velocity at ${time}`);
    vectorNear(vectorAcceleration('upperPin'), state.upperPinAcceleration,
      7e-7, `upper pin acceleration at ${time}`);
    vectorNear(vectorVelocity('lowerPin'), state.lowerPinVelocity, 5e-8,
      `lower pin velocity at ${time}`);
    vectorNear(vectorAcceleration('lowerPin'), state.lowerPinAcceleration,
      7e-7, `lower pin acceleration at ${time}`);
    near((after.rockerAngle - before.rockerAngle) / (2 * step),
      state.rockerAngularSpeed, 5e-8,
    `rocker angular speed at ${time}`);
    near((after.rockerAngle - 2 * state.rockerAngle + before.rockerAngle)
      / step ** 2, state.rockerAngularAcceleration, 6e-7,
    `rocker angular acceleration at ${time}`);
    near((after.wheelAngle - before.wheelAngle) / (2 * step),
      state.wheelAngularSpeed, 3e-9,
    `wheel angular speed at ${time}`);
    near((after.wheelAngle - 2 * state.wheelAngle + before.wheelAngle)
      / step ** 2, state.wheelAngularAcceleration, 3e-8,
    `wheel angular acceleration at ${time}`);
    vectorNear(vectorVelocity('shoeCenter'), state.shoeVelocity, 6e-8,
      `shoe velocity at ${time}`);
    vectorNear(vectorAcceleration('shoeCenter'), state.shoeAcceleration,
      7e-7, `shoe acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 280 renderer binds the four-bar, clamp, wheel, and holding clicks', () => {
  const model = createMovementModel(catalog.movements[279]);
  const {
    animationTiming,
    blocks,
    cameraFitBounds,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(blocks.wheelIndex.parent, blocks.wheelRotor);
  assert.equal(blocks.upperPawlTip.parent, blocks.upperPawl);
  assert.equal(blocks.lowerPawlTip.parent, blocks.lowerPawl);

  const renderedBounds = new THREE.Box3();
  for (const time of [0, 0.45, 1.20, 1.75, 2.25, 2.95, 3.70, 4]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.handLever.rotation.z, expected.inputAngle, 0,
      `rendered hand lever at ${time}`);
    near(blocks.shortLever.rotation.z, expected.rockerAngle, 0,
      `rendered short lever at ${time}`);
    near(blocks.wheelRotor.rotation.z, expected.wheelAngle, 0,
      `rendered windlass wheel at ${time}`);
    near(blocks.clampShoe.position.x,
      -geometry.contactLeverRadius + expected.shoeGap, 0,
    `rendered clamp take-up at ${time}`);
    vectorNear(blocks.connectingRod.children[1].position,
      expected.upperPin, 0, `rendered upper link pin at ${time}`);
    vectorNear(blocks.connectingRod.children[2].position,
      expected.lowerPin, 0, `rendered lower link pin at ${time}`);
    near(blocks.upperPawl.rotation.z,
      blocks.upperPawl.userData.seatAngle + expected.upperLiftAngle, 0,
    `rendered upper holding pawl at ${time}`);
    near(blocks.lowerPawl.rotation.z,
      blocks.lowerPawl.userData.seatAngle + expected.lowerLiftAngle, 0,
    `rendered lower holding pawl at ${time}`);
    assert.equal(model.root.userData.contacts.shoeRim.active,
      expected.clampActive);
    near(model.root.userData.contacts.shoeRim.gap,
      expected.shoeGap, 0, `rendered shoe gap at ${time}`);
    assert.equal(model.root.userData.contacts.upperHoldingPawl.active,
      expected.holdingPawl === 'upper');
    assert.equal(model.root.userData.contacts.lowerHoldingPawl.active,
      expected.holdingPawl === 'lower');
    model.root.updateMatrixWorld(true);
    renderedBounds.union(new THREE.Box3().setFromObject(model.root, true));
  }
  assert.equal(cameraFitBounds.containsBox(renderedBounds), true);
  near(stateAtTime(timeline.driveEnd).wheelAngle,
    -geometry.outputStopPitch, 0, 'rendered drive reaches one stop');
  disposeModel(model.root);
});

test('movement 280 advances one stop per stroke and closes after one wheel turn', () => {
  const model = createMovementModel(catalog.movements[279]);
  const {
    blocks,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const start = stateAtTime(0);
  const oneStroke = stateAtTime(timeline.cyclePeriod);
  const fullTurn = stateAtTime(timeline.fullWheelPeriod);

  near(oneStroke.inputAngle, start.inputAngle, 0,
    'hand lever closes each stroke');
  near(oneStroke.rockerAngle, start.rockerAngle, 0,
    'short lever closes each stroke');
  vectorNear(oneStroke.upperPin, start.upperPin, 0,
    'upper link pin closes each stroke');
  vectorNear(oneStroke.lowerPin, start.lowerPin, 0,
    'lower link pin closes each stroke');
  near(oneStroke.wheelAngle - start.wheelAngle,
    -geometry.outputStopPitch, 0, 'one output stop per stroke');
  assert.notEqual(oneStroke.holdingPawl, start.holdingPawl);
  near(fullTurn.wheelAngle - start.wheelAngle, -Math.PI * 2, 0,
    '72 strokes make one exact wheel turn');
  near(fullTurn.inputAngle, start.inputAngle, 0,
    'full-turn hand closure');
  near(fullTurn.rockerAngle, start.rockerAngle, 0,
    'full-turn rocker closure');
  assert.equal(fullTurn.cycleIndex, 72);

  model.update(0);
  const startWheel = blocks.wheelRotor.quaternion.clone();
  const startHandle = blocks.handLever.quaternion.clone();
  model.update(timeline.fullWheelPeriod);
  near(blocks.wheelRotor.quaternion.angleTo(startWheel), 0, 0,
    'rendered wheel full-turn closure');
  near(blocks.handLever.quaternion.angleTo(startHandle), 0, 0,
    'rendered hand-lever full-turn closure');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
