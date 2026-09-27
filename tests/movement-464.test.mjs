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
  'herons-three-vessel-fountain-with-water-drain-shared-air-line-and-pressure-driven-central-jet';

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
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

function movementModel() {
  const movement = catalog.movements[463];
  return { model: createMovementModel(movement), movement };
}

test('movement 464 is Hero’s three-vessel fountain with one water drain, one pneumatic line, and one central jet riser', () => {
  const { model, movement } = movementModel();
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 464);
  assert.equal(movement.number, '464');
  assert.equal(movement.title, 'Hero’s three-vessel fountain');
  assert.equal(movement.category, 'Pumps & pneumatics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.topBasin.parent, model.root);
  assert.equal(blocks.intermediateVessel.parent, model.root);
  assert.equal(blocks.lowerVessel.parent, model.root);
  assert.equal(blocks.topWater.parent, blocks.topBasin);
  assert.equal(blocks.intermediateWater.parent, blocks.intermediateVessel);
  assert.equal(blocks.lowerWater.parent, blocks.lowerVessel);
  assert.equal(blocks.rightDrainOuter.parent, model.root);
  assert.equal(blocks.leftAirPipe.parent, model.root);
  assert.equal(blocks.centralRiser.parent, model.root);
  assert.equal(blocks.fountainSprays.length, 2);
  assert.ok(blocks.fountainSprays.every((spray) =>
    spray.parent === model.root));
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.sharedAirPressureIndependent, false);
  assert.equal(degreesOfFreedom.threeWaterLevelsIndependent, false);

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.equal(roles.filter((role) =>
    role.includes('right-hand-water-drain')).length, 1);
  assert.equal(roles.filter((role) =>
    role.includes('left-hand-pneumatic-communication')).length, 1);
  assert.equal(roles.filter((role) =>
    role.includes('central-water-riser')).length, 1);
  assert.equal(roles.filter((role) => /marker|tracer|bead/i.test(role)).length, 0);
  disposeModel(model.root);
});

test('movement 464 source record preserves Brown’s three paths and identifies the unavailable source animation', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.brownPlate464;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_464.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.plate, 'Brown 1868, Movement 464');
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(sourceAnimation.sourcePrescribedNormalizedTiming, false);
  assert.deepEqual(plate.approximateTopBasinBoundsPixels,
    [93, 106, 326, 63]);
  assert.deepEqual(plate.approximateIntermediateVesselBoundsPixels,
    [161, 155, 184, 125]);
  assert.deepEqual(plate.approximateLowerVesselBoundsPixels,
    [105, 402, 297, 65]);
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('right tube')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('left tube')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('central tube')));
  assert.match(evidence.engravingEvidence, /open rectangular upper basin/i);
  assert.match(evidence.reconstructionDisclosure, /no vessel capacities/i);
  assert.match(evidence.reconstructionDisclosure, /nonphysical hidden-flow reset/i);
  disposeModel(model.root);
});

test('movement 464 keeps the water and pneumatic connections topologically distinct', () => {
  const { model } = movementModel();
  const { blocks, transmission } = model.root.userData;

  assert.match(transmission.rightDrainPath,
    /upper basin -> right downpipe -> sealed lower vessel water/);
  assert.match(transmission.airPath,
    /lower sealed headspace <-> left communication tube/);
  assert.match(transmission.airPath,
    /intermediate sealed headspace/);
  assert.match(transmission.centralJetPath,
    /intermediate water -> submerged central riser intake/);
  assert.match(transmission.centralJetPath, /nozzle -> upper basin/);
  assert.match(transmission.topologyInvariant,
    /right pipe carries water and never connects to the intermediate vessel/);
  assert.match(transmission.topologyInvariant,
    /left pipe carries compressed air and never connects the water volumes/);
  assert.notEqual(blocks.rightDrainWater.material, blocks.airCore.material);
  assert.equal(blocks.centralRiserWater.material,
    blocks.jetColumn.material);
  assert.notEqual(blocks.leftAirPipe.geometry, blocks.rightDrainOuter.geometry);
  disposeModel(model.root);
});

