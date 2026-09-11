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

test('movement 340 is the closed joggling-pillar four-bar parallel motion', () => {
  const movement = catalog.movements[339];
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

  assert.equal(movement.id, 340);
  assert.equal(movement.number, '340');
  assert.equal(movement.title,
    'Another parallel motion. Beam, D, C, with joggling pillar-support, B, F…');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'joggling-pillar-four-bar-coupler-point-parallel-motion');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /joggling-pillar-F-B/);
  assert.match(mechanism, /rigid-beam-D-B-A-C/);
  assert.match(mechanism, /corrected-radius-E-A/);
  assert.match(transmission.exactRigidConstraints, /\|D-B\|=\|B-C\|=8/);
  assert.match(transmission.canvasDefect, /endpoint gap/);
  assert.equal(degreesOfFreedom.mechanism, 1);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.pillar.parent, model.root);
  assert.equal(blocks.beam.parent, model.root);
  assert.equal(blocks.radiusBar.parent, model.root);
  assert.equal(blocks.inputRod.parent, model.root);
  assert.equal(blocks.pistonRod.parent, model.root);
  assert.equal(blocks.beamBody.parent, blocks.beam);
  assert.equal(blocks.pillarStartAnchor.parent, blocks.pillar);
  assert.equal(blocks.radiusBarEndAnchor.parent, blocks.radiusBar);
  assert.equal(blocks.pistonRodAnchor.parent, blocks.pistonRod);
  assert.equal(contacts.pillarPivotF.movingMember, blocks.pillar);
  assert.equal(contacts.radiusPivotE.movingMember, blocks.radiusBar);
  assert.deepEqual(contacts.beamAtB.members,
    [blocks.beam, blocks.pillar]);
  assert.deepEqual(contacts.beamAtA.members,
    [blocks.beam, blocks.radiusBar]);
  assert.deepEqual(contacts.beamAtC.members,
    [blocks.beam, blocks.pistonRod]);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'joggling-pillar-F-B-vibrating-about-fixed-center-F').length, 1);
  assert.equal(roles.filter((role) => role ===
    'sixteen-unit-beam-D-B-A-C').length, 1);
  assert.equal(roles.filter((role) => role ===
    'corrected-four-point-seven-eight-nine-nine-five-six-unit-radius-bar-E-A')
    .length, 1);
  assert.equal(roles.filter((role) => role ===
    'piston-rod-connected-at-beam-end-C').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 340 preserves the official source construction and view', () => {
  const movement = catalog.movements[339];
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
    'https://507movements.com/mm_340.html');
  assert.match(sourceAnimation.referenceScope, /drawn radius length/);
  assert.match(sourceAnimation.reconstructionDifference,
    /official drawn radius endpoint misses/);

  assert.deepEqual(official.hiddenCrankPivot,
    new THREE.Vector2(-7.799671, -6));
  assert.deepEqual(official.hiddenCrankPinLocal,
    new THREE.Vector2(2.499197, 0));
  assert.equal(official.hiddenCrankRadius, 2.499197);
  assert.equal(official.hiddenCrankPhaseOffsetTurns, 0.25);
  assert.equal(official.hiddenConnectingRodLength, 16.005141);
  assert.deepEqual(official.hiddenRockerCenter,
    new THREE.Vector2(-3.899836, 10));
  assert.deepEqual(official.hiddenRockerReferenceD,
    new THREE.Vector2(-8.200329, 10));
  near(official.hiddenRockerRadius, 4.300493, 1e-15,
    'official hidden-rocker radius');
  assert.deepEqual(official.pillarPivotF, new THREE.Vector2(0, 0));
  assert.deepEqual(official.pillarReferenceB,
    new THREE.Vector2(0.200329, 10));
  assert.deepEqual(official.pillarNegativeTangentB,
    new THREE.Vector2(-0.200329, 10));
  near(official.pillarLength, 10.002006384133185, 0,
    'official pillar F-B radius');
  assert.equal(official.beamDBLength, 8);
  assert.equal(official.beamDALength, 12.25);
  assert.equal(official.beamDCLength, 16);
  assert.equal(official.beamBALength, 4.25);
  assert.equal(official.beamBCLength, 8);
  assert.deepEqual(official.radiusPivotE,
    new THREE.Vector2(8.839627, 10));
  assert.equal(official.canvasRadiusBarLength, 4.742772);
  assert.equal(official.nominalPistonLineX, 7.799671);
  assert.equal(official.pistonRodLength, 16.005141);

  near(geometry.hiddenCrankRadius,
    official.hiddenCrankRadius * geometry.sourceScale, 0,
  'scaled hidden crank');
  near(geometry.hiddenConnectingRodLength,
    official.hiddenConnectingRodLength * geometry.sourceScale, 0,
  'scaled hidden connecting rod');
  near(geometry.hiddenRockerRadius,
    official.hiddenRockerRadius * geometry.sourceScale, 0,
  'scaled hidden rocker');
  near(geometry.pillarLength,
    official.pillarLength * geometry.sourceScale, 0,
  'scaled pillar F-B');
  near(geometry.beamDCLength, 16 * geometry.sourceScale, 0,
    'scaled beam D-C');
  near(geometry.canvasRadiusBarLength,
    4.742772 * geometry.sourceScale, 0,
  'scaled canvas E-A bar');

  assert.equal(sourceReference.brownPlate340.imageWidth, 525);
  assert.equal(sourceReference.brownPlate340.imageHeight, 525);
  assert.match(sourceReference.brownPlate340.inferredTopology,
    /joggling pillar F-B/);
  assert.deepEqual(sourceReference.officialAnimationView, {
    canvasHeight: 525,
    canvasWidth: 525,
    minimum: new THREE.Vector2(-9.428577, -1.740102),
    viewHeight: 20,
    viewWidth: 20,
  });
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    edition: 21,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.officialDescription, movement.description);
  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(-9.428577, -1.740102)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(0, 525), 0, 'official lower-left view corner');
  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(10.571423, 18.259898)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(525, 0), 1.2e-13,
  'official upper-right view corner');
  disposeModel(model.root);
});

