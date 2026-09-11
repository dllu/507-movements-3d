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
  'orthogonal-pin-guided-slide-valve-rod-with-one-third-roller-in-vertically-adjustable-captured-coupler-locus-arcs';

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

test('movement 418 is one slide valve A, one rod B, one roller C, and exactly two suspended guide arcs D', () => {
  const movement = catalog.movements[417];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 418);
  assert.equal(movement.number, '418');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /Valve A.*slide horizontally/);
  assert.match(data.mechanism, /Constant-length rod B/);
  assert.match(data.mechanism, /Roller C.*one-third/);
  assert.match(data.mechanism, /two vertically adjustable suspended guides D/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.guideHeightConfigurationSettings, 1);
  assert.equal(degreesOfFreedom.rodAngleIndependent, false);
  assert.equal(degreesOfFreedom.rollerCenterIndependent, false);
  assert.equal(degreesOfFreedom.upperPinHeightIndependent, false);
  assert.equal(blocks.valveA.parent, model.root);
  assert.equal(blocks.rodB.parent, model.root);
  assert.equal(blocks.rollerC.parent, model.root);
  assert.equal(blocks.upperArcD.parent, blocks.guideAssemblyD);
  assert.equal(blocks.lowerArcD.parent, blocks.guideAssemblyD);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.filter((role) =>
    role.endsWith('coupler-locus-arc-D')).length, 2);
  for (const role of [
    'horizontally-sliding-valve-A',
    'fixed-horizontal-valve-seat',
    'constant-length-relieving-rod-B',
    'roller-C-fixed-one-third-along-rod-B',
    'roller-C-body-captured-between-arcs-D',
    'upper-captured-coupler-locus-arc-D',
    'lower-load-bearing-coupler-locus-arc-D',
    'fixed-vertical-slot-for-upper-B-pin',
    'vertical-adjustment-screw-for-arcs-D',
    'white-roller-C-rotation-index',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 418 records Brown’s constraints and the official Canvas one-third construction without inventing source dimensions', () => {
  const movement = catalog.movements[417];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, geometry, sourceAnimation, sourceReference } = data;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate418;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_418.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Valve, A.*slide horizontally/);
  assert.match(movement.description, /Upper end of rod, B.*vertical slots/);
  assert.match(movement.description, /roller, C.*two suspended and vertically adjustable arcs, D/);
  assert.match(movement.description, /relieve it of friction/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.officialCanvasCyclePeriod, 4);
  assert.equal(sourceAnimation.officialCanvasCyclesPerMinute, 15);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(geometry.rollerFraction, 1 / 3);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(
    dynamics.clearanceComplianceSteamPressureLoadsAndBearingFrictionModeled,
    false,
  );
  assert.match(dynamics.loadPath, /lower arc reacts.*downward load/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.valveAApproximateBoundsPixels,
    [193, 384, 328, 457]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.officialCanvasEvidence,
    /9\.75-unit B rod.*3\.25 units.*lower pin/);
  assert.match(evidence.reconstructionDisclosure,
    /Brown gives no dimensions.*guide-curve equation/);
  disposeModel(model.root);
});

