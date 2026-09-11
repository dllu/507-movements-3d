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
  'ray-longitudinal-pipe-expansion-steam-trap-with-fixed-anchor-hollow-sphere-stuffing-box-plunger-weighted-elbow-lever-and-adjustable-stop';

function movementModel() {
  const movement = catalog.movements[477];
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

test('movement 478 is Ray’s single expansion pipe, sphere, opposed plunger, weighted lever, and b-c stop', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 478);
  assert.equal(movement.number, '478');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.match(model.root.userData.mechanism,
    /anchors one portion of horizontal waste-pipe A at fixed support B/);
  assert.match(model.root.userData.mechanism,
    /attached hollow sphere C.*ends open near its center/s);
  assert.match(model.root.userData.mechanism,
    /plunger valve a slides horizontally through a fixed stuffing-box/);
  assert.match(model.root.userData.mechanism,
    /adjustable screw b meets fixed stop c/);
  assert.equal(degreesOfFreedom.independentOperatingCoordinates, 1);
  assert.equal(degreesOfFreedom.prescribedThermalInput, 1);
  assert.equal(degreesOfFreedom.leverRotationSlavedToPlunger, true);
  assert.equal(degreesOfFreedom.plungerTranslationSlavedToPipeContact, true);
  assert.equal(geometry.flowPathCount, 3);
  assert.equal(blocks.flowGuideLines.length, geometry.flowPathCount);
  assert.equal(blocks.condensateMarkers.length,
    geometry.flowPathCount * geometry.markersPerPath);
  for (const block of [blocks.fixedSupportB, blocks.hollowSphereC,
    blocks.stuffingBox, blocks.pipeA, blocks.valvePlungerA,
    blocks.leverD, blocks.fixedStopC]) {
    assert.equal(block.parent, model.root);
  }

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'fixed-support-B-anchoring-one-point-of-waste-pipe-A',
    'thermally-expanding-waste-pipe-A-fixed-at-B-and-free-at-C',
    'fixed-hollow-sphere-C-surrounding-pipe-end-and-valve',
    'fixed-stuffing-box-guiding-opposed-valve-plunger',
    'one-rigid-valve-plunger-a-sliding-in-stuffing-box',
    'loaded-elbow-lever-D-pressing-plunger-toward-pipe-end',
    'adjustable-stop-screw-b-threaded-through-lower-lever-arm',
    'fixed-stop-c-limiting-loaded-lever-and-cold-plunger-position',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 478 preserves Brown’s construction and does not invent a Ray patent identity', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate478;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_478.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Another steam trap \(Ray’s patent\)/);
  assert.match(movement.description, /longitudinal expansion and contraction/);
  assert.match(movement.description, /loaded elbow lever, D/);
  assert.match(movement.description, /stop-screw, b, and stop, c/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateFixedSupportBPixels, [65, 289]);
  assert.deepEqual(plate.approximateSphereCenterPixels, [289, 281]);
  assert.deepEqual(plate.approximateStuffingBoxPixels, [361, 283]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.engravingEvidence,
    /horizontal A clamped only at far-left B.*opposed horizontal plunger/s);
  assert.match(evidence.patentIdentityDisclosure,
    /no inventor forename, jurisdiction, date, patent number/);
  assert.match(evidence.patentIdentityDisclosure,
    /No patent identifier is inferred/);
  assert.match(sourceReference.publicDomainBookScanUrl,
    /upload\.wikimedia\.org/);
  disposeModel(model.root);
});

