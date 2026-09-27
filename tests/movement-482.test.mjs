import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const sourceText = await readFile(
  new URL(
    '../src/simulation/authored-mercury-gas-regulators.js',
    import.meta.url,
  ),
  'utf8',
);

const ARCHETYPE =
  'powers-mercury-sealed-large-area-cup-H-lever-reversed-notched-inverted-valve-D-over-inlet-E-to-outlet-F-pressure-regulator';

function movementModel() {
  const movement = catalog.movements[481];
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

test('movement 482 contains Powers’s single H-d-D regulator and no invented belt transmission', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 482);
  assert.equal(movement.number, '482');
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.match(model.root.userData.mechanism,
    /Gas enters through fixed inlet E beneath inverted cup valve D/);
  assert.match(model.root.userData.mechanism,
    /larger inverted pressure cup H.*quicksilver channels/s);
  assert.match(model.root.userData.mechanism,
    /Increasing regulated pressure raises H.*depresses D/s);
  assert.equal(degreesOfFreedom.independentOperatingCoordinates, 1);
  assert.equal(degreesOfFreedom.cupHVerticalTranslation, 1);
  assert.equal(degreesOfFreedom.leverRotationSlavedToCupH, 1);
  assert.equal(degreesOfFreedom.valveDVerticalTranslationSlavedByLever, 1);
  assert.equal(blocks.cupH.parent, model.root);
  assert.equal(blocks.leverD.parent, model.root);
  assert.equal(blocks.valveD.parent, model.root);
  assert.equal(blocks.inletPipeE.parent, model.root);
  assert.equal(blocks.outletPipeF.parent, model.root);
  assert.equal(blocks.outerMercuryChannels.length, 2);
  assert.equal(blocks.innerMercuryBlocks.length, 4);
  assert.equal(blocks.valveNotches.length
    + blocks.sideNotchIndicators.length, geometry.notchCount);
  assert.equal(blocks.valveSkirtFaces.length, geometry.notchCount);
  assert.equal(blocks.flowMarkers.length, geometry.markersPerPath);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'large-area-inverted-pressure-cup-H-with-mercury-sealed-rims',
    'rigid-reversing-lever-d-between-cup-H-and-valve-D',
    'inverted-regulator-valve-D-over-inlet-E',
    'fixed-vertical-inlet-pipe-E',
    'fixed-left-outlet-F-to-burners',
    'inner-quicksilver-channel-forming-seat-for-valve-D',
    'front-inverted-V-notch-b-1',
    'side-inverted-V-notch-b-4-on-valve-D',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 482 preserves Brown’s unavailable source, lettering, and Powers patent provenance', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate482;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_482.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Gas regulator \(Powers’s patent\)/);
  assert.match(movement.description, /regulator-valve, D.*inlet-pipe, E/s);
  assert.match(movement.description, /lever, d.*inverted cup, H/s);
  assert.match(movement.description, /lower edges.*dip into channels.*quicksilver/s);
  assert.match(movement.description,
    /notches, b.*gas to pass over the surface of the quicksilver/s);
  assert.match(movement.description,
    /pressure of gas increases.*cup.*raised.*depression of the valve/s);
  assert.match(movement.description,
    /contracting the opening notches, b.*diminishing/s);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateCupHLinkPixels, [272, 179]);
  assert.deepEqual(plate.approximateLeverDPixels, [293, 198]);
  assert.deepEqual(plate.approximateValveDPixels, [365, 176]);
  assert.deepEqual(plate.approximateInletEPixels, [351, 286]);
  assert.deepEqual(plate.approximateOutletFPixels, [176, 312]);
  assert.equal(evidence.explicitInBrownDescription.length, 8);
  assert.match(evidence.engravingEvidence,
    /large guided cup H.*reversing lever d.*valve D.*inlet E/s);
  assert.match(evidence.patentCorroboration,
    /U\.S\. Patent 21,022.*July 27, 1858/s);
  assert.match(evidence.patentCorroboration,
    /inverted-V side notches.*quicksilver/s);
  assert.match(evidence.patentDrawingDisclosure,
    /rendered H-d-D kinematics follow Brown/s);
  assert.match(evidence.reconstructionDisclosure,
    /pressure and demand waves.*independently engineered/s);
  assert.equal(sourceReference.powersPatentUrl,
    'https://patents.google.com/patent/US21022A/en');
  disposeModel(model.root);
});