test('movement 340 retains the exact official hidden crank-rocker phase law', () => {
  const model = createMovementModel(catalog.movements[339]);
  const { canonicalStates, geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 8192);
    near(state.hiddenCrankPin.distanceTo(geometry.hiddenCrankPivot),
      geometry.hiddenCrankRadius, 8e-16,
    `hidden crank radius at ${sample}`);
    near(state.hiddenCrankPin.distanceTo(state.canvasApproximation.pointD),
      geometry.hiddenConnectingRodLength, 4e-15,
    `hidden connecting rod at ${sample}`);
    near(state.canvasApproximation.pointD
      .distanceTo(geometry.hiddenRockerCenter),
    geometry.hiddenRockerRadius, 8e-15,
    `hidden D-rocker radius at ${sample}`);
    near(state.canvasApproximation.pointD.distanceTo(state.pointB),
      geometry.beamDBLength, 3e-15,
    `official canvas D-B beam station at ${sample}`);
    near(state.pointB.distanceTo(geometry.pillarPivotF),
      geometry.pillarLength, 3e-15,
    `official F-B pillar radius at ${sample}`);
  }

  const pivot = geometry.hiddenCrankPivot;
  const radius = geometry.hiddenCrankRadius;
  vector2Near(canonicalStates.sourceStart.hiddenCrankPin,
    pivot.clone().add(new THREE.Vector2(0, radius)), 3e-16,
  'source-start hidden crank');
  vector2Near(canonicalStates.sourceQuarter.hiddenCrankPin,
    pivot.clone().add(new THREE.Vector2(-radius, 0)), 3e-16,
  'source-quarter hidden crank');
  vector2Near(canonicalStates.sourceHalf.hiddenCrankPin,
    pivot.clone().add(new THREE.Vector2(0, -radius)), 5e-16,
  'source-half hidden crank');
  vector2Near(canonicalStates.sourceThreeQuarter.hiddenCrankPin,
    pivot.clone().add(new THREE.Vector2(radius, 0)), 5e-16,
  'source-three-quarter hidden crank');
  disposeModel(model.root);
});

