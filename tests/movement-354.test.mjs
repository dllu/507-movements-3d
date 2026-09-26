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

function timeAtPhase(data, phase) {
  return (
    phase * data.geometry.fullTurn - data.geometry.sourcePoseAngle
  ) / data.geometry.inputAngularSpeed;
}

test('movement 354 is the shaped-groove uniform-velocity crosshead', () => {
  const movement = catalog.movements[353];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    degreesOfFreedom,
    fidelity,
    mechanism,
  } = model.root.userData;

  assert.equal(movement.id, 354);
  assert.equal(movement.number, '354');
  assert.equal(movement.category, 'Cranks & reciprocation');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype, 'uniform-velocity-endless-groove-crosshead');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /uniformly-rotating-nine-point-seven-radius/);
  assert.match(mechanism, /continuous-shaped-endless-groove/);
  assert.match(mechanism, /constant-speed-up-and-down-strokes/);
  assert.match(mechanism, /instantaneous-end-reversals/);
  assert.equal(degreesOfFreedom.mechanism, 1);
  assert.match(degreesOfFreedom.input, /uniformly rotating crank disk/);
  assert.match(degreesOfFreedom.output, /pure vertical translation/);

  assert.equal(blocks.input.parent, model.root);
  assert.equal(blocks.inputRotor.parent, blocks.input);
  assert.equal(blocks.diskBody.parent, blocks.inputRotor);
  assert.equal(blocks.diskRim.parent, blocks.inputRotor);
  assert.equal(blocks.crankWrist.parent, blocks.inputRotor);
  assert.equal(blocks.wristCap.parent, blocks.inputRotor);
  assert.equal(blocks.yoke.parent, model.root);
  assert.equal(blocks.yokeBody.parent, blocks.yoke);
  assert.equal(blocks.grooveBand.parent, blocks.yoke);
  assert.equal(blocks.upperStem.parent, blocks.yoke);
  assert.equal(blocks.lowerStem.parent, blocks.yoke);
  assert.equal(blocks.diskRotationIndexes.length, 8);
  assert.equal(blocks.grooveEdges.length, 2);
  assert.equal(blocks.grooveCornerPockets.length, 2);
  assert.equal(blocks.guideCheeks.length, 4);
  assert.equal(blocks.rearFrameRails, undefined, "Brown draws no rear frame");

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.ok(roles.some((role) => /shaped-endless-groove/.test(role)));
  assert.ok(roles.some((role) => /crank-wrist/.test(role)));
  assert.equal(roles.some((role) => /belt|pulley/.test(role)), false);
  disposeModel(model.root);
});

test('movement 354 preserves the official dimensions, timing, and reference to 93', () => {
  const movement = catalog.movements[353];
  const model = createMovementModel(movement);
  const {
    animationTiming,
    geometry,
    sourceAnimation,
    sourceReference,
    transmission,
  } = model.root.userData;
  const coordinates = sourceReference.officialModelCoordinates;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_354.html');
  assert.match(movement.description, /endless groove/);
  assert.match(movement.description, /uniform velocity/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.sourceCoordinateCyclesPerMinute, 15);
  near(sourceAnimation.effectiveInputRevolutionsPerMinute, 7.5, 0,
    'effective source crank rpm');
  near(sourceAnimation.officialDurationSeconds, 8, 2e-15,
    'official full crank-turn period');
  near(geometry.inputCyclePeriod, 8, 2e-15,
    'authored full crank-turn period');
  near(animationTiming.authoredCyclePeriod, 8, 2e-15,
    'display timing selects one full crank turn');
  near(animationTiming.targetCycleDuration, 2, 0,
    'standard displayed cycle duration');
  assertReadableTiming(animationTiming);

  assert.deepEqual(coordinates, {
    crankRadius: 9.7,
    diskRadius: 10,
    guideCenters: [-13.25, 13.25],
    outputHalfStroke: 8.7,
    stemHalfWidth: 1,
    wristRadius: 0.3,
    yokeEndCenter: 7.25,
    yokeOuterHalfHeight: 3.5,
  });
  near(geometry.crankRadius / geometry.sourceScale, 9.7, 2e-15,
    'scaled crank radius');
  near(geometry.outputHalfStroke / geometry.sourceScale, 8.7, 2e-15,
    'scaled output half-stroke');
  near(geometry.wristRadius / geometry.sourceScale, 0.3, 2e-15,
    'scaled wrist radius');
  near(geometry.diskRadius / geometry.sourceScale, 10, 2e-15,
    'scaled disk radius');
  assert.equal(sourceReference.referenceMovement93.sourceUrl,
    'https://507movements.com/mm_093.html');
  assert.match(sourceReference.referenceMovement93.difference,
    /straight transverse slot/);
  assert.match(sourceReference.referenceMovement93.difference,
    /sinusoidal Scotch-yoke output/);
  assert.match(transmission.construction, /circular wrist position/);
  assert.match(transmission.construction, /triangular crosshead displacement/);
  assert.match(transmission.grooveEquation,
    /x=-r sin\(2\*pi\*p\)/);
  assert.match(transmission.outputLaw, /linear in crank phase/);
  assert.match(transmission.idealReversal, /changes sign instantaneously/);
  disposeModel(model.root);
});

