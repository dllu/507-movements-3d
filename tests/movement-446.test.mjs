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
  'dectol-fixed-oscillating-water-column-raised-cone-checking-state';
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

test('movement 446 is the same all-fixed D’Ectol apparatus at the raised checked-column source state', () => {
  const movement = catalog.movements[445];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, sourcePose } = data;

  assert.equal(movement.id, 446);
  assert.equal(movement.number, '446');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  for (const block of [...blocks.upperWalls, blocks.upperFloor,
    blocks.upperBack, ...blocks.lowerWalls, blocks.lowerTop,
    blocks.lowerBack, blocks.plate, blocks.plateStem]) {
    assert.equal(block.parent, model.root);
  }
  assert.equal(degreesOfFreedom.movingSolidParts, 0);
  assert.equal(degreesOfFreedom.waterConeIndependent, false);
  assert.equal(degreesOfFreedom.upperColumnIndependent, false);
  near(sourcePose.sourcePhase, 0.77, 0, 'plate 446 source phase');
  assert.equal(sourcePose.mode,
    'checked-cone-and-raised-column-as-in-plate-446');
  near(sourcePose.coneFraction, 1, 0, 'full source cone');
  near(sourcePose.upperColumnFraction, 1, 0, 'raised source column');

  const forbiddenTransmissions = [];
  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt || object.userData.isRope
      || object.userData.isGear || object.userData.isPulley) {
      forbiddenTransmissions.push(object);
    }
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.deepEqual(forbiddenTransmissions, []);
  for (const role of [
    'fixed-upper-box-floor-with-round-orifice',
    'fixed-lower-box-top-with-round-opening',
    'fixed-circular-plate-concentric-with-upper-orifice',
    'falling-stream-cone-and-plate-sheet-as-one-water-body',
    'raised-water-column-spraying-in-upper-box',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 446 source record describes its distinct checked-flow engraving and honest reconstruction limits', () => {
  const movement = catalog.movements[445];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate446;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_446.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.plate, 'Brown 1868, Movement 446');
  assert.equal(sourceReference.pairedPlate,
    'Brown 1868, Movements 445 and 446');
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.match(sourceAnimation.reason,
    /official Movement 446 page.*shared 445–446 caption/);
  assert.equal(dynamics.allSolidPartsAbsolutelyFixed, true);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateCircularPlateCenterPixels, [293, 326]);
  assert.deepEqual(plate.approximateSmallTubeCenterPixels, [293, 214]);
  assert.deepEqual(plate.approximateRaisedColumnTopPixels, [294, 113]);
  assert.equal(evidence.explicitInBrownDescription.length, 8);
  assert.match(evidence.engravingEvidence,
    /Plate 446 is a vertical section in the checked-flow state.*water column rising from the fixed circular plate/);
  assert.match(evidence.reconstructionDisclosure,
    /no dimensions, flow rate, head.*independently engineered/);
  disposeModel(model.root);
});

