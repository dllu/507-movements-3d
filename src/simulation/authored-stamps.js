import {stampMeshParameters,correctStampParts} from './stamp-trip-working-parts.js';
import { plate, polygonClipping } from './finite-plate-geometry.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

function cylinderAlongZ(radius, depth, material, segments = 36) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function centeredExtrusion(shape, depth, options = {}) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: options.bevelEnabled ?? false,
    bevelSegments: options.bevelSegments ?? 1,
    bevelSize: options.bevelSize ?? 0.015,
    bevelThickness: options.bevelThickness ?? 0.015,
    curveSegments: options.curveSegments ?? 2,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function rectangularShape(width, height) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -height / 2);
  shape.lineTo(width / 2, -height / 2);
  shape.lineTo(width / 2, height / 2);
  shape.lineTo(-width / 2, height / 2);
  shape.closePath();
  return shape;
}

function makeFaceLine(start, end, material, z) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(start.x, start.y, z),
    new THREE.Vector3(end.x, end.y, z),
  ]);
  const line = new THREE.Line(geometry, material);
  line.userData.noShadow = true;
  return line;
}

function gravityDropStamp(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // The engraving has eight teeth at about twenty-degree spacing over the
  // upper-left of a large pinion whose remaining arc is blank. Treating the
  // pitch as one eighteenth-turn makes the rack and sector close exactly at
  // every tooth handoff; the rack's fine teeth then match Brown's pitch.
  const virtualToothCount = 18;
  const sectorToothCount = 8;
  const missingToothCount = virtualToothCount - sectorToothCount;
  const toothPitchAngle = fullTurn / virtualToothCount;
  const engagementFraction = sectorToothCount / virtualToothCount;
  const pitchRadius = 1.30;
  // Brown's square teeth stand about three-quarters of a pitch deep; involute
  // teeth that deep (contact ratio about 1.3) replace the shallow
  // contact-ratio-one teeth.
  const meshAddendum = 0.13;
  const workingMesh = stampMeshParameters(pitchRadius, virtualToothCount, meshAddendum);
  const rackToothPitch = pitchRadius * toothPitchAngle;
  const rackStroke = sectorToothCount * rackToothPitch;
  const cyclesPerMinute = 15;
  const cyclePeriod = 60 / cyclesPerMinute;
  const driverAngularVelocity = -fullTurn / cyclePeriod;
  const rackLiftVelocity = -driverAngularVelocity * pitchRadius;
  const releaseTime = engagementFraction * cyclePeriod;

  // World units are treated as metres for the free-flight interval. The
  // release velocity is the pitch-line velocity, not an artificial zero-speed
  // pause. The inelastic lower-stop impact is the percussive event described
  // by Brown.
  const gravity = 9.81;
  const fallingMass = 1.8;
  const ballisticTimeToImpact = (
    rackLiftVelocity
      + Math.sqrt(rackLiftVelocity ** 2 + 2 * gravity * rackStroke)
  ) / gravity;
  const impactTime = releaseTime + ballisticTimeToImpact;
  const impactPhase = impactTime / cyclePeriod;
  const dwellTime = cyclePeriod - impactTime;
  const dwellFraction = dwellTime / cyclePeriod;
  const ballisticApexTimeAfterRelease = rackLiftVelocity / gravity;
  const ballisticApexPhase = engagementFraction
    + ballisticApexTimeAfterRelease / cyclePeriod;
  const maximumRackDisplacement = rackStroke
    + rackLiftVelocity ** 2 / (2 * gravity);
  const impactVelocity = rackLiftVelocity
    - gravity * ballisticTimeToImpact;
  const releaseMechanicalEnergy = fallingMass * gravity * rackStroke
    + 0.5 * fallingMass * rackLiftVelocity ** 2;
  const impactKineticEnergy = 0.5 * fallingMass * impactVelocity ** 2;

  const wheelCenter = new THREE.Vector2(0.28 + pitchRadius, 0.30);
  const rackCenterX = 0;
  const rackBarWidth = 0.20;
  const rackToothRootX = rackCenterX + rackBarWidth / 2;
  const rackToothTipX = wheelCenter.x - pitchRadius + workingMesh.addendum;
  const pitchLineX = wheelCenter.x - pitchRadius;
  const gearRootRadius = workingMesh.rootRadius;
  const gearOuterRadius = workingMesh.tipRadius;
  const gearDepth = 0.42;
  const rackDepth = 0.38;
  const gearPlaneZ = 0.24;
  const rackPlaneZ = 0.23;
  const jointPlaneZ = 0.52;
  const gearBaseAngle = workingMesh.gearBaseAngle;
  const installedToothIndices = Array.from(
    { length: sectorToothCount },
    (_, index) => index,
  );

  // The rack rides the withdrawing final tooth above the pitch-line stroke,
  // so the smooth lower rod is long enough for the head and collar to stay
  // below the lower guide at the carried apex.
  const lowerRodExtension = 0.80;
  const rackBarBottomY = -6.33 - lowerRodExtension;
  const rackBarTopY = 3.62;
  const rackBarLength = rackBarTopY - rackBarBottomY;
  const rackToothBaseY = wheelCenter.y + workingMesh.rackOffset;
  const firstRackToothIndex = -(sectorToothCount + 1);
  const lastRackToothIndex = 4;
  const rackToothThickness = rackToothPitch * 0.38;
  const upperGuideY = 3.42;
  const lowerGuideY = -2.36;
  const stampFaceRestY = -7.02 - lowerRodExtension - 1.37;
  const workpieceTopY = stampFaceRestY;
  const anvilTopY = workpieceTopY - 0.13;
  const impactPoint = new THREE.Vector3(
    rackCenterX,
    stampFaceRestY,
    jointPlaneZ,
  );
  const gearContactPoint = new THREE.Vector3(
    pitchLineX,
    wheelCenter.y,
    jointPlaneZ,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.17,
    roughness: 0.63,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const gearMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.55,
  });
  const rackMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.57,
  });
  const impactMaterial = matte(PALETTE.accent, {
    metalness: 0.13,
    roughness: 0.56,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });
  const faceLineMaterial = new THREE.LineBasicMaterial({
    color: PALETTE.ink,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'fixed-frame-with-two-open-rack-guides-shaft-bearing-and-anvil';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(4.65, 0.22, 1.42),
    frameMaterial,
  );
  base.position.set(0.68, -4.22, -0.20);
  base.userData.role = 'fixed-stamp-machine-base';
  const rearPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 8.05, 0.34),
    frameMaterial,
  );
  rearPost.position.set(2.63, -0.17, -0.53);
  rearPost.userData.role = 'fixed-rear-frame-post';
  const topBridge = makeBeam(
    new THREE.Vector3(-0.68, upperGuideY, -0.53),
    new THREE.Vector3(2.63, upperGuideY, -0.53),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.18 },
  );
  topBridge.userData.role = 'fixed-top-guide-bridge';
  const lowerBridge = makeBeam(
    new THREE.Vector3(-0.68, lowerGuideY, -0.53),
    new THREE.Vector3(2.63, lowerGuideY, -0.53),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.18 },
  );
  lowerBridge.userData.role = 'fixed-lower-guide-bridge';
  const bearingBridge = makeBeam(
    new THREE.Vector3(wheelCenter.x, wheelCenter.y, -0.53),
    new THREE.Vector3(2.63, wheelCenter.y, -0.53),
    { color: PALETTE.frame, depth: 0.20, thickness: 0.18 },
  );
  bearingBridge.userData.role = 'fixed-input-shaft-bearing-bridge';

  const guideAssemblies = [
    ['upper', upperGuideY],
    ['lower', lowerGuideY],
  ].map(([name, y]) => {
    const guide = new THREE.Group();
    guide.position.y = y;
    guide.userData.openTowardRackTeeth = true;
    guide.userData.role = `${name}-C-shaped-rack-guide-open-to-teeth`;
    const leftJaw = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.34, 0.78),
      frameMaterial,
    );
    leftJaw.position.set(-0.20, 0, -0.01);
    leftJaw.userData.role = `${name}-guide-left-bearing-jaw`;
    const rearLip = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.34, 0.12),
      inkMaterial,
    );
    rearLip.position.set(-0.01, 0, -0.28);
    rearLip.userData.role = `${name}-guide-rear-depth-lip`;
    const frontLip = rearLip.clone();
    frontLip.position.z = 0.28;
    frontLip.userData.role = `${name}-guide-front-depth-lip`;
    const guideIndex = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.24, 0.81),
      whiteMaterial,
    );
    guideIndex.position.set(-0.305, 0, 0);
    guideIndex.userData.role = `${name}-guide-white-motion-index`;
    guide.add(leftJaw, rearLip, frontLip, guideIndex);
    fixedFrame.add(guide);
    return { frontLip, guide, guideIndex, leftJaw, rearLip };
  });

  const shaftBearing = cylinderAlongZ(0.25, 0.30, frameMaterial, 40);
  shaftBearing.position.set(wheelCenter.x, wheelCenter.y, -0.31);
  shaftBearing.userData.role = 'fixed-bearing-for-horizontal-pinion-shaft';

  const anvil = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.36, 1.05),
    frameMaterial,
  );
  anvil.position.set(rackCenterX, anvilTopY - 0.18, -0.03);
  anvil.userData.role = 'fixed-anvil-below-falling-stamp';
  const workpiece = new THREE.Mesh(
    new THREE.BoxGeometry(1.03, 0.13, 0.83),
    impactMaterial,
  );
  workpiece.position.set(
    rackCenterX,
    workpieceTopY - 0.065,
    0.09,
  );
  workpiece.userData.role = 'fixed-workpiece-at-lower-impact-stop';
  const impactHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.47, 0.035, 8, 42),
    whiteMaterial,
  );
  impactHalo.rotation.x = Math.PI / 2;
  impactHalo.position.set(rackCenterX, workpieceTopY + 0.01, 0.12);
  impactHalo.userData.role = 'lower-stop-impact-contact-ring';

  fixedFrame.add(
    base,
    rearPost,
    topBridge,
    lowerBridge,
    bearingBridge,
    shaftBearing,
    anvil,
    workpiece,
    impactHalo,
  );
  root.add(fixedFrame);

  const pinion = new THREE.Group();
  pinion.position.set(wheelCenter.x, wheelCenter.y, gearPlaneZ);
  pinion.userData.role =
    'continuous-clockwise-eight-tooth-mutilated-pinion-on-horizontal-shaft';
  const gearBody = cylinderAlongZ(
    gearRootRadius,
    gearDepth,
    gearMaterial,
    64,
  );
  gearBody.userData.role = 'mutilated-pinion-root-disk-and-blank-sector';
  const gearRootOutline = new THREE.Mesh(
    new THREE.TorusGeometry(gearRootRadius, 0.025, 8, 64),
    inkMaterial,
  );
  gearRootOutline.position.z = gearDepth / 2 + 0.017;
  gearRootOutline.userData.role = 'mutilated-pinion-root-circle-outline';
  const gearTeeth = [];
  const gearToothFaceLines = [];
  const toothRootHalfAngle = toothPitchAngle * 0.39;
  const toothOuterHalfAngle = toothPitchAngle * 0.20;
  for (const toothIndex of installedToothIndices) {
    const centerAngle = toothIndex * toothPitchAngle;
    const polar = (radius, angle) => new THREE.Vector2(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    );
    const points = [
      polar(gearRootRadius, centerAngle - toothRootHalfAngle),
      polar(gearOuterRadius, centerAngle - toothOuterHalfAngle),
      polar(gearOuterRadius, centerAngle + toothOuterHalfAngle),
      polar(gearRootRadius, centerAngle + toothRootHalfAngle),
    ];
    const shape = new THREE.Shape();
    points.forEach((point, pointIndex) => {
      if (pointIndex === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    });
    shape.closePath();
    const tooth = new THREE.Mesh(
      centeredExtrusion(shape, gearDepth),
      gearMaterial,
    );
    tooth.userData.index = toothIndex;
    tooth.userData.role = `installed-mutilated-pinion-tooth-${toothIndex + 1}`;
    pinion.add(tooth);
    gearTeeth.push(tooth);
    const line = makeFaceLine(
      polar(gearRootRadius, centerAngle),
      polar(gearOuterRadius, centerAngle),
      faceLineMaterial,
      gearDepth / 2 + 0.025,
    );
    line.userData.index = toothIndex;
    line.userData.role = `pinion-tooth-${toothIndex + 1}-face-index`;
    pinion.add(line);
    gearToothFaceLines.push(line);
  }
  const pinionHub = cylinderAlongZ(0.17, 0.72, inkMaterial, 34);
  pinionHub.userData.role = 'mutilated-pinion-hub-on-horizontal-shaft';
  const pinionIndicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.065, 0.034),
    whiteMaterial,
  );
  pinionIndicator.position.set(0.39, 0, gearDepth / 2 + 0.043);
  pinionIndicator.userData.role = 'white-pinion-spin-rate-indicator';
  const blankSectorIndicator = new THREE.Mesh(
    new THREE.TorusGeometry(
      gearRootRadius * 0.68,
      0.026,
      8,
      32,
      missingToothCount * toothPitchAngle * 0.82,
    ),
    inkMaterial,
  );
  blankSectorIndicator.rotation.z =
    (sectorToothCount + 0.1) * toothPitchAngle;
  blankSectorIndicator.position.z = gearDepth / 2 + 0.033;
  blankSectorIndicator.userData.role =
    'face-arc-identifying-ten-position-toothless-sector';
  const pinionPitchContactAnchor = new THREE.Object3D();
  pinionPitchContactAnchor.position.z = jointPlaneZ - gearPlaneZ;
  pinionPitchContactAnchor.userData.role =
    'pinion-analytic-active-pitch-contact-anchor';
  pinion.add(
    gearBody,
    gearRootOutline,
    pinionHub,
    pinionIndicator,
    blankSectorIndicator,
    pinionPitchContactAnchor,
  );
  pinion.userData.installedToothIndices = installedToothIndices;
  pinion.userData.missingToothCount = missingToothCount;
  pinion.userData.mutilated = true;
  pinion.userData.pitchRadius = pitchRadius;
  pinion.userData.teeth = virtualToothCount;
  root.add(pinion);

  const inputShaft = cylinderAlongZ(0.105, 1.48, inkMaterial, 28);
  inputShaft.position.set(wheelCenter.x, wheelCenter.y, 0.18);
  inputShaft.userData.role = 'horizontal-continuously-rotating-input-shaft';
  root.add(inputShaft);

  const rack = new THREE.Group();
  rack.position.z = rackPlaneZ;
  rack.userData.axis = new THREE.Vector3(0, 1, 0);
  rack.userData.role =
    'vertically-guided-rack-rod-and-falling-stamp-member';
  const rackBar = new THREE.Mesh(
    new THREE.BoxGeometry(rackBarWidth, rackBarLength, rackDepth * 0.72),
    rackMaterial,
  );
  rackBar.position.set(
    rackCenterX,
    (rackBarBottomY + rackBarTopY) / 2,
    0,
  );
  rackBar.userData.role = 'smooth-backed-vertical-stamp-rod';
  rack.add(rackBar);
  const rackTeeth = [];
  const rackToothFaceLines = [];
  for (
    let toothIndex = firstRackToothIndex;
    toothIndex <= lastRackToothIndex;
    toothIndex += 1
  ) {
    const toothY = rackToothBaseY + toothIndex * rackToothPitch;
    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(
        rackToothTipX - rackToothRootX,
        rackToothThickness,
        rackDepth,
      ),
      rackMaterial,
    );
    tooth.position.set(
      (rackToothRootX + rackToothTipX) / 2,
      toothY,
      0,
    );
    tooth.userData.index = toothIndex;
    tooth.userData.role = `single-sided-rack-tooth-${toothIndex}`;
    rack.add(tooth);
    rackTeeth.push(tooth);
    const line = makeFaceLine(
      new THREE.Vector2(rackToothRootX, toothY),
      new THREE.Vector2(rackToothTipX, toothY),
      faceLineMaterial,
      rackDepth / 2 + 0.025,
    );
    line.userData.index = toothIndex;
    line.userData.role = `rack-tooth-${toothIndex}-face-index`;
    rack.add(line);
    rackToothFaceLines.push(line);
  }

  const topRodCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.20, 0.51),
    rackMaterial,
  );
  topRodCap.position.set(rackCenterX, rackBarTopY + 0.10, 0);
  topRodCap.userData.role = 'moving-top-cap-on-stamp-rod';
  const lowerCollar = new THREE.Mesh(
    new THREE.BoxGeometry(0.88, 0.24, 0.68),
    rackMaterial,
  );
  lowerCollar.position.set(rackCenterX, -6.32 - lowerRodExtension, 0);
  lowerCollar.userData.role = 'moving-lower-collar-above-stamp-head';

  const dieShape = new THREE.Shape();
  dieShape.moveTo(-0.42, -0.45);
  dieShape.lineTo(0.42, -0.45);
  dieShape.lineTo(0.62, -0.08);
  dieShape.lineTo(0.45, 0.26);
  dieShape.lineTo(0.25, 0.42);
  dieShape.lineTo(-0.25, 0.42);
  dieShape.lineTo(-0.45, 0.26);
  dieShape.lineTo(-0.62, -0.08);
  dieShape.closePath();
  const stampDie = new THREE.Mesh(
    centeredExtrusion(dieShape, 0.72, {
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.025,
      bevelThickness: 0.025,
    }),
    rackMaterial,
  );
  stampDie.position.set(
    rackCenterX,
    stampFaceRestY + 0.45,
    0,
  );
  stampDie.userData.role = 'heavy-falling-polygonal-stamp-head';
  const dieFace = new THREE.Mesh(
    centeredExtrusion(rectangularShape(0.76, 0.055), 0.74),
    inkMaterial,
  );
  dieFace.position.set(rackCenterX, stampFaceRestY + 0.0275, 0);
  dieFace.userData.role = 'flat-lower-impact-face-of-stamp';
  const rackTravelIndicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.085, 0.56, rackDepth + 0.035),
    whiteMaterial,
  );
  rackTravelIndicator.position.set(rackCenterX, -1.55, 0.012);
  rackTravelIndicator.userData.role = 'white-rack-vertical-speed-index';
  const stampFaceAnchor = new THREE.Object3D();
  stampFaceAnchor.position.set(
    rackCenterX,
    stampFaceRestY,
    jointPlaneZ - rackPlaneZ,
  );
  stampFaceAnchor.userData.role = 'stamp-analytic-lower-impact-face-anchor';
  const rackPitchContactAnchor = new THREE.Object3D();
  rackPitchContactAnchor.position.set(
    pitchLineX - rackCenterX,
    wheelCenter.y,
    jointPlaneZ - rackPlaneZ,
  );
  rackPitchContactAnchor.userData.role =
    'rack-analytic-active-pitch-contact-anchor';

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 24, 14),
    whiteMaterial,
  );
  contactMarker.position.set(
    gearContactPoint.x - rackCenterX,
    gearContactPoint.y - rack.position.y,
    jointPlaneZ - rackPlaneZ,
  );
  contactMarker.userData.role = 'visible-pitch-line-gear-rack-contact';
  rack.add(
    topRodCap,
    lowerCollar,
    stampDie,
    dieFace,
    rackTravelIndicator,
    stampFaceAnchor,
    rackPitchContactAnchor,
  );
  root.add(rack, contactMarker);

  const stateAtCycleCoordinate = (cycleCoordinate) => {
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const cycleTime = cyclePhase * cyclePeriod;
    const driverAngle = gearBaseAngle - fullTurn * cycleCoordinate;
    const gearEngaged = cyclePhase < engagementFraction;
    const timeAfterRelease = Math.max(0, cycleTime - releaseTime);
    const ballisticDisplacement = rackStroke
      + rackLiftVelocity * timeAfterRelease
      - 0.5 * gravity * timeAfterRelease ** 2;
    const freeFlight = !gearEngaged
      && timeAfterRelease < ballisticTimeToImpact;
    const lowerStopEngaged = !gearEngaged && !freeFlight;
    let rackDisplacement;
    let rackVelocity;
    let rackAcceleration;
    if (gearEngaged) {
      rackDisplacement = fullTurn * pitchRadius * cyclePhase;
      rackVelocity = rackLiftVelocity;
      rackAcceleration = 0;
    } else if (freeFlight) {
      rackDisplacement = ballisticDisplacement;
      rackVelocity = rackLiftVelocity - gravity * timeAfterRelease;
      rackAcceleration = -gravity;
    } else {
      rackDisplacement = 0;
      rackVelocity = 0;
      rackAcceleration = 0;
    }
    if (Math.abs(rackDisplacement) < 1e-13) rackDisplacement = 0;
    if (Math.abs(rackVelocity) < 1e-13) rackVelocity = 0;
    const activeGearToothIndex = gearEngaged
      ? Math.min(
        sectorToothCount - 1,
        Math.floor(cyclePhase * virtualToothCount),
      )
      : null;
    const activeGearToothPhase = gearEngaged
      ? cyclePhase * virtualToothCount - activeGearToothIndex
      : null;
    const activeRackGapIndex = gearEngaged
      ? -activeGearToothIndex - 1
      : null;
    const gearContactCoordinate = cyclePhase * virtualToothCount - 0.5;
    const rackContactCoordinate = -rackDisplacement / rackToothPitch;
    const meshPhaseInvariant = gearContactCoordinate
      + rackContactCoordinate;
    const meshPhaseError = gearEngaged
      ? Math.abs(meshPhaseInvariant + 0.5)
      : null;
    const driverSurfaceVelocity = new THREE.Vector3(
      0,
      rackLiftVelocity,
      0,
    );
    const rackSurfaceVelocity = new THREE.Vector3(
      0,
      rackVelocity,
      0,
    );
    const kineticEnergy = 0.5 * fallingMass * rackVelocity ** 2;
    const gravitationalPotentialEnergy = fallingMass * gravity
      * rackDisplacement;
    const mechanicalEnergy = kineticEnergy
      + gravitationalPotentialEnergy;
    const toothlessClearancePitches = gearEngaged
      ? 0
      : Math.max(0, Math.min(
        cyclePhase * virtualToothCount - sectorToothCount,
        (1 - cyclePhase) * virtualToothCount,
      ));
    const timeSinceImpact = lowerStopEngaged
      ? cycleTime - impactTime
      : null;
    return {
      activeGearToothIndex,
      activeGearToothPhase,
      activeRackGapIndex,
      anvilClearance: rackDisplacement,
      ballisticDisplacement,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      cycleTime,
      driverAngle,
      driverAngularVelocity,
      driverSurfaceVelocity,
      freeFlight,
      gearContactCoordinate,
      gearEngaged,
      gravitationalForce: new THREE.Vector3(
        0,
        -fallingMass * gravity,
        0,
      ),
      gravitationalPotentialEnergy,
      impactKineticEnergy,
      impactVelocity,
      kineticEnergy,
      lowerStopEngaged,
      maximumRackDisplacement,
      mechanicalEnergy,
      meshPhaseError,
      meshPhaseInvariant,
      pitchesLifted: rackDisplacement / rackToothPitch,
      rackAcceleration,
      rackContactCoordinate,
      rackDisplacement,
      rackSurfaceVelocity,
      rackVelocity,
      releaseMechanicalEnergy,
      risingAfterRelease: freeFlight && rackVelocity > 0,
      stage: gearEngaged
        ? 'toothed-sector-raises-rack-and-stamp'
        : freeFlight
          ? rackVelocity > 0
            ? 'released-stamp-coasts-upward-under-gravity'
            : 'released-stamp-falls-ballistically'
          : 'stamp-rests-on-lower-impact-stop-during-blank-sector',
      stampFaceY: stampFaceRestY + rackDisplacement,
      surfaceVelocityError: gearEngaged
        ? driverSurfaceVelocity.distanceTo(rackSurfaceVelocity)
        : null,
      timeAfterRelease,
      timeSinceImpact,
      toothlessClearancePitches,
    };
  };
  const initialCyclePhase = engagementFraction;
  const stateAtUnshiftedTime = (time) => stateAtCycleCoordinate(time / cyclePeriod);
  const stateAtTime = (time) => stateAtCycleCoordinate(
    initialCyclePhase + time / cyclePeriod,
  );
  const canonicalTimes = {
    toothEngagement: 0,
    thirdToothCenter: 2.5 * cyclePeriod / virtualToothCount,
    release: releaseTime,
    ballisticApex: releaseTime + ballisticApexTimeAfterRelease,
    impact: impactTime,
    midDwell: (impactTime + cyclePeriod) / 2,
    cycleClosure: cyclePeriod,
  };
  for (const name of Object.keys(canonicalTimes)) {
    canonicalTimes[name] = name === 'cycleClosure' ? cyclePeriod
      : THREE.MathUtils.euclideanModulo(canonicalTimes[name] - releaseTime, cyclePeriod);
  }
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const guideContactPoints = [upperGuideY, lowerGuideY].map((y) =>
    new THREE.Vector3(rackCenterX, y, rackPlaneZ));
  const contacts = {
    gearRackPitchContact: {
      activeGearToothIndex: null,
      activeRackGapIndex: null,
      contactPoint: null,
      fixedAxisMember: pinion,
      meshPhaseError: null,
      movingRackMember: rack,
      surfaceVelocityError: null,
      toothlessClearancePitches: 0,
      type: 'intermittent-mutilated-pinion-to-vertical-rack-mesh',
    },
    rackInOpenGuides: {
      axis: new THREE.Vector3(0, 1, 0),
      fixedMembers: guideAssemblies.map(({ guide }) => guide),
      movingMember: rack,
      points: guideContactPoints,
      type: 'vertical-prismatic-rack-rod-in-two-C-shaped-guides',
    },
    stampAtLowerStop: {
      engaged: false,
      impactEnergy: impactKineticEnergy,
      impactVelocity,
      normal: new THREE.Vector3(0, 1, 0),
      point: impactPoint.clone(),
      restitution: 0,
      timeSinceImpact: null,
      type: 'perfectly-inelastic-percussive-stamp-impact-on-workpiece-and-anvil',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    pinion.rotation.z = state.driverAngle;
    pinion.userData.angularVelocity = state.driverAngularVelocity;
    rack.position.y = state.rackDisplacement;
    rackPitchContactAnchor.position.y = wheelCenter.y
      - state.rackDisplacement;
    const contactRelativeToPinion = new THREE.Vector3(
      gearContactPoint.x - wheelCenter.x,
      gearContactPoint.y - wheelCenter.y,
      jointPlaneZ - gearPlaneZ,
    ).applyAxisAngle(
      new THREE.Vector3(0, 0, 1),
      -state.driverAngle,
    );
    pinionPitchContactAnchor.position.copy(contactRelativeToPinion);
    rack.userData.velocity = new THREE.Vector3(
      0,
      state.rackVelocity,
      0,
    );
    rack.userData.acceleration = new THREE.Vector3(
      0,
      state.rackAcceleration,
      0,
    );
    contactMarker.visible = state.gearEngaged;
    impactHalo.visible = state.lowerStopEngaged;
    contacts.gearRackPitchContact.activeGearToothIndex =
      state.activeGearToothIndex;
    contacts.gearRackPitchContact.activeRackGapIndex =
      state.activeRackGapIndex;
    contacts.gearRackPitchContact.contactPoint = state.gearEngaged
      ? gearContactPoint.clone()
      : null;
    contacts.gearRackPitchContact.meshPhaseError =
      state.meshPhaseError;
    contacts.gearRackPitchContact.surfaceVelocityError =
      state.surfaceVelocityError;
    contacts.gearRackPitchContact.toothlessClearancePitches =
      state.toothlessClearancePitches;
    contacts.stampAtLowerStop.engaged = state.lowerStopEngaged;
    contacts.stampAtLowerStop.timeSinceImpact = state.timeSinceImpact;
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    // Catalog archetype identifier (src/data/movements.json); the sector now
    // carries Brown's eight teeth.
    'gravity-drop-stamp-with-six-tooth-mutilated-pinion';
  root.userData.blocks = {
    anvil,
    base,
    bearingBridge,
    blankSectorIndicator,
    contactMarker,
    dieFace,
    fixedFrame,
    gearBody,
    gearRootOutline,
    gearTeeth,
    gearToothFaceLines,
    guideAssemblies,
    impactHalo,
    inputShaft,
    lowerBridge,
    lowerCollar,
    pinion,
    pinionHub,
    pinionIndicator,
    pinionPitchContactAnchor,
    rack,
    rackBar,
    rackTeeth,
    rackToothFaceLines,
    rackPitchContactAnchor,
    rackTravelIndicator,
    rearPost,
    shaftBearing,
    stampDie,
    stampFaceAnchor,
    topBridge,
    topRodCap,
    workpiece,
  };
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.0, -4.45, -0.92),
    new THREE.Vector3(3.04, 7.32, 1.03),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one continuously rotating horizontal pinion shaft',
    mechanism: 1,
    output:
      'one rack, rod, and stamp translating vertically in two fixed guides',
  };
  root.userData.dynamics = {
    ballisticApexPhase,
    ballisticApexTimeAfterRelease,
    ballisticTimeToImpact,
    dwellFraction,
    dwellTime,
    fallingMass,
    gravity,
    impactKineticEnergy,
    impactPhase,
    impactTime,
    impactVelocity,
    maximumRackDisplacement,
    releaseMechanicalEnergy,
    releaseTime,
    restitution: 0,
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    anvilTopY,
    cyclePeriod,
    cyclesPerMinute,
    engagementFraction,
    firstRackToothIndex,
    fullTurn,
    gearBaseAngle,
    gearContactPoint: gearContactPoint.clone(),
    gearDepth,
    gearOuterRadius,
    gearPlaneZ,
    gearRootRadius,
    impactPoint: impactPoint.clone(),
    installedToothIndices,
    initialCyclePhase,
    jointPlaneZ,
    lastRackToothIndex,
    lowerGuideY,
    meshAddendum,
    missingToothCount,
    pitchLineX,
    pitchRadius,
    rackBarBottomY,
    rackBarLength,
    rackBarTopY,
    rackBarWidth,
    rackCenterX,
    rackDepth,
    rackLiftVelocity,
    rackPlaneZ,
    rackStroke,
    rackToothBaseY,
    rackToothPitch,
    rackToothRootX,
    rackToothThickness,
    rackToothTipX,
    sectorToothCount,
    stampFaceRestY,
    toothOuterHalfAngle,
    toothPitchAngle,
    toothRootHalfAngle,
    upperGuideY,
    virtualToothCount,
    wheelCenter: wheelCenter.clone(),
    workpieceTopY,
  };
  root.userData.mechanism =
    'continuous-clockwise-horizontal-shaft-carries-one-eight-tooth-mutilated-pinion-which-raises-one-single-sided-vertical-rack-and-heavy-stamp-for-eight-pitches-then-its-ten-position-blank-sector-releases-the-rack-to-coast-rise-fall-under-gravity-impact-the-lower-stop-and-dwell-before-reengagement';
  root.userData.sourceAnimation = {
    available: false,
    officialCanvasModelPresent: false,
    pageMarksAnimationUnavailable: true,
    presentationTiming: {
      cyclesPerMinute,
      durationSeconds: cyclePeriod,
      sourcePrescribed: false,
    },
    reconstruction: {
      dynamics:
        'constant pitch-line lift, velocity-continuous release, exact uniform-gravity free flight, zero-restitution lower-stop impact, then dwell',
      installedToothCount: sectorToothCount,
      missingToothCount,
      virtualToothCount,
    },
    referenceScope:
      'engraving topology, eight visible sector teeth, ten-position blank arc, clockwise lift direction, single-sided rack, two rack guides, long rod, and heavy stamp head',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate351: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'eight consecutive teeth on an eighteen-position pinion lift a single-sided vertical rack; its remaining ten-position blank sector releases the guided rack and stamp',
      measurementUncertaintyPixels: 7,
      rasterGearCenter: new THREE.Vector2(305, 216),
      rasterGearOuterRadius: 70,
      rasterLowerGuideCenter: new THREE.Vector2(205, 423),
      rasterPitchContact: new THREE.Vector2(244, 216),
      rasterRackCenterX: 222,
      rasterStampFaceY: 514,
      rasterUpperGuideCenter: new THREE.Vector2(205, 60),
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
  root.userData.stateAtUnshiftedTime = stateAtUnshiftedTime;
  root.userData.transmission = {
    blankSector:
      'four missing tooth positions provide free-flight and lower-stop dwell before the sector returns',
    engagedVelocityConstraint:
      'rackVelocity = -driverAngularVelocity * pitchRadius',
    lift:
      'eight installed pinion teeth raise the rack exactly eight rack pitches per shaft revolution',
    meshPhaseConstraint:
      'gearContactCoordinate + rackContactCoordinate = -0.5 while engaged',
  };

  update(0);
  markShadows(root);
  gearToothFaceLines.forEach((line) => {
    line.castShadow = false;
    line.receiveShadow = false;
  });
  rackToothFaceLines.forEach((line) => {
    line.castShadow = false;
    line.receiveShadow = false;
  });
  return {
    cameraDirection: new THREE.Vector3(6.7, 4.2, 14.8),
    root,
    update,
  };
}

