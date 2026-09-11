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
  'single-lift-water-sealed-gasometer-with-open-bottom-bell-twin-bottom-gas-pipes-and-two-equal-counterweight-rope-pulley-constraints';

function movementModel() {
  const movement = catalog.movements[478];
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

test('movement 479 is one water-sealed bell A in tank B with two pipes and two counterweights C,C', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 479);
  assert.equal(movement.number, '479');
  assert.equal(movement.category, 'Hydraulics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.match(model.root.userData.mechanism,
    /one closed-top, open-bottom bell immersed in fixed water tank B/i);
  assert.match(model.root.userData.mechanism,
    /left of two separate bottom pipes.*raises A/s);
  assert.match(model.root.userData.mechanism,
    /Two independent, taut ropes.*equal counterweights C,C/s);
  assert.equal(degreesOfFreedom.independentOperatingCoordinates, 1);
  assert.equal(degreesOfFreedom.bellVerticalTranslation, 1);
  assert.equal(degreesOfFreedom.counterweightTranslationsSlavedByRopes, 2);
  assert.equal(degreesOfFreedom.pulleyRotationsSlavedByNoSlip, 2);
  assert.equal(blocks.counterweights.length, geometry.counterweightCount);
  assert.equal(blocks.gasPipes.length, 2);
  assert.equal(blocks.pulleys.length, 2);
  assert.equal(blocks.innerRopeSegments.length, 2);
  assert.equal(blocks.outerRopeSegments.length, 2);
  assert.equal(blocks.ropeArcs.length, 2);
  assert.equal(blocks.inletMarkers.length, geometry.markersPerPath);
  assert.equal(blocks.outletMarkers.length, geometry.markersPerPath);
  assert.equal(blocks.bellA.parent, model.root);
  assert.equal(blocks.tankB.parent, model.root);
  assert.equal(blocks.gasDome.parent, blocks.bellA);
  for (const lug of blocks.bellRopeLugs) {
    assert.equal(lug.parent, blocks.bellA);
  }

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'one-open-bottomed-inverted-vessel-A-rising-in-water-tank',
    'submerged-open-lower-rim-maintaining-water-seal',
    'fixed-water-seal-tank-B',
    'fixed-left-gas-inlet-through-bottom-of-B',
    'fixed-right-gas-outlet-through-bottom-of-B',
    'counterweight-C-1',
    'counterweight-C-2',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 479 preserves Brown’s unavailable-animation source record and engraved construction', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate479;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_479.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /open-bottomed vessel, A/);
  assert.match(movement.description, /tank, B, of water/);
  assert.match(movement.description, /one and leaves it by the other.*two pipes/s);
  assert.match(movement.description, /adding to or reducing the weights, C, C/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateBellCrownPixels, [258, 79]);
  assert.deepEqual(plate.approximateExternalWaterLevelPixels, [261, 309]);
  assert.deepEqual(plate.approximateLeftCounterweightPixels, [92, 220]);
  assert.deepEqual(plate.approximateRightCounterweightPixels, [421, 220]);
  assert.deepEqual(plate.approximateLeftPipeTopPixels, [233, 302]);
  assert.deepEqual(plate.approximateRightPipeTopPixels, [275, 301]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence,
    /single domed bell.*two separate bottom pipes.*mirror-image vertical ropes/s);
  assert.match(evidence.historicalCorroboration,
    /inverted vessel in a water cistern.*counterpoise.*water-level difference/s);
  assert.match(evidence.reconstructionDisclosure,
    /dimensions, masses, pressure, gas state.*independently engineered/s);
  assert.match(sourceReference.accumTreatiseUrl, /^https:/);
  assert.match(sourceReference.measurementCanadaBellPressureUrl,
    /measurement-canada/);
  disposeModel(model.root);
});

