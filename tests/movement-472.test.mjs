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
  'grimshaw-compressed-air-hammer-with-double-acting-pump-hollow-frame-reservoir-variable-friction-disk-driven-slide-valve-adjustable-cutoff-and-double-acting-hammer-piston';

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
    } else if (object.material) {
      materials.add(object.material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function movementModel() {
  const movement = catalog.movements[471];
  return { model: createMovementModel(movement), movement };
}

test('movement 472 contains one shaft-driven pump, hollow reservoir, valve transmission, and rigid hammer assembly', () => {
  const { model, movement } = movementModel();
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 472);
  assert.equal(movement.number, '472');
  assert.equal(movement.title, 'Grimshaw’s compressed air hammer');
  assert.equal(movement.category, 'Pumps & pneumatics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.driveAssembly.parent, model.root);
  assert.equal(blocks.pumpCylinder.parent, model.root);
  assert.equal(blocks.pumpPistonAssembly.parent, model.root);
  assert.equal(blocks.pumpConnectingRod.parent, model.root);
  assert.equal(blocks.hollowReservoirFrame.parent, model.root);
  assert.equal(blocks.reservoirAir.parent, model.root);
  assert.equal(blocks.frictionWheelAssembly.parent, model.root);
  assert.equal(blocks.frictionDiskAssembly.parent, model.root);
  assert.equal(blocks.slideValve.parent, model.root);
  assert.equal(blocks.fixedHammerCylinder.parent, model.root);
  assert.equal(blocks.hammerAssembly.parent, model.root);
  assert.equal(blocks.hammerPiston.parent, blocks.hammerAssembly);
  assert.equal(blocks.hammerPistonRod.parent, blocks.hammerAssembly);
  assert.equal(blocks.hammerHead.parent, blocks.hammerAssembly);
  assert.equal(degreesOfFreedom.prescribedRotaryInputs, 1);
  assert.equal(degreesOfFreedom.physicalOperatingDegreesOfFreedom, 3);
  assert.equal(degreesOfFreedom.mainShaftToPumpIndependent, false);
  assert.equal(degreesOfFreedom.mainShaftToValveDiskIndependent, false);
  assert.equal(degreesOfFreedom.pumpAndHammerSharePosition, false);
  assert.equal(degreesOfFreedom.hammerPistonAndHeadIndependent, false);
  disposeModel(model.root);
});

test('movement 472 source record preserves Brown and Grimshaw primary-source construction evidence', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const brown = sourceReference.brownConstructionEvidence;
  const paper = sourceReference.grimshaw1865Paper;
  const patent = sourceReference.grimshawPatent45896;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_472.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.plate, 'Brown 1868, Movement 472');
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, true);
  assert.equal(sourceAnimation.sourcePrescribedNormalizedTiming, false);
  assert.deepEqual(
    sourceReference.brownPlate472.approximatePumpDBoundsPixels,
    [106, 304, 81, 151],
  );
  assert.ok(brown.explicitInBrownDescription.some((claim) =>
    claim.includes('piston A working inside cylinder B')));
  assert.ok(brown.explicitInBrownDescription.some((claim) =>
    claim.includes('above and below')));
  assert.ok(brown.explicitInBrownDescription.some((claim) =>
    claim.includes('reservoir C')));
  assert.ok(brown.explicitInBrownDescription.some((claim) =>
    claim.includes('pump D is driven')));
  assert.match(brown.engravingEvidence, /hollow curved frame C/i);
  assert.equal(patent.patentNumber, 'US45896A');
  assert.equal(patent.date, '1865-01-10');
  assert.ok(patent.claimsRepresented.some((claim) =>
    claim.includes('four check valves')));
  assert.ok(patent.claimsRepresented.some((claim) =>
    claim.includes('variable-radius friction wheel')));
  assert.ok(paper.dimensionsAndOperation.some((claim) =>
    claim.includes('8 inch bore and 8 inch stroke')));
  assert.ok(paper.dimensionsAndOperation.some((claim) =>
    claim.includes('4.5 inch bore and 10 inch full stroke')));
  assert.ok(paper.dimensionsAndOperation.some((claim) =>
    claim.includes('20 psi gauge')));
  assert.ok(paper.dimensionsAndOperation.some((claim) =>
    claim.includes('150 to 420 blows')));
  assert.match(sourceReference.reconstructionDisclosure,
    /180 rpm shaft, 270 blows\/minute/i);
  disposeModel(model.root);
});

