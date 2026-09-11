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
  'vertical-in-line-trunk-engine-slider-crank-with-hollow-piston-trunk-through-head-stuffing-box-and-area-staged-steam';
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

test('movement 421 is one upper crank, one pitman entering one hollow trunk, and a piston/trunk translating through one stuffing box', () => {
  const movement = catalog.movements[420];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 421);
  assert.equal(movement.number, '421');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /upper crank drives one exact in-line slider-crank/);
  assert.match(data.mechanism, /pitman descends inside.*hollow trunk/);
  assert.match(data.mechanism, /pins directly to the piston/);
  assert.match(data.mechanism, /trunk passes through.*stuffing box/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.pistonPositionIndependent, false);
  assert.equal(degreesOfFreedom.pitmanAngleIndependent, false);
  assert.equal(degreesOfFreedom.trunkPositionIndependent, false);
  assert.equal(blocks.crankWheel.parent, model.root);
  assert.equal(blocks.pitman.parent, model.root);
  assert.equal(blocks.pistonAndTrunk.parent, model.root);
  assert.equal(blocks.piston.parent, blocks.pistonAndTrunk);
  assert.equal(blocks.pistonPinMarker.parent, blocks.pistonAndTrunk);
  assert.equal(blocks.trunkBack.parent, blocks.pistonAndTrunk);
  assert.equal(blocks.stuffingBox.parent, blocks.fixedCylinder);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.filter((role) =>
    role === 'cutaway-side-of-hollow-trunk-attached-to-piston').length, 2);
  for (const role of [
    'continuously-rotating-upper-crank',
    'constant-length-pitman-entering-hollow-trunk',
    'white-pitman-pin-directly-in-piston-at-trunk-bottom',
    'single-translating-piston-and-attached-hollow-trunk',
    'vertical-sliding-piston',
    'open-front-hollow-trunk-shell',
    'fixed-annular-stuffing-box-around-moving-trunk',
    'fixed-cutaway-steam-cylinder',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 421 records Brown’s trunk-engine flow staging and the official Canvas slider proportions', () => {
  const movement = catalog.movements[420];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate421;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_421.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Trunk engine used for marine purposes/);
  assert.match(movement.description, /pitman is connected directly with the piston/);
  assert.match(movement.description, /trunk works through a stuffing-box/);
  assert.match(movement.description, /effective area of the upper side.*reduced by the trunk/);
  assert.match(movement.description, /high-pressure steam.*upper side/);
  assert.match(movement.description, /used expansively.*below/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.officialCanvasCyclePeriod, 4);
  assert.equal(sourceAnimation.officialCanvasCyclesPerMinute, 15);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsPressuresOrLoads,
    false,
  );
  assert.equal(dynamics.effectiveAreasAndEqualForcePressureRatioModeled, true);
  assert.equal(dynamics.expansiveThermodynamicPressureCurveModeled, false);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.crankApproximateCenterPixels, [262, 95]);
  assert.deepEqual(plate.pistonPinApproximateCenterPixels, [264, 371]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.officialCanvasEvidence,
    /1\.5-unit crank throw.*7\.45-unit pitman/);
  assert.match(evidence.reconstructionDisclosure,
    /no absolute dimensions.*clearance volumes.*pressures/);
  disposeModel(model.root);
});

test('movement 421 exact square-root slider law preserves the pitman and constrains the piston pin to one vertical centerline', () => {
  const model = createMovementModel(catalog.movements[420]);
  const { geometry, stateAtCrankAngle } = model.root.userData;
  let maximumLengthResidual = 0;

  for (let sample = -60000; sample <= 120000; sample += 1) {
    const angle = FULL_TURN * sample / 60000;
    const state = stateAtCrankAngle(angle);
    const expectedY = geometry.crankCenter.y
      + geometry.crankRadius * Math.sin(angle)
      - Math.sqrt(
        geometry.pitmanLength ** 2
          - geometry.crankRadius ** 2 * Math.cos(angle) ** 2,
      );
    near(state.pistonY, expectedY, 5e-16, 'in-line slider law');
    near(state.pistonPin.x, 0, 0, 'piston centerline x');
    near(state.pistonPin.y, state.pistonY, 0, 'direct piston-pin y');
    maximumLengthResidual = Math.max(maximumLengthResidual,
      Math.abs(state.pitmanLengthResidual));
  }
  assert.ok(maximumLengthResidual < 9e-16);
  disposeModel(model.root);
});

