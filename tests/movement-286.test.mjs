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

test('movement 286 is one rocking toe lifting one guided poppet-valve train', () => {
  const movement = catalog.movements[285];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 286);
  assert.equal(movement.number, '286');
  assert.equal(movement.title,
    'Rock-Shaft Toe and Poppet-Valve Lifter');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'rockshaft-curved-toe-clearance-lifter-guided-poppet-valve');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /curved toe is rigid/);
  assert.match(mechanism, /intentional clearance/);
  assert.match(mechanism, /raises the nonrotating lifter/);
  assert.match(mechanism, /poppet valve together/);
  assert.equal(transmission.followerRotation, 0);
  assert.match(transmission.output, /guided vertical lift/);

  assert.equal(blocks.toe.parent, model.root);
  assert.equal(blocks.toeBody.parent, blocks.toe);
  assert.equal(blocks.workingFlank.parent, blocks.toe);
  assert.ok(blocks.shaftCollar.parent === blocks.toe, 'collar on the toe');
  assert.ok(blocks.rockShaft.parent === blocks.toe, 'rock shaft rigid with the toe');
  assert.equal(blocks.lifter.parent, model.root);
  assert.equal(blocks.lifterBody.parent, blocks.lifter);
  assert.equal(blocks.followerShoe.parent, blocks.lifter);
  assert.equal(blocks.valveRod.parent, blocks.lifter);
  assert.equal(blocks.poppetHead.parent, blocks.lifter);
  assert.equal(blocks.valveIndex.parent, null, 'undrawn white index removed');
  assert.equal(blocks.valveSeat.parent, blocks.fixedGuides);
  vectorNear(blocks.toe.userData.axis, Z_AXIS, 0, 'toe axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'curved-toe-rigid-on-rock-shaft').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'flat-horizontal-toe-contact-shoe').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'vertical-poppet-valve-lifting-rod').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'poppet-valve-head-rigid-with-lifting-rod').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 286 records bounded canvas behavior and independent plate geometry', () => {
  const movement = catalog.movements[285];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate286;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.deepEqual(sourceAnimation.observedCycleFractions,
    [0, 0.4, 0.5, 0.9, 1]);
  assert.equal(sourceAnimation.observedFollowerLiftPixels, 40);
  assert.equal(sourceAnimation.observedLowPoseHasClearance, true);
  assert.ok(sourceAnimation.observedToeStrokeDegrees > 16);
  assert.ok(sourceAnimation.observedToeStrokeDegrees < 17);
  assert.match(sourceAnimation.referenceScope, /low-pose clearance/);
  assert.match(sourceAnimation.referenceScope, /40\/10\/40\/10/);
  assert.match(sourceAnimation.referenceScope, /rendering are independent/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_286.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.deepEqual(plate.rasterRockShaftCenter, { x: 381, y: 265 });
  assert.deepEqual(plate.rasterToeNose, { x: 77, y: 177 });
  assert.deepEqual(plate.rasterToeArcMiddle, { x: 220, y: 199 });
  assert.deepEqual(plate.rasterToeArcInner, { x: 331, y: 224 });
  assert.deepEqual(plate.rasterLifterLeft, { x: 56, y: 177 });
  assert.deepEqual(plate.rasterValveRodTop, { x: 440, y: 36 });
  assert.deepEqual(plate.rasterValveRodBottom, { x: 440, y: 476 });
  assert.match(plate.inferredTopology, /rock about the shaded shaft/);
  assert.match(plate.inferredTopology, /flat-bottomed lifter/);
  vectorNear(sourcePointToModel(plate.rasterRockShaftCenter),
    new THREE.Vector2(0, 0), 0, 'source shaft origin');
  near(geometry.observedFollowerLift / geometry.sourceScale, 40, 0,
    'observed lift scale');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 75,
    edition: 21,
    illustrationPage: 74,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 286 working arc is the circle through all three measured flank points', () => {
  const model = createMovementModel(catalog.movements[285]);
  const {
    geometry,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate286;
  const points = [
    plate.rasterToeNose,
    plate.rasterToeArcMiddle,
    plate.rasterToeArcInner,
  ].map(sourcePointToModel);
  for (const [index, point] of points.entries()) {
    near(point.distanceTo(geometry.workingCircleCenter),
      geometry.workingCircleRadius, 3e-15,
    `working-circle fit point ${index}`);
  }
  near(geometry.workingCircleRadius / geometry.sourceScale,
    plate.fittedWorkingCircleRadiusPixels, 2e-13,
    'reported working-circle radius');
  assert.ok(geometry.workingArcOuterAngle > geometry.workingArcInnerAngle);
  assert.ok(geometry.workingCircleRadius > 30);
  vectorNear(geometry.sourceToeNose, points[0], 0,
    'source toe nose retained');
  disposeModel(model.root);
});

test('movement 286 follows the observed 40/10/40/10 rock, dwell, return, dwell cycle', () => {
  const model = createMovementModel(catalog.movements[285]);
  const {
    geometry,
    stateAtCyclePhase,
    timeline,
  } = model.root.userData;
  const start = stateAtCyclePhase(0);
  const highStart = stateAtCyclePhase(0.4);
  const highMiddle = stateAtCyclePhase(0.45);
  const returnStart = stateAtCyclePhase(0.5);
  const lowStart = stateAtCyclePhase(0.9);
  const lowMiddle = stateAtCyclePhase(0.95);
  const closure = stateAtCyclePhase(1);

  assert.equal(timeline.liftStrokeFraction, 0.4);
  assert.equal(timeline.highDwellFraction, 0.1);
  assert.equal(timeline.returnStrokeFraction, 0.4);
  assert.equal(timeline.lowDwellFraction, 0.1);
  assert.deepEqual(timeline.schedule, [
    'clockwise-clearance-takeup-and-valve-lift',
    'raised-valve-dwell',
    'counterclockwise-valve-release-and-clearance-opening',
    'low-clearance-dwell',
  ]);
  near(start.toeAngle, geometry.lowToeAngle, 0, 'low toe endpoint');
  near(highStart.toeAngle, geometry.highToeAngle, 0,
    'high toe endpoint');
  near(highMiddle.toeAngle, geometry.highToeAngle, 0,
    'raised dwell angle');
  near(returnStart.toeAngle, geometry.highToeAngle, 0,
    'return start angle');
  near(lowStart.toeAngle, geometry.lowToeAngle, 0,
    'low dwell start angle');
  near(lowMiddle.toeAngle, geometry.lowToeAngle, 0,
    'low dwell angle');
  near(closure.toeAngle, start.toeAngle, 0, 'toe cycle closure');
  for (const state of [start, highStart, highMiddle, returnStart,
    lowStart, lowMiddle, closure]) {
    near(state.toeAngularSpeed, 0, 0,
      `${state.stage} angular speed`);
    near(state.toeAngularAcceleration, 0, 1e-13,
      `${state.stage} angular acceleration`);
  }
  assert.ok(stateAtCyclePhase(0.2).toeAngularSpeed < 0);
  assert.ok(stateAtCyclePhase(0.7).toeAngularSpeed > 0);
  disposeModel(model.root);
});

test('movement 286 preserves clearance until contact and never penetrates its flat lifter', () => {
  const model = createMovementModel(catalog.movements[285]);
  const {
    geometry,
    stateAtCyclePhase,
    transmission,
  } = model.root.userData;
  let activeSamples = 0;
  let inactiveSamples = 0;
  const regions = new Set();
  for (let index = 0; index <= 10000; index += 1) {
    const state = stateAtCyclePhase(index / 10000);
    assert.ok(state.contactGap >= -2e-15,
      `nonpenetration at sample ${index}`);
    assert.ok(state.followerLift >= -2e-15,
      `nonnegative valve lift at sample ${index}`);
    assert.ok(state.followerLift <= geometry.observedFollowerLift + 3e-15,
      `bounded valve lift at sample ${index}`);
    if (state.contactActive) {
      activeSamples += 1;
      near(state.contactGap, 0, 2e-15,
        `closed contact at sample ${index}`);
      near(state.followerBottomY, state.supportY, 2e-15,
        `support equality at sample ${index}`);
      near(state.normalVelocityError, 0, 0,
        `normal velocity at sample ${index}`);
      regions.add(state.workingRegion);
    } else {
      inactiveSamples += 1;
      near(state.followerLift, 0, 0,
        `low-stop lift at sample ${index}`);
      assert.equal(state.normalVelocityError, null);
    }
  }
  assert.ok(activeSamples > 3000);
  assert.ok(inactiveSamples > 3000);
  assert.ok(regions.has('curved-toe-flank-tangent'));
  assert.ok(regions.has('rounded-outer-toe-tip'));
  near(transmission.lowPoseClearance,
    geometry.followerRestBottomY
      - model.root.userData.supportAtToeAngle(
        geometry.lowToeAngle,
      ).supportY,
    0,
    'declared low clearance');
  near(transmission.maximumValveLift, geometry.observedFollowerLift,
    3e-15, 'declared maximum lift');
  disposeModel(model.root);
});

test('movement 286 analytic toe and valve rates agree away from the impact boundaries', () => {
  const model = createMovementModel(catalog.movements[285]);
  const {
    stateAtTime,
  } = model.root.userData;
  const step = 1e-5;
  for (const time of [0.2, 0.95, 1.25, 2.25, 2.75, 3.35]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    near((after.toeAngle - before.toeAngle) / (2 * step),
      state.toeAngularSpeed, 5e-10,
    `toe rate at ${time}`);
    near((after.followerLift - before.followerLift) / (2 * step),
      state.followerVelocity, 2e-8,
    `follower rate at ${time}`);
    if (state.contactActive) {
      near((after.followerVelocity - before.followerVelocity) / (2 * step),
        state.followerAcceleration, 4e-7,
      `follower acceleration at ${time}`);
      near(state.followerVelocity, state.toePointVelocity.y, 0,
        `contact normal speed at ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 286 renderer binds toe contact, lift, rod guide, and valve as one state', () => {
  const model = createMovementModel(catalog.movements[285]);
  const {
    blocks,
    stateAtTime,
  } = model.root.userData;
  for (const time of [0, 0.6, 1.2, 1.8, 2.4, 3.0, 4]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.toe.rotation.z, expected.toeAngle, 0,
      `rendered toe at ${time}`);
    near(blocks.lifter.position.y, expected.followerLift, 0,
      `rendered lifter at ${time}`);
    near(blocks.lifter.rotation.z, 0, 0,
      `rendered lifter rotation at ${time}`);
    vectorNear(blocks.lifter.userData.velocity,
      expected.valveRodVelocity, 0,
    `rendered valve velocity at ${time}`);
    assert.equal(blocks.contactMarker.visible, expected.contactActive);
    near(model.root.userData.contacts.toeLifterClearance,
      expected.contactActive ? 0 : expected.contactGap, 0,
    `rendered clearance at ${time}`);
    near(model.root.userData.contacts.valveRodGuides.lineError, 0, 0,
      `rendered guide line at ${time}`);
    near(model.root.userData.contacts.valveRodGuides.rotationError, 0, 0,
      `rendered guide rotation at ${time}`);
    if (expected.contactActive) {
      near(blocks.contactMarker.position.x, expected.contactPoint.x, 0,
        `rendered contact x at ${time}`);
      near(blocks.contactMarker.position.y, expected.followerBottomY, 0,
        `rendered contact y at ${time}`);
      near(model.root.userData.contacts.toeLifter.gap, 0, 2e-15,
        `rendered closed contact at ${time}`);
    }
    model.root.updateMatrixWorld(true);
    const rodWorld = model.root.worldToLocal(
      blocks.valveRod.getWorldPosition(new THREE.Vector3()),
    );
    const valveWorld = model.root.worldToLocal(
      blocks.poppetHead.getWorldPosition(new THREE.Vector3()),
    );
    near(rodWorld.y - blocks.valveRod.position.y,
      expected.followerLift, 8e-16,
    `rendered rod translation at ${time}`);
    near(valveWorld.y - blocks.poppetHead.position.y,
      expected.followerLift, 8e-16,
    `rendered valve translation at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 286 closes exactly while movement 339 remains the next authored draft', () => {
  const model = createMovementModel(catalog.movements[285]);
  const {
    blocks,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.cyclePeriod);
  assert.equal(closure.cycleIndex, 1);
  assert.equal(closure.cyclePhase, 0);
  assert.equal(closure.stage, start.stage);
  assert.equal(closure.contactActive, start.contactActive);
  near(closure.toeAngle, start.toeAngle, 0, 'toe closure');
  near(closure.followerLift, start.followerLift, 0,
    'follower closure');
  near(closure.contactGap, start.contactGap, 0,
    'clearance closure');

  model.update(0);
  const startToe = blocks.toe.quaternion.clone();
  const startLifter = blocks.lifter.position.clone();
  model.update(timeline.cyclePeriod);
  near(blocks.toe.quaternion.angleTo(startToe), 0, 0,
    'rendered toe closure');
  vectorNear(blocks.lifter.position, startLifter, 0,
    'rendered lifter closure');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
