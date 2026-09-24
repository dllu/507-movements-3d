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
  'modern-lifting-pump-with-stuffing-box-valved-bucket-lower-check-and-upward-opening-high-delivery-flap';
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

test('movement 449 has a stuffing-box rod, valved bucket, lower check, and upward delivery flap but no hand lever', () => {
  const movement = catalog.movements[448];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 449);
  assert.equal(movement.number, '449');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.barrel.parent, model.root);
  assert.equal(blocks.stuffingBox.parent, model.root);
  assert.equal(blocks.pumpRod.parent, model.root);
  assert.equal(blocks.piston.parent, model.root);
  assert.equal(blocks.pistonValveDisk.parent, blocks.piston);
  assert.equal(blocks.footValveDisk.parent, model.root);
  assert.equal(blocks.deliveryPipe.parent, model.root);
  assert.equal(blocks.deliveryFlapSeat.parent, model.root);
  assert.equal(blocks.deliveryFlapPivot.parent, model.root);
  assert.equal(blocks.deliveryFlap.parent, blocks.deliveryFlapPivot);
  assert.equal(blocks.lever, undefined);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.footValveIndependent, false);
  assert.equal(degreesOfFreedom.pistonValveIndependent, false);
  assert.equal(degreesOfFreedom.deliveryFlapIndependent, false);

  const roles = [];
  const belts = [];
  const ropes = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.isRope) ropes.push(object);
  });
  assert.deepEqual(belts, []);
  assert.deepEqual(ropes, []);
  for (const role of [
    'fixed-enclosed-modern-lift-pump-barrel',
    'fixed-stuffing-box-sealing-sliding-piston-rod',
    'piston-rod-sliding-through-stuffing-box',
    'moving-valved-bucket-in-modern-lift-pump',
    'lower-check-opening-on-upstroke',
    'bucket-check-opening-on-downstroke',
    'fixed-high-level-delivery-riser',
    'fixed-upward-delivery-flap-seat',
    'outlet-flap-opening-upward-on-upstroke',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 449 source evidence identifies every difference from the preceding open-spout lift pump', () => {
  const movement = catalog.movements[448];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate449;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_449.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Modern lifting pump/);
  assert.match(movement.description, /same manner as one in previous figure/);
  assert.match(movement.description, /piston-rod passes through stuffing-box/);
  assert.match(movement.description,
    /outlet is closed by a flap-valve opening upward/);
  assert.match(movement.description, /lifted to any height above this pump/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(dynamics.airExhaustionInitialPrimingAndAppliedRodForceModeled,
    false);
  assert.match(dynamics.checkValveModel,
    /Foot and high-delivery checks.*bucket check.*delivery flap opens geometrically upward/);
  assert.match(dynamics.flowModel,
    /primed incompressible volume model.*delivery flap retains the rising-main column/);
  assert.match(dynamics.unlimitedLiftStatement,
    /not limited by atmospheric suction head.*required rod force.*not solved/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateBucketCenterPixels, [266, 331]);
  assert.deepEqual(plate.approximateDeliveryFlapCenterPixels, [376, 110]);
  assert.deepEqual(plate.approximateStuffingBoxCenterPixels, [248, 169]);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence,
    /bottom check.*valved bucket.*packed top opening.*tall delivery riser.*upward-opening flap/);
  assert.match(evidence.reconstructionDisclosure,
    /no bore, stroke.*flap angle.*independently engineered/);
  disposeModel(model.root);
});