test('movement 482 solves the V-notch gas-flow equilibrium at every pose', () => {
  const { model } = movementModel();
  const {
    geometry,
    stateAtTime,
    transmission,
    valveAreaAtPressure,
    valveFlowAtPressures,
  } = model.root.userData;

  for (let sample = 0; sample <= 2000; sample += 1) {
    const time = geometry.cycleDuration * sample / 2000;
    const state = stateAtTime(time);
    const expectedDemand = geometry.meanDemandFlowCubicMetrePerSecond
      + geometry.demandFlowAmplitudeCubicMetrePerSecond
        * Math.sin(
          geometry.angularFrequencyRadianPerSecond * time
            + geometry.demandPhaseRadian,
        );
    const expectedHeight = THREE.MathUtils.clamp(
      geometry.nominalNotchExposedHeightMetre
        - geometry.notchHeightFeedbackMetrePerPascal
          * (state.outletGaugePressurePascal
            - geometry.targetOutletGaugePressurePascal),
      geometry.minimumNotchExposedHeightMetre,
      geometry.notchMaximumHeightMetre,
    );
    const expectedArea = geometry.notchCount * 0.5
      * (geometry.notchMaximumWidthMetre
        / geometry.notchMaximumHeightMetre)
      * expectedHeight ** 2;
    const expectedFlow = geometry.dischargeCoefficient * expectedArea
      * Math.sqrt(
        2 * (state.inletGaugePressurePascal
          - state.outletGaugePressurePascal)
          / geometry.gasDensityKilogramPerCubicMetre,
      );

    near(state.demandedFlowCubicMetrePerSecond, expectedDemand, 3e-17,
      `prescribed demand at sample ${sample}`);
    near(state.notchExposedHeightMetre, expectedHeight, 0,
      `notch height at sample ${sample}`);
    near(state.valveOpenAreaSquareMetre, expectedArea, 0,
      `triangular area at sample ${sample}`);
    near(valveAreaAtPressure(state.outletGaugePressurePascal),
      expectedArea, 0, `exported area law at sample ${sample}`);
    near(state.regulatedFlowCubicMetrePerSecond, expectedFlow, 0,
      `orifice flow at sample ${sample}`);
    near(valveFlowAtPressures(
      state.inletGaugePressurePascal,
      state.outletGaugePressurePascal,
    ), expectedFlow, 0, `exported flow law at sample ${sample}`);
    near(state.flowBalanceResidualCubicMetrePerSecond, 0, 4e-17,
      `flow equilibrium at sample ${sample}`);
    assert.ok(state.inletGaugePressurePascal
      > state.outletGaugePressurePascal);
  }
  assert.match(transmission.triangularNotchAreaEquation,
    /A_b=N_b.*h_exposed\^2/);
  assert.match(transmission.valveHeightFeedbackEquation,
    /h_exposed=clamp.*p_out-p_target/);
  disposeModel(model.root);
});

test('movement 482 applies Brown’s negative-feedback directions and attenuates inlet pressure', () => {
  const { model } = movementModel();
  const { dynamics, geometry, motion, stateAtTime } = model.root.userData;
  const states = Array.from({ length: 2001 }, (_, sample) => stateAtTime(
    geometry.cycleDuration * sample / 2000,
  ));
  const low = states.reduce((best, state) =>
    state.outletGaugePressurePascal < best.outletGaugePressurePascal
      ? state : best);
  const high = states.reduce((best, state) =>
    state.outletGaugePressurePascal > best.outletGaugePressurePascal
      ? state : best);
  const inletValues = states.map((state) => state.inletGaugePressurePascal);
  const outletValues = states.map((state) => state.outletGaugePressurePascal);
  const inletSpan = Math.max(...inletValues) - Math.min(...inletValues);
  const outletSpan = Math.max(...outletValues) - Math.min(...outletValues);

  assert.ok(outletSpan < 0.06 * inletSpan);
  assert.ok(high.cupHLiftSceneUnit > low.cupHLiftSceneUnit);
  assert.ok(high.valveVerticalDisplacementSceneUnit
    < low.valveVerticalDisplacementSceneUnit);
  assert.ok(high.leverAngleRadian < low.leverAngleRadian);
  assert.ok(high.notchExposedHeightMetre < low.notchExposedHeightMetre);
  assert.ok(high.valveOpenAreaSquareMetre < low.valveOpenAreaSquareMetre);
  vectorNear(motion.cupHDirectionForIncreasingPressure,
    new THREE.Vector3(0, 1, 0), 0, 'cup H direction');
  vectorNear(motion.valveDDirectionForIncreasingPressure,
    new THREE.Vector3(0, -1, 0), 0, 'valve D direction');
  assert.equal(motion.leverSenseForIncreasingPressure, 'clockwise');
  assert.match(dynamics.feedbackLaw,
    /Higher regulated pressure raises H.*depresses D.*area and gas flow fall/s);
  assert.match(dynamics.pressureAttenuation,
    /inlet-pressure disturbance.*smaller outlet-pressure excursion/s);
  disposeModel(model.root);
});

