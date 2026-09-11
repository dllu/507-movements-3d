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
  'two-check-force-pump-with-globular-outlet-air-chamber-pulsed-downstroke-charge-and-single-selected-constant-flow-outlet';
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

test('movement 451 adds one globular air chamber and two source-shown takeoffs to the solid-piston force pump', () => {
  const movement = catalog.movements[450];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, metering } = data;

  assert.equal(movement.id, 451);
  assert.equal(movement.number, '451');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.barrel.parent, model.root);
  assert.equal(blocks.piston.parent, model.root);
  assert.equal(blocks.suctionValveDisk.parent, model.root);
  assert.equal(blocks.deliveryValveDisk.parent, model.root);
  assert.equal(blocks.chamberShell.parent, model.root);
  assert.equal(blocks.chamberWater.parent, model.root);
  assert.equal(blocks.compressedAir.parent, model.root);
  assert.equal(blocks.selectedOutlet.parent, model.root);
  assert.equal(blocks.alternativeOutlet.parent, model.root);
  assert.equal(blocks.alternativeCap.parent, model.root);
  assert.equal(metering.selectedOutlet, 'side-riser');
  assert.equal(metering.unselectedOutlet, 'central-dip-tube');
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.airPressureIndependent, false);
  assert.equal(degreesOfFreedom.outletFlowIndependent, false);

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  for (const role of [
    'solid-piston-feeding-air-chamber-on-downstroke',
    'globular-outlet-air-chamber',
    'elastic-air-cushion-maintaining-constant-outlet',
    'pulsed-water-delivery-into-air-chamber',
    'selected-side-outlet-from-air-chamber',
    'constant-flow-through-selected-air-chamber-outlet',
    'unselected-alternative-dip-tube-outlet',
    'cap-marking-alternative-outlet-not-simultaneously-active',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 451 source record captures constant flow, both outlet locations, and air compression timing', () => {
  const movement = catalog.movements[450];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate451;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_451.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /same as above.*addition of air-chamber/);
  assert.match(movement.description, /produce a constant flow/);
  assert.match(movement.description,
    /outlet from air-chamber is shown at two places/);
  assert.match(movement.description, /air is compressed.*downward stroke/);
  assert.match(movement.description,
    /expands and presses out the water.*during the up-stroke/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(dynamics.fullPressureWaveHeatTransferValveImpactLeakageCavitationAndAppliedLeverForceModeled,
    false);
  assert.match(dynamics.airCompressionModel,
    /isothermal p\*V constant.*closes each cycle without drift/);
  assert.match(dynamics.outletSelection,
    /two possible takeoff locations.*side riser alone is selected.*never double-counted/);
  assert.match(dynamics.pumpModel,
    /Movement 450.*upstroke suction and downstroke delivery/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateAirChamberCenterPixels, [143, 173]);
  assert.deepEqual(plate.approximateDeliveryCheckCenterPixels, [144, 313]);
  assert.deepEqual(plate.approximatePistonCenterPixels, [302, 313]);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence,
    /same right-hand solid-piston, two-check force pump.*large globular air chamber/);
  assert.match(evidence.reconstructionDisclosure,
    /no bore, stroke, chamber volume.*independently engineered/);
  disposeModel(model.root);
});

test('movement 451 preserves upstroke suction and downstroke chamber charging', () => {
  const model = createMovementModel(catalog.movements[450]);
  const { stateAtInputAngle } = model.root.userData;
  const atPhase = (phase) => stateAtInputAngle(FULL_TURN * phase);

  const up = atPhase(0);
  assert.equal(up.mode,
    'upstroke-suction-open-air-expanding-to-maintain-constant-outlet');
  near(up.suctionValveOpen, 1, 0, 'suction open upstroke');
  near(up.deliveryValveOpen, 0, 0, 'pump delivery shut upstroke');
  near(up.pumpDeliveryFlowRate, 0, 0, 'no chamber pulse upstroke');
  assert.ok(up.intakeFlowRate > 0);
  assert.ok(up.outputFlowRate > 0);

  const top = atPhase(0.25);
  assert.equal(top.mode,
    'top-dead-center-pump-checks-seated-air-chamber-supplying-outlet');
  near(top.suctionValveOpen, 0, 3e-48, 'suction seated at top');
  near(top.deliveryValveOpen, 0, 0, 'delivery seated at top');
  assert.ok(top.outputFlowRate > 0);

  const down = atPhase(0.5);
  assert.equal(down.mode,
    'downstroke-delivery-open-water-compressing-air-and-feeding-outlet');
  near(down.suctionValveOpen, 0, 0, 'suction shut downstroke');
  near(down.deliveryValveOpen, 1, 0, 'pump delivery open downstroke');
  near(down.intakeFlowRate, 0, 0, 'no suction on downstroke');
  assert.ok(down.pumpDeliveryFlowRate > down.outputFlowRate);

  const bottom = atPhase(0.75);
  assert.equal(bottom.mode,
    'bottom-dead-center-pump-checks-seated-air-chamber-supplying-outlet');
  near(bottom.suctionValveOpen, 0, 0, 'suction seated at bottom');
  near(bottom.deliveryValveOpen, 0, 7e-47, 'delivery seated at bottom');
  assert.ok(bottom.outputFlowRate > 0);
  disposeModel(model.root);
});

