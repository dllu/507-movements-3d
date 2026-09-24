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
  new URL('../src/simulation/authored-dry-gas-meters.js', import.meta.url),
  'utf8',
);

const ARCHETYPE =
  'two-opposed-variable-volume-bellows-A-A-prime-dead-center-shifted-D-slide-valve-B-positive-displacement-dry-gas-meter-with-fill-count-dials';
const FULL_TURN = Math.PI * 2;

function movementModel() {
  const movement = catalog.movements[482];
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

test('movement 483 is Brown’s two-bellows A/A-prime meter with one slide valve B and dial-work', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 483);
  assert.equal(movement.number, '483');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.match(model.root.userData.mechanism,
    /Two opposed bellows-like measuring chambers A and A-prime/);
  assert.match(model.root.userData.mechanism,
    /single D-shaped slide valve B.*steam-engine slide valve/s);
  assert.match(model.root.userData.mechanism,
    /known chamber capacity multiplied by the registered fill count/);
  assert.equal(degreesOfFreedom.independentOperatingCoordinates, 1);
  assert.equal(degreesOfFreedom.bellowsAAndAPrimeOpposedStroke, 1);
  assert.equal(degreesOfFreedom.valveBTranslationOccursOnlyAtDeadCenters, 1);
  assert.equal(degreesOfFreedom.dialRotationSlavedToMeasuredVolume, 1);
  assert.equal(blocks.bellowsA.group.parent, model.root);
  assert.equal(blocks.bellowsAPrime.group.parent, model.root);
  assert.equal(blocks.valveB.parent, model.root);
  assert.equal(blocks.valvePorts.length, 3);
  assert.equal(blocks.registerDials.length, 3);
  assert.equal(blocks.registerPointers.length, 3);
  assert.equal(blocks.overCenterSpringSegments.length, 12);

  const roles = [];
  const belts = [];
  const steamPistons = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
    if (/steam-piston/i.test(object.userData.role ?? '')) {
      steamPistons.push(object);
    }
  });
  assert.deepEqual(belts, []);
  assert.deepEqual(steamPistons, []);
  for (const role of [
    'bellows-like-measuring-chamber-A',
    'bellows-like-measuring-chamber-A-prime',
    'moving-diaphragm-plate-of-A',
    'moving-diaphragm-plate-of-A-prime',
    'single-D-slide-valve-B-routing-both-bellows',
    'fixed-three-port-seat-under-slide-valve-B',
  ]) assert.ok(roles.includes(role), role);
  // Brown's plate does not draw the register; source presentation removes it.
  assert.ok(!roles.includes('fill-count-input-wheel-driving-dial-work'));
  assert.ok(model.root.userData.sourcePresentation.removedRoles.includes('fill-count-input-wheel-driving-dial-work'));
  assert.equal(geometry.dialFillRatios.length, 3);
  disposeModel(model.root);
});

test('movement 483 preserves Brown’s unavailable source and distinguishes later dry-meter corroboration', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate483;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_483.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Dry gas meter/);
  assert.match(movement.description,
    /two bellows-like chambers, A, A'.*alternately filled.*discharged/s);
  assert.match(movement.description,
    /valve, B.*slide-valve of a steam engine.*worked by the chambers/s);
  assert.match(movement.description,
    /capacity of the chambers being known.*number of times.*filled.*dial-work/s);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateBellowsACenterPixels, [188, 334]);
  assert.deepEqual(plate.approximateBellowsAPrimeCenterPixels, [382, 334]);
  assert.deepEqual(plate.approximateSlideValveBPixels, [293, 132]);
  assert.deepEqual(plate.approximateUpperWorkingLinkPixels, [345, 181]);
  assert.deepEqual(plate.approximateDialWorkHousingPixels, [399, 98]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence,
    /two large side-by-side pleated chamber bodies.*slide-valve B/s);
  assert.match(evidence.historicalCorroboration,
    /William Lyon and Charles W\. Dickinson.*Patent 14,770.*April 29, 1856/s);
  assert.match(evidence.historicalCorroboration,
    /Bureau of Standards Circular 309.*pages 25–28/s);
  assert.match(evidence.historicalTopologyDisclosure,
    /Patent 14,770 uses two pairs.*later Bureau circular.*four measuring chambers/s);
  assert.match(evidence.historicalTopologyDisclosure,
    /Brown’s explicit two chambers and singular B control this reconstruction/);
  assert.match(evidence.reconstructionDisclosure,
    /C2 stroke-and-dwell timing.*independently engineered/s);
  assert.equal(sourceReference.lyonDickinsonPatentUrl,
    'https://patents.google.com/patent/US14770A/en');
  assert.match(sourceReference.bureauOfStandardsCircular309Url,
    /govinfo\.gov/);
  disposeModel(model.root);
});