test('movement 482 enforces the exact rigid reversing-lever geometry in state and renderer', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime, transmission } =
    model.root.userData;

  for (const time of [0, 0.71, 1.9, 3.4, 5.8, 8, 13.2]) {
    const state = stateAtTime(time);
    near(state.leverCupEndpoint.distanceTo(geometry.leverPivot),
      geometry.leverCupArmSceneUnit, 2e-16,
      `left rigid arm at ${time}`);
    near(state.leverValveEndpoint.distanceTo(geometry.leverPivot),
      geometry.leverValveArmSceneUnit, 2e-16,
      `right rigid arm at ${time}`);
    near(state.valveVerticalDisplacementSceneUnit,
      -geometry.leverMotionRatio * state.cupHLiftSceneUnit,
      2e-17, `reversed vertical ratio at ${time}`);
    near(state.leverAngleRadian,
      -Math.asin(
        state.cupHLiftSceneUnit / geometry.leverCupArmSceneUnit,
      ), 0, `lever angle at ${time}`);

    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.cupH.position.y, state.cupHLiftSceneUnit, 0,
      `cup renderer at ${time}`);
    near(blocks.valveD.position.y,
      state.valveVerticalDisplacementSceneUnit, 0,
      `valve renderer at ${time}`);
    near(blocks.leverD.rotation.z, state.leverAngleRadian, 0,
      `lever renderer at ${time}`);
    vectorNear(blocks.cupLeverPin.position, state.leverCupEndpoint, 0,
      `left pin at ${time}`);
    vectorNear(blocks.valveLeverPin.position, state.leverValveEndpoint, 0,
      `right pin at ${time}`);

    const cupAttachment = new THREE.Vector3(
      geometry.cupConnectorX,
      geometry.leverPivot.y + state.cupHLiftSceneUnit,
      geometry.leverPivot.z,
    );
    const valveAttachment = new THREE.Vector3(
      geometry.valveCenterX,
      geometry.leverPivot.y
        + state.valveVerticalDisplacementSceneUnit,
      geometry.leverPivot.z,
    );
    vectorNear(new THREE.Vector3(0, -0.5, 0)
      .applyMatrix4(blocks.cupConnector.matrixWorld),
    cupAttachment, 2e-15, `cup-link attachment at ${time}`);
    vectorNear(new THREE.Vector3(0, 0.5, 0)
      .applyMatrix4(blocks.cupConnector.matrixWorld),
    state.leverCupEndpoint, 2e-15, `cup-link lever end at ${time}`);
    vectorNear(new THREE.Vector3(0, -0.5, 0)
      .applyMatrix4(blocks.valveConnector.matrixWorld),
    state.leverValveEndpoint, 2e-15, `valve-link lever end at ${time}`);
    vectorNear(new THREE.Vector3(0, 0.5, 0)
      .applyMatrix4(blocks.valveConnector.matrixWorld),
    valveAttachment, 2e-15, `valve-link attachment at ${time}`);
  }
  assert.match(transmission.leverConstraint,
    /y_D=L_D\*sin\(theta_d\)=-\(L_D\/L_H\)\*y_H/);
  disposeModel(model.root);
});

