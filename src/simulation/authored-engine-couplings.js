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

function cylinderAlongZ(radius, length, material, segments = 36) {
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
    curveSegments: 28,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function makeOutputCrankShape({
  bottomHoleRadius,
  bottomOuterRadius,
  crankRadius,
  topHoleRadius,
  topOuterRadius,
}) {
  const bottomNeckX = 0.64;
  const bottomNeckY = Math.sqrt(
    bottomOuterRadius ** 2 - bottomNeckX ** 2,
  );
  const bottomNeckAngle = Math.atan2(bottomNeckY, bottomNeckX);
  const topNeckX = 0.63;
  const topNeckDrop = Math.sqrt(
    topOuterRadius ** 2 - topNeckX ** 2,
  );
  const topNeckAngle = Math.atan2(topNeckDrop, topNeckX);

  const shape = new THREE.Shape();
  shape.moveTo(-bottomOuterRadius, 0);
  shape.absarc(
    0,
    0,
    bottomOuterRadius,
    Math.PI,
    FULL_TURN + bottomNeckAngle,
    false,
  );
  shape.lineTo(topNeckX, crankRadius - topNeckDrop);
  shape.absarc(
    0,
    crankRadius,
    topOuterRadius,
    -topNeckAngle,
    Math.PI + topNeckAngle,
    false,
  );
  shape.lineTo(-bottomNeckX, bottomNeckY);
  shape.absarc(
    0,
    0,
    bottomOuterRadius,
    Math.PI - bottomNeckAngle,
    Math.PI,
    false,
  );
  shape.closePath();

  const bottomHole = new THREE.Path();
  bottomHole.absarc(0, 0, bottomHoleRadius, 0, FULL_TURN, true);
  bottomHole.closePath();
  const topHole = new THREE.Path();
  topHole.absarc(
    0,
    crankRadius,
    topHoleRadius,
    0,
    FULL_TURN,
    true,
  );
  topHole.closePath();
  shape.holes.push(bottomHole, topHole);
  return {
    bottomNeckX,
    bottomNeckY,
    shape,
    topNeckDrop,
    topNeckX,
  };
}

function makeVerticalSlotLobeShape(outerRadius, slotHalfWidth, side) {
  const wallHalfLength = Math.sqrt(
    outerRadius ** 2 - slotHalfWidth ** 2,
  );
  const shape = new THREE.Shape();
  if (side === 'left') {
    const upperAngle = Math.acos(-slotHalfWidth / outerRadius);
    shape.moveTo(-slotHalfWidth, wallHalfLength);
    shape.absarc(
      0,
      0,
      outerRadius,
      upperAngle,
      FULL_TURN - upperAngle,
      false,
    );
    shape.lineTo(-slotHalfWidth, wallHalfLength);
  } else {
    const upperAngle = Math.acos(slotHalfWidth / outerRadius);
    shape.moveTo(slotHalfWidth, -wallHalfLength);
    shape.absarc(
      0,
      0,
      outerRadius,
      -upperAngle,
      upperAngle,
      false,
    );
    shape.lineTo(slotHalfWidth, -wallHalfLength);
  }
  shape.closePath();
  return { shape, wallHalfLength };
}

function makeArcTube({
  colorMaterial,
  endAngle,
  radius,
  startAngle,
  tubeRadius,
  z,
}) {
  const points = [];
  const segments = 40;
  for (let index = 0; index <= segments; index += 1) {
    const angle = THREE.MathUtils.lerp(
      startAngle,
      endAngle,
      index / segments,
    );
    points.push(new THREE.Vector3(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
      z,
    ));
  }
  return new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points, false, 'centripetal'),
      64,
      tubeRadius,
      7,
      false,
    ),
    colorMaterial,
  );
}

function solveBracketedRoot(functionAt, minimum, maximum) {
  let lower = minimum;
  let upper = maximum;
  let lowerValue = functionAt(lower);
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    const midpointValue = functionAt(midpoint);
    if (lowerValue * midpointValue <= 0) {
      upper = midpoint;
    } else {
      lower = midpoint;
      lowerValue = midpointValue;
    }
  }
  return (lower + upper) / 2;
}

