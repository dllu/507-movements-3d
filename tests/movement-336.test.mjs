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

function cross2(a, b) {
  return a.x * b.y - a.y * b.x;
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

test('movement 336 is the side-lever rockshaft parallel motion', () => {
  const movement = catalog.movements[335];
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

  assert.equal(movement.id, 336);
  assert.equal(movement.number, '336');
  assert.equal(movement.title,
    'arrangement of parallel motion for side lever marine engines');
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'side-lever-marine-engine-parallelogram-and-rockshaft-radius-arm');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /parallel-rods-M-Q-and-R-S/);
  assert.match(mechanism, /crossbar-Q-N/);
  assert.match(mechanism, /rockshaft-arm-F-Q/);
  assert.match(transmission.exactRigidConstraints, /\|R-S\|=10/);
  assert.match(transmission.exactRigidConstraints, /\|F-Q\|=1\.757556/);
  assert.match(transmission.parallelogram, /M-R-N-Q is exact/);
  assert.match(transmission.straightness, /lateral deviation is measured/);
  assert.equal(degreesOfFreedom.mechanism, 1);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.sideLever.parent, model.root);
  assert.equal(blocks.parallelRod.parent, model.root);
  assert.equal(blocks.sideRod.parent, model.root);
  assert.equal(blocks.crossbar.parent, model.root);
  assert.equal(blocks.radiusArm.parent, model.root);
  assert.equal(blocks.crosshead.parent, model.root);
  assert.equal(blocks.rockshaft.parent, blocks.fixedFrame);
  assert.equal(blocks.crossheadHousing.parent, blocks.crosshead);
  assert.equal(blocks.pistonRod.parent, blocks.crosshead);
  assert.equal(blocks.pistonHead, undefined,
    'the piston is hidden inside the casing, as in Brown\'s elevation');
  for (const name of ['M', 'R']) {
    assert.equal(blocks.jointPins[name].parent, blocks.sideLever);
  }
  assert.equal(blocks.jointPins.Q.parent, blocks.parallelRod);
  assert.equal(blocks.jointPins.N.parent, blocks.sideRod);
  assert.equal(blocks.jointPins.S.parent, blocks.crosshead);
  assert.equal(contacts.sideLeverPivotO.movingMember, blocks.sideLever);
  assert.equal(contacts.rockshaftPivotF.fixedMember, blocks.rockshaft);
  assert.equal(contacts.rockshaftPivotF.movingMember, blocks.radiusArm);
  assert.deepEqual(contacts.radiusAndCrossbarAtQ.members,
    [blocks.parallelRod, blocks.crossbar, blocks.radiusArm]);
  assert.deepEqual(contacts.crossbarAtN.members,
    [blocks.sideRod, blocks.crossbar]);
  assert.deepEqual(contacts.crossheadAtS.members,
    [blocks.sideRod, blocks.crosshead]);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'ten-unit-side-lever-O-R-with-three-unit-parallel-rod-station-M').length,
  1);
  assert.equal(roles.filter((role) => role ===
    'eight-and-one-half-unit-parallel-rod-M-Q').length, 1);
  assert.equal(roles.filter((role) => role ===
    'ten-unit-side-rod-R-S-through-N').length, 1);
  assert.equal(roles.filter((role) => role ===
    'seven-unit-parallelogram-crossbar-Q-N').length, 1);
  assert.equal(roles.filter((role) => role ===
    'one-point-seven-five-seven-five-five-six-unit-rockshaft-arm-F-Q').length,
  1);
  assert.equal(roles.filter((role) => role ===
    'transverse-fixed-axis-rockshaft-F').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 336 preserves every official source dimension and view', () => {
  const movement = catalog.movements[335];
  const model = createMovementModel(movement);
  const {
    geometry,
    modelPointToOfficialAnimationRaster,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const official = sourceAnimation.officialGeometry;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.durationSeconds, 4);
  assert.deepEqual(sourceAnimation.officialFunctionChain, [
    'add_stat',
    'add_rot',
    'add_c_rod_r',
    'add_rot_to',
    'add_c_rod',
    'add_tx',
    'add_c_rod_r',
    'add_rot_to',
    'add_rot_to',
  ]);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_336.html');
  assert.match(sourceAnimation.referenceScope, /both parallel-rod lengths/);
  assert.match(sourceAnimation.referenceScope, /fixed F rockshaft arm/);
  assert.match(sourceAnimation.reconstructionDifference,
    /forces piston pin S onto x=10/);

  assert.deepEqual(official, {
    beamPivotO: new THREE.Vector2(0, 0),
    crossbarLength: 7,
    hiddenCrankCenter: new THREE.Vector2(-10, 10),
    hiddenCrankRadius: 3,
    hiddenDriveRodLength: 10,
    hiddenDrivenBeamRadius: 10,
    inputPhaseOffsetTurns: 0.25,
    parallelRodLength: 8.5,
    radiusArmLength: 1.757556,
    rockshaftPivotF: new THREE.Vector2(4.757556, 8.5),
    sideLeverMidRadius: 3,
    sideLeverRightRadius: 10,
    sideRodIntermediateDistance: 8.5,
    sideRodLength: 10,
    strokeLine: [
      new THREE.Vector2(10, 9.5),
      new THREE.Vector2(10, 14.5),
    ],
  });
  near(geometry.sideLeverRightRadius, 10 * geometry.sourceScale, 0,
    'scaled O-R side lever');
  near(geometry.sideLeverMidRadius, 3 * geometry.sourceScale, 0,
    'scaled O-M station');
  near(geometry.sideRodLength, 10 * geometry.sourceScale, 0,
    'scaled R-S side rod');
  near(geometry.sideRodIntermediateDistance, 8.5 * geometry.sourceScale, 0,
    'scaled R-N station');
  near(geometry.parallelRodLength, 8.5 * geometry.sourceScale, 0,
    'scaled M-Q parallel rod');
  near(geometry.crossbarLength, 7 * geometry.sourceScale, 0,
    'scaled Q-N crossbar');
  near(geometry.radiusArmLength, 1.757556 * geometry.sourceScale, 0,
    'scaled short F-Q arm');
  vector2Near(geometry.rockshaftPivotF,
    new THREE.Vector2(4.757556, 8.5).multiplyScalar(geometry.sourceScale),
  0, 'scaled fixed rockshaft pivot F');

  assert.equal(sourceReference.brownPlate336.imageWidth, 525);
  assert.equal(sourceReference.brownPlate336.imageHeight, 525);
  assert.equal(sourceReference.brownPlate336.sideElevationOfPairedMarineGear,
    true);
  assert.match(sourceReference.brownPlate336.inferredTopology,
    /M-R-N-Q/);
  assert.deepEqual(sourceReference.officialAnimationView, {
    canvasHeight: 525,
    canvasWidth: 525,
    minimum: new THREE.Vector2(-3.310402, -3.896792),
    viewHeight: 18,
    viewWidth: 18,
  });
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    edition: 21,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.officialDescription, movement.description);

  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(-3.310402, -3.896792)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(0, 525), 0, 'official lower-left view corner');
  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(14.689598, 14.103208)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(525, 0), 1.2e-13,
  'official upper-right view corner');
  disposeModel(model.root);
});

