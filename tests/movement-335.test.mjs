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

test('movement 335 is the stationary-beam-engine six-bar parallel motion', () => {
  const movement = catalog.movements[334];
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

  assert.equal(movement.id, 335);
  assert.equal(movement.number, '335');
  assert.equal(movement.title,
    'parallel motion commonly used for stationary beam engines');
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'stationary-beam-engine-six-bar-approximate-parallel-motion');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /ternary-beam-A-B-O/);
  assert.match(mechanism, /radius-F-Q/);
  assert.match(mechanism, /crossbar-E-Q/);
  assert.match(transmission.exactRigidConstraints, /\|O-A\|=12/);
  assert.match(transmission.exactRigidConstraints, /\|F-Q\|=10\.9/);
  assert.match(transmission.exactRigidConstraints, /\|E-Q\|=\|O-A\|-\|O-B\|/);
  assert.match(transmission.topology, /exact moving parallelogram/);
  assert.match(transmission.straightness, /lateral deviation is measured/);
  assert.equal(degreesOfFreedom.mechanism, 1);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.beam.parent, model.root);
  assert.equal(blocks.leftDropLink.parent, model.root);
  assert.equal(blocks.middleDropLink.parent, model.root);
  assert.equal(blocks.fixedRadiusBar.parent, model.root);
  assert.equal(blocks.crossbar.parent, model.root);
  assert.equal(blocks.piston.parent, model.root);
  assert.equal(blocks.beamLeftStationAnchor.parent, blocks.beam);
  assert.equal(blocks.beamMiddleStationAnchor.parent, blocks.beam);
  assert.deepEqual(contacts.leftDropAtA.members,
    [blocks.beam, blocks.leftDropLink]);
  assert.deepEqual(contacts.middleDropAtB.members,
    [blocks.beam, blocks.middleDropLink]);
  assert.deepEqual(contacts.crossbarAtE.members,
    [blocks.leftDropLink, blocks.crossbar, blocks.piston]);
  assert.deepEqual(contacts.fourMembersAtQ.members,
    [blocks.middleDropLink, blocks.fixedRadiusBar, blocks.crossbar]);
  assert.equal(contacts.radiusPivotF.movingMember, blocks.fixedRadiusBar);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'ternary-stationary-engine-beam-A-B-O').length, 1);
  assert.equal(roles.filter((role) => role ===
    'left-four-unit-link-A-E').length, 1);
  assert.equal(roles.filter((role) => role ===
    'middle-four-unit-link-B-Q').length, 1);
  assert.equal(roles.filter((role) => role ===
    'long-fixed-radius-rod-F-Q').length, 1);
  assert.equal(roles.filter((role) => role ===
    'parallel-bar-E-Q').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 335 preserves the official dimensions and uncertainty note', () => {
  const movement = catalog.movements[334];
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
    'https://507movements.com/mm_335.html');
  assert.match(sourceAnimation.officialNotes, /lacks enough detail for certainty/);
  assert.match(sourceAnimation.reconstructionDifference,
    /forces E onto x=-12/);
  assert.match(sourceAnimation.referenceScope, /follow the plate/);

  assert.deepEqual(official, {
    beamDriverRadius: 12.375,
    beamLeftStationRadius: 12,
    beamMiddleStationRadius: 6,
    beamPivotO: new THREE.Vector2(0, 0),
    crossbarLength: 6,
    dropLinkLength: 3.5,
    fixedRadiusLength: 6,
    fixedRadiusPivotF: new THREE.Vector2(-12, -3.5),
    hiddenCrankPivot: new THREE.Vector2(12.375, -12),
    hiddenCrankRadius: 2.083778,
    hiddenDriveRodLength: 12.179578,
    inputPhaseOffsetTurns: 0.125,
    strokeLine: [
      new THREE.Vector2(-12, -4.5),
      new THREE.Vector2(-12, -10.5),
    ],
  });
  near(geometry.beamDriverRadius, 12.375 * geometry.sourceScale, 0,
    'scaled hidden beam-driver station');
  near(geometry.beamLeftStationRadius, 12 * geometry.sourceScale, 0,
    'scaled O-A station');
  // Brown's plate proportions: a 10.9-unit radius rod running left to F and
  // 4-unit drops; B sits where O, the Watt point on B-Q and E stay collinear.
  const plateB = (-10.9 + Math.sqrt(10.9 ** 2 + 4 * 10.9 * 12)) / 2;
  near(plateB ** 2, 10.9 * (12 - plateB), 1e-12, 'collinear Watt station');
  near(geometry.beamMiddleStationRadius, plateB * geometry.sourceScale, 1e-15,
    'scaled O-B station');
  near(geometry.dropLinkLength, 4 * geometry.sourceScale, 0,
    'scaled hanging links');
  near(geometry.fixedRadiusLength, 10.9 * geometry.sourceScale, 0,
    'scaled F-Q radius');
  near(geometry.crossbarLength, (12 - plateB) * geometry.sourceScale, 1e-15,
    'scaled E-Q crossbar');
  vector2Near(geometry.fixedRadiusPivotF,
    new THREE.Vector2(-plateB - 10.9, -4).multiplyScalar(geometry.sourceScale),
  1e-15, 'scaled fixed pivot F');
  assert.match(sourceReference.brownPlate335.plateProportions, /radius rod 10\.9/);

  assert.equal(sourceReference.brownPlate335.imageWidth, 525);
  assert.equal(sourceReference.brownPlate335.imageHeight, 525);
  assert.equal(sourceReference.brownPlate335.interpretationCertain, false);
  assert.match(sourceReference.brownPlate335.inferredTopology,
    /two hanging links/);
  assert.deepEqual(sourceReference.officialAnimationView, {
    canvasHeight: 525,
    canvasWidth: 525,
    minimum: new THREE.Vector2(-14.951954, -10.75),
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
    new THREE.Vector2(-14.951954, -10.75)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(0, 525), 0, 'official lower-left view corner');
  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(3.048046, 7.25)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(525, 0), 1.2e-13,
  'official upper-right view corner');
  disposeModel(model.root);
});