test('movement 449 opens foot and delivery checks together on upstroke and only the bucket check on downstroke', () => {
  const model = createMovementModel(catalog.movements[448]);
  const { stateAtInputAngle } = model.root.userData;
  const atPhase = (phase) => stateAtInputAngle(FULL_TURN * phase);

  const up = atPhase(0);
  assert.equal(up.mode,
    'upstroke-foot-and-delivery-checks-open-bucket-check-shut');
  near(up.footValveOpen, 1, 0, 'foot open upstroke');
  near(up.deliveryValveOpen, 1, 0, 'delivery open upstroke');
  near(up.pistonValveOpen, 0, 0, 'bucket shut upstroke');
  assert.ok(up.pistonVelocity > 0);
  near(up.intakeFlowRate, up.dischargeFlowRate, 0,
    'equal upstroke intake and delivery');
  assert.ok(up.dischargeFlowRate > 0);

  const top = atPhase(0.25);
  assert.equal(top.mode, 'top-dead-center-all-three-checks-seated');
  near(top.footValveOpen, 0, 3e-48, 'foot seated at top');
  near(top.deliveryValveOpen, 0, 3e-48, 'delivery seated at top');
  near(top.pistonValveOpen, 0, 0, 'bucket seated at top');

  const down = atPhase(0.5);
  assert.equal(down.mode,
    'downstroke-foot-and-delivery-checks-shut-bucket-check-open');
  near(down.footValveOpen, 0, 0, 'foot shut downstroke');
  near(down.deliveryValveOpen, 0, 0, 'delivery shut downstroke');
  near(down.pistonValveOpen, 1, 0, 'bucket open downstroke');
  assert.ok(down.pistonVelocity < 0);
  assert.ok(down.pistonTransferFlowRate > 0);
  near(down.intakeFlowRate, 0, 0, 'no intake downstroke');
  near(down.dischargeFlowRate, 0, 0, 'delivery retained downstroke');

  const bottom = atPhase(0.75);
  assert.equal(bottom.mode, 'bottom-dead-center-all-three-checks-seated');
  near(bottom.footValveOpen, 0, 0, 'foot seated at bottom');
  near(bottom.deliveryValveOpen, 0, 0, 'delivery seated at bottom');
  near(bottom.pistonValveOpen, 0, 7e-47, 'bucket seated at bottom');
  disposeModel(model.root);
});

