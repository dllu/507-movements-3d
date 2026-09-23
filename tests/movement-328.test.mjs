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

function vector2Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function vector3Near(actual, expected, tolerance, message) {
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

test('movement 328 is Cartwright’s geared twin-crank parallel motion', () => {
  const movement = catalog.movements[327];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    contacts,
    degreesOfFreedom,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 328);
  assert.equal(movement.number, '328');
  assert.match(movement.title, /^parallel motion invented by Dr/);
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'Cartwright-opposed-equal-crank-geared-parallel-motion');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /twelve-to-thirty-to-thirty-gears/);
  assert.match(mechanism, /opposite-equal-cranks/);
  assert.match(mechanism, /twin-equal-rods/);
  assert.match(transmission.input, /2-unit pinion/);
  assert.match(transmission.output, /x = -5 source units/);
  assert.equal(degreesOfFreedom.mechanism, 1);
  assert.equal(degreesOfFreedom.crossheadTranslationAxes, 1);
  assert.equal(degreesOfFreedom.crossheadRotation, 0);

  assert.ok(blocks.inputFlywheel.parent === model.root);
  assert.ok(blocks.inputPinion.parent === blocks.inputFlywheel);
  assert.ok(blocks.leftGearBody.parent.parent === model.root);
  assert.ok(blocks.rightGearBody.parent.parent === model.root);
  assert.ok(blocks.leftWheelC.parent === blocks.leftGearBody);
  assert.ok(blocks.rightWheelC.parent === blocks.rightGearBody);
  assert.ok(blocks.leftCrankA.parent === blocks.leftGearBody);
  assert.ok(blocks.rightCrankA.parent === blocks.rightGearBody);
  assert.ok(blocks.leftCrankPinAnchor.parent === blocks.leftGearBody);
  assert.ok(blocks.rightCrankPinAnchor.parent === blocks.rightGearBody);
  assert.ok(blocks.leftRod.parent === model.root);
  assert.ok(blocks.rightRod.parent === model.root);
  assert.ok(blocks.crosshead.parent === model.root);
  assert.ok(blocks.pistonRodB.parent === blocks.crosshead);
  assert.ok(blocks.upperBeam.parent === blocks.fixedFrame);
  assert.equal(contacts.inputPinionToRightWheelC.driver,
    blocks.inputPinion);
  assert.equal(contacts.inputPinionToRightWheelC.driven,
    blocks.rightWheelC);
  assert.equal(contacts.rightWheelCToLeftWheelC.driver,
    blocks.rightWheelC);
  assert.equal(contacts.rightWheelCToLeftWheelC.driven,
    blocks.leftWheelC);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    /equal-toothed-wheel-C$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /equal-radius-crank-A$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /equal-obliquity-connecting-rod$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /^input-flywheel-rigid-spoke-/.test(role)).length, 4);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)),
    false);
  disposeModel(model.root);
});