test('movement 340 closes every visible member and beam station exactly', () => {
  const model = createMovementModel(catalog.movements[339]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 16384);
    const beamDirection = state.pointC.clone().sub(state.pointD).normalize();
    near(state.pointB.distanceTo(geometry.pillarPivotF),
      geometry.pillarLength, 3e-15,
    `rigid pillar F-B at ${sample}`);
    near(state.pointD.distanceTo(state.pointB),
      geometry.beamDBLength, 3e-15,
    `beam station D-B at ${sample}`);
    near(state.pointB.distanceTo(state.pointA),
      geometry.beamBALength, 2e-15,
    `beam station B-A at ${sample}`);
    near(state.pointB.distanceTo(state.pointC),
      geometry.beamBCLength, 3e-15,
    `beam station B-C at ${sample}`);
    near(state.pointD.distanceTo(state.pointA),
      geometry.beamDALength, 4e-15,
    `beam station D-A at ${sample}`);
    near(state.pointD.distanceTo(state.pointC),
      geometry.beamDCLength, 5e-15,
    `complete beam D-C at ${sample}`);
    vector2Near(state.pointA,
      state.pointD.clone().addScaledVector(beamDirection,
        geometry.beamDALength),
    4e-15, `A is fixed on rigid beam at ${sample}`);
    near(state.pointA.distanceTo(geometry.radiusPivotE),
      geometry.physicalRadiusBarLength, 3e-15,
    `corrected rigid radius E-A at ${sample}`);
    near(state.radiusClosureResidual, 0, 1.2e-15,
      `radius closure residual at ${sample}`);
  }
  assert.ok(geometry.maximumRadiusClosureResidual < 1.2e-15);
  disposeModel(model.root);
});

test('movement 340 repairs the canvas radius defect and improves C straightness', () => {
  const model = createMovementModel(catalog.movements[339]);
  const { geometry, sourceAnimation, stateAtTime } = model.root.userData;
  let minimumCanvasGap = Infinity;
  let maximumCanvasGap = 0;
  let maximumPhysicalADifference = 0;
  let maximumPhysicalCDifference = 0;
  let minimumC = Infinity;
  let maximumC = -Infinity;

  for (let sample = 0; sample <= 32768; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 32768);
    minimumCanvasGap = Math.min(minimumCanvasGap,
      state.canvasApproximation.radiusEndpointGap);
    maximumCanvasGap = Math.max(maximumCanvasGap,
      state.canvasApproximation.radiusEndpointGap);
    maximumPhysicalADifference = Math.max(maximumPhysicalADifference,
      state.physicalDifferenceFromCanvas.pointA);
    maximumPhysicalCDifference = Math.max(maximumPhysicalCDifference,
      state.physicalDifferenceFromCanvas.pointC);
    minimumC = Math.min(minimumC, state.pointC.y);
    maximumC = Math.max(maximumC, state.pointC.y);
  }

  const scale = geometry.sourceScale;
  assert.equal(sourceAnimation.physicalCorrection.radiusBarLength, 4.789956);
  assert.match(sourceAnimation.physicalCorrection.derivation,
    /8\.839627 - \(-0\.200329\) - 4\.25/);
  assert.match(sourceAnimation.physicalCorrection.reason,
    /too short to close/);
  near(geometry.physicalRadiusBarLength, 4.789956 * scale, 0,
    'scaled corrected E-A radius');
  assert.ok(minimumCanvasGap / scale > 0.0471);
  assert.ok(minimumCanvasGap / scale < 0.0473);
  assert.ok(maximumCanvasGap / scale > 0.0638);
  assert.ok(maximumCanvasGap / scale < 0.0640);
  near(maximumCanvasGap, geometry.maximumCanvasRadiusEndpointGap, 0,
    'stored maximum source radius-end gap');
  near(maximumPhysicalADifference,
    geometry.maximumPhysicalPointADifferenceFromCanvas, 0,
  'stored maximum physical A correction');
  near(maximumPhysicalCDifference,
    geometry.maximumPhysicalPointCDifferenceFromCanvas, 0,
  'stored maximum physical C correction');
  assert.ok(maximumPhysicalCDifference / scale < 0.082);
  assert.ok(geometry.maximumCanvasLateralDeviation / scale > 0.0163);
  assert.ok(geometry.maximumCanvasLateralDeviation / scale < 0.0165);
  assert.ok(geometry.maximumLateralDeviation / scale < 0.00069);
  assert.ok(geometry.maximumCanvasLateralDeviation
    > geometry.maximumLateralDeviation * 20);
  near(minimumC, geometry.minimumPistonY, 0,
    'stored lower piston extent');
  near(maximumC, geometry.maximumPistonY, 0,
    'stored upper piston extent');
  assert.ok(geometry.outputStroke / scale > 4.99999);
  assert.ok(geometry.outputStroke / scale < 5.00001);
  disposeModel(model.root);
});