test('movement 482 keeps all H and D rims immersed with sufficient mercury head', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime } = model.root.userData;

  assert.ok(geometry.cupHEffectiveAreaSquareMetre
    > geometry.valveDEffectiveAreaSquareMetre);
  for (let sample = 0; sample <= 1600; sample += 1) {
    const state = stateAtTime(
      geometry.cycleDuration * sample / 1600,
    );
    near(state.cupHImmersionMetre,
      geometry.baseCupHImmersionMetre - state.cupHPhysicalLiftMetre,
      0, `H immersion at sample ${sample}`);
    near(state.valveDImmersionMetre,
      geometry.baseValveDImmersionMetre + state.valveDepressionMetre,
      0, `D immersion at sample ${sample}`);
    assert.ok(state.cupHImmersionMetre > 0);
    assert.ok(state.valveDImmersionMetre > 0);
    near(state.outletPressureSealCapacityPascal,
      geometry.mercuryDensityKilogramPerCubicMetre
        * geometry.gravityMetrePerSecondSquared
        * state.cupHImmersionMetre,
      0, `H mercury head at sample ${sample}`);
    near(state.valveDifferentialSealCapacityPascal,
      geometry.mercuryDensityKilogramPerCubicMetre
        * geometry.gravityMetrePerSecondSquared
        * state.valveDImmersionMetre,
      0, `D mercury head at sample ${sample}`);
    assert.ok(state.outletPressureSealCapacityPascal
      > state.outletGaugePressurePascal);
    assert.ok(state.valveDifferentialSealCapacityPascal
      > state.inletGaugePressurePascal
        - state.outletGaugePressurePascal);
    near(state.cupPressureForceNewton,
      state.cupRestoringForceNewton, 3e-14,
      `quasi-static H force at sample ${sample}`);
  }
  assert.match(dynamics.mercurySeals,
    /Both H rims and the D skirt remain immersed.*seal capacities exceed/s);
  disposeModel(model.root);
});

