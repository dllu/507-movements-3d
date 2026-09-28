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

function worldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
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

test('movement 341 is the corrected grasshopper beam-engine linkage', () => {
  const movement = catalog.movements[340];
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

  assert.equal(movement.id, 341);
  assert.equal(movement.number, '341');
  assert.equal(movement.title, '“Grasshopper” beam engine');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'grasshopper-engine-crank-six-bar-corrected-mid-beam-radius-motion');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /crank-P-connecting-rod-P-I/);
  assert.match(mechanism, /rocking-pillar-R-W/);
  assert.match(mechanism, /corrected-radius-E-M/);
  assert.match(transmission.exactRigidConstraints,
    /\|P-I\|=12\.000637/);
  assert.match(transmission.exactRigidConstraints, /\|E-M\|=8/);
  assert.match(transmission.output, /almost perfectly vertical six-unit/);
  assert.equal(degreesOfFreedom.mechanism, 1);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.inputCrank.parent, model.root);
  assert.equal(blocks.connectingRod.parent, model.root);
  assert.equal(blocks.beam.parent, model.root);
  assert.equal(blocks.pillar.parent, model.root);
  assert.equal(blocks.radiusBar.parent, model.root);
  assert.equal(blocks.pistonOutput.parent, model.root);
  assert.equal(blocks.beamBody.parent, blocks.beam);
  assert.equal(blocks.crankPinAnchor.parent, blocks.inputCrank);
  assert.equal(blocks.connectingRodStartAnchor.parent, blocks.connectingRod);
  assert.equal(blocks.pillarStartAnchor.parent, blocks.pillar);
  assert.equal(blocks.radiusBarStartAnchor.parent, blocks.radiusBar);
  assert.equal(blocks.pistonAnchor.parent, blocks.pistonOutput);
  assert.equal(contacts.crankAtP.members[0], blocks.inputCrank);
  assert.equal(contacts.crankAtP.members[1], blocks.connectingRod);
  assert.deepEqual(contacts.beamAtI.members,
    [blocks.beam, blocks.connectingRod]);
  assert.deepEqual(contacts.beamAtM.members,
    [blocks.beam, blocks.radiusBar]);
  assert.deepEqual(contacts.beamAtW.members,
    [blocks.beam, blocks.pillar]);
  assert.deepEqual(contacts.beamAtL.members,
    [blocks.beam, blocks.pistonOutput]);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'two-point-zero-six-two-four-four-two-unit-crank').length, 1);
  assert.equal(roles.filter((role) => role ===
    'twelve-point-zero-zero-zero-six-three-seven-unit-connecting-rod-P-I')
    .length, 1);
  assert.equal(roles.filter((role) => role ===
    'sixteen-unit-grasshopper-beam-L-I-M-W').length, 1);
  assert.equal(roles.filter((role) => role ===
    'rocking-pillar-A-from-fixed-R-to-beam-W').length, 1);
  assert.equal(roles.filter((role) => role ===
    'eight-unit-corrected-radius-bar-B-from-E-to-beam-center-M').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 341 preserves the official source construction, correction, and view', () => {
  const movement = catalog.movements[340];
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
    'add_c_rod_r',
    'add_rot_to',
    'add_rot_to',
    'add_tx',
    'add_text',
  ]);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_341.html');
  assert.match(sourceAnimation.correctionNote,
    /moves Brown’s ineffective radius-bar joint/);
  assert.match(sourceAnimation.referenceScope, /corrected center radius joint/);
  assert.match(sourceAnimation.reconstructionDifference, /less than 0\.000442/);

  assert.deepEqual(official.crankCenter, new THREE.Vector2(0, 0));
  assert.equal(official.crankRadius, 2.062442);
  assert.equal(official.crankPhaseOffsetTurns, 0.625);
  assert.equal(official.connectingRodLength, 12.000637);
  assert.deepEqual(official.canvasRockerCenter,
    new THREE.Vector2(-23.967497, 12));
  assert.deepEqual(official.canvasRockerReferenceI,
    new THREE.Vector2(0, 12));
  near(official.canvasRockerRadius, 23.967497, 0,
    'official hidden canvas-rocker radius');
  assert.deepEqual(official.pillarPivotR,
    new THREE.Vector2(10.806247, 0));
  assert.deepEqual(official.pillarReferenceW,
    new THREE.Vector2(11, 12));
  near(official.pillarLength, 12.001564074111716, 0,
    'official rocking-pillar length');
  assert.deepEqual(official.radiusPivotE, new THREE.Vector2(-5, 12));
  assert.equal(official.radiusBarLength, 8);
  assert.equal(official.beamLength, 16);
  assert.equal(official.beamStationL, -5);
  assert.equal(official.beamStationI, 0);
  assert.equal(official.beamStationM, 3);
  assert.equal(official.beamStationW, 11);
  assert.equal(official.nominalPistonLineX, -5);
  assert.equal(official.pistonRodLength, 9.5);

  near(geometry.crankRadius,
    official.crankRadius * geometry.sourceScale, 0, 'scaled crank');
  near(geometry.connectingRodLength,
    official.connectingRodLength * geometry.sourceScale, 0,
  'scaled connecting rod');
  near(geometry.canvasRockerRadius,
    official.canvasRockerRadius * geometry.sourceScale, 0,
  'scaled canvas rocker');
  near(geometry.pillarLength,
    official.pillarLength * geometry.sourceScale, 0,
  'scaled rocking pillar');
  near(geometry.radiusBarLength, 8 * geometry.sourceScale, 0,
    'scaled corrected radius bar');
  near(geometry.beamLength, 16 * geometry.sourceScale, 0,
    'scaled grasshopper beam');

  assert.equal(sourceReference.brownPlate341.imageWidth, 525);
  assert.equal(sourceReference.brownPlate341.imageHeight, 525);
  assert.match(sourceReference.brownPlate341.inferredTopology,
    /rocking pillar A/);
  assert.match(sourceReference.officialNote,
    /moves its right joint to the center of the beam/);
  assert.deepEqual(sourceReference.officialAnimationView, {
    canvasHeight: 525,
    canvasWidth: 525,
    minimum: new THREE.Vector2(-7.955301, -3.78029),
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
    new THREE.Vector2(-7.955301, -3.78029)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(0, 525), 0, 'official lower-left view corner');
  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(13.044699, 17.21971)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(525, 0), 1.2e-13,
  'official upper-right view corner');
  disposeModel(model.root);
});

