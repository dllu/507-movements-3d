import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { plate, poly, circle, polygonClipping } from './finite-plate-geometry.js';
import { helicalThread, threadAngles, chamferedHex } from './mujoco-screw/thread-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function smootherStep01(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t ** 3 * (t * (t * 6 - 15) + 10);
}

function smootherStepFirstDerivative(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * t ** 2 * (t - 1) ** 2;
}

function smootherStepSecondDerivative(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * t * (t - 1) * (2 * t - 1);
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function rotateVector2(vector, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    vector.x * cosine - vector.y * sine,
    vector.x * sine + vector.y * cosine,
  );
}

function sourceProfileGeometry({
  boreRadius,
  depth,
  pivot,
  sourcePoints,
  sourceScale,
}) {
  const localPoints = sourcePoints.map((point) => new THREE.Vector2(
    (point.x - pivot.x) * sourceScale,
    (pivot.y - point.y) * sourceScale,
  ));
  const profileCurve = new THREE.CatmullRomCurve3(
    localPoints.map((point) => new THREE.Vector3(point.x, point.y, 0)),
    true,
    'centripetal',
  );
  const profileSampleCount = 192;
  const sampledPoints = profileCurve.getSpacedPoints(profileSampleCount);
  const shape = new THREE.Shape();
  sampledPoints.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  });
  shape.closePath();
  const pivotHole = new THREE.Path();
  pivotHole.absarc(0, 0, boreRadius, 0, FULL_TURN, true);
  shape.holes.push(pivotHole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.018,
    bevelThickness: 0.018,
    curveSegments: 4,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  const outlineCurve = new THREE.CatmullRomCurve3(
    localPoints.map((point) => new THREE.Vector3(
      point.x,
      point.y,
      depth / 2 + 0.024,
    )),
    true,
    'centripetal',
  );
  return {
    geometry,
    localPoints,
    outlineCurve,
    profileSampleCount,
    sampledPoints,
  };
}

function makeSourceJaw({
  boreRadius,
  camCenterLocal,
  depth,
  jawMaterial,
  markerLocal,
  outlineMaterial,
  pivot,
  planeZ,
  sourcePoints,
  sourceOrigin = new THREE.Vector2(123, 264),
  sourceScale,
  whiteMaterial,
}) {
  const jaw = new THREE.Group();
  jaw.position.set(
    (pivot.x - sourceOrigin.x) * sourceScale,
    (sourceOrigin.y - pivot.y) * sourceScale,
    planeZ,
  );
  jaw.userData.axis = Z_AXIS.clone();
  jaw.userData.role = 'source-profiled-pivoting-eccentric-clamp-jaw';
  const profile = sourceProfileGeometry({
    boreRadius,
    depth,
    pivot,
    sourcePoints,
    sourceScale,
  });
  const plate = new THREE.Mesh(profile.geometry, jawMaterial);
  plate.userData.role = 'source-fitted-curved-clamp-jaw-plate';
  plate.userData.sourceProfilePoints = sourcePoints;
  const outline = new THREE.Mesh(
    new THREE.TubeGeometry(
      profile.outlineCurve,
      profile.profileSampleCount,
      0.021,
      6,
      true,
    ),
    outlineMaterial,
  );
  outline.userData.role = 'dark-source-profile-jaw-outline';
  const rotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.40, 0.060, 0.026),
    whiteMaterial,
  );
  rotationIndex.position.set(
    markerLocal.x,
    markerLocal.y,
    depth / 2 + 0.055,
  );
  rotationIndex.userData.role = 'white-index-fixed-to-pivoting-jaw';
  const camCenterAnchor = new THREE.Object3D();
  camCenterAnchor.position.set(camCenterLocal.x, camCenterLocal.y, 0);
  camCenterAnchor.userData.role = 'analytic-eccentric-lobe-center-anchor';
  jaw.add(plate, outline, rotationIndex, camCenterAnchor);
  jaw.userData.boreRadius = boreRadius;
  jaw.userData.camCenterLocal = camCenterLocal.clone();
  jaw.userData.localProfilePoints = profile.localPoints;
  jaw.userData.profileSampleCount = profile.profileSampleCount;
  return {
    camCenterAnchor,
    jaw,
    outline,
    plate,
    rotationIndex,
  };
}

function makeFixedPivotScrew({
  darkMaterial,
  headRadius = 0.34,
  headZ,
  pivot,
  shaftRadius = 0.115,
  slotLength = 0.49,
  sourceOrigin = new THREE.Vector2(123, 264),
  sourceScale,
  slotAngle,
  washerMajorRadius = 0.30,
  whiteMaterial,
}) {
  const screw = new THREE.Group();
  screw.position.set(
    (pivot.x - sourceOrigin.x) * sourceScale,
    (sourceOrigin.y - pivot.y) * sourceScale,
    0,
  );
  screw.userData.axis = Z_AXIS.clone();
  screw.userData.fixed = true;
  screw.userData.role = 'fixed-vertical-screw-pivot-anchored-in-bench';
  const shaftBottomZ = -0.05;
  const shaftTopZ = headZ + 0.03;
  const shaft = cylinderAlongZ(
    shaftRadius,
    shaftTopZ - shaftBottomZ,
    darkMaterial,
    28,
  );
  shaft.position.z = (shaftTopZ + shaftBottomZ) / 2;
  shaft.userData.role = 'fixed-screw-shank-through-jaw-and-bench';
  const washer = new THREE.Mesh(
    new THREE.TorusGeometry(
      washerMajorRadius,
      Math.max(0.024, headRadius * 0.13),
      9,
      42,
    ),
    darkMaterial,
  );
  washer.position.z = headZ - 0.085;
  washer.userData.role = 'fixed-pivot-screw-bearing-washer';
  const head = cylinderAlongZ(headRadius, 0.15, darkMaterial, 42);
  head.position.z = headZ;
  head.userData.role = 'fixed-round-slotted-pivot-screw-head';
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(
      slotLength,
      Math.max(0.045, headRadius * 0.19),
      0.032,
    ),
    whiteMaterial,
  );
  slot.position.z = headZ + 0.09;
  slot.rotation.z = slotAngle;
  slot.userData.role = 'fixed-white-slot-in-pivot-screw-head';
  screw.add(shaft, washer, head, slot);
  return {
    head,
    screw,
    shaft,
    slot,
    washer,
  };
}

