import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import {boredCylinderGeometry, fitPistonGuide} from './piston-guide-parts.js';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
import {foldingRod} from './folding-joint-parts.js';

const FULL_TURN = Math.PI * 2;

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
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

function horizontalArrow({ direction, length, material, position, role }) {
  const group = addRole(new THREE.Group(), role);
  group.position.copy(position);
  const sign = Math.sign(direction) || 1;
  const shaft = cylinderBetween(
    new THREE.Vector3(-sign * length * 0.42, 0, 0),
    new THREE.Vector3(sign * length * 0.24, 0, 0),
    0.036,
    material,
    `${role}-shaft`,
    12,
  );
  const head = addRole(new THREE.Mesh(
    new THREE.ConeGeometry(0.12, length * 0.30, 18),
    material,
  ), `${role}-head`);
  head.rotation.z = -sign * Math.PI / 2;
  head.position.x = sign * length * 0.39;
  group.add(shaft, head);
  return group;
}

function featheringPaddleWheel(movement) {
  const root = new THREE.Group();
  const bucketCount = 4;
  const officialCyclesPerMinute = 15;
  const cycleDuration = 60 / officialCyclesPerMinute;
  const angularVelocityZ = -FULL_TURN / cycleDuration;

  // Exact proportions visible in the official vector model.
  const sourceScale = 0.20;
  const armRadiusSceneUnit = 12 * sourceScale;
  const eccentricOffsetSceneUnit = 3 * sourceScale;
  const stationaryEccentricRadiusSceneUnit = 5 * sourceScale;
  const controlRingRadiusSceneUnit = 7 * sourceScale;
  const mainShaftRadiusSceneUnit = 1.9 * sourceScale;
  const bucketHeightSceneUnit = 8 * sourceScale;
  const bucketFaceWidthSceneUnit = 1.48;
  const bucketThicknessSceneUnit = 0.13;
  const rotorCenter = new THREE.Vector3(-0.28, 0.28, 0);
  const eccentricCenter = new THREE.Vector3(
    rotorCenter.x + eccentricOffsetSceneUnit,
    rotorCenter.y,
    rotorCenter.z,
  );
  const initialBucketAngles = [
    3 * Math.PI / 4,
    Math.PI / 4,
    -Math.PI / 4,
    -3 * Math.PI / 4,
  ];

  const physicalArmRadiusMetre = 3.0;
  const physicalBucketHeightMetre = 1.6;
  const physicalBucketWidthMetre = 1.8;
  const physicalWaterlineYMetre = -1.10;
  const vesselSpeedXMetrePerSecond = 2.0;
  const ambientWaterVelocityXMetrePerSecond = -vesselSpeedXMetrePerSecond;
  const waterDensityKilogramPerCubicMetre = 1000;
  const normalDragCoefficient = 1.10;

  const bucketImmersionAtCenterY = (centerYMetre) => {
    const bottomY = centerYMetre - physicalBucketHeightMetre / 2;
    const immersedHeightMetre = THREE.MathUtils.clamp(
      physicalWaterlineYMetre - bottomY,
      0,
      physicalBucketHeightMetre,
    );
    return {
      bottomYMetre: bottomY,
      immersedAreaSquareMetre:
        immersedHeightMetre * physicalBucketWidthMetre,
      immersedFraction: immersedHeightMetre / physicalBucketHeightMetre,
      immersedHeightMetre,
      topYMetre: centerYMetre + physicalBucketHeightMetre / 2,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const rotorAngleRadian = angularVelocityZ * time;
    const bucketStates = initialBucketAngles.map((initialAngle, index) => {
      const orbitAngleRadian = rotorAngleRadian + initialAngle;
      const radialVectorScene = new THREE.Vector2(
        armRadiusSceneUnit * Math.cos(orbitAngleRadian),
        armRadiusSceneUnit * Math.sin(orbitAngleRadian),
      );
      const mainPivotScene = new THREE.Vector2(
        rotorCenter.x + radialVectorScene.x,
        rotorCenter.y + radialVectorScene.y,
      );
      const controlPinScene = new THREE.Vector2(
        eccentricCenter.x + radialVectorScene.x,
        eccentricCenter.y + radialVectorScene.y,
      );
      const physicalCenterY = physicalArmRadiusMetre
        * Math.sin(orbitAngleRadian);
      const immersion = bucketImmersionAtCenterY(physicalCenterY);
      const bucketVelocity = new THREE.Vector2(
        -angularVelocityZ * physicalCenterY,
        angularVelocityZ * physicalArmRadiusMetre
          * Math.cos(orbitAngleRadian),
      );
      const normalRelativeSpeed = bucketVelocity.x
        - ambientWaterVelocityXMetrePerSecond;
      const waterForceXNewton = -0.5
        * waterDensityKilogramPerCubicMetre
        * normalDragCoefficient
        * immersion.immersedAreaSquareMetre
        * Math.abs(normalRelativeSpeed)
        * normalRelativeSpeed;
      const hydrodynamicLoadTorqueZNewtonMetre =
        -physicalCenterY * waterForceXNewton;
      return {
        ...immersion,
        bucketVelocityMetrePerSecond: bucketVelocity,
        controlPinScene,
        hydrodynamicLoadTorqueZNewtonMetre,
        index,
        mainPivotScene,
        normalRelativeSpeedMetrePerSecond: normalRelativeSpeed,
        orbitAngleRadian,
        panelWorldYawRadian: 0,
        radialVectorScene,
        waterForceXNewton,
      };
    });
    const thrustXNewton = bucketStates.reduce(
      (sum, state) => sum + state.waterForceXNewton,
      0,
    );
    const hydrodynamicLoadTorqueZNewtonMetre = bucketStates.reduce(
      (sum, state) => sum + state.hydrodynamicLoadTorqueZNewtonMetre,
      0,
    );
    const engineDriveTorqueZNewtonMetre =
      -hydrodynamicLoadTorqueZNewtonMetre;
    const shaftInputPowerWatt =
      engineDriveTorqueZNewtonMetre * angularVelocityZ;
    const usefulPropulsivePowerWatt =
      thrustXNewton * vesselSpeedXMetrePerSecond;
    return {
      angularVelocityZ,
      bucketStates,
      controlRingAngleRadian: rotorAngleRadian,
      cycleTime,
      engineDriveTorqueZNewtonMetre,
      hydrodynamicLoadTorqueZNewtonMetre,
      netShaftTorqueZNewtonMetre:
        engineDriveTorqueZNewtonMetre
        + hydrodynamicLoadTorqueZNewtonMetre,
      phase: cycleTime / cycleDuration,
      rotorAngleRadian,
      shaftInputPowerWatt,
      thrustXNewton,
      usefulPropulsivePowerWatt,
      wakeAndSlipPowerWatt:
        shaftInputPowerWatt - usefulPropulsivePowerWatt,
      wakeMarkerTravelTurns: time / cycleDuration,
    };
  };

  const mainMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.48,
  });
  const controlMaterial = matte(PALETTE.driven, {
    metalness: 0.22,
    roughness: 0.44,
  });
  const bucketMaterial = matte(PALETTE.accent, {
    metalness: 0.12,
    roughness: 0.56,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.38,
  });
  const supportMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.57,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.24,
    roughness: 0.28,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const flowMaterial = matte(PALETTE.fluid, {
    opacity: 0.52,
    roughness: 0.22,
    transparent: true,
  });
  flowMaterial.depthWrite = false;
  const markerMaterial = matte(PALETTE.white, {
    opacity: 0.96,
    roughness: 0.18,
    transparent: true,
  });
  markerMaterial.depthWrite = false;

  const fixedEccentric = addRole(new THREE.Mesh(
    plate(clip.difference(poly(circle([0, 0], stationaryEccentricRadiusSceneUnit, 128)),
      poly(circle([-eccentricOffsetSceneUnit, 0], mainShaftRadiusSceneUnit + .004, 96))), -.12, .12),
    supportMaterial,
  ), 'fixed-stationary-eccentric-e');

  fixedEccentric.position.copy(eccentricCenter);
  fixedEccentric.position.z = .22;
  root.add(fixedEccentric);
  const eccentricIndex = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.080, 18, 12),
    markerMaterial,
  ), 'white-index-on-fixed-eccentric-center');
  eccentricIndex.position.copy(eccentricCenter);
  eccentricIndex.position.z = .37;
  root.add(eccentricIndex);

  const mainRotor = addRole(new THREE.Group(),
    'main-shaft-and-four-radial-arms-b');
  mainRotor.position.copy(rotorCenter);
  mainRotor.position.z = -0.10;
  root.add(mainRotor);
  const mainShaft = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      mainShaftRadiusSceneUnit,
      mainShaftRadiusSceneUnit,
      2.14,
      36,
    ),
    mainMaterial,
  ), 'main-rotating-transverse-shaft');
  mainShaft.rotation.x = Math.PI / 2;
  mainRotor.add(mainShaft);
  const mainArms = [];
  const mainPivotPins = [];
  for (let index = 0; index < bucketCount; index += 1) {
    const arm = addRole(new THREE.Group(),
      `main-radial-arm-b-${index + 1}`);
    arm.rotation.z = initialBucketAngles[index];
    const armBar = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(armRadiusSceneUnit, 0.15, 0.18),
      mainMaterial,
    ), `rigid-arm-bar-b-${index + 1}`);
    armBar.position.x = armRadiusSceneUnit / 2;
    const pivot = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 1.68, 24),
      darkMaterial,
    ), `bucket-pivot-on-arm-b-${index + 1}`);
    pivot.rotation.x = Math.PI / 2;
    pivot.position.set(armRadiusSceneUnit, 0, -.60);
    arm.add(armBar, pivot);
    mainRotor.add(arm);
    mainArms.push(arm);
    mainPivotPins.push(pivot);
  }
  const mainShaftIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 0.08, 0.052),
    markerMaterial,
  ), 'white-index-fixed-to-main-shaft');
  mainShaftIndex.position.set(.20, 0, 1.09);
  mainRotor.add(mainShaftIndex);

  const controlRotor = addRole(new THREE.Group(),
    'loose-control-ring-d-rotating-about-fixed-eccentric-e');
  controlRotor.position.copy(eccentricCenter);
  controlRotor.position.z = 0.22;
  root.add(controlRotor);
  const controlRing = addRole(new THREE.Mesh(
    boredCylinderGeometry(controlRingRadiusSceneUnit + .09, stationaryEccentricRadiusSceneUnit + .006, .14).rotateX(Math.PI / 2),
    controlMaterial,
  ), 'loose-annular-control-ring-d');
  controlRotor.add(controlRing);
  const controlArms = [];
  const controlPins = [];
  for (let index = 0; index < bucketCount; index += 1) {
    const assembly = addRole(new THREE.Group(),
      `control-ring-arm-to-crank-c-${index + 1}`);
    assembly.rotation.z = initialBucketAngles[index];
    const radialLength = armRadiusSceneUnit - controlRingRadiusSceneUnit;
    const radialArm = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(radialLength, 0.12, 0.14),
      controlMaterial,
    ), `radial-extension-of-ring-d-${index + 1}`);
    radialArm.position.x = controlRingRadiusSceneUnit + radialLength / 2;
    const controlPin = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, .28, 24),
      markerMaterial,
    ), `control-pin-at-end-of-ring-arm-${index + 1}`);
    controlPin.rotation.x = Math.PI / 2;
    controlPin.position.set(armRadiusSceneUnit, 0, -.055);
    assembly.add(radialArm, controlPin);
    controlRotor.add(assembly);
    controlArms.push(assembly);
    controlPins.push(controlPin);
  }
  const controlRingIndex = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 12),
    markerMaterial,
  ), 'white-index-fixed-to-control-ring-d');
  controlRingIndex.position.set(controlRingRadiusSceneUnit, 0, 0.10);
  controlRotor.add(controlRingIndex);

  const buckets = [];
  for (let index = 0; index < bucketCount; index += 1) {
    const bucket = addRole(new THREE.Group(),
      `world-upright-bucket-a-${index + 1}`);
    const panel = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(
        bucketThicknessSceneUnit,
        bucketHeightSceneUnit,
        bucketFaceWidthSceneUnit,
      ),
      bucketMaterial,
    ), `vertical-broad-face-of-bucket-a-${index + 1}`);
    panel.position.set(0, 0, -1.05);
    panel.geometry.dispose();
    panel.geometry = plate(clip.difference(poly([[-bucketThicknessSceneUnit/2,-bucketHeightSceneUnit/2],
      [bucketThicknessSceneUnit/2,-bucketHeightSceneUnit/2],[bucketThicknessSceneUnit/2,bucketHeightSceneUnit/2],
      [-bucketThicknessSceneUnit/2,bucketHeightSceneUnit/2]]),poly(circle([0,0],.184,64))), -.50, .74);
    const rearWeb = new THREE.Mesh(new THREE.BoxGeometry(bucketThicknessSceneUnit,
      bucketHeightSceneUnit, .24), bucketMaterial);
    rearWeb.position.z = -1.67;
    rearWeb.userData.role = 'blind-paddle-axle-bore-back-wall';
    bucket.add(rearWeb);
    const crank = foldingRod({length: eccentricOffsetSceneUnit, width: .14, depth: .08,
      bore: .109, material: bucketMaterial, role: `fixed-horizontal-crank-c-${index + 1}`, planeZ: .065});
    crank.userData.addPinEye(0, .184, .24);
    const bucketPivotBoss = addRole(new THREE.Mesh(
      boredCylinderGeometry(.24, .184, .04),
      darkMaterial,
    ), `bucket-a-pivot-boss-${index + 1}`);
    bucketPivotBoss.rotation.x = Math.PI / 2;
    bucketPivotBoss.position.z = .125;
    const crankEndBoss = addRole(new THREE.Mesh(
      boredCylinderGeometry(.15, .109, .04),
      darkMaterial,
    ), `crank-c-control-end-${index + 1}`);
    crankEndBoss.rotation.x = Math.PI / 2;
    crankEndBoss.position.set(eccentricOffsetSceneUnit, 0, .125);
    bucket.add(panel, crank, bucketPivotBoss, crankEndBoss);
    root.add(bucket);
    buckets.push({
      bucket,
      bucketPivotBoss,
      crank,
      crankEndBoss,
      panel,
    });
  }

  const bearing = addRole(new THREE.Mesh(
    boredCylinderGeometry(.52, mainShaftRadiusSceneUnit + .004, .18).rotateX(Math.PI / 2),
    darkMaterial,
  ), 'fixed-main-shaft-front-bearing');
  bearing.position.copy(rotorCenter);
  bearing.position.z = 0.93;
  root.add(bearing);
  const eccentricSupport = new THREE.Mesh(boredCylinderGeometry(.43,
    mainShaftRadiusSceneUnit + .004, .50), supportMaterial);
  eccentricSupport.rotation.x = Math.PI / 2;
  eccentricSupport.position.set(rotorCenter.x, rotorCenter.y, .59);
  eccentricSupport.userData.role = 'fixed-eccentric-to-main-bearing-bored-support';
  root.add(eccentricSupport);
  const supportLegs = [-1, 1].map((side) => {
    const leg = cylinderBetween(
      new THREE.Vector3(rotorCenter.x + side * 1.25, -3.02, 0.88),
      new THREE.Vector3(rotorCenter.x, -0.18, 0.88),
      0.075,
      supportMaterial,
      `fixed-main-bearing-support-leg-${side < 0 ? 'left' : 'right'}`,
      16,
    );
    root.add(leg);
    return leg;
  });
  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(3.25, 0.16, 0.64),
    supportMaterial,
  ), 'fixed-feathering-wheel-base');
  base.position.set(rotorCenter.x, -3.05, 0.88);
  root.add(base);

  const waterlineYSceneUnit = rotorCenter.y - 0.88;
  const waterVolume = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(8.6, 2.55, 4.25),
    waterMaterial,
  ), 'fixed-water-volume-under-feathering-buckets');
  waterVolume.position.set(-0.15, waterlineYSceneUnit - 1.275, 0);
  root.add(waterVolume);
  const waterSurface = addRole(new THREE.Mesh(
    new THREE.PlaneGeometry(8.6, 4.25),
    waterMaterial,
  ), 'fixed-waterline-crossed-edgewise-by-upright-buckets');
  waterSurface.rotation.x = -Math.PI / 2;
  waterSurface.position.y = waterlineYSceneUnit;
  root.add(waterSurface);

  const wakeCurves = [];
  const wakeMarkerSets = [];
  const wakeMarkersPerPath = 4;
  for (let pathIndex = 0; pathIndex < 5; pathIndex += 1) {
    const z = -1.15 + pathIndex * 0.56;
    const y = waterlineYSceneUnit - 0.52 - 0.25 * (pathIndex % 2);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(4.05, y, z),
      new THREE.Vector3(2.25, y + 0.04, z),
      new THREE.Vector3(-0.10, y - 0.04, z),
      new THREE.Vector3(-2.35, y + 0.06, z),
      new THREE.Vector3(-4.05, y, z),
    ], false, 'centripetal');
    wakeCurves.push(curve);
    const path = addRole(new THREE.Mesh(
      new THREE.TubeGeometry(curve, 64, 0.017, 7, false),
      flowMaterial,
    ), `fixed-negative-x-feathering-wheel-wake-path-${pathIndex + 1}`);
    path.castShadow = false;
    root.add(path);
    const markers = Array.from({ length: wakeMarkersPerPath },
      (_, markerIndex) => {
        const marker = addRole(new THREE.Mesh(
          new THREE.SphereGeometry(0.067, 16, 11),
          markerMaterial,
        ), `negative-x-water-marker-${pathIndex + 1}-${markerIndex + 1}`);
        root.add(marker);
        return marker;
      });
    wakeMarkerSets.push(markers);
  }
  const wakeMarkerProgress = (turns, pathIndex, markerIndex) =>
    THREE.MathUtils.euclideanModulo(
      turns + markerIndex / wakeMarkersPerPath
        + pathIndex / (wakeMarkerSets.length * wakeMarkersPerPath),
      1,
    );
  const backwardWaterArrow = horizontalArrow({
    direction: -1,
    length: 1.24,
    material: flowMaterial,
    position: new THREE.Vector3(-3.30, -1.12, 1.48),
    role: 'fixed-negative-x-water-reaction-arrow',
  });
  const forwardVesselArrow = horizontalArrow({
    direction: 1,
    length: 1.38,
    material: bucketMaterial,
    position: new THREE.Vector3(3.05, 3.18, 1.46),
    role: 'fixed-positive-x-vessel-thrust-arrow',
  });
  root.add(backwardWaterArrow, forwardVesselArrow);

  const update = (time) => {
    const state = stateAtTime(time);
    mainRotor.rotation.z = state.rotorAngleRadian;
    controlRotor.rotation.z = state.controlRingAngleRadian;
    state.bucketStates.forEach((bucketState, index) => {
      buckets[index].bucket.position.set(
        bucketState.mainPivotScene.x,
        bucketState.mainPivotScene.y,
        0,
      );
      buckets[index].bucket.rotation.z = bucketState.panelWorldYawRadian;
    });
    for (let pathIndex = 0; pathIndex < wakeMarkerSets.length;
      pathIndex += 1) {
      for (let markerIndex = 0;
        markerIndex < wakeMarkerSets[pathIndex].length;
        markerIndex += 1) {
        const progress = wakeMarkerProgress(
          state.wakeMarkerTravelTurns,
          pathIndex,
          markerIndex,
        );
        const marker = wakeMarkerSets[pathIndex][markerIndex];
        marker.position.copy(wakeCurves[pathIndex].getPointAt(progress));
        marker.scale.setScalar(Math.sin(Math.PI * progress) ** 0.52);
      }
    }
  };

  const geometry = {
    angularVelocityZ,
    armRadiusSceneUnit,
    bucketCount,
    bucketFaceWidthSceneUnit,
    bucketHeightSceneUnit,
    bucketThicknessSceneUnit,
    controlRingRadiusSceneUnit,
    cycleDuration,
    eccentricCenter,
    eccentricOffsetSceneUnit,
    initialBucketAngles,
    mainShaftRadiusSceneUnit,
    normalDragCoefficient,
    officialCyclesPerMinute,
    physicalArmRadiusMetre,
    physicalBucketHeightMetre,
    physicalBucketWidthMetre,
    physicalWaterlineYMetre,
    rotorCenter,
    sourceScale,
    stationaryEccentricRadiusSceneUnit,
    vesselSpeedXMetrePerSecond,
    waterDensityKilogramPerCubicMetre,
    waterlineYSceneUnit,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'four-upright-feathering-paddles-linked-to-control-ring-on-stationary-eccentric',
    blocks: {
      backwardWaterArrow,
      base,
      bearing,
      buckets,
      controlArms,
      controlPins,
      controlRing,
      controlRingIndex,
      controlRotor,
      eccentricIndex,
      fixedEccentric,
      forwardVesselArrow,
      mainArms,
      mainPivotPins,
      mainRotor,
      mainShaft,
      mainShaftIndex,
      supportLegs,
      waterSurface,
      waterVolume,
      wakeMarkerSets,
    },
    bucketImmersionAtCenterY,
    degreesOfFreedom: {
      bucketOrientationCoordinatesConstrainedToZero: 4,
      independentOperatingCoordinates: 1,
      mainRotorRotation: 1,
    },
    dynamics: {
      hydrodynamicAssumption:
        'Only the submerged vertical area receives disclosed quadratic normal drag; entry and exit motion is predominantly along each vertical panel plane. This reduced-order force model is not CFD, and Brown supplies no physical scale or operating point.',
      markerContinuity:
        'White wake packets advance from a continuous time integral and use getPointAt arc-length sampling on uninterrupted negative-X paths, with smooth endpoint fades.',
      reactionPair:
        'Clockwise bottom travel gives negative-X bucket velocity. Upright submerged faces press water backward, water reacts on them in positive X, and the vessel receives the same positive-X thrust.',
    },
    fidelity: 'authored',
    flow: {
      backwardWaterDirection: new THREE.Vector3(-1, 0, 0),
      forwardVesselDirection: new THREE.Vector3(1, 0, 0),
      wakeCurves,
      wakeMarkerProgress,
    },
    geometry,
    mechanism:
      'Four buckets a pivot at equal radius on four shaft-driven arms b. Each bucket carries a crank c whose outer pin is linked to a four-arm ring d centered on the stationary eccentric e. The main pivot is O+R(theta)p_i while the control pin is E+R(theta)p_i, so their difference is the constant eccentric vector E. Every crank therefore remains horizontal and every broad bucket face remains vertical. At the side water crossings the vertical panels move edgewise; along the submerged bottom arc they present their broad faces for propulsion.',
    motion: {
      backwardWaterDirection: new THREE.Vector3(-1, 0, 0),
      forwardVesselDirection: new THREE.Vector3(1, 0, 0),
      rotationAxis: new THREE.Vector3(0, 0, 1),
      rotationSenseViewedFromPositiveZ: 'clockwise',
      shaftAngularVelocityVector:
        new THREE.Vector3(0, 0, angularVelocityZ),
    },
    sourceAnimation: {
      available: true,
      officialBucketTranslationWithoutRotation: true,
      officialCanvasModelPresent: true,
      officialControlRingRotationMultiplier: -1,
      officialCyclePeriodSecond: cycleDuration,
      officialCyclesPerMinute,
      officialMainRotorRotationMultiplier: -1,
      sourcePrescribedAbsoluteTiming: true,
    },
    sourceReference: {
      brownPlate489: {
        approximateEccentricCenterPixels: [281, 275],
        approximateMainShaftCenterPixels: [248, 275],
        approximateOuterBucketPivotPixels: [137, 161, 366, 161, 366, 390, 137, 390],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 7,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'four buckets a are pivoted at equal radius into arms b',
          'bucket cranks c connect to arms of ring d',
          'ring d fits loosely around stationary eccentric e',
          'the linkage keeps all buckets upright',
          'upright buckets enter and leave water edgewise and work broad-face while immersed',
        ],
        engravingEvidence:
          'Brown shows four vertical bucket boards, four pivots on diagonal shaft arms, four short same-direction cranks, a large control ring and four ring arms, and an eccentric whose center is visibly displaced to the right of the main shaft.',
        officialAnimationEvidence:
          'The official canvas uses four arm pivots at radius 12, eccentric offset 3, fixed eccentric radius 5, control-ring radius 7, clockwise multipliers of minus one for both rotors, 15 cycles per minute, and pure translation with zero rotation for every bucket.',
        reconstructionDisclosure:
          'The four buckets, equal-radius shaft arms, bucket pivots, equal parallel cranks, loose control ring, fixed eccentric, upright orientation, edgewise crossings, broad-face submerged work, exact official proportions, and source timing are source-grounded. Axial widths, supports, waterline, physical scale, hydrodynamic coefficients, colors, flow paths, and chosen vessel direction are independently engineered and exposed.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 489',
    },
    stateAtTime,
    transmission: {
      crankClosure:
        'p_i=O+R(theta)p_i0; q_i=E+R(theta)p_i0; q_i-p_i=E-O=(eccentricOffset,0) for all theta',
      orientationConstraint:
        'theta_bucket_i=atan2((q_i-p_i)_y,(q_i-p_i)_x)=0; omega_bucket_i=0',
      powerBalance:
        'tau_engine,z+tau_water,z=0 at prescribed uniform omega_z; P_input=tau_engine,z*omega_z',
      ringConstraint:
        'theta_ring=theta_main; ring center E and eccentric e are fixed while ring d rotates loosely about E',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.47, -3.30, -2.14),
    new THREE.Vector3(4.42, 3.58, 2.14),
  );
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraDirection = new THREE.Vector3(2.6, 1.8, 12);
  root.userData.groundFloorY = -3.30;
  markShadows(root);
  waterVolume.castShadow = false;
  waterSurface.castShadow = false;
  wakeMarkerSets.flat().forEach((marker) => {
    marker.castShadow = false;
  });
  fitPistonGuide(root, update, cycleDuration);
  // Frame only what Brown draws: the stand, base, water, wake, flow arrows
  // and white indices are removed by source presentation.
  root.userData.cameraFitBounds = drawnMotionBounds(root, update, cycleDuration);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export const FEATHERING_WHEEL_UNDRAWN_ROLE =
  /^(?:fixed-main-bearing-support-leg-(?:left|right)|fixed-feathering-wheel-base|fixed-water-volume-under-feathering-buckets|fixed-waterline-crossed-edgewise-by-upright-buckets|fixed-negative-x-feathering-wheel-wake-path-\d|negative-x-water-marker-\d-\d|fixed-(?:negative-x-water-reaction|positive-x-vessel-thrust)-arrow|white-index-(?:on-fixed-eccentric-center|fixed-to-main-shaft|fixed-to-control-ring-d))$/;

function drawnMotionBounds(root, update, period) {
  const bounds = new THREE.Box3();
  const drawn = (object) => {
    for (let o = object; o && o !== root; o = o.parent) {
      if (FEATHERING_WHEEL_UNDRAWN_ROLE.test(o.userData.role ?? '')) return false;
    }
    return true;
  };
  for (let i = 0; i <= 64; i += 1) {
    update(period * i / 64);
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      if (!object.isMesh || !drawn(object)) return;
      object.geometry.computeBoundingBox();
      bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
    });
  }
  update(0);
  return bounds.expandByScalar(0.03);
}

export function createAuthoredFeatheringPaddleWheelMovement(movement) {
  if (movement.id !== 489) return null;
  return featheringPaddleWheel(movement);
}