test('movement 340 analytic rates and tangent limits match finite differences', () => {
  const model = createMovementModel(catalog.movements[339]);
  const { geometry, stateAtTime } = model.root.userData;
  const h = 2e-4;
  const samples = [0.13, 0.61, 1.0, 1.53, 2.18, 2.70, 3.53];

  for (const time of samples) {
    const previous = stateAtTime(time - h);
    const state = stateAtTime(time);
    const next = stateAtTime(time + h);
    assert.equal(state.rateMethod, 'analytic-two-circle-constraints');
    for (const [pointName, velocityName, accelerationName] of [
      ['hiddenCrankPin', 'hiddenCrankPinVelocity',
        'hiddenCrankPinAcceleration'],
      ['pointD', 'pointDVelocity', 'pointDAcceleration'],
      ['pointB', 'pointBVelocity', 'pointBAcceleration'],
      ['pointA', 'pointAVelocity', 'pointAAcceleration'],
      ['pointC', 'pointCVelocity', 'pointCAcceleration'],
    ]) {
      const finiteVelocity = next[pointName].clone()
        .sub(previous[pointName]).multiplyScalar(1 / (2 * h));
      const finiteAcceleration = next[pointName].clone()
        .add(previous[pointName])
        .addScaledVector(state[pointName], -2)
        .multiplyScalar(1 / h ** 2);
      vector2Near(state[velocityName], finiteVelocity, 8e-8,
        `${pointName} velocity at ${time}`);
      vector2Near(state[accelerationName], finiteAcceleration, 8e-6,
        `${pointName} acceleration at ${time}`);
    }
    for (const linkName of ['pillar', 'beam', 'radiusBar']) {
      const finiteAngularVelocity = angleDifference(
        next[linkName].angle,
        previous[linkName].angle,
      ) / (2 * h);
      const finiteAngularAcceleration = (
        next[linkName].angularVelocity
          - previous[linkName].angularVelocity
      ) / (2 * h);
      near(state[linkName].angularVelocity, finiteAngularVelocity, 2e-8,
        `${linkName} angular velocity at ${time}`);
      near(state[linkName].angularAcceleration,
        finiteAngularAcceleration, 3e-8,
      `${linkName} angular acceleration at ${time}`);
    }
  }

  let tangent = stateAtTime(0);
  for (let sample = 1; sample <= 16384; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 16384);
    if (Math.abs(state.radiusConstraintDeterminant)
      < Math.abs(tangent.radiusConstraintDeterminant)) tangent = state;
  }
  assert.ok(Math.abs(tangent.radiusConstraintDeterminant) < 4e-5);
  assert.equal(tangent.rateMethod, 'fourth-order-tangent-limit');
  const tangentStep = 5e-4;
  const previous = stateAtTime(tangent.time - tangentStep);
  const next = stateAtTime(tangent.time + tangentStep);
  for (const [pointName, velocityName, accelerationName] of [
    ['pointA', 'pointAVelocity', 'pointAAcceleration'],
    ['pointC', 'pointCVelocity', 'pointCAcceleration'],
    ['pointD', 'pointDVelocity', 'pointDAcceleration'],
  ]) {
    const finiteVelocity = next[pointName].clone()
      .sub(previous[pointName]).multiplyScalar(1 / (2 * tangentStep));
    const finiteAcceleration = next[pointName].clone()
      .add(previous[pointName])
      .addScaledVector(tangent[pointName], -2)
      .multiplyScalar(1 / tangentStep ** 2);
    vector2Near(tangent[velocityName], finiteVelocity, 5e-7,
      `${pointName} tangent-limit velocity`);
    vector2Near(tangent[accelerationName], finiteAcceleration, 5e-4,
      `${pointName} tangent-limit acceleration`);
  }
  disposeModel(model.root);
});