test('movement 472 keeps Brown’s drawn proportions with the primary-source pump stroke, hammer bore, pressure, and operating-speed ratios', () => {
  const { model } = movementModel();
  const { geometry } = model.root.userData;

  // Brown draws pump D about as wide as cylinder B and a short hammer
  // travel; both follow the plate, not Grimshaw's 8-inch bore and 10-inch
  // stroke, which remain recorded as source values.
  near(2 * geometry.pumpInnerRadius / geometry.brownUnitsPerPixel,
    geometry.brownPumpBorePixels, 1e-9, 'pump bore from the plate');
  assert.ok(2 * geometry.pumpInnerRadius
    < geometry.sourcePumpBoreInch * geometry.visualUnitsPerSourceInch);
  near(geometry.pumpStroke / geometry.visualUnitsPerSourceInch,
    geometry.sourcePumpStrokeInch, 1e-12, 'pump stroke scale');
  near(2 * geometry.hammerInnerRadius
    / geometry.visualUnitsPerSourceInch,
  geometry.sourceHammerPistonBoreInch, 1e-12,
  'hammer-piston bore scale');
  // Cylinder B's drawn bore (85 doubled-plate pixels) is the same 4.5 in.
  near(2 * geometry.hammerInnerRadius / geometry.brownUnitsPerPixel, 85,
    0.1, 'hammer-piston bore on the plate');
  near(geometry.hammerStroke / geometry.brownUnitsPerPixel,
    geometry.brownHammerStrokePixels, 1e-9, 'hammer stroke from the plate');
  // The stroke fits between B's lower head and the anvil with the head.
  assert.ok(geometry.anvilTopY + geometry.hammerStroke
    + geometry.hammerHeadHeight < geometry.hammerCylinderInnerBottomY - 0.08);
  assert.ok(geometry.hammerPistonBottomCenterY + geometry.hammerStroke
    + geometry.hammerPistonThickness / 2 < geometry.hammerCylinderInnerTopY);
  near(geometry.frictionSpeedRatio,
    geometry.sourceHammerBlowsPerMinute / geometry.sourceMainShaftRpm,
    1e-12, 'selected valve-drive ratio');
  near(geometry.hammerCycleDuration,
    geometry.driveCycleDuration / geometry.frictionSpeedRatio,
    1e-12, 'display cycle ratio');
  near(geometry.reservoirGaugePressurePascal
    / geometry.pressurePascalPerPsi,
  geometry.sourceTypicalGaugePressurePsi, 1e-12,
  'ordinary source pressure');
  near(geometry.reservoirAbsolutePressurePascal,
    geometry.atmosphericPressurePascal
      + geometry.reservoirGaugePressurePascal,
  1e-12, 'absolute reservoir pressure');
  assert.ok(geometry.sourceMainShaftRpm >= 150
    && geometry.sourceMainShaftRpm <= 200);
  assert.ok(geometry.sourceHammerBlowsPerMinute >= 150
    && geometry.sourceHammerBlowsPerMinute <= 420);
  assert.ok(geometry.educationalTimeScale > 1);
  disposeModel(model.root);
});

test('movement 472 shaft-E crank and pump-D rod close an exact vertical slider-crank with an eight-inch stroke', () => {
  const { model } = movementModel();
  const { geometry, pumpKinematicsAtDrivePhase } = model.root.userData;

  for (const phase of [0, 0.08, 0.19, 0.31, 0.5, 0.68, 0.84, 0.97]) {
    const state = pumpKinematicsAtDrivePhase(phase);
    near(state.crankPin.distanceTo(state.pistonPin),
      geometry.pumpConnectingRodLength, 2e-12,
      `pump rod closure at ${phase}`);
    near(state.pistonPin.x, geometry.pumpAxisX, 1e-12,
      `pump slider x at ${phase}`);
    near(state.pistonPin.z, geometry.pumpAxisZ, 1e-12,
      `pump slider z at ${phase}`);
  }
  const bottom = pumpKinematicsAtDrivePhase(0);
  const top = pumpKinematicsAtDrivePhase(0.5);
  near(top.pistonCenterY - bottom.pistonCenterY,
    geometry.pumpStroke, 1e-12, 'full pump stroke');
  for (let index = 0; index <= 400; index += 1) {
    const y = pumpKinematicsAtDrivePhase(index / 400).pistonCenterY;
    assert.ok(y >= bottom.pistonCenterY - 1e-12);
    assert.ok(y <= top.pistonCenterY + 1e-12);
  }
  disposeModel(model.root);
});