test('movement 335 hidden crank drives one exact finite-rod rocking beam', () => {
  const model = createMovementModel(catalog.movements[334]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 8192);
    near(state.inputCrankPin.distanceTo(geometry.hiddenCrankPivot),
      geometry.hiddenCrankRadius, 8e-16,
    `hidden crank radius at ${sample}`);
    near(state.beamDriverPoint.distanceTo(state.inputCrankPin),
      geometry.hiddenDriveRodLength, 3e-15,
    `hidden drive-rod length at ${sample}`);
    near(state.beamDriverPoint.distanceTo(geometry.beamPivotO),
      geometry.beamDriverRadius, 2e-15,
    `beam driver radius at ${sample}`);
    near(state.beam.angle,
      Math.atan2(state.beamDriverPoint.y, state.beamDriverPoint.x), 0,
    `beam angle at ${sample}`);
    near(state.pointA.distanceTo(geometry.beamPivotO),
      geometry.beamLeftStationRadius, 4e-15,
    `beam O-A station at ${sample}`);
    near(state.pointB.distanceTo(geometry.beamPivotO),
      geometry.beamMiddleStationRadius, 2e-15,
    `beam O-B station at ${sample}`);
    vector2Near(state.pointB, state.pointA.clone().multiplyScalar(
      geometry.beamMiddleStationRadius / geometry.beamLeftStationRadius), 1e-15,
    `B is on O-A at ${sample}`);
    const beamUnit = state.beamDriverPoint.clone()
      .multiplyScalar(1 / geometry.beamDriverRadius);
    vector2Near(state.pointA,
      beamUnit.clone().multiplyScalar(-geometry.beamLeftStationRadius),
    1e-15, `A opposes hidden driver station at ${sample}`);
  }
  assert.ok(geometry.minimumBeamAngle < -0.1545);
  assert.ok(geometry.minimumBeamAngle > -0.1547);
  assert.ok(geometry.maximumBeamAngle > 0.1837);
  assert.ok(geometry.maximumBeamAngle < 0.1839);
  disposeModel(model.root);
});

