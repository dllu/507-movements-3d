import { correctFreeEscapement, fitFreeEscapement } from './free-escapement-finite-parts.js';
import * as THREE from 'three';
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

function smoothStep01(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function smootherStep01(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped ** 3 * (
    clamped * (clamped * 6 - 15) + 10
  );
}

function quinticBoundaryState({
  coordinate,
  endAcceleration,
  endRate,
  endValue,
  span,
  startAcceleration,
  startRate,
  startValue,
}) {
  const u = THREE.MathUtils.clamp(coordinate, 0, 1);
  const a0 = startValue;
  const a1 = startRate * span;
  const a2 = startAcceleration * span ** 2 / 2;
  const residualValue = endValue - a0 - a1 - a2;
  const residualRate = endRate * span - a1 - 2 * a2;
  const residualAcceleration = endAcceleration * span ** 2 - 2 * a2;
  const a3 = 10 * residualValue - 4 * residualRate
    + residualAcceleration / 2;
  const a4 = -15 * residualValue + 7 * residualRate
    - residualAcceleration;
  const a5 = 6 * residualValue - 3 * residualRate
    + residualAcceleration / 2;
  return {
    phaseAcceleration: (
      2 * a2
      + 6 * a3 * u
      + 12 * a4 * u ** 2
      + 20 * a5 * u ** 3
    ) / span ** 2,
    phaseRate: (
      a1
      + 2 * a2 * u
      + 3 * a3 * u ** 2
      + 4 * a4 * u ** 3
      + 5 * a5 * u ** 4
    ) / span,
    value: a0 + a1 * u + a2 * u ** 2 + a3 * u ** 3
      + a4 * u ** 4 + a5 * u ** 5,
  };
}

function cosineBump(phase, center, halfWidth) {
  const distance = Math.abs(phase - center);
  if (distance >= halfWidth) return 0;
  return 0.5 * (1 + Math.cos(Math.PI * distance / halfWidth));
}

function cyclicCosineBump(phase, center, halfWidth) {
  const rawDistance = Math.abs(phase - center);
  const distance = Math.min(rawDistance, 1 - rawDistance);
  if (distance >= halfWidth) return 0;
  return 0.5 * (1 + Math.cos(Math.PI * distance / halfWidth));
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

function createSegmentedLeaf({
  count,
  depth,
  material,
  role,
  width,
}) {
  const root = new THREE.Group();
  root.userData.role = role;
  const segments = Array.from({ length: count }, (_, index) => {
    const segment = new THREE.Mesh(
      new THREE.BoxGeometry(1, width, depth),
      material,
    );
    segment.userData.role = `${role}-segment-${index + 1}`;
    root.add(segment);
    return segment;
  });
  root.userData.segments = segments;
  return root;
}

function updateSegmentedLeaf(leaf, points) {
  const { segments } = leaf.userData;
  for (let index = 0; index < segments.length; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const direction = end.clone().sub(start);
    const segment = segments[index];
    segment.position.copy(start).add(end).multiplyScalar(0.5);
    segment.rotation.z = Math.atan2(direction.y, direction.x);
    segment.scale.x = direction.length();
  }
}

function makeImpulsePallet(facePoints, depth) {
  const innerPoints = facePoints.map((point) => point.clone()
    .addScaledVector(point.clone().normalize(), -0.22));
  const body = new THREE.Mesh(
    centeredExtrusion(polygonShape([
      ...facePoints,
      ...innerPoints.reverse(),
    ]), depth, 0.006),
    matte(PALETTE.accent, { metalness: 0.18, roughness: 0.48 }),
  );
  body.userData.role = 'balance-impulse-notch-g-solid';
  const curve = new THREE.CatmullRomCurve3(
    facePoints.map((point) => new THREE.Vector3(
      point.x,
      point.y,
      depth / 2 + 0.014,
    )),
    false,
    'centripetal',
  );
  const workingEdge = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 56, 0.048, 8, false),
    matte(PALETTE.white, { metalness: 0.12, roughness: 0.42 }),
  );
  workingEdge.userData.role = 'visible-working-side-of-impulse-notch-g';
  const root = new THREE.Group();
  root.userData.role = 'balance-carried-impulse-notch-g';
  root.add(body, workingEdge);
  root.userData.body = body;
  root.userData.facePoints = facePoints;
  root.userData.workingEdge = workingEdge;
  return root;
}