test('movement 354 output position is exactly linear on every half-turn', () => {
  const model = createMovementModel(catalog.movements[353]);
  const data = model.root.userData;
  const { geometry, stateAtPhase } = data;
  const { outputHalfStroke, inputAngularSpeed, fullTurn } = geometry;
  const constantSpeed = 2 * outputHalfStroke * inputAngularSpeed / Math.PI;

  const samples = [
    [0, 1],
    [0.0625, 0.75],
    [0.125, 0.5],
    [0.1875, 0.25],
    [0.25, 0],
    [0.3125, -0.25],
    [0.375, -0.5],
    [0.4375, -0.75],
    [0.5, -1],
    [0.5625, -0.75],
    [0.625, -0.5],
    [0.6875, -0.25],
    [0.75, 0],
    [0.8125, 0.25],
    [0.875, 0.5],
    [0.9375, 0.75],
    [1, 1],
  ];
  for (const [phase, fraction] of samples) {
    const state = stateAtPhase(phase);
    near(state.outputDisplacement, fraction * outputHalfStroke, 2e-15,
      `linear displacement at phase ${phase}`);
    near(Math.abs(state.outputVelocity.y), constantSpeed, 2e-15,
      `constant output speed at phase ${phase}`);
    near(state.outputVelocity.x, 0, 0,
      `no lateral output speed at phase ${phase}`);
    near(state.outputAcceleration.length(), 0, 0,
      `zero between-reversal acceleration at phase ${phase}`);
    near(state.guideCenterlineError, 0, 0,
      `pure translation at phase ${phase}`);
    near(state.yokeRotation, 0, 0,
      `nonrotating yoke at phase ${phase}`);
  }

  const differenceStep = 1e-7;
  for (const phase of [0.07, 0.19, 0.31, 0.44, 0.57, 0.69, 0.81, 0.94]) {
    const previous = stateAtPhase(phase - differenceStep);
    const next = stateAtPhase(phase + differenceStep);
    const finiteDifference = (
      next.outputDisplacement - previous.outputDisplacement
    ) / (2 * differenceStep);
    const state = stateAtPhase(phase);
    near(
      finiteDifference,
      state.outputVelocity.y * fullTurn / inputAngularSpeed,
      5e-9,
      `linear-law derivative at phase ${phase}`,
    );
  }
  disposeModel(model.root);
});

