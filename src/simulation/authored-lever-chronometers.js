import {correctDetachedChronometer} from './detached-chronometer-working-parts.js';
import * as THREE from 'three';
import {plate,poly,circle,polygonClipping} from './finite-plate-geometry.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
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

// First-quadrant window bounded by the crossings x = h, y = h and an outer
// arc of radius outerRadius, with fillets at all three corners (Brown's
// rounded-square windows), returned counter-clockwise as [x, y] pairs.
function filletedQuadrantWindow(h, outerRadius, innerFillet, outerFillet, samples = 10) {
  const points = [];
  const arc = (cx, cy, radius, from, to) => {
    for (let step = 0; step <= samples; step += 1) {
      const angle = from + (to - from) * step / samples;
      points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
    }
  };
  const inner = h + innerFillet;
  arc(inner, inner, innerFillet, Math.PI, Math.PI * 1.5);
  const cy = h + outerFillet;
  const cx = Math.sqrt((outerRadius - outerFillet) ** 2 - cy ** 2);
  const lowAngle = Math.atan2(cy, cx);
  arc(cx, cy, outerFillet, -Math.PI / 2, lowAngle);
  const highAngle = Math.PI / 2 - lowAngle;
  for (let step = 1; step < samples * 2; step += 1) {
    const angle = lowAngle + (highAngle - lowAngle) * step / (samples * 2);
    points.push([Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius]);
  }
  arc(cy, cx, outerFillet, highAngle, Math.PI);
  return points;
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

// Crescent through the pallet end, across the lever below the pivot, to a
// short horn beyond the lever's far edge (Brown's plate B), in lever-local
// coordinates.
function crescentCarrierShape(palletCentroid, tailAxis) {
  const tailNormal = new THREE.Vector2(-tailAxis.y, tailAxis.x);
  const along = palletCentroid.dot(tailAxis);
  const across = palletCentroid.dot(tailNormal);
  const start = palletCentroid.clone();
  const middle = tailAxis.clone().multiplyScalar(along * 0.80);
  const end = tailAxis.clone().multiplyScalar(along * 0.60)
    .addScaledVector(tailNormal, -across * 0.32);
  const samples = 24;
  const spine = [];
  for (let step = 0; step <= samples; step += 1) {
    const t = step / samples;
    const a = start.clone().multiplyScalar((1 - t) ** 2);
    const b = middle.clone().multiplyScalar(2 * (1 - t) * t);
    const c = end.clone().multiplyScalar(t ** 2);
    spine.push(a.add(b).add(c));
  }
  const left = [];
  const right = [];
  spine.forEach((point, index) => {
    const previous = spine[Math.max(index - 1, 0)];
    const next = spine[Math.min(index + 1, samples)];
    const tangent = next.clone().sub(previous).normalize();
    const normal = new THREE.Vector2(-tangent.y, tangent.x);
    const t = index / samples;
    const halfWidth = 0.14 + 0.20 * Math.sin(Math.PI * Math.min(t * 1.15, 1));
    left.push(point.clone().addScaledVector(normal, halfWidth));
    right.push(point.clone().addScaledVector(normal, -halfWidth));
  });
  return polygonShape([...left, ...right.reverse()]);
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

function profileStripShape(points, radialWidth) {
  const inner = points.map((point) => {
    const radius = point.length();
    return point.clone().multiplyScalar(
      Math.max(radius - radialWidth, 0.08) / radius,
    );
  });
  return polygonShape([...points, ...inner.reverse()]);
}

function leverChronometerEscapement(movement) {
  const root = new THREE.Group();

  // Brown copied this arrangement from Grimthorpe's fig. 77. A and B are
  // locking faces only. On the acting vibration A releases, a different
  // tooth gives direct impulse to balance pallet C, and the tooth between A
  // and B lands on B. On the return vibration B releases for only the small
  // residual advance needed to put the wheel back on A; no impulse occurs.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterWheelCenter = new THREE.Vector2(175, 275);
  const sourceRasterBalanceCenter = new THREE.Vector2(373, 115);
  const sourceRasterLeverPivot = new THREE.Vector2(375, 200);
  const sourceRasterBalancePin = new THREE.Vector2(373, 159);
  const sourceRasterImpulseStartC = new THREE.Vector2(281, 145);
  const sourceRasterPalletA = new THREE.Vector2(349, 299);
  const sourceRasterPalletBFreeTip = new THREE.Vector2(203, 397);
  const sourceRasterLeftBank = new THREE.Vector2(324, 477);
  const sourceRasterRightBank = new THREE.Vector2(424, 467);
  const sourceRasterWheelOuterRadius = 168;
  const sourceRasterBalanceOuterRadius = 84;
  const sourceScale = 3.25 / sourceRasterWheelOuterRadius;
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterWheelCenter.x) * sourceScale,
    (sourceRasterWheelCenter.y - y) * sourceScale,
  );

  const wheelCenter = sourcePointToModel(sourceRasterWheelCenter);
  const balanceCenter = sourcePointToModel(sourceRasterBalanceCenter);
  const leverPivot = sourcePointToModel(sourceRasterLeverPivot);
  const balanceToLever = leverPivot.clone().sub(balanceCenter);
  const leverToBalance = balanceCenter.clone().sub(leverPivot);
  const balanceToLeverDistance = balanceToLever.length();
  const balancePinMountAngle = Math.atan2(
    balanceToLever.y,
    balanceToLever.x,
  );

  const toothCount = 15;
  const toothPitch = FULL_TURN / toothCount;
  const longImpulseAdvance = toothPitch * 0.75;
  const shortReturnAdvance = toothPitch - longImpulseAdvance;
  const wheelToothTipRadius = sourceRasterWheelOuterRadius * sourceScale;
  const wheelToothRootRadius = 2.52;
  const wheelInnerRadius = 2.18;
  const wheelDepth = 0.30;
  const wheelBaseAngle = 0;
  const palletAReferenceAngle = wheelBaseAngle;
  const palletBReferenceAngle = wheelBaseAngle
    - toothPitch
    - longImpulseAdvance;
  const directImpulseToothOffset = 2;
  const directImpulseStartAngle = wheelBaseAngle
    + directImpulseToothOffset * toothPitch;

  const balancePeriod = 4;
  const halfBeatDuration = balancePeriod / 2;
  const balanceAmplitude = THREE.MathUtils.degToRad(68);
  const leverAmplitude = THREE.MathUtils.degToRad(7);
  const balancePinOrbitRadius = sourceRasterBalancePin
    .distanceTo(sourceRasterBalanceCenter) * sourceScale;
  const balancePinRadius = 0.085;
  const statedLeverDetachAngle = THREE.MathUtils.degToRad(15);
  const pinEngagementHalfPhase = Math.acos(
    statedLeverDetachAngle / balanceAmplitude,
  ) / Math.PI;
  const pinDisengagementHalfPhase = 1 - pinEngagementHalfPhase;
  const palletReleaseHalfPhase = 0.455;
  const nextPalletLandingHalfPhase = pinDisengagementHalfPhase;

  // The lever (z 0.18..0.46) lies just in front of the wheel (front face
  // 0.16), as Brown draws B across the teeth; only short locking nibs reach
  // back into the wheel plane (added after the finite-part corrections).
  const leverPlaneZ = 0.32;
  const leverDepth = 0.28;
  // C sweeps past the lever pivot, so it and its carrier run in the rear half
  // of the wheel plane (z -0.15..0.09), below the lever arms, pallets and fork
  // (z >= 0.10); the lever's hub and arbor start in front of that layer.
  const directPalletPlaneZ = -0.03;
  const directPalletDepth = 0.22;
  const rollerPlaneZ = 0.58;
  const balancePlaneZ = 1.12;

  const sideForHalfBeat = (halfBeatIndex) => (
    positiveModulo(halfBeatIndex, 2) === 0 ? 1 : -1
  );
  const isActingHalfBeat = (halfBeatIndex) => (
    sideForHalfBeat(halfBeatIndex) > 0
  );
  const palletNameForSide = (side) => (side > 0 ? 'A' : 'B');
  const referenceAngleForPallet = (name) => (
    name === 'A' ? palletAReferenceAngle : palletBReferenceAngle
  );
  const referencePointForPallet = (name) => {
    const angle = referenceAngleForPallet(name);
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * wheelToothTipRadius,
      Math.sin(angle) * wheelToothTipRadius,
    ));
  };
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
  const leverStateAtHalfPhase = (side, halfPhase) => {
    if (halfPhase <= pinEngagementHalfPhase) {
      return {
        angle: -side * leverAmplitude,
        angularAcceleration: 0,
        angularSpeed: 0,
        progress: 0,
      };
    }
    if (halfPhase >= pinDisengagementHalfPhase) {
      return {
        angle: side * leverAmplitude,
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
      angle: -side * leverAmplitude
        + side * 2 * leverAmplitude * smootherStep(progress),
      angularAcceleration: side * 2 * leverAmplitude
        * smootherStepSecondDerivative(progress) / duration ** 2,
      angularSpeed: side * 2 * leverAmplitude
        * smootherStepDerivative(progress) / duration,
      progress,
    };
  };
  const wheelAdvanceAtHalfPhase = (acting, halfPhase) => {
    const totalAdvance = acting
      ? longImpulseAdvance
      : shortReturnAdvance;
    if (halfPhase <= palletReleaseHalfPhase) {
      return {
        advance: 0,
        angularAcceleration: 0,
        angularSpeed: 0,
        event: 'locked',
        progress: 0,
      };
    }
    if (halfPhase >= nextPalletLandingHalfPhase) {
      return {
        advance: totalAdvance,
        angularAcceleration: 0,
        angularSpeed: 0,
        event: acting ? 'B-lock-after-direct-impulse' : 'A-lock-after-short-transfer',
        progress: 1,
      };
    }
    const duration = (
      nextPalletLandingHalfPhase - palletReleaseHalfPhase
    ) * halfBeatDuration;
    const progress = (
      halfPhase - palletReleaseHalfPhase
    ) / (
      nextPalletLandingHalfPhase - palletReleaseHalfPhase
    );
    return {
      advance: totalAdvance * smootherStep(progress),
      angularAcceleration: -totalAdvance
        * smootherStepSecondDerivative(progress) / duration ** 2,
      angularSpeed: -totalAdvance
        * smootherStepDerivative(progress) / duration,
      event: acting ? 'direct-impulse-C' : 'short-unpowered-B-to-A-transfer',
      progress,
    };
  };
  const accumulatedAdvanceAtHalfLanding = (halfBeatIndex) => {
    const oscillationIndex = Math.floor(halfBeatIndex / 2);
    return oscillationIndex * toothPitch
      + (isActingHalfBeat(halfBeatIndex) ? 0 : longImpulseAdvance);
  };
  const wheelAngleAtHalfLanding = (halfBeatIndex) => (
    wheelBaseAngle - accumulatedAdvanceAtHalfLanding(halfBeatIndex)
  );
  const wheelAngleAtHalfPhase = (halfBeatIndex, halfPhase) => (
    wheelAngleAtHalfLanding(halfBeatIndex)
      - wheelAdvanceAtHalfPhase(
        isActingHalfBeat(halfBeatIndex),
        halfPhase,
      ).advance
  );
  const currentLockToothIndex = (halfBeatIndex) => {
    const oscillationIndex = Math.floor(halfBeatIndex / 2);
    return isActingHalfBeat(halfBeatIndex)
      ? positiveModulo(oscillationIndex, toothCount)
      : positiveModulo(oscillationIndex - 1, toothCount);
  };
  const directImpulseToothIndex = (halfBeatIndex) => {
    const oscillationIndex = Math.floor(halfBeatIndex / 2);
    return positiveModulo(
      oscillationIndex + directImpulseToothOffset,
      toothCount,
    );
  };
  const toothTipPoint = (wheelAngle, toothIndex) => {
    const angle = wheelAngle + toothIndex * toothPitch;
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * wheelToothTipRadius,
      Math.sin(angle) * wheelToothTipRadius,
    ));
  };

  const balancePinCenterAtHalfPhase = (side, halfPhase) => {
    const balance = balanceStateAtHalfPhase(side, halfPhase);
    const offset = rotate2(new THREE.Vector2(
      Math.cos(balancePinMountAngle) * balancePinOrbitRadius,
      Math.sin(balancePinMountAngle) * balancePinOrbitRadius,
    ), balance.angle);
    return balanceCenter.clone().add(offset);
  };
  const balancePinCenterLeverLocal = (side, halfPhase) => {
    const lever = leverStateAtHalfPhase(side, halfPhase);
    return rotate2(
      balancePinCenterAtHalfPhase(side, halfPhase).sub(leverPivot),
      -lever.angle,
    );
  };
  const pinCenterFrameAtHalfPhase = (side, halfPhase) => {
    const epsilon = 1e-6;
    const center = balancePinCenterLeverLocal(side, halfPhase);
    const tangent = balancePinCenterLeverLocal(side, halfPhase + epsilon)
      .sub(balancePinCenterLeverLocal(side, halfPhase - epsilon))
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

  const palletSideForName = (name) => (name === 'A' ? 1 : -1);
  const palletLockLocalPoint = (name, halfPhase) => {
    const side = palletSideForName(name);
    const lever = leverStateAtHalfPhase(side, halfPhase);
    return rotate2(
      referencePointForPallet(name).sub(leverPivot),
      -lever.angle,
    );
  };
  const palletLockFrame = (name, halfPhase) => {
    const epsilon = 1e-6;
    const point = palletLockLocalPoint(name, halfPhase);
    let tangent = palletLockLocalPoint(name, halfPhase + epsilon)
      .sub(palletLockLocalPoint(name, halfPhase - epsilon));
    if (tangent.lengthSq() < 1e-16) tangent = crossZ(point);
    tangent.normalize();
    return {
      normal: new THREE.Vector2(-tangent.y, tangent.x),
      point,
      tangent,
    };
  };
  const palletLockPoints = (name, count = 39) => Array.from(
    { length: count },
    (_, index) => palletLockLocalPoint(
      name,
      THREE.MathUtils.lerp(
        pinEngagementHalfPhase,
        palletReleaseHalfPhase,
        index / (count - 1),
      ),
    ),
  );

  const directImpulseLocalPointAtHalfPhase = (halfPhase) => {
    const balance = balanceStateAtHalfPhase(1, halfPhase);
    const wheel = wheelAdvanceAtHalfPhase(true, halfPhase);
    const toothAngle = directImpulseStartAngle - wheel.advance;
    const toothPoint = wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(toothAngle) * wheelToothTipRadius,
      Math.sin(toothAngle) * wheelToothTipRadius,
    ));
    return rotate2(toothPoint.sub(balanceCenter), -balance.angle);
  };
  const directImpulseFrame = (halfPhase) => {
    const epsilon = 1e-6;
    const point = directImpulseLocalPointAtHalfPhase(halfPhase);
    const tangent = directImpulseLocalPointAtHalfPhase(halfPhase + epsilon)
      .sub(directImpulseLocalPointAtHalfPhase(halfPhase - epsilon))
      .normalize();
    return {
      normal: new THREE.Vector2(-tangent.y, tangent.x),
      point,
      tangent,
    };
  };
  const directImpulsePoints = (count = 61) => Array.from(
    { length: count },
    (_, index) => directImpulseLocalPointAtHalfPhase(
      THREE.MathUtils.lerp(
        palletReleaseHalfPhase,
        nextPalletLandingHalfPhase,
        index / (count - 1),
      ),
    ),
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.17,
    roughness: 0.50,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const palletMaterial = matte(PALETTE.accent, {
    metalness: 0.14,
    roughness: 0.43,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.42,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.68,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.38 });

  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role =
    'clockwise-fifteen-tooth-lever-chronometer-escape-wheel';
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role =
    'alternating-long-and-short-advance-escape-wheel-rotor';
  escapeWheel.add(wheelRotor);
  // Brown draws a solid web pierced by four rounded windows, leaving a
  // broad cross, rather than a thin rim on four wire spokes.
  // Brown's windows are pillow-shaped: each corner is well rounded, so the
  // web reads as four windows rather than a thin rim on a crossbar.
  const wheelArmHalfWidth = 0.24;
  const wheelWindowOuterRadius = wheelInnerRadius - 0.02;
  const wheelWindowPoints = filletedQuadrantWindow(
    wheelArmHalfWidth,
    wheelWindowOuterRadius,
    wheelWindowOuterRadius * 0.16,
    wheelWindowOuterRadius * 0.28,
  );
  const wheelWindows = [0, 1, 2, 3].map((quadrant) => {
    const angle = quadrant * FULL_TURN / 4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return poly(wheelWindowPoints.map(
      ([x, y]) => [x * cos - y * sin, x * sin + y * cos],
    ));
  });
  const webCircleSegments = 180;
  const wheelWeb = polygonClipping.difference(
    poly(circle([0, 0], wheelToothRootRadius, webCircleSegments)),
    poly(circle([0, 0], 0.34, 48)),
    ...wheelWindows,
  );
  const wheelRim = new THREE.Mesh(
    plate(wheelWeb, -wheelDepth / 2, wheelDepth / 2),
    driverMaterial,
  );
  wheelRim.userData.role = 'lever-chronometer-escape-wheel-rim';
  wheelRotor.add(wheelRim);
  // Brown's teeth are deep hooked ratchet teeth: the leading (clockwise)
  // face undercuts slightly behind the tip, and a straight back slopes the
  // whole pitch down to the next tooth's root. The tip stays on the
  // contact radius at the tooth's own angle. Each tooth stands on the web's
  // own root-circle vertices at the web's depth, so tooth and rim read as
  // one flush outline.
  const webStep = FULL_TURN / webCircleSegments;
  const rootVertex = (index) => [
    wheelToothRootRadius * Math.cos(index * webStep),
    wheelToothRootRadius * Math.sin(index * webStep),
  ];
  const pitchSteps = Math.round(toothPitch / webStep);
  const toothOutline = [
    rootVertex(1),
    [wheelToothTipRadius, 0],
    [
      (wheelToothTipRadius - 0.035) * Math.cos(0.022),
      (wheelToothTipRadius - 0.035) * Math.sin(0.022),
    ],
    ...Array.from({ length: pitchSteps }, (_, step) => (
      rootVertex(pitchSteps - step)
    )),
  ];
  const toothGeometry = plate(poly(toothOutline),
    -wheelDepth / 2, wheelDepth / 2);
  const wheelTeeth = [];
  for (let index = 0; index < toothCount; index += 1) {
    const tooth = new THREE.Mesh(toothGeometry, driverMaterial);
    tooth.rotation.z = index * toothPitch;
    tooth.userData.index = index;
    tooth.userData.role = 'pointed-lever-chronometer-escape-wheel-tooth';
    wheelTeeth.push(tooth);
    wheelRotor.add(tooth);
  }
  const wheelSpokes = [];
  const wheelHub = cylinderAlongZ(0.34, 0.76, darkMaterial, 36);
  wheelHub.userData.role = 'lever-chronometer-escape-wheel-hub';
  const wheelShaft = cylinderAlongZ(0.11, 1.45, darkMaterial, 30);
  wheelShaft.userData.role = 'fixed-lever-chronometer-escape-wheel-arbor';
  wheelRotor.add(wheelHub);
  escapeWheel.add(wheelShaft);
  const wheelIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 18, 14),
    indexMaterial,
  );
  wheelIndex.position.set(2.34, 0, 0.24);
  wheelIndex.userData.role = 'white-index-on-lever-chronometer-wheel';
  wheelRotor.add(wheelIndex);

  const palletLever = new THREE.Group();
  palletLever.position.set(leverPivot.x, leverPivot.y, 0);
  palletLever.userData.axis = Z_AXIS.clone();
  palletLever.userData.role =
    'single-pivoted-two-locking-pallet-lever-A-B-with-fork';
  const leverPivotHub = cylinderAlongZ(0.22, 0.72, darkMaterial, 32);
  leverPivotHub.position.z = leverPlaneZ;
  leverPivotHub.userData.role = 'lever-chronometer-pallet-lever-pivot';
  palletLever.add(leverPivotHub);

  const forkAxisLocal = leverToBalance.clone().normalize();
  const forkRootLocal = forkAxisLocal.clone().multiplyScalar(
    balanceToLeverDistance - balancePinOrbitRadius - 0.12,
  );
  const forkLever = beamBetween(
    new THREE.Vector3(0, 0, leverPlaneZ),
    new THREE.Vector3(forkRootLocal.x, forkRootLocal.y, leverPlaneZ),
    0.25,
    leverDepth,
    drivenMaterial,
  );
  forkLever.userData.role = 'locking-lever-arm-to-balance-roller-fork';
  palletLever.add(forkLever);

  const forkTines = [];
  const forkTineEdges = [];
  const forkTineProfiles = {};
  for (const side of [1, -1]) {
    const name = side > 0 ? 'acting-side' : 'return-side';
    const facePoints = forkTineFacePoints(side);
    const bodyPoints = facePoints.map((point, index) => {
      const halfPhase = THREE.MathUtils.lerp(
        pinEngagementHalfPhase,
        pinDisengagementHalfPhase,
        index / (facePoints.length - 1),
      );
      const center = pinCenterFrameAtHalfPhase(side, halfPhase).center;
      return point.clone().addScaledVector(
        point.clone().sub(center).normalize(),
        0.10,
      );
    });
    const tine = edgeTube(
      bodyPoints,
      leverPlaneZ,
      0.10,
      drivenMaterial,
      `${name}-fork-tine-driven-by-balance-pin`,
    );
    const edge = edgeTube(
      facePoints,
      leverPlaneZ + leverDepth / 2 + 0.025,
      0.027,
      indexMaterial,
      `${name}-working-face-of-locking-lever-fork`,
    );
    forkTines.push(tine);
    forkTineEdges.push(edge);
    forkTineProfiles[name] = facePoints.map((point) => point.clone());
    palletLever.add(tine, edge);
  }

  const palletBlocks = [];
  const palletLockEdges = [];
  const palletProfiles = {};
  for (const name of ['A', 'B']) {
    const points = palletLockPoints(name);
    const stripWidth = name === 'A' ? 0.31 : 0.37;
    const block = new THREE.Mesh(
      centeredExtrusion(
        profileStripShape(points, stripWidth),
        leverDepth,
        0.007,
      ),
      palletMaterial,
    );
    block.position.z = leverPlaneZ;
    block.userData.role =
      `locking-only-pallet-${name}-with-no-impulse-face`;
    const edge = edgeTube(
      points,
      leverPlaneZ - leverDepth / 2 + 0.018,
      0.034,
      indexMaterial,
      `working-lock-face-of-pallet-${name}-no-impulse`,
    );
    const centroid = points.reduce(
      (sum, point) => sum.add(point),
      new THREE.Vector2(),
    ).multiplyScalar(1 / points.length);
    const carrierEnd = centroid.clone().multiplyScalar(
      Math.max(centroid.length() - stripWidth * 0.45, 0.2)
        / centroid.length(),
    );
    // Brown hangs B on a crescent plate screwed across the lever below A,
    // not on a straight arm from the pivot; the crescent keeps the lever
    // plane in front of the teeth.
    const carrier = name === 'A'
      ? beamBetween(
        new THREE.Vector3(0, 0, leverPlaneZ),
        new THREE.Vector3(carrierEnd.x, carrierEnd.y, leverPlaneZ),
        0.29,
        leverDepth * 0.86,
        drivenMaterial,
      )
      : new THREE.Mesh(
        centeredExtrusion(
          crescentCarrierShape(centroid, forkAxisLocal.clone().negate()),
          leverDepth * 0.86,
          0.008,
        ),
        drivenMaterial,
      );
    if (name === 'B') carrier.position.z = leverPlaneZ;
    carrier.userData.role = `rigid-arm-from-lever-pivot-to-pallet-${name}`;
    palletProfiles[name] = points.map((point) => point.clone());
    palletBlocks.push(block);
    palletLockEdges.push(edge);
    palletLever.add(carrier, block, edge);
  }

  const tailAxis = forkAxisLocal.clone().multiplyScalar(-1);
  const tailNormal = new THREE.Vector2(-tailAxis.y, tailAxis.x);
  const tailLength = 5.25;
  const tailEndHalfWidth = 0.34;
  const tailShape = polygonShape([
    tailNormal.clone().multiplyScalar(0.15),
    tailAxis.clone().multiplyScalar(tailLength)
      .addScaledVector(tailNormal, tailEndHalfWidth),
    tailAxis.clone().multiplyScalar(tailLength)
      .addScaledVector(tailNormal, -tailEndHalfWidth),
    tailNormal.clone().multiplyScalar(-0.15),
  ]);
  const bankingTail = new THREE.Mesh(
    centeredExtrusion(tailShape, leverDepth * 0.82, 0.008),
    drivenMaterial,
  );
  bankingTail.position.z = leverPlaneZ;
  bankingTail.userData.role = 'long-lever-tail-between-fixed-banking-pins';
  palletLever.add(bankingTail);

  const balance = new THREE.Group();
  balance.position.set(balanceCenter.x, balanceCenter.y, 0);
  balance.userData.axis = Z_AXIS.clone();
  balance.userData.role =
    'balance-with-one-direct-impulse-pallet-C-and-one-fork-pin';
  const rollerDisk = new THREE.Mesh(
    centeredExtrusion(annularShape(0.49, 0.15), 0.20, 0.006),
    drivenMaterial,
  );
  rollerDisk.position.z = rollerPlaneZ;
  rollerDisk.userData.role = 'balance-roller-carrying-fork-pin-and-pallet-C';
  const balancePin = cylinderAlongZ(
    balancePinRadius,
    0.74,
    darkMaterial,
    24,
  );
  balancePin.position.set(
    Math.cos(balancePinMountAngle) * balancePinOrbitRadius,
    Math.sin(balancePinMountAngle) * balancePinOrbitRadius,
    0.39,
  );
  balancePin.userData.role =
    'single-balance-roller-pin-driving-locking-lever-both-ways';

  const directProfilePoints = directImpulsePoints();
  const directPalletC = new THREE.Mesh(
    centeredExtrusion(
      profileStripShape(directProfilePoints, 0.25),
      directPalletDepth,
      0.007,
    ),
    palletMaterial,
  );
  directPalletC.position.z = directPalletPlaneZ;
  directPalletC.userData.role =
    'single-balance-mounted-direct-impulse-pallet-C';
  const directPalletEdge = edgeTube(
    directProfilePoints,
    directPalletPlaneZ + directPalletDepth / 2 + 0.02,
    0.035,
    indexMaterial,
    'working-face-of-direct-impulse-pallet-C',
  );
  const directCentroid = directProfilePoints.reduce(
    (sum, point) => sum.add(point),
    new THREE.Vector2(),
  ).multiplyScalar(1 / directProfilePoints.length);
  const directCarrierEnd = directCentroid.clone().multiplyScalar(0.90);
  const directPalletCarrier = beamBetween(
    new THREE.Vector3(
      directCentroid.x / directCentroid.length() * 0.30,
      directCentroid.y / directCentroid.length() * 0.30,
      directPalletPlaneZ,
    ),
    new THREE.Vector3(
      directCarrierEnd.x,
      directCarrierEnd.y,
      directPalletPlaneZ,
    ),
    0.19,
    directPalletDepth * 0.82,
    palletMaterial,
  );
  directPalletCarrier.userData.role =
    'rigid-carrier-from-balance-staff-to-direct-pallet-C';
  const directCarrierPost = cylinderAlongZ(0.11, 0.55, palletMaterial, 24);
  directCarrierPost.position.set(
    directCentroid.x / directCentroid.length() * 0.43,
    directCentroid.y / directCentroid.length() * 0.43,
    0.31,
  );
  directCarrierPost.userData.role =
    'vertical-post-joining-low-pallet-C-to-balance-roller';

  const balanceStaff = cylinderAlongZ(0.115, 2.35, darkMaterial, 32);
  balanceStaff.position.z = 0.48;
  balanceStaff.userData.role = 'balance-staff-for-lever-chronometer';
  const balanceRimRadius = sourceRasterBalanceOuterRadius * sourceScale;
  // Brown draws the balance as a plain disk behind the lever, not a spoked
  // rim; its radius stops short of the lever arbor, which sits at its edge.
  const balanceDiskRadius = Math.min(
    balanceRimRadius,
    balanceToLeverDistance - 0.14,
  );
  const balanceDiskDepth = 0.10;
  const balanceDiskZ = -0.28;
  const balanceRim = cylinderAlongZ(
    balanceDiskRadius,
    balanceDiskDepth,
    drivenMaterial,
    96,
  );
  balanceRim.position.z = balanceDiskZ;
  balanceRim.userData.role = 'lever-chronometer-balance-wheel-rim';
  const balanceSpokes = [];
  const balanceIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 18, 14),
    indexMaterial,
  );
  balanceIndex.position.set(0, balanceRimRadius, balancePlaneZ + 0.10);
  balanceIndex.userData.role = 'white-index-on-lever-chronometer-balance';
  balance.add(
    rollerDisk,
    balancePin,
    directPalletCarrier,
    directCarrierPost,
    directPalletC,
    directPalletEdge,
    balanceStaff,
    balanceRim,
    balanceIndex,
  );

  const lockingContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.080, 18, 14),
    indexMaterial,
  );
  lockingContactMarker.userData.role =
    'white-marker-on-active-locking-only-pallet-contact';
  const directImpulseMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.086, 18, 14),
    indexMaterial,
  );
  directImpulseMarker.userData.role =
    'white-marker-on-direct-wheel-to-balance-impulse-C';
  const forkPinContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 18, 14),
    indexMaterial,
  );
  forkPinContactMarker.userData.role =
    'white-marker-on-balance-pin-to-locking-lever-contact';

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-three-arbor-lever-chronometer-frame';
  const framePlaneZ = -0.70;
  const wheelToLeverFrame = beamBetween(
    new THREE.Vector3(wheelCenter.x, wheelCenter.y, framePlaneZ),
    new THREE.Vector3(leverPivot.x, leverPivot.y, framePlaneZ),
    0.20,
    0.25,
    frameMaterial,
  );
  wheelToLeverFrame.userData.role = 'fixed-wheel-to-lever-frame-member';
  const leverToBalanceFrame = beamBetween(
    new THREE.Vector3(leverPivot.x, leverPivot.y, framePlaneZ),
    new THREE.Vector3(balanceCenter.x, balanceCenter.y, framePlaneZ),
    0.20,
    0.25,
    frameMaterial,
  );
  leverToBalanceFrame.userData.role = 'fixed-lever-to-balance-frame-member';
  const lowerFramePoint = sourcePointToModel(new THREE.Vector2(375, 500));
  const leverToBanksFrame = beamBetween(
    new THREE.Vector3(leverPivot.x, leverPivot.y, framePlaneZ),
    new THREE.Vector3(lowerFramePoint.x, lowerFramePoint.y, framePlaneZ),
    0.20,
    0.25,
    frameMaterial,
  );
  leverToBanksFrame.userData.role = 'fixed-frame-member-behind-banking-tail';
  const wheelBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.07, 10, 40),
    frameMaterial,
  );
  wheelBearing.position.set(wheelCenter.x, wheelCenter.y, framePlaneZ + 0.12);
  wheelBearing.userData.role = 'fixed-lever-chronometer-wheel-bearing';
  const leverBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.065, 10, 40),
    frameMaterial,
  );
  leverBearing.position.set(leverPivot.x, leverPivot.y, framePlaneZ + 0.12);
  leverBearing.userData.role = 'fixed-locking-lever-bearing';
  const balanceBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.33, 0.07, 10, 40),
    frameMaterial,
  );
  balanceBearing.position.set(
    balanceCenter.x,
    balanceCenter.y,
    framePlaneZ + 0.12,
  );
  balanceBearing.userData.role = 'fixed-lever-chronometer-balance-bearing';
  const bankingPinRadius = 0.10;
  const bankingContactPoints = {};
  const bankingPinCenters = {};
  const bankingPins = [-1, 1].map((sign) => {
    const name = sign < 0 ? 'left' : 'right';
    const bankAngle = sign * leverAmplitude;
    const localContact = tailAxis.clone().multiplyScalar(tailLength)
      .addScaledVector(tailNormal, sign * tailEndHalfWidth);
    const contact = leverPivot.clone().add(rotate2(localContact, bankAngle));
    const outward = rotate2(tailNormal, bankAngle).multiplyScalar(sign);
    const position = contact.clone().addScaledVector(
      outward,
      bankingPinRadius,
    );
    bankingContactPoints[name] = contact;
    bankingPinCenters[name] = position;
    // The pin runs from in front of the lever tail back into the banking
    // bridge on the frame plane.
    const pinFront = leverPlaneZ + 0.43;
    const pinBack = framePlaneZ;
    const pin = cylinderAlongZ(0.10, pinFront - pinBack, frameMaterial, 24);
    pin.position.set(position.x, position.y, (pinFront + pinBack) / 2);
    pin.userData.role = `fixed-${name}-banking-pin-for-locking-lever`;
    return pin;
  });
  // Brown draws only the two pin heads; they stand in a small bridge behind
  // the tail, carried by an arm from the lever's bearing (both hidden behind
  // the lever in the plate's view).
  const bankingBridge = beamBetween(
    new THREE.Vector3(bankingPinCenters.left.x, bankingPinCenters.left.y,
      framePlaneZ),
    new THREE.Vector3(bankingPinCenters.right.x, bankingPinCenters.right.y,
      framePlaneZ),
    0.20,
    0.20,
    frameMaterial,
  );
  bankingBridge.userData.role = 'fixed-banking-pin-bridge';
  const bankingMid = bankingPinCenters.left.clone()
    .add(bankingPinCenters.right).multiplyScalar(0.5);
  const bankingArmStart = leverPivot.clone().add(
    bankingMid.clone().sub(leverPivot).normalize().multiplyScalar(0.28),
  );
  const bankingArm = beamBetween(
    new THREE.Vector3(bankingArmStart.x, bankingArmStart.y, framePlaneZ),
    new THREE.Vector3(bankingMid.x, bankingMid.y, framePlaneZ),
    0.12,
    0.16,
    frameMaterial,
  );
  bankingArm.userData.role = 'fixed-banking-bridge-arm-from-lever-bearing';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(10.7, 0.24, 0.88),
    frameMaterial,
  );
  base.position.set(1.08, -4.72, framePlaneZ + 0.02);
  base.userData.role = 'fixed-lever-chronometer-frame-base';
  fixedFrame.add(
    wheelToLeverFrame,
    leverToBalanceFrame,
    leverToBanksFrame,
    wheelBearing,
    leverBearing,
    balanceBearing,
    ...bankingPins,
    bankingBridge,
    bankingArm,
    base,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(10.8, 10.5, 4.2),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(1.10, -0.12, 0.30);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-complete-lever-chronometer';

  root.add(
    cameraEnvelope,
    fixedFrame,
    escapeWheel,
    palletLever,
    balance,
    lockingContactMarker,
    directImpulseMarker,
    forkPinContactMarker,
  );

  const stateAtTime = (time) => {
    const { halfBeatIndex, halfPhase } = halfBeatAtTime(time);
    const side = sideForHalfBeat(halfBeatIndex);
    const acting = isActingHalfBeat(halfBeatIndex);
    const currentPallet = palletNameForSide(side);
    const nextPallet = palletNameForSide(-side);
    const balanceState = balanceStateAtHalfPhase(side, halfPhase);
    const leverState = leverStateAtHalfPhase(side, halfPhase);
    const wheelState = wheelAdvanceAtHalfPhase(acting, halfPhase);
    const wheelAngle = wheelAngleAtHalfPhase(halfBeatIndex, halfPhase);
    const beforeRelease = halfPhase < palletReleaseHalfPhase;
    const afterLanding = halfPhase >= nextPalletLandingHalfPhase;
    const lockingContactActive = beforeRelease || afterLanding;
    const directImpulseActive = acting
      && !beforeRelease
      && !afterLanding;
    const shortTransferActive = !acting
      && !beforeRelease
      && !afterLanding;
    const forkPinContactActive = halfPhase >= pinEngagementHalfPhase
      && halfPhase <= pinDisengagementHalfPhase;
    const currentToothIndex = currentLockToothIndex(halfBeatIndex);
    const nextToothIndex = currentLockToothIndex(halfBeatIndex + 1);
    const lockingPallet = afterLanding ? nextPallet : currentPallet;
    const lockingToothIndex = afterLanding
      ? nextToothIndex
      : currentToothIndex;
    const lockingToothPoint = toothTipPoint(
      wheelAngle,
      lockingToothIndex,
    );
    const balancePinCenter = balancePinCenterAtHalfPhase(side, halfPhase);

    let stage;
    if (beforeRelease && halfPhase < pinEngagementHalfPhase) {
      stage = `${currentPallet}-locked-balance-detached`;
    } else if (beforeRelease) {
      stage = `balance-pin-unlocking-${currentPallet}`;
    } else if (directImpulseActive) {
      stage = 'direct-wheel-to-balance-impulse-at-C-A-to-B';
    } else if (shortTransferActive) {
      stage = 'short-unpowered-wheel-transfer-B-to-A';
    } else if (forkPinContactActive) {
      stage = `${nextPallet}-locks-as-balance-pin-leaves-fork`;
    } else {
      stage = `${nextPallet}-locked-balance-detached`;
    }

    let lockingContact = null;
    if (lockingContactActive) {
      const profileHalfPhase = beforeRelease
        ? Math.max(halfPhase, pinEngagementHalfPhase)
        : pinEngagementHalfPhase;
      const frame = palletLockFrame(lockingPallet, profileHalfPhase);
      const expectedPoint = leverPivot.clone().add(
        rotate2(frame.point, leverState.angle),
      );
      const faceTangent = rotate2(frame.tangent, leverState.angle);
      const faceNormal = rotate2(frame.normal, leverState.angle);
      const toothVelocity = crossZ(
        lockingToothPoint.clone().sub(wheelCenter),
      ).multiplyScalar(wheelState.angularSpeed);
      const palletVelocity = crossZ(
        expectedPoint.clone().sub(leverPivot),
      ).multiplyScalar(leverState.angularSpeed);
      const relativeVelocity = toothVelocity.clone().sub(palletVelocity);
      lockingContact = {
        expectedPoint,
        faceNormal,
        faceTangent,
        localPoint: frame.point,
        mode: 'locking-only-no-impulse',
        normalVelocityError: relativeVelocity.dot(faceNormal),
        pallet: lockingPallet,
        palletVelocity,
        pointError: lockingToothPoint.distanceTo(expectedPoint),
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
        toothIndex: lockingToothIndex,
        toothVelocity,
      };
    }

    let directImpulseContact = null;
    let impulseToothIndex = null;
    let impulseToothPoint = null;
    if (directImpulseActive) {
      impulseToothIndex = directImpulseToothIndex(halfBeatIndex);
      impulseToothPoint = toothTipPoint(wheelAngle, impulseToothIndex);
      const frame = directImpulseFrame(halfPhase);
      const expectedPoint = balanceCenter.clone().add(
        rotate2(frame.point, balanceState.angle),
      );
      const faceTangent = rotate2(frame.tangent, balanceState.angle);
      const faceNormal = rotate2(frame.normal, balanceState.angle);
      const toothVelocity = crossZ(
        impulseToothPoint.clone().sub(wheelCenter),
      ).multiplyScalar(wheelState.angularSpeed);
      const palletVelocity = crossZ(
        expectedPoint.clone().sub(balanceCenter),
      ).multiplyScalar(balanceState.angularSpeed);
      const relativeVelocity = toothVelocity.clone().sub(palletVelocity);
      directImpulseContact = {
        expectedPoint,
        faceNormal,
        faceTangent,
        localPoint: frame.point,
        mode: 'escape-tooth-directly-impulses-balance-pallet-C',
        normalVelocityError: relativeVelocity.dot(faceNormal),
        palletVelocity,
        pointError: impulseToothPoint.distanceTo(expectedPoint),
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
        toothIndex: impulseToothIndex,
        toothVelocity,
      };
    }

    let forkPinContact = null;
    if (forkPinContactActive) {
      const frame = forkTineFaceFrame(side, halfPhase);
      const expectedPoint = leverPivot.clone().add(
        rotate2(frame.point, leverState.angle),
      );
      const faceTangent = rotate2(frame.faceTangent, leverState.angle);
      const faceNormal = rotate2(frame.faceNormal, leverState.angle);
      const surfaceOffset = rotate2(
        frame.point.clone().sub(frame.center),
        leverState.angle,
      );
      const pinSurfacePoint = balancePinCenter.clone().add(surfaceOffset);
      const pinVelocity = crossZ(
        pinSurfacePoint.clone().sub(balanceCenter),
      ).multiplyScalar(balanceState.angularSpeed);
      const leverVelocity = crossZ(
        expectedPoint.clone().sub(leverPivot),
      ).multiplyScalar(leverState.angularSpeed);
      const relativeVelocity = pinVelocity.clone().sub(leverVelocity);
      let mode = `balance-pin-drives-lever-unlocking-${currentPallet}`;
      if (directImpulseActive) {
        mode = 'balance-pin-completes-lever-throw-during-direct-impulse';
      } else if (shortTransferActive) {
        mode = 'balance-pin-completes-lever-throw-during-short-transfer';
      }
      forkPinContact = {
        expectedPoint,
        faceNormal,
        faceTangent,
        leverVelocity,
        localPoint: frame.point,
        mode,
        normalVelocityError: relativeVelocity.dot(faceNormal),
        pinRadiusError: balancePinCenter.distanceTo(pinSurfacePoint)
          - balancePinRadius,
        pinSurfacePoint,
        pinVelocity,
        pointError: pinSurfacePoint.distanceTo(expectedPoint),
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
        tine: side > 0 ? 'acting-side' : 'return-side',
      };
    }

    return {
      actingHalfBeat: acting,
      balanceAngle: balanceState.angle,
      balanceAngularAcceleration: balanceState.angularAcceleration,
      balanceAngularSpeed: balanceState.angularSpeed,
      balanceDetached: !forkPinContactActive,
      balancePinCenter,
      currentLockToothIndex: currentToothIndex,
      currentPallet,
      directImpulseActive,
      directImpulseContact,
      forkPinContact,
      forkPinContactActive,
      halfBeatIndex,
      halfPhase,
      impulseToothIndex,
      impulseToothPoint,
      leverAngle: leverState.angle,
      leverAngularAcceleration: leverState.angularAcceleration,
      leverAngularSpeed: leverState.angularSpeed,
      lockingContact,
      lockingContactActive,
      lockingPallet,
      lockingToothIndex,
      lockingToothPoint,
      nextLockToothIndex: nextToothIndex,
      nextPallet,
      shortTransferActive,
      side,
      stage,
      wheelAdvance: wheelState.advance,
      wheelAngle,
      wheelAngularAcceleration: wheelState.angularAcceleration,
      wheelAngularSpeed: wheelState.angularSpeed,
      wheelEvent: wheelState.event,
      wheelEventProgress: wheelState.progress,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * balancePeriod,
  );
  const canonicalTimes = {
    aLocked: 0.10 * halfBeatDuration,
    aUnlockEntry: pinEngagementHalfPhase * halfBeatDuration,
    directImpulseStart: palletReleaseHalfPhase * halfBeatDuration,
    directImpulseMid: (
      palletReleaseHalfPhase + nextPalletLandingHalfPhase
    ) * halfBeatDuration / 2,
    bLanding: nextPalletLandingHalfPhase * halfBeatDuration,
    bLocked: halfBeatDuration + 0.10 * halfBeatDuration,
    bUnlockEntry: halfBeatDuration
      + pinEngagementHalfPhase * halfBeatDuration,
    shortTransferMid: halfBeatDuration + (
      palletReleaseHalfPhase + nextPalletLandingHalfPhase
    ) * halfBeatDuration / 2,
    aRelock: halfBeatDuration
      + nextPalletLandingHalfPhase * halfBeatDuration,
    cycleClosure: balancePeriod,
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
    palletLever.rotation.z = state.leverAngle;
    palletLever.userData.angularAcceleration = state.leverAngularAcceleration;
    palletLever.userData.angularSpeed = state.leverAngularSpeed;
    wheelRotor.rotation.z = state.wheelAngle;
    wheelRotor.userData.angularAcceleration = state.wheelAngularAcceleration;
    wheelRotor.userData.angularSpeed = state.wheelAngularSpeed;
    lockingContactMarker.visible = state.lockingContactActive;
    directImpulseMarker.visible = state.directImpulseActive;
    forkPinContactMarker.visible = state.forkPinContactActive;
    if (state.lockingContactActive) {
      lockingContactMarker.position.set(
        state.lockingContact.expectedPoint.x,
        state.lockingContact.expectedPoint.y,
        leverPlaneZ + leverDepth / 2 + 0.14,
      );
    }
    if (state.directImpulseActive) {
      directImpulseMarker.position.set(
        state.directImpulseContact.expectedPoint.x,
        state.directImpulseContact.expectedPoint.y,
        directPalletPlaneZ + directPalletDepth / 2 + 0.15,
      );
    }
    if (state.forkPinContactActive) {
      forkPinContactMarker.position.set(
        state.forkPinContact.expectedPoint.x,
        state.forkPinContact.expectedPoint.y,
        leverPlaneZ + leverDepth / 2 + 0.16,
      );
    }
    root.userData.contacts = {
      directImpulseC: state.directImpulseActive
        ? {
          mode: state.directImpulseContact.mode,
          normalVelocityError:
            state.directImpulseContact.normalVelocityError,
          pointError: state.directImpulseContact.pointError,
          toothIndex: state.directImpulseContact.toothIndex,
        }
        : null,
      forkPin: state.forkPinContactActive
        ? {
          mode: state.forkPinContact.mode,
          normalVelocityError: state.forkPinContact.normalVelocityError,
          pinRadiusError: state.forkPinContact.pinRadiusError,
          pointError: state.forkPinContact.pointError,
          tine: state.forkPinContact.tine,
        }
        : null,
      lockingPallet: state.lockingContactActive
        ? {
          mode: state.lockingContact.mode,
          normalVelocityError: state.lockingContact.normalVelocityError,
          pallet: state.lockingContact.pallet,
          pointError: state.lockingContact.pointError,
          toothIndex: state.lockingContact.toothIndex,
        }
        : null,
    };
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    'fifteen-tooth-single-impulse-lever-chronometer-alternating-long-short-lock-transfer-escapement';
  root.userData.mechanism =
    'one 15-tooth clockwise escape wheel is alternately locked by lever pallets A and B, which have no impulse faces; on the A-to-B vibration a separate tooth directly impulses the sole balance-mounted pallet C while the tooth between A and B reaches B, and on the return vibration B unlocks for only a short unpowered transfer back to A';
  root.userData.transmission = {
    balanceImpulseCountPerOscillation: 1,
    balanceIsDetachedOutsideForkWindow: true,
    balanceMountedImpulsePalletCount: 1,
    directImpulseToothOffset,
    direction: 'escape wheel advances clockwise in one long acting movement and one short return movement',
    leverPalletCount: 2,
    leverPalletImpulseFaceCount: 0,
    longImpulseAdvance,
    oscillationAdvance: toothPitch,
    shortReturnAdvance,
    toothCount,
    wheelReleasesPerOscillation: 2,
  };
  root.userData.blocks = {
    balance,
    balanceBearing,
    balanceIndex,
    balancePin,
    balanceRim,
    balanceSpokes,
    balanceStaff,
    bankingArm,
    bankingBridge,
    bankingPins,
    bankingTail,
    base,
    cameraEnvelope,
    directCarrierPost,
    directImpulseMarker,
    directPalletC,
    directPalletCarrier,
    directPalletEdge,
    escapeWheel,
    fixedFrame,
    forkLever,
    forkPinContactMarker,
    forkTineEdges,
    forkTines,
    leverBearing,
    leverPivotHub,
    leverToBalanceFrame,
    leverToBanksFrame,
    lockingContactMarker,
    palletBlocks,
    palletLever,
    palletLockEdges,
    rollerDisk,
    wheelBearing,
    wheelHub,
    wheelIndex,
    wheelRim,
    wheelRotor,
    wheelShaft,
    wheelSpokes,
    wheelTeeth,
    wheelToLeverFrame,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.directImpulseFrame = directImpulseFrame;
  root.userData.directImpulsePoints = directImpulsePoints;
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
    balancePlaneZ,
    balanceRimRadius,
    balanceToLeverDistance,
    bankingContactPoints,
    bankingPinCenters,
    bankingPinRadius,
    directImpulseStartAngle,
    directPalletDepth,
    directPalletPlaneZ,
    halfBeatDuration,
    leverAmplitude,
    leverDepth,
    leverPivot: leverPivot.clone(),
    leverPlaneZ,
    longImpulseAdvance,
    nextPalletLandingHalfPhase,
    palletAReferenceAngle,
    palletBReferenceAngle,
    palletReleaseHalfPhase,
    pinDisengagementHalfPhase,
    pinEngagementHalfPhase,
    rollerPlaneZ,
    shortReturnAdvance,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    statedLeverDetachAngle,
    tailEndHalfWidth,
    tailLength,
    toothCount,
    toothPitch,
    wheelBaseAngle,
    wheelCenter: wheelCenter.clone(),
    wheelDepth,
    wheelInnerRadius,
    wheelToothRootRadius,
    wheelToothTipRadius,
  };
  root.userData.palletLockFrame = palletLockFrame;
  root.userData.palletLockPoints = palletLockPoints;
  root.userData.palletProfiles = palletProfiles;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'Brown supplies the static 15-tooth wheel, balance-mounted pallet C, two-pallet lever A-B, roller pin, banking pins, and a concise distinction from movement 296. Grimthorpe fig. 77 supplies the exact A-to-B direct-impulse and B-to-A short-transfer sequence; exact historic lift and drop angles are not dimensioned.',
    sourceUrl: 'https://507movements.com/mm_314.html',
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    brownPlate314: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one 15-tooth escape wheel, one pivoted forked lever carrying two locking-only pallets A and B, one roller pin, one direct impulse pallet C rigid with the balance, and two fixed banking pins',
      measurementUncertaintyPixels: 12,
      rasterBalanceCenter: sourceRasterBalanceCenter.clone(),
      rasterBalanceOuterRadius: sourceRasterBalanceOuterRadius,
      rasterBalancePin: sourceRasterBalancePin.clone(),
      rasterImpulseStartC: sourceRasterImpulseStartC.clone(),
      rasterLeftBank: sourceRasterLeftBank.clone(),
      rasterLeverPivot: sourceRasterLeverPivot.clone(),
      rasterPalletA: sourceRasterPalletA.clone(),
      rasterPalletBFreeTip: sourceRasterPalletBFreeTip.clone(),
      rasterRightBank: sourceRasterRightBank.clone(),
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
      rasterWheelOuterRadius: sourceRasterWheelOuterRadius,
      visibleWheelToothCount: toothCount,
    },
    grimthorpeFigure77: {
      author: 'Edmund Beckett, Lord Grimthorpe',
      description: 'A unlocks as direct impulse begins at C; the intervening tooth lands on B at the end of impulse; the return unlocks B for a very short non-impulse movement back to A.',
      edition: 8,
      figure: 77,
      page: 234,
      publicationYear: 1903,
      source: 'A Rudimentary Treatise on Clocks, Watches, & Bells',
      url: 'https://www.gutenberg.org/ebooks/17576',
    },
    historicalExample: {
      description: 'Oscar T. Lang illustrates the same lever-chronometer, also known as the union chronometer, in Loveday, Wakefield No. 1356.',
      publication: 'Horological Institute of America, The Horologist’s Loupe',
      publicationYear: 1959,
      url: 'https://www.awci.com/wp-content/uploads/2018/02/1959-01-HIA.pdf',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: balancePeriod,
    schedule: [
      'A-locks-while-balance-is-detached',
      'balance-pin-enters-fork-and-unlocks-A',
      'escape-tooth-directly-impulses-balance-pallet-C',
      'intervening-tooth-lands-on-B-as-direct-impulse-ends',
      'balance-returns-and-pin-unlocks-B',
      'wheel-makes-short-unpowered-transfer-from-B-to-A',
      'A-relocks-and-balance-detaches',
    ],
  };
  root.userData.toothTipPoint = toothTipPoint;
  root.userData.wheelAngleAtHalfLanding = wheelAngleAtHalfLanding;
  root.userData.wheelAdvanceAtHalfPhase = wheelAdvanceAtHalfPhase;

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
    directImpulseMarker,
    forkPinContactMarker,
    lockingContactMarker,
    wheelIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';
  correctDetachedChronometer(root, 314, update);
  const palletNibs = [];
  root.userData.blocks.palletNibs = palletNibs;
  {
    // The lever pivot sits on pallet C's orbit, so its hub and arbor are kept
    // in front of C's layer and the arbor runs forward to a front journal
    // (Brown shows only the arbor end at the top of A).
    const { arbor } = root.userData.detachedChronometerParts;
    const tube = (outer, inner, length) => boredLatheGeometry([
      { radial: outer, axial: -length / 2 },
      { radial: outer, axial: length / 2 },
    ], inner, 64);
    const hubBack = 0.12;
    const hubFront = leverPlaneZ + 0.36;
    leverPivotHub.geometry.dispose();
    leverPivotHub.geometry = tube(0.22, 0.126, hubFront - hubBack);
    leverPivotHub.position.z = (hubBack + hubFront) / 2;
    const arborFront = 1.00;
    arbor.geometry.dispose();
    arbor.geometry = new THREE.CylinderGeometry(0.12, 0.12,
      arborFront - hubBack, 48);
    arbor.position.z = (hubBack + arborFront) / 2;
    leverBearing.position.z = arborFront - 0.10;
    // The lever's front journal is carried by a flat L-shaped cock that runs
    // out to the right, clear of the swinging tail, and down to the right
    // banking pin, whose head it is screwed to; the pins stand in the bridge
    // behind the tail. This replaces the loose rear post that stopped short
    // of the lever pivot.
    {
      const cockZ = leverBearing.position.z;
      const rightPin = bankingPins[1];
      const pinCenter = bankingPinCenters.right;
      const pinBack = framePlaneZ;
      const pinFront = cockZ + 0.06;
      rightPin.geometry.dispose();
      rightPin.geometry = new THREE.CylinderGeometry(0.10, 0.10, pinFront - pinBack, 24);
      rightPin.position.z = (pinFront + pinBack) / 2;
      const cockX = pinCenter.x + 0.48;
      const corners = [
        new THREE.Vector3(leverPivot.x + 0.22, leverPivot.y, cockZ),
        new THREE.Vector3(cockX, leverPivot.y, cockZ),
        new THREE.Vector3(cockX, pinCenter.y, cockZ),
        new THREE.Vector3(pinCenter.x, pinCenter.y, cockZ),
      ];
      const cockParts = [];
      for (let i = 0; i < 3; i++) {
        const a = corners[i].clone(), c = corners[i + 1].clone();
        const d = c.clone().sub(a).normalize().multiplyScalar(0.11);
        if (i > 0) a.sub(d);
        if (i < 2) c.add(d);
        const part = beamBetween(a, c, 0.22, 0.12, frameMaterial);
        part.userData.role = 'fixed-front-cock-carrying-lever-journal';
        cockParts.push(part);
      }
      bankingArm.removeFromParent();
      bankingArm.geometry.dispose();
      fixedFrame.add(...cockParts);
      root.userData.blocks.leverCock = cockParts;
      delete root.userData.blocks.bankingArm;
    }
    // Locking nibs: the part of each pallet strip that stays outside radius
    // (tip - 0.28) from the wheel axis at both lever banks, extruded back into
    // the wheel plane; the rest of each long curved pallet stays in front.
    // B's strip swings deep inside the wheel while A locks, so B gets no nib
    // and its lock is shown in front of the teeth only.
    palletNibs.length = 0;
    const bankTimes = [0, balancePeriod * 0.5];
    for (const [index, name] of ['A', 'B'].entries()) {
      const stripWidth = name === 'A' ? 0.31 : 0.37;
      const points = palletProfiles[name];
      const inner = points.map((point) => point.clone().multiplyScalar(
        Math.max(point.length() - stripWidth, 0.08) / point.length()));
      let nibShape = poly([...points, ...inner.reverse()]
        .map((v) => v.toArray()));
      for (const time of bankTimes) {
        update(time);
        const axis = rotate2(wheelCenter.clone().sub(leverPivot),
          -palletLever.rotation.z);
        nibShape = polygonClipping.difference(nibShape,
          poly(circle(axis.toArray(), wheelToothTipRadius - 0.28, 256)));
      }
      if (!nibShape.length) continue;
      const nib = new THREE.Mesh(plate(nibShape, -0.02, 0.20),
        palletBlocks[index].material);
      nib.userData.role = `locking-nib-of-pallet-${name}-in-wheel-plane`;
      palletLever.add(nib);
      palletNibs.push(nib);
    }
    // Pallet C's strip followed only the tooth-tip path, so the leading flank
    // of the impulsing tooth swept up to 0.08 into it, and the returning
    // tooth grazed A's nib before landing.  Cut both by the swept outline of
    // every tooth plus 0.0015 running clearance, sampled over a full
    // oscillation (the wheel repeats after one pitch) and densely over the
    // impulse.  The tips still slide along and lock on the retained faces,
    // just clear of them.
    {
      // Convex hull of the actual bevelled tooth mesh (its mitred tip
      // reaches beyond the nominal outline plus the bevel size).
      const toothPoints = [];
      const positions = wheelTeeth[0].geometry.attributes.position;
      for (let i = 0; i < positions.count; i += 1) {
        toothPoints.push(new THREE.Vector2(positions.getX(i), positions.getY(i)));
      }
      toothPoints.sort((a, b) => a.x - b.x || a.y - b.y);
      const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y)
        - (a.y - o.y) * (b.x - o.x);
      const half = (points) => points.reduce((hull, point) => {
        while (hull.length >= 2
          && cross(hull.at(-2), hull.at(-1), point) <= 0) hull.pop();
        hull.push(point);
        return hull;
      }, []);
      const lower = half(toothPoints);
      const upper = half([...toothPoints].reverse());
      const outline = [...lower.slice(0, -1), ...upper.slice(0, -1)];
      const grow = 0.0015;
      // Mitred outward offset of the counterclockwise hull (a superset of
      // the grown tooth).
      const grown = outline.map((point, index) => {
        const previous = outline[(index + outline.length - 1) % outline.length];
        const next = outline[(index + 1) % outline.length];
        const n1 = new THREE.Vector2(point.y - previous.y, previous.x - point.x)
          .normalize();
        const n2 = new THREE.Vector2(next.y - point.y, point.x - next.x)
          .normalize();
        const bisector = n1.clone().add(n2).normalize();
        return point.clone().addScaledVector(
          bisector,
          grow / Math.max(bisector.dot(n1), 0.2),
        );
      });
      const times = [
        ...Array.from({ length: 361 }, (_, i) => balancePeriod * i / 360),
        ...[0, 1].flatMap((halfBeat) => Array.from({ length: 401 },
          (_, i) => halfBeatDuration * (halfBeat + palletReleaseHalfPhase
            + (nextPalletLandingHalfPhase - palletReleaseHalfPhase) * i / 400))),
      ];
      const toLocal = new THREE.Matrix4();
      const matrix = new THREE.Matrix4();
      const point = new THREE.Vector3();
      const toothBox = new THREE.Box2();
      const cutBySweptTeeth = (mesh, shapePolygons) => {
        const box = new THREE.Box2();
        for (const polygon of shapePolygons) {
          for (const [x, y] of polygon[0]) box.expandByPoint(new THREE.Vector2(x, y));
        }
        let cut = shapePolygons;
        for (const time of times) {
          update(time);
          root.updateMatrixWorld(true);
          toLocal.copy(mesh.matrixWorld).invert();
          for (const tooth of wheelTeeth) {
            matrix.multiplyMatrices(toLocal, tooth.matrixWorld);
            toothBox.makeEmpty();
            const ring = grown.map(({ x, y }) => {
              point.set(x, y, 0).applyMatrix4(matrix);
              const q = [
                Math.round(point.x * 1e6) / 1e6,
                Math.round(point.y * 1e6) / 1e6,
              ];
              toothBox.expandByPoint(new THREE.Vector2(q[0], q[1]));
              return q;
            });
            if (!toothBox.intersectsBox(box)) continue;
            cut = polygonClipping.difference(cut, poly(ring));
          }
        }
        return cut;
      };
      const cShape = profileStripShape(directProfilePoints, 0.25);
      const cCut = cutBySweptTeeth(
        directPalletC,
        poly(cShape.getPoints().map((v) => v.toArray())),
      );
      directPalletC.geometry.dispose();
      directPalletC.geometry = plate(
        cCut,
        -directPalletDepth / 2,
        directPalletDepth / 2,
      );
      for (const nib of palletNibs) {
        const nibCut = cutBySweptTeeth(nib, nib.geometry.userData.plate.polygons);
        nib.geometry.dispose();
        nib.geometry = plate(nibCut, -0.02, 0.20);
      }
    }
    update(0);
    arbor.userData.role = 'locking-lever-arbor-through-front-journal';
    root.updateMatrixWorld(true);
    leverBearing.geometry.computeBoundingBox();
    root.userData.cameraFitBounds.union(
      leverBearing.geometry.boundingBox.clone()
        .applyMatrix4(leverBearing.matrixWorld)
        .expandByScalar(0.15),
    );
    for (const part of root.userData.blocks.leverCock ?? []) {
      root.userData.cameraFitBounds.union(
        new THREE.Box3().setFromObject(part).expandByScalar(0.1));
    }
  }
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredLeverChronometerMovement(movement) {
  if (movement.id !== 314) return null;
  return leverChronometerEscapement(movement);
}
