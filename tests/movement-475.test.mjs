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
  'brear-bilge-ejector-with-side-steam-pipe-upward-coaxial-nozzle-bulb-mixing-chamber-bottom-suction-and-top-discharge';

function movementModel() {
  const movement = catalog.movements[474];
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

test('movement 475 is one stationary A-D-B-C Brear bilge ejector with two fluid populations', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 475);
  assert.equal(movement.number, '475');
  assert.equal(movement.category, 'Pumps & pneumatics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.match(model.root.userData.mechanism,
    /Fixed side pipe A enters chamber D.*upward nozzle coaxial with discharge C/s);
  assert.match(model.root.userData.mechanism,
    /Bilge water consequently rises through B.*leaves continuously through C/s);
  assert.match(model.root.userData.mechanism,
    /only the two fluid marker populations advance in the offline model, and the presented water level rises/);
  assert.equal(degreesOfFreedom.mechanicalMovingParts, 0);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 0);
  assert.equal(degreesOfFreedom.prescribedAdvectiveFlowPhases, 2);
  assert.equal(blocks.waterStreams.length, geometry.waterPathCount);
  assert.equal(blocks.steamMarkers.length, geometry.steamMarkerCount);
  assert.equal(blocks.waterMarkers.length,
    geometry.waterPathCount * geometry.waterMarkersPerPath);

  // The bilge well and the flow notation (streamlines, steam core and jet,
  // markers) are not presented; the water fills B, D and C instead.
  for (const removed of [blocks.bilgeBasin, blocks.bilgeWater,
    blocks.steamJet, blocks.steamPipeCore, ...blocks.waterStreams,
    ...blocks.steamMarkers, ...blocks.waterMarkers]) {
    assert.ok(removed.parent === null, `source presentation removes ${removed.userData.role}`);
  }
  for (const block of [
    blocks.chamber, blocks.dischargeCollar, blocks.dischargePipe,
    blocks.nozzle, blocks.steamPipe, blocks.suctionCollar, blocks.suctionPipe,
    ...blocks.waterFill]) assert.ok(block.parent === model.root, `${block.userData.role} parent`);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'stationary-cutaway-mixing-chamber-D',
    'stationary-suction-pipe-B-rising-from-bilge',
    'stationary-vertical-discharge-pipe-C',
    'stationary-steam-pipe-A-turning-upward-inside-D',
    'upward-steam-nozzle-A-coaxial-with-discharge-C',
    'water-filling-mixing-chamber-D',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 475 preserves Brown’s labeled section and does not invent missing Brear patent particulars', () => {
  const { model, movement } = movementModel();
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate475;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_475.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /D is a chamber/);
  assert.match(movement.description, /suction-pipe, B, and discharge-pipe, C/);
  assert.match(movement.description, /steam-pipe entering at one side/);
  assert.match(movement.description, /produces a vacuum in B/);
  assert.match(movement.description, /regular and constant stream/);
  assert.match(movement.description, /Compressed air may be used/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateNozzleTipPixels, [248, 221]);
  assert.deepEqual(plate.approximateSteamAEntryPixels, [405, 302]);
  assert.deepEqual(plate.approximateSuctionBCenterPixels, [253, 452]);
  assert.deepEqual(plate.approximateDischargeCCenterPixels, [260, 73]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence,
    /bulb-shaped chamber D.*lower B and upper C.*side pipe A/s);
  assert.match(evidence.patentIdentityDisclosure,
    /no patent number.*No unsupported patent identifier/);
  assert.match(evidence.reconstructionDisclosure,
    /All SI pressures.*independently engineered and exposed/);
  assert.match(dynamics.operatingSequence,
    /first purges air.*after priming.*regular mixed discharge/s);
  assert.match(dynamics.assumptionScope,
    /specified mixing-chamber pressure.*does not integrate startup air evacuation/s);
  assert.match(sourceReference.workshopReceiptsUrl,
    /upload\.wikimedia\.org/);
  disposeModel(model.root);
});

