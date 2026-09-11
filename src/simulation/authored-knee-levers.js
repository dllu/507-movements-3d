import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevel = 0.012) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 32,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function annularShape(innerRadius, outerRadius) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return shape;
}

function makeTaperedKneeLink(material, ringMaterial, depth) {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.07);
  shape.bezierCurveTo(0.10, -0.15, 0.38, -0.26, 0.72, -0.30);
  shape.bezierCurveTo(0.88, -0.32, 0.96, -0.29, 1, -0.24);
  shape.lineTo(1, 0.24);
  shape.bezierCurveTo(0.96, 0.29, 0.88, 0.32, 0.72, 0.30);
  shape.bezierCurveTo(0.38, 0.26, 0.10, 0.15, 0, 0.07);
  shape.closePath();
  const plate = new THREE.Mesh(
    centeredExtrusion(shape, depth, 0.015),
    material,
  );
  plate.userData.role = 'source-tapered-compression-link-body';
  const footRing = new THREE.Mesh(
    centeredExtrusion(annularShape(0.105, 0.19), depth + 0.025, 0.008),
    ringMaterial,
  );
  footRing.userData.role = 'lower-eye-of-knee-compression-link';
  const kneeRing = new THREE.Mesh(
    centeredExtrusion(annularShape(0.115, 0.25), depth + 0.025, 0.008),
    ringMaterial,
  );
  kneeRing.userData.role = 'upper-eye-of-knee-compression-link';
  group.add(plate, footRing, kneeRing);
  group.userData.setEndpoints = (foot, knee) => {
    const direction = knee.clone().sub(foot);
    const length = direction.length();
    group.position.copy(foot);
    group.quaternion.setFromUnitVectors(
      X_AXIS,
      direction.clone().normalize(),
    );
    plate.scale.x = length;
    footRing.position.set(0, 0, 0);
    kneeRing.position.set(length, 0, 0);
    group.userData.length = length;
  };
  group.userData.plate = plate;
  group.userData.footRing = footRing;
  group.userData.kneeRing = kneeRing;
  return group;
}

function kneeLeverPressMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Pixel measurements from the 525 px public-domain engraving. The source
  // pose is the lowered-handle/open-crosshead limit. Brown's short knee arm
  // and long handle are perpendicular within the line thickness.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterTopPivot = new THREE.Vector2(241, 75);
  const sourceRasterKneePin = new THREE.Vector2(212, 146);
  const sourceRasterFixedFoot = new THREE.Vector2(242, 466);
  const sourceRasterHandleEnd = new THREE.Vector2(497, 180);
  const sourceRasterMovingPlateLeftX = 108;
  const sourceRasterMovingPlateRightX = 378;
  const sourceRasterMovingPlateBottomY = 53;
  const sourceRasterFootBlockLeftX = 202;
  const sourceRasterFootBlockRightX = 279;
  const sourceRasterFootBlockTopY = 455;
  const sourceRasterBaseLeftX = 47;
  const sourceRasterBaseRightX = 423;
  const sourceRasterBaseTopY = 497;
  const sourceUnitsPerPixel = 0.018;
  const openCrossheadY = 3.8;
  const sourceToModel = (point) => new THREE.Vector2(
    (point.x - sourceRasterTopPivot.x) * sourceUnitsPerPixel,
    openCrossheadY - (point.y - sourceRasterTopPivot.y)
      * sourceUnitsPerPixel,
  );
  const sourceKneeArmLength = sourceRasterTopPivot.distanceTo(
    sourceRasterKneePin,
  );
  const sourceHandleLength = sourceRasterTopPivot.distanceTo(
    sourceRasterHandleEnd,
  );
  const sourceOpenLeverAngle = Math.atan2(
    sourceRasterTopPivot.y - sourceRasterHandleEnd.y,
    sourceRasterHandleEnd.x - sourceRasterTopPivot.x,
  );
  const kneeArmLength = sourceKneeArmLength * sourceUnitsPerPixel;
  const handleLength = sourceHandleLength * sourceUnitsPerPixel;
  const openLeverAngle = sourceOpenLeverAngle;
  const closedLeverAngle = 0;
  const sourcePredictedKnee = new THREE.Vector2(
    sourceRasterTopPivot.x
      + kneeArmLength * Math.sin(openLeverAngle) / sourceUnitsPerPixel,
    sourceRasterTopPivot.y
      + kneeArmLength * Math.cos(openLeverAngle) / sourceUnitsPerPixel,
  );
  const fixedFoot = new THREE.Vector3(
    0,
    sourceToModel(sourceRasterFixedFoot).y,
    0,
  );
  const openPredictedKnee = new THREE.Vector3(
    kneeArmLength * Math.sin(openLeverAngle),
    openCrossheadY - kneeArmLength * Math.cos(openLeverAngle),
    0,
  );
  const lowerLinkLength = openPredictedKnee.distanceTo(fixedFoot);

  const quintic = (unit) => unit ** 3 * (
    10 + unit * (-15 + 6 * unit)
  );
  const quinticFirst = (unit) => 30 * unit ** 2 * (1 - unit) ** 2;
  const quinticSecond = (unit) => 60 * unit * (1 - unit)
    * (1 - 2 * unit);

  const linkageAtLeverMotion = (
    leverAngle,
    leverAngularSpeed = 0,
    leverAngularAcceleration = 0,
  ) => {
    const sine = Math.sin(leverAngle);
    const cosine = Math.cos(leverAngle);
    const horizontalKneeOffset = kneeArmLength * sine;
    const horizontalKneeSlope = kneeArmLength * cosine;
    const horizontalKneeCurvature = -kneeArmLength * sine;
    const lowerVerticalProjection = Math.sqrt(
      lowerLinkLength ** 2 - horizontalKneeOffset ** 2,
    );
    const projectionSlope = -horizontalKneeOffset
      * horizontalKneeSlope / lowerVerticalProjection;
    const projectionCurvature = -(
      horizontalKneeSlope ** 2
        + horizontalKneeOffset * horizontalKneeCurvature
    ) / lowerVerticalProjection
      - (horizontalKneeOffset * horizontalKneeSlope) ** 2
        / lowerVerticalProjection ** 3;
    const crossheadY = fixedFoot.y
      + lowerVerticalProjection + kneeArmLength * cosine;
    const crossheadSlope = projectionSlope - kneeArmLength * sine;
    const crossheadCurvature = projectionCurvature
      - kneeArmLength * cosine;
    const crossheadVelocityY = crossheadSlope * leverAngularSpeed;
    const crossheadAccelerationY = crossheadCurvature
      * leverAngularSpeed ** 2
      + crossheadSlope * leverAngularAcceleration;
    const crossheadPosition = new THREE.Vector3(0, crossheadY, 0);
    const crossheadVelocity = new THREE.Vector3(
      0,
      crossheadVelocityY,
      0,
    );
    const crossheadAcceleration = new THREE.Vector3(
      0,
      crossheadAccelerationY,
      0,
    );
    const kneePosition = new THREE.Vector3(
      horizontalKneeOffset,
      fixedFoot.y + lowerVerticalProjection,
      0,
    );
    const kneeSlope = new THREE.Vector3(
      horizontalKneeSlope,
      projectionSlope,
      0,
    );
    const kneeCurvature = new THREE.Vector3(
      horizontalKneeCurvature,
      projectionCurvature,
      0,
    );
    const kneeVelocity = kneeSlope.clone().multiplyScalar(
      leverAngularSpeed,
    );
    const kneeAcceleration = kneeCurvature.clone().multiplyScalar(
      leverAngularSpeed ** 2,
    ).addScaledVector(kneeSlope, leverAngularAcceleration);
    const handleEndPosition = new THREE.Vector3(
      handleLength * cosine,
      crossheadY + handleLength * sine,
      0,
    );
    const handleSlope = new THREE.Vector3(
      -handleLength * sine,
      crossheadSlope + handleLength * cosine,
      0,
    );
    const handleCurvature = new THREE.Vector3(
      -handleLength * cosine,
      crossheadCurvature - handleLength * sine,
      0,
    );
    const handleEndVelocity = handleSlope.clone().multiplyScalar(
      leverAngularSpeed,
    );
    const handleEndAcceleration = handleCurvature.clone().multiplyScalar(
      leverAngularSpeed ** 2,
    ).addScaledVector(handleSlope, leverAngularAcceleration);
    const kneeArmVector = kneePosition.clone().sub(crossheadPosition);
    const kneeArmRelativeVelocity = kneeVelocity.clone().sub(
      crossheadVelocity,
    );
    const kneeArmRelativeAcceleration = kneeAcceleration.clone().sub(
      crossheadAcceleration,
    );
    const lowerLinkVector = fixedFoot.clone().sub(kneePosition);
    const lowerLinkRelativeVelocity = kneeVelocity.clone().negate();
    const lowerLinkRelativeAcceleration = kneeAcceleration.clone().negate();
    const handleVector = handleEndPosition.clone().sub(crossheadPosition);
    const handleRelativeVelocity = handleEndVelocity.clone().sub(
      crossheadVelocity,
    );
    const handleRelativeAcceleration = handleEndAcceleration.clone().sub(
      crossheadAcceleration,
    );
    const lengthRate = (vector, relativeVelocity, length) => (
      vector.dot(relativeVelocity) / length
    );
    const lengthAcceleration = (
      vector,
      relativeVelocity,
      relativeAcceleration,
      length,
    ) => (
      relativeVelocity.lengthSq() + vector.dot(relativeAcceleration)
    ) / length;
    const directionToCrosshead = crossheadPosition.clone()
      .sub(kneePosition).normalize();
    const directionToFoot = fixedFoot.clone()
      .sub(kneePosition).normalize();
    const kneeIncludedAngle = Math.atan2(
      directionToCrosshead.clone().cross(directionToFoot).length(),
      THREE.MathUtils.clamp(
        directionToCrosshead.dot(directionToFoot),
        -1,
        1,
      ),
    );
    const idealForceMultiplier = Math.abs(crossheadSlope) < 1e-12
      ? Infinity
      : handleLength / Math.abs(crossheadSlope);
    return {
      assemblyBranchMargin: lowerLinkLength
        - Math.abs(horizontalKneeOffset),
      crossheadAcceleration,
      crossheadAccelerationY,
      crossheadCurvature,
      crossheadPosition,
      crossheadSlope,
      crossheadVelocity,
      crossheadVelocityY,
      crossheadY,
      handleEndAcceleration,
      handleEndPosition,
      handleEndVelocity,
      handleLengthAccelerationError: lengthAcceleration(
        handleVector,
        handleRelativeVelocity,
        handleRelativeAcceleration,
        handleLength,
      ),
      handleLengthError: handleVector.length() - handleLength,
      handleLengthRateError: lengthRate(
        handleVector,
        handleRelativeVelocity,
        handleLength,
      ),
      handleVector,
      horizontalKneeOffset,
      idealForceMultiplier,
      kneeAcceleration,
      kneeArmLengthAccelerationError: lengthAcceleration(
        kneeArmVector,
        kneeArmRelativeVelocity,
        kneeArmRelativeAcceleration,
        kneeArmLength,
      ),
      kneeArmLengthError: kneeArmVector.length() - kneeArmLength,
      kneeArmLengthRateError: lengthRate(
        kneeArmVector,
        kneeArmRelativeVelocity,
        kneeArmLength,
      ),
      kneeArmVector,
      kneeCurvature,
      kneeIncludedAngle,
      kneePosition,
      kneeSlope,
      kneeStraightnessError: Math.PI - kneeIncludedAngle,
      kneeVelocity,
      leverAngle,
      leverAngularAcceleration,
      leverAngularSpeed,
      lowerLinkLengthAccelerationError: lengthAcceleration(
        lowerLinkVector,
        lowerLinkRelativeVelocity,
        lowerLinkRelativeAcceleration,
        lowerLinkLength,
      ),
      lowerLinkLengthError: lowerLinkVector.length() - lowerLinkLength,
      lowerLinkLengthRateError: lengthRate(
        lowerLinkVector,
        lowerLinkRelativeVelocity,
        lowerLinkLength,
      ),
      lowerLinkVector,
      lowerVerticalProjection,
      projectionCurvature,
      projectionSlope,
    };
  };

  const openLinkage = linkageAtLeverMotion(openLeverAngle);
  const closedLinkage = linkageAtLeverMotion(closedLeverAngle);
  const closedCrossheadY = closedLinkage.crossheadY;
  const crossheadStroke = closedCrossheadY - openCrossheadY;

  const cyclePeriod = 8;
  const closingEndPhase = 0.4;
  const returnStartPhase = 0.5;
  const returnEndPhase = 0.9;
  const strokePhaseDuration = 0.4;
  const strokeTime = strokePhaseDuration * cyclePeriod;
  const motionAtRawCyclePhase = (rawCyclePhase) => {
    // Subtracting floor preserves exact in-cycle boundary values such as 0.4
    // and 0.9. A double-modulo formulation perturbs those values downward by
    // one ulp and assigns the contact/dwell instants to the preceding stage.
    const unsnappedCyclePhase = rawCyclePhase - Math.floor(rawCyclePhase);
    const exactBoundary = [
      closingEndPhase,
      returnStartPhase,
      returnEndPhase,
    ].find((boundary) => (
      Math.abs(unsnappedCyclePhase - boundary) < 1e-12
    ));
    const cyclePhase = exactBoundary ?? unsnappedCyclePhase;
    let leverAngle;
    let leverAngularSpeed;
    let leverAngularAcceleration;
    let motionProgress;
    let stage;
    if (cyclePhase < closingEndPhase) {
      const unit = cyclePhase / strokePhaseDuration;
      motionProgress = quintic(unit);
      leverAngle = THREE.MathUtils.lerp(
        openLeverAngle,
        closedLeverAngle,
        motionProgress,
      );
      leverAngularSpeed = (closedLeverAngle - openLeverAngle)
        * quinticFirst(unit) / strokeTime;
      leverAngularAcceleration = (closedLeverAngle - openLeverAngle)
        * quinticSecond(unit) / strokeTime ** 2;
      stage = 'horizontal-lever-raised-to-straighten-knee';
    } else if (cyclePhase < returnStartPhase) {
      motionProgress = 1;
      leverAngle = closedLeverAngle;
      leverAngularSpeed = 0;
      leverAngularAcceleration = 0;
      stage = 'upper-crosshead-held-at-knee-dead-center';
    } else if (cyclePhase < returnEndPhase) {
      const unit = (cyclePhase - returnStartPhase) / strokePhaseDuration;
      const returnProgress = quintic(unit);
      motionProgress = 1 - returnProgress;
      leverAngle = THREE.MathUtils.lerp(
        closedLeverAngle,
        openLeverAngle,
        returnProgress,
      );
      leverAngularSpeed = (openLeverAngle - closedLeverAngle)
        * quinticFirst(unit) / strokeTime;
      leverAngularAcceleration = (openLeverAngle - closedLeverAngle)
        * quinticSecond(unit) / strokeTime ** 2;
      stage = 'horizontal-lever-lowered-to-release-crosshead';
    } else {
      motionProgress = 0;
      leverAngle = openLeverAngle;
      leverAngularSpeed = 0;
      leverAngularAcceleration = 0;
      stage = 'open-knee-lever-dwell';
    }
    return {
      cyclePhase,
      leverAngle,
      leverAngularAcceleration,
      leverAngularSpeed,
      motionProgress,
      rawCyclePhase,
      stage,
    };
  };
  const stateAtRawCyclePhase = (rawCyclePhase) => {
    const motion = motionAtRawCyclePhase(rawCyclePhase);
    const linkage = linkageAtLeverMotion(
      motion.leverAngle,
      motion.leverAngularSpeed,
      motion.leverAngularAcceleration,
    );
    const crossheadTravel = linkage.crossheadY - openCrossheadY;
    const rawPressureGap = closedCrossheadY - linkage.crossheadY;
    return {
      ...motion,
      ...linkage,
      atDeadCenter: Math.abs(linkage.horizontalKneeOffset) < 1e-10
        && Math.abs(linkage.kneeStraightnessError) < 2e-8,
      atOpenLimit: Math.abs(motion.leverAngle - openLeverAngle) < 1e-12,
      crossheadTravel,
      pressureContact: rawPressureGap < 1e-10,
      pressureGap: Math.max(0, rawPressureGap),
      rawPressureGap,
    };
  };
  const stateAtTime = (time) => stateAtRawCyclePhase(time / cyclePeriod);

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.59,
  });
  const drivenDarkMaterial = matte(0x174f69, {
    metalness: 0.17,
    roughness: 0.53,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.15,
    roughness: 0.68,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.47,
  });
  const workMaterial = matte(PALETTE.brass, {
    metalness: 0.25,
    roughness: 0.46,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const sourceMovingPlateWidth = (
    sourceRasterMovingPlateRightX - sourceRasterMovingPlateLeftX
  ) * sourceUnitsPerPixel;
  const sourceMovingPlateBottomOffset = (
    sourceRasterTopPivot.y - sourceRasterMovingPlateBottomY
  ) * sourceUnitsPerPixel;
  const sourceFootBlockWidth = (
    sourceRasterFootBlockRightX - sourceRasterFootBlockLeftX
  ) * sourceUnitsPerPixel;
  const sourceFootBlockHeight = (
    sourceRasterBaseTopY - sourceRasterFootBlockTopY
  ) * sourceUnitsPerPixel;
  const sourceBaseWidth = (
    sourceRasterBaseRightX - sourceRasterBaseLeftX
  ) * sourceUnitsPerPixel;
  const sourceBaseTopY = sourceToModel(
    new THREE.Vector2(sourceRasterTopPivot.x, sourceRasterBaseTopY),
  ).y;

  const framePlaneZ = -1.0;
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-reaction-frame-and-lower-knee-foot';
  const baseHeight = 0.34;
  const baseCenterX = (
    (sourceRasterBaseLeftX + sourceRasterBaseRightX) / 2
      - sourceRasterTopPivot.x
  ) * sourceUnitsPerPixel;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(sourceBaseWidth, baseHeight, 1.65),
    frameMaterial,
  );
  base.position.set(
    baseCenterX,
    sourceBaseTopY - baseHeight / 2,
    framePlaneZ,
  );
  base.userData.role = 'source-width-fixed-lower-press-base';
  const footBlockCenterX = (
    (sourceRasterFootBlockLeftX + sourceRasterFootBlockRightX) / 2
      - sourceRasterTopPivot.x
  ) * sourceUnitsPerPixel;
  const footBlockTopY = sourceToModel(new THREE.Vector2(
    sourceRasterTopPivot.x,
    sourceRasterFootBlockTopY,
  )).y;
  const fixedFootBlock = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourceFootBlockWidth,
      sourceFootBlockHeight,
      0.94,
    ),
    drivenDarkMaterial,
  );
  fixedFootBlock.position.set(
    footBlockCenterX,
    footBlockTopY - sourceFootBlockHeight / 2,
    0,
  );
  fixedFootBlock.userData.role = 'fixed-lower-bearing-block-under-knee-link';
  const fixedFootPin = cylinderAlongZ(0.13, 1.06, darkMaterial, 30);
  fixedFootPin.position.set(fixedFoot.x, fixedFoot.y, 0.28);
  fixedFootPin.userData.role = 'fixed-lower-pin-of-knee-compression-link';

  const movingPlateHeight = 0.34;
  const movingPlateCenterOffsetY = sourceMovingPlateBottomOffset
    + movingPlateHeight / 2;
  const pressureWorkpieceHeight = 0.16;
  const movingPressureFaceOffsetY = movingPlateCenterOffsetY
    + movingPlateHeight / 2;
  const pressureWorkpieceBottomY = closedCrossheadY
    + movingPressureFaceOffsetY;
  const pressureWorkpiece = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, pressureWorkpieceHeight, 0.94),
    workMaterial,
  );
  pressureWorkpiece.position.set(
    0,
    pressureWorkpieceBottomY + pressureWorkpieceHeight / 2,
    0,
  );
  pressureWorkpiece.userData.role =
    'stationary-workpiece-between-rising-crosshead-and-reaction-beam';
  const reactionBeamHeight = 0.44;
  const reactionBeam = new THREE.Mesh(
    new THREE.BoxGeometry(sourceBaseWidth, reactionBeamHeight, 1.65),
    frameMaterial,
  );
  reactionBeam.position.set(
    baseCenterX,
    pressureWorkpieceBottomY + pressureWorkpieceHeight
      + reactionBeamHeight / 2,
    framePlaneZ,
  );
  reactionBeam.userData.role = 'fixed-upper-reaction-beam-of-knee-press';
  const columnCenterY = (
    sourceBaseTopY + pressureWorkpieceBottomY + pressureWorkpieceHeight
  ) / 2;
  const columnHeight = pressureWorkpieceBottomY + pressureWorkpieceHeight
    - sourceBaseTopY;
  const frameColumns = [-1, 1].map((sign, index) => {
    const column = new THREE.Mesh(
      new THREE.BoxGeometry(0.27, columnHeight, 0.46),
      frameMaterial,
    );
    column.position.set(sign * 2.86, columnCenterY, framePlaneZ);
    column.userData.role = `rear-reaction-frame-column-${index + 1}`;
    return column;
  });
  const guideRailHeight = crossheadStroke + 1.18;
  const guideRailCenterY = (openCrossheadY + closedCrossheadY) / 2 + 0.24;
  const guideRailX = sourceMovingPlateWidth / 2 + 0.17;
  const crossheadGuideRails = [-1, 1].map((sign, index) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, guideRailHeight, 0.44),
      frameMaterial,
    );
    rail.position.set(sign * guideRailX, guideRailCenterY, -0.34);
    rail.userData.role = `fixed-vertical-crosshead-guide-${index + 1}`;
    return rail;
  });
  fixedFrame.add(
    base,
    fixedFootBlock,
    fixedFootPin,
    pressureWorkpiece,
    reactionBeam,
    ...frameColumns,
    ...crossheadGuideRails,
  );

  const movingCrosshead = new THREE.Group();
  movingCrosshead.position.y = openCrossheadY;
  movingCrosshead.userData.role =
    'vertically-guided-upper-pressure-crosshead-and-pivot';
  movingCrosshead.userData.translationAxis = Y_AXIS.clone();
  const movingPlate = new THREE.Mesh(
    new THREE.BoxGeometry(sourceMovingPlateWidth, movingPlateHeight, 1.15),
    drivenMaterial,
  );
  movingPlate.position.set(0, movingPlateCenterOffsetY, -0.08);
  movingPlate.userData.role = 'source-width-rising-upper-pressure-plate';
  const pivotBracketLeft = makeBeam(
    new THREE.Vector3(-0.58, sourceMovingPlateBottomOffset + 0.03, -0.18),
    new THREE.Vector3(-0.25, 0, -0.18),
    { color: PALETTE.driven, depth: 0.34, thickness: 0.23 },
  );
  pivotBracketLeft.userData.role = 'left-cheek-of-moving-pivot-bracket';
  const pivotBracketRight = makeBeam(
    new THREE.Vector3(0.58, sourceMovingPlateBottomOffset + 0.03, -0.18),
    new THREE.Vector3(0.25, 0, -0.18),
    { color: PALETTE.driven, depth: 0.34, thickness: 0.23 },
  );
  pivotBracketRight.userData.role = 'right-cheek-of-moving-pivot-bracket';
  const movingPivotShaft = cylinderAlongZ(0.17, 1.28, darkMaterial, 34);
  movingPivotShaft.position.z = 0.20;
  movingPivotShaft.userData.role = 'through-shaft-at-translating-lever-pivot';
  const movingPivotRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.075, 10, 44),
    drivenDarkMaterial,
  );
  movingPivotRing.position.z = -0.47;
  movingPivotRing.userData.role = 'bearing-ring-on-moving-crosshead-pivot';
  const crossheadIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.06, 0.035),
    indexMaterial,
  );
  crossheadIndex.position.set(
    sourceMovingPlateWidth * 0.30,
    movingPressureFaceOffsetY + 0.025,
    0.51,
  );
  crossheadIndex.userData.role = 'white-index-on-rising-crosshead';
  movingCrosshead.add(
    movingPlate,
    pivotBracketLeft,
    pivotBracketRight,
    movingPivotShaft,
    movingPivotRing,
    crossheadIndex,
  );

  const leverPlaneZ = 0.48;
  const leverAssembly = new THREE.Group();
  leverAssembly.position.y = openCrossheadY;
  leverAssembly.rotation.z = openLeverAngle;
  leverAssembly.userData.axis = Z_AXIS.clone();
  leverAssembly.userData.role =
    'rigid-perpendicular-handle-and-short-knee-arm';
  const handleBeam = makeBeam(
    new THREE.Vector3(0, 0, leverPlaneZ),
    new THREE.Vector3(handleLength, 0, leverPlaneZ),
    {
      color: PALETTE.driver,
      depth: 0.30,
      jointRadius: 0.24,
      thickness: 0.25,
    },
  );
  handleBeam.userData.role = 'long-horizontal-input-hand-lever';
  const shortKneeArm = makeBeam(
    new THREE.Vector3(0, 0, leverPlaneZ),
    new THREE.Vector3(0, -kneeArmLength, leverPlaneZ),
    {
      color: PALETTE.driver,
      depth: 0.32,
      jointRadius: 0.27,
      thickness: 0.30,
    },
  );
  shortKneeArm.userData.role = 'short-perpendicular-arm-carrying-knee-pin';
  const leverHub = cylinderAlongZ(0.29, 0.68, darkMaterial, 38);
  leverHub.position.z = leverPlaneZ;
  leverHub.userData.role = 'rotating-hub-on-translating-upper-pivot';
  const handleGripLength = 0.72;
  const handleGrip = makeBeam(
    new THREE.Vector3(handleLength - handleGripLength, 0, leverPlaneZ),
    new THREE.Vector3(handleLength, 0, leverPlaneZ),
    {
      color: PALETTE.ink,
      depth: 0.36,
      jointRadius: 0.16,
      thickness: 0.31,
    },
  );
  handleGrip.userData.role = 'dark-grip-at-end-of-knee-lever';
  const leverIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.16, 0.04),
    indexMaterial,
  );
  leverIndex.position.set(handleLength * 0.68, 0.19, leverPlaneZ + 0.17);
  leverIndex.userData.role = 'white-index-on-long-hand-lever';
  leverAssembly.add(
    handleBeam,
    shortKneeArm,
    leverHub,
    handleGrip,
    leverIndex,
  );

  const lowerLinkPlaneZ = 0.08;
  const lowerCompressionLink = makeTaperedKneeLink(
    drivenMaterial,
    drivenDarkMaterial,
    0.30,
  );
  lowerCompressionLink.userData.role =
    'single-source-shaped-link-from-fixed-foot-to-knee';
  const kneePin = cylinderAlongZ(0.14, 1.10, darkMaterial, 32);
  kneePin.position.set(
    openLinkage.kneePosition.x,
    openLinkage.kneePosition.y,
    0.29,
  );
  kneePin.userData.role = 'shared-through-pin-at-knee-joint';
  const kneeIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 16, 10),
    indexMaterial,
  );
  kneeIndex.position.set(
    openLinkage.kneePosition.x,
    openLinkage.kneePosition.y,
    0.86,
  );
  kneeIndex.userData.role = 'white-index-on-moving-knee-pin';
  lowerCompressionLink.userData.setEndpoints(
    new THREE.Vector3(fixedFoot.x, fixedFoot.y, lowerLinkPlaneZ),
    new THREE.Vector3(
      openLinkage.kneePosition.x,
      openLinkage.kneePosition.y,
      lowerLinkPlaneZ,
    ),
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(10.5, 9.8, 4.5),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(1.45, 0.52, -0.18);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-of-handle-crosshead-frame-and-lower-foot';

  root.add(
    cameraEnvelope,
    fixedFrame,
    movingCrosshead,
    leverAssembly,
    lowerCompressionLink,
    kneePin,
    kneeIndex,
  );

  const canonicalTimes = {
    sourceOpen: 0,
    raisingMidpoint: cyclePeriod * 0.2,
    deadCenterContact: cyclePeriod * closingEndPhase,
    deadCenterDwell: cyclePeriod * 0.45,
    loweringMidpoint: cyclePeriod * 0.7,
    openDwell: cyclePeriod * 0.95,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    movingCrosshead.position.y = state.crossheadY;
    movingCrosshead.userData.velocityY = state.crossheadVelocityY;
    movingCrosshead.userData.accelerationY = state.crossheadAccelerationY;
    leverAssembly.position.y = state.crossheadY;
    leverAssembly.rotation.z = state.leverAngle;
    leverAssembly.userData.angularSpeed = state.leverAngularSpeed;
    leverAssembly.userData.angularAcceleration =
      state.leverAngularAcceleration;
    lowerCompressionLink.userData.setEndpoints(
      new THREE.Vector3(fixedFoot.x, fixedFoot.y, lowerLinkPlaneZ),
      new THREE.Vector3(
        state.kneePosition.x,
        state.kneePosition.y,
        lowerLinkPlaneZ,
      ),
    );
    kneePin.position.set(
      state.kneePosition.x,
      state.kneePosition.y,
      0.29,
    );
    kneeIndex.position.set(
      state.kneePosition.x,
      state.kneePosition.y,
      0.86,
    );
    movingPlate.userData.pressureGap = state.pressureGap;
    pressureWorkpiece.userData.inContact = state.pressureContact;
    root.userData.contacts = {
      crossheadGuides: {
        axis: Y_AXIS.clone(),
        lateralError: Math.abs(movingCrosshead.position.x),
        rotationError: Math.hypot(
          movingCrosshead.rotation.x,
          movingCrosshead.rotation.y,
          movingCrosshead.rotation.z,
        ),
      },
      fixedFootPin: {
        center: fixedFoot.clone(),
        centerError: Math.hypot(
          fixedFootPin.position.x - fixedFoot.x,
          fixedFootPin.position.y - fixedFoot.y,
        ),
      },
      kneeDeadCenter: {
        horizontalOffset: state.horizontalKneeOffset,
        includedAngle: state.kneeIncludedAngle,
        straightnessError: state.kneeStraightnessError,
      },
      lowerLinkPins: {
        accelerationError: state.lowerLinkLengthAccelerationError,
        lengthError: state.lowerLinkLengthError,
        rateError: state.lowerLinkLengthRateError,
      },
      pressureFaces: {
        gap: state.pressureGap,
        inContact: state.pressureContact,
        movingPoint: new THREE.Vector3(
          0,
          state.crossheadY + movingPressureFaceOffsetY,
          0,
        ),
        stationaryPoint: new THREE.Vector3(
          0,
          pressureWorkpieceBottomY,
          0,
        ),
      },
      rigidKneeArm: {
        accelerationError: state.kneeArmLengthAccelerationError,
        lengthError: state.kneeArmLengthError,
        rateError: state.kneeArmLengthRateError,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData.mechanism =
    'vertically-guided-crosshead-single-knee-link-dead-center-press';
  root.userData.cameraDistanceScale = 1.04;
  root.userData.blocks = {
    base,
    cameraEnvelope,
    crossheadGuideRails,
    crossheadIndex,
    fixedFootBlock,
    fixedFootPin,
    fixedFrame,
    frameColumns,
    handleBeam,
    handleGrip,
    kneeIndex,
    kneePin,
    leverAssembly,
    leverHub,
    leverIndex,
    lowerCompressionLink,
    movingCrosshead,
    movingPivotRing,
    movingPivotShaft,
    movingPlate,
    pivotBracketLeft,
    pivotBracketRight,
    pressureWorkpiece,
    reactionBeam,
    shortKneeArm,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = {
    baseCenterX,
    baseHeight,
    closedCrossheadY,
    closedLeverAngle,
    closingEndPhase,
    crossheadStroke,
    cyclePeriod,
    fixedFoot: fixedFoot.clone(),
    footBlockCenterX,
    footBlockTopY,
    framePlaneZ,
    fullTurn,
    guideRailHeight,
    guideRailX,
    handleGripLength,
    handleLength,
    kneeArmLength,
    leverPlaneZ,
    lowerLinkLength,
    lowerLinkPlaneZ,
    movingPlateCenterOffsetY,
    movingPlateHeight,
    movingPressureFaceOffsetY,
    openCrossheadY,
    openLeverAngle,
    pressureWorkpieceBottomY,
    pressureWorkpieceHeight,
    returnEndPhase,
    returnStartPhase,
    sourceBaseTopY,
    sourceBaseWidth,
    sourceFootBlockHeight,
    sourceFootBlockWidth,
    sourceHandleLength,
    sourceImageHeight,
    sourceImageWidth,
    sourceKneeArmLength,
    sourceMovingPlateBottomOffset,
    sourceMovingPlateWidth,
    sourceOpenLeverAngle,
    sourcePredictedKnee,
    sourceRasterBaseLeftX,
    sourceRasterBaseRightX,
    sourceRasterBaseTopY,
    sourceRasterFixedFoot: sourceRasterFixedFoot.clone(),
    sourceRasterFootBlockLeftX,
    sourceRasterFootBlockRightX,
    sourceRasterFootBlockTopY,
    sourceRasterHandleEnd: sourceRasterHandleEnd.clone(),
    sourceRasterKneePin: sourceRasterKneePin.clone(),
    sourceRasterMovingPlateBottomY,
    sourceRasterMovingPlateLeftX,
    sourceRasterMovingPlateRightX,
    sourceRasterTopPivot: sourceRasterTopPivot.clone(),
    sourceUnitsPerPixel,
    strokePhaseDuration,
    strokeTime,
  };
  root.userData.linkageAtLeverMotion = linkageAtLeverMotion;
  root.userData.motionAtRawCyclePhase = motionAtRawCyclePhase;
  root.userData.stateAtRawCyclePhase = stateAtRawCyclePhase;
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
    crossheadIndex,
    kneeIndex,
    leverIndex,
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
    cameraDirection: new THREE.Vector3(8.2, 4.8, 14.2),
    root,
    update,
  };
}

export function createAuthoredKneeLeverMovement(movement) {
  switch (movement.id) {
    case 164: return kneeLeverPressMotion();
    default: return null;
  }
}
