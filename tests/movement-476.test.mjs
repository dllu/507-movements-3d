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
  'lansdell-steam-siphon-pump-with-unobstructed-central-jet-at-y-fork-twin-suction-branches-and-single-unbroken-upper-discharge';

function movementModel() {
  const movement = catalog.movements[475];
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

test('movement 476 is one stationary Lansdell Y-fork with two B suctions, central A jet, and single C discharge', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 476);
  assert.equal(movement.number, '476');
  assert.equal(movement.category, 'Pumps & pneumatics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.match(model.root.userData.mechanism,
    /two separate lower suction pipes B.*symmetric Y.*one upper discharge C/s);
  assert.match(model.root.userData.mechanism,
    /Jet pipe A descends outside the right branch.*ends on the C centerline/s);
  assert.match(model.root.userData.mechanism,
    /There are no mechanical moving parts/);
  assert.equal(geometry.suctionBranchCount, 2);
  assert.equal(geometry.waterPathsPerBranch, 2);
  assert.equal(blocks.suctionBranches.length, 2);
  assert.equal(blocks.branchCollars.length, 2);
  assert.equal(blocks.waterStreams.length, 4);
  assert.equal(blocks.steamMarkers.length, geometry.steamMarkerCount);
  assert.equal(blocks.waterMarkers.length,
    geometry.suctionBranchCount * geometry.waterPathsPerBranch
      * geometry.waterMarkersPerPath);
  assert.equal(degreesOfFreedom.mechanicalMovingParts, 0);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 0);
  assert.equal(degreesOfFreedom.prescribedAdvectiveFlowPhases, 2);
  for (const block of [blocks.basin, blocks.basinWater,
    ...blocks.branchCollars, blocks.dischargeCollar,
    blocks.dischargePipe, blocks.steamCore, blocks.steamJet,
    blocks.steamPipe, ...blocks.suctionBranches,
    ...blocks.waterStreams, ...blocks.steamMarkers,
    ...blocks.waterMarkers]) assert.equal(block.parent, model.root);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'stationary-suction-pipe-B-1-of-two-to-fork',
    'stationary-suction-pipe-B-2-of-two-to-fork',
    'stationary-single-discharge-pipe-C-above-fork',
    'stationary-jet-pipe-A-entering-behind-right-B-at-fork',
    'upward-steam-jet-on-centerline-of-C',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 476 preserves Brown’s unobstructed unbroken-current construction and cautiously identifies Lansdell', () => {
  const { model, movement } = movementModel();
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate476;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_476.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /A is the jet-pipe/);
  assert.match(movement.description, /B, B, are two suction-pipes/);
  assert.match(movement.description, /forked connection.*discharge-pipe, C/);
  assert.match(movement.description, /offers no obstacle/);
  assert.match(movement.description, /unbroken current/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateJetNozzlePixels, [255, 231]);
  assert.deepEqual(plate.approximateLeftBPipeCenterPixels, [139, 406]);
  assert.deepEqual(plate.approximateRightBPipeCenterPixels, [355, 406]);
  assert.deepEqual(plate.approximateYForkCenterPixels, [258, 289]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence,
    /two widely separated vertical B legs.*one narrow C neck/s);
  assert.match(evidence.historicalCorroboration,
    /Paris in 1867.*H\. S\. Lansdell superintendent/s);
  assert.match(evidence.patentIdentityDisclosure,
    /no patent number.*company superintendent.*No patent identifier/s);
  assert.match(dynamics.unbrokenCurrent,
    /one continuous spline.*no marker teleports/);
  assert.match(dynamics.assumptionScope,
    /specifies the fork pressure.*not integrated/s);
  assert.match(sourceReference.paris1867CatalogueUrl,
    /upload\.wikimedia\.org/);
  disposeModel(model.root);
});

