import {correctTripHammerParts} from './stamp-trip-working-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeShaft,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function cylinderAlongZ(radius, depth, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevel = true) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevel,
    bevelSegments: bevel ? 2 : 1,
    bevelSize: bevel ? 0.014 : 0,
    bevelThickness: bevel ? 0.014 : 0,
    curveSegments: 2,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function polygonShape(points) {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  });
  shape.closePath();
  return shape;
}

function makeOutline(points, z, material) {
  const line = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points.map((point) =>
      new THREE.Vector3(point.x, point.y, z))),
    material,
  );
  line.userData.noShadow = true;
  return line;
}

function rotateVector2(point, angle) {
  return point.clone().rotateAround(new THREE.Vector2(), angle);
}

function solveAngleForTargetY(localPoint, targetY) {
  let lower = 0;
  let upper = Math.PI / 2;
  for (let iteration = 0; iteration < 96; iteration += 1) {
    const middle = (lower + upper) / 2;
    const y = rotateVector2(localPoint, middle).y;
    if (y > targetY) lower = middle;
    else upper = middle;
  }
  return (lower + upper) / 2;
}

function firstOrderTripHammer(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const lobeCount = 4;
  const lobePitch = fullTurn / lobeCount;

  // Measurements are from the 525 px official engraving.  The drawing shows
  // the hammer at the top of its lift: the head/load is left of the fulcrum,
  // while the wiper acts on the tail to its right.  That placement, rather
  // than the superficial resemblance to movement 72, is the defining
  // first-order-lever constraint.
  const sourceScale = 0.017;
  const sourcePivotRaster = new THREE.Vector2(255, 281);
  const sourceCamCenterRaster = new THREE.Vector2(431, 264);
  const sourceFollowerCenterRaster = new THREE.Vector2(343, 314);
  const sourceStrikePointRaster = new THREE.Vector2(60, 292);
  const sourceAnvilTopRaster = new THREE.Vector2(60, 400);
  const fromRasterRelativeToPivot = (point) => new THREE.Vector2(
    (point.x - sourcePivotRaster.x) * sourceScale,
    (sourcePivotRaster.y - point.y) * sourceScale,
  );

  const hammerPivot = new THREE.Vector3(-0.45, 2.15, 0.08);
  const camCenterRelative = fromRasterRelativeToPivot(sourceCamCenterRaster);
  const camCenter = new THREE.Vector3(
    hammerPivot.x + camCenterRelative.x,
    hammerPivot.y + camCenterRelative.y,
    0.05,
  );
  const followerCenterLocal = fromRasterRelativeToPivot(
    sourceFollowerCenterRaster,
  );
  const strikePointLocal = fromRasterRelativeToPivot(sourceStrikePointRaster);
  const sourceAnvilTopLocalY = fromRasterRelativeToPivot(
    sourceAnvilTopRaster,
  ).y;
  const raisedHammerAngle = 0;
  const impactHammerAngle = solveAngleForTargetY(
    strikePointLocal,
    sourceAnvilTopLocalY,
  );
  const anvilStrikePointLocal = rotateVector2(
    strikePointLocal,
    impactHammerAngle,
  );
  const anvilTopY = hammerPivot.y + anvilStrikePointLocal.y;
  const anvilCenterX = hammerPivot.x + anvilStrikePointLocal.x;

  const followerRadius = 10 * sourceScale;
  const camBaseRadius = 54 * sourceScale;
  const followerArmRadius = followerCenterLocal.length();
  const followerBaseAngle = Math.atan2(
    followerCenterLocal.y,
    followerCenterLocal.x,
  );
  const camDepth = 0.34;
  const hammerDepth = 0.30;
  const contactPlaneZ = 0.16;
  const contactStartPhase = 0.06;
  const lobeCyclePeriod = 2.8;
  const driverFullTurnPeriod = lobeCount * lobeCyclePeriod;
  const driverAngularSpeed = lobePitch / lobeCyclePeriod;
  const followerFromCamAtHammerAngle = (hammerAngle) =>
    rotateVector2(followerCenterLocal, hammerAngle).add(
      new THREE.Vector2(
        hammerPivot.x - camCenter.x,
        hammerPivot.y - camCenter.y,
      ),
    );
  const faceGeometryAtHammerAngle = (hammerAngle) => {
    const followerFromCam = followerFromCamAtHammerAngle(hammerAngle);
    const centerDistance = followerFromCam.length();
    const faceAngle = Math.atan2(followerFromCam.y, followerFromCam.x)
      - Math.asin(followerRadius / centerDistance);
    return {
      centerDistance,
      faceAngle,
      radialContact: Math.sqrt(
        centerDistance ** 2 - followerRadius ** 2,
      ),
    };
  };
  const impactFaceGeometry = faceGeometryAtHammerAngle(impactHammerAngle);
  const raisedFaceGeometry = faceGeometryAtHammerAngle(raisedHammerAngle);
  const leadingFaceMountAngle = impactFaceGeometry.faceAngle;
  let releaseFaceAngle = raisedFaceGeometry.faceAngle;
  while (releaseFaceAngle < leadingFaceMountAngle) {
    releaseFaceAngle += fullTurn;
  }
  const contactTravelAngle = releaseFaceAngle - leadingFaceMountAngle;
  const contactPhaseSpan = contactTravelAngle / lobePitch;
  const contactEndPhase = contactStartPhase + contactPhaseSpan;
  const contactDuration = contactPhaseSpan * lobeCyclePeriod;
  const wiperTipRadius = raisedFaceGeometry.radialContact;
  // p109: broader triangles, as Brown draws them (base chord about 0.65 of
  // the wheel radius; it was 0.46).
  const wiperAngularWidth = 0.72;
  const camLeadingNormalLocal = new THREE.Vector2(
    -Math.sin(leadingFaceMountAngle),
    Math.cos(leadingFaceMountAngle),
  );

  // Each source wiper is a triangular blade.  Its counter-clockwise leading
  // radial face pushes a round nose on the hammer tail.  During lift the
  // contact slides outward along that finite face and reaches the outer tip
  // exactly at release.  This avoids inventing a smooth plate cam where the
  // engraving plainly shows four discrete wipers.
  const liftStateAtTravel = (travelAngle) => {
    const clampedTravel = THREE.MathUtils.clamp(
      travelAngle,
      0,
      contactTravelAngle,
    );
    const faceAngle = leadingFaceMountAngle + clampedTravel;
    const faceDirection = new THREE.Vector2(
      Math.cos(faceAngle),
      Math.sin(faceAngle),
    );
    const faceNormal = new THREE.Vector2(
      -faceDirection.y,
      faceDirection.x,
    );
    const fixedPivotFromCam = new THREE.Vector2(
      hammerPivot.x - camCenter.x,
      hammerPivot.y - camCenter.y,
    );
    const sineArgument = THREE.MathUtils.clamp(
      (
        followerRadius - fixedPivotFromCam.dot(faceNormal)
      ) / followerArmRadius,
      -1,
      1,
    );
    let hammerAngle = faceAngle - followerBaseAngle
      + Math.PI - Math.asin(sineArgument) - fullTurn;
    while (hammerAngle < -Math.PI) hammerAngle += fullTurn;
    while (hammerAngle > Math.PI) hammerAngle -= fullTurn;
    if (Math.abs(clampedTravel) < 1e-13) {
      hammerAngle = impactHammerAngle;
    }
    if (Math.abs(clampedTravel - contactTravelAngle) < 1e-13) {
      hammerAngle = raisedHammerAngle;
    }
    const followerOffset = rotateVector2(
      followerCenterLocal,
      hammerAngle,
    );
    const followerFromCam = followerOffset.clone().add(
      fixedPivotFromCam,
    );
    const radialContact = followerFromCam.dot(faceDirection);
    const denominator = followerOffset.dot(faceDirection);
    const hammerAnglePerTravel = radialContact / denominator;
    const followerNormalCoordinate = followerOffset.dot(faceNormal);
    const radialContactDerivative = -hammerAnglePerTravel
      * followerNormalCoordinate + followerRadius;
    const denominatorDerivative = (1 - hammerAnglePerTravel)
      * followerNormalCoordinate;
    const hammerAngleSecondPerTravel = (
      radialContactDerivative * denominator
        - radialContact * denominatorDerivative
    ) / denominator ** 2;
    const camPointLocal = new THREE.Vector2(
      Math.cos(leadingFaceMountAngle) * radialContact,
      Math.sin(leadingFaceMountAngle) * radialContact,
    );
    return {
      camPointLocal,
      faceAngle,
      faceDirection,
      faceNormal,
      hammerAngle,
      hammerAnglePerTravel,
      hammerAngleSecondPerTravel,
      normalLocal: camLeadingNormalLocal.clone(),
      radialContact,
      radialTipClearance: wiperTipRadius - radialContact,
      travelAngle: clampedTravel,
      unit: clampedTravel / contactTravelAngle,
    };
  };

  const contactAuditSamples = 4096;
  let minimumSearchLower = 0;
  let minimumSearchUpper = contactTravelAngle;
  for (let iteration = 0; iteration < 96; iteration += 1) {
    const first = (2 * minimumSearchLower + minimumSearchUpper) / 3;
    const second = (minimumSearchLower + 2 * minimumSearchUpper) / 3;
    if (liftStateAtTravel(first).radialContact
      < liftStateAtTravel(second).radialContact) {
      minimumSearchUpper = second;
    } else {
      minimumSearchLower = first;
    }
  }
  const minimumContactRadius = liftStateAtTravel(
    (minimumSearchLower + minimumSearchUpper) / 2,
  ).radialContact;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.16,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.26,
    roughness: 0.47,
  });
  const camMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.57,
  });
  const hammerMaterial = matte(PALETTE.driven, {
    metalness: 0.11,
    roughness: 0.61,
  });
  const headMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.62,
  });
  const anvilMaterial = matte(PALETTE.muted, {
    metalness: 0.23,
    roughness: 0.49,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });
  const outlineMaterial = new THREE.LineBasicMaterial({ color: PALETTE.ink });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'fixed-frame-supporting-anvil-central-fulcrum-and-right-wiper-shaft';
  const groundY = -0.62;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(7.55, 0.22, 1.42),
    frameMaterial,
  );
  base.position.set(-0.12, groundY - 0.11, -0.30);
  base.userData.role = 'fixed-trip-hammer-base';
  fixedFrame.add(base);

  const camPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, camCenter.y - groundY + 0.18, 0.70),
    frameMaterial,
  );
  camPost.position.set(
    camCenter.x,
    (camCenter.y + groundY) / 2 - 0.02,
    -0.46,
  );
  camPost.userData.role = 'upright-bearing-post-for-wiper-wheel';
  const camPostCap = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.46, 8, 24),
    frameMaterial,
  );
  camPostCap.position.set(camCenter.x, camCenter.y - 0.21, -0.46);
  camPostCap.userData.role = 'rounded-fixed-wiper-shaft-bearing';
  const camBraceLeft = makeBeam(
    new THREE.Vector3(camCenter.x - 0.72, groundY, -0.48),
    new THREE.Vector3(camCenter.x - 0.16, 0.62, -0.48),
    { color: PALETTE.frame, depth: 0.18, thickness: 0.15 },
  );
  camBraceLeft.userData.role = 'left-triangular-cam-post-brace';
  const camBraceRight = makeBeam(
    new THREE.Vector3(camCenter.x + 0.72, groundY, -0.48),
    new THREE.Vector3(camCenter.x + 0.16, 0.62, -0.48),
    { color: PALETTE.frame, depth: 0.18, thickness: 0.15 },
  );
  camBraceRight.userData.role = 'right-triangular-cam-post-brace';

  const pivotPost = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.34,
      hammerPivot.y - groundY,
      0.58,
    ),
    frameMaterial,
  );
  pivotPost.position.set(
    hammerPivot.x,
    (hammerPivot.y + groundY) / 2,
    -0.54,
  );
  pivotPost.userData.role = 'fixed-fulcrum-post-behind-hammer-helve';
  const pivotBridge = new THREE.Mesh(
    new THREE.BoxGeometry(1.10, 0.24, 0.60),
    frameMaterial,
  );
  pivotBridge.position.set(hammerPivot.x, hammerPivot.y, -0.52);
  pivotBridge.userData.role = 'fixed-first-order-lever-bearing-bridge';
  fixedFrame.add(
    camPost,
    camPostCap,
    camBraceLeft,
    camBraceRight,
    pivotPost,
    pivotBridge,
  );

  const anvilBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.66, anvilTopY - groundY - 0.08, 1.05),
    frameMaterial,
  );
  anvilBody.position.set(
    anvilCenterX,
    (anvilTopY + groundY - 0.08) / 2,
    -0.20,
  );
  anvilBody.userData.role = 'fixed-anvil-body-below-hammer-head';
  const anvilFace = new THREE.Mesh(
    new THREE.BoxGeometry(1.92, 0.11, 0.94),
    anvilMaterial,
  );
  anvilFace.position.set(anvilCenterX, anvilTopY - 0.055, 0.02);
  anvilFace.userData.role = 'fixed-horizontal-anvil-strike-face';
  anvilFace.userData.topY = anvilTopY;
  fixedFrame.add(anvilBody, anvilFace);
  root.add(fixedFrame);

  const cam = new THREE.Group();
  cam.position.copy(camCenter);
  cam.userData.axis = Z_AXIS.clone();
  cam.userData.role =
    'counter-clockwise-four-lobe-wiper-wheel-driving-right-hand-tail';
  const camRotor = new THREE.Group();
  camRotor.userData.axis = Z_AXIS.clone();
  cam.add(camRotor);
  const camBody = new THREE.Group();
  camBody.userData.role =
    'circular-wheel-with-four-discrete-source-profiled-triangular-wipers';
  camBody.userData.lobeCount = lobeCount;
  const camDisk = cylinderAlongZ(
    camBaseRadius,
    camDepth,
    camMaterial,
    72,
  );
  camDisk.userData.role = 'round-central-body-of-four-wiper-wheel';
  camBody.add(camDisk);
  const wiperMeshes = [];
  const leadingFaces = [];
  const wiperProfiles = [];
  for (let index = 0; index < lobeCount; index += 1) {
    const leadingAngle = leadingFaceMountAngle + index * lobePitch;
    // Brown's wipers are broad straight-flanked triangles (base about half
    // the wheel radius) whose leading flank is the radial working face. Below
    // the working band that face steps back in a small barb (Brown's
    // zigzag), which the tail never reaches: contact stays above r = 1.39.
    const trailingAngle = leadingAngle - wiperAngularWidth;
    const polar = (angle, radius) => new THREE.Vector2(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    );
    const barbRadius = 1.24;
    const barbStep = 0.09;
    const barbLowRadius = 1.14;
    const wiperPoints = [
      polar(trailingAngle, camBaseRadius * 0.96),
      polar(leadingAngle, wiperTipRadius),
      polar(leadingAngle, barbRadius),
      polar(leadingAngle - barbStep / barbRadius, barbLowRadius),
      polar(leadingAngle - barbStep / camBaseRadius, camBaseRadius * 0.94),
    ];
    const wiper = new THREE.Mesh(
      centeredExtrusion(polygonShape(wiperPoints), camDepth, false),
      camMaterial,
    );
    wiper.userData.index = index;
    wiper.userData.leadingFaceAngle = leadingAngle;
    wiper.userData.radialContactMinimum = minimumContactRadius;
    wiper.userData.role =
      'triangular-wiper-with-counter-clockwise-leading-radial-working-face';
    wiper.userData.tipRadius = wiperTipRadius;
    camBody.add(wiper);
    wiperMeshes.push(wiper);
    wiperProfiles.push(wiperPoints.map((point) => point.clone()));
    leadingFaces.push({
      base: new THREE.Vector2(
        Math.cos(leadingAngle) * camBaseRadius * 0.94,
        Math.sin(leadingAngle) * camBaseRadius * 0.94,
      ),
      index,
      normal: rotateVector2(camLeadingNormalLocal, index * lobePitch),
      tip: new THREE.Vector2(
        Math.cos(leadingAngle) * wiperTipRadius,
        Math.sin(leadingAngle) * wiperTipRadius,
      ),
    });
  }
  camRotor.add(camBody);
  const camHub = cylinderAlongZ(0.26, camDepth + 0.30, darkMaterial, 40);
  camHub.position.z = 0.02;
  camHub.userData.role = 'wiper-wheel-hub';
  const camFaceRing = new THREE.Mesh(
    new THREE.TorusGeometry(camBaseRadius * 0.53, 0.045, 9, 64),
    darkMaterial,
  );
  camFaceRing.position.z = camDepth / 2 + 0.025;
  camFaceRing.userData.role = 'dark-wiper-wheel-face-ring';
  const camIndicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.075, 0.034),
    whiteMaterial,
  );
  camIndicator.position.set(0.34, 0, camDepth / 2 + 0.052);
  camIndicator.userData.role =
    'white-input-index-showing-counter-clockwise-wheel-rate';
  camRotor.add(camHub, camFaceRing, camIndicator);
  cam.userData.baseRadius = camBaseRadius;
  cam.userData.body = camBody;
  cam.userData.disk = camDisk;
  cam.userData.indicator = camIndicator;
  cam.userData.leadingFaceMountAngle = leadingFaceMountAngle;
  cam.userData.leadingFaces = leadingFaces;
  cam.userData.lobeCount = lobeCount;
  cam.userData.lobePitch = lobePitch;
  cam.userData.rotor = camRotor;
  cam.userData.tipRadius = wiperTipRadius;
  cam.userData.wipers = wiperMeshes;
  const inputShaft = makeShaft({ length: 1.54, radius: 0.12 });
  inputShaft.position.copy(camCenter).setZ(0.01);
  inputShaft.userData.role =
    'continuous-counter-clockwise-horizontal-input-shaft';
  const rearCamBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.27, 0.065, 10, 40),
    darkMaterial,
  );
  rearCamBearing.position.copy(camCenter).setZ(-0.48);
  rearCamBearing.userData.role = 'fixed-rear-wiper-shaft-bearing';
  root.add(rearCamBearing, inputShaft, cam);

  const hammer = new THREE.Group();
  hammer.position.copy(hammerPivot);
  hammer.userData.axis = Z_AXIS.clone();
  hammer.userData.role =
    'fixed-axis-first-order-trip-hammer-assembly';
  const hammerRotor = new THREE.Group();
  hammerRotor.userData.axis = Z_AXIS.clone();
  hammerRotor.userData.role =
    'oscillating-first-order-hammer-helve-head-and-tail';
  hammer.add(hammerRotor);

  const helvePoints = [
    new THREE.Vector2(-3.04, 0.54),
    new THREE.Vector2(-2.74, 0.28),
    new THREE.Vector2(1.38, -0.62),
    new THREE.Vector2(1.58, -0.56),
    new THREE.Vector2(1.66, -0.42),
    new THREE.Vector2(1.55, -0.28),
    new THREE.Vector2(-2.83, 0.72),
  ];
  const helve = new THREE.Mesh(
    centeredExtrusion(polygonShape(helvePoints), hammerDepth),
    hammerMaterial,
  );
  helve.position.z = 0.16;
  helve.userData.role =
    'single-rigid-helve-crossing-fulcrum-between-head-and-input';
  const helveOutline = makeOutline(
    helvePoints,
    hammerDepth / 2 + 0.325,
    outlineMaterial,
  );
  helveOutline.userData.role = 'dark-source-profile-helve-outline';

  // Brown's head is a straight-sided block with a rounded top.
  const sourceHeadBottomLeft = new THREE.Vector2(-3.79, 0.04);
  const sourceHeadBottomRight = new THREE.Vector2(-3.18, -0.17);
  const headUp = new THREE.Vector2(0.29, 1.86).normalize();
  const headHalfWidth = sourceHeadBottomLeft.distanceTo(
    sourceHeadBottomRight,
  ) / 2;
  const headArcCenter = sourceHeadBottomLeft.clone()
    .add(sourceHeadBottomRight)
    .multiplyScalar(0.5).addScaledVector(headUp, 1.62);
  const headAcross = sourceHeadBottomRight.clone().sub(sourceHeadBottomLeft)
    .normalize();
  // The striking face is dressed through the strike point square to the
  // anvil at the impact angle, so the face lands flat on the anvil (Brown's
  // raised-pose sketch slopes it about 15 degrees less).
  const impactFaceDirection = new THREE.Vector2(
    Math.cos(-impactHammerAngle),
    Math.sin(-impactHammerAngle),
  );
  const faceOnHeadSide = (sideBottom) => {
    // Solve sideBottom + s * headUp = strikePointLocal + t * faceDirection.
    const determinant = headUp.x * -impactFaceDirection.y
      + impactFaceDirection.x * headUp.y;
    const delta = strikePointLocal.clone().sub(sideBottom);
    const along = (delta.x * -impactFaceDirection.y
      + impactFaceDirection.x * delta.y) / determinant;
    return sideBottom.clone().addScaledVector(headUp, along);
  };
  const headBottomLeft = faceOnHeadSide(sourceHeadBottomLeft);
  const headBottomRight = faceOnHeadSide(sourceHeadBottomRight);
  const headPoints = [
    headBottomRight.clone(),
    ...Array.from({ length: 17 }, (_, index) => {
      const angle = Math.PI * index / 16;
      return headArcCenter.clone()
        .addScaledVector(headAcross, Math.cos(angle) * headHalfWidth)
        .addScaledVector(headUp, Math.sin(angle) * headHalfWidth);
    }),
    headBottomLeft.clone(),
  ];
  const hammerHead = new THREE.Mesh(
    centeredExtrusion(polygonShape(headPoints), 0.68),
    headMaterial,
  );
  hammerHead.position.z = 0.14;
  hammerHead.userData.role = 'heavy-left-hand-falling-hammer-head';
  const headOutline = makeOutline(headPoints, 0.495, outlineMaterial);
  headOutline.userData.role = 'dark-source-profile-hammer-head-outline';

  const movingJournalBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.96, 0.92, 0.58),
    hammerMaterial,
  );
  movingJournalBlock.position.set(0, 0, 0.13);
  movingJournalBlock.rotation.z = -0.19;
  movingJournalBlock.userData.role =
    'square-journal-block-rigidly-fixed-to-oscillating-helve';
  const movingPivotHub = cylinderAlongZ(0.28, 0.78, darkMaterial, 40);
  movingPivotHub.position.z = 0.14;
  movingPivotHub.userData.role = 'moving-helve-hub-about-fixed-fulcrum';
  const movingPivotRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.29, 0.055, 10, 44),
    anvilMaterial,
  );
  movingPivotRing.position.z = 0.56;
  movingPivotRing.userData.role = 'front-ring-on-oscillating-fulcrum-block';

  // The nose is the helve's own rounded end (Brown's D-shaped tail), in
  // the helve colour rather than a black pin.
  const followerNose = cylinderAlongZ(
    followerRadius,
    hammerDepth + 0.16,
    hammerMaterial,
    34,
  );
  followerNose.position.set(
    followerCenterLocal.x,
    followerCenterLocal.y,
    contactPlaneZ - hammerPivot.z,
  );
  followerNose.userData.radius = followerRadius;
  followerNose.userData.role =
    'rounded-right-hand-tail-follower-contacted-by-wipers';
  const hammerIndicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 20, 14),
    whiteMaterial,
  );
  hammerIndicator.position.set(-2.05, 0.35, 0.57);
  hammerIndicator.userData.role =
    'white-index-on-helve-showing-hammer-angular-motion';
  hammerRotor.add(
    helve,
    helveOutline,
    hammerHead,
    headOutline,
    movingJournalBlock,
    movingPivotHub,
    movingPivotRing,
    followerNose,
    hammerIndicator,
  );
  const hammerPivotShaft = makeShaft({ length: 1.44, radius: 0.12 });
  hammerPivotShaft.position.copy(hammerPivot).setZ(0.10);
  hammerPivotShaft.userData.role = 'fixed-fulcrum-shaft-between-effort-and-load';
  const frontPivotBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.30, 0.07, 10, 44),
    frameMaterial,
  );
  frontPivotBearing.position.copy(hammerPivot).setZ(0.75);
  frontPivotBearing.userData.role = 'fixed-front-fulcrum-bearing';
  const rearPivotBearing = frontPivotBearing.clone();
  rearPivotBearing.position.z = -0.49;
  rearPivotBearing.userData.role = 'fixed-rear-fulcrum-bearing';
  root.add(
    rearPivotBearing,
    hammerPivotShaft,
    hammer,
    frontPivotBearing,
  );

  // The fall is a compound-pendulum solution, not an arbitrary return tween.
  // Head, helve, journal and nose masses are reduced to their common center of
  // mass and exact polar inertia about the fixed fulcrum.
  const physicalComponents = [
    {
      center: new THREE.Vector2(-3.15, 0.78),
      inertiaAtCenter: 5.6 * (1.15 ** 2 + 2.10 ** 2) / 12,
      mass: 5.6,
      name: 'hammer-head',
    },
    {
      center: new THREE.Vector2(-0.78, -0.08),
      inertiaAtCenter: 1.35 * 4.95 ** 2 / 12,
      mass: 1.35,
      name: 'wooden-helve',
    },
    {
      center: new THREE.Vector2(0, 0),
      inertiaAtCenter: 0.55 * 0.30 ** 2 / 2,
      mass: 0.55,
      name: 'journal-block',
    },
    {
      center: followerCenterLocal.clone(),
      inertiaAtCenter: 0.28 * followerRadius ** 2 / 2,
      mass: 0.28,
      name: 'tail-follower',
    },
  ];
  const totalMass = physicalComponents.reduce(
    (sum, component) => sum + component.mass,
    0,
  );
  const centerOfMassLocal = physicalComponents.reduce(
    (sum, component) => sum.addScaledVector(
      component.center,
      component.mass,
    ),
    new THREE.Vector2(),
  ).multiplyScalar(1 / totalMass);
  const momentOfInertia = physicalComponents.reduce(
    (sum, component) => sum + component.inertiaAtCenter
      + component.mass * component.center.lengthSq(),
    0,
  );
  const gravity = 9.81;
  const gravityCoefficient = totalMass * gravity / momentOfInertia;
  const centerOfMassAtAngle = (angle) => rotateVector2(
    centerOfMassLocal,
    angle,
  );
  const gravitationalAngularAccelerationAtAngle = (angle) =>
    -gravityCoefficient * centerOfMassAtAngle(angle).x;
  const potentialEnergyAtAngle = (angle) =>
    totalMass * gravity * centerOfMassAtAngle(angle).y;
  const pickupLiftState = liftStateAtTravel(0);
  const releaseLiftState = liftStateAtTravel(contactTravelAngle);
  const pickupAngularSpeed = pickupLiftState.hammerAnglePerTravel
    * driverAngularSpeed;
  const releaseAngularSpeed = releaseLiftState.hammerAnglePerTravel
    * driverAngularSpeed;
  const releasePotentialEnergy = potentialEnergyAtAngle(raisedHammerAngle);
  const releaseMechanicalEnergy = releasePotentialEnergy
    + 0.5 * momentOfInertia * releaseAngularSpeed ** 2;
  const freeFlightSpeedMagnitudeAtAngle = (angle) => Math.sqrt(Math.max(
    0,
    2 * (
      releaseMechanicalEnergy - potentialEnergyAtAngle(angle)
    ) / momentOfInertia,
  ));

  // The sharp wiper tip releases the hammer with a real upward angular speed.
  // It therefore coasts slightly beyond the engraved raised pose, reverses at
  // its energy apex, and only then falls.  Solve that compound-pendulum flight
  // by energy, retaining the release velocity rather than inserting a pause.
  let lowerApexBound = -Math.PI / 2;
  let upperApexBound = raisedHammerAngle;
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const middle = (lowerApexBound + upperApexBound) / 2;
    if (potentialEnergyAtAngle(middle) > releaseMechanicalEnergy) {
      lowerApexBound = middle;
    } else {
      upperApexBound = middle;
    }
  }
  const freeFlightApexAngle = (lowerApexBound + upperApexBound) / 2;
  const fallTableSamples = 32768;
  const freeFlightTimesFromApex = new Float64Array(fallTableSamples + 1);
  const initialGravityAcceleration =
    gravitationalAngularAccelerationAtAngle(raisedHammerAngle);
  const maximumFlightRoot = Math.sqrt(
    impactHammerAngle - freeFlightApexAngle,
  );
  const potentialDerivativeAtApex = totalMass * gravity
    * centerOfMassAtAngle(freeFlightApexAngle).x;
  const timeIntegrandAtRoot = (rootCoordinate) => {
    if (rootCoordinate === 0) {
      return 2 / Math.sqrt(
        2 * -potentialDerivativeAtApex / momentOfInertia,
      );
    }
    const angle = freeFlightApexAngle + rootCoordinate ** 2;
    return 2 * rootCoordinate / freeFlightSpeedMagnitudeAtAngle(angle);
  };
  let previousIntegrand = timeIntegrandAtRoot(0);
  for (let sample = 1; sample <= fallTableSamples; sample += 1) {
    const rootCoordinate = maximumFlightRoot
      * sample / fallTableSamples;
    const integrand = timeIntegrandAtRoot(rootCoordinate);
    freeFlightTimesFromApex[sample] =
      freeFlightTimesFromApex[sample - 1]
      + (previousIntegrand + integrand) * maximumFlightRoot
        / (2 * fallTableSamples);
    previousIntegrand = integrand;
  }
  const timeFromApexAtAngle = (angle) => {
    const rootCoordinate = Math.sqrt(Math.max(
      0,
      angle - freeFlightApexAngle,
    ));
    const tableCoordinate = THREE.MathUtils.clamp(
      rootCoordinate / maximumFlightRoot * fallTableSamples,
      0,
      fallTableSamples,
    );
    const lower = Math.floor(tableCoordinate);
    const upper = Math.min(fallTableSamples, lower + 1);
    return THREE.MathUtils.lerp(
      freeFlightTimesFromApex[lower],
      freeFlightTimesFromApex[upper],
      tableCoordinate - lower,
    );
  };
  const ascentDuration = timeFromApexAtAngle(raisedHammerAngle);
  const descentDuration = timeFromApexAtAngle(impactHammerAngle);
  const gravityFallDuration = ascentDuration + descentDuration;
  const impactPhase = contactEndPhase
    + gravityFallDuration / lobeCyclePeriod;
  const impactAngularSpeed = freeFlightSpeedMagnitudeAtAngle(
    impactHammerAngle,
  );
  const impactKineticEnergy = 0.5 * momentOfInertia
    * impactAngularSpeed ** 2;
  const dwellDuration = (1 - impactPhase) * lobeCyclePeriod;

  const fallStateAtElapsedTime = (elapsedTime) => {
    if (elapsedTime <= 0) {
      return {
        angle: raisedHammerAngle,
        angularAcceleration: initialGravityAcceleration,
        angularSpeed: releaseAngularSpeed,
        branch: 'upward-coast',
        tableCoordinate: ascentDuration,
      };
    }
    if (elapsedTime >= gravityFallDuration) {
      return {
        angle: impactHammerAngle,
        angularAcceleration:
          gravitationalAngularAccelerationAtAngle(impactHammerAngle),
        angularSpeed: impactAngularSpeed,
        branch: 'downward-fall',
        tableCoordinate: fallTableSamples,
      };
    }
    const rising = elapsedTime < ascentDuration;
    const targetTimeFromApex = rising
      ? ascentDuration - elapsedTime
      : elapsedTime - ascentDuration;
    let lower = 0;
    let upper = fallTableSamples;
    while (upper - lower > 1) {
      const middle = (lower + upper) >> 1;
      if (freeFlightTimesFromApex[middle] <= targetTimeFromApex) {
        lower = middle;
      }
      else upper = middle;
    }
    const interval = freeFlightTimesFromApex[upper]
      - freeFlightTimesFromApex[lower];
    const fraction = interval > 0
      ? (
        targetTimeFromApex - freeFlightTimesFromApex[lower]
      ) / interval
      : 0;
    const tableCoordinate = lower + fraction;
    const rootCoordinate = maximumFlightRoot
      * tableCoordinate / fallTableSamples;
    const angle = freeFlightApexAngle + rootCoordinate ** 2;
    const speedMagnitude = freeFlightSpeedMagnitudeAtAngle(angle);
    return {
      angle,
      angularAcceleration: gravitationalAngularAccelerationAtAngle(angle),
      angularSpeed: rising ? -speedMagnitude : speedMagnitude,
      branch: rising ? 'upward-coast' : 'downward-fall',
      tableCoordinate,
    };
  };

  if (!(impactPhase < 1)) {
    throw new Error('Movement 353 gravity fall must finish before the next wiper.');
  }

  const initialCyclePhase = contactEndPhase;
  const boundaryEpsilon = 1e-12;
  const normalizedCoordinate = (coordinate) => {
    const nearestInteger = Math.round(coordinate);
    return Math.abs(coordinate - nearestInteger) < boundaryEpsilon
      ? nearestInteger
      : coordinate;
  };
  const stageAtPhase = (phase) => {
    if (phase < contactStartPhase - boundaryEpsilon) {
      return 'anvil-dwell-before-next-wiper';
    }
    if (phase <= contactEndPhase + boundaryEpsilon) {
      return 'wiper-depresses-tail-and-lifts-head';
    }
    if (phase <= impactPhase + boundaryEpsilon) {
      return 'released-compound-pendulum-gravity-fall';
    }
    return 'inelastic-impact-dwell-on-anvil';
  };

  const stateAtCycleCoordinate = (unwrappedCoordinate) => {
    const cycleCoordinate = normalizedCoordinate(unwrappedCoordinate);
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const driverAngle = (cycleCoordinate - contactStartPhase) * lobePitch;
    const activeLobeIndex = positiveModulo(-cycleIndex, lobeCount);
    const activeLobeMountAngle = activeLobeIndex * lobePitch;
    const stage = stageAtPhase(cyclePhase);
    const camContactEngaged =
      stage === 'wiper-depresses-tail-and-lifts-head';
    let eventFraction = 0;
    let fallElapsedTime = 0;
    let hammerAngle;
    let hammerAngularAcceleration;
    let hammerAngularSpeed;
    let liftContact = null;
    let freeFlightBranch = null;
    if (camContactEngaged) {
      eventFraction = THREE.MathUtils.clamp(
        (cyclePhase - contactStartPhase) / contactPhaseSpan,
        0,
        1,
      );
      liftContact = liftStateAtTravel(eventFraction * contactTravelAngle);
      hammerAngle = liftContact.hammerAngle;
      hammerAngularSpeed = liftContact.hammerAnglePerTravel
        * driverAngularSpeed;
      hammerAngularAcceleration = liftContact.hammerAngleSecondPerTravel
        * driverAngularSpeed ** 2;
    } else if (
      stage === 'released-compound-pendulum-gravity-fall'
    ) {
      const unclampedFallElapsedTime =
        (cyclePhase - contactEndPhase) * lobeCyclePeriod;
      fallElapsedTime = THREE.MathUtils.clamp(
        unclampedFallElapsedTime,
        0,
        gravityFallDuration,
      );
      if (Math.abs(fallElapsedTime - gravityFallDuration) < 1e-11) {
        fallElapsedTime = gravityFallDuration;
      }
      const fallState = fallStateAtElapsedTime(fallElapsedTime);
      eventFraction = fallElapsedTime / gravityFallDuration;
      hammerAngle = fallState.angle;
      hammerAngularSpeed = fallState.angularSpeed;
      hammerAngularAcceleration = fallState.angularAcceleration;
      freeFlightBranch = fallState.branch;
    } else {
      hammerAngle = impactHammerAngle;
      hammerAngularSpeed = 0;
      hammerAngularAcceleration = 0;
    }

    const followerOffset = rotateVector2(followerCenterLocal, hammerAngle);
    const followerCenter = new THREE.Vector3(
      hammerPivot.x + followerOffset.x,
      hammerPivot.y + followerOffset.y,
      contactPlaneZ,
    );
    let camContactPoint = null;
    let camLocalContactPoint = null;
    let camNormal = null;
    let camNormalLocal = null;
    let followerContactPoint = null;
    let camFollowerContactError = null;
    let camFollowerNormalVelocityError = null;
    let effortTorqueSense = null;
    if (camContactEngaged) {
      camLocalContactPoint = rotateVector2(
        liftContact.camPointLocal,
        activeLobeMountAngle,
      );
      camNormalLocal = rotateVector2(
        liftContact.normalLocal,
        activeLobeMountAngle,
      );
      const worldContactOffset = rotateVector2(
        camLocalContactPoint,
        driverAngle,
      );
      camNormal = rotateVector2(camNormalLocal, driverAngle);
      camContactPoint = new THREE.Vector3(
        camCenter.x + worldContactOffset.x,
        camCenter.y + worldContactOffset.y,
        contactPlaneZ,
      );
      followerContactPoint = followerCenter.clone().add(
        new THREE.Vector3(
          -camNormal.x * followerRadius,
          -camNormal.y * followerRadius,
          0,
        ),
      );
      camFollowerContactError = camContactPoint.distanceTo(
        followerContactPoint,
      );
      const camRadius = camContactPoint.clone().sub(camCenter).setZ(0);
      const hammerRadius = followerContactPoint.clone()
        .sub(hammerPivot)
        .setZ(0);
      const camVelocity = new THREE.Vector3(
        -camRadius.y * driverAngularSpeed,
        camRadius.x * driverAngularSpeed,
        0,
      );
      const followerVelocity = new THREE.Vector3(
        -hammerRadius.y * hammerAngularSpeed,
        hammerRadius.x * hammerAngularSpeed,
        0,
      );
      camFollowerNormalVelocityError = Math.abs(
        followerVelocity.sub(camVelocity).dot(
          new THREE.Vector3(camNormal.x, camNormal.y, 0),
        ),
      );
      const contactRadius = followerContactPoint.clone()
        .sub(hammerPivot)
        .setZ(0);
      effortTorqueSense = contactRadius.x * camNormal.y
        - contactRadius.y * camNormal.x;
    }

    const strikeOffset = rotateVector2(strikePointLocal, hammerAngle);
    const strikePoint = new THREE.Vector3(
      hammerPivot.x + strikeOffset.x,
      hammerPivot.y + strikeOffset.y,
      contactPlaneZ,
    );
    const anvilGap = strikePoint.y - anvilTopY;
    const anvilContactEngaged = !camContactEngaged
      && anvilGap <= boundaryEpsilon;
    const centerOfMassOffset = centerOfMassAtAngle(hammerAngle);
    const centerOfMass = new THREE.Vector3(
      hammerPivot.x + centerOfMassOffset.x,
      hammerPivot.y + centerOfMassOffset.y,
      contactPlaneZ,
    );
    const kineticEnergy = 0.5 * momentOfInertia
      * hammerAngularSpeed ** 2;
    const potentialEnergy = potentialEnergyAtAngle(hammerAngle);
    const strikesCompleted = cycleIndex
      + (cyclePhase >= impactPhase - boundaryEpsilon ? 1 : 0);
    return {
      activeLobeIndex,
      activeLobeMountAngle,
      anvilContactEngaged,
      anvilGap,
      camContactEngaged,
      camContactPoint,
      camFollowerContactError,
      camFollowerNormalVelocityError,
      camLocalContactPoint,
      camNormal,
      camNormalLocal,
      centerOfMass,
      contactFaceAngle: camContactEngaged
        ? liftContact.faceAngle
        : null,
      contactRadialCoordinate: liftContact?.radialContact ?? null,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      driverAngle,
      driverAngularSpeed,
      driverRevolutions: driverAngle / fullTurn,
      effortTorqueSense,
      eventFraction,
      fallElapsedTime,
      followerCenter,
      followerContactPoint,
      freeFlightBranch,
      hammerAngle,
      hammerAngularAcceleration,
      hammerAngularSpeed,
      kineticEnergy,
      mechanicalEnergy: kineticEnergy + potentialEnergy,
      potentialEnergy,
      stage,
      strikePoint,
      strikesCompleted,
      wiperTipClearance: liftContact?.radialTipClearance ?? null,
    };
  };
  const stateAtTime = (time) => stateAtCycleCoordinate(
    initialCyclePhase + time / lobeCyclePeriod,
  );

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 18, 14),
    whiteMaterial,
  );
  contactMarker.userData.role = 'white-marker-at-exact-wiper-tail-contact';
  const impactMarker = new THREE.Mesh(
    new THREE.TorusGeometry(0.23, 0.045, 10, 36),
    whiteMaterial,
  );
  impactMarker.rotation.x = Math.PI / 2;
  impactMarker.position.set(anvilCenterX, anvilTopY + 0.015, contactPlaneZ);
  impactMarker.userData.role = 'white-marker-at-hammer-anvil-impact';
  root.add(contactMarker, impactMarker);

  const contacts = {
    anvilImpact: {
      engaged: false,
      fixedMember: anvilFace,
      impactKineticEnergy,
      impactSpeed: impactAngularSpeed,
      movingMember: hammerHead,
      normal: new THREE.Vector3(0, 1, 0),
      point: new THREE.Vector3(anvilCenterX, anvilTopY, contactPlaneZ),
      restitution: 0,
      type: 'perfectly-inelastic-gravity-hammer-impact-on-fixed-anvil',
    },
    fixedFulcrum: {
      axis: Z_AXIS.clone(),
      fixedMember: hammerPivotShaft,
      movingMember: movingPivotHub,
      point: hammerPivot.clone(),
      type: 'revolute-joint-between-effort-and-load-first-order-lever',
    },
    wiperTailFollower: {
      camMember: camBody,
      camPoint: null,
      engaged: false,
      error: null,
      followerMember: followerNose,
      followerPoint: null,
      normal: null,
      normalVelocityError: null,
      type: 'sliding-unilateral-leading-radial-wiper-face-contact-on-rounded-opposite-side-tail',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    camRotor.rotation.z = state.driverAngle;
    setSpin(inputShaft, state.driverAngle);
    hammerRotor.rotation.z = state.hammerAngle;
    cam.userData.angularSpeed = state.driverAngularSpeed;
    inputShaft.userData.angularSpeed = state.driverAngularSpeed;
    hammer.userData.angularAcceleration = state.hammerAngularAcceleration;
    hammer.userData.angularSpeed = state.hammerAngularSpeed;
    contactMarker.visible = state.camContactEngaged;
    if (state.camContactPoint) contactMarker.position.copy(state.camContactPoint);
    impactMarker.visible = state.anvilContactEngaged;
    contacts.wiperTailFollower.engaged = state.camContactEngaged;
    contacts.wiperTailFollower.camPoint =
      state.camContactPoint?.clone() ?? null;
    contacts.wiperTailFollower.error = state.camFollowerContactError;
    contacts.wiperTailFollower.followerPoint =
      state.followerContactPoint?.clone() ?? null;
    contacts.wiperTailFollower.normal = state.camNormal?.clone() ?? null;
    contacts.wiperTailFollower.normalVelocityError =
      state.camFollowerNormalVelocityError;
    contacts.anvilImpact.engaged = state.anvilContactEngaged;
    contacts.anvilImpact.point.copy(state.strikePoint);
    root.userData.kinematics = state;
  };

  const effortLeverArm = followerCenterLocal.length();
  const loadLeverArm = strikePointLocal.length();
  root.userData.archetype = 'first-order-four-wiper-gravity-trip-hammer';
  root.userData.blocks = {
    anvilBody,
    anvilFace,
    base,
    cam,
    camBody,
    camBraceLeft,
    camBraceRight,
    camFaceRing,
    camHub,
    camIndicator,
    camDisk,
    camPost,
    camPostCap,
    camRotor,
    contactMarker,
    fixedFrame,
    frontPivotBearing,
    hammer,
    hammerHead,
    hammerIndicator,
    hammerPivotShaft,
    hammerRotor,
    headOutline,
    helve,
    helveOutline,
    impactMarker,
    inputShaft,
    movingJournalBlock,
    movingPivotHub,
    movingPivotRing,
    pivotBridge,
    pivotPost,
    rearCamBearing,
    rearPivotBearing,
    followerNose,
    wiperMeshes,
  };
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.65, -0.94, -0.92),
    new THREE.Vector3(4.18, 4.56, 1.14),
  );
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one continuously counter-clockwise horizontal wiper shaft',
    mechanism: 1,
    output:
      'one rigid hammer helve oscillating about the fixed fulcrum between its head and driven tail',
  };
  root.userData.dynamics = {
    ascentDuration,
    centerOfMassLocal: centerOfMassLocal.clone(),
    contactDuration,
    descentDuration,
    dwellDuration,
    fallStateAtElapsedTime,
    fallTableSamples,
    freeFlightApexAngle,
    freeFlightTimesFromApex,
    gravity,
    gravityCoefficient,
    gravityFallDuration,
    impactAngularSpeed,
    impactKineticEnergy,
    initialGravityAcceleration,
    momentOfInertia,
    physicalComponents,
    pickupAngularSpeed,
    potentialEnergyAtAngle,
    releaseAngularSpeed,
    releaseMechanicalEnergy,
    releasePotentialEnergy,
    restitution: 0,
    totalMass,
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    activeContactPlaneZ: contactPlaneZ,
    anvilCenterX,
    anvilStrikePointLocal: anvilStrikePointLocal.clone(),
    anvilTopY,
    axis: Z_AXIS.clone(),
    camBaseRadius,
    camCenter: camCenter.clone(),
    camDepth,
    contactEndPhase,
    contactPhaseSpan,
    contactStartPhase,
    contactTravelAngle,
    contactAuditSamples,
    driverAngularSpeed,
    driverFullTurnPeriod,
    effortLeverArm,
    followerCenterLocal: followerCenterLocal.clone(),
    followerArmRadius,
    followerBaseAngle,
    followerRadius,
    fullTurn,
    hammerDepth,
    hammerPivot: hammerPivot.clone(),
    impactHammerAngle,
    impactPhase,
    initialCyclePhase,
    leadingFaceMountAngle,
    leadingFaces,
    loadLeverArm,
    lobeCount,
    lobeCyclePeriod,
    lobePitch,
    minimumContactRadius,
    raisedHammerAngle,
    releaseFaceAngle,
    sourceAnvilTopLocalY,
    sourceScale,
    strikePointLocal: strikePointLocal.clone(),
    wiperAngularWidth,
    wiperProfiles,
    wiperTipRadius,
  };
  root.userData.leverClassification = {
    effort:
      'the four-lobe wheel pushes the rounded tail to the right of the fulcrum',
    effortLeverArm,
    fulcrum:
      'the fixed central journal lies between wiper effort and hammer load',
    load: 'the heavy hammer head and anvil strike lie left of the fulcrum',
    loadLeverArm,
    order: 1,
    oppositeSides:
      followerCenterLocal.x * strikePointLocal.x < 0,
    staticAngularDisplacementRatio: effortLeverArm / loadLeverArm,
  };
  root.userData.mechanism =
    'one-counter-clockwise-four-lobe-wiper-wheel-depresses-the-right-hand-tail-of-one-rigid-first-order-hammer-helve-about-a-fixed-fulcrum-between-effort-and-left-hand-load-raising-the-heavy-head-four-times-per-wheel-revolution-before-each-abrupt-release-compound-pendulum-gravity-strike-and-zero-restitution-anvil-dwell';
  root.userData.sourceAnimation = {
    available: false,
    officialCanvasModelPresent: false,
    pageMarksAnimationUnavailable: true,
    presentationTiming: {
      driverFullTurnPeriod,
      lobeCyclePeriod,
      sourcePrescribed: false,
    },
    referenceMovement72: {
      difference:
        'movement 72 puts cam effort and hammer load on the same side of its fulcrum, making its helve a third-order lever',
      sourceUrl: 'https://507movements.com/mm_072.html',
    },
    referenceScope:
      'engraving topology, four wipers, counter-clockwise arrow, central fulcrum, opposite-side tail effort, left hammer head, right shaft pedestal, and lower-left anvil',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate353: {
      imageHeight: 525,
      imageWidth: 525,
      inferredRaisedPose: true,
      measurementUncertaintyPixels: 7,
      rasterAnvilTop: sourceAnvilTopRaster.clone(),
      rasterCamCenter: sourceCamCenterRaster.clone(),
      rasterFollowerCenter: sourceFollowerCenterRaster.clone(),
      rasterFulcrum: sourcePivotRaster.clone(),
      rasterStrikePoint: sourceStrikePointRaster.clone(),
      visibleWiperCount: lobeCount,
    },
    editorialCorrection: {
      correctedReference: 72,
      originalPrintedReference: 74,
      sourceSiteNote:
        '507movements.com identifies Brown\'s reference to 74 as a mistake and links the comparison to 72',
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    blowsPerWheelRevolution: lobeCount,
    contactConstraint:
      'the rounded tail remains exactly tangent to a finite radial leading face while its contact slides outward to the wiper tip with identical normal velocity',
    gravityReturn:
      'after rolling off each finite wiper tip with its actual release speed, the complete rigid hammer coasts upward, reverses, and follows its compound-pendulum energy law to the anvil',
    leverLaw:
      'the fixed fulcrum separates the right-hand cam effort from the left-hand hammer load, so their instantaneous displacements have opposite signs',
  };
  root.userData.liftStateAtTravel = liftStateAtTravel;

  update(0);
  markShadows(root);
  for (const line of [headOutline, helveOutline]) {
    line.castShadow = false;
    line.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(5.9, 3.8, 11.8),
    root,
    update,
  };
}

