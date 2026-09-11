import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function cross2(a, b) {
  return a.x * b.y - a.y * b.x;
}

function rigidVectorRates(vector, derivative, secondDerivative) {
  const lengthSquared = vector.lengthSq();
  const crossVelocity = cross2(vector, derivative);
  return {
    angle: Math.atan2(vector.y, vector.x),
    angularDerivative: crossVelocity / lengthSquared,
    angularSecondDerivative: (
      cross2(vector, secondDerivative) * lengthSquared
        - 2 * vector.dot(derivative) * crossVelocity
    ) / lengthSquared ** 2,
  };
}

function cylinderAlongZ(radius, depth, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function beamBetween3D(start, end, width, depth, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    delta.clone().normalize(),
  );
  return beam;
}

function centeredExtrusion(shape, depth, bevel = 0.018) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevel > 0,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 72,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function crossedSlotHole(halfLength, halfWidth) {
  // Clockwise boundary of the union of two perpendicular rectangles.
  const hole = new THREE.Path();
  const points = [
    [-halfLength, halfWidth],
    [-halfWidth, halfWidth],
    [-halfWidth, halfLength],
    [halfWidth, halfLength],
    [halfWidth, halfWidth],
    [halfLength, halfWidth],
    [halfLength, -halfWidth],
    [halfWidth, -halfWidth],
    [halfWidth, -halfLength],
    [-halfWidth, -halfLength],
    [-halfWidth, -halfWidth],
    [-halfLength, -halfWidth],
  ];
  points.forEach(([x, y], index) => {
    if (index === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  });
  hole.closePath();
  return hole;
}

function crossedSlotDiskGeometry(radius, halfLength, halfWidth, depth) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, FULL_TURN, false);
  shape.holes.push(crossedSlotHole(halfLength, halfWidth));
  return centeredExtrusion(shape, depth, 0.014);
}

function makeSlotSlide({
  blockDepth,
  blockLength,
  blockWidth,
  frontFaceZ,
  jointPlaneZ,
  material,
  role,
  slidePlaneZ,
  whiteMaterial,
}) {
  const assembly = new THREE.Group();
  assembly.userData.role = role;
  assembly.userData.slotAxis = new THREE.Vector3(1, 0, 0);

  const block = new THREE.Mesh(
    new THREE.BoxGeometry(blockLength, blockWidth, blockDepth),
    material,
  );
  block.userData.role = `${role}-rectangular-block`;

  const pivotPin = cylinderAlongZ(
    blockWidth * 0.25,
    frontFaceZ + blockDepth * 0.72,
    whiteMaterial,
    30,
  );
  pivotPin.position.z = frontFaceZ / 2;
  pivotPin.userData.role = `${role}-pivot-pin-to-rod-B`;

  const pivotRing = new THREE.Mesh(
    new THREE.TorusGeometry(
      blockWidth * 0.29,
      blockWidth * 0.065,
      8,
      30,
    ),
    whiteMaterial,
  );
  pivotRing.position.z = frontFaceZ + 0.026;
  pivotRing.userData.role = `${role}-front-pivot-index`;

  // The working block remains inside the disk slot. This thin face shares
  // its pose and is carried forward along the same pivot pin so the slot
  // alignment remains visible in front of the opaque connecting rod.
  const frontInspectionFace = new THREE.Mesh(
    new THREE.BoxGeometry(
      blockLength * 1.08,
      blockWidth * 0.88,
      0.028,
    ),
    material,
  );
  frontInspectionFace.position.z = frontFaceZ;
  frontInspectionFace.userData.role =
    `${role}-front-inspection-face-rigid-with-slide`;

  const pivotAnchor = new THREE.Object3D();
  pivotAnchor.position.z = jointPlaneZ - slidePlaneZ;
  pivotAnchor.userData.role = `${role}-analytic-pivot-center`;
  assembly.add(
    block,
    pivotPin,
    frontInspectionFace,
    pivotRing,
    pivotAnchor,
  );
  return {
    assembly,
    block,
    frontInspectionFace,
    pivotAnchor,
    pivotPin,
    pivotRing,
  };
}