test('movement 472 pump-D velocity and acceleration are analytic derivatives and its four checks alternate correctly', () => {
  const { model } = movementModel();
  const { geometry, pumpStateAtDrivePhase } = model.root.userData;
  const phaseStep = 1e-5;
  const timeStep = phaseStep * geometry.driveCycleDuration;

  for (const phase of [0.08, 0.19, 0.32, 0.63, 0.78, 0.91]) {
    const center = pumpStateAtDrivePhase(phase);
    const before = pumpStateAtDrivePhase(phase - phaseStep);
    const after = pumpStateAtDrivePhase(phase + phaseStep);
    near((after.pistonCenterY - before.pistonCenterY)
      / (2 * timeStep), center.pistonVelocity, 3e-9,
    `pump velocity at ${phase}`);
    near((after.pistonCenterY - 2 * center.pistonCenterY
      + before.pistonCenterY) / timeStep ** 2,
    center.pistonAcceleration, 8e-6,
    `pump acceleration at ${phase}`);
    near(center.deliveredFlowVisualVolumePerSecond,
      geometry.pumpPistonArea * Math.abs(center.pistonVelocity),
      1e-12, `pump delivery flow at ${phase}`);
    assert.ok(center.lowerChamberHeight > 0);
    assert.ok(center.upperChamberHeight > 0);
    if (center.pistonVelocity > 0) {
      assert.equal(center.lowerInletValveOpen, true);
      assert.equal(center.upperDeliveryValveOpen, true);
      assert.equal(center.upperInletValveOpen, false);
      assert.equal(center.lowerDeliveryValveOpen, false);
    } else {
      assert.equal(center.upperInletValveOpen, true);
      assert.equal(center.lowerDeliveryValveOpen, true);
      assert.equal(center.lowerInletValveOpen, false);
      assert.equal(center.upperDeliveryValveOpen, false);
    }
  }
  near(geometry.pumpDeliveredVolumePerDriveRevolution,
    2 * geometry.pumpPistonArea * geometry.pumpStroke,
    1e-12, 'double-acting displacement per revolution');
  disposeModel(model.root);
});

test('movement 472 variable-radius friction pair drives the valve disk 1.5 turns per shaft turn without slip', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;

  near(geometry.frictionContactRadius,
    geometry.frictionWheelRadius / geometry.frictionSpeedRatio,
    1e-12, 'selected disk contact radius');
  for (const time of [0, 0.17, 0.63, 1.24, 2.4, 4.31]) {
    const { friction } = stateAtTime(time);
    near(friction.wheelSurfaceSpeed, friction.diskSurfaceSpeed,
      2e-15, `contact surface speed at ${time}`);
    near(friction.noSlipResidual, 0, 2e-15,
      `no-slip residual at ${time}`);
    near(friction.diskAngularVelocity / friction.wheelAngularVelocity,
      geometry.frictionSpeedRatio, 1e-12,
      `angular-speed ratio at ${time}`);
  }
  const start = stateAtTime(0).friction;
  const oneShaftTurn = stateAtTime(geometry.driveCycleDuration).friction;
  near(oneShaftTurn.wheelAngle - start.wheelAngle,
    FULL_TURN_FOR_TEST(), 1e-12, 'one shaft revolution');
  near(oneShaftTurn.diskAngle - start.diskAngle,
    FULL_TURN_FOR_TEST() * geometry.frictionSpeedRatio, 1e-12,
    'one-and-a-half disk revolutions');
  disposeModel(model.root);
});

function FULL_TURN_FOR_TEST() {
  return Math.PI * 2;
}

