import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const ARCHETYPE =
  'fixed-annular-sector-cylinder-with-radial-vane-piston-keyed-to-rockshaft-and-quadrature-slide-valve';
const FULL_TURN = Math.PI * 2;

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function sameAngle(actual, expected, tolerance, message) {
  near(Math.sin(actual), Math.sin(expected), tolerance, `${message} sine`);
  near(Math.cos(actual), Math.cos(expected), tolerance, `${message} cosine`);
}

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 422 is one fixed sector cylinder A, radial vane B keyed to rock-shaft C, and horizontal slide-valve D', () => {
  const movement = catalog.movements[421];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 422);
  assert.equal(movement.number, '422');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /Fixed cylinder A is an annular sector/);
  assert.match(data.mechanism, /Radial vane piston B is rigidly keyed to C/);
  assert.match(data.mechanism, /slide-valve D runs in exact quadrature/);
  assert.match(data.mechanism, /undrawn downstream rotary linkage is not invented/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.pistonAngleIndependent, false);
  assert.equal(degreesOfFreedom.slideValvePositionIndependent, false);
  assert.equal(blocks.cylinderA.parent, model.root);
  assert.equal(blocks.rockshaftRotor.parent, model.root);
  assert.equal(blocks.pistonVane.parent, blocks.rockshaftRotor);
  assert.equal(blocks.pistonSeal.parent, blocks.rockshaftRotor);
  assert.equal(blocks.shaftC.parent, blocks.rockshaftRotor);
  assert.equal(blocks.outputCrankArm.parent, blocks.rockshaftRotor);
  assert.equal(blocks.slideValveD.parent, model.root);
  assert.equal(blocks.valveBlock.parent, blocks.slideValveD);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'fixed-annular-sector-cylinder-A',
    'inner-curved-wall-of-sector-cylinder-A',
    'outer-curved-wall-of-sector-cylinder-A',
    'radial-oscillating-piston-B',
    'outer-sealing-head-of-piston-B',
    'fixed-axis-rock-shaft-C',
    'horizontally-reciprocating-slide-valve-D',
    'clockwise-steam-passage-from-D-to-A',
    'counterclockwise-steam-passage-from-D-to-A',
    'output-crank-on-C-for-connection-to-rotary-train',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 422 records Brown’s A–D construction and the official Canvas endpoint and quadrature evidence', () => {
  const movement = catalog.movements[421];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate422;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_422.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /profile of the cylinder A.*sector/);
  assert.match(movement.description, /piston, B, is attached to a rock-shaft, C/);
  assert.match(movement.description, /one and the other side of piston alternately/);
  assert.match(movement.description, /slide-valve, D/);
  assert.match(movement.description, /rock-shaft is connected with a crank/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.officialCanvasCyclePeriod, 4);
  assert.equal(sourceAnimation.officialCanvasCyclesPerMinute, 15);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(dynamics.downstreamCrankLinkAndFlywheelModeled, false);
  assert.equal(
    dynamics.pressureExpansionLeakageFrictionInertiaAndValveLapModeled,
    false,
  );
  assert.match(dynamics.valveIndicators, /not pressure or mass-flow solutions/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.rockshaftCApproximateCenterPixels, [264, 440]);
  assert.deepEqual(plate.slideValveDApproximateBoundsPixels,
    [212, 87, 415, 174]);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.officialCanvasEvidence,
    /endpoint vectors.*1\.953656,4\.602524/);
  assert.match(evidence.officialCanvasEvidence, /one quarter-cycle ahead/);
  assert.match(evidence.reconstructionDisclosure,
    /no absolute dimensions.*sealing clearances.*port areas/);
  disposeModel(model.root);
});

test('movement 422 B remains within sector A with exact constant radial seal and positive end clearances', () => {
  const model = createMovementModel(catalog.movements[421]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let minimumLeftClearance = Infinity;
  let minimumRightClearance = Infinity;

  for (let sample = -60000; sample <= 120000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 60000);
    assert.ok(state.pistonAngle > geometry.sectorRightAngle);
    assert.ok(state.pistonAngle < geometry.sectorLeftAngle);
    minimumLeftClearance = Math.min(minimumLeftClearance,
      state.angularLeftClearance);
    minimumRightClearance = Math.min(minimumRightClearance,
      state.angularRightClearance);
    near(state.radialSealClearance,
      geometry.outerCylinderRadius - geometry.pistonSealRadius, 0,
      'constant radial clearance');
    near(state.pistonTip.distanceTo(geometry.rockshaftCenter),
      geometry.pistonSealRadius, 5e-16, 'vane-tip radius');
  }
  near(minimumLeftClearance, geometry.angularEndClearance, 1.2e-16,
    'left end clearance');
  near(minimumRightClearance, geometry.angularEndClearance, 1.2e-16,
    'right end clearance');
  assert.ok(geometry.angularEndClearance > 0);
  assert.ok(geometry.radialSealClearance > 0);
  disposeModel(model.root);
});

