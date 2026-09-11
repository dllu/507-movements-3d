import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const HALF_TURN = Math.PI;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function ringInXY(radius, tube, material, segments = 48) {
  return new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 10, segments),
    material,
  );
}

function fixedBeam2D(start, end, width, depth, z, material, role) {
  const direction = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(direction.length(), width, depth),
    material,
  );
  beam.position.set(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    z,
  );
  beam.rotation.z = Math.atan2(direction.y, direction.x);
  beam.userData.role = role;
  return beam;
}

function roundedArm({
  length,
  halfWidth,
  depth,
  angle = 0,
  material,
  role,
}) {
  const group = new THREE.Group();
  group.rotation.z = angle;
  group.userData.role = role;
  group.userData.length = length;
  group.userData.halfWidth = halfWidth;
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(length, halfWidth * 2, depth),
    material,
  );
  beam.position.x = length / 2;
  const endCap = cylinderAlongZ(halfWidth, depth, material, 36);
  endCap.position.x = length;
  group.add(beam, endCap);
  group.userData.blocks = { beam, endCap };
  return group;
}

function quinticStep(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t ** 3 * (10 + t * (-15 + 6 * t));
}

function quinticStepFirst(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * t ** 2 * (t - 1) ** 2;
}

function quinticStepSecond(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * t * (2 * t ** 2 - 3 * t + 1);
}

function bisectRoot(fn, minimum, maximum, iterations = 90) {
  let lower = minimum;
  let upper = maximum;
  let lowerValue = fn(lower);
  for (let index = 0; index < iterations; index += 1) {
    const middle = (lower + upper) / 2;
    const middleValue = fn(middle);
    if (Math.sign(middleValue) === Math.sign(lowerValue)) {
      lower = middle;
      lowerValue = middleValue;
    } else {
      upper = middle;
    }
  }
  return (lower + upper) / 2;
}