test('movement 354 exposes the two ideal instantaneous velocity reversals', () => {
  const model = createMovementModel(catalog.movements[353]);
  const { geometry, stateAtPhase } = model.root.userData;
  const speed = 2 * geometry.outputHalfStroke
    * geometry.inputAngularSpeed / Math.PI;
  const epsilon = 1e-8;

  const upper = stateAtPhase(0);
  assert.equal(upper.atReversal, true);
  assert.equal(upper.atUpperReversal, true);
  assert.equal(upper.atLowerReversal, false);
  assert.equal(upper.stage, 'upper-instantaneous-reversal');
  near(upper.incomingOutputVelocity, speed, 2e-15,
    'upper incoming speed');
  near(upper.outgoingOutputVelocity, -speed, 2e-15,
    'upper outgoing speed');
  near(upper.velocityJumpAtReversal, 2 * speed, 2e-15,
    'upper velocity jump magnitude');
  near(stateAtPhase(1 - epsilon).outputVelocity.y, speed, 2e-15,
    'upper approach speed');
  near(stateAtPhase(epsilon).outputVelocity.y, -speed, 2e-15,
    'upper departure speed');

  const lower = stateAtPhase(0.5);
  assert.equal(lower.atReversal, true);
  assert.equal(lower.atUpperReversal, false);
  assert.equal(lower.atLowerReversal, true);
  assert.equal(lower.stage, 'lower-instantaneous-reversal');
  near(lower.incomingOutputVelocity, -speed, 2e-15,
    'lower incoming speed');
  near(lower.outgoingOutputVelocity, speed, 2e-15,
    'lower outgoing speed');
  near(stateAtPhase(0.5 - epsilon).outputVelocity.y, -speed, 2e-15,
    'lower approach speed');
  near(stateAtPhase(0.5 + epsilon).outputVelocity.y, speed, 2e-15,
    'lower departure speed');
  assert.match(model.root.userData.transmission.idealReversal,
    /historical idealization/);
  disposeModel(model.root);
});

test('movement 354 wrist follows the derived endless groove exactly', () => {
  const model = createMovementModel(catalog.movements[353]);
  const data = model.root.userData;
  const {
    crankRadius,
    grooveHalfWidth,
    grooveRunningClearance,
    outputHalfStroke,
    wristRadius,
    yokeEndCenter,
    yokeOuterHalfHeight,
  } = data.geometry;

  const canonical = [
    [0, new THREE.Vector2(0, crankRadius - outputHalfStroke)],
    [0.25, new THREE.Vector2(-crankRadius, 0)],
    [0.5, new THREE.Vector2(0, -crankRadius + outputHalfStroke)],
    [0.75, new THREE.Vector2(crankRadius, 0)],
    [1, new THREE.Vector2(0, crankRadius - outputHalfStroke)],
  ];
  for (const [phase, expected] of canonical) {
    vector2Near(data.grooveCenterAtPhase(phase), expected, 2e-15,
      `canonical groove point ${phase}`);
  }

  for (let index = 0; index <= 4096; index += 1) {
    const phase = index / 4096;
    const state = data.stateAtPhase(phase);
    const expectedGrooveCenter = data.grooveCenterAtPhase(phase);
    vector2Near(state.relativePinPosition, expectedGrooveCenter, 2e-15,
      `wrist center lies on groove ${phase}`);
    near(state.grooveCenterError, 0, 2e-15,
      `groove center error ${phase}`);
    near(state.pinOrbitError, 0, 9e-16,
      `circular wrist orbit ${phase}`);
    near(state.relativeVelocityConstraintError, 0, 9e-16,
      `groove tangent velocity ${phase}`);
    near(state.grooveTangent.length(), 1, 3e-16,
      `unit groove tangent ${phase}`);
    near(state.grooveNormal.length(), 1, 3e-16,
      `unit groove normal ${phase}`);
    near(state.grooveTangent.dot(state.grooveNormal), 0, 3e-16,
      `orthogonal groove frame ${phase}`);
    near(state.leftWallGap, grooveRunningClearance, 7e-16,
      `left running clearance ${phase}`);
    near(state.rightWallGap, grooveRunningClearance, 7e-16,
      `right running clearance ${phase}`);

    const localX = Math.abs(expectedGrooveCenter.x);
    const allowedHalfHeight = localX <= yokeEndCenter
      ? yokeOuterHalfHeight
      : Math.sqrt(
        yokeOuterHalfHeight ** 2 - (localX - yokeEndCenter) ** 2,
      );
    assert.ok(
      Math.abs(expectedGrooveCenter.y) + grooveHalfWidth
        < allowedHalfHeight,
      `groove remains inside crosshead plate at phase ${phase}`,
    );
  }
  near(grooveHalfWidth - wristRadius, grooveRunningClearance, 2e-18,
    'groove width is wrist radius plus running clearance');
  disposeModel(model.root);
});