test('movement 478 pipe expansion and closing temperature obey the exact linear thermal law', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, thermodynamics } = model.root.userData;

  for (const time of [0, 0.67, 1.83, 3.21, 4, 5.31, 7.42]) {
    const state = stateAtTime(time);
    const expectedTemperature = geometry.coolTemperatureKelvin
      + geometry.temperatureSwingKelvin
        * (1 - Math.cos(2 * Math.PI * state.phase)) / 2;
    const expectedExpansion = geometry.pipeLinearExpansionPerKelvin
      * geometry.pipeFreeLengthMetre
      * (expectedTemperature - geometry.coolTemperatureKelvin);
    near(state.temperatureKelvin, expectedTemperature, 3e-13,
      `temperature at ${time}`);
    near(state.pipeFreeExpansionMetre, expectedExpansion, 2e-18,
      `pipe expansion at ${time}`);
  }
  near(geometry.maximumFreeExpansionMetre,
    geometry.pipeLinearExpansionPerKelvin
      * geometry.pipeFreeLengthMetre * geometry.temperatureSwingKelvin,
    0, 'maximum expansion');
  near(geometry.closingTemperatureKelvin,
    geometry.coolTemperatureKelvin
      + geometry.adjustedColdGapMetre
        / (geometry.pipeLinearExpansionPerKelvin
          * geometry.pipeFreeLengthMetre),
    0, 'adjusted closing temperature');
  assert.ok(geometry.maximumFreeExpansionMetre
    > geometry.adjustedColdGapMetre);
  assert.match(thermodynamics.pipeExpansionEquation,
    /deltaL=alpha\*L\*\(T-Tcool\)/);
  disposeModel(model.root);
});

test('movement 478 closes the gap before moving the plunger and never crosses valve a', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 1600; sample += 1) {
    const state = stateAtTime(
      geometry.cycleDuration * sample / 1600,
    );
    const expectedGap = Math.max(
      0,
      geometry.adjustedColdGapMetre - state.pipeFreeExpansionMetre,
    );
    const expectedPlungerTravel = Math.max(
      0,
      state.pipeFreeExpansionMetre - geometry.adjustedColdGapMetre,
    );
    near(state.pipeValveGapMetre, expectedGap, 0,
      `gap at sample ${sample}`);
    near(state.plungerDisplacementMetre, expectedPlungerTravel, 0,
      `plunger travel at sample ${sample}`);
    near(state.valveTipX - state.pipeEndX,
      expectedGap * geometry.thermalMotionDisplayScaleSceneUnitPerMetre,
      5e-16, `rendered nonpenetration at sample ${sample}`);
    assert.equal(state.pipeValveContact, expectedGap <= 1e-12);
  }
  const cool = stateAtTime(0);
  assert.equal(cool.pipeValveContact, false);
  near(cool.plungerDisplacementMetre, 0, 0, 'cold plunger at stop');
  const hot = stateAtTime(geometry.cycleDuration / 2);
  assert.equal(hot.pipeValveContact, true);
  near(hot.pipeEndX, hot.valveTipX, 2e-16, 'hot sealed contact');
  assert.ok(hot.plungerDisplacementMetre > 0);
  assert.match(dynamics.contactLaw,
    /gap=max.*plungerTravel=max.*never crosses valve a/s);
  disposeModel(model.root);
});

test('movement 478 renderer keeps B fixed, grows A from B, and binds plunger and lever contact exactly', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const supportPosition = blocks.fixedSupportB.position.clone();
  const stuffingPosition = blocks.stuffingBox.position.clone();

  for (const time of [0, 2, 3.25, 4, 5.2, 7]) {
    const state = stateAtTime(time);
    model.update(time);
    const displayedLength = state.pipeEndX - geometry.fixedPipeAnchorX;
    near(blocks.pipeShell.position.x,
      (geometry.fixedPipeAnchorX + state.pipeEndX) / 2,
      0, `pipe midpoint at ${time}`);
    near(blocks.pipeShell.scale.y,
      displayedLength / geometry.basePipeDisplayLength,
      0, `pipe scale at ${time}`);
    near(blocks.pipeFreeEndRim.position.x, state.pipeEndX, 0,
      `free end at ${time}`);
    near(blocks.pipeFixedRim.position.x, geometry.fixedPipeAnchorX, 0,
      `fixed end at ${time}`);
    near(blocks.valvePlungerA.position.x, state.valveTipX, 0,
      `plunger at ${time}`);
    near(blocks.leverD.rotation.z, state.leverAngle, 0,
      `lever angle at ${time}`);
    near(
      geometry.leverPivot.x
        + geometry.leverPlungerContactRadiusSceneUnit
          * Math.sin(state.leverAngle),
      state.externalPadX,
      4e-16,
      `lever-to-pad x contact at ${time}`,
    );
  }
  vectorNear(blocks.fixedSupportB.position, supportPosition, 0,
    'support B remains fixed');
  vectorNear(blocks.stuffingBox.position, stuffingPosition, 0,
    'stuffing box remains fixed');
  disposeModel(model.root);
});