test('movement 451 output is exactly constant and only one of the two drawn outlets is active', () => {
  const model = createMovementModel(catalog.movements[450]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  for (let sample = -20000; sample <= 40000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    near(state.outputFlowRate, geometry.nominalOutputFlowRate, 0,
      `constant total output at ${sample}`);
    near(state.selectedOutletFlowRate, state.outputFlowRate, 0,
      `selected side flow at ${sample}`);
    near(state.unselectedOutletFlowRate, 0, 0,
      `capped central takeoff at ${sample}`);
    near(state.selectedOutletFlowRate + state.unselectedOutletFlowRate,
      state.outputFlowRate, 0,
    `outlets do not double count at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 451 chamber inventory obeys exact pulse-minus-outlet balance and closes without drift', () => {
  const model = createMovementModel(catalog.movements[450]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const samples = 40000;
  let pumpVolume = 0;
  let outputVolume = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * (sample + 0.5) / samples);
    near(state.chamberWaterVolumeRate,
      state.pumpDeliveryFlowRate - state.outputFlowRate,
    0, `air-chamber mass balance at ${sample}`);
    near(state.cylinderWaterVolumeRate,
      state.intakeFlowRate - state.pumpDeliveryFlowRate,
    0, `pump cylinder mass balance at ${sample}`);
    const dt = geometry.cycleDuration / samples;
    pumpVolume += state.pumpDeliveryFlowRate * dt;
    outputVolume += state.outputFlowRate * dt;
  }
  near(pumpVolume, geometry.deliveredVolumePerCycle, 1e-9,
    'integrated pump pulse is one swept volume');
  near(outputVolume, geometry.deliveredVolumePerCycle, 3e-13,
    'uniform output integrates to one swept volume');
  near(pumpVolume, outputVolume, 1e-9,
    'cycle chamber inflow equals output');
  const source = stateAtInputAngle(0);
  const closure = stateAtInputAngle(FULL_TURN);
  near(closure.chamberWaterVolume, source.chamberWaterVolume, 0,
    'chamber water closes');
  near(closure.cylinderWaterVolume, source.cylinderWaterVolume, 0,
    'pump cylinder water closes');
  disposeModel(model.root);
});

test('movement 451 isothermal air cushion compresses through the downstroke and expands through the upstroke', () => {
  const model = createMovementModel(catalog.movements[450]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let minimum = null;
  let maximum = null;
  for (let sample = 0; sample < 20000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    near(state.chamberAirVolume + state.chamberWaterVolume,
      geometry.chamberTotalInternalVolume, 3e-16,
    `fixed chamber volume at ${sample}`);
    near(state.chamberAirPressure * state.chamberAirVolume,
      geometry.chamberSourceAirPressure * geometry.chamberSourceAirVolume,
    3e-16, `isothermal invariant at ${sample}`);
    if (!minimum || state.chamberWaterVolume < minimum.chamberWaterVolume) {
      minimum = state;
    }
    if (!maximum || state.chamberWaterVolume > maximum.chamberWaterVolume) {
      maximum = state;
    }
  }
  assert.ok(maximum.phase > 0.65 && maximum.phase < 0.75);
  assert.ok(minimum.phase > 0.25 && minimum.phase < 0.35);
  assert.ok(maximum.chamberAirPressure > minimum.chamberAirPressure);
  near(minimum.phase, geometry.chamberWaterMinimumPhase, 5e-5,
    'minimum occurs where new pulse catches constant outlet');
  near(maximum.phase, geometry.chamberWaterMaximumPhase, 5e-5,
    'maximum occurs where waning pulse falls below outlet');
  near(minimum.chamberWaterVolume, geometry.chamberWaterMinimum, 2e-9,
    'minimum inventory envelope');
  near(maximum.chamberWaterVolume, geometry.chamberWaterMaximum, 2e-9,
    'maximum inventory envelope');
  disposeModel(model.root);
});

test('movement 451 force-pump checks remain mutually exclusive and C2 at reversals', () => {
  const model = createMovementModel(catalog.movements[450]);
  const { stateAtInputAngle } = model.root.userData;
  for (let sample = -10000; sample <= 20000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 10000);
    near(state.suctionValveOpen * state.deliveryValveOpen, 0, 0,
      `check interlock at ${sample}`);
  }
  const step = 1e-5;
  for (const boundary of [FULL_TURN * 0.25, FULL_TURN * 0.75]) {
    for (const key of ['suctionValveOpen', 'deliveryValveOpen']) {
      const before = stateAtInputAngle(boundary - step)[key];
      const center = stateAtInputAngle(boundary)[key];
      const after = stateAtInputAngle(boundary + step)[key];
      near((after - before) / (2 * step), 0, 2e-10,
        `${key} zero closure velocity at ${boundary}`);
      near((after - 2 * center + before) / step ** 2, 0, 4e-5,
        `${key} zero closure acceleration at ${boundary}`);
    }
  }
  disposeModel(model.root);
});

test('movement 451 keeps its rigid lever-slider closure exact', () => {
  const model = createMovementModel(catalog.movements[450]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  for (let sample = -12000; sample <= 24000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 12000);
    near(state.pistonRodJoint.x, geometry.pumpX, 0,
      `slider remains on pump axis at ${sample}`);
    near(state.leverPin.distanceTo(state.pistonRodJoint),
      geometry.sliderLinkLength, 3e-16,
    `rigid slider link at ${sample}`);
    near(state.pistonRodJoint.y - state.pistonY,
      geometry.pistonRodJointOffset, 5e-16,
    `constant rod offset at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 451 update maps the pulse, chamber inventory, air scale, and linkage while fixed plumbing stays fixed', () => {
  const model = createMovementModel(catalog.movements[450]);
  const {
    blocks,
    geometry,
    sliderLinkEndpoints,
    stateAtTime,
    update,
  } = model.root.userData;
  const fixedBlocks = [blocks.alternativeCap, blocks.alternativeOutlet,
    blocks.barrel, blocks.barrelRails, blocks.base, blocks.chamberNeck,
    blocks.chamberShell, blocks.deliveryValveSeat,
    blocks.pumpDeliveryPipe, blocks.selectedOutlet, blocks.sourceWell,
    blocks.suctionPipe, blocks.suctionValveSeat];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());

  for (const phase of [0, 0.125, 0.25, 0.375, 0.5,
    0.625, 0.75, 0.875, 1]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    model.root.updateMatrixWorld(true);
    vectorNear(blocks.piston.position,
      new THREE.Vector3(geometry.pumpX, state.pistonY, 0), 0,
    `piston transform at ${phase}`);
    near(blocks.lever.rotation.z, state.leverAngle, 0,
      `lever transform at ${phase}`);
    near(blocks.sliderLink.scale.y, geometry.sliderLinkLength, 3e-16,
      `slider-link length at ${phase}`);
    const endpoints = sliderLinkEndpoints();
    vectorNear(endpoints.slider, state.pistonRodJoint, 8e-16,
      `slider endpoint at ${phase}`);
    vectorNear(endpoints.lever, state.leverPin, 8e-16,
      `lever endpoint at ${phase}`);
    near(blocks.compressedAir.scale.x,
      Math.cbrt(state.chamberAirVolume
        / geometry.chamberSourceAirVolume), 0,
    `rendered air volume scale at ${phase}`);
    assert.ok(blocks.outletMarkers.every((marker) => marker.visible));
    fixedBlocks.forEach((block, index) => vectorNear(
      block.position,
      fixedPositions[index],
      0,
      `fixed air-chamber pump part at ${phase}`,
    ));
  }
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 5.2);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier', () => {
  const movement451 = catalog.movements[450];
  const movement507 = catalog.movements[506];
  const model451 = createMovementModel(movement451);
  const model507 = createMovementModel(movement507);

  assert.equal(movement451.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model451.root);
  disposeModel(model507.root);
});