function studDiskElbowBarReverser() {
  const root = new THREE.Group();

  // Source measurements from Brown's plan-view engraving.  The two disk
  // studs are idealized as diametrically opposed, as required by the text;
  // their least-squares radius is taken from both hand-drawn centers.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.014;
  const sourceDiskCenter = new THREE.Vector2(289, 321);
  const sourceDiskRadius = 117;
  const sourceUpperStud = new THREE.Vector2(277, 219);
  const sourceLowerStud = new THREE.Vector2(304, 420);
  const sourceStudOrbitRadius = Math.hypot(13.5, 100.5);
  const sourceStudRadius = 11;
  const sourceHubRadius = 25;
  const sourceBarMinimumX = 5;
  const sourceBarMaximumX = 515;
  const sourceBarTopY = 143;
  const sourceBarBottomY = 180;
  const sourceBarStud = new THREE.Vector2(87, 169);
  const sourceBarStudRadius = 11;
  const sourceLugMinimumX = 287;
  const sourceLugMaximumX = 320;
  const sourceLugTopY = 180;
  const sourceLugBottomY = 234;
  const sourceGuideRollers = [
    new THREE.Vector2(47, 205),
    new THREE.Vector2(474, 205),
  ];
  const sourceGuideRollerRadius = 25;
  const sourceLeverPivot = new THREE.Vector2(100, 315);
  const sourceLeverInputEnd = new THREE.Vector2(204, 373);
  const sourceLeverOutputEnd = new THREE.Vector2(180, 169);
  const sourceLeverPivotRadius = 24;
  const sourceInputArmHalfWidth = 9;

  const sourceInputArmVector = sourceLeverInputEnd.clone()
    .sub(sourceLeverPivot);
  const sourceOutputArmVector = sourceLeverOutputEnd.clone()
    .sub(sourceLeverPivot);
  const sourceInputArmLength = sourceInputArmVector.length();
  const sourceOutputArmLength = sourceOutputArmVector.length();
  const sourceLeverRestAngle = Math.atan2(
    sourceInputArmVector.y,
    sourceInputArmVector.x,
  );
  const sourceLeverIncludedAngle = Math.atan2(
    sourceOutputArmVector.y,
    sourceOutputArmVector.x,
  ) - sourceLeverRestAngle;

  // A stud first contacts the lug's left face.  Once its center passes the
  // lug's bottom edge it rolls around that sharp corner.  The maximum of this
  // exact corner-contact locus is the zero-speed right limit.
  const sourceDirectStartAngle = -Math.acos(
    (sourceLugMinimumX - sourceStudRadius - sourceDiskCenter.x)
      / sourceStudOrbitRadius,
  );
  const sourceCornerStartAngle = Math.asin(
    (sourceLugBottomY - sourceDiskCenter.y) / sourceStudOrbitRadius,
  );
  const sourceCornerFinishAngle = Math.asin(
    (sourceLugBottomY + sourceStudRadius - sourceDiskCenter.y)
      / sourceStudOrbitRadius,
  );

  const directContactRaw = (screenAngle) => {
    const studX = sourceDiskCenter.x
      + sourceStudOrbitRadius * Math.cos(screenAngle);
    const studY = sourceDiskCenter.y
      + sourceStudOrbitRadius * Math.sin(screenAngle);
    const studXFirst = -sourceStudOrbitRadius * Math.sin(screenAngle);
    const studYFirst = sourceStudOrbitRadius * Math.cos(screenAngle);
    const studXSecond = -sourceStudOrbitRadius * Math.cos(screenAngle);
    const studYSecond = -sourceStudOrbitRadius * Math.sin(screenAngle);
    if (studY <= sourceLugBottomY) {
      return {
        contactMode: 'left-vertical-lug-face',
        contactNormal: new THREE.Vector2(1, 0),
        contactPoint: new THREE.Vector2(
          studX + sourceStudRadius,
          studY,
        ),
        studCenter: new THREE.Vector2(studX, studY),
        translation: studX + sourceStudRadius - sourceLugMinimumX,
        translationFirst: studXFirst,
        translationSecond: studXSecond,
      };
    }
    const verticalOffset = studY - sourceLugBottomY;
    const horizontalOffset = Math.sqrt(Math.max(
      0,
      sourceStudRadius ** 2 - verticalOffset ** 2,
    ));
    const horizontalOffsetFirst = -verticalOffset * studYFirst
      / horizontalOffset;
    const horizontalOffsetSecond = -(
      studYFirst ** 2 + verticalOffset * studYSecond
    ) / horizontalOffset
      - (verticalOffset * studYFirst) ** 2 / horizontalOffset ** 3;
    const translation = studX + horizontalOffset - sourceLugMinimumX;
    const corner = new THREE.Vector2(
      sourceLugMinimumX + translation,
      sourceLugBottomY,
    );
    return {
      contactMode: 'rounded-stud-on-lug-lower-left-corner',
      contactNormal: corner.clone().sub(new THREE.Vector2(studX, studY))
        .normalize(),
      contactPoint: corner,
      studCenter: new THREE.Vector2(studX, studY),
      translation,
      translationFirst: studXFirst + horizontalOffsetFirst,
      translationSecond: studXSecond + horizontalOffsetSecond,
    };
  };

  const sourceDirectEndAngle = bisectRoot(
    (angle) => directContactRaw(angle).translationFirst,
    sourceCornerStartAngle + 1e-8,
    sourceCornerFinishAngle - 1e-8,
  );
  const sourceBarTravel = directContactRaw(
    sourceDirectEndAngle,
  ).translation;
  const sourceBarRightStudX = sourceBarStud.x + sourceBarTravel;

  // The output arm's side touches the bar stud at the direct stroke's exact
  // right limit.  This fixes its physical half-width from the engraving and
  // closes the handoff without an invented overlap or gap.
  const sourceOutputRestAngle = sourceLeverRestAngle
    + sourceLeverIncludedAngle;
  const sourceOutputRestDirection = new THREE.Vector2(
    Math.cos(sourceOutputRestAngle),
    Math.sin(sourceOutputRestAngle),
  );
  const sourceOutputContactOffset = sourceOutputRestDirection.y
      * (sourceBarRightStudX - sourceLeverPivot.x)
    - sourceOutputRestDirection.x
      * (sourceBarStud.y - sourceLeverPivot.y);
  const sourceOutputArmHalfWidth = sourceOutputContactOffset
    - sourceBarStudRadius;
  const sourceInputContactOffset = sourceStudRadius
    + sourceInputArmHalfWidth;

  const sourcePointOnStudOrbit = (screenAngle) => new THREE.Vector2(
    sourceDiskCenter.x + sourceStudOrbitRadius * Math.cos(screenAngle),
    sourceDiskCenter.y + sourceStudOrbitRadius * Math.sin(screenAngle),
  );
  const capsuleDistanceAtRest = (screenAngle) => {
    const stud = sourcePointOnStudOrbit(screenAngle);
    const relative = stud.clone().sub(sourceLeverPivot);
    const direction = new THREE.Vector2(
      Math.cos(sourceLeverRestAngle),
      Math.sin(sourceLeverRestAngle),
    );
    const station = THREE.MathUtils.clamp(
      relative.dot(direction),
      0,
      sourceInputArmLength,
    );
    return relative.addScaledVector(direction, -station).length();
  };

  const inputContactAtAngle = (returnStudScreenAngle) => {
    const studCenter = sourcePointOnStudOrbit(returnStudScreenAngle);
    const relative = studCenter.clone().sub(sourceLeverPivot);
    const radialDistance = relative.length();
    const radialAngle = Math.atan2(relative.y, relative.x);
    const sideStation = Math.sqrt(
      radialDistance ** 2 - sourceInputContactOffset ** 2,
    );
    let contactMode;
    let inputStation;
    let leverAngle;
    if (sideStation <= sourceInputArmLength) {
      contactMode = 'disk-stud-on-input-arm-side';
      inputStation = sideStation;
      leverAngle = radialAngle - Math.asin(
        sourceInputContactOffset / radialDistance,
      );
    } else {
      contactMode = 'disk-stud-on-rounded-input-arm-end';
      inputStation = sourceInputArmLength;
      const cosine = THREE.MathUtils.clamp(
        (
          radialDistance ** 2 + sourceInputArmLength ** 2
            - sourceInputContactOffset ** 2
        ) / (2 * radialDistance * sourceInputArmLength),
        -1,
        1,
      );
      leverAngle = radialAngle - Math.acos(cosine);
    }
    const inputDirection = new THREE.Vector2(
      Math.cos(leverAngle),
      Math.sin(leverAngle),
    );
    const inputCenterlineContact = sourceLeverPivot.clone()
      .addScaledVector(inputDirection, inputStation);
    const inputNormal = studCenter.clone().sub(inputCenterlineContact)
      .normalize();
    const pinSurfacePoint = studCenter.clone()
      .addScaledVector(inputNormal, -sourceStudRadius);
    const armSurfacePoint = inputCenterlineContact.clone()
      .addScaledVector(inputNormal, sourceInputArmHalfWidth);

    const outputAngle = leverAngle + sourceLeverIncludedAngle;
    const outputDirection = new THREE.Vector2(
      Math.cos(outputAngle),
      Math.sin(outputAngle),
    );
    const barStudX = sourceLeverPivot.x + (
      outputDirection.x * (sourceBarStud.y - sourceLeverPivot.y)
        + sourceOutputContactOffset
    ) / outputDirection.y;
    const barStudCenter = new THREE.Vector2(barStudX, sourceBarStud.y);
    const outputRelative = barStudCenter.clone().sub(sourceLeverPivot);
    const outputStation = outputRelative.dot(outputDirection);
    const outputCenterlineContact = sourceLeverPivot.clone()
      .addScaledVector(outputDirection, outputStation);
    const outputNormal = barStudCenter.clone()
      .sub(outputCenterlineContact)
      .normalize();
    const outputArmSurfacePoint = outputCenterlineContact.clone()
      .addScaledVector(outputNormal, sourceOutputArmHalfWidth);
    const barStudSurfacePoint = barStudCenter.clone()
      .addScaledVector(outputNormal, -sourceBarStudRadius);

    return {
      armSurfacePoint,
      barStudCenter,
      barStudSurfacePoint,
      barStudX,
      contactMode,
      inputCenterlineContact,
      inputDirection,
      inputDistanceError: studCenter.distanceTo(inputCenterlineContact)
        - sourceInputContactOffset,
      inputNormal,
      inputStation,
      leverAngle,
      outputAngle,
      outputArmSurfacePoint,
      outputCenterlineContact,
      outputDirection,
      outputDistanceError: barStudCenter.distanceTo(
        outputCenterlineContact,
      ) - sourceOutputContactOffset,
      outputNormal,
      outputStation,
      pinSurfacePoint,
      studCenter,
    };
  };

  const sourceReturnStudStartAngle = bisectRoot(
    (angle) => capsuleDistanceAtRest(angle) - sourceInputContactOffset,
    sourceDirectEndAngle + HALF_TURN,
    sourceDirectEndAngle + HALF_TURN + 0.55,
  );
  const sourceReturnStudEndAngle = bisectRoot(
    (angle) => inputContactAtAngle(angle).barStudX - sourceBarStud.x,
    sourceReturnStudStartAngle,
    sourceReturnStudStartAngle + 0.85,
  );
  const sourceReturnStartActiveAngle = sourceReturnStudStartAngle
    - HALF_TURN;
  const sourceReturnEndActiveAngle = sourceReturnStudEndAngle - HALF_TURN;
  const sourceLeverReturnAngle = inputContactAtAngle(
    sourceReturnStudEndAngle,
  ).leverAngle;
  const sourceLeverResetStartAngle = sourceReturnEndActiveAngle + 0.15;
  const sourceLeverResetEndAngle = sourceLeverResetStartAngle + 0.72;
  const sourceNextDirectAngle = sourceDirectStartAngle + HALF_TURN;

  const diskPeriod = 12;
  const diskScreenAngularSpeed = FULL_TURN / diskPeriod;
  const strokePeriod = diskPeriod / 2;
  const derivativeStep = 1e-4;
  const differentiateScalar = (fn, value) => {
    const lowerTwo = fn(value - 2 * derivativeStep);
    const lowerOne = fn(value - derivativeStep);
    const center = fn(value);
    const upperOne = fn(value + derivativeStep);
    const upperTwo = fn(value + 2 * derivativeStep);
    return {
      first: (
        lowerTwo - 8 * lowerOne + 8 * upperOne - upperTwo
      ) / (12 * derivativeStep),
      second: (
        -upperTwo + 16 * upperOne - 30 * center
          + 16 * lowerOne - lowerTwo
      ) / (12 * derivativeStep ** 2),
      value: center,
    };
  };

  const returnContactMotion = (activeScreenAngle) => {
    const returnStudAngle = activeScreenAngle + HALF_TURN;
    const contact = inputContactAtAngle(returnStudAngle);
    const leverDerivatives = differentiateScalar(
      (angle) => inputContactAtAngle(angle + HALF_TURN).leverAngle,
      activeScreenAngle,
    );
    const barDerivatives = differentiateScalar(
      (angle) => inputContactAtAngle(angle + HALF_TURN).barStudX
        - sourceBarStud.x,
      activeScreenAngle,
    );
    return {
      barAcceleration: barDerivatives.second
        * diskScreenAngularSpeed ** 2,
      barTranslation: barDerivatives.value,
      barVelocity: barDerivatives.first * diskScreenAngularSpeed,
      contact,
      leverAngle: leverDerivatives.value,
      leverAngularAcceleration: leverDerivatives.second
        * diskScreenAngularSpeed ** 2,
      leverAngularSpeed: leverDerivatives.first * diskScreenAngularSpeed,
    };
  };

  const sourceToWorld = (point, z = 0) => new THREE.Vector3(
    (point.x - sourceDiskCenter.x) * sourceScale,
    (sourceDiskCenter.y - point.y) * sourceScale,
    z,
  );
  const worldToSource = (point) => new THREE.Vector2(
    sourceDiskCenter.x + point.x / sourceScale,
    sourceDiskCenter.y - point.y / sourceScale,
  );

  const diskRadius = sourceDiskRadius * sourceScale;
  const studOrbitRadius = sourceStudOrbitRadius * sourceScale;
  const studRadius = sourceStudRadius * sourceScale;
  const hubRadius = sourceHubRadius * sourceScale;
  const barStudRadius = sourceBarStudRadius * sourceScale;
  const guideRollerRadius = sourceGuideRollerRadius * sourceScale;
  const leverInputLength = sourceInputArmLength * sourceScale;
  const leverOutputLength = sourceOutputArmLength * sourceScale;
  const leverInputHalfWidth = sourceInputArmHalfWidth * sourceScale;
  const leverOutputHalfWidth = sourceOutputArmHalfWidth * sourceScale;
  const leverPivotRadius = sourceLeverPivotRadius * sourceScale;
  const barTravel = sourceBarTravel * sourceScale;
  const barSourceCenter = sourceToWorld(new THREE.Vector2(
    (sourceBarMinimumX + sourceBarMaximumX) / 2,
    (sourceBarTopY + sourceBarBottomY) / 2,
  ));
  const barLength = (sourceBarMaximumX - sourceBarMinimumX) * sourceScale;
  const barHeight = (sourceBarBottomY - sourceBarTopY) * sourceScale;
  const barDepth = 0.28;
  const barPlaneZ = 0.44;
  const lugSourceCenter = sourceToWorld(new THREE.Vector2(
    (sourceLugMinimumX + sourceLugMaximumX) / 2,
    (sourceLugTopY + sourceLugBottomY) / 2,
  ));
  const lugWidth = (sourceLugMaximumX - sourceLugMinimumX) * sourceScale;
  const lugHeight = (sourceLugBottomY - sourceLugTopY) * sourceScale;
  const barStudSourceCenter = sourceToWorld(sourceBarStud, barPlaneZ);
  const leverPivot = sourceToWorld(sourceLeverPivot, 0.66);
  const leverWorldIncludedAngle = -sourceLeverIncludedAngle;
  const diskDepth = 0.28;
  const diskPlaneZ = -0.02;
  const studRearZ = -0.10;
  const studFrontZ = 0.73;
  const studDepth = studFrontZ - studRearZ;
  const studCenterZ = (studFrontZ + studRearZ) / 2;
  const leverDepth = 0.20;
  const leverPlaneZ = 0.66;
  const contactMarkerZ = 0.80;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.62,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.64,
  });
  const leverMaterial = matte(PALETTE.accent, {
    metalness: 0.10,
    roughness: 0.62,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.18,
    roughness: 0.56,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const disk = new THREE.Group();
  disk.userData.role = 'uniformly-rotating-two-stud-driver-disk';
  disk.userData.axis = Z_AXIS.clone();
  const diskRotor = new THREE.Group();
  const diskBody = cylinderAlongZ(
    diskRadius,
    diskDepth,
    driverMaterial,
    72,
  );
  diskBody.position.z = diskPlaneZ;
  diskBody.userData.role = 'solid-source-proportioned-driver-disk';
  const diskRim = ringInXY(diskRadius * 0.985, 0.040, darkMaterial, 72);
  diskRim.position.z = diskPlaneZ + diskDepth / 2 + 0.018;
  const diskHub = cylinderAlongZ(hubRadius, 0.46, darkMaterial, 42);
  diskHub.position.z = 0.05;
  const diskHubFace = cylinderAlongZ(hubRadius * 0.48, 0.035, whiteMaterial, 36);
  diskHubFace.position.z = 0.30;
  const pinAssemblies = [-1, 1].map((sign, index) => {
    const assembly = new THREE.Group();
    assembly.position.x = sign * studOrbitRadius;
    assembly.userData.role = 'disk-fixed-striking-stud';
    assembly.userData.index = index;
    const pin = cylinderAlongZ(studRadius, studDepth, darkMaterial, 36);
    pin.position.z = studCenterZ;
    const face = cylinderAlongZ(studRadius * 0.72, 0.040, whiteMaterial, 32);
    face.position.z = studFrontZ + 0.022;
    assembly.add(pin, face);
    assembly.userData.blocks = { face, pin };
    return assembly;
  });
  // Pin zero starts on the source upper-left contact.  Its local station is
  // +R, and the disk's negative Z rotation maps screen-clockwise motion into
  // the right-handed Three.js world.
  pinAssemblies[0].position.x = studOrbitRadius;
  pinAssemblies[1].position.x = -studOrbitRadius;
  diskRotor.add(
    diskBody,
    diskRim,
    diskHub,
    diskHubFace,
    ...pinAssemblies,
  );
  disk.add(diskRotor);
  disk.userData.rotor = diskRotor;

  const slidingBar = new THREE.Group();
  slidingBar.userData.role = 'horizontally-guided-reciprocating-bar';
  slidingBar.userData.guideAxis = X_AXIS.clone();
  const barBody = new THREE.Mesh(
    new THREE.BoxGeometry(barLength, barHeight, barDepth),
    drivenMaterial,
  );
  barBody.position.copy(barSourceCenter);
  barBody.position.z = barPlaneZ;
  barBody.userData.role = 'source-proportioned-horizontal-bar';
  const undersideLug = new THREE.Mesh(
    new THREE.BoxGeometry(lugWidth, lugHeight, barDepth),
    drivenMaterial,
  );
  undersideLug.position.copy(lugSourceCenter);
  undersideLug.position.z = barPlaneZ;
  undersideLug.userData.role = 'bar-fixed-underside-direct-drive-projection';
  const barFrontStud = cylinderAlongZ(
    barStudRadius,
    0.42,
    darkMaterial,
    36,
  );
  barFrontStud.position.copy(barStudSourceCenter);
  barFrontStud.position.z = 0.61;
  barFrontStud.userData.role = 'bar-fixed-front-return-stud';
  const barFrontStudFace = cylinderAlongZ(
    barStudRadius * 0.70,
    0.038,
    whiteMaterial,
    32,
  );
  barFrontStudFace.position.copy(barStudSourceCenter);
  barFrontStudFace.position.z = 0.84;
  const barMotionIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.050, 0.025),
    whiteMaterial,
  );
  barMotionIndex.position.set(
    barSourceCenter.x + barLength * 0.32,
    barSourceCenter.y,
    barPlaneZ + barDepth / 2 + 0.025,
  );
  slidingBar.add(
    barBody,
    undersideLug,
    barFrontStud,
    barFrontStudFace,
    barMotionIndex,
  );

  const lever = new THREE.Group();
  lever.position.copy(leverPivot);
  lever.userData.role = 'fixed-pivot-right-angle-return-elbow-lever';
  lever.userData.axis = Z_AXIS.clone();
  const inputArm = roundedArm({
    length: leverInputLength,
    halfWidth: leverInputHalfWidth,
    depth: leverDepth,
    material: leverMaterial,
    role: 'disk-stud-driven-lower-input-arm',
  });
  const outputArm = roundedArm({
    angle: leverWorldIncludedAngle,
    depth: leverDepth,
    halfWidth: leverOutputHalfWidth,
    length: leverOutputLength,
    material: leverMaterial,
    role: 'bar-stud-driving-upper-output-arm',
  });
  const leverPivotCollar = cylinderAlongZ(
    leverPivotRadius,
    0.34,
    darkMaterial,
    42,
  );
  const leverPivotFace = cylinderAlongZ(
    leverPivotRadius * 0.48,
    0.038,
    whiteMaterial,
    34,
  );
  leverPivotFace.position.z = 0.19;
  lever.add(inputArm, outputArm, leverPivotCollar, leverPivotFace);

  const makeGuideRoller = (sourceCenter, index) => {
    const guide = new THREE.Group();
    guide.position.copy(sourceToWorld(sourceCenter, 0.18));
    guide.userData.role = 'fixed-center-bar-support-guide-roller';
    guide.userData.index = index;
    guide.userData.axis = Z_AXIS.clone();
    const rotor = new THREE.Group();
    const wheel = cylinderAlongZ(
      guideRollerRadius,
      0.34,
      frameMaterial,
      48,
    );
    const hub = cylinderAlongZ(
      guideRollerRadius * 0.30,
      0.45,
      darkMaterial,
      32,
    );
    const indexMark = new THREE.Mesh(
      new THREE.BoxGeometry(guideRollerRadius * 0.48, 0.055, 0.025),
      whiteMaterial,
    );
    indexMark.position.set(guideRollerRadius * 0.50, 0, 0.24);
    rotor.add(wheel, hub, indexMark);
    guide.add(rotor);
    guide.userData.rotor = rotor;
    guide.userData.blocks = { hub, indexMark, wheel };
    return guide;
  };
  const guideRollers = sourceGuideRollers.map(makeGuideRoller);

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-rear-support-frame-and-axles';
  const baseY = -1.94;
  const frameZ = -0.42;
  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(8.35, 0.18, 0.30),
    frameMaterial,
  );
  baseRail.position.set(-0.05, baseY, frameZ);
  baseRail.userData.role = 'fixed-base-rail';
  const postXs = [
    sourceToWorld(sourceGuideRollers[0]).x,
    sourceToWorld(sourceLeverPivot).x,
    0,
    sourceToWorld(sourceGuideRollers[1]).x,
  ];
  const postTopYs = [
    sourceToWorld(sourceGuideRollers[0]).y,
    sourceToWorld(sourceLeverPivot).y,
    0,
    sourceToWorld(sourceGuideRollers[1]).y,
  ];
  const supportPosts = postXs.map((x, index) => fixedBeam2D(
    new THREE.Vector2(x, baseY + 0.09),
    new THREE.Vector2(x, postTopYs[index]),
    0.17,
    0.24,
    frameZ,
    frameMaterial,
    'fixed-rear-support-post',
  ));
  const diskAxle = cylinderAlongZ(0.13, 1.00, darkMaterial, 32);
  diskAxle.position.set(0, 0, 0.02);
  diskAxle.userData.role = 'fixed-axis-disk-shaft';
  const leverAxle = cylinderAlongZ(0.11, 1.32, darkMaterial, 32);
  leverAxle.position.set(leverPivot.x, leverPivot.y, 0.12);
  leverAxle.userData.role = 'fixed-axis-elbow-pivot-shaft';
  const guideAxles = guideRollers.map((guide) => {
    const axle = cylinderAlongZ(0.085, 0.88, darkMaterial, 28);
    axle.position.copy(guide.position);
    axle.position.z = -0.02;
    axle.userData.role = 'fixed-axis-guide-roller-shaft';
    return axle;
  });
  fixedFrame.add(
    baseRail,
    ...supportPosts,
    diskAxle,
    leverAxle,
    ...guideAxles,
  );

  const directContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 20, 14),
    whiteMaterial,
  );
  directContactMarker.userData.role = 'visible-direct-stud-lug-contact';
  const returnInputContactMarker = directContactMarker.clone();
  returnInputContactMarker.userData.role =
    'visible-return-stud-input-arm-contact';
  const returnOutputContactMarker = directContactMarker.clone();
  returnOutputContactMarker.userData.role =
    'visible-output-arm-bar-stud-contact';

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(9.0, 4.8, 2.4),
    new THREE.MeshBasicMaterial({
      color: PALETTE.paper,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0.10, 0.35, 0.30);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-complete-bar-and-lever-sweep-envelope';

  root.add(
    cameraEnvelope,
    fixedFrame,
    ...guideRollers,
    disk,
    slidingBar,
    lever,
    directContactMarker,
    returnInputContactMarker,
    returnOutputContactMarker,
  );

  const pinStateAtScreenAngle = (screenAngle, index) => {
    const position = new THREE.Vector3(
      studOrbitRadius * Math.cos(screenAngle),
      -studOrbitRadius * Math.sin(screenAngle),
      studCenterZ,
    );
    const velocity = new THREE.Vector3(
      -studOrbitRadius * Math.sin(screenAngle) * diskScreenAngularSpeed,
      -studOrbitRadius * Math.cos(screenAngle) * diskScreenAngularSpeed,
      0,
    );
    const acceleration = new THREE.Vector3(
      -studOrbitRadius * Math.cos(screenAngle)
        * diskScreenAngularSpeed ** 2,
      studOrbitRadius * Math.sin(screenAngle)
        * diskScreenAngularSpeed ** 2,
      0,
    );
    return {
      acceleration,
      index,
      position,
      screenAngle,
      velocity,
    };
  };

  const stateAtTime = (time) => {
    const halfCycleIndex = Math.floor(time / strokePeriod);
    const halfCycleTime = time - halfCycleIndex * strokePeriod;
    const activeScreenAngle = sourceDirectStartAngle
      + diskScreenAngularSpeed * halfCycleTime;
    const driverScreenAngle = sourceDirectStartAngle
      + diskScreenAngularSpeed * time;
    const activeDirectPinIndex = positiveModulo(halfCycleIndex, 2);
    const activeReturnPinIndex = 1 - activeDirectPinIndex;
    let barAccelerationPixels = 0;
    let barTranslationPixels = 0;
    let barVelocityPixels = 0;
    let directContact = null;
    let leverAngle = sourceLeverRestAngle;
    let leverAngularAcceleration = 0;
    let leverAngularSpeed = 0;
    let returnContact = null;
    let stage;

    if (activeScreenAngle <= sourceDirectEndAngle) {
      const direct = directContactRaw(activeScreenAngle);
      barTranslationPixels = direct.translation;
      barVelocityPixels = direct.translationFirst * diskScreenAngularSpeed;
      barAccelerationPixels = direct.translationSecond
        * diskScreenAngularSpeed ** 2;
      directContact = direct;
      stage = direct.contactMode === 'left-vertical-lug-face'
        ? 'direct-stud-pushing-lug-face-right'
        : 'direct-stud-rolling-around-lug-corner';
    } else if (activeScreenAngle < sourceReturnStartActiveAngle) {
      barTranslationPixels = sourceBarTravel;
      stage = 'right-limit-dwell-before-return-stud';
    } else if (activeScreenAngle <= sourceReturnEndActiveAngle) {
      const motion = returnContactMotion(activeScreenAngle);
      barTranslationPixels = THREE.MathUtils.clamp(
        motion.barTranslation,
        0,
        sourceBarTravel,
      );
      barVelocityPixels = motion.barVelocity;
      barAccelerationPixels = motion.barAcceleration;
      leverAngle = motion.leverAngle;
      leverAngularSpeed = motion.leverAngularSpeed;
      leverAngularAcceleration = motion.leverAngularAcceleration;
      returnContact = motion.contact;
      stage = motion.contact.contactMode === 'disk-stud-on-rounded-input-arm-end'
        ? 'return-stud-driving-rounded-elbow-end-left'
        : 'return-stud-sliding-along-elbow-arm-left';
    } else if (activeScreenAngle < sourceLeverResetStartAngle) {
      leverAngle = sourceLeverReturnAngle;
      stage = 'left-limit-impact-dwell';
    } else if (activeScreenAngle < sourceLeverResetEndAngle) {
      const span = sourceLeverResetEndAngle - sourceLeverResetStartAngle;
      const progress = (
        activeScreenAngle - sourceLeverResetStartAngle
      ) / span;
      const angleTravel = sourceLeverRestAngle - sourceLeverReturnAngle;
      leverAngle = sourceLeverReturnAngle
        + angleTravel * quinticStep(progress);
      leverAngularSpeed = angleTravel * quinticStepFirst(progress)
        / span * diskScreenAngularSpeed;
      leverAngularAcceleration = angleTravel * quinticStepSecond(progress)
        / span ** 2 * diskScreenAngularSpeed ** 2;
      stage = 'gravity-resetting-elbow-at-left-limit';
    } else {
      stage = 'left-limit-dwell-before-next-direct-stud';
    }

    const barTranslation = barTranslationPixels * sourceScale;
    const barVelocityX = barVelocityPixels * sourceScale;
    const barAccelerationX = barAccelerationPixels * sourceScale;
    const pinScreenAngles = [driverScreenAngle, driverScreenAngle + HALF_TURN];
    const pinStates = pinScreenAngles.map(pinStateAtScreenAngle);
    const directPin = pinStates[activeDirectPinIndex];
    const returnPin = pinStates[activeReturnPinIndex];
    const barStudCenter = barStudSourceCenter.clone();
    barStudCenter.x += barTranslation;
    const lugMinimumX = (
      sourceLugMinimumX - sourceDiskCenter.x
    ) * sourceScale + barTranslation;
    const lugMaximumX = (
      sourceLugMaximumX - sourceDiskCenter.x
    ) * sourceScale + barTranslation;
    const lugTopY = (
      sourceDiskCenter.y - sourceLugTopY
    ) * sourceScale;
    const lugBottomY = (
      sourceDiskCenter.y - sourceLugBottomY
    ) * sourceScale;
    let directContactPoint = null;
    let directContactPointError = 0;
    let directNormalVelocityError = 0;
    if (directContact) {
      directContactPoint = sourceToWorld(
        directContact.contactPoint,
        contactMarkerZ,
      );
      const pinCenterSource = directContact.studCenter;
      const pinSurfaceSource = pinCenterSource.clone().addScaledVector(
        directContact.contactNormal,
        sourceStudRadius,
      );
      directContactPointError = pinSurfaceSource.distanceTo(
        directContact.contactPoint,
      ) * sourceScale;
      const pinVelocitySource = new THREE.Vector2(
        -sourceStudOrbitRadius * Math.sin(activeScreenAngle)
          * diskScreenAngularSpeed,
        sourceStudOrbitRadius * Math.cos(activeScreenAngle)
          * diskScreenAngularSpeed,
      );
      const lugVelocitySource = new THREE.Vector2(barVelocityPixels, 0);
      directNormalVelocityError = lugVelocitySource
        .sub(pinVelocitySource)
        .dot(directContact.contactNormal) * sourceScale;
    }
    let returnInputPoint = null;
    let returnOutputPoint = null;
    let returnInputPointError = 0;
    let returnOutputPointError = 0;
    if (returnContact) {
      returnInputPoint = sourceToWorld(
        returnContact.armSurfacePoint,
        contactMarkerZ,
      );
      returnOutputPoint = sourceToWorld(
        returnContact.outputArmSurfacePoint,
        contactMarkerZ,
      );
      returnInputPointError = returnContact.armSurfacePoint.distanceTo(
        returnContact.pinSurfacePoint,
      ) * sourceScale;
      returnOutputPointError = returnContact.outputArmSurfacePoint.distanceTo(
        returnContact.barStudSurfacePoint,
      ) * sourceScale;
    }

    return {
      activeDirectPinIndex,
      activeReturnPinIndex,
      activeScreenAngle,
      bar: {
        acceleration: new THREE.Vector3(barAccelerationX, 0, 0),
        accelerationX: barAccelerationX,
        guideAccelerationError: 0,
        guidePositionError: 0,
        guideVelocityError: 0,
        position: new THREE.Vector3(barTranslation, 0, 0),
        translation: barTranslation,
        translationPixels: barTranslationPixels,
        velocity: new THREE.Vector3(barVelocityX, 0, 0),
        velocityX: barVelocityX,
      },
      barStudCenter,
      directContact,
      directContactPoint,
      directContactPointError,
      directNormalVelocityError,
      directPin,
      diskAngularAcceleration: 0,
      diskAngularSpeed: -diskScreenAngularSpeed,
      diskPhase: positiveModulo(time, diskPeriod) / diskPeriod,
      driverScreenAngle,
      halfCycleIndex,
      lever: {
        angle: leverAngle,
        angularAcceleration: leverAngularAcceleration,
        angularSpeed: leverAngularSpeed,
        worldAngle: -leverAngle,
        worldAngularAcceleration: -leverAngularAcceleration,
        worldAngularSpeed: -leverAngularSpeed,
      },
      lugBounds: {
        bottomY: lugBottomY,
        maximumX: lugMaximumX,
        minimumX: lugMinimumX,
        topY: lugTopY,
      },
      pinStates,
      returnContact,
      returnInputPoint,
      returnInputPointError,
      returnOutputPoint,
      returnOutputPointError,
      returnPin,
      stage,
      strokePhase: halfCycleTime / strokePeriod,
      time,
    };
  };

  const stateAtStrokePhase = (phase) => stateAtTime(phase * strokePeriod);
  const timeAtActiveAngle = (angle) => (
    angle - sourceDirectStartAngle
  ) / diskScreenAngularSpeed;
  const canonicalTimes = {
    directCorner: timeAtActiveAngle(sourceCornerStartAngle),
    directMid: timeAtActiveAngle(
      (sourceDirectStartAngle + sourceDirectEndAngle) / 2,
    ),
    leftLimit: timeAtActiveAngle(sourceReturnEndActiveAngle),
    nextSource: strokePeriod,
    resetMid: timeAtActiveAngle(
      (sourceLeverResetStartAngle + sourceLeverResetEndAngle) / 2,
    ),
    returnContactStart: timeAtActiveAngle(sourceReturnStartActiveAngle),
    returnMid: timeAtActiveAngle(
      (sourceReturnStartActiveAngle + sourceReturnEndActiveAngle) / 2,
    ),
    rightLimit: timeAtActiveAngle(sourceDirectEndAngle),
    source: 0,
  };

  const sourceState = stateAtTime(0);
  const sourceUpperStudMapped = worldToSource(
    sourceState.pinStates[0].position,
  );
  const sourceLowerStudMapped = worldToSource(
    sourceState.pinStates[1].position,
  );

  root.userData.mechanism =
    'two-opposed-disk-studs-direct-lug-and-elbow-return-guided-bar';
  root.userData.blocks = {
    barBody,
    barFrontStud,
    barFrontStudFace,
    barMotionIndex,
    cameraEnvelope,
    directContactMarker,
    disk,
    diskBody,
    diskHub,
    diskHubFace,
    diskRim,
    diskRotor,
    fixedFrame,
    guideRollers,
    inputArm,
    lever,
    leverPivotCollar,
    leverPivotFace,
    outputArm,
    pinAssemblies,
    returnInputContactMarker,
    returnOutputContactMarker,
    slidingBar,
    undersideLug,
  };
  root.userData.canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [name, stateAtTime(time)]),
  );
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    barDepth,
    barHeight,
    barLength,
    barPlaneZ,
    barSourceCenter: barSourceCenter.clone(),
    barStudRadius,
    barStudSourceCenter: barStudSourceCenter.clone(),
    barTravel,
    contactMarkerZ,
    derivativeStep,
    diskDepth,
    diskPeriod,
    diskPlaneZ,
    diskRadius,
    diskScreenAngularSpeed,
    guideRollerRadius,
    hubRadius,
    leverDepth,
    leverInputHalfWidth,
    leverInputLength,
    leverOutputHalfWidth,
    leverOutputLength,
    leverPivot: leverPivot.clone(),
    leverPivotRadius,
    leverPlaneZ,
    leverWorldIncludedAngle,
    lugHeight,
    lugSourceCenter: lugSourceCenter.clone(),
    lugWidth,
    sourceBarBottomY,
    sourceBarMaximumX,
    sourceBarMinimumX,
    sourceBarRightStudX,
    sourceBarStud: sourceBarStud.clone(),
    sourceBarStudRadius,
    sourceBarTopY,
    sourceBarTravel,
    sourceCornerFinishAngle,
    sourceCornerStartAngle,
    sourceDirectEndAngle,
    sourceDirectStartAngle,
    sourceDiskCenter: sourceDiskCenter.clone(),
    sourceDiskRadius,
    sourceGuideRollerRadius,
    sourceGuideRollers: sourceGuideRollers.map((point) => point.clone()),
    sourceHubRadius,
    sourceImageHeight,
    sourceImageWidth,
    sourceInputArmHalfWidth,
    sourceInputArmLength,
    sourceInputContactOffset,
    sourceLeverIncludedAngle,
    sourceLeverInputEnd: sourceLeverInputEnd.clone(),
    sourceLeverOutputEnd: sourceLeverOutputEnd.clone(),
    sourceLeverPivot: sourceLeverPivot.clone(),
    sourceLeverPivotRadius,
    sourceLeverResetEndAngle,
    sourceLeverResetStartAngle,
    sourceLeverRestAngle,
    sourceLeverReturnAngle,
    sourceLowerStud: sourceLowerStud.clone(),
    sourceLowerStudMapped,
    sourceLugBottomY,
    sourceLugMaximumX,
    sourceLugMinimumX,
    sourceLugTopY,
    sourceNextDirectAngle,
    sourceOutputArmHalfWidth,
    sourceOutputArmLength,
    sourceOutputContactOffset,
    sourceReturnEndActiveAngle,
    sourceReturnStartActiveAngle,
    sourceReturnStudEndAngle,
    sourceReturnStudStartAngle,
    sourceScale,
    sourceStudOrbitRadius,
    sourceStudRadius,
    sourceUpperStud: sourceUpperStud.clone(),
    sourceUpperStudMapped,
    strokePeriod,
    studCenterZ,
    studDepth,
    studFrontZ,
    studOrbitRadius,
    studRadius,
    studRearZ,
  };
  root.userData.directContactRaw = directContactRaw;
  root.userData.inputContactAtAngle = inputContactAtAngle;
  root.userData.returnContactMotion = returnContactMotion;
  root.userData.stateAtStrokePhase = stateAtStrokePhase;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    diskRotor.rotation.z = -state.driverScreenAngle;
    slidingBar.position.x = state.bar.translation;
    lever.rotation.z = state.lever.worldAngle;
    for (const guide of guideRollers) {
      guide.userData.rotor.rotation.z = -state.bar.translation
        / guideRollerRadius;
      guide.userData.angularSpeed = -state.bar.velocityX
        / guideRollerRadius;
    }
    directContactMarker.visible = Boolean(state.directContactPoint);
    if (state.directContactPoint) {
      directContactMarker.position.copy(state.directContactPoint);
    }
    returnInputContactMarker.visible = Boolean(state.returnInputPoint);
    if (state.returnInputPoint) {
      returnInputContactMarker.position.copy(state.returnInputPoint);
    }
    returnOutputContactMarker.visible = Boolean(state.returnOutputPoint);
    if (state.returnOutputPoint) {
      returnOutputContactMarker.position.copy(state.returnOutputPoint);
    }
    disk.userData.angularSpeed = state.diskAngularSpeed;
    slidingBar.userData.velocity = state.bar.velocity.clone();
    slidingBar.userData.acceleration = state.bar.acceleration.clone();
    lever.userData.angularSpeed = state.lever.worldAngularSpeed;
    lever.userData.angularAcceleration =
      state.lever.worldAngularAcceleration;
    root.userData.contacts = {
      barGuide: {
        accelerationError: state.bar.guideAccelerationError,
        axis: X_AXIS.clone(),
        positionError: state.bar.guidePositionError,
        velocityError: state.bar.guideVelocityError,
      },
      directStudLug: state.directContact ? {
        contactMode: state.directContact.contactMode,
        contactPoint: state.directContactPoint.clone(),
        normalVelocityError: state.directNormalVelocityError,
        pointError: state.directContactPointError,
      } : null,
      guideRollers: guideRollers.map((guide) => ({
        angularSpeed: guide.userData.angularSpeed,
        axis: Z_AXIS.clone(),
        noSlipError: guide.userData.angularSpeed * guideRollerRadius
          + state.bar.velocityX,
      })),
      returnInput: state.returnContact ? {
        contactMode: state.returnContact.contactMode,
        distanceError: state.returnContact.inputDistanceError * sourceScale,
        pointError: state.returnInputPointError,
        station: state.returnContact.inputStation * sourceScale,
      } : null,
      returnOutput: state.returnContact ? {
        distanceError: state.returnContact.outputDistanceError * sourceScale,
        pointError: state.returnOutputPointError,
        station: state.returnContact.outputStation * sourceScale,
      } : null,
    };
    root.userData.kinematics = state;
  };
  update(0);

  root.userData.fidelity = 'authored';
  root.userData.cameraDistanceScale = 1.02;
  markShadows(root);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  for (const object of [
    cameraEnvelope,
    directContactMarker,
    returnInputContactMarker,
    returnOutputContactMarker,
    barMotionIndex,
    ...pinAssemblies.map(({ userData }) => userData.blocks.face),
    ...guideRollers.map(({ userData }) => userData.blocks.indexMark),
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }

  return {
    cameraDirection: new THREE.Vector3(8.0, 5.4, 12.2),
    root,
    update,
  };
}