test('movement 422 harmonic piston law reaches the official right/left poses and returns over one cycle', () => {
  const model = createMovementModel(catalog.movements[421]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const right = stateAtInputAngle(0);
  const middleUp = stateAtInputAngle(Math.PI / 2);
  const left = stateAtInputAngle(Math.PI);
  const middleDown = stateAtInputAngle(Math.PI * 3 / 2);
  const closure = stateAtInputAngle(FULL_TURN);

  near(right.pistonAngle,
    geometry.pistonCenterAngle - geometry.pistonAngularAmplitude, 0,
    'right source pose');
  near(left.pistonAngle,
    geometry.pistonCenterAngle + geometry.pistonAngularAmplitude, 0,
    'left pose');
  near(left.pistonAngle - right.pistonAngle,
    geometry.pistonAngularStroke, 1.2e-16, 'full angular stroke');
  near(middleUp.pistonAngle, geometry.pistonCenterAngle, 0,
    'outbound center crossing');
  assert.ok(middleUp.pistonAngularSpeed > 0);
  near(middleDown.pistonAngle, geometry.pistonCenterAngle, 0,
    'return center crossing');
  assert.ok(middleDown.pistonAngularSpeed < 0);
  near(Math.abs(right.pistonAngularSpeed), 0, 0,
    'right reversal speed');
  near(Math.abs(left.pistonAngularSpeed), 0, 8e-17,
    'left reversal speed');
  near(closure.pistonAngle, right.pistonAngle, 0,
    'cycle closure');
  disposeModel(model.root);
});

test('movement 422 rigid vane-tip kinematics and derivatives remain exact through both half-strokes', () => {
  const model = createMovementModel(catalog.movements[421]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = 0; sample <= 80000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 80000);
    const radial = state.pistonTip.clone().sub(geometry.rockshaftCenter);
    near(radial.length(), geometry.pistonSealRadius, 5e-16,
      'tip orbit radius');
    near(radial.dot(state.pistonTipVelocity), 0, 5e-16,
      'tip tangential velocity');
    near(radial.dot(state.pistonTipAcceleration)
      + state.pistonTipVelocity.lengthSq(), 0, 2e-15,
      'tip acceleration constraint');
  }
  disposeModel(model.root);
});

test('movement 422 slide-valve D stays in quadrature and selects only the pressure side that drives B', () => {
  const model = createMovementModel(catalog.movements[421]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  const rightReversal = stateAtInputAngle(0);
  const counterclockwiseStroke = stateAtInputAngle(Math.PI / 2);
  const leftReversal = stateAtInputAngle(Math.PI);
  const clockwiseStroke = stateAtInputAngle(Math.PI * 3 / 2);
  near(rightReversal.valveX, 0, 0, 'right-reversal valve lap');
  near(leftReversal.valveX, 0, 4e-17, 'left-reversal valve lap');
  near(counterclockwiseStroke.valveX, -geometry.valveTravelAmplitude, 0,
    'counterclockwise-stroke valve extreme');
  near(clockwiseStroke.valveX, geometry.valveTravelAmplitude, 0,
    'clockwise-stroke valve extreme');
  assert.equal(counterclockwiseStroke.admissionSide,
    'clockwise-side-of-B');
  assert.equal(counterclockwiseStroke.exhaustSide,
    'counterclockwise-side-of-B');
  assert.equal(counterclockwiseStroke.clockwisePortOpening, 1);
  assert.equal(counterclockwiseStroke.counterclockwisePortOpening, 0);
  assert.equal(clockwiseStroke.admissionSide,
    'counterclockwise-side-of-B');
  assert.equal(clockwiseStroke.exhaustSide,
    'clockwise-side-of-B');
  assert.equal(clockwiseStroke.clockwisePortOpening, 0);
  assert.equal(clockwiseStroke.counterclockwisePortOpening, 1);

  for (let sample = 0; sample <= 100000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 100000);
    near(state.valvePhaseConstraintResidual, 0, 0,
      'valve quadrature residual');
    assert.ok(state.clockwisePortOpening === 0
      || state.counterclockwisePortOpening === 0);
    near(state.portOpeningSum, Math.abs(Math.sin(state.inputAngle)), 0,
      'complementary port magnitude');
    if (Math.abs(state.pistonAngularSpeed) > 1e-10) {
      assert.equal(Math.sign(state.valveX),
        -Math.sign(state.pistonAngularSpeed));
    }
  }
  disposeModel(model.root);
});