function makeTangentialPassageProfiles({
  crankRadius,
  outerRadius,
  slotHalfWidth,
}) {
  const centerlineY = (x) => Math.sqrt(
    Math.max(0, crankRadius ** 2 - x ** 2),
  ) - crankRadius;
  const outerY = (x) => Math.sqrt(
    Math.max(0, outerRadius ** 2 - x ** 2),
  );
  const upperBoundaryRadius = crankRadius + slotHalfWidth;
  const lowerBoundaryRadius = crankRadius - slotHalfWidth;
  const upperBoundaryY = (x) => Math.sqrt(
    Math.max(0, upperBoundaryRadius ** 2 - x ** 2),
  ) - crankRadius;
  const lowerBoundaryY = (x) => Math.sqrt(
    Math.max(0, lowerBoundaryRadius ** 2 - x ** 2),
  ) - crankRadius;
  const upperLimit = solveBracketedRoot(
    (x) => outerY(x) - upperBoundaryY(x),
    0,
    outerRadius,
  );
  const lowerLimit = solveBracketedRoot(
    (x) => lowerBoundaryY(x) + outerY(x),
    0,
    outerRadius,
  );

  const upperOuterAngle = Math.atan2(
    upperBoundaryY(upperLimit),
    upperLimit,
  );
  const lowerOuterAngle = Math.atan2(
    Math.abs(lowerBoundaryY(lowerLimit)),
    lowerLimit,
  );
  const profileSegments = 72;

  const upperShape = new THREE.Shape();
  upperShape.moveTo(
    upperLimit,
    upperBoundaryY(upperLimit),
  );
  upperShape.absarc(
    0,
    0,
    outerRadius,
    upperOuterAngle,
    Math.PI - upperOuterAngle,
    false,
  );
  const upperWallPoints = [];
  for (let index = 0; index <= profileSegments; index += 1) {
    const x = THREE.MathUtils.lerp(
      -upperLimit,
      upperLimit,
      index / profileSegments,
    );
    const y = upperBoundaryY(x);
    upperShape.lineTo(x, y);
    upperWallPoints.push(new THREE.Vector3(x, y, 0));
  }
  upperShape.closePath();

  const lowerShape = new THREE.Shape();
  lowerShape.moveTo(
    -lowerLimit,
    lowerBoundaryY(-lowerLimit),
  );
  lowerShape.absarc(
    0,
    0,
    outerRadius,
    Math.PI + lowerOuterAngle,
    FULL_TURN - lowerOuterAngle,
    false,
  );
  const lowerWallPoints = [];
  for (let index = 0; index <= profileSegments; index += 1) {
    const x = THREE.MathUtils.lerp(
      lowerLimit,
      -lowerLimit,
      index / profileSegments,
    );
    const y = lowerBoundaryY(x);
    lowerShape.lineTo(x, y);
    lowerWallPoints.push(new THREE.Vector3(x, y, 0));
  }
  lowerShape.closePath();

  return {
    centerlineY,
    lowerBoundaryRadius,
    lowerLimit,
    lowerShape,
    lowerWallPoints,
    upperLimit,
    upperBoundaryRadius,
    upperShape,
    upperWallPoints,
  };
}

function makeCurvedWallTube(points, radius, material) {
  return new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points, false, 'centripetal'),
      96,
      radius,
      7,
      false,
    ),
    material,
  );
}

function makeRearDriverCrank({
  crankRadius,
  darkMaterial,
  depth,
  driverMaterial,
  inputPlaneZ,
  wristPinRadius,
}) {
  const crank = new THREE.Group();
  crank.position.z = inputPlaneZ;
  crank.userData.axis = Z_AXIS.clone();
  crank.userData.role = 'rear-input-crank-with-fixed-wrist';

  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.40, crankRadius, depth),
    driverMaterial,
  );
  arm.position.y = crankRadius / 2;
  arm.userData.role = 'rear-input-crank-arm';
  const shaftBoss = cylinderAlongZ(0.46, depth, driverMaterial, 40);
  shaftBoss.userData.role = 'rear-input-crank-shaft-boss';
  const wristBoss = cylinderAlongZ(
    wristPinRadius + 0.055,
    depth,
    driverMaterial,
    40,
  );
  wristBoss.position.y = crankRadius;
  wristBoss.userData.role = 'rear-input-crank-wrist-boss';
  const shaftOutline = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.035, 8, 42),
    darkMaterial,
  );
  shaftOutline.position.z = depth / 2 + 0.012;
  shaftOutline.userData.role = 'rear-input-shaft-outline';
  const wristOutline = new THREE.Mesh(
    new THREE.TorusGeometry(wristPinRadius, 0.030, 8, 40),
    darkMaterial,
  );
  wristOutline.position.set(0, crankRadius, depth / 2 + 0.012);
  wristOutline.userData.role = 'rear-input-wrist-outline';
  const inputWristAnchor = new THREE.Object3D();
  inputWristAnchor.position.y = crankRadius;
  inputWristAnchor.userData.role = 'analytic-input-wrist-center';
  crank.add(
    arm,
    shaftBoss,
    wristBoss,
    shaftOutline,
    wristOutline,
    inputWristAnchor,
  );
  return {
    arm,
    crank,
    inputWristAnchor,
    shaftBoss,
    wristBoss,
  };
}