test('movement 479 has a smooth periodic lift with exact velocity and opposite counterweight travel', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.61, 1.75, 3.23, 4, 5.4, 7.1, 8]) {
    const state = stateAtTime(time);
    const phase = THREE.MathUtils.euclideanModulo(
      time,
      geometry.cycleDuration,
    ) / geometry.cycleDuration;
    const angle = 2 * Math.PI * phase;
    const expectedFraction = (1 - Math.cos(angle)) / 2;
    const expectedRate = Math.PI / geometry.cycleDuration
      * Math.sin(angle);
    near(state.phase, phase, 0, `phase at ${time}`);
    near(state.fillFraction, expectedFraction, 1e-16,
      `fill fraction at ${time}`);
    near(state.fillFractionRatePerSecond, expectedRate, 1e-16,
      `fill rate at ${time}`);
    near(state.bellLiftMetre,
      geometry.physicalStrokeMetre * expectedFraction,
      1e-16, `bell lift at ${time}`);
    near(state.bellVelocityMetrePerSecond,
      geometry.physicalStrokeMetre * expectedRate,
      1e-16, `bell velocity at ${time}`);
    near(state.counterweightY,
      geometry.baseCounterweightY - state.bellLiftSceneUnit,
      0, `counterweight position at ${time}`);
    near(state.pulleyAngularDisplacementRadian,
      state.bellLiftSceneUnit / geometry.pulleyRadiusSceneUnit,
      0, `pulley angle at ${time}`);
  }
  const low = stateAtTime(0);
  const high = stateAtTime(geometry.cycleDuration / 2);
  near(low.bellVelocityMetrePerSecond, 0, 0, 'low reversal velocity');
  near(high.bellVelocityMetrePerSecond, 0, 5e-17,
    'high reversal velocity');
  near(high.bellLiftMetre, geometry.physicalStrokeMetre, 0,
    'full physical stroke');
  disposeModel(model.root);
});

test('movement 479 pressure follows residual bell weight and produces the exact water head', () => {
  const { model } = movementModel();
  const { dynamics, geometry, thermodynamics } = model.root.userData;
  const supportedCounterweightMass = geometry.counterweightCount
    * geometry.counterweightMassKilogram;
  const expectedResidualMass = geometry.bellMassKilogram
    - supportedCounterweightMass;
  const expectedPressure = expectedResidualMass
    * geometry.gravityMetrePerSecondSquared
    / geometry.bellAreaSquareMetre;

  near(geometry.residualSupportedMassKilogram, expectedResidualMass, 0,
    'residual supported mass');
  near(geometry.gasGaugePressurePascal, expectedPressure, 0,
    'gauge pressure');
  near(geometry.gasGaugePressurePascal * geometry.bellAreaSquareMetre
      + supportedCounterweightMass
        * geometry.gravityMetrePerSecondSquared,
    geometry.bellMassKilogram * geometry.gravityMetrePerSecondSquared,
    2e-13, 'vertical force balance');
  near(geometry.gasAbsolutePressurePascal,
    geometry.atmosphericPressurePascal + expectedPressure,
    0, 'absolute pressure');
  near(geometry.waterLevelDifferenceMetre,
    expectedPressure / (geometry.waterDensityKilogramPerCubicMetre
      * geometry.gravityMetrePerSecondSquared),
    0, 'hydrostatic head');
  near(geometry.externalWaterSurfaceY - geometry.internalWaterSurfaceY,
    geometry.waterLevelDifferenceMetre * geometry.sceneUnitsPerMetre,
    5e-17, 'rendered water-level difference');
  near(geometry.pressureChangePerAddedKilogramEachCounterweightPascal,
    -geometry.counterweightCount * geometry.gravityMetrePerSecondSquared
      / geometry.bellAreaSquareMetre,
    0, 'equal counterweight pressure adjustment');
  assert.ok(geometry.pressureChangePerAddedKilogramEachCounterweightPascal
    < 0);
  assert.match(dynamics.pressureRegulation,
    /Adding equal mass.*reduces delivered pressure/);
  assert.match(thermodynamics.pressureHeadEquation,
    /Delta_h=p_gauge\/\(rho_water\*g\)/);
  disposeModel(model.root);
});

