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
  'dectol-fixed-oscillating-water-column-free-descent-state';
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

test('movement 445 is the all-fixed D’Ectol apparatus in its free-descent source state', () => {
  const movement = catalog.movements[444];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, sourcePose } = data;

  assert.equal(movement.id, 445);
  assert.equal(movement.number, '445');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.nozzle.parent, model.root);
  assert.equal(blocks.lowerTube.parent, model.root);
  assert.equal(blocks.plate.parent, model.root);
  assert.equal(blocks.plateStem.parent, model.root);
  assert.equal(blocks.reservoir.parent, model.root);
  assert.equal(degreesOfFreedom.movingSolidParts, 0);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.waterConeIndependent, false);
  assert.equal(degreesOfFreedom.upperColumnIndependent, false);
  assert.equal(sourcePose.sourcePhase, 0);
  assert.equal(sourcePose.mode,
    'unobstructed-water-descending-as-in-plate-445');
  near(sourcePose.coneFraction, 0.12, 0, 'low source cone');
  near(sourcePose.upperColumnFraction, 0, 0, 'empty stored column');

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
    'fixed-upper-smaller-tube',
    'fixed-lower-larger-tube',
    'fixed-circular-plate-concentric-with-upper-orifice',
    'fixed-circular-plate-support',
    'constant-supply-water-at-fixed-head',
    'unobstructed-descending-stream',
    'water-spreading-over-plate-and-descending-in-larger-tube',
    'self-forming-water-cone-on-fixed-circular-plate',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 445 records both Brown plates and discloses its fluid-envelope assumptions', () => {
  const movement = catalog.movements[444];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate445;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_445.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.pairedPlate,
    'Brown 1868, Movements 445 and 446');
  assert.match(movement.description, /all the parts of which are absolutely fixed/);
  assert.match(movement.description, /upper and smaller tube.*constantly supplied/);
  assert.match(movement.description, /circular plate below concentric with the orifice/);
  assert.match(movement.description, /cone protrudes into the smaller tube/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /static engraving and the shared 445–446 caption/);
  assert.equal(dynamics.allSolidPartsAbsolutelyFixed, true);
  assert.match(dynamics.fluidModel,
    /mass-balanced, axisymmetric kinematic water envelope.*not a CFD solution/);
  assert.match(dynamics.periodicRegulation,
    /Constant supply minus the exact time derivative of upper storage/);
  assert.match(dynamics.transitionContinuity,
    /quintic smoothstep.*zero endpoint velocity and acceleration/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateCircularPlateCenterPixels, [294, 328]);
  assert.deepEqual(plate.approximateSmallTubeCenterPixels, [292, 215]);
  assert.equal(evidence.explicitInBrownDescription.length, 8);
  assert.match(evidence.engravingEvidence,
    /Plate 445 shows the open-flow state.*circular plate on a fixed central stem/);
  assert.match(evidence.reconstructionDisclosure,
    /no dimensions, flow rate, head.*independently engineered/);
  disposeModel(model.root);
});

test('movement 445 follows descent, cone build, throat check, rise, break, and surge in order', () => {
  const model = createMovementModel(catalog.movements[444]);
  const { stateAtCyclePhase } = model.root.userData;

  assert.equal(stateAtCyclePhase(0.08).mode,
    'unobstructed-water-descending-as-in-plate-445');
  assert.equal(stateAtCyclePhase(0.35).mode,
    'falling-water-forming-cone-on-circular-plate');
  assert.equal(stateAtCyclePhase(0.64).mode,
    'cone-protruding-into-small-tube-checking-flow-column-rising');
  assert.equal(stateAtCyclePhase(0.77).mode,
    'checked-cone-and-raised-column-as-in-plate-446');
  assert.equal(stateAtCyclePhase(0.79).mode,
    'water-cone-giving-way');
  assert.equal(stateAtCyclePhase(0.84).mode,
    'collapsed-cone-releasing-accumulated-column');
  assert.equal(stateAtCyclePhase(0.92).mode,
    'unobstructed-downward-surge-draining-upper-column');
  assert.equal(stateAtCyclePhase(0.98).mode,
    'free-descent-cycle-reset');

  const free = stateAtCyclePhase(0.08);
  const forming = stateAtCyclePhase(0.35);
  const checked = stateAtCyclePhase(0.64);
  const raised = stateAtCyclePhase(0.77);
  const surge = stateAtCyclePhase(0.88);
  assert.ok(forming.coneHeight > free.coneHeight);
  near(checked.throatPenetration, 1, 0, 'cone penetrates throat');
  assert.ok(checked.upperColumnFraction > 0);
  near(raised.upperColumnFraction, 1, 0, 'column reaches raised state');
  assert.ok(checked.downwardFlowRate < free.downwardFlowRate);
  assert.ok(surge.downwardFlowRate > free.downwardFlowRate);
  disposeModel(model.root);
});

