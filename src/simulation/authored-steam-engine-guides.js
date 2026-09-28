import * as THREE from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {capsule, circle, plate, poly, polygonClipping} from './finite-plate-geometry.js';
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

function boredCylinderAlongZ(radius, bore, length, material, segments = 64) {
  const mesh = new THREE.Mesh(boredLatheGeometry([
    {axial: -length / 2, radial: radius},
    {axial: length / 2, radial: radius},
  ], bore, segments), material);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function finishGuidePresentation(root, update, period) {
  root.userData.hideGround = true;
  root.traverse(object => {
    for (const material of [].concat(object.material ?? [])) material.fog = false;
  });
  const bounds = new THREE.Box3();
  for (let i = 0; i <= 64; i++) {
    update(period * i / 64);
    root.updateMatrixWorld(true);
    bounds.union(new THREE.Box3().setFromObject(root));
  }
  root.userData.cameraFitBounds = bounds.expandByScalar(.025);
  root.userData.cameraDistanceScale = 1.02;
  update(0);
}

function centeredExtrusion(shape, depth, bevelSize = 0.01) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevelSize > 0,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 24,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function clockwiseVerticalCapsulePath(
  centerX,
  upperCenterY,
  lowerCenterY,
  radius,
) {
  const path = new THREE.Path();
  path.moveTo(centerX - radius, lowerCenterY);
  path.lineTo(centerX - radius, upperCenterY);
  path.absarc(centerX, upperCenterY, radius, Math.PI, 0, true);
  path.lineTo(centerX + radius, lowerCenterY);
  path.absarc(centerX, lowerCenterY, radius, 0, -Math.PI, true);
  path.closePath();
  return path;
}

function verticalCapsuleCurve(
  centerX,
  upperCenterY,
  lowerCenterY,
  radius,
  z,
) {
  const points = [];
  const arcSamples = 24;
  for (let index = 0; index <= arcSamples; index += 1) {
    const angle = Math.PI - Math.PI * index / arcSamples;
    points.push(new THREE.Vector3(
      centerX + radius * Math.cos(angle),
      upperCenterY + radius * Math.sin(angle),
      z,
    ));
  }
  for (let index = 0; index <= arcSamples; index += 1) {
    const angle = -Math.PI * index / arcSamples;
    points.push(new THREE.Vector3(
      centerX + radius * Math.cos(angle),
      lowerCenterY + radius * Math.sin(angle),
      z,
    ));
  }
  return new THREE.CatmullRomCurve3(points, true, 'centripetal');
}

// The shoulder is a cubic span tangent to the standard's straight taper at
// its foot (the old quadratic met the taper with a 15 degree kink) and
// keeping the old quadratic's tangent under the cap's overhang; its handles
// keep the hollow no narrower than before where the connecting rod swings.
const SHOULDER_START = [3.004629, -6.353234];
const SHOULDER_END = [4.5, -3.25];
const SHOULDER_CONTROLS = (() => {
  const taper = [SHOULDER_START[0] - 6, SHOULDER_START[1] + 24.625];
  const taperLength = Math.hypot(...taper);
  const overhang = [SHOULDER_END[0] - 3.28, SHOULDER_END[1] + 3.75];
  const overhangLength = Math.hypot(...overhang);
  return [
    [SHOULDER_START[0] + 0.5 * taper[0] / taperLength,
      SHOULDER_START[1] + 0.5 * taper[1] / taperLength],
    [SHOULDER_END[0] - 0.8 * overhang[0] / overhangLength,
      SHOULDER_END[1] - 0.8 * overhang[1] / overhangLength],
  ];
})();

function sourceFrameShape(scale) {
  const s = (value) => value * scale;
  const shape = new THREE.Shape();

  // Brown's frame is a broad engine standard with a narrow crown beneath
  // the crank bearing.  The numeric landmarks are those published by the
  // official canvas model; the short curved shoulders are reconstructed as
  // tangent cubic spans between its published endpoints.
  shape.moveTo(s(-7), s(-27.625));
  shape.lineTo(s(7), s(-27.625));
  shape.lineTo(s(7), s(-24.625));
  shape.lineTo(s(6), s(-24.625));
  shape.lineTo(s(3.004629), s(-6.353234));
  shape.bezierCurveTo(
    s(SHOULDER_CONTROLS[0][0]),
    s(SHOULDER_CONTROLS[0][1]),
    s(SHOULDER_CONTROLS[1][0]),
    s(SHOULDER_CONTROLS[1][1]),
    s(4.5),
    s(-3.25),
  );
  shape.lineTo(s(4.5), s(-2.25));
  shape.lineTo(s(-4.5), s(-2.25));
  shape.lineTo(s(-4.5), s(-3.25));
  shape.bezierCurveTo(
    s(-SHOULDER_CONTROLS[1][0]),
    s(SHOULDER_CONTROLS[1][1]),
    s(-SHOULDER_CONTROLS[0][0]),
    s(SHOULDER_CONTROLS[0][1]),
    s(-3.004629),
    s(-6.353234),
  );
  shape.lineTo(s(-6), s(-24.625));
  shape.lineTo(s(-7), s(-24.625));
  shape.closePath();

  shape.holes.push(clockwiseVerticalCapsulePath(
    0,
    s(-9.875),
    s(-21.125),
    s(1),
  ));
  return shape;
}

// Brown dots 326's connecting rod inside the standard between the cap and
// the slot, so the standard is hollow: a front skin with a window over the
// planed slot, joined to the slotted back plate by thin side walls. The walls
// stop at the shoulders; a cap set down inside them (below the crank's
// sweep) closes the top, and they have no floor: the foot is the floor,
// bored for the piston rod.
function hollowStandardOutlines(scale, wall, windowRadius) {
  const s = (value) => value * scale;
  const shoulder = (t) => {
    const u = 1 - t;
    const points = [SHOULDER_START, ...SHOULDER_CONTROLS, SHOULDER_END];
    const weights = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return [0, 1].map((axis) => points.reduce(
      (sum, point, index) => sum + weights[index] * point[axis], 0));
  };
  const taperX = (y) => 6 + (y + 24.625) * (3.004629 - 6) / (24.625 - 6.353234);
  const rightOuter = [[7, -27.625], [7, -24.625], [6, -24.625],
    ...Array.from({length: 49}, (_, i) => shoulder(i / 48)), [4.5, -2.25]];
  const outer = [...rightOuter, ...rightOuter.slice().reverse()
    .map(([x, y]) => [-x, y])].map(([x, y]) => [s(x), s(y)]);
  const innerBottom = -24.625 - wall;
  const rightInner = [[taperX(innerBottom) - wall, innerBottom],
    ...Array.from({length: 49}, (_, i) => shoulder(i / 48))
      .map(([x, y]) => [x - wall, y]), [4.5 - wall, -1.5]];
  const inner = [...rightInner, ...rightInner.slice().reverse()
    .map(([x, y]) => [-x, y])].map(([x, y]) => [s(x), s(y)]);
  const lowerBody = poly([[s(-8), s(-24.625)], [s(8), s(-24.625)],
    [s(8), s(-1)], [s(-8), s(-1)]]);
  const walls = polygonClipping.difference(
    polygonClipping.intersection(poly(outer), lowerBody), poly(inner));
  const slotWindow = capsule([0, s(-9.875)], [0, s(-21.125)], s(windowRadius), 48);
  const skin = polygonClipping.difference(poly(outer), slotWindow);
  return {inner: poly(inner), skin, walls};
}

function annulusGeometry(outerRadius, innerRadius, depth) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  hole.closePath();
  shape.holes.push(hole);
  return centeredExtrusion(shape, depth, 0.008);
}

function makeFlywheelCrankRotor({
  crankDepth,
  crankInitialAngle = 0,
  crankPinRadius,
  crankPlaneZ,
  crankRadius,
  darkMaterial,
  driverMaterial,
  flywheelDepth,
  flywheelInnerRadius,
  flywheelOuterRadius,
  flywheelPlaneZ,
  hubRadius,
  scale,
  showIndices = true,
  whiteMaterial,
}) {
  const rotor = new THREE.Group();
  rotor.userData.axis = Z_AXIS.clone();
  rotor.userData.role = 'one-rigid-flywheel-crankshaft-and-crank-rotor';

  const rim = new THREE.Mesh(
    annulusGeometry(
      flywheelOuterRadius,
      flywheelInnerRadius,
      flywheelDepth,
    ),
    driverMaterial,
  );
  rim.position.z = flywheelPlaneZ;
  rim.userData.role = 'source-fifteen-unit-flywheel-rim';

  const spokes = [];
  const spokeInnerRadius = hubRadius * 0.72;
  const spokeLength = flywheelInnerRadius - spokeInnerRadius + 0.10;
  const spokeCenterRadius = (flywheelInnerRadius + spokeInnerRadius) / 2;
  for (let index = 0; index < 4; index += 1) {
    const angle = Math.PI / 4 + index * Math.PI / 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(
        spokeLength,
        1.05 * scale,
        flywheelDepth * 0.76,
      ),
      driverMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * spokeCenterRadius,
      Math.sin(angle) * spokeCenterRadius,
      flywheelPlaneZ,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `flywheel-rigid-spoke-${index + 1}`;
    spokes.push(spoke);
  }

  const rearHub = cylinderAlongZ(
    hubRadius,
    flywheelDepth * 1.32,
    driverMaterial,
    48,
  );
  rearHub.position.z = flywheelPlaneZ;
  rearHub.userData.role = 'flywheel-hub-rigid-on-crankshaft';

  const crankDisk = cylinderAlongZ(
    1.75 * scale,
    crankDepth,
    driverMaterial,
    48,
  );
  crankDisk.position.z = crankPlaneZ;
  crankDisk.userData.role = 'front-crank-web-at-fixed-shaft-center';

  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(
      crankRadius,
      1.05 * scale,
      crankDepth,
    ),
    driverMaterial,
  );
  crankArm.position.set(
    Math.cos(crankInitialAngle) * crankRadius / 2,
    Math.sin(crankInitialAngle) * crankRadius / 2,
    crankPlaneZ,
  );
  crankArm.rotation.z = crankInitialAngle;
  crankArm.userData.role = 'four-unit-crank-arm-rigid-with-flywheel';

  const movingBoss = cylinderAlongZ(
    crankPinRadius * 1.65,
    crankDepth * 1.18,
    driverMaterial,
    36,
  );
  movingBoss.position.set(
    Math.cos(crankInitialAngle) * crankRadius,
    Math.sin(crankInitialAngle) * crankRadius,
    crankPlaneZ,
  );
  movingBoss.userData.role = 'crank-pin-moving-boss';

  const centerRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.02 * scale, 0.13 * scale, 10, 48),
    darkMaterial,
  );
  centerRing.position.z = crankPlaneZ + crankDepth / 2 + 0.016;
  centerRing.userData.role = 'crankshaft-front-bearing-index-ring';

  const flywheelRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.34 * scale,
      (flywheelOuterRadius - flywheelInnerRadius) * 0.78,
      0.035,
    ),
    whiteMaterial,
  );
  flywheelRotationIndex.position.set(
    0,
    (flywheelOuterRadius + flywheelInnerRadius) / 2,
    flywheelPlaneZ + flywheelDepth / 2 + 0.026,
  );
  flywheelRotationIndex.userData.role =
    'white-index-fixed-to-flywheel-rim';

  const crankRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius * 0.58, 0.15 * scale, 0.035),
    whiteMaterial,
  );
  crankRotationIndex.position.set(
    Math.cos(crankInitialAngle) * crankRadius * 0.32,
    Math.sin(crankInitialAngle) * crankRadius * 0.32,
    crankPlaneZ + crankDepth / 2 + 0.030,
  );
  crankRotationIndex.rotation.z = crankInitialAngle;
  crankRotationIndex.userData.role =
    'white-index-fixed-to-four-unit-crank';

  const crankCenterAnchor = new THREE.Object3D();
  crankCenterAnchor.position.z = crankPlaneZ;
  crankCenterAnchor.userData.role = 'analytic-fixed-crankshaft-center';
  const crankPinAnchor = new THREE.Object3D();
  crankPinAnchor.position.set(
    Math.cos(crankInitialAngle) * crankRadius,
    Math.sin(crankInitialAngle) * crankRadius,
    crankPlaneZ,
  );
  crankPinAnchor.userData.role = 'analytic-four-unit-crank-pin-center';

  rotor.add(
    rim,
    ...spokes,
    rearHub,
    crankDisk,
    crankArm,
    movingBoss,
    ...(showIndices
      ? [centerRing, flywheelRotationIndex, crankRotationIndex]
      : []),
    crankCenterAnchor,
    crankPinAnchor,
  );
  return {
    crankArm,
    crankCenterAnchor,
    crankDisk,
    crankPinAnchor,
    crankRotationIndex: showIndices ? crankRotationIndex : undefined,
    flywheelRotationIndex: showIndices ? flywheelRotationIndex : undefined,
    movingBoss,
    rearHub,
    rim,
    rotor,
    spokes,
  };
}