test('movement 479 keeps the open bell rim submerged for the entire lift', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 1200; sample += 1) {
    const state = stateAtTime(
      geometry.cycleDuration * sample / 1200,
    );
    const rimY = geometry.bellMinimumY + state.bellLiftSceneUnit
      + geometry.bellLocalRimY;
    assert.ok(rimY < geometry.internalWaterSurfaceY,
      `water seal opened at sample ${sample}`);
  }
  near(geometry.highestBellRimY,
    geometry.bellMinimumY + geometry.bellStrokeSceneUnit
      + geometry.bellLocalRimY,
    0, 'highest bell rim');
  near(geometry.minimumInternalSealDepthMetre,
    (geometry.internalWaterSurfaceY - geometry.highestBellRimY)
      / geometry.sceneUnitsPerMetre,
    0, 'minimum immersed depth');
  assert.ok(geometry.minimumInternalSealDepthMetre > 0);
  assert.match(model.root.userData.dynamics.waterSeal,
    /highest open rim remains below that inner surface/);
  disposeModel(model.root);
});

test('movement 479 gas inventory and directional pipe flows obey constant-pressure volume balance', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, thermodynamics } = model.root.userData;

  for (const time of [0, 0.7, 2, 3.6, 4, 5.1, 6, 7.4]) {
    const state = stateAtTime(time);
    const expectedVolume = geometry.minimumGasVolumeCubicMetre
      + geometry.bellAreaSquareMetre * state.bellLiftMetre;
    const expectedFlow = geometry.bellAreaSquareMetre
      * state.bellVelocityMetrePerSecond;
    const expectedMoles = geometry.gasAbsolutePressurePascal
      * expectedVolume
      / (geometry.universalGasConstantJoulePerMoleKelvin
        * geometry.gasTemperatureKelvin);
    near(state.gasVolumeCubicMetre, expectedVolume, 0,
      `gas volume at ${time}`);
    near(state.netGasVolumeFlowCubicMetrePerSecond, expectedFlow, 0,
      `net volume flow at ${time}`);
    near(state.gasMoles, expectedMoles, 3e-14,
      `gas inventory at ${time}`);
    near(state.netMolarFlowMolePerSecond,
      geometry.gasAbsolutePressurePascal * expectedFlow
        / (geometry.universalGasConstantJoulePerMoleKelvin
          * geometry.gasTemperatureKelvin),
      2e-15, `molar flow at ${time}`);
    near(state.inletGasVolumeFlowCubicMetrePerSecond,
      Math.max(0, expectedFlow), 0, `inlet split at ${time}`);
    near(state.outletGasVolumeFlowCubicMetrePerSecond,
      Math.max(0, -expectedFlow), 0, `outlet split at ${time}`);
  }
  near(geometry.maximumGasVolumeCubicMetre,
    geometry.minimumGasVolumeCubicMetre
      + geometry.bellAreaSquareMetre * geometry.physicalStrokeMetre,
    0, 'maximum gas volume');
  near(stateAtTime(2).netGasVolumeFlowCubicMetrePerSecond,
    geometry.maximumVolumeFlowCubicMetrePerSecond,
    1e-16, 'maximum inlet flow');
  near(stateAtTime(6).netGasVolumeFlowCubicMetrePerSecond,
    -geometry.maximumVolumeFlowCubicMetrePerSecond,
    1e-16, 'maximum outlet flow');
  assert.equal(stateAtTime(2).rising, true);
  assert.equal(stateAtTime(2).falling, false);
  assert.equal(stateAtTime(6).rising, false);
  assert.equal(stateAtTime(6).falling, true);
  assert.match(thermodynamics.constantPressureInventoryEquation,
    /V=V_min\+A_bell\*y.*n=p_abs\*V\/\(R\*T\)/);
  disposeModel(model.root);
});