test('movement 476 two B shells are exact mirrors and meet C at one common fork', () => {
  const { model } = movementModel();
  const { flowPaths, geometry } = model.root.userData;
  const [left, right] = flowPaths.branchShellCurves;

  assert.equal(flowPaths.branchShellCurves.length, 2);
  assert.equal(left.points.length, right.points.length);
  for (let index = 0; index < left.points.length; index += 1) {
    near(left.points[index].x, -right.points[index].x, 0,
      `mirrored x at station ${index}`);
    near(left.points[index].y, right.points[index].y, 0,
      `common y at station ${index}`);
    near(left.points[index].z, right.points[index].z, 0,
      `common z at station ${index}`);
  }
  vectorNear(left.points.at(-1), geometry.forkCenter, 0,
    'left B reaches fork');
  vectorNear(right.points.at(-1), geometry.forkCenter, 0,
    'right B reaches fork');
  near(left.getLength(), right.getLength(), 3e-15,
    'equal branch centerline lengths');
  near(geometry.forkCenter.x, 0, 0, 'fork on C axis x');
  near(geometry.forkCenter.z, 0, 0, 'fork on C axis z');
  disposeModel(model.root);
});

test('movement 476 A reaches an upward central nozzle while four complete water paths clear it and never reverse', () => {
  const { model } = movementModel();
  const { flowPaths, geometry, motion } = model.root.userData;
  const pipeStart = flowPaths.steamPipeCurve.getPoint(0);
  const pipeEnd = flowPaths.steamPipeCurve.getPoint(1);

  assert.ok(pipeStart.x > 2);
  assert.ok(pipeStart.z > 0,
    'A approaches behind the engraving plane');
  vectorNear(pipeEnd, geometry.nozzleTip, 3e-16,
    'A terminates at nozzle');
  near(geometry.nozzleTip.x, 0, 0, 'nozzle on C axis x');
  near(geometry.nozzleTip.z, 0, 0, 'nozzle on C axis z');
  vectorNear(motion.steamDirectionAtNozzle,
    new THREE.Vector3(0, 1, 0), 0, 'upward jet');
  vectorNear(motion.dischargeDirection,
    new THREE.Vector3(0, 1, 0), 0, 'upward C flow');
  assert.equal(flowPaths.waterCurves.length, 4);

  for (const curve of flowPaths.waterCurves) {
    assert.ok(curve.getPoint(0).y < -2.7);
    assert.ok(curve.getPoint(1).y > 3.4);
    for (let sample = 1; sample <= 300; sample += 1) {
      const before = curve.getPointAt((sample - 1) / 300);
      const after = curve.getPointAt(sample / 300);
      assert.ok(after.y >= before.y - 1e-9,
        `water reverses at sample ${sample}`);
      if (after.y > 0.72 && after.y < 1.12) {
        assert.ok(Math.hypot(after.x, after.z) > 0.34,
          `water intersects A nozzle at sample ${sample}`);
      }
    }
  }
  disposeModel(model.root);
});

test('movement 476 specified fork vacuum drives two exactly equal suction flows below maximum lift', () => {
  const { model } = movementModel();
  const { geometry, transmission } = model.root.userData;
  const maximumLift = (
    geometry.atmosphericPressurePascal - geometry.mixingPressurePascal
  ) / (geometry.waterDensityKilogramPerCubicMetre
    * geometry.gravityMetrePerSecondSquared);
  const margin = maximumLift - geometry.suctionLiftMetre;
  const speed = geometry.waterDischargeCoefficient * Math.sqrt(
    2 * geometry.gravityMetrePerSecondSquared * margin,
  );
  const area = Math.PI * geometry.suctionBranchRadiusMetre ** 2;
  const branchFlow = geometry.waterDensityKilogramPerCubicMetre
    * area * speed;

  assert.ok(geometry.mixingPressurePascal
    < geometry.atmosphericPressurePascal);
  near(geometry.maximumStaticLiftMetre, maximumLift, 0,
    'maximum lift');
  near(geometry.suctionHeadMarginMetre, margin, 0,
    'lift margin');
  assert.ok(margin > 0);
  near(geometry.waterSpeedPerBranchMetrePerSecond, speed, 0,
    'branch suction speed');
  near(geometry.suctionBranchAreaSquareMetre, area, 0,
    'branch area');
  near(geometry.waterMassFlowPerBranchKilogramPerSecond, branchFlow, 0,
    'single B flow');
  near(geometry.totalWaterMassFlowKilogramPerSecond,
    geometry.suctionBranchCount * branchFlow, 0,
    'two equal B flows');
  assert.match(transmission.equalBranchFlow, /2\*m_water_branch/);
  disposeModel(model.root);
});