test('movement 446 starts at the cone-checking plate pose and preserves the complete periodic phase order', () => {
  const model = createMovementModel(catalog.movements[445]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const relativePhase = (cyclePhase) => THREE.MathUtils.euclideanModulo(
    cyclePhase - geometry.sourcePhase,
    1,
  );
  const atCyclePhase = (phase) => stateAtInputAngle(
    FULL_TURN * relativePhase(phase),
  );

  assert.equal(atCyclePhase(0.77).mode,
    'checked-cone-and-raised-column-as-in-plate-446');
  assert.equal(atCyclePhase(0.79).mode, 'water-cone-giving-way');
  assert.equal(atCyclePhase(0.84).mode,
    'collapsed-cone-releasing-accumulated-column');
  assert.equal(atCyclePhase(0.92).mode,
    'unobstructed-downward-surge-draining-upper-column');
  assert.equal(atCyclePhase(0.08).mode,
    'unobstructed-water-descending-as-in-plate-445');
  assert.equal(atCyclePhase(0.35).mode,
    'falling-water-forming-cone-on-circular-plate');
  assert.equal(atCyclePhase(0.64).mode,
    'cone-protruding-into-small-tube-checking-flow-column-rising');
  near(atCyclePhase(0.77).upperColumnFraction, 1, 0,
    'raised source phase');
  near(atCyclePhase(0.08).upperColumnFraction, 0, 0,
    'free descent phase');
  disposeModel(model.root);
});

test('movement 446 remains exactly mass balanced despite its nonzero source-phase offset', () => {
  const model = createMovementModel(catalog.movements[445]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const samples = 40000;
  let supplied = 0;
  let discharged = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const angle = FULL_TURN * (sample + 0.5) / samples;
    const state = stateAtInputAngle(angle);
    near(state.downwardFlowRate,
      state.supplyFlowRate - state.upperStorageVolumeRate,
    0, `instantaneous offset balance at sample ${sample}`);
    assert.ok(state.downwardFlowRate >= 0);
    supplied += state.supplyFlowRate * geometry.cycleDuration / samples;
    discharged += state.downwardFlowRate
      * geometry.cycleDuration / samples;
  }
  near(discharged, supplied, 3e-13,
    'offset cycle discharge equals supply');
  const source = stateAtInputAngle(0);
  const closure = stateAtInputAngle(FULL_TURN);
  near(closure.upperStorageVolume, source.upperStorageVolume, 0,
    'raised storage closes exactly');
  near(closure.coneHeight, source.coneHeight, 0,
    'raised cone closes exactly');
  disposeModel(model.root);
});

test('movement 446 renders the checked cone and raised column at time zero while every solid remains fixed', () => {
  const model = createMovementModel(catalog.movements[445]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [...blocks.upperWalls, blocks.upperFloor,
    blocks.upperBack, ...blocks.lowerWalls, blocks.lowerTop,
    blocks.lowerBack, blocks.plate, blocks.plateStem];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());
  const fixedScales = fixedBlocks.map((block) => block.scale.clone());

  const source = stateAtTime(0);
  update(0);
  near(source.phase, geometry.sourcePhase, 0, 'source cycle phase');
  near(blocks.waterCone.scale.y, 1, 0, 'full source cone rendered');
  near(blocks.risingColumn.position.y + blocks.risingColumn.scale.y,
    geometry.reservoirWaterY, 1e-12,
    'full raised source column reaches the upper water surface');
  assert.equal(blocks.risingColumn.visible, true);
  assert.equal(blocks.topPlume.visible, true);

  for (const phaseOffset of [0, 0.02, 0.08, 0.16, 0.31, 0.58, 1]) {
    update(geometry.cycleDuration * phaseOffset);
    fixedBlocks.forEach((block, index) => {
      vectorNear(block.position, fixedPositions[index], 0,
        `fixed position at offset ${phaseOffset}`);
      vectorNear(block.scale, fixedScales[index], 0,
        `fixed scale at offset ${phaseOffset}`);
    });
  }
  update(geometry.cycleDuration * (1.08 - geometry.sourcePhase));
  assert.equal(blocks.risingColumn.visible, false,
    'column disappears in the later free-descent state');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 5.6);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movements 445 and 446 share fixed topology but retain distinct source poses and archetypes', () => {
  const model445 = createMovementModel(catalog.movements[444]);
  const model446 = createMovementModel(catalog.movements[445]);
  const state445 = model445.root.userData.stateAtInputAngle(0);
  const state446 = model446.root.userData.stateAtInputAngle(0);

  assert.notEqual(model445.root.userData.archetype,
    model446.root.userData.archetype);
  assert.equal(model445.root.userData.blocks.upperFloor.geometry.type,
    model446.root.userData.blocks.upperFloor.geometry.type);
  near(model445.root.userData.geometry.nozzleBottomY,
    model446.root.userData.geometry.nozzleBottomY, 0,
  'shared small-tube topology');
  near(state445.upperColumnFraction, 0, 0, '445 descent pose');
  near(state446.upperColumnFraction, 1, 0, '446 raised pose');
  assert.notEqual(state445.mode, state446.mode);
  disposeModel(model445.root);
  disposeModel(model446.root);
});

test('movement 507 remains the next authored frontier', () => {
  const movement446 = catalog.movements[445];
  const movement507 = catalog.movements[506];
  const model446 = createMovementModel(movement446);
  const model507 = createMovementModel(movement507);

  assert.equal(movement446.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model446.root);
  disposeModel(model507.root);
});
