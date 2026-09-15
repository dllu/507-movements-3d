import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevel = 0.012) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevel > 0,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 24,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function makeClockwiseVerticalCapsulePath(
  centerX,
  lowerCenterY,
  upperCenterY,
  radius,
) {
  const path = new THREE.Path();
  path.moveTo(centerX - radius, lowerCenterY);
  path.lineTo(centerX - radius, upperCenterY);
  path.absarc(
    centerX,
    upperCenterY,
    radius,
    Math.PI,
    0,
    true,
  );
  path.lineTo(centerX + radius, lowerCenterY);
  path.absarc(
    centerX,
    lowerCenterY,
    radius,
    0,
    -Math.PI,
    true,
  );
  path.closePath();
  return path;
}

function makeClockwiseRoundedRectanglePath(
  minimumX,
  minimumY,
  maximumX,
  maximumY,
  radius,
) {
  const path = new THREE.Path();
  path.moveTo(minimumX, minimumY + radius);
  path.lineTo(minimumX, maximumY - radius);
  path.quadraticCurveTo(
    minimumX,
    maximumY,
    minimumX + radius,
    maximumY,
  );
  path.lineTo(maximumX - radius, maximumY);
  path.quadraticCurveTo(
    maximumX,
    maximumY,
    maximumX,
    maximumY - radius,
  );
  path.lineTo(maximumX, minimumY + radius);
  path.quadraticCurveTo(
    maximumX,
    minimumY,
    maximumX - radius,
    minimumY,
  );
  path.lineTo(minimumX + radius, minimumY);
  path.quadraticCurveTo(
    minimumX,
    minimumY,
    minimumX,
    minimumY + radius,
  );
  path.closePath();
  return path;
}

function makeSourceProportionedFrameShape(sourceScale) {
  const shape = new THREE.Shape();
  const scaled = (value) => value * sourceScale;

  // This outline is independently reconstructed from the fixed geometry in
  // the reference animation.  Its three openings are real cut-outs: the
  // crank-shaft bore, the piston guide, and the lightening window.
  shape.moveTo(scaled(-4), scaled(-19));
  shape.lineTo(scaled(12.002443), scaled(-19));
  shape.lineTo(scaled(12.002443), scaled(-18));
  shape.absarc(
    scaled(12.002443),
    scaled(-16),
    scaled(2),
    4.712389,
    3.172848,
    true,
  );
  shape.lineTo(scaled(8.999023), scaled(16.0625));
  shape.absarc(
    scaled(7),
    scaled(16),
    scaled(2),
    0.031255,
    3.038214,
    false,
  );
  shape.lineTo(scaled(3.375809), scaled(0.448403));
  shape.absarc(
    scaled(2.878478),
    scaled(0.5),
    scaled(0.5),
    6.179807,
    4.712389,
    true,
  );
  shape.lineTo(scaled(2.44949), 0);
  shape.absarc(
    scaled(2.44949),
    scaled(0.5),
    scaled(0.5),
    4.712389,
    3.342951,
    true,
  );
  shape.absarc(
    0,
    0,
    scaled(2),
    0.201358,
    Math.PI,
    false,
  );
  shape.lineTo(scaled(-2), scaled(-16));
  shape.absarc(
    scaled(-4),
    scaled(-16),
    scaled(2),
    0,
    -Math.PI / 2,
    true,
  );
  shape.lineTo(scaled(-4), scaled(-19));
  shape.closePath();

  const shaftBore = new THREE.Path();
  shaftBore.absarc(0, 0, scaled(1), 0, FULL_TURN, true);
  shaftBore.closePath();
  const pistonGuide = makeClockwiseVerticalCapsulePath(
    scaled(7),
    scaled(-16),
    scaled(16),
    scaled(0.5),
  );
  const lighteningWindow = makeClockwiseRoundedRectanglePath(
    scaled(0.25),
    scaled(-16),
    scaled(4.25),
    scaled(-3),
    scaled(0.5),
  );
  shape.holes.push(shaftBore, pistonGuide, lighteningWindow);
  return shape;
}

