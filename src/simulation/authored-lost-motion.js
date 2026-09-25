import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
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

function horizontalCapsuleRingShape(
  innerRadius,
  outerRadius,
  straightHalfLength,
) {
  const shape = new THREE.Shape();
  shape.moveTo(-straightHalfLength, -outerRadius);
  shape.lineTo(straightHalfLength, -outerRadius);
  shape.absarc(
    straightHalfLength,
    0,
    outerRadius,
    -Math.PI / 2,
    Math.PI / 2,
    false,
  );
  shape.lineTo(-straightHalfLength, outerRadius);
  shape.absarc(
    -straightHalfLength,
    0,
    outerRadius,
    Math.PI / 2,
    Math.PI * 1.5,
    false,
  );
  shape.closePath();

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

function taperedPitmanShape({
  headConnectionX,
  outputHalfHeight,
  headHalfHeight,
}) {
  const shape = new THREE.Shape();
  shape.moveTo(0, outputHalfHeight);
  shape.lineTo(headConnectionX, headHalfHeight);
  shape.lineTo(headConnectionX, -headHalfHeight);
  shape.lineTo(0, -outputHalfHeight);
  shape.closePath();
  return shape;
}

function lostMotionBrickPress() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // The site's original animation exposes Brown's source construction in
  // drawing units. In particular, the loose pin travels between end centers
  // 25 and 28 units from the output pin. This three-unit clearance removes
  // three units from the 11-unit crank diameter and creates the two dwells.
  const sourceAnimationDiskInnerRadius = 10;
  const sourceAnimationDiskOuterRadius = 10.75;
  const sourceAnimationHubRadius = 2;
  const sourceAnimationCrankRadius = 5.5;
  const sourceAnimationCrankPinRadius = 1;
  const sourceAnimationSlotInnerEndDistance = 25;
  const sourceAnimationSlotOuterEndDistance = 28;
  const sourceAnimationSlotInnerRadius = 1;
  const sourceAnimationSlotOuterRadius = 2;
  const sourceAnimationOutputEyeRadius = 1;
  const sourceAnimationOutputPinRadius = 0.5;
  const sourceAnimationSlideHalfWidth = 3;
  const sourceAnimationSlideHalfHeight = 1.25;
  const sourceAnimationGuideStartX = 18.5;
  const sourceAnimationGuideEndX = 34.5;
  const sourceAnimationViewBox = Object.freeze({
    height: 46,
    width: 46,
    x: -11.125,
    y: -23,
  });
  const sourceAnimationOuterEngagementCycle = 0.16183;
  const sourceAnimationInnerEngagementCycle = 0.6918;
  const sourceAnimationPoseCycle = 0.4;

  // Approximate locks from the 525 px engraving. Brown's hand-drawn crank
  // pin is slightly displaced from the exact dimensions used by the site's
  // later animation, so the executable construction above remains primary.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterDiskCenter = new THREE.Vector2(228, 274);
  const sourceRasterCrankPinCenter = new THREE.Vector2(141, 221);
  const sourceRasterDiskLeftX = 27;
  const sourceRasterDiskRightX = 433;
  const sourceRasterDiskTopY = 72;
  const sourceRasterDiskBottomY = 478;
  const sourceRasterDiskRadius = (
    sourceRasterDiskRightX - sourceRasterDiskLeftX
      + sourceRasterDiskBottomY - sourceRasterDiskTopY
  ) / 4;

  const sourceScale = 0.25;
  const diskInnerRadius = sourceAnimationDiskInnerRadius * sourceScale;
  const diskOuterRadius = sourceAnimationDiskOuterRadius * sourceScale;
  const hubRadius = sourceAnimationHubRadius * sourceScale;
  const crankRadius = sourceAnimationCrankRadius * sourceScale;
  const crankPinRadius = sourceAnimationCrankPinRadius * sourceScale;
  const slotInnerEndDistance = sourceAnimationSlotInnerEndDistance
    * sourceScale;
  const slotOuterEndDistance = sourceAnimationSlotOuterEndDistance
    * sourceScale;
  const slotFreeTravel = slotOuterEndDistance - slotInnerEndDistance;
  const slotInnerRadius = sourceAnimationSlotInnerRadius * sourceScale;
  const slotOuterRadius = sourceAnimationSlotOuterRadius * sourceScale;
  const slotCenterDistance = (
    slotInnerEndDistance + slotOuterEndDistance
  ) / 2;
  const slotStraightHalfLength = slotFreeTravel / 2;
  const outputEyeRadius = sourceAnimationOutputEyeRadius * sourceScale;
  const outputPinRadius = sourceAnimationOutputPinRadius * sourceScale;
  const slideHalfWidth = sourceAnimationSlideHalfWidth * sourceScale;
  const slideHalfHeight = sourceAnimationSlideHalfHeight * sourceScale;
  const guideStartX = sourceAnimationGuideStartX * sourceScale;
  const guideEndX = sourceAnimationGuideEndX * sourceScale;
  const rightDwellX = crankRadius + slotInnerEndDistance;
  const leftDwellX = slotOuterEndDistance - crankRadius;
  const outputStroke = rightDwellX - leftDwellX;
  const outerEngagementAngle = Math.acos(
    (
      rightDwellX ** 2 + crankRadius ** 2
        - slotOuterEndDistance ** 2
    ) / (2 * rightDwellX * crankRadius),
  );
  const innerEngagementAngle = fullTurn - Math.acos(
    (
      leftDwellX ** 2 + crankRadius ** 2
        - slotInnerEndDistance ** 2
    ) / (2 * leftDwellX * crankRadius),
  );
  const rightDwellAngle = outerEngagementAngle;
  const leftDwellAngle = innerEngagementAngle - Math.PI;
  const dwellFraction = (rightDwellAngle + leftDwellAngle) / fullTurn;
  const sourcePoseAngle = sourceAnimationPoseCycle * fullTurn;
  const inputAngularSpeed = 0.62;
  const cyclePeriod = fullTurn / inputAngularSpeed;

  const driverCenter = new THREE.Vector3(0, 1.38, 0);
  const framePlaneZ = -0.62;
  const diskDepth = 0.44;
  const rodPlaneZ = 0.72;
  const rodDepth = 0.32;
  const slideDepth = 0.68;
  const crankPinLength = 1.78;
  const crankPinCenterZ = 0.42;
  const outputPinLength = 1.12;
  const guideClearance = 0.07;
  const guideRailThickness = 0.16;
  const guideRailDepth = 1.16;
  const guideRailCenterOffset = slideHalfHeight + guideClearance
    + guideRailThickness / 2;
  const baseY = driverCenter.y - diskOuterRadius - 0.42;

  const positiveModulo = (value, modulus) => {
    const remainder = value % modulus;
    if (remainder === 0) return 0;
    return remainder < 0 ? remainder + modulus : remainder;
  };

  const sliderLawAtDriverAngle = (driverAngle) => {
    const normalizedDriverAngle = positiveModulo(driverAngle, fullTurn);
    const sine = Math.sin(normalizedDriverAngle);
    const cosine = Math.cos(normalizedDriverAngle);
    const crankX = crankRadius * cosine;
    const crankY = crankRadius * sine;
    let activeSlotEnd = 'none';
    let contactDistance = null;
    let outputDwell = true;
    let slideX = rightDwellX;
    let slideFirstDerivativeByDriver = 0;
    let slideSecondDerivativeByDriver = 0;
    let stage = 'right-end-dwell-pin-traverses-slot';

    if (
      normalizedDriverAngle >= outerEngagementAngle
      && normalizedDriverAngle < Math.PI
    ) {
      activeSlotEnd = 'outer';
      contactDistance = slotOuterEndDistance;
      outputDwell = false;
      stage = 'outer-slot-end-retracts-slide';
    } else if (
      normalizedDriverAngle >= Math.PI
      && normalizedDriverAngle < innerEngagementAngle
    ) {
      slideX = leftDwellX;
      stage = 'left-end-dwell-pin-traverses-slot';
    } else if (normalizedDriverAngle >= innerEngagementAngle) {
      activeSlotEnd = 'inner';
      contactDistance = slotInnerEndDistance;
      outputDwell = false;
      stage = 'inner-slot-end-advances-slide';
    }

    if (contactDistance !== null) {
      const rootTerm = Math.sqrt(
        contactDistance ** 2 - crankY ** 2,
      );
      const product = crankRadius ** 2 * sine * cosine;
      const productDerivative = crankRadius ** 2
        * (cosine ** 2 - sine ** 2);
      slideX = crankX + rootTerm;
      slideFirstDerivativeByDriver = -crankRadius * sine
        - product / rootTerm;
      slideSecondDerivativeByDriver = -crankRadius * cosine
        - productDerivative / rootTerm
        - product ** 2 / rootTerm ** 3;
    }

    return {
      activeSlotEnd,
      contactDistance,
      crankX,
      crankY,
      normalizedDriverAngle,
      outputDwell,
      slideFirstDerivativeByDriver,
      slideSecondDerivativeByDriver,
      slideX,
      stage,
    };
  };

  const configurationAtDriverAngle = (driverAngle) => {
    const sliderLaw = sliderLawAtDriverAngle(driverAngle);
    const {
      crankX,
      crankY,
      slideFirstDerivativeByDriver,
      slideSecondDerivativeByDriver,
      slideX,
    } = sliderLaw;
    const crankPinPosition = new THREE.Vector3(
      driverCenter.x + crankX,
      driverCenter.y + crankY,
      crankPinCenterZ,
    );
    const slidePosition = new THREE.Vector3(
      driverCenter.x + slideX,
      driverCenter.y,
      rodPlaneZ,
    );
    const horizontalFromSlide = crankX - slideX;
    const horizontalTowardSlide = -horizontalFromSlide;
    const slotDistance = Math.hypot(horizontalFromSlide, crankY);
    const rodAngle = -Math.atan2(crankY, horizontalTowardSlide);
    const rodAxis = new THREE.Vector3(
      Math.cos(rodAngle),
      Math.sin(rodAngle),
      0,
    );
    const rodNormal = new THREE.Vector3(-rodAxis.y, rodAxis.x, 0);
    const slotInnerEndCenter = slidePosition.clone().addScaledVector(
      rodAxis,
      -slotInnerEndDistance,
    );
    const slotOuterEndCenter = slidePosition.clone().addScaledVector(
      rodAxis,
      -slotOuterEndDistance,
    );
    const slotCenter = slidePosition.clone().addScaledVector(
      rodAxis,
      -slotCenterDistance,
    );
    const relativePinVector = crankPinPosition.clone().sub(slidePosition);
    relativePinVector.z = 0;
    const slotCenterlineError = relativePinVector.dot(rodNormal);
    const relativeSlotCoordinate = relativePinVector.dot(rodAxis);
    const freeTravelFromInnerEnd = slotDistance - slotInnerEndDistance;
    const freeTravelToOuterEnd = slotOuterEndDistance - slotDistance;
    const slotTravelFraction = freeTravelFromInnerEnd / slotFreeTravel;

    const crankXFirstDerivative = -crankRadius
      * Math.sin(sliderLaw.normalizedDriverAngle);
    const crankYFirstDerivative = crankRadius
      * Math.cos(sliderLaw.normalizedDriverAngle);
    const crankXSecondDerivative = -crankRadius
      * Math.cos(sliderLaw.normalizedDriverAngle);
    const crankYSecondDerivative = -crankRadius
      * Math.sin(sliderLaw.normalizedDriverAngle);
    const horizontalFirstDerivative = crankXFirstDerivative
      - slideFirstDerivativeByDriver;
    const horizontalSecondDerivative = crankXSecondDerivative
      - slideSecondDerivativeByDriver;
    const distanceSquared = slotDistance ** 2;
    const angleNumerator = horizontalFromSlide * crankYFirstDerivative
      - crankY * horizontalFirstDerivative;
    const angleNumeratorDerivative = horizontalFromSlide
        * crankYSecondDerivative
      - crankY * horizontalSecondDerivative;
    const distanceSquaredDerivative = 2 * (
      horizontalFromSlide * horizontalFirstDerivative
        + crankY * crankYFirstDerivative
    );
    const rodFirstDerivativeByDriver = angleNumerator / distanceSquared;
    const rodSecondDerivativeByDriver = (
      angleNumeratorDerivative * distanceSquared
        - angleNumerator * distanceSquaredDerivative
    ) / distanceSquared ** 2;
    const distanceFirstDerivativeByDriver = distanceSquaredDerivative
      / (2 * slotDistance);
    const distanceSquaredSecondDerivative = 2 * (
      horizontalFirstDerivative ** 2
        + horizontalFromSlide * horizontalSecondDerivative
        + crankYFirstDerivative ** 2
        + crankY * crankYSecondDerivative
    );
    const distanceSecondDerivativeByDriver =
      distanceSquaredSecondDerivative / (2 * slotDistance)
      - distanceSquaredDerivative ** 2 / (4 * slotDistance ** 3);

    return {
      ...sliderLaw,
      crankPinPosition,
      crankXFirstDerivative,
      crankXSecondDerivative,
      crankYFirstDerivative,
      crankYSecondDerivative,
      distanceFirstDerivativeByDriver,
      distanceSecondDerivativeByDriver,
      freeTravelFromInnerEnd,
      freeTravelToOuterEnd,
      relativePinVector,
      relativeSlotCoordinate,
      rodAngle,
      rodAxis,
      rodFirstDerivativeByDriver,
      rodNormal,
      rodSecondDerivativeByDriver,
      slidePosition,
      slotCenter,
      slotCenterlineError,
      slotDistance,
      slotInnerEndCenter,
      slotOuterEndCenter,
      slotTravelFraction,
    };
  };

  const stateAtDriverMotion = (
    driverAngle,
    driverAngularSpeed = inputAngularSpeed,
    driverAngularAcceleration = 0,
  ) => {
    const configuration = configurationAtDriverAngle(driverAngle);
    const crankPinVelocity = new THREE.Vector3(
      configuration.crankXFirstDerivative * driverAngularSpeed,
      configuration.crankYFirstDerivative * driverAngularSpeed,
      0,
    );
    const crankPinAcceleration = new THREE.Vector3(
      configuration.crankXSecondDerivative * driverAngularSpeed ** 2
        + configuration.crankXFirstDerivative * driverAngularAcceleration,
      configuration.crankYSecondDerivative * driverAngularSpeed ** 2
        + configuration.crankYFirstDerivative * driverAngularAcceleration,
      0,
    );
    const outputVelocity = new THREE.Vector3(
      configuration.slideFirstDerivativeByDriver * driverAngularSpeed,
      0,
      0,
    );
    const outputAcceleration = new THREE.Vector3(
      configuration.slideSecondDerivativeByDriver
          * driverAngularSpeed ** 2
        + configuration.slideFirstDerivativeByDriver
          * driverAngularAcceleration,
      0,
      0,
    );
    const rodAngularSpeed = configuration.rodFirstDerivativeByDriver
      * driverAngularSpeed;
    const rodAngularAcceleration = configuration.rodSecondDerivativeByDriver
        * driverAngularSpeed ** 2
      + configuration.rodFirstDerivativeByDriver
        * driverAngularAcceleration;
    const relativeSlidingSpeed = -configuration
      .distanceFirstDerivativeByDriver * driverAngularSpeed;
    const relativeSlidingAcceleration = -(
      configuration.distanceSecondDerivativeByDriver
        * driverAngularSpeed ** 2
      + configuration.distanceFirstDerivativeByDriver
        * driverAngularAcceleration
    );
    const activeEndCenter = configuration.activeSlotEnd === 'outer'
      ? configuration.slotOuterEndCenter
      : configuration.activeSlotEnd === 'inner'
        ? configuration.slotInnerEndCenter
        : null;
    let activeEndVelocity = null;
    let activeEndAcceleration = null;
    let contactPositionError = null;
    let contactVelocityError = null;
    let contactAccelerationError = null;
    if (activeEndCenter) {
      const endRadiusVector = activeEndCenter.clone().sub(
        configuration.slidePosition,
      );
      activeEndVelocity = outputVelocity.clone().add(new THREE.Vector3(
        -endRadiusVector.y * rodAngularSpeed,
        endRadiusVector.x * rodAngularSpeed,
        0,
      ));
      activeEndAcceleration = outputAcceleration.clone().add(
        new THREE.Vector3(
          -endRadiusVector.y * rodAngularAcceleration
            - endRadiusVector.x * rodAngularSpeed ** 2,
          endRadiusVector.x * rodAngularAcceleration
            - endRadiusVector.y * rodAngularSpeed ** 2,
          0,
        ),
      );
      const planarCrankPin = configuration.crankPinPosition.clone();
      planarCrankPin.z = rodPlaneZ;
      contactPositionError = planarCrankPin.distanceTo(activeEndCenter);
      contactVelocityError = crankPinVelocity.clone()
        .sub(activeEndVelocity).length();
      contactAccelerationError = crankPinAcceleration.clone()
        .sub(activeEndAcceleration).length();
    }

    return {
      ...configuration,
      activeEndAcceleration,
      activeEndCenter,
      activeEndVelocity,
      contactAccelerationError,
      contactPositionError,
      contactVelocityError,
      crankPinAcceleration,
      crankPinVelocity,
      driverAngle,
      driverAngularAcceleration,
      driverAngularSpeed,
      engaged: configuration.activeSlotEnd !== 'none',
      inputRevolutions: driverAngle / fullTurn,
      lostMotion: configuration.outputDwell,
      outputAcceleration,
      outputDisplacement: configuration.slideX - leftDwellX,
      outputVelocity,
      relativeSlidingAcceleration,
      relativeSlidingSpeed,
      rodAngularAcceleration,
      rodAngularSpeed,
    };
  };

  const stateAtDriverAngle = (driverAngle) => stateAtDriverMotion(
    driverAngle,
    inputAngularSpeed,
    0,
  );
  const stateAtTime = (time) => stateAtDriverAngle(
    sourcePoseAngle + inputAngularSpeed * time,
  );
  const timeAfterSourcePoseForAngle = (angle) => positiveModulo(
    angle - sourcePoseAngle,
    fullTurn,
  ) / inputAngularSpeed;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.1,
    roughness: 0.68,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.09,
    roughness: 0.68,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.72,
  });
  const witnessMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const input = new THREE.Group();
  const inputRotor = new THREE.Group();
  input.add(inputRotor);
  input.position.copy(driverCenter);
  input.userData.axis = Z_AXIS.clone();
  input.userData.role = 'single-disk-carrying-one-offset-crank-pin';
  input.userData.rotor = inputRotor;
  inputRotor.userData.role = 'rigid-disk-crank-arm-pin-assembly';

  const diskBody = cylinderAlongZ(
    diskInnerRadius,
    diskDepth,
    driverMaterial,
    72,
  );
  diskBody.userData.role = 'source-ten-unit-radius-driver-disk-face';
  const diskOuterRim = new THREE.Mesh(
    new THREE.TorusGeometry(diskOuterRadius, 0.085, 12, 96),
    darkMaterial,
  );
  diskOuterRim.userData.role = 'source-ten-and-three-quarter-unit-outer-rim';
  diskOuterRim.visible = false; // ink edge/path only: kept for references, not drawn
  diskOuterRim.userData.retiredInkOutline = true;
  const diskInnerRim = new THREE.Mesh(
    new THREE.TorusGeometry(diskInnerRadius, 0.045, 10, 88),
    darkMaterial,
  );
  diskInnerRim.position.z = diskDepth / 2 + 0.025;
  diskInnerRim.userData.role = 'engraved-inner-circle-of-driver-disk';
  diskInnerRim.visible = false; // ink edge/path only: kept for references, not drawn
  diskInnerRim.userData.retiredInkOutline = true;
  const crankOrbit = new THREE.Mesh(
    new THREE.TorusGeometry(crankRadius, 0.028, 8, 72),
    matte(PALETTE.ink, { opacity: 0.32, transparent: true }),
  );
  crankOrbit.position.z = diskDepth / 2 + 0.045;
  crankOrbit.userData.role = 'subdued-true-circular-orbit-of-crank-pin';
  crankOrbit.visible = false; // ink edge/path only: kept for references, not drawn
  crankOrbit.userData.retiredInkOutline = true;
  const driverHub = cylinderAlongZ(hubRadius, 0.78, darkMaterial, 40);
  driverHub.position.z = 0.02;
  driverHub.userData.role = 'central-driver-shaft-hub';
  const crankArm = makeBeam(
    new THREE.Vector3(0, 0, diskDepth / 2 + 0.07),
    new THREE.Vector3(crankRadius, 0, diskDepth / 2 + 0.07),
    {
      color: PALETTE.ink,
      depth: 0.16,
      jointRadius: 0.18,
      width: 0.17,
    },
  );
  crankArm.userData.role = 'rigid-five-and-one-half-unit-crank-arm';
  const crankPin = new THREE.Group();
  crankPin.position.set(crankRadius, 0, crankPinCenterZ);
  crankPin.userData.role = 'loose-crank-pin-traversing-the-pitman-slot';
  const crankPinBody = cylinderAlongZ(
    crankPinRadius,
    crankPinLength,
    darkMaterial,
    36,
  );
  const crankPinFace = cylinderAlongZ(
    crankPinRadius * 0.68,
    0.035,
    witnessMaterial,
    32,
  );
  crankPinFace.position.z = crankPinLength / 2 + 0.018;
  crankPinFace.userData.role = 'white-crank-pin-face-showing-pin-orbit';
  crankPin.add(crankPinBody, crankPinFace);
  const diskRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(diskOuterRadius * 0.62, 0.09, 0.035),
    witnessMaterial,
  );
  diskRotationIndex.position.set(
    diskOuterRadius * 0.62,
    0,
    diskDepth / 2 + 0.08,
  );
  diskRotationIndex.userData.role = 'white-radial-index-showing-driver-spin';
  inputRotor.add(
    diskBody,
    diskOuterRim,
    diskInnerRim,
    crankOrbit,
    driverHub,
    crankArm,
    crankPin,
    diskRotationIndex,
  );

  const rodAssembly = new THREE.Group();
  rodAssembly.position.set(
    driverCenter.x + rightDwellX,
    driverCenter.y,
    rodPlaneZ,
  );
  rodAssembly.userData.axis = Z_AXIS.clone();
  rodAssembly.userData.role =
    'one-rigid-slotted-connecting-rod-pinned-to-output-slide';
  const rodHeadConnectionX = -slotCenterDistance
    + slotStraightHalfLength + slotOuterRadius * 0.94;
  const rodBeam = new THREE.Mesh(
    centeredExtrusion(taperedPitmanShape({
      headConnectionX: rodHeadConnectionX,
      headHalfHeight: slotOuterRadius * 0.68,
      outputHalfHeight: 0.19,
    }), rodDepth, 0.018),
    drivenMaterial,
  );
  rodBeam.userData.role = 'source-tapered-pitman-body';
  const slotOutline = new THREE.Mesh(
    centeredExtrusion(horizontalCapsuleRingShape(
      slotInnerRadius,
      slotOuterRadius + 0.055,
      slotStraightHalfLength,
    ), rodDepth + 0.07, 0.014),
    darkMaterial,
  );
  slotOutline.position.x = -slotCenterDistance;
  slotOutline.userData.role = 'dark-outline-of-three-unit-lost-motion-slot';
  slotOutline.visible = false; // ink edge/path only: kept for references, not drawn
  slotOutline.userData.retiredInkOutline = true;
  const slotFrame = new THREE.Mesh(
    centeredExtrusion(horizontalCapsuleRingShape(
      slotInnerRadius,
      slotOuterRadius,
      slotStraightHalfLength,
    ), rodDepth + 0.10, 0.014),
    drivenMaterial,
  );
  slotFrame.position.set(-slotCenterDistance, 0, 0.045);
  slotFrame.userData.role =
    'single-three-unit-capsule-slot-with-two-rounded-contact-ends';
  const outputEye = new THREE.Mesh(
    new THREE.TorusGeometry(outputEyeRadius, 0.075, 10, 40),
    darkMaterial,
  );
  outputEye.position.z = rodDepth / 2 + 0.045;
  outputEye.userData.role = 'pitman-eye-pinned-to-translating-slide';
  outputEye.visible = false; // ink edge/path only: kept for references, not drawn
  outputEye.userData.retiredInkOutline = true;
  rodAssembly.add(rodBeam, slotOutline, slotFrame, outputEye);

  const outputSlide = new THREE.Group();
  outputSlide.position.set(
    driverCenter.x + rightDwellX,
    driverCenter.y,
    rodPlaneZ,
  );
  outputSlide.userData.role =
    'horizontally-guided-brick-mold-output-crosshead';
  outputSlide.userData.translationAxis = X_AXIS.clone();
  const slideBody = new THREE.Mesh(
    new THREE.BoxGeometry(
      slideHalfWidth * 2,
      slideHalfHeight * 2,
      slideDepth,
    ),
    accentMaterial,
  );
  slideBody.userData.role = 'source-animation-slide-added-to-show-dwell';
  const slideTopEdge = new THREE.Mesh(
    new THREE.BoxGeometry(
      slideHalfWidth * 2.04,
      0.055,
      slideDepth * 1.02,
    ),
    darkMaterial,
  );
  slideTopEdge.position.y = slideHalfHeight;
  const slideBottomEdge = slideTopEdge.clone();
  slideBottomEdge.position.y = -slideHalfHeight;
  const outputPin = cylinderAlongZ(
    outputPinRadius,
    outputPinLength,
    darkMaterial,
    30,
  );
  outputPin.userData.role = 'journal-between-pitman-eye-and-output-slide';
  const outputPinFace = cylinderAlongZ(
    outputPinRadius * 0.68,
    0.035,
    witnessMaterial,
    28,
  );
  outputPinFace.position.z = outputPinLength / 2 + 0.018;
  outputPinFace.userData.role = 'white-index-on-translating-output-pin';
  const outputIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, slideHalfHeight * 1.22, 0.035),
    witnessMaterial,
  );
  outputIndex.position.set(
    slideHalfWidth * 0.55,
    0,
    slideDepth / 2 + 0.025,
  );
  outputIndex.userData.role = 'white-crosshead-index-making-both-dwells-visible';
  outputSlide.add(
    slideBody,
    slideTopEdge,
    slideBottomEdge,
    outputPin,
    outputPinFace,
    outputIndex,
  );

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-shaft-bearing-and-horizontal-slide-guides';
  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(12.35, 0.22, 1.38),
    frameMaterial,
  );
  baseRail.position.set(2.7, baseY, framePlaneZ);
  baseRail.userData.role = 'single-ground-base-under-disk-and-output-guide';
  const rearColumnHeight = driverCenter.y - baseY;
  const rearColumn = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, rearColumnHeight, 0.52),
    frameMaterial,
  );
  rearColumn.position.set(
    driverCenter.x,
    baseY + rearColumnHeight / 2,
    framePlaneZ,
  );
  rearColumn.userData.role = 'rear-standard-supporting-driver-shaft';
  const driverShaft = cylinderAlongZ(0.16, 2.12, darkMaterial, 30);
  driverShaft.position.set(driverCenter.x, driverCenter.y, -0.02);
  driverShaft.userData.role = 'fixed-axis-through-driver-disk';
  const rearBearing = new THREE.Mesh(
    new THREE.TorusGeometry(hubRadius * 0.68, 0.10, 10, 36),
    frameMaterial,
  );
  rearBearing.position.set(driverCenter.x, driverCenter.y, framePlaneZ + 0.28);
  rearBearing.userData.role = 'rear-bearing-on-driver-z-axis';
  const guideRails = [-1, 1].map((side) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(
        guideEndX - guideStartX,
        guideRailThickness,
        guideRailDepth,
      ),
      frameMaterial,
    );
    rail.position.set(
      driverCenter.x + (guideStartX + guideEndX) / 2,
      driverCenter.y + side * guideRailCenterOffset,
      rodPlaneZ - 0.08,
    );
    rail.userData.role = 'fixed-horizontal-crosshead-guide-rail';
    rail.userData.side = side < 0 ? 'lower' : 'upper';
    return rail;
  });
  const guideEndBridges = [guideStartX, guideEndX].map((x, index) => {
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.18,
        guideRailCenterOffset * 2 + guideRailThickness,
        0.34,
      ),
      frameMaterial,
    );
    bridge.position.set(
      driverCenter.x + x,
      driverCenter.y,
      rodPlaneZ - guideRailDepth / 2,
    );
    bridge.userData.role = 'rear-bridge-joining-the-two-crosshead-guides';
    bridge.userData.end = index === 0 ? 'inner' : 'outer';
    return bridge;
  });
  const guideSupports = [guideStartX, guideEndX].map((x, index) => {
    const supportHeight = driverCenter.y - guideRailCenterOffset - baseY;
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, supportHeight, 0.34),
      frameMaterial,
    );
    support.position.set(
      driverCenter.x + x,
      baseY + supportHeight / 2,
      framePlaneZ,
    );
    support.userData.role = 'vertical-support-under-crosshead-guide';
    support.userData.end = index === 0 ? 'inner' : 'outer';
    return support;
  });
  const rearBrace = makeBeam(
    new THREE.Vector3(driverCenter.x, baseY + 0.16, framePlaneZ - 0.16),
    new THREE.Vector3(
      driverCenter.x + guideStartX,
      driverCenter.y - guideRailCenterOffset,
      framePlaneZ - 0.16,
    ),
    {
      color: PALETTE.frame,
      depth: 0.24,
      jointRadius: 0.11,
      width: 0.16,
    },
  );
  rearBrace.userData.role = 'rear-diagonal-brace-between-drive-and-slide-frame';
  fixedFrame.add(
    baseRail,
    rearColumn,
    driverShaft,
    rearBearing,
    ...guideRails,
    ...guideEndBridges,
    ...guideSupports,
    rearBrace,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(12.6, 7.2, 4.6),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(2.65, 1.0, 0.25);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-of-disk-slotted-pitman-and-output-slide';

  root.add(
    cameraEnvelope,
    fixedFrame,
    input,
    rodAssembly,
    outputSlide,
  );

  const canonicalTimes = {
    sourcePose: 0,
    leftReversal: timeAfterSourcePoseForAngle(Math.PI),
    leftDwellMidpoint: timeAfterSourcePoseForAngle(
      (Math.PI + innerEngagementAngle) / 2,
    ),
    innerEngagement: timeAfterSourcePoseForAngle(innerEngagementAngle),
    advancingMidpoint: timeAfterSourcePoseForAngle(
      (innerEngagementAngle + fullTurn) / 2,
    ),
    rightReversal: timeAfterSourcePoseForAngle(0),
    rightDwellMidpoint: timeAfterSourcePoseForAngle(
      outerEngagementAngle / 2,
    ),
    outerEngagement: timeAfterSourcePoseForAngle(outerEngagementAngle),
    retractingMidpoint: timeAfterSourcePoseForAngle(
      (outerEngagementAngle + Math.PI) / 2,
    ),
    fullRotation: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.driverAngle;
    input.userData.angularSpeed = state.driverAngularSpeed;
    inputRotor.userData.angularSpeed = state.driverAngularSpeed;
    rodAssembly.position.set(
      state.slidePosition.x,
      state.slidePosition.y,
      rodPlaneZ,
    );
    rodAssembly.rotation.z = state.rodAngle;
    rodAssembly.userData.angularSpeed = state.rodAngularSpeed;
    rodAssembly.userData.angularAcceleration = state.rodAngularAcceleration;
    outputSlide.position.set(
      state.slidePosition.x,
      state.slidePosition.y,
      rodPlaneZ,
    );
    outputSlide.userData.velocityX = state.outputVelocity.x;
    outputSlide.userData.accelerationX = state.outputAcceleration.x;
    outputSlide.userData.dwelling = state.outputDwell;
    root.userData.contacts = {
      crankPinInSlot: {
        activeEnd: state.activeSlotEnd,
        accelerationError: state.contactAccelerationError,
        centerlineError: state.slotCenterlineError,
        engaged: state.engaged,
        freeTravelFromInnerEnd: state.freeTravelFromInnerEnd,
        freeTravelToOuterEnd: state.freeTravelToOuterEnd,
        positionError: state.contactPositionError,
        relativeSlidingSpeed: state.relativeSlidingSpeed,
        velocityError: state.contactVelocityError,
      },
      outputGuides: {
        axis: X_AXIS.clone(),
        rotationError: Math.hypot(
          outputSlide.rotation.x,
          outputSlide.rotation.y,
          outputSlide.rotation.z,
        ),
        verticalError: Math.abs(
          outputSlide.position.y - driverCenter.y
        ),
      },
    };
    root.userData.kinematics = state;
  };

  const activeOuterState = stateAtDriverAngle(outerEngagementAngle);
  const activeInnerState = stateAtDriverAngle(innerEngagementAngle);
  const sourcePixelsPerAnimationUnit = sourceRasterDiskRadius
    / sourceAnimationDiskOuterRadius;
  root.userData.mechanism =
    'rotary-crankpin-slotted-pitman-double-dwell-brick-press';
  root.userData.cameraDistanceScale = 1.0;
  root.userData.blocks = {
    baseRail,
    cameraEnvelope,
    crankArm,
    crankOrbit,
    crankPin,
    crankPinBody,
    crankPinFace,
    diskBody,
    diskInnerRim,
    diskOuterRim,
    diskRotationIndex,
    driverHub,
    driverShaft,
    fixedFrame,
    guideEndBridges,
    guideRails,
    guideSupports,
    input,
    inputRotor,
    outputEye,
    outputIndex,
    outputPin,
    outputPinFace,
    outputSlide,
    rearBearing,
    rearBrace,
    rearColumn,
    rodAssembly,
    rodBeam,
    slideBody,
    slideBottomEdge,
    slideTopEdge,
    slotFrame,
    slotOutline,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.configurationAtDriverAngle = configurationAtDriverAngle;
  root.userData.geometry = {
    activeInnerEngagementVelocity: activeInnerState.outputVelocity.x,
    activeOuterEngagementVelocity: activeOuterState.outputVelocity.x,
    baseY,
    crankPinCenterZ,
    crankPinLength,
    crankPinRadius,
    crankRadius,
    cyclePeriod,
    diskDepth,
    diskInnerRadius,
    diskOuterRadius,
    driverCenter: driverCenter.clone(),
    dwellFraction,
    framePlaneZ,
    fullTurn,
    guideClearance,
    guideEndX,
    guideRailCenterOffset,
    guideRailDepth,
    guideRailThickness,
    guideStartX,
    hubRadius,
    innerEngagementAngle,
    inputAngularSpeed,
    leftDwellAngle,
    leftDwellX,
    outerEngagementAngle,
    outputEyeRadius,
    outputPinLength,
    outputPinRadius,
    outputStroke,
    rightDwellAngle,
    rightDwellX,
    rodDepth,
    rodPlaneZ,
    slideDepth,
    slideHalfHeight,
    slideHalfWidth,
    slotCenterDistance,
    slotFreeTravel,
    slotInnerEndDistance,
    slotInnerRadius,
    slotOuterEndDistance,
    slotOuterRadius,
    slotStraightHalfLength,
    sourceAnimationCrankPinRadius,
    sourceAnimationCrankRadius,
    sourceAnimationDiskInnerRadius,
    sourceAnimationDiskOuterRadius,
    sourceAnimationGuideEndX,
    sourceAnimationGuideStartX,
    sourceAnimationHubRadius,
    sourceAnimationInnerEngagementCycle,
    sourceAnimationOuterEngagementCycle,
    sourceAnimationOutputEyeRadius,
    sourceAnimationOutputPinRadius,
    sourceAnimationPoseCycle,
    sourceAnimationSlideHalfHeight,
    sourceAnimationSlideHalfWidth,
    sourceAnimationSlotInnerEndDistance,
    sourceAnimationSlotInnerRadius,
    sourceAnimationSlotOuterEndDistance,
    sourceAnimationSlotOuterRadius,
    sourceAnimationViewBox,
    sourceImageHeight,
    sourceImageWidth,
    sourcePixelsPerAnimationUnit,
    sourcePoseAngle,
    sourceRasterCrankPinCenter: sourceRasterCrankPinCenter.clone(),
    sourceRasterDiskBottomY,
    sourceRasterDiskCenter: sourceRasterDiskCenter.clone(),
    sourceRasterDiskLeftX,
    sourceRasterDiskRadius,
    sourceRasterDiskRightX,
    sourceRasterDiskTopY,
    sourceScale,
  };
  root.userData.sliderLawAtDriverAngle = sliderLawAtDriverAngle;
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtDriverMotion = stateAtDriverMotion;
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
    crankPinFace,
    diskRotationIndex,
    outputIndex,
    outputPinFace,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';
  return {
    cameraDirection: new THREE.Vector3(8.8, 5.4, 15.2),
    root,
    update,
  };
}

export function createAuthoredLostMotionMovement(movement) {
  switch (movement.id) {
    case 166: return lostMotionBrickPress();
    default: return null;
  }
}
