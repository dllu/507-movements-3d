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

test('movement 333 is the coupled double parallel motion', () => {
  const movement = catalog.movements[332];
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

  assert.equal(movement.id, 333);
  assert.equal(movement.number, '333');
  assert.equal(movement.title, 'parallel motion used only in particular cases');
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'double-parallel-motion-long-ternary-link-and-center-link');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /two-coupled-closed-rigid-parallel-motions/);
  assert.match(transmission.exactRigidConstraints, /\|P-W\|=16/);
  assert.match(transmission.exactRigidConstraints, /\|R-Q\|=8/);
  assert.match(transmission.topology, /share M/);
  assert.equal(degreesOfFreedom.mechanism, 1);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.leftPedestalO.parent, blocks.fixedFrame);
  assert.equal(blocks.rightPedestalR.parent, blocks.fixedFrame);
  assert.equal(blocks.longLink.parent, model.root);
  assert.equal(blocks.leftRadiusBar.parent, model.root);
  assert.equal(blocks.rightUpperRocker.parent, model.root);
  assert.equal(blocks.centerLink.parent, model.root);
  assert.equal(blocks.rightLowerRadiusBar.parent, model.root);
  assert.equal(blocks.leftPiston.parent, model.root);
  assert.equal(blocks.centerPiston, undefined,
    'the plate draws no rod at N');
  assert.equal(blocks.jointPins.M.parent, blocks.longLink);
  assert.equal(blocks.jointPins.W.parent, blocks.longLink);
  assert.equal(blocks.jointPins.P.parent, blocks.leftPiston);
  assert.equal(blocks.jointPins.N.parent, blocks.centerLink);
  assert.equal(blocks.jointPins.Q.parent, blocks.centerLink);
  const explanatory = [];
  model.root.traverse((object) => {
    if (/explanatory|piston-head|neck/.test(object.userData.role ?? '')) {
      explanatory.push(object.userData.role);
    }
  });
  assert.deepEqual(explanatory, []);
  assert.deepEqual(contacts.longLinkAtM.members,
    [blocks.longLink, blocks.leftRadiusBar, blocks.centerLink]);
  assert.deepEqual(contacts.longLinkAtW.members,
    [blocks.longLink, blocks.rightUpperRocker]);
  assert.deepEqual(contacts.centerLinkAtQ.members,
    [blocks.centerLink, blocks.rightLowerRadiusBar]);
  assert.equal(contacts.leftRadiusPivotO.fixedMember, blocks.leftPedestalO);
  assert.equal(contacts.rightUpperPivotR.fixedMember, blocks.rightPedestalR);
  assert.equal(contacts.rightLowerPivotR.fixedMember, blocks.rightPedestalR);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'sixteen-unit-long-ternary-link-P-M-W').length, 1);
  assert.equal(roles.filter((role) => role ===
    'six-unit-center-ternary-link-M-N-Q').length, 1);
  assert.equal(roles.filter((role) => role ===
    'cut-off-rod-guided-by-point-P').length, 1);
  assert.equal(roles.some((role) => /explanatory/.test(role)), false,
    'the official canvas\'s explanatory pistons are not in the plate');
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 333 preserves the official dimensions, timing, and notes', () => {
  const movement = catalog.movements[332];
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
    'add_pos_interp',
    'add_c_rod_r',
    'add_rot_to',
    'add_rot_to',
    'add_c_rod_r',
    'add_rot_to',
    'add_tx',
  ]);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_333.html');
  assert.match(sourceAnimation.referenceScope, /five bar lengths/);
  assert.match(sourceAnimation.officialNotes, /343 and 341/);
  assert.match(sourceAnimation.officialNotes, /uncertain original application/);
  assert.match(sourceAnimation.reconstructionDifference,
    /forces P to x=0/);

  assert.deepEqual(official, {
    addedPistonHalfStroke: 4,
    centerLinkLength: 6,
    centerLinkMidpointDistance: 3,
    leftPivotO: new THREE.Vector2(0, 0),
    leftRadiusLength: 8,
    longLinkLength: 16,
    longLinkMidpointDistance: 8,
    nominalCenterOutputX: 7.8637035,
    rightLowerRadiusLength: 8,
    rightPivotR: new THREE.Vector2(15.727407, -6),
    rightUpperRockerLength: 6.006189,
  });
  near(geometry.longLinkLength, 16 * geometry.sourceScale, 0,
    'scaled P-M-W link');
  near(geometry.longLinkMidpointDistance, 8 * geometry.sourceScale, 0,
    'scaled P-M station');
  near(geometry.leftRadiusLength, 8 * geometry.sourceScale, 0,
    'scaled O-M radius bar');
  near(geometry.rightUpperRockerLength,
    6.006189 * geometry.sourceScale, 0, 'scaled R-W rocker');
  near(geometry.centerLinkLength, 6 * geometry.sourceScale, 0,
    'scaled M-N-Q link');
  near(geometry.centerLinkMidpointDistance, 3 * geometry.sourceScale, 0,
    'scaled M-N station');
  near(geometry.rightLowerRadiusLength, 8 * geometry.sourceScale, 0,
    'scaled R-Q radius bar');
  vector2Near(geometry.leftPivotO, new THREE.Vector2(0, 0), 0,
    'scaled pivot O');
  vector2Near(geometry.rightPivotR,
    new THREE.Vector2(15.727407, -6).multiplyScalar(geometry.sourceScale),
  0, 'scaled pivot R');

  assert.equal(sourceReference.brownPlate333.imageWidth, 525);
  assert.equal(sourceReference.brownPlate333.imageHeight, 525);
  assert.match(sourceReference.brownPlate333.inferredTopology,
    /16-unit ternary link/);
  assert.deepEqual(sourceReference.relatedMovements, [341, 343]);
  assert.deepEqual(sourceReference.officialAnimationView, {
    canvasHeight: 525,
    canvasWidth: 525,
    minimum: new THREE.Vector2(-2.636297, -13.5),
    viewHeight: 21,
    viewWidth: 21,
  });
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    edition: 21,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.officialDescription, movement.description);

  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(-2.636297, -13.5)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(0, 525), 0, 'official lower-left view corner');
  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(18.363703, 7.5)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(525, 0), 1.2e-13,
  'official upper-right view corner');
  disposeModel(model.root);
});