test('movement 464 finite transfers conserve water exactly when the external pour is included', () => {
  const { model } = movementModel();
  const { geometry, stateAtTransferProgress } = model.root.userData;

  for (let index = 0; index <= 100; index += 1) {
    const progress = index / 100;
    const state = stateAtTransferProgress(progress);
    near(state.drainTransferVolume,
      geometry.lowerTransfer * progress, 1e-12,
      `right-drain transfer at ${progress}`);
    near(state.jetTransferVolume,
      geometry.intermediateTransfer * progress, 1e-12,
      `jet transfer at ${progress}`);
    near(state.externallyPouredVolume,
      geometry.externalPourTransfer * progress, 1e-12,
      `external pour at ${progress}`);
    near(state.lowerWaterVolume,
      geometry.lowerInitialWaterVolume + state.drainTransferVolume, 1e-12,
      `lower water gain at ${progress}`);
    near(state.intermediateWaterVolume,
      geometry.intermediateInitialWaterVolume - state.jetTransferVolume,
      1e-12, `intermediate water loss at ${progress}`);
    near(state.upperWaterVolume, geometry.topWaterVolume, 1e-12,
      `constant upper-basin volume at ${progress}`);
    near(state.drainTransferVolume,
      state.jetTransferVolume + state.externallyPouredVolume, 1e-12,
      `upper-basin throughflow balance at ${progress}`);
    near(state.waterBalanceResidual, 0, 2e-12,
      `total water balance at ${progress}`);
  }
  disposeModel(model.root);
});

test('movement 464 shared lower and intermediate headspaces obey one ideal-gas PV invariant', () => {
  const { model } = movementModel();
  const { geometry, stateAtTransferProgress } = model.root.userData;
  let previousPressure = 0;

  for (let index = 0; index <= 100; index += 1) {
    const progress = index / 100;
    const state = stateAtTransferProgress(progress);
    near(state.lowerGasVolume,
      geometry.lowerCapacity - state.lowerWaterVolume, 1e-12,
      `lower gas volume at ${progress}`);
    near(state.intermediateGasVolume,
      geometry.intermediateCapacity - state.intermediateWaterVolume, 1e-12,
      `intermediate gas volume at ${progress}`);
    near(state.sharedGasVolume,
      state.lowerGasVolume + state.intermediateGasVolume, 1e-12,
      `shared gas volume at ${progress}`);
    near(state.sharedGasPV, geometry.sharedGasPVConstant, 1e-7,
      `isothermal PV invariant at ${progress}`);
    assert.ok(state.sharedGasPressure >= previousPressure,
      `pressure does not fall during physical transfer at ${progress}`);
    assert.ok(state.sharedGasPressure > geometry.atmosphericPressure);
    assert.ok(state.availableJetHead > 0);
    near(state.idealJetHeight, state.availableJetHead, 1e-12,
      `positive ideal jet head at ${progress}`);
    previousPressure = state.sharedGasPressure;
  }
  disposeModel(model.root);
});

test('movement 464 vessel levels follow their volumes and move in the source-prescribed directions', () => {
  const { model } = movementModel();
  const { geometry, stateAtTransferProgress } = model.root.userData;
  const start = stateAtTransferProgress(0);
  const end = stateAtTransferProgress(1);

  for (const state of [start, stateAtTransferProgress(0.47), end]) {
    near(state.lowerWaterHeight,
      state.lowerWaterVolume / geometry.lowerArea, 1e-12,
      'lower volume-to-height conversion');
    const r=1.2,h=state.intermediateWaterHeight;
    const volume=1.35*(r*r*Math.acos((r-h)/r)-(r-h)*Math.sqrt(2*r*h-h*h));
    near(volume,state.intermediateWaterVolume,1e-10,'circular bowl volume-to-height conversion');
    near(state.topWaterHeight,
      state.upperWaterVolume / geometry.topArea, 1e-12,
      'upper volume-to-height conversion');
    near(state.lowerWaterSurfaceY,
      geometry.lowerBottomY + state.lowerWaterHeight, 1e-12,
      'lower water surface');
    near(state.intermediateWaterSurfaceY,
      geometry.intermediateBottomY + state.intermediateWaterHeight, 1e-12,
      'intermediate water surface');
    near(state.topWaterSurfaceY,
      geometry.topBasinBottomY + state.topWaterHeight, 1e-12,
      'upper water surface');
  }
  assert.ok(end.lowerWaterSurfaceY > start.lowerWaterSurfaceY);
  assert.ok(end.intermediateWaterSurfaceY < start.intermediateWaterSurfaceY);
  near(end.topWaterSurfaceY, start.topWaterSurfaceY, 1e-12,
    'open upper-basin level remains constant');
  disposeModel(model.root);
});