test('movement 336 source timing crank drives one exact side lever', () => {
  const model = createMovementModel(catalog.movements[335]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 8192);
    near(state.inputCrankPin.distanceTo(geometry.hiddenCrankCenter),
      geometry.hiddenCrankRadius, 8e-16,
    `hidden crank radius at ${sample}`);
    near(state.beamNegativePoint.distanceTo(state.inputCrankPin),
      geometry.hiddenDriveRodLength, 2e-15,
    `hidden timing-rod length at ${sample}`);
    near(state.beamNegativePoint.distanceTo(geometry.beamPivotO),
      geometry.hiddenDrivenBeamRadius, 2e-15,
    `negative side-lever station at ${sample}`);
    near(state.beamRightPoint.distanceTo(geometry.beamPivotO),
      geometry.sideLeverRightRadius, 2e-15,
    `ten-unit side-lever station R at ${sample}`);
    near(state.beamMidPoint.distanceTo(geometry.beamPivotO),
      geometry.sideLeverMidRadius, 8e-16,
    `three-unit side-lever station M at ${sample}`);
    vector2Near(state.beamNegativePoint,
      state.beamRightPoint.clone().multiplyScalar(-1), 0,
    `opposed hidden driver station at ${sample}`);
    vector2Near(state.beamMidPoint,
      state.beamRightPoint.clone().multiplyScalar(0.3), 5e-16,
    `rigid M station at ${sample}`);
  }
  assert.ok(geometry.minimumBeamAngle < -0.3063);
  assert.ok(geometry.minimumBeamAngle > -0.3064);
  assert.ok(geometry.maximumBeamAngle > 0.3038);
  assert.ok(geometry.maximumBeamAngle < 0.3039);
  disposeModel(model.root);
});

