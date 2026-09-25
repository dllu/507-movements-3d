import * as THREE from 'three';
import {plate as finitePlate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const FULL_TURN = Math.PI * 2;

function annularPlate(inner, outer, depth, material, keyed = false) {
  const hole = keyed ? clip.union(poly(circle([0, 0], inner, 192)),
    poly([[.54, -.03], [.603, -.03], [.603, .03], [.54, .03]]))
    : poly(circle([0, 0], inner, 192));
  return new THREE.Mesh(finitePlate(clip.difference(poly(circle([0, 0], outer, 192)), hole), -depth / 2, depth / 2), material);
}

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function planarRotor() {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.userData.axis = Z_AXIS.clone();
  root.userData.rotor = rotor;
  return root;
}

function rotateVector(vector, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    vector.x * cosine - vector.y * sine,
    vector.x * sine + vector.y * cosine,
  );
}

function cross2(left, right) {
  return left.x * right.y - left.y * right.x;
}

function normalizeAngle(angle) {
  return THREE.MathUtils.euclideanModulo(angle, FULL_TURN);
}

function smoothStep01(value) {
  const normalized = THREE.MathUtils.clamp(value, 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function smoothStepDerivative(value) {
  const normalized = THREE.MathUtils.clamp(value, 0, 1);
  return 6 * normalized * (1 - normalized);
}

function smoothStepIntegral(value) {
  const normalized = THREE.MathUtils.clamp(value, 0, 1);
  return normalized ** 3 - normalized ** 4 / 2;
}

function oneMinusSmoothStepIntegral(value) {
  const normalized = THREE.MathUtils.clamp(value, 0, 1);
  return normalized - normalized ** 3 + normalized ** 4 / 2;
}

function smootherStep01(value) {
  const normalized = THREE.MathUtils.clamp(value, 0, 1);
  return normalized ** 3 * (
    normalized * (normalized * 6 - 15) + 10
  );
}

function smootherStepDerivative(value) {
  const normalized = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * normalized ** 2 * (normalized - 1) ** 2;
}

function profileGeometryAt(config, profileAngle) {
  const cosine = Math.cos(profileAngle);
  const sine = Math.sin(profileAngle);
  const radius = config.baseRadius
    + config.lift * (1 + cosine) / 2;
  const radiusDerivative = -config.lift * sine / 2;
  const radiusSecondDerivative = -config.lift * cosine / 2;
  const boundary = new THREE.Vector2(
    radius * cosine,
    radius * sine,
  );
  const tangent = new THREE.Vector2(
    radiusDerivative * cosine - radius * sine,
    radiusDerivative * sine + radius * cosine,
  );
  const tangentDerivative = new THREE.Vector2(
    radiusSecondDerivative * cosine
      - 2 * radiusDerivative * sine - radius * cosine,
    radiusSecondDerivative * sine
      + 2 * radiusDerivative * cosine - radius * sine,
  );
  const tangentLength = tangent.length();
  const normal = new THREE.Vector2(
    tangent.y / tangentLength,
    -tangent.x / tangentLength,
  );
  const tangentLengthDerivative = tangent.dot(tangentDerivative)
    / tangentLength;
  const normalDerivative = new THREE.Vector2(
    (
      tangentDerivative.y - normal.x * tangentLengthDerivative
    ) / tangentLength,
    (
      -tangentDerivative.x - normal.y * tangentLengthDerivative
    ) / tangentLength,
  );
  const rollerCenterEnvelope = boundary.clone().addScaledVector(
    normal,
    config.rollerRadius,
  );
  const rollerCenterEnvelopeDerivative = tangent.clone().addScaledVector(
    normalDerivative,
    config.rollerRadius,
  );
  const curvatureNumerator = radius ** 2
    + 2 * radiusDerivative ** 2
    - radius * radiusSecondDerivative;
  return {
    boundary,
    curvatureNumerator,
    normal,
    normalDerivative,
    radius,
    radiusDerivative,
    radiusSecondDerivative,
    rollerCenterEnvelope,
    rollerCenterEnvelopeDerivative,
    tangent,
    tangentDerivative,
    tangentLength,
  };
}

function followerGeometryAtDriveAngle(
  config,
  driveAngle,
  shaftCenter,
  leverPivot,
) {
  const orientation = driveAngle + config.phaseOffset;
  const roughRollerCenter = config.sourceRollerCenter;
  let profileAngle = normalizeAngle(
    Math.atan2(
      roughRollerCenter.y - shaftCenter.y,
      roughRollerCenter.x - shaftCenter.x,
    ) - orientation,
  );
  let profile;
  let rollerCenter;
  let closureError = Infinity;
  let iterations = 0;
  for (; iterations < 18; iterations += 1) {
    profile = profileGeometryAt(config, profileAngle);
    const envelopeOffset = rotateVector(
      profile.rollerCenterEnvelope,
      orientation,
    );
    const envelopeDerivative = rotateVector(
      profile.rollerCenterEnvelopeDerivative,
      orientation,
    );
    rollerCenter = shaftCenter.clone().add(envelopeOffset);
    const leverArm = rollerCenter.clone().sub(leverPivot);
    closureError = leverArm.lengthSq() - config.leverLength ** 2;
    if (Math.abs(closureError) < 1e-13) break;
    const derivative = 2 * leverArm.dot(envelopeDerivative);
    if (Math.abs(derivative) < 1e-10) {
      throw new Error(
        `Movement 150 cam ${config.index + 1} follower reached a singularity.`,
      );
    }
    const rawStep = closureError / derivative;
    profileAngle = normalizeAngle(
      profileAngle - THREE.MathUtils.clamp(rawStep, -0.5, 0.5),
    );
  }
  if (Math.abs(closureError) >= 1e-11) {
    throw new Error(
      `Movement 150 cam ${config.index + 1} follower did not converge.`,
    );
  }

  profile = profileGeometryAt(config, profileAngle);
  const boundaryOffset = rotateVector(profile.boundary, orientation);
  const contactPoint = shaftCenter.clone().add(boundaryOffset);
  const contactNormal = rotateVector(profile.normal, orientation);
  const envelopeOffset = rotateVector(
    profile.rollerCenterEnvelope,
    orientation,
  );
  const envelopeDerivative = rotateVector(
    profile.rollerCenterEnvelopeDerivative,
    orientation,
  );
  rollerCenter = shaftCenter.clone().add(envelopeOffset);
  const leverArm = rollerCenter.clone().sub(leverPivot);
  const partialDriveDerivative = new THREE.Vector2(
    -envelopeOffset.y,
    envelopeOffset.x,
  );
  const denominator = leverArm.dot(envelopeDerivative);
  const profileAnglePerDriveRadian = -leverArm.dot(
    partialDriveDerivative,
  ) / denominator;
  const rollerCenterPerDriveRadian = partialDriveDerivative.clone()
    .addScaledVector(
      envelopeDerivative,
      profileAnglePerDriveRadian,
    );
  const leverAngle = Math.atan2(leverArm.y, leverArm.x);
  const leverAnglePerDriveRadian = cross2(
    leverArm,
    rollerCenterPerDriveRadian,
  ) / config.leverLength ** 2;
  const outputScale = config.outputArmLength / config.leverLength;
  const outputPin = leverPivot.clone().addScaledVector(
    leverArm,
    outputScale,
  );
  const outputPinPerDriveRadian = rollerCenterPerDriveRadian.clone()
    .multiplyScalar(outputScale);
  const contactFromShaft = contactPoint.clone().sub(shaftCenter);
  const camSurfacePerDriveRadian = new THREE.Vector2(
    -contactFromShaft.y,
    contactFromShaft.x,
  );
  const contactTangent = new THREE.Vector2(
    -contactNormal.y,
    contactNormal.x,
  );
  const rollerAngularSpeedPerDriveRadian = (
    rollerCenterPerDriveRadian.dot(contactTangent)
      - camSurfacePerDriveRadian.dot(contactTangent)
  ) / config.rollerRadius;

  return {
    camSurfacePerDriveRadian,
    contactCoincidenceError: contactPoint.clone().addScaledVector(
      contactNormal,
      config.rollerRadius,
    ).distanceTo(rollerCenter),
    contactNormal,
    contactPoint,
    contactTangent,
    driveAngle,
    envelopeClosureError: Math.abs(
      leverArm.length() - config.leverLength
    ),
    iterations,
    leverAngle,
    leverAnglePerDriveRadian,
    outputPin,
    outputPinPerDriveRadian,
    outputSliderPosition: new THREE.Vector2(
      config.outputSliderX,
      outputPin.y,
    ),
    outputSlotOffsetX: outputPin.x - config.outputSliderX,
    outputYPerDriveRadian: outputPinPerDriveRadian.y,
    profile,
    profileAngle,
    profileAnglePerDriveRadian,
    rollerAngularSpeedPerDriveRadian,
    rollerCenter,
    rollerCenterPerDriveRadian,
  };
}

function makePeriodicRollerMotion(
  config,
  shaftCenter,
  leverPivot,
) {
  const sampleCount = 8192;
  const step = FULL_TURN / sampleCount;
  const angles = new Float64Array(sampleCount + 1);
  const speeds = new Float64Array(sampleCount + 1);
  for (let index = 0; index <= sampleCount; index += 1) {
    speeds[index] = followerGeometryAtDriveAngle(
      config,
      index * step,
      shaftCenter,
      leverPivot,
    ).rollerAngularSpeedPerDriveRadian;
    if (index > 0) {
      angles[index] = angles[index - 1]
        + (speeds[index - 1] + speeds[index]) * step / 2;
    }
  }

  const angleAtDriveAngle = (driveAngle) => {
    const turns = Math.floor(driveAngle / FULL_TURN);
    const wrapped = driveAngle - turns * FULL_TURN;
    const tablePosition = wrapped / step;
    const index = Math.min(
      sampleCount - 1,
      Math.floor(tablePosition),
    );
    const fraction = tablePosition - index;
    const fractionSquared = fraction * fraction;
    const fractionCubed = fractionSquared * fraction;
    const h00 = 2 * fractionCubed - 3 * fractionSquared + 1;
    const h10 = fractionCubed - 2 * fractionSquared + fraction;
    const h01 = -2 * fractionCubed + 3 * fractionSquared;
    const h11 = fractionCubed - fractionSquared;
    const withinCycle = h00 * angles[index]
      + h10 * step * speeds[index]
      + h01 * angles[index + 1]
      + h11 * step * speeds[index + 1];
    return turns * angles[sampleCount] + withinCycle;
  };

  return {
    angleAtDriveAngle,
    angles,
    sampleCount,
    speeds,
    step,
    totalAnglePerCycle: angles[sampleCount],
  };
}

function makeCamAssembly(
  config,
  material,
  darkMaterial,
  indexMaterial,
) {
  const assembly = new THREE.Group();
  assembly.position.z = config.localPlaneZ;
  assembly.rotation.z = config.phaseOffset;
  assembly.userData.phaseOffset = config.phaseOffset;
  assembly.userData.role = `throw-${config.index + 1}-cam-rigid-on-sliding-carrier`;

  const profilePoints = [];
  const profileSamples = 192;
  for (let index = 0; index < profileSamples; index += 1) {
    const angle = index / profileSamples * FULL_TURN;
    const profile = profileGeometryAt(config, angle);
    const point = profile.boundary;
    profilePoints.push(point.toArray());
  }
  const plate = new THREE.Mesh(
    finitePlate(clip.difference(poly(profilePoints), poly(circle([0, 0], config.baseRadius, profileSamples))), -config.camDepth / 2, config.camDepth / 2),
    material,
  );
  plate.userData.camProfile = 'common-heel-variable-throw-polar-pear';
  plate.userData.role = `throw-${config.index + 1}-working-cam-plate`;
  plate.userData.throw = config.lift;
  const lobeIndex = cylinderAlongZ(0.052, 0.032, indexMaterial, 20);
  lobeIndex.position.set(
    config.baseRadius + config.lift * 0.62,
    0,
    config.camDepth / 2 + 0.055,
  );
  lobeIndex.userData.role = `throw-${config.index + 1}-white-lobe-index`;
  const throwTicks = Array.from({ length: config.index + 1 }, (_, index) => {
    const tick = cylinderAlongZ(0.026, 0.025, indexMaterial, 16);
    tick.position.set(
      0.70 + index * 0.07,
      -0.16,
      config.camDepth / 2 + 0.050,
    );
    tick.userData.role = `throw-${config.index + 1}-identity-tick`;
    return tick;
  });
  assembly.add(plate, lobeIndex, ...throwTicks);
  return {
    assembly,
    lobeIndex,
    plate,
    profileSamples,
    throwTicks,
  };
}

function makeFollowerRoller(config, darkMaterial, faceMaterial, indexMaterial) {
  const root = planarRotor();
  const rotor = root.userData.rotor;
  root.userData.role = 'free-rolling-selector-cam-follower';
  const tread = cylinderAlongZ(
    config.rollerRadius,
    config.rollerWidth,
    darkMaterial,
    44,
  );
  tread.userData.role = 'working-roller-tread-on-selected-cam';
  const face = cylinderAlongZ(
    config.rollerRadius * 0.67,
    config.rollerWidth + 0.035,
    faceMaterial,
    38,
  );
  face.userData.role = 'working-roller-face';
  const capPlaneZ = config.leverPlaneZ
    - config.workingCamPlaneZ + 0.15;
  const cap = cylinderAlongZ(
    config.rollerRadius * 0.48,
    0.055,
    darkMaterial,
    32,
  );
  cap.position.z = capPlaneZ;
  cap.userData.role = 'rotating-follower-axle-end-cap';
  const index = new THREE.Mesh(
    new THREE.BoxGeometry(
      config.rollerRadius * 1.12,
      0.060,
      0.035,
    ),
    indexMaterial,
  );
  index.position.set(
    config.rollerRadius * 0.31,
    0,
    capPlaneZ + 0.040,
  );
  index.userData.role = 'white-no-slip-follower-index';
  rotor.add(tread, face, cap, index);
  return { cap, face, index, root, rotor, tread };
}

function makeValveSlider(config, material, indexMaterial) {
  const root = new THREE.Group();
  root.userData.axis = new THREE.Vector3(0, 1, 0);
  root.userData.role = 'guided-vertical-valve-rod';
  const slotRailLength = config.outputSlotHalfWidth * 2;
  const slotRails = [-1, 1].map((side) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(
        slotRailLength,
        config.outputSlotRailThickness,
        config.outputHeadDepth,
      ),
      material,
    );
    rail.position.y = side * config.outputSlotHalfHeight;
    rail.userData.role = 'open-horizontal-valve-head-slot-rail';
    rail.userData.side = side < 0 ? 'lower' : 'upper';
    return rail;
  });
  const slotCheeks = [-1, 1].map((side) => {
    const cheek = new THREE.Mesh(
      new THREE.BoxGeometry(
        config.outputSlotRailThickness,
        config.outputSlotHalfHeight * 2,
        config.outputHeadDepth,
      ),
      material,
    );
    cheek.position.x = side * config.outputSlotHalfWidth;
    cheek.userData.role = 'open-valve-head-slot-end-cheek';
    cheek.userData.side = side < 0 ? 'left' : 'right';
    return cheek;
  });
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(
      config.outputRodRadius,
      config.outputRodRadius,
      config.outputRodLength,
      24,
    ),
    material,
  );
  rod.position.y = -config.outputRodLength / 2
    - config.outputSlotHalfHeight;
  rod.userData.role = 'rectilinearly-reciprocating-valve-rod';
  const rodIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      config.outputRodRadius * 1.30,
      config.outputRodLength * 0.36,
      0.030,
    ),
    indexMaterial,
  );
  rodIndex.position.set(
    0,
    -config.outputRodLength * 0.53,
    config.outputRodRadius + 0.020,
  );
  rodIndex.userData.role = 'white-valve-translation-index';
  root.add(...slotRails, ...slotCheeks, rod, rodIndex);
  return { rod, rodIndex, root, slotCheeks, slotRails };
}

