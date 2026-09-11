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

test('movement 284 models the complete crank, bell-crank, ratchet, pinion, and carriage chain', () => {
  const movement = catalog.movements[283];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
  } = model.root.userData;

  assert.equal(movement.id, 284);
  assert.equal(movement.number, '284');
  assert.equal(movement.title, 'Crank-Rocker Adjustable-Pawl Saw Feed');
  assert.equal(movement.category, 'Rack & pinion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'continuous-crank-bellcrank-adjustable-pawl-ratchet-pinion-carriage-rack');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /continuously revolving lower crank/);
  assert.match(mechanism, /right-angle bell crank/);
  assert.match(mechanism, /exactly one tooth/);
  assert.match(mechanism, /coaxial pinion/);
  assert.match(mechanism, /without slip/);

  assert.equal(blocks.inputCrank.parent, model.root);
  assert.equal(blocks.connectingRod.parent, model.root);
  assert.equal(blocks.bellCrank.parent, model.root);
  assert.equal(blocks.horizontalArm.parent, blocks.bellCrank);
  assert.equal(blocks.verticalArm.parent, blocks.bellCrank);
  assert.equal(blocks.adjustmentScrew.parent, blocks.bellCrank);
  assert.equal(blocks.slider.parent, blocks.bellCrank);
  assert.equal(blocks.pawl.parent, model.root);
  assert.equal(blocks.ratchet.parent, model.root);
  assert.equal(blocks.pinion.parent, model.root);
  assert.equal(blocks.carriage.parent, model.root);
  assert.equal(blocks.rackBody.parent, blocks.carriage);
  assert.ok(blocks.rackTeeth.every(({ parent }) => parent === blocks.carriage));
  vectorNear(blocks.inputCrank.userData.axis, Z_AXIS, 0,
    'input crank axis');
  vectorNear(blocks.bellCrank.userData.axis, Z_AXIS, 0,
    'bell-crank axis');
  vectorNear(blocks.ratchet.userData.axis, Z_AXIS, 0,
    'ratchet axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role === 'feed-variation-screw').length,
    1);
  assert.equal(roles.filter((role) =>
    role === 'separately-hinged-adjustable-curved-feed-pawl').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'fixed-pivot-anti-reverse-holding-pawl').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'coaxial-carriage-feed-pinion').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'translating-saw-bed-carriage-with-side-rack').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 284 records the unavailable animation and measured plate geometry', () => {
  const movement = catalog.movements[283];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate284;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /marks its animation unavailable/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_284.html');
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.deepEqual(plate.rasterRatchetCenter, { x: 140, y: 352 });
  assert.deepEqual(plate.rasterBellCrankPivot, { x: 141, y: 122 });
  assert.deepEqual(plate.rasterRockerJoint, { x: 465, y: 122 });
  assert.deepEqual(plate.rasterInputShaft, { x: 454, y: 453 });
  assert.deepEqual(plate.rasterCrankPin, { x: 389, y: 438 });
  assert.deepEqual(plate.rasterPawlHinge, { x: 141, y: 187 });
  assert.equal(plate.inferredRatchetTeeth, 38);
  assert.equal(plate.inferredPinionTeeth, 12);
  assert.match(plate.inferredTopology, /fulcrum a/);
  assert.match(plate.inferredTopology, /screw-adjusted pawl hinge/);
  assert.match(plate.inferredTopology, /same shaft/);
  vectorNear(sourcePointToModel(plate.rasterRatchetCenter),
    new THREE.Vector2(0, 0), 0, 'source ratchet origin');
  near(geometry.sourceRockerAngle, 0, 0, 'source horizontal rocker');
  near(geometry.sliderRadius / geometry.sourceScale, 65.183716885,
    0.02, 'engraved screw-block radius');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 75,
    edition: 21,
    illustrationPage: 74,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 284 solves one non-branching crank-rocker closure for every input angle', () => {
  const model = createMovementModel(catalog.movements[283]);
  const {
    fourBarAtInputAngle,
    geometry,
  } = model.root.userData;

  let minimumRocker = Infinity;
  let maximumRocker = -Infinity;
  for (let index = 0; index <= 720; index += 1) {
    const angle = index / 720 * Math.PI * 2;
    const state = fourBarAtInputAngle(angle);
    near(state.crankPin.distanceTo(
      new THREE.Vector2(4.867, -1.5655)), geometry.crankRadius, 2e-15,
    `crank radius at sample ${index}`);
    near(state.rockerLengthError, 0, 4e-15,
      `rocker closure at sample ${index}`);
    near(state.connectingRodClosureError, 0, 4e-15,
      `rod closure at sample ${index}`);
    assert.ok(Number.isFinite(state.rockerDerivative));
    minimumRocker = Math.min(minimumRocker, state.rockerAngle);
    maximumRocker = Math.max(maximumRocker, state.rockerAngle);
  }
  near(minimumRocker, geometry.rockerMinimumAngle, 2e-5,
    'sampled lower rocker limit');
  near(maximumRocker, geometry.rockerMaximumAngle, 2e-5,
    'sampled upper rocker limit');
  assert.ok(geometry.rockerMaximumAngle > 0.18);
  assert.ok(geometry.rockerMinimumAngle < -0.22);
  near(geometry.rockerLength, 324 * geometry.sourceScale, 1e-15,
    'measured horizontal arm length');
  disposeModel(model.root);
});