test('movement 482 renders each V-notch exposure exactly above the fixed mercury surface', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const notches = [...blocks.valveNotches, ...blocks.sideNotchIndicators];

  assert.equal(notches.length, geometry.notchCount);
  for (const time of [0, 1.1, 2.8, 4.6, 6.9, 8]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (let index = 0; index < notches.length; index += 1) {
      const positions = notches[index].geometry.getAttribute('position');
      const apexWorld = new THREE.Vector3()
        .fromBufferAttribute(positions, 2)
        .applyMatrix4(notches[index].matrixWorld);
      near(apexWorld.y - geometry.innerMercurySurfaceY,
        state.notchExposedHeightMetre
          * geometry.valveMotionDisplayScaleSceneUnitPerMetre,
        8e-8, `notch ${index} exposure at ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 482 gas markers use integrated volume and arc-length travel through E, b, and F', () => {
  const { model } = movementModel();
  const { blocks, dynamics, flowPath, geometry, stateAtTime } =
    model.root.userData;

  near(stateAtTime(0).cumulativeDemandVolumeCubicMetre, 0, 0,
    'integral starts at zero');
  near(stateAtTime(geometry.cycleDuration)
    .cumulativeDemandVolumeCubicMetre,
  geometry.meanDemandFlowCubicMetrePerSecond * geometry.cycleDuration,
  3e-17, 'one-cycle delivered volume');
  for (const time of [0.3, 1.2, 2.9, 5.3, 7.6, 11.4]) {
    const state = stateAtTime(time);
    const dt = 1e-5;
    const numericalDerivative = (
      stateAtTime(time + dt).cumulativeDemandVolumeCubicMetre
        - stateAtTime(time - dt).cumulativeDemandVolumeCubicMetre
    ) / (2 * dt);
    near(numericalDerivative, state.demandedFlowCubicMetrePerSecond,
      2e-12, `volume derivative at ${time}`);
    near(state.markerTravelTurns,
      state.cumulativeDemandVolumeCubicMetre
        / geometry.markerPacketVolumeCubicMetre,
      0, `volume-driven marker travel at ${time}`);

    model.update(time);
    near(flowPath.flowCurve.points[3].y,
      geometry.valveNotchApexLocalY
        + state.valveVerticalDisplacementSceneUnit - 0.20,
      0, `dynamic notch waypoint at ${time}`);
    const flowFraction = state.demandedFlowCubicMetrePerSecond
      / (geometry.meanDemandFlowCubicMetrePerSecond
        + geometry.demandFlowAmplitudeCubicMetrePerSecond);
    for (let index = 0; index < geometry.markersPerPath; index += 1) {
      const progress = flowPath.markerProgress(
        state.markerTravelTurns,
        index,
      );
      vectorNear(blocks.flowMarkers[index].position,
        flowPath.flowCurve.getPointAt(progress), 2e-15,
        `arc-length marker ${index} at ${time}`);
      near(blocks.flowMarkers[index].scale.x,
        Math.sin(Math.PI * progress) ** 0.52
          * Math.sqrt(flowFraction),
        2e-15, `marker fade ${index} at ${time}`);
    }
  }
  assert.match(sourceText, /flowCurve\.getPointAt\(progress\)/);
  assert.match(dynamics.markerContinuity,
    /analytic integral.*getPointAt arc-length sampling/s);
  disposeModel(model.root);
});

test('movement 482 closes its mechanism after one cycle while delivered volume keeps accumulating', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const end = stateAtTime(geometry.cycleDuration);

  for (const key of [
    'cupHLiftSceneUnit',
    'demandedFlowCubicMetrePerSecond',
    'inletGaugePressurePascal',
    'leverAngleRadian',
    'notchExposedHeightMetre',
    'outletGaugePressurePascal',
    'valveOpenAreaSquareMetre',
    'valveVerticalDisplacementSceneUnit',
  ]) near(end[key], start[key], 2e-12, `${key} cycle closure`);
  near(end.cumulativeDemandVolumeCubicMetre
    - start.cumulativeDemandVolumeCubicMetre,
  geometry.meanDemandFlowCubicMetrePerSecond * geometry.cycleDuration,
  3e-17, 'delivered volume does not reset');
  near(end.markerTravelTurns - start.markerTravelTurns, 36, 8e-15,
    'whole marker circuits per cycle');

  model.update(0);
  const startMarkers = model.root.userData.blocks.flowMarkers.map(
    (marker) => marker.position.clone(),
  );
  model.update(geometry.cycleDuration);
  model.root.userData.blocks.flowMarkers.forEach((marker, index) => {
    vectorNear(marker.position, startMarkers[index], 3e-14,
      `marker ${index} geometric closure`);
  });
  disposeModel(model.root);
});

test('movement 482 fits every regulator pose and leaves spinning movement 507 as the frontier', () => {
  const { model } = movementModel();
  const { geometry } = model.root.userData;
  const union = new THREE.Box3();
  for (let sample = 0; sample <= 180; sample += 1) {
    model.update(geometry.cycleDuration * sample / 180);
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

test('movement 482 is a round case: the lid, case wall, channel, well, cup H and valve D are all round about their axes', () => {
  const { model } = movementModel();
  const { blocks, geometry } = model.root.userData;
  const round = geometry.roundCase;
  model.root.updateMatrixWorld(true);
  // The whole cut remains a round section: every cut casting part keeps its
  // back half, whose extent in depth is its radius.
  const box = (object) => new THREE.Box3().setFromObject(object);
  const caseBox = box(blocks.outerMercuryChannels[0].trough);
  near(caseBox.min.z, -round.caseOuter, 0.01, 'case wall round (back)');
  near(caseBox.max.x, round.caseOuter, 0.01, 'case wall round (side)');
  const lid = box(blocks.domedCover);
  assert.ok(lid.min.z < -round.caseOuter && lid.max.x > round.caseOuter, 'lid laps over the round case wall');
  // The channel is formed in the case: its floor runs from the well wall
  // to the case wall, and the quicksilver fills it between them.
  const mercury = box(blocks.outerMercuryChannels[0].mercury);
  assert.ok(mercury.min.z < -round.caseInner + 0.01 && mercury.max.x < round.caseInner, 'quicksilver ring in the case channel');
  // Cup H's rim runs in the channel clear of both walls, at every pose.
  assert.ok(round.rimInner > round.wellOuter && round.rimOuter < round.caseInner);
  assert.ok(round.cupTopRadius < round.caseInner);
  // Valve D's round cup stands inside the well, merged with its wall.
  assert.ok(geometry.valveCenterX + round.dCupWallInner < round.wellInner, 'D channel inside the well');
  // The delivery pipe leaves the well through the port F in its back wall
  // and passes under the channel floor.
  const port = blocks.outletChamber.portCentre;
  assert.ok(port.z < -1 && port.x < -1, 'port F in the back of the well');
  const pipe = box(blocks.outletPipeF);
  assert.ok(pipe.max.y < round.channelFloorBottom, 'pipe under the channel floor');
  disposeModel(model.root);
});