test('movement 475 A bends to an upward nozzle exactly coaxial with B and C while all water paths bypass it', () => {
  const { model } = movementModel();
  const { flowPaths, geometry, motion } = model.root.userData;
  const pipeStart = flowPaths.steamPipeCurve.getPoint(0);
  const pipeEnd = flowPaths.steamPipeCurve.getPoint(1);

  near(pipeStart.y, 0.05, 0, 'side A inlet height');
  assert.ok(pipeStart.x > 3);
  vectorNear(pipeEnd, geometry.nozzleTip, 1e-12,
    'A pipe terminates at nozzle tip');
  near(geometry.nozzleTip.x, 0, 0, 'nozzle on C axis x');
  near(geometry.nozzleTip.z, 0, 0, 'nozzle on C axis z');
  vectorNear(motion.steamDirectionAtNozzle,
    new THREE.Vector3(0, 1, 0), 0, 'upward steam direction');
  vectorNear(motion.waterDirectionInSuction,
    new THREE.Vector3(0, 1, 0), 0, 'upward suction direction');
  vectorNear(motion.dischargeDirection,
    new THREE.Vector3(0, 1, 0), 0, 'upward discharge direction');

  assert.equal(flowPaths.waterCurves.length, geometry.waterPathCount);
  for (const curve of flowPaths.waterCurves) {
    assert.ok(curve.getPoint(0).y < -2.9);
    assert.ok(curve.getPoint(1).y > 3.4);
    for (let sample = 1; sample <= 200; sample += 1) {
      const before = curve.getPointAt((sample - 1) / 200);
      const after = curve.getPointAt(sample / 200);
      assert.ok(after.y >= before.y - 1e-9,
        `water reverses at sample ${sample}`);
      if (after.y > 0.45 && after.y < 0.91) {
        assert.ok(Math.hypot(after.x, after.z) > 0.33,
          `water intersects nozzle at sample ${sample}`);
      }
    }
  }
  disposeModel(model.root);
});

test('movement 475 specified vacuum head produces its water suction speed and leaves positive lift margin', () => {
  const { model } = movementModel();
  const { geometry, transmission } = model.root.userData;
  const expectedMaximumLift = (
    geometry.atmosphericPressurePascal
      - geometry.mixingChamberPressurePascal
  ) / (geometry.waterDensityKilogramPerCubicMetre
    * geometry.gravityMetrePerSecondSquared);
  const expectedMargin = expectedMaximumLift - geometry.bilgeLiftMetre;
  const expectedSpeed = geometry.waterSuctionDischargeCoefficient
    * Math.sqrt(2 * geometry.gravityMetrePerSecondSquared * expectedMargin);
  const expectedArea = Math.PI * geometry.suctionPipeRadiusMetre ** 2;
  const expectedMassFlow = geometry.waterDensityKilogramPerCubicMetre
    * expectedArea * expectedSpeed;

  assert.ok(geometry.mixingChamberPressurePascal
    < geometry.atmosphericPressurePascal);
  near(geometry.maximumStaticSuctionLiftMetre, expectedMaximumLift, 0,
    'maximum static lift');
  near(geometry.suctionHeadMarginMetre, expectedMargin, 0,
    'positive suction margin');
  assert.ok(geometry.suctionHeadMarginMetre > 0);
  near(geometry.waterSuctionSpeedMetrePerSecond, expectedSpeed, 0,
    'Bernoulli suction speed');
  near(geometry.suctionPipeAreaSquareMetre, expectedArea, 0,
    'suction area');
  near(geometry.waterMassFlowKilogramPerSecond, expectedMassFlow, 0,
    'water mass flow');
  near(geometry.waterVolumetricFlowCubicMetrePerSecond,
    expectedMassFlow / geometry.waterDensityKilogramPerCubicMetre,
    0, 'water volumetric flow');
  assert.match(transmission.suctionEquation, /p_atm-p_mix/);
  disposeModel(model.root);
});

test('movement 475 steam nozzle is choked and its primary mass flow follows the disclosed sonic-throat equation', () => {
  const { model } = movementModel();
  const { geometry, thermodynamics } = model.root.userData;
  const gamma = geometry.steamHeatCapacityRatio;
  const criticalRatio = (2 / (gamma + 1)) ** (gamma / (gamma - 1));
  const factor = Math.sqrt(gamma) * (2 / (gamma + 1)) ** (
    (gamma + 1) / (2 * (gamma - 1))
  );
  const area = Math.PI * geometry.steamNozzleThroatRadiusMetre ** 2;
  const massFlow = geometry.steamDischargeCoefficient * area
    * geometry.steamSupplyPressurePascal
    / Math.sqrt(
      geometry.steamSpecificGasConstant
        * geometry.steamSupplyTemperatureKelvin,
    ) * factor;
  const exitTemperature = geometry.steamSupplyTemperatureKelvin
    * geometry.mixingPressureRatio ** ((gamma - 1) / gamma);
  const exitSpeed = Math.sqrt(
    2 * geometry.steamSpecificHeatAtConstantPressure
      * (geometry.steamSupplyTemperatureKelvin - exitTemperature),
  );

  near(geometry.criticalPressureRatio, criticalRatio, 0,
    'critical ratio');
  assert.ok(geometry.mixingPressureRatio < criticalRatio);
  assert.equal(thermodynamics.primaryNozzleChoked, true);
  near(geometry.chokedMassFluxFactor, factor, 0,
    'choked mass flux factor');
  near(geometry.steamNozzleAreaSquareMetre, area, 0,
    'steam throat area');
  near(geometry.steamMassFlowKilogramPerSecond, massFlow, 0,
    'choked steam mass flow');
  near(geometry.steamExitTemperatureKelvin, exitTemperature, 0,
    'isentropic jet temperature');
  near(geometry.steamJetSpeedMetrePerSecond, exitSpeed, 0,
    'isentropic jet speed');
  assert.match(thermodynamics.steamMassFlowEquation,
    /Cd\*A\*p0\/sqrt\(R\*T0\)/);
  disposeModel(model.root);
});

