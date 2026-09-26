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
  'water-sealed-inverted-bell-air-pump-with-mirrored-rope-levers-two-upward-check-valves-polytropic-gas-cycle-hydrostatic-interface-and-deep-shaft-inlet';

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

function movementModel() {
  const movement = catalog.movements[472];
  return { model: createMovementModel(movement), movement };
}

test('movement 473 is one inverted moving bell suspended by two ropes inside one fixed water tub', () => {
  const { model, movement } = movementModel();
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 473);
  assert.equal(movement.number, '473');
  assert.equal(movement.title, 'Air-pump of simple construction');
  assert.equal(movement.category, 'Pumps & pneumatics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.outerTub.parent, model.root);
  assert.equal(blocks.outerWater.parent, model.root);
  assert.equal(blocks.inletPipe.parent, model.root);
  assert.equal(blocks.lowerInletValveDisk.parent, model.root);
  assert.equal(blocks.movingBell.parent, model.root);
  assert.equal(blocks.bellShell.parent, blocks.movingBell);
  assert.equal(blocks.bellRoof.parent, blocks.movingBell);
  assert.equal(blocks.bellRim.parent, blocks.movingBell);
  assert.equal(blocks.upperOutletValveDisk.parent, blocks.movingBell);
  assert.equal(blocks.leftSuspensionRope.parent, model.root);
  assert.equal(blocks.rightSuspensionRope.parent, model.root);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.bellAndLeverIndependent, false);
  assert.equal(degreesOfFreedom.passivePressureOperatedCheckValves, 2);
  assert.equal(degreesOfFreedom.suspensionRopesExtensible, false);
  disposeModel(model.root);
});

test('movement 473 source record preserves both tubs, dotted water line, two upward checks, ropes, and deep-shaft use', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.brownPlate473;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_473.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.plate, 'Brown 1868, Movement 473');
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(sourceAnimation.sourcePrescribedNormalizedTiming, false);
  assert.deepEqual(plate.approximateBellBoundsPixels,
    [184, 137, 159, 280]);
  assert.deepEqual(plate.approximateOuterTubBoundsPixels,
    [174, 253, 190, 171]);
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('smaller tub is inverted')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('few inches above it')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('second upward-opening valve')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('suspended by ropes from levers')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('descent expels air')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('carbonic acid from a large deep shaft')));
  assert.match(evidence.engravingEvidence, /dotted water level/i);
  assert.match(evidence.reconstructionDisclosure,
    /450-Pa ideal check differentials/i);
  disposeModel(model.root);
});

test('movement 473 mirrored lever endpoints keep both suspension ropes at one exact length', () => {
  const { model } = movementModel();
  const { geometry, leverKinematicsAtPhase } = model.root.userData;

  for (const phase of [0, 0.08, 0.19, 0.31, 0.5, 0.66, 0.82, 0.96]) {
    const state = leverKinematicsAtPhase(phase);
    near(state.leftInnerEnd.distanceTo(state.leftBellLug),
      geometry.suspensionRopeLength, 2e-12,
      `left suspension rope at ${phase}`);
    near(state.rightInnerEnd.distanceTo(state.rightBellLug),
      geometry.suspensionRopeLength, 2e-12,
      `right suspension rope at ${phase}`);
    near(state.leftPivot.distanceTo(state.leftInnerEnd),
      geometry.leverInnerArmLength, 2e-12,
      `left inner lever arm at ${phase}`);
    near(state.rightPivot.distanceTo(state.rightInnerEnd),
      geometry.leverInnerArmLength, 2e-12,
      `right inner lever arm at ${phase}`);
    near(state.leftPivot.distanceTo(state.leftOuterEnd),
      geometry.leverOuterArmLength, 2e-12,
      `left outer lever arm at ${phase}`);
    near(state.rightPivot.distanceTo(state.rightOuterEnd),
      geometry.leverOuterArmLength, 2e-12,
      `right outer lever arm at ${phase}`);
    near(state.leftInnerEnd.x, -state.rightInnerEnd.x, 1e-12,
      `mirrored inner endpoints at ${phase}`);
    near(state.leftBellLug.y, state.rightBellLug.y, 1e-12,
      `level bell lugs at ${phase}`);
  }
  const top = leverKinematicsAtPhase(0);
  const bottom = leverKinematicsAtPhase(0.5);
  near(top.bellCenterY - bottom.bellCenterY,
    geometry.bellStroke, 1e-12, 'lever-derived bell stroke');
  near(top.bellCenterY, geometry.topBellCenterY, 1e-12,
    'top bell datum');
  near(bottom.bellCenterY, geometry.bottomBellCenterY, 1e-12,
    'bottom bell datum');
  disposeModel(model.root);
});

