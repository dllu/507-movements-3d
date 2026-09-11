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
  'closed-double-acting-pump-with-stuffing-box-four-numbered-checks-opposite-chamber-suction-and-discharge';
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

test('movement 452 has a closed double-acting cylinder, stuffing box, and all four numbered checks', () => {
  const movement = catalog.movements[451];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 452);
  assert.equal(movement.number, '452');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.barrel.parent, model.root);
  assert.equal(blocks.lowerCover.parent, model.root);
  assert.equal(blocks.upperCover.parent, model.root);
  assert.equal(blocks.stuffingBox.parent, model.root);
  assert.equal(blocks.piston.parent, model.root);
  assert.equal(blocks.pistonRod.parent, model.root);
  assert.equal(blocks.suctionManifold.parent, model.root);
  assert.equal(blocks.dischargeManifold.parent, model.root);
  assert.equal(blocks.upperSuctionValve1.parent, model.root);
  assert.equal(blocks.lowerSuctionValve2.parent, model.root);
  assert.equal(blocks.lowerDischargeValve3.parent, model.root);
  assert.equal(blocks.upperDischargeValve4.parent, model.root);
  vectorNear(blocks.upperSuctionValve1.position,
    geometry.valveSeats.upperSuction1, 0, 'valve 1 source location');
  vectorNear(blocks.lowerSuctionValve2.position,
    geometry.valveSeats.lowerSuction2, 0, 'valve 2 source location');
  vectorNear(blocks.lowerDischargeValve3.position,
    geometry.valveSeats.lowerDischarge3, 0, 'valve 3 source location');
  vectorNear(blocks.upperDischargeValve4.position,
    geometry.valveSeats.upperDischarge4, 0, 'valve 4 source location');
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.upperSuction1Independent, false);
  assert.equal(degreesOfFreedom.lowerSuction2Independent, false);
  assert.equal(degreesOfFreedom.lowerDischarge3Independent, false);
  assert.equal(degreesOfFreedom.upperDischarge4Independent, false);
  disposeModel(model.root);
});

test('movement 452 source record maps pipes A/B and checks 1–4 without hiding simplifications', () => {
  const movement = catalog.movements[451];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate452;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_452.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Double-acting pump/);
  assert.match(movement.description, /Cylinder closed at each end/);
  assert.match(movement.description, /piston-rod passes through stuffing-box/);
  assert.match(movement.description, /four openings covered by valves/);
  assert.match(movement.description, /A is suction-pipe.*B discharge-pipe/);
  assert.match(movement.description,
    /piston moves down.*suction-valve, 1.*valve, 3/);
  assert.match(movement.description,
    /piston ascending.*discharge-valve, 4.*suction-valve, 2/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(dynamics.fullPressureWaveValveImpactLeakageRodAreaDifferenceCavitationAndDriveForceModeled,
    false);
  assert.match(dynamics.checkValveModel,
    /Valves 1 and 3.*downstroke.*valves 2 and 4.*upstroke/);
  assert.match(dynamics.flowModel,
    /equal effective areas.*one suction and the opposite discharge.*equal flow/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateUpperSuction1Pixels, [350, 126]);
  assert.deepEqual(plate.approximateLowerSuction2Pixels, [341, 446]);
  assert.deepEqual(plate.approximateLowerDischarge3Pixels, [191, 446]);
  assert.deepEqual(plate.approximateUpperDischarge4Pixels, [195, 120]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.engravingEvidence,
    /right suction manifold A, left discharge manifold B.*arrow depicts.*downward/);
  assert.match(evidence.reconstructionDisclosure,
    /no bore, stroke, rod area.*independently engineered/);
  disposeModel(model.root);
});

