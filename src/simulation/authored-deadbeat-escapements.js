import * as THREE from 'three';
import { correctAnchorEscapement } from './anchor-escapement-working-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongZ(radius, length, material, segments = 34) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevelSize = 0.008) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 10,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function rotate2(point, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
}

function crossZ(point) {
  return new THREE.Vector2(-point.y, point.x);
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function polygonShape(points) {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  });
  shape.closePath();
  return shape;
}

function beamBetween(start, end, width, depth, material) {
  const direction = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(direction.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(direction.y, direction.x);
  return beam;
}

function edgeTube(points, depth, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(
      point.x,
      point.y,
      depth / 2 + 0.014,
    )),
    false,
    'centripetal',
  );
  const edge = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 48, radius, 8, false),
    material,
  );
  edge.userData.role = role;
  return edge;
}

function makeDeadbeatPallet(lockPoints, impulsePoints, {
  depth,
  sideName,
  thickness,
}) {
  const root = new THREE.Group();
  const workingPath = [
    ...lockPoints.slice().reverse(),
    ...impulsePoints.slice(1),
  ];
  const innerPath = workingPath.map((point) => point.clone()
    .addScaledVector(point.clone().normalize(), -thickness));
  const body = new THREE.Mesh(
    centeredExtrusion(polygonShape([
      ...workingPath,
      ...innerPath.reverse(),
    ]), depth, 0.006),
    matte(PALETTE.accent, { metalness: 0.18, roughness: 0.50 }),
  );
  body.userData.role = `${sideName}-deadbeat-pallet-solid`;
  const edgeMaterial = matte(PALETTE.white, {
    metalness: 0.12,
    roughness: 0.42,
  });
  const lockEdge = edgeTube(
    lockPoints,
    depth,
    0.042,
    edgeMaterial,
    `${sideName}-concentric-locking-face`,
  );
  const impulseEdge = edgeTube(
    impulsePoints,
    depth,
    0.054,
    edgeMaterial,
    `${sideName}-impulse-face`,
  );
  root.add(body, lockEdge, impulseEdge);
  root.userData.body = body;
  root.userData.impulseEdge = impulseEdge;
  root.userData.impulsePoints = impulsePoints;
  root.userData.lockEdge = lockEdge;
  root.userData.lockPoints = lockPoints;
  return root;
}

