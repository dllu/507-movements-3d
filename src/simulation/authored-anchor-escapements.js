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

function polygonShape(points) {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  });
  shape.closePath();
  return shape;
}

function makeWorkingPallet(facePoints, {
  color,
  depth,
  thickness,
}) {
  const innerPoints = facePoints.map((point) => point.clone()
    .addScaledVector(point.clone().normalize(), -thickness));
  const shape = polygonShape([
    ...facePoints,
    ...innerPoints.reverse(),
  ]);
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    centeredExtrusion(shape, depth, 0.006),
    matte(color, { metalness: 0.18, roughness: 0.51 }),
  );
  body.userData.role = 'solid-pallet-behind-working-face';
  const faceCurve = new THREE.CatmullRomCurve3(
    facePoints.map((point) => new THREE.Vector3(
      point.x,
      point.y,
      depth / 2 + 0.012,
    )),
    false,
    'centripetal',
  );
  const workingEdge = new THREE.Mesh(
    new THREE.TubeGeometry(faceCurve, 48, 0.045, 8, false),
    matte(PALETTE.white, { metalness: 0.12, roughness: 0.44 }),
  );
  workingEdge.userData.role = 'visible-nonconcentric-working-face';
  root.add(body, workingEdge);
  root.userData.body = body;
  root.userData.facePoints = facePoints;
  root.userData.workingEdge = workingEdge;
  return root;
}

