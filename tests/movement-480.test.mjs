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
  'center-guided-water-sealed-gasometer-with-open-bottom-bell-integral-sliding-sleeve-a-fixed-tube-b-and-opposed-bottom-gas-pipes';

function movementModel() {
  const movement = catalog.movements[479];
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

test('movement 480 is one open-bottom bell A whose integral tube a slides on fixed central tube b', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 480);
  assert.equal(movement.number, '480');
  assert.equal(movement.category, 'Hydraulics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.match(model.root.userData.mechanism,
    /open-bottom vessel A rises and falls in water tank B/i);
  assert.match(model.root.userData.mechanism,
    /central tube a is permanently secured within A.*slides coaxially.*fixed tube b/s);
  assert.match(model.root.userData.mechanism,
    /without the ropes, pulleys, or counterweights used in Movement 479/);
  assert.equal(degreesOfFreedom.independentOperatingCoordinates, 1);
  assert.equal(degreesOfFreedom.bellAndIntegralTubeVerticalTranslation, 1);
  assert.equal(degreesOfFreedom.lateralTranslationsConstrainedByGuide, 2);
  assert.equal(degreesOfFreedom.movingTubeSeparateMotionRelativeToBell, 0);
  assert.equal(blocks.bellA.parent, model.root);
  assert.equal(blocks.movingTubeA.parent, blocks.bellA);
  assert.equal(blocks.fixedTubeB.parent, model.root);
  assert.equal(blocks.gasDome.parent, blocks.bellA);
  assert.equal(blocks.gasPipes.length, 2);
  assert.equal(blocks.inletMarkers.length, geometry.markersPerPath);
  assert.equal(blocks.outletMarkers.length, geometry.markersPerPath);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.some((role) => /counterweight|pulley|rope/i.test(role)),
    false);
  for (const role of [
    'one-open-bottomed-vessel-A-constrained-by-central-telescoping-guide',
    'central-tube-a-permanently-secured-within-vessel-A',
    'sliding-outer-shell-of-integral-tube-a-around-b',
    'fixed-central-tube-b-guiding-integral-moving-sleeve-a',
    'fixed-hollow-shell-of-central-tube-b',
    'fixed-right-gas-inlet-through-bottom-of-B',
    'fixed-left-gas-outlet-through-bottom-of-B',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 480 records Brown’s unavailable animation, a-on-b guide, and engraved pipe directions', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate480;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_480.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(movement.description,
    '480. Another kind of gasometer. The vessel, A, has permanently secured within it a central tube, a, which slides on a fixed tube, b, in the center of the tank.');
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateBellCrownPixels, [261, 128]);
  assert.deepEqual(plate.approximateFixedTubeBPixels, [246, 213]);
  assert.deepEqual(plate.approximateMovingTubeAPixels, [276, 215]);
  assert.deepEqual(plate.approximateLeftOutletTopPixels, [191, 279]);
  assert.deepEqual(plate.approximateRightInletTopPixels, [319, 279]);
  assert.deepEqual(plate.approximateWaterLevelPixels, [263, 283]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence,
    /one domed open-bottom bell A.*moving sleeve a.*fixed central tube b/s);
  assert.match(evidence.engravingEvidence,
    /no external counterweight gear.*right-side admission.*left-side withdrawal/s);
  assert.match(evidence.reconstructionDisclosure,
    /absence of counterweights.*source-grounded/);
  assert.match(sourceReference.publicDomainBookScanUrl,
    /upload\.wikimedia\.org/);
  disposeModel(model.root);
});

test('movement 480 prescribed filling gives smooth exact lift, velocity, and reversal states', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.73, 1.9, 3.4, 4, 5.2, 7.33, 8]) {
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
    near(state.bellY,
      geometry.bellMinimumY + state.bellLiftSceneUnit,
      0, `bell scene position at ${time}`);
  }
  near(stateAtTime(0).bellVelocityMetrePerSecond, 0, 0,
    'lower reversal velocity');
  near(stateAtTime(4).bellVelocityMetrePerSecond, 0, 4e-17,
    'upper reversal velocity');
  near(stateAtTime(4).bellLiftMetre, geometry.physicalStrokeMetre, 0,
    'full stroke');
  disposeModel(model.root);
});

