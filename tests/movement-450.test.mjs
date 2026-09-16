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
  'ordinary-two-check-force-pump-with-solid-piston-upstroke-suction-and-downstroke-elevated-delivery';
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

test('movement 450 has an above-water cylinder, solid piston, and exactly two external checks', () => {
  const movement = catalog.movements[449];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 450);
  assert.equal(movement.number, '450');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.barrel.parent, model.root);
  assert.equal(blocks.sourceWell.parent, model.root);
  assert.equal(blocks.suctionPipe.parent, model.root);
  assert.equal(blocks.piston.parent, model.root);
  assert.equal(blocks.pistonBody.parent, blocks.piston);
  assert.equal(blocks.pistonValveDisk, undefined);
  assert.equal(blocks.suctionValveSeat.parent, model.root);
  assert.equal(blocks.suctionValveDisk.parent, model.root);
  assert.equal(blocks.deliveryValveSeat.parent, model.root);
  assert.equal(blocks.deliveryValveDisk.parent, model.root);
  assert.equal(blocks.deliveryPipe.parent, model.root);
  assert.equal(blocks.lever.parent, model.root);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.suctionValveIndependent, false);
  assert.equal(degreesOfFreedom.deliveryValveIndependent, false);
  assert.equal(degreesOfFreedom.leverIndependent, false);

  const roles = [];
  const valveRoles = [];
  model.root.traverse((object) => {
    const role = object.userData.role;
    if (role) roles.push(role);
    if (role?.includes('check-opening-only')) valveRoles.push(role);
  });
  assert.deepEqual(valveRoles.sort(), [
    'outlet-check-opening-only-on-piston-downstroke',
    'suction-check-opening-only-on-piston-upstroke',
  ]);
  for (const role of [
    'fixed-force-pump-cylinder-above-water',
    'solid-force-pump-piston-with-no-through-valve',
    'single-water-chamber-below-solid-piston',
    'fixed-suction-pipe',
    'fixed-delivery-pipe-to-any-distance-or-elevation',
    'hand-lever-rocking-about-fixed-left-pivot',
    'short-rigid-link-from-lever-to-centerline-pump-rod',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 450 source record preserves the two-valve force-pump distinctions and model limits', () => {
  const movement = catalog.movements[449];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate450;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_450.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Ordinary force pump, with two valves/);
  assert.match(movement.description, /cylinder is above water.*solid piston/);
  assert.match(movement.description, /piston is rising suction-valve is open/);
  assert.match(movement.description,
    /descent.*suction-valve closes.*forced up through outlet-valve/);
  assert.match(movement.description, /any distance or elevation/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(dynamics.fullPressureWaterColumnInertiaValveImpactLeakageAndAppliedLeverForceModeled,
    false);
  assert.match(dynamics.checkValveModel,
    /disjoint positive\/negative cubic velocity lobes.*never be open together/);
  assert.match(dynamics.flowModel,
    /primed incompressible cylinder.*swept-volume derivative/);
  assert.match(dynamics.unlimitedDeliveryStatement,
    /positive displacement rather than unlimited real pressure/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximatePistonCenterPixels, [237, 311]);
  assert.deepEqual(plate.approximateSuctionValveCenterPixels, [233, 454]);
  assert.deepEqual(plate.approximateDeliveryValveCenterPixels, [112, 354]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.engravingEvidence,
    /lower suction tube and check.*solid piston.*separate outlet-check chamber.*tall left riser/);
  assert.match(evidence.reconstructionDisclosure,
    /no bore, stroke.*delivery height.*independently engineered/);
  disposeModel(model.root);
});

test('movement 450 draws on the upstroke and forces delivery only on the downstroke', () => {
  const model = createMovementModel(catalog.movements[449]);
  const { stateAtInputAngle } = model.root.userData;
  const atPhase = (phase) => stateAtInputAngle(FULL_TURN * phase);

  const up = atPhase(0);
  assert.equal(up.mode,
    'upstroke-suction-check-open-delivery-check-shut-cylinder-filling');
  near(up.suctionValveOpen, 1, 0, 'suction open upstroke');
  near(up.deliveryValveOpen, 0, 0, 'delivery shut upstroke');
  assert.ok(up.pistonVelocity > 0);
  assert.ok(up.intakeFlowRate > 0);
  near(up.deliveryFlowRate, 0, 0, 'no upstroke delivery');

  const top = atPhase(0.25);
  assert.equal(top.mode,
    'top-dead-center-both-force-pump-checks-seated');
  near(top.suctionValveOpen, 0, 3e-48, 'suction seated at top');
  near(top.deliveryValveOpen, 0, 0, 'delivery seated at top');

  const down = atPhase(0.5);
  assert.equal(down.mode,
    'downstroke-suction-check-shut-delivery-check-open-forcing-water-up-riser');
  near(down.suctionValveOpen, 0, 0, 'suction shut downstroke');
  near(down.deliveryValveOpen, 1, 0, 'delivery open downstroke');
  assert.ok(down.pistonVelocity < 0);
  near(down.intakeFlowRate, 0, 0, 'no downstroke intake');
  assert.ok(down.deliveryFlowRate > 0);

  const bottom = atPhase(0.75);
  assert.equal(bottom.mode,
    'bottom-dead-center-both-force-pump-checks-seated');
  near(bottom.suctionValveOpen, 0, 0, 'suction seated at bottom');
  near(bottom.deliveryValveOpen, 0, 7e-47, 'delivery seated at bottom');
  disposeModel(model.root);
});