function makeConnectingRod({
  darkMaterial,
  depth,
  drivenMaterial,
  eyeRadius,
  crankBore,
  wristBore,
  rodLength,
}) {
  const rod = new THREE.Group();
  rod.userData.nominalLength = rodLength;
  rod.userData.role =
    'single-rigid-connecting-rod-from-crank-to-slide-A';

  const bodyLength = rodLength - eyeRadius * 1.35;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(bodyLength, eyeRadius * 0.72, depth),
    drivenMaterial,
  );
  body.position.x = rodLength / 2;
  body.userData.role = 'constant-length-connecting-rod-shank';

  const crankEyeBody = boredCylinderAlongZ(
    eyeRadius, crankBore,
    depth,
    drivenMaterial,
    36,
  );
  crankEyeBody.userData.role = 'connecting-rod-crank-eye-body';
  const wristEyeBody = boredCylinderAlongZ(
    eyeRadius * 0.82, wristBore,
    depth,
    drivenMaterial,
    36,
  );
  wristEyeBody.position.x = rodLength;
  wristEyeBody.userData.role = 'connecting-rod-slide-eye-body';

  const crankEye = boredCylinderAlongZ(eyeRadius * .95, crankBore, .012, darkMaterial);
  crankEye.position.z = depth / 2 + .006;
  crankEye.userData.role = 'connecting-rod-crank-pin-eye';
  const wristEye = boredCylinderAlongZ(eyeRadius * .78, wristBore, .012, darkMaterial);
  wristEye.position.set(rodLength, 0, depth / 2 + .006);
  wristEye.userData.role = 'connecting-rod-slide-A-eye';

  const crankEyeAnchor = new THREE.Object3D();
  crankEyeAnchor.userData.role = 'analytic-connecting-rod-crank-eye';
  const wristEyeAnchor = new THREE.Object3D();
  wristEyeAnchor.position.x = rodLength;
  wristEyeAnchor.userData.role = 'analytic-connecting-rod-slide-eye';

  rod.add(
    body,
    crankEyeBody,
    wristEyeBody,
    crankEye,
    wristEye,
    crankEyeAnchor,
    wristEyeAnchor,
  );
  return {
    body,
    crankEye,
    crankEyeAnchor,
    rod,
    wristEye,
    wristEyeAnchor,
  };
}

function makeEdgeWrappingSlideShoe({
  accentMaterial,
  frameBackZ,
  frameDepth,
  frameFrontZ,
  guideEdgeX,
  height,
  scale,
  side,
}) {
  const shoe = new THREE.Group();
  shoe.userData.contactSurfaceX = guideEdgeX;
  shoe.userData.hasRoller = false;
  shoe.userData.role = `${side}-plain-slide-shoe-A-wrapping-planed-edge`;

  const cheekWidth = 0.50 * scale;
  const cheekDepth = 0.16;
  const frontCheek = new THREE.Mesh(
    new THREE.BoxGeometry(cheekWidth, height, cheekDepth),
    accentMaterial,
  );
  frontCheek.position.set(
    guideEdgeX,
    0,
    frameFrontZ + cheekDepth / 2 + 0.015,
  );
  frontCheek.userData.role = `${side}-front-planed-slide-cheek`;
  const rearCheek = new THREE.Mesh(
    new THREE.BoxGeometry(cheekWidth, height, cheekDepth),
    accentMaterial,
  );
  rearCheek.position.set(
    guideEdgeX,
    0,
    frameBackZ - cheekDepth / 2 - 0.015,
  );
  rearCheek.userData.role = `${side}-rear-planed-slide-cheek`;

  const webWidth = 0.25 * scale;
  const inwardSign = side === 'left' ? 1 : -1;
  const web = new THREE.Mesh(
    new THREE.BoxGeometry(webWidth, height * 0.86, frameDepth * 0.92),
    accentMaterial,
  );
  web.position.x = guideEdgeX + inwardSign * webWidth / 2;
  web.userData.role = `${side}-shoe-web-inside-real-guide-slot`;
  shoe.add(frontCheek, rearCheek, web);
  shoe.userData.frontCheek = frontCheek;
  shoe.userData.rearCheek = rearCheek;
  shoe.userData.web = web;
  return shoe;
}