test('movement 336 closes both parallel rods, crossbar, and radius arm', () => {
  const model = createMovementModel(catalog.movements[335]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 8192);
    near(state.pointQ.distanceTo(state.beamMidPoint),
      geometry.parallelRodLength, 4e-15,
    `M-Q parallel rod at ${sample}`);
    near(state.pointS.distanceTo(state.beamRightPoint),
      geometry.sideRodLength, 5e-15,
    `R-S side rod at ${sample}`);
    near(state.pointN.distanceTo(state.beamRightPoint),
      geometry.sideRodIntermediateDistance, 4e-15,
    `R-N intermediate station at ${sample}`);
    near(state.pointN.distanceTo(state.pointQ),
      geometry.crossbarLength, 4e-15,
    `Q-N crossbar at ${sample}`);
    near(state.pointQ.distanceTo(geometry.rockshaftPivotF),
      geometry.radiusArmLength, 8e-15,
    `fixed F-Q radius arm at ${sample}`);

    const parallel = state.pointQ.clone().sub(state.beamMidPoint);
    const side = state.pointS.clone().sub(state.beamRightPoint);
    const crossbar = state.pointN.clone().sub(state.pointQ);
    const beamSegment = state.beamRightPoint.clone()
      .sub(state.beamMidPoint);
    near(Math.abs(cross2(parallel, side)), 0, 4e-15,
    `parallel rods remain parallel at ${sample}`);
    near(parallel.dot(side) / parallel.lengthSq(),
      geometry.sideRodLength / geometry.parallelRodLength, 7e-16,
    `parallel-rod scale at ${sample}`);
    vector2Near(crossbar, beamSegment, 2e-15,
      `M-R-N-Q vector closure at ${sample}`);
    vector2Near(state.pointN.clone().sub(state.beamRightPoint), parallel,
      2e-15, `parallelogram upright closure at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 336 exposes the genuine near-straight piston locus', () => {
  const model = createMovementModel(catalog.movements[335]);
  const { canonicalStates, geometry, stateAtTime } = model.root.userData;
  let maximumDeviation = 0;
  let maximumCanvasResidual = 0;
  let maximumVerticalDifference = 0;
  let minimumY = Infinity;
  let maximumY = -Infinity;

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 16384);
    maximumDeviation = Math.max(maximumDeviation,
      Math.abs(state.crossheadSLateralDeviation));
    maximumCanvasResidual = Math.max(maximumCanvasResidual,
      Math.abs(state.officialCanvasApproximation.radiusArmResidual));
    maximumVerticalDifference = Math.max(maximumVerticalDifference,
      Math.abs(state.pointS.y - state.officialCanvasApproximation.pointS.y));
    minimumY = Math.min(minimumY, state.pointS.y);
    maximumY = Math.max(maximumY, state.pointS.y);
    near(state.officialCanvasApproximation.pointS.x,
      geometry.verticalStrokeLineX, 0,
    `canvas's forced vertical piston line at ${sample}`);
  }

  near(maximumDeviation, geometry.maximumLateralDeviation, 3e-9,
    'measured rigid-link lateral deviation');
  near(maximumCanvasResidual, geometry.maximumOfficialRadiusArmResidual, 3e-9,
    'measured canvas radius-arm residual');
  near(maximumVerticalDifference, geometry.maximumPistonVerticalDifference,
    3e-9, 'measured physical-versus-canvas vertical difference');
  assert.ok(maximumDeviation / geometry.sourceScale > 0.01228);
  assert.ok(maximumDeviation / geometry.sourceScale < 0.01230);
  assert.ok(maximumCanvasResidual / geometry.sourceScale > 0.00924);
  assert.ok(maximumCanvasResidual / geometry.sourceScale < 0.00926);
  assert.ok(maximumVerticalDifference / geometry.sourceScale < 0.000557);
  near(minimumY, geometry.minimumCrossheadY, 3e-9,
    'minimum piston ordinate');
  near(maximumY, geometry.maximumCrossheadY, 3e-9,
    'maximum piston ordinate');
  near(maximumY - minimumY, geometry.outputStroke, 5e-9,
    'physical piston stroke');
  assert.ok(geometry.outputStroke / geometry.sourceScale > 6.0083);
  assert.ok(geometry.outputStroke / geometry.sourceScale < 6.0084);
  assert.ok(canonicalStates.sourceHalf.pointS.y
    > canonicalStates.sourceStart.pointS.y);
  disposeModel(model.root);
});

