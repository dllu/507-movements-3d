import * as THREE from 'three';
import { GRAHAM_303_ANCHOR } from './baked/graham-303-anchor.js';
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

// One Graham tooth for Movement 303, drawn before rotation by its index:
// a slightly forward-leaning radial front face ending at the working tip, a
// back-sloping top and a radial rear side, leaving the wide gaps of Brown's
// plate. The wheel turns clockwise, so "forward" is decreasing angle.
export function grahamToothOutline({
  toothLeanAngle,
  toothPitch,
  toothTipRadius,
  wheelRootRadius,
}) {
  const polar = (angle, radius) => new THREE.Vector2(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
  );
  const tipAngle = -toothLeanAngle;
  return [
    polar(tipAngle + toothPitch * 0.03, wheelRootRadius),
    polar(tipAngle, toothTipRadius),
    polar(tipAngle + toothPitch * 0.3, toothTipRadius - 0.13),
    polar(tipAngle + toothPitch * 0.3, wheelRootRadius),
  ];
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
  bodySide = -1,
  depth,
  sideName,
  thickness,
}) {
  // bodySide -1 puts the solid between the working face and the pallet
  // arbor (a tooth bearing on an outer face); +1 puts it beyond the face.
  const root = new THREE.Group();
  const workingPath = [
    ...lockPoints.slice().reverse(),
    ...impulsePoints.slice(1),
  ];
  const innerPath = workingPath.map((point) => point.clone()
    .addScaledVector(point.clone().normalize(), bodySide * thickness));
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

// Ratchet tooth of 289, in tooth pitches from the tooth centre line.
const RATCHET_BACK_ROOT = 0.9;
const RATCHET_BACK_POWER = 1.8;
const RATCHET_FRONT_ROOT = 0.05;

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
  // Brown's rim is a narrow band inside the teeth (about 0.84 of the root).
  const wheelInnerRadius = 1.72;
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
  const toothOutline = grahamToothOutline({
    toothLeanAngle,
    toothPitch,
    toothTipRadius,
    wheelRootRadius,
  });
  const wheelShape = new THREE.Shape();
  for (let toothIndex = 0; toothIndex < toothCount; toothIndex += 1) {
    const outlinePoints = toothOutline.map((point) => rotate2(
      point,
      toothIndex * toothPitch,
    ));
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
  for (let step = 0; step < 120; step += 1) {
    const angle = -FULL_TURN * step / 120;
    const x = Math.cos(angle) * wheelInnerRadius;
    const y = Math.sin(angle) * wheelInnerRadius;
    if (step === 0) wheelOpening.moveTo(x, y);
    else wheelOpening.lineTo(x, y);
  }
  wheelOpening.closePath();
  wheelShape.holes.push(wheelOpening);
  const toothedRim = new THREE.Mesh(
    centeredExtrusion(wheelShape, wheelDepth, GRAHAM_303_ANCHOR.wheelBevel),
    wheelMaterial,
  );
  toothedRim.userData.role = 'thirty-forward-leaning-deadbeat-teeth';
  wheelRotor.add(toothedRim);
  const spokeMeshes = [];
  // Brown draws the four crossings as a leaning X (about 55, 145, 235 and
  // 325 degrees) at the plate's pose, not an upright cross.
  for (let spokeIndex = 0; spokeIndex < 4; spokeIndex += 1) {
    const angle = THREE.MathUtils.degToRad(100) + spokeIndex * Math.PI / 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(wheelInnerRadius + 0.06, 0.22, wheelDepth * 0.78),
      wheelMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * (wheelInnerRadius + 0.06) / 2,
      Math.sin(angle) * (wheelInnerRadius + 0.06) / 2,
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
  // The arbor turns with the wheel; its rear end stops short of the pendulum
  // rod, which hangs behind the wheel as in Brown's plate.
  const wheelShaft = cylinderAlongZ(0.12, 0.95, darkMaterial, 32);
  wheelShaft.position.z = -0.025;
  wheelShaft.userData.role = 'Graham-escape-wheel-arbor';
  wheelRotor.add(wheelShaft);
  const wheelIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 18, 12),
    indexMaterial,
  );
  const wheelIndexRadius = (wheelRootRadius + wheelInnerRadius) / 2;
  wheelIndex.position.set(
    Math.cos(-toothLeanAngle) * wheelIndexRadius,
    Math.sin(-toothLeanAngle) * wheelIndexRadius,
    wheelDepth / 2 + 0.03,
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
    {
      bodySide: 1,
      depth: anchorDepth + 0.06,
      sideName: 'right-E',
      thickness: 0.27,
    },
  );
  rightPallet.userData.role =
    'right-pallet-E-inner-dead-face-and-B-impulse-face';

  const point3 = (point, z = 0) => new THREE.Vector3(
    point.x,
    point.y,
    z,
  );
  // Each side's arm and pallet is one baked outline: a source-proportioned
  // blank minus the envelope swept by the teeth in the anchor frame, so the
  // solved lock/impulse faces remain while flanks and neighbours clear.
  const anchorArms = [
    ['left', leftPallet, 'left-anchor-arm-and-pallet-D'],
    ['right', rightPallet, 'right-anchor-arm-and-pallet-E'],
  ].map(([side, pallet, role], index) => {
    const baked = GRAHAM_303_ANCHOR[side];
    const shape = polygonShape(baked.outer.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const hole of baked.holes) {
      shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
    }
    const piece = new THREE.Mesh(
      centeredExtrusion(shape, anchorDepth + 0.06, GRAHAM_303_ANCHOR.anchorBevel),
      anchorMaterial,
    );
    piece.userData.index = index;
    piece.userData.role = role;
    const oldBody = pallet.userData.body;
    pallet.remove(oldBody);
    oldBody.geometry.dispose();
    pallet.userData.body = piece;
    return piece;
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

  // Anchor-local depth of the pendulum plane: world z -0.6, behind the wheel
  // arbor (rear end -0.5) and its bearing, in front of the rear supports.
  const pendulumZ = -0.85;
  const anchorArbor = cylinderAlongZ(0.12, 0.84, darkMaterial, 28);
  anchorArbor.position.z = -0.5;
  anchorArbor.userData.role = 'Graham-pallet-arbor-to-pendulum';
  const pendulumRodLength = 7.35;
  const pendulumRod = beamBetween(
    new THREE.Vector3(0, 0.1, pendulumZ),
    new THREE.Vector3(0, -pendulumRodLength, pendulumZ),
    0.12,
    0.14,
    anchorMaterial,
  );
  pendulumRod.userData.role = 'pendulum-rod-C';
  // Brown marks F only as a dot on the rod; no bob is drawn.
  const pendulumBob = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 20, 12),
    darkMaterial,
  );
  pendulumBob.scale.z = 0.6;
  pendulumBob.position.set(0, -pendulumRodLength, pendulumZ);
  pendulumBob.userData.role = 'pendulum-point-F-bob';
  const pendulumIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 10),
    indexMaterial,
  );
  pendulumIndex.position.set(0, -pendulumRodLength, pendulumZ + 0.14);
  pendulumIndex.userData.role = 'white-pendulum-swing-witness';
  anchor.add(
    anchorArbor,
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
  // Brown's plate shows no frame or bearings; fixedFrame stays an empty group
  // so the arbors read as they are drawn.

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 18, 13),
    indexMaterial,
  );
  contactMarker.position.z = 0.78;
  contactMarker.userData.role = 'white-active-Graham-contact';
  contactMarker.visible = false;
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
    contactMarker.userData.active = state.contactActive;
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
    anchorPivotHub,
    contactMarker,
    escapeWheel,
    fixedFrame,
    leftPallet,
    pendulumBob,
    pendulumIndex,
    pendulumRod,
    pivotCap,
    rightPallet,
    anchorArbor,
    spokeMeshes,
    toothedRim,
    wheelHub,
    wheelIndex,
    wheelRotor,
    wheelShaft,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.1, -4.05, -0.8),
    new THREE.Vector3(3.1, 4.3, 0.8),
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
  // Brown's plate is a flat face view without a ground line.
  root.userData.hideGround = true;

  update(0);
  markShadows(root);
  for (const object of [contactMarker, pendulumIndex, wheelIndex]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';
  return {
    cameraDirection: new THREE.Vector3(0.3, 0.25, 13.4),
    root,
    update,
  };
}

export function createAuthoredDeadbeatEscapementMovement(movement) {
  switch (movement.id) {
    case 303: return grahamDeadbeatPendulumEscapement(movement);
    default: return null;
  }
}