function verticalPlanedSlotPistonGuide(movement) {
  const root = new THREE.Group();

  // Exact dimensioned coordinates from the official 525 px canvas model.
  // A uniform scale converts them to a compact 3D study without changing
  // any length ratio or the finite connecting-rod law.
  const sourceScale = 0.22;
  const sourceCrankRadius = 4;
  const sourceConnectingRodLength = 15.5;
  const sourceFlywheelOuterRadius = 15;
  const sourceFlywheelInnerRadius = 13;
  const sourceGuideSlotUpperCenterY = -9.875;
  const sourceGuideSlotLowerCenterY = -21.125;
  const sourceGuideSlotHalfWidth = 1;
  const sourceSlideHeight = 2.75;
  const sourcePistonRodTopLocalY = -1.536438;
  const sourcePistonRodBottomLocalY = -17.75;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const crankAngularSpeed = FULL_TURN / cyclePeriod;

  const crankRadius = sourceCrankRadius * sourceScale;
  const connectingRodLength = sourceConnectingRodLength * sourceScale;
  const flywheelOuterRadius = sourceFlywheelOuterRadius * sourceScale;
  const flywheelInnerRadius = sourceFlywheelInnerRadius * sourceScale;
  const guideSlotUpperCenterY = sourceGuideSlotUpperCenterY * sourceScale;
  const guideSlotLowerCenterY = sourceGuideSlotLowerCenterY * sourceScale;
  const guideSlotHalfWidth = sourceGuideSlotHalfWidth * sourceScale;
  const slideHeight = sourceSlideHeight * sourceScale;
  const pistonRodTopLocalY = sourcePistonRodTopLocalY * sourceScale;
  const pistonRodBottomLocalY = sourcePistonRodBottomLocalY * sourceScale;
  const pistonStroke = 2 * crankRadius;
  const frameBaseTopY = -24.625 * sourceScale;
  const frameBaseBottomY = -27.625 * sourceScale;

  const frameDepth = 0.36;
  const frameCenterZ = 0;
  const frameFrontZ = frameCenterZ + frameDepth / 2;
  const frameBackZ = frameCenterZ - frameDepth / 2;
  const flywheelDepth = 0.24;
  const flywheelPlaneZ = -0.62;
  const crankDepth = 0.20;
  const crankPlaneZ = 0.46;
  const connectingRodDepth = 0.15;
  const connectingRodPlaneZ = 0.76;
  const crankPinRadius = 0.3125 * sourceScale;
  const wristPinRadius = 0.50 * sourceScale;
  const hubRadius = 1.03 * sourceScale;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.10,
    roughness: 0.72,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.09,
    roughness: 0.63,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.09,
    roughness: 0.62,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-engine-frame-with-one-real-vertical-planed-slot';

  const framePlate = new THREE.Mesh(
    centeredExtrusion(
      sourceFrameShape(sourceScale),
      frameDepth,
      0,
    ),
    frameMaterial,
  );
  framePlate.position.z = frameCenterZ;
  framePlate.userData.fixed = true;
  framePlate.userData.openingCount = 1;
  framePlate.userData.role =
    'source-proportioned-frame-solid-minus-real-guide-opening';

  const standardSkinBackZ = 0.91;
  const standardSkinFrontZ = 0.97;
  const hollowStandard = hollowStandardOutlines(sourceScale, 0.10, 1.6);
  const standardFrontSkin = new THREE.Mesh(
    plate(hollowStandard.skin, standardSkinBackZ, standardSkinFrontZ),
    frameMaterial,
  );
  standardFrontSkin.userData.fixed = true;
  standardFrontSkin.userData.role =
    'hollow-standard-front-skin-with-window-over-the-slot';
  const standardSideWalls = new THREE.Mesh(
    plate(hollowStandard.walls, frameFrontZ, standardSkinBackZ),
    frameMaterial,
  );
  standardSideWalls.userData.fixed = true;
  standardSideWalls.userData.role =
    'hollow-standard-side-walls-under-the-cap';

  // The crank dips below the standard's top edge, so the cap is set down
  // inside the walls, just below the crank's sweep: it closes the hollow
  // standard except for a narrow transverse slot in front of it, through
  // which the connecting rod swings. Its outline is the walls' own inner
  // outline, so it meets them exactly.
  const capTopY = -(crankRadius + crankPinRadius * 1.65) - 0.065;
  const capThickness = 0.06;
  const connectingRodSlotBackZ = connectingRodPlaneZ
    - connectingRodDepth / 2 - 0.04;
  const capHalfWidth = 5 * sourceScale;
  const standardCap = new THREE.Mesh(
    plate(polygonClipping.intersection(hollowStandard.inner, poly([
      [-capHalfWidth, capTopY - capThickness], [capHalfWidth, capTopY - capThickness],
      [capHalfWidth, capTopY], [-capHalfWidth, capTopY],
    ])), frameFrontZ, connectingRodSlotBackZ),
    frameMaterial,
  );
  standardCap.userData.fixed = true;
  standardCap.userData.role =
    'hollow-standard-recessed-cap-with-connecting-rod-slot-in-front';

  // The piston rod runs down inside the hollow standard into a bore in the
  // foot. The foot is deep enough to hide the rod's end at the bottom of
  // the stroke; at the top of the stroke the end is below the skin window.
  const pistonRodRadius = 0.07;
  const pistonRodZ = frameFrontZ + 0.16;
  const topStrokeWristY = -(sourceConnectingRodLength - sourceCrankRadius)
    * sourceScale;
  const bottomStrokeWristY = -(sourceConnectingRodLength + sourceCrankRadius)
    * sourceScale;
  const windowBottomY = guideSlotLowerCenterY - 1.6 * sourceScale;
  const pistonRodBottomLocal = windowBottomY - 0.10 - topStrokeWristY;
  const footBoreBottomY = bottomStrokeWristY + pistonRodBottomLocal - 0.03;
  const footBottomY = footBoreBottomY - 0.05;
  const footOutline = poly([
    [-7 * sourceScale, frameBackZ], [7 * sourceScale, frameBackZ],
    [7 * sourceScale, standardSkinFrontZ + 0.03],
    [-7 * sourceScale, standardSkinFrontZ + 0.03],
  ]);
  const footGeometry = (outline, bottom, top) => {
    const geometry = plate(outline, -top, -bottom);
    geometry.rotateX(Math.PI / 2);
    return geometry;
  };
  const foundationFoot = new THREE.Mesh(
    footGeometry(polygonClipping.difference(footOutline,
      poly(circle([0, pistonRodZ], pistonRodRadius + 0.012, 48))),
    footBoreBottomY, frameBaseTopY),
    frameMaterial,
  );
  foundationFoot.userData.fixed = true;
  foundationFoot.userData.role = 'deep-engine-standard-foundation-foot';
  const foundationSole = new THREE.Mesh(
    footGeometry(footOutline, footBottomY, footBoreBottomY),
    frameMaterial,
  );
  foundationSole.userData.fixed = true;
  foundationSole.userData.role = 'foundation-foot-sole-closing-the-rod-bore';

  const straightGuideLength = guideSlotUpperCenterY
    - guideSlotLowerCenterY;
  const guideCenterY = (guideSlotUpperCenterY
    + guideSlotLowerCenterY) / 2;
  const leftPlanedFace = new THREE.Mesh(
    new THREE.BoxGeometry(0.024, straightGuideLength, 0.075),
    darkMaterial,
  );
  // Each strip is set 0.003 back from the slot wall into the frame and
  // stands 0.003 proud of the frame's front face. Flush, both faces lay in
  // the frame's own and z-fought; the frame's slot wall is the sliding face.
  const planedFaceOffset = 0.003;
  leftPlanedFace.position.set(
    -guideSlotHalfWidth - .012 - planedFaceOffset,
    guideCenterY,
    frameFrontZ - .0375 + planedFaceOffset,
  );
  leftPlanedFace.userData.fixed = true;
  leftPlanedFace.userData.role = 'left-planed-true-guide-surface';
  const rightPlanedFace = leftPlanedFace.clone();
  rightPlanedFace.position.x = guideSlotHalfWidth + .012 + planedFaceOffset;
  rightPlanedFace.userData.fixed = true;
  rightPlanedFace.userData.role = 'right-planed-true-guide-surface';

  const bearingHousing = boredCylinderAlongZ(
    1.75 * sourceScale, 1.02 * sourceScale,
    0.54,
    frameMaterial,
    48,
  );
  bearingHousing.position.z = 0.04;
  bearingHousing.userData.fixed = true;
  bearingHousing.userData.role = 'fixed-crankshaft-bearing-housing';
  const bearingBore = boredCylinderAlongZ(
    1.02 * sourceScale, .72 * sourceScale + .004,
    0.565,
    darkMaterial,
    42,
  );
  bearingBore.position.z = 0.045;
  bearingBore.userData.fixed = true;
  bearingBore.userData.role = 'fixed-bearing-bore-around-live-shaft';

  const pillowBlockShape = new THREE.Shape();
  pillowBlockShape.moveTo(-2.1 * sourceScale, -2.25 * sourceScale);
  pillowBlockShape.lineTo(2.1 * sourceScale, -2.25 * sourceScale);
  pillowBlockShape.lineTo(2.1 * sourceScale, -1.72 * sourceScale);
  pillowBlockShape.lineTo(1.1 * sourceScale, -1.45 * sourceScale);
  pillowBlockShape.lineTo(-1.1 * sourceScale, -1.45 * sourceScale);
  pillowBlockShape.lineTo(-2.1 * sourceScale, -1.72 * sourceScale);
  pillowBlockShape.closePath();
  const pillowBlock = new THREE.Mesh(
    centeredExtrusion(pillowBlockShape, frameDepth, 0),
    frameMaterial,
  );
  pillowBlock.position.z = frameCenterZ;
  pillowBlock.userData.fixed = true;
  pillowBlock.userData.role = 'crankshaft-pillow-block-foot-on-frame-cap';
  const bearingSupports = [pillowBlock];

  const guideAxisTopAnchor = new THREE.Object3D();
  guideAxisTopAnchor.position.set(0, guideSlotUpperCenterY, 0);
  guideAxisTopAnchor.userData.fixed = true;
  guideAxisTopAnchor.userData.role = 'analytic-guide-axis-upper-center';
  const guideAxisBottomAnchor = new THREE.Object3D();
  guideAxisBottomAnchor.position.set(0, guideSlotLowerCenterY, 0);
  guideAxisBottomAnchor.userData.fixed = true;
  guideAxisBottomAnchor.userData.role = 'analytic-guide-axis-lower-center';

  fixedFrame.add(
    framePlate,
    standardFrontSkin,
    standardSideWalls,
    standardCap,
    foundationFoot,
    foundationSole,
    leftPlanedFace,
    rightPlanedFace,
    ...bearingSupports,
    bearingHousing,
    bearingBore,
    guideAxisTopAnchor,
    guideAxisBottomAnchor,
  );

  const rotorParts = makeFlywheelCrankRotor({
    crankDepth,
    crankPinRadius,
    crankPlaneZ,
    crankRadius,
    darkMaterial,
    driverMaterial,
    flywheelDepth,
    flywheelInnerRadius,
    flywheelOuterRadius,
    flywheelPlaneZ,
    hubRadius,
    scale: sourceScale,
    showIndices: false,
    whiteMaterial,
  });

  const liveShaft = cylinderAlongZ(
    0.72 * sourceScale,
    crankPlaneZ + crankDepth / 2 + .025 - (flywheelPlaneZ - .20),
    darkMaterial,
    36,
  );
  liveShaft.position.z = (crankPlaneZ + crankDepth / 2 + .025 + flywheelPlaneZ - .20) / 2;
  liveShaft.userData.axis = Z_AXIS.clone();
  liveShaft.userData.role = 'live-crankshaft-through-flywheel-and-bearing';
  rotorParts.rotor.add(liveShaft);

  const rodParts = makeConnectingRod({
    darkMaterial,
    depth: connectingRodDepth,
    drivenMaterial,
    eyeRadius: 0.66 * sourceScale,
    crankBore: crankPinRadius + .004,
    wristBore: wristPinRadius * .58 + .004,
    rodLength: connectingRodLength,
  });

  const slideA = new THREE.Group();
  slideA.userData.hasRollers = false;
  slideA.userData.role =
    'slide-A-captured-by-two-planed-vertical-slot-edges';
  slideA.userData.rotationDegreesOfFreedom = 0;
  slideA.userData.translationAxis = Y_AXIS.clone();

  const leftShoe = makeEdgeWrappingSlideShoe({
    accentMaterial,
    frameBackZ,
    frameDepth,
    frameFrontZ,
    guideEdgeX: -guideSlotHalfWidth,
    height: slideHeight,
    scale: sourceScale,
    side: 'left',
  });
  const rightShoe = makeEdgeWrappingSlideShoe({
    accentMaterial,
    frameBackZ,
    frameDepth,
    frameFrontZ,
    guideEdgeX: guideSlotHalfWidth,
    height: slideHeight,
    scale: sourceScale,
    side: 'right',
  });

  const crossheadBridge = new THREE.Mesh(
    new THREE.BoxGeometry(
      1.55 * sourceScale,
      0.70 * sourceScale,
      0.16,
    ),
    accentMaterial,
  );
  crossheadBridge.position.z = frameFrontZ + 0.16;
  crossheadBridge.userData.role =
    'rigid-crosshead-bridge-between-the-two-slide-shoes';
  const wristBoss = cylinderAlongZ(
    wristPinRadius * 1.45,
    0.20,
    accentMaterial,
    36,
  );
  wristBoss.position.z = frameFrontZ + 0.22;
  wristBoss.userData.role = 'slide-A-central-wrist-boss';

  // A round rod from the crosshead bridge down inside the standard.
  const pistonRodTopLocal = 0.05;
  const pistonRod = new THREE.Mesh(
    new THREE.CylinderGeometry(pistonRodRadius, pistonRodRadius,
      pistonRodTopLocal - pistonRodBottomLocal, 40),
    accentMaterial,
  );
  pistonRod.position.set(0, (pistonRodTopLocal + pistonRodBottomLocal) / 2,
    pistonRodZ);
  pistonRod.userData.role = 'rigid-piston-rod-carried-by-slide-A';

  const wristPinAnchor = new THREE.Object3D();
  wristPinAnchor.position.z = connectingRodPlaneZ;
  wristPinAnchor.userData.role = 'analytic-slide-A-wrist-pin-center';

  slideA.add(
    leftShoe,
    rightShoe,
    pistonRod,
    crossheadBridge,
    wristBoss,
    wristPinAnchor,
  );

  const crankPinShaft = cylinderAlongZ(
    crankPinRadius,
    connectingRodPlaneZ - crankPlaneZ + 0.26,
    darkMaterial,
    30,
  );
  crankPinShaft.position.set(crankRadius, 0,
    (connectingRodPlaneZ + crankPlaneZ) / 2);
  crankPinShaft.userData.role =
    'crank-pin-joining-crank-web-to-connecting-rod';
  rotorParts.rotor.add(crankPinShaft);
  const wristPinShaft = cylinderAlongZ(
    wristPinRadius * 0.58,
    connectingRodPlaneZ - frameBackZ + 0.22,
    darkMaterial,
    30,
  );
  wristPinShaft.position.z = (connectingRodPlaneZ + frameBackZ) / 2;
  wristPinShaft.userData.role =
    'wrist-pin-joining-connecting-rod-to-slide-A';
  slideA.add(wristPinShaft);

  root.add(
    rotorParts.rotor,
    fixedFrame,
    slideA,
    rodParts.rod,
  );

  const cross2 = (left, right) => left.x * right.y
    - left.y * right.x;

  const stateAtCrankAngle = (
    unwrappedCrankAngle,
    angularVelocity = crankAngularSpeed,
  ) => {
    const crankAngle = positiveModulo(unwrappedCrankAngle, FULL_TURN);
    const cosine = Math.cos(crankAngle);
    const sine = Math.sin(crankAngle);
    const crankPin = new THREE.Vector2(
      crankRadius * cosine,
      crankRadius * sine,
    );
    const crankPinVelocity = new THREE.Vector2(
      -crankRadius * sine * angularVelocity,
      crankRadius * cosine * angularVelocity,
    );
    const crankPinAcceleration = new THREE.Vector2(
      -crankRadius * cosine * angularVelocity ** 2,
      -crankRadius * sine * angularVelocity ** 2,
    );

    const circleLineRadicand = connectingRodLength ** 2
      - crankPin.x ** 2;
    const circleLineRoot = Math.sqrt(Math.max(0, circleLineRadicand));
    const rootFirstByAngle = crankRadius ** 2
      * cosine * sine / circleLineRoot;
    const rootSecondByAngle = crankRadius ** 2
      * (cosine ** 2 - sine ** 2) / circleLineRoot
      - (crankRadius ** 2 * cosine * sine) ** 2
        / circleLineRoot ** 3;
    const sliderY = crankPin.y - circleLineRoot;
    const sliderFirstByAngle = crankRadius * cosine
      - rootFirstByAngle;
    const sliderSecondByAngle = -crankRadius * sine
      - rootSecondByAngle;
    const sliderVelocityY = sliderFirstByAngle * angularVelocity;
    const sliderAccelerationY = sliderSecondByAngle
      * angularVelocity ** 2;
    const wristPin = new THREE.Vector2(0, sliderY);
    const wristPinVelocity = new THREE.Vector2(0, sliderVelocityY);
    const wristPinAcceleration = new THREE.Vector2(
      0,
      sliderAccelerationY,
    );
    const rodVector = wristPin.clone().sub(crankPin);
    const rodRelativeVelocity = wristPinVelocity.clone()
      .sub(crankPinVelocity);
    const rodRelativeAcceleration = wristPinAcceleration.clone()
      .sub(crankPinAcceleration);
    const rodLengthSquared = rodVector.lengthSq();
    const rodAngularVelocity = cross2(
      rodVector,
      rodRelativeVelocity,
    ) / rodLengthSquared;
    const rodAngularAcceleration = (
      cross2(rodVector, rodRelativeAcceleration) * rodLengthSquared
        - cross2(rodVector, rodRelativeVelocity)
          * 2 * rodVector.dot(rodRelativeVelocity)
    ) / rodLengthSquared ** 2;
    const phase = crankAngle / FULL_TURN;

    return {
      circleLineRadicand,
      circleLineRoot,
      crankAngle,
      crankAngularAcceleration: 0,
      crankAngularVelocity: angularVelocity,
      crankPin,
      crankPinAcceleration,
      crankPinVelocity,
      guide: {
        axisResidual: wristPin.x,
        leftContactResidual:
          wristPin.x - guideSlotHalfWidth - (-guideSlotHalfWidth),
        rightContactResidual:
          wristPin.x + guideSlotHalfWidth - guideSlotHalfWidth,
        rotation: 0,
        rotationResidual: 0,
      },
      phase,
      pistonRod: {
        acceleration: new THREE.Vector2(0, sliderAccelerationY),
        position: wristPin.clone(),
        rotation: 0,
        velocity: new THREE.Vector2(0, sliderVelocityY),
      },
      rodAngle: Math.atan2(rodVector.y, rodVector.x),
      rodAngularAcceleration,
      rodAngularVelocity,
      rodLength: rodVector.length(),
      rodLengthResidual: rodVector.length() - connectingRodLength,
      rodVector,
      slideA: {
        acceleration: new THREE.Vector2(0, sliderAccelerationY),
        position: wristPin.clone(),
        rotation: 0,
        velocity: new THREE.Vector2(0, sliderVelocityY),
      },
      sliderAccelerationY,
      sliderFirstByAngle,
      sliderSecondByAngle,
      sliderVelocityY,
      sliderY,
      unwrappedCrankAngle,
      wristPin,
      wristPinAcceleration,
      wristPinVelocity,
    };
  };

  const stateAtTime = (time) => {
    const elapsed = Number.isFinite(Number(time)) ? Number(time) : 0;
    return stateAtCrankAngle(elapsed * crankAngularSpeed);
  };

  const canonicalTimes = {
    bottomDeadCenter: cyclePeriod * 0.75,
    cycleClosure: cyclePeriod,
    oppositeQuadrature: cyclePeriod * 0.50,
    sourceStart: 0,
    topDeadCenter: cyclePeriod * 0.25,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const officialViewMinimum = new THREE.Vector2(-16.5, -27.875);
  const officialViewWidth = 33;
  const officialViewHeight = 33;
  const officialCanvasWidth = 525;
  const officialCanvasHeight = 525;
  const modelPointToOfficialAnimationRaster = (point) => {
    const rawX = point.x / sourceScale;
    const rawY = point.y / sourceScale;
    return new THREE.Vector2(
      (rawX - officialViewMinimum.x)
        * officialCanvasWidth / officialViewWidth,
      officialCanvasHeight - (rawY - officialViewMinimum.y)
        * officialCanvasHeight / officialViewHeight,
    );
  };

  const sourceRasterCrankCenter = new THREE.Vector2(258, 89);
  const sourceRasterCrankPin = new THREE.Vector2(313, 91);
  const engravingScale = crankRadius
    / sourceRasterCrankCenter.distanceTo(sourceRasterCrankPin);
  const engravingPointToModelFront = (point) => new THREE.Vector3(
    (point.x - sourceRasterCrankCenter.x) * engravingScale,
    (sourceRasterCrankCenter.y - point.y) * engravingScale,
    connectingRodPlaneZ + connectingRodDepth / 2,
  );

  const geometry = {
    connectingRodDepth,
    connectingRodLength,
    connectingRodPlaneZ,
    crankDepth,
    crankPinRadius,
    crankPlaneZ,
    crankRadius,
    crankToStrokeRatio: pistonStroke / crankRadius,
    crankAngularSpeed,
    cyclePeriod,
    flywheelDepth,
    flywheelInnerRadius,
    flywheelOuterRadius,
    flywheelPlaneZ,
    frameBackZ,
    frameBaseBottomY,
    frameBaseTopY,
    frameCenterZ,
    frameDepth,
    frameFrontZ,
    guideSlotHalfWidth,
    guideSlotLowerCenterY,
    guideSlotUpperCenterY,
    pistonRodBottomLocalY,
    pistonRodTopLocalY,
    pistonStroke,
    renderedPistonRodBottomLocalY: pistonRodBottomLocal,
    slideHeight,
    sourceConnectingRodLength,
    sourceCrankRadius,
    sourceCyclesPerMinute,
    sourceFlywheelInnerRadius,
    sourceFlywheelOuterRadius,
    sourceGuideSlotHalfWidth,
    sourceGuideSlotLowerCenterY,
    sourceGuideSlotUpperCenterY,
    sourcePistonRodBottomLocalY,
    sourcePistonRodTopLocalY,
    sourceScale,
    wristPinRadius,
  };

  const contacts = {
    leftPlanedSlidingPair: {
      fixedMember: leftPlanedFace,
      movingMember: leftShoe,
      normal: new THREE.Vector3(1, 0, 0),
      relativeSlidingSpeed: 0,
      type: 'zero-clearance-planed-prismatic-contact',
    },
    rightPlanedSlidingPair: {
      fixedMember: rightPlanedFace,
      movingMember: rightShoe,
      normal: new THREE.Vector3(-1, 0, 0),
      relativeSlidingSpeed: 0,
      type: 'zero-clearance-planed-prismatic-contact',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    rotorParts.rotor.rotation.z = state.crankAngle;
    slideA.position.set(0, state.sliderY, 0);
    rodParts.rod.position.set(
      state.crankPin.x,
      state.crankPin.y,
      connectingRodPlaneZ,
    );
    rodParts.rod.rotation.z = state.rodAngle;
    contacts.leftPlanedSlidingPair.relativeSlidingSpeed =
      state.sliderVelocityY;
    contacts.rightPlanedSlidingPair.relativeSlidingSpeed =
      state.sliderVelocityY;
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    'vertical-planed-slot-crosshead-slider-crank';
  root.userData.blocks = {
    bearingBore,
    bearingHousing,
    bearingSupports,
    connectingRod: rodParts.rod,
    connectingRodBody: rodParts.body,
    connectingRodCrankEyeAnchor: rodParts.crankEyeAnchor,
    connectingRodWristEyeAnchor: rodParts.wristEyeAnchor,
    crankArm: rotorParts.crankArm,
    crankCenterAnchor: rotorParts.crankCenterAnchor,
    crankDisk: rotorParts.crankDisk,
    crankPinAnchor: rotorParts.crankPinAnchor,
    crankPinShaft,
    crankRotationIndex: rotorParts.crankRotationIndex,
    fixedFrame,
    flywheel: rotorParts.rotor,
    flywheelHub: rotorParts.rearHub,
    flywheelRim: rotorParts.rim,
    flywheelRotationIndex: rotorParts.flywheelRotationIndex,
    flywheelSpokes: rotorParts.spokes,
    foundationFoot,
    framePlate,
    guideAxisBottomAnchor,
    guideAxisTopAnchor,
    leftPlanedFace,
    leftSlideShoe: leftShoe,
    liveShaft,
    pistonRod,
    rightPlanedFace,
    rightSlideShoe: rightShoe,
    slideA,
    slideBridge: crossheadBridge,
    standardCap,
    foundationSole,
    standardFrontSkin,
    standardSideWalls,
    wristBoss,
    wristPinAnchor,
    wristPinShaft,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one continuous crankshaft rotation about the fixed z-axis',
    mechanism: 1,
    output: 'one vertical translation of slide A and its piston-rod',
    slideRotation: 0,
    slideTranslationAxes: 1,
  };
  root.userData.engravingPointToModelFront = engravingPointToModelFront;
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = footBottomY - 0.025;
  root.userData.mechanism =
    'one-rigid-flywheel-crank-finite-connecting-rod-slide-A-in-one-real-planed-vertical-slot';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: sourceCyclesPerMinute,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialGeometry: {
      connectingRodLength: sourceConnectingRodLength,
      crankPinRadius: 0.3125,
      crankRadius: sourceCrankRadius,
      flywheelInnerRadius: sourceFlywheelInnerRadius,
      flywheelOuterRadius: sourceFlywheelOuterRadius,
      guideAxisX: 0,
      guideSlotHalfWidth: sourceGuideSlotHalfWidth,
      guideSlotLowerCenterY: sourceGuideSlotLowerCenterY,
      guideSlotUpperCenterY: sourceGuideSlotUpperCenterY,
      pistonRodBottomLocalY: sourcePistonRodBottomLocalY,
      pistonRodTopLocalY: sourcePistonRodTopLocalY,
      slideHeight: sourceSlideHeight,
    },
    officialKeyframes: [
      {
        crankPin: new THREE.Vector2(4, 0),
        phase: 0,
        slidePin: new THREE.Vector2(
          0,
          -Math.sqrt(15.5 ** 2 - 4 ** 2),
        ),
      },
      {
        crankPin: new THREE.Vector2(0, 4),
        phase: 0.25,
        slidePin: new THREE.Vector2(0, -11.5),
      },
      {
        crankPin: new THREE.Vector2(-4, 0),
        phase: 0.50,
        slidePin: new THREE.Vector2(
          0,
          -Math.sqrt(15.5 ** 2 - 4 ** 2),
        ),
      },
      {
        crankPin: new THREE.Vector2(0, -4),
        phase: 0.75,
        slidePin: new THREE.Vector2(0, -19.5),
      },
      {
        crankPin: new THREE.Vector2(4, 0),
        phase: 1,
        slidePin: new THREE.Vector2(
          0,
          -Math.sqrt(15.5 ** 2 - 4 ** 2),
        ),
      },
    ],
    officialPageAnimatedTabDisabled: false,
    referenceScope:
      'official flywheel, four-unit crank, 15.5-unit connecting rod, slide A, piston-rod, and true-surface vertical guide dimensions and timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate326: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one flywheel and crankshaft, one connecting rod, one crosshead slide A without rollers, one piston-rod, and one vertical planed slot',
      measurementUncertaintyPixels: 30,
      rasterCrankCenter: sourceRasterCrankCenter,
      rasterCrankPin: sourceRasterCrankPin,
      rasterGuideAxisBottom: new THREE.Vector2(258, 444),
      rasterGuideAxisTop: new THREE.Vector2(258, 258),
      rasterSlidePin: new THREE.Vector2(258, 329),
    },
    officialAnimationView: {
      canvasHeight: officialCanvasHeight,
      canvasWidth: officialCanvasWidth,
      minimum: officialViewMinimum,
      viewHeight: officialViewHeight,
      viewWidth: officialViewWidth,
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtCrankAngle = stateAtCrankAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    connectingRodConstraint:
      'sqrt((0-crankX)^2 + (slideY-crankY)^2) = 15.5 source units',
    input: 'one rigid flywheel and four-unit crank rotating at 15 rpm',
    output:
      'slide A and its piston-rod translate vertically through an eight-unit stroke with zero yaw',
    sliderLaw:
      'y = r*sin(theta) - sqrt(L^2 - r^2*cos(theta)^2)',
    strokeToCrankRadiusRatio: 2,
  };

  finishGuidePresentation(root, update, cyclePeriod);
  root.userData.sweptBounds = root.userData.cameraFitBounds;
  // Brown's plate crops the flywheel rim above the crank and sits the
  // standard's foot on the lower edge.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-11.9 * sourceScale, -24.4 * sourceScale, -0.75),
    new THREE.Vector3(14.1 * sourceScale, 3.4 * sourceScale, 0.90),
  );
  // Fit the whole flywheel as well: cropped by the canvas in every view it
  // read as a broken-off wheel.
  {
    let rim = null;
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      if (object.isMesh && /flywheel-rim/.test(object.userData.role ?? '')) rim = object;
    });
    if (rim) root.userData.cameraFitBounds.union(new THREE.Box3().setFromObject(rim).expandByScalar(0.05));
  }
  root.userData.cameraDistanceScale = 0.96;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.45, 0.28, 14),
    root,
    update,
  };
}