test('movement 284 turns its crank continuously and reverses only the bell crank', () => {
  const model = createMovementModel(catalog.movements[283]);
  const {
    geometry,
    stateAtCycleCoordinate,
    timeline,
  } = model.root.userData;
  const start = stateAtCycleCoordinate(0);
  const driveMiddle = stateAtCycleCoordinate(timeline.driveEndPhase / 2);
  const driveEnd = stateAtCycleCoordinate(timeline.driveEndPhase);
  const returnMiddle = stateAtCycleCoordinate(
    (1 + timeline.driveEndPhase) / 2,
  );
  const end = stateAtCycleCoordinate(1);

  assert.equal(start.driving, true);
  assert.equal(driveMiddle.driving, true);
  assert.equal(driveEnd.driving, false);
  assert.equal(returnMiddle.driving, false);
  near(start.inputAngle - end.inputAngle, Math.PI * 2, 0,
    'one clockwise input turn');
  near(start.inputAngularSpeed, -Math.PI * 2 / geometry.inputCyclePeriod, 0,
    'constant clockwise speed');
  near(start.rockerAngle, geometry.rockerMinimumAngle, 3e-16,
    'lower rocker limit');
  near(driveEnd.rockerAngle, geometry.rockerMaximumAngle, 3e-15,
    'upper rocker limit');
  near(end.rockerAngle, start.rockerAngle, 2e-16,
    'rocker cycle closure');
  assert.ok(driveMiddle.rockerAngularSpeed > 0);
  assert.ok(returnMiddle.rockerAngularSpeed < 0);
  near(start.rockerAngularSpeed, 0, 2e-8,
    'lower toggle rocker speed');
  near(driveEnd.rockerAngularSpeed, 0, 2e-8,
    'upper toggle rocker speed');
  assert.deepEqual(timeline.schedule, [
    'crank-driven-pawl-power-swing-and-one-tooth-index',
    'crank-driven-pawl-click-return-with-output-dwell',
  ]);
  disposeModel(model.root);
});