test('movement 336 analytic point and link rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[335]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-5;
  const pointFields = [
    ['inputCrankPin', 'inputCrankPinVelocity', 'inputCrankPinAcceleration'],
    ['beamNegativePoint', 'beamNegativeVelocity', 'beamNegativeAcceleration'],
    ['beamMidPoint', 'beamMidVelocity', 'beamMidAcceleration'],
    ['beamRightPoint', 'beamRightVelocity', 'beamRightAcceleration'],
    ['pointQ', 'pointQVelocity', 'pointQAcceleration'],
    ['pointN', 'pointNVelocity', 'pointNAcceleration'],
    ['pointS', 'pointSVelocity', 'pointSAcceleration'],
  ];

  for (const time of [0.13, 0.47, 0.91, 1.36, 1.84, 2.31, 2.79, 3.26, 3.73]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    for (const [pointKey, velocityKey, accelerationKey] of pointFields) {
      vector2Near(after[pointKey].clone().sub(before[pointKey])
        .multiplyScalar(1 / (2 * step)), state[velocityKey], 2.8e-9,
      `${pointKey} velocity at ${time}`);
      vector2Near(after[velocityKey].clone().sub(before[velocityKey])
        .multiplyScalar(1 / (2 * step)), state[accelerationKey], 7.5e-9,
      `${pointKey} acceleration at ${time}`);
    }
    for (const link of ['beam', 'parallelRod', 'sideRod', 'crossbar',
      'radiusArm']) {
      near((after[link].angle - before[link].angle) / (2 * step),
        state[link].angularVelocity, 2.2e-9,
      `${link} angular velocity at ${time}`);
      near((after[link].angularVelocity - before[link].angularVelocity)
        / (2 * step), state[link].angularAcceleration, 7.5e-9,
      `${link} angular acceleration at ${time}`);
    }
    near(state.parallelRod.angularVelocity, state.sideRod.angularVelocity,
      8e-16, `parallel rods share angular velocity at ${time}`);
    near(state.parallelRod.angularAcceleration,
      state.sideRod.angularAcceleration, 2e-15,
    `parallel rods share angular acceleration at ${time}`);
    near(state.beam.angularVelocity, state.crossbar.angularVelocity,
      8e-16, `beam and crossbar share angular velocity at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 336 renderer binds all five pins and real 3D layers', () => {
  const model = createMovementModel(catalog.movements[335]);
  const {
    animationTiming,
    blocks,
    contacts,
    stateAtTime,
  } = model.root.userData;

  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  model.root.updateMatrixWorld(true);
  const fixedFrameMatrix = blocks.fixedFrame.matrixWorld.clone();
  for (const time of [0, 0.34, 0.82, 1.29, 1.77, 2.26, 2.74, 3.22, 3.69, 4]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.sideLever.rotation.z, state.beam.angle, 0,
      `rendered side-lever angle at ${time}`);
    near(blocks.parallelRod.rotation.z, state.parallelRod.angle, 0,
      `rendered M-Q angle at ${time}`);
    near(blocks.sideRod.rotation.z, state.sideRod.angle, 0,
      `rendered R-S angle at ${time}`);
    near(blocks.crossbar.rotation.z, state.crossbar.angle, 0,
      `rendered Q-N angle at ${time}`);
    near(blocks.radiusArm.rotation.z, state.radiusArm.angle, 0,
      `rendered F-Q angle at ${time}`);

    vector3Near(blocks.beamMidAnchor.getWorldPosition(new THREE.Vector3()),
      new THREE.Vector3(state.beamMidPoint.x, state.beamMidPoint.y, 0.04),
    7e-16, `side-lever M anchor at ${time}`);
    vector3Near(blocks.beamRightAnchor.getWorldPosition(new THREE.Vector3()),
      new THREE.Vector3(state.beamRightPoint.x, state.beamRightPoint.y, 0.04),
    1.2e-15, `side-lever R anchor at ${time}`);
    vector3Near(blocks.parallelRodStartAnchor.getWorldPosition(
      new THREE.Vector3()),
    new THREE.Vector3(state.beamMidPoint.x, state.beamMidPoint.y, 0.37),
    0, `parallel rod at M at ${time}`);
    vector3Near(blocks.parallelRodEndAnchor.getWorldPosition(
      new THREE.Vector3()),
    new THREE.Vector3(state.pointQ.x, state.pointQ.y, 0.37),
    1.3e-15, `parallel rod at Q at ${time}`);
    vector3Near(blocks.sideRodStartAnchor.getWorldPosition(
      new THREE.Vector3()),
    new THREE.Vector3(state.beamRightPoint.x, state.beamRightPoint.y, 0.40),
    0, `side rod at R at ${time}`);
    vector3Near(blocks.sideRodIntermediateAnchor.getWorldPosition(
      new THREE.Vector3()),
    new THREE.Vector3(state.pointN.x, state.pointN.y, 0.40),
    1.3e-15, `side rod at N at ${time}`);
    vector3Near(blocks.sideRodEndAnchor.getWorldPosition(new THREE.Vector3()),
      new THREE.Vector3(state.pointS.x, state.pointS.y, 0.40),
    1.5e-15, `side rod at S at ${time}`);
    vector3Near(blocks.crossbarStartAnchor.getWorldPosition(
      new THREE.Vector3()),
    new THREE.Vector3(state.pointQ.x, state.pointQ.y, 0.68),
    0, `crossbar at Q at ${time}`);
    vector3Near(blocks.crossbarEndAnchor.getWorldPosition(
      new THREE.Vector3()),
    new THREE.Vector3(state.pointN.x, state.pointN.y, 0.68),
    1.8e-15, `crossbar at N at ${time}`);
    vector3Near(blocks.radiusArmEndAnchor.getWorldPosition(
      new THREE.Vector3()),
    new THREE.Vector3(state.pointQ.x, state.pointQ.y, -0.05),
    3.5e-15, `rockshaft arm at Q at ${time}`);
    vector3Near(blocks.crossheadAnchor.getWorldPosition(new THREE.Vector3()),
      new THREE.Vector3(state.pointS.x, state.pointS.y,
        blocks.jointPins.S.position.z),
    0, `crosshead at S at ${time}`);
    vector3Near(contacts.radiusAndCrossbarAtQ.point,
      new THREE.Vector3(state.pointQ.x, state.pointQ.y,
        blocks.jointPins.Q.position.z), 0,
    `live Q contact at ${time}`);
    vector3Near(contacts.crossbarAtN.point,
      new THREE.Vector3(state.pointN.x, state.pointN.y,
        blocks.jointPins.N.position.z), 0,
    `live N contact at ${time}`);
    vector3Near(contacts.crossheadAtS.point,
      new THREE.Vector3(state.pointS.x, state.pointS.y,
        blocks.jointPins.S.position.z), 0,
    `live S contact at ${time}`);
    assert.ok(blocks.fixedFrame.matrixWorld.equals(fixedFrameMatrix));
  }

  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 5.1);
  assert.ok(size.y > 5.3, 'the plate crops the frame above F; the old undrawn deck is gone');
  assert.ok(size.z > 1.5,
    'casing, standard, side lever, upright rods, crossbar and pins use real depth');
  assert.equal(blocks.rockshaftBearings.length, 1);
  assert.equal(blocks.rockshaftSupports.length, 2);
  const undrawn = [];
  model.root.traverse((object) => {
    if (/guide-rail|deck|frame-post|piston-head/.test(object.userData.role ?? '')) {
      undrawn.push(object.userData.role);
    }
  });
  assert.deepEqual(undrawn, [], 'no guides, deck or posts absent from the plate');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const model335 = createMovementModel(catalog.movements[334]);
  assert.equal(model335.root.userData.fidelity, 'authored');
  assert.notEqual(model335.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(model335.root.userData.blocks.crossbar.parent, model335.root);
  disposeModel(model335.root);
  disposeModel(model.root);
});

test('movement 336 closes exactly and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[335]);
  const { blocks, canonicalTimes, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);

  near(closure.phase, start.phase, 0, 'source phase closure');
  near(closure.inputAngle, start.inputAngle, 9e-16,
    'timing crank closure');
  vector2Near(closure.inputCrankPin, start.inputCrankPin, 1e-15,
    'timing crank-pin closure');
  near(closure.beam.angle, start.beam.angle, 8e-16,
    'side-lever closure');
  vector2Near(closure.beamMidPoint, start.beamMidPoint, 1e-15,
    'M closure');
  vector2Near(closure.beamRightPoint, start.beamRightPoint, 1e-15,
    'R closure');
  vector2Near(closure.pointQ, start.pointQ, 1e-15, 'Q closure');
  vector2Near(closure.pointN, start.pointN, 1e-15, 'N closure');
  vector2Near(closure.pointS, start.pointS, 1e-15, 'S closure');
  near(closure.unwrappedInputAngle, Math.PI * 2, 0,
    'one unwrapped source timing turn');
  model.update(canonicalTimes.cycleClosure);
  near(blocks.sideLever.rotation.z, start.beam.angle, 8e-16,
    'rendered side-lever closure');
  vector3Near(blocks.crosshead.position,
    new THREE.Vector3(start.pointS.x, start.pointS.y, 0), 1e-15,
  'rendered crosshead closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