test('movement 418 orthogonal endpoint guides and exact square-root closure preserve rod B throughout', () => {
  const model = createMovementModel(catalog.movements[417]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let maximumLengthResidual = 0;

  for (let sample = -60000; sample <= 120000; sample += 1) {
    const state = stateAtInputAngle(Math.PI * 2 * sample / 60000);
    near(state.lowerPin.x, state.valveX, 0, 'lower pin follows valve x');
    near(state.lowerPin.y, geometry.valvePinY, 0,
      'lower pin stays on horizontal guide');
    near(state.upperPin.x, geometry.upperPinGuideX, 0,
      'upper pin stays on vertical guide');
    near(state.upperPin.y, geometry.valvePinY + Math.sqrt(
      geometry.rodLength ** 2 - state.valveX ** 2,
    ), 0, 'upper pin square-root law');
    maximumLengthResidual = Math.max(maximumLengthResidual,
      Math.abs(state.rodLengthResidual));
  }
  assert.ok(maximumLengthResidual < 5e-16);
  disposeModel(model.root);
});

test('movement 418 roller C remains exactly one-third along B and centered between the two exact D guide loci', () => {
  const model = createMovementModel(catalog.movements[417]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let maximumLocusResidual = 0;

  for (let sample = 0; sample <= 80000; sample += 1) {
    const state = stateAtInputAngle(Math.PI * 2 * sample / 80000);
    const expectedCenter = state.lowerPin.clone().lerp(
      state.upperPin,
      geometry.rollerFraction,
    );
    vectorNear(state.rollerCenter, expectedCenter, 0,
      'C is fixed one-third along B');
    maximumLocusResidual = Math.max(maximumLocusResidual,
      Math.abs(state.guideCenterLocusResidual));
    near(state.guideTangent.length(), 1, 3e-16,
      'guide unit tangent');
    near(state.guideNormal.length(), 1, 3e-16,
      'guide unit normal');
    near(state.guideTangent.dot(state.guideNormal), 0, 3e-17,
      'guide tangent-normal orthogonality');
    near(state.guideLowerCenterline.distanceTo(state.rollerCenter),
      geometry.guideCenterlineOffset, 1.2e-16,
      'lower D centerline offset');
    near(state.guideUpperCenterline.distanceTo(state.rollerCenter),
      geometry.guideCenterlineOffset, 1.2e-16,
      'upper D centerline offset');
    near(state.lowerGuideSurfaceGap, geometry.guideClearance, 1.5e-16,
      'lower running clearance');
    near(state.upperGuideSurfaceGap, geometry.guideClearance, 1.5e-16,
      'upper running clearance');
  }
  assert.ok(maximumLocusResidual < 1.2e-16);
  disposeModel(model.root);
});

test('movement 418 differentiated rod law satisfies velocity and acceleration constraints', () => {
  const model = createMovementModel(catalog.movements[417]);
  const { stateAtInputAngle } = model.root.userData;
  let maximumVelocityResidual = 0;
  let maximumAccelerationResidual = 0;

  for (let sample = -60000; sample <= 120000; sample += 1) {
    const state = stateAtInputAngle(Math.PI * 2 * sample / 60000);
    maximumVelocityResidual = Math.max(maximumVelocityResidual,
      Math.abs(state.rodVelocityConstraintResidual));
    maximumAccelerationResidual = Math.max(maximumAccelerationResidual,
      Math.abs(state.rodAccelerationConstraintResidual));
    vectorNear(state.lowerPinVelocity,
      new THREE.Vector3(state.valveSpeed, 0, 0), 0,
      'lower pin horizontal velocity');
    vectorNear(state.upperPinVelocity,
      new THREE.Vector3(0, state.upperPinSpeed, 0), 0,
      'upper pin vertical velocity');
    vectorNear(state.lowerPinAcceleration,
      new THREE.Vector3(state.valveAcceleration, 0, 0), 0,
      'lower pin horizontal acceleration');
    vectorNear(state.upperPinAccelerationVector,
      new THREE.Vector3(0, state.upperPinAcceleration, 0), 0,
      'upper pin vertical acceleration');
  }
  assert.ok(maximumVelocityResidual < 6e-17);
  assert.ok(maximumAccelerationResidual < 9e-16);
  disposeModel(model.root);
});

test('movement 418 roller spin is integrated from exact guide-path travel and has no slip on the load-bearing D rail', () => {
  const model = createMovementModel(catalog.movements[417]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let maximumSlipResidual = 0;

  for (let sample = -40000; sample <= 80000; sample += 1) {
    const state = stateAtInputAngle(Math.PI * 2 * sample / 40000);
    maximumSlipResidual = Math.max(maximumSlipResidual,
      Math.abs(state.rollerNoSlipResidual));
    near(state.rollerAngle,
      -state.rollerPathLength / geometry.rollerRadius, 0,
      'integrated roller angle');
    near(state.rollerAngularSpeed * geometry.rollerRadius,
      -state.signedPathSpeed, 1.2e-16, 'rolling speed');
    near(state.rollerAngularAcceleration * geometry.rollerRadius,
      -state.signedPathAcceleration, 1.2e-16, 'rolling acceleration');
  }
  assert.ok(maximumSlipResidual < 1.2e-16);
  near(stateAtInputAngle(0).rollerAngle, 0, 0,
    'zero-reference roller angle');
  near(Math.abs(stateAtInputAngle(Math.PI / 2).rollerAngularSpeed),
    0, 3e-16, 'right reversal rolling speed');
  near(Math.abs(stateAtInputAngle(Math.PI * 3 / 2).rollerAngularSpeed),
    0, 9e-16, 'left reversal rolling speed');
  disposeModel(model.root);
});

test('movement 418 analytic endpoint, coupler, and roller derivatives match finite differences', () => {
  const model = createMovementModel(catalog.movements[417]);
  const { stateAtInputAngle } = model.root.userData;
  const angleStep = 1e-5;

  for (const angle of [0.16, 0.58, 1.13, 1.91, 2.55, 3.31, 4.04,
    4.77, 5.43, 6.08]) {
    const state = stateAtInputAngle(angle);
    const timeStep = angleStep / state.inputSpeed;
    const before = stateAtInputAngle(angle - angleStep);
    const after = stateAtInputAngle(angle + angleStep);
    const numericalUpperSpeed = (after.upperPin.y - before.upperPin.y)
      / (2 * timeStep);
    const numericalUpperAcceleration = (
      after.upperPinSpeed - before.upperPinSpeed
    ) / (2 * timeStep);
    const numericalRollerVelocity = after.rollerCenter.clone()
      .sub(before.rollerCenter)
      .multiplyScalar(1 / (2 * timeStep));
    const numericalRollerAngularSpeed = (
      after.rollerAngle - before.rollerAngle
    ) / (2 * timeStep);
    near(numericalUpperSpeed, state.upperPinSpeed, 2e-10,
      `upper pin speed at ${angle}`);
    near(numericalUpperAcceleration, state.upperPinAcceleration, 5e-10,
      `upper pin acceleration at ${angle}`);
    vectorNear(numericalRollerVelocity, state.rollerCenterVelocity, 2e-10,
      `roller center velocity at ${angle}`);
    near(numericalRollerAngularSpeed, state.rollerAngularSpeed, 5e-10,
      `roller angular speed at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 418 reaches smooth valve reversals and closes its four-second authored cycle', () => {
  const model = createMovementModel(catalog.movements[417]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  const center = stateAtTime(0);
  const right = stateAtTime(geometry.cycleDuration / 4);
  const centerReturn = stateAtTime(geometry.cycleDuration / 2);
  const left = stateAtTime(geometry.cycleDuration * 3 / 4);
  const closure = stateAtTime(geometry.cycleDuration);

  near(center.valveX, 0, 0, 'initial valve center');
  near(right.valveX, geometry.valveAmplitude, 0, 'right valve extreme');
  near(right.valveSpeed, 0, 1e-16, 'right reversal speed');
  near(centerReturn.valveX, 0, 2e-16, 'return through center');
  near(left.valveX, -geometry.valveAmplitude, 0, 'left valve extreme');
  near(left.valveSpeed, 0, 3e-16, 'left reversal speed');
  near(closure.valveX, center.valveX, 0, 'valve cycle closure');
  vectorNear(closure.upperPin, center.upperPin, 0,
    'upper pin cycle closure');
  sameAngle(closure.rollerAngle, center.rollerAngle, 0,
    'roller cycle closure');
  assert.equal(data.animationTiming.authoredCyclePeriod,
    geometry.cycleDuration);
  assert.equal(data.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 418 guide-height adjustment remains a stationary configuration while operating members update from one state', () => {
  const model = createMovementModel(catalog.movements[417]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const initialGuidePosition = blocks.guideAssemblyD.position.clone();

  assert.deepEqual(geometry.guideAdjustmentRange, [-0.26, 0.26]);
  near(initialGuidePosition.y, geometry.guideAdjustmentY, 0,
    'neutral D height');
  for (const time of [0, 0.37, 0.94, 1.41, 2.08, 2.83, 3.52, 4.77]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.valveA.position.x, state.valveX, 0,
      'valve A update');
    near(blocks.upperPinSlider.position.x, geometry.upperPinGuideX, 0,
      'upper B pin x update');
    near(blocks.upperPinSlider.position.y, state.upperPin.y, 0,
      'upper B pin y update');
    near(blocks.rodB.scale.y, geometry.rodLength, 5e-16,
      'rendered B length');
    vectorNear(blocks.rollerC.position, state.rollerCenter, 0,
      'roller C center update');
    sameAngle(blocks.rollerC.rotation.z, state.rollerAngle, 0,
      'roller C spin update');
    vectorNear(blocks.guideAssemblyD.position, initialGuidePosition, 0,
      'D height is not an operating animation');
  }
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 418 valve-relief geometry', () => {
  const movement418 = catalog.movements[417];
  const movement507 = catalog.movements[506];
  const model418 = createMovementModel(movement418);
  const model507 = createMovementModel(movement507);

  assert.equal(movement418.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model418.root);
  disposeModel(model507.root);
});
