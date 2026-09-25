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
  'shaft-fast-eccentric-circular-piston-tangent-to-fixed-cylinder-with-cam-lifted-sliding-port-abutment';
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

test('movement 425 is one shaft-fast eccentric piston C in fixed cylinder A with one guided sliding abutment D', () => {
  const movement = catalog.movements[424];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 425);
  assert.equal(movement.number, '425');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /Fixed cylinder A.*central shaft B/);
  assert.match(data.mechanism, /piston C is fast on B/);
  assert.match(data.mechanism, /internally tangent to A at exactly one point/);
  assert.match(data.mechanism, /single abutment D slides only.*vertical/);
  assert.match(data.mechanism, /exact circle-line cam closure/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.eccentricPistonRotationIndependent, false);
  assert.equal(degreesOfFreedom.abutmentVerticalPositionIndependent, false);
  assert.equal(blocks.eccentricPiston.parent, blocks.rotor);
  assert.equal(blocks.sealShoe.parent, blocks.rotor);
  assert.equal(blocks.shaftToEccentricCenter.parent, blocks.rotor);
  assert.equal(blocks.abutmentNose.parent, blocks.abutmentD);
  assert.equal(blocks.abutmentStem.parent, blocks.abutmentD);
  assert.equal(blocks.abutmentD.parent, model.root);
  assert.equal(blocks.shaftB.parent, blocks.rotor);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.filter((role) => role ===
    'single-vertically-sliding-abutment-D-between-induction-and-eduction')
    .length, 1);
  for (const role of [
    'fixed-annular-cutaway-body-of-cylinder-A',
    'central-main-shaft-B',
    'eccentric-piston-C-fast-on-shaft-B',
    'circular-body-of-eccentric-piston-C',
    'outer-sealing-tongue-of-piston-C-that-passes-abutment-D',
    'fixed-vertical-guide-for-sliding-abutment-D',
    'right-round-induction-port-pipe',
    'left-round-eduction-port-pipe',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 425 records Brown’s A–D construction and exact official cam-follower dimensions', () => {
  const movement = catalog.movements[424];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate425;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_425.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /A is the cylinder/);
  assert.match(movement.description, /shaft, B, pass centrally/);
  assert.match(movement.description, /piston, C.*eccentric fast on the shaft/);
  assert.match(movement.description, /contact with the cylinder at one point/);
  assert.match(movement.description, /sliding abutment, D/);
  assert.match(movement.description, /moves out of the way/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.officialCanvasCyclePeriod, 4);
  assert.equal(sourceAnimation.officialCanvasCyclesPerMinute, 15);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(dynamics.pressureExpansionCutoffLeakageFrictionInertiaAndLoadsModeled,
    false);
  assert.match(dynamics.abutmentConstraint, /massless translating cam follower/);
  assert.match(dynamics.portIndicators, /not pressure or mass-flow solutions/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.mainShaftBApproximateCenterPixels, [271, 320]);
  assert.deepEqual(plate.abutmentDApproximateBoundsPixels,
    [258, 43, 301, 255]);
  assert.equal(evidence.explicitInBrownDescription.length, 8);
  assert.match(evidence.officialCanvasEvidence,
    /eccentricity 2.*piston radius 5.*radii 7\/8/);
  assert.match(evidence.officialCanvasEvidence,
    /sealing tongue from radius 6 to 6\.974937/);
  assert.match(evidence.officialCanvasEvidence,
    /rises from y=9\.133975 to 13\.133975/);
  assert.match(evidence.reconstructionDisclosure,
    /no absolute scale.*abutment loading.*pressure cycle/);
  disposeModel(model.root);
});

test('movement 425 preserves every official planar dimension through one uniform source scale', () => {
  const model = createMovementModel(catalog.movements[424]);
  const { geometry } = model.root.userData;

  for (const [scaled, source] of [
    ['eccentricity', 'sourceEccentricity'],
    ['pistonRadius', 'sourcePistonRadius'],
    ['cylinderInnerRadius', 'sourceCylinderInnerRadius'],
    ['cylinderOuterRadius', 'sourceCylinderOuterRadius'],
    ['abutmentNoseRadius', 'sourceAbutmentNoseRadius'],
    ['abutmentLocalNoseCenter', 'sourceAbutmentLocalNoseCenter'],
    ['sealShoeInnerRadius', 'sourceSealShoeInnerRadius'],
    ['sealShoeOuterRadius', 'sourceSealShoeOuterRadius'],
    ['sealShoeHalfWidth', 'sourceSealShoeHalfWidth'],
  ]) near(geometry[scaled], geometry[source] * geometry.sourceScale, 0,
    `${scaled} source scale`);
  near(geometry.eccentricity + geometry.pistonRadius,
    geometry.cylinderInnerRadius, 0,
    'one-point internal tangency dimensions');
  near(geometry.contactCenterDistance,
    geometry.pistonRadius + geometry.abutmentNoseRadius, 0,
    'external follower tangency dimensions');
  near(geometry.passClearance,
    (7 - 6.974937) * geometry.sourceScale, 3.5e-16,
    'official sealing-tongue pass clearance');
  assert.ok(geometry.passClearance > 0);
  disposeModel(model.root);
});

