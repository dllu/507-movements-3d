import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function modulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherStep01(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t ** 3 * (t * (t * 6 - 15) + 10);
}

function smootherStepFirstDerivative(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * t ** 2 * (t - 1) ** 2;
}

function smootherStepSecondDerivative(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * t * (t - 1) * (2 * t - 1);
}

function transitionState(time, start, end, from, to) {
  if (time <= start) return { acceleration: 0, value: from, velocity: 0 };
  if (time >= end) return { acceleration: 0, value: to, velocity: 0 };
  const duration = end - start;
  const progress = (time - start) / duration;
  const travel = to - from;
  return {
    acceleration:
      travel * smootherStepSecondDerivative(progress) / duration ** 2,
    value: from + travel * smootherStep01(progress),
    velocity: travel * smootherStepFirstDerivative(progress) / duration,
  };
}

function cylinderPoint(radius, angle, y) {
  return new THREE.Vector3(
    Math.sin(angle) * radius,
    y,
    Math.cos(angle) * radius,
  );
}

function appendTriangle(positions, first, second, third) {
  positions.push(
    first.x,
    first.y,
    first.z,
    second.x,
    second.y,
    second.z,
    third.x,
    third.y,
    third.z,
  );
}

function appendQuad(positions, first, second, third, fourth, reverse = false) {
  if (reverse) {
    appendTriangle(positions, first, fourth, third);
    appendTriangle(positions, first, third, second);
  } else {
    appendTriangle(positions, first, second, third);
    appendTriangle(positions, first, third, fourth);
  }
}

function appendCylinderPatch({
  angleEnd,
  angleStart,
  positions,
  radius,
  reverse = false,
  segments,
  yBottom,
  yTop,
}) {
  for (let index = 0; index < segments; index += 1) {
    const firstAngle = THREE.MathUtils.lerp(
      angleStart,
      angleEnd,
      index / segments,
    );
    const secondAngle = THREE.MathUtils.lerp(
      angleStart,
      angleEnd,
      (index + 1) / segments,
    );
    appendQuad(
      positions,
      cylinderPoint(radius, firstAngle, yBottom),
      cylinderPoint(radius, secondAngle, yBottom),
      cylinderPoint(radius, secondAngle, yTop),
      cylinderPoint(radius, firstAngle, yTop),
      reverse,
    );
  }
}

function appendAnnularPatch({
  angleEnd,
  angleStart,
  innerRadius,
  outerRadius,
  positions,
  reverse = false,
  segments,
  y,
}) {
  for (let index = 0; index < segments; index += 1) {
    const firstAngle = THREE.MathUtils.lerp(
      angleStart,
      angleEnd,
      index / segments,
    );
    const secondAngle = THREE.MathUtils.lerp(
      angleStart,
      angleEnd,
      (index + 1) / segments,
    );
    appendQuad(
      positions,
      cylinderPoint(innerRadius, firstAngle, y),
      cylinderPoint(outerRadius, firstAngle, y),
      cylinderPoint(outerRadius, secondAngle, y),
      cylinderPoint(innerRadius, secondAngle, y),
      reverse,
    );
  }
}

function appendRadialFace({
  angle,
  innerRadius,
  outerRadius,
  positions,
  reverse = false,
  yBottom,
  yTop,
}) {
  appendQuad(
    positions,
    cylinderPoint(innerRadius, angle, yBottom),
    cylinderPoint(outerRadius, angle, yBottom),
    cylinderPoint(outerRadius, angle, yTop),
    cylinderPoint(innerRadius, angle, yTop),
    reverse,
  );
}