// Signed clearance between two convex-or-simple polygons ([x, y] rings):
// the least vertex-to-boundary distance in both directions, negative when
// any vertex lies inside the other outline.
function ringSignedDistance(point, ring) {
  let best = Infinity;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [ax, ay] = ring[j];
    const [bx, by] = ring[i];
    if ((by > point[1]) !== (ay > point[1])
      && point[0] < (ax - bx) * (point[1] - by) / (ay - by) + bx) inside = !inside;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 0
      ? Math.min(1, Math.max(0, ((point[0] - ax) * dx + (point[1] - ay) * dy) / lengthSquared))
      : 0;
    best = Math.min(best, Math.hypot(point[0] - ax - t * dx, point[1] - ay - t * dy));
  }
  return inside ? -best : best;
}

// The analytic lift is exact contact, but after release the imposed
// ballistic path passed through the still-withdrawing final tooth, and the
// next tooth tip entered the resting rack early. After release the rack is
// stepped under gravity and projected to the nearest height clear of every
// finite tooth outline (an inelastic contact), so the withdrawing tooth keeps
// lifting it until the tooth tip leaves; the free fall then continues
// ballistically from that later, higher release. At pickup the entering
// tooth lifts the resting rack to the least clear height.
function carryRackOnFiniteTeeth(model) {
  const { root } = model;
  const d = root.userData;
  const b = d.blocks;
  const g = d.geometry;
  const clearance = 0.0005;
  const gravity = d.dynamics.gravity;
  const period = g.cyclePeriod;
  const toRing = (ring, angle, dx = 0, dy = 0) => ring.slice(0, -1).map(([x, y]) => [
    x * Math.cos(angle) - y * Math.sin(angle) + dx,
    x * Math.sin(angle) + y * Math.cos(angle) + dy,
  ]);
  // The corrected tooth wedges reach the pinion centre and fill the shaft
  // passage; start them just inside the root disk instead.
  const toothPolygons = b.gearTeeth[0].geometry.userData.plate.polygons;
  const rootRadius = d.stampTripParts.mesh.rootRadius;
  const core = Array.from({ length: 96 }, (_, k) => [
    (rootRadius - 0.03) * Math.cos(k * Math.PI / 48),
    (rootRadius - 0.03) * Math.sin(k * Math.PI / 48),
  ]);
  const trimmed = plate(
    polygonClipping.difference(toothPolygons, [[[...core, core[0]]]]),
    -g.gearDepth / 2,
    g.gearDepth / 2,
  );
  const sharedToothGeometry = b.gearTeeth[0].geometry;
  for (const tooth of b.gearTeeth) tooth.geometry = trimmed;
  sharedToothGeometry.dispose();
  const pinionTeeth = b.gearTeeth.map((tooth) => {
    const ring = toRing(tooth.geometry.userData.plate.polygons[0][0], tooth.rotation.z);
    const centre = ring.reduce((sum, [x, y]) => [sum[0] + x / ring.length, sum[1] + y / ring.length], [0, 0]);
    return { centreAngle: Math.atan2(centre[1], centre[0]), ring };
  });
  // rackToothGeometry is rotated -90 degrees about z after extrusion.
  const rackTeeth = b.rackTeeth.map((tooth) => {
    const ring = toRing(
      tooth.geometry.userData.plate.polygons[0][0], -Math.PI / 2,
      tooth.position.x + b.rack.position.x, tooth.position.y,
    );
    ring.minY = Math.min(...ring.map((p) => p[1]));
    ring.maxY = Math.max(...ring.map((p) => p[1]));
    return ring;
  });
  const pinionCentre = [b.pinion.position.x, b.pinion.position.y];
  const tipReach = g.pitchRadius + 0.3;
  const ringGap = (from, to) => {
    let best = Infinity;
    for (const point of from) best = Math.min(best, ringSignedDistance(point, to));
    return best;
  };
  const clearanceAt = (driverAngle, displacement) => {
    let best = 1;
    for (const tooth of pinionTeeth) {
      // Only teeth facing the rack side of the pinion can reach the rack.
      const facing = Math.cos(tooth.centreAngle + driverAngle);
      if (facing > -0.5) continue;
      const world = toRing(tooth.ring, driverAngle, pinionCentre[0], pinionCentre[1]);
      const minY = Math.min(...world.map((p) => p[1])) - 0.05;
      const maxY = Math.max(...world.map((p) => p[1])) + 0.05;
      for (const rackRing of rackTeeth) {
        const low = rackRing.minY + displacement;
        const high = rackRing.maxY + displacement;
        if (high < minY || low > maxY) continue;
        const moved = rackRing.map(([x, yy]) => [x, yy + displacement]);
        best = Math.min(best, ringGap(world, moved), ringGap(moved, world));
      }
    }
    return best;
  };
  void tipReach;
  const nearestClear = (driverAngle, displacement, directions = [1, -1]) => {
    if (clearanceAt(driverAngle, displacement) >= clearance) return displacement;
    const step = 0.0005;
    for (let k = 1; k <= 2000; k += 1) {
      for (const direction of directions) {
        const value = displacement + direction * step * k;
        if (clearanceAt(driverAngle, value) < clearance) continue;
        let low = value - direction * step;
        let high = value;
        for (let iteration = 0; iteration < 24; iteration += 1) {
          const middle = (low + high) / 2;
          if (clearanceAt(driverAngle, middle) >= clearance) high = middle;
          else low = middle;
        }
        return high;
      }
    }
    throw new Error('351: rack cannot clear the pinion');
  };

  const analyticStateAtTime = d.stateAtTime;
  // With the plate's fine pitch the entering tooth sweeps across about two
  // rack pitches before the pitch point, so a stamp resting at the lift datum
  // would sit in its path. The workpiece and anvil sit a quarter unit lower:
  // the entering tooth's tip then meets the next rack tooth from below and
  // picks the stamp up continuously into the pitch-line lift.
  const restDisplacement = -0.25;
  for (const fixedPart of [b.anvil, b.workpiece]) fixedPart.position.y += restDisplacement;
  // Step the release window (shifted time 0 is the analytic release).
  const dt = 0.002;
  const releaseTable = [];
  let y = analyticStateAtTime(0).rackDisplacement;
  let v = analyticStateAtTime(0).rackVelocity;
  let time = 0;
  releaseTable.push({ carried: false, time, v, y });
  for (;;) {
    time += dt;
    const angle = analyticStateAtTime(time).driverAngle;
    let candidateV = v - gravity * dt;
    let candidate = y + candidateV * dt;
    if (candidate < restDisplacement) {
      candidate = restDisplacement;
      candidateV = 0;
    }
    const projected = nearestClear(angle, candidate);
    const carried = projected !== candidate;
    if (carried) candidateV = (projected - y) / dt;
    candidate = projected;
    y = candidate;
    v = candidateV;
    releaseTable.push({ carried, time, v, y });
    if (!carried && v < 0 && clearanceAt(angle, y) > 0.05) break;
    if (time > period * 0.4) throw new Error('351: rack never leaves the final tooth');
  }
  const freeStart = releaseTable.at(-1);
  const fallTime = (freeStart.v + Math.sqrt(freeStart.v ** 2
    + 2 * gravity * (freeStart.y - restDisplacement))) / gravity;
  const impactTime = freeStart.time + fallTime;
  const impactVelocity = freeStart.v - gravity * fallTime;
  if (impactTime > period * (1 - g.engagementFraction) * 0.8) throw new Error('351: carried rack lands too late');

  const stateAtTime = (rawTime) => {
    const state = analyticStateAtTime(rawTime);
    const t = THREE.MathUtils.euclideanModulo(rawTime, period);
    let displacement;
    let velocity;
    let stage;
    let freeFlight = false;
    let lowerStopEngaged = false;
    let carriedByTooth = false;
    if (t < freeStart.time) {
      const position = t / dt;
      const index = Math.min(Math.floor(position), releaseTable.length - 2);
      const f = position - index;
      const a = releaseTable[index];
      const c = releaseTable[index + 1];
      displacement = a.y + (c.y - a.y) * f;
      velocity = (c.y - a.y) / dt;
      carriedByTooth = a.carried || c.carried;
      freeFlight = !carriedByTooth;
      stage = carriedByTooth
        ? 'released-rack-follows-withdrawing-final-tooth'
        : velocity > 0
          ? 'released-stamp-coasts-upward-under-gravity'
          : 'released-stamp-falls-ballistically';
    } else if (t < impactTime) {
      const tau = t - freeStart.time;
      displacement = freeStart.y + freeStart.v * tau - 0.5 * gravity * tau ** 2;
      velocity = freeStart.v - gravity * tau;
      freeFlight = true;
      stage = velocity > 0
        ? 'released-stamp-coasts-upward-under-gravity'
        : 'released-stamp-falls-ballistically';
    } else {
      // Rest and the analytic lift, nudged up by an entering tooth tip.
      const base = state.gearEngaged ? state.rackDisplacement : restDisplacement;
      displacement = nearestClear(state.driverAngle, base, [1]);
      carriedByTooth = displacement !== base && !state.gearEngaged;
      velocity = state.gearEngaged ? state.rackVelocity : 0;
      lowerStopEngaged = !state.gearEngaged && displacement === restDisplacement;
      stage = state.gearEngaged
        ? state.stage
        : carriedByTooth
          ? 'entering-tooth-lifts-resting-rack'
          : 'stamp-rests-on-lower-impact-stop-during-blank-sector';
    }
    return {
      ...state,
      anvilClearance: displacement,
      carriedByTooth,
      freeFlight,
      lowerStopEngaged,
      rackDisplacement: displacement,
      rackVelocity: velocity,
      stage,
      stampFaceY: state.stampFaceY - state.rackDisplacement + displacement,
    };
  };
  d.stateAtTime = stateAtTime;
  d.analyticStateAtTime = analyticStateAtTime;
  const analyticUpdate = model.update;
  model.update = (updateTime) => {
    analyticUpdate(updateTime);
    const state = stateAtTime(updateTime);
    b.rack.position.y = state.rackDisplacement;
    b.rackPitchContactAnchor.position.y = b.pinion.position.y - state.rackDisplacement;
    // Publish the carried stop state: an entering tooth lifts the rack off
    // the lowered stop before the analytic pickup.
    d.contacts.stampAtLowerStop.engaged = state.lowerStopEngaged;
    d.kinematics = state;
  };
  model.update(0);
  // Full carried travel: the higher apex and the lowered rest.
  d.cameraFitBounds.min.y -= 0.40;
  d.cameraFitBounds.max.y += 0.40;
  d.reconstructionNote = 'Eight compatible involute teeth lift a straight rack. After release the rack is stepped under gravity and held to the nearest height clear of the finite teeth, so it follows the withdrawing final tooth before falling from that later release; the entering tooth lifts the resting rack at pickup. This inelastic kinematic projection is not solved contact dynamics: rebound, tooth elasticity and impact forces are not solved. A longer lower rod keeps the head below the lower guide at the carried apex.';
  d.stampCarriedContact = {
    carriedImpactTime: impactTime,
    carriedImpactVelocity: impactVelocity,
    clearance,
    clearanceAt,
    freeFallStartTime: freeStart.time,
    restDisplacement,
  };
}

