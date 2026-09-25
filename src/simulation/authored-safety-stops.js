import { finishOtis278Parts } from './release-mechanism-working-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeDynamicCable,
  makeDynamicLink,
  markShadows,
  matte,
} from './primitives.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

function centeredExtrusion(shape, depth, bevel = 0.01, curveSegments = 1) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevel > 0,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function cylinderAlongZ(radius, length, material, segments = 30) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
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

function cubicBezierPoint(start, controlA, controlB, end, parameter) {
  const oneMinus = 1 - parameter;
  return new THREE.Vector3()
    .addScaledVector(start, oneMinus ** 3)
    .addScaledVector(controlA, 3 * oneMinus ** 2 * parameter)
    .addScaledVector(controlB, 3 * oneMinus * parameter ** 2)
    .addScaledVector(end, parameter ** 3);
}

function otisSafetyStop(movement) {
  const root = new THREE.Group();

  // Brown's plate is the arrested pose. Coordinates are measured from the
  // sliding eye at the overlap of the two inner lever arms. The 1861 Otis
  // patent drawing confirms that those arms slide through the eye; treating
  // all three as a pin joint would overconstrain this symmetric mechanism.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.012;
  const sourceRasterEye = new THREE.Vector2(264, 268);
  const sourceRasterLeftPivot = new THREE.Vector2(151, 249);
  const sourceRasterRightPivot = new THREE.Vector2(377, 249);
  const sourceRasterLeftLowerJoint = new THREE.Vector2(164, 318);
  const sourceRasterRightLowerJoint = new THREE.Vector2(364, 318);
  const sourceRasterLeftPawlTip = new THREE.Vector2(88, 318);
  const sourceRasterRightPawlTip = new THREE.Vector2(440, 318);
  const sourceRasterLeftSpringAnchor = new THREE.Vector2(165, 197);
  const sourceRasterRightSpringAnchor = new THREE.Vector2(363, 197);
  const sourceRasterPlatformLeftTop = new THREE.Vector2(88, 151);
  const sourceRasterPlatformRightTop = new THREE.Vector2(440, 151);
  const sourceRasterPlatformLeftBottom = new THREE.Vector2(88, 475);
  const sourceRasterPlatformRightBottom = new THREE.Vector2(440, 475);
  const sourceRasterRopeEye = new THREE.Vector2(264, 97);
  const sourceRasterLeftRackTip = new THREE.Vector2(92, 325.5);
  const sourceRasterRightRackTip = new THREE.Vector2(436, 325.5);

  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterEye.x) * sourceScale,
    (sourceRasterEye.y - y) * sourceScale,
  );

  const leftPivot = new THREE.Vector3(
    sourcePointToModel(sourceRasterLeftPivot).x,
    sourcePointToModel(sourceRasterLeftPivot).y,
    0.30,
  );
  const rightPivot = new THREE.Vector3(
    sourcePointToModel(sourceRasterRightPivot).x,
    sourcePointToModel(sourceRasterRightPivot).y,
    0.30,
  );
  const sourceLeftLowerJoint = new THREE.Vector3(
    sourcePointToModel(sourceRasterLeftLowerJoint).x,
    sourcePointToModel(sourceRasterLeftLowerJoint).y,
    0.30,
  );
  const sourceRightLowerJoint = new THREE.Vector3(
    sourcePointToModel(sourceRasterRightLowerJoint).x,
    sourcePointToModel(sourceRasterRightLowerJoint).y,
    0.30,
  );
  const leverHalfSpan = -leftPivot.x;
  const trippedLeverAngle = Math.atan2(
    -leftPivot.y,
    leverHalfSpan,
  );
  const lowerArmLength = leftPivot.distanceTo(sourceLeftLowerJoint);
  const sourceLowerArmAngle = Math.atan2(
    sourceLeftLowerJoint.y - leftPivot.y,
    sourceLeftLowerJoint.x - leftPivot.x,
  );
  const elbowAngle = sourceLowerArmAngle - trippedLeverAngle;
  const upperArmVisibleLength = 1.58;
  const pawlLength = sourceLeftLowerJoint.x
    - sourcePointToModel(sourceRasterLeftPawlTip).x;
  const pawlThickness = 0.18;
  const rackToothTipX = Math.abs(
    sourcePointToModel(sourceRasterLeftRackTip).x,
  );
  const rackToothRootX = rackToothTipX + 0.30;
  const rackPitch = 0.52;
  const catchSeatY = sourcePointToModel(sourceRasterLeftRackTip).y;
  const sourcePlatformY = 0;
  const hoistHeight = 1.20;
  const sourceRopeEyeY = sourcePointToModel(sourceRasterRopeEye).y;
  // Brown's leaf spring c hangs from the underside of B's head: its two
  // upturned tips meet the head, and its middle, crossing pin b about 0.5
  // above the eye, bears on a small seat collar on the pin (inferred). The leaf is modelled as a round wire of radius 0.045
  // parted around pin b (the leaf's slot) so the pin does not pass through it.
  const springWireRadius = 0.045;
  const springLayerZ = 0.50;
  const springTipY = sourcePointToModel({ x: 264, y: 197 }).y
    - springWireRadius;
  const springLeftAnchor = new THREE.Vector3(
    sourcePointToModel(sourceRasterLeftSpringAnchor).x,
    springTipY,
    springLayerZ,
  );
  const springRightAnchor = new THREE.Vector3(
    sourcePointToModel(sourceRasterRightSpringAnchor).x,
    springTipY,
    springLayerZ,
  );
  const springContactOffset = sourcePointToModel({ x: 264, y: 226 }).y;
  const springSeatTopY = springContactOffset - springWireRadius - 0.0005;
  const springPinSlotHalfWidth = 0.06 + springWireRadius + 0.012;
  const ropeEyeOffset = sourceRopeEyeY;

  const cyclePeriod = 8;
  const sourceDwellEnd = 0.8;
  const recoveryEnd = 1.8;
  const hoistEnd = 3.4;
  const normalLowerEnd = 4.5;
  const catchTime = 5.7;
  const ropeTongueDepth = 0.10;
  const ropeLayerZ = 0.44 + ropeTongueDepth / 2 + 0.052 + 0.001;
  // Rope a runs on up past Brown's crop to the (unmodelled) hoist, so its
  // break and upper piece stay well out of every framed view instead of a
  // short stub floating just above the platform.
  const upperRopeAnchor = new THREE.Vector3(0, 12, ropeLayerZ);
  const maximumRopeGap = 0.48;

  const leftLowerJointAtAngle = (angle) => new THREE.Vector3(
    leftPivot.x + lowerArmLength * Math.cos(angle + elbowAngle),
    leftPivot.y + lowerArmLength * Math.sin(angle + elbowAngle),
    leftPivot.z,
  );
  const leftLowerJointDerivative = (angle) => new THREE.Vector3(
    -lowerArmLength * Math.sin(angle + elbowAngle),
    lowerArmLength * Math.cos(angle + elbowAngle),
    0,
  );
  const leftLowerJointSecondDerivative = (angle) => new THREE.Vector3(
    -lowerArmLength * Math.cos(angle + elbowAngle),
    -lowerArmLength * Math.sin(angle + elbowAngle),
    0,
  );

  const stateAtCycleTime = (cycleTime) => {
    let springRelease;
    let springReleaseSpeed;
    let springReleaseAcceleration;
    let platformY;
    let platformSpeed;
    let platformAcceleration;
    let stage;

    if (cycleTime < sourceDwellEnd) {
      springRelease = 1;
      springReleaseSpeed = 0;
      springReleaseAcceleration = 0;
      platformY = sourcePlatformY;
      platformSpeed = 0;
      platformAcceleration = 0;
      stage = 'source-arrested-both-pawls-on-hook-racks';
    } else if (cycleTime < recoveryEnd) {
      const motion = quinticWindow(
        cycleTime,
        sourceDwellEnd,
        recoveryEnd,
      );
      springRelease = 1 - motion.position;
      springReleaseSpeed = -motion.velocity;
      springReleaseAcceleration = -motion.acceleration;
      platformY = sourcePlatformY;
      platformSpeed = 0;
      platformAcceleration = 0;
      stage = 'demonstration-reset-rope-retensioning-and-pawls-retracting';
    } else if (cycleTime < hoistEnd) {
      const motion = quinticWindow(cycleTime, recoveryEnd, hoistEnd);
      springRelease = 0;
      springReleaseSpeed = 0;
      springReleaseAcceleration = 0;
      platformY = hoistHeight * motion.position;
      platformSpeed = hoistHeight * motion.velocity;
      platformAcceleration = hoistHeight * motion.acceleration;
      stage = 'normal-hoisting-rope-taut-pawls-clear';
    } else if (cycleTime < normalLowerEnd) {
      const motion = quinticWindow(cycleTime, hoistEnd, normalLowerEnd);
      const travel = rackPitch - hoistHeight;
      springRelease = 0;
      springReleaseSpeed = 0;
      springReleaseAcceleration = 0;
      platformY = hoistHeight + travel * motion.position;
      platformSpeed = travel * motion.velocity;
      platformAcceleration = travel * motion.acceleration;
      stage = 'normal-lowering-rope-taut-pawls-clear';
    } else if (cycleTime < catchTime) {
      const motion = quinticWindow(cycleTime, normalLowerEnd, catchTime);
      springRelease = motion.position;
      springReleaseSpeed = motion.velocity;
      springReleaseAcceleration = motion.acceleration;
      platformY = rackPitch * (1 - motion.position);
      platformSpeed = -rackPitch * motion.velocity;
      platformAcceleration = -rackPitch * motion.acceleration;
      stage = 'rope-failed-spring-tripping-pawls-during-short-drop';
    } else {
      springRelease = 1;
      springReleaseSpeed = 0;
      springReleaseAcceleration = 0;
      platformY = sourcePlatformY;
      platformSpeed = 0;
      platformAcceleration = 0;
      stage = 'platform-caught-and-held-by-both-hook-racks';
    }

    const leverAngle = trippedLeverAngle * springRelease;
    const leverAngularSpeed = trippedLeverAngle * springReleaseSpeed;
    const leverAngularAcceleration = trippedLeverAngle
      * springReleaseAcceleration;
    const pinEyeY = leftPivot.y
      + leverHalfSpan * Math.tan(leverAngle);
    const secantSquared = 1 / Math.cos(leverAngle) ** 2;
    const pinEyeSpeed = leverHalfSpan * secantSquared
      * leverAngularSpeed;
    const pinEyeAcceleration = leverHalfSpan * secantSquared * (
      leverAngularAcceleration
      + 2 * Math.tan(leverAngle) * leverAngularSpeed ** 2
    );
    const leftLowerJoint = leftLowerJointAtAngle(leverAngle);
    const leftLowerFirst = leftLowerJointDerivative(leverAngle);
    const leftLowerSecond = leftLowerJointSecondDerivative(leverAngle);
    const leftLowerVelocity = leftLowerFirst.clone()
      .multiplyScalar(leverAngularSpeed);
    const leftLowerAcceleration = leftLowerSecond.clone()
      .multiplyScalar(leverAngularSpeed ** 2)
      .addScaledVector(leftLowerFirst, leverAngularAcceleration);
    const rightLowerJoint = new THREE.Vector3(
      -leftLowerJoint.x,
      leftLowerJoint.y,
      leftLowerJoint.z,
    );
    const rightLowerVelocity = new THREE.Vector3(
      -leftLowerVelocity.x,
      leftLowerVelocity.y,
      leftLowerVelocity.z,
    );
    const rightLowerAcceleration = new THREE.Vector3(
      -leftLowerAcceleration.x,
      leftLowerAcceleration.y,
      leftLowerAcceleration.z,
    );
    const leftPawlTip = leftLowerJoint.clone()
      .add(new THREE.Vector3(-pawlLength, 0, 0));
    const rightPawlTip = rightLowerJoint.clone()
      .add(new THREE.Vector3(pawlLength, 0, 0));
    const leftPawlGlobal = leftPawlTip.clone();
    const rightPawlGlobal = rightPawlTip.clone();
    leftPawlGlobal.y += platformY;
    rightPawlGlobal.y += platformY;
    const leftPawlGlobalVelocity = leftLowerVelocity.clone().add(
      new THREE.Vector3(0, platformSpeed, 0),
    );
    const rightPawlGlobalVelocity = rightLowerVelocity.clone().add(
      new THREE.Vector3(0, platformSpeed, 0),
    );
    const leftPawlGlobalAcceleration = leftLowerAcceleration.clone().add(
      new THREE.Vector3(0, platformAcceleration, 0),
    );
    const rightPawlGlobalAcceleration = rightLowerAcceleration.clone().add(
      new THREE.Vector3(0, platformAcceleration, 0),
    );
    const pawlUndersideY = leftPawlGlobal.y - pawlThickness / 2;
    const verticalCatchClearance = pawlUndersideY - catchSeatY;
    const lateralRackClearance = rackToothTipX
      - Math.abs(leftPawlTip.x);
    const engagementDepth = Math.max(0, -lateralRackClearance);
    const contactActive = engagementDepth > 0
      && verticalCatchClearance >= -2e-14;
    const caught = springRelease === 1
      && Math.abs(verticalCatchClearance) < 2e-14;
    const pinEye = new THREE.Vector3(0, pinEyeY, 0.44);
    const springContact = new THREE.Vector3(
      0,
      pinEyeY + springContactOffset,
      springLayerZ,
    );
    // The rope's thimble bears on the front face of tongue b at its eye.
    const ropeEye = new THREE.Vector3(
      0,
      platformY + pinEyeY + ropeEyeOffset,
      ropeLayerZ,
    );
    // The break lies above Brown's crop, which shows only the stub a.
    const breakCenter = ropeEye.clone().lerp(upperRopeAnchor, 0.85);
    const halfGap = maximumRopeGap * springRelease / 2;
    const upperBrokenEnd = breakCenter.clone().add(new THREE.Vector3(
      -halfGap * 0.58,
      halfGap,
      0,
    ));
    const lowerBrokenEnd = breakCenter.clone().add(new THREE.Vector3(
      halfGap * 0.58,
      -halfGap,
      0,
    ));
    const leftEyeHeight = leftPivot.y
      + (-leftPivot.x) * Math.tan(leverAngle);
    const rightEyeHeight = rightPivot.y
      + rightPivot.x * Math.tan(leverAngle);

    return {
      contactActive,
      caught,
      engagementDepth,
      eyeClosureError: Math.max(
        Math.abs(leftEyeHeight - pinEyeY),
        Math.abs(rightEyeHeight - pinEyeY),
      ),
      lateralRackClearance,
      leftLowerAcceleration,
      leftLowerJoint,
      leftLowerVelocity,
      leftPawlGlobalAcceleration,
      leftPawlGlobal,
      leftPawlGlobalVelocity,
      leftPawlTip,
      leverAngle,
      leverAngularAcceleration,
      leverAngularSpeed,
      lowerBrokenEnd,
      pawlUndersideY,
      pinEye,
      pinEyeAcceleration,
      pinEyeSpeed,
      platformAcceleration,
      platformSpeed,
      platformY,
      rightLowerAcceleration,
      rightLowerJoint,
      rightLowerVelocity,
      rightPawlGlobalAcceleration,
      rightPawlGlobal,
      rightPawlGlobalVelocity,
      rightPawlTip,
      ropeEye,
      ropeGap: upperBrokenEnd.distanceTo(lowerBrokenEnd),
      ropeTension: 1 - springRelease,
      springContact,
      springRelease,
      springReleaseAcceleration,
      springReleaseSpeed,
      stage,
      upperBrokenEnd,
      verticalCatchClearance,
    };
  };

  const stateAtTime = (time) => {
    const cycleIndex = Math.floor(time / cyclePeriod);
    let cycleTime = THREE.MathUtils.euclideanModulo(time, cyclePeriod);
    for (const eventTime of [
      sourceDwellEnd,
      recoveryEnd,
      hoistEnd,
      normalLowerEnd,
      catchTime,
    ]) {
      if (Math.abs(cycleTime - eventTime) < 1e-12) cycleTime = eventTime;
    }
    return {
      ...stateAtCycleTime(cycleTime),
      cycleIndex,
      cycleTime,
    };
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.60,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.44 });

  // Brown crops the uprights A just above the rope eye and below the legs
  // of B; the hoistway beyond them is not drawn.
  const rackHeight = 6.3;
  const rackCenterY = 0.1;
  const leftUpright = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, rackHeight, 0.74),
    frameMaterial,
  );
  leftUpright.position.set(-2.56, rackCenterY, -0.16);
  leftUpright.userData.role = 'fixed-left-upright-A';
  const rightUpright = leftUpright.clone();
  rightUpright.position.x = 2.56;
  rightUpright.userData.role = 'fixed-right-upright-A';
  root.add(leftUpright, rightUpright);

  const makeRackToothGeometry = (side) => {
    const shape = new THREE.Shape();
    const rootX = side * rackToothRootX;
    const tipX = side * rackToothTipX;
    const points = side < 0
      ? [
        [rootX, -rackPitch * 0.45],
        [tipX, -0.08],
        [tipX, 0.02],
        [rootX, 0.02],
      ]
      : [
        [rootX, -rackPitch * 0.45],
        [rootX, 0.02],
        [tipX, 0.02],
        [tipX, -0.08],
      ];
    points.forEach(([x, y], index) => {
      if (index === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    shape.closePath();
    return centeredExtrusion(shape, 0.46, 0.006);
  };
  const leftToothGeometry = makeRackToothGeometry(-1);
  const rightToothGeometry = makeRackToothGeometry(1);
  const rackTeeth = [];
  for (let index = -4; index <= 7; index += 1) {
    const seatY = catchSeatY + index * rackPitch;
    const leftTooth = new THREE.Mesh(leftToothGeometry, darkMaterial);
    leftTooth.position.set(0, seatY, 0.22);
    leftTooth.userData.role = `fixed-left-upward-hook-rack-tooth-${index + 6}`;
    const rightTooth = new THREE.Mesh(rightToothGeometry, darkMaterial);
    rightTooth.position.set(0, seatY, 0.22);
    rightTooth.userData.role = `fixed-right-upward-hook-rack-tooth-${index + 6}`;
    root.add(leftTooth, rightTooth);
    rackTeeth.push(leftTooth, rightTooth);
  }

  const topCrosshead = makeBeam(
    new THREE.Vector3(-2.80, 4.27, -0.52),
    new THREE.Vector3(2.80, 4.27, -0.52),
    { color: PALETTE.frame, depth: 0.34, thickness: 0.22 },
  );
  topCrosshead.userData.role = 'fixed-hoistway-top-crosshead';
  const base = makeBeam(
    new THREE.Vector3(-2.88, -3.72, -0.52),
    new THREE.Vector3(2.88, -3.72, -0.52),
    { color: PALETTE.frame, depth: 0.38, thickness: 0.24 },
  );
  base.userData.role = 'fixed-hoistway-display-base';
  // Neither the hoistway crosshead nor a base is drawn; they stay detached.

  const carriage = new THREE.Group();
  carriage.userData.axis = new THREE.Vector3(0, 1, 0);
  carriage.userData.role = 'vertically-moving-platform-B-and-safety-frame';
  root.add(carriage);

  const platformLeftX = sourcePointToModel(sourceRasterPlatformLeftTop).x;
  const platformRightX = sourcePointToModel(sourceRasterPlatformRightTop).x;
  const platformTopY = sourcePointToModel(sourceRasterPlatformLeftTop).y;
  const platformBottomY = sourcePointToModel(
    sourceRasterPlatformLeftBottom,
  ).y;
  // B is drawn as an inverted U: a broad head with two legs, open below.
  const platformLegWidth = 0.48;
  const platformLegOutset = 0.19; // clears the uprights' inner faces
  const platformHeadBottomY = sourcePointToModel({ x: 264, y: 197 }).y;
  const platformShape = new THREE.Shape([
    new THREE.Vector2(platformLeftX - platformLegOutset, platformBottomY),
    new THREE.Vector2(platformLeftX - platformLegOutset, platformTopY),
    new THREE.Vector2(platformRightX + platformLegOutset, platformTopY),
    new THREE.Vector2(platformRightX + platformLegOutset, platformBottomY),
    new THREE.Vector2(platformRightX + platformLegOutset - platformLegWidth, platformBottomY),
    new THREE.Vector2(platformRightX + platformLegOutset - platformLegWidth, platformHeadBottomY),
    new THREE.Vector2(platformLeftX - platformLegOutset + platformLegWidth, platformHeadBottomY),
    new THREE.Vector2(platformLeftX - platformLegOutset + platformLegWidth, platformBottomY),
  ]);
  const platformTop = new THREE.Mesh(
    centeredExtrusion(platformShape, 0.34, 0.01),
    driverMaterial,
  );
  platformTop.position.z = -0.46;
  platformTop.userData.role = 'platform-B-inverted-u-head-and-legs';
  const pivotSupport = makeBeam(
    new THREE.Vector3(platformLeftX, leftPivot.y, -0.34),
    new THREE.Vector3(platformRightX, rightPivot.y, -0.34),
    { color: PALETTE.driver, depth: 0.28, thickness: 0.14 },
  );
  pivotSupport.userData.role = 'platform-fixed-elbow-lever-pivot-support';
  carriage.add(
    platformTop,
    pivotSupport,
  );

  const leftLever = new THREE.Group();
  leftLever.position.copy(leftPivot);
  leftLever.userData.axis = Z_AXIS.clone();
  leftLever.userData.role = 'left-rigid-elbow-lever';
  const leftUpperArm = makeBeam(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(upperArmVisibleLength, 0, 0),
    { color: PALETTE.driven, depth: 0.18, thickness: 0.17 },
  );
  leftUpperArm.userData.role = 'left-inner-arm-sliding-through-eye';
  const leftLowerArmVector = new THREE.Vector3(
    lowerArmLength * Math.cos(elbowAngle),
    lowerArmLength * Math.sin(elbowAngle),
    0,
  );
  const leftLowerArm = makeBeam(
    new THREE.Vector3(0, 0, 0),
    leftLowerArmVector,
    { color: PALETTE.driven, depth: 0.20, thickness: 0.19 },
  );
  leftLowerArm.userData.role = 'left-outer-arm-driving-pawl-d';
  leftLever.add(leftUpperArm, leftLowerArm);

  const rightLever = new THREE.Group();
  rightLever.position.copy(rightPivot);
  rightLever.userData.axis = Z_AXIS.clone();
  rightLever.userData.role = 'right-rigid-elbow-lever';
  const rightUpperArm = makeBeam(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-upperArmVisibleLength, 0, 0),
    { color: PALETTE.driven, depth: 0.18, thickness: 0.17 },
  );
  rightUpperArm.userData.role = 'right-inner-arm-sliding-through-eye';
  const rightLowerArmVector = new THREE.Vector3(
    -leftLowerArmVector.x,
    leftLowerArmVector.y,
    0,
  );
  const rightLowerArm = makeBeam(
    new THREE.Vector3(0, 0, 0),
    rightLowerArmVector,
    { color: PALETTE.driven, depth: 0.20, thickness: 0.19 },
  );
  rightLowerArm.userData.role = 'right-outer-arm-driving-pawl-d';
  rightLever.add(rightUpperArm, rightLowerArm);
  carriage.add(leftLever, rightLever);

  const leftPawl = makeDynamicLink({
    color: PALETTE.driven,
    depth: 0.22,
    jointRadius: 0.11,
    thickness: pawlThickness,
  });
  leftPawl.userData.role = 'left-horizontally-guided-safety-pawl-d';
  const rightPawl = makeDynamicLink({
    color: PALETTE.driven,
    depth: 0.22,
    jointRadius: 0.11,
    thickness: pawlThickness,
  });
  rightPawl.userData.role = 'right-horizontally-guided-safety-pawl-d';
  carriage.add(leftPawl, rightPawl);

  const pawlTips = [-1, 1].map((side) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 18, 12),
      whiteMaterial,
    );
    marker.userData.role = side < 0
      ? 'white-left-rack-contact-index'
      : 'white-right-rack-contact-index';
    carriage.add(marker);
    return marker;
  });

  const leverPivotPins = [leftPivot, rightPivot].map((position, index) => {
    const pin = cylinderAlongZ(0.13, 0.72, darkMaterial);
    pin.position.copy(position);
    pin.userData.role = index === 0
      ? 'fixed-left-elbow-fulcrum-pin'
      : 'fixed-right-elbow-fulcrum-pin';
    carriage.add(pin);
    return pin;
  });
  const lowerJointPins = [0, 1].map((index) => {
    const pin = cylinderAlongZ(0.105, 0.56, darkMaterial);
    pin.userData.role = index === 0
      ? 'left-lever-to-pawl-pivot'
      : 'right-lever-to-pawl-pivot';
    carriage.add(pin);
    return pin;
  });

  const pinAssembly = new THREE.Group();
  pinAssembly.position.z = 0.44;
  pinAssembly.userData.axis = new THREE.Vector3(0, 1, 0);
  pinAssembly.userData.role = 'rope-pin-b-and-sliding-eye';
  const verticalPin = makeBeam(
    new THREE.Vector3(0, -0.04, 0),
    new THREE.Vector3(0, ropeEyeOffset, 0),
    { color: PALETTE.ink, depth: 0.16, thickness: 0.12 },
  );
  verticalPin.userData.role = 'vertical-rope-pin-b';
  const slidingEye = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.31, 0.31),
    driverMaterial,
  );
  slidingEye.position.y = 0;
  slidingEye.userData.role = 'eye-c-containing-overlapping-lever-arms';
  // Brown's b is a flat tongue: a round eyed head for the rope a tapering
  // down into the pin, which then passes (dashed) through B's head. In the
  // arrested pose its lower end rests on top of B.
  const tongueHeadRadius = 0.27;
  const tongueHoleRadius = 0.11;
  // The arrested eye is the source origin, so B's top face is at this height
  // above the eye when the tongue rests on it; 0.0005 play is left.
  const tongueBottomY = platformTopY + 0.0005;
  const tongueShape = new THREE.Shape();
  const tongueFootHalfWidth = 0.075;
  const tongueFlare = Math.asin(
    (tongueHeadRadius - tongueFootHalfWidth)
      / (ropeEyeOffset - tongueBottomY),
  );
  tongueShape.moveTo(-tongueFootHalfWidth, tongueBottomY);
  tongueShape.lineTo(tongueFootHalfWidth, tongueBottomY);
  tongueShape.absarc(0, ropeEyeOffset, tongueHeadRadius,
    -tongueFlare, Math.PI + tongueFlare, false);
  tongueShape.closePath();
  const tongueHole = new THREE.Path();
  tongueHole.absarc(0, ropeEyeOffset, tongueHoleRadius, 0, Math.PI * 2,
    true);
  tongueShape.holes.push(tongueHole);
  const ropeEye = new THREE.Mesh(
    centeredExtrusion(tongueShape, ropeTongueDepth, 0, 24),
    darkMaterial,
  );
  ropeEye.userData.role = 'hoisting-rope-eye-a';
  const pinMotionIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.52, 0.035),
    whiteMaterial,
  );
  pinMotionIndex.position.set(0.14, 0.72, 0.18);
  pinMotionIndex.userData.role = 'white-pin-and-spring-motion-index';
  const springSeat = new THREE.Mesh(
    new THREE.BoxGeometry(0.40, 0.08, 0.20),
    darkMaterial,
  );
  springSeat.position.set(0, springSeatTopY - 0.04, 0);
  springSeat.userData.role = 'spring-c-seat-collar-on-pin-b';
  pinAssembly.add(verticalPin, slidingEye, ropeEye, pinMotionIndex,
    springSeat);
  carriage.add(pinAssembly);

  const spring = new THREE.Group();
  const springHalves = ['left', 'right'].map((side) => {
    const half = makeDynamicCable({
      color: PALETTE.brass,
      maxSegments: 12,
      radius: springWireRadius,
    });
    half.userData.role = `${side}-half-of-leaf-spring-c`;
    spring.add(half);
    return half;
  });
  spring.userData.role = 'transverse-leaf-spring-c-pressing-pin-down';
  spring.userData.setPoints = (points) => {
    // Part the wire where it crosses the pin's slot in the leaf; the
    // points run monotonically from the left tip to the right tip.
    const w = springPinSlotHalfWidth;
    const crossing = (a, b, x) => a.clone().lerp(b, (x - a.x) / (b.x - a.x));
    const lastLeft = points.findLastIndex((point) => point.x <= -w);
    const firstRight = points.findIndex((point) => point.x >= w);
    springHalves[0].userData.setPoints([
      ...points.slice(0, lastLeft + 1),
      crossing(points[lastLeft], points[lastLeft + 1], -w),
    ]);
    springHalves[1].userData.setPoints([
      crossing(points[firstRight - 1], points[firstRight], w),
      ...points.slice(firstRight),
    ]);
  };
  carriage.add(spring);
  // The leaf's tips seat under B's head; B's head is carried forward over
  // the lever layers (as the solid head Brown draws) with a slot for pin b.
  const springAnchors = [];
  const headFrontZ = 0.62;
  const headRearZ = -0.29;
  const headInnerHalfWidth = -(platformLeftX - platformLegOutset
    + platformLegWidth);
  const pinSlotHalfWidth = 0.075;
  const pinFrontZ = 0.44 + 0.08;
  const pinRearZ = 0.44 - 0.08;
  const headSpan = platformTopY - platformHeadBottomY;
  const headForward = [
    [-headInnerHalfWidth, -pinSlotHalfWidth, headRearZ, headFrontZ],
    [pinSlotHalfWidth, headInnerHalfWidth, headRearZ, headFrontZ],
    [-pinSlotHalfWidth, pinSlotHalfWidth, pinFrontZ + 0.012, headFrontZ],
    [-pinSlotHalfWidth, pinSlotHalfWidth, headRearZ, pinRearZ - 0.012],
  ].map(([x0, x1, z0, z1], index) => {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(x1 - x0, headSpan, z1 - z0),
      driverMaterial,
    );
    block.position.set((x0 + x1) / 2,
      (platformTopY + platformHeadBottomY) / 2, (z0 + z1) / 2);
    block.userData.role = [
      'platform-B-head-forward-left-of-pin-slot',
      'platform-B-head-forward-right-of-pin-slot',
      'platform-B-head-in-front-of-pin-b',
      'platform-B-head-behind-pin-b',
    ][index];
    carriage.add(block);
    return block;
  });

  const pawlGuides = [-1, 1].flatMap((side) => [-1, 1].map((verticalSide) => {
    const guide = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.10, 0.34),
      frameMaterial,
    );
    guide.position.set(
      side * 1.84,
      sourceLeftLowerJoint.y + verticalSide * 0.2,
      0.30,
    );
    guide.userData.role = `${side < 0 ? 'left' : 'right'}-pawl-guide-${
      verticalSide < 0 ? 'lower' : 'upper'}`;
    carriage.add(guide);
    return guide;
  }));

  const platformPositionIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.42, 0.06),
    whiteMaterial,
  );
  platformPositionIndex.position.set(platformLeftX - 0.13, 0.98, -0.20);
  platformPositionIndex.userData.role = 'white-platform-travel-index';
  carriage.add(platformPositionIndex);

  // Brown draws a as a hatched laid rope: the shared three-strand rope.
  const upperRope = makeDynamicCable({
    color: PALETTE.belt,
    laid: true,
    maxSegments: 9,
    radius: 0.052,
  });
  upperRope.userData.role = 'upper-segment-of-hoisting-rope-a';
  const lowerRope = makeDynamicCable({
    color: PALETTE.belt,
    laid: true,
    maxSegments: 9,
    radius: 0.052,
  });
  lowerRope.userData.role = 'lower-segment-of-hoisting-rope-a';
  root.add(upperRope, lowerRope);
  const topRopeAnchor = cylinderAlongZ(0.15, 0.64, darkMaterial);
  topRopeAnchor.position.copy(upperRopeAnchor);
  topRopeAnchor.userData.role = 'fixed-upper-rope-support';

  const catchMarkers = [-1, 1].map((side) => {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.025, 0.52),
      whiteMaterial,
    );
    marker.position.set(
      side * (rackToothTipX + 0.07),
      catchSeatY + 0.033,
      0.23,
    );
    marker.userData.role = side < 0
      ? 'white-left-arrest-seat-index'
      : 'white-right-arrest-seat-index';
    root.add(marker);
    return marker;
  });

  const sourceState = stateAtTime(0);
  const sourceIdealizationPixelErrors = {
    eye: new THREE.Vector2(
      sourceState.pinEye.x,
      sourceState.pinEye.y,
    ).distanceTo(sourcePointToModel(sourceRasterEye)) / sourceScale,
    leftLowerJoint: new THREE.Vector2(
      sourceState.leftLowerJoint.x,
      sourceState.leftLowerJoint.y,
    ).distanceTo(sourcePointToModel(sourceRasterLeftLowerJoint)) / sourceScale,
    leftPawlTip: new THREE.Vector2(
      sourceState.leftPawlTip.x,
      sourceState.leftPawlTip.y,
    ).distanceTo(sourcePointToModel(sourceRasterLeftPawlTip)) / sourceScale,
    leftPivot: new THREE.Vector2(
      leftPivot.x,
      leftPivot.y,
    ).distanceTo(sourcePointToModel(sourceRasterLeftPivot)) / sourceScale,
    leftSpringAnchor: new THREE.Vector2(
      springLeftAnchor.x,
      springLeftAnchor.y,
    ).distanceTo(sourcePointToModel(sourceRasterLeftSpringAnchor))
      / sourceScale,
    platformLeftTop: new THREE.Vector2(
      platformLeftX,
      platformTopY,
    ).distanceTo(sourcePointToModel(sourceRasterPlatformLeftTop)) / sourceScale,
    platformRightTop: new THREE.Vector2(
      platformRightX,
      platformTopY,
    ).distanceTo(sourcePointToModel(sourceRasterPlatformRightTop)) / sourceScale,
    rightLowerJoint: new THREE.Vector2(
      sourceState.rightLowerJoint.x,
      sourceState.rightLowerJoint.y,
    ).distanceTo(sourcePointToModel(sourceRasterRightLowerJoint)) / sourceScale,
    rightPawlTip: new THREE.Vector2(
      sourceState.rightPawlTip.x,
      sourceState.rightPawlTip.y,
    ).distanceTo(sourcePointToModel(sourceRasterRightPawlTip)) / sourceScale,
    rightPivot: new THREE.Vector2(
      rightPivot.x,
      rightPivot.y,
    ).distanceTo(sourcePointToModel(sourceRasterRightPivot)) / sourceScale,
    rightSpringAnchor: new THREE.Vector2(
      springRightAnchor.x,
      springRightAnchor.y,
    ).distanceTo(sourcePointToModel(sourceRasterRightSpringAnchor))
      / sourceScale,
    ropeEye: new THREE.Vector2(
      sourceState.ropeEye.x,
      sourceState.ropeEye.y,
    ).distanceTo(sourcePointToModel(sourceRasterRopeEye)) / sourceScale,
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    base,
    carriage,
    catchMarkers,
    leftLever,
    leftLowerArm,
    leftPawl,
    leftUpperArm,
    leftUpright,
    leverPivotPins,
    lowerJointPins,
    lowerRope,
    pawlGuides,
    pawlTips,
    pinAssembly,
    pinMotionIndex,
    pivotSupport,
    platformPositionIndex,
    platformTop,
    rackTeeth,
    rightLever,
    rightLowerArm,
    rightPawl,
    rightUpperArm,
    rightUpright,
    ropeEye,
    slidingEye,
    spring,
    springAnchors,
    headForward,
    springSeat,
    topCrosshead,
    topRopeAnchor,
    upperRope,
    verticalPin,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.12, -3.12, -2.10),
    new THREE.Vector3(3.12, 3.8, 2.10),
  );
  root.userData.geometry = {
    catchSeatY,
    cyclePeriod,
    elbowAngle,
    hoistHeight,
    leverHalfSpan,
    leftPivot: leftPivot.clone(),
    lowerArmLength,
    maximumRopeGap,
    pawlLength,
    pawlThickness,
    platformBottomY,
    platformLeftX,
    platformRightX,
    platformTopY,
    rackPitch,
    rackToothRootX,
    rackToothTipX,
    rightPivot: rightPivot.clone(),
    ropeEyeOffset,
    sourcePlatformY,
    sourceScale,
    springContactOffset,
    tongueBottomY,
    springLeftAnchor: springLeftAnchor.clone(),
    springRightAnchor: springRightAnchor.clone(),
    trippedLeverAngle,
    upperArmVisibleLength,
    upperRopeAnchor: upperRopeAnchor.clone(),
  };
  root.userData.mechanism =
    'one hoisting rope a lifts vertical pin b against transverse spring c; the sliding eye on b contains the overlapping inner arms of two rigid elbow levers, so rope tension retracts both pawls d during normal platform travel, while loss of tension lets the spring lower the eye, rotate both levers outward, and seat both pawls d simultaneously on the fixed upward-hook racks A';
  root.userData.movement = movement;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason:
      'The official Movement 278 page marks its animation unavailable. The normal taut-rope state, short failure drop, spring trip, bilateral catch, and looping recovery demonstration were reconstructed independently from Brown’s public-domain plate and the original Otis patent specification.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate278: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'one moving platform B between two fixed rack uprights A, one rope-driven vertical pin b, one transverse spring c, two mirrored rigid elbow levers whose inner arms overlap in a sliding eye, and two outward-moving safety pawls d',
      measurementUncertaintyPixels: 5,
      rasterEye: { x: sourceRasterEye.x, y: sourceRasterEye.y },
      rasterLeftLowerJoint: {
        x: sourceRasterLeftLowerJoint.x,
        y: sourceRasterLeftLowerJoint.y,
      },
      rasterLeftPawlTip: {
        x: sourceRasterLeftPawlTip.x,
        y: sourceRasterLeftPawlTip.y,
      },
      rasterLeftPivot: {
        x: sourceRasterLeftPivot.x,
        y: sourceRasterLeftPivot.y,
      },
      rasterLeftRackTip: {
        x: sourceRasterLeftRackTip.x,
        y: sourceRasterLeftRackTip.y,
      },
      rasterLeftSpringAnchor: {
        x: sourceRasterLeftSpringAnchor.x,
        y: sourceRasterLeftSpringAnchor.y,
      },
      rasterPlatformLeftBottom: {
        x: sourceRasterPlatformLeftBottom.x,
        y: sourceRasterPlatformLeftBottom.y,
      },
      rasterPlatformLeftTop: {
        x: sourceRasterPlatformLeftTop.x,
        y: sourceRasterPlatformLeftTop.y,
      },
      rasterPlatformRightBottom: {
        x: sourceRasterPlatformRightBottom.x,
        y: sourceRasterPlatformRightBottom.y,
      },
      rasterPlatformRightTop: {
        x: sourceRasterPlatformRightTop.x,
        y: sourceRasterPlatformRightTop.y,
      },
      rasterRightLowerJoint: {
        x: sourceRasterRightLowerJoint.x,
        y: sourceRasterRightLowerJoint.y,
      },
      rasterRightPawlTip: {
        x: sourceRasterRightPawlTip.x,
        y: sourceRasterRightPawlTip.y,
      },
      rasterRightPivot: {
        x: sourceRasterRightPivot.x,
        y: sourceRasterRightPivot.y,
      },
      rasterRightRackTip: {
        x: sourceRasterRightRackTip.x,
        y: sourceRasterRightRackTip.y,
      },
      rasterRightSpringAnchor: {
        x: sourceRasterRightSpringAnchor.x,
        y: sourceRasterRightSpringAnchor.y,
      },
      rasterRopeEye: {
        x: sourceRasterRopeEye.x,
        y: sourceRasterRopeEye.y,
      },
      sourceIdealizationPixelErrors,
    },
    primaryPatent: {
      evidence:
        'The specification identifies two upward-hook racks, bent levers pivoted to the platform, overlapping inner lever ends in the eye of a vertical bar, a spring tending to engage the pawls, and immediate bilateral engagement when rope pull is lost.',
      inventor: 'E. G. Otis',
      patentDate: '1861-01-15',
      patentNumber: 'US31128A',
      title: 'Improvement in Hoisting Apparatus',
      url: 'https://patents.google.com/patent/US31128A/en',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 73,
      edition: 21,
      illustrationPage: 72,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCycleTime = stateAtCycleTime;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    catchTime,
    cyclePeriod,
    hoistEnd,
    normalLowerEnd,
    recoveryEnd,
    sourceDwellEnd,
    sourceTime: 0,
  };
  root.userData.transmission = {
    bilateral: true,
    constraintLaw:
      'each rigid elbow lever rotates about its platform fulcrum; its inner arm slides through the vertical eye at y = pivotY + halfSpan*tan(leverAngle), while its fixed lower arm carries one pawl outward',
    failureLaw:
      'loss of rope tension releases spring c, lowers pin b, extends both pawls into the rack gaps during one short pitch of descent, and arrests both pawl undersides on the same pair of upward-hook tooth seats',
    leftLowerJointAtAngle,
    rackPitch,
    stateAtCycleTime,
    stateAtTime,
  };

  const updateSpring = (state) => {
    const center = state.springContact;
    const leftControlA = springLeftAnchor.clone().lerp(center, 0.46)
      .add(new THREE.Vector3(0, 0.08 * state.springRelease, 0));
    const leftControlB = springLeftAnchor.clone().lerp(center, 0.78)
      .add(new THREE.Vector3(0, 0.04 * state.springRelease, 0));
    const rightControlA = center.clone().lerp(springRightAnchor, 0.22)
      .add(new THREE.Vector3(0, 0.04 * state.springRelease, 0));
    const rightControlB = center.clone().lerp(springRightAnchor, 0.54)
      .add(new THREE.Vector3(0, 0.08 * state.springRelease, 0));
    const points = [];
    for (let index = 0; index <= 12; index += 1) {
      points.push(cubicBezierPoint(
        springLeftAnchor,
        leftControlA,
        leftControlB,
        center,
        index / 12,
      ));
    }
    for (let index = 1; index <= 12; index += 1) {
      points.push(cubicBezierPoint(
        center,
        rightControlA,
        rightControlB,
        springRightAnchor,
        index / 12,
      ));
    }
    spring.userData.setPoints(points);
    spring.userData.center = center.clone();
    spring.userData.release = state.springRelease;
  };

  const updateRope = (state) => {
    const upperControlA = upperRopeAnchor.clone().lerp(
      state.upperBrokenEnd,
      0.36,
    );
    const upperControlB = upperRopeAnchor.clone().lerp(
      state.upperBrokenEnd,
      0.72,
    ).add(new THREE.Vector3(-0.04 * state.springRelease, 0, 0));
    const upperPoints = Array.from({ length: 10 }, (_, index) => (
      cubicBezierPoint(
        upperRopeAnchor,
        upperControlA,
        upperControlB,
        state.upperBrokenEnd,
        index / 9,
      )
    ));
    const lowerControlA = state.lowerBrokenEnd.clone().lerp(
      state.ropeEye,
      0.32,
    ).add(new THREE.Vector3(0.08 * state.springRelease, -0.07, 0));
    const lowerControlB = state.lowerBrokenEnd.clone().lerp(
      state.ropeEye,
      0.72,
    ).add(new THREE.Vector3(0.04 * state.springRelease, -0.06, 0));
    const lowerPoints = Array.from({ length: 10 }, (_, index) => (
      cubicBezierPoint(
        state.lowerBrokenEnd,
        lowerControlA,
        lowerControlB,
        state.ropeEye,
        index / 9,
      )
    ));
    // The rope material rises and falls with the platform eye, so the lay
    // travels with it (both pieces run downward from their upper ends).
    const ropeTravel = -state.ropeEye.y;
    upperRope.userData.setPoints(upperPoints, ropeTravel);
    lowerRope.userData.setPoints(lowerPoints, ropeTravel);
    upperRope.userData.brokenEnd = state.upperBrokenEnd.clone();
    lowerRope.userData.brokenEnd = state.lowerBrokenEnd.clone();
    lowerRope.userData.attachment = state.ropeEye.clone();
  };

  const update = (time) => {
    const state = stateAtTime(time);
    carriage.position.y = state.platformY;
    carriage.userData.velocity = new THREE.Vector3(
      0,
      state.platformSpeed,
      0,
    );
    carriage.userData.acceleration = new THREE.Vector3(
      0,
      state.platformAcceleration,
      0,
    );
    leftLever.rotation.z = state.leverAngle;
    rightLever.rotation.z = -state.leverAngle;
    leftLever.userData.angularSpeed = state.leverAngularSpeed;
    rightLever.userData.angularSpeed = -state.leverAngularSpeed;
    leftPawl.userData.setEndpoints(
      state.leftLowerJoint,
      state.leftPawlTip,
    );
    rightPawl.userData.setEndpoints(
      state.rightLowerJoint,
      state.rightPawlTip,
    );
    lowerJointPins[0].position.copy(state.leftLowerJoint);
    lowerJointPins[1].position.copy(state.rightLowerJoint);
    pawlTips[0].position.copy(state.leftPawlTip);
    pawlTips[1].position.copy(state.rightPawlTip);
    pinAssembly.position.y = state.pinEye.y;
    pinAssembly.userData.velocity = new THREE.Vector3(
      0,
      state.pinEyeSpeed,
      0,
    );
    updateSpring(state);
    updateRope(state);
    root.userData.contacts = {
      leftPawlRack: {
        active: state.caught,
        engagementDepth: state.engagementDepth,
        lateralClearance: state.lateralRackClearance,
        point: new THREE.Vector3(
          -rackToothTipX,
          catchSeatY,
          state.leftPawlGlobal.z,
        ),
        verticalClearance: state.verticalCatchClearance,
      },
      rightPawlRack: {
        active: state.caught,
        engagementDepth: state.engagementDepth,
        lateralClearance: state.lateralRackClearance,
        point: new THREE.Vector3(
          rackToothTipX,
          catchSeatY,
          state.rightPawlGlobal.z,
        ),
        verticalClearance: state.verticalCatchClearance,
      },
      rope: {
        gap: state.ropeGap,
        tension: state.ropeTension,
      },
    };
    root.userData.kinematics = state;
  };

  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(4.4, 3.8, 12.0),
  };
}