test('movement 335 closes the lower parallelogram and fixed radius exactly', () => {
  const model = createMovementModel(catalog.movements[334]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 8192);
    near(state.pointA.distanceTo(state.pointE),
      geometry.dropLinkLength, 1.2e-15, `A-E at ${sample}`);
    near(state.pointB.distanceTo(state.pointQ),
      geometry.dropLinkLength, 1.2e-15, `B-Q at ${sample}`);
    near(state.pointQ.distanceTo(geometry.fixedRadiusPivotF),
      geometry.fixedRadiusLength, 1.4e-15, `F-Q at ${sample}`);
    near(state.pointE.distanceTo(state.pointQ),
      geometry.crossbarLength, 1.4e-15, `E-Q at ${sample}`);
    vector2Near(state.pointQ.clone().sub(state.pointE),
      state.pointB.clone().sub(state.pointA), 2e-15,
    `E-Q remains parallel and equal to A-B at ${sample}`);
    vector2Near(state.pointE.clone().sub(state.pointA),
      state.pointQ.clone().sub(state.pointB), 2e-15,
    `A-E remains parallel and equal to B-Q at ${sample}`);
    near(state.crossbar.angle, state.beam.angle, 1e-15,
      `crossbar follows beam angle at ${sample}`);
    near(state.leftDrop.angle, state.middleDrop.angle, 1.7e-15,
      `both hanging links remain parallel at ${sample}`);

    near(state.officialCanvasApproximation.pointE.x,
      geometry.strokeLineX, 0,
    `official forced vertical output at ${sample}`);
    near(state.officialCanvasApproximation.pointE.distanceTo(state.pointA),
      geometry.dropLinkLength, 9e-16,
    `official A-E length at ${sample}`);
    near(state.officialCanvasApproximation.crossbarResidual,
      state.officialCanvasApproximation.pointE.distanceTo(state.pointQ)
        - geometry.crossbarLength,
    0, `official E-Q residual at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 335 exposes its genuine near-straight piston locus', () => {
  const model = createMovementModel(catalog.movements[334]);
  const { geometry, stateAtTime } = model.root.userData;
  let maximumOfficialResidual = 0;
  let maximumLateralDeviation = 0;
  let maximumVerticalDifference = 0;
  let minimumY = Infinity;
  let maximumY = -Infinity;
  let minimumOfficialY = Infinity;
  let maximumOfficialY = -Infinity;

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 16384);
    maximumOfficialResidual = Math.max(maximumOfficialResidual,
      Math.abs(state.officialCanvasApproximation.crossbarResidual));
    maximumLateralDeviation = Math.max(maximumLateralDeviation,
      Math.abs(state.pistonLateralDeviation));
    maximumVerticalDifference = Math.max(maximumVerticalDifference,
      Math.abs(state.pistonVerticalDifferenceFromCanvas));
    minimumY = Math.min(minimumY, state.pointE.y);
    maximumY = Math.max(maximumY, state.pointE.y);
    minimumOfficialY = Math.min(minimumOfficialY,
      state.officialCanvasApproximation.pointE.y);
    maximumOfficialY = Math.max(maximumOfficialY,
      state.officialCanvasApproximation.pointE.y);
  }

  near(maximumOfficialResidual,
    geometry.maximumOfficialCrossbarResidual, 3e-9,
  'measured official E-Q residual');
  near(maximumLateralDeviation,
    geometry.maximumPistonLateralDeviation, 3e-9,
  'measured exact-link E lateral deviation');
  near(maximumVerticalDifference,
    geometry.maximumPistonVerticalDifference, 3e-9,
  'measured E vertical correction');
  near(minimumY, geometry.minimumPistonY, 3e-9,
    'minimum exact piston ordinate');
  near(maximumY, geometry.maximumPistonY, 3e-9,
    'maximum exact piston ordinate');
  near(maximumY - minimumY, geometry.outputStroke, 5e-9,
    'exact piston stroke');
  near(maximumOfficialY - minimumOfficialY,
    geometry.officialOutputStroke, 5e-9, 'official forced-line stroke');
  assert.ok(maximumOfficialResidual / geometry.sourceScale < 0.000980);
  assert.ok(maximumLateralDeviation / geometry.sourceScale < 0.001005);
  assert.ok(maximumVerticalDifference / geometry.sourceScale < 0.000052);
  assert.ok(maximumLateralDeviation > 0,
    'the historical path is approximate rather than fictitiously vertical');
  assert.ok(geometry.outputStroke / geometry.sourceScale > 4.0382);
  assert.ok(geometry.outputStroke / geometry.sourceScale < 4.0385);
  disposeModel(model.root);
});

test('movement 335 analytic linkage rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[334]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-5;
  const pointFields = [
    ['inputCrankPin', 'inputCrankPinVelocity', 'inputCrankPinAcceleration'],
    ['beamDriverPoint', 'beamDriverPointVelocity',
      'beamDriverPointAcceleration'],
    ['pointA', 'pointAVelocity', 'pointAAcceleration'],
    ['pointB', 'pointBVelocity', 'pointBAcceleration'],
    ['pointE', 'pointEVelocity', 'pointEAcceleration'],
    ['pointQ', 'pointQVelocity', 'pointQAcceleration'],
  ];

  for (const time of [0.13, 0.48, 0.92, 1.37, 1.88, 2.36, 2.83, 3.41, 3.78]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    for (const [pointKey, velocityKey, accelerationKey] of pointFields) {
      vector2Near(after[pointKey].clone().sub(before[pointKey])
        .multiplyScalar(1 / (2 * step)), state[velocityKey], 3.8e-9,
      `${pointKey} velocity at ${time}`);
      vector2Near(after[velocityKey].clone().sub(before[velocityKey])
        .multiplyScalar(1 / (2 * step)), state[accelerationKey], 8e-9,
      `${pointKey} acceleration at ${time}`);
    }
    for (const link of [
      'beam',
      'driveRod',
      'leftDrop',
      'middleDrop',
      'fixedRadius',
      'crossbar',
    ]) {
      near((after[link].angle - before[link].angle) / (2 * step),
        state[link].angularVelocity, 3.2e-9,
      `${link} angular velocity at ${time}`);
      near((after[link].angularVelocity - before[link].angularVelocity)
        / (2 * step), state[link].angularAcceleration, 8e-9,
      `${link} angular acceleration at ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 335 renderer binds every beam station and lower-link pin', () => {
  const model = createMovementModel(catalog.movements[334]);
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
    near(blocks.beam.rotation.z, state.beam.angle, 0,
      `rendered beam angle at ${time}`);
    near(blocks.leftDropLink.rotation.z, state.leftDrop.angle, 0,
      `rendered A-E angle at ${time}`);
    near(blocks.middleDropLink.rotation.z, state.middleDrop.angle, 0,
      `rendered B-Q angle at ${time}`);
    near(blocks.fixedRadiusBar.rotation.z, state.fixedRadius.angle, 0,
      `rendered F-Q angle at ${time}`);
    near(blocks.crossbar.rotation.z, state.crossbar.angle, 0,
      `rendered E-Q angle at ${time}`);
    vector3Near(blocks.beamLeftStationAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointA.x, state.pointA.y, 0.56,
      ), 2e-15, `beam station A at ${time}`);
    vector3Near(blocks.beamMiddleStationAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointB.x, state.pointB.y, 0.56,
      ), 1e-15, `beam station B at ${time}`);
    vector3Near(blocks.leftDropLinkStartAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointA.x, state.pointA.y, 0.34,
      ), 0, `left drop at A at ${time}`);
    vector3Near(blocks.leftDropLinkEndAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointE.x, state.pointE.y, 0.34,
      ), 7e-16, `left drop at E at ${time}`);
    vector3Near(blocks.middleDropLinkStartAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointB.x, state.pointB.y, 0.34,
      ), 0, `middle drop at B at ${time}`);
    vector3Near(blocks.middleDropLinkEndAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointQ.x, state.pointQ.y, 0.34,
      ), 6e-16, `middle drop at Q at ${time}`);
    vector3Near(blocks.fixedRadiusEndAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointQ.x, state.pointQ.y, -0.12,
      ), 1e-15, `fixed radius at Q at ${time}`);
    vector3Near(blocks.crossbarStartAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointE.x, state.pointE.y, 0.04,
      ), 0, `crossbar at E at ${time}`);
    vector3Near(blocks.crossbarEndAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointQ.x, state.pointQ.y, 0.04,
      ), 8e-16, `crossbar at Q at ${time}`);
    vector3Near(blocks.pistonPointAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
        state.pointE.x, state.pointE.y, 0.18,
      ), 0, `piston point E at ${time}`);
    vector3Near(contacts.leftDropAtA.point,
      new THREE.Vector3(state.pointA.x, state.pointA.y, blocks.jointPins.A.position.z), 0,
    `live A contact at ${time}`);
    vector3Near(contacts.middleDropAtB.point,
      new THREE.Vector3(state.pointB.x, state.pointB.y, blocks.jointPins.B.position.z), 0,
    `live B contact at ${time}`);
    vector3Near(contacts.crossbarAtE.point,
      new THREE.Vector3(state.pointE.x, state.pointE.y, blocks.jointPins.E.getWorldPosition(new THREE.Vector3()).z), 0,
    `live E contact at ${time}`);
    vector3Near(contacts.fourMembersAtQ.point,
      new THREE.Vector3(state.pointQ.x, state.pointQ.y, blocks.jointPins.Q.getWorldPosition(new THREE.Vector3()).z), 0,
    `live Q contact at ${time}`);
    assert.ok(blocks.fixedFrame.matrixWorld.equals(fixedFrameMatrix));
  }

  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 7.5, 'long radius rod from F past fulcrum O; Brown draws no guide rails');
  assert.ok(size.y > 4.6, 'level plate-pose beam over the piston rod');
  assert.ok(size.z > 1.0,
    'radius bar, crossbar, piston rod, drop links, beam and stubs occupy separate layers');
  const drawnRoles = [];
  model.root.traverse((object) => drawnRoles.push(object.userData.role ?? ''));
  assert.equal(drawnRoles.some((role) => /guide|pedestal|crosshead|index|bearing/.test(role)), false,
    'Brown draws only the beam, sectioned shaft O, links, bars, pins and plain piston rod');
  for (const name of ['A', 'B']) assert.equal(blocks.jointPins[name].parent, blocks.beam);
  assert.equal(blocks.jointPins.E.parent, blocks.leftDropLink);
  assert.equal(blocks.jointPins.Q.parent, blocks.middleDropLink);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const model334 = createMovementModel(catalog.movements[333]);
  assert.equal(model334.root.userData.fidelity, 'authored');
  assert.notEqual(model334.root.userData.archetype,
    model.root.userData.archetype);
  disposeModel(model334.root);
  disposeModel(model.root);
});