test('movement 472 disk crank and forked rod move the slide valve on one exact straight axis with correct port order', () => {
  const { model } = movementModel();
  const { geometry, valveKinematicsAtHammerPhase } = model.root.userData;

  for (const phase of [0, 0.08, 0.25, 0.42, 0.5, 0.63, 0.75, 0.92,
    0.98]) {
    const valve = valveKinematicsAtHammerPhase(phase);
    near(valve.crankPin.distanceTo(valve.sliderPin),
      geometry.valveConnectingRodLength, 2e-12,
      `valve rod closure at ${phase}`);
    near(valve.sliderPin.y, geometry.valveLinkageY, 1e-12,
      `valve slider y at ${phase}`);
    near(valve.sliderPin.z, geometry.valveSliderAxisZ, 1e-12,
      `valve slider z at ${phase}`);
  }
  const lowerAdmission = valveKinematicsAtHammerPhase(0.25);
  const lowerCutoff = valveKinematicsAtHammerPhase(
    geometry.lowerCutoffPhase,
  );
  const upperAdmission = valveKinematicsAtHammerPhase(0.75);
  const upperCutoff = valveKinematicsAtHammerPhase(
    geometry.upperCutoffPhase,
  );
  assert.ok(lowerAdmission.command > 0);
  near(lowerAdmission.lowerSupplyOpening, 1, 1e-12,
    'full lower admission');
  near(lowerAdmission.upperExhaustOpening, 1, 1e-12,
    'full upper exhaust');
  near(lowerCutoff.lowerSupplyOpening, 0, 1e-12,
    'lower cutoff closes admission early');
  assert.ok(upperAdmission.command < 0);
  near(upperAdmission.upperSupplyOpening, 1, 1e-12,
    'full upper admission');
  near(upperAdmission.lowerExhaustOpening, 1, 1e-12,
    'full lower exhaust');
  near(upperCutoff.upperSupplyOpening, 0, 1e-12,
    'upper cutoff closes admission early');
  near(valveKinematicsAtHammerPhase(0).command, 0, 1e-12,
    'bottom crossover');
  near(valveKinematicsAtHammerPhase(0.5).command, 0, 1e-12,
    'top crossover');
  disposeModel(model.root);
});

test('movement 472 piston A, rod, head, and face preserve one rigid translation and strike at finite speed', () => {
  const { model } = movementModel();
  const { geometry, hammerKinematicsAtPhase } = model.root.userData;
  const pistonToHead = geometry.hammerPistonBottomCenterY
    - geometry.hammerHeadBottomCenterY;

  for (const phase of [0, 0.12, 0.25, 0.42, 0.5, 0.72, 0.92, 0.99]) {
    const hammer = hammerKinematicsAtPhase(phase);
    near(hammer.pistonCenterY - hammer.hammerHeadCenterY,
      pistonToHead, 1e-12, `rigid hammer offset at ${phase}`);
    near(hammer.hammerFaceY,
      hammer.hammerHeadCenterY - geometry.hammerHeadHeight / 2,
      1e-12, `hammer face offset at ${phase}`);
    assert.ok(hammer.hammerFaceY >= geometry.anvilTopY - 1e-12,
      `hammer penetrates anvil at ${phase}`);
  }
  near(hammerKinematicsAtPhase(0.5).lift,
    geometry.hammerStroke, 1e-12, 'top of stroke');
  const epsilon = 1e-9;
  const preImpact = hammerKinematicsAtPhase(1 - epsilon);
  const impact = hammerKinematicsAtPhase(0);
  near(preImpact.hammerFaceY, geometry.anvilTopY,
    9e-9, 'pre-impact face contact');
  near(preImpact.velocity, -geometry.impactSpeedVisualUnitsPerSecond,
    3e-8, 'finite pre-impact velocity');
  near(impact.hammerFaceY, geometry.anvilTopY, 1e-12,
    'impact contact');
  near(impact.velocity, 0, 1e-12, 'impact stop');
  assert.match(impact.regime, /impact-stopped/i);
  disposeModel(model.root);
});