function deadbeatAnchorEscapement(movement) {
  const root = new THREE.Group();

  // The official page has no canvas animation. Brown's plate and description
  // nevertheless define the essential constraint exactly: H's inner locking
  // face and K's outer locking face are circular about arbor a, so the escape
  // wheel is motionless throughout lock. Separate c-e and d-b impulse faces
  // then advance the wheel before the free drop to the opposite pallet.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.016;
  const sourceRasterAnchorPivot = new THREE.Vector2(260, 49);
  const sourceRasterWheelCenter = new THREE.Vector2(261, 350);
  const sourceRasterLeftLockCornerC = new THREE.Vector2(109, 333);
  const sourceRasterLeftImpulseEndE = new THREE.Vector2(88, 362);
  const sourceRasterRightLockCornerD = new THREE.Vector2(409, 329);
  const sourceRasterRightImpulseEndB = new THREE.Vector2(432, 359);
  const sourceRasterLeftPalletH = new THREE.Vector2(75, 331);
  const sourceRasterRightPalletK = new THREE.Vector2(448, 322);
  const sourceRasterDirectionArrow = new THREE.Vector2(111, 463);
  const sourceRasterWheelTipRadius = 151;
  const anchorPivot = new THREE.Vector2(0, 3.55);
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    anchorPivot.x + (x - sourceRasterAnchorPivot.x) * sourceScale,
    anchorPivot.y + (sourceRasterAnchorPivot.y - y) * sourceScale,
  );
  const wheelCenter = sourcePointToModel(sourceRasterWheelCenter);

  const toothCount = 30;
  const toothPitch = FULL_TURN / toothCount;
  const halfToothPitch = toothPitch / 2;
  const wholePalletSpanTeeth = 14;
  const palletSpanTeeth = wholePalletSpanTeeth + 0.5;
  const palletSpanAngle = palletSpanTeeth * toothPitch;
  const leftLockReferenceAngle = Math.PI / 2 + palletSpanAngle / 2;
  const rightLockReferenceAngle = Math.PI / 2 - palletSpanAngle / 2;
  const toothLeanAngle = toothPitch * 0.15;
  const wheelRootRadius = 2.05;
  const toothTipRadius = sourceRasterWheelTipRadius * sourceScale;
  const wheelInnerRadius = 1.48;
  const wheelDepth = 0.36;
  const anchorDepth = 0.43;

  const pendulumPeriod = 4;
  const halfBeatDuration = pendulumPeriod / 2;
  const anchorAmplitude = THREE.MathUtils.degToRad(5);
  const lockingAmplitudeFraction = 0.34;
  const releaseAmplitudeFraction = 0.06;
  const landingHalfPhase = Math.asin(lockingAmplitudeFraction) / Math.PI;
  const impulseStartHalfPhase = 1 - landingHalfPhase;
  const releaseHalfPhase = 1
    - Math.asin(releaseAmplitudeFraction) / Math.PI;
  const impulseAnchorSpan = (
    lockingAmplitudeFraction - releaseAmplitudeFraction
  ) * anchorAmplitude;
  const impulseAdvance = THREE.MathUtils.degToRad(1.35);
  const freeDropAdvance = halfToothPitch - impulseAdvance;
  const dropDuration = (
    1 - releaseHalfPhase + landingHalfPhase
  ) * halfBeatDuration;

  const sideForHalfBeat = (halfBeatIndex) => (
    positiveModulo(halfBeatIndex, 2) === 0 ? 1 : -1
  );
  const activeToothIndexForHalfBeat = (halfBeatIndex) => {
    const oscillationIndex = Math.floor(halfBeatIndex / 2);
    return sideForHalfBeat(halfBeatIndex) > 0
      ? positiveModulo(-oscillationIndex, toothCount)
      : positiveModulo(
        toothCount - wholePalletSpanTeeth - 1 - oscillationIndex,
        toothCount,
      );
  };
  const lockReferenceAngleForSide = (side) => (
    side > 0
      ? leftLockReferenceAngle
      : rightLockReferenceAngle
  );
  const initialWheelLandingAngle = leftLockReferenceAngle
    + toothLeanAngle;
  const wheelAngleAtHalfLanding = (halfBeatIndex) => (
    initialWheelLandingAngle + halfBeatIndex * halfToothPitch
  );
  const lockContactPointForSide = (side) => {
    const angle = lockReferenceAngleForSide(side);
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * toothTipRadius,
      Math.sin(angle) * toothTipRadius,
    ));
  };
  const lockLocalContactPoint = (side, anchorAngle) => rotate2(
    lockContactPointForSide(side).sub(anchorPivot),
    -anchorAngle,
  );
  const impulseProgressAtAnchorAngle = (side, anchorAngle) => (
    (
      lockingAmplitudeFraction * anchorAmplitude
        - side * anchorAngle
    ) / impulseAnchorSpan
  );
  const impulseWheelDeltaAtAnchorAngle = (side, anchorAngle) => {
    const progress = impulseProgressAtAnchorAngle(side, anchorAngle);
    return impulseAdvance * progress ** 2;
  };
  const impulseWheelSlopeAtAnchorAngle = (side, anchorAngle) => {
    const progress = impulseProgressAtAnchorAngle(side, anchorAngle);
    return -side * 2 * impulseAdvance * progress / impulseAnchorSpan;
  };
  const impulseContactPoint = (side, anchorAngle) => {
    const toothAngle = lockReferenceAngleForSide(side)
      + impulseWheelDeltaAtAnchorAngle(side, anchorAngle);
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(toothAngle) * toothTipRadius,
      Math.sin(toothAngle) * toothTipRadius,
    ));
  };
  const impulseLocalContactPoint = (side, anchorAngle) => rotate2(
    impulseContactPoint(side, anchorAngle).sub(anchorPivot),
    -anchorAngle,
  );
  const lockFacePoints = (side, pointCount = 45) => Array.from(
    { length: pointCount },
    (_, index) => {
      const magnitude = THREE.MathUtils.lerp(
        lockingAmplitudeFraction * anchorAmplitude,
        anchorAmplitude,
        index / (pointCount - 1),
      );
      return lockLocalContactPoint(side, side * magnitude);
    },
  );
  const impulseFacePoints = (side, pointCount = 25) => Array.from(
    { length: pointCount },
    (_, index) => {
      const magnitude = THREE.MathUtils.lerp(
        lockingAmplitudeFraction * anchorAmplitude,
        releaseAmplitudeFraction * anchorAmplitude,
        index / (pointCount - 1),
      );
      return impulseLocalContactPoint(side, side * magnitude);
    },
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.55,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.57,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.69,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role =
    'counterclockwise-driven-thirty-tooth-deadbeat-escape-wheel-A';
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'deadbeat-stepping-escape-wheel-rotor';
  escapeWheel.add(wheelRotor);
  const wheelShape = new THREE.Shape();
  for (let toothIndex = 0; toothIndex < toothCount; toothIndex += 1) {
    const centerAngle = toothIndex * toothPitch;
    const outlinePoints = [
      new THREE.Vector2(
        Math.cos(centerAngle - toothPitch * 0.48) * wheelRootRadius,
        Math.sin(centerAngle - toothPitch * 0.48) * wheelRootRadius,
      ),
      new THREE.Vector2(
        Math.cos(centerAngle - toothLeanAngle) * toothTipRadius,
        Math.sin(centerAngle - toothLeanAngle) * toothTipRadius,
      ),
      new THREE.Vector2(
        Math.cos(centerAngle + toothPitch * 0.48) * wheelRootRadius,
        Math.sin(centerAngle + toothPitch * 0.48) * wheelRootRadius,
      ),
    ];
    for (const point of outlinePoints) {
      if (toothIndex === 0 && point === outlinePoints[0]) {
        wheelShape.moveTo(point.x, point.y);
      } else {
        wheelShape.lineTo(point.x, point.y);
      }
    }
  }
  wheelShape.closePath();
  const wheelOpening = new THREE.Path();
  wheelOpening.absarc(0, 0, wheelInnerRadius, 0, FULL_TURN, true);
  wheelShape.holes.push(wheelOpening);
  const toothedRim = new THREE.Mesh(
    centeredExtrusion(wheelShape, wheelDepth, 0.006),
    driverMaterial,
  );
  toothedRim.userData.role = 'thirty-deadbeat-escape-wheel-teeth';
  wheelRotor.add(toothedRim);
  const spokeMeshes = [];
  for (let spokeIndex = 0; spokeIndex < 4; spokeIndex += 1) {
    const angle = Math.PI / 4 + spokeIndex * Math.PI / 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(1.58, 0.25, wheelDepth * 0.82),
      driverMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * 0.82,
      Math.sin(angle) * 0.82,
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `deadbeat-escape-wheel-spoke-${spokeIndex + 1}`;
    spokeMeshes.push(spoke);
    wheelRotor.add(spoke);
  }
  const wheelHub = cylinderAlongZ(0.39, 0.74, darkMaterial, 38);
  wheelHub.userData.role = 'deadbeat-escape-wheel-arbor-hub-v';
  wheelRotor.add(wheelHub);
  const wheelShaft = cylinderAlongZ(0.13, 1.35, darkMaterial, 34);
  wheelShaft.userData.role = 'fixed-axis-deadbeat-wheel-shaft';
  escapeWheel.add(wheelShaft);
  const wheelIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 16, 12),
    indexMaterial,
  );
  wheelIndex.position.set(
    Math.cos(-toothLeanAngle) * (toothTipRadius - 0.06),
    Math.sin(-toothLeanAngle) * (toothTipRadius - 0.06),
    wheelDepth / 2 + 0.08,
  );
  wheelIndex.userData.role = 'white-index-on-deadbeat-wheel-tooth-zero';
  wheelRotor.add(wheelIndex);

  const anchor = new THREE.Group();
  anchor.position.set(anchorPivot.x, anchorPivot.y, 0.24);
  anchor.userData.axis = Z_AXIS.clone();
  anchor.userData.role = 'pendulum-rocked-deadbeat-anchor-H-L-K';
  const sourceOutlineRaster = [
    [244, 49],
    [276, 49],
    [277, 172],
    [323, 186],
    [368, 209],
    [405, 244],
    [433, 289],
    [449, 338],
    [431, 352],
    [409, 328],
    [390, 263],
    [359, 232],
    [322, 208],
    [280, 198],
    [238, 198],
    [198, 207],
    [161, 228],
    [133, 251],
    [111, 327],
    [89, 359],
    [72, 349],
    [84, 306],
    [105, 261],
    [137, 221],
    [178, 192],
    [220, 178],
    [243, 171],
  ];
  const anchorOutline = sourceOutlineRaster.map(([x, y]) => (
    new THREE.Vector2(
      (x - sourceRasterAnchorPivot.x) * sourceScale,
      (sourceRasterAnchorPivot.y - y) * sourceScale,
    )
  ));
  const anchorBody = new THREE.Mesh(
    centeredExtrusion(polygonShape(anchorOutline), anchorDepth, 0.012),
    drivenMaterial,
  );
  anchorBody.userData.role =
    'source-profiled-deadbeat-anchor-body-H-L-K';
  const leftLockPoints = lockFacePoints(1);
  const rightLockPoints = lockFacePoints(-1);
  const leftImpulsePoints = impulseFacePoints(1);
  const rightImpulsePoints = impulseFacePoints(-1);
  const leftPallet = makeDeadbeatPallet(
    leftLockPoints,
    leftImpulsePoints,
    { depth: anchorDepth + 0.05, sideName: 'left-H', thickness: 0.27 },
  );
  leftPallet.userData.role =
    'inner-locking-pallet-H-with-c-e-impulse-face';
  const rightPallet = makeDeadbeatPallet(
    rightLockPoints,
    rightImpulsePoints,
    { depth: anchorDepth + 0.05, sideName: 'right-K', thickness: 0.27 },
  );
  rightPallet.userData.role =
    'outer-locking-pallet-K-with-d-b-impulse-face';
  const anchorPivotHub = cylinderAlongZ(0.25, 0.90, darkMaterial, 34);
  anchorPivotHub.userData.role = 'deadbeat-anchor-arbor-a';
  const crutchIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.09, 0.30),
    indexMaterial,
  );
  crutchIndex.position.set(0, 1.55, 0.02);
  crutchIndex.userData.role = 'white-index-on-deadbeat-anchor-stem-L';
  anchor.add(
    anchorBody,
    leftPallet,
    rightPallet,
    anchorPivotHub,
    crutchIndex,
  );

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 18, 14),
    indexMaterial,
  );
  contactMarker.position.z = 0.62;
  contactMarker.userData.role =
    'white-marker-on-active-deadbeat-contact';

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-clock-plate-and-two-arbor-bearings';
  const rearStandard = beamBetween(
    new THREE.Vector3(0, wheelCenter.y - 3.52, -0.95),
    new THREE.Vector3(0, anchorPivot.y + 2.10, -0.95),
    0.22,
    0.24,
    frameMaterial,
  );
  rearStandard.userData.role = 'rear-deadbeat-clock-plate-standard';
  const wheelBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.37, 0.08, 10, 42),
    frameMaterial,
  );
  wheelBearing.position.set(wheelCenter.x, wheelCenter.y, -0.62);
  wheelBearing.userData.role = 'fixed-deadbeat-wheel-arbor-bearing';
  const anchorBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.33, 0.08, 10, 42),
    frameMaterial,
  );
  anchorBearing.position.set(anchorPivot.x, anchorPivot.y, -0.62);
  anchorBearing.userData.role = 'fixed-deadbeat-anchor-arbor-bearing';
  const baseY = wheelCenter.y - toothTipRadius - 1.18;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(7.4, 0.24, 0.82),
    frameMaterial,
  );
  base.position.set(0, baseY, -0.70);
  base.userData.role = 'fixed-deadbeat-clock-frame-base';
  fixedFrame.add(rearStandard, wheelBearing, anchorBearing, base);

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(8.8, 12.2, 2.8),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.y = 0.10;
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-deadbeat-wheel-anchor-and-stem';

  root.add(
    cameraEnvelope,
    fixedFrame,
    escapeWheel,
    anchor,
    contactMarker,
  );

  const impulseReleaseAnchorAngle = releaseAmplitudeFraction
    * anchorAmplitude;
  const impulseReleaseAnchorSpeed = anchorAmplitude * Math.PI
    * Math.cos(Math.PI * releaseHalfPhase) / halfBeatDuration;
  const impulseReleaseAnchorAcceleration = -anchorAmplitude
    * Math.PI ** 2 * Math.sin(Math.PI * releaseHalfPhase)
    / halfBeatDuration ** 2;
  const releaseProgressRate = -impulseReleaseAnchorSpeed
    / impulseAnchorSpan;
  const releaseProgressAcceleration = -impulseReleaseAnchorAcceleration
    / impulseAnchorSpan;
  const impulseReleaseWheelSpeed = 2 * impulseAdvance
    * releaseProgressRate;
  const impulseReleaseWheelAcceleration = 2 * impulseAdvance * (
    releaseProgressRate ** 2 + releaseProgressAcceleration
  );
  const freeDropAngularAcceleration = 2 * (
    freeDropAdvance - impulseReleaseWheelSpeed * dropDuration
  ) / dropDuration ** 2;
  const freeDropLandingWheelSpeed = impulseReleaseWheelSpeed
    + freeDropAngularAcceleration * dropDuration;
  const landingImpactVelocityChange = -freeDropLandingWheelSpeed;

  const stateAtTime = (time) => {
    const halfBeatCoordinate = time / halfBeatDuration;
    const halfBeatIndex = Math.floor(halfBeatCoordinate);
    const halfPhase = halfBeatCoordinate - halfBeatIndex;
    const side = sideForHalfBeat(halfBeatIndex);
    const anchorAngle = side * anchorAmplitude
      * Math.sin(Math.PI * halfPhase);
    const anchorAngularSpeed = side * anchorAmplitude * Math.PI
      * Math.cos(Math.PI * halfPhase) / halfBeatDuration;
    const anchorAngularAcceleration = -side * anchorAmplitude
      * Math.PI ** 2 * Math.sin(Math.PI * halfPhase)
      / halfBeatDuration ** 2;
    const eventTolerance = 1e-12;
    const lockActive = halfPhase >= landingHalfPhase - eventTolerance
      && halfPhase < impulseStartHalfPhase - eventTolerance;
    const impulseActive = halfPhase >= (
      impulseStartHalfPhase - eventTolerance
    ) && halfPhase <= releaseHalfPhase + eventTolerance;
    const contactActive = lockActive || impulseActive;
    let wheelAngle;
    let wheelAngularSpeed;
    let wheelAngularAcceleration;
    let activeHalfBeatIndex = halfBeatIndex;
    let stage;
    let dropProgress = null;
    let impulseProgress = null;
    if (lockActive) {
      wheelAngle = wheelAngleAtHalfLanding(halfBeatIndex);
      wheelAngularSpeed = 0;
      wheelAngularAcceleration = 0;
      stage = Math.abs(halfPhase - 0.5) <= eventTolerance
        ? side > 0
          ? 'left-pallet-deadbeat-maximum-lock'
          : 'right-pallet-deadbeat-maximum-lock'
        : side > 0
          ? 'left-pallet-deadbeat-lock'
          : 'right-pallet-deadbeat-lock';
    } else if (impulseActive) {
      impulseProgress = THREE.MathUtils.clamp(
        impulseProgressAtAnchorAngle(side, anchorAngle),
        0,
        1,
      );
      const progressRate = -side * anchorAngularSpeed
        / impulseAnchorSpan;
      const progressAcceleration = -side * anchorAngularAcceleration
        / impulseAnchorSpan;
      wheelAngle = wheelAngleAtHalfLanding(halfBeatIndex)
        + impulseAdvance * impulseProgress ** 2;
      wheelAngularSpeed = 2 * impulseAdvance
        * impulseProgress * progressRate;
      wheelAngularAcceleration = 2 * impulseAdvance * (
        progressRate ** 2
          + impulseProgress * progressAcceleration
      );
      stage = side > 0
        ? 'left-pallet-c-e-return-impulse'
        : 'right-pallet-d-b-return-impulse';
    } else {
      const earlyDrop = halfPhase < landingHalfPhase;
      const dropStartHalfBeat = earlyDrop
        ? halfBeatIndex - 1
        : halfBeatIndex;
      const dropEndHalfBeat = dropStartHalfBeat + 1;
      const dropStartCoordinate = dropStartHalfBeat + releaseHalfPhase;
      const currentCoordinate = halfBeatIndex + halfPhase;
      const elapsedDropTime = (
        currentCoordinate - dropStartCoordinate
      ) * halfBeatDuration;
      dropProgress = elapsedDropTime / dropDuration;
      const dropStartWheelAngle = wheelAngleAtHalfLanding(
        dropStartHalfBeat,
      ) + impulseAdvance;
      wheelAngle = dropStartWheelAngle
        + impulseReleaseWheelSpeed * elapsedDropTime
        + 0.5 * freeDropAngularAcceleration * elapsedDropTime ** 2;
      wheelAngularSpeed = impulseReleaseWheelSpeed
        + freeDropAngularAcceleration * elapsedDropTime;
      wheelAngularAcceleration = freeDropAngularAcceleration;
      activeHalfBeatIndex = dropEndHalfBeat;
      stage = sideForHalfBeat(dropEndHalfBeat) > 0
        ? 'free-drop-forward-to-left-deadbeat-pallet'
        : 'free-drop-forward-to-right-deadbeat-pallet';
    }
    const activeSide = contactActive
      ? side
      : sideForHalfBeat(activeHalfBeatIndex);
    const activeToothIndex = activeToothIndexForHalfBeat(
      activeHalfBeatIndex,
    );
    const activeToothAngle = wheelAngle
      + activeToothIndex * toothPitch - toothLeanAngle;
    const activeToothPoint = wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(activeToothAngle) * toothTipRadius,
      Math.sin(activeToothAngle) * toothTipRadius,
    ));
    let contact = null;
    if (contactActive) {
      const contactMode = lockActive ? 'concentric-lock' : 'impulse';
      const expectedPoint = lockActive
        ? lockContactPointForSide(side)
        : impulseContactPoint(side, anchorAngle);
      const localPoint = lockActive
        ? lockLocalContactPoint(side, anchorAngle)
        : impulseLocalContactPoint(side, anchorAngle);
      const wheelRadiusVector = activeToothPoint.clone().sub(wheelCenter);
      const anchorRadiusVector = activeToothPoint.clone().sub(anchorPivot);
      const toothVelocity = crossZ(wheelRadiusVector)
        .multiplyScalar(wheelAngularSpeed);
      const palletMaterialVelocity = crossZ(anchorRadiusVector)
        .multiplyScalar(anchorAngularSpeed);
      const toothAngleDerivativeByAnchor = lockActive
        ? 0
        : impulseWheelSlopeAtAnchorAngle(side, anchorAngle);
      const faceTangentWorld = crossZ(wheelRadiusVector)
        .multiplyScalar(toothAngleDerivativeByAnchor)
        .sub(crossZ(anchorRadiusVector));
      const faceTangent = faceTangentWorld.clone().normalize();
      const faceNormal = new THREE.Vector2(
        -faceTangent.y,
        faceTangent.x,
      );
      const relativeVelocity = toothVelocity.clone()
        .sub(palletMaterialVelocity);
      contact = {
        concentricRadiusError: lockActive
          ? Math.abs(
            localPoint.length()
              - lockContactPointForSide(side).distanceTo(anchorPivot)
          )
          : null,
        expectedPoint,
        faceNormal,
        faceTangent,
        localPoint,
        mode: contactMode,
        normalVelocityError: relativeVelocity.dot(faceNormal),
        palletMaterialVelocity,
        pointError: activeToothPoint.distanceTo(expectedPoint),
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
        side,
        toothVelocity,
      };
    }
    const cycleIndex = Math.floor(time / pendulumPeriod);
    const cyclePhase = time / pendulumPeriod - cycleIndex;
    return {
      activeHalfBeatIndex,
      activeSide,
      activeToothAngle,
      activeToothIndex,
      activeToothPoint,
      anchorAngle,
      anchorAngularAcceleration,
      anchorAngularSpeed,
      contact,
      contactActive,
      contactMode: contact?.mode ?? null,
      cycleIndex,
      cyclePhase,
      dropProgress,
      halfBeatIndex,
      halfPhase,
      impulseProgress,
      stage,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * pendulumPeriod,
  );
  const canonicalTimes = {
    leftImpulseStart: impulseStartHalfPhase * halfBeatDuration,
    leftLanding: landingHalfPhase * halfBeatDuration,
    leftMaximumLock: halfBeatDuration / 2,
    leftRelease: releaseHalfPhase * halfBeatDuration,
    oneToothAdvance: pendulumPeriod,
    rightImpulseStart: halfBeatDuration
      + impulseStartHalfPhase * halfBeatDuration,
    rightLanding: halfBeatDuration
      + landingHalfPhase * halfBeatDuration,
    rightMaximumLock: halfBeatDuration * 1.5,
    rightRelease: halfBeatDuration
      + releaseHalfPhase * halfBeatDuration,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    anchor.rotation.z = state.anchorAngle;
    anchor.userData.angularAcceleration = state.anchorAngularAcceleration;
    anchor.userData.angularSpeed = state.anchorAngularSpeed;
    wheelRotor.rotation.z = state.wheelAngle;
    wheelRotor.userData.angularAcceleration =
      state.wheelAngularAcceleration;
    wheelRotor.userData.angularSpeed = state.wheelAngularSpeed;
    contactMarker.visible = state.contactActive;
    if (state.contactActive) {
      contactMarker.position.set(
        state.activeToothPoint.x,
        state.activeToothPoint.y,
        0.62,
      );
    }
    root.userData.contacts = state.contactActive
      ? {
        activePallet: state.activeSide > 0
          ? 'inner-left-H'
          : 'outer-right-K',
        activeToothIndex: state.activeToothIndex,
        mode: state.contactMode,
        normalVelocityError: state.contact.normalVelocityError,
        pointError: state.contact.pointError,
        relativeSlipSpeed: state.contact.relativeSlipSpeed,
      }
      : {
        activePallet: null,
        activeToothIndex: state.activeToothIndex,
        dropProgress: state.dropProgress,
        mode: null,
        normalVelocityError: null,
        pointError: null,
        relativeSlipSpeed: null,
      };
    root.userData.kinematics = state;
  };

  const radiusRange = (points) => {
    const radii = points.map((point) => point.length());
    return Math.max(...radii) - Math.min(...radii);
  };
  root.userData.archetype =
    'thirty-tooth-deadbeat-anchor-escapement-concentric-locking-faces';
  root.userData.mechanism =
    'one pendulum-rocked anchor H-L-K alternately arrests a 30-tooth escape wheel on H inner and K outer locking faces cut exactly concentric with arbor a; the wheel therefore remains perfectly at rest throughout each outward-and-return locking arc, advances only while a tooth slides along impulse face c-e or d-b, then drops freely to the opposite pallet';
  root.userData.transmission = {
    deadbeat: 'wheel angular speed and acceleration are exactly zero throughout both concentric locking intervals',
    direction: 'escape wheel advances counterclockwise under train torque',
    halfBeatAdvance: halfToothPitch,
    impulse: 'each returning pallet transfers energy over its short nonconcentric impulse face before release',
    oscillationAdvance: toothPitch,
    recoil: 'none: the locked escape wheel never reverses',
    toothCount,
  };
  root.userData.blocks = {
    anchor,
    anchorBearing,
    anchorBody,
    anchorPivotHub,
    base,
    cameraEnvelope,
    contactMarker,
    crutchIndex,
    escapeWheel,
    fixedFrame,
    leftPallet,
    rearStandard,
    rightPallet,
    spokeMeshes,
    toothedRim,
    wheelBearing,
    wheelHub,
    wheelIndex,
    wheelRotor,
    wheelShaft,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = {
    anchorAmplitude,
    anchorDepth,
    anchorPivot: anchorPivot.clone(),
    dropDuration,
    eventPeriod: pendulumPeriod,
    freeDropAdvance,
    freeDropAngularAcceleration,
    freeDropLandingWheelSpeed,
    halfBeatDuration,
    halfToothPitch,
    impulseAdvance,
    impulseAnchorSpan,
    impulseReleaseAnchorAngle,
    impulseReleaseWheelAcceleration,
    impulseReleaseWheelSpeed,
    impulseStartHalfPhase,
    landingHalfPhase,
    landingImpactVelocityChange,
    leftLockReferenceAngle,
    lockingAmplitudeFraction,
    palletSpanAngle,
    palletSpanTeeth,
    pendulumPeriod,
    releaseAmplitudeFraction,
    releaseHalfPhase,
    rightLockReferenceAngle,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    toothCount,
    toothLeanAngle,
    toothPitch,
    toothTipRadius,
    wheelCenter: wheelCenter.clone(),
    wheelDepth,
    wheelInnerRadius,
    wheelRootRadius,
    wholePalletSpanTeeth,
  };
  root.userData.impulseContactPoint = impulseContactPoint;
  root.userData.impulseFacePoints = impulseFacePoints;
  root.userData.impulseLocalContactPoint = impulseLocalContactPoint;
  root.userData.lockContactPointForSide = lockContactPointForSide;
  root.userData.lockFacePoints = lockFacePoints;
  root.userData.lockLocalContactPoint = lockLocalContactPoint;
  root.userData.palletProfiles = {
    left: {
      impulseConcentricRadiusRange: radiusRange(leftImpulsePoints),
      impulsePoints: leftImpulsePoints,
      impulseSourceLabels: ['c', 'e'],
      lockConcentricRadiusRange: radiusRange(leftLockPoints),
      lockPoints: leftLockPoints,
      lockSurface: 'inner face of H',
      side: 1,
    },
    right: {
      impulseConcentricRadiusRange: radiusRange(rightImpulsePoints),
      impulsePoints: rightImpulsePoints,
      impulseSourceLabels: ['d', 'b'],
      lockConcentricRadiusRange: radiusRange(rightLockPoints),
      lockPoints: rightLockPoints,
      lockSurface: 'outer face of K',
      side: -1,
    },
  };
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'The official 288/289 pages expose Brown’s static engravings and shared description but mark animation unavailable. Movement 289’s stationary lock, impulse, and drop timing are independently reconstructed from the stated concentric locking faces and labeled c-e/d-b impulse faces.',
    sourceUrl: 'https://507movements.com/mm_289.html',
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate289: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'a wide anchor H-L-K rocks about a above a counterclockwise 30-tooth escape wheel A; H inner and K outer locking faces are concentric about a, followed by c-e and d-b impulse faces',
      measurementUncertaintyPixels: 7,
      rasterAnchorPivot: sourceRasterAnchorPivot.clone(),
      rasterDirectionArrow: sourceRasterDirectionArrow.clone(),
      rasterLeftImpulseEndE: sourceRasterLeftImpulseEndE.clone(),
      rasterLeftLockCornerC: sourceRasterLeftLockCornerC.clone(),
      rasterLeftPalletH: sourceRasterLeftPalletH.clone(),
      rasterRightImpulseEndB: sourceRasterRightImpulseEndB.clone(),
      rasterRightLockCornerD: sourceRasterRightLockCornerD.clone(),
      rasterRightPalletK: sourceRasterRightPalletK.clone(),
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
      rasterWheelTipRadius: sourceRasterWheelTipRadius,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 77,
      edition: 21,
      illustrationPage: 76,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: pendulumPeriod,
    schedule: [
      'left-pallet-landing-and-deadbeat-lock',
      'left-pallet-c-e-impulse-and-release',
      'free-drop-to-right-pallet',
      'right-pallet-landing-and-deadbeat-lock',
      'right-pallet-d-b-impulse-and-release',
      'free-drop-to-left-pallet',
    ],
  };
  root.userData.wheelAngleAtHalfLanding = wheelAngleAtHalfLanding;

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
    contactMarker,
    crutchIndex,
    wheelIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  cameraEnvelope.castShadow = false;
  cameraEnvelope.receiveShadow = false;
  root.userData.fidelity = 'authored';
  correctAnchorEscapement(root, 289, update);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