test('movement 475 mixed discharge exactly conserves modeled mass, volume, and axial momentum', () => {
  const { model } = movementModel();
  const { geometry, transmission } = model.root.userData;
  const expectedSteamDensity = geometry.mixingChamberPressurePascal
    / (geometry.steamSpecificGasConstant
      * geometry.steamExitTemperatureKelvin);
  const expectedTotalMass = geometry.steamMassFlowKilogramPerSecond
    + geometry.waterMassFlowKilogramPerSecond;
  const expectedMomentum = geometry.steamMassFlowKilogramPerSecond
    * geometry.steamJetSpeedMetrePerSecond
    + geometry.waterMassFlowKilogramPerSecond
      * geometry.waterSuctionSpeedMetrePerSecond;
  const expectedMixedSpeed = expectedMomentum / expectedTotalMass;
  const expectedVolume = geometry.waterVolumetricFlowCubicMetrePerSecond
    + geometry.steamMassFlowKilogramPerSecond / expectedSteamDensity;
  const expectedDischargeArea = expectedVolume / expectedMixedSpeed;

  near(geometry.steamDensityAtMixingPlane, expectedSteamDensity, 0,
    'steam mixing density');
  near(geometry.totalMassFlowKilogramPerSecond, expectedTotalMass, 0,
    'total mass flow');
  near(geometry.inletAxialMomentumNewton, expectedMomentum, 0,
    'inlet axial momentum');
  near(geometry.mixedStreamSpeedMetrePerSecond, expectedMixedSpeed, 0,
    'momentum-derived mixed speed');
  near(geometry.mixedVolumetricFlowCubicMetrePerSecond,
    expectedVolume, 0, 'combined volume flow');
  near(geometry.derivedDischargeAreaSquareMetre,
    expectedDischargeArea, 0, 'continuity-derived discharge area');
  near(geometry.derivedDischargeRadiusMetre,
    Math.sqrt(expectedDischargeArea / Math.PI), 0,
    'derived discharge radius');
  near(geometry.outletAxialMomentumNewton,
    geometry.inletAxialMomentumNewton, 9e-16,
    'one-dimensional momentum conservation');
  near(geometry.entrainmentMassRatio,
    geometry.waterMassFlowKilogramPerSecond
      / geometry.steamMassFlowKilogramPerSecond,
    0, 'entrainment mass ratio');
  assert.match(transmission.momentumEquation,
    /m_s\*v_s\+m_w\*v_w/);
  assert.match(transmission.continuityEquation, /A_C=/);
  disposeModel(model.root);
});

test('movement 475 running state is steady and closes exactly without pretending fluid phase is a mechanism DOF', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const source = stateAtTime(0);

  for (const time of [-9.1, -1.4, 0, 0.7, 2.2, 3.9, 8.0, 12.7]) {
    const state = stateAtTime(time);
    near(state.steamMassFlowKilogramPerSecond,
      source.steamMassFlowKilogramPerSecond, 0, 'steady steam flow');
    near(state.waterMassFlowKilogramPerSecond,
      source.waterMassFlowKilogramPerSecond, 0, 'steady water flow');
    near(state.totalMassFlowKilogramPerSecond,
      source.totalMassFlowKilogramPerSecond, 0, 'steady total flow');
    near(state.mixingChamberPressurePascal,
      source.mixingChamberPressurePascal, 0, 'steady suction pressure');
    near(state.inletAxialMomentumNewton,
      state.outletAxialMomentumNewton, 9e-16, 'steady momentum');
    assert.ok(state.phase >= 0 && state.phase < 1);
  }
  const closure = stateAtTime(geometry.cycleDuration);
  near(closure.phase, source.phase, 0, 'phase closure');
  near(closure.cycleTime, source.cycleTime, 0, 'time closure');
  disposeModel(model.root);
});