function threeStudWeightedCordBellCrank() {
  const root = new THREE.Group();

  // Source measurements from Brown's engraving.  The three hand-drawn stud
  // centers are not perfectly concentric or 120 degrees apart, so the model
  // uses their mean orbit radius and fixes the phase at the explicitly drawn
  // stud/arm contact.  This preserves the physical stud and arm widths while
  // making the driver a rigid, uniform three-stud disk.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.014;
  const sourceDiskCenter = new THREE.Vector2(151, 315);
  const sourceDiskRadius = 120;
  const sourceStudCenters = [
    new THREE.Vector2(156, 207),
    new THREE.Vector2(244, 363),
    new THREE.Vector2(54, 355),
  ];
  const sourceStudOrbitRadius = sourceStudCenters.reduce(
    (sum, center) => sum + center.distanceTo(sourceDiskCenter),
    0,
  ) / sourceStudCenters.length;
  const sourceStudRadius = 11;
  const sourceHubRadius = 25;
  const sourceLeverPivot = new THREE.Vector2(345, 350);
  const sourceLeverInputEnd = new THREE.Vector2(220, 390);
  const sourceLeverOutputEnd = new THREE.Vector2(310, 235);
  const sourceInputArmHalfWidth = 7;
  const sourceOutputArmHalfWidth = 7;
  const sourceLeverPivotRadius = 20;
  const sourcePulleyCenter = new THREE.Vector2(434, 70);
  const sourcePulleyOuterRadius = 33;
  const sourcePulleyPitchRadius = 28;
  const sourcePulleyHubRadius = 13;
  const sourceWeightCenter = new THREE.Vector2(454, 355);
  const sourceWeightRadius = 36;
  const sourceWeightRopeAttachmentY = 315;
  const sourceBaseY = 457;

  const sourceInputArmVector = sourceLeverInputEnd.clone()
    .sub(sourceLeverPivot);
  const sourceOutputArmVector = sourceLeverOutputEnd.clone()
    .sub(sourceLeverPivot);
  const sourceInputArmLength = sourceInputArmVector.length();
  const sourceOutputArmLength = sourceOutputArmVector.length();
  const sourceLeverRestAngle = Math.atan2(
    sourceInputArmVector.y,
    sourceInputArmVector.x,
  );
  const sourceLeverOutputAngle = Math.atan2(
    sourceOutputArmVector.y,
    sourceOutputArmVector.x,
  );
  const sourceLeverIncludedAngle = positiveModulo(
    sourceLeverOutputAngle - sourceLeverRestAngle,
    FULL_TURN,
  );
  const sourceContactOffset = sourceStudRadius
    + sourceInputArmHalfWidth;
  const sourceStudPointAtAngle = (screenAngle) => new THREE.Vector2(
    sourceDiskCenter.x
      + sourceStudOrbitRadius * Math.cos(screenAngle),
    sourceDiskCenter.y
      + sourceStudOrbitRadius * Math.sin(screenAngle),
  );
  const sourceRestDirection = new THREE.Vector2(
    Math.cos(sourceLeverRestAngle),
    Math.sin(sourceLeverRestAngle),
  );
  const signedSideDistanceAtRest = (screenAngle) => {
    const relative = sourceStudPointAtAngle(screenAngle)
      .sub(sourceLeverPivot);
    return sourceRestDirection.x * relative.y
      - sourceRestDirection.y * relative.x;
  };
  const sourceContactStartAngle = bisectRoot(
    (angle) => signedSideDistanceAtRest(angle) - sourceContactOffset,
    0,
    Math.PI / 2,
  );
  const studPitchAngle = FULL_TURN / 3;
  const sourcePinBaseAngle = sourceContactStartAngle - studPitchAngle;

  const derivativeStep = 1e-4;
  const differentiateScalar = (fn, value) => {
    const lowerTwo = fn(value - 2 * derivativeStep);
    const lowerOne = fn(value - derivativeStep);
    const center = fn(value);
    const upperOne = fn(value + derivativeStep);
    const upperTwo = fn(value + 2 * derivativeStep);
    return {
      first: (
        lowerTwo - 8 * lowerOne + 8 * upperOne - upperTwo
      ) / (12 * derivativeStep),
      second: (
        -upperTwo + 16 * upperOne - 30 * center
          + 16 * lowerOne - lowerTwo
      ) / (12 * derivativeStep ** 2),
      value: center,
    };
  };

  const contactAtAngle = (screenAngle) => {
    const studCenter = sourceStudPointAtAngle(screenAngle);
    const relative = studCenter.clone().sub(sourceLeverPivot);
    const radialDistance = relative.length();
    const radialAngle = Math.atan2(relative.y, relative.x);
    const sideStation = Math.sqrt(Math.max(
      0,
      radialDistance ** 2 - sourceContactOffset ** 2,
    ));
    let contactMode;
    let contactStation;
    let leverAngle;
    if (sideStation <= sourceInputArmLength) {
      contactMode = 'disk-stud-on-straight-input-arm-flank';
      contactStation = sideStation;
      leverAngle = radialAngle - Math.asin(
        sourceContactOffset / radialDistance,
      );
    } else {
      contactMode = 'disk-stud-on-rounded-input-arm-tip';
      contactStation = sourceInputArmLength;
      const cosine = THREE.MathUtils.clamp(
        (
          radialDistance ** 2 + sourceInputArmLength ** 2
            - sourceContactOffset ** 2
        ) / (2 * radialDistance * sourceInputArmLength),
        -1,
        1,
      );
      leverAngle = radialAngle - Math.acos(cosine);
    }
    const direction = new THREE.Vector2(
      Math.cos(leverAngle),
      Math.sin(leverAngle),
    );
    const centerlineContact = sourceLeverPivot.clone()
      .addScaledVector(direction, contactStation);
    const contactNormal = studCenter.clone().sub(centerlineContact)
      .normalize();
    const armSurfacePoint = centerlineContact.clone()
      .addScaledVector(contactNormal, sourceInputArmHalfWidth);
    const pinSurfacePoint = studCenter.clone()
      .addScaledVector(contactNormal, -sourceStudRadius);
    return {
      armSurfacePoint,
      centerlineContact,
      contactMode,
      contactNormal,
      contactPoint: armSurfacePoint.clone().add(pinSurfacePoint)
        .multiplyScalar(0.5),
      contactStation,
      distanceError: studCenter.distanceTo(centerlineContact)
        - sourceContactOffset,
      direction,
      leverAngle,
      pinSurfacePoint,
      pointError: armSurfacePoint.distanceTo(pinSurfacePoint),
      radialDistance,
      sideStation,
      studCenter,
    };
  };

  const contactAngleFirst = (angle) => {
    const contact = contactAtAngle(angle);
    const relative = contact.studCenter.clone().sub(sourceLeverPivot);
    const relativeFirst = new THREE.Vector2(
      -sourceStudOrbitRadius * Math.sin(angle),
      sourceStudOrbitRadius * Math.cos(angle),
    );
    const radialDistanceFirst = relative.dot(relativeFirst)
      / contact.radialDistance;
    const radialAngleFirst = (
      relative.x * relativeFirst.y
        - relative.y * relativeFirst.x
    ) / contact.radialDistance ** 2;
    if (contact.contactMode
      === 'disk-stud-on-straight-input-arm-flank') {
      return radialAngleFirst + sourceContactOffset
        * radialDistanceFirst
        / (contact.radialDistance * contact.sideStation);
    }
    const cosine = THREE.MathUtils.clamp(
      (
        contact.radialDistance ** 2 + sourceInputArmLength ** 2
          - sourceContactOffset ** 2
      ) / (
        2 * contact.radialDistance * sourceInputArmLength
      ),
      -1,
      1,
    );
    const cosineDistanceFirst = 1 / (2 * sourceInputArmLength)
      - (
        sourceInputArmLength ** 2 - sourceContactOffset ** 2
      ) / (
        2 * sourceInputArmLength * contact.radialDistance ** 2
      );
    return radialAngleFirst + cosineDistanceFirst
      * radialDistanceFirst / Math.sqrt(Math.max(1e-15, 1 - cosine ** 2));
  };
  const contactAngleSecond = (angle) => differentiateScalar(
    contactAngleFirst,
    angle,
  ).first;

  const sourceTipTransitionAngle = bisectRoot(
    (angle) => contactAtAngle(angle).sideStation
      - sourceInputArmLength,
    sourceContactStartAngle,
    sourceContactStartAngle + 0.65,
  );
  const sourceDriveEndAngle = bisectRoot(
    contactAngleFirst,
    sourceTipTransitionAngle + 1e-4,
    sourceTipTransitionAngle + 0.12,
  );
  const sourceLeverDrivenAngle = contactAtAngle(
    sourceDriveEndAngle,
  ).leverAngle;
  const sourceReturnStartAngle = sourceDriveEndAngle + 0.10;
  const sourceReturnEndAngle = sourceDriveEndAngle + 0.82;
  const sourceNextContactAngle = sourceContactStartAngle + studPitchAngle;

  const sourceToWorld = (point, z = 0) => new THREE.Vector3(
    (point.x - sourceDiskCenter.x) * sourceScale,
    (sourceDiskCenter.y - point.y) * sourceScale,
    z,
  );
  const worldToSource = (point) => new THREE.Vector2(
    sourceDiskCenter.x + point.x / sourceScale,
    sourceDiskCenter.y - point.y / sourceScale,
  );

  const cordFixedGeometryAtLeverAngle = (leverAngle) => {
    const outputAngle = leverAngle + sourceLeverIncludedAngle;
    const leverAttachment = sourceLeverPivot.clone().add(
      new THREE.Vector2(
        Math.cos(outputAngle) * sourceOutputArmLength,
        Math.sin(outputAngle) * sourceOutputArmLength,
      ),
    );
    const centerToAttachment = leverAttachment.clone()
      .sub(sourcePulleyCenter);
    const centerDistance = centerToAttachment.length();
    const tangentScale = sourcePulleyPitchRadius ** 2
      / centerDistance ** 2;
    const tangentPerpendicularScale = sourcePulleyPitchRadius
      * Math.sqrt(
        centerDistance ** 2 - sourcePulleyPitchRadius ** 2,
      ) / centerDistance ** 2;
    const incomingTangent = sourcePulleyCenter.clone()
      .addScaledVector(centerToAttachment, tangentScale)
      .addScaledVector(
        new THREE.Vector2(
          -centerToAttachment.y,
          centerToAttachment.x,
        ),
        tangentPerpendicularScale,
      );
    const incomingTangentAngle = positiveModulo(Math.atan2(
      incomingTangent.y - sourcePulleyCenter.y,
      incomingTangent.x - sourcePulleyCenter.x,
    ), FULL_TURN);
    const wrapAngle = FULL_TURN - incomingTangentAngle;
    const incomingLength = Math.sqrt(
      centerDistance ** 2 - sourcePulleyPitchRadius ** 2,
    );
    const wrapLength = sourcePulleyPitchRadius * wrapAngle;
    return {
      centerDistance,
      incomingLength,
      incomingTangent,
      incomingTangentAngle,
      leverAttachment,
      outputAngle,
      rightTangent: new THREE.Vector2(
        sourcePulleyCenter.x + sourcePulleyPitchRadius,
        sourcePulleyCenter.y,
      ),
      variableLength: incomingLength + wrapLength,
      wrapAngle,
      wrapLength,
    };
  };
  const sourceRestCordFixed = cordFixedGeometryAtLeverAngle(
    sourceLeverRestAngle,
  );
  const sourceCordTotalLength = sourceRestCordFixed.variableLength
    + sourceWeightRopeAttachmentY - sourcePulleyCenter.y;
  const sourceWeightCenterOffsetY = sourceWeightCenter.y
    - sourceWeightRopeAttachmentY;
  const cordGeometryAtLeverAngle = (leverAngle) => {
    const fixed = cordFixedGeometryAtLeverAngle(leverAngle);
    const verticalLength = sourceCordTotalLength - fixed.variableLength;
    const weightAttachment = new THREE.Vector2(
      fixed.rightTangent.x,
      sourcePulleyCenter.y + verticalLength,
    );
    const weightCenter = new THREE.Vector2(
      weightAttachment.x,
      weightAttachment.y + sourceWeightCenterOffsetY,
    );
    return {
      ...fixed,
      lengthError: fixed.variableLength + verticalLength
        - sourceCordTotalLength,
      totalLength: sourceCordTotalLength,
      verticalLength,
      weightAttachment,
      weightCenter,
    };
  };
  const sourceRestCord = cordGeometryAtLeverAngle(
    sourceLeverRestAngle,
  );
  const sourceDrivenCord = cordGeometryAtLeverAngle(
    sourceLeverDrivenAngle,
  );

  const diskPeriod = 12;
  const strokePeriod = diskPeriod / 3;
  const diskScreenAngularSpeed = FULL_TURN / diskPeriod;
  const timeAtActiveAngle = (angle) => (
    angle - sourceContactStartAngle
  ) / diskScreenAngularSpeed;

  const diskRadius = sourceDiskRadius * sourceScale;
  const studOrbitRadius = sourceStudOrbitRadius * sourceScale;
  const studRadius = sourceStudRadius * sourceScale;
  const hubRadius = sourceHubRadius * sourceScale;
  const inputArmLength = sourceInputArmLength * sourceScale;
  const outputArmLength = sourceOutputArmLength * sourceScale;
  const inputArmHalfWidth = sourceInputArmHalfWidth * sourceScale;
  const outputArmHalfWidth = sourceOutputArmHalfWidth * sourceScale;
  const leverPivotRadius = sourceLeverPivotRadius * sourceScale;
  const pulleyOuterRadius = sourcePulleyOuterRadius * sourceScale;
  const pulleyPitchRadius = sourcePulleyPitchRadius * sourceScale;
  const pulleyHubRadius = sourcePulleyHubRadius * sourceScale;
  const weightRadius = sourceWeightRadius * sourceScale;
  const diskDepth = 0.30;
  const diskPlaneZ = -0.02;
  const leverDepth = 0.20;
  const leverPlaneZ = 0.46;
  const studRearZ = -0.14;
  const studFrontZ = 0.63;
  const studDepth = studFrontZ - studRearZ;
  const studCenterZ = (studFrontZ + studRearZ) / 2;
  const cordPlaneZ = 0.72;
  const cordRadius = 0.036;
  const contactMarkerZ = 0.70;
  const leverPivot = sourceToWorld(sourceLeverPivot, leverPlaneZ);
  const pulleyCenter = sourceToWorld(sourcePulleyCenter, cordPlaneZ);

  const pinStateAtScreenAngle = (screenAngle, index) => ({
    acceleration: new THREE.Vector3(
      -studOrbitRadius * Math.cos(screenAngle)
        * diskScreenAngularSpeed ** 2,
      studOrbitRadius * Math.sin(screenAngle)
        * diskScreenAngularSpeed ** 2,
      0,
    ),
    index,
    position: new THREE.Vector3(
      studOrbitRadius * Math.cos(screenAngle),
      -studOrbitRadius * Math.sin(screenAngle),
      studCenterZ,
    ),
    screenAngle,
    sourcePosition: sourceStudPointAtAngle(screenAngle),
    velocity: new THREE.Vector3(
      -studOrbitRadius * Math.sin(screenAngle)
        * diskScreenAngularSpeed,
      -studOrbitRadius * Math.cos(screenAngle)
        * diskScreenAngularSpeed,
      0,
    ),
  });

  const capsuleDistance = (point, leverAngle) => {
    const relative = point.clone().sub(sourceLeverPivot);
    const direction = new THREE.Vector2(
      Math.cos(leverAngle),
      Math.sin(leverAngle),
    );
    const station = THREE.MathUtils.clamp(
      relative.dot(direction),
      0,
      sourceInputArmLength,
    );
    return relative.addScaledVector(direction, -station).length();
  };

  const stateAtTime = (time) => {
    const cycleIndex = Math.floor(time / strokePeriod);
    const cycleTime = time - cycleIndex * strokePeriod;
    const activeScreenAngle = sourceContactStartAngle
      + diskScreenAngularSpeed * cycleTime;
    const driverScreenAngle = sourcePinBaseAngle
      + diskScreenAngularSpeed * time;
    const activePinIndex = positiveModulo(1 - cycleIndex, 3);
    let contact = null;
    let leverAngle = sourceLeverRestAngle;
    let leverAngularAcceleration = 0;
    let leverAngularSpeed = 0;
    let stage;
    if (activeScreenAngle <= sourceTipTransitionAngle) {
      contact = contactAtAngle(activeScreenAngle);
      leverAngle = contact.leverAngle;
      leverAngularSpeed = contactAngleFirst(activeScreenAngle)
        * diskScreenAngularSpeed;
      leverAngularAcceleration = contactAngleSecond(activeScreenAngle)
        * diskScreenAngularSpeed ** 2;
      stage = 'stud-sliding-along-straight-bell-crank-arm';
    } else if (activeScreenAngle <= sourceDriveEndAngle) {
      contact = contactAtAngle(activeScreenAngle);
      leverAngle = contact.leverAngle;
      leverAngularSpeed = contactAngleFirst(activeScreenAngle)
        * diskScreenAngularSpeed;
      leverAngularAcceleration = contactAngleSecond(activeScreenAngle)
        * diskScreenAngularSpeed ** 2;
      stage = 'stud-rolling-around-rounded-bell-crank-tip';
    } else if (activeScreenAngle < sourceReturnStartAngle) {
      leverAngle = sourceLeverDrivenAngle;
      stage = 'weighted-load-at-upper-turning-dwell';
    } else if (activeScreenAngle < sourceReturnEndAngle) {
      const span = sourceReturnEndAngle - sourceReturnStartAngle;
      const progress = (
        activeScreenAngle - sourceReturnStartAngle
      ) / span;
      const angleTravel = sourceLeverRestAngle
        - sourceLeverDrivenAngle;
      leverAngle = sourceLeverDrivenAngle
        + angleTravel * quinticStep(progress);
      leverAngularSpeed = angleTravel * quinticStepFirst(progress)
        / span * diskScreenAngularSpeed;
      leverAngularAcceleration = angleTravel * quinticStepSecond(progress)
        / span ** 2 * diskScreenAngularSpeed ** 2;
      stage = 'hanging-weight-returning-bell-crank';
    } else {
      stage = 'weighted-load-at-lower-rest-before-next-stud';
    }

    const pinScreenAngles = [0, 1, 2].map((index) => (
      driverScreenAngle + index * studPitchAngle
    ));
    const pinStates = pinScreenAngles.map(pinStateAtScreenAngle);
    const activePin = pinStates[activePinIndex];
    const cord = cordGeometryAtLeverAngle(leverAngle);
    const weightDerivatives = differentiateScalar(
      (angle) => cordGeometryAtLeverAngle(angle).weightCenter.y,
      leverAngle,
    );
    const weightSourceVelocityY = weightDerivatives.first
      * leverAngularSpeed;
    const weightSourceAccelerationY = weightDerivatives.second
        * leverAngularSpeed ** 2
      + weightDerivatives.first * leverAngularAcceleration;
    const weightCenter = sourceToWorld(cord.weightCenter, cordPlaneZ);
    const weightAttachment = sourceToWorld(
      cord.weightAttachment,
      cordPlaneZ,
    );
    const weightVelocityY = -weightSourceVelocityY * sourceScale;
    const weightAccelerationY = -weightSourceAccelerationY * sourceScale;
    const weightLift = (
      sourceRestCord.weightCenter.y - cord.weightCenter.y
    ) * sourceScale;
    const pulleyAngle = weightLift / pulleyPitchRadius;
    const pulleyAngularSpeed = weightVelocityY / pulleyPitchRadius;
    const pulleyAngularAcceleration = weightAccelerationY
      / pulleyPitchRadius;
    let contactPoint = null;
    let contactNormalVelocityError = 0;
    if (contact) {
      contactPoint = sourceToWorld(contact.contactPoint, contactMarkerZ);
      const armRelative = contact.armSurfacePoint.clone()
        .sub(sourceLeverPivot);
      const armVelocity = new THREE.Vector2(
        -armRelative.y * leverAngularSpeed,
        armRelative.x * leverAngularSpeed,
      );
      const pinVelocity = new THREE.Vector2(
        -sourceStudOrbitRadius * Math.sin(activeScreenAngle)
          * diskScreenAngularSpeed,
        sourceStudOrbitRadius * Math.cos(activeScreenAngle)
          * diskScreenAngularSpeed,
      );
      contactNormalVelocityError = armVelocity.sub(pinVelocity)
        .dot(contact.contactNormal) * sourceScale;
    }
    const pinClearancesPixels = pinStates.map((pin) => (
      capsuleDistance(pin.sourcePosition, leverAngle)
    ));

    return {
      activePin,
      activePinIndex,
      activeScreenAngle,
      contact,
      contactNormalVelocityError,
      contactPoint,
      cord: {
        ...cord,
        incomingLength: cord.incomingLength * sourceScale,
        incomingTangentWorld: sourceToWorld(
          cord.incomingTangent,
          cordPlaneZ,
        ),
        lengthError: cord.lengthError * sourceScale,
        leverAttachmentWorld: sourceToWorld(
          cord.leverAttachment,
          cordPlaneZ,
        ),
        rightTangentWorld: sourceToWorld(
          cord.rightTangent,
          cordPlaneZ,
        ),
        totalLength: cord.totalLength * sourceScale,
        verticalLength: cord.verticalLength * sourceScale,
        wrapLength: cord.wrapLength * sourceScale,
      },
      cycleIndex,
      diskAngularAcceleration: 0,
      diskAngularSpeed: -diskScreenAngularSpeed,
      diskPhase: positiveModulo(time, diskPeriod) / diskPeriod,
      driverScreenAngle,
      lever: {
        angle: leverAngle,
        angularAcceleration: leverAngularAcceleration,
        angularSpeed: leverAngularSpeed,
        worldAngle: -leverAngle,
        worldAngularAcceleration: -leverAngularAcceleration,
        worldAngularSpeed: -leverAngularSpeed,
      },
      minimumStudClearancePixels: Math.min(...pinClearancesPixels),
      pinClearancesPixels,
      pinStates,
      pulley: {
        angle: pulleyAngle,
        angularAcceleration: pulleyAngularAcceleration,
        angularSpeed: pulleyAngularSpeed,
      },
      stage,
      strokePhase: cycleTime / strokePeriod,
      time,
      weight: {
        acceleration: new THREE.Vector3(0, weightAccelerationY, 0),
        accelerationY: weightAccelerationY,
        attachment: weightAttachment,
        center: weightCenter,
        lift: weightLift,
        sourceCenter: cord.weightCenter.clone(),
        velocity: new THREE.Vector3(0, weightVelocityY, 0),
        velocityY: weightVelocityY,
      },
    };
  };

  const stateAtStrokePhase = (phase) => stateAtTime(
    phase * strokePeriod,
  );
  const canonicalTimes = {
    lowerRest: timeAtActiveAngle(sourceReturnEndAngle),
    nextSource: strokePeriod,
    returnMid: timeAtActiveAngle(
      (sourceReturnStartAngle + sourceReturnEndAngle) / 2,
    ),
    returnStart: timeAtActiveAngle(sourceReturnStartAngle),
    sideMid: timeAtActiveAngle(
      (sourceContactStartAngle + sourceTipTransitionAngle) / 2,
    ),
    source: 0,
    tipContact: timeAtActiveAngle(
      (sourceTipTransitionAngle + sourceDriveEndAngle) / 2,
    ),
    tipTransition: timeAtActiveAngle(sourceTipTransitionAngle),
    upperTurn: timeAtActiveAngle(sourceDriveEndAngle),
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => (
      [name, stateAtTime(time)]
    )),
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.62,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.64,
  });
  const leverMaterial = matte(PALETTE.accent, {
    metalness: 0.10,
    roughness: 0.62,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.18,
    roughness: 0.56,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const disk = new THREE.Group();
  disk.userData.role = 'uniformly-rotating-three-stud-driver-disk';
  disk.userData.axis = Z_AXIS.clone();
  const diskRotor = new THREE.Group();
  const diskBody = cylinderAlongZ(
    diskRadius,
    diskDepth,
    driverMaterial,
    72,
  );
  diskBody.position.z = diskPlaneZ;
  diskBody.userData.role = 'solid-source-proportioned-driver-disk';
  const diskRim = ringInXY(
    diskRadius * 0.985,
    0.040,
    darkMaterial,
    72,
  );
  diskRim.position.z = diskPlaneZ + diskDepth / 2 + 0.018;
  const diskHub = cylinderAlongZ(hubRadius, 0.48, darkMaterial, 42);
  diskHub.position.z = 0.03;
  const diskHubFace = cylinderAlongZ(
    hubRadius * 0.48,
    0.036,
    whiteMaterial,
    36,
  );
  diskHubFace.position.z = 0.29;
  const pinAssemblies = [0, 1, 2].map((index) => {
    const screenAngle = sourcePinBaseAngle + index * studPitchAngle;
    const assembly = new THREE.Group();
    assembly.position.set(
      studOrbitRadius * Math.cos(screenAngle),
      -studOrbitRadius * Math.sin(screenAngle),
      0,
    );
    assembly.userData.index = index;
    assembly.userData.role = 'disk-fixed-striking-stud';
    const pin = cylinderAlongZ(studRadius, studDepth, darkMaterial, 36);
    pin.position.z = studCenterZ;
    const face = cylinderAlongZ(
      studRadius * 0.72,
      0.040,
      whiteMaterial,
      32,
    );
    face.position.z = studFrontZ + 0.022;
    assembly.add(pin, face);
    assembly.userData.blocks = { face, pin };
    return assembly;
  });
  diskRotor.add(
    diskBody,
    diskRim,
    diskHub,
    diskHubFace,
    ...pinAssemblies,
  );
  disk.add(diskRotor);
  disk.userData.rotor = diskRotor;

  const lever = new THREE.Group();
  lever.position.copy(leverPivot);
  lever.userData.axis = Z_AXIS.clone();
  lever.userData.role = 'fixed-pivot-stud-driven-weight-return-bell-crank';
  const inputArm = roundedArm({
    depth: leverDepth,
    halfWidth: inputArmHalfWidth,
    length: inputArmLength,
    material: leverMaterial,
    role: 'three-stud-driven-lower-input-arm',
  });
  const outputArm = roundedArm({
    angle: -sourceLeverIncludedAngle,
    depth: leverDepth,
    halfWidth: outputArmHalfWidth,
    length: outputArmLength,
    material: leverMaterial,
    role: 'weighted-cord-attached-upper-output-arm',
  });
  const leverPivotCollar = cylinderAlongZ(
    leverPivotRadius,
    0.36,
    darkMaterial,
    40,
  );
  const leverPivotFace = cylinderAlongZ(
    leverPivotRadius * 0.52,
    0.035,
    whiteMaterial,
    32,
  );
  leverPivotFace.position.z = 0.215;
  const outputEye = ringInXY(0.13, 0.035, darkMaterial, 32);
  outputEye.position.set(outputArmLength, 0, cordPlaneZ - leverPlaneZ);
  outputEye.userData.role = 'moving-cord-attachment-eye';
  outputArm.add(outputEye);
  lever.add(
    inputArm,
    outputArm,
    leverPivotCollar,
    leverPivotFace,
  );

  const pulley = new THREE.Group();
  pulley.position.copy(sourceToWorld(sourcePulleyCenter, 0));
  pulley.userData.axis = Z_AXIS.clone();
  pulley.userData.role = 'fixed-center-cord-guide-pulley';
  const pulleyRotor = new THREE.Group();
  const pulleyCore = cylinderAlongZ(
    pulleyPitchRadius * 0.92,
    0.19,
    drivenMaterial,
    48,
  );
  pulleyCore.position.z = cordPlaneZ;
  const pulleyRearFlange = cylinderAlongZ(
    pulleyOuterRadius,
    0.055,
    drivenMaterial,
    52,
  );
  pulleyRearFlange.position.z = cordPlaneZ - 0.12;
  const pulleyFrontFlange = cylinderAlongZ(
    pulleyOuterRadius,
    0.055,
    drivenMaterial,
    52,
  );
  pulleyFrontFlange.position.z = cordPlaneZ + 0.12;
  const pulleyHub = cylinderAlongZ(
    pulleyHubRadius,
    0.36,
    darkMaterial,
    36,
  );
  pulleyHub.position.z = cordPlaneZ;
  const pulleyIndex = new THREE.Mesh(
    new THREE.BoxGeometry(pulleyOuterRadius * 0.70, 0.055, 0.024),
    whiteMaterial,
  );
  pulleyIndex.position.set(
    pulleyOuterRadius * 0.48,
    0,
    cordPlaneZ + 0.165,
  );
  pulleyIndex.userData.role = 'visible-pulley-rotation-index';
  pulleyRotor.add(
    pulleyCore,
    pulleyRearFlange,
    pulleyFrontFlange,
    pulleyHub,
    pulleyIndex,
  );
  pulley.add(pulleyRotor);
  pulley.userData.rotor = pulleyRotor;

  const weight = new THREE.Group();
  weight.userData.role = 'vertically-reciprocating-hanging-weight';
  const weightBody = new THREE.Mesh(
    new THREE.SphereGeometry(weightRadius, 40, 28),
    drivenMaterial,
  );
  weightBody.userData.role = 'solid-hanging-return-weight';
  const weightEye = ringInXY(0.19, 0.045, darkMaterial, 36);
  weightEye.position.y = weightRadius + 0.12;
  weightEye.userData.role = 'weight-cord-shackle';
  weight.add(weightBody, weightEye);

  const cord = new THREE.Mesh(
    new THREE.BufferGeometry(),
    darkMaterial,
  );
  cord.userData.role = 'one-continuous-inextensible-weighted-cord';
  cord.userData.isCord = true;

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-rear-frame-and-three-axles';
  const baseStart = sourceToWorld(new THREE.Vector2(20, sourceBaseY));
  const baseEnd = sourceToWorld(new THREE.Vector2(505, sourceBaseY));
  const frameZ = -0.46;
  const baseRail = fixedBeam2D(
    new THREE.Vector2(baseStart.x, baseStart.y),
    new THREE.Vector2(baseEnd.x, baseEnd.y),
    0.18,
    0.28,
    frameZ,
    frameMaterial,
    'fixed-ground-base-rail',
  );
  const diskPostBottom = sourceToWorld(
    new THREE.Vector2(sourceDiskCenter.x, sourceBaseY),
  );
  const diskPostTop = sourceToWorld(sourceDiskCenter);
  const diskPost = fixedBeam2D(
    new THREE.Vector2(diskPostBottom.x, diskPostBottom.y),
    new THREE.Vector2(diskPostTop.x, diskPostTop.y),
    0.72,
    0.28,
    frameZ,
    frameMaterial,
    'fixed-disk-bearing-pedestal',
  );
  const leverPostBottom = sourceToWorld(
    new THREE.Vector2(sourceLeverPivot.x, sourceBaseY),
  );
  const leverPost = fixedBeam2D(
    new THREE.Vector2(leverPostBottom.x, leverPostBottom.y),
    new THREE.Vector2(leverPivot.x, leverPivot.y),
    0.34,
    0.26,
    frameZ,
    frameMaterial,
    'fixed-bell-crank-bearing-post',
  );
  const pulleySupportX = sourceToWorld(
    new THREE.Vector2(500, sourcePulleyCenter.y),
  ).x;
  const pulleyPostBottom = sourceToWorld(
    new THREE.Vector2(500, sourceBaseY),
  );
  const pulleyPostTop = sourceToWorld(
    new THREE.Vector2(500, sourcePulleyCenter.y),
  );
  const pulleyPost = fixedBeam2D(
    new THREE.Vector2(pulleyPostBottom.x, pulleyPostBottom.y),
    new THREE.Vector2(pulleyPostTop.x, pulleyPostTop.y),
    0.15,
    0.22,
    frameZ,
    frameMaterial,
    'fixed-rear-pulley-support-post',
  );
  const pulleyBearingArm = fixedBeam2D(
    new THREE.Vector2(pulleyCenter.x, pulleyCenter.y),
    new THREE.Vector2(pulleySupportX, pulleyCenter.y),
    0.15,
    0.22,
    frameZ,
    frameMaterial,
    'fixed-rear-pulley-bearing-arm',
  );
  const diskAxle = cylinderAlongZ(0.13, 1.05, darkMaterial, 32);
  diskAxle.position.set(0, 0, 0.02);
  diskAxle.userData.role = 'fixed-axis-driver-disk-shaft';
  const leverAxle = cylinderAlongZ(0.11, 1.32, darkMaterial, 32);
  leverAxle.position.copy(leverPivot);
  leverAxle.position.z = 0.10;
  leverAxle.userData.role = 'fixed-axis-bell-crank-shaft';
  const pulleyAxle = cylinderAlongZ(0.10, 1.20, darkMaterial, 32);
  pulleyAxle.position.copy(pulleyCenter);
  pulleyAxle.position.z = 0.18;
  pulleyAxle.userData.role = 'fixed-axis-cord-pulley-shaft';
  fixedFrame.add(
    baseRail,
    diskPost,
    leverPost,
    pulleyPost,
    pulleyBearingArm,
    diskAxle,
    leverAxle,
    pulleyAxle,
  );

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 20, 14),
    whiteMaterial,
  );
  contactMarker.userData.role = 'visible-stud-bell-crank-contact';
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.8, 6.4, 2.6),
    new THREE.MeshBasicMaterial({
      color: PALETTE.paper,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(1.55, 0.76, 0.28);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-complete-weight-and-lever-sweep-envelope';

  root.add(
    cameraEnvelope,
    fixedFrame,
    disk,
    lever,
    pulley,
    weight,
    cord,
    contactMarker,
  );

  const makeCordCurve = (cordState) => {
    const totalLength = cordState.totalLength / sourceScale;
    const incomingLength = cordState.incomingLength / sourceScale;
    const wrapLength = cordState.wrapLength / sourceScale;
    const verticalLength = cordState.verticalLength / sourceScale;
    const sourcePointAt = (progress) => {
      const distance = THREE.MathUtils.clamp(progress, 0, 1)
        * totalLength;
      if (distance <= incomingLength) {
        return cordState.leverAttachment.clone().lerp(
          cordState.incomingTangent,
          incomingLength > 0 ? distance / incomingLength : 0,
        );
      }
      if (distance <= incomingLength + wrapLength) {
        const arcDistance = distance - incomingLength;
        const angle = cordState.incomingTangentAngle
          + arcDistance / sourcePulleyPitchRadius;
        return new THREE.Vector2(
          sourcePulleyCenter.x
            + sourcePulleyPitchRadius * Math.cos(angle),
          sourcePulleyCenter.y
            + sourcePulleyPitchRadius * Math.sin(angle),
        );
      }
      const verticalDistance = distance - incomingLength - wrapLength;
      return new THREE.Vector2(
        cordState.rightTangent.x,
        cordState.rightTangent.y + Math.min(
          verticalDistance,
          verticalLength,
        ),
      );
    };
    const sourceTangentAt = (progress) => {
      const distance = THREE.MathUtils.clamp(progress, 0, 1)
        * totalLength;
      if (distance < incomingLength) {
        return cordState.incomingTangent.clone()
          .sub(cordState.leverAttachment)
          .normalize();
      }
      if (distance < incomingLength + wrapLength) {
        const angle = cordState.incomingTangentAngle
          + (distance - incomingLength) / sourcePulleyPitchRadius;
        return new THREE.Vector2(-Math.sin(angle), Math.cos(angle));
      }
      return new THREE.Vector2(0, 1);
    };
    const curve = new THREE.Curve();
    curve.arcLengthDivisions = 180;
    curve.getPoint = (progress, target = new THREE.Vector3()) => {
      const sourcePoint = sourcePointAt(progress);
      return target.set(
        (sourcePoint.x - sourceDiskCenter.x) * sourceScale,
        (sourceDiskCenter.y - sourcePoint.y) * sourceScale,
        cordPlaneZ,
      );
    };
    curve.getPointAt = curve.getPoint;
    curve.getTangent = (progress, target = new THREE.Vector3()) => {
      const sourceTangent = sourceTangentAt(progress);
      return target.set(
        sourceTangent.x,
        -sourceTangent.y,
        0,
      ).normalize();
    };
    curve.getTangentAt = curve.getTangent;
    return curve;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    diskRotor.rotation.z = -diskScreenAngularSpeed * time;
    disk.userData.angularSpeed = state.diskAngularSpeed;
    lever.rotation.z = state.lever.worldAngle;
    lever.userData.angularSpeed = state.lever.worldAngularSpeed;
    weight.position.copy(state.weight.center);
    weight.userData.velocity = state.weight.velocity.clone();
    pulleyRotor.rotation.z = state.pulley.angle;
    pulley.userData.angularSpeed = state.pulley.angularSpeed;
    const nextCordGeometry = new THREE.TubeGeometry(
      makeCordCurve(state.cord),
      180,
      cordRadius,
      10,
      false,
    );
    cord.geometry.dispose();
    cord.geometry = nextCordGeometry;
    cord.userData.length = state.cord.totalLength;
    cord.userData.lengthError = state.cord.lengthError;
    cord.userData.materialSpeed = state.weight.velocityY;
    contactMarker.visible = Boolean(state.contactPoint);
    if (state.contactPoint) contactMarker.position.copy(state.contactPoint);
    root.userData.contact = state.contact ? {
      distanceError: state.contact.distanceError * sourceScale,
      mode: state.contact.contactMode,
      normalVelocityError: state.contactNormalVelocityError,
      pointError: state.contact.pointError * sourceScale,
      station: state.contact.contactStation * sourceScale,
    } : null;
    root.userData.kinematics = state;
  };

  const sourceMappedStudCenters = [0, 1, 2].map((index) => (
    sourceStudPointAtAngle(sourcePinBaseAngle + index * studPitchAngle)
  ));
  const sourceMappedInputEnd = sourceLeverPivot.clone().add(
    new THREE.Vector2(
      Math.cos(sourceLeverRestAngle) * sourceInputArmLength,
      Math.sin(sourceLeverRestAngle) * sourceInputArmLength,
    ),
  );
  const sourceMappedOutputEnd = sourceLeverPivot.clone().add(
    new THREE.Vector2(
      Math.cos(sourceLeverRestAngle + sourceLeverIncludedAngle)
        * sourceOutputArmLength,
      Math.sin(sourceLeverRestAngle + sourceLeverIncludedAngle)
        * sourceOutputArmLength,
    ),
  );

  root.userData.mechanism =
    'three-stud-disk-weighted-cord-bell-crank-reciprocator';
  root.userData.blocks = {
    baseRail,
    cameraEnvelope,
    contactMarker,
    cord,
    disk,
    diskAxle,
    diskBody,
    diskHub,
    diskHubFace,
    diskPost,
    diskRim,
    diskRotor,
    fixedFrame,
    inputArm,
    lever,
    leverAxle,
    leverPivotCollar,
    leverPivotFace,
    leverPost,
    outputArm,
    outputEye,
    pinAssemblies,
    pulley,
    pulleyAxle,
    pulleyBearingArm,
    pulleyCore,
    pulleyFrontFlange,
    pulleyHub,
    pulleyIndex,
    pulleyPost,
    pulleyRearFlange,
    pulleyRotor,
    weight,
    weightBody,
    weightEye,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contactAtAngle = contactAtAngle;
  root.userData.cordGeometryAtLeverAngle = cordGeometryAtLeverAngle;
  root.userData.stateAtStrokePhase = stateAtStrokePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    contactMarkerZ,
    cordPlaneZ,
    cordRadius,
    derivativeStep,
    diskDepth,
    diskPeriod,
    diskPlaneZ,
    diskRadius,
    diskScreenAngularSpeed,
    hubRadius,
    inputArmHalfWidth,
    inputArmLength,
    leverDepth,
    leverIncludedAngle: sourceLeverIncludedAngle,
    leverPivot: leverPivot.clone(),
    leverPivotRadius,
    outputArmHalfWidth,
    outputArmLength,
    pulleyCenter: pulleyCenter.clone(),
    pulleyHubRadius,
    pulleyOuterRadius,
    pulleyPitchRadius,
    sourceBaseY,
    sourceContactOffset,
    sourceContactStartAngle,
    sourceCordTotalLength,
    sourceDiskCenter: sourceDiskCenter.clone(),
    sourceDiskRadius,
    sourceDriveEndAngle,
    sourceDrivenCord,
    sourceImageHeight,
    sourceImageWidth,
    sourceInputArmHalfWidth,
    sourceInputArmLength,
    sourceLeverDrivenAngle,
    sourceLeverIncludedAngle,
    sourceLeverInputEnd: sourceLeverInputEnd.clone(),
    sourceLeverOutputEnd: sourceLeverOutputEnd.clone(),
    sourceLeverPivot: sourceLeverPivot.clone(),
    sourceLeverPivotRadius,
    sourceLeverRestAngle,
    sourceMappedInputEnd,
    sourceMappedOutputEnd,
    sourceMappedStudCenters,
    sourceNextContactAngle,
    sourceOutputArmHalfWidth,
    sourceOutputArmLength,
    sourcePinBaseAngle,
    sourcePulleyCenter: sourcePulleyCenter.clone(),
    sourcePulleyHubRadius,
    sourcePulleyOuterRadius,
    sourcePulleyPitchRadius,
    sourceRestCord,
    sourceReturnEndAngle,
    sourceReturnStartAngle,
    sourceScale,
    sourceStudCenters: sourceStudCenters.map((center) => center.clone()),
    sourceStudOrbitRadius,
    sourceStudRadius,
    sourceTipTransitionAngle,
    sourceWeightCenter: sourceWeightCenter.clone(),
    sourceWeightRadius,
    sourceWeightRopeAttachmentY,
    strokePeriod,
    studDepth,
    studFrontZ,
    studOrbitRadius,
    studPitchAngle,
    studRadius,
    studRearZ,
    weightRadius,
    worldToSource,
  };
  update(0);

  root.userData.fidelity = 'authored';
  root.userData.cameraDistanceScale = 1.01;
  markShadows(root);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  for (const object of [
    cameraEnvelope,
    contactMarker,
    diskHubFace,
    leverPivotFace,
    pulleyIndex,
    ...pinAssemblies.map(({ userData }) => userData.blocks.face),
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }

  return {
    cameraDirection: new THREE.Vector3(8.4, 5.6, 12.8),
    root,
    update,
  };
}

export function createAuthoredStudDriveMovement(movement) {
  switch (movement.id) {
    case 153: return studDiskElbowBarReverser();
    case 154: return threeStudWeightedCordBellCrank();
    default: return null;
  }
}