test('movement 479 ropes remain taut and exact while equal pulleys turn in opposite senses without slip', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime, transmission } =
    model.root.userData;

  assert.equal(blocks.pulleys[0].userData.faceIndicators.length, 2);
  assert.equal(blocks.pulleys[1].userData.faceIndicators.length, 2);
  near(blocks.pulleys[0].userData.radius,
    geometry.pulleyRadiusSceneUnit, 0, 'left pulley radius');
  near(blocks.pulleys[1].userData.radius,
    geometry.pulleyRadiusSceneUnit, 0, 'right pulley radius');
  for (const time of [0, 0.83, 2, 3.41, 4, 5.35, 7.27]) {
    const state = stateAtTime(time);
    const bellAttachmentY = geometry.bellMinimumY
      + state.bellLiftSceneUnit + geometry.bellLocalRopeAttachmentY;
    const weightTopY = state.counterweightY
      + geometry.counterweightTopOffsetY;
    for (let index = 0; index < 2; index += 1) {
      const center = geometry.pulleyCenters[index];
      const ropeLength = center.y - bellAttachmentY
        + Math.PI * geometry.pulleyRadiusSceneUnit
        + center.y - weightTopY;
      near(ropeLength, geometry.constantRopeLengthSceneUnit, 9e-16,
        `constant rope ${index + 1} at ${time}`);
    }
    model.update(time);
    near(blocks.pulleys[0].userData.rotor.rotation.z,
      state.pulleyAngularDisplacementRadian, 0,
      `left no-slip angle at ${time}`);
    near(blocks.pulleys[1].userData.rotor.rotation.z,
      -state.pulleyAngularDisplacementRadian, 0,
      `right no-slip angle at ${time}`);
  }
  assert.match(transmission.counterweightEquation, /y_C=y_C0-y_A/);
  assert.match(transmission.leftPulleyEquation, /theta_left=\+y_A\/r_pulley/);
  assert.match(transmission.rightPulleyEquation, /theta_right=-y_A\/r_pulley/);
  disposeModel(model.root);
});

test('movement 479 renderer binds bell, gas volume, counterweights, and all four vertical rope legs to state', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const tankPosition = blocks.tankB.position.clone();
  const externalWaterPosition = blocks.outerAnnularWater.position.clone();
  const internalWaterPosition = blocks.innerWater.position.clone();

  for (const time of [0, 1.17, 2.65, 4, 5.77, 7.3]) {
    const state = stateAtTime(time);
    model.update(time);
    const bellY = geometry.bellMinimumY + state.bellLiftSceneUnit;
    const gasTopY = bellY + geometry.bellLocalShoulderY;
    const gasHeight = gasTopY - geometry.internalWaterSurfaceY;
    near(blocks.bellA.position.y, bellY, 0,
      `rendered bell at ${time}`);
    near(blocks.gasCylinder.position.y,
      (gasTopY + geometry.internalWaterSurfaceY) / 2,
      0, `gas midpoint at ${time}`);
    near(blocks.gasCylinder.scale.y, gasHeight, 0,
      `gas height at ${time}`);
    for (let index = 0; index < 2; index += 1) {
      const center = geometry.pulleyCenters[index];
      const side = index === 0 ? -1 : 1;
      const attachmentY = bellY + geometry.bellLocalRopeAttachmentY;
      const weightTopY = state.counterweightY
        + geometry.counterweightTopOffsetY;
      near(blocks.counterweights[index].position.y,
        state.counterweightY, 0,
        `rendered counterweight ${index + 1} at ${time}`);
      vectorNear(blocks.innerRopeSegments[index].position,
        new THREE.Vector3(
          center.x - side * geometry.pulleyRadiusSceneUnit,
          (center.y + attachmentY) / 2,
          0,
        ), 0, `inner rope midpoint ${index + 1} at ${time}`);
      near(blocks.innerRopeSegments[index].scale.y,
        center.y - attachmentY, 0,
        `inner rope length ${index + 1} at ${time}`);
      vectorNear(blocks.outerRopeSegments[index].position,
        new THREE.Vector3(
          center.x + side * geometry.pulleyRadiusSceneUnit,
          (center.y + weightTopY) / 2,
          0,
        ), 0, `outer rope midpoint ${index + 1} at ${time}`);
      near(blocks.outerRopeSegments[index].scale.y,
        center.y - weightTopY, 0,
        `outer rope length ${index + 1} at ${time}`);
    }
  }
  vectorNear(blocks.tankB.position, tankPosition, 0, 'tank B fixed');
  vectorNear(blocks.outerAnnularWater.position,
    externalWaterPosition, 0, 'external water fixed');
  vectorNear(blocks.innerWater.position,
    internalWaterPosition, 0, 'internal pressure surface fixed');
  disposeModel(model.root);
});