test('movement 472 valve admission alternates reservoir pressure and exact cutoff expansion above and below piston A', () => {
  const { model } = movementModel();
  const { geometry, pneumaticStateAtHammerPhase } = model.root.userData;
  const atmosphere = geometry.atmosphericPressurePascal;
  const reservoir = geometry.reservoirAbsolutePressurePascal;
  const lowerAdmission = pneumaticStateAtHammerPhase(0.25);
  const lowerExpansion = pneumaticStateAtHammerPhase(0.49);
  const upperAdmission = pneumaticStateAtHammerPhase(0.75);
  const upperExpansion = pneumaticStateAtHammerPhase(0.99);

  near(lowerAdmission.lowerPressurePascal, reservoir, 1e-9,
    'lower chamber supplied from reservoir');
  near(lowerAdmission.upperPressurePascal, atmosphere, 1e-9,
    'upper chamber exhausted on lift');
  assert.ok(lowerAdmission.pneumaticForceNewton > 0);
  assert.match(lowerAdmission.lowerChamberMode, /reservoir-supply/i);
  assert.ok(lowerExpansion.lowerPressurePascal < reservoir);
  assert.ok(lowerExpansion.lowerPressurePascal > atmosphere);
  near(lowerExpansion.lowerPressurePascal
    * lowerExpansion.lowerChamberVolume ** geometry.polytropicExponent,
  geometry.lowerExpansionConstant, 3e-11,
  'lower post-cutoff P-V invariant');
  near(lowerExpansion.lowerExpansionResidual, 0, 3e-11,
    'lower post-cutoff residual');

  near(upperAdmission.upperPressurePascal, reservoir, 1e-9,
    'upper chamber supplied from reservoir');
  near(upperAdmission.lowerPressurePascal, atmosphere, 1e-9,
    'lower chamber exhausted on downstroke');
  assert.ok(upperAdmission.pneumaticForceNewton < 0);
  assert.match(upperAdmission.upperChamberMode, /reservoir-supply/i);
  assert.ok(upperExpansion.upperPressurePascal < reservoir);
  assert.ok(upperExpansion.upperPressurePascal > atmosphere);
  near(upperExpansion.upperPressurePascal
    * upperExpansion.upperChamberVolume ** geometry.polytropicExponent,
  geometry.upperExpansionConstant, 3e-11,
  'upper post-cutoff P-V invariant');
  near(upperExpansion.upperExpansionResidual, 0, 3e-11,
    'upper post-cutoff residual');

  for (let index = 0; index <= 400; index += 1) {
    const state = pneumaticStateAtHammerPhase(index / 400);
    near(state.lowerChamberHeight + geometry.hammerPistonThickness
      + state.upperChamberHeight,
    geometry.hammerCylinderInnerTopY
      - geometry.hammerCylinderInnerBottomY,
    2e-12, `hammer-cylinder partition at ${index}`);
    assert.ok(state.lowerChamberHeight > 0);
    assert.ok(state.upperChamberHeight > 0);
  }
  disposeModel(model.root);
});

test('movement 472 playback opens with piston A raised as Brown draws it and the impact half a hammer cycle later', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  model.update(0);
  near(stateAtTime(0).hammer.lift, geometry.hammerStroke, 1e-12,
    'top of stroke at t=0');
  near(blocks.hammerAssembly.position.y,
    geometry.hammerPistonBottomCenterY + geometry.hammerStroke, 1e-12,
    'rendered piston raised at t=0');
  const impact = stateAtTime(geometry.hammerCycleDuration
    - geometry.sourcePoseTimeOffset);
  assert.equal(impact.hammer.impactContact, true);
  near(impact.hammer.hammerFaceY, geometry.anvilTopY, 1e-12, 'impact face');
  disposeModel(model.root);
});

test('movement 472 complete system repeats after two shaft turns and three hammer cycles', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const fullRepeat = 2 * geometry.driveCycleDuration;

  for (const offset of [0, 0.13, 0.51, 1.07, 1.81]) {
    const first = stateAtTime(offset);
    const repeated = stateAtTime(offset + fullRepeat);
    near(repeated.pump.pistonCenterY, first.pump.pistonCenterY,
      2e-12, `pump repeat at ${offset}`);
    near(repeated.hammer.lift, first.hammer.lift,
      2e-12, `hammer repeat at ${offset}`);
    near(repeated.valve.sliderPin.x, first.valve.sliderPin.x,
      2e-12, `valve repeat at ${offset}`);
    near(repeated.friction.diskAngle - first.friction.diskAngle,
      3 * FULL_TURN_FOR_TEST(), 2e-12,
      `three valve-disk turns at ${offset}`);
    near(repeated.friction.wheelAngle - first.friction.wheelAngle,
      2 * FULL_TURN_FOR_TEST(), 2e-12,
      `two shaft turns at ${offset}`);
  }
  disposeModel(model.root);
});