test('movement 425 eccentric piston remains internally tangent to cylinder A at exactly one point', () => {
  const model = createMovementModel(catalog.movements[424]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let maximumTangencyResidual = 0;

  for (let sample = -80000; sample <= 160000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 80000);
    near(state.eccentricCenter.distanceTo(geometry.shaftCenter),
      geometry.eccentricity, 1.2e-16,
      'eccentric-center orbit');
    near(state.pistonCylinderContactPoint.distanceTo(state.eccentricCenter),
      geometry.pistonRadius, 8.9e-16,
      'C radius to cylinder contact');
    near(state.cylinderInnerContactPoint.distanceTo(geometry.shaftCenter),
      geometry.cylinderInnerRadius, 9e-16,
      'A inner radius to contact');
    vectorNear(state.pistonCylinderContactPoint,
      state.cylinderInnerContactPoint, 9e-16,
      'unique common contact point');
    maximumTangencyResidual = Math.max(maximumTangencyResidual,
      Math.abs(state.pistonCylinderTangencyResidual));
  }
  assert.ok(maximumTangencyResidual < 9e-16);
  disposeModel(model.root);
});

test('movement 425 abutment D stays on its guide and exactly tangent to eccentric piston C', () => {
  const model = createMovementModel(catalog.movements[424]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let minimumRadicand = Infinity;
  let maximumCenterResidual = 0;
  let maximumContactResidual = 0;

  for (let sample = -80000; sample <= 160000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 80000);
    near(state.abutmentGuideResidual, 0, 0,
      'D vertical guide');
    near(state.abutmentNoseCenter.x, 0, 0,
      'D nose centerline x');
    near(state.abutmentNoseCenter.distanceTo(state.eccentricCenter),
      geometry.contactCenterDistance, 9e-16,
      'C-to-D center distance');
    near(state.pistonAbutmentContactPoint.distanceTo(state.eccentricCenter),
      geometry.pistonRadius, 1.4e-15,
      'C contact radius');
    near(state.abutmentContactPoint.distanceTo(state.abutmentNoseCenter),
      geometry.abutmentNoseRadius, 5e-16,
      'D nose contact radius');
    vectorNear(state.pistonAbutmentContactPoint,
      state.abutmentContactPoint, 9e-16,
      'shared C-D tangency point');
    minimumRadicand = Math.min(minimumRadicand, state.contactRadicand);
    maximumCenterResidual = Math.max(maximumCenterResidual,
      Math.abs(state.abutmentCenterDistanceResidual));
    maximumContactResidual = Math.max(maximumContactResidual,
      Math.abs(state.pistonAbutmentContactResidual));
  }
  assert.ok(minimumRadicand > 5.64);
  assert.ok(maximumCenterResidual < 9e-16);
  assert.ok(maximumContactResidual < 9e-16);
  disposeModel(model.root);
});

test('movement 425 differentiated eccentric and follower laws satisfy the exact guide and contact derivatives', () => {
  const model = createMovementModel(catalog.movements[424]);
  const { stateAtInputAngle } = model.root.userData;

  for (let sample = -60000; sample <= 120000; sample += 1) {
    const angle = FULL_TURN * sample / 60000;
    const speed = 1.33 + 0.18 * Math.cos(angle * 0.83);
    const acceleration = -0.29 * Math.sin(angle * 0.71);
    const state = stateAtInputAngle(angle, speed, acceleration);
    near(state.abutmentVelocity.x, 0, 0,
      'D velocity follows vertical guide');
    near(state.abutmentAcceleration.x, 0, 0,
      'D acceleration follows vertical guide');
    near(state.eccentricCenter.dot(state.eccentricCenterVelocity),
      0, 4.5e-16, 'eccentric orbit velocity constraint');
    const centerLine = state.abutmentNoseCenter.clone().sub(
      state.eccentricCenter,
    );
    const relativeVelocity = state.abutmentVelocity.clone().sub(
      state.eccentricCenterVelocity,
    );
    const relativeAcceleration = state.abutmentAcceleration.clone().sub(
      state.eccentricCenterAcceleration,
    );
    near(centerLine.dot(relativeVelocity), 0, 3.6e-15,
      'C-D contact velocity constraint');
    near(relativeVelocity.lengthSq()
      + centerLine.dot(relativeAcceleration), 0, 1.6e-14,
      'C-D contact acceleration constraint');
  }
  disposeModel(model.root);
});