test('movement 328 preserves the official dimensions, timing, and landmarks', () => {
  const movement = catalog.movements[327];
  const model = createMovementModel(movement);
  const {
    geometry,
    modelPointToOfficialAnimationRaster,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.baseCycleSeconds, 4);
  assert.equal(sourceAnimation.outputCycleSeconds, 10);
  assert.equal(sourceAnimation.assemblyClosureSeconds, 20);
  assert.deepEqual(sourceAnimation.officialGeometry, {
    connectingRodLength: 15,
    crankRadius: 3.5,
    crossheadSpan: 10,
    equalGearCenterSpacing: 10,
    equalGearPitchRadius: 5,
    equalGearRotationPerInputTurn: 0.4,
    flywheelInnerRadius: 12.5,
    flywheelOuterRadius: 15,
    gearCenterY: 7,
    inputPinionPitchRadius: 2,
    leftGearInitialTurn: 0.5,
    pistonRodBottomLocalY: -20.5,
    pistonRodTopLocalY: -1.125,
    rightGearInitialTurn: 0,
  });
  assert.deepEqual(sourceAnimation.officialKeyframes.map(({ phase }) =>
    phase), [0, 0.25, 0.5, 0.75, 1]);
  vector2Near(sourceAnimation.officialKeyframes[0].leftCrankPin,
    new THREE.Vector2(-13.5, 7), 0, 'official initial left crank A');
  vector2Near(sourceAnimation.officialKeyframes[0].rightCrankPin,
    new THREE.Vector2(3.5, 7), 0, 'official initial right crank A');
  near(sourceAnimation.officialKeyframes[1].crossheadY, -11.5, 0,
    'official lower dead center');
  near(sourceAnimation.officialKeyframes[3].crossheadY, -4.5, 2e-15,
    'official upper dead center');
  assert.match(sourceAnimation.referenceScope, /equal 5-unit wheels C C/);
  assert.match(sourceAnimation.referenceScope, /opposite 3.5-unit cranks/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_328.html');

  assert.deepEqual(sourceReference.officialAnimationView, {
    canvasHeight: 525,
    canvasWidth: 525,
    minimum: new THREE.Vector2(-17, -18.847584),
    viewHeight: 34,
    viewWidth: 34,
  });
  const inputCenterRaster = modelPointToOfficialAnimationRaster(
    new THREE.Vector2(),
  );
  near(inputCenterRaster.x, 17 * 525 / 34, 0,
    'official input-pinion center raster x');
  near(inputCenterRaster.y,
    525 - 18.847584 * 525 / 34, 0,
  'official input-pinion center raster y');
  const leftWheelRaster = modelPointToOfficialAnimationRaster(
    geometry.leftGearCenter,
  );
  near(leftWheelRaster.x, 7 * 525 / 34, 1e-13,
    'official left wheel C raster x');
  near(leftWheelRaster.y,
    525 - (7 + 18.847584) * 525 / 34, 1e-13,
  'official left wheel C raster y');

  const plate = sourceReference.brownPlate328;
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 24);
  assert.deepEqual(plate.rasterLeftWheelCenterC,
    new THREE.Vector2(119, 106));
  assert.deepEqual(plate.rasterRightWheelCenterC,
    new THREE.Vector2(285, 107));
  assert.deepEqual(plate.rasterInputPinionCenter,
    new THREE.Vector2(286, 244));
  assert.deepEqual(plate.rasterPistonAxisB,
    new THREE.Vector2(200, 440));
  assert.match(plate.inferredTopology, /two equal opposite cranks A A/);
  assert.match(plate.inferredTopology, /one horizontal crosshead/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    edition: 21,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 328 gears mesh at exact 12:30:30 pitch ratios without slip', () => {
  const model = createMovementModel(catalog.movements[327]);
  const {
    blocks,
    contacts,
    geometry,
    stateAtTime,
  } = model.root.userData;

  assert.equal(blocks.inputPinion.userData.teeth, 12);
  assert.equal(blocks.leftWheelC.userData.teeth, 30);
  assert.equal(blocks.rightWheelC.userData.teeth, 30);
  assert.equal(blocks.inputPinion.userData.toothProfile, 'true-involute');
  assert.equal(blocks.leftWheelC.userData.toothProfile, 'true-involute');
  assert.equal(blocks.rightWheelC.userData.toothProfile, 'true-involute');
  near(blocks.inputPinion.userData.module,
    blocks.rightWheelC.userData.module, 2e-17,
  'input/right common module');
  near(blocks.rightWheelC.userData.module,
    blocks.leftWheelC.userData.module, 0, 'right/left common module');
  near(blocks.inputPinion.userData.toothHeight,
    blocks.rightWheelC.userData.toothHeight, 0,
  'input/right common tooth height');
  near(geometry.rightGearCenter.length(),
    geometry.inputPinionRadius + geometry.equalGearRadius, 0,
  'input-to-right pitch center distance');
  near(geometry.leftGearCenter.distanceTo(geometry.rightGearCenter),
    2 * geometry.equalGearRadius, 0,
  'equal-wheel pitch center distance');
  near(geometry.equalGearRatio, 2 / 5, 0, 'pinion-to-wheel ratio');
  near(contacts.inputPinionToRightWheelC.ratio, -2 / 5, 0,
    'first external mesh ratio');
  near(contacts.rightWheelCToLeftWheelC.ratio, -1, 0,
    'equal external mesh ratio');
  assert.equal(contacts.inputPinionToRightWheelC.type,
    'external-involute-gear-mesh');
  assert.equal(contacts.rightWheelCToLeftWheelC.type,
    'equal-external-involute-gear-mesh');

  for (let sample = 0; sample <= 2048; sample += 1) {
    const time = geometry.assemblyClosurePeriod * sample / 2048;
    const state = stateAtTime(time);
    near(state.rightGearUnwrappedAngle,
      -geometry.equalGearRatio * state.unwrappedInputAngle, 0,
    `right-wheel phase ratio at ${sample}`);
    near(state.leftGearUnwrappedAngle,
      Math.PI + geometry.equalGearRatio * state.unwrappedInputAngle, 0,
    `left-wheel phase ratio at ${sample}`);
    near(state.rightGearAngularVelocity,
      -geometry.equalGearRatio * state.inputAngularVelocity, 0,
    `right-wheel speed ratio at ${sample}`);
    near(state.leftGearAngularVelocity,
      geometry.equalGearRatio * state.inputAngularVelocity, 0,
    `left-wheel speed ratio at ${sample}`);
    vector2Near(state.inputPinionPitchContact,
      state.mesh.rightGearLowerPitchContact, 1e-16,
    `input/right shared pitch point at ${sample}`);
    vector2Near(state.mesh.equalGearPitchContact,
      new THREE.Vector2(geometry.pistonAxisX, geometry.gearCenterY), 0,
    `equal-wheel shared pitch point at ${sample}`);
    vector2Near(state.mesh.inputPitchPointResidual,
      new THREE.Vector2(), 1e-16,
    `first pitch-point residual at ${sample}`);
    vector2Near(state.mesh.inputSlipVelocity,
      new THREE.Vector2(), 2e-16, `first mesh slip at ${sample}`);
    vector2Near(state.mesh.equalGearSlipVelocity,
      new THREE.Vector2(), 0, `equal mesh slip at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 328 solves equal opposed cranks, rods, and straight output exactly', () => {
  const model = createMovementModel(catalog.movements[327]);
  const {
    canonicalStates,
    geometry,
    stateAtTime,
  } = model.root.userData;

  for (let sample = 0; sample <= 4096; sample += 1) {
    const state = stateAtTime(
      geometry.outputCyclePeriod * sample / 4096,
    );
    near(state.leftCrankPin.distanceTo(geometry.leftGearCenter),
      geometry.crankRadius, 7e-16, `left crank radius at ${sample}`);
    near(state.rightCrankPin.distanceTo(geometry.rightGearCenter),
      geometry.crankRadius, 7e-16, `right crank radius at ${sample}`);
    near(state.leftCrankPin.x + state.rightCrankPin.x,
      2 * geometry.pistonAxisX, 5e-16,
    `opposed crank horizontal symmetry at ${sample}`);
    near(state.leftCrankPin.y, state.rightCrankPin.y, 0,
      `opposed crank common height at ${sample}`);
    near(state.leftRod.length, geometry.connectingRodLength, 9e-16,
      `left rod length at ${sample}`);
    near(state.rightRod.length, geometry.connectingRodLength, 9e-16,
      `right rod length at ${sample}`);
    near(state.leftRod.lengthResidual, 0, 9e-16,
      `left rod closure at ${sample}`);
    near(state.rightRod.lengthResidual, 0, 9e-16,
      `right rod closure at ${sample}`);
    near(state.leftRod.obliquityFromVertical,
      -state.rightRod.obliquityFromVertical, 2e-16,
    `equal opposite rod obliquity at ${sample}`);
    vector2Near(state.leftWristPin, state.crosshead.leftEnd, 0,
      `left rod/crosshead closure at ${sample}`);
    vector2Near(state.rightWristPin, state.crosshead.rightEnd, 0,
      `right rod/crosshead closure at ${sample}`);
    near(state.crosshead.leftEnd.distanceTo(state.crosshead.rightEnd),
      geometry.crossheadSpan, 5e-16, `rigid crosshead span at ${sample}`);
    near(state.crosshead.rotation, 0, 0,
      `zero crosshead yaw at ${sample}`);
    near(state.crosshead.center.x, geometry.pistonAxisX, 0,
      `fixed piston axis at ${sample}`);
    vector2Near(state.pistonAxisResidual, new THREE.Vector2(), 0,
      `piston-axis residual at ${sample}`);
  }

  near(canonicalStates.bottomDeadCenter.crossheadY,
    (geometry.sourceGearCenterY - geometry.sourceCrankRadius
      - geometry.sourceConnectingRodLength) * geometry.sourceScale,
  5e-16, 'lower dead center');
  near(canonicalStates.topDeadCenter.crossheadY,
    (geometry.sourceGearCenterY + geometry.sourceCrankRadius
      - geometry.sourceConnectingRodLength) * geometry.sourceScale,
  5e-16, 'upper dead center');
  near(canonicalStates.topDeadCenter.crossheadY
    - canonicalStates.bottomDeadCenter.crossheadY,
  geometry.pistonStroke, 5e-16, 'seven-source-unit piston stroke');
  near(geometry.pistonStroke / geometry.sourceScale, 7, 0,
    'source stroke equals twice the crank radius');
  disposeModel(model.root);
});

test('movement 328 analytic linkage rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[327]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-5;

  for (const time of [0.17, 1.09, 2.03, 3.38, 5.27, 7.14, 9.31]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    near((after.crossheadY - before.crossheadY) / (2 * step),
      state.crossheadVelocityY, 2e-10,
    `crosshead velocity at ${time}`);
    near((after.crossheadVelocityY - before.crossheadVelocityY)
      / (2 * step), state.crossheadAccelerationY, 4e-10,
    `crosshead acceleration at ${time}`);
    vector2Near(after.leftCrankPin.clone().sub(before.leftCrankPin)
      .multiplyScalar(1 / (2 * step)), state.leftCrankPinVelocity,
    2e-10, `left crank-pin velocity at ${time}`);
    vector2Near(after.rightCrankPinVelocity.clone()
      .sub(before.rightCrankPinVelocity).multiplyScalar(1 / (2 * step)),
    state.rightCrankPinAcceleration, 3e-10,
    `right crank-pin acceleration at ${time}`);
    near((after.leftRod.angle - before.leftRod.angle) / (2 * step),
      state.leftRod.angularVelocity, 2e-10,
    `left rod angular velocity at ${time}`);
    near((after.rightRod.angle - before.rightRod.angle) / (2 * step),
      state.rightRod.angularVelocity, 2e-10,
    `right rod angular velocity at ${time}`);
    near((after.leftRod.angularVelocity
      - before.leftRod.angularVelocity) / (2 * step),
    state.leftRod.angularAcceleration, 5e-10,
    `left rod angular acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 328 renderer binds all three rotors and both rod endpoints', () => {
  const model = createMovementModel(catalog.movements[327]);
  const {
    animationTiming,
    blocks,
    contacts,
    geometry,
    stateAtTime,
  } = model.root.userData;

  assert.equal(animationTiming.authoredCyclePeriod, 20);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  model.root.updateMatrixWorld(true);
  const fixedFrameMatrix = blocks.fixedFrame.matrixWorld.clone();
  for (const time of [0, 0.41, 2.5, 4.87, 7.5, 10, 14.2, 20]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.inputFlywheel.rotation.z, state.inputAngle, 0,
      `rendered input angle at ${time}`);
    near(blocks.leftGearBody.rotation.z, state.leftGearAngle, 0,
      `rendered left wheel angle at ${time}`);
    near(blocks.rightGearBody.rotation.z, state.rightGearAngle, 0,
      `rendered right wheel angle at ${time}`);
    vector3Near(blocks.crosshead.position,
      new THREE.Vector3(geometry.pistonAxisX, state.crossheadY, 0), 0,
    `rendered crosshead at ${time}`);
    vector3Near(blocks.leftCrankPinAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
      state.leftCrankPin.x,
      state.leftCrankPin.y,
      geometry.crankPlaneZ,
    ), 1e-15, `rendered left crank A pin at ${time}`);
    vector3Near(blocks.rightCrankPinAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
      state.rightCrankPin.x,
      state.rightCrankPin.y,
      geometry.crankPlaneZ,
    ), 1e-15, `rendered right crank A pin at ${time}`);
    vector3Near(blocks.leftRodCrankAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
      state.leftCrankPin.x,
      state.leftCrankPin.y,
      geometry.rodPlaneZ,
    ), 1e-15, `rendered left rod crank eye at ${time}`);
    vector3Near(blocks.leftRodWristAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
      state.leftWristPin.x,
      state.leftWristPin.y,
      geometry.rodPlaneZ,
    ), 1.5e-15, `rendered left rod wrist eye at ${time}`);
    vector3Near(blocks.rightRodWristAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
      state.rightWristPin.x,
      state.rightWristPin.y,
      geometry.rodPlaneZ,
    ), 1.5e-15, `rendered right rod wrist eye at ${time}`);
    vector3Near(blocks.pistonAxisAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
      geometry.pistonAxisX,
      state.crossheadY,
      geometry.crossheadPlaneZ,
    ), 5e-16, `rendered piston axis at ${time}`);
    vector2Near(contacts.inputPinionToRightWheelC.slipVelocity,
      new THREE.Vector2(), 2e-16, `rendered first mesh slip at ${time}`);
    vector2Near(contacts.rightWheelCToLeftWheelC.slipVelocity,
      new THREE.Vector2(), 0, `rendered equal mesh slip at ${time}`);
    assert.ok(blocks.fixedFrame.matrixWorld.equals(fixedFrameMatrix));
  }
  disposeModel(model.root);
});

