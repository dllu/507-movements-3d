import * as THREE from 'three';
import {
  PALETTE,
  makeGear,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function centeredModulo(value, modulus) {
  return positiveModulo(value + modulus / 2, modulus) - modulus / 2;
}

function rotate2(point, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
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

function cylinderAlongZ(radius, depth, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
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

function annularSectorShape(innerRadius, outerRadius, start, end) {
  const points = [];
  const sampleCount = 56;
  for (let index = 0; index <= sampleCount; index += 1) {
    const angle = THREE.MathUtils.lerp(start, end, index / sampleCount);
    points.push(new THREE.Vector2(
      outerRadius * Math.cos(angle),
      outerRadius * Math.sin(angle),
    ));
  }
  for (let index = sampleCount; index >= 0; index -= 1) {
    const angle = THREE.MathUtils.lerp(start, end, index / sampleCount);
    points.push(new THREE.Vector2(
      innerRadius * Math.cos(angle),
      innerRadius * Math.sin(angle),
    ));
  }
  return polygonShape(points);
}

function beamBetween(start, end, width, depth, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(delta.y, delta.x);
  return beam;
}

function edgeTube(points, z, radius, material) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, point.y, z)),
    false,
    'centripetal',
  );
  return new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      Math.max(48, points.length * 2),
      radius,
      8,
      false,
    ),
    material,
  );
}

function makeSectorRack({
  centerAngle,
  depth,
  internal,
  module,
  pitchRadius,
  role,
  span,
  bodyMaterial,
  toothMaterial,
}) {
  const rack = new THREE.Group();
  rack.userData.role = role;
  const circularPitch = Math.PI * module;
  const angularPitch = circularPitch / pitchRadius;
  const toothHeight = module * 2.15;
  const toothWidth = circularPitch * 0.42;
  const bodyThickness = module * 2.8;
  const rootOffset = module * 0.44;
  const bodyInnerRadius = internal
    ? pitchRadius + rootOffset
    : pitchRadius - rootOffset - bodyThickness;
  const bodyOuterRadius = internal
    ? pitchRadius + rootOffset + bodyThickness
    : pitchRadius - rootOffset;
  const body = new THREE.Mesh(
    centeredExtrusion(
      annularSectorShape(
        bodyInnerRadius,
        bodyOuterRadius,
        centerAngle - span / 2,
        centerAngle + span / 2,
      ),
      depth,
      0.006,
    ),
    bodyMaterial,
  );
  body.userData.role = `${role}-rigid-sector-body`;
  rack.add(body);

  const halfToothCount = Math.floor(span / (2 * angularPitch));
  const toothGeometry = new THREE.BoxGeometry(
    toothHeight,
    toothWidth,
    depth + 0.025,
  );
  const teeth = [];
  for (let toothIndex = -halfToothCount;
    toothIndex <= halfToothCount;
    toothIndex += 1) {
    const angle = centerAngle + toothIndex * angularPitch;
    const radialCenter = internal
      ? pitchRadius + rootOffset - toothHeight / 2
      : pitchRadius - rootOffset + toothHeight / 2;
    const tooth = new THREE.Mesh(toothGeometry, toothMaterial);
    tooth.position.set(
      radialCenter * Math.cos(angle),
      radialCenter * Math.sin(angle),
      0,
    );
    tooth.rotation.z = angle;
    tooth.userData.role = internal
      ? 'inward-facing-tooth-of-internal-sector'
      : 'outward-facing-tooth-of-external-sector';
    tooth.userData.toothIndex = toothIndex + halfToothCount;
    teeth.push(tooth);
    rack.add(tooth);
  }
  rack.userData.angularPitch = angularPitch;
  rack.userData.circularPitch = circularPitch;
  rack.userData.internal = internal;
  rack.userData.module = module;
  rack.userData.pitchRadius = pitchRadius;
  rack.userData.teeth = teeth;
  rack.userData.toothCount = teeth.length;
  return rack;
}