function makeBayonetSocketGeometry({
  axialHalfAngle,
  bottomY,
  innerRadius,
  outerRadius,
  slotEndAngle,
  slotHalfHeight,
  slotY,
  topY,
}) {
  const positions = [];
  const angleDomainStart = -axialHalfAngle;
  const angleDomainEnd = FULL_TURN - axialHalfAngle;
  const slotBottomY = slotY - slotHalfHeight;
  const slotTopY = slotY + slotHalfHeight;
  const appendWallBand = (yBottom, yTop, angleStart, angleEnd) => {
    const angularSpan = angleEnd - angleStart;
    const segments = Math.max(2, Math.ceil(angularSpan / FULL_TURN * 192));
    appendCylinderPatch({
      angleEnd,
      angleStart,
      positions,
      radius: outerRadius,
      segments,
      yBottom,
      yTop,
    });
    appendCylinderPatch({
      angleEnd,
      angleStart,
      positions,
      radius: innerRadius,
      reverse: true,
      segments,
      yBottom,
      yTop,
    });
  };

  // Below the L-slot the sleeve is complete. Across the horizontal leg and
  // the axial leg, only the complementary angular spans remain. This makes
  // the opening genuinely pass through the curved socket wall.
  appendWallBand(
    bottomY,
    slotBottomY,
    angleDomainStart,
    angleDomainEnd,
  );
  appendWallBand(
    slotBottomY,
    slotTopY,
    slotEndAngle,
    angleDomainEnd,
  );
  appendWallBand(
    slotTopY,
    topY,
    axialHalfAngle,
    angleDomainEnd,
  );

  appendAnnularPatch({
    angleEnd: angleDomainEnd,
    angleStart: axialHalfAngle,
    innerRadius,
    outerRadius,
    positions,
    segments: 180,
    y: topY,
  });
  appendAnnularPatch({
    angleEnd: angleDomainEnd,
    angleStart: angleDomainStart,
    innerRadius,
    outerRadius,
    positions,
    reverse: true,
    segments: 192,
    y: bottomY,
  });

  // Five thickness faces form the complete boundary of the open L.
  appendRadialFace({
    angle: -axialHalfAngle,
    innerRadius,
    outerRadius,
    positions,
    reverse: true,
    yBottom: slotBottomY,
    yTop: topY,
  });
  appendRadialFace({
    angle: slotEndAngle,
    innerRadius,
    outerRadius,
    positions,
    yBottom: slotBottomY,
    yTop: slotTopY,
  });
  appendRadialFace({
    angle: axialHalfAngle,
    innerRadius,
    outerRadius,
    positions,
    yBottom: slotTopY,
    yTop: topY,
  });
  appendAnnularPatch({
    angleEnd: slotEndAngle,
    angleStart: -axialHalfAngle,
    innerRadius,
    outerRadius,
    positions,
    reverse: true,
    segments: 48,
    y: slotBottomY,
  });
  appendAnnularPatch({
    angleEnd: slotEndAngle,
    angleStart: axialHalfAngle,
    innerRadius,
    outerRadius,
    positions,
    segments: 40,
    y: slotTopY,
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.slotOpeningIsBooleanCut = true;
  geometry.userData.triangleCount = positions.length / 9;
  return geometry;
}

function sampledArc(radius, angleStart, angleEnd, y, segments) {
  return Array.from({ length: segments + 1 }, (_, index) => cylinderPoint(
    radius,
    THREE.MathUtils.lerp(angleStart, angleEnd, index / segments),
    y,
  ));
}

function makeSlotOutline({
  axialHalfAngle,
  outerRadius,
  slotEndAngle,
  slotHalfHeight,
  slotY,
  topY,
}) {
  const radius = outerRadius + 0.007;
  const slotBottomY = slotY - slotHalfHeight;
  const slotTopY = slotY + slotHalfHeight;
  const points = [
    cylinderPoint(radius, -axialHalfAngle, topY),
    cylinderPoint(radius, -axialHalfAngle, slotBottomY),
    ...sampledArc(
      radius,
      -axialHalfAngle,
      slotEndAngle,
      slotBottomY,
      48,
    ).slice(1),
    cylinderPoint(radius, slotEndAngle, slotTopY),
    ...sampledArc(
      radius,
      slotEndAngle,
      axialHalfAngle,
      slotTopY,
      40,
    ).slice(1),
    cylinderPoint(radius, axialHalfAngle, topY),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const outline = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: PALETTE.ink }),
  );
  outline.userData.points = points;
  outline.userData.role = 'visible-boundary-of-open-L-shaped-slot';
  outline.userData.noShadow = true;
  return outline;
}

function makeCutawayLathe({
  cutawayHalfAngle,
  material,
  profile,
  role,
  sectionMaterial,
  segments = 112,
}) {
  const group = new THREE.Group();
  group.userData.cutawayHalfAngle = cutawayHalfAngle;
  group.userData.role = role;
  const shell = new THREE.Mesh(
    new THREE.LatheGeometry(
      profile,
      segments,
      cutawayHalfAngle,
      FULL_TURN - 2 * cutawayHalfAngle,
    ),
    material,
  );
  shell.userData.physicalSectionCutaway = true;
  shell.userData.role = `${role}-shell`;
  group.add(shell);

  const sectionShape = new THREE.Shape();
  profile.forEach((point, index) => {
    if (index === 0) sectionShape.moveTo(point.x, point.y);
    else sectionShape.lineTo(point.x, point.y);
  });
  sectionShape.closePath();
  const sectionGeometry = new THREE.ShapeGeometry(sectionShape, 28);
  const sectionFaces = [
    cutawayHalfAngle,
    FULL_TURN - cutawayHalfAngle,
  ].map((angle, index) => {
    const face = new THREE.Mesh(sectionGeometry, sectionMaterial);
    face.rotation.y = angle - Math.PI / 2;
    face.userData.role = `${role}-section-face-${index + 1}`;
    group.add(face);
    return face;
  });
  return { group, sectionFaces, shell };
}

function sphericalBandProfile({
  innerRadius,
  maximumY,
  minimumY,
  outerRadius,
  samples = 48,
}) {
  const radiusAtY = (radius, y) => Math.sqrt(Math.max(0, radius ** 2 - y ** 2));
  const points = [
    new THREE.Vector2(radiusAtY(innerRadius, minimumY), minimumY),
    new THREE.Vector2(radiusAtY(outerRadius, minimumY), minimumY),
  ];
  for (let index = 1; index <= samples; index += 1) {
    const y = THREE.MathUtils.lerp(minimumY, maximumY, index / samples);
    points.push(new THREE.Vector2(radiusAtY(outerRadius, y), y));
  }
  points.push(new THREE.Vector2(radiusAtY(innerRadius, maximumY), maximumY));
  for (let index = samples - 1; index >= 0; index -= 1) {
    const y = THREE.MathUtils.lerp(minimumY, maximumY, index / samples);
    points.push(new THREE.Vector2(radiusAtY(innerRadius, y), y));
  }
  return points;
}

function hollowBallProfile({
  boreRadius,
  bottomPortOuterRadius,
  outerRadius,
  topTubeOuterRadius,
  samples = 72,
}) {
  const minimumY = -Math.sqrt(
    outerRadius ** 2 - bottomPortOuterRadius ** 2,
  );
  const maximumY = Math.sqrt(
    outerRadius ** 2 - topTubeOuterRadius ** 2,
  );
  const points = [
    new THREE.Vector2(boreRadius, minimumY),
    new THREE.Vector2(bottomPortOuterRadius, minimumY),
  ];
  for (let index = 1; index <= samples; index += 1) {
    const y = THREE.MathUtils.lerp(minimumY, maximumY, index / samples);
    points.push(new THREE.Vector2(
      Math.sqrt(Math.max(0, outerRadius ** 2 - y ** 2)),
      y,
    ));
  }
  points.push(
    new THREE.Vector2(boreRadius, maximumY),
    new THREE.Vector2(boreRadius, minimumY),
  );
  return { maximumY, minimumY, points };
}