test('movement 480 integral sleeve a remains coaxial, positively clear, and fully overlapped with b', () => {
  const { model } = movementModel();
  const { blocks, dynamics, geometry, stateAtTime, transmission } =
    model.root.userData;

  near(geometry.guideRadialClearanceMetre,
    geometry.movingTubeInnerRadiusMetre
      - geometry.fixedTubeOuterRadiusMetre,
    0, 'radial guide clearance');
  assert.ok(geometry.guideRadialClearanceMetre > 0);
  near(geometry.movingTubeLengthSceneUnit,
    geometry.movingTubeLocalTopY - geometry.movingTubeLocalBottomY,
    0, 'moving sleeve length');
  const fixedPosition = blocks.fixedTubeB.position.clone();
  for (let sample = 0; sample <= 800; sample += 1) {
    const time = geometry.cycleDuration * sample / 800;
    const state = stateAtTime(time);
    near(state.movingTubeBottomY,
      state.bellY + geometry.movingTubeLocalBottomY,
      0, `sleeve bottom at sample ${sample}`);
    near(state.movingTubeTopY,
      state.bellY + geometry.movingTubeLocalTopY,
      0, `sleeve top at sample ${sample}`);
    near(state.guideOverlapSceneUnit,
      geometry.movingTubeLengthSceneUnit,
      5e-16, `full guide overlap at sample ${sample}`);
    assert.ok(state.movingTubeBottomY > geometry.fixedTubeBottomY);
    assert.ok(state.movingTubeTopY < geometry.fixedTubeTopY);
  }
  for (const time of [0, 2, 4, 6]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    const sleeveWorld = blocks.movingTubeA.getWorldPosition(
      new THREE.Vector3(),
    );
    vectorNear(sleeveWorld, new THREE.Vector3(0, state.bellY, 0),
      0, `sleeve follows A at ${time}`);
    vectorNear(blocks.fixedTubeB.position, fixedPosition, 0,
      `b remains fixed at ${time}`);
  }
  assert.match(dynamics.guideConstraint,
    /rigid child of vessel A.*coaxial with fixed tube b.*clearance is positive/s);
  assert.match(transmission.guideEquation,
    /x_a=x_b=0.*y_a=y_A.*clearance=.*>0/s);
  disposeModel(model.root);
});

test('movement 480 unsupported bell weight establishes pressure and a sealed hydrostatic head', () => {
  const { model } = movementModel();
  const { dynamics, geometry, thermodynamics } = model.root.userData;
  const expectedPressure = geometry.bellMassKilogram
    * geometry.gravityMetrePerSecondSquared
    / geometry.bellAreaSquareMetre;

  near(geometry.gasGaugePressurePascal, expectedPressure, 0,
    'bell-weight gauge pressure');
  near(geometry.gasGaugePressurePascal * geometry.bellAreaSquareMetre,
    geometry.bellMassKilogram * geometry.gravityMetrePerSecondSquared,
    0, 'vertical force balance');
  near(geometry.gasAbsolutePressurePascal,
    geometry.atmosphericPressurePascal + expectedPressure,
    0, 'absolute gas pressure');
  near(geometry.waterLevelDifferenceMetre,
    expectedPressure / (geometry.waterDensityKilogramPerCubicMetre
      * geometry.gravityMetrePerSecondSquared),
    0, 'water pressure head');
  near(geometry.externalWaterSurfaceY - geometry.internalWaterSurfaceY,
    geometry.waterLevelDifferenceMetre * geometry.sceneUnitsPerMetre,
    8e-17, 'rendered water depression');
  for (let sample = 0; sample <= 800; sample += 1) {
    const state = model.root.userData.stateAtTime(
      geometry.cycleDuration * sample / 800,
    );
    const rimY = state.bellY + geometry.bellLocalRimY;
    assert.ok(rimY < geometry.internalWaterSurfaceY,
      `water seal opened at sample ${sample}`);
  }
  near(geometry.minimumInternalSealDepthMetre,
    (geometry.internalWaterSurfaceY - geometry.highestBellRimY)
      / geometry.sceneUnitsPerMetre,
    0, 'minimum seal depth');
  assert.ok(geometry.minimumInternalSealDepthMetre > 0);
  assert.match(dynamics.pressureBalance,
    /no counterweights shown.*p_gauge\*A_bell=m_bell\*g/);
  assert.match(thermodynamics.pressureHeadEquation,
    /Delta_h=p_gauge\/\(rho_water\*g\)/);
  disposeModel(model.root);
});

