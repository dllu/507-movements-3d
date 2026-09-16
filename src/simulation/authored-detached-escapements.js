import {correctDetachedChronometer} from './detached-chronometer-working-parts.js';
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
    curveSegments: 16,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
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
      Math.max(40, points.length * 2),
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

function pointToSegmentDistance(point, start, end) {
  const segment = end.clone().sub(start);
  const lengthSquared = segment.lengthSq();
  const progress = lengthSquared > 0
    ? THREE.MathUtils.clamp(
      point.clone().sub(start).dot(segment) / lengthSquared,
      0,
      1,
    )
    : 0;
  return {
    closestPoint: start.clone().add(segment.multiplyScalar(progress)),
    distance: point.distanceTo(
      start.clone().add(end.clone().sub(start).multiplyScalar(progress)),
    ),
  };
}

function airyDetachedEscapement(movement) {
  const root = new THREE.Group();

  // Brown's compact front elevation uses Q for the independently pivoted
  // locking detent, C for the one-way pendulum click, and I for the sole
  // impulse pallet. Airy's original plate supplies the omitted construction:
  // sixty axial pins, a spring detent, and one impulse in two vibrations.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterWheelCenter = new THREE.Vector2(236, 219);
  const sourceRasterWheelTop = new THREE.Vector2(252, 154);
  const sourceRasterDetentPivotQ = new THREE.Vector2(304, 158);
  const sourceRasterDetentTail = new THREE.Vector2(209, 331);
  const sourceRasterClickPivotC = new THREE.Vector2(240, 354);
  const sourceRasterPalletI = new THREE.Vector2(281, 278);
  const sourceRasterFixedBracketBounds = {
    bottom: 194,
    left: 214,
    right: 279,
    top: 84,
  };
  const sourceRasterPendulumExtremes = {
    left: new THREE.Vector2(61, 424),
    right: new THREE.Vector2(468, 424),
  };
  const sourceRasterDirectionArrow = {
    end: new THREE.Vector2(218, 404),
    start: new THREE.Vector2(338, 404),
  };

  const wheelCenter = new THREE.Vector2(0, 0.35);
  const pinOrbitRadius = 1.28;
  const sourceWheelRadius = sourceRasterWheelCenter.distanceTo(
    sourceRasterWheelTop,
  );
  const sourceScale = pinOrbitRadius / sourceWheelRadius;
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    wheelCenter.x + (x - sourceRasterWheelCenter.x) * sourceScale,
    wheelCenter.y + (sourceRasterWheelCenter.y - y) * sourceScale,
  );
  const detentPivot = sourcePointToModel(sourceRasterDetentPivotQ);
  const detentTailAtRest = sourcePointToModel(sourceRasterDetentTail);
  const clickPivotAtRest = sourcePointToModel(sourceRasterClickPivotC);
  const pendulumPivot = new THREE.Vector2(0.22, 4.18);

  const pinCount = 60;
  const pinPitch = FULL_TURN / pinCount;
  const wheelAdvancePerCycle = pinPitch;
  const wheelDepth = 0.20;
  const pinRadius = 0.034;
  const pinLength = 0.46;
  const pinCenterZ = 0.30;
  const workingPlaneZ = pinCenterZ + pinLength / 2;
  const impulseContactStartAngle = THREE.MathUtils.degToRad(-42);
  const impulseContactEndAngle = impulseContactStartAngle - pinPitch;
  const lockPinOffset = 12;
  const detentLockAngle = impulseContactStartAngle
    + lockPinOffset * pinPitch;
  const detentLiftAngle = THREE.MathUtils.degToRad(-3);

  const pendulumPeriod = 4;
  const pendulumAmplitude = THREE.MathUtils.degToRad(5);
  const unlockStartAngle = THREE.MathUtils.degToRad(1.8);
  const impulseStartAngle = THREE.MathUtils.degToRad(1);
  const impulseEndAngle = -impulseStartAngle;
  const unlockStartPhase = Math.acos(
    unlockStartAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const impulseStartPhase = Math.acos(
    impulseStartAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const impulseEndPhase = Math.acos(
    impulseEndAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const bypassStartPhase = 1 - impulseStartPhase;
  const bypassEndPhase = 1 - unlockStartPhase;
  const impulsePhaseSpan = impulseEndPhase - impulseStartPhase;
  const detentReturnStartPhase = impulseStartPhase
    + impulsePhaseSpan * 0.80;
  const detentRelockPhase = impulseStartPhase
    + impulsePhaseSpan;
  const clickMaximumDeflection = THREE.MathUtils.degToRad(-4);
  const phaseBoundaryEpsilon = 1e-12;

  const pendulumMotionAtPhase = (cyclePhase) => {
    const argument = FULL_TURN * cyclePhase;
    const angularFrequency = FULL_TURN / pendulumPeriod;
    return {
      acceleration: -pendulumAmplitude
        * angularFrequency ** 2 * Math.cos(argument),
      angle: pendulumAmplitude * Math.cos(argument),
      speed: -pendulumAmplitude
        * angularFrequency * Math.sin(argument),
    };
  };
  const wheelAngleAtCycleStart = (cycleIndex) => (
    impulseContactStartAngle - cycleIndex * pinPitch
  );
  const pinCenterAt = (wheelAngle, pinIndex) => wheelCenter.clone().add(
    new THREE.Vector2(
      Math.cos(wheelAngle + pinIndex * pinPitch) * pinOrbitRadius,
      Math.sin(wheelAngle + pinIndex * pinPitch) * pinOrbitRadius,
    ),
  );
  const fixedDetentLockPoint = wheelCenter.clone().add(new THREE.Vector2(
    Math.cos(detentLockAngle) * pinOrbitRadius,
    Math.sin(detentLockAngle) * pinOrbitRadius,
  ));
  const clockwiseLockTangent = new THREE.Vector2(
    Math.sin(detentLockAngle),
    -Math.cos(detentLockAngle),
  );
  const detentCatchTangentialThickness = 0.05;
  const detentCatchRadius = 0.025;
  const detentContactClearance = 0.0005;
  const catchDirection = fixedDetentLockPoint.clone().sub(detentPivot).normalize();
  const detentCatchCenterAtRest = fixedDetentLockPoint.clone().addScaledVector(
    catchDirection, pinRadius + detentCatchRadius + detentContactClearance,
  );
  const detentCatchFacePointAtRest = detentCatchCenterAtRest.clone()
    .addScaledVector(catchDirection, -detentCatchRadius);
  const pendulumLocalPoint = (worldPoint, pendulumAngle) => rotate2(
    worldPoint.clone().sub(pendulumPivot),
    -pendulumAngle,
  );
  const pendulumWorldPoint = (localPoint, pendulumAngle) => pendulumPivot
    .clone()
    .add(rotate2(localPoint, pendulumAngle));

  const clickPivotLocal = clickPivotAtRest.clone().sub(pendulumPivot);
  const clickTipWorldAtUnlockStart = pendulumWorldPoint(
    clickPivotLocal,
    unlockStartAngle,
  );
  const clickHornLocal = rotate2(
    detentTailAtRest.clone().sub(clickTipWorldAtUnlockStart),
    -unlockStartAngle,
  );
  const clickTipAt = (pendulumAngle, clickAngle) => pendulumWorldPoint(
    clickPivotLocal.clone().add(rotate2(clickHornLocal, clickAngle)),
    pendulumAngle,
  );
  const detentPointAt = (restPoint, detentAngle) => detentPivot.clone().add(
    rotate2(restPoint.clone().sub(detentPivot), detentAngle),
  );

  const rawStateAtTime = (time) => {
    const cycleCoordinate = time / pendulumPeriod;
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const pendulum = pendulumMotionAtPhase(cyclePhase);
    const impulsePinIndex = positiveModulo(cycleIndex, pinCount);
    const startingLockPinIndex = positiveModulo(
      impulsePinIndex + lockPinOffset,
      pinCount,
    );
    const landingLockPinIndex = positiveModulo(
      startingLockPinIndex + 1,
      pinCount,
    );
    let clickAngle = 0;
    let contactKind = null;
    let detentAngle = 0;
    let mode = 'detached-leftward-approach';
    let wheelAdvance = 0;

    if (cyclePhase < unlockStartPhase - phaseBoundaryEpsilon) {
      mode = 'detached-leftward-approach';
    } else if (cyclePhase < impulseStartPhase - phaseBoundaryEpsilon) {
      const progress = (cyclePhase - unlockStartPhase)
        / (impulseStartPhase - unlockStartPhase);
      detentAngle = detentLiftAngle * smootherStep(progress);
      contactKind = 'unlocking-click-contact';
      mode = 'C-click-lifts-Q-detent';
    } else if (cyclePhase <= impulseEndPhase + phaseBoundaryEpsilon) {
      const impulseProgress = (cyclePhase - impulseStartPhase)
        / impulsePhaseSpan;
      wheelAdvance = wheelAdvancePerCycle * smootherStep(impulseProgress);
      contactKind = 'single-pallet-direct-impulse';
      mode = 'I-pallet-leftward-impulse';
      if (cyclePhase < detentReturnStartPhase) {
        detentAngle = detentLiftAngle;
      } else if (cyclePhase < detentRelockPhase) {
        const returnProgress = (cyclePhase - detentReturnStartPhase)
          / (detentRelockPhase - detentReturnStartPhase);
        detentAngle = detentLiftAngle
          * (1 - smootherStep(returnProgress));
      }
    } else if (cyclePhase < 0.5) {
      wheelAdvance = wheelAdvancePerCycle;
      mode = 'detached-leftward-overswing';
    } else if (cyclePhase < bypassStartPhase - phaseBoundaryEpsilon) {
      wheelAdvance = wheelAdvancePerCycle;
      mode = 'detached-rightward-return';
    } else if (cyclePhase <= bypassEndPhase + phaseBoundaryEpsilon) {
      wheelAdvance = wheelAdvancePerCycle;
      const bypassProgress = (cyclePhase - bypassStartPhase)
        / (bypassEndPhase - bypassStartPhase);
      clickAngle = clickMaximumDeflection
        * Math.sin(Math.PI * THREE.MathUtils.clamp(
          bypassProgress,
          0,
          1,
        )) ** 2;
      contactKind = 'one-way-click-bypass';
      mode = 'C-click-pushed-aside-by-Q';
    } else {
      wheelAdvance = wheelAdvancePerCycle;
      mode = 'detached-rightward-overswing';
    }

    const wheelAngle = wheelAngleAtCycleStart(cycleIndex) - wheelAdvance;
    const impulseActive = contactKind === 'single-pallet-direct-impulse';
    const unlockActive = contactKind === 'unlocking-click-contact';
    const bypassActive = contactKind === 'one-way-click-bypass';
    const detentLocked = cyclePhase < unlockStartPhase
      || cyclePhase > impulseEndPhase;
    const activeLockPinIndex = cyclePhase <= impulseStartPhase
      ? startingLockPinIndex
      : landingLockPinIndex;
    const activeImpulsePoint = impulseActive
      ? pinCenterAt(wheelAngle, impulsePinIndex)
      : null;
    const lockPinPoint = detentLocked
      ? pinCenterAt(wheelAngle, activeLockPinIndex)
      : null;
    const detentTailPoint = detentPointAt(
      detentTailAtRest,
      detentAngle,
    );
    const clickPivotPoint = pendulumWorldPoint(
      clickPivotLocal,
      pendulum.angle,
    );
    const clickTipPoint = clickTipAt(pendulum.angle, clickAngle);
    const passingContact = pointToSegmentDistance(
      detentTailPoint,
      clickPivotPoint,
      clickTipPoint,
    );

    return {
      activeImpulsePinIndex: impulseActive ? impulsePinIndex : null,
      activeImpulsePoint,
      activeLockPinIndex: detentLocked ? activeLockPinIndex : null,
      bypassActive,
      clickAngle,
      clickContactPoint: passingContact.closestPoint,
      clickPivotPoint,
      clickTipPoint,
      contactKind,
      cycleIndex,
      cyclePhase,
      detachedFromEscapeWheel: !unlockActive && !impulseActive,
      detentAngle,
      detentCatchPoint: detentPointAt(
        detentCatchFacePointAtRest,
        detentAngle,
      ),
      detentLocked,
      detentTailPoint,
      impulseActive,
      impulseDirection: impulseActive ? 'leftward' : null,
      impulsePinIndex,
      landingLockPinIndex,
      lockPinPoint,
      mode,
      palletAngle: pendulum.angle,
      palletAngularAcceleration: pendulum.acceleration,
      palletAngularSpeed: pendulum.speed,
      passingContactError: unlockActive || bypassActive
        ? passingContact.distance
        : null,
      startingLockPinIndex,
      trainCoupledToPendulum: unlockActive || impulseActive,
      unlockActive,
      wheelAdvance,
      wheelAngle,
    };
  };

  const impulseContactLocalAtState = (state) => pendulumLocalPoint(
    state.activeImpulsePoint,
    state.palletAngle,
  );
  const addContactState = (state) => {
    if (!state.impulseActive) {
      return {
        ...state,
        impulseContactError: null,
        impulseContactPoint: null,
        impulseContactPointLocal: null,
      };
    }
    const impulseContactPointLocal = impulseContactLocalAtState(state);
    const impulseContactPoint = pendulumWorldPoint(
      impulseContactPointLocal,
      state.palletAngle,
    );
    return {
      ...state,
      impulseContactError: impulseContactPoint.distanceTo(
        state.activeImpulsePoint,
      ),
      impulseContactPoint,
      impulseContactPointLocal,
    };
  };
  const derivativeStep = 1e-5;
  const stateAtTime = (time) => {
    const state = addContactState(rawStateAtTime(time));
    const before = rawStateAtTime(time - derivativeStep).wheelAngle;
    const after = rawStateAtTime(time + derivativeStep).wheelAngle;
    return {
      ...state,
      wheelAngularAcceleration: (
        after - 2 * state.wheelAngle + before
      ) / derivativeStep ** 2,
      wheelAngularSpeed: (after - before) / (2 * derivativeStep),
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * pendulumPeriod,
  );
  const impulsePalletPoints = Array.from({ length: 49 }, (_, index) => {
    const phase = THREE.MathUtils.lerp(
      impulseStartPhase,
      impulseEndPhase,
      index / 48,
    );
    return impulseContactLocalAtState(rawStateAtTime(
      phase * pendulumPeriod,
    ));
  });

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.30,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.36,
    roughness: 0.42,
  });
  const wheelMaterial = matte(PALETTE.driver, {
    metalness: 0.26,
    roughness: 0.44,
  });
  const pendulumMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    roughness: 0.55,
  });
  const detentMaterial = matte(PALETTE.accent, {
    metalness: 0.40,
    roughness: 0.34,
  });
  const markerMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.30,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-Airy-escapement-frame';
  root.add(fixedFrame);
  const upright = beamBetween(
    new THREE.Vector3(-2.08, -3.05, -0.52),
    new THREE.Vector3(-2.08, 4.55, -0.52),
    0.15,
    0.18,
    frameMaterial,
  );
  upright.userData.role = 'clock-frame-upright';
  fixedFrame.add(upright);
  for (const [point, role] of [
    [wheelCenter, 'sixty-pin-wheel-bearing'],
    [pendulumPivot, 'pendulum-crutch-bearing'],
    [detentPivot, 'Q-detent-bearing'],
  ]) {
    const bracket = beamBetween(
      new THREE.Vector3(-2.08, point.y, -0.52),
      new THREE.Vector3(point.x, point.y, -0.52),
      0.11,
      0.16,
      frameMaterial,
    );
    bracket.userData.role = `${role}-bracket`;
    fixedFrame.add(bracket);
    const bearing = cylinderAlongZ(0.12, 1.03, darkMaterial);
    bearing.position.set(point.x, point.y, -0.04);
    bearing.userData.role = role;
    fixedFrame.add(bearing);
  }

  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role = 'Airy-sixty-axial-pin-escape-wheel';
  root.add(escapeWheel);
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'single-beat-clockwise-wheel-rotor';
  escapeWheel.add(wheelRotor);
  const wheelRing = new THREE.Mesh(
    centeredExtrusion(
      annularShape(pinOrbitRadius * 0.89, pinOrbitRadius * 0.72),
      wheelDepth,
      0.006,
    ),
    wheelMaterial,
  );
  wheelRing.userData.role = 'open-sixty-pin-wheel-rim';
  wheelRotor.add(wheelRing);
  const spokeMeshes = [];
  for (let index = 0; index < 3; index += 1) {
    const angle = index * FULL_TURN / 3;
    const spoke = beamBetween(
      new THREE.Vector3(
        Math.cos(angle) * 0.13,
        Math.sin(angle) * 0.13,
        0,
      ),
      new THREE.Vector3(
        Math.cos(angle) * pinOrbitRadius * 0.82,
        Math.sin(angle) * pinOrbitRadius * 0.82,
        0,
      ),
      0.105,
      wheelDepth * 0.76,
      wheelMaterial,
    );
    spoke.userData.index = index;
    spoke.userData.role = 'Airy-wheel-spoke';
    wheelRotor.add(spoke);
    spokeMeshes.push(spoke);
  }
  const wheelPins = [];
  for (let index = 0; index < pinCount; index += 1) {
    const pin = cylinderAlongZ(pinRadius, pinLength, darkMaterial, 12);
    const angle = index * pinPitch;
    pin.position.set(
      Math.cos(angle) * pinOrbitRadius,
      Math.sin(angle) * pinOrbitRadius,
      pinCenterZ,
    );
    pin.userData.index = index;
    pin.userData.role = 'perpendicular-escape-wheel-pin';
    wheelRotor.add(pin);
    wheelPins.push(pin);
  }
  const wheelHub = cylinderAlongZ(0.15, 0.82, darkMaterial);
  wheelHub.position.z = 0.03;
  wheelHub.userData.role = 'escape-wheel-arbor-hub';
  wheelRotor.add(wheelHub);
  const wheelPhaseWitness = beamBetween(
    new THREE.Vector3(0.22, 0, 0.13),
    new THREE.Vector3(pinOrbitRadius * 0.82, 0, 0.13),
    0.045,
    0.035,
    markerMaterial,
  );
  wheelPhaseWitness.userData.role = 'wheel-phase-witness';
  wheelRotor.add(wheelPhaseWitness);

  const pendulumAssembly = new THREE.Group();
  pendulumAssembly.position.set(pendulumPivot.x, pendulumPivot.y, 0);
  pendulumAssembly.userData.axis = Z_AXIS.clone();
  pendulumAssembly.userData.role = 'free-pendulum-P-and-crutch';
  root.add(pendulumAssembly);
  const pendulumRod = beamBetween(
    new THREE.Vector3(0, -0.08, 0.12),
    new THREE.Vector3(0, -7.82, 0.12),
    0.12,
    0.18,
    pendulumMaterial,
  );
  pendulumRod.userData.role = 'pendulum-P-rod';
  pendulumAssembly.add(pendulumRod);
  const pivotEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.065, 10, 36),
    pendulumMaterial,
  );
  pivotEye.position.z = 0.22;
  pivotEye.userData.role = 'pendulum-P-pivot-eye';
  pendulumAssembly.add(pivotEye);
  const pendulumBob = cylinderAlongZ(0.56, 0.24, pendulumMaterial, 48);
  pendulumBob.position.set(0, -7.48, 0.13);
  pendulumBob.scale.y = 1.22;
  pendulumBob.userData.role = 'pendulum-P-bob';
  pendulumAssembly.add(pendulumBob);

  const palletMidpoint = impulsePalletPoints[Math.floor(
    impulsePalletPoints.length / 2,
  )];
  const crutchArm = beamBetween(
    new THREE.Vector3(0, -2.35, 0.25),
    new THREE.Vector3(palletMidpoint.x + 0.08,
      palletMidpoint.y + 0.05, 0.25),
    0.14,
    0.16,
    pendulumMaterial,
  );
  crutchArm.userData.role = 'single-pallet-crutch-arm';
  pendulumAssembly.add(crutchArm);
  const palletBacking = beamBetween(
    new THREE.Vector3(
      impulsePalletPoints[0].x,
      impulsePalletPoints[0].y,
      workingPlaneZ - 0.07,
    ),
    new THREE.Vector3(
      impulsePalletPoints.at(-1).x,
      impulsePalletPoints.at(-1).y,
      workingPlaneZ - 0.07,
    ),
    0.15,
    0.14,
    darkMaterial,
  );
  palletBacking.userData.role = 'single-adjustable-pallet-I-backing';
  pendulumAssembly.add(palletBacking);
  const palletI = edgeTube(
    impulsePalletPoints,
    workingPlaneZ,
    0.032,
    detentMaterial,
    'single-generated-impulse-pallet-I',
  );
  pendulumAssembly.add(palletI);

  const clickAssembly = new THREE.Group();
  clickAssembly.position.set(clickPivotLocal.x, clickPivotLocal.y, 0.59);
  clickAssembly.userData.axis = Z_AXIS.clone();
  clickAssembly.userData.role = 'pendulum-mounted-pivoting-click-C';
  pendulumAssembly.add(clickAssembly);
  const clickHorn = beamBetween(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(clickHornLocal.x, clickHornLocal.y, 0),
    0.09,
    0.12,
    detentMaterial,
  );
  clickHorn.userData.role = 'rigid-unlock-face-and-yielding-return-click';
  clickAssembly.add(clickHorn);
  const clickTail = beamBetween(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.45, -0.04, 0),
    0.10,
    0.12,
    detentMaterial,
  );
  clickTail.userData.role = 'click-C-visible-tail';
  clickAssembly.add(clickTail);
  const clickPivot = cylinderAlongZ(0.095, 0.31, darkMaterial);
  clickPivot.position.z = 0;
  clickPivot.userData.role = 'click-C-pivot';
  clickAssembly.add(clickPivot);
  const clickBankingPins = [
    clickPivotLocal.clone().add(new THREE.Vector2(-0.42, -0.14)),
    clickPivotLocal.clone().add(new THREE.Vector2(0.47, -0.17)),
  ].map((point, index) => {
    const pin = cylinderAlongZ(0.07, 0.34, darkMaterial, 20);
    pin.position.set(point.x, point.y, 0.52);
    pin.userData.index = index;
    pin.userData.role = 'click-C-banking-pin';
    pendulumAssembly.add(pin);
    return pin;
  });

  const detentAssembly = new THREE.Group();
  detentAssembly.position.set(detentPivot.x, detentPivot.y, 0.62);
  detentAssembly.userData.axis = Z_AXIS.clone();
  detentAssembly.userData.role = 'independent-locking-lever-Q';
  root.add(detentAssembly);
  const detentTailLocal = detentTailAtRest.clone().sub(detentPivot);
  const detentRail = beamBetween(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(detentTailLocal.x, detentTailLocal.y, 0),
    0.12,
    0.14,
    detentMaterial,
  );
  detentRail.userData.role = 'Q-long-locking-lever';
  detentAssembly.add(detentRail);
  const detentCatchLocal = detentCatchCenterAtRest.clone().sub(detentPivot);
  const detentBrace = beamBetween(
    new THREE.Vector3(-0.08, -0.14, -0.01),
    new THREE.Vector3(
      detentCatchLocal.x - 0.12,
      detentCatchLocal.y + 0.14,
      -0.01,
    ),
    0.075,
    0.11,
    detentMaterial,
  );
  detentBrace.userData.role = 'Q-open-upper-brace';
  detentAssembly.add(detentBrace);
  const detentCatch = cylinderAlongZ(detentCatchRadius, 0.20, darkMaterial, 64);
  detentCatch.position.set(detentCatchLocal.x, detentCatchLocal.y, -0.05);
  detentCatch.userData.role = 'Q-wheel-pin-locking-catch';
  detentAssembly.add(detentCatch);
  const detentTailPad = cylinderAlongZ(0.075, 0.20, darkMaterial, 20);
  detentTailPad.position.set(detentTailLocal.x, detentTailLocal.y, 0);
  detentTailPad.userData.role = 'Q-tail-contact-pad';
  detentAssembly.add(detentTailPad);
  const detentPivotEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.05, 10, 32),
    detentMaterial,
  );
  detentPivotEye.position.z = 0.02;
  detentPivotEye.userData.role = 'Q-detent-pivot-eye';
  detentAssembly.add(detentPivotEye);
  const returnSpring = beamBetween(
    new THREE.Vector3(detentPivot.x - 0.56, detentPivot.y + 0.63, 0.34),
    new THREE.Vector3(detentPivot.x - 0.07, detentPivot.y + 0.11, 0.34),
    0.045,
    0.07,
    markerMaterial,
  );
  returnSpring.userData.role = 'slight-Q-return-spring';
  fixedFrame.add(returnSpring);

  const impulseMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 16, 12),
    markerMaterial,
  );
  impulseMarker.userData.role = 'live-pallet-I-impulse-contact';
  root.add(impulseMarker);
  const clickContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.057, 16, 12),
    markerMaterial,
  );
  clickContactMarker.userData.role = 'live-C-Q-contact';
  root.add(clickContactMarker);
  const lockMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 16, 12),
    detentMaterial,
  );
  lockMarker.userData.role = 'live-Q-wheel-lock-contact';
  root.add(lockMarker);

  const update = (time) => {
    const state = stateAtTime(time);
    pendulumAssembly.rotation.z = state.palletAngle;
    wheelRotor.rotation.z = state.wheelAngle;
    detentAssembly.rotation.z = state.detentAngle;
    clickAssembly.rotation.z = state.clickAngle;

    impulseMarker.visible = state.impulseContactPoint !== null;
    if (state.impulseContactPoint) {
      impulseMarker.position.set(
        state.impulseContactPoint.x,
        state.impulseContactPoint.y,
        workingPlaneZ + 0.10,
      );
    }
    clickContactMarker.visible = state.unlockActive || state.bypassActive;
    if (clickContactMarker.visible) {
      clickContactMarker.position.set(
        (state.clickContactPoint.x + state.detentTailPoint.x) / 2,
        (state.clickContactPoint.y + state.detentTailPoint.y) / 2,
        0.76,
      );
    }
    lockMarker.visible = state.detentLocked;
    if (state.lockPinPoint) {
      lockMarker.position.set(
        state.lockPinPoint.x,
        state.lockPinPoint.y,
        workingPlaneZ + 0.08,
      );
    }
    impulseMarker.userData.activePinIndex = state.activeImpulsePinIndex;
    impulseMarker.userData.contactError = state.impulseContactError;
    clickContactMarker.userData.contactKind = state.contactKind;
    clickContactMarker.userData.passingContactError =
      state.passingContactError;
    lockMarker.userData.activePinIndex = state.activeLockPinIndex;
    root.userData.currentState = state;
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    clickAssembly,
    clickBankingPins,
    clickContactMarker,
    clickHorn,
    clickPivot,
    clickTail,
    crutchArm,
    detentAssembly,
    detentBrace,
    detentCatch,
    detentPivotEye,
    detentRail,
    detentTailPad,
    escapeWheel,
    fixedFrame,
    impulseMarker,
    lockMarker,
    palletBacking,
    palletI,
    pendulumAssembly,
    pendulumBob,
    pendulumRod,
    pivotEye,
    returnSpring,
    spokeMeshes,
    upright,
    wheelHub,
    wheelPhaseWitness,
    wheelPins,
    wheelRing,
    wheelRotor,
  };
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.55, -4.10, -0.92),
    new THREE.Vector3(2.25, 4.65, 1.02),
  );
  root.userData.clickTipAt = clickTipAt;
  root.userData.detentPointAt = detentPointAt;
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    bypassEndPhase,
    bypassStartPhase,
    clickHornLocal: clickHornLocal.clone(),
    clickMaximumDeflection,
    clickPivotAtRest: clickPivotAtRest.clone(),
    clickPivotLocal: clickPivotLocal.clone(),
    detentCatchCenterAtRest: detentCatchCenterAtRest.clone(),
    detentCatchFacePointAtRest: detentCatchFacePointAtRest.clone(),
    detentCatchTangentialThickness,
    detentCatchRadius,
    detentContactClearance,
    detentLiftAngle,
    detentLockAngle,
    detentPivot: detentPivot.clone(),
    detentRelockPhase,
    detentReturnStartPhase,
    detentTailAtRest: detentTailAtRest.clone(),
    fixedDetentLockPoint: fixedDetentLockPoint.clone(),
    impulseContactEndAngle,
    impulseContactStartAngle,
    impulseEndAngle,
    impulseEndPhase,
    impulsePhaseSpan,
    impulseStartAngle,
    impulseStartPhase,
    lockPinOffset,
    palletPointCount: impulsePalletPoints.length,
    pendulumAmplitude,
    pendulumPeriod,
    pendulumPivot: pendulumPivot.clone(),
    pinCenterZ,
    pinCount,
    pinLength,
    pinOrbitRadius,
    pinPitch,
    pinRadius,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    unlockStartAngle,
    unlockStartPhase,
    wheelAdvancePerCycle,
    wheelCenter: wheelCenter.clone(),
    wheelDepth,
    workingPlaneZ,
  };
  root.userData.impulsePallet = {
    axialPlaneZ: workingPlaneZ,
    function: 'the only impulse pallet; active only on the leftward vibration',
    label: 'I',
    points: impulsePalletPoints,
  };
  root.userData.mechanism = 'Airy’s single-beat detached pendulum escapement: independent lever Q normally locks one of sixty perpendicular wheel pins; pendulum-mounted one-way click C lifts Q only on the leftward approach; the released wheel then gives one direct impulse through the sole pallet I, after which Q catches the next pin and the pendulum completes the rest of both vibrations detached.';
  root.userData.pinCenterAt = pinCenterAt;
  root.userData.presentation = 'front-oblique reconstruction of Brown’s compact Q/C/I elevation, with the original Airy axial pin row and distinct wheel, detent, click, and pallet planes exposed';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official Movement 308 page marks Animated unavailable and supplies only Brown’s static elevation and description.',
    referenceScope: 'Brown fixes the Q/C/I topology and leftward-only impulse. Airy’s original paper fixes sixty perpendicular pins, the single pallet, spring detent and weak one-way passing member, one impulse in two vibrations, and the symmetric middle-of-swing impulse principle. Beckett identifies the same mechanism as Airy’s detached escapement and records its Greenwich use.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    airyOriginalPaper: {
      author: 'George Biddell Airy',
      construction: 'Wheel A has sixty pins perpendicular to its plane; C is the single pallet, E the pendulum-carried unlocking pin, FG the spring detent carrying catch H, and KL the very weak one-way passing spring.',
      paper: 'On the Disturbances of Pendulums and Balances, and on the Theory of Escapements',
      pages: [105, 128],
      plate: 2,
      publication: 'Transactions of the Cambridge Philosophical Society',
      publicationPart: 1,
      publicationVolume: 3,
      publicationYear: 1830,
      readDate: '1826-11-26',
      result: 'The pendulum receives one impulse in two vibrations; the impulse can be arranged around the middle point while the return passage yields without sensibly retarding the pendulum.',
      url: 'https://circuitousroot.com/oldstuff/library-of-antiquarian-technology/horology/airy-1826/index.html',
    },
    beckettConstructionReference: {
      author: 'Edmund Beckett, Lord Grimthorpe',
      figure: 19,
      operatingEvidence: 'The single pallet CP is the down pallet of a dead escapement. A lightly sprung independent detent locks the wheel; its passing spring yields one way and lifts the detent on the other. The Greenwich seconds pendulum was about thirty pounds.',
      page: 73,
      publication: 'A Rudimentary Treatise on Clocks, Watches and Bells for Public Purposes',
      publicationEdition: 8,
      publicationYear: 1903,
      url: 'https://campaners.com/pdf/pdf3067.pdf',
    },
    greenwichClockReference: {
      completed: 1871,
      maker: 'E. Dent & Co.',
      operation: 'The standard sidereal clock received impulse only at each alternate vibration, so its escape wheel and seconds hand moved only at alternate seconds.',
      url: 'https://www.royalobservatorygreenwich.org/articles.php?article=1329',
    },
    officialDescription: movement.description,
    plate308: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one pendulum P carrying one pallet I and pivoting click C; one independently pivoted lever Q locks one compact escape wheel',
      measurementUncertaintyPixels: 8,
      officialAnimationAvailable: false,
      rasterClickPivotC: sourceRasterClickPivotC.clone(),
      rasterDetentPivotQ: sourceRasterDetentPivotQ.clone(),
      rasterDetentTail: sourceRasterDetentTail.clone(),
      rasterDirectionArrow: sourceRasterDirectionArrow,
      rasterFixedBracketBounds: sourceRasterFixedBracketBounds,
      rasterPalletI: sourceRasterPalletI.clone(),
      rasterPendulumExtremes: sourceRasterPendulumExtremes,
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
      rasterWheelTop: sourceRasterWheelTop.clone(),
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
      'detached-leftward-approach',
      'C-click-lifts-Q-detent',
      'I-pallet-leftward-impulse',
      'detached-leftward-overswing',
      'detached-rightward-return',
      'C-click-pushed-aside-by-Q',
      'detached-rightward-overswing',
    ],
  };
  root.userData.transmission = {
    detachment: 'P is uncoupled from the escape wheel throughout both overswings and the rightward return; only the brief leftward unlock and impulse transmit train force.',
    direction: 'clockwise in the reconstructed front elevation',
    impulseArc: 'symmetric from one degree before center to one degree after center on the leftward vibration',
    impulsesPerPendulumCycle: 1,
    impulsesPerVibration: [1, 0],
    pinCount,
    recoil: 'none; Q holds the wheel stationary between single-beat advances',
    returnPass: 'C pivots aside under Q without releasing Q or moving the wheel',
    wheelAdvancePerCycleRadians: wheelAdvancePerCycle,
    wheelCyclesPerRevolution: pinCount,
  };
  root.userData.wheelAngleAtCycleStart = wheelAngleAtCycleStart;

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
    impulseMarker,
    clickContactMarker,
    lockMarker,
    wheelPhaseWitness,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  correctDetachedChronometer(root, 308, update);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredDetachedEscapementMovement(movement) {
  switch (movement.id) {
    case 308: return airyDetachedEscapement(movement);
    default: return null;
  }
}
