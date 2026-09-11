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
  'hoard-wiggin-direct-acting-sealed-liquid-diaphragm-steam-trap-with-bridge-reacted-lift-annular-inlet-seat-and-bottom-condensate-outlet';

function movementModel() {
  const movement = catalog.movements[476];
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

test('movement 477 is one direct-acting D capsule between fixed inlet A, seat a,a, bridge, and outlet B', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 477);
  assert.equal(movement.number, '477');
  assert.equal(movement.category, 'Miscellaneous mechanisms');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.match(model.root.userData.mechanism,
    /fixed box connects upper inlet A to lower outlet B/);
  assert.match(model.root.userData.mechanism,
    /One hollow, hermetically sealed valve D slides vertically/);
  assert.match(model.root.userData.mechanism,
    /flexible bottom diaphragm resting on a fixed bridge/);
  assert.equal(degreesOfFreedom.mechanicalMovingAssemblies, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  vectorNear(degreesOfFreedom.valveDTranslationAxis,
    new THREE.Vector3(0, 1, 0), 0, 'D vertical axis');
  assert.equal(geometry.flowPathCount, 4);
  assert.equal(blocks.condensateStreams.length, geometry.flowPathCount);
  assert.equal(blocks.condensateMarkers.length,
    geometry.flowPathCount * geometry.markersPerPath);
  assert.equal(blocks.valveD.parent, model.root);
  assert.equal(blocks.fixedCase.parent, model.root);
  assert.equal(blocks.fixedBridge.parent, model.root);
  assert.equal(blocks.annularSeat.parent, model.root);
  for (const part of blocks.rigidValveParts) {
    assert.equal(part.parent, blocks.valveD);
  }
  assert.equal(blocks.flexibleDiaphragm.parent, blocks.valveD);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'fixed-top-inlet-A-from-steam-coil',
    'fixed-bottom-condensate-outlet-B',
    'fixed-annular-seat-a-a-at-inlet-A',
    'one-sliding-hermetically-sealed-hollow-valve-D',
    'flexible-bottom-diaphragm-of-valve-D-resting-on-bridge',
    'fixed-bridge-over-outlet-B-supporting-flexible-diaphragm',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 477 preserves Brown while distinguishing the later Hoard lever-valve patent', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference, thermodynamics } =
    model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate477;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_477.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Hoard & Wiggin’s patent/);
  assert.match(movement.description, /hollow valve, D/);
  assert.match(movement.description, /flexible diaphragm/);
  assert.match(movement.description, /raises valve up to the seat, a, a/);
  assert.match(movement.description, /allows valve to descend and let water off/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateInletACenterPixels, [279, 64]);
  assert.deepEqual(plate.approximateOutletBCenterPixels, [255, 462]);
  assert.deepEqual(plate.approximateSeatPairCenterPixels, [262, 219]);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence,
    /one centered moving capsule D.*rectangular fixed box/s);
  assert.match(evidence.historicalCorroboration,
    /July 24, 1858.*alcohol above mercury.*rubber diaphragm/s);
  assert.match(evidence.patentIdentityDisclosure,
    /US 21,472.*related improvement.*lever.*rotary valve/s);
  assert.match(evidence.patentIdentityDisclosure,
    /does not present US 21,472 as the patent drawing/);
  assert.match(sourceReference.relatedImprovementPatentUrl,
    /US21472A/);
  assert.match(sourceReference.scientificAmerican1858Url,
    /scientificamerican\.com/);
  assert.match(thermodynamics.sourceFluidDisclosure,
    /coefficient here is therefore labeled effective/);
  disposeModel(model.root);
});

