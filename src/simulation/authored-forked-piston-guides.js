import * as THREE from 'three';
import {boredCylinderGeometry,boredJournal,fitPistonGuide} from './piston-guide-parts.js';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
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

function beamBetween3D(start, end, width, depth, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(X_AXIS, delta.clone().normalize());
  return beam;
}

function sideProfilePrism(points, minX, maxX) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(-z, y)));
  return new THREE.ExtrudeGeometry(shape, { bevelEnabled: false, depth: maxX - minX })
    .rotateY(Math.PI / 2).translate(minX, 0, 0);
}

function boredBlockGeometry(halfWidth, bottom, top, boreRadius, depth) {
  const shape = new THREE.Shape([
    new THREE.Vector2(-halfWidth, bottom), new THREE.Vector2(halfWidth, bottom),
    new THREE.Vector2(halfWidth, top), new THREE.Vector2(-halfWidth, top),
  ]);
  const bore = new THREE.Path();
  bore.absarc(0, 0, boreRadius, 0, FULL_TURN, true);
  shape.holes.push(bore);
  return new THREE.ExtrudeGeometry(shape, { bevelEnabled: false, curveSegments: 48, depth })
    .translate(0, 0, -depth / 2);
}

function crankWebGeometry(hubRadius, pinRadius, length, depth) {
  const lean = Math.asin((hubRadius - pinRadius) / length);
  const shape = new THREE.Shape();
  shape.absarc(0, 0, hubRadius, Math.PI / 2 - lean, Math.PI * 3 / 2 + lean, false);
  shape.absarc(length, 0, pinRadius, -Math.PI / 2 + lean, Math.PI / 2 - lean, false);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { bevelEnabled: false, curveSegments: 24, depth })
    .translate(0, 0, -depth / 2);
}

function annulusAlongZ(outerRadius, innerRadius, depth) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(hole);
  return new THREE.ExtrudeGeometry(shape, { bevelEnabled: false, curveSegments: 96, depth })
    .translate(0, 0, -depth / 2);
}

function makeForkedConnectingRod({
  darkMaterial,
  forkHalfSpacing,
  forkStartFraction,
  length,
  pistonRodTopLocalY,
  prongDepth,
  rodMaterial,
}) {
  const rod = new THREE.Group();
  rod.userData.nominalLength = length;
  rod.userData.role =
    'one-rigid-connecting-rod-with-two-depth-separated-lower-prongs';
  const stemEnd = length * forkStartFraction;

  // The rod body is one flat outline in the plate's plane (rod axis u along
  // local x, fork spread w along local z), extruded a constant 0.13 across
  // the swing plane: a single stem, a G1 fillet into a horseshoe arch whose
  // outer and inner edges are concentric semicircles, and two straight
  // prongs. The stem runs into the crank boss and the prongs into the wrist
  // bosses, each just inside the boss faces (no coincident faces) and clear
  // of the bores.
  const bodyThickness = 0.13;
  const stemHalf = 0.08;
  const prongHalf = prongDepth / 2 - 0.005;
  const outerRadius = forkHalfSpacing + prongHalf;
  const innerRadius = forkHalfSpacing - prongHalf;
  // The arch crowns at Brown's junction unless the prolonged piston rod
  // needs the crotch higher: the inner apex stays 0.12 above the rod's top.
  const archCenter = Math.min(stemEnd + outerRadius,
    length - pistonRodTopLocalY - 0.12 + innerRadius);
  const stemTop = 0.14;
  const prongBottom = length - 0.15;
  const filletAngle = 35 * Math.PI / 180;
  const archPoint = (radius, angle) =>
    [archCenter - radius * Math.cos(angle), radius * Math.sin(angle)];
  const filletEnd = archPoint(outerRadius, filletAngle);
  const filletReach = (filletEnd[1] - stemHalf) / Math.cos(filletAngle);
  const filletControl = [filletEnd[0] - filletReach * Math.sin(filletAngle), stemHalf];
  const filletStart = [filletControl[0] - 0.16, stemHalf];
  const quadratic = (p0, c, p1, count) => Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count, v = 1 - t;
    return [v * v * p0[0] + 2 * v * t * c[0] + t * t * p1[0],
      v * v * p0[1] + 2 * v * t * c[1] + t * t * p1[1]];
  });
  const arc = (radius, from, to, count) => Array.from({ length: count + 1 },
    (_, i) => archPoint(radius, from + (to - from) * i / count));
  const half = [
    [stemTop, stemHalf],
    ...quadratic(filletStart, filletControl, filletEnd, 16),
    ...arc(outerRadius, filletAngle, Math.PI / 2, 32).slice(1),
    [prongBottom, outerRadius],
    [prongBottom, innerRadius],
  ];
  const mirror = (points) => points.map(([u, w]) => [u, -w]).reverse();
  const outline = [
    ...half,
    ...arc(innerRadius, Math.PI / 2, -Math.PI / 2, 64),
    ...mirror(half),
  ];
  const body = new THREE.Mesh(
    plate(poly(outline), -bodyThickness / 2, bodyThickness / 2)
      .rotateX(Math.PI / 2),
    rodMaterial,
  );
  body.userData.role = 'one-piece-forked-rod-body-stem-horseshoe-and-prongs';
  body.userData.outline = outline;
  const crankBoss = boredJournal(.20,.114,.20,rodMaterial);
  crankBoss.userData.role = 'forked-rod-upper-crank-eye-boss';
  const crankEye = boredJournal(.18,.114,.02,darkMaterial);
  crankEye.position.z = .11;
  crankEye.userData.role = 'forked-rod-upper-crank-pin-eye';

  const wristEyes = [];
  const wristAnchors = [];
  for (const side of [-1, 1]) {
    const sideName = side < 0 ? 'rear' : 'front';
    const wristBoss = boredJournal(.21,.132,prongDepth,rodMaterial);
    wristBoss.position.set(length, 0, side * forkHalfSpacing);
    wristBoss.userData.role = `${sideName}-fork-wrist-boss`;
    const wristEye = boredJournal(.20,.132,.016,darkMaterial);
    wristEye.position.set(
      length,
      0,
      side * forkHalfSpacing + side * (prongDepth / 2 + .008),
    );
    wristEye.userData.role = `${sideName}-fork-wrist-eye`;
    wristEyes.push(wristBoss, wristEye);
    const wristAnchor = new THREE.Object3D();
    wristAnchor.position.set(length, 0, side * forkHalfSpacing);
    wristAnchor.userData.role = `${sideName}-analytic-fork-wrist-axis`;
    wristAnchors.push(wristAnchor);
  }

  const crankAnchor = new THREE.Object3D();
  crankAnchor.userData.role = 'analytic-forked-rod-crank-eye';
  const centerWristAnchor = new THREE.Object3D();
  centerWristAnchor.position.x = length;
  centerWristAnchor.userData.role =
    'analytic-common-center-of-forked-rod-wrist';
  rod.add(
    body,
    crankBoss,
    crankEye,
    ...wristEyes,
    crankAnchor,
    centerWristAnchor,
    ...wristAnchors,
  );
  return {
    body,
    centerWristAnchor,
    crankAnchor,
    rod,
    wristAnchors,
    wristEyes,
  };
}