test('movement 341 retains the exact official sequential canvas phase law', () => {
  const model = createMovementModel(catalog.movements[340]);
  const {
    canonicalStates,
    geometry,
    sourceAnimation,
    sourceStateAtTime,
  } = model.root.userData;
  const official = sourceAnimation.officialGeometry;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const source = sourceStateAtTime(geometry.cyclePeriod * sample / 8192);
    const direction = source.pointW.clone().sub(source.pointI).normalize();
    near(source.pointP.distanceTo(geometry.crankCenter),
      geometry.crankRadius, 4e-16, `source crank radius at ${sample}`);
    near(source.pointI.distanceTo(source.pointP),
      geometry.connectingRodLength, 3e-15,
    `source P-I rod at ${sample}`);
    near(source.pointI.distanceTo(geometry.canvasRockerCenter),
      geometry.canvasRockerRadius, 5e-15,
    `source hidden canvas rocker at ${sample}`);
    near(source.pointW.distanceTo(source.pointI), geometry.beamStationW,
      2e-15, `source I-W station at ${sample}`);
    near(source.pointW.distanceTo(geometry.pillarPivotR),
      geometry.pillarLength, 3e-15,
    `source pillar R-W at ${sample}`);
    vector2Near(source.pointL,
      source.pointI.clone().addScaledVector(direction,
        official.beamStationL * geometry.sourceScale),
    2e-15, `source beam station L at ${sample}`);
    vector2Near(source.pointM,
      source.pointI.clone().addScaledVector(direction,
        official.beamStationM * geometry.sourceScale),
    2e-15, `source beam station M at ${sample}`);
    near(source.drawnRadiusEndpoint.distanceTo(geometry.radiusPivotE),
      geometry.radiusBarLength, 9e-16,
    `source drawn radius length at ${sample}`);
  }

  const center = geometry.crankCenter;
  const radial = geometry.crankRadius * Math.SQRT1_2;
  vector2Near(canonicalStates.sourceStart.pointP,
    center.clone().add(new THREE.Vector2(-radial, -radial)), 3e-16,
  'source-start crank pin');
  vector2Near(canonicalStates.sourceQuarter.pointP,
    center.clone().add(new THREE.Vector2(radial, -radial)), 3e-16,
  'source-quarter crank pin');
  vector2Near(canonicalStates.sourceHalf.pointP,
    center.clone().add(new THREE.Vector2(radial, radial)), 5e-16,
  'source-half crank pin');
  vector2Near(canonicalStates.sourceThreeQuarter.pointP,
    center.clone().add(new THREE.Vector2(-radial, radial)), 8e-16,
  'source-three-quarter crank pin');
  disposeModel(model.root);
});