function makeOperationTiming({
  endDriveAngle,
  endStopped,
  nominalAngularSpeed,
  rampDuration,
  startDriveAngle,
  startStopped,
}) {
  const angularDistance = endDriveAngle - startDriveAngle;
  const rampUpDuration = startStopped ? rampDuration : 0;
  const rampDownDuration = endStopped ? rampDuration : 0;
  const rampAngularDistance = nominalAngularSpeed
    * (rampUpDuration + rampDownDuration) / 2;
  const constantAngularDistance = angularDistance - rampAngularDistance;
  if (constantAngularDistance <= 0) {
    throw new Error('Movement 150 operating interval is too short for its ramps.');
  }
  const constantDuration = constantAngularDistance / nominalAngularSpeed;
  return {
    angularDistance,
    constantAngularDistance,
    constantDuration,
    duration: rampUpDuration + constantDuration + rampDownDuration,
    endDriveAngle,
    endStopped,
    nominalAngularSpeed,
    rampDownDuration,
    rampDuration,
    rampUpDuration,
    startDriveAngle,
    startStopped,
  };
}

function operationMotionAt(timing, elapsed) {
  const localTime = THREE.MathUtils.clamp(elapsed, 0, timing.duration);
  let driveAngle = timing.startDriveAngle;
  if (timing.rampUpDuration > 0
    && localTime < timing.rampUpDuration) {
    const phase = localTime / timing.rampUpDuration;
    return {
      driveAngle: driveAngle + timing.nominalAngularSpeed
        * timing.rampUpDuration * smoothStepIntegral(phase),
      driveAngularAcceleration: timing.nominalAngularSpeed
        / timing.rampUpDuration * smoothStepDerivative(phase),
      driveAngularSpeed: timing.nominalAngularSpeed * smoothStep01(phase),
    };
  }
  if (timing.rampUpDuration > 0) {
    driveAngle += timing.nominalAngularSpeed
      * timing.rampUpDuration / 2;
  }
  const afterRampUp = localTime - timing.rampUpDuration;
  if (afterRampUp < timing.constantDuration) {
    return {
      driveAngle: driveAngle
        + timing.nominalAngularSpeed * afterRampUp,
      driveAngularAcceleration: 0,
      driveAngularSpeed: timing.nominalAngularSpeed,
    };
  }
  driveAngle += timing.constantAngularDistance;
  if (timing.rampDownDuration > 0) {
    const rampElapsed = afterRampUp - timing.constantDuration;
    const phase = THREE.MathUtils.clamp(
      rampElapsed / timing.rampDownDuration,
      0,
      1,
    );
    return {
      driveAngle: driveAngle + timing.nominalAngularSpeed
        * timing.rampDownDuration
        * oneMinusSmoothStepIntegral(phase),
      driveAngularAcceleration: -timing.nominalAngularSpeed
        / timing.rampDownDuration * smoothStepDerivative(phase),
      driveAngularSpeed: timing.nominalAngularSpeed
        * (1 - smoothStep01(phase)),
    };
  }
  return {
    driveAngle: timing.endDriveAngle,
    driveAngularAcceleration: 0,
    driveAngularSpeed: timing.nominalAngularSpeed,
  };
}