test('movement 452 source pose and downstroke open exactly upper suction 1 plus lower discharge 3', () => {
  const model = createMovementModel(catalog.movements[451]);
  const { sourcePose, stateAtInputAngle } = model.root.userData;
  const down = stateAtInputAngle(0);

  assert.equal(sourcePose.mode,
    'piston-down-upper-suction-1-and-lower-discharge-3-open');
  assert.ok(sourcePose.pistonVelocity < 0);
  near(down.upperSuction1Open, 1, 0, 'upper suction 1 open');
  near(down.lowerDischarge3Open, 1, 0, 'lower discharge 3 open');
  near(down.lowerSuction2Open, 0, 0, 'lower suction 2 shut');
  near(down.upperDischarge4Open, 0, 0, 'upper discharge 4 shut');
  near(down.upperSuctionFlowRate, down.lowerDischargeFlowRate, 0,
    'downstroke admitted and discharged volumes match');
  near(down.lowerSuctionFlowRate, 0, 0, 'no lower suction downstroke');
  near(down.upperDischargeFlowRate, 0, 0,
    'no upper discharge downstroke');
  disposeModel(model.root);
});

test('movement 452 upstroke opens exactly lower suction 2 plus upper discharge 4', () => {
  const model = createMovementModel(catalog.movements[451]);
  const { stateAtInputAngle } = model.root.userData;
  const up = stateAtInputAngle(Math.PI);

  assert.equal(up.mode,
    'piston-up-lower-suction-2-and-upper-discharge-4-open');
  assert.ok(up.pistonVelocity > 0);
  near(up.upperSuction1Open, 0, 0, 'upper suction 1 shut');
  near(up.lowerDischarge3Open, 0, 0, 'lower discharge 3 shut');
  near(up.lowerSuction2Open, 1, 0, 'lower suction 2 open');
  near(up.upperDischarge4Open, 1, 0, 'upper discharge 4 open');
  near(up.lowerSuctionFlowRate, up.upperDischargeFlowRate, 0,
    'upstroke admitted and discharged volumes match');
  near(up.upperSuctionFlowRate, 0, 0, 'no upper suction upstroke');
  near(up.lowerDischargeFlowRate, 0, 0,
    'no lower discharge upstroke');
  disposeModel(model.root);
});