test('movement 341 closes all three visible loops on one rigid beam', () => {
  const model = createMovementModel(catalog.movements[340]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 16384);
    const direction = state.pointW.clone().sub(state.pointI).normalize();
    near(state.pointP.distanceTo(geometry.crankCenter),
      geometry.crankRadius, 4e-16, `rigid crank O-P at ${sample}`);
    near(state.pointI.distanceTo(state.pointP),
      geometry.connectingRodLength, 3.5e-14,
    `rigid connecting rod P-I at ${sample}`);
    near(state.pointW.distanceTo(geometry.pillarPivotR),
      geometry.pillarLength, 3.5e-14,
    `rigid rocking pillar R-W at ${sample}`);
    near(state.pointM.distanceTo(geometry.radiusPivotE),
      geometry.radiusBarLength, 3.5e-14,
    `rigid corrected radius E-M at ${sample}`);
    vector2Near(state.pointL,
      state.pointI.clone().addScaledVector(direction, geometry.beamStationL),
    2e-15, `rigid station L at ${sample}`);
    vector2Near(state.pointM,
      state.pointI.clone().addScaledVector(direction, geometry.beamStationM),
    2e-15, `rigid station M at ${sample}`);
    vector2Near(state.pointW,
      state.pointI.clone().addScaledVector(direction, geometry.beamStationW),
    2e-15, `rigid station W at ${sample}`);
    near(state.pointL.distanceTo(state.pointW), geometry.beamLength,
      3e-15, `complete rigid beam L-W at ${sample}`);
    assert.ok(state.maximumLengthResidual <= 3.5e-14);
    assert.ok(state.solverIterations <= 2);
  }
  assert.ok(geometry.maximumLengthResidual <= 3.5e-14);
  assert.equal(geometry.maximumSolverIterations, 2);
  disposeModel(model.root);
});