test('movement 333 reconstructs the official forced-P driving construction', () => {
  const model = createMovementModel(catalog.movements[332]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 8192);
    near(state.forcedPointP.x, 0, 0,
      `official forced P centerline at ${sample}`);
    near(state.forcedPointP.y,
      -geometry.addedPistonHalfStroke * Math.cos(state.inputAngle),
    0, `official forced P ordinate at ${sample}`);
    near(state.officialCanvasApproximation.pointW.distanceTo(
      state.forcedPointP), geometry.longLinkLength, 2e-15,
    `official P-W length at ${sample}`);
    near(state.officialCanvasApproximation.pointW.distanceTo(
      geometry.rightPivotR), geometry.rightUpperRockerLength, 4.5e-15,
    `official R-W length at ${sample}`);
    vector2Near(state.officialCanvasApproximation.pointM,
      state.forcedPointP.clone().add(
        state.officialCanvasApproximation.pointW,
      ).multiplyScalar(0.5), 0,
    `official M midpoint at ${sample}`);
    near(state.officialCanvasApproximation.leftRadiusResidual,
      state.officialCanvasApproximation.pointM.length()
        - geometry.leftRadiusLength,
    0, `official rounded O-M residual at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 333 closes all five visible bars exactly', () => {
  const model = createMovementModel(catalog.movements[332]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 8192);
    near(state.pointP.distanceTo(state.pointW),
      geometry.longLinkLength, 3e-15, `P-W at ${sample}`);
    near(state.pointM.distanceTo(state.pointP),
      geometry.longLinkMidpointDistance, 1.5e-15, `P-M at ${sample}`);
    near(state.pointM.distanceTo(state.pointW),
      geometry.longLinkMidpointDistance, 1.5e-15, `M-W at ${sample}`);
    vector2Near(state.pointM,
      state.pointP.clone().add(state.pointW).multiplyScalar(0.5),
    2.3e-16, `M is the P-W midpoint at ${sample}`);
    near(state.pointM.distanceTo(geometry.leftPivotO),
      geometry.leftRadiusLength, 5e-16, `O-M at ${sample}`);
    near(state.pointW.distanceTo(geometry.rightPivotR),
      geometry.rightUpperRockerLength, 1.6e-15, `R-W at ${sample}`);
    near(state.pointM.distanceTo(state.pointQ),
      geometry.centerLinkLength, 1.2e-15, `M-Q at ${sample}`);
    vector2Near(state.pointN,
      state.pointM.clone().add(state.pointQ).multiplyScalar(0.5),
    0, `N is the M-Q midpoint at ${sample}`);
    near(state.pointN.distanceTo(state.pointM),
      geometry.centerLinkMidpointDistance, 8e-16, `M-N at ${sample}`);
    near(state.pointQ.distanceTo(geometry.rightPivotR),
      geometry.rightLowerRadiusLength, 1.4e-15, `R-Q at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 333 exposes both genuine near-straight output loci', () => {
  const model = createMovementModel(catalog.movements[332]);
  const {
    canonicalStates,
    geometry,
    stateAtTime,
  } = model.root.userData;
  let maximumOfficialResidual = 0;
  let maximumPointNDeviation = 0;
  let maximumPointPDeviation = 0;
  let maximumPointPVerticalDifference = 0;
  let minimumPointNY = Infinity;
  let maximumPointNY = -Infinity;
  let minimumPointPY = Infinity;
  let maximumPointPY = -Infinity;

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 16384);
    maximumOfficialResidual = Math.max(maximumOfficialResidual,
      Math.abs(state.officialCanvasApproximation.leftRadiusResidual));
    maximumPointNDeviation = Math.max(maximumPointNDeviation,
      Math.abs(state.pointNLateralDeviation));
    maximumPointPDeviation = Math.max(maximumPointPDeviation,
      Math.abs(state.pointPLateralDeviation));
    maximumPointPVerticalDifference = Math.max(
      maximumPointPVerticalDifference,
      Math.abs(state.pointPVerticalDifferenceFromCanvas),
    );
    minimumPointNY = Math.min(minimumPointNY, state.pointN.y);
    maximumPointNY = Math.max(maximumPointNY, state.pointN.y);
    minimumPointPY = Math.min(minimumPointPY, state.pointP.y);
    maximumPointPY = Math.max(maximumPointPY, state.pointP.y);
  }

  near(maximumOfficialResidual,
    geometry.maximumOfficialLeftRadiusResidual, 3e-9,
  'measured official rounded-dimension residual');
  near(maximumPointNDeviation,
    geometry.maximumPointNLateralDeviation, 3e-9,
  'measured N lateral deviation');
  near(maximumPointPDeviation,
    geometry.maximumPointPLateralDeviation, 3e-9,
  'measured P lateral deviation');
  near(maximumPointPVerticalDifference,
    geometry.maximumPointPVerticalDifference, 3e-9,
  'measured P ordinate correction');
  near(minimumPointNY, geometry.minimumPointNY, 3e-9,
    'minimum N ordinate');
  near(maximumPointNY, geometry.maximumPointNY, 3e-9,
    'maximum N ordinate');
  near(minimumPointPY, geometry.minimumPointPY, 3e-9,
    'minimum P ordinate');
  near(maximumPointPY, geometry.maximumPointPY, 3e-9,
    'maximum P ordinate');
  // Brown's steep beam needs a +/-7.2-unit plate stroke, so the near-straight
  // loci wander a little more than on the official +/-4 drive.
  assert.ok(maximumOfficialResidual / geometry.sourceScale < 0.0879);
  assert.ok(maximumPointPDeviation / geometry.sourceScale < 0.0900);
  assert.ok(maximumPointNDeviation / geometry.sourceScale < 0.0470);
  assert.ok(maximumPointPVerticalDifference / geometry.sourceScale < 0.0712);
  assert.ok(maximumPointPDeviation > 0,
    'P is approximate rather than fictitiously constrained to x=0');
  assert.ok(maximumPointNDeviation > 0,
    'N is approximate rather than fictitiously constrained to one line');
  assert.ok((maximumPointPY - minimumPointPY) / geometry.sourceScale > 14.38);
  assert.ok((maximumPointPY - minimumPointPY) / geometry.sourceScale < 14.40);
  assert.ok((maximumPointNY - minimumPointNY) / geometry.sourceScale > 7.19);
  assert.ok((maximumPointNY - minimumPointNY) / geometry.sourceScale < 7.20);
  assert.ok(canonicalStates.leftPistonBottom.pointP.y
    < canonicalStates.leftPistonTop.pointP.y);
  disposeModel(model.root);
});