test('movement 354 renderer binds disk, wrist, crosshead, and fixed guides', () => {
  const model = createMovementModel(catalog.movements[353]);
  const data = model.root.userData;
  const { blocks, contacts, geometry } = data;

  for (const phase of [0, 0.125, 0.25, 0.5, 0.625, 0.75, 0.999]) {
    const time = timeAtPhase(data, phase);
    const state = data.stateAtPhase(phase);
    model.update(time);
    model.root.updateMatrixWorld(true);

    near(blocks.inputRotor.rotation.z, phase * geometry.fullTurn, 2e-15,
      `rendered disk angle ${phase}`);
    vector3Near(blocks.yoke.position, state.outputPosition, 2e-15,
      `rendered crosshead position ${phase}`);
    near(blocks.yoke.rotation.z, 0, 0,
      `rendered crosshead does not rotate ${phase}`);
    // Compare in model coordinates: the presentation mirrors depth.
    vector3Near(
      model.root.worldToLocal(
        blocks.crankWrist.getWorldPosition(new THREE.Vector3())),
      state.pinPosition,
      4e-15,
      `rendered crank wrist ${phase}`,
    );

    const renderedGroovePoint = new THREE.Vector3(
      state.grooveCenter.x,
      state.grooveCenter.y,
      geometry.grooveFaceZ,
    ).applyMatrix4(blocks.yoke.matrixWorld);
    near(renderedGroovePoint.x, state.pinPosition.x, 2e-15,
      `rendered groove x contact ${phase}`);
    near(renderedGroovePoint.y, state.pinPosition.y, 2e-15,
      `rendered groove y contact ${phase}`);
    near(contacts.crankWristGroove.centerError, 0, 2e-15,
      `reported groove contact ${phase}`);
    near(contacts.crankWristGroove.velocityConstraintError, 0, 9e-16,
      `reported tangent constraint ${phase}`);
    near(contacts.stemGuides.centerlineError, 0, 0,
      `reported guide centerline ${phase}`);
    near(contacts.stemGuides.rotationError, 0, 0,
      `reported guide rotation ${phase}`);
  }

  assert.ok(geometry.wristFrontZ > geometry.yokeFrontZ,
    'wrist cap projects visibly in front of the moving crosshead');
  assert.ok(geometry.diskFrontZ < geometry.yokePlaneZ,
    'disk lies beyond the crosshead; the presentation mirror turns it to the front as Brown draws');
  let meshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  // Presentation removes supports, bearing and white indices; guide bridges and the disk rim are added.
  assert.ok(meshCount >= 22);
  disposeModel(model.root);
});

test('movement 354 closes one turn, differs from Scotch yoke 93, and leaves 364 authored', () => {
  const model = createMovementModel(catalog.movements[353]);
  const data = model.root.userData;
  const start = data.stateAtTime(0);
  const finish = data.stateAtTime(data.geometry.inputCyclePeriod);
  near(finish.driverAngle - start.driverAngle, data.geometry.fullTurn,
    2e-15, 'one input turn');
  near(finish.driverPhase, start.driverPhase, 2e-15,
    'driver phase closure');
  vector3Near(finish.pinPosition, start.pinPosition, 3e-15,
    'wrist orbit closure');
  vector3Near(finish.outputPosition, start.outputPosition, 3e-15,
    'crosshead closure');
  vector3Near(finish.outputVelocity, start.outputVelocity, 3e-15,
    'constant-speed branch closure');
  assert.equal(finish.stage, start.stage);

  const scotchYoke = createMovementModel(catalog.movements[92]);
  assert.equal(catalog.movements[92].id, 93);
  assert.equal(catalog.movements[92].archetype,
    'vertical-stroke-horizontal-slot-scotch-yoke');
  assert.notEqual(scotchYoke.root.userData.archetype,
    model.root.userData.archetype);
  const scotchAtZero = scotchYoke.root.userData.stateAtDriverAngle(0);
  const scotchAtQuarter = scotchYoke.root.userData.stateAtDriverAngle(
    Math.PI / 2,
  );
  assert.ok(Math.abs(scotchAtZero.outputVelocity.y) > 0.1);
  near(scotchAtQuarter.outputVelocity.y, 0, 1e-15,
    'movement 93 has zero output speed at dead center');
  near(Math.abs(data.stateAtPhase(0.25).outputVelocity.y),
    data.stateAtPhase(0.125).constantOutputSpeedMagnitude, 2e-15,
    'movement 354 retains full output speed at its midpoint');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(scotchYoke.root);
  disposeModel(model.root);
});