function arnoldFreeEscapement(movement) {
  const root = new THREE.Group();

  // Brown's plate and description explicitly separate the flexible passing
  // spring from detent A. Stud a depresses the passing spring harmlessly on
  // the outward balance pass; only the return pass engages hook k, raises A
  // and stop d, releases one tooth, and lets another tooth impulse notch g.
  // The official page exposes no canvas animation, so the event durations are
  // independently reconstructed while preserving that one-way topology.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.018;
  const sourceRasterOrigin = new THREE.Vector2(260, 280);
  const sourceRasterBalanceCenterA = new THREE.Vector2(82, 180);
  const sourceRasterBalanceRadius = 56;
  const sourceRasterEscapeWheelCenterB = new THREE.Vector2(146, 331);
  const sourceRasterEscapeWheelTipRadius = 122;
  const sourceRasterFixedSpringScrewB = new THREE.Vector2(466, 201);
  const sourceRasterMainSpringFreeEnd = new THREE.Vector2(137, 201);
  const sourceRasterPassingSpringStudI = new THREE.Vector2(327, 174);
  const sourceRasterHookK = new THREE.Vector2(143, 183);
  const sourceRasterDetentStopD = new THREE.Vector2(193, 213);
  const sourceRasterImpulseNotchG = new THREE.Vector2(101, 236);
  const sourceRasterDirectionArrow = new THREE.Vector2(58, 128);
  const sourceCountedToothCount = 12;
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterOrigin.x) * sourceScale,
    (sourceRasterOrigin.y - y) * sourceScale,
  );
  const balanceCenter = sourcePointToModel(sourceRasterBalanceCenterA);
  const escapeWheelCenter = sourcePointToModel(
    sourceRasterEscapeWheelCenterB,
  );
  const fixedSpringAnchor = sourcePointToModel(
    sourceRasterFixedSpringScrewB,
  );
  const mainSpringFreeBase = sourcePointToModel(
    sourceRasterMainSpringFreeEnd,
  );
  const passingSpringAnchorBase = sourcePointToModel(
    sourceRasterPassingSpringStudI,
  );
  const hookBase = sourcePointToModel(sourceRasterHookK);

  const toothCount = sourceCountedToothCount;
  const toothPitch = FULL_TURN / toothCount;
  const toothLeanAngle = toothPitch * 0.38;
  const wheelRootRadius = 1.72;
  const wheelCrownRadius = 1.96;
  const toothTipRadius = sourceRasterEscapeWheelTipRadius * sourceScale;
  const wheelDepth = 0.38;
  const balanceRadius = sourceRasterBalanceRadius * sourceScale;
  const balanceDepth = 0.40;
  const balanceRimGapStart = THREE.MathUtils.degToRad(-105);
  const balanceRimGapEnd = THREE.MathUtils.degToRad(-30);
  const balanceRimArcStart = balanceRimGapEnd;
  const balanceRimArc = FULL_TURN
    - (balanceRimGapEnd - balanceRimGapStart);
  const balancePeriod = 4;
  const balanceAmplitude = THREE.MathUtils.degToRad(35);

  const hookStartPhase = 0.40;
  const releaseStartPhase = 0.435;
  const impulseStartPhase = 0.478;
  const detentFallStartPhase = 0.535;
  const impulseEndPhase = 0.548;
  const relockPhase = 0.560;
  const hookEndPhase = 0.585;
  const stepPhaseDuration = relockPhase - releaseStartPhase;
  const maximumDetentLift = 0.38;
  const outwardPassingHalfWidth = 0.055;
  const returnPassingHalfWidth = 0.085;
  const impulseContactReferenceAngle = THREE.MathUtils.degToRad(118);

  const balanceAngleAtPhase = (phase) => -balanceAmplitude
    * Math.sin(FULL_TURN * phase);
  const balanceAngularSpeedAtPhase = (phase) => -balanceAmplitude
    * FULL_TURN * Math.cos(FULL_TURN * phase) / balancePeriod;
  const balanceAngularAccelerationAtPhase = (phase) => balanceAmplitude
    * FULL_TURN ** 2 * Math.sin(FULL_TURN * phase)
    / balancePeriod ** 2;
  const rawStepCoordinateAtPhase = (phase) => (
    (phase - releaseStartPhase) / stepPhaseDuration
  );
  const wheelStepProgressAtPhase = (phase) => {
    if (phase <= releaseStartPhase) return 0;
    if (phase >= relockPhase) return 1;
    return smoothStep01(rawStepCoordinateAtPhase(phase));
  };
  const wheelStepRateAtPhase = (phase) => {
    if (phase <= releaseStartPhase || phase >= relockPhase) return 0;
    const coordinate = rawStepCoordinateAtPhase(phase);
    const coordinateRate = 1 / (stepPhaseDuration * balancePeriod);
    return 6 * coordinate * (1 - coordinate) * coordinateRate;
  };
  const wheelStepAccelerationAtPhase = (phase) => {
    if (phase <= releaseStartPhase || phase >= relockPhase) return 0;
    const coordinate = rawStepCoordinateAtPhase(phase);
    const coordinateRate = 1 / (stepPhaseDuration * balancePeriod);
    return (6 - 12 * coordinate) * coordinateRate ** 2;
  };
  const impulseStartStepProgress = wheelStepProgressAtPhase(
    impulseStartPhase,
  );
  const initialLockedWheelAngle = impulseContactReferenceAngle
    + toothLeanAngle
    + toothPitch * impulseStartStepProgress;
  const wheelAngleAtCyclePhase = (cycleIndex, phase) => (
    initialLockedWheelAngle
      - (cycleIndex + wheelStepProgressAtPhase(phase)) * toothPitch
  );
  const activeImpulseToothIndexForCycle = (cycleIndex) => (
    positiveModulo(cycleIndex, toothCount)
  );
  const lockingToothIndexForCyclePhase = (cycleIndex, phase) => (
    positiveModulo(
      10 + cycleIndex + (phase >= relockPhase ? 1 : 0),
      toothCount,
    )
  );
  const lockingToothReferenceAngle = initialLockedWheelAngle
    + 10 * toothPitch - toothLeanAngle;
  const lockingPoint = escapeWheelCenter.clone().add(new THREE.Vector2(
    Math.cos(lockingToothReferenceAngle) * toothTipRadius,
    Math.sin(lockingToothReferenceAngle) * toothTipRadius,
  ));
  const impulseToothAngleAtPhase = (phase) => (
    initialLockedWheelAngle
      - wheelStepProgressAtPhase(phase) * toothPitch
      - toothLeanAngle
  );
  const impulseContactPointAtPhase = (phase) => {
    const angle = impulseToothAngleAtPhase(phase);
    return escapeWheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * toothTipRadius,
      Math.sin(angle) * toothTipRadius,
    ));
  };
  const impulseLocalContactPointAtPhase = (phase) => rotate2(
    impulseContactPointAtPhase(phase).sub(balanceCenter),
    -balanceAngleAtPhase(phase),
  );
  const impulseFacePoints = (pointCount = 49) => Array.from(
    { length: pointCount },
    (_, index) => {
      const phase = THREE.MathUtils.lerp(
        impulseStartPhase,
        impulseEndPhase,
        index / (pointCount - 1),
      );
      return impulseLocalContactPointAtPhase(phase);
    },
  );

  const detentLiftAtPhase = (phase) => {
    if (phase <= hookStartPhase || phase >= relockPhase) return 0;
    if (phase < releaseStartPhase) {
      return maximumDetentLift * smoothStep01(
        (phase - hookStartPhase)
          / (releaseStartPhase - hookStartPhase),
      );
    }
    if (phase <= detentFallStartPhase) return maximumDetentLift;
    return maximumDetentLift * (
      1 - smoothStep01(
        (phase - detentFallStartPhase)
          / (relockPhase - detentFallStartPhase),
      )
    );
  };
  const mainSpringPointAtProgress = (lift, progress) => new THREE.Vector3(
    THREE.MathUtils.lerp(
      fixedSpringAnchor.x,
      mainSpringFreeBase.x,
      progress,
    ),
    THREE.MathUtils.lerp(
      fixedSpringAnchor.y,
      mainSpringFreeBase.y,
      progress,
    ) + lift * progress ** 2,
    0.31,
  );
  const stopDLeafProgress = (lockingPoint.x - fixedSpringAnchor.x)
    / (mainSpringFreeBase.x - fixedSpringAnchor.x);
  const mainSpringPointsAtLift = (lift, pointCount = 17) => Array.from(
    { length: pointCount },
    (_, index) => mainSpringPointAtProgress(
      lift,
      index / (pointCount - 1),
    ),
  );
  // f lies just in front of A (A spans z 0.20..0.42), not through it.
  const passingSpringPlaneZ = 0.49;
  const passingSpringPointsAtState = ({
    detentLift,
    outwardPassingDeflection,
    returnPassingDeflection,
  }, pointCount = 19) => {
    const anchorLiftFraction = 0.16;
    const anchor = new THREE.Vector3(
      passingSpringAnchorBase.x,
      passingSpringAnchorBase.y
        + detentLift * anchorLiftFraction,
      passingSpringPlaneZ,
    );
    const free = new THREE.Vector3(
      hookBase.x - 0.03,
      hookBase.y + detentLift
        - outwardPassingDeflection
        + returnPassingDeflection,
      passingSpringPlaneZ,
    );
    return Array.from({ length: pointCount }, (_, index) => {
      const progress = index / (pointCount - 1);
      const bow = Math.sin(Math.PI * progress);
      return new THREE.Vector3(
        THREE.MathUtils.lerp(anchor.x, free.x, progress),
        THREE.MathUtils.lerp(anchor.y, free.y, progress)
          - outwardPassingDeflection * 0.72 * bow
          + returnPassingDeflection * 0.28 * bow,
        anchor.z,
      );
    });
  };
  const passingStudMainProgress = (
    fixedSpringAnchor.x - passingSpringAnchorBase.x
  ) / (fixedSpringAnchor.x - mainSpringFreeBase.x);
  const passingStudPoseAtState = (state) => {
    const passingTop = passingSpringPointsAtState(state)[0];
    // The stud stands on A's upper edge (half of A's 0.10 width above its
    // centre line) rather than sinking to the centre line; update() tilts it
    // to A's local slope so its foot sits flat on the bending leaf.
    const mainBottom = mainSpringPointAtProgress(
      state.detentLift,
      passingStudMainProgress,
    ).add(new THREE.Vector3(0, 0.0505, 0));
    // Span the stud in the drawing plane only: the 0.18 depth step between
    // A (z 0.31) and f (z 0.49) had stretched it 0.02 down into A.
    mainBottom.z = passingTop.z;
    return {
      bottom: mainBottom,
      center: passingTop.clone().add(mainBottom).multiplyScalar(0.5),
      length: passingTop.distanceTo(mainBottom),
      top: passingTop,
    };
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.55,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.57,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.18,
    roughness: 0.50,
  });
  // Brown draws spring f and stud a in plain line; no white parts.
  const passingMaterial = matte(PALETTE.brass, {
    metalness: 0.16,
    roughness: 0.45,
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
  escapeWheel.position.set(escapeWheelCenter.x, escapeWheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role =
    'clockwise-twelve-tooth-escape-wheel-B-on-fixed-arbor';
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'detent-released-twelve-tooth-wheel-rotor';
  escapeWheel.add(wheelRotor);
  // Brown draws plain ratchet teeth: a short face and a straight back running
  // down to the next root, with no raised crown between the points.  The old
  // 1.96 crown arc filled the gaps and stood in the path of notch g as the
  // free balance swung past the line of centres.  The narrow point is kept
  // (it drops to 1.96 just behind the tip) so the impulse face still clears
  // the back of the working tooth.
  const wheelShape = new THREE.Shape();
  for (let toothIndex = 0; toothIndex < toothCount; toothIndex += 1) {
    const centerAngle = toothIndex * toothPitch;
    const outlinePoints = [
      new THREE.Vector2(
        Math.cos(centerAngle - toothPitch * 0.49) * wheelRootRadius,
        Math.sin(centerAngle - toothPitch * 0.49) * wheelRootRadius,
      ),
      new THREE.Vector2(
        Math.cos(centerAngle - toothPitch * 0.38) * toothTipRadius,
        Math.sin(centerAngle - toothPitch * 0.38) * toothTipRadius,
      ),
      new THREE.Vector2(
        Math.cos(centerAngle - toothPitch * 0.25) * wheelCrownRadius,
        Math.sin(centerAngle - toothPitch * 0.25) * wheelCrownRadius,
      ),
      new THREE.Vector2(
        Math.cos(centerAngle + toothPitch * 0.49) * wheelRootRadius,
        Math.sin(centerAngle + toothPitch * 0.49) * wheelRootRadius,
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
  const toothedDisk = new THREE.Mesh(
    centeredExtrusion(wheelShape, wheelDepth, 0.007),
    driverMaterial,
  );
  toothedDisk.userData.role =
    'twelve-source-counted-ratchet-teeth-on-wheel-B';
  wheelRotor.add(toothedDisk);
  const wheelHub = cylinderAlongZ(0.25, 0.72, darkMaterial, 34);
  wheelHub.userData.role = 'escape-wheel-B-arbor-hub';
  wheelRotor.add(wheelHub);
  const wheelShaft = cylinderAlongZ(0.11, 1.28, darkMaterial, 32);
  wheelShaft.userData.role = 'fixed-escape-wheel-B-shaft';
  escapeWheel.add(wheelShaft);
  const wheelIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 16, 12),
    indexMaterial,
  );
  wheelIndex.position.set(0.90, 0, wheelDepth / 2 + 0.08);
  wheelIndex.userData.role = 'white-index-inside-escape-wheel-B';
  wheelRotor.add(wheelIndex);

  const balance = new THREE.Group();
  balance.position.set(balanceCenter.x, balanceCenter.y, 0.24);
  balance.userData.axis = Z_AXIS.clone();
  balance.userData.role =
    'freely-oscillating-balance-with-stud-a-and-notch-g';
  const balanceRim = new THREE.Mesh(
    new THREE.TorusGeometry(
      balanceRadius,
      0.10,
      12,
      72,
      balanceRimArc,
    ),
    drivenMaterial,
  );
  balanceRim.rotation.z = balanceRimArcStart;
  balanceRim.userData.role = 'balance-wheel-rim';
  const balanceHub = cylinderAlongZ(0.20, 0.80, darkMaterial, 34);
  balanceHub.userData.role = 'balance-arbor';
  const balanceSpokes = [];
  for (let index = 0; index < 3; index += 1) {
    const angle = index * FULL_TURN / 3;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(balanceRadius * 0.82, 0.09, 0.25),
      drivenMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * balanceRadius * 0.43,
      Math.sin(angle) * balanceRadius * 0.43,
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `balance-spoke-${index + 1}`;
    balanceSpokes.push(spoke);
    balance.add(spoke);
  }
  // Stud a works spring f only: it and its arm run in front of hook k and
  // detent A (world z 0.48..0.60 and 0.48..0.58; k's front face is 0.47),
  // overlapping only f's plane (0.43..0.55).  The old ball at z 0.33..0.56
  // drove straight through hook k on both passes.
  const studArm = new THREE.Mesh(
    new THREE.BoxGeometry(balanceRadius * 0.88, 0.08, 0.10),
    drivenMaterial,
  );
  studArm.position.set(balanceRadius * 0.44, 0, 0.29);
  studArm.userData.role = 'balance-arm-carrying-operating-stud-a';
  const operatingStud = cylinderAlongZ(0.115, 0.12, darkMaterial, 24);
  operatingStud.position.set(balanceRadius * 0.92, 0, 0.30);
  operatingStud.userData.role =
    'one-way-operating-stud-a-on-balance-axis-assembly';
  const impulsePoints = impulseFacePoints();
  const impulsePallet = makeImpulsePallet(
    impulsePoints,
    balanceDepth + 0.05,
  );
  const impulseCenter = impulsePoints.reduce(
    (sum, point) => sum.add(point),
    new THREE.Vector2(),
  ).multiplyScalar(1 / impulsePoints.length);
  const impulseArm = beamBetween(
    new THREE.Vector3(
      impulseCenter.clone().normalize()
        .multiplyScalar(balanceRadius * 0.68).x,
      impulseCenter.clone().normalize()
        .multiplyScalar(balanceRadius * 0.68).y,
      -0.565,
    ),
    new THREE.Vector3(impulseCenter.x, impulseCenter.y, -0.565),
    0.16,
    0.25,
    drivenMaterial,
  );
  // The arm runs behind the wheel (world z -0.45..-0.20; the wheel's back
  // face is -0.19), in front of the plain disc, and meets notch g from
  // behind; only the notch reaches into the teeth.
  impulseArm.userData.role = 'balance-arm-to-impulse-notch-g';
  // Brown draws balance a as a plain disc with the notch h, g where the
  // tooth enters; the open rim and spokes are not drawn. The disc lies behind
  // the wheel plane, bored for the fixed journal, so no working plane moves.
  const balanceNotchAngle = Math.atan2(impulseCenter.y, impulseCenter.x);
  const balanceNotchHalfAngle = THREE.MathUtils.degToRad(24);
  const balanceDiscRadius = balanceRadius + 0.10;
  const balanceDiscShape = new THREE.Shape();
  const balanceDiscSteps = 72;
  for (let step = 0; step <= balanceDiscSteps; step += 1) {
    const angle = balanceNotchAngle + balanceNotchHalfAngle
      + (FULL_TURN - 2 * balanceNotchHalfAngle) * step / balanceDiscSteps;
    const x = Math.cos(angle) * balanceDiscRadius;
    const y = Math.sin(angle) * balanceDiscRadius;
    if (step === 0) balanceDiscShape.moveTo(x, y);
    else balanceDiscShape.lineTo(x, y);
  }
  balanceDiscShape.lineTo(
    Math.cos(balanceNotchAngle) * impulseCenter.length() * 0.80,
    Math.sin(balanceNotchAngle) * impulseCenter.length() * 0.80,
  );
  balanceDiscShape.closePath();
  const balanceDiscBore = new THREE.Path();
  for (let step = 0; step < 40; step += 1) {
    const angle = -FULL_TURN * step / 40;
    if (step === 0) balanceDiscBore.moveTo(0.104, 0);
    else balanceDiscBore.lineTo(Math.cos(angle) * 0.104, Math.sin(angle) * 0.104);
  }
  balanceDiscBore.closePath();
  balanceDiscShape.holes.push(balanceDiscBore);
  const balanceDisc = new THREE.Mesh(
    centeredExtrusion(balanceDiscShape, 0.08, 0.004),
    drivenMaterial,
  );
  balanceDisc.position.z = -0.54;
  balanceDisc.userData.role = 'plain-notched-balance-disc-behind-wheel-plane';
  const balanceDiscCollarShape = new THREE.Shape();
  for (let step = 0; step < 40; step += 1) {
    const angle = FULL_TURN * step / 40;
    if (step === 0) balanceDiscCollarShape.moveTo(0.20, 0);
    else balanceDiscCollarShape.lineTo(Math.cos(angle) * 0.20, Math.sin(angle) * 0.20);
  }
  balanceDiscCollarShape.closePath();
  balanceDiscCollarShape.holes.push(balanceDiscBore);
  const balanceDiscCollar = new THREE.Mesh(
    centeredExtrusion(balanceDiscCollarShape, 0.12, 0.004),
    darkMaterial,
  );
  balanceDiscCollar.position.z = -0.46;
  balanceDiscCollar.userData.role = 'collar-joining-balance-disc-to-arbor';
  balance.add(
    balanceDisc,
    balanceDiscCollar,
    balanceRim,
    balanceHub,
    studArm,
    operatingStud,
    impulseArm,
    impulsePallet,
  );

  const mainDetentSpring = createSegmentedLeaf({
    count: 16,
    depth: 0.22,
    material: drivenMaterial,
    role: 'main-detent-leaf-spring-A-fixed-at-b',
    width: 0.10,
  });
  const passingSpring = createSegmentedLeaf({
    count: 18,
    depth: 0.12,
    material: passingMaterial,
    role: 'light-one-way-passing-spring-f-held-by-stud-i',
    width: 0.055,
  });
  const fixedScrewB = new THREE.Group();
  fixedScrewB.position.set(fixedSpringAnchor.x, fixedSpringAnchor.y, 0.31);
  fixedScrewB.userData.fixed = true;
  fixedScrewB.userData.role = 'fixed-screw-b-clamping-main-spring-A';
  const fixedBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.70, 0.44),
    frameMaterial,
  );
  const fixedScrew = cylinderAlongZ(0.12, 0.62, darkMaterial, 28);
  fixedScrewB.add(fixedBlock, fixedScrew);
  const passingStudI = new THREE.Mesh(
    new THREE.BoxGeometry(0.23, 1, 0.34),
    accentMaterial,
  );
  passingStudI.userData.role = 'stud-i-clamping-light-passing-spring';
  const hookK = new THREE.Group();
  hookK.userData.role =
    'hook-k-transmits-upward-only-motion-to-main-detent';
  // k spans z 0.20..0.47: it laps A (0.20..0.42) and f (0.43..0.55) but
  // stands in front of notch g (whose front face is 0.198).
  const hookVertical = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.38, 0.27),
    drivenMaterial,
  );
  hookVertical.position.y = 0.11;
  const hookLip = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.10, 0.27),
    drivenMaterial,
  );
  // The foot of k lies under A (A spans +-0.05 about the free point).
  hookLip.position.set(0.10, -0.1005, 0);
  hookK.add(hookVertical, hookLip);
  // 0.29 tall: its top meets the underside of A (0.28 above the locking
  // face) with a 0.01 seat instead of standing 0.06 up through the leaf.
  const detentStopD = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.29, 0.38),
    accentMaterial,
  );
  detentStopD.userData.role =
    'stop-d-under-main-spring-locks-successive-teeth';

  const lockMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 18, 14),
    indexMaterial,
  );
  lockMarker.position.z = 0.64;
  lockMarker.userData.role = 'white-marker-on-stop-d-locking-contact';
  const impulseMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 18, 14),
    indexMaterial,
  );
  impulseMarker.position.z = 0.68;
  impulseMarker.userData.role =
    'white-marker-on-tooth-to-notch-g-impulse-contact';

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-watch-plate-supports-for-balance-wheel-and-detent';
  const rearHorizontal = beamBetween(
    new THREE.Vector3(-4.65, -3.95, -0.96),
    new THREE.Vector3(4.45, -3.95, -0.96),
    0.22,
    0.72,
    frameMaterial,
  );
  rearHorizontal.userData.role = 'fixed-watch-plate-base';
  const balanceStandard = beamBetween(
    new THREE.Vector3(balanceCenter.x, -3.95, -0.96),
    new THREE.Vector3(balanceCenter.x, balanceCenter.y + 1.45, -0.96),
    0.19,
    0.23,
    frameMaterial,
  );
  balanceStandard.userData.role = 'fixed-balance-arbor-standard';
  const wheelStandard = beamBetween(
    new THREE.Vector3(escapeWheelCenter.x, -3.95, -0.96),
    new THREE.Vector3(escapeWheelCenter.x, escapeWheelCenter.y, -0.96),
    0.19,
    0.23,
    frameMaterial,
  );
  wheelStandard.userData.role = 'fixed-escape-wheel-arbor-standard';
  const balanceBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.29, 0.075, 10, 42),
    frameMaterial,
  );
  balanceBearing.position.set(balanceCenter.x, balanceCenter.y, -0.62);
  balanceBearing.userData.role = 'fixed-balance-arbor-bearing';
  const wheelBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.075, 10, 42),
    frameMaterial,
  );
  wheelBearing.position.set(
    escapeWheelCenter.x,
    escapeWheelCenter.y,
    -0.62,
  );
  wheelBearing.userData.role = 'fixed-escape-wheel-bearing';
  fixedFrame.add(
    rearHorizontal,
    balanceStandard,
    wheelStandard,
    balanceBearing,
    wheelBearing,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(10.2, 8.3, 3.0),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-0.05, -0.10, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-arnold-free-escapement';

  root.add(
    cameraEnvelope,
    fixedFrame,
    escapeWheel,
    balance,
    mainDetentSpring,
    passingSpring,
    fixedScrewB,
    passingStudI,
    hookK,
    detentStopD,
    lockMarker,
    impulseMarker,
  );

  const stateAtTime = (time) => {
    const cycleCoordinate = time / balancePeriod;
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const balanceAngle = balanceAngleAtPhase(cyclePhase);
    const balanceAngularSpeed = balanceAngularSpeedAtPhase(cyclePhase);
    const balanceAngularAcceleration = balanceAngularAccelerationAtPhase(
      cyclePhase,
    );
    const stepProgress = wheelStepProgressAtPhase(cyclePhase);
    const stepRate = wheelStepRateAtPhase(cyclePhase);
    const stepAcceleration = wheelStepAccelerationAtPhase(cyclePhase);
    const wheelAngle = wheelAngleAtCyclePhase(cycleIndex, cyclePhase);
    const wheelAngularSpeed = -toothPitch * stepRate;
    const wheelAngularAcceleration = -toothPitch * stepAcceleration;
    const detentLift = detentLiftAtPhase(cyclePhase);
    const outwardPassingBump = cyclicCosineBump(
      cyclePhase,
      0,
      outwardPassingHalfWidth,
    );
    const returnPassingBump = cosineBump(
      cyclePhase,
      0.5,
      returnPassingHalfWidth,
    );
    const outwardPassingDeflection = 0.27 * outwardPassingBump;
    const returnPassingDeflection = 0.07 * returnPassingBump;
    const outwardPassing = outwardPassingBump > 1e-12;
    const hookEngaged = cyclePhase >= hookStartPhase
      && cyclePhase <= hookEndPhase;
    const wheelUnlocked = cyclePhase >= releaseStartPhase
      && cyclePhase < relockPhase;
    const impulseContactActive = cyclePhase >= impulseStartPhase
      && cyclePhase <= impulseEndPhase;
    const wheelLocked = !wheelUnlocked;
    const operatingStudLocal = new THREE.Vector2(
      operatingStud.position.x,
      operatingStud.position.y,
    );
    const operatingStudPoint = balanceCenter.clone().add(
      rotate2(operatingStudLocal, balanceAngle),
    );
    let lockingToothIndex = null;
    let lockingToothPoint = null;
    let lockingPointError = null;
    if (wheelLocked) {
      lockingToothIndex = lockingToothIndexForCyclePhase(
        cycleIndex,
        cyclePhase,
      );
      const lockingToothAngle = wheelAngle
        + lockingToothIndex * toothPitch - toothLeanAngle;
      lockingToothPoint = escapeWheelCenter.clone().add(
        new THREE.Vector2(
          Math.cos(lockingToothAngle) * toothTipRadius,
          Math.sin(lockingToothAngle) * toothTipRadius,
        ),
      );
      lockingPointError = lockingToothPoint.distanceTo(lockingPoint);
    }
    let impulseContact = null;
    let impulseToothIndex = null;
    let impulseToothPoint = null;
    if (impulseContactActive) {
      impulseToothIndex = activeImpulseToothIndexForCycle(cycleIndex);
      const impulseToothAngle = wheelAngle
        + impulseToothIndex * toothPitch - toothLeanAngle;
      impulseToothPoint = escapeWheelCenter.clone().add(
        new THREE.Vector2(
          Math.cos(impulseToothAngle) * toothTipRadius,
          Math.sin(impulseToothAngle) * toothTipRadius,
        ),
      );
      const expectedPoint = impulseContactPointAtPhase(cyclePhase);
      const localPoint = impulseLocalContactPointAtPhase(cyclePhase);
      const wheelRadiusVector = impulseToothPoint.clone()
        .sub(escapeWheelCenter);
      const balanceRadiusVector = impulseToothPoint.clone()
        .sub(balanceCenter);
      const toothVelocity = crossZ(wheelRadiusVector)
        .multiplyScalar(wheelAngularSpeed);
      const palletMaterialVelocity = crossZ(balanceRadiusVector)
        .multiplyScalar(balanceAngularSpeed);
      const relativeVelocity = toothVelocity.clone()
        .sub(palletMaterialVelocity);
      const faceTangent = relativeVelocity.clone().normalize();
      const faceNormal = new THREE.Vector2(
        -faceTangent.y,
        faceTangent.x,
      );
      impulseContact = {
        expectedPoint,
        faceNormal,
        faceTangent,
        localPoint,
        normalVelocityError: relativeVelocity.dot(faceNormal),
        palletMaterialVelocity,
        pointError: impulseToothPoint.distanceTo(expectedPoint),
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
        toothVelocity,
      };
    }
    let stage = 'detached-free-balance-and-locked-wheel';
    if (outwardPassing) {
      stage = 'outward-pass-depresses-light-spring-only';
    } else if (cyclePhase >= hookStartPhase
      && cyclePhase < releaseStartPhase) {
      stage = 'return-pass-hooks-and-lifts-main-detent';
    } else if (wheelUnlocked && cyclePhase < impulseStartPhase) {
      stage = 'one-tooth-release-before-impulse';
    } else if (impulseContactActive) {
      stage = 'escape-tooth-impulses-balance-notch-g';
    } else if (wheelUnlocked) {
      stage = 'detent-falls-to-catch-next-tooth';
    } else if (hookEngaged) {
      stage = 'return-passing-spring-disengages-after-relock';
    }
    return {
      balanceAngle,
      balanceAngularAcceleration,
      balanceAngularSpeed,
      balanceFree: !hookEngaged && !impulseContactActive,
      cycleIndex,
      cyclePhase,
      detentLift,
      hookEngaged,
      impulseContact,
      impulseContactActive,
      impulseToothIndex,
      impulseToothPoint,
      lockingPointError,
      lockingToothIndex,
      lockingToothPoint,
      operatingStudPoint,
      outwardPassing,
      outwardPassingDeflection,
      returnPassingDeflection,
      stage,
      stepProgress,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
      wheelLocked,
      wheelUnlocked,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * balancePeriod,
  );
  const canonicalPhases = {
    detachedQuarter: 0.25,
    detentFallStart: detentFallStartPhase,
    impulseEnd: impulseEndPhase,
    impulseStart: impulseStartPhase,
    outwardPassing: 0,
    relocked: relockPhase,
    returnHookStart: hookStartPhase,
    returnPassing: 0.5,
    toothRelease: releaseStartPhase,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalPhases).map(([name, phase]) => [
      name,
      stateAtCyclePhase(phase),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    balance.rotation.z = state.balanceAngle;
    balance.userData.angularAcceleration =
      state.balanceAngularAcceleration;
    balance.userData.angularSpeed = state.balanceAngularSpeed;
    wheelRotor.rotation.z = state.wheelAngle;
    wheelRotor.userData.angularAcceleration =
      state.wheelAngularAcceleration;
    wheelRotor.userData.angularSpeed = state.wheelAngularSpeed;

    const mainPoints = mainSpringPointsAtLift(state.detentLift);
    const passingPoints = passingSpringPointsAtState(state);
    // A is riveted to the side of hook k: its rendered end stops at k's
    // right face (0.055 short of k's axis) instead of running into k.
    const renderedMainPoints = mainPoints.map((point) => point.clone());
    renderedMainPoints.at(-1).lerp(
      renderedMainPoints.at(-2),
      0.0545 / renderedMainPoints.at(-1).distanceTo(renderedMainPoints.at(-2)),
    );
    updateSegmentedLeaf(mainDetentSpring, renderedMainPoints);
    updateSegmentedLeaf(passingSpring, passingPoints);
    const freePoint = mainPoints.at(-1);
    hookK.position.set(freePoint.x, freePoint.y, 0.335);
    // k is fixed to A's end, so it tilts with A's end as the leaf bends.
    const beforeFree = mainPoints.at(-2);
    hookK.rotation.z = Math.atan2(
      beforeFree.y - freePoint.y,
      beforeFree.x - freePoint.x,
    );
    const passingStudPose = passingStudPoseAtState(state);
    passingStudI.position.set(
      passingStudPose.center.x,
      passingStudPose.center.y,
      0.38,
    );
    passingStudI.scale.y = passingStudPose.length;
    passingStudI.rotation.z = Math.atan2(
      2 * state.detentLift * passingStudMainProgress,
      mainSpringFreeBase.x - fixedSpringAnchor.x,
    ) - Math.PI;
    // d is fixed under the leaf, so it rises with the leaf at its own station
    // (lift x progress^2), not with the free end; the old full-lift offset
    // drove d 0.13 up through A when the detent was raised.
    detentStopD.position.set(
      lockingPoint.x,
      lockingPoint.y + 0.145 + state.detentLift * stopDLeafProgress ** 2,
      0.38,
    );
    // ... and tilts with the leaf there, so its seat stays flat under A
    // (level while locked, when the lift is zero).
    detentStopD.rotation.z = Math.atan(
      -2 * state.detentLift * stopDLeafProgress
        / (fixedSpringAnchor.x - mainSpringFreeBase.x),
    );
    lockMarker.visible = state.wheelLocked;
    if (state.wheelLocked) {
      lockMarker.position.set(
        state.lockingToothPoint.x,
        state.lockingToothPoint.y,
        0.64,
      );
    }
    impulseMarker.visible = state.impulseContactActive;
    if (state.impulseContactActive) {
      impulseMarker.position.set(
        state.impulseToothPoint.x,
        state.impulseToothPoint.y,
        0.68,
      );
    }
    root.userData.contacts = {
      detent: state.wheelLocked
        ? {
          pointError: state.lockingPointError,
          toothIndex: state.lockingToothIndex,
        }
        : null,
      impulse: state.impulseContactActive
        ? {
          normalVelocityError: state.impulseContact.normalVelocityError,
          pointError: state.impulseContact.pointError,
          relativeSlipSpeed: state.impulseContact.relativeSlipSpeed,
          toothIndex: state.impulseToothIndex,
        }
        : null,
      mode: state.impulseContactActive
        ? 'impulse-notch-g'
        : state.wheelLocked
          ? 'detent-stop-d'
          : 'unlocked-flight',
    };
    root.userData.kinematics = state;
  };

  const impulseRadiusRange = (() => {
    const radii = impulsePoints.map((point) => point.length());
    return Math.max(...radii) - Math.min(...radii);
  })();
  root.userData.archetype =
    'arnold-twelve-tooth-detached-free-chronometer-escapement';
  root.userData.mechanism =
    'Arnold’s balance stud a depresses light passing spring f without moving detent A on the outward pass; on return, f bears under hook k and lifts A with stop d, freeing exactly one of twelve teeth on wheel B while another tooth strikes impulse notch g, after which d immediately arrests the next tooth and leaves the balance detached';
  root.userData.transmission = {
    balanceInteraction: 'the main balance is loaded only during the return unlocking-and-impulse event',
    direction: 'escape wheel B advances clockwise by one tooth per balance oscillation',
    outwardPass: 'light spring f yields downward under stud a while stop d remains locked',
    returnPass: 'spring f lifts hook k, main detent A, and stop d before tooth-to-notch-g impulse',
    toothCount,
  };
  root.userData.blocks = {
    balance,
    balanceBearing,
    balanceHub,
    balanceRim,
    balanceSpokes,
    balanceStandard,
    cameraEnvelope,
    detentStopD,
    escapeWheel,
    fixedBlock,
    fixedFrame,
    fixedScrew,
    fixedScrewB,
    hookK,
    impulseArm,
    impulseMarker,
    impulsePallet,
    lockMarker,
    mainDetentSpring,
    operatingStud,
    passingSpring,
    passingStudI,
    rearHorizontal,
    studArm,
    toothedDisk,
    wheelBearing,
    wheelHub,
    wheelIndex,
    wheelRotor,
    wheelShaft,
    wheelStandard,
  };
  root.userData.canonicalPhases = canonicalPhases;
  root.userData.canonicalStates = canonicalStates;
  root.userData.geometry = {
    balanceAmplitude,
    balanceCenter: balanceCenter.clone(),
    balanceDepth,
    balancePeriod,
    balanceRadius,
    balanceRimArc,
    balanceRimArcStart,
    balanceRimGapEnd,
    balanceRimGapStart,
    detentFallStartPhase,
    escapeWheelCenter: escapeWheelCenter.clone(),
    hookEndPhase,
    hookStartPhase,
    impulseContactReferenceAngle,
    impulseEndPhase,
    impulseStartPhase,
    impulseStartStepProgress,
    initialLockedWheelAngle,
    lockingPoint: lockingPoint.clone(),
    lockingToothReferenceAngle,
    maximumDetentLift,
    outwardPassingHalfWidth,
    releaseStartPhase,
    relockPhase,
    returnPassingHalfWidth,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    stepPhaseDuration,
    toothCount,
    toothLeanAngle,
    toothPitch,
    toothProfileTipOffset: -toothPitch * 0.38,
    toothTipRadius,
    wheelCrownRadius,
    wheelDepth,
    wheelRootRadius,
  };
  root.userData.impulseContactPointAtPhase = impulseContactPointAtPhase;
  root.userData.impulseFacePoints = impulseFacePoints;
  root.userData.impulseLocalContactPointAtPhase =
    impulseLocalContactPointAtPhase;
  root.userData.impulseProfile = {
    concentricRadiusRange: impulseRadiusRange,
    points: impulsePoints,
    sourceLabel: 'g',
  };
  root.userData.mainSpringPointsAtLift = mainSpringPointsAtLift;
  root.userData.passingSpringPointsAtState = passingSpringPointsAtState;
  root.userData.passingStudPoseAtState = passingStudPoseAtState;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'The official page exposes Brown’s static plate and detailed one-way sequence but marks animation unavailable. Member topology and event order come from the source; event durations, elastic deflections, and contact profiles are independently reconstructed.',
    sourceUrl: 'https://507movements.com/mm_291.html',
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate291: {
      countedToothCount: sourceCountedToothCount,
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'a twelve-tooth clockwise escape wheel B is normally held by stop d on long spring A fixed at b; balance stud a acts on light spring f under hook k, and a separate tooth impulses balance notch g',
      measurementUncertaintyPixels: 7,
      rasterBalanceCenterA: sourceRasterBalanceCenterA.clone(),
      rasterBalanceRadius: sourceRasterBalanceRadius,
      rasterDetentStopD: sourceRasterDetentStopD.clone(),
      rasterDirectionArrow: sourceRasterDirectionArrow.clone(),
      rasterEscapeWheelCenterB: sourceRasterEscapeWheelCenterB.clone(),
      rasterEscapeWheelTipRadius: sourceRasterEscapeWheelTipRadius,
      rasterFixedSpringScrewB: sourceRasterFixedSpringScrewB.clone(),
      rasterHookK: sourceRasterHookK.clone(),
      rasterImpulseNotchG: sourceRasterImpulseNotchG.clone(),
      rasterMainSpringFreeEnd: sourceRasterMainSpringFreeEnd.clone(),
      rasterPassingSpringStudI: sourceRasterPassingSpringStudI.clone(),
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
      'outward-stud-pass-flexes-light-spring-only',
      'detached-free-balance-with-wheel-locked-at-d',
      'return-pass-lifts-f-hook-k-main-detent-A-and-stop-d',
      'one-tooth-release',
      'separate-tooth-impulses-notch-g',
      'stop-d-falls-and-arrests-next-tooth',
    ],
  };
  root.userData.wheelAngleAtCyclePhase = wheelAngleAtCyclePhase;
  root.userData.wheelStepProgressAtPhase = wheelStepProgressAtPhase;

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
    impulseMarker,
    lockMarker,
    operatingStud,
    wheelIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  cameraEnvelope.castShadow = false;
  cameraEnvelope.receiveShadow = false;
  root.userData.fidelity = 'authored';
  correctFreeEscapement(root, movement.id);
  fitFreeEscapement(root, update);
  return {
    cameraDirection: new THREE.Vector3(.7, .5, 14),
    root,
    update,
  };
}

function earnshawSpringDetentEscapement(movement) {
  const root = new THREE.Group();

  // Brown's movement 313 is Denison's Fig. 32 redrawn: the common
  // Earnshaw spring-detent escapement.  T, B, and A are successive teeth
  // of one fifteen-tooth wheel.  The current tooth is locked at T; after V
  // lifts the detent, A catches the sole radial impulse pallet P and the
  // intervening tooth B reaches the same fixed lock station.  The lower
  // discharging roller and its jewel V operate in the passing-spring plane,
  // below the impulse roller and pallet P.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.01625;
  const sourceRasterWheelCenter = new THREE.Vector2(221, 310);
  const sourceRasterWheelTip = new THREE.Vector2(304, 153);
  const sourceRasterBalanceCenter = new THREE.Vector2(371, 109);
  const sourceRasterImpulsePalletP = new THREE.Vector2(320, 160);
  const sourceRasterUnlockingJewelV = new THREE.Vector2(401, 143);
  const sourceRasterLockingPalletT = new THREE.Vector2(382, 262);
  const sourceRasterBankingPinE = new THREE.Vector2(380, 290);
  const sourceRasterPassingSpringRootT = new THREE.Vector2(387, 260);
  const sourceRasterPassingSpringFreeEnd = new THREE.Vector2(400, 150);
  const sourceRasterDetentNose = new THREE.Vector2(404, 151);
  const sourceRasterSpringRootD = new THREE.Vector2(399, 479);
  const sourceRasterFixedBlockD = new THREE.Vector2(396, 498);
  const sourceRasterDirectionArrowTip = new THREE.Vector2(318, 51);
  const sourceCountedToothCount = 15;

  const escapeWheelCenter = new THREE.Vector2(-1.35, -0.70);
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    escapeWheelCenter.x
      + (x - sourceRasterWheelCenter.x) * sourceScale,
    escapeWheelCenter.y
      + (sourceRasterWheelCenter.y - y) * sourceScale,
  );
  const balanceCenter = sourcePointToModel(sourceRasterBalanceCenter);
  const centerVector = balanceCenter.clone().sub(escapeWheelCenter);
  const centerDistance = centerVector.length();
  const centerLineAngle = Math.atan2(centerVector.y, centerVector.x);

  const toothCount = sourceCountedToothCount;
  const toothPitch = FULL_TURN / toothCount;
  const toothTipOffset = -toothPitch * 0.32;
  const escapeWheelRadiusToCenterDistance = 0.65;
  const toothTipRadius = centerDistance
    * escapeWheelRadiusToCenterDistance;
  const wheelRootRadius = toothTipRadius * 0.77;
  const wheelCrownRadius = toothTipRadius * 0.86;
  const wheelDepth = 0.36;
  const impulseRollerDiameterToEscapeWheelDiameter = 0.5;
  const impulseRollerRadius = toothTipRadius
    * impulseRollerDiameterToEscapeWheelDiameter;
  const dischargingRollerRadius = 0.48;
  const impulsePlaneZ = 0.22;
  const dischargingPlaneZ = -0.30;
  const escapeWheelPlaneZ = 0;

  const lockAngle = THREE.MathUtils.degToRad(18);
  const lockingDrawAngle = THREE.MathUtils.degToRad(10);
  const lockingPoint = escapeWheelCenter.clone().add(new THREE.Vector2(
    Math.cos(lockAngle) * toothTipRadius,
    Math.sin(lockAngle) * toothTipRadius,
  ));
  const lockNormal = lockingPoint.clone().sub(escapeWheelCenter).normalize();
  const initialLockedWheelAngle = lockAngle - toothTipOffset;
  const impulseToothOffset = 2;
  const nextLockToothOffset = 1;

  const documentedVibrationArc = THREE.MathUtils.degToRad(430);
  const balanceAmplitude = documentedVibrationArc / 2;
  const physicalVibrationsPerSecond = 4;
  const balancePeriod = 2 / physicalVibrationsPerSecond;
  const balanceAngleAtPhase = (phase) => -balanceAmplitude
    * Math.cos(FULL_TURN * phase);
  const balancePhaseRateAtPhase = (phase) => balanceAmplitude
    * FULL_TURN * Math.sin(FULL_TURN * phase);
  const balancePhaseAccelerationAtPhase = (phase) => balanceAmplitude
    * FULL_TURN ** 2 * Math.cos(FULL_TURN * phase);
  const outwardPhaseAtAngle = (angle) => Math.acos(
    -angle / balanceAmplitude,
  ) / FULL_TURN;
  const returnPhaseAtAngle = (angle) => 1 - outwardPhaseAtAngle(angle);

  const unlockingTravelAngle = THREE.MathUtils.degToRad(5);
  const engagingDropBalanceAngle = THREE.MathUtils.degToRad(10);
  const impulseBalanceAngle = THREE.MathUtils.degToRad(15);
  const disengagingDropBalanceAngle = THREE.MathUtils.degToRad(5);
  const unlockContactStartPhase = outwardPhaseAtAngle(
    -unlockingTravelAngle,
  );
  const releasePhase = outwardPhaseAtAngle(0);
  const detentBankPhase = outwardPhaseAtAngle(
    THREE.MathUtils.degToRad(7),
  );
  const impulseStartPhase = outwardPhaseAtAngle(
    engagingDropBalanceAngle,
  );
  const impulseEndPhase = outwardPhaseAtAngle(
    engagingDropBalanceAngle + impulseBalanceAngle,
  );
  const relockPhase = outwardPhaseAtAngle(
    engagingDropBalanceAngle
      + impulseBalanceAngle
      + disengagingDropBalanceAngle,
  );
  const returnPassingStartPhase = returnPhaseAtAngle(
    unlockingTravelAngle,
  );
  const returnPassingCenterPhase = 0.75;
  const returnPassingEndPhase = returnPhaseAtAngle(
    -unlockingTravelAngle,
  );
  const maximumDetentLift = 0.08;
  const maximumReturnPassingDeflection = 0.16;
  // V's radius (0.08) + half the 0.052 leaf width + 0.004 running clearance.
  const returnPassingLeafClearance = 0.110;
  // Acting contact: V's radius plus half the leaf width, plus 0.001.
  const actingLeafClearance = 0.107;

  const impulsePalletLocalAngle = Math.atan2(
    sourceRasterBalanceCenter.y - sourceRasterImpulsePalletP.y,
    sourceRasterImpulsePalletP.x - sourceRasterBalanceCenter.x,
  );
  const impulsePalletLocalDirection = new THREE.Vector2(
    Math.cos(impulsePalletLocalAngle),
    Math.sin(impulsePalletLocalAngle),
  );
  const contactGeometryAtPhase = (phase) => {
    const balanceAngle = balanceAngleAtPhase(phase);
    const direction = rotate2(
      impulsePalletLocalDirection,
      balanceAngle,
    );
    const centerFromWheel = balanceCenter.clone().sub(
      escapeWheelCenter,
    );
    const projection = centerFromWheel.dot(direction);
    const discriminant = projection ** 2
      - (centerDistance ** 2 - toothTipRadius ** 2);
    const palletRadius = -projection - Math.sqrt(Math.max(0, discriminant));
    const point = balanceCenter.clone().add(
      direction.clone().multiplyScalar(palletRadius),
    );
    return {
      balanceAngle,
      direction,
      palletRadius,
      point,
      toothAngle: Math.atan2(
        point.y - escapeWheelCenter.y,
        point.x - escapeWheelCenter.x,
      ),
    };
  };
  const contactWheelAngleAtPhase = (phase) => {
    const contact = contactGeometryAtPhase(phase);
    return contact.toothAngle
      - impulseToothOffset * toothPitch
      - toothTipOffset;
  };
  const numericalContactStateAtPhase = (phase) => {
    const step = 1e-5;
    const valueMinus2 = contactWheelAngleAtPhase(phase - 2 * step);
    const valueMinus1 = contactWheelAngleAtPhase(phase - step);
    const value = contactWheelAngleAtPhase(phase);
    const valuePlus1 = contactWheelAngleAtPhase(phase + step);
    const valuePlus2 = contactWheelAngleAtPhase(phase + 2 * step);
    return {
      phaseAcceleration: (
        -valuePlus2 + 16 * valuePlus1 - 30 * value
          + 16 * valueMinus1 - valueMinus2
      ) / (12 * step ** 2),
      phaseRate: (
        -valuePlus2 + 8 * valuePlus1
          - 8 * valueMinus1 + valueMinus2
      ) / (12 * step),
      value,
    };
  };
  const contactStartWheelState = numericalContactStateAtPhase(
    impulseStartPhase,
  );
  const contactEndWheelState = numericalContactStateAtPhase(
    impulseEndPhase,
  );
  const finalWheelAngleForCycle = initialLockedWheelAngle - toothPitch;

  const wheelMotionAtCyclePhase = (cycleIndex, phase) => {
    let state;
    if (phase <= releasePhase) {
      state = {
        phaseAcceleration: 0,
        phaseRate: 0,
        value: initialLockedWheelAngle,
      };
    } else if (phase < impulseStartPhase) {
      const span = impulseStartPhase - releasePhase;
      state = quinticBoundaryState({
        coordinate: (phase - releasePhase) / span,
        endAcceleration: contactStartWheelState.phaseAcceleration,
        endRate: contactStartWheelState.phaseRate,
        endValue: contactStartWheelState.value,
        span,
        startAcceleration: 0,
        startRate: 0,
        startValue: initialLockedWheelAngle,
      });
    } else if (phase <= impulseEndPhase) {
      state = numericalContactStateAtPhase(phase);
    } else if (phase < relockPhase) {
      const span = relockPhase - impulseEndPhase;
      state = quinticBoundaryState({
        coordinate: (phase - impulseEndPhase) / span,
        endAcceleration: 0,
        endRate: 0,
        endValue: finalWheelAngleForCycle,
        span,
        startAcceleration: contactEndWheelState.phaseAcceleration,
        startRate: contactEndWheelState.phaseRate,
        startValue: contactEndWheelState.value,
      });
    } else {
      state = {
        phaseAcceleration: 0,
        phaseRate: 0,
        value: finalWheelAngleForCycle,
      };
    }
    return {
      angle: state.value - cycleIndex * toothPitch,
      angularAcceleration: state.phaseAcceleration / balancePeriod ** 2,
      angularSpeed: state.phaseRate / balancePeriod,
      phaseAcceleration: state.phaseAcceleration,
      phaseRate: state.phaseRate,
      stepProgress: THREE.MathUtils.clamp(
        (initialLockedWheelAngle - state.value) / toothPitch,
        0,
        1,
      ),
    };
  };
  const toothTipAt = (wheelAngle, toothIndex) => {
    const angle = wheelAngle + toothIndex * toothPitch + toothTipOffset;
    return escapeWheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * toothTipRadius,
      Math.sin(angle) * toothTipRadius,
    ));
  };

  const detentLiftAtPhase = (phase) => {
    if (phase <= unlockContactStartPhase || phase >= detentBankPhase) {
      return 0;
    }
    if (phase < releasePhase) {
      return maximumDetentLift * smootherStep01(
        (phase - unlockContactStartPhase)
          / (releasePhase - unlockContactStartPhase),
      );
    }
    return maximumDetentLift * (
      1 - smootherStep01(
        (phase - releasePhase) / (detentBankPhase - releasePhase),
      )
    );
  };
  const returnPassingDeflectionAtPhase = (phase) => {
    if (phase <= returnPassingStartPhase
      || phase >= returnPassingEndPhase) return 0;
    if (phase <= returnPassingCenterPhase) {
      return maximumReturnPassingDeflection * smootherStep01(
        (phase - returnPassingStartPhase)
          / (returnPassingCenterPhase - returnPassingStartPhase),
      );
    }
    return maximumReturnPassingDeflection * (
      1 - smootherStep01(
        (phase - returnPassingCenterPhase)
          / (returnPassingEndPhase - returnPassingCenterPhase),
      )
    );
  };

  const fixedSpringAnchor = sourcePointToModel(sourceRasterSpringRootD);
  const fixedBlockCenter = sourcePointToModel(sourceRasterFixedBlockD);
  const detentNoseBase = sourcePointToModel(sourceRasterDetentNose);
  const passingSpringAnchorBase = sourcePointToModel(
    sourceRasterPassingSpringRootT,
  );
  const passingSpringFreeBase = sourcePointToModel(
    sourceRasterPassingSpringFreeEnd,
  );
  const bankingPinCenter = sourcePointToModel(sourceRasterBankingPinE);
  const bankingPinRadius = 0.11;
  const bankingHeelRadius = 0.08;
  const bankingHeelBase = bankingPinCenter.clone().add(
    lockNormal.clone().multiplyScalar(
      bankingPinRadius + bankingHeelRadius,
    ),
  );
  const detentDisplacementAtLift = (lift) => lockNormal.clone()
    .multiplyScalar(lift);
  // The spring ends at the pipe that carries T, just outside the tip circle,
  // and bows outward past the wheel's widest point (Brown draws D clear of
  // the teeth) instead of inward through the passing tooth tips.
  const detentPipeOffset = 0.20;
  const detentSpringEnd = lockingPoint.clone().addScaledVector(
    lockNormal,
    detentPipeOffset,
  );
  const mainDetentPointsAtLift = (lift, pointCount = 23) => {
    const displacement = detentDisplacementAtLift(lift);
    return Array.from({ length: pointCount }, (_, index) => {
      const progress = index / (pointCount - 1);
      const bendWeight = smootherStep01(progress);
      const point = fixedSpringAnchor.clone().lerp(
        detentSpringEnd,
        progress,
      );
      point.x += 0.16 * Math.sin(Math.PI * progress ** 3.1);
      point.addScaledVector(displacement, bendWeight);
      return new THREE.Vector3(point.x, point.y, -0.02);
    });
  };
  const detentBodyPointsAtLift = (lift, pointCount = 12) => {
    const displacement = detentDisplacementAtLift(lift);
    const start = detentSpringEnd.clone().add(displacement);
    const end = detentNoseBase.clone().addScaledVector(
      displacement,
      1.10,
    );
    return Array.from({ length: pointCount }, (_, index) => {
      const progress = index / (pointCount - 1);
      const point = start.clone().lerp(end, progress);
      point.x += 0.16 * Math.sin(Math.PI * progress);
      return new THREE.Vector3(point.x, point.y, -0.16);
    });
  };
  const passingSpringPointsAtState = ({
    balanceAngle,
    cyclePhase = 0,
    detentLift,
    returnPassingDeflection,
  }, pointCount = 17) => {
    const displacement = detentDisplacementAtLift(detentLift);
    const anchor = passingSpringAnchorBase.clone().addScaledVector(
      displacement,
      0.92,
    );
    const freeAtRestOrUnlock = passingSpringFreeBase.clone().addScaledVector(
      displacement,
      1.08,
    );
    const returnFlexFraction = maximumReturnPassingDeflection > 0
      ? returnPassingDeflection / maximumReturnPassingDeflection
      : 0;
    const jewelPoint = balanceCenter.clone().add(
      rotate2(unlockingJewelLocal, balanceAngle),
    );
    const freeAtReturnContact = jewelPoint.add(
      new THREE.Vector2(-0.12, 0),
    );
    const free = freeAtRestOrUnlock.clone().lerp(
      freeAtReturnContact,
      returnFlexFraction,
    );
    const leafPoints = () => Array.from({ length: pointCount }, (_, index) => {
      const progress = index / (pointCount - 1);
      const point = anchor.clone().lerp(free, progress);
      const flexWeight = Math.sin(progress * Math.PI / 2) ** 2;
      point.x -= returnPassingDeflection * 0.24
        * flexWeight * (1 - progress);
      point.x -= 0.045 * Math.sin(Math.PI * progress)
        * (1 - returnFlexFraction * 0.35);
      return new THREE.Vector3(point.x, point.y, dischargingPlaneZ);
    });
    let points = leafPoints();
    if (returnFlexFraction > 0 || cyclePhase > 0.5) {
      // V is still passing the yielded leaf as the scheduled flex relaxes (it
      // clears only about 12 degrees past the line): on the return half hold
      // the tip out so no leaf segment comes within V's radius plus half the
      // leaf width.  The leaf rests on V, never inside it.
      const jewel = freeAtReturnContact.clone().add(
        new THREE.Vector2(0.12, 0),
      );
      const segmentDistance = (a, b) => {
        const ab = new THREE.Vector2(b.x - a.x, b.y - a.y);
        const t = THREE.MathUtils.clamp(
          ((jewel.x - a.x) * ab.x + (jewel.y - a.y) * ab.y)
            / Math.max(ab.lengthSq(), 1e-12),
          0,
          1,
        );
        return Math.hypot(a.x + ab.x * t - jewel.x, a.y + ab.y * t - jewel.y);
      };
      for (let pass = 0; pass < 16; pass += 1) {
        let nearest = Infinity;
        for (let index = 1; index < points.length; index += 1) {
          nearest = Math.min(
            nearest,
            segmentDistance(points[index - 1], points[index]),
          );
        }
        if (nearest >= returnPassingLeafClearance) break;
        const away = free.clone().sub(jewel).normalize();
        free.addScaledVector(
          away,
          returnPassingLeafClearance - nearest + 0.001,
        );
        points = leafPoints();
      }
    }
    return points;
  };

  const unlockingJewelLocal = sourcePointToModel(
    sourceRasterUnlockingJewelV,
  ).sub(balanceCenter);
  // V's circle reaches about 0.025 inside the resting leaf tip, so on the acting
  // vibration it meets TV about 11 degrees before the dead point, earlier
  // than the nominal 5-degree schedule.  From that first touch the detent is
  // lifted at least as far as keeps the leaf resting on V (V's radius plus
  // half the leaf width); V slips off the tip just before the dead point,
  // where the prescribed lift has already caught up.
  const actingContactLiftAtPhase = (phase) => {
    if (phase <= 0.2 || phase >= releasePhase) return 0;
    const balanceAngle = balanceAngleAtPhase(phase);
    const jewel = balanceCenter.clone().add(
      rotate2(unlockingJewelLocal, balanceAngle),
    );
    const clearanceAtLift = (lift) => {
      const points = passingSpringPointsAtState({
        balanceAngle,
        detentLift: lift,
        returnPassingDeflection: 0,
      });
      let nearest = Infinity;
      for (let index = 1; index < points.length; index += 1) {
        const a = points[index - 1];
        const b = points[index];
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const t = THREE.MathUtils.clamp(
          ((jewel.x - a.x) * abx + (jewel.y - a.y) * aby)
            / Math.max(abx * abx + aby * aby, 1e-12),
          0,
          1,
        );
        nearest = Math.min(
          nearest,
          Math.hypot(a.x + abx * t - jewel.x, a.y + aby * t - jewel.y),
        );
      }
      return nearest;
    };
    if (clearanceAtLift(0) >= actingLeafClearance) return 0;
    let low = 0;
    let high = maximumDetentLift * 1.5;
    if (clearanceAtLift(high) < actingLeafClearance) return 0;
    for (let step = 0; step < 32; step += 1) {
      const middle = (low + high) / 2;
      if (clearanceAtLift(middle) >= actingLeafClearance) high = middle;
      else low = middle;
    }
    return high;
  };
  const stateAtTime = (time) => {
    const cycleCoordinate = time / balancePeriod;
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const balanceAngle = balanceAngleAtPhase(cyclePhase);
    const balanceAngularSpeed = balancePhaseRateAtPhase(cyclePhase)
      / balancePeriod;
    const balanceAngularAcceleration = balancePhaseAccelerationAtPhase(
      cyclePhase,
    ) / balancePeriod ** 2;
    const wheel = wheelMotionAtCyclePhase(cycleIndex, cyclePhase);
    const detentLift = Math.max(
      detentLiftAtPhase(cyclePhase),
      actingContactLiftAtPhase(cyclePhase),
    );
    const returnPassingDeflection = returnPassingDeflectionAtPhase(
      cyclePhase,
    );
    const actingUnlockContact = cyclePhase >= unlockContactStartPhase
      && cyclePhase <= detentBankPhase;
    const returnPassing = cyclePhase >= returnPassingStartPhase
      && cyclePhase <= returnPassingEndPhase;
    const impulseContactActive = cyclePhase >= impulseStartPhase
      && cyclePhase <= impulseEndPhase;
    const wheelUnlocked = cyclePhase >= releasePhase
      && cyclePhase < relockPhase;
    const wheelLocked = !wheelUnlocked;
    const lockingToothIndex = wheelLocked
      ? positiveModulo(
        cycleIndex + (cyclePhase >= relockPhase ? 1 : 0),
        toothCount,
      )
      : null;
    const lockingToothPoint = wheelLocked
      ? toothTipAt(wheel.angle, lockingToothIndex)
      : null;
    const impulseToothIndex = positiveModulo(
      cycleIndex + impulseToothOffset,
      toothCount,
    );
    const impulseToothPoint = impulseContactActive
      ? toothTipAt(wheel.angle, impulseToothIndex)
      : null;
    const unlockingJewelPoint = balanceCenter.clone().add(
      rotate2(unlockingJewelLocal, balanceAngle),
    );
    let impulseContact = null;
    if (impulseContactActive) {
      const expected = contactGeometryAtPhase(cyclePhase);
      const wheelRadiusVector = impulseToothPoint.clone().sub(
        escapeWheelCenter,
      );
      const balanceRadiusVector = impulseToothPoint.clone().sub(
        balanceCenter,
      );
      const toothVelocity = crossZ(wheelRadiusVector)
        .multiplyScalar(wheel.angularSpeed);
      const palletMaterialVelocity = crossZ(balanceRadiusVector)
        .multiplyScalar(balanceAngularSpeed);
      const relativeVelocity = toothVelocity.clone().sub(
        palletMaterialVelocity,
      );
      const faceTangent = expected.direction.clone();
      const faceNormal = crossZ(faceTangent);
      impulseContact = {
        expectedPoint: expected.point,
        faceNormal,
        faceTangent,
        normalVelocityError: relativeVelocity.dot(faceNormal),
        palletMaterialVelocity,
        palletRadius: expected.palletRadius,
        pointError: impulseToothPoint.distanceTo(expected.point),
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
        toothVelocity,
      };
    }
    let stage = 'fully-detached-balance-with-wheel-locked-at-T';
    if (actingUnlockContact && cyclePhase < releasePhase) {
      stage = 'V-backs-passing-spring-against-detent-and-unlocks-T';
    } else if (wheelUnlocked && cyclePhase < impulseStartPhase) {
      stage = 'A-starts-from-rest-and-overtakes-radial-pallet-P';
    } else if (impulseContactActive) {
      stage = 'A-gives-the-sole-direct-impulse-on-pallet-P';
    } else if (wheelUnlocked) {
      stage = 'B-drops-to-returned-detent-at-T';
    } else if (returnPassing) {
      stage = 'returning-V-flexes-gold-spring-without-moving-detent';
    }
    return {
      actingUnlockContact,
      balanceAngle,
      balanceAngularAcceleration,
      balanceAngularSpeed,
      balanceDetached: !actingUnlockContact
        && !returnPassing
        && !impulseContactActive,
      cycleIndex,
      cyclePhase,
      detentAgainstBankingPin: detentLift === 0,
      detentLift,
      impulseContact,
      impulseContactActive,
      impulseToothIndex,
      impulseToothPoint,
      lockingPointError: wheelLocked
        ? lockingToothPoint.distanceTo(lockingPoint)
        : null,
      lockingToothIndex,
      lockingToothPoint,
      returnPassing,
      returnPassingDeflection,
      soleImpulsePallet: impulseContactActive ? 'P' : null,
      stage,
      stepProgress: wheel.stepProgress,
      unlockingJewelPoint,
      wheelAngle: wheel.angle,
      wheelAngularAcceleration: wheel.angularAcceleration,
      wheelAngularSpeed: wheel.angularSpeed,
      wheelLocked,
      wheelUnlocked,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * balancePeriod,
  );

  const wheelMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const balanceMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const detentMaterial = matte(PALETTE.accent, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const passingSpringMaterial = matte(PALETTE.brass, {
    metalness: 0.34,
    roughness: 0.40,
  });
  // Jewels read as plain set stones on the plate, not white markers.
  const jewelMaterial = matte(PALETTE.muted, {
    metalness: 0.10,
    roughness: 0.38,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });

  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(
    escapeWheelCenter.x,
    escapeWheelCenter.y,
    escapeWheelPlaneZ,
  );
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role =
    'clockwise-fifteen-tooth-common-chronometer-escape-wheel';
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role =
    'single-wheel-rotor-whose-long-teeth-both-lock-and-impulse';
  escapeWheel.add(wheelRotor);

  // Brown draws a flat wheel: a narrow rim and four broad crossings leaving
  // rounded quadrant windows, not a round-wire rim on thin spokes.
  const wheelWebShape = new THREE.Shape();
  for (let step = 0; step < 120; step += 1) {
    const angle = FULL_TURN * step / 120;
    const x = Math.cos(angle) * (wheelRootRadius + 0.02);
    const y = Math.sin(angle) * (wheelRootRadius + 0.02);
    if (step === 0) wheelWebShape.moveTo(x, y);
    else wheelWebShape.lineTo(x, y);
  }
  wheelWebShape.closePath();
  const crossingHalfWidth = 0.17;
  const windowOuterRadius = wheelRootRadius * 0.80;
  const windowCorner = 0.12;
  for (let quadrant = 0; quadrant < 4; quadrant += 1) {
    const turn = quadrant * Math.PI / 2;
    const local = [
      ...Array.from({ length: 17 }, (_, sample) => {
        const angle = THREE.MathUtils.lerp(
          Math.asin(crossingHalfWidth / windowOuterRadius),
          Math.PI / 2 - Math.asin(crossingHalfWidth / windowOuterRadius),
          sample / 16,
        );
        return new THREE.Vector2(
          Math.cos(angle) * windowOuterRadius,
          Math.sin(angle) * windowOuterRadius,
        );
      }),
      new THREE.Vector2(crossingHalfWidth, crossingHalfWidth + windowCorner),
      new THREE.Vector2(crossingHalfWidth + windowCorner, crossingHalfWidth),
    ].map((point) => rotate2(point, turn));
    const window = new THREE.Path();
    window.moveTo(local[0].x, local[0].y);
    for (const point of local.slice(1)) window.lineTo(point.x, point.y);
    window.closePath();
    wheelWebShape.holes.push(window);
  }
  const wheelHubOpening = new THREE.Path();
  for (let step = 0; step < 48; step += 1) {
    const angle = -FULL_TURN * step / 48;
    if (step === 0) wheelHubOpening.moveTo(0.24, 0);
    else wheelHubOpening.lineTo(Math.cos(angle) * 0.24, Math.sin(angle) * 0.24);
  }
  wheelHubOpening.closePath();
  wheelWebShape.holes.push(wheelHubOpening);
  const wheelRim = new THREE.Mesh(
    centeredExtrusion(wheelWebShape, 0.26, 0.006),
    wheelMaterial,
  );
  wheelRim.userData.role = 'flat-escape-wheel-web-with-four-crossings';
  wheelRotor.add(wheelRim);
  // Brown draws each long tooth with a short, slightly undercut locking and
  // impulse face: its root trails the tip.  A forward-raked face would lead
  // the tip into P, so the tooth flank rather than the tip met the jewel as
  // A caught P.  The long back runs on to the next tooth's face root.
  const toothFaceRootAngle = toothTipOffset + toothPitch * 0.07;
  const escapeTeeth = [];
  for (let index = 0; index < toothCount; index += 1) {
    const centerAngle = index * toothPitch;
    const toothShape = polygonShape([
      new THREE.Vector2(
        Math.cos(centerAngle + toothFaceRootAngle) * wheelRootRadius,
        Math.sin(centerAngle + toothFaceRootAngle) * wheelRootRadius,
      ),
      new THREE.Vector2(
        Math.cos(centerAngle + toothTipOffset) * toothTipRadius,
        Math.sin(centerAngle + toothTipOffset) * toothTipRadius,
      ),
      new THREE.Vector2(
        Math.cos(centerAngle + toothPitch * 0.16) * wheelCrownRadius,
        Math.sin(centerAngle + toothPitch * 0.16) * wheelCrownRadius,
      ),
      new THREE.Vector2(
        Math.cos(centerAngle + toothFaceRootAngle + toothPitch)
          * wheelRootRadius,
        Math.sin(centerAngle + toothFaceRootAngle + toothPitch)
          * wheelRootRadius,
      ),
    ]);
    const tooth = new THREE.Mesh(
      centeredExtrusion(toothShape, wheelDepth, 0.006),
      wheelMaterial,
    );
    tooth.userData.role = `common-long-escape-tooth-${index + 1}-of-15`;
    tooth.userData.toothIndex = index;
    escapeTeeth.push(tooth);
    wheelRotor.add(tooth);
  }
  const wheelSpokes = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = index * FULL_TURN / 4;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(
        wheelRootRadius * 1.62,
        0.16,
        wheelDepth * 0.72,
      ),
      wheelMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * wheelRootRadius * 0.39,
      Math.sin(angle) * wheelRootRadius * 0.39,
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `escape-wheel-spoke-${index + 1}-of-4`;
    wheelSpokes.push(spoke);
    wheelRotor.add(spoke);
  }
  const wheelHub = cylinderAlongZ(0.25, 0.70, darkMaterial, 34);
  wheelHub.userData.role = 'escape-wheel-arbor-hub';
  const wheelIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 16, 12),
    jewelMaterial,
  );
  wheelIndex.position.set(0.82, 0, wheelDepth / 2 + 0.07);
  wheelIndex.userData.role = 'visible-index-on-clockwise-escape-wheel';
  wheelRotor.add(wheelHub, wheelIndex);
  const wheelShaft = cylinderAlongZ(0.105, 1.10, darkMaterial, 30);
  wheelShaft.userData.role = 'fixed-escape-wheel-arbor';
  escapeWheel.add(wheelShaft);

  const balanceRotor = new THREE.Group();
  balanceRotor.position.set(balanceCenter.x, balanceCenter.y, 0);
  balanceRotor.userData.axis = Z_AXIS.clone();
  balanceRotor.userData.role =
    'balance-staff-carrying-separate-impulse-and-discharging-rollers';
  const impulseRollerGapHalfAngle = THREE.MathUtils.degToRad(28);
  const impulseRollerArcStart = impulsePalletLocalAngle
    + impulseRollerGapHalfAngle;
  const impulseRollerArc = FULL_TURN - 2 * impulseRollerGapHalfAngle;
  const impulseRollerRim = new THREE.Mesh(
    new THREE.TorusGeometry(
      impulseRollerRadius,
      0.10,
      10,
      84,
      impulseRollerArc,
    ),
    balanceMaterial,
  );
  impulseRollerRim.position.z = impulsePlaneZ;
  impulseRollerRim.rotation.z = impulseRollerArcStart;
  impulseRollerRim.userData.role =
    'impulse-roller-with-crescent-tooth-passage';
  balanceRotor.add(impulseRollerRim);
  const impulseRollerSpokes = [];
  for (const [index, angleOffset] of [
    THREE.MathUtils.degToRad(72),
    THREE.MathUtils.degToRad(180),
    THREE.MathUtils.degToRad(288),
  ].entries()) {
    const angle = impulsePalletLocalAngle + angleOffset;
    const spoke = beamBetween(
      new THREE.Vector3(
        Math.cos(angle) * 0.30,
        Math.sin(angle) * 0.30,
        impulsePlaneZ,
      ),
      new THREE.Vector3(
        Math.cos(angle) * (impulseRollerRadius - 0.08),
        Math.sin(angle) * (impulseRollerRadius - 0.08),
        impulsePlaneZ,
      ),
      0.10,
      0.16,
      balanceMaterial,
    );
    spoke.userData.role = `impulse-roller-spoke-${index + 1}-of-3`;
    impulseRollerSpokes.push(spoke);
    balanceRotor.add(spoke);
  }
  const impulseRollerHub = cylinderAlongZ(
    0.30,
    0.22,
    balanceMaterial,
    34,
  );
  impulseRollerHub.position.z = impulsePlaneZ;
  impulseRollerHub.userData.role = 'impulse-roller-hub';

  const contactStartGeometry = contactGeometryAtPhase(
    impulseStartPhase,
  );
  const contactEndGeometry = contactGeometryAtPhase(impulseEndPhase);
  const palletInnerRadius = Math.min(
    contactStartGeometry.palletRadius,
    contactEndGeometry.palletRadius,
  ) - 0.06;
  // Retain the complete sliding impulse face plus .02 end allowance. The
  // previous .06 extension entered the locked tooth's return-clearance circle;
  // with the full .15 transverse thickness, this outer corner clears that circle.
  const palletOuterRadius = Math.max(
    contactStartGeometry.palletRadius,
    contactEndGeometry.palletRadius,
  ) + 0.02;
  const palletNormalLocal = crossZ(impulsePalletLocalDirection);
  const palletHalfWidth = 0.075;
  const impulsePalletShape = polygonShape([
    impulsePalletLocalDirection.clone().multiplyScalar(palletInnerRadius)
      .addScaledVector(palletNormalLocal, -palletHalfWidth),
    impulsePalletLocalDirection.clone().multiplyScalar(palletOuterRadius)
      .addScaledVector(palletNormalLocal, -palletHalfWidth),
    impulsePalletLocalDirection.clone().multiplyScalar(palletOuterRadius)
      .addScaledVector(palletNormalLocal, palletHalfWidth),
    impulsePalletLocalDirection.clone().multiplyScalar(palletInnerRadius)
      .addScaledVector(palletNormalLocal, palletHalfWidth),
  ]);
  const impulsePallet = new THREE.Group();
  impulsePallet.userData.role =
    'sole-radial-jewel-impulse-pallet-P';
  impulsePallet.userData.faceIsRadial = true;
  const impulsePalletArm = beamBetween(
    new THREE.Vector3(
      impulsePalletLocalDirection.x * 0.27,
      impulsePalletLocalDirection.y * 0.27,
      impulsePlaneZ,
    ),
    new THREE.Vector3(
      impulsePalletLocalDirection.x * palletInnerRadius,
      impulsePalletLocalDirection.y * palletInnerRadius,
      impulsePlaneZ,
    ),
    0.13,
    0.15,
    balanceMaterial,
  );
  impulsePalletArm.userData.role =
    'rigid-impulse-roller-arm-carrying-pallet-P';
  const impulsePalletBody = new THREE.Mesh(
    centeredExtrusion(impulsePalletShape, 0.22, 0.005),
    jewelMaterial,
  );
  impulsePalletBody.position.z = impulsePlaneZ;
  impulsePalletBody.userData.role = 'radial-jewel-P-solid';
  const impulsePalletFace = beamBetween(
    new THREE.Vector3(
      impulsePalletLocalDirection.x * palletInnerRadius,
      impulsePalletLocalDirection.y * palletInnerRadius,
      impulsePlaneZ + 0.13,
    ),
    new THREE.Vector3(
      impulsePalletLocalDirection.x * palletOuterRadius,
      impulsePalletLocalDirection.y * palletOuterRadius,
      impulsePlaneZ + 0.13,
    ),
    0.045,
    0.045,
    jewelMaterial,
  );
  impulsePalletFace.userData.role =
    'visible-radial-working-face-of-pallet-P';
  impulsePallet.add(
    impulsePalletArm,
    impulsePalletBody,
    impulsePalletFace,
  );

  const dischargingRoller = cylinderAlongZ(
    dischargingRollerRadius,
    0.16,
    balanceMaterial,
    42,
  );
  dischargingRoller.position.z = dischargingPlaneZ;
  dischargingRoller.userData.role =
    'lower-discharging-roller-beneath-impulse-roller';
  const unlockingJewelArm = beamBetween(
    new THREE.Vector3(0, 0, dischargingPlaneZ),
    new THREE.Vector3(
      unlockingJewelLocal.x,
      unlockingJewelLocal.y,
      dischargingPlaneZ,
    ),
    0.085,
    0.12,
    balanceMaterial,
  );
  unlockingJewelArm.userData.role =
    'discharging-roller-arm-to-jewel-V';
  // Radius 0.08 so the yielded gold spring tip, held 0.12 from V's axis on
  // the return passage, clears the jewel instead of cutting into it, and the
  // backed leaf still clears V at the dead point where the wheel releases.
  const unlockingJewelV = cylinderAlongZ(
    0.08,
    0.24,
    jewelMaterial,
    24,
  );
  unlockingJewelV.position.set(
    unlockingJewelLocal.x,
    unlockingJewelLocal.y,
    dischargingPlaneZ,
  );
  unlockingJewelV.userData.role =
    'one-way-unlocking-jewel-V-on-discharging-roller';
  const balanceIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 16, 12),
    jewelMaterial,
  );
  balanceIndex.position.set(
    Math.cos(impulsePalletLocalAngle + Math.PI) * 0.77,
    Math.sin(impulsePalletLocalAngle + Math.PI) * 0.77,
    impulsePlaneZ + 0.14,
  );
  balanceIndex.userData.role = 'visible-index-on-balance-roller';
  const balanceShaft = cylinderAlongZ(0.105, 1.08, darkMaterial, 30);
  balanceShaft.userData.role = 'balance-staff-through-both-rollers';
  // Brown draws the roller as a plain disc whose edge runs out to pallet P,
  // with a V notch at P; the open ring and its spokes are not drawn. The
  // disc sits behind the wheel and detent so the working planes are unchanged.
  const rollerDiscRadius = palletOuterRadius + 0.03;
  const rollerNotchHalfAngle = THREE.MathUtils.degToRad(22);
  const rollerDiscShape = new THREE.Shape();
  const rollerNotchStart = impulsePalletLocalAngle + rollerNotchHalfAngle;
  const rollerDiscSteps = 72;
  for (let step = 0; step <= rollerDiscSteps; step += 1) {
    const angle = rollerNotchStart
      + (FULL_TURN - 2 * rollerNotchHalfAngle) * step / rollerDiscSteps;
    const point = new THREE.Vector2(
      Math.cos(angle) * rollerDiscRadius,
      Math.sin(angle) * rollerDiscRadius,
    );
    if (step === 0) rollerDiscShape.moveTo(point.x, point.y);
    else rollerDiscShape.lineTo(point.x, point.y);
  }
  rollerDiscShape.lineTo(
    Math.cos(impulsePalletLocalAngle) * palletInnerRadius * 0.92,
    Math.sin(impulsePalletLocalAngle) * palletInnerRadius * 0.92,
  );
  rollerDiscShape.closePath();
  const rollerDisc = new THREE.Mesh(
    centeredExtrusion(rollerDiscShape, 0.08, 0.004),
    balanceMaterial,
  );
  rollerDisc.position.z = -0.49;
  rollerDisc.userData.role = 'plain-notched-roller-disc-behind-working-planes';
  balanceRotor.add(
    rollerDisc,
    impulseRollerHub,
    impulsePallet,
    dischargingRoller,
    unlockingJewelArm,
    unlockingJewelV,
    balanceIndex,
    balanceShaft,
  );

  const mainDetentSpring = createSegmentedLeaf({
    count: 22,
    depth: 0.18,
    material: detentMaterial,
    role: 'frictionless-stiff-spring-detent-fixed-at-D',
    width: 0.095,
  });
  const detentBody = createSegmentedLeaf({
    count: 11,
    depth: 0.20,
    material: detentMaterial,
    role: 'rigid-detent-body-and-one-way-backing-nose',
    width: 0.13,
  });
  const passingSpring = createSegmentedLeaf({
    count: 16,
    depth: 0.09,
    material: passingSpringMaterial,
    role: 'gold-one-way-passing-spring-TV',
    width: 0.052,
  });
  const lockingStoneT = new THREE.Mesh(
    new THREE.BoxGeometry(0.29, 0.13, 0.32),
    jewelMaterial,
  );
  lockingStoneT.rotation.z = lockAngle + Math.PI / 2
    - lockingDrawAngle;
  lockingStoneT.userData.role =
    'undercut-ten-degree-jewel-locking-pallet-T';
  const lockingPipe = new THREE.Mesh(
    new THREE.TorusGeometry(0.15, 0.045, 9, 36),
    detentMaterial,
  );
  lockingPipe.userData.role = 'detent-pipe-carrying-locking-stone-T';
  const bankingHeel = cylinderAlongZ(
    bankingHeelRadius,
    0.50,
    detentMaterial,
    24,
  );
  bankingHeel.userData.role = 'moving-detent-heel-banked-at-E';
  // Bank E sits inside the tooth-tip circle, so it stands behind the wheel
  // (z -0.62..-0.22, the wheel's back face is -0.18) and the heel reaches
  // back from the detent to meet it.
  const bankingPinE = cylinderAlongZ(
    bankingPinRadius,
    0.40,
    darkMaterial,
    26,
  );
  bankingPinE.position.set(
    bankingPinCenter.x,
    bankingPinCenter.y,
    -0.42,
  );
  bankingPinE.userData.fixed = true;
  bankingPinE.userData.role = 'fixed-banking-stop-E';

  const fixedBlockD = new THREE.Group();
  fixedBlockD.position.set(
    fixedBlockCenter.x,
    fixedBlockCenter.y,
    -0.04,
  );
  fixedBlockD.userData.fixed = true;
  fixedBlockD.userData.role = 'fixed-watch-frame-block-D';
  const detentClamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.52, 0.46),
    frameMaterial,
  );
  detentClamp.userData.role = 'block-D-clamping-spring-detent';
  const detentClampScrew = cylinderAlongZ(
    0.115,
    0.62,
    darkMaterial,
    28,
  );
  detentClampScrew.userData.role = 'block-D-clamp-screw';
  fixedBlockD.add(detentClamp, detentClampScrew);

  const lockMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 16, 12),
    jewelMaterial,
  );
  lockMarker.userData.role = 'visible-contact-marker-at-lock-T';
  const impulseMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 16, 12),
    jewelMaterial,
  );
  impulseMarker.userData.role =
    'visible-contact-marker-at-sole-impulse-pallet-P';

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-watch-frame-supporting-two-arbors-and-detent-D';
  const frameBase = beamBetween(
    new THREE.Vector3(-4.35, -4.25, -0.86),
    new THREE.Vector3(2.55, -4.25, -0.86),
    0.22,
    0.54,
    frameMaterial,
  );
  frameBase.userData.role = 'fixed-watch-frame-base';
  const wheelStandard = beamBetween(
    new THREE.Vector3(escapeWheelCenter.x, -4.25, -0.86),
    new THREE.Vector3(
      escapeWheelCenter.x,
      escapeWheelCenter.y,
      -0.86,
    ),
    0.18,
    0.20,
    frameMaterial,
  );
  wheelStandard.userData.role = 'escape-wheel-arbor-standard';
  const balanceStandard = beamBetween(
    new THREE.Vector3(balanceCenter.x, -4.25, -0.86),
    new THREE.Vector3(balanceCenter.x, balanceCenter.y, -0.86),
    0.18,
    0.20,
    frameMaterial,
  );
  balanceStandard.userData.role = 'balance-staff-standard';
  const wheelBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.29, 0.07, 9, 38),
    frameMaterial,
  );
  wheelBearing.position.set(
    escapeWheelCenter.x,
    escapeWheelCenter.y,
    -0.58,
  );
  wheelBearing.userData.role = 'fixed-escape-wheel-bearing';
  const balanceBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.07, 9, 38),
    frameMaterial,
  );
  balanceBearing.position.set(
    balanceCenter.x,
    balanceCenter.y,
    -0.58,
  );
  balanceBearing.userData.role = 'fixed-balance-staff-bearing';
  fixedFrame.add(
    frameBase,
    wheelStandard,
    balanceStandard,
    wheelBearing,
    balanceBearing,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(8.8, 8.9, 2.8),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-0.72, -0.05, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-common-chronometer-escapement';

  root.add(
    cameraEnvelope,
    fixedFrame,
    escapeWheel,
    balanceRotor,
    mainDetentSpring,
    detentBody,
    passingSpring,
    lockingStoneT,
    lockingPipe,
    bankingHeel,
    bankingPinE,
    fixedBlockD,
    lockMarker,
    impulseMarker,
  );

  const canonicalPhases = {
    actingUnlockStart: unlockContactStartPhase,
    detachedAtPositiveExtreme: 0.5,
    detentBanked: detentBankPhase,
    impulseEnd: impulseEndPhase,
    impulseStart: impulseStartPhase,
    relockedAtT: relockPhase,
    returnPassing: returnPassingCenterPhase,
    toothRelease: releasePhase,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalPhases).map(([name, phase]) => [
      name,
      stateAtCyclePhase(phase),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    balanceRotor.rotation.z = state.balanceAngle;
    balanceRotor.userData.angularAcceleration =
      state.balanceAngularAcceleration;
    balanceRotor.userData.angularSpeed = state.balanceAngularSpeed;
    wheelRotor.rotation.z = state.wheelAngle;
    wheelRotor.userData.angularAcceleration =
      state.wheelAngularAcceleration;
    wheelRotor.userData.angularSpeed = state.wheelAngularSpeed;

    updateSegmentedLeaf(
      mainDetentSpring,
      mainDetentPointsAtLift(state.detentLift),
    );
    updateSegmentedLeaf(
      detentBody,
      detentBodyPointsAtLift(state.detentLift),
    );
    updateSegmentedLeaf(
      passingSpring,
      passingSpringPointsAtState(state),
    );
    const detentDisplacement = detentDisplacementAtLift(
      state.detentLift,
    );
    const movingLockPoint = lockingPoint.clone().add(
      detentDisplacement,
    );
    lockingStoneT.position.set(
      movingLockPoint.x,
      movingLockPoint.y,
      0.08,
    );
    lockingPipe.position.set(
      movingLockPoint.x + lockNormal.x * detentPipeOffset,
      movingLockPoint.y + lockNormal.y * detentPipeOffset,
      -0.15,
    );
    const movingHeelPoint = bankingHeelBase.clone().addScaledVector(
      detentDisplacement,
      0.76,
    );
    bankingHeel.position.set(
      movingHeelPoint.x,
      movingHeelPoint.y,
      -0.33,
    );

    lockMarker.visible = state.wheelLocked;
    if (state.wheelLocked) {
      lockMarker.position.set(
        state.lockingToothPoint.x,
        state.lockingToothPoint.y,
        wheelDepth / 2 + 0.08,
      );
    }
    impulseMarker.visible = state.impulseContactActive;
    if (state.impulseContactActive) {
      impulseMarker.position.set(
        state.impulseToothPoint.x,
        state.impulseToothPoint.y,
        impulsePlaneZ + 0.18,
      );
    }
    root.userData.contacts = {
      banking: state.detentAgainstBankingPin
        ? {
          gap: bankingHeelBase.distanceTo(bankingPinCenter)
            - bankingHeelRadius - bankingPinRadius,
          stop: 'E',
        }
        : null,
      impulse: state.impulseContactActive
        ? {
          normalVelocityError:
            state.impulseContact.normalVelocityError,
          pallet: 'P',
          pointError: state.impulseContact.pointError,
          relativeSlipSpeed: state.impulseContact.relativeSlipSpeed,
          toothIndex: state.impulseToothIndex,
        }
        : null,
      lock: state.wheelLocked
        ? {
          pointError: state.lockingPointError,
          station: 'T',
          toothIndex: state.lockingToothIndex,
        }
        : null,
      mode: state.impulseContactActive
        ? 'sole-direct-impulse-at-P'
        : state.wheelLocked
          ? 'locked-at-T'
          : 'unlocked-flight',
    };
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    'earnshaw-fifteen-tooth-spring-detent-radial-pallet-single-impulse-chronometer-escapement';
  root.userData.mechanism =
    'Earnshaw’s common spring detent is fixed without a pivot at block D: during the counterclockwise acting vibration jewel V backs gold passing spring TV against the detent nose, lifts locking jewel T, and frees the fifteen-tooth escape wheel from rest; tooth A then gives the only impulse directly to radial jewel pallet P, the detent immediately returns to banking stop E, and successor tooth B locks at T; on the clockwise return vibration V bends the passing spring away without moving the detent or escape wheel';
  root.userData.presentation =
    'The impulse roller and radial pallet P occupy the escape-wheel plane, while the smaller discharging roller, jewel V, and gold passing spring are visibly separated below it on the shared balance staff; no separate inner impulse pins are invented because the same fifteen long teeth perform locking and impulse.';
  root.userData.transmission = {
    balanceInteraction: 'one direct impulse at P per complete balance cycle; the opposite vibration is dumb except for the yielding gold passing spring',
    direction: 'escape wheel advances clockwise by one 24-degree tooth pitch per complete balance oscillation',
    impulsesPerBalanceCycle: 1,
    nextLockToothOffset,
    returnPass: 'V flexes the gold passing spring alone while the detent remains banked at E and the wheel remains locked at T',
    toothCount,
    vibrationsPerImpulse: 2,
    wheelAdvancePerBalanceCycleDegrees: 360 / toothCount,
    wheelRevolutionsPerBalanceCycle: 1 / toothCount,
  };
  root.userData.blocks = {
    balanceBearing,
    balanceIndex,
    balanceRotor,
    balanceShaft,
    balanceStandard,
    bankingHeel,
    bankingPinE,
    cameraEnvelope,
    detentBody,
    detentClamp,
    detentClampScrew,
    dischargingRoller,
    escapeTeeth,
    escapeWheel,
    fixedBlockD,
    fixedFrame,
    frameBase,
    impulseMarker,
    impulsePallet,
    impulsePalletArm,
    impulsePalletBody,
    impulsePalletFace,
    impulseRollerHub,
    impulseRollerRim,
    impulseRollerSpokes,
    lockMarker,
    lockingPipe,
    lockingStoneT,
    mainDetentSpring,
    passingSpring,
    unlockingJewelArm,
    unlockingJewelV,
    wheelBearing,
    wheelHub,
    wheelIndex,
    wheelRim,
    wheelRotor,
    wheelShaft,
    wheelSpokes,
    wheelStandard,
  };
  root.userData.canonicalPhases = canonicalPhases;
  root.userData.canonicalStates = canonicalStates;
  root.userData.contactGeometryAtPhase = contactGeometryAtPhase;
  root.userData.detentBodyPointsAtLift = detentBodyPointsAtLift;
  root.userData.geometry = {
    balanceAmplitude,
    balanceCenter: balanceCenter.clone(),
    balancePeriod,
    bankingHeelBase: bankingHeelBase.clone(),
    bankingHeelRadius,
    bankingPinCenter: bankingPinCenter.clone(),
    bankingPinRadius,
    centerDistance,
    centerLineAngle,
    detentBankPhase,
    disengagingDropBalanceAngle,
    dischargingPlaneZ,
    dischargingRollerRadius,
    documentedVibrationArc,
    engagingDropBalanceAngle,
    escapeWheelCenter: escapeWheelCenter.clone(),
    escapeWheelPlaneZ,
    escapeWheelRadiusToCenterDistance,
    fixedBlockCenter: fixedBlockCenter.clone(),
    fixedSpringAnchor: fixedSpringAnchor.clone(),
    impulseBalanceAngle,
    impulseEndPhase,
    impulsePalletLocalAngle,
    impulsePlaneZ,
    impulseRollerArc,
    impulseRollerArcStart,
    impulseRollerDiameterToEscapeWheelDiameter,
    impulseRollerGapHalfAngle,
    impulseRollerRadius,
    impulseStartPhase,
    initialLockedWheelAngle,
    lockAngle,
    lockingDrawAngle,
    lockingPoint: lockingPoint.clone(),
    maximumDetentLift,
    maximumReturnPassingDeflection,
    palletInnerRadius,
    palletOuterRadius,
    physicalVibrationsPerSecond,
    releasePhase,
    relockPhase,
    returnPassingCenterPhase,
    returnPassingEndPhase,
    returnPassingStartPhase,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    toothCount,
    toothPitch,
    toothTipOffset,
    toothTipRadius,
    unlockContactStartPhase,
    unlockingJewelLocal: unlockingJewelLocal.clone(),
    unlockingTravelAngle,
    wheelCrownRadius,
    wheelDepth,
    wheelRootRadius,
  };
  root.userData.mainDetentPointsAtLift = mainDetentPointsAtLift;
  root.userData.passingSpringPointsAtState = passingSpringPointsAtState;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official movement 313 page marks its Animated tab unavailable.',
    referenceScope: 'Brown and Denison establish member topology, clockwise tooth order T-B-A, one-way passing-spring action, and sole direct impulse at P. Fritts supplies the fifteen-tooth count, 65:100 wheel-to-center ratio, half-diameter impulse roller, 430-degree vibration arc, 5-degree unlocking travel, 10-degree engaging drop, and approximately 15-degree impulse contact. Elastic deflection magnitudes and the C2 flight timing are independently reconstructed.',
    sourceUrl: 'https://507movements.com/mm_313.html',
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    brownPlate313: {
      countedToothCount: sourceCountedToothCount,
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'fifteen clockwise long teeth share locking and impulse; T is presently locked, B is the next locking tooth, A is the following impulse tooth, P is the sole pallet, and V works spring TV beside bank E and fixed block D',
      measurementUncertaintyPixels: 7,
      rasterBalanceCenter: sourceRasterBalanceCenter.clone(),
      rasterBankingPinE: sourceRasterBankingPinE.clone(),
      rasterDetentNose: sourceRasterDetentNose.clone(),
      rasterDirectionArrowTip: sourceRasterDirectionArrowTip.clone(),
      rasterFixedBlockD: sourceRasterFixedBlockD.clone(),
      rasterImpulsePalletP: sourceRasterImpulsePalletP.clone(),
      rasterLockingPalletT: sourceRasterLockingPalletT.clone(),
      rasterPassingSpringFreeEnd:
        sourceRasterPassingSpringFreeEnd.clone(),
      rasterPassingSpringRootT:
        sourceRasterPassingSpringRootT.clone(),
      rasterSpringRootD: sourceRasterSpringRootD.clone(),
      rasterUnlockingJewelV: sourceRasterUnlockingJewelV.clone(),
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
      rasterWheelTip: sourceRasterWheelTip.clone(),
      schematicScaleNotice: 'Brown’s plate fixes layout and labels; Fritts’s stated construction ratios govern the working center distance and roller size.',
    },
    denisonTreatise: {
      author: 'Edmund Beckett Denison',
      edition: 2,
      figure: 32,
      pages: [165, 166, 167, 168],
      publicationYear: 1857,
      title: 'Clocks and Locks, from the Encyclopaedia Britannica',
      timingEvidence: 'P must be set farther back because the unlocked escape wheel starts from rest; A must catch P rather than find it geometrically aligned at release.',
      topologyEvidence: 'V unlocks spring detent DT from T; A impulses P; the detent immediately banks at E for B; TV yields only on the return pass; the same long teeth normally lock and impulse.',
    },
    frittsManual: {
      author: 'Charles Edgar Fritts',
      edition: 3,
      publicationYear: 1904,
      sections: [477, 478, 482, 484, 485, 486, 495, 497, 501, 502, 505],
      title: "The Watch Adjuster's Manual",
      verifiedConstruction: 'marine rate four vibrations per second; 430-degree full vibration; V takes about 5 degrees to unlock; engaging drop about 10 degrees; direct impulse about 15 degrees in the worked allowance; fifteen-tooth wheel radius 65 percent of center distance; impulse-roller diameter half the escape-wheel diameter; locking draw about 10 degrees',
    },
    officialDescription: movement.description,
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
    physicalVibrationsPerSecond,
    schedule: [
      'counterclockwise-V-backs-TV-against-detent',
      'T-unlocks-and-A-starts-from-rest',
      'ten-degree-engaging-drop-until-A-catches-P',
      'sole-direct-impulse-on-radial-pallet-P',
      'returned-detent-catches-B-at-T-and-banks-at-E',
      'clockwise-return-V-flexes-TV-alone',
      'balance-otherwise-fully-detached',
    ],
  };
  root.userData.toothTipAt = toothTipAt;
  root.userData.wheelMotionAtCyclePhase = wheelMotionAtCyclePhase;

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
    impulseMarker,
    lockMarker,
    unlockingJewelV,
    wheelIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  cameraEnvelope.castShadow = false;
  cameraEnvelope.receiveShadow = false;
  root.userData.fidelity = 'authored';
  correctFreeEscapement(root, movement.id);
  fitFreeEscapement(root, update);
  return {
    cameraDirection: new THREE.Vector3(.7, .5, 14),
    root,
    update,
  };
}

export function createAuthoredFreeEscapementMovement(movement) {
  if (movement.id === 291) return arnoldFreeEscapement(movement);
  if (movement.id === 313) return earnshawSpringDetentEscapement(movement);
  return null;
}