test('movement 452 diagonal valve pairs are synchronized, mutually exclusive, and C2 at dead centers', () => {
  const model = createMovementModel(catalog.movements[451]);
  const { stateAtInputAngle } = model.root.userData;
  for (let sample = -20000; sample <= 40000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    near(state.upperSuction1Open, state.lowerDischarge3Open, 0,
      `downstroke pair synchronized at ${sample}`);
    near(state.lowerSuction2Open, state.upperDischarge4Open, 0,
      `upstroke pair synchronized at ${sample}`);
    near(state.upperSuction1Open * state.lowerSuction2Open, 0, 0,
      `suction checks interlocked at ${sample}`);
    near(state.lowerDischarge3Open * state.upperDischarge4Open, 0, 0,
      `discharge checks interlocked at ${sample}`);
  }
  const step = 1e-5;
  for (const boundary of [FULL_TURN * 0.25, FULL_TURN * 0.75]) {
    for (const key of ['upperSuction1Open', 'lowerSuction2Open',
      'lowerDischarge3Open', 'upperDischarge4Open']) {
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

test('movement 452 upper and lower chamber volumes each obey their exact port balance', () => {
  const model = createMovementModel(catalog.movements[451]);
  const { stateAtInputAngle } = model.root.userData;
  for (let sample = -16000; sample <= 32000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 16000);
    near(state.upperChamberWaterVolumeRate,
      state.upperSuctionFlowRate - state.upperDischargeFlowRate,
    0, `upper chamber balance at ${sample}`);
    near(state.lowerChamberWaterVolumeRate,
      state.lowerSuctionFlowRate - state.lowerDischargeFlowRate,
    0, `lower chamber balance at ${sample}`);
    near(state.totalSuctionFlowRate, state.totalDischargeFlowRate, 0,
      `double-acting total flow balance at ${sample}`);
    near(state.totalSuctionFlowRate,
      state.chamberArea * Math.abs(state.pistonVelocity), 0,
    `double-acting flow magnitude at ${sample}`);
  }
  const source = stateAtInputAngle(0);
  const closure = stateAtInputAngle(FULL_TURN);
  near(closure.upperChamberWaterVolume,
    source.upperChamberWaterVolume, 0, 'upper chamber closes');
  near(closure.lowerChamberWaterVolume,
    source.lowerChamberWaterVolume, 0, 'lower chamber closes');
  disposeModel(model.root);
});

test('movement 452 piston kinematics are smooth, close exactly, and stop at both dead centers', () => {
  const model = createMovementModel(catalog.movements[451]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const downMid = stateAtInputAngle(0);
  const bottom = stateAtInputAngle(Math.PI / 2);
  const upMid = stateAtInputAngle(Math.PI);
  const top = stateAtInputAngle(3 * Math.PI / 2);
  near(bottom.pistonY,
    geometry.pistonCenterY - geometry.pistonAmplitude, 0,
  'bottom dead-center position');
  near(bottom.pistonVelocity, 0, 0, 'stopped at bottom');
  near(top.pistonY,
    geometry.pistonCenterY + geometry.pistonAmplitude, 0,
  'top dead-center position');
  near(top.pistonVelocity, 0, 0, 'stopped at top');
  assert.ok(downMid.pistonVelocity < 0);
  assert.ok(upMid.pistonVelocity > 0);
  const closure = stateAtInputAngle(FULL_TURN);
  near(closure.pistonY, downMid.pistonY, 0, 'position closure');
  near(closure.pistonVelocity, downMid.pistonVelocity, 0,
    'velocity closure');
  near(closure.pistonAcceleration, downMid.pistonAcceleration, 0,
    'acceleration closure');
  disposeModel(model.root);
});

test('movement 452 rod stays coaxial through the fixed stuffing box across the whole stroke', () => {
  const model = createMovementModel(catalog.movements[451]);
  const { blocks, geometry, stateAtInputAngle } = model.root.userData;
  assert.equal(blocks.stuffingBox.position.x, 0);
  assert.equal(blocks.pistonRod.position.x, 0);
  for (let sample = 0; sample < 10000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 10000);
    near(state.rodTopY - state.rodBottomY, geometry.rodLength, 5e-16,
      `constant rod length at ${sample}`);
    assert.ok(state.rodBottomY < geometry.stuffingBoxY);
    assert.ok(state.rodTopY > geometry.stuffingBoxY);
  }
  disposeModel(model.root);
});

test('movement 452 update maps piston, rod, water chambers, and four disks while all covers and manifolds remain fixed', () => {
  const model = createMovementModel(catalog.movements[451]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [blocks.barrel, blocks.barrelRails, blocks.base,
    blocks.dischargeManifold, blocks.lowerCover,
    blocks.lowerDischargeValve3, blocks.lowerSuctionValve2,
    blocks.stuffingBox, blocks.suctionManifold, blocks.upperCover,
    blocks.upperDischargeValve4, blocks.upperSuctionValve1];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());

  for (const phase of [0, 0.125, 0.25, 0.375, 0.5,
    0.625, 0.75, 0.875, 1]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    near(blocks.piston.position.y, state.pistonY, 0,
      `piston transform at ${phase}`);
    near(blocks.pistonRod.position.y,
      (state.rodBottomY + state.rodTopY) / 2, 0,
    `rod transform at ${phase}`);
    near(blocks.upperSuctionValve1.userData.disk.position.y,
      -0.04 + state.upperSuction1Lift, 0,
    `valve 1 lift at ${phase}`);
    near(blocks.lowerSuctionValve2.userData.disk.position.y,
      -0.04 + state.lowerSuction2Lift, 0,
    `valve 2 lift at ${phase}`);
    near(blocks.lowerDischargeValve3.userData.disk.position.y,
      -0.04 + state.lowerDischarge3Lift, 0,
    `valve 3 lift at ${phase}`);
    near(blocks.upperDischargeValve4.userData.disk.position.y,
      -0.04 + state.upperDischarge4Lift, 0,
    `valve 4 lift at ${phase}`);
    fixedBlocks.forEach((block, index) => vectorNear(
      block.position,
      fixedPositions[index],
      0,
      `fixed double-acting part at ${phase}`,
    ));
  }
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 4.9);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier', () => {
  const movement452 = catalog.movements[451];
  const movement507 = catalog.movements[506];
  const model452 = createMovementModel(movement452);
  const model507 = createMovementModel(movement507);

  assert.equal(movement452.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model452.root);
  disposeModel(model507.root);
});
