import {ring} from './finite-plate-geometry.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeDynamicLink,
  markShadows,
  matte,
} from './primitives.js';

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
    bevelEnabled: bevel > 0,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 32,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function horizontalCapsuleShape(radius, straightHalfLength) {
  const shape = new THREE.Shape();
  shape.moveTo(-straightHalfLength, -radius);
  shape.lineTo(straightHalfLength, -radius);
  shape.absarc(
    straightHalfLength,
    0,
    radius,
    -Math.PI / 2,
    Math.PI / 2,
    false,
  );
  shape.lineTo(-straightHalfLength, radius);
  shape.absarc(
    -straightHalfLength,
    0,
    radius,
    Math.PI / 2,
    Math.PI * 1.5,
    false,
  );
  shape.closePath();
  return shape;
}

function horizontalCapsuleRingShape(
  innerRadius,
  outerRadius,
  straightHalfLength,
) {
  const shape = horizontalCapsuleShape(outerRadius, straightHalfLength);
  const hole = new THREE.Path();
  hole.moveTo(straightHalfLength, -innerRadius);
  hole.lineTo(-straightHalfLength, -innerRadius);
  hole.absarc(
    -straightHalfLength,
    0,
    innerRadius,
    -Math.PI / 2,
    Math.PI / 2,
    true,
  );
  hole.lineTo(straightHalfLength, innerRadius);
  hole.absarc(
    straightHalfLength,
    0,
    innerRadius,
    Math.PI / 2,
    -Math.PI / 2,
    true,
  );
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function solveLinearRows(rowA, rowB, rightA, rightB) {
  const determinant = rowA.x * rowB.y - rowA.y * rowB.x;
  if (Math.abs(determinant) < 1e-12) {
    throw new Error('Variable-crank linkage reached a singular closed-link pose.');
  }
  return new THREE.Vector2(
    (rightA * rowB.y - rowA.y * rightB) / determinant,
    (rowA.x * rightB - rightA * rowB.x) / determinant,
  );
}

function cross2(left, right) {
  return left.x * right.y - left.y * right.x;
}

function variableRadiusEllipticalCrankDrive() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Brown's drawing leaves the upper pivot of the right-hand power member
  // outside the engraving. The site's reference construction makes that
  // hidden closure explicit in drawing units: the two visible pitman halves
  // are each 10, the fixed shaft spacing is 10, the auxiliary crank radius is
  // 2, and the long power rocker reaches a pivot 30 units above its wrist.
  // These ratios create the approximately 2:1 elliptical slot-pin orbit.
  const sourceAnimationMainPivot = new THREE.Vector2(-10, 0);
  const sourceAnimationAuxiliaryPivot = new THREE.Vector2(0, 0);
  const sourceAnimationRemotePowerPivot = new THREE.Vector2(10, 30);
  const sourceAnimationAuxiliaryCrankRadius = 2;
  const sourceAnimationPitmanHalfSpan = 10;
  const sourceAnimationPowerLinkLength = 30;
  const sourceAnimationPoseCycle = 0.2;
  const sourceAnimationViewHalfSize = 13.5;

  // Approximate raster locks from the 525 px public-domain engraving. The
  // executable ratios above define the closure; these locks preserve Brown's
  // left-to-right topology, source pose, and relative component scale.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterMainShaftCenter = new THREE.Vector2(70, 267);
  const sourceRasterAuxiliaryShaftCenter = new THREE.Vector2(286, 264);
  const sourceRasterAuxiliaryPinCenter = new THREE.Vector2(310, 217);
  const sourceRasterMainSlotPinCenter = new THREE.Vector2(123, 161);
  const sourceRasterPowerWristCenter = new THREE.Vector2(473, 263);
  const sourceRasterEllipseLeftX = 25;
  const sourceRasterEllipseRightX = 117;
  const sourceRasterEllipseTopY = 145;
  const sourceRasterEllipseBottomY = 399;

  const sourceScale = 0.26;
  const shaftSpacing = sourceAnimationPitmanHalfSpan * sourceScale;
  const pitmanHalfSpan = sourceAnimationPitmanHalfSpan * sourceScale;
  const powerLinkLength = sourceAnimationPowerLinkLength * sourceScale;
  const auxiliaryCrankRadius = sourceAnimationAuxiliaryCrankRadius
    * sourceScale;
  const sourcePoseAngle = sourceAnimationPoseCycle * fullTurn;
  const mainPivot = sourceAnimationMainPivot.clone().multiplyScalar(
    sourceScale,
  );
  const auxiliaryPivot = sourceAnimationAuxiliaryPivot.clone().multiplyScalar(
    sourceScale,
  );
  const remotePowerPivot = sourceAnimationRemotePowerPivot.clone()
    .multiplyScalar(sourceScale);
  const nominalPowerWrist = new THREE.Vector2(shaftSpacing, 0);
  const auxiliaryAngularSpeed = 0.62;
  const cyclePeriod = fullTurn / auxiliaryAngularSpeed;

  const positiveModulo = (value, modulus) => {
    const remainder = value % modulus;
    if (remainder === 0) return 0;
    return remainder < 0 ? remainder + modulus : remainder;
  };

  const positionAtNormalizedAuxiliaryAngle = (normalizedAngle) => {
    const cosine = Math.cos(normalizedAngle);
    const sine = Math.sin(normalizedAngle);
    const auxiliaryPin = new THREE.Vector2(
      auxiliaryCrankRadius * cosine,
      auxiliaryCrankRadius * sine,
    );
    const centerVector = remotePowerPivot.clone().sub(auxiliaryPin);
    const centerDistance = centerVector.length();
    const centerUnit = centerVector.clone().divideScalar(centerDistance);
    const along = (
      pitmanHalfSpan ** 2
        - powerLinkLength ** 2
        + centerDistance ** 2
    ) / (2 * centerDistance);
    const perpendicularDistance = Math.sqrt(Math.max(
      0,
      pitmanHalfSpan ** 2 - along ** 2,
    ));
    const base = auxiliaryPin.clone().addScaledVector(centerUnit, along);
    const perpendicular = new THREE.Vector2(-centerUnit.y, centerUnit.x);
    const candidateA = base.clone().addScaledVector(
      perpendicular,
      perpendicularDistance,
    );
    const candidateB = base.clone().addScaledVector(
      perpendicular,
      -perpendicularDistance,
    );
    const powerWrist = candidateA.distanceToSquared(nominalPowerWrist)
      <= candidateB.distanceToSquared(nominalPowerWrist)
      ? candidateA
      : candidateB;
    const mainSlotPin = auxiliaryPin.clone().multiplyScalar(2).sub(
      powerWrist,
    );
    return {
      auxiliaryPin,
      mainSlotPin,
      powerWrist,
    };
  };

  const rawMainAngleAtZero = (() => {
    const { mainSlotPin } = positionAtNormalizedAuxiliaryAngle(0);
    return Math.atan2(
      mainSlotPin.y - mainPivot.y,
      mainSlotPin.x - mainPivot.x,
    );
  })();

  const motionAtAuxiliaryAngle = (
    auxiliaryAngle,
    auxiliaryAngleSpeed = auxiliaryAngularSpeed,
    auxiliaryAngleAcceleration = 0,
  ) => {
    const cycleIndex = Math.floor(auxiliaryAngle / fullTurn);
    const normalizedAuxiliaryAngle = positiveModulo(
      auxiliaryAngle,
      fullTurn,
    );
    const cosine = Math.cos(normalizedAuxiliaryAngle);
    const sine = Math.sin(normalizedAuxiliaryAngle);
    const {
      auxiliaryPin,
      mainSlotPin,
      powerWrist,
    } = positionAtNormalizedAuxiliaryAngle(normalizedAuxiliaryAngle);

    const auxiliaryPinFirstDerivative = new THREE.Vector2(
      -auxiliaryCrankRadius * sine,
      auxiliaryCrankRadius * cosine,
    );
    const auxiliaryPinSecondDerivative = new THREE.Vector2(
      -auxiliaryCrankRadius * cosine,
      -auxiliaryCrankRadius * sine,
    );
    const auxiliaryPinVelocity = auxiliaryPinFirstDerivative.clone()
      .multiplyScalar(auxiliaryAngleSpeed);
    const auxiliaryPinAcceleration = auxiliaryPinSecondDerivative.clone()
      .multiplyScalar(auxiliaryAngleSpeed ** 2)
      .addScaledVector(
        auxiliaryPinFirstDerivative,
        auxiliaryAngleAcceleration,
      );

    const rightPitmanVector = powerWrist.clone().sub(auxiliaryPin);
    const powerLinkVector = powerWrist.clone().sub(remotePowerPivot);
    const powerWristVelocity = solveLinearRows(
      rightPitmanVector,
      powerLinkVector,
      rightPitmanVector.dot(auxiliaryPinVelocity),
      0,
    );
    const relativeRightVelocity = powerWristVelocity.clone().sub(
      auxiliaryPinVelocity,
    );
    const powerWristAcceleration = solveLinearRows(
      rightPitmanVector,
      powerLinkVector,
      rightPitmanVector.dot(auxiliaryPinAcceleration)
        - relativeRightVelocity.lengthSq(),
      -powerWristVelocity.lengthSq(),
    );
    const mainSlotPinVelocity = auxiliaryPinVelocity.clone()
      .multiplyScalar(2)
      .sub(powerWristVelocity);
    const mainSlotPinAcceleration = auxiliaryPinAcceleration.clone()
      .multiplyScalar(2)
      .sub(powerWristAcceleration);
    const leftPitmanVector = mainSlotPin.clone().sub(auxiliaryPin);
    const mainCrankVector = mainSlotPin.clone().sub(mainPivot);
    const mainRadius = mainCrankVector.length();
    const mainRadiusFirstDerivative = mainCrankVector.dot(
      mainSlotPinVelocity,
    ) / mainRadius;
    const mainRadiusSecondDerivative = (
      mainSlotPinVelocity.lengthSq()
        + mainCrankVector.dot(mainSlotPinAcceleration)
        - mainRadiusFirstDerivative ** 2
    ) / mainRadius;
    const rawMainAngle = Math.atan2(mainCrankVector.y, mainCrankVector.x);
    let mainAngleWithinCycle = rawMainAngle;
    if (rawMainAngle < rawMainAngleAtZero - 1e-12) {
      mainAngleWithinCycle += fullTurn;
    }
    const mainAngle = cycleIndex * fullTurn + mainAngleWithinCycle;
    const mainCrossVelocity = cross2(
      mainCrankVector,
      mainSlotPinVelocity,
    );
    const mainRadiusSquared = mainRadius ** 2;
    const mainAngularSpeed = mainCrossVelocity / mainRadiusSquared;
    const mainAngularAcceleration = (
      cross2(mainCrankVector, mainSlotPinAcceleration)
        * mainRadiusSquared
        - mainCrossVelocity * 2
          * mainCrankVector.dot(mainSlotPinVelocity)
    ) / mainRadiusSquared ** 2;
    const mainRadialUnit = mainCrankVector.clone().divideScalar(mainRadius);
    const mainTangentialUnit = new THREE.Vector2(
      -mainRadialUnit.y,
      mainRadialUnit.x,
    );
    const rotatingSlotVelocity = mainTangentialUnit.clone().multiplyScalar(
      mainAngularSpeed * mainRadius,
    );
    const relativeSlotVelocity = mainSlotPinVelocity.clone().sub(
      rotatingSlotVelocity,
    );
    const reconstructedSlotAcceleration = mainTangentialUnit.clone()
      .multiplyScalar(
        mainAngularAcceleration * mainRadius
          + 2 * mainAngularSpeed * mainRadiusFirstDerivative,
      )
      .addScaledVector(
        mainRadialUnit,
        mainRadiusSecondDerivative
          - mainAngularSpeed ** 2 * mainRadius,
      );
    const pitmanAngle = Math.atan2(
      rightPitmanVector.y,
      rightPitmanVector.x,
    );
    const pitmanAngularSpeed = cross2(
      rightPitmanVector,
      relativeRightVelocity,
    ) / pitmanHalfSpan ** 2;
    const pitmanAngularAcceleration = (
      cross2(
        rightPitmanVector,
        powerWristAcceleration.clone().sub(auxiliaryPinAcceleration),
      ) * pitmanHalfSpan ** 2
        - cross2(rightPitmanVector, relativeRightVelocity) * 2
          * rightPitmanVector.dot(relativeRightVelocity)
    ) / pitmanHalfSpan ** 4;
    const powerLinkAngle = Math.atan2(
      powerLinkVector.y,
      powerLinkVector.x,
    );
    const powerLinkAngularSpeed = cross2(
      powerLinkVector,
      powerWristVelocity,
    ) / powerLinkLength ** 2;
    const powerLinkAngularAcceleration = cross2(
      powerLinkVector,
      powerWristAcceleration,
    ) / powerLinkLength ** 2;
    const idealEllipseResidual = (
      (mainCrankVector.x / auxiliaryCrankRadius) ** 2
        + (mainCrankVector.y / (2 * auxiliaryCrankRadius)) ** 2
        - 1
    );
    let stage = 'short-radius-main-crank-maximum-angular-speed';
    if (
      normalizedAuxiliaryAngle >= Math.PI / 4
      && normalizedAuxiliaryAngle < Math.PI * 3 / 4
    ) {
      stage = 'upper-long-radius-high-leverage-sector';
    } else if (
      normalizedAuxiliaryAngle >= Math.PI * 3 / 4
      && normalizedAuxiliaryAngle < Math.PI * 5 / 4
    ) {
      stage = 'opposite-short-radius-fast-output-sector';
    } else if (
      normalizedAuxiliaryAngle >= Math.PI * 5 / 4
      && normalizedAuxiliaryAngle < Math.PI * 7 / 4
    ) {
      stage = 'lower-long-radius-high-leverage-sector';
    }

    return {
      auxiliaryAngle,
      auxiliaryAngleAcceleration,
      auxiliaryAngleSpeed,
      auxiliaryPin,
      auxiliaryPinAcceleration,
      auxiliaryPinFirstDerivative,
      auxiliaryPinSecondDerivative,
      auxiliaryPinVelocity,
      auxiliaryRadiusAccelerationError:
        auxiliaryPinVelocity.lengthSq()
          + auxiliaryPin.dot(auxiliaryPinAcceleration),
      auxiliaryRadiusError:
        auxiliaryPin.length() - auxiliaryCrankRadius,
      auxiliaryRadiusVelocityError: auxiliaryPin.dot(auxiliaryPinVelocity),
      cycleIndex,
      idealEllipseResidual,
      leftPitmanAccelerationError:
        mainSlotPinVelocity.clone().sub(auxiliaryPinVelocity).lengthSq()
          + leftPitmanVector.dot(
            mainSlotPinAcceleration.clone().sub(auxiliaryPinAcceleration),
          ),
      leftPitmanLengthError: leftPitmanVector.length() - pitmanHalfSpan,
      leftPitmanVector,
      leftPitmanVelocityError: leftPitmanVector.dot(
        mainSlotPinVelocity.clone().sub(auxiliaryPinVelocity),
      ),
      mainAngle,
      mainAngleWithinCycle,
      mainAngularAcceleration,
      mainAngularSpeed,
      mainCrankVector,
      mainRadius,
      mainRadiusFirstDerivative,
      mainRadiusSecondDerivative,
      mainRadialUnit,
      mainSlotPin,
      mainSlotPinAcceleration,
      mainSlotPinVelocity,
      mainTangentialUnit,
      midpointError: mainSlotPin.clone().add(powerWrist)
        .multiplyScalar(0.5).distanceTo(auxiliaryPin),
      normalizedAuxiliaryAngle,
      outputRevolutions: (mainAngle - rawMainAngleAtZero) / fullTurn,
      pitmanAngle,
      pitmanAngularAcceleration,
      pitmanAngularSpeed,
      powerLinkAccelerationError:
        powerWristVelocity.lengthSq()
          + powerLinkVector.dot(powerWristAcceleration),
      powerLinkAngle,
      powerLinkAngularAcceleration,
      powerLinkAngularSpeed,
      powerLinkLengthError: powerLinkVector.length() - powerLinkLength,
      powerLinkVector,
      powerLinkVelocityError: powerLinkVector.dot(powerWristVelocity),
      powerWrist,
      powerWristAcceleration,
      powerWristVelocity,
      rawMainAngle,
      reconstructedSlotAcceleration,
      relativeSlotTangentialVelocityError:
        relativeSlotVelocity.dot(mainTangentialUnit),
      relativeSlotVelocity,
      rightPitmanAccelerationError:
        relativeRightVelocity.lengthSq()
          + rightPitmanVector.dot(
            powerWristAcceleration.clone().sub(auxiliaryPinAcceleration),
          ),
      rightPitmanLengthError: rightPitmanVector.length() - pitmanHalfSpan,
      rightPitmanVector,
      rightPitmanVelocityError: rightPitmanVector.dot(
        relativeRightVelocity,
      ),
      slotPinAccelerationReconstructionError:
        reconstructedSlotAcceleration.distanceTo(mainSlotPinAcceleration),
      slotRadialSlidingSpeed: relativeSlotVelocity.dot(mainRadialUnit),
      stage,
    };
  };

  const stateAtAuxiliaryAngle = (auxiliaryAngle) => motionAtAuxiliaryAngle(
    auxiliaryAngle,
    auxiliaryAngularSpeed,
    0,
  );
  const stateAtTime = (time) => stateAtAuxiliaryAngle(
    sourcePoseAngle + auxiliaryAngularSpeed * time,
  );

  const inputMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.64,
  });
  const outputMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.62,
  });
  const constraintMaterial = matte(PALETTE.accent, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.72,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const witnessMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.muted,
    depthWrite: false,
    opacity: 0.42,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const framePlaneZ = -0.74;
  const outputPlaneZ = 0.08;
  const auxiliaryPlaneZ = 0.26;
  const pitmanPlaneZ = 0.58;
  const powerLinkPlaneZ = 0.82;
  const shaftRadius = 0.105;
  const shaftLength = 1.88;
  const bearingInnerRadius = shaftRadius + 0.025;
  const bearingOuterRadius = 0.31;
  const bearingDepth = 0.26;
  const outputHubRadius = 0.31;
  const outputHubDepth = 0.34;
  const auxiliaryHubRadius = 0.26;
  const auxiliaryArmHalfHeight = 0.13;
  const auxiliaryArmDepth = 0.30;
  const slotPinRadius = 0.115;
  const slotPinLength = 1.28;
  const slotInnerEndDistance = auxiliaryCrankRadius * 0.73;
  const slotOuterEndDistance = auxiliaryCrankRadius * 2.31;
  const slotCenterDistance = (
    slotInnerEndDistance + slotOuterEndDistance
  ) / 2;
  const slotStraightHalfLength = (
    slotOuterEndDistance - slotInnerEndDistance
  ) / 2;
  const slotInnerHalfWidth = slotPinRadius + 0.025;
  const slotOuterHalfWidth = slotInnerHalfWidth + 0.13;
  const slotFrameDepth = 0.30;
  const slotRecessDepth = 0.12;
  const pitmanThickness = 0.18;
  const pitmanDepth = 0.28;
  const pitmanEyeRadius = 0.23;
  const pitmanEyeTubeRadius = 0.065;
  const remotePivotRadius = 0.20;
  const powerLinkThickness = 0.17;
  const powerLinkDepth = 0.24;
  const visiblePowerLinkLength = 1.86;
  const powerLinkBreakMarkWidth = 0.34;
  const powerLinkBreakMarkHeight = 0.055;
  const baseY = -1.50;
  const baseRailHeight = 0.20;
  const baseRailDepth = 0.66;
  const baseMinimumX = mainPivot.x - 0.72;
  const baseMaximumX = remotePowerPivot.x + 0.82;
  const baseWidth = baseMaximumX - baseMinimumX;
  const baseCenterX = (baseMinimumX + baseMaximumX) / 2;

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-two-bearing-frame-beneath-the-cranks-and-off-drawing-power-member';
  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(baseWidth, baseRailHeight, baseRailDepth),
    frameMaterial,
  );
  baseRail.position.set(baseCenterX, baseY, framePlaneZ);
  baseRail.userData.role = 'fixed-base-rail-beneath-main-and-auxiliary-shafts';
  const bearingPedestals = [mainPivot, auxiliaryPivot].map((pivot, index) => {
    const height = pivot.y - baseY;
    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, height, 0.48),
      frameMaterial,
    );
    pedestal.position.set(
      pivot.x,
      baseY + height / 2,
      framePlaneZ,
    );
    pedestal.userData.role = 'fixed-pedestal-under-crank-shaft-bearing';
    pedestal.userData.side = index === 0 ? 'main' : 'auxiliary';
    return pedestal;
  });
  const fixedBearings = [mainPivot, auxiliaryPivot].map((pivot, index) => {
    const bearing = cylinderAlongZ(
      bearingOuterRadius,
      bearingDepth,
      frameMaterial,
      42,
    );
    bearing.position.set(pivot.x, pivot.y, framePlaneZ + 0.30);
    bearing.userData.role = 'fixed-bearing-around-crank-shaft';
    bearing.userData.side = index === 0 ? 'main' : 'auxiliary';
    bearing.userData.innerRadius = bearingInnerRadius;
    return bearing;
  });
  const fixedBearingBores = [mainPivot, auxiliaryPivot].map((pivot, index) => {
    const bore = cylinderAlongZ(
      bearingInnerRadius,
      bearingDepth + 0.025,
      darkMaterial,
      36,
    );
    bore.position.set(pivot.x, pivot.y, framePlaneZ + 0.315);
    bore.userData.role = 'dark-visible-bore-through-fixed-shaft-bearing';
    bore.userData.side = index === 0 ? 'main' : 'auxiliary';
    return bore;
  });
  fixedFrame.add(
    baseRail,
    ...bearingPedestals,
    ...fixedBearings,
    ...fixedBearingBores,
  );

  const output = new THREE.Group();
  output.position.set(mainPivot.x, mainPivot.y, 0);
  output.userData.axis = Z_AXIS.clone();
  output.userData.role =
    'variable-radius-main-shaft-output-with-one-real-radial-slot';
  const outputShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
    32,
  );
  outputShaft.position.z = -0.02;
  outputShaft.userData.role = 'main-output-shaft-through-fixed-bearing';
  const outputHub = cylinderAlongZ(
    outputHubRadius,
    outputHubDepth,
    outputMaterial,
    48,
  );
  outputHub.position.z = outputPlaneZ;
  outputHub.userData.role = 'rotating-main-crank-hub';
  const outputHubRim = new THREE.Mesh(
    new THREE.TorusGeometry(outputHubRadius, 0.045, 9, 48),
    darkMaterial,
  );
  outputHubRim.position.z = outputPlaneZ + outputHubDepth / 2 + 0.025;
  outputHubRim.userData.role = 'dark-rim-making-main-output-spin-visible';
  const slotOutline = new THREE.Mesh(
    centeredExtrusion(
      horizontalCapsuleRingShape(
        slotInnerHalfWidth - 0.012,
        slotOuterHalfWidth + 0.035,
        slotStraightHalfLength,
      ),
      slotFrameDepth + 0.035,
      0.009,
    ),
    darkMaterial,
  );
  slotOutline.position.set(
    slotCenterDistance,
    0,
    outputPlaneZ - 0.012,
  );
  slotOutline.userData.role = 'dark-outline-of-main-crank-radial-slot';
  const slotFrame = new THREE.Mesh(
    centeredExtrusion(
      horizontalCapsuleRingShape(
        slotInnerHalfWidth,
        slotOuterHalfWidth,
        slotStraightHalfLength,
      ),
      slotFrameDepth,
      0.011,
    ),
    outputMaterial,
  );
  slotFrame.position.set(
    slotCenterDistance,
    0,
    outputPlaneZ + 0.018,
  );
  slotFrame.userData.role =
    'one-open-straight-radial-slot-in-the-main-crank';
  const slotRecess = new THREE.Mesh(
    centeredExtrusion(
      horizontalCapsuleShape(
        slotInnerHalfWidth * 0.92,
        slotStraightHalfLength,
      ),
      slotRecessDepth,
      0.004,
    ),
    darkMaterial,
  );
  slotRecess.position.set(
    slotCenterDistance,
    0,
    outputPlaneZ - slotFrameDepth / 2 - slotRecessDepth / 2 - 0.018,
  );
  slotRecess.userData.role = 'dark-recess-visible-through-main-crank-slot';
  const hubToSlotNeck = new THREE.Mesh(
    new THREE.BoxGeometry(
      slotInnerEndDistance - outputHubRadius + 0.10,
      slotOuterHalfWidth * 1.42,
      slotFrameDepth,
    ),
    outputMaterial,
  );
  hubToSlotNeck.position.set(
    (outputHubRadius + slotInnerEndDistance) / 2 - 0.05,
    0,
    outputPlaneZ + 0.018,
  );
  hubToSlotNeck.userData.role = 'solid-neck-from-main-hub-to-slot-frame';
  const outputRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.052, 0.055),
    whiteMaterial,
  );
  outputRotationIndex.position.set(
    outputHubRadius * 0.40,
    0,
    outputPlaneZ + outputHubDepth / 2 + 0.066,
  );
  outputRotationIndex.userData.role =
    'white-index-showing-variable-main-shaft-angular-speed';
  output.add(
    outputShaft,
    outputHub,
    outputHubRim,
    slotRecess,
    slotOutline,
    hubToSlotNeck,
    slotFrame,
    outputRotationIndex,
  );

  const auxiliary = new THREE.Group();
  auxiliary.position.set(auxiliaryPivot.x, auxiliaryPivot.y, 0);
  auxiliary.userData.axis = Z_AXIS.clone();
  auxiliary.userData.role =
    'constant-radius-intermediate-crank-closing-the-shared-pitman';
  const auxiliaryShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
    32,
  );
  auxiliaryShaft.position.z = 0.02;
  auxiliaryShaft.userData.role =
    'auxiliary-crank-shaft-through-fixed-bearing';
  const auxiliaryHub = cylinderAlongZ(
    auxiliaryHubRadius,
    auxiliaryArmDepth,
    constraintMaterial,
    42,
  );
  auxiliaryHub.position.z = auxiliaryPlaneZ;
  auxiliaryHub.userData.role = 'constant-radius-auxiliary-crank-hub';
  const auxiliaryArm = new THREE.Mesh(
    new THREE.BoxGeometry(
      auxiliaryCrankRadius,
      auxiliaryArmHalfHeight * 2,
      auxiliaryArmDepth,
    ),
    constraintMaterial,
  );
  auxiliaryArm.position.set(
    auxiliaryCrankRadius / 2,
    0,
    auxiliaryPlaneZ,
  );
  auxiliaryArm.userData.role = 'rigid-constant-radius-auxiliary-crank-arm';
  const auxiliaryEnd = cylinderAlongZ(
    auxiliaryArmHalfHeight,
    auxiliaryArmDepth,
    constraintMaterial,
    36,
  );
  auxiliaryEnd.position.set(
    auxiliaryCrankRadius,
    0,
    auxiliaryPlaneZ,
  );
  auxiliaryEnd.userData.role = 'rounded-end-of-auxiliary-crank-arm';
  const auxiliaryRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(auxiliaryCrankRadius * 0.76, 0.048, 0.052),
    whiteMaterial,
  );
  auxiliaryRotationIndex.position.set(
    auxiliaryCrankRadius * 0.45,
    0,
    auxiliaryPlaneZ + auxiliaryArmDepth / 2 + 0.055,
  );
  auxiliaryRotationIndex.userData.role =
    'white-index-showing-uniform-auxiliary-crank-rotation';
  auxiliary.add(
    auxiliaryShaft,
    auxiliaryHub,
    auxiliaryArm,
    auxiliaryEnd,
    auxiliaryRotationIndex,
  );

  const pitman = new THREE.Group();
  pitman.userData.role =
    'one-rigid-pitman-with-main-pin-and-power-wrist-equidistant-from-middle-crank-pin';
  const pitmanBeam = new THREE.Mesh(
    new THREE.BoxGeometry(
      pitmanHalfSpan * 2,
      pitmanThickness,
      pitmanDepth,
    ),
    inputMaterial,
  );
  pitmanBeam.position.z = pitmanPlaneZ;
  pitmanBeam.userData.role = 'single-rigid-shared-pitman-beam';
  const pitmanEyes = [-pitmanHalfSpan, 0, pitmanHalfSpan].map(
    (x, index) => {
      const eye = new THREE.Mesh(
        new THREE.TorusGeometry(
          pitmanEyeRadius,
          pitmanEyeTubeRadius,
          10,
          40,
        ),
        inputMaterial,
      );
      eye.position.set(x, 0, pitmanPlaneZ + pitmanDepth / 2 + 0.015);
      eye.userData.role = 'pitman-joint-eye';
      eye.userData.joint = ['main-slot-pin', 'auxiliary-pin', 'power-wrist'][index];
      return eye;
    },
  );
  const mainSlotPin = cylinderAlongZ(
    slotPinRadius,
    slotPinLength,
    whiteMaterial,
    36,
  );
  mainSlotPin.position.set(
    -pitmanHalfSpan,
    0,
    outputPlaneZ + (pitmanPlaneZ - outputPlaneZ) / 2,
  );
  mainSlotPin.userData.role =
    'pitman-pin-sliding-radially-in-the-main-crank-slot';
  const auxiliaryCrankPin = cylinderAlongZ(
    slotPinRadius,
    0.90,
    whiteMaterial,
    36,
  );
  auxiliaryCrankPin.position.set(
    0,
    0,
    auxiliaryPlaneZ + (pitmanPlaneZ - auxiliaryPlaneZ) / 2,
  );
  auxiliaryCrankPin.userData.role =
    'middle-pitman-pin-on-the-constant-radius-auxiliary-crank';
  const powerWristPin = cylinderAlongZ(
    slotPinRadius,
    0.76,
    whiteMaterial,
    36,
  );
  powerWristPin.position.set(
    pitmanHalfSpan,
    0,
    pitmanPlaneZ + (powerLinkPlaneZ - pitmanPlaneZ) / 2,
  );
  powerWristPin.userData.role =
    'right-pitman-pin-on-the-reciprocating-power-member';
  pitman.add(
    pitmanBeam,
    ...pitmanEyes,
    mainSlotPin,
    auxiliaryCrankPin,
    powerWristPin,
  );

  const inputPowerLink = makeDynamicLink({
    color: PALETTE.driver,
    depth: powerLinkDepth,
    jointRadius: remotePivotRadius,
    thickness: powerLinkThickness,
  });
  inputPowerLink.userData.role =
    'visible-lower-segment-of-the-finite-long-reciprocating-power-rocker';
  inputPowerLink.userData.fullLength = powerLinkLength;
  inputPowerLink.userData.hiddenRemotePivot = remotePowerPivot.clone();
  const detachedContinuationEnd = inputPowerLink.children[2];
  inputPowerLink.remove(detachedContinuationEnd);
  const powerLinkBreakMarks = [0, 1].map((index) => {
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(
        powerLinkBreakMarkWidth,
        powerLinkBreakMarkHeight,
        powerLinkDepth + 0.045,
      ),
      whiteMaterial,
    );
    mark.userData.role =
      'moving-break-mark-showing-power-link-continues-to-hidden-pivot';
    mark.userData.index = index;
    return mark;
  });

  const mainEllipsePoints = Array.from({ length: 192 }, (_, index) => {
    const angle = index / 192 * fullTurn;
    return new THREE.Vector3(
      mainPivot.x + auxiliaryCrankRadius * Math.cos(angle),
      mainPivot.y + auxiliaryCrankRadius * 2 * Math.sin(angle),
      framePlaneZ + 0.53,
    );
  });
  const mainEllipseCurve = new THREE.CatmullRomCurve3(
    mainEllipsePoints,
    true,
    'catmullrom',
    0.5,
  );
  const mainEllipseWitness = new THREE.Mesh(
    new THREE.TubeGeometry(mainEllipseCurve, 256, 0.018, 6, true),
    witnessMaterial,
  );
  mainEllipseWitness.userData.role =
    'faint-source-ellipse-witness-for-the-main-slot-pin-orbit';
  mainEllipseWitness.userData.witnessOnly = true;
  const auxiliaryCircleWitness = new THREE.Mesh(
    new THREE.TorusGeometry(auxiliaryCrankRadius, 0.018, 6, 96),
    witnessMaterial,
  );
  auxiliaryCircleWitness.position.set(
    auxiliaryPivot.x,
    auxiliaryPivot.y,
    framePlaneZ + 0.53,
  );
  auxiliaryCircleWitness.userData.role =
    'faint-circle-witness-for-the-constant-radius-auxiliary-pin';
  auxiliaryCircleWitness.userData.witnessOnly = true;
  const witnesses = new THREE.Group();
  witnesses.userData.fixed = true;
  witnesses.userData.role = 'source-orbit-witnesses-behind-moving-members';
  witnesses.add(mainEllipseWitness, auxiliaryCircleWitness);

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(8.05, 4.65, 3.70),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0.02, 0.22, 0.12);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-of-the-source-cropped-two-crank-assembly';

  root.add(
    cameraEnvelope,
    fixedFrame,
    witnesses,
    output,
    auxiliary,
    pitman,
    inputPowerLink,
    ...powerLinkBreakMarks,
  );

  const phaseTime = (targetAngle) => {
    const angleFromSourcePose = positiveModulo(
      targetAngle - sourcePoseAngle,
      fullTurn,
    );
    return angleFromSourcePose / auxiliaryAngularSpeed;
  };
  const canonicalTimes = {
    sourcePose: 0,
    upperHighLeverage: phaseTime(Math.PI / 2),
    oppositeShortRadius: phaseTime(Math.PI),
    lowerHighLeverage: phaseTime(Math.PI * 1.5),
    rightShortRadius: phaseTime(fullTurn),
    fullCycle: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    output.rotation.z = state.mainAngle;
    output.userData.angularSpeed = state.mainAngularSpeed;
    output.userData.angularAcceleration = state.mainAngularAcceleration;
    auxiliary.rotation.z = state.auxiliaryAngle;
    auxiliary.userData.angularSpeed = state.auxiliaryAngleSpeed;
    pitman.position.set(state.auxiliaryPin.x, state.auxiliaryPin.y, 0);
    pitman.rotation.z = state.pitmanAngle;
    pitman.userData.angularSpeed = state.pitmanAngularSpeed;
    pitman.userData.angularAcceleration = state.pitmanAngularAcceleration;
    const visiblePowerDirection = remotePowerPivot.clone()
      .sub(state.powerWrist).normalize();
    const visiblePowerLinkEnd = state.powerWrist.clone().addScaledVector(
      visiblePowerDirection,
      visiblePowerLinkLength,
    );
    inputPowerLink.userData.setEndpoints(
      new THREE.Vector3(
        state.powerWrist.x,
        state.powerWrist.y,
        powerLinkPlaneZ,
      ),
      new THREE.Vector3(
        visiblePowerLinkEnd.x,
        visiblePowerLinkEnd.y,
        powerLinkPlaneZ,
      ),
    );
    inputPowerLink.userData.angularSpeed = state.powerLinkAngularSpeed;
    inputPowerLink.userData.angularAcceleration =
      state.powerLinkAngularAcceleration;
    const powerLinkBreakRotation = Math.atan2(
      visiblePowerDirection.y,
      visiblePowerDirection.x,
    ) + Math.PI / 2;
    powerLinkBreakMarks.forEach((mark, index) => {
      const distanceFromWrist = visiblePowerLinkLength
        - 0.18 - index * 0.20;
      const position = state.powerWrist.clone().addScaledVector(
        visiblePowerDirection,
        distanceFromWrist,
      );
      mark.position.set(position.x, position.y, powerLinkPlaneZ);
      mark.rotation.z = powerLinkBreakRotation;
    });
    root.userData.kinematics = state;

    const renderedMainPin = mainSlotPin.getWorldPosition(new THREE.Vector3());
    const renderedAuxiliaryPin = auxiliaryCrankPin.getWorldPosition(
      new THREE.Vector3(),
    );
    const renderedPowerWrist = powerWristPin.getWorldPosition(
      new THREE.Vector3(),
    );
    root.userData.contacts = {
      auxiliaryCrankPin: {
        centerError: Math.hypot(
          renderedAuxiliaryPin.x - state.auxiliaryPin.x,
          renderedAuxiliaryPin.y - state.auxiliaryPin.y,
        ),
        fixedRadiusError: state.auxiliaryRadiusError,
      },
      mainSlot: {
        centerError: Math.hypot(
          renderedMainPin.x - state.mainSlotPin.x,
          renderedMainPin.y - state.mainSlotPin.y,
        ),
        innerEndClearance: state.mainRadius - slotInnerEndDistance,
        outerEndClearance: slotOuterEndDistance - state.mainRadius,
        radialSlidingSpeed: state.slotRadialSlidingSpeed,
        tangentialVelocityError:
          state.relativeSlotTangentialVelocityError,
      },
      pitman: {
        leftLengthError: state.leftPitmanLengthError,
        midpointError: state.midpointError,
        rightLengthError: state.rightPitmanLengthError,
      },
      powerMember: {
        centerError: Math.hypot(
          renderedPowerWrist.x - state.powerWrist.x,
          renderedPowerWrist.y - state.powerWrist.y,
        ),
        remotePivot: remotePowerPivot.clone(),
        rigidLengthError: state.powerLinkLengthError,
        visibleDirection: visiblePowerDirection.clone(),
        visibleEnd: visiblePowerLinkEnd.clone(),
        visibleLength: visiblePowerLinkLength,
      },
      shaftBearings: {
        axis: Z_AXIS.clone(),
        radialClearance: bearingInnerRadius - shaftRadius,
      },
    };
  };

  root.userData.mechanism =
    'shared-pitman-constant-radius-auxiliary-crank-variable-radius-slotted-main-crank';
  root.userData.blocks = {
    auxiliary,
    auxiliaryArm,
    auxiliaryCircleWitness,
    auxiliaryCrankPin,
    auxiliaryEnd,
    auxiliaryHub,
    auxiliaryRotationIndex,
    auxiliaryShaft,
    baseRail,
    bearingPedestals,
    cameraEnvelope,
    fixedBearingBores,
    fixedBearings,
    fixedFrame,
    hubToSlotNeck,
    inputPowerLink,
    mainEllipseWitness,
    mainSlotPin,
    output,
    outputHub,
    outputHubRim,
    outputRotationIndex,
    outputShaft,
    pitman,
    pitmanBeam,
    pitmanEyes,
    powerLinkBreakMarks,
    powerWristPin,
    slotFrame,
    slotOutline,
    slotRecess,
    witnesses,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.curves = { mainEllipse: mainEllipseCurve };
  root.userData.geometry = {
    auxiliaryAngularSpeed,
    auxiliaryArmDepth,
    auxiliaryArmHalfHeight,
    auxiliaryCrankRadius,
    auxiliaryHubRadius,
    auxiliaryPlaneZ,
    auxiliaryPivot: auxiliaryPivot.clone(),
    baseCenterX,
    baseMaximumX,
    baseMinimumX,
    baseRailDepth,
    baseRailHeight,
    baseWidth,
    baseY,
    bearingDepth,
    bearingInnerRadius,
    bearingOuterRadius,
    cyclePeriod,
    framePlaneZ,
    fullTurn,
    mainPivot: mainPivot.clone(),
    nominalPowerWrist: nominalPowerWrist.clone(),
    outputHubDepth,
    outputHubRadius,
    outputPlaneZ,
    pitmanDepth,
    pitmanEyeRadius,
    pitmanEyeTubeRadius,
    pitmanHalfSpan,
    pitmanPlaneZ,
    pitmanThickness,
    powerLinkDepth,
    powerLinkBreakMarkHeight,
    powerLinkBreakMarkWidth,
    powerLinkLength,
    powerLinkPlaneZ,
    powerLinkThickness,
    rawMainAngleAtZero,
    remotePivotRadius,
    remotePowerPivot: remotePowerPivot.clone(),
    shaftLength,
    shaftRadius,
    shaftSpacing,
    slotCenterDistance,
    slotFrameDepth,
    slotInnerEndDistance,
    slotInnerHalfWidth,
    slotOuterEndDistance,
    slotOuterHalfWidth,
    slotPinLength,
    slotPinRadius,
    slotRecessDepth,
    slotStraightHalfLength,
    sourceAnimationAuxiliaryCrankRadius,
    sourceAnimationAuxiliaryPivot:
      sourceAnimationAuxiliaryPivot.clone(),
    sourceAnimationMainPivot: sourceAnimationMainPivot.clone(),
    sourceAnimationPitmanHalfSpan,
    sourceAnimationPoseCycle,
    sourceAnimationPowerLinkLength,
    sourceAnimationRemotePowerPivot:
      sourceAnimationRemotePowerPivot.clone(),
    sourceAnimationViewHalfSize,
    sourceImageHeight,
    sourceImageWidth,
    sourcePoseAngle,
    sourceRasterAuxiliaryPinCenter:
      sourceRasterAuxiliaryPinCenter.clone(),
    sourceRasterAuxiliaryShaftCenter:
      sourceRasterAuxiliaryShaftCenter.clone(),
    sourceRasterEllipseBottomY,
    sourceRasterEllipseLeftX,
    sourceRasterEllipseRightX,
    sourceRasterEllipseTopY,
    sourceRasterMainShaftCenter: sourceRasterMainShaftCenter.clone(),
    sourceRasterMainSlotPinCenter:
      sourceRasterMainSlotPinCenter.clone(),
    sourceRasterPowerWristCenter:
      sourceRasterPowerWristCenter.clone(),
    sourceScale,
    visiblePowerLinkLength,
  };
  root.userData.motionAtAuxiliaryAngle = motionAtAuxiliaryAngle;
  root.userData.positionAtNormalizedAuxiliaryAngle =
    positionAtNormalizedAuxiliaryAngle;
  root.userData.stateAtAuxiliaryAngle = stateAtAuxiliaryAngle;
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
    auxiliaryCircleWitness,
    auxiliaryRotationIndex,
    cameraEnvelope,
    mainEllipseWitness,
    outputRotationIndex,
    ...powerLinkBreakMarks,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';
  root.userData.cameraDistanceScale = 0.96;
  return {
    cameraDirection: new THREE.Vector3(6.8, 4.4, 15.5),
    root,
    update,
  };
}