test('movement 445 enforces exact instantaneous and cycle-integrated water balance', () => {
  const model = createMovementModel(catalog.movements[444]);
  const { geometry, stateAtCyclePhase } = model.root.userData;
  const samples = 40000;
  let supplyIntegral = 0;
  let downwardIntegral = 0;
  let minimumDownwardFlow = Infinity;
  for (let sample = 0; sample < samples; sample += 1) {
    const phase = (sample + 0.5) / samples;
    const state = stateAtCyclePhase(phase);
    near(state.downwardFlowRate,
      state.supplyFlowRate - state.upperStorageVolumeRate,
    0, `instantaneous balance at ${phase}`);
    assert.ok(state.downwardFlowRate >= 0,
      `nonnegative downward flow at ${phase}`);
    supplyIntegral += state.supplyFlowRate
      * geometry.cycleDuration / samples;
    downwardIntegral += state.downwardFlowRate
      * geometry.cycleDuration / samples;
    minimumDownwardFlow = Math.min(
      minimumDownwardFlow,
      state.downwardFlowRate,
    );
  }
  near(downwardIntegral, supplyIntegral, 3e-13,
    'cycle discharge equals constant supply');
  assert.ok(minimumDownwardFlow < 0.05,
    'checked cone substantially throttles descent');
  const source = stateAtCyclePhase(0);
  const closure = stateAtCyclePhase(1);
  near(closure.upperStorageVolume, source.upperStorageVolume, 0,
    'stored water closes exactly');
  near(closure.coneHeight, source.coneHeight, 0,
    'cone envelope closes exactly');
  disposeModel(model.root);
});

test('movement 445 upper storage rises only after the cone reaches the small tube and drains after failure', () => {
  const model = createMovementModel(catalog.movements[444]);
  const { geometry, stateAtCyclePhase } = model.root.userData;

  for (let sample = 0; sample <= 1000; sample += 1) {
    const phase = geometry.coneBuildEndPhase * sample / 1000;
    near(stateAtCyclePhase(phase).upperStorageVolume, 0, 0,
      `no premature upper storage at ${phase}`);
  }
  for (let sample = 1; sample < 1000; sample += 1) {
    const risePhase = geometry.coneBuildEndPhase
      + (geometry.columnRiseEndPhase - geometry.coneBuildEndPhase)
        * sample / 1000;
    assert.ok(stateAtCyclePhase(risePhase).upperStorageVolumeRate > 0,
      `upper column rising at ${risePhase}`);
    const drainPhase = geometry.storageDrainStartPhase
      + (geometry.storageDrainEndPhase - geometry.storageDrainStartPhase)
        * sample / 1000;
    assert.ok(stateAtCyclePhase(drainPhase).upperStorageVolumeRate < 0,
      `upper column draining at ${drainPhase}`);
  }
  near(stateAtCyclePhase(geometry.columnRiseEndPhase).upperStorageVolume,
    geometry.maximumUpperStorageVolume, 0, 'maximum stored column');
  near(stateAtCyclePhase(geometry.storageDrainEndPhase).upperStorageVolume,
    0, 0, 'stored column fully released');
  disposeModel(model.root);
});

test('movement 445 cone and upper-column phase joins are C2 continuous', () => {
  const model = createMovementModel(catalog.movements[444]);
  const {
    coneKinematicsAtPhase,
    geometry,
    upperStorageKinematicsAtPhase,
  } = model.root.userData;
  for (const phase of [geometry.freeDescentEndPhase,
    geometry.coneBuildEndPhase, geometry.coneBreakStartPhase,
    geometry.coneCollapseEndPhase, 0]) {
    const state = coneKinematicsAtPhase(phase);
    near(state.first, 0, 1e-12, `cone zero join velocity at ${phase}`);
    near(state.second, 0, 1e-10,
      `cone zero join acceleration at ${phase}`);
  }
  for (const phase of [geometry.coneBuildEndPhase,
    geometry.columnRiseEndPhase, geometry.storageDrainStartPhase,
    geometry.storageDrainEndPhase, 0]) {
    const state = upperStorageKinematicsAtPhase(phase);
    near(state.first, 0, 1e-12,
      `storage zero join velocity at ${phase}`);
    near(state.second, 0, 1e-10,
      `storage zero join acceleration at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 445 update changes only fluid envelopes and tracers, never the fixed apparatus', () => {
  const model = createMovementModel(catalog.movements[444]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [blocks.base, blocks.lowerFloor, blocks.lowerTube,
    blocks.nozzle, blocks.outletPipe, blocks.plate, blocks.plateStem,
    blocks.reservoir];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());
  const fixedQuaternions = fixedBlocks.map((block) => block.quaternion.clone());
  const fixedScales = fixedBlocks.map((block) => block.scale.clone());

  for (const phase of [0, 0.08, 0.35, 0.52, 0.64, 0.77,
    0.79, 0.84, 0.92, 0.98, 1]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    near(blocks.waterCone.scale.y, state.coneFraction, 0,
      `rendered cone height at ${phase}`);
    near(blocks.waterCone.position.y,
      geometry.plateTopY + state.coneHeight / 2, 0,
    `cone remains anchored to plate at ${phase}`);
    near(blocks.risingColumn.scale.y,
      Math.max(0.001, state.upperColumnFraction), 0,
    `rendered upper column at ${phase}`);
    assert.equal(blocks.risingColumn.visible,
      state.upperColumnFraction > 0.005);
    fixedBlocks.forEach((block, index) => {
      vectorNear(block.position, fixedPositions[index], 0,
        `fixed position at ${phase}`);
      near(1 - Math.abs(block.quaternion.dot(fixedQuaternions[index])),
        0, 2e-16, `fixed orientation at ${phase}`);
      vectorNear(block.scale, fixedScales[index], 0,
        `fixed scale at ${phase}`);
    });
  }
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 5.6);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and cannot silently reuse movement 445', () => {
  const movement445 = catalog.movements[444];
  const movement507 = catalog.movements[506];
  const model445 = createMovementModel(movement445);
  const model507 = createMovementModel(movement507);

  assert.equal(movement445.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model445.root);
  disposeModel(model507.root);
});