function makeBalance({
  balanceRadius,
  bearingMaterial,
  center,
  drivenMaterial,
  indexMaterial,
  label,
  pinionRadius,
  pinionTeeth,
  toothMaterial,
}) {
  const balance = new THREE.Group();
  balance.position.set(center.x, center.y, 0.06);
  balance.userData.role = `${label}-counter-oscillating-balance-wheel`;

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(balanceRadius, 0.072, 12, 96),
    drivenMaterial,
  );
  rim.userData.role = `${label}-balance-rim`;
  balance.add(rim);
  const spokes = [];
  for (let index = 0; index < 3; index += 1) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(balanceRadius * 1.82, 0.075, 0.075),
      drivenMaterial,
    );
    spoke.rotation.z = index * Math.PI / 3;
    spoke.userData.role = `${label}-balance-spoke-${index + 1}`;
    spokes.push(spoke);
    balance.add(spoke);
  }
  const hub = cylinderAlongZ(0.19, 0.32, bearingMaterial, 36);
  hub.position.z = 0.13;
  hub.userData.role = `${label}-balance-hub`;
  balance.add(hub);
  const angularIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 18, 14),
    indexMaterial,
  );
  angularIndex.position.set(balanceRadius * 0.82, 0, 0.14);
  angularIndex.userData.role = `${label}-white-balance-angular-index`;
  balance.add(angularIndex);

  const pinion = makeGear({
    color: PALETTE.accent,
    depth: 0.20,
    radius: pinionRadius,
    teeth: pinionTeeth,
    toothHeight: pinionRadius * 0.30,
  });
  pinion.position.z = 0.32;
  pinion.userData.role = `${label}-balance-pinion-rigid-on-same-arbor`;
  balance.add(pinion);

  const bearing = cylinderAlongZ(0.245, 0.24, bearingMaterial, 40);
  bearing.position.set(center.x, center.y, -0.17);
  bearing.userData.role = `${label}-fixed-balance-bearing`;
  const shaft = cylinderAlongZ(0.07, 0.86, bearingMaterial, 28);
  shaft.position.set(center.x, center.y, 0.12);
  shaft.userData.role = `${label}-fixed-axis-balance-arbor`;
  return {
    angularIndex,
    balance,
    bearing,
    hub,
    pinion,
    rim,
    shaft,
    spokes,
  };
}

function makeEscapeWheel({
  depth,
  indexMaterial,
  innerRadius,
  material,
  rootRadius,
  toothCount,
  tipRadius,
  bearingMaterial,
}) {
  const wheel = new THREE.Group();
  wheel.userData.role = 'single-powered-watch-escape-wheel';
  const rotor = new THREE.Group();
  rotor.userData.role = 'half-tooth-stepping-escape-wheel-rotor';
  wheel.add(rotor);

  const rim = new THREE.Mesh(
    centeredExtrusion(annularShape(rootRadius, innerRadius), depth, 0.006),
    material,
  );
  rim.userData.role = 'continuous-escape-wheel-rim';
  rotor.add(rim);
  const toothShape = polygonShape([
    new THREE.Vector2(rootRadius - 0.045, -0.070),
    new THREE.Vector2(tipRadius, 0),
    new THREE.Vector2(rootRadius + 0.055, 0.095),
  ]);
  const toothGeometry = centeredExtrusion(toothShape, depth + 0.02, 0.004);
  const teeth = [];
  for (let index = 0; index < toothCount; index += 1) {
    const tooth = new THREE.Mesh(toothGeometry, material);
    tooth.rotation.z = index * FULL_TURN / toothCount;
    tooth.userData.role = 'pointed-escape-wheel-tooth';
    tooth.userData.toothIndex = index;
    teeth.push(tooth);
    rotor.add(tooth);
  }
  const spokes = [];
  for (let index = 0; index < 3; index += 1) {
    const angle = index * FULL_TURN / 3;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(innerRadius * 1.72, 0.095, depth * 0.72),
      material,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `escape-wheel-spoke-${index + 1}`;
    spokes.push(spoke);
    rotor.add(spoke);
  }
  const hub = cylinderAlongZ(0.20, depth * 1.32, bearingMaterial, 36);
  hub.userData.role = 'escape-wheel-hub';
  rotor.add(hub);
  const angularIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 12),
    indexMaterial,
  );
  angularIndex.position.set(innerRadius * 0.74, 0, depth * 0.58);
  angularIndex.userData.role = 'white-escape-wheel-angular-index';
  rotor.add(angularIndex);
  return {
    angularIndex,
    hub,
    rim,
    rotor,
    spokes,
    teeth,
    wheel,
  };
}

