import {correctSlottedGuide,finishPistonGuides} from './piston-guide-329-331-parts.js';
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

function cylinderAlongZ(radius, depth, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevelSize = 0.01) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevelSize > 0,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 36,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
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

function horizontalCapsuleHole(leftCenterX, rightCenterX, radius) {
  const hole = new THREE.Path();
  hole.moveTo(leftCenterX, -radius);
  hole.absarc(
    leftCenterX,
    0,
    radius,
    -Math.PI / 2,
    -Math.PI * 1.5,
    true,
  );
  hole.lineTo(rightCenterX, radius);
  hole.absarc(
    rightCenterX,
    0,
    radius,
    Math.PI / 2,
    -Math.PI / 2,
    true,
  );
  hole.lineTo(leftCenterX, -radius);
  hole.closePath();
  return hole;
}

function crossheadYokeShape(scale) {
  const s = (value) => value * scale;
  const shape = new THREE.Shape();

  // The outline follows the moving blue element in the official canvas.
  // The two downward returns are the shoes which embrace the D pillars;
  // the capsule removed below is the actual working slot, not a face mark.
  shape.moveTo(s(-6.50), s(2.00));
  shape.lineTo(s(-5.50), s(2.00));
  shape.quadraticCurveTo(s(-4.85), s(2.25), s(-3.75), s(2.25));
  shape.lineTo(s(3.75), s(2.25));
  shape.quadraticCurveTo(s(4.85), s(2.25), s(5.50), s(2.00));
  shape.lineTo(s(6.50), s(2.00));
  shape.lineTo(s(6.50), s(-4.00));
  shape.lineTo(s(5.50), s(-4.00));
  shape.lineTo(s(5.50), s(-2.58));
  shape.quadraticCurveTo(s(5.00), s(-2.25), s(4.00), s(-2.25));
  shape.lineTo(s(-4.00), s(-2.25));
  shape.quadraticCurveTo(s(-5.00), s(-2.25), s(-5.50), s(-2.58));
  shape.lineTo(s(-5.50), s(-4.00));
  shape.lineTo(s(-6.50), s(-4.00));
  shape.closePath();
  shape.holes.push(horizontalCapsuleHole(
    s(-4),
    s(4),
    s(1.25),
  ));
  return shape;
}

// Brown draws the crossbeam and its pediment as one piece: no line divides
// them, and the cloud-shaped hand hole dips below the beam's top edge. The
// crown is therefore one extrusion: the beam (source y 7..8), the pediment
// rising from x +-5.7 to a rounded apex near y 10.6, and the hand hole.
function crownShape(scale) {
  const s = (value) => value * scale;
  const shape = new THREE.Shape();
  shape.moveTo(s(-8), s(7));
  shape.lineTo(s(8), s(7));
  shape.lineTo(s(8), s(8));
  shape.lineTo(s(5.7), s(8));
  shape.lineTo(s(1.6), s(10.158));
  shape.quadraticCurveTo(s(0), s(11), s(-1.6), s(10.158));
  shape.lineTo(s(-5.7), s(8));
  shape.lineTo(s(-8), s(8));
  shape.closePath();

  // The hand hole: flat bottom, rounded lower corners, two low shoulders
  // and a central dome, as engraved.
  const hole = new THREE.Path();
  hole.moveTo(s(-2.45), s(7.45));
  hole.lineTo(s(2.45), s(7.45));
  hole.quadraticCurveTo(s(2.95), s(7.45), s(2.95), s(7.95));
  hole.bezierCurveTo(s(2.95), s(8.45), s(2.75), s(8.62), s(2.35), s(8.62));
  hole.bezierCurveTo(s(2.0), s(8.62), s(1.85), s(8.72), s(1.7), s(8.85));
  hole.bezierCurveTo(s(1.25), s(9.5), s(-1.25), s(9.5), s(-1.7), s(8.85));
  hole.bezierCurveTo(s(-1.85), s(8.72), s(-2.0), s(8.62), s(-2.35), s(8.62));
  hole.bezierCurveTo(s(-2.75), s(8.62), s(-2.95), s(8.45), s(-2.95), s(7.95));
  hole.quadraticCurveTo(s(-2.95), s(7.45), s(-2.45), s(7.45));
  shape.holes.push(hole);
  return shape;
}