test('movement 476 choked A flow and C mixing obey the disclosed steam, mass, volume, and momentum equations', () => {
  const { model } = movementModel();
  const { geometry, thermodynamics, transmission } = model.root.userData;
  const gamma = geometry.steamHeatCapacityRatio;
  const criticalRatio = (2 / (gamma + 1)) ** (gamma / (gamma - 1));
  const factor = Math.sqrt(gamma) * (2 / (gamma + 1)) ** (
    (gamma + 1) / (2 * (gamma - 1))
  );
  const steamArea = Math.PI * geometry.steamNozzleRadiusMetre ** 2;
  const steamFlow = geometry.steamDischargeCoefficient * steamArea
    * geometry.steamSupplyPressurePascal
    / Math.sqrt(
      geometry.steamSpecificGasConstant
        * geometry.steamSupplyTemperatureKelvin,
    ) * factor;
  const totalMass = steamFlow + geometry.totalWaterMassFlowKilogramPerSecond;
  const momentum = steamFlow * geometry.steamJetSpeedMetrePerSecond
    + geometry.totalWaterMassFlowKilogramPerSecond
      * geometry.waterSpeedPerBranchMetrePerSecond;
  const mixedSpeed = momentum / totalMass;
  const steamDensity = geometry.mixingPressurePascal
    / (geometry.steamSpecificGasConstant
      * geometry.steamExitTemperatureKelvin);
  const mixedVolume = steamFlow / steamDensity
    + geometry.totalWaterMassFlowKilogramPerSecond
      / geometry.waterDensityKilogramPerCubicMetre;

  near(geometry.criticalPressureRatio, criticalRatio, 0,
    'critical pressure ratio');
  assert.ok(geometry.mixingPressureRatio < criticalRatio);
  assert.equal(thermodynamics.primaryNozzleChoked, true);
  near(geometry.chokedFlowFactor, factor, 0, 'choked factor');
  near(geometry.steamNozzleAreaSquareMetre, steamArea, 0,
    'steam area');
  near(geometry.steamMassFlowKilogramPerSecond, steamFlow, 0,
    'steam mass flow');
  near(geometry.totalMassFlowKilogramPerSecond, totalMass, 0,
    'total mass flow');
  near(geometry.inletMomentumNewton, momentum, 0,
    'inlet momentum');
  near(geometry.mixedSpeedMetrePerSecond, mixedSpeed, 0,
    'mixed C speed');
  near(geometry.mixedVolumetricFlow, mixedVolume, 0,
    'mixed volume flow');
  near(geometry.derivedDischargeAreaSquareMetre,
    mixedVolume / mixedSpeed, 0, 'derived C area');
  near(geometry.outletMomentumNewton,
    geometry.inletMomentumNewton, 9e-16, 'momentum closure');
  assert.match(thermodynamics.steamMassFlowEquation, /sqrt\(gamma\)/);
  assert.match(transmission.momentumEquation,
    /m_water_total\*v_B/);
  disposeModel(model.root);
});