function grahamDeadbeatPendulumEscapement(movement) {
  const root = new THREE.Group();

  // Brown's plate is the conventional front elevation of a Graham deadbeat:
  // a clockwise escape wheel, two short pallets carried from the apex arbor,
  // and the pendulum rigidly continuing below that arbor. D's outer face and
  // E's inner face are circular about the apex, so a locked tooth cannot move
  // the escape wheel while the pendulum finishes either excursion.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterAnchorPivot = new THREE.Vector2(263, 29);
  const sourceRasterWheelCenter = new THREE.Vector2(254, 257);
  const sourceRasterWheelTipRadius = 151;
  const sourceRasterWheelBounds = Object.freeze({
    bottom: 407,
    left: 104,
    right: 405,
    top: 106,
  });
  const sourceRasterLeftPalletD = new THREE.Vector2(111, 127);
  const sourceRasterLeftImpulseA = new THREE.Vector2(145, 157);
  const sourceRasterRightImpulseB = new THREE.Vector2(362, 155);
  const sourceRasterRightPalletE = new THREE.Vector2(396, 126);
  const sourceRasterPendulumEndpoints = [
    sourceRasterAnchorPivot.clone(),
    new THREE.Vector2(255, 476),
  ];
  const sourceRasterDirectionArrow = Object.freeze({
    end: new THREE.Vector2(327, 101),
    start: new THREE.Vector2(207, 101),
  });
  const toothCount = 30;
  const toothPitch = FULL_TURN / toothCount;
  const halfToothPitch = toothPitch / 2;
  const sourceScale = 2.45 / sourceRasterWheelTipRadius;
  const wheelCenter = new THREE.Vector2(0, 0);
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterWheelCenter.x) * sourceScale,
    (sourceRasterWheelCenter.y - y) * sourceScale,
  );
  const anchorPivot = sourcePointToModel(sourceRasterAnchorPivot);

  const direction = -1;
  const wholePalletSpanTeeth = 7;
  const palletSpanTeeth = wholePalletSpanTeeth + 0.5;
  const palletSpanAngle = palletSpanTeeth * toothPitch;
  const leftLockReferenceAngle = Math.PI / 2 + palletSpanAngle / 2;
  const rightLockReferenceAngle = Math.PI / 2 - palletSpanAngle / 2;
  const toothLeanAngle = toothPitch * 0.16;
  const toothTipRadius = sourceRasterWheelTipRadius * sourceScale;
  const wheelRootRadius = 2.05;
  const wheelInnerRadius = 1.48;
  const wheelDepth = 0.34;
  const anchorDepth = 0.4;

  const pendulumPeriod = 4;
  const halfBeatDuration = pendulumPeriod / 2;
  const anchorAmplitude = THREE.MathUtils.degToRad(5);
  const lockingAmplitudeFraction = 0.34;
  const releaseAmplitudeFraction = 0.06;
  const landingHalfPhase = Math.asin(lockingAmplitudeFraction) / Math.PI;
  const impulseStartHalfPhase = 1 - landingHalfPhase;
  const releaseHalfPhase = 1
    - Math.asin(releaseAmplitudeFraction) / Math.PI;
  const impulseAnchorSpan = (
    lockingAmplitudeFraction - releaseAmplitudeFraction
  ) * anchorAmplitude;
  const impulseAdvance = THREE.MathUtils.degToRad(4);
  const freeDropAdvance = halfToothPitch - impulseAdvance;
  const dropDuration = (
    1 - releaseHalfPhase + landingHalfPhase
  ) * halfBeatDuration;
  const sourceTimeOffset = pendulumPeriod * 0.75;

  const sideForHalfBeat = (halfBeatIndex) => (
    positiveModulo(halfBeatIndex, 2) === 0 ? 1 : -1
  );
  const activeToothIndexForHalfBeat = (halfBeatIndex) => {
    const oscillationIndex = Math.floor(halfBeatIndex / 2);
    return sideForHalfBeat(halfBeatIndex) > 0
      ? positiveModulo(oscillationIndex, toothCount)
      : positiveModulo(
        toothCount - wholePalletSpanTeeth + oscillationIndex,
        toothCount,
      );
  };
  const lockReferenceAngleForSide = (side) => (
    side > 0 ? leftLockReferenceAngle : rightLockReferenceAngle
  );
  const initialWheelLandingAngle = leftLockReferenceAngle
    + toothLeanAngle;
  const wheelAngleAtHalfLanding = (halfBeatIndex) => (
    initialWheelLandingAngle
      + direction * halfBeatIndex * halfToothPitch
  );
  const lockContactPointForSide = (side) => {
    const angle = lockReferenceAngleForSide(side);
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * toothTipRadius,
      Math.sin(angle) * toothTipRadius,
    ));
  };
  const lockLocalContactPoint = (side, anchorAngle) => rotate2(
    lockContactPointForSide(side).sub(anchorPivot),
    -anchorAngle,
  );
  const impulseProgressAtAnchorAngle = (side, anchorAngle) => (
    (
      lockingAmplitudeFraction * anchorAmplitude
        - side * anchorAngle
    ) / impulseAnchorSpan
  );
  const impulseMotion = (progress) => progress ** 3 * (
    10 + progress * (-15 + 6 * progress)
  );
  const impulseMotionDerivative = (progress) => (
    30 * progress ** 2 * (1 - progress) ** 2
  );
  const impulseMotionSecondDerivative = (progress) => (
    60 * progress * (1 - progress) * (1 - 2 * progress)
  );
  const impulseWheelDeltaAtAnchorAngle = (side, anchorAngle) => (
    direction * impulseAdvance
      * impulseMotion(impulseProgressAtAnchorAngle(side, anchorAngle))
  );
  const impulseWheelSlopeAtAnchorAngle = (side, anchorAngle) => {
    const progress = impulseProgressAtAnchorAngle(side, anchorAngle);
    return -direction * side * impulseAdvance
      * impulseMotionDerivative(progress) / impulseAnchorSpan;
  };
  const impulseContactPoint = (side, anchorAngle) => {
    const toothAngle = lockReferenceAngleForSide(side)
      + impulseWheelDeltaAtAnchorAngle(side, anchorAngle);
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(toothAngle) * toothTipRadius,
      Math.sin(toothAngle) * toothTipRadius,
    ));
  };
  const impulseLocalContactPoint = (side, anchorAngle) => rotate2(
    impulseContactPoint(side, anchorAngle).sub(anchorPivot),
    -anchorAngle,
  );
  const lockFacePoints = (side, pointCount = 45) => Array.from(
    { length: pointCount },
    (_, index) => {
      const magnitude = THREE.MathUtils.lerp(
        lockingAmplitudeFraction * anchorAmplitude,
        anchorAmplitude,
        index / (pointCount - 1),
      );
      return lockLocalContactPoint(side, side * magnitude);
    },
  );
  const impulseFacePoints = (side, pointCount = 31) => Array.from(
    { length: pointCount },
    (_, index) => {
      const magnitude = THREE.MathUtils.lerp(
        lockingAmplitudeFraction * anchorAmplitude,
        releaseAmplitudeFraction * anchorAmplitude,
        index / (pointCount - 1),
      );
      return impulseLocalContactPoint(side, side * magnitude);
    },
  );

  const wheelMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const anchorMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.57,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.27,
    roughness: 0.45,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.69,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role =
    'clockwise-thirty-tooth-Graham-deadbeat-escape-wheel';
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'clockwise-deadbeat-wheel-rotor';
  escapeWheel.add(wheelRotor);
  const wheelShape = new THREE.Shape();
  for (let toothIndex = 0; toothIndex < toothCount; toothIndex += 1) {
    const centerAngle = toothIndex * toothPitch;
    const outlinePoints = [
      new THREE.Vector2(
        Math.cos(centerAngle - toothPitch * 0.48) * wheelRootRadius,
        Math.sin(centerAngle - toothPitch * 0.48) * wheelRootRadius,
      ),
      new THREE.Vector2(
        Math.cos(centerAngle - toothLeanAngle) * toothTipRadius,
        Math.sin(centerAngle - toothLeanAngle) * toothTipRadius,
      ),
      new THREE.Vector2(
        Math.cos(centerAngle + toothPitch * 0.48) * wheelRootRadius,
        Math.sin(centerAngle + toothPitch * 0.48) * wheelRootRadius,
      ),
    ];
    for (const [pointIndex, point] of outlinePoints.entries()) {
      if (toothIndex === 0 && pointIndex === 0) {
        wheelShape.moveTo(point.x, point.y);
      } else {
        wheelShape.lineTo(point.x, point.y);
      }
    }
  }
  wheelShape.closePath();
  const wheelOpening = new THREE.Path();
  wheelOpening.absarc(0, 0, wheelInnerRadius, 0, FULL_TURN, true);
  wheelShape.holes.push(wheelOpening);
  const toothedRim = new THREE.Mesh(
    centeredExtrusion(wheelShape, wheelDepth, 0.006),
    wheelMaterial,
  );
  toothedRim.userData.role = 'thirty-forward-leaning-deadbeat-teeth';
  wheelRotor.add(toothedRim);
  const spokeMeshes = [];
  for (let spokeIndex = 0; spokeIndex < 4; spokeIndex += 1) {
    const angle = Math.PI / 4 + spokeIndex * Math.PI / 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(1.72, 0.22, wheelDepth * 0.78),
      wheelMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * 0.88,
      Math.sin(angle) * 0.88,
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.index = spokeIndex;
    spoke.userData.role = 'Graham-escape-wheel-spoke';
    spokeMeshes.push(spoke);
    wheelRotor.add(spoke);
  }
  const wheelHub = cylinderAlongZ(0.37, 0.68, darkMaterial, 38);
  wheelHub.userData.role = 'Graham-escape-wheel-hub';
  wheelRotor.add(wheelHub);
  const wheelShaft = cylinderAlongZ(0.12, 1.22, darkMaterial, 32);
  wheelShaft.userData.role = 'fixed-Graham-escape-wheel-arbor';
  escapeWheel.add(wheelShaft);
  const wheelIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 18, 12),
    indexMaterial,
  );
  wheelIndex.position.set(
    Math.cos(-toothLeanAngle) * (toothTipRadius - 0.06),
    Math.sin(-toothLeanAngle) * (toothTipRadius - 0.06),
    wheelDepth / 2 + 0.075,
  );
  wheelIndex.userData.role = 'white-Graham-wheel-index';
  wheelRotor.add(wheelIndex);

  const anchor = new THREE.Group();
  anchor.position.set(anchorPivot.x, anchorPivot.y, 0.25);
  anchor.userData.axis = Z_AXIS.clone();
  anchor.userData.role = 'pendulum-carried-Graham-anchor';
  const leftLockPoints = lockFacePoints(1);
  const rightLockPoints = lockFacePoints(-1);
  const leftImpulsePoints = impulseFacePoints(1);
  const rightImpulsePoints = impulseFacePoints(-1);
  const leftPallet = makeDeadbeatPallet(
    leftLockPoints,
    leftImpulsePoints,
    { depth: anchorDepth + 0.06, sideName: 'left-D', thickness: 0.27 },
  );
  leftPallet.userData.role =
    'left-pallet-D-outer-dead-face-and-A-impulse-face';
  const rightPallet = makeDeadbeatPallet(
    rightLockPoints,
    rightImpulsePoints,
    { depth: anchorDepth + 0.06, sideName: 'right-E', thickness: 0.27 },
  );
  rightPallet.userData.role =
    'right-pallet-E-inner-dead-face-and-B-impulse-face';

  const point3 = (point, z = 0) => new THREE.Vector3(
    point.x,
    point.y,
    z,
  );
  const leftArmEnd = leftLockPoints[Math.floor(
    leftLockPoints.length / 2,
  )].clone().multiplyScalar(0.93);
  const rightArmEnd = rightLockPoints[Math.floor(
    rightLockPoints.length / 2,
  )].clone().multiplyScalar(0.93);
  const anchorArms = [leftArmEnd, rightArmEnd].map((end, index) => {
    const arm = beamBetween(
      new THREE.Vector3(0, -0.04, 0),
      point3(end),
      0.23,
      anchorDepth,
      anchorMaterial,
    );
    arm.userData.index = index;
    arm.userData.role = index === 0
      ? 'left-anchor-arm-to-pallet-D'
      : 'right-anchor-arm-to-pallet-E';
    return arm;
  });
  const anchorPivotHub = cylinderAlongZ(0.28, 0.82, darkMaterial, 36);
  anchorPivotHub.userData.role = 'Graham-pallet-arbor-C';
  const pivotCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.12, 3),
    anchorMaterial,
  );
  pivotCap.rotation.x = Math.PI / 2;
  pivotCap.rotation.z = Math.PI;
  pivotCap.position.y = 0.06;
  pivotCap.userData.role = 'triangular-anchor-apex-cap';

  const pendulumRodLength = 7.35;
  const pendulumRod = beamBetween(
    new THREE.Vector3(0, -0.08, -0.5),
    new THREE.Vector3(0, -pendulumRodLength, -0.5),
    0.12,
    0.14,
    anchorMaterial,
  );
  pendulumRod.userData.role = 'pendulum-rod-C';
  const pendulumBob = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 28, 18),
    anchorMaterial,
  );
  pendulumBob.position.set(0, -pendulumRodLength, -0.5);
  pendulumBob.userData.role = 'pendulum-point-F-bob';
  const pendulumIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 10),
    indexMaterial,
  );
  pendulumIndex.position.set(0, -pendulumRodLength - 0.3, -0.49);
  pendulumIndex.userData.role = 'white-pendulum-swing-witness';
  anchor.add(
    pendulumRod,
    pendulumBob,
    pendulumIndex,
    ...anchorArms,
    leftPallet,
    rightPallet,
    pivotCap,
    anchorPivotHub,
  );

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-Graham-clock-frame';
  const anchorBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.075, 10, 40),
    frameMaterial,
  );
  anchorBearing.position.set(anchorPivot.x, anchorPivot.y, -0.38);
  anchorBearing.userData.role = 'fixed-pallet-arbor-bearing';
  const wheelBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.07, 10, 38),
    frameMaterial,
  );
  wheelBearing.position.set(0, 0, -0.4);
  wheelBearing.userData.role = 'fixed-escape-arbor-bearing';
  const rearStandard = beamBetween(
    new THREE.Vector3(anchorPivot.x, -4.05, -0.78),
    new THREE.Vector3(anchorPivot.x, anchorPivot.y + 0.65, -0.78),
    0.18,
    0.2,
    frameMaterial,
  );
  rearStandard.userData.role = 'rear-clock-frame-standard';
  const frameBase = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 0.22, 0.72),
    frameMaterial,
  );
  frameBase.position.set(0, -4.05, -0.66);
  frameBase.userData.role = 'Graham-clock-frame-base';
  fixedFrame.add(anchorBearing, wheelBearing, rearStandard, frameBase);

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 18, 13),
    indexMaterial,
  );
  contactMarker.position.z = 0.78;
  contactMarker.userData.role = 'white-active-Graham-contact';
  root.add(fixedFrame, escapeWheel, anchor, contactMarker);

  const impulseReleaseAnchorSpeed = anchorAmplitude * Math.PI
    * Math.cos(Math.PI * releaseHalfPhase) / halfBeatDuration;
  const impulseReleaseAnchorAcceleration = -anchorAmplitude * Math.PI ** 2
    * Math.sin(Math.PI * releaseHalfPhase) / halfBeatDuration ** 2;
  const releaseProgressRate = -impulseReleaseAnchorSpeed
    / impulseAnchorSpan;
  const releaseProgressAcceleration = -impulseReleaseAnchorAcceleration
    / impulseAnchorSpan;
  const impulseReleaseWheelSpeed = direction * impulseAdvance
    * impulseMotionDerivative(1) * releaseProgressRate;
  const impulseReleaseWheelAcceleration = direction * impulseAdvance * (
    impulseMotionSecondDerivative(1) * releaseProgressRate ** 2
      + impulseMotionDerivative(1) * releaseProgressAcceleration
  );
  const freeDropAngularAcceleration = 2 * (
    direction * freeDropAdvance
      - impulseReleaseWheelSpeed * dropDuration
  ) / dropDuration ** 2;
  const freeDropLandingWheelSpeed = impulseReleaseWheelSpeed
    + freeDropAngularAcceleration * dropDuration;
  const landingImpactVelocityChange = -freeDropLandingWheelSpeed;

  const baseStateAtTime = (time) => {
    const halfBeatCoordinate = time / halfBeatDuration;
    const halfBeatIndex = Math.floor(halfBeatCoordinate);
    const halfPhase = halfBeatCoordinate - halfBeatIndex;
    const side = sideForHalfBeat(halfBeatIndex);
    const anchorAngle = side * anchorAmplitude
      * Math.sin(Math.PI * halfPhase);
    const anchorAngularSpeed = side * anchorAmplitude * Math.PI
      * Math.cos(Math.PI * halfPhase) / halfBeatDuration;
    const anchorAngularAcceleration = -side * anchorAmplitude
      * Math.PI ** 2 * Math.sin(Math.PI * halfPhase)
      / halfBeatDuration ** 2;
    const eventTolerance = 1e-12;
    const lockActive = halfPhase >= landingHalfPhase - eventTolerance
      && halfPhase < impulseStartHalfPhase - eventTolerance;
    const impulseActive = halfPhase >= (
      impulseStartHalfPhase - eventTolerance
    ) && halfPhase <= releaseHalfPhase + eventTolerance;
    const contactActive = lockActive || impulseActive;
    let wheelAngle;
    let wheelAngularSpeed;
    let wheelAngularAcceleration;
    let activeHalfBeatIndex = halfBeatIndex;
    let stage;
    let dropProgress = null;
    let impulseProgress = null;
    if (lockActive) {
      wheelAngle = wheelAngleAtHalfLanding(halfBeatIndex);
      wheelAngularSpeed = 0;
      wheelAngularAcceleration = 0;
      stage = Math.abs(halfPhase - 0.5) <= eventTolerance
        ? side > 0
          ? 'left-D-maximum-deadbeat-lock'
          : 'right-E-maximum-deadbeat-lock'
        : side > 0
          ? 'left-D-concentric-deadbeat-lock'
          : 'right-E-concentric-deadbeat-lock';
    } else if (impulseActive) {
      impulseProgress = THREE.MathUtils.clamp(
        impulseProgressAtAnchorAngle(side, anchorAngle),
        0,
        1,
      );
      const progressRate = -side * anchorAngularSpeed
        / impulseAnchorSpan;
      const progressAcceleration = -side * anchorAngularAcceleration
        / impulseAnchorSpan;
      wheelAngle = wheelAngleAtHalfLanding(halfBeatIndex)
        + direction * impulseAdvance * impulseMotion(impulseProgress);
      wheelAngularSpeed = direction * impulseAdvance
        * impulseMotionDerivative(impulseProgress) * progressRate;
      wheelAngularAcceleration = direction * impulseAdvance * (
        impulseMotionSecondDerivative(impulseProgress) * progressRate ** 2
          + impulseMotionDerivative(impulseProgress)
            * progressAcceleration
      );
      stage = side > 0
        ? 'left-A-impulse-and-release'
        : 'right-B-impulse-and-release';
    } else {
      const earlyDrop = halfPhase < landingHalfPhase;
      const dropStartHalfBeat = earlyDrop
        ? halfBeatIndex - 1
        : halfBeatIndex;
      const dropEndHalfBeat = dropStartHalfBeat + 1;
      const dropStartCoordinate = dropStartHalfBeat + releaseHalfPhase;
      const currentCoordinate = halfBeatIndex + halfPhase;
      const elapsedDropTime = (
        currentCoordinate - dropStartCoordinate
      ) * halfBeatDuration;
      dropProgress = elapsedDropTime / dropDuration;
      const dropStartWheelAngle = wheelAngleAtHalfLanding(
        dropStartHalfBeat,
      ) + direction * impulseAdvance;
      wheelAngle = dropStartWheelAngle
        + impulseReleaseWheelSpeed * elapsedDropTime
        + 0.5 * freeDropAngularAcceleration * elapsedDropTime ** 2;
      wheelAngularSpeed = impulseReleaseWheelSpeed
        + freeDropAngularAcceleration * elapsedDropTime;
      wheelAngularAcceleration = freeDropAngularAcceleration;
      activeHalfBeatIndex = dropEndHalfBeat;
      stage = sideForHalfBeat(dropEndHalfBeat) > 0
        ? 'clockwise-free-drop-to-left-D'
        : 'clockwise-free-drop-to-right-E';
    }
    const activeSide = contactActive
      ? side
      : sideForHalfBeat(activeHalfBeatIndex);
    const activeToothIndex = activeToothIndexForHalfBeat(
      activeHalfBeatIndex,
    );
    const activeToothAngle = wheelAngle
      + activeToothIndex * toothPitch - toothLeanAngle;
    const activeToothPoint = wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(activeToothAngle) * toothTipRadius,
      Math.sin(activeToothAngle) * toothTipRadius,
    ));
    let contact = null;
    if (contactActive) {
      const contactMode = lockActive ? 'concentric-lock' : 'impulse';
      const expectedPoint = lockActive
        ? lockContactPointForSide(side)
        : impulseContactPoint(side, anchorAngle);
      const localPoint = lockActive
        ? lockLocalContactPoint(side, anchorAngle)
        : impulseLocalContactPoint(side, anchorAngle);
      const wheelRadiusVector = activeToothPoint.clone().sub(wheelCenter);
      const anchorRadiusVector = activeToothPoint.clone().sub(anchorPivot);
      const toothVelocity = crossZ(wheelRadiusVector)
        .multiplyScalar(wheelAngularSpeed);
      const palletMaterialVelocity = crossZ(anchorRadiusVector)
        .multiplyScalar(anchorAngularSpeed);
      const toothAngleDerivativeByAnchor = lockActive
        ? 0
        : impulseWheelSlopeAtAnchorAngle(side, anchorAngle);
      const faceTangentWorld = crossZ(wheelRadiusVector)
        .multiplyScalar(toothAngleDerivativeByAnchor)
        .sub(crossZ(anchorRadiusVector));
      const faceTangent = faceTangentWorld.clone().normalize();
      const faceNormal = new THREE.Vector2(
        -faceTangent.y,
        faceTangent.x,
      );
      const relativeVelocity = toothVelocity.clone()
        .sub(palletMaterialVelocity);
      contact = {
        concentricRadiusError: lockActive
          ? Math.abs(
            localPoint.length()
              - lockContactPointForSide(side).distanceTo(anchorPivot)
          )
          : null,
        expectedPoint,
        faceNormal,
        faceTangent,
        localPoint,
        mode: contactMode,
        normalVelocityError: relativeVelocity.dot(faceNormal),
        palletMaterialVelocity,
        pointError: activeToothPoint.distanceTo(expectedPoint),
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
        side,
        toothVelocity,
      };
    }
    return {
      activeHalfBeatIndex,
      activeSide,
      activeToothAngle,
      activeToothIndex,
      activeToothPoint,
      anchorAngle,
      anchorAngularAcceleration,
      anchorAngularSpeed,
      contact,
      contactActive,
      contactMode: contact?.mode ?? null,
      dropProgress,
      halfBeatIndex,
      halfPhase,
      impulseProgress,
      lockActive,
      stage,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
    };
  };
  const sourceBaseState = baseStateAtTime(sourceTimeOffset);
  const stateAtTime = (time) => {
    const state = baseStateAtTime(time + sourceTimeOffset);
    const cycleCoordinate = time / pendulumPeriod;
    return {
      ...state,
      cycleIndex: Math.floor(cycleCoordinate),
      cyclePhase: positiveModulo(cycleCoordinate, 1),
      sourcePose: Math.abs(positiveModulo(cycleCoordinate, 1)) < 1e-12,
      teethAdvanced: (
        sourceBaseState.wheelAngle - state.wheelAngle
      ) / toothPitch,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * pendulumPeriod,
  );
  const timeFromBase = (baseTime) => positiveModulo(
    baseTime - sourceTimeOffset,
    pendulumPeriod,
  );
  const canonicalTimes = {
    cycleClosure: pendulumPeriod,
    leftImpulseStart: timeFromBase(
      impulseStartHalfPhase * halfBeatDuration,
    ),
    leftLanding: timeFromBase(landingHalfPhase * halfBeatDuration),
    leftMaximumLock: timeFromBase(halfBeatDuration / 2),
    leftRelease: timeFromBase(releaseHalfPhase * halfBeatDuration),
    rightImpulseStart: timeFromBase(halfBeatDuration
      + impulseStartHalfPhase * halfBeatDuration),
    rightLanding: timeFromBase(halfBeatDuration
      + landingHalfPhase * halfBeatDuration),
    rightMaximumLock: timeFromBase(halfBeatDuration * 1.5),
    rightRelease: timeFromBase(halfBeatDuration
      + releaseHalfPhase * halfBeatDuration),
    sourcePose: 0,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    anchor.rotation.z = state.anchorAngle;
    anchor.userData.angularAcceleration = state.anchorAngularAcceleration;
    anchor.userData.angularSpeed = state.anchorAngularSpeed;
    wheelRotor.rotation.z = state.wheelAngle;
    wheelRotor.userData.angularAcceleration =
      state.wheelAngularAcceleration;
    wheelRotor.userData.angularSpeed = state.wheelAngularSpeed;
    contactMarker.visible = state.contactActive;
    if (state.contactActive) {
      contactMarker.position.set(
        state.activeToothPoint.x,
        state.activeToothPoint.y,
        0.78,
      );
    }
    root.userData.contacts = state.contactActive
      ? {
        activePallet: state.activeSide > 0
          ? 'left-D'
          : 'right-E',
        activeToothIndex: state.activeToothIndex,
        mode: state.contactMode,
        normalVelocityError: state.contact.normalVelocityError,
        pointError: state.contact.pointError,
        relativeSlipSpeed: state.contact.relativeSlipSpeed,
      }
      : {
        activePallet: null,
        activeToothIndex: state.activeToothIndex,
        dropProgress: state.dropProgress,
        mode: null,
        normalVelocityError: null,
        pointError: null,
        relativeSlipSpeed: null,
      };
    root.userData.kinematics = state;
  };

  const radiusRange = (points) => {
    const radii = points.map((point) => point.length());
    return Math.max(...radii) - Math.min(...radii);
  };
  root.userData.archetype = movement.archetype;
  root.userData.mechanism =
    'one thirty-tooth clockwise escape wheel alternately rests on the outer concentric dead face of left pallet D and inner concentric dead face of right pallet E; the wheel is exactly stationary while the pendulum completes each excursion, then advances over impulse face A or B and drops two degrees to the opposite lock';
  root.userData.presentation = 'front elevation';
  root.userData.presentationView = 'front';
  root.userData.transmission = {
    deadbeat: 'wheel angular speed and acceleration are exactly zero throughout both concentric locking intervals',
    direction: 'clockwise, matching Brown’s rightward arrow above the wheel',
    dropPerBeatDegrees: THREE.MathUtils.radToDeg(freeDropAdvance),
    halfBeatAdvance: halfToothPitch,
    impulseAdvancePerBeatDegrees: THREE.MathUtils.radToDeg(
      impulseAdvance,
    ),
    oscillationAdvance: toothPitch,
    palletSpanInToothPitches: palletSpanTeeth,
    recoil: 'none: the locked wheel never reverses',
    toothCount,
  };
  root.userData.blocks = {
    anchor,
    anchorArms,
    anchorBearing,
    anchorPivotHub,
    contactMarker,
    escapeWheel,
    fixedFrame,
    frameBase,
    leftPallet,
    pendulumBob,
    pendulumIndex,
    pendulumRod,
    pivotCap,
    rearStandard,
    rightPallet,
    spokeMeshes,
    toothedRim,
    wheelBearing,
    wheelHub,
    wheelIndex,
    wheelRotor,
    wheelShaft,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.25, -4.25, -1.1),
    new THREE.Vector3(3.25, 4.35, 1.1),
  );
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = {
    anchorAmplitude,
    anchorDepth,
    anchorPivot: anchorPivot.clone(),
    direction,
    dropDuration,
    eventPeriod: pendulumPeriod,
    freeDropAdvance,
    freeDropAngularAcceleration,
    freeDropLandingWheelSpeed,
    halfBeatDuration,
    halfToothPitch,
    impulseAdvance,
    impulseAnchorSpan,
    impulseReleaseWheelAcceleration,
    impulseReleaseWheelSpeed,
    impulseStartHalfPhase,
    landingHalfPhase,
    landingImpactVelocityChange,
    leftLockReferenceAngle,
    lockingAmplitudeFraction,
    palletSpanAngle,
    palletSpanTeeth,
    pendulumPeriod,
    pendulumRodLength,
    releaseAmplitudeFraction,
    releaseHalfPhase,
    rightLockReferenceAngle,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    sourceTimeOffset,
    toothCount,
    toothLeanAngle,
    toothPitch,
    toothTipRadius,
    wheelCenter: wheelCenter.clone(),
    wheelDepth,
    wheelInnerRadius,
    wheelRootRadius,
    wholePalletSpanTeeth,
  };
  root.userData.impulseContactPoint = impulseContactPoint;
  root.userData.impulseFacePoints = impulseFacePoints;
  root.userData.impulseLocalContactPoint = impulseLocalContactPoint;
  root.userData.lockContactPointForSide = lockContactPointForSide;
  root.userData.lockFacePoints = lockFacePoints;
  root.userData.lockLocalContactPoint = lockLocalContactPoint;
  root.userData.palletProfiles = {
    left: {
      impulsePoints: leftImpulsePoints,
      impulseSourceLabel: 'A',
      lockConcentricRadiusRange: radiusRange(leftLockPoints),
      lockPoints: leftLockPoints,
      lockSurface: 'outer face of pallet D',
      side: 1,
    },
    right: {
      impulsePoints: rightImpulsePoints,
      impulseSourceLabel: 'B',
      lockConcentricRadiusRange: radiusRange(rightLockPoints),
      lockPoints: rightLockPoints,
      lockSurface: 'inner face of pallet E',
      side: -1,
    },
  };
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official Movement 303 page marks Animated unavailable and serves only Brown’s original engraving.',
    referenceScope: 'Brown fixes the clockwise thirty-station wheel, apex pallet arbor, short D/A and B/E pallet arms, pendulum C-F, and the concentric outer-D and inner-E locking faces; the lock, impulse, and finite drop schedule is independently reconstructed.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    periodReference: {
      description: 'The dead faces are circular arcs about pallet axis C. A tooth remains on a dead face without recoil while the pendulum finishes its swing, then slides down the adjoining impulse face on the return. The pallets commonly embrace about one third of the wheel, and roughly two degrees of wheel drop is conventional.',
      publicationYear: 1911,
      section: 'Clock — Dead escapements, figure 9',
      title: 'Encyclopaedia Britannica, 11th edition',
      url: 'https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Clock',
    },
    plate303: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one clockwise thirty-tooth wheel below one apex arbor carrying left pallet D, right pallet E, and the pendulum; A and B are the two return impulse faces',
      measurementUncertaintyPixels: 8,
      modeledToothCount: toothCount,
      officialAnimationAvailable: false,
      rasterAnchorPivot: sourceRasterAnchorPivot,
      rasterDirectionArrow: sourceRasterDirectionArrow,
      rasterLeftImpulseA: sourceRasterLeftImpulseA,
      rasterLeftPalletD: sourceRasterLeftPalletD,
      rasterPendulumEndpoints: sourceRasterPendulumEndpoints,
      rasterRightImpulseB: sourceRasterRightImpulseB,
      rasterRightPalletE: sourceRasterRightPalletE,
      rasterWheelBounds: sourceRasterWheelBounds,
      rasterWheelCenter: sourceRasterWheelCenter,
      rasterWheelTipRadius: sourceRasterWheelTipRadius,
      toothCountBasis: 'Brown’s unobscured side arcs repeat at approximately twelve-degree intervals, resolving to the conventional thirty-tooth seconds escape wheel.',
    },
    primaryScan: {
      descriptionPage: 75,
      edition: 21,
      illustrationPage: 74,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: pendulumPeriod,
    schedule: [
      'right-E-concentric-lock',
      'right-B-impulse-and-release',
      'clockwise-drop-to-left-D',
      'left-D-concentric-lock',
      'left-A-impulse-and-release',
      'clockwise-drop-to-right-E',
    ],
  };
  root.userData.wheelAngleAtHalfLanding = wheelAngleAtHalfLanding;
  root.userData.cameraDistanceScale = 1.08;

  update(0);
  markShadows(root);
  for (const object of [contactMarker, pendulumIndex, wheelIndex]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';
  return {
    cameraDirection: new THREE.Vector3(1.2, 0.9, 13.4),
    root,
    update,
  };
}

export function createAuthoredDeadbeatEscapementMovement(movement) {
  switch (movement.id) {
    case 289: return deadbeatAnchorEscapement(movement);
    case 303: return grahamDeadbeatPendulumEscapement(movement);
    default: return null;
  }
}