export function createAuthoredSafetyStopMovement(movement) {
  if (movement.id !== 278) return null;
  const result = finishOtis278Parts(otisSafetyStop(movement));
  // Pin b ends inside tongue b's foot, not up through its rope hole.
  const { blocks: finished, geometry: finishedGeometry } = result.root.userData;
  finished.verticalPin.userData.setEndpoints(
    new THREE.Vector3(0, 0.175, 0),
    new THREE.Vector3(0, finishedGeometry.tongueBottomY + 0.25, 0),
  );
  // Brown draws no index marks on the pin, platform or rack seats.
  const whiteIndices = [];
  result.root.traverse((object) => {
    if (/^white-/.test(object.userData.role ?? '')) whiteIndices.push(object);
  });
  for (const object of whiteIndices) object.removeFromParent();
  // The uprights A stand on a plain floor sill that ties their feet, so they
  // no longer float below Brown's crop.
  const leftPost = result.root.children.find((o) => o.userData.role === 'fixed-left-upright-A');
  const postBox = new THREE.Box3().setFromObject(leftPost);
  const sillHeight = 0.26;
  const baseSill = new THREE.Mesh(
    new THREE.BoxGeometry(2 * 2.79 + 0.4, sillHeight, postBox.max.z - postBox.min.z + 0.24),
    leftPost.material,
  );
  baseSill.position.set(0, postBox.min.y - sillHeight / 2, (postBox.min.z + postBox.max.z) / 2);
  baseSill.userData.role = 'fixed-floor-sill-carrying-uprights-A';
  baseSill.castShadow = true;
  baseSill.receiveShadow = true;
  result.root.add(baseSill);
  finished.baseSill = baseSill;
  if (result.root.userData.cameraFitBounds) {
    result.root.userData.cameraFitBounds.min.y = Math.min(
      result.root.userData.cameraFitBounds.min.y, postBox.min.y - sillHeight - 0.03);
  }
  result.root.userData.fidelity = 'authored';
  return result;
}