function makeCapsuleOutlineCurve(
  centerX,
  lowerCenterY,
  upperCenterY,
  radius,
  z,
) {
  const points = [];
  const arcSegments = 24;
  for (let index = 0; index <= arcSegments; index += 1) {
    const angle = Math.PI - Math.PI * index / arcSegments;
    points.push(new THREE.Vector3(
      centerX + radius * Math.cos(angle),
      upperCenterY + radius * Math.sin(angle),
      z,
    ));
  }
  for (let index = 0; index <= arcSegments; index += 1) {
    const angle = -Math.PI * index / arcSegments;
    points.push(new THREE.Vector3(
      centerX + radius * Math.cos(angle),
      lowerCenterY + radius * Math.sin(angle),
      z,
    ));
  }
  return new THREE.CatmullRomCurve3(points, true, 'centripetal');
}

function makeCrankAssembly({
  crankPlaneZ,
  crankRadius,
  depth,
  drivenMaterial,
  darkMaterial,
  whiteMaterial,
}) {
  const crank = new THREE.Group();
  crank.position.z = crankPlaneZ;
  crank.userData.axis = Z_AXIS.clone();
  crank.userData.role = 'single-output-crank-rotor';

  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.30, depth),
    drivenMaterial,
  );
  arm.position.x = -crankRadius / 2;
  arm.userData.role = 'output-crank-arm';
  const fixedBoss = cylinderAlongZ(0.275, depth, drivenMaterial, 40);
  fixedBoss.userData.role = 'output-crank-fixed-center-boss';
  const movingBoss = cylinderAlongZ(0.14, depth, drivenMaterial, 32);
  movingBoss.position.x = -crankRadius;
  movingBoss.userData.role = 'output-crank-pin-boss';
  const fixedEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.038, 8, 40),
    darkMaterial,
  );
  fixedEye.position.z = depth / 2 + 0.012;
  fixedEye.userData.role = 'output-crank-center-eye';
  const movingEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.09, 0.025, 8, 32),
    darkMaterial,
  );
  movingEye.position.set(-crankRadius, 0, depth / 2 + 0.012);
  movingEye.userData.role = 'output-crank-pin-eye';
  const rotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 0.052, 0.034),
    whiteMaterial,
  );
  rotationIndex.position.set(-0.19, 0, depth / 2 + 0.045);
  rotationIndex.userData.role = 'white-index-fixed-to-output-crank';
  const crankPinAnchor = new THREE.Object3D();
  crankPinAnchor.position.x = -crankRadius;
  crankPinAnchor.userData.role = 'analytic-output-crank-pin-anchor';
  crank.add(
    arm,
    fixedBoss,
    movingBoss,
    fixedEye,
    movingEye,
    rotationIndex,
    crankPinAnchor,
  );
  return {
    arm,
    crank,
    crankPinAnchor,
    fixedBoss,
    movingBoss,
    rotationIndex,
  };
}

