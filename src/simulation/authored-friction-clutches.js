import * as THREE from 'three';
import {
  PALETTE,
  makeDynamicCable,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function wrappedAngle(angle) {
  const turns = angle / FULL_TURN;
  if (Math.abs(turns - Math.round(turns)) < 1e-11) return 0;
  return THREE.MathUtils.euclideanModulo(angle, FULL_TURN);
}

function smootherStep(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped ** 3 * (clamped * (clamped * 6 - 15) + 10);
}

function smootherStepDerivative(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * clamped ** 2 * (1 - clamped) ** 2;
}

function smootherStepSecondDerivative(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * clamped * (1 - clamped) * (1 - 2 * clamped);
}

function rotate2(point, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
}

function annularExtrusionGeometry({ depth, innerRadius, outerRadius }) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 96,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function lobedCarrierGeometry({
  baseRadius,
  boreRadius,
  depth,
  lobeAmplitude,
  lobeCount,
  phase,
}) {
  const shape = new THREE.Shape();
  const segments = 128;
  for (let index = 0; index <= segments; index += 1) {
    const angle = FULL_TURN * index / segments;
    const radius = baseRadius
      + lobeAmplitude * Math.cos(lobeCount * (angle - phase));
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, 0, boreRadius, 0, FULL_TURN, true);
  shape.holes.push(bore);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    curveSegments: 64,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function cubicPoint(points, progress) {
  const inverse = 1 - progress;
  return points[0].clone().multiplyScalar(inverse ** 3)
    .add(points[1].clone().multiplyScalar(3 * inverse ** 2 * progress))
    .add(points[2].clone().multiplyScalar(3 * inverse * progress ** 2))
    .add(points[3].clone().multiplyScalar(progress ** 3));
}

function cubicTangent(points, progress) {
  const inverse = 1 - progress;
  return points[1].clone().sub(points[0])
    .multiplyScalar(3 * inverse ** 2)
    .add(points[2].clone().sub(points[1])
      .multiplyScalar(6 * inverse * progress))
    .add(points[3].clone().sub(points[2])
      .multiplyScalar(3 * progress ** 2))
    .normalize();
}

function taperedCurvedArmGeometry({
  controlPoints,
  depth,
  endHalfWidth,
  startHalfWidth,
}) {
  const outer = [];
  const inner = [];
  const samples = 48;
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const center = cubicPoint(controlPoints, progress);
    const tangent = cubicTangent(controlPoints, progress);
    const normal = new THREE.Vector2(-tangent.y, tangent.x);
    const widthProgress = smootherStep(progress);
    const halfWidth = THREE.MathUtils.lerp(
      startHalfWidth,
      endHalfWidth,
      widthProgress,
    );
    outer.push(center.clone().addScaledVector(normal, halfWidth));
    inner.push(center.clone().addScaledVector(normal, -halfWidth));
  }
  const shape = new THREE.Shape();
  shape.moveTo(outer[0].x, outer[0].y);
  outer.slice(1).forEach((point) => shape.lineTo(point.x, point.y));
  inner.reverse().forEach((point) => shape.lineTo(point.x, point.y));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.018,
    bevelThickness: 0.018,
    curveSegments: 24,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function radialSpoke({
  angle,
  depth,
  innerRadius,
  material,
  outerRadius,
  width,
  z,
}) {
  const length = outerRadius - innerRadius;
  const spoke = new THREE.Mesh(
    new THREE.BoxGeometry(length, width, depth),
    material,
  );
  const centerRadius = (innerRadius + outerRadius) / 2;
  spoke.position.set(
    centerRadius * Math.cos(angle),
    centerRadius * Math.sin(angle),
    z,
  );
  spoke.rotation.z = angle;
  return spoke;
}

function clockwiseArrow({ material, radius, z }) {
  const points = [];
  const startAngle = THREE.MathUtils.degToRad(68);
  const endAngle = THREE.MathUtils.degToRad(-26);
  const samples = 42;
  for (let index = 0; index <= samples; index += 1) {
    const angle = THREE.MathUtils.lerp(
      startAngle,
      endAngle,
      index / samples,
    );
    points.push(new THREE.Vector3(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
      z,
    ));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const group = new THREE.Group();
  const arc = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 80, 0.035, 8, false),
    material,
  );
  arc.userData.role = 'fixed-source-clockwise-freewheel-direction-arrow';
  const end = points.at(-1);
  const tangent = new THREE.Vector3(
    Math.sin(endAngle),
    -Math.cos(endAngle),
    0,
  ).normalize();
  const arrowhead = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.34, 20),
    material,
  );
  arrowhead.position.copy(end).addScaledVector(tangent, 0.08);
  arrowhead.quaternion.setFromUnitVectors(Y_AXIS, tangent);
  arrowhead.userData.role = 'clockwise-freewheel-arrowhead';
  group.add(arc, arrowhead);
  group.userData.role = 'fixed-clockwise-arrow-not-part-of-pulley';
  return group;
}