function twinPivotedBenchClamp() {
  const root = new THREE.Group();

  // Brown's engraving is a top view.  Coordinates below are measured from
  // the public-domain 525 px plate: the rectangular field is the bench top,
  // the horizontal member is the board being clamped, and both curved jaws
  // rotate on vertical screws fixed into the bench.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.012;
  const sourceOrigin = new THREE.Vector2(123, 264);
  const sourceBenchMinimum = new THREE.Vector2(16, 79);
  const sourceBenchMaximum = new THREE.Vector2(500, 444);
  const sourceBenchSeamsX = [228, 331];
  const sourceWorkpieceLeft = 123;
  const sourceWorkpieceRight = 520;
  const sourceWorkpieceTop = 234;
  const sourceWorkpieceBottom = 294;
  const sourceUpperPivot = new THREE.Vector2(267, 164);
  const sourceLowerPivot = new THREE.Vector2(270, 364);
  const sourceUpperCamCenter = new THREE.Vector2(407, 193);
  const sourceLowerCamCenter = new THREE.Vector2(410, 335);
  const sourceUpperContact = new THREE.Vector2(407, 234);
  const sourceLowerContact = new THREE.Vector2(410, 294);
  const sourceCamRadius = 41;
  const sourceUpperJawOutline = [
    [61, 273], [82, 249], [108, 224], [139, 202],
    [176, 185], [216, 178], [257, 178], [294, 179],
    [328, 170], [365, 156], [367, 180], [360, 198],
    [364, 215], [376, 228], [391, 234], [409, 232],
    [428, 223], [442, 207], [451, 188], [454, 170],
    [449, 150], [436, 133], [417, 120], [392, 113],
    [361, 110], [325, 110], [286, 112], [244, 117],
    [204, 127], [166, 141], [132, 158], [101, 179],
    [74, 201], [54, 221], [39, 211], [28, 209],
    [21, 216], [23, 229], [33, 243], [47, 258],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const sourceLowerJawOutline = sourceUpperJawOutline.map(
    (point) => new THREE.Vector2(point.x + 3, 528 - point.y),
  );
  const sourcePointToModel = (point) => new THREE.Vector2(
    (point.x - sourceOrigin.x) * sourceScale,
    (sourceOrigin.y - point.y) * sourceScale,
  );
  const modelPointToSourceRaster = (point) => new THREE.Vector2(
    sourceOrigin.x + point.x / sourceScale,
    sourceOrigin.y - point.y / sourceScale,
  );

  const benchMinimum = sourcePointToModel(new THREE.Vector2(
    sourceBenchMinimum.x,
    sourceBenchMaximum.y,
  ));
  const benchMaximum = sourcePointToModel(new THREE.Vector2(
    sourceBenchMaximum.x,
    sourceBenchMinimum.y,
  ));
  const benchWidth = benchMaximum.x - benchMinimum.x;
  const benchHeight = benchMaximum.y - benchMinimum.y;
  const benchDepth = 0.66;
  const benchCenterZ = -0.38;
  const workpieceClosedLeftX = 0;
  const workpieceLength = (
    sourceWorkpieceRight - sourceWorkpieceLeft
  ) * sourceScale;
  const workpieceWidth = (
    sourceWorkpieceBottom - sourceWorkpieceTop
  ) * sourceScale;
  const workpieceDepth = 0.36;
  const workpieceCenterZ = 0.14;
  const workpieceReleaseTravel = 0.72;
  const upperPivot = sourcePointToModel(sourceUpperPivot);
  const lowerPivot = sourcePointToModel(sourceLowerPivot);
  const upperCamCenterLocal = sourcePointToModel(
    sourceUpperCamCenter,
  ).sub(upperPivot);
  const lowerCamCenterLocal = sourcePointToModel(
    sourceLowerCamCenter,
  ).sub(lowerPivot);
  const camRadius = sourceCamRadius * sourceScale;
  const upperJawPlaneZ = 0.36;
  const lowerJawPlaneZ = 0.09;
  const jawDepth = 0.24;
  const pivotBoreRadius = 0.16;
  const openJawAngle = 0.18;

  const cyclePeriod = 9.4;
  const closedHoldEnd = 1.4;
  const releaseEnd = 3.0;
  const openHoldEnd = 4.4;
  const insertionEnd = 6.4;
  const releaseDuration = releaseEnd - closedHoldEnd;
  const insertionDuration = insertionEnd - openHoldEnd;

  const closureLawAtCycleTime = (cycleTime) => {
    const clampedTime = THREE.MathUtils.clamp(cycleTime, 0, cyclePeriod);
    let closure = 1;
    let closureVelocity = 0;
    let closureAcceleration = 0;
    let normalizedEventProgress = 0;
    let stage = 'workpiece-clamped-between-both-jaws';
    if (clampedTime < closedHoldEnd) {
      normalizedEventProgress = clampedTime / closedHoldEnd;
    } else if (clampedTime < releaseEnd) {
      normalizedEventProgress = (
        clampedTime - closedHoldEnd
      ) / releaseDuration;
      closure = 1 - smootherStep01(normalizedEventProgress);
      closureVelocity = -smootherStepFirstDerivative(
        normalizedEventProgress,
      ) / releaseDuration;
      closureAcceleration = -smootherStepSecondDerivative(
        normalizedEventProgress,
      ) / releaseDuration ** 2;
      stage = 'rightward-withdrawal-friction-opens-both-jaws';
    } else if (clampedTime < openHoldEnd) {
      closure = 0;
      normalizedEventProgress = (
        clampedTime - releaseEnd
      ) / (openHoldEnd - releaseEnd);
      stage = 'both-jaws-open-around-released-workpiece';
    } else if (clampedTime < insertionEnd) {
      normalizedEventProgress = (
        clampedTime - openHoldEnd
      ) / insertionDuration;
      closure = smootherStep01(normalizedEventProgress);
      closureVelocity = smootherStepFirstDerivative(
        normalizedEventProgress,
      ) / insertionDuration;
      closureAcceleration = smootherStepSecondDerivative(
        normalizedEventProgress,
      ) / insertionDuration ** 2;
      stage = 'leftward-workpiece-push-self-energizes-both-jaws';
    } else {
      normalizedEventProgress = (
        clampedTime - insertionEnd
      ) / (cyclePeriod - insertionEnd);
    }
    return {
      closure,
      closureAcceleration,
      closureVelocity,
      cycleTime: clampedTime,
      normalizedEventProgress,
      stage,
    };
  };

  const rotatingPointKinematics = ({
    angle,
    angularAcceleration,
    angularVelocity,
    localPoint,
    pivot,
    z,
  }) => {
    const rotated = rotateVector2(localPoint, angle);
    const perpendicular = new THREE.Vector2(-rotated.y, rotated.x);
    const position = pivot.clone().add(rotated);
    const velocity = perpendicular.clone().multiplyScalar(angularVelocity);
    const acceleration = perpendicular.clone().multiplyScalar(
      angularAcceleration,
    ).addScaledVector(rotated, -(angularVelocity ** 2));
    return {
      acceleration: new THREE.Vector3(
        acceleration.x,
        acceleration.y,
        0,
      ),
      position: new THREE.Vector3(position.x, position.y, z),
      rotated,
      velocity: new THREE.Vector3(velocity.x, velocity.y, 0),
    };
  };

  const stateAtCycleTime = (cycleTime) => {
    const law = closureLawAtCycleTime(cycleTime);
    const openingFraction = 1 - law.closure;
    const workpieceTranslation = workpieceReleaseTravel * openingFraction;
    const workpieceVelocityX = -workpieceReleaseTravel
      * law.closureVelocity;
    const workpieceAccelerationX = -workpieceReleaseTravel
      * law.closureAcceleration;
    const upperJawAngle = openJawAngle * openingFraction;
    const lowerJawAngle = -openJawAngle * openingFraction;
    const upperJawAngularVelocity = -openJawAngle * law.closureVelocity;
    const lowerJawAngularVelocity = openJawAngle * law.closureVelocity;
    const upperJawAngularAcceleration = -openJawAngle
      * law.closureAcceleration;
    const lowerJawAngularAcceleration = openJawAngle
      * law.closureAcceleration;
    const upperCam = rotatingPointKinematics({
      angle: upperJawAngle,
      angularAcceleration: upperJawAngularAcceleration,
      angularVelocity: upperJawAngularVelocity,
      localPoint: upperCamCenterLocal,
      pivot: upperPivot,
      z: upperJawPlaneZ,
    });
    const lowerCam = rotatingPointKinematics({
      angle: lowerJawAngle,
      angularAcceleration: lowerJawAngularAcceleration,
      angularVelocity: lowerJawAngularVelocity,
      localPoint: lowerCamCenterLocal,
      pivot: lowerPivot,
      z: lowerJawPlaneZ,
    });
    const workpieceTopY = workpieceWidth / 2;
    const workpieceBottomY = -workpieceWidth / 2;
    const upperContactPoint = upperCam.position.clone();
    upperContactPoint.y -= camRadius;
    const lowerContactPoint = lowerCam.position.clone();
    lowerContactPoint.y += camRadius;
    const upperContactGap = upperContactPoint.y - workpieceTopY;
    const lowerContactGap = workpieceBottomY - lowerContactPoint.y;
    const upperContactVector = new THREE.Vector2(
      upperContactPoint.x - upperPivot.x,
      upperContactPoint.y - upperPivot.y,
    );
    const lowerContactVector = new THREE.Vector2(
      lowerContactPoint.x - lowerPivot.x,
      lowerContactPoint.y - lowerPivot.y,
    );
    const clamped = upperContactGap <= 1e-12
      && lowerContactGap <= 1e-12;
    return {
      boardGuideError: 0,
      clampClosure: law.closure,
      clamped,
      closureAcceleration: law.closureAcceleration,
      closureVelocity: law.closureVelocity,
      cycleTime: law.cycleTime,
      lowerCamCenterAcceleration: lowerCam.acceleration,
      lowerCamCenterVelocity: lowerCam.velocity,
      lowerCamCenterWorld: lowerCam.position,
      lowerContactGap,
      lowerContactGapVelocity: -lowerCam.velocity.y,
      lowerContactPoint,
      lowerJawAngle,
      lowerJawAngularAcceleration,
      lowerJawAngularVelocity,
      lowerLeftwardFrictionTorque: lowerContactVector.y,
      minimumContactGap: Math.min(upperContactGap, lowerContactGap),
      normalizedEventProgress: law.normalizedEventProgress,
      openingFraction,
      screwRotation: 0,
      stage: law.stage,
      upperCamCenterAcceleration: upperCam.acceleration,
      upperCamCenterVelocity: upperCam.velocity,
      upperCamCenterWorld: upperCam.position,
      upperContactGap,
      upperContactGapVelocity: upperCam.velocity.y,
      upperContactPoint,
      upperJawAngle,
      upperJawAngularAcceleration,
      upperJawAngularVelocity,
      upperLeftwardFrictionTorque: upperContactVector.y,
      workpieceAccelerationX,
      workpieceLeftX: workpieceClosedLeftX + workpieceTranslation,
      workpieceRightX: workpieceClosedLeftX
        + workpieceTranslation + workpieceLength,
      workpieceTranslation,
      workpieceVelocityX,
    };
  };

  const stateAtTime = (time) => {
    const nonnegativeTime = Math.max(0, time);
    const rawCompletedCycles = nonnegativeTime / cyclePeriod;
    const nearestCycleCount = Math.round(rawCompletedCycles);
    const onCycleBoundary = Math.abs(
      rawCompletedCycles - nearestCycleCount,
    ) < 1e-12;
    const completedCycles = onCycleBoundary
      ? nearestCycleCount
      : Math.floor(rawCompletedCycles);
    const cycleTime = onCycleBoundary
      ? 0
      : THREE.MathUtils.euclideanModulo(nonnegativeTime, cyclePeriod);
    return {
      ...stateAtCycleTime(cycleTime),
      completedCycles,
      time,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.02,
    roughness: 0.82,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.03,
    roughness: 0.76,
  });
  const jawMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const fixedBench = new THREE.Group();
  fixedBench.userData.fixed = true;
  fixedBench.userData.role = 'fixed-planked-carpenters-bench-top';
  const plankBoundaries = [
    sourceBenchMinimum.x,
    ...sourceBenchSeamsX,
    sourceBenchMaximum.x,
  ];
  const benchPlanks = [];
  for (let index = 0; index < plankBoundaries.length - 1; index += 1) {
    const minimumSourceX = plankBoundaries[index] + (index > 0 ? 1.2 : 0);
    const maximumSourceX = plankBoundaries[index + 1]
      - (index < plankBoundaries.length - 2 ? 1.2 : 0);
    const minimumX = (minimumSourceX - sourceOrigin.x) * sourceScale;
    const maximumX = (maximumSourceX - sourceOrigin.x) * sourceScale;
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(
        maximumX - minimumX,
        benchHeight,
        benchDepth,
      ),
      frameMaterial,
    );
    plank.position.set(
      (minimumX + maximumX) / 2,
      (benchMinimum.y + benchMaximum.y) / 2,
      benchCenterZ,
    );
    plank.userData.role = 'fixed-source-bench-top-plank';
    plank.userData.sourcePanelIndex = index;
    benchPlanks.push(plank);
    fixedBench.add(plank);
  }

  const workpiece = new THREE.Group();
  workpiece.userData.role = 'horizontal-board-pushed-between-both-jaws';
  workpiece.userData.translationAxis = new THREE.Vector3(1, 0, 0);
  const workpieceBody = new THREE.Mesh(
    new THREE.BoxGeometry(
      workpieceLength,
      workpieceWidth,
      workpieceDepth,
    ),
    driverMaterial,
  );
  workpieceBody.position.set(
    workpieceClosedLeftX + workpieceLength / 2,
    0,
    workpieceCenterZ,
  );
  workpieceBody.userData.role = 'single-board-whose-leftward-push-clamps-its-sides';
  const workpieceInputIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.075, 0.030),
    whiteMaterial,
  );
  workpieceInputIndex.position.set(
    workpieceClosedLeftX + workpieceLength * 0.54,
    0,
    workpieceCenterZ + workpieceDepth / 2 + 0.025,
  );
  workpieceInputIndex.userData.role = 'white-index-on-translating-board';
  const workpieceLeadingEdgeAnchor = new THREE.Object3D();
  workpieceLeadingEdgeAnchor.position.set(
    workpieceClosedLeftX,
    0,
    workpieceCenterZ,
  );
  workpieceLeadingEdgeAnchor.userData.role = 'analytic-board-leading-edge-anchor';
  workpiece.add(
    workpieceBody,
    workpieceInputIndex,
    workpieceLeadingEdgeAnchor,
  );

  const upperJawParts = makeSourceJaw({
    boreRadius: pivotBoreRadius,
    camCenterLocal: upperCamCenterLocal,
    depth: jawDepth,
    jawMaterial,
    markerLocal: new THREE.Vector2(0.52, 0.34),
    outlineMaterial: darkMaterial,
    pivot: sourceUpperPivot,
    planeZ: upperJawPlaneZ,
    sourcePoints: sourceUpperJawOutline,
    sourceScale,
    whiteMaterial,
  });
  upperJawParts.jaw.userData.side = 'upper-clockwise-closing';
  upperJawParts.plate.userData.side = 'upper';
  const lowerJawParts = makeSourceJaw({
    boreRadius: pivotBoreRadius,
    camCenterLocal: lowerCamCenterLocal,
    depth: jawDepth,
    jawMaterial,
    markerLocal: new THREE.Vector2(0.52, -0.34),
    outlineMaterial: darkMaterial,
    pivot: sourceLowerPivot,
    planeZ: lowerJawPlaneZ,
    sourcePoints: sourceLowerJawOutline,
    sourceScale,
    whiteMaterial,
  });
  lowerJawParts.jaw.userData.side = 'lower-counterclockwise-closing';
  lowerJawParts.plate.userData.side = 'lower';

  const upperScrewParts = makeFixedPivotScrew({
    darkMaterial,
    headZ: 0.56,
    pivot: sourceUpperPivot,
    sourceScale,
    slotAngle: 0.39,
    whiteMaterial,
  });
  upperScrewParts.screw.userData.side = 'upper';
  const lowerScrewParts = makeFixedPivotScrew({
    darkMaterial,
    headZ: 0.35,
    pivot: sourceLowerPivot,
    sourceScale,
    slotAngle: -0.40,
    whiteMaterial,
  });
  lowerScrewParts.screw.userData.side = 'lower';

  const upperContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 20, 14),
    whiteMaterial,
  );
  upperContactMarker.userData.role = 'visible-upper-jaw-board-contact-marker';
  const lowerContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 20, 14),
    whiteMaterial,
  );
  lowerContactMarker.userData.role = 'visible-lower-jaw-board-contact-marker';

  root.add(
    fixedBench,
    workpiece,
    lowerJawParts.jaw,
    upperJawParts.jaw,
    lowerScrewParts.screw,
    upperScrewParts.screw,
    lowerContactMarker,
    upperContactMarker,
  );

  const canonicalStates = {
    sourceClosed: {
      ...stateAtCycleTime(0),
      canonicalStage: 'source-engraving-fully-clamped',
    },
    releaseMidpoint: {
      ...stateAtCycleTime((closedHoldEnd + releaseEnd) / 2),
      canonicalStage: 'rightward-release-midpoint',
    },
    fullyOpen: {
      ...stateAtCycleTime((releaseEnd + openHoldEnd) / 2),
      canonicalStage: 'fully-open-dwell',
    },
    insertionMidpoint: {
      ...stateAtCycleTime((openHoldEnd + insertionEnd) / 2),
      canonicalStage: 'leftward-self-clamping-midpoint',
    },
    relocked: {
      ...stateAtCycleTime(insertionEnd),
      canonicalStage: 'both-jaws-relocked',
    },
  };

  const geometry = {
    benchCenterZ,
    benchDepth,
    benchHeight,
    benchMaximum,
    benchMinimum,
    benchWidth,
    camRadius,
    closedHoldEnd,
    cyclePeriod,
    insertionDuration,
    insertionEnd,
    jawDepth,
    lowerCamCenterLocal,
    lowerJawPlaneZ,
    lowerPivot,
    openHoldEnd,
    openJawAngle,
    pivotBoreRadius,
    releaseDuration,
    releaseEnd,
    sourceBenchMaximum,
    sourceBenchMinimum,
    sourceBenchSeamsX,
    sourceCamRadius,
    sourceImageHeight,
    sourceImageWidth,
    sourceLowerCamCenter,
    sourceLowerContact,
    sourceLowerJawOutline,
    sourceLowerPivot,
    sourceOrigin,
    sourceScale,
    sourceUpperCamCenter,
    sourceUpperContact,
    sourceUpperJawOutline,
    sourceUpperPivot,
    sourceWorkpieceBottom,
    sourceWorkpieceLeft,
    sourceWorkpieceRight,
    sourceWorkpieceTop,
    upperCamCenterLocal,
    upperJawPlaneZ,
    upperPivot,
    workpieceCenterZ,
    workpieceClosedLeftX,
    workpieceDepth,
    workpieceLength,
    workpieceReleaseTravel,
    workpieceWidth,
  };

  root.userData.archetype =
    'twin-pivoted-eccentric-jaw-self-energizing-bench-clamp';
  root.userData.blocks = {
    benchPlanks,
    fixedBench,
    lowerCamCenterAnchor: lowerJawParts.camCenterAnchor,
    lowerContactMarker,
    lowerJaw: lowerJawParts.jaw,
    lowerJawOutline: lowerJawParts.outline,
    lowerJawPlate: lowerJawParts.plate,
    lowerJawRotationIndex: lowerJawParts.rotationIndex,
    lowerPivotScrew: lowerScrewParts.screw,
    lowerPivotScrewHead: lowerScrewParts.head,
    lowerPivotScrewShaft: lowerScrewParts.shaft,
    lowerPivotScrewSlot: lowerScrewParts.slot,
    lowerPivotWasher: lowerScrewParts.washer,
    upperCamCenterAnchor: upperJawParts.camCenterAnchor,
    upperContactMarker,
    upperJaw: upperJawParts.jaw,
    upperJawOutline: upperJawParts.outline,
    upperJawPlate: upperJawParts.plate,
    upperJawRotationIndex: upperJawParts.rotationIndex,
    upperPivotScrew: upperScrewParts.screw,
    upperPivotScrewHead: upperScrewParts.head,
    upperPivotScrewShaft: upperScrewParts.shaft,
    upperPivotScrewSlot: upperScrewParts.slot,
    upperPivotWasher: upperScrewParts.washer,
    workpiece,
    workpieceBody,
    workpieceInputIndex,
    workpieceLeadingEdgeAnchor,
  };
  root.userData.cameraDistanceScale = 0.98;
  root.userData.canonicalStates = canonicalStates;
  root.userData.closureLawAtCycleTime = closureLawAtCycleTime;
  root.userData.fidelity = 'authored';
  root.userData.hideGround = true;
  root.userData.cameraFov = 8;
  root.userData.supportsRestart = true;
  root.userData.materialsIgnoreSceneFog = true;
  root.userData.geometry = geometry;
  root.userData.mechanism =
    'fixed-vertical-screw-pivots-opposed-eccentric-jaws-friction-self-clamping-board';
  root.userData.modelPointToSourceRaster = modelPointToSourceRaster;
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.stateAtCycleTime = stateAtCycleTime;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    workpiece.position.x = state.workpieceTranslation;
    upperJawParts.jaw.rotation.z = state.upperJawAngle;
    lowerJawParts.jaw.rotation.z = state.lowerJawAngle;
    upperContactMarker.position.copy(state.upperContactPoint);
    upperContactMarker.position.z = upperJawPlaneZ + jawDepth / 2 + 0.055;
    lowerContactMarker.position.copy(state.lowerContactPoint);
    lowerContactMarker.position.z = lowerJawPlaneZ + jawDepth / 2 + 0.055;
    root.userData.kinematics = state;
  };
  update(0);

  root.traverse(object => {
    for (const material of [object.material].flat().filter(Boolean)) material.fog = false;
  });
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0, 0, 1),
    reset: () => update(0),
    root,
    update,
  };
}

