import * as THREE from 'three';
import { fitPistonGuide, boredJournal } from './piston-guide-parts.js';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function centeredExtrusion(shape, depth, bevel = 0.012, curveSegments = 1) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function cylinderAlongZ(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function halfAnnulusShape(side, innerRadius, halfHeight, outerFaceAtY) {
  // A split bearing lining has a circular inner face and a straight taper
  // against its gib; an isolated half-ring cannot transmit load to that gib.
  const shape = new THREE.Shape();
  shape.moveTo(side * outerFaceAtY(halfHeight), halfHeight);
  shape.lineTo(0, halfHeight);
  shape.lineTo(0, innerRadius);
  for (let index = 1; index <= 48; index += 1) {
    const angle = Math.PI / 2 + (side < 0 ? 1 : -1) * Math.PI * index / 48;
    shape.lineTo(innerRadius * Math.cos(angle), innerRadius * Math.sin(angle));
  }
  shape.lineTo(0, -halfHeight);
  shape.lineTo(side * outerFaceAtY(-halfHeight), -halfHeight);
  shape.closePath();
  return shape;
}

function taperGibShape(side, outerFace, innerTop, innerBottom, top, bottom) {
  const shape = new THREE.Shape();
  const points = side < 0
    ? [
      [-outerFace, bottom],
      [-outerFace, top],
      [-innerTop, top],
      [-innerBottom, bottom],
    ]
    : [
      [outerFace, bottom],
      [innerBottom, bottom],
      [innerTop, top],
      [outerFace, top],
    ];
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

function claytonSlidingJournalBox(movement) {
  const root = new THREE.Group();

  // Independent measurements are taken from Brown's public-domain engraving.
  // The official web animation was consulted only for the topology: a fixed-
  // axis crank, a horizontal Scotch-yoke crosshead, and an orientation-fixed
  // journal box sliding vertically in the yoke slot. None of its drawing
  // coordinates are reproduced here.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.012;
  const sourceRasterCrankCenter = new THREE.Vector2(215, 282);
  const sourceRasterWristCenter = new THREE.Vector2(264, 183);
  const sourceRasterOuterTopLeft = new THREE.Vector2(157, 19);
  const sourceRasterOuterTopRight = new THREE.Vector2(380, 19);
  const sourceRasterOuterBottomLeft = new THREE.Vector2(157, 510);
  const sourceRasterOuterBottomRight = new THREE.Vector2(380, 510);
  const sourceRasterSlotTopLeft = new THREE.Vector2(191, 54);
  const sourceRasterSlotTopRight = new THREE.Vector2(343, 54);
  const sourceRasterSlotBottomLeft = new THREE.Vector2(191, 469);
  const sourceRasterSlotBottomRight = new THREE.Vector2(343, 469);
  const sourceRasterLeftScrew = new THREE.Vector2(235, 78);
  const sourceRasterRightScrew = new THREE.Vector2(293, 78);
  const sourceRasterCrossheadRodY = 266;

  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterCrankCenter.x) * sourceScale,
    (sourceRasterCrankCenter.y - y) * sourceScale,
  );
  const sourceCrankCenter = sourcePointToModel(sourceRasterCrankCenter);
  const sourceWristCenter = sourcePointToModel(sourceRasterWristCenter);
  const crankRadius = sourceWristCenter.distanceTo(sourceCrankCenter);
  const sourceCrankAngle = Math.atan2(
    sourceWristCenter.y,
    sourceWristCenter.x,
  );
  const wristRadius = 0.456;
  const linerInnerRadius = wristRadius + 0.026;
  const linerOuterRadius = 0.605;
  const slotHalfWidth = 0.912;
  const slotTopY = sourcePointToModel(sourceRasterSlotTopLeft).y;
  const slotBottomY = sourcePointToModel(sourceRasterSlotBottomLeft).y;
  const outerTopY = sourcePointToModel(sourceRasterOuterTopLeft).y;
  const outerBottomY = sourcePointToModel(sourceRasterOuterBottomLeft).y;
  const outerTopHalfWidth = 1.338;
  const outerMidHalfWidth = 1.956;
  const outerUpperShoulderY = 2.232;
  const outerLowerShoulderY = -1.77;
  const crossheadRodY = (
    sourceRasterCrankCenter.y - sourceRasterCrossheadRodY
  ) * sourceScale;
  const gibOuterFace = 0.894;
  const gibInnerTop = 0.62;
  const gibInnerBottom = 0.70;
  const gibTopY = 0.98;
  const gibBottomY = -0.876;
  const boxTopY = 1.38;
  const boxBottomY = gibBottomY;
  const screwX = 0.348;
  const screwCenterY = 1.26;
  const screwTravel = 0.44;
  const rodHalfLength = 5.10;
  const guideCenterX = 3.50;
  const guideHalfWidth = 0.20;
  const cyclePeriod = 4;
  const crankAngularSpeed = FULL_TURN / cyclePeriod;

  const stateAtCrankAngle = (
    crankAngle,
    angularSpeed = crankAngularSpeed,
    angularAcceleration = 0,
  ) => {
    const cosine = Math.cos(crankAngle);
    const sine = Math.sin(crankAngle);
    const crankPin = new THREE.Vector3(
      crankRadius * cosine,
      crankRadius * sine,
      0,
    );
    const crankPinVelocity = new THREE.Vector3(
      -crankRadius * sine * angularSpeed,
      crankRadius * cosine * angularSpeed,
      0,
    );
    const crankPinAcceleration = new THREE.Vector3(
      -crankRadius * (
        cosine * angularSpeed ** 2
        + sine * angularAcceleration
      ),
      crankRadius * (
        -sine * angularSpeed ** 2
        + cosine * angularAcceleration
      ),
      0,
    );
    const crossheadX = crankPin.x;
    const crossheadSpeed = crankPinVelocity.x;
    const crossheadAcceleration = crankPinAcceleration.x;
    const boxRelativeY = crankPin.y;
    const boxRelativeSpeed = crankPinVelocity.y;
    const boxRelativeAcceleration = crankPinAcceleration.y;
    const leftGibClearance = slotHalfWidth - gibOuterFace;
    const rightGibClearance = slotHalfWidth - gibOuterFace;
    const upperEnvelopeClearance = slotTopY
      - (boxRelativeY + boxTopY);
    const lowerEnvelopeClearance = boxRelativeY + boxBottomY
      - slotBottomY;
    const minimumSlotEndClearance = Math.min(
      upperEnvelopeClearance,
      lowerEnvelopeClearance,
    );
    const leftRodGuideCoverage = rodHalfLength
      - Math.abs(-guideCenterX - crossheadX)
      - guideHalfWidth;
    const rightRodGuideCoverage = rodHalfLength
      - Math.abs(guideCenterX - crossheadX)
      - guideHalfWidth;
    const minimumRodGuideCoverage = Math.min(
      leftRodGuideCoverage,
      rightRodGuideCoverage,
    );
    let stage;
    if (Math.abs(crossheadSpeed) < 1e-10) {
      stage = crossheadX > 0
        ? 'right-crosshead-dead-center'
        : 'left-crosshead-dead-center';
    } else {
      const horizontal = crossheadSpeed > 0 ? 'right' : 'left';
      const vertical = boxRelativeSpeed > 0 ? 'up' : 'down';
      stage = `crosshead-moving-${horizontal}-journal-box-sliding-${vertical}`;
    }

    return {
      angularAcceleration,
      angularSpeed,
      bearingConcentricityError: 0,
      boxAngle: 0,
      boxRelativeAcceleration,
      boxRelativeSpeed,
      boxRelativeY,
      crankAngle,
      crankPin,
      crankPinAcceleration,
      crankPinVelocity,
      crossheadAcceleration,
      crossheadSpeed,
      crossheadX,
      horizontalConstraintError: crankPin.x - crossheadX,
      leftGibClearance,
      leftRodGuideCoverage,
      linerRadialClearance: linerInnerRadius - wristRadius,
      lowerEnvelopeClearance,
      minimumRodGuideCoverage,
      minimumSlotEndClearance,
      rightGibClearance,
      rightRodGuideCoverage,
      stage,
      upperEnvelopeClearance,
    };
  };
  const stateAtTime = (time) => {
    const crankAngle = sourceCrankAngle + crankAngularSpeed * time;
    return {
      ...stateAtCrankAngle(crankAngle),
      cycleIndex: Math.floor(time / cyclePeriod),
      cycleTime: THREE.MathUtils.euclideanModulo(time, cyclePeriod),
    };
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.15,
    roughness: 0.57,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.60,
  });
  const boxMaterial = matte(PALETTE.accent, {
    metalness: 0.23,
    roughness: 0.52,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.28,
    roughness: 0.50,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.46,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const crank = new THREE.Group();
  crank.position.z = -0.42;
  crank.userData.axis = Z_AXIS.clone();
  crank.userData.role = 'fixed-axis-crank-and-wrist-driver';
  const crankRotor = new THREE.Group();
  crankRotor.userData.axis = Z_AXIS.clone();
  crankRotor.userData.role = 'rigid-crank-rotor';
  crank.add(crankRotor);
  root.add(crank);
  // Brown draws the crank as one lobed throw plate behind the crosshead: its
  // rounded boss end shows solid in the open slot below the box, while its
  // sides beside the gibs and the shaft behind it are dashed (hidden). The
  // shaft hub and its bearing therefore sit wholly behind the plate.
  const crankBossRadius = 0.46;
  const crankWristEndRadius = 0.66;
  const crankTangent = Math.acos(
    -(crankWristEndRadius - crankBossRadius) / crankRadius,
  );
  const crankShape = new THREE.Shape();
  crankShape.absarc(crankRadius, 0, crankWristEndRadius,
    crankTangent, -crankTangent, true);
  crankShape.absarc(0, 0, crankBossRadius,
    -crankTangent, crankTangent, true);
  const crankArm = new THREE.Mesh(
    centeredExtrusion(crankShape, 0.28, 0.01, 24),
    driverMaterial,
  );
  crankArm.userData.role = 'rigid-lobed-crank-throw-plate';
  crankRotor.add(crankArm);
  const mainHub = cylinderAlongZ(0.36, 0.41, driverMaterial, 48);
  mainHub.position.z = -0.205;
  mainHub.userData.role = 'crank-main-shaft-hub';
  crankRotor.add(mainHub);
  const crankWrist = cylinderAlongZ(wristRadius, 0.96, darkMaterial, 52);
  crankWrist.position.set(crankRadius, 0, 0.32);
  crankWrist.userData.role = 'rotating-crank-wrist-journal';
  crankRotor.add(crankWrist);
  const wristFace = cylinderAlongZ(wristRadius * 0.82, 0.03,
    driverMaterial, 48);
  wristFace.position.set(crankRadius, 0, 0.815);
  wristFace.userData.role = 'crank-wrist-colored-face';
  crankRotor.add(wristFace);
  const wristRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(wristRadius * 0.75, 0.065, 0.035),
    whiteMaterial,
  );
  wristRotationIndex.position.set(
    crankRadius + wristRadius * 0.47,
    0,
    0.85,
  );
  wristRotationIndex.userData.role = 'white-crank-wrist-rotation-index';
  crankRotor.add(wristRotationIndex);
  // Brown dashes the crank's hidden edges only because the box and lobe
  // cover them; the real throw and shaft show when the view is turned.
  const fixedCrankBearing = boredJournal(0.44, 0.366, 0.15, frameMaterial);
  fixedCrankBearing.position.z = -0.75;
  fixedCrankBearing.userData.role = 'fixed-crank-shaft-bearing';
  root.add(fixedCrankBearing);

  const crosshead = new THREE.Group();
  crosshead.userData.axis = X_AXIS.clone();
  crosshead.userData.role = 'horizontal-slotted-crosshead';
  root.add(crosshead);
  const crossheadShape = new THREE.Shape();
  const outerPoints = [
    [-outerTopHalfWidth, outerTopY],
    [-outerTopHalfWidth, outerUpperShoulderY],
    [-outerMidHalfWidth, crossheadRodY + 0.36],
    [-outerMidHalfWidth, crossheadRodY - 0.36],
    [-outerTopHalfWidth, outerLowerShoulderY],
    [-outerTopHalfWidth, outerBottomY],
    [outerTopHalfWidth, outerBottomY],
    [outerTopHalfWidth, outerLowerShoulderY],
    [outerMidHalfWidth, crossheadRodY - 0.36],
    [outerMidHalfWidth, crossheadRodY + 0.36],
    [outerTopHalfWidth, outerUpperShoulderY],
    [outerTopHalfWidth, outerTopY],
  ];
  outerPoints.forEach(([x, y], index) => {
    if (index === 0) crossheadShape.moveTo(x, y);
    else crossheadShape.lineTo(x, y);
  });
  crossheadShape.closePath();
  const slotHole = new THREE.Path();
  slotHole.moveTo(-slotHalfWidth, slotBottomY);
  slotHole.lineTo(-slotHalfWidth, slotTopY);
  slotHole.lineTo(slotHalfWidth, slotTopY);
  slotHole.lineTo(slotHalfWidth, slotBottomY);
  slotHole.closePath();
  crossheadShape.holes.push(slotHole);
  const crossheadBody = new THREE.Mesh(
    centeredExtrusion(crossheadShape, 0.34, 0),
    drivenMaterial,
  );
  crossheadBody.userData.role = 'source-profiled-crosshead-yoke-body';
  crosshead.add(crossheadBody);
  const leftSlotFace = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, slotTopY - slotBottomY, 0.45),
    darkMaterial,
  );
  leftSlotFace.position.set(
    -slotHalfWidth - 0.0275,
    (slotTopY + slotBottomY) / 2,
    0.06,
  );
  leftSlotFace.userData.role = 'left-vertical-box-guide-face';
  const rightSlotFace = leftSlotFace.clone();
  rightSlotFace.position.x = slotHalfWidth + 0.0275;
  rightSlotFace.userData.role = 'right-vertical-box-guide-face';
  crosshead.add(leftSlotFace, rightSlotFace);
  const crossheadRod = new THREE.Group();
  for (const side of [-1, 1]) {
    // Brown's rod is a heavy bar, about a sixth of the yoke's width.
    const arm = new THREE.Mesh(new THREE.BoxGeometry(rodHalfLength - slotHalfWidth, 0.66, 0.32), drivenMaterial);
    arm.position.set(side * (rodHalfLength + slotHalfWidth) / 2, crossheadRodY, -0.02);
    crossheadRod.add(arm);
  }
  crossheadRod.userData.role = 'crosshead-horizontal-output-rod';
  crosshead.add(crossheadRod);
  const crossheadMotionIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.07, 0.035),
    whiteMaterial,
  );
  crossheadMotionIndex.position.set(0, outerBottomY + 0.27, 0.23);
  crossheadMotionIndex.userData.role = 'white-crosshead-translation-index';
  crosshead.add(crossheadMotionIndex);

  const guideBlocks = [];
  for (const side of [-1, 1]) {
    for (const verticalSide of [-1, 1]) {
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(guideHalfWidth * 2, 0.18, 0.78),
        frameMaterial,
      );
      block.position.set(
        side * guideCenterX,
        crossheadRodY + verticalSide * 0.43,
        -0.02,
      );
      block.userData.role = `${side < 0 ? 'left' : 'right'}-fixed-crosshead-guide-${
        verticalSide < 0 ? 'lower' : 'upper'}`;
      root.add(block);
      guideBlocks.push(block);
    }
  }
  const guidePosts = [-1, 1].map((side) => {
    const post = makeBeam(
      new THREE.Vector3(side * guideCenterX, crossheadRodY - 0.35, -0.55),
      new THREE.Vector3(side * guideCenterX, -3.18, -0.55),
      { color: PALETTE.frame, depth: 0.30, thickness: 0.20 },
    );
    post.userData.role = side < 0
      ? 'fixed-left-crosshead-guide-post'
      : 'fixed-right-crosshead-guide-post';
    root.add(post);
    return post;
  });
  const base = makeBeam(
    new THREE.Vector3(-3.82, -3.18, -0.55),
    new THREE.Vector3(3.82, -3.18, -0.55),
    { color: PALETTE.frame, depth: 0.34, thickness: 0.23 },
  );
  base.userData.role = 'fixed-crosshead-display-base';
  root.add(base);

  const journalBox = new THREE.Group();
  journalBox.userData.axis = Y_AXIS.clone();
  journalBox.userData.role = 'orientation-fixed-Clayton-sliding-journal-box';
  root.add(journalBox);
  const liningPieces = [-1, 1].map((side) => {
    const lining = new THREE.Mesh(
      centeredExtrusion(
        halfAnnulusShape(side, linerInnerRadius, linerOuterRadius,
          y => gibInnerBottom + (gibInnerTop - gibInnerBottom)
            * (y - gibBottomY) / (gibTopY - gibBottomY)),
        0.30,
        0,
      ),
      boxMaterial,
    );
    lining.position.z = 0.44;
    lining.userData.role = side < 0
      ? 'left-taper-bearing-lining-piece'
      : 'right-taper-bearing-lining-piece';
    journalBox.add(lining);
    return lining;
  });
  const taperGibs = [-1, 1].map((side) => {
    const gib = new THREE.Mesh(
      centeredExtrusion(taperGibShape(
        side,
        gibOuterFace,
        gibInnerTop,
        gibInnerBottom,
        gibTopY,
        gibBottomY,
      ), 0.28, 0),
      boxMaterial,
    );
    gib.position.z = 0.39;
    gib.userData.role = side < 0
      ? 'left-adjustable-taper-gib'
      : 'right-adjustable-taper-gib';
    journalBox.add(gib);
    return gib;
  });
  const clampCaps = [-1, 1].map((side) => {
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.22, 0.34),
      boxMaterial,
    );
    cap.position.set(side * 0.48, 1.02, 0.42);
    cap.userData.role = side < 0
      ? 'left-gib-adjustment-cap'
      : 'right-gib-adjustment-cap';
    journalBox.add(cap);
    return cap;
  });
  const adjustmentScrews = [-1, 1].map((side) => {
    const assembly = new THREE.Group();
    assembly.position.set(side * screwX, screwCenterY, 0.44);
    assembly.userData.axis = Y_AXIS.clone();
    assembly.userData.role = side < 0
      ? 'left-wear-adjustment-screw'
      : 'right-wear-adjustment-screw';
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, screwTravel, 24),
      darkMaterial,
    );
    shaft.position.y = -0.11;
    shaft.userData.role = 'threaded-adjuster-shaft';
    assembly.add(shaft);
    for (let index = -2; index <= 2; index += 1) {
      const thread = new THREE.Mesh(
        new THREE.TorusGeometry(0.072, 0.012, 6, 18),
        brassMaterial,
      );
      thread.rotation.x = Math.PI / 2;
      thread.position.y = index * 0.065 - 0.11;
      thread.userData.role = 'visible-adjustment-screw-thread';
      assembly.add(thread);
    }
    const nut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.13, 6),
      brassMaterial,
    );
    nut.position.y = -0.04;
    nut.userData.role = 'gib-locking-nut';
    assembly.add(nut);
    journalBox.add(assembly);
    return assembly;
  });
  const boxMotionIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.58, 0.035),
    whiteMaterial,
  );
  boxMotionIndex.position.set(gibOuterFace - 0.10, -0.30, 0.60);
  boxMotionIndex.userData.role = 'white-vertical-journal-box-slide-index';
  journalBox.add(boxMotionIndex);
  // Put the finite sliding box inside the crosshead guide faces.
  for (const part of journalBox.children) part.position.z -= 0.28;

  const sourceState = stateAtTime(0);
  const modelToSourcePixel = (point) => new THREE.Vector2(
    point.x / sourceScale + sourceRasterCrankCenter.x,
    sourceRasterCrankCenter.y - point.y / sourceScale,
  );
  const sourceIdealizationPixelErrors = {
    crankCenter: modelToSourcePixel(new THREE.Vector2(0, 0))
      .distanceTo(sourceRasterCrankCenter),
    leftScrew: modelToSourcePixel(new THREE.Vector2(
      sourceState.crankPin.x - screwX,
      sourceState.crankPin.y + screwCenterY,
    )).distanceTo(sourceRasterLeftScrew),
    outerBottomLeft: modelToSourcePixel(new THREE.Vector2(
      sourceState.crossheadX - outerTopHalfWidth,
      outerBottomY,
    )).distanceTo(sourceRasterOuterBottomLeft),
    outerBottomRight: modelToSourcePixel(new THREE.Vector2(
      sourceState.crossheadX + outerTopHalfWidth,
      outerBottomY,
    )).distanceTo(sourceRasterOuterBottomRight),
    outerTopLeft: modelToSourcePixel(new THREE.Vector2(
      sourceState.crossheadX - outerTopHalfWidth,
      outerTopY,
    )).distanceTo(sourceRasterOuterTopLeft),
    outerTopRight: modelToSourcePixel(new THREE.Vector2(
      sourceState.crossheadX + outerTopHalfWidth,
      outerTopY,
    )).distanceTo(sourceRasterOuterTopRight),
    rightScrew: modelToSourcePixel(new THREE.Vector2(
      sourceState.crankPin.x + screwX,
      sourceState.crankPin.y + screwCenterY,
    )).distanceTo(sourceRasterRightScrew),
    slotBottomLeft: modelToSourcePixel(new THREE.Vector2(
      sourceState.crossheadX - slotHalfWidth,
      slotBottomY,
    )).distanceTo(sourceRasterSlotBottomLeft),
    slotBottomRight: modelToSourcePixel(new THREE.Vector2(
      sourceState.crossheadX + slotHalfWidth,
      slotBottomY,
    )).distanceTo(sourceRasterSlotBottomRight),
    slotTopLeft: modelToSourcePixel(new THREE.Vector2(
      sourceState.crossheadX - slotHalfWidth,
      slotTopY,
    )).distanceTo(sourceRasterSlotTopLeft),
    slotTopRight: modelToSourcePixel(new THREE.Vector2(
      sourceState.crossheadX + slotHalfWidth,
      slotTopY,
    )).distanceTo(sourceRasterSlotTopRight),
    wristCenter: modelToSourcePixel(sourceState.crankPin)
      .distanceTo(sourceRasterWristCenter),
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    adjustmentScrews,
    base,
    boxMotionIndex,
    clampCaps,
    crank,
    crankArm,
    crankRotor,
    crankWrist,
    crosshead,
    crossheadBody,
    crossheadMotionIndex,
    crossheadRod,
    fixedCrankBearing,
    guideBlocks,
    guidePosts,
    journalBox,
    leftSlotFace,
    liningPieces,
    mainHub,
    rightSlotFace,
    taperGibs,
    wristFace,
    wristRotationIndex,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    // The output rods deliberately continue beyond the engraved field. Frame
    // the two fixed guide stands and let those otherwise featureless tails
    // leave the view, as Brown's cropped side rods do in the source plate.
    new THREE.Vector3(-4.18, -3.42, -2.05),
    new THREE.Vector3(4.18, 3.44, 2.05),
  );
  root.userData.geometry = {
    boxBottomY,
    boxTopY,
    crankAngularSpeed,
    crankRadius,
    cyclePeriod,
    gibBottomY,
    gibInnerBottom,
    gibInnerTop,
    gibOuterFace,
    gibTopY,
    guideCenterX,
    guideHalfWidth,
    linerInnerRadius,
    linerOuterRadius,
    outerBottomY,
    outerMidHalfWidth,
    outerTopHalfWidth,
    outerTopY,
    rodHalfLength,
    screwCenterY,
    screwTravel,
    screwX,
    slotBottomY,
    slotHalfWidth,
    slotTopY,
    sourceCrankAngle,
    sourceScale,
    wristRadius,
  };
  root.userData.mechanism =
    'one fixed-axis crank carries one crank wrist inside Clayton’s orientation-fixed sliding journal box; the box follows the wrist vertically between two adjustable taper gibs while the surrounding slotted crosshead follows the wrist horizontally, producing one exact Scotch-yoke reciprocation per crank turn';
  root.userData.movement = movement;
  root.userData.sourceAnimation = {
    available: true,
    behaviorReferenced: true,
    independentlyReconstructed: true,
    referenceScope:
      'The official animation confirms one rotating crank, one horizontally translating slotted crosshead, and one non-rotating box translating with the crank wrist. No proprietary animation coordinates were copied; all proportions were remeasured from Brown’s public-domain engraving.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate279: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'one fixed-axis crank and wrist, one horizontally guided slotted crosshead, one orientation-fixed journal box sliding vertically relative to that crosshead, two taper lining pieces, two taper gibs, and two independent wear-adjustment screws',
      measurementUncertaintyPixels: 6,
      rasterCrankCenter: {
        x: sourceRasterCrankCenter.x,
        y: sourceRasterCrankCenter.y,
      },
      rasterLeftScrew: {
        x: sourceRasterLeftScrew.x,
        y: sourceRasterLeftScrew.y,
      },
      rasterOuterBottomLeft: {
        x: sourceRasterOuterBottomLeft.x,
        y: sourceRasterOuterBottomLeft.y,
      },
      rasterOuterBottomRight: {
        x: sourceRasterOuterBottomRight.x,
        y: sourceRasterOuterBottomRight.y,
      },
      rasterOuterTopLeft: {
        x: sourceRasterOuterTopLeft.x,
        y: sourceRasterOuterTopLeft.y,
      },
      rasterOuterTopRight: {
        x: sourceRasterOuterTopRight.x,
        y: sourceRasterOuterTopRight.y,
      },
      rasterRightScrew: {
        x: sourceRasterRightScrew.x,
        y: sourceRasterRightScrew.y,
      },
      rasterSlotBottomLeft: {
        x: sourceRasterSlotBottomLeft.x,
        y: sourceRasterSlotBottomLeft.y,
      },
      rasterSlotBottomRight: {
        x: sourceRasterSlotBottomRight.x,
        y: sourceRasterSlotBottomRight.y,
      },
      rasterSlotTopLeft: {
        x: sourceRasterSlotTopLeft.x,
        y: sourceRasterSlotTopLeft.y,
      },
      rasterSlotTopRight: {
        x: sourceRasterSlotTopRight.x,
        y: sourceRasterSlotTopRight.y,
      },
      rasterWristCenter: {
        x: sourceRasterWristCenter.x,
        y: sourceRasterWristCenter.y,
      },
      sourceIdealizationPixelErrors,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 75,
      edition: 21,
      illustrationPage: 74,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCrankAngle = stateAtCrankAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    crankTurnsPerCycle: 1,
    cyclePeriod,
    sourceTime: 0,
  };
  root.userData.transmission = {
    boxOrientationLaw:
      'journalBoxAngle = 0: the wrist turns inside its bearing while both taper gibs remain parallel to the vertical slot',
    crossheadLaw: 'crossheadX = crankRadius*cos(crankAngle)',
    journalBoxLaw:
      'journalBoxWorld = crankPin and journalBoxRelativeY = crankRadius*sin(crankAngle)',
    outputStroke: 2 * crankRadius,
    stateAtCrankAngle,
    stateAtTime,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    crankRotor.rotation.z = state.crankAngle;
    crank.userData.angularAcceleration = state.angularAcceleration;
    crank.userData.angularSpeed = state.angularSpeed;
    crosshead.position.x = state.crossheadX;
    crosshead.userData.acceleration = new THREE.Vector3(
      state.crossheadAcceleration,
      0,
      0,
    );
    crosshead.userData.velocity = new THREE.Vector3(
      state.crossheadSpeed,
      0,
      0,
    );
    journalBox.position.copy(state.crankPin);
    journalBox.userData.acceleration = state.crankPinAcceleration.clone();
    journalBox.userData.relativeSlide = state.boxRelativeY;
    journalBox.userData.relativeSlideSpeed = state.boxRelativeSpeed;
    journalBox.userData.velocity = state.crankPinVelocity.clone();
    root.userData.contacts = {
      journalWrist: {
        concentricityError: state.bearingConcentricityError,
        radialClearance: state.linerRadialClearance,
        relativeAngularSpeed: -state.angularSpeed,
      },
      leftGibSlot: {
        clearance: state.leftGibClearance,
        relativeSlidingSpeed: state.boxRelativeSpeed,
      },
      rightGibSlot: {
        clearance: state.rightGibClearance,
        relativeSlidingSpeed: state.boxRelativeSpeed,
      },
    };
    root.userData.kinematics = state;
  };

  update(0);
  fitPistonGuide(root, update, cyclePeriod);
  // Brown frames the crosshead yoke closely and breaks both rods off just
  // beyond it; the reconstructed rod guides lie outside that field and are
  // presented away. No phase indices are drawn.
  const whiteIndices = [];
  root.traverse((object) => {
    if (/^white-/.test(object.userData.role ?? '')) whiteIndices.push(object);
  });
  for (const object of whiteIndices) object.removeFromParent();
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.9, outerBottomY - 0.2, -1.0),
    new THREE.Vector3(2.9, outerTopY + 0.2, 1.0),
  );
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(1.2, 0.6, 14),
  };
}

export function createAuthoredSlidingJournalBoxMovement(movement) {
  if (movement.id !== 279) return null;
  const result = claytonSlidingJournalBox(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