test('movement 328 has a spatial engine frame and is distinct from 327', () => {
  const model = createMovementModel(catalog.movements[327]);
  const { blocks, geometry } = model.root.userData;

  for (const name of ['leftBearing', 'rightBearing', 'cylinderBody',
    'cylinderTop', 'stuffingBox', 'glandNeck', 'pistonGland', 'upperBeam']) {
    assert.ok(blocks[name].parent === blocks.fixedFrame, `${name} is fixed`);
  }
  assert.equal(blocks.framePosts, undefined, 'plate draws no stand legs');
  assert.equal(blocks.lowerCrossBase, undefined, 'plate draws no crossbase');
  const undrawn = [];
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (/white|index|post|cross-base|band/.test(role)) undrawn.push(role);
  });
  assert.deepEqual(undrawn, [], 'no undrawn stand, bands or indices remain');
  const bedBox = new THREE.Box3().setFromObject(blocks.upperBeam);
  for (const wheel of [blocks.leftWheelC, blocks.rightWheelC]) {
    const wheelBox = new THREE.Box3().setFromObject(wheel);
    assert.ok(bedBox.min.z > wheelBox.max.z, 'bed passes in front of wheels C');
  }
  const crop = model.root.userData.cameraFitBounds;
  const capBox = new THREE.Box3().setFromObject(blocks.cylinderTop);
  assert.ok(crop.min.y < capBox.min.y, 'plate crop includes the cylinder top');
  assert.ok(crop.min.y > new THREE.Box3().setFromObject(blocks.cylinderBody).min.y,
    'plate crop shows only the top of the cylinder');
  assert.ok(crop.min.x < bedBox.min.x && crop.max.x > capBox.max.x);
  assert.equal(blocks.crossheadPins.length, 2);
  assert.equal(blocks.inputFlywheelSpokes.length, 4);

  const gears = [];
  model.root.traverse((object) => {
    if (object.userData.toothProfile === 'true-involute') {
      gears.push(object);
    }
  });
  assert.deepEqual(new Set(gears), new Set([
    blocks.inputPinion,
    blocks.leftWheelC,
    blocks.rightWheelC,
  ]));
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > geometry.flywheelOuterRadius * 2);
  assert.ok(size.y > 8);
  assert.ok(size.z > 1.3,
    'rear flywheel, gears, front bed, cranks, and rods use real depth');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const model327 = createMovementModel(catalog.movements[326]);
  assert.equal(model327.root.userData.fidelity, 'authored');
  assert.notEqual(model327.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(model327.root.userData.blocks.leftRoller.userData.role,
    'left-guide-roller');
  assert.equal(model.root.userData.blocks.inputPinion.userData.teeth, 12);
  disposeModel(model327.root);
  disposeModel(model.root);
});