function engagedSlottedRingEngineCoupling({
  sourceBottomOuterRadius = 80,
  sourceImageHeight = 525,
  sourceImageWidth = 525,
  sourceMainShaftCenter = new THREE.Vector2(278, 430),
  sourceRingCenter = new THREE.Vector2(278, 91),
  sourceScale = 0.010,
  sourceSlotHalfWidth = 29,
  sourceTopOuterRadius = 76,
  sourceWristCenter = new THREE.Vector2(277, 91),
  sourceWristRadius = 28,
} = {}) {
  const root = new THREE.Group();

  // Brown's front elevation gives an equal-throw pair of coaxial cranks. The
  // orange input cheek is the omitted rear arm named in the description; its
  // wrist projects forward into the rotatable ring carried by the blue cheek.
  const crankRadius = (
    sourceMainShaftCenter.y - sourceRingCenter.y
  ) * sourceScale;
  const bottomOuterRadius = sourceBottomOuterRadius * sourceScale;
  const topOuterRadius = sourceTopOuterRadius * sourceScale;
  const wristPinRadius = sourceWristRadius * sourceScale;
  const slotHalfWidth = sourceSlotHalfWidth * sourceScale;
  const topHoleRadius = 0.65;
  const bottomHoleRadius = 0.55;
  const selectorOuterRadius = 0.62;
  const selectorGrooveRadius = 0.48;
  const contactOffset = slotHalfWidth - wristPinRadius;
  const contactLag = Math.asin(contactOffset / crankRadius);
  const sourceInputAngle = contactLag;
  const inputAngularSpeed = 0.62;
  const cyclePeriod = FULL_TURN / inputAngularSpeed;

  const sourcePointToModel = (point) => new THREE.Vector2(
    (point.x - sourceMainShaftCenter.x) * sourceScale,
    (sourceMainShaftCenter.y - point.y) * sourceScale,
  );
  const modelPointToSourceRaster = (point) => new THREE.Vector2(
    sourceMainShaftCenter.x + point.x / sourceScale,
    sourceMainShaftCenter.y - point.y / sourceScale,
  );

  const inputPlaneZ = -0.37;
  const inputCrankDepth = 0.18;
  const selectorPlaneZ = 0.08;
  const selectorDepth = 0.18;
  const outputPlaneZ = 0.36;
  const outputCrankDepth = 0.20;
  const wristPinRearZ = inputPlaneZ - inputCrankDepth / 2 - 0.015;
  const wristPinFrontZ = 0.23;
  const inputShaftCenterZ = -0.70;
  const inputShaftLength = 0.78;
  const outputShaftCenterZ = 0.72;
  const outputShaftLength = 0.82;

  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.09,
    roughness: 0.64,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.11,
    roughness: 0.62,
  });
  const selectorMaterial = matte(PALETTE.accent, {
    metalness: 0.12,
    roughness: 0.60,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.70,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const inputParts = makeRearDriverCrank({
    crankRadius,
    darkMaterial,
    depth: inputCrankDepth,
    driverMaterial,
    inputPlaneZ,
    wristPinRadius,
  });

  const outputCrank = new THREE.Group();
  outputCrank.position.z = outputPlaneZ;
  outputCrank.userData.axis = Z_AXIS.clone();
  outputCrank.userData.role = 'front-output-crank-carrying-selector-ring';
  const outputProfile = makeOutputCrankShape({
    bottomHoleRadius,
    bottomOuterRadius,
    crankRadius,
    topHoleRadius,
    topOuterRadius,
  });
  const outputCrankPlate = new THREE.Mesh(
    centeredExtrusion(
      outputProfile.shape,
      outputCrankDepth,
      0.014,
    ),
    drivenMaterial,
  );
  outputCrankPlate.userData.openingCount = 2;
  outputCrankPlate.userData.role =
    'front-output-crank-cheek-with-two-real-bores';
  const outputShaftOutline = new THREE.Mesh(
    new THREE.TorusGeometry(bottomHoleRadius, 0.035, 8, 48),
    darkMaterial,
  );
  outputShaftOutline.position.z = outputCrankDepth / 2 + 0.016;
  outputShaftOutline.userData.role = 'front-output-shaft-bore-outline';
  const selectorBearingOutline = new THREE.Mesh(
    new THREE.TorusGeometry(topHoleRadius, 0.035, 8, 52),
    darkMaterial,
  );
  selectorBearingOutline.position.set(
    0,
    crankRadius,
    outputCrankDepth / 2 + 0.016,
  );
  selectorBearingOutline.userData.role =
    'front-selector-ring-bearing-outline';
  const outputRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.060, 0.032),
    whiteMaterial,
  );
  outputRotationIndex.position.set(
    0.30,
    0,
    outputCrankDepth / 2 + 0.055,
  );
  outputRotationIndex.userData.role =
    'white-index-fixed-to-output-crank';
  const outputRingCenterAnchor = new THREE.Object3D();
  outputRingCenterAnchor.position.y = crankRadius;
  outputRingCenterAnchor.userData.role =
    'analytic-output-ring-center';
  outputCrank.add(
    outputCrankPlate,
    outputShaftOutline,
    selectorBearingOutline,
    outputRotationIndex,
    outputRingCenterAnchor,
  );

  const selectorRing = new THREE.Group();
  selectorRing.position.set(
    0,
    crankRadius,
    selectorPlaneZ - outputPlaneZ,
  );
  selectorRing.userData.relativeAngle = 0;
  selectorRing.userData.role =
    'radially-oriented-engaged-slotted-selector-ring';
  selectorRing.userData.slotAxisLocal = new THREE.Vector3(0, 1, 0);
  const leftLobeProfile = makeVerticalSlotLobeShape(
    selectorOuterRadius,
    slotHalfWidth,
    'left',
  );
  const rightLobeProfile = makeVerticalSlotLobeShape(
    selectorOuterRadius,
    slotHalfWidth,
    'right',
  );
  const selectorLeftLobe = new THREE.Mesh(
    centeredExtrusion(leftLobeProfile.shape, selectorDepth, 0.010),
    selectorMaterial,
  );
  selectorLeftLobe.userData.role = 'engaged-selector-left-slot-lobe';
  const selectorRightLobe = new THREE.Mesh(
    centeredExtrusion(rightLobeProfile.shape, selectorDepth, 0.010),
    selectorMaterial,
  );
  selectorRightLobe.userData.role = 'engaged-selector-right-slot-lobe';
  const slotWallHalfLength = leftLobeProfile.wallHalfLength;
  const selectorLeftWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.026, slotWallHalfLength * 2, selectorDepth + 0.018),
    darkMaterial,
  );
  selectorLeftWall.position.x = -slotHalfWidth;
  selectorLeftWall.userData.contactSurface = true;
  selectorLeftWall.userData.role = 'engaged-left-tangential-slot-wall';
  const selectorRightWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.026, slotWallHalfLength * 2, selectorDepth + 0.018),
    darkMaterial,
  );
  selectorRightWall.position.x = slotHalfWidth;
  selectorRightWall.userData.contactSurface = true;
  selectorRightWall.userData.role = 'engaged-right-tangential-slot-wall';
  const selectorLeftGroove = makeArcTube({
    colorMaterial: darkMaterial,
    endAngle: Math.PI + 0.94,
    radius: selectorGrooveRadius,
    startAngle: Math.PI - 0.94,
    tubeRadius: 0.024,
    z: selectorDepth / 2 + 0.020,
  });
  selectorLeftGroove.userData.role = 'left-selector-ring-arc-detail';
  const selectorRightGroove = makeArcTube({
    colorMaterial: darkMaterial,
    endAngle: 0.94,
    radius: selectorGrooveRadius,
    startAngle: -0.94,
    tubeRadius: 0.024,
    z: selectorDepth / 2 + 0.020,
  });
  selectorRightGroove.userData.role = 'right-selector-ring-arc-detail';
  const selectorIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.21, 0.030),
    whiteMaterial,
  );
  selectorIndex.position.set(
    selectorOuterRadius - 0.15,
    0,
    selectorDepth / 2 + 0.055,
  );
  selectorIndex.userData.role =
    'white-index-fixed-to-radial-selector-ring';
  const selectorCenterAnchor = new THREE.Object3D();
  selectorCenterAnchor.userData.role = 'analytic-selector-ring-center';
  const selectorSlotAxisAnchor = new THREE.Object3D();
  selectorSlotAxisAnchor.position.y = 0.46;
  selectorSlotAxisAnchor.userData.role =
    'analytic-radial-slot-axis-anchor';
  selectorRing.add(
    selectorLeftLobe,
    selectorRightLobe,
    selectorLeftWall,
    selectorRightWall,
    selectorLeftGroove,
    selectorRightGroove,
    selectorIndex,
    selectorCenterAnchor,
    selectorSlotAxisAnchor,
  );
  outputCrank.add(selectorRing);

  const inputShaft = cylinderAlongZ(
    0.37,
    inputShaftLength,
    driverMaterial,
    44,
  );
  inputShaft.position.z = inputShaftCenterZ - inputPlaneZ;
  inputShaft.userData.axis = Z_AXIS.clone();
  inputShaft.userData.role = 'rear-independent-input-shaft';
  const inputShaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 0.055, 0.034),
    whiteMaterial,
  );
  inputShaftIndex.position.set(
    0.25,
    0,
    inputShaftCenterZ - inputPlaneZ - inputShaftLength / 2 - 0.025,
  );
  inputShaftIndex.userData.role = 'white-index-on-rear-input-shaft';
  inputParts.crank.add(inputShaft, inputShaftIndex);

  const outputShaft = cylinderAlongZ(
    0.42,
    outputShaftLength,
    drivenMaterial,
    44,
  );
  outputShaft.position.z = outputShaftCenterZ - outputPlaneZ;
  outputShaft.userData.axis = Z_AXIS.clone();
  outputShaft.userData.role = 'front-independent-output-shaft';
  const outputShaftCap = cylinderAlongZ(
    0.46,
    0.10,
    darkMaterial,
    44,
  );
  outputShaftCap.position.z =
    outputShaftCenterZ - outputPlaneZ + outputShaftLength / 2;
  outputShaftCap.userData.role = 'front-output-shaft-end-cap';
  outputCrank.add(outputShaft, outputShaftCap);

  const wristPinAssembly = new THREE.Group();
  wristPinAssembly.userData.axis = Z_AXIS.clone();
  wristPinAssembly.userData.role =
    'input-fixed-wrist-spanning-the-selector-plane';
  const wristPin = cylinderAlongZ(
    wristPinRadius,
    wristPinFrontZ - wristPinRearZ,
    driverMaterial,
    44,
  );
  wristPin.position.z = (wristPinFrontZ + wristPinRearZ) / 2;
  wristPin.userData.role = 'input-wrist-pin';
  const wristFaceOutline = new THREE.Mesh(
    new THREE.TorusGeometry(wristPinRadius, 0.032, 8, 44),
    darkMaterial,
  );
  wristFaceOutline.position.z = wristPinFrontZ + 0.012;
  wristFaceOutline.userData.role = 'input-wrist-front-outline';
  const wristFaceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.050, 0.030),
    whiteMaterial,
  );
  wristFaceIndex.position.set(0, 0, wristPinFrontZ + 0.048);
  wristFaceIndex.userData.role = 'white-index-on-input-wrist';
  const wristCenterAnchor = new THREE.Object3D();
  wristCenterAnchor.position.z = selectorPlaneZ;
  wristCenterAnchor.userData.role = 'analytic-rendered-wrist-center';
  wristPinAssembly.add(
    wristPin,
    wristFaceOutline,
    wristFaceIndex,
    wristCenterAnchor,
  );

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 18, 12),
    whiteMaterial,
  );
  contactMarker.position.z = selectorPlaneZ + selectorDepth / 2 + 0.065;
  contactMarker.userData.role = 'wrist-to-slot-wall-contact-marker';

  const frontBearing = new THREE.Group();
  frontBearing.position.z = outputShaftCenterZ + outputShaftLength / 2 + 0.035;
  frontBearing.userData.fixed = true;
  frontBearing.userData.role = 'fixed-front-output-bearing';
  const frontBearingRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.075, 10, 44),
    frameMaterial,
  );
  frontBearing.add(frontBearingRing);
  const rearBearing = new THREE.Group();
  rearBearing.position.z = inputShaftCenterZ - inputShaftLength / 2 - 0.035;
  rearBearing.userData.fixed = true;
  rearBearing.userData.role = 'fixed-rear-input-bearing';
  const rearBearingRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.43, 0.070, 10, 44),
    frameMaterial,
  );
  rearBearing.add(rearBearingRing);

  const motionEnvelope = new THREE.Mesh(
    new THREE.TorusGeometry(
      crankRadius + topOuterRadius,
      0.012,
      5,
      128,
    ),
    matte(PALETTE.muted, {
      opacity: 0.20,
      roughness: 0.92,
      transparent: true,
    }),
  );
  motionEnvelope.position.z = inputPlaneZ - inputCrankDepth / 2 - 0.06;
  motionEnvelope.userData.role = 'nonphysical-full-crank-motion-envelope';
  motionEnvelope.userData.witnessOnly = true;

  root.add(
    motionEnvelope,
    rearBearing,
    inputParts.crank,
    wristPinAssembly,
    outputCrank,
    contactMarker,
    frontBearing,
  );

  const stateAtInputAngle = (
    inputUnwrappedAngle,
    angularSpeed = inputAngularSpeed,
  ) => {
    const outputUnwrappedAngle = inputUnwrappedAngle - contactLag;
    const inputAngle = positiveModulo(inputUnwrappedAngle, FULL_TURN);
    const outputAngle = positiveModulo(outputUnwrappedAngle, FULL_TURN);
    const inputWrist = new THREE.Vector2(
      -crankRadius * Math.sin(inputAngle),
      crankRadius * Math.cos(inputAngle),
    );
    const outputRingCenter = new THREE.Vector2(
      -crankRadius * Math.sin(outputAngle),
      crankRadius * Math.cos(outputAngle),
    );
    const slotTangentialAxis = new THREE.Vector2(
      Math.cos(outputAngle),
      Math.sin(outputAngle),
    );
    const slotRadialAxis = new THREE.Vector2(
      -Math.sin(outputAngle),
      Math.cos(outputAngle),
    );
    const wristRelativeToRing = inputWrist.clone()
      .sub(outputRingCenter);
    const tangentialOffset = wristRelativeToRing.dot(
      slotTangentialAxis,
    );
    const radialOffset = wristRelativeToRing.dot(slotRadialAxis);
    const pinContactPoint = inputWrist.clone().addScaledVector(
      slotTangentialAxis,
      -wristPinRadius,
    );
    const wallContactPoint = outputRingCenter.clone()
      .addScaledVector(slotTangentialAxis, -slotHalfWidth)
      .addScaledVector(slotRadialAxis, radialOffset);
    const inputWristVelocity = new THREE.Vector2(
      -crankRadius * Math.cos(inputAngle) * angularSpeed,
      -crankRadius * Math.sin(inputAngle) * angularSpeed,
    );
    const outputRingCenterVelocity = new THREE.Vector2(
      -crankRadius * Math.cos(outputAngle) * angularSpeed,
      -crankRadius * Math.sin(outputAngle) * angularSpeed,
    );
    const inputWristAcceleration = inputWrist.clone()
      .multiplyScalar(-(angularSpeed ** 2));
    const outputRingCenterAcceleration = outputRingCenter.clone()
      .multiplyScalar(-(angularSpeed ** 2));
    return {
      axialPlaneSeparation: outputPlaneZ - inputPlaneZ,
      contactError: pinContactPoint.distanceTo(wallContactPoint),
      contactGap: slotHalfWidth
        - (Math.abs(tangentialOffset) + wristPinRadius),
      contactSide: 'left-trailing-slot-wall',
      inputAngle,
      inputAngularAcceleration: 0,
      inputAngularSpeed: angularSpeed,
      inputOutputAngularSpeedRatio: 1,
      inputUnwrappedAngle,
      inputWrist,
      inputWristAcceleration,
      inputWristVelocity,
      outputAngle,
      outputAngularAcceleration: 0,
      outputAngularSpeed: angularSpeed,
      outputRingCenter,
      outputRingCenterAcceleration,
      outputRingCenterVelocity,
      outputUnwrappedAngle,
      phaseLag: inputUnwrappedAngle - outputUnwrappedAngle,
      pinContactPoint,
      radialEndClearance: slotWallHalfLength
        - (Math.abs(radialOffset) + wristPinRadius),
      radialOffset,
      selectorAngleRelativeToOutput: 0,
      selectorEngaged: true,
      selectorSlotOrientation: 'radial-to-output-crank',
      slotRadialAxis,
      slotTangentialAxis,
      tangentialOffset,
      wallContactPoint,
      wristRelativeToRing,
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    sourceInputAngle + Math.max(0, Number(time) || 0) * inputAngularSpeed,
  );
  const canonicalStates = {
    sourceEngaged: stateAtInputAngle(sourceInputAngle),
    quarterTurn: stateAtInputAngle(sourceInputAngle + Math.PI / 2),
    halfTurn: stateAtInputAngle(sourceInputAngle + Math.PI),
    threeQuarterTurn: stateAtInputAngle(
      sourceInputAngle + Math.PI * 1.5,
    ),
    fullTurn: stateAtInputAngle(sourceInputAngle + FULL_TURN),
  };

  const geometry = {
    axialPlaneSeparation: outputPlaneZ - inputPlaneZ,
    bottomHoleRadius,
    bottomOuterRadius,
    contactLag,
    contactOffset,
    crankRadius,
    cyclePeriod,
    inputCrankDepth,
    inputPlaneZ,
    inputShaftCenterZ,
    inputShaftLength,
    inputAngularSpeed,
    outputCrankDepth,
    outputPlaneZ,
    outputProfileBottomNeckX: outputProfile.bottomNeckX,
    outputProfileBottomNeckY: outputProfile.bottomNeckY,
    outputProfileTopNeckDrop: outputProfile.topNeckDrop,
    outputProfileTopNeckX: outputProfile.topNeckX,
    outputShaftCenterZ,
    outputShaftLength,
    selectorDepth,
    selectorGrooveRadius,
    selectorOuterRadius,
    selectorPlaneZ,
    slotHalfWidth,
    slotWallHalfLength,
    sourceBottomOuterRadius,
    sourceImageHeight,
    sourceImageWidth,
    sourceInputAngle,
    sourceMainShaftCenter,
    sourceRingCenter,
    sourceScale,
    sourceSlotHalfWidth,
    sourceTopOuterRadius,
    sourceWristCenter,
    sourceWristRadius,
    topHoleRadius,
    topOuterRadius,
    wristPinFrontZ,
    wristPinRadius,
    wristPinRearZ,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    inputParts.crank.rotation.z = state.inputAngle;
    outputCrank.rotation.z = state.outputAngle;
    wristPinAssembly.position.set(
      state.inputWrist.x,
      state.inputWrist.y,
      0,
    );
    wristPinAssembly.rotation.z = state.inputAngle;
    contactMarker.position.x = state.pinContactPoint.x;
    contactMarker.position.y = state.pinContactPoint.y;
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    'coaxial-equal-throw-cranks-radial-slotted-ring-engaged-wrist-pin-coupling';
  root.userData.blocks = {
    contactMarker,
    fixedFrontBearing: frontBearing,
    fixedFrontBearingRing: frontBearingRing,
    fixedRearBearing: rearBearing,
    fixedRearBearingRing: rearBearingRing,
    inputCrank: inputParts.crank,
    inputCrankArm: inputParts.arm,
    inputShaft,
    inputShaftBoss: inputParts.shaftBoss,
    inputShaftIndex,
    inputWristAnchor: inputParts.inputWristAnchor,
    inputWristBoss: inputParts.wristBoss,
    motionEnvelope,
    outputCrank,
    outputCrankPlate,
    outputRingCenterAnchor,
    outputRotationIndex,
    outputShaft,
    outputShaftCap,
    outputShaftOutline,
    selectorBearingOutline,
    selectorCenterAnchor,
    selectorIndex,
    selectorLeftGroove,
    selectorLeftLobe,
    selectorLeftWall,
    selectorRightGroove,
    selectorRightLobe,
    selectorRightWall,
    selectorRing,
    selectorSlotAxisAnchor,
    wristCenterAnchor,
    wristFaceIndex,
    wristFaceOutline,
    wristPin,
    wristPinAssembly,
  };
  root.userData.cameraDistanceScale = 1.06;
  root.userData.canonicalStates = canonicalStates;
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.mechanism =
    'coaxial-equal-radius-driver-driven-cranks-radial-slot-wall-engaged-wrist-pin-one-to-one';
  root.userData.modelPointToSourceRaster = modelPointToSourceRaster;
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;

  update(0);
  markShadows(root);
  motionEnvelope.castShadow = false;
  motionEnvelope.receiveShadow = false;
  return {
    cameraDirection: new THREE.Vector3(6.4, 4.6, 11.4),
    root,
    update,
  };
}

function disengagedSlottedRingEngineCoupling() {
  const model = engagedSlottedRingEngineCoupling({
    sourceBottomOuterRadius: 80,
    sourceMainShaftCenter: new THREE.Vector2(263, 429),
    sourceRingCenter: new THREE.Vector2(263, 99),
    sourceSlotHalfWidth: 29,
    sourceTopOuterRadius: 81,
    sourceWristCenter: new THREE.Vector2(263, 99),
    sourceWristRadius: 28,
  });
  const { root } = model;
  const blocks = root.userData.blocks;
  const geometry = root.userData.geometry;
  const selectorMaterial = blocks.selectorLeftLobe.material;
  const wallMaterial = blocks.selectorLeftWall.material;
  const selectorRing = blocks.selectorRing;

  // Movement 177 is the same physical ring turned a quarter turn. The wrist
  // orbit is measurably curved over the selector diameter, so the released
  // passage follows that radius rather than substituting a straight channel
  // that would clip the pin near entry and exit.
  const passageProfiles = makeTangentialPassageProfiles({
    crankRadius: geometry.crankRadius,
    outerRadius: geometry.selectorOuterRadius,
    slotHalfWidth: geometry.slotHalfWidth,
  });
  const removedSelectorObjects = [
    blocks.selectorLeftLobe,
    blocks.selectorRightLobe,
    blocks.selectorLeftWall,
    blocks.selectorRightWall,
  ];
  selectorRing.remove(...removedSelectorObjects);
  removedSelectorObjects.forEach((object) => object.geometry.dispose());

  const selectorUpperGeometry = centeredExtrusion(
    passageProfiles.upperShape,
    geometry.selectorDepth,
    0.010,
  );
  selectorUpperGeometry.rotateZ(Math.PI / 2);
  const selectorUpperLobe = new THREE.Mesh(
    selectorUpperGeometry,
    selectorMaterial,
  );
  selectorUpperLobe.userData.role =
    'released-selector-upper-curved-passage-lobe';
  const selectorLowerGeometry = centeredExtrusion(
    passageProfiles.lowerShape,
    geometry.selectorDepth,
    0.010,
  );
  selectorLowerGeometry.rotateZ(Math.PI / 2);
  const selectorLowerLobe = new THREE.Mesh(
    selectorLowerGeometry,
    selectorMaterial,
  );
  selectorLowerLobe.userData.role =
    'released-selector-lower-curved-passage-lobe';

  const wallFrontZ = geometry.selectorDepth / 2 + 0.010;
  const upperWallPoints = passageProfiles.upperWallPoints.map(
    (point) => point.clone().setZ(wallFrontZ),
  );
  const lowerWallPoints = passageProfiles.lowerWallPoints.map(
    (point) => point.clone().setZ(wallFrontZ),
  );
  const selectorUpperWall = makeCurvedWallTube(
    upperWallPoints,
    0.018,
    wallMaterial,
  );
  selectorUpperWall.geometry.rotateZ(Math.PI / 2);
  selectorUpperWall.userData.contactSurface = false;
  selectorUpperWall.userData.role =
    'released-upper-curved-clearance-wall';
  const selectorLowerWall = makeCurvedWallTube(
    lowerWallPoints,
    0.018,
    wallMaterial,
  );
  selectorLowerWall.geometry.rotateZ(Math.PI / 2);
  selectorLowerWall.userData.contactSurface = false;
  selectorLowerWall.userData.role =
    'released-lower-curved-clearance-wall';
  selectorRing.add(
    selectorUpperLobe,
    selectorLowerLobe,
    selectorUpperWall,
    selectorLowerWall,
  );
  selectorRing.rotation.z = -Math.PI / 2;
  selectorRing.userData.relativeAngle = -Math.PI / 2;
  selectorRing.userData.role =
    'quarter-turned-tangential-slot-released-selector-ring';
  blocks.selectorLeftGroove.userData.role =
    'released-selector-top-arc-detail';
  blocks.selectorRightGroove.userData.role =
    'released-selector-bottom-arc-detail';

  root.remove(blocks.contactMarker);
  blocks.contactMarker.geometry.dispose();
  delete blocks.contactMarker;
  delete blocks.selectorLeftLobe;
  delete blocks.selectorRightLobe;
  delete blocks.selectorLeftWall;
  delete blocks.selectorRightWall;
  blocks.selectorLowerLobe = selectorLowerLobe;
  blocks.selectorLowerWall = selectorLowerWall;
  blocks.selectorTopGroove = blocks.selectorLeftGroove;
  blocks.selectorBottomGroove = blocks.selectorRightGroove;
  blocks.selectorUpperLobe = selectorUpperLobe;
  blocks.selectorUpperWall = selectorUpperWall;

  const inputAngularSpeed = geometry.inputAngularSpeed;
  const sourceInputAngle = 0;
  const selectorAngleRelativeToOutput = -Math.PI / 2;
  const slotClearance = geometry.slotHalfWidth
    - geometry.wristPinRadius;
  const selectorZoneRadius = geometry.selectorOuterRadius
    + geometry.wristPinRadius;
  const passageEntryAngle = 2 * Math.asin(
    selectorZoneRadius / (2 * geometry.crankRadius),
  );

  const stateAtInputAngle = (
    inputUnwrappedAngle,
    angularSpeed = inputAngularSpeed,
  ) => {
    const inputAngle = positiveModulo(inputUnwrappedAngle, FULL_TURN);
    const inputWrist = new THREE.Vector2(
      -geometry.crankRadius * Math.sin(inputAngle),
      geometry.crankRadius * Math.cos(inputAngle),
    );
    const outputRingCenter = new THREE.Vector2(0, geometry.crankRadius);
    const wristRelativeToRing = inputWrist.clone()
      .sub(outputRingCenter);
    const passageCoordinate = wristRelativeToRing.x;
    const passageCenterlineY = passageProfiles.centerlineY(
      passageCoordinate,
    );
    const passageNormalOffset = inputWrist.length()
      - geometry.crankRadius;
    const passageClearance = geometry.slotHalfWidth
      - (Math.abs(passageNormalOffset) + geometry.wristPinRadius);
    const wristDistanceFromRing = wristRelativeToRing.length();
    const wristWithinSelectorZone = wristDistanceFromRing
      <= selectorZoneRadius + 1e-12;
    const materialClearance = wristWithinSelectorZone
      ? passageClearance
      : wristDistanceFromRing - selectorZoneRadius;
    const passageCenterlinePoint = outputRingCenter.clone().add(
      new THREE.Vector2(passageCoordinate, passageCenterlineY),
    );
    const passageNormal = passageCenterlinePoint.clone().normalize();
    const passageTangent = new THREE.Vector2(
      passageNormal.y,
      -passageNormal.x,
    );
    const inputWristVelocity = new THREE.Vector2(
      -geometry.crankRadius * Math.cos(inputAngle) * angularSpeed,
      -geometry.crankRadius * Math.sin(inputAngle) * angularSpeed,
    );
    const inputWristAcceleration = inputWrist.clone()
      .multiplyScalar(-(angularSpeed ** 2));
    return {
      axialPlaneSeparation: geometry.outputPlaneZ - geometry.inputPlaneZ,
      inputAngle,
      inputAngularAcceleration: 0,
      inputAngularSpeed: angularSpeed,
      inputOutputAngularSpeedRatio: 0,
      inputUnwrappedAngle,
      inputWrist,
      inputWristAcceleration,
      inputWristVelocity,
      materialClearance,
      outputAngle: 0,
      outputAngularAcceleration: 0,
      outputAngularSpeed: 0,
      outputRingCenter,
      outputRingCenterAcceleration: new THREE.Vector2(0, 0),
      outputRingCenterVelocity: new THREE.Vector2(0, 0),
      outputStopped: true,
      outputUnwrappedAngle: 0,
      passageCenterlinePoint,
      passageCenterlineY,
      passageClearance,
      passageCoordinate,
      passageNormal,
      passageNormalOffset,
      passageTangent,
      selectorAngleRelativeToOutput,
      selectorContact: false,
      selectorEngaged: false,
      selectorSlotOrientation: 'tangential-to-input-wrist-orbit',
      slotClearance,
      wristClearOfSelector: !wristWithinSelectorZone
        || passageClearance >= -1e-12,
      wristDistanceFromRing,
      wristRelativeToRing,
      wristWithinSelectorZone,
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    sourceInputAngle + Math.max(0, Number(time) || 0) * inputAngularSpeed,
  );
  const canonicalStates = {
    rightPassageEntry: stateAtInputAngle(-passageEntryAngle),
    sourceDisengaged: stateAtInputAngle(0),
    leftPassageExit: stateAtInputAngle(passageEntryAngle),
    quarterTurn: stateAtInputAngle(Math.PI / 2),
    oppositeOutput: stateAtInputAngle(Math.PI),
    threeQuarterTurn: stateAtInputAngle(Math.PI * 1.5),
    nextSourceDisengaged: stateAtInputAngle(FULL_TURN),
  };

  const update = (time) => {
    const state = stateAtTime(time);
    blocks.inputCrank.rotation.z = state.inputAngle;
    blocks.outputCrank.rotation.z = 0;
    selectorRing.rotation.z = selectorAngleRelativeToOutput;
    blocks.wristPinAssembly.position.set(
      state.inputWrist.x,
      state.inputWrist.y,
      0,
    );
    blocks.wristPinAssembly.rotation.z = state.inputAngle;
    root.userData.kinematics = state;
  };

  geometry.passageEntryAngle = passageEntryAngle;
  geometry.passageLowerBoundaryRadius =
    passageProfiles.lowerBoundaryRadius;
  geometry.passageLowerLimit = passageProfiles.lowerLimit;
  geometry.passageUpperBoundaryRadius =
    passageProfiles.upperBoundaryRadius;
  geometry.passageUpperLimit = passageProfiles.upperLimit;
  geometry.selectorAngleRelativeToOutput =
    selectorAngleRelativeToOutput;
  geometry.selectorZoneRadius = selectorZoneRadius;
  geometry.slotClearance = slotClearance;
  geometry.sourceInputAngle = sourceInputAngle;
  delete geometry.contactLag;
  delete geometry.contactOffset;

  root.userData.archetype =
    'coaxial-equal-throw-cranks-quarter-turned-tangential-slotted-ring-disengaged-wrist-pass-through';
  root.userData.canonicalStates = canonicalStates;
  root.userData.geometry = geometry;
  root.userData.mechanism =
    'coaxial-equal-radius-input-crank-fixed-output-quarter-turned-curved-tangential-slot-wrist-clearance';
  root.userData.passageCenterlineY = passageProfiles.centerlineY;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;

  update(0);
  markShadows(root);
  model.update = update;
  return model;
}

export function createAuthoredEngineCouplingMovement(movement) {
  if (movement.id === 176) return engagedSlottedRingEngineCoupling();
  if (movement.id === 177) return disengagedSlottedRingEngineCoupling();
  return null;
}