test('movement 284 pawl drives exactly one ratchet tooth and lifts on the idle return', () => {
  const model = createMovementModel(catalog.movements[283]);
  const {
    geometry,
    stateAtCycleCoordinate,
    timeline,
    transmission,
  } = model.root.userData;
  const start = stateAtCycleCoordinate(0);
  const driveEnd = stateAtCycleCoordinate(timeline.driveEndPhase);
  const returnQuarter = stateAtCycleCoordinate(
    timeline.driveEndPhase + (1 - timeline.driveEndPhase) * 0.25,
  );
  const returnMiddle = stateAtCycleCoordinate(
    timeline.driveEndPhase + (1 - timeline.driveEndPhase) * 0.5,
  );
  const returnThreeQuarter = stateAtCycleCoordinate(
    timeline.driveEndPhase + (1 - timeline.driveEndPhase) * 0.75,
  );

  for (let index = 0; index < 101; index += 1) {
    const phase = timeline.driveEndPhase * index / 101;
    const state = stateAtCycleCoordinate(phase);
    assert.equal(state.driving, true);
    near(state.pawlContactError, 0, 8e-16,
      `pawl contact at drive sample ${index}`);
    assert.ok(state.wheelAngularSpeed <= 1e-12);
  }
  near(driveEnd.wheelAngle - start.wheelAngle,
    -geometry.ratchetToothPitch, 3e-16, 'one-tooth drive');
  near(returnQuarter.wheelAngle, driveEnd.wheelAngle, 0,
    'first return-quarter ratchet dwell');
  near(returnMiddle.wheelAngle, driveEnd.wheelAngle, 0,
    'mid-return ratchet dwell');
  near(returnThreeQuarter.wheelAngle, driveEnd.wheelAngle, 0,
    'last return-quarter ratchet dwell');
  near(returnMiddle.wheelAngularSpeed, 0, 0, 'return angular dwell');
  near(returnMiddle.returnClearance, geometry.pawlReturnLift, 2e-16,
    'maximum pawl lift');
  assert.ok(returnQuarter.returnClearance > 0);
  assert.ok(returnThreeQuarter.returnClearance > 0);
  assert.equal(transmission.returnStrokeWheelDwell, true);
  near(transmission.oneToothIndexAngle,
    Math.PI * 2 / geometry.ratchetTeeth, 0, 'declared tooth pitch');
  disposeModel(model.root);
});