test('movement 328 closes exactly and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[327]);
  const {
    canonicalTimes,
    stateAtTime,
  } = model.root.userData;
  const start = stateAtTime(0);
  const outputClosure = stateAtTime(canonicalTimes.firstOutputClosure);
  const closure = stateAtTime(canonicalTimes.assemblyCycleClosure);

  vector2Near(outputClosure.leftCrankPin, start.leftCrankPin, 8e-16,
    'first output-cycle left crank closure');
  vector2Near(outputClosure.rightCrankPin, start.rightCrankPin, 8e-16,
    'first output-cycle right crank closure');
  near(outputClosure.crossheadY, start.crossheadY, 5e-16,
    'first output-cycle crosshead closure');
  near(outputClosure.inputAngle, Math.PI, 1e-15,
    'input index has not closed after one output cycle');
  near(closure.assemblyPhase, start.assemblyPhase, 2e-16,
    'assembly phase closure');
  near(closure.inputAngle, start.inputAngle, 2e-15,
    'input pinion closure');
  near(closure.leftGearAngle, start.leftGearAngle, 2e-15,
    'left wheel C closure');
  near(closure.rightGearAngle, start.rightGearAngle, 2e-15,
    'right wheel C closure');
  vector2Near(closure.leftCrankPin, start.leftCrankPin, 2e-15,
    'left crank A closure');
  vector2Near(closure.rightCrankPin, start.rightCrankPin, 2e-15,
    'right crank A closure');
  near(closure.crossheadY, start.crossheadY, 9e-16,
    'crosshead closure');
  near(closure.unwrappedInputAngle, 10 * Math.PI, 0,
    'five unwrapped input turns in the indexed assembly cycle');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