test('movement 472 renderer maps both crank linkages, independent pistons, chambers, valve, and friction speeds', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.31, 0.79, 1.24, 1.91, 2.67, 3.58]) {
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.driveAssembly.rotation.x, state.pump.driveAngle,
      1e-12, `shaft angle at ${time}`);
    near(blocks.frictionWheelAssembly.rotation.x,
      state.friction.wheelAngle, 1e-12,
      `friction-wheel angle at ${time}`);
    near(blocks.frictionDiskAssembly.rotation.y,
      state.friction.diskAngle, 1e-12,
      `friction-disk angle at ${time}`);
    near(blocks.pumpPistonAssembly.position.y,
      state.pump.pistonCenterY, 1e-12,
      `pump piston at ${time}`);
    near(blocks.pumpConnectingRod.scale.y,
      geometry.pumpConnectingRodLength, 3e-12,
      `pump rod length at ${time}`);
    vectorNear(blocks.slideValve.position, state.valve.sliderPin,
      1e-12, `slide valve at ${time}`);
    near(blocks.valveConnectingRod.scale.y,
      geometry.valveConnectingRodLength, 3e-12,
      `valve rod length at ${time}`);
    near(blocks.hammerAssembly.position.y,
      state.hammer.pistonCenterY, 1e-12,
      `hammer piston at ${time}`);
    near(blocks.lowerHammerAir.scale.y,
      state.pneumatic.lowerChamberHeight, 1e-12,
      `lower hammer chamber at ${time}`);
    near(blocks.upperHammerAir.scale.y,
      state.pneumatic.upperChamberHeight, 1e-12,
      `upper hammer chamber at ${time}`);
    near(blocks.pumpLowerAir.scale.y,
      state.pump.lowerChamberHeight, 1e-12,
      `lower pump chamber at ${time}`);
    near(blocks.pumpUpperAir.scale.y,
      state.pump.upperChamberHeight, 1e-12,
      `upper pump chamber at ${time}`);
    for (const checkValve of blocks.pumpCheckValves) {
      const expectedScale = state.pump[checkValve.userData.stateKey]
        ? 1.28
        : 0.82;
      near(checkValve.scale.x, expectedScale, 1e-12,
        `${checkValve.userData.role} at ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 472 non-impact hammer transitions are C2 and the impact velocity reset is explicit', () => {
  const { model } = movementModel();
  const { geometry, hammerKinematicsAtPhase } = model.root.userData;
  const step = 1e-6;
  const top = hammerKinematicsAtPhase(0.5);
  const beforeTop = hammerKinematicsAtPhase(0.5 - step);
  const afterTop = hammerKinematicsAtPhase(0.5 + step);

  near(beforeTop.lift, top.lift, 1e-8, 'left top position');
  near(afterTop.lift, top.lift, 1e-8, 'right top position');
  near(beforeTop.velocity, top.velocity, 1e-7, 'left top velocity');
  near(afterTop.velocity, top.velocity, 1e-7, 'right top velocity');
  near(beforeTop.acceleration, top.acceleration, 0.0003,
    'left top acceleration');
  near(afterTop.acceleration, top.acceleration, 0.0002,
    'right top acceleration');

  const preImpact = hammerKinematicsAtPhase(1 - step);
  const impact = hammerKinematicsAtPhase(0);
  const postImpact = hammerKinematicsAtPhase(step);
  near(preImpact.lift, impact.lift, 9e-6,
    'impact position from downstroke');
  near(postImpact.lift, impact.lift, 9e-6,
    'impact position into lift');
  assert.ok(Math.abs(preImpact.velocity - impact.velocity)
    > geometry.impactSpeedVisualUnitsPerSecond * 0.99);
  near(postImpact.velocity, impact.velocity, 1e-7,
    'new lift begins from rest');
  disposeModel(model.root);
});

test('movement 472 has finite fitted render bounds and movement 507 remains the next authored frontier', () => {
  const movement472 = catalog.movements[471];
  const movement507 = catalog.movements[506];
  const model472 = createMovementModel(movement472);
  const model507 = createMovementModel(movement507);
  const fitBounds = model472.root.userData.cameraFitBounds;
  const duration = 2 * model472.root.userData.geometry.driveCycleDuration;

  for (let index = 0; index <= 16; index += 1) {
    model472.update(duration * index / 16);
    model472.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model472.root);
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
  assert.equal(movement472.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model472.root);
  disposeModel(model507.root);
});

test('movement 472 disk M is driven at right angles by the leather-faced wheel on shaft E', () => {
  const model = createMovementModel(catalog.movements[471]);
  const { geometry } = model.root.userData;
  let tyre = null;
  model.root.traverse((o) => { if (o.userData.role === 'leather-face-of-friction-wheel-N-bearing-on-disk-M') tyre = o; });
  assert.ok(tyre, 'leather face on the friction wheel');
  assert.equal(tyre.parent.userData.role, 'sliding-leather-faced-friction-wheel-N');
  tyre.geometry.computeBoundingBox();
  const size = tyre.geometry.boundingBox.getSize(new THREE.Vector3());
  near(size.x / 2, geometry.frictionWheelRadius, 2e-3, 'tyre radius is the rolling radius');
  disposeModel(model.root);
});