function makeGuideRoller({
  accentMaterial,
  darkMaterial,
  depth,
  planeZ,
  radius,
  role,
}) {
  const roller = new THREE.Group();
  roller.userData.axis = Z_AXIS.clone();
  roller.userData.radius = radius;
  roller.userData.role = role;

  const bore = radius / 3 + .004;
  // The disk itself is the rolling tread (no separate ink rim); enough
  // facets keep its polygonal edge within 0.0001 of the guide face.
  const disk = boredCylinderAlongZ(radius, bore, depth, accentMaterial, 128);
  disk.position.z = planeZ;
  disk.userData.role = `${role}-solid-rolling-disk`;
  const hub = boredCylinderAlongZ(radius * .45, bore, depth * 1.18, darkMaterial);
  hub.position.z = planeZ;
  hub.userData.role = `${role}-rotating-hub`;
  roller.add(disk, hub);
  roller.userData.tread = disk;
  roller.userData.disk = disk;
  roller.userData.hub = hub;
  return roller;
}

function rollerGuidedFrenchEngineCrosshead(movement) {
  const root = new THREE.Group();

  // The official animation publishes a second, independent engine layout.
  // It is not Movement 326 with decorative wheels added: its crank is 3
  // units, rod 19, stroke 6, roller centers +/-4.375, roller radii 1.5,
  // and the guide-bar working faces +/-5.875 from the piston axis.
  const sourceScale = 0.21;
  const sourceCrankRadius = 3;
  const sourceConnectingRodLength = 19;
  const sourceFlywheelOuterRadius = 15;
  const sourceFlywheelInnerRadius = 13;
  const sourceRollerRadius = 1.5;
  const sourceRollerCenterHalfSpacing = 4.375;
  const sourceGuideBarCenterHalfSpacing = 6.25;
  const sourceGuideBarHalfWidth = 0.375;
  const sourceGuideContactHalfSpacing = 5.875;
  const sourcePistonRodTopLocalY = -0.375;
  const sourcePistonRodBottomLocalY = -14;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const crankAngularSpeed = FULL_TURN / cyclePeriod;
  const crankInitialAngle = Math.PI / 2;

  const crankRadius = sourceCrankRadius * sourceScale;
  const connectingRodLength = sourceConnectingRodLength * sourceScale;
  const flywheelOuterRadius = sourceFlywheelOuterRadius * sourceScale;
  const flywheelInnerRadius = sourceFlywheelInnerRadius * sourceScale;
  const rollerRadius = sourceRollerRadius * sourceScale;
  const rollerCenterHalfSpacing = sourceRollerCenterHalfSpacing
    * sourceScale;
  const guideBarCenterHalfSpacing = sourceGuideBarCenterHalfSpacing
    * sourceScale;
  const guideBarHalfWidth = sourceGuideBarHalfWidth * sourceScale;
  const guideContactHalfSpacing = sourceGuideContactHalfSpacing
    * sourceScale;
  const pistonRodTopLocalY = sourcePistonRodTopLocalY * sourceScale;
  const pistonRodBottomLocalY = sourcePistonRodBottomLocalY * sourceScale;
  const pistonStroke = 2 * crankRadius;
  const frameBottomY = -30 * sourceScale;

  // Brown draws the flywheel wholly behind the crossbeam and both columns.
  const flywheelPlaneZ = -0.56;
  const flywheelDepth = 0.24;
  const frameCenterZ = 0;
  const frameDepth = 0.42;
  const frameFrontZ = frameCenterZ + frameDepth / 2;
  const crankPlaneZ = 0.47;
  const crankDepth = 0.20;
  const rollerPlaneZ = 0.30;
  const rollerDepth = 0.22;
  const crossheadPlaneZ = 0.56;
  const connectingRodPlaneZ = 0.76;
  const connectingRodDepth = 0.15;
  const crankPinRadius = 0.3125 * sourceScale;
  const wristPinRadius = 0.50 * sourceScale;
  const hubRadius = 1.02 * sourceScale;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.10,
    roughness: 0.72,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.09,
    roughness: 0.63,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.09,
    roughness: 0.62,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-French-small-engine-frame-with-two-straight-guide-bars-A-A';

  const topBeamTopY = -1.0625 * sourceScale;
  const topBeamBottomY = -3.0625 * sourceScale;
  const topBeam = new THREE.Mesh(
    new THREE.BoxGeometry(
      36 * sourceScale,
      topBeamTopY - topBeamBottomY,
      0.62,
    ),
    frameMaterial,
  );
  topBeam.position.set(
    0,
    (topBeamTopY + topBeamBottomY) / 2,
    -0.04,
  );
  topBeam.userData.fixed = true;
  topBeam.userData.role = 'wide-fixed-overhead-engine-crossbeam';

  const guideBarTopY = -3.0625 * sourceScale;
  const guideBarBottomY = frameBottomY;
  const guideBarHeight = guideBarTopY - guideBarBottomY;
  const guideBarCenterY = (guideBarTopY + guideBarBottomY) / 2;
  // The plate's columns are about twice the official bar width; the inner
  // working face stays on the official +/-5.875 contact line.
  const columnWidth = 1.5 * sourceScale;
  const guideCapsuleWidth = 1.2 * sourceScale;
  const sourceTopSliderY = sourceCrankRadius - sourceConnectingRodLength;
  const guideCapsuleUpperY = (sourceTopSliderY + 0.4) * sourceScale;
  // Long enough that the rollers stay on the straps at the bottom of the
  // stroke (they ran 0.1 past the old lower ends).
  const guideCapsuleLowerY = (sourceTopSliderY - 7.4) * sourceScale;
  const makeGuideBar = (side) => {
    const group = new THREE.Group();
    const contactX = side * guideContactHalfSpacing;
    const centerX = contactX + side * columnWidth / 2;
    group.userData.centerX = centerX;
    group.userData.contactX = contactX;
    group.userData.fixed = true;
    group.userData.role =
      `${side < 0 ? 'left' : 'right'}-straight-guide-bar-A`;

    // The column's inner face stands 0.003 behind the strap's working edge
    // (both lay on the contact line and z-fought); the strap alone carries it.
    const columnFaceRelief = 0.003;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(
        columnWidth - columnFaceRelief,
        guideBarHeight,
        frameDepth,
      ),
      frameMaterial,
    );
    body.position.set(centerX + side * columnFaceRelief / 2, guideBarCenterY, frameCenterZ);
    body.userData.fixed = true;
    body.userData.role = `${group.userData.role}-column-body`;
    // Brown's A is a round-ended guide strap on the column's inner face,
    // drawn with its inner outline; the roller treads bear on its straight edge.
    const capsuleX = contactX + side * guideCapsuleWidth / 2;
    const capsuleRadius = guideCapsuleWidth / 2;
    const capsuleShape = new THREE.Shape();
    capsuleShape.moveTo(capsuleX + capsuleRadius, guideCapsuleLowerY);
    capsuleShape.lineTo(capsuleX + capsuleRadius, guideCapsuleUpperY);
    capsuleShape.absarc(capsuleX, guideCapsuleUpperY, capsuleRadius, 0, Math.PI, false);
    capsuleShape.lineTo(capsuleX - capsuleRadius, guideCapsuleLowerY);
    capsuleShape.absarc(capsuleX, guideCapsuleLowerY, capsuleRadius, Math.PI, FULL_TURN, false);
    capsuleShape.holes.push(clockwiseVerticalCapsulePath(
      capsuleX,
      guideCapsuleUpperY,
      guideCapsuleLowerY,
      capsuleRadius * 0.38,
    ));
    const contactFaceDepth = 0.24;
    const contactFace = new THREE.Mesh(
      new THREE.ExtrudeGeometry(capsuleShape, {
        bevelEnabled: false,
        curveSegments: 20,
        depth: contactFaceDepth,
      }),
      darkMaterial,
    );
    contactFace.position.z = rollerPlaneZ - contactFaceDepth / 2;
    contactFace.userData.fixed = true;
    contactFace.userData.role = `${group.userData.role}-round-ended-guide-strap`;
    const mountingPad = new THREE.Mesh(
      new THREE.BoxGeometry(2.4 * sourceScale, 0.60 * sourceScale, 0.58),
      frameMaterial,
    );
    mountingPad.position.set(centerX, -3.0625 * sourceScale - 0.30 * sourceScale, -0.03);
    mountingPad.userData.fixed = true;
    mountingPad.userData.role = `${group.userData.role}-top-mounting-pad`;
    group.add(body, contactFace, mountingPad);
    group.userData.body = body;
    group.userData.contactFace = contactFace;
    group.userData.mountingPad = mountingPad;
    return group;
  };
  const leftGuideBarA = makeGuideBar(-1);
  const rightGuideBarA = makeGuideBar(1);

  const cylinderBody = new THREE.Mesh(
    boredLatheGeometry([{axial: -1.45, radial: 3.3 * sourceScale},
      {axial: 1.45, radial: 3.3 * sourceScale}], .20, 64),
    frameMaterial,
  );
  // The cylinder stands 0.35 lower than first built, so the crosshead and
  // rollers stop clear above its cover at the bottom of the stroke.
  const cylinderDrop = 0.35;
  cylinderBody.position.set(0, -6.30 - cylinderDrop, crossheadPlaneZ);
  cylinderBody.userData.fixed = true;
  cylinderBody.userData.role = 'fixed-upright-engine-cylinder-below-crosshead';
  const cylinderTopCap = new THREE.Mesh(
    boredLatheGeometry([{axial: -.065, radial: 4.2 * sourceScale},
      {axial: .065, radial: 4.2 * sourceScale}], .115, 64),
    darkMaterial,
  );
  cylinderTopCap.position.set(0, -24 * sourceScale - cylinderDrop, crossheadPlaneZ);
  cylinderTopCap.userData.fixed = true;
  cylinderTopCap.userData.role = 'fixed-cylinder-top-and-piston-rod-gland';
  // The stuffing box starts on the cap's top face rather than running down
  // into it (the two shared the rod bore wall there and z-fought).
  const glandCenterY = -23.45 * sourceScale - cylinderDrop;
  const glandLow = cylinderTopCap.position.y + .065 - glandCenterY;
  const gland = new THREE.Mesh(
    boredLatheGeometry([{axial: glandLow, radial: 2.1 * sourceScale},
      {axial: .095, radial: 2.1 * sourceScale}], .115, 64),
    accentMaterial,
  );
  gland.position.set(0, glandCenterY, crossheadPlaneZ);
  gland.userData.fixed = true;
  gland.userData.role = 'fixed-piston-rod-stuffing-box';

  const bearingHousing = boredCylinderAlongZ(
    1.25 * sourceScale, .72 * sourceScale,
    0.56,
    frameMaterial,
    48,
  );
  bearingHousing.position.z = 0.02;
  bearingHousing.userData.fixed = true;
  bearingHousing.userData.role = 'fixed-overhead-crankshaft-bearing';
  const bearingBore = boredCylinderAlongZ(
    0.72 * sourceScale, .54 * sourceScale + .004,
    0.59,
    darkMaterial,
    40,
  );
  bearingBore.position.z = 0.025;
  bearingBore.userData.fixed = true;
  bearingBore.userData.role = 'fixed-bearing-bore-around-live-shaft';
  const bearingCheeks = [-1, 1].map((side) => {
    const cheek = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.46, frameDepth),
      frameMaterial,
    );
    cheek.position.set(side * 0.21, -0.24, frameCenterZ);
    cheek.rotation.z = side * -0.18;
    cheek.userData.fixed = true;
    cheek.userData.role =
      `${side < 0 ? 'left' : 'right'}-overhead-bearing-cheek`;
    return cheek;
  });

  fixedFrame.add(
    topBeam,
    leftGuideBarA,
    rightGuideBarA,
    cylinderBody,
    cylinderTopCap,
    gland,
    ...bearingCheeks,
    bearingHousing,
    bearingBore,
  );

  // Brown draws a short fixed shaft stub with a collar standing out from the
  // right column's outer face, about six units below the crossbeam.
  {
    const stubY = -6.0 * sourceScale;
    const stubStartX = rightGuideBarA.userData.centerX + columnWidth / 2;
    const stubEndX = 11.0 * sourceScale;
    const stubRadius = 0.62 * sourceScale;
    const stub = new THREE.Mesh(
      new THREE.CylinderGeometry(stubRadius, stubRadius, stubEndX - stubStartX, 32),
      frameMaterial,
    );
    stub.rotation.z = Math.PI / 2;
    stub.position.set((stubStartX + stubEndX) / 2, stubY, frameCenterZ);
    stub.userData.fixed = true;
    stub.userData.role = 'right-column-fixed-shaft-stub';
    const collarRadius = 1.25 * sourceScale;
    const collarWidth = 0.6 * sourceScale;
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(collarRadius, collarRadius, collarWidth, 40),
      darkMaterial,
    );
    collar.rotation.z = Math.PI / 2;
    collar.position.set(stubStartX + 1.6 * sourceScale, stubY, frameCenterZ);
    collar.userData.fixed = true;
    collar.userData.role = 'right-column-shaft-stub-collar';
    fixedFrame.add(stub, collar);
  }

  const rotorParts = makeFlywheelCrankRotor({
    crankDepth,
    crankInitialAngle,
    crankPinRadius,
    crankPlaneZ,
    crankRadius,
    darkMaterial,
    driverMaterial,
    flywheelDepth,
    flywheelInnerRadius,
    flywheelOuterRadius,
    flywheelPlaneZ,
    hubRadius,
    scale: sourceScale,
    showIndices: false,
    whiteMaterial,
  });
  rotorParts.crankArm.userData.role =
    'three-unit-overhead-crank-arm-rigid-with-flywheel';
  rotorParts.crankPinAnchor.userData.role =
    'analytic-three-unit-overhead-crank-pin-center';

  const liveShaft = cylinderAlongZ(
    0.54 * sourceScale,
    crankPlaneZ + crankDepth / 2 + .025 - (flywheelPlaneZ - .20),
    darkMaterial,
    36,
  );
  liveShaft.position.z = (crankPlaneZ + crankDepth / 2 + .025 + flywheelPlaneZ - .20) / 2;
  liveShaft.userData.axis = Z_AXIS.clone();
  liveShaft.userData.role = 'live-overhead-flywheel-crankshaft';
  rotorParts.rotor.add(liveShaft);

  const rodParts = makeConnectingRod({
    darkMaterial,
    depth: connectingRodDepth,
    drivenMaterial,
    eyeRadius: 0.68 * sourceScale,
    crankBore: crankPinRadius + .004,
    wristBore: wristPinRadius * .58 + .004,
    rodLength: connectingRodLength,
  });
  rodParts.rod.userData.role =
    'single-rigid-nineteen-unit-connecting-rod-to-roller-crosshead';

  const crosshead = new THREE.Group();
  crosshead.userData.role =
    'rigid-crosshead-with-two-opposed-guide-rollers-and-piston-rod';
  crosshead.userData.rotationDegreesOfFreedom = 0;
  crosshead.userData.translationAxis = Y_AXIS.clone();

  const crossheadBar = new THREE.Mesh(
    new THREE.BoxGeometry(
      rollerCenterHalfSpacing * 2,
      0.75 * sourceScale,
      0.18,
    ),
    drivenMaterial,
  );
  crossheadBar.position.z = crossheadPlaneZ;
  crossheadBar.userData.role = 'rigid-horizontal-roller-crosshead-bar';
  const crossheadCenterBoss = cylinderAlongZ(
    wristPinRadius * 1.38,
    0.22,
    drivenMaterial,
    36,
  );
  crossheadCenterBoss.position.z = crossheadPlaneZ;
  crossheadCenterBoss.userData.role = 'crosshead-center-wrist-boss';

  const leftRoller = makeGuideRoller({
    accentMaterial,
    darkMaterial,
    depth: rollerDepth,
    planeZ: rollerPlaneZ,
    radius: rollerRadius,
    role: 'left-guide-roller',
  });
  leftRoller.position.x = -rollerCenterHalfSpacing;
  const rightRoller = makeGuideRoller({
    accentMaterial,
    darkMaterial,
    depth: rollerDepth,
    planeZ: rollerPlaneZ,
    radius: rollerRadius,
    role: 'right-guide-roller',
  });
  rightRoller.position.x = rollerCenterHalfSpacing;

  const rollerAxles = [-1, 1].map((side) => {
    const axle = cylinderAlongZ(
      0.50 * sourceScale,
      connectingRodPlaneZ - frameFrontZ + 0.24,
      darkMaterial,
      32,
    );
    axle.position.set(
      side * rollerCenterHalfSpacing,
      0,
      (connectingRodPlaneZ + frameFrontZ) / 2,
    );
    axle.userData.role =
      `${side < 0 ? 'left' : 'right'}-roller-axle-fixed-in-crosshead`;
    return axle;
  });

  const pistonRodLength = pistonRodTopLocalY - pistonRodBottomLocalY;
  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.75 * sourceScale,
      pistonRodLength,
      0.15,
    ),
    drivenMaterial,
  );
  pistonRod.position.set(
    0,
    (pistonRodTopLocalY + pistonRodBottomLocalY) / 2,
    crossheadPlaneZ,
  );
  pistonRod.userData.role = 'piston-rod-rigid-with-roller-crosshead';
  const wristPinAnchor = new THREE.Object3D();
  wristPinAnchor.position.z = connectingRodPlaneZ;
  wristPinAnchor.userData.role = 'analytic-roller-crosshead-wrist-pin';

  crosshead.add(
    pistonRod,
    leftRoller,
    rightRoller,
    crossheadBar,
    crossheadCenterBoss,
    ...rollerAxles,
    wristPinAnchor,
  );

  const crankPinShaft = cylinderAlongZ(
    crankPinRadius,
    connectingRodPlaneZ - crankPlaneZ + 0.26,
    darkMaterial,
    30,
  );
  crankPinShaft.position.set(
    rotorParts.crankPinAnchor.position.x,
    rotorParts.crankPinAnchor.position.y,
    (connectingRodPlaneZ + crankPlaneZ) / 2,
  );
  crankPinShaft.userData.role =
    'crank-pin-joining-overhead-crank-to-connecting-rod';
  rotorParts.rotor.add(crankPinShaft);
  const wristPinShaft = cylinderAlongZ(
    wristPinRadius * 0.58,
    connectingRodPlaneZ - rollerPlaneZ + 0.25,
    darkMaterial,
    30,
  );
  wristPinShaft.position.z = (connectingRodPlaneZ + rollerPlaneZ) / 2;
  wristPinShaft.userData.role =
    'wrist-pin-joining-rod-to-roller-crosshead';
  crosshead.add(wristPinShaft);

  root.add(
    rotorParts.rotor,
    fixedFrame,
    crosshead,
    rodParts.rod,
  );

  const cross2 = (left, right) => left.x * right.y
    - left.y * right.x;
  const initialSliderY = (sourceCrankRadius
    - sourceConnectingRodLength) * sourceScale;

  const stateAtRotorAngle = (
    unwrappedRotorAngle,
    angularVelocity = crankAngularSpeed,
  ) => {
    const rotorAngle = positiveModulo(unwrappedRotorAngle, FULL_TURN);
    const crankPinAngle = positiveModulo(
      rotorAngle + crankInitialAngle,
      FULL_TURN,
    );
    const cosine = Math.cos(crankPinAngle);
    const sine = Math.sin(crankPinAngle);
    const crankPin = new THREE.Vector2(
      crankRadius * cosine,
      crankRadius * sine,
    );
    const crankPinVelocity = new THREE.Vector2(
      -crankRadius * sine * angularVelocity,
      crankRadius * cosine * angularVelocity,
    );
    const crankPinAcceleration = new THREE.Vector2(
      -crankRadius * cosine * angularVelocity ** 2,
      -crankRadius * sine * angularVelocity ** 2,
    );
    const circleLineRadicand = connectingRodLength ** 2
      - crankPin.x ** 2;
    const circleLineRoot = Math.sqrt(Math.max(0, circleLineRadicand));
    const rootFirstByAngle = crankRadius ** 2
      * cosine * sine / circleLineRoot;
    const rootSecondByAngle = crankRadius ** 2
      * (cosine ** 2 - sine ** 2) / circleLineRoot
      - (crankRadius ** 2 * cosine * sine) ** 2
        / circleLineRoot ** 3;
    const sliderY = crankPin.y - circleLineRoot;
    const sliderFirstByAngle = crankRadius * cosine
      - rootFirstByAngle;
    const sliderSecondByAngle = -crankRadius * sine
      - rootSecondByAngle;
    const sliderVelocityY = sliderFirstByAngle * angularVelocity;
    const sliderAccelerationY = sliderSecondByAngle
      * angularVelocity ** 2;
    const wristPin = new THREE.Vector2(0, sliderY);
    const wristPinVelocity = new THREE.Vector2(0, sliderVelocityY);
    const wristPinAcceleration = new THREE.Vector2(
      0,
      sliderAccelerationY,
    );
    const rodVector = wristPin.clone().sub(crankPin);
    const rodRelativeVelocity = wristPinVelocity.clone()
      .sub(crankPinVelocity);
    const rodRelativeAcceleration = wristPinAcceleration.clone()
      .sub(crankPinAcceleration);
    const rodLengthSquared = rodVector.lengthSq();
    const rodAngularVelocity = cross2(
      rodVector,
      rodRelativeVelocity,
    ) / rodLengthSquared;
    const rodAngularAcceleration = (
      cross2(rodVector, rodRelativeAcceleration) * rodLengthSquared
        - cross2(rodVector, rodRelativeVelocity)
          * 2 * rodVector.dot(rodRelativeVelocity)
    ) / rodLengthSquared ** 2;

    const rollerTravel = sliderY - initialSliderY;
    const leftRollerAngle = rollerTravel / rollerRadius;
    const rightRollerAngle = -rollerTravel / rollerRadius;
    const leftRollerAngularVelocity = sliderVelocityY / rollerRadius;
    const rightRollerAngularVelocity = -sliderVelocityY / rollerRadius;
    const leftRollerAngularAcceleration = sliderAccelerationY
      / rollerRadius;
    const rightRollerAngularAcceleration = -sliderAccelerationY
      / rollerRadius;
    const leftRollerCenter = new THREE.Vector2(
      -rollerCenterHalfSpacing,
      sliderY,
    );
    const rightRollerCenter = new THREE.Vector2(
      rollerCenterHalfSpacing,
      sliderY,
    );
    const leftContactPoint = new THREE.Vector2(
      leftRollerCenter.x - rollerRadius,
      sliderY,
    );
    const rightContactPoint = new THREE.Vector2(
      rightRollerCenter.x + rollerRadius,
      sliderY,
    );

    return {
      circleLineRadicand,
      circleLineRoot,
      crankAngle: rotorAngle,
      crankAngularAcceleration: 0,
      crankAngularVelocity: angularVelocity,
      crankPin,
      crankPinAcceleration,
      crankPinAngle,
      crankPinVelocity,
      guide: {
        axisResidual: wristPin.x,
        crossheadRotation: 0,
        crossheadRotationResidual: 0,
        leftContactPoint,
        leftFaceResidual: leftContactPoint.x
          - (-guideContactHalfSpacing),
        leftNoSlipVelocityResidual: sliderVelocityY
          - leftRollerAngularVelocity * rollerRadius,
        rightContactPoint,
        rightFaceResidual: rightContactPoint.x
          - guideContactHalfSpacing,
        rightNoSlipVelocityResidual: sliderVelocityY
          + rightRollerAngularVelocity * rollerRadius,
      },
      leftRoller: {
        angle: leftRollerAngle,
        angularAcceleration: leftRollerAngularAcceleration,
        angularVelocity: leftRollerAngularVelocity,
        center: leftRollerCenter,
        contactPoint: leftContactPoint,
      },
      phase: rotorAngle / FULL_TURN,
      pistonRod: {
        acceleration: new THREE.Vector2(0, sliderAccelerationY),
        position: wristPin.clone(),
        rotation: 0,
        velocity: new THREE.Vector2(0, sliderVelocityY),
      },
      rightRoller: {
        angle: rightRollerAngle,
        angularAcceleration: rightRollerAngularAcceleration,
        angularVelocity: rightRollerAngularVelocity,
        center: rightRollerCenter,
        contactPoint: rightContactPoint,
      },
      rodAngle: Math.atan2(rodVector.y, rodVector.x),
      rodAngularAcceleration,
      rodAngularVelocity,
      rodLength: rodVector.length(),
      rodLengthResidual: rodVector.length() - connectingRodLength,
      rodVector,
      rollerTravel,
      sliderAccelerationY,
      sliderFirstByAngle,
      sliderSecondByAngle,
      sliderVelocityY,
      sliderY,
      unwrappedRotorAngle,
      wristPin,
      wristPinAcceleration,
      wristPinVelocity,
    };
  };

  const stateAtTime = (time) => {
    const elapsed = Number.isFinite(Number(time)) ? Number(time) : 0;
    return stateAtRotorAngle(elapsed * crankAngularSpeed);
  };
  const canonicalTimes = {
    bottomDeadCenter: cyclePeriod * 0.50,
    cycleClosure: cyclePeriod,
    leftQuadrature: cyclePeriod * 0.25,
    rightQuadrature: cyclePeriod * 0.75,
    sourceStartTopDeadCenter: 0,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const officialViewMinimum = new THREE.Vector2(-16, -26.734242);
  const officialViewWidth = 32;
  const officialViewHeight = 32;
  const officialCanvasWidth = 525;
  const officialCanvasHeight = 525;
  const modelPointToOfficialAnimationRaster = (point) => {
    const rawX = point.x / sourceScale;
    const rawY = point.y / sourceScale;
    return new THREE.Vector2(
      (rawX - officialViewMinimum.x)
        * officialCanvasWidth / officialViewWidth,
      officialCanvasHeight - (rawY - officialViewMinimum.y)
        * officialCanvasHeight / officialViewHeight,
    );
  };

  const geometry = {
    connectingRodDepth,
    connectingRodLength,
    connectingRodPlaneZ,
    crankDepth,
    crankInitialAngle,
    crankPinRadius,
    crankPlaneZ,
    crankRadius,
    crankAngularSpeed,
    crossheadPlaneZ,
    cyclePeriod,
    flywheelDepth,
    flywheelInnerRadius,
    flywheelOuterRadius,
    flywheelPlaneZ,
    frameBottomY,
    frameCenterZ,
    frameDepth,
    frameFrontZ,
    guideBarCenterHalfSpacing,
    guideBarHalfWidth,
    guideContactHalfSpacing,
    initialSliderY,
    pistonRodBottomLocalY,
    pistonRodTopLocalY,
    pistonStroke,
    rollerCenterHalfSpacing,
    rollerDepth,
    rollerPlaneZ,
    rollerRadius,
    sourceConnectingRodLength,
    sourceCrankRadius,
    sourceCyclesPerMinute,
    sourceFlywheelInnerRadius,
    sourceFlywheelOuterRadius,
    sourceGuideBarCenterHalfSpacing,
    sourceGuideBarHalfWidth,
    sourceGuideContactHalfSpacing,
    sourcePistonRodBottomLocalY,
    sourcePistonRodTopLocalY,
    sourceRollerCenterHalfSpacing,
    sourceRollerRadius,
    sourceScale,
    wristPinRadius,
  };

  const contacts = {
    leftRollerOnGuideBarA: {
      fixedMember: leftGuideBarA,
      movingMember: leftRoller,
      normal: new THREE.Vector3(1, 0, 0),
      relativeSlipSpeed: 0,
      type: 'no-slip-roller-on-straight-fixed-guide-face',
    },
    rightRollerOnGuideBarA: {
      fixedMember: rightGuideBarA,
      movingMember: rightRoller,
      normal: new THREE.Vector3(-1, 0, 0),
      relativeSlipSpeed: 0,
      type: 'no-slip-roller-on-straight-fixed-guide-face',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    rotorParts.rotor.rotation.z = state.crankAngle;
    crosshead.position.set(0, state.sliderY, 0);
    leftRoller.rotation.z = state.leftRoller.angle;
    rightRoller.rotation.z = state.rightRoller.angle;
    rodParts.rod.position.set(
      state.crankPin.x,
      state.crankPin.y,
      connectingRodPlaneZ,
    );
    rodParts.rod.rotation.z = state.rodAngle;
    contacts.leftRollerOnGuideBarA.relativeSlipSpeed =
      state.guide.leftNoSlipVelocityResidual;
    contacts.rightRollerOnGuideBarA.relativeSlipSpeed =
      state.guide.rightNoSlipVelocityResidual;
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    'opposed-guide-roller-crosshead-slider-crank';
  root.userData.blocks = {
    bearingBore,
    bearingCheeks,
    bearingHousing,
    connectingRod: rodParts.rod,
    connectingRodCrankEyeAnchor: rodParts.crankEyeAnchor,
    connectingRodWristEyeAnchor: rodParts.wristEyeAnchor,
    crankArm: rotorParts.crankArm,
    crankPinAnchor: rotorParts.crankPinAnchor,
    crankPinShaft,
    crosshead,
    crossheadBar,
    crossheadCenterBoss,
    cylinderBody,
    cylinderTopCap,
    fixedFrame,
    flywheel: rotorParts.rotor,
    flywheelRim: rotorParts.rim,
    flywheelSpokes: rotorParts.spokes,
    gland,
    leftGuideBarA,
    leftRoller,
    liveShaft,
    pistonRod,
    rightGuideBarA,
    rightRoller,
    rollerAxles,
    topBeam,
    wristPinAnchor,
    wristPinShaft,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    crossheadRotation: 0,
    crossheadTranslationAxes: 1,
    input: 'one continuous overhead crankshaft rotation',
    mechanism: 1,
    output:
      'one vertical piston-rod translation constrained by two opposed rollers',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = frameBottomY - 0.025;
  root.userData.mechanism =
    'three-unit-crank-nineteen-unit-rod-crosshead-with-two-counter-rotating-rollers-on-guide-bars-A-A';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: sourceCyclesPerMinute,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialGeometry: {
      connectingRodLength: sourceConnectingRodLength,
      crankInitialAngle: Math.PI / 2,
      crankRadius: sourceCrankRadius,
      flywheelInnerRadius: sourceFlywheelInnerRadius,
      flywheelOuterRadius: sourceFlywheelOuterRadius,
      guideBarCenterHalfSpacing: sourceGuideBarCenterHalfSpacing,
      guideBarHalfWidth: sourceGuideBarHalfWidth,
      guideContactHalfSpacing: sourceGuideContactHalfSpacing,
      pistonRodBottomLocalY: sourcePistonRodBottomLocalY,
      pistonRodTopLocalY: sourcePistonRodTopLocalY,
      rollerCenterHalfSpacing: sourceRollerCenterHalfSpacing,
      rollerRadius: sourceRollerRadius,
    },
    officialKeyframes: [
      {
        crankPin: new THREE.Vector2(0, 3),
        phase: 0,
        crossheadPin: new THREE.Vector2(0, -16),
      },
      {
        crankPin: new THREE.Vector2(-3, 0),
        phase: 0.25,
        crossheadPin: new THREE.Vector2(0, -Math.sqrt(19 ** 2 - 3 ** 2)),
      },
      {
        crankPin: new THREE.Vector2(0, -3),
        phase: 0.50,
        crossheadPin: new THREE.Vector2(0, -22),
      },
      {
        crankPin: new THREE.Vector2(3, 0),
        phase: 0.75,
        crossheadPin: new THREE.Vector2(0, -Math.sqrt(19 ** 2 - 3 ** 2)),
      },
      {
        crankPin: new THREE.Vector2(0, 3),
        phase: 1,
        crossheadPin: new THREE.Vector2(0, -16),
      },
    ],
    officialPageAnimatedTabDisabled: false,
    referenceScope:
      'official three-unit crank, nineteen-unit rod, opposed 1.5-unit rollers, straight guide-bars A A, crosshead, piston-rod, and 15 rpm timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate327: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one overhead flywheel and crank, one connecting rod, one crosshead, two guide rollers, two straight fixed guide-bars A A, and one piston-rod',
      measurementUncertaintyPixels: 24,
      rasterCrankCenter: new THREE.Vector2(264, 56),
      rasterCrankPin: new THREE.Vector2(263, 18),
      rasterCrossheadPin: new THREE.Vector2(267, 330),
      rasterLeftGuideRoller: new THREE.Vector2(216, 328),
      rasterLeftGuideBarA: new THREE.Vector2(176, 402),
      rasterRightGuideBarA: new THREE.Vector2(358, 401),
      rasterRightGuideRoller: new THREE.Vector2(322, 328),
    },
    officialAnimationView: {
      canvasHeight: officialCanvasHeight,
      canvasWidth: officialCanvasWidth,
      minimum: officialViewMinimum,
      viewHeight: officialViewHeight,
      viewWidth: officialViewWidth,
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtRotorAngle = stateAtRotorAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    connectingRodConstraint:
      'sqrt((0-crankX)^2 + (crossheadY-crankY)^2) = 19 source units',
    input: 'one rigid flywheel and three-unit crank rotating at 15 rpm',
    leftRollerLaw: 'angle = crosshead travel / roller radius',
    output:
      'a six-unit vertical piston stroke with zero crosshead yaw',
    rightRollerLaw: 'angle = -crosshead travel / roller radius',
    rollerAngularVelocityRatioToCrosshead:
      'left +1/R and right -1/R',
    sliderLaw:
      'y = r*sin(beta) - sqrt(L^2 - r^2*cos(beta)^2), beta = theta + pi/2',
  };

  // Now that the whole cylinder is in view, the guide columns run on down to
  // the cylinder's foot and end there cleanly; Brown draws no bed plate.
  {
    const cylinderBox = new THREE.Box3().setFromObject(cylinderBody);
    const bedTop = cylinderBox.min.y;
    for (const guide of [leftGuideBarA, rightGuideBarA]) {
      const columnBox = new THREE.Box3().setFromObject(guide.userData.body);
      const lower = new THREE.Mesh(
        new THREE.BoxGeometry(columnBox.max.x - columnBox.min.x,
          columnBox.min.y - bedTop + 0.02, columnBox.max.z - columnBox.min.z),
        guide.userData.body.material,
      );
      lower.position.set((columnBox.min.x + columnBox.max.x) / 2,
        (columnBox.min.y + 0.02 + bedTop) / 2, (columnBox.min.z + columnBox.max.z) / 2);
      lower.userData.fixed = true;
      lower.userData.role = `${guide.userData.role}-column-foot`;
      guide.add(lower);
    }
  }
  finishGuidePresentation(root, update, cyclePeriod);
  // Brown crops the plate to the crank above and the cylinder cover below;
  // the view frames the whole flywheel and the whole cylinder instead, so
  // neither reads as broken off at the canvas edge.
  root.userData.sweptBounds = root.userData.cameraFitBounds;
  root.userData.cameraDistanceScale = 1.0;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.2, -8.35, -0.75),
    new THREE.Vector3(3.2, 3.2, 0.90),
  );
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.45, 0.28, 14),
    root,
    update,
  };
}

export function createAuthoredSteamEngineGuideMovement(movement) {
  switch (movement.id) {
    case 326: return verticalPlanedSlotPistonGuide(movement);
    case 327: return rollerGuidedFrenchEngineCrosshead(movement);
    default: return null;
  }
}
