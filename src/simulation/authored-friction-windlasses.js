import { correctFriction280, finishFrictionFamily } from './friction-family-working-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeDynamicLink,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function centeredExtrusion(shape, depth, bevel = 0.01) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 1,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function cylinderAlongZ(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function ratchetToothShape(rootRadius, tipRadius, halfWidth) {
  const shape = new THREE.Shape();
  shape.moveTo(rootRadius - 0.03, -halfWidth);
  shape.lineTo(tipRadius, -halfWidth * 0.22);
  shape.lineTo(tipRadius, halfWidth * 0.24);
  shape.lineTo(rootRadius - 0.03, halfWidth);
  shape.closePath();
  return shape;
}

function quinticWindow(value, start, end) {
  if (value <= start) {
    return { acceleration: 0, position: 0, velocity: 0 };
  }
  if (value >= end) {
    return { acceleration: 0, position: 1, velocity: 0 };
  }
  const duration = end - start;
  const parameter = (value - start) / duration;
  const parameter2 = parameter * parameter;
  const oneMinus = 1 - parameter;
  return {
    acceleration: 60 * parameter * oneMinus * (1 - 2 * parameter)
      / duration ** 2,
    position: parameter2 * parameter
      * (10 - 15 * parameter + 6 * parameter2),
    velocity: 30 * parameter2 * oneMinus ** 2 / duration,
  };
}

function inverseQuintic(position) {
  let lower = 0;
  let upper = 1;
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    const midpoint2 = midpoint * midpoint;
    const value = midpoint2 * midpoint
      * (10 - 15 * midpoint + 6 * midpoint2);
    if (value < position) lower = midpoint;
    else upper = midpoint;
  }
  return (lower + upper) / 2;
}