test('movement 477 sealed-liquid expansion gives the exact unconstrained diaphragm lift', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, thermodynamics } = model.root.userData;

  for (const time of [0, 0.63, 1.37, 3, 4.71, 5.82]) {
    const state = stateAtTime(time);
    const phaseAngle = 2 * Math.PI * state.phase;
    const expectedTemperature = geometry.coolTemperatureKelvin
      + geometry.temperatureSwingKelvin
        * (1 - Math.cos(phaseAngle)) / 2;
    const expectedVolume = geometry.sealedLiquidReferenceVolumeCubicMetre
      * (1 + geometry.effectiveVolumetricExpansionPerKelvin
        * (expectedTemperature - geometry.coolTemperatureKelvin));
    const expectedUnconstrainedLift = (
      expectedVolume - geometry.sealedLiquidReferenceVolumeCubicMetre
    ) / geometry.effectiveDiaphragmAreaSquareMetre;
    near(state.temperatureKelvin, expectedTemperature, 2e-13,
      `temperature at ${time}`);
    near(state.liquidVolumeCubicMetre, expectedVolume, 2e-20,
      `sealed volume at ${time}`);
    near(state.unconstrainedDiaphragmLiftMetre,
      expectedUnconstrainedLift, 2e-17,
      `unconstrained lift at ${time}`);
  }
  const expectedMaximum =
    geometry.effectiveVolumetricExpansionPerKelvin
    * geometry.sealedLiquidReferenceVolumeCubicMetre
    * geometry.temperatureSwingKelvin
    / geometry.effectiveDiaphragmAreaSquareMetre;
  near(geometry.maximumUnconstrainedDiaphragmLiftMetre,
    expectedMaximum, 0, 'maximum unconstrained lift');
  assert.ok(expectedMaximum > geometry.physicalSeatClearanceMetre);
  assert.match(thermodynamics.effectiveLiquidExpansionEquation,
    /V\(T\)=V0.*unconstrainedLift/);
  disposeModel(model.root);
});

test('movement 477 enforces unilateral seat contact with no penetration', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime, transmission } =
    model.root.userData;

  for (let sample = 0; sample <= 1200; sample += 1) {
    const state = stateAtTime(
      geometry.cycleDuration * sample / 1200,
    );
    assert.ok(state.valveLiftMetre >= -1e-15);
    assert.ok(state.valveLiftMetre
      <= geometry.physicalSeatClearanceMetre + 1e-15);
    assert.ok(state.physicalSeatGapMetre >= -1e-15);
    assert.ok(state.seatContactForceNewton >= -1e-15);
    near(state.physicalSeatGapMetre * state.seatContactForceNewton,
      0, 2e-18, `contact complementarity at sample ${sample}`);
    if (state.seatContact) {
      near(state.valveLiftMetre, geometry.physicalSeatClearanceMetre,
        1e-15, `seated lift at sample ${sample}`);
      near(state.physicalSeatGapMetre, 0, 1e-15,
        `seated gap at sample ${sample}`);
    }
  }
  const hot = stateAtTime(geometry.cycleDuration / 2);
  assert.equal(hot.seatContact, true);
  assert.ok(hot.blockedExpansionMetre > 0);
  near(hot.seatContactForceNewton,
    geometry.contactStiffnessNewtonPerMetre * hot.blockedExpansionMetre,
    0, 'contact force');
  assert.match(dynamics.contactLaw, /min\(unconstrainedLift/);
  assert.match(transmission.seatComplementarity,
    /gap>=0.*contactForce>=0.*gap\*contactForce=0/);
  disposeModel(model.root);
});