test('movement 450 two check valves are mutually exclusive and C2 at each reversal', () => {
  const model = createMovementModel(catalog.movements[449]);
  const { stateAtInputAngle } = model.root.userData;
  for (let sample = -20000; sample <= 40000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    near(state.suctionValveOpen * state.deliveryValveOpen, 0, 0,
      `two-check interlock at ${sample}`);
    assert.ok(state.suctionValveOpen >= 0
      && state.suctionValveOpen <= 1);
    assert.ok(state.deliveryValveOpen >= 0
      && state.deliveryValveOpen <= 1);
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

test('movement 450 short lever-slider link and vertical piston-rod offset remain exact', () => {
  const model = createMovementModel(catalog.movements[449]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  for (let sample = -16000; sample <= 32000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 16000);
    near(state.pistonRodJoint.x, 0, 0,
      `slider joint on barrel centerline at ${sample}`);
    near(state.leverPin.distanceTo(state.pistonRodJoint),
      geometry.sliderLinkLength, 3e-16,
    `short rigid-link length at ${sample}`);
    near(state.pistonRodJoint.y - state.pistonY,
      geometry.pistonRodJointOffset, 5e-16,
    `fixed vertical rod offset at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 450 analytical solid-piston velocity and acceleration match finite differences', () => {
  const model = createMovementModel(catalog.movements[449]);
  const { stateAtInputAngle } = model.root.userData;
  const speed = 0.79;
  const step = 2e-5;
  for (const angle of [-5.0, -1.3, 0.2, 1.9, 5.8]) {
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

test('movement 450 cylinder swept volume exactly equals suction inflow minus forced delivery', () => {
  const model = createMovementModel(catalog.movements[449]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const samples = 40000;
  let intakeVolume = 0;
  let deliveryVolume = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * (sample + 0.5) / samples);
    near(state.cylinderWaterVolumeRate,
      state.intakeFlowRate - state.deliveryFlowRate,
    0, `single-chamber balance at ${sample}`);
    assert.ok(state.intakeFlowRate >= 0);
    assert.ok(state.deliveryFlowRate >= 0);
    const dt = geometry.cycleDuration / samples;
    intakeVolume += state.intakeFlowRate * dt;
    deliveryVolume += state.deliveryFlowRate * dt;
  }
  near(deliveryVolume, intakeVolume, 2e-14,
    'cycle forced delivery equals suction intake');
  const source = stateAtInputAngle(0);
  const closure = stateAtInputAngle(FULL_TURN);
  near(closure.cylinderWaterVolume, source.cylinderWaterVolume, 0,
    'cylinder inventory closes');
  near(closure.pistonY, source.pistonY, 0, 'solid piston closes');
  disposeModel(model.root);
});

test('movement 450 update maps solid piston, lever linkage, two checks, and flow while pressure hardware remains fixed', () => {
  const model = createMovementModel(catalog.movements[449]);
  const {
    blocks,
    geometry,
    sliderLinkEndpoints,
    stateAtTime,
    update,
  } = model.root.userData;
  const fixedBlocks = [blocks.base, blocks.barrel, blocks.barrelRails,
    blocks.deliveryPipe, blocks.deliveryValveBody,
    blocks.deliveryValveSeat, blocks.pivotSupport, blocks.sourceWell,
    blocks.suctionPipe, blocks.suctionValveSeat];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());

  for (const phase of [0, 0.125, 0.25, 0.375, 0.5,
    0.625, 0.75, 0.875, 1]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.piston.position.y, state.pistonY, 0,
      `solid piston transform at ${phase}`);
    near(blocks.lever.rotation.z, state.leverAngle, 0,
      `lever transform at ${phase}`);
    near(blocks.suctionValveDisk.position.y,
      geometry.suctionValveSeatY + 0.08 + state.suctionValveLift, 0,
    `suction check transform at ${phase}`);
    near(blocks.deliveryValveDisk.position.y,
      geometry.deliveryValveSeatY + 0.08 + state.deliveryValveLift, 0,
    `delivery check transform at ${phase}`);
    near(blocks.sliderLink.scale.y, geometry.sliderLinkLength, 3e-16,
      `rendered short-link length at ${phase}`);
    near(blocks.pumpRod.scale.y,
      geometry.pistonRodJointOffset - geometry.pistonThickness / 2,
    5e-16, `rendered pump-rod length at ${phase}`);
    const endpoints = sliderLinkEndpoints();
    vectorNear(endpoints.slider, state.pistonRodJoint.clone().setZ(.26), 8e-16,
      `rendered slider endpoint at ${phase}`);
    vectorNear(endpoints.lever, state.leverPin.clone().setZ(.26), 8e-16,
      `rendered lever endpoint at ${phase}`);
    fixedBlocks.forEach((block, index) => vectorNear(
      block.position,
      fixedPositions[index],
      0,
      `fixed force-pump part at ${phase}`,
    ));
  }
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 5.2);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier', () => {
  const movement450 = catalog.movements[449];
  const movement507 = catalog.movements[506];
  const model450 = createMovementModel(movement450);
  const model507 = createMovementModel(movement507);

  assert.equal(movement450.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model450.root);
  disposeModel(model507.root);
});
