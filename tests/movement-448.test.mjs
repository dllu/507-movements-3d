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
  'common-lift-pump-with-lower-foot-check-valve-valved-bucket-hand-lever-suction-pipe-and-upstroke-spout-discharge';
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

test('movement 448 has a foot check, a check inside the bucket, a lever drive, suction pipe, and side spout', () => {
  const movement = catalog.movements[447];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 448);
  assert.equal(movement.number, '448');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.barrel.parent, model.root);
  assert.equal(blocks.suctionPipe.parent, model.root);
  assert.equal(blocks.footValveSeat.parent, model.root);
  assert.equal(blocks.footValveDisk.parent, model.root);
  assert.equal(blocks.piston.parent, model.root);
  assert.equal(blocks.pistonValveSeat.parent, blocks.piston);
  assert.equal(blocks.pistonValveDisk.parent, blocks.piston);
  assert.equal(blocks.lever.parent, model.root);
  assert.equal(blocks.connectingRod.parent, model.root);
  assert.equal(blocks.spout.parent, model.root);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.footValveIndependent, false);
  assert.equal(degreesOfFreedom.pistonValveIndependent, false);
  assert.equal(degreesOfFreedom.leverIndependent, false);

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
    'fixed-vertical-lift-pump-barrel',
    'fixed-suction-pipe-below-foot-valve',
    'fixed-lower-foot-valve-seat',
    'lower-check-valve-opening-only-on-upstroke',
    'moving-piston-or-bucket',
    'valve-seat-within-moving-piston',
    'bucket-check-valve-opening-only-on-downstroke',
    'hand-lever-rocking-on-fixed-pivot',
    'vertical-pump-rod-driving-bucket',
    'fixed-side-overflow-spout',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 448 records Brown’s common lift-pump evidence and simulation limits', () => {
  const movement = catalog.movements[447];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate448;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_448.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Common lift pump/);
  assert.match(movement.description,
    /up-stroke.*lower valve opens.*valve in piston shuts/);
  assert.match(movement.description,
    /down-stroke.*lower valve is shut.*valve in piston opens/);
  assert.match(movement.description, /runs over out of spout at each up-stroke/);
  assert.match(movement.description, /cannot raise water over thirty feet/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(dynamics.airExhaustionAndInitialPrimingModeled, false);
  assert.match(dynamics.checkValveModel,
    /cube.*disjoint support.*never be open together/);
  assert.match(dynamics.flowModel,
    /fully primed incompressible steady cycle.*Leakage.*not solved/);
  assert.match(dynamics.thirtyFootLimit,
    /source information.*not scaled or simulated/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateBucketCenterPixels, [261, 275]);
  assert.deepEqual(plate.approximateFootValveCenterPixels, [259, 445]);
  assert.deepEqual(plate.approximateLeverPivotPixels, [345, 68]);
  assert.deepEqual(plate.approximateSpoutMouthPixels, [153, 220]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.engravingEvidence,
    /vertical suction pipe and barrel.*bottom clack.*valved bucket.*side spout/);
  assert.match(evidence.reconstructionDisclosure,
    /no barrel diameter, stroke.*independently engineered/);
  disposeModel(model.root);
});