// Brown draws a broad rod (about three-quarters of the pinion's pitch radius)
// between two broad collars, the rack teeth running only from just below the
// pinion up to the top collar, and the rod continuing above that collar off
// the plate. At the raised pose each collar sits about three pitch radii from
// the pinion axis, and the six-sided head below the lower collar is about one
// pitch radius tall, flat-topped and widest a third of the way down. The rod
// is widened away from its teeth, the collars broadened, the head reshaped
// and recentred, the unused rack teeth hidden and the rod ended a short stub
// above the top collar. The two C guides move below the pinion so the rod
// stays in both at rest and at full lift; the plate does not draw them (nor
// the anvil or workpiece) and source presentation removes them.
function matchBrownStampProportions(model) {
  const d = model.root.userData, b = d.blocks, g = d.geometry;
  const rodWidth = 0.95;
  const right = b.rackBar.geometry.parameters.width / 2 + b.rackBar.position.x;
  const left = right - rodWidth;
  const centerX = (left + right) / 2;
  const collarWidth = 2.35;
  const topCollarHeight = 0.64;
  // Brown's top collar overhangs the rod on the pinion side, so it must stay
  // above the pinion's tip circle even at the stamp's lowered rest; the rack
  // teeth (all in mesh phase) run on up to it as he draws them.
  const collarRight = centerX + collarWidth / 2;
  const tipRadius = d.stampTripParts.mesh.tipRadius;
  const pinionTopAtCollar = g.wheelCenter.y
    + Math.sqrt(Math.max(0, tipRadius ** 2 - (g.wheelCenter.x - collarRight) ** 2));
  const restDisplacement = d.stampCarriedContact.restDisplacement;
  const topCollarBottom = pinionTopAtCollar - restDisplacement + 0.06;
  const workingTeeth = b.rackTeeth.filter(tooth => tooth.userData.index >= -g.sectorToothCount
    && tooth.position.y + g.rackToothPitch / 2 < topCollarBottom - 0.02);
  for (const tooth of b.rackTeeth) tooth.visible = workingTeeth.includes(tooth);
  const rodTop = topCollarBottom + topCollarHeight + 0.55;
  const rodBottom = g.rackBarBottomY;
  b.rackBar.geometry.dispose();
  b.rackBar.geometry = new THREE.BoxGeometry(rodWidth, rodTop - rodBottom, g.rackDepth * 0.72);
  b.rackBar.position.set(centerX, (rodTop + rodBottom) / 2, b.rackBar.position.z);
  b.topRodCap.geometry.dispose();
  b.topRodCap.geometry = new THREE.BoxGeometry(collarWidth, topCollarHeight, 0.51);
  b.topRodCap.position.set(centerX, topCollarBottom + topCollarHeight / 2, b.topRodCap.position.z);
  b.lowerCollar.geometry.dispose();
  b.lowerCollar.geometry = new THREE.BoxGeometry(collarWidth, 0.72, 0.68);
  b.lowerCollar.position.x = centerX;
  b.lowerCollar.position.y -= 0.11;
  // Head: flat top 1.40 wide, widest 1.66 a third down, flat face 1.08 wide.
  const faceY = g.stampFaceRestY;
  const headHeight = 1.30;
  const headShape = new THREE.Shape();
  headShape.moveTo(-0.54, -headHeight / 2);
  headShape.lineTo(0.54, -headHeight / 2);
  headShape.lineTo(0.83, 0.22);
  headShape.lineTo(0.70, headHeight / 2);
  headShape.lineTo(-0.70, headHeight / 2);
  headShape.lineTo(-0.83, 0.22);
  headShape.closePath();
  b.stampDie.geometry.dispose();
  b.stampDie.geometry = centeredExtrusion(headShape, 0.72);
  b.stampDie.position.set(centerX, faceY + headHeight / 2, b.stampDie.position.z);
  b.dieFace.geometry.dispose();
  b.dieFace.geometry = centeredExtrusion(rectangularShape(1.04, 0.055), 0.74);
  b.dieFace.position.x = centerX;
  // Brown's narrow neck joins the lower collar to the head.
  const collarBottom = b.lowerCollar.position.y - 0.36;
  const headTop = faceY + headHeight;
  const neck = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, collarBottom - headTop + 0.02, 0.44),
    b.rackBar.material,
  );
  neck.position.set(centerX, (collarBottom + headTop) / 2, 0);
  neck.userData.role = 'narrow-neck-between-lower-collar-and-stamp-head';
  b.rack.add(neck);
  b.stampNeck = neck;
  // The shaft ends just proud of the pinion hub, as Brown's boss does,
  // instead of standing far out in front of the face.
  const shaftBack = b.inputShaft.position.z - 0.74;
  const shaftFront = g.gearPlaneZ + 0.36 + 0.06;
  b.inputShaft.geometry.dispose();
  b.inputShaft.geometry = new THREE.CylinderGeometry(0.105, 0.105, shaftFront - shaftBack, 28);
  b.inputShaft.position.z = (shaftFront + shaftBack) / 2;
  const guideYs = [-0.95, -2.36];
  b.guideAssemblies.forEach(({ guide, frontLip, rearLip, leftJaw }, index) => {
    guide.position.y = guideYs[index];
    leftJaw.position.x = left - 0.02 - 0.09;
    for (const lip of [frontLip, rearLip]) {
      lip.geometry.dispose();
      lip.geometry = new THREE.BoxGeometry(right - left + 0.18, 0.34, 0.12);
      lip.position.x = (left - 0.20 + right - 0.02) / 2;
    }
  });
  // The undrawn anvil is not needed: the thin workpiece is the lower stop.
  b.anvil.visible = false;
  g.brownRodWidth = rodWidth;
  g.brownRodTopLocalY = rodTop;
  // Frame the swept silhouette of every visible part over the cycle.
  const bounds = new THREE.Box3();
  const period = g.cyclePeriod;
  for (let i = 0; i <= 256; i += 1) {
    model.update(period * i / 256);
    model.root.updateMatrixWorld(true);
    model.root.traverseVisible((object) => {
      if (object.isMesh) bounds.expandByObject(object);
    });
  }
  d.sweptBounds = bounds.clone();
  d.cameraFitBounds = bounds.clone().expandByVector(new THREE.Vector3(0.05, 0.05, 0.05));
  model.update(0);
}

export function createAuthoredStampMovement(movement) {
  if (movement.id !== 351) return null;
  const model = gravityDropStamp(movement);
  correctStampParts(model);
  carryRackOnFiniteTeeth(model);
  matchBrownStampProportions(model);
  markShadows(model.root);
  return model;
}
