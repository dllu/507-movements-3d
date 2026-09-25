import * as THREE from 'three';
import { makeBoredScissorLink } from './bored-scissor-link.js';
import { groundBlock } from './ground-block.js';
import { plate, poly, circle, polygonClipping as clip } from './finite-plate-geometry.js';
import {
  PALETTE,
  makeBeam,
  makeDynamicLink,
  makeShaft,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function finish(root, update, cameraDirection = new THREE.Vector3(7, 4, 9)) {
  root.userData.fidelity = 'authored';
  markShadows(root);
  return { root, update, cameraDirection };
}

function cylinderAlongX(radius, length, material, segments = 28) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongZ(radius, length, material, segments = 28) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function annularShape(innerRadius, outerRadius) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function centeredExtrusion(shape, depth, bevel = 0.008) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 64,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function lazyTongsRectilinearAmplifier() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Measurements are taken from the public-domain engraving.  The drawing
  // idealizes to four equal rhombi: three lie to the left of the fixed center
  // pin and one lies between that pin and the right-hand input rod.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.016;
  const sourceLeftHandlePivot = new THREE.Vector2(66, 259);
  const sourceMovingCenterPivots = [
    new THREE.Vector2(149, 259),
    new THREE.Vector2(234, 259),
  ];
  const sourceFixedCenterPivot = new THREE.Vector2(319, 259);
  const sourceRightHandlePivot = new THREE.Vector2(405, 259);
  const sourceJointXs = [111, 191, 276, 362];
  const sourceTopJointY = 160;
  const sourceBottomJointY = 358;
  const sourcePedestalLeftX = 291;
  const sourcePedestalRightX = 347;
  const sourceBaseY = 415;
  const sourceCellWidth = 85;
  const sourceHalfHeight = 99;
  const sourceHalfLinkLength = Math.hypot(
    sourceCellWidth / 2,
    sourceHalfHeight,
  );
  const sourcePoseAngle = Math.atan2(
    sourceCellWidth / 2,
    sourceHalfHeight,
  );

  const bayCount = 4;
  const crossCount = 3;
  const fixedCenterIndex = 3;
  const leftCellCount = 3;
  const rightCellCount = 1;
  const expectedTravelRatio = leftCellCount / rightCellCount;
  const halfLinkLength = sourceHalfLinkLength * sourceScale;
  const fullLinkLength = halfLinkLength * 2;

  // The reference animation folds the bars between about 7 and 27 degrees
  // from vertical.  Prescribing the right endpoint itself with a cosine law
  // keeps its rectilinear stroke C2-smooth while the linkage supplies every
  // other coordinate from exact pin and bar constraints.
  const minimumScissorAngle = THREE.MathUtils.degToRad(7);
  const maximumScissorAngle = THREE.MathUtils.degToRad(27);
  const minimumCellWidth = 2 * halfLinkLength
    * Math.sin(minimumScissorAngle);
  const maximumCellWidth = 2 * halfLinkLength
    * Math.sin(maximumScissorAngle);
  const sourceCellWidthWorld = sourceCellWidth * sourceScale;
  const cellWidthMidpoint = (minimumCellWidth + maximumCellWidth) / 2;
  const cellWidthAmplitude = (maximumCellWidth - minimumCellWidth) / 2;
  const inputStroke = maximumCellWidth - minimumCellWidth;
  const outputStroke = expectedTravelRatio * inputStroke;
  const cyclePeriod = 8;
  const cycleAngularFrequency = fullTurn / cyclePeriod;
  const sourcePhaseAngle = Math.acos(THREE.MathUtils.clamp(
    (cellWidthMidpoint - sourceCellWidthWorld) / cellWidthAmplitude,
    -1,
    1,
  ));
  const sourceCyclePhase = sourcePhaseAngle / fullTurn;

  const frontLinkPlaneZ = 0.24;
  const rearLinkPlaneZ = -0.24;
  const linkThickness = 0.18;
  const linkDepth = 0.20;
  const pinSpan = 0.88;
  const pinRadius = 0.105;
  const jointRingMajorRadius = 0.135;
  const jointRingTubeRadius = 0.035;
  const jointRingOuterRadius = jointRingMajorRadius + jointRingTubeRadius;
  const fixedBearingMajorRadius = 0.17;
  const fixedBearingTubeRadius = 0.042;
  const fixedBearingOuterRadius = fixedBearingMajorRadius
    + fixedBearingTubeRadius;
  const handleRingMajorRadius = 0.165;
  const handleRingTubeRadius = 0.037;
  const handleRingOuterRadius = handleRingMajorRadius
    + handleRingTubeRadius;
  const minimumCriticalRingClearance = minimumCellWidth
    - fixedBearingOuterRadius - handleRingOuterRadius;
  const pedestalFrontZ = -0.72;
  const pedestalDepth = 0.54;
  const fixedBaseY = -(sourceBaseY - sourceFixedCenterPivot.y)
    * sourceScale;
  const pedestalWidth = (sourcePedestalRightX - sourcePedestalLeftX)
    * sourceScale;

  const linkDefinitions = [
    {
      id: 'left-upper-terminal-half-link',
      kind: 'terminal-half-link',
      family: 'ascending-rear',
      planeZ: rearLinkPlaneZ,
      start: { type: 'center', index: 0 },
      end: { type: 'joint', index: 0, side: 'top' },
      nominalLength: halfLinkLength,
    },
    {
      id: 'left-lower-terminal-half-link',
      kind: 'terminal-half-link',
      family: 'descending-front',
      planeZ: frontLinkPlaneZ,
      start: { type: 'center', index: 0 },
      end: { type: 'joint', index: 0, side: 'bottom' },
      nominalLength: halfLinkLength,
    },
    ...Array.from({ length: crossCount }, (_, crossIndex) => ([
      {
        id: `cross-${crossIndex + 1}-descending-front-link`,
        kind: 'full-cross-link',
        family: 'descending-front',
        planeZ: frontLinkPlaneZ,
        start: { type: 'joint', index: crossIndex, side: 'top' },
        end: { type: 'joint', index: crossIndex + 1, side: 'bottom' },
        centerIndex: crossIndex + 1,
        nominalLength: fullLinkLength,
      },
      {
        id: `cross-${crossIndex + 1}-ascending-rear-link`,
        kind: 'full-cross-link',
        family: 'ascending-rear',
        planeZ: rearLinkPlaneZ,
        start: { type: 'joint', index: crossIndex, side: 'bottom' },
        end: { type: 'joint', index: crossIndex + 1, side: 'top' },
        centerIndex: crossIndex + 1,
        nominalLength: fullLinkLength,
      },
    ])).flat(),
    {
      id: 'right-upper-terminal-half-link',
      kind: 'terminal-half-link',
      family: 'descending-front',
      planeZ: frontLinkPlaneZ,
      start: { type: 'joint', index: 3, side: 'top' },
      end: { type: 'center', index: 4 },
      nominalLength: halfLinkLength,
    },
    {
      id: 'right-lower-terminal-half-link',
      kind: 'terminal-half-link',
      family: 'ascending-rear',
      planeZ: rearLinkPlaneZ,
      start: { type: 'joint', index: 3, side: 'bottom' },
      end: { type: 'center', index: 4 },
      nominalLength: halfLinkLength,
    },
  ];

  const pointState = (
    x,
    y,
    velocityX,
    velocityY,
    accelerationX,
    accelerationY,
  ) => ({
    acceleration: new THREE.Vector3(accelerationX, accelerationY, 0),
    position: new THREE.Vector3(x, y, 0),
    velocity: new THREE.Vector3(velocityX, velocityY, 0),
  });

  const stateAtInputKinematics = ({
    cellWidth,
    cellWidthAcceleration,
    cellWidthVelocity,
    cyclePhase = null,
  }) => {
    const halfCellWidth = cellWidth / 2;
    const halfCellWidthVelocity = cellWidthVelocity / 2;
    const halfCellWidthAcceleration = cellWidthAcceleration / 2;
    const heightRadicand = halfLinkLength ** 2 - halfCellWidth ** 2;
    const halfHeight = Math.sqrt(Math.max(0, heightRadicand));
    const halfHeightVelocity = -halfCellWidth
      * halfCellWidthVelocity / halfHeight;
    const halfHeightAcceleration = -(
      halfCellWidthVelocity ** 2
      + halfCellWidth * halfCellWidthAcceleration
      + halfHeightVelocity ** 2
    ) / halfHeight;
    const scissorAngle = Math.asin(THREE.MathUtils.clamp(
      halfCellWidth / halfLinkLength,
      -1,
      1,
    ));
    const scissorAngularVelocity = halfCellWidthVelocity / halfHeight;
    const scissorAngularAcceleration = (
      halfCellWidthAcceleration * halfHeight
      - halfCellWidthVelocity * halfHeightVelocity
    ) / halfHeight ** 2;

    const centers = Array.from({ length: bayCount + 1 }, (_, index) => {
      const coefficient = index - fixedCenterIndex;
      return pointState(
        coefficient * cellWidth,
        0,
        coefficient * cellWidthVelocity,
        0,
        coefficient * cellWidthAcceleration,
        0,
      );
    });
    const joints = Array.from({ length: bayCount }, (_, index) => {
      const coefficient = index + 0.5 - fixedCenterIndex;
      const x = coefficient * cellWidth;
      const velocityX = coefficient * cellWidthVelocity;
      const accelerationX = coefficient * cellWidthAcceleration;
      return {
        bottom: pointState(
          x,
          -halfHeight,
          velocityX,
          -halfHeightVelocity,
          accelerationX,
          -halfHeightAcceleration,
        ),
        top: pointState(
          x,
          halfHeight,
          velocityX,
          halfHeightVelocity,
          accelerationX,
          halfHeightAcceleration,
        ),
      };
    });
    const resolvePoint = (reference) => (
      reference.type === 'center'
        ? centers[reference.index]
        : joints[reference.index][reference.side]
    );
    const links = linkDefinitions.map((definition) => {
      const start = resolvePoint(definition.start);
      const end = resolvePoint(definition.end);
      const vector = end.position.clone().sub(start.position);
      const relativeVelocity = end.velocity.clone().sub(start.velocity);
      const relativeAcceleration = end.acceleration.clone()
        .sub(start.acceleration);
      const length = vector.length();
      const lengthRate = vector.dot(relativeVelocity) / length;
      const lengthAcceleration = (
        relativeVelocity.lengthSq()
        + vector.dot(relativeAcceleration)
        - lengthRate ** 2
      ) / length;
      const midpoint = start.position.clone().add(end.position)
        .multiplyScalar(0.5);
      const centerError = definition.centerIndex === undefined
        ? 0
        : midpoint.distanceTo(centers[definition.centerIndex].position);
      return {
        ...definition,
        centerError,
        end,
        length,
        lengthAcceleration,
        lengthAccelerationInvariantError: relativeVelocity.lengthSq()
          + vector.dot(relativeAcceleration),
        lengthError: length - definition.nominalLength,
        lengthRate,
        midpoint,
        relativeAcceleration,
        relativeVelocity,
        start,
        vector,
      };
    });

    const maximumLinkLengthError = Math.max(
      ...links.map((link) => Math.abs(link.lengthError)),
    );
    const maximumLinkLengthRateError = Math.max(
      ...links.map((link) => Math.abs(link.lengthRate)),
    );
    const maximumLinkLengthAccelerationError = Math.max(
      ...links.map((link) => Math.abs(link.lengthAcceleration)),
    );
    const maximumLinkInvariantAccelerationError = Math.max(
      ...links.map((link) => Math.abs(
        link.lengthAccelerationInvariantError,
      )),
    );
    const maximumCrossCenterError = Math.max(
      ...links.map((link) => Math.abs(link.centerError)),
    );
    const maximumJointSymmetryPositionError = Math.max(
      ...joints.map(({ bottom, top }) => Math.max(
        Math.abs(top.position.x - bottom.position.x),
        Math.abs(top.position.y + bottom.position.y),
      )),
    );
    const maximumJointSymmetryVelocityError = Math.max(
      ...joints.map(({ bottom, top }) => Math.max(
        Math.abs(top.velocity.x - bottom.velocity.x),
        Math.abs(top.velocity.y + bottom.velocity.y),
      )),
    );
    const maximumJointSymmetryAccelerationError = Math.max(
      ...joints.map(({ bottom, top }) => Math.max(
        Math.abs(top.acceleration.x - bottom.acceleration.x),
        Math.abs(top.acceleration.y + bottom.acceleration.y),
      )),
    );

    const leftOutput = centers[0];
    const fixedPivot = centers[fixedCenterIndex];
    const rightInput = centers[bayCount];
    const inputDisplacement = cellWidth - minimumCellWidth;
    const outputDisplacement = -(
      leftOutput.position.x + leftCellCount * minimumCellWidth
    );
    const pythagoreanError = halfCellWidth ** 2
      + halfHeight ** 2 - halfLinkLength ** 2;
    const endpointPositionAmplificationError = leftOutput.position.x
      + expectedTravelRatio * rightInput.position.x;
    const endpointVelocityAmplificationError = leftOutput.velocity.x
      + expectedTravelRatio * rightInput.velocity.x;
    const endpointAccelerationAmplificationError = leftOutput.acceleration.x
      + expectedTravelRatio * rightInput.acceleration.x;
    const nearReversal = Math.abs(cellWidthVelocity) < 1e-10;
    let stage;
    if (nearReversal) {
      stage = Math.abs(cellWidth - minimumCellWidth)
        <= Math.abs(cellWidth - maximumCellWidth)
        ? 'lazy-tongs-at-collapsed-reversal'
        : 'lazy-tongs-at-extended-reversal';
    } else {
      stage = cellWidthVelocity > 0
        ? 'right-input-opens-tongs-and-amplifies-left-output'
        : 'right-input-closes-tongs-and-returns-left-output';
    }

    return {
      cellWidth,
      cellWidthAcceleration,
      cellWidthVelocity,
      centers,
      cyclePhase,
      endpointAccelerationAmplificationError,
      endpointPositionAmplificationError,
      endpointSeparation: rightInput.position.x - leftOutput.position.x,
      endpointVelocityAmplificationError,
      fixedPivot,
      fixedPivotAccelerationError: fixedPivot.acceleration.length(),
      fixedPivotPositionError: fixedPivot.position.length(),
      fixedPivotVelocityError: fixedPivot.velocity.length(),
      halfCellWidth,
      halfCellWidthAcceleration,
      halfCellWidthVelocity,
      halfHeight,
      halfHeightAcceleration,
      halfHeightVelocity,
      heightRadicand,
      inputDisplacement,
      inputGuideAccelerationError: Math.hypot(
        rightInput.acceleration.y,
        rightInput.acceleration.z,
      ),
      inputGuidePositionError: Math.hypot(
        rightInput.position.y,
        rightInput.position.z,
      ),
      inputGuideVelocityError: Math.hypot(
        rightInput.velocity.y,
        rightInput.velocity.z,
      ),
      joints,
      links,
      maximumCrossCenterError,
      maximumJointSymmetryAccelerationError,
      maximumJointSymmetryPositionError,
      maximumJointSymmetryVelocityError,
      maximumLinkInvariantAccelerationError,
      maximumLinkLengthAccelerationError,
      maximumLinkLengthError,
      maximumLinkLengthRateError,
      outputDisplacement,
      outputGuideAccelerationError: Math.hypot(
        leftOutput.acceleration.y,
        leftOutput.acceleration.z,
      ),
      outputGuidePositionError: Math.hypot(
        leftOutput.position.y,
        leftOutput.position.z,
      ),
      outputGuideVelocityError: Math.hypot(
        leftOutput.velocity.y,
        leftOutput.velocity.z,
      ),
      pythagoreanError,
      rightInput,
      leftOutput,
      scissorAngle,
      scissorAngularAcceleration,
      scissorAngularVelocity,
      stage,
      travelAccelerationRatio: Math.abs(rightInput.acceleration.x) < 1e-14
        ? expectedTravelRatio
        : -leftOutput.acceleration.x / rightInput.acceleration.x,
      travelRatio: expectedTravelRatio,
      travelVelocityRatio: Math.abs(rightInput.velocity.x) < 1e-14
        ? expectedTravelRatio
        : -leftOutput.velocity.x / rightInput.velocity.x,
    };
  };

  const stateAtCyclePhase = (cyclePhase) => {
    const phaseAngle = cyclePhase * fullTurn;
    const cellWidth = cellWidthMidpoint
      - cellWidthAmplitude * Math.cos(phaseAngle);
    const cellWidthVelocity = cellWidthAmplitude
      * cycleAngularFrequency * Math.sin(phaseAngle);
    const cellWidthAcceleration = cellWidthAmplitude
      * cycleAngularFrequency ** 2 * Math.cos(phaseAngle);
    const normalizedCyclePhase = (
      (cyclePhase % 1) + 1
    ) % 1;
    return stateAtInputKinematics({
      cellWidth,
      cellWidthAcceleration,
      cellWidthVelocity,
      cyclePhase: normalizedCyclePhase,
    });
  };
  const stateAtTime = (time) => stateAtCyclePhase(
    sourceCyclePhase + time / cyclePeriod,
  );
  const timeAtCyclePhase = (cyclePhase) => (
    ((cyclePhase - sourceCyclePhase) % 1 + 1) % 1
  ) * cyclePeriod;
  const collapsedTime = timeAtCyclePhase(0);
  const extendedTime = timeAtCyclePhase(0.5);
  const sourceState = stateAtTime(0);
  const collapsedState = stateAtCyclePhase(0);
  const extendedState = stateAtCyclePhase(0.5);

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'single-fixed-pedestal-at-third-scissor-center';
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.72,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.52,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.62,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.64,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.14,
    roughness: 0.54,
  });

  const baseFoot = new THREE.Mesh(
    new THREE.BoxGeometry(2.35, 0.18, 1.12),
    frameMaterial,
  );
  baseFoot.position.set(0, fixedBaseY - 0.04, pedestalFrontZ);
  baseFoot.userData.role = 'fixed-foot-under-lazy-tongs-pedestal';
  const pedestalHeight = -fixedBaseY + 0.22;
  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(
      pedestalWidth,
      pedestalHeight,
      pedestalDepth,
    ),
    frameMaterial,
  );
  pedestal.position.set(
    0,
    fixedBaseY + pedestalHeight / 2,
    pedestalFrontZ,
  );
  pedestal.userData.role = 'fixed-upright-under-third-center-pivot';
  const bearingBlock = new THREE.Mesh(
    new THREE.BoxGeometry(
      pedestalWidth + 0.16,
      0.68,
      pedestalDepth + 0.12,
    ),
    frameMaterial,
  );
  bearingBlock.position.set(0, -0.15, pedestalFrontZ);
  bearingBlock.userData.role = 'fixed-bearing-block-around-third-center-pivot';
  const leftGusset = makeBeam(
    new THREE.Vector3(-0.83, fixedBaseY + 0.10, pedestalFrontZ - 0.02),
    new THREE.Vector3(-0.36, -0.48, pedestalFrontZ - 0.02),
    { thickness: 0.16, depth: 0.30, color: PALETTE.frame },
  );
  leftGusset.userData.role = 'left-fixed-pedestal-gusset';
  const rightGusset = makeBeam(
    new THREE.Vector3(0.83, fixedBaseY + 0.10, pedestalFrontZ - 0.02),
    new THREE.Vector3(0.36, -0.48, pedestalFrontZ - 0.02),
    { thickness: 0.16, depth: 0.30, color: PALETTE.frame },
  );
  rightGusset.userData.role = 'right-fixed-pedestal-gusset';
  const fixedBearingRing = new THREE.Mesh(
    new THREE.TorusGeometry(
      fixedBearingMajorRadius,
      fixedBearingTubeRadius,
      12,
      40,
    ),
    accentMaterial,
  );
  fixedBearingRing.position.set(0, 0, 0.36);
  fixedBearingRing.userData.role = 'fixed-ring-at-third-scissor-center';
  fixedFrame.add(
    baseFoot,
    bearingBlock,
    fixedBearingRing,
    leftGusset,
    pedestal,
    rightGusset,
  );

  const makePinAssembly = (role, ringMaterial = darkMaterial) => {
    const assembly = new THREE.Group();
    assembly.userData.role = role;
    assembly.userData.throughPin = true;
    assembly.userData.axis = Z_AXIS.clone();
    const shaft = cylinderAlongZ(pinRadius, pinSpan, darkMaterial, 28);
    shaft.userData.role = `${role}-shaft`;
    const frontRing = new THREE.Mesh(
      new THREE.TorusGeometry(
        jointRingMajorRadius,
        jointRingTubeRadius,
        10,
        30,
      ),
      ringMaterial,
    );
    frontRing.position.z = pinSpan / 2 + 0.018;
    frontRing.userData.role = `${role}-front-retaining-ring`;
    const frontCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 18, 12),
      whiteMaterial,
    );
    frontCap.position.z = pinSpan / 2 + 0.025;
    frontCap.userData.role = `${role}-white-depth-index`;
    assembly.add(frontCap, frontRing, shaft);
    assembly.userData.blocks = { frontCap, frontRing, shaft };
    return assembly;
  };

  const fixedCenterPin = makePinAssembly(
    'fixed-through-pin-at-third-scissor-center',
    accentMaterial,
  );
  fixedCenterPin.userData.fixed = true;
  fixedFrame.add(fixedCenterPin);
  // Seat the stationary pin in the pedestal instead of ending in the air
  // ahead of it. Only this pin is fixed; the two crossing links turn on it.
  const fixedShaft = fixedCenterPin.userData.blocks.shaft;
  fixedShaft.geometry.dispose();
  fixedShaft.geometry = new THREE.CylinderGeometry(pinRadius, pinRadius, 1.45, 28);
  fixedShaft.position.z = pinSpan / 2 - 1.45 / 2;

  // The engraving has one plain, narrow pedestal, without lateral braces.
  for (const extra of [leftGusset, rightGusset, bearingBlock, fixedBearingRing]) extra.visible = false;
  baseFoot.geometry.dispose();
  baseFoot.geometry = new THREE.BoxGeometry(pedestalWidth, 0.10, pedestalDepth);
  baseFoot.position.y = fixedBaseY + .05;

  const linkageGroup = new THREE.Group();
  linkageGroup.userData.role = 'ten-member-four-bay-lazy-tongs-linkage';
  linkageGroup.userData.planar = true;
  const links = linkDefinitions.map((definition, index) => {
    const link = makeBoredScissorLink({
      color: definition.planeZ > 0 ? 0x174f69 : PALETTE.driven,
      depth: linkDepth,
      length: definition.nominalLength,
      pinRadius,
      centerPin: definition.kind === 'full-cross-link',
      thickness: linkThickness,
    });
    link.userData.lazyTongsLink = true;
    link.userData.linkIndex = index;
    link.userData.linkKind = definition.kind;
    link.userData.family = definition.family;
    link.userData.nominalLength = definition.nominalLength;
    link.userData.planeZ = definition.planeZ;
    link.userData.role = definition.id;
    linkageGroup.add(link);
    return link;
  });
  const movingCrossCenterPins = [1, 2].map((centerIndex) => {
    const pin = makePinAssembly(
      `moving-through-pin-at-scissor-center-${centerIndex}`,
    );
    pin.userData.centerIndex = centerIndex;
    linkageGroup.add(pin);
    return pin;
  });
  const intermediateJointPins = Array.from(
    { length: bayCount },
    (_, index) => {
      const top = makePinAssembly(
        `top-shared-pin-between-scissor-bays-${index}-${index + 1}`,
      );
      const bottom = makePinAssembly(
        `bottom-shared-pin-between-scissor-bays-${index}-${index + 1}`,
      );
      top.userData.jointIndex = index;
      top.userData.jointSide = 'top';
      bottom.userData.jointIndex = index;
      bottom.userData.jointSide = 'bottom';
      linkageGroup.add(bottom, top);
      return { bottom, top };
    },
  );

  const makeHandleAssembly = ({
    color,
    direction,
    role,
  }) => {
    const assembly = new THREE.Group();
    assembly.userData.role = role;
    assembly.userData.translationAxis = X_AXIS.clone();
    const material = color === PALETTE.driver
      ? driverMaterial
      : drivenMaterial;
    const hub = new THREE.Group();
    const rectangle = (a, b, c, d) => poly([[a,b],[c,b],[c,d],[a,d]]);
    const outer = clip.union(poly(circle([0, 0], .27, 64)),
      rectangle(Math.min(0, direction * .62), -.12, Math.max(0, direction * .62), .12));
    const cheek = clip.difference(outer, poly(circle([0, 0], pinRadius + .003, 64)));
    for (const [low, high] of [[-.43, -.37], [.50, .56]]) {
      const mesh = new THREE.Mesh(plate(cheek, low, high), material);
      mesh.userData.role = `${role}-bored-clevis-cheek-${low}`;
      hub.add(mesh);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(.22, .24, .99), material);
    bridge.position.x = direction * .51;
    bridge.position.z = .065;
    bridge.userData.role = `${role}-clevis-bridge`;
    hub.add(bridge);
    hub.userData.role = `${role}-clevis-hub`;
    const hubRing = new THREE.Mesh(
      new THREE.TorusGeometry(
        handleRingMajorRadius,
        handleRingTubeRadius,
        10,
        36,
      ),
      accentMaterial,
    );
    hubRing.position.z = 0.58;
    hubRing.userData.role = `${role}-front-clevis-ring`;
    // Visible rod ends measured from the engraving; the left stub is shorter.
    const rodLength = (direction < 0 ? 57 : 101) * sourceScale;
    const rod = cylinderAlongX(0.105, rodLength - .5, material, 28);
    rod.position.x = direction * (rodLength + .5) / 2;
    rod.userData.role = `${role}-rectilinear-rod`;
    const grip = cylinderAlongX(0.15, 0.34, darkMaterial, 28);
    grip.position.x = direction * (rodLength + 0.10);
    grip.visible = false;
    grip.userData.role = `${role}-outer-grip`;
    const endpointPin = makePinAssembly(
      `${role}-terminal-through-pin`,
      accentMaterial,
    );
    const { shaft, frontRing, frontCap } = endpointPin.userData.blocks;
    shaft.geometry.dispose();
    shaft.geometry = new THREE.CylinderGeometry(pinRadius, pinRadius, 1.05, 28);
    shaft.position.z = .085;
    frontRing.position.z = .628;
    frontCap.position.z = .635;
    const motionIndex = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 18, 12),
      whiteMaterial,
    );
    motionIndex.position.set(direction * 0.72, 0.15, 0.13);
    motionIndex.visible = false;
    motionIndex.userData.role = `${role}-white-rectilinear-motion-index`;
    assembly.add(endpointPin, grip, hub, hubRing, motionIndex, rod);
    assembly.userData.blocks = {
      endpointPin,
      grip,
      hub,
      hubRing,
      motionIndex,
      rod,
    };
    return assembly;
  };

  const leftOutputAssembly = makeHandleAssembly({
    color: PALETTE.driven,
    direction: -1,
    role: 'left-amplified-output',
  });
  leftOutputAssembly.userData.leftHandAmplifiedOutput = true;
  leftOutputAssembly.userData.stroke = outputStroke;
  const rightInputAssembly = makeHandleAssembly({
    color: PALETTE.driver,
    direction: 1,
    role: 'right-short-stroke-input',
  });
  rightInputAssembly.userData.rightHandInput = true;
  rightInputAssembly.userData.stroke = inputStroke;

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(9.45, 4.72, 1.55),
    new THREE.MeshBasicMaterial({
      color: PALETTE.paper,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-1.56, -0.48, -0.08);
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-full-lazy-tongs-motion-envelope';

  root.add(
    cameraEnvelope,
    fixedFrame,
    leftOutputAssembly,
    linkageGroup,
    rightInputAssembly,
  );
  root.userData.cameraDistanceScale = 1.01;
  root.userData.hideGround = true;
  root.userData.supportsRestart = true;
  root.userData.animationTiming = {
    authoredCyclePeriod: cyclePeriod,
    displayCycleDuration: cyclePeriod,
    playbackTimeScale: 1,
  };
  root.userData.mechanism =
    'fixed-center-four-bay-lazy-tongs-three-to-one-rectilinear-amplifier';
  root.userData.blocks = {
    baseFoot,
    bearingBlock,
    cameraEnvelope,
    fixedBearingRing,
    fixedCenterPin,
    fixedFrame,
    intermediateJointPins,
    leftGusset,
    leftOutputAssembly,
    linkageGroup,
    links,
    movingCrossCenterPins,
    pedestal,
    rightGusset,
    rightInputAssembly,
  };
  root.userData.geometry = {
    bayCount,
    cellWidthAmplitude,
    cellWidthMidpoint,
    collapsedTime,
    crossCount,
    cycleAngularFrequency,
    cyclePeriod,
    expectedTravelRatio,
    extendedTime,
    fixedBaseY,
    fixedCenterIndex,
    fixedBearingMajorRadius,
    fixedBearingOuterRadius,
    fixedBearingTubeRadius,
    frontLinkPlaneZ,
    fullLinkLength,
    halfLinkLength,
    handleRingMajorRadius,
    handleRingOuterRadius,
    handleRingTubeRadius,
    inputStroke,
    jointRingMajorRadius,
    jointRingOuterRadius,
    jointRingTubeRadius,
    leftCellCount,
    linkDepth,
    linkThickness,
    maximumCellWidth,
    maximumScissorAngle,
    minimumCellWidth,
    minimumCriticalRingClearance,
    minimumScissorAngle,
    outputStroke,
    pedestalDepth,
    pedestalFrontZ,
    pedestalWidth,
    pinRadius,
    pinSpan,
    rearLinkPlaneZ,
    rightCellCount,
    sourceBaseY,
    sourceBottomJointY,
    sourceCellWidth,
    sourceCellWidthWorld,
    sourceCyclePhase,
    sourceFixedCenterPivot: sourceFixedCenterPivot.clone(),
    sourceHalfHeight,
    sourceHalfLinkLength,
    sourceImageHeight,
    sourceImageWidth,
    sourceJointXs: [...sourceJointXs],
    sourceLeftHandlePivot: sourceLeftHandlePivot.clone(),
    sourceMovingCenterPivots: sourceMovingCenterPivots.map(
      (point) => point.clone(),
    ),
    sourcePedestalLeftX,
    sourcePedestalRightX,
    sourcePoseAngle,
    sourceRightHandlePivot: sourceRightHandlePivot.clone(),
    sourceScale,
    sourceTopJointY,
  };
  root.userData.linkDefinitions = linkDefinitions;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtInputKinematics = stateAtInputKinematics;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeAtCyclePhase = timeAtCyclePhase;
  root.userData.canonicalStates = {
    collapsed: collapsedState,
    extended: extendedState,
    source: sourceState,
  };

  const renderPoint = (point, planeZ) => new THREE.Vector3(
    point.position.x,
    point.position.y,
    planeZ,
  );
  const update = (time) => {
    const state = stateAtTime(time);
    for (const [index, link] of links.entries()) {
      const linkState = state.links[index];
      link.userData.setEndpoints(
        renderPoint(linkState.start, linkState.planeZ),
        renderPoint(linkState.end, linkState.planeZ),
      );
      link.userData.currentLength = linkState.length;
      link.userData.currentLengthError = linkState.lengthError;
    }
    movingCrossCenterPins.forEach((pin, index) => {
      pin.position.copy(state.centers[index + 1].position);
    });
    intermediateJointPins.forEach((pins, index) => {
      pins.top.position.copy(state.joints[index].top.position);
      pins.bottom.position.copy(state.joints[index].bottom.position);
    });
    leftOutputAssembly.position.copy(state.leftOutput.position);
    rightInputAssembly.position.copy(state.rightInput.position);
    root.userData.contacts = {
      endpointAmplification: {
        accelerationError: state.endpointAccelerationAmplificationError,
        positionError: state.endpointPositionAmplificationError,
        ratio: expectedTravelRatio,
        velocityError: state.endpointVelocityAmplificationError,
      },
      fixedCenterPivot: {
        accelerationError: state.fixedPivotAccelerationError,
        positionError: state.fixedPivotPositionError,
        velocityError: state.fixedPivotVelocityError,
      },
      leftOutputGuide: {
        accelerationError: state.outputGuideAccelerationError,
        axis: X_AXIS.clone(),
        positionError: state.outputGuidePositionError,
        velocityError: state.outputGuideVelocityError,
      },
      pinJointClosure: {
        crossCenterError: state.maximumCrossCenterError,
        symmetryAccelerationError:
          state.maximumJointSymmetryAccelerationError,
        symmetryPositionError: state.maximumJointSymmetryPositionError,
        symmetryVelocityError: state.maximumJointSymmetryVelocityError,
      },
      rigidLinks: {
        accelerationError: state.maximumLinkLengthAccelerationError,
        invariantAccelerationError:
          state.maximumLinkInvariantAccelerationError,
        lengthError: state.maximumLinkLengthError,
        rateError: state.maximumLinkLengthRateError,
      },
      rightInputGuide: {
        accelerationError: state.inputGuideAccelerationError,
        axis: X_AXIS.clone(),
        positionError: state.inputGuidePositionError,
        velocityError: state.inputGuideVelocityError,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);

  const model = finish(
    root,
    update,
    new THREE.Vector3(0.1, 0.06, 15),
  );
  model.reset = () => update(0);
  cameraEnvelope.castShadow = false;
  cameraEnvelope.receiveShadow = false;
  for (const assembly of [leftOutputAssembly, rightInputAssembly]) {
    const { motionIndex } = assembly.userData.blocks;
    motionIndex.castShadow = false;
    motionIndex.receiveShadow = false;
  }
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  return model;
}

function rockingBeamTieRodFlywheelMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Exact construction coordinates exposed by the source pose.  The main
  // rod is pinned to the crank at (-4, 0), reaches the sliding standard at
  // (20, 0), and carries its tie pin 15 of its 24 units from the crank.  The
  // second rod then reaches the left end of the 13-unit beam at (11, 20).
  const sourceScale = 0.16;
  const sourceFlywheelCenter = new THREE.Vector2(0, 0);
  const sourceFlywheelOuterRadius = 10;
  const sourceFlywheelInnerRadius = 8.25;
  const sourceFlywheelHubRadius = 1.5;
  const sourceCrankPinLocal = new THREE.Vector2(-4, 0);
  const sourcePrimaryRodLength = 24;
  const sourceTieDistanceFromCrank = 15;
  const sourceTieDistanceFromWrist = 9;
  const sourceSliderWrist = new THREE.Vector2(20, 0);
  const sourceTiePoint = new THREE.Vector2(11, 0);
  const sourceBeamConnectorLength = 20;
  const sourceBeamPivot = new THREE.Vector2(24, 20);
  const sourceBeamEnd = new THREE.Vector2(11, 20);
  const sourceBeamRadius = 13;
  const sourceFloorY = -6;
  const sourceSliderPostDepth = 5;

  const flywheelCenter = new THREE.Vector3(0, 0, 0);
  const flywheelOuterRadius = sourceFlywheelOuterRadius * sourceScale;
  const flywheelInnerRadius = sourceFlywheelInnerRadius * sourceScale;
  const flywheelHubRadius = sourceFlywheelHubRadius * sourceScale;
  const crankPinLocal = new THREE.Vector3(
    sourceCrankPinLocal.x * sourceScale,
    sourceCrankPinLocal.y * sourceScale,
    0,
  );
  const crankRadius = crankPinLocal.length();
  const primaryRodLength = sourcePrimaryRodLength * sourceScale;
  const tieDistanceFromCrank = sourceTieDistanceFromCrank * sourceScale;
  const tieDistanceFromWrist = sourceTieDistanceFromWrist * sourceScale;
  const tieFraction = tieDistanceFromCrank / primaryRodLength;
  const beamConnectorLength = sourceBeamConnectorLength * sourceScale;
  const beamPivot = new THREE.Vector3(
    sourceBeamPivot.x * sourceScale,
    sourceBeamPivot.y * sourceScale,
    0,
  );
  const beamEndReference = new THREE.Vector3(
    sourceBeamEnd.x * sourceScale,
    sourceBeamEnd.y * sourceScale,
    0,
  );
  const beamRadius = sourceBeamRadius * sourceScale;
  const beamReferenceVector = beamEndReference.clone().sub(beamPivot);
  const floorY = sourceFloorY * sourceScale;
  const sliderPostDepth = sourceSliderPostDepth * sourceScale;
  const sliderMinimumX = primaryRodLength - crankRadius;
  const sliderMaximumX = primaryRodLength + crankRadius;
  const sliderStroke = sliderMaximumX - sliderMinimumX;

  const rotationPeriod = 8;
  const crankAngularSpeed = -fullTurn / rotationPeriod;
  const crankAngularAcceleration = 0;
  const flywheelDepth = 0.30;
  const spokeDepth = 0.24;
  const primaryRodPlaneZ = 0.42;
  const primaryRodDepth = 0.18;
  const beamConnectorPlaneZ = 0.66;
  const beamConnectorDepth = 0.17;
  const beamPlaneZ = 0.88;
  const beamDepth = 0.24;
  const sliderStandardCenterZ = -0.43;
  const sliderStandardDepth = 0.48;
  const beamBackColumnCenterZ = -1.08;
  const beamBackColumnDepth = 0.28;

  const cross2D = (first, second) => first.x * second.y
    - first.y * second.x;
  const circleIntersections = (
    firstCenter,
    firstRadius,
    secondCenter,
    secondRadius,
  ) => {
    const centerVector = secondCenter.clone().sub(firstCenter);
    const centerDistance = centerVector.length();
    const along = (
      firstRadius ** 2 - secondRadius ** 2 + centerDistance ** 2
    ) / (2 * centerDistance);
    const perpendicularDistance = Math.sqrt(Math.max(
      0,
      firstRadius ** 2 - along ** 2,
    ));
    const unit = centerVector.divideScalar(centerDistance);
    const perpendicular = new THREE.Vector3(-unit.y, unit.x, 0);
    const base = firstCenter.clone().addScaledVector(unit, along);
    return [
      base.clone().addScaledVector(perpendicular, perpendicularDistance),
      base.clone().addScaledVector(perpendicular, -perpendicularDistance),
    ];
  };
  const closestPoint = (points, reference) => (
    points[0].distanceToSquared(reference)
      <= points[1].distanceToSquared(reference)
      ? points[0]
      : points[1]
  );
  const solveRows = (
    firstRow,
    secondRow,
    firstValue,
    secondValue,
  ) => {
    const determinant = cross2D(firstRow, secondRow);
    return {
      determinant,
      vector: new THREE.Vector3(
        (firstValue * secondRow.y - firstRow.y * secondValue)
          / determinant,
        (firstRow.x * secondValue - firstValue * secondRow.x)
          / determinant,
        0,
      ),
    };
  };
  const rigidLengthKinematics = (
    vector,
    relativeVelocity,
    relativeAcceleration,
    nominalLength,
  ) => {
    const length = vector.length();
    const lengthRate = vector.dot(relativeVelocity) / length;
    const accelerationInvariant = relativeVelocity.lengthSq()
      + vector.dot(relativeAcceleration);
    const lengthAcceleration = (
      accelerationInvariant - lengthRate ** 2
    ) / length;
    return {
      accelerationInvariant,
      length,
      lengthAcceleration,
      lengthError: length - nominalLength,
      lengthRate,
    };
  };

  const stateAtCrankKinematics = ({
    crankAngle,
    inputAngularAcceleration,
    inputAngularSpeed,
    cyclePhase = null,
  }) => {
    const crankVector = crankPinLocal.clone().applyAxisAngle(
      Z_AXIS,
      crankAngle,
    );
    const crankVelocity = new THREE.Vector3().crossVectors(
      Z_AXIS.clone().multiplyScalar(inputAngularSpeed),
      crankVector,
    );
    const crankAcceleration = new THREE.Vector3().crossVectors(
      Z_AXIS.clone().multiplyScalar(inputAngularAcceleration),
      crankVector,
    ).add(new THREE.Vector3().crossVectors(
      Z_AXIS.clone().multiplyScalar(inputAngularSpeed),
      crankVelocity,
    ));
    const crankPin = {
      acceleration: crankAcceleration,
      position: flywheelCenter.clone().add(crankVector),
      velocity: crankVelocity,
    };

    const sliderRadicand = primaryRodLength ** 2
      - crankPin.position.y ** 2;
    const sliderHorizontalProjection = Math.sqrt(Math.max(
      0,
      sliderRadicand,
    ));
    const sliderProjectionVelocity = -crankPin.position.y
      * crankPin.velocity.y / sliderHorizontalProjection;
    const sliderProjectionAcceleration = -(
      crankPin.velocity.y ** 2
      + crankPin.position.y * crankPin.acceleration.y
      + sliderProjectionVelocity ** 2
    ) / sliderHorizontalProjection;
    const sliderWrist = {
      acceleration: new THREE.Vector3(
        crankPin.acceleration.x + sliderProjectionAcceleration,
        0,
        0,
      ),
      position: new THREE.Vector3(
        crankPin.position.x + sliderHorizontalProjection,
        0,
        0,
      ),
      velocity: new THREE.Vector3(
        crankPin.velocity.x + sliderProjectionVelocity,
        0,
        0,
      ),
    };
    const primaryRodVector = sliderWrist.position.clone()
      .sub(crankPin.position);
    const primaryRodRelativeVelocity = sliderWrist.velocity.clone()
      .sub(crankPin.velocity);
    const primaryRodRelativeAcceleration = sliderWrist.acceleration.clone()
      .sub(crankPin.acceleration);
    const primaryRodClosure = rigidLengthKinematics(
      primaryRodVector,
      primaryRodRelativeVelocity,
      primaryRodRelativeAcceleration,
      primaryRodLength,
    );

    const tiePoint = {
      acceleration: crankPin.acceleration.clone().lerp(
        sliderWrist.acceleration,
        tieFraction,
      ),
      position: crankPin.position.clone().lerp(
        sliderWrist.position,
        tieFraction,
      ),
      velocity: crankPin.velocity.clone().lerp(
        sliderWrist.velocity,
        tieFraction,
      ),
    };
    const beamIntersectionCandidates = circleIntersections(
      tiePoint.position,
      beamConnectorLength,
      beamPivot,
      beamRadius,
    );
    const beamEndPosition = closestPoint(
      beamIntersectionCandidates,
      beamEndReference,
    );
    const otherBeamEndPosition = beamIntersectionCandidates[0]
      === beamEndPosition
      ? beamIntersectionCandidates[1]
      : beamIntersectionCandidates[0];
    const beamConnectorVector = beamEndPosition.clone()
      .sub(tiePoint.position);
    const beamVector = beamEndPosition.clone().sub(beamPivot);

    const velocitySolution = solveRows(
      beamConnectorVector,
      beamVector,
      beamConnectorVector.dot(tiePoint.velocity),
      0,
    );
    const beamEndVelocity = velocitySolution.vector;
    const beamConnectorRelativeVelocity = beamEndVelocity.clone()
      .sub(tiePoint.velocity);
    const accelerationSolution = solveRows(
      beamConnectorVector,
      beamVector,
      beamConnectorVector.dot(tiePoint.acceleration)
        - beamConnectorRelativeVelocity.lengthSq(),
      -beamEndVelocity.lengthSq(),
    );
    const beamEndAcceleration = accelerationSolution.vector;
    const beamConnectorRelativeAcceleration = beamEndAcceleration.clone()
      .sub(tiePoint.acceleration);
    const beamConnectorClosure = rigidLengthKinematics(
      beamConnectorVector,
      beamConnectorRelativeVelocity,
      beamConnectorRelativeAcceleration,
      beamConnectorLength,
    );
    const beamRadiusClosure = rigidLengthKinematics(
      beamVector,
      beamEndVelocity,
      beamEndAcceleration,
      beamRadius,
    );

    const beamDeflection = Math.atan2(
      cross2D(beamReferenceVector, beamVector),
      beamReferenceVector.dot(beamVector),
    );
    const beamAngularVelocity = cross2D(
      beamVector,
      beamEndVelocity,
    ) / beamRadius ** 2;
    const beamAngularAcceleration = cross2D(
      beamVector,
      beamEndAcceleration,
    ) / beamRadius ** 2;
    const beamRightEnd = {
      acceleration: beamEndAcceleration.clone().negate(),
      position: beamPivot.clone().multiplyScalar(2).sub(beamEndPosition),
      velocity: beamEndVelocity.clone().negate(),
    };
    const tieFromCrankVector = tiePoint.position.clone()
      .sub(crankPin.position);
    const tieFromWristVector = sliderWrist.position.clone()
      .sub(tiePoint.position);
    const normalizedCyclePhase = cyclePhase === null
      ? ((-crankAngle / fullTurn) % 1 + 1) % 1
      : ((cyclePhase % 1) + 1) % 1;
    const atBeamReversal = Math.abs(beamAngularVelocity) < 1e-10;
    const stage = atBeamReversal
      ? 'beam-at-curvilinear-reversal-while-flywheel-continues'
      : beamAngularVelocity > 0
        ? 'beam-rocks-counterclockwise-driving-continuous-flywheel'
        : 'beam-rocks-clockwise-driving-continuous-flywheel';

    return {
      beamAngularAcceleration,
      beamAngularVelocity,
      beamConnectorClosure,
      beamConnectorRelativeAcceleration,
      beamConnectorRelativeVelocity,
      beamConnectorVector,
      beamDeflection,
      beamEnd: {
        acceleration: beamEndAcceleration,
        position: beamEndPosition,
        velocity: beamEndVelocity,
      },
      beamIntersectionBranchSeparation: beamEndPosition.distanceTo(
        otherBeamEndPosition,
      ),
      beamPivot: beamPivot.clone(),
      beamRadiusClosure,
      beamRightEnd,
      beamSolverDeterminant: velocitySolution.determinant,
      beamVector,
      crankAngle,
      crankAngularAcceleration: inputAngularAcceleration,
      crankAngularSpeed: inputAngularSpeed,
      crankPin,
      crankRadiusError: crankVector.length() - crankRadius,
      crankRevolutions: -crankAngle / fullTurn,
      crankVector,
      cyclePhase: normalizedCyclePhase,
      fixedBeamPivotAccelerationError: 0,
      fixedBeamPivotPositionError: beamPivot.distanceTo(
        new THREE.Vector3(
          sourceBeamPivot.x * sourceScale,
          sourceBeamPivot.y * sourceScale,
          0,
        ),
      ),
      fixedBeamPivotVelocityError: 0,
      flywheelRimTangentialSpeed: Math.abs(inputAngularSpeed)
        * flywheelOuterRadius,
      primaryRodClosure,
      primaryRodRelativeAcceleration,
      primaryRodRelativeVelocity,
      primaryRodVector,
      sliderGuideAccelerationError: Math.hypot(
        sliderWrist.acceleration.y,
        sliderWrist.acceleration.z,
      ),
      sliderGuidePositionError: Math.hypot(
        sliderWrist.position.y,
        sliderWrist.position.z,
      ),
      sliderGuideVelocityError: Math.hypot(
        sliderWrist.velocity.y,
        sliderWrist.velocity.z,
      ),
      sliderHorizontalProjection,
      sliderProjectionAcceleration,
      sliderProjectionVelocity,
      sliderRadicand,
      sliderStrokeDisplacement: sliderWrist.position.x - sliderMinimumX,
      sliderWrist,
      stage,
      tieCollinearityError: cross2D(
        primaryRodVector,
        tieFromCrankVector,
      ),
      tieDistanceFromCrankError: tieFromCrankVector.length()
        - tieDistanceFromCrank,
      tieDistanceFromWristError: tieFromWristVector.length()
        - tieDistanceFromWrist,
      tieFraction,
      tiePoint,
    };
  };

  const stateAtCyclePhase = (cyclePhase) => stateAtCrankKinematics({
    crankAngle: -fullTurn * cyclePhase,
    cyclePhase,
    inputAngularAcceleration: crankAngularAcceleration,
    inputAngularSpeed: crankAngularSpeed,
  });
  const stateAtTime = (time) => stateAtCrankKinematics({
    crankAngle: crankAngularSpeed * time,
    cyclePhase: time / rotationPeriod,
    inputAngularAcceleration: crankAngularAcceleration,
    inputAngularSpeed: crankAngularSpeed,
  });
  const timeAtCyclePhase = (cyclePhase) => (
    ((cyclePhase % 1) + 1) % 1
  ) * rotationPeriod;

  const reversalSearchSteps = 4096;
  const beamReversalPhases = [];
  let minimumBeamSolverDeterminant = Infinity;
  let minimumBeamSolverDeterminantPhase = 0;
  let minimumBeamIntersectionBranchSeparation = Infinity;
  let minimumBeamIntersectionBranchSeparationPhase = 0;
  let previousPhase = 0;
  let previousState = stateAtCyclePhase(previousPhase);
  minimumBeamSolverDeterminant = Math.abs(
    previousState.beamSolverDeterminant,
  );
  minimumBeamIntersectionBranchSeparation =
    previousState.beamIntersectionBranchSeparation;
  for (let index = 1; index <= reversalSearchSteps; index += 1) {
    const phase = index / reversalSearchSteps;
    const state = stateAtCyclePhase(phase);
    const solverDeterminant = Math.abs(state.beamSolverDeterminant);
    if (solverDeterminant < minimumBeamSolverDeterminant) {
      minimumBeamSolverDeterminant = solverDeterminant;
      minimumBeamSolverDeterminantPhase = phase;
    }
    if (
      state.beamIntersectionBranchSeparation
        < minimumBeamIntersectionBranchSeparation
    ) {
      minimumBeamIntersectionBranchSeparation =
        state.beamIntersectionBranchSeparation;
      minimumBeamIntersectionBranchSeparationPhase = phase;
    }
    if (
      previousState.beamAngularVelocity * state.beamAngularVelocity < 0
    ) {
      let lower = previousPhase;
      let upper = phase;
      let lowerSpeed = previousState.beamAngularVelocity;
      for (let iteration = 0; iteration < 64; iteration += 1) {
        const midpoint = (lower + upper) / 2;
        const midpointSpeed = stateAtCyclePhase(
          midpoint,
        ).beamAngularVelocity;
        if (lowerSpeed * midpointSpeed <= 0) {
          upper = midpoint;
        } else {
          lower = midpoint;
          lowerSpeed = midpointSpeed;
        }
      }
      beamReversalPhases.push((lower + upper) / 2);
    }
    previousPhase = phase;
    previousState = state;
  }
  const refinePeriodicMinimum = (centerPhase, evaluator) => {
    let lower = centerPhase - 1 / reversalSearchSteps;
    let upper = centerPhase + 1 / reversalSearchSteps;
    for (let iteration = 0; iteration < 64; iteration += 1) {
      const left = (lower * 2 + upper) / 3;
      const right = (lower + upper * 2) / 3;
      if (evaluator(left) <= evaluator(right)) upper = right;
      else lower = left;
    }
    return evaluator((lower + upper) / 2);
  };
  minimumBeamSolverDeterminant = refinePeriodicMinimum(
    minimumBeamSolverDeterminantPhase,
    (phase) => Math.abs(
      stateAtCyclePhase(phase).beamSolverDeterminant,
    ),
  );
  minimumBeamIntersectionBranchSeparation = refinePeriodicMinimum(
    minimumBeamIntersectionBranchSeparationPhase,
    (phase) => (
      stateAtCyclePhase(phase).beamIntersectionBranchSeparation
    ),
  );
  const beamReversalStates = beamReversalPhases.map(stateAtCyclePhase);
  const beamMinimumDeflection = Math.min(
    ...beamReversalStates.map((state) => state.beamDeflection),
  );
  const beamMaximumDeflection = Math.max(
    ...beamReversalStates.map((state) => state.beamDeflection),
  );
  const beamAngularStroke = beamMaximumDeflection - beamMinimumDeflection;
  const minimumSliderRadicand = primaryRodLength ** 2 - crankRadius ** 2;
  const sourceState = stateAtTime(0);

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.11,
    roughness: 0.62,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.11,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.5,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.18,
    roughness: 0.5,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-axles-slider-rail-and-rear-beam-pivot-support';
  const leftFloorLedge = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.16, 0.92),
    frameMaterial,
  );
  leftFloorLedge.position.set(-2.11, floorY - 0.06, -0.52);
  leftFloorLedge.userData.role = 'fixed-left-ground-ledge-beside-wheel-pit';
  const rightFloorLedge = new THREE.Mesh(
    new THREE.BoxGeometry(3.40, 0.16, 0.92),
    frameMaterial,
  );
  rightFloorLedge.position.set(3.25, floorY - 0.06, -0.52);
  rightFloorLedge.userData.role = 'fixed-right-ground-ledge-and-slider-bed';
  // Brown draws the ground as an inked line with diagonal hatching below,
  // broken only by the wheel pit: engraving notation for a cut solid, so
  // render each ledge as a plain solid ground block (no hatch texture).
  for (const ledge of [leftFloorLedge, rightFloorLedge]) {
    const { width, height, depth } = ledge.geometry.parameters;
    const block = groundBlock(width, height, depth, { spacing: 0.09 });
    ledge.geometry.dispose();
    ledge.geometry = block.geometry;
    ledge.material = block.material;
    ledge.castShadow = false;
    ledge.receiveShadow = true;
  }
  const sliderGuideRail = new THREE.Mesh(
    new THREE.BoxGeometry(
      sliderMaximumX - sliderMinimumX + 1.30,
      0.11,
      0.52,
    ),
    darkMaterial,
  );
  sliderGuideRail.position.set(
    (sliderMinimumX + sliderMaximumX) / 2,
    floorY + 0.10,
    sliderStandardCenterZ,
  );
  sliderGuideRail.userData.axis = X_AXIS.clone();
  sliderGuideRail.userData.role =
    'fixed-horizontal-rail-for-reciprocating-small-standard';
  const flywheelBearingPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, -floorY, 0.42),
    frameMaterial,
  );
  flywheelBearingPost.position.set(0, floorY / 2, -0.54);
  flywheelBearingPost.geometry.dispose();
  flywheelBearingPost.geometry = plate(clip.difference(clip.union(
    poly([[-.21,floorY],[.21,floorY],[.21,0],[-.21,0]]), poly(circle([0,0],.24,64))),
    poly(circle([0,0],.133,64))), -.75, -.33);
  flywheelBearingPost.position.set(0,0,0);
  flywheelBearingPost.userData.role = 'fixed-bearing-post-behind-flywheel';
  const flywheelBearingRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.075, 10, 40),
    accentMaterial,
  );
  flywheelBearingRing.position.set(0, 0, -0.25);
  flywheelBearingRing.userData.role = 'fixed-bearing-ring-behind-flywheel-hub';
  flywheelBearingRing.visible = false;
  const beamBackColumnHeight = beamPivot.y - floorY;
  const beamPivotBackColumn = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.34,
      beamBackColumnHeight,
      beamBackColumnDepth,
    ),
    frameMaterial,
  );
  beamPivotBackColumn.position.set(
    beamPivot.x,
    floorY + beamBackColumnHeight / 2,
    beamBackColumnCenterZ,
  );
  beamPivotBackColumn.userData.role =
    'fixed-rear-column-supporting-beam-axis-clear-of-slider';
  const beamColumnFoot = new THREE.Mesh(
    new THREE.BoxGeometry(1.02, 0.15, 0.74),
    frameMaterial,
  );
  beamColumnFoot.position.set(
    beamPivot.x,
    floorY + 0.03,
    beamBackColumnCenterZ,
  );
  beamColumnFoot.userData.role = 'fixed-foot-of-rear-beam-pivot-column';
  beamColumnFoot.geometry.dispose();
  beamColumnFoot.geometry = new THREE.BoxGeometry(1.02,.15,.46);
  fixedFrame.add(
    beamColumnFoot,
    beamPivotBackColumn,
    flywheelBearingPost,
    flywheelBearingRing,
    leftFloorLedge,
    rightFloorLedge,
    sliderGuideRail,
  );

  const makePinAssembly = ({
    centerZ,
    length,
    role,
    ringColor = accentMaterial,
  }) => {
    const assembly = new THREE.Group();
    assembly.userData.axis = Z_AXIS.clone();
    assembly.userData.role = role;
    assembly.userData.throughPin = true;
    const shaft = cylinderAlongZ(0.105, length, darkMaterial, 30);
    shaft.position.z = centerZ;
    shaft.userData.role = `${role}-shaft`;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.047, 10, 32),
      ringColor,
    );
    ring.position.z = centerZ + length / 2 + 0.018;
    ring.userData.role = `${role}-front-retaining-ring`;
    const index = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 18, 12),
      whiteMaterial,
    );
    index.position.z = ring.position.z + 0.012;
    index.userData.role = `${role}-white-depth-index`;
    assembly.add(index, ring, shaft);
    assembly.userData.blocks = { index, ring, shaft };
    return assembly;
  };

  const beamPivotPin = makePinAssembly({
    centerZ: -0.02,
    length: 2.08,
    role: 'fixed-through-pin-at-center-of-rocking-beam',
  });
  beamPivotPin.position.copy(beamPivot);
  beamPivotPin.userData.fixed = true;
  beamPivotPin.userData.blocks.ring.position.z = 1.075;
  beamPivotPin.userData.blocks.index.position.z = 1.09;
  const beamPivotFrontRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.30, 0.075, 10, 40),
    accentMaterial,
  );
  beamPivotFrontRing.position.set(
    beamPivot.x,
    beamPivot.y,
    beamPlaneZ + beamDepth / 2 + 0.08,
  );
  beamPivotFrontRing.userData.role = 'fixed-front-bearing-ring-at-beam-axis';
  fixedFrame.add(beamPivotFrontRing, beamPivotPin);

  const flywheelAssembly = new THREE.Group();
  flywheelAssembly.userData.axis = Z_AXIS.clone();
  flywheelAssembly.userData.role = 'continuous-output-crank-and-flywheel';
  const flywheelRotor = new THREE.Group();
  flywheelAssembly.add(flywheelRotor);
  flywheelAssembly.userData.rotor = flywheelRotor;
  const flywheelRim = new THREE.Mesh(
    centeredExtrusion(
      annularShape(flywheelInnerRadius, flywheelOuterRadius),
      flywheelDepth,
    ),
    drivenMaterial,
  );
  flywheelRim.userData.role = 'source-ten-unit-radius-flywheel-rim';
  const spokeLength = flywheelInnerRadius - flywheelHubRadius * 0.72;
  const spokeCenterRadius = flywheelHubRadius * 0.72 + spokeLength / 2;
  const flywheelSpokes = Array.from({ length: 4 }, (_, index) => {
    const angle = index / 4 * fullTurn;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(spokeLength, 0.15, spokeDepth),
      drivenMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * spokeCenterRadius,
      Math.sin(angle) * spokeCenterRadius,
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.index = index;
    spoke.userData.role = 'one-of-four-source-flywheel-spokes';
    flywheelRotor.add(spoke);
    return spoke;
  });
  const flywheelHub = cylinderAlongZ(
    flywheelHubRadius,
    flywheelDepth + 0.20,
    darkMaterial,
    40,
  );
  flywheelHub.userData.role = 'flywheel-hub-on-fixed-axis';
  const flywheelShaft = cylinderAlongZ(
    0.13,
    1.34,
    darkMaterial,
    32,
  );
  flywheelShaft.userData.role = 'fixed-axis-output-shaft-through-flywheel';
  flywheelShaft.geometry.dispose();
  flywheelShaft.geometry = new THREE.CylinderGeometry(.13,.13,1,32);
  flywheelShaft.position.z = -.20;
  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.15, 0.19),
    darkMaterial,
  );
  crankArm.geometry.dispose();
  crankArm.geometry = new THREE.BoxGeometry(crankRadius, .15, .16);
  crankArm.position.set(-crankRadius / 2, 0, 0.22);
  crankArm.userData.role = 'rigid-four-unit-crank-arm';
  const crankPin = makePinAssembly({
    centerZ: 0.20,
    length: 0.78,
    role: 'crank-pin-joining-wheel-to-primary-rod',
  });
  crankPin.position.copy(crankPinLocal);
  crankPin.userData.crankRadius = crankRadius;
  const flywheelRotationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 18, 12),
    whiteMaterial,
  );
  const flywheelIndexAngle = Math.PI * 0.34;
  flywheelRotationIndex.position.set(
    Math.cos(flywheelIndexAngle) * flywheelOuterRadius * 0.91,
    Math.sin(flywheelIndexAngle) * flywheelOuterRadius * 0.91,
    flywheelDepth / 2 + 0.045,
  );
  flywheelRotationIndex.userData.role =
    'white-index-showing-continuous-flywheel-rotation';
  flywheelRotor.add(
    crankArm,
    crankPin,
    flywheelHub,
    flywheelRim,
    flywheelRotationIndex,
    flywheelShaft,
  );

  const primaryConnectingRod = makeBoredScissorLink({
    color: PALETTE.driven,
    depth: primaryRodDepth,
    length: primaryRodLength,
    pinRadius: .105,
    pinPositions: [0, tieDistanceFromCrank, primaryRodLength],
    thickness: 0.15,
  });
  primaryConnectingRod.userData.nominalLength = primaryRodLength;
  primaryConnectingRod.userData.role =
    'twenty-four-unit-crank-to-sliding-standard-primary-rod';
  const beamConnectingRod = makeBoredScissorLink({
    color: PALETTE.driven,
    depth: beamConnectorDepth,
    length: beamConnectorLength,
    pinRadius: .105,
    thickness: 0.14,
  });
  beamConnectingRod.userData.nominalLength = beamConnectorLength;
  beamConnectingRod.userData.role =
    'twenty-unit-tie-to-rocking-beam-connecting-rod';
  const tiePin = makePinAssembly({
    centerZ: 0.53,
    length: 0.74,
    role: 'through-pin-at-fifteen-unit-tie-point',
  });
  tiePin.userData.distanceFromCrank = tieDistanceFromCrank;
  const beamEndPin = makePinAssembly({
    centerZ: 0.78,
    length: 0.58,
    role: 'through-pin-joining-upright-rod-to-left-beam-end',
  });

  const beamAssembly = new THREE.Group();
  beamAssembly.position.copy(beamPivot);
  beamAssembly.userData.axis = Z_AXIS.clone();
  beamAssembly.userData.role = 'source-input-rocking-beam-on-fixed-center';
  const beamRotor = new THREE.Group();
  beamAssembly.add(beamRotor);
  beamAssembly.userData.rotor = beamRotor;
  // Brown draws a one-armed beam: a small eye for the upright rod at its
  // left end, widening to a squared right end whose boss turns on the
  // fixed (hatched) shaft. The kinematic pivot and 13-unit arm are unchanged.
  const beamBody = new THREE.Mesh(
    plate(clip.difference(clip.union(
      poly([[-beamRadius,.13],[.34,.27],[.34,-.27],[-beamRadius,-.13]]),
      poly(circle([-beamRadius,0],.17,64)),
      poly(circle([0,0],.30,64))),
      ...[-beamRadius,0].map(x => poly(circle([x,0],.108,64)))),
    -beamDepth / 2, beamDepth / 2),
    driverMaterial,
  );
  beamBody.position.z = beamPlaneZ;
  beamBody.userData.role = 'twenty-six-unit-full-rocking-beam';
  const beamEndHubs = [-1, 1].map((direction) => {
    const hub = cylinderAlongZ(0.23, beamDepth + 0.12, darkMaterial, 34);
    hub.position.set(direction * beamRadius, 0, beamPlaneZ);
    hub.userData.role = direction < 0
      ? 'left-working-eye-of-rocking-beam'
      : 'right-free-end-eye-of-rocking-beam';
    hub.visible = false;
    beamRotor.add(hub);
    return hub;
  });
  const beamCenterHub = cylinderAlongZ(
    0.25,
    beamDepth + 0.15,
    driverMaterial,
    36,
  );
  beamCenterHub.position.z = beamPlaneZ;
  beamCenterHub.userData.role = 'beam-hub-turning-about-fixed-center-pin';
  beamCenterHub.visible = false;
  const beamMotionIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 18, 12),
    whiteMaterial,
  );
  beamMotionIndex.position.set(
    beamRadius * 0.66,
    0.16,
    beamPlaneZ + beamDepth / 2 + 0.035,
  );
  beamMotionIndex.userData.role = 'white-index-showing-beam-rocking-motion';
  beamRotor.add(beamBody, beamCenterHub, beamMotionIndex);

  const slidingStandard = new THREE.Group();
  slidingStandard.userData.axis = X_AXIS.clone();
  slidingStandard.userData.role =
    'right-small-standard-with-horizontal-reciprocating-motion';
  slidingStandard.userData.translationAxis = X_AXIS.clone();
  const standardUpright = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.44,
      sliderPostDepth,
      sliderStandardDepth,
    ),
    frameMaterial,
  );
  standardUpright.position.set(
    0,
    -sliderPostDepth / 2,
    sliderStandardCenterZ,
  );
  standardUpright.userData.role = 'moving-upright-of-small-standard';
  const standardFoot = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.14, 0.72),
    frameMaterial,
  );
  standardFoot.position.set(0, floorY + 0.09, sliderStandardCenterZ);
  standardFoot.userData.role = 'moving-foot-sliding-on-horizontal-rail';
  // Extrude a YZ sleeve along X. Local horizontal coordinate is -world Z.
  standardFoot.geometry.dispose();
  standardFoot.geometry = plate(clip.difference(
    poly([[.07,floorY+.02],[.79,floorY+.02],[.79,floorY+.16],[.07,floorY+.16]]),
    poly([[.165,floorY+.04],[.695,floorY+.04],[.695,floorY+.17],[.165,floorY+.17]])),
    -.46,.46).rotateY(Math.PI/2);
  standardFoot.position.set(0,0,0);
  const standardBearingRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.065, 10, 36),
    accentMaterial,
  );
  standardBearingRing.position.z = 0.20;
  standardBearingRing.userData.role = 'bearing-ring-at-moving-standard-wrist';
  const standardLeftBrace = makeBeam(
    new THREE.Vector3(-0.39, floorY + 0.17, sliderStandardCenterZ),
    new THREE.Vector3(-0.16, -0.23, sliderStandardCenterZ),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.13 },
  );
  standardLeftBrace.userData.role = 'left-gusset-of-moving-standard';
  const standardRightBrace = makeBeam(
    new THREE.Vector3(0.39, floorY + 0.17, sliderStandardCenterZ),
    new THREE.Vector3(0.16, -0.23, sliderStandardCenterZ),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.13 },
  );
  standardRightBrace.userData.role = 'right-gusset-of-moving-standard';
  standardLeftBrace.position.y = .04;
  standardRightBrace.position.y = .04;
  const sliderWristPin = makePinAssembly({
    centerZ: -0.02,
    length: 1.02,
    role: 'through-pin-at-horizontally-sliding-standard-wrist',
  });
  sliderWristPin.userData.blocks.ring.position.z = .58;
  sliderWristPin.userData.blocks.index.position.z = .60;
  sliderWristPin.userData.blocks.shaft.geometry.dispose();
  sliderWristPin.userData.blocks.shaft.geometry = new THREE.CylinderGeometry(.105,.105,1.10,30);
  sliderWristPin.userData.blocks.shaft.position.z = .02;
  slidingStandard.add(
    sliderWristPin,
    standardBearingRing,
    standardFoot,
    standardLeftBrace,
    standardRightBrace,
    standardUpright,
  );
  slidingStandard.userData.blocks = {
    sliderWristPin,
    standardBearingRing,
    standardFoot,
    standardLeftBrace,
    standardRightBrace,
    standardUpright,
  };

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(6.75, 5.40, 2.42),
    new THREE.MeshBasicMaterial({
      color: PALETTE.paper,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(1.625, 0.95, -0.08);
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-full-rocking-beam-flywheel-motion-envelope';

  root.add(
    beamAssembly,
    beamConnectingRod,
    beamEndPin,
    cameraEnvelope,
    fixedFrame,
    flywheelAssembly,
    primaryConnectingRod,
    slidingStandard,
    tiePin,
  );
  root.userData.cameraDistanceScale = 1.015;
  root.userData.hideGround = true;
  root.userData.supportsRestart = true;
  root.userData.animationTiming = {
    authoredCyclePeriod: rotationPeriod,
    displayCycleDuration: rotationPeriod,
    playbackTimeScale: 1,
  };
  root.userData.mechanism =
    'rocking-beam-tie-rod-horizontal-standard-continuous-crank-flywheel';
  root.userData.blocks = {
    beamAssembly,
    beamBody,
    beamCenterHub,
    beamConnectingRod,
    beamEndHubs,
    beamEndPin,
    beamMotionIndex,
    beamPivotBackColumn,
    beamPivotFrontRing,
    beamPivotPin,
    beamRotor,
    beamColumnFoot,
    cameraEnvelope,
    crankArm,
    crankPin,
    fixedFrame,
    flywheelAssembly,
    flywheelBearingPost,
    flywheelBearingRing,
    flywheelHub,
    flywheelRim,
    flywheelRotationIndex,
    flywheelRotor,
    flywheelShaft,
    flywheelSpokes,
    leftFloorLedge,
    primaryConnectingRod,
    rightFloorLedge,
    sliderGuideRail,
    slidingStandard,
    tiePin,
  };
  root.userData.geometry = {
    beamAngularStroke,
    beamBackColumnCenterZ,
    beamBackColumnDepth,
    beamConnectorDepth,
    beamConnectorLength,
    beamConnectorPlaneZ,
    beamDepth,
    beamEndReference: beamEndReference.clone(),
    beamMaximumDeflection,
    beamMinimumDeflection,
    beamPivot: beamPivot.clone(),
    beamPlaneZ,
    beamRadius,
    beamReferenceVector: beamReferenceVector.clone(),
    beamReversalPhases: [...beamReversalPhases],
    crankAngularAcceleration,
    crankAngularSpeed,
    crankPinLocal: crankPinLocal.clone(),
    crankRadius,
    floorY,
    flywheelCenter: flywheelCenter.clone(),
    flywheelDepth,
    flywheelHubRadius,
    flywheelInnerRadius,
    flywheelOuterRadius,
    minimumBeamIntersectionBranchSeparation,
    minimumBeamSolverDeterminant,
    minimumSliderRadicand,
    primaryRodDepth,
    primaryRodLength,
    primaryRodPlaneZ,
    rotationPeriod,
    sliderMaximumX,
    sliderMinimumX,
    sliderPostDepth,
    sliderStandardCenterZ,
    sliderStandardDepth,
    sliderStroke,
    sourceBeamConnectorLength,
    sourceBeamEnd: sourceBeamEnd.clone(),
    sourceBeamPivot: sourceBeamPivot.clone(),
    sourceBeamRadius,
    sourceCrankPinLocal: sourceCrankPinLocal.clone(),
    sourceFloorY,
    sourceFlywheelCenter: sourceFlywheelCenter.clone(),
    sourceFlywheelHubRadius,
    sourceFlywheelInnerRadius,
    sourceFlywheelOuterRadius,
    sourcePrimaryRodLength,
    sourceScale,
    sourceSliderPostDepth,
    sourceSliderWrist: sourceSliderWrist.clone(),
    sourceTieDistanceFromCrank,
    sourceTieDistanceFromWrist,
    sourceTiePoint: sourceTiePoint.clone(),
    tieDistanceFromCrank,
    tieDistanceFromWrist,
    tieFraction,
  };
  root.userData.beamReversalStates = beamReversalStates;
  root.userData.canonicalStates = {
    halfTurn: stateAtCyclePhase(0.5),
    quarterTurn: stateAtCyclePhase(0.25),
    source: sourceState,
    threeQuarterTurn: stateAtCyclePhase(0.75),
  };
  root.userData.stateAtCrankKinematics = stateAtCrankKinematics;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeAtCyclePhase = timeAtCyclePhase;

  const pointInPlane = (point, z) => new THREE.Vector3(
    point.position.x,
    point.position.y,
    z,
  );
  const update = (time) => {
    const state = stateAtTime(time);
    flywheelRotor.rotation.z = state.crankAngle;
    beamRotor.rotation.z = state.beamDeflection;
    primaryConnectingRod.userData.setEndpoints(
      pointInPlane(state.crankPin, primaryRodPlaneZ),
      pointInPlane(state.sliderWrist, primaryRodPlaneZ),
    );
    beamConnectingRod.userData.setEndpoints(
      pointInPlane(state.tiePoint, beamConnectorPlaneZ),
      pointInPlane(state.beamEnd, beamConnectorPlaneZ),
    );
    tiePin.position.copy(state.tiePoint.position);
    beamEndPin.position.copy(state.beamEnd.position);
    slidingStandard.position.copy(state.sliderWrist.position);
    primaryConnectingRod.userData.currentLength =
      state.primaryRodClosure.length;
    beamConnectingRod.userData.currentLength =
      state.beamConnectorClosure.length;
    root.userData.contacts = {
      beamConnector: {
        accelerationError: state.beamConnectorClosure.lengthAcceleration,
        lengthError: state.beamConnectorClosure.lengthError,
        rateError: state.beamConnectorClosure.lengthRate,
      },
      beamPivot: {
        accelerationError: state.fixedBeamPivotAccelerationError,
        positionError: state.fixedBeamPivotPositionError,
        radiusAccelerationError: state.beamRadiusClosure.lengthAcceleration,
        radiusError: state.beamRadiusClosure.lengthError,
        radiusRateError: state.beamRadiusClosure.lengthRate,
        velocityError: state.fixedBeamPivotVelocityError,
      },
      crank: {
        radiusError: state.crankRadiusError,
      },
      primaryRod: {
        accelerationError: state.primaryRodClosure.lengthAcceleration,
        lengthError: state.primaryRodClosure.lengthError,
        rateError: state.primaryRodClosure.lengthRate,
      },
      sliderGuide: {
        accelerationError: state.sliderGuideAccelerationError,
        axis: X_AXIS.clone(),
        positionError: state.sliderGuidePositionError,
        velocityError: state.sliderGuideVelocityError,
      },
      tiePoint: {
        collinearityError: state.tieCollinearityError,
        distanceFromCrankError: state.tieDistanceFromCrankError,
        distanceFromWristError: state.tieDistanceFromWristError,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);

  const model = finish(
    root,
    update,
    new THREE.Vector3(.1, .06, 15),
  );
  model.reset = () => update(0);
  cameraEnvelope.castShadow = false;
  cameraEnvelope.receiveShadow = false;
  for (const index of [
    beamMotionIndex,
    flywheelRotationIndex,
    ...[
      beamEndPin,
      beamPivotPin,
      crankPin,
      slidingStandard.userData.blocks.sliderWristPin,
      tiePin,
    ].map((pin) => pin.userData.blocks.index),
  ]) {
    index.castShadow = false;
    index.receiveShadow = false;
  }
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  return model;
}

function curvedSlottedArmVariableVibration() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Construction measured from Brown's plate (525 px raster, 19.26 px per
  // source unit, origin at the hooked arm's pivot, y up). The red member
  // pivots at the origin and carries a slot whose working part is a circle
  // fitted to the drawn curved slot (±2 px); the blue member has one fixed
  // pivot and one pin whose center is the upper intersection of the slot
  // circle and the arm circle. The published animation used a semicircular
  // slot on a broad C plate; the plate's narrow J hook is followed instead.
  const sourceScale = 0.31;
  const sourcePixelsPerUnit = 19.26;
  const sourceInputPivot = new THREE.Vector2(0, 0);
  const sourceSlotCenter = new THREE.Vector2(1.461, 3.479);
  const sourceSlotRadius = 5.431;
  const sourceOutputPivot = new THREE.Vector2(17.21, 9.086);
  const sourceOutputArmLength = 15.07;
  const sourceFollowerPinRadius = 0.5;
  // Brown's drawn pose is the start of the stroke (pin just past the top of
  // the slot circle). A clockwise 115-degree regular stroke carries the pin
  // round the curved slot to just short of the point where its motion in the
  // slot would reverse; the slot's last few degrees stay unused as drawn.
  const inputStrokeAngle = -THREE.MathUtils.degToRad(115);
  const inputStrokeMagnitude = Math.abs(inputStrokeAngle);
  const inputPivot = sourceInputPivot.clone().multiplyScalar(sourceScale);
  const slotCenterLocal = sourceSlotCenter.clone().multiplyScalar(sourceScale);
  const slotRadius = sourceSlotRadius * sourceScale;
  const outputPivot = sourceOutputPivot.clone().multiplyScalar(sourceScale);
  const outputArmLength = sourceOutputArmLength * sourceScale;
  const followerPinRadius = sourceFollowerPinRadius * sourceScale;

  // The circular slot runs from the pin's drawn start pose (where it merges
  // into the drawn straight run) round to Brown's slot end beside the pivot.
  const sourceSlotEndAngle = THREE.MathUtils.degToRad(213.6);
  const slotEndAngle = sourceSlotEndAngle;
  const cyclePeriod = 8;
  const motionPhaseSpan = 0.4;
  const firstDwellEndPhase = 0.5;
  const returnEndPhase = 0.9;
  const movingInputAngularSpeed = inputStrokeAngle
    / (motionPhaseSpan * cyclePeriod);
  const transitionTolerance = 1e-12;

  const cross2 = (left, right) => left.x * right.y - left.y * right.x;
  const rotate2 = (vector, angle) => new THREE.Vector2(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  );
  const solveTwoRows = (firstRow, secondRow, firstValue, secondValue) => {
    const determinant = cross2(firstRow, secondRow);
    return new THREE.Vector2(
      (firstValue * secondRow.y - firstRow.y * secondValue)
        / determinant,
      (firstRow.x * secondValue - firstValue * secondRow.x)
        / determinant,
    );
  };
  const phaseDistance = (left, right) => Math.abs(Math.atan2(
    Math.sin((left - right) * fullTurn),
    Math.cos((left - right) * fullTurn),
  )) / fullTurn;

  const geometryAtInputAngle = (inputAngle) => {
    const slotCenter = rotate2(slotCenterLocal, inputAngle).add(inputPivot);
    const centerLine = outputPivot.clone().sub(slotCenter);
    const pivotSeparation = centerLine.length();
    const centerDirection = centerLine.clone().divideScalar(pivotSeparation);
    const centerPerpendicular = new THREE.Vector2(
      -centerDirection.y,
      centerDirection.x,
    );
    const intersectionAlong = (
      slotRadius ** 2
        - outputArmLength ** 2
        + pivotSeparation ** 2
    ) / (2 * pivotSeparation);
    const halfChordSquared = slotRadius ** 2 - intersectionAlong ** 2;
    if (halfChordSquared < -1e-11) {
      throw new RangeError('movement 203 circles do not intersect');
    }
    const intersectionAcross = Math.sqrt(Math.max(0, halfChordSquared));
    const candidateUpper = slotCenter.clone()
      .addScaledVector(centerDirection, intersectionAlong)
      .addScaledVector(centerPerpendicular, intersectionAcross);
    const candidateLower = slotCenter.clone()
      .addScaledVector(centerDirection, intersectionAlong)
      .addScaledVector(centerPerpendicular, -intersectionAcross);
    const followerPoint = candidateUpper.y >= candidateLower.y
      ? candidateUpper
      : candidateLower;
    const slotRadiusVector = followerPoint.clone().sub(slotCenter);
    const outputRadiusVector = followerPoint.clone().sub(outputPivot);

    // Differentiate both fixed-radius equations with respect to the input
    // angle.  This avoids finite-difference drift near either dead center.
    const slotCenterDerivative = new THREE.Vector2(
      -(slotCenter.y - inputPivot.y),
      slotCenter.x - inputPivot.x,
    );
    const followerDerivative = solveTwoRows(
      slotRadiusVector,
      outputRadiusVector,
      slotRadiusVector.dot(slotCenterDerivative),
      0,
    );
    const relativeSlotDerivative = followerDerivative.clone().sub(
      slotCenterDerivative,
    );
    const slotCenterSecondDerivative = inputPivot.clone().sub(slotCenter);
    const followerSecondDerivative = solveTwoRows(
      slotRadiusVector,
      outputRadiusVector,
      slotRadiusVector.dot(slotCenterSecondDerivative)
        - relativeSlotDerivative.lengthSq(),
      -followerDerivative.lengthSq(),
    );
    const outputAngleWrapped = Math.atan2(
      outputRadiusVector.y,
      outputRadiusVector.x,
    );
    const outputAngle = outputAngleWrapped < 0
      ? outputAngleWrapped + fullTurn
      : outputAngleWrapped;
    const outputRotation = outputAngle - Math.PI;
    const outputAngularGain = cross2(
      outputRadiusVector,
      followerDerivative,
    ) / outputArmLength ** 2;
    const outputAngularGainDerivative = cross2(
      outputRadiusVector,
      followerSecondDerivative,
    ) / outputArmLength ** 2;
    const worldSlotAngle = Math.atan2(
      slotRadiusVector.y,
      slotRadiusVector.x,
    );
    const localSlotAngleUnwrapped = worldSlotAngle - inputAngle;
    const localSlotAngle = THREE.MathUtils.euclideanModulo(
      localSlotAngleUnwrapped,
      fullTurn,
    );
    const localSlotAngularGain = cross2(
      slotRadiusVector,
      relativeSlotDerivative,
    ) / slotRadius ** 2 - 1;
    const localSlotAngularGainDerivative = cross2(
      slotRadiusVector,
      followerSecondDerivative.clone().sub(slotCenterSecondDerivative),
    ) / slotRadius ** 2;
    const constraintDeterminant = cross2(
      slotRadiusVector,
      outputRadiusVector,
    );
    return {
      candidateLower,
      candidateUpper,
      constraintDeterminant,
      followerDerivative,
      followerPoint,
      followerSecondDerivative,
      inputAngle,
      intersectionAcross,
      intersectionAlong,
      localSlotAngle,
      localSlotAngleUnwrapped,
      localSlotAngularGain,
      localSlotAngularGainDerivative,
      outputAngle,
      outputAngularGain,
      outputAngularGainDerivative,
      outputRadiusVector,
      outputRotation,
      pivotSeparation,
      slotCenter,
      slotCenterDerivative,
      slotCenterSecondDerivative,
      slotRadiusVector,
      worldSlotAngle,
    };
  };

  // The pin's drawn start pose joins the circular slot to the straight run.
  const restGeometry = geometryAtInputAngle(0);
  const sourceSlotStartAngle = restGeometry.localSlotAngle;
  const slotStartAngle = sourceSlotStartAngle;

  const stateAtInputAngle = (
    inputAngle,
    inputAngularSpeed = 0,
    inputAngularAcceleration = 0,
  ) => {
    const geometry = geometryAtInputAngle(inputAngle);
    const followerVelocity = geometry.followerDerivative.clone()
      .multiplyScalar(inputAngularSpeed);
    const followerAcceleration = geometry.followerSecondDerivative.clone()
      .multiplyScalar(inputAngularSpeed ** 2)
      .addScaledVector(
        geometry.followerDerivative,
        inputAngularAcceleration,
      );
    const slotCenterVelocity = geometry.slotCenterDerivative.clone()
      .multiplyScalar(inputAngularSpeed);
    const slotCenterAcceleration = geometry.slotCenterSecondDerivative.clone()
      .multiplyScalar(inputAngularSpeed ** 2)
      .addScaledVector(
        geometry.slotCenterDerivative,
        inputAngularAcceleration,
      );
    const outputAngularSpeed = geometry.outputAngularGain
      * inputAngularSpeed;
    const outputAngularAcceleration = geometry.outputAngularGainDerivative
      * inputAngularSpeed ** 2
      + geometry.outputAngularGain * inputAngularAcceleration;
    const localSlotAngularSpeed = geometry.localSlotAngularGain
      * inputAngularSpeed;
    const localSlotAngularAcceleration =
      geometry.localSlotAngularGainDerivative * inputAngularSpeed ** 2
      + geometry.localSlotAngularGain * inputAngularAcceleration;
    return {
      ...geometry,
      branch: 'upper-y-circle-intersection',
      followerAcceleration,
      followerVelocity,
      inputAngularAcceleration,
      inputAngularSpeed,
      localSlotAngularAcceleration,
      localSlotAngularSpeed,
      outputAngularAcceleration,
      outputAngularSpeed,
      outputArmLengthError: geometry.outputRadiusVector.length()
        - outputArmLength,
      slotCenterAcceleration,
      slotCenterVelocity,
      // The start of the circular slot opens into the straight run, so only
      // the closed far end limits the pin.
      slotEndpointMargin: slotEndAngle - geometry.localSlotAngle,
      slotRadiusError: geometry.slotRadiusVector.length() - slotRadius,
      slotSlidingSpeed: Math.abs(localSlotAngularSpeed) * slotRadius,
    };
  };

  const driveAtCyclePhase = (rawCyclePhase) => {
    const cyclePhase = THREE.MathUtils.euclideanModulo(rawCyclePhase, 1);
    const transition = [
      [0, 'source-end-departure'],
      [motionPhaseSpan, 'far-end-arrival'],
      [firstDwellEndPhase, 'far-end-departure'],
      [returnEndPhase, 'source-end-arrival'],
    ].find(([boundary]) => (
      phaseDistance(cyclePhase, boundary) <= transitionTolerance
    ))?.[1] ?? null;
    let inputAngle = 0;
    let inputAngularSpeed = 0;
    let stage = 'source-end-dwell';
    if (cyclePhase > 0 && cyclePhase < motionPhaseSpan) {
      const progress = cyclePhase / motionPhaseSpan;
      inputAngle = inputStrokeAngle * progress;
      inputAngularSpeed = movingInputAngularSpeed;
      stage = 'regular-clockwise-input-stroke';
    } else if (
      cyclePhase >= motionPhaseSpan
        && cyclePhase <= firstDwellEndPhase
    ) {
      inputAngle = inputStrokeAngle;
      stage = 'far-end-dwell';
    } else if (
      cyclePhase > firstDwellEndPhase
        && cyclePhase < returnEndPhase
    ) {
      const progress = (
        cyclePhase - firstDwellEndPhase
      ) / motionPhaseSpan;
      inputAngle = inputStrokeAngle * (1 - progress);
      inputAngularSpeed = -movingInputAngularSpeed;
      stage = 'regular-counter-clockwise-return-stroke';
    }
    if (transition !== null) {
      const atFarEnd = transition.startsWith('far-end');
      inputAngle = atFarEnd ? inputStrokeAngle : 0;
      inputAngularSpeed = 0;
      stage = atFarEnd ? 'far-end-dwell' : 'source-end-dwell';
    }
    return {
      cyclePhase,
      dwell: inputAngularSpeed === 0,
      inputAngle,
      inputAngularAcceleration: 0,
      inputAngularSpeed,
      stage,
      transition,
      velocityDiscontinuous: transition !== null,
    };
  };
  const stateAtCyclePhase = (cyclePhase) => {
    const drive = driveAtCyclePhase(cyclePhase);
    return {
      ...stateAtInputAngle(
        drive.inputAngle,
        drive.inputAngularSpeed,
        drive.inputAngularAcceleration,
      ),
      cyclePhase: drive.cyclePhase,
      dwell: drive.dwell,
      inputVelocityDiscontinuous: drive.velocityDiscontinuous,
      stage: drive.stage,
      transition: drive.transition,
    };
  };
  const stateAtTime = (time) => stateAtCyclePhase(time / cyclePeriod);

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.62,
    side: THREE.DoubleSide,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.2,
    roughness: 0.52,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.69,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.48 });
  const pointOnArc = (arc, angle) => new THREE.Vector2(
    arc.center.x + arc.radius * Math.cos(angle),
    arc.center.y + arc.radius * Math.sin(angle),
  );
  const appendArc = (path, arc, clockwise = false) => {
    path.absarc(
      arc.center.x,
      arc.center.y,
      arc.radius,
      arc.start,
      arc.end,
      clockwise,
    );
  };

  // Outer outline of Brown's hooked arm, traced from the plate's ink with a
  // classical contour pass (source units, pivot at the origin): the curved
  // limb carrying the slot, the straight top run with its rounded end, the
  // deep bay between the top run and the pivot boss, and the boss itself.
  const sourcePlateOutline = [
    [2.82, 10.83], [2.37, 10.83], [1.91, 10.83], [1.46, 10.77], [1.01, 10.72],
    [0.56, 10.68], [0.12, 10.61], [-0.32, 10.47], [-0.74, 10.30], [-1.16, 10.13],
    [-1.55, 9.91], [-1.95, 9.70], [-2.32, 9.43], [-2.67, 9.14], [-3.01, 8.85],
    [-3.36, 8.55], [-3.65, 8.21], [-3.95, 7.86], [-4.24, 7.52], [-4.49, 7.14],
    [-4.73, 6.75], [-4.94, 6.35], [-5.14, 5.94], [-5.31, 5.53], [-5.43, 5.09],
    [-5.55, 4.65], [-5.60, 4.20], [-5.69, 3.76], [-5.69, 3.30], [-5.69, 2.85],
    [-5.65, 2.40], [-5.63, 1.94], [-5.58, 1.49], [-5.43, 1.06], [-5.32, 0.63],
    [-5.17, 0.20], [-4.99, -0.22], [-4.79, -0.63], [-4.53, -1.00], [-4.26, -1.37],
    [-3.97, -1.72], [-3.71, -2.08], [-3.38, -2.40], [-3.05, -2.72], [-2.69, -2.99],
    [-2.33, -3.26], [-1.94, -3.49], [-1.52, -3.67], [-1.11, -3.86], [-0.67, -3.94],
    [-0.22, -3.97], [0.24, -3.97], [0.69, -3.97], [1.13, -3.86], [1.56, -3.72],
    [1.98, -3.54], [2.36, -3.28], [2.72, -3.02], [3.06, -2.72], [3.33, -2.36],
    [3.59, -1.98], [3.81, -1.58], [3.97, -1.16], [4.08, -0.72], [4.13, -0.27],
    [4.13, 0.19], [4.08, 0.63], [3.96, 1.07], [3.80, 1.50], [3.60, 1.91],
    [3.38, 2.30], [3.09, 2.65], [2.73, 2.92], [2.39, 3.20], [2.01, 3.45],
    [1.59, 3.61], [1.17, 3.79], [0.75, 3.96], [0.38, 4.22], [0.06, 4.54],
    [-0.08, 4.97], [-0.07, 5.43], [0.07, 5.86], [0.32, 6.24], [0.69, 6.47],
    [1.11, 6.64], [1.56, 6.72], [2.01, 6.78], [2.45, 6.83], [2.91, 6.83],
    [3.37, 6.83], [3.82, 6.88], [4.26, 6.93], [4.71, 6.98], [5.15, 7.09],
    [5.57, 7.27], [5.93, 7.53], [6.16, 7.84], [6.30, 8.21], [6.34, 8.66],
    [6.30, 9.12], [6.20, 9.56], [6.00, 9.96], [5.72, 10.28], [5.40, 10.52],
    [5.02, 10.71], [4.63, 10.81], [4.18, 10.88], [3.73, 10.88], [3.27, 10.86],
  ];
  const plateOutline = sourcePlateOutline.map(([x, y]) => (
    [x * sourceScale, y * sourceScale]
  ));
  // Ideal circular working walls replace hand-rounded source offsets. A small
  // radial clearance covers tessellation; no bevel projects into the slot.
  const slotClearance = 0.008;
  const slotHalfWidth = followerPinRadius + slotClearance;
  const slotArcs = {
    inner: { center: slotCenterLocal, radius: slotRadius - slotHalfWidth,
      start: slotStartAngle, end: slotEndAngle },
    outer: { center: slotCenterLocal, radius: slotRadius + slotHalfWidth,
      start: slotStartAngle, end: slotEndAngle },
    lowerCap: { center: pointOnArc({ center: slotCenterLocal, radius: slotRadius }, slotEndAngle),
      radius: slotHalfWidth, start: slotEndAngle, end: slotEndAngle + Math.PI },
    upperCap: { center: pointOnArc({ center: slotCenterLocal, radius: slotRadius }, slotStartAngle),
      radius: slotHalfWidth, start: slotStartAngle + Math.PI, end: slotStartAngle + fullTurn },
  };
  const slotHole = new THREE.Path();
  const slotStart = pointOnArc(slotArcs.outer, slotArcs.outer.start);
  slotHole.moveTo(slotStart.x, slotStart.y);
  appendArc(slotHole, slotArcs.outer, false);
  appendArc(slotHole, slotArcs.lowerCap, false);
  slotHole.absarc(
    slotArcs.inner.center.x,
    slotArcs.inner.center.y,
    slotArcs.inner.radius,
    slotArcs.inner.end,
    slotArcs.inner.start,
    true,
  );
  appendArc(slotHole, slotArcs.upperCap, false);
  slotHole.closePath();

  const plateDepth = 0.28;
  // Brown's arm is a J-shaped hook: its top limb runs on to the right as a
  // straight band with a rounded end, and the slot continues along it
  // from the pin's drawn start pose. The pin starts at the junction and then
  // stays on the circular part; the straight run reproduces the drawn slot.
  const shapeRing = (path) => {
    const points = path.getPoints(96).map((point) => [point.x, point.y]);
    const first = points[0];
    const last = points.at(-1);
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-9) points.pop();
    return poly(points);
  };
  const topSlotStartX = restGeometry.followerPoint.x;
  const topSlotEndX = 4.71 * sourceScale;
  const topSlotY = restGeometry.followerPoint.y;
  const curvedPlatePolygons = clip.difference(
    poly(plateOutline),
    shapeRing(slotHole),
    poly([
      [topSlotStartX, topSlotY - slotHalfWidth],
      [topSlotEndX, topSlotY - slotHalfWidth],
      [topSlotEndX, topSlotY + slotHalfWidth],
      [topSlotStartX, topSlotY + slotHalfWidth],
    ]),
    poly(circle([topSlotEndX, topSlotY], slotHalfWidth, 64)),
    poly(circle([0, 0], sourceScale, 96)),
  );
  const curvedPlate = new THREE.Mesh(
    plate(curvedPlatePolygons, -plateDepth / 2, plateDepth / 2),
    driverMaterial,
  );
  curvedPlate.userData.actualThroughSlot = true;
  curvedPlate.userData.role =
    'one-piece-curved-input-arm-with-one-circular-through-slot';
  const inputArm = new THREE.Group();
  inputArm.position.set(inputPivot.x, inputPivot.y, 0);
  inputArm.add(curvedPlate);
  inputArm.userData.fixedPivot = true;
  inputArm.userData.regularVibration = true;
  inputArm.userData.role = 'regularly-vibrating-curved-slotted-input-arm';

  const inputBoss = new THREE.Mesh(
    centeredExtrusion(
      annularShape(sourceScale, 1.8 * sourceScale),
      0.12,
      0.008,
    ),
    driverMaterial,
  );
  inputBoss.position.z = plateDepth / 2 + 0.055;
  inputBoss.userData.role = 'raised-boss-on-curved-arm-input-pivot';
  const inputRotationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 18, 12),
    indexMaterial,
  );
  inputRotationIndex.position.set(
    1.5 * sourceScale,
    0,
    plateDepth / 2 + 0.145,
  );
  inputRotationIndex.userData.role =
    'white-index-showing-curved-arm-input-angle';
  inputArm.add(inputBoss, inputRotationIndex);

  const makeArcEdge = (arc, role) => {
    const sampleCount = 112;
    const straightPoints = arc.straightToX === undefined ? [] : Array.from(
      { length: 16 },
      (_, index) => new THREE.Vector3(
        THREE.MathUtils.lerp(arc.straightToX, topSlotStartX, index / 16),
        arc.straightY,
        plateDepth / 2 + 0.025,
      ),
    );
    const points = straightPoints.concat(Array.from({ length: sampleCount + 1 }, (_, index) => {
      const angle = THREE.MathUtils.lerp(
        arc.start,
        arc.end,
        index / sampleCount,
      );
      return new THREE.Vector3(
        arc.center.x + arc.radius * Math.cos(angle),
        arc.center.y + arc.radius * Math.sin(angle),
        plateDepth / 2 + 0.025,
      );
    }));
    const edge = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.3),
        points.length - 1,
        0.018,
        7,
        false,
      ),
      inkMaterial,
    );
    edge.userData.role = role;
    return edge;
  };
  // Each inked wall runs along the straight top run and continues round the
  // circular slot from the pin's start pose.
  const slotInnerEdge = makeArcEdge(
    { ...slotArcs.inner, radius: slotArcs.inner.radius - 0.022,
      straightToX: topSlotEndX, straightY: topSlotY - slotHalfWidth - 0.022 },
    'inner-working-edge-of-circular-slot',
  );
  const slotOuterEdge = makeArcEdge(
    { ...slotArcs.outer, radius: slotArcs.outer.radius + 0.022,
      straightToX: topSlotEndX, straightY: topSlotY + slotHalfWidth + 0.022 },
    'outer-working-edge-of-circular-slot',
  );
  inputArm.add(slotInnerEdge, slotOuterEdge);
  // Brown inks the slot walls only because the plate is a line drawing.
  for (const edge of [slotInnerEdge, slotOuterEdge]) {
    edge.visible = false;
    edge.userData.retiredInkOutline = true;
  }

  const outputArm = new THREE.Group();
  outputArm.position.set(outputPivot.x, outputPivot.y, 0);
  outputArm.userData.fixedPivot = true;
  outputArm.userData.role = 'single-straight-variable-vibration-output-arm';
  const sourceArmOutline = [
    new THREE.Vector2(-1.8, 1.55),
    new THREE.Vector2(-sourceOutputArmLength, 1.05),
    new THREE.Vector2(-sourceOutputArmLength, -1.05),
    new THREE.Vector2(-1.8, -1.55),
  ].map((point) => point.multiplyScalar(sourceScale));
  // The plate dashes the arm's end: it passes behind the hooked arm.
  const outputArmPlaneZ = -0.39;
  const outputArmDepth = 0.2;
  const outputArmBody = new THREE.Mesh(
    plate(clip.difference(poly(sourceArmOutline.map(point => point.toArray())),
      poly(circle([-outputArmLength, 0], followerPinRadius + 0.005, 64))),
    -outputArmDepth / 2, outputArmDepth / 2),
    drivenMaterial,
  );
  outputArmBody.position.z = outputArmPlaneZ;
  outputArmBody.userData.rigidLength = outputArmLength;
  outputArmBody.userData.role = 'tapered-body-of-straight-output-arm';
  const outputPivotBoss = new THREE.Mesh(
    centeredExtrusion(
      annularShape(1.3 * sourceScale, 2.2 * sourceScale),
      outputArmDepth + 0.08,
      0.009,
    ),
    drivenMaterial,
  );
  outputPivotBoss.position.z = outputArmPlaneZ;
  outputPivotBoss.userData.role = 'boss-around-fixed-output-arm-pivot';
  const followerBoss = new THREE.Mesh(
    centeredExtrusion(
      annularShape(followerPinRadius + 0.005, 1.05 * sourceScale),
      outputArmDepth + 0.08,
      0,
    ),
    drivenMaterial,
  );
  followerBoss.position.set(-outputArmLength, 0, outputArmPlaneZ);
  followerBoss.userData.role = 'boss-around-single-slot-follower-pin';
  const followerPin = new THREE.Mesh(
    new THREE.CylinderGeometry(
      followerPinRadius,
      followerPinRadius,
      0.94,
      32,
    ),
    indexMaterial,
  );
  followerPin.rotation.x = Math.PI / 2;
  followerPin.position.set(-outputArmLength, 0, -0.23);
  followerPin.userData.fitsCircularSlot = true;
  followerPin.userData.role = 'single-pin-sliding-in-curved-arm-slot';
  const followerPinRim = new THREE.Mesh(
    new THREE.TorusGeometry(followerPinRadius, 0.026, 8, 38),
    inkMaterial,
  );
  followerPinRim.position.set(-outputArmLength, 0, 0.24);
  followerPinRim.userData.role = 'front-rim-of-single-slot-follower-pin';
  followerPinRim.visible = false;
  followerPinRim.userData.retiredInkOutline = true;
  const outputRotationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 18, 12),
    indexMaterial,
  );
  outputRotationIndex.position.set(
    0,
    1.35 * sourceScale,
    outputArmPlaneZ + outputArmDepth / 2 + 0.07,
  );
  outputRotationIndex.userData.role =
    'white-index-showing-variable-output-arm-angle';
  outputArm.add(
    outputArmBody,
    outputPivotBoss,
    followerBoss,
    followerPin,
    followerPinRim,
    outputRotationIndex,
  );

  const inputShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 1.35,
    radius: sourceScale - 0.01,
  });
  inputShaft.position.set(inputPivot.x, inputPivot.y, 0.05);
  inputShaft.userData.fixedCenter = true;
  inputShaft.userData.keyedToInputArm = true;
  inputShaft.userData.role = 'fixed-center-shaft-keyed-to-curved-input-arm';
  const outputShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 1.42,
    radius: 1.3 * sourceScale - 0.01,
  });
  outputShaft.position.set(outputPivot.x, outputPivot.y, 0.08);
  outputShaft.userData.fixedCenter = true;
  outputShaft.userData.keyedToOutputArm = true;
  outputShaft.userData.role = 'fixed-center-shaft-keyed-to-straight-output-arm';

  const rearZ = -0.66;
  const baseY = -2.26;
  const baseRail = makeBeam(
    new THREE.Vector3(-1.55, baseY, rearZ),
    new THREE.Vector3(4.55, baseY, rearZ),
    { color: PALETTE.frame, depth: 0.2, thickness: 0.15 },
  );
  baseRail.userData.role = 'fixed-base-rail';
  const inputPost = makeBeam(
    new THREE.Vector3(inputPivot.x, baseY, rearZ),
    new THREE.Vector3(inputPivot.x, inputPivot.y, rearZ),
    { color: PALETTE.frame, depth: 0.2, thickness: 0.15 },
  );
  inputPost.userData.role = 'rear-support-for-input-pivot';
  const outputPostX = outputPivot.x + 0.72;
  const outputPost = makeBeam(
    new THREE.Vector3(outputPostX, baseY, rearZ),
    new THREE.Vector3(outputPostX, outputPivot.y, rearZ),
    { color: PALETTE.frame, depth: 0.2, thickness: 0.15 },
  );
  outputPost.userData.role = 'rear-support-for-output-pivot';
  const outputBridge = makeBeam(
    new THREE.Vector3(outputPostX, outputPivot.y, rearZ),
    new THREE.Vector3(outputPivot.x, outputPivot.y, -0.34),
    { color: PALETTE.frame, depth: 0.16, thickness: 0.13 },
  );
  outputBridge.userData.role = 'fixed-output-bearing-bridge';
  const inputBridge = makeBeam(
    new THREE.Vector3(inputPivot.x, inputPivot.y, rearZ),
    new THREE.Vector3(inputPivot.x, inputPivot.y, -0.34),
    { color: PALETTE.frame, depth: 0.16, thickness: 0.13 },
  );
  inputBridge.userData.role = 'fixed-input-bearing-bridge';
  const bearingRings = [inputPivot, outputPivot].map((pivot, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        (index === 0 ? 0.9 : 0.96) * sourceScale,
        0.055,
        9,
        40,
      ),
      frameMaterial,
    );
    ring.position.set(pivot.x, pivot.y, -0.29);
    ring.userData.fixed = true;
    ring.userData.role = index === 0
      ? 'stationary-bearing-ring-at-input-pivot'
      : 'stationary-bearing-ring-at-output-pivot';
    return ring;
  });

  const sourceBoundingBox = [-9.504714, -9.500457, 25, 25];
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourceBoundingBox[2] * sourceScale,
      sourceBoundingBox[3] * sourceScale,
      0.08,
    ),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  cameraEnvelope.position.set(
    (sourceBoundingBox[0] + sourceBoundingBox[2] / 2) * sourceScale,
    (sourceBoundingBox[1] + sourceBoundingBox[3] / 2) * sourceScale,
    -0.78,
  );
  cameraEnvelope.visible = false;
  cameraEnvelope.userData.isCameraEnvelope = true;
  cameraEnvelope.userData.role = 'movement-203-full-stroke-camera-envelope';

  root.add(
    baseRail,
    inputPost,
    outputPost,
    inputBridge,
    outputBridge,
    ...bearingRings,
    inputShaft,
    outputShaft,
    inputArm,
    outputArm,
    cameraEnvelope,
  );

  const sourcePose = stateAtInputAngle(0);
  const farPose = stateAtInputAngle(inputStrokeAngle);
  const gainSamples = Array.from({ length: 4097 }, (_, index) => (
    geometryAtInputAngle(inputStrokeAngle * index / 4096)
  ));
  const gainExtrema = gainSamples.reduce((extrema, state) => ({
    maximum: Math.max(extrema.maximum, state.outputAngularGain),
    minimum: Math.min(extrema.minimum, state.outputAngularGain),
  }), { maximum: -Infinity, minimum: Infinity });
  const outputSwingAngle = farPose.outputAngle - sourcePose.outputAngle;
  const sourcePointToModel = (point, z = 0) => new THREE.Vector3(
    point.x * sourceScale,
    point.y * sourceScale,
    z,
  );
  const modelPointToSource = (point) => new THREE.Vector2(
    point.x / sourceScale,
    point.y / sourceScale,
  );

  root.userData.archetype =
    'regular-rocking-circular-slot-variable-output-straight-arm';
  root.userData.mechanism =
    'one-curved-arm-carries-one-circular-slot-constraining-one-pin-on-one-fixed-pivot-straight-arm';
  root.userData.variant =
    'clockwise-115-degree-regular-input-stroke-with-upper-circle-intersection-and-variable-output-gain';
  root.userData.blocks = {
    baseRail,
    bearingRings,
    cameraEnvelope,
    curvedPlate,
    followerBoss,
    followerPin,
    followerPinRim,
    inputArm,
    inputBoss,
    inputBridge,
    inputPost,
    inputRotationIndex,
    inputShaft,
    outputArm,
    outputArmBody,
    outputBridge,
    outputPivotBoss,
    outputPost,
    outputRotationIndex,
    outputShaft,
    slotInnerEdge,
    slotOuterEdge,
  };
  root.userData.canonicalCyclePhases = {
    farEndArrival: motionPhaseSpan,
    farEndDwellMidpoint: 0.45,
    farEndDeparture: firstDwellEndPhase,
    returnMidpoint: 0.7,
    sourceEndArrival: returnEndPhase,
    sourceEndDwellMidpoint: 0.95,
    sourcePose: 0,
    strokeMidpoint: 0.2,
  };
  root.userData.canonicalTimes = Object.fromEntries(Object.entries(
    root.userData.canonicalCyclePhases,
  ).map(([name, phase]) => [name, phase * cyclePeriod]));
  root.userData.geometry = {
    followerPinRadius,
    inputPivot,
    inputStrokeAngle,
    inputStrokeMagnitude,
    outputArmLength,
    outputPivot,
    outputSwingAngle,
    plateOutline,
    slotArcs,
    slotCenterLocal,
    slotEndAngle,
    slotRadius,
    slotStartAngle,
    sourceFollowerPinRadius,
    sourcePixelsPerUnit,
    sourcePlateOutline,
    sourceInputPivot,
    sourceOutputArmLength,
    sourceOutputPivot,
    sourceScale,
    sourceSlotCenter,
    sourceSlotEndAngle,
    sourceSlotRadius,
    sourceSlotStartAngle,
  };
  root.userData.modelPointToSource = modelPointToSource;
  // Construction taken from the plate; the 40-10-40-10 stroke-and-dwell
  // timing still follows the published animation.
  root.userData.sourceAnimation = {
    boundingBox: [...sourceBoundingBox],
    constructionSource: 'plate',
    inputCamKeyframes: [
      { clockwise: true, cyclePosition: 0, pose: 'cam0' },
      { clockwise: true, cyclePosition: 0.4, pose: 'cam1' },
      { clockwise: false, cyclePosition: 0.5, pose: 'cam1' },
      { clockwise: false, cyclePosition: 0.9, pose: 'cam0' },
    ],
    inputPivot: sourceInputPivot.clone(),
    outputArmLength: sourceOutputArmLength,
    outputPivot: sourceOutputPivot.clone(),
    selectedIntersectionBranch: 'greatest-y',
    slotCenter: sourceSlotCenter.clone(),
    slotRadius: sourceSlotRadius,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceRaster = {
    imageSize: new THREE.Vector2(525, 525),
    sourceUrl: 'https://507movements.com/mm_203.html',
  };
  root.userData.driveAtCyclePhase = driveAtCyclePhase;
  root.userData.geometryAtInputAngle = geometryAtInputAngle;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    circularSlotCount: 1,
    cyclePeriod,
    dwellFractionPerEnd: 0.1,
    followerPinCount: 1,
    gainExtrema,
    inputStrokeAngle,
    inputStrokeMagnitude,
    motionPhaseSpan,
    movingInputAngularSpeed,
    outputArmCount: 1,
    outputSwingAngle,
    variableOutputGain: true,
  };
  // Brown depicts the mechanism in isolation; the old stand was invented.
  root.remove(baseRail, inputPost, outputPost, inputBridge, outputBridge, ...bearingRings,
    cameraEnvelope);
  // Brown draws no index marks on either arm.
  inputArm.remove(inputRotationIndex);
  outputArm.remove(outputRotationIndex);
  root.userData.hideGround = true;
  root.userData.cameraDistanceScale = 1.02;
  root.userData.reconstruction = { slotClearance,
    assumptions: 'Ideal circular slot (fitted to the plate) with finite pin clearance; the straight top run of the slot is drawn but only the pin\'s start pose sits in it; fixed pivots are external supports. Input dwells follow the official animation.' };
  root.traverse(object => {
    for (const material of [].concat(object.material ?? [])) material.fog = false;
  });

  const update = (time) => {
    const state = stateAtTime(time);
    inputArm.rotation.z = state.inputAngle;
    outputArm.rotation.z = state.outputRotation;
    setSpin(inputShaft, state.inputAngle);
    setSpin(outputShaft, state.outputRotation);
    inputArm.userData.angularSpeed = state.inputAngularSpeed;
    inputShaft.userData.angularSpeed = state.inputAngularSpeed;
    outputArm.userData.angularSpeed = state.outputAngularSpeed;
    outputShaft.userData.angularSpeed = state.outputAngularSpeed;
    followerPin.userData.slidingSpeed = state.slotSlidingSpeed;
    root.userData.contacts = {
      circularSlotFollower: {
        branch: state.branch,
        followerPoint: state.followerPoint.clone(),
        localSlotAngle: state.localSlotAngle,
        outputArmLengthError: state.outputArmLengthError,
        slotEndpointMargin: state.slotEndpointMargin,
        slotRadiusError: state.slotRadiusError,
        slidingSpeed: state.slotSlidingSpeed,
      },
      fixedPivots: {
        inputPivot: inputPivot.clone(),
        outputPivot: outputPivot.clone(),
      },
    };
    root.userData.kinematics = state;
  };
  const sweptBounds = new THREE.Box3();
  for (let i = 0; i <= 64; i += 1) {
    update(cyclePeriod * i / 64);
    root.updateMatrixWorld(true);
    sweptBounds.union(new THREE.Box3().setFromObject(root));
  }
  root.userData.cameraFitBounds = sweptBounds.expandByScalar(0.02);
  update(0);
  return finish(root, update, new THREE.Vector3(1.2, 0.6, 12));
}

export function createAuthoredLinkageMovement(movement) {
  switch (movement.id) {
    case 144: return lazyTongsRectilinearAmplifier();
    case 145: return rockingBeamTieRodFlywheelMotion();
    case 203: return curvedSlottedArmVariableVibration();
    default: return null;
  }
}