test('movement 448 follows the exact two-stroke check-valve and flow sequence', () => {
  const model = createMovementModel(catalog.movements[447]);
  const { stateAtInputAngle } = model.root.userData;
  const atPhase = (phase) => stateAtInputAngle(FULL_TURN * phase);

  const up = atPhase(0);
  assert.equal(up.mode,
    'upstroke-foot-valve-open-bucket-valve-shut-lifting-and-discharging');
  near(up.footValveOpen, 1, 0, 'foot check fully open mid-upstroke');
  near(up.pistonValveOpen, 0, 0, 'bucket check shut mid-upstroke');
  assert.ok(up.pistonVelocity > 0);
  assert.ok(up.intakeFlowRate > 0);
  near(up.dischargeFlowRate, up.intakeFlowRate, 0,
    'upstroke intake equals discharge');
  near(up.pistonTransferFlowRate, 0, 0,
    'no through-bucket transfer on upstroke');

  const top = atPhase(0.25);
  assert.equal(top.mode, 'top-dead-center-both-check-valves-seated');
  near(top.footValveOpen, 0, 3e-48, 'foot check seated at top');
  near(top.pistonValveOpen, 0, 0, 'bucket check seated at top');
  near(top.pistonVelocity, 0, 4e-17, 'piston stopped at top');

  const down = atPhase(0.5);
  assert.equal(down.mode,
    'downstroke-foot-valve-shut-bucket-valve-open-water-passing-through-piston');
  near(down.footValveOpen, 0, 0, 'foot check shut mid-downstroke');
  near(down.pistonValveOpen, 1, 0,
    'bucket check fully open mid-downstroke');
  assert.ok(down.pistonVelocity < 0);
  near(down.intakeFlowRate, 0, 0, 'no intake on downstroke');
  near(down.dischargeFlowRate, 0, 0, 'no discharge on downstroke');
  assert.ok(down.pistonTransferFlowRate > 0);

  const bottom = atPhase(0.75);
  assert.equal(bottom.mode,
    'bottom-dead-center-both-check-valves-seated');
  near(bottom.footValveOpen, 0, 0, 'foot check seated at bottom');
  near(bottom.pistonValveOpen, 0, 7e-47,
    'bucket check seated at bottom');
  disposeModel(model.root);
});

test('movement 448 check valves have disjoint support and C2 closure at both dead centers', () => {
  const model = createMovementModel(catalog.movements[447]);
  const { stateAtInputAngle } = model.root.userData;
  for (let sample = -20000; sample <= 40000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    near(state.footValveOpen * state.pistonValveOpen, 0, 0,
      `valve interlock at ${sample}`);
    assert.ok(state.footValveOpen >= 0 && state.footValveOpen <= 1);
    assert.ok(state.pistonValveOpen >= 0 && state.pistonValveOpen <= 1);
  }
  const step = 1e-5;
  for (const boundary of [FULL_TURN * 0.25, FULL_TURN * 0.75]) {
    for (const key of ['footValveOpen', 'pistonValveOpen']) {
      const before = stateAtInputAngle(boundary - step)[key];
      const center = stateAtInputAngle(boundary)[key];
      const after = stateAtInputAngle(boundary + step)[key];
      near((after - before) / (2 * step), 0, 2e-10,
        `${key} zero endpoint velocity at ${boundary}`);
      near((after - 2 * center + before) / step ** 2, 0, 4e-5,
        `${key} zero endpoint acceleration at ${boundary}`);
    }
  }
  disposeModel(model.root);
});