test('movement 480 gas inventory and right-inlet left-outlet flows obey exact volume balance', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime, thermodynamics } =
    model.root.userData;

  for (const time of [0, 0.8, 2, 3.5, 4, 4.8, 6, 7.2]) {
    const state = stateAtTime(time);
    const expectedVolume = geometry.minimumGasVolumeCubicMetre
      + geometry.bellAreaSquareMetre * state.bellLiftMetre;
    const expectedFlow = geometry.bellAreaSquareMetre
      * state.bellVelocityMetrePerSecond;
    near(state.gasVolumeCubicMetre, expectedVolume, 0,
      `gas volume at ${time}`);
    near(state.netGasVolumeFlowCubicMetrePerSecond, expectedFlow, 0,
      `net gas flow at ${time}`);
    near(state.inletGasVolumeFlowCubicMetrePerSecond,
      Math.max(0, expectedFlow), 0, `right inlet at ${time}`);
    near(state.outletGasVolumeFlowCubicMetrePerSecond,
      Math.max(0, -expectedFlow), 0, `left outlet at ${time}`);
    near(state.gasMoles,
      geometry.gasAbsolutePressurePascal * expectedVolume
        / (geometry.universalGasConstantJoulePerMoleKelvin
          * geometry.gasTemperatureKelvin),
      3e-14, `gas moles at ${time}`);
  }
  near(geometry.maximumGasVolumeCubicMetre,
    geometry.minimumGasVolumeCubicMetre
      + geometry.bellAreaSquareMetre * geometry.physicalStrokeMetre,
    0, 'maximum gas volume');
  near(stateAtTime(2).netGasVolumeFlowCubicMetrePerSecond,
    geometry.maximumVolumeFlowCubicMetrePerSecond,
    5e-17, 'maximum admission');
  near(stateAtTime(6).netGasVolumeFlowCubicMetrePerSecond,
    -geometry.maximumVolumeFlowCubicMetrePerSecond,
    5e-17, 'maximum withdrawal');
  assert.equal(stateAtTime(2).rising, true);
  assert.equal(stateAtTime(6).falling, true);
  assert.match(dynamics.gasInventory,
    /right pipe raises A.*left pipe lowers it/);
  assert.match(thermodynamics.constantPressureInventoryEquation,
    /V=V_min\+A_bell\*y.*n=p_abs\*V\/\(R\*T\)/);
  disposeModel(model.root);
});

test('movement 480 renderer moves only A and a while gas height follows the fixed inner water surface', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const fixedTubePosition = blocks.fixedTubeB.position.clone();
  const tankPosition = blocks.tankB.position.clone();
  const innerWaterPosition = blocks.innerAnnularWater.position.clone();
  const outerWaterPosition = blocks.outerAnnularWater.position.clone();
  const movingShellLocal = blocks.movingTubeShell.position.clone();

  near(blocks.gasAnnulus.rotation.x, 0, 0,
    'dynamic annulus orientation baked into geometry');
  for (const time of [0, 1.13, 2.6, 4, 5.9, 7.3]) {
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.bellA.position.y, state.bellY, 0,
      `bell renderer at ${time}`);
    vectorNear(blocks.movingTubeShell.position, movingShellLocal, 0,
      `tube a remains rigid in A at ${time}`);
    const gasTopY = state.bellY + geometry.bellLocalShoulderY;
    const gasHeight = gasTopY - geometry.internalWaterSurfaceY;
    near(blocks.gasAnnulus.position.y,
      (gasTopY + geometry.internalWaterSurfaceY) / 2,
      0, `gas midpoint at ${time}`);
    near(blocks.gasAnnulus.scale.y, gasHeight, 0,
      `gas height at ${time}`);
    vectorNear(blocks.fixedTubeB.position, fixedTubePosition, 0,
      `fixed tube b at ${time}`);
    vectorNear(blocks.tankB.position, tankPosition, 0,
      `tank B at ${time}`);
    vectorNear(blocks.innerAnnularWater.position, innerWaterPosition, 0,
      `inner water at ${time}`);
    vectorNear(blocks.outerAnnularWater.position, outerWaterPosition, 0,
      `outer water at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 480 markers traverse each complete pipe smoothly and only in its engraved direction', () => {
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
        `arc-length marker ${index} at ${time}`);
      near(inactiveMarkers[index].scale.length(), 0, 0,
        `inactive marker ${index} at ${time}`);
    }
    assert.ok(activeMarkers.some((marker) => marker.scale.x > 0.2));
  }
  for (let sample = 0; sample < 400; sample += 1) {
    const rising = stateAtTime(4 * sample / 400);
    near(rising.inletMarkerTravelTurns, 2 * rising.fillFraction, 0,
      `integrated right-inlet travel at sample ${sample}`);
    const falling = stateAtTime(4 + 4 * sample / 400);
    near(falling.outletMarkerTravelTurns,
      2 * (1 - falling.fillFraction), 0,
      `integrated left-outlet travel at sample ${sample}`);
  }
  model.update(4);
  for (const marker of [...blocks.inletMarkers, ...blocks.outletMarkers]) {
    near(marker.scale.length(), 0, 0, 'marker hidden at reversal');
  }
  assert.match(dynamics.markerContinuity,
    /integrated admitted or withdrawn volume.*getPointAt.*fade/s);
  disposeModel(model.root);
});

test('movement 480 closes exactly, fits every pose, and leaves spinning movement 507 as the authored frontier', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const end = stateAtTime(geometry.cycleDuration);
  for (const key of [
    'bellLiftMetre',
    'bellLiftSceneUnit',
    'bellVelocityMetrePerSecond',
    'bellY',
    'fillFraction',
    'gasMoles',
    'gasVolumeCubicMetre',
    'guideOverlapSceneUnit',
    'movingTubeBottomY',
    'movingTubeTopY',
    'netGasVolumeFlowCubicMetrePerSecond',
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