test('movement 340 renderer binds D, B, A, C, F, and E in real layers', () => {
  const model = createMovementModel(catalog.movements[339]);
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
    vector3Near(worldPosition(blocks.pillarStartAnchor),
      new THREE.Vector3(geometry.pillarPivotF.x,
        geometry.pillarPivotF.y, 0.08), 1e-15,
    `rendered pillar pivot F at ${time}`);
    vector3Near(worldPosition(blocks.pillarEndAnchor),
      new THREE.Vector3(state.pointB.x, state.pointB.y, 0.08), 2e-15,
    `rendered pillar pin B at ${time}`);
    for (const [name, point] of [
      ['D', state.pointD],
      ['B', state.pointB],
      ['A', state.pointA],
      ['C', state.pointC],
    ]) {
      vector3Near(worldPosition(blocks.beamAnchors[name]),
        new THREE.Vector3(point.x, point.y, 0.40), 3e-15,
      `rendered beam point ${name} at ${time}`);
    }
    vector3Near(worldPosition(blocks.radiusBarStartAnchor),
      new THREE.Vector3(geometry.radiusPivotE.x,
        geometry.radiusPivotE.y, 0.75), 1e-15,
    `rendered radius pivot E at ${time}`);
    vector3Near(worldPosition(blocks.radiusBarEndAnchor),
      new THREE.Vector3(state.pointA.x, state.pointA.y, 0.75), 3e-15,
    `rendered radius pin A at ${time}`);
    vector3Near(blocks.inputRod.position,
      new THREE.Vector3(state.pointD.x, state.pointD.y, 0), 0,
    `rendered input rod D at ${time}`);
    vector3Near(blocks.pistonRod.position,
      new THREE.Vector3(state.pointC.x, state.pointC.y, 0), 0,
    `rendered piston rod C at ${time}`);
    vector3Near(contacts.beamAtB.point,
      new THREE.Vector3(state.pointB.x, state.pointB.y, 0.36), 0,
    `contact B at ${time}`);
    vector3Near(contacts.beamAtA.point,
      new THREE.Vector3(state.pointA.x, state.pointA.y, 0.67), 0,
    `contact A at ${time}`);
    vector3Near(contacts.beamAtC.point,
      new THREE.Vector3(state.pointC.x, state.pointC.y, 0.42), 0,
    `contact C at ${time}`);
  }

  near(blocks.pillar.userData.nominalLength,
    geometry.pillarLength, 0, 'rendered F-B pillar length');
  near(blocks.radiusBar.userData.nominalLength,
    geometry.physicalRadiusBarLength, 0,
  'rendered corrected E-A bar length');
  assert.equal(blocks.inputGuideRails.length, 2);
  assert.equal(blocks.pistonGuideRails.length, 2);
  assert.notEqual(blocks.inputRod, blocks.pistonRod);
  assert.notEqual(blocks.pillar, blocks.radiusBar);
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 7.1);
  assert.ok(size.y > 8.3);
  assert.ok(size.z > 2.2,
    'frame, pillar, beam, radius, rods, and pins occupy real depth');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);
  disposeModel(model.root);
});

test('movement 340 closes exactly and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[339]);
  const { blocks, canonicalTimes, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);

  near(closure.phase, start.phase, 0, 'source phase closure');
  near(closure.inputAngle, start.inputAngle, 0, 'hidden crank closure');
  near(closure.unwrappedInputAngle - start.unwrappedInputAngle,
    Math.PI * 2, 0, 'one unwrapped source revolution');
  vector2Near(closure.hiddenCrankPin, start.hiddenCrankPin, 0,
    'hidden crank-pin closure');
  vector2Near(closure.pointD, start.pointD, 1e-15, 'D closure');
  vector2Near(closure.pointB, start.pointB, 1e-15, 'B closure');
  vector2Near(closure.pointA, start.pointA, 1e-15, 'A closure');
  vector2Near(closure.pointC, start.pointC, 1e-15, 'C closure');
  near(closure.pillar.angle, start.pillar.angle, 3e-16,
    'pillar closure');
  near(closure.beam.angle, start.beam.angle, 3e-16,
    'beam closure');
  near(closure.radiusBar.angle, start.radiusBar.angle, 5e-16,
    'radius closure');
  model.update(canonicalTimes.cycleClosure);
  model.root.updateMatrixWorld(true);
  vector3Near(worldPosition(blocks.beamAnchors.C),
    new THREE.Vector3(start.pointC.x, start.pointC.y, 0.40), 1e-15,
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