function guernseyCounterOscillatingEscapement(movement) {
  const root = new THREE.Group();
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.018;
  const sourceRasterLeverPivotB = new THREE.Vector2(303, 328);
  const sourceRasterUpperBalanceCenter = new THREE.Vector2(263, 229);
  const sourceRasterLeftBalanceCenter = new THREE.Vector2(159, 299);
  const sourceRasterEscapeWheelCenter = new THREE.Vector2(385, 384);
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterLeverPivotB.x) * sourceScale,
    (sourceRasterLeverPivotB.y - y) * sourceScale,
  );
  const leverPivot = new THREE.Vector2(0, 0);
  const upperBalanceCenter = sourcePointToModel(
    sourceRasterUpperBalanceCenter,
  );
  const leftBalanceCenter = sourcePointToModel(
    sourceRasterLeftBalanceCenter,
  );
  const escapeWheelCenter = sourcePointToModel(
    sourceRasterEscapeWheelCenter,
  );
  const upperCenterDistance = upperBalanceCenter.length();
  const leftCenterDistance = leftBalanceCenter.length();
  const upperCenterAngle = Math.atan2(
    upperBalanceCenter.y,
    upperBalanceCenter.x,
  );
  const leftCenterAngle = Math.atan2(
    leftBalanceCenter.y,
    leftBalanceCenter.x,
  );

  const balanceRadius = 1.44;
  const pinionTeeth = 10;
  const gearModule = 0.05;
  const pinionPitchRadius = pinionTeeth * gearModule / 2;
  const externalSectorPitchRadius = upperCenterDistance
    - pinionPitchRadius;
  const internalSectorPitchRadius = leftCenterDistance
    + pinionPitchRadius;
  const externalRatio = externalSectorPitchRadius / pinionPitchRadius;
  const internalRatio = internalSectorPitchRadius / pinionPitchRadius;
  const pinionAngularPitch = FULL_TURN / pinionTeeth;
  const upperPinionPhaseOffset = centeredModulo(
    upperCenterAngle + Math.PI - pinionAngularPitch / 2,
    pinionAngularPitch,
  );
  const leftPinionPhaseOffset = centeredModulo(
    leftCenterAngle - pinionAngularPitch / 2,
    pinionAngularPitch,
  );
  const externalSectorSpan = 0.88;
  const internalSectorSpan = 0.80;
  const leverAmplitude = THREE.MathUtils.degToRad(4.2);
  const balancePeriod = 4;
  const halfBeatDuration = balancePeriod / 2;

  const escapeToothCount = 15;
  const escapeToothPitch = FULL_TURN / escapeToothCount;
  const halfToothAdvance = escapeToothPitch / 2;
  const escapeWheelTipRadius = 0.91;
  const escapeWheelRootRadius = 0.70;
  const escapeWheelInnerRadius = 0.49;
  const palletSpanTeeth = 2.5;
  const palletIndexOffset = Math.ceil(palletSpanTeeth);
  const upperPalletReferenceAngle = 2.06;
  const lowerPalletReferenceAngle = upperPalletReferenceAngle
    + palletSpanTeeth * escapeToothPitch;
  const releaseHalfPhase = 0.42;
  const impulseEndHalfPhase = 0.52;
  const landingHalfPhase = 0.60;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.17,
    roughness: 0.52,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.54,
  });
  const toothMaterial = matte(PALETTE.accent, {
    metalness: 0.30,
    roughness: 0.45,
  });
  const palletMaterial = matte(PALETTE.brass, {
    metalness: 0.38,
    roughness: 0.40,
  });
  const bearingMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.15,
    roughness: 0.64,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const sideForHalfBeat = (halfBeatIndex) => (
    positiveModulo(halfBeatIndex, 2) === 0 ? 'upper' : 'lower'
  );
  const activeToothIndexForHalfBeat = (halfBeatIndex) => {
    const oscillationIndex = Math.floor(halfBeatIndex / 2);
    return sideForHalfBeat(halfBeatIndex) === 'upper'
      ? positiveModulo(oscillationIndex, escapeToothCount)
      : positiveModulo(
        oscillationIndex + palletIndexOffset,
        escapeToothCount,
      );
  };
  const wheelAngleAtHalfBeatLanding = (halfBeatIndex) => (
    upperPalletReferenceAngle - halfBeatIndex * halfToothAdvance
  );
  const wheelStepAtHalfPhase = (halfPhase) => {
    if (halfPhase <= releaseHalfPhase) {
      return {
        advance: 0,
        acceleration: 0,
        event: 'current-pallet-lock',
        progress: 0,
        rate: 0,
      };
    }
    if (halfPhase >= landingHalfPhase) {
      return {
        advance: halfToothAdvance,
        acceleration: 0,
        event: 'next-pallet-lock',
        progress: 1,
        rate: 0,
      };
    }
    const normalized = (halfPhase - releaseHalfPhase)
      / (landingHalfPhase - releaseHalfPhase);
    const duration = (landingHalfPhase - releaseHalfPhase)
      * halfBeatDuration;
    return {
      advance: halfToothAdvance * smootherStep(normalized),
      acceleration: halfToothAdvance
        * smootherStepSecondDerivative(normalized) / duration ** 2,
      event: halfPhase < impulseEndHalfPhase
        ? 'escape-tooth-impulsing-current-pallet'
        : 'free-drop-to-opposite-pallet',
      progress: normalized,
      rate: halfToothAdvance
        * smootherStepDerivative(normalized) / duration,
    };
  };
  const leverStateAtCoordinate = (halfBeatCoordinate) => {
    const argument = Math.PI * halfBeatCoordinate;
    const angularFrequency = Math.PI / halfBeatDuration;
    return {
      acceleration: -leverAmplitude * angularFrequency ** 2
        * Math.cos(argument),
      angle: leverAmplitude * Math.cos(argument),
      speed: -leverAmplitude * angularFrequency * Math.sin(argument),
    };
  };
  const toothTipPoint = (wheelAngle, toothIndex) => {
    const angle = wheelAngle + toothIndex * escapeToothPitch;
    return escapeWheelCenter.clone().add(new THREE.Vector2(
      escapeWheelTipRadius * Math.cos(angle),
      escapeWheelTipRadius * Math.sin(angle),
    ));
  };
  const representativeHalfBeatForPallet = (side) => (
    side === 'upper' ? 0 : 1
  );
  const palletFaceLocalPoint = (side, halfPhase) => {
    const halfBeatIndex = representativeHalfBeatForPallet(side);
    const step = wheelStepAtHalfPhase(halfPhase);
    const wheelAngle = wheelAngleAtHalfBeatLanding(halfBeatIndex)
      - step.advance;
    const toothIndex = activeToothIndexForHalfBeat(halfBeatIndex);
    const lever = leverStateAtCoordinate(halfBeatIndex + halfPhase);
    return rotate2(
      toothTipPoint(wheelAngle, toothIndex).sub(leverPivot),
      -lever.angle,
    );
  };
  const contactAtState = ({
    halfBeatIndex,
    halfPhase,
    leverAngle,
    wheelAngle,
  }) => {
    let mode;
    let profilePhase;
    let side;
    let toothIndex;
    if (halfPhase <= releaseHalfPhase) {
      mode = 'lock';
      profilePhase = halfPhase;
      side = sideForHalfBeat(halfBeatIndex);
      toothIndex = activeToothIndexForHalfBeat(halfBeatIndex);
    } else if (halfPhase < impulseEndHalfPhase) {
      mode = 'impulse';
      profilePhase = halfPhase;
      side = sideForHalfBeat(halfBeatIndex);
      toothIndex = activeToothIndexForHalfBeat(halfBeatIndex);
    } else if (halfPhase < landingHalfPhase) {
      return null;
    } else {
      mode = 'lock';
      profilePhase = 1 - halfPhase;
      side = sideForHalfBeat(halfBeatIndex + 1);
      toothIndex = activeToothIndexForHalfBeat(halfBeatIndex + 1);
    }
    const actualPoint = toothTipPoint(wheelAngle, toothIndex);
    const expectedLocalPoint = palletFaceLocalPoint(side, profilePhase);
    const expectedPoint = rotate2(expectedLocalPoint, leverAngle)
      .add(leverPivot);
    return {
      actualPoint,
      error: actualPoint.distanceTo(expectedPoint),
      expectedLocalPoint,
      expectedPoint,
      mode,
      profilePhase,
      side,
      toothIndex,
    };
  };

  const upperDirection = upperBalanceCenter.clone().normalize();
  const leftDirection = leftBalanceCenter.clone().normalize();
  const externalPitchPoint = upperDirection.clone().multiplyScalar(
    externalSectorPitchRadius,
  );
  const internalPitchPoint = leftDirection.clone().multiplyScalar(
    internalSectorPitchRadius,
  );
  const tangentialVelocity = (radiusVector, angularSpeed) => (
    new THREE.Vector2(
      -angularSpeed * radiusVector.y,
      angularSpeed * radiusVector.x,
    )
  );

  const stateAtTime = (time) => {
    const halfBeatCoordinate = time / halfBeatDuration;
    const halfBeatIndex = Math.floor(halfBeatCoordinate);
    const halfPhase = halfBeatCoordinate - halfBeatIndex;
    const cycleCoordinate = time / balancePeriod;
    const cyclePhase = positiveModulo(cycleCoordinate, 1);
    const lever = leverStateAtCoordinate(halfBeatCoordinate);
    const wheelStep = wheelStepAtHalfPhase(halfPhase);
    const wheelAngle = wheelAngleAtHalfBeatLanding(halfBeatIndex)
      - wheelStep.advance;
    const upperBalanceAngle = upperPinionPhaseOffset
      - externalRatio * lever.angle;
    const upperBalanceAngularSpeed = -externalRatio * lever.speed;
    const upperBalanceAngularAcceleration = -externalRatio
      * lever.acceleration;
    const leftBalanceAngle = leftPinionPhaseOffset
      + internalRatio * lever.angle;
    const leftBalanceAngularSpeed = internalRatio * lever.speed;
    const leftBalanceAngularAcceleration = internalRatio
      * lever.acceleration;
    const externalRackVelocity = tangentialVelocity(
      externalPitchPoint,
      lever.speed,
    );
    const externalPinionVelocity = tangentialVelocity(
      externalPitchPoint.clone().sub(upperBalanceCenter),
      upperBalanceAngularSpeed,
    );
    const internalRackVelocity = tangentialVelocity(
      internalPitchPoint,
      lever.speed,
    );
    const internalPinionVelocity = tangentialVelocity(
      internalPitchPoint.clone().sub(leftBalanceCenter),
      leftBalanceAngularSpeed,
    );
    const contact = contactAtState({
      halfBeatIndex,
      halfPhase,
      leverAngle: lever.angle,
      wheelAngle,
    });
    return {
      activePalletContact: contact,
      counterRotationProduct:
        upperBalanceAngularSpeed * leftBalanceAngularSpeed,
      cycleCoordinate,
      cyclePhase,
      externalGearPhaseResidual:
        externalSectorPitchRadius * lever.angle
        + pinionPitchRadius
          * (upperBalanceAngle - upperPinionPhaseOffset),
      externalPitchPoint,
      externalPitchVelocityError: externalRackVelocity.clone()
        .sub(externalPinionVelocity),
      halfBeatCoordinate,
      halfBeatIndex,
      halfPhase,
      internalGearPhaseResidual:
        internalSectorPitchRadius * lever.angle
        - pinionPitchRadius
          * (leftBalanceAngle - leftPinionPhaseOffset),
      internalPitchPoint,
      internalPitchVelocityError: internalRackVelocity.clone()
        .sub(internalPinionVelocity),
      leftBalanceAngle,
      leftBalanceAngularAcceleration,
      leftBalanceAngularSpeed,
      leverAngle: lever.angle,
      leverAngularAcceleration: lever.acceleration,
      leverAngularSpeed: lever.speed,
      upperBalanceAngle,
      upperBalanceAngularAcceleration,
      upperBalanceAngularSpeed,
      wheelAdvance: wheelStep.advance,
      wheelAngle,
      wheelAngularAcceleration: -wheelStep.acceleration,
      wheelAngularSpeed: -wheelStep.rate,
      wheelEvent: wheelStep.event,
      wheelEventProgress: wheelStep.progress,
    };
  };

  const framePlaneZ = -0.32;
  const framePoints = [
    leftBalanceCenter,
    upperBalanceCenter,
    leverPivot,
    escapeWheelCenter,
  ];
  const frameEdges = [
    [0, 1],
    [0, 2],
    [1, 2],
    [2, 3],
  ];
  const frameBars = frameEdges.map(([startIndex, endIndex], index) => {
    const start = framePoints[startIndex];
    const end = framePoints[endIndex];
    const bar = beamBetween(
      new THREE.Vector3(start.x, start.y, framePlaneZ),
      new THREE.Vector3(end.x, end.y, framePlaneZ),
      0.10,
      0.11,
      frameMaterial,
    );
    bar.userData.role = `fixed-rear-bearing-frame-bar-${index + 1}`;
    root.add(bar);
    return bar;
  });

  const upperBalance = makeBalance({
    balanceRadius,
    bearingMaterial,
    center: upperBalanceCenter,
    drivenMaterial,
    indexMaterial,
    label: 'upper-external-mesh',
    pinionRadius: pinionPitchRadius,
    pinionTeeth,
    toothMaterial,
  });
  const leftBalance = makeBalance({
    balanceRadius,
    bearingMaterial,
    center: leftBalanceCenter,
    drivenMaterial,
    indexMaterial,
    label: 'left-internal-mesh',
    pinionRadius: pinionPitchRadius,
    pinionTeeth,
    toothMaterial,
  });
  root.add(
    upperBalance.bearing,
    upperBalance.balance,
    upperBalance.shaft,
    leftBalance.bearing,
    leftBalance.balance,
    leftBalance.shaft,
  );

  const escape = makeEscapeWheel({
    bearingMaterial,
    depth: 0.24,
    indexMaterial,
    innerRadius: escapeWheelInnerRadius,
    material: driverMaterial,
    rootRadius: escapeWheelRootRadius,
    tipRadius: escapeWheelTipRadius,
    toothCount: escapeToothCount,
  });
  escape.wheel.position.set(
    escapeWheelCenter.x,
    escapeWheelCenter.y,
    0.25,
  );
  const escapeBearing = cylinderAlongZ(0.25, 0.30, bearingMaterial, 40);
  escapeBearing.position.set(
    escapeWheelCenter.x,
    escapeWheelCenter.y,
    -0.16,
  );
  escapeBearing.userData.role = 'fixed-escape-wheel-bearing';
  const escapeShaft = cylinderAlongZ(0.075, 0.92, bearingMaterial, 28);
  escapeShaft.position.set(
    escapeWheelCenter.x,
    escapeWheelCenter.y,
    0.20,
  );
  escapeShaft.userData.role = 'fixed-axis-escape-wheel-arbor';
  root.add(escapeBearing, escape.wheel, escapeShaft);

  const compoundLever = new THREE.Group();
  compoundLever.position.set(leverPivot.x, leverPivot.y, 0.36);
  compoundLever.userData.role =
    'single-rigid-pivoted-lever-B-carrying-anchor-A-and-both-toothed-sectors';
  root.add(compoundLever);

  const externalRack = makeSectorRack({
    bodyMaterial: drivenMaterial,
    centerAngle: upperCenterAngle,
    depth: 0.18,
    internal: false,
    module: gearModule,
    pitchRadius: externalSectorPitchRadius,
    role:
      'external-toothed-sector-on-B-driving-upper-balance-pinion',
    span: externalSectorSpan,
    toothMaterial,
  });
  const internalRack = makeSectorRack({
    bodyMaterial: drivenMaterial,
    centerAngle: leftCenterAngle,
    depth: 0.18,
    internal: true,
    module: gearModule,
    pitchRadius: internalSectorPitchRadius,
    role:
      'internal-toothed-sector-on-B-driving-left-balance-pinion',
    span: internalSectorSpan,
    toothMaterial,
  });
  compoundLever.add(externalRack, internalRack);

  const rackArms = [
    [
      upperCenterAngle + externalSectorSpan * 0.33,
      externalSectorPitchRadius - 0.09,
      'lever-B-arm-to-external-sector',
    ],
    [
      leftCenterAngle - internalSectorSpan * 0.33,
      internalSectorPitchRadius + 0.09,
      'lever-B-arm-to-internal-sector',
    ],
  ].map(([angle, length, role]) => {
    const arm = beamBetween(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(
        Math.cos(angle) * length,
        Math.sin(angle) * length,
        0,
      ),
      0.16,
      0.16,
      drivenMaterial,
    );
    arm.userData.role = role;
    compoundLever.add(arm);
    return arm;
  });

  const palletProfiles = {};
  const palletBodies = [];
  const palletWorkingEdges = [];
  const anchorArms = [];
  for (const side of ['upper', 'lower']) {
    const lockPoints = Array.from({ length: 49 }, (_, index) => (
      palletFaceLocalPoint(
        side,
        releaseHalfPhase * index / 48,
      )
    ));
    const impulsePoints = Array.from({ length: 33 }, (_, index) => (
      palletFaceLocalPoint(
        side,
        THREE.MathUtils.lerp(
          releaseHalfPhase,
          impulseEndHalfPhase,
          index / 32,
        ),
      )
    ));
    const workingPoints = [...lockPoints, ...impulsePoints.slice(1)];
    const palletBody = edgeTube(
      workingPoints,
      0,
      0.12,
      palletMaterial,
    );
    palletBody.userData.role = `${side}-pallet-of-anchor-A`;
    const workingEdge = edgeTube(
      workingPoints,
      0.11,
      0.025,
      indexMaterial,
    );
    workingEdge.userData.role = `${side}-pallet-working-face`;
    const middle = workingPoints[Math.floor(workingPoints.length / 2)];
    const arm = beamBetween(
      new THREE.Vector3(0, 0, -0.02),
      new THREE.Vector3(middle.x * 0.93, middle.y * 0.93, -0.02),
      0.17,
      0.15,
      drivenMaterial,
    );
    arm.userData.role = `${side}-rigid-arm-of-anchor-A`;
    palletProfiles[side] = {
      impulsePoints,
      lockPoints,
      workingPoints,
    };
    palletBodies.push(palletBody);
    palletWorkingEdges.push(workingEdge);
    anchorArms.push(arm);
    compoundLever.add(arm, palletBody, workingEdge);
  }

  const leverHub = cylinderAlongZ(0.19, 0.46, bearingMaterial, 36);
  leverHub.position.z = 0.05;
  leverHub.userData.role = 'lever-B-pivot-hub';
  compoundLever.add(leverHub);
  const leverBearing = cylinderAlongZ(0.25, 0.30, bearingMaterial, 40);
  leverBearing.position.set(leverPivot.x, leverPivot.y, -0.15);
  leverBearing.userData.role = 'fixed-lever-B-bearing';
  const leverShaft = cylinderAlongZ(0.07, 1.00, bearingMaterial, 28);
  leverShaft.position.set(leverPivot.x, leverPivot.y, 0.23);
  leverShaft.userData.role = 'fixed-axis-lever-B-arbor';
  root.add(leverBearing, leverShaft);

  const pitchMarkers = [
    [externalPitchPoint, 'external-sector-upper-pinion-pitch-point'],
    [internalPitchPoint, 'internal-sector-left-pinion-pitch-point'],
  ].map(([point, role]) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 16, 12),
      indexMaterial,
    );
    marker.position.set(point.x, point.y, 0.54);
    marker.userData.role = role;
    root.add(marker);
    return marker;
  });
  const palletContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 18, 14),
    indexMaterial,
  );
  palletContactMarker.userData.role =
    'visible-active-escape-tooth-pallet-contact';
  root.add(palletContactMarker);

  const update = (time) => {
    const state = stateAtTime(time);
    compoundLever.rotation.z = state.leverAngle;
    upperBalance.balance.rotation.z = state.upperBalanceAngle;
    leftBalance.balance.rotation.z = state.leftBalanceAngle;
    escape.rotor.rotation.z = state.wheelAngle;
    palletContactMarker.visible = state.activePalletContact !== null;
    if (state.activePalletContact) {
      palletContactMarker.position.set(
        state.activePalletContact.actualPoint.x,
        state.activePalletContact.actualPoint.y,
        0.60,
      );
    }
    root.userData.contacts = {
      escapeWheelToAnchorPallet: state.activePalletContact
        ? {
          error: state.activePalletContact.error,
          mode: state.activePalletContact.mode,
          pallet: state.activePalletContact.side,
          toothIndex: state.activePalletContact.toothIndex,
        }
        : null,
      externalSectorToUpperPinion: {
        phaseResidual: state.externalGearPhaseResidual,
        pitchPoint: state.externalPitchPoint,
        velocityError: state.externalPitchVelocityError,
      },
      internalSectorToLeftPinion: {
        phaseResidual: state.internalGearPhaseResidual,
        pitchPoint: state.internalPitchPoint,
        velocityError: state.internalPitchVelocityError,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData = {
    archetype:
      'guernsey-single-anchor-lever-with-external-and-internal-toothed-sectors-driving-two-counter-oscillating-balance-wheels',
    blocks: {
      anchorArms,
      compoundLever,
      escapeBearing,
      escapeShaft,
      escapeWheel: escape.wheel,
      escapeWheelAngularIndex: escape.angularIndex,
      escapeWheelHub: escape.hub,
      escapeWheelRim: escape.rim,
      escapeWheelRotor: escape.rotor,
      escapeWheelSpokes: escape.spokes,
      escapeWheelTeeth: escape.teeth,
      externalRack,
      frameBars,
      internalRack,
      leftBalance,
      leverBearing,
      leverHub,
      leverShaft,
      palletBodies,
      palletContactMarker,
      palletWorkingEdges,
      pitchMarkers,
      rackArms,
      upperBalance,
    },
    constraints: {
      anchor:
        'Brown’s anchor A, lever B, both rack sectors, and both pallets form one rigid body about one fixed axis.',
      escapement:
        'The powered escape wheel alternates exact synthesized locking and impulse contact with the two pallet working faces, advances one half tooth per beat, and dwells between releases.',
      externalMesh:
        'The outward-facing sector pitch radius plus upper pinion pitch radius equals their fixed center distance; no-slip pitch motion imposes thetaUpper=-(Rext/r)thetaB.',
      internalMesh:
        'The inward-facing sector pitch radius minus left pinion pitch radius equals their fixed center distance; no-slip pitch motion imposes thetaLeft=+(Rint/r)thetaB.',
      sharedDrive:
        'Both balance wheels are constrained by the two tooth flanks on the same lever B and receive the one escape wheel’s drive through anchor A; there is no independent second drive.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'lever B and rigid anchor A oscillation',
        'upper balance angle through the external sector mesh',
        'left balance angle through the internal sector mesh',
        'intermittent escape-wheel angle through alternating pallet events',
      ],
      independentPrescribedInputs: 1,
      inputs: ['idealized repeated escapement phase'],
      note:
        'The source fixes topology and opposite oscillation, but not inertia, balance springs, force, lift, drop, draw, or timing; a smooth quasi-static event cycle is prescribed.',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid escape wheel, lever, anchor, rack sectors, pinions, balances, shafts, and frame',
        'zero backlash and exact pitch-line rolling in both sector-pinion meshes',
        'zero-clearance revolute bearings and synthesized conjugate pallet faces',
        'balance springs, tooth elasticity, friction, impact, inertia, and external jar loads omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless event-driven planar escapement kinematics',
    },
    fidelity: 'authored',
    geometry: {
      balancePeriod,
      balanceRadius,
      escapeToothCount,
      escapeToothPitch,
      escapeWheelCenter,
      escapeWheelInnerRadius,
      escapeWheelRootRadius,
      escapeWheelTipRadius,
      externalRatio,
      externalSectorPitchRadius,
      externalSectorSpan,
      gearModule,
      halfBeatDuration,
      halfToothAdvance,
      impulseEndHalfPhase,
      internalRatio,
      internalSectorPitchRadius,
      internalSectorSpan,
      landingHalfPhase,
      leftBalanceCenter,
      leftCenterAngle,
      leftCenterDistance,
      leftPinionPhaseOffset,
      leverAmplitude,
      leverPivot,
      lowerPalletReferenceAngle,
      palletIndexOffset,
      palletSpanTeeth,
      pinionPitchRadius,
      pinionAngularPitch,
      pinionTeeth,
      releaseHalfPhase,
      sourceImageHeight,
      sourceImageWidth,
      sourceScale,
      upperBalanceCenter,
      upperCenterAngle,
      upperCenterDistance,
      upperPalletReferenceAngle,
      upperPinionPhaseOffset,
    },
    mechanism:
      'one powered escape wheel alternately locks and impulses anchor A rigidly fixed to lever B; the opposite end of B carries one external and one internal circular toothed sector whose fixed-axis pinion meshes force two balance wheels to oscillate at the same frequency in opposite directions',
    motion: {
      balancePeriod,
      eventsPerBalanceCycle: 2,
      escapeWheelAdvancePerBalanceCycle: escapeToothPitch,
      escapeWheelCyclesPerRevolution: escapeToothCount,
      halfBeatDuration,
      halfToothAdvance,
      sequence:
        'current pallet lock -> tooth release and pallet impulse -> free drop -> opposite pallet lock -> repeat in the opposite lever direction',
    },
    palletFaceLocalPoint,
    palletProfiles,
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      officialPageAnimatedTabDisabled: true,
      reason:
        'The official Movement 402 page renders Animated as unavailable and supplies only Brown’s static engraving and description.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePointToModel,
    sourceReference: {
      brownPlate402: {
        escapeWheelCenterApproximatePixels: [385, 384],
        imageHeight: sourceImageHeight,
        imageWidth: sourceImageWidth,
        leftBalanceCenterApproximatePixels: [159, 299],
        leverPivotBApproximatePixels: [303, 328],
        measurementUncertaintyPixels: 8,
        sourceCountedEscapeToothCount: escapeToothCount,
        upperBalanceCenterApproximatePixels: [263, 229],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'two balance-wheels are carried by the same driving-power',
          'the two balance-wheels oscillate in opposite directions',
          'anchor A is secured to lever B',
          'B carries one interior and one exterior toothed segment',
          'each segment gears with one balance-wheel pinion',
        ],
        engravingEvidence:
          'The plate shows two overlapping balance rims on fixed centers, a pinion at each center, a single pivot on B, two opposed curved rack flanks rigid with B, anchor A on the other end, and one escape wheel.',
        reconstructionDisclosure:
          'Brown and the patent give no dimensions, pinion tooth counts, pallet lift/drop geometry, balance amplitude, speed, force, or timing. Centers and proportions are normalized from the plate; conjugate sector radii follow those centers; a smooth lock/impulse/drop schedule and exact working-face loci are independently synthesized.',
      },
      officialPage: movement.sourceUrl,
      usPatent35373: {
        date: '1862-05-27',
        figureUsed: 6,
        inventor: 'Calvin O. Guernsey',
        nameDiscrepancy:
          'Brown’s caption prints “G. O. Guernsey”; the original patent plate and specification identify “C. O. Guernsey,” Calvin O. Guernsey.',
        number: 'US35373A',
        operationalEvidence:
          'The specification states the object is two balance wheels carried by the same driving power and oscillating in opposite directions so a jar accelerating one retards the other; Figure 6 depicts the lever-watch arrangement reproduced by Brown.',
        pdf:
          'https://patentimages.storage.googleapis.com/c3/82/8d/9d352d4cfb9d4e/US35373.pdf',
        url: 'https://patents.google.com/patent/US35373A/en',
      },
    },
    stateAtTime,
    timeline: {
      balancePeriod,
      halfBeatDuration,
      sourcePosePhase: 0,
    },
    toothTipPoint,
    transmission: {
      balanceFrequencyRelation:
        'both balance angles are fixed multiples of the same lever coordinate, so their frequencies are identical while their instantaneous angular velocities have opposite signs',
      externalMeshRatio: -externalRatio,
      externalPitchClosure:
        'externalSectorPitchRadius + pinionPitchRadius = upper center distance',
      internalMeshRatio: internalRatio,
      internalPitchClosure:
        'internalSectorPitchRadius - pinionPitchRadius = left center distance',
      sharedInputCount: 1,
    },
    update,
    wheelAngleAtHalfBeatLanding,
    wheelStepAtHalfPhase,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.16, -2.08, -0.56),
    new THREE.Vector3(2.52, 3.26, 0.92),
  );
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraDirection = new THREE.Vector3(4.6, 3.2, 14.2);
  root.userData.groundFloorY = -2.10;
  markShadows(root);
  update(0);
  return { root, update };
}

export function createAuthoredGuernseyEscapementMovement(movement) {
  if (movement.id !== 402) return null;
  return guernseyCounterOscillatingEscapement(movement);
}
