import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
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

function cylinderAlongZ(radius, length, material, segments = 30) {
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

function edgeTube(points, z, radius, material, role, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, point.y, z)),
    closed,
    'centripetal',
  );
  const edge = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(36, points.length * 2),
      radius, 8, closed),
    material,
  );
  edge.userData.role = role;
  return edge;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (x * (x * 6 - 15) + 10);
}

function smootherStepDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * x ** 2 * (x - 1) ** 2;
}

function smootherStepSecondDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * x * (2 * x ** 2 - 3 * x + 1);
}

function notchedRollerShape(radius, notchHalfAngle, notchRootRadius) {
  const notchDirection = -Math.PI / 2;
  const startAngle = notchDirection + notchHalfAngle;
  const arc = FULL_TURN - 2 * notchHalfAngle;
  const points = Array.from({ length: 81 }, (_, index) => {
    const angle = startAngle + arc * index / 80;
    return new THREE.Vector2(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    );
  });
  points.push(new THREE.Vector2(
    Math.cos(notchDirection) * notchRootRadius,
    Math.sin(notchDirection) * notchRootRadius,
  ));
  return polygonShape(points);
}

function duplexEscapement(movement) {
  const root = new THREE.Group();

  // Brown draws only the upper sector of the escape wheel. Its pointed long
  // teeth work in the wheel plane and lock on notched roller A. The small
  // circles labelled a are a second, axial row of crown pins; one of these
  // acts on pallet B after the corresponding long tooth clears A's notch.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.00965;
  const sourceRasterBalanceCenterA = new THREE.Vector2(268, 110);
  const sourceRasterWheelCenter = new THREE.Vector2(264, 649);
  const sourceRasterNotchMouth = new THREE.Vector2(247, 151);
  const sourceRasterPalletTipB = new THREE.Vector2(328, 303);
  const sourceRasterLeftLockingToothD = new THREE.Vector2(70, 198);
  const sourceRasterRightLockingToothC = new THREE.Vector2(461, 202);
  const sourceRasterCrownPins = [
    new THREE.Vector2(198, 308),
    new THREE.Vector2(326, 303),
    new THREE.Vector2(439, 362),
  ];
  const sourceRasterWheelDirectionArrow = new THREE.Vector2(188, 226);
  const sourceRasterBalanceDirectionArrow = new THREE.Vector2(301, 74);
  const sourceRasterLockingTipRadius = 493;
  const sourceRasterImpulsePinRadius = 354;
  const balanceCenter = new THREE.Vector2(0, 2.05);
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    balanceCenter.x + (x - sourceRasterBalanceCenterA.x) * sourceScale,
    balanceCenter.y + (sourceRasterBalanceCenterA.y - y) * sourceScale,
  );
  const wheelCenter = sourcePointToModel(sourceRasterWheelCenter);
  const centerVector = balanceCenter.clone().sub(wheelCenter);
  const centerDistance = centerVector.length();
  const lockReferenceAngle = Math.atan2(centerVector.y, centerVector.x);

  const toothCount = 15;
  const toothPitch = FULL_TURN / toothCount;
  const rollerRadius = 0.44;
  const lockingToothTipRadius = centerDistance - rollerRadius;
  const lockingToothRootRadius = 4.10;
  const wheelInnerRadius = 3.34;
  const impulsePinOrbitRadius = 3.55;
  const impulsePinRadius = 0.105;
  const impulsePinLength = 0.70;
  const impulsePinPhaseOffset = THREE.MathUtils.degToRad(-22);
  const wheelDepth = 0.30;
  const palletPlaneZ = 0.64;
  const palletDepth = 0.20;
  const rollerDepth = 0.40;
  const rollerNotchHalfAngle = THREE.MathUtils.degToRad(19);
  const rollerNotchRootRadius = 0.18;

  const balancePeriod = 4;
  const balanceAmplitude = THREE.MathUtils.degToRad(52);
  const releaseStart = 0.205;
  const impulseStart = 0.230;
  const impulseEnd = 0.285;
  const landing = 0.330;
  const silentStart = 0.705;
  const silentMiddle = 0.750;
  const silentEnd = 0.795;
  const recoilAmplitude = toothPitch * 0.035;
  const stepDuration = (landing - releaseStart) * balancePeriod;
  const silentDuration = (silentEnd - silentStart) * balancePeriod;

  const cycleAtTime = (time) => {
    const coordinate = time / balancePeriod;
    const cycleIndex = Math.floor(coordinate);
    return {
      cycleIndex,
      phase: coordinate - cycleIndex,
    };
  };
  const balanceStateAtPhase = (phase) => {
    const argument = FULL_TURN * (phase - 0.25);
    const angularFrequency = FULL_TURN / balancePeriod;
    return {
      angle: balanceAmplitude * Math.sin(argument),
      angularAcceleration: -balanceAmplitude * angularFrequency ** 2
        * Math.sin(argument),
      angularSpeed: balanceAmplitude * angularFrequency
        * Math.cos(argument),
    };
  };
  const wheelStateAtPhase = (phase) => {
    if (phase < releaseStart) {
      return {
        advance: 0,
        angularAcceleration: 0,
        angularSpeed: 0,
        recoil: 0,
      };
    }
    if (phase < landing) {
      const progress = (phase - releaseStart) / (landing - releaseStart);
      const progressRate = 1 / stepDuration;
      return {
        advance: toothPitch * smootherStep(progress),
        angularAcceleration: -toothPitch
          * smootherStepSecondDerivative(progress) * progressRate ** 2,
        angularSpeed: -toothPitch
          * smootherStepDerivative(progress) * progressRate,
        recoil: 0,
      };
    }
    if (phase >= silentStart && phase <= silentEnd) {
      const progress = (phase - silentStart) / (silentEnd - silentStart);
      const argument = Math.PI * progress;
      const recoil = recoilAmplitude * Math.sin(argument) ** 2;
      return {
        advance: toothPitch - recoil,
        angularAcceleration: 2 * recoilAmplitude * Math.PI ** 2
          * Math.cos(2 * argument) / silentDuration ** 2,
        angularSpeed: recoilAmplitude * Math.PI
          * Math.sin(2 * argument) / silentDuration,
        recoil,
      };
    }
    return {
      advance: toothPitch,
      angularAcceleration: 0,
      angularSpeed: 0,
      recoil: 0,
    };
  };
  const wheelAngleAtCyclePhase = (cycleIndex, phase) => {
    const wheelState = wheelStateAtPhase(phase);
    return lockReferenceAngle
      - cycleIndex * toothPitch
      - wheelState.advance;
  };
  const lockingToothPoint = (wheelAngle, toothIndex) => {
    const angle = wheelAngle + toothIndex * toothPitch;
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * lockingToothTipRadius,
      Math.sin(angle) * lockingToothTipRadius,
    ));
  };
  const impulsePinCenter = (wheelAngle, pinIndex) => {
    const angle = wheelAngle + pinIndex * toothPitch
      + impulsePinPhaseOffset;
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * impulsePinOrbitRadius,
      Math.sin(angle) * impulsePinOrbitRadius,
    ));
  };
  const lockPoint = lockingToothPoint(lockReferenceAngle, 0);

  const releaseNotchLocalPointAtPhase = (phase) => {
    const balance = balanceStateAtPhase(phase);
    const wheelAngle = wheelAngleAtCyclePhase(0, phase);
    return rotate2(
      lockingToothPoint(wheelAngle, 0).sub(balanceCenter),
      -balance.angle,
    );
  };
  const silentNotchLocalPointAtPhase = (phase) => {
    const balance = balanceStateAtPhase(phase);
    const wheelAngle = wheelAngleAtCyclePhase(0, phase);
    return rotate2(
      lockingToothPoint(wheelAngle, 1).sub(balanceCenter),
      -balance.angle,
    );
  };
  const notchFrameAtPhase = (phase, mode) => {
    const epsilon = 1e-6;
    const pointFunction = mode === 'release'
      ? releaseNotchLocalPointAtPhase
      : silentNotchLocalPointAtPhase;
    const point = pointFunction(phase);
    const tangent = pointFunction(phase + epsilon)
      .sub(pointFunction(phase - epsilon)).normalize();
    return { point, tangent };
  };

  const impulsePinCenterLocalAtPhase = (phase) => {
    const balance = balanceStateAtPhase(phase);
    const wheelAngle = wheelAngleAtCyclePhase(0, phase);
    return rotate2(
      impulsePinCenter(wheelAngle, 0).sub(balanceCenter),
      -balance.angle,
    );
  };
  const impulsePinCenterFrameAtPhase = (phase) => {
    const epsilon = 1e-6;
    const center = impulsePinCenterLocalAtPhase(phase);
    const tangent = impulsePinCenterLocalAtPhase(phase + epsilon)
      .sub(impulsePinCenterLocalAtPhase(phase - epsilon)).normalize();
    const outwardNormal = new THREE.Vector2(-tangent.y, tangent.x);
    if (outwardNormal.dot(center) < 0) outwardNormal.multiplyScalar(-1);
    return { center, outwardNormal, tangent };
  };
  const impulsePalletLocalPointAtPhase = (phase) => {
    const frame = impulsePinCenterFrameAtPhase(phase);
    return frame.center.clone().addScaledVector(
      frame.outwardNormal,
      -impulsePinRadius,
    );
  };
  const impulsePalletFrameAtPhase = (phase) => {
    const epsilon = 1e-6;
    const centerFrame = impulsePinCenterFrameAtPhase(phase);
    const point = centerFrame.center.clone().addScaledVector(
      centerFrame.outwardNormal,
      -impulsePinRadius,
    );
    const tangent = impulsePalletLocalPointAtPhase(phase + epsilon)
      .sub(impulsePalletLocalPointAtPhase(phase - epsilon)).normalize();
    return { ...centerFrame, point, tangent };
  };
  const releaseNotchPoints = Array.from({ length: 31 }, (_, index) => (
    releaseNotchLocalPointAtPhase(THREE.MathUtils.lerp(
      releaseStart,
      impulseStart,
      index / 30,
    ))
  ));
  const silentNotchPoints = Array.from({ length: 61 }, (_, index) => (
    silentNotchLocalPointAtPhase(THREE.MathUtils.lerp(
      silentStart,
      silentEnd,
      index / 60,
    ))
  ));
  const impulsePalletPoints = Array.from({ length: 49 }, (_, index) => (
    impulsePalletLocalPointAtPhase(THREE.MathUtils.lerp(
      impulseStart,
      impulseEnd,
      index / 48,
    ))
  ));

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.54,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.13,
    roughness: 0.47,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.31,
    roughness: 0.42,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role =
    'clockwise-duplex-escape-wheel-with-two-tooth-systems';
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'single-beat-duplex-wheel-rotor';
  escapeWheel.add(wheelRotor);

  const lockingWheel = new THREE.Group();
  lockingWheel.userData.role = 'fifteen-long-in-plane-locking-teeth-C-D';
  const wheelShape = new THREE.Shape();
  wheelShape.absarc(0, 0, lockingToothRootRadius, 0, FULL_TURN, false);
  const wheelOpening = new THREE.Path();
  wheelOpening.absarc(0, 0, wheelInnerRadius, 0, FULL_TURN, true);
  wheelShape.holes.push(wheelOpening);
  const wheelRim = new THREE.Mesh(
    centeredExtrusion(wheelShape, wheelDepth, 0.007),
    driverMaterial,
  );
  wheelRim.userData.role = 'continuous-duplex-escape-wheel-rim';
  lockingWheel.add(wheelRim);
  const lockingToothShape = polygonShape([
    new THREE.Vector2(lockingToothRootRadius - 0.09, -0.16),
    new THREE.Vector2(lockingToothTipRadius, 0),
    new THREE.Vector2(lockingToothRootRadius - 0.09, 0.16),
  ]);
  const lockingToothGeometry = centeredExtrusion(
    lockingToothShape,
    wheelDepth + 0.02,
    0.005,
  );
  const lockingToothMeshes = [];
  for (let toothIndex = 0; toothIndex < toothCount; toothIndex += 1) {
    const tooth = new THREE.Mesh(lockingToothGeometry, driverMaterial);
    tooth.rotation.z = toothIndex * toothPitch;
    tooth.userData.index = toothIndex;
    tooth.userData.role = 'slender-in-plane-duplex-locking-tooth';
    lockingToothMeshes.push(tooth);
    lockingWheel.add(tooth);
  }
  wheelRotor.add(lockingWheel);

  const spokeMeshes = [];
  for (let spokeIndex = 0; spokeIndex < 4; spokeIndex += 1) {
    const angle = Math.PI / 4 + spokeIndex * Math.PI / 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(3.25, 0.27, wheelDepth * 0.84),
      driverMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * 1.63,
      Math.sin(angle) * 1.63,
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `duplex-wheel-spoke-${spokeIndex + 1}`;
    spokeMeshes.push(spoke);
    wheelRotor.add(spoke);
  }
  const wheelHub = cylinderAlongZ(0.43, 0.76, darkMaterial, 38);
  wheelHub.userData.role = 'duplex-wheel-arbor-hub';
  wheelRotor.add(wheelHub);
  const wheelShaft = cylinderAlongZ(0.14, 1.45, darkMaterial, 34);
  wheelShaft.userData.role = 'fixed-axis-duplex-wheel-shaft';
  escapeWheel.add(wheelShaft);

  const impulsePins = [];
  for (let pinIndex = 0; pinIndex < toothCount; pinIndex += 1) {
    const angle = pinIndex * toothPitch + impulsePinPhaseOffset;
    const pin = cylinderAlongZ(
      impulsePinRadius,
      impulsePinLength,
      driverMaterial,
      22,
    );
    pin.position.set(
      Math.cos(angle) * impulsePinOrbitRadius,
      Math.sin(angle) * impulsePinOrbitRadius,
      wheelDepth / 2 + impulsePinLength / 2 - 0.035,
    );
    pin.userData.index = pinIndex;
    pin.userData.role = 'short-axial-crown-impulse-pin-a';
    impulsePins.push(pin);
    wheelRotor.add(pin);
  }
  const wheelIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 18, 14),
    indexMaterial,
  );
  wheelIndex.position.set(
    Math.cos(impulsePinPhaseOffset) * impulsePinOrbitRadius,
    Math.sin(impulsePinPhaseOffset) * impulsePinOrbitRadius,
    wheelDepth / 2 + impulsePinLength + 0.015,
  );
  wheelIndex.userData.role = 'white-index-on-duplex-impulse-pin-zero';
  wheelRotor.add(wheelIndex);

  const balance = new THREE.Group();
  balance.position.set(balanceCenter.x, balanceCenter.y, 0);
  balance.userData.axis = Z_AXIS.clone();
  balance.userData.role =
    'oscillating-balance-staff-with-notched-roller-A-and-pallet-B';
  const lockingRoller = new THREE.Mesh(
    centeredExtrusion(notchedRollerShape(
      rollerRadius,
      rollerNotchHalfAngle,
      rollerNotchRootRadius,
    ), rollerDepth, 0.006),
    drivenMaterial,
  );
  lockingRoller.userData.role = 'notched-frictional-rest-locking-roller-A';
  balance.add(lockingRoller);
  const rollerHub = cylinderAlongZ(0.13, 1.42, darkMaterial, 32);
  rollerHub.userData.role = 'balance-staff-axis-A';
  balance.add(rollerHub);

  const outerLockPoints = Array.from({ length: 77 }, (_, index) => {
    const start = -Math.PI / 2 + rollerNotchHalfAngle;
    const arc = FULL_TURN - 2 * rollerNotchHalfAngle;
    const angle = start + arc * index / 76;
    return new THREE.Vector2(
      Math.cos(angle) * rollerRadius,
      Math.sin(angle) * rollerRadius,
    );
  });
  const outerLockEdge = edgeTube(
    outerLockPoints,
    rollerDepth / 2 + 0.018,
    0.035,
    indexMaterial,
    'roller-A-frictional-rest-circumference',
  );
  const releaseNotchEdge = edgeTube(
    releaseNotchPoints,
    rollerDepth / 2 + 0.028,
    0.040,
    accentMaterial,
    'roller-A-powered-beat-release-notch-flank',
  );
  const silentNotchEdge = edgeTube(
    silentNotchPoints,
    rollerDepth / 2 + 0.034,
    0.032,
    indexMaterial,
    'roller-A-silent-beat-recoil-notch-flank',
  );
  balance.add(outerLockEdge, releaseNotchEdge, silentNotchEdge);

  const palletBodyThickness = 0.22;
  const palletInnerPoints = impulsePalletPoints.map((point) => point.clone()
    .addScaledVector(point.clone().normalize(), -palletBodyThickness));
  const impulsePalletBody = new THREE.Mesh(
    centeredExtrusion(polygonShape([
      ...impulsePalletPoints,
      ...palletInnerPoints.reverse(),
    ]), palletDepth, 0.006),
    drivenMaterial,
  );
  impulsePalletBody.position.z = palletPlaneZ;
  impulsePalletBody.userData.role = 'balance-carried-impulse-pallet-B';
  const impulsePalletEdge = edgeTube(
    impulsePalletPoints,
    palletPlaneZ + palletDepth / 2 + 0.022,
    0.050,
    accentMaterial,
    'working-face-of-impulse-pallet-B',
  );
  const palletMidpoint = impulsePalletPoints[
    Math.floor(impulsePalletPoints.length / 2)
  ];
  const palletArmEnd = palletMidpoint.clone()
    .addScaledVector(palletMidpoint.clone().normalize(), -0.12);
  const impulsePalletArm = beamBetween(
    new THREE.Vector3(0, 0, palletPlaneZ),
    new THREE.Vector3(palletArmEnd.x, palletArmEnd.y, palletPlaneZ),
    0.22,
    palletDepth,
    drivenMaterial,
  );
  impulsePalletArm.userData.role = 'slender-balance-arm-to-pallet-B';
  balance.add(impulsePalletArm, impulsePalletBody, impulsePalletEdge);

  const balanceRim = new THREE.Mesh(
    new THREE.TorusGeometry(1.12, 0.105, 12, 72),
    drivenMaterial,
  );
  balanceRim.position.z = 0.93;
  balanceRim.userData.role = 'visible-balance-wheel-rim';
  const balanceSpokes = [];
  for (let index = 0; index < 3; index += 1) {
    const angle = index * FULL_TURN / 3;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(1.02, 0.11, 0.14),
      drivenMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * 0.51,
      Math.sin(angle) * 0.51,
      0.93,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `balance-wheel-spoke-${index + 1}`;
    balanceSpokes.push(spoke);
    balance.add(spoke);
  }
  balance.add(balanceRim);
  const balanceIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 18, 14),
    indexMaterial,
  );
  balanceIndex.position.set(0, 1.12, 1.05);
  balanceIndex.userData.role = 'white-index-on-duplex-balance';
  balance.add(balanceIndex);

  const lockContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 18, 14),
    indexMaterial,
  );
  lockContactMarker.position.z = rollerDepth / 2 + 0.11;
  lockContactMarker.userData.role =
    'white-marker-on-active-duplex-lock-or-notch-contact';
  const impulseContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 18, 14),
    indexMaterial,
  );
  impulseContactMarker.position.z = palletPlaneZ + palletDepth / 2 + 0.11;
  impulseContactMarker.userData.role =
    'white-marker-on-active-duplex-impulse-contact';

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-watch-plate-and-two-arbor-bearings';
  const rearStandard = beamBetween(
    new THREE.Vector3(
      wheelCenter.x,
      wheelCenter.y - lockingToothTipRadius - 0.70,
      -1.08,
    ),
    new THREE.Vector3(balanceCenter.x, balanceCenter.y + 1.55, -1.08),
    0.22,
    0.24,
    frameMaterial,
  );
  rearStandard.userData.role = 'fixed-rear-duplex-watch-plate-standard';
  const wheelBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.41, 0.08, 10, 42),
    frameMaterial,
  );
  wheelBearing.position.set(wheelCenter.x, wheelCenter.y, -0.83);
  wheelBearing.userData.role = 'fixed-duplex-wheel-arbor-bearing';
  const balanceBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.08, 10, 42),
    frameMaterial,
  );
  balanceBearing.position.set(balanceCenter.x, balanceCenter.y, -0.83);
  balanceBearing.userData.role = 'fixed-balance-staff-bearing-A';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(10.6, 0.25, 0.90),
    frameMaterial,
  );
  base.position.set(
    0,
    wheelCenter.y - lockingToothTipRadius - 0.88,
    -0.88,
  );
  base.userData.role = 'fixed-duplex-watch-frame-base';
  fixedFrame.add(rearStandard, wheelBearing, balanceBearing, base);

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(11.8, 13.5, 3.8),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0, -1.35, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-complete-duplex-watch-escapement';

  root.add(
    cameraEnvelope,
    fixedFrame,
    escapeWheel,
    balance,
    lockContactMarker,
    impulseContactMarker,
  );

  const stateAtTime = (time) => {
    const { cycleIndex, phase } = cycleAtTime(time);
    const balanceState = balanceStateAtPhase(phase);
    const wheelPhaseState = wheelStateAtPhase(phase);
    const wheelAngle = wheelAngleAtCyclePhase(cycleIndex, phase);
    const beforeLanding = phase < landing;
    const lockingToothIndex = positiveModulo(
      cycleIndex + (beforeLanding ? 0 : 1),
      toothCount,
    );
    const activeLockingToothPoint = lockingToothPoint(
      wheelAngle,
      lockingToothIndex,
    );
    const activeImpulsePinIndex = positiveModulo(cycleIndex, toothCount);
    const activeImpulsePinCenter = impulsePinCenter(
      wheelAngle,
      activeImpulsePinIndex,
    );

    let stage;
    let contactMode;
    if (phase < releaseStart) {
      stage = 'long-tooth-frictional-rest-before-powered-beat';
      contactMode = 'frictional-rest';
    } else if (phase < impulseStart) {
      stage = 'long-tooth-passes-powered-release-notch';
      contactMode = 'powered-notch-release';
    } else if (phase <= impulseEnd) {
      stage = 'short-crown-pin-impulses-pallet-B';
      contactMode = 'crown-pin-impulse';
    } else if (phase < landing) {
      stage = 'free-flight-to-next-long-locking-tooth';
      contactMode = null;
    } else if (phase < silentStart) {
      stage = 'next-long-tooth-frictional-rest';
      contactMode = 'frictional-rest';
    } else if (phase <= silentEnd) {
      stage = phase <= silentMiddle
        ? 'silent-beat-tooth-enters-notch'
        : 'silent-beat-notch-flank-recoils-tooth';
      contactMode = 'silent-notch-recoil';
    } else {
      stage = 'long-tooth-frictional-rest-after-silent-beat';
      contactMode = 'frictional-rest';
    }

    let contact = null;
    if (contactMode === 'frictional-rest') {
      const localPoint = rotate2(
        activeLockingToothPoint.clone().sub(balanceCenter),
        -balanceState.angle,
      );
      const faceTangent = rotate2(
        crossZ(localPoint).normalize(),
        balanceState.angle,
      );
      const faceNormal = new THREE.Vector2(
        -faceTangent.y,
        faceTangent.x,
      );
      const toothVelocity = crossZ(
        activeLockingToothPoint.clone().sub(wheelCenter),
      ).multiplyScalar(wheelPhaseState.angularSpeed);
      const rollerVelocity = crossZ(
        activeLockingToothPoint.clone().sub(balanceCenter),
      ).multiplyScalar(balanceState.angularSpeed);
      contact = {
        expectedPoint: activeLockingToothPoint.clone(),
        faceNormal,
        faceTangent,
        localPoint,
        mode: contactMode,
        normalVelocityError: toothVelocity.clone()
          .sub(rollerVelocity).dot(faceNormal),
        pointError: activeLockingToothPoint.distanceTo(lockPoint),
        relativeSlipSpeed: toothVelocity.clone()
          .sub(rollerVelocity).dot(faceTangent),
        rollerRadiusError: Math.abs(localPoint.length() - rollerRadius),
        rollerVelocity,
        toothVelocity,
      };
    } else if (
      contactMode === 'powered-notch-release'
      || contactMode === 'silent-notch-recoil'
    ) {
      const notchMode = contactMode === 'powered-notch-release'
        ? 'release'
        : 'silent';
      const frame = notchFrameAtPhase(phase, notchMode);
      const expectedPoint = balanceCenter.clone().add(
        rotate2(frame.point, balanceState.angle),
      );
      const faceTangent = rotate2(frame.tangent, balanceState.angle);
      const faceNormal = new THREE.Vector2(
        -faceTangent.y,
        faceTangent.x,
      );
      const toothVelocity = crossZ(
        activeLockingToothPoint.clone().sub(wheelCenter),
      ).multiplyScalar(wheelPhaseState.angularSpeed);
      const rollerVelocity = crossZ(
        expectedPoint.clone().sub(balanceCenter),
      ).multiplyScalar(balanceState.angularSpeed);
      const relativeVelocity = toothVelocity.clone().sub(rollerVelocity);
      contact = {
        expectedPoint,
        faceNormal,
        faceTangent,
        localPoint: frame.point,
        mode: contactMode,
        normalVelocityError: relativeVelocity.dot(faceNormal),
        pointError: activeLockingToothPoint.distanceTo(expectedPoint),
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
        rollerRadiusError: null,
        rollerVelocity,
        toothVelocity,
      };
    } else if (contactMode === 'crown-pin-impulse') {
      const frame = impulsePalletFrameAtPhase(phase);
      const expectedPoint = balanceCenter.clone().add(
        rotate2(frame.point, balanceState.angle),
      );
      const pinOffsetWorld = rotate2(
        frame.point.clone().sub(frame.center),
        balanceState.angle,
      );
      const pinSurfacePoint = activeImpulsePinCenter.clone()
        .add(pinOffsetWorld);
      const faceTangent = rotate2(frame.tangent, balanceState.angle);
      const faceNormal = new THREE.Vector2(
        -faceTangent.y,
        faceTangent.x,
      );
      const pinVelocity = crossZ(
        pinSurfacePoint.clone().sub(wheelCenter),
      ).multiplyScalar(wheelPhaseState.angularSpeed);
      const palletVelocity = crossZ(
        expectedPoint.clone().sub(balanceCenter),
      ).multiplyScalar(balanceState.angularSpeed);
      const relativeVelocity = pinVelocity.clone().sub(palletVelocity);
      contact = {
        expectedPoint,
        faceNormal,
        faceTangent,
        localPoint: frame.point,
        mode: contactMode,
        normalVelocityError: relativeVelocity.dot(faceNormal),
        palletVelocity,
        pinRadiusError: activeImpulsePinCenter.distanceTo(pinSurfacePoint)
          - impulsePinRadius,
        pinSurfacePoint,
        pinVelocity,
        pointError: pinSurfacePoint.distanceTo(expectedPoint),
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
        rollerRadiusError: null,
      };
    }

    return {
      activeImpulsePinCenter,
      activeImpulsePinIndex,
      activeLockingToothPoint,
      balanceAngle: balanceState.angle,
      balanceAngularAcceleration: balanceState.angularAcceleration,
      balanceAngularSpeed: balanceState.angularSpeed,
      contact,
      contactActive: contact !== null,
      contactMode,
      cycleIndex,
      cyclePhase: phase,
      lockingToothIndex,
      recoil: wheelPhaseState.recoil,
      singleBeatImpulseActive: contactMode === 'crown-pin-impulse',
      stage,
      wheelAdvance: wheelPhaseState.advance,
      wheelAngle,
      wheelAngularAcceleration: wheelPhaseState.angularAcceleration,
      wheelAngularSpeed: wheelPhaseState.angularSpeed,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * balancePeriod,
  );
  const canonicalTimes = {
    poweredRest: 0.10 * balancePeriod,
    releaseStart: releaseStart * balancePeriod,
    impulseStart: impulseStart * balancePeriod,
    impulseMiddle: (impulseStart + impulseEnd) / 2 * balancePeriod,
    impulseEnd: impulseEnd * balancePeriod,
    landing: landing * balancePeriod,
    silentStart: silentStart * balancePeriod,
    silentMiddle: silentMiddle * balancePeriod,
    silentEnd: silentEnd * balancePeriod,
    oneOscillation: balancePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    balance.rotation.z = state.balanceAngle;
    balance.userData.angularAcceleration = state.balanceAngularAcceleration;
    balance.userData.angularSpeed = state.balanceAngularSpeed;
    wheelRotor.rotation.z = state.wheelAngle;
    wheelRotor.userData.angularAcceleration =
      state.wheelAngularAcceleration;
    wheelRotor.userData.angularSpeed = state.wheelAngularSpeed;
    lockContactMarker.visible = state.contactActive
      && state.contactMode !== 'crown-pin-impulse';
    impulseContactMarker.visible = state.contactMode === 'crown-pin-impulse';
    if (lockContactMarker.visible) {
      lockContactMarker.position.set(
        state.contact.expectedPoint.x,
        state.contact.expectedPoint.y,
        rollerDepth / 2 + 0.11,
      );
    }
    if (impulseContactMarker.visible) {
      impulseContactMarker.position.set(
        state.contact.expectedPoint.x,
        state.contact.expectedPoint.y,
        palletPlaneZ + palletDepth / 2 + 0.11,
      );
    }
    root.userData.contacts = state.contactActive
      ? {
        activeImpulsePinIndex: state.activeImpulsePinIndex,
        activeLockingToothIndex: state.lockingToothIndex,
        mode: state.contactMode,
        normalVelocityError: state.contact.normalVelocityError,
        pointError: state.contact.pointError,
        relativeSlipSpeed: state.contact.relativeSlipSpeed,
      }
      : {
        activeImpulsePinIndex: state.activeImpulsePinIndex,
        activeLockingToothIndex: state.lockingToothIndex,
        mode: null,
        normalVelocityError: null,
        pointError: null,
        relativeSlipSpeed: null,
      };
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    'fifteen-tooth-single-beat-duplex-watch-escapement';
  root.userData.mechanism =
    'one 15-position duplex escape wheel combines long in-plane locking teeth C/D with short axial crown impulse pins a; the balance staff carries notched frictional-rest roller A and an axially raised impulse pallet B, so one balance crossing unlocks, receives impulse, and advances one tooth while the opposite crossing is a silent beat with only a small non-escaping recoil';
  root.userData.transmission = {
    direction: 'escape wheel advances clockwise, matching Brown’s rightward arrow over the upper rim',
    impulsePinCount: toothCount,
    impulseRate: 'one crown-pin impulse per complete balance oscillation',
    lockingToothCount: toothCount,
    oscillationAdvance: toothPitch,
    recoil: 'a small reversible notch disturbance occurs on the silent beat without releasing the locked tooth',
    singleBeat: true,
    toothCount,
  };
  root.userData.blocks = {
    balance,
    balanceBearing,
    balanceIndex,
    balanceRim,
    balanceSpokes,
    base,
    cameraEnvelope,
    escapeWheel,
    fixedFrame,
    impulseContactMarker,
    impulsePalletArm,
    impulsePalletBody,
    impulsePalletEdge,
    impulsePins,
    lockContactMarker,
    lockingRoller,
    lockingToothMeshes,
    lockingWheel,
    outerLockEdge,
    rearStandard,
    releaseNotchEdge,
    rollerHub,
    silentNotchEdge,
    spokeMeshes,
    wheelBearing,
    wheelHub,
    wheelIndex,
    wheelRim,
    wheelRotor,
    wheelShaft,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = {
    balanceAmplitude,
    balanceCenter: balanceCenter.clone(),
    balancePeriod,
    centerDistance,
    impulseEnd,
    impulsePinLength,
    impulsePinOrbitRadius,
    impulsePinPhaseOffset,
    impulsePinRadius,
    impulseStart,
    landing,
    lockReferenceAngle,
    lockingToothRootRadius,
    lockingToothTipRadius,
    palletDepth,
    palletPlaneZ,
    recoilAmplitude,
    releaseStart,
    rollerDepth,
    rollerNotchHalfAngle,
    rollerNotchRootRadius,
    rollerRadius,
    silentEnd,
    silentMiddle,
    silentStart,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    stepDuration,
    toothCount,
    toothPitch,
    wheelCenter: wheelCenter.clone(),
    wheelDepth,
    wheelInnerRadius,
  };
  root.userData.impulsePalletFrameAtPhase = impulsePalletFrameAtPhase;
  root.userData.impulsePalletLocalPointAtPhase =
    impulsePalletLocalPointAtPhase;
  root.userData.impulsePalletPoints = impulsePalletPoints;
  root.userData.impulsePinCenter = impulsePinCenter;
  root.userData.lockPoint = lockPoint.clone();
  root.userData.lockingToothPoint = lockingToothPoint;
  root.userData.notchFrameAtPhase = notchFrameAtPhase;
  root.userData.releaseNotchLocalPointAtPhase =
    releaseNotchLocalPointAtPhase;
  root.userData.releaseNotchPoints = releaseNotchPoints;
  root.userData.silentNotchLocalPointAtPhase =
    silentNotchLocalPointAtPhase;
  root.userData.silentNotchPoints = silentNotchPoints;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'The official movement 293 page supplies Brown’s static plate and description. The two wheel-tooth systems, notched roller A, raised pallet B, clockwise wheel direction, powered beat, and silent return beat are reconstructed from Brown and contemporary duplex descriptions; exact historic tooth forms and timing are not specified.',
    sourceUrl: 'https://507movements.com/mm_293.html',
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate293: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'a partial clockwise wheel carries long radial locking teeth C/D and a second row of axial crown pins a; notched roller A and raised pallet B share the balance staff',
      measurementUncertaintyPixels: 12,
      rasterBalanceCenterA: sourceRasterBalanceCenterA.clone(),
      rasterBalanceDirectionArrow: sourceRasterBalanceDirectionArrow.clone(),
      rasterCrownPins: sourceRasterCrownPins.map((point) => point.clone()),
      rasterImpulsePinRadius: sourceRasterImpulsePinRadius,
      rasterLeftLockingToothD: sourceRasterLeftLockingToothD.clone(),
      rasterLockingTipRadius: sourceRasterLockingTipRadius,
      rasterNotchMouth: sourceRasterNotchMouth.clone(),
      rasterPalletTipB: sourceRasterPalletTipB.clone(),
      rasterRightLockingToothC: sourceRasterRightLockingToothC.clone(),
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
      rasterWheelDirectionArrow: sourceRasterWheelDirectionArrow.clone(),
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 77,
      edition: 21,
      illustrationPage: 76,
      publicationYear: 1908,
    },
    periodReference: {
      description: 'long teeth lock on the balance verge; short upright pins impulse pallet P once per oscillation',
      source: 'Encyclopaedia Britannica, 11th edition, Watch, figure 6',
      publicationYear: 1911,
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: balancePeriod,
    schedule: [
      'long-locking-tooth-frictional-rest-on-roller-A',
      'powered-crossing-releases-through-notch-A',
      'short-crown-pin-impulses-raised-pallet-B',
      'next-long-tooth-lands-on-roller-A',
      'opposite-crossing-is-silent-with-small-recoil',
      'same-long-tooth-remains-locked',
    ],
  };
  root.userData.wheelAngleAtCyclePhase = wheelAngleAtCyclePhase;
  root.userData.wheelStateAtPhase = wheelStateAtPhase;

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
    balanceIndex,
    cameraEnvelope,
    impulseContactMarker,
    lockContactMarker,
    wheelIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';
  return {
    cameraDirection: new THREE.Vector3(6.3, 4.7, 14.2),
    root,
    update,
  };
}

export function createAuthoredDuplexEscapementMovement(movement) {
  if (movement.id !== 293) return null;
  return duplexEscapement(movement);
}
