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
  'montgolfier-hydraulic-ram-with-weighted-waste-valve-delivery-check-valve-air-chamber-and-steady-high-level-efflux';
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

test('movement 444 has fixed seats, a weighted waste disk, a delivery check, and one globular air chamber', () => {
  const movement = catalog.movements[443];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 444);
  assert.equal(movement.number, '444');
  assert.equal(movement.category, 'Hydraulics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism,
    /small-head reservoir feeds the drive pipe toward the right-hand weighted waste valve/);
  assert.match(data.mechanism,
    /only after closure does the left delivery check lift/);
  assert.match(data.mechanism,
    /trapped air compresses.*maintaining a continuous high-level outlet/);
  assert.equal(blocks.reservoir.parent, model.root);
  assert.equal(blocks.drivePipe.parent, model.root);
  assert.equal(blocks.wasteValve.parent, model.root);
  assert.equal(blocks.wasteSeat.parent, blocks.wasteValve);
  assert.equal(blocks.wasteDisk.parent, blocks.wasteValve);
  assert.equal(blocks.wasteStem.parent, blocks.wasteValve);
  assert.equal(blocks.leverWeight.parent, blocks.wasteLever);
  assert.equal(blocks.deliveryValve.parent, model.root);
  assert.equal(blocks.deliverySeat.parent, blocks.deliveryValve);
  assert.equal(blocks.deliveryDisk.parent, blocks.deliveryValve);
  assert.equal(blocks.airChamberShell.parent, model.root);
  assert.equal(blocks.chamberWater.parent, model.root);
  assert.equal(blocks.compressedAir.parent, model.root);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.wasteValveIndependent, false);
  assert.equal(degreesOfFreedom.deliveryValveIndependent, false);
  assert.equal(degreesOfFreedom.airPressureIndependent, false);
  assert.equal(degreesOfFreedom.outputFlowIndependent, false);

  const belts = [];
  const ropes = [];
  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.isRope) ropes.push(object);
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.deepEqual(belts, []);
  assert.deepEqual(ropes, []);
  for (const role of [
    'fixed-low-head-supply-reservoir',
    'right-weight-held-open-waste-impulse-valve',
    'left-delivery-check-valve-opening-only-after-waste-closure',
    'globular-air-chamber-smoothing-intermittent-delivery',
    'elastic-compressed-air-cushion-maintaining-uniform-efflux',
    'continuous-uniform-upward-efflux-from-air-cushion',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 444 source evidence and hydraulic simplifications are honestly recorded', () => {
  const movement = catalog.movements[443];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate444;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_444.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Montgolfier’s hydraulic ram/);
  assert.match(movement.description,
    /right-hand valve being kept open by a weight or spring/);
  assert.match(movement.description,
    /momentum of the current.*other valve, opens it/);
  assert.match(movement.description, /globular air-chamber/);
  assert.match(movement.description,
    /elasticity of the air gives uniformity to the efflux/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /static engraving and caption.*Animated control is unavailable/);
  assert.equal(dynamics.fullUnsteadyPipeFlowValveImpactSpringDynamicsAirHeatTransferCavitationLeakageFrictionAndStructuralElasticityModeled,
    false);
  assert.match(dynamics.flowSchedule,
    /quintic weighted-waste closure.*no-overlap pressure dwell.*C2 delivery-check pulse/);
  assert.match(dynamics.airCompressionModel,
    /isothermal p\*V constant.*integrates exactly/);
  assert.match(dynamics.uniformEfflux, /Output flow is constant/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateReservoirCenterPixels, [84, 159]);
  assert.deepEqual(plate.approximateAirChamberCenterPixels, [317, 228]);
  assert.deepEqual(plate.approximateWasteValvePixels, [394, 391]);
  assert.deepEqual(plate.approximateDeliveryValvePixels, [283, 397]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.engravingEvidence,
    /left elevated supply reservoir.*bottom drive pipe.*weighted right waste valve.*continuous vertical jet/);
  assert.match(evidence.reconstructionDisclosure,
    /no dimensions, head, pipe area or length.*independently engineered/);
  disposeModel(model.root);
});