test('movement 483 uses two C2 measuring strokes separated by zero-flow valve dwells', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime } = model.root.userData;
  const phases = [
    { mode: 'A-filling-A-prime-discharging-through-B', phase: 0.20 },
    {
      mode: 'dead-center-A-full-B-switching-to-A-prime-supply',
      phase: 0.45,
    },
    { mode: 'A-discharging-A-prime-filling-through-B', phase: 0.70 },
    {
      mode: 'dead-center-A-prime-full-B-switching-to-A-supply',
      phase: 0.95,
    },
  ];
  for (const { mode, phase } of phases) {
    assert.equal(stateAtTime(phase * geometry.cycleDuration).mode, mode);
  }

  for (const phase of [0.40, 0.50, 0.90, 1.00]) {
    const time = phase * geometry.cycleDuration;
    const before = stateAtTime(time - 1e-7);
    const at = stateAtTime(time);
    const after = stateAtTime(time + 1e-7);
    near(before.chamberAFillFraction, at.chamberAFillFraction, 2e-15,
      `left position before boundary ${phase}`);
    near(after.chamberAFillFraction, at.chamberAFillFraction, 2e-15,
      `left position after boundary ${phase}`);
    near(before.commonPlateVelocitySceneUnitPerSecond, 0, 2e-14,
      `velocity before boundary ${phase}`);
    near(after.commonPlateVelocitySceneUnitPerSecond, 0, 2e-14,
      `velocity after boundary ${phase}`);
    near(before.commonPlateAccelerationSceneUnitPerSecondSquared, 0,
      5e-7, `acceleration before boundary ${phase}`);
    near(after.commonPlateAccelerationSceneUnitPerSecondSquared, 0,
      5e-7, `acceleration after boundary ${phase}`);
  }
  for (let sample = 0; sample <= 400; sample += 1) {
    for (const startPhase of [0.40, 0.90]) {
      const state = stateAtTime(
        (startPhase + geometry.switchPhaseFraction * sample / 400)
          * geometry.cycleDuration,
      );
      near(state.instantaneousThroughputCubicMetrePerSecond, 0, 0,
        `zero-flow dwell ${startPhase}, sample ${sample}`);
      near(state.chamberAVolumeRateCubicMetrePerSecond, 0, 0,
        `A dwell rate ${startPhase}, sample ${sample}`);
      near(state.chamberAPrimeVolumeRateCubicMetrePerSecond, 0, 0,
        `A-prime dwell rate ${startPhase}, sample ${sample}`);
    }
  }
  assert.match(dynamics.deadCenterSwitching,
    /zero velocity and acceleration.*flow is exactly zero/s);
  disposeModel(model.root);
});

