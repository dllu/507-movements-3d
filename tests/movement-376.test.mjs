import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
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

function angleNear(actual, expected, tolerance, message) {
  const error = THREE.MathUtils.euclideanModulo(
    actual - expected + Math.PI,
    FULL_TURN,
  ) - Math.PI;
  near(error, 0, tolerance, message);
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

test('movement 376 is one internal animal treadwheel with a rigid cage, sixteen treads, one axle, and a world-stationary walking animal', () => {
  const movement = catalog.movements[375];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 376);
  assert.equal(movement.number, '376');
  assert.equal(movement.category, 'Water wheels & turbines');
  assert.equal(
    movement.archetype,
    'interior-animal-treadwheel-weight-drive',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-animal-walks-up/);
  assert.match(data.mechanism, /one-horizontal-axis-cage-treadwheel/);
  assert.match(data.mechanism, /gravity-turns/);
  assert.match(data.mechanism, /coaxial-output-shaft/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.input, /animal walking upward/);
  assert.match(degreesOfFreedom.note, /one rigid rotor/);
  assert.match(degreesOfFreedom.note, /gait visualization/);

  for (const component of [
    blocks.animal,
    ...blocks.fixedBearings,
    blocks.wheelRotor,
  ]) assert.equal(component.parent, model.root);
  // Brown draws no trestle, base rails or white index.
  for (const component of [
    ...blocks.baseRails,
    ...blocks.bearingArms,
    ...blocks.supportPosts,
    blocks.wheelIndex,
  ]) assert.equal(component.parent, null);
  for (const component of [
    blocks.axle,
    ...blocks.axialRails,
    ...blocks.radialSpokes,
    ...blocks.sideRings,
    ...blocks.treadBoards,
  ]) assert.equal(component.parent, blocks.wheelRotor);
  for (const component of [
    ...blocks.ears,
    blocks.eye,
    blocks.head,
    ...blocks.legRoots,
    blocks.muzzle,
    blocks.tailPivot,
    blocks.torso,
  ]) assert.equal(component.parent, blocks.animal);
  assert.equal(blocks.tail.parent, blocks.tailPivot);
  assert.equal(blocks.treadBoards.length, 16);
  assert.equal(blocks.sideRings.length, 2);
  assert.equal(blocks.radialSpokes.length, 8);
  assert.equal(blocks.axialRails.length, 8);
  assert.equal(blocks.legRoots.length, 4);
  assert.equal(blocks.kneePivots.length, 4);
  assert.equal(blocks.animal.userData.fixedInWorld, true);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'horizontal-axis-cage-wheel-turned-by-animal-weight',
    'cross-width-internal-tread-board-rigid-with-wheel',
    'animal-held-at-one-side-while-walking-up-moving-interior',
    'horizontal-output-axle-rigid-with-treadwheel',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 376 preserves Brown\'s operating principle and applications, measured plate, unavailable animation, and gait disclosure', () => {
  const movement = catalog.movements[375];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate376;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_376.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Tread-wheel horse-power/);
  assert.match(movement.description, /weight of an animal/);
  assert.match(movement.description, /walk up one side of its interior/);
  assert.match(movement.description, /paddle-wheels of ferry-boats/);
  assert.match(movement.description, /turn-spit dog/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(
    dynamics.sourceSpecifiesDimensionsTimingTreadCountAnimalMassOrLoad,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);
  assert.match(dynamics.treatment, /gravity torque/);
  assert.match(dynamics.treatment, /analytically/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 9);
  assert.deepEqual(plate.outerWheelCenter.toArray(), [265, 261]);
  assert.deepEqual(plate.outerWheelTop.toArray(), [265, 26]);
  assert.deepEqual(plate.outerWheelBottom.toArray(), [266, 499]);
  assert.deepEqual(plate.outerWheelLeft.toArray(), [29, 257]);
  assert.deepEqual(plate.outerWheelRight.toArray(), [501, 257]);
  assert.deepEqual(plate.innerWheelLeft.toArray(), [70, 257]);
  assert.deepEqual(plate.innerWheelBottom.toArray(), [269, 457]);
  assert.deepEqual(plate.horseHeadCenter.toArray(), [151, 250]);
  assert.deepEqual(plate.horseTorsoCenter.toArray(), [252, 317]);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.engravingEvidence, /horse entirely inside/);
  assert.match(evidence.engravingEvidence, /left-hand interior side/);
  assert.match(evidence.reconstructionDisclosure, /sixteen tread boards/);
  assert.match(evidence.reconstructionDisclosure, /not a biomechanical force simulation/);
  disposeModel(model.root);
});