test('movement 422 analytic piston and valve derivatives match finite differences', () => {
  const model = createMovementModel(catalog.movements[421]);
  const { stateAtInputAngle } = model.root.userData;
  const angleStep = 1e-5;

  for (const angle of [0.13, 0.55, 1.12, 1.71, 2.38, 3.04, 3.68,
    4.31, 4.96, 5.61, 6.08]) {
    const state = stateAtInputAngle(angle);
    const timeStep = angleStep / state.inputSpeed;
    const before = stateAtInputAngle(angle - angleStep);
    const after = stateAtInputAngle(angle + angleStep);
    const numericalPistonSpeed = (
      after.pistonAngle - before.pistonAngle
    ) / (2 * timeStep);
    const numericalPistonAcceleration = (
      after.pistonAngularSpeed - before.pistonAngularSpeed
    ) / (2 * timeStep);
    const numericalValveSpeed = (after.valveX - before.valveX)
      / (2 * timeStep);
    const numericalTipVelocity = after.pistonTip.clone()
      .sub(before.pistonTip)
      .multiplyScalar(1 / (2 * timeStep));
    near(numericalPistonSpeed, state.pistonAngularSpeed, 2e-10,
      `piston speed at ${angle}`);
    near(numericalPistonAcceleration, state.pistonAngularAcceleration,
      3e-10, `piston acceleration at ${angle}`);
    near(numericalValveSpeed, state.valveSpeed, 2e-10,
      `valve speed at ${angle}`);
    vectorNear(numericalTipVelocity, state.pistonTipVelocity, 5e-10,
      `vane-tip velocity at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 422 output crank is rigidly keyed to C rather than independently rotating', () => {
  const model = createMovementModel(catalog.movements[421]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = -30000; sample <= 60000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 30000);
    near(state.outputCrankAngle - state.pistonAngle,
      geometry.outputCrankOffset, 2.3e-16,
      'fixed crank-to-vane angle');
    near(state.outputCrankPin.distanceTo(geometry.rockshaftCenter),
      geometry.outputCrankRadius, 2.3e-16,
      'output crank radius');
    near(state.outputCrankAngularSpeed, state.pistonAngularSpeed, 0,
      'shared C angular speed');
    near(state.outputCrankAngularAcceleration,
      state.pistonAngularAcceleration, 0,
      'shared C angular acceleration');
  }
  disposeModel(model.root);
});

test('movement 422 update binds B/C rocking, D translation, port indication, and output crank to one state', () => {
  const model = createMovementModel(catalog.movements[421]);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.38, 0.91, 1.43, 2.06, 2.72, 3.31, 3.84,
    4.45]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.rockshaftRotor.rotation.z, state.pistonAngle, 0,
      'B/C rocking update');
    near(blocks.slideValveD.position.x,
      geometry.valveCenter.x + state.valveX, 0,
      'D translation update');
    near(blocks.slideValveD.position.y, geometry.valveCenter.y, 0,
      'D horizontal guide');
    near(blocks.clockwiseAdmissionIndicator.scale.x,
      0.55 + 0.75 * state.clockwisePortOpening, 0,
      'clockwise port update');
    near(blocks.counterclockwiseAdmissionIndicator.scale.x,
      0.55 + 0.75 * state.counterclockwisePortOpening, 0,
      'counterclockwise port update');
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  near(closure.pistonAngle, source.pistonAngle, 0,
    'piston cycle closure');
  near(closure.valveX, source.valveX, 0,
    'valve cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.cycleDuration);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 422 single-vane geometry', () => {
  const movement422 = catalog.movements[421];
  const movement507 = catalog.movements[506];
  const model422 = createMovementModel(movement422);
  const model507 = createMovementModel(movement507);

  assert.equal(movement422.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model422.root);
  disposeModel(model507.root);
});