test('movement 483 keeps A and A-prime in exact opposed displacement and volume balance', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime, transmission } =
    model.root.userData;
  const expectedTotal = 2 * geometry.chamberDeadVolumeCubicMetre
    + geometry.chamberStrokeVolumeCubicMetre;
  const expectedLengthSum = geometry.minimumBellowsLengthSceneUnit
    + geometry.maximumBellowsLengthSceneUnit;
  const expectedPlateSeparation = geometry.rightMovingPlateMidpointX
    - geometry.leftMovingPlateMidpointX;

  near(geometry.chamberStrokeVolumeCubicMetre,
    geometry.bellowsEffectiveAreaSquareMetre
      * geometry.bellowsPhysicalStrokeMetre,
    0, 'known stroke volume');
  near(geometry.sceneStrokePerPhysicalMetre,
    geometry.bellowsLengthStrokeSceneUnit
      / geometry.bellowsPhysicalStrokeMetre,
    0, 'display conversion');
  for (let sample = 0; sample <= 2000; sample += 1) {
    const state = stateAtTime(
      geometry.cycleDuration * sample / 2000,
    );
    near(state.chamberAFillFraction + state.chamberAPrimeFillFraction,
      1, 0, `complementary fill at sample ${sample}`);
    near(state.chamberADisplacementMetre
      + state.chamberAPrimeDisplacementMetre,
    geometry.bellowsPhysicalStrokeMetre, 8e-18,
    `physical opposed stroke at sample ${sample}`);
    near(state.chamberALengthSceneUnit
      + state.chamberAPrimeLengthSceneUnit,
    expectedLengthSum, 5e-16,
    `scene opposed lengths at sample ${sample}`);
    near(state.chamberAVolumeCubicMetre
      + state.chamberAPrimeVolumeCubicMetre,
    expectedTotal, 9e-19,
    `constant gas inventory at sample ${sample}`);
    near(state.totalTrappedChamberVolumeCubicMetre,
      expectedTotal, 9e-19,
      `reported gas inventory at sample ${sample}`);
    near(state.chamberAVolumeRateCubicMetrePerSecond,
      -state.chamberAPrimeVolumeRateCubicMetrePerSecond,
      0, `opposed volume rates at sample ${sample}`);
    near(state.rightMovingPlateX - state.leftMovingPlateX,
      expectedPlateSeparation, 8e-16,
      `rigid plate separation at sample ${sample}`);
    near(state.leftMovingPlateX,
      geometry.leftMovingPlateMidpointX
        + state.commonPlateDisplacementSceneUnit,
      5e-16, `left crosshead constraint at sample ${sample}`);
    near(state.rightMovingPlateX,
      geometry.rightMovingPlateMidpointX
        + state.commonPlateDisplacementSceneUnit,
      5e-16, `right crosshead constraint at sample ${sample}`);
  }
  assert.match(dynamics.positiveDisplacement,
    /exchange equal volume.*total trapped volume is constant/s);
  assert.match(transmission.opposedStrokeConstraint,
    /x_A\+x_A_prime=stroke.*dV_A\/dt=-dV_A_prime\/dt/);
  disposeModel(model.root);
});

test('movement 483 integrates displaced volume and drives every register ratio exactly', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, transmission } = model.root.userData;

  near(geometry.volumePerMeterCycleCubicMetre,
    2 * geometry.chamberStrokeVolumeCubicMetre,
    0, 'two known fills per cycle');
  near(stateAtTime(0).cumulativeMeasuredVolumeCubicMetre,
    0, 0, 'zero initial registration');
  near(stateAtTime(geometry.cycleDuration)
    .cumulativeMeasuredVolumeCubicMetre,
  geometry.volumePerMeterCycleCubicMetre, 0,
  'one complete meter cycle');
  near(stateAtTime(geometry.cycleDuration).fillEventsElapsed,
    2, 0, 'two fills per cycle');
  near(stateAtTime(3 * geometry.cycleDuration).fillEventsElapsed,
    6, 0, 'six fills after three cycles');

  const derivativeTimes = [0.4, 1.7, 3.6, 4.5, 6.1, 7.6, 11.2];
  for (const time of derivativeTimes) {
    const state = stateAtTime(time);
    const dt = 1e-5;
    const derivative = (
      stateAtTime(time + dt).cumulativeMeasuredVolumeCubicMetre
        - stateAtTime(time - dt).cumulativeMeasuredVolumeCubicMetre
    ) / (2 * dt);
    near(derivative, state.instantaneousThroughputCubicMetrePerSecond,
      2e-12, `measured-volume derivative at ${time}`);
    near(state.instantaneousInletFlowCubicMetrePerSecond,
      state.instantaneousThroughputCubicMetrePerSecond,
      0, `inlet throughput at ${time}`);
    near(state.instantaneousOutletFlowCubicMetrePerSecond,
      state.instantaneousThroughputCubicMetrePerSecond,
      0, `outlet throughput at ${time}`);
    state.dialAnglesRadian.forEach((angle, index) => {
      near(angle,
        -FULL_TURN * state.fillEventsElapsed
          / geometry.dialFillRatios[index],
        0, `dial ${index} ratio at ${time}`);
    });
  }
  let previousVolume = -Infinity;
  for (let sample = 0; sample <= 3200; sample += 1) {
    const volume = stateAtTime(
      2 * geometry.cycleDuration * sample / 3200,
    ).cumulativeMeasuredVolumeCubicMetre;
    assert.ok(volume >= previousVolume);
    previousVolume = volume;
  }
  assert.match(transmission.meterEquation,
    /V_measured=N_complete_fills\*V_stroke/);
  assert.match(transmission.dialEquation,
    /V_measured\/V_stroke.*fills_per_revolution_j/);
  disposeModel(model.root);
});