test('movement 464 physical flow rates have the same exact volume balance as the cumulative transfers', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;

  for (const phase of [0.05, 0.18, 0.36, 0.54, 0.68]) {
    const state = stateAtPhase(phase);
    assert.ok(state.transferProgressRate > 0);
    assert.ok(state.flowFraction > 0);
    assert.equal(state.physicalFlowsVisible, true);
    near(state.drainFlowRate,
      geometry.lowerTransfer * state.transferProgressRate, 1e-12,
      `drain rate at phase ${phase}`);
    near(state.jetFlowRate,
      geometry.intermediateTransfer * state.transferProgressRate, 1e-12,
      `jet rate at phase ${phase}`);
    near(state.externalPourFlowRate,
      geometry.externalPourTransfer * state.transferProgressRate, 1e-12,
      `pour rate at phase ${phase}`);
    near(state.drainFlowRate,
      state.jetFlowRate + state.externalPourFlowRate, 1e-12,
      `rate balance at phase ${phase}`);
  }
  const hold = stateAtPhase(0.76);
  const reset = stateAtPhase(0.90);
  near(hold.drainFlowRate, 0, 1e-12, 'hold drain stopped');
  near(reset.drainFlowRate, 0, 1e-12, 'reset drain hidden');
  near(reset.jetFlowRate, 0, 1e-12, 'reset jet hidden');
  near(reset.externalPourFlowRate, 0, 1e-12, 'reset pour hidden');
  assert.ok(reset.transferProgressRate < 0);
  assert.equal(reset.physicalFlowsVisible, false);
  assert.match(reset.regime, /nonphysical-hidden-level-reset/);
  assert.match(model.root.userData.dynamics.resetDisclosure,
    /no reverse water or air flow is depicted or claimed/);
  disposeModel(model.root);
});

test('movement 464 operating and hidden-reset schedule is C2 at every boundary and closes exactly', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;
  const boundaries = [0, geometry.operationEndPhase, geometry.resetStartPhase];
  const step = 1e-5;
  const fields = [
    'transferProgress',
    'lowerWaterSurfaceY',
    'intermediateWaterSurfaceY',
    'sharedGasPressure',
  ];

  for (const boundary of boundaries) {
    for (const field of fields) {
      const minusTwo = stateAtPhase(boundary - 2 * step)[field];
      const minusOne = stateAtPhase(boundary - step)[field];
      const center = stateAtPhase(boundary)[field];
      const plusOne = stateAtPhase(boundary + step)[field];
      const plusTwo = stateAtPhase(boundary + 2 * step)[field];
      const leftVelocity = (center - minusOne) / step;
      const rightVelocity = (plusOne - center) / step;
      const scale = Math.max(1, Math.abs(center));
      near(leftVelocity, rightVelocity, scale * 1e-3,
        `${field} velocity continuity at ${boundary}`);
      const leftAcceleration = (center - 2 * minusOne + minusTwo)
        / step ** 2;
      const rightAcceleration = (plusTwo - 2 * plusOne + center)
        / step ** 2;
      near(leftAcceleration, rightAcceleration, scale * 0.25,
        `${field} acceleration continuity at ${boundary}`);
    }
  }
  const source = stateAtPhase(0);
  const closure = stateAtPhase(1);
  near(closure.transferProgress, source.transferProgress, 1e-12,
    'transfer closure');
  near(closure.sharedGasPressure, source.sharedGasPressure, 1e-9,
    'pressure closure');
  near(closure.waterBalanceResidual, 0, 1e-12,
    'water balance at closure');
  disposeModel(model.root);
});