function snyderDoubleStrokeSlotDrive(movement) {
  const root = new THREE.Group();

  // These are the exact coordinates and equations in the official canvas
  // model. A is centered at O. Its local x and y slots are perpendicular.
  // C1 is 25 units below the constrained reference T on rod B, and C2 is
  // 20 units below T, so the two pivoted slides remain exactly 5 units apart.
  const sourceDiskCenter = new THREE.Vector2(0, 0);
  const sourceDiskRadius = 6.5;
  const sourceSlotHalfLength = 6;
  const sourceSlotWidth = 1.2;
  const sourceSlideLength = 1.5;
  const sourceSlideWidth = 1.2;
  const sourceGuideToPrimaryPivot = 25;
  const sourceGuideToSecondaryPivot = 20;
  const sourcePivotSpacing = sourceGuideToPrimaryPivot
    - sourceGuideToSecondaryPivot;
  const sourceRodHalfWidth = 1;
  const sourceRodBottomY = -26.5;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;
  const sourceView = [-12, -12, 24, 24];
  const officialCanvasWidth = 525;
  const officialCanvasHeight = 525;

  const sourceScale = 0.18;
  const diskCenter = new THREE.Vector3(0, 1.62, 0);
  const diskRadius = sourceDiskRadius * sourceScale;
  const slotHalfLength = sourceSlotHalfLength * sourceScale;
  const slotHalfWidth = sourceSlotWidth * sourceScale / 2;
  const pivotSpacing = sourcePivotSpacing * sourceScale;
  const guideToPrimaryPivot = sourceGuideToPrimaryPivot * sourceScale;
  const guideToSecondaryPivot = sourceGuideToSecondaryPivot * sourceScale;
  const diskDepth = 0.24;
  const slidePlaneZ = 0.18;
  const slideDepth = 0.15;
  const jointPlaneZ = 0.46;
  const rodDepth = 0.16;
  const visualSlideClearance = 0.018;

  const sourceStateAtInputAngle = (unwrappedInputAngle) => {
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const sine = Math.sin(inputAngle);
    const cosine = Math.cos(inputAngle);
    const primarySlotDirection = new THREE.Vector2(cosine, sine);
    const secondarySlotDirection = new THREE.Vector2(-sine, cosine);
    const primarySlotDirectionDerivative = secondarySlotDirection.clone();
    const secondarySlotDirectionDerivative = primarySlotDirection.clone()
      .multiplyScalar(-1);
    const primarySlotDirectionSecondDerivative =
      primarySlotDirection.clone().multiplyScalar(-1);
    const secondarySlotDirectionSecondDerivative =
      secondarySlotDirection.clone().multiplyScalar(-1);

    const radicand = 625 * sine ** 2 + 400 * cosine ** 2;
    const radicandDerivative = 450 * sine * cosine;
    const radicandSecondDerivative = 450
      * (cosine ** 2 - sine ** 2);
    const guideY = 500 / Math.sqrt(radicand);
    const guideYDerivative = -250 * radicandDerivative
      / radicand ** 1.5;
    const guideYSecondDerivative =
      -250 * radicandSecondDerivative / radicand ** 1.5
      + 375 * radicandDerivative ** 2 / radicand ** 2.5;

    // The lower source intersection selected by c_l_int simplifies to
    // lambda=-T_y sin(theta)/4. Interpolating 20/25 of the way back to T
    // gives C2, whose coordinate in the perpendicular slot is
    // mu=T_y cos(theta)/5.
    const primaryCoordinate = -guideY * sine / 4;
    const primaryCoordinateDerivative = -(
      guideYDerivative * sine + guideY * cosine
    ) / 4;
    const primaryCoordinateSecondDerivative = -(
      guideYSecondDerivative * sine
        + 2 * guideYDerivative * cosine
        - guideY * sine
    ) / 4;
    const secondaryCoordinate = guideY * cosine / 5;
    const secondaryCoordinateDerivative = (
      guideYDerivative * cosine - guideY * sine
    ) / 5;
    const secondaryCoordinateSecondDerivative = (
      guideYSecondDerivative * cosine
        - 2 * guideYDerivative * sine
        - guideY * cosine
    ) / 5;

    const guidePointT = new THREE.Vector2(0, guideY);
    const guidePointTDerivative = new THREE.Vector2(
      0,
      guideYDerivative,
    );
    const guidePointTSecondDerivative = new THREE.Vector2(
      0,
      guideYSecondDerivative,
    );
    const primaryPivotC1 = primarySlotDirection.clone()
      .multiplyScalar(primaryCoordinate);
    const primaryPivotC1Derivative = primarySlotDirection.clone()
      .multiplyScalar(primaryCoordinateDerivative)
      .addScaledVector(
        primarySlotDirectionDerivative,
        primaryCoordinate,
      );
    const primaryPivotC1SecondDerivative = primarySlotDirection.clone()
      .multiplyScalar(primaryCoordinateSecondDerivative)
      .addScaledVector(
        primarySlotDirectionDerivative,
        2 * primaryCoordinateDerivative,
      )
      .addScaledVector(
        primarySlotDirectionSecondDerivative,
        primaryCoordinate,
      );
    const secondaryPivotC2 = secondarySlotDirection.clone()
      .multiplyScalar(secondaryCoordinate);
    const secondaryPivotC2Derivative = secondarySlotDirection.clone()
      .multiplyScalar(secondaryCoordinateDerivative)
      .addScaledVector(
        secondarySlotDirectionDerivative,
        secondaryCoordinate,
      );
    const secondaryPivotC2SecondDerivative = secondarySlotDirection.clone()
      .multiplyScalar(secondaryCoordinateSecondDerivative)
      .addScaledVector(
        secondarySlotDirectionDerivative,
        2 * secondaryCoordinateDerivative,
      )
      .addScaledVector(
        secondarySlotDirectionSecondDerivative,
        secondaryCoordinate,
      );

    const rodUpVector = guidePointT.clone().sub(primaryPivotC1);
    const rodUpVectorDerivative = guidePointTDerivative.clone()
      .sub(primaryPivotC1Derivative);
    const rodUpVectorSecondDerivative =
      guidePointTSecondDerivative.clone()
        .sub(primaryPivotC1SecondDerivative);
    const rodRates = rigidVectorRates(
      rodUpVector,
      rodUpVectorDerivative,
      rodUpVectorSecondDerivative,
    );
    const rodAngle = rodRates.angle - Math.PI / 2;

    return {
      guide: {
        pointT: guidePointT,
        pointTDerivative: guidePointTDerivative,
        pointTSecondDerivative: guidePointTSecondDerivative,
      },
      inputAngle,
      primarySlide: {
        coordinate: primaryCoordinate,
        coordinateDerivative: primaryCoordinateDerivative,
        coordinateSecondDerivative: primaryCoordinateSecondDerivative,
        orientation: inputAngle,
        pivotC1: primaryPivotC1,
        pivotC1Derivative: primaryPivotC1Derivative,
        pivotC1SecondDerivative: primaryPivotC1SecondDerivative,
        slotDirection: primarySlotDirection,
      },
      radicand,
      rod: {
        angle: rodAngle,
        angleDerivative: rodRates.angularDerivative,
        angleSecondDerivative: rodRates.angularSecondDerivative,
        upVector: rodUpVector,
        upVectorDerivative: rodUpVectorDerivative,
        upVectorSecondDerivative: rodUpVectorSecondDerivative,
      },
      secondarySlide: {
        coordinate: secondaryCoordinate,
        coordinateDerivative: secondaryCoordinateDerivative,
        coordinateSecondDerivative: secondaryCoordinateSecondDerivative,
        orientation: inputAngle + Math.PI / 2,
        pivotC2: secondaryPivotC2,
        pivotC2Derivative: secondaryPivotC2Derivative,
        pivotC2SecondDerivative: secondaryPivotC2SecondDerivative,
        slotDirection: secondarySlotDirection,
      },
      unwrappedInputAngle,
    };
  };

  const sourcePointToModel = (point, z = jointPlaneZ) =>
    new THREE.Vector3(
      diskCenter.x + point.x * sourceScale,
      diskCenter.y + point.y * sourceScale,
      z,
    );
  const sourceVectorToModel = (vector) => new THREE.Vector3(
    vector.x * sourceScale,
    vector.y * sourceScale,
    0,
  );

  const stateAtInputAngle = (
    unwrappedInputAngle,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => {
    const source = sourceStateAtInputAngle(unwrappedInputAngle);
    const velocityFromDerivatives = (firstDerivative) =>
      sourceVectorToModel(firstDerivative)
        .multiplyScalar(resolvedInputAngularSpeed);
    const accelerationFromDerivatives = (
      firstDerivative,
      secondDerivative,
    ) => sourceVectorToModel(secondDerivative)
      .multiplyScalar(resolvedInputAngularSpeed ** 2)
      .addScaledVector(
        sourceVectorToModel(firstDerivative),
        inputAngularAcceleration,
      );
    const guidePointT = sourcePointToModel(source.guide.pointT);
    const primaryPivotC1 = sourcePointToModel(
      source.primarySlide.pivotC1,
    );
    const secondaryPivotC2 = sourcePointToModel(
      source.secondarySlide.pivotC2,
    );
    const primarySlotDirection = new THREE.Vector3(
      source.primarySlide.slotDirection.x,
      source.primarySlide.slotDirection.y,
      0,
    );
    const secondarySlotDirection = new THREE.Vector3(
      source.secondarySlide.slotDirection.x,
      source.secondarySlide.slotDirection.y,
      0,
    );
    const rodAngularVelocity = source.rod.angleDerivative
      * resolvedInputAngularSpeed;
    const rodAngularAcceleration =
      source.rod.angleSecondDerivative * resolvedInputAngularSpeed ** 2
      + source.rod.angleDerivative * inputAngularAcceleration;

    return {
      disk: {
        angle: source.inputAngle,
        angularAcceleration: inputAngularAcceleration,
        angularVelocity: resolvedInputAngularSpeed,
        axis: Z_AXIS.clone(),
      },
      guide: {
        acceleration: accelerationFromDerivatives(
          source.guide.pointTDerivative,
          source.guide.pointTSecondDerivative,
        ),
        pointT: guidePointT,
        sourceY: source.guide.pointT.y,
        velocity: velocityFromDerivatives(
          source.guide.pointTDerivative,
        ),
      },
      inputAngle: source.inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      primarySlide: {
        acceleration: accelerationFromDerivatives(
          source.primarySlide.pivotC1Derivative,
          source.primarySlide.pivotC1SecondDerivative,
        ),
        coordinate: source.primarySlide.coordinate * sourceScale,
        coordinateAcceleration: (
          source.primarySlide.coordinateSecondDerivative
            * resolvedInputAngularSpeed ** 2
          + source.primarySlide.coordinateDerivative
            * inputAngularAcceleration
        ) * sourceScale,
        coordinateVelocity: source.primarySlide.coordinateDerivative
          * resolvedInputAngularSpeed * sourceScale,
        orientation: source.primarySlide.orientation,
        pivotC1: primaryPivotC1,
        slotCenter: primaryPivotC1.clone().setZ(slidePlaneZ),
        slotDirection: primarySlotDirection,
        velocity: velocityFromDerivatives(
          source.primarySlide.pivotC1Derivative,
        ),
      },
      rod: {
        angle: source.rod.angle,
        angularAcceleration: rodAngularAcceleration,
        angularVelocity: rodAngularVelocity,
        guideToPrimaryLength: guidePointT.distanceTo(primaryPivotC1),
        guideToPrimaryLengthError:
          guidePointT.distanceTo(primaryPivotC1)
            - guideToPrimaryPivot,
        pivotSpacing: primaryPivotC1.distanceTo(secondaryPivotC2),
        pivotSpacingError:
          primaryPivotC1.distanceTo(secondaryPivotC2) - pivotSpacing,
      },
      secondarySlide: {
        acceleration: accelerationFromDerivatives(
          source.secondarySlide.pivotC2Derivative,
          source.secondarySlide.pivotC2SecondDerivative,
        ),
        coordinate: source.secondarySlide.coordinate * sourceScale,
        coordinateAcceleration: (
          source.secondarySlide.coordinateSecondDerivative
            * resolvedInputAngularSpeed ** 2
          + source.secondarySlide.coordinateDerivative
            * inputAngularAcceleration
        ) * sourceScale,
        coordinateVelocity: source.secondarySlide.coordinateDerivative
          * resolvedInputAngularSpeed * sourceScale,
        orientation: source.secondarySlide.orientation,
        pivotC2: secondaryPivotC2,
        slotCenter: secondaryPivotC2.clone().setZ(slidePlaneZ),
        slotDirection: secondarySlotDirection,
        velocity: velocityFromDerivatives(
          source.secondarySlide.pivotC2Derivative,
        ),
      },
      source,
      unwrappedInputAngle,
    };
  };

  const stateAtCyclePosition = (cyclePosition) => stateAtInputAngle(
    cyclePosition * FULL_TURN,
  );
  const stateAtTime = (time) => {
    const state = stateAtInputAngle(inputAngularSpeed * time);
    state.phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    state.time = time;
    return state;
  };
  const canonicalTimes = {
    sourceStart: 0,
    eighthTurn: cyclePeriod / 8,
    firstLowerExtreme: cyclePeriod / 4,
    repeatedUpperExtreme: cyclePeriod / 2,
    secondLowerExtreme: cyclePeriod * 3 / 4,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.16,
    roughness: 0.64,
  });
  const edgeMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const diskMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.57,
    side: THREE.DoubleSide,
  });
  const rodMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.55,
  });
  const slideMaterial = matte(0x3e9368, {
    metalness: 0.13,
    roughness: 0.53,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.17,
    roughness: 0.52,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'fixed-frame-shaft-bearings-and-explicit-external-vertical-guide';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(3.45, 0.20, 1.55),
    frameMaterial,
  );
  base.position.set(0, 0.10, -0.23);
  base.userData.role = 'fixed-base';
  const baseEdge = new THREE.Mesh(
    new THREE.BoxGeometry(3.65, 0.055, 1.68),
    edgeMaterial,
  );
  baseEdge.position.set(0, 0.225, -0.23);
  baseEdge.userData.role = 'fixed-base-edge';

  const rearPlaneZ = -0.42;
  const framePosts = [-1, 1].map((side) => {
    const post = beamBetween3D(
      new THREE.Vector3(side * 1.30, 0.25, rearPlaneZ),
      new THREE.Vector3(side * 0.62, diskCenter.y, rearPlaneZ),
      0.17,
      0.22,
      frameMaterial,
    );
    post.userData.role = `fixed-shaft-pedestal-leg-${side < 0 ? 1 : 2}`;
    fixedFrame.add(post);
    return post;
  });
  const bearingBridge = new THREE.Mesh(
    new THREE.BoxGeometry(1.58, 0.22, 0.24),
    frameMaterial,
  );
  bearingBridge.position.set(0, diskCenter.y, rearPlaneZ);
  bearingBridge.userData.role = 'fixed-rear-shaft-bearing-bridge';
  const shaftBearing = cylinderAlongZ(0.25, 0.32, edgeMaterial, 42);
  shaftBearing.position.set(
    diskCenter.x,
    diskCenter.y,
    rearPlaneZ + 0.08,
  );
  shaftBearing.userData.role = 'fixed-central-shaft-bearing-O';

  const guideMinimumY = diskCenter.y + 19 * sourceScale;
  const guideMaximumY = diskCenter.y + 26 * sourceScale;
  const guideCenterY = (guideMinimumY + guideMaximumY) / 2;
  const guideHalfGap = 0.245;
  const guideRailThickness = 0.105;
  const guideRails = [-1, 1].map((side) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(
        guideRailThickness,
        guideMaximumY - guideMinimumY,
        0.20,
      ),
      frameMaterial,
    );
    rail.position.set(
      side * (guideHalfGap + guideRailThickness / 2),
      guideCenterY,
      0.03,
    );
    rail.userData.role =
      `fixed-external-guide-rail-${side < 0 ? 'left' : 'right'}`;
    fixedFrame.add(rail);
    return rail;
  });
  const guideTopBridge = new THREE.Mesh(
    new THREE.BoxGeometry(
      2 * (guideHalfGap + guideRailThickness),
      0.11,
      0.20,
    ),
    frameMaterial,
  );
  guideTopBridge.position.set(0, guideMaximumY + 0.055, 0.03);
  guideTopBridge.userData.role = 'fixed-external-guide-top-bridge';
  const guideSupports = [-1, 1].map((side) => {
    const support = beamBetween3D(
      new THREE.Vector3(side * 0.69, diskCenter.y + 0.82, rearPlaneZ),
      new THREE.Vector3(
        side * (guideHalfGap + guideRailThickness / 2),
        guideMinimumY,
        0.03,
      ),
      0.10,
      0.14,
      frameMaterial,
    );
    support.userData.role =
      `fixed-external-guide-support-${side < 0 ? 1 : 2}`;
    fixedFrame.add(support);
    return support;
  });
  fixedFrame.add(
    base,
    baseEdge,
    bearingBridge,
    shaftBearing,
    guideTopBridge,
  );
  root.add(fixedFrame);

  const diskAssembly = new THREE.Group();
  diskAssembly.position.copy(diskCenter);
  diskAssembly.userData.axis = Z_AXIS.clone();
  diskAssembly.userData.role =
    'rotating-disk-A-with-two-perpendicular-through-slots-a-a';
  const slottedDisk = new THREE.Mesh(
    crossedSlotDiskGeometry(
      diskRadius,
      slotHalfLength,
      slotHalfWidth,
      diskDepth,
    ),
    diskMaterial,
  );
  slottedDisk.userData.actualThroughSlots = true;
  slottedDisk.userData.role =
    'disk-A-actual-crossed-through-slot-body';
  const diskRim = new THREE.Mesh(
    new THREE.TorusGeometry(diskRadius, 0.038, 9, 72),
    edgeMaterial,
  );
  diskRim.position.z = diskDepth / 2 + 0.012;
  diskRim.userData.role = 'disk-A-front-rim';

  const slotFloors = [0, Math.PI / 2].map((angle, index) => {
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(
        slotHalfLength * 2,
        slotHalfWidth * 2,
        0.025,
      ),
      edgeMaterial,
    );
    floor.rotation.z = angle;
    floor.position.z = -diskDepth / 2 + 0.016;
    floor.userData.role =
      `dark-recess-behind-through-slot-${index + 1}`;
    diskAssembly.add(floor);
    return floor;
  });
  const slotEdges = [];
  for (const angle of [0, Math.PI / 2]) {
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(
          slotHalfLength * 2,
          0.024,
          diskDepth + 0.025,
        ),
        edgeMaterial,
      );
      edge.position.y = side * slotHalfWidth;
      edge.position.z = 0.004;
      edge.rotation.z = angle;
      edge.userData.role = 'cross-slot-machined-edge';
      diskAssembly.add(edge);
      slotEdges.push(edge);
    }
  }
  const inputShaft = cylinderAlongZ(0.15, 1.02, edgeMaterial, 36);
  inputShaft.position.z = -0.46;
  inputShaft.userData.role = 'central-input-shaft-behind-crossed-slots';
  const diskIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.075, 0.035),
    whiteMaterial,
  );
  diskIndex.position.set(diskRadius * 0.73, 0, diskDepth / 2 + 0.045);
  diskIndex.rotation.z = Math.PI / 9;
  diskIndex.userData.role = 'disk-A-white-rotation-index';
  diskAssembly.add(
    slottedDisk,
    diskRim,
    inputShaft,
    diskIndex,
  );
  root.add(diskAssembly);

  const rodAssembly = new THREE.Group();
  rodAssembly.position.z = jointPlaneZ;
  rodAssembly.userData.role =
    'connecting-rod-B-carrying-two-pivot-centers-five-units-apart';
  const rodHalfWidth = sourceRodHalfWidth * sourceScale;
  const rodTopY = 0.20;
  const rodBottomY = sourceRodBottomY * sourceScale;
  const rodBodyHeight = rodTopY - (rodBottomY + rodHalfWidth);
  const rodBody = new THREE.Mesh(
    new THREE.BoxGeometry(
      rodHalfWidth * 2,
      rodBodyHeight,
      rodDepth,
    ),
    rodMaterial,
  );
  rodBody.position.y = (rodTopY + rodBottomY + rodHalfWidth) / 2;
  rodBody.userData.role = 'rigid-blue-rod-B-body';
  const rodLowerCap = cylinderAlongZ(
    rodHalfWidth,
    rodDepth,
    rodMaterial,
    38,
  );
  rodLowerCap.position.y = rodBottomY + rodHalfWidth;
  rodLowerCap.userData.role = 'rod-B-rounded-lower-end';
  const rodCenterIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 1.18, 0.022),
    whiteMaterial,
  );
  rodCenterIndex.position.set(
    0,
    -22.5 * sourceScale,
    rodDepth / 2 + 0.018,
  );
  rodCenterIndex.userData.role = 'rod-B-white-rocking-index';
  const guidePointAnchor = new THREE.Object3D();
  guidePointAnchor.userData.role = 'rod-B-analytic-guide-point-T';
  const primaryRodAnchor = new THREE.Object3D();
  primaryRodAnchor.position.y = -guideToPrimaryPivot;
  primaryRodAnchor.userData.role = 'rod-B-primary-pivot-anchor-C1';
  const secondaryRodAnchor = new THREE.Object3D();
  secondaryRodAnchor.position.y = -guideToSecondaryPivot;
  secondaryRodAnchor.userData.role = 'rod-B-secondary-pivot-anchor-C2';
  const guideRoller = cylinderAlongZ(0.13, 0.23, accentMaterial, 34);
  guideRoller.position.z = -jointPlaneZ + 0.12;
  guideRoller.userData.role =
    'rod-B-circular-pin-sliding-in-explicit-vertical-guide';
  const guideRollerIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.16, 0.025),
    whiteMaterial,
  );
  guideRollerIndex.position.set(0, 0, -jointPlaneZ + 0.245);
  guideRollerIndex.userData.role = 'guide-pin-white-center-index';
  rodAssembly.add(
    rodBody,
    rodLowerCap,
    rodCenterIndex,
    guidePointAnchor,
    primaryRodAnchor,
    secondaryRodAnchor,
    guideRoller,
    guideRollerIndex,
  );
  root.add(rodAssembly);

  const primarySlide = makeSlotSlide({
    blockDepth: slideDepth,
    blockLength: sourceSlideLength * sourceScale,
    blockWidth: sourceSlideWidth * sourceScale - visualSlideClearance,
    frontFaceZ:
      jointPlaneZ - slidePlaneZ + rodDepth / 2 + 0.025,
    jointPlaneZ,
    material: slideMaterial,
    role: 'primary-pivoted-slide-c-in-disk-local-x-slot',
    slidePlaneZ,
    whiteMaterial,
  });
  const secondarySlide = makeSlotSlide({
    blockDepth: slideDepth,
    blockLength: sourceSlideLength * sourceScale,
    blockWidth: sourceSlideWidth * sourceScale - visualSlideClearance,
    frontFaceZ:
      jointPlaneZ - slidePlaneZ + rodDepth / 2 + 0.025,
    jointPlaneZ,
    material: slideMaterial,
    role: 'secondary-pivoted-slide-c-in-perpendicular-disk-local-y-slot',
    slidePlaneZ,
    whiteMaterial,
  });
  root.add(primarySlide.assembly, secondarySlide.assembly);

  const contacts = {
    guidePointTInFixedVerticalSlot: {
      axis: new THREE.Vector3(0, 1, 0),
      fixedMember: fixedFrame,
      movingMember: rodAssembly,
      point: new THREE.Vector3(),
      type:
        'pin-in-fixed-vertical-slot-beyond-source-crop-allows-translation-and-rocking',
    },
    primarySlideAtRodC1: {
      members: [primarySlide.assembly, rodAssembly],
      point: new THREE.Vector3(),
      type: 'revolute-pivot-primary-slide-c-to-rigid-rod-B-at-C1',
    },
    primarySlideInDiskSlot: {
      fixedToInputMember: diskAssembly,
      movingMember: primarySlide.assembly,
      point: new THREE.Vector3(),
      slotAxisLocal: new THREE.Vector3(1, 0, 0),
      type: 'prismatic-primary-slide-c-in-rotating-disk-local-x-slot-a',
    },
    secondarySlideAtRodC2: {
      members: [secondarySlide.assembly, rodAssembly],
      point: new THREE.Vector3(),
      type: 'revolute-pivot-secondary-slide-c-to-rigid-rod-B-at-C2',
    },
    secondarySlideInDiskSlot: {
      fixedToInputMember: diskAssembly,
      movingMember: secondarySlide.assembly,
      point: new THREE.Vector3(),
      slotAxisLocal: new THREE.Vector3(0, 1, 0),
      type:
        'prismatic-secondary-slide-c-in-rotating-disk-local-y-slot-a-perpendicular-to-primary',
    },
    shaftAtO: {
      fixedMember: fixedFrame,
      movingMember: diskAssembly,
      point: diskCenter.clone(),
      type: 'revolute-central-input-shaft-of-disk-A-about-Z',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    diskAssembly.rotation.z = state.disk.angle;
    diskAssembly.userData.angularSpeed = state.disk.angularVelocity;
    diskAssembly.userData.angularAcceleration =
      state.disk.angularAcceleration;
    rodAssembly.position.set(
      state.guide.pointT.x,
      state.guide.pointT.y,
      jointPlaneZ,
    );
    rodAssembly.rotation.z = state.rod.angle;
    rodAssembly.userData.angularSpeed = state.rod.angularVelocity;
    rodAssembly.userData.angularAcceleration =
      state.rod.angularAcceleration;
    rodAssembly.userData.velocity = state.guide.velocity.clone();
    rodAssembly.userData.acceleration = state.guide.acceleration.clone();

    primarySlide.assembly.position.copy(state.primarySlide.slotCenter);
    primarySlide.assembly.rotation.z = state.primarySlide.orientation;
    primarySlide.assembly.userData.slotCoordinate =
      state.primarySlide.coordinate;
    secondarySlide.assembly.position.copy(state.secondarySlide.slotCenter);
    secondarySlide.assembly.rotation.z = state.secondarySlide.orientation;
    secondarySlide.assembly.userData.slotCoordinate =
      state.secondarySlide.coordinate;

    contacts.guidePointTInFixedVerticalSlot.point
      .copy(state.guide.pointT);
    contacts.primarySlideAtRodC1.point
      .copy(state.primarySlide.pivotC1);
    contacts.primarySlideInDiskSlot.point
      .copy(state.primarySlide.slotCenter);
    contacts.secondarySlideAtRodC2.point
      .copy(state.secondarySlide.pivotC2);
    contacts.secondarySlideInDiskSlot.point
      .copy(state.secondarySlide.slotCenter);
    root.userData.kinematics = state;
  };

  const modelPointToOfficialAnimationRaster = (point) => {
    const sourceX = (point.x - diskCenter.x) / sourceScale;
    const sourceY = (point.y - diskCenter.y) / sourceScale;
    return new THREE.Vector2(
      (sourceX - sourceView[0])
        * officialCanvasWidth / sourceView[2],
      officialCanvasHeight - (sourceY - sourceView[1])
        * officialCanvasHeight / sourceView[3],
    );
  };

  const geometry = {
    cyclePeriod,
    diskCenter,
    diskDepth,
    diskRadius,
    guideMaximumY,
    guideMinimumY,
    guideToPrimaryPivot,
    guideToSecondaryPivot,
    inputAngularSpeed,
    jointPlaneZ,
    pivotSpacing,
    rodDepth,
    slideDepth,
    slidePlaneZ,
    slotHalfLength,
    slotHalfWidth,
    sourceScale,
    visualSlideClearance,
  };

  root.userData.archetype =
    'snyder-double-stroke-perpendicular-slot-disk';
  root.userData.blocks = {
    base,
    baseEdge,
    bearingBridge,
    diskAssembly,
    diskIndex,
    diskRim,
    fixedFrame,
    framePosts,
    guidePointAnchor,
    guideRails,
    guideRoller,
    guideRollerIndex,
    guideSupports,
    guideTopBridge,
    inputShaft,
    primaryRodAnchor,
    primarySlide,
    rodAssembly,
    rodBody,
    rodCenterIndex,
    rodLowerCap,
    secondaryRodAnchor,
    secondarySlide,
    shaftBearing,
    slottedDisk,
    slotEdges,
    slotFloors,
  };
  root.userData.cameraDistanceScale = 1.12;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.82, 0, -1.10),
    new THREE.Vector3(1.82, guideMaximumY + 0.20, 0.78),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one central shaft angle rotating crossed-slot disk A',
    mechanism: 1,
    output:
      'rod B translates twice per shaft revolution while rocking about guide point T',
    requiredClosure:
      'the official solver constrains rod reference T to the fixed vertical centerline x=0',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = 0;
  root.userData.mechanism =
    'central-shaft-O-rotating-disk-A-with-two-perpendicular-through-slots-a-a-primary-and-secondary-pivoted-slides-c-c-five-source-units-apart-on-rigid-rod-B-whose-external-guide-point-T-is-constrained-to-the-fixed-vertical-centerline';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: sourceCyclesPerMinute,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialFunctionChain: [
      'add_rot-crossed-slot-disk-A',
      'add_rot_to-rod-B',
      'c_l_int-primary-slide-C1',
      'add_rot-primary-slide-c',
      'add_rot-secondary-slide-c-quarter-turn-offset',
    ],
    officialGuidePointFunction:
      'T=(0,500/sqrt(625*sin(theta)^2+400*cos(theta)^2))',
    officialGeometry: {
      diskCenter: sourceDiskCenter,
      diskRadius: sourceDiskRadius,
      guideToPrimaryPivot: sourceGuideToPrimaryPivot,
      guideToSecondaryPivot: sourceGuideToSecondaryPivot,
      pivotSpacing: sourcePivotSpacing,
      rodBottomY: sourceRodBottomY,
      rodHalfWidth: sourceRodHalfWidth,
      slideLength: sourceSlideLength,
      slideWidth: sourceSlideWidth,
      slotHalfLength: sourceSlotHalfLength,
      slotWidth: sourceSlotWidth,
      view: sourceView,
    },
    physicalClarification: {
      applied: true,
      changesSourceMotion: false,
      reason:
        'the official add_rot_to solver fixes reference T on x=0 while Brown crops rod B above the disk; the rendered pin-in-vertical-slot makes that required external one-coordinate guide explicit',
    },
    referenceScope:
      'official crossed-slot disk, two pivoted rectangular slides, rigid rod dimensions, exact analytic guide law, source phase, 525-square view, and 15-cpm timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate348: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one central-shaft disk A with perpendicular crossed slots a,a and two pivoted slides c,c carried at fixed spacing on rod B',
      measurementUncertaintyPixels: 15,
      rasterDiskCenter: new THREE.Vector2(273, 324),
      rasterDiskRadius: 150,
      rasterPrimaryPivot: new THREE.Vector2(311, 295),
      rasterSecondaryPivot: new THREE.Vector2(309, 399),
    },
    officialAnimationView: {
      canvasHeight: officialCanvasHeight,
      canvasWidth: officialCanvasWidth,
      minimum: new THREE.Vector2(sourceView[0], sourceView[1]),
      viewHeight: sourceView[3],
      viewWidth: sourceView[2],
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.sourceStateAtInputAngle = sourceStateAtInputAngle;
  root.userData.stateAtCyclePosition = stateAtCyclePosition;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    exactConstruction:
      'C1=lambda(cos(theta),sin(theta)), lambda=-T_y sin(theta)/4; C2=mu(-sin(theta),cos(theta)), mu=T_y cos(theta)/5; |C2-C1|=5',
    guideLaw:
      'T_y=500/sqrt(625*sin(theta)^2+400*cos(theta)^2)',
    input:
      'uniform rotation of central shaft and crossed-slot disk A',
    output:
      'T_y alternates exactly between 25 and 20 source units twice per shaft revolution; rigid rod B simultaneously rocks',
    reciprocationsPerInputRevolution: 2,
    slideOrientationLaw:
      'the primary slide stays parallel to disk local x; the secondary stays at theta+pi/2, exactly perpendicular to it; both pivot freely relative to rod B',
    stroke: 5 * sourceScale,
  };

  update(0);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(4.6, 3.0, 12.5),
    root,
    update,
  };
}

export function createAuthoredDoubleStrokeSlotMovement(movement) {
  if (movement.id !== 348) return null;
  return snyderDoubleStrokeSlotDrive(movement);
}