test('movement 483 routes B as one three-port D-slide and changes it only at stopped bellows', () => {
  const { model } = movementModel();
  const { blocks, dynamics, geometry, stateAtTime, transmission } =
    model.root.userData;
  const firstStroke = stateAtTime(0.20 * geometry.cycleDuration);
  const secondStroke = stateAtTime(0.70 * geometry.cycleDuration);

  assert.ok(firstStroke.chamberAVolumeRateCubicMetrePerSecond > 0);
  assert.ok(firstStroke.chamberAPrimeVolumeRateCubicMetrePerSecond < 0);
  assert.equal(firstStroke.supplyToAFraction, 1);
  assert.equal(firstStroke.supplyToAPrimeFraction, 0);
  assert.equal(firstStroke.exhaustFromAFraction, 0);
  assert.equal(firstStroke.exhaustFromAPrimeFraction, 1);
  assert.equal(firstStroke.valveBShiftSceneUnit,
    geometry.valveStrokeSceneUnit);
  assert.ok(secondStroke.chamberAVolumeRateCubicMetrePerSecond < 0);
  assert.ok(secondStroke.chamberAPrimeVolumeRateCubicMetrePerSecond > 0);
  assert.equal(secondStroke.supplyToAFraction, 0);
  assert.equal(secondStroke.supplyToAPrimeFraction, 1);
  assert.equal(secondStroke.exhaustFromAFraction, 1);
  assert.equal(secondStroke.exhaustFromAPrimeFraction, 0);
  assert.equal(secondStroke.valveBShiftSceneUnit,
    -geometry.valveStrokeSceneUnit);

  for (const time of [1.6, 3.35, 3.6, 3.95, 5.7, 7.35, 7.6, 7.95]) {
    const state = stateAtTime(time);
    const dt = 1e-5;
    near((
      stateAtTime(time + dt).valveBShiftSceneUnit
        - stateAtTime(time - dt).valveBShiftSceneUnit
    ) / (2 * dt), state.valveBVelocitySceneUnitPerSecond,
    2e-9, `valve velocity at ${time}`);
    if (Math.abs(state.valveBVelocitySceneUnitPerSecond) > 1e-10) {
      near(state.commonPlateVelocitySceneUnitPerSecond, 0, 0,
        `bellows stopped while B moves at ${time}`);
      near(state.instantaneousThroughputCubicMetrePerSecond, 0, 0,
        `flow stopped while B moves at ${time}`);
    }
    model.update(time);
    near(blocks.valveB.position.x, state.valveBShiftSceneUnit, 0,
      `rendered B shift at ${time}`);
    near(blocks.valveRocker.rotation.z,
      state.valveRockerAngleRadian, 0,
      `rendered rocker at ${time}`);
  }
  assert.match(dynamics.valveRouting,
    /inlet-chest gas reaches A.*A-prime to the common exhaust.*reverse/s);
  assert.match(transmission.valveConstraint,
    /fixed at either routing limit during nonzero flow.*dead-center dwell/s);
  disposeModel(model.root);
});

