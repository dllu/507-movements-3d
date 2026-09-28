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
  'four-chamber-helical-drum-wet-gas-meter-with-water-sealed-sequential-fill-discharge-central-turned-inlet-and-revolution-totalizer';

function movementModel() {
  const movement = catalog.movements[480];
  return { model: createMovementModel(movement), movement };
}

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

test('movement 481 is one stationary water case A around one four-compartment revolving drum', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 481);
  assert.equal(movement.number, '481');
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.match(model.root.userData.mechanism,
    /Stationary case A contains water above its horizontal centerline/);
  assert.match(model.root.userData.mechanism,
    /Four equal B compartments.*approximately helical partitions/s);
  assert.match(model.root.userData.mechanism,
    /Fixed pipe a passes through the hollow journal and turns upward/);
  assert.match(model.root.userData.mechanism,
    /Four chamber volumes pass per drum revolution/);
  assert.equal(degreesOfFreedom.independentOperatingCoordinates, 1);
  assert.equal(degreesOfFreedom.drumRotation, 1);
  assert.equal(degreesOfFreedom.registerPointerRotationSlavedByDialWork, 1);
  assert.equal(degreesOfFreedom.stationaryInletAndCase, 0);
  assert.equal(blocks.stationaryCaseA.parent, model.root);
  assert.equal(blocks.caseWater.parent, model.root);
  assert.equal(blocks.centralInletPipeA.parent, model.root);
  assert.equal(blocks.drum.parent, model.root);
  assert.equal(blocks.partitions.length, geometry.chamberCount);
  assert.equal(blocks.chamberMouths.length, geometry.chamberCount);
  assert.equal(blocks.peripheralOutletSlots.length, geometry.chamberCount);
  assert.equal(blocks.gasPockets.length, geometry.chamberCount);
  assert.equal(blocks.flowMarkers.length, geometry.markersPerPath);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'stationary-cylindrical-case-A-partly-filled-with-water',
    'stationary-water-volume-above-drum-centerline',
    'one-revolving-four-compartment-measuring-drum',
    'hollow-rotating-journal-surrounding-central-inlet-pipe-a',
    'stationary-central-pipe-a-through-journal-turned-above-water',
  ]) assert.ok(roles.includes(role), role);
  // Brown's plate does not draw the register; source presentation removes it.
  assert.ok(!roles.includes('dial-work-registering-known-volume-per-drum-revolution'));
  assert.ok(model.root.userData.sourcePresentation.removedRoles.includes('dial-work-registering-known-volume-per-drum-revolution'));
  disposeModel(model.root);
});

test('movement 481 preserves Brown’s unavailable source and all named wet-meter operations', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate481;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_481.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /stationary case, A.*water.*above the center/s);
  assert.match(movement.description, /divided into four compartments, B, B/);
  assert.match(movement.description, /central pipe, a.*hollow journals/s);
  assert.match(movement.description, /turned up to admit the gas above the water/);
  assert.match(movement.description, /compartments.*one after another.*turns the drum/s);
  assert.match(movement.description, /cubic contents.*revolutions.*dial-work/s);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateDrumCenterPixels, [263, 264]);
  assert.deepEqual(plate.approximateCentralPipePixels, [262, 258]);
  assert.deepEqual(plate.approximateWaterSurfacePixels, [260, 230]);
  assert.deepEqual(plate.approximatePeripheralDirectionArrowPixels,
    [365, 349]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.engravingEvidence,
    /four curved drum partitions.*gap on its outer side.*counterclockwise peripheral direction arrow/s);
  assert.match(evidence.historicalCorroboration,
    /Bureau of Standards Circular 309.*four-compartment approximately helical drum/s);
  assert.match(evidence.historicalCorroboration,
    /rear inlet openings.*front outlet openings.*one known delivery/s);
  assert.match(evidence.reconstructionDisclosure,
    /10:1 dial reduction.*independently engineered/);
  assert.match(sourceReference.bureauOfStandardsCircular309Url,
    /govinfo\.gov/);
  disposeModel(model.root);
});

