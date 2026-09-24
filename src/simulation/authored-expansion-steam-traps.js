import {correctEjectorTrapParts} from './ejector-trap-working-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function cylinderBetween(start, end, radius, material, role, sides = 40) {
  const direction = end.clone().sub(start);
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), sides),
    material,
  );
  cylinder.position.copy(start).add(end).multiplyScalar(0.5);
  cylinder.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  cylinder.userData.role = role;
  return cylinder;
}

function ringNormalToX(radius, tubeRadius, material, role) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 10, 56),
    material,
  );
  ring.rotation.y = Math.PI / 2;
  ring.userData.role = role;
  return ring;
}

function makeExpansionPipeMesh(length, radius, material, role) {
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 52, 1, true),
    material,
  );
  pipe.rotation.z = Math.PI / 2;
  pipe.userData.role = role;
  return pipe;
}

function rayExpansionSteamTrap(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8;

  // Brown supplies construction and state order, but no dimensions, material,
  // temperatures, pressures, or timing. These SI assumptions are exposed.
  // Thermal motion alone is greatly magnified in the display.
  const coolTemperatureKelvin = 330;
  const hotTemperatureKelvin = 430;
  const temperatureSwingKelvin = hotTemperatureKelvin
    - coolTemperatureKelvin;
  const pipeFreeLengthMetre = 0.45;
  const pipeLinearExpansionPerKelvin = 12e-6;
  const adjustedColdGapMetre = 0.00036;
  const thermalMotionDisplayScaleSceneUnitPerMetre = 800;
  const maximumFreeExpansionMetre = pipeLinearExpansionPerKelvin
    * pipeFreeLengthMetre * temperatureSwingKelvin;
  const closingTemperatureKelvin = coolTemperatureKelvin
    + adjustedColdGapMetre
      / (pipeLinearExpansionPerKelvin * pipeFreeLengthMetre);

  const inletPressurePascal = 165000;
  const outletPressurePascal = 101325;
  const condensateDensityKilogramPerCubicMetre = 988;
  const dischargeCoefficient = 0.64;
  const pipeInsideDiameterMetre = 0.018;
  const pipeBoreAreaSquareMetre = Math.PI
    * (pipeInsideDiameterMetre / 2) ** 2;
  const pressureDropPascal = inletPressurePascal - outletPressurePascal;
  const hydraulicSpeedFactorMetrePerSecond = Math.sqrt(
    2 * pressureDropPascal / condensateDensityKilogramPerCubicMetre,
  );

  const leverPivot = new THREE.Vector3(2.15, 1.68, 0);
  const leverPlungerContactRadiusSceneUnit = 1.48;
  const leverWeightLocalCenter = new THREE.Vector3(1.30, 0.23, 0);
  const leverWeightMassKilogram = 2.4;
  const gravityMetrePerSecondSquared = 9.80665;
  const coolPipeEndX = -0.30;
  const fixedPipeAnchorX = -3.42;
  const pipeAxisY = 0.20;
  const basePipeDisplayLength = coolPipeEndX - fixedPipeAnchorX;
  const plungerExternalContactLocalX = 2.03;
  const coolValveTipX = coolPipeEndX
    + adjustedColdGapMetre
      * thermalMotionDisplayScaleSceneUnitPerMetre;
  const coolExternalPadX = coolValveTipX
    + plungerExternalContactLocalX;
  const leverStopAngle = Math.asin(
    (coolExternalPadX - leverPivot.x)
      / leverPlungerContactRadiusSceneUnit,
  );
  const stopScrewTipLocal = new THREE.Vector3(-0.58, -1.94, 0);
  const rotatedPoint = (point, angle) => new THREE.Vector3(
    leverPivot.x + point.x * Math.cos(angle) - point.y * Math.sin(angle),
    leverPivot.y + point.x * Math.sin(angle) + point.y * Math.cos(angle),
    point.z,
  );
  const fixedStopContactPoint = rotatedPoint(
    stopScrewTipLocal,
    leverStopAngle,
  );

  const stateAtTimeWithoutFlowIntegral = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    const angle = FULL_TURN * phase;
    const heatingFraction = 0.5 * (1 - Math.cos(angle));
    const heatingFractionRatePerSecond = Math.PI / cycleDuration
      * Math.sin(angle);
    const temperatureKelvin = coolTemperatureKelvin
      + temperatureSwingKelvin * heatingFraction;
    const temperatureRateKelvinPerSecond = temperatureSwingKelvin
      * heatingFractionRatePerSecond;
    const pipeFreeExpansionMetre = pipeLinearExpansionPerKelvin
      * pipeFreeLengthMetre
      * (temperatureKelvin - coolTemperatureKelvin);
    const pipeExpansionRateMetrePerSecond = pipeLinearExpansionPerKelvin
      * pipeFreeLengthMetre * temperatureRateKelvinPerSecond;
    const pipeValveGapMetre = Math.max(
      0,
      adjustedColdGapMetre - pipeFreeExpansionMetre,
    );
    const plungerDisplacementMetre = Math.max(
      0,
      pipeFreeExpansionMetre - adjustedColdGapMetre,
    );
    const plungerVelocityMetrePerSecond = pipeFreeExpansionMetre
      > adjustedColdGapMetre
      ? pipeExpansionRateMetrePerSecond
      : 0;
    const displayedPlungerDisplacement = plungerDisplacementMetre
      * thermalMotionDisplayScaleSceneUnitPerMetre;
    const externalPadX = coolExternalPadX
      + displayedPlungerDisplacement;
    const leverAngle = Math.asin(
      (externalPadX - leverPivot.x)
        / leverPlungerContactRadiusSceneUnit,
    );
    const leverAngularVelocityRadianPerSecond =
      plungerVelocityMetrePerSecond
      * thermalMotionDisplayScaleSceneUnitPerMetre
      / (leverPlungerContactRadiusSceneUnit * Math.cos(leverAngle));
    const stopScrewTip = rotatedPoint(stopScrewTipLocal, leverAngle);
    const stopClearanceSceneUnit = Math.max(
      0,
      stopScrewTip.x - fixedStopContactPoint.x,
    );
    const weightHorizontalMomentArmSceneUnit =
      leverWeightLocalCenter.x * Math.cos(leverAngle)
      - leverWeightLocalCenter.y * Math.sin(leverAngle);
    const clockwiseWeightTorqueNewtonSceneUnit = leverWeightMassKilogram
      * gravityMetrePerSecondSquared
      * weightHorizontalMomentArmSceneUnit;
    const plungerClosingForceNewton = clockwiseWeightTorqueNewtonSceneUnit
      / (leverPlungerContactRadiusSceneUnit * Math.cos(leverAngle));
    const pipeValveContact = pipeValveGapMetre <= 1e-12;
    const pipeValveContactForceNewton = pipeValveContact
      ? plungerClosingForceNewton
      : 0;
    const fixedStopReactionNewton = pipeValveContact
      ? 0
      : plungerClosingForceNewton;
    const curtainAreaSquareMetre = Math.PI * pipeInsideDiameterMetre
      * pipeValveGapMetre;
    const effectiveFlowAreaSquareMetre = Math.min(
      pipeBoreAreaSquareMetre,
      curtainAreaSquareMetre,
    );
    const condensateVolumeFlowCubicMetrePerSecond = dischargeCoefficient
      * effectiveFlowAreaSquareMetre * hydraulicSpeedFactorMetrePerSecond;
    return {
      clockwiseWeightTorqueNewtonSceneUnit,
      condensateVolumeFlowCubicMetrePerSecond,
      curtainAreaSquareMetre,
      cycleTime,
      effectiveFlowAreaSquareMetre,
      externalPadX,
      fixedStopReactionNewton,
      heatingFraction,
      leverAngle,
      leverAngularVelocityRadianPerSecond,
      phase,
      pipeEndX: coolPipeEndX + pipeFreeExpansionMetre
        * thermalMotionDisplayScaleSceneUnitPerMetre,
      pipeExpansionRateMetrePerSecond,
      pipeFreeExpansionMetre,
      pipeValveContact,
      pipeValveContactForceNewton,
      pipeValveGapMetre,
      plungerClosingForceNewton,
      plungerDisplacementMetre,
      plungerVelocityMetrePerSecond,
      stopClearanceSceneUnit,
      stopScrewTip,
      temperatureKelvin,
      temperatureRateKelvinPerSecond,
      valveTipX: coolValveTipX + displayedPlungerDisplacement,
      weightHorizontalMomentArmSceneUnit,
    };
  };

  const maximumFlowState = stateAtTimeWithoutFlowIntegral(0);
  const maximumCondensateVolumeFlowCubicMetrePerSecond =
    maximumFlowState.condensateVolumeFlowCubicMetrePerSecond;
  const integrationSamples = 2048;
  const cumulativeDischargeVolumeTable = new Float64Array(
    integrationSamples + 1,
  );
  for (let index = 1; index <= integrationSamples; index += 1) {
    const previousTime = cycleDuration * (index - 1)
      / integrationSamples;
    const currentTime = cycleDuration * index / integrationSamples;
    const previousFlow = stateAtTimeWithoutFlowIntegral(previousTime)
      .condensateVolumeFlowCubicMetrePerSecond;
    const currentFlow = index === integrationSamples
      ? maximumCondensateVolumeFlowCubicMetrePerSecond
      : stateAtTimeWithoutFlowIntegral(currentTime)
        .condensateVolumeFlowCubicMetrePerSecond;
    cumulativeDischargeVolumeTable[index] =
      cumulativeDischargeVolumeTable[index - 1]
      + 0.5 * (previousFlow + currentFlow)
        * (currentTime - previousTime);
  }
  const dischargeVolumePerCycleCubicMetre =
    cumulativeDischargeVolumeTable[integrationSamples];
  const markerPassesPerCycle = 2;
  const markerPathEquivalentVolumeCubicMetre =
    dischargeVolumePerCycleCubicMetre / markerPassesPerCycle;

  const cumulativeDischargeVolumeWithinCycle = (cycleTime) => {
    const coordinate = cycleTime / cycleDuration * integrationSamples;
    const lowerIndex = Math.min(
      integrationSamples - 1,
      Math.floor(coordinate),
    );
    return THREE.MathUtils.lerp(
      cumulativeDischargeVolumeTable[lowerIndex],
      cumulativeDischargeVolumeTable[lowerIndex + 1],
      coordinate - lowerIndex,
    );
  };
  const cumulativeDischargeVolumeAtTime = (time) => {
    const completeCycles = Math.floor(time / cycleDuration);
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return completeCycles * dischargeVolumePerCycleCubicMetre
      + cumulativeDischargeVolumeWithinCycle(cycleTime);
  };
  const stateAtTime = (time) => {
    const state = stateAtTimeWithoutFlowIntegral(time);
    const cumulativeDischargeVolumeCubicMetre =
      cumulativeDischargeVolumeAtTime(time);
    return {
      ...state,
      cumulativeDischargeVolumeCubicMetre,
      flowFraction: maximumCondensateVolumeFlowCubicMetrePerSecond > 0
        ? state.condensateVolumeFlowCubicMetrePerSecond
          / maximumCondensateVolumeFlowCubicMetrePerSecond
        : 0,
      markerTravelTurns: cumulativeDischargeVolumeCubicMetre
        / markerPathEquivalentVolumeCubicMetre,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.42,
  });
  const sphereMaterial = matte(PALETTE.frame, {
    metalness: 0.19,
    opacity: 0.25,
    roughness: 0.36,
    side: THREE.DoubleSide,
    transparent: true,
  });
  sphereMaterial.depthWrite = false;
  const pipeMaterial = matte(PALETTE.driven, {
    metalness: 0.22,
    opacity: 0.78,
    roughness: 0.38,
    transparent: true,
  });
  pipeMaterial.depthWrite = false;
  const valveMaterial = matte(PALETTE.driven, {
    metalness: 0.28,
    roughness: 0.36,
  });
  const leverMaterial = matte(PALETTE.accent, {
    metalness: 0.25,
    roughness: 0.42,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.42,
    roughness: 0.26,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const markerMaterial = matte(0xdaf5f7, {
    opacity: 0.91,
    roughness: 0.25,
    transparent: true,
  });
  markerMaterial.depthWrite = false;

  const baseLeft = new THREE.Mesh(
    new THREE.BoxGeometry(3.58, 0.20, 1.30),
    frameMaterial,
  );
  baseLeft.position.set(-1.92, -1.38, 0);
  baseLeft.userData.role = 'fixed-base-left-of-C-outlet';
  const baseRight = new THREE.Mesh(
    new THREE.BoxGeometry(2.63, 0.20, 1.30),
    frameMaterial,
  );
  baseRight.position.set(2.12, -1.38, 0);
  baseRight.userData.role = 'fixed-base-under-lever-D-and-stop-c';
  root.add(baseLeft, baseRight);

  const fixedSupportB = new THREE.Group();
  fixedSupportB.userData.role =
    'fixed-support-B-anchoring-one-point-of-waste-pipe-A';
  const supportPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 1.36, 0.82),
    frameMaterial,
  );
  supportPost.position.set(-3.22, -0.67, 0);
  supportPost.userData.role = 'fixed-upright-of-support-B';
  const supportClamp = ringNormalToX(
    0.33,
    0.09,
    darkMaterial,
    'fixed-clamp-B-around-pipe-A',
  );
  supportClamp.position.set(-3.22, pipeAxisY, 0);
  fixedSupportB.add(supportPost, supportClamp);
  root.add(fixedSupportB);

  const sphereCenter = new THREE.Vector3(0.25, pipeAxisY, 0);
  const sphereRadius = 1.13;
  const hollowSphereC = new THREE.Mesh(
    new THREE.SphereGeometry(sphereRadius, 64, 32),
    sphereMaterial,
  );
  hollowSphereC.position.copy(sphereCenter);
  hollowSphereC.userData.role =
    'fixed-hollow-sphere-C-surrounding-pipe-end-and-valve';
  const sphereCutawayRim = new THREE.Mesh(
    new THREE.TorusGeometry(sphereRadius, 0.065, 10, 64),
    darkMaterial,
  );
  sphereCutawayRim.position.copy(sphereCenter);
  sphereCutawayRim.userData.role = 'front-cutaway-rim-of-sphere-C';
  const sphereOutlet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 1.55, 48, 1, true),
    sphereMaterial,
  );
  sphereOutlet.position.set(sphereCenter.x, -1.65, 0);
  sphereOutlet.userData.role = 'fixed-bottom-outlet-from-sphere-C';
  const sphereOutletRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.065, 10, 48),
    darkMaterial,
  );
  sphereOutletRim.rotation.x = Math.PI / 2;
  sphereOutletRim.position.set(sphereCenter.x, -2.42, 0);
  sphereOutletRim.userData.role = 'fixed-bottom-outlet-rim';
  root.add(hollowSphereC, sphereCutawayRim, sphereOutlet,
    sphereOutletRim);

  const pipeA = new THREE.Group();
  pipeA.userData.role =
    'thermally-expanding-waste-pipe-A-fixed-at-B-and-free-at-C';
  const pipeShell = makeExpansionPipeMesh(
    basePipeDisplayLength,
    0.27,
    pipeMaterial,
    'expanding-outer-wall-of-pipe-A',
  );
  const pipeWaterCore = makeExpansionPipeMesh(
    basePipeDisplayLength,
    0.135,
    waterMaterial,
    'condensate-inside-expanding-pipe-A',
  );
  const pipeFixedRim = ringNormalToX(
    0.27,
    0.052,
    darkMaterial,
    'fixed-inlet-rim-of-A-at-anchor-side',
  );
  pipeFixedRim.position.set(fixedPipeAnchorX, pipeAxisY, 0);
  const pipeFreeEndRim = ringNormalToX(
    0.27,
    0.050,
    darkMaterial,
    'moving-free-end-of-A-inside-sphere-C',
  );
  pipeA.add(pipeShell, pipeWaterCore, pipeFixedRim, pipeFreeEndRim);
  root.add(pipeA);

  const stuffingBox = new THREE.Group();
  stuffingBox.userData.role =
    'fixed-stuffing-box-guiding-opposed-valve-plunger';
  const stuffingBody = cylinderBetween(
    new THREE.Vector3(1.11, pipeAxisY, 0),
    new THREE.Vector3(1.65, pipeAxisY, 0),
    0.30,
    frameMaterial,
    'fixed-stuffing-box-body-on-right-of-C',
    44,
  );
  const stuffingOuterRim = ringNormalToX(
    0.30,
    0.055,
    darkMaterial,
    'fixed-stuffing-box-outer-packing-ring',
  );
  stuffingOuterRim.position.set(1.66, pipeAxisY, 0);
  stuffingBox.add(stuffingBody, stuffingOuterRim);
  root.add(stuffingBox);

  const valvePlungerA = new THREE.Group();
  valvePlungerA.userData.role =
    'one-rigid-valve-plunger-a-sliding-in-stuffing-box';
  const valveFace = cylinderBetween(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.17, 0, 0),
    0.22,
    valveMaterial,
    'valve-a-face-closing-free-end-of-pipe-A',
    44,
  );
  const plungerRod = cylinderBetween(
    new THREE.Vector3(0.17, 0, 0),
    new THREE.Vector3(plungerExternalContactLocalX, 0, 0),
    0.12,
    valveMaterial,
    'rigid-horizontal-plunger-rod-through-stuffing-box',
    32,
  );
  const plungerContactPad = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.48, 0.36),
    valveMaterial,
  );
  plungerContactPad.position.x = plungerExternalContactLocalX;
  plungerContactPad.userData.role =
    'vertical-sliding-contact-pad-between-plunger-and-lever-D';
  valvePlungerA.add(valveFace, plungerRod, plungerContactPad);
  root.add(valvePlungerA);

  const leverD = new THREE.Group();
  leverD.position.copy(leverPivot);
  leverD.userData.role =
    'loaded-elbow-lever-D-pressing-plunger-toward-pipe-end';
  const lowerLeverArm = cylinderBetween(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -2.05, 0),
    0.11,
    leverMaterial,
    'lower-arm-of-loaded-elbow-lever-D',
    28,
  );
  const weightedLeverArm = cylinderBetween(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1.22, 0.21, 0),
    0.13,
    leverMaterial,
    'weighted-upper-arm-of-elbow-lever-D',
    28,
  );
  const leverWeight = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 42, 24),
    leverMaterial,
  );
  leverWeight.scale.set(1.22, 0.76, 0.70);
  leverWeight.position.copy(leverWeightLocalCenter);
  leverWeight.userData.role = 'fixed-load-on-long-arm-of-lever-D';
  const leverPivotPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.62, 36),
    darkMaterial,
  );
  leverPivotPin.rotation.x = Math.PI / 2;
  leverPivotPin.userData.role = 'fixed-pivot-pin-of-elbow-lever-D';
  const plungerContactRoller = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 30, 18),
    darkMaterial,
  );
  plungerContactRoller.position.set(
    0,
    -leverPlungerContactRadiusSceneUnit,
    0,
  );
  plungerContactRoller.userData.role =
    'lever-D-contact-against-plunger-pad';
  const stopScrewB = cylinderBetween(
    new THREE.Vector3(-0.58, -1.94, 0),
    new THREE.Vector3(-0.10, -1.94, 0),
    0.085,
    darkMaterial,
    'adjustable-stop-screw-b-threaded-through-lower-lever-arm',
    24,
  );
  const screwHeadB = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.11, 28),
    darkMaterial,
  );
  screwHeadB.rotation.z = Math.PI / 2;
  screwHeadB.position.set(-0.05, -1.94, 0);
  screwHeadB.userData.role = 'head-of-adjusting-screw-b';
  const screwThreadPoints = [];
  for (let index = 0; index <= 80; index += 1) {
    const progress = index / 80;
    const threadAngle = progress * FULL_TURN * 7;
    screwThreadPoints.push(new THREE.Vector3(
      -0.57 + 0.46 * progress,
      -1.94 + 0.097 * Math.cos(threadAngle),
      0.097 * Math.sin(threadAngle),
    ));
  }
  const screwThreadsB = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(screwThreadPoints),
      120,
      0.015,
      7,
      false,
    ),
    leverMaterial,
  );
  screwThreadsB.userData.role = 'visible-threads-of-adjusting-screw-b';
  leverD.add(lowerLeverArm, weightedLeverArm, leverWeight,
    plungerContactRoller, stopScrewB, screwHeadB, screwThreadsB);
  root.add(leverD);
  leverPivotPin.position.copy(leverPivot);
  root.add(leverPivotPin);

  const fixedStopC = new THREE.Group();
  fixedStopC.userData.role =
    'fixed-stop-c-limiting-loaded-lever-and-cold-plunger-position';
  const stopPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.70, 0.54),
    frameMaterial,
  );
  stopPost.position.set(
    fixedStopContactPoint.x - 0.15,
    fixedStopContactPoint.y - 0.34,
    0,
  );
  stopPost.userData.role = 'fixed-upright-stop-c';
  const stopContactFace = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.34, 0.60),
    darkMaterial,
  );
  stopContactFace.position.copy(fixedStopContactPoint)
    .add(new THREE.Vector3(-0.06, 0, 0));
  stopContactFace.userData.role = 'contact-face-of-fixed-stop-c';
  fixedStopC.add(stopPost, stopContactFace);
  root.add(fixedStopC);

  const outletWaterCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 1.92, 28),
    waterMaterial,
  );
  outletWaterCore.position.set(sphereCenter.x, -1.49, 0);
  outletWaterCore.userData.role =
    'condensate-core-from-sphere-C-through-bottom-outlet';
  root.add(outletWaterCore);

  const flowPathCount = 3;
  const markersPerPath = 6;
  const makeFlowPoints = (laneZ, pipeEndX) => [
    new THREE.Vector3(fixedPipeAnchorX + 0.08, pipeAxisY, laneZ),
    new THREE.Vector3(-2.52, pipeAxisY, laneZ),
    new THREE.Vector3(-1.35, pipeAxisY, laneZ),
    new THREE.Vector3(pipeEndX - 0.14, pipeAxisY, laneZ),
    new THREE.Vector3(pipeEndX + 0.11, 0.04, laneZ * 1.25),
    new THREE.Vector3(0.18, -0.36, laneZ * 1.55),
    new THREE.Vector3(sphereCenter.x, -0.83, laneZ * 1.25),
    new THREE.Vector3(sphereCenter.x, -1.50, laneZ),
    new THREE.Vector3(sphereCenter.x, -2.36, laneZ * 0.35),
  ];
  const laneOffsets = [-0.12, 0, 0.12];
  const condensateFlowCurves = laneOffsets.map((laneZ) =>
    new THREE.CatmullRomCurve3(
      makeFlowPoints(laneZ, coolPipeEndX),
      false,
      'centripetal',
    ));
  const flowLineMaterial = new THREE.LineBasicMaterial({
    color: PALETTE.fluid,
    opacity: 0.34,
    transparent: true,
  });
  const flowGuideLines = condensateFlowCurves.map((curve, index) => {
    const points = curve.getSpacedPoints(80);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      flowLineMaterial,
    );
    line.userData.role =
      `dynamic-condensate-guide-${index + 1}-through-A-gap-C-outlet`;
    root.add(line);
    return line;
  });
  const condensateMarkers = [];
  for (let pathIndex = 0; pathIndex < flowPathCount;
    pathIndex += 1) {
    for (let markerIndex = 0; markerIndex < markersPerPath;
      markerIndex += 1) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.080, 18, 12),
        markerMaterial,
      );
      marker.userData.role =
        `condensate-path-${pathIndex + 1}-marker-${markerIndex + 1}`;
      root.add(marker);
      condensateMarkers.push({ marker, markerIndex, pathIndex });
    }
  }

  const coolPipeColor = new THREE.Color(PALETTE.driven);
  const hotPipeColor = new THREE.Color(PALETTE.driver);
  const markerProgressAtTime = (time, markerIndex) => {
    const state = stateAtTime(time);
    return THREE.MathUtils.euclideanModulo(
      state.markerTravelTurns + markerIndex / markersPerPath,
      1,
    );
  };
  const updateFlowCurves = (pipeEndX) => {
    for (let index = 0; index < condensateFlowCurves.length; index += 1) {
      const curve = condensateFlowCurves[index];
      const points = makeFlowPoints(laneOffsets[index], pipeEndX);
      curve.points.forEach((point, pointIndex) => point.copy(points[pointIndex]));
      curve.updateArcLengths();
      const linePositions = flowGuideLines[index].geometry
        .getAttribute('position');
      for (let sample = 0; sample < linePositions.count; sample += 1) {
        const point = curve.getPointAt(sample / (linePositions.count - 1));
        linePositions.setXYZ(sample, point.x, point.y, point.z);
      }
      linePositions.needsUpdate = true;
    }
  };

  const update = (time) => {
    const state = stateAtTime(time);
    const displayedPipeLength = state.pipeEndX - fixedPipeAnchorX;
    const pipeMidpointX = (fixedPipeAnchorX + state.pipeEndX) / 2;
    for (const mesh of [pipeShell, pipeWaterCore]) {
      mesh.position.set(pipeMidpointX, pipeAxisY, 0);
      mesh.scale.y = displayedPipeLength / basePipeDisplayLength;
    }
    pipeFreeEndRim.position.set(state.pipeEndX, pipeAxisY, 0);
    valvePlungerA.position.set(state.valveTipX, pipeAxisY, 0);
    leverD.rotation.z = state.leverAngle;
    pipeMaterial.color.copy(coolPipeColor).lerp(
      hotPipeColor,
      state.heatingFraction,
    );
    waterMaterial.opacity = 0.06 + 0.44 * state.flowFraction;
    flowLineMaterial.opacity = 0.03 + 0.42 * state.flowFraction;
    updateFlowCurves(state.pipeEndX);
    for (const entry of condensateMarkers) {
      const progress = markerProgressAtTime(time, entry.markerIndex);
      entry.marker.position.copy(
        condensateFlowCurves[entry.pathIndex].getPointAt(progress),
      );
      entry.marker.scale.setScalar(
        Math.sin(Math.PI * progress) ** 0.55
          * Math.sqrt(state.flowFraction),
      );
    }
  };

  const geometry = {
    adjustedColdGapMetre,
    basePipeDisplayLength,
    closingTemperatureKelvin,
    condensateDensityKilogramPerCubicMetre,
    coolExternalPadX,
    coolPipeEndX,
    coolTemperatureKelvin,
    coolValveTipX,
    cycleDuration,
    dischargeCoefficient,
    dischargeVolumePerCycleCubicMetre,
    fixedPipeAnchorX,
    fixedStopContactPoint: fixedStopContactPoint.clone(),
    flowPathCount,
    gravityMetrePerSecondSquared,
    hotTemperatureKelvin,
    hydraulicSpeedFactorMetrePerSecond,
    inletPressurePascal,
    integrationSamples,
    leverPivot: leverPivot.clone(),
    leverPlungerContactRadiusSceneUnit,
    leverStopAngle,
    leverWeightLocalCenter: leverWeightLocalCenter.clone(),
    leverWeightMassKilogram,
    markerPassesPerCycle,
    markerPathEquivalentVolumeCubicMetre,
    markersPerPath,
    maximumCondensateVolumeFlowCubicMetrePerSecond,
    maximumFreeExpansionMetre,
    outletPressurePascal,
    pipeAxisY,
    pipeBoreAreaSquareMetre,
    pipeFreeLengthMetre,
    pipeInsideDiameterMetre,
    pipeLinearExpansionPerKelvin,
    plungerExternalContactLocalX,
    pressureDropPascal,
    stopScrewTipLocal: stopScrewTipLocal.clone(),
    temperatureSwingKelvin,
    thermalMotionDisplayScaleSceneUnitPerMetre,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'ray-longitudinal-pipe-expansion-steam-trap-with-fixed-anchor-hollow-sphere-stuffing-box-plunger-weighted-elbow-lever-and-adjustable-stop',
    blocks: {
      baseLeft,
      baseRight,
      condensateMarkers: condensateMarkers.map(({ marker }) => marker),
      fixedStopC,
      fixedSupportB,
      flowGuideLines,
      hollowSphereC,
      leverD,
      leverPivotPin,
      leverWeight,
      outletWaterCore,
      pipeA,
      pipeFixedRim,
      pipeFreeEndRim,
      pipeShell,
      pipeWaterCore,
      plungerContactPad,
      plungerContactRoller,
      plungerRod,
      screwHeadB,
      screwThreadsB,
      sphereCutawayRim,
      sphereOutlet,
      sphereOutletRim,
      stopContactFace,
      stopPost,
      stopScrewB,
      stuffingBody,
      stuffingBox,
      stuffingOuterRim,
      valveFace,
      valvePlungerA,
      weightedLeverArm,
    },
    degreesOfFreedom: {
      independentOperatingCoordinates: 1,
      leverRotationSlavedToPlunger: true,
      plungerTranslationSlavedToPipeContact: true,
      prescribedThermalInput: 1,
    },
    dynamics: {
      assumptionScope:
        'The temperature cycle is prescribed and the contact solution is quasi-static. Pipe axial compliance, transient heat transfer, lever and plunger inertia, stuffing-box friction, leakage, flashing, water hammer, and condensate inventory are not integrated.',
      contactLaw:
        'gap=max(adjustedColdGap-freeExpansion,0); plungerTravel=max(freeExpansion-adjustedColdGap,0). Thus the pipe end never crosses valve a: it first closes the cold clearance, then carries the plunger and raises the loaded lever.',
      loadPath:
        'Before pipe contact the adjustable b-c stop bears the weighted lever. After contact, the growing pipe displaces the plunger and lifts the weight; the lever supplies the closing reaction at valve a.',
      markerContinuity:
        'Marker phase is integrated discharged volume. The three complete curves are updated for the current free-end location, sampled by arc length with getPointAt, frozen while closed, and endpoint-faded before recycling.',
      thermalMotionScaleDisclosure:
        'Only thermal expansion and the contact-driven plunger travel use 800 scene units per metre so sub-millimetric action can be seen. The pipe body length and all flow equations retain their separately disclosed physical values.',
    },
    fidelity: 'authored',
    flowPaths: {
      condensateFlowCurves,
      cumulativeDischargeVolumeAtTime,
      cumulativeDischargeVolumeTable,
      cumulativeDischargeVolumeWithinCycle,
      markerProgressAtTime,
      updateFlowCurves,
    },
    geometry,
    mechanism:
      'Ray’s trap anchors one portion of horizontal waste-pipe A at fixed support B. A passes into attached hollow sphere C and ends open near its center. Opposite that end, one plunger valve a slides horizontally through a fixed stuffing-box. A loaded elbow lever D presses the plunger inward until adjustable screw b meets fixed stop c. Cool, contracted A leaves an open gap to a and condensate runs into C and down its outlet. Steam heats and lengthens A from B; its free end advances across the adjusted gap, contacts a, and then pushes the plunger outward against D while remaining sealed.',
    motion: {
      pipeAnchor: new THREE.Vector3(fixedPipeAnchorX, pipeAxisY, 0),
      pipeExpansionDirection: new THREE.Vector3(1, 0, 0),
      plungerTranslationDirection: new THREE.Vector3(1, 0, 0),
      weightedLeverSenseUnderPipeExpansion: 'counterclockwise',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 478 HTML marks Animated unavailable and supplies only Brown’s engraving and caption.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate478: {
        approximateFixedSupportBPixels: [65, 289],
        approximateLeverPivotPixels: [388, 235],
        approximatePipeEndPixels: [307, 282],
        approximateSphereCenterPixels: [289, 281],
        approximateStopScrewBPixels: [415, 326],
        approximateStuffingBoxPixels: [361, 283],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 14,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'waste-pipe A expands and contracts longitudinally',
          'A terminates in the middle of attached hollow sphere C',
          'a portion of A is firmly secured to fixed support B',
          'valve a is a stuffing-box-guided plunger opposite A',
          'loaded elbow lever D presses the plunger toward A',
          'adjustable screw b and fixed stop c limit inward travel',
          'water leaves the contracted pipe open and steam expansion closes it',
        ],
        engravingEvidence:
          'Brown’s section shows horizontal A clamped only at far-left B, traversing sphere C to an open central end; an opposed horizontal plunger crosses C’s right stuffing box to the lower arm of pivoted weighted lever D, whose bottom screw b faces base-mounted stop c.',
        patentIdentityDisclosure:
          'Brown names Ray’s patent but supplies no inventor forename, jurisdiction, date, patent number, or claim text. No patent identifier is inferred from the surname alone.',
        reconstructionDisclosure:
          'The B-A-C alignment, opposed stuffing-box plunger, weighted elbow lever, b-c adjustment stop, and cool-open/hot-closed order are source-grounded. Every dimension, material coefficient, temperature, pressure, mass, flow coefficient, streamline, color, and timing value is independently engineered and exposed.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 478',
      publicDomainBookScanUrl:
        'https://upload.wikimedia.org/wikipedia/commons/c/c3/Five_hundred_and_seven_mechanial_movements%2C_embracing_all_those_which_are_most_important_in_dynamics%2C_hydraulics%2C_hydrostatics%2C_pneumatics%2C_steam_engines%2C_mill_and_other_gearing_.._%28IA_fivehundredseven02brow%29.pdf',
    },
    stateAtTime,
    thermodynamics: {
      pipeExpansionEquation:
        'deltaL=alpha*L*(T-Tcool)',
      prescribedTemperatureEquation:
        'T=Tcool+(Thot-Tcool)*(1-cos(2*pi*t/cycleDuration))/2',
    },
    transmission: {
      curtainDischargeEquation:
        'A_eff=min(pi*d_pipe*gap, pi*d_pipe^2/4); Q=Cd*A_eff*sqrt(2*(p_in-p_out)/rho)',
      leverConstraintEquation:
        'theta=asin((x_externalPad-x_pivot)/leverContactRadius)',
      stopAdjustment:
        'screw b against stop c sets the cold valve-tip location and therefore the expansion gap and closing temperature',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.72, -2.60, -1.32),
    new THREE.Vector3(4.28, 2.48, 1.32),
  );
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraDirection = new THREE.Vector3(8.7, 4.4, 11.8);
  root.userData.groundFloorY = -2.60;
  correctEjectorTrapParts(root,478,update);
  // Brown draws a flat section; a narrow view keeps it flat.
  root.userData.cameraDirection.set(0.1, 0.12, 15);
  root.userData.cameraFov = 10;
  markShadows(root);
  hollowSphereC.castShadow = false;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredExpansionSteamTrapMovement(movement) {
  if (movement.id !== 478) return null;
  return rayExpansionSteamTrap(movement);
}