test('movement 483 renderer binds pleat stations, moving plates, crosshead, and gas volumes to one state', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const fixedSnapshots = [
    blocks.leftFixedPlate,
    blocks.rightFixedPlate,
    blocks.valvePortPlate,
    ...blocks.valvePorts,
  ].map((object) => object.position.clone());

  for (const time of [0, 0.9, 2.2, 3.7, 4.8, 6.6, 8]) {
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.movingA.assembly.position.x, state.leftMovingPlateX,
      0, `moving A plate at ${time}`);
    near(blocks.movingAPrime.assembly.position.x,
      state.rightMovingPlateX, 0,
      `moving A-prime plate at ${time}`);
    near(blocks.commonCrosshead.position.x,
      state.commonPlateDisplacementSceneUnit, 0,
      `common crosshead at ${time}`);
    near(blocks.gasA.position.x,
      (geometry.leftFixedPlateX + state.leftMovingPlateX) / 2,
      0, `A gas center at ${time}`);
    near(blocks.gasA.scale.x,
      0.92 * state.chamberALengthSceneUnit, 2e-16,
      `A gas length at ${time}`);
    near(blocks.gasAPrime.position.x,
      (geometry.rightFixedPlateX + state.rightMovingPlateX) / 2,
      0, `A-prime gas center at ${time}`);
    near(blocks.gasAPrime.scale.x,
      0.92 * state.chamberAPrimeLengthSceneUnit, 2e-16,
      `A-prime gas length at ${time}`);
    blocks.bellowsA.stationFrames.forEach((frame, index) => {
      near(frame.position.x, THREE.MathUtils.lerp(
        geometry.leftFixedPlateX,
        state.leftMovingPlateX,
        blocks.bellowsA.stationFractions[index],
      ), 0, `A pleat station ${index} at ${time}`);
    });
    blocks.bellowsAPrime.stationFrames.forEach((frame, index) => {
      near(frame.position.x, THREE.MathUtils.lerp(
        geometry.rightFixedPlateX,
        state.rightMovingPlateX,
        blocks.bellowsAPrime.stationFractions[index],
      ), 0, `A-prime pleat station ${index} at ${time}`);
    });
    fixedSnapshots.forEach((position, index) => {
      const object = [
        blocks.leftFixedPlate,
        blocks.rightFixedPlate,
        blocks.valvePortPlate,
        ...blocks.valvePorts,
      ][index];
      vectorNear(object.position, position, 0,
        `fixed element ${index} at ${time}`);
    });
  }
  disposeModel(model.root);
});

test('movement 483 fill-count wheel and decimal pointers retain accumulated volume', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const firstFillTime = geometry.strokeDurationSecond;
  const secondFillTime = geometry.cycleDuration
    * (2 * geometry.strokePhaseFraction + geometry.switchPhaseFraction);

  near(stateAtTime(firstFillTime).fillEventsElapsed,
    1, 0, 'first completed chamber fill');
  near(stateAtTime(firstFillTime + geometry.switchDurationSecond / 2)
    .fillEventsElapsed,
  1, 0, 'registration holds during first valve shift');
  near(stateAtTime(secondFillTime).fillEventsElapsed,
    2, 0, 'second completed chamber fill');

  for (const time of [0, 2.1, 3.6, 6.4, 8, 13.3, 24]) {
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.countInputRotor.rotation.z,
      -FULL_TURN * state.fillEventsElapsed, 0,
      `fill input wheel at ${time}`);
    blocks.registerPointers.forEach((pointer, index) => {
      near(pointer.rotation.z, state.dialAnglesRadian[index], 0,
        `register pointer ${index} at ${time}`);
    });
  }
  const start = stateAtTime(0);
  const end = stateAtTime(geometry.cycleDuration);
  near(end.chamberAFillFraction, start.chamberAFillFraction, 0,
    'bellows geometry closes');
  near(end.valveBShiftSceneUnit, start.valveBShiftSceneUnit, 0,
    'valve geometry closes');
  near(end.fillEventsElapsed - start.fillEventsElapsed, 2, 0,
    'register advances instead of resetting');
  near(end.dialAnglesRadian[0] - start.dialAnglesRadian[0],
    -FULL_TURN * 2 / geometry.fillsPerUnitsDialRevolution,
    0, 'units dial advances two tenths of a turn');
  disposeModel(model.root);
});