test('movement 477 moves rigid D together while its diaphragm stays reacted on the fixed bridge', () => {
  const { model } = movementModel();
  const { blocks, geometry, motion, stateAtTime } = model.root.userData;
  const initialRigidPositions = blocks.rigidValveParts.map((part) =>
    part.position.clone());
  const bridgeInitialPosition = blocks.fixedBridge.position.clone();

  model.update(0);
  near(blocks.valveD.position.y, 0, 0, 'cool valve position');
  near(blocks.flexibleDiaphragm.scale.y, 1, 0,
    'cool diaphragm scale');
  model.update(geometry.cycleDuration / 2);
  const hot = stateAtTime(geometry.cycleDuration / 2);
  const displayedLift = hot.valveLiftMetre
    * geometry.liftDisplayScaleSceneUnitPerMetre;
  near(blocks.valveD.position.y, displayedLift, 0,
    'hot valve translation');
  near(blocks.flexibleDiaphragm.scale.y,
    (geometry.baselineDiaphragmDepthSceneUnit + displayedLift)
      / geometry.baselineDiaphragmDepthSceneUnit,
    0, 'hot diaphragm bow scale');
  near(geometry.shoulderContactLocalY + blocks.valveD.position.y,
    geometry.seatPlaneY, 2e-16, 'shoulder touches seat plane');
  near(
    blocks.valveD.position.y
      + blocks.flexibleDiaphragm.position.y
      - geometry.baselineDiaphragmDepthSceneUnit
        * blocks.flexibleDiaphragm.scale.y,
    motion.displayedDiaphragmApexY,
    2e-16,
    'diaphragm apex remains on bridge',
  );
  vectorNear(blocks.fixedBridge.position, bridgeInitialPosition, 0,
    'bridge remains fixed');
  blocks.rigidValveParts.forEach((part, index) => {
    vectorNear(part.position, initialRigidPositions[index], 0,
      `rigid local position ${index}`);
  });
  disposeModel(model.root);
});

test('movement 477 open annular gap discharges condensate by the disclosed hydraulic equation', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, transmission } = model.root.userData;

  for (const time of [0, 0.75, 1.5, 2.2, 3, 4.6, 5.25]) {
    const state = stateAtTime(time);
    const expectedArea = 2 * Math.PI
      * geometry.annularSeatRadiusMetre * state.physicalSeatGapMetre;
    const expectedFlow = geometry.dischargeCoefficient * expectedArea
      * Math.sqrt(
        2 * (geometry.inletPressurePascal
          - geometry.outletPressurePascal)
        / geometry.condensateDensityKilogramPerCubicMetre,
      );
    near(state.annularGapAreaSquareMetre, expectedArea, 2e-20,
      `annular area at ${time}`);
    near(state.condensateVolumeFlowCubicMetrePerSecond, expectedFlow,
      2e-19, `flow at ${time}`);
  }
  near(stateAtTime(0).condensateVolumeFlowCubicMetrePerSecond,
    geometry.maximumCondensateVolumeFlowCubicMetrePerSecond, 0,
    'maximum cool-state flow');
  near(stateAtTime(geometry.cycleDuration / 2)
    .condensateVolumeFlowCubicMetrePerSecond, 0, 0,
  'no discharge through closed seat');
  assert.match(transmission.annularDischargeEquation,
    /Q=Cd.*2\*pi\*r_seat\*gap.*sqrt/);
  disposeModel(model.root);
});

test('movement 477 analytic temperature and free-lift rates match finite differences away from contact', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const delta = 1e-5;

  for (const time of [0.55, 1.25, 4.75, 5.35]) {
    const before = stateAtTime(time - delta);
    const state = stateAtTime(time);
    const after = stateAtTime(time + delta);
    assert.equal(state.seatContact, false);
    near(state.temperatureRateKelvinPerSecond,
      (after.temperatureKelvin - before.temperatureKelvin) / (2 * delta),
      2e-8, `temperature rate at ${time}`);
    near(state.unconstrainedLiftRateMetrePerSecond,
      (after.unconstrainedDiaphragmLiftMetre
        - before.unconstrainedDiaphragmLiftMetre) / (2 * delta),
      4e-13, `free lift rate at ${time}`);
    near(state.valveLiftRateMetrePerSecond,
      state.unconstrainedLiftRateMetrePerSecond, 0,
      `admitted free lift rate at ${time}`);
  }
  const hot = stateAtTime(geometry.cycleDuration / 2);
  assert.equal(hot.seatContact, true);
  near(hot.valveLiftRateMetrePerSecond, 0, 0,
    'seat suppresses valve velocity');
  disposeModel(model.root);
});