test('movement 476 renderer keeps every solid fixed and moves both fluids smoothly by arc length', () => {
  const { model } = movementModel();
  const { blocks, flowPaths, geometry } = model.root.userData;
  const solids = [blocks.basin, ...blocks.branchCollars,
    blocks.dischargeCollar, blocks.dischargePipe, blocks.steamJet,
    blocks.steamPipe, ...blocks.suctionBranches,
    ...blocks.waterStreams];
  const transforms = solids.map((solid) => ({
    position: solid.position.clone(),
    quaternion: solid.quaternion.clone(),
  }));

  for (const phase of [0, 0.11, 0.28, 0.46, 0.69, 0.91]) {
    model.update(phase * geometry.cycleDuration);
    solids.forEach((solid, index) => {
      vectorNear(solid.position, transforms[index].position, 0,
        'fixed solid position');
      near(solid.quaternion.angleTo(transforms[index].quaternion),
        0, 5e-8, 'fixed solid orientation');
    });
  }

  const phase = 0.137;
  model.update(phase * geometry.cycleDuration);
  const steamProgress = THREE.MathUtils.euclideanModulo(
    phase * geometry.steamMarkerPassesPerCycle,
    1,
  );
  const waterProgress = THREE.MathUtils.euclideanModulo(
    phase * geometry.waterMarkerPassesPerCycle,
    1,
  );
  vectorNear(blocks.steamMarkers[0].position,
    flowPaths.steamFlowCurve.getPointAt(steamProgress), 0,
    'A marker arc-length position');
  vectorNear(blocks.waterMarkers[0].position,
    flowPaths.waterCurves[0].getPointAt(waterProgress), 0,
    'B-C marker arc-length position');
  near(blocks.steamMarkers[0].scale.x,
    Math.sin(Math.PI * steamProgress) ** 0.55, 0,
    'steam fade');
  near(blocks.waterMarkers[0].scale.x,
    Math.sin(Math.PI * waterProgress) ** 0.55, 0,
    'water fade');
  model.update(0);
  near(blocks.steamMarkers[0].scale.x, 0, 0,
    'steam marker recycles invisibly');
  near(blocks.waterMarkers[0].scale.x, 0, 0,
    'water marker recycles invisibly');
  model.update(geometry.cycleDuration);
  near(blocks.steamMarkers[0].scale.x, 0, 0,
    'steam marker closes invisibly');
  near(blocks.waterMarkers[0].scale.x, 0, 0,
    'water marker closes invisibly');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.cycleDuration);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 476 steady state closes exactly and reports equal branch flow at every phase', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const source = stateAtTime(0);

  for (const time of [-7.3, -0.2, 0, 0.8, 2.7, 4.0, 9.1]) {
    const state = stateAtTime(time);
    near(state.waterMassFlowPerBranchKilogramPerSecond,
      source.waterMassFlowPerBranchKilogramPerSecond, 0,
      'steady branch flow');
    near(state.totalWaterMassFlowKilogramPerSecond,
      2 * state.waterMassFlowPerBranchKilogramPerSecond, 0,
      'equal two-branch sum');
    near(state.inletMomentumNewton, state.outletMomentumNewton,
      9e-16, 'steady momentum');
    assert.ok(state.phase >= 0 && state.phase < 1);
  }
  near(stateAtTime(geometry.cycleDuration).phase, source.phase, 0,
    'phase closure');
  disposeModel(model.root);
});

test('movement 476 has finite fitted bounds and movement 507 remains the distinct authored frontier', () => {
  const movement476 = catalog.movements[475];
  const movement507 = catalog.movements[506];
  const model476 = createMovementModel(movement476);
  const model507 = createMovementModel(movement507);
  const fitBounds = model476.root.userData.cameraFitBounds;

  for (let index = 0; index <= 16; index += 1) {
    model476.update(index / 16
      * model476.root.userData.geometry.cycleDuration);
    model476.root.updateMatrixWorld(true);
    const renderedBounds = new THREE.Box3().setFromObject(model476.root);
    for (const coordinate of [renderedBounds.min.x, renderedBounds.min.y,
      renderedBounds.min.z, renderedBounds.max.x, renderedBounds.max.y,
      renderedBounds.max.z]) assert.ok(Number.isFinite(coordinate));
    assert.ok(renderedBounds.min.x >= fitBounds.min.x - 1e-9);
    assert.ok(renderedBounds.min.y >= fitBounds.min.y - 1e-9);
    assert.ok(renderedBounds.min.z >= fitBounds.min.z - 1e-9);
    assert.ok(renderedBounds.max.x <= fitBounds.max.x + 1e-9);
    assert.ok(renderedBounds.max.y <= fitBounds.max.y + 1e-9);
    assert.ok(renderedBounds.max.z <= fitBounds.max.z + 1e-9);
  }
  assert.equal(movement476.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model476.root);
  disposeModel(model507.root);
});