test('movement 478 weighted lever rests on b-c when open and supplies closing load after pipe contact', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, transmission } = model.root.userData;
  const cool = stateAtTime(0);
  near(cool.leverAngle, geometry.leverStopAngle, 0,
    'cold stop angle');
  near(cool.stopClearanceSceneUnit, 0, 0, 'b touches c cold');
  assert.ok(cool.fixedStopReactionNewton > 0);
  near(cool.pipeValveContactForceNewton, 0, 0,
    'no cold pipe-valve reaction');

  const hot = stateAtTime(geometry.cycleDuration / 2);
  assert.ok(hot.leverAngle > geometry.leverStopAngle);
  assert.ok(hot.stopClearanceSceneUnit > 0);
  near(hot.fixedStopReactionNewton, 0, 0, 'stop unloaded hot');
  assert.ok(hot.pipeValveContactForceNewton > 0);
  near(hot.pipeValveContactForceNewton, hot.plungerClosingForceNewton,
    0, 'weighted closing reaction');
  const expectedTorque = geometry.leverWeightMassKilogram
    * geometry.gravityMetrePerSecondSquared
    * hot.weightHorizontalMomentArmSceneUnit;
  near(hot.clockwiseWeightTorqueNewtonSceneUnit, expectedTorque, 0,
    'weight torque');
  assert.match(transmission.leverConstraintEquation, /theta=asin/);
  assert.match(transmission.stopAdjustment,
    /sets the cold valve-tip location.*closing temperature/);
  disposeModel(model.root);
});

test('movement 478 open plunger curtain discharges condensate and contact shuts flow exactly', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, transmission } = model.root.userData;

  for (const time of [0, 0.8, 1.7, 2.25, 3, 4, 5.75, 6.6, 7.4]) {
    const state = stateAtTime(time);
    const expectedCurtainArea = Math.PI
      * geometry.pipeInsideDiameterMetre * state.pipeValveGapMetre;
    const expectedArea = Math.min(
      geometry.pipeBoreAreaSquareMetre,
      expectedCurtainArea,
    );
    const expectedFlow = geometry.dischargeCoefficient * expectedArea
      * Math.sqrt(
        2 * (geometry.inletPressurePascal
          - geometry.outletPressurePascal)
        / geometry.condensateDensityKilogramPerCubicMetre,
      );
    near(state.curtainAreaSquareMetre, expectedCurtainArea, 2e-20,
      `curtain area at ${time}`);
    near(state.effectiveFlowAreaSquareMetre, expectedArea, 2e-20,
      `effective area at ${time}`);
    near(state.condensateVolumeFlowCubicMetrePerSecond, expectedFlow,
      2e-19, `flow at ${time}`);
  }
  near(stateAtTime(0).condensateVolumeFlowCubicMetrePerSecond,
    geometry.maximumCondensateVolumeFlowCubicMetrePerSecond, 0,
    'maximum cold flow');
  near(stateAtTime(4).condensateVolumeFlowCubicMetrePerSecond,
    0, 0, 'hot valve shuts condensate and steam');
  assert.match(transmission.curtainDischargeEquation,
    /A_eff=min.*Q=Cd/);
  disposeModel(model.root);
});