test('movement 448 rigid lever link closes exactly from rocking pin to centerline pump rod', () => {
  const model = createMovementModel(catalog.movements[447]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  for (let sample = -16000; sample <= 32000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 16000);
    near(state.pistonRodJoint.x, 0, 0,
      `pump rod joint remains on centerline at ${sample}`);
    near(state.leverPin.distanceTo(state.pistonRodJoint),
      geometry.connectingRodLength, 5e-16,
    `rigid link length at ${sample}`);
    near(state.pistonRodJoint.y - state.pistonY,
      geometry.pistonJointOffsetY, 5e-16,
    `fixed piston joint offset at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 448 analytical piston velocity and acceleration match finite differences', () => {
  const model = createMovementModel(catalog.movements[447]);
  const { stateAtInputAngle } = model.root.userData;
  const speed = 0.83;
  const step = 2e-5;
  for (const angle of [-5.2, -1.4, 0.2, 2.0, 5.7]) {
    const before = stateAtInputAngle(angle - step, speed).pistonY;
    const center = stateAtInputAngle(angle, speed);
    const after = stateAtInputAngle(angle + step, speed).pistonY;
    const numericalVelocity = (after - before) / (2 * step) * speed;
    const numericalAcceleration = (after - 2 * center.pistonY + before)
      / step ** 2 * speed ** 2;
    near(center.pistonVelocity, numericalVelocity, 3e-10,
      `piston velocity at ${angle}`);
    near(center.pistonAcceleration, numericalAcceleration, 2e-6,
      `piston acceleration at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 448 lower and upper water volumes obey exact instantaneous mass balance', () => {
  const model = createMovementModel(catalog.movements[447]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const samples = 40000;
  let intakeVolume = 0;
  let transferVolume = 0;
  let dischargeVolume = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * (sample + 0.5) / samples);
    near(state.lowerChamberWaterVolumeRate,
      state.intakeFlowRate - state.pistonTransferFlowRate,
    0, `lower chamber balance at ${sample}`);
    near(state.upperChamberWaterVolumeRate,
      state.pistonTransferFlowRate - state.dischargeFlowRate,
    0, `upper chamber balance at ${sample}`);
    const dt = geometry.cycleDuration / samples;
    intakeVolume += state.intakeFlowRate * dt;
    transferVolume += state.pistonTransferFlowRate * dt;
    dischargeVolume += state.dischargeFlowRate * dt;
  }
  near(intakeVolume, dischargeVolume, 0,
    'cycle intake equals discharge pointwise');
  near(transferVolume, intakeVolume, 2e-14,
    'downstroke transfer equals upstroke intake');
  const source = stateAtInputAngle(0);
  const closure = stateAtInputAngle(FULL_TURN);
  near(closure.lowerChamberWaterVolume,
    source.lowerChamberWaterVolume, 0, 'lower volume closure');
  near(closure.upperChamberWaterVolume,
    source.upperChamberWaterVolume, 0, 'upper volume closure');
  disposeModel(model.root);
});

test('movement 448 update maps linkage, piston, checks, and water extents exactly while fixed parts stay fixed', () => {
  const model = createMovementModel(catalog.movements[447]);
  const { blocks, geometry, rodEndpoints, stateAtTime, update } =
    model.root.userData;
  const fixedBlocks = [blocks.base, blocks.barrel, blocks.barrelRearFrame,
    blocks.footValveSeat, blocks.spout, blocks.suctionPipe, blocks.well];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());

  for (const phase of [0, 0.125, 0.25, 0.375, 0.5,
    0.625, 0.75, 0.875, 1]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.piston.position.y, state.pistonY, 0,
      `piston transform at ${phase}`);
    near(blocks.lever.rotation.z, state.leverAngle, 0,
      `lever transform at ${phase}`);
    near(blocks.footValveDisk.position.y,
      geometry.footValveSeatY + 0.08 + state.footValveLift, 0,
    `foot check lift at ${phase}`);
    near(blocks.pistonValveDisk.position.y,
      geometry.pistonThickness / 2 + 0.07 + state.pistonValveLift, 0,
    `bucket check lift at ${phase}`);
    near(blocks.connectingRod.scale.y,
      geometry.connectingRodLength, 5e-16,
    `rendered rigid-link length at ${phase}`);
    const endpoints = rodEndpoints();
    vectorNear(endpoints.piston, state.pistonRodJoint.clone().setZ(.27), 8e-16,
      `rod piston endpoint at ${phase}`);
    vectorNear(endpoints.lever, state.leverPin.clone().setZ(.27), 8e-16,
      `rod lever endpoint at ${phase}`);
    // Pass 69: one stream runs through the spout and falls from its lip,
    // present exactly while the upstroke discharges.
    assert.equal(blocks.spill.visible, state.dischargeFlowRate > 0);
    fixedBlocks.forEach((block, index) => vectorNear(
      block.position,
      fixedPositions[index],
      0,
      `fixed pump part at ${phase}`,
    ));
  }
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 5.4);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier', () => {
  const movement448 = catalog.movements[447];
  const movement507 = catalog.movements[506];
  const model448 = createMovementModel(movement448);
  const model507 = createMovementModel(movement507);

  assert.equal(movement448.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model448.root);
  disposeModel(model507.root);
});
