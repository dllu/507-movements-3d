import * as THREE from 'three';
import { makePitchBevelGear } from './authored-governors.js';
import {
  PALETTE,
  makeBeam,
  makeGear,
  markShadows,
  matte,
} from './primitives.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongX(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongY(radius, length, material, segments = 36) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function radialPoint(angle, radius, y) {
  return new THREE.Vector3(
    radius * Math.cos(angle),
    y,
    -radius * Math.sin(angle),
  );
}

function wrapSignedAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function waterWheelReversingGovernorMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Measurements from the 525 px public-domain plate. The illustrated pose
  // is the proper-speed neutral condition: neither lower loose bevel is
  // engaged, and the lower horizontal gate shaft is stationary.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterSpindleAxisX = 263;
  const sourceRasterTopPivotLeft = new THREE.Vector2(247, 55);
  const sourceRasterTopPivotRight = new THREE.Vector2(279, 55);
  const sourceRasterElbowLeft = new THREE.Vector2(205, 160);
  const sourceRasterElbowRight = new THREE.Vector2(320, 160);
  const sourceRasterBallLeft = new THREE.Vector2(178, 232);
  const sourceRasterBallRight = new THREE.Vector2(347, 231);
  const sourceRasterBallRadius = 34;
  const sourceRasterGovernorSleeveLeft = new THREE.Vector2(248, 250);
  const sourceRasterGovernorSleeveRight = new THREE.Vector2(278, 250);
  const sourceRasterInputApex = new THREE.Vector2(263, 316);
  const sourceRasterInputShaftEnd = new THREE.Vector2(136, 316);
  const sourceRasterLowerTrainApex = new THREE.Vector2(263, 414);
  const sourceRasterOutputShaftEnd = new THREE.Vector2(125, 414);
  const sourceRasterUpperLooseGearFaceY = 378;
  const sourceRasterLowerLooseGearFaceY = 451;
  const sourceUnitsPerPixel = 0.018;
  const sourceInputShaftReach = (
    sourceRasterSpindleAxisX - sourceRasterInputShaftEnd.x
  ) * sourceUnitsPerPixel;
  const sourceOutputShaftReach = (
    sourceRasterSpindleAxisX - sourceRasterOutputShaftEnd.x
  ) * sourceUnitsPerPixel;
  const topPivotY = 4.3;
  const sourcePointFromRaster = (point) => new THREE.Vector2(
    (point.x - sourceRasterSpindleAxisX) * sourceUnitsPerPixel,
    topPivotY
      + (sourceRasterTopPivotLeft.y - point.y) * sourceUnitsPerPixel,
  );
  const sourceTopPivotLeft = sourcePointFromRaster(
    sourceRasterTopPivotLeft,
  );
  const sourceElbowLeft = sourcePointFromRaster(sourceRasterElbowLeft);
  const sourceBallLeft = sourcePointFromRaster(sourceRasterBallLeft);
  const sourceGovernorSleeveLeft = sourcePointFromRaster(
    sourceRasterGovernorSleeveLeft,
  );
  const inputApex2 = sourcePointFromRaster(sourceRasterInputApex);
  const lowerTrainApex2 = sourcePointFromRaster(
    sourceRasterLowerTrainApex,
  );
  const inputApex = new THREE.Vector3(0, inputApex2.y, 0);
  const lowerTrainApex = new THREE.Vector3(0, lowerTrainApex2.y, 0);

  const topPivotRadius = 0.288;
  const upperArmLength = 3.414;
  const elbowArmLength = 2.035;
  const lowerLinkLength = 1.787;
  const sleevePinRadius = 0.270;
  const nominalSpreadAngle = 0.375;
  const ballRadius = sourceRasterBallRadius * sourceUnitsPerPixel;
  const ballIndexRadialOffset = ballRadius * 0.92;
  const ballMass = 1;
  const gravityAcceleration = 9.81;
  const equilibriumAtSpreadAngle = (spreadAngle) => {
    const sine = Math.sin(spreadAngle);
    const cosine = Math.cos(spreadAngle);
    const ballOrbitRadius = topPivotRadius + upperArmLength * sine;
    const ballCenterY = topPivotY - upperArmLength * cosine;
    const elbowOrbitRadius = topPivotRadius + elbowArmLength * sine;
    const elbowY = topPivotY - elbowArmLength * cosine;
    const lowerHorizontalOffset = elbowOrbitRadius - sleevePinRadius;
    const lowerVerticalDrop = Math.sqrt(
      lowerLinkLength ** 2 - lowerHorizontalOffset ** 2,
    );
    const sleeveY = elbowY - lowerVerticalDrop;
    const spindleAngularSpeed = Math.sqrt(
      gravityAcceleration * Math.tan(spreadAngle) / ballOrbitRadius,
    );
    return {
      ballCenterY,
      ballOrbitRadius,
      elbowOrbitRadius,
      elbowY,
      lowerHorizontalOffset,
      lowerVerticalDrop,
      sleeveY,
      spindleAngularSpeed,
      spreadAngle,
    };
  };
  const nominalEquilibrium = equilibriumAtSpreadAngle(nominalSpreadAngle);
  const nominalSpindleAngularSpeed = nominalEquilibrium.spindleAngularSpeed;
  const spindleAngularSpeedAmplitude = 0.06;
  const spindleTurnsPerSpeedCycle = 2;
  const speedCyclePeriod = spindleTurnsPerSpeedCycle * fullTurn
    / nominalSpindleAngularSpeed;
  const speedCycleAngularFrequency = fullTurn / speedCyclePeriod;
  const minimumSpindleAngularSpeed = nominalSpindleAngularSpeed
    - spindleAngularSpeedAmplitude;
  const maximumSpindleAngularSpeed = nominalSpindleAngularSpeed
    + spindleAngularSpeedAmplitude;
  const equilibriumIterations = 60;
  const spreadAngleAtSpindleSpeed = (spindleAngularSpeed) => {
    let lower = 0.20;
    let upper = 0.56;
    const residual = (spreadAngle) => {
      const orbitRadius = topPivotRadius
        + upperArmLength * Math.sin(spreadAngle);
      return gravityAcceleration * Math.tan(spreadAngle)
        - spindleAngularSpeed ** 2 * orbitRadius;
    };
    let lowerResidual = residual(lower);
    const upperResidual = residual(upper);
    if (lowerResidual * upperResidual > 0) {
      throw new RangeError('Movement 162 lost its flyball equilibrium branch.');
    }
    for (let iteration = 0; iteration < equilibriumIterations; iteration += 1) {
      const middle = (lower + upper) / 2;
      const middleResidual = residual(middle);
      if (lowerResidual * middleResidual <= 0) {
        upper = middle;
      } else {
        lower = middle;
        lowerResidual = middleResidual;
      }
    }
    return (lower + upper) / 2;
  };
  const minimumSpreadAngle = spreadAngleAtSpindleSpeed(
    minimumSpindleAngularSpeed,
  );
  const maximumSpreadAngle = spreadAngleAtSpindleSpeed(
    maximumSpindleAngularSpeed,
  );
  const minimumEquilibrium = equilibriumAtSpreadAngle(minimumSpreadAngle);
  const maximumEquilibrium = equilibriumAtSpreadAngle(maximumSpreadAngle);

  // The lower dog has the shorter neutral clearance visible in the plate.
  // Solve the upper threshold so the unequal high/low spindle speeds produce
  // equal and opposite output travel over one complete demonstration cycle.
  const lowerEngagementThreshold = 0.28;
  const spindleTravelForEpisode = (threshold, speedSign) => {
    const alpha = Math.asin(threshold);
    return (
      nominalSpindleAngularSpeed * (Math.PI - 2 * alpha)
        + speedSign * 2 * spindleAngularSpeedAmplitude * Math.cos(alpha)
    ) / speedCycleAngularFrequency;
  };
  const lowerEngagedSpindleTravel = spindleTravelForEpisode(
    lowerEngagementThreshold,
    -1,
  );
  let upperThresholdLower = lowerEngagementThreshold;
  let upperThresholdUpper = 0.95;
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const middle = (upperThresholdLower + upperThresholdUpper) / 2;
    if (spindleTravelForEpisode(middle, 1)
      > lowerEngagedSpindleTravel) {
      upperThresholdLower = middle;
    } else {
      upperThresholdUpper = middle;
    }
  }
  const upperEngagementThreshold = (
    upperThresholdLower + upperThresholdUpper
  ) / 2;
  const upperEngagementPhase = Math.asin(upperEngagementThreshold);
  const lowerEngagementPhase = Math.asin(lowerEngagementThreshold);
  const upperEngagedSpindleTravel = spindleTravelForEpisode(
    upperEngagementThreshold,
    1,
  );
  const engagementTravelMismatch = upperEngagedSpindleTravel
    - lowerEngagedSpindleTravel;
  const highEngagementStartPhase = upperEngagementPhase;
  const highEngagementEndPhase = Math.PI - upperEngagementPhase;
  const lowEngagementStartPhase = Math.PI + lowerEngagementPhase;
  const lowEngagementEndPhase = fullTurn - lowerEngagementPhase;
  const phaseToTime = (phase) => phase / speedCycleAngularFrequency;

  const spindleAngleAtTime = (time) => (
    nominalSpindleAngularSpeed * time
      + spindleAngularSpeedAmplitude * (
        1 - Math.cos(speedCycleAngularFrequency * time)
      ) / speedCycleAngularFrequency
  );
  const spindleTravelBetweenPhases = (startPhase, endPhase) => (
    nominalSpindleAngularSpeed * (endPhase - startPhase)
      + spindleAngularSpeedAmplitude * (
        Math.cos(startPhase) - Math.cos(endPhase)
      )
  ) / speedCycleAngularFrequency;
  const outputStateAtPhase = (phase, spindleAngularSpeed,
    spindleAngularAcceleration) => {
    if (phase < highEngagementStartPhase) {
      return {
        lowerDogEngaged: false,
        outputAngularAcceleration: 0,
        outputAngularDisplacement: 0,
        outputAngularSpeed: 0,
        upperDogEngaged: false,
      };
    }
    if (phase < highEngagementEndPhase) {
      return {
        lowerDogEngaged: false,
        outputAngularAcceleration: -spindleAngularAcceleration,
        outputAngularDisplacement: -spindleTravelBetweenPhases(
          highEngagementStartPhase,
          phase,
        ),
        outputAngularSpeed: -spindleAngularSpeed,
        upperDogEngaged: true,
      };
    }
    if (phase < lowEngagementStartPhase) {
      return {
        lowerDogEngaged: false,
        outputAngularAcceleration: 0,
        outputAngularDisplacement: -upperEngagedSpindleTravel,
        outputAngularSpeed: 0,
        upperDogEngaged: false,
      };
    }
    if (phase < lowEngagementEndPhase) {
      return {
        lowerDogEngaged: true,
        outputAngularAcceleration: spindleAngularAcceleration,
        outputAngularDisplacement: -upperEngagedSpindleTravel
          + spindleTravelBetweenPhases(lowEngagementStartPhase, phase),
        outputAngularSpeed: spindleAngularSpeed,
        upperDogEngaged: false,
      };
    }
    return {
      lowerDogEngaged: false,
      outputAngularAcceleration: 0,
      outputAngularDisplacement: 0,
      outputAngularSpeed: 0,
      upperDogEngaged: false,
    };
  };

  const topInputAxis = X_AXIS.clone().negate();
  const topDrivenAxis = Y_AXIS.clone();
  const topGearTeeth = 22;
  const topGearOuterDistance = 0.66;
  const topPitchRadius = 0.66;
  const topPitchConeAngle = Math.PI / 4;
  const topGearContactPoint = inputApex.clone()
    .addScaledVector(topInputAxis, topGearOuterDistance)
    .addScaledVector(topDrivenAxis, topGearOuterDistance);
  const topInputGear = makePitchBevelGear({
    axis: topInputAxis,
    color: PALETTE.driver,
    innerDistance: topGearOuterDistance * 0.34,
    outerDistance: topGearOuterDistance,
    pitchConeAngle: topPitchConeAngle,
    teeth: topGearTeeth,
    toothHeight: 0.105,
  });
  topInputGear.position.copy(inputApex);
  topInputGear.userData.role =
    'upper-horizontal-engine-input-bevel-gear';
  const topInputGearRotor = topInputGear.userData.rotor;
  const topDrivenGear = makePitchBevelGear({
    axis: topDrivenAxis,
    color: PALETTE.driven,
    innerDistance: topGearOuterDistance * 0.34,
    outerDistance: topGearOuterDistance,
    pitchConeAngle: topPitchConeAngle,
    teeth: topGearTeeth,
    toothHeight: 0.105,
  });
  topDrivenGear.position.copy(inputApex);
  topDrivenGear.userData.role =
    'upper-bevel-gear-fixed-to-governor-spindle';
  const topDrivenGearRotor = topDrivenGear.userData.rotor;

  const upperLooseGearAxis = Y_AXIS.clone();
  const lowerLooseGearAxis = Y_AXIS.clone().negate();
  const lowerOutputAxis = X_AXIS.clone().negate();
  const lowerGearTeeth = 24;
  const lowerGearOuterDistance = 0.70;
  const lowerGearPitchRadius = 0.70;
  const lowerGearPitchConeAngle = Math.PI / 4;
  const upperMeshContactPoint = lowerTrainApex.clone()
    .addScaledVector(upperLooseGearAxis, lowerGearOuterDistance)
    .addScaledVector(lowerOutputAxis, lowerGearOuterDistance);
  const lowerMeshContactPoint = lowerTrainApex.clone()
    .addScaledVector(lowerLooseGearAxis, lowerGearOuterDistance)
    .addScaledVector(lowerOutputAxis, lowerGearOuterDistance);
  const upperLooseGear = makePitchBevelGear({
    axis: upperLooseGearAxis,
    color: PALETTE.driven,
    innerDistance: lowerGearOuterDistance * 0.35,
    outerDistance: lowerGearOuterDistance,
    pitchConeAngle: lowerGearPitchConeAngle,
    teeth: lowerGearTeeth,
    toothHeight: 0.115,
  });
  upperLooseGear.position.copy(lowerTrainApex);
  upperLooseGear.userData.looseOnSpindle = true;
  upperLooseGear.userData.role =
    'upper-loose-studded-bevel-gear-for-gate-closing';
  const upperLooseGearRotor = upperLooseGear.userData.rotor;
  const lowerLooseGear = makePitchBevelGear({
    axis: lowerLooseGearAxis,
    color: PALETTE.driven,
    innerDistance: lowerGearOuterDistance * 0.35,
    outerDistance: lowerGearOuterDistance,
    pitchConeAngle: lowerGearPitchConeAngle,
    teeth: lowerGearTeeth,
    toothHeight: 0.115,
  });
  lowerLooseGear.position.copy(lowerTrainApex);
  lowerLooseGear.userData.looseOnSpindle = true;
  lowerLooseGear.userData.role =
    'lower-loose-studded-bevel-gear-for-gate-opening';
  const lowerLooseGearRotor = lowerLooseGear.userData.rotor;
  const lowerOutputGear = makePitchBevelGear({
    axis: lowerOutputAxis,
    color: PALETTE.accent,
    innerDistance: lowerGearOuterDistance * 0.35,
    outerDistance: lowerGearOuterDistance,
    pitchConeAngle: lowerGearPitchConeAngle,
    teeth: lowerGearTeeth,
    toothHeight: 0.115,
  });
  lowerOutputGear.position.copy(lowerTrainApex);
  lowerOutputGear.userData.doubleMesh = true;
  lowerOutputGear.userData.role =
    'single-horizontal-output-bevel-meshing-both-loose-gears';
  const lowerOutputGearRotor = lowerOutputGear.userData.rotor;

  const localContactAngle = (gear, point) => {
    const localPoint = point.clone().sub(gear.position).applyQuaternion(
      gear.quaternion.clone().invert(),
    );
    return Math.atan2(localPoint.y, localPoint.x);
  };
  const topInputGearPhase = localContactAngle(
    topInputGear,
    topGearContactPoint,
  );
  const topDrivenGearPhase = localContactAngle(
    topDrivenGear,
    topGearContactPoint,
  ) - Math.PI / topGearTeeth;
  const lowerOutputGearPhase = localContactAngle(
    lowerOutputGear,
    upperMeshContactPoint,
  );
  const upperLooseGearPhase = localContactAngle(
    upperLooseGear,
    upperMeshContactPoint,
  ) - Math.PI / lowerGearTeeth;
  const lowerLooseGearPhase = localContactAngle(
    lowerLooseGear,
    lowerMeshContactPoint,
  ) - Math.PI / lowerGearTeeth;

  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.47,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.60,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.62,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.17,
    roughness: 0.54,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const shaftApexOverrun = 0.15;
  const topInputShaft = cylinderAlongZ(
    0.105,
    sourceInputShaftReach + shaftApexOverrun,
    darkMaterial,
    38,
  );
  topInputShaft.position.z = (
    sourceInputShaftReach - shaftApexOverrun
  ) / 2;
  topInputShaft.userData.role = 'continuous-upper-horizontal-input-shaft';
  topInputGearRotor.add(topInputShaft);
  const lowerOutputShaft = cylinderAlongZ(0.115, 4.0, darkMaterial, 38);
  lowerOutputShaft.position.z = 1.86;
  lowerOutputShaft.userData.role =
    'lower-horizontal-shaft-carrying-reversible-gate-output';
  lowerOutputGearRotor.add(lowerOutputShaft);

  const governorRotor = new THREE.Group();
  governorRotor.userData.axis = Y_AXIS.clone();
  governorRotor.userData.role =
    'continuously-rotating-flyball-spindle-and-selector-pin';
  const spindleTopY = 4.86;
  const spindleBottomY = -3.25;
  const spindle = cylinderAlongY(
    0.095,
    spindleTopY - spindleBottomY,
    darkMaterial,
    38,
  );
  spindle.position.y = (spindleTopY + spindleBottomY) / 2;
  spindle.userData.role = 'continuous-central-governor-spindle';
  const spindleIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.36, 0.05),
    indexMaterial,
  );
  spindleIndex.position.set(0.125, 3.35, 0);
  spindleIndex.userData.role = 'white-index-on-governor-spindle';
  const topHeadHub = cylinderAlongY(0.28, 0.38, drivenMaterial, 40);
  topHeadHub.position.y = topPivotY;
  topHeadHub.userData.role = 'fixed-to-spindle-upper-flyball-head';
  const topHeadCrossbar = makeBeam(
    new THREE.Vector3(-topPivotRadius, topPivotY, 0),
    new THREE.Vector3(topPivotRadius, topPivotY, 0),
    { color: PALETTE.driven, depth: 0.28, thickness: 0.18 },
  );
  topHeadCrossbar.userData.role = 'upper-head-crossbar-and-arm-pivots';
  governorRotor.add(spindle, spindleIndex, topHeadHub, topHeadCrossbar);

  const nominalSleeveY = nominalEquilibrium.sleeveY;
  const slidingSelectorAssembly = new THREE.Group();
  slidingSelectorAssembly.userData.role =
    'one-axially-sliding-rotating-assembly-from-governor-to-dog-pin';
  const governorSleeve = cylinderAlongY(0.29, 0.44, accentMaterial, 42);
  governorSleeve.position.y = nominalSleeveY;
  governorSleeve.userData.role = 'flyball-linkage-sliding-sleeve';
  const governorSleeveCrossbar = makeBeam(
    new THREE.Vector3(-sleevePinRadius, nominalSleeveY, 0),
    new THREE.Vector3(sleevePinRadius, nominalSleeveY, 0),
    { color: PALETTE.accent, depth: 0.28, thickness: 0.17 },
  );
  governorSleeveCrossbar.userData.role =
    'lower-link-pins-on-flyball-sleeve';
  const selectorLinkTopY = nominalSleeveY - 0.18;
  const selectorLinkBottomY = lowerTrainApex.y + 0.10;
  const selectorLinkRod = cylinderAlongY(
    0.065,
    selectorLinkTopY - selectorLinkBottomY,
    accentMaterial,
    28,
  );
  selectorLinkRod.position.y = (
    selectorLinkTopY + selectorLinkBottomY
  ) / 2;
  selectorLinkRod.userData.role =
    'rigid-vertical-link-from-flyball-sleeve-to-selector';
  const selectorSleeveHeight = 0.18;
  const selectorSleeve = cylinderAlongY(
    0.215,
    selectorSleeveHeight,
    accentMaterial,
    38,
  );
  selectorSleeve.position.y = lowerTrainApex.y;
  selectorSleeve.userData.role =
    'keyed-selector-sleeve-sliding-on-central-spindle';
  const selectorDogRadius = 0.49;
  const selectorDogHeight = 0.10;
  const selectorDog = makeBeam(
    new THREE.Vector3(0.15, lowerTrainApex.y, 0),
    new THREE.Vector3(selectorDogRadius, lowerTrainApex.y, 0),
    {
      color: PALETTE.accent,
      depth: 0.14,
      thickness: selectorDogHeight,
    },
  );
  selectorDog.userData.role =
    'single-spindle-fixed-radial-pin-selecting-upper-or-lower-stud';
  const selectorDogIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 14, 10),
    indexMaterial,
  );
  selectorDogIndex.position.set(selectorDogRadius, lowerTrainApex.y, 0);
  selectorDogIndex.userData.role = 'white-tip-on-rotating-selector-pin';
  slidingSelectorAssembly.add(
    governorSleeve,
    governorSleeveCrossbar,
    selectorLinkRod,
    selectorSleeve,
    selectorDog,
    selectorDogIndex,
  );
  governorRotor.add(slidingSelectorAssembly);

  const ballAssemblies = [-1, 1].map((sign, index) => {
    const upperPivot = new THREE.Vector3(sign * topPivotRadius, topPivotY, 0);
    const elbow = new THREE.Vector3(
      sign * nominalEquilibrium.elbowOrbitRadius,
      nominalEquilibrium.elbowY,
      0,
    );
    const ballPoint = new THREE.Vector3(
      sign * nominalEquilibrium.ballOrbitRadius,
      nominalEquilibrium.ballCenterY,
      0,
    );
    const sleevePin = new THREE.Vector3(
      sign * sleevePinRadius,
      nominalSleeveY,
      0,
    );
    const upperArm = makeBeam(upperPivot, ballPoint, {
      color: PALETTE.driven,
      depth: 0.14,
      thickness: 0.12,
    });
    upperArm.userData.role = `rigid-upper-flyball-arm-${index + 1}`;
    const lowerLink = makeBeam(elbow, sleevePin, {
      color: PALETTE.ink,
      depth: 0.13,
      thickness: 0.11,
    });
    lowerLink.userData.role = `fixed-length-sleeve-link-${index + 1}`;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(ballRadius, 40, 26),
      driverMaterial,
    );
    ball.position.copy(ballPoint);
    ball.userData.role = `centrifugal-water-governor-ball-${index + 1}`;
    const ballIndex = new THREE.Mesh(
      new THREE.SphereGeometry(0.10, 14, 10),
      indexMaterial,
    );
    ballIndex.position.set(
      sign * (nominalEquilibrium.ballOrbitRadius + ballIndexRadialOffset),
      nominalEquilibrium.ballCenterY,
      0,
    );
    ballIndex.userData.role = `white-orbit-index-on-water-ball-${index + 1}`;
    const topPivotHub = cylinderAlongZ(0.14, 0.36, darkMaterial, 28);
    topPivotHub.position.copy(upperPivot);
    const elbowHub = cylinderAlongZ(0.14, 0.35, darkMaterial, 28);
    elbowHub.position.copy(elbow);
    const sleevePinHub = cylinderAlongZ(0.125, 0.34, darkMaterial, 28);
    sleevePinHub.position.copy(sleevePin);
    topPivotHub.userData.role = `upper-flyball-pivot-${index + 1}`;
    elbowHub.userData.role = `flyball-elbow-pivot-${index + 1}`;
    sleevePinHub.userData.role = `flyball-sleeve-pin-${index + 1}`;
    governorRotor.add(
      upperArm,
      lowerLink,
      ball,
      ballIndex,
      topPivotHub,
      elbowHub,
      sleevePinHub,
    );
    return {
      ball,
      ballIndex,
      elbowHub,
      lowerLink,
      sign,
      sleevePinHub,
      topPivotHub,
      upperArm,
    };
  });

  const selectorOffsetAtCommand = (command) => {
    const angularSpeed = nominalSpindleAngularSpeed
      + spindleAngularSpeedAmplitude * command;
    const spreadAngle = spreadAngleAtSpindleSpeed(angularSpeed);
    return equilibriumAtSpreadAngle(spreadAngle).sleeveY - nominalSleeveY;
  };
  const upperDogContactOffset = selectorOffsetAtCommand(
    upperEngagementThreshold,
  );
  const lowerDogContactOffset = selectorOffsetAtCommand(
    -lowerEngagementThreshold,
  );
  const upperStudBottomOffset = upperDogContactOffset
    + selectorDogHeight / 2;
  const lowerStudTopOffset = lowerDogContactOffset
    - selectorDogHeight / 2;
  const looseGearInnerDistance = lowerGearOuterDistance * 0.35;
  const upperStudLength = looseGearInnerDistance - upperStudBottomOffset;
  const lowerStudLength = looseGearInnerDistance + lowerStudTopOffset;
  const highEngagementStartTime = phaseToTime(highEngagementStartPhase);
  const lowEngagementStartTime = phaseToTime(lowEngagementStartPhase);
  const selectorAngleAtHighEngagement = spindleAngleAtTime(
    highEngagementStartTime,
  );
  const selectorAngleAtLowEngagement = spindleAngleAtTime(
    lowEngagementStartTime,
  );
  const upperStudLocalAngle = wrapSignedAngle(
    selectorAngleAtHighEngagement - upperLooseGearPhase,
  );
  const lowerRotorAngleAtLowEngagement = lowerLooseGearPhase
    + upperEngagedSpindleTravel;
  const lowerStudLocalAngle = wrapSignedAngle(
    -selectorAngleAtLowEngagement - lowerRotorAngleAtLowEngagement,
  );
  const upperStud = cylinderAlongZ(0.085, upperStudLength, darkMaterial, 24);
  upperStud.position.set(
    selectorDogRadius * Math.cos(upperStudLocalAngle),
    selectorDogRadius * Math.sin(upperStudLocalAngle),
    (looseGearInnerDistance + upperStudBottomOffset) / 2,
  );
  upperStud.userData.role = 'downward-stud-on-upper-loose-bevel-gear';
  upperLooseGearRotor.add(upperStud);
  const lowerStud = cylinderAlongZ(0.085, lowerStudLength, darkMaterial, 24);
  lowerStud.position.set(
    selectorDogRadius * Math.cos(lowerStudLocalAngle),
    selectorDogRadius * Math.sin(lowerStudLocalAngle),
    (looseGearInnerDistance - lowerStudTopOffset) / 2,
  );
  lowerStud.userData.role = 'upward-stud-on-lower-loose-bevel-gear';
  lowerLooseGearRotor.add(lowerStud);

  const gateStroke = 1.0;
  const gateRackPitchRadius = gateStroke / upperEngagedSpindleTravel;
  const gatePinionTeeth = 12;
  const gateX = -3.45;
  const gatePinion = makeGear({
    axis: lowerOutputAxis,
    color: PALETTE.accent,
    depth: 0.28,
    radius: gateRackPitchRadius,
    teeth: gatePinionTeeth,
    toothHeight: 0.08,
  });
  gatePinion.position.set(gateX, lowerTrainApex.y, 0);
  gatePinion.userData.role =
    'output-shaft-pinion-driving-vertical-water-gate-rack';
  const gatePinionRotor = gatePinion.userData.rotor;
  const gatePinionIndex = gatePinionRotor.children.at(-1);
  gatePinionIndex.userData.role =
    'white-face-index-on-water-gate-pinion';
  const gatePinionPhase = 0;
  const gatePortCenterY = -3.68;
  const gatePortHeight = 1.0;
  const gatePortBottomY = gatePortCenterY - gatePortHeight / 2;
  const gateHeight = gatePortHeight;
  const gateLowCenterY = gatePortBottomY - gateHeight / 2;
  const gateRackLength = 3.1;
  const gateToRackCenterOffset = -2.0;
  const gateRackLowCenterY = gateLowCenterY - gateToRackCenterOffset;
  const gateSlide = new THREE.Group();
  gateSlide.position.y = gateRackLowCenterY;
  gateSlide.userData.role =
    'vertically-guided-rack-and-water-shuttle-assembly';
  const gatePlate = new THREE.Mesh(
    new THREE.BoxGeometry(1.62, gateHeight, 0.16),
    driverMaterial,
  );
  gatePlate.position.set(gateX, gateToRackCenterOffset, -0.74);
  gatePlate.userData.role =
    'rising-water-shuttle-that-reduces-port-opening';
  const gateIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.06, 0.025),
    indexMaterial,
  );
  gateIndex.position.set(0, 0, 0.095);
  gateIndex.userData.role = 'white-index-on-water-gate';
  gatePlate.add(gateIndex);
  const gateRackSpine = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, gateRackLength, 0.14),
    accentMaterial,
  );
  gateRackSpine.position.set(gateX, 0, -gateRackPitchRadius - 0.10);
  gateRackSpine.userData.role = 'vertical-gate-rack-spine';
  const rackToothPitch = fullTurn * gateRackPitchRadius / gatePinionTeeth;
  const rackToothCount = Math.floor(gateRackLength / rackToothPitch);
  const gateRackTeeth = Array.from({ length: rackToothCount }, (_, index) => {
    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, rackToothPitch * 0.55, 0.11),
      accentMaterial,
    );
    tooth.position.set(
      gateX,
      -gateRackLength / 2 + (index + 0.5) * rackToothPitch,
      -gateRackPitchRadius + 0.005,
    );
    tooth.userData.role = 'working-tooth-on-vertical-water-gate-rack';
    return tooth;
  });
  gateSlide.add(gatePlate, gateRackSpine, ...gateRackTeeth);

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-bearing-frame-and-water-gate-channel';
  const frameZ = -3.50;
  const baseY = -5.18;
  const baseRail = makeBeam(
    new THREE.Vector3(-5.05, baseY, frameZ),
    new THREE.Vector3(2.65, baseY, frameZ),
    { color: PALETTE.frame, depth: 0.28, thickness: 0.20 },
  );
  baseRail.userData.role = 'fixed-base-for-governor-and-gate';
  const rearStandard = makeBeam(
    new THREE.Vector3(0, baseY, frameZ),
    new THREE.Vector3(0, spindleTopY + 0.40, frameZ),
    { color: PALETTE.frame, depth: 0.25, thickness: 0.17 },
  );
  rearStandard.userData.role = 'rear-standard-outside-ball-sweep';
  const topInputBearingArm = makeBeam(
    new THREE.Vector3(-1.05, inputApex.y, frameZ),
    new THREE.Vector3(-1.05, inputApex.y, -0.50),
    { color: PALETTE.frame, depth: 0.20, thickness: 0.15 },
  );
  topInputBearingArm.userData.role = 'support-to-upper-horizontal-bearing';
  const topInputBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.06, 10, 38),
    frameMaterial,
  );
  topInputBearing.rotation.y = Math.PI / 2;
  topInputBearing.position.set(-1.05, inputApex.y, -0.50);
  topInputBearing.userData.role = 'upper-horizontal-input-shaft-bearing';
  const lowerOutputBearingArm = makeBeam(
    new THREE.Vector3(-1.35, lowerTrainApex.y, frameZ),
    new THREE.Vector3(-1.35, lowerTrainApex.y, -0.52),
    { color: PALETTE.frame, depth: 0.20, thickness: 0.15 },
  );
  lowerOutputBearingArm.userData.role = 'support-to-lower-output-bearing';
  const lowerOutputBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.20, 0.065, 10, 38),
    frameMaterial,
  );
  lowerOutputBearing.rotation.y = Math.PI / 2;
  lowerOutputBearing.position.set(-1.35, lowerTrainApex.y, -0.52);
  lowerOutputBearing.userData.role = 'lower-horizontal-output-shaft-bearing';
  const upperVerticalBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.06, 10, 38),
    frameMaterial,
  );
  upperVerticalBearing.rotation.x = Math.PI / 2;
  upperVerticalBearing.position.set(0, topPivotY + 0.50, -0.32);
  upperVerticalBearing.userData.role = 'upper-governor-spindle-bearing';
  const upperVerticalBearingArm = makeBeam(
    new THREE.Vector3(0, topPivotY + 0.50, frameZ),
    upperVerticalBearing.position,
    { color: PALETTE.frame, depth: 0.20, thickness: 0.15 },
  );
  upperVerticalBearingArm.userData.role =
    'support-to-upper-governor-spindle-bearing';
  const lowerVerticalBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.06, 10, 38),
    frameMaterial,
  );
  lowerVerticalBearing.rotation.x = Math.PI / 2;
  lowerVerticalBearing.position.set(0, lowerTrainApex.y - 1.02, -0.32);
  lowerVerticalBearing.userData.role = 'lower-governor-spindle-bearing';
  const lowerVerticalBearingArm = makeBeam(
    new THREE.Vector3(0, lowerTrainApex.y - 1.02, frameZ),
    lowerVerticalBearing.position,
    { color: PALETTE.frame, depth: 0.20, thickness: 0.15 },
  );
  lowerVerticalBearingArm.userData.role =
    'support-to-lower-governor-spindle-bearing';
  const waterDuctWidth = 2.20;
  const leftWaterDuct = new THREE.Mesh(
    new THREE.BoxGeometry(waterDuctWidth, 1.30, 0.82),
    drivenMaterial,
  );
  leftWaterDuct.position.set(gateX - 1.91, gatePortCenterY, -1.12);
  leftWaterDuct.userData.role = 'upstream-water-channel-to-gate';
  const rightWaterDuct = leftWaterDuct.clone();
  rightWaterDuct.position.x = gateX + 1.91;
  rightWaterDuct.userData.role = 'downstream-water-channel-from-gate';
  const waterPort = new THREE.Mesh(
    new THREE.BoxGeometry(1.68, gatePortHeight, 0.18),
    darkMaterial,
  );
  waterPort.position.set(gateX, gatePortCenterY, -0.86);
  waterPort.userData.role = 'visible-water-port-restricted-by-rising-gate';
  const gateGuideLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, gateStroke + gateHeight + 0.34, 0.34),
    frameMaterial,
  );
  gateGuideLeft.position.set(
    gateX - 0.91,
    gatePortCenterY + gateStroke / 2,
    -0.72,
  );
  const gateGuideRight = gateGuideLeft.clone();
  gateGuideRight.position.x = gateX + 0.91;
  gateGuideLeft.userData.role = 'left-fixed-water-gate-guide';
  gateGuideRight.userData.role = 'right-fixed-water-gate-guide';
  fixedFrame.add(
    baseRail,
    rearStandard,
    topInputBearingArm,
    topInputBearing,
    lowerOutputBearingArm,
    lowerOutputBearing,
    upperVerticalBearingArm,
    upperVerticalBearing,
    lowerVerticalBearingArm,
    lowerVerticalBearing,
    leftWaterDuct,
    rightWaterDuct,
    waterPort,
    gateGuideLeft,
    gateGuideRight,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(10.8, 11.5, 7.4),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-1.15, 0.15, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-governor-gears-and-complete-gate-stroke';

  root.add(
    cameraEnvelope,
    fixedFrame,
    topInputGear,
    topDrivenGear,
    upperLooseGear,
    lowerLooseGear,
    lowerOutputGear,
    governorRotor,
    gatePinion,
    gateSlide,
  );

  const rotatingPointKinematics = ({
    angle,
    angularAcceleration,
    angularSpeed,
    radius,
    radialAcceleration = 0,
    radialSpeed = 0,
    verticalAcceleration = 0,
    verticalSpeed = 0,
    y,
  }) => {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const centripetalRadial = radialAcceleration
      - radius * angularSpeed ** 2;
    const coriolisTangential = 2 * radialSpeed * angularSpeed
      + radius * angularAcceleration;
    return {
      acceleration: new THREE.Vector3(
        centripetalRadial * cosine - coriolisTangential * sine,
        verticalAcceleration,
        -centripetalRadial * sine - coriolisTangential * cosine,
      ),
      position: radialPoint(angle, radius, y),
      velocity: new THREE.Vector3(
        radialSpeed * cosine - radius * angularSpeed * sine,
        verticalSpeed,
        -radialSpeed * sine - radius * angularSpeed * cosine,
      ),
    };
  };

  const stateAtTime = (time) => {
    const rawCyclePhase = speedCycleAngularFrequency * time;
    const cyclePhase = (
      (rawCyclePhase % fullTurn) + fullTurn
    ) % fullTurn;
    const speedCommand = Math.sin(rawCyclePhase);
    const speedCommandRate = speedCycleAngularFrequency
      * Math.cos(rawCyclePhase);
    const speedCommandAcceleration = -(speedCycleAngularFrequency ** 2)
      * Math.sin(rawCyclePhase);
    const spindleAngularSpeed = nominalSpindleAngularSpeed
      + spindleAngularSpeedAmplitude * speedCommand;
    const spindleAngularAcceleration = spindleAngularSpeedAmplitude
      * speedCommandRate;
    const spindleAngularJerk = spindleAngularSpeedAmplitude
      * speedCommandAcceleration;
    const spindleAngle = spindleAngleAtTime(time);
    const spreadAngle = spreadAngleAtSpindleSpeed(spindleAngularSpeed);
    const sine = Math.sin(spreadAngle);
    const cosine = Math.cos(spreadAngle);
    const tangent = Math.tan(spreadAngle);
    const secantSquared = 1 / cosine ** 2;
    const ballOrbitRadius = topPivotRadius + upperArmLength * sine;
    const equilibriumAngleSlope = gravityAcceleration * secantSquared
      - spindleAngularSpeed ** 2 * upperArmLength * cosine;
    const equilibriumOmegaSlope = -2 * spindleAngularSpeed
      * ballOrbitRadius;
    const spreadAngularSpeed = -equilibriumOmegaSlope
      * spindleAngularAcceleration / equilibriumAngleSlope;
    const equilibriumAngleCurvature = 2 * gravityAcceleration
      * secantSquared * tangent
      + spindleAngularSpeed ** 2 * upperArmLength * sine;
    const equilibriumMixedSlope = -2 * spindleAngularSpeed
      * upperArmLength * cosine;
    const equilibriumOmegaCurvature = -2 * ballOrbitRadius;
    const spreadAngularAcceleration = -(
      equilibriumAngleCurvature * spreadAngularSpeed ** 2
      + 2 * equilibriumMixedSlope * spreadAngularSpeed
        * spindleAngularAcceleration
      + equilibriumOmegaCurvature * spindleAngularAcceleration ** 2
      + equilibriumOmegaSlope * spindleAngularJerk
    ) / equilibriumAngleSlope;
    const ballCenterY = topPivotY - upperArmLength * cosine;
    const ballRadialSpeed = upperArmLength * cosine * spreadAngularSpeed;
    const ballVerticalSpeed = upperArmLength * sine * spreadAngularSpeed;
    const ballRadialAcceleration = upperArmLength * (
      -sine * spreadAngularSpeed ** 2
        + cosine * spreadAngularAcceleration
    );
    const ballVerticalAcceleration = upperArmLength * (
      cosine * spreadAngularSpeed ** 2
        + sine * spreadAngularAcceleration
    );
    const elbowOrbitRadius = topPivotRadius + elbowArmLength * sine;
    const elbowY = topPivotY - elbowArmLength * cosine;
    const elbowRadialSpeed = elbowArmLength * cosine * spreadAngularSpeed;
    const elbowVerticalSpeed = elbowArmLength * sine * spreadAngularSpeed;
    const elbowRadialAcceleration = elbowArmLength * (
      -sine * spreadAngularSpeed ** 2
        + cosine * spreadAngularAcceleration
    );
    const elbowVerticalAcceleration = elbowArmLength * (
      cosine * spreadAngularSpeed ** 2
        + sine * spreadAngularAcceleration
    );
    const lowerHorizontalOffset = elbowOrbitRadius - sleevePinRadius;
    const lowerHorizontalSpeed = elbowRadialSpeed;
    const lowerHorizontalAcceleration = elbowRadialAcceleration;
    const lowerVerticalDrop = Math.sqrt(
      lowerLinkLength ** 2 - lowerHorizontalOffset ** 2,
    );
    const sleeveY = elbowY - lowerVerticalDrop;
    const sleeveVelocityY = elbowVerticalSpeed
      + lowerHorizontalOffset * lowerHorizontalSpeed / lowerVerticalDrop;
    const sleeveAccelerationY = elbowVerticalAcceleration
      + (
        lowerHorizontalSpeed ** 2
          + lowerHorizontalOffset * lowerHorizontalAcceleration
      ) / lowerVerticalDrop
      + lowerHorizontalOffset ** 2 * lowerHorizontalSpeed ** 2
        / lowerVerticalDrop ** 3;
    const sleeveOffset = sleeveY - nominalSleeveY;
    const selectorDogY = lowerTrainApex.y + sleeveOffset;
    const selectorDogVelocityY = sleeveVelocityY;
    const selectorDogAccelerationY = sleeveAccelerationY;
    const outputState = outputStateAtPhase(
      cyclePhase,
      spindleAngularSpeed,
      spindleAngularAcceleration,
    );
    const {
      lowerDogEngaged,
      outputAngularAcceleration,
      outputAngularDisplacement,
      outputAngularSpeed,
      upperDogEngaged,
    } = outputState;
    const gateLift = -outputAngularDisplacement * gateRackPitchRadius;
    const gateVelocityY = -outputAngularSpeed * gateRackPitchRadius;
    const gateAccelerationY = -outputAngularAcceleration
      * gateRackPitchRadius;
    const gateRackCenterY = gateRackLowCenterY + gateLift;
    const gateCenterY = gateLowCenterY + gateLift;
    const gateRestrictedFraction = gateLift / gateStroke;
    const waterOpenFraction = 1 - gateRestrictedFraction;
    const topInputGearAngle = topInputGearPhase - spindleAngle;
    const topDrivenGearAngle = topDrivenGearPhase + spindleAngle;
    const upperLooseGearAngle = upperLooseGearPhase
      - outputAngularDisplacement;
    const lowerLooseGearAngle = lowerLooseGearPhase
      - outputAngularDisplacement;
    const lowerOutputGearAngle = lowerOutputGearPhase
      + outputAngularDisplacement;
    const gatePinionAngle = gatePinionPhase + outputAngularDisplacement;
    const looseGearAngularSpeed = -outputAngularSpeed;
    const looseGearAngularAcceleration = -outputAngularAcceleration;
    const topInputSurfaceVelocity = new THREE.Vector3()
      .crossVectors(topInputAxis, topGearContactPoint.clone().sub(inputApex))
      .multiplyScalar(-spindleAngularSpeed);
    const topDrivenSurfaceVelocity = new THREE.Vector3()
      .crossVectors(topDrivenAxis, topGearContactPoint.clone().sub(inputApex))
      .multiplyScalar(spindleAngularSpeed);
    const upperSurfaceVelocity = new THREE.Vector3()
      .crossVectors(
        upperLooseGearAxis,
        upperMeshContactPoint.clone().sub(lowerTrainApex),
      )
      .multiplyScalar(looseGearAngularSpeed);
    const outputUpperSurfaceVelocity = new THREE.Vector3()
      .crossVectors(
        lowerOutputAxis,
        upperMeshContactPoint.clone().sub(lowerTrainApex),
      )
      .multiplyScalar(outputAngularSpeed);
    const lowerSurfaceVelocity = new THREE.Vector3()
      .crossVectors(
        lowerLooseGearAxis,
        lowerMeshContactPoint.clone().sub(lowerTrainApex),
      )
      .multiplyScalar(looseGearAngularSpeed);
    const outputLowerSurfaceVelocity = new THREE.Vector3()
      .crossVectors(
        lowerOutputAxis,
        lowerMeshContactPoint.clone().sub(lowerTrainApex),
      )
      .multiplyScalar(outputAngularSpeed);
    const rackContactOffset = Z_AXIS.clone().multiplyScalar(
      -gateRackPitchRadius,
    );
    const pinionSurfaceVelocity = new THREE.Vector3()
      .crossVectors(lowerOutputAxis, rackContactOffset)
      .multiplyScalar(outputAngularSpeed);
    const gateRackVelocity = Y_AXIS.clone().multiplyScalar(gateVelocityY);
    const topInputTangentialAcceleration = new THREE.Vector3()
      .crossVectors(topInputAxis, topGearContactPoint.clone().sub(inputApex))
      .multiplyScalar(-spindleAngularAcceleration);
    const topDrivenTangentialAcceleration = new THREE.Vector3()
      .crossVectors(topDrivenAxis, topGearContactPoint.clone().sub(inputApex))
      .multiplyScalar(spindleAngularAcceleration);
    const upperTangentialAcceleration = new THREE.Vector3()
      .crossVectors(
        upperLooseGearAxis,
        upperMeshContactPoint.clone().sub(lowerTrainApex),
      )
      .multiplyScalar(looseGearAngularAcceleration);
    const outputUpperTangentialAcceleration = new THREE.Vector3()
      .crossVectors(
        lowerOutputAxis,
        upperMeshContactPoint.clone().sub(lowerTrainApex),
      )
      .multiplyScalar(outputAngularAcceleration);
    const lowerTangentialAcceleration = new THREE.Vector3()
      .crossVectors(
        lowerLooseGearAxis,
        lowerMeshContactPoint.clone().sub(lowerTrainApex),
      )
      .multiplyScalar(looseGearAngularAcceleration);
    const outputLowerTangentialAcceleration = new THREE.Vector3()
      .crossVectors(
        lowerOutputAxis,
        lowerMeshContactPoint.clone().sub(lowerTrainApex),
      )
      .multiplyScalar(outputAngularAcceleration);
    const pinionTangentialAcceleration = new THREE.Vector3()
      .crossVectors(lowerOutputAxis, rackContactOffset)
      .multiplyScalar(outputAngularAcceleration);
    const gateRackAcceleration = Y_AXIS.clone().multiplyScalar(
      gateAccelerationY,
    );
    const dogTopY = selectorDogY + selectorDogHeight / 2;
    const dogBottomY = selectorDogY - selectorDogHeight / 2;
    const upperStudBottomY = lowerTrainApex.y + upperStudBottomOffset;
    const upperStudTopY = lowerTrainApex.y + looseGearInnerDistance;
    const lowerStudTopY = lowerTrainApex.y + lowerStudTopOffset;
    const lowerStudBottomY = lowerTrainApex.y - looseGearInnerDistance;
    const upperDogAxialOverlap = Math.max(
      0,
      Math.min(dogTopY, upperStudTopY)
        - Math.max(dogBottomY, upperStudBottomY),
    );
    const lowerDogAxialOverlap = Math.max(
      0,
      Math.min(dogTopY, lowerStudTopY)
        - Math.max(dogBottomY, lowerStudBottomY),
    );
    const upperStudWorldAngle = upperLooseGearAngle + upperStudLocalAngle;
    const lowerStudWorldAngle = -(
      lowerLooseGearAngle + lowerStudLocalAngle
    );
    const selectorDogCenterPosition = radialPoint(
      spindleAngle,
      selectorDogRadius,
      selectorDogY,
    );
    const upperStudCenterPosition = radialPoint(
      upperStudWorldAngle,
      selectorDogRadius,
      (upperStudBottomY + upperStudTopY) / 2,
    );
    const lowerStudCenterPosition = radialPoint(
      lowerStudWorldAngle,
      selectorDogRadius,
      (lowerStudBottomY + lowerStudTopY) / 2,
    );
    const upperDogAngularAlignmentError = upperDogEngaged
      ? wrapSignedAngle(spindleAngle - upperStudWorldAngle)
      : 0;
    const lowerDogAngularAlignmentError = lowerDogEngaged
      ? wrapSignedAngle(spindleAngle - lowerStudWorldAngle)
      : 0;
    const upperDogSurfaceSpeedError = upperDogEngaged
      ? Math.abs(spindleAngularSpeed - looseGearAngularSpeed)
        * selectorDogRadius
      : 0;
    const lowerDogPhysicalAngularSpeed = -looseGearAngularSpeed;
    const lowerDogSurfaceSpeedError = lowerDogEngaged
      ? Math.abs(spindleAngularSpeed - lowerDogPhysicalAngularSpeed)
        * selectorDogRadius
      : 0;
    const ballStates = [-1, 1].map((sign, index) => {
      const angle = spindleAngle + (sign < 0 ? Math.PI : 0);
      const upperPivot = rotatingPointKinematics({
        angle,
        angularAcceleration: spindleAngularAcceleration,
        angularSpeed: spindleAngularSpeed,
        radius: topPivotRadius,
        y: topPivotY,
      });
      const elbow = rotatingPointKinematics({
        angle,
        angularAcceleration: spindleAngularAcceleration,
        angularSpeed: spindleAngularSpeed,
        radialAcceleration: elbowRadialAcceleration,
        radialSpeed: elbowRadialSpeed,
        radius: elbowOrbitRadius,
        verticalAcceleration: elbowVerticalAcceleration,
        verticalSpeed: elbowVerticalSpeed,
        y: elbowY,
      });
      const ball = rotatingPointKinematics({
        angle,
        angularAcceleration: spindleAngularAcceleration,
        angularSpeed: spindleAngularSpeed,
        radialAcceleration: ballRadialAcceleration,
        radialSpeed: ballRadialSpeed,
        radius: ballOrbitRadius,
        verticalAcceleration: ballVerticalAcceleration,
        verticalSpeed: ballVerticalSpeed,
        y: ballCenterY,
      });
      const sleevePin = rotatingPointKinematics({
        angle,
        angularAcceleration: spindleAngularAcceleration,
        angularSpeed: spindleAngularSpeed,
        radius: sleevePinRadius,
        verticalAcceleration: sleeveAccelerationY,
        verticalSpeed: sleeveVelocityY,
        y: sleeveY,
      });
      return {
        angle,
        ballAcceleration: ball.acceleration,
        ballPosition: ball.position,
        ballVelocity: ball.velocity,
        elbowAcceleration: elbow.acceleration,
        elbowPosition: elbow.position,
        elbowVelocity: elbow.velocity,
        index,
        localBall: new THREE.Vector3(
          sign * ballOrbitRadius,
          ballCenterY,
          0,
        ),
        localElbow: new THREE.Vector3(
          sign * elbowOrbitRadius,
          elbowY,
          0,
        ),
        localSleevePin: new THREE.Vector3(
          sign * sleevePinRadius,
          sleeveY,
          0,
        ),
        localUpperPivot: new THREE.Vector3(
          sign * topPivotRadius,
          topPivotY,
          0,
        ),
        lowerLinkLengthError: elbow.position.distanceTo(sleevePin.position)
          - lowerLinkLength,
        sign,
        sleevePinAcceleration: sleevePin.acceleration,
        sleevePinPosition: sleevePin.position,
        sleevePinVelocity: sleevePin.velocity,
        upperArmLengthError: upperPivot.position.distanceTo(ball.position)
          - upperArmLength,
        upperPivotAcceleration: upperPivot.acceleration,
        upperPivotPosition: upperPivot.position,
        upperPivotVelocity: upperPivot.velocity,
      };
    });
    let stage;
    if (upperDogEngaged) {
      stage = speedCommandRate >= 0
        ? 'overspeed-upper-dog-catches-and-raises-gate'
        : 'overspeed-upper-dog-finishes-raising-gate';
    } else if (lowerDogEngaged) {
      stage = speedCommandRate <= 0
        ? 'underspeed-lower-dog-catches-and-lowers-gate'
        : 'underspeed-lower-dog-finishes-lowering-gate';
    } else if (cyclePhase < highEngagementStartPhase) {
      stage = 'proper-speed-both-loose-gears-stationary-gate-open';
    } else if (cyclePhase < lowEngagementStartPhase) {
      stage = 'proper-speed-both-loose-gears-stationary-gate-restricted';
    } else {
      stage = 'proper-speed-both-loose-gears-stationary-gate-reopened';
    }
    return {
      assemblyBranchMargin: lowerLinkLength
        - Math.abs(lowerHorizontalOffset),
      ballCenterY,
      ballCentrifugalForce: ballMass * spindleAngularSpeed ** 2
        * ballOrbitRadius,
      ballGravityForce: ballMass * gravityAcceleration,
      ballOrbitRadius,
      ballRadialAcceleration,
      ballRadialSpeed,
      ballStates,
      ballVerticalAcceleration,
      ballVerticalSpeed,
      cyclePhase,
      dogBottomY,
      dogTopY,
      elbowOrbitRadius,
      elbowRadialAcceleration,
      elbowRadialSpeed,
      elbowVerticalAcceleration,
      elbowVerticalSpeed,
      elbowY,
      equilibriumAngleSlope,
      equilibriumResidual: gravityAcceleration * Math.tan(spreadAngle)
        - spindleAngularSpeed ** 2 * ballOrbitRadius,
      gateAccelerationY,
      gateCenterY,
      gateLift,
      gatePinionAngle,
      gateRackCenterY,
      gateRackNoSlipAccelerationError:
        pinionTangentialAcceleration.distanceTo(gateRackAcceleration),
      gateRackNoSlipSpeedError: pinionSurfaceVelocity.distanceTo(
        gateRackVelocity,
      ),
      gateRestrictedFraction,
      gateVelocityY,
      lowerDogAngularAlignmentError,
      lowerDogAxialClearance: dogBottomY - lowerStudTopY,
      lowerDogAxialOverlap,
      lowerDogEngaged,
      lowerDogPhysicalAngularSpeed,
      lowerDogSurfaceSpeedError,
      lowerStudCenterPosition,
      lowerLooseGearAngle,
      lowerLooseGearAngularAcceleration: looseGearAngularAcceleration,
      lowerLooseGearAngularSpeed: looseGearAngularSpeed,
      lowerMeshInvariant: lowerGearTeeth
        * (lowerLooseGearAngle - lowerLooseGearPhase)
        + lowerGearTeeth
          * (lowerOutputGearAngle - lowerOutputGearPhase),
      lowerMeshSurfaceVelocityError: lowerSurfaceVelocity.distanceTo(
        outputLowerSurfaceVelocity,
      ),
      lowerOutputGearAngle,
      lowerOutputGearAngularAcceleration: outputAngularAcceleration,
      lowerOutputGearAngularSpeed: outputAngularSpeed,
      lowerStudBottomY,
      lowerStudTopY,
      lowerStudWorldAngle,
      lowerHorizontalAcceleration,
      lowerHorizontalOffset,
      lowerHorizontalSpeed,
      lowerVerticalDrop,
      outputAngularAcceleration,
      outputAngularDisplacement,
      outputAngularSpeed,
      selectorDogCenterPosition,
      selectorDogAccelerationY,
      selectorDogVelocityY,
      selectorDogY,
      sleeveAccelerationY,
      sleeveOffset,
      sleeveVelocityY,
      sleeveY,
      speedCommand,
      speedCommandAcceleration,
      speedCommandRate,
      spindleAngle,
      spindleAngularAcceleration,
      spindleAngularJerk,
      spindleAngularSpeed,
      spreadAngle,
      spreadAngularAcceleration,
      spreadAngularSpeed,
      stage,
      topDrivenGearAngle,
      topDrivenGearAngularAcceleration: spindleAngularAcceleration,
      topDrivenGearAngularSpeed: spindleAngularSpeed,
      topGearMeshInvariant: topGearTeeth
        * (topInputGearAngle - topInputGearPhase)
        + topGearTeeth * (topDrivenGearAngle - topDrivenGearPhase),
      topGearSurfaceVelocityError: topInputSurfaceVelocity.distanceTo(
        topDrivenSurfaceVelocity,
      ),
      topGearTangentialAccelerationError:
        topInputTangentialAcceleration.distanceTo(
          topDrivenTangentialAcceleration,
        ),
      topInputGearAngle,
      topInputGearAngularAcceleration: -spindleAngularAcceleration,
      topInputGearAngularSpeed: -spindleAngularSpeed,
      upperDogAngularAlignmentError,
      upperDogAxialClearance: upperStudBottomY - dogTopY,
      upperDogAxialOverlap,
      upperDogEngaged,
      upperDogSurfaceSpeedError,
      upperLooseGearAngle,
      upperLooseGearAngularAcceleration: looseGearAngularAcceleration,
      upperLooseGearAngularSpeed: looseGearAngularSpeed,
      upperMeshInvariant: lowerGearTeeth
        * (upperLooseGearAngle - upperLooseGearPhase)
        + lowerGearTeeth
          * (lowerOutputGearAngle - lowerOutputGearPhase),
      upperMeshSurfaceVelocityError: upperSurfaceVelocity.distanceTo(
        outputUpperSurfaceVelocity,
      ),
      upperMeshTangentialAccelerationError:
        upperTangentialAcceleration.distanceTo(
          outputUpperTangentialAcceleration,
        ),
      lowerMeshTangentialAccelerationError:
        lowerTangentialAcceleration.distanceTo(
          outputLowerTangentialAcceleration,
        ),
      upperStudCenterPosition,
      upperStudBottomY,
      upperStudTopY,
      upperStudWorldAngle,
      waterOpenFraction,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(phase * speedCyclePeriod);
  const canonicalTimes = {
    properBeforeHigh: 0,
    upperDogContact: highEngagementStartTime,
    maximumSpeed: speedCyclePeriod / 4,
    upperDogRelease: phaseToTime(highEngagementEndPhase),
    properGateRestricted: speedCyclePeriod / 2,
    lowerDogContact: lowEngagementStartTime,
    minimumSpeed: speedCyclePeriod * 3 / 4,
    lowerDogRelease: phaseToTime(lowEngagementEndPhase),
    nextProper: speedCyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    topInputGearRotor.rotation.z = state.topInputGearAngle;
    topDrivenGearRotor.rotation.z = state.topDrivenGearAngle;
    upperLooseGearRotor.rotation.z = state.upperLooseGearAngle;
    lowerLooseGearRotor.rotation.z = state.lowerLooseGearAngle;
    lowerOutputGearRotor.rotation.z = state.lowerOutputGearAngle;
    gatePinionRotor.rotation.z = state.gatePinionAngle;
    governorRotor.rotation.y = state.spindleAngle;
    slidingSelectorAssembly.position.y = state.sleeveOffset;
    gateSlide.position.y = state.gateRackCenterY;
    gateSlide.userData.velocityY = state.gateVelocityY;
    gateSlide.userData.accelerationY = state.gateAccelerationY;
    gatePlate.userData.waterOpenFraction = state.waterOpenFraction;
    topInputGearRotor.userData.angularSpeed =
      state.topInputGearAngularSpeed;
    topInputGearRotor.userData.angularAcceleration =
      state.topInputGearAngularAcceleration;
    topDrivenGearRotor.userData.angularSpeed =
      state.topDrivenGearAngularSpeed;
    topDrivenGearRotor.userData.angularAcceleration =
      state.topDrivenGearAngularAcceleration;
    upperLooseGearRotor.userData.angularSpeed =
      state.upperLooseGearAngularSpeed;
    upperLooseGearRotor.userData.angularAcceleration =
      state.upperLooseGearAngularAcceleration;
    lowerLooseGearRotor.userData.angularSpeed =
      state.lowerLooseGearAngularSpeed;
    lowerLooseGearRotor.userData.angularAcceleration =
      state.lowerLooseGearAngularAcceleration;
    lowerOutputGearRotor.userData.angularSpeed =
      state.lowerOutputGearAngularSpeed;
    lowerOutputGearRotor.userData.angularAcceleration =
      state.lowerOutputGearAngularAcceleration;
    gatePinionRotor.userData.angularSpeed = state.outputAngularSpeed;
    gatePinionRotor.userData.angularAcceleration =
      state.outputAngularAcceleration;
    governorRotor.userData.angularSpeed = state.spindleAngularSpeed;
    governorRotor.userData.angularAcceleration =
      state.spindleAngularAcceleration;
    selectorDog.userData.upperEngaged = state.upperDogEngaged;
    selectorDog.userData.lowerEngaged = state.lowerDogEngaged;
    state.ballStates.forEach((ballState, index) => {
      const assembly = ballAssemblies[index];
      assembly.upperArm.userData.setEndpoints(
        ballState.localUpperPivot,
        ballState.localBall,
      );
      assembly.lowerLink.userData.setEndpoints(
        ballState.localElbow,
        ballState.localSleevePin,
      );
      assembly.ball.position.copy(ballState.localBall);
      assembly.ballIndex.position.set(
        ballState.sign * (
          state.ballOrbitRadius + ballIndexRadialOffset
        ),
        state.ballCenterY,
        0,
      );
      assembly.elbowHub.position.copy(ballState.localElbow);
      assembly.sleevePinHub.position.copy(ballState.localSleevePin);
    });
    root.userData.contacts = {
      gateRack: {
        noSlipAccelerationError: state.gateRackNoSlipAccelerationError,
        noSlipSpeedError: state.gateRackNoSlipSpeedError,
        pitchRadius: gateRackPitchRadius,
      },
      lowerDog: {
        angularAlignmentError: state.lowerDogAngularAlignmentError,
        axialClearance: state.lowerDogAxialClearance,
        axialOverlap: state.lowerDogAxialOverlap,
        engaged: state.lowerDogEngaged,
        surfaceSpeedError: state.lowerDogSurfaceSpeedError,
      },
      lowerMesh: {
        contactPoint: lowerMeshContactPoint.clone(),
        meshInvariant: state.lowerMeshInvariant,
        tangentialAccelerationError:
          state.lowerMeshTangentialAccelerationError,
        surfaceVelocityError: state.lowerMeshSurfaceVelocityError,
      },
      topInputMesh: {
        contactPoint: topGearContactPoint.clone(),
        meshInvariant: state.topGearMeshInvariant,
        tangentialAccelerationError:
          state.topGearTangentialAccelerationError,
        surfaceVelocityError: state.topGearSurfaceVelocityError,
      },
      upperDog: {
        angularAlignmentError: state.upperDogAngularAlignmentError,
        axialClearance: state.upperDogAxialClearance,
        axialOverlap: state.upperDogAxialOverlap,
        engaged: state.upperDogEngaged,
        surfaceSpeedError: state.upperDogSurfaceSpeedError,
      },
      upperMesh: {
        contactPoint: upperMeshContactPoint.clone(),
        meshInvariant: state.upperMeshInvariant,
        tangentialAccelerationError:
          state.upperMeshTangentialAccelerationError,
        surfaceVelocityError: state.upperMeshSurfaceVelocityError,
      },
      waterGate: {
        feedbackSign: -1,
        lift: state.gateLift,
        openFraction: state.waterOpenFraction,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData.mechanism =
    'flyball-double-dog-opposed-loose-bevel-reversing-water-gate-governor';
  root.userData.cameraDistanceScale = 0.94;
  root.userData.blocks = {
    ballAssemblies,
    baseRail,
    cameraEnvelope,
    fixedFrame,
    gateGuideLeft,
    gateGuideRight,
    gateIndex,
    gatePinion,
    gatePinionIndex,
    gatePinionRotor,
    gatePlate,
    gateRackSpine,
    gateRackTeeth,
    gateSlide,
    governorRotor,
    governorSleeve,
    governorSleeveCrossbar,
    leftWaterDuct,
    lowerLooseGear,
    lowerLooseGearRotor,
    lowerOutputBearingArm,
    lowerOutputBearing,
    lowerOutputGear,
    lowerOutputGearRotor,
    lowerOutputShaft,
    lowerStud,
    lowerVerticalBearing,
    lowerVerticalBearingArm,
    rearStandard,
    rightWaterDuct,
    selectorDog,
    selectorDogIndex,
    selectorLinkRod,
    selectorSleeve,
    slidingSelectorAssembly,
    spindle,
    spindleIndex,
    topDrivenGear,
    topDrivenGearRotor,
    topHeadCrossbar,
    topHeadHub,
    topInputBearingArm,
    topInputBearing,
    topInputGear,
    topInputGearRotor,
    topInputShaft,
    upperLooseGear,
    upperLooseGearRotor,
    upperStud,
    upperVerticalBearing,
    upperVerticalBearingArm,
    waterPort,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.equilibriumAtSpreadAngle = equilibriumAtSpreadAngle;
  root.userData.geometry = {
    ballIndexRadialOffset,
    ballMass,
    ballRadius,
    baseY,
    elbowArmLength,
    engagementTravelMismatch,
    equilibriumIterations,
    frameZ,
    fullTurn,
    gateHeight,
    gateLowCenterY,
    gatePinionPhase,
    gatePinionTeeth,
    gatePortBottomY,
    gatePortCenterY,
    gatePortHeight,
    gateRackLength,
    gateRackLowCenterY,
    gateRackPitchRadius,
    gateStroke,
    gateToRackCenterOffset,
    gateX,
    gravityAcceleration,
    highEngagementEndPhase,
    highEngagementStartPhase,
    inputApex: inputApex.clone(),
    lowerDogContactOffset,
    lowerEngagedSpindleTravel,
    lowerEngagementPhase,
    lowerEngagementThreshold,
    lowerGearOuterDistance,
    lowerGearPitchConeAngle,
    lowerGearPitchRadius,
    lowerGearTeeth,
    lowerLinkLength,
    lowerLooseGearAxis: lowerLooseGearAxis.clone(),
    lowerLooseGearPhase,
    lowerMeshContactPoint: lowerMeshContactPoint.clone(),
    lowerOutputAxis: lowerOutputAxis.clone(),
    lowerOutputGearPhase,
    lowerStudLocalAngle,
    lowerStudLength,
    lowerStudTopOffset,
    lowerTrainApex: lowerTrainApex.clone(),
    looseGearInnerDistance,
    lowEngagementEndPhase,
    lowEngagementStartPhase,
    maximumEquilibrium,
    maximumSpindleAngularSpeed,
    maximumSpreadAngle,
    minimumEquilibrium,
    minimumSpindleAngularSpeed,
    minimumSpreadAngle,
    nominalEquilibrium,
    nominalSleeveY,
    nominalSpindleAngularSpeed,
    nominalSpreadAngle,
    rackToothCount,
    rackToothPitch,
    selectorDogHeight,
    selectorDogRadius,
    selectorSleeveHeight,
    sleevePinRadius,
    sourceBallLeft: sourceBallLeft.clone(),
    sourceElbowLeft: sourceElbowLeft.clone(),
    sourceGovernorSleeveLeft: sourceGovernorSleeveLeft.clone(),
    sourceImageHeight,
    sourceImageWidth,
    sourceInputShaftReach,
    sourceOutputShaftReach,
    sourceRasterBallLeft: sourceRasterBallLeft.clone(),
    sourceRasterBallRadius,
    sourceRasterBallRight: sourceRasterBallRight.clone(),
    sourceRasterElbowLeft: sourceRasterElbowLeft.clone(),
    sourceRasterElbowRight: sourceRasterElbowRight.clone(),
    sourceRasterGovernorSleeveLeft:
      sourceRasterGovernorSleeveLeft.clone(),
    sourceRasterGovernorSleeveRight:
      sourceRasterGovernorSleeveRight.clone(),
    sourceRasterInputApex: sourceRasterInputApex.clone(),
    sourceRasterInputShaftEnd: sourceRasterInputShaftEnd.clone(),
    sourceRasterLowerLooseGearFaceY,
    sourceRasterLowerTrainApex: sourceRasterLowerTrainApex.clone(),
    sourceRasterOutputShaftEnd: sourceRasterOutputShaftEnd.clone(),
    sourceRasterSpindleAxisX,
    sourceRasterTopPivotLeft: sourceRasterTopPivotLeft.clone(),
    sourceRasterTopPivotRight: sourceRasterTopPivotRight.clone(),
    sourceRasterUpperLooseGearFaceY,
    sourceTopPivotLeft: sourceTopPivotLeft.clone(),
    sourceUnitsPerPixel,
    shaftApexOverrun,
    speedCycleAngularFrequency,
    speedCyclePeriod,
    spindleAngularSpeedAmplitude,
    spindleBottomY,
    spindleTopY,
    spindleTurnsPerSpeedCycle,
    topDrivenAxis: topDrivenAxis.clone(),
    topDrivenGearPhase,
    topGearContactPoint: topGearContactPoint.clone(),
    topGearOuterDistance,
    topGearTeeth,
    topInputAxis: topInputAxis.clone(),
    topInputGearPhase,
    topPitchConeAngle,
    topPitchRadius,
    topPivotRadius,
    topPivotY,
    upperArmLength,
    upperDogContactOffset,
    upperEngagedSpindleTravel,
    upperEngagementPhase,
    upperEngagementThreshold,
    upperLooseGearAxis: upperLooseGearAxis.clone(),
    upperLooseGearPhase,
    upperMeshContactPoint: upperMeshContactPoint.clone(),
    upperStudBottomOffset,
    upperStudLength,
    upperStudLocalAngle,
  };
  root.userData.spindleAngleAtTime = spindleAngleAtTime;
  root.userData.spreadAngleAtSpindleSpeed = spreadAngleAtSpindleSpeed;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;

  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  for (const object of [
    cameraEnvelope,
    gateIndex,
    gatePinionIndex,
    selectorDogIndex,
    spindleIndex,
    topInputGear.userData.faceIndex,
    topDrivenGear.userData.faceIndex,
    upperLooseGear.userData.faceIndex,
    lowerLooseGear.userData.faceIndex,
    lowerOutputGear.userData.faceIndex,
    ...ballAssemblies.map(({ ballIndex }) => ballIndex),
    ...topInputGear.userData.toothMeshes.filter(({ userData }) => (
      userData.index === topInputGear.userData.indexToothIndex
    )),
    ...topDrivenGear.userData.toothMeshes.filter(({ userData }) => (
      userData.index === topDrivenGear.userData.indexToothIndex
    )),
    ...upperLooseGear.userData.toothMeshes.filter(({ userData }) => (
      userData.index === upperLooseGear.userData.indexToothIndex
    )),
    ...lowerLooseGear.userData.toothMeshes.filter(({ userData }) => (
      userData.index === lowerLooseGear.userData.indexToothIndex
    )),
    ...lowerOutputGear.userData.toothMeshes.filter(({ userData }) => (
      userData.index === lowerOutputGear.userData.indexToothIndex
    )),
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.traverse((object) => {
    if (!object.userData.cameraFitGuide) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });
  root.userData.fidelity = 'authored';
  return {
    cameraDirection: new THREE.Vector3(8.2, 5.5, 13.4),
    root,
    update,
  };
}

export function createAuthoredWaterGovernorMovement(movement) {
  switch (movement.id) {
    case 162: return waterWheelReversingGovernorMotion();
    default: return null;
  }
}