test('movement 481 drum rotation, throughput, and accumulated register obey exact positive-displacement ratios', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime, transmission } =
    model.root.userData;

  near(geometry.volumePerDrumRevolutionCubicMetre,
    geometry.chamberCount * geometry.nominalChamberVolumeCubicMetre,
    0, 'volume per drum revolution');
  near(geometry.nominalVolumeFlowCubicMetrePerSecond,
    geometry.volumePerDrumRevolutionCubicMetre
      / geometry.cycleDuration,
    0, 'nominal volume flow');
  near(geometry.drumAngularVelocityRadianPerSecond,
    2 * Math.PI / geometry.cycleDuration,
    0, 'drum angular velocity');
  near(geometry.dialVolumePerRevolutionCubicMetre,
    geometry.registerReductionRatio
      * geometry.volumePerDrumRevolutionCubicMetre,
    0, 'dial volume per revolution');

  for (const time of [0, 0.7, 2, 5.3, 8, 14.5, 24]) {
    const state = stateAtTime(time);
    near(state.drumAngleRadian,
      geometry.drumAngularVelocityRadianPerSecond * time,
      0, `drum angle at ${time}`);
    near(state.drumRevolutionsElapsed,
      time / geometry.cycleDuration, 0,
      `drum revolutions at ${time}`);
    near(state.measuredVolumeCubicMetre,
      geometry.nominalVolumeFlowCubicMetrePerSecond * time,
      0, `totalized volume at ${time}`);
    near(state.dialAngleRadian,
      -state.drumAngleRadian / geometry.registerReductionRatio,
      0, `dial angle at ${time}`);
  }
  near(stateAtTime(geometry.cycleDuration).measuredVolumeCubicMetre,
    geometry.volumePerDrumRevolutionCubicMetre,
    0, 'one-turn measured volume');
  assert.match(dynamics.meterLaw,
    /Q=\(4\*V_chamber\)\*omega\/\(2\*pi\)/);
  assert.match(transmission.meterEquation,
    /V_measured=N_drum\*\(4\*V_chamber\)/);
  assert.match(transmission.dialEquation,
    /theta_dial=-theta_drum\/10/);
  disposeModel(model.root);
});

test('movement 481 quarter-staggered chambers sequentially fill, seal, discharge, and refill with water', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime, transmission } =
    model.root.userData;
  const expectedStages = new Set([
    'filling-from-central-dry-well',
    'sealed-known-volume',
    'discharging-to-outer-case',
    'submerged-and-refilling-with-water',
  ]);

  for (let sample = 0; sample <= 1600; sample += 1) {
    const state = stateAtTime(
      geometry.cycleDuration * sample / 1600,
    );
    assert.equal(state.chamberStates.length, geometry.chamberCount);
    assert.deepEqual(new Set(state.chamberStates.map(({ stage }) => stage)),
      expectedStages);
    near(state.chamberStates.reduce(
      (sum, chamber) => sum + chamber.fillFraction,
      0,
    ), 2, 9e-16, `two chamber-volumes of gas at sample ${sample}`);
    near(state.totalChamberGasVolumeCubicMetre,
      2 * geometry.nominalChamberVolumeCubicMetre,
      8e-18, `constant drum gas inventory at sample ${sample}`);
    near(state.instantaneousInletFlowCubicMetrePerSecond,
      geometry.nominalVolumeFlowCubicMetrePerSecond,
      1e-18, `inlet flow at sample ${sample}`);
    near(state.instantaneousOutletFlowCubicMetrePerSecond,
      geometry.nominalVolumeFlowCubicMetrePerSecond,
      1e-18, `outlet flow at sample ${sample}`);
    for (let index = 0; index < geometry.chamberCount; index += 1) {
      const chamber = state.chamberStates[index];
      near(chamber.localPhase,
        THREE.MathUtils.euclideanModulo(
          state.phase + index / geometry.chamberCount
            + geometry.stagePhaseOffset,
          1,
        ), 0, `quarter phase ${index} at sample ${sample}`);
      near(chamber.chamberGasVolumeCubicMetre,
        geometry.nominalChamberVolumeCubicMetre
          * chamber.fillFraction,
        0, `chamber volume ${index} at sample ${sample}`);
      assert.ok(chamber.fillFraction >= 0 && chamber.fillFraction <= 1);
      assert.equal(chamber.inletOpen,
        chamber.stage === 'filling-from-central-dry-well');
      assert.equal(chamber.outletOpen,
        chamber.stage === 'discharging-to-outer-case');
    }
  }
  assert.match(dynamics.chamberCycle,
    /quarter-cycle staggered.*filled.*sealed.*discharged.*refilled with water/s);
  assert.match(transmission.chamberPhaseEquation,
    /u_i=mod\(theta\/\(2\*pi\)\+i\/4\+u_0,1\)/);
  disposeModel(model.root);
});

test('movement 481 water is level above the horizontal axis and the turned inlet a ends above it', () => {
  const { model } = movementModel();
  const { blocks, dynamics, flowPaths, geometry, motion } =
    model.root.userData;
  model.root.updateMatrixWorld(true);
  const waterBounds = new THREE.Box3().setFromObject(blocks.caseWater);

  assert.ok(geometry.waterSurfaceY > 0);
  near(waterBounds.max.y, geometry.waterSurfaceY, 1e-5,
    'horizontal modeled water surface');
  assert.ok(waterBounds.min.y < -geometry.drumRadiusSceneUnit);
  assert.ok(flowPaths.centralInletCurve.getPoint(1).y
    > geometry.waterSurfaceY);
  assert.ok(flowPaths.centralInletCurve.getPoint(0).y
    < geometry.waterSurfaceY);
  vectorNear(motion.drumRotationAxis, new THREE.Vector3(0, 0, 1),
    0, 'horizontal drum axis');
  assert.equal(motion.drumDirectionViewedFromFront, 'counterclockwise');
  assert.match(dynamics.waterSeal,
    /filled above the drum center.*alternately emerge and submerge/s);
  disposeModel(model.root);
});

