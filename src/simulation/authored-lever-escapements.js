import {correctDuplexLeverInterfaces} from './duplex-lever-working-parts.js';
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

function cylinderAlongZ(radius, length, material, segments = 32) {
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
    curveSegments: 12,
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

function annularShape(outerRadius, innerRadius) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const opening = new THREE.Path();
  opening.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(opening);
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

function edgeTube(points, z, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, point.y, z)),
    false,
    'centripetal',
  );
  const edge = new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      Math.max(36, points.length * 2),
      radius,
      8,
      false,
    ),
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

function leverEscapement(movement) {
  const root = new THREE.Group();

  // Brown's B is one pivoted pallet anchor rigid with lever E-C. A pin on
  // balance roller D enters notch E only around the middle of each vibration.
  // During that brief engagement it first unlocks a pallet; the escape-wheel
  // tooth then impulses the pallet, fork, pin, and balance before the pin
  // leaves and the balance completes the rest of its vibration detached.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterPalletPivotB = new THREE.Vector2(297, 51);
  const sourceRasterWheelCenterA = new THREE.Vector2(300, 286);
  const sourceRasterBalanceCenterD = new THREE.Vector2(76, 76);
  const sourceRasterForkNotchE = new THREE.Vector2(116, 76);
  const sourceRasterLeverEndC = new THREE.Vector2(485, 75);
  const sourceRasterLeftPallet = new THREE.Vector2(177, 119);
  const sourceRasterRightPallet = new THREE.Vector2(401, 119);
  const sourceRasterBalanceDirectionArrow = new THREE.Vector2(15, 82);
  const sourceRasterWheelDirectionArrow = new THREE.Vector2(483, 156);
  const sourceRasterWheelOuterRadius = 198;
  const sourceScale = 3.5 / (
    sourceRasterWheelCenterA.y - sourceRasterPalletPivotB.y
  );
  const palletPivot = new THREE.Vector2(0, 3.5);
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    palletPivot.x + (x - sourceRasterPalletPivotB.x) * sourceScale,
    palletPivot.y + (sourceRasterPalletPivotB.y - y) * sourceScale,
  );
  const wheelCenter = sourcePointToModel(sourceRasterWheelCenterA);
  const balanceCenter = sourcePointToModel(sourceRasterBalanceCenterD);
  const balanceToPivot = palletPivot.clone().sub(balanceCenter);
  const balanceToPivotDistance = balanceToPivot.length();
  const balancePinMountAngle = Math.atan2(
    balanceToPivot.y,
    balanceToPivot.x,
  );

  const toothCount = 15;
  const toothPitch = FULL_TURN / toothCount;
  const halfToothPitch = toothPitch / 2;
  const wholePalletSpanTeeth = 2;
  const palletSpanTeeth = wholePalletSpanTeeth + 0.5;
  const palletSpanAngle = palletSpanTeeth * toothPitch;
  const leftContactReferenceAngle = Math.PI / 2 + palletSpanAngle / 2;
  const rightContactReferenceAngle = Math.PI / 2 - palletSpanAngle / 2;
  const wheelToothTipRadius = sourceRasterWheelOuterRadius * sourceScale;
  const wheelToothRootRadius = 2.43;
  const wheelInnerRadius = 2.04;
  const wheelDepth = 0.30;
  const forkDepth = 0.30;
  const forkPlaneZ = 0.36;
  const rollerPlaneZ = 0.68;

  const balancePeriod = 4;
  const halfBeatDuration = balancePeriod / 2;
  const balanceAmplitude = THREE.MathUtils.degToRad(68);
  const forkAmplitude = THREE.MathUtils.degToRad(7);
  const balancePinOrbitRadius = 0.68;
  const balancePinRadius = 0.085;
  const statedDisengagementAngle = THREE.MathUtils.degToRad(15);
  const pinEngagementHalfPhase = Math.acos(
    statedDisengagementAngle / balanceAmplitude,
  ) / Math.PI;
  const pinDisengagementHalfPhase = 1 - pinEngagementHalfPhase;
  const palletReleaseHalfPhase = 0.455;
  const palletImpulseEndHalfPhase = 0.535;
  const nextPalletLandingHalfPhase = pinDisengagementHalfPhase;
  const impulseAdvance = halfToothPitch * 0.68;
  const freeDropAdvance = halfToothPitch - impulseAdvance;

  const sideForHalfBeat = (halfBeatIndex) => (
    positiveModulo(halfBeatIndex, 2) === 0 ? 1 : -1
  );
  const planeNameForSide = (side) => (side > 0 ? 'left' : 'right');
  const contactReferenceAngleForSide = (side) => (
    side > 0 ? leftContactReferenceAngle : rightContactReferenceAngle
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
  const wheelAngleAtHalfLanding = (halfBeatIndex) => (
    leftContactReferenceAngle - halfBeatIndex * halfToothPitch
  );
  const halfBeatAtTime = (time) => {
    const coordinate = time / halfBeatDuration;
    const halfBeatIndex = Math.floor(coordinate);
    return {
      halfBeatIndex,
      halfPhase: coordinate - halfBeatIndex,
    };
  };
  const balanceStateAtHalfPhase = (side, halfPhase) => {
    const argument = Math.PI * halfPhase;
    const angularFrequency = Math.PI / halfBeatDuration;
    return {
      angle: -side * balanceAmplitude * Math.cos(argument),
      angularAcceleration: side * balanceAmplitude
        * angularFrequency ** 2 * Math.cos(argument),
      angularSpeed: side * balanceAmplitude
        * angularFrequency * Math.sin(argument),
    };
  };
  const forkStateAtHalfPhase = (side, halfPhase) => {
    if (halfPhase <= pinEngagementHalfPhase) {
      return {
        angle: -side * forkAmplitude,
        angularAcceleration: 0,
        angularSpeed: 0,
        progress: 0,
      };
    }
    if (halfPhase >= pinDisengagementHalfPhase) {
      return {
        angle: side * forkAmplitude,
        angularAcceleration: 0,
        angularSpeed: 0,
        progress: 1,
      };
    }
    const duration = (
      pinDisengagementHalfPhase - pinEngagementHalfPhase
    ) * halfBeatDuration;
    const progress = (
      halfPhase - pinEngagementHalfPhase
    ) / (
      pinDisengagementHalfPhase - pinEngagementHalfPhase
    );
    return {
      angle: -side * forkAmplitude
        + side * 2 * forkAmplitude * smootherStep(progress),
      angularAcceleration: side * 2 * forkAmplitude
        * smootherStepSecondDerivative(progress) / duration ** 2,
      angularSpeed: side * 2 * forkAmplitude
        * smootherStepDerivative(progress) / duration,
      progress,
    };
  };
  const wheelStep = (halfPhase, start, end, base, amount) => {
    const duration = (end - start) * halfBeatDuration;
    const progress = (halfPhase - start) / (end - start);
    return {
      advance: base + amount * smootherStep(progress),
      angularAcceleration: -amount
        * smootherStepSecondDerivative(progress) / duration ** 2,
      angularSpeed: -amount
        * smootherStepDerivative(progress) / duration,
      progress: THREE.MathUtils.clamp(progress, 0, 1),
    };
  };
  const wheelStateAtHalfPhase = (halfPhase) => {
    if (halfPhase < palletReleaseHalfPhase) {
      return {
        advance: 0,
        angularAcceleration: 0,
        angularSpeed: 0,
        event: 'locked',
        progress: 0,
      };
    }
    if (halfPhase < palletImpulseEndHalfPhase) {
      return {
        ...wheelStep(
          halfPhase,
          palletReleaseHalfPhase,
          palletImpulseEndHalfPhase,
          0,
          impulseAdvance,
        ),
        event: 'pallet-impulse',
      };
    }
    if (halfPhase < nextPalletLandingHalfPhase) {
      return {
        ...wheelStep(
          halfPhase,
          palletImpulseEndHalfPhase,
          nextPalletLandingHalfPhase,
          impulseAdvance,
          freeDropAdvance,
        ),
        event: 'free-drop',
      };
    }
    return {
      advance: halfToothPitch,
      angularAcceleration: 0,
      angularSpeed: 0,
      event: 'next-pallet-lock',
      progress: 1,
    };
  };
  const wheelAngleAtHalfPhase = (halfBeatIndex, halfPhase) => (
    wheelAngleAtHalfLanding(halfBeatIndex)
      - wheelStateAtHalfPhase(halfPhase).advance
  );
  const toothTipPoint = (wheelAngle, toothIndex) => {
    const angle = wheelAngle + toothIndex * toothPitch;
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * wheelToothTipRadius,
      Math.sin(angle) * wheelToothTipRadius,
    ));
  };
  const referenceToothPointForSide = (side, advance = 0) => {
    const angle = contactReferenceAngleForSide(side) - advance;
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * wheelToothTipRadius,
      Math.sin(angle) * wheelToothTipRadius,
    ));
  };

  const balancePinCenterAtHalfPhase = (side, halfPhase) => {
    const balance = balanceStateAtHalfPhase(side, halfPhase);
    const pinOffset = rotate2(new THREE.Vector2(
      Math.cos(balancePinMountAngle) * balancePinOrbitRadius,
      Math.sin(balancePinMountAngle) * balancePinOrbitRadius,
    ), balance.angle);
    return balanceCenter.clone().add(pinOffset);
  };
  const balancePinCenterForkLocal = (side, halfPhase) => {
    const fork = forkStateAtHalfPhase(side, halfPhase);
    return rotate2(
      balancePinCenterAtHalfPhase(side, halfPhase).sub(palletPivot),
      -fork.angle,
    );
  };
  const pinCenterFrameAtHalfPhase = (side, halfPhase) => {
    const epsilon = 1e-6;
    const center = balancePinCenterForkLocal(side, halfPhase);
    const tangent = balancePinCenterForkLocal(side, halfPhase + epsilon)
      .sub(balancePinCenterForkLocal(side, halfPhase - epsilon))
      .normalize();
    return {
      center,
      normal: new THREE.Vector2(-tangent.y, tangent.x),
      tangent,
    };
  };
  const forkTineFaceLocalPoint = (side, halfPhase) => {
    const frame = pinCenterFrameAtHalfPhase(side, halfPhase);
    return frame.center.clone().addScaledVector(
      frame.normal,
      balancePinRadius,
    );
  };
  const forkTineFaceFrame = (side, halfPhase) => {
    const epsilon = 1e-6;
    const centerFrame = pinCenterFrameAtHalfPhase(side, halfPhase);
    const point = forkTineFaceLocalPoint(side, halfPhase);
    const tangent = forkTineFaceLocalPoint(side, halfPhase + epsilon)
      .sub(forkTineFaceLocalPoint(side, halfPhase - epsilon))
      .normalize();
    return {
      ...centerFrame,
      faceNormal: new THREE.Vector2(-tangent.y, tangent.x),
      faceTangent: tangent,
      point,
    };
  };
  const forkTineFacePoints = (side, count = 49) => Array.from(
    { length: count },
    (_, index) => forkTineFaceLocalPoint(
      side,
      THREE.MathUtils.lerp(
        pinEngagementHalfPhase,
        pinDisengagementHalfPhase,
        index / (count - 1),
      ),
    ),
  );

  const palletLockLocalPointAtForkAngle = (side, forkAngle) => rotate2(
    referenceToothPointForSide(side).sub(palletPivot),
    -forkAngle,
  );
  const palletImpulseLocalPointAtHalfPhase = (side, halfPhase) => {
    const fork = forkStateAtHalfPhase(side, halfPhase);
    const wheel = wheelStateAtHalfPhase(halfPhase);
    return rotate2(
      referenceToothPointForSide(side, wheel.advance).sub(palletPivot),
      -fork.angle,
    );
  };
  const palletContactFrame = (side, halfPhase, mode) => {
    const fork = forkStateAtHalfPhase(side, halfPhase);
    const pointFunction = mode === 'impulse'
      ? (phase) => palletImpulseLocalPointAtHalfPhase(side, phase)
      : (phase) => palletLockLocalPointAtForkAngle(
        side,
        forkStateAtHalfPhase(side, phase).angle,
      );
    const epsilon = 1e-6;
    const point = mode === 'impulse'
      ? palletImpulseLocalPointAtHalfPhase(side, halfPhase)
      : palletLockLocalPointAtForkAngle(side, fork.angle);
    let tangent = pointFunction(halfPhase + epsilon)
      .sub(pointFunction(halfPhase - epsilon));
    if (tangent.lengthSq() < 1e-16) tangent = crossZ(point);
    tangent.normalize();
    return {
      normal: new THREE.Vector2(-tangent.y, tangent.x),
      point,
      tangent,
    };
  };
  const palletLockPoints = (side, count = 39) => Array.from(
    { length: count },
    (_, index) => {
      const halfPhase = THREE.MathUtils.lerp(
        pinEngagementHalfPhase,
        palletReleaseHalfPhase,
        index / (count - 1),
      );
      const fork = forkStateAtHalfPhase(side, halfPhase);
      return palletLockLocalPointAtForkAngle(side, fork.angle);
    },
  );
  const palletImpulsePoints = (side, count = 49) => Array.from(
    { length: count },
    (_, index) => palletImpulseLocalPointAtHalfPhase(
      side,
      THREE.MathUtils.lerp(
        palletReleaseHalfPhase,
        palletImpulseEndHalfPhase,
        index / (count - 1),
      ),
    ),
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.17,
    roughness: 0.51,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.53,
  });
  const palletMaterial = matte(PALETTE.accent, {
    metalness: 0.14,
    roughness: 0.45,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.31,
    roughness: 0.41,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role = 'clockwise-fifteen-tooth-lever-escape-wheel-A';
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'half-pitch-stepping-lever-escape-wheel-rotor';
  escapeWheel.add(wheelRotor);
  const wheelRim = new THREE.Mesh(
    centeredExtrusion(
      annularShape(wheelToothRootRadius, wheelInnerRadius),
      wheelDepth,
      0.006,
    ),
    driverMaterial,
  );
  wheelRim.userData.role = 'continuous-lever-escape-wheel-rim-A';
  wheelRotor.add(wheelRim);
  const toothShape = polygonShape([
    new THREE.Vector2(wheelToothRootRadius - 0.06, -0.15),
    new THREE.Vector2(wheelToothTipRadius - 0.04, -0.055),
    new THREE.Vector2(wheelToothTipRadius, 0),
    new THREE.Vector2(wheelToothRootRadius + 0.10, 0.13),
  ]);
  const toothGeometry = centeredExtrusion(toothShape, wheelDepth + 0.02, 0.005);
  const wheelTeeth = [];
  for (let index = 0; index < toothCount; index += 1) {
    const tooth = new THREE.Mesh(toothGeometry, driverMaterial);
    tooth.rotation.z = index * toothPitch;
    tooth.userData.index = index;
    tooth.userData.role = 'pointed-lever-escape-wheel-tooth';
    wheelTeeth.push(tooth);
    wheelRotor.add(tooth);
  }
  const wheelSpokes = [];
  for (let index = 0; index < 3; index += 1) {
    const angle = index * FULL_TURN / 3;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(2.08, 0.20, wheelDepth * 0.82),
      driverMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * 1.04,
      Math.sin(angle) * 1.04,
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `lever-escape-wheel-spoke-${index + 1}`;
    wheelSpokes.push(spoke);
    wheelRotor.add(spoke);
  }
  const wheelHub = cylinderAlongZ(0.37, 0.78, darkMaterial, 36);
  wheelHub.userData.role = 'lever-escape-wheel-hub-A';
  const wheelShaft = cylinderAlongZ(0.115, 1.45, darkMaterial, 32);
  wheelShaft.userData.role = 'fixed-lever-escape-wheel-arbor';
  wheelRotor.add(wheelHub);
  escapeWheel.add(wheelShaft);
  const wheelIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 18, 14),
    indexMaterial,
  );
  wheelIndex.position.set(wheelToothTipRadius - 0.16, 0, 0.24);
  wheelIndex.userData.role = 'white-index-on-lever-escape-wheel-A';
  wheelRotor.add(wheelIndex);

  const palletFork = new THREE.Group();
  palletFork.position.set(palletPivot.x, palletPivot.y, forkPlaneZ);
  palletFork.userData.axis = Z_AXIS.clone();
  palletFork.userData.role =
    'single-pivoted-anchor-B-rigid-with-forked-lever-E-C';
  const anchorBody = new THREE.Mesh(
    centeredExtrusion(polygonShape([
      new THREE.Vector2(-2.02, 0.26),
      new THREE.Vector2(-0.12, 0.86),
      new THREE.Vector2(1.98, 0.31),
      new THREE.Vector2(1.66, -0.38),
      new THREE.Vector2(1.25, -0.67),
      new THREE.Vector2(0.72, -0.21),
      new THREE.Vector2(-0.72, -0.21),
      new THREE.Vector2(-1.24, -0.68),
      new THREE.Vector2(-1.66, -0.38),
    ]), forkDepth, 0.008),
    drivenMaterial,
  );
  anchorBody.userData.role = 'broad-two-pallet-anchor-body-B';
  palletFork.add(anchorBody);

  const forkAxisLocal = balanceCenter.clone().sub(palletPivot).normalize();
  const forkRootLocal = forkAxisLocal.clone().multiplyScalar(
    balanceToPivotDistance - balancePinOrbitRadius - 0.26,
  );
  const forkLever = beamBetween(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(forkRootLocal.x, forkRootLocal.y, 0),
    0.30,
    forkDepth,
    drivenMaterial,
  );
  forkLever.userData.role = 'rigid-lever-from-anchor-B-to-notch-E';
  palletFork.add(forkLever);

  const forkTines = [];
  const forkTineEdges = [];
  const forkTineProfiles = {};
  for (const side of [1, -1]) {
    const name = side > 0 ? 'upper' : 'lower';
    const facePoints = forkTineFacePoints(side);
    const bodyPoints = facePoints.map((point, index) => {
      const phase = THREE.MathUtils.lerp(
        pinEngagementHalfPhase,
        pinDisengagementHalfPhase,
        index / (facePoints.length - 1),
      );
      const center = pinCenterFrameAtHalfPhase(side, phase).center;
      return point.clone().addScaledVector(
        point.clone().sub(center).normalize(),
        0.105,
      );
    });
    const tine = edgeTube(
      bodyPoints,
      0,
      0.105,
      drivenMaterial,
      `${name}-fork-tine-forming-notch-E`,
    );
    const workingEdge = edgeTube(
      facePoints,
      forkDepth / 2 + 0.035,
      0.028,
      indexMaterial,
      `${name}-working-face-of-fork-notch-E`,
    );
    forkTines.push(tine);
    forkTineEdges.push(workingEdge);
    forkTineProfiles[name] = facePoints;
    palletFork.add(tine, workingEdge);
  }

  const palletBlocks = [];
  const palletLockEdges = [];
  const palletImpulseEdges = [];
  const palletProfiles = {};
  for (const side of [1, -1]) {
    const name = planeNameForSide(side);
    const lockPoints = palletLockPoints(side);
    const impulsePoints = palletImpulsePoints(side);
    const workingPath = [
      ...lockPoints,
      ...impulsePoints.slice(1),
    ];
    const bodyThickness = 0.24;
    const innerPath = workingPath.map((point) => point.clone()
      .addScaledVector(point.clone().normalize(), -bodyThickness));
    const block = new THREE.Mesh(
      centeredExtrusion(polygonShape([
        ...workingPath,
        ...innerPath.reverse(),
      ]), forkDepth, 0.006),
      palletMaterial,
    );
    block.userData.side = side;
    block.userData.role = `${name}-jewelled-pallet-block`;
    const lockEdge = edgeTube(
      lockPoints,
      forkDepth / 2 + 0.030,
      0.033,
      indexMaterial,
      `${name}-pallet-locking-face`,
    );
    const impulseEdge = edgeTube(
      impulsePoints,
      forkDepth / 2 + 0.040,
      0.043,
      palletMaterial,
      `${name}-pallet-impulse-face`,
    );
    const bodyMid = workingPath[Math.floor(workingPath.length / 2)];
    const bridgeEnd = bodyMid.clone().multiplyScalar(0.82);
    const bridge = beamBetween(
      new THREE.Vector3(
        side * 0.80,
        -0.16,
        0,
      ),
      new THREE.Vector3(bridgeEnd.x, bridgeEnd.y, 0),
      0.24,
      forkDepth,
      drivenMaterial,
    );
    bridge.userData.role = `${name}-anchor-arm-to-pallet`;
    palletBlocks.push(block);
    palletLockEdges.push(lockEdge);
    palletImpulseEdges.push(impulseEdge);
    palletProfiles[name] = { impulsePoints, lockPoints };
    palletFork.add(bridge, block, lockEdge, impulseEdge);
  }
  const forkPivotHub = cylinderAlongZ(0.25, 0.92, darkMaterial, 34);
  forkPivotHub.position.z = 0;
  forkPivotHub.userData.role = 'lever-and-anchor-pivot-B';
  const forkIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.065, 0.08),
    indexMaterial,
  );
  forkIndex.position.set(0.32, 0, forkDepth / 2 + 0.10);
  forkIndex.userData.role = 'white-index-on-pallet-fork-B';
  palletFork.add(forkPivotHub, forkIndex);

  const balance = new THREE.Group();
  balance.position.set(balanceCenter.x, balanceCenter.y, 0);
  balance.userData.axis = Z_AXIS.clone();
  balance.userData.role = 'oscillating-balance-and-roller-disk-D';
  const rollerDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.84, 0.84, 0.22, 54),
    drivenMaterial,
  );
  rollerDisk.rotation.x = Math.PI / 2;
  rollerDisk.position.z = rollerPlaneZ;
  rollerDisk.userData.role = 'balance-roller-disk-D';
  const rollerRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.84, 0.055, 10, 54),
    darkMaterial,
  );
  rollerRim.position.z = rollerPlaneZ + 0.12;
  rollerRim.userData.role = 'rim-of-balance-roller-disk-D';
  const pinOffset = new THREE.Vector2(
    Math.cos(balancePinMountAngle) * balancePinOrbitRadius,
    Math.sin(balancePinMountAngle) * balancePinOrbitRadius,
  );
  const impulsePin = cylinderAlongZ(0.085, 0.62, indexMaterial, 22);
  impulsePin.position.set(
    pinOffset.x,
    pinOffset.y,
    forkPlaneZ + 0.16,
  );
  impulsePin.userData.role = 'balance-roller-impulse-pin-entering-notch-E';
  const balanceStaff = cylinderAlongZ(0.115, 2.20, darkMaterial, 32);
  balanceStaff.position.z = 0.48;
  balanceStaff.userData.role = 'balance-staff-through-roller-D';
  const balancePlaneZ = 1.28;
  const balanceRim = new THREE.Mesh(
    new THREE.TorusGeometry(1.18, 0.095, 12, 66),
    drivenMaterial,
  );
  balanceRim.position.z = balancePlaneZ;
  balanceRim.userData.role = 'detached-lever-escapement-balance-wheel';
  const balanceSpokes = [];
  for (let index = 0; index < 3; index += 1) {
    const angle = index * FULL_TURN / 3;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(1.07, 0.10, 0.12),
      drivenMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * 0.535,
      Math.sin(angle) * 0.535,
      balancePlaneZ,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `lever-balance-wheel-spoke-${index + 1}`;
    balanceSpokes.push(spoke);
    balance.add(spoke);
  }
  const balanceIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 18, 14),
    indexMaterial,
  );
  balanceIndex.position.set(0, 1.18, balancePlaneZ + 0.10);
  balanceIndex.userData.role = 'white-index-on-lever-balance';
  balance.add(
    rollerDisk,
    rollerRim,
    impulsePin,
    balanceStaff,
    balanceRim,
    balanceIndex,
  );

  const palletContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.082, 18, 14),
    indexMaterial,
  );
  palletContactMarker.userData.role =
    'white-marker-on-active-wheel-pallet-contact';
  const pinContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 14),
    indexMaterial,
  );
  pinContactMarker.userData.role =
    'white-marker-on-active-balance-pin-fork-contact';

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-three-arbor-lever-watch-frame';
  const framePlaneZ = -0.72;
  const rearStandard = beamBetween(
    new THREE.Vector3(
      balanceCenter.x - 0.85,
      wheelCenter.y - wheelToothTipRadius - 0.68,
      framePlaneZ,
    ),
    new THREE.Vector3(
      palletPivot.x + 2.25,
      palletPivot.y + 0.92,
      framePlaneZ,
    ),
    0.22,
    0.24,
    frameMaterial,
  );
  rearStandard.userData.role = 'fixed-rear-lever-watch-plate-standard';
  const wheelBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.075, 10, 40),
    frameMaterial,
  );
  wheelBearing.position.set(wheelCenter.x, wheelCenter.y, framePlaneZ + 0.12);
  wheelBearing.userData.role = 'fixed-lever-escape-wheel-bearing';
  const forkBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.30, 0.070, 10, 40),
    frameMaterial,
  );
  forkBearing.position.set(palletPivot.x, palletPivot.y, framePlaneZ + 0.12);
  forkBearing.userData.role = 'fixed-pallet-fork-bearing-B';
  const balanceBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.075, 10, 40),
    frameMaterial,
  );
  balanceBearing.position.set(
    balanceCenter.x,
    balanceCenter.y,
    framePlaneZ + 0.12,
  );
  balanceBearing.userData.role = 'fixed-balance-bearing-D';
  const bankingPins = [-1, 1].map((sign) => {
    const pin = cylinderAlongZ(0.085, 0.78, frameMaterial, 22);
    const local = rotate2(
      forkAxisLocal.clone().multiplyScalar(1.58),
      sign * forkAmplitude,
    );
    pin.position.set(
      palletPivot.x + local.x,
      palletPivot.y + local.y + sign * 0.18,
      forkPlaneZ,
    );
    pin.userData.role = sign > 0
      ? 'fixed-upper-fork-banking-pin'
      : 'fixed-lower-fork-banking-pin';
    return pin;
  });
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(9.7, 0.24, 0.88),
    frameMaterial,
  );
  base.position.set(-0.35, wheelCenter.y - wheelToothTipRadius - 0.88,
    framePlaneZ + 0.02);
  base.userData.role = 'fixed-lever-escapement-frame-base';
  fixedFrame.add(
    rearStandard,
    wheelBearing,
    forkBearing,
    balanceBearing,
    ...bankingPins,
    base,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(10.8, 10.1, 4.0),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-0.30, -0.55, 0.28);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-complete-lever-escapement';

  root.add(
    cameraEnvelope,
    fixedFrame,
    escapeWheel,
    palletFork,
    balance,
    palletContactMarker,
    pinContactMarker,
  );

  const stateAtTime = (time) => {
    const { halfBeatIndex, halfPhase } = halfBeatAtTime(time);
    const side = sideForHalfBeat(halfBeatIndex);
    const nextSide = -side;
    const balanceState = balanceStateAtHalfPhase(side, halfPhase);
    const forkState = forkStateAtHalfPhase(side, halfPhase);
    const wheelState = wheelStateAtHalfPhase(halfPhase);
    const wheelAngle = wheelAngleAtHalfPhase(halfBeatIndex, halfPhase);
    const beforeLanding = halfPhase < nextPalletLandingHalfPhase;
    const activeSide = beforeLanding ? side : nextSide;
    const activeHalfBeatIndex = beforeLanding
      ? halfBeatIndex
      : halfBeatIndex + 1;
    const activeToothIndex = activeToothIndexForHalfBeat(
      activeHalfBeatIndex,
    );
    const activeToothPoint = toothTipPoint(wheelAngle, activeToothIndex);
    const currentToothIndex = activeToothIndexForHalfBeat(halfBeatIndex);
    const currentToothPoint = toothTipPoint(wheelAngle, currentToothIndex);
    const balancePinCenter = balancePinCenterAtHalfPhase(side, halfPhase);

    let stage;
    let wheelContactMode;
    if (halfPhase < pinEngagementHalfPhase) {
      stage = 'balance-detached-while-current-pallet-locks-wheel';
      wheelContactMode = 'pallet-lock';
    } else if (halfPhase < palletReleaseHalfPhase) {
      stage = 'balance-pin-enters-E-and-unlocks-current-pallet';
      wheelContactMode = 'pallet-lock-during-unlocking';
    } else if (halfPhase < palletImpulseEndHalfPhase) {
      stage = 'escape-tooth-impulses-pallet-fork-pin-and-balance';
      wheelContactMode = 'pallet-impulse';
    } else if (halfPhase < nextPalletLandingHalfPhase) {
      stage = 'escape-wheel-drops-to-opposite-pallet';
      wheelContactMode = null;
    } else {
      stage = 'balance-detaches-while-opposite-pallet-locks-wheel';
      wheelContactMode = 'pallet-lock';
    }
    const forkPinContactActive = halfPhase >= pinEngagementHalfPhase
      && halfPhase <= pinDisengagementHalfPhase;

    let wheelContact = null;
    if (wheelContactMode !== null) {
      const profileSide = activeSide;
      const profileHalfPhase = wheelContactMode === 'pallet-impulse'
        ? halfPhase
        : beforeLanding
          ? halfPhase
          : 0;
      const frame = palletContactFrame(
        profileSide,
        profileHalfPhase,
        wheelContactMode === 'pallet-impulse' ? 'impulse' : 'lock',
      );
      const expectedPoint = palletPivot.clone().add(
        rotate2(frame.point, forkState.angle),
      );
      const faceTangent = rotate2(frame.tangent, forkState.angle);
      const faceNormal = rotate2(frame.normal, forkState.angle);
      const toothVelocity = crossZ(
        activeToothPoint.clone().sub(wheelCenter),
      ).multiplyScalar(wheelState.angularSpeed);
      const palletVelocity = crossZ(
        expectedPoint.clone().sub(palletPivot),
      ).multiplyScalar(forkState.angularSpeed);
      const relativeVelocity = toothVelocity.clone().sub(palletVelocity);
      wheelContact = {
        expectedPoint,
        faceNormal,
        faceTangent,
        localPoint: frame.point,
        mode: wheelContactMode,
        normalVelocityError: relativeVelocity.dot(faceNormal),
        palletSide: planeNameForSide(profileSide),
        palletVelocity,
        pointError: activeToothPoint.distanceTo(expectedPoint),
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
        toothVelocity,
      };
    }

    let forkPinContact = null;
    if (forkPinContactActive) {
      const frame = forkTineFaceFrame(side, halfPhase);
      const expectedPoint = palletPivot.clone().add(
        rotate2(frame.point, forkState.angle),
      );
      const faceTangent = rotate2(frame.faceTangent, forkState.angle);
      const faceNormal = rotate2(frame.faceNormal, forkState.angle);
      const surfaceOffset = rotate2(
        frame.point.clone().sub(frame.center),
        forkState.angle,
      );
      const pinSurfacePoint = balancePinCenter.clone().add(surfaceOffset);
      const pinVelocity = crossZ(
        pinSurfacePoint.clone().sub(balanceCenter),
      ).multiplyScalar(balanceState.angularSpeed);
      const forkVelocity = crossZ(
        expectedPoint.clone().sub(palletPivot),
      ).multiplyScalar(forkState.angularSpeed);
      const relativeVelocity = pinVelocity.clone().sub(forkVelocity);
      forkPinContact = {
        expectedPoint,
        faceNormal,
        faceTangent,
        forkVelocity,
        localPoint: frame.point,
        mode: halfPhase < palletReleaseHalfPhase
          ? 'balance-pin-drives-fork-unlocking'
          : 'fork-drives-balance-pin-impulse',
        normalVelocityError: relativeVelocity.dot(faceNormal),
        pinRadiusError: balancePinCenter.distanceTo(pinSurfacePoint)
          - balancePinRadius,
        pinSurfacePoint,
        pinVelocity,
        pointError: pinSurfacePoint.distanceTo(expectedPoint),
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
        tine: side > 0 ? 'upper' : 'lower',
      };
    }

    return {
      activePalletSide: planeNameForSide(activeSide),
      activeSide,
      activeToothIndex,
      activeToothPoint,
      balanceAngle: balanceState.angle,
      balanceAngularAcceleration: balanceState.angularAcceleration,
      balanceAngularSpeed: balanceState.angularSpeed,
      balanceDetached: !forkPinContactActive,
      balancePinCenter,
      currentToothIndex,
      currentToothPoint,
      forkAngle: forkState.angle,
      forkAngularAcceleration: forkState.angularAcceleration,
      forkAngularSpeed: forkState.angularSpeed,
      forkPinContact,
      forkPinContactActive,
      halfBeatIndex,
      halfPhase,
      side,
      stage,
      wheelAdvance: wheelState.advance,
      wheelAngle,
      wheelAngularAcceleration: wheelState.angularAcceleration,
      wheelAngularSpeed: wheelState.angularSpeed,
      wheelContact,
      wheelContactActive: wheelContact !== null,
      wheelContactMode,
      wheelEvent: wheelState.event,
      wheelEventProgress: wheelState.progress,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * balancePeriod,
  );
  const canonicalTimes = {
    firstDetached: 0.10 * halfBeatDuration,
    firstPinEntry: pinEngagementHalfPhase * halfBeatDuration,
    firstUnlock: 0.445 * halfBeatDuration,
    firstImpulse: 0.495 * halfBeatDuration,
    firstDrop: 0.550 * halfBeatDuration,
    firstLanding: nextPalletLandingHalfPhase * halfBeatDuration,
    secondDetached: halfBeatDuration + 0.10 * halfBeatDuration,
    secondImpulse: halfBeatDuration + 0.495 * halfBeatDuration,
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
    palletFork.rotation.z = state.forkAngle;
    palletFork.userData.angularAcceleration = state.forkAngularAcceleration;
    palletFork.userData.angularSpeed = state.forkAngularSpeed;
    wheelRotor.rotation.z = state.wheelAngle;
    wheelRotor.userData.angularAcceleration = state.wheelAngularAcceleration;
    wheelRotor.userData.angularSpeed = state.wheelAngularSpeed;
    palletContactMarker.visible = state.wheelContactActive;
    pinContactMarker.visible = state.forkPinContactActive;
    if (state.wheelContactActive) {
      palletContactMarker.position.set(
        state.wheelContact.expectedPoint.x,
        state.wheelContact.expectedPoint.y,
        forkPlaneZ + forkDepth / 2 + 0.13,
      );
    }
    if (state.forkPinContactActive) {
      pinContactMarker.position.set(
        state.forkPinContact.expectedPoint.x,
        state.forkPinContact.expectedPoint.y,
        forkPlaneZ + forkDepth / 2 + 0.15,
      );
    }
    root.userData.contacts = {
      activePalletSide: state.activePalletSide,
      activeToothIndex: state.activeToothIndex,
      forkPin: state.forkPinContactActive
        ? {
          mode: state.forkPinContact.mode,
          normalVelocityError: state.forkPinContact.normalVelocityError,
          pinRadiusError: state.forkPinContact.pinRadiusError,
          pointError: state.forkPinContact.pointError,
          tine: state.forkPinContact.tine,
        }
        : null,
      wheelPallet: state.wheelContactActive
        ? {
          mode: state.wheelContact.mode,
          normalVelocityError: state.wheelContact.normalVelocityError,
          palletSide: state.wheelContact.palletSide,
          pointError: state.wheelContact.pointError,
        }
        : null,
    };
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    'fifteen-tooth-detached-double-beat-roller-pin-lever-escapement';
  root.userData.mechanism =
    'one 15-tooth clockwise escape wheel alternates between two pallets on anchor B; near the middle of each balance vibration the single roller pin on D enters fork notch E, unlocks the active pallet, receives the wheel impulse back through pallet and rigid lever E-C, and leaves about 15 degrees past center so the balance is detached for the remainder of the arc';
  root.userData.transmission = {
    balanceImpulseCountPerOscillation: 2,
    balanceIsDetachedOutsideForkWindow: true,
    direction: 'escape wheel advances clockwise, matching Brown’s right-hand downward arrow',
    halfBeatAdvance: halfToothPitch,
    impulseAdvance,
    oneRollerPin: true,
    oscillationAdvance: toothPitch,
    palletCount: 2,
    toothCount,
  };
  root.userData.blocks = {
    anchorBody,
    balance,
    balanceBearing,
    balanceIndex,
    balanceRim,
    balanceSpokes,
    balanceStaff,
    bankingPins,
    base,
    cameraEnvelope,
    escapeWheel,
    fixedFrame,
    forkBearing,
    forkIndex,
    forkLever,
    forkPivotHub,
    forkTineEdges,
    forkTines,
    impulsePin,
    palletBlocks,
    palletContactMarker,
    palletFork,
    palletImpulseEdges,
    palletLockEdges,
    pinContactMarker,
    rearStandard,
    rollerDisk,
    rollerRim,
    wheelBearing,
    wheelHub,
    wheelIndex,
    wheelRim,
    wheelRotor,
    wheelShaft,
    wheelSpokes,
    wheelTeeth,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contactReferenceAngleForSide =
    contactReferenceAngleForSide;
  root.userData.forkTineFaceFrame = forkTineFaceFrame;
  root.userData.forkTineFacePoints = forkTineFacePoints;
  root.userData.forkTineProfiles = forkTineProfiles;
  root.userData.geometry = {
    balanceAmplitude,
    balanceCenter: balanceCenter.clone(),
    balancePeriod,
    balancePinMountAngle,
    balancePinOrbitRadius,
    balancePinRadius,
    forkAmplitude,
    forkDepth,
    forkPlaneZ,
    freeDropAdvance,
    halfBeatDuration,
    halfToothPitch,
    impulseAdvance,
    leftContactReferenceAngle,
    nextPalletLandingHalfPhase,
    palletImpulseEndHalfPhase,
    palletPivot: palletPivot.clone(),
    palletReleaseHalfPhase,
    palletSpanAngle,
    palletSpanTeeth,
    pinDisengagementHalfPhase,
    pinEngagementHalfPhase,
    rightContactReferenceAngle,
    rollerPlaneZ,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    statedDisengagementAngle,
    toothCount,
    toothPitch,
    wheelCenter: wheelCenter.clone(),
    wheelDepth,
    wheelInnerRadius,
    wheelToothRootRadius,
    wheelToothTipRadius,
    wholePalletSpanTeeth,
  };
  root.userData.palletContactFrame = palletContactFrame;
  root.userData.palletImpulsePoints = palletImpulsePoints;
  root.userData.palletLockPoints = palletLockPoints;
  root.userData.palletProfiles = palletProfiles;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'The official movement 296 page supplies Brown’s static wheel A, pallet anchor B, lever end C, fork notch E, balance roller D, arrows, and written sequence. The 15-degree detached fork window is corroborated by the contemporary lever description; exact historic pallet draw, lift, and drop dimensions are not given.',
    sourceUrl: 'https://507movements.com/mm_296.html',
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    periodReference: {
      description: 'the roller pin enters the lever nick near center and normally leaves about 15 degrees past center; the pallets use dead faces with slight safety draw',
      figure: 4,
      publicationYear: 1911,
      source: 'Encyclopaedia Britannica, 11th edition, Watch',
    },
    plate296: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one clockwise 15-tooth wheel A, one two-pallet anchor pivoted at B, one rigid E-C lever, and one balance roller D whose single pin enters fork notch E',
      measurementUncertaintyPixels: 8,
      rasterBalanceCenterD: sourceRasterBalanceCenterD.clone(),
      rasterBalanceDirectionArrow: sourceRasterBalanceDirectionArrow.clone(),
      rasterForkNotchE: sourceRasterForkNotchE.clone(),
      rasterLeftPallet: sourceRasterLeftPallet.clone(),
      rasterLeverEndC: sourceRasterLeverEndC.clone(),
      rasterPalletPivotB: sourceRasterPalletPivotB.clone(),
      rasterRightPallet: sourceRasterRightPallet.clone(),
      rasterWheelCenterA: sourceRasterWheelCenterA.clone(),
      rasterWheelDirectionArrow: sourceRasterWheelDirectionArrow.clone(),
      rasterWheelOuterRadius: sourceRasterWheelOuterRadius,
      visibleWheelToothCount: 15,
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
    demonstrationPeriod: balancePeriod,
    schedule: [
      'balance-free-current-pallet-locked',
      'roller-pin-enters-E-and-unlocks',
      'escape-tooth-impulses-pallet-fork-and-balance',
      'wheel-drops-to-opposite-pallet',
      'roller-pin-leaves-E-and-balance-is-free',
      'same-sequence-in-opposite-direction',
    ],
  };
  root.userData.toothTipPoint = toothTipPoint;
  root.userData.wheelAngleAtHalfLanding = wheelAngleAtHalfLanding;
  root.userData.wheelStateAtHalfPhase = wheelStateAtHalfPhase;

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
    palletContactMarker,
    pinContactMarker,
    wheelIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';
  correctDuplexLeverInterfaces(root, 296, update);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredLeverEscapementMovement(movement) {
  if (movement.id !== 296) return null;
  return leverEscapement(movement);
}
