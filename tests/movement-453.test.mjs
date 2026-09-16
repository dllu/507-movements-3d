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
  'double-lantern-bellows-pump-with-common-rocking-lever-opposed-strokes-four-checks-and-shared-suction-discharge';
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

test('movement 453 has two pleated bellows, one common beam, four checks, and shared suction and discharge', () => {
  const movement = catalog.movements[452];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 453);
  assert.equal(movement.number, '453');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.beam.parent, model.root);
  assert.equal(blocks.leftBellows.group.parent, model.root);
  assert.equal(blocks.rightBellows.group.parent, model.root);
  assert.equal(blocks.leftBellows.rings.length, 9);
  assert.equal(blocks.rightBellows.rings.length, 9);
  assert.equal(blocks.leftBellows.skins.length, 8);
  assert.equal(blocks.rightBellows.skins.length, 8);
  assert.equal(blocks.commonSuction.shell.parent, model.root);
  assert.equal(blocks.commonDischarge.shell.parent, model.root);
  assert.equal(blocks.leftSuctionValve.parent, model.root);
  assert.equal(blocks.rightSuctionValve.parent, model.root);
  assert.equal(blocks.leftDeliveryValve.parent, model.root);
  assert.equal(blocks.rightDeliveryValve.parent, model.root);
  vectorNear(blocks.leftSuctionValve.position,
    geometry.valveSeats.leftSuction, 0, 'left suction valve location');
  vectorNear(blocks.rightSuctionValve.position,
    geometry.valveSeats.rightSuction, 0, 'right suction valve location');
  vectorNear(blocks.leftDeliveryValve.position,
    geometry.valveSeats.leftDelivery, 0, 'left delivery valve location');
  vectorNear(blocks.rightDeliveryValve.position,
    geometry.valveSeats.rightDelivery, 0, 'right delivery valve location');
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.leftBellowsIndependent, false);
  assert.equal(degreesOfFreedom.rightBellowsIndependent, false);
  assert.equal(degreesOfFreedom.leftSuctionCheckIndependent, false);
  assert.equal(degreesOfFreedom.leftDeliveryCheckIndependent, false);
  assert.equal(degreesOfFreedom.rightSuctionCheckIndependent, false);
  assert.equal(degreesOfFreedom.rightDeliveryCheckIndependent, false);

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  for (const role of [
    'single-common-rocking-lever-driving-bellows-in-opposition',
    'left-flexible-lantern-bellows-with-eight-visible-pleats',
    'right-flexible-lantern-bellows-with-eight-visible-pleats',
    'common-suction-pipe-below-valve-chest',
    'common-upright-discharge-pipe-behind-rocking-beam',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 453 source record distinguishes Brown evidence from reconstructed dimensions and timing', () => {
  const movement = catalog.movements[452];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate453;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_453.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Double lantern-bellows pump/);
  assert.match(movement.description,
    /one bellows is distended by lever.*other bellows is compressed/);
  assert.match(movement.description, /water passes up suction-pipe/);
  assert.match(movement.description, /expels its contents through discharge-pipe/);
  assert.match(movement.description, /valves working.*ordinary force pump/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(
    dynamics.fullAirRarefactionWaterPressureValveImpactLeakageBellowsElasticityAndLeverForceModeled,
    false,
  );
  assert.match(dynamics.checkValveModel,
    /suction check opens only while its volume increases.*delivery check.*decreases/);
  assert.match(dynamics.flowModel,
    /exactly opposite vertical plate velocities.*suction flow exactly equals.*delivery flow/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateBeamPivotPixels, [239, 117]);
  assert.deepEqual(plate.approximateLeftBellowsCenterPixels, [137, 270]);
  assert.deepEqual(plate.approximateRightBellowsCenterPixels, [352, 298]);
  assert.deepEqual(plate.approximateCommonSuctionPixels, [253, 468]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence,
    /centrally pivoted beam.*tall distended left bellows.*short compressed right bellows/);
  assert.match(evidence.reconstructionDisclosure,
    /no bellows diameter, stroke, pleat count.*independently engineered/);
  disposeModel(model.root);
});

