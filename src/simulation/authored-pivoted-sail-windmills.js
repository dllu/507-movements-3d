import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import { correctWindRotorWorkingParts } from './wind-rotor-working-parts.js';

const FULL_TURN = Math.PI * 2;

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function cylinderBetween(start, end, radius, material, role, sides = 18) {
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), sides),
    material,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  mesh.userData.role = role;
  return mesh;
}

function sourcePhaseFlipQuintic(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x + 54 * x ** 3 - 82 * x ** 4 + 33 * x ** 5;
}

function makeWindArrow({ material, position, role }) {
  const group = addRole(new THREE.Group(), role);
  group.position.copy(position);
  const shaft = cylinderBetween(
    new THREE.Vector3(0, 0, 0.43),
    new THREE.Vector3(0, 0, -0.19),
    0.032,
    material,
    `${role}-shaft`,
    12,
  );
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.105, 0.27, 16),
    material,
  );
  head.rotation.x = -Math.PI / 2;
  head.position.z = -0.32;
  head.userData.role = `${role}-head`;
  group.add(shaft, head);
  return group;
}

function pivotedSailWindmill(movement) {
  const root = new THREE.Group();
  const sailCount = 6;
  const rotorRadiusSceneUnit = 1.72;
  const sweepRadiusSceneUnit = 2.22;
  const sailWidthSceneUnit = 1.28;
  const sailHeightSceneUnit = 0.72;
  const sailThicknessSceneUnit = 0.065;
  const pivotTransitionAngleRadian = Math.PI / 6;
  const officialCyclesPerMinute = 15;
  const cycleDuration = 60 / officialCyclesPerMinute;
  const shaftAngularVelocityRadianPerSecond = FULL_TURN / cycleDuration;
  const physicalRotorRadiusMetre = 4.0;
  const physicalSailWidthMetre = 1.65;
  const physicalSailHeightMetre = 2.0;
  const windSpeedMagnitudeMetrePerSecond = 6.0;
  const windVelocityZMetrePerSecond = -windSpeedMagnitudeMetrePerSecond;
  const tipSpeedRatio = shaftAngularVelocityRadianPerSecond
    * physicalRotorRadiusMetre / windSpeedMagnitudeMetrePerSecond;
  const airDensityKilogramPerCubicMetre = 1.225;
  const powerCoefficient = 0.12;
  const sweptAreaSquareMetre = 2 * physicalRotorRadiusMetre
    * physicalSailHeightMetre;
  const totalSailAreaSquareMetre = sailCount
    * physicalSailWidthMetre * physicalSailHeightMetre;
  const availableWindPowerWatt = 0.5
    * airDensityKilogramPerCubicMetre
    * sweptAreaSquareMetre
    * windSpeedMagnitudeMetrePerSecond ** 3;
  const meanShaftPowerWatt = powerCoefficient * availableWindPowerWatt;
  const meanDrivingTorqueYNewtonMetre = meanShaftPowerWatt
    / shaftAngularVelocityRadianPerSecond;
  const meanLoadTorqueYNewtonMetre = -meanDrivingTorqueYNewtonMetre;
  const markerPacketAdvanceMetre = windSpeedMagnitudeMetrePerSecond
    * cycleDuration / 4;
  const markersPerPath = 4;

  const sailStateAtRotorAngle = (rotorAngleRadian, sailIndex) => {
    const azimuthUnwrappedRadian = rotorAngleRadian
      + sailIndex * FULL_TURN / sailCount;
    const azimuthCycleIndex = Math.floor(
      (azimuthUnwrappedRadian + Math.PI / 2) / FULL_TURN,
    );
    const sailCycleAngleRadian = azimuthUnwrappedRadian + Math.PI / 2
      - azimuthCycleIndex * FULL_TURN;
    const azimuthRadian = sailCycleAngleRadian - Math.PI / 2;
    const orientationCycleOffsetRadian = azimuthCycleIndex * FULL_TURN;
    let worldPanelYawRadian;
    let pivotMode;

    if (sailCycleAngleRadian <= Math.PI) {
      worldPanelYawRadian = azimuthRadian
        + orientationCycleOffsetRadian;
      pivotMode = 'radial-face-presenting-power-stroke';
    } else if (sailCycleAngleRadian < Math.PI
      + pivotTransitionAngleRadian) {
      const transitionAngle = sailCycleAngleRadian - Math.PI;
      const flipProgress = sourcePhaseFlipQuintic(
        transitionAngle / pivotTransitionAngleRadian,
      );
      worldPanelYawRadian = Math.PI / 2
        + pivotTransitionAngleRadian * flipProgress
        + orientationCycleOffsetRadian;
      pivotMode = 'C2-180-degree-flip-after-top-dead-line';
    } else {
      worldPanelYawRadian = 3 * Math.PI / 2
        + orientationCycleOffsetRadian;
      pivotMode = 'wind-aligned-edge-on-return-stroke';
    }

    const faceProjectionFraction = Math.abs(
      Math.cos(worldPanelYawRadian),
    );
    const signedLeverFraction = Math.cos(azimuthRadian);
    return {
      armAngleRadian: azimuthUnwrappedRadian,
      azimuthCycleIndex,
      azimuthRadian,
      faceProjectionFraction,
      hingeLocalYawRadian: worldPanelYawRadian
        - azimuthUnwrappedRadian,
      pivotMode,
      signedLeverFraction,
      sailCycleAngleRadian,
      torqueWeight: signedLeverFraction * faceProjectionFraction,
      worldPanelYawRadian,
    };
  };
  const summedTorqueWeightAtRotorAngle = (rotorAngleRadian) =>
    Array.from(
      { length: sailCount },
      (_, sailIndex) => sailStateAtRotorAngle(
        rotorAngleRadian,
        sailIndex,
      ).torqueWeight,
    ).reduce((sum, weight) => sum + weight, 0);
  const torqueWeightIntegrationSamples = 4096;
  let summedTorqueWeightIntegral = 0;
  for (let sample = 0; sample < torqueWeightIntegrationSamples;
    sample += 1) {
    summedTorqueWeightIntegral += summedTorqueWeightAtRotorAngle(
      FULL_TURN * (sample + 0.5) / torqueWeightIntegrationSamples,
    );
  }
  const meanSummedTorqueWeight = summedTorqueWeightIntegral
    / torqueWeightIntegrationSamples;

  const stateAtTime = (time) => {
    const rotorAngleRadian = shaftAngularVelocityRadianPerSecond * time;
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const sailStates = Array.from(
      { length: sailCount },
      (_, sailIndex) => sailStateAtRotorAngle(
        rotorAngleRadian,
        sailIndex,
      ),
    );
    const summedTorqueWeight = sailStates.reduce(
      (sum, sailState) => sum + sailState.torqueWeight,
      0,
    );
    const torqueRippleFactor = summedTorqueWeight
      / meanSummedTorqueWeight;
    const instantaneousAerodynamicTorqueYNewtonMetre =
      meanDrivingTorqueYNewtonMetre * torqueRippleFactor;
    const flywheelBufferTorqueYNewtonMetre =
      meanDrivingTorqueYNewtonMetre
        - instantaneousAerodynamicTorqueYNewtonMetre;
    const windAxialDisplacementMetre = windVelocityZMetrePerSecond
      * time;
    return {
      availableWindPowerWatt,
      cycleTime,
      flywheelBufferTorqueYNewtonMetre,
      instantaneousAerodynamicTorqueYNewtonMetre,
      markerTravelTurns: -windAxialDisplacementMetre
        / markerPacketAdvanceMetre,
      meanDrivingTorqueYNewtonMetre,
      meanLoadTorqueYNewtonMetre,
      meanShaftPowerWatt,
      netTorqueYNewtonMetre:
        instantaneousAerodynamicTorqueYNewtonMetre
          + flywheelBufferTorqueYNewtonMetre
          + meanLoadTorqueYNewtonMetre,
      phase: cycleTime / cycleDuration,
      rotorAngleRadian,
      sailStates,
      shaftAngularVelocityRadianPerSecond,
      summedTorqueWeight,
      torqueRippleFactor,
      windAxialDisplacementMetre,
      windVelocityZMetrePerSecond,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.33,
    roughness: 0.36,
  });
  const rotorMaterial = matte(PALETTE.driven, {
    metalness: 0.25,
    roughness: 0.39,
  });
  const sailMaterial = matte(PALETTE.accent, {
    metalness: 0.12,
    roughness: 0.48,
  });
  const hingeMaterial = matte(PALETTE.driver, {
    metalness: 0.24,
    roughness: 0.40,
  });
  const windMaterial = matte(PALETTE.fluid, {
    opacity: 0.42,
    roughness: 0.24,
    transparent: true,
  });
  windMaterial.depthWrite = false;
  const markerMaterial = matte(PALETTE.white, {
    opacity: 0.96,
    roughness: 0.20,
    transparent: true,
  });
  markerMaterial.depthWrite = false;

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(5.55, 0.18, 5.55),
    frameMaterial,
  ), 'fixed-square-base-under-vertical-windmill');
  base.position.y = -0.53;
  root.add(base);
  const supportCross = [0, Math.PI / 2].map((angle, index) => {
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(4.55, 0.14, 0.20),
      frameMaterial,
    );
    support.rotation.y = angle;
    support.position.y = -0.37;
    support.userData.role = `fixed-lower-bearing-support-${index + 1}`;
    root.add(support);
    return support;
  });
  const sweepRing = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(sweepRadiusSceneUnit, 0.025, 8, 96),
    matte(PALETTE.muted, { roughness: 0.65 }),
  ), 'fixed-plan-reference-circle-through-sail-pivots');
  sweepRing.rotation.x = Math.PI / 2;
  sweepRing.position.y = 0.08;
  root.add(sweepRing);
  const lowerBearing = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.075, 12, 40),
    darkMaterial,
  ), 'fixed-lower-bearing-around-vertical-shaft');
  lowerBearing.rotation.x = Math.PI / 2;
  lowerBearing.position.y = -0.22;
  root.add(lowerBearing);

  const rotor = addRole(new THREE.Group(),
    'single-six-arm-vertical-axis-rotor');
  rotor.position.y = 0.62;
  root.add(rotor);
  const verticalShaft = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 1.52, 26),
    darkMaterial,
  ), 'single-rigid-vertical-output-shaft');
  verticalShaft.position.y = -0.28;
  rotor.add(verticalShaft);
  const hub = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.43, 0.31, 40),
    rotorMaterial,
  ), 'central-six-arm-rotor-hub');
  rotor.add(hub);
  const squareShaftBoss = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.40, 0.36, 0.40),
    hingeMaterial,
  ), 'square-boss-on-vertical-output-shaft');
  squareShaftBoss.position.y = 0.18;
  rotor.add(squareShaftBoss);
  const loadFlywheel = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 0.13, 48),
    rotorMaterial,
  ), 'rigid-load-flywheel-smoothing-six-sail-torque-ripple');
  loadFlywheel.position.y = -0.72;
  rotor.add(loadFlywheel);
  const loadFlywheelRim = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(0.64, 0.045, 10, 48),
    darkMaterial,
  ), 'rigid-rim-of-load-flywheel');
  loadFlywheelRim.rotation.x = Math.PI / 2;
  loadFlywheelRim.position.y = -0.65;
  // Only the flywheel's drawn edge: hidden reference, not a dark rim.
  loadFlywheelRim.visible = false;
  loadFlywheelRim.userData.retiredInkOutline = true;
  rotor.add(loadFlywheelRim);

  const armAssemblies = [];
  const sailFaceMarkers = [];
  for (let sailIndex = 0; sailIndex < sailCount; sailIndex += 1) {
    const armAssembly = addRole(new THREE.Group(),
      `rigid-radial-arm-assembly-${sailIndex + 1}`);
    armAssembly.rotation.y = sailIndex * FULL_TURN / sailCount;
    const arm = cylinderBetween(
      new THREE.Vector3(0.30, 0, 0),
      new THREE.Vector3(rotorRadiusSceneUnit, 0, 0),
      0.055,
      rotorMaterial,
      `radial-arm-to-pivot-${sailIndex + 1}`,
      14,
    );
    const hinge = addRole(new THREE.Group(),
      `independent-sail-pivot-${sailIndex + 1}`);
    hinge.position.x = rotorRadiusSceneUnit;
    const hingePin = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, 0.98, 20),
      hingeMaterial,
    ), `vertical-hinge-pin-of-sail-${sailIndex + 1}`);
    const panel = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(
        sailWidthSceneUnit,
        sailHeightSceneUnit,
        sailThicknessSceneUnit,
      ),
      sailMaterial,
    ), `pivoted-flat-sail-panel-${sailIndex + 1}`);
    const topRail = new THREE.Mesh(
      new THREE.BoxGeometry(sailWidthSceneUnit + 0.05, 0.045, 0.085),
      darkMaterial,
    );
    topRail.position.y = sailHeightSceneUnit / 2;
    topRail.userData.role = `top-edge-of-pivoted-sail-${sailIndex + 1}`;
    const bottomRail = topRail.clone();
    bottomRail.position.y = -sailHeightSceneUnit / 2;
    bottomRail.userData.role =
      `bottom-edge-of-pivoted-sail-${sailIndex + 1}`;
    const endRails = [-1, 1].map((side, index) => {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, sailHeightSceneUnit, 0.085),
        darkMaterial,
      );
      rail.position.x = side * sailWidthSceneUnit / 2;
      rail.userData.role =
        `vertical-end-${index + 1}-of-pivoted-sail-${sailIndex + 1}`;
      return rail;
    });
    const frontMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.11, 0.018),
      markerMaterial,
    );
    frontMarker.position.z = sailThicknessSceneUnit / 2 + 0.012;
    const backMarker = frontMarker.clone();
    backMarker.position.z = -sailThicknessSceneUnit / 2 - 0.012;
    frontMarker.userData.role =
      `front-face-index-of-pivoted-sail-${sailIndex + 1}`;
    backMarker.userData.role =
      `back-face-index-of-pivoted-sail-${sailIndex + 1}`;
    // Brown draws each sail as a plain board; the dark rails only traced its
    // edges, so they stay as hidden references and the board shows itself.
    for (const rail of [topRail, bottomRail, ...endRails]) {
      rail.visible = false;
      rail.userData.retiredInkOutline = true;
    }
    hinge.add(
      panel,
      topRail,
      bottomRail,
      ...endRails,
      frontMarker,
      backMarker,
      hingePin,
    );
    armAssembly.add(arm, hinge);
    rotor.add(armAssembly);
    armAssemblies.push({
      arm,
      armAssembly,
      bottomRail,
      endRails,
      hinge,
      hingePin,
      panel,
      topRail,
    });
    sailFaceMarkers.push(frontMarker, backMarker);
  }
  const rotorIndex = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 12),
    markerMaterial,
  ), 'white-index-fixed-to-first-radial-arm');
  rotorIndex.position.set(1.05, 0.10, 0);
  armAssemblies[0].armAssembly.add(rotorIndex);

  const windPathOffsets = [
    [-2.55, 0.42],
    [-1.72, 1.05],
    [-0.86, 0.54],
    [0, 1.10],
    [0.86, 0.54],
    [1.72, 1.05],
    [2.55, 0.42],
  ];
  const windCurves = [];
  const windMarkerSets = [];
  for (let pathIndex = 0; pathIndex < windPathOffsets.length; pathIndex += 1) {
    const [x, y] = windPathOffsets[pathIndex];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, y, 3.00),
      new THREE.Vector3(x, y, 1.30),
      new THREE.Vector3(x, y, -1.30),
      new THREE.Vector3(x, y, -3.00),
    ], false, 'centripetal');
    windCurves.push(curve);
    const markers = Array.from({ length: markersPerPath }, (_, index) => {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 16, 11),
        markerMaterial,
      );
      marker.userData.role =
        `negative-z-wind-marker-path-${pathIndex + 1}-${index + 1}`;
      root.add(marker);
      return marker;
    });
    windMarkerSets.push(markers);
  }
  const markerProgress = (turns, pathIndex, markerIndex) =>
    THREE.MathUtils.euclideanModulo(
      turns + markerIndex / markersPerPath
        + pathIndex / (windPathOffsets.length * markersPerPath),
      1,
    );
  const windArrows = [-2.64, 0, 2.64].map((x, index) => {
    const arrow = makeWindArrow({
      material: windMaterial,
      position: new THREE.Vector3(x, 1.55, 2.55),
      role: `fixed-negative-z-plan-wind-arrow-${index + 1}`,
    });
    root.add(arrow);
    return arrow;
  });

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.y = state.rotorAngleRadian;
    for (let sailIndex = 0; sailIndex < sailCount; sailIndex += 1) {
      armAssemblies[sailIndex].hinge.rotation.y =
        state.sailStates[sailIndex].hingeLocalYawRadian;
    }
    for (let pathIndex = 0; pathIndex < windMarkerSets.length;
      pathIndex += 1) {
      const markers = windMarkerSets[pathIndex];
      for (let markerIndex = 0; markerIndex < markers.length;
        markerIndex += 1) {
        const progress = markerProgress(
          state.markerTravelTurns,
          pathIndex,
          markerIndex,
        );
        markers[markerIndex].position.copy(
          windCurves[pathIndex].getPointAt(progress),
        );
        markers[markerIndex].scale.setScalar(
          Math.sin(Math.PI * progress) ** 0.50,
        );
      }
    }
  };

  const geometry = {
    airDensityKilogramPerCubicMetre,
    availableWindPowerWatt,
    cycleDuration,
    markerPacketAdvanceMetre,
    markersPerPath,
    meanDrivingTorqueYNewtonMetre,
    meanLoadTorqueYNewtonMetre,
    meanShaftPowerWatt,
    meanSummedTorqueWeight,
    officialCyclesPerMinute,
    physicalRotorRadiusMetre,
    physicalSailHeightMetre,
    physicalSailWidthMetre,
    pivotTransitionAngleRadian,
    powerCoefficient,
    rotorRadiusSceneUnit,
    sailCount,
    sailHeightSceneUnit,
    sailThicknessSceneUnit,
    sailWidthSceneUnit,
    shaftAngularVelocityRadianPerSecond,
    sourcePhaseFlipQuintic,
    summedTorqueWeightAtRotorAngle,
    sweptAreaSquareMetre,
    sweepRadiusSceneUnit,
    tipSpeedRatio,
    torqueWeightIntegrationSamples,
    totalSailAreaSquareMetre,
    windSpeedMagnitudeMetrePerSecond,
    windVelocityZMetrePerSecond,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      officialCyclesPerMinute,
      targetCycleDuration: 2,
    },
    archetype:
      'six-arm-vertical-axis-windmill-with-individually-pivoted-sails-face-on-power-and-edge-on-return',
    blocks: {
      armAssemblies,
      base,
      hub,
      loadFlywheel,
      loadFlywheelRim,
      lowerBearing,
      rotor,
      rotorIndex,
      sailFaceMarkers,
      squareShaftBoss,
      supportCross,
      sweepRing,
      verticalShaft,
      windArrows,
      windMarkerSets,
    },
    degreesOfFreedom: {
      independentOperatingCoordinates: 1,
      individuallyConstrainedSailPivots: 6,
      verticalRotorRotation: 1,
    },
    dynamics: {
      aerodynamicAssumption:
        'Brown gives no dimensions, wind speed, load, or efficiency. The displayed physical operating point uses a disclosed mean power coefficient; a flywheel buffer exactly absorbs the small six-sail torque ripple so the source-prescribed rotor speed remains uniform. This is a signed reduced-order model, not CFD.',
      c2PivotTiming:
        'Each vane stays radial for the full half-turn power stroke, turns through 180 degrees during the 30-degree sector immediately after the top dead line, then stays aligned with the wind for the return. A source-phase quintic matches panel position, angular velocity, and angular acceleration continuously into both adjoining constraints.',
      directDragAction:
        'Negative-Z wind acts on the positive-X half of the plan. Face projection and positive lever arm give positive-Y torque there; sails on the negative-X return half remain parallel to the wind and expose their edges, apart from the short source-prescribed flip whose signed counter-torque is included.',
      markerContinuity:
        'White wind packets advance from the analytic integral of constant negative-Z velocity and use getPointAt arc-length sampling on uninterrupted paths, with smooth endpoint fades.',
      sourceTimingDisclosure:
        'The official canvas runs the rotor at 15 cycles per minute, or four seconds per turn. Its six vane offsets, radial half-turn, 30-degree post-top flip, and wind-aligned remainder are retained; only the linear flip interpolation is replaced by endpoint-matched C2 timing.',
    },
    fidelity: 'authored',
    flow: {
      direction: new THREE.Vector3(0, 0, -1),
      markerProgress,
      windCurves,
    },
    geometry,
    mechanism:
      'Six radial arms rotate together about one vertical output shaft. Every outer sail has its own vertical hinge. Across the positive-X power half-turn, each sail is held radial and presents its broad face to the negative-Z wind. Immediately after crossing the top dead line it makes one smooth 180-degree pivot during 30 degrees of rotor travel, then holds a fixed wind-parallel orientation and returns edge-on across the negative-X side. This is the phase ordering shown by the official animation.',
    motion: {
      rotationAxis: new THREE.Vector3(0, 1, 0),
      rotationSenseViewedFromAbovePositiveY: 'counterclockwise',
      shaftAngularVelocityVector: new THREE.Vector3(
        0,
        shaftAngularVelocityRadianPerSecond,
        0,
      ),
      windDirection: new THREE.Vector3(0, 0, -1),
      windVelocityVectorMetrePerSecond: new THREE.Vector3(
        0,
        0,
        windVelocityZMetrePerSecond,
      ),
    },
    sailStateAtRotorAngle,
    sourceAnimation: {
      available: true,
      officialCanvasModelPresent: true,
      officialCyclePeriodSecond: cycleDuration,
      officialCyclesPerMinute,
      officialPivotPhaseSchedule: [0, 0.5, 7 / 12],
      officialSailPhaseOffsets: [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6],
      sourcePrescribedAbsoluteTiming: true,
    },
    sourceReference: {
      brownPlate486: {
        approximateHubCenterPixels: [263, 263],
        approximatePivotCircleRadiusPixels: 143,
        approximateSailPivotPixels: [
          [197, 136],
          [342, 139],
          [406, 264],
          [337, 388],
          [197, 389],
          [124, 260],
        ],
        approximateWindArrowPixels: [263, 475, 263, 390],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 12,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the wind-mill has a vertical axis',
          'each sail is pivoted',
          'returning sails present their edges toward the wind',
          'working sails present their faces to the wind',
          'the arrow specifies the wind direction',
        ],
        engravingEvidence:
          'Brown’s plan shows six equal radial arms on one central vertical shaft, six separate outer pivots on a common circle, six long narrow sail boards, and one inward-pointing wind arrow.',
        officialAnimationEvidence:
          'The official canvas source rotates one six-arm body at 15 cycles per minute, offsets the six sail interpolators by sixth-turn increments, and uses a half-turn hold followed by a one-twelfth-turn, 30-degree pivot interval.',
        officialEditorialNote:
          'The official page says its animation illustrates the intended motion and warns that Brown’s static illustration appears to flip the sails too early.',
        reconstructionDisclosure:
          'The six-arm topology, individual sail pivots, vertical shaft, plan-view wind direction, face-on radial power half-turn, 30-degree post-top flip, edge-on return, four-second source cycle, and phase ordering are source-grounded. Sail thickness and height, frame, physical dimensions, wind speed, power coefficient, flywheel, colors, particles, and endpoint-matched C2 flip timing are independently engineered and exposed.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 486',
    },
    stateAtTime,
    transmission: {
      aerodynamicPowerEquation:
        'P_mean=C_P*rho*A*abs(U_z)^3/2; tau_mean=P_mean/omega_y',
      hingeConstraint:
        'alpha_world=azimuth on the radial power half-turn; alpha_world advances pi during the post-top 30-degree flip; alpha_world=wind_axis on the remaining return; delta_hinge=alpha_world-azimuth',
      torqueRippleBalance:
        'tau_aero(t)+tau_flywheel_buffer(t)+tau_load=0 at uniform omega_y',
      windToRotationSign:
        'U_z<0 and x>0 imply tau_y=-x*F_z>0',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.06, -0.64, -3.16),
    new THREE.Vector3(3.06, 1.74, 3.16),
  );
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraDirection = new THREE.Vector3(7.4, 9.2, 10.8);
  root.userData.groundFloorY = -0.64;
  correctWindRotorWorkingParts(root, 486);
  // Pass 90: each hinge pin's head stops 0.005 below its sleeve's top (it
  // stood 0.08 proud and read as an off-centre crescent from above), and its
  // foot runs on below the arm so the arm enters the pin's side rather than
  // the pin sitting on the thinner arm with a lip all round.
  for (const { hingePin } of root.userData.blocks.armAssemblies) {
    const top = 0.405, bottom = -0.60;
    hingePin.geometry.dispose();
    hingePin.geometry = new THREE.CylinderGeometry(0.10, 0.10, top - bottom, 32);
    hingePin.position.y = (top + bottom) / 2;
  }
  markShadows(root);
  for (const arrow of windArrows) {
    arrow.traverse((object) => {
      if (object.isMesh) object.castShadow = false;
    });
  }
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredPivotedSailWindmillMovement(movement) {
  if (movement.id !== 486) return null;
  return pivotedSailWindmill(movement);
}