function singlePivotedFixedSideBenchClamp() {
  const root = new THREE.Group();

  // Movement 180 is the one-jaw counterpart of 174. Brown's engraving is a
  // plan view: the long screwed bar at left is fixed, the narrow board slides
  // upward along its right face, and friction turns the one eccentric jaw at
  // right clockwise until its lower-left lobe wedges the board.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.012;
  const sourceOrigin = new THREE.Vector2(280, 452);
  const sourceFixedSideMinimumX = 160;
  const sourceFixedSideMaximumX = 226;
  const sourceFixedSideTop = 10;
  const sourceFixedSideBottom = 515;
  const sourceFixedScrewCenters = [
    new THREE.Vector2(192, 180),
    new THREE.Vector2(192, 450),
  ];
  const sourceWorkpieceLeft = 226;
  const sourceWorkpieceRight = 280;
  const sourceWorkpieceTop = 154;
  const sourceWorkpieceBottom = 520;
  const sourceJawPivot = new THREE.Vector2(354, 300);
  const sourceJawContact = new THREE.Vector2(280, 452);
  const sourcePivotHeadRadius = 29;
  const sourceFixedHeadRadius = 15;
  const sourceJawOutline = [
    [225, 48], [239, 54], [250, 73], [272, 85],
    [294, 100], [316, 118],
    [337, 138], [357, 160], [375, 184], [390, 210],
    [401, 238], [409, 267], [414, 297], [416, 327],
    [415, 357], [411, 387], [404, 415], [395, 440],
    [383, 462], [368, 480], [351, 492], [332, 498],
    [313, 497], [297, 489], [286, 476], [281, 463],
    [280, 452], [285, 441], [296, 431], [310, 423],
    [322, 412], [328, 400], [327, 388], [319, 369],
    [309, 349], [301, 330], [297, 311], [298, 291],
    [305, 269], [311, 247], [311, 226], [307, 207],
    [299, 185], [288, 163], [273, 142], [257, 124],
    [241, 108], [226, 94], [217, 84], [207, 73],
    [198, 64], [190, 57], [185, 50],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const sourceJawContactIndex = sourceJawOutline.findIndex(
    (point) => point.equals(sourceJawContact),
  );
  const sourceVisibleJawOutlineEndIndex = sourceJawOutline.findIndex(
    (point) => point.equals(new THREE.Vector2(226, 94)),
  );
  const sourceFixedSideOutline = [
    [160, 10], [226, 10], [226, 494], [220, 499],
    [214, 496], [207, 504], [199, 498], [191, 507],
    [182, 501], [174, 508], [166, 505], [160, 509],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const sourceWorkpieceOutline = [
    [226, 154], [280, 154], [280, 490], [275, 496],
    [268, 491], [261, 500], [254, 493], [247, 500],
    [240, 493], [233, 499], [226, 494],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const sourcePointToModel = (point) => new THREE.Vector2(
    (point.x - sourceOrigin.x) * sourceScale,
    (sourceOrigin.y - point.y) * sourceScale,
  );
  const modelPointToSourceRaster = (point) => new THREE.Vector2(
    sourceOrigin.x + point.x / sourceScale,
    sourceOrigin.y - point.y / sourceScale,
  );
  const sourceOutlineGeometry = (sourcePoints, depth, bevel = 0.012) => {
    const modelPoints = sourcePoints.map(sourcePointToModel);
    const shape = new THREE.Shape();
    modelPoints.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    });
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: bevel > 0,
      bevelSegments: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
      curveSegments: 4,
      depth,
    });
    geometry.translate(0, 0, -depth / 2);
    return { geometry, modelPoints };
  };
  const outlineTube = (modelPoints, z, material, radius = 0.021) => {
    const curve = new THREE.CurvePath();
    for (let index = 0; index < modelPoints.length; index += 1) {
      const start = modelPoints[index];
      const end = modelPoints[(index + 1) % modelPoints.length];
      curve.add(new THREE.LineCurve3(
        new THREE.Vector3(start.x, start.y, z),
        new THREE.Vector3(end.x, end.y, z),
      ));
    }
    return new THREE.Mesh(
      new THREE.TubeGeometry(curve, modelPoints.length * 5, radius, 6, true),
      material,
    );
  };

  const fixedSideFaceX = sourcePointToModel(new THREE.Vector2(
    sourceFixedSideMaximumX,
    sourceOrigin.y,
  )).x;
  const workpieceLeftX = sourcePointToModel(new THREE.Vector2(
    sourceWorkpieceLeft,
    sourceOrigin.y,
  )).x;
  const workpieceRightX = sourcePointToModel(new THREE.Vector2(
    sourceWorkpieceRight,
    sourceOrigin.y,
  )).x;
  const workpieceWidth = workpieceRightX - workpieceLeftX;
  const workpieceTopY = sourcePointToModel(new THREE.Vector2(
    sourceOrigin.x,
    sourceWorkpieceTop,
  )).y;
  const workpieceBottomY = sourcePointToModel(new THREE.Vector2(
    sourceOrigin.x,
    sourceWorkpieceBottom,
  )).y;
  const jawPivot = sourcePointToModel(sourceJawPivot);
  const jawContactLocal = sourcePointToModel(sourceJawContact).sub(jawPivot);
  const jawContactRadius = jawContactLocal.length();
  const jawProfileLocalPoints = sourceJawOutline.map((point) => new THREE.Vector2(
    (point.x - sourceJawPivot.x) * sourceScale,
    (sourceJawPivot.y - point.y) * sourceScale,
  ));
  const fixedSideMinimumX = sourcePointToModel(new THREE.Vector2(
    sourceFixedSideMinimumX,
    sourceOrigin.y,
  )).x;
  const fixedSideTopY = sourcePointToModel(new THREE.Vector2(
    sourceOrigin.x,
    sourceFixedSideTop,
  )).y;
  const fixedSideBottomY = sourcePointToModel(new THREE.Vector2(
    sourceOrigin.x,
    sourceFixedSideBottom,
  )).y;

  const benchDepth = 0.70;
  const benchCenterZ = -0.40;
  const jawDepth = 0.24;
  const jawPlaneZ = 0.08;
  const workpieceDepth = 0.32;
  const workpieceCenterZ = 0.12;
  const fixedSideDepth = 0.44;
  const fixedSideCenterZ = 0.43;
  const pivotBoreRadius = 0.17;
  const openJawAngle = 0.16;
  const workpieceReleaseTravel = 0.78;
  const cyclePeriod = 9.8;
  const closedHoldEnd = 1.5;
  const releaseEnd = 3.3;
  const openHoldEnd = 4.6;
  const insertionEnd = 7.0;
  const releaseDuration = releaseEnd - closedHoldEnd;
  const insertionDuration = insertionEnd - openHoldEnd;

  const closureLawAtCycleTime = (cycleTime) => {
    const clampedTime = THREE.MathUtils.clamp(cycleTime, 0, cyclePeriod);
    let closure = 1;
    let closureVelocity = 0;
    let closureAcceleration = 0;
    let normalizedEventProgress = 0;
    let stage = 'board-wedged-between-fixed-side-and-single-jaw';
    if (clampedTime < closedHoldEnd) {
      normalizedEventProgress = clampedTime / closedHoldEnd;
    } else if (clampedTime < releaseEnd) {
      normalizedEventProgress = (
        clampedTime - closedHoldEnd
      ) / releaseDuration;
      closure = 1 - smootherStep01(normalizedEventProgress);
      closureVelocity = -smootherStepFirstDerivative(
        normalizedEventProgress,
      ) / releaseDuration;
      closureAcceleration = -smootherStepSecondDerivative(
        normalizedEventProgress,
      ) / releaseDuration ** 2;
      stage = 'downward-board-withdrawal-opens-single-jaw-counterclockwise';
    } else if (clampedTime < openHoldEnd) {
      closure = 0;
      normalizedEventProgress = (
        clampedTime - releaseEnd
      ) / (openHoldEnd - releaseEnd);
      stage = 'single-jaw-open-beside-fixed-side-piece';
    } else if (clampedTime < insertionEnd) {
      normalizedEventProgress = (
        clampedTime - openHoldEnd
      ) / insertionDuration;
      closure = smootherStep01(normalizedEventProgress);
      closureVelocity = smootherStepFirstDerivative(
        normalizedEventProgress,
      ) / insertionDuration;
      closureAcceleration = smootherStepSecondDerivative(
        normalizedEventProgress,
      ) / insertionDuration ** 2;
      stage = 'upward-board-push-turns-single-jaw-clockwise-and-clamps';
    } else {
      normalizedEventProgress = (
        clampedTime - insertionEnd
      ) / (cyclePeriod - insertionEnd);
    }
    return {
      closure,
      closureAcceleration,
      closureVelocity,
      cycleTime: clampedTime,
      normalizedEventProgress,
      stage,
    };
  };

  const stateAtCycleTime = (cycleTime) => {
    const law = closureLawAtCycleTime(cycleTime);
    const openingFraction = 1 - law.closure;
    const jawAngle = openJawAngle * openingFraction;
    const jawAngularVelocity = -openJawAngle * law.closureVelocity;
    const jawAngularAcceleration = -openJawAngle
      * law.closureAcceleration;
    const workpieceTranslationY = -workpieceReleaseTravel * openingFraction;
    const workpieceVelocityY = workpieceReleaseTravel * law.closureVelocity;
    const workpieceAccelerationY = workpieceReleaseTravel
      * law.closureAcceleration;
    const rotatedContact = rotateVector2(jawContactLocal, jawAngle);
    const contactPerpendicular = new THREE.Vector2(
      -rotatedContact.y,
      rotatedContact.x,
    );
    const jawContactPoint = jawPivot.clone().add(rotatedContact);
    const jawContactVelocity = contactPerpendicular.clone().multiplyScalar(
      jawAngularVelocity,
    );
    const jawContactAcceleration = contactPerpendicular.clone()
      .multiplyScalar(jawAngularAcceleration)
      .addScaledVector(rotatedContact, -(jawAngularVelocity ** 2));
    const movingJawContactGap = jawContactPoint.x - workpieceRightX;
    const movingJawContactGapVelocity = jawContactVelocity.x;
    const movingJawContactGapAcceleration = jawContactAcceleration.x;
    const fixedSideContactGap = workpieceLeftX - fixedSideFaceX;
    const translatedWorkpieceTopY = workpieceTopY + workpieceTranslationY;
    const translatedWorkpieceBottomY = workpieceBottomY
      + workpieceTranslationY;
    const jawContactWithinBoardSpan = jawContactPoint.y
      <= translatedWorkpieceTopY + 1e-12
      && jawContactPoint.y >= translatedWorkpieceBottomY - 1e-12;
    let minimumJawProfileGap = Infinity;
    let minimumJawProfilePoint = null;
    let minimumJawProfilePointIndex = -1;
    for (const [index, localPoint] of jawProfileLocalPoints.entries()) {
      const worldPoint = jawPivot.clone().add(
        rotateVector2(localPoint, jawAngle),
      );
      if (
        worldPoint.y <= translatedWorkpieceTopY + 1e-12
        && worldPoint.y >= translatedWorkpieceBottomY - 1e-12
      ) {
        const gap = worldPoint.x - workpieceRightX;
        if (gap < minimumJawProfileGap) {
          minimumJawProfileGap = gap;
          minimumJawProfilePoint = worldPoint;
          minimumJawProfilePointIndex = index;
        }
      }
    }
    const clamped = minimumJawProfileGap <= 1e-12
      && fixedSideContactGap <= 1e-12
      && jawContactWithinBoardSpan;
    const upwardInsertionFrictionTorque = rotatedContact.x;
    return {
      boardGuideError: 0,
      clampClosure: law.closure,
      clamped,
      closureAcceleration: law.closureAcceleration,
      closureVelocity: law.closureVelocity,
      cycleTime: law.cycleTime,
      fixedSideContactGap,
      fixedSideCount: 1,
      jawAngle,
      jawAngularAcceleration,
      jawAngularVelocity,
      jawContactAcceleration: new THREE.Vector3(
        jawContactAcceleration.x,
        jawContactAcceleration.y,
        0,
      ),
      jawContactPoint: new THREE.Vector3(
        jawContactPoint.x,
        jawContactPoint.y,
        jawPlaneZ,
      ),
      jawContactRadiusError: Math.abs(
        rotatedContact.length() - jawContactRadius,
      ),
      jawContactVelocity: new THREE.Vector3(
        jawContactVelocity.x,
        jawContactVelocity.y,
        0,
      ),
      jawContactWithinBoardSpan,
      movingJawContactGap,
      movingJawContactGapAcceleration,
      movingJawContactGapVelocity,
      movingJawCount: 1,
      minimumJawProfileGap,
      minimumJawProfilePoint,
      minimumJawProfilePointIndex,
      normalizedEventProgress: law.normalizedEventProgress,
      openingFraction,
      screwRotation: 0,
      stage: law.stage,
      translatedWorkpieceBottomY,
      translatedWorkpieceTopY,
      upwardInsertionFrictionTorque,
      workpieceAcceleration: new THREE.Vector3(
        0,
        workpieceAccelerationY,
        0,
      ),
      workpieceAccelerationY,
      workpieceLeftX,
      workpieceRightX,
      workpieceTranslationY,
      workpieceVelocity: new THREE.Vector3(0, workpieceVelocityY, 0),
      workpieceVelocityY,
    };
  };

  const stateAtTime = (time) => {
    const nonnegativeTime = Math.max(0, Number(time) || 0);
    const rawCompletedCycles = nonnegativeTime / cyclePeriod;
    const nearestCycleCount = Math.round(rawCompletedCycles);
    const onCycleBoundary = Math.abs(
      rawCompletedCycles - nearestCycleCount,
    ) < 1e-12;
    const completedCycles = onCycleBoundary
      ? nearestCycleCount
      : Math.floor(rawCompletedCycles);
    const cycleTime = onCycleBoundary
      ? 0
      : THREE.MathUtils.euclideanModulo(nonnegativeTime, cyclePeriod);
    return {
      ...stateAtCycleTime(cycleTime),
      completedCycles,
      time,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.04,
    roughness: 0.78,
  });
  const fixedSideMaterial = matte(PALETTE.muted, {
    metalness: 0.08,
    roughness: 0.70,
  });
  const workpieceMaterial = matte(PALETTE.driver, {
    metalness: 0.03,
    roughness: 0.76,
  });
  const jawMaterial = matte(PALETTE.driven, {
    metalness: 0.11,
    roughness: 0.61,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const baseMinimumX = fixedSideMinimumX - 0.34;
  const baseMaximumX = sourcePointToModel(new THREE.Vector2(
    435,
    sourceOrigin.y,
  )).x + 0.24;
  const baseMinimumY = fixedSideBottomY - 0.22;
  const baseMaximumY = fixedSideTopY + 0.20;
  const benchBase = new THREE.Mesh(
    new THREE.BoxGeometry(
      baseMaximumX - baseMinimumX,
      baseMaximumY - baseMinimumY,
      benchDepth,
    ),
    frameMaterial,
  );
  benchBase.position.set(
    (baseMinimumX + baseMaximumX) / 2,
    (baseMinimumY + baseMaximumY) / 2,
    benchCenterZ,
  );
  benchBase.userData.role = 'fixed-bench-bed-under-single-jaw-clamp';

  const fixedSideProfile = sourceOutlineGeometry(
    sourceFixedSideOutline,
    fixedSideDepth,
    0.014,
  );
  const fixedSidePiece = new THREE.Mesh(
    fixedSideProfile.geometry,
    fixedSideMaterial,
  );
  fixedSidePiece.position.z = fixedSideCenterZ;
  fixedSidePiece.userData.fixed = true;
  fixedSidePiece.userData.role =
    'one-fixed-straight-side-piece-opposite-pivoted-clamp';
  const fixedSideOutline = outlineTube(
    fixedSideProfile.modelPoints,
    fixedSideCenterZ + fixedSideDepth / 2 + 0.026,
    darkMaterial,
  );
  fixedSideOutline.userData.role = 'dark-source-outline-of-fixed-side-piece';
  const fixedSideFaceWitness = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 1.1, 0.035),
    whiteMaterial,
  );
  fixedSideFaceWitness.position.set(
    fixedSideFaceX - 0.03,
    0.54,
    fixedSideCenterZ + fixedSideDepth / 2 + 0.055,
  );
  fixedSideFaceWitness.userData.role =
    'visible-straight-contact-face-of-fixed-side-piece';

  const workpieceProfile = sourceOutlineGeometry(
    sourceWorkpieceOutline,
    workpieceDepth,
    0.01,
  );
  const workpiece = new THREE.Group();
  workpiece.userData.role =
    'vertical-board-pushed-upward-between-fixed-and-pivoted-jaws';
  workpiece.userData.translationAxis = new THREE.Vector3(0, 1, 0);
  const workpieceBody = new THREE.Mesh(
    workpieceProfile.geometry,
    workpieceMaterial,
  );
  workpieceBody.position.z = workpieceCenterZ;
  workpieceBody.userData.role =
    'single-board-whose-upward-push-self-energizes-clamp';
  const workpieceOutline = outlineTube(
    workpieceProfile.modelPoints,
    workpieceCenterZ + workpieceDepth / 2 + 0.022,
    darkMaterial,
    0.018,
  );
  workpieceOutline.userData.role = 'dark-source-outline-of-sliding-board';
  const workpieceInputIndex = new THREE.Mesh(
    new THREE.BoxGeometry(workpieceWidth * 0.68, 0.07, 0.03),
    whiteMaterial,
  );
  workpieceInputIndex.position.set(
    (workpieceLeftX + workpieceRightX) / 2,
    workpieceTopY - 0.42,
    workpieceCenterZ + workpieceDepth / 2 + 0.05,
  );
  workpieceInputIndex.userData.role = 'white-index-on-upward-sliding-board';
  const workpieceLeadingEdgeAnchor = new THREE.Group();
  workpieceLeadingEdgeAnchor.position.set(
    (workpieceLeftX + workpieceRightX) / 2,
    workpieceTopY,
    workpieceCenterZ,
  );
  workpieceLeadingEdgeAnchor.userData.role =
    'analytic-leading-edge-anchor-of-upward-board';
  const workpieceRightFaceAnchor = new THREE.Group();
  workpieceRightFaceAnchor.position.set(
    workpieceRightX,
    0,
    workpieceCenterZ,
  );
  workpieceRightFaceAnchor.userData.role =
    'analytic-board-face-anchor-at-moving-jaw-contact';
  const fixedContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 18, 12),
    whiteMaterial,
  );
  fixedContactMarker.position.set(
    workpieceLeftX,
    0.54,
    workpieceCenterZ + workpieceDepth / 2 + 0.11,
  );
  fixedContactMarker.userData.role =
    'visible-board-contact-with-fixed-side-piece';
  workpiece.add(
    workpieceBody,
    workpieceOutline,
    workpieceInputIndex,
    workpieceLeadingEdgeAnchor,
    workpieceRightFaceAnchor,
    fixedContactMarker,
  );

  const jawParts = makeSourceJaw({
    boreRadius: pivotBoreRadius,
    camCenterLocal: jawContactLocal,
    depth: jawDepth,
    jawMaterial,
    markerLocal: new THREE.Vector2(0.54, 0.36),
    outlineMaterial: darkMaterial,
    pivot: sourceJawPivot,
    planeZ: jawPlaneZ,
    sourceOrigin,
    sourcePoints: sourceJawOutline,
    sourceScale,
    whiteMaterial,
  });
  jawParts.jaw.userData.side = 'right-clockwise-self-energizing';
  jawParts.jaw.userData.role =
    'single-source-profiled-pivoted-eccentric-clamp-jaw';
  jawParts.camCenterAnchor.userData.role =
    'exact-source-contact-lobe-anchor-on-single-moving-jaw';
  // The short closing edge from (226, 94) back to (225, 48) lies beneath the
  // fixed side-piece and is dotted in the engraving. Keep that material in
  // the solid plate, but draw only the exposed outer/inner perimeter as a
  // dark tube so an oblique 3D view does not turn the hidden edge into a wire.
  jawParts.outline.visible = false;
  const visibleJawOutlineLocalPoints = sourceJawOutline
    .slice(0, sourceVisibleJawOutlineEndIndex + 1)
    .map((point) => new THREE.Vector3(
      (point.x - sourceJawPivot.x) * sourceScale,
      (sourceJawPivot.y - point.y) * sourceScale,
      jawDepth / 2 + 0.024,
    ));
  const visibleJawOutlineCurve = new THREE.CatmullRomCurve3(
    visibleJawOutlineLocalPoints,
    false,
    'centripetal',
  );
  const visibleJawOutline = new THREE.Mesh(
    new THREE.TubeGeometry(
      visibleJawOutlineCurve,
      visibleJawOutlineLocalPoints.length * 5,
      0.021,
      6,
      false,
    ),
    darkMaterial,
  );
  visibleJawOutline.userData.role =
    'dark-exposed-source-outline-of-single-moving-jaw';
  jawParts.jaw.add(visibleJawOutline);
  const jawPivotAnchor = new THREE.Group();
  jawPivotAnchor.userData.role = 'exact-fixed-pivot-anchor-of-single-jaw';
  jawParts.jaw.add(jawPivotAnchor);

  const jawScrewParts = makeFixedPivotScrew({
    darkMaterial,
    headRadius: sourcePivotHeadRadius * sourceScale,
    headZ: 0.38,
    pivot: sourceJawPivot,
    shaftRadius: 0.115,
    slotAngle: Math.PI / 2,
    slotLength: sourcePivotHeadRadius * sourceScale * 1.45,
    sourceOrigin,
    sourceScale,
    washerMajorRadius: sourcePivotHeadRadius * sourceScale * 0.88,
    whiteMaterial,
  });
  jawScrewParts.screw.userData.role =
    'fixed-large-screw-pivot-through-single-moving-jaw';

  const fixedScrewParts = sourceFixedScrewCenters.map((pivot, index) => {
    const parts = makeFixedPivotScrew({
      darkMaterial,
      headRadius: sourceFixedHeadRadius * sourceScale,
      headZ: fixedSideCenterZ + fixedSideDepth / 2 + 0.15,
      pivot,
      shaftRadius: 0.07,
      slotAngle: 1.08,
      slotLength: sourceFixedHeadRadius * sourceScale * 1.45,
      sourceOrigin,
      sourceScale,
      washerMajorRadius: sourceFixedHeadRadius * sourceScale * 0.84,
      whiteMaterial,
    });
    parts.screw.userData.role = 'screw-fastening-straight-side-piece-to-bed';
    parts.screw.userData.end = index === 0 ? 'upper' : 'lower';
    return parts;
  });

  const movingContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 20, 14),
    whiteMaterial,
  );
  movingContactMarker.userData.role =
    'visible-single-jaw-board-contact-marker';

  root.add(
    benchBase,
    jawParts.jaw,
    workpiece,
    fixedSidePiece,
    fixedSideOutline,
    fixedSideFaceWitness,
    jawScrewParts.screw,
    ...fixedScrewParts.map(({ screw }) => screw),
    movingContactMarker,
  );

  const canonicalStates = {
    sourceClosed: {
      ...stateAtCycleTime(0),
      canonicalStage: 'source-engraving-single-jaw-fully-clamped',
    },
    releaseMidpoint: {
      ...stateAtCycleTime((closedHoldEnd + releaseEnd) / 2),
      canonicalStage: 'downward-withdrawal-midpoint',
    },
    fullyOpen: {
      ...stateAtCycleTime((releaseEnd + openHoldEnd) / 2),
      canonicalStage: 'single-jaw-fully-open-dwell',
    },
    insertionMidpoint: {
      ...stateAtCycleTime((openHoldEnd + insertionEnd) / 2),
      canonicalStage: 'upward-self-clamping-midpoint',
    },
    relocked: {
      ...stateAtCycleTime(insertionEnd),
      canonicalStage: 'single-jaw-relocked-against-fixed-side',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    workpiece.position.y = state.workpieceTranslationY;
    workpiece.userData.velocity = state.workpieceVelocity.clone();
    jawParts.jaw.rotation.z = state.jawAngle;
    jawParts.jaw.userData.angularVelocity = state.jawAngularVelocity;
    movingContactMarker.position.copy(state.jawContactPoint);
    movingContactMarker.position.z = jawPlaneZ + jawDepth / 2 + 0.25;
    movingContactMarker.visible = state.clamped;
    root.userData.contacts = {
      fixedSidePiece: {
        boardFaceX: workpieceLeftX,
        fixedFaceX: fixedSideFaceX,
        gap: state.fixedSideContactGap,
        slidingContact: true,
      },
      movingEccentricJaw: {
        clamped: state.clamped,
        contactPoint: state.jawContactPoint.clone(),
        gap: state.minimumJawProfileGap,
        gapVelocity: state.movingJawContactGapVelocity,
        markedSourceContactGap: state.movingJawContactGap,
        minimumProfilePoint: state.minimumJawProfilePoint.clone(),
        minimumProfilePointIndex: state.minimumJawProfilePointIndex,
        withinBoardSpan: state.jawContactWithinBoardSpan,
      },
      pivotScrews: {
        fixedSideScrewRotation: 0,
        movingJawScrewRotation: 0,
      },
      workpieceGuide: {
        error: state.boardGuideError,
        translationAxis: new THREE.Vector3(0, 1, 0),
      },
    };
    root.userData.kinematics = state;
  };

  const geometry = {
    axis: Z_AXIS.clone(),
    baseMaximumX,
    baseMaximumY,
    baseMinimumX,
    baseMinimumY,
    benchCenterZ,
    benchDepth,
    closedHoldEnd,
    cyclePeriod,
    fixedSideBottomY,
    fixedSideCenterZ,
    fixedSideDepth,
    fixedSideFaceX,
    fixedSideMinimumX,
    fixedSideTopY,
    insertionDuration,
    insertionEnd,
    jawContactLocal: jawContactLocal.clone(),
    jawContactRadius,
    jawDepth,
    jawProfileLocalPoints,
    jawPivot: jawPivot.clone(),
    jawPlaneZ,
    openHoldEnd,
    openJawAngle,
    pivotBoreRadius,
    releaseDuration,
    releaseEnd,
    sourceFixedHeadRadius,
    sourceFixedScrewCenters: sourceFixedScrewCenters.map(
      (point) => point.clone(),
    ),
    sourceFixedSideBottom,
    sourceFixedSideMaximumX,
    sourceFixedSideMinimumX,
    sourceFixedSideOutline,
    sourceFixedSideTop,
    sourceImageHeight,
    sourceImageWidth,
    sourceJawContact: sourceJawContact.clone(),
    sourceJawContactIndex,
    sourceJawOutline,
    sourceJawPivot: sourceJawPivot.clone(),
    sourceOrigin: sourceOrigin.clone(),
    sourcePivotHeadRadius,
    sourceScale,
    sourceVisibleJawOutlineEndIndex,
    sourceWorkpieceBottom,
    sourceWorkpieceLeft,
    sourceWorkpieceOutline,
    sourceWorkpieceRight,
    sourceWorkpieceTop,
    workpieceBottomY,
    workpieceCenterZ,
    workpieceDepth,
    workpieceLeftX,
    workpieceReleaseTravel,
    workpieceRightX,
    workpieceTopY,
    workpieceWidth,
  };

  root.userData.archetype =
    'single-pivoted-eccentric-jaw-fixed-side-piece-self-energizing-bench-clamp';
  root.userData.blocks = {
    benchBase,
    fixedContactMarker,
    fixedScrewHeads: fixedScrewParts.map(({ head }) => head),
    fixedScrewShafts: fixedScrewParts.map(({ shaft }) => shaft),
    fixedScrewSlots: fixedScrewParts.map(({ slot }) => slot),
    fixedScrews: fixedScrewParts.map(({ screw }) => screw),
    fixedSideFaceWitness,
    fixedSideOutline,
    fixedSidePiece,
    jawContactAnchor: jawParts.camCenterAnchor,
    jawOutline: visibleJawOutline,
    jawPivotAnchor,
    jawPlate: jawParts.plate,
    jawRotationIndex: jawParts.rotationIndex,
    jawScrew: jawScrewParts.screw,
    jawScrewHead: jawScrewParts.head,
    jawScrewShaft: jawScrewParts.shaft,
    jawScrewSlot: jawScrewParts.slot,
    jawWasher: jawScrewParts.washer,
    movingContactMarker,
    pivotedJaw: jawParts.jaw,
    workpiece,
    workpieceBody,
    workpieceInputIndex,
    workpieceLeadingEdgeAnchor,
    workpieceOutline,
    workpieceRightFaceAnchor,
  };
  root.userData.cameraDistanceScale = 1.18;
  root.userData.canonicalStates = canonicalStates;
  root.userData.closureLawAtCycleTime = closureLawAtCycleTime;
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.mechanism =
    'fixed-straight-side-piece-single-screw-pivoted-eccentric-jaw-upward-friction-self-clamping-board';
  root.userData.modelPointToSourceRaster = modelPointToSourceRaster;
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.stateAtCycleTime = stateAtCycleTime;
  root.userData.stateAtTime = stateAtTime;

  update(0);
  markShadows(root);
  fixedSideOutline.castShadow = false;
  workpieceOutline.castShadow = false;
  movingContactMarker.castShadow = false;
  fixedContactMarker.castShadow = false;
  return {
    cameraDirection: new THREE.Vector3(5.0, 4.0, 16.0),
    root,
    update,
  };
}