function linkedEllipticalPinMainCrankDrive() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Movement 169 is explicitly Brown's link-connected modification of 168.
  // The only kinematic substitution is the right-hand R-R dyad: the
  // elliptical pitman-end pin is joined to a fixed-radius main-crank pin by
  // one finite link, so neither member contains a slot. The rest of the
  // construction retains 168's source-reviewed 2:10:30 dimensions.
  const sourceConstructionAuxiliaryPivot = new THREE.Vector2(0, 0);
  const sourceConstructionMainPivot = new THREE.Vector2(10, 0);
  const sourceConstructionRemotePowerPivot = new THREE.Vector2(-10, -30);
  const sourceConstructionAuxiliaryCrankRadius = 2;
  const sourceConstructionPitmanHalfSpan = 10;
  const sourceConstructionPowerLinkLength = 30;

  // Brown's engraving gives the added dyad independently: its main crank is
  // about 1.8 auxiliary-crank radii and its connecting link about 1.6. The
  // rationalized 3.6:3.2 dimensions reproduce that drawn assembly while
  // leaving generous clearance from both circle-intersection tangencies.
  const sourceEngravingMainCrankRadius = 3.6;
  const sourceEngravingConnectingLinkLength = 3.2;
  const sourceEngravingPoseCycle = 0.25;
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterPowerWristCenter = new THREE.Vector2(60, 286);
  const sourceRasterAuxiliaryPinCenter = new THREE.Vector2(264, 233);
  const sourceRasterAuxiliaryShaftCenter = new THREE.Vector2(286, 274);
  const sourceRasterPitmanMainJointCenter = new THREE.Vector2(428, 173);
  const sourceRasterMainCrankPinCenter = new THREE.Vector2(489, 219);
  const sourceRasterMainShaftCenter = new THREE.Vector2(425, 278);
  const sourceRasterRemoteMemberCropPoint = new THREE.Vector2(14, 391);
  const sourceRasterMainEllipseTopY = 168;
  const sourceRasterMainEllipseBottomY = 377;
  const sourceRasterMainEllipseLeftX = 364;
  const sourceRasterMainEllipseRightX = 493;

  const sourceScale = 0.26;
  const auxiliaryCrankRadius = sourceConstructionAuxiliaryCrankRadius
    * sourceScale;
  const pitmanHalfSpan = sourceConstructionPitmanHalfSpan * sourceScale;
  const powerLinkLength = sourceConstructionPowerLinkLength * sourceScale;
  const mainCrankRadius = sourceEngravingMainCrankRadius * sourceScale;
  const connectingLinkLength = sourceEngravingConnectingLinkLength
    * sourceScale;
  const auxiliaryPivot = sourceConstructionAuxiliaryPivot.clone()
    .multiplyScalar(sourceScale);
  const mainPivot = sourceConstructionMainPivot.clone()
    .multiplyScalar(sourceScale);
  const remotePowerPivot = sourceConstructionRemotePowerPivot.clone()
    .multiplyScalar(sourceScale);
  const nominalPowerWrist = new THREE.Vector2(-pitmanHalfSpan, 0);
  const sourcePoseAngle = sourceEngravingPoseCycle * fullTurn;
  const auxiliaryAngularSpeed = 0.62;
  const cyclePeriod = fullTurn / auxiliaryAngularSpeed;

  const positiveModulo = (value, modulus) => {
    const remainder = value % modulus;
    if (remainder === 0) return 0;
    return remainder < 0 ? remainder + modulus : remainder;
  };

  const positionAtNormalizedAuxiliaryAngle = (normalizedAngle) => {
    const auxiliaryPin = new THREE.Vector2(
      auxiliaryCrankRadius * Math.cos(normalizedAngle),
      auxiliaryCrankRadius * Math.sin(normalizedAngle),
    );

    // First close the unchanged left half of 168: the power wrist lies on
    // both the pitman-half circle and the long remote-power-member circle.
    const remoteCenterVector = remotePowerPivot.clone().sub(auxiliaryPin);
    const remoteCenterDistance = remoteCenterVector.length();
    const remoteCenterUnit = remoteCenterVector.clone().divideScalar(
      remoteCenterDistance,
    );
    const remoteAlong = (
      pitmanHalfSpan ** 2
        - powerLinkLength ** 2
        + remoteCenterDistance ** 2
    ) / (2 * remoteCenterDistance);
    const remotePerpendicularDistance = Math.sqrt(Math.max(
      0,
      pitmanHalfSpan ** 2 - remoteAlong ** 2,
    ));
    const remoteBase = auxiliaryPin.clone().addScaledVector(
      remoteCenterUnit,
      remoteAlong,
    );
    const remotePerpendicular = new THREE.Vector2(
      -remoteCenterUnit.y,
      remoteCenterUnit.x,
    );
    const remoteCandidateA = remoteBase.clone().addScaledVector(
      remotePerpendicular,
      remotePerpendicularDistance,
    );
    const remoteCandidateB = remoteBase.clone().addScaledVector(
      remotePerpendicular,
      -remotePerpendicularDistance,
    );
    const powerWrist = remoteCandidateA.distanceToSquared(nominalPowerWrist)
      <= remoteCandidateB.distanceToSquared(nominalPowerWrist)
      ? remoteCandidateA
      : remoteCandidateB;

    // The auxiliary pin is the midpoint of the one rigid pitman, exactly as
    // in 168. Its opposite end therefore retains the elliptical pin orbit.
    const pitmanMainJoint = auxiliaryPin.clone().multiplyScalar(2).sub(
      powerWrist,
    );

    // Close Brown's added link on the clockwise engraving branch. This is a
    // circle-circle intersection, not a projected point or decorative link.
    const orbitVector = pitmanMainJoint.clone().sub(mainPivot);
    const orbitRadius = orbitVector.length();
    const orbitUnit = orbitVector.clone().divideScalar(orbitRadius);
    const mainAlong = (
      orbitRadius ** 2
        + mainCrankRadius ** 2
        - connectingLinkLength ** 2
    ) / (2 * orbitRadius);
    const mainPerpendicularDistance = Math.sqrt(Math.max(
      0,
      mainCrankRadius ** 2 - mainAlong ** 2,
    ));
    const mainBase = mainPivot.clone().addScaledVector(orbitUnit, mainAlong);
    const orbitPerpendicular = new THREE.Vector2(-orbitUnit.y, orbitUnit.x);
    const mainCrankPin = mainBase.clone().addScaledVector(
      orbitPerpendicular,
      -mainPerpendicularDistance,
    );

    return {
      auxiliaryPin,
      mainCrankPin,
      pitmanMainJoint,
      powerWrist,
    };
  };

  const rawMainAngleAtZero = (() => {
    const { mainCrankPin } = positionAtNormalizedAuxiliaryAngle(0);
    return Math.atan2(
      mainCrankPin.y - mainPivot.y,
      mainCrankPin.x - mainPivot.x,
    );
  })();

  const motionAtAuxiliaryAngle = (
    auxiliaryAngle,
    auxiliaryAngleSpeed = auxiliaryAngularSpeed,
    auxiliaryAngleAcceleration = 0,
  ) => {
    const cycleIndex = Math.floor(auxiliaryAngle / fullTurn);
    const normalizedAuxiliaryAngle = positiveModulo(
      auxiliaryAngle,
      fullTurn,
    );
    const cosine = Math.cos(normalizedAuxiliaryAngle);
    const sine = Math.sin(normalizedAuxiliaryAngle);
    const {
      auxiliaryPin,
      mainCrankPin,
      pitmanMainJoint,
      powerWrist,
    } = positionAtNormalizedAuxiliaryAngle(normalizedAuxiliaryAngle);

    const auxiliaryPinFirstDerivative = new THREE.Vector2(
      -auxiliaryCrankRadius * sine,
      auxiliaryCrankRadius * cosine,
    );
    const auxiliaryPinSecondDerivative = new THREE.Vector2(
      -auxiliaryCrankRadius * cosine,
      -auxiliaryCrankRadius * sine,
    );
    const auxiliaryPinVelocity = auxiliaryPinFirstDerivative.clone()
      .multiplyScalar(auxiliaryAngleSpeed);
    const auxiliaryPinAcceleration = auxiliaryPinSecondDerivative.clone()
      .multiplyScalar(auxiliaryAngleSpeed ** 2)
      .addScaledVector(
        auxiliaryPinFirstDerivative,
        auxiliaryAngleAcceleration,
      );

    const leftPitmanVector = powerWrist.clone().sub(auxiliaryPin);
    const powerLinkVector = powerWrist.clone().sub(remotePowerPivot);
    const powerWristVelocity = solveLinearRows(
      leftPitmanVector,
      powerLinkVector,
      leftPitmanVector.dot(auxiliaryPinVelocity),
      0,
    );
    const relativePowerWristVelocity = powerWristVelocity.clone().sub(
      auxiliaryPinVelocity,
    );
    const powerWristAcceleration = solveLinearRows(
      leftPitmanVector,
      powerLinkVector,
      leftPitmanVector.dot(auxiliaryPinAcceleration)
        - relativePowerWristVelocity.lengthSq(),
      -powerWristVelocity.lengthSq(),
    );
    const pitmanMainJointVelocity = auxiliaryPinVelocity.clone()
      .multiplyScalar(2)
      .sub(powerWristVelocity);
    const pitmanMainJointAcceleration = auxiliaryPinAcceleration.clone()
      .multiplyScalar(2)
      .sub(powerWristAcceleration);

    const mainCrankVector = mainCrankPin.clone().sub(mainPivot);
    const connectingLinkVector = mainCrankPin.clone().sub(
      pitmanMainJoint,
    );
    const mainCrankPinVelocity = solveLinearRows(
      mainCrankVector,
      connectingLinkVector,
      0,
      connectingLinkVector.dot(pitmanMainJointVelocity),
    );
    const relativeConnectingLinkVelocity = mainCrankPinVelocity.clone().sub(
      pitmanMainJointVelocity,
    );
    const mainCrankPinAcceleration = solveLinearRows(
      mainCrankVector,
      connectingLinkVector,
      -mainCrankPinVelocity.lengthSq(),
      connectingLinkVector.dot(pitmanMainJointAcceleration)
        - relativeConnectingLinkVelocity.lengthSq(),
    );

    const rawMainAngle = Math.atan2(
      mainCrankVector.y,
      mainCrankVector.x,
    );
    let mainAngleWithinCycle = rawMainAngle;
    if (rawMainAngle < rawMainAngleAtZero - 1e-12) {
      mainAngleWithinCycle += fullTurn;
    }
    const mainAngle = cycleIndex * fullTurn + mainAngleWithinCycle;
    const mainAngularSpeed = cross2(
      mainCrankVector,
      mainCrankPinVelocity,
    ) / mainCrankRadius ** 2;
    const mainAngularAcceleration = cross2(
      mainCrankVector,
      mainCrankPinAcceleration,
    ) / mainCrankRadius ** 2;
    const connectingLinkAngle = Math.atan2(
      connectingLinkVector.y,
      connectingLinkVector.x,
    );
    const connectingLinkAngularSpeed = cross2(
      connectingLinkVector,
      relativeConnectingLinkVelocity,
    ) / connectingLinkLength ** 2;
    const connectingLinkAngularAcceleration = cross2(
      connectingLinkVector,
      mainCrankPinAcceleration.clone().sub(pitmanMainJointAcceleration),
    ) / connectingLinkLength ** 2;
    const rightPitmanVector = pitmanMainJoint.clone().sub(auxiliaryPin);
    const relativeRightPitmanVelocity = pitmanMainJointVelocity.clone().sub(
      auxiliaryPinVelocity,
    );
    const pitmanAngle = Math.atan2(
      rightPitmanVector.y,
      rightPitmanVector.x,
    );
    const pitmanAngularSpeed = cross2(
      rightPitmanVector,
      relativeRightPitmanVelocity,
    ) / pitmanHalfSpan ** 2;
    const pitmanAngularAcceleration = cross2(
      rightPitmanVector,
      pitmanMainJointAcceleration.clone().sub(auxiliaryPinAcceleration),
    ) / pitmanHalfSpan ** 2;
    const powerLinkAngle = Math.atan2(
      powerLinkVector.y,
      powerLinkVector.x,
    );
    const powerLinkAngularSpeed = cross2(
      powerLinkVector,
      powerWristVelocity,
    ) / powerLinkLength ** 2;
    const powerLinkAngularAcceleration = cross2(
      powerLinkVector,
      powerWristAcceleration,
    ) / powerLinkLength ** 2;
    const orbitVector = pitmanMainJoint.clone().sub(mainPivot);
    const orbitRadius = orbitVector.length();
    const circleBranchCross = cross2(orbitVector, mainCrankVector);
    const idealEllipseResidual = (
      (orbitVector.x / auxiliaryCrankRadius) ** 2
        + (orbitVector.y / (2 * auxiliaryCrankRadius)) ** 2
        - 1
    );
    let stage = 'right-horizontal-pitman-sector';
    if (
      normalizedAuxiliaryAngle >= Math.PI / 4
      && normalizedAuxiliaryAngle < Math.PI * 3 / 4
    ) {
      stage = 'upper-linked-main-crank-sector';
    } else if (
      normalizedAuxiliaryAngle >= Math.PI * 3 / 4
      && normalizedAuxiliaryAngle < Math.PI * 5 / 4
    ) {
      stage = 'left-horizontal-pitman-sector';
    } else if (
      normalizedAuxiliaryAngle >= Math.PI * 5 / 4
      && normalizedAuxiliaryAngle < Math.PI * 7 / 4
    ) {
      stage = 'lower-linked-main-crank-sector';
    }

    return {
      auxiliaryAngle,
      auxiliaryAngleAcceleration,
      auxiliaryAngleSpeed,
      auxiliaryPin,
      auxiliaryPinAcceleration,
      auxiliaryPinFirstDerivative,
      auxiliaryPinSecondDerivative,
      auxiliaryPinVelocity,
      auxiliaryRadiusAccelerationError:
        auxiliaryPinVelocity.lengthSq()
          + auxiliaryPin.dot(auxiliaryPinAcceleration),
      auxiliaryRadiusError: auxiliaryPin.length() - auxiliaryCrankRadius,
      auxiliaryRadiusVelocityError: auxiliaryPin.dot(auxiliaryPinVelocity),
      circleBranchCross,
      circleInnerMargin:
        orbitRadius - Math.abs(mainCrankRadius - connectingLinkLength),
      circleOuterMargin:
        mainCrankRadius + connectingLinkLength - orbitRadius,
      connectingLinkAccelerationError:
        relativeConnectingLinkVelocity.lengthSq()
          + connectingLinkVector.dot(
            mainCrankPinAcceleration.clone().sub(
              pitmanMainJointAcceleration,
            ),
          ),
      connectingLinkAngle,
      connectingLinkAngularAcceleration,
      connectingLinkAngularSpeed,
      connectingLinkLengthError:
        connectingLinkVector.length() - connectingLinkLength,
      connectingLinkVector,
      connectingLinkVelocityError: connectingLinkVector.dot(
        relativeConnectingLinkVelocity,
      ),
      cycleIndex,
      dyadJacobianDeterminant: cross2(
        mainCrankVector,
        connectingLinkVector,
      ),
      idealEllipseResidual,
      leftPitmanAccelerationError:
        relativePowerWristVelocity.lengthSq()
          + leftPitmanVector.dot(
            powerWristAcceleration.clone().sub(auxiliaryPinAcceleration),
          ),
      leftPitmanLengthError: leftPitmanVector.length() - pitmanHalfSpan,
      leftPitmanVector,
      leftPitmanVelocityError: leftPitmanVector.dot(
        relativePowerWristVelocity,
      ),
      mainAngle,
      mainAngleWithinCycle,
      mainAngularAcceleration,
      mainAngularSpeed,
      mainCrankAccelerationError:
        mainCrankPinVelocity.lengthSq()
          + mainCrankVector.dot(mainCrankPinAcceleration),
      mainCrankLengthError: mainCrankVector.length() - mainCrankRadius,
      mainCrankPin,
      mainCrankPinAcceleration,
      mainCrankPinVelocity,
      mainCrankVector,
      mainCrankVelocityError: mainCrankVector.dot(mainCrankPinVelocity),
      midpointError: powerWrist.clone().add(pitmanMainJoint)
        .multiplyScalar(0.5).distanceTo(auxiliaryPin),
      normalizedAuxiliaryAngle,
      orbitRadius,
      outputRevolutions: (mainAngle - rawMainAngleAtZero) / fullTurn,
      pitmanAngle,
      pitmanAngularAcceleration,
      pitmanAngularSpeed,
      pitmanMainJoint,
      pitmanMainJointAcceleration,
      pitmanMainJointVelocity,
      powerLinkAccelerationError:
        powerWristVelocity.lengthSq()
          + powerLinkVector.dot(powerWristAcceleration),
      powerLinkAngle,
      powerLinkAngularAcceleration,
      powerLinkAngularSpeed,
      powerLinkLengthError: powerLinkVector.length() - powerLinkLength,
      powerLinkVector,
      powerLinkVelocityError: powerLinkVector.dot(powerWristVelocity),
      powerWrist,
      powerWristAcceleration,
      powerWristVelocity,
      rawMainAngle,
      relativeConnectingLinkVelocity,
      relativePowerWristVelocity,
      relativeRightPitmanVelocity,
      rightPitmanAccelerationError:
        relativeRightPitmanVelocity.lengthSq()
          + rightPitmanVector.dot(
            pitmanMainJointAcceleration.clone().sub(
              auxiliaryPinAcceleration,
            ),
          ),
      rightPitmanLengthError: rightPitmanVector.length() - pitmanHalfSpan,
      rightPitmanVector,
      rightPitmanVelocityError: rightPitmanVector.dot(
        relativeRightPitmanVelocity,
      ),
      stage,
    };
  };

  const stateAtAuxiliaryAngle = (auxiliaryAngle) => motionAtAuxiliaryAngle(
    auxiliaryAngle,
    auxiliaryAngularSpeed,
    0,
  );
  const stateAtTime = (time) => stateAtAuxiliaryAngle(
    sourcePoseAngle + auxiliaryAngularSpeed * time,
  );

  const inputMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.64,
  });
  const outputMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.62,
  });
  const constraintMaterial = matte(PALETTE.accent, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.72,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const witnessMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.muted,
    depthWrite: false,
    opacity: 0.38,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const framePlaneZ = -0.78;
  const auxiliaryPlaneZ = 0.10;
  const mainCrankPlaneZ = 0.18;
  const pitmanPlaneZ = 0.54;
  const powerLinkPlaneZ = 0.72;
  const connectingLinkPlaneZ = 0.86;
  const shaftRadius = 0.105;
  const shaftLength = 1.96;
  const bearingInnerRadius = shaftRadius + 0.025;
  const bearingOuterRadius = 0.30;
  const bearingDepth = 0.26;
  const auxiliaryHubRadius = 0.26;
  const mainHubRadius = 0.31;
  const crankArmHalfHeight = 0.13;
  const crankArmDepth = 0.30;
  const jointPinRadius = 0.112;
  const pitmanThickness = 0.18;
  const pitmanDepth = 0.28;
  const pitmanEyeRadius = 0.225;
  const pitmanEyeTubeRadius = 0.063;
  const connectingLinkThickness = 0.17;
  const connectingLinkDepth = 0.24;
  const connectingJointRadius = 0.19;
  const remotePivotRadius = 0.20;
  const powerLinkThickness = 0.17;
  const powerLinkDepth = 0.24;
  const visiblePowerLinkLength = 1.78;
  const powerLinkBreakMarkWidth = 0.34;
  const powerLinkBreakMarkHeight = 0.055;
  const baseY = -1.48;
  const baseRailHeight = 0.20;
  const baseRailDepth = 0.66;
  const baseMinimumX = auxiliaryPivot.x - 0.72;
  const baseMaximumX = mainPivot.x + mainCrankRadius + 0.58;
  const baseWidth = baseMaximumX - baseMinimumX;
  const baseCenterX = (baseMinimumX + baseMaximumX) / 2;

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-two-bearing-frame-under-auxiliary-and-main-crank-shafts';
  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(baseWidth, baseRailHeight, baseRailDepth),
    frameMaterial,
  );
  baseRail.position.set(baseCenterX, baseY, framePlaneZ);
  baseRail.userData.role = 'fixed-base-rail-under-the-two-crank-shafts';
  const bearingPivots = [auxiliaryPivot, mainPivot];
  const bearingPedestals = bearingPivots.map((pivot, index) => {
    const height = pivot.y - baseY;
    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, height, 0.48),
      frameMaterial,
    );
    pedestal.position.set(pivot.x, baseY + height / 2, framePlaneZ);
    pedestal.userData.role = 'fixed-pedestal-under-crank-shaft-bearing';
    pedestal.userData.side = index === 0 ? 'auxiliary' : 'main';
    return pedestal;
  });
  const fixedBearings = bearingPivots.map((pivot, index) => {
    const bearing = cylinderAlongZ(
      bearingOuterRadius,
      bearingDepth,
      frameMaterial,
      42,
    );
    bearing.position.set(pivot.x, pivot.y, framePlaneZ + 0.30);
    bearing.userData.role = 'fixed-bearing-around-crank-shaft';
    bearing.userData.side = index === 0 ? 'auxiliary' : 'main';
    return bearing;
  });
  const fixedBearingBores = bearingPivots.map((pivot, index) => {
    const bore = cylinderAlongZ(
      bearingInnerRadius,
      bearingDepth + 0.025,
      darkMaterial,
      36,
    );
    bore.position.set(pivot.x, pivot.y, framePlaneZ + 0.315);
    bore.userData.role = 'dark-visible-bore-through-fixed-shaft-bearing';
    bore.userData.side = index === 0 ? 'auxiliary' : 'main';
    return bore;
  });
  fixedFrame.add(
    baseRail,
    ...bearingPedestals,
    ...fixedBearings,
    ...fixedBearingBores,
  );

  const auxiliary = new THREE.Group();
  auxiliary.position.set(auxiliaryPivot.x, auxiliaryPivot.y, 0);
  auxiliary.userData.axis = Z_AXIS.clone();
  auxiliary.userData.role =
    'constant-radius-auxiliary-crank-pinned-to-the-pitman-middle';
  const auxiliaryShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
    32,
  );
  auxiliaryShaft.position.z = 0;
  auxiliaryShaft.userData.role = 'auxiliary-shaft-through-fixed-bearing';
  const auxiliaryHub = cylinderAlongZ(
    auxiliaryHubRadius,
    crankArmDepth,
    constraintMaterial,
    42,
  );
  auxiliaryHub.position.z = auxiliaryPlaneZ;
  auxiliaryHub.userData.role = 'constant-radius-auxiliary-crank-hub';
  const auxiliaryArm = new THREE.Mesh(
    new THREE.BoxGeometry(
      auxiliaryCrankRadius,
      crankArmHalfHeight * 2,
      crankArmDepth,
    ),
    constraintMaterial,
  );
  auxiliaryArm.position.set(auxiliaryCrankRadius / 2, 0, auxiliaryPlaneZ);
  auxiliaryArm.userData.role = 'rigid-auxiliary-crank-arm';
  const auxiliaryEnd = cylinderAlongZ(
    crankArmHalfHeight,
    crankArmDepth,
    constraintMaterial,
    36,
  );
  auxiliaryEnd.position.set(auxiliaryCrankRadius, 0, auxiliaryPlaneZ);
  auxiliaryEnd.userData.role = 'rounded-auxiliary-crank-end-at-middle-pin';
  const auxiliaryIndex = new THREE.Mesh(
    new THREE.BoxGeometry(auxiliaryCrankRadius * 0.72, 0.048, 0.052),
    whiteMaterial,
  );
  auxiliaryIndex.position.set(
    auxiliaryCrankRadius * 0.44,
    0,
    auxiliaryPlaneZ + crankArmDepth / 2 + 0.055,
  );
  auxiliaryIndex.userData.role =
    'white-index-showing-uniform-auxiliary-crank-rotation';
  auxiliary.add(
    auxiliaryShaft,
    auxiliaryHub,
    auxiliaryArm,
    auxiliaryEnd,
    auxiliaryIndex,
  );

  const mainCrank = new THREE.Group();
  mainCrank.position.set(mainPivot.x, mainPivot.y, 0);
  mainCrank.userData.axis = Z_AXIS.clone();
  mainCrank.userData.role =
    'one-solid-fixed-radius-main-crank-with-no-sliding-contact';
  const mainShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
    32,
  );
  mainShaft.position.z = 0.02;
  mainShaft.userData.role = 'main-crank-shaft-through-fixed-bearing';
  const mainHub = cylinderAlongZ(
    mainHubRadius,
    crankArmDepth,
    outputMaterial,
    46,
  );
  mainHub.position.z = mainCrankPlaneZ;
  mainHub.userData.role = 'solid-main-crank-hub';
  const mainHubRim = new THREE.Mesh(
    new THREE.TorusGeometry(mainHubRadius, 0.043, 9, 48),
    darkMaterial,
  );
  mainHubRim.position.z = mainCrankPlaneZ + crankArmDepth / 2 + 0.025;
  mainHubRim.userData.role = 'dark-rim-making-main-crank-spin-visible';
  const mainArm = new THREE.Mesh(
    new THREE.BoxGeometry(
      mainCrankRadius,
      crankArmHalfHeight * 2,
      crankArmDepth,
    ),
    outputMaterial,
  );
  mainArm.position.set(mainCrankRadius / 2, 0, mainCrankPlaneZ);
  mainArm.userData.role = 'solid-constant-radius-main-crank-arm';
  const mainEnd = cylinderAlongZ(
    crankArmHalfHeight,
    crankArmDepth,
    outputMaterial,
    36,
  );
  mainEnd.position.set(mainCrankRadius, 0, mainCrankPlaneZ);
  mainEnd.userData.role = 'rounded-main-crank-end-under-link-pin';
  const mainCrankPin = cylinderAlongZ(
    jointPinRadius,
    connectingLinkPlaneZ - mainCrankPlaneZ + 0.52,
    whiteMaterial,
    36,
  );
  mainCrankPin.position.set(
    mainCrankRadius,
    0,
    mainCrankPlaneZ
      + (connectingLinkPlaneZ - mainCrankPlaneZ) / 2,
  );
  mainCrankPin.userData.role =
    'fixed-radius-main-crank-pin-revolute-with-short-link';
  const mainIndex = new THREE.Mesh(
    new THREE.BoxGeometry(mainCrankRadius * 0.70, 0.05, 0.052),
    whiteMaterial,
  );
  mainIndex.position.set(
    mainCrankRadius * 0.43,
    0,
    mainCrankPlaneZ + crankArmDepth / 2 + 0.055,
  );
  mainIndex.userData.role =
    'white-index-showing-linked-main-crank-variable-speed';
  mainCrank.add(
    mainShaft,
    mainHub,
    mainHubRim,
    mainArm,
    mainEnd,
    mainCrankPin,
    mainIndex,
  );

  const pitman = new THREE.Group();
  pitman.userData.role =
    'one-rigid-pitman-with-equal-power-middle-and-main-joint-spacing';
  const pitmanBeam = new THREE.Mesh(
    new THREE.BoxGeometry(
      pitmanHalfSpan * 2,
      pitmanThickness,
      pitmanDepth,
    ),
    inputMaterial,
  );
  pitmanBeam.position.z = pitmanPlaneZ;
  pitmanBeam.userData.role = 'single-rigid-shared-pitman-beam';
  const pitmanEyes = [-pitmanHalfSpan, 0, pitmanHalfSpan].map(
    (x, index) => {
      const eye = new THREE.Mesh(
        new THREE.TorusGeometry(
          pitmanEyeRadius,
          pitmanEyeTubeRadius,
          10,
          40,
        ),
        inputMaterial,
      );
      eye.position.set(x, 0, pitmanPlaneZ + pitmanDepth / 2 + 0.015);
      eye.userData.role = 'pitman-joint-eye';
      eye.userData.joint = [
        'power-wrist',
        'auxiliary-pin',
        'short-link-joint',
      ][index];
      return eye;
    },
  );
  const powerWristPin = cylinderAlongZ(
    jointPinRadius,
    0.70,
    whiteMaterial,
    36,
  );
  powerWristPin.position.set(
    -pitmanHalfSpan,
    0,
    pitmanPlaneZ + (powerLinkPlaneZ - pitmanPlaneZ) / 2,
  );
  powerWristPin.userData.role =
    'left-pitman-pin-on-reciprocating-power-member';
  const auxiliaryCrankPin = cylinderAlongZ(
    jointPinRadius,
    0.88,
    whiteMaterial,
    36,
  );
  auxiliaryCrankPin.position.set(
    0,
    0,
    auxiliaryPlaneZ + (pitmanPlaneZ - auxiliaryPlaneZ) / 2,
  );
  auxiliaryCrankPin.userData.role =
    'middle-pitman-pin-on-constant-radius-auxiliary-crank';
  const pitmanMainPin = cylinderAlongZ(
    jointPinRadius,
    0.68,
    whiteMaterial,
    36,
  );
  pitmanMainPin.position.set(
    pitmanHalfSpan,
    0,
    pitmanPlaneZ + (connectingLinkPlaneZ - pitmanPlaneZ) / 2,
  );
  pitmanMainPin.userData.role =
    'right-pitman-pin-revolute-with-one-short-link';
  pitman.add(
    pitmanBeam,
    ...pitmanEyes,
    powerWristPin,
    auxiliaryCrankPin,
    pitmanMainPin,
  );

  const connectingLink = makeDynamicLink({
    color: PALETTE.accent,
    depth: connectingLinkDepth,
    jointRadius: connectingJointRadius,
    thickness: connectingLinkThickness,
  });
  connectingLink.userData.role =
    'one-finite-short-link-between-pitman-and-main-crank';
  const [connectingLinkBeam, connectingLinkPitmanJoint,
    connectingLinkCrankJoint] = connectingLink.children;
  connectingLinkBeam.userData.role =
    'rigid-beam-of-the-single-added-connecting-link';
  connectingLinkPitmanJoint.userData.role =
    'short-link-revolute-joint-on-pitman-end';
  connectingLinkCrankJoint.userData.role =
    'short-link-revolute-joint-on-main-crank-pin';

  const inputPowerLink = makeDynamicLink({
    color: PALETTE.driver,
    depth: powerLinkDepth,
    jointRadius: remotePivotRadius,
    thickness: powerLinkThickness,
  });
  inputPowerLink.userData.role =
    'visible-upper-segment-of-the-finite-long-reciprocating-power-member';
  inputPowerLink.userData.fullLength = powerLinkLength;
  inputPowerLink.userData.hiddenRemotePivot = remotePowerPivot.clone();
  const detachedPowerContinuationEnd = inputPowerLink.children[2];
  inputPowerLink.remove(detachedPowerContinuationEnd);
  const powerLinkBreakMarks = [0, 1].map((index) => {
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(
        powerLinkBreakMarkWidth,
        powerLinkBreakMarkHeight,
        powerLinkDepth + 0.045,
      ),
      whiteMaterial,
    );
    mark.userData.role =
      'moving-break-mark-showing-power-member-continues-off-engraving';
    mark.userData.index = index;
    return mark;
  });

  const idealEllipsePoints = Array.from({ length: 192 }, (_, index) => {
    const angle = index / 192 * fullTurn;
    return new THREE.Vector3(
      mainPivot.x + auxiliaryCrankRadius * Math.cos(angle),
      mainPivot.y + auxiliaryCrankRadius * 2 * Math.sin(angle),
      framePlaneZ + 0.53,
    );
  });
  const idealEllipseCurve = new THREE.CatmullRomCurve3(
    idealEllipsePoints,
    true,
    'catmullrom',
    0.5,
  );
  const pitmanOrbitWitness = new THREE.Mesh(
    new THREE.TubeGeometry(idealEllipseCurve, 256, 0.017, 6, true),
    witnessMaterial,
  );
  pitmanOrbitWitness.userData.role =
    'faint-elliptical-witness-for-pitman-main-joint-orbit';
  pitmanOrbitWitness.userData.witnessOnly = true;
  const auxiliaryCircleWitness = new THREE.Mesh(
    new THREE.TorusGeometry(auxiliaryCrankRadius, 0.017, 6, 96),
    witnessMaterial,
  );
  auxiliaryCircleWitness.position.set(
    auxiliaryPivot.x,
    auxiliaryPivot.y,
    framePlaneZ + 0.53,
  );
  auxiliaryCircleWitness.userData.role =
    'faint-circle-witness-for-auxiliary-crank-pin';
  auxiliaryCircleWitness.userData.witnessOnly = true;
  const mainCrankCircleWitness = new THREE.Mesh(
    new THREE.TorusGeometry(mainCrankRadius, 0.017, 6, 128),
    witnessMaterial,
  );
  mainCrankCircleWitness.position.set(
    mainPivot.x,
    mainPivot.y,
    framePlaneZ + 0.53,
  );
  mainCrankCircleWitness.userData.role =
    'faint-circle-witness-for-fixed-radius-main-crank-pin';
  mainCrankCircleWitness.userData.witnessOnly = true;
  const witnesses = new THREE.Group();
  witnesses.userData.fixed = true;
  witnesses.userData.role = 'three-source-orbit-witnesses-behind-the-linkage';
  witnesses.add(
    pitmanOrbitWitness,
    auxiliaryCircleWitness,
    mainCrankCircleWitness,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.55, 4.80, 3.85),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0.37, -0.20, 0.10);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-of-source-cropped-linked-crank-assembly';

  root.add(
    cameraEnvelope,
    fixedFrame,
    witnesses,
    auxiliary,
    mainCrank,
    pitman,
    connectingLink,
    inputPowerLink,
    ...powerLinkBreakMarks,
  );

  const phaseTime = (targetAngle) => positiveModulo(
    targetAngle - sourcePoseAngle,
    fullTurn,
  ) / auxiliaryAngularSpeed;
  const canonicalTimes = {
    sourcePose: 0,
    upperToLeft: phaseTime(Math.PI * 0.75),
    left: phaseTime(Math.PI),
    lower: phaseTime(Math.PI * 1.5),
    lowerToRight: phaseTime(Math.PI * 1.75),
    right: phaseTime(fullTurn),
    fullCycle: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    auxiliary.rotation.z = state.auxiliaryAngle;
    auxiliary.userData.angularSpeed = state.auxiliaryAngleSpeed;
    mainCrank.rotation.z = state.mainAngle;
    mainCrank.userData.angularSpeed = state.mainAngularSpeed;
    mainCrank.userData.angularAcceleration = state.mainAngularAcceleration;
    pitman.position.set(state.auxiliaryPin.x, state.auxiliaryPin.y, 0);
    pitman.rotation.z = state.pitmanAngle;
    pitman.userData.angularSpeed = state.pitmanAngularSpeed;
    pitman.userData.angularAcceleration = state.pitmanAngularAcceleration;
    connectingLink.userData.setEndpoints(
      new THREE.Vector3(
        state.pitmanMainJoint.x,
        state.pitmanMainJoint.y,
        connectingLinkPlaneZ,
      ),
      new THREE.Vector3(
        state.mainCrankPin.x,
        state.mainCrankPin.y,
        connectingLinkPlaneZ,
      ),
    );
    connectingLink.userData.angularSpeed = state.connectingLinkAngularSpeed;
    connectingLink.userData.angularAcceleration =
      state.connectingLinkAngularAcceleration;

    const visiblePowerDirection = remotePowerPivot.clone()
      .sub(state.powerWrist).normalize();
    const visiblePowerLinkEnd = state.powerWrist.clone().addScaledVector(
      visiblePowerDirection,
      visiblePowerLinkLength,
    );
    inputPowerLink.userData.setEndpoints(
      new THREE.Vector3(
        state.powerWrist.x,
        state.powerWrist.y,
        powerLinkPlaneZ,
      ),
      new THREE.Vector3(
        visiblePowerLinkEnd.x,
        visiblePowerLinkEnd.y,
        powerLinkPlaneZ,
      ),
    );
    inputPowerLink.userData.angularSpeed = state.powerLinkAngularSpeed;
    inputPowerLink.userData.angularAcceleration =
      state.powerLinkAngularAcceleration;
    const powerLinkBreakRotation = Math.atan2(
      visiblePowerDirection.y,
      visiblePowerDirection.x,
    ) + Math.PI / 2;
    powerLinkBreakMarks.forEach((mark, index) => {
      const distanceFromWrist = visiblePowerLinkLength
        - 0.18 - index * 0.20;
      const position = state.powerWrist.clone().addScaledVector(
        visiblePowerDirection,
        distanceFromWrist,
      );
      mark.position.set(position.x, position.y, powerLinkPlaneZ);
      mark.rotation.z = powerLinkBreakRotation;
    });
    root.userData.kinematics = state;

    root.updateMatrixWorld(true);
    const renderedAuxiliaryEnd = auxiliaryEnd.getWorldPosition(
      new THREE.Vector3(),
    );
    const renderedPitmanAuxiliaryPin = auxiliaryCrankPin.getWorldPosition(
      new THREE.Vector3(),
    );
    const renderedMainCrankPin = mainCrankPin.getWorldPosition(
      new THREE.Vector3(),
    );
    const renderedPitmanMainPin = pitmanMainPin.getWorldPosition(
      new THREE.Vector3(),
    );
    const renderedPowerWrist = powerWristPin.getWorldPosition(
      new THREE.Vector3(),
    );
    const renderedLinkPitmanJoint = connectingLinkPitmanJoint
      .getWorldPosition(new THREE.Vector3());
    const renderedLinkCrankJoint = connectingLinkCrankJoint
      .getWorldPosition(new THREE.Vector3());
    root.userData.contacts = {
      auxiliaryJoint: {
        crankEndError: Math.hypot(
          renderedAuxiliaryEnd.x - state.auxiliaryPin.x,
          renderedAuxiliaryEnd.y - state.auxiliaryPin.y,
        ),
        pitmanPinError: Math.hypot(
          renderedPitmanAuxiliaryPin.x - state.auxiliaryPin.x,
          renderedPitmanAuxiliaryPin.y - state.auxiliaryPin.y,
        ),
        rigidRadiusError: state.auxiliaryRadiusError,
      },
      connectingLink: {
        crankJointError: Math.hypot(
          renderedLinkCrankJoint.x - state.mainCrankPin.x,
          renderedLinkCrankJoint.y - state.mainCrankPin.y,
        ),
        innerCircleMargin: state.circleInnerMargin,
        lengthError: state.connectingLinkLengthError,
        outerCircleMargin: state.circleOuterMargin,
        pitmanJointError: Math.hypot(
          renderedLinkPitmanJoint.x - state.pitmanMainJoint.x,
          renderedLinkPitmanJoint.y - state.pitmanMainJoint.y,
        ),
      },
      mainCrankJoint: {
        crankPinError: Math.hypot(
          renderedMainCrankPin.x - state.mainCrankPin.x,
          renderedMainCrankPin.y - state.mainCrankPin.y,
        ),
        rigidRadiusError: state.mainCrankLengthError,
      },
      pitman: {
        mainPinError: Math.hypot(
          renderedPitmanMainPin.x - state.pitmanMainJoint.x,
          renderedPitmanMainPin.y - state.pitmanMainJoint.y,
        ),
        midpointError: state.midpointError,
        powerPinError: Math.hypot(
          renderedPowerWrist.x - state.powerWrist.x,
          renderedPowerWrist.y - state.powerWrist.y,
        ),
        leftLengthError: state.leftPitmanLengthError,
        rightLengthError: state.rightPitmanLengthError,
      },
      powerMember: {
        rigidLengthError: state.powerLinkLengthError,
        remotePivot: remotePowerPivot.clone(),
        visibleDirection: visiblePowerDirection.clone(),
        visibleEnd: visiblePowerLinkEnd.clone(),
        visibleLength: visiblePowerLinkLength,
      },
      shaftBearings: {
        axis: Z_AXIS.clone(),
        radialClearance: bearingInnerRadius - shaftRadius,
      },
    };
  };

  root.userData.mechanism =
    'shared-pitman-constant-radius-auxiliary-crank-short-link-main-crank';
  root.userData.blocks = {
    auxiliary,
    auxiliaryArm,
    auxiliaryCircleWitness,
    auxiliaryCrankPin,
    auxiliaryEnd,
    auxiliaryHub,
    auxiliaryIndex,
    auxiliaryShaft,
    baseRail,
    bearingPedestals,
    cameraEnvelope,
    connectingLink,
    connectingLinkBeam,
    connectingLinkCrankJoint,
    connectingLinkPitmanJoint,
    fixedBearingBores,
    fixedBearings,
    fixedFrame,
    inputPowerLink,
    mainArm,
    mainCrank,
    mainCrankCircleWitness,
    mainCrankPin,
    mainEnd,
    mainHub,
    mainHubRim,
    mainIndex,
    mainShaft,
    pitman,
    pitmanBeam,
    pitmanEyes,
    pitmanMainPin,
    pitmanOrbitWitness,
    powerLinkBreakMarks,
    powerWristPin,
    witnesses,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.curves = { idealEllipse: idealEllipseCurve };
  root.userData.geometry = {
    auxiliaryAngularSpeed,
    auxiliaryCrankRadius,
    auxiliaryHubRadius,
    auxiliaryPivot: auxiliaryPivot.clone(),
    auxiliaryPlaneZ,
    baseCenterX,
    baseMaximumX,
    baseMinimumX,
    baseRailDepth,
    baseRailHeight,
    baseWidth,
    baseY,
    bearingDepth,
    bearingInnerRadius,
    bearingOuterRadius,
    cameraEnvelopeDepth: 3.85,
    cameraEnvelopeHeight: 4.80,
    cameraEnvelopeWidth: 7.55,
    connectingJointRadius,
    connectingLinkDepth,
    connectingLinkLength,
    connectingLinkPlaneZ,
    connectingLinkThickness,
    crankArmDepth,
    crankArmHalfHeight,
    cyclePeriod,
    framePlaneZ,
    fullTurn,
    jointPinRadius,
    mainCrankPlaneZ,
    mainCrankRadius,
    mainHubRadius,
    mainPivot: mainPivot.clone(),
    nominalPowerWrist: nominalPowerWrist.clone(),
    pitmanDepth,
    pitmanEyeRadius,
    pitmanEyeTubeRadius,
    pitmanHalfSpan,
    pitmanPlaneZ,
    pitmanThickness,
    powerLinkBreakMarkHeight,
    powerLinkBreakMarkWidth,
    powerLinkDepth,
    powerLinkLength,
    powerLinkPlaneZ,
    powerLinkThickness,
    rawMainAngleAtZero,
    remotePivotRadius,
    remotePowerPivot: remotePowerPivot.clone(),
    shaftLength,
    shaftRadius,
    sourceConstructionAuxiliaryCrankRadius,
    sourceConstructionAuxiliaryPivot:
      sourceConstructionAuxiliaryPivot.clone(),
    sourceConstructionMainPivot: sourceConstructionMainPivot.clone(),
    sourceConstructionPitmanHalfSpan,
    sourceConstructionPowerLinkLength,
    sourceConstructionRemotePowerPivot:
      sourceConstructionRemotePowerPivot.clone(),
    sourceEngravingConnectingLinkLength,
    sourceEngravingMainCrankRadius,
    sourceEngravingPoseCycle,
    sourceImageHeight,
    sourceImageWidth,
    sourcePoseAngle,
    sourceRasterAuxiliaryPinCenter:
      sourceRasterAuxiliaryPinCenter.clone(),
    sourceRasterAuxiliaryShaftCenter:
      sourceRasterAuxiliaryShaftCenter.clone(),
    sourceRasterMainCrankPinCenter:
      sourceRasterMainCrankPinCenter.clone(),
    sourceRasterMainEllipseBottomY,
    sourceRasterMainEllipseLeftX,
    sourceRasterMainEllipseRightX,
    sourceRasterMainEllipseTopY,
    sourceRasterMainShaftCenter: sourceRasterMainShaftCenter.clone(),
    sourceRasterPitmanMainJointCenter:
      sourceRasterPitmanMainJointCenter.clone(),
    sourceRasterPowerWristCenter:
      sourceRasterPowerWristCenter.clone(),
    sourceRasterRemoteMemberCropPoint:
      sourceRasterRemoteMemberCropPoint.clone(),
    sourceScale,
    visiblePowerLinkLength,
  };
  root.userData.motionAtAuxiliaryAngle = motionAtAuxiliaryAngle;
  root.userData.positionAtNormalizedAuxiliaryAngle =
    positionAtNormalizedAuxiliaryAngle;
  root.userData.stateAtAuxiliaryAngle = stateAtAuxiliaryAngle;
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
    auxiliaryCircleWitness,
    auxiliaryIndex,
    cameraEnvelope,
    mainCrankCircleWitness,
    mainIndex,
    pitmanOrbitWitness,
    ...powerLinkBreakMarks,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';
  root.userData.cameraDistanceScale = 0.98;
  return {
    cameraDirection: new THREE.Vector3(6.6, 4.4, 15.6),
    root,
    update,
  };
}