test('movement 477 flow-integrated markers freeze through the closed interval and advance two turns per cycle', () => {
  const { model } = movementModel();
  const { dynamics, flowPaths, geometry, stateAtTime } =
    model.root.userData;
  let previousVolume = -Infinity;
  for (let sample = 0; sample <= 1200; sample += 1) {
    const time = geometry.cycleDuration * sample / 1200;
    const state = stateAtTime(time);
    assert.ok(state.cumulativeDischargeVolumeCubicMetre
      >= previousVolume - 2e-18,
    `cumulative flow reversed at sample ${sample}`);
    previousVolume = state.cumulativeDischargeVolumeCubicMetre;
  }
  near(stateAtTime(0).markerTravelTurns, 0, 0, 'cycle start');
  near(stateAtTime(geometry.cycleDuration).markerTravelTurns,
    geometry.markerPassesPerCycle, 1e-12, 'two turns per cycle');
  const closeEntry = stateAtTime(2.05);
  const hot = stateAtTime(3);
  const closeExit = stateAtTime(3.95);
  assert.equal(closeEntry.seatContact, true);
  assert.equal(closeExit.seatContact, true);
  near(closeEntry.cumulativeDischargeVolumeCubicMetre,
    hot.cumulativeDischargeVolumeCubicMetre, 2e-18,
    'marker freezes from closing to hot midpoint');
  near(hot.cumulativeDischargeVolumeCubicMetre,
    closeExit.cumulativeDischargeVolumeCubicMetre, 2e-18,
    'marker remains frozen until reopening');
  assert.equal(flowPaths.cumulativeDischargeVolumeTable.length,
    geometry.integrationSamples + 1);
  assert.match(dynamics.markerContinuity,
    /integral of discharged condensate volume.*getPointAt.*freezes/s);
  disposeModel(model.root);
});

test('movement 477 renderer maps exact lift, arc-length paths, flow visibility, and endpoint fades', () => {
  const { model } = movementModel();
  const { blocks, flowPaths, geometry, stateAtTime } = model.root.userData;
  const openTime = 0.83;
  model.update(openTime);
  const state = stateAtTime(openTime);
  near(blocks.valveD.position.y,
    state.valveLiftMetre * geometry.liftDisplayScaleSceneUnitPerMetre,
    0, 'rendered lift');
  for (let pathIndex = 0; pathIndex < geometry.flowPathCount;
    pathIndex += 1) {
    for (let markerIndex = 0; markerIndex < geometry.markersPerPath;
      markerIndex += 1) {
      const flatIndex = pathIndex * geometry.markersPerPath + markerIndex;
      const progress = flowPaths.markerProgressAtTime(
        openTime,
        markerIndex,
      );
      vectorNear(blocks.condensateMarkers[flatIndex].position,
        flowPaths.condensateFlowCurves[pathIndex].getPointAt(progress),
        2e-15, `marker ${flatIndex} arc-length point`);
      near(blocks.condensateMarkers[flatIndex].scale.x,
        Math.sin(Math.PI * progress) ** 0.55
          * Math.sqrt(state.flowFraction),
        2e-15, `marker ${flatIndex} visibility`);
    }
  }
  model.update(geometry.cycleDuration / 2);
  for (const marker of blocks.condensateMarkers) {
    near(marker.scale.length(), 0, 0, 'closed marker hidden');
  }
  for (const curve of flowPaths.condensateFlowCurves) {
    assert.ok(curve.getPointAt(0).y > 3.6);
    assert.ok(curve.getPointAt(1).y < -3.0);
    for (let sample = 1; sample <= 300; sample += 1) {
      assert.ok(curve.getPointAt(sample / 300).y
        <= curve.getPointAt((sample - 1) / 300).y + 1e-8,
      `A-to-B path reverses at sample ${sample}`);
    }
  }
  disposeModel(model.root);
});

test('movement 477 declared bounds contain the complete model and movement 507 remains the authored frontier', () => {
  const { model } = movementModel();
  const actualBounds = new THREE.Box3().setFromObject(model.root);
  const declaredBounds = model.root.userData.cameraFitBounds;
  assert.ok(declaredBounds.containsBox(actualBounds));
  assert.ok(model.root.userData.cameraDistanceScale >= 1);
  assert.ok(model.root.userData.groundFloorY <= actualBounds.min.y);

  const next = catalog.movements[506];
  assert.equal(next.id, 507);
  assert.equal(next.number, '507');
  assert.equal(next.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(next.fidelity, 'authored');
  disposeModel(model.root);
});
