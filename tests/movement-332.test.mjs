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

test('movement 332 is the side-lever marine-engine parallel motion', () => {
  const movement = catalog.movements[331];
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

  assert.equal(movement.id, 332);
  assert.equal(movement.number, '332');
  assert.equal(movement.title,
    'parallel motion used for the piston-rod of side lever marine engines');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'side-lever-marine-engine-radius-bar-FC-parallel-bar-ED');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /radius-bar-F-C/);
  assert.match(mechanism, /crosshead-E/);
  assert.match(mechanism, /parallel-bar-E-D/);
  assert.match(transmission.exactRigidConstraints, /\|F-C\|=7\.695702/);
  assert.match(transmission.straightness, /approximate straight-line/);
  assert.equal(degreesOfFreedom.mechanism, 1);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.fixedPivotF.parent, blocks.fixedFrame);
  assert.equal(blocks.sideLever.parent, model.root);
  assert.equal(blocks.leftLink.parent, model.root);
  assert.equal(blocks.rightLink.parent, model.root);
  assert.equal(blocks.parallelBarED.parent, model.root);
  assert.equal(blocks.radiusBarFC.parent, model.root);
  assert.equal(blocks.crossheadE.parent, model.root);
  assert.equal(blocks.crossheadEHousing.parent, blocks.crossheadE);
  assert.equal(blocks.pistonRod.parent, blocks.crossheadE);
  assert.equal(blocks.pistonHead, undefined,
    'the piston stays hidden in the drawn vessel');
  assert.equal(blocks.jointPins.beamMid.parent, blocks.sideLever);
  assert.equal(blocks.jointPins.beamRight.parent, blocks.sideLever);
  assert.equal(blocks.jointPins.pointC.parent, blocks.leftLink);
  assert.equal(blocks.jointPins.pointD.parent, blocks.leftLink);
  assert.equal(blocks.jointPins.pointE.parent, blocks.crossheadE);
  assert.equal(contacts.beamPivotA.movingMember, blocks.sideLever);
  assert.equal(contacts.radiusBarPivotF.fixedMember, blocks.fixedPivotF);
  assert.equal(contacts.radiusBarPivotF.movingMember, blocks.radiusBarFC);
  assert.deepEqual(contacts.linksToCrossheadE.members,
    [blocks.rightLink, blocks.parallelBarED, blocks.crossheadE]);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'left-eight-unit-parallel-motion-link-through-C').length, 1);
  assert.equal(roles.filter((role) => role ===
    'right-eight-unit-link-to-crosshead-E').length, 1);
  assert.equal(roles.filter((role) => role ===
    'four-unit-parallel-bar-E-D').length, 1);
  assert.equal(roles.filter((role) => role ===
    'fixed-length-radius-bar-F-C').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 332 preserves every official pivot and bar dimension', () => {
  const movement = catalog.movements[331];
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
    'https://507movements.com/mm_332.html');
  assert.match(sourceAnimation.referenceScope, /all bar lengths/);
  assert.match(sourceAnimation.reconstructionDifference,
    /forces E onto x=8/);

  assert.deepEqual(official, {
    hiddenCrankCenter: new THREE.Vector2(-8, -12),
    hiddenCrankRadius: 2.75,
    hiddenDriveRodLength: 12,
    leftLinkLength: 8,
    leftLinkPointCDistance: 6,
    parallelBarLength: 4,
    radiusBarLength: 7.695702,
    radiusPivotF: new THREE.Vector2(11.695702, 6),
    rightLinkLength: 8,
    sideLeverMidRadius: 4,
    sideLeverRadius: 8,
    verticalStrokeLineX: 8,
  });
  near(geometry.sideLeverRadius, 8 * geometry.sourceScale, 0,
    'scaled side-lever radius');
  near(geometry.sideLeverMidRadius, 4 * geometry.sourceScale, 0,
    'scaled side-lever middle pin');
  near(geometry.leftLinkLength, 8 * geometry.sourceScale, 0,
    'scaled left link');
  near(geometry.leftLinkPointCDistance, 6 * geometry.sourceScale, 0,
    'scaled point C station');
  near(geometry.rightLinkLength, 8 * geometry.sourceScale, 0,
    'scaled right link');
  near(geometry.parallelBarLength, 4 * geometry.sourceScale, 0,
    'scaled E-D bar');
  near(geometry.radiusBarLength, 7.695702 * geometry.sourceScale, 0,
    'scaled F-C radius bar');
  vector2Near(geometry.radiusPivotF,
    new THREE.Vector2(11.695702, 6).multiplyScalar(geometry.sourceScale),
  0, 'scaled fixed pivot F');

  assert.equal(sourceReference.brownPlate332.imageWidth, 525);
  assert.equal(sourceReference.brownPlate332.imageHeight, 525);
  assert.match(sourceReference.brownPlate332.inferredTopology,
    /radius bar F-C/);
  assert.deepEqual(sourceReference.officialAnimationView, {
    canvasHeight: 525,
    canvasWidth: 525,
    minimum: new THREE.Vector2(-2.354441, -2.9477),
    viewHeight: 15,
    viewWidth: 15,
  });
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    edition: 21,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.officialDescription, movement.description);

  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(
      -2.354441 * geometry.sourceScale,
      -2.9477 * geometry.sourceScale,
    )), new THREE.Vector2(0, 525), 1.2e-13,
  'official lower-left view corner');
  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(
      12.645559 * geometry.sourceScale,
      12.0523 * geometry.sourceScale,
    )), new THREE.Vector2(525, 0), 1.2e-13,
  'official upper-right view corner');
  disposeModel(model.root);
});