test('movement 475 renderer holds every solid fixed and advances steam and water markers by arc length with invisible recycling', () => {
  const { model } = movementModel();
  const { blocks, flowPaths, geometry } = model.root.userData;
  const solids = [blocks.bilgeBasin, blocks.chamber,
    blocks.dischargeCollar, blocks.dischargePipe, blocks.nozzle,
    blocks.steamJet, blocks.steamPipe, blocks.suctionCollar,
    blocks.suctionPipe, ...blocks.waterStreams];
  const transforms = solids.map((solid) => ({
    position: solid.position.clone(),
    quaternion: solid.quaternion.clone(),
  }));

  for (const phase of [0, 0.08, 0.19, 0.34, 0.51, 0.72, 0.94]) {
    model.update(phase * geometry.cycleDuration);
    solids.forEach((solid, index) => {
      vectorNear(solid.position, transforms[index].position, 0,
        'stationary ejector position');
      near(solid.quaternion.angleTo(transforms[index].quaternion),
        0, 5e-8, 'stationary ejector orientation');
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
    'steam marker arc-length coordinate');
  vectorNear(blocks.waterMarkers[0].position,
    flowPaths.waterCurves[0].getPointAt(waterProgress), 0,
    'water marker arc-length coordinate');
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

// Pass 54: with the flow notation not presented, the water itself shows the
// process. The design changed (a start, run and stop loop of the water
// level), so this checks the level follows the state through B, D and C.
test('movement 475 water level rises through B, D and C, holds while running and falls back', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const [inD, inB, inC] = blocks.waterFill;
  const at = (phase) => {
    model.update(phase * geometry.cycleDuration);
    return stateAtTime(phase * geometry.cycleDuration);
  };
  let state = at(0.04);
  assert.equal(state.stage, 'purging-air-from-D-and-C');
  near(state.waterLevelY, -2.91, 1e-12, 'water at the bilge during purge');
  // Empty, the columns collapse to flat rings at their feet (no pop on
  // filling) rather than switching off.
  near(inB.scale.y, 1e-4, 1e-12, 'B empty during purge');
  near(inC.scale.y, 1e-4, 1e-12, 'C empty during purge');
  inD.geometry.computeBoundingBox();
  near(inD.geometry.boundingBox.max.y - inD.geometry.boundingBox.min.y, 0, 1e-6, 'D empty during purge');
  assert.equal(blocks.dischargeJet.visible, false, 'no discharge before the water reaches C');
  let previous = -Infinity;
  for (const phase of [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4]) {
    state = at(phase);
    assert.ok(state.waterLevelY > previous, 'level rises while priming');
    near(blocks.waterSurface.position.y, state.waterLevelY, 1e-12, 'free surface');
    previous = state.waterLevelY;
  }
  state = at(0.6);
  assert.equal(state.stage, 'running-discharging-through-C');
  near(state.waterLevelY, 3.40, 1e-12, 'full to the mouth of C');
  assert.ok(inB.visible && inD.visible && inC.visible);
  near(inB.scale.y, -1.16 + 2.91, 1e-12, 'B full');
  near(inC.scale.y, 3.40 - 1.56, 1e-12, 'C full');
  assert.equal(blocks.dischargeJet.visible, true, 'the discharge issues from the mouth of C');
  assert.ok(blocks.dischargeJet.scale.y > 0.5);
  state = at(0.92);
  assert.equal(state.steamSupplyOpen, false);
  assert.equal(blocks.dischargeJet.visible, false, 'the discharge stops at shut-off');
  assert.ok(state.waterLevelY < 3.40 && state.waterLevelY > -2.91, 'falling back');
  near(stateAtTime(geometry.cycleDuration).waterLevelY, stateAtTime(0).waterLevelY, 1e-12, 'loop closes');
  disposeModel(model.root);
});

test('movement 475 has finite fitted bounds and movement 507 remains the distinct authored frontier', () => {
  const movement475 = catalog.movements[474];
  const movement507 = catalog.movements[506];
  const model475 = createMovementModel(movement475);
  const model507 = createMovementModel(movement507);
  const fitBounds = model475.root.userData.cameraFitBounds;

  for (let index = 0; index <= 16; index += 1) {
    model475.update(index / 16
      * model475.root.userData.geometry.cycleDuration);
    model475.root.updateMatrixWorld(true);
    const renderedBounds = new THREE.Box3().setFromObject(model475.root);
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
  assert.equal(movement475.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model475.root);
  disposeModel(model507.root);
});