test('movement 453 source pose matches the engraved left-distended and right-compressed endpoint', () => {
  const model = createMovementModel(catalog.movements[452]);
  const { sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  assert.equal(sourcePose.mode,
    'left-distended-right-compressed-dead-center-all-checks-seated');
  assert.ok(sourcePose.beamAngle < 0);
  assert.ok(sourcePose.leftBellowsHeight > sourcePose.rightBellowsHeight);
  near(source.leftBellowsVelocity, 0, 0, 'left stopped at source endpoint');
  near(source.rightBellowsVelocity, 0, 0, 'right stopped at source endpoint');
  near(source.leftSuctionValveOpen, 0, 0, 'left suction seated');
  near(source.leftDeliveryValveOpen, 0, 0, 'left delivery seated');
  near(source.rightSuctionValveOpen, 0, 0, 'right suction seated');
  near(source.rightDeliveryValveOpen, 0, 0, 'right delivery seated');
  disposeModel(model.root);
});

test('movement 453 alternates the physically correct suction and delivery pair on each half-stroke', () => {
  const model = createMovementModel(catalog.movements[452]);
  const { stateAtInputAngle } = model.root.userData;
  const leftCompressing = stateAtInputAngle(Math.PI / 2);
  const rightCompressing = stateAtInputAngle(3 * Math.PI / 2);

  assert.equal(leftCompressing.mode,
    'left-compressing-to-discharge-right-expanding-from-suction');
  assert.ok(leftCompressing.leftBellowsVelocity < 0);
  assert.ok(leftCompressing.rightBellowsVelocity > 0);
  near(leftCompressing.leftDeliveryValveOpen, 1, 0,
    'left delivery open');
  near(leftCompressing.rightSuctionValveOpen, 1, 0,
    'right suction open');
  near(leftCompressing.leftSuctionValveOpen, 0, 0,
    'left suction shut');
  near(leftCompressing.rightDeliveryValveOpen, 0, 0,
    'right delivery shut');
  assert.ok(leftCompressing.leftDeliveryFlowRate > 0);
  assert.ok(leftCompressing.rightSuctionFlowRate > 0);

  assert.equal(rightCompressing.mode,
    'right-compressing-to-discharge-left-expanding-from-suction');
  assert.ok(rightCompressing.leftBellowsVelocity > 0);
  assert.ok(rightCompressing.rightBellowsVelocity < 0);
  near(rightCompressing.leftSuctionValveOpen, 1, 0,
    'left suction open');
  near(rightCompressing.rightDeliveryValveOpen, 1, 0,
    'right delivery open');
  near(rightCompressing.leftDeliveryValveOpen, 0, 0,
    'left delivery shut');
  near(rightCompressing.rightSuctionValveOpen, 0, 0,
    'right suction shut');
  assert.ok(rightCompressing.leftSuctionFlowRate > 0);
  assert.ok(rightCompressing.rightDeliveryFlowRate > 0);
  disposeModel(model.root);
});

test('movement 453 four check valves are synchronized in opposite pairs, disjoint, and C2 at reversal', () => {
  const model = createMovementModel(catalog.movements[452]);
  const { stateAtInputAngle } = model.root.userData;
  for (let sample = -20000; sample <= 40000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    near(state.leftDeliveryValveOpen, state.rightSuctionValveOpen, 0,
      `left-delivery/right-suction pair at ${sample}`);
    near(state.leftSuctionValveOpen, state.rightDeliveryValveOpen, 0,
      `left-suction/right-delivery pair at ${sample}`);
    near(state.leftDeliveryValveOpen * state.leftSuctionValveOpen, 0, 0,
      `left checks interlocked at ${sample}`);
    near(state.rightDeliveryValveOpen * state.rightSuctionValveOpen, 0, 0,
      `right checks interlocked at ${sample}`);
  }
  const step = 1e-5;
  for (const boundary of [0, Math.PI]) {
    for (const key of ['leftSuctionValveOpen', 'leftDeliveryValveOpen',
      'rightSuctionValveOpen', 'rightDeliveryValveOpen']) {
      const before = stateAtInputAngle(boundary - step)[key];
      const center = stateAtInputAngle(boundary)[key];
      const after = stateAtInputAngle(boundary + step)[key];
      near((after - before) / (2 * step), 0, 6e-11,
        `${key} zero closure velocity at ${boundary}`);
      near((after - 2 * center + before) / step ** 2, 0, 1.1e-5,
        `${key} zero closure acceleration at ${boundary}`);
    }
  }
  disposeModel(model.root);
});

test('movement 453 opposed beam geometry keeps both rods vertical and constant length', () => {
  const model = createMovementModel(catalog.movements[452]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  for (let sample = 0; sample < 20000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    near(state.leftBeamPin.x, state.leftTopPlateCenter.x, 0,
      `left rod vertical x at ${sample}`);
    near(state.rightBeamPin.x, state.rightTopPlateCenter.x, 0,
      `right rod vertical x at ${sample}`);
    near(state.leftBeamPin.distanceTo(state.leftTopPlateCenter.clone().add(new THREE.Vector3(0,geometry.linkEyeHeight,0))),
      geometry.connectingRodLength, 4e-16,
    `left constant rod at ${sample}`);
    near(state.rightBeamPin.distanceTo(state.rightTopPlateCenter.clone().add(new THREE.Vector3(0,geometry.linkEyeHeight,0))),
      geometry.connectingRodLength, 4e-16,
    `right constant rod at ${sample}`);
    near(state.leftBeamPin.distanceTo(geometry.beamPivot),
      geometry.beamPinHalfSpan, 5e-16,
    `left beam radius at ${sample}`);
    near(state.rightBeamPin.distanceTo(geometry.beamPivot),
      geometry.beamPinHalfSpan, 5e-16,
    `right beam radius at ${sample}`);
    near(state.leftBellowsVelocity + state.rightBellowsVelocity, 0, 0,
      `opposite plate velocities at ${sample}`);
    near(state.leftBellowsAcceleration + state.rightBellowsAcceleration,
      0, 0, `opposite plate accelerations at ${sample}`);
    assert.ok(state.leftBellowsHeight > 0);
    assert.ok(state.rightBellowsHeight > 0);
  }
  disposeModel(model.root);
});

test('movement 453 each chamber and the shared manifolds obey exact water-volume balance', () => {
  const model = createMovementModel(catalog.movements[452]);
  const { stateAtInputAngle } = model.root.userData;
  for (let sample = -16000; sample <= 32000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 16000);
    near(state.leftBellowsWaterVolumeRate,
      state.leftSuctionFlowRate - state.leftDeliveryFlowRate,
    0, `left chamber balance at ${sample}`);
    near(state.rightBellowsWaterVolumeRate,
      state.rightSuctionFlowRate - state.rightDeliveryFlowRate,
    0, `right chamber balance at ${sample}`);
    near(state.totalSuctionFlowRate, state.totalDeliveryFlowRate, 0,
      `common-pipe balance at ${sample}`);
    near(state.totalSuctionFlowRate,
      Math.abs(state.leftBellowsWaterVolumeRate), 0,
    `shared flow magnitude at ${sample}`);
  }
  const source = stateAtInputAngle(0);
  const closure = stateAtInputAngle(FULL_TURN);
  near(closure.leftBellowsWaterVolume,
    source.leftBellowsWaterVolume, 0, 'left volume closure');
  near(closure.rightBellowsWaterVolume,
    source.rightBellowsWaterVolume, 0, 'right volume closure');
  near(source.leftBellowsWaterVolume + source.rightBellowsWaterVolume,
    stateAtInputAngle(Math.PI / 2).leftBellowsWaterVolume
      + stateAtInputAngle(Math.PI / 2).rightBellowsWaterVolume,
  2e-15, 'constant combined bellows inventory');
  disposeModel(model.root);
});

test('movement 453 beam, pin, and bellows kinematics are smooth and analytically differentiated', () => {
  const model = createMovementModel(catalog.movements[452]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const step = 1e-6;
  for (const angle of [0.31, 1.17, 2.64, 4.22, 5.71]) {
    const before = stateAtInputAngle(angle - step);
    const state = stateAtInputAngle(angle);
    const after = stateAtInputAngle(angle + step);
    const numericLeftVelocity = (
      after.leftTopPlateCenter.y - before.leftTopPlateCenter.y
    ) / (2 * step) * geometry.inputAngularSpeed;
    const numericRightVelocity = (
      after.rightTopPlateCenter.y - before.rightTopPlateCenter.y
    ) / (2 * step) * geometry.inputAngularSpeed;
    near(state.leftBellowsVelocity, numericLeftVelocity, 1e-9,
      `left analytic velocity at ${angle}`);
    near(state.rightBellowsVelocity, numericRightVelocity, 1e-9,
      `right analytic velocity at ${angle}`);
    const numericAcceleration = (
      after.leftBellowsVelocity - before.leftBellowsVelocity
    ) / (2 * step) * geometry.inputAngularSpeed;
    near(state.leftBellowsAcceleration, numericAcceleration, 2e-9,
      `left analytic acceleration at ${angle}`);
  }
  const source = stateAtInputAngle(0);
  const closure = stateAtInputAngle(FULL_TURN);
  near(closure.beamAngle, source.beamAngle, 0, 'beam angle closure');
  vectorNear(closure.leftBeamPin, source.leftBeamPin, 0,
    'left pin closure');
  vectorNear(closure.rightBeamPin, source.rightBeamPin, 0,
    'right pin closure');
  near(closure.leftBellowsVelocity, source.leftBellowsVelocity, 0,
    'left velocity closure');
  disposeModel(model.root);
});

test('movement 453 update maps every dependent transform while the chest, standard, pivot, and bottom plates stay fixed', () => {
  const model = createMovementModel(catalog.movements[452]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [blocks.base, blocks.valveChest, blocks.standard,
    blocks.pivotAxle, blocks.leftBottomPlate, blocks.rightBottomPlate,
    blocks.leftSuctionValve, blocks.rightSuctionValve,
    blocks.leftDeliveryValve, blocks.rightDeliveryValve];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());

  for (const phase of [0, 0.125, 0.25, 0.375, 0.5,
    0.625, 0.75, 0.875, 1]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    near(blocks.beam.rotation.z, state.beamAngle, 0,
      `beam angle at ${phase}`);
    vectorNear(blocks.leftTopPlate.position,
      state.leftTopPlateCenter, 0, `left top plate at ${phase}`);
    vectorNear(blocks.rightTopPlate.position,
      state.rightTopPlateCenter, 0, `right top plate at ${phase}`);
    near(blocks.leftConnectingRod.scale.y,
      geometry.connectingRodLength, 4e-16,
    `left displayed rod length at ${phase}`);
    near(blocks.rightConnectingRod.scale.y,
      geometry.connectingRodLength, 4e-16,
    `right displayed rod length at ${phase}`);
    near(blocks.leftSuctionValve.userData.disk.position.y,
      blocks.leftSuctionValve.userData.closedDiskY
        + state.leftSuctionValveLift,
    0, `left suction disk at ${phase}`);
    near(blocks.leftDeliveryValve.userData.disk.position.y,
      blocks.leftDeliveryValve.userData.closedDiskY
        + state.leftDeliveryValveLift,
    0, `left delivery disk at ${phase}`);
    near(blocks.rightSuctionValve.userData.disk.position.y,
      blocks.rightSuctionValve.userData.closedDiskY
        + state.rightSuctionValveLift,
    0, `right suction disk at ${phase}`);
    near(blocks.rightDeliveryValve.userData.disk.position.y,
      blocks.rightDeliveryValve.userData.closedDiskY
        + state.rightDeliveryValveLift,
    0, `right delivery disk at ${phase}`);
    fixedBlocks.forEach((block, index) => vectorNear(
      block.position,
      fixedPositions[index],
      0,
      `fixed apparatus at ${phase}`,
    ));
  }
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 5.4);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 453 produces finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement453 = catalog.movements[452];
  const movement507 = catalog.movements[506];
  const model453 = createMovementModel(movement453);
  const model507 = createMovementModel(movement507);
  model453.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model453.root);

  for (const value of [bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z]) assert.ok(Number.isFinite(value));
  assert.ok(bounds.max.x > bounds.min.x);
  assert.ok(bounds.max.y > bounds.min.y);
  assert.ok(bounds.max.z > bounds.min.z);
  assert.equal(movement453.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model453.root);
  disposeModel(model507.root);
});