test('movement 481 rotating rear and front ports follow the exact drum angle while pipe a stays fixed', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const pipePosition = blocks.centralInletPipeA.position.clone();
  const casePosition = blocks.stationaryCaseA.position.clone();
  const waterPosition = blocks.caseWater.position.clone();

  for (const time of [0, 0.93, 2.4, 4.7, 7.2]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.drum.rotation.z, state.drumAngleRadian, 0,
      `drum renderer at ${time}`);
    for (let index = 0; index < geometry.chamberCount; index += 1) {
      const chamber = state.chamberStates[index];
      const inletWorld = blocks.chamberMouths[index].getWorldPosition(
        new THREE.Vector3(),
      );
      near(inletWorld.x,
        geometry.centralInletPortRadiusSceneUnit
          * Math.cos(chamber.inletPortAngleRadian),
        4e-15, `inlet port x ${index} at ${time}`);
      near(inletWorld.y, chamber.inletPortY, 4e-15,
        `inlet port y ${index} at ${time}`);
      const outletWorld = blocks.peripheralOutletSlots[index].getWorldPosition(
        new THREE.Vector3(),
      );
      near(outletWorld.x,
        geometry.peripheralOutletPortRadiusSceneUnit
          * Math.cos(chamber.outletPortAngleRadian),
        4e-15, `outlet port x ${index} at ${time}`);
      near(outletWorld.y, chamber.outletPortY, 4e-15,
        `outlet port y ${index} at ${time}`);
    }
    vectorNear(blocks.centralInletPipeA.position, pipePosition, 0,
      `central pipe fixed at ${time}`);
    vectorNear(blocks.stationaryCaseA.position, casePosition, 0,
      `case A fixed at ${time}`);
    vectorNear(blocks.caseWater.position, waterPosition, 0,
      `water fixed at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 481 compartments have Brown’s outer gaps and the outlet stage opens as the gap leaves the water', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  // Each chamber wall is one solid carrying its own stretch of shell; the
  // shell is interrupted once per compartment (four outlet gaps).
  model.update(0);
  model.root.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  const wallMeshes = blocks.partitions.flatMap((group) => group.children);
  const hits = [];
  const samples = 720;
  for (let sample = 0; sample < samples; sample += 1) {
    const angle = 2 * Math.PI * sample / samples;
    const radial = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
    raycaster.set(radial.clone().multiplyScalar(geometry.drumRadiusSceneUnit + 0.3), radial.clone().negate());
    raycaster.far = 0.4;
    hits.push(raycaster.intersectObjects(wallMeshes, false).length > 0);
  }
  const gaps = hits.filter((hit, index) => hit && !hits[(index + 1) % samples]).length;
  assert.equal(gaps, 4, 'four outer gaps in the drum shell');
  // Each gap centre is open: nothing of the drum at the shell radius there.
  for (const slot of blocks.peripheralOutletSlots) {
    const p = slot.getWorldPosition(new THREE.Vector3());
    const radial = p.clone().setZ(0).normalize();
    raycaster.set(radial.clone().multiplyScalar(geometry.drumRadiusSceneUnit + 0.3), radial.clone().negate());
    raycaster.far = 0.4;
    assert.equal(raycaster.intersectObjects(wallMeshes, false).length, 0);
  }
  // Discharge starts exactly when a chamber's gap rises out of the water.
  const emergenceTime = geometry.cycleDuration
    * THREE.MathUtils.euclideanModulo(0.5 - geometry.stagePhaseOffset, 1);
  const chamber0 = stateAtTime(emergenceTime).chamberStates[0];
  near(chamber0.localPhase, 0.5, 1e-9, 'chamber 0 starts discharging');
  near(chamber0.outletPortY, geometry.waterSurfaceY, 1e-9, 'its gap is at the water line');
  disposeModel(model.root);
});

test('movement 481 renderer binds the reduced dial to the state; gas pockets are not drawn', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.8, 2, 3.3, 5.8, 8, 11.7]) {
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.dialPointer.rotation.z, state.dialAngleRadian, 0,
      `dial pointer at ${time}`);
    for (let index = 0; index < geometry.chamberCount; index += 1) {
      const fillFraction = state.chamberStates[index].fillFraction;
      // Pass 55: no tinted gas stands in for the section (colour is not a
      // signal); the pockets stay in the drum but are never drawn.
      assert.equal(blocks.gasPockets[index].material.visible, false,
        `gas pocket ${index} (fill ${fillFraction}) is not drawn at ${time}`);
      assert.equal(blocks.gasPockets[index].parent, blocks.drum);
      assert.equal(blocks.partitions[index].parent, blocks.drum);
    }
  }
  disposeModel(model.root);
});

test('movement 481 totalized-volume markers move continuously by arc length through all of pipe a', () => {
  const { model } = movementModel();
  const { blocks, dynamics, flowPaths, geometry, stateAtTime } =
    model.root.userData;

  for (const time of [0.17, 1.2, 3.65, 8.4, 17.1]) {
    const state = stateAtTime(time);
    model.update(time);
    near(state.markerTravelTurns,
      geometry.markerPassesPerDrumRevolution
        * state.drumRevolutionsElapsed,
      0, `volume-integrated travel at ${time}`);
    for (let index = 0; index < geometry.markersPerPath; index += 1) {
      const progress = flowPaths.markerProgress(
        state.markerTravelTurns,
        index,
      );
      vectorNear(blocks.flowMarkers[index].position,
        flowPaths.centralInletCurve.getPointAt(progress),
        2e-15, `arc-length marker ${index} at ${time}`);
      near(blocks.flowMarkers[index].scale.x,
        Math.sin(Math.PI * progress) ** 0.52,
        2e-15, `endpoint fade ${index} at ${time}`);
    }
  }
  const before = stateAtTime(3.2).markerTravelTurns;
  const after = stateAtTime(3.2 + 1e-6).markerTravelTurns;
  assert.ok(after > before);
  assert.match(dynamics.markerContinuity,
    /totalized metered volume.*complete stationary pipe.*getPointAt/s);
  disposeModel(model.root);
});

test('movement 481 drum closes geometrically after one measured revolution while its dial keeps totalizing', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const end = stateAtTime(geometry.cycleDuration);

  near(end.drumAngleRadian - start.drumAngleRadian,
    2 * Math.PI, 0, 'one drum revolution');
  near(end.drumAngleModuloRadian, start.drumAngleModuloRadian, 0,
    'geometric angle closure');
  near(end.phase, start.phase, 0, 'phase closure');
  near(end.totalChamberGasVolumeCubicMetre,
    start.totalChamberGasVolumeCubicMetre, 0,
    'chamber inventory closure');
  for (let index = 0; index < geometry.chamberCount; index += 1) {
    near(end.chamberStates[index].fillFraction,
      start.chamberStates[index].fillFraction, 0,
      `chamber ${index} closure`);
    assert.equal(end.chamberStates[index].stage,
      start.chamberStates[index].stage);
  }
  near(end.measuredVolumeCubicMetre,
    geometry.volumePerDrumRevolutionCubicMetre, 0,
    'totalizer retains measured volume');
  near(end.dialAngleRadian - start.dialAngleRadian,
    -2 * Math.PI / geometry.registerReductionRatio,
    0, 'dial advances rather than resetting');
  disposeModel(model.root);
});

test('movement 481 fits every drum pose and leaves spinning movement 507 as the authored frontier', () => {
  const { model } = movementModel();
  const { blocks, geometry } = model.root.userData;
  const union = new THREE.Box3();
  for (let sample = 0; sample <= 160; sample += 1) {
    model.update(geometry.cycleDuration * sample / 160);
    union.union(new THREE.Box3().setFromObject(model.root));
  }
  assert.ok(model.root.userData.cameraFitBounds.containsBox(union));
  assert.ok(model.root.userData.cameraDistanceScale >= 1);
  const baseBounds = new THREE.Box3().setFromObject(blocks.base);
  assert.ok(model.root.userData.groundFloorY <= baseBounds.min.y);

  const next = catalog.movements[506];
  assert.equal(next.id, 507);
  assert.equal(next.number, '507');
  assert.equal(next.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(next.fidelity, 'authored');
  disposeModel(model.root);
});

test('481: the partition sheets end on the drum heads\' inner faces, not in their rims', () => {
  const { model } = movementModel();
  let head = null;
  const sheets = [];
  model.root.traverse((o) => {
    if (o.userData.role === 'finite-ported-drum-head') head = o;
    if (/^hooked-sheet-of-partition-/.test(o.userData.role ?? '')) sheets.push(o);
  });
  assert.equal(sheets.length, 4);
  head.geometry.computeBoundingBox();
  const headInner = head.geometry.boundingBox.max.z + head.position.z;
  for (const sheet of sheets) {
    sheet.geometry.computeBoundingBox();
    assert.ok(Math.abs(sheet.geometry.boundingBox.min.z - headInner) < 1e-6, 'sheet ends on the head inner face');
  }
});