function makeConnectingRod({
  darkMaterial,
  depth,
  driverMaterial,
  rodLength,
  rodPlaneZ,
}) {
  const rod = new THREE.Group();
  rod.position.z = rodPlaneZ;
  rod.userData.role = 'single-rigid-piston-connecting-rod';
  rod.userData.length = rodLength;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(rodLength, 0.15, depth),
    driverMaterial,
  );
  body.position.x = rodLength / 2;
  body.userData.role = 'piston-connecting-rod-shank';
  const crankEyeBody = cylinderAlongZ(0.20, depth, driverMaterial, 36);
  crankEyeBody.userData.role = 'connecting-rod-crank-eye-body';
  const sliderEyeBody = cylinderAlongZ(0.12, depth, driverMaterial, 32);
  sliderEyeBody.position.x = rodLength;
  sliderEyeBody.userData.role = 'connecting-rod-slider-eye-body';
  const crankEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.145, 0.030, 8, 36),
    darkMaterial,
  );
  crankEye.position.z = depth / 2 + 0.012;
  crankEye.userData.role = 'connecting-rod-crank-eye';
  const sliderEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.082, 0.022, 8, 32),
    darkMaterial,
  );
  sliderEye.position.set(rodLength, 0, depth / 2 + 0.012);
  sliderEye.userData.role = 'connecting-rod-slider-eye';
  const rodCrankEyeAnchor = new THREE.Object3D();
  rodCrankEyeAnchor.userData.role = 'analytic-rod-crank-eye-anchor';
  const rodSliderEyeAnchor = new THREE.Object3D();
  rodSliderEyeAnchor.position.x = rodLength;
  rodSliderEyeAnchor.userData.role = 'analytic-rod-slider-eye-anchor';
  rod.add(
    body,
    crankEyeBody,
    sliderEyeBody,
    crankEye,
    sliderEye,
    rodCrankEyeAnchor,
    rodSliderEyeAnchor,
  );
  return {
    body,
    crankEye,
    rod,
    rodCrankEyeAnchor,
    rodSliderEyeAnchor,
    sliderEye,
  };
}