function screwThrustLeverClamp() {
  const root = new THREE.Group();

  // Brown's side elevation supplies every working center in 190. A vertical
  // screw advances in the fixed lower arm, its collar bears on the short arm
  // of a holder pivoted at the central standard, and the long arm carries a
  // swiveling pressure shoe over the work. The source pose is fully clamped.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.017;
  const sourceHolderPivot = new THREE.Vector2(276, 299);
  const sourceShoePin = new THREE.Vector2(159, 298);
  const sourceShoeContact = new THREE.Vector2(159, 333);
  const sourceScrewAxis = new THREE.Vector2(372, 326);
  const sourceHolderBearingFaceY = 326;
  // The plate's handle bar sits at y 245-263, level with the holder crest.
  // The release is limited to a part turn so the bar never swings over the
  // crest: it stays right of the screw or clear of the cheeks in depth.
  const sourceHandleCenter = new THREE.Vector2(372, 254);
  const sourceHandleTip = new THREE.Vector2(460, 254);
  const sourceNutCenter = new THREE.Vector2(372, 358);
  const sourceBenchTopY = 374;
  const sourceBenchBottomY = 424;
  const sourceWorkpieceLeft = 105;
  const sourceWorkpieceRight = 214;
  const sourceWorkpieceTop = 333;
  const sourceWorkpieceBottom = sourceBenchTopY;
  const sourceHolderOutline = [
    [132, 289], [138, 280], [149, 274], [176, 262],
    [207, 253], [239, 250], [270, 252], [300, 263],
    [329, 279], [352, 296], [365, 302], [410, 304],
    [410, 324], [327, 326], [316, 322], [307, 311],
    [302, 298], [300, 286], [296, 275], [287, 266],
    [276, 263], [264, 266], [255, 276], [250, 290],
    [249, 305], [186, 305], [181, 313], [171, 319],
    [158, 321], [145, 317], [136, 309], [131, 298],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const sourceShoeOutline = [
    [137, 290], [148, 282], [159, 279], [171, 284],
    [179, 297], [185, 313], [208, 333], [105, 333],
    [119, 316], [130, 297],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const sourceFrameOutline = [
    [248, 374], [248, 288], [253, 274], [263, 265],
    [276, 262], [288, 267], [296, 279], [300, 298],
    [304, 318], [313, 335], [326, 346], [409, 346],
    [409, 374],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const sourcePointToModel = (point) => new THREE.Vector2(
    (point.x - sourceHolderPivot.x) * sourceScale,
    (sourceHolderPivot.y - point.y) * sourceScale,
  );
  const modelPointToSourceRaster = (point) => new THREE.Vector2(
    sourceHolderPivot.x + point.x / sourceScale,
    sourceHolderPivot.y - point.y / sourceScale,
  );
  const holderPivot = sourcePointToModel(sourceHolderPivot);
  const shoePinLocal = sourcePointToModel(sourceShoePin).sub(holderPivot);
  const shoeContactLocal = sourcePointToModel(sourceShoeContact)
    .sub(sourcePointToModel(sourceShoePin));
  const screwAxisX = sourcePointToModel(sourceScrewAxis).x;
  const holderBearingFaceLocalY = sourcePointToModel(new THREE.Vector2(
    sourceScrewAxis.x,
    sourceHolderBearingFaceY,
  )).y;
  const workpieceTopY = sourcePointToModel(new THREE.Vector2(
    sourceHolderPivot.x,
    sourceWorkpieceTop,
  )).y;
  const workpieceBottomY = sourcePointToModel(new THREE.Vector2(
    sourceHolderPivot.x,
    sourceWorkpieceBottom,
  )).y;
  const workpieceLeftX = sourcePointToModel(new THREE.Vector2(
    sourceWorkpieceLeft,
    sourceHolderPivot.y,
  )).x;
  const workpieceRightX = sourcePointToModel(new THREE.Vector2(
    sourceWorkpieceRight,
    sourceHolderPivot.y,
  )).x;
  const benchTopY = sourcePointToModel(new THREE.Vector2(
    sourceHolderPivot.x,
    sourceBenchTopY,
  )).y;
  const benchBottomY = sourcePointToModel(new THREE.Vector2(
    sourceHolderPivot.x,
    sourceBenchBottomY,
  )).y;
  const nutCenterY = sourcePointToModel(sourceNutCenter).y;
  const clampedHandleCenterY = sourcePointToModel(sourceHandleCenter).y;
  const handleRadius = sourcePointToModel(sourceHandleTip).x - screwAxisX;

  const holderPlateDepth = 0.12;
  const holderCheekCenterZ = 0.32;
  const collarRadius = 0.29;
  const collarContactZ = holderCheekCenterZ - holderPlateDepth / 2;
  // The finite collar supports both inner cheek edges. For the operating
  // angles (<= 0), first contact is the positive-X rim intersection, not
  // the screw axis. Opposed depth reactions cancel between the two cheeks.
  const collarContactOffsetX = Math.sqrt(collarRadius ** 2 - collarContactZ ** 2);
  const thrustContactX = screwAxisX + collarContactOffsetX;
  const holderBearingAtAngle = (holderAngle) => {
    const cosine = Math.cos(holderAngle);
    const sine = Math.sin(holderAngle);
    const localX = (
      thrustContactX - holderPivot.x
        + holderBearingFaceLocalY * sine
    ) / cosine;
    const localPoint = new THREE.Vector2(
      localX,
      holderBearingFaceLocalY,
    );
    const worldPoint = holderPivot.clone().add(
      rotateVector2(localPoint, holderAngle),
    );
    return { localPoint, worldPoint };
  };
  const holderBearingDerivatives = (holderAngle) => {
    const secant = 1 / Math.cos(holderAngle);
    const tangent = Math.tan(holderAngle);
    const horizontalOffset = thrustContactX - holderPivot.x;
    return {
      first: horizontalOffset * secant ** 2
        + holderBearingFaceLocalY * secant * tangent,
      second: 2 * horizontalOffset * secant ** 2 * tangent
        + holderBearingFaceLocalY
          * (secant * tangent ** 2 + secant ** 3),
    };
  };

  const clampedHolderAngle = 0;
  // A 0.04 rad release (about 0.42 turn of the screw) lifts the shoe clear
  // of the work while the handle, level with the crest as Brown draws it,
  // turns less than 160 degrees and so never crosses over the holder.
  const openHolderAngle = -0.04;
  const collarThickness = 0.14;
  const collarHalfThickness = collarThickness / 2;
  const openBearing = holderBearingAtAngle(openHolderAngle);
  const clampedBearing = holderBearingAtAngle(clampedHolderAngle);
  const screwAxialTravel = clampedBearing.worldPoint.y
    - openBearing.worldPoint.y;
  const openScrewOriginY = openBearing.worldPoint.y - collarHalfThickness;
  const clampedScrewOriginY = clampedBearing.worldPoint.y
    - collarHalfThickness;
  const threadPitch = 0.17;
  const threadLead = threadPitch;
  const threadLeadPerRadian = threadLead / FULL_TURN;
  const threadWaveNumber = FULL_TURN / threadPitch;
  const screwTighteningAngleTravel = -screwAxialTravel
    / threadLeadPerRadian;
  const screwTighteningTurns = screwTighteningAngleTravel / FULL_TURN;
  const threadCoreRadius = 0.115;
  const threadPitchRadius = 0.19;
  const externalThreadTubeRadius = 0.034;
  const internalThreadRadius = 0.235;
  const internalThreadTubeRadius = 0.020;
  const threadLocalMinimumY = -0.61;
  const screwCoreLocalMinimumY = -0.70;
  const handleLocalY = clampedHandleCenterY - clampedScrewOriginY;
  const screwCoreLocalMaximumY = handleLocalY + 0.09;
  // Brown hatches the screw right up to the handle block.
  const threadLocalMaximumY = handleLocalY - 0.14;
  const nutThreadMinimumY = nutCenterY - 0.17;
  const nutThreadMaximumY = nutCenterY + 0.17;
  const internalThreadPhaseAtMinimum = (
    nutThreadMinimumY - clampedScrewOriginY - threadLocalMinimumY
  ) * threadWaveNumber;
  const threadCrestRadius = threadPitchRadius + externalThreadTubeRadius;
  const externalProfile = { inner: threadCoreRadius - 0.001, outer: threadCrestRadius,
    low: threadLocalMinimumY, high: threadLocalMaximumY, width: threadPitch / 2,
    lead: -threadLeadPerRadian, phase: threadLocalMinimumY };
  const internalProfile = { ...externalProfile, inner: threadCoreRadius + 0.004,
    outer: threadCrestRadius + 0.004, low: nutThreadMinimumY, high: nutThreadMaximumY,
    width: threadPitch / 2 - 0.004,
    phase: clampedScrewOriginY + threadLocalMinimumY + threadPitch / 2 };
  const threadGeometry = profile => helicalThread(profile, threadAngles(profile, 96)).rotateX(-Math.PI / 2);
  const shoePinRadius = shoePinLocal.length();
  const clampedScrewArm = thrustContactX - holderPivot.x;
  const clampedWorkArm = holderPivot.x
    - sourcePointToModel(sourceShoeContact).x;
  const clampedLeverForceRatio = clampedScrewArm / clampedWorkArm;
  const idealClampForcePerHandleForce = handleRadius
    / threadLeadPerRadian * clampedLeverForceRatio;

  if (
    screwAxialTravel <= 0
      || screwTighteningTurns >= -0.25
      || screwTighteningTurns <= -160 / 360
      || clampedLeverForceRatio <= 0
  ) {
    throw new RangeError('Movement 190 source geometry cannot form a clamp.');
  }

  const cyclePeriod = 14;
  const sequenceBreaks = Object.freeze({
    clampedHoldEnd: 1.6,
    releaseEnd: 6.2,
    openHoldEnd: 8.0,
    tightenEnd: 12.6,
  });
  const releaseDuration = sequenceBreaks.releaseEnd
    - sequenceBreaks.clampedHoldEnd;
  const tightenDuration = sequenceBreaks.tightenEnd
    - sequenceBreaks.openHoldEnd;

  const closureLawAtCycleTime = (cycleTime) => {
    const resolvedCycleTime = THREE.MathUtils.clamp(
      cycleTime,
      0,
      cyclePeriod,
    );
    let closure = 1;
    let closureAcceleration = 0;
    let closureVelocity = 0;
    let normalizedEventProgress = 0;
    let stage = 'screw-thrusting-holder-shoe-against-workpiece';
    if (resolvedCycleTime < sequenceBreaks.clampedHoldEnd) {
      normalizedEventProgress = resolvedCycleTime
        / sequenceBreaks.clampedHoldEnd;
    } else if (resolvedCycleTime < sequenceBreaks.releaseEnd) {
      normalizedEventProgress = (
        resolvedCycleTime - sequenceBreaks.clampedHoldEnd
      ) / releaseDuration;
      closure = 1 - smootherStep01(normalizedEventProgress);
      closureVelocity = -smootherStepFirstDerivative(
        normalizedEventProgress,
      ) / releaseDuration;
      closureAcceleration = -smootherStepSecondDerivative(
        normalizedEventProgress,
      ) / releaseDuration ** 2;
      stage = 'handle-reversing-screw-and-opening-holder';
    } else if (resolvedCycleTime < sequenceBreaks.openHoldEnd) {
      closure = 0;
      normalizedEventProgress = (
        resolvedCycleTime - sequenceBreaks.releaseEnd
      ) / (sequenceBreaks.openHoldEnd - sequenceBreaks.releaseEnd);
      stage = 'screw-retracted-pressure-shoe-clear-of-workpiece';
    } else if (resolvedCycleTime < sequenceBreaks.tightenEnd) {
      normalizedEventProgress = (
        resolvedCycleTime - sequenceBreaks.openHoldEnd
      ) / tightenDuration;
      closure = smootherStep01(normalizedEventProgress);
      closureVelocity = smootherStepFirstDerivative(
        normalizedEventProgress,
      ) / tightenDuration;
      closureAcceleration = smootherStepSecondDerivative(
        normalizedEventProgress,
      ) / tightenDuration ** 2;
      stage = 'handle-turning-screw-up-under-holder-short-arm';
    } else {
      normalizedEventProgress = (
        resolvedCycleTime - sequenceBreaks.tightenEnd
      ) / (cyclePeriod - sequenceBreaks.tightenEnd);
    }
    return {
      closure,
      closureAcceleration,
      closureVelocity,
      cycleTime: resolvedCycleTime,
      normalizedEventProgress,
      stage,
    };
  };

  const stateAtClosure = ({
    closure,
    closureAcceleration = 0,
    closureVelocity = 0,
    cycleTime = 0,
    normalizedEventProgress = 0,
    stage = 'direct-configuration',
  }) => {
    const resolvedClosure = THREE.MathUtils.clamp(closure, 0, 1);
    const holderAngle = openHolderAngle * (1 - resolvedClosure);
    const holderAngularVelocity = -openHolderAngle * closureVelocity;
    const holderAngularAcceleration = -openHolderAngle
      * closureAcceleration;
    const bearing = holderBearingAtAngle(holderAngle);
    const derivatives = holderBearingDerivatives(holderAngle);
    const bearingVelocityY = derivatives.first * holderAngularVelocity;
    const bearingAccelerationY = derivatives.second
      * holderAngularVelocity ** 2
      + derivatives.first * holderAngularAcceleration;
    const screwOriginY = bearing.worldPoint.y - collarHalfThickness;
    const screwAxialDisplacement = screwOriginY - openScrewOriginY;
    const screwAxialVelocity = bearingVelocityY;
    const screwAxialAcceleration = bearingAccelerationY;
    const screwAngle = (
      screwAxialTravel - screwAxialDisplacement
    ) / threadLeadPerRadian;
    const screwAngularVelocity = -screwAxialVelocity
      / threadLeadPerRadian;
    const screwAngularAcceleration = -screwAxialAcceleration
      / threadLeadPerRadian;
    const shoePinVector = rotateVector2(shoePinLocal, holderAngle);
    const shoePinPoint = holderPivot.clone().add(shoePinVector);
    const shoeContactPoint = shoePinPoint.clone().add(shoeContactLocal);
    const shoePinTangent = new THREE.Vector2(
      -shoePinVector.y,
      shoePinVector.x,
    );
    const shoePinVelocity = shoePinTangent.clone().multiplyScalar(
      holderAngularVelocity,
    );
    const shoePinAcceleration = shoePinTangent.clone()
      .multiplyScalar(holderAngularAcceleration)
      .addScaledVector(shoePinVector, -(holderAngularVelocity ** 2));
    const shoeContactGap = shoeContactPoint.y - workpieceTopY;
    const externalThreadPhaseAtNut = (
      nutCenterY - screwOriginY - threadLocalMinimumY
    ) * threadWaveNumber - screwAngle;
    const internalThreadPhaseAtNut = (
      nutCenterY - nutThreadMinimumY
    ) * threadWaveNumber + internalThreadPhaseAtMinimum;
    const dynamicWorkArm = holderPivot.x - shoeContactPoint.x;
    const leverForceRatio = derivatives.first / dynamicWorkArm;
    const thrustContacts = [-1, 1].map(side => ({
      point: new THREE.Vector3(bearing.worldPoint.x, bearing.worldPoint.y, side * collarContactZ),
      // A permissible shared normal of the collar rim and inner cheek edge.
      normal: new THREE.Vector3(-Math.sin(holderAngle), Math.cos(holderAngle),
        -side * Math.sin(holderAngle) * collarContactZ / collarContactOffsetX).normalize(),
    }));
    return {
      bearingAccelerationY,
      bearingContactGap: bearing.worldPoint.y
        - (screwOriginY + collarHalfThickness),
      bearingLocalPoint: bearing.localPoint,
      bearingVelocityY,
      clamped: shoeContactGap <= 1e-12,
      clampForcePerHandleForce: handleRadius
        / threadLeadPerRadian * leverForceRatio,
      closure: resolvedClosure,
      closureAcceleration,
      closureVelocity,
      cycleTime,
      externalThreadPhaseAtNut,
      holderAngle,
      holderAngularAcceleration,
      holderAngularVelocity,
      holderBearingPoint: new THREE.Vector3(
        bearing.worldPoint.x,
        bearing.worldPoint.y,
        collarContactZ,
      ),
      idealThreadAdvanceError: screwAxialDisplacement
        + threadLeadPerRadian * (screwAngle + screwTighteningAngleTravel),
      internalThreadPhaseAtNut,
      leverForceRatio,
      normalizedEventProgress,
      pressureShoeAngle: 0,
      screwAngle,
      screwAngularAcceleration,
      screwAngularVelocity,
      screwAxialAcceleration,
      screwAxialDisplacement,
      screwAxialVelocity,
      screwOriginY,
      screwRevolutionsFromSource: screwAngle / FULL_TURN,
      screwAxisError: bearing.worldPoint.x - collarContactOffsetX - screwAxisX,
      shoeContactAcceleration: new THREE.Vector3(
        shoePinAcceleration.x,
        shoePinAcceleration.y,
        0,
      ),
      shoeContactGap,
      shoeContactPoint: new THREE.Vector3(
        shoeContactPoint.x,
        shoeContactPoint.y,
        0,
      ),
      shoeContactVelocity: new THREE.Vector3(
        shoePinVelocity.x,
        shoePinVelocity.y,
        0,
      ),
      shoePinPoint: new THREE.Vector3(
        shoePinPoint.x,
        shoePinPoint.y,
        0,
      ),
      shoePinRadiusError: Math.abs(shoePinVector.length() - shoePinRadius),
      stage,
      threadPhaseError: externalThreadPhaseAtNut
        - internalThreadPhaseAtNut,
      thrustCollarTopY: screwOriginY + collarHalfThickness,
      thrustContacts,
      workpieceContactCompression: Math.max(0, -shoeContactGap),
    };
  };

  const stateAtCycleTime = (cycleTime) => {
    const law = closureLawAtCycleTime(cycleTime);
    return stateAtClosure(law);
  };
  const stateAtTime = (time) => {
    const nonnegativeTime = Math.max(0, Number(time) || 0);
    const rawCompletedCycles = nonnegativeTime / cyclePeriod;
    const nearestCycleCount = Math.round(rawCompletedCycles);
    const onCycleBoundary = Math.abs(
      rawCompletedCycles - nearestCycleCount,
    ) < 1e-12;
    const completedCycles = onCycleBoundary
      ? nearestCycleCount
      : Math.floor(rawCompletedCycles);
    const cycleTime = onCycleBoundary
      ? 0
      : THREE.MathUtils.euclideanModulo(nonnegativeTime, cyclePeriod);
    return {
      ...stateAtCycleTime(cycleTime),
      completedCycles,
      time,
    };
  };

  const extrudeModelOutline = ({
    bevel = 0.014,
    depth,
    holes = [],
    modelPoints,
  }) => {
    if (bevel <= 0) {
      // Clipped finite plate: bores are true holes with outward-facing
      // walls, so pins seated in them read as clear rather than inside.
      const outline = poly(modelPoints.map((point) => [point.x, point.y]));
      return plate(holes.length
        ? polygonClipping.difference(outline, ...holes.map(({ center, radius }) => (
          poly(circle([center.x, center.y], radius, 96)))))
        : outline, -depth / 2, depth / 2);
    }
    const shape = new THREE.Shape();
    modelPoints.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    });
    shape.closePath();
    holes.forEach(({ center, radius }) => {
      const hole = new THREE.Path();
      hole.absarc(center.x, center.y, radius, 0, FULL_TURN, true);
      shape.holes.push(hole);
    });
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: bevel > 0,
      bevelSegments: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
      // Round bores need true arcs: a coarse polygon would pinch the pins.
      curveSegments: 64,
      depth,
    });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  };
  const outlineTube = (modelPoints, z, material, radius = 0.020) => {
    const curve = new THREE.CurvePath();
    for (let index = 0; index < modelPoints.length; index += 1) {
      const start = modelPoints[index];
      const end = modelPoints[(index + 1) % modelPoints.length];
      curve.add(new THREE.LineCurve3(
        new THREE.Vector3(start.x, start.y, z),
        new THREE.Vector3(end.x, end.y, z),
      ));
    }
    return new THREE.Mesh(
      new THREE.TubeGeometry(curve, modelPoints.length * 5, radius, 6, true),
      material,
    );
  };
  const verticalHelixCurve = ({
    maximumY,
    minimumY,
    phase = 0,
    pitch,
    radius,
  }) => {
    const height = maximumY - minimumY;
    return new class extends THREE.Curve {
      getPoint(parameter, target = new THREE.Vector3()) {
        const y = minimumY + height * parameter;
        const angle = phase + (y - minimumY) / pitch * FULL_TURN;
        return target.set(
          radius * Math.cos(angle),
          y,
          radius * Math.sin(angle),
        );
      }
    }();
  };

  const holderMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.61,
  });
  const shoeMaterial = matte(PALETTE.accent, {
    metalness: 0.09,
    roughness: 0.63,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.10,
    roughness: 0.67,
  });
  const screwMaterial = matte(PALETTE.driven, {
    metalness: 0.22,
    roughness: 0.46,
  });
  const threadMaterial = matte(0x244d63, {
    metalness: 0.26,
    roughness: 0.42,
  });
  const workpieceMaterial = matte(PALETTE.brass, {
    metalness: 0.02,
    roughness: 0.78,
  });
  const benchMaterial = matte(0x8b8172, {
    metalness: 0.01,
    roughness: 0.84,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const benchMinimumX = sourcePointToModel(new THREE.Vector2(
    35,
    sourceHolderPivot.y,
  )).x;
  const benchMaximumX = sourcePointToModel(new THREE.Vector2(
    495,
    sourceHolderPivot.y,
  )).x;
  const benchDepth = 1.80;
  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(
      benchMaximumX - benchMinimumX,
      benchTopY - benchBottomY,
      benchDepth,
    ),
    benchMaterial,
  );
  bench.position.set(
    (benchMinimumX + benchMaximumX) / 2,
    (benchTopY + benchBottomY) / 2,
    -0.16,
  );
  bench.userData.fixed = true;
  bench.userData.role = 'fixed-deep-bench-supporting-screw-clamp';

  const workpieceWidth = workpieceRightX - workpieceLeftX;
  const workpieceHeight = workpieceTopY - workpieceBottomY;
  const workpieceDepth = 0.98;
  const workpiece = new THREE.Mesh(
    new THREE.BoxGeometry(workpieceWidth, workpieceHeight, workpieceDepth),
    workpieceMaterial,
  );
  workpiece.position.set(
    (workpieceLeftX + workpieceRightX) / 2,
    (workpieceTopY + workpieceBottomY) / 2,
    0.08,
  );
  workpiece.userData.fixed = true;
  workpiece.userData.role = 'one-piece-of-work-held-down-on-bench';
  const workpieceTopWitness = new THREE.Mesh(
    new THREE.BoxGeometry(workpieceWidth * 0.80, 0.035, 0.055),
    whiteMaterial,
  );
  workpieceTopWitness.position.set(0, workpieceHeight / 2 + 0.022, 0.52);
  workpieceTopWitness.userData.role = 'white-index-on-workpiece-contact-face';
  workpiece.add(workpieceTopWitness);

  const frameModelPoints = sourceFrameOutline.map(sourcePointToModel);
  const frameDepth = 0.42;
  const fixedFrame = new THREE.Mesh(
    extrudeModelOutline({
      depth: frameDepth,
      holes: [{ center: holderPivot, radius: 0.19 }],
      modelPoints: frameModelPoints,
    }),
    frameMaterial,
  );
  // Drill the thickened lower arm along the screw axis, preserving its
  // front/rear ligaments instead of merely cutting a gap in the elevation.
  const armLeft = (326 - sourceHolderPivot.x) * sourceScale;
  const armRight = (409 - sourceHolderPivot.x) * sourceScale;
  const armLow = (sourceHolderPivot.y - 374) * sourceScale;
  const armHigh = (sourceHolderPivot.y - 346) * sourceScale;
  const rectangle = (left, bottom, right, top) => poly([[left, bottom], [right, bottom], [right, top], [left, top]]);
  bench.geometry.dispose();
  bench.geometry = plate(polygonClipping.difference(
    rectangle(-(benchMaximumX - benchMinimumX) / 2, -benchDepth / 2,
      (benchMaximumX - benchMinimumX) / 2, benchDepth / 2),
    poly(circle([screwAxisX - bench.position.x, bench.position.z], threadCrestRadius + 0.008, 128))),
    -(benchTopY - benchBottomY) / 2, (benchTopY - benchBottomY) / 2).rotateX(-Math.PI / 2);
  const upright = plate(polygonClipping.difference(poly(frameModelPoints.map(p => p.toArray())),
    rectangle(armLeft, armLow - 0.01, armRight + 0.01, armHigh + 0.000001),
    poly(circle(holderPivot.toArray(), 0.19, 128))), -frameDepth / 2, frameDepth / 2);
  const lowerArm = plate(polygonClipping.difference(rectangle(armLeft, -0.38, armRight, 0.38),
    poly(circle([screwAxisX, 0], threadCrestRadius + 0.004, 128))), armLow, armHigh)
    .rotateX(-Math.PI / 2);
  // Both generators are non-indexed; omit UVs to merge consistent attributes.
  upright.deleteAttribute('uv'); lowerArm.deleteAttribute('uv');
  fixedFrame.geometry.dispose(); fixedFrame.geometry = mergeGeometries([upright, lowerArm]);
  upright.dispose(); lowerArm.dispose();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-central-fulcrum-standard-and-lower-threaded-arm';
  // A fine ink line held between the screw thread crest (r 0.224), which it
  // crosses at the lower arm, and the front holder cheek (z 0.26).
  const frameOutline = outlineTube(
    frameModelPoints,
    frameDepth / 2 + 0.029,
    darkMaterial,
    0.014,
  );
  frameOutline.userData.role = 'dark-source-outline-of-fixed-clamp-frame';

  const holder = new THREE.Group();
  holder.position.set(holderPivot.x, holderPivot.y, 0);
  holder.userData.axis = Z_AXIS.clone();
  holder.userData.role =
    'one-rigid-two-cheek-holder-lever-on-fixed-fulcrum';
  // Recover the intended straight bearing land from its two-pixel slope
  // in the hand engraving. Keep the source points in measurement metadata.
  const holderModelPoints = sourceHolderOutline.map(point => sourcePointToModel(
    point.x >= 327 && point.y >= 324 ? new THREE.Vector2(point.x, sourceHolderBearingFaceY) : point));
  const holderLocalPoints = holderModelPoints.map((point) => point.clone().sub(
    holderPivot,
  ));
  const holderCheeks = [-1, 1].map((sideSign) => {
    const cheek = new THREE.Mesh(
      extrudeModelOutline({
        bevel: 0,
        depth: holderPlateDepth,
        holes: [
          { center: new THREE.Vector2(0, 0), radius: 0.18 },
          { center: shoePinLocal, radius: 0.145 },
        ],
        modelPoints: holderLocalPoints,
      }),
      holderMaterial,
    );
    cheek.position.z = sideSign * holderCheekCenterZ;
    cheek.userData.role = sideSign < 0
      ? 'rear-source-profiled-holder-cheek'
      : 'front-source-profiled-holder-cheek';
    cheek.userData.sideSign = sideSign;
    const outline = outlineTube(
      holderLocalPoints,
      sideSign * holderCheekCenterZ
        + sideSign * (holderPlateDepth / 2 + 0.022),
      darkMaterial,
    );
    outline.userData.role = `${cheek.userData.role}-dark-outline`;
    holder.add(cheek, outline);
    return cheek;
  });
  const holderIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.050, 0.028),
    whiteMaterial,
  );
  holderIndex.position.copy(new THREE.Vector3(
    sourcePointToModel(new THREE.Vector2(222, 255)).x,
    sourcePointToModel(new THREE.Vector2(222, 255)).y,
    holderCheekCenterZ + holderPlateDepth / 2 + 0.054,
  ));
  holderIndex.rotation.z = -0.08;
  holderIndex.userData.role = 'white-index-fixed-to-holder-long-arm';
  holder.add(holderIndex);

  const shoe = new THREE.Group();
  shoe.userData.axis = Z_AXIS.clone();
  shoe.userData.role =
    'gravity-aligned-swiveling-pressure-shoe-on-long-holder-arm';
  const shoeLocalPoints = sourceShoeOutline.map((point) => new THREE.Vector2(
    (point.x - sourceShoePin.x) * sourceScale,
    (sourceShoePin.y - point.y) * sourceScale,
  ));
  // The shoe sits between the holder cheeks (inner faces at z = 0.26) with
  // its ink outline clear of them; no bevel, so the sole seats flush.
  const shoeDepth = 0.40;
  const shoePlate = new THREE.Mesh(
    extrudeModelOutline({
      bevel: 0,
      depth: shoeDepth,
      holes: [{ center: new THREE.Vector2(0, 0), radius: 0.14 }],
      modelPoints: shoeLocalPoints,
    }),
    shoeMaterial,
  );
  shoePlate.userData.role = 'source-profiled-swiveling-pressure-shoe';
  // The ink line along the sole is lifted by its tube radius so it does not
  // sink into the work it presses.
  const shoeOutline = outlineTube(
    shoeLocalPoints.map((point) => (
      Math.abs(point.y - shoeContactLocal.y) < 1e-9
        ? new THREE.Vector2(point.x, point.y + 0.021)
        : point
    )),
    shoeDepth / 2 + 0.024,
    darkMaterial,
  );
  shoeOutline.userData.role = 'dark-source-outline-of-pressure-shoe';
  const shoeContactIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.040, 0.040),
    whiteMaterial,
  );
  shoeContactIndex.position.set(
    shoeContactLocal.x,
    shoeContactLocal.y + 0.022,
    shoeDepth / 2 + 0.052,
  );
  shoeContactIndex.userData.role = 'white-index-on-pressure-shoe-sole';
  shoe.add(shoePlate, shoeOutline, shoeContactIndex);

  const fulcrumPin = cylinderAlongZ(0.16, 1.02, darkMaterial, 40);
  fulcrumPin.position.set(holderPivot.x, holderPivot.y, 0);
  fulcrumPin.userData.fixed = true;
  fulcrumPin.userData.role = 'fixed-fulcrum-pin-through-frame-and-holder-cheeks';
  const fulcrumHead = cylinderAlongZ(0.25, 0.11, darkMaterial, 42);
  fulcrumHead.position.set(
    holderPivot.x,
    holderPivot.y,
    holderCheekCenterZ + holderPlateDepth / 2 + 0.105,
  );
  fulcrumHead.userData.fixed = true;
  fulcrumHead.userData.role = 'front-head-on-fixed-holder-fulcrum-pin';
  const shoePin = cylinderAlongZ(0.125, 0.88, darkMaterial, 36);
  shoePin.position.set(shoePinLocal.x, shoePinLocal.y, 0);
  shoePin.userData.role = 'pin-joint-between-holder-cheeks-and-pressure-shoe';
  holder.add(shoePin);

  const nutBody = new THREE.Mesh(
    chamferedHex({ radius: 0.34, bore: threadCrestRadius + 0.004,
      low: -0.17, high: 0.17, phase: 0, bottomBevel: 0.02, topBevel: 0.02 },
    Array.from({ length: 193 }, (_, i) => i * FULL_TURN / 192)).rotateX(-Math.PI / 2),
    darkMaterial,
  );
  nutBody.position.set(screwAxisX, nutCenterY, 0);
  nutBody.rotation.y = Math.PI / 6;
  nutBody.userData.fixed = true;
  nutBody.userData.role = 'one-fixed-hexagonal-nut-in-lower-frame-arm';
  const internalThreadCurve = verticalHelixCurve({
    maximumY: nutThreadMaximumY,
    minimumY: nutThreadMinimumY,
    phase: internalThreadPhaseAtMinimum,
    pitch: threadPitch,
    radius: internalThreadRadius,
  });
  const internalThread = new THREE.Mesh(
    threadGeometry(internalProfile),
    shoeMaterial,
  );
  internalThread.position.x = screwAxisX;
  internalThread.userData.fixed = true;
  internalThread.userData.role = 'stationary-matching-internal-nut-thread';
  internalThread.userData.screwThread = true;

  const screw = new THREE.Group();
  screw.position.set(screwAxisX, clampedScrewOriginY, 0);
  screw.userData.axis = new THREE.Vector3(0, 1, 0);
  screw.userData.role =
    'one-rigid-vertical-translating-right-hand-power-screw';
  const screwRotor = new THREE.Group();
  screwRotor.userData.axis = new THREE.Vector3(0, 1, 0);
  screwRotor.userData.role = 'screw-thread-handle-and-thrust-collar-common-rotor';
  screw.add(screwRotor);
  const screwCore = new THREE.Mesh(
    new THREE.CylinderGeometry(
      threadCoreRadius,
      threadCoreRadius,
      screwCoreLocalMaximumY - screwCoreLocalMinimumY,
      36,
    ),
    screwMaterial,
  );
  screwCore.position.y = (
    screwCoreLocalMinimumY + screwCoreLocalMaximumY
  ) / 2;
  screwCore.userData.role = 'continuous-core-of-vertical-power-screw';
  const externalThreadCurve = verticalHelixCurve({
    maximumY: threadLocalMaximumY,
    minimumY: threadLocalMinimumY,
    pitch: threadPitch,
    radius: threadPitchRadius,
  });
  const externalThread = new THREE.Mesh(
    threadGeometry(externalProfile),
    threadMaterial,
  );
  externalThread.userData.handedness = 'right';
  externalThread.userData.role = 'single-start-right-hand-external-screw-thread';
  externalThread.userData.screwThread = true;
  const thrustCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(collarRadius, collarRadius, collarThickness, 512),
    screwMaterial,
  );
  thrustCollar.userData.role =
    'rotating-thrust-collar-bearing-under-holder-short-arms';
  const collarIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.008, 0.040, 0.035),
    whiteMaterial,
  );
  collarIndex.position.x = collarRadius - 0.002;
  collarIndex.userData.role = 'white-index-on-rotating-thrust-collar';
  const handleHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.18, 36),
    darkMaterial,
  );
  handleHub.position.y = handleLocalY;
  handleHub.userData.role = 'hub-rigid-with-top-of-power-screw';
  const handleArm = new THREE.Mesh(
    new THREE.BoxGeometry(handleRadius + 0.24, 0.14, 0.16),
    screwMaterial,
  );
  handleArm.position.set((handleRadius - 0.24) / 2, handleLocalY, 0);
  handleArm.userData.role = 'one-sided-radial-screw-turning-handle';
  const handleGrip = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.115, 0.36, 8, 18),
    darkMaterial,
  );
  handleGrip.position.set(handleRadius, handleLocalY + 0.29, 0);
  handleGrip.userData.role = 'upright-freehand-grip-at-handle-tip';
  const handleIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.035, 0.185),
    whiteMaterial,
  );
  handleIndex.position.set(handleRadius * 0.68, handleLocalY + 0.088, 0);
  handleIndex.userData.role = 'white-index-showing-screw-handle-rotation';
  const handleTipAnchor = new THREE.Object3D();
  handleTipAnchor.position.set(handleRadius, handleLocalY, 0);
  handleTipAnchor.userData.role = 'analytic-handle-tip-anchor';
  screwRotor.add(
    collarIndex,
    externalThread,
    handleArm,
    handleGrip,
    handleHub,
    handleIndex,
    handleTipAnchor,
    screwCore,
    thrustCollar,
  );

  const holderPivotAnchor = new THREE.Object3D();
  holderPivotAnchor.position.set(holderPivot.x, holderPivot.y, 0);
  holderPivotAnchor.userData.role = 'analytic-fixed-holder-fulcrum-anchor';
  const shoePinAnchor = new THREE.Object3D();
  shoePinAnchor.position.set(shoePinLocal.x, shoePinLocal.y, 0);
  shoePinAnchor.userData.role = 'analytic-holder-to-shoe-pin-anchor';
  holder.add(shoePinAnchor);
  const workContactAnchor = new THREE.Object3D();
  workContactAnchor.position.set(
    shoeContactLocal.x,
    shoeContactLocal.y,
    0,
  );
  workContactAnchor.userData.role = 'analytic-pressure-shoe-contact-anchor';
  shoe.add(workContactAnchor);
  const thrustContactAnchor = new THREE.Object3D();
  thrustContactAnchor.userData.role = 'analytic-screw-to-holder-thrust-anchor';
  const nutAxisAnchor = new THREE.Object3D();
  nutAxisAnchor.position.set(screwAxisX, nutCenterY, 0);
  nutAxisAnchor.userData.role = 'analytic-fixed-nut-axis-anchor';
  const workContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 18, 12),
    whiteMaterial,
  );
  workContactMarker.userData.role = 'white-marker-at-shoe-workpiece-contact';
  const thrustContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.080, 18, 12),
    whiteMaterial,
  );
  thrustContactMarker.userData.role = 'white-marker-at-screw-holder-contact';
  const threadContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.066, 16, 10),
    whiteMaterial,
  );
  const threadContactPhase = (
    nutCenterY - nutThreadMinimumY
  ) * threadWaveNumber + internalThreadPhaseAtMinimum;
  threadContactMarker.position.set(
    screwAxisX + threadPitchRadius * Math.cos(threadContactPhase),
    nutCenterY,
    threadPitchRadius * Math.sin(threadContactPhase),
  );
  threadContactMarker.userData.role = 'white-marker-at-fixed-thread-mesh-phase';

  root.add(
    bench,
    fixedFrame,
    frameOutline,
    fulcrumHead,
    fulcrumPin,
    holder,
    holderPivotAnchor,
    internalThread,
    nutAxisAnchor,
    nutBody,
    screw,
    shoe,
    threadContactMarker,
    thrustContactAnchor,
    thrustContactMarker,
    workContactMarker,
    workpiece,
  );

  const canonicalTimes = Object.freeze({
    sourceClamped: 0,
    midRelease: (sequenceBreaks.clampedHoldEnd
      + sequenceBreaks.releaseEnd) / 2,
    fullyOpen: sequenceBreaks.releaseEnd,
    midTighten: (sequenceBreaks.openHoldEnd
      + sequenceBreaks.tightenEnd) / 2,
    reclamped: sequenceBreaks.tightenEnd,
  });
  const canonicalStates = Object.freeze(Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtCycleTime(time),
    ]),
  ));

  const update = (time) => {
    const state = stateAtTime(time);
    holder.rotation.z = state.holderAngle;
    shoe.position.copy(state.shoePinPoint);
    shoe.rotation.z = state.pressureShoeAngle;
    screw.position.y = state.screwOriginY;
    screwRotor.rotation.y = state.screwAngle;
    thrustContactAnchor.position.copy(state.holderBearingPoint);
    thrustContactMarker.position.set(
      state.holderBearingPoint.x,
      state.holderBearingPoint.y,
      holderCheekCenterZ + holderPlateDepth / 2 + 0.11,
    );
    workContactMarker.position.set(
      state.shoeContactPoint.x,
      state.shoeContactPoint.y,
      shoeDepth / 2 + 0.10,
    );
    holder.userData.angle = state.holderAngle;
    holder.userData.angularSpeed = state.holderAngularVelocity;
    shoe.userData.contactGap = state.shoeContactGap;
    screw.userData.axialDisplacement = state.screwAxialDisplacement;
    screw.userData.axialSpeed = state.screwAxialVelocity;
    screw.userData.angularSpeed = state.screwAngularVelocity;
    root.userData.state = state;
  };

  const geometry = {
    benchBottomY,
    benchDepth,
    benchMaximumX,
    benchMinimumX,
    benchTopY,
    clampedHandleCenterY,
    clampedHolderAngle,
    clampedLeverForceRatio,
    clampedScrewArm,
    clampedScrewOriginY,
    clampedWorkArm,
    collarHalfThickness,
    collarThickness,
    collarRadius,
    collarContactOffsetX,
    collarContactZ,
    thrustContactX,
    cyclePeriod,
    externalThreadTubeRadius,
    frameDepth,
    handleLocalY,
    handleRadius,
    holderBearingFaceLocalY,
    holderCheekCenterZ,
    holderLocalPoints,
    holderPivot: holderPivot.clone(),
    holderPlateDepth,
    idealClampForcePerHandleForce,
    internalThreadPhaseAtMinimum,
    internalThreadRadius,
    internalThreadTubeRadius,
    nutCenterY,
    nutThreadMaximumY,
    nutThreadMinimumY,
    openHolderAngle,
    openScrewOriginY,
    screwAxialTravel,
    screwAxisX,
    screwCoreLocalMaximumY,
    screwCoreLocalMinimumY,
    screwTighteningAngleTravel,
    screwTighteningTurns,
    sequenceBreaks,
    shoeContactLocal: shoeContactLocal.clone(),
    shoeDepth,
    shoeLocalPoints,
    shoePinLocal: shoePinLocal.clone(),
    shoePinRadius,
    sourceBenchBottomY,
    sourceBenchTopY,
    sourceFrameOutline: sourceFrameOutline.map((point) => point.clone()),
    sourceHandleCenter: sourceHandleCenter.clone(),
    sourceHandleTip: sourceHandleTip.clone(),
    sourceHolderBearingFaceY,
    sourceHolderOutline: sourceHolderOutline.map((point) => point.clone()),
    sourceHolderPivot: sourceHolderPivot.clone(),
    sourceImageHeight,
    sourceImageWidth,
    sourceNutCenter: sourceNutCenter.clone(),
    sourceScale,
    sourceScrewAxis: sourceScrewAxis.clone(),
    sourceShoeContact: sourceShoeContact.clone(),
    sourceShoeOutline: sourceShoeOutline.map((point) => point.clone()),
    sourceShoePin: sourceShoePin.clone(),
    sourceWorkpieceBottom,
    sourceWorkpieceLeft,
    sourceWorkpieceRight,
    sourceWorkpieceTop,
    threadCoreRadius,
    threadLead,
    threadLeadPerRadian,
    threadLocalMaximumY,
    threadLocalMinimumY,
    threadPitch,
    threadPitchRadius,
    threadWaveNumber,
    workpieceBottomY,
    workpieceDepth,
    workpieceLeftX,
    workpieceRightX,
    workpieceTopY,
  };

  root.userData.archetype =
    'vertical-screw-thrust-pivoted-holder-lever-workpiece-clamp';
  root.userData.blocks = {
    bench,
    externalThread,
    fixedFrame,
    frameOutline,
    fulcrumHead,
    fulcrumPin,
    handleArm,
    handleGrip,
    handleHub,
    handleIndex,
    handleTipAnchor,
    holder,
    holderCheeks,
    holderIndex,
    holderPivotAnchor,
    internalThread,
    nutAxisAnchor,
    nutBody,
    screw,
    screwCore,
    screwRotor,
    shoe,
    shoeContactIndex,
    shoeOutline,
    shoePin,
    shoePinAnchor,
    shoePlate,
    threadContactMarker,
    thrustCollar,
    thrustContactAnchor,
    thrustContactMarker,
    workContactAnchor,
    workContactMarker,
    workpiece,
    workpieceTopWitness,
  };
  root.userData.cameraDistanceScale = 1.03;
  // Brown draws 190 as a flat side elevation; a narrow field keeps the
  // bench plank a section instead of showing its top face.
  root.userData.cameraFov = 10;
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.closureLawAtCycleTime = closureLawAtCycleTime;
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.holderBearingAtAngle = holderBearingAtAngle;
  root.userData.mechanism =
    'vertical-right-hand-screw-in-fixed-nut-thrusts-short-arm-of-fixed-fulcrum-holder-so-long-arm-shoe-clamps-workpiece';
  root.userData.modelPointToSourceRaster = modelPointToSourceRaster;
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.stateAtClosure = stateAtClosure;
  root.userData.stateAtCycleTime = stateAtCycleTime;
  root.userData.stateAtTime = stateAtTime;

  root.userData.sourceAnimation = {
    available: false, independentlyReconstructed: true,
    sourceUrl: 'https://507movements.com/mm_190.html',
    reason: 'The official page has no ae.add_model or mm_present animation definition.',
  };
  root.userData.hideGround = true;
  root.userData.solidReview = { externalProfile, internalProfile, threadCrestRadius,
    flankClearance: 0.002, qualification: 'Prescribed lead law and gravity-aligned shoe; inferred square threads and bored lower arm. Finite collar-rim/cheek-edge support is analytic; holder return, shoe gravity alignment, friction and load response remain prescribed.' };
  root.traverse(object => { for (const material of object.material ? [].concat(object.material) : []) material.fog = false; });
  update(0);
  markShadows(root);
  for (const object of [
    frameOutline,
    holderIndex,
    shoeContactIndex,
    shoeOutline,
    threadContactMarker,
    thrustContactMarker,
    workContactMarker,
    workpieceTopWitness,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(5.2, 3.7, 15.5),
    root,
    update,
  };
}

export function createAuthoredClampMovement(movement) {
  if (movement.id === 174) return twinPivotedBenchClamp();
  if (movement.id === 180) return singlePivotedFixedSideBenchClamp();
  if (movement.id === 190) return screwThrustLeverClamp();
  return null;
}