function slidingFourThrowCamValveGear() {
  const root = new THREE.Group();
  const sourceScale = 0.016;
  const sourceShaft = new THREE.Vector2(159, 272);
  const sourceRoller = new THREE.Vector2(195, 193);
  const sourceValvePin = new THREE.Vector2(281, 215);
  const sourceLeverPivot = new THREE.Vector2(404, 244);
  const fromSource = (point) => new THREE.Vector2(
    (point.x - sourceShaft.x) * sourceScale,
    (sourceShaft.y - point.y) * sourceScale,
  );
  const shaftCenter = new THREE.Vector2(0, 0);
  const sourceRollerCenter = fromSource(sourceRoller);
  const sourceValvePinPosition = fromSource(sourceValvePin);
  const leverPivot = fromSource(sourceLeverPivot);
  const leverArmAtSource = sourceRollerCenter.clone().sub(leverPivot);
  const leverLength = leverArmAtSource.length();
  const sourceLeverDirection = leverArmAtSource.clone().normalize();
  const sourceLeverAngle = Math.atan2(
    sourceLeverDirection.y,
    sourceLeverDirection.x,
  );
  const sourceValveOffset = sourceValvePinPosition.clone().sub(leverPivot);
  const outputArmLength = sourceValveOffset.dot(sourceLeverDirection);
  const sourceValvePinProjected = leverPivot.clone().addScaledVector(
    sourceLeverDirection,
    outputArmLength,
  );
  const sourceValveProjectionError = sourceValvePinProjected.distanceTo(
    sourceValvePinPosition,
  );
  const outputSliderX = sourceValvePinProjected.x;
  const rollerRadius = 0.27;
  const rollerWidth = 0.27;
  const baseRadius = 0.62;
  const camDepth = 0.28;
  const camPitch = 0.34;
  const camCount = 4;
  const sourceSelectedCamIndex = 3;
  const workingCamPlaneZ = 0.15;
  const leverPlaneZ = 0.62;
  const sourceEnvelopeDistance = sourceRollerCenter.distanceTo(shaftCenter);
  const sourceSelectedLift = sourceEnvelopeDistance
    - baseRadius - rollerRadius;
  const lifts = [0.14, 0.27, 0.38, sourceSelectedLift];
  const localCamPlanes = Array.from({ length: camCount }, (_, index) => (
    (index - (camCount - 1) / 2) * camPitch
  ));
  const phaseOffset = Math.atan2(
    sourceRollerCenter.y - shaftCenter.y,
    sourceRollerCenter.x - shaftCenter.x,
  );
  const outputPinRadius = 0.070;
  const outputSlotHalfWidth = 0.18;
  const outputSlotHalfHeight = 0.10;
  const outputSlotRailThickness = 0.050;
  const outputHeadDepth = 0.16;
  const outputRodRadius = 0.065;
  const outputRodLength = 2.05;
  const nominalAngularSpeed = 1.15;
  const driveRampDuration = 0.55;
  const selectorShiftDuration = 0.80;

  const configs = lifts.map((lift, index) => ({
    baseRadius,
    camDepth,
    index,
    leverLength,
    leverPlaneZ,
    lift,
    localPlaneZ: localCamPlanes[index],
    name: `throw-${index + 1}`,
    outputArmLength,
    outputHeadDepth,
    outputPinRadius,
    outputRodLength,
    outputRodRadius,
    outputSliderX,
    outputSlotHalfHeight,
    outputSlotHalfWidth,
    outputSlotRailThickness,
    phaseOffset,
    rollerRadius,
    rollerWidth,
    sourceLeverAngle,
    sourceRollerCenter: sourceRollerCenter.clone(),
    throwRank: index + 1,
    workingCamPlaneZ,
  }));

  const commonHeelEnvelopeRadius = baseRadius + rollerRadius;
  const pivotFromShaft = leverPivot.clone().sub(shaftCenter);
  const pivotDistance = pivotFromShaft.length();
  const heelIntersectionAlongPivot = (
    commonHeelEnvelopeRadius ** 2
      - leverLength ** 2 + pivotDistance ** 2
  ) / (2 * pivotDistance);
  const heelIntersectionHeight = Math.sqrt(
    commonHeelEnvelopeRadius ** 2
      - heelIntersectionAlongPivot ** 2,
  );
  const pivotDirection = pivotFromShaft.clone().normalize();
  const pivotPerpendicular = new THREE.Vector2(
    -pivotDirection.y,
    pivotDirection.x,
  );
  const heelBasePoint = shaftCenter.clone().addScaledVector(
    pivotDirection,
    heelIntersectionAlongPivot,
  );
  const heelCandidates = [1, -1].map((side) => (
    heelBasePoint.clone().addScaledVector(
      pivotPerpendicular,
      side * heelIntersectionHeight,
    )
  ));
  const commonHeelRollerCenter = heelCandidates.sort((left, right) => (
    left.distanceToSquared(sourceRollerCenter)
      - right.distanceToSquared(sourceRollerCenter)
  ))[0];
  const commonHeelEnvelopeAngle = Math.atan2(
    commonHeelRollerCenter.y - shaftCenter.y,
    commonHeelRollerCenter.x - shaftCenter.x,
  );
  const commonHeelDriveAngle = normalizeAngle(
    commonHeelEnvelopeAngle - Math.PI - phaseOffset,
  );
  const carrierTranslationForCam = (camIndex) => (
    workingCamPlaneZ - localCamPlanes[camIndex]
  );
  const carrierTranslations = configs.map((_, index) => (
    carrierTranslationForCam(index)
  ));

  const driverMaterials = [
    matte(0xf09a69, { metalness: 0.10, roughness: 0.61 }),
    matte(0xe97a54, { metalness: 0.11, roughness: 0.59 }),
    matte(PALETTE.driver, { metalness: 0.13, roughness: 0.56 }),
    matte(0xb94734, { metalness: 0.15, roughness: 0.54 }),
  ];
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.15,
    roughness: 0.56,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.26,
    roughness: 0.47,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.70,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const camInput = planarRotor();
  const camRotor = camInput.userData.rotor;
  camInput.position.set(shaftCenter.x, shaftCenter.y, 0);
  camInput.userData.role = 'rotating-keyed-camshaft-fixed-against-axial-motion';
  camRotor.userData.role = 'uniform-operating-camshaft-rotor';
  const slidingCarrier = new THREE.Group();
  slidingCarrier.userData.axis = Z_AXIS.clone();
  slidingCarrier.userData.role = 'axially-sliding-four-cam-carrier';
  camRotor.add(slidingCarrier);
  const camRecords = configs.map((config, index) => {
    const record = makeCamAssembly(
      config,
      driverMaterials[index],
      darkMaterial,
      indexMaterial,
    );
    slidingCarrier.add(record.assembly);
    return { ...record, config };
  });
  const stackLength = camPitch * (camCount - 1) + camDepth;
  const commonBaseSleeve = annularPlate(
    .604, baseRadius,
    stackLength,
    driverMaterials[0],
  );
  commonBaseSleeve.userData.role = 'continuous-common-heel-selection-sleeve';
  const carrierHub = annularPlate(.568, .604, stackLength + 0.18, darkMaterial, true);
  carrierHub.userData.role = 'keyed-hub-rigid-with-all-four-cams';
  const carrierEndCollars = [-1, 1].map((side) => {
    const collar = annularPlate(.604, baseRadius, .075, darkMaterial);
    collar.position.z = side * (stackLength / 2 + 0.0375);
    collar.userData.role = 'sliding-carrier-end-collar';
    collar.userData.side = side < 0 ? 'rear' : 'front';
    return collar;
  });
  slidingCarrier.add(commonBaseSleeve, carrierHub, ...carrierEndCollars);

  const rotatingShaft = cylinderAlongZ(0.56, 3.80, darkMaterial, 192);
  rotatingShaft.userData.role = 'long-keyed-shaft-through-sliding-cam-series';
  const shaftKeyIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.050, 3.00),
    indexMaterial,
  );
  shaftKeyIndex.position.x = 0.565;
  shaftKeyIndex.userData.role = 'white-longitudinal-key-and-rotation-index';
  camRotor.add(rotatingShaft, shaftKeyIndex);

  const lever = new THREE.Group();
  lever.position.set(leverPivot.x, leverPivot.y, leverPlaneZ);
  lever.userData.axis = Z_AXIS.clone();
  lever.userData.role = 'selected-cam-operated-rocking-valve-lever';
  const leverBody = makeBeam(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(leverLength, 0, 0),
    {
      color: PALETTE.driven,
      depth: 0.17,
      jointRadius: 0.001,
      thickness: 0.17,
    },
  );
  leverBody.userData.role = 'rigid-lever-from-fixed-pivot-to-cam-roller';
  const leverPivotFace = cylinderAlongZ(0.25, 0.070, drivenMaterial, 36);
  leverPivotFace.position.z = 0.115;
  leverPivotFace.userData.role = 'blue-lever-fulcrum-face';
  const leverIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.048, 0.028),
    indexMaterial,
  );
  leverIndex.position.set(leverLength * 0.36, 0, 0.115);
  leverIndex.userData.role = 'white-rocking-lever-angle-index';
  const followerRoller = makeFollowerRoller(
    configs[sourceSelectedCamIndex],
    darkMaterial,
    accentMaterial,
    indexMaterial,
  );
  followerRoller.root.position.set(
    leverLength,
    0,
    workingCamPlaneZ - leverPlaneZ,
  );
  const followerAxle = cylinderAlongZ(
    0.090,
    leverPlaneZ - workingCamPlaneZ + 0.34,
    darkMaterial,
    28,
  );
  followerAxle.position.set(
    leverLength,
    0,
    (workingCamPlaneZ - leverPlaneZ) / 2 + 0.075,
  );
  followerAxle.userData.role = 'fixed-axle-between-lever-and-working-roller';
  const outputPin = cylinderAlongZ(
    outputPinRadius,
    0.52,
    darkMaterial,
    26,
  );
  outputPin.position.set(outputArmLength, 0, 0.115);
  outputPin.userData.role = 'lever-pin-in-open-valve-rod-head-slot';
  lever.add(
    leverBody,
    leverPivotFace,
    leverIndex,
    followerRoller.root,
    followerAxle,
    outputPin,
  );

  const valveSlider = makeValveSlider(
    configs[sourceSelectedCamIndex],
    drivenMaterial,
    indexMaterial,
  );
  const valveSliderPlaneZ = leverPlaneZ + 0.20;
  valveSlider.root.position.z = valveSliderPlaneZ;

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-camshaft-lever-and-valve-guide-frame';
  const baseY = -1.78;
  const baseRails = [-1, 1].map((side) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(6.45, 0.19, 0.24),
      frameMaterial,
    );
    rail.position.set(1.65, baseY, side * 1.65);
    rail.userData.role = 'fixed-longitudinal-base-rail';
    rail.userData.side = side < 0 ? 'rear' : 'front';
    return rail;
  });
  const baseTies = [-1.10, 4.38].map((x, index) => {
    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.19, 3.60),
      frameMaterial,
    );
    tie.position.set(x, baseY, 0);
    tie.userData.role = 'fixed-transverse-base-tie';
    tie.userData.side = index === 0 ? 'cam-end' : 'lever-end';
    return tie;
  });
  const camBearingPosts = [-1, 1].map((side) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.30, -baseY - .72, 0.30),
      frameMaterial,
    );
    post.position.set(shaftCenter.x, (baseY - .72) / 2, side * 1.65);
    post.userData.role = 'fixed-camshaft-bearing-post';
    post.userData.side = side < 0 ? 'rear' : 'front';
    return post;
  });
  const camBearingRings = [-1, 1].map((side) => {
    const bearing = annularPlate(.568, .72, .16, darkMaterial);
    bearing.position.set(shaftCenter.x, shaftCenter.y, side * 1.65);
    bearing.userData.role = 'fixed-camshaft-bearing-ring';
    bearing.userData.side = side < 0 ? 'rear' : 'front';
    return bearing;
  });
  const leverPostHeight = leverPivot.y - baseY;
  const leverPivotPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, leverPostHeight, 0.38),
    frameMaterial,
  );
  leverPivotPost.position.set(
    leverPivot.x,
    (leverPivot.y + baseY) / 2,
    leverPlaneZ - 0.42,
  );
  leverPivotPost.userData.role = 'fixed-post-under-right-lever-fulcrum';
  const fixedLeverPivotShaft = cylinderAlongZ(
    0.12,
    1.05,
    darkMaterial,
    30,
  );
  fixedLeverPivotShaft.position.set(
    leverPivot.x,
    leverPivot.y,
    leverPlaneZ - 0.12,
  );
  fixedLeverPivotShaft.userData.role = 'fixed-shaft-through-lever-fulcrum';

  const valveGuide = new THREE.Group();
  valveGuide.userData.fixed = true;
  valveGuide.userData.role = 'fixed-vertical-valve-rod-guide';
  const valveGuideY = -0.70;
  const valveGuideHalfGap = outputRodRadius + 0.035;
  const valveGuideCheeks = [-1, 1].map((side) => {
    const cheek = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.38, 0.20),
      frameMaterial,
    );
    cheek.position.set(
      outputSliderX + side * valveGuideHalfGap,
      valveGuideY,
      valveSliderPlaneZ,
    );
    cheek.userData.role = 'fixed-valve-guide-cheek';
    cheek.userData.side = side < 0 ? 'left' : 'right';
    valveGuide.add(cheek);
    return cheek;
  });
  fixedFrame.add(
    ...baseRails,
    ...baseTies,
    ...camBearingPosts,
    ...camBearingRings,
    leverPivotPost,
    fixedLeverPivotShaft,
    valveGuide,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.4, 5.0, 4.3),
    new THREE.MeshBasicMaterial({
      color: PALETTE.paper,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(1.65, -0.14, 0.03);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-full-selection-and-valve-stroke-envelope';
  root.add(
    cameraEnvelope,
    fixedFrame,
    camInput,
    lever,
    valveSlider.root,
  );

  const rollerMotionRecords = configs.map((config) => (
    makePeriodicRollerMotion(
      config,
      shaftCenter,
      leverPivot,
    )
  ));

  const followerStateFor = ({
    camIndex,
    driveAngle,
    driveAngularSpeed,
    rollerAngularDisplacement,
    selectorVelocityZ = 0,
  }) => {
    const config = configs[camIndex];
    const follower = followerGeometryAtDriveAngle(
      config,
      driveAngle,
      shaftCenter,
      leverPivot,
    );
    const camSurfaceVelocity = follower.camSurfacePerDriveRadian.clone()
      .multiplyScalar(driveAngularSpeed);
    const rollerCenterVelocity = follower.rollerCenterPerDriveRadian.clone()
      .multiplyScalar(driveAngularSpeed);
    const rollerAngularSpeed = follower.rollerAngularSpeedPerDriveRadian
      * driveAngularSpeed;
    const rollerContactRadius = follower.contactPoint.clone().sub(
      follower.rollerCenter,
    );
    const rollerSurfaceVelocity = rollerCenterVelocity.clone().add(
      new THREE.Vector2(
        -rollerAngularSpeed * rollerContactRadius.y,
        rollerAngularSpeed * rollerContactRadius.x,
      ),
    );
    const relativeContactVelocity = camSurfaceVelocity.clone().sub(
      rollerSurfaceVelocity,
    );
    return {
      ...follower,
      camIndex,
      camSurfaceVelocity,
      contactAxialSlidingSpeed: selectorVelocityZ,
      contactNormalVelocityError: relativeContactVelocity.dot(
        follower.contactNormal,
      ),
      contactTangentialRollingError: relativeContactVelocity.dot(
        follower.contactTangent,
      ),
      leverAngularSpeed: follower.leverAnglePerDriveRadian
        * driveAngularSpeed,
      outputVelocityY: follower.outputYPerDriveRadian
        * driveAngularSpeed,
      relativeContactVelocity,
      rollerAngularDisplacement,
      rollerAngularSpeed,
      rollerCenterVelocity,
      rollerSurfaceVelocity,
      sliderPosition: follower.outputSliderPosition.clone(),
    };
  };

  const motionExtrema = configs.map((config, camIndex) => {
    let maximumLeverAngle = -Infinity;
    let maximumOutputSlotOffset = 0;
    let maximumOutputY = -Infinity;
    let minimumLeverAngle = Infinity;
    let minimumOutputY = Infinity;
    const extremaSamples = 4096;
    for (let index = 0; index < extremaSamples; index += 1) {
      const follower = followerGeometryAtDriveAngle(
        config,
        index / extremaSamples * FULL_TURN,
        shaftCenter,
        leverPivot,
      );
      maximumLeverAngle = Math.max(maximumLeverAngle, follower.leverAngle);
      minimumLeverAngle = Math.min(minimumLeverAngle, follower.leverAngle);
      maximumOutputY = Math.max(
        maximumOutputY,
        follower.outputSliderPosition.y,
      );
      minimumOutputY = Math.min(
        minimumOutputY,
        follower.outputSliderPosition.y,
      );
      maximumOutputSlotOffset = Math.max(
        maximumOutputSlotOffset,
        Math.abs(follower.outputSlotOffsetX),
      );
    }
    return {
      camIndex,
      camLift: config.lift,
      maximumLeverAngle,
      maximumOutputSlotOffset,
      maximumOutputY,
      minimumLeverAngle,
      minimumOutputY,
      outputStroke: maximumOutputY - minimumOutputY,
    };
  });

  const selectionOrder = [3, 0, 1, 2, 3];
  const scheduleSegments = [];
  let scheduleTime = 0;
  let scheduleRollerAngle = 0;
  const addOperation = ({
    camIndex,
    endDriveAngle,
    endStopped,
    label,
    startDriveAngle,
    startStopped,
  }) => {
    const timing = makeOperationTiming({
      endDriveAngle,
      endStopped,
      nominalAngularSpeed,
      rampDuration: driveRampDuration,
      startDriveAngle,
      startStopped,
    });
    const rollerMotion = rollerMotionRecords[camIndex];
    const rollerEndAngle = scheduleRollerAngle
      + rollerMotion.angleAtDriveAngle(endDriveAngle)
      - rollerMotion.angleAtDriveAngle(startDriveAngle);
    const record = {
      camIndex,
      duration: timing.duration,
      endDriveAngle,
      endRollerAngle: rollerEndAngle,
      endTime: scheduleTime + timing.duration,
      kind: 'operation',
      label,
      startDriveAngle,
      startRollerAngle: scheduleRollerAngle,
      startTime: scheduleTime,
      timing,
    };
    scheduleSegments.push(record);
    scheduleTime = record.endTime;
    scheduleRollerAngle = rollerEndAngle;
    return record;
  };
  const addShift = ({ driveAngle, fromCamIndex, toCamIndex }) => {
    const record = {
      driveAngle,
      duration: selectorShiftDuration,
      endRollerAngle: scheduleRollerAngle,
      endTime: scheduleTime + selectorShiftDuration,
      fromCamIndex,
      kind: 'selection-shift',
      label: `select-throw-${fromCamIndex + 1}-to-${toCamIndex + 1}`,
      startRollerAngle: scheduleRollerAngle,
      startTime: scheduleTime,
      toCamIndex,
    };
    scheduleSegments.push(record);
    scheduleTime = record.endTime;
    return record;
  };

  addOperation({
    camIndex: 3,
    endDriveAngle: commonHeelDriveAngle,
    endStopped: true,
    label: 'source-throw-4-operating-to-common-heel',
    startDriveAngle: 0,
    startStopped: false,
  });
  addShift({
    driveAngle: commonHeelDriveAngle,
    fromCamIndex: 3,
    toCamIndex: 0,
  });
  addOperation({
    camIndex: 0,
    endDriveAngle: commonHeelDriveAngle + FULL_TURN,
    endStopped: true,
    label: 'minimum-throw-1-full-operating-turn',
    startDriveAngle: commonHeelDriveAngle,
    startStopped: true,
  });
  addShift({
    driveAngle: commonHeelDriveAngle + FULL_TURN,
    fromCamIndex: 0,
    toCamIndex: 1,
  });
  addOperation({
    camIndex: 1,
    endDriveAngle: commonHeelDriveAngle + FULL_TURN * 2,
    endStopped: true,
    label: 'intermediate-throw-2-full-operating-turn',
    startDriveAngle: commonHeelDriveAngle + FULL_TURN,
    startStopped: true,
  });
  addShift({
    driveAngle: commonHeelDriveAngle + FULL_TURN * 2,
    fromCamIndex: 1,
    toCamIndex: 2,
  });
  addOperation({
    camIndex: 2,
    endDriveAngle: commonHeelDriveAngle + FULL_TURN * 3,
    endStopped: true,
    label: 'intermediate-throw-3-full-operating-turn',
    startDriveAngle: commonHeelDriveAngle + FULL_TURN * 2,
    startStopped: true,
  });
  addShift({
    driveAngle: commonHeelDriveAngle + FULL_TURN * 3,
    fromCamIndex: 2,
    toCamIndex: 3,
  });
  addOperation({
    camIndex: 3,
    endDriveAngle: FULL_TURN * 4,
    endStopped: false,
    label: 'source-throw-4-common-heel-to-source-pose',
    startDriveAngle: commonHeelDriveAngle + FULL_TURN * 3,
    startStopped: true,
  });

  const demonstrationPeriod = scheduleTime;
  const driveAngleAdvancePerDemonstration = FULL_TURN * 4;
  const rollerAngleAdvancePerDemonstration = scheduleRollerAngle;
  const operatingSegments = scheduleSegments.filter(({ kind }) => (
    kind === 'operation'
  ));
  const selectionSegments = scheduleSegments.filter(({ kind }) => (
    kind === 'selection-shift'
  ));

  const camWorldPlanesAtTranslation = (carrierTranslationZ) => (
    localCamPlanes.map((localPlaneZ) => localPlaneZ + carrierTranslationZ)
  );
  const nearestCamAtWorkingPlane = (camWorldPlanes) => {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    for (let index = 0; index < camWorldPlanes.length; index += 1) {
      const distance = Math.abs(
        camWorldPlanes[index] - workingCamPlaneZ
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }
    return { nearestDistance, nearestIndex };
  };

  const operatingStateAtDriveAngle = (camIndex, driveAngle) => {
    const carrierTranslationZ = carrierTranslationForCam(camIndex);
    const camWorldPlanes = camWorldPlanesAtTranslation(carrierTranslationZ);
    const rollerAngularDisplacement = rollerMotionRecords[camIndex]
      .angleAtDriveAngle(driveAngle);
    const follower = followerStateFor({
      camIndex,
      driveAngle,
      driveAngularSpeed: nominalAngularSpeed,
      rollerAngularDisplacement,
    });
    return {
      camAtFollowerIndex: camIndex,
      camLift: configs[camIndex].lift,
      camWorldPlanes,
      carrierTranslationZ,
      contactMode: 'selected-cam-operating',
      driveAngle,
      driveAngularAcceleration: 0,
      driveAngularSpeed: nominalAngularSpeed,
      follower,
      operating: true,
      selectedCamIndex: camIndex,
      selectorAligned: true,
      selectorVelocityZ: 0,
      stage: `throw-${camIndex + 1}-operating`,
      valveStroke: motionExtrema[camIndex].outputStroke,
    };
  };

  const stateAtTime = (time) => {
    const demonstrationIndex = Math.floor(time / demonstrationPeriod);
    const demonstrationTime = time
      - demonstrationIndex * demonstrationPeriod;
    const segment = scheduleSegments.find(({ endTime }) => (
      demonstrationTime < endTime
    )) ?? scheduleSegments.at(-1);
    const segmentElapsed = THREE.MathUtils.clamp(
      demonstrationTime - segment.startTime,
      0,
      segment.duration,
    );
    let baseDriveAngle;
    let carrierTranslationZ;
    let contactCamIndex;
    let driveAngularAcceleration;
    let driveAngularSpeed;
    let rollerAngularDisplacement;
    let selectedCamIndex;
    let selectionProgress;
    let selectorVelocityZ;
    let stage;
    if (segment.kind === 'operation') {
      const motion = operationMotionAt(segment.timing, segmentElapsed);
      baseDriveAngle = motion.driveAngle;
      driveAngularAcceleration = motion.driveAngularAcceleration;
      driveAngularSpeed = motion.driveAngularSpeed;
      carrierTranslationZ = carrierTranslationForCam(segment.camIndex);
      contactCamIndex = segment.camIndex;
      selectedCamIndex = segment.camIndex;
      selectionProgress = 0;
      selectorVelocityZ = 0;
      rollerAngularDisplacement = demonstrationIndex
        * rollerAngleAdvancePerDemonstration
        + segment.startRollerAngle
        + rollerMotionRecords[segment.camIndex].angleAtDriveAngle(
          baseDriveAngle
        )
        - rollerMotionRecords[segment.camIndex].angleAtDriveAngle(
          segment.startDriveAngle
        );
      if (driveAngularSpeed < nominalAngularSpeed * 0.02) {
        stage = `throw-${segment.camIndex + 1}-resting-at-common-heel`;
      } else if (driveAngularAcceleration < -1e-5) {
        stage = `throw-${segment.camIndex + 1}-slowing-at-common-heel`;
      } else if (driveAngularAcceleration > 1e-5) {
        stage = `throw-${segment.camIndex + 1}-accelerating-from-common-heel`;
      } else {
        stage = `throw-${segment.camIndex + 1}-operating-at-constant-speed`;
      }
    } else {
      const normalizedTime = segmentElapsed / segment.duration;
      const easedProgress = smootherStep01(normalizedTime);
      const fromTranslation = carrierTranslationForCam(
        segment.fromCamIndex
      );
      const toTranslation = carrierTranslationForCam(segment.toCamIndex);
      carrierTranslationZ = THREE.MathUtils.lerp(
        fromTranslation,
        toTranslation,
        easedProgress,
      );
      selectorVelocityZ = (toTranslation - fromTranslation)
        / segment.duration * smootherStepDerivative(normalizedTime);
      const camWorldPlanes = camWorldPlanesAtTranslation(
        carrierTranslationZ
      );
      contactCamIndex = nearestCamAtWorkingPlane(
        camWorldPlanes
      ).nearestIndex;
      selectedCamIndex = null;
      selectionProgress = easedProgress;
      baseDriveAngle = segment.driveAngle;
      driveAngularAcceleration = 0;
      driveAngularSpeed = 0;
      rollerAngularDisplacement = demonstrationIndex
        * rollerAngleAdvancePerDemonstration
        + segment.startRollerAngle;
      stage = `selecting-throw-${segment.fromCamIndex + 1}-to-${segment.toCamIndex + 1}-at-common-heel`;
    }
    const driveAngle = demonstrationIndex
      * driveAngleAdvancePerDemonstration + baseDriveAngle;
    const camWorldPlanes = camWorldPlanesAtTranslation(carrierTranslationZ);
    const { nearestDistance, nearestIndex } = nearestCamAtWorkingPlane(
      camWorldPlanes
    );
    if (nearestIndex !== contactCamIndex) contactCamIndex = nearestIndex;
    const follower = followerStateFor({
      camIndex: contactCamIndex,
      driveAngle,
      driveAngularSpeed,
      rollerAngularDisplacement,
      selectorVelocityZ,
    });
    const axialSupportOverlap = (
      camDepth + rollerWidth
    ) / 2 - nearestDistance;
    return {
      baseDriveAngle,
      camAtFollowerIndex: contactCamIndex,
      camLift: configs[contactCamIndex].lift,
      camPlaneOffsetZ: camWorldPlanes[contactCamIndex]
        - workingCamPlaneZ,
      camWorldPlanes,
      carrierTranslationZ,
      contactMode: segment.kind === 'operation'
        ? 'selected-cam-operating'
        : 'axial-selection-on-common-heel-sleeve',
      cyclePhase: demonstrationTime / demonstrationPeriod,
      demonstrationIndex,
      demonstrationTime,
      driveAngle,
      driveAngularAcceleration,
      driveAngularSpeed,
      follower,
      nominalAngularSpeed,
      operating: segment.kind === 'operation',
      rollerAngularDisplacement,
      selectedCamIndex,
      selectionProgress,
      selectorAligned: segment.kind === 'operation',
      selectorVelocityZ,
      stage,
      supportSleeveRadius: baseRadius,
      valveStroke: motionExtrema[contactCamIndex].outputStroke,
      workingCamAxialSupportOverlap: axialSupportOverlap,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * demonstrationPeriod
  );

  root.userData.mechanism =
    'axially-sliding-four-throw-common-heel-camshaft-rocker-valve-rod';
  root.userData.blocks = {
    baseRails,
    baseTies,
    camBearingPosts,
    camBearingRings,
    camInput,
    camRecords,
    camRotor,
    cameraEnvelope,
    carrierEndCollars,
    carrierHub,
    commonBaseSleeve,
    fixedFrame,
    fixedLeverPivotShaft,
    followerAxle,
    followerRoller,
    lever,
    leverBody,
    leverIndex,
    leverPivotFace,
    leverPivotPost,
    outputPin,
    rotatingShaft,
    shaftKeyIndex,
    slidingCarrier,
    valveGuide,
    valveGuideCheeks,
    valveSlider,
  };
  root.userData.canonicalStates = {
    commonHeelByCam: configs.map((_, camIndex) => (
      operatingStateAtDriveAngle(camIndex, commonHeelDriveAngle)
    )),
    halfDemonstration: stateAtCyclePhase(0.5),
    quarterDemonstration: stateAtCyclePhase(0.25),
    selectedCamSourcePoses: configs.map((_, camIndex) => (
      operatingStateAtDriveAngle(camIndex, 0)
    )),
    source: stateAtTime(0),
    threeQuarterDemonstration: stateAtCyclePhase(0.75),
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    baseRadius,
    baseY,
    camCount,
    camDepth,
    camPitch,
    carrierTranslations,
    commonHeelDriveAngle,
    commonHeelEnvelopeAngle,
    commonHeelEnvelopeRadius,
    commonHeelRollerCenter: commonHeelRollerCenter.clone(),
    configs,
    demonstrationPeriod,
    driveAngleAdvancePerDemonstration,
    driveRampDuration,
    leverLength,
    leverPivot: leverPivot.clone(),
    leverPlaneZ,
    lifts: [...lifts],
    localCamPlanes: [...localCamPlanes],
    motionExtrema,
    nominalAngularSpeed,
    operatingSegments,
    outputArmLength,
    outputPinRadius,
    outputSliderX,
    outputSlotHalfHeight,
    outputSlotHalfWidth,
    outputSlotRailThickness,
    phaseOffset,
    rollerAngleAdvancePerDemonstration,
    rollerMotionRecords,
    rollerRadius,
    rollerWidth,
    scheduleSegments,
    selectionOrder,
    selectionSegments,
    selectorShiftDuration,
    shaftCenter: shaftCenter.clone(),
    sourceEnvelopeDistance,
    sourceLeverDirection: sourceLeverDirection.clone(),
    sourceLeverPivot: sourceLeverPivot.clone(),
    sourceRoller: sourceRoller.clone(),
    sourceRollerCenter: sourceRollerCenter.clone(),
    sourceScale,
    sourceSelectedCamIndex,
    sourceSelectedLift,
    sourceShaft: sourceShaft.clone(),
    sourceValvePin: sourceValvePin.clone(),
    sourceValvePinPosition: sourceValvePinPosition.clone(),
    sourceValvePinProjected: sourceValvePinProjected.clone(),
    sourceValveProjectionError,
    stackLength,
    valveGuideHalfGap,
    valveGuideY,
    valveSliderPlaneZ,
    workingCamPlaneZ,
  };
  root.userData.operatingStateAtDriveAngle = operatingStateAtDriveAngle;
  root.userData.profileGeometryAt = profileGeometryAt;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(camInput, state.driveAngle);
    slidingCarrier.position.z = state.carrierTranslationZ;
    lever.rotation.z = state.follower.leverAngle;
    setSpin(
      followerRoller.root,
      state.rollerAngularDisplacement - state.follower.leverAngle,
    );
    valveSlider.root.position.set(
      state.follower.sliderPosition.x,
      state.follower.sliderPosition.y,
      valveSliderPlaneZ,
    );
    root.userData.contacts = {
      camAtFollowerIndex: state.camAtFollowerIndex,
      camPlaneOffsetZ: state.camPlaneOffsetZ,
      coincidenceError: state.follower.contactCoincidenceError,
      contactAxialSlidingSpeed: state.follower.contactAxialSlidingSpeed,
      contactNormal: state.follower.contactNormal.clone(),
      contactPoint: new THREE.Vector3(
        state.follower.contactPoint.x,
        state.follower.contactPoint.y,
        workingCamPlaneZ,
      ),
      contactTangentialRollingError:
        state.follower.contactTangentialRollingError,
      normalVelocityError: state.follower.contactNormalVelocityError,
      rollerCenter: new THREE.Vector3(
        state.follower.rollerCenter.x,
        state.follower.rollerCenter.y,
        workingCamPlaneZ,
      ),
      workingCamAxialSupportOverlap: state.workingCamAxialSupportOverlap,
    };
    root.userData.kinematics = state;
  };
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
  root.userData.hideGround = true;
  root.userData.supportsRestart = true;
  root.userData.animationTiming = {
    authoredCyclePeriod: demonstrationPeriod,
    displayCycleDuration: demonstrationPeriod,
    playbackTimeScale: 1,
  };
  root.userData.fidelity = 'authored';
  markShadows(root);
  root.traverse((object) => {
    if (!object.userData.cameraFitGuide) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });
  for (const index of [
    shaftKeyIndex,
    leverIndex,
    followerRoller.index,
    valveSlider.rodIndex,
    ...camRecords.flatMap(({ lobeIndex, throwTicks }) => [
      lobeIndex,
      ...throwTicks,
    ]),
  ]) {
    index.castShadow = false;
    index.receiveShadow = false;
  }

  return {
    cameraDirection: new THREE.Vector3(8, 0.2, 15),
    root,
    update,
    reset: () => update(0),
  };
}

export function createAuthoredSelectableCamMovement(movement) {
  switch (movement.id) {
    case 150: return slidingFourThrowCamValveGear();
    default: return null;
  }
}