test('movement 421 piston stroke is exactly twice the crank radius and the trunk remains through the head at both dead centers', () => {
  const model = createMovementModel(catalog.movements[420]);
  const { geometry, stateAtCrankAngle } = model.root.userData;
  const bottom = stateAtCrankAngle(-Math.PI / 2);
  const top = stateAtCrankAngle(Math.PI / 2);

  near(bottom.pistonY, geometry.pistonMinimumY, 0,
    'bottom dead center');
  near(top.pistonY, geometry.pistonMaximumY, 0,
    'top dead center');
  near(top.pistonY - bottom.pistonY, geometry.pistonStroke, 0,
    'dead-center stroke');
  near(geometry.pistonStroke, 2 * geometry.crankRadius, 0,
    'twice-crank stroke');
  near(Math.abs(bottom.pistonSpeed), 0, 1e-16,
    'bottom dead-center speed');
  near(Math.abs(top.pistonSpeed), 0, 1e-16,
    'top dead-center speed');
  for (let sample = 0; sample <= 50000; sample += 1) {
    const state = stateAtCrankAngle(FULL_TURN * sample / 50000);
    assert.ok(state.pistonY >= geometry.pistonMinimumY - 3e-16);
    assert.ok(state.pistonY <= geometry.pistonMaximumY + 3e-16);
    assert.ok(state.trunkTopY > geometry.cylinderHeadY);
    near(state.trunkBottomY, state.pistonY, 0,
      'trunk attached directly at piston');
    near(state.trunkTopY - state.trunkBottomY,
      geometry.trunkLength, 3e-16, 'rigid trunk length');
  }
  disposeModel(model.root);
});

test('movement 421 differentiated slider law satisfies pitman velocity and acceleration constraints', () => {
  const model = createMovementModel(catalog.movements[420]);
  const { stateAtCrankAngle } = model.root.userData;
  let maximumVelocityResidual = 0;
  let maximumAccelerationResidual = 0;

  for (let sample = -60000; sample <= 120000; sample += 1) {
    const state = stateAtCrankAngle(FULL_TURN * sample / 60000);
    maximumVelocityResidual = Math.max(maximumVelocityResidual,
      Math.abs(state.pitmanVelocityConstraintResidual));
    maximumAccelerationResidual = Math.max(maximumAccelerationResidual,
      Math.abs(state.pitmanAccelerationConstraintResidual));
    vectorNear(state.pistonPinVelocity,
      new THREE.Vector3(0, state.pistonSpeed, 0), 0,
      'piston-pin vertical velocity');
    vectorNear(state.pistonPinAcceleration,
      new THREE.Vector3(0, state.pistonAcceleration, 0), 0,
      'piston-pin vertical acceleration');
  }
  assert.ok(maximumVelocityResidual < 4.8e-16);
  assert.ok(maximumAccelerationResidual < 1.3e-15);
  disposeModel(model.root);
});