function oneRevolutionPerPistonStrokeCrank() {
  const root = new THREE.Group();

  // Executable dimensions from the reference construction.  The equality
  // L = g + r is the essential topology: it makes the two circle/guide-line
  // solutions coalesce at the crank's leftmost pose, allowing a continuous
  // transfer from one solution branch to the other.
  const sourceAnimationScale = 0.20;
  const sourceAnimationCrankRadius = 5;
  const sourceAnimationGuideOffset = 7;
  const sourceAnimationRodLength = 12;
  const sourceAnimationGuideHalfLength = 16;
  const crankRadius = sourceAnimationCrankRadius * sourceAnimationScale;
  const guideOffset = sourceAnimationGuideOffset * sourceAnimationScale;
  const rodLength = sourceAnimationRodLength * sourceAnimationScale;
  const guideHalfLength = sourceAnimationGuideHalfLength
    * sourceAnimationScale;
  const guideSlotRadius = 0.5 * sourceAnimationScale;
  const crankTurnsPerSecond = 0.25;
  const crankRevolutionsPerPistonCycle = 2;
  const pistonStrokesPerCycle = 2;
  const cyclePeriod = crankRevolutionsPerPistonCycle
    / crankTurnsPerSecond;

  // Raster landmarks in Brown's engraving establish the initial visible
  // phase only; the executable closure comes from the dimensioned geometry
  // above because the engraving itself is not drawn to that construction.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterCrankCenter = new THREE.Vector2(199, 235);
  const sourceRasterCrankPin = new THREE.Vector2(246, 296);
  const sourceRasterSliderPin = new THREE.Vector2(354, 419);
  const sourcePoseCrankDirection = new THREE.Vector2(
    sourceRasterCrankPin.x - sourceRasterCrankCenter.x,
    sourceRasterCrankCenter.y - sourceRasterCrankPin.y,
  ).normalize();
  const sourcePoseCrankPinAngle = Math.atan2(
    sourcePoseCrankDirection.y,
    sourcePoseCrankDirection.x,
  );
  const sourcePoseTurn = positiveModulo(
    (sourcePoseCrankPinAngle - Math.PI) / FULL_TURN,
    1,
  );

  const sourceAnimationCanvasWidth = 525;
  const sourceAnimationCanvasHeight = 525;
  const sourceAnimationViewMinimum = new THREE.Vector2(
    -14.998778,
    -19.531094,
  );
  const sourceAnimationViewWidth = 38;
  const sourceAnimationViewHeight = 38;
  const modelPointToAnimationRaster = (point) => new THREE.Vector2(
    (
      point.x / sourceAnimationScale
        - sourceAnimationViewMinimum.x
    ) * sourceAnimationCanvasWidth / sourceAnimationViewWidth,
    sourceAnimationCanvasHeight - (
      point.y / sourceAnimationScale
        - sourceAnimationViewMinimum.y
    ) * sourceAnimationCanvasHeight / sourceAnimationViewHeight,
  );

  const frameDepth = 0.34;
  const frameCenterZ = -0.29;
  const crankPlaneZ = 0.08;
  const crankDepth = 0.22;
  const rodPlaneZ = 0.45;
  const rodDepth = 0.15;
  const sliderBodyCenterZ = -0.03;
  const sliderBodyDepth = 0.26;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.10,
    roughness: 0.72,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.20,
    roughness: 0.50,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.08,
    roughness: 0.66,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.62,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });

  const frame = new THREE.Group();
  frame.userData.fixed = true;
  frame.userData.role = 'fixed-slotted-engine-frame';
  const frameShape = makeSourceProportionedFrameShape(
    sourceAnimationScale,
  );
  const framePlate = new THREE.Mesh(
    centeredExtrusion(frameShape, frameDepth, 0.014),
    frameMaterial,
  );
  framePlate.position.z = frameCenterZ;
  framePlate.userData.fixed = true;
  framePlate.userData.openingCount = 3;
  framePlate.userData.role = 'fixed-frame-with-three-real-openings';
  const frameFrontZ = frameCenterZ + frameDepth / 2 + 0.018;
  const guideOutline = new THREE.Mesh(
    new THREE.TubeGeometry(
      makeCapsuleOutlineCurve(
        guideOffset,
        -guideHalfLength,
        guideHalfLength,
        guideSlotRadius,
        frameFrontZ,
      ),
      144,
      0.018,
      6,
      true,
    ),
    darkMaterial,
  );
  guideOutline.userData.fixed = true;
  guideOutline.userData.role = 'fixed-piston-guide-slot-outline';
  const shaftBoreOutline = new THREE.Mesh(
    new THREE.TorusGeometry(
      sourceAnimationScale,
      0.022,
      8,
      48,
    ),
    darkMaterial,
  );
  shaftBoreOutline.position.z = frameFrontZ;
  shaftBoreOutline.userData.fixed = true;
  shaftBoreOutline.userData.role = 'fixed-crank-shaft-bore-outline';
  const crankCenterAnchor = new THREE.Object3D();
  crankCenterAnchor.userData.fixed = true;
  crankCenterAnchor.userData.role = 'analytic-fixed-crank-center';
  const guideTopAnchor = new THREE.Object3D();
  guideTopAnchor.position.set(guideOffset, guideHalfLength, 0);
  guideTopAnchor.userData.fixed = true;
  guideTopAnchor.userData.role = 'analytic-fixed-guide-top';
  const guideBottomAnchor = new THREE.Object3D();
  guideBottomAnchor.position.set(guideOffset, -guideHalfLength, 0);
  guideBottomAnchor.userData.fixed = true;
  guideBottomAnchor.userData.role = 'analytic-fixed-guide-bottom';
  frame.add(
    framePlate,
    guideOutline,
    shaftBoreOutline,
    crankCenterAnchor,
    guideTopAnchor,
    guideBottomAnchor,
  );

  const fixedShaft = cylinderAlongZ(0.16, 1.28, darkMaterial, 36);
  fixedShaft.position.z = 0.01;
  fixedShaft.userData.axis = Z_AXIS.clone();
  fixedShaft.userData.fixed = true;
  fixedShaft.userData.role = 'fixed-crank-shaft-through-frame';
  const rearShaftCollar = cylinderAlongZ(0.25, 0.12, darkMaterial, 36);
  rearShaftCollar.position.z = frameCenterZ - frameDepth / 2 - 0.06;
  rearShaftCollar.userData.fixed = true;
  rearShaftCollar.userData.role = 'fixed-rear-crank-shaft-collar';

  const crankParts = makeCrankAssembly({
    crankPlaneZ,
    crankRadius,
    depth: crankDepth,
    drivenMaterial,
    darkMaterial,
    whiteMaterial,
  });
  const rodParts = makeConnectingRod({
    darkMaterial,
    depth: rodDepth,
    driverMaterial,
    rodLength,
    rodPlaneZ,
  });

  const slider = new THREE.Group();
  slider.userData.role = 'piston-crosshead-constrained-to-vertical-slot';
  slider.userData.translationAxis = Y_AXIS.clone();
  const sliderBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.48, sliderBodyDepth),
    driverMaterial,
  );
  sliderBody.position.z = sliderBodyCenterZ;
  sliderBody.userData.role = 'piston-crosshead-shoe-inside-guide-slot';
  const sliderFace = cylinderAlongZ(0.13, 0.13, driverMaterial, 32);
  sliderFace.position.z = crankPlaneZ + 0.08;
  sliderFace.userData.role = 'piston-crosshead-front-boss';
  const sliderIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.052, 0.18, 0.032),
    whiteMaterial,
  );
  sliderIndex.position.z = crankPlaneZ + 0.16;
  sliderIndex.userData.role = 'white-index-on-piston-crosshead';
  const sliderPinAnchor = new THREE.Object3D();
  sliderPinAnchor.position.z = rodPlaneZ;
  sliderPinAnchor.userData.role = 'analytic-piston-slider-pin-anchor';
  slider.add(sliderBody, sliderFace, sliderIndex, sliderPinAnchor);

  const crankPinShaft = cylinderAlongZ(
    0.075,
    rodPlaneZ - crankPlaneZ + 0.23,
    darkMaterial,
    28,
  );
  crankPinShaft.position.z = (rodPlaneZ + crankPlaneZ) / 2;
  crankPinShaft.userData.role = 'crank-pin-joining-separated-link-planes';
  const sliderPinShaft = cylinderAlongZ(
    0.070,
    rodPlaneZ - sliderBodyCenterZ + 0.28,
    darkMaterial,
    28,
  );
  sliderPinShaft.position.z = (rodPlaneZ + sliderBodyCenterZ) / 2;
  sliderPinShaft.userData.role = 'crosshead-pin-joining-rod-to-guide-shoe';

  // A faint orbit circle corresponds to the dashed construction circle in
  // the engraving.  It is explicitly a witness, never a physical member.
  const crankOrbitWitness = new THREE.Mesh(
    new THREE.TorusGeometry(crankRadius, 0.012, 5, 80),
    matte(PALETTE.muted, {
      opacity: 0.34,
      roughness: 0.9,
      transparent: true,
    }),
  );
  crankOrbitWitness.position.z = frameFrontZ + 0.015;
  crankOrbitWitness.userData.role = 'nonphysical-crank-orbit-witness';
  crankOrbitWitness.userData.witnessOnly = true;

  root.add(
    frame,
    fixedShaft,
    rearShaftCollar,
    crankOrbitWitness,
    crankParts.crank,
    slider,
    crankPinShaft,
    sliderPinShaft,
    rodParts.rod,
  );

  const pistonPositionAndDerivatives = (turnCoordinate) => {
    const twoTurnPhase = positiveModulo(turnCoordinate, 2);
    const halfAngle = Math.PI * twoTurnPhase;
    const sine = Math.sin(halfAngle);
    const cosine = Math.cos(halfAngle);
    const q = Math.sqrt(
      crankRadius * guideOffset
        + crankRadius ** 2 * cosine ** 2,
    );
    const qFirst = -(crankRadius ** 2) * sine * cosine / q;
    const numerator = -(crankRadius ** 2) * sine * cosine;
    const numeratorFirst = -(crankRadius ** 2)
      * (cosine ** 2 - sine ** 2);
    const qSecond = numeratorFirst / q - numerator ** 2 / q ** 3;
    const position = -crankRadius * Math.sin(2 * halfAngle)
      - 2 * sine * q;
    const firstByHalfAngle = -2 * crankRadius
        * Math.cos(2 * halfAngle)
      - 2 * (cosine * q + sine * qFirst);
    const secondByHalfAngle = 4 * crankRadius
        * Math.sin(2 * halfAngle)
      + 2 * sine * q
      - 4 * cosine * qFirst
      - 2 * sine * qSecond;
    return {
      accelerationPerTurnSquared: Math.PI ** 2 * secondByHalfAngle,
      position,
      velocityPerTurn: Math.PI * firstByHalfAngle,
    };
  };

  const solveIncreasingRoot = (minimum, maximum) => {
    let lower = minimum;
    let upper = maximum;
    let lowerValue = pistonPositionAndDerivatives(lower).velocityPerTurn;
    for (let iteration = 0; iteration < 80; iteration += 1) {
      const midpoint = (lower + upper) / 2;
      const midpointValue = pistonPositionAndDerivatives(
        midpoint,
      ).velocityPerTurn;
      if (lowerValue * midpointValue <= 0) {
        upper = midpoint;
      } else {
        lower = midpoint;
        lowerValue = midpointValue;
      }
    }
    return (lower + upper) / 2;
  };
  const lowerDeadCenterTurn = solveIncreasingRoot(0.25, 0.5);
  const upperDeadCenterTurn = 2 - lowerDeadCenterTurn;

  const cross2 = (left, right) => left.x * right.y
    - left.y * right.x;
  const stateAtCrankTurnCoordinate = (
    turnCoordinate,
    turnsPerSecond = crankTurnsPerSecond,
  ) => {
    const twoTurnPhase = positiveModulo(turnCoordinate, 2);
    const oneTurnPhase = positiveModulo(turnCoordinate, 1);
    const crankAngle = FULL_TURN * oneTurnPhase;
    const crankCosine = Math.cos(crankAngle);
    const crankSine = Math.sin(crankAngle);
    const crankPin = new THREE.Vector2(
      -crankRadius * crankCosine,
      -crankRadius * crankSine,
    );
    const crankPinVelocityPerTurn = new THREE.Vector2(
      FULL_TURN * crankRadius * crankSine,
      -FULL_TURN * crankRadius * crankCosine,
    );
    const crankPinAccelerationPerTurnSquared = new THREE.Vector2(
      FULL_TURN ** 2 * crankRadius * crankCosine,
      FULL_TURN ** 2 * crankRadius * crankSine,
    );
    const piston = pistonPositionAndDerivatives(turnCoordinate);
    const sliderPin = new THREE.Vector2(guideOffset, piston.position);
    const sliderPinVelocityPerTurn = new THREE.Vector2(
      0,
      piston.velocityPerTurn,
    );
    const sliderPinAccelerationPerTurnSquared = new THREE.Vector2(
      0,
      piston.accelerationPerTurnSquared,
    );
    const relative = sliderPin.clone().sub(crankPin);
    const relativeVelocityPerTurn = sliderPinVelocityPerTurn.clone()
      .sub(crankPinVelocityPerTurn);
    const relativeAccelerationPerTurnSquared =
      sliderPinAccelerationPerTurnSquared.clone()
        .sub(crankPinAccelerationPerTurnSquared);
    const relativeLengthSquared = relative.lengthSq();
    const rodAngularVelocityPerTurn = cross2(
      relative,
      relativeVelocityPerTurn,
    ) / relativeLengthSquared;
    const rodAngularAccelerationPerTurnSquared = (
      cross2(relative, relativeAccelerationPerTurnSquared)
        * relativeLengthSquared
      - cross2(relative, relativeVelocityPerTurn)
        * 2 * relative.dot(relativeVelocityPerTurn)
    ) / relativeLengthSquared ** 2;
    const crankHalfSine = Math.sin(crankAngle / 2);
    const crankHalfCosine = Math.cos(crankAngle / 2);
    const circleLineRoot = 2 * Math.abs(crankHalfSine) * Math.sqrt(
      crankRadius * (
        guideOffset + crankRadius * crankHalfCosine ** 2
      ),
    );
    const circleLineDiscriminant = circleLineRoot ** 2;
    const lowerIntersectionY = crankPin.y - circleLineRoot;
    const upperIntersectionY = crankPin.y + circleLineRoot;
    const branch = twoTurnPhase < 1 ? 'lower' : 'upper';
    const branchSelectedY = branch === 'lower'
      ? lowerIntersectionY
      : upperIntersectionY;
    const velocityScale = turnsPerSecond;
    const accelerationScale = turnsPerSecond ** 2;
    const pistonVelocity = piston.velocityPerTurn * velocityScale;
    return {
      branch,
      branchSelectionError: piston.position - branchSelectedY,
      branchTransfer: circleLineRoot < 1e-7,
      circleLineDiscriminant,
      circleLineRoot,
      completedCrankTurns: Math.floor(turnCoordinate),
      crankAngle,
      crankAngularVelocity: FULL_TURN * velocityScale,
      crankPin,
      crankPinAcceleration: crankPinAccelerationPerTurnSquared.clone()
        .multiplyScalar(accelerationScale),
      crankPinAccelerationPerTurnSquared,
      crankPinVelocity: crankPinVelocityPerTurn.clone()
        .multiplyScalar(velocityScale),
      crankPinVelocityPerTurn,
      crankTurnCoordinate: turnCoordinate,
      crankUnwrappedAngle: FULL_TURN * turnCoordinate,
      guideError: sliderPin.x - guideOffset,
      lowerIntersectionY,
      oneTurnPhase,
      pistonAcceleration: piston.accelerationPerTurnSquared
        * accelerationScale,
      pistonAccelerationPerTurnSquared:
        piston.accelerationPerTurnSquared,
      pistonDirection: Math.abs(pistonVelocity) < 1e-9
        ? 'reversal'
        : pistonVelocity > 0 ? 'rising' : 'falling',
      pistonPosition: piston.position,
      pistonVelocity,
      pistonVelocityPerTurn: piston.velocityPerTurn,
      rodAngle: Math.atan2(relative.y, relative.x),
      rodAngularAcceleration: rodAngularAccelerationPerTurnSquared
        * accelerationScale,
      rodAngularAccelerationPerTurnSquared,
      rodAngularVelocity: rodAngularVelocityPerTurn * velocityScale,
      rodAngularVelocityPerTurn,
      rodLength: relative.length(),
      rodLengthError: relative.length() - rodLength,
      sliderPin,
      sliderPinAcceleration: sliderPinAccelerationPerTurnSquared.clone()
        .multiplyScalar(accelerationScale),
      sliderPinAccelerationPerTurnSquared,
      sliderPinVelocity: sliderPinVelocityPerTurn.clone()
        .multiplyScalar(velocityScale),
      sliderPinVelocityPerTurn,
      twoTurnPhase,
      upperIntersectionY,
    };
  };

  const stateAtTime = (time) => stateAtCrankTurnCoordinate(
    sourcePoseTurn + Math.max(0, Number(time) || 0) * crankTurnsPerSecond,
  );

  const canonicalStates = {
    sourceEngraving: stateAtCrankTurnCoordinate(sourcePoseTurn),
    lowerDeadCenter: stateAtCrankTurnCoordinate(lowerDeadCenterTurn),
    slowBranchTransfer: stateAtCrankTurnCoordinate(1),
    upperDeadCenter: stateAtCrankTurnCoordinate(upperDeadCenterTurn),
    fastBranchTransfer: stateAtCrankTurnCoordinate(2),
    nextLowerDeadCenter: stateAtCrankTurnCoordinate(
      lowerDeadCenterTurn + 2,
    ),
  };
  const pistonStroke = canonicalStates.upperDeadCenter.pistonPosition
    - canonicalStates.lowerDeadCenter.pistonPosition;

  const geometry = {
    crankDepth,
    crankPlaneZ,
    crankRadius,
    crankRevolutionsPerPistonCycle,
    crankTurnsPerSecond,
    cyclePeriod,
    frameCenterZ,
    frameDepth,
    guideHalfLength,
    guideOffset,
    guideSlotRadius,
    lowerDeadCenterTurn,
    pistonStroke,
    pistonStrokesPerCycle,
    rodDepth,
    rodLength,
    rodPlaneZ,
    sliderBodyCenterZ,
    sliderBodyDepth,
    sourceAnimationCanvasHeight,
    sourceAnimationCanvasWidth,
    sourceAnimationCrankRadius,
    sourceAnimationGuideHalfLength,
    sourceAnimationGuideOffset,
    sourceAnimationRodLength,
    sourceAnimationScale,
    sourceAnimationViewHeight,
    sourceAnimationViewMinimum,
    sourceAnimationViewWidth,
    sourceImageHeight,
    sourceImageWidth,
    sourcePoseCrankDirection,
    sourcePoseTurn,
    sourceRasterCrankCenter,
    sourceRasterCrankPin,
    sourceRasterSliderPin,
    upperDeadCenterTurn,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    crankParts.crank.rotation.z = state.crankAngle;
    slider.position.set(guideOffset, state.pistonPosition, 0);
    crankPinShaft.position.x = state.crankPin.x;
    crankPinShaft.position.y = state.crankPin.y;
    sliderPinShaft.position.x = guideOffset;
    sliderPinShaft.position.y = state.pistonPosition;
    rodParts.rod.position.set(
      state.crankPin.x,
      state.crankPin.y,
      rodPlaneZ,
    );
    rodParts.rod.rotation.z = state.rodAngle;
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    'tangent-branch-transfer-slider-crank-one-revolution-per-piston-stroke';
  root.userData.blocks = {
    crank: crankParts.crank,
    crankArm: crankParts.arm,
    crankCenterAnchor,
    crankFixedBoss: crankParts.fixedBoss,
    crankMovingBoss: crankParts.movingBoss,
    crankOrbitWitness,
    crankPinAnchor: crankParts.crankPinAnchor,
    crankPinShaft,
    crankRotationIndex: crankParts.rotationIndex,
    fixedFrame: frame,
    fixedShaft,
    framePlate,
    guideBottomAnchor,
    guideOutline,
    guideTopAnchor,
    rearShaftCollar,
    rod: rodParts.rod,
    rodBody: rodParts.body,
    rodCrankEye: rodParts.crankEye,
    rodCrankEyeAnchor: rodParts.rodCrankEyeAnchor,
    rodSliderEye: rodParts.sliderEye,
    rodSliderEyeAnchor: rodParts.rodSliderEyeAnchor,
    shaftBoreOutline,
    slider,
    sliderBody,
    sliderIndex,
    sliderPinAnchor,
    sliderPinShaft,
  };
  root.userData.cameraDistanceScale = 1.1;
  root.userData.cameraFov = 8;
  root.userData.hideGround = true;
  root.userData.materialsIgnoreSceneFog = true;
  root.userData.reconstructionStatus = 'candidate';
  root.userData.supportsRestart = true;
  root.userData.animationTiming = { period: cyclePeriod };
  root.userData.canonicalStates = canonicalStates;
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.mechanism =
    'tangent-branch-transfer-radius-five-guide-seven-rod-twelve-two-crank-turn-piston-cycle';
  root.userData.modelPointToAnimationRaster =
    modelPointToAnimationRaster;
  root.userData.pistonPositionAndDerivatives =
    pistonPositionAndDerivatives;
  root.userData.stateAtCrankTurnCoordinate =
    stateAtCrankTurnCoordinate;
  root.userData.stateAtTime = stateAtTime;

  root.traverse(object => {
    if (object.material) for (const material of [].concat(object.material)) material.fog = false;
  });
  update(0);
  markShadows(root);
  crankOrbitWitness.castShadow = false;
  crankOrbitWitness.receiveShadow = false;
  return {
    cameraDirection: new THREE.Vector3(0, 0, 1),
    reset: () => update(0),
    root,
    update,
  };
}

export function createAuthoredStrokeCrankMovement(movement) {
  if (movement.id !== 175) return null;
  return oneRevolutionPerPistonStrokeCrank();
}