test('movement 284 common-shaft pinion advances its rack at exact pitch speed', () => {
  const model = createMovementModel(catalog.movements[283]);
  const {
    geometry,
    stateAtCycleCoordinate,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const expectedFeed = geometry.pinionPitchRadius
    * geometry.ratchetToothPitch;
  const start = stateAtTime(0);
  const end = stateAtTime(geometry.inputCyclePeriod);

  near(end.wheelAngle - start.wheelAngle,
    -geometry.ratchetToothPitch, 3e-16, 'one input-cycle ratchet index');
  near(end.rackX - start.rackX, expectedFeed, 3e-16,
    'one input-cycle carriage feed');
  near(transmission.carriageAdvancePerInputTurn, expectedFeed, 3e-16,
    'declared carriage feed');
  near(transmission.outputTeethPerInputTurn, 1, 3e-16,
    'declared tooth index');
  assert.equal(transmission.inputTurnsPerRatchetTurn, 38);
  assert.match(transmission.pinionRackNoSlipLaw,
    /rack-speed = -pinion-pitch-radius/);
  for (let index = 0; index <= 400; index += 1) {
    const state = stateAtCycleCoordinate(index / 100);
    near(state.pinionRackNoSlipError, 0, 0,
      `pinion-rack no-slip sample ${index}`);
    near(state.rackSpeed,
      -geometry.pinionPitchRadius * state.wheelAngularSpeed, 0,
    `rack speed sample ${index}`);
  }
  const fullRatchetTurn = stateAtTime(
    geometry.inputCyclePeriod * geometry.ratchetTeeth,
  );
  near(fullRatchetTurn.wheelAngle - start.wheelAngle, -Math.PI * 2,
    3e-14, 'thirty-eight inputs make one output turn');
  near(fullRatchetTurn.rackX - start.rackX,
    Math.PI * 2 * geometry.pinionPitchRadius, 2e-14,
    'one pinion circumference of carriage feed');
  disposeModel(model.root);
});

test('movement 284 screw position monotonically varies the available pawl feed', () => {
  const model = createMovementModel(catalog.movements[283]);
  const {
    feedAdjustment,
    geometry,
    pawlSweepAtSliderRadius,
  } = model.root.userData;

  assert.match(feedAdjustment.screwAction, /moves the pawl hinge/);
  assert.match(feedAdjustment.screwAction, /changing its tangential sweep/);
  assert.equal(feedAdjustment.selectedOutputTeethPerCycle, 1);
  near(feedAdjustment.selectedSliderRadius, geometry.sliderRadius, 0,
    'selected screw setting');
  near(pawlSweepAtSliderRadius(geometry.sliderRadius),
    geometry.ratchetToothPitch, 3e-16, 'selected one-tooth sweep');
  assert.ok(feedAdjustment.minimumSweptTeeth > 0.5);
  assert.ok(feedAdjustment.minimumSweptTeeth < 0.7);
  assert.ok(feedAdjustment.maximumSweptTeeth > 1.6);
  assert.ok(feedAdjustment.maximumSweptTeeth < 1.8);
  let previous = -Infinity;
  for (let index = 0; index <= 50; index += 1) {
    const radius = THREE.MathUtils.lerp(
      feedAdjustment.minimumSliderRadius,
      feedAdjustment.maximumSliderRadius,
      index / 50,
    );
    const sweptTeeth = pawlSweepAtSliderRadius(radius)
      / geometry.ratchetToothPitch;
    assert.ok(sweptTeeth > previous,
      `feed capacity increases at screw sample ${index}`);
    previous = sweptTeeth;
  }
  disposeModel(model.root);
});

test('movement 284 renderer follows its exact state and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[283]);
  const {
    blocks,
    geometry,
    stateAtTime,
  } = model.root.userData;
  for (const time of [0, 0.7, 1.8, 2.9, 4.2, 5, 13.4]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.inputCrank.rotation.z, expected.inputAngle, 0,
      `rendered crank at ${time}`);
    near(blocks.bellCrank.rotation.z, expected.rockerAngle, 0,
      `rendered bell crank at ${time}`);
    near(blocks.ratchetRotor.rotation.z, expected.wheelAngle, 0,
      `rendered ratchet at ${time}`);
    near(blocks.pinion.userData.rotor.rotation.z, expected.wheelAngle, 0,
      `rendered pinion at ${time}`);
    near(blocks.carriage.position.x, expected.rackX, 0,
      `rendered carriage at ${time}`);
    near(blocks.pawl.position.x, expected.pawlGeometry.pawlPivot.x, 0,
      `rendered pawl x at ${time}`);
    near(blocks.pawl.position.y, expected.pawlGeometry.pawlPivot.y, 0,
      `rendered pawl y at ${time}`);
    near(blocks.pawl.rotation.z, expected.pawlGeometry.pawlAngle, 0,
      `rendered pawl angle at ${time}`);
    vectorNear(blocks.carriage.userData.velocity,
      expected.rackVelocity, 0, `rendered carriage velocity at ${time}`);
    near(model.root.userData.contacts.pinionRack.noSlipError, 0, 0,
      `rendered rack contact at ${time}`);
    assert.equal(blocks.pawlContactMarker.visible, expected.driving);
    model.root.updateMatrixWorld(true);
    const renderedCrankPin = model.root.worldToLocal(
      blocks.crankPin.getWorldPosition(new THREE.Vector3()),
    );
    near(renderedCrankPin.x, expected.crankPin.x, 2e-15,
      `rendered crank-pin x at ${time}`);
    near(renderedCrankPin.y, expected.crankPin.y, 2e-15,
      `rendered crank-pin y at ${time}`);
  }
  assert.equal(blocks.rackTeeth.length, geometry.rackToothCount);
  assert.equal(blocks.ratchet.userData.teeth, geometry.ratchetTeeth);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