test('movement 478 analytic pipe, plunger, and lever rates match finite differences in their active regimes', () => {
  const { model } = movementModel();
  const { stateAtTime } = model.root.userData;
  const delta = 1e-5;

  for (const time of [0.8, 1.6, 3.0, 3.7, 4.4, 5.0, 6.4, 7.2]) {
    const before = stateAtTime(time - delta);
    const state = stateAtTime(time);
    const after = stateAtTime(time + delta);
    near(state.temperatureRateKelvinPerSecond,
      (after.temperatureKelvin - before.temperatureKelvin) / (2 * delta),
      2e-8, `temperature rate at ${time}`);
    near(state.pipeExpansionRateMetrePerSecond,
      (after.pipeFreeExpansionMetre - before.pipeFreeExpansionMetre)
        / (2 * delta),
      5e-13, `pipe rate at ${time}`);
    near(state.plungerVelocityMetrePerSecond,
      (after.plungerDisplacementMetre - before.plungerDisplacementMetre)
        / (2 * delta),
      5e-13, `plunger rate at ${time}`);
    near(state.leverAngularVelocityRadianPerSecond,
      (after.leverAngle - before.leverAngle) / (2 * delta),
      3e-10, `lever rate at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 478 volume-integrated markers follow updated arc-length curves and freeze while shut', () => {
  const { model } = movementModel();
  const { blocks, dynamics, flowPaths, geometry, stateAtTime } =
    model.root.userData;
  let previousVolume = -Infinity;
  for (let sample = 0; sample <= 1600; sample += 1) {
    const state = stateAtTime(
      geometry.cycleDuration * sample / 1600,
    );
    assert.ok(state.cumulativeDischargeVolumeCubicMetre
      >= previousVolume - 2e-18,
    `cumulative flow reversed at sample ${sample}`);
    previousVolume = state.cumulativeDischargeVolumeCubicMetre;
  }
  near(stateAtTime(geometry.cycleDuration).markerTravelTurns,
    geometry.markerPassesPerCycle, 1e-12, 'two passes per cycle');
  near(stateAtTime(2.7).cumulativeDischargeVolumeCubicMetre,
    stateAtTime(4).cumulativeDischargeVolumeCubicMetre, 2e-18,
    'markers stop after hot contact');
  near(stateAtTime(4).cumulativeDischargeVolumeCubicMetre,
    stateAtTime(5.3).cumulativeDischargeVolumeCubicMetre, 2e-18,
    'markers remain stopped until cooling release');

  const openTime = 1.1;
  model.update(openTime);
  for (let pathIndex = 0; pathIndex < geometry.flowPathCount;
    pathIndex += 1) {
    const curve = flowPaths.condensateFlowCurves[pathIndex];
    near(curve.points[3].x, stateAtTime(openTime).pipeEndX - 0.14,
      0, `dynamic pipe endpoint on path ${pathIndex}`);
    for (let markerIndex = 0; markerIndex < geometry.markersPerPath;
      markerIndex += 1) {
      const flatIndex = pathIndex * geometry.markersPerPath + markerIndex;
      const progress = flowPaths.markerProgressAtTime(
        openTime,
        markerIndex,
      );
      vectorNear(blocks.condensateMarkers[flatIndex].position,
        curve.getPointAt(progress), 2e-15,
        `arc-length marker ${flatIndex}`);
    }
  }
  model.update(4);
  for (const marker of blocks.condensateMarkers) {
    near(marker.scale.length(), 0, 0, 'hot marker hidden');
  }
  assert.match(dynamics.markerContinuity,
    /integrated discharged volume.*updated.*getPointAt.*frozen/s);
  disposeModel(model.root);
});

test('movement 478 declared bounds contain every pose and movement 507 remains the boat-detaching-hook authored frontier', () => {
  const { model } = movementModel();
  const { geometry } = model.root.userData;
  const union = new THREE.Box3();
  for (let sample = 0; sample <= 80; sample += 1) {
    model.update(geometry.cycleDuration * sample / 80);
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
