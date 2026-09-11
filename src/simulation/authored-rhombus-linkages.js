import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeDynamicLink,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongX(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongY(radius, length, material, segments = 32) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
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

function makeSplitGuide({
  axis,
  clearance,
  depth,
  length,
  material,
  rodRadius,
  role,
  thickness,
}) {
  const guide = new THREE.Group();
  guide.userData.axis = axis.clone();
  guide.userData.innerHalfGap = rodRadius + clearance;
  guide.userData.role = role;
  const offset = rodRadius + clearance + thickness / 2;
  const horizontal = Math.abs(axis.x) > 0.5;
  const jawGeometry = horizontal
    ? new THREE.BoxGeometry(length, thickness, depth)
    : new THREE.BoxGeometry(thickness, length, depth);
  const jaws = [-1, 1].map((sign, index) => {
    const jaw = new THREE.Mesh(jawGeometry, material);
    if (horizontal) jaw.position.y = sign * offset;
    else jaw.position.x = sign * offset;
    jaw.userData.index = index;
    jaw.userData.role = `${role}-jaw`;
    guide.add(jaw);
    return jaw;
  });
  guide.userData.jaws = jaws;
  return guide;
}

function makeSlidingRod({
  axis,
  colorMaterial,
  indexMaterial,
  length,
  outwardSign,
  rodRadius,
  role,
}) {
  const rod = new THREE.Group();
  rod.userData.axis = axis.clone();
  rod.userData.outwardDirection = axis.clone().multiplyScalar(outwardSign);
  rod.userData.role = role;
  const body = Math.abs(axis.x) > 0.5
    ? cylinderAlongX(rodRadius, length, colorMaterial, 36)
    : cylinderAlongY(rodRadius, length, colorMaterial, 36);
  body.position.copy(rod.userData.outwardDirection)
    .multiplyScalar(length / 2);
  body.userData.role = `${role}-straight-body`;
  const indexLength = 0.11;
  const index = Math.abs(axis.x) > 0.5
    ? cylinderAlongX(rodRadius + 0.024, indexLength, indexMaterial, 36)
    : cylinderAlongY(rodRadius + 0.024, indexLength, indexMaterial, 36);
  index.position.copy(rod.userData.outwardDirection)
    .multiplyScalar(length - 0.16);
  index.userData.role = `${role}-white-translation-index`;
  const endCap = new THREE.Mesh(
    new THREE.SphereGeometry(rodRadius, 24, 16),
    colorMaterial,
  );
  endCap.position.copy(rod.userData.outwardDirection)
    .multiplyScalar(length);
  endCap.userData.role = `${role}-outer-rounded-end`;
  rod.add(body, endCap, index);
  rod.userData.blocks = { body, endCap, index };
  return rod;
}

function makeCornerPin({
  accentMaterial,
  darkMaterial,
  pinRadius,
  pinSpan,
  role,
  whiteMaterial,
}) {
  const pin = new THREE.Group();
  pin.userData.axis = Z_AXIS.clone();
  pin.userData.role = role;
  const shaft = cylinderAlongZ(pinRadius, pinSpan, darkMaterial, 32);
  shaft.userData.role = `${role}-through-shaft`;
  const frontRing = new THREE.Mesh(
    new THREE.TorusGeometry(pinRadius * 1.48, pinRadius * 0.22, 10, 36),
    accentMaterial,
  );
  frontRing.position.z = pinSpan / 2 + 0.018;
  frontRing.userData.role = `${role}-front-retaining-ring`;
  const frontIndex = new THREE.Mesh(
    new THREE.SphereGeometry(pinRadius * 0.48, 22, 14),
    whiteMaterial,
  );
  frontIndex.position.z = pinSpan / 2 + 0.028;
  frontIndex.userData.role = `${role}-white-motion-index`;
  pin.add(frontIndex, frontRing, shaft);
  pin.userData.blocks = { frontIndex, frontRing, shaft };
  return pin;
}

function rhombusRectilinearConverter(movement) {
  const root = new THREE.Group();

  // The public-domain engraving is slightly hand-drawn and asymmetric. These
  // measurements idealize its four pin centers to one exact rhombus while
  // keeping every ideal point inside the stated raster uncertainty.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.016;
  const sourceCenter = new THREE.Vector2(267, 274);
  const sourceHorizontalHalfSpanPixels = 114;
  const sourceVerticalHalfSpanPixels = 149;
  const sourceHorizontalHalfSpan = sourceHorizontalHalfSpanPixels
    * sourceScale;
  const sourceVerticalHalfSpan = sourceVerticalHalfSpanPixels * sourceScale;
  const linkLength = Math.hypot(
    sourceHorizontalHalfSpan,
    sourceVerticalHalfSpan,
  );
  const inputAmplitude = 0.54;
  const minimumHorizontalHalfSpan = sourceHorizontalHalfSpan - inputAmplitude;
  const maximumHorizontalHalfSpan = sourceHorizontalHalfSpan + inputAmplitude;
  const maximumVerticalHalfSpan = Math.sqrt(
    linkLength ** 2 - minimumHorizontalHalfSpan ** 2,
  );
  const minimumVerticalHalfSpan = Math.sqrt(
    linkLength ** 2 - maximumHorizontalHalfSpan ** 2,
  );
  const inputIndividualStroke = maximumHorizontalHalfSpan
    - minimumHorizontalHalfSpan;
  const outputIndividualStroke = maximumVerticalHalfSpan
    - minimumVerticalHalfSpan;
  const sourceCycleAngle = Math.PI / 2;
  const cyclePeriod = 8;
  const cycleAngularSpeed = FULL_TURN / cyclePeriod;

  const rodRadius = 0.1;
  const horizontalRodLength = 1.9;
  const verticalRodLength = 2.02;
  const horizontalGuideDistance = 2.8;
  const verticalGuideDistance = 3.472;
  const guideLength = 0.48;
  const guideDepth = 0.5;
  const guideJawThickness = 0.17;
  const guideClearance = 0.025;
  const frontLinkPlaneZ = 0.18;
  const rearLinkPlaneZ = -0.18;
  const linkThickness = 0.17;
  const linkDepth = 0.2;
  const pinRadius = 0.12;
  const pinSpan = 0.86;
  const reversalTolerance = 1e-10;

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

  const linkDefinitions = [
    { id: 'A-to-C', start: 'A', end: 'C', planeZ: frontLinkPlaneZ },
    { id: 'C-to-B', start: 'C', end: 'B', planeZ: rearLinkPlaneZ },
    { id: 'B-to-D', start: 'B', end: 'D', planeZ: frontLinkPlaneZ },
    { id: 'D-to-A', start: 'D', end: 'A', planeZ: rearLinkPlaneZ },
  ];

  const stateAtCycleAngle = (cycleAngle) => {
    const cosine = Math.cos(cycleAngle);
    const sine = Math.sin(cycleAngle);
    const horizontalHalfSpan = sourceHorizontalHalfSpan
      + inputAmplitude * cosine;
    const horizontalHalfSpanPerRadian = -inputAmplitude * sine;
    const horizontalHalfSpanSecondPerRadian = -inputAmplitude * cosine;
    const horizontalHalfSpanSpeed = horizontalHalfSpanPerRadian
      * cycleAngularSpeed;
    const horizontalHalfSpanAcceleration =
      horizontalHalfSpanSecondPerRadian * cycleAngularSpeed ** 2;
    const verticalHalfSpan = Math.sqrt(
      linkLength ** 2 - horizontalHalfSpan ** 2,
    );
    const verticalHalfSpanPerRadian = -horizontalHalfSpan
      * horizontalHalfSpanPerRadian / verticalHalfSpan;
    const verticalHalfSpanSecondPerRadian = -(
      horizontalHalfSpanPerRadian ** 2
        + horizontalHalfSpan * horizontalHalfSpanSecondPerRadian
        + verticalHalfSpanPerRadian ** 2
    ) / verticalHalfSpan;
    const verticalHalfSpanSpeed = verticalHalfSpanPerRadian
      * cycleAngularSpeed;
    const verticalHalfSpanAcceleration =
      verticalHalfSpanSecondPerRadian * cycleAngularSpeed ** 2;

    const points = {
      A: pointState(
        -horizontalHalfSpan,
        0,
        -horizontalHalfSpanSpeed,
        0,
        -horizontalHalfSpanAcceleration,
        0,
      ),
      B: pointState(
        horizontalHalfSpan,
        0,
        horizontalHalfSpanSpeed,
        0,
        horizontalHalfSpanAcceleration,
        0,
      ),
      C: pointState(
        0,
        verticalHalfSpan,
        0,
        verticalHalfSpanSpeed,
        0,
        verticalHalfSpanAcceleration,
      ),
      D: pointState(
        0,
        -verticalHalfSpan,
        0,
        -verticalHalfSpanSpeed,
        0,
        -verticalHalfSpanAcceleration,
      ),
    };
    const links = linkDefinitions.map((definition) => {
      const start = points[definition.start];
      const end = points[definition.end];
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
      const crossVelocity = vector.x * relativeVelocity.y
        - vector.y * relativeVelocity.x;
      const crossAcceleration = vector.x * relativeAcceleration.y
        - vector.y * relativeAcceleration.x;
      const radiusSquared = vector.lengthSq();
      const angularSpeed = crossVelocity / radiusSquared;
      const angularAcceleration = crossAcceleration / radiusSquared
        - 2 * vector.dot(relativeVelocity) * crossVelocity
          / radiusSquared ** 2;
      return {
        ...definition,
        angularAcceleration,
        angularSpeed,
        end,
        length,
        lengthAcceleration,
        lengthAccelerationInvariantError: relativeVelocity.lengthSq()
          + vector.dot(relativeAcceleration),
        lengthError: length - linkLength,
        lengthRate,
        midpoint: start.position.clone().add(end.position)
          .multiplyScalar(0.5),
        relativeAcceleration,
        relativeVelocity,
        start,
        vector,
      };
    });
    const atReversal = Math.abs(horizontalHalfSpanSpeed)
      < reversalTolerance;
    let stage;
    if (atReversal) {
      stage = Math.abs(
        horizontalHalfSpan - minimumHorizontalHalfSpan,
      ) < Math.abs(horizontalHalfSpan - maximumHorizontalHalfSpan)
        ? 'A-and-B-together-C-and-D-apart-reversal'
        : 'A-and-B-apart-C-and-D-together-reversal';
    } else {
      stage = horizontalHalfSpanSpeed < 0
        ? 'A-and-B-moving-together-C-and-D-moving-apart'
        : 'A-and-B-moving-apart-C-and-D-moving-together';
    }
    const horizontalGuideCoverage = horizontalRodLength
      - (horizontalGuideDistance + guideLength / 2 - horizontalHalfSpan);
    const verticalGuideCoverage = verticalRodLength
      - (verticalGuideDistance + guideLength / 2 - verticalHalfSpan);
    return {
      atReversal,
      cycleAngle,
      cycleAngularSpeed,
      cyclePhase: THREE.MathUtils.euclideanModulo(
        cycleAngle - sourceCycleAngle,
        FULL_TURN,
      ) / FULL_TURN,
      horizontalGuideCoverage,
      horizontalHalfSpan,
      horizontalHalfSpanAcceleration,
      horizontalHalfSpanPerRadian,
      horizontalHalfSpanSecondPerRadian,
      horizontalHalfSpanSpeed,
      horizontalSeparation: 2 * horizontalHalfSpan,
      horizontalSeparationAcceleration: 2 * horizontalHalfSpanAcceleration,
      horizontalSeparationSpeed: 2 * horizontalHalfSpanSpeed,
      instantaneousSeparationRatio: -horizontalHalfSpan / verticalHalfSpan,
      links,
      maximumLinkLengthAccelerationError: Math.max(
        ...links.map((link) => Math.abs(link.lengthAcceleration)),
      ),
      maximumLinkLengthError: Math.max(
        ...links.map((link) => Math.abs(link.lengthError)),
      ),
      maximumLinkLengthRateError: Math.max(
        ...links.map((link) => Math.abs(link.lengthRate)),
      ),
      normalizedCycleAngle: THREE.MathUtils.euclideanModulo(
        cycleAngle,
        FULL_TURN,
      ),
      points,
      positionConstraintError: horizontalHalfSpan ** 2
        + verticalHalfSpan ** 2 - linkLength ** 2,
      stage,
      symmetryAccelerationError: Math.max(
        points.A.acceleration.clone().add(points.B.acceleration).length(),
        points.C.acceleration.clone().add(points.D.acceleration).length(),
      ),
      symmetryPositionError: Math.max(
        points.A.position.clone().add(points.B.position).length(),
        points.C.position.clone().add(points.D.position).length(),
      ),
      symmetryVelocityError: Math.max(
        points.A.velocity.clone().add(points.B.velocity).length(),
        points.C.velocity.clone().add(points.D.velocity).length(),
      ),
      velocityConstraintError: horizontalHalfSpan
        * horizontalHalfSpanSpeed
        + verticalHalfSpan * verticalHalfSpanSpeed,
      verticalGuideCoverage,
      verticalHalfSpan,
      verticalHalfSpanAcceleration,
      verticalHalfSpanPerRadian,
      verticalHalfSpanSecondPerRadian,
      verticalHalfSpanSpeed,
      verticalSeparation: 2 * verticalHalfSpan,
      verticalSeparationAcceleration: 2 * verticalHalfSpanAcceleration,
      verticalSeparationSpeed: 2 * verticalHalfSpanSpeed,
    };
  };
  const stateAtTime = (time) => stateAtCycleAngle(
    sourceCycleAngle + cycleAngularSpeed * time,
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const frontLinkMaterial = PALETTE.accent;
  const rearLinkMaterial = PALETTE.brass;
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.5,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.17,
    roughness: 0.53,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const linkage = new THREE.Group();
  linkage.userData.role = 'four-equal-link-rhombus';
  root.add(linkage);
  const linkMeshes = linkDefinitions.map((definition, index) => {
    const link = makeDynamicLink({
      color: definition.planeZ > 0
        ? frontLinkMaterial
        : rearLinkMaterial,
      depth: linkDepth,
      jointRadius: 0.001,
      thickness: linkThickness,
    });
    link.userData.index = index;
    link.userData.nominalLength = linkLength;
    link.userData.planeZ = definition.planeZ;
    link.userData.role = `rigid-rhombus-link-${definition.id}`;
    linkage.add(link);
    return link;
  });

  const rods = {
    A: makeSlidingRod({
      axis: X_AXIS,
      colorMaterial: driverMaterial,
      indexMaterial: whiteMaterial,
      length: horizontalRodLength,
      outwardSign: -1,
      rodRadius,
      role: 'input-slider-A-moving-on-horizontal-axis',
    }),
    B: makeSlidingRod({
      axis: X_AXIS,
      colorMaterial: driverMaterial,
      indexMaterial: whiteMaterial,
      length: horizontalRodLength,
      outwardSign: 1,
      rodRadius,
      role: 'input-slider-B-moving-on-horizontal-axis',
    }),
    C: makeSlidingRod({
      axis: Y_AXIS,
      colorMaterial: drivenMaterial,
      indexMaterial: whiteMaterial,
      length: verticalRodLength,
      outwardSign: 1,
      rodRadius,
      role: 'output-slider-C-moving-on-vertical-axis',
    }),
    D: makeSlidingRod({
      axis: Y_AXIS,
      colorMaterial: drivenMaterial,
      indexMaterial: whiteMaterial,
      length: verticalRodLength,
      outwardSign: -1,
      rodRadius,
      role: 'output-slider-D-moving-on-vertical-axis',
    }),
  };
  for (const rod of Object.values(rods)) root.add(rod);

  const pins = Object.fromEntries(['A', 'B', 'C', 'D'].map((label) => {
    const pin = makeCornerPin({
      accentMaterial,
      darkMaterial,
      pinRadius,
      pinSpan,
      role: `shared-through-pin-${label}`,
      whiteMaterial,
    });
    root.add(pin);
    return [label, pin];
  }));

  const guides = {
    A: makeSplitGuide({
      axis: X_AXIS,
      clearance: guideClearance,
      depth: guideDepth,
      length: guideLength,
      material: frameMaterial,
      rodRadius,
      role: 'fixed-horizontal-split-guide-for-A',
      thickness: guideJawThickness,
    }),
    B: makeSplitGuide({
      axis: X_AXIS,
      clearance: guideClearance,
      depth: guideDepth,
      length: guideLength,
      material: frameMaterial,
      rodRadius,
      role: 'fixed-horizontal-split-guide-for-B',
      thickness: guideJawThickness,
    }),
    C: makeSplitGuide({
      axis: Y_AXIS,
      clearance: guideClearance,
      depth: guideDepth,
      length: guideLength,
      material: frameMaterial,
      rodRadius,
      role: 'fixed-vertical-split-guide-for-C',
      thickness: guideJawThickness,
    }),
    D: makeSplitGuide({
      axis: Y_AXIS,
      clearance: guideClearance,
      depth: guideDepth,
      length: guideLength,
      material: frameMaterial,
      rodRadius,
      role: 'fixed-vertical-split-guide-for-D',
      thickness: guideJawThickness,
    }),
  };
  guides.A.position.x = -horizontalGuideDistance;
  guides.B.position.x = horizontalGuideDistance;
  guides.C.position.y = verticalGuideDistance;
  guides.D.position.y = -verticalGuideDistance;
  for (const guide of Object.values(guides)) root.add(guide);

  const backingPlaneZ = -0.72;
  const horizontalBackingRail = makeBeam(
    new THREE.Vector3(-3.18, 0, backingPlaneZ),
    new THREE.Vector3(3.18, 0, backingPlaneZ),
    { color: PALETTE.frame, depth: 0.17, thickness: 0.13 },
  );
  horizontalBackingRail.userData.role =
    'fixed-horizontal-backing-rail-for-A-and-B-guides';
  const verticalBackingRail = makeBeam(
    new THREE.Vector3(0, -3.82, backingPlaneZ),
    new THREE.Vector3(0, 3.82, backingPlaneZ),
    { color: PALETTE.frame, depth: 0.17, thickness: 0.13 },
  );
  verticalBackingRail.userData.role =
    'fixed-vertical-backing-rail-for-C-and-D-guides';
  root.add(horizontalBackingRail, verticalBackingRail);
  const guideBrackets = Object.entries(guides).map(([label, guide]) => {
    const bracket = makeBeam(
      guide.position.clone().setZ(backingPlaneZ),
      guide.position.clone().setZ(-guideDepth / 2),
      { color: PALETTE.frame, depth: 0.14, thickness: 0.12 },
    );
    bracket.userData.guide = label;
    bracket.userData.role = `fixed-rear-bracket-for-guide-${label}`;
    root.add(bracket);
    return bracket;
  });
  const baseRail = makeBeam(
    new THREE.Vector3(-3.25, -4.08, backingPlaneZ),
    new THREE.Vector3(3.25, -4.08, backingPlaneZ),
    { color: PALETTE.frame, depth: 0.25, thickness: 0.18 },
  );
  baseRail.userData.role = 'fixed-base-for-crossed-guide-frame';
  const baseStem = makeBeam(
    new THREE.Vector3(0, -4.08, backingPlaneZ),
    new THREE.Vector3(0, -3.76, backingPlaneZ),
    { color: PALETTE.frame, depth: 0.2, thickness: 0.16 },
  );
  baseStem.userData.role = 'fixed-stem-between-guide-frame-and-base';
  root.add(baseRail, baseStem);

  const sourcePointToModel = ({ x, y }, z = 0) => new THREE.Vector3(
    (x - sourceCenter.x) * sourceScale,
    (sourceCenter.y - y) * sourceScale,
    z,
  );
  const sourceMeasuredJoints = {
    A: { x: 154, y: 278 },
    B: { x: 382, y: 274 },
    C: { x: 266, y: 125 },
    D: { x: 260, y: 423 },
  };
  const sourceIdealJoints = {
    A: new THREE.Vector2(
      sourceCenter.x - sourceHorizontalHalfSpanPixels,
      sourceCenter.y,
    ),
    B: new THREE.Vector2(
      sourceCenter.x + sourceHorizontalHalfSpanPixels,
      sourceCenter.y,
    ),
    C: new THREE.Vector2(
      sourceCenter.x,
      sourceCenter.y - sourceVerticalHalfSpanPixels,
    ),
    D: new THREE.Vector2(
      sourceCenter.x,
      sourceCenter.y + sourceVerticalHalfSpanPixels,
    ),
  };
  const sourceIdealizationPixelErrors = Object.fromEntries(
    Object.entries(sourceMeasuredJoints).map(([label, point]) => [
      label,
      new THREE.Vector2(point.x, point.y)
        .distanceTo(sourceIdealJoints[label]),
    ]),
  );

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    baseRail,
    baseStem,
    guideBrackets,
    guides,
    horizontalBackingRail,
    linkage,
    linkMeshes,
    pins,
    rods,
    verticalBackingRail,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.42, -4.34, -1.12),
    new THREE.Vector3(4.42, 4.78, 1.18),
  );
  root.userData.geometry = {
    cyclePeriod,
    frontLinkPlaneZ,
    guideClearance,
    guideDepth,
    guideJawThickness,
    guideLength,
    horizontalGuideDistance,
    horizontalRodLength,
    inputAmplitude,
    inputIndividualStroke,
    linkDepth,
    linkLength,
    linkThickness,
    maximumHorizontalHalfSpan,
    maximumVerticalHalfSpan,
    minimumHorizontalHalfSpan,
    minimumVerticalHalfSpan,
    outputIndividualStroke,
    pinRadius,
    pinSpan,
    rearLinkPlaneZ,
    rodRadius,
    sourceCenter: sourceCenter.clone(),
    sourceHorizontalHalfSpan,
    sourceHorizontalHalfSpanPixels,
    sourceScale,
    sourceVerticalHalfSpan,
    sourceVerticalHalfSpanPixels,
    verticalGuideDistance,
    verticalRodLength,
  };
  root.userData.mechanism =
    'four-equal-rigid-links-form-one-pin-jointed-rhombus-between-opposed-horizontal-sliders-A-and-B-and-opposed-vertical-sliders-C-and-D; symmetric-horizontal-inward-motion-forces-symmetric-vertical-outward-motion-by-x-squared-plus-y-squared-equals-link-length-squared';
  root.userData.movement = movement;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason:
      'The official Movement 273 page marks its animation control unavailable; the one-degree-of-freedom rhombus constraint and a smooth reciprocal demonstration were reconstructed independently from the public-domain engraving and description.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate273: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'four equal side links, four shared corner pins, two opposed horizontal sliders A and B, two opposed vertical sliders C and D, and four fixed rectilinear guides',
      measurementUncertaintyPixels: 8,
      officialAnimationAvailable: false,
      rasterCenter: { x: sourceCenter.x, y: sourceCenter.y },
      rasterGuideCenters: {
        A: { x: 95, y: 279 },
        B: { x: 445, y: 274 },
        C: { x: 267, y: 52 },
        D: { x: 259, y: 486 },
      },
      rasterJointCenters: sourceMeasuredJoints,
      rasterOuterRodEnds: {
        A: { x: 60, y: 279 },
        B: { x: 485, y: 274 },
        C: { x: 267, y: 16 },
        D: { x: 259, y: 520 },
      },
      sourceHorizontalHalfSpanPixels,
      sourceIdealizationPixelErrors,
      sourceVerticalHalfSpanPixels,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 69,
      edition: 21,
      illustrationPage: 68,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCycleAngle = stateAtCycleAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cycleAngularSpeed,
    cyclePeriod,
    sourceCycleAngle,
  };
  root.userData.transmission = {
    constraintLaw: 'horizontalHalfSpan^2 + verticalHalfSpan^2 = linkLength^2',
    cyclePeriod,
    horizontalInputSliders: ['A', 'B'],
    inputSeparationStroke: 2 * inputIndividualStroke,
    instantaneousSeparationRatio:
      'd(vertical separation)/d(horizontal separation) = -horizontalHalfSpan/verticalHalfSpan',
    outputSeparationStroke: 2 * outputIndividualStroke,
    stateAtCycleAngle,
    verticalOutputSliders: ['C', 'D'],
  };

  const update = (time) => {
    const state = stateAtTime(time);
    for (const label of ['A', 'B', 'C', 'D']) {
      rods[label].position.copy(state.points[label].position);
      rods[label].userData.velocity = state.points[label].velocity.clone();
      pins[label].position.copy(state.points[label].position);
      pins[label].userData.velocity = state.points[label].velocity.clone();
    }
    state.links.forEach((linkState, index) => {
      const start = linkState.start.position.clone();
      const end = linkState.end.position.clone();
      start.z = linkState.planeZ;
      end.z = linkState.planeZ;
      linkMeshes[index].userData.setEndpoints(start, end);
      linkMeshes[index].userData.angularSpeed = linkState.angularSpeed;
    });
    root.userData.contacts = {
      cornerPins: Object.fromEntries(state.links.map((link) => [
        link.id,
        {
          end: link.end.position.clone(),
          lengthAccelerationError: link.lengthAcceleration,
          lengthError: link.lengthError,
          lengthRateError: link.lengthRate,
          start: link.start.position.clone(),
        },
      ])),
      sliderGuides: {
        A: {
          axis: X_AXIS.clone(),
          offAxisError: Math.hypot(
            state.points.A.position.y,
            state.points.A.position.z,
          ),
          radialClearance: guideClearance,
          rodCoverageBeyondGuide: state.horizontalGuideCoverage,
        },
        B: {
          axis: X_AXIS.clone(),
          offAxisError: Math.hypot(
            state.points.B.position.y,
            state.points.B.position.z,
          ),
          radialClearance: guideClearance,
          rodCoverageBeyondGuide: state.horizontalGuideCoverage,
        },
        C: {
          axis: Y_AXIS.clone(),
          offAxisError: Math.hypot(
            state.points.C.position.x,
            state.points.C.position.z,
          ),
          radialClearance: guideClearance,
          rodCoverageBeyondGuide: state.verticalGuideCoverage,
        },
        D: {
          axis: Y_AXIS.clone(),
          offAxisError: Math.hypot(
            state.points.D.position.x,
            state.points.D.position.z,
          ),
          radialClearance: guideClearance,
          rodCoverageBeyondGuide: state.verticalGuideCoverage,
        },
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(5.8, 4.5, 10.8),
  };
}

export function createAuthoredRhombusLinkageMovement(movement) {
  if (movement.id !== 273) return null;
  const result = rhombusRectilinearConverter(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