function frictionWindlass(movement) {
  const root = new THREE.Group();

  // Brown's public-domain plate supplies the four visible pin centers and
  // the wheel envelope. The official Movement 280 page explicitly marks its
  // animation unavailable, so the clamp/release timing below is reconstructed
  // solely from the printed description and the closed linkage geometry.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.014;
  const sourceRasterWheelCenter = new THREE.Vector2(132, 356);
  const sourceRasterWheelOuterRight = new THREE.Vector2(244, 356);
  const sourceRasterWheelInnerRight = new THREE.Vector2(220, 356);
  const sourceRasterShortLeverPivot = new THREE.Vector2(263, 359);
  const sourceRasterLowerLinkPin = new THREE.Vector2(351, 357);
  const sourceRasterHandlePivot = new THREE.Vector2(408, 73);
  const sourceRasterUpperLinkPin = new THREE.Vector2(350, 79);
  const sourceRasterHandleElbow = new THREE.Vector2(465, 208);
  const sourceRasterGripTop = new THREE.Vector2(486, 383);
  const sourceRasterGripBottom = new THREE.Vector2(486, 472);
  const sourceRasterUpperPawlPivot = new THREE.Vector2(247, 232);
  const sourceRasterLowerPawlPivot = new THREE.Vector2(247, 276);

  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterWheelCenter.x) * sourceScale,
    (sourceRasterWheelCenter.y - y) * sourceScale,
  );
  const point3 = (point, z = 0) => {
    const modelPoint = sourcePointToModel(point);
    return new THREE.Vector3(modelPoint.x, modelPoint.y, z);
  };
  const wheelCenter = point3(sourceRasterWheelCenter);
  const wheelRadius = sourcePointToModel(sourceRasterWheelOuterRight).x;
  const wheelInnerRadius = sourcePointToModel(sourceRasterWheelInnerRight).x;
  const shortLeverPivot = point3(sourceRasterShortLeverPivot);
  const sourceLowerLinkPin = point3(sourceRasterLowerLinkPin);
  const handlePivot = point3(sourceRasterHandlePivot);
  const sourceUpperLinkPin = point3(sourceRasterUpperLinkPin);
  const inputCrankLength = sourceUpperLinkPin.distanceTo(handlePivot);
  const rockerLength = sourceLowerLinkPin.distanceTo(shortLeverPivot);
  const couplerLength = sourceLowerLinkPin.distanceTo(sourceUpperLinkPin);
  const sourceInputAngle = Math.atan2(
    sourceUpperLinkPin.y - handlePivot.y,
    sourceUpperLinkPin.x - handlePivot.x,
  );
  const sourceRockerAngle = Math.atan2(
    sourceLowerLinkPin.y - shortLeverPivot.y,
    sourceLowerLinkPin.x - shortLeverPivot.x,
  );
  const sourceHandleElbow = point3(sourceRasterHandleElbow);
  const sourceGripTop = point3(sourceRasterGripTop);
  const sourceGripBottom = point3(sourceRasterGripBottom);
  const toHandleLocal = (worldPoint) => worldPoint.clone()
    .sub(handlePivot)
    .applyAxisAngle(Z_AXIS, -sourceInputAngle);
  const localHandleElbow = toHandleLocal(sourceHandleElbow);
  const localGripTop = toHandleLocal(sourceGripTop);
  const localGripBottom = toHandleLocal(sourceGripBottom);

  const inputReturnAngle = sourceInputAngle + 0.35;
  const inputEngageAngle = sourceInputAngle + 0.22;
  const inputPowerAngle = sourceInputAngle - 0.35;
  const cyclePeriod = 4;
  const bottomDwellEnd = 0.06 * cyclePeriod;
  const takeupEnd = 0.18 * cyclePeriod;
  const driveEnd = 0.54 * cyclePeriod;
  const topDwellEnd = 0.60 * cyclePeriod;
  const returnEnd = 0.94 * cyclePeriod;
  const maximumShoeGap = 0.105;
  const ratchetToothCount = 36;
  const ratchetToothPitch = FULL_TURN / ratchetToothCount;
  const outputStopPitch = ratchetToothPitch / 2;
  const ratchetRootRadius = wheelRadius * 0.89;
  const ratchetTipRadius = wheelRadius * 0.985;
  const wheelContactRadius = wheelRadius * 0.94;
  const pawlMaximumLiftAngle = THREE.MathUtils.degToRad(8.5);

  const solveFourBarPosition = (inputAngle) => {
    const inputDirection = new THREE.Vector2(
      Math.cos(inputAngle),
      Math.sin(inputAngle),
    );
    const upperPin = new THREE.Vector2(handlePivot.x, handlePivot.y)
      .addScaledVector(inputDirection, inputCrankLength);
    const fromRockerPivot = upperPin.clone().sub(new THREE.Vector2(
      shortLeverPivot.x,
      shortLeverPivot.y,
    ));
    const centerDistance = fromRockerPivot.length();
    const along = fromRockerPivot.clone().divideScalar(centerDistance);
    const across = new THREE.Vector2(-along.y, along.x);
    const projection = (
      rockerLength ** 2 - couplerLength ** 2 + centerDistance ** 2
    ) / (2 * centerDistance);
    const height = Math.sqrt(Math.max(
      0,
      rockerLength ** 2 - projection ** 2,
    ));
    // This is the right/lower branch visible in Brown's plate. The other
    // circle intersection folds both links across the fixed pivots.
    const lowerPin = new THREE.Vector2(
      shortLeverPivot.x,
      shortLeverPivot.y,
    )
      .addScaledVector(along, projection)
      .addScaledVector(across, -height);
    const rockerAngle = Math.atan2(
      lowerPin.y - shortLeverPivot.y,
      lowerPin.x - shortLeverPivot.x,
    );
    return {
      centerDistance,
      lowerPin,
      rockerAngle,
      upperPin,
    };
  };

  const stateAtInputAngle = (
    inputAngle,
    inputAngularSpeed = 0,
    inputAngularAcceleration = 0,
  ) => {
    const position = solveFourBarPosition(inputAngle);
    const inputDirection = new THREE.Vector2(
      Math.cos(inputAngle),
      Math.sin(inputAngle),
    );
    const inputTangent = new THREE.Vector2(
      -Math.sin(inputAngle),
      Math.cos(inputAngle),
    );
    const rockerDirection = new THREE.Vector2(
      Math.cos(position.rockerAngle),
      Math.sin(position.rockerAngle),
    );
    const rockerTangent = new THREE.Vector2(
      -Math.sin(position.rockerAngle),
      Math.cos(position.rockerAngle),
    );
    const coupler = position.lowerPin.clone().sub(position.upperPin);
    const upperPinVelocity = inputTangent.clone()
      .multiplyScalar(inputCrankLength * inputAngularSpeed);
    const denominator = rockerLength * coupler.dot(rockerTangent);
    const rockerAngularSpeed = coupler.dot(upperPinVelocity) / denominator;
    const lowerPinVelocity = rockerTangent.clone()
      .multiplyScalar(rockerLength * rockerAngularSpeed);
    const upperPinAcceleration = inputTangent.clone()
      .multiplyScalar(inputCrankLength * inputAngularAcceleration)
      .addScaledVector(
        inputDirection,
        -inputCrankLength * inputAngularSpeed ** 2,
      );
    const relativeVelocity = lowerPinVelocity.clone()
      .sub(upperPinVelocity);
    const rockerAngularAcceleration = (
      coupler.dot(upperPinAcceleration.clone().addScaledVector(
        rockerDirection,
        rockerLength * rockerAngularSpeed ** 2,
      )) - relativeVelocity.lengthSq()
    ) / denominator;
    const lowerPinAcceleration = rockerTangent.clone()
      .multiplyScalar(rockerLength * rockerAngularAcceleration)
      .addScaledVector(
        rockerDirection,
        -rockerLength * rockerAngularSpeed ** 2,
      );

    return {
      couplerLengthError: coupler.length() - couplerLength,
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed,
      lowerPin: new THREE.Vector3(position.lowerPin.x, position.lowerPin.y, 0),
      lowerPinAcceleration: new THREE.Vector3(
        lowerPinAcceleration.x,
        lowerPinAcceleration.y,
        0,
      ),
      lowerPinVelocity: new THREE.Vector3(
        lowerPinVelocity.x,
        lowerPinVelocity.y,
        0,
      ),
      rockerAngle: position.rockerAngle,
      rockerAngularAcceleration,
      rockerAngularSpeed,
      rockerLengthError: position.lowerPin.distanceTo(new THREE.Vector2(
        shortLeverPivot.x,
        shortLeverPivot.y,
      )) - rockerLength,
      upperPin: new THREE.Vector3(position.upperPin.x, position.upperPin.y, 0),
      upperPinAcceleration: new THREE.Vector3(
        upperPinAcceleration.x,
        upperPinAcceleration.y,
        0,
      ),
      upperPinVelocity: new THREE.Vector3(
        upperPinVelocity.x,
        upperPinVelocity.y,
        0,
      ),
    };
  };

  const returnState = stateAtInputAngle(inputReturnAngle);
  const engageState = stateAtInputAngle(inputEngageAngle);
  const powerState = stateAtInputAngle(inputPowerAngle);
  const minimumRockerAngle = returnState.rockerAngle;
  const engageRockerAngle = engageState.rockerAngle;
  const maximumRockerAngle = powerState.rockerAngle;
  const drivingRockerStroke = maximumRockerAngle - engageRockerAngle;
  const contactLeverRadius = wheelContactRadius * outputStopPitch
    / drivingRockerStroke;
  const outputRatio = contactLeverRadius / wheelContactRadius;

  const inputScheduleAtTime = (time) => {
    const cycleIndex = Math.floor(time / cyclePeriod);
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cyclePeriod);
    let inputAngle = inputReturnAngle;
    let inputAngularSpeed = 0;
    let inputAngularAcceleration = 0;
    let shoeGap = maximumShoeGap;
    let shoeGapSpeed = 0;
    let shoeGapAcceleration = 0;
    let stage = 'bottom-handle-dwell-wheel-held';

    const interpolate = (startTime, endTime, startAngle, endAngle) => {
      const window = quinticWindow(cycleTime, startTime, endTime);
      const angleDelta = endAngle - startAngle;
      return {
        inputAngle: startAngle + angleDelta * window.position,
        inputAngularAcceleration: angleDelta * window.acceleration,
        inputAngularSpeed: angleDelta * window.velocity,
        window,
      };
    };

    if (cycleTime < bottomDwellEnd) {
      // The released lever pauses before the operator begins the next stroke.
    } else if (cycleTime < takeupEnd) {
      const motion = interpolate(
        bottomDwellEnd,
        takeupEnd,
        inputReturnAngle,
        inputEngageAngle,
      );
      ({ inputAngle, inputAngularAcceleration, inputAngularSpeed } = motion);
      shoeGap = maximumShoeGap * (1 - motion.window.position);
      shoeGapSpeed = -maximumShoeGap * motion.window.velocity;
      shoeGapAcceleration = -maximumShoeGap * motion.window.acceleration;
      stage = 'upstroke-clamp-takeup-wheel-held';
    } else if (cycleTime < driveEnd) {
      const motion = interpolate(
        takeupEnd,
        driveEnd,
        inputEngageAngle,
        inputPowerAngle,
      );
      ({ inputAngle, inputAngularAcceleration, inputAngularSpeed } = motion);
      shoeGap = 0;
      stage = 'upstroke-rim-clamped-friction-drive';
    } else if (cycleTime < topDwellEnd) {
      inputAngle = inputPowerAngle;
      shoeGap = 0;
      stage = 'top-handle-dwell-rim-clamped';
    } else if (cycleTime < returnEnd) {
      const motion = interpolate(
        topDwellEnd,
        returnEnd,
        inputPowerAngle,
        inputReturnAngle,
      );
      ({ inputAngle, inputAngularAcceleration, inputAngularSpeed } = motion);
      shoeGap = maximumShoeGap * motion.window.position;
      shoeGapSpeed = maximumShoeGap * motion.window.velocity;
      shoeGapAcceleration = maximumShoeGap * motion.window.acceleration;
      stage = 'downstroke-clamp-released-wheel-held';
    }
    return {
      cycleIndex,
      cycleTime,
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed,
      shoeGap: Math.max(0, shoeGap),
      shoeGapAcceleration,
      shoeGapSpeed,
      stage,
    };
  };

  const pawlStateAtWheelAngle = (wheelAngle) => {
    const stopCoordinate = -wheelAngle / outputStopPitch;
    const phase = Math.PI * stopCoordinate / 2;
    const upperLiftAngle = pawlMaximumLiftAngle * Math.sin(phase) ** 2;
    const lowerLiftAngle = pawlMaximumLiftAngle * Math.cos(phase) ** 2;
    const liftRadius = ratchetTipRadius * 0.10;
    return {
      holdingPawl: upperLiftAngle < 1e-10
        ? 'upper'
        : lowerLiftAngle < 1e-10
          ? 'lower'
          : 'neither-during-forward-index',
      lowerClearance: liftRadius
        * Math.sin(lowerLiftAngle),
      lowerLiftAngle,
      stopCoordinate,
      upperClearance: liftRadius
        * Math.sin(upperLiftAngle),
      upperLiftAngle,
    };
  };

  const stateAtTime = (time) => {
    const schedule = inputScheduleAtTime(time);
    const linkage = stateAtInputAngle(
      schedule.inputAngle,
      schedule.inputAngularSpeed,
      schedule.inputAngularAcceleration,
    );
    const clamped = schedule.stage === 'upstroke-rim-clamped-friction-drive'
      || schedule.stage === 'top-handle-dwell-rim-clamped';
    const driving = schedule.stage === 'upstroke-rim-clamped-friction-drive';
    let wheelAngle = -schedule.cycleIndex * outputStopPitch;
    let wheelAngularSpeed = 0;
    let wheelAngularAcceleration = 0;
    if (driving) {
      wheelAngle -= outputRatio
        * (linkage.rockerAngle - engageRockerAngle);
      wheelAngularSpeed = -outputRatio * linkage.rockerAngularSpeed;
      wheelAngularAcceleration = -outputRatio
        * linkage.rockerAngularAcceleration;
    } else if (schedule.cycleTime >= driveEnd) {
      wheelAngle -= outputStopPitch;
    }
    const pawls = pawlStateAtWheelAngle(wheelAngle);
    const shoeRadius = -contactLeverRadius + schedule.shoeGap;
    const rockerDirection = new THREE.Vector3(
      Math.cos(linkage.rockerAngle),
      Math.sin(linkage.rockerAngle),
      0,
    );
    const rockerTangent = new THREE.Vector3(
      -Math.sin(linkage.rockerAngle),
      Math.cos(linkage.rockerAngle),
      0,
    );
    const shoeCenter = shortLeverPivot.clone()
      .addScaledVector(rockerDirection, shoeRadius);
    const shoeVelocity = rockerDirection.clone()
      .multiplyScalar(schedule.shoeGapSpeed)
      .addScaledVector(
        rockerTangent,
        shoeRadius * linkage.rockerAngularSpeed,
      );
    const shoeAcceleration = rockerDirection.clone().multiplyScalar(
      schedule.shoeGapAcceleration
        - shoeRadius * linkage.rockerAngularSpeed ** 2,
    ).addScaledVector(
      rockerTangent,
      2 * schedule.shoeGapSpeed * linkage.rockerAngularSpeed
        + shoeRadius * linkage.rockerAngularAcceleration,
    );
    const noSlipArcSpeedError = clamped
      ? wheelContactRadius * wheelAngularSpeed
        + contactLeverRadius * linkage.rockerAngularSpeed
      : null;

    return {
      ...schedule,
      ...linkage,
      ...pawls,
      clampActive: clamped,
      driving,
      jawFlangeInnerRimGap: 0,
      noSlipArcSpeedError,
      outputDirection: wheelAngularSpeed < -1e-12
        ? 'clockwise'
        : 'held',
      shoeCenter,
      shoeAcceleration,
      shoeVelocity,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
    };
  };

  const sourceDriveFraction = (
    inputEngageAngle - sourceInputAngle
  ) / (inputEngageAngle - inputPowerAngle);
  const sourceDriveParameter = inverseQuintic(sourceDriveFraction);
  const sourceTime = takeupEnd + sourceDriveParameter * (driveEnd - takeupEnd);
  const sourceState = stateAtTime(sourceTime);

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.57,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.58,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.24,
    roughness: 0.52,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.46,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const wheel = new THREE.Group();
  wheel.userData.axis = Z_AXIS.clone();
  wheel.userData.role = 'fixed-axis-windlass-wheel';
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'one-rigid-wheel-ratchet-and-windlass-barrel';
  wheel.add(wheelRotor);
  root.add(wheel);
  const wheelDisk = cylinderAlongZ(wheelRadius * 0.88, 0.48,
    drivenMaterial, 64);
  wheelDisk.userData.role = 'solid-windlass-driving-wheel';
  wheelRotor.add(wheelDisk);
  const outerRim = new THREE.Mesh(
    new THREE.TorusGeometry(wheelRadius * 0.94, wheelRadius * 0.06, 12, 72),
    drivenMaterial,
  );
  outerRim.userData.role = 'friction-clamped-wheel-rim';
  wheelRotor.add(outerRim);
  const innerRimLine = new THREE.Mesh(
    new THREE.TorusGeometry(wheelInnerRadius, 0.045, 8, 64),
    darkMaterial,
  );
  innerRimLine.position.z = 0.255;
  innerRimLine.userData.role = 'visible-inner-surface-of-wheel-rim';
  wheelRotor.add(innerRimLine);
  const ratchetWheel = new THREE.Group();
  ratchetWheel.position.z = 0.39;
  ratchetWheel.userData.role = 'common-backstop-ratchet-wheel';
  ratchetWheel.userData.teeth = ratchetToothCount;
  const ratchetRing = new THREE.Mesh(
    new THREE.TorusGeometry(
      ratchetRootRadius - 0.075,
      0.075,
      8,
      96,
    ),
    darkMaterial,
  );
  ratchetRing.userData.role = 'annular-backstop-ratchet-body';
  ratchetWheel.add(ratchetRing);
  const toothHalfWidth = ratchetRootRadius * ratchetToothPitch * 0.27;
  const ratchetToothGeometry = centeredExtrusion(
    ratchetToothShape(ratchetRootRadius, ratchetTipRadius, toothHalfWidth),
    0.16,
    0.005,
  );
  const ratchetTeeth = Array.from({ length: ratchetToothCount },
    (_, index) => {
      const tooth = new THREE.Mesh(ratchetToothGeometry, darkMaterial);
      tooth.rotation.z = index * ratchetToothPitch;
      tooth.userData.role = 'one-way-backstop-ratchet-tooth';
      ratchetWheel.add(tooth);
      return tooth;
    });
  ratchetWheel.userData.toothMeshes = ratchetTeeth;
  wheelRotor.add(ratchetWheel);
  const wheelHub = cylinderAlongZ(0.24, 1.34, darkMaterial, 36);
  wheelHub.userData.role = 'windlass-wheel-shaft-hub';
  wheelRotor.add(wheelHub);
  const windlassBarrel = cylinderAlongZ(0.68, 1.28, drivenMaterial, 48);
  windlassBarrel.position.z = -0.76;
  windlassBarrel.userData.role = 'coaxial-windlass-barrel';
  wheelRotor.add(windlassBarrel);
  const wheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(wheelRadius * 0.76, 0.07, 0.035),
    whiteMaterial,
  );
  wheelIndex.position.set(wheelRadius * 0.43, 0, 0.51);
  wheelIndex.userData.role = 'white-wheel-rotation-index';
  wheelRotor.add(wheelIndex);

  const shortLever = new THREE.Group();
  shortLever.position.copy(shortLeverPivot);
  shortLever.position.z = 0.66;
  shortLever.userData.axis = Z_AXIS.clone();
  shortLever.userData.role = 'limited-angle-short-rim-clamping-lever';
  root.add(shortLever);
  const shortLeverBody = makeBeam(
    new THREE.Vector3(-contactLeverRadius + 0.08, 0, 0),
    new THREE.Vector3(rockerLength, 0, 0),
    { color: PALETTE.driver, depth: 0.20, thickness: 0.24 },
  );
  shortLeverBody.userData.role = 'rigid-two-arm-short-lever';
  shortLever.add(shortLeverBody);
  const clampShoe = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.40, 0.34),
    accentMaterial,
  );
  clampShoe.userData.role = 'eccentric-friction-shoe-on-short-lever';
  shortLever.add(clampShoe);
  const shortLeverPivotPin = cylinderAlongZ(0.17, 0.76,
    darkMaterial, 32);
  shortLeverPivotPin.position.copy(shortLeverPivot);
  shortLeverPivotPin.position.z = 0.30;
  shortLeverPivotPin.userData.role = 'fixed-short-lever-pivot-in-jaw-block';
  root.add(shortLeverPivotPin);
  const lowerLinkPin = cylinderAlongZ(0.17, 0.54,
    darkMaterial, 32);
  lowerLinkPin.position.set(rockerLength, 0, 0);
  lowerLinkPin.userData.role = 'moving-lower-coupler-pin';
  shortLever.add(lowerLinkPin);

  const handLever = new THREE.Group();
  handLever.position.copy(handlePivot);
  handLever.position.z = 0.58;
  handLever.userData.axis = Z_AXIS.clone();
  handLever.userData.role = 'alternating-long-hand-lever';
  root.add(handLever);
  // The lever turns on its fulcrum pin through a bored boss; the arms start
  // at the boss rim instead of passing through the pin.
  const bossOuterRadius = 0.36;
  const bossShape = new THREE.Shape().absarc(0, 0, bossOuterRadius, 0, FULL_TURN, false);
  bossShape.holes.push(new THREE.Path().absarc(0, 0, 0.226, 0, FULL_TURN, true));
  const leverBoss = new THREE.Mesh(
    new THREE.ExtrudeGeometry(bossShape, { bevelEnabled: false, curveSegments: 48, depth: 0.24 })
      .translate(0, 0, -0.12),
    driverMaterial,
  );
  leverBoss.userData.role = 'bored-boss-of-long-hand-lever-on-fulcrum';
  handLever.add(leverBoss);
  const fromBoss = (end) => end.clone().setLength(bossOuterRadius - 0.04);
  const inputCrankArm = makeBeam(
    fromBoss(new THREE.Vector3(inputCrankLength, 0, 0)),
    new THREE.Vector3(inputCrankLength, 0, 0),
    { color: PALETTE.driver, depth: 0.22, thickness: 0.25 },
  );
  inputCrankArm.userData.role = 'short-arm-rigid-with-long-hand-lever';
  handLever.add(inputCrankArm);
  const upperHandleSegment = makeBeam(
    fromBoss(localHandleElbow),
    localHandleElbow,
    { color: PALETTE.driver, depth: 0.24, thickness: 0.23 },
  );
  upperHandleSegment.userData.role = 'upper-bent-hand-lever-segment';
  const lowerHandleSegment = makeBeam(
    localHandleElbow,
    localGripTop,
    { color: PALETTE.driver, depth: 0.24, thickness: 0.23 },
  );
  lowerHandleSegment.userData.role = 'lower-bent-hand-lever-segment';
  // Brown draws a turned wooden handle: a collar at the lever end, a slim
  // neck, then a pear-shaped swell closing in a rounded end.
  const gripLength = localGripTop.distanceTo(localGripBottom);
  const gripProfile = [
    [0, 0], [0.085, 0], [0.105, 0.02], [0.105, 0.09], [0.075, 0.12],
    [0.072, 0.30], [0.10, 0.46], [0.15, 0.62], [0.182, 0.76],
    [0.176, 0.86], [0.14, 0.94], [0.08, 0.985], [0, 1],
  ].map(([radius, along]) => new THREE.Vector2(radius, -along * gripLength));
  const handGrip = new THREE.Mesh(
    new THREE.LatheGeometry(gripProfile, 40),
    matte(PALETTE.ink, { metalness: 0.12, roughness: 0.62 }),
  );
  handGrip.position.copy(localGripTop);
  handGrip.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, -1, 0),
    localGripBottom.clone().sub(localGripTop).normalize(),
  );
  handGrip.userData.role = 'free-end-turned-hand-grip';
  handLever.add(upperHandleSegment, lowerHandleSegment, handGrip);
  const handlePivotPin = cylinderAlongZ(0.22, 0.90, darkMaterial, 36);
  handlePivotPin.position.copy(handlePivot);
  handlePivotPin.position.z = 0.28;
  handlePivotPin.userData.role = 'fixed-long-handle-fulcrum';
  root.add(handlePivotPin);
  const upperLinkPin = cylinderAlongZ(0.15, 0.48,
    darkMaterial, 30);
  upperLinkPin.position.set(inputCrankLength, 0, 0);
  upperLinkPin.userData.role = 'moving-upper-coupler-pin';
  handLever.add(upperLinkPin);

  const connectingRod = makeDynamicLink({
    color: PALETTE.driven,
    depth: 0.18,
    jointRadius: 0.13,
    thickness: 0.18,
  });
  connectingRod.position.z = 0.78;
  connectingRod.userData.role = 'one-rigid-vertical-coupler';
  root.add(connectingRod);

  const jawSides = [];
  const jawFlanges = [];
  for (const side of [-1, 1]) {
    const z = side * 0.43;
    const jaw = new THREE.Group();
    jaw.userData.role = side < 0
      ? 'rear-cast-iron-rim-jaw'
      : 'front-cast-iron-rim-jaw';
    const spine = makeBeam(
      new THREE.Vector3(2.17, -0.72, z),
      new THREE.Vector3(2.17, 1.32, z),
      { color: PALETTE.frame, depth: 0.14, thickness: 0.22 },
    );
    const upperHook = makeBeam(
      new THREE.Vector3(2.17, 0.58, z),
      new THREE.Vector3(wheelInnerRadius + 0.03, 0.31, z),
      { color: PALETTE.frame, depth: 0.14, thickness: 0.20 },
    );
    const lowerHook = makeBeam(
      new THREE.Vector3(2.17, -0.57, z),
      new THREE.Vector3(wheelInnerRadius + 0.03, -0.31, z),
      { color: PALETTE.frame, depth: 0.14, thickness: 0.20 },
    );
    jaw.add(spine, upperHook, lowerHook);
    root.add(jaw);
    jawSides.push(jaw);
    const flange = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.66, 0.18),
      accentMaterial,
    );
    flange.position.set(wheelInnerRadius + 0.03, 0, side * 0.34);
    flange.userData.role = side < 0
      ? 'rear-inward-flange-against-inner-rim'
      : 'front-inward-flange-against-inner-rim';
    root.add(flange);
    jawFlanges.push(flange);
  }
  const jawPivotBridge = cylinderAlongZ(0.24, 1.04,
    frameMaterial, 36);
  jawPivotBridge.position.copy(shortLeverPivot);
  jawPivotBridge.userData.role = 'cross-pin-joining-both-cast-iron-jaws';
  root.add(jawPivotBridge);

  const upperPawlPivot = point3(sourceRasterUpperPawlPivot, 0.66);
  const lowerPawlPivot = point3(sourceRasterLowerPawlPivot, 0.66);
  const upperPawlSeat = new THREE.Vector3(
    ratchetTipRadius * Math.cos(THREE.MathUtils.degToRad(55)),
    ratchetTipRadius * Math.sin(THREE.MathUtils.degToRad(55)),
    0.66,
  );
  const lowerPawlSeat = new THREE.Vector3(
    ratchetTipRadius * Math.cos(THREE.MathUtils.degToRad(35)),
    ratchetTipRadius * Math.sin(THREE.MathUtils.degToRad(35)),
    0.66,
  );
  const sourcePawls = pawlStateAtWheelAngle(sourceState.wheelAngle);
  const makeHoldingPawl = (pivot, seat, sourceLift, role) => {
    const group = new THREE.Group();
    group.position.copy(pivot);
    group.userData.axis = Z_AXIS.clone();
    group.userData.role = role;
    const seatVector = seat.clone().sub(pivot);
    const length = seatVector.length();
    group.userData.length = length;
    group.userData.seatAngle = Math.atan2(seatVector.y, seatVector.x)
      - sourceLift;
    const arm = makeBeam(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(length, 0, 0),
      { color: PALETTE.frame, depth: 0.16, thickness: 0.15 },
    );
    arm.userData.role = `${role}-arm`;
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.10, 18, 12),
      frameMaterial,
    );
    tip.position.x = length;
    tip.userData.role = `${role}-tip`;
    group.add(arm, tip);
    root.add(group);
    return { group, tip };
  };
  const upperPawl = makeHoldingPawl(
    upperPawlPivot,
    upperPawlSeat,
    sourcePawls.upperLiftAngle,
    'upper-staggered-holding-pawl',
  );
  const lowerPawl = makeHoldingPawl(
    lowerPawlPivot,
    lowerPawlSeat,
    sourcePawls.lowerLiftAngle,
    'lower-staggered-holding-pawl',
  );
  const holdingPawlPivotPins = [upperPawlPivot, lowerPawlPivot].map(
    (pivot, index) => {
      const pin = cylinderAlongZ(0.13, 0.48, darkMaterial, 28);
      pin.position.copy(pivot);
      pin.position.z = 0.54;
      pin.userData.role = index === 0
        ? 'fixed-upper-holding-pawl-pivot'
        : 'fixed-lower-holding-pawl-pivot';
      root.add(pin);
      return pin;
    },
  );

  // The post stops just under the barrel it carries rather than passing
  // through it.
  const wheelPost = makeBeam(
    new THREE.Vector3(0, -2.12, -0.90),
    new THREE.Vector3(0, -0.70, -0.90),
    { color: PALETTE.frame, depth: 0.32, thickness: 0.28 },
  );
  wheelPost.userData.role = 'fixed-windlass-wheel-bearing-post';
  // Brown's lever post is a broad timber (raster x 370-419) whose right
  // edge carries the fulcrum, rising a little above the lever boss.
  const rightPostMinX = (370 - sourceRasterWheelCenter.x) * sourceScale;
  const rightPostMaxX = (419 - sourceRasterWheelCenter.x) * sourceScale;
  const rightPostX = (rightPostMinX + rightPostMaxX) / 2;
  const rightPost = makeBeam(
    new THREE.Vector3(rightPostX, -2.12, -0.82),
    new THREE.Vector3(rightPostX, handlePivot.y + 0.66, -0.82),
    { color: PALETTE.frame, depth: 0.34,
      thickness: rightPostMaxX - rightPostMinX },
  );
  rightPost.userData.role = 'fixed-hand-lever-support-post';
  const slopingBrace = makeBeam(
    new THREE.Vector3(0.35, 1.95, -0.82),
    new THREE.Vector3(handlePivot.x, handlePivot.y + 0.42, -0.82),
    { color: PALETTE.frame, depth: 0.32, thickness: 0.26 },
  );
  slopingBrace.userData.role = 'fixed-sloping-frame-brace';
  const base = makeBeam(
    new THREE.Vector3(-1.88, -2.12, -0.82),
    new THREE.Vector3(5.15, -2.12, -0.82),
    { color: PALETTE.frame, depth: 0.38, thickness: 0.26 },
  );
  base.userData.role = 'fixed-windlass-display-base';
  // Brown frames the wheel with a broad timber standard behind its right
  // half and a second post behind the travelling jaw, joined at the top
  // where the sloping brace lands. They stand behind the barrel's rear end,
  // and a short block carries the brace foot back to them.
  const standardMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const standardZ = -1.60;
  const standardDepth = 0.30;
  const standardBox = (minX, maxX, minY, maxY, minZ, maxZ, role) => {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(maxX - minX, maxY - minY, maxZ - minZ),
      standardMaterial,
    );
    box.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    box.userData.role = role;
    return box;
  };
  const rearStandards = [
    standardBox(0.24, 1.24, -2.12, 1.76, standardZ - standardDepth / 2,
      standardZ + standardDepth / 2, 'fixed-broad-standard-behind-wheel'),
    standardBox(1.65, 2.77, -2.12, 1.76, standardZ - standardDepth / 2,
      standardZ + standardDepth / 2, 'fixed-post-behind-travelling-jaw'),
    standardBox(0.24, 2.77, 1.76, 2.04, standardZ - standardDepth / 2,
      standardZ + standardDepth / 2, 'fixed-head-joining-rear-standards'),
    standardBox(0.24, 0.62, 1.76, 2.04, standardZ + standardDepth / 2,
      -0.98, 'fixed-block-carrying-sloping-brace-foot'),
  ];
  root.add(wheelPost, rightPost, slopingBrace, base, ...rearStandards);

  const modelToSourcePixel = (point) => new THREE.Vector2(
    point.x / sourceScale + sourceRasterWheelCenter.x,
    sourceRasterWheelCenter.y - point.y / sourceScale,
  );
  const sourceIdealizationPixelErrors = {
    handlePivot: modelToSourcePixel(handlePivot)
      .distanceTo(sourceRasterHandlePivot),
    lowerLinkPin: modelToSourcePixel(sourceState.lowerPin)
      .distanceTo(sourceRasterLowerLinkPin),
    lowerPawlPivot: modelToSourcePixel(lowerPawlPivot)
      .distanceTo(sourceRasterLowerPawlPivot),
    shortLeverPivot: modelToSourcePixel(shortLeverPivot)
      .distanceTo(sourceRasterShortLeverPivot),
    upperLinkPin: modelToSourcePixel(sourceState.upperPin)
      .distanceTo(sourceRasterUpperLinkPin),
    upperPawlPivot: modelToSourcePixel(upperPawlPivot)
      .distanceTo(sourceRasterUpperPawlPivot),
    wheelCenter: modelToSourcePixel(wheelCenter)
      .distanceTo(sourceRasterWheelCenter),
    wheelOuterRight: modelToSourcePixel(new THREE.Vector2(wheelRadius, 0))
      .distanceTo(sourceRasterWheelOuterRight),
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    base,
    clampShoe,
    connectingRod,
    handGrip,
    handLever,
    handlePivotPin,
    holdingPawlPivotPins,
    inputCrankArm,
    jawFlanges,
    jawPivotBridge,
    jawSides,
    lowerLinkPin,
    lowerPawl: lowerPawl.group,
    lowerPawlTip: lowerPawl.tip,
    outerRim,
    ratchetWheel,
    ratchetTeeth,
    rightPost,
    shortLever,
    shortLeverBody,
    shortLeverPivotPin,
    slopingBrace,
    upperLinkPin,
    upperPawl: upperPawl.group,
    upperPawlTip: upperPawl.tip,
    wheel,
    wheelDisk,
    wheelHub,
    wheelIndex,
    wheelPost,
    wheelRotor,
    windlassBarrel,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.92, -2.28, -1.72),
    new THREE.Vector3(7.12, 4.55, 1.55),
  );
  root.userData.cameraDistanceScale = 0.82;
  root.userData.fourBar = {
    couplerLength,
    fixedPivotDistance: handlePivot.distanceTo(shortLeverPivot),
    handlePivot: handlePivot.clone(),
    inputCrankLength,
    rockerLength,
    shortLeverPivot: shortLeverPivot.clone(),
    solveFourBarPosition,
    stateAtInputAngle,
  };
  root.userData.geometry = {
    contactLeverRadius,
    couplerLength,
    cyclePeriod,
    drivingRockerStroke,
    engageRockerAngle,
    inputCrankLength,
    inputEngageAngle,
    inputPowerAngle,
    inputReturnAngle,
    maximumRockerAngle,
    maximumShoeGap,
    minimumRockerAngle,
    outputStopPitch,
    ratchetRootRadius,
    ratchetTipRadius,
    ratchetToothCount,
    ratchetToothPitch,
    rockerLength,
    sourceInputAngle,
    sourceRockerAngle,
    sourceScale,
    wheelContactRadius,
    wheelInnerRadius,
    wheelRadius,
  };
  root.userData.mechanism =
    'one alternating long hand lever and one rigid coupler rock one short lever about its fixed pin in a two-jaw cast-iron block; the first part of the upstroke takes up the friction-shoe gap, the remainder clamps the rim against both inward flanges and drives the windlass clockwise without slip, and the downstroke releases and slides while two staggered pawls alternately prevent rollback';
  root.userData.movement = movement;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason:
      'The official Movement 280 page labels the animation unavailable and supplies no canvas program. Motion is reconstructed from Brown’s public-domain engraving and the printed clamp, drive, release, and holding-pawl description.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate280: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'one fixed-axis windlass wheel, one alternating hand lever with a short crank arm, one rigid coupler, one limited-angle short lever, one two-jaw rim block with two inward flanges, one friction shoe, one common ratchet wheel, and two staggered holding pawls',
      measurementUncertaintyPixels: 6,
      rasterHandlePivot: {
        x: sourceRasterHandlePivot.x,
        y: sourceRasterHandlePivot.y,
      },
      rasterLowerLinkPin: {
        x: sourceRasterLowerLinkPin.x,
        y: sourceRasterLowerLinkPin.y,
      },
      rasterLowerPawlPivot: {
        x: sourceRasterLowerPawlPivot.x,
        y: sourceRasterLowerPawlPivot.y,
      },
      rasterShortLeverPivot: {
        x: sourceRasterShortLeverPivot.x,
        y: sourceRasterShortLeverPivot.y,
      },
      rasterUpperLinkPin: {
        x: sourceRasterUpperLinkPin.x,
        y: sourceRasterUpperLinkPin.y,
      },
      rasterUpperPawlPivot: {
        x: sourceRasterUpperPawlPivot.x,
        y: sourceRasterUpperPawlPivot.y,
      },
      rasterWheelCenter: {
        x: sourceRasterWheelCenter.x,
        y: sourceRasterWheelCenter.y,
      },
      rasterWheelInnerRight: {
        x: sourceRasterWheelInnerRight.x,
        y: sourceRasterWheelInnerRight.y,
      },
      rasterWheelOuterRight: {
        x: sourceRasterWheelOuterRight.x,
        y: sourceRasterWheelOuterRight.y,
      },
      sourceIdealizationPixelErrors,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 75,
      edition: 21,
      illustrationPage: 74,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.inputScheduleAtTime = inputScheduleAtTime;
  root.userData.pawlStateAtWheelAngle = pawlStateAtWheelAngle;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    bottomDwellEnd,
    cyclePeriod,
    driveEnd,
    fullWheelPeriod: cyclePeriod * ratchetToothCount * 2,
    inputStrokesPerRatchetTurn: ratchetToothCount * 2,
    returnEnd,
    sourceTime,
    takeupEnd,
    topDwellEnd,
  };
  root.userData.transmission = {
    antiRollback:
      'two holding pawls are staggered by one half ratchet-tooth pitch, so one is seated at every five-degree output stop',
    clampSequence:
      'released bottom dwell -> smooth gap take-up -> clamped no-slip power stroke -> clamped top dwell -> released free return',
    inputOutputDirection:
      'upward motion of the short lever outward end drives the windlass clockwise; the downward return leaves the wheel stationary',
    outputRatio,
    outputStopPitch,
    outputStopsPerRatchetTooth: 2,
    outputTurnsPerInputStroke: -outputStopPitch / FULL_TURN,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    handLever.rotation.z = state.inputAngle;
    handLever.userData.angularAcceleration = state.inputAngularAcceleration;
    handLever.userData.angularSpeed = state.inputAngularSpeed;
    shortLever.rotation.z = state.rockerAngle;
    shortLever.userData.angularAcceleration = state.rockerAngularAcceleration;
    shortLever.userData.angularSpeed = state.rockerAngularSpeed;
    clampShoe.position.set(
      -contactLeverRadius + state.shoeGap,
      0,
      0,
    );
    connectingRod.userData.setEndpoints(state.upperPin, state.lowerPin);
    wheelRotor.rotation.z = state.wheelAngle;
    wheel.userData.angularAcceleration = state.wheelAngularAcceleration;
    wheel.userData.angularSpeed = state.wheelAngularSpeed;
    upperPawl.group.rotation.z = upperPawl.group.userData.seatAngle
      + state.upperLiftAngle;
    lowerPawl.group.rotation.z = lowerPawl.group.userData.seatAngle
      + state.lowerLiftAngle;
    root.userData.contacts = {
      frontJawInnerRim: {
        active: true,
        gap: state.jawFlangeInnerRimGap,
      },
      lowerHoldingPawl: {
        active: state.holdingPawl === 'lower',
        gap: state.lowerClearance,
      },
      rearJawInnerRim: {
        active: true,
        gap: state.jawFlangeInnerRimGap,
      },
      shoeRim: {
        active: state.clampActive,
        gap: state.shoeGap,
        noSlipArcSpeedError: state.noSlipArcSpeedError,
      },
      upperHoldingPawl: {
        active: state.holdingPawl === 'upper',
        gap: state.upperClearance,
      },
    };
    root.userData.kinematics = state;
  };

  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(5.8, 3.8, 10.8),
  };
}