function taperedCrankArmShape(length, hubRadius, journalRadius) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -hubRadius);
  shape.quadraticCurveTo(length * 0.46, -hubRadius * 0.84,
    length - journalRadius * 0.42, -journalRadius * 0.64);
  shape.absarc(
    length,
    0,
    journalRadius,
    -Math.PI / 2,
    Math.PI / 2,
    false,
  );
  shape.quadraticCurveTo(length * 0.46, hubRadius * 0.84,
    0, hubRadius);
  shape.absarc(0, 0, hubRadius, Math.PI / 2, Math.PI * 1.5, false);
  shape.closePath();
  return shape;
}

function makeFlywheelCrank({
  crankArmDepth,
  crankJournalRadius,
  crankPlaneZ,
  crankRadius,
  darkMaterial,
  driverMaterial,
  flywheelDepth,
  flywheelInnerRadius,
  flywheelOuterRadius,
  flywheelPlaneZ,
  hubOuterRadius,
  hubShaftRadius,
  scale,
  slotPlaneZ,
  whiteMaterial,
}) {
  const rotor = new THREE.Group();
  rotor.userData.axis = Z_AXIS.clone();
  rotor.userData.role =
    'one-rigid-six-spoke-flywheel-crank-and-wrist-journal';

  const rim = new THREE.Mesh(
    annulusGeometry(flywheelOuterRadius, flywheelInnerRadius, flywheelDepth),
    driverMaterial,
  );
  rim.position.z = flywheelPlaneZ;
  rim.userData.role = 'official-10.25-to-12.25-unit-flywheel-rim';

  const spokeInnerRadius = hubOuterRadius * 0.90;
  const spokeLength = flywheelInnerRadius - spokeInnerRadius + 0.05;
  const spokeCenterRadius = (flywheelInnerRadius + spokeInnerRadius) / 2;
  const spokes = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = index * FULL_TURN / 6;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(
        spokeLength,
        1.02 * scale,
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
    spoke.userData.role = `flywheel-rigid-spoke-${index + 1}-of-6`;
    spokes.push(spoke);
  }

  const hub = cylinderAlongZ(
    hubOuterRadius,
    flywheelDepth * 1.30,
    driverMaterial,
    48,
  );
  hub.position.z = flywheelPlaneZ;
  hub.userData.role = 'flywheel-hub-rigid-with-crankshaft';
  const hubBore = cylinderAlongZ(
    hubShaftRadius,
    flywheelDepth * 1.38,
    darkMaterial,
    40,
  );
  hubBore.position.z = flywheelPlaneZ - 0.004;
  hubBore.userData.role = 'visible-crankshaft-through-flywheel-hub';

  const crankArm = new THREE.Mesh(
    centeredExtrusion(
      taperedCrankArmShape(
        crankRadius,
        0.76 * scale,
        crankJournalRadius,
      ),
      crankArmDepth,
      0.008,
    ),
    driverMaterial,
  );
  crankArm.position.z = crankPlaneZ;
  crankArm.userData.role = 'official-3.75-unit-rigid-crank-arm';

  const wristJournal = cylinderAlongZ(
    crankJournalRadius,
    slotPlaneZ - crankPlaneZ + crankArmDepth * 1.05,
    driverMaterial,
    48,
  );
  wristJournal.position.set(
    crankRadius,
    0,
    (slotPlaneZ + crankPlaneZ) / 2,
  );
  wristJournal.userData.axis = Z_AXIS.clone();
  wristJournal.userData.radius = crankJournalRadius;
  wristJournal.userData.role =
    '1.25-unit-crank-wrist-journal-working-in-crosshead-slot-A';

  const journalFace = cylinderAlongZ(
    crankJournalRadius * 0.70,
    0.035,
    whiteMaterial,
    40,
  );
  journalFace.position.set(crankRadius, 0, slotPlaneZ + 0.145);
  journalFace.userData.role = 'white-wrist-journal-rotation-index-disk';
  const journalIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      crankJournalRadius * 0.72,
      0.045,
      0.040,
    ),
    darkMaterial,
  );
  journalIndex.position.set(
    crankRadius + crankJournalRadius * 0.32,
    0,
    slotPlaneZ + 0.170,
  );
  journalIndex.userData.role = 'wrist-journal-radial-spin-index';

  const flywheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      (flywheelOuterRadius - flywheelInnerRadius) * 0.72,
      0.11,
      0.045,
    ),
    whiteMaterial,
  );
  flywheelIndex.position.set(
    (flywheelOuterRadius + flywheelInnerRadius) / 2,
    0,
    flywheelPlaneZ + flywheelDepth / 2 + 0.026,
  );
  flywheelIndex.userData.role = 'white-index-rigid-on-flywheel-rim';

  const crankCenterAnchor = new THREE.Object3D();
  crankCenterAnchor.position.z = slotPlaneZ;
  crankCenterAnchor.userData.role = 'analytic-fixed-crankshaft-center';
  const crankPinAnchor = new THREE.Object3D();
  crankPinAnchor.position.set(crankRadius, 0, slotPlaneZ);
  crankPinAnchor.userData.role = 'analytic-crank-wrist-journal-center';

  rotor.add(
    rim,
    ...spokes,
    hub,
    hubBore,
    crankArm,
    wristJournal,
    journalFace,
    journalIndex,
    flywheelIndex,
    crankCenterAnchor,
    crankPinAnchor,
  );
  return {
    crankArm,
    crankCenterAnchor,
    crankPinAnchor,
    flywheelIndex,
    hub,
    hubBore,
    journalFace,
    journalIndex,
    rim,
    rotor,
    spokes,
    wristJournal,
  };
}