export function createAuthoredTripHammerMovement(movement) {
  if (movement.id !== 353) return null;
  const model = firstOrderTripHammer(movement);
  correctTripHammerParts(model);
  removeUndrawnHelveSupports(model);
  markShadows(model.root);
  return model;
}

// Brown draws the helve's pivot box with no post, bridge or rear bearing
// under it, so none is shown: the fixed fulcrum is the short shaft through
// the box, ending in its front retainer and just behind the moving hub.
function removeUndrawnHelveSupports(model) {
  const root = model.root;
  root.updateMatrixWorld(true);
  const b = root.userData.blocks;
  for (const part of [b.pivotBridge, b.rearPivotBearing, b.pivotPost]) part.removeFromParent();
  const hubBox = new THREE.Box3().setFromObject(b.movingPivotHub);
  const retainerBox = new THREE.Box3().setFromObject(b.frontPivotBearing);
  const back = hubBox.min.z - 0.05;
  const front = retainerBox.max.z;
  const shaft = b.hammerPivotShaft;
  shaft.traverse((object) => {
    if (!object.isMesh) return;
    const radius = object.geometry.parameters.radiusTop;
    object.geometry.dispose();
    object.geometry = new THREE.CylinderGeometry(radius, radius, front - back, 22);
  });
  shaft.position.z = (front + back) / 2;
  shaft.userData.length = front - back;
  // Likewise no rear bearing is drawn behind the wiper wheel: its shaft runs
  // from the post in front to a cut end just behind the wheel's hub.
  b.rearCamBearing.removeFromParent();
  const camHubBox = new THREE.Box3().setFromObject(b.camHub);
  const inputBox = new THREE.Box3().setFromObject(b.inputShaft);
  const inputBack = camHubBox.min.z - 0.05;
  const inputFront = inputBox.max.z;
  b.inputShaft.traverse((object) => {
    if (!object.isMesh) return;
    const radius = object.geometry.parameters.radiusTop;
    object.geometry.dispose();
    object.geometry = new THREE.CylinderGeometry(radius, radius, inputFront - inputBack, 22);
  });
  b.inputShaft.position.z += (inputFront + inputBack) / 2 - (inputBox.min.z + inputBox.max.z) / 2;
}