export function createAuthoredFrictionWindlassMovement(movement) {
  if (movement.id !== 280) return null;
  const result = frictionWindlass(movement);
  result.root.userData.fidelity = 'authored';
  const finished = finishFrictionFamily(
    hideBackstopBehindWheel(correctFriction280(result)), 280);
  // Nearly square to the wheel face so the rear ratchet stays hidden.
  finished.cameraDirection = new THREE.Vector3(0.15, 0.4, 12);
  return finished;
}

// Brown draws the windlass wheel as a plain rim; the "common ratchet-wheel"
// of the caption is not visible, so it and its pawls sit behind the wheel
// web (the pawl arms still show beyond the rim, as the plate's two links
// do). The white phase index is not drawn.
function hideBackstopBehindWheel(model) {
  const blocks = model.root.userData.blocks;
  // The travelling jaw's rear cheek wraps the rim down to z = -0.54, so the
  // backstop must stay behind it; there, perspective showed the tooth tips
  // (0.985 R) past the rim's upper right. Shrink the whole backstop - ratchet,
  // pawls and pawl pins - as a similar figure about the wheel axis so the tips
  // sit well inside the rim while every pawl/tooth relation is preserved.
  const rearPlane = -0.65;
  const backstopScale = 0.93;
  blocks.ratchetWheel.position.z = rearPlane;
  blocks.ratchetWheel.scale.set(backstopScale, backstopScale, 1);
  blocks.ratchetCarrier.position.z = rearPlane + 0.07;
  // The carrier web is a Z-turned bored disk: its radius is local x and z.
  blocks.ratchetCarrier.scale.set(backstopScale, 1, backstopScale);
  for (const object of [
    blocks.upperPawl,
    blocks.lowerPawl,
    ...blocks.holdingPawlPivotPins,
  ]) {
    object.position.set(object.position.x * backstopScale,
      object.position.y * backstopScale, rearPlane);
    object.scale.x *= backstopScale;
    // Pins are Y-axis cylinders turned onto Z: their radius is x and z.
    if (object.isMesh) object.scale.z *= backstopScale;
    else object.scale.y *= backstopScale;
  }
  model.root.userData.geometry.backstopScale = backstopScale;
  const whiteIndices = [];
  model.root.traverse((object) => {
    if (/^white-/.test(object.userData.role ?? '')) whiteIndices.push(object);
  });
  for (const object of whiteIndices) object.removeFromParent();
  model.update(0);
  return model;
}