function makePillarGuideShoe({
  frameBackZ,
  frameFrontZ,
  guideContactX,
  material,
  scale,
  side,
}) {
  const shoe = new THREE.Group();
  const sideName = side < 0 ? 'left' : 'right';
  const cheekWidth = 1.00 * scale;
  const cheekHeight = 6.00 * scale;
  const cheekDepth = 0.11;
  const outsideX = guideContactX + side * cheekWidth / 2;

  const frontCheek = new THREE.Mesh(
    new THREE.BoxGeometry(cheekWidth, cheekHeight, cheekDepth),
    material,
  );
  frontCheek.position.set(
    outsideX,
    -1.00 * scale,
    frameFrontZ + cheekDepth / 2 + 0.035,
  );
  frontCheek.userData.role = `${sideName}-front-shoe-cheek-around-pillar-D`;

  const rearCheek = new THREE.Mesh(
    new THREE.BoxGeometry(cheekWidth, cheekHeight, cheekDepth),
    material,
  );
  rearCheek.position.set(
    outsideX,
    -1.00 * scale,
    frameBackZ - cheekDepth / 2 - 0.020,
  );
  rearCheek.userData.role = `${sideName}-rear-shoe-cheek-around-pillar-D`;

  const returnWeb = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.20 * scale,
      cheekHeight,
      frameFrontZ - frameBackZ + cheekDepth * 1.8,
    ),
    material,
  );
  returnWeb.position.set(
    guideContactX + side * (cheekWidth - 0.10 * scale),
    -1.00 * scale,
    (frameFrontZ + frameBackZ) / 2,
  );
  returnWeb.userData.role = `${sideName}-shoe-return-web-outside-pillar-D`;

  const contactLiner = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 5.50 * scale, 0.15),
    material,
  );
  contactLiner.position.set(
    guideContactX,
    -1.00 * scale,
    frameFrontZ + 0.105,
  );
  contactLiner.userData.contactX = guideContactX;
  contactLiner.userData.role =
    `${sideName}-crosshead-working-face-on-pillar-D`;

  shoe.add(frontCheek, rearCheek, returnWeb, contactLiner);
  shoe.userData.contactLiner = contactLiner;
  shoe.userData.contactX = guideContactX;
  shoe.userData.role = `${sideName}-crosshead-guide-shoe-embracing-pillar-D`;
  return shoe;
}