test('movement 333 analytic linkage rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[332]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-5;
  const pointFields = [
    ['pointP', 'pointPVelocity', 'pointPAcceleration'],
    ['pointM', 'pointMVelocity', 'pointMAcceleration'],
    ['pointW', 'pointWVelocity', 'pointWAcceleration'],
    ['pointN', 'pointNVelocity', 'pointNAcceleration'],
    ['pointQ', 'pointQVelocity', 'pointQAcceleration'],
  ];

  for (const time of [0.13, 0.48, 0.92, 1.37, 1.88, 2.36, 2.83, 3.41, 3.78]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    for (const [pointKey, velocityKey, accelerationKey] of pointFields) {
      vector2Near(after[pointKey].clone().sub(before[pointKey])
        .multiplyScalar(1 / (2 * step)), state[velocityKey], 2.8e-9,
      `${pointKey} velocity at ${time}`);
      vector2Near(after[velocityKey].clone().sub(before[velocityKey])
        .multiplyScalar(1 / (2 * step)), state[accelerationKey], 5.5e-9,
      `${pointKey} acceleration at ${time}`);
    }
    for (const link of [
      'leftRadius',
      'longLink',
      'rightUpperRocker',
      'centerLink',
      'rightLowerRadius',
    ]) {
      near((after[link].angle - before[link].angle) / (2 * step),
        state[link].angularVelocity, 2e-9,
      `${link} angular velocity at ${time}`);
      near((after[link].angularVelocity - before[link].angularVelocity)
        / (2 * step), state[link].angularAcceleration, 5e-9,
      `${link} angular acceleration at ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 333 renderer binds every named pin and spatial link', () => {
  const model = createMovementModel(catalog.movements[332]);
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
    near(blocks.longLink.rotation.z, state.longLink.angle, 0,
      `rendered long-link angle at ${time}`);
    near(blocks.leftRadiusBar.rotation.z, state.leftRadius.angle, 0,
      `rendered O-M angle at ${time}`);
    near(blocks.rightUpperRocker.rotation.z,
      state.rightUpperRocker.angle, 0, `rendered R-W angle at ${time}`);
    near(blocks.centerLink.rotation.z, state.centerLink.angle, 0,
      `rendered M-Q angle at ${time}`);
    near(blocks.rightLowerRadiusBar.rotation.z,
      state.rightLowerRadius.angle, 0, `rendered R-Q angle at ${time}`);
    vector3Near(blocks.longLinkStartAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointP.x, state.pointP.y, 0.10,
      ), 0, `long link at P at ${time}`);
    vector3Near(blocks.longLinkMidpointAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointM.x, state.pointM.y, 0.10,
      ), 1.2e-15, `long link at M at ${time}`);
    vector3Near(blocks.longLinkEndAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointW.x, state.pointW.y, 0.10,
      ), 2e-15, `long link at W at ${time}`);
    vector3Near(blocks.leftRadiusEndAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointM.x, state.pointM.y, 0.36,
      ), 8e-16, `left radius at M at ${time}`);
    vector3Near(blocks.rightUpperRockerEndAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointW.x, state.pointW.y, 0.58,
      ), 1.5e-15, `upper rocker at W at ${time}`);
    vector3Near(blocks.centerLinkStartAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointM.x, state.pointM.y, 0.77,
      ), 0, `center link at M at ${time}`);
    vector3Near(blocks.pointNAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointN.x, state.pointN.y, 0.77,
      ), 5e-16, `center link at N at ${time}`);
    vector3Near(blocks.centerLinkEndAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointQ.x, state.pointQ.y, 0.77,
      ), 8e-16, `center link at Q at ${time}`);
    vector3Near(blocks.rightLowerRadiusEndAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointQ.x, state.pointQ.y, 0.98,
      ), 1.1e-15, `lower radius at Q at ${time}`);
    vector3Near(blocks.leftPistonPointAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointP.x, state.pointP.y, -0.10,
      ), 0, `left piston at P at ${time}`);
    vector3Near(contacts.longLinkAtM.point,
      new THREE.Vector3(state.pointM.x, state.pointM.y,
        blocks.jointPins.M.position.z), 0,
    `live M contact at ${time}`);
    vector3Near(contacts.longLinkAtW.point,
      new THREE.Vector3(state.pointW.x, state.pointW.y,
        blocks.jointPins.W.position.z), 0,
    `live W contact at ${time}`);
    vector3Near(contacts.centerLinkAtQ.point,
      new THREE.Vector3(state.pointQ.x, state.pointQ.y,
        blocks.jointPins.Q.position.z), 0,
    `live Q contact at ${time}`);
    assert.ok(blocks.fixedFrame.matrixWorld.equals(fixedFrameMatrix));
  }

  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 5.5);
  assert.ok(size.y > 2.6, 'no explanatory piston rods extend below the plate');
  assert.ok(size.z > 1.2,
    'five rigid bars, the P rod and both fixed bearings occupy real layers');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);
  assert.equal(Object.keys(blocks.jointPins).length, 5);

  const model332 = createMovementModel(catalog.movements[331]);
  assert.equal(model332.root.userData.fidelity, 'authored');
  assert.notEqual(model332.root.userData.archetype,
    model.root.userData.archetype);
  disposeModel(model332.root);
  disposeModel(model.root);
});

test('movement 333 closes exactly and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[332]);
  const {
    blocks,
    canonicalTimes,
    stateAtTime,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);

  near(closure.phase, start.phase, 0, 'source phase closure');
  near(closure.inputAngle, start.inputAngle, 0, 'source input closure');
  vector2Near(closure.forcedPointP, start.forcedPointP, 0,
    'official forced-P closure');
  vector2Near(closure.pointP, start.pointP, 0, 'P closure');
  vector2Near(closure.pointM, start.pointM, 0, 'M closure');
  vector2Near(closure.pointW, start.pointW, 0, 'W closure');
  vector2Near(closure.pointN, start.pointN, 0, 'N closure');
  vector2Near(closure.pointQ, start.pointQ, 0, 'Q closure');
  near(closure.longLink.angle, start.longLink.angle, 0,
    'long-link closure');
  near(closure.centerLink.angle, start.centerLink.angle, 0,
    'center-link closure');
  near(closure.unwrappedInputAngle, Math.PI * 2, 0,
    'one unwrapped source timing turn');
  model.update(canonicalTimes.cycleClosure);
  near(blocks.longLink.rotation.z, start.longLink.angle, 0,
    'rendered long-link closure');
  vector3Near(blocks.leftPiston.position,
    new THREE.Vector3(start.pointP.x, start.pointP.y, 0), 0,
  'rendered left-piston closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});

function p89Box(model, role) {
  const found = [];
  model.root.traverse((object) => { if (object.isMesh && object.userData.role === role) found.push(object); });
  assert.ok(found.length > 0, role);
  return found.map((mesh) => new THREE.Box3().setFromObject(mesh));
}

test('333 pin P ends 0.01 inside the rod eye, not flush in its back face', () => {
  const model = createMovementModel(catalog.movements[332]);
  model.update(0); model.root.updateMatrixWorld(true);
  const [rod] = p89Box(model, 'left-P-rod-running-on-straight-past-the-plate');
  const [pin] = p89Box(model, 'common-working-pin-P');
  assert.ok(Math.abs(pin.min.z - (rod.min.z + 0.01)) < 1e-6, `${pin.min.z} ${rod.min.z}`);
});

test('333 P runs behind pedestal O: pin P comes down past O, so it must stay clear of O in depth', () => {
  const model = createMovementModel(catalog.movements[332]);
  model.update(0); model.root.updateMatrixWorld(true);
  const [pin] = p89Box(model, 'common-working-pin-P');
  for (const role of ['left-pivot-O-fixed-bearing-pin', 'left-pivot-O-fixed-bearing-bracket', 'left-pivot-O-frame-block-under-lug']) {
    const [box] = p89Box(model, role);
    assert.ok(pin.max.z < box.min.z, `pin P stays behind ${role}`);
  }
});