test('movement 341 removes the tiny canvas radius overrun and reproduces its six-unit stroke', () => {
  const model = createMovementModel(catalog.movements[340]);
  const { geometry, stateAtTime, transmission } = model.root.userData;
  let maximumCanvasLateralDeviation = 0;
  let maximumCanvasOvershoot = 0;
  let maximumDifference = 0;
  let maximumPistonX = -Infinity;
  let maximumPistonY = -Infinity;
  let minimumPistonX = Infinity;
  let minimumPistonY = Infinity;

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 16384);
    maximumCanvasLateralDeviation = Math.max(
      maximumCanvasLateralDeviation,
      Math.abs(state.canvasApproximation.pointL.x
        - geometry.nominalPistonLineX),
    );
    maximumCanvasOvershoot = Math.max(maximumCanvasOvershoot,
      state.canvasApproximation.radiusEndpointOvershoot);
    maximumDifference = Math.max(maximumDifference,
      ...Object.values(state.physicalDifferenceFromCanvas));
    maximumPistonX = Math.max(maximumPistonX, state.pointL.x);
    maximumPistonY = Math.max(maximumPistonY, state.pointL.y);
    minimumPistonX = Math.min(minimumPistonX, state.pointL.x);
    minimumPistonY = Math.min(minimumPistonY, state.pointL.y);
  }

  const scale = geometry.sourceScale;
  assert.match(transmission.canvasRounding, /overrun that joint/);
  assert.ok(maximumCanvasOvershoot / scale > 0.0004253);
  assert.ok(maximumCanvasOvershoot / scale < 0.0004256);
  near(maximumCanvasOvershoot,
    geometry.maximumCanvasRadiusEndpointOvershoot, 0,
  'stored maximum canvas radius overrun');
  assert.ok(maximumDifference / scale > 0.0004414);
  assert.ok(maximumDifference / scale < 0.0004417);
  near(maximumDifference, geometry.maximumPhysicalDifferenceFromCanvas, 0,
    'stored maximum simultaneous-solve correction');
  assert.ok(maximumCanvasLateralDeviation / scale > 0.0004078);
  assert.ok(maximumCanvasLateralDeviation / scale < 0.0004081);
  assert.ok(geometry.maximumLateralDeviation / scale > 0.0002587);
  assert.ok(geometry.maximumLateralDeviation / scale < 0.0002589);
  assert.ok(geometry.maximumLateralDeviation
    < maximumCanvasLateralDeviation);
  near(minimumPistonX, geometry.minimumPistonX, 0,
    'stored minimum piston x');
  near(maximumPistonX, geometry.maximumPistonX, 0,
    'stored maximum piston x');
  near(minimumPistonY, geometry.minimumPistonY, 0,
    'stored minimum piston y');
  near(maximumPistonY, geometry.maximumPistonY, 0,
    'stored maximum piston y');
  assert.ok((maximumPistonX - minimumPistonX) / scale < 0.000518);
  assert.ok(geometry.outputStroke / scale > 5.99999);
  assert.ok(geometry.outputStroke / scale < 6.00001);
  disposeModel(model.root);
});