function slottedCrossheadPillarEngine(movement) {
  const root = new THREE.Group();

  // Exact governing dimensions exposed by the official 525 px canvas model.
  // A uniform scale changes presentation size only; every source ratio and
  // contact constraint remains unchanged.
  const sourceScale = 0.24;
  const sourceCrankRadius = 3.75;
  const sourceJournalRadius = 1.25;
  const sourceSlotLeftCenterX = -4;
  const sourceSlotRightCenterX = 4;
  const sourceGuideInnerX = 6;
  const sourceGuideOuterX = 7.5;
  const sourceGuideTopY = 6.4;
  const sourceGuideBottomY = -17;
  const sourceFlywheelInnerRadius = 10.25;
  const sourceFlywheelOuterRadius = 12.25;
  const sourcePistonRodTopOffsetY = -2.75;
  const sourcePistonRodBottomOffsetY = -14.75;
  const sourcePistonHeadTopOffsetY = -14.75;
  const sourcePistonHeadBottomOffsetY = -15.75;
  const sourcePistonHeadHalfWidth = 3.5;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const crankAngularSpeed = FULL_TURN / cyclePeriod;

  const crankRadius = sourceCrankRadius * sourceScale;
  const crankJournalRadius = sourceJournalRadius * sourceScale;
  const slotLeftCenterX = sourceSlotLeftCenterX * sourceScale;
  const slotRightCenterX = sourceSlotRightCenterX * sourceScale;
  const slotHalfHeight = crankJournalRadius;
  const guideInnerX = sourceGuideInnerX * sourceScale;
  const guideOuterX = sourceGuideOuterX * sourceScale;
  const guideTopY = sourceGuideTopY * sourceScale;
  const guideBottomY = sourceGuideBottomY * sourceScale;
  const flywheelInnerRadius = sourceFlywheelInnerRadius * sourceScale;
  const flywheelOuterRadius = sourceFlywheelOuterRadius * sourceScale;
  const pistonRodTopOffsetY = sourcePistonRodTopOffsetY * sourceScale;
  const pistonRodBottomOffsetY = sourcePistonRodBottomOffsetY * sourceScale;
  const pistonHeadTopOffsetY = sourcePistonHeadTopOffsetY * sourceScale;
  const pistonHeadBottomOffsetY = sourcePistonHeadBottomOffsetY * sourceScale;
  const pistonHeadHalfWidth = sourcePistonHeadHalfWidth * sourceScale;
  const outputStroke = 2 * crankRadius;
  const slotEndCenterMargin = (sourceSlotRightCenterX - sourceCrankRadius)
    * sourceScale;

  const frameDepth = 0.34;
  const frameCenterZ = -0.02;
  const frameFrontZ = frameCenterZ + frameDepth / 2;
  const frameBackZ = frameCenterZ - frameDepth / 2;
  const flywheelPlaneZ = -0.47;
  const flywheelDepth = 0.18;
  const crankPlaneZ = 0.26;
  const crankArmDepth = 0.17;
  const crossheadPlaneZ = 0.66;
  const crossheadDepth = 0.17;
  const slotPlaneZ = crossheadPlaneZ;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.11,
    roughness: 0.72,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.46,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.62,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-engine-framing-with-two-pillar-guides-D-D';

  // The official animation's guide travel ends at y 6.4, but the pillars
  // themselves run on up into the crossbeam (source y 7..8), seated half
  // its height inside it, as Brown draws their capitals meeting it.
  const pillarTopY = 7.5 * sourceScale;
  const guidePosts = [-1, 1].map((side) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(
        guideOuterX - guideInnerX,
        pillarTopY - guideBottomY,
        frameDepth,
      ),
      frameMaterial,
    );
    post.position.set(
      side * (guideInnerX + guideOuterX) / 2,
      (pillarTopY + guideBottomY) / 2,
      frameCenterZ,
    );
    post.userData.fixed = true;
    post.userData.innerWorkingFaceX = side * guideInnerX;
    post.userData.role =
      `${side < 0 ? 'left' : 'right'}-fixed-pillar-guide-D`;
    return post;
  });

  const guideFaces = [-1, 1].map((side) => {
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(0.026, guideTopY - guideBottomY, 0.11),
      darkMaterial,
    );
    face.position.set(
      side * guideInnerX,
      (guideTopY + guideBottomY) / 2,
      frameFrontZ + 0.015,
    );
    face.userData.fixed = true;
    face.userData.role =
      `${side < 0 ? 'left' : 'right'}-planed-inner-face-of-pillar-D`;
    return face;
  });

  // One crown extrusion (beam and pediment) deep enough to house the
  // pillar tops, which run half-way up into the beam.
  const crownDepth = 0.44;
  const topBeam = new THREE.Mesh(
    new THREE.ExtrudeGeometry(crownShape(sourceScale), {
      bevelEnabled: false,
      curveSegments: 48,
      depth: crownDepth,
    }).translate(0, 0, -crownDepth / 2),
    frameMaterial,
  );
  topBeam.position.z = frameCenterZ;
  topBeam.userData.fixed = true;
  topBeam.userData.role =
    'fixed-crossbeam-and-pediment-with-hand-hole-joining-pillar-guides-D-D';

  const cylinderTop = new THREE.Mesh(
    new THREE.BoxGeometry(3 * sourceScale, 1 * sourceScale, 0.74),
    frameMaterial,
  );
  cylinderTop.position.set(0, -8 * sourceScale, 0.04);
  cylinderTop.userData.fixed = true;
  cylinderTop.userData.role = 'fixed-cylinder-gland-around-moving-piston-rod';
  const cylinderBore = new THREE.Mesh(
    new THREE.BoxGeometry(1.16 * sourceScale, 1.08 * sourceScale, 0.77),
    darkMaterial,
  );
  cylinderBore.position.set(0, -8 * sourceScale, 0.045);
  cylinderBore.userData.fixed = true;
  cylinderBore.userData.role = 'visible-piston-rod-passage-in-cylinder-gland';

  // The crossbase stops 0.02 in front of the flywheel's front face (z -0.38)
  // so the spokes sweep behind it; at the front it still carries the gland
  // neck (z 0.26..1.02) and the legs.
  const crossBaseBackZ = -0.36;
  const crossBaseFrontZ = 0.38;
  const lowerCrossBase = new THREE.Mesh(
    new THREE.BoxGeometry(9 * sourceScale, 1 * sourceScale,
      crossBaseFrontZ - crossBaseBackZ),
    frameMaterial,
  );
  lowerCrossBase.position.set(0, -10.25 * sourceScale,
    (crossBaseFrontZ + crossBaseBackZ) / 2);
  lowerCrossBase.userData.fixed = true;
  lowerCrossBase.userData.role = 'lower-engine-crossbase-from-official-model';

  const lowerLegs = [-1, 1].map((side) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.50 * sourceScale, 6.25 * sourceScale, 0.44),
      frameMaterial,
    );
    leg.position.set(side * 3.75 * sourceScale, -13.875 * sourceScale, -0.08);
    leg.userData.fixed = true;
    leg.userData.role =
      `${side < 0 ? 'left' : 'right'}-lower-engine-standard-leg`;
    return leg;
  });

  const bearingHousing = cylinderAlongZ(
    1.50 * sourceScale,
    0.48,
    frameMaterial,
    48,
  );
  bearingHousing.position.z = -0.06;
  bearingHousing.userData.fixed = true;
  bearingHousing.userData.role = 'fixed-central-crankshaft-bearing-housing';
  const bearingBore = cylinderAlongZ(
    0.75 * sourceScale,
    0.51,
    darkMaterial,
    40,
  );
  bearingBore.position.z = -0.055;
  bearingBore.userData.fixed = true;
  bearingBore.userData.role = 'fixed-bearing-bore-around-live-crankshaft';

  fixedFrame.add(
    ...guidePosts,
    ...guideFaces,
    topBeam,
    cylinderTop,
    cylinderBore,
    lowerCrossBase,
    ...lowerLegs,
    bearingHousing,
    bearingBore,
  );
  root.add(fixedFrame);

  const rotorParts = makeFlywheelCrank({
    crankArmDepth,
    crankJournalRadius,
    crankPlaneZ,
    crankRadius,
    darkMaterial,
    driverMaterial,
    flywheelDepth,
    flywheelInnerRadius,
    flywheelOuterRadius,
    flywheelPlaneZ,
    hubOuterRadius: 1.50 * sourceScale,
    hubShaftRadius: 0.75 * sourceScale,
    scale: sourceScale,
    slotPlaneZ,
    whiteMaterial,
  });
  root.add(rotorParts.rotor);

  const crankshaft = cylinderAlongZ(
    0.72 * sourceScale,
    crankPlaneZ - flywheelPlaneZ + 0.48,
    driverMaterial,
    42,
  );
  crankshaft.position.z = (slotPlaneZ + flywheelPlaneZ) / 2;
  crankshaft.userData.axis = Z_AXIS.clone();
  crankshaft.userData.role = 'live-shaft-through-flywheel-crank-and-bearing';
  rotorParts.rotor.add(crankshaft);

  const crossheadA = new THREE.Group();
  crossheadA.userData.rotationDegreesOfFreedom = 0;
  crossheadA.userData.role =
    'slotted-crosshead-A-translating-between-pillar-guides-D-D';
  crossheadA.userData.translationAxis = Y_AXIS.clone();

  const yokeBody = new THREE.Mesh(
    centeredExtrusion(
      crossheadYokeShape(sourceScale),
      crossheadDepth,
      0.009,
    ),
    drivenMaterial,
  );
  yokeBody.position.z = crossheadPlaneZ;
  yokeBody.userData.realSlot = true;
  yokeBody.userData.role =
    'crosshead-A-solid-body-minus-real-horizontal-journal-slot';

  const leftShoe = makePillarGuideShoe({
    frameBackZ,
    frameFrontZ,
    guideContactX: -guideInnerX,
    material: drivenMaterial,
    scale: sourceScale,
    side: -1,
  });
  const rightShoe = makePillarGuideShoe({
    frameBackZ,
    frameFrontZ,
    guideContactX: guideInnerX,
    material: drivenMaterial,
    scale: sourceScale,
    side: 1,
  });

  const pistonRodLength = pistonRodTopOffsetY - pistonRodBottomOffsetY;
  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(
      1.00 * sourceScale,
      pistonRodLength,
      0.16,
    ),
    drivenMaterial,
  );
  pistonRod.position.set(
    0,
    (pistonRodTopOffsetY + pistonRodBottomOffsetY) / 2,
    crossheadPlaneZ - 0.02,
  );
  pistonRod.userData.role = 'piston-rod-rigid-with-slotted-crosshead-A';

  const pistonHead = new THREE.Mesh(
    new THREE.BoxGeometry(
      pistonHeadHalfWidth * 2,
      pistonHeadTopOffsetY - pistonHeadBottomOffsetY,
      0.46,
    ),
    drivenMaterial,
  );
  pistonHead.position.set(
    0,
    (pistonHeadTopOffsetY + pistonHeadBottomOffsetY) / 2,
    crossheadPlaneZ - 0.11,
  );
  pistonHead.userData.role = 'piston-head-rigid-with-crosshead-output';

  const crossheadIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.052, 0.035),
    whiteMaterial,
  );
  crossheadIndex.position.set(
    0,
    2.25 * sourceScale + 0.025,
    crossheadPlaneZ + 0.115,
  );
  crossheadIndex.userData.role = 'white-index-on-translating-crosshead-A';

  const slotCenterAnchor = new THREE.Object3D();
  slotCenterAnchor.position.z = slotPlaneZ;
  slotCenterAnchor.userData.role = 'analytic-center-of-horizontal-slot-A';
  const pistonCenterAnchor = new THREE.Object3D();
  pistonCenterAnchor.position.set(
    0,
    (pistonHeadTopOffsetY + pistonHeadBottomOffsetY) / 2,
    crossheadPlaneZ,
  );
  pistonCenterAnchor.userData.role = 'analytic-center-of-moving-piston-head';

  crossheadA.add(
    pistonRod,
    pistonHead,
    yokeBody,
    leftShoe,
    rightShoe,
    crossheadIndex,
    slotCenterAnchor,
    pistonCenterAnchor,
  );
  root.add(crossheadA);

  const stateAtCrankTravel = (
    crankTravel,
    resolvedCrankAngularSpeed = crankAngularSpeed,
    crankAngularAcceleration = 0,
  ) => {
    const unwrappedCrankAngle = crankTravel;
    const crankAngle = positiveModulo(unwrappedCrankAngle, FULL_TURN);
    const sine = Math.sin(crankAngle);
    const cosine = Math.cos(crankAngle);
    const crankPin = new THREE.Vector2(
      crankRadius * cosine,
      crankRadius * sine,
    );
    const crankPinVelocity = new THREE.Vector2(
      -crankRadius * sine * resolvedCrankAngularSpeed,
      crankRadius * cosine * resolvedCrankAngularSpeed,
    );
    const crankPinAcceleration = new THREE.Vector2(
      -crankRadius * (
        cosine * resolvedCrankAngularSpeed ** 2
          + sine * crankAngularAcceleration
      ),
      crankRadius * (
        -sine * resolvedCrankAngularSpeed ** 2
          + cosine * crankAngularAcceleration
      ),
    );
    const sliderY = crankPin.y;
    const sliderVelocityY = crankPinVelocity.y;
    const sliderAccelerationY = crankPinAcceleration.y;
    return {
      crankAngle,
      crankAngularAcceleration,
      crankAngularSpeed: resolvedCrankAngularSpeed,
      crankPin,
      crankPinAcceleration,
      crankPinVelocity,
      journalRelativeToSlot: new THREE.Vector2(crankPin.x, 0),
      journalRelativeVelocityX: crankPinVelocity.x,
      pistonCenter: new THREE.Vector2(
        0,
        sliderY + (pistonHeadTopOffsetY + pistonHeadBottomOffsetY) / 2,
      ),
      sliderAccelerationY,
      sliderRotation: 0,
      sliderVelocityY,
      sliderY,
      slotVerticalResidual: crankPin.y - sliderY,
      sourceCrankPin: crankPin.clone().multiplyScalar(1 / sourceScale),
      unwrappedCrankAngle,
    };
  };

  const stateAtTime = (time) => {
    const phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    const state = stateAtCrankTravel(
      crankAngularSpeed * time,
      crankAngularSpeed,
      0,
    );
    state.phase = phase;
    state.time = time;
    return state;
  };

  const canonicalTimes = {
    crankAtRight: 0,
    crankAtTop: cyclePeriod / 4,
    crankAtLeft: cyclePeriod / 2,
    crankAtBottom: cyclePeriod * 3 / 4,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([key, time]) => [key, stateAtTime(time)]),
  );

  const contacts = {
    crankJournalInSlotA: {
      movingMember: rotorParts.rotor,
      slotMember: crossheadA,
      type: 'circular-journal-in-straight-horizontal-slot',
      journalRadius: crankJournalRadius,
      slotHalfHeight,
      diametralClearance: 2 * (slotHalfHeight - crankJournalRadius),
      endCenterMargin: slotEndCenterMargin,
      point: new THREE.Vector3(),
    },
    leftShoeOnPillarD: {
      fixedMember: guidePosts[0],
      movingMember: leftShoe,
      type: 'one-axis-planar-prismatic-contact',
      lateralClearance: 0,
      point: new THREE.Vector3(),
      relativeSlidingSpeed: 0,
    },
    rightShoeOnPillarD: {
      fixedMember: guidePosts[1],
      movingMember: rightShoe,
      type: 'one-axis-planar-prismatic-contact',
      lateralClearance: 0,
      point: new THREE.Vector3(),
      relativeSlidingSpeed: 0,
    },
  };

  const geometry = {
    crankAngularSpeed,
    crankJournalRadius,
    crankRadius,
    crossheadDepth,
    crossheadPlaneZ,
    cyclePeriod,
    flywheelDepth,
    flywheelInnerRadius,
    flywheelOuterRadius,
    flywheelPlaneZ,
    frameBackZ,
    frameFrontZ,
    guideBottomY,
    guideInnerX,
    guideOuterX,
    guideTopY,
    outputStroke,
    pistonHeadBottomOffsetY,
    pistonHeadHalfWidth,
    pistonHeadTopOffsetY,
    pistonRodBottomOffsetY,
    pistonRodTopOffsetY,
    slotEndCenterMargin,
    slotHalfHeight,
    slotLeftCenterX,
    slotPlaneZ,
    slotRightCenterX,
    sourceScale,
  };

  const officialViewMinimum = new THREE.Vector2(-14, -14);
  const officialViewWidth = 28;
  const officialViewHeight = 28;
  const officialCanvasWidth = 525;
  const officialCanvasHeight = 525;
  const modelPointToOfficialAnimationRaster = (point) => {
    const sourceX = point.x / sourceScale;
    const sourceY = point.y / sourceScale;
    return new THREE.Vector2(
      (sourceX - officialViewMinimum.x)
        * officialCanvasWidth / officialViewWidth,
      officialCanvasHeight - (sourceY - officialViewMinimum.y)
        * officialCanvasHeight / officialViewHeight,
    );
  };
  const officialAnimationRasterToModel = (point, z = slotPlaneZ) =>
    new THREE.Vector3(
      (officialViewMinimum.x
        + point.x * officialViewWidth / officialCanvasWidth) * sourceScale,
      (officialViewMinimum.y
        + (officialCanvasHeight - point.y)
          * officialViewHeight / officialCanvasHeight) * sourceScale,
      z,
    );

  const update = (time) => {
    const state = stateAtTime(time);
    rotorParts.rotor.rotation.z = state.crankAngle;
    crossheadA.position.set(0, state.sliderY, 0);
    contacts.crankJournalInSlotA.point.set(
      state.crankPin.x,
      state.crankPin.y,
      slotPlaneZ,
    );
    contacts.crankJournalInSlotA.verticalCenterResidual =
      state.slotVerticalResidual;
    contacts.crankJournalInSlotA.relativeSlidingSpeedX =
      state.journalRelativeVelocityX;
    contacts.leftShoeOnPillarD.point.set(
      -guideInnerX,
      state.sliderY - sourceScale,
      frameFrontZ,
    );
    contacts.leftShoeOnPillarD.relativeSlidingSpeed =
      state.sliderVelocityY;
    contacts.rightShoeOnPillarD.point.set(
      guideInnerX,
      state.sliderY - sourceScale,
      frameFrontZ,
    );
    contacts.rightShoeOnPillarD.relativeSlidingSpeed =
      state.sliderVelocityY;
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    'flywheel-scotch-yoke-crosshead-between-pillar-guides-D';
  root.userData.blocks = {
    bearingBore,
    bearingHousing,
    crankArm: rotorParts.crankArm,
    crankCenterAnchor: rotorParts.crankCenterAnchor,
    crankPinAnchor: rotorParts.crankPinAnchor,
    crankRotor: rotorParts.rotor,
    crankshaft,
    crossheadA,
    crossheadIndex,
    cylinderBore,
    cylinderTop,
    fixedFrame,
    topBeam,
    flywheelHub: rotorParts.hub,
    flywheelIndex: rotorParts.flywheelIndex,
    flywheelRim: rotorParts.rim,
    flywheelSpokes: rotorParts.spokes,
    guideFaces,
    guidePosts,
    journalFace: rotorParts.journalFace,
    journalIndex: rotorParts.journalIndex,
    leftGuideShoe: leftShoe,
    lowerCrossBase,
    lowerLegs,
    pistonCenterAnchor,
    pistonHead,
    pistonRod,
    rightGuideShoe: rightShoe,
    slotCenterAnchor,
    wristJournal: rotorParts.wristJournal,
    yokeBody,
  };
  root.userData.cameraDistanceScale = 1.10;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.12, -4.82, -0.76),
    new THREE.Vector3(3.12, 3.05, 1.03),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    crossheadRotation: 0,
    crossheadTranslationAxes: 1,
    input: 'one continuous flywheel and crankshaft rotation about fixed z',
    mechanism: 1,
    output: 'one vertical translation of crosshead A and the piston',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = pistonHeadBottomOffsetY - crankRadius - 0.04;
  root.userData.mechanism =
    'one-rigid-flywheel-crank-wrist-journal-in-real-slot-A-crosshead-between-fixed-pillar-guides-D-D';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.officialAnimationRasterToModel =
    officialAnimationRasterToModel;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: sourceCyclesPerMinute,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialFunctionChain: ['add_rot', 'add_hidden', 'add_cam_f'],
    officialGeometry: {
      crankRadius: sourceCrankRadius,
      crossheadGuideBottomY: sourceGuideBottomY,
      crossheadGuideInnerX: sourceGuideInnerX,
      crossheadGuideOuterX: sourceGuideOuterX,
      crossheadGuideTopY: sourceGuideTopY,
      flywheelInnerRadius: sourceFlywheelInnerRadius,
      flywheelOuterRadius: sourceFlywheelOuterRadius,
      journalRadius: sourceJournalRadius,
      pistonHeadBottomOffsetY: sourcePistonHeadBottomOffsetY,
      pistonHeadHalfWidth: sourcePistonHeadHalfWidth,
      pistonHeadTopOffsetY: sourcePistonHeadTopOffsetY,
      pistonRodBottomOffsetY: sourcePistonRodBottomOffsetY,
      pistonRodTopOffsetY: sourcePistonRodTopOffsetY,
      slotHalfHeight: sourceJournalRadius,
      slotLeftCenterX: sourceSlotLeftCenterX,
      slotRightCenterX: sourceSlotRightCenterX,
    },
    officialKeyframes: [
      { crankPin: new THREE.Vector2(3.75, 0), phase: 0, sliderY: 0 },
      { crankPin: new THREE.Vector2(0, 3.75), phase: 0.25, sliderY: 3.75 },
      { crankPin: new THREE.Vector2(-3.75, 0), phase: 0.50, sliderY: 0 },
      { crankPin: new THREE.Vector2(0, -3.75), phase: 0.75, sliderY: -3.75 },
      { crankPin: new THREE.Vector2(3.75, 0), phase: 1, sliderY: 0 },
    ],
    officialPageAnimatedTabDisabled: false,
    referenceScope:
      'official flywheel radii, six-spoke crank rotor, 3.75-unit crank, 1.25-unit wrist journal and slot, translating crosshead A, piston, and pillar guides D-D',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate331: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one flywheel crank, one journal sliding in crosshead slot A, and one crosshead translating between two pillar guides D-D',
      measurementUncertaintyPixels: 4,
    },
    officialAnimationView: {
      canvasHeight: officialCanvasHeight,
      canvasWidth: officialCanvasWidth,
      minimum: officialViewMinimum,
      viewHeight: officialViewHeight,
      viewWidth: officialViewWidth,
    },
    officialDescription: movement.description,
    relatedMovements: [93, 279],
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtCrankTravel = stateAtCrankTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    guideConstraint:
      'crosshead A has zero yaw and slides vertically between x = -6 and x = +6 pillar faces',
    input: 'one flywheel and 3.75-unit crank rotating at 15 rpm',
    journalConstraint:
      'the 1.25-unit circular crank-wrist journal exactly fills the 1.25-unit-half-height horizontal slot A',
    output:
      'crosshead A, piston rod, and piston translate together through a 7.5-unit source stroke',
    sliderLaw: 'y_A = r sin(theta)',
  };

  update(0);
  markShadows(root);
  correctSlottedGuide(root);
  finishPistonGuides(root,update);
  return {
    cameraDirection: new THREE.Vector3(.8,.4,15),
    root,
    update,
  };
}

export function createAuthoredSlottedCrossheadEngineMovement(movement) {
  if (movement.id !== 331) return null;
  return slottedCrossheadPillarEngine(movement);
}
