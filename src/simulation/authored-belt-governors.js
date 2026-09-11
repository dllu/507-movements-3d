import * as THREE from 'three';
import { makePitchBevelGear } from './authored-governors.js';
import {
  PALETTE,
  beltCurveOpen,
  makeBeam,
  makeGear,
  makeMovingBelt,
  makePulley,
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

function smoothstep5(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return u ** 3 * (10 + u * (-15 + 6 * u));
}

function smoothstep5Derivative(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * u ** 2 * (1 - u) ** 2;
}

function smoothstep5SecondDerivative(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * u - 180 * u ** 2 + 120 * u ** 3;
}

function smoothstep5Integral(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 2.5 * u ** 4 - 3 * u ** 5 + u ** 6;
}

function beltShiftWaterGovernorMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Pixel measurements from the 525 px public-domain engraving. It shows the
  // proper-speed state: the belt is centered on the middle loose pulley.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterSpindleAxisX = 259;
  const sourceRasterTopPivotLeft = new THREE.Vector2(244, 48);
  const sourceRasterTopPivotRight = new THREE.Vector2(274, 48);
  const sourceRasterElbowLeft = new THREE.Vector2(207, 154);
  const sourceRasterElbowRight = new THREE.Vector2(313, 154);
  const sourceRasterBallLeft = new THREE.Vector2(180, 226);
  const sourceRasterBallRight = new THREE.Vector2(340, 226);
  const sourceRasterBallRadius = 33;
  const sourceRasterSleeveLeft = new THREE.Vector2(244, 245);
  const sourceRasterSleeveRight = new THREE.Vector2(275, 245);
  const sourceRasterFollowerPin = new THREE.Vector2(285, 270);
  const sourceRasterBellPivot = new THREE.Vector2(348, 343);
  const sourceRasterBellOutputJoint = new THREE.Vector2(466, 343);
  const sourceRasterBeltFork = new THREE.Vector2(466, 470);
  const sourceRasterUpperPulleyCenterY = 449;
  const sourceRasterMiddlePulleyCenterY = 470;
  const sourceRasterLowerPulleyCenterY = 492;
  const sourceRasterFrameLeftX = 146;
  const sourceRasterFrameRightX = 379;
  const sourceRasterFrameTopY = 378;
  const sourceUnitsPerPixel = 0.018;
  const topPivotY = 4.5;
  const sourcePointFromRaster = (point) => new THREE.Vector2(
    (point.x - sourceRasterSpindleAxisX) * sourceUnitsPerPixel,
    topPivotY + (
      sourceRasterTopPivotLeft.y - point.y
    ) * sourceUnitsPerPixel,
  );

  const sourceTopPivotLeft = sourcePointFromRaster(
    sourceRasterTopPivotLeft,
  );
  const sourceBallLeft = sourcePointFromRaster(sourceRasterBallLeft);
  const sourceElbowLeft = sourcePointFromRaster(sourceRasterElbowLeft);
  const sourceSleeveLeft = sourcePointFromRaster(sourceRasterSleeveLeft);
  const sourceFollowerPin = sourcePointFromRaster(
    sourceRasterFollowerPin,
  );
  const sourceBellPivot = sourcePointFromRaster(sourceRasterBellPivot);
  const sourceBellOutputJoint = sourcePointFromRaster(
    sourceRasterBellOutputJoint,
  );
  const sourceBeltFork = sourcePointFromRaster(sourceRasterBeltFork);

  const topPivotRadius = Math.abs(sourceTopPivotLeft.x);
  const nominalBallOrbitRadius = Math.abs(sourceBallLeft.x);
  const nominalBallCenterY = sourceBallLeft.y;
  const nominalSpreadAngle = Math.atan2(
    nominalBallOrbitRadius - topPivotRadius,
    topPivotY - nominalBallCenterY,
  );
  const upperArmLength = Math.hypot(
    nominalBallOrbitRadius - topPivotRadius,
    topPivotY - nominalBallCenterY,
  );
  const sourceElbowOrbitRadius = Math.abs(sourceElbowLeft.x);
  const elbowArmLength = Math.hypot(
    sourceElbowOrbitRadius - topPivotRadius,
    topPivotY - sourceElbowLeft.y,
  );
  const sleevePinRadius = (
    Math.abs(sourceSleeveLeft.x)
      + Math.abs(sourcePointFromRaster(sourceRasterSleeveRight).x)
  ) / 2;
  const sourceSleeveY = sourceSleeveLeft.y;
  const nominalElbowOrbitRadius = topPivotRadius
    + elbowArmLength * Math.sin(nominalSpreadAngle);
  const nominalElbowY = topPivotY
    - elbowArmLength * Math.cos(nominalSpreadAngle);
  const lowerLinkLength = Math.hypot(
    nominalElbowOrbitRadius - sleevePinRadius,
    nominalElbowY - sourceSleeveY,
  );
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

  // The sleeve roller runs in the source's horizontal slot at the end of the
  // curved crank. This is the actual pin-in-slot constraint, not a decorative
  // line: transforming the roller into crank coordinates leaves its local Y
  // exactly on the slot centerline for every state.
  const followerDrop = (
    sourceRasterFollowerPin.y - sourceRasterSleeveLeft.y
  ) * sourceUnitsPerPixel;
  const followerX = sourceFollowerPin.x;
  const followerNominalY = nominalEquilibrium.sleeveY - followerDrop;
  const bellPivot = new THREE.Vector3(
    sourceBellPivot.x,
    sourceBellPivot.y,
    1.04,
  );
  const bellOutputArmLength = sourceBellOutputJoint.x - sourceBellPivot.x;
  const sliderX = sourceBeltFork.x;
  const connectingRodLength = sourceBellOutputJoint.y - sourceBeltFork.y;
  const slotFollowerOffsetX = followerX - bellPivot.x;
  const slotCenterY = followerNominalY - bellPivot.y;
  const bellStateAtSleeve = (
    sleeveY,
    sleeveVelocityY = 0,
    sleeveAccelerationY = 0,
  ) => {
    const followerY = sleeveY - followerDrop;
    const followerOffsetY = followerY - bellPivot.y;
    let bellAngle = -(
      followerOffsetY - slotCenterY
    ) / -slotFollowerOffsetX;
    for (let iteration = 0; iteration < 20; iteration += 1) {
      const sine = Math.sin(bellAngle);
      const cosine = Math.cos(bellAngle);
      const residual = -slotFollowerOffsetX * sine
        + followerOffsetY * cosine - slotCenterY;
      const slope = -slotFollowerOffsetX * cosine
        - followerOffsetY * sine;
      bellAngle -= residual / slope;
    }
    const sine = Math.sin(bellAngle);
    const cosine = Math.cos(bellAngle);
    const bellConstraintSlope = -slotFollowerOffsetX * cosine
      - followerOffsetY * sine;
    const bellAngleSleeveSlope = -cosine / bellConstraintSlope;
    const bellConstraintCurvature = slotFollowerOffsetX * sine
      - followerOffsetY * cosine;
    const bellMixedSlope = -sine;
    const bellAngleSleeveCurvature = -(
      bellConstraintCurvature * bellAngleSleeveSlope ** 2
        + 2 * bellMixedSlope * bellAngleSleeveSlope
    ) / bellConstraintSlope;
    const bellAngularSpeed = bellAngleSleeveSlope * sleeveVelocityY;
    const bellAngularAcceleration = bellAngleSleeveSlope
      * sleeveAccelerationY
      + bellAngleSleeveCurvature * sleeveVelocityY ** 2;
    const slotCoordinate = slotFollowerOffsetX * cosine
      + followerOffsetY * sine;
    const slotSlidingSpeed = sleeveVelocityY * sine
      + slotCenterY * bellAngularSpeed;
    const slotSlidingAcceleration = sleeveAccelerationY * sine
      + sleeveVelocityY * cosine * bellAngularSpeed
      + slotCenterY * bellAngularAcceleration;
    const outputJoint = new THREE.Vector3(
      bellPivot.x + bellOutputArmLength * cosine,
      bellPivot.y + bellOutputArmLength * sine,
      bellPivot.z,
    );
    const outputJointVelocity = new THREE.Vector3(
      -bellOutputArmLength * sine * bellAngularSpeed,
      bellOutputArmLength * cosine * bellAngularSpeed,
      0,
    );
    const outputJointAcceleration = new THREE.Vector3(
      -bellOutputArmLength * (
        cosine * bellAngularSpeed ** 2
          + sine * bellAngularAcceleration
      ),
      bellOutputArmLength * (
        -sine * bellAngularSpeed ** 2
          + cosine * bellAngularAcceleration
      ),
      0,
    );
    const horizontalRodOffset = sliderX - outputJoint.x;
    const horizontalRodSpeed = -outputJointVelocity.x;
    const horizontalRodAcceleration = -outputJointAcceleration.x;
    const verticalRodDrop = Math.sqrt(
      connectingRodLength ** 2 - horizontalRodOffset ** 2,
    );
    const beltY = outputJoint.y - verticalRodDrop;
    const beltVelocityY = outputJointVelocity.y
      + horizontalRodOffset * horizontalRodSpeed / verticalRodDrop;
    const beltAccelerationY = outputJointAcceleration.y
      + (
        horizontalRodSpeed ** 2
          + horizontalRodOffset * horizontalRodAcceleration
      ) / verticalRodDrop
      + horizontalRodOffset ** 2 * horizontalRodSpeed ** 2
        / verticalRodDrop ** 3;
    return {
      bellAngle,
      bellAngleSleeveCurvature,
      bellAngleSleeveSlope,
      bellAngularAcceleration,
      bellAngularSpeed,
      bellConstraintSlope,
      beltAccelerationY,
      beltVelocityY,
      beltY,
      followerOffsetY,
      followerY,
      horizontalRodOffset,
      outputJoint,
      outputJointAcceleration,
      outputJointVelocity,
      slotConstraintError: -slotFollowerOffsetX * sine
        + followerOffsetY * cosine - slotCenterY,
      slotCoordinate,
      slotSlidingAcceleration,
      slotSlidingSpeed,
      verticalRodDrop,
    };
  };
  const nominalBellState = bellStateAtSleeve(
    nominalEquilibrium.sleeveY,
  );
  const middlePulleyY = sourceBeltFork.y;
  if (Math.abs(nominalBellState.beltY - middlePulleyY) > 1e-12) {
    throw new RangeError('Movement 163 source bell-crank closure was lost.');
  }

  // Choose a moderate underspeed endpoint, then solve the overspeed endpoint
  // so the source bell crank moves equal distances to the upper and lower
  // fast-pulley planes. The resulting 22.9 px pitch stays within two pixels
  // of both adjacent pulley spacings measured on the plate.
  const minimumSpreadAngle = 0.16;
  const minimumEquilibrium = equilibriumAtSpreadAngle(minimumSpreadAngle);
  const minimumBellState = bellStateAtSleeve(minimumEquilibrium.sleeveY);
  const pulleySpacing = minimumBellState.beltY - middlePulleyY;
  let maximumAngleLower = nominalSpreadAngle;
  let maximumAngleUpper = 0.58;
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const middle = (maximumAngleLower + maximumAngleUpper) / 2;
    const candidate = bellStateAtSleeve(
      equilibriumAtSpreadAngle(middle).sleeveY,
    );
    if (middlePulleyY - candidate.beltY < pulleySpacing) {
      maximumAngleLower = middle;
    } else {
      maximumAngleUpper = middle;
    }
  }
  const maximumSpreadAngle = (
    maximumAngleLower + maximumAngleUpper
  ) / 2;
  const maximumEquilibrium = equilibriumAtSpreadAngle(maximumSpreadAngle);
  const maximumBellState = bellStateAtSleeve(maximumEquilibrium.sleeveY);
  const minimumSpindleAngularSpeed = minimumEquilibrium.spindleAngularSpeed;
  const maximumSpindleAngularSpeed = maximumEquilibrium.spindleAngularSpeed;
  const upperPulleyY = middlePulleyY + pulleySpacing;
  const lowerPulleyY = middlePulleyY - pulleySpacing;
  const selectorSymmetryError = (
    minimumBellState.beltY - middlePulleyY
  ) - (middlePulleyY - maximumBellState.beltY);

  const cyclePeriod = 10;
  const highShiftStart = 0.4;
  const highShiftEnd = 1.4;
  const lowerRampInEnd = 1.6;
  const lowerRampOutStart = 2.7;
  const lowerRampOutEnd = 2.9;
  const highReturnEnd = 3.9;
  const lowShiftStart = 4.3;
  const lowShiftEnd = 5.3;
  const upperRampInEnd = 5.5;
  const lowerEffectiveDriveDuration = (
    lowerRampInEnd - highShiftEnd
  ) / 2 + (lowerRampOutStart - lowerRampInEnd)
    + (lowerRampOutEnd - lowerRampOutStart) / 2;
  const closingAngularTravel = maximumSpindleAngularSpeed
    * lowerEffectiveDriveDuration;
  const upperEffectiveDriveDuration = closingAngularTravel
    / minimumSpindleAngularSpeed;
  const upperSteadyDuration = upperEffectiveDriveDuration
    - (upperRampInEnd - lowShiftEnd) / 2
    - (lowerRampOutEnd - lowerRampOutStart) / 2;
  const upperRampOutStart = upperRampInEnd + upperSteadyDuration;
  const upperRampOutEnd = upperRampOutStart
    + (lowerRampOutEnd - lowerRampOutStart);
  const lowReturnEnd = upperRampOutEnd + 1;
  const engagementTravelMismatch = closingAngularTravel
    - minimumSpindleAngularSpeed * upperEffectiveDriveDuration;

  const speedSegments = [
    { end: highShiftStart, endSpeed: nominalSpindleAngularSpeed,
      start: 0, startSpeed: nominalSpindleAngularSpeed },
    { end: highShiftEnd, endSpeed: maximumSpindleAngularSpeed,
      start: highShiftStart, startSpeed: nominalSpindleAngularSpeed },
    { end: lowerRampOutEnd, endSpeed: maximumSpindleAngularSpeed,
      start: highShiftEnd, startSpeed: maximumSpindleAngularSpeed },
    { end: highReturnEnd, endSpeed: nominalSpindleAngularSpeed,
      start: lowerRampOutEnd, startSpeed: maximumSpindleAngularSpeed },
    { end: lowShiftStart, endSpeed: nominalSpindleAngularSpeed,
      start: highReturnEnd, startSpeed: nominalSpindleAngularSpeed },
    { end: lowShiftEnd, endSpeed: minimumSpindleAngularSpeed,
      start: lowShiftStart, startSpeed: nominalSpindleAngularSpeed },
    { end: upperRampOutEnd, endSpeed: minimumSpindleAngularSpeed,
      start: lowShiftEnd, startSpeed: minimumSpindleAngularSpeed },
    { end: lowReturnEnd, endSpeed: nominalSpindleAngularSpeed,
      start: upperRampOutEnd, startSpeed: minimumSpindleAngularSpeed },
    { end: cyclePeriod, endSpeed: nominalSpindleAngularSpeed,
      start: lowReturnEnd, startSpeed: nominalSpindleAngularSpeed },
  ];
  let accumulatedSpindleAngle = 0;
  for (const segment of speedSegments) {
    segment.startAngle = accumulatedSpindleAngle;
    segment.duration = segment.end - segment.start;
    accumulatedSpindleAngle += segment.duration
      * (segment.startSpeed + segment.endSpeed) / 2;
    segment.endAngle = accumulatedSpindleAngle;
  }
  const spindleAnglePerCycle = accumulatedSpindleAngle;
  const speedStateAtLocalTime = (localTime) => {
    const segment = speedSegments.find(({ end }) => localTime < end)
      ?? speedSegments.at(-1);
    const elapsed = THREE.MathUtils.clamp(
      localTime - segment.start,
      0,
      segment.duration,
    );
    const u = segment.duration > 0 ? elapsed / segment.duration : 0;
    const delta = segment.endSpeed - segment.startSpeed;
    const blend = smoothstep5(u);
    return {
      localSpindleAngle: segment.startAngle
        + segment.startSpeed * elapsed
        + delta * segment.duration * smoothstep5Integral(u),
      spindleAngularAcceleration: delta
        * smoothstep5Derivative(u) / segment.duration,
      spindleAngularJerk: delta
        * smoothstep5SecondDerivative(u) / segment.duration ** 2,
      spindleAngularSpeed: segment.startSpeed + delta * blend,
    };
  };

  const rampFactor = (time, start, end, rising) => {
    if (time <= start) {
      return { factor: rising ? 0 : 1, rate: 0 };
    }
    if (time >= end) {
      return { factor: rising ? 1 : 0, rate: 0 };
    }
    const duration = end - start;
    const u = (time - start) / duration;
    const blend = smoothstep5(u);
    const rate = smoothstep5Derivative(u) / duration;
    return rising
      ? { factor: blend, rate }
      : { factor: 1 - blend, rate: -rate };
  };
  const episodeFactor = (time, rampInStart, rampInEnd,
    rampOutStart, rampOutEnd) => {
    if (time < rampInStart || time >= rampOutEnd) {
      return { factor: 0, rate: 0 };
    }
    if (time < rampInEnd) {
      return rampFactor(time, rampInStart, rampInEnd, true);
    }
    if (time < rampOutStart) return { factor: 1, rate: 0 };
    return rampFactor(time, rampOutStart, rampOutEnd, false);
  };
  const episodeEffectiveTime = (time, rampInStart, rampInEnd,
    rampOutStart, rampOutEnd) => {
    if (time <= rampInStart) return 0;
    const rampInDuration = rampInEnd - rampInStart;
    if (time < rampInEnd) {
      const u = (time - rampInStart) / rampInDuration;
      return rampInDuration * smoothstep5Integral(u);
    }
    let effective = rampInDuration / 2;
    if (time < rampOutStart) return effective + time - rampInEnd;
    effective += rampOutStart - rampInEnd;
    const rampOutDuration = rampOutEnd - rampOutStart;
    if (time < rampOutEnd) {
      const elapsed = time - rampOutStart;
      const u = elapsed / rampOutDuration;
      return effective + elapsed
        - rampOutDuration * smoothstep5Integral(u);
    }
    return effective + rampOutDuration / 2;
  };

  const pulleyRadius = 0.84;
  const beltRadius = 0.052;
  const beltMarkerCount = 10;
  const receiverX = 5.0;
  const beltCurve = beltCurveOpen(
    new THREE.Vector2(0, 0),
    new THREE.Vector2(receiverX, 0),
    pulleyRadius,
    pulleyRadius,
  );
  const beltLength = beltCurve.getLength();
  const beltDistancePerCycle = pulleyRadius * (
    closingAngularTravel
      + minimumSpindleAngularSpeed * upperEffectiveDriveDuration
  );
  const gateStroke = 1;
  const gatePinionPitchRadius = gateStroke / closingAngularTravel;

  const topGearAxis = Y_AXIS.clone();
  const lowerGearAxis = Y_AXIS.clone().negate();
  const outputGearAxis = Z_AXIS.clone();
  const lowerTrainApex = new THREE.Vector3(receiverX, -4.45, 0);
  const lowerGearTeeth = 24;
  const lowerGearOuterDistance = 0.64;
  const lowerGearPitchRadius = 0.64;
  const lowerGearPitchConeAngle = Math.PI / 4;
  const upperMeshContactPoint = lowerTrainApex.clone()
    .addScaledVector(topGearAxis, lowerGearOuterDistance)
    .addScaledVector(outputGearAxis, lowerGearOuterDistance);
  const lowerMeshContactPoint = lowerTrainApex.clone()
    .addScaledVector(lowerGearAxis, lowerGearOuterDistance)
    .addScaledVector(outputGearAxis, lowerGearOuterDistance);
  const upperBevelGear = makePitchBevelGear({
    axis: topGearAxis,
    color: PALETTE.driven,
    innerDistance: lowerGearOuterDistance * 0.34,
    outerDistance: lowerGearOuterDistance,
    pitchConeAngle: lowerGearPitchConeAngle,
    teeth: lowerGearTeeth,
    toothHeight: 0.105,
  });
  upperBevelGear.position.copy(lowerTrainApex);
  upperBevelGear.userData.role =
    'upper-belt-selected-bevel-for-gate-opening';
  const upperBevelGearRotor = upperBevelGear.userData.rotor;
  const lowerBevelGear = makePitchBevelGear({
    axis: lowerGearAxis,
    color: PALETTE.driven,
    innerDistance: lowerGearOuterDistance * 0.34,
    outerDistance: lowerGearOuterDistance,
    pitchConeAngle: lowerGearPitchConeAngle,
    teeth: lowerGearTeeth,
    toothHeight: 0.105,
  });
  lowerBevelGear.position.copy(lowerTrainApex);
  lowerBevelGear.userData.role =
    'lower-belt-selected-bevel-for-gate-closing';
  const lowerBevelGearRotor = lowerBevelGear.userData.rotor;
  const outputBevelGear = makePitchBevelGear({
    axis: outputGearAxis,
    color: PALETTE.accent,
    innerDistance: lowerGearOuterDistance * 0.34,
    outerDistance: lowerGearOuterDistance,
    pitchConeAngle: lowerGearPitchConeAngle,
    teeth: lowerGearTeeth,
    toothHeight: 0.105,
  });
  outputBevelGear.position.copy(lowerTrainApex);
  outputBevelGear.userData.doubleMesh = true;
  outputBevelGear.userData.role =
    'common-horizontal-bevel-output-to-water-gate';
  const outputBevelGearRotor = outputBevelGear.userData.rotor;
  const localContactAngle = (gear, point) => {
    const localPoint = point.clone().sub(gear.position).applyQuaternion(
      gear.quaternion.clone().invert(),
    );
    return Math.atan2(localPoint.y, localPoint.x);
  };
  const outputBevelGearPhase = localContactAngle(
    outputBevelGear,
    upperMeshContactPoint,
  );
  const upperBevelGearPhase = localContactAngle(
    upperBevelGear,
    upperMeshContactPoint,
  ) - Math.PI / lowerGearTeeth;
  const lowerBevelGearPhase = localContactAngle(
    lowerBevelGear,
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

  const governorRotor = new THREE.Group();
  governorRotor.userData.axis = Y_AXIS.clone();
  governorRotor.userData.role =
    'continuously-rotating-water-wheel-flyball-governor';
  const spindleTopY = 5.0;
  const spindleBottomY = -4.15;
  const spindle = cylinderAlongY(
    0.09,
    spindleTopY - spindleBottomY,
    darkMaterial,
    38,
  );
  spindle.position.y = (spindleTopY + spindleBottomY) / 2;
  spindle.userData.role = 'governor-spindle-carrying-two-fast-pulleys';
  const spindleIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.34, 0.05),
    indexMaterial,
  );
  spindleIndex.position.set(0.125, 3.38, 0);
  spindleIndex.userData.role = 'white-index-on-governor-spindle';
  const topHeadHub = cylinderAlongY(0.27, 0.36, drivenMaterial, 40);
  topHeadHub.position.y = topPivotY;
  topHeadHub.userData.role = 'upper-flyball-head-fixed-to-spindle';
  const topHeadCrossbar = makeBeam(
    new THREE.Vector3(-topPivotRadius, topPivotY, 0),
    new THREE.Vector3(topPivotRadius, topPivotY, 0),
    { color: PALETTE.driven, depth: 0.27, thickness: 0.17 },
  );
  topHeadCrossbar.userData.role = 'source-width-flyball-head-crossbar';
  governorRotor.add(spindle, spindleIndex, topHeadHub, topHeadCrossbar);

  const nominalSleeveY = nominalEquilibrium.sleeveY;
  const rotatingSleeveSlide = new THREE.Group();
  rotatingSleeveSlide.userData.role =
    'rotating-sleeve-raised-and-lowered-by-flyballs';
  const rotatingSleeve = cylinderAlongY(0.28, 0.38, accentMaterial, 40);
  rotatingSleeve.position.y = nominalSleeveY;
  rotatingSleeve.userData.role = 'rotating-governor-sleeve';
  const sleeveCrossbar = makeBeam(
    new THREE.Vector3(-sleevePinRadius, nominalSleeveY, 0),
    new THREE.Vector3(sleevePinRadius, nominalSleeveY, 0),
    { color: PALETTE.accent, depth: 0.26, thickness: 0.16 },
  );
  sleeveCrossbar.userData.role = 'lower-link-pins-on-rotating-sleeve';
  rotatingSleeveSlide.add(rotatingSleeve, sleeveCrossbar);
  governorRotor.add(rotatingSleeveSlide);

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
    upperArm.userData.role = `rigid-water-governor-upper-arm-${index + 1}`;
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
    ball.userData.role = `belt-governor-flyball-${index + 1}`;
    const ballIndex = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 14, 10),
      indexMaterial,
    );
    ballIndex.position.set(
      sign * (nominalEquilibrium.ballOrbitRadius + ballIndexRadialOffset),
      nominalEquilibrium.ballCenterY,
      0,
    );
    ballIndex.userData.role = `white-orbit-index-on-flyball-${index + 1}`;
    const topPivotHub = cylinderAlongZ(0.14, 0.35, darkMaterial, 28);
    topPivotHub.position.copy(upperPivot);
    const elbowHub = cylinderAlongZ(0.14, 0.34, darkMaterial, 28);
    elbowHub.position.copy(elbow);
    const sleevePinHub = cylinderAlongZ(0.12, 0.33, darkMaterial, 28);
    sleevePinHub.position.copy(sleevePin);
    topPivotHub.userData.role = `upper-flyball-pivot-${index + 1}`;
    elbowHub.userData.role = `flyball-elbow-pivot-${index + 1}`;
    sleevePinHub.userData.role = `rotating-sleeve-pin-${index + 1}`;
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

  const nonrotatingFollowerSlide = new THREE.Group();
  nonrotatingFollowerSlide.userData.role =
    'nonrotating-thrust-collar-and-bell-crank-follower';
  const thrustCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.075, 12, 44),
    accentMaterial,
  );
  thrustCollar.rotation.x = Math.PI / 2;
  thrustCollar.position.y = nominalSleeveY;
  thrustCollar.userData.role =
    'nonrotating-collar-following-the-rotating-sleeve';
  const followerDropRod = cylinderAlongY(
    0.055,
    followerDrop,
    accentMaterial,
    24,
  );
  followerDropRod.position.set(
    0.34,
    (nominalSleeveY + followerNominalY) / 2,
    bellPivot.z,
  );
  followerDropRod.userData.role = 'drop-arm-to-crank-slot-follower';
  const followerBridge = makeBeam(
    new THREE.Vector3(0.34, followerNominalY, bellPivot.z),
    new THREE.Vector3(followerX, followerNominalY, bellPivot.z),
    { color: PALETTE.accent, depth: 0.16, thickness: 0.11 },
  );
  followerBridge.userData.role = 'horizontal-follower-trunnion';
  const followerRoller = cylinderAlongZ(0.13, 0.38, darkMaterial, 30);
  followerRoller.position.set(followerX, followerNominalY, bellPivot.z);
  followerRoller.userData.role = 'roller-captured-in-crank-slot';
  const followerIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 14, 10),
    indexMaterial,
  );
  followerIndex.position.set(
    followerX,
    followerNominalY,
    bellPivot.z + 0.205,
  );
  followerIndex.userData.role = 'white-index-on-slot-follower';
  nonrotatingFollowerSlide.add(
    thrustCollar,
    followerDropRod,
    followerBridge,
    followerRoller,
    followerIndex,
  );

  const bellCrank = new THREE.Group();
  bellCrank.position.copy(bellPivot);
  bellCrank.userData.axis = Z_AXIS.clone();
  bellCrank.userData.role =
    'source-curved-slotted-bell-crank-shifting-one-belt';
  const slotCoordinates = [minimumBellState, nominalBellState,
    maximumBellState].map(({ slotCoordinate }) => slotCoordinate);
  const slotMinimumX = Math.min(...slotCoordinates) - 0.14;
  const slotMaximumX = Math.max(...slotCoordinates) + 0.14;
  const curvedArmPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.28, 0.16, 0),
    new THREE.Vector3(-0.45, 0.48, 0),
    new THREE.Vector3(-0.55, 0.88, 0),
    new THREE.Vector3(-0.76, 1.18, 0),
    new THREE.Vector3(slotMaximumX, slotCenterY, 0),
  ], false, 'centripetal', 0.45);
  const curvedInputArm = new THREE.Mesh(
    new THREE.TubeGeometry(curvedArmPath, 72, 0.085, 12, false),
    accentMaterial,
  );
  curvedInputArm.userData.role = 'rigid-curved-input-arm-of-bell-crank';
  const upperSlotRail = makeBeam(
    new THREE.Vector3(slotMinimumX, slotCenterY + 0.115, 0),
    new THREE.Vector3(slotMaximumX, slotCenterY + 0.115, 0),
    { color: PALETTE.accent, depth: 0.16, thickness: 0.075 },
  );
  const lowerSlotRail = makeBeam(
    new THREE.Vector3(slotMinimumX, slotCenterY - 0.115, 0),
    new THREE.Vector3(slotMaximumX, slotCenterY - 0.115, 0),
    { color: PALETTE.accent, depth: 0.16, thickness: 0.075 },
  );
  upperSlotRail.userData.role = 'upper-rail-of-horizontal-follower-slot';
  lowerSlotRail.userData.role = 'lower-rail-of-horizontal-follower-slot';
  const slotEnd = cylinderAlongY(0.055, 0.23, accentMaterial, 18);
  slotEnd.position.set(slotMinimumX, slotCenterY, 0);
  slotEnd.userData.role = 'closed-end-of-follower-slot';
  const bellOutputArm = makeBeam(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(bellOutputArmLength, 0, 0),
    { color: PALETTE.accent, depth: 0.18, thickness: 0.13 },
  );
  bellOutputArm.userData.role = 'horizontal-output-arm-of-bell-crank';
  const outputJointHub = cylinderAlongZ(0.15, 0.40, darkMaterial, 30);
  outputJointHub.position.x = bellOutputArmLength;
  outputJointHub.userData.role = 'bell-crank-output-joint';
  bellCrank.add(
    curvedInputArm,
    upperSlotRail,
    lowerSlotRail,
    slotEnd,
    bellOutputArm,
    outputJointHub,
  );
  const bellPivotHub = cylinderAlongZ(0.20, 0.46, darkMaterial, 34);
  bellPivotHub.position.copy(bellPivot);
  bellPivotHub.userData.role = 'fixed-bell-crank-pivot';
  const bellPivotSupport = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.54, 4),
    frameMaterial,
  );
  bellPivotSupport.position.set(
    bellPivot.x,
    bellPivot.y - 0.34,
    bellPivot.z,
  );
  bellPivotSupport.rotation.y = Math.PI / 4;
  bellPivotSupport.userData.role = 'fixed-support-under-bell-crank-pivot';

  const connectingRod = makeBeam(
    nominalBellState.outputJoint,
    new THREE.Vector3(sliderX, middlePulleyY, bellPivot.z),
    { color: PALETTE.ink, depth: 0.15, thickness: 0.11 },
  );
  connectingRod.userData.role =
    'finite-link-from-bell-crank-to-guided-belt-fork';
  const beltForkSlide = new THREE.Group();
  beltForkSlide.position.y = middlePulleyY;
  beltForkSlide.userData.role =
    'vertically-guided-yoke-shifting-the-single-belt';
  const forkCrossbar = cylinderAlongZ(
    0.075,
    pulleyRadius * 2 + 0.46,
    accentMaterial,
    24,
  );
  forkCrossbar.position.set(sliderX, 0, 0);
  forkCrossbar.userData.role = 'belt-fork-crossbar-between-both-spans';
  const forkShoes = [-1, 1].map((sign, index) => {
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.30, 0.16),
      accentMaterial,
    );
    shoe.position.set(sliderX, 0, sign * pulleyRadius);
    shoe.userData.role = `belt-shifting-shoe-${index + 1}`;
    return shoe;
  });
  const forkIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.055, 0.055),
    indexMaterial,
  );
  forkIndex.position.set(sliderX + 0.18, 0, pulleyRadius + 0.10);
  forkIndex.userData.role = 'white-index-on-belt-shifting-fork';
  beltForkSlide.add(forkCrossbar, ...forkShoes, forkIndex);

  const driverUpperPulley = makePulley({
    axis: Y_AXIS,
    color: PALETTE.driver,
    grooves: 1,
    radius: pulleyRadius,
    spokes: 4,
    width: 0.25,
  });
  driverUpperPulley.position.y = upperPulleyY;
  driverUpperPulley.userData.fastOnGovernorSpindle = true;
  driverUpperPulley.userData.role =
    'upper-fast-pulley-selected-by-underspeed';
  const driverUpperPulleyRotor = driverUpperPulley.userData.rotor;
  const driverMiddlePulley = makePulley({
    axis: Y_AXIS,
    color: PALETTE.accent,
    grooves: 1,
    radius: pulleyRadius,
    spokes: 4,
    width: 0.25,
  });
  driverMiddlePulley.position.y = middlePulleyY;
  driverMiddlePulley.userData.looseOnGovernorSpindle = true;
  driverMiddlePulley.userData.role = 'middle-loose-neutral-pulley';
  const driverMiddlePulleyRotor = driverMiddlePulley.userData.rotor;
  const driverLowerPulley = makePulley({
    axis: Y_AXIS,
    color: PALETTE.driver,
    grooves: 1,
    radius: pulleyRadius,
    spokes: 4,
    width: 0.25,
  });
  driverLowerPulley.position.y = lowerPulleyY;
  driverLowerPulley.userData.fastOnGovernorSpindle = true;
  driverLowerPulley.userData.role =
    'lower-fast-pulley-selected-by-overspeed';
  const driverLowerPulleyRotor = driverLowerPulley.userData.rotor;

  const receiverUpperPulley = makePulley({
    axis: Y_AXIS,
    color: PALETTE.driven,
    grooves: 1,
    radius: pulleyRadius,
    spokes: 4,
    width: 0.25,
  });
  receiverUpperPulley.position.set(receiverX, upperPulleyY, 0);
  receiverUpperPulley.userData.keyedToOpeningTrain = true;
  receiverUpperPulley.userData.role =
    'upper-receiver-pulley-keyed-to-opening-bevel';
  const receiverUpperPulleyRotor = receiverUpperPulley.userData.rotor;
  const receiverMiddlePulley = makePulley({
    axis: Y_AXIS,
    color: PALETTE.accent,
    grooves: 1,
    radius: pulleyRadius,
    spokes: 4,
    width: 0.25,
  });
  receiverMiddlePulley.position.set(receiverX, middlePulleyY, 0);
  receiverMiddlePulley.userData.looseOnReceiverShaft = true;
  receiverMiddlePulley.userData.role = 'middle-loose-neutral-receiver';
  const receiverMiddlePulleyRotor = receiverMiddlePulley.userData.rotor;
  const receiverLowerPulley = makePulley({
    axis: Y_AXIS,
    color: PALETTE.driven,
    grooves: 1,
    radius: pulleyRadius,
    spokes: 4,
    width: 0.25,
  });
  receiverLowerPulley.position.set(receiverX, lowerPulleyY, 0);
  receiverLowerPulley.userData.keyedToClosingTrain = true;
  receiverLowerPulley.userData.role =
    'lower-receiver-pulley-keyed-to-closing-bevel';
  const receiverLowerPulleyRotor = receiverLowerPulley.userData.rotor;
  const driverPulleyPhases = [0.18, -0.31, 0.52];
  const receiverPulleyPhases = [-0.22, 0.37, -0.48];

  const belt = makeMovingBelt(beltCurve, {
    markerCount: beltMarkerCount,
    radius: beltRadius,
  });
  belt.rotation.x = Math.PI / 2;
  belt.position.y = middlePulleyY;
  belt.userData.active = true;
  belt.userData.installed = true;
  belt.userData.mechanismBelt = true;
  belt.userData.selectorBelt = true;
  belt.userData.role =
    'one-belt-shifted-between-upper-fast-middle-loose-and-lower-fast-planes';
  // makeMovingBelt adds the tube first and then its arc-length markers.
  const beltMarkers = belt.children.slice(1);
  beltMarkers.forEach((marker, index) => {
    marker.userData.role = `white-arc-length-belt-marker-${index + 1}`;
  });

  const receiverUpperShaft = cylinderAlongY(
    0.105,
    upperPulleyY - lowerTrainApex.y + 0.18,
    darkMaterial,
    34,
  );
  receiverUpperShaft.position.set(
    receiverX,
    (upperPulleyY + lowerTrainApex.y - 0.18) / 2,
    0,
  );
  receiverUpperShaft.userData.role =
    'nested-shaft-from-upper-receiver-to-upper-bevel';
  const receiverLowerShaft = cylinderAlongY(
    0.15,
    lowerPulleyY - lowerTrainApex.y + 0.22,
    darkMaterial,
    34,
  );
  receiverLowerShaft.position.set(
    receiverX,
    (lowerPulleyY + lowerTrainApex.y - 0.22) / 2,
    0,
  );
  receiverLowerShaft.userData.role =
    'hollow-shaft-from-lower-receiver-to-lower-bevel';
  const gateOutputShaft = cylinderAlongZ(0.105, 3.75, darkMaterial, 36);
  gateOutputShaft.position.z = 1.72;
  gateOutputShaft.userData.role =
    'common-reversing-output-shaft-to-gate-pinion';
  outputBevelGearRotor.add(gateOutputShaft);

  const gatePinionZ = 3.0;
  const gatePinion = makeGear({
    axis: Z_AXIS,
    color: PALETTE.accent,
    depth: 0.26,
    radius: gatePinionPitchRadius,
    teeth: 12,
    toothHeight: 0.075,
  });
  gatePinion.position.set(receiverX, lowerTrainApex.y, gatePinionZ);
  gatePinion.userData.role = 'reversible-output-pinion-driving-water-gate';
  const gatePinionRotor = gatePinion.userData.rotor;
  const gatePinionIndex = gatePinionRotor.children.at(-1);
  gatePinionIndex.userData.role = 'white-index-on-gate-pinion';
  const gatePortCenterY = -5.18;
  const gatePortHeight = 1;
  const gatePortBottomY = gatePortCenterY - gatePortHeight / 2;
  const gateHeight = gatePortHeight;
  const gateLowCenterY = gatePortBottomY - gateHeight / 2;
  const gateRackLength = 3.25;
  const gateRackLowCenterY = -5.0;
  const gateToRackCenterOffset = gateLowCenterY - gateRackLowCenterY;
  const gateX = receiverX + 1.65;
  const rackX = receiverX + gatePinionPitchRadius;
  const gateSlide = new THREE.Group();
  gateSlide.position.y = gateRackLowCenterY;
  gateSlide.userData.role = 'guided-water-gate-and-rack-assembly';
  const gatePlate = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, gateHeight, 0.16),
    driverMaterial,
  );
  gatePlate.position.set(gateX, gateToRackCenterOffset, gatePinionZ + 0.02);
  gatePlate.userData.role =
    'rising-shuttle-that-restricts-water-at-overspeed';
  const gateIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.06, 0.025),
    indexMaterial,
  );
  gateIndex.position.set(0, 0, 0.10);
  gateIndex.userData.role = 'white-index-on-water-gate';
  gatePlate.add(gateIndex);
  const gateRackSpine = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, gateRackLength, 0.14),
    accentMaterial,
  );
  gateRackSpine.position.set(rackX + 0.08, 0, gatePinionZ);
  gateRackSpine.userData.role = 'vertical-rack-meshing-gate-pinion';
  const rackToothPitch = fullTurn * gatePinionPitchRadius / 12;
  const rackToothCount = Math.floor(gateRackLength / rackToothPitch);
  const gateRackTeeth = Array.from({ length: rackToothCount }, (_, index) => {
    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, rackToothPitch * 0.56, 0.17),
      accentMaterial,
    );
    tooth.position.set(
      receiverX + gatePinionPitchRadius - 0.005,
      -gateRackLength / 2 + (index + 0.5) * rackToothPitch,
      gatePinionZ,
    );
    tooth.userData.role = 'working-tooth-on-water-gate-rack';
    return tooth;
  });
  const rackToGateBridge = makeBeam(
    new THREE.Vector3(rackX + 0.08, 0, gatePinionZ),
    new THREE.Vector3(gateX - 0.70, gateToRackCenterOffset, gatePinionZ),
    { color: PALETTE.accent, depth: 0.12, thickness: 0.10 },
  );
  rackToGateBridge.userData.role = 'rigid-bridge-from-rack-to-water-gate';
  gateSlide.add(
    gatePlate,
    gateRackSpine,
    ...gateRackTeeth,
    rackToGateBridge,
  );

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-governor-pulley-frame-and-water-channel';
  const frameZ = -2.35;
  const sourceFrameLeftX = (
    sourceRasterFrameLeftX - sourceRasterSpindleAxisX
  ) * sourceUnitsPerPixel;
  const sourceFrameRightX = (
    sourceRasterFrameRightX - sourceRasterSpindleAxisX
  ) * sourceUnitsPerPixel;
  const sourceFrameTopY = topPivotY + (
    sourceRasterTopPivotLeft.y - sourceRasterFrameTopY
  ) * sourceUnitsPerPixel;
  const frameBottomY = -4.65;
  const sourceFrameTop = makeBeam(
    new THREE.Vector3(sourceFrameLeftX, sourceFrameTopY, frameZ),
    new THREE.Vector3(sourceFrameRightX, sourceFrameTopY, frameZ),
    { color: PALETTE.frame, depth: 0.25, thickness: 0.18 },
  );
  sourceFrameTop.userData.role = 'source-u-frame-top-member';
  const sourceFrameLeft = makeBeam(
    new THREE.Vector3(sourceFrameLeftX, sourceFrameTopY, frameZ),
    new THREE.Vector3(sourceFrameLeftX, frameBottomY, frameZ),
    { color: PALETTE.frame, depth: 0.25, thickness: 0.18 },
  );
  sourceFrameLeft.userData.role = 'source-u-frame-left-leg';
  const sourceFrameRight = makeBeam(
    new THREE.Vector3(sourceFrameRightX, sourceFrameTopY, frameZ),
    new THREE.Vector3(sourceFrameRightX, frameBottomY, frameZ),
    { color: PALETTE.frame, depth: 0.25, thickness: 0.18 },
  );
  sourceFrameRight.userData.role = 'source-u-frame-right-leg';
  const rearBase = makeBeam(
    new THREE.Vector3(-2.45, -6.25, frameZ),
    new THREE.Vector3(8.45, -6.25, frameZ),
    { color: PALETTE.frame, depth: 0.28, thickness: 0.20 },
  );
  rearBase.userData.role = 'extended-base-for-receiver-and-water-gate';
  const rearGovernorStandard = makeBeam(
    new THREE.Vector3(0, -6.25, frameZ),
    new THREE.Vector3(0, sourceFrameTopY, frameZ),
    { color: PALETTE.frame, depth: 0.23, thickness: 0.17 },
  );
  rearGovernorStandard.userData.role =
    'rear-support-from-base-to-source-u-frame';
  const receiverStandard = makeBeam(
    new THREE.Vector3(receiverX, -6.25, frameZ),
    new THREE.Vector3(receiverX, -1.95, frameZ),
    { color: PALETTE.frame, depth: 0.23, thickness: 0.17 },
  );
  receiverStandard.userData.role = 'rear-support-for-receiver-stack';
  const sliderGuide = makeBeam(
    new THREE.Vector3(sliderX, sourceFrameTopY + 0.35, bellPivot.z + 0.35),
    new THREE.Vector3(sliderX, upperPulleyY + 0.55, bellPivot.z + 0.35),
    { color: PALETTE.frame, depth: 0.18, thickness: 0.14 },
  );
  sliderGuide.userData.role = 'fixed-vertical-guide-behind-belt-shifter';
  const leftWaterDuct = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 1.28, 0.82),
    drivenMaterial,
  );
  leftWaterDuct.position.set(gateX - 1.83, gatePortCenterY, gatePinionZ + 0.42);
  leftWaterDuct.userData.role = 'upstream-water-channel-to-shuttle';
  const rightWaterDuct = leftWaterDuct.clone();
  rightWaterDuct.position.x = gateX + 1.83;
  rightWaterDuct.userData.role = 'downstream-water-channel-from-shuttle';
  const waterPort = new THREE.Mesh(
    new THREE.BoxGeometry(1.62, gatePortHeight, 0.18),
    darkMaterial,
  );
  waterPort.position.set(gateX, gatePortCenterY, gatePinionZ + 0.16);
  waterPort.userData.role = 'water-port-covered-by-rising-shuttle';
  const gateGuideLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, gateStroke + gateHeight + 0.34, 0.34),
    frameMaterial,
  );
  gateGuideLeft.position.set(
    gateX - 0.88,
    gatePortCenterY + gateStroke / 2,
    gatePinionZ + 0.02,
  );
  gateGuideLeft.userData.role = 'left-fixed-water-gate-guide';
  const gateGuideRight = gateGuideLeft.clone();
  gateGuideRight.position.x = gateX + 0.88;
  gateGuideRight.userData.role = 'right-fixed-water-gate-guide';
  fixedFrame.add(
    sourceFrameTop,
    sourceFrameLeft,
    sourceFrameRight,
    rearBase,
    rearGovernorStandard,
    receiverStandard,
    sliderGuide,
    bellPivotHub,
    bellPivotSupport,
    leftWaterDuct,
    rightWaterDuct,
    waterPort,
    gateGuideLeft,
    gateGuideRight,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(12.2, 12.4, 8.4),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(3.2, -1.15, 0.65);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-governor-belt-receiver-and-gate';

  root.add(
    cameraEnvelope,
    fixedFrame,
    governorRotor,
    nonrotatingFollowerSlide,
    bellCrank,
    connectingRod,
    beltForkSlide,
    driverUpperPulley,
    driverMiddlePulley,
    driverLowerPulley,
    receiverUpperPulley,
    receiverMiddlePulley,
    receiverLowerPulley,
    belt,
    receiverUpperShaft,
    receiverLowerShaft,
    upperBevelGear,
    lowerBevelGear,
    outputBevelGear,
    gatePinion,
    gateSlide,
  );

  const rotatingPointKinematics = ({
    angle,
    angularAcceleration,
    angularSpeed,
    radialAcceleration = 0,
    radialSpeed = 0,
    radius,
    verticalAcceleration = 0,
    verticalSpeed = 0,
    y,
  }) => {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const radialComponent = radialAcceleration - radius * angularSpeed ** 2;
    const tangentialComponent = 2 * radialSpeed * angularSpeed
      + radius * angularAcceleration;
    return {
      acceleration: new THREE.Vector3(
        radialComponent * cosine - tangentialComponent * sine,
        verticalAcceleration,
        -radialComponent * sine - tangentialComponent * cosine,
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
    const cycleIndex = Math.floor(time / cyclePeriod);
    const localTime = time - cycleIndex * cyclePeriod;
    const speedState = speedStateAtLocalTime(localTime);
    const {
      localSpindleAngle,
      spindleAngularAcceleration,
      spindleAngularJerk,
      spindleAngularSpeed,
    } = speedState;
    const spindleAngle = cycleIndex * spindleAnglePerCycle
      + localSpindleAngle;
    let spreadLower = minimumSpreadAngle;
    let spreadUpper = maximumSpreadAngle;
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const middle = (spreadLower + spreadUpper) / 2;
      if (equilibriumAtSpreadAngle(middle).spindleAngularSpeed
        < spindleAngularSpeed) {
        spreadLower = middle;
      } else {
        spreadUpper = middle;
      }
    }
    const spreadAngle = (spreadLower + spreadUpper) / 2;
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
    const bellState = bellStateAtSleeve(
      sleeveY,
      sleeveVelocityY,
      sleeveAccelerationY,
    );
    const lowerEpisode = episodeFactor(
      localTime,
      highShiftEnd,
      lowerRampInEnd,
      lowerRampOutStart,
      lowerRampOutEnd,
    );
    const upperEpisode = episodeFactor(
      localTime,
      lowShiftEnd,
      upperRampInEnd,
      upperRampOutStart,
      upperRampOutEnd,
    );
    const lowerEffectiveTime = episodeEffectiveTime(
      localTime,
      highShiftEnd,
      lowerRampInEnd,
      lowerRampOutStart,
      lowerRampOutEnd,
    );
    const upperEffectiveTime = episodeEffectiveTime(
      localTime,
      lowShiftEnd,
      upperRampInEnd,
      upperRampOutStart,
      upperRampOutEnd,
    );
    const lowerAngularTravel = maximumSpindleAngularSpeed
      * lowerEffectiveTime;
    const upperAngularTravel = minimumSpindleAngularSpeed
      * upperEffectiveTime;
    const outputAngularDisplacement = lowerAngularTravel
      - upperAngularTravel;
    const outputAngularSpeed = lowerEpisode.factor
      * spindleAngularSpeed - upperEpisode.factor * spindleAngularSpeed;
    const outputAngularAcceleration = (
      lowerEpisode.rate - upperEpisode.rate
    ) * spindleAngularSpeed + (
      lowerEpisode.factor - upperEpisode.factor
    ) * spindleAngularAcceleration;
    const beltDriveFactor = lowerEpisode.factor + upperEpisode.factor;
    const beltDriveFactorRate = lowerEpisode.rate + upperEpisode.rate;
    const beltLinearSpeed = beltDriveFactor
      * spindleAngularSpeed * pulleyRadius;
    const beltLinearAcceleration = (
      beltDriveFactorRate * spindleAngularSpeed
        + beltDriveFactor * spindleAngularAcceleration
    ) * pulleyRadius;
    const localBeltDistance = pulleyRadius * (
      lowerAngularTravel + upperAngularTravel
    );
    const beltDistance = cycleIndex * beltDistancePerCycle
      + localBeltDistance;
    const gateLift = outputAngularDisplacement * gatePinionPitchRadius;
    const gateVelocityY = outputAngularSpeed * gatePinionPitchRadius;
    const gateAccelerationY = outputAngularAcceleration
      * gatePinionPitchRadius;
    const gateRackCenterY = gateRackLowCenterY + gateLift;
    const gateCenterY = gateLowCenterY + gateLift;
    const gateRestrictedFraction = gateLift / gateStroke;
    const waterOpenFraction = 1 - gateRestrictedFraction;
    const upperBevelGearAngle = upperBevelGearPhase
      - outputAngularDisplacement;
    const lowerBevelGearAngle = lowerBevelGearPhase
      - outputAngularDisplacement;
    const outputBevelGearAngle = outputBevelGearPhase
      + outputAngularDisplacement;
    const upperBevelGearAngularSpeed = -outputAngularSpeed;
    const lowerBevelGearAngularSpeed = -outputAngularSpeed;
    const upperReceiverPhysicalAngularSpeed = -outputAngularSpeed;
    const lowerReceiverPhysicalAngularSpeed = outputAngularSpeed;
    const upperReceiverPulleyAngle = receiverPulleyPhases[0]
      - outputAngularDisplacement;
    const lowerReceiverPulleyAngle = receiverPulleyPhases[2]
      + outputAngularDisplacement;
    const driverUpperPulleyAngle = driverPulleyPhases[0] + spindleAngle;
    const driverMiddlePulleyAngle = driverPulleyPhases[1];
    const driverLowerPulleyAngle = driverPulleyPhases[2] + spindleAngle;
    const upperMeshInvariant = lowerGearTeeth
      * (upperBevelGearAngle - upperBevelGearPhase)
      + lowerGearTeeth
        * (outputBevelGearAngle - outputBevelGearPhase);
    const lowerMeshInvariant = lowerGearTeeth
      * (lowerBevelGearAngle - lowerBevelGearPhase)
      + lowerGearTeeth
        * (outputBevelGearAngle - outputBevelGearPhase);
    const upperGearVelocity = new THREE.Vector3().crossVectors(
      topGearAxis,
      upperMeshContactPoint.clone().sub(lowerTrainApex),
    ).multiplyScalar(upperBevelGearAngularSpeed);
    const outputUpperVelocity = new THREE.Vector3().crossVectors(
      outputGearAxis,
      upperMeshContactPoint.clone().sub(lowerTrainApex),
    ).multiplyScalar(outputAngularSpeed);
    const lowerGearVelocity = new THREE.Vector3().crossVectors(
      lowerGearAxis,
      lowerMeshContactPoint.clone().sub(lowerTrainApex),
    ).multiplyScalar(lowerBevelGearAngularSpeed);
    const outputLowerVelocity = new THREE.Vector3().crossVectors(
      outputGearAxis,
      lowerMeshContactPoint.clone().sub(lowerTrainApex),
    ).multiplyScalar(outputAngularSpeed);
    const upperGearAcceleration = new THREE.Vector3().crossVectors(
      topGearAxis,
      upperMeshContactPoint.clone().sub(lowerTrainApex),
    ).multiplyScalar(-outputAngularAcceleration);
    const outputUpperAcceleration = new THREE.Vector3().crossVectors(
      outputGearAxis,
      upperMeshContactPoint.clone().sub(lowerTrainApex),
    ).multiplyScalar(outputAngularAcceleration);
    const lowerGearAcceleration = new THREE.Vector3().crossVectors(
      lowerGearAxis,
      lowerMeshContactPoint.clone().sub(lowerTrainApex),
    ).multiplyScalar(-outputAngularAcceleration);
    const outputLowerAcceleration = new THREE.Vector3().crossVectors(
      outputGearAxis,
      lowerMeshContactPoint.clone().sub(lowerTrainApex),
    ).multiplyScalar(outputAngularAcceleration);
    const rackContactOffset = X_AXIS.clone().multiplyScalar(
      gatePinionPitchRadius,
    );
    const pinionSurfaceVelocity = new THREE.Vector3().crossVectors(
      outputGearAxis,
      rackContactOffset,
    ).multiplyScalar(outputAngularSpeed);
    const rackVelocity = Y_AXIS.clone().multiplyScalar(gateVelocityY);
    const pinionTangentialAcceleration = new THREE.Vector3().crossVectors(
      outputGearAxis,
      rackContactOffset,
    ).multiplyScalar(outputAngularAcceleration);
    const rackAcceleration = Y_AXIS.clone().multiplyScalar(gateAccelerationY);
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
        localBall: new THREE.Vector3(sign * ballOrbitRadius, ballCenterY, 0),
        localElbow: new THREE.Vector3(sign * elbowOrbitRadius, elbowY, 0),
        localSleevePin: new THREE.Vector3(sign * sleevePinRadius, sleeveY, 0),
        localUpperPivot: new THREE.Vector3(sign * topPivotRadius, topPivotY, 0),
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
    const beltMarkerStates = Array.from(
      { length: beltMarkerCount },
      (_, index) => {
        const phase = THREE.MathUtils.euclideanModulo(
          beltDistance / beltLength + index / beltMarkerCount,
          1,
        );
        const localPoint = beltCurve.getPointAt(phase);
        const localTangent = beltCurve.getTangentAt(phase).normalize();
        return {
          index,
          phase,
          position: new THREE.Vector3(
            localPoint.x,
            bellState.beltY,
            localPoint.y,
          ),
          velocity: new THREE.Vector3(
            localTangent.x * beltLinearSpeed,
            bellState.beltVelocityY,
            localTangent.y * beltLinearSpeed,
          ),
        };
      },
    );
    let selectorPosition;
    if (Math.abs(bellState.beltY - lowerPulleyY) < 1e-8) {
      selectorPosition = 'lower-fast-closing';
    } else if (Math.abs(bellState.beltY - upperPulleyY) < 1e-8) {
      selectorPosition = 'upper-fast-opening';
    } else if (Math.abs(bellState.beltY - middlePulleyY) < 1e-8) {
      selectorPosition = 'middle-loose-neutral';
    } else if (bellState.beltY < middlePulleyY) {
      selectorPosition = 'shifting-toward-lower-fast-pulley';
    } else {
      selectorPosition = 'shifting-toward-upper-fast-pulley';
    }
    let stage;
    if (localTime < highShiftStart) {
      stage = 'proper-speed-belt-on-middle-loose-pulley-gate-open';
    } else if (localTime < highShiftEnd) {
      stage = 'overspeed-bell-crank-shifts-belt-down';
    } else if (localTime < lowerRampInEnd) {
      stage = 'lower-fast-pulley-takes-up-the-belt-smoothly';
    } else if (localTime < lowerRampOutStart) {
      stage = 'lower-fast-pulley-drives-gearing-to-raise-gate';
    } else if (localTime < lowerRampOutEnd) {
      stage = 'lower-fast-pulley-releases-the-belt';
    } else if (localTime < highReturnEnd) {
      stage = 'bell-crank-returns-belt-to-middle-loose-pulley';
    } else if (localTime < lowShiftStart) {
      stage = 'proper-speed-belt-neutral-gate-held-restricted';
    } else if (localTime < lowShiftEnd) {
      stage = 'underspeed-bell-crank-shifts-belt-up';
    } else if (localTime < upperRampInEnd) {
      stage = 'upper-fast-pulley-takes-up-the-belt-smoothly';
    } else if (localTime < upperRampOutStart) {
      stage = 'upper-fast-pulley-drives-gearing-to-lower-gate';
    } else if (localTime < upperRampOutEnd) {
      stage = 'upper-fast-pulley-releases-the-belt';
    } else if (localTime < lowReturnEnd) {
      stage = 'bell-crank-returns-belt-to-neutral-after-opening';
    } else {
      stage = 'proper-speed-belt-on-middle-loose-pulley-gate-reopened';
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
      bellAngle: bellState.bellAngle,
      bellAngularAcceleration: bellState.bellAngularAcceleration,
      bellAngularSpeed: bellState.bellAngularSpeed,
      bellConstraintSlope: bellState.bellConstraintSlope,
      beltAccelerationY: bellState.beltAccelerationY,
      beltAxialPosition: bellState.beltY,
      beltDistance,
      beltDriveFactor,
      beltDriveFactorRate,
      beltLinearAcceleration,
      beltLinearSpeed,
      beltMarkerStates,
      beltVelocityY: bellState.beltVelocityY,
      cycleIndex,
      followerY: bellState.followerY,
      gateAccelerationY,
      gateCenterY,
      gateLift,
      gateRackCenterY,
      gateRackNoSlipAccelerationError:
        pinionTangentialAcceleration.distanceTo(rackAcceleration),
      gateRackNoSlipSpeedError: pinionSurfaceVelocity.distanceTo(rackVelocity),
      gateRestrictedFraction,
      gateVelocityY,
      localTime,
      lowerBevelGearAngle,
      lowerBevelGearAngularAcceleration: -outputAngularAcceleration,
      lowerBevelGearAngularSpeed,
      lowerEpisodeFactor: lowerEpisode.factor,
      lowerEpisodeFactorRate: lowerEpisode.rate,
      lowerHorizontalAcceleration,
      lowerHorizontalOffset,
      lowerHorizontalSpeed,
      lowerMeshInvariant,
      lowerMeshSurfaceVelocityError: lowerGearVelocity.distanceTo(
        outputLowerVelocity,
      ),
      lowerMeshTangentialAccelerationError: lowerGearAcceleration.distanceTo(
        outputLowerAcceleration,
      ),
      lowerReceiverPhysicalAngularSpeed,
      lowerSelectedBeltSlipSpeed: lowerEpisode.factor > 0
        ? Math.abs(
          spindleAngularSpeed * pulleyRadius - beltLinearSpeed
        )
        : 0,
      lowerVerticalDrop,
      outputAngularAcceleration,
      outputAngularDisplacement,
      outputAngularSpeed,
      outputBevelGearAngle,
      outputJoint: bellState.outputJoint,
      outputJointAcceleration: bellState.outputJointAcceleration,
      outputJointVelocity: bellState.outputJointVelocity,
      selectorPosition,
      sleeveAccelerationY,
      sleeveOffset,
      sleeveVelocityY,
      sleeveY,
      slotConstraintError: bellState.slotConstraintError,
      slotCoordinate: bellState.slotCoordinate,
      slotSlidingAcceleration: bellState.slotSlidingAcceleration,
      slotSlidingSpeed: bellState.slotSlidingSpeed,
      spindleAngle,
      spindleAngularAcceleration,
      spindleAngularJerk,
      spindleAngularSpeed,
      spreadAngle,
      spreadAngularAcceleration,
      spreadAngularSpeed,
      stage,
      upperBevelGearAngle,
      upperBevelGearAngularAcceleration: -outputAngularAcceleration,
      upperBevelGearAngularSpeed,
      upperEpisodeFactor: upperEpisode.factor,
      upperEpisodeFactorRate: upperEpisode.rate,
      upperMeshInvariant,
      upperMeshSurfaceVelocityError: upperGearVelocity.distanceTo(
        outputUpperVelocity,
      ),
      upperMeshTangentialAccelerationError: upperGearAcceleration.distanceTo(
        outputUpperAcceleration,
      ),
      upperReceiverPhysicalAngularSpeed,
      upperSelectedBeltSlipSpeed: upperEpisode.factor > 0
        ? Math.abs(
          spindleAngularSpeed * pulleyRadius - beltLinearSpeed
        )
        : 0,
      verticalConnectingRodLengthError: bellState.outputJoint.distanceTo(
        new THREE.Vector3(sliderX, bellState.beltY, bellPivot.z),
      ) - connectingRodLength,
      waterOpenFraction,
      driverUpperPulleyAngle,
      driverMiddlePulleyAngle,
      driverLowerPulleyAngle,
      upperReceiverPulleyAngle,
      lowerReceiverPulleyAngle,
    };
  };

  const canonicalTimes = {
    properGateOpen: 0.2,
    shiftingToLower: (highShiftStart + highShiftEnd) / 2,
    lowerFastContact: highShiftEnd,
    maximumSpeedClosing: lowerRampInEnd
      + (lowerRampOutStart - lowerRampInEnd) / 2,
    lowerFastRelease: lowerRampOutEnd,
    properGateRestricted: (highReturnEnd + lowShiftStart) / 2,
    shiftingToUpper: (lowShiftStart + lowShiftEnd) / 2,
    upperFastContact: lowShiftEnd,
    minimumSpeedOpening: upperRampInEnd
      + upperEffectiveDriveDuration / 2
      - (upperRampInEnd - lowShiftEnd) / 2,
    upperFastRelease: upperRampOutEnd,
    nextProperGateOpen: (lowReturnEnd + cyclePeriod) / 2,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, canonicalTime]) => [
      name,
      stateAtTime(canonicalTime),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    governorRotor.rotation.y = state.spindleAngle;
    rotatingSleeveSlide.position.y = state.sleeveOffset;
    nonrotatingFollowerSlide.position.y = state.sleeveOffset;
    bellCrank.rotation.z = state.bellAngle;
    connectingRod.userData.setEndpoints(
      state.outputJoint,
      new THREE.Vector3(sliderX, state.beltAxialPosition, bellPivot.z),
    );
    beltForkSlide.position.y = state.beltAxialPosition;
    driverUpperPulleyRotor.rotation.z = state.driverUpperPulleyAngle;
    driverMiddlePulleyRotor.rotation.z = state.driverMiddlePulleyAngle;
    driverLowerPulleyRotor.rotation.z = state.driverLowerPulleyAngle;
    receiverUpperPulleyRotor.rotation.z = state.upperReceiverPulleyAngle;
    receiverMiddlePulleyRotor.rotation.z = receiverPulleyPhases[1];
    receiverLowerPulleyRotor.rotation.z = state.lowerReceiverPulleyAngle;
    belt.position.y = state.beltAxialPosition;
    belt.userData.updateDistance(state.beltDistance);
    upperBevelGearRotor.rotation.z = state.upperBevelGearAngle;
    lowerBevelGearRotor.rotation.z = state.lowerBevelGearAngle;
    outputBevelGearRotor.rotation.z = state.outputBevelGearAngle;
    gatePinionRotor.rotation.z = state.outputAngularDisplacement;
    gateSlide.position.y = state.gateRackCenterY;
    gateSlide.userData.velocityY = state.gateVelocityY;
    gateSlide.userData.accelerationY = state.gateAccelerationY;
    gatePlate.userData.waterOpenFraction = state.waterOpenFraction;
    governorRotor.userData.angularSpeed = state.spindleAngularSpeed;
    governorRotor.userData.angularAcceleration =
      state.spindleAngularAcceleration;
    driverUpperPulleyRotor.userData.angularSpeed = state.spindleAngularSpeed;
    driverLowerPulleyRotor.userData.angularSpeed = state.spindleAngularSpeed;
    driverMiddlePulleyRotor.userData.angularSpeed = 0;
    receiverUpperPulleyRotor.userData.angularSpeed =
      state.upperReceiverPhysicalAngularSpeed;
    receiverMiddlePulleyRotor.userData.angularSpeed = 0;
    receiverLowerPulleyRotor.userData.angularSpeed =
      state.lowerReceiverPhysicalAngularSpeed;
    upperBevelGearRotor.userData.angularSpeed =
      state.upperBevelGearAngularSpeed;
    lowerBevelGearRotor.userData.angularSpeed =
      state.lowerBevelGearAngularSpeed;
    outputBevelGearRotor.userData.angularSpeed = state.outputAngularSpeed;
    gatePinionRotor.userData.angularSpeed = state.outputAngularSpeed;
    belt.userData.linearSpeed = state.beltLinearSpeed;
    belt.userData.axialVelocity = state.beltVelocityY;
    belt.userData.selectorPosition = state.selectorPosition;
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
      beltSelector: {
        oneInstalledBelt: true,
        position: state.selectorPosition,
        pulleyPlaneY: state.beltAxialPosition,
      },
      gateRack: {
        noSlipAccelerationError: state.gateRackNoSlipAccelerationError,
        noSlipSpeedError: state.gateRackNoSlipSpeedError,
        pitchRadius: gatePinionPitchRadius,
      },
      lowerBevelMesh: {
        contactPoint: lowerMeshContactPoint.clone(),
        meshInvariant: state.lowerMeshInvariant,
        surfaceVelocityError: state.lowerMeshSurfaceVelocityError,
        tangentialAccelerationError:
          state.lowerMeshTangentialAccelerationError,
      },
      lowerFastPulley: {
        engagement: state.lowerEpisodeFactor,
        slipSpeed: state.lowerSelectedBeltSlipSpeed,
      },
      upperBevelMesh: {
        contactPoint: upperMeshContactPoint.clone(),
        meshInvariant: state.upperMeshInvariant,
        surfaceVelocityError: state.upperMeshSurfaceVelocityError,
        tangentialAccelerationError:
          state.upperMeshTangentialAccelerationError,
      },
      upperFastPulley: {
        engagement: state.upperEpisodeFactor,
        slipSpeed: state.upperSelectedBeltSlipSpeed,
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
    'flyball-bell-crank-single-belt-three-pulley-reversing-water-gate-governor';
  root.userData.cameraDistanceScale = 1.12;
  root.userData.blocks = {
    ballAssemblies,
    bellCrank,
    bellOutputArm,
    bellPivotHub,
    bellPivotSupport,
    belt,
    beltForkSlide,
    beltMarkers,
    cameraEnvelope,
    connectingRod,
    curvedInputArm,
    driverLowerPulley,
    driverLowerPulleyRotor,
    driverMiddlePulley,
    driverMiddlePulleyRotor,
    driverUpperPulley,
    driverUpperPulleyRotor,
    fixedFrame,
    followerBridge,
    followerDropRod,
    followerIndex,
    followerRoller,
    forkCrossbar,
    forkIndex,
    forkShoes,
    gateGuideLeft,
    gateGuideRight,
    gateIndex,
    gateOutputShaft,
    gatePinion,
    gatePinionIndex,
    gatePinionRotor,
    gatePlate,
    gateRackSpine,
    gateRackTeeth,
    gateSlide,
    governorRotor,
    leftWaterDuct,
    lowerBevelGear,
    lowerBevelGearRotor,
    lowerSlotRail,
    nonrotatingFollowerSlide,
    outputBevelGear,
    outputBevelGearRotor,
    outputJointHub,
    rackToGateBridge,
    rearBase,
    rearGovernorStandard,
    receiverLowerPulley,
    receiverLowerPulleyRotor,
    receiverLowerShaft,
    receiverMiddlePulley,
    receiverMiddlePulleyRotor,
    receiverStandard,
    receiverUpperPulley,
    receiverUpperPulleyRotor,
    receiverUpperShaft,
    rightWaterDuct,
    rotatingSleeve,
    rotatingSleeveSlide,
    sliderGuide,
    sleeveCrossbar,
    slotEnd,
    sourceFrameLeft,
    sourceFrameRight,
    sourceFrameTop,
    spindle,
    spindleIndex,
    thrustCollar,
    topHeadCrossbar,
    topHeadHub,
    upperBevelGear,
    upperBevelGearRotor,
    upperSlotRail,
    waterPort,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.equilibriumAtSpreadAngle = equilibriumAtSpreadAngle;
  root.userData.geometry = {
    ballIndexRadialOffset,
    ballMass,
    ballRadius,
    bellOutputArmLength,
    bellPivot: bellPivot.clone(),
    beltDistancePerCycle,
    beltLength,
    beltMarkerCount,
    beltRadius,
    closingAngularTravel,
    connectingRodLength,
    cyclePeriod,
    driverPulleyPhases: [...driverPulleyPhases],
    elbowArmLength,
    engagementTravelMismatch,
    followerDrop,
    followerNominalY,
    followerX,
    frameBottomY,
    frameZ,
    fullTurn,
    gateHeight,
    gateLowCenterY,
    gatePinionPitchRadius,
    gatePinionZ,
    gatePortBottomY,
    gatePortCenterY,
    gatePortHeight,
    gateRackLength,
    gateRackLowCenterY,
    gateStroke,
    gateToRackCenterOffset,
    gateX,
    gravityAcceleration,
    highReturnEnd,
    highShiftEnd,
    highShiftStart,
    lowerEffectiveDriveDuration,
    lowerGearAxis: lowerGearAxis.clone(),
    lowerGearOuterDistance,
    lowerGearPitchConeAngle,
    lowerGearPitchRadius,
    lowerGearTeeth,
    lowerLinkLength,
    lowerMeshContactPoint: lowerMeshContactPoint.clone(),
    lowerPulleyY,
    lowerRampInEnd,
    lowerRampOutEnd,
    lowerRampOutStart,
    lowerTrainApex: lowerTrainApex.clone(),
    lowReturnEnd,
    lowShiftEnd,
    lowShiftStart,
    maximumBellState,
    maximumEquilibrium,
    maximumSpindleAngularSpeed,
    maximumSpreadAngle,
    middlePulleyY,
    minimumBellState,
    minimumEquilibrium,
    minimumSpindleAngularSpeed,
    minimumSpreadAngle,
    nominalBellState,
    nominalElbowOrbitRadius,
    nominalElbowY,
    nominalEquilibrium,
    nominalSleeveY,
    nominalSpindleAngularSpeed,
    nominalSpreadAngle,
    outputBevelGearPhase,
    outputGearAxis: outputGearAxis.clone(),
    pulleyRadius,
    pulleySpacing,
    rackToothCount,
    rackToothPitch,
    rackX,
    receiverPulleyPhases: [...receiverPulleyPhases],
    receiverX,
    selectorSymmetryError,
    sliderX,
    sleevePinRadius,
    slotCenterY,
    slotFollowerOffsetX,
    slotMaximumX,
    slotMinimumX,
    sourceBallLeft: sourceBallLeft.clone(),
    sourceBeltFork: sourceBeltFork.clone(),
    sourceBellOutputJoint: sourceBellOutputJoint.clone(),
    sourceBellPivot: sourceBellPivot.clone(),
    sourceElbowLeft: sourceElbowLeft.clone(),
    sourceFollowerPin: sourceFollowerPin.clone(),
    sourceFrameLeftX,
    sourceFrameRightX,
    sourceFrameTopY,
    sourceImageHeight,
    sourceImageWidth,
    sourceRasterBallLeft: sourceRasterBallLeft.clone(),
    sourceRasterBallRadius,
    sourceRasterBallRight: sourceRasterBallRight.clone(),
    sourceRasterBellOutputJoint: sourceRasterBellOutputJoint.clone(),
    sourceRasterBellPivot: sourceRasterBellPivot.clone(),
    sourceRasterBeltFork: sourceRasterBeltFork.clone(),
    sourceRasterElbowLeft: sourceRasterElbowLeft.clone(),
    sourceRasterElbowRight: sourceRasterElbowRight.clone(),
    sourceRasterFollowerPin: sourceRasterFollowerPin.clone(),
    sourceRasterFrameLeftX,
    sourceRasterFrameRightX,
    sourceRasterFrameTopY,
    sourceRasterLowerPulleyCenterY,
    sourceRasterMiddlePulleyCenterY,
    sourceRasterSleeveLeft: sourceRasterSleeveLeft.clone(),
    sourceRasterSleeveRight: sourceRasterSleeveRight.clone(),
    sourceRasterSpindleAxisX,
    sourceRasterTopPivotLeft: sourceRasterTopPivotLeft.clone(),
    sourceRasterTopPivotRight: sourceRasterTopPivotRight.clone(),
    sourceRasterUpperPulleyCenterY,
    sourceSleeveLeft: sourceSleeveLeft.clone(),
    sourceSleeveY,
    sourceTopPivotLeft: sourceTopPivotLeft.clone(),
    sourceUnitsPerPixel,
    speedSegments,
    spindleAnglePerCycle,
    spindleBottomY,
    spindleTopY,
    topGearAxis: topGearAxis.clone(),
    topPivotRadius,
    topPivotY,
    upperArmLength,
    upperBevelGearPhase,
    upperEffectiveDriveDuration,
    upperMeshContactPoint: upperMeshContactPoint.clone(),
    upperPulleyY,
    upperRampInEnd,
    upperRampOutEnd,
    upperRampOutStart,
    upperSteadyDuration,
  };
  root.userData.bellStateAtSleeve = bellStateAtSleeve;
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
    followerIndex,
    forkIndex,
    gateIndex,
    gatePinionIndex,
    spindleIndex,
    upperBevelGear.userData.faceIndex,
    lowerBevelGear.userData.faceIndex,
    outputBevelGear.userData.faceIndex,
    ...ballAssemblies.map(({ ballIndex }) => ballIndex),
    ...beltMarkers,
    ...upperBevelGear.userData.toothMeshes.filter(({ userData }) => (
      userData.index === upperBevelGear.userData.indexToothIndex
    )),
    ...lowerBevelGear.userData.toothMeshes.filter(({ userData }) => (
      userData.index === lowerBevelGear.userData.indexToothIndex
    )),
    ...outputBevelGear.userData.toothMeshes.filter(({ userData }) => (
      userData.index === outputBevelGear.userData.indexToothIndex
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
    cameraDirection: new THREE.Vector3(10.5, 6.2, 14.5),
    root,
    update,
  };
}

export function createAuthoredBeltGovernorMovement(movement) {
  switch (movement.id) {
    case 163: return beltShiftWaterGovernorMotion();
    default: return null;
  }
}