test('movement 483 volume-integrated markers fade to zero before switching their smooth routes', () => {
  const { model } = movementModel();
  const { blocks, dynamics, flowPaths, geometry, stateAtTime } =
    model.root.userData;
  const maximumFlow = geometry.chamberStrokeVolumeCubicMetre
    * 1.875 / geometry.strokeDurationSecond;

  for (const time of [0.7, 2.0, 4.7, 6.2]) {
    const state = stateAtTime(time);
    model.update(time);
    const firstStroke = state.chamberAVolumeRateCubicMetrePerSecond > 0;
    const activeNames = firstStroke
      ? new Set(['inletToA', 'APrimeToOutlet'])
      : new Set(['inletToAPrime', 'AToOutlet']);
    for (const [name, markers] of Object.entries(flowPaths.markerSets)) {
      markers.forEach((marker, index) => {
        const progress = flowPaths.markerProgress(
          state.markerTravelTurns,
          index,
        );
        vectorNear(marker.position,
          flowPaths.curves[name].getPointAt(progress), 3e-15,
          `${name} marker ${index} at ${time}`);
        const expectedScale = activeNames.has(name)
          ? Math.sin(Math.PI * progress) ** 0.52
            * state.instantaneousThroughputCubicMetrePerSecond
              / maximumFlow
          : 0;
        near(marker.scale.x, expectedScale, 3e-15,
          `${name} marker scale ${index} at ${time}`);
        assert.equal(marker.visible, expectedScale > 1e-7);
      });
    }
  }
  for (const time of [3.2, 3.6, 4.0, 7.2, 7.6, 8.0]) {
    model.update(time);
    for (const markers of Object.values(flowPaths.markerSets)) {
      for (const marker of markers) assert.equal(marker.visible, false);
    }
  }
  const beforeSwitch = stateAtTime(3.2 - 1e-5);
  const atSwitch = stateAtTime(3.2);
  const afterSwitch = stateAtTime(3.2 + 1e-5);
  assert.ok(beforeSwitch.instantaneousThroughputCubicMetrePerSecond < 1e-12);
  assert.equal(atSwitch.instantaneousThroughputCubicMetrePerSecond, 0);
  assert.equal(afterSwitch.instantaneousThroughputCubicMetrePerSecond, 0);
  assert.match(sourceText, /flowPaths\[name\]\.getPointAt\(progress\)/);
  assert.match(dynamics.markerContinuity,
    /analytic accumulated positive-displacement volume.*getPointAt/s);
  disposeModel(model.root);
});

test('movement 483 fits every bellows and valve pose and leaves spinning movement 507 as the frontier', () => {
  const { model } = movementModel();
  const { geometry } = model.root.userData;
  const union = new THREE.Box3();
  for (let sample = 0; sample <= 200; sample += 1) {
    model.update(geometry.cycleDuration * sample / 200);
    union.union(new THREE.Box3().setFromObject(model.root));
  }
  assert.ok(model.root.userData.cameraFitBounds.containsBox(union));
  assert.ok(model.root.userData.cameraDistanceScale >= 1);
  const baseBounds = new THREE.Box3().setFromObject(
    model.root.userData.blocks.base,
  );
  assert.ok(model.root.userData.groundFloorY <= baseBounds.min.y);

  const next = catalog.movements[506];
  assert.equal(next.id, 507);
  assert.equal(next.number, '507');
  assert.equal(next.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(next.fidelity, 'authored');
  disposeModel(model.root);
});