test('movement 335 closes exactly and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[334]);
  const {
    blocks,
    canonicalTimes,
    stateAtTime,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);

  near(closure.phase, start.phase, 0, 'source phase closure');
  near(closure.inputAngle, start.inputAngle, 0, 'hidden crank closure');
  vector2Near(closure.inputCrankPin, start.inputCrankPin, 0,
    'hidden crank-pin closure');
  vector2Near(closure.beamDriverPoint, start.beamDriverPoint, 0,
    'beam driver-point closure');
  near(closure.beam.angle, start.beam.angle, 0, 'beam closure');
  vector2Near(closure.pointA, start.pointA, 0, 'A closure');
  vector2Near(closure.pointB, start.pointB, 0, 'B closure');
  vector2Near(closure.pointE, start.pointE, 0, 'E closure');
  vector2Near(closure.pointQ, start.pointQ, 0, 'Q closure');
  near(closure.unwrappedInputAngle - start.unwrappedInputAngle, Math.PI * 2,
    1e-15, 'one unwrapped source timing turn');
  // Model time 0 is Brown's level-beam pose.
  near(start.beam.angle, 0, 1e-15, 'plate pose has a level beam');
  model.update(canonicalTimes.cycleClosure);
  near(blocks.beam.rotation.z, start.beam.angle, 0,
    'rendered beam closure');
  vector3Near(blocks.piston.position,
    new THREE.Vector3(start.pointE.x, start.pointE.y, 0), 0,
  'rendered piston closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});

test('movement 335 p96: shaft O ends in a round flange concentric with it', () => {
  const model = createMovementModel(catalog.movements[334]);
  model.update(0);
  model.root.updateMatrixWorld(true);
  let flange = null;
  let shank = null;
  model.root.traverse((object) => {
    if (object.userData.role === 'fixed-wall-bracket-of-beam-shaft-O-flange') flange = object;
    if (object.userData.role === 'fixed-wall-bracket-of-beam-shaft-O-shank') shank = object;
  });
  assert.equal(flange.geometry.type, 'CylinderGeometry');
  assert.ok(flange.geometry.parameters.radiusTop > 1.3 * shank.geometry.parameters.radiusTop);
});