test('movement 449 delivery flap rotates upward only and no inlet or delivery check overlaps the bucket check', () => {
  const model = createMovementModel(catalog.movements[448]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  for (let sample = -20000; sample <= 40000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    near(state.footValveOpen, state.deliveryValveOpen, 0,
      `synchronous inlet and delivery at ${sample}`);
    near(state.footValveOpen * state.pistonValveOpen, 0, 0,
      `foot/bucket interlock at ${sample}`);
    near(state.deliveryValveOpen * state.pistonValveOpen, 0, 0,
      `delivery/bucket interlock at ${sample}`);
    assert.ok(state.deliveryFlapAngle >= 0);
    assert.ok(state.deliveryFlapAngle
      <= geometry.maximumDeliveryFlapAngle);
  }
  near(stateAtInputAngle(0).deliveryFlapAngle,
    geometry.maximumDeliveryFlapAngle, 0, 'maximum upward flap opening');
  near(stateAtInputAngle(Math.PI).deliveryFlapAngle, 0, 0,
    'delivery flap closed on downstroke');
  disposeModel(model.root);
});

test('movement 449 all three C2 check signals seat smoothly at dead centers', () => {
  const model = createMovementModel(catalog.movements[448]);
  const { stateAtInputAngle } = model.root.userData;
  const step = 1e-5;
  for (const boundary of [FULL_TURN * 0.25, FULL_TURN * 0.75]) {
    for (const key of [
      'footValveOpen',
      'pistonValveOpen',
      'deliveryValveOpen',
    ]) {
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

test('movement 449 chamber volumes satisfy exact flow balance and the elevated retained column has no return flow', () => {
  const model = createMovementModel(catalog.movements[448]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const samples = 40000;
  let intakeVolume = 0;
  let transferVolume = 0;
  let deliveryVolume = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * (sample + 0.5) / samples);
    near(state.lowerChamberWaterVolumeRate,
      state.intakeFlowRate - state.pistonTransferFlowRate,
    0, `lower chamber balance at ${sample}`);
    near(state.upperChamberWaterVolumeRate,
      state.pistonTransferFlowRate - state.dischargeFlowRate,
    0, `upper chamber balance at ${sample}`);
    assert.ok(state.dischargeFlowRate >= 0,
      'delivery check prevents return flow');
    const dt = geometry.cycleDuration / samples;
    intakeVolume += state.intakeFlowRate * dt;
    transferVolume += state.pistonTransferFlowRate * dt;
    deliveryVolume += state.dischargeFlowRate * dt;
  }
  near(intakeVolume, deliveryVolume, 0,
    'cycle intake equals high delivery');
  near(transferVolume, intakeVolume, 2e-14,
    'downstroke bucket transfer equals upstroke intake');
  const source = stateAtInputAngle(0);
  const closure = stateAtInputAngle(FULL_TURN);
  near(closure.lowerChamberWaterVolume,
    source.lowerChamberWaterVolume, 0, 'lower chamber closes');
  near(closure.upperChamberWaterVolume,
    source.upperChamberWaterVolume, 0, 'upper chamber closes');
  disposeModel(model.root);
});

test('movement 449 rod remains centered through the fixed stuffing box and its high riser extends above the pump head', () => {
  const model = createMovementModel(catalog.movements[448]);
  const { blocks, geometry, stateAtInputAngle } = model.root.userData;
  assert.equal(blocks.stuffingBox.position.x, 0);
  assert.equal(blocks.pumpRod.position.x, 0);
  assert.ok(geometry.deliveryFlapY > geometry.stuffingBoxY);
  for (let sample = 0; sample < 10000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 10000);
    near(state.rodTopY - state.rodBottomY,
      geometry.pumpRodLength, 5e-16,
    `constant rod length at ${sample}`);
    assert.ok(state.rodBottomY < geometry.stuffingBoxY);
    assert.ok(state.rodTopY > geometry.stuffingBoxY);
  }
  disposeModel(model.root);
});

test('movement 449 update maps piston, rod, checks, and upward flap exactly while fixed pressure parts do not move', () => {
  const model = createMovementModel(catalog.movements[448]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [blocks.base, blocks.barrel, blocks.barrelRails,
    blocks.deliveryBell, blocks.deliveryFlapSeat, blocks.deliveryPipe,
    blocks.footValveSeat, blocks.sourceWell, blocks.stuffingBox,
    blocks.suctionPipe, blocks.topCover];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());
  const fixedRotations = fixedBlocks.map((block) => block.rotation.clone());

  for (const phase of [0, 0.125, 0.25, 0.375, 0.5,
    0.625, 0.75, 0.875, 1]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    near(blocks.piston.position.y, state.pistonY, 0,
      `piston transform at ${phase}`);
    near(blocks.footValveDisk.position.y,
      geometry.footValveSeatY + 0.08 + state.footValveLift, 0,
    `foot check transform at ${phase}`);
    near(blocks.pistonValveDisk.position.y,
      geometry.pistonThickness / 2 + 0.07 + state.pistonValveLift, 0,
    `bucket check transform at ${phase}`);
    near(blocks.deliveryFlapPivot.rotation.z,
      state.deliveryFlapAngle, 0,
    `upward flap transform at ${phase}`);
    near(blocks.pumpRod.position.y,
      (state.rodBottomY + state.rodTopY) / 2, 0,
    `sliding rod transform at ${phase}`);
    fixedBlocks.forEach((block, index) => {
      vectorNear(block.position, fixedPositions[index], 0,
        `fixed pressure part at ${phase}`);
      near(block.rotation.x, fixedRotations[index].x, 0,
        `fixed x rotation at ${phase}`);
      near(block.rotation.y, fixedRotations[index].y, 0,
        `fixed y rotation at ${phase}`);
      near(block.rotation.z, fixedRotations[index].z, 0,
        `fixed z rotation at ${phase}`);
    });
  }
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 4.8);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier', () => {
  const movement449 = catalog.movements[448];
  const movement507 = catalog.movements[506];
  const model449 = createMovementModel(movement449);
  const model507 = createMovementModel(movement507);

  assert.equal(movement449.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model449.root);
  disposeModel(model507.root);
});