test('movement 332 source timing crank drives one exact rocking side lever', () => {
  const model = createMovementModel(catalog.movements[331]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 8192);
    near(state.inputCrankPin.distanceTo(geometry.hiddenCrankCenter),
      geometry.hiddenCrankRadius, 7e-16,
    `source timing-crank radius at ${sample}`);
    near(state.inputCrankPin.distanceTo(state.beamNegativePoint),
      geometry.hiddenDriveRodLength, 1.8e-15,
    `source timing-rod length at ${sample}`);
    near(state.beamNegativePoint.length(),
      geometry.hiddenDrivenBeamRadius, 5e-15,
    `negative beam station at ${sample}`);
    near(state.beamMidPoint.length(), geometry.sideLeverMidRadius,
      3e-15, `four-unit beam station at ${sample}`);
    near(state.beamRightPoint.length(), geometry.sideLeverRadius,
      5e-15, `eight-unit beam station at ${sample}`);
    vector2Near(state.beamMidPoint,
      state.beamRightPoint.clone().multiplyScalar(0.5), 0,
    `rigid side-lever collinearity at ${sample}`);
    vector2Near(state.beamNegativePoint,
      state.beamRightPoint.clone().multiplyScalar(-1), 0,
    `opposed source driver station at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 332 closes every visible rigid link without stretching', () => {
  const model = createMovementModel(catalog.movements[331]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 8192);
    near(state.pointC.distanceTo(state.beamMidPoint),
      geometry.leftLinkPointCDistance, 1.2e-15,
    `B4-C distance at ${sample}`);
    near(state.pointD.distanceTo(state.beamMidPoint),
      geometry.leftLinkLength, 1.8e-15,
    `left eight-unit link at ${sample}`);
    near(state.pointC.distanceTo(geometry.radiusPivotF),
      geometry.radiusBarLength, 1.4e-15,
    `fixed radius bar F-C at ${sample}`);
    near(state.pointD.distanceTo(state.pointE),
      geometry.parallelBarLength, 1.2e-15,
    `parallel bar E-D at ${sample}`);
    near(state.pointE.distanceTo(state.beamRightPoint),
      geometry.rightLinkLength, 1.8e-15,
    `right eight-unit link at ${sample}`);
    const leftDirection = state.pointD.clone().sub(state.beamMidPoint);
    const cDirection = state.pointC.clone().sub(state.beamMidPoint);
    near(Math.abs(leftDirection.x * cDirection.y
      - leftDirection.y * cDirection.x), 0, 1e-15,
    `point C lies on left link at ${sample}`);
    near(cDirection.dot(leftDirection)
      / leftDirection.lengthSq(), 0.75, 5e-16,
    `point C is three-quarters along left link at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 332 exposes its genuine near-straight crosshead-E locus', () => {
  const model = createMovementModel(catalog.movements[331]);
  const {
    canonicalStates,
    geometry,
    stateAtTime,
  } = model.root.userData;
  let maximumDeviation = 0;
  let maximumCanvasResidual = 0;
  let minimumY = Infinity;
  let maximumY = -Infinity;

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 16384);
    maximumDeviation = Math.max(maximumDeviation,
      Math.abs(state.crossheadELateralDeviation));
    maximumCanvasResidual = Math.max(maximumCanvasResidual,
      Math.abs(state.officialCanvasApproximation.radiusBarResidual));
    minimumY = Math.min(minimumY, state.pointE.y);
    maximumY = Math.max(maximumY, state.pointE.y);
    near(state.officialCanvasApproximation.pointE.x,
      8 * geometry.sourceScale, 0,
    `canvas's forced vertical line at ${sample}`);
  }

  near(maximumDeviation, geometry.maximumLateralDeviation, 3e-9,
    'measured rigid-link lateral deviation');
  near(maximumCanvasResidual, geometry.maximumOfficialRadiusResidual, 3e-9,
    'measured canvas radius-bar residual');
  assert.ok(maximumDeviation / geometry.sourceScale < 0.00535);
  assert.ok(maximumCanvasResidual / geometry.sourceScale < 0.00390);
  assert.ok(maximumDeviation > 0,
    'the historical parallel motion is approximate rather than fictitiously exact');
  near(minimumY, geometry.minimumCrossheadY, 3e-9,
    'minimum crosshead ordinate');
  near(maximumY, geometry.maximumCrossheadY, 3e-9,
    'maximum crosshead ordinate');
  near(maximumY - minimumY, geometry.outputStroke, 5e-9,
    'crosshead stroke');
  assert.ok(geometry.outputStroke / geometry.sourceScale > 5.50);
  assert.ok(geometry.outputStroke / geometry.sourceScale < 5.51);
  assert.ok(canonicalStates.lowerStroke.pointE.y
    < canonicalStates.upperStroke.pointE.y);
  disposeModel(model.root);
});