test('movement 473 bell velocity and acceleration are analytic derivatives of the exact lever-rope geometry', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const timeStep = 1e-4;

  for (const phase of [0.08, 0.18, 0.31, 0.43, 0.62, 0.76, 0.91]) {
    const time = phase * geometry.cycleDuration;
    const center = stateAtTime(time);
    const before = stateAtTime(time - timeStep);
    const after = stateAtTime(time + timeStep);
    near((after.bellCenterY - before.bellCenterY) / (2 * timeStep),
      center.bellVelocity, 2e-8, `bell velocity at ${phase}`);
    near((after.bellCenterY - 2 * center.bellCenterY
      + before.bellCenterY) / timeStep ** 2,
    center.bellAcceleration, 7e-7,
    `bell acceleration at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 473 open bell rim remains below both water interfaces and the shaft inlet remains above water', () => {
  const { model } = movementModel();
  const { gasStateAtPhase, geometry } = model.root.userData;

  for (let index = 0; index <= 600; index += 1) {
    const state = gasStateAtPhase(index / 600);
    assert.ok(state.waterSealMarginExternal > 0,
      `external water seal lost at ${index}`);
    assert.ok(state.waterSealMarginInternal > 0,
      `internal water seal lost at ${index}`);
    assert.ok(state.chamberHeight > 0,
      `gas chamber collapsed at ${index}`);
    assert.ok(state.bellInnerRoofY > geometry.inletPipeTopY,
      `inlet pipe exits bell at ${index}`);
    assert.ok(geometry.inletPipeTopY > state.internalWaterLineY,
      `lower check becomes submerged at ${index}`);
  }
  assert.ok(geometry.inletPipeTopY > geometry.externalWaterLineY);
  assert.ok(geometry.outerTubTopY > geometry.externalWaterLineY);
  assert.ok(geometry.externalWaterLineY > geometry.outerTubBottomY);
  disposeModel(model.root);
});

test('movement 473 pressure-dependent internal water level obeys exact hydrostatic head', () => {
  const { model } = movementModel();
  const { gasStateAtPhase, geometry } = model.root.userData;
  const headDenominator = geometry.waterDensityKilogramPerCubicMetre
    * geometry.gravityMetrePerSecondSquared;

  for (const phase of [0, 0.04, 0.12, 0.25, 0.5, 0.54, 0.63, 0.75,
    0.92]) {
    const state = gasStateAtPhase(phase);
    near(state.internalWaterLineY,
      geometry.externalWaterLineY - (
        state.chamberPressurePascal - geometry.atmosphericPressurePascal
      ) / headDenominator,
    1e-12, `hydrostatic interface at ${phase}`);
    near(state.chamberVolume,
      geometry.gasArea * state.chamberHeight,
      1e-12, `gas volume at ${phase}`);
    near(state.chamberHeight,
      state.bellInnerRoofY - state.internalWaterLineY,
      1e-12, `gas height at ${phase}`);
  }
  assert.ok(gasStateAtPhase(0).internalWaterLineY
    > geometry.externalWaterLineY,
  'suction pressure raises the internal interface');
  assert.ok(gasStateAtPhase(0.5).internalWaterLineY
    < geometry.externalWaterLineY,
  'exhaust pressure depresses the internal interface');
  disposeModel(model.root);
});

test('movement 473 check valves follow compression, upper exhaust, rarefaction, and lower intake in source order', () => {
  const { model } = movementModel();
  const { gasStateAtPhase, geometry } = model.root.userData;
  const top = gasStateAtPhase(0);
  const earlyDescent = gasStateAtPhase(0.05);
  const exhaust = gasStateAtPhase(0.25);
  const bottom = gasStateAtPhase(0.5);
  const earlyRise = gasStateAtPhase(0.55);
  const intake = gasStateAtPhase(0.75);

  assert.equal(top.lowerInletValveOpen, true);
  assert.equal(top.upperOutletValveOpen, false);
  near(top.chamberPressurePascal,
    geometry.inletOpenChamberPressurePascal, 1e-9,
    'top intake pressure');
  assert.equal(earlyDescent.lowerInletValveOpen, false);
  assert.equal(earlyDescent.upperOutletValveOpen, false);
  assert.match(earlyDescent.mode, /initial-compression/i);
  assert.equal(exhaust.lowerInletValveOpen, false);
  assert.equal(exhaust.upperOutletValveOpen, true);
  assert.ok(exhaust.outletVolumetricFlow > 0);
  near(exhaust.chamberPressurePascal,
    geometry.outletOpenChamberPressurePascal, 1e-9,
    'outlet cracking pressure');
  assert.equal(bottom.upperOutletValveOpen, true);
  assert.equal(earlyRise.lowerInletValveOpen, false);
  assert.equal(earlyRise.upperOutletValveOpen, false);
  assert.match(earlyRise.mode, /initial-rarefaction/i);
  assert.equal(intake.lowerInletValveOpen, true);
  assert.equal(intake.upperOutletValveOpen, false);
  assert.ok(intake.inletVolumetricFlow > 0);
  near(intake.chamberPressurePascal,
    geometry.inletOpenChamberPressurePascal, 1e-9,
    'inlet cracking pressure');

  for (let index = 0; index < 500; index += 1) {
    const state = gasStateAtPhase(index / 500);
    assert.equal(state.lowerInletValveOpen
      && state.upperOutletValveOpen, false,
    `both upward checks open at ${index}`);
  }
  disposeModel(model.root);
});

test('movement 473 sealed compression and rarefaction stages obey their exact polytropic invariants', () => {
  const { model } = movementModel();
  const { gasStateAtPhase, geometry } = model.root.userData;

  for (const phase of [0.001, 0.03, 0.06, 0.10]) {
    const state = gasStateAtPhase(phase);
    assert.match(state.mode, /initial-compression/i);
    near(state.chamberPressurePascal
      * state.chamberVolume ** geometry.polytropicExponent,
    geometry.compressionPolytropicConstant, 3e-10,
    `compression P-V invariant at ${phase}`);
    near(state.compressionPolytropicResidual, 0, 3e-10,
      `compression residual at ${phase}`);
  }
  for (const phase of [0.501, 0.53, 0.56, 0.60]) {
    const state = gasStateAtPhase(phase);
    assert.match(state.mode, /initial-rarefaction/i);
    near(state.chamberPressurePascal
      * state.chamberVolume ** geometry.polytropicExponent,
    geometry.expansionPolytropicConstant, 3e-10,
    `rarefaction P-V invariant at ${phase}`);
    near(state.expansionPolytropicResidual, 0, 3e-10,
      `rarefaction residual at ${phase}`);
  }
  near(geometry.theoreticalSweptVolume,
    geometry.gasArea * geometry.bellStroke,
    1e-12, 'geometric swept volume');
  disposeModel(model.root);
});

test('movement 473 renderer maps exact levers, ropes, bell, pressure surface, checks, and gas flow', () => {
  const { model } = movementModel();
  const { blocks, gasStateAtPhase, geometry } = model.root.userData;

  for (const phase of [0, 0.05, 0.25, 0.5, 0.55, 0.75, 0.95]) {
    const state = gasStateAtPhase(phase);
    model.update(phase * geometry.cycleDuration);
    near(blocks.movingBell.position.y, state.bellCenterY, 1e-12,
      `bell render at ${phase}`);
    near(blocks.leftLever.scale.y,
      geometry.leverInnerArmLength + geometry.leverOuterArmLength,
      3e-12, `left lever length at ${phase}`);
    near(blocks.rightLever.scale.y,
      geometry.leverInnerArmLength + geometry.leverOuterArmLength,
      3e-12, `right lever length at ${phase}`);
    // The suspension ropes are laid ropes rebuilt along their exact run.
    near(blocks.leftSuspensionRope.geometry.userData.ropeLay.length,
      geometry.suspensionRopeLength, 1e-9,
      `left rendered rope at ${phase}`);
    near(blocks.rightSuspensionRope.geometry.userData.ropeLay.length,
      geometry.suspensionRopeLength, 1e-9,
      `right rendered rope at ${phase}`);
    near(blocks.trappedGas.scale.y, state.chamberHeight, 1e-12,
      `gas chamber scale at ${phase}`);
    near(blocks.internalWaterSurface.position.y,
      state.internalWaterLineY, 1e-12,
      `internal water surface at ${phase}`);
    near(blocks.lowerInletValveDisk.position.y,
      geometry.inletPipeTopY + 0.05
        + 0.10 * model.root.userData.valveLiftAtPhase(state.phase).lower,
      1e-12, `lower check lift at ${phase}`);
    near(blocks.upperOutletValveDisk.position.y,
      geometry.bellHeight / 2 + 0.2885
        + 0.10 * model.root.userData.valveLiftAtPhase(state.phase).upper,
      1e-12, `upper check lift at ${phase}`);
    // Gas shown at each check swells and thins with the eased lift.
    const lift = model.root.userData.valveLiftAtPhase(state.phase);
    assert.equal(blocks.outletGasPlume.visible,
      state.upperOutletValveOpen && state.outletVolumetricFlow > 0 && lift.upper > 0);
    assert.equal(blocks.inletGasColumn.visible,
      state.lowerInletValveOpen && lift.lower > 0);
    assert.equal(blocks.inletGasJet.visible,
      state.lowerInletValveOpen && state.inletVolumetricFlow > 0 && lift.lower > 0);
    near(blocks.inletGasJet.scale.x, lift.lower, 1e-12, `inlet gas width at ${phase}`);
    near(blocks.outletGasPlume.scale.x, lift.upper, 1e-12, `outlet gas width at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 473 harmonic lever-rope drive is smooth and closes exactly over every cycle', () => {
  const { model } = movementModel();
  const { gasStateAtPhase } = model.root.userData;
  const step = 1e-7;
  const before = gasStateAtPhase(1 - step);
  const center = gasStateAtPhase(0);
  const after = gasStateAtPhase(step);

  near(before.bellCenterY, center.bellCenterY, 1e-12,
    'left top position');
  near(after.bellCenterY, center.bellCenterY, 1e-12,
    'right top position');
  near(before.bellVelocity, center.bellVelocity, 1e-6,
    'left top velocity');
  near(after.bellVelocity, center.bellVelocity, 1e-6,
    'right top velocity');
  near(before.bellAcceleration, center.bellAcceleration, 1e-6,
    'left top acceleration');
  near(after.bellAcceleration, center.bellAcceleration, 1e-6,
    'right top acceleration');
  near(before.chamberPressurePascal, center.chamberPressurePascal,
    1e-9, 'intake pressure closes across cycle');
  assert.equal(before.lowerInletValveOpen, true);
  assert.equal(center.lowerInletValveOpen, true);
  disposeModel(model.root);
});

test('movement 473 has finite fitted render bounds and movement 507 remains the next authored frontier', () => {
  const movement473 = catalog.movements[472];
  const movement507 = catalog.movements[506];
  const model473 = createMovementModel(movement473);
  const model507 = createMovementModel(movement507);
  const fitBounds = model473.root.userData.cameraFitBounds;

  for (let index = 0; index <= 16; index += 1) {
    model473.update(index / 16 * model473.root.userData.geometry.cycleDuration);
    model473.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model473.root);
    for (const value of [bounds.min.x, bounds.min.y, bounds.min.z,
      bounds.max.x, bounds.max.y, bounds.max.z]) {
      assert.ok(Number.isFinite(value));
    }
    assert.ok(bounds.max.x > bounds.min.x);
    assert.ok(bounds.max.y > bounds.min.y);
    assert.ok(bounds.max.z > bounds.min.z);
    assert.ok(fitBounds.min.x <= bounds.min.x);
    assert.ok(fitBounds.min.y <= bounds.min.y);
    assert.ok(fitBounds.min.z <= bounds.min.z);
    assert.ok(fitBounds.max.x >= bounds.max.x);
    assert.ok(fitBounds.max.y >= bounds.max.y);
    assert.ok(fitBounds.max.z >= bounds.max.z);
  }
  assert.equal(movement473.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model473.root);
  disposeModel(model507.root);
});