test('movement 341 analytic rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[340]);
  const { stateAtTime } = model.root.userData;
  const h = 2e-4;
  const samples = [0.13, 0.61, 1.0, 1.53, 2.18, 2.70, 3.53];

  for (const time of samples) {
    const previous = stateAtTime(time - h);
    const state = stateAtTime(time);
    const next = stateAtTime(time + h);
    for (const pointName of ['P', 'I', 'L', 'M', 'W']) {
      const finiteVelocity = next[`point${pointName}`].clone()
        .sub(previous[`point${pointName}`]).multiplyScalar(1 / (2 * h));
      const finiteAcceleration = next[`point${pointName}`].clone()
        .add(previous[`point${pointName}`])
        .addScaledVector(state[`point${pointName}`], -2)
        .multiplyScalar(1 / h ** 2);
      vector2Near(state[`point${pointName}Velocity`], finiteVelocity, 5e-8,
        `${pointName} velocity at ${time}`);
      vector2Near(state[`point${pointName}Acceleration`],
        finiteAcceleration, 2e-7,
      `${pointName} acceleration at ${time}`);
    }
    for (const linkName of [
      'connectingRod',
      'beam',
      'pillar',
      'radiusBar',
    ]) {
      const finiteAngularVelocity = angleDifference(
        next[linkName].angle,
        previous[linkName].angle,
      ) / (2 * h);
      const finiteAngularAcceleration = (
        next[linkName].angularVelocity
          - previous[linkName].angularVelocity
      ) / (2 * h);
      near(state[linkName].angularVelocity, finiteAngularVelocity, 1e-8,
        `${linkName} angular velocity at ${time}`);
      near(state[linkName].angularAcceleration,
        finiteAngularAcceleration, 3e-8,
      `${linkName} angular acceleration at ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 341 renderer binds P, I, L, M, W, E, and R in distinct layers', () => {
  const model = createMovementModel(catalog.movements[340]);
  const {
    blocks,
    canonicalTimes,
    contacts,
    geometry,
    stateAtTime,
  } = model.root.userData;

  for (const time of Object.values(canonicalTimes)) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    vector3Near(worldPosition(blocks.crankPinAnchor),
      new THREE.Vector3(state.pointP.x, state.pointP.y, 0.12), 8e-16,
    `rendered crank pin P at ${time}`);
    vector3Near(worldPosition(blocks.connectingRodStartAnchor),
      new THREE.Vector3(state.pointP.x, state.pointP.y, 0.30), 1e-15,
    `rendered connecting-rod start P at ${time}`);
    vector3Near(worldPosition(blocks.connectingRodEndAnchor),
      new THREE.Vector3(state.pointI.x, state.pointI.y, 0.30), 3e-15,
    `rendered connecting-rod end I at ${time}`);
    for (const [name, point] of [
      ['I', state.pointI],
      ['L', state.pointL],
      ['M', state.pointM],
      ['W', state.pointW],
    ]) {
      vector3Near(worldPosition(blocks.beamAnchors[name]),
        new THREE.Vector3(point.x, point.y, 0), 3e-15,
      `rendered beam station ${name} at ${time}`);
    }
    vector3Near(worldPosition(blocks.pillarStartAnchor),
      new THREE.Vector3(geometry.pillarPivotR.x,
        geometry.pillarPivotR.y, 0.30), 1e-15,
    `rendered pillar pivot R at ${time}`);
    vector3Near(worldPosition(blocks.pillarEndAnchor),
      new THREE.Vector3(state.pointW.x, state.pointW.y, 0.30), 3e-15,
    `rendered pillar joint W at ${time}`);
    vector3Near(worldPosition(blocks.radiusBarStartAnchor),
      new THREE.Vector3(geometry.radiusPivotE.x,
        geometry.radiusPivotE.y, -0.30), 1e-15,
    `rendered radius pivot E at ${time}`);
    vector3Near(worldPosition(blocks.radiusBarEndAnchor),
      new THREE.Vector3(state.pointM.x, state.pointM.y, -0.30), 3e-15,
    `rendered radius joint M at ${time}`);
    vector3Near(worldPosition(blocks.pistonAnchor),
      new THREE.Vector3(state.pointL.x, state.pointL.y, 0.30), 2e-15,
    `rendered piston pin L at ${time}`);
    vector3Near(contacts.crankAtP.point,
      new THREE.Vector3(state.pointP.x, state.pointP.y, blocks.jointPins.P.position.z), 0,
    `contact P at ${time}`);
    vector3Near(contacts.beamAtI.point,
      new THREE.Vector3(state.pointI.x, state.pointI.y, blocks.jointPins.I.position.z), 0,
    `contact I at ${time}`);
    vector3Near(contacts.beamAtL.point,
      new THREE.Vector3(state.pointL.x, state.pointL.y, blocks.jointPins.L.position.z), 0,
    `contact L at ${time}`);
    vector3Near(contacts.beamAtM.point,
      new THREE.Vector3(state.pointM.x, state.pointM.y, blocks.jointPins.M.position.z), 0,
    `contact M at ${time}`);
    vector3Near(contacts.beamAtW.point,
      new THREE.Vector3(state.pointW.x, state.pointW.y, blocks.jointPins.W.position.z), 0,
    `contact W at ${time}`);
  }

  near(blocks.connectingRod.userData.nominalLength,
    geometry.connectingRodLength, 0, 'rendered connecting-rod length');
  near(blocks.pillar.userData.nominalLength,
    geometry.pillarLength, 0, 'rendered rocking-pillar length');
  near(blocks.radiusBar.userData.nominalLength,
    geometry.radiusBarLength, 0, 'rendered corrected radius-bar length');
  for (const name of ['I', 'L', 'M', 'W']) assert.equal(blocks.jointPins[name].parent, blocks.beam);
  assert.equal(blocks.jointPins.P.parent, blocks.inputCrank);
  const drawnRoles = [];
  model.root.traverse((object) => drawnRoles.push(object.userData.role ?? ''));
  assert.equal(drawnRoles.some((role) => /engine-bed|guide-rail|cylinder-side|piston-head/.test(role)), false,
    'Brown draws a closed cylinder on separate feet, with no bed, frame sides or guides');
  const radiusBarBox = new THREE.Box3().setFromObject(blocks.radiusBar);
  const beamBox = new THREE.Box3().setFromObject(blocks.beamBody);
  assert.ok(radiusBarBox.max.z < beamBox.min.z, 'radius bar B runs behind the beam as dashed in the plate');
  assert.equal(Object.keys(blocks.beamAnchors).length, 4);
  assert.equal(Object.keys(blocks.jointPins).length, 5);
  assert.notEqual(blocks.connectingRod, blocks.pillar);
  assert.notEqual(blocks.pillar, blocks.radiusBar);
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 6.4, 'cylinder at the left to pillar pedestal R at the right');
  assert.ok(size.y > 5.8);
  assert.ok(size.z > 1.6,
    'wall, bracket, radius bar, beam, rods, cylinder and pins occupy real depth');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);
  disposeModel(model.root);
});

test('movement 341 closes exactly and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[340]);
  const { blocks, canonicalTimes, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);

  near(closure.phase, start.phase, 0, 'source phase closure');
  near(angleDifference(closure.inputAngle, start.inputAngle), 0, 9e-16,
    'crank angle closure');
  near(closure.unwrappedInputAngle - start.unwrappedInputAngle,
    Math.PI * 2, 1e-15, 'one unwrapped source revolution');
  vector2Near(closure.pointP, start.pointP, 7e-16, 'P closure');
  vector2Near(closure.pointI, start.pointI, 5e-16, 'I closure');
  vector2Near(closure.pointL, start.pointL, 1e-15, 'L closure');
  vector2Near(closure.pointM, start.pointM, 5e-16, 'M closure');
  vector2Near(closure.pointW, start.pointW, 0, 'W closure');
  near(angleDifference(closure.connectingRod.angle,
    start.connectingRod.angle), 0, 3e-16, 'connecting-rod closure');
  near(angleDifference(closure.beam.angle, start.beam.angle), 0, 2e-16,
    'beam closure');
  near(angleDifference(closure.pillar.angle, start.pillar.angle), 0, 2e-16,
    'pillar closure');
  near(angleDifference(closure.radiusBar.angle, start.radiusBar.angle),
    0, 3e-16, 'radius-bar closure');
  model.update(canonicalTimes.cycleClosure);
  model.root.updateMatrixWorld(true);
  vector3Near(worldPosition(blocks.beamAnchors.L),
    new THREE.Vector3(start.pointL.x, start.pointL.y, 0), 1e-15,
  'rendered piston-pin closure');

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

test('341 crank pin P ends 0.01 inside the crank arm, not flush in its back face', () => {
  const model = createMovementModel(catalog.movements[340]);
  model.update(0); model.root.updateMatrixWorld(true);
  const [arm] = p89Box(model, 'crank-arm-to-P');
  const [pin] = p89Box(model, 'common-working-pin-P');
  assert.ok(Math.abs(pin.min.z - (arm.min.z + 0.01)) < 1e-6, `${pin.min.z} ${arm.min.z}`);
});