test('movement 332 analytic linkage rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[331]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-5;
  const pointFields = [
    ['beamNegativePoint', 'beamNegativeVelocity', 'beamNegativeAcceleration'],
    ['beamMidPoint', 'beamMidVelocity', 'beamMidAcceleration'],
    ['beamRightPoint', 'beamRightVelocity', 'beamRightAcceleration'],
    ['pointC', 'pointCVelocity', 'pointCAcceleration'],
    ['pointD', 'pointDVelocity', 'pointDAcceleration'],
    ['pointE', 'crossheadEVelocity', 'crossheadEAcceleration'],
  ];

  for (const time of [0.13, 0.48, 0.92, 1.37, 1.88, 2.36, 2.83, 3.41, 3.78]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    for (const [pointKey, velocityKey, accelerationKey] of pointFields) {
      vector2Near(after[pointKey].clone().sub(before[pointKey])
        .multiplyScalar(1 / (2 * step)), state[velocityKey], 2.2e-9,
      `${pointKey} velocity at ${time}`);
      vector2Near(after[velocityKey].clone().sub(before[velocityKey])
        .multiplyScalar(1 / (2 * step)), state[accelerationKey], 4.5e-9,
      `${pointKey} acceleration at ${time}`);
    }
    near((after.beamAngle - before.beamAngle) / (2 * step),
      state.beamAngularVelocity, 1.2e-9,
    `beam angular velocity at ${time}`);
    near((after.beamAngularVelocity - before.beamAngularVelocity)
      / (2 * step), state.beamAngularAcceleration, 3.5e-9,
    `beam angular acceleration at ${time}`);
    for (const link of ['leftLink', 'rightLink', 'parallelBar', 'radiusBar']) {
      near((after[link].angle - before[link].angle) / (2 * step),
        state[link].angularVelocity, 1.7e-9,
      `${link} angular velocity at ${time}`);
      near((after[link].angularVelocity - before[link].angularVelocity)
        / (2 * step), state[link].angularAcceleration, 4.8e-9,
      `${link} angular acceleration at ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 332 renderer binds every named pin and spatial link', () => {
  const model = createMovementModel(catalog.movements[331]);
  const {
    animationTiming,
    blocks,
    contacts,
    geometry,
    stateAtTime,
  } = model.root.userData;

  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  model.root.updateMatrixWorld(true);
  const fixedFrameMatrix = blocks.fixedFrame.matrixWorld.clone();
  for (const time of [0, 0.34, 0.87, 1.41, 2.06, 2.58, 3.17, 3.71, 4]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.sideLever.rotation.z, state.beamAngle, 0,
      `rendered side-lever angle at ${time}`);
    near(blocks.leftLink.rotation.z, state.leftLink.angle, 0,
      `rendered left-link angle at ${time}`);
    near(blocks.rightLink.rotation.z, state.rightLink.angle, 0,
      `rendered right-link angle at ${time}`);
    near(blocks.parallelBarED.rotation.z, state.parallelBar.angle, 0,
      `rendered E-D angle at ${time}`);
    near(blocks.radiusBarFC.rotation.z, state.radiusBar.angle, 0,
      `rendered F-C angle at ${time}`);
    vector3Near(blocks.sideLeverMidAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.beamMidPoint.x,
        state.beamMidPoint.y,
        0.02,
      ), 8e-16, `side-lever middle pin at ${time}`);
    vector3Near(blocks.sideLeverRightAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.beamRightPoint.x,
        state.beamRightPoint.y,
        0.02,
      ), 9e-16, `side-lever right pin at ${time}`);
    vector3Near(blocks.leftLinkStartAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.beamMidPoint.x,
        state.beamMidPoint.y,
        0.36,
      ), 0, `left-link start at ${time}`);
    vector3Near(blocks.leftLinkEndAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointD.x,
        state.pointD.y,
        0.36,
      ), 1.1e-15, `point D at ${time}`);
    vector3Near(blocks.pointCAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointC.x,
        state.pointC.y,
        0.36,
      ), 1.1e-15, `point C at ${time}`);
    vector3Near(blocks.rightLinkEndAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointE.x,
        state.pointE.y,
        0.39,
      ), 1.1e-15, `right link at E at ${time}`);
    vector3Near(blocks.parallelBarStartAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointE.x,
        state.pointE.y,
        0.66,
      ), 0, `parallel bar at E at ${time}`);
    vector3Near(blocks.parallelBarEndAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointD.x,
        state.pointD.y,
        0.66,
      ), 1.1e-15, `parallel bar at D at ${time}`);
    vector3Near(blocks.radiusBarEndAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointC.x,
        state.pointC.y,
        0.91,
      ), 1.2e-15, `radius bar at C at ${time}`);
    vector3Near(blocks.crossheadEAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointE.x,
        state.pointE.y,
        blocks.jointPins.pointE.position.z,
      ), 0, `crosshead E at ${time}`);
    vector3Near(contacts.radiusBarAtC.point,
      new THREE.Vector3(state.pointC.x, state.pointC.y,
        blocks.jointPins.pointC.position.z), 0,
    `live C contact at ${time}`);
    vector3Near(contacts.linksToCrossheadE.point,
      new THREE.Vector3(state.pointE.x, state.pointE.y,
        blocks.jointPins.pointE.position.z), 0,
    `live E contact at ${time}`);
    assert.ok(blocks.fixedFrame.matrixWorld.equals(fixedFrameMatrix));
  }

  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 4.3);
  assert.ok(size.y > 3.5, 'the undrawn frame posts below the deck are gone');
  assert.ok(size.z > 1.60,
    'frame, lever, paired links, E-D, F-C, and piston occupy real layers');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const model331 = createMovementModel(catalog.movements[330]);
  assert.equal(model331.root.userData.fidelity, 'authored');
  assert.notEqual(model331.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(model331.root.userData.blocks.flywheelSpokes.length, 6);
  assert.equal(blocks.framePosts, undefined,
    'the plate shows no frame posts or bedplate');
  const undrawn = [];
  model.root.traverse((object) => {
    if (/frame-upright|bedplate|piston-head|deck-working/.test(object.userData.role ?? '')) {
      undrawn.push(object.userData.role);
    }
  });
  assert.deepEqual(undrawn, []);
  disposeModel(model331.root);
  disposeModel(model.root);
});

test('movement 332 closes exactly and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[331]);
  const {
    blocks,
    canonicalTimes,
    stateAtTime,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);

  near(closure.phase, start.phase, 0, 'source phase closure');
  near(closure.inputAngle, start.inputAngle, 0, 'timing crank closure');
  vector2Near(closure.inputCrankPin, start.inputCrankPin, 0,
    'timing crank-pin closure');
  near(closure.beamAngle, start.beamAngle, 0,
    'side-lever closure');
  vector2Near(closure.beamMidPoint, start.beamMidPoint, 0,
    'side-lever middle closure');
  vector2Near(closure.beamRightPoint, start.beamRightPoint, 0,
    'side-lever right closure');
  vector2Near(closure.pointC, start.pointC, 0, 'C closure');
  vector2Near(closure.pointD, start.pointD, 0, 'D closure');
  vector2Near(closure.pointE, start.pointE, 0, 'E closure');
  near(closure.unwrappedInputAngle, Math.PI * 2, 0,
    'one unwrapped source timing turn');
  model.update(canonicalTimes.cycleClosure);
  near(blocks.sideLever.rotation.z, start.beamAngle, 0,
    'rendered side-lever closure');
  vector3Near(blocks.crossheadE.position,
    new THREE.Vector3(start.pointE.x, start.pointE.y, 0), 0,
  'rendered crosshead-E closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