function zigzagSpringPoints(anchor, attachment, z) {
  const direction = attachment.clone().sub(anchor);
  const length = direction.length();
  if (length < 1e-10) return [
    new THREE.Vector3(anchor.x, anchor.y, z),
    new THREE.Vector3(attachment.x, attachment.y, z),
  ];
  direction.multiplyScalar(1 / length);
  const normal = new THREE.Vector2(-direction.y, direction.x);
  const points = [];
  const bends = 8;
  for (let index = 0; index <= bends; index += 1) {
    const progress = index / bends;
    const point = anchor.clone().lerp(attachment, progress);
    if (index > 0 && index < bends) {
      point.addScaledVector(normal, index % 2 === 0 ? -0.04 : 0.04);
    }
    points.push(new THREE.Vector3(point.x, point.y, z));
  }
  return points;
}

function springBiasedOverrunningPulley(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.94);

  const rimOuterRadius = 2.2;
  const rimInnerRadius = 2;
  const rimDepth = 0.34;
  const rearWebZ = -0.22;
  const rearWebDepth = 0.12;
  const looseHubOuterRadius = 0.55;
  const shaftRadius = 0.31;
  const carrierPhase = THREE.MathUtils.degToRad(80);
  const carrierBaseRadius = 0.75;
  const carrierLobeAmplitude = 0.13;
  const carrierDepth = 0.22;
  const pivotRadius = 0.72;
  const pivotBossRadius = 0.13;
  const pivotCount = 4;
  const contactLeadAngle = THREE.MathUtils.degToRad(-18);
  const releasedArmAngle = THREE.MathUtils.degToRad(-18);
  const armStartHalfWidth = 0.16;
  const armEndHalfWidth = 0.085;
  const armDepth = 0.16;
  const armPlaneZ = 0.3;
  const springPlaneZ = 0.43;
  const driveDuration = 4;
  const freewheelDuration = 4;
  const springResetDuration = 1.2;
  const demonstrationPeriod = driveDuration
    + freewheelDuration + springResetDuration;
  const armReleaseFraction = 0.32;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.6,
  });
  const armMaterial = matte(PALETTE.accent, {
    metalness: 0.14,
    roughness: 0.57,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.46,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.4 });

  const outerRotor = new THREE.Group();
  outerRotor.userData.axis = new THREE.Vector3(0, 0, 1);
  outerRotor.userData.role =
    'independently-rotating-friction-pulley-rim-and-loose-rear-web';
  const rim = new THREE.Mesh(
    annularExtrusionGeometry({
      depth: rimDepth,
      innerRadius: rimInnerRadius,
      outerRadius: rimOuterRadius,
    }),
    driverMaterial,
  );
  rim.userData.role = 'continuous-inner-surface-driving-pulley-rim';
  const innerLiner = new THREE.Mesh(
    new THREE.TorusGeometry(
      rimInnerRadius + 0.035,
      0.035,
      9,
      120,
    ),
    darkMaterial,
  );
  innerLiner.position.z = rimDepth / 2 + 0.012;
  innerLiner.userData.role = 'friction-rim-inner-working-surface';

  const looseHub = new THREE.Mesh(
    annularExtrusionGeometry({
      depth: rearWebDepth,
      innerRadius: shaftRadius + 0.055,
      outerRadius: looseHubOuterRadius,
    }),
    driverMaterial,
  );
  looseHub.position.z = rearWebZ;
  looseHub.userData.role = 'loose-pulley-hub-free-on-output-shaft';
  const spokes = Array.from({ length: 4 }, (_, index) => {
    const spoke = radialSpoke({
      angle: index * Math.PI / 2,
      depth: rearWebDepth,
      innerRadius: looseHubOuterRadius - 0.03,
      material: driverMaterial,
      outerRadius: rimInnerRadius + 0.02,
      width: 0.15,
      z: rearWebZ,
    });
    spoke.userData.role = 'rear-loose-pulley-web-spoke';
    return spoke;
  });
  const rimIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.075, 0.055),
    whiteMaterial,
  );
  rimIndex.position.set(2.09, 0, rimDepth / 2 + 0.045);
  rimIndex.userData.role = 'white-rim-face-rotation-index';
  const rimTreadIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.34, 0.18),
    whiteMaterial,
  );
  rimTreadIndex.position.set(rimOuterRadius - 0.04, 0, 0);
  rimTreadIndex.userData.role = 'white-rim-tread-rotation-index';
  outerRotor.add(
    rim,
    innerLiner,
    looseHub,
    rimIndex,
    rimTreadIndex,
    ...spokes,
  );

  const carrierRotor = new THREE.Group();
  carrierRotor.userData.axis = new THREE.Vector3(0, 0, 1);
  carrierRotor.userData.role =
    'output-shaft-carrier-with-four-independent-pivoted-eccentric-arms';
  const carrier = new THREE.Mesh(
    lobedCarrierGeometry({
      baseRadius: carrierBaseRadius,
      boreRadius: shaftRadius + 0.025,
      depth: carrierDepth,
      lobeAmplitude: carrierLobeAmplitude,
      lobeCount: pivotCount,
      phase: carrierPhase,
    }),
    drivenMaterial,
  );
  carrier.position.z = 0.12;
  carrier.userData.role = 'four-lobed-output-shaft-arm-carrier';
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(shaftRadius, shaftRadius, 1.18, 40),
    darkMaterial,
  );
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.03;
  shaft.userData.role = 'driven-output-shaft-rigid-with-arm-carrier';
  const shaftFace = new THREE.Mesh(
    new THREE.CircleGeometry(shaftRadius * 0.82, 40),
    drivenMaterial,
  );
  shaftFace.position.z = 0.625;
  shaftFace.userData.role = 'driven-output-shaft-front-face';
  const carrierIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 18, 12),
    whiteMaterial,
  );
  carrierIndex.position.set(0.34, 0.08, 0.66);
  carrierIndex.userData.role = 'white-output-shaft-rotation-index';
  carrierRotor.add(carrier, shaft, shaftFace, carrierIndex);

  const contactRadial = new THREE.Vector2(
    Math.cos(contactLeadAngle),
    Math.sin(contactLeadAngle),
  );
  const pivotLocal = new THREE.Vector2(pivotRadius, 0);
  const tipCenterRelative = contactRadial.clone()
    .multiplyScalar(rimInnerRadius - armEndHalfWidth)
    .sub(pivotLocal);
  const tipOuterRelative = contactRadial.clone()
    .multiplyScalar(rimInnerRadius)
    .sub(pivotLocal);
  const clockwiseTangent = new THREE.Vector2(
    Math.sin(contactLeadAngle),
    -Math.cos(contactLeadAngle),
  );
  const armControlPoints = [
    new THREE.Vector2(-0.04, 0),
    new THREE.Vector2(0.43, 0.08),
    tipCenterRelative.clone().addScaledVector(clockwiseTangent, -0.36),
    tipCenterRelative.clone(),
  ];
  const armGeometry = taperedCurvedArmGeometry({
    controlPoints: armControlPoints,
    depth: armDepth,
    endHalfWidth: armEndHalfWidth,
    startHalfWidth: armStartHalfWidth,
  });
  const arms = [];
  const pivotBosses = [];
  const contactMarkers = [];
  const springs = [];
  const springDefinitions = [];

  for (let index = 0; index < pivotCount; index += 1) {
    const baseAngle = carrierPhase - index * Math.PI / 2;
    const pivot = new THREE.Vector2(
      pivotRadius * Math.cos(baseAngle),
      pivotRadius * Math.sin(baseAngle),
    );
    const armGroup = new THREE.Group();
    armGroup.position.set(pivot.x, pivot.y, armPlaneZ);
    armGroup.rotation.z = baseAngle;
    armGroup.userData.baseAngle = baseAngle;
    armGroup.userData.role = 'spring-biased-pivoted-eccentric-friction-arm';
    const arm = new THREE.Mesh(armGeometry, armMaterial);
    arm.userData.armIndex = index;
    arm.userData.contactLeadAngle = contactLeadAngle;
    arm.userData.eccentricArm = true;
    arm.userData.role = 'curved-eccentric-friction-arm-body';
    const contactMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 10),
      whiteMaterial,
    );
    contactMarker.position.set(
      tipCenterRelative.x,
      tipCenterRelative.y,
      armDepth / 2 + 0.035,
    );
    contactMarker.userData.role = 'white-eccentric-arm-working-tip-index';
    armGroup.add(arm, contactMarker);
    arms.push(armGroup);
    contactMarkers.push(contactMarker);
    carrierRotor.add(armGroup);

    const boss = new THREE.Mesh(
      new THREE.CylinderGeometry(
        pivotBossRadius,
        pivotBossRadius,
        0.24,
        30,
      ),
      darkMaterial,
    );
    boss.rotation.x = Math.PI / 2;
    boss.position.set(pivot.x, pivot.y, armPlaneZ + 0.06);
    boss.userData.role = 'fixed-to-carrier-eccentric-arm-pivot-pin';
    pivotBosses.push(boss);
    carrierRotor.add(boss);

    const spring = makeDynamicCable({
      color: PALETTE.ink,
      maxSegments: 8,
      radius: 0.022,
    });
    spring.userData.role = 'spring-holding-eccentric-arm-toward-rim';
    springs.push(spring);
    carrierRotor.add(spring);
    springDefinitions.push({
      anchorOffset: new THREE.Vector2(-0.15, -0.16),
      attachmentOffset: new THREE.Vector2(0.18, 0.08),
      baseAngle,
      pivot,
      spring,
    });
  }

  const directionArrow = clockwiseArrow({
    material: darkMaterial,
    radius: 2.62,
    z: 0.48,
  });
  root.add(outerRotor, carrierRotor, directionArrow);

  const armWorkingPointAtAngle = (armPivotAngle) => pivotLocal.clone().add(
    rotate2(tipOuterRelative, armPivotAngle),
  );
  const armTipRadiusAtAngle = (armPivotAngle) => (
    armWorkingPointAtAngle(armPivotAngle).length()
  );
  const armTipClearanceAtAngle = (armPivotAngle) => (
    rimInnerRadius - armTipRadiusAtAngle(armPivotAngle)
  );
  const springLengthAtAngle = (armPivotAngle) => {
    const anchor = pivotLocal.clone().add(
      springDefinitions[0].anchorOffset,
    );
    const attachment = pivotLocal.clone().add(
      rotate2(springDefinitions[0].attachmentOffset, armPivotAngle),
    );
    return anchor.distanceTo(attachment);
  };

  const stateAtTime = (time) => {
    const phase = THREE.MathUtils.euclideanModulo(time, demonstrationPeriod);
    const completedCycles = Math.round((time - phase) / demonstrationPeriod);
    const outputCycleBase = completedCycles * FULL_TURN;
    let stage;
    let rimAngleUnwrapped;
    let rimAngularSpeed;
    let rimAngularAcceleration;
    let outputAngleUnwrapped;
    let outputAngularSpeed;
    let outputAngularAcceleration;
    let armPivotAngle;
    let armPivotAngularSpeed;
    let armPivotAngularAcceleration;

    if (phase < driveDuration) {
      const progress = phase / driveDuration;
      const position = smootherStep(progress);
      const rate = smootherStepDerivative(progress) / driveDuration;
      const acceleration = smootherStepSecondDerivative(progress)
        / driveDuration ** 2;
      stage = 'opposite-arrow-counterclockwise-locked-drive';
      rimAngleUnwrapped = FULL_TURN * position;
      rimAngularSpeed = FULL_TURN * rate;
      rimAngularAcceleration = FULL_TURN * acceleration;
      outputAngleUnwrapped = outputCycleBase + FULL_TURN * position;
      outputAngularSpeed = rimAngularSpeed;
      outputAngularAcceleration = rimAngularAcceleration;
      armPivotAngle = 0;
      armPivotAngularSpeed = 0;
      armPivotAngularAcceleration = 0;
    } else if (phase < driveDuration + freewheelDuration) {
      const localTime = phase - driveDuration;
      const progress = localTime / freewheelDuration;
      const position = smootherStep(progress);
      const rate = smootherStepDerivative(progress) / freewheelDuration;
      const acceleration = smootherStepSecondDerivative(progress)
        / freewheelDuration ** 2;
      const releaseProgress = THREE.MathUtils.clamp(
        progress / armReleaseFraction,
        0,
        1,
      );
      const releasePosition = smootherStep(releaseProgress);
      const releaseRate = releaseProgress < 1
        ? smootherStepDerivative(releaseProgress)
          / (freewheelDuration * armReleaseFraction)
        : 0;
      const releaseAcceleration = releaseProgress < 1
        ? smootherStepSecondDerivative(releaseProgress)
          / (freewheelDuration * armReleaseFraction) ** 2
        : 0;
      stage = 'arrow-direction-clockwise-freewheel';
      rimAngleUnwrapped = FULL_TURN * (1 - position);
      rimAngularSpeed = -FULL_TURN * rate;
      rimAngularAcceleration = -FULL_TURN * acceleration;
      outputAngleUnwrapped = outputCycleBase + FULL_TURN;
      outputAngularSpeed = 0;
      outputAngularAcceleration = 0;
      armPivotAngle = releasedArmAngle * releasePosition;
      armPivotAngularSpeed = releasedArmAngle * releaseRate;
      armPivotAngularAcceleration = releasedArmAngle * releaseAcceleration;
    } else {
      const localTime = phase - driveDuration - freewheelDuration;
      const progress = localTime / springResetDuration;
      const position = smootherStep(progress);
      const rate = smootherStepDerivative(progress) / springResetDuration;
      const acceleration = smootherStepSecondDerivative(progress)
        / springResetDuration ** 2;
      stage = 'stationary-spring-return-to-rim';
      rimAngleUnwrapped = 0;
      rimAngularSpeed = 0;
      rimAngularAcceleration = 0;
      outputAngleUnwrapped = outputCycleBase + FULL_TURN;
      outputAngularSpeed = 0;
      outputAngularAcceleration = 0;
      armPivotAngle = releasedArmAngle * (1 - position);
      armPivotAngularSpeed = -releasedArmAngle * rate;
      armPivotAngularAcceleration = -releasedArmAngle * acceleration;
    }

    const armTipRadius = armTipRadiusAtAngle(armPivotAngle);
    const armTipClearance = rimInnerRadius - armTipRadius;
    return {
      armPivotAngle,
      armPivotAngularAcceleration,
      armPivotAngularSpeed,
      armTipClearance,
      armTipRadius,
      clutchLocked: Math.abs(armPivotAngle) < 1e-12,
      completedCycles,
      outputAngle: wrappedAngle(outputAngleUnwrapped),
      outputAngleUnwrapped,
      outputAngularAcceleration,
      outputAngularSpeed,
      outputShaftAtRest: outputAngularSpeed === 0,
      phase,
      relativeRimOutputAngularSpeed:
        rimAngularSpeed - outputAngularSpeed,
      rimAngle: wrappedAngle(rimAngleUnwrapped),
      rimAngleUnwrapped,
      rimAngularAcceleration,
      rimAngularSpeed,
      springLength: springLengthAtAngle(armPivotAngle),
      stage,
      time,
    };
  };

  const engagedWorkingPoint = armWorkingPointAtAngle(0);
  const engagedForceDirection = new THREE.Vector2(
    -Math.sin(contactLeadAngle),
    Math.cos(contactLeadAngle),
  );
  const engagedLeverArm = tipOuterRelative.clone();
  const engagingTorquePerUnitTangentialForce = (
    engagedLeverArm.x * engagedForceDirection.y
      - engagedLeverArm.y * engagedForceDirection.x
  );
  const radialExpansionPerArmRadian = contactRadial.dot(
    new THREE.Vector2(-engagedLeverArm.y, engagedLeverArm.x),
  );

  root.userData.archetype =
    'spring-biased-four-pivot-eccentric-arm-overrunning-friction-pulley';
  root.userData.mechanism =
    'four-spring-biased-eccentric-arms-are-pivoted-to-the-output-shaft-carrier-inside-an-independent-pulley-rim-counterclockwise-friction-wedges-the-arms-for-one-to-one-drive-while-clockwise-friction-retracts-them-and-the-rim-overruns-a-stationary-shaft';
  root.userData.blocks = {
    arms,
    carrier,
    carrierIndex,
    carrierRotor,
    contactMarkers,
    directionArrow,
    innerLiner,
    looseHub,
    outerRotor,
    pivotBosses,
    rim,
    rimIndex,
    rimTreadIndex,
    shaft,
    shaftFace,
    spokes,
    springs,
  };
  root.userData.canonicalTimes = {
    driveMidpoint: driveDuration / 2,
    freewheelMidpoint: driveDuration + freewheelDuration / 2,
    lockedDriveEnd: driveDuration,
    maximumRelease: driveDuration
      + freewheelDuration * armReleaseFraction,
    sourcePose: 0,
    springResetStart: driveDuration + freewheelDuration,
    cycleClosure: demonstrationPeriod,
  };
  root.userData.contactDefinition = {
    arrowDirection: 'clockwise-negative-about-the-visible-positive-z-face',
    engagedWorkingPoint: engagedWorkingPoint.clone(),
    engagingTorquePerUnitTangentialForce,
    freewheelTorquePerUnitTangentialForce:
      -engagingTorquePerUnitTangentialForce,
    radialExpansionPerArmRadian,
    reason:
      'the arm contact leads its carrier pivot clockwise so counterclockwise rim drag rotates the eccentric toward increasing radius and clockwise drag rotates it inward',
  };
  root.userData.driveSchedule = {
    input:
      'one-smooth-counterclockwise-locked-rim-turn-one-smooth-clockwise-freewheel-return-then-a-stationary-spring-reset',
    purpose:
      'both source-prescribed directions are shown without an angular teleport and the spring action is visible before the next drive stroke',
    sourcePrescribesTiming: false,
  };
  root.userData.geometry = {
    armControlPoints: armControlPoints.map((point) => point.clone()),
    armDepth,
    armEndHalfWidth,
    armPlaneZ,
    armStartHalfWidth,
    carrierBaseRadius,
    carrierDepth,
    carrierLobeAmplitude,
    carrierPhase,
    contactLeadAngle,
    looseHubOuterRadius,
    pivotBossRadius,
    pivotCount,
    pivotRadius,
    rearWebDepth,
    rearWebZ,
    releasedArmAngle,
    releasedTipClearance: armTipClearanceAtAngle(releasedArmAngle),
    rimDepth,
    rimInnerRadius,
    rimOuterRadius,
    shaftRadius,
    springPlaneZ,
    tipCenterRelative: tipCenterRelative.clone(),
    tipOuterRelative: tipOuterRelative.clone(),
  };
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official movement 267 page marks its animation unavailable',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate267: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one independently rotating four-spoke loose pulley rim surrounding a shaft-fixed four-lobed carrier with four pivoted clockwise-leading eccentric arms and four return springs',
      measurementUncertaintyPixels: 7,
      officialAnimationAvailable: false,
      rasterArrow: {
        end: { x: 466, y: 194 },
        start: { x: 396, y: 79 },
      },
      rasterArmContactPoints: [
        { x: 349, y: 103 },
        { x: 421, y: 367 },
        { x: 181, y: 434 },
        { x: 108, y: 193 },
      ],
      rasterCarrierPivotCenters: [
        { x: 276, y: 204 },
        { x: 328, y: 282 },
        { x: 253, y: 334 },
        { x: 203, y: 238 },
      ],
      rasterInnerWorkingRadius: 190,
      rasterOuterRimCenter: { x: 266, y: 269 },
      rasterOuterRimRadius: 209,
      rasterShaftRadius: 33,
      rasterSpokeCount: 4,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 67,
      edition: 21,
      illustrationPage: 66,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    armReleaseFraction,
    demonstrationPeriod,
    driveDuration,
    freewheelDuration,
    springResetDuration,
  };
  root.userData.transmission = {
    arrowDirectionOutputAngularSpeed: 0,
    arrowDirectionShaftRemainsAtRest: true,
    oppositeArrowLockedRatio: 1,
    oppositeArrowMotion: 'counterclockwise-positive',
    outputAdvancePerDemonstrationCycle: FULL_TURN,
  };

  const updateSprings = (armPivotAngle) => {
    springDefinitions.forEach((definition) => {
      const anchor = definition.pivot.clone().add(
        rotate2(definition.anchorOffset, definition.baseAngle),
      );
      const attachment = definition.pivot.clone().add(
        rotate2(
          definition.attachmentOffset,
          definition.baseAngle + armPivotAngle,
        ),
      );
      definition.spring.userData.setPoints(
        zigzagSpringPoints(anchor, attachment, springPlaneZ),
      );
    });
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(outerRotor, state.rimAngle);
    setSpin(carrierRotor, state.outputAngle);
    arms.forEach((arm) => {
      arm.rotation.z = arm.userData.baseAngle + state.armPivotAngle;
    });
    updateSprings(state.armPivotAngle);
    outerRotor.userData.angularSpeed = state.rimAngularSpeed;
    carrierRotor.userData.angularSpeed = state.outputAngularSpeed;
    root.userData.contacts = arms.map((_, index) => ({
      armIndex: index,
      clearance: state.armTipClearance,
      engaged: state.clutchLocked,
      rimRadius: rimInnerRadius,
      tipRadius: state.armTipRadius,
    }));
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(2.5, 2.1, 10.8),
  };
}

export function createAuthoredFrictionClutchMovement(movement) {
  if (movement.id !== 267) return null;
  const result = springBiasedOverrunningPulley(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