test('movement 479 volume-integrated markers use arc length and appear only on the active pipe', () => {
  const { model } = movementModel();
  const { blocks, dynamics, flowPaths, geometry, stateAtTime } =
    model.root.userData;

  assert.ok(flowPaths.inletFlowCurve.getPoint(0).y
    < flowPaths.inletFlowCurve.getPoint(1).y);
  assert.ok(flowPaths.outletFlowCurve.getPoint(0).y
    > flowPaths.outletFlowCurve.getPoint(1).y);
  for (const [time, activeMarkers, inactiveMarkers, curve, turns] of [
    [2, blocks.inletMarkers, blocks.outletMarkers,
      flowPaths.inletFlowCurve, stateAtTime(2).inletMarkerTravelTurns],
    [6, blocks.outletMarkers, blocks.inletMarkers,
      flowPaths.outletFlowCurve, stateAtTime(6).outletMarkerTravelTurns],
  ]) {
    model.update(time);
    for (let index = 0; index < geometry.markersPerPath; index += 1) {
      const progress = flowPaths.markerProgress(turns, index);
      vectorNear(activeMarkers[index].position,
        curve.getPointAt(progress), 2e-15,
        `active arc-length marker ${index} at ${time}`);
      near(inactiveMarkers[index].scale.length(), 0, 0,
        `inactive marker ${index} at ${time}`);
    }
    assert.ok(activeMarkers.some((marker) => marker.scale.x > 0.2));
  }
  for (let sample = 0; sample < 400; sample += 1) {
    const rising = stateAtTime(4 * sample / 400);
    near(rising.inletMarkerTravelTurns,
      2 * rising.fillFraction, 0,
      `inlet integrated travel at sample ${sample}`);
    const falling = stateAtTime(4 + 4 * sample / 400);
    near(falling.outletMarkerTravelTurns,
      2 * (1 - falling.fillFraction), 0,
      `outlet integrated travel at sample ${sample}`);
  }
  near(stateAtTime(4).inletMarkerTravelTurns, 2, 0,
    'inlet completes two passes at the upper reversal');
  near(stateAtTime(8).outletMarkerTravelTurns, 0, 0,
    'outlet wraps from two passes to the same path position');
  model.update(4);
  for (const marker of [...blocks.inletMarkers, ...blocks.outletMarkers]) {
    near(marker.scale.length(), 0, 0, 'marker hidden at reversal');
  }
  assert.match(dynamics.markerContinuity,
    /integrated admitted or withdrawn gas volume.*getPointAt.*fades/s);
  disposeModel(model.root);
});

test('movement 479 closes smoothly, fits every rendered pose, and leaves movement 507 as the boat-detaching-hook authored frontier', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const end = stateAtTime(geometry.cycleDuration);
  for (const key of [
    'bellLiftMetre',
    'bellLiftSceneUnit',
    'bellVelocityMetrePerSecond',
    'counterweightY',
    'fillFraction',
    'gasMoles',
    'gasVolumeCubicMetre',
    'netGasVolumeFlowCubicMetrePerSecond',
    'pulleyAngularDisplacementRadian',
  ]) near(end[key], start[key], 0, `cycle closure ${key}`);

  const union = new THREE.Box3();
  for (let sample = 0; sample <= 160; sample += 1) {
    model.update(geometry.cycleDuration * sample / 160);
    union.union(new THREE.Box3().setFromObject(model.root));
  }
  assert.ok(model.root.userData.cameraFitBounds.containsBox(union));
  assert.ok(model.root.userData.cameraDistanceScale >= 1);
  assert.ok(model.root.userData.groundFloorY <= union.min.y);

  const next = catalog.movements[506];
  assert.equal(next.id, 507);
  assert.equal(next.number, '507');
  assert.equal(next.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(next.fidelity, 'authored');
  disposeModel(model.root);
});