test('movement 425 analytic eccentric and abutment derivatives match finite differences', () => {
  const model = createMovementModel(catalog.movements[424]);
  const { stateAtInputAngle } = model.root.userData;
  const angleStep = 1e-5;

  for (const angle of [0.12, 0.54, 1.03, 1.49, 2.01, 2.55, 3.08,
    3.61, 4.16, 4.68, 5.22, 5.76, 6.12]) {
    const state = stateAtInputAngle(angle);
    const timeStep = angleStep / state.inputSpeed;
    const before = stateAtInputAngle(angle - angleStep);
    const after = stateAtInputAngle(angle + angleStep);
    const numericalEccentricVelocity = after.eccentricCenter.clone()
      .sub(before.eccentricCenter)
      .multiplyScalar(1 / (2 * timeStep));
    const numericalEccentricAcceleration = after.eccentricCenterVelocity
      .clone().sub(before.eccentricCenterVelocity)
      .multiplyScalar(1 / (2 * timeStep));
    const numericalAbutmentVelocity = after.abutmentNoseCenter.clone()
      .sub(before.abutmentNoseCenter)
      .multiplyScalar(1 / (2 * timeStep));
    const numericalAbutmentAcceleration = after.abutmentVelocity.clone()
      .sub(before.abutmentVelocity)
      .multiplyScalar(1 / (2 * timeStep));
    vectorNear(numericalEccentricVelocity,
      state.eccentricCenterVelocity, 3e-10,
      `eccentric velocity at ${angle}`);
    vectorNear(numericalEccentricAcceleration,
      state.eccentricCenterAcceleration, 4e-10,
      `eccentric acceleration at ${angle}`);
    vectorNear(numericalAbutmentVelocity,
      state.abutmentVelocity, 1.2e-10,
      `D velocity at ${angle}`);
    vectorNear(numericalAbutmentAcceleration,
      state.abutmentAcceleration, 1.6e-10,
      `D acceleration at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 425 D lifts by four source units and clears the outer piston tongue at the top passage', () => {
  const model = createMovementModel(catalog.movements[424]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const low = stateAtInputAngle(0);
  const high = stateAtInputAngle(Math.PI);

  near(low.abutmentNoseCenter.y,
    4 * geometry.sourceScale, 2.3e-16,
    'low D nose center');
  near(high.abutmentNoseCenter.y,
    8 * geometry.sourceScale, 0,
    'high D nose center');
  near(geometry.abutmentStroke, 4 * geometry.sourceScale, 4.5e-16,
    'four-unit D lift');
  near(low.abutmentSourceGroupY,
    9.133975 * geometry.sourceScale, 4.5e-16,
    'official low source transform');
  near(high.abutmentSourceGroupY,
    13.133975 * geometry.sourceScale, 8.9e-16,
    'official high source transform');
  near(high.sealShoePassVerticalClearance,
    geometry.passClearance, 4.5e-16,
    'tongue clearance below lifted D');
  assert.ok(high.sealShoePassVerticalClearance > 0);
  assert.ok(high.sealShoePassVerticalClearance < 0.011);
  near(Math.abs(low.abutmentVelocity.y), 0, 0,
    'low reversal speed');
  near(Math.abs(high.abutmentVelocity.y), 0, 2.2e-16,
    'high reversal speed');
  disposeModel(model.root);
});

test('movement 425 update rotates C and its sealing tongue together while D follows the exact tangent lift', () => {
  const model = createMovementModel(catalog.movements[424]);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.27, 0.69, 1.13, 1.58, 2.03, 2.49, 2.94,
    3.38, 3.84, 4.29]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.rotor.rotation.z, state.rotorAngle, 1.2e-16,
      'C/shaft rotation update');
    near(blocks.abutmentD.position.x, 0, 0,
      'D guide x update');
    near(blocks.abutmentD.position.y, state.abutmentNoseCenter.y, 0,
      'D lift update');
    near(blocks.abutmentD.position.z, 0, 0,
      'D guide z update');
    near(blocks.pistonAbutmentContactMarker.position.x,
      state.pistonAbutmentContactPoint.x, 0,
      'contact marker x');
    near(blocks.pistonAbutmentContactMarker.position.y,
      state.pistonAbutmentContactPoint.y, 0,
      'contact marker y');
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  vectorNear(closure.eccentricCenter, source.eccentricCenter, 0,
    'eccentric cycle closure');
  vectorNear(closure.abutmentNoseCenter, source.abutmentNoseCenter, 0,
    'D cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.cycleDuration);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 425 moving-abutment geometry', () => {
  const movement425 = catalog.movements[424];
  const movement507 = catalog.movements[506];
  const model425 = createMovementModel(movement425);
  const model507 = createMovementModel(movement507);

  assert.equal(movement425.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model425.root);
  disposeModel(model507.root);
});