function recoilAnchorEscapement(movement) {
  const root = new THREE.Group();

  // Movement 288 has no official canvas animation. Brown's 525 px plate fixes
  // the wheel, arbor, anchor silhouette, direction, and labeled pallet faces.
  // The alternating contact sequence is independently reconstructed from the
  // stated recoil principle: a tooth remains on a face not concentric with a,
  // so the outbound supplementary arc drives the wheel backward before the
  // return arc gives impulse and releases it.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.016;
  const sourceRasterAnchorPivot = new THREE.Vector2(250, 143);
  const sourceRasterWheelCenter = new THREE.Vector2(250, 403);
  const sourceRasterLeftFaceOuterC = new THREE.Vector2(117, 213);
  const sourceRasterLeftFaceInnerE = new THREE.Vector2(149, 171);
  const sourceRasterRightFaceInnerD = new THREE.Vector2(365, 174);
  const sourceRasterRightFaceOuterB = new THREE.Vector2(400, 214);
  const sourceRasterTopBridgeLeft = new THREE.Vector2(129, 86);
  const sourceRasterTopBridgeRight = new THREE.Vector2(407, 85);
  const sourceRasterDirectionArrow = new THREE.Vector2(101, 356);
  const anchorPivot = new THREE.Vector2(0, 3.2);
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    anchorPivot.x + (x - sourceRasterAnchorPivot.x) * sourceScale,
    anchorPivot.y + (sourceRasterAnchorPivot.y - y) * sourceScale,
  );
  const wheelCenter = sourcePointToModel(sourceRasterWheelCenter);

  const toothCount = 30;
  const toothPitch = FULL_TURN / toothCount;
  const halfToothPitch = toothPitch / 2;
  const wholePalletSpanTeeth = 6;
  const palletSpanTeeth = wholePalletSpanTeeth + 0.5;
  const palletSpanAngle = palletSpanTeeth * toothPitch;
  const leftContactReferenceAngle = Math.PI / 2 + palletSpanAngle / 2;
  const rightContactReferenceAngle = Math.PI / 2 - palletSpanAngle / 2;
  const toothLeanAngle = toothPitch * 0.17;
  const wheelRootRadius = 3.05;
  const toothTipRadius = 3.78;
  const wheelInnerRadius = 2.55;
  const wheelDepth = 0.36;
  const anchorDepth = 0.42;

  const pendulumPeriod = 4;
  const halfBeatDuration = pendulumPeriod / 2;
  const anchorAmplitude = THREE.MathUtils.degToRad(5);
  const landingAmplitudeFraction = 0.28;
  const releaseAmplitudeFraction = 0.08;
  const landingHalfPhase = Math.asin(landingAmplitudeFraction) / Math.PI;
  const releaseHalfPhase = 1
    - Math.asin(releaseAmplitudeFraction) / Math.PI;
  const maximumRecoilAngle = THREE.MathUtils.degToRad(2);
  const contactWheelSlope = maximumRecoilAngle / (
    (1 - landingAmplitudeFraction) * anchorAmplitude
  );
  const contactAdvancePastLanding = contactWheelSlope
    * (landingAmplitudeFraction - releaseAmplitudeFraction)
    * anchorAmplitude;
  const freeDropAdvance = halfToothPitch - contactAdvancePastLanding;
  const dropDuration = (
    1 - releaseHalfPhase + landingHalfPhase
  ) * halfBeatDuration;
  const contactReleaseWheelSpeed = contactWheelSlope
    * anchorAmplitude * Math.PI
    * Math.abs(Math.cos(Math.PI * releaseHalfPhase))
    / halfBeatDuration;
  const freeDropAngularAcceleration = 2 * (
    freeDropAdvance - contactReleaseWheelSpeed * dropDuration
  ) / dropDuration ** 2;
  const freeDropLandingWheelSpeed = contactReleaseWheelSpeed
    + freeDropAngularAcceleration * dropDuration;
  const contactLandingWheelSpeed = -contactWheelSlope
    * anchorAmplitude * Math.PI
    * Math.cos(Math.PI * landingHalfPhase)
    / halfBeatDuration;
  const landingImpactVelocityChange = contactLandingWheelSpeed
    - freeDropLandingWheelSpeed;

  const initialWheelLandingAngle = leftContactReferenceAngle
    + toothLeanAngle;
  const wheelAngleAtHalfLanding = (halfBeatIndex) => (
    initialWheelLandingAngle + halfBeatIndex * halfToothPitch
  );
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
  const contactReferenceAngleForSide = (side) => (
    side > 0
      ? leftContactReferenceAngle
      : rightContactReferenceAngle
  );
  const contactWheelDeltaAtAnchorAngle = (side, anchorAngle) => (
    -side * contactWheelSlope * (
      anchorAngle
        - side * landingAmplitudeFraction * anchorAmplitude
    )
  );
  const contactToothAngleAtAnchorAngle = (side, anchorAngle) => (
    contactReferenceAngleForSide(side)
      + contactWheelDeltaAtAnchorAngle(side, anchorAngle)
  );
  const contactPointAtAnchorAngle = (side, anchorAngle) => {
    const toothAngle = contactToothAngleAtAnchorAngle(side, anchorAngle);
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(toothAngle) * toothTipRadius,
      Math.sin(toothAngle) * toothTipRadius,
    ));
  };
  const palletLocalContactPoint = (side, anchorAngle) => rotate2(
    contactPointAtAnchorAngle(side, anchorAngle).sub(anchorPivot),
    -anchorAngle,
  );
  const palletFacePoints = (side, pointCount = 41) => Array.from(
    { length: pointCount },
    (_, index) => {
      const magnitude = THREE.MathUtils.lerp(
        releaseAmplitudeFraction * anchorAmplitude,
        anchorAmplitude,
        index / (pointCount - 1),
      );
      return palletLocalContactPoint(side, side * magnitude);
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
    'counterclockwise-driven-thirty-tooth-recoil-escape-wheel-A';
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'stepping-and-recoiling-escape-wheel-rotor';
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
  toothedRim.userData.role = 'thirty-backward-raked-escape-wheel-teeth';
  wheelRotor.add(toothedRim);
  const wheelHub = cylinderAlongZ(0.42, 0.74, darkMaterial, 38);
  wheelHub.userData.role = 'escape-wheel-arbor-hub-A';
  wheelRotor.add(wheelHub);
  const spokeMeshes = [];
  for (let spokeIndex = 0; spokeIndex < 3; spokeIndex += 1) {
    const angle = spokeIndex * FULL_TURN / 3 + 0.17;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 0.22, wheelDepth * 0.82),
      driverMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * 1.45,
      Math.sin(angle) * 1.45,
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `escape-wheel-spoke-${spokeIndex + 1}`;
    spokeMeshes.push(spoke);
    wheelRotor.add(spoke);
  }
  const wheelShaft = cylinderAlongZ(0.14, 1.35, darkMaterial, 34);
  wheelShaft.userData.role = 'fixed-axis-escape-wheel-shaft';
  escapeWheel.add(wheelShaft);
  const wheelIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 16, 12),
    indexMaterial,
  );
  wheelIndex.position.set(
    Math.cos(-toothLeanAngle) * (toothTipRadius - 0.07),
    Math.sin(-toothLeanAngle) * (toothTipRadius - 0.07),
    wheelDepth / 2 + 0.08,
  );
  wheelIndex.userData.role = 'white-index-on-escape-wheel-tooth-zero';
  wheelRotor.add(wheelIndex);

  const anchor = new THREE.Group();
  anchor.position.set(anchorPivot.x, anchorPivot.y, 0.24);
  anchor.userData.axis = Z_AXIS.clone();
  anchor.userData.role = 'pendulum-rocked-anchor-H-L-K';
  const sourceOutlineRaster = [
    [129, 86],
    [407, 85],
    [410, 118],
    [404, 154],
    [393, 190],
    [383, 213],
    [359, 188],
    [364, 134],
    [279, 134],
    [278, 151],
    [270, 162],
    [259, 168],
    [244, 168],
    [233, 160],
    [228, 134],
    [164, 134],
    [153, 169],
    [127, 212],
    [112, 205],
    [118, 169],
    [123, 125],
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
  anchorBody.userData.role = 'source-profiled-rigid-anchor-body-H-L-K';
  const leftFacePoints = palletFacePoints(1);
  const rightFacePoints = palletFacePoints(-1);
  const leftPallet = makeWorkingPallet(leftFacePoints, {
    color: PALETTE.accent,
    depth: anchorDepth + 0.04,
    thickness: 0.30,
  });
  leftPallet.userData.role = 'inner-working-pallet-H-face-c-e';
  const rightPallet = makeWorkingPallet(rightFacePoints, {
    color: PALETTE.accent,
    depth: anchorDepth + 0.04,
    thickness: 0.30,
  });
  rightPallet.userData.role = 'outer-working-pallet-K-face-d-b';
  const crutch = beamBetween(
    new THREE.Vector3(0, 0.20, -0.04),
    new THREE.Vector3(0, 2.12, -0.04),
    0.17,
    0.24,
    drivenMaterial,
  );
  crutch.userData.role = 'anchor-crutch-rigidly-coupled-to-pendulum';
  const crutchIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.09, 0.30),
    indexMaterial,
  );
  crutchIndex.position.set(0, 1.92, 0.02);
  crutchIndex.userData.role = 'white-index-on-rocking-anchor-crutch';
  const anchorPivotHub = cylinderAlongZ(0.25, 0.88, darkMaterial, 34);
  anchorPivotHub.userData.role = 'anchor-arbor-a';
  anchor.add(
    anchorBody,
    leftPallet,
    rightPallet,
    crutch,
    crutchIndex,
    anchorPivotHub,
  );

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 18, 14),
    indexMaterial,
  );
  contactMarker.position.z = 0.62;
  contactMarker.userData.role =
    'white-marker-on-active-tooth-pallet-contact';

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-clock-plate-and-two-arbor-bearings';
  const rearStandard = beamBetween(
    new THREE.Vector3(0, wheelCenter.y - 3.95, -0.95),
    new THREE.Vector3(0, anchorPivot.y + 2.55, -0.95),
    0.22,
    0.24,
    frameMaterial,
  );
  rearStandard.userData.role = 'rear-clock-plate-standard';
  const wheelBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.40, 0.09, 10, 42),
    frameMaterial,
  );
  wheelBearing.position.set(wheelCenter.x, wheelCenter.y, -0.62);
  wheelBearing.userData.role = 'fixed-escape-wheel-arbor-bearing';
  const anchorBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.33, 0.08, 10, 42),
    frameMaterial,
  );
  anchorBearing.position.set(anchorPivot.x, anchorPivot.y, -0.62);
  anchorBearing.userData.role = 'fixed-anchor-arbor-bearing';
  const baseY = wheelCenter.y - toothTipRadius - 0.90;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(7.9, 0.24, 0.82),
    frameMaterial,
  );
  base.position.set(0, baseY, -0.70);
  base.userData.role = 'fixed-clock-frame-base';
  fixedFrame.add(rearStandard, wheelBearing, anchorBearing, base);

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(9.2, 11.4, 2.8),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.y = -0.15;
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-wheel-anchor-and-crutch';

  root.add(
    cameraEnvelope,
    fixedFrame,
    escapeWheel,
    anchor,
    contactMarker,
  );

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
    const contactActive = halfPhase >= landingHalfPhase - eventTolerance
      && halfPhase <= releaseHalfPhase + eventTolerance;
    let wheelAngle;
    let wheelAngularSpeed;
    let wheelAngularAcceleration;
    let activeHalfBeatIndex = halfBeatIndex;
    let stage;
    let dropProgress = null;
    if (contactActive) {
      wheelAngle = wheelAngleAtHalfLanding(halfBeatIndex)
        + contactWheelDeltaAtAnchorAngle(side, anchorAngle);
      wheelAngularSpeed = -side * contactWheelSlope
        * anchorAngularSpeed;
      wheelAngularAcceleration = -side * contactWheelSlope
        * anchorAngularAcceleration;
      stage = Math.abs(halfPhase - 0.5) <= eventTolerance
        ? side > 0
          ? 'left-pallet-maximum-recoil-turnaround'
          : 'right-pallet-maximum-recoil-turnaround'
        : halfPhase < 0.5
          ? side > 0
            ? 'left-pallet-outbound-recoil'
            : 'right-pallet-outbound-recoil'
          : side > 0
            ? 'left-pallet-return-impulse'
            : 'right-pallet-return-impulse';
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
      ) + contactAdvancePastLanding;
      wheelAngle = dropStartWheelAngle
        + contactReleaseWheelSpeed * elapsedDropTime
        + 0.5 * freeDropAngularAcceleration * elapsedDropTime ** 2;
      wheelAngularSpeed = contactReleaseWheelSpeed
        + freeDropAngularAcceleration * elapsedDropTime;
      wheelAngularAcceleration = freeDropAngularAcceleration;
      activeHalfBeatIndex = dropEndHalfBeat;
      stage = sideForHalfBeat(dropEndHalfBeat) > 0
        ? 'free-drop-forward-to-left-pallet'
        : 'free-drop-forward-to-right-pallet';
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
      const expectedPoint = contactPointAtAnchorAngle(side, anchorAngle);
      const localPoint = palletLocalContactPoint(side, anchorAngle);
      const wheelRadiusVector = activeToothPoint.clone().sub(wheelCenter);
      const anchorRadiusVector = activeToothPoint.clone().sub(anchorPivot);
      const toothVelocity = crossZ(wheelRadiusVector)
        .multiplyScalar(wheelAngularSpeed);
      const palletMaterialVelocity = crossZ(anchorRadiusVector)
        .multiplyScalar(anchorAngularSpeed);
      const toothAngleDerivativeByAnchor = -side * contactWheelSlope;
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
        expectedPoint,
        faceNormal,
        faceTangent,
        localPoint,
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
      cycleIndex,
      cyclePhase,
      dropProgress,
      halfBeatIndex,
      halfPhase,
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
    leftLanding: landingHalfPhase * halfBeatDuration,
    leftMaximumRecoil: halfBeatDuration / 2,
    leftRelease: releaseHalfPhase * halfBeatDuration,
    oneToothAdvance: pendulumPeriod,
    rightLanding: halfBeatDuration
      + landingHalfPhase * halfBeatDuration,
    rightMaximumRecoil: halfBeatDuration * 1.5,
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
          ? 'inner-left-H-c-e'
          : 'outer-right-K-d-b',
        activeToothIndex: state.activeToothIndex,
        normalVelocityError: state.contact.normalVelocityError,
        pointError: state.contact.pointError,
        relativeSlipSpeed: state.contact.relativeSlipSpeed,
      }
      : {
        activePallet: null,
        activeToothIndex: state.activeToothIndex,
        dropProgress: state.dropProgress,
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
    'thirty-tooth-recoil-anchor-escapement-nonconcentric-pallets';
  root.userData.mechanism =
    'one pendulum-rocked anchor H-L-K alternately locks a 30-tooth escape wheel on the inner face c-e of pallet H and outer face d-b of pallet K; each nonconcentric face makes the wheel recoil during the outbound supplementary arc, return forward while imparting impulse, then drop freely by the remainder of one half pitch to the opposite pallet';
  root.userData.transmission = {
    direction: 'escape wheel advances counterclockwise under train torque',
    halfBeatAdvance: halfToothPitch,
    impulse: 'the tooth slides forward along the returning pallet and gives energy to the anchor and pendulum before release',
    oscillationAdvance: toothPitch,
    recoil: 'wheel angular velocity is negative while either newly landed pallet moves outward',
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
    crutch,
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
  root.userData.contactPointAtAnchorAngle = contactPointAtAnchorAngle;
  root.userData.geometry = {
    anchorAmplitude,
    anchorDepth,
    anchorPivot: anchorPivot.clone(),
    contactAdvancePastLanding,
    contactLandingWheelSpeed,
    contactReleaseWheelSpeed,
    contactWheelSlope,
    dropDuration,
    eventPeriod: pendulumPeriod,
    freeDropAdvance,
    freeDropAngularAcceleration,
    freeDropLandingWheelSpeed,
    halfBeatDuration,
    halfToothPitch,
    landingAmplitudeFraction,
    landingHalfPhase,
    landingImpactVelocityChange,
    leftContactReferenceAngle,
    maximumRecoilAngle,
    palletSpanAngle,
    palletSpanTeeth,
    pendulumPeriod,
    releaseAmplitudeFraction,
    releaseHalfPhase,
    rightContactReferenceAngle,
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
  root.userData.palletFacePoints = palletFacePoints;
  root.userData.palletLocalContactPoint = palletLocalContactPoint;
  root.userData.palletProfiles = {
    left: {
      concentricRadiusRange: radiusRange(leftFacePoints),
      points: leftFacePoints,
      side: 1,
      sourceLabels: ['c', 'e'],
    },
    right: {
      concentricRadiusRange: radiusRange(rightFacePoints),
      points: rightFacePoints,
      side: -1,
      sourceLabels: ['d', 'b'],
    },
  };
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'The official 288/289 pages expose Brown’s static engravings and description but mark animation unavailable. Movement 288’s contact/drop timing and 3D geometry are independently reconstructed from its labeled nonconcentric pallet faces and the stated recoil action.',
    sourceUrl: 'https://507movements.com/mm_288.html',
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate288: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one planar anchor rocks about a above one counterclockwise escape wheel A; the tooth tips alternately contact inner face c-e at H and outer face d-b at K',
      measurementUncertaintyPixels: 7,
      rasterAnchorPivot: sourceRasterAnchorPivot.clone(),
      rasterDirectionArrow: sourceRasterDirectionArrow.clone(),
      rasterLeftFaceInnerE: sourceRasterLeftFaceInnerE.clone(),
      rasterLeftFaceOuterC: sourceRasterLeftFaceOuterC.clone(),
      rasterRightFaceInnerD: sourceRasterRightFaceInnerD.clone(),
      rasterRightFaceOuterB: sourceRasterRightFaceOuterB.clone(),
      rasterTopBridgeLeft: sourceRasterTopBridgeLeft.clone(),
      rasterTopBridgeRight: sourceRasterTopBridgeRight.clone(),
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
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
      'left-pallet-landing-and-recoil',
      'left-pallet-return-impulse-and-release',
      'free-drop-to-right-pallet',
      'right-pallet-landing-and-recoil',
      'right-pallet-return-impulse-and-release',
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
  correctAnchorEscapement(root, 288, update);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredAnchorEscapementMovement(movement) {
  if (movement.id !== 288) return null;
  return recoilAnchorEscapement(movement);
}