function annularTubeProfile({
  innerRadius,
  maximumY,
  minimumY,
  outerRadius,
}) {
  return [
    new THREE.Vector2(innerRadius, minimumY),
    new THREE.Vector2(outerRadius, minimumY),
    new THREE.Vector2(outerRadius, maximumY),
    new THREE.Vector2(innerRadius, maximumY),
    new THREE.Vector2(innerRadius, minimumY),
  ];
}

function bayonetJoint(movement) {
  const root = new THREE.Group();
  const cyclePeriod = 8;
  const socketOuterRadius = 1;
  const socketInnerRadius = 0.84;
  const socketBottomY = -1.6;
  const socketTopY = 1.15;
  const socketBottomThickness = 0.14;
  const maleRadius = 0.77;
  const maleLength = 3.8;
  const lockedMaleCenterY = 1.33;
  const slotY = 0.36;
  const slotHalfHeight = 0.18;
  const axialHalfAngle = 0.2;
  const pinShaftRadius = 0.12;
  const pinEnvelopeRadius = 0.15;
  const pinCenterlineRadius = socketOuterRadius;
  const pinAngularHalfWidth = Math.asin(
    pinEnvelopeRadius / pinCenterlineRadius,
  );
  const slotEndAngle = 1.11;
  const lockedAngle = slotEndAngle - pinAngularHalfWidth;
  const pinLocalY = slotY - lockedMaleCenterY;
  const maleBottomAtLocked = lockedMaleCenterY - maleLength / 2;
  const withdrawnClearance = 0.23;
  const withdrawalDistance = socketTopY + withdrawnClearance
    - maleBottomAtLocked;
  const boreRadialClearance = socketInnerRadius - maleRadius;

  const socket = new THREE.Group();
  socket.userData.axis = Y_AXIS.clone();
  socket.userData.fixed = true;
  socket.userData.role = 'fixed-cylindrical-socket-B';
  const socketMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.62,
    side: THREE.DoubleSide,
  });
  const socketWall = new THREE.Mesh(
    makeBayonetSocketGeometry({
      axialHalfAngle,
      bottomY: socketBottomY,
      innerRadius: socketInnerRadius,
      outerRadius: socketOuterRadius,
      slotEndAngle,
      slotHalfHeight,
      slotY,
      topY: socketTopY,
    }),
    socketMaterial,
  );
  socketWall.userData.role = 'socket-wall-with-one-open-L-shaped-slot';
  const socketBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(
      socketOuterRadius,
      socketOuterRadius,
      socketBottomThickness,
      72,
    ),
    socketMaterial,
  );
  socketBottom.position.y = socketBottomY + socketBottomThickness / 2;
  socketBottom.userData.role = 'closed-bottom-of-socket-B';
  const slotOutline = makeSlotOutline({
    axialHalfAngle,
    outerRadius: socketOuterRadius,
    slotEndAngle,
    slotHalfHeight,
    slotY,
    topY: socketTopY,
  });
  socket.add(socketWall, socketBottom, slotOutline);
  root.add(socket);

  const maleAssembly = new THREE.Group();
  maleAssembly.userData.axis = Y_AXIS.clone();
  maleAssembly.userData.role =
    'turnable-and-withdrawable-male-part-A-with-one-radial-pin';
  const maleMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.58,
  });
  const pinMaterial = matte(PALETTE.brass, {
    metalness: 0.2,
    roughness: 0.5,
  });
  const maleBody = new THREE.Mesh(
    new THREE.CylinderGeometry(maleRadius, maleRadius, maleLength, 72),
    maleMaterial,
  );
  maleBody.userData.role = 'male-cylindrical-plug-A';
  maleAssembly.add(maleBody);
  const maleIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.84, 0.03),
    matte(PALETTE.white, { roughness: 0.48 }),
  );
  maleIndex.position.set(0, 0.78, maleRadius + 0.018);
  maleIndex.userData.role = 'visible-rotation-index-on-part-A';
  maleAssembly.add(maleIndex);

  const pinInnerRadius = maleRadius - 0.04;
  const pinOuterRadius = socketOuterRadius + 0.17;
  const pinLength = pinOuterRadius - pinInnerRadius;
  const lockingPin = new THREE.Mesh(
    new THREE.CylinderGeometry(
      pinShaftRadius,
      pinShaftRadius,
      pinLength,
      28,
    ),
    pinMaterial,
  );
  lockingPin.rotation.x = Math.PI / 2;
  lockingPin.position.set(
    0,
    pinLocalY,
    (pinInnerRadius + pinOuterRadius) / 2,
  );
  lockingPin.userData.role = 'single-radial-bayonet-locking-pin';
  const pinHeadThickness = 0.065;
  const pinHead = new THREE.Mesh(
    new THREE.CylinderGeometry(
      pinEnvelopeRadius,
      pinEnvelopeRadius,
      pinHeadThickness,
      32,
    ),
    pinMaterial,
  );
  pinHead.rotation.x = Math.PI / 2;
  pinHead.position.set(
    0,
    pinLocalY,
    pinOuterRadius + pinHeadThickness / 2,
  );
  pinHead.userData.role = 'round-visible-head-of-bayonet-pin';
  maleAssembly.add(lockingPin, pinHead);
  root.add(maleAssembly);

  const timeline = [
    { end: 0.08, stage: 'locked-dwell', start: 0 },
    { end: 0.24, stage: 'turn-to-release', start: 0.08 },
    { end: 0.48, stage: 'withdraw-through-axial-leg', start: 0.24 },
    { end: 0.52, stage: 'withdrawn-dwell', start: 0.48 },
    { end: 0.76, stage: 'insert-through-axial-leg', start: 0.52 },
    { end: 0.92, stage: 'turn-to-lock', start: 0.76 },
    { end: 1, stage: 'locked-dwell', start: 0.92 },
  ];

  const slotClearancesAtPose = (maleRotation, axialOffset) => {
    const pinY = slotY + axialOffset;
    const horizontalVerticalClearance = slotHalfHeight
      - pinEnvelopeRadius - Math.abs(pinY - slotY);
    const axialAngularClearance = axialHalfAngle
      - pinAngularHalfWidth - Math.abs(maleRotation);
    const lockedEndClearance = lockedAngle - maleRotation;
    const mouthClearance = socketTopY + pinEnvelopeRadius - pinY;
    const pinClearOfSocket = pinY - pinEnvelopeRadius >= socketTopY - 1e-12;
    const inCircumferentialLeg = (
      maleRotation >= -1e-12
      && maleRotation <= lockedAngle + 1e-12
      && horizontalVerticalClearance >= -1e-12
    );
    const inAxialLeg = (
      pinY >= slotY - 1e-12
      && pinY <= socketTopY + pinEnvelopeRadius + 1e-12
      && axialAngularClearance >= -1e-12
    );
    return {
      axialAngularClearance,
      boreRadialClearance,
      horizontalVerticalClearance,
      inAxialLeg,
      inCircumferentialLeg,
      lockedEndClearance,
      mouthClearance,
      pinClearOfSocket,
      valid: pinClearOfSocket || inAxialLeg || inCircumferentialLeg,
    };
  };

  const stateAtCycleCoordinate = (coordinate) => {
    const phase = modulo(coordinate, 1);
    let stage;
    let maleRotation;
    let maleAngularSpeed = 0;
    let maleAngularAcceleration = 0;
    let axialOffset;
    let axialSpeed = 0;
    let axialAcceleration = 0;
    const motion = ({ end, from, start, to }) => {
      const duration = (end - start) * cyclePeriod;
      const progress = (phase - start) / (end - start);
      const distance = to - from;
      return {
        acceleration: distance
          * smootherStepSecondDerivative(progress) / duration ** 2,
        position: from + distance * smootherStep01(progress),
        speed: distance * smootherStepFirstDerivative(progress) / duration,
      };
    };

    if (phase < 0.08) {
      stage = 'locked-dwell';
      maleRotation = lockedAngle;
      axialOffset = 0;
    } else if (phase < 0.24) {
      stage = 'turn-to-release';
      const rotation = motion({
        end: 0.24,
        from: lockedAngle,
        start: 0.08,
        to: 0,
      });
      maleRotation = rotation.position;
      maleAngularSpeed = rotation.speed;
      maleAngularAcceleration = rotation.acceleration;
      axialOffset = 0;
    } else if (phase < 0.48) {
      stage = 'withdraw-through-axial-leg';
      const translation = motion({
        end: 0.48,
        from: 0,
        start: 0.24,
        to: withdrawalDistance,
      });
      maleRotation = 0;
      axialOffset = translation.position;
      axialSpeed = translation.speed;
      axialAcceleration = translation.acceleration;
    } else if (phase < 0.52) {
      stage = 'withdrawn-dwell';
      maleRotation = 0;
      axialOffset = withdrawalDistance;
    } else if (phase < 0.76) {
      stage = 'insert-through-axial-leg';
      const translation = motion({
        end: 0.76,
        from: withdrawalDistance,
        start: 0.52,
        to: 0,
      });
      maleRotation = 0;
      axialOffset = translation.position;
      axialSpeed = translation.speed;
      axialAcceleration = translation.acceleration;
    } else if (phase < 0.92) {
      stage = 'turn-to-lock';
      const rotation = motion({
        end: 0.92,
        from: 0,
        start: 0.76,
        to: lockedAngle,
      });
      maleRotation = rotation.position;
      maleAngularSpeed = rotation.speed;
      maleAngularAcceleration = rotation.acceleration;
      axialOffset = 0;
    } else {
      stage = 'locked-dwell';
      maleRotation = lockedAngle;
      axialOffset = 0;
    }

    const maleCenterY = lockedMaleCenterY + axialOffset;
    const pinCenterY = slotY + axialOffset;
    const maleBottomY = maleCenterY - maleLength / 2;
    const pinPosition = cylinderPoint(
      pinCenterlineRadius,
      maleRotation,
      pinCenterY,
    );
    const clearances = slotClearancesAtPose(maleRotation, axialOffset);
    const maleClearOfSocket = maleBottomY >= socketTopY - 1e-12;
    const locked = axialOffset <= 1e-12
      && Math.abs(maleRotation - lockedAngle) <= 1e-12;
    let constraintBranch = 'clear-of-socket';
    if (!clearances.pinClearOfSocket) {
      constraintBranch = Math.abs(axialOffset) <= 1e-12
        ? 'circumferential-leg'
        : 'axial-leg';
    }
    return {
      axialAcceleration,
      axialOffset,
      axialSpeed,
      clearances,
      constraintBranch,
      cycleCoordinate: phase,
      engaged: !maleClearOfSocket,
      locked,
      maleAngularAcceleration,
      maleAngularSpeed,
      maleBottomY,
      maleCenterY,
      maleClearOfSocket,
      maleRotation,
      pinCenterY,
      pinClearOfSocket: clearances.pinClearOfSocket,
      pinPosition,
      sourcePose: phase < 1e-12,
      stage,
      validConstraint: clearances.valid,
    };
  };
  const stateAtTime = (time) => stateAtCycleCoordinate(time / cyclePeriod);

  root.userData.archetype =
    'axial-bayonet-joint-with-radial-pin-and-l-shaped-socket-slot';
  root.userData.blocks = {
    lockingPin,
    maleAssembly,
    maleBody,
    maleIndex,
    pinHead,
    slotOutline,
    socket,
    socketBottom,
    socketWall,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.28, -1.68, -1.28),
    new THREE.Vector3(1.28, 5.24, 1.28),
  );
  root.userData.geometry = {
    axialHalfAngle,
    boreRadialClearance,
    cyclePeriod,
    lockedAngle,
    lockedMaleCenterY,
    maleBottomAtLocked,
    maleLength,
    maleRadius,
    pinAngularHalfWidth,
    pinCenterlineRadius,
    pinEnvelopeRadius,
    pinLocalY,
    pinShaftRadius,
    slotBottomY: slotY - slotHalfHeight,
    slotEndAngle,
    slotHalfHeight,
    slotTopY: slotY + slotHalfHeight,
    slotY,
    socketBottomThickness,
    socketBottomY,
    socketInnerRadius,
    socketOuterRadius,
    socketTopY,
    withdrawnClearance,
    withdrawalDistance,
  };
  root.userData.mechanism =
    'turn-part-A-until-its-single-radial-pin-reaches-the-axial-leg-of-the-L-slot-in-socket-B-then-withdraw-it';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 245 page marks its animation unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate245: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one cylindrical male part A with one radial stud inside one fixed socket B whose wall has one open L-shaped slot',
      measurementUncertaintyPixels: 3,
      officialAnimationAvailable: false,
      rasterAxialSlotCorner: new THREE.Vector2(228, 306),
      rasterHiddenMaleBottomY: 370,
      rasterLockingPinCenter: new THREE.Vector2(261, 310),
      rasterMaleBounds: {
        bottom: 370,
        left: 197,
        right: 317,
        top: 92,
      },
      rasterSlotEnd: new THREE.Vector2(287, 306),
      rasterSocketBounds: {
        bottom: 452,
        left: 184,
        right: 319,
        top: 253,
      },
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 63,
      edition: 21,
      illustrationPage: 62,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.slotClearancesAtPose = slotClearancesAtPose;
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = timeline;
  root.userData.transmission = {
    connectionType: 'bayonet-joint',
    constrainedPair: 'cylindrical-pair-with-radial-pin-in-L-slot',
    insertionRequiresReleasedAngle: true,
    pinCount: 1,
    releaseRotation: lockedAngle,
    rotationAllowedOnlyAtLockingDepth: true,
    slotCount: 1,
    translationAllowedOnlyAtReleasedAngle: true,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    maleAssembly.position.y = state.maleCenterY;
    maleAssembly.rotation.y = state.maleRotation;
    const pinWithinSocketHeight = state.pinCenterY - pinEnvelopeRadius
      < socketTopY;
    root.userData.contacts = {
      lockingEndToPin: {
        active: state.locked,
        angularClearance: state.clearances.lockedEndClearance,
        role: 'closed-end-of-circumferential-slot-prevents-unlocking-rotation',
      },
      malePlugToSocketBore: {
        active: state.engaged,
        radialClearance: boreRadialClearance,
        sliding: Math.abs(state.axialSpeed) > 1e-12,
      },
      pinInAxialLeg: {
        active: state.constraintBranch === 'axial-leg',
        angularClearance: state.clearances.axialAngularClearance,
        contained: state.clearances.inAxialLeg,
        sliding: Math.abs(state.axialSpeed) > 1e-12,
      },
      pinInCircumferentialLeg: {
        active: state.constraintBranch === 'circumferential-leg',
        contained: state.clearances.inCircumferentialLeg,
        sliding: Math.abs(state.maleAngularSpeed) > 1e-12,
        verticalClearance: state.clearances.horizontalVerticalClearance,
      },
      pinToSocketWall: {
        interference: pinWithinSocketHeight && !state.validConstraint,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  slotOutline.castShadow = false;
  slotOutline.receiveShadow = false;
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(5.2, 3.8, 9.2),
  };
}

function ballAndSocketPipeJoint(movement) {
  const root = new THREE.Group();

  // Brown's plate is a longitudinal section through a hollow male ball and
  // the bolted, two-piece female socket. The spherical center is the only
  // positional constraint; the upper tube may change direction while the
  // lower tube and both socket halves remain fixed.
  const cyclePeriod = 10;
  const cutawayHalfAngle = 0.72;
  const ballOuterRadius = 1.52;
  const ballBoreRadius = 0.48;
  const bottomPortOuterRadius = 0.56;
  const upperTubeOuterRadius = 0.72;
  const upperTubeMaximumY = 4.45;
  const socketInnerRadius = 1.56;
  const socketOuterRadius = 1.88;
  const socketRadialClearance = socketInnerRadius - ballOuterRadius;
  const socketSplitHalfGap = 0.035;
  const upperSocketMaximumY = 1.14;
  const lowerThroatRadius = 0.86;
  const lowerTubeOuterRadius = 1.12;
  const lowerTubeMaximumY = -Math.sqrt(
    socketInnerRadius ** 2 - lowerThroatRadius ** 2,
  );
  const lowerTubeMinimumY = -4.4;
  const maximumTilt = 0.22;
  const upperMouthRadius = Math.sqrt(
    socketInnerRadius ** 2 - upperSocketMaximumY ** 2,
  );
  const socketCaptureOverlap = ballOuterRadius - upperMouthRadius;

  const maleMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.56,
    side: THREE.DoubleSide,
  });
  const maleSectionMaterial = matte(0xb94330, {
    metalness: 0.1,
    roughness: 0.66,
    side: THREE.DoubleSide,
  });
  const upperSocketMaterial = matte(PALETTE.driven, {
    metalness: 0.17,
    roughness: 0.54,
    side: THREE.DoubleSide,
  });
  const lowerSocketMaterial = matte(0x284e64, {
    metalness: 0.17,
    roughness: 0.58,
    side: THREE.DoubleSide,
  });
  const socketSectionMaterial = matte(0x244250, {
    metalness: 0.1,
    roughness: 0.68,
    side: THREE.DoubleSide,
  });
  const boltMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.42,
  });

  const maleAssembly = new THREE.Group();
  maleAssembly.userData.axis = Y_AXIS.clone();
  maleAssembly.userData.role =
    'articulating-upper-tube-and-hollow-spherical-ball';

  const ballProfile = hollowBallProfile({
    boreRadius: ballBoreRadius,
    bottomPortOuterRadius,
    outerRadius: ballOuterRadius,
    topTubeOuterRadius: upperTubeOuterRadius,
  });
  const maleBallParts = makeCutawayLathe({
    cutawayHalfAngle: cutawayHalfAngle - 0.08,
    material: maleMaterial,
    profile: ballProfile.points,
    role: 'hollow-male-ball-with-through-bore',
    sectionMaterial: maleSectionMaterial,
    segments: 128,
  });
  const maleBall = maleBallParts.group;
  maleBall.userData.boreRadius = ballBoreRadius;
  maleBall.userData.outerRadius = ballOuterRadius;

  const upperTubeParts = makeCutawayLathe({
    cutawayHalfAngle: cutawayHalfAngle - 0.08,
    material: maleMaterial,
    profile: annularTubeProfile({
      innerRadius: ballBoreRadius,
      maximumY: upperTubeMaximumY,
      minimumY: ballProfile.maximumY,
      outerRadius: upperTubeOuterRadius,
    }),
    role: 'hollow-upper-tube-rigid-with-male-ball',
    sectionMaterial: maleSectionMaterial,
  });
  const upperTube = upperTubeParts.group;

  const maleBoreLiner = new THREE.Mesh(
    new THREE.CylinderGeometry(
      ballBoreRadius - 0.006,
      ballBoreRadius - 0.006,
      upperTubeMaximumY - ballProfile.minimumY,
      72,
      1,
      true,
    ),
    matte(0x6d2c24, {
      metalness: 0.08,
      roughness: 0.76,
      side: THREE.BackSide,
    }),
  );
  maleBoreLiner.position.y =
    (upperTubeMaximumY + ballProfile.minimumY) / 2;
  maleBoreLiner.userData.role =
    'visible-inner-wall-of-continuous-male-bore';

  const orientationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 1.12, 0.14),
    matte(PALETTE.white, { roughness: 0.48 }),
  );
  orientationIndex.position.set(
    upperTubeOuterRadius + 0.025,
    2.72,
    0,
  );
  orientationIndex.userData.role =
    'white-rigid-orientation-index-on-upper-tube';
  maleAssembly.add(maleBall, upperTube, maleBoreLiner, orientationIndex);
  root.add(maleAssembly);

  const fixedSocketAssembly = new THREE.Group();
  fixedSocketAssembly.userData.fixed = true;
  fixedSocketAssembly.userData.role =
    'fixed-two-piece-bolted-socket-and-lower-tube';

  const upperSocketParts = makeCutawayLathe({
    cutawayHalfAngle,
    material: upperSocketMaterial,
    profile: sphericalBandProfile({
      innerRadius: socketInnerRadius,
      maximumY: upperSocketMaximumY,
      minimumY: socketSplitHalfGap,
      outerRadius: socketOuterRadius,
    }),
    role: 'upper-bolted-retaining-half-of-socket',
    sectionMaterial: socketSectionMaterial,
    segments: 128,
  });
  const upperSocketHalf = upperSocketParts.group;

  const lowerSocketParts = makeCutawayLathe({
    cutawayHalfAngle,
    material: lowerSocketMaterial,
    profile: sphericalBandProfile({
      innerRadius: socketInnerRadius,
      maximumY: -socketSplitHalfGap,
      minimumY: lowerTubeMaximumY,
      outerRadius: socketOuterRadius,
    }),
    role: 'lower-load-bearing-half-of-socket',
    sectionMaterial: socketSectionMaterial,
    segments: 128,
  });
  const lowerSocketHalf = lowerSocketParts.group;

  const lowerTubeParts = makeCutawayLathe({
    cutawayHalfAngle,
    material: lowerSocketMaterial,
    profile: annularTubeProfile({
      innerRadius: lowerThroatRadius,
      maximumY: lowerTubeMaximumY + 0.035,
      minimumY: lowerTubeMinimumY,
      outerRadius: lowerTubeOuterRadius,
    }),
    role: 'fixed-hollow-lower-tube',
    sectionMaterial: socketSectionMaterial,
  });
  const lowerTube = lowerTubeParts.group;
  const lowerBoreLiner = new THREE.Mesh(
    new THREE.CylinderGeometry(
      lowerThroatRadius - 0.006,
      lowerThroatRadius - 0.006,
      lowerTubeMaximumY + 0.035 - lowerTubeMinimumY,
      72,
      1,
      true,
    ),
    matte(0x17303b, {
      metalness: 0.08,
      roughness: 0.78,
      side: THREE.BackSide,
    }),
  );
  lowerBoreLiner.position.y =
    (lowerTubeMaximumY + 0.035 + lowerTubeMinimumY) / 2;
  lowerBoreLiner.userData.role =
    'visible-inner-wall-of-fixed-lower-bore';

  const upperClampEars = [];
  const lowerClampEars = [];
  const clampBolts = [];
  for (const side of [-1, 1]) {
    const earX = side * (socketOuterRadius + 0.34);
    const upperEar = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.24, 0.74),
      upperSocketMaterial,
    );
    upperEar.position.set(earX, 0.14, 0);
    upperEar.userData.role =
      `upper-socket-clamp-ear-${side < 0 ? 'left' : 'right'}`;
    upperClampEars.push(upperEar);

    const lowerEar = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.24, 0.74),
      lowerSocketMaterial,
    );
    lowerEar.position.set(earX, -0.14, 0);
    lowerEar.userData.role =
      `lower-socket-clamp-ear-${side < 0 ? 'left' : 'right'}`;
    lowerClampEars.push(lowerEar);

    const bolt = new THREE.Group();
    bolt.userData.fixed = true;
    bolt.userData.role =
      `socket-half-clamp-bolt-${side < 0 ? 'left' : 'right'}`;
    const shank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 0.82, 24),
      boltMaterial,
    );
    shank.userData.role = 'vertical-clamp-bolt-shank';
    const upperNut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.15, 6),
      boltMaterial,
    );
    upperNut.position.y = 0.43;
    upperNut.userData.role = 'upper-hexagonal-clamp-nut';
    const lowerNut = upperNut.clone();
    lowerNut.position.y = -0.43;
    lowerNut.userData.role = 'lower-hexagonal-clamp-nut';
    bolt.position.x = earX;
    bolt.add(shank, upperNut, lowerNut);
    clampBolts.push(bolt);
  }
  fixedSocketAssembly.add(
    upperSocketHalf,
    lowerSocketHalf,
    lowerTube,
    lowerBoreLiner,
    ...upperClampEars,
    ...lowerClampEars,
    ...clampBolts,
  );
  root.add(fixedSocketAssembly);

  const timeline = {
    centeredDwellEnd: 1,
    cycleClosure: cyclePeriod,
    orbitEnd: 7.5,
    orbitStart: 2.5,
    returnedToCenter: 9,
  };

  const clearancesAtTilt = (tiltAngle) => {
    const cosine = Math.cos(tiltAngle);
    const tangent = Math.tan(tiltAngle);
    const upperNeckEnvelopeAtMouth =
      upperSocketMaximumY * tangent + upperTubeOuterRadius / cosine;
    const lowerBoreEnvelopeAtThroat =
      Math.abs(lowerTubeMaximumY) * tangent + ballBoreRadius / cosine;
    return {
      ballCaptured: socketCaptureOverlap > 0,
      lowerBoreClearance:
        lowerThroatRadius - lowerBoreEnvelopeAtThroat,
      lowerBoreEnvelopeAtThroat,
      socketRadialClearance,
      upperNeckClearance: upperMouthRadius - upperNeckEnvelopeAtMouth,
      upperNeckEnvelopeAtMouth,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = modulo(time, cyclePeriod);
    let stage;
    let tilt;
    let azimuth;
    if (cycleTime < timeline.centeredDwellEnd) {
      stage = 'centered-source-dwell';
      tilt = { acceleration: 0, value: 0, velocity: 0 };
      azimuth = { acceleration: 0, value: 0, velocity: 0 };
    } else if (cycleTime < timeline.orbitStart) {
      stage = 'tilting-upper-tube';
      tilt = transitionState(
        cycleTime,
        timeline.centeredDwellEnd,
        timeline.orbitStart,
        0,
        maximumTilt,
      );
      azimuth = { acceleration: 0, value: 0, velocity: 0 };
    } else if (cycleTime < timeline.orbitEnd) {
      stage = 'circumducting-at-maximum-tilt';
      tilt = { acceleration: 0, value: maximumTilt, velocity: 0 };
      azimuth = transitionState(
        cycleTime,
        timeline.orbitStart,
        timeline.orbitEnd,
        0,
        FULL_TURN,
      );
    } else if (cycleTime < timeline.returnedToCenter) {
      stage = 'returning-upper-tube-to-center';
      tilt = transitionState(
        cycleTime,
        timeline.orbitEnd,
        timeline.returnedToCenter,
        maximumTilt,
        0,
      );
      azimuth = { acceleration: 0, value: 0, velocity: 0 };
    } else {
      stage = 'centered-source-dwell';
      tilt = { acceleration: 0, value: 0, velocity: 0 };
      azimuth = { acceleration: 0, value: 0, velocity: 0 };
    }

    const beta = tilt.value;
    const betaVelocity = tilt.velocity;
    const betaAcceleration = tilt.acceleration;
    const phi = azimuth.value;
    const phiVelocity = azimuth.velocity;
    const phiAcceleration = azimuth.acceleration;
    const sineBeta = Math.sin(beta);
    const cosineBeta = Math.cos(beta);
    const sinePhi = Math.sin(phi);
    const cosinePhi = Math.cos(phi);
    const tubeAxis = new THREE.Vector3(
      sineBeta * cosinePhi,
      cosineBeta,
      sineBeta * sinePhi,
    );
    const tubeAxisVelocity = new THREE.Vector3(
      cosineBeta * betaVelocity * cosinePhi
        - sineBeta * sinePhi * phiVelocity,
      -sineBeta * betaVelocity,
      cosineBeta * betaVelocity * sinePhi
        + sineBeta * cosinePhi * phiVelocity,
    );
    const commonBetaTerm =
      -sineBeta * betaVelocity ** 2
      + cosineBeta * betaAcceleration;
    const tubeAxisAcceleration = new THREE.Vector3(
      commonBetaTerm * cosinePhi
        - 2 * cosineBeta * betaVelocity * sinePhi * phiVelocity
        - sineBeta * cosinePhi * phiVelocity ** 2
        - sineBeta * sinePhi * phiAcceleration,
      -cosineBeta * betaVelocity ** 2
        - sineBeta * betaAcceleration,
      commonBetaTerm * sinePhi
        + 2 * cosineBeta * betaVelocity * cosinePhi * phiVelocity
        - sineBeta * sinePhi * phiVelocity ** 2
        + sineBeta * cosinePhi * phiAcceleration,
    );
    const orientation = new THREE.Quaternion().setFromUnitVectors(
      Y_AXIS,
      tubeAxis,
    );
    const clearances = clearancesAtTilt(beta);
    const upperTip = tubeAxis.clone().multiplyScalar(upperTubeMaximumY);
    const upperTipVelocity = tubeAxisVelocity.clone()
      .multiplyScalar(upperTubeMaximumY);
    const upperTipAcceleration = tubeAxisAcceleration.clone()
      .multiplyScalar(upperTubeMaximumY);
    return {
      azimuth: modulo(phi, FULL_TURN),
      azimuthAcceleration: phiAcceleration,
      azimuthUnwrapped: phi,
      azimuthVelocity: phiVelocity,
      ballCenter: new THREE.Vector3(0, 0, 0),
      clearances,
      cycleCoordinate: cycleTime / cyclePeriod,
      cycleTime,
      fluidPassageOpen:
        clearances.upperNeckClearance >= -1e-12
        && clearances.lowerBoreClearance >= -1e-12,
      orientation,
      sourcePose: beta <= 1e-12,
      stage,
      tiltAcceleration: betaAcceleration,
      tiltAngle: beta,
      tiltVelocity: betaVelocity,
      tubeAxis,
      tubeAxisAcceleration,
      tubeAxisVelocity,
      upperTip,
      upperTipAcceleration,
      upperTipVelocity,
    };
  };

  root.userData.archetype =
    'hollow-ball-and-socket-pipe-joint-with-two-piece-bolted-retainer-and-continuous-bore';
  root.userData.blocks = {
    clampBolts,
    fixedSocketAssembly,
    lowerClampEars,
    lowerSocketHalf,
    lowerSocketSectionFaces: lowerSocketParts.sectionFaces,
    lowerBoreLiner,
    lowerTube,
    lowerTubeSectionFaces: lowerTubeParts.sectionFaces,
    maleAssembly,
    maleBall,
    maleBallSectionFaces: maleBallParts.sectionFaces,
    maleBoreLiner,
    orientationIndex,
    upperClampEars,
    upperSocketHalf,
    upperSocketSectionFaces: upperSocketParts.sectionFaces,
    upperTube,
    upperTubeSectionFaces: upperTubeParts.sectionFaces,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.75, -4.45, -2.2),
    new THREE.Vector3(2.75, 4.5, 2.2),
  );
  root.userData.clearancesAtTilt = clearancesAtTilt;
  root.userData.geometry = {
    ballBoreRadius,
    ballBottomPortY: ballProfile.minimumY,
    ballOuterRadius,
    ballTopTubeJunctionY: ballProfile.maximumY,
    bottomPortOuterRadius,
    clampBoltCount: clampBolts.length,
    cutawayHalfAngle,
    cyclePeriod,
    lowerThroatRadius,
    lowerTubeMaximumY,
    lowerTubeMinimumY,
    lowerTubeOuterRadius,
    maximumTilt,
    socketCaptureOverlap,
    socketInnerRadius,
    socketOuterRadius,
    socketRadialClearance,
    socketRetainerPieceCount: 2,
    socketSplitHalfGap,
    upperMouthRadius,
    upperSocketMaximumY,
    upperTubeMaximumY,
    upperTubeOuterRadius,
  };
  root.userData.mechanism =
    'hollow-ball-on-upper-tube-pivots-about-one-fixed-spherical-center-inside-a-two-piece-bolted-socket-on-the-lower-tube';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 249 page marks its animation unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate249: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one hollow ball integral with the upper tube, captured concentrically by two socket halves bolted at opposed side ears and opening into the fixed lower tube',
      measurementUncertaintyPixels: 5,
      officialAnimationAvailable: false,
      rasterBallBounds: {
        bottom: 419,
        left: 161,
        right: 390,
        top: 191,
      },
      rasterClampBounds: {
        bottom: 321,
        left: 80,
        right: 460,
        top: 244,
      },
      rasterLowerTubeBounds: {
        bottom: 501,
        left: 225,
        right: 327,
        top: 405,
      },
      rasterSocketEnvelopeBounds: {
        bottom: 450,
        left: 130,
        right: 424,
        top: 190,
      },
      rasterUpperTubeBounds: {
        bottom: 197,
        left: 236,
        right: 324,
        top: 77,
      },
      view:
        'longitudinal-section-through-bore-spherical-center-and-two-opposed-clamp-bolts',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 63,
      edition: 21,
      illustrationPage: 62,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = timeline;
  root.userData.transmission = {
    clampBoltCount: 2,
    fluidPassageContinuous: true,
    jointType: 'ball-and-socket-pipe-joint',
    rotationalDegreesOfFreedom: 3,
    socketRetainerPieces: 2,
    sphericalCenterFixed: true,
    translationalDegreesOfFreedom: 0,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    maleAssembly.quaternion.copy(state.orientation);
    root.userData.contacts = {
      ballToSocket: {
        concentricCenters: true,
        radialClearance: socketRadialClearance,
        sliding: state.tubeAxisVelocity.lengthSq() > 1e-18,
      },
      continuousFluidBore: {
        lowerThroatClearance: state.clearances.lowerBoreClearance,
        minimumRadialClearance: Math.min(
          state.clearances.lowerBoreClearance,
          state.clearances.upperNeckClearance,
        ),
        open: state.fluidPassageOpen,
        upperMouthClearance: state.clearances.upperNeckClearance,
      },
      socketHalves: {
        boltCount: clampBolts.length,
        clamped: true,
        splitGap: 2 * socketSplitHalfGap,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(5.7, 3.3, 8.8),
  };
}

export function createAuthoredJointMovement(movement) {
  let result;
  switch (movement.id) {
    case 245: result = bayonetJoint(movement); break;
    case 249: result = ballAndSocketPipeJoint(movement); break;
    default: return null;
  }
  result.root.userData.fidelity = 'authored';
  return result;
}