test('movement 376 all sixteen tread boards are equally spaced rigid members with exact circular positions and velocities', () => {
  const model = createMovementModel(catalog.movements[375]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;

  assert.equal(geometry.treadCount, 16);
  near(geometry.treadPitch, FULL_TURN / geometry.treadCount, 0,
    'equal tread pitch');
  assert.deepEqual(blocks.treadBoards.map((board) => board.userData.index),
    Array.from({ length: geometry.treadCount }, (_, index) => index));
  for (let sample = -720; sample <= 1440; sample += 1) {
    const state = stateAtTime(geometry.wheelPeriod * sample / 720);
    assert.equal(state.treads.length, geometry.treadCount);
    for (let index = 0; index < geometry.treadCount; index += 1) {
      const tread = state.treads[index];
      near(tread.angle,
        state.wheelAngle + index * geometry.treadPitch,
        0, `tread ${index} unwrapped angle`);
      near(tread.center.length(), geometry.innerTreadRadius, 3e-16,
        `tread ${index} center radius`);
      vectorNear(tread.center, new THREE.Vector3(
        Math.cos(tread.angle) * geometry.innerTreadRadius,
        Math.sin(tread.angle) * geometry.innerTreadRadius,
        0,
      ), 0, `tread ${index} exact circular position`);
      vectorNear(tread.velocity,
        new THREE.Vector3().crossVectors(
          Z_AXIS.clone().multiplyScalar(state.wheelAngularSpeed),
          tread.center,
        ), 0, `tread ${index} rigid-wheel velocity`);
      const next = state.treads[(index + 1) % geometry.treadCount];
      const separation = THREE.MathUtils.euclideanModulo(
        next.angle - tread.angle,
        FULL_TURN,
      );
      near(separation, geometry.treadPitch, 4e-15,
        `tread ${index} equal angular spacing`);
    }
  }
  disposeModel(model.root);
});

test('movement 376 animal climbing velocity exactly cancels downward tread motion at its fixed left-side station', () => {
  const model = createMovementModel(catalog.movements[375]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;
  const expectedStation = new THREE.Vector3(
    Math.cos(geometry.animalStationAngle) * geometry.innerTreadRadius,
    Math.sin(geometry.animalStationAngle) * geometry.innerTreadRadius,
    0,
  );

  vectorNear(geometry.animalStationPoint, expectedStation, 0,
    'animal station on inner tread circle');
  assert.ok(geometry.animalStationPoint.x < 0,
    'animal stands on left side');
  assert.ok(geometry.animalStationPoint.y < 0,
    'animal stands below axle');
  assert.match(transmission.meanNoDriftLaw, /equal and opposite/);
  for (let sample = -900; sample <= 1800; sample += 1) {
    const state = stateAtTime(geometry.wheelPeriod * sample / 900);
    near(state.surfaceVelocityAtAnimal.length(),
      geometry.innerTreadRadius * state.wheelAngularSpeed,
      5e-16, 'interior tread speed');
    near(state.relativeClimbVelocity.length(),
      transmission.animalRelativeClimbSpeed, 5e-16,
      'animal climb speed relative to wheel');
    vectorNear(state.relativeClimbVelocity,
      state.surfaceVelocityAtAnimal.clone().negate(), 0,
      'relative climb opposes moving tread');
    near(state.netAnimalWorldVelocity.length(), 0, 0,
      'mean animal world position has zero drift');
    near(state.treadPassingFrequency,
      transmission.treadPassingFrequency, 0,
      'tread passing rate');
  }
  disposeModel(model.root);
});

test('movement 376 off-center animal weight gives the correct positive wheel torque and steady output power', () => {
  const model = createMovementModel(catalog.movements[375]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;
  const state = stateAtTime(1.23);
  const crossProduct = state.animalCenterOfMass.clone()
    .cross(state.animalWeight);

  vectorNear(state.animalCenterOfMass,
    geometry.animalCenterOfMass, 0,
    'fixed animal center of mass');
  assert.ok(state.animalCenterOfMass.x < 0);
  assert.ok(state.animalWeight.y < 0);
  near(state.animalWeightTorque, crossProduct.z, 0,
    'weight moment cross product');
  assert.ok(state.animalWeightTorque > 0,
    'left-side weight drives positive wheel rotation');
  near(state.outputPower,
    state.animalWeightTorque * state.wheelAngularSpeed,
    0, 'steady torque-times-speed output power');
  near(transmission.outputTorque, state.animalWeightTorque, 0,
    'published output torque');
  near(transmission.outputPower, state.outputPower, 0,
    'published output power');
  assert.match(transmission.weightTorqueLaw, /cross product/);
  model.update(1.23, 0.016);
  near(data.weightDrive.torque, state.animalWeightTorque, 0,
    'renderer publishes weight torque');
  near(data.weightDrive.outputPower, state.outputPower, 0,
    'renderer publishes output power');
  disposeModel(model.root);
});

test('movement 376 four-leg gait is smooth, diagonally phased, derivative-consistent, and closes an integer number of cycles', () => {
  const model = createMovementModel(catalog.movements[375]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  const step = 1e-6;

  assert.equal(geometry.gaitCyclesPerWheelTurn, 8);
  assert.deepEqual(geometry.legPhaseOffsets,
    [0, Math.PI, Math.PI, 0]);
  for (let sample = 0; sample <= 320; sample += 1) {
    const time = geometry.wheelPeriod * sample / 320 + 0.002;
    const state = stateAtTime(time);
    const before = stateAtTime(time - step);
    const after = stateAtTime(time + step);
    assert.equal(state.legStates.length, 4);
    for (let index = 0; index < 4; index += 1) {
      const leg = state.legStates[index];
      const numericalUpperRate = (
        after.legStates[index].upperAngle
          - before.legStates[index].upperAngle
      ) / (2 * step);
      const numericalLowerRate = (
        after.legStates[index].lowerAngle
          - before.legStates[index].lowerAngle
      ) / (2 * step);
      near(numericalUpperRate, leg.upperAngularSpeed, 3e-9,
        `leg ${index} upper analytic derivative`);
      near(numericalLowerRate, leg.lowerAngularSpeed, 3e-9,
        `leg ${index} lower analytic derivative`);
    }
    near(state.legStates[0].upperAngle
      - geometry.upperLegBaseAngles[0],
    state.legStates[3].upperAngle
      - geometry.upperLegBaseAngles[3],
    2e-15, 'first diagonal pair in phase');
    near(state.legStates[1].upperAngle
      - geometry.upperLegBaseAngles[1],
    state.legStates[2].upperAngle
      - geometry.upperLegBaseAngles[2],
    2e-15, 'second diagonal pair in phase');
    near(state.legStates[0].upperAngle
      - geometry.upperLegBaseAngles[0],
    -(state.legStates[1].upperAngle
      - geometry.upperLegBaseAngles[1]),
    2e-15, 'diagonal pairs alternate');
  }
  disposeModel(model.root);
});

test('movement 376 renderer keeps the animal body fixed while binding wheel, tread boards, leg joints, and tail to exact state', () => {
  const model = createMovementModel(catalog.movements[375]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const animalPosition = blocks.animal.position.clone();
  const bearingPositions = blocks.fixedBearings.map(
    (bearing) => bearing.position.clone(),
  );

  for (let frame = 0; frame <= 720; frame += 1) {
    const time = geometry.wheelPeriod * 2 * frame / 720;
    const expected = stateAtTime(time);
    model.update(time, 0.016);
    near(blocks.wheelRotor.rotation.z, expected.wheelAngle, 0,
      'rendered wheel angle');
    for (let index = 0; index < 4; index += 1) {
      near(blocks.legRoots[index].rotation.z,
        expected.legStates[index].upperAngle, 0,
        `rendered upper leg ${index}`);
      near(blocks.kneePivots[index].rotation.z,
        expected.legStates[index].lowerAngle, 0,
        `rendered lower leg ${index}`);
    }
    near(blocks.tailPivot.rotation.z, expected.tailAngle, 0,
      'rendered smooth tail angle');
    vectorNear(blocks.animal.position, animalPosition, 0,
      'animal torso group remains fixed in world');
    for (let index = 0; index < blocks.fixedBearings.length; index += 1) {
      vectorNear(blocks.fixedBearings[index].position,
        bearingPositions[index], 0,
        `bearing ${index} remains fixed`);
    }
    blocks.wheelRotor.updateMatrixWorld(true);
    for (let index = 0; index < geometry.treadCount; index += 1) {
      const renderedCenter = blocks.treadBoards[index]
        .getWorldPosition(new THREE.Vector3());
      vectorNear(renderedCenter, expected.treads[index].center,
        4e-15, `rendered tread ${index} center`);
    }
  }
  disposeModel(model.root);
});

test('movement 376 closes one wheel turn and eight gait cycles before movement 507 remains the next authored draft', () => {
  const movement = catalog.movements[375];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(geometry.wheelPeriod);

  near(closure.wheelAngle - start.wheelAngle, FULL_TURN, 0,
    'one unwrapped wheel turn');
  near(closure.gaitPhase - start.gaitPhase,
    geometry.gaitCyclesPerWheelTurn * FULL_TURN, 0,
    'eight unwrapped gait cycles');
  angleNear(closure.wheelAngle, start.wheelAngle, 0,
    'wheel index closes');
  angleNear(closure.tailAngle, start.tailAngle, 0,
    'tail pose closes');
  for (let index = 0; index < 4; index += 1) {
    angleNear(closure.legStates[index].upperAngle,
      start.legStates[index].upperAngle, 2e-15,
      `upper leg ${index} closes`);
    angleNear(closure.legStates[index].lowerAngle,
      start.legStates[index].lowerAngle, 2e-15,
      `lower leg ${index} closes`);
  }
  for (let index = 0; index < geometry.treadCount; index += 1) {
    vectorNear(closure.treads[index].center,
      start.treads[index].center, 4e-15,
      `tread ${index} closes`);
  }
  assert.equal(timeline.demonstrationPeriod, geometry.wheelPeriod);
  assert.equal(data.animationTiming.authoredCyclePeriod,
    geometry.wheelPeriod);
  assert.ok(data.animationTiming.displayCycleDuration >= 12);
  assertReadableTiming(data.animationTiming);
  assert.ok(data.cameraFitBounds instanceof THREE.Box3);
  assert.ok(Number.isFinite(data.groundFloorY));

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model507.root);
});
