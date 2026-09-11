import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
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

function updateCylinderBetween(cylinder, start, end) {
  const delta = end.clone().sub(start);
  const length = delta.length();
  cylinder.position.copy(start).add(end).multiplyScalar(0.5);
  cylinder.quaternion.setFromUnitVectors(
    Y_AXIS,
    delta.clone().multiplyScalar(1 / length),
  );
  cylinder.scale.set(1, length, 1);
}

function makeDynamicRod(radius, material, role) {
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 1, 24),
    material,
  );
  rod.userData.role = role;
  rod.userData.setEndpoints = (start, end) => {
    updateCylinderBetween(rod, start, end);
  };
  return rod;
}

function makeTubeThrough(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, points.length * 4, radius, 10, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function arcPoints(center, radius, startAngle, endAngle, z, count = 72) {
  const points = [];
  for (let index = 0; index <= count; index += 1) {
    const angle = THREE.MathUtils.lerp(
      startAngle,
      endAngle,
      index / count,
    );
    points.push(new THREE.Vector3(
      center.x + radius * Math.cos(angle),
      center.y + radius * Math.sin(angle),
      z,
    ));
  }
  return points;
}

function crossZ(left, right) {
  return left.x * right.y - left.y * right.x;
}

function normalizeAngle(angle) {
  return THREE.MathUtils.euclideanModulo(angle, FULL_TURN);
}

function doubleQuadrantEngine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;

  // These are the coordinates used by the official Movement 423 Canvas model.
  const sourceCrankPin = new THREE.Vector3(-0.395084, 1.133097, 0);
  const crankCenter = new THREE.Vector3(0, 0, 0);
  const crankRadius = sourceCrankPin.length();
  const sourceCrankAngle = Math.atan2(
    sourceCrankPin.y,
    sourceCrankPin.x,
  );
  const topFixedPivot = new THREE.Vector3(-3.509319, 0, 0);
  const bottomFixedPivot = new THREE.Vector3(3.509319, 0, 0);
  const connectingRodLength = 3;
  const sourceTopPerimeterPoint = new THREE.Vector3(
    -0.154641,
    2.999355,
    0,
  );
  const sourceBottomPerimeterPoint = new THREE.Vector3(
    0.154641,
    -2.999355,
    0,
  );
  const pistonRockerRadius = topFixedPivot.distanceTo(
    sourceTopPerimeterPoint,
  );
  const groundPivotSpacing = topFixedPivot.distanceTo(bottomFixedPivot);

  const sourceValvePivot = new THREE.Vector3(3.209319, 2.071104, 0);
  const sourceValvePose0End = new THREE.Vector3(4.160491, 2.379766, 0);
  const sourceValvePose1End = new THREE.Vector3(4.160180, 1.761484, 0);
  const sourceValvePose0Angle = Math.atan2(
    sourceValvePose0End.y - sourceValvePivot.y,
    sourceValvePose0End.x - sourceValvePivot.x,
  );
  const sourceValvePose1Angle = Math.atan2(
    sourceValvePose1End.y - sourceValvePivot.y,
    sourceValvePose1End.x - sourceValvePivot.x,
  );
  const valveCenterAngle = (
    sourceValvePose0Angle + sourceValvePose1Angle
  ) / 2;
  const valveAngularAmplitude = (
    sourceValvePose0Angle - sourceValvePose1Angle
  ) / 2;
  const valveBladeLength = (
    sourceValvePivot.distanceTo(sourceValvePose0End)
      + sourceValvePivot.distanceTo(sourceValvePose1End)
  ) / 2;

  const solveRockerAtInputAngle = (fixedPivot, inputAngle) => {
    const crankAngle = sourceCrankAngle - inputAngle;
    const crankRadial = new THREE.Vector3(
      Math.cos(crankAngle),
      Math.sin(crankAngle),
      0,
    );
    const crankTangent = new THREE.Vector3(
      -crankRadial.y,
      crankRadial.x,
      0,
    );
    const crankPin = crankCenter.clone().addScaledVector(
      crankRadial,
      crankRadius,
    );
    const crankPinPrime = crankTangent.clone().multiplyScalar(-crankRadius);
    const crankPinSecond = crankRadial.clone().multiplyScalar(-crankRadius);

    const pivotToCrank = crankPin.clone().sub(fixedPivot);
    const centerDistance = pivotToCrank.length();
    const centerDirection = pivotToCrank.clone().multiplyScalar(
      1 / centerDistance,
    );
    const positiveNormal = new THREE.Vector3(
      -centerDirection.y,
      centerDirection.x,
      0,
    );
    const intersectionAlong = (
      pistonRockerRadius ** 2
        - connectingRodLength ** 2
        + centerDistance ** 2
    ) / (2 * centerDistance);
    const intersectionHeight = Math.sqrt(Math.max(
      0,
      pistonRockerRadius ** 2 - intersectionAlong ** 2,
    ));
    const intersectionBase = fixedPivot.clone()
      .addScaledVector(centerDirection, intersectionAlong);

    // The official add_c_rod_r construction selects this positive-normal
    // intersection for both B pistons throughout the complete cycle.
    const wristPin = intersectionBase.clone().addScaledVector(
      positiveNormal,
      intersectionHeight,
    );
    const pistonRadial = wristPin.clone().sub(fixedPivot)
      .multiplyScalar(1 / pistonRockerRadius);
    const pistonTangent = new THREE.Vector3(
      -pistonRadial.y,
      pistonRadial.x,
      0,
    );
    const connectingRodVector = wristPin.clone().sub(crankPin);
    const angularConstraintDenominator = pistonRockerRadius
      * connectingRodVector.dot(pistonTangent);
    const pistonAnglePrime = connectingRodVector.dot(crankPinPrime)
      / angularConstraintDenominator;
    const wristPinPrime = pistonTangent.clone().multiplyScalar(
      pistonRockerRadius * pistonAnglePrime,
    );
    const connectingRodVectorPrime = wristPinPrime.clone().sub(
      crankPinPrime,
    );
    const pistonAngleSecond = (
      connectingRodVector.dot(crankPinSecond)
        + pistonRockerRadius
          * connectingRodVector.dot(pistonRadial)
          * pistonAnglePrime ** 2
        - connectingRodVectorPrime.lengthSq()
    ) / angularConstraintDenominator;
    const wristPinSecond = pistonTangent.clone().multiplyScalar(
      pistonRockerRadius * pistonAngleSecond,
    ).addScaledVector(
      pistonRadial,
      -pistonRockerRadius * pistonAnglePrime ** 2,
    );
    const connectingRodVectorSecond = wristPinSecond.clone().sub(
      crankPinSecond,
    );
    const connectingRodAngle = Math.atan2(
      connectingRodVector.y,
      connectingRodVector.x,
    );
    const connectingRodAnglePrime = crossZ(
      connectingRodVector,
      connectingRodVectorPrime,
    ) / connectingRodLength ** 2;
    const connectingRodAngleSecond = crossZ(
      connectingRodVector,
      connectingRodVectorSecond,
    ) / connectingRodLength ** 2;

    return {
      angularConstraintDenominator,
      assemblyInnerMargin:
        centerDistance - Math.abs(
          pistonRockerRadius - connectingRodLength,
        ),
      assemblyOuterMargin:
        pistonRockerRadius + connectingRodLength - centerDistance,
      branchCross: crossZ(
        centerDirection,
        wristPin.clone().sub(intersectionBase),
      ),
      centerDirection,
      centerDistance,
      connectingRodAngle,
      connectingRodAnglePrime,
      connectingRodAngleSecond,
      connectingRodLengthResidual:
        connectingRodVector.length() - connectingRodLength,
      connectingRodVector,
      connectingRodVectorPrime,
      connectingRodVectorSecond,
      crankAngle,
      crankPin,
      crankPinPrime,
      crankPinSecond,
      intersectionAlong,
      intersectionBase,
      intersectionHeight,
      pistonAngle: Math.atan2(pistonRadial.y, pistonRadial.x),
      pistonAnglePrime,
      pistonAngleSecond,
      pistonRadial,
      pistonRadiusResidual:
        wristPin.distanceTo(fixedPivot) - pistonRockerRadius,
      pistonTangent,
      wristPin,
      wristPinPrime,
      wristPinSecond,
    };
  };

  const findRateRoot = (fixedPivot, lower, upper) => {
    let low = lower;
    let high = upper;
    let lowRate = solveRockerAtInputAngle(
      fixedPivot,
      low,
    ).pistonAnglePrime;
    for (let iteration = 0; iteration < 80; iteration += 1) {
      const middle = (low + high) / 2;
      const middleRate = solveRockerAtInputAngle(
        fixedPivot,
        middle,
      ).pistonAnglePrime;
      if (lowRate * middleRate <= 0) {
        high = middle;
      } else {
        low = middle;
        lowRate = middleRate;
      }
    }
    return (low + high) / 2;
  };

  const topOuterReversalInputAngle = findRateRoot(
    topFixedPivot,
    -0.02,
    0.02,
  );
  const topInnerReversalInputAngle = findRateRoot(
    topFixedPivot,
    Math.PI,
    Math.PI * 1.5,
  );
  const bottomInnerReversalInputAngle = findRateRoot(
    bottomFixedPivot,
    0,
    Math.PI / 2,
  );
  const bottomOuterReversalInputAngle = findRateRoot(
    bottomFixedPivot,
    Math.PI - 0.02,
    Math.PI + 0.02,
  );
  const powerStrokeAngularSpan = topInnerReversalInputAngle
    - topOuterReversalInputAngle;
  const returnStrokeAngularSpan = FULL_TURN - powerStrokeAngularSpan;
  const totalPowerOverlapAngularSpan = 2 * powerStrokeAngularSpan
    - FULL_TURN;
  const topOuterAngle = solveRockerAtInputAngle(
    topFixedPivot,
    topOuterReversalInputAngle,
  ).pistonAngle;
  const topInnerAngle = solveRockerAtInputAngle(
    topFixedPivot,
    topInnerReversalInputAngle,
  ).pistonAngle;
  const bottomInnerAngle = solveRockerAtInputAngle(
    bottomFixedPivot,
    bottomInnerReversalInputAngle,
  ).pistonAngle;
  const bottomOuterAngle = solveRockerAtInputAngle(
    bottomFixedPivot,
    bottomOuterReversalInputAngle,
  ).pistonAngle;
  const pistonAngularStroke = topOuterAngle - topInnerAngle;

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const top = solveRockerAtInputAngle(topFixedPivot, inputAngle);
    const bottom = solveRockerAtInputAngle(bottomFixedPivot, inputAngle);
    const crankAngle = sourceCrankAngle - inputAngle;
    const crankAngularSpeed = -inputSpeed;
    const crankAngularAcceleration = -inputAcceleration;
    const crankPinVelocity = top.crankPinPrime.clone().multiplyScalar(
      inputSpeed,
    );
    const crankPinAcceleration = top.crankPinSecond.clone()
      .multiplyScalar(inputSpeed ** 2)
      .addScaledVector(top.crankPinPrime, inputAcceleration);

    const finishRockerState = (rocker) => {
      const pistonAngularSpeed = rocker.pistonAnglePrime * inputSpeed;
      const pistonAngularAcceleration = rocker.pistonAngleSecond
        * inputSpeed ** 2
        + rocker.pistonAnglePrime * inputAcceleration;
      const wristPinVelocity = rocker.wristPinPrime.clone().multiplyScalar(
        inputSpeed,
      );
      const wristPinAcceleration = rocker.wristPinSecond.clone()
        .multiplyScalar(inputSpeed ** 2)
        .addScaledVector(rocker.wristPinPrime, inputAcceleration);
      const connectingRodVelocity = wristPinVelocity.clone().sub(
        crankPinVelocity,
      );
      const connectingRodAcceleration = wristPinAcceleration.clone().sub(
        crankPinAcceleration,
      );
      return {
        ...rocker,
        connectingRodAcceleration,
        connectingRodAccelerationConstraintResidual:
          connectingRodVelocity.lengthSq()
            + rocker.connectingRodVector.dot(connectingRodAcceleration),
        connectingRodAngularAcceleration:
          rocker.connectingRodAngleSecond * inputSpeed ** 2
            + rocker.connectingRodAnglePrime * inputAcceleration,
        connectingRodAngularSpeed:
          rocker.connectingRodAnglePrime * inputSpeed,
        connectingRodVelocity,
        connectingRodVelocityConstraintResidual:
          rocker.connectingRodVector.dot(connectingRodVelocity),
        pistonAngularAcceleration,
        pistonAngularSpeed,
        wristPinAcceleration,
        wristPinVelocity,
      };
    };

    const topPiston = finishRockerState(top);
    const bottomPiston = finishRockerState(bottom);
    const sine = Math.sin(inputAngle);
    const topPowerActive = top.pistonAnglePrime <= 0;
    const bottomPowerActive = bottom.pistonAnglePrime <= 0;
    const topInductionOpening = Math.max(0, sine);
    const bottomInductionOpening = Math.max(0, -sine);
    const valveAngle = valveCenterAngle - valveAngularAmplitude * sine;
    const valveAngularSpeed = -valveAngularAmplitude
      * Math.cos(inputAngle) * inputSpeed;
    const valveAngularAcceleration = valveAngularAmplitude * (
      sine * inputSpeed ** 2
        - Math.cos(inputAngle) * inputAcceleration
    );

    return {
      bottomInductionOpening,
      bottomPiston,
      bottomPowerActive,
      crankAngle,
      crankAngularAcceleration,
      crankAngularSpeed,
      crankPin: top.crankPin.clone(),
      crankPinAcceleration,
      crankPinClosureResidual: top.crankPin.distanceTo(bottom.crankPin),
      crankPinVelocity,
      inductionOpeningSum: topInductionOpening + bottomInductionOpening,
      inductionValveRoute: sine > 1e-12
        ? 'top-outer-side'
        : sine < -1e-12
          ? 'bottom-outer-side'
          : 'changeover-lap',
      inputAcceleration,
      inputAngle,
      inputSpeed,
      poweredPistonCount:
        Number(topPowerActive) + Number(bottomPowerActive),
      topInductionOpening,
      topPiston,
      topPowerActive,
      valveAngle,
      valveAngularAcceleration,
      valveAngularSpeed,
      valvePhaseConstraintResidual:
        valveAngle - valveCenterAngle + valveAngularAmplitude * sine,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...stateAtInputAngle(inputAngularSpeed * cycleTime),
      cycleTime,
      phase: cycleTime / cycleDuration,
    };
  };

  const geometry = {
    bottomFixedPivot: bottomFixedPivot.clone(),
    bottomInnerAngle,
    bottomInnerReversalInputAngle: normalizeAngle(
      bottomInnerReversalInputAngle,
    ),
    bottomOuterAngle,
    bottomOuterReversalInputAngle: normalizeAngle(
      bottomOuterReversalInputAngle,
    ),
    connectingRodLength,
    crankCenter: crankCenter.clone(),
    crankRadius,
    cycleDuration,
    groundPivotSpacing,
    inputAngularSpeed,
    pistonAngularStroke,
    pistonRockerRadius,
    powerStrokeAngularSpan,
    powerStrokeFraction: powerStrokeAngularSpan / FULL_TURN,
    returnStrokeAngularSpan,
    sourceCrankAngle,
    sourceCrankPin: sourceCrankPin.clone(),
    sourceBottomPerimeterPoint: sourceBottomPerimeterPoint.clone(),
    sourceTopPerimeterPoint: sourceTopPerimeterPoint.clone(),
    sourceValvePivot: sourceValvePivot.clone(),
    sourceValvePose0Angle,
    sourceValvePose0End: sourceValvePose0End.clone(),
    sourceValvePose1Angle,
    sourceValvePose1End: sourceValvePose1End.clone(),
    topFixedPivot: topFixedPivot.clone(),
    topInnerAngle,
    topInnerReversalInputAngle: normalizeAngle(
      topInnerReversalInputAngle,
    ),
    topOuterAngle,
    topOuterReversalInputAngle: normalizeAngle(
      topOuterReversalInputAngle,
    ),
    totalPowerOverlapAngularSpan,
    totalPowerOverlapFraction: totalPowerOverlapAngularSpan / FULL_TURN,
    valveAngularAmplitude,
    valveBladeLength,
    valveCenterAngle,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.24,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.33,
    roughness: 0.42,
  });
  const pistonMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    roughness: 0.47,
  });
  const rodMaterial = matte(PALETTE.driver, {
    metalness: 0.21,
    roughness: 0.46,
  });
  const valveMaterial = matte(0xd9a62b, {
    metalness: 0.23,
    roughness: 0.43,
  });
  const steamMaterial = matte(0xe66f4a, {
    opacity: 0.20,
    roughness: 0.60,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const exhaustMaterial = matte(0x4a93a8, {
    opacity: 0.17,
    roughness: 0.64,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(10.40, 0.28, 1.65),
    frameMaterial,
  );
  foundation.position.set(0, -5.02, -0.20);
  foundation.userData.role = 'fixed-foundation-of-double-quadrant-engine';
  root.add(foundation);

  const leftPedestal = beamBetween(
    new THREE.Vector3(-4.72, -4.90, -0.10),
    new THREE.Vector3(-4.12, 0.18, -0.10),
    0.34,
    0.75,
    frameMaterial,
  );
  leftPedestal.userData.role = 'left-fixed-cylinder-frame';
  root.add(leftPedestal);
  const rightPedestal = beamBetween(
    new THREE.Vector3(4.70, -4.90, -0.10),
    new THREE.Vector3(4.23, 0.28, -0.10),
    0.34,
    0.75,
    frameMaterial,
  );
  rightPedestal.userData.role = 'right-fixed-cylinder-frame';
  root.add(rightPedestal);

  const topSectorStart = topInnerAngle - 0.08;
  const topSectorEnd = topOuterAngle + 0.10;
  const bottomSectorStart = bottomInnerAngle - 0.10;
  const bottomSectorEnd = bottomOuterAngle + 0.08;
  const chamberOuterRadius = pistonRockerRadius + 0.38;
  const chamberInnerRadius = 0.42;

  const topChamberBack = new THREE.Mesh(
    new THREE.RingGeometry(
      chamberInnerRadius,
      chamberOuterRadius,
      64,
      1,
      topSectorStart,
      topSectorEnd - topSectorStart,
    ),
    steamMaterial,
  );
  topChamberBack.position.copy(topFixedPivot);
  topChamberBack.position.z = -0.38;
  topChamberBack.userData.role = 'cutaway-top-outer-steam-space';
  root.add(topChamberBack);
  const bottomChamberBack = new THREE.Mesh(
    new THREE.RingGeometry(
      chamberInnerRadius,
      chamberOuterRadius,
      64,
      1,
      bottomSectorStart,
      bottomSectorEnd - bottomSectorStart,
    ),
    steamMaterial,
  );
  bottomChamberBack.position.copy(bottomFixedPivot);
  bottomChamberBack.position.z = -0.38;
  bottomChamberBack.userData.role = 'cutaway-bottom-outer-steam-space';
  root.add(bottomChamberBack);

  const topCylinderWall = makeTubeThrough(
    arcPoints(
      topFixedPivot,
      chamberOuterRadius,
      topSectorStart,
      topSectorEnd,
      -0.02,
    ),
    0.18,
    frameMaterial,
    'fixed-curved-wall-of-top-quadrant-cylinder',
  );
  const bottomCylinderWall = makeTubeThrough(
    arcPoints(
      bottomFixedPivot,
      chamberOuterRadius,
      bottomSectorStart,
      bottomSectorEnd,
      -0.02,
    ),
    0.18,
    frameMaterial,
    'fixed-curved-wall-of-bottom-quadrant-cylinder',
  );
  root.add(topCylinderWall, bottomCylinderWall);

  const topEndWall = beamBetween(
    topFixedPivot.clone().add(new THREE.Vector3(
      chamberInnerRadius * Math.cos(topSectorEnd),
      chamberInnerRadius * Math.sin(topSectorEnd),
      -0.02,
    )),
    topFixedPivot.clone().add(new THREE.Vector3(
      chamberOuterRadius * Math.cos(topSectorEnd),
      chamberOuterRadius * Math.sin(topSectorEnd),
      -0.02,
    )),
    0.22,
    0.62,
    frameMaterial,
  );
  topEndWall.userData.role = 'top-quadrant-cylinder-end-wall';
  const bottomEndWall = beamBetween(
    bottomFixedPivot.clone().add(new THREE.Vector3(
      chamberInnerRadius * Math.cos(bottomSectorStart),
      chamberInnerRadius * Math.sin(bottomSectorStart),
      -0.02,
    )),
    bottomFixedPivot.clone().add(new THREE.Vector3(
      chamberOuterRadius * Math.cos(bottomSectorStart),
      chamberOuterRadius * Math.sin(bottomSectorStart),
      -0.02,
    )),
    0.22,
    0.62,
    frameMaterial,
  );
  bottomEndWall.userData.role = 'bottom-quadrant-cylinder-end-wall';
  root.add(topEndWall, bottomEndWall);

  const makePistonRocker = (fixedPivot, rolePrefix, z) => {
    const group = new THREE.Group();
    group.position.copy(fixedPivot);
    group.userData.role = `${rolePrefix}-single-acting-piston-B`;
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(pistonRockerRadius - 0.42, 0.30, 0.46),
      pistonMaterial,
    );
    arm.position.set((pistonRockerRadius + 0.42) / 2, 0, z);
    arm.userData.role = `${rolePrefix}-radial-body-of-piston-B`;
    group.add(arm);
    const sealingHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.78, 0.58),
      pistonMaterial,
    );
    sealingHead.position.set(pistonRockerRadius - 0.20, 0, z);
    sealingHead.userData.role = `${rolePrefix}-outer-sealing-head-of-piston-B`;
    group.add(sealingHead);
    const wristBearing = cylinderAlongZ(0.22, 0.72, whiteMaterial, 28);
    wristBearing.position.set(pistonRockerRadius, 0, z + 0.06);
    wristBearing.userData.role = `${rolePrefix}-piston-wrist-bearing`;
    group.add(wristBearing);
    return { arm, group, sealingHead, wristBearing };
  };

  const topPistonParts = makePistonRocker(
    topFixedPivot,
    'top',
    0.24,
  );
  const bottomPistonParts = makePistonRocker(
    bottomFixedPivot,
    'bottom',
    0.52,
  );
  root.add(topPistonParts.group, bottomPistonParts.group);

  const topPivotShaft = cylinderAlongZ(0.31, 1.18, darkMaterial, 32);
  topPivotShaft.position.copy(topFixedPivot);
  topPivotShaft.position.z = 0.18;
  topPivotShaft.userData.role = 'fixed-axis-of-top-single-acting-piston-B';
  const bottomPivotShaft = cylinderAlongZ(0.31, 1.18, darkMaterial, 32);
  bottomPivotShaft.position.copy(bottomFixedPivot);
  bottomPivotShaft.position.z = 0.30;
  bottomPivotShaft.userData.role =
    'fixed-axis-of-bottom-single-acting-piston-B';
  root.add(topPivotShaft, bottomPivotShaft);

  const crankRotor = new THREE.Group();
  crankRotor.position.copy(crankCenter);
  crankRotor.userData.role = 'continuously-rotating-common-crank-D';
  const crankDisk = cylinderAlongZ(1.05, 0.30, darkMaterial, 48);
  crankDisk.position.z = -0.30;
  crankDisk.userData.role = 'flywheel-reference-disk-behind-crank-D';
  root.add(crankDisk);
  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.24, 0.44),
    rodMaterial,
  );
  crankArm.position.set(crankRadius / 2, 0, 0.39);
  crankArm.userData.role = 'arm-of-common-crank-D';
  crankRotor.add(crankArm);
  const commonCrankPin = cylinderAlongZ(0.23, 1.08, whiteMaterial, 28);
  commonCrankPin.position.set(crankRadius, 0, 0.48);
  commonCrankPin.userData.role =
    'single-common-crank-pin-D-shared-by-both-connecting-rods';
  crankRotor.add(commonCrankPin);
  const crankShaft = cylinderAlongZ(0.28, 1.08, darkMaterial, 32);
  crankShaft.position.set(0, 0, 0.18);
  crankShaft.userData.role = 'fixed-axis-of-common-crank-D';
  root.add(crankRotor, crankShaft);

  const topConnectingRod = makeDynamicRod(
    0.12,
    rodMaterial,
    'top-connecting-rod-from-B-to-common-crank-pin-D',
  );
  const bottomConnectingRod = makeDynamicRod(
    0.12,
    rodMaterial,
    'bottom-connecting-rod-from-B-to-common-crank-pin-D',
  );
  root.add(topConnectingRod, bottomConnectingRod);

  const valveChest = cylinderAlongZ(0.92, 0.42, frameMaterial, 40);
  valveChest.position.copy(sourceValvePivot);
  valveChest.position.z = -0.20;
  valveChest.userData.role = 'fixed-chest-of-single-induction-valve-a';
  root.add(valveChest);
  const inductionValveA = new THREE.Group();
  inductionValveA.position.copy(sourceValvePivot);
  inductionValveA.userData.role =
    'single-rocking-induction-valve-a-for-both-outer-spaces';
  const valveBlade = new THREE.Mesh(
    new THREE.BoxGeometry(valveBladeLength, 0.34, 0.48),
    valveMaterial,
  );
  valveBlade.position.set(valveBladeLength / 2, 0, 0.36);
  valveBlade.userData.role = 'port-selecting-blade-of-induction-valve-a';
  inductionValveA.add(valveBlade);
  const valveHub = cylinderAlongZ(0.23, 0.80, darkMaterial, 30);
  valveHub.position.z = 0.28;
  valveHub.userData.role = 'fixed-axis-of-induction-valve-a';
  inductionValveA.add(valveHub);
  root.add(inductionValveA);

  const topAdmissionPassage = makeTubeThrough([
    sourceValvePivot.clone().add(new THREE.Vector3(-0.42, 0.42, -0.04)),
    new THREE.Vector3(1.38, 3.18, -0.04),
    new THREE.Vector3(-0.64, 4.47, -0.04),
    topFixedPivot.clone().add(new THREE.Vector3(0.45, 4.45, -0.04)),
  ], 0.13, frameMaterial,
  'top-passage-from-single-induction-valve-a-to-outer-steam-space');
  const bottomAdmissionPassage = makeTubeThrough([
    sourceValvePivot.clone().add(new THREE.Vector3(0.52, -0.35, -0.04)),
    new THREE.Vector3(4.25, 0.85, -0.04),
    new THREE.Vector3(4.48, -2.02, -0.04),
    bottomFixedPivot.clone().add(new THREE.Vector3(-0.20, -4.55, -0.04)),
  ], 0.13, frameMaterial,
  'bottom-passage-from-single-induction-valve-a-to-outer-steam-space');
  root.add(topAdmissionPassage, bottomAdmissionPassage);

  const inletPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 1.18, 24),
    frameMaterial,
  );
  inletPipe.position.set(sourceValvePivot.x, sourceValvePivot.y + 1.40, -0.04);
  inletPipe.userData.role = 'steam-inlet-to-single-induction-valve-a';
  root.add(inletPipe);

  const centralExhaustSpace = new THREE.Mesh(
    new THREE.CircleGeometry(1.62, 48),
    exhaustMaterial,
  );
  centralExhaustSpace.position.set(0, -0.54, -0.43);
  centralExhaustSpace.scale.set(1.0, 1.42, 1);
  centralExhaustSpace.userData.role =
    'common-central-exhaust-space-between-the-two-pistons';
  root.add(centralExhaustSpace);
  const exhaustPipe = makeTubeThrough([
    new THREE.Vector3(-1.02, -1.22, -0.18),
    new THREE.Vector3(-2.02, -2.78, -0.18),
    new THREE.Vector3(-2.18, -4.42, -0.18),
  ], 0.17, frameMaterial,
  'exhaust-passage-from-common-space-between-pistons');
  root.add(exhaustPipe);

  const topAdmissionIndicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 24, 16),
    steamMaterial,
  );
  topAdmissionIndicator.position.set(-0.72, 4.36, 0.14);
  topAdmissionIndicator.userData.role =
    'top-outer-side-induction-opening-indicator';
  const bottomAdmissionIndicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 24, 16),
    steamMaterial,
  );
  bottomAdmissionIndicator.position.set(3.58, -4.05, 0.14);
  bottomAdmissionIndicator.userData.role =
    'bottom-outer-side-induction-opening-indicator';
  root.add(topAdmissionIndicator, bottomAdmissionIndicator);

  const update = (time) => {
    const state = stateAtTime(time);
    crankRotor.rotation.z = state.crankAngle;
    topPistonParts.group.rotation.z = state.topPiston.pistonAngle;
    bottomPistonParts.group.rotation.z = state.bottomPiston.pistonAngle;
    inductionValveA.rotation.z = state.valveAngle;

    const crankTop = state.crankPin.clone();
    crankTop.z = 0.47;
    const topWrist = state.topPiston.wristPin.clone();
    topWrist.z = 0.47;
    topConnectingRod.userData.setEndpoints(crankTop, topWrist);
    const crankBottom = state.crankPin.clone();
    crankBottom.z = 0.75;
    const bottomWrist = state.bottomPiston.wristPin.clone();
    bottomWrist.z = 0.75;
    bottomConnectingRod.userData.setEndpoints(crankBottom, bottomWrist);

    topAdmissionIndicator.scale.setScalar(
      0.58 + 1.05 * state.topInductionOpening,
    );
    bottomAdmissionIndicator.scale.setScalar(
      0.58 + 1.05 * state.bottomInductionOpening,
    );
  };

  const sourceState = stateAtInputAngle(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'opposed-single-acting-quadrant-piston-four-bars-sharing-one-continuous-crank-with-overlapping-power-strokes',
    blocks: {
      bottomAdmissionIndicator,
      bottomAdmissionPassage,
      bottomChamberBack,
      bottomConnectingRod,
      bottomCylinderWall,
      bottomEndWall,
      bottomPiston: bottomPistonParts.group,
      bottomPistonArm: bottomPistonParts.arm,
      bottomPistonSeal: bottomPistonParts.sealingHead,
      bottomPivotShaft,
      centralExhaustSpace,
      commonCrankPin,
      crankArm,
      crankDisk,
      crankRotor,
      crankShaft,
      exhaustPipe,
      foundation,
      inductionValveA,
      inletPipe,
      leftPedestal,
      rightPedestal,
      topAdmissionIndicator,
      topAdmissionPassage,
      topChamberBack,
      topConnectingRod,
      topCylinderWall,
      topEndWall,
      topPiston: topPistonParts.group,
      topPistonArm: topPistonParts.arm,
      topPistonSeal: topPistonParts.sealingHead,
      topPivotShaft,
      valveBlade,
      valveChest,
    },
    degreesOfFreedom: {
      bottomPistonAngleIndependent: false,
      independentPrescribedInputs: 1,
      inductionValveAngleIndependent: false,
      operatingDegreesOfFreedom: 1,
      topPistonAngleIndependent: false,
    },
    dynamics: {
      commonCentralSpaceExhausted: true,
      crankFlywheelInertiaAndLoadsModeled: false,
      powerStrokeClassification:
        'A piston is on its forward power stroke where its rocker angle decreases with increasing clockwise crank input; this reproduces the source linkage duration but is not a pressure solution.',
      pressureExpansionCutoffLeakageFrictionAndValveFlowModeled: false,
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsPressuresOrLoads: false,
      valveIndicators:
        'The two translucent markers show the single induction valve’s selected outer passage; they are not separate valves or pressure solutions.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Root’s double-quadrant engine uses two opposed single-acting piston rockers B. Each B is a 4.5-unit rocker joined by its own 3-unit connecting rod to the very same pin of continuously rotating crank D. Exact positive-branch circle-circle closure leaves one operating degree of freedom. The asymmetric four-bars give each forward power stroke about 221 degrees—about two-thirds of a turn—with two overlap intervals and therefore no crank dead point. One rocking induction valve a alternately selects the outer steam spaces; the central space between both pistons is the common exhaust.',
    motion: {
      crankDirection: 'clockwise',
      crankRevolutionsPerCycle: 1,
      cycleDuration,
      inputAngularSpeed,
      pistonAngularStroke,
      powerStrokeAngularSpan,
      powerStrokeFraction: powerStrokeAngularSpan / FULL_TURN,
      totalPowerOverlapAngularSpan,
    },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      officialCanvasCyclePeriod: 4,
      officialCanvasCyclesPerMinute: 15,
      officialCanvasModelPresent: true,
      reason:
        'The official Movement 423 page embeds an eight-part Canvas construction. Its fixed pivots, common crank pin, 3-unit rods, 4.5-unit piston rockers, positive circle-intersection branches, clockwise crank direction, and rocking valve endpoints were extracted and independently reconstructed.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      bottomPistonAngle: sourceState.bottomPiston.pistonAngle,
      bottomWristPin: sourceState.bottomPiston.wristPin.clone(),
      crankAngle: sourceState.crankAngle,
      crankPin: sourceState.crankPin.clone(),
      topPistonAngle: sourceState.topPiston.pistonAngle,
      topWristPin: sourceState.topPiston.wristPin.clone(),
      valveAngle: sourceState.valveAngle,
    },
    sourceReference: {
      brownPlate423: {
        bottomFixedPivotApproximatePixels: [428, 274],
        bottomPistonWristApproximatePixels: [382, 452],
        commonCrankCenterApproximatePixels: [272, 270],
        commonCrankPinApproximatePixels: [304, 320],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 12,
        topFixedPivotApproximatePixels: [108, 269],
        topPistonWristApproximatePixels: [272, 130],
        valveAApproximateCenterPixels: [391, 159],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the engine works on the same principle as 422',
          'two single-acting pistons B, B are used',
          'both pistons connect with one crank D',
          'one induction valve a admits steam to the outer sides alternately',
          'the space between the pistons is the exhaust',
          'each piston receives steam for about two-thirds of a crank revolution',
          'the overlapping action leaves no dead points',
        ],
        engravingEvidence:
          'Brown’s cutaway plate shows opposed curved quadrant chambers, two outer piston pivots, two rods converging on one central crank pin D, one induction valve a at upper right, and an open common space between the pistons.',
        officialCanvasEvidence:
          'The official model places the fixed B pivots at (-3.509319,0) and (3.509319,0), gives each B a 4.5-unit radius and each connecting rod a 3-unit length, rotates one 1.2-unit crank clockwise from pin (-0.395084,1.133097), selects the positive circle-intersection branch for both rods, and rocks valve a between endpoint angles approximately +17.98 and -18.04 degrees.',
        reconstructionDisclosure:
          'Brown gives no absolute dimensions, port section, cutoff law, pressure history, speed, materials, flywheel inertia, loads, or sealing details. Housing thickness, cutaway depth, supports, colors, and admission/exhaust indicators are independently engineered; the linkage coordinates and valve phase come from the official model.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 423',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      bottomClosure:
        '|bottomWrist-bottomPivot|=4.5 and |bottomWrist-commonCrankPin|=3 on the positive circle-intersection branch',
      commonCrank:
        'both connecting rods terminate at the identical crank pin D=O+r[cos(sourceAngle-inputAngle),sin(sourceAngle-inputAngle)]',
      inductionValveLaw:
        'valveAngle=sourcePoseMean-sourceHalfStroke*sin(inputAngle)',
      noDeadPointCondition:
        'topPistonAnglePrime<=0 or bottomPistonAnglePrime<=0 for every crank angle; overlap=2*powerStrokeSpan-2*pi',
      topClosure:
        '|topWrist-topPivot|=4.5 and |topWrist-commonCrankPin|=3 on the positive circle-intersection branch',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.35, -5.18, -1.05),
    new THREE.Vector3(5.25, 5.40, 1.45),
  );
  root.userData.cameraDistanceScale = 1.00;
  root.userData.cameraDirection = new THREE.Vector3(5.8, 4.2, 13.4);
  root.userData.groundFloorY = -5.18;
  markShadows(root);
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredDoubleQuadrantEngineMovement(movement) {
  if (movement.id !== 423) return null;
  return doubleQuadrantEngine(movement);
}