function ForkedPistonRodGuide(movement) {
  const root = new THREE.Group();

  // The source page has no canvas animation. These dimensions are an affine
  // reconstruction of the 525 px Brown engraving. The source pose itself is
  // retained exactly: crank center (245,52), crank pin (201,78), piston wrist
  // (207,374), and guide A (207,208).
  const rasterCrankCenter = new THREE.Vector2(245, 52);
  const rasterCrankPin = new THREE.Vector2(201, 78);
  const rasterPistonWrist = new THREE.Vector2(207, 374);
  const rasterGuideCenterA = new THREE.Vector2(207, 208);
  const rasterForkJunction = new THREE.Vector2(205, 164);
  const rasterCylinderAxisPoint = new THREE.Vector2(207, 469);
  const rasterPistonAxisX = 207;
  const crankRadius = 0.82;
  const rasterCrankRadius = rasterCrankCenter.distanceTo(rasterCrankPin);
  const engravingScale = crankRadius / rasterCrankRadius;
  const crankCenterY = 3.15;
  const pistonAxisX = 0;
  const engravingPointToModelFront = (point, z = 0.72) =>
    new THREE.Vector3(
      (point.x - rasterPistonAxisX) * engravingScale,
      crankCenterY - (point.y - rasterCrankCenter.y) * engravingScale,
      z,
    );
  const crankCenter = new THREE.Vector2(
    (rasterCrankCenter.x - rasterPistonAxisX) * engravingScale,
    crankCenterY,
  );
  const sourceCrankPin = engravingPointToModelFront(rasterCrankPin);
  const sourcePistonWrist = engravingPointToModelFront(rasterPistonWrist);
  const initialCrankAngle = Math.atan2(
    sourceCrankPin.y - crankCenter.y,
    sourceCrankPin.x - crankCenter.x,
  );
  const connectingRodLength = rasterCrankPin.distanceTo(
    rasterPistonWrist,
  ) * engravingScale;
  const guideCenterA = engravingPointToModelFront(rasterGuideCenterA);
  const guideY = guideCenterA.y;
  const forkStartFraction = rasterCrankPin.distanceTo(
    rasterForkJunction,
  ) / rasterCrankPin.distanceTo(rasterPistonWrist);

  const demonstrationCyclesPerMinute = 15;
  const cyclePeriod = 60 / demonstrationCyclesPerMinute;
  const crankAngularSpeed = FULL_TURN / cyclePeriod;
  const crankOffset = crankCenter.x - pistonAxisX;
  const nearDeadCenterDistance = connectingRodLength - crankRadius;
  const farDeadCenterDistance = connectingRodLength + crankRadius;
  const nearDeadCenterVertical = Math.sqrt(
    nearDeadCenterDistance ** 2 - crankOffset ** 2,
  );
  const farDeadCenterVertical = Math.sqrt(
    farDeadCenterDistance ** 2 - crankOffset ** 2,
  );
  const upperDeadCenterY = crankCenter.y - nearDeadCenterVertical;
  const lowerDeadCenterY = crankCenter.y - farDeadCenterVertical;
  const pistonStroke = upperDeadCenterY - lowerDeadCenterY;
  const upperDeadCenterAngle = Math.atan2(
    nearDeadCenterVertical,
    crankOffset,
  );
  const lowerDeadCenterAngle = Math.atan2(
    -farDeadCenterVertical,
    -crankOffset,
  );

  const crankPlaneZ = .06;
  const connectingRodPlaneZ = 0.62;
  const forkHalfSpacing = 0.34;
  const forkProngDepth = 0.15;
  const crankPinRadius = 0.102;
  const pistonRodDepth = 0.14;
  const pistonRodHalfWidth = 5 * engravingScale;
  const pistonRodTopLocalY = 3.38;
  const pistonRodBottomLocalY = -3.0;
  const guideInnerRadius = Math.hypot(
    pistonRodHalfWidth,
    pistonRodDepth / 2,
  ) + 0.027;
  const guideTubeRadius = 0.045;
  const forkDepthClearance = forkHalfSpacing - forkProngDepth / 2
    - pistonRodDepth / 2;

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
    roughness: 0.62,
  });
  const pistonMaterial = matte(PALETTE.driven, {
    metalness: 0.09,
    roughness: 0.61,
  });
  const rodMaterial = matte(PALETTE.accent, {
    metalness: 0.09,
    roughness: 0.60,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-engine-frame-carrying-crank-bearing-guide-A-and-cylinder';
  // Brown draws this engine from the side of the crank plane: the crankshaft
  // runs across the plate over the central column, so plate x is model z and
  // the crank, rod and piston offset lie in depth.
  const plateZ = (px) => connectingRodPlaneZ - (px - rasterPistonAxisX) * engravingScale;
  const plateY = (py) => crankCenterY - (py - rasterCrankCenter.y) * engravingScale;
  const columnFrontZ = plateZ(276);
  const columnBackZ = plateZ(319);
  const columnTopY = plateY(100);
  const frameBottomY = -5.9;
  const columnMinX = -0.80;
  const columnMaxX = 0.95;
  const frameColumn = new THREE.Mesh(
    new THREE.BoxGeometry(columnMaxX - columnMinX, columnTopY - frameBottomY,
      columnFrontZ - columnBackZ),
    frameMaterial,
  );
  frameColumn.position.set((columnMinX + columnMaxX) / 2,
    (columnTopY + frameBottomY) / 2, (columnFrontZ + columnBackZ) / 2);
  frameColumn.userData.fixed = true;
  frameColumn.userData.role = 'fixed-central-column-carrying-crankshaft-and-guide-A';
  const capitalTopY = plateY(83);
  const columnCapital = new THREE.Mesh(
    sideProfilePrism([
      [plateZ(279), columnTopY], [plateZ(316), columnTopY],
      [plateZ(328), capitalTopY], [plateZ(268), capitalTopY],
    ], columnMinX - .08, columnMaxX + .08),
    frameMaterial,
  );
  columnCapital.userData.fixed = true;
  columnCapital.userData.role = 'fixed-flared-capital-on-central-column';
  const shaftRadius = 0.16;
  const bushOuterRadius = 0.25;
  const bearingHousing = new THREE.Mesh(
    boredBlockGeometry(.35, capitalTopY - crankCenterY, plateY(12) - crankCenterY,
      bushOuterRadius, plateZ(272) - plateZ(310)),
    frameMaterial,
  );
  bearingHousing.position.set(crankCenter.x, crankCenterY,
    (plateZ(272) + plateZ(310)) / 2);
  bearingHousing.userData.fixed = true;
  bearingHousing.userData.role = 'fixed-crankshaft-bearing-block-on-column';
  const bearingBore = boredJournal(bushOuterRadius, shaftRadius + .012,
    plateZ(272) - plateZ(310), darkMaterial);
  bearingBore.position.copy(bearingHousing.position);
  bearingBore.userData.fixed = true;
  bearingBore.userData.role = 'fixed-crankshaft-bearing-bush';

  const guideA = new THREE.Group();
  guideA.position.set(0, guideY, 0);
  guideA.userData.axisX = pistonAxisX;
  guideA.userData.fixed = true;
  guideA.userData.role =
    'fixed-guide-A-centered-on-cylinder-and-piston-rod-axis';
  // Guide A's arm leaves the column behind the swing of the forked rod and
  // turns in between the prongs; the plate sees it end-on as one bar.
  const guideArmX = -0.62;
  const guideArmHalfHeight = 0.14;
  const guideBracket = new THREE.Mesh(
    new THREE.BoxGeometry(.44, guideArmHalfHeight * 2, .24),
    frameMaterial,
  );
  guideBracket.position.set(-.52, 0, connectingRodPlaneZ);
  guideBracket.userData.fixed = true;
  guideBracket.userData.role = 'fixed-arm-of-guide-A-between-fork-prongs';
  const guideCollar = new THREE.Mesh(
    new THREE.TorusGeometry(
      guideInnerRadius + guideTubeRadius,
      guideTubeRadius,
      10,
      40,
    ),
    darkMaterial,
  );
  guideCollar.position.set(0, 0, connectingRodPlaneZ);
  guideCollar.rotation.x = Math.PI / 2;
  guideCollar.userData.fixed = true;
  guideCollar.userData.innerRadius = guideInnerRadius;
  guideCollar.userData.role =
    'real-annular-guide-A-collar-around-prolonged-piston-rod';
  const guideShoe = new THREE.Mesh(
    plate(clip.difference(poly([[-.34,-.18],[.19,-.18],[.19,.18],[-.34,.18]]),
      poly(circle([0,0],guideInnerRadius,64))),-.14,.14).rotateX(Math.PI/2),
    frameMaterial,
  );
  guideShoe.position.set(0, 0, connectingRodPlaneZ);
  guideShoe.userData.fixed = true;
  guideShoe.userData.role = 'fixed-guide-A-bearing-block';
  const guideMountFrontZ = connectingRodPlaneZ + .12;
  const guideMountBackZ = columnFrontZ - .05;
  const guideMount = new THREE.Mesh(
    new THREE.BoxGeometry(.24, guideArmHalfHeight * 2,
      guideMountFrontZ - guideMountBackZ),
    frameMaterial,
  );
  guideMount.position.set(guideArmX, 0, (guideMountFrontZ + guideMountBackZ) / 2);
  guideMount.userData.fixed = true;
  guideMount.userData.role = 'guide-A-arm-from-central-column';
  guideA.add(guideBracket, guideShoe, guideCollar, guideMount);

  // Plate cylinder: gland flange, stuffing box and flange, then the cover;
  // the barrel continues below the plate edge.
  const cylinderRadius = 0.83;
  const cylinderTopY = plateY(458);
  const coverBottomY = plateY(476);
  const cylinderBottomY = -5.75;
  const cylinderHeight = coverBottomY - cylinderBottomY;
  const cylinderCenterY = (coverBottomY + cylinderBottomY) / 2;
  const cylinderBody = new THREE.Mesh(
    boredCylinderGeometry(cylinderRadius,.60,cylinderHeight),
    frameMaterial,
  );
  cylinderBody.position.set(0, cylinderCenterY, connectingRodPlaneZ);
  cylinderBody.userData.fixed = true;
  cylinderBody.userData.role = 'fixed-cylinder-collinear-with-guide-A';
  const cylinderTop = new THREE.Mesh(
    boredCylinderGeometry(1.01,guideInnerRadius,cylinderTopY - coverBottomY),
    frameMaterial,
  );
  cylinderTop.position.set(0, (cylinderTopY + coverBottomY) / 2, connectingRodPlaneZ);
  cylinderTop.userData.fixed = true;
  cylinderTop.userData.role = 'fixed-cylinder-top-cover';
  const glandTopY = -2.62;
  const gland = new THREE.Mesh(
    boredCylinderGeometry(.27,guideInnerRadius,glandTopY - .16 - cylinderTopY),
    frameMaterial,
  );
  gland.position.set(0, (glandTopY - .16 + cylinderTopY) / 2, connectingRodPlaneZ);
  gland.userData.fixed = true;
  gland.userData.role = 'fixed-piston-rod-stuffing-box-on-cylinder-axis';
  const glandFlanges = [[glandTopY, .16, .36], [glandTopY - .30, .12, .41]]
    .map(([top, height, radius], index) => {
      const flange = new THREE.Mesh(
        boredCylinderGeometry(radius, guideInnerRadius, height),
        frameMaterial,
      );
      flange.position.set(0, top - height / 2, connectingRodPlaneZ);
      flange.userData.fixed = true;
      flange.userData.role = index === 0
        ? 'fixed-gland-flange' : 'fixed-stuffing-box-flange';
      return flange;
    });
  const cylinderBase = new THREE.Mesh(
    new THREE.CylinderGeometry(.88, .88, .15, 48),
    frameMaterial,
  );
  cylinderBase.position.set(0, cylinderBottomY - .075, connectingRodPlaneZ);
  cylinderBase.userData.fixed = true;
  cylinderBase.userData.role = 'fixed-cylinder-bottom-below-plate';
  fixedFrame.add(
    frameColumn,
    columnCapital,
    bearingHousing,
    bearingBore,
    guideA,
    cylinderBody,
    cylinderTop,
    gland,
    ...glandFlanges,
    cylinderBase,
  );

  const crankRotor = new THREE.Group();
  crankRotor.position.set(crankCenter.x, crankCenter.y, 0);
  crankRotor.userData.axis = Z_AXIS.clone();
  crankRotor.userData.role =
    'one-rigid-overhead-crank-web-pin-shaft-and-flywheel';
  const crankHub = cylinderAlongZ(.30,.24,driverMaterial,40);
  crankHub.position.z = crankPlaneZ;
  crankHub.userData.role = 'overhead-crank-hub';
  const crankArm = new THREE.Mesh(
    crankWebGeometry(.50, .28, crankRadius, .22),
    driverMaterial,
  );
  crankArm.position.z = crankPlaneZ;
  crankArm.userData.role = 'rigid-overhead-crank-web';
  const crankPinFrontZ = connectingRodPlaneZ + .22;
  const crankPinBackZ = crankPlaneZ - .12;
  const crankPinBoss = cylinderAlongZ(0.15, 0.08, darkMaterial, 34);
  crankPinBoss.position.set(crankRadius, 0, crankPinFrontZ - .04);
  crankPinBoss.userData.role = 'overhead-crank-pin-nut';
  const crankPinShaft = cylinderAlongZ(
    crankPinRadius,
    crankPinFrontZ - crankPinBackZ,
    darkMaterial,
    32,
  );
  crankPinShaft.position.set(
    crankRadius,
    0,
    (crankPinFrontZ + crankPinBackZ) / 2,
  );
  crankPinShaft.userData.role = 'crank-pin-to-forked-rod-journal';
  const crankPinAnchor = new THREE.Object3D();
  crankPinAnchor.position.set(
    crankRadius,
    0,
    connectingRodPlaneZ,
  );
  crankPinAnchor.userData.role = 'analytic-overhead-crank-pin';
  const shaftFrontZ = crankPlaneZ + .02;
  const shaftBackZ = -4.62;
  const liveShaft = cylinderAlongZ(shaftRadius, shaftFrontZ - shaftBackZ,
    darkMaterial, 36);
  liveShaft.position.z = (shaftFrontZ + shaftBackZ) / 2;
  liveShaft.userData.role = 'live-overhead-crankshaft';
  // The flywheel is the tall edge-on shape hanging from the shaft at the
  // plate's right; only its lower rim is inside the plate.
  const flywheelPlaneZ = plateZ(415.5);
  const flywheelWidth = (446 - 385) * engravingScale;
  const flywheelOuterRadius = crankCenterY - plateY(343);
  const flywheelInnerRadius = flywheelOuterRadius - .34;
  const flywheelRim = new THREE.Mesh(
    annulusAlongZ(flywheelOuterRadius, flywheelInnerRadius, flywheelWidth),
    driverMaterial,
  );
  flywheelRim.position.z = flywheelPlaneZ;
  flywheelRim.userData.role = 'edge-on-flywheel-rim-on-crankshaft';
  const flywheelHub = cylinderAlongZ((434 - 392) / 2 * engravingScale,
    (434 - 392) * engravingScale, driverMaterial, 40);
  flywheelHub.position.z = flywheelPlaneZ;
  flywheelHub.userData.role = 'flywheel-hub-on-crankshaft';
  const flywheelArms = Array.from({ length: 6 }, (_, index) => {
    const angle = index * Math.PI / 3;
    const armLength = flywheelInnerRadius - .15;
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(armLength, .30, (422 - 410) * engravingScale),
      driverMaterial,
    );
    arm.position.set(Math.cos(angle) * (.2 + armLength / 2),
      Math.sin(angle) * (.2 + armLength / 2), flywheelPlaneZ);
    arm.rotation.z = angle;
    arm.userData.role = `flywheel-arm-${index + 1}`;
    return arm;
  });
  crankRotor.add(
    crankHub,
    crankArm,
    crankPinBoss,
    crankPinShaft,
    crankPinAnchor,
    liveShaft,
    flywheelRim,
    flywheelHub,
    ...flywheelArms,
  );

  const forkParts = makeForkedConnectingRod({
    darkMaterial,
    forkHalfSpacing,
    forkStartFraction,
    length: connectingRodLength,
    pistonRodTopLocalY,
    prongDepth: forkProngDepth,
    rodMaterial,
  });

  const pistonAssembly = new THREE.Group();
  pistonAssembly.userData.role =
    'rigid-prolonged-piston-rod-crosshead-and-piston';
  pistonAssembly.userData.rotationDegreesOfFreedom = 0;
  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(
      pistonRodHalfWidth * 2,
      pistonRodTopLocalY - pistonRodBottomLocalY,
      pistonRodDepth,
    ),
    pistonMaterial,
  );
  pistonRod.position.set(
    0,
    (pistonRodTopLocalY + pistonRodBottomLocalY) / 2,
    connectingRodPlaneZ,
  );
  pistonRod.userData.role =
    'one-piece-piston-rod-prolonged-upward-through-guide-A';
  const crosshead = new THREE.Mesh(
    new THREE.BoxGeometry(.42,.20,2*(forkHalfSpacing-forkProngDepth/2-.015)),
    pistonMaterial,
  );
  crosshead.position.z = connectingRodPlaneZ;
  crosshead.userData.role = 'crosshead-rigid-on-prolonged-piston-rod';
  const commonWristPin = cylinderAlongZ(
    0.12,
    forkHalfSpacing * 2 + forkProngDepth + 0.28,
    darkMaterial,
    32,
  );
  commonWristPin.position.z = connectingRodPlaneZ;
  commonWristPin.userData.role =
    'one-common-wrist-pin-through-both-fork-prongs-and-piston-rod';
  const pistonHead = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.58, 0.18, 44),
    pistonMaterial,
  );
  pistonHead.position.set(0, pistonRodBottomLocalY - .06, connectingRodPlaneZ);
  pistonHead.userData.role = 'piston-rigid-with-prolonged-rod';
  const pistonWristAnchor = new THREE.Object3D();
  pistonWristAnchor.position.z = connectingRodPlaneZ;
  pistonWristAnchor.userData.role = 'analytic-piston-crosshead-wrist';
  const guideAxisAnchor = new THREE.Object3D();
  guideAxisAnchor.position.set(
    0,
    guideY,
    connectingRodPlaneZ,
  );
  guideAxisAnchor.userData.role = 'analytic-fixed-guide-A-axis';
  fixedFrame.add(guideAxisAnchor);
  pistonAssembly.add(
    pistonRod,
    pistonHead,
    crosshead,
    commonWristPin,
    pistonWristAnchor,
  );

  root.add(
    fixedFrame,
    crankRotor,
    forkParts.rod,
    pistonAssembly,
  );

  const cross2 = (left, right) => left.x * right.y
    - left.y * right.x;
  const stateAtCrankAngle = (
    unwrappedCrankAngle,
    angularVelocity = crankAngularSpeed,
  ) => {
    const crankAngle = positiveModulo(unwrappedCrankAngle, FULL_TURN);
    const sine = Math.sin(crankAngle);
    const cosine = Math.cos(crankAngle);
    const crankPin = new THREE.Vector2(
      crankCenter.x + crankRadius * cosine,
      crankCenter.y + crankRadius * sine,
    );
    const crankPinVelocity = new THREE.Vector2(
      -crankRadius * angularVelocity * sine,
      crankRadius * angularVelocity * cosine,
    );
    const crankPinAcceleration = new THREE.Vector2(
      -crankRadius * angularVelocity ** 2 * cosine,
      -crankRadius * angularVelocity ** 2 * sine,
    );
    const horizontalClosure = pistonAxisX - crankPin.x;
    const circleLineRadicand = connectingRodLength ** 2
      - horizontalClosure ** 2;
    const circleLineRoot = Math.sqrt(Math.max(0, circleLineRadicand));
    const sliderY = crankPin.y - circleLineRoot;
    const sliderVelocityY = crankPinVelocity.y
      - horizontalClosure * crankPinVelocity.x / circleLineRoot;
    const sliderAccelerationY = crankPinAcceleration.y
      + crankPinVelocity.x ** 2 / circleLineRoot
      - horizontalClosure * crankPinAcceleration.x / circleLineRoot
      + horizontalClosure ** 2 * crankPinVelocity.x ** 2
        / circleLineRoot ** 3;
    const wristPin = new THREE.Vector2(pistonAxisX, sliderY);
    const wristVelocity = new THREE.Vector2(0, sliderVelocityY);
    const wristAcceleration = new THREE.Vector2(
      0,
      sliderAccelerationY,
    );
    const rodVector = wristPin.clone().sub(crankPin);
    const relativeVelocity = wristVelocity.clone().sub(crankPinVelocity);
    const relativeAcceleration = wristAcceleration.clone().sub(
      crankPinAcceleration,
    );
    const rodLengthSquared = rodVector.lengthSq();
    const rodAngularVelocity = cross2(rodVector, relativeVelocity)
      / rodLengthSquared;
    const rodAngularAcceleration = (
      cross2(rodVector, relativeAcceleration) * rodLengthSquared
        - cross2(rodVector, relativeVelocity)
          * 2 * rodVector.dot(relativeVelocity)
    ) / rodLengthSquared ** 2;
    const extensionTopY = sliderY + pistonRodTopLocalY;
    const extensionBottomY = sliderY + pistonRodBottomLocalY;

    return {
      circleLineRadicand,
      circleLineRoot,
      crankAngle,
      crankAngularAcceleration: 0,
      crankAngularVelocity: angularVelocity,
      crankPin,
      crankPinAcceleration,
      crankPinVelocity,
      fork: {
        centerWrist: wristPin.clone(),
        depthClearance: forkDepthClearance,
        frontProngPlaneZ: connectingRodPlaneZ + forkHalfSpacing,
        rearProngPlaneZ: connectingRodPlaneZ - forkHalfSpacing,
        separation: forkHalfSpacing * 2,
      },
      guide: {
        axisResidual: pistonAxisX,
        extensionBottomBelowGuide: guideY - extensionBottomY,
        extensionTopAboveGuide: extensionTopY - guideY,
        innerRadius: guideInnerRadius,
        radialClearance: guideInnerRadius - Math.hypot(
          pistonRodHalfWidth,
          pistonRodDepth / 2,
        ),
        rodRotation: 0,
      },
      phase: positiveModulo(
        (unwrappedCrankAngle - initialCrankAngle) / FULL_TURN,
        1,
      ),
      pistonAxisResidual: wristPin.x - pistonAxisX,
      pistonRotation: 0,
      rodAngle: Math.atan2(rodVector.y, rodVector.x),
      rodAngularAcceleration,
      rodAngularVelocity,
      rodLength: rodVector.length(),
      rodLengthResidual: rodVector.length() - connectingRodLength,
      rodVector,
      sliderAccelerationY,
      sliderVelocityY,
      sliderY,
      unwrappedCrankAngle,
      wristAcceleration,
      wristPin,
      wristVelocity,
    };
  };
  const stateAtTime = (time) => {
    const elapsed = Number.isFinite(Number(time)) ? Number(time) : 0;
    return stateAtCrankAngle(
      initialCrankAngle + elapsed * crankAngularSpeed,
    );
  };
  const timeAtAngle = (angle) => positiveModulo(
    angle - initialCrankAngle,
    FULL_TURN,
  ) / crankAngularSpeed;
  const canonicalTimes = {
    cycleClosure: cyclePeriod,
    lowerDeadCenter: timeAtAngle(lowerDeadCenterAngle),
    sourceEngravingPose: 0,
    upperDeadCenter: timeAtAngle(upperDeadCenterAngle),
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const geometry = {
    connectingRodLength,
    connectingRodPlaneZ,
    crankAngularSpeed,
    crankCenter,
    crankOffset,
    crankPlaneZ,
    crankRadius,
    cyclePeriod,
    cylinderCenterY,
    cylinderHeight,
    cylinderRadius,
    engravingScale,
    farDeadCenterDistance,
    farDeadCenterVertical,
    forkDepthClearance,
    forkHalfSpacing,
    forkProngDepth,
    forkStartFraction,
    guideInnerRadius,
    guideTubeRadius,
    guideY,
    initialCrankAngle,
    lowerDeadCenterAngle,
    lowerDeadCenterY,
    nearDeadCenterDistance,
    nearDeadCenterVertical,
    pistonAxisX,
    pistonRodBottomLocalY,
    pistonRodDepth,
    pistonRodHalfWidth,
    pistonRodTopLocalY,
    pistonStroke,
    rasterCrankRadius,
    upperDeadCenterAngle,
    upperDeadCenterY,
  };

  const contacts = {
    crankPinToForkedRod: {
      crankMember: crankRotor,
      point: new THREE.Vector3(
        sourceCrankPin.x,
        sourceCrankPin.y,
        connectingRodPlaneZ,
      ),
      rodMember: forkParts.rod,
      type: 'revolute-crank-joint',
    },
    forkedRodToPistonCrosshead: {
      pistonMember: pistonAssembly,
      point: new THREE.Vector3(
        pistonAxisX,
        sourcePistonWrist.y,
        connectingRodPlaneZ,
      ),
      rodMember: forkParts.rod,
      type: 'common-transverse-wrist-pin-through-two-prongs',
    },
    pistonRodInGuideA: {
      fixedMember: guideA,
      movingMember: pistonAssembly,
      radialClearance: guideInnerRadius - Math.hypot(
        pistonRodHalfWidth,
        pistonRodDepth / 2,
      ),
      type: 'one-axis-prismatic-guide',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    crankRotor.rotation.z = state.crankAngle;
    forkParts.rod.position.set(
      state.crankPin.x,
      state.crankPin.y,
      connectingRodPlaneZ,
    );
    forkParts.rod.rotation.z = state.rodAngle;
    pistonAssembly.position.set(pistonAxisX, state.sliderY, 0);
    contacts.crankPinToForkedRod.point.set(
      state.crankPin.x,
      state.crankPin.y,
      connectingRodPlaneZ,
    );
    contacts.forkedRodToPistonCrosshead.point.set(
      pistonAxisX,
      state.sliderY,
      connectingRodPlaneZ,
    );
    contacts.pistonRodInGuideA.radialClearance =
      state.guide.radialClearance;
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    'prolonged-piston-rod-fixed-guide-A-forked-connecting-rod';
  root.userData.blocks = {
    bearingBore,
    bearingHousing,
    commonWristPin,
    crankArm,
    crankHub,
    crankPinAnchor,
    crankPinBoss,
    crankPinShaft,
    crankRotor,
    crosshead,
    cylinderBase,
    cylinderBody,
    cylinderTop,
    columnCapital,
    fixedFrame,
    flywheelArms,
    flywheelHub,
    flywheelRim,
    forkBody: forkParts.body,
    forkCenterWristAnchor: forkParts.centerWristAnchor,
    forkCrankAnchor: forkParts.crankAnchor,
    forkWristAnchors: forkParts.wristAnchors,
    forkWristEyes: forkParts.wristEyes,
    forkedConnectingRod: forkParts.rod,
    frameColumn,
    gland,
    glandFlanges,
    guideA,
    guideAxisAnchor,
    guideBracket,
    guideCollar,
    guideMount,
    guideShoe,
    liveShaft,
    pistonAssembly,
    pistonHead,
    pistonRod,
    pistonWristAnchor,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one continuous overhead crank rotation',
    mechanism: 1,
    pistonRodRotation: 0,
    pistonRodTranslationAxes: 1,
    output:
      'one offset vertical piston translation constrained by fixed guide A',
  };
  root.userData.engravingPointToModelFront = engravingPointToModelFront;
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -5.30;
  root.userData.mechanism =
    'offset-overhead-crank-finite-forked-rod-common-wrist-prolonged-piston-rod-through-collinear-fixed-guide-A';
  root.userData.sourceAnimation = {
    available: false,
    demonstrationCycleSeconds: cyclePeriod,
    demonstrationCyclesPerMinute,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope:
      'Brown plate 330 crank center, crank pin, single-to-fork transition, twin lower prongs, common piston wrist, prolonged rod, guide A, cylinder axis, and fixed frame',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate330: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one upper crank and finite rod whose lower portion forks in depth around a piston rod prolonged through fixed guide A on the cylinder centerline',
      measurementUncertaintyPixels: 7,
      plateView: {
        horizontalAxis: 'model -z (along the crankshaft)',
        scope:
          'the plate looks along the crank plane; column, capital, bearing, crankshaft, edge-on flywheel, guide-A bar, gland and cover are placed from plate x as model z. The raster crank and pin x-values still set the in-plane linkage, whose depth offset the side view cannot show',
        verticalAxis: 'model y',
      },
      rasterCrankCenter,
      rasterCrankPin,
      rasterCylinderAxisPoint,
      rasterForkJunction,
      rasterGuideCenterA,
      rasterPistonAxisX,
      rasterPistonWrist,
    },
    normalizedEngravingGeometry: {
      connectingRodToCrankRatio:
        rasterCrankPin.distanceTo(rasterPistonWrist) / rasterCrankRadius,
      crankCenterOffsetToRadiusRatio:
        (rasterCrankCenter.x - rasterPistonAxisX) / rasterCrankRadius,
      forkStartFraction,
      guideAIsCollinearWithCylinder: true,
    },
    officialAnimationView: null,
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
    crankToPiston:
      'exact finite offset slider-crank closure through one forked rod',
    forkClearance:
      'front and rear lower prongs straddle the piston rod in depth',
    guideConstraint:
      'fixed guide A and cylinder share x = 0; piston-rod yaw is zero',
    input: 'continuous overhead crank at 15 demonstration rpm',
    output: 'reciprocating prolonged piston rod on the cylinder axis',
  };

  fitPistonGuide(root,update,cyclePeriod);
  root.userData.sweptBounds = root.userData.cameraFitBounds;
  // The plate edges, from the flywheel's right to the empty margin left of
  // the fork and from the capital's top down to the cylinder cover.
  const plateEdgeZ = (px) => connectingRodPlaneZ - (px - rasterPistonAxisX) * engravingScale;
  const plateEdgeY = (py) => crankCenterY - (py - rasterCrankCenter.y) * engravingScale;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.0, plateEdgeY(525), plateEdgeZ(525)),
    new THREE.Vector3(1.5, plateEdgeY(0), plateEdgeZ(0)),
  );
  root.userData.cameraDistanceScale = 0.96;
  root.userData.cameraFov = 8;
  markShadows(root);
  return {
    // Brown's view looks along the crank plane (model +x); the plate's right
    // is model -z.  This is the (0.45, 0.28, 14) plate direction in that frame.
    cameraDirection: new THREE.Vector3(14, 0.28, -0.45),
    root,
    update,
  };
}

export function createAuthoredForkedPistonGuide(movement) {
  if (movement.id !== 330) return null;
  return ForkedPistonRodGuide(movement);
}