test('movement 421 analytic piston derivatives match finite differences throughout both strokes', () => {
  const model = createMovementModel(catalog.movements[420]);
  const { stateAtCrankAngle } = model.root.userData;
  const angleStep = 1e-5;

  for (const angle of [0.11, 0.52, 1.08, 1.57, 2.14, 2.78, 3.39,
    4.02, 4.71, 5.31, 5.92]) {
    const state = stateAtCrankAngle(angle);
    const timeStep = angleStep / state.crankSpeed;
    const before = stateAtCrankAngle(angle - angleStep);
    const after = stateAtCrankAngle(angle + angleStep);
    const numericalSpeed = (after.pistonY - before.pistonY)
      / (2 * timeStep);
    const numericalAcceleration = (
      after.pistonSpeed - before.pistonSpeed
    ) / (2 * timeStep);
    const numericalCrankVelocity = after.crankPin.clone()
      .sub(before.crankPin)
      .multiplyScalar(1 / (2 * timeStep));
    near(numericalSpeed, state.pistonSpeed, 2e-10,
      `piston speed at ${angle}`);
    near(numericalAcceleration, state.pistonAcceleration, 5e-10,
      `piston acceleration at ${angle}`);
    vectorNear(numericalCrankVelocity, state.crankPinVelocity, 7e-11,
      `crank-pin velocity at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 421 upper annular and lower full piston areas give Brown’s exact equal-force pressure ratio', () => {
  const model = createMovementModel(catalog.movements[420]);
  const { geometry, pressureStaging } = model.root.userData;

  near(geometry.lowerEffectiveArea,
    Math.PI * geometry.pistonRadius ** 2, 0,
    'lower full area');
  near(geometry.trunkCrossSectionArea,
    Math.PI * geometry.trunkOuterRadius ** 2, 0,
    'trunk area');
  near(geometry.upperEffectiveArea,
    geometry.lowerEffectiveArea - geometry.trunkCrossSectionArea,
    5e-16, 'upper annular area');
  assert.ok(geometry.upperEffectiveArea < geometry.lowerEffectiveArea);
  near(pressureStaging.upperAnnularArea, geometry.upperEffectiveArea, 0,
    'reported upper area');
  near(pressureStaging.lowerFullArea, geometry.lowerEffectiveArea, 0,
    'reported lower area');
  near(pressureStaging.highToExpansivePressureRatio,
    geometry.lowerEffectiveArea / geometry.upperEffectiveArea, 0,
    'equal-force pressure ratio');
  near(pressureStaging.highToExpansivePressureRatio
      * geometry.upperEffectiveArea,
    geometry.lowerEffectiveArea, 5e-16,
    'equal opposed nominal force');
  assert.equal(pressureStaging.highPressureAdmissionSide,
    'upper annular piston face');
  assert.equal(pressureStaging.lowerExpansiveSide,
    'lower full piston face');
  disposeModel(model.root);
});

test('movement 421 chamber volumes remain positive and their unequal rates differ exactly by trunk displacement', () => {
  const model = createMovementModel(catalog.movements[420]);
  const { geometry, stateAtCrankAngle } = model.root.userData;
  let maximumResidual = 0;

  for (let sample = 0; sample <= 100000; sample += 1) {
    const state = stateAtCrankAngle(FULL_TURN * sample / 100000);
    assert.ok(state.upperChamberHeight > 0);
    assert.ok(state.lowerChamberHeight > 0);
    assert.ok(state.upperChamberVolume > 0);
    assert.ok(state.lowerChamberVolume > 0);
    near(state.upperChamberVolume,
      geometry.upperEffectiveArea * state.upperChamberHeight, 0,
      'upper annular volume');
    near(state.lowerChamberVolume,
      geometry.lowerEffectiveArea * state.lowerChamberHeight, 0,
      'lower full volume');
    near(state.upperChamberVolumeRate,
      -geometry.upperEffectiveArea * state.pistonSpeed, 0,
      'upper volume rate');
    near(state.lowerChamberVolumeRate,
      geometry.lowerEffectiveArea * state.pistonSpeed, 0,
      'lower volume rate');
    maximumResidual = Math.max(maximumResidual,
      Math.abs(state.trunkDisplacementVolumeRateResidual));
    near(state.combinedChamberVolumeRate,
      geometry.trunkCrossSectionArea * state.pistonSpeed, 5e-16,
      'combined rate equals trunk displacement');
  }
  assert.ok(maximumResidual < 5e-16);
  disposeModel(model.root);
});

test('movement 421 update binds crank rotation, piston/trunk translation, pitman length, and chamber indicators to one state', () => {
  const model = createMovementModel(catalog.movements[420]);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.37, 0.91, 1.48, 2.05, 2.67, 3.34, 3.89,
    4.52]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.crankWheel.userData.rotor.rotation.z,
      state.crankAngle, 0, 'crank update');
    near(blocks.pistonAndTrunk.position.x, 0, 0,
      'piston/trunk centerline update');
    near(blocks.pistonAndTrunk.position.y, state.pistonY, 0,
      'piston/trunk vertical update');
    near(blocks.pitman.scale.y, geometry.pitmanLength, 9e-16,
      'rendered pitman length');
    near(blocks.upperSteam.scale.y, state.upperChamberHeight, 0,
      'upper chamber height update');
    near(blocks.lowerSteam.scale.y, state.lowerChamberHeight, 0,
      'lower chamber height update');
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  sameAngle(closure.crankAngle, source.crankAngle, 0,
    'crank cycle closure');
  near(closure.pistonY, source.pistonY, 0,
    'piston cycle closure');
  near(closure.upperChamberVolume, source.upperChamberVolume, 0,
    'upper-volume cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.cycleDuration);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 421 trunk-engine geometry', () => {
  const movement421 = catalog.movements[420];
  const movement507 = catalog.movements[506];
  const model421 = createMovementModel(movement421);
  const model507 = createMovementModel(movement507);

  assert.equal(movement421.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model421.root);
  disposeModel(model507.root);
});