test('movement 444 valve cycle follows waste-open, waste-close, delivery-open, delivery-close, waste-reopen order', () => {
  const model = createMovementModel(catalog.movements[443]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const atPhase = (phase) => stateAtInputAngle(FULL_TURN * phase);

  assert.equal(atPhase(0.20).mode,
    'waste-valve-open-drive-flow-accelerating');
  near(atPhase(0.20).wasteValveOpen, 1, 0, 'initial waste open');
  near(atPhase(0.20).deliveryValveOpen, 0, 0,
    'initial delivery closed');
  assert.equal(atPhase(0.45).mode,
    'waste-valve-closing-water-hammer-rising');
  near(atPhase(0.45).wasteValveOpen, 0.5, 8e-15,
    'waste valve half closed');
  assert.equal(atPhase(0.49).mode,
    'both-valves-closed-pressure-peak');
  near(atPhase(0.49).wasteValveOpen, 0, 0, 'waste closed first');
  near(atPhase(0.49).deliveryValveOpen, 0, 0,
    'delivery still closed during pressure rise');
  assert.equal(atPhase(0.57).mode,
    'delivery-check-opening-air-chamber-charging');
  near(atPhase(0.57).deliveryValveOpen, 0.5, 8e-15,
    'delivery check opening');
  near(atPhase(geometry.deliveryPeakPhase).deliveryValveOpen, 1, 2e-15,
    'delivery check fully open');
  assert.equal(atPhase(0.71).mode,
    'delivery-check-closing-air-chamber-charging');
  near(atPhase(0.71).deliveryValveOpen, 0.5, 1.5e-14,
    'delivery check closing');
  assert.equal(atPhase(0.80).mode,
    'both-valves-closed-equilibrium-restoring');
  assert.equal(atPhase(0.86).mode, 'weighted-waste-valve-reopening');
  near(atPhase(0.86).wasteValveOpen, 0.5, 1.5e-14,
    'weighted waste valve reopening');
  near(atPhase(0.95).wasteValveOpen, 1, 0,
    'waste valve reset open');
  disposeModel(model.root);
});

test('movement 444 delivery and waste valves never have an open overlap', () => {
  const model = createMovementModel(catalog.movements[443]);
  const { stateAtInputAngle } = model.root.userData;
  for (let sample = -20000; sample <= 40000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    near(state.wasteValveOpen * state.deliveryValveOpen, 0, 0,
      `valve interlock at sample ${sample}`);
    assert.ok(state.wasteValveOpen >= 0 && state.wasteValveOpen <= 1);
    assert.ok(state.deliveryValveOpen >= 0
      && state.deliveryValveOpen <= 1);
  }
  disposeModel(model.root);
});

test('movement 444 chamber pulse and constant output obey exact nominal mass balance without drift', () => {
  const model = createMovementModel(catalog.movements[443]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = 0; sample < 10000; sample += 1) {
    const phase = (sample + 0.371) / 10000;
    const state = stateAtInputAngle(FULL_TURN * phase);
    near(state.chamberWaterVolumeRate,
      state.chamberInletFlowRate - state.outputFlowRate,
    8e-17, `nominal mass balance at ${phase}`);
  }
  const deliveryPeak = stateAtInputAngle(
    FULL_TURN * geometry.deliveryPeakPhase,
  );
  near(deliveryPeak.chamberInletFlowRate,
    2 * geometry.nominalOutputFlowRate
      / geometry.deliveryDurationPhase,
  2e-16, 'normalized compact inlet pulse peak');
  const source = stateAtInputAngle(0);
  const closure = stateAtInputAngle(FULL_TURN);
  near(closure.chamberWaterVolume, source.chamberWaterVolume, 0,
    'water inventory cycle closure');
  near(model.root.userData.metering.deliveredVolumePerStroke,
    geometry.nominalOutputFlowRate * geometry.cycleDuration, 0,
  'pulse volume equals constant output volume per stroke');
  disposeModel(model.root);
});

test('movement 444 isothermal air cushion pressure follows chamber water inventory exactly', () => {
  const model = createMovementModel(catalog.movements[443]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let minimumWaterState = null;
  let maximumWaterState = null;
  for (let sample = 0; sample < 20000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    near(state.chamberAirVolume + state.chamberWaterVolume,
      geometry.chamberTotalInternalVolume, 0,
    `fixed chamber volume at sample ${sample}`);
    near(state.chamberAirPressure * state.chamberAirVolume,
      geometry.sourceAirPressure * geometry.sourceAirVolume,
    3e-16, `isothermal air invariant at sample ${sample}`);
    if (!minimumWaterState
      || state.chamberWaterVolume < minimumWaterState.chamberWaterVolume) {
      minimumWaterState = state;
    }
    if (!maximumWaterState
      || state.chamberWaterVolume > maximumWaterState.chamberWaterVolume) {
      maximumWaterState = state;
    }
  }
  assert.ok(maximumWaterState.chamberAirPressure
    > minimumWaterState.chamberAirPressure,
  'charging water compresses and raises air pressure');
  disposeModel(model.root);
});

test('movement 444 air cushion maintains exactly uniform outlet through pulsed chamber charging', () => {
  const model = createMovementModel(catalog.movements[443]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let sawNoInlet = false;
  let sawPulseInlet = false;
  for (let sample = -12000; sample <= 24000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 12000);
    near(state.outputFlowRate, geometry.nominalOutputFlowRate, 0,
      `constant output at sample ${sample}`);
    if (state.chamberInletFlowRate === 0) sawNoInlet = true;
    if (state.chamberInletFlowRate
      > 4 * geometry.nominalOutputFlowRate) sawPulseInlet = true;
  }
  assert.equal(sawNoInlet, true);
  assert.equal(sawPulseInlet, true);
  disposeModel(model.root);
});

test('movement 444 quintic valve endpoints have zero visible velocity and acceleration', () => {
  const model = createMovementModel(catalog.movements[443]);
  const {
    deliveryValveOpenAtPhase,
    geometry,
    wasteValveOpenAtPhase,
  } = model.root.userData;
  const step = 1e-6;
  const checkBoundary = (fn, phase, name) => {
    const before = fn(phase - step);
    const center = fn(phase);
    const after = fn(phase + step);
    near((after - before) / (2 * step), 0, 2e-7,
      `${name} zero endpoint velocity`);
    near((after - 2 * center + before) / step ** 2, 0, 0.12,
      `${name} zero endpoint acceleration`);
  };
  for (const phase of [geometry.wasteCloseStartPhase,
    geometry.wasteCloseEndPhase, geometry.wasteReopenStartPhase,
    geometry.wasteReopenEndPhase]) {
    checkBoundary(wasteValveOpenAtPhase, phase,
      `waste valve phase ${phase}`);
  }
  for (const phase of [geometry.deliveryStartPhase,
    geometry.deliveryPeakPhase, geometry.deliveryEndPhase]) {
    checkBoundary(deliveryValveOpenAtPhase, phase,
      `delivery valve phase ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 444 update moves only valve disks and stems while chamber rendering and fixed seats match state', () => {
  const model = createMovementModel(catalog.movements[443]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [blocks.base, blocks.reservoir, blocks.drivePipe,
    blocks.chamberNeck, blocks.airChamberShell, blocks.deliveryValve,
    blocks.deliverySeat, blocks.wasteValve, blocks.wasteSeat,
    blocks.wasteOutlet, blocks.outputPipe, blocks.outputWater];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());
  const sourceWasteValvePosition = blocks.wasteValve.position.clone();

  for (const phase of [0, 0.20, 0.45, 0.49, 0.57, 0.64,
    0.71, 0.80, 0.86, 0.95]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    near(blocks.wasteDisk.position.y, -.045 - state.wasteValveLift, 0,
      `moving waste disk at ${phase}`);
    near(blocks.wasteStem.position.y,
       .345 - state.wasteValveLift, 0,
    `moving waste stem at ${phase}`);
    vectorNear(blocks.wasteValve.position,
      sourceWasteValvePosition, 0,
    `fixed waste seat group at ${phase}`);
    near(blocks.deliveryDisk.position.y, .04 + state.deliveryValveLift, 0,
      `moving delivery disk at ${phase}`);
    near(blocks.chamberWater.scale.y, state.chamberWaterHeight, 0,
      `chamber water height at ${phase}`);
    near(blocks.compressedAir.scale.x,
      Math.cbrt(state.chamberAirVolume / geometry.sourceAirVolume),
    0, `air cushion volume scale at ${phase}`);
    assert.equal(blocks.wasteWater.visible,
      state.wasteValveOpen > 0.01);
    fixedBlocks.forEach((block, index) => vectorNear(
      block.position,
      fixedPositions[index],
      0,
      `fixed apparatus at ${phase}`,
    ));
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  near(closure.wasteValveOpen, source.wasteValveOpen, 0,
    'waste-valve cycle closure');
  near(closure.deliveryValveOpen, source.deliveryValveOpen, 0,
    'delivery-valve cycle closure');
  near(closure.chamberWaterVolume, source.chamberWaterVolume, 0,
    'chamber-volume cycle closure');
  near(closure.chamberAirPressure, source.chamberAirPressure, 0,
    'air-pressure cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 4.8);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 444 hydraulic ram', () => {
  const movement444 = catalog.movements[443];
  const movement507 = catalog.movements[506];
  const model444 = createMovementModel(movement444);
  const model507 = createMovementModel(movement507);

  assert.equal(movement444.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model444.root);
  disposeModel(model507.root);
});