test('movement 464 renderer maps all three levels, pressure jet height, and flow visibility to state', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const phase of [0, 0.18, 0.36, 0.68, 0.76, 0.90]) {
    const time = phase * geometry.cycleDuration;
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.lowerWater.scale.y, state.lowerWaterHeight, 1e-12,
      `lower rendered height at ${phase}`);
    near(blocks.lowerWater.position.y,
      geometry.lowerBottomY + state.lowerWaterHeight / 2, 1e-12,
      `lower rendered center at ${phase}`);
    blocks.intermediateWater.geometry.computeBoundingBox();
    near(blocks.intermediateWater.geometry.boundingBox.max.y,state.intermediateWaterSurfaceY,2e-7,`intermediate rendered surface at ${phase}`);
    near(blocks.intermediateWater.geometry.boundingBox.min.y,geometry.intermediateBottomY,2e-7,`intermediate rendered bottom at ${phase}`);
    near(blocks.topWater.scale.y, state.topWaterHeight, 1e-12,
      `upper rendered height at ${phase}`);
    near(blocks.jetColumn.scale.y,
      Math.max(0.02, state.idealJetHeight), 1e-12,
      `jet pressure-head height at ${phase}`);
    assert.equal(blocks.rightDrainWater.visible,
      state.physicalFlowsVisible);
    assert.equal(blocks.centralRiserWater.visible,
      state.physicalFlowsVisible);
    assert.equal(blocks.jetColumn.visible, state.physicalFlowsVisible);
    // Drain equals jet: no external pour is needed or drawn.
    assert.equal(blocks.externalPour.visible, false);
    near(geometry.externalPourTransfer, 0, 0, 'no external pour');
    assert.ok(blocks.fountainSprays.every(({ visible }) =>
      visible === state.physicalFlowsVisible));
  }
  disposeModel(model.root);
});

test('movement 464 source pose is a physically valid operating state with a pressure-supported jet', () => {
  const { model } = movementModel();
  const { sourcePose, stateAtTransferProgress } = model.root.userData;
  const source = stateAtTransferProgress(sourcePose.transferProgress);

  near(sourcePose.transferProgress, 0.35, 1e-12,
    'source operating progress');
  near(sourcePose.lowerWaterSurfaceY, source.lowerWaterSurfaceY, 1e-12,
    'source lower level');
  near(sourcePose.intermediateWaterSurfaceY,
    source.intermediateWaterSurfaceY, 1e-12,
    'source intermediate level');
  near(sourcePose.topWaterSurfaceY, source.topWaterSurfaceY, 1e-12,
    'source upper level');
  near(sourcePose.sharedGasPressure, source.sharedGasPressure, 1e-9,
    'source shared pressure');
  near(sourcePose.idealJetHeight, source.idealJetHeight, 1e-12,
    'source ideal jet height');
  assert.ok(sourcePose.idealJetHeight > 0);
  disposeModel(model.root);
});

test('movement 464 has finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement464 = catalog.movements[463];
  const movement507 = catalog.movements[506];
  const model464 = createMovementModel(movement464);
  const model507 = createMovementModel(movement507);
  const fitBounds = model464.root.userData.cameraFitBounds;

  for (const phase of [0, 0.36, 0.90]) {
    model464.update(phase * model464.root.userData.geometry.cycleDuration);
    model464.root.updateMatrixWorld(true);
    const bounds=new THREE.Box3(),point=new THREE.Vector3();
    model464.root.traverseVisible(o=>{const p=o.geometry?.attributes.position;if(p)for(let i=0;i<p.count;i++)bounds.expandByPoint(point.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));});
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
  assert.equal(movement464.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model464.root);
  disposeModel(model507.root);
});