function eccentricCircularGuideVariableSpeedShaper({reference = false} = {}) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Preserve the original 2D dimensions for regression comparisons. Production
  // fits the engraving: 32.8 raster pixels per reference unit. The same analytic
  // circle/ray and rod/guide constraints apply to both dimension sets.
  const sourceAnimationViewMinimum = new THREE.Vector2(-9, -9);
  const sourceAnimationViewSize = new THREE.Vector2(18, 18);
  const sourceAnimationGrooveInnerRadius = reference ? 5 : 157.5 / 32.8;
  const sourceAnimationGrooveOuterRadius = reference ? 5.5 : 178.5 / 32.8;
  const sourceAnimationGrooveCenterRadius = reference ? 5.25 : 168 / 32.8;
  const sourceAnimationOuterDiskRadius = 6.25;
  const sourceAnimationInnerBossOuterRadius = reference ? 3 : 110 / 32.8;
  const sourceAnimationInnerBossInnerRadius = reference ? 2.75 : 102 / 32.8;
  const sourceAnimationShaftCenter = new THREE.Vector2(0, reference ? -2 : -76 / 32.8);
  const sourceAnimationCrankReach = reference ? 8 : 289 / 32.8;
  const sourceAnimationCrankBodyHalfWidth = reference ? .75 : 25 / 32.8;
  const sourceAnimationCrankSlotHalfWidth = reference ? .25 : 7 / 32.8;
  const sourceAnimationSliderShoeRadius = 0.25;
  const sourceAnimationConnectingRodLength = reference ? 25 : Math.hypot(168, 256 * 168 / 77) / 32.8;
  const sourceAnimationOutputGuideStart = new THREE.Vector2(reference ? -17.5 : -sourceAnimationConnectingRodLength + 6.2, 0);
  const sourceAnimationOutputGuideEnd = new THREE.Vector2(reference ? -31.5 : -sourceAnimationConnectingRodLength - 7.3, 0);
  const sourceAnimationSourceCycle = 0;
  const sourceAnimationInputTurnsPerCycle = -1;

  // Approximate locks measured from the 525 px public-domain engraving.
  // Brown's circles are hand drawn, so these intentionally remain separate
  // from the exact animation construction above.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterDiskCenter = new THREE.Vector2(295, 245);
  const sourceRasterOuterDiskRadius = 205;
  const sourceRasterGrooveInnerRadius = 160;
  const sourceRasterGrooveOuterRadius = 181;
  const sourceRasterShaftCenter = new THREE.Vector2(295, 321);
  const sourceRasterSliderCenter = new THREE.Vector2(295, 77);
  const sourceRasterConnectingRodCropPoint = new THREE.Vector2(39, 154);
  const sourceRasterCrankBodyLeftX = 270;
  const sourceRasterCrankBodyRightX = 320;
  const sourceRasterCrankBodyTopY = 7;
  const sourceRasterCrankBodyBottomY = 358;

  const sourceScale = 0.62;
  const fixedDiskCenter = new THREE.Vector2(5.2, 0.35);
  const animationPointToModel = (point) => new THREE.Vector2(
    fixedDiskCenter.x + point.x * sourceScale,
    fixedDiskCenter.y + point.y * sourceScale,
  );
  const modelPointToAnimation = (point) => new THREE.Vector2(
    (point.x - fixedDiskCenter.x) / sourceScale,
    (point.y - fixedDiskCenter.y) / sourceScale,
  );
  const sourceRasterPixelsPerAnimationUnit = sourceRasterOuterDiskRadius
    / sourceAnimationOuterDiskRadius;
  const modelPointToSourceRaster = (point) => {
    const animationPoint = modelPointToAnimation(point);
    return new THREE.Vector2(
      sourceRasterDiskCenter.x
        + animationPoint.x * sourceRasterPixelsPerAnimationUnit,
      sourceRasterDiskCenter.y
        - animationPoint.y * sourceRasterPixelsPerAnimationUnit,
    );
  };
  const sourceRasterPointToModel = (point) => animationPointToModel(
    new THREE.Vector2(
      (point.x - sourceRasterDiskCenter.x)
        / sourceRasterPixelsPerAnimationUnit,
      -(point.y - sourceRasterDiskCenter.y)
        / sourceRasterPixelsPerAnimationUnit,
    ),
  );

  const grooveInnerRadius = sourceAnimationGrooveInnerRadius * sourceScale;
  const grooveOuterRadius = sourceAnimationGrooveOuterRadius * sourceScale;
  const grooveCenterRadius = sourceAnimationGrooveCenterRadius * sourceScale;
  const grooveHalfWidth = (grooveOuterRadius - grooveInnerRadius) / 2;
  const outerDiskRadius = sourceAnimationOuterDiskRadius * sourceScale;
  const innerBossOuterRadius = sourceAnimationInnerBossOuterRadius
    * sourceScale;
  const innerBossInnerRadius = sourceAnimationInnerBossInnerRadius
    * sourceScale;
  const shaftCenter = animationPointToModel(sourceAnimationShaftCenter);
  const shaftEccentricity = shaftCenter.distanceTo(fixedDiskCenter);
  const crankReach = sourceAnimationCrankReach * sourceScale;
  const crankBodyHalfWidth = sourceAnimationCrankBodyHalfWidth * sourceScale;
  const crankSlotHalfWidth = sourceAnimationCrankSlotHalfWidth * sourceScale;
  const connectingRodLength = sourceAnimationConnectingRodLength
    * sourceScale;
  const outputGuideSourceStart = animationPointToModel(
    sourceAnimationOutputGuideStart,
  );
  const outputGuideSourceEnd = animationPointToModel(
    sourceAnimationOutputGuideEnd,
  );
  const outputGuideMinimumX = Math.min(
    outputGuideSourceStart.x,
    outputGuideSourceEnd.x,
  );
  const outputGuideMaximumX = Math.max(
    outputGuideSourceStart.x,
    outputGuideSourceEnd.x,
  );
  const outputGuideY = fixedDiskCenter.y;
  const sourceInputAngle = Math.PI / 2;
  const inputAngularSpeed = -0.62;
  const cyclePeriod = fullTurn / Math.abs(inputAngularSpeed);
  const minimumCrankRadius = grooveCenterRadius - shaftEccentricity;
  const maximumCrankRadius = grooveCenterRadius + shaftEccentricity;
  const outputStroke = grooveCenterRadius * 2;
  const idealTopBottomSpeedRatio = maximumCrankRadius
    / minimumCrankRadius;

  const plateDepth = reference ? .32 : .48;
  const plateCenterZ = reference ? -.34 : -.42;
  const plateFrontZ = plateCenterZ + plateDepth / 2;
  const plateOutlineZ = plateFrontZ + 0.018;
  const shaftOpeningRadius = 0.39;
  const shaftRadius = 0.24;
  const shaftLength = 1.35;
  const shaftCenterZ = -0.065;
  const crankPlaneZ = 0.13;
  const crankDepth = 0.28;
  const crankFrontZ = crankPlaneZ + crankDepth / 2;
  const crankSlotNearRadius = reference ? .68 : 40 * sourceScale / 32.8;
  const crankSlotFarRadius = reference ? crankReach - .29 : 287 * sourceScale / 32.8;
  const crankSlotOutlineWidth = 0.045;
  const crankHubRadius = reference ? .82 : 26 * sourceScale / 32.8;
  const crankHubDepth = 0.48;
  const sliderFitClearance = 0.012;
  const radialSlotShoeRadius = crankSlotHalfWidth - sliderFitClearance;
  const circularGrooveShoeRadius = grooveHalfWidth - sliderFitClearance;
  const grooveShoeCenterZ = reference ? plateCenterZ + .03 : -.31;
  const grooveShoeDepth = reference ? plateDepth + .16 : .48;
  const radialShoeCenterZ = 0.15;
  const radialShoeDepth = 0.62;
  const sliderBlockCenterZ = 0.42;
  const sliderBlockDepth = 0.28;
  const sliderBlockLength = 0.88;
  const sliderBlockWidth = 0.55;
  const sliderFrontBossRadius = 0.29;
  const sliderFrontBossDepth = 0.50;
  const sliderFrontBossCenterZ = 0.66;
  const connectingRodPlaneZ = 0.76;
  const connectingRodDepth = 0.20;
  const connectingRodThickness = 0.19;
  const outputGuideHalfGap = 0.39;
  const outputGuideRailThickness = 0.12;
  const outputGuideDepth = 0.34;
  const outputGuideCenterZ = 0.08;
  const outputSlideWidth = 0.92;
  const outputSlideHeight = 0.58;
  const outputSlideDepth = 0.46;
  const outputSlideCenterZ = 0.34;
  const outputPinRadius = 0.25;
  const outputPinDepth = 0.75;
  const outputPinCenterZ = 0.535;

  const positiveModulo = (value, modulus) => {
    const remainder = value % modulus;
    if (remainder === 0) return 0;
    return remainder < 0 ? remainder + modulus : remainder;
  };

  const circularRingShape = (innerRadius, outerRadius) => {
    const shape = new THREE.Shape();
    shape.moveTo(outerRadius, 0);
    shape.absarc(0, 0, outerRadius, 0, fullTurn, false);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(innerRadius, 0);
    hole.absarc(0, 0, innerRadius, 0, fullTurn, true);
    hole.closePath();
    shape.holes.push(hole);
    return shape;
  };

  const diskWithOffsetHoleShape = (radius, holeCenter, holeRadius) => {
    const shape = new THREE.Shape();
    shape.moveTo(radius, 0);
    shape.absarc(0, 0, radius, 0, fullTurn, false);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(holeCenter.x + holeRadius, holeCenter.y);
    hole.absarc(
      holeCenter.x,
      holeCenter.y,
      holeRadius,
      0,
      fullTurn,
      true,
    );
    hole.closePath();
    shape.holes.push(hole);
    return shape;
  };

  const rightwardCapsuleShape = (radius, startX, endX) => {
    const shape = new THREE.Shape();
    shape.moveTo(startX, -radius);
    shape.lineTo(endX, -radius);
    shape.absarc(
      endX,
      0,
      radius,
      -Math.PI / 2,
      Math.PI / 2,
      false,
    );
    shape.lineTo(startX, radius);
    shape.absarc(
      startX,
      0,
      radius,
      Math.PI / 2,
      Math.PI * 1.5,
      false,
    );
    shape.closePath();
    return shape;
  };

  const addCapsuleHole = (shape, radius, startX, endX) => {
    const hole = new THREE.Path();
    hole.moveTo(endX, -radius);
    hole.lineTo(startX, -radius);
    hole.absarc(
      startX,
      0,
      radius,
      -Math.PI / 2,
      Math.PI / 2,
      true,
    );
    hole.lineTo(endX, radius);
    hole.absarc(
      endX,
      0,
      radius,
      Math.PI / 2,
      -Math.PI / 2,
      true,
    );
    hole.closePath();
    shape.holes.push(hole);
    return shape;
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.61,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.65,
  });
  const sliderMaterial = matte(PALETTE.accent, {
    metalness: 0.14,
    roughness: 0.57,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.70,
  });
  const translucentPlateMaterial = matte(PALETTE.frame, {
    metalness: 0.04,
    opacity: 0.22,
    roughness: 0.82,
    side: THREE.DoubleSide,
    transparent: true,
  });
  translucentPlateMaterial.depthWrite = false;
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });
  const witnessMaterial = matte(PALETTE.accent, {
    opacity: 0.62,
    roughness: 0.65,
    transparent: true,
  });

  const outerPlate = new THREE.Mesh(
    centeredExtrusion(
      circularRingShape(grooveOuterRadius, outerDiskRadius),
      plateDepth,
      0,
    ),
    translucentPlateMaterial,
  );
  outerPlate.position.set(fixedDiskCenter.x, fixedDiskCenter.y, plateCenterZ);
  outerPlate.userData.role = 'fixed-outer-disk-surrounding-circular-guide-slot';

  const shaftOffset = shaftCenter.clone().sub(fixedDiskCenter);
  const innerPlate = new THREE.Mesh(
    centeredExtrusion(
      diskWithOffsetHoleShape(
        grooveInnerRadius,
        shaftOffset,
        shaftOpeningRadius,
      ),
      plateDepth,
      0,
    ),
    translucentPlateMaterial,
  );
  innerPlate.position.set(fixedDiskCenter.x, fixedDiskCenter.y, plateCenterZ);
  innerPlate.userData.role = 'fixed-inner-disk-with-eccentric-shaft-opening';

  const fixedRing = (radius, tubeRadius, role, material = frameMaterial) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tubeRadius, 10, 128),
      material,
    );
    ring.position.set(fixedDiskCenter.x, fixedDiskCenter.y, plateOutlineZ);
    ring.userData.role = role;
    return ring;
  };
  const outerDiskOutline = fixedRing(
    outerDiskRadius,
    reference ? .055 : .025,
    'outer-outline-of-fixed-eccentric-guide-disk',
    darkMaterial,
  );
  const grooveOuterWall = fixedRing(
    grooveOuterRadius,
    0.045,
    'fixed-outer-contact-wall-of-annular-groove',
    darkMaterial,
  );
  grooveOuterWall.userData.contactSurface = true;
  grooveOuterWall.userData.contactRadius = grooveOuterRadius;
  const grooveInnerWall = fixedRing(
    grooveInnerRadius,
    0.045,
    'fixed-inner-contact-wall-of-annular-groove',
    darkMaterial,
  );
  grooveInnerWall.userData.contactSurface = true;
  grooveInnerWall.userData.contactRadius = grooveInnerRadius;
  const grooveCenterlineWitness = fixedRing(
    grooveCenterRadius,
    0.018,
    'centerline-witness-of-fixed-circular-slider-path',
    witnessMaterial,
  );
  const innerBossOuterOutline = fixedRing(
    innerBossOuterRadius,
    0.036,
    'source-three-radius-outline-on-fixed-inner-disk',
    frameMaterial,
  );
  const innerBossInnerOutline = fixedRing(
    innerBossInnerRadius,
    0.028,
    'source-two-point-seven-five-radius-outline-on-fixed-inner-disk',
    frameMaterial,
  );

  const fixedDiskCenterAnchor = new THREE.Object3D();
  fixedDiskCenterAnchor.position.set(
    fixedDiskCenter.x,
    fixedDiskCenter.y,
    plateOutlineZ,
  );
  fixedDiskCenterAnchor.userData.role = 'fixed-circular-guide-center-anchor';
  const shaftCenterAnchor = new THREE.Object3D();
  shaftCenterAnchor.position.set(shaftCenter.x, shaftCenter.y, 0);
  shaftCenterAnchor.userData.role = 'eccentric-driving-shaft-center-anchor';

  const fixedShaftBearing = new THREE.Mesh(
    ring(shaftRadius + .01, shaftOpeningRadius, -.05, .05, 96),
    frameMaterial,
  );
  fixedShaftBearing.position.set(
    shaftCenter.x,
    shaftCenter.y,
    -.20,
  );
  fixedShaftBearing.userData.role = 'fixed-bearing-around-eccentric-input-shaft';

  const inputCrank = new THREE.Group();
  inputCrank.position.set(shaftCenter.x, shaftCenter.y, 0);
  inputCrank.userData.axis = Z_AXIS.clone();
  inputCrank.userData.role = 'clockwise-input-shaft-and-radially-slotted-crank';

  const crankShape = rightwardCapsuleShape(
    crankBodyHalfWidth,
    0,
    crankReach,
  );
  addCapsuleHole(
    crankShape,
    crankSlotHalfWidth,
    crankSlotNearRadius,
    crankSlotFarRadius,
  );
  const crankBody = new THREE.Mesh(
    centeredExtrusion(crankShape, crankDepth, 0),
    driverMaterial,
  );
  crankBody.position.z = crankPlaneZ;
  crankBody.userData.role = 'one-rigid-radially-slotted-variable-length-crank';
  inputCrank.add(crankBody);

  const slotOutlineShape = rightwardCapsuleShape(
    crankSlotHalfWidth + crankSlotOutlineWidth,
    crankSlotNearRadius,
    crankSlotFarRadius,
  );
  addCapsuleHole(
    slotOutlineShape,
    crankSlotHalfWidth,
    crankSlotNearRadius,
    crankSlotFarRadius,
  );
  const crankSlotOutline = new THREE.Mesh(
    centeredExtrusion(slotOutlineShape, 0.035, 0.005),
    darkMaterial,
  );
  crankSlotOutline.position.z = crankFrontZ + 0.025;
  crankSlotOutline.userData.role = 'dark-outline-of-open-radial-crank-slot';
  crankSlotOutline.userData.contactSurface = true;
  inputCrank.add(crankSlotOutline);

  const inputShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
    44,
  );
  inputShaft.position.z = shaftCenterZ;
  inputShaft.userData.role = 'continuous-clockwise-eccentric-driving-shaft';
  const crankHub = cylinderAlongZ(
    crankHubRadius,
    crankHubDepth,
    driverMaterial,
    64,
  );
  crankHub.position.z = crankPlaneZ;
  crankHub.userData.role = 'input-hub-covering-near-end-of-crank-slot';
  const crankHubOutline = new THREE.Mesh(
    new THREE.TorusGeometry(crankHubRadius - 0.045, 0.048, 10, 64),
    darkMaterial,
  );
  crankHubOutline.position.z = crankPlaneZ + crankHubDepth / 2 + 0.018;
  crankHubOutline.userData.role = 'front-outline-of-eccentric-input-hub';
  const inputRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(crankHubRadius * 0.72, 0.065, 0.034),
    whiteMaterial,
  );
  inputRotationIndex.position.set(
    crankHubRadius * 0.36,
    0,
    crankPlaneZ + crankHubDepth / 2 + 0.055,
  );
  inputRotationIndex.userData.role = 'white-index-showing-clockwise-input-rotation';
  inputCrank.add(
    inputShaft,
    crankHub,
    crankHubOutline,
    inputRotationIndex,
  );

  const inputSliderAnchor = new THREE.Object3D();
  inputSliderAnchor.position.set(maximumCrankRadius, 0, crankPlaneZ);
  inputSliderAnchor.userData.role = 'variable-radius-point-on-crank-slot-axis';
  const crankSlotNearAnchor = new THREE.Object3D();
  crankSlotNearAnchor.position.set(crankSlotNearRadius, 0, crankPlaneZ);
  crankSlotNearAnchor.userData.role = 'near-end-center-of-radial-crank-slot';
  const crankSlotFarAnchor = new THREE.Object3D();
  crankSlotFarAnchor.position.set(crankSlotFarRadius, 0, crankPlaneZ);
  crankSlotFarAnchor.userData.role = 'far-end-center-of-radial-crank-slot';
  inputCrank.add(
    inputSliderAnchor,
    crankSlotNearAnchor,
    crankSlotFarAnchor,
  );

  const sliderAssembly = new THREE.Group();
  sliderAssembly.userData.role =
    'single-slide-fitting-radial-crank-slot-and-fixed-circular-groove';
  const circularGrooveShoe = cylinderAlongZ(
    circularGrooveShoeRadius,
    grooveShoeDepth,
    sliderMaterial,
    40,
  );
  circularGrooveShoe.position.z = grooveShoeCenterZ;
  circularGrooveShoe.userData.role =
    'rear-circular-shoe-fitting-between-both-annular-groove-walls';
  const radialSlotShoe = cylinderAlongZ(
    radialSlotShoeRadius,
    radialShoeDepth,
    sliderMaterial,
    40,
  );
  radialSlotShoe.position.z = radialShoeCenterZ;
  radialSlotShoe.userData.role =
    'coaxial-pin-fitting-between-both-radial-crank-slot-walls';
  const sliderBlock = new THREE.Mesh(
    new THREE.BoxGeometry(
      sliderBlockLength,
      sliderBlockWidth,
      sliderBlockDepth,
    ),
    sliderMaterial,
  );
  sliderBlock.position.z = sliderBlockCenterZ;
  sliderBlock.userData.role = 'rectangular-body-of-dual-constrained-slide';
  const sliderFrontBoss = cylinderAlongZ(
    sliderFrontBossRadius,
    sliderFrontBossDepth,
    sliderMaterial,
    48,
  );
  sliderFrontBoss.position.z = sliderFrontBossCenterZ;
  sliderFrontBoss.userData.role = 'front-wrist-boss-for-connecting-rod';
  const sliderFrontOutline = new THREE.Mesh(
    new THREE.TorusGeometry(
      sliderFrontBossRadius - 0.028,
      0.034,
      9,
      48,
    ),
    darkMaterial,
  );
  sliderFrontOutline.position.z = sliderFrontBossCenterZ
    + sliderFrontBossDepth / 2 + 0.012;
  sliderFrontOutline.userData.role = 'front-outline-of-moving-slider-wrist';
  const sliderRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(sliderFrontBossRadius * 0.72, 0.05, 0.03),
    whiteMaterial,
  );
  sliderRotationIndex.position.set(
    sliderFrontBossRadius * 0.36,
    0,
    sliderFrontBossCenterZ + sliderFrontBossDepth / 2 + 0.047,
  );
  sliderRotationIndex.userData.role =
    'white-index-on-slide-body-aligned-with-radial-crank';
  const sliderCenterAnchor = new THREE.Object3D();
  sliderCenterAnchor.position.z = connectingRodPlaneZ;
  sliderCenterAnchor.userData.role = 'dual-constrained-slider-center-anchor';
  sliderAssembly.add(
    circularGrooveShoe,
    radialSlotShoe,
    sliderBlock,
    sliderFrontBoss,
    sliderFrontOutline,
    sliderRotationIndex,
    sliderCenterAnchor,
  );

  const connectingRod = makeDynamicLink({
    color: PALETTE.driven,
    depth: connectingRodDepth,
    jointRadius: sliderFrontBossRadius,
    thickness: connectingRodThickness,
  });
  connectingRod.userData.role =
    'finite-connecting-rod-from-dual-slide-to-horizontal-tool-slide';
  connectingRod.userData.fullLength = connectingRodLength;
  const [connectingRodBeam, connectingRodSliderEye,
    connectingRodOutputEye] = connectingRod.children;
  // Flat bored eyes and a beam stopping outside both pin bores.
  // Keep the existing endpoint updater and its exact rigid-length constraint.
  connectingRodBeam.geometry.dispose();
  connectingRodBeam.geometry = new THREE.BoxGeometry(1 - .64 / connectingRodLength,
    connectingRodThickness, connectingRodDepth);
  const oldEyeGeometry = connectingRodSliderEye.geometry;
  for (const eye of [connectingRodSliderEye, connectingRodOutputEye]) {
    eye.geometry = ring(eye === connectingRodSliderEye ? .30 : .26, .39, -connectingRodDepth/2, connectingRodDepth/2, 96);
  }
  oldEyeGeometry.dispose();
  connectingRodBeam.userData.role = 'rigid-beam-of-finite-connecting-rod';
  connectingRodSliderEye.userData.role =
    'connecting-rod-eye-on-circular-guide-slide';
  connectingRodOutputEye.userData.role =
    'connecting-rod-eye-on-horizontal-output-slide';

  const outputGuideRailLength = outputGuideMaximumX
    - outputGuideMinimumX;
  const outputGuideRails = [-1, 1].map((sideSign) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(
        outputGuideRailLength,
        outputGuideRailThickness,
        outputGuideDepth,
      ),
      frameMaterial,
    );
    rail.position.set(
      (outputGuideMinimumX + outputGuideMaximumX) / 2,
      outputGuideY + sideSign * outputGuideHalfGap,
      outputGuideCenterZ,
    );
    rail.userData.role = 'fixed-horizontal-guide-rail-for-cutting-slide';
    rail.userData.side = sideSign < 0 ? 'lower' : 'upper';
    rail.userData.contactSurface = true;
    return rail;
  });
  const outputGuideEndStops = [
    outputGuideMinimumX,
    outputGuideMaximumX,
  ].map((x, index) => {
    const stop = new THREE.Mesh(
      new THREE.BoxGeometry(
        outputGuideRailThickness,
        outputGuideHalfGap * 2 + outputGuideRailThickness,
        outputGuideDepth,
      ),
      frameMaterial,
    );
    stop.position.set(x, outputGuideY, outputGuideCenterZ);
    stop.userData.role = 'fixed-end-stop-of-horizontal-output-guide';
    stop.userData.side = index === 0 ? 'left' : 'right';
    return stop;
  });
  const outputGuideStartAnchor = new THREE.Object3D();
  outputGuideStartAnchor.position.set(
    outputGuideMinimumX,
    outputGuideY,
    outputGuideCenterZ,
  );
  outputGuideStartAnchor.userData.role = 'left-end-of-horizontal-output-guide';
  const outputGuideEndAnchor = new THREE.Object3D();
  outputGuideEndAnchor.position.set(
    outputGuideMaximumX,
    outputGuideY,
    outputGuideCenterZ,
  );
  outputGuideEndAnchor.userData.role = 'right-end-of-horizontal-output-guide';

  const outputSlide = new THREE.Group();
  outputSlide.userData.role = 'nonrotating-horizontal-cutting-tool-slide';
  const outputSlideBody = new THREE.Mesh(
    new THREE.BoxGeometry(
      outputSlideWidth,
      outputSlideHeight,
      outputSlideDepth,
    ),
    drivenMaterial,
  );
  outputSlideBody.position.z = outputSlideCenterZ;
  outputSlideBody.userData.role = 'guided-crosshead-body-of-cutting-slide';
  const outputPin = cylinderAlongZ(
    outputPinRadius,
    outputPinDepth,
    drivenMaterial,
    44,
  );
  outputPin.position.z = outputPinCenterZ;
  outputPin.userData.role = 'revolute-pin-between-rod-and-output-slide';
  const outputPinOutline = new THREE.Mesh(
    new THREE.TorusGeometry(outputPinRadius - 0.025, 0.032, 9, 44),
    darkMaterial,
  );
  outputPinOutline.position.z = outputPinCenterZ + outputPinDepth / 2 + 0.012;
  outputPinOutline.userData.role = 'front-outline-of-output-slide-pin';
  const outputSlideIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.055, 0.032),
    whiteMaterial,
  );
  outputSlideIndex.position.set(
    0,
    0,
    outputSlideCenterZ + outputSlideDepth / 2 + 0.035,
  );
  outputSlideIndex.userData.role = 'white-index-showing-pure-output-translation';
  const cuttingToolBar = new THREE.Mesh(
    new THREE.BoxGeometry(1.08, 0.16, 0.30),
    drivenMaterial,
  );
  cuttingToolBar.position.set(-0.83, 0, .45);
  cuttingToolBar.userData.role = 'short-cutting-tool-carried-by-output-slide';
  const cuttingToolTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.42, 4),
    darkMaterial,
  );
  cuttingToolTip.rotation.z = Math.PI / 2;
  cuttingToolTip.position.set(-1.53, 0, .45);
  cuttingToolTip.userData.role = 'left-facing-cutting-tool-tip';
  const outputPinAnchor = new THREE.Object3D();
  outputPinAnchor.position.z = connectingRodPlaneZ;
  outputPinAnchor.userData.role = 'horizontal-output-slide-pin-anchor';
  outputSlide.add(
    outputSlideBody,
    outputPin,
    outputPinOutline,
    outputSlideIndex,
    cuttingToolBar,
    cuttingToolTip,
    outputPinAnchor,
  );

  const outputStrokeWitness = new THREE.Mesh(
    new THREE.BoxGeometry(outputStroke, 0.025, 0.025),
    witnessMaterial,
  );
  outputStrokeWitness.position.set(
    fixedDiskCenter.x - connectingRodLength,
    outputGuideY,
    outputGuideCenterZ - 0.22,
  );
  outputStrokeWitness.userData.role =
    'exact-two-groove-radius-horizontal-output-stroke-witness';

  const motionMinimumX = Math.min(
    fixedDiskCenter.x - grooveCenterRadius - connectingRodLength - 1.78,
    shaftCenter.x - crankReach - crankBodyHalfWidth,
  );
  const motionMaximumX = Math.max(
    fixedDiskCenter.x + outerDiskRadius,
    shaftCenter.x + crankReach + crankBodyHalfWidth,
  );
  const motionMinimumY = Math.min(
    fixedDiskCenter.y - outerDiskRadius,
    shaftCenter.y - crankReach - crankBodyHalfWidth,
  );
  const motionMaximumY = Math.max(
    fixedDiskCenter.y + outerDiskRadius,
    shaftCenter.y + crankReach + crankBodyHalfWidth,
  );
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(
      motionMaximumX - motionMinimumX + 0.36,
      motionMaximumY - motionMinimumY + 0.36,
      2.20,
    ),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(
    (motionMinimumX + motionMaximumX) / 2,
    (motionMinimumY + motionMaximumY) / 2,
    0.12,
  );
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-of-complete-crank-and-output-slide-cycle';

  root.add(
    cameraEnvelope,
    outerPlate,
    innerPlate,
    outerDiskOutline,
    grooveOuterWall,
    grooveInnerWall,
    grooveCenterlineWitness,
    innerBossOuterOutline,
    innerBossInnerOutline,
    fixedDiskCenterAnchor,
    shaftCenterAnchor,
    fixedShaftBearing,
    ...outputGuideRails,
    ...outputGuideEndStops,
    outputGuideStartAnchor,
    outputGuideEndAnchor,
    outputStrokeWitness,
    inputCrank,
    sliderAssembly,
    connectingRod,
    outputSlide,
  );

  const stateAtInputAngle = (
    inputUnwrappedAngle,
    angularSpeed = inputAngularSpeed,
  ) => {
    const inputAngle = positiveModulo(inputUnwrappedAngle, fullTurn);
    const slotAxis = new THREE.Vector2(
      Math.cos(inputAngle),
      Math.sin(inputAngle),
    );
    const slotNormal = new THREE.Vector2(-slotAxis.y, slotAxis.x);
    const shaftOffsetFromDisk = shaftCenter.clone().sub(fixedDiskCenter);
    const offsetProjection = shaftOffsetFromDisk.dot(slotAxis);
    const offsetProjectionDerivative = shaftOffsetFromDisk.dot(slotNormal);
    const offsetProjectionSecondDerivative = -offsetProjection;
    const radialDiscriminant = grooveCenterRadius ** 2
      - shaftEccentricity ** 2
      + offsetProjection ** 2;
    const radialRoot = Math.sqrt(Math.max(0, radialDiscriminant));
    const radialRootDerivative = offsetProjection
      * offsetProjectionDerivative / radialRoot;
    const radialRootSecondDerivative = (
      offsetProjectionDerivative ** 2
      + offsetProjection * offsetProjectionSecondDerivative
    ) / radialRoot - (
      offsetProjection ** 2 * offsetProjectionDerivative ** 2
    ) / radialRoot ** 3;
    const variableCrankRadius = -offsetProjection + radialRoot;
    const variableCrankRadiusDerivative = -offsetProjectionDerivative
      + radialRootDerivative;
    const variableCrankRadiusSecondDerivative =
      -offsetProjectionSecondDerivative + radialRootSecondDerivative;
    const sliderPoint = shaftCenter.clone().addScaledVector(
      slotAxis,
      variableCrankRadius,
    );
    const sliderPointDerivative = slotAxis.clone()
      .multiplyScalar(variableCrankRadiusDerivative)
      .addScaledVector(slotNormal, variableCrankRadius);
    const sliderPointSecondDerivative = slotAxis.clone()
      .multiplyScalar(
        variableCrankRadiusSecondDerivative - variableCrankRadius,
      )
      .addScaledVector(slotNormal, 2 * variableCrankRadiusDerivative);
    const sliderVelocity = sliderPointDerivative.clone()
      .multiplyScalar(angularSpeed);
    const sliderAcceleration = sliderPointSecondDerivative.clone()
      .multiplyScalar(angularSpeed ** 2);
    const radialSlidingSpeed = variableCrankRadiusDerivative
      * angularSpeed;
    const radialSlidingAcceleration = variableCrankRadiusSecondDerivative
      * angularSpeed ** 2;

    const guideOffsetY = sliderPoint.y - outputGuideY;
    const rodHorizontalProjection = Math.sqrt(Math.max(
      0,
      connectingRodLength ** 2 - guideOffsetY ** 2,
    ));
    const outputX = sliderPoint.x - rodHorizontalProjection;
    const outputXDerivative = sliderPointDerivative.x
      + guideOffsetY * sliderPointDerivative.y / rodHorizontalProjection;
    const outputXSecondDerivative = sliderPointSecondDerivative.x
      + (
        sliderPointDerivative.y ** 2
        + guideOffsetY * sliderPointSecondDerivative.y
      ) / rodHorizontalProjection
      + guideOffsetY ** 2 * sliderPointDerivative.y ** 2
        / rodHorizontalProjection ** 3;
    const outputPoint = new THREE.Vector2(outputX, outputGuideY);
    const outputVelocity = new THREE.Vector2(
      outputXDerivative * angularSpeed,
      0,
    );
    const outputAcceleration = new THREE.Vector2(
      outputXSecondDerivative * angularSpeed ** 2,
      0,
    );
    const connectingRodVector = outputPoint.clone().sub(sliderPoint);
    const connectingRodVelocityDifference = outputVelocity.clone()
      .sub(sliderVelocity);
    const connectingRodAccelerationDifference = outputAcceleration.clone()
      .sub(sliderAcceleration);
    const connectingRodAngularSpeed = cross2(
      connectingRodVector,
      connectingRodVelocityDifference,
    ) / connectingRodLength ** 2;
    const connectingRodAngularAcceleration = cross2(
      connectingRodVector,
      connectingRodAccelerationDifference,
    ) / connectingRodLength ** 2;

    const grooveRadiusVector = sliderPoint.clone().sub(fixedDiskCenter);
    const grooveRadial = grooveRadiusVector.clone().normalize();
    const grooveTangent = new THREE.Vector2(-grooveRadial.y, grooveRadial.x);
    const grooveTangentialSpeed = sliderVelocity.dot(grooveTangent);
    const grooveNormalVelocityError = sliderVelocity.dot(grooveRadial);
    const grooveNormalAccelerationError = sliderAcceleration.dot(
      grooveRadial,
    ) + grooveTangentialSpeed ** 2 / grooveCenterRadius;
    const crankMaterialVelocityAtSlider = slotNormal.clone()
      .multiplyScalar(variableCrankRadius * angularSpeed);
    const sliderRelativeToCrankVelocity = sliderVelocity.clone()
      .sub(crankMaterialVelocityAtSlider);
    const crankSlotNormalVelocityError = sliderRelativeToCrankVelocity.dot(
      slotNormal,
    );
    const crankSlotCenterlineError = sliderPoint.clone().sub(shaftCenter)
      .dot(slotNormal);
    const grooveRadiusError = grooveRadiusVector.length()
      - grooveCenterRadius;
    const clockwiseCyclePhase = positiveModulo(
      (sourceInputAngle - inputUnwrappedAngle) / fullTurn,
      1,
    );
    const phaseTolerance = 1e-10;
    let stage;
    if (clockwiseCyclePhase < phaseTolerance
      || clockwiseCyclePhase > 1 - phaseTolerance) {
      stage = 'top-maximum-crank-radius-fastest-horizontal-slide-speed';
    } else if (Math.abs(clockwiseCyclePhase - 0.5) < phaseTolerance) {
      stage = 'bottom-minimum-crank-radius-diminished-horizontal-slide-speed';
    } else if (clockwiseCyclePhase < 0.5) {
      stage = 'descending-slide-shortens-variable-radius-crank';
    } else {
      stage = 'ascending-slide-lengthens-variable-radius-crank';
    }
    const outputDirection = outputVelocity.x > 1e-10
      ? 'rightward'
      : outputVelocity.x < -1e-10
        ? 'leftward'
        : 'stroke-reversal';
    return {
      clockwiseCyclePhase,
      connectingRodAccelerationDifference,
      connectingRodAngle: Math.atan2(
        connectingRodVector.y,
        connectingRodVector.x,
      ),
      connectingRodAngularAcceleration,
      connectingRodAngularSpeed,
      connectingRodLength: connectingRodVector.length(),
      connectingRodLengthAccelerationError:
        connectingRodVector.dot(connectingRodAccelerationDifference)
        + connectingRodVelocityDifference.lengthSq(),
      connectingRodLengthRateError: connectingRodVector.dot(
        connectingRodVelocityDifference,
      ),
      connectingRodVector,
      connectingRodVelocityDifference,
      crankMaterialVelocityAtSlider,
      crankSlotCenterlineError,
      crankSlotNormalVelocityError,
      crankSlotSurfaceClearance: crankSlotHalfWidth
        - radialSlotShoeRadius,
      grooveAngularCoordinate: Math.atan2(
        grooveRadiusVector.y,
        grooveRadiusVector.x,
      ),
      grooveAngularSpeed: grooveTangentialSpeed / grooveCenterRadius,
      grooveInnerSurfaceClearance:
        grooveCenterRadius - circularGrooveShoeRadius - grooveInnerRadius,
      grooveNormalAccelerationError,
      grooveNormalVelocityError,
      grooveOuterSurfaceClearance:
        grooveOuterRadius
        - (grooveCenterRadius + circularGrooveShoeRadius),
      grooveRadial,
      grooveRadiusError,
      grooveRadiusVector,
      grooveTangent,
      grooveTangentialSpeed,
      inputAngle,
      inputAngularAcceleration: 0,
      inputAngularSpeed: angularSpeed,
      inputClockwiseTurns: (
        sourceInputAngle - inputUnwrappedAngle
      ) / fullTurn,
      inputUnwrappedAngle,
      outputAcceleration,
      outputDirection,
      outputPoint,
      outputPosition: outputX,
      outputPositionDerivative: outputXDerivative,
      outputPositionSecondDerivative: outputXSecondDerivative,
      outputVelocity,
      radialDiscriminant,
      radialRoot,
      radialSlidingAcceleration,
      radialSlidingSpeed,
      sliderAcceleration,
      sliderPoint,
      sliderPointDerivative,
      sliderPointSecondDerivative,
      sliderRelativeToCrankVelocity,
      sliderVelocity,
      slotAxis,
      slotNormal,
      stage,
      variableCrankRadius,
      variableCrankRadiusDerivative,
      variableCrankRadiusSecondDerivative,
    };
  };

  const stateAtCyclePhase = (cyclePhase) => stateAtInputAngle(
    sourceInputAngle - Number(cyclePhase) * fullTurn,
  );
  const stateAtTime = (time) => stateAtInputAngle(
    sourceInputAngle + Math.max(0, Number(time) || 0) * inputAngularSpeed,
  );
  const guideAxisCrossingAngle = Math.atan2(
    shaftEccentricity,
    grooveCenterRadius,
  );
  const rightOutputExtremePhase = (
    sourceInputAngle - guideAxisCrossingAngle
  ) / fullTurn;
  const leftOutputExtremePhase = (
    sourceInputAngle + Math.PI + guideAxisCrossingAngle
  ) / fullTurn;
  const canonicalStates = {
    sourceTopMaximumRadius: stateAtCyclePhase(sourceAnimationSourceCycle),
    maximumRightOutput: stateAtCyclePhase(rightOutputExtremePhase),
    rightGrooveSide: stateAtCyclePhase(0.25),
    bottomMinimumRadius: stateAtCyclePhase(0.5),
    leftGrooveSide: stateAtCyclePhase(0.75),
    minimumLeftOutput: stateAtCyclePhase(leftOutputExtremePhase),
    nextSourceTopMaximumRadius: stateAtCyclePhase(1),
  };

  const geometry = {
    circularGrooveShoeRadius,
    connectingRodDepth,
    connectingRodLength,
    connectingRodPlaneZ,
    connectingRodThickness,
    crankBodyHalfWidth,
    crankDepth,
    crankFrontZ,
    crankHubDepth,
    crankHubRadius,
    crankPlaneZ,
    crankReach,
    crankSlotFarRadius,
    crankSlotHalfWidth,
    crankSlotNearRadius,
    crankSlotOutlineWidth,
    cyclePeriod,
    fixedDiskCenter: fixedDiskCenter.clone(),
    grooveCenterRadius,
    grooveHalfWidth,
    grooveInnerRadius,
    grooveOuterRadius,
    grooveShoeCenterZ,
    grooveShoeDepth,
    guideAxisCrossingAngle,
    idealTopBottomSpeedRatio,
    innerBossInnerRadius,
    innerBossOuterRadius,
    inputAngularSpeed,
    leftOutputExtremePhase,
    maximumCrankRadius,
    minimumCrankRadius,
    motionMaximumX,
    motionMaximumY,
    motionMinimumX,
    motionMinimumY,
    outerDiskRadius,
    outputGuideCenterZ,
    outputGuideDepth,
    outputGuideHalfGap,
    outputGuideMaximumX,
    outputGuideMinimumX,
    outputGuideRailThickness,
    outputGuideY,
    outputPinCenterZ,
    outputPinDepth,
    outputPinRadius,
    outputSlideCenterZ,
    outputSlideDepth,
    outputSlideHeight,
    outputSlideWidth,
    outputStroke,
    plateCenterZ,
    plateDepth,
    plateFrontZ,
    plateOutlineZ,
    radialShoeCenterZ,
    radialShoeDepth,
    radialSlotShoeRadius,
    rightOutputExtremePhase,
    shaftCenter: shaftCenter.clone(),
    shaftCenterZ,
    shaftEccentricity,
    shaftLength,
    shaftOpeningRadius,
    shaftRadius,
    sliderBlockCenterZ,
    sliderBlockDepth,
    sliderBlockLength,
    sliderBlockWidth,
    sliderFitClearance,
    sliderFrontBossCenterZ,
    sliderFrontBossDepth,
    sliderFrontBossRadius,
    sourceAnimationConnectingRodLength,
    sourceAnimationCrankBodyHalfWidth,
    sourceAnimationCrankReach,
    sourceAnimationCrankSlotHalfWidth,
    sourceAnimationGrooveCenterRadius,
    sourceAnimationGrooveInnerRadius,
    sourceAnimationGrooveOuterRadius,
    sourceAnimationInnerBossInnerRadius,
    sourceAnimationInnerBossOuterRadius,
    sourceAnimationInputTurnsPerCycle,
    sourceAnimationOuterDiskRadius,
    sourceAnimationOutputGuideEnd:
      sourceAnimationOutputGuideEnd.clone(),
    sourceAnimationOutputGuideStart:
      sourceAnimationOutputGuideStart.clone(),
    sourceAnimationShaftCenter: sourceAnimationShaftCenter.clone(),
    sourceAnimationSliderShoeRadius,
    sourceAnimationSourceCycle,
    sourceAnimationViewMinimum: sourceAnimationViewMinimum.clone(),
    sourceAnimationViewSize: sourceAnimationViewSize.clone(),
    sourceImageHeight,
    sourceImageWidth,
    sourceInputAngle,
    sourceRasterConnectingRodCropPoint:
      sourceRasterConnectingRodCropPoint.clone(),
    sourceRasterCrankBodyBottomY,
    sourceRasterCrankBodyLeftX,
    sourceRasterCrankBodyRightX,
    sourceRasterCrankBodyTopY,
    sourceRasterDiskCenter: sourceRasterDiskCenter.clone(),
    sourceRasterGrooveInnerRadius,
    sourceRasterGrooveOuterRadius,
    sourceRasterOuterDiskRadius,
    sourceRasterPixelsPerAnimationUnit,
    sourceRasterShaftCenter: sourceRasterShaftCenter.clone(),
    sourceRasterSliderCenter: sourceRasterSliderCenter.clone(),
    sourceScale,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    inputCrank.rotation.z = state.inputAngle;
    inputSliderAnchor.position.x = state.variableCrankRadius;
    sliderAssembly.position.set(
      state.sliderPoint.x,
      state.sliderPoint.y,
      0,
    );
    sliderAssembly.rotation.z = state.inputAngle;
    outputSlide.position.set(
      state.outputPoint.x,
      state.outputPoint.y,
      0,
    );
    outputSlide.rotation.set(0, 0, 0);
    connectingRod.userData.setEndpoints(
      new THREE.Vector3(
        state.sliderPoint.x,
        state.sliderPoint.y,
        connectingRodPlaneZ,
      ),
      new THREE.Vector3(
        state.outputPoint.x,
        state.outputPoint.y,
        connectingRodPlaneZ,
      ),
    );
    sliderAssembly.userData.velocity = state.sliderVelocity.clone();
    sliderAssembly.userData.acceleration = state.sliderAcceleration.clone();
    outputSlide.userData.velocity = state.outputVelocity.clone();
    outputSlide.userData.acceleration = state.outputAcceleration.clone();
    root.userData.contacts = {
      circularGroove: {
        centerlineRadiusError: state.grooveRadiusError,
        innerSurfaceClearance: state.grooveInnerSurfaceClearance,
        normalAccelerationError: state.grooveNormalAccelerationError,
        normalVelocityError: state.grooveNormalVelocityError,
        outerSurfaceClearance: state.grooveOuterSurfaceClearance,
        tangentialSlidingSpeed: state.grooveTangentialSpeed,
      },
      connectingRod: {
        lengthAccelerationError:
          state.connectingRodLengthAccelerationError,
        lengthError: state.connectingRodLength - connectingRodLength,
        lengthRateError: state.connectingRodLengthRateError,
      },
      horizontalOutputGuide: {
        rotationError: outputSlide.rotation.z,
        verticalAccelerationError: state.outputAcceleration.y,
        verticalPositionError: state.outputPoint.y - outputGuideY,
        verticalVelocityError: state.outputVelocity.y,
      },
      radialCrankSlot: {
        centerlineError: state.crankSlotCenterlineError,
        normalVelocityError: state.crankSlotNormalVelocityError,
        surfaceClearance: state.crankSlotSurfaceClearance,
        slidingSpeed: state.radialSlidingSpeed,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    'eccentric-fixed-circular-groove-variable-radius-slotted-crank-finite-rod-horizontal-shaper-slide';
  root.userData.blocks = {
    cameraEnvelope,
    circularGrooveShoe,
    connectingRod,
    connectingRodBeam,
    connectingRodOutputEye,
    connectingRodSliderEye,
    crankBody,
    crankHub,
    crankHubOutline,
    crankSlotFarAnchor,
    crankSlotNearAnchor,
    crankSlotOutline,
    cuttingToolBar,
    cuttingToolTip,
    fixedDiskCenterAnchor,
    fixedShaftBearing,
    grooveCenterlineWitness,
    grooveInnerWall,
    grooveOuterWall,
    innerBossInnerOutline,
    innerBossOuterOutline,
    innerPlate,
    inputCrank,
    inputRotationIndex,
    inputShaft,
    inputSliderAnchor,
    outerDiskOutline,
    outerPlate,
    outputGuideEndAnchor,
    outputGuideEndStops,
    outputGuideRails,
    outputGuideStartAnchor,
    outputPin,
    outputPinAnchor,
    outputPinOutline,
    outputSlide,
    outputSlideBody,
    outputSlideIndex,
    outputStrokeWitness,
    radialSlotShoe,
    shaftCenterAnchor,
    sliderAssembly,
    sliderBlock,
    sliderCenterAnchor,
    sliderFrontBoss,
    sliderFrontOutline,
    sliderRotationIndex,
  };
  root.userData.cameraDistanceScale = 0.98;
  root.userData.canonicalStates = canonicalStates;
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.mechanism =
    'clockwise-eccentric-circular-groove-variable-radius-slotted-crank-finite-rod-horizontal-shaper-slide';
  root.userData.animationPointToModel = animationPointToModel;
  root.userData.modelPointToAnimation = modelPointToAnimation;
  root.userData.modelPointToSourceRaster = modelPointToSourceRaster;
  root.userData.sourceRasterPointToModel = sourceRasterPointToModel;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;

  // Pin shoulders span the entire bored eye; heads retain the rod axially.
  for (const [parent, name] of [[sliderAssembly, 'wristRetainer'], [outputSlide, 'outputRetainer']]) {
    const head = cylinderAlongZ(.34, .06, darkMaterial, 96);
    head.position.z = .94;
    head.userData.role = name;
    parent.add(head);
    root.userData.blocks[name] = head;
  }
  // Decorative round wires entered the actual slide paths. The finite plate
  // and crank slot edges already provide their physical contact boundaries.
  // Brown's ink edges on the disk rim and hub are not separate parts either.
  // The detached rings stay in blocks as source-registration landmarks only.
  for (const decoration of [grooveInnerWall, grooveOuterWall,
    grooveCenterlineWitness, crankSlotOutline, sliderFrontOutline,
    sliderRotationIndex, outputPinOutline, outputSlideIndex,
    outerDiskOutline, crankHubOutline]) {
    decoration.removeFromParent();
    decoration.geometry.dispose();
  }
  for (const disk of [outerPlate, innerPlate]) {
    disk.material.transparent = false;
    disk.material.opacity = 1;
    disk.material.depthWrite = true;
  }
  Object.assign(root.userData, {hideGround:true, supportsRestart:true,
    minimumDisplayCycleSeconds:4, animationTiming:{authoredCyclePeriod:cyclePeriod},
    reconstructionStatus:'under-review',
    reconstructionNote:'A slide follows the eccentric circular groove while moving along the rotating crank. The remote tool guide and full connecting rod follow the 2D reference; bearing depths and guide hardware are inferred. Assembly clearance and engraving proportions remain under review.'});
  if (!reference) {
    // Recess the track into a single backed disk. The unseen rear web joins
    // the inner and outer lands without crossing the circular shoe's path.
    // Its rear face stands 2 cm behind the lands' coplanar back faces, and
    // its rim and bore sit 1 cm inside theirs, so no faces z-fight.
    const backing = new THREE.Mesh(centeredExtrusion(
      diskWithOffsetHoleShape(outerDiskRadius - .01, shaftOffset, shaftOpeningRadius + .01), .12, 0),
      matte(PALETTE.ink));
    backing.position.set(fixedDiskCenter.x, fixedDiskCenter.y, -.62);
    backing.userData.role = 'integral-rear-web-of-fixed-guide';
    root.add(backing);root.userData.blocks.guideBacking = backing;
    // Pass 93: Brown draws no mounting for the fixed guide disk; the undrawn
    // square rear flange that showed from behind is gone (as 125, no supports).
    // Brown's inner circles on the fixed disk are ink edges, not raised rings.
    for (const outline of [innerBossOuterOutline, innerBossInnerOutline]) {
      outline.removeFromParent();
      outline.geometry.dispose();
    }
    // Brown draws only the connecting rod, broken off at raster (37.5,157.5)
    // left of its eye at (295,77). The break is drawing notation: the rod is
    // whole, running on to its eye on the tool slide, which moves between its
    // guide rails and end stops beyond the drawing. The default view frames
    // the drawn part only.
    for (const object of [outputStrokeWitness, inputRotationIndex]) {
      object.removeFromParent();
      object.geometry.dispose();
    }
    const drawnRodLength = sourceRasterPointToModel(new THREE.Vector2(295, 77))
      .distanceTo(sourceRasterPointToModel(new THREE.Vector2(37.5, 157.5)));
    const rodStart = -0.5 + .32 / connectingRodLength;
    const rodEnd = -0.5 + drawnRodLength / connectingRodLength;
    const drawnRod = new THREE.Mesh(new THREE.BoxGeometry(rodEnd - rodStart,
      connectingRodThickness, connectingRodDepth).translate((rodStart + rodEnd) / 2, 0, 0));
    connectingRodBeam.add(drawnRod);
    const beyondDrawing = new Set([connectingRodBeam, connectingRodOutputEye, outputSlide, ...outputGuideRails, ...outputGuideEndStops]);
    root.userData.geometry.drawnConnectingRodLength = drawnRodLength;
    root.remove(cameraEnvelope);
    cameraEnvelope.geometry.dispose();
    cameraEnvelope.material.dispose();
    const bounds = new THREE.Box3();
    for (let i = 0; i <= 180; i++) {
      update(cyclePeriod*i/180);root.updateMatrixWorld(true);
      root.traverse((object) => {
        if (!object.isMesh || object === drawnRod) return;
        for (let parent = object; parent; parent = parent.parent) if (beyondDrawing.has(parent)) return;
        bounds.union(new THREE.Box3().setFromObject(object, true));
      });
      bounds.union(new THREE.Box3().setFromObject(drawnRod, true));
    }
    drawnRod.removeFromParent();
    drawnRod.geometry.dispose();
    // Pass 93: the tool slide and its pin are not shown, so the rod's far
    // eye hung empty in rotated views. The rod ends plainly instead.
    connectingRodOutputEye.removeFromParent();
    connectingRodOutputEye.geometry.dispose();
    root.userData.cameraFitBounds = bounds.expandByScalar(.08);
    root.userData.cameraFov = 8;
    root.userData.sourceFit = 'engraving';
    root.userData.reconstructionStatus = 'reconstructed';
    root.userData.reconstructionNote = 'The eccentric circular guide varies the crank reach. Dimensions follow the engraving; the connecting rod runs whole past the plate break to the tool slide in its guide, both inferred off the drawing from the visible rod direction. Pins, guide fits and steady input speed are ideal constraints.';
  }
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
    grooveCenterlineWitness,
    outputStrokeWitness,
    cameraEnvelope,
    outerPlate,
    innerPlate,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: reference ? new THREE.Vector3(5.2, 4.0, 16.0) : new THREE.Vector3(0, 0, 1),
    root,
    update,
    reset: () => update(0),
  };
}

export function createAuthoredVariableCrankMovement(movement, options = {}) {
  switch (movement.id) {
    case 168: return variableRadiusEllipticalCrankDrive();
    case 169: return linkedEllipticalPinMainCrankDrive();
    case 178: return eccentricCircularGuideVariableSpeedShaper(options);
    default: return null;
  }
}
