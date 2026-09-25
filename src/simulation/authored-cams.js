import { makeSpringRackCoil } from './spring-rack-coil.js';
import { sphericalFaceFollower } from './spherical-face-follower.js';
import { bowedValveYoke, rectangularGuideShoe } from './reuleaux-yoke-hardware.js';
import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import {makeEccentricStrap} from './eccentric-strap.js';
import {groundBlock} from './ground-block.js';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function finish(root, update, cameraDirection = new THREE.Vector3(6.8, 4.5, 9.4)) {
  root.userData.fidelity = 'authored';
  markShadows(root);
  return { root, update, cameraDirection };
}

function centeredExtrusion(shape, depth, bevel = 0.014) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 48,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function annularHalfShape(innerRadius, outerRadius, side) {
  const startAngle = side === 'right' ? -Math.PI / 2 : Math.PI / 2;
  const endAngle = startAngle + Math.PI;
  const shape = new THREE.Shape();
  shape.moveTo(
    Math.cos(startAngle) * outerRadius,
    Math.sin(startAngle) * outerRadius,
  );
  shape.absarc(0, 0, outerRadius, startAngle, endAngle, false);
  shape.lineTo(
    Math.cos(endAngle) * innerRadius,
    Math.sin(endAngle) * innerRadius,
  );
  shape.absarc(0, 0, innerRadius, endAngle, startAngle, true);
  shape.closePath();
  return shape;
}

function planarRotor() {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.userData.axis = Z_AXIS.clone();
  root.userData.rotor = rotor;
  return root;
}

function boredCylinderAlongZ(radius, length, boreRadius, material, segments = 28) {
  const cylinder = new THREE.Mesh(
    boredLatheGeometry([
      { axial: -length / 2, radial: radius },
      { axial: length / 2, radial: radius },
    ], boreRadius, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
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

function cylinderAlongX(radius, length, material, segments = 24) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function verticalCapsuleRingShape(innerRadius, outerRadius, straightHalfHeight) {
  const shape = new THREE.Shape();
  shape.moveTo(outerRadius, -straightHalfHeight);
  shape.lineTo(outerRadius, straightHalfHeight);
  shape.absarc(
    0,
    straightHalfHeight,
    outerRadius,
    0,
    Math.PI,
    false,
  );
  shape.lineTo(-outerRadius, -straightHalfHeight);
  shape.absarc(
    0,
    -straightHalfHeight,
    outerRadius,
    Math.PI,
    Math.PI * 2,
    false,
  );
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(innerRadius, -straightHalfHeight);
  hole.absarc(
    0,
    -straightHalfHeight,
    innerRadius,
    0,
    -Math.PI,
    true,
  );
  hole.lineTo(-innerRadius, straightHalfHeight);
  hole.absarc(
    0,
    straightHalfHeight,
    innerRadius,
    Math.PI,
    0,
    true,
  );
  hole.lineTo(innerRadius, -straightHalfHeight);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function annularSleeveAlongX({
  innerRadius,
  length,
  material,
  outerRadius,
}) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const sleeve = new THREE.Mesh(
    centeredExtrusion(shape, length, 0.008),
    material,
  );
  sleeve.rotation.y = Math.PI / 2;
  return sleeve;
}

function annularSleeveAlongY({
  innerRadius,
  length,
  material,
  outerRadius,
}) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const sleeve = new THREE.Mesh(
    centeredExtrusion(shape, length, 0.008),
    material,
  );
  sleeve.rotation.x = Math.PI / 2;
  return sleeve;
}

function roundedRectanglePath(
  path,
  halfWidth,
  halfHeight,
  radius,
  clockwise = false,
) {
  if (clockwise) {
    path.moveTo(-halfWidth + radius, -halfHeight);
    path.quadraticCurveTo(
      -halfWidth,
      -halfHeight,
      -halfWidth,
      -halfHeight + radius,
    );
    path.lineTo(-halfWidth, halfHeight - radius);
    path.quadraticCurveTo(
      -halfWidth,
      halfHeight,
      -halfWidth + radius,
      halfHeight,
    );
    path.lineTo(halfWidth - radius, halfHeight);
    path.quadraticCurveTo(
      halfWidth,
      halfHeight,
      halfWidth,
      halfHeight - radius,
    );
    path.lineTo(halfWidth, -halfHeight + radius);
    path.quadraticCurveTo(
      halfWidth,
      -halfHeight,
      halfWidth - radius,
      -halfHeight,
    );
  } else {
    path.moveTo(-halfWidth + radius, -halfHeight);
    path.lineTo(halfWidth - radius, -halfHeight);
    path.quadraticCurveTo(
      halfWidth,
      -halfHeight,
      halfWidth,
      -halfHeight + radius,
    );
    path.lineTo(halfWidth, halfHeight - radius);
    path.quadraticCurveTo(
      halfWidth,
      halfHeight,
      halfWidth - radius,
      halfHeight,
    );
    path.lineTo(-halfWidth + radius, halfHeight);
    path.quadraticCurveTo(
      -halfWidth,
      halfHeight,
      -halfWidth,
      halfHeight - radius,
    );
    path.lineTo(-halfWidth, -halfHeight + radius);
    path.quadraticCurveTo(
      -halfWidth,
      -halfHeight,
      -halfWidth + radius,
      -halfHeight,
    );
  }
  path.closePath();
}

function roundedRectangleRingShape({
  innerCornerRadius,
  innerHalfHeight,
  innerHalfWidth,
  outerCornerRadius,
  outerHalfHeight,
  outerHalfWidth,
}) {
  const shape = new THREE.Shape();
  roundedRectanglePath(
    shape,
    outerHalfWidth,
    outerHalfHeight,
    outerCornerRadius,
  );
  const hole = new THREE.Path();
  roundedRectanglePath(
    hole,
    innerHalfWidth,
    innerHalfHeight,
    innerCornerRadius,
    true,
  );
  shape.holes.push(hole);
  return shape;
}

function eccentricSheaveElongatedTranslatingYoke() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const inputSpeedMagnitude = 0.96;
  const inputAngularSpeed = -inputSpeedMagnitude;
  const cyclePeriod = fullTurn / inputSpeedMagnitude;
  const shaftCenter = new THREE.Vector3(0, 0.34, 0);
  const eccentricity = 0.64;
  const sheaveRadius = 1.18;
  const runningClearance = 0.032;
  const slotInnerRadius = sheaveRadius + runningClearance;
  const linerThickness = 0.065;
  const linerOuterRadius = slotInnerRadius + linerThickness;
  const yokeWallThickness = 0.27;
  const yokeOuterRadius = linerOuterRadius + yokeWallThickness;
  const verticalCenterClearance = 0.08;
  const slotStraightHalfHeight = eccentricity + verticalCenterClearance;
  const sheaveDepth = 0.44;
  const linerDepth = 0.47;
  const yokeDepth = 0.54;
  const shaftRadius = 0.17;
  const shaftLength = 2.25;
  const rodOuterCoordinate = 4.95;
  const rodHeight = 0.23;
  const rodDepth = 0.26;
  const guideCenterCoordinate = 3.92;
  const guideSleeveLength = 0.56;
  const guideInnerRadius = 0.19;
  const guideOuterRadius = 0.36;
  const outputMinimumX = shaftCenter.x - eccentricity;
  const outputMaximumX = shaftCenter.x + eccentricity;
  const outputStroke = outputMaximumX - outputMinimumX;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.62,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.64,
  });
  const linerMaterial = matte(PALETTE.brass, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.5,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });

  const input = planarRotor();
  input.position.copy(shaftCenter);
  input.userData.role = 'continuous-crankshaft-and-eccentric-sheave';
  const inputRotor = input.userData.rotor;

  const inputShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
  );
  inputShaft.userData.role = 'crankshaft-through-elongated-yoke-eccentric';
  inputRotor.add(inputShaft);

  const sheaveBody = cylinderAlongZ(
    sheaveRadius,
    sheaveDepth,
    driverMaterial,
    96,
  );
  sheaveBody.position.x = eccentricity;
  sheaveBody.userData.role = 'circular-eccentric-sheave-inside-capsule-yoke';
  sheaveBody.userData.radius = sheaveRadius;
  inputRotor.add(sheaveBody);

  const sheaveIndicator = new THREE.Mesh(
    new THREE.BoxGeometry(sheaveRadius * 0.68, 0.065, 0.028),
    matte(PALETTE.white, { roughness: 0.48 }),
  );
  sheaveIndicator.position.set(
    eccentricity + sheaveRadius * 0.47,
    0,
    sheaveDepth / 2 + 0.045,
  );
  sheaveIndicator.userData.role = 'rotating-index-on-yoke-driving-sheave';
  inputRotor.add(sheaveIndicator);

  const eccentricCenterMark = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.027, 8, 36),
    matte(PALETTE.white, { roughness: 0.48 }),
  );
  eccentricCenterMark.position.set(
    eccentricity,
    0,
    sheaveDepth / 2 + 0.046,
  );
  eccentricCenterMark.userData.role = 'visible-center-of-yoke-driving-sheave';
  inputRotor.add(eccentricCenterMark);

  const shaftCap = cylinderAlongZ(
    shaftRadius * 1.42,
    0.34,
    darkMaterial,
  );
  shaftCap.position.z = shaftLength / 2 - 0.02;
  shaftCap.userData.role = 'front-cap-at-yoke-crankshaft-center';
  inputRotor.add(shaftCap);

  const shaftKey = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.28, 0.055),
    matte(PALETTE.white, { roughness: 0.48 }),
  );
  shaftKey.position.set(
    0,
    shaftRadius * 0.95,
    shaftLength / 2 + 0.05,
  );
  shaftKey.userData.role = 'yoke-crankshaft-rotation-index';
  inputRotor.add(shaftKey);

  const yoke = new THREE.Group();
  yoke.userData.role = 'nonrotating-elongated-yoke-and-two-sided-rod';
  const yokeBody = new THREE.Mesh(
    centeredExtrusion(
      verticalCapsuleRingShape(
        linerOuterRadius,
        yokeOuterRadius,
        slotStraightHalfHeight,
      ),
      yokeDepth,
    ),
    drivenMaterial,
  );
  yokeBody.userData.role = 'one-piece-elongated-capsule-yoke';
  yoke.add(yokeBody);

  const slotLiner = new THREE.Mesh(
    centeredExtrusion(
      verticalCapsuleRingShape(
        slotInnerRadius,
        linerOuterRadius,
        slotStraightHalfHeight,
      ),
      linerDepth,
      0.006,
    ),
    linerMaterial,
  );
  slotLiner.userData.role = 'close-fitting-liner-of-elongated-yoke-slot';
  yoke.add(slotLiner);

  const rodStartCoordinate = yokeOuterRadius - 0.06;
  const rodLength = rodOuterCoordinate - rodStartCoordinate;
  const leftRod = new THREE.Mesh(
    new THREE.BoxGeometry(rodLength, rodHeight, rodDepth),
    drivenMaterial,
  );
  leftRod.position.x = -(rodStartCoordinate + rodOuterCoordinate) / 2;
  leftRod.userData.role = 'left-guide-rod-rigid-with-elongated-yoke';
  const rightRod = new THREE.Mesh(
    new THREE.BoxGeometry(rodLength, rodHeight, rodDepth),
    drivenMaterial,
  );
  rightRod.position.x = (rodStartCoordinate + rodOuterCoordinate) / 2;
  rightRod.userData.role = 'right-output-rod-rigid-with-elongated-yoke';
  yoke.add(leftRod, rightRod);

  const leftRodEnd = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, rodHeight * 1.22, rodDepth * 1.22),
    darkMaterial,
  );
  leftRodEnd.position.x = -rodOuterCoordinate;
  leftRodEnd.userData.role = 'left-end-index-of-translating-yoke-rod';
  const rightRodEnd = leftRodEnd.clone();
  rightRodEnd.position.x = rodOuterCoordinate;
  rightRodEnd.userData.role = 'right-end-index-of-translating-output-rod';
  yoke.add(leftRodEnd, rightRodEnd);

  const translationIndicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, rodHeight * 1.45, 0.038),
    matte(PALETTE.white, { roughness: 0.48 }),
  );
  translationIndicator.position.set(
    guideCenterCoordinate + 0.62,
    0,
    rodDepth / 2 + 0.03,
  );
  translationIndicator.userData.role = 'translation-index-on-yoke-output-rod';
  yoke.add(translationIndicator);

  const guideSleeves = [-1, 1].map((signX) => {
    const sleeve = annularSleeveAlongX({
      innerRadius: guideInnerRadius,
      length: guideSleeveLength,
      material: frameMaterial,
      outerRadius: guideOuterRadius,
    });
    sleeve.position.set(
      signX * guideCenterCoordinate,
      shaftCenter.y,
      0,
    );
    sleeve.userData.role = 'fixed-annular-guide-for-yoke-rod';
    sleeve.userData.side = signX < 0 ? 'left' : 'right';
    return sleeve;
  });

  const baseY = -2.48;
  const baseZ = -0.78;
  const baseRail = makeBeam(
    new THREE.Vector3(-5.15, baseY, baseZ),
    new THREE.Vector3(5.15, baseY, baseZ),
    { thickness: 0.17, depth: 0.26, color: PALETTE.frame },
  );
  baseRail.userData.role = 'fixed-base-for-elongated-yoke-drive';

  const guideSupports = guideSleeves.map((sleeve) => {
    const support = makeBeam(
      new THREE.Vector3(sleeve.position.x, baseY, baseZ),
      new THREE.Vector3(
        sleeve.position.x,
        shaftCenter.y - guideOuterRadius,
        -0.28,
      ),
      { thickness: 0.14, depth: 0.21, color: PALETTE.frame },
    );
    support.userData.role = 'fixed-post-supporting-yoke-rod-guide';
    support.userData.side = sleeve.userData.side;
    return support;
  });

  const rearBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.075, 10, 36),
    frameMaterial,
  );
  rearBearing.position.set(shaftCenter.x, shaftCenter.y, -0.84);
  rearBearing.userData.role = 'fixed-rear-bearing-of-yoke-crankshaft';
  const supportLegs = [
    makeBeam(
      new THREE.Vector3(shaftCenter.x - 0.92, baseY, -0.84),
      rearBearing.position,
      { thickness: 0.14, depth: 0.2, color: PALETTE.frame },
    ),
    makeBeam(
      new THREE.Vector3(shaftCenter.x + 0.92, baseY, -0.84),
      rearBearing.position,
      { thickness: 0.14, depth: 0.2, color: PALETTE.frame },
    ),
  ];
  for (const support of supportLegs) {
    support.userData.role = 'rear-A-frame-support-of-yoke-crankshaft';
  }

  root.add(
    baseRail,
    ...supportLegs,
    rearBearing,
    ...guideSupports,
    ...guideSleeves,
    input,
    yoke,
  );

  const stateAtTime = (time) => {
    const driverAngle = inputAngularSpeed * time;
    const cosine = Math.cos(driverAngle);
    const sine = Math.sin(driverAngle);
    const eccentricCenter = new THREE.Vector3(
      shaftCenter.x + eccentricity * cosine,
      shaftCenter.y + eccentricity * sine,
      0,
    );
    const yokeCenter = new THREE.Vector3(
      shaftCenter.x + eccentricity * cosine,
      shaftCenter.y,
      0,
    );
    const eccentricVelocity = new THREE.Vector3(
      -eccentricity * sine * inputAngularSpeed,
      eccentricity * cosine * inputAngularSpeed,
      0,
    );
    const outputVelocity = new THREE.Vector3(
      eccentricVelocity.x,
      0,
      0,
    );
    const outputAcceleration = new THREE.Vector3(
      -eccentricity * cosine * inputAngularSpeed ** 2,
      0,
      0,
    );
    const relativeVertical = eccentricCenter.y - yokeCenter.y;
    const leftSheavePoint = new THREE.Vector3(
      eccentricCenter.x - sheaveRadius,
      eccentricCenter.y,
      0,
    );
    const rightSheavePoint = new THREE.Vector3(
      eccentricCenter.x + sheaveRadius,
      eccentricCenter.y,
      0,
    );
    const leftWallPoint = new THREE.Vector3(
      yokeCenter.x - slotInnerRadius,
      eccentricCenter.y,
      0,
    );
    const rightWallPoint = new THREE.Vector3(
      yokeCenter.x + slotInnerRadius,
      eccentricCenter.y,
      0,
    );
    const activeContactSide = Math.abs(outputVelocity.x) > 1e-10
      ? (outputVelocity.x < 0 ? 'left' : 'right')
      : (outputAcceleration.x < 0 ? 'left' : 'right');
    return {
      activeContactSide,
      centerlineError: Math.abs(eccentricCenter.x - yokeCenter.x),
      crankshaftCenter: shaftCenter.clone(),
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      eccentricCenter,
      eccentricVelocity,
      inputRevolutions: driverAngle / fullTurn,
      leftSheavePoint,
      leftSurfaceGap: leftSheavePoint.x - leftWallPoint.x,
      leftWallPoint,
      minimumSlotClearance: runningClearance,
      outputAcceleration,
      outputDisplacement: yokeCenter.x - shaftCenter.x,
      outputVelocity,
      relativeVertical,
      rightSheavePoint,
      rightSurfaceGap: rightWallPoint.x - rightSheavePoint.x,
      rightWallPoint,
      stage: outputVelocity.x < -1e-10
        ? 'elongated-yoke-translates-left'
        : outputVelocity.x > 1e-10
          ? 'elongated-yoke-translates-right'
          : 'elongated-yoke-at-dead-center',
      verticalCapacityClearance: slotStraightHalfHeight
        - Math.abs(relativeVertical),
      yokeAngularSpeed: 0,
      yokeCenter,
      yokeRotation: 0,
    };
  };

  root.userData.mechanism = 'eccentric-sheave-elongated-yoke-linear-slider';
  root.userData.blocks = {
    baseRail,
    eccentricCenterMark,
    guideSleeves,
    guideSupports,
    input,
    inputShaft,
    leftRod,
    leftRodEnd,
    rearBearing,
    rightRod,
    rightRodEnd,
    shaftCap,
    shaftKey,
    sheaveBody,
    sheaveIndicator,
    slotLiner,
    supportLegs,
    translationIndicator,
    yoke,
    yokeBody,
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    baseY,
    cyclePeriod,
    eccentricity,
    fullTurn,
    guideCenterCoordinate,
    guideInnerRadius,
    guideOuterRadius,
    guideSleeveLength,
    inputAngularSpeed,
    inputSpeedMagnitude,
    linerDepth,
    linerOuterRadius,
    linerThickness,
    outputMaximumX,
    outputMinimumX,
    outputStroke,
    rodDepth,
    rodHeight,
    rodOuterCoordinate,
    runningClearance,
    shaftCenter: shaftCenter.clone(),
    shaftLength,
    shaftRadius,
    sheaveDepth,
    sheaveRadius,
    slotInnerRadius,
    slotStraightHalfHeight,
    verticalCenterClearance,
    yokeDepth,
    yokeOuterRadius,
    yokeWallThickness,
  };
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.driverAngle;
    input.userData.angularSpeed = state.driverAngularSpeed;
    yoke.position.copy(state.yokeCenter);
    yoke.rotation.set(0, 0, 0);
    yoke.userData.velocity = state.outputVelocity.clone();
    root.userData.contacts = {
      elongatedSlot: {
        activeSide: state.activeContactSide,
        centerlineError: state.centerlineError,
        left: {
          gap: state.leftSurfaceGap,
          sheavePoint: state.leftSheavePoint.clone(),
          wallPoint: state.leftWallPoint.clone(),
        },
        minimumClearance: state.minimumSlotClearance,
        right: {
          gap: state.rightSurfaceGap,
          sheavePoint: state.rightSheavePoint.clone(),
          wallPoint: state.rightWallPoint.clone(),
        },
        verticalCapacityClearance: state.verticalCapacityClearance,
      },
      fixedGuides: {
        leftRodCenterY: state.yokeCenter.y,
        rightRodCenterY: state.yokeCenter.y,
        rotationError: Math.abs(state.yokeRotation),
        translationAxis: new THREE.Vector3(1, 0, 0),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(7.2, 4.7, 10.6));
}

function triangularEccentricValveMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const inputSpeedMagnitude = 0.88;
  const inputAngularSpeed = -inputSpeedMagnitude;
  const cyclePeriod = fullTurn / inputSpeedMagnitude;
  const shaftCenter = new THREE.Vector3(0, 0.48, 0);

  // Brown's source animation defines this profile with a 6.125-unit
  // constant width and a 1.168309-unit pivot-centered lower arc. Keeping
  // that ratio preserves both the profile and its dwell angles at our scale.
  const sourceProfileWidth = 6.125;
  const sourceSmallArcRadius = 1.168309;
  const profileWidth = 2.9;
  const smallArcRadius = profileWidth
    * sourceSmallArcRadius / sourceProfileWidth;
  const largeArcRadius = profileWidth - smallArcRadius;
  const sideCenterHalfSpacing = profileWidth / 2;
  const sideCenterHeight = Math.sqrt(
    largeArcRadius ** 2 - sideCenterHalfSpacing ** 2,
  );
  const profileJunctionAngle = Math.atan2(
    sideCenterHeight,
    sideCenterHalfSpacing,
  );
  const dwellHalfAngle = Math.PI / 2 - profileJunctionAngle;
  const outputAmplitude = (largeArcRadius - smallArcRadius) / 2;
  const outputStroke = outputAmplitude * 2;
  const runningClearance = 0.032;
  const railHalfSpacing = profileWidth / 2 + runningClearance;

  const camDepth = 0.5;
  const followerDepth = 0.64;
  const linerDepth = 0.57;
  const linerThickness = 0.085;
  const frameWallThickness = 0.31;
  const innerCornerRadius = 0.22;
  const innerHalfWidth = largeArcRadius + 0.32;
  const bodyHoleHalfHeight = railHalfSpacing + linerThickness;
  const outerHalfWidth = innerHalfWidth + frameWallThickness;
  const outerHalfHeight = bodyHoleHalfHeight + frameWallThickness;
  const outerCornerRadius = innerCornerRadius + frameWallThickness;
  const linerStraightHalfWidth = innerHalfWidth - innerCornerRadius;

  const shaftRadius = 0.17;
  const shaftLength = 2.35;
  const rodRadius = 0.145;
  const rodAttachmentCoordinate = outerHalfHeight - 0.08;
  const rodOuterCoordinate = 4.8;
  const rodLength = rodOuterCoordinate - rodAttachmentCoordinate;
  const guideCenterCoordinate = 3.45;
  const guideSleeveLength = 0.68;
  const guideInnerRadius = rodRadius + 0.04;
  const guideOuterRadius = 0.34;
  const baseY = shaftCenter.y - 6.05;
  const baseZ = -0.88;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.62,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.64,
  });
  const linerMaterial = matte(PALETTE.brass, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.5,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const witnessMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const upperRightJunction = new THREE.Vector2(
    sideCenterHalfSpacing,
    sideCenterHeight,
  );
  const upperLeftJunction = new THREE.Vector2(
    -sideCenterHalfSpacing,
    sideCenterHeight,
  );
  const profileArcs = [
    {
      center: new THREE.Vector2(0, 0),
      endAngle: Math.PI - profileJunctionAngle,
      name: 'upper-pivot-centered-arc',
      radius: largeArcRadius,
      startAngle: profileJunctionAngle,
    },
    {
      center: upperRightJunction.clone(),
      endAngle: Math.PI + profileJunctionAngle,
      name: 'left-side-arc',
      radius: profileWidth,
      startAngle: Math.PI,
    },
    {
      center: new THREE.Vector2(0, 0),
      endAngle: fullTurn - profileJunctionAngle,
      name: 'lower-pivot-centered-arc',
      radius: smallArcRadius,
      startAngle: Math.PI + profileJunctionAngle,
    },
    {
      center: upperLeftJunction.clone(),
      endAngle: fullTurn,
      name: 'right-side-arc',
      radius: profileWidth,
      startAngle: fullTurn - profileJunctionAngle,
    },
  ];

  const profileShape = new THREE.Shape();
  profileShape.moveTo(
    Math.cos(profileJunctionAngle) * largeArcRadius,
    Math.sin(profileJunctionAngle) * largeArcRadius,
  );
  for (const arc of profileArcs) {
    profileShape.absarc(
      arc.center.x,
      arc.center.y,
      arc.radius,
      arc.startAngle,
      arc.endAngle,
      false,
    );
  }
  profileShape.closePath();

  const input = planarRotor();
  input.position.copy(shaftCenter);
  input.userData.role = 'continuous-crankshaft-and-triangular-eccentric';
  const inputRotor = input.userData.rotor;

  const camBody = new THREE.Mesh(
    centeredExtrusion(profileShape, camDepth, 0.006),
    driverMaterial,
  );
  camBody.userData.role = 'constant-width-rounded-triangular-eccentric';
  inputRotor.add(camBody);

  const inputShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
  );
  inputShaft.userData.role = 'shaft-through-small-arc-center';
  inputRotor.add(inputShaft);

  const shaftHub = cylinderAlongZ(
    shaftRadius * 1.7,
    camDepth + 0.18,
    darkMaterial,
    36,
  );
  shaftHub.userData.role = 'hub-at-triangular-eccentric-pivot';
  inputRotor.add(shaftHub);

  const camFaceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, largeArcRadius * 0.62, 0.032),
    witnessMaterial,
  );
  camFaceIndex.position.set(
    0,
    largeArcRadius * 0.41,
    camDepth / 2 + 0.042,
  );
  camFaceIndex.userData.role = 'rotation-index-on-triangular-eccentric';
  inputRotor.add(camFaceIndex);

  const follower = new THREE.Group();
  follower.userData.role = 'nonrotating-two-rail-valve-frame';
  const followerBody = new THREE.Mesh(
    centeredExtrusion(
      roundedRectangleRingShape({
        innerCornerRadius,
        innerHalfHeight: bodyHoleHalfHeight,
        innerHalfWidth,
        outerCornerRadius,
        outerHalfHeight,
        outerHalfWidth,
      }),
      followerDepth,
      0.012,
    ),
    drivenMaterial,
  );
  followerBody.userData.role = 'one-piece-translating-follower-frame';
  follower.add(followerBody);

  const lowerRailLiner = new THREE.Mesh(
    new THREE.BoxGeometry(
      linerStraightHalfWidth * 2,
      linerThickness,
      linerDepth,
    ),
    linerMaterial,
  );
  lowerRailLiner.position.y = -railHalfSpacing - linerThickness / 2;
  lowerRailLiner.userData.role = 'lower-horizontal-cam-contact-rail';
  lowerRailLiner.userData.side = 'lower';
  const upperRailLiner = lowerRailLiner.clone();
  upperRailLiner.position.y = railHalfSpacing + linerThickness / 2;
  upperRailLiner.userData.role = 'upper-horizontal-cam-contact-rail';
  upperRailLiner.userData.side = 'upper';
  follower.add(lowerRailLiner, upperRailLiner);

  const lowerRod = new THREE.Mesh(
    new THREE.CylinderGeometry(rodRadius, rodRadius, rodLength, 28),
    drivenMaterial,
  );
  lowerRod.position.y = -(rodAttachmentCoordinate + rodOuterCoordinate) / 2;
  lowerRod.userData.role = 'lower-valve-rod-rigid-with-follower-frame';
  const upperRod = lowerRod.clone();
  upperRod.position.y = (rodAttachmentCoordinate + rodOuterCoordinate) / 2;
  upperRod.userData.role = 'upper-valve-rod-rigid-with-follower-frame';
  follower.add(lowerRod, upperRod);

  const lowerRodEnd = new THREE.Mesh(
    new THREE.CylinderGeometry(
      rodRadius * 1.28,
      rodRadius * 1.28,
      0.13,
      28,
    ),
    darkMaterial,
  );
  lowerRodEnd.position.y = -rodOuterCoordinate;
  lowerRodEnd.userData.role = 'lower-end-index-of-valve-rod';
  const upperRodEnd = lowerRodEnd.clone();
  upperRodEnd.position.y = rodOuterCoordinate;
  upperRodEnd.userData.role = 'upper-end-index-of-valve-rod';
  follower.add(lowerRodEnd, upperRodEnd);

  const translationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(rodRadius * 2.5, 0.075, 0.04),
    witnessMaterial,
  );
  translationIndex.position.set(
    0,
    guideCenterCoordinate + 0.62,
    rodRadius + 0.045,
  );
  translationIndex.userData.role = 'translation-index-on-valve-rod';
  follower.add(translationIndex);

  const guideSleeves = [-1, 1].map((signY) => {
    const sleeve = annularSleeveAlongY({
      innerRadius: guideInnerRadius,
      length: guideSleeveLength,
      material: frameMaterial,
      outerRadius: guideOuterRadius,
    });
    sleeve.position.set(
      shaftCenter.x,
      shaftCenter.y + signY * guideCenterCoordinate,
      0,
    );
    sleeve.userData.role = 'fixed-annular-guide-for-valve-rod';
    sleeve.userData.side = signY < 0 ? 'lower' : 'upper';
    return sleeve;
  });

  const upperContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 18, 12),
    witnessMaterial,
  );
  upperContactMarker.userData.role = 'upper-moving-contact-witness';
  const lowerContactMarker = upperContactMarker.clone();
  lowerContactMarker.userData.role = 'lower-moving-contact-witness';

  const baseRail = makeBeam(
    new THREE.Vector3(-3.75, baseY, baseZ),
    new THREE.Vector3(3.75, baseY, baseZ),
    { thickness: 0.18, depth: 0.28, color: PALETTE.frame },
  );
  baseRail.userData.role = 'fixed-base-of-triangular-eccentric-drive';

  const backPostX = 3.35;
  const backPostTopY = shaftCenter.y + 5.05;
  const backPosts = [-1, 1].map((signX) => {
    const post = makeBeam(
      new THREE.Vector3(signX * backPostX, baseY, baseZ),
      new THREE.Vector3(signX * backPostX, backPostTopY, baseZ),
      { thickness: 0.14, depth: 0.22, color: PALETTE.frame },
    );
    post.userData.role = 'fixed-rear-guide-support-post';
    post.userData.side = signX < 0 ? 'left' : 'right';
    return post;
  });

  const guideCrossbars = guideSleeves.map((sleeve) => {
    const crossbar = makeBeam(
      new THREE.Vector3(-backPostX, sleeve.position.y, baseZ),
      new THREE.Vector3(backPostX, sleeve.position.y, baseZ),
      { thickness: 0.14, depth: 0.22, color: PALETTE.frame },
    );
    crossbar.userData.role = 'fixed-crossbar-supporting-valve-rod-guide';
    crossbar.userData.side = sleeve.userData.side;
    return crossbar;
  });

  const guideBrackets = guideSleeves.map((sleeve) => {
    const bracket = makeBeam(
      new THREE.Vector3(0, sleeve.position.y, baseZ),
      new THREE.Vector3(0, sleeve.position.y, -guideOuterRadius),
      { thickness: 0.13, depth: 0.2, color: PALETTE.frame },
    );
    bracket.userData.role = 'rear-bracket-of-valve-rod-guide';
    bracket.userData.side = sleeve.userData.side;
    return bracket;
  });

  const rearBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.078, 10, 40),
    frameMaterial,
  );
  rearBearing.position.set(shaftCenter.x, shaftCenter.y, baseZ);
  rearBearing.userData.role = 'fixed-rear-bearing-of-triangular-eccentric';
  const bearingSupports = [-1, 1].map((signX) => {
    const support = makeBeam(
      new THREE.Vector3(signX * 1.24, baseY, baseZ),
      rearBearing.position,
      { thickness: 0.15, depth: 0.22, color: PALETTE.frame },
    );
    support.userData.role = 'rear-A-frame-support-of-eccentric-shaft';
    return support;
  });

  root.add(
    baseRail,
    ...backPosts,
    ...guideCrossbars,
    ...guideBrackets,
    ...bearingSupports,
    rearBearing,
    ...guideSleeves,
    input,
    follower,
    lowerContactMarker,
    upperContactMarker,
  );

  const positiveModulo = (value, modulus) => {
    const remainder = value % modulus;
    return remainder < 0 ? remainder + modulus : remainder;
  };
  const pointOnArc = (arc, angle) => new THREE.Vector2(
    arc.center.x + arc.radius * Math.cos(angle),
    arc.center.y + arc.radius * Math.sin(angle),
  );
  const angleOnArc = (angle, arc) => (
    angle >= arc.startAngle - 1e-12
      && angle <= arc.endAngle + 1e-12
  );
  const profileExtremeAtAngle = (driverAngle, maximize) => {
    const direction = new THREE.Vector2(
      Math.sin(driverAngle),
      Math.cos(driverAngle),
    );
    const directionAngle = positiveModulo(
      Math.atan2(direction.y, direction.x) + (maximize ? 0 : Math.PI),
      fullTurn,
    );
    let best = null;
    for (const arc of profileArcs) {
      const candidates = [];
      if (angleOnArc(directionAngle, arc)) {
        candidates.push({ angle: directionAngle, followsArc: true });
      }
      candidates.push(
        { angle: arc.startAngle, followsArc: false },
        { angle: arc.endAngle, followsArc: false },
      );
      for (const candidate of candidates) {
        const point = pointOnArc(arc, candidate.angle);
        const value = point.dot(direction);
        const isBetter = best === null || (maximize
          ? value > best.value + 1e-11
          : value < best.value - 1e-11);
        if (!isBetter) continue;
        const derivativeAnchor = candidate.followsArc
          ? arc.center
          : point;
        best = {
          angle: candidate.angle,
          derivative: derivativeAnchor.x * Math.cos(driverAngle)
            - derivativeAnchor.y * Math.sin(driverAngle),
          secondDerivative: -derivativeAnchor.x * Math.sin(driverAngle)
            - derivativeAnchor.y * Math.cos(driverAngle),
          followsArc: candidate.followsArc,
          localPoint: point,
          segment: arc.name,
          value,
        };
      }
    }
    return best;
  };
  const localToWorld = (point, driverAngle) => new THREE.Vector3(
    shaftCenter.x + point.x * Math.cos(driverAngle)
      - point.y * Math.sin(driverAngle),
    shaftCenter.y + point.x * Math.sin(driverAngle)
      + point.y * Math.cos(driverAngle),
    0,
  );

  const stateAtTime = (time) => {
    const driverAngle = inputAngularSpeed * time;
    const normalizedDriverAngle = positiveModulo(driverAngle, fullTurn);
    const lowerExtreme = profileExtremeAtAngle(driverAngle, false);
    const upperExtreme = profileExtremeAtAngle(driverAngle, true);
    const supportWidth = upperExtreme.value - lowerExtreme.value;
    const outputDisplacement = (
      lowerExtreme.value + upperExtreme.value
    ) / 2;
    const displacementDerivative = (
      lowerExtreme.derivative + upperExtreme.derivative
    ) / 2;
    const displacementSecondDerivative = (
      lowerExtreme.secondDerivative + upperExtreme.secondDerivative
    ) / 2;
    const followerCenter = new THREE.Vector3(
      shaftCenter.x,
      shaftCenter.y + outputDisplacement,
      0,
    );
    const outputVelocity = new THREE.Vector3(
      0,
      displacementDerivative * inputAngularSpeed,
      0,
    );
    const outputAcceleration = new THREE.Vector3(
      0,
      displacementSecondDerivative * inputAngularSpeed ** 2,
      0,
    );
    const lowerCamPoint = localToWorld(
      lowerExtreme.localPoint,
      driverAngle,
    );
    const upperCamPoint = localToWorld(
      upperExtreme.localPoint,
      driverAngle,
    );
    const lowerRailY = followerCenter.y - railHalfSpacing;
    const upperRailY = followerCenter.y + railHalfSpacing;
    const lowerRailPoint = new THREE.Vector3(
      lowerCamPoint.x,
      lowerRailY,
      0,
    );
    const upperRailPoint = new THREE.Vector3(
      upperCamPoint.x,
      upperRailY,
      0,
    );
    const lowerWitnessPoint = lowerCamPoint.clone().lerp(
      lowerRailPoint,
      0.5,
    );
    const upperWitnessPoint = upperCamPoint.clone().lerp(
      upperRailPoint,
      0.5,
    );
    lowerWitnessPoint.z = followerDepth / 2 + 0.085;
    upperWitnessPoint.z = followerDepth / 2 + 0.085;
    const upperDwell = normalizedDriverAngle <= dwellHalfAngle + 1e-12
      || normalizedDriverAngle >= fullTurn - dwellHalfAngle - 1e-12;
    const lowerDwell = Math.abs(normalizedDriverAngle - Math.PI)
      <= dwellHalfAngle + 1e-12;
    const stage = upperDwell
      ? 'upper-valve-dwell'
      : lowerDwell
        ? 'lower-valve-dwell'
        : outputVelocity.y > 0
          ? 'valve-frame-translates-up'
          : 'valve-frame-translates-down';
    return {
      activeProfileSegments: {
        lower: lowerExtreme.segment,
        upper: upperExtreme.segment,
      },
      camCenter: shaftCenter.clone(),
      constantWidthError: Math.abs(supportWidth - profileWidth),
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      dwell: upperDwell || lowerDwell,
      followerAngularSpeed: 0,
      followerCenter,
      followerRotation: 0,
      inputRevolutions: driverAngle / fullTurn,
      lowerCamPoint,
      lowerRailGap: lowerCamPoint.y - lowerRailY,
      lowerRailPoint,
      lowerRailY,
      lowerSupport: lowerExtreme.value,
      lowerWitnessPoint,
      normalizedDriverAngle,
      outputAcceleration,
      outputDisplacement,
      outputVelocity,
      railContactAlignmentError: Math.abs(
        lowerCamPoint.x - upperCamPoint.x,
      ),
      stage,
      supportWidth,
      upperCamPoint,
      upperRailGap: upperRailY - upperCamPoint.y,
      upperRailPoint,
      upperRailY,
      upperSupport: upperExtreme.value,
      upperWitnessPoint,
    };
  };

  root.userData.mechanism = 'triangular-eccentric-constant-width-dwell-slider';
  root.userData.cameraDistanceScale = 1.12;
  root.userData.blocks = {
    backPosts,
    baseRail,
    bearingSupports,
    camBody,
    camFaceIndex,
    follower,
    followerBody,
    guideBrackets,
    guideCrossbars,
    guideSleeves,
    input,
    inputShaft,
    lowerContactMarker,
    lowerRailLiner,
    lowerRod,
    lowerRodEnd,
    rearBearing,
    shaftHub,
    translationIndex,
    upperContactMarker,
    upperRailLiner,
    upperRod,
    upperRodEnd,
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    baseY,
    bodyHoleHalfHeight,
    camDepth,
    cyclePeriod,
    dwellAngularSpan: dwellHalfAngle * 2,
    dwellFractionPerStop: dwellHalfAngle / Math.PI,
    dwellHalfAngle,
    followerDepth,
    frameWallThickness,
    fullTurn,
    guideCenterCoordinate,
    guideInnerRadius,
    guideOuterRadius,
    guideSleeveLength,
    innerCornerRadius,
    innerHalfWidth,
    inputAngularSpeed,
    inputSpeedMagnitude,
    largeArcRadius,
    linerDepth,
    linerStraightHalfWidth,
    linerThickness,
    outerCornerRadius,
    outerHalfHeight,
    outerHalfWidth,
    outputAmplitude,
    outputMaximumY: shaftCenter.y + outputAmplitude,
    outputMinimumY: shaftCenter.y - outputAmplitude,
    outputStroke,
    profileArcs: profileArcs.map((arc) => ({
      ...arc,
      center: arc.center.clone(),
    })),
    profileJunctionAngle,
    profileWidth,
    railHalfSpacing,
    rodAttachmentCoordinate,
    rodLength,
    rodOuterCoordinate,
    rodRadius,
    runningClearance,
    shaftCenter: shaftCenter.clone(),
    shaftLength,
    shaftRadius,
    sideCenterHalfSpacing,
    sideCenterHeight,
    smallArcRadius,
    sourceProfileWidth,
    sourceSmallArcRadius,
  };
  root.userData.profileExtremeAtAngle = profileExtremeAtAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.driverAngle;
    input.userData.angularSpeed = state.driverAngularSpeed;
    follower.position.copy(state.followerCenter);
    follower.rotation.set(0, 0, 0);
    follower.userData.velocity = state.outputVelocity.clone();
    lowerContactMarker.position.copy(state.lowerWitnessPoint);
    upperContactMarker.position.copy(state.upperWitnessPoint);
    root.userData.contacts = {
      constantWidthRails: {
        alignmentError: state.railContactAlignmentError,
        lower: {
          camPoint: state.lowerCamPoint.clone(),
          gap: state.lowerRailGap,
          railPoint: state.lowerRailPoint.clone(),
          segment: state.activeProfileSegments.lower,
        },
        supportWidth: state.supportWidth,
        upper: {
          camPoint: state.upperCamPoint.clone(),
          gap: state.upperRailGap,
          railPoint: state.upperRailPoint.clone(),
          segment: state.activeProfileSegments.upper,
        },
        widthError: state.constantWidthError,
      },
      fixedGuides: {
        axis: new THREE.Vector3(0, 1, 0),
        followerRotationError: Math.abs(state.followerRotation),
        rodCenterX: state.followerCenter.x,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(7.8, 2.4, 11.2));
}

function heartCamUniformTraverseMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.55;
  const sourceMinimumPitchRadius = 1.25;
  const sourceMaximumPitchRadius = 5;
  const sourceRollerRadius = 0.25;
  const sourceHubRadius = 1;
  const sourceShaftRadius = 0.5;
  const minimumPitchRadius = sourceMinimumPitchRadius * sourceScale;
  const maximumPitchRadius = sourceMaximumPitchRadius * sourceScale;
  const rollerRadius = sourceRollerRadius * sourceScale;
  const hubRadius = sourceHubRadius * sourceScale;
  const shaftRadius = sourceShaftRadius * sourceScale;
  const idealOutputStroke = maximumPitchRadius - minimumPitchRadius;
  const uniformLiftPerRadian = idealOutputStroke / Math.PI;
  const inputSpeedMagnitude = 0.72;
  const inputAngularSpeed = -inputSpeedMagnitude;
  const cyclePeriod = fullTurn / inputSpeedMagnitude;
  const sourcePoseAngle = 0;
  const shaftCenter = new THREE.Vector3(0, 0, 0);
  const camDepth = 0.3;
  const camFrontZ = camDepth / 2;
  const shaftLength = 1.75;
  const shaftCenterZ = -0.31;
  const hubDepth = 0.48;
  const rollerDepth = 0.46;
  const rollerCenterZ = 0.1;
  const rollerHubRadius = rollerRadius * 0.42;
  const followerBarStart = -0.04;
  const followerBarEnd = 4.9;
  const followerBarLength = followerBarEnd - followerBarStart;
  const followerBarCenterOffset = (followerBarStart + followerBarEnd) / 2;
  const followerBarHalfHeight = 0.1;
  const followerBarHalfDepth = 0.08;
  const followerBarZ = 0.24;
  const followerGuideClearance = 0.025;
  const guideInnerHalfHeight = followerBarHalfHeight + followerGuideClearance;
  const guideInnerHalfDepth = followerBarHalfDepth + followerGuideClearance;
  const guideOuterHalfHeight = 0.28;
  const guideOuterHalfDepth = 0.25;
  const guideLength = 0.34;
  const guideCentersX = [4.25, 4.95];
  const bearingCenterZ = -0.79;
  const bearingInnerRadius = shaftRadius + 0.027;
  const bearingOuterRadius = 0.47;
  const framePostX = 5.66;
  const frameZ = -0.8;
  const frameTopY = 1.82;
  const baseY = -3.16;
  const constructionDivisionCount = 6;
  const constructionRadialDivisionCount = constructionDivisionCount * 2;
  const profileBranchSegments = 480;
  const profileInnerArcSegments = 48;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.62,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.5,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const branchProfilePoint = (angle, pitchRadiusDerivative) => {
    const pitchRadius = angle <= Math.PI
      ? minimumPitchRadius + uniformLiftPerRadian * angle
      : minimumPitchRadius
        + uniformLiftPerRadian * (fullTurn - angle);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const pitchPoint = new THREE.Vector2(
      pitchRadius * cosine,
      -pitchRadius * sine,
    );
    const pitchTangent = new THREE.Vector2(
      pitchRadiusDerivative * cosine - pitchRadius * sine,
      -pitchRadiusDerivative * sine - pitchRadius * cosine,
    );
    const contactNormal = new THREE.Vector2(
      pitchTangent.y,
      -pitchTangent.x,
    ).normalize();
    return {
      angle,
      contactNormal,
      pitchPoint,
      pitchRadius,
      pitchRadiusDerivative,
      pitchTangent,
      point: pitchPoint.clone().addScaledVector(contactNormal, rollerRadius),
    };
  };

  let tipSearchLower = Math.PI * 0.8;
  let tipSearchUpper = Math.PI;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const midpoint = (tipSearchLower + tipSearchUpper) / 2;
    if (branchProfilePoint(midpoint, uniformLiftPerRadian).point.y < 0) {
      tipSearchLower = midpoint;
    } else {
      tipSearchUpper = midpoint;
    }
  }
  const outerTipApproachAngle = (tipSearchLower + tipSearchUpper) / 2;
  const outerTipUndercutHalfAngle = Math.PI - outerTipApproachAngle;
  const outerTipLocal = branchProfilePoint(
    outerTipApproachAngle,
    uniformLiftPerRadian,
  ).point;
  outerTipLocal.y = 0;
  const outerTipRadius = -outerTipLocal.x;
  const actualMaximumFollowerRadius = outerTipRadius + rollerRadius;
  const actualOutputStroke = actualMaximumFollowerRadius - minimumPitchRadius;
  const outerTipUndercut = maximumPitchRadius
    - actualMaximumFollowerRadius;

  const firstProfileBranch = [];
  for (let segment = 0; segment <= profileBranchSegments; segment += 1) {
    const angle = segment / profileBranchSegments * outerTipApproachAngle;
    firstProfileBranch.push(
      branchProfilePoint(angle, uniformLiftPerRadian).point,
    );
  }
  firstProfileBranch.at(-1).copy(outerTipLocal);

  const secondProfileBranch = [];
  const secondBranchStartAngle = fullTurn - outerTipApproachAngle;
  for (let segment = 0; segment <= profileBranchSegments; segment += 1) {
    const angle = secondBranchStartAngle
      + segment / profileBranchSegments * outerTipApproachAngle;
    secondProfileBranch.push(
      branchProfilePoint(angle, -uniformLiftPerRadian).point,
    );
  }
  secondProfileBranch[0].copy(outerTipLocal);

  const innerArcCenter = new THREE.Vector2(minimumPitchRadius, 0);
  const innerArcStartVector = secondProfileBranch.at(-1).clone()
    .sub(innerArcCenter);
  const innerArcEndVector = firstProfileBranch[0].clone()
    .sub(innerArcCenter);
  const innerArcStartAngle = Math.atan2(
    innerArcStartVector.y,
    innerArcStartVector.x,
  );
  let innerArcEndAngle = Math.atan2(
    innerArcEndVector.y,
    innerArcEndVector.x,
  );
  if (innerArcEndAngle < innerArcStartAngle) innerArcEndAngle += fullTurn;
  const innerReversalArc = [];
  for (let segment = 1; segment < profileInnerArcSegments; segment += 1) {
    const angle = THREE.MathUtils.lerp(
      innerArcStartAngle,
      innerArcEndAngle,
      segment / profileInnerArcSegments,
    );
    innerReversalArc.push(new THREE.Vector2(
      innerArcCenter.x + rollerRadius * Math.cos(angle),
      innerArcCenter.y + rollerRadius * Math.sin(angle),
    ));
  }

  const profilePoints = [
    ...firstProfileBranch.map((point) => point.clone()),
    ...secondProfileBranch.slice(1).map((point) => point.clone()),
    ...innerReversalArc,
  ];
  const profileShape = new THREE.Shape();
  profileShape.moveTo(profilePoints[0].x, profilePoints[0].y);
  for (const point of profilePoints.slice(1)) {
    profileShape.lineTo(point.x, point.y);
  }
  profileShape.closePath();

  const constructionCircleRadii = Array.from(
    { length: constructionDivisionCount + 1 },
    (_, index) => minimumPitchRadius
      + index / constructionDivisionCount * idealOutputStroke,
  );
  const constructionRadialAngles = Array.from(
    { length: constructionRadialDivisionCount },
    (_, index) => index / constructionRadialDivisionCount * fullTurn,
  );

  const input = planarRotor();
  input.position.copy(shaftCenter);
  input.userData.role = 'upright-view-shaft-with-rigid-heart-cam';
  const inputRotor = input.userData.rotor;

  const camGeometry = new THREE.ExtrudeGeometry(profileShape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth: camDepth,
  });
  camGeometry.translate(0, 0, -camDepth / 2);
  const camBody = new THREE.Mesh(camGeometry, driverMaterial);
  camBody.userData.role = 'roller-envelope-heart-cam-for-uniform-traverse';
  camBody.userData.profileShape = profileShape;
  inputRotor.add(camBody);

  const shaftHub = cylinderAlongZ(
    hubRadius,
    hubDepth,
    driverMaterial,
    52,
  );
  shaftHub.position.z = 0.015;
  shaftHub.userData.role = 'source-proportioned-hub-rigid-with-heart-cam';
  inputRotor.add(shaftHub);

  const inputShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
    44,
  );
  inputShaft.position.z = shaftCenterZ;
  inputShaft.userData.role = 'input-shaft-through-heart-cam-center';
  inputRotor.add(inputShaft);

  const camRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.065, 0.035),
    indexMaterial,
  );
  camRotationIndex.position.set(
    -outerTipRadius * 0.68,
    0,
    camFrontZ + 0.035,
  );
  camRotationIndex.userData.role = 'rotation-index-on-heart-cam-face';
  inputRotor.add(camRotationIndex);

  const follower = new THREE.Group();
  follower.userData.role = 'nonrotating-horizontal-roller-follower-bar';

  const rollerRotor = new THREE.Group();
  rollerRotor.position.z = rollerCenterZ;
  rollerRotor.userData.role = 'freely-rolling-follower-nose';
  const followerRoller = cylinderAlongZ(
    rollerRadius,
    rollerDepth,
    drivenMaterial,
    44,
  );
  followerRoller.userData.role = 'source-quarter-radius-roller-follower';
  const rollerHub = cylinderAlongZ(
    rollerHubRadius,
    rollerDepth + 0.08,
    darkMaterial,
    32,
  );
  rollerHub.userData.role = 'roller-cross-pin-rigid-with-follower-bar';
  const rollerRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, rollerRadius * 0.72, 0.028),
    indexMaterial,
  );
  rollerRotationIndex.position.set(
    0,
    rollerRadius * 0.5,
    rollerDepth / 2 + 0.028,
  );
  rollerRotationIndex.userData.role = 'rolling-speed-index-on-follower-nose';
  rollerHub.position.z = rollerCenterZ;
  rollerRotor.add(followerRoller, rollerRotationIndex);

  const followerBar = new THREE.Mesh(
    new THREE.BoxGeometry(
      followerBarLength,
      followerBarHalfHeight * 2,
      followerBarHalfDepth * 2,
    ),
    drivenMaterial,
  );
  followerBar.position.set(followerBarCenterOffset, 0, followerBarZ);
  followerBar.userData.role = 'horizontal-output-bar-rigid-with-roller-pin';

  const translationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, followerBarHalfHeight * 2 + 0.012, 0.025),
    indexMaterial,
  );
  translationIndex.position.set(2.9, 0, followerBarZ + followerBarHalfDepth + 0.018);
  translationIndex.userData.role = 'translation-index-on-horizontal-output-bar';
  follower.add(rollerRotor, rollerHub, followerBar, translationIndex);

  const followerGuides = guideCentersX.map((centerX, index) => {
    const guide = new THREE.Mesh(
      centeredExtrusion(
        roundedRectangleRingShape({
          innerCornerRadius: 0.045,
          innerHalfHeight: guideInnerHalfHeight,
          innerHalfWidth: guideInnerHalfDepth,
          outerCornerRadius: 0.075,
          outerHalfHeight: guideOuterHalfHeight,
          outerHalfWidth: guideOuterHalfDepth,
        }),
        guideLength,
        0.006,
      ),
      frameMaterial,
    );
    guide.rotation.y = Math.PI / 2;
    guide.position.set(centerX, 0, followerBarZ);
    guide.userData.role = 'fixed-rectangular-guide-for-horizontal-output-bar';
    guide.userData.index = index;
    return guide;
  });

  const shaftBearing = new THREE.Mesh(
    new THREE.TorusGeometry(
      (bearingInnerRadius + bearingOuterRadius) / 2,
      (bearingOuterRadius - bearingInnerRadius) / 2,
      14,
      52,
    ),
    frameMaterial,
  );
  shaftBearing.position.copy(shaftCenter).setZ(bearingCenterZ);
  shaftBearing.userData.role = 'fixed-rear-bearing-for-heart-cam-shaft';

  const baseRail = makeBeam(
    new THREE.Vector3(-1.25, baseY, frameZ),
    new THREE.Vector3(framePostX + 0.35, baseY, frameZ),
    { thickness: 0.18, depth: 0.28, color: PALETTE.frame },
  );
  baseRail.userData.role = 'fixed-base-of-heart-cam-demonstrator';

  const framePost = makeBeam(
    new THREE.Vector3(framePostX, baseY, frameZ),
    new THREE.Vector3(framePostX, frameTopY, frameZ),
    { thickness: 0.18, depth: 0.27, color: PALETTE.frame },
  );
  framePost.userData.role = 'fixed-side-post-supporting-shaft-and-bar-guides';

  const bearingBracket = makeBeam(
    new THREE.Vector3(framePostX, -2.64, frameZ),
    new THREE.Vector3(bearingOuterRadius * 0.8, -0.18, frameZ),
    { thickness: 0.15, depth: 0.22, color: PALETTE.frame },
  );
  bearingBracket.userData.role = 'fixed-bracket-supporting-heart-cam-bearing';

  const guideBrackets = followerGuides.map((guide, index) => {
    const signY = index === 0 ? 1 : -1;
    const bracket = makeBeam(
      new THREE.Vector3(
        framePostX,
        signY * (0.46 + index * 0.1),
        frameZ,
      ),
      new THREE.Vector3(
        guide.position.x,
        signY * guideOuterHalfHeight,
        followerBarZ - guideOuterHalfDepth,
      ),
      { thickness: 0.12, depth: 0.18, color: PALETTE.frame },
    );
    bracket.userData.role = 'fixed-bracket-supporting-horizontal-bar-guide';
    bracket.userData.index = index;
    return bracket;
  });

  root.add(
    baseRail,
    framePost,
    bearingBracket,
    ...guideBrackets,
    shaftBearing,
    ...followerGuides,
    input,
    follower,
  );

  const contactGeometryAtDriverAngle = (driverAngle) => {
    const normalizedDriverAngle = THREE.MathUtils.euclideanModulo(
      driverAngle,
      fullTurn,
    );
    const idealAngularLift = normalizedDriverAngle <= Math.PI
      ? normalizedDriverAngle
      : fullTurn - normalizedDriverAngle;
    const idealFollowerRadius = minimumPitchRadius
      + uniformLiftPerRadian * idealAngularLift;
    const outerTipAngularDistance = Math.abs(
      normalizedDriverAngle - Math.PI,
    );
    const onOuterTip = outerTipAngularDistance
      < outerTipUndercutHalfAngle;
    let followerRadius;
    let followerRadiusDerivative;
    let followerRadiusSecondDerivative;
    let profileContactLocal;
    let profileRegion;
    if (onOuterTip) {
      const sine = Math.sin(normalizedDriverAngle);
      const cosine = Math.cos(normalizedDriverAngle);
      const tipWorldX = -outerTipRadius * cosine;
      const tipWorldY = -outerTipRadius * sine;
      const horizontalContactOffset = Math.sqrt(Math.max(
        0,
        rollerRadius ** 2 - tipWorldY ** 2,
      ));
      followerRadius = tipWorldX + horizontalContactOffset;
      followerRadiusDerivative = outerTipRadius * sine
        - outerTipRadius ** 2 * sine * cosine / horizontalContactOffset;
      const sineCosine = sine * cosine;
      followerRadiusSecondDerivative = outerTipRadius * cosine
        - outerTipRadius ** 2 * (
          Math.cos(normalizedDriverAngle * 2) / horizontalContactOffset
          + outerTipRadius ** 2 * sineCosine ** 2
            / horizontalContactOffset ** 3
        );
      profileContactLocal = outerTipLocal.clone();
      profileRegion = 'trimmed-outer-tip';
    } else {
      followerRadius = idealFollowerRadius;
      followerRadiusDerivative = normalizedDriverAngle > 0
        && normalizedDriverAngle < Math.PI
        ? uniformLiftPerRadian
        : -uniformLiftPerRadian;
      followerRadiusSecondDerivative = 0;
      profileContactLocal = branchProfilePoint(
        normalizedDriverAngle,
        followerRadiusDerivative,
      ).point;
      profileRegion = normalizedDriverAngle > 0
        && normalizedDriverAngle < Math.PI
        ? 'first-uniform-flank'
        : 'second-uniform-flank';
    }

    const cosine = Math.cos(normalizedDriverAngle);
    const sine = Math.sin(normalizedDriverAngle);
    const rollerCenter = new THREE.Vector3(
      shaftCenter.x + followerRadius,
      shaftCenter.y,
      rollerCenterZ,
    );
    const pitchPointLocal = new THREE.Vector2(
      followerRadius * cosine,
      -followerRadius * sine,
    );
    const profileContactWorld = new THREE.Vector3(
      shaftCenter.x + profileContactLocal.x * cosine
        - profileContactLocal.y * sine,
      shaftCenter.y + profileContactLocal.x * sine
        + profileContactLocal.y * cosine,
      rollerCenterZ,
    );
    const rollerCenterInContactPlane = rollerCenter.clone();
    const contactNormal = profileContactWorld.clone()
      .sub(rollerCenterInContactPlane)
      .normalize();
    const contactTangent = new THREE.Vector3().crossVectors(
      Z_AXIS,
      contactNormal,
    ).normalize();
    const outputVelocity = new THREE.Vector3(
      followerRadiusDerivative * inputAngularSpeed,
      0,
      0,
    );
    const outputAcceleration = new THREE.Vector3(
      followerRadiusSecondDerivative * inputAngularSpeed ** 2,
      0,
      0,
    );
    const camSurfaceVelocity = new THREE.Vector3().crossVectors(
      Z_AXIS,
      profileContactWorld.clone().sub(shaftCenter),
    ).multiplyScalar(inputAngularSpeed);
    const rollerAngularSpeed = camSurfaceVelocity.clone()
      .sub(outputVelocity)
      .dot(contactTangent) / rollerRadius;
    const rollerSurfaceVelocity = outputVelocity.clone().addScaledVector(
      contactTangent,
      rollerAngularSpeed * rollerRadius,
    );
    const relativeContactVelocity = rollerSurfaceVelocity.clone()
      .sub(camSurfaceVelocity);
    const nearInnerReversal = Math.min(
      normalizedDriverAngle,
      fullTurn - normalizedDriverAngle,
    ) < 1e-10;
    const nearOuterReversal = outerTipAngularDistance < 1e-10;
    const stage = nearInnerReversal
      ? 'inner-reversal'
      : nearOuterReversal
        ? 'outer-reversal'
        : onOuterTip
          ? 'rounded-outer-tip-transition'
          : outputVelocity.x > 0
            ? 'uniform-outward-traverse'
            : 'uniform-inward-traverse';
    return {
      camSurfaceVelocity,
      contactDistanceError: Math.abs(
        profileContactWorld.distanceTo(rollerCenterInContactPlane)
          - rollerRadius,
      ),
      contactNormal,
      contactTangent,
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      followerAngularSpeed: 0,
      followerRadius,
      followerRadiusDerivative,
      followerRadiusSecondDerivative,
      idealFollowerRadius,
      idealUniformMotionError: followerRadius - idealFollowerRadius,
      inputRevolutions: (driverAngle - sourcePoseAngle) / fullTurn,
      normalVelocityError: Math.abs(relativeContactVelocity.dot(contactNormal)),
      normalizedDriverAngle,
      onOuterTip,
      outerTipAngularDistance,
      outputAcceleration,
      outputDisplacement: followerRadius - minimumPitchRadius,
      outputVelocity,
      pitchPointLocal,
      profileContactLocal,
      profileContactWorld,
      profileRegion,
      relativeContactVelocity,
      rollerAngularSpeed,
      rollerCenter,
      rollerSlipSpeed: relativeContactVelocity.length(),
      rollerSurfaceVelocity,
      stage,
    };
  };

  const rollerIntegrationSegments = 4096;
  const rollerAngleIntegral = new Float64Array(rollerIntegrationSegments + 1);
  const rollerAngleDerivatives = new Float64Array(
    rollerIntegrationSegments + 1,
  );
  let previousRollerDerivative = contactGeometryAtDriverAngle(0)
    .rollerAngularSpeed / inputAngularSpeed;
  rollerAngleDerivatives[0] = previousRollerDerivative;
  for (let segment = 1; segment <= rollerIntegrationSegments; segment += 1) {
    const angle = segment / rollerIntegrationSegments * fullTurn;
    const rollerDerivative = contactGeometryAtDriverAngle(angle)
      .rollerAngularSpeed / inputAngularSpeed;
    rollerAngleDerivatives[segment] = rollerDerivative;
    const angleStep = fullTurn / rollerIntegrationSegments;
    rollerAngleIntegral[segment] = rollerAngleIntegral[segment - 1]
      + (previousRollerDerivative + rollerDerivative) / 2 * angleStep;
    previousRollerDerivative = rollerDerivative;
  }
  const rollerAnglePerInputCycle = rollerAngleIntegral.at(-1);
  const rollerAngleAtDriverAngle = (driverAngle) => {
    const relativeAngle = driverAngle - sourcePoseAngle;
    const completeCycles = Math.floor(relativeAngle / fullTurn);
    const normalizedAngle = relativeAngle - completeCycles * fullTurn;
    const tableCoordinate = normalizedAngle / fullTurn
      * rollerIntegrationSegments;
    const lowerIndex = Math.min(
      Math.floor(tableCoordinate),
      rollerIntegrationSegments - 1,
    );
    const fraction = tableCoordinate - lowerIndex;
    const fractionSquared = fraction ** 2;
    const fractionCubed = fraction ** 3;
    const angleStep = fullTurn / rollerIntegrationSegments;
    const lowerIntegral = rollerAngleIntegral[lowerIndex];
    const upperIntegral = rollerAngleIntegral[lowerIndex + 1];
    const lowerDerivative = rollerAngleDerivatives[lowerIndex];
    const upperDerivative = rollerAngleDerivatives[lowerIndex + 1];
    const partialIntegral = (2 * fractionCubed - 3 * fractionSquared + 1)
        * lowerIntegral
      + (fractionCubed - 2 * fractionSquared + fraction)
        * angleStep * lowerDerivative
      + (-2 * fractionCubed + 3 * fractionSquared) * upperIntegral
      + (fractionCubed - fractionSquared)
        * angleStep * upperDerivative;
    return completeCycles * rollerAnglePerInputCycle + partialIntegral;
  };

  const stateAtDriverAngle = (driverAngle) => {
    const state = contactGeometryAtDriverAngle(driverAngle);
    return {
      ...state,
      rollerAngle: rollerAngleAtDriverAngle(driverAngle),
    };
  };
  const stateAtTime = (time) => stateAtDriverAngle(
    sourcePoseAngle + inputAngularSpeed * time,
  );

  root.userData.mechanism = 'heart-cam-uniform-horizontal-traverse';
  root.userData.blocks = {
    baseRail,
    bearingBracket,
    camBody,
    camRotationIndex,
    follower,
    followerBar,
    followerGuides,
    followerRoller,
    framePost,
    guideBrackets,
    input,
    inputShaft,
    rollerHub,
    rollerRotationIndex,
    rollerRotor,
    shaftBearing,
    shaftHub,
    translationIndex,
  };
  root.userData.construction = {
    circleRadii: constructionCircleRadii,
    radialAngles: constructionRadialAngles,
  };
  root.userData.profile = {
    firstBranch: firstProfileBranch,
    innerArc: innerReversalArc,
    outerTip: outerTipLocal,
    points: profilePoints,
    secondBranch: secondProfileBranch,
  };
  root.userData.geometry = {
    actualMaximumFollowerRadius,
    actualOutputStroke,
    axis: Z_AXIS.clone(),
    baseY,
    bearingCenterZ,
    bearingInnerRadius,
    bearingOuterRadius,
    camDepth,
    camFrontZ,
    constructionDivisionCount,
    constructionRadialDivisionCount,
    cyclePeriod,
    followerBarCenterOffset,
    followerBarEnd,
    followerBarHalfDepth,
    followerBarHalfHeight,
    followerBarLength,
    followerBarStart,
    followerBarZ,
    followerGuideClearance,
    framePostX,
    frameTopY,
    frameZ,
    fullTurn,
    guideCentersX,
    guideInnerHalfDepth,
    guideInnerHalfHeight,
    guideLength,
    guideOuterHalfDepth,
    guideOuterHalfHeight,
    hubDepth,
    hubRadius,
    idealOutputStroke,
    inputAngularSpeed,
    inputSpeedMagnitude,
    maximumPitchRadius,
    minimumPitchRadius,
    outerTipApproachAngle,
    outerTipLocal: outerTipLocal.clone(),
    outerTipRadius,
    outerTipUndercut,
    outerTipUndercutHalfAngle,
    profileBranchSegments,
    profileInnerArcSegments,
    rollerAnglePerInputCycle,
    rollerCenterZ,
    rollerDepth,
    rollerHubRadius,
    rollerIntegrationSegments,
    rollerRadius,
    shaftCenter: shaftCenter.clone(),
    shaftCenterZ,
    shaftLength,
    shaftRadius,
    sourceHubRadius,
    sourceMaximumPitchRadius,
    sourceMinimumPitchRadius,
    sourcePoseAngle,
    sourceRollerRadius,
    sourceScale,
    sourceShaftRadius,
    uniformLiftPerRadian,
  };
  root.userData.branchProfilePoint = branchProfilePoint;
  root.userData.contactGeometryAtDriverAngle = contactGeometryAtDriverAngle;
  root.userData.rollerAngleAtDriverAngle = rollerAngleAtDriverAngle;
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.driverAngle;
    input.userData.angularSpeed = state.driverAngularSpeed;
    follower.position.set(
      state.rollerCenter.x,
      state.rollerCenter.y,
      shaftCenter.z,
    );
    follower.rotation.set(0, 0, 0);
    follower.userData.angularSpeed = 0;
    follower.userData.velocity = state.outputVelocity.clone();
    rollerRotor.rotation.z = state.rollerAngle;
    rollerRotor.userData.angularSpeed = state.rollerAngularSpeed;
    root.userData.contacts = {
      camRoller: {
        contactDistanceError: state.contactDistanceError,
        contactNormal: state.contactNormal.clone(),
        contactPoint: state.profileContactWorld.clone(),
        normalVelocityError: state.normalVelocityError,
        profileRegion: state.profileRegion,
        rollerCenter: state.rollerCenter.clone(),
        rollerSlipSpeed: state.rollerSlipSpeed,
      },
      followerGuides: {
        axis: new THREE.Vector3(1, 0, 0),
        depthClearance: followerGuideClearance,
        followerRotationError: 0,
        heightClearance: followerGuideClearance,
        lineError: Math.hypot(
          state.rollerCenter.y - shaftCenter.y,
          state.rollerCenter.z - rollerCenterZ,
        ),
      },
      shaftBearing: {
        axis: Z_AXIS.clone(),
        radialClearance: bearingInnerRadius - shaftRadius,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(5.6, 3.1, 14.2));
}

function groovedHeartCamPositiveTraverseMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.55;
  const sourceMinimumPitchRadius = 1.25;
  const sourceMaximumPitchRadius = 5;
  const sourceFollowerPinRadius = 0.25;
  const sourceHubRadius = 1;
  const sourceShaftRadius = 0.5;
  const sourceCarrierRadius = 5.3;
  const minimumPitchRadius = sourceMinimumPitchRadius * sourceScale;
  const maximumPitchRadius = sourceMaximumPitchRadius * sourceScale;
  const followerPinRadius = sourceFollowerPinRadius * sourceScale;
  const hubRadius = sourceHubRadius * sourceScale;
  const shaftRadius = sourceShaftRadius * sourceScale;
  const carrierRadius = sourceCarrierRadius * sourceScale;
  const idealOutputStroke = maximumPitchRadius - minimumPitchRadius;
  const uniformLiftPerRadian = idealOutputStroke / Math.PI;
  const inputSpeedMagnitude = 0.68;
  const inputAngularSpeed = -inputSpeedMagnitude;
  const cyclePeriod = fullTurn / inputSpeedMagnitude;
  const sourcePoseAngle = 0;
  const shaftCenter = new THREE.Vector3(0, 0, 0);
  const grooveFloorDepth = 0.14;
  const grooveFloorCenterZ = -grooveFloorDepth / 2;
  const grooveFloorFrontZ = 0;
  const grooveWallHeight = 0.16;
  const grooveWallCenterZ = grooveWallHeight / 2;
  const grooveWallFrontZ = grooveWallHeight;
  const shaftLength = 1.78;
  const shaftCenterZ = -0.31;
  const hubDepth = 0.49;
  const followerPinDepth = 0.34;
  const followerPinCenterZ = 0.15;
  const followerAxleRadius = followerPinRadius * 0.42;
  const followerBarStart = -0.04;
  const followerBarEnd = 4.9;
  const followerBarLength = followerBarEnd - followerBarStart;
  const followerBarCenterOffset = (followerBarStart + followerBarEnd) / 2;
  const followerBarHalfHeight = 0.1;
  const followerBarHalfDepth = 0.08;
  const followerBarZ = 0.35;
  const followerGuideClearance = 0.025;
  const guideInnerHalfHeight = followerBarHalfHeight + followerGuideClearance;
  const guideInnerHalfDepth = followerBarHalfDepth + followerGuideClearance;
  const guideOuterHalfHeight = 0.28;
  const guideOuterHalfDepth = 0.25;
  const guideLength = 0.34;
  const guideCentersX = [4.35, 5.05];
  const bearingCenterZ = -0.8;
  const bearingInnerRadius = shaftRadius + 0.027;
  const bearingOuterRadius = 0.47;
  const framePostX = 5.82;
  const frameZ = -0.82;
  const frameTopY = 2.12;
  const baseY = -3.48;
  const profileBranchSegments = 480;
  const profileReversalArcSegments = 48;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.62,
  });
  const grooveFloorMaterial = matte(0xa94734, {
    metalness: 0.1,
    roughness: 0.72,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.5,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const offsetProfilePoint = (
    angle,
    pitchRadiusDerivative,
    offsetSign,
  ) => {
    const pitchRadius = angle <= Math.PI
      ? minimumPitchRadius + uniformLiftPerRadian * angle
      : minimumPitchRadius
        + uniformLiftPerRadian * (fullTurn - angle);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const pitchPoint = new THREE.Vector2(
      pitchRadius * cosine,
      -pitchRadius * sine,
    );
    const pitchTangent = new THREE.Vector2(
      pitchRadiusDerivative * cosine - pitchRadius * sine,
      -pitchRadiusDerivative * sine - pitchRadius * cosine,
    );
    const inwardNormal = new THREE.Vector2(
      pitchTangent.y,
      -pitchTangent.x,
    ).normalize();
    return {
      angle,
      inwardNormal,
      pitchPoint,
      pitchRadius,
      pitchRadiusDerivative,
      pitchTangent,
      point: pitchPoint.clone().addScaledVector(
        inwardNormal,
        offsetSign * followerPinRadius,
      ),
    };
  };

  let outerTipSearchLower = Math.PI * 0.8;
  let outerTipSearchUpper = Math.PI;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const midpoint = (outerTipSearchLower + outerTipSearchUpper) / 2;
    if (offsetProfilePoint(
      midpoint,
      uniformLiftPerRadian,
      1,
    ).point.y < 0) {
      outerTipSearchLower = midpoint;
    } else {
      outerTipSearchUpper = midpoint;
    }
  }
  const outerTipApproachAngle = (
    outerTipSearchLower + outerTipSearchUpper
  ) / 2;
  const outerTipUndercutHalfAngle = Math.PI - outerTipApproachAngle;
  const innerWallOuterTip = offsetProfilePoint(
    outerTipApproachAngle,
    uniformLiftPerRadian,
    1,
  ).point;
  innerWallOuterTip.y = 0;
  const innerWallOuterTipRadius = -innerWallOuterTip.x;
  const actualMaximumFollowerRadius = innerWallOuterTipRadius
    + followerPinRadius;

  let innerTipSearchLower = 0;
  let innerTipSearchUpper = 0.45;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const midpoint = (innerTipSearchLower + innerTipSearchUpper) / 2;
    if (offsetProfilePoint(
      midpoint,
      uniformLiftPerRadian,
      -1,
    ).point.y > 0) {
      innerTipSearchLower = midpoint;
    } else {
      innerTipSearchUpper = midpoint;
    }
  }
  const innerTipApproachAngle = (
    innerTipSearchLower + innerTipSearchUpper
  ) / 2;
  const outerWallInnerTip = offsetProfilePoint(
    innerTipApproachAngle,
    uniformLiftPerRadian,
    -1,
  ).point;
  outerWallInnerTip.y = 0;
  const outerWallInnerTipRadius = outerWallInnerTip.x;
  const actualMinimumFollowerRadius = outerWallInnerTipRadius
    - followerPinRadius;
  const actualOutputStroke = actualMaximumFollowerRadius
    - actualMinimumFollowerRadius;
  const innerTipUndercut = actualMinimumFollowerRadius
    - minimumPitchRadius;
  const outerTipUndercut = maximumPitchRadius
    - actualMaximumFollowerRadius;

  const innerWallFirstBranch = [];
  for (let segment = 0; segment <= profileBranchSegments; segment += 1) {
    const angle = segment / profileBranchSegments * outerTipApproachAngle;
    innerWallFirstBranch.push(offsetProfilePoint(
      angle,
      uniformLiftPerRadian,
      1,
    ).point);
  }
  innerWallFirstBranch.at(-1).copy(innerWallOuterTip);

  const innerWallSecondBranch = [];
  const innerWallSecondBranchStart = fullTurn - outerTipApproachAngle;
  for (let segment = 0; segment <= profileBranchSegments; segment += 1) {
    const angle = innerWallSecondBranchStart
      + segment / profileBranchSegments * outerTipApproachAngle;
    innerWallSecondBranch.push(offsetProfilePoint(
      angle,
      -uniformLiftPerRadian,
      1,
    ).point);
  }
  innerWallSecondBranch[0].copy(innerWallOuterTip);

  const innerWallReversalArcCenter = new THREE.Vector2(
    minimumPitchRadius,
    0,
  );
  const innerWallArcStartVector = innerWallSecondBranch.at(-1).clone()
    .sub(innerWallReversalArcCenter);
  const innerWallArcEndVector = innerWallFirstBranch[0].clone()
    .sub(innerWallReversalArcCenter);
  const innerWallArcStartAngle = Math.atan2(
    innerWallArcStartVector.y,
    innerWallArcStartVector.x,
  );
  let innerWallArcEndAngle = Math.atan2(
    innerWallArcEndVector.y,
    innerWallArcEndVector.x,
  );
  if (innerWallArcEndAngle < innerWallArcStartAngle) {
    innerWallArcEndAngle += fullTurn;
  }
  const innerWallReversalArc = [];
  for (let segment = 1; segment < profileReversalArcSegments; segment += 1) {
    const angle = THREE.MathUtils.lerp(
      innerWallArcStartAngle,
      innerWallArcEndAngle,
      segment / profileReversalArcSegments,
    );
    innerWallReversalArc.push(new THREE.Vector2(
      innerWallReversalArcCenter.x + followerPinRadius * Math.cos(angle),
      innerWallReversalArcCenter.y + followerPinRadius * Math.sin(angle),
    ));
  }
  const innerWallPoints = [
    ...innerWallFirstBranch.map((point) => point.clone()),
    ...innerWallSecondBranch.slice(1).map((point) => point.clone()),
    ...innerWallReversalArc,
  ];

  const outerWallFirstBranch = [];
  for (let segment = 0; segment <= profileBranchSegments; segment += 1) {
    const angle = innerTipApproachAngle
      + segment / profileBranchSegments
        * (Math.PI - innerTipApproachAngle);
    outerWallFirstBranch.push(offsetProfilePoint(
      angle,
      uniformLiftPerRadian,
      -1,
    ).point);
  }
  outerWallFirstBranch[0].copy(outerWallInnerTip);

  const outerWallSecondBranch = [];
  for (let segment = 0; segment <= profileBranchSegments; segment += 1) {
    const angle = Math.PI
      + segment / profileBranchSegments
        * (Math.PI - innerTipApproachAngle);
    outerWallSecondBranch.push(offsetProfilePoint(
      angle,
      -uniformLiftPerRadian,
      -1,
    ).point);
  }
  outerWallSecondBranch.at(-1).copy(outerWallInnerTip);

  const outerWallReversalArcCenter = new THREE.Vector2(
    -maximumPitchRadius,
    0,
  );
  const outerWallArcStartVector = outerWallFirstBranch.at(-1).clone()
    .sub(outerWallReversalArcCenter);
  const outerWallArcEndVector = outerWallSecondBranch[0].clone()
    .sub(outerWallReversalArcCenter);
  let outerWallArcStartAngle = Math.atan2(
    outerWallArcStartVector.y,
    outerWallArcStartVector.x,
  );
  if (outerWallArcStartAngle < 0) outerWallArcStartAngle += fullTurn;
  const outerWallArcEndAngle = Math.atan2(
    outerWallArcEndVector.y,
    outerWallArcEndVector.x,
  );
  const outerWallReversalArc = [];
  for (let segment = 1; segment < profileReversalArcSegments; segment += 1) {
    const angle = THREE.MathUtils.lerp(
      outerWallArcStartAngle,
      outerWallArcEndAngle,
      segment / profileReversalArcSegments,
    );
    outerWallReversalArc.push(new THREE.Vector2(
      outerWallReversalArcCenter.x + followerPinRadius * Math.cos(angle),
      outerWallReversalArcCenter.y + followerPinRadius * Math.sin(angle),
    ));
  }
  const outerWallPoints = [
    ...outerWallFirstBranch.map((point) => point.clone()),
    ...outerWallReversalArc,
    ...outerWallSecondBranch.slice(0, -1).map((point) => point.clone()),
  ];

  const shapeFromPoints = (points) => {
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) shape.lineTo(point.x, point.y);
    shape.closePath();
    return shape;
  };
  const holePathFromPoints = (points) => {
    const ordered = points.map((point) => point.clone());
    if (!THREE.ShapeUtils.isClockWise(ordered)) ordered.reverse();
    const path = new THREE.Path();
    path.moveTo(ordered[0].x, ordered[0].y);
    for (const point of ordered.slice(1)) path.lineTo(point.x, point.y);
    path.closePath();
    return path;
  };
  const flatCenteredExtrusion = (shape, depth) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: false,
      curveSegments: 1,
      depth,
    });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  };

  const centralIslandShape = shapeFromPoints(innerWallPoints);
  const outerLandShape = new THREE.Shape();
  outerLandShape.absarc(0, 0, carrierRadius, 0, fullTurn, false);
  const outerWallHolePath = holePathFromPoints(outerWallPoints);
  outerLandShape.holes.push(outerWallHolePath);

  const input = planarRotor();
  input.position.copy(shaftCenter);
  input.userData.role = 'shaft-with-one-rigid-grooved-heart-cam-plate';
  const inputRotor = input.userData.rotor;

  const grooveFloor = cylinderAlongZ(
    carrierRadius,
    grooveFloorDepth,
    grooveFloorMaterial,
    112,
  );
  grooveFloor.position.z = grooveFloorCenterZ;
  grooveFloor.userData.role = 'solid-backplate-forming-floor-of-heart-groove';
  inputRotor.add(grooveFloor);

  const outerLand = new THREE.Mesh(
    flatCenteredExtrusion(outerLandShape, grooveWallHeight),
    driverMaterial,
  );
  outerLand.position.z = grooveWallCenterZ;
  outerLand.userData.role = 'outer-land-with-real-heart-shaped-recess';
  outerLand.userData.cutShape = outerLandShape;
  inputRotor.add(outerLand);

  const centralIsland = new THREE.Mesh(
    flatCenteredExtrusion(centralIslandShape, grooveWallHeight),
    driverMaterial,
  );
  centralIsland.position.z = grooveWallCenterZ;
  centralIsland.userData.role = 'central-heart-island-inside-captive-groove';
  centralIsland.userData.profileShape = centralIslandShape;
  inputRotor.add(centralIsland);

  const shaftHub = cylinderAlongZ(
    hubRadius,
    hubDepth,
    driverMaterial,
    52,
  );
  shaftHub.position.z = 0.012;
  shaftHub.userData.role = 'hub-on-central-island-rigid-with-grooved-cam';
  inputRotor.add(shaftHub);

  const inputShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
    44,
  );
  inputShaft.position.z = shaftCenterZ;
  inputShaft.userData.role = 'input-shaft-through-grooved-heart-cam-center';
  inputRotor.add(inputShaft);

  const camRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.065, 0.035),
    indexMaterial,
  );
  camRotationIndex.position.set(
    0,
    carrierRadius * 0.77,
    grooveWallFrontZ + 0.038,
  );
  camRotationIndex.userData.role = 'rotation-index-on-grooved-cam-carrier';
  inputRotor.add(camRotationIndex);

  const follower = new THREE.Group();
  follower.userData.role = 'nonrotating-horizontal-bar-with-captive-groove-pin';

  const followerPin = cylinderAlongZ(
    followerPinRadius,
    followerPinDepth,
    drivenMaterial,
    44,
  );
  followerPin.position.z = followerPinCenterZ;
  followerPin.userData.role = 'captive-nonrotating-pin-inside-heart-groove';

  const followerAxle = cylinderAlongZ(
    followerAxleRadius,
    followerPinDepth + 0.09,
    darkMaterial,
    32,
  );
  followerAxle.position.z = followerPinCenterZ;
  followerAxle.userData.role = 'fixed-cross-pin-joining-groove-shoe-to-bar';

  const followerBar = new THREE.Mesh(
    new THREE.BoxGeometry(
      followerBarLength,
      followerBarHalfHeight * 2,
      followerBarHalfDepth * 2,
    ),
    drivenMaterial,
  );
  followerBar.position.set(followerBarCenterOffset, 0, followerBarZ);
  followerBar.userData.role = 'horizontal-output-bar-rigid-with-captive-pin';

  const translationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, followerBarHalfHeight * 2 + 0.012, 0.025),
    indexMaterial,
  );
  translationIndex.position.set(2.9, 0, followerBarZ + followerBarHalfDepth + 0.018);
  translationIndex.userData.role = 'translation-index-on-grooved-cam-output-bar';
  follower.add(followerPin, followerAxle, followerBar, translationIndex);

  const followerGuides = guideCentersX.map((centerX, index) => {
    const guide = new THREE.Mesh(
      centeredExtrusion(
        roundedRectangleRingShape({
          innerCornerRadius: 0.045,
          innerHalfHeight: guideInnerHalfHeight,
          innerHalfWidth: guideInnerHalfDepth,
          outerCornerRadius: 0.075,
          outerHalfHeight: guideOuterHalfHeight,
          outerHalfWidth: guideOuterHalfDepth,
        }),
        guideLength,
        0.006,
      ),
      frameMaterial,
    );
    guide.rotation.y = Math.PI / 2;
    guide.position.set(centerX, 0, followerBarZ);
    guide.userData.role = 'fixed-guide-for-grooved-cam-output-bar';
    guide.userData.index = index;
    return guide;
  });

  const shaftBearing = new THREE.Mesh(
    new THREE.TorusGeometry(
      (bearingInnerRadius + bearingOuterRadius) / 2,
      (bearingOuterRadius - bearingInnerRadius) / 2,
      14,
      52,
    ),
    frameMaterial,
  );
  shaftBearing.position.copy(shaftCenter).setZ(bearingCenterZ);
  shaftBearing.userData.role = 'fixed-rear-bearing-for-grooved-cam-shaft';

  const baseRail = makeBeam(
    new THREE.Vector3(-1.35, baseY, frameZ),
    new THREE.Vector3(framePostX + 0.35, baseY, frameZ),
    { thickness: 0.18, depth: 0.28, color: PALETTE.frame },
  );
  baseRail.userData.role = 'fixed-base-of-grooved-heart-cam-demonstrator';

  const framePost = makeBeam(
    new THREE.Vector3(framePostX, baseY, frameZ),
    new THREE.Vector3(framePostX, frameTopY, frameZ),
    { thickness: 0.18, depth: 0.27, color: PALETTE.frame },
  );
  framePost.userData.role = 'fixed-side-post-for-grooved-cam-demonstrator';

  const bearingBracket = makeBeam(
    new THREE.Vector3(framePostX, -2.92, frameZ),
    new THREE.Vector3(bearingOuterRadius * 0.8, -0.2, frameZ),
    { thickness: 0.15, depth: 0.22, color: PALETTE.frame },
  );
  bearingBracket.userData.role = 'fixed-bracket-supporting-grooved-cam-bearing';

  const guideBrackets = followerGuides.map((guide, index) => {
    const signY = index === 0 ? 1 : -1;
    const bracket = makeBeam(
      new THREE.Vector3(
        framePostX,
        signY * (0.48 + index * 0.1),
        frameZ,
      ),
      new THREE.Vector3(
        guide.position.x,
        signY * guideOuterHalfHeight,
        followerBarZ - guideOuterHalfDepth,
      ),
      { thickness: 0.12, depth: 0.18, color: PALETTE.frame },
    );
    bracket.userData.role = 'fixed-bracket-supporting-grooved-cam-bar-guide';
    bracket.userData.index = index;
    return bracket;
  });

  root.add(
    baseRail,
    framePost,
    bearingBracket,
    ...guideBrackets,
    shaftBearing,
    ...followerGuides,
    input,
    follower,
  );

  const worldPointFromLocal = (point, driverAngle) => {
    const cosine = Math.cos(driverAngle);
    const sine = Math.sin(driverAngle);
    return new THREE.Vector3(
      shaftCenter.x + point.x * cosine - point.y * sine,
      shaftCenter.y + point.x * sine + point.y * cosine,
      followerPinCenterZ,
    );
  };

  const contactGeometryAtDriverAngle = (driverAngle) => {
    const normalizedDriverAngle = THREE.MathUtils.euclideanModulo(
      driverAngle,
      fullTurn,
    );
    const idealAngularLift = normalizedDriverAngle <= Math.PI
      ? normalizedDriverAngle
      : fullTurn - normalizedDriverAngle;
    const idealFollowerRadius = minimumPitchRadius
      + uniformLiftPerRadian * idealAngularLift;
    const innerTipAngularDistance = Math.min(
      normalizedDriverAngle,
      fullTurn - normalizedDriverAngle,
    );
    const outerTipAngularDistance = Math.abs(
      normalizedDriverAngle - Math.PI,
    );
    const onInnerTip = innerTipAngularDistance < innerTipApproachAngle;
    const onOuterTip = outerTipAngularDistance < outerTipUndercutHalfAngle;
    let followerRadius;
    let followerRadiusDerivative;
    let followerRadiusSecondDerivative;
    let activeWall;
    let activeContactLocals;
    let profileRegion;
    if (onInnerTip) {
      const sine = Math.sin(normalizedDriverAngle);
      const cosine = Math.cos(normalizedDriverAngle);
      const tipWorldX = outerWallInnerTipRadius * cosine;
      const tipWorldY = outerWallInnerTipRadius * sine;
      const horizontalContactOffset = Math.sqrt(Math.max(
        0,
        followerPinRadius ** 2 - tipWorldY ** 2,
      ));
      followerRadius = tipWorldX - horizontalContactOffset;
      followerRadiusDerivative = -outerWallInnerTipRadius * sine
        + outerWallInnerTipRadius ** 2 * sine * cosine
          / horizontalContactOffset;
      const sineCosine = sine * cosine;
      followerRadiusSecondDerivative = -outerWallInnerTipRadius * cosine
        + outerWallInnerTipRadius ** 2 * (
          Math.cos(normalizedDriverAngle * 2) / horizontalContactOffset
          + outerWallInnerTipRadius ** 2 * sineCosine ** 2
            / horizontalContactOffset ** 3
        );
      activeWall = 'outer-wall';
      activeContactLocals = [{
        point: outerWallInnerTip.clone(),
        wall: activeWall,
      }];
      profileRegion = 'trimmed-inner-tip';
    } else if (onOuterTip) {
      const sine = Math.sin(normalizedDriverAngle);
      const cosine = Math.cos(normalizedDriverAngle);
      const tipWorldX = -innerWallOuterTipRadius * cosine;
      const tipWorldY = -innerWallOuterTipRadius * sine;
      const horizontalContactOffset = Math.sqrt(Math.max(
        0,
        followerPinRadius ** 2 - tipWorldY ** 2,
      ));
      followerRadius = tipWorldX + horizontalContactOffset;
      followerRadiusDerivative = innerWallOuterTipRadius * sine
        - innerWallOuterTipRadius ** 2 * sine * cosine
          / horizontalContactOffset;
      const sineCosine = sine * cosine;
      followerRadiusSecondDerivative = innerWallOuterTipRadius * cosine
        - innerWallOuterTipRadius ** 2 * (
          Math.cos(normalizedDriverAngle * 2) / horizontalContactOffset
          + innerWallOuterTipRadius ** 2 * sineCosine ** 2
            / horizontalContactOffset ** 3
        );
      activeWall = 'inner-wall';
      activeContactLocals = [{
        point: innerWallOuterTip.clone(),
        wall: activeWall,
      }];
      profileRegion = 'trimmed-outer-tip';
    } else {
      followerRadius = idealFollowerRadius;
      followerRadiusDerivative = normalizedDriverAngle < Math.PI
        ? uniformLiftPerRadian
        : -uniformLiftPerRadian;
      followerRadiusSecondDerivative = 0;
      const innerPoint = offsetProfilePoint(
        normalizedDriverAngle,
        followerRadiusDerivative,
        1,
      ).point;
      const outerPoint = offsetProfilePoint(
        normalizedDriverAngle,
        followerRadiusDerivative,
        -1,
      ).point;
      activeWall = 'both-walls';
      activeContactLocals = [
        { point: innerPoint, wall: 'inner-wall' },
        { point: outerPoint, wall: 'outer-wall' },
      ];
      profileRegion = followerRadiusDerivative > 0
        ? 'first-uniform-groove-flank'
        : 'second-uniform-groove-flank';
    }

    const cosine = Math.cos(normalizedDriverAngle);
    const sine = Math.sin(normalizedDriverAngle);
    const pinCenter = new THREE.Vector3(
      shaftCenter.x + followerRadius,
      shaftCenter.y,
      followerPinCenterZ,
    );
    const pitchPointLocal = new THREE.Vector2(
      followerRadius * cosine,
      -followerRadius * sine,
    );
    const outputVelocity = new THREE.Vector3(
      followerRadiusDerivative * inputAngularSpeed,
      0,
      0,
    );
    const outputAcceleration = new THREE.Vector3(
      followerRadiusSecondDerivative * inputAngularSpeed ** 2,
      0,
      0,
    );
    const wallContacts = activeContactLocals.map(({ point, wall }) => {
      const contactPoint = worldPointFromLocal(point, normalizedDriverAngle);
      const contactNormal = contactPoint.clone().sub(pinCenter).normalize();
      const contactTangent = new THREE.Vector3().crossVectors(
        Z_AXIS,
        contactNormal,
      ).normalize();
      const camSurfaceVelocity = new THREE.Vector3().crossVectors(
        Z_AXIS,
        contactPoint.clone().sub(shaftCenter),
      ).multiplyScalar(inputAngularSpeed);
      const relativeContactVelocity = outputVelocity.clone()
        .sub(camSurfaceVelocity);
      return {
        camSurfaceVelocity,
        contactDistanceError: Math.abs(
          contactPoint.distanceTo(pinCenter) - followerPinRadius,
        ),
        contactNormal,
        contactPoint,
        contactTangent,
        localPoint: point.clone(),
        normalVelocityError: Math.abs(
          relativeContactVelocity.dot(contactNormal),
        ),
        slidingSpeed: Math.abs(relativeContactVelocity.dot(contactTangent)),
        wall,
      };
    });
    const nearInnerReversal = innerTipAngularDistance < 1e-10;
    const nearOuterReversal = outerTipAngularDistance < 1e-10;
    const stage = nearInnerReversal
      ? 'inner-reversal'
      : nearOuterReversal
        ? 'outer-reversal'
        : onInnerTip
          ? 'rounded-inner-tip-transition'
          : onOuterTip
            ? 'rounded-outer-tip-transition'
            : outputVelocity.x > 0
              ? 'uniform-outward-traverse'
              : 'uniform-inward-traverse';
    return {
      activeContactCount: wallContacts.length,
      activeWall,
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      followerAngularSpeed: 0,
      followerRadius,
      followerRadiusDerivative,
      followerRadiusSecondDerivative,
      idealFollowerRadius,
      idealUniformMotionError: followerRadius - idealFollowerRadius,
      innerTipAngularDistance,
      inputRevolutions: (driverAngle - sourcePoseAngle) / fullTurn,
      normalizedDriverAngle,
      onInnerTip,
      onOuterTip,
      outerTipAngularDistance,
      outputAcceleration,
      outputDisplacement: followerRadius - actualMinimumFollowerRadius,
      outputVelocity,
      pinAngularSpeed: 0,
      pinCenter,
      pitchPointLocal,
      profileRegion,
      stage,
      wallContacts,
    };
  };
  const stateAtDriverAngle = (driverAngle) => (
    contactGeometryAtDriverAngle(driverAngle)
  );
  const stateAtTime = (time) => stateAtDriverAngle(
    sourcePoseAngle + inputAngularSpeed * time,
  );

  root.userData.mechanism = 'closed-heart-groove-positive-horizontal-traverse';
  root.userData.blocks = {
    baseRail,
    bearingBracket,
    camRotationIndex,
    centralIsland,
    follower,
    followerAxle,
    followerBar,
    followerGuides,
    followerPin,
    framePost,
    grooveFloor,
    guideBrackets,
    input,
    inputShaft,
    outerLand,
    shaftBearing,
    shaftHub,
    translationIndex,
  };
  root.userData.profile = {
    innerWall: {
      firstBranch: innerWallFirstBranch,
      outerTip: innerWallOuterTip,
      points: innerWallPoints,
      reversalArc: innerWallReversalArc,
      secondBranch: innerWallSecondBranch,
    },
    outerWall: {
      firstBranch: outerWallFirstBranch,
      innerTip: outerWallInnerTip,
      points: outerWallPoints,
      reversalArc: outerWallReversalArc,
      secondBranch: outerWallSecondBranch,
    },
  };
  root.userData.geometry = {
    actualMaximumFollowerRadius,
    actualMinimumFollowerRadius,
    actualOutputStroke,
    axis: Z_AXIS.clone(),
    baseY,
    bearingCenterZ,
    bearingInnerRadius,
    bearingOuterRadius,
    carrierRadius,
    cyclePeriod,
    followerAxleRadius,
    followerBarCenterOffset,
    followerBarEnd,
    followerBarHalfDepth,
    followerBarHalfHeight,
    followerBarLength,
    followerBarStart,
    followerBarZ,
    followerGuideClearance,
    followerPinCenterZ,
    followerPinDepth,
    followerPinRadius,
    framePostX,
    frameTopY,
    frameZ,
    fullTurn,
    grooveFloorCenterZ,
    grooveFloorDepth,
    grooveFloorFrontZ,
    grooveWallCenterZ,
    grooveWallFrontZ,
    grooveWallHeight,
    guideCentersX,
    guideInnerHalfDepth,
    guideInnerHalfHeight,
    guideLength,
    guideOuterHalfDepth,
    guideOuterHalfHeight,
    hubDepth,
    hubRadius,
    idealOutputStroke,
    innerTipApproachAngle,
    innerTipUndercut,
    innerWallOuterTip: innerWallOuterTip.clone(),
    innerWallOuterTipRadius,
    inputAngularSpeed,
    inputSpeedMagnitude,
    maximumPitchRadius,
    minimumPitchRadius,
    outerTipApproachAngle,
    outerTipUndercut,
    outerTipUndercutHalfAngle,
    outerWallInnerTip: outerWallInnerTip.clone(),
    outerWallInnerTipRadius,
    profileBranchSegments,
    profileReversalArcSegments,
    shaftCenter: shaftCenter.clone(),
    shaftCenterZ,
    shaftLength,
    shaftRadius,
    sourceCarrierRadius,
    sourceFollowerPinRadius,
    sourceHubRadius,
    sourceMaximumPitchRadius,
    sourceMinimumPitchRadius,
    sourcePoseAngle,
    sourceScale,
    sourceShaftRadius,
    uniformLiftPerRadian,
  };
  root.userData.contactGeometryAtDriverAngle = contactGeometryAtDriverAngle;
  root.userData.offsetProfilePoint = offsetProfilePoint;
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.driverAngle;
    input.userData.angularSpeed = state.driverAngularSpeed;
    follower.position.set(
      state.pinCenter.x,
      state.pinCenter.y,
      shaftCenter.z,
    );
    follower.rotation.set(0, 0, 0);
    follower.userData.angularSpeed = 0;
    follower.userData.velocity = state.outputVelocity.clone();
    followerPin.userData.angularSpeed = 0;
    root.userData.contacts = {
      followerGuides: {
        axis: new THREE.Vector3(1, 0, 0),
        depthClearance: followerGuideClearance,
        followerRotationError: 0,
        heightClearance: followerGuideClearance,
        lineError: Math.hypot(
          state.pinCenter.y - shaftCenter.y,
          state.pinCenter.z - followerPinCenterZ,
        ),
      },
      heartGroove: {
        activeWall: state.activeWall,
        captive: true,
        contacts: state.wallContacts.map((contact) => ({
          contactDistanceError: contact.contactDistanceError,
          contactNormal: contact.contactNormal.clone(),
          contactPoint: contact.contactPoint.clone(),
          normalVelocityError: contact.normalVelocityError,
          slidingSpeed: contact.slidingSpeed,
          wall: contact.wall,
        })),
        grooveFloorZ: grooveFloorFrontZ,
        pinCenter: state.pinCenter.clone(),
      },
      shaftBearing: {
        axis: Z_AXIS.clone(),
        radialClearance: bearingInnerRadius - shaftRadius,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(5.5, 3.2, 14.4));
}

function spiralGuideDrillFeedMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.48;
  const sourceCarrierRadius = 7;
  const sourceHubRadius = 1.5;
  const sourceShaftRadius = 0.9;
  const sourceSpiralStartRadius = 1.5;
  const sourceSpiralEndRadius = 6.5;
  const sourceSpiralSweep = Math.PI * 9;
  const sourceFeedSweep = Math.PI * 7;
  const sourceNominalRollerRadius = 5 / 9;
  const sourceRollerRunningClearance = 0.025;
  const sourceRollerHousingRadius = 1;
  const sourceFollowerBarHalfWidth = 0.3;
  const sourceFixedGuideHalfSpacing = 2;
  const sourceCarriageHalfWidth = 1;
  const sourceCarriageHalfHeight = 0.5;

  const carrierRadius = sourceCarrierRadius * sourceScale;
  const hubRadius = sourceHubRadius * sourceScale;
  const shaftRadius = sourceShaftRadius * sourceScale;
  const spiralStartRadius = sourceSpiralStartRadius * sourceScale;
  const spiralEndRadius = sourceSpiralEndRadius * sourceScale;
  const spiralSweep = sourceSpiralSweep;
  const feedSweep = sourceFeedSweep;
  const spiralPitchPerRadian = (
    spiralEndRadius - spiralStartRadius
  ) / spiralSweep;
  const spiralPitchPerTurn = spiralPitchPerRadian * fullTurn;
  const channelHalfWidth = spiralPitchPerTurn / 2;
  const nominalRollerRadius = sourceNominalRollerRadius * sourceScale;
  const rollerRunningClearance = sourceRollerRunningClearance * sourceScale;
  const rollerRadius = nominalRollerRadius - rollerRunningClearance;
  const rollerHousingRadius = sourceRollerHousingRadius * sourceScale;
  const channelMinimumRadius = spiralStartRadius + channelHalfWidth;
  const channelMaximumRadius = spiralEndRadius - channelHalfWidth;
  const outputStroke = channelMaximumRadius - channelMinimumRadius;
  const followerBarHalfWidth = sourceFollowerBarHalfWidth * sourceScale;
  const fixedGuideHalfSpacing = sourceFixedGuideHalfSpacing * sourceScale;
  const carriageHalfWidth = sourceCarriageHalfWidth * sourceScale;
  const carriageHalfHeight = sourceCarriageHalfHeight * sourceScale;

  const cyclePeriod = 14;
  const advancePhaseEnd = 0.4;
  const outerDwellPhaseEnd = 0.5;
  const retractPhaseEnd = 0.9;
  const sourcePoseAngle = 0;
  const shaftCenter = new THREE.Vector3(0, 1.35, 0);
  const outputAxis = new THREE.Vector3(0, -1, 0);

  const carrierDepth = 0.34;
  const carrierCenterZ = -0.35;
  const carrierFrontZ = carrierCenterZ + carrierDepth / 2;
  const spiralRailRadius = 0.055;
  const spiralRailCenterZ = -0.085;
  const shaftLength = 1.62;
  const shaftCenterZ = -0.56;
  const hubDepth = 0.52;
  const hubCenterZ = -0.23;
  const rollerDepth = 0.46;
  const rollerCenterZ = spiralRailCenterZ;
  const rollerFrontZ = rollerCenterZ + rollerDepth / 2;
  const rollerHubRadius = rollerRadius * 0.34;
  const housingCenterZ = 0.31;
  const housingTubeRadius = 0.065;
  const followerBarZ = 0.42;
  const followerBarLength = 3.35;
  const followerBarCenterOffset = -1.78;
  const followerBarDepth = 0.24;
  const carriageCenterOffset = -3.02;
  const carriageDepth = 0.38;
  const chuckCenterOffset = -3.48;
  const chuckRadius = 0.24;
  const chuckLength = 0.42;
  const drillBitTopOffset = -3.66;
  const drillBitLength = 1.0;
  const drillBitRadius = 0.055;
  const guideTopY = -1.72;
  const guideBottomY = -5.48;
  const guideRailThickness = 0.11;
  const guideRailDepth = 0.2;
  const baseY = -5.72;
  const frameZ = -0.82;
  const frameHalfWidth = carrierRadius + 0.6;

  const smootherStep = (value) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return clamped ** 3 * (
      clamped * (clamped * 6 - 15) + 10
    );
  };
  const smootherStepDerivative = (value) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return 30 * clamped ** 2 * (1 - clamped) ** 2;
  };
  const smootherStepSecondDerivative = (value) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return 60 * clamped * (1 - clamped) * (1 - 2 * clamped);
  };
  const rotate2D = (vector, angle) => {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return new THREE.Vector2(
      cosine * vector.x - sine * vector.y,
      sine * vector.x + cosine * vector.y,
    );
  };

  const channelGeometryAtTravel = (unclampedTravel) => {
    const travel = THREE.MathUtils.clamp(unclampedTravel, 0, feedSweep);
    const channelRadius = channelMinimumRadius
      + spiralPitchPerRadian * travel;
    const localAngle = -Math.PI / 2 - travel;
    const radial = new THREE.Vector2(
      Math.cos(localAngle),
      Math.sin(localAngle),
    );
    const circumferential = new THREE.Vector2(-radial.y, radial.x);
    const channelTangentLocal = radial.clone()
      .multiplyScalar(spiralPitchPerRadian)
      .addScaledVector(circumferential, -channelRadius)
      .normalize();
    const channelOutwardNormalLocal = new THREE.Vector2(
      -channelTangentLocal.y,
      channelTangentLocal.x,
    );
    const channelCenterLocal = radial.clone().multiplyScalar(channelRadius);
    const innerWallLocal = channelCenterLocal.clone().addScaledVector(
      channelOutwardNormalLocal,
      -channelHalfWidth,
    );
    const outerWallLocal = channelCenterLocal.clone().addScaledVector(
      channelOutwardNormalLocal,
      channelHalfWidth,
    );
    const driverAngle = sourcePoseAngle + travel;
    const channelCenterRotated = rotate2D(channelCenterLocal, driverAngle);
    const innerWallRotated = rotate2D(innerWallLocal, driverAngle);
    const outerWallRotated = rotate2D(outerWallLocal, driverAngle);
    const channelTangentWorld2D = rotate2D(
      channelTangentLocal,
      driverAngle,
    );
    const channelOutwardNormalWorld2D = rotate2D(
      channelOutwardNormalLocal,
      driverAngle,
    );
    const rollerCenter = new THREE.Vector3(
      shaftCenter.x + channelCenterRotated.x,
      shaftCenter.y + channelCenterRotated.y,
      rollerCenterZ,
    );
    const innerWallPoint = new THREE.Vector3(
      shaftCenter.x + innerWallRotated.x,
      shaftCenter.y + innerWallRotated.y,
      spiralRailCenterZ,
    );
    const outerWallPoint = new THREE.Vector3(
      shaftCenter.x + outerWallRotated.x,
      shaftCenter.y + outerWallRotated.y,
      spiralRailCenterZ,
    );
    const channelTangentWorld = new THREE.Vector3(
      channelTangentWorld2D.x,
      channelTangentWorld2D.y,
      0,
    );
    const channelOutwardNormalWorld = new THREE.Vector3(
      channelOutwardNormalWorld2D.x,
      channelOutwardNormalWorld2D.y,
      0,
    );
    return {
      channelCenterLocal,
      channelOutwardNormalLocal,
      channelOutwardNormalWorld,
      channelRadius,
      channelTangentLocal,
      channelTangentWorld,
      driverAngle,
      innerWallLocal,
      innerWallPoint,
      localAngle,
      outerWallLocal,
      outerWallPoint,
      rollerCenter,
      travel,
    };
  };

  const mergedGuideSegments = 1800;
  const mergedGuidePoints = [];
  let mergedGuideMaximumWallDeviation = 0;
  for (let segment = 0; segment <= mergedGuideSegments; segment += 1) {
    const guideParameter = segment / mergedGuideSegments * spiralSweep;
    let mergedPoint;
    if (guideParameter <= fullTurn) {
      mergedPoint = channelGeometryAtTravel(guideParameter).innerWallLocal;
    } else if (guideParameter >= feedSweep) {
      mergedPoint = channelGeometryAtTravel(
        guideParameter - fullTurn,
      ).outerWallLocal;
    } else {
      const innerPoint = channelGeometryAtTravel(
        guideParameter,
      ).innerWallLocal;
      const outerPoint = channelGeometryAtTravel(
        guideParameter - fullTurn,
      ).outerWallLocal;
      const blend = smootherStep(
        (guideParameter - fullTurn) / (feedSweep - fullTurn),
      );
      mergedPoint = innerPoint.clone().lerp(outerPoint, blend);
      mergedGuideMaximumWallDeviation = Math.max(
        mergedGuideMaximumWallDeviation,
        mergedPoint.distanceTo(innerPoint),
        mergedPoint.distanceTo(outerPoint),
      );
    }
    mergedGuidePoints.push(new THREE.Vector3(
      mergedPoint.x,
      mergedPoint.y,
      spiralRailCenterZ,
    ));
  }

  const profileSegments = 1400;
  const channelCenterlinePoints = [];
  const innerWallPoints = [];
  const outerWallPoints = [];
  for (let segment = 0; segment <= profileSegments; segment += 1) {
    const travel = segment / profileSegments * feedSweep;
    const geometry = channelGeometryAtTravel(travel);
    channelCenterlinePoints.push(geometry.channelCenterLocal.clone());
    innerWallPoints.push(geometry.innerWallLocal.clone());
    outerWallPoints.push(geometry.outerWallLocal.clone());
  }

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.62,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.5,
  });
  const guideMaterial = matte(0x873a2e, {
    metalness: 0.18,
    roughness: 0.54,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const input = planarRotor();
  input.position.copy(shaftCenter);
  input.userData.role = 'reversing-disk-with-one-face-mounted-spiral-guide';
  const inputRotor = input.userData.rotor;

  const carrier = cylinderAlongZ(
    carrierRadius,
    carrierDepth,
    driverMaterial,
    112,
  );
  carrier.position.z = carrierCenterZ;
  carrier.userData.role = 'source-seven-radius-circular-guide-carrier';
  inputRotor.add(carrier);

  const spiralCurve = new THREE.CatmullRomCurve3(
    mergedGuidePoints,
    false,
    'centripetal',
  );
  const spiralGuide = new THREE.Mesh(
    new THREE.TubeGeometry(
      spiralCurve,
      mergedGuideSegments,
      spiralRailRadius,
      8,
      false,
    ),
    guideMaterial,
  );
  spiralGuide.userData.role = 'one-four-and-a-half-turn-face-mounted-spiral-guide';
  inputRotor.add(spiralGuide);

  const spiralStartCap = new THREE.Mesh(
    new THREE.SphereGeometry(spiralRailRadius, 16, 10),
    guideMaterial,
  );
  spiralStartCap.position.copy(mergedGuidePoints[0]);
  spiralStartCap.userData.role = 'rounded-inner-end-of-single-spiral-guide';
  inputRotor.add(spiralStartCap);

  const spiralEndCap = new THREE.Mesh(
    new THREE.SphereGeometry(spiralRailRadius, 16, 10),
    guideMaterial,
  );
  spiralEndCap.position.copy(mergedGuidePoints.at(-1));
  spiralEndCap.userData.role = 'rounded-outer-end-of-single-spiral-guide';
  inputRotor.add(spiralEndCap);

  const inputShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
    48,
  );
  inputShaft.position.z = shaftCenterZ;
  inputShaft.userData.role = 'reversing-shaft-through-spiral-guide-disk';
  inputRotor.add(inputShaft);

  const shaftHub = cylinderAlongZ(
    hubRadius,
    hubDepth,
    driverMaterial,
    64,
  );
  shaftHub.position.z = hubCenterZ;
  shaftHub.userData.role = 'source-one-and-a-half-radius-disk-hub';
  inputRotor.add(shaftHub);

  const diskRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(carrierRadius * 0.36, 0.085, 0.032),
    indexMaterial,
  );
  diskRotationIndex.position.set(
    carrierRadius * 0.78,
    0,
    carrierFrontZ + 0.052,
  );
  diskRotationIndex.userData.role = 'visible-angular-index-on-reversing-feed-disk';
  inputRotor.add(diskRotationIndex);

  const follower = new THREE.Group();
  follower.userData.role = 'vertical-drill-feed-carriage-with-captive-roller';

  const rollerRotor = new THREE.Group();
  rollerRotor.position.z = rollerCenterZ;
  rollerRotor.userData.role = 'freely-rotating-small-feed-roller';
  follower.add(rollerRotor);

  const followerRoller = cylinderAlongZ(
    rollerRadius,
    rollerDepth,
    drivenMaterial,
    48,
  );
  followerRoller.userData.role = 'small-roller-between-adjacent-spiral-turns';
  rollerRotor.add(followerRoller);

  const rollerHub = cylinderAlongZ(
    rollerHubRadius,
    rollerDepth + 0.12,
    darkMaterial,
    32,
  );
  rollerHub.userData.role = 'journal-of-free-feed-roller';
  rollerRotor.add(rollerHub);

  const rollerRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      rollerRadius * 0.72,
      Math.max(0.035, rollerRadius * 0.15),
      0.03,
    ),
    indexMaterial,
  );
  rollerRotationIndex.position.set(
    rollerRadius * 0.37,
    0,
    rollerDepth / 2 + 0.047,
  );
  rollerRotationIndex.userData.role = 'visible-index-showing-exact-free-roller-spin';
  rollerRotor.add(rollerRotationIndex);

  const rollerHousing = new THREE.Mesh(
    new THREE.TorusGeometry(
      rollerHousingRadius - housingTubeRadius,
      housingTubeRadius,
      10,
      64,
    ),
    drivenMaterial,
  );
  rollerHousing.position.z = housingCenterZ;
  rollerHousing.userData.role = 'nonrotating-large-eye-around-small-feed-roller';
  follower.add(rollerHousing);

  const housingBridge = new THREE.Mesh(
    new THREE.BoxGeometry(
      rollerHousingRadius * 1.25,
      0.34,
      followerBarDepth,
    ),
    drivenMaterial,
  );
  housingBridge.position.set(0, -rollerHousingRadius * 0.76, followerBarZ);
  housingBridge.userData.role = 'bridge-rigidly-joining-roller-eye-to-feed-bar';
  follower.add(housingBridge);

  const followerBar = new THREE.Mesh(
    new THREE.BoxGeometry(
      followerBarHalfWidth * 2,
      followerBarLength,
      followerBarDepth,
    ),
    drivenMaterial,
  );
  followerBar.position.set(0, followerBarCenterOffset, followerBarZ);
  followerBar.userData.role = 'vertical-feed-bar-rigid-with-roller-eye';
  follower.add(followerBar);

  const carriage = new THREE.Mesh(
    new THREE.BoxGeometry(
      carriageHalfWidth * 2,
      carriageHalfHeight * 2,
      carriageDepth,
    ),
    drivenMaterial,
  );
  carriage.position.set(0, carriageCenterOffset, followerBarZ);
  carriage.userData.role = 'drilling-machine-feed-carriage';
  follower.add(carriage);

  const carriageIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, carriageHalfHeight * 1.4, 0.032),
    indexMaterial,
  );
  carriageIndex.position.set(
    0,
    carriageCenterOffset,
    followerBarZ + carriageDepth / 2 + 0.035,
  );
  carriageIndex.userData.role = 'visible-vertical-feed-index-on-carriage';
  follower.add(carriageIndex);

  const drillChuck = cylinderAlongZ(
    chuckRadius,
    chuckLength,
    darkMaterial,
    40,
  );
  drillChuck.rotation.set(0, 0, 0);
  drillChuck.position.set(0, chuckCenterOffset, followerBarZ);
  drillChuck.userData.role = 'schematic-drill-chuck-rigid-with-feed-carriage';
  follower.add(drillChuck);

  const drillBit = new THREE.Mesh(
    new THREE.CylinderGeometry(
      drillBitRadius * 0.32,
      drillBitRadius,
      drillBitLength,
      20,
    ),
    darkMaterial,
  );
  drillBit.position.set(
    0,
    drillBitTopOffset - drillBitLength / 2,
    followerBarZ,
  );
  drillBit.userData.role = 'schematic-drill-bit-showing-feed-direction';
  follower.add(drillBit);

  const fixedGuideRails = [-1, 1].map((signX) => {
    const rail = makeBeam(
      new THREE.Vector3(
        shaftCenter.x + signX * fixedGuideHalfSpacing,
        guideTopY,
        frameZ,
      ),
      new THREE.Vector3(
        shaftCenter.x + signX * fixedGuideHalfSpacing,
        guideBottomY,
        frameZ,
      ),
      {
        thickness: guideRailThickness,
        depth: guideRailDepth,
        color: PALETTE.frame,
      },
    );
    rail.userData.role = 'fixed-vertical-way-for-drill-feed-carriage';
    rail.userData.side = signX < 0 ? 'left' : 'right';
    return rail;
  });

  const guideCrossbars = [guideTopY, guideBottomY].map((y, index) => {
    const crossbar = makeBeam(
      new THREE.Vector3(
        shaftCenter.x - fixedGuideHalfSpacing,
        y,
        frameZ,
      ),
      new THREE.Vector3(
        shaftCenter.x + fixedGuideHalfSpacing,
        y,
        frameZ,
      ),
      { thickness: 0.1, depth: 0.18, color: PALETTE.frame },
    );
    crossbar.userData.role = 'fixed-crossbar-joining-drill-feed-ways';
    crossbar.userData.side = index === 0 ? 'upper' : 'lower';
    return crossbar;
  });

  const baseRail = makeBeam(
    new THREE.Vector3(-frameHalfWidth, baseY, frameZ),
    new THREE.Vector3(frameHalfWidth, baseY, frameZ),
    { thickness: 0.18, depth: 0.26, color: PALETTE.frame },
  );
  baseRail.userData.role = 'fixed-base-of-spiral-drill-feed-demonstrator';

  const framePosts = [-1, 1].map((signX) => {
    const x = signX * frameHalfWidth;
    const post = makeBeam(
      new THREE.Vector3(x, baseY, frameZ),
      new THREE.Vector3(x, shaftCenter.y, frameZ),
      { thickness: 0.16, depth: 0.24, color: PALETTE.frame },
    );
    post.userData.role = 'fixed-side-post-supporting-spiral-disk-bearing';
    post.userData.side = signX < 0 ? 'left' : 'right';
    return post;
  });

  const bearingBrackets = [-1, 1].map((signX) => {
    const bracket = makeBeam(
      new THREE.Vector3(signX * frameHalfWidth, shaftCenter.y, frameZ),
      new THREE.Vector3(shaftCenter.x, shaftCenter.y, frameZ + 0.03),
      { thickness: 0.13, depth: 0.2, color: PALETTE.frame },
    );
    bracket.userData.role = 'fixed-bracket-supporting-spiral-disk-bearing';
    return bracket;
  });

  const shaftBearing = new THREE.Mesh(
    new THREE.TorusGeometry(hubRadius + 0.07, 0.075, 10, 56),
    frameMaterial,
  );
  shaftBearing.position.set(shaftCenter.x, shaftCenter.y, frameZ + 0.03);
  shaftBearing.userData.role = 'fixed-rear-bearing-of-reversing-spiral-disk';

  root.add(
    baseRail,
    ...framePosts,
    ...bearingBrackets,
    shaftBearing,
    ...fixedGuideRails,
    ...guideCrossbars,
    input,
    follower,
  );

  const wallContactAtTravel = (
    geometry,
    wall,
    driverAngularSpeed,
    outputVelocity,
  ) => {
    const inner = wall === 'inner';
    const wallPoint = inner
      ? geometry.innerWallPoint
      : geometry.outerWallPoint;
    const wallToRollerNormal = geometry.channelOutwardNormalWorld.clone()
      .multiplyScalar(inner ? 1 : -1);
    const tangent = geometry.channelTangentWorld.clone();
    const wallRadiusVector = wallPoint.clone().sub(shaftCenter);
    const wallSurfaceVelocity = new THREE.Vector3(
      -wallRadiusVector.y * driverAngularSpeed,
      wallRadiusVector.x * driverAngularSpeed,
      0,
    );
    const rollerSurfaceOffset = wallToRollerNormal.clone()
      .multiplyScalar(-rollerRadius);
    const spinVelocityDirection = new THREE.Vector3(
      -rollerSurfaceOffset.y,
      rollerSurfaceOffset.x,
      0,
    );
    const spinDenominator = spinVelocityDirection.dot(tangent);
    const rollerRatePerDriverRadian = Math.abs(driverAngularSpeed) > 1e-12
      ? wallSurfaceVelocity.clone().sub(outputVelocity).dot(tangent)
        / spinDenominator / driverAngularSpeed
      : (() => {
        const unitWallVelocity = new THREE.Vector3(
          -wallRadiusVector.y,
          wallRadiusVector.x,
          0,
        );
        const unitOutputVelocity = new THREE.Vector3(
          0,
          -spiralPitchPerRadian,
          0,
        );
        return unitWallVelocity.sub(unitOutputVelocity).dot(tangent)
          / spinDenominator;
      })();
    return {
      normalVelocityError: outputVelocity.clone()
        .sub(wallSurfaceVelocity)
        .dot(wallToRollerNormal),
      pinSurfacePoint: geometry.rollerCenter.clone().add(
        rollerSurfaceOffset,
      ),
      rollerRatePerDriverRadian,
      surfaceGap: channelHalfWidth - rollerRadius,
      tangent,
      wall,
      wallPoint: wallPoint.clone(),
      wallSurfaceVelocity,
      wallToRollerNormal,
    };
  };

  const rollerIntegrationSegments = 4096;
  const travelStep = feedSweep / rollerIntegrationSegments;
  const innerRollerDerivatives = new Float64Array(
    rollerIntegrationSegments + 1,
  );
  const outerRollerDerivatives = new Float64Array(
    rollerIntegrationSegments + 1,
  );
  const innerRollerIntegral = new Float64Array(
    rollerIntegrationSegments + 1,
  );
  const outerRollerIntegral = new Float64Array(
    rollerIntegrationSegments + 1,
  );
  for (let segment = 0; segment <= rollerIntegrationSegments; segment += 1) {
    const travel = segment / rollerIntegrationSegments * feedSweep;
    const geometry = channelGeometryAtTravel(travel);
    const unitOutputVelocity = new THREE.Vector3(
      0,
      -spiralPitchPerRadian,
      0,
    );
    innerRollerDerivatives[segment] = wallContactAtTravel(
      geometry,
      'inner',
      1,
      unitOutputVelocity,
    ).rollerRatePerDriverRadian;
    outerRollerDerivatives[segment] = wallContactAtTravel(
      geometry,
      'outer',
      1,
      unitOutputVelocity,
    ).rollerRatePerDriverRadian;
    if (segment > 0) {
      innerRollerIntegral[segment] = innerRollerIntegral[segment - 1]
        + (innerRollerDerivatives[segment - 1]
          + innerRollerDerivatives[segment]) / 2 * travelStep;
      outerRollerIntegral[segment] = outerRollerIntegral[segment - 1]
        + (outerRollerDerivatives[segment - 1]
          + outerRollerDerivatives[segment]) / 2 * travelStep;
    }
  }

  const interpolatedIntegral = (travel, integral, derivatives) => {
    const clampedTravel = THREE.MathUtils.clamp(travel, 0, feedSweep);
    const tableCoordinate = clampedTravel / feedSweep
      * rollerIntegrationSegments;
    const lowerIndex = Math.min(
      Math.floor(tableCoordinate),
      rollerIntegrationSegments - 1,
    );
    const fraction = tableCoordinate - lowerIndex;
    const fractionSquared = fraction ** 2;
    const fractionCubed = fraction ** 3;
    return (2 * fractionCubed - 3 * fractionSquared + 1)
        * integral[lowerIndex]
      + (fractionCubed - 2 * fractionSquared + fraction)
        * travelStep * derivatives[lowerIndex]
      + (-2 * fractionCubed + 3 * fractionSquared)
        * integral[lowerIndex + 1]
      + (fractionCubed - fractionSquared)
        * travelStep * derivatives[lowerIndex + 1];
  };
  const innerRollerAngleAtTravel = (travel) => interpolatedIntegral(
    travel,
    innerRollerIntegral,
    innerRollerDerivatives,
  );
  const outerRollerAngleAtTravel = (travel) => interpolatedIntegral(
    travel,
    outerRollerIntegral,
    outerRollerDerivatives,
  );
  const innerRollerAngleAtOuterDwell = innerRollerIntegral.at(-1);
  const outerRollerAngleAtOuterDwell = outerRollerIntegral.at(-1);
  const rollerAnglePerCycle = innerRollerAngleAtOuterDwell
    - outerRollerAngleAtOuterDwell;

  const motionAtTime = (time) => {
    const cycleIndex = Math.floor(time / cyclePeriod);
    const cycleTime = time - cycleIndex * cyclePeriod;
    const phase = cycleTime / cyclePeriod;
    let travel;
    let driverAngularSpeed;
    let driverAngularAcceleration;
    let stage;
    let loadingWall;
    let rollerAngleWithinCycle;
    if (phase < advancePhaseEnd) {
      const legDuration = cyclePeriod * advancePhaseEnd;
      const legPhase = phase / advancePhaseEnd;
      travel = feedSweep * smootherStep(legPhase);
      driverAngularSpeed = feedSweep
        * smootherStepDerivative(legPhase) / legDuration;
      driverAngularAcceleration = feedSweep
        * smootherStepSecondDerivative(legPhase) / legDuration ** 2;
      stage = 'advancing-drill-feed';
      loadingWall = 'inner';
      rollerAngleWithinCycle = innerRollerAngleAtTravel(travel);
    } else if (phase < outerDwellPhaseEnd) {
      travel = feedSweep;
      driverAngularSpeed = 0;
      driverAngularAcceleration = 0;
      stage = 'outer-feed-dwell';
      loadingWall = 'none';
      rollerAngleWithinCycle = innerRollerAngleAtOuterDwell;
    } else if (phase < retractPhaseEnd) {
      const legDuration = cyclePeriod
        * (retractPhaseEnd - outerDwellPhaseEnd);
      const legPhase = (phase - outerDwellPhaseEnd)
        / (retractPhaseEnd - outerDwellPhaseEnd);
      const eased = smootherStep(legPhase);
      travel = feedSweep * (1 - eased);
      driverAngularSpeed = -feedSweep
        * smootherStepDerivative(legPhase) / legDuration;
      driverAngularAcceleration = -feedSweep
        * smootherStepSecondDerivative(legPhase) / legDuration ** 2;
      stage = 'retracting-drill-feed';
      loadingWall = 'outer';
      rollerAngleWithinCycle = innerRollerAngleAtOuterDwell
        + outerRollerAngleAtTravel(travel)
        - outerRollerAngleAtOuterDwell;
    } else {
      travel = 0;
      driverAngularSpeed = 0;
      driverAngularAcceleration = 0;
      stage = 'inner-feed-dwell';
      loadingWall = 'none';
      rollerAngleWithinCycle = rollerAnglePerCycle;
    }
    return {
      cycleIndex,
      cycleTime,
      driverAngularAcceleration,
      driverAngularSpeed,
      loadingWall,
      phase,
      rollerAngle: cycleIndex * rollerAnglePerCycle
        + rollerAngleWithinCycle,
      stage,
      travel,
    };
  };

  const stateAtTravel = (
    travel,
    driverAngularSpeed = 1,
    driverAngularAcceleration = 0,
    loadingWall = driverAngularSpeed >= 0 ? 'inner' : 'outer',
  ) => {
    const geometry = channelGeometryAtTravel(travel);
    const outputVelocity = new THREE.Vector3(
      0,
      -spiralPitchPerRadian * driverAngularSpeed,
      0,
    );
    const outputAcceleration = new THREE.Vector3(
      0,
      -spiralPitchPerRadian * driverAngularAcceleration,
      0,
    );
    const wallContacts = [
      wallContactAtTravel(
        geometry,
        'inner',
        driverAngularSpeed,
        outputVelocity,
      ),
      wallContactAtTravel(
        geometry,
        'outer',
        driverAngularSpeed,
        outputVelocity,
      ),
    ];
    const activeContact = wallContacts.find(({ wall }) => wall === loadingWall);
    const rollerAngularSpeed = activeContact
      ? activeContact.rollerRatePerDriverRadian * driverAngularSpeed
      : 0;
    for (const contact of wallContacts) {
      const rollerSurfaceOffset = contact.wallToRollerNormal.clone()
        .multiplyScalar(-rollerRadius);
      const rollerSurfaceVelocity = outputVelocity.clone().add(
        new THREE.Vector3(
          -rollerSurfaceOffset.y * rollerAngularSpeed,
          rollerSurfaceOffset.x * rollerAngularSpeed,
          0,
        ),
      );
      contact.rollerSurfaceVelocity = rollerSurfaceVelocity;
      contact.surfaceSlipSpeed = rollerSurfaceVelocity.clone()
        .sub(contact.wallSurfaceVelocity)
        .dot(contact.tangent);
    }
    return {
      ...geometry,
      driverAngularAcceleration,
      driverAngularSpeed,
      inputRevolutions: geometry.driverAngle / fullTurn,
      loadingWall,
      outputAcceleration,
      outputDisplacement: geometry.channelRadius - channelMinimumRadius,
      outputVelocity,
      rollerAngularSpeed,
      rollerRadius,
      wallContacts,
    };
  };

  const stateAtTime = (time) => {
    const motion = motionAtTime(time);
    return {
      ...stateAtTravel(
        motion.travel,
        motion.driverAngularSpeed,
        motion.driverAngularAcceleration,
        motion.loadingWall,
      ),
      cycleIndex: motion.cycleIndex,
      cycleTime: motion.cycleTime,
      phase: motion.phase,
      rollerAngle: motion.rollerAngle,
      stage: motion.stage,
    };
  };

  root.userData.mechanism = 'reversing-spiral-guide-positive-drill-feed';
  root.userData.cameraDistanceScale = 1.08;
  root.userData.blocks = {
    baseRail,
    bearingBrackets,
    carriage,
    carriageIndex,
    carrier,
    diskRotationIndex,
    drillBit,
    drillChuck,
    fixedGuideRails,
    follower,
    followerBar,
    followerRoller,
    framePosts,
    guideCrossbars,
    housingBridge,
    input,
    inputShaft,
    rollerHousing,
    rollerHub,
    rollerRotationIndex,
    rollerRotor,
    shaftBearing,
    shaftHub,
    spiralEndCap,
    spiralGuide,
    spiralStartCap,
  };
  root.userData.geometry = {
    advancePhaseEnd,
    axis: Z_AXIS.clone(),
    baseY,
    carriageCenterOffset,
    carriageDepth,
    carriageHalfHeight,
    carriageHalfWidth,
    carrierCenterZ,
    carrierDepth,
    carrierFrontZ,
    carrierRadius,
    channelHalfWidth,
    channelMaximumRadius,
    channelMinimumRadius,
    chuckCenterOffset,
    chuckLength,
    chuckRadius,
    cyclePeriod,
    drillBitLength,
    drillBitRadius,
    drillBitTopOffset,
    feedSweep,
    fixedGuideHalfSpacing,
    followerBarCenterOffset,
    followerBarDepth,
    followerBarHalfWidth,
    followerBarLength,
    followerBarZ,
    frameHalfWidth,
    frameZ,
    fullTurn,
    guideBottomY,
    guideRailDepth,
    guideRailThickness,
    guideTopY,
    housingCenterZ,
    housingTubeRadius,
    hubCenterZ,
    hubDepth,
    hubRadius,
    mergedGuideMaximumWallDeviation,
    mergedGuideSegments,
    nominalRollerRadius,
    outerDwellPhaseEnd,
    outputStroke,
    profileSegments,
    retractPhaseEnd,
    rollerAnglePerCycle,
    rollerCenterZ,
    rollerDepth,
    rollerFrontZ,
    rollerHousingRadius,
    rollerHubRadius,
    rollerIntegrationSegments,
    rollerRadius,
    rollerRunningClearance,
    shaftCenter: shaftCenter.clone(),
    shaftCenterZ,
    shaftLength,
    shaftRadius,
    sourceCarriageHalfHeight,
    sourceCarriageHalfWidth,
    sourceCarrierRadius,
    sourceFeedSweep,
    sourceFixedGuideHalfSpacing,
    sourceFollowerBarHalfWidth,
    sourceHubRadius,
    sourceNominalRollerRadius,
    sourcePoseAngle,
    sourceRollerHousingRadius,
    sourceRollerRunningClearance,
    sourceScale,
    sourceShaftRadius,
    sourceSpiralEndRadius,
    sourceSpiralStartRadius,
    sourceSpiralSweep,
    spiralEndRadius,
    spiralPitchPerRadian,
    spiralPitchPerTurn,
    spiralRailCenterZ,
    spiralRailRadius,
    spiralStartRadius,
    spiralSweep,
  };
  root.userData.profiles = {
    channelCenterlinePoints,
    innerWallPoints,
    mergedGuidePoints,
    outerWallPoints,
  };
  root.userData.channelGeometryAtTravel = channelGeometryAtTravel;
  root.userData.innerRollerAngleAtTravel = innerRollerAngleAtTravel;
  root.userData.motionAtTime = motionAtTime;
  root.userData.outerRollerAngleAtTravel = outerRollerAngleAtTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.stateAtTravel = stateAtTravel;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.driverAngle;
    input.userData.angularSpeed = state.driverAngularSpeed;
    follower.position.set(
      state.rollerCenter.x,
      state.rollerCenter.y,
      0,
    );
    follower.rotation.set(0, 0, 0);
    follower.userData.velocity = state.outputVelocity.clone();
    rollerRotor.rotation.z = state.rollerAngle;
    rollerRotor.userData.angularSpeed = state.rollerAngularSpeed;
    root.userData.contacts = {
      captiveSpiralChannel: {
        channelCenter: state.rollerCenter.clone(),
        loadingWall: state.loadingWall,
        oneContinuousGuide: true,
        wallContacts: state.wallContacts.map((contact) => ({
          normalVelocityError: contact.normalVelocityError,
          pinSurfacePoint: contact.pinSurfacePoint.clone(),
          rollerSurfaceVelocity: contact.rollerSurfaceVelocity.clone(),
          surfaceGap: contact.surfaceGap,
          surfaceSlipSpeed: contact.surfaceSlipSpeed,
          tangent: contact.tangent.clone(),
          wall: contact.wall,
          wallPoint: contact.wallPoint.clone(),
          wallSurfaceVelocity: contact.wallSurfaceVelocity.clone(),
          wallToRollerNormal: contact.wallToRollerNormal.clone(),
        })),
      },
      followerGuides: {
        axis: outputAxis.clone(),
        lateralClearance: fixedGuideHalfSpacing - carriageHalfWidth,
        lineError: Math.abs(state.rollerCenter.x - shaftCenter.x),
        rotationError: 0,
      },
      shaftBearing: {
        axis: Z_AXIS.clone(),
        radialClearance: hubRadius + 0.07 - shaftRadius,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(6.1, 4.0, 14.5));
}

function cylindricalReversingGrooveCamMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourcePoseAngle = Math.PI / 2;
  const inputAngularSpeed = 0.72;
  const cyclePeriod = fullTurn / inputAngularSpeed;
  const camCenterY = -0.62;
  const barrelRadius = 1.2;
  const barrelLength = 1.05;
  const barrelHalfLength = barrelLength / 2;
  const shaftRadius = 0.14;
  const shaftLength = 3.45;
  const grooveCenterRadius = barrelRadius + 0.018;
  const grooveTubeRadius = 0.065;
  const grooveSegments = 512;
  const grooveRadialSegments = 8;
  const followerAmplitude = 0.34;
  const outputStroke = followerAmplitude * 2;
  const grooveSlopeMagnitude = outputStroke / Math.PI;
  const uniformFollowerSpeed = grooveSlopeMagnitude * inputAngularSpeed;
  const followerGuideY = 1.72;
  const guideRodRadius = 0.09;
  const guideRodLength = 3.35;
  const guideSupportCentersX = [-1.3, 1.3];
  const guideSupportOuterRadius = 0.27;
  const guideSupportLength = 0.34;
  const guideBearingClearance = 0.026;
  const followerSleeveOuterRadius = 0.245;
  const followerSleeveLength = 0.34;
  const followerTipRadius = 0.11;
  const followerPinRadius = 0.085;
  const followerTipY = camCenterY + grooveCenterRadius;
  const followerPinTopY = followerTipY + 0.34;
  const followerPinLength = followerPinTopY - followerTipY;
  const followerStemTopY = followerGuideY - followerSleeveOuterRadius * 0.72;
  const followerStemBottomY = followerPinTopY - 0.03;
  const followerStemThickness = 0.15;
  const followerStemDepth = 0.18;
  const ceilingY = 2.66;
  const ceilingLength = 3.95;
  const ceilingHeight = 0.24;
  const ceilingDepth = 0.88;
  const frameZ = -0.34;
  const camBearingCenterX = barrelHalfLength + 0.24;
  const camBearingCentersX = [-camBearingCenterX, camBearingCenterX];
  const camBearingInnerRadius = shaftRadius + 0.026;
  const camBearingOuterRadius = 0.3;
  const camBearingLength = 0.24;
  const baseY = -2.18;
  const baseDepth = 0.28;
  const sourceBarrelAxialWidth = 83;
  const sourceBarrelDiameter = 201;
  const sourceGuideSupportSpacing = 205;
  const sourceGuideRodSpan = 278;
  const sourceGrooveTraverse = 54;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.19,
    roughness: 0.52,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.6,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const grooveMaterial = matte(0x252a2d, {
    metalness: 0.2,
    roughness: 0.47,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const positiveModulo = (value, modulus) => (
    ((value % modulus) + modulus) % modulus
  );
  const grooveXAtAngle = (angle) => {
    const normalizedAngle = positiveModulo(angle, fullTurn);
    if (normalizedAngle <= Math.PI) {
      return -followerAmplitude
        + grooveSlopeMagnitude * normalizedAngle;
    }
    return followerAmplitude
      - grooveSlopeMagnitude * (normalizedAngle - Math.PI);
  };
  const angularDistance = (left, right) => Math.abs(Math.atan2(
    Math.sin(left - right),
    Math.cos(left - right),
  ));

  const grooveCurve = new class extends THREE.Curve {
    getPoint(parameter, target = new THREE.Vector3()) {
      const angle = parameter * fullTurn;
      return target.set(
        grooveXAtAngle(angle),
        grooveCenterRadius * Math.cos(angle),
        grooveCenterRadius * Math.sin(angle),
      );
    }
  }();
  grooveCurve.arcLengthDivisions = grooveSegments;

  const input = new THREE.Group();
  input.position.y = camCenterY;
  input.userData.axis = X_AXIS.clone();
  input.userData.role = 'horizontal-shaft-with-one-rigid-cylindrical-groove-cam';
  const inputRotor = new THREE.Group();
  input.userData.rotor = inputRotor;
  input.add(inputRotor);

  const inputShaft = cylinderAlongX(
    shaftRadius,
    shaftLength,
    darkMaterial,
    40,
  );
  inputShaft.userData.role = 'input-shaft-rigid-with-barrel-cam';
  inputRotor.add(inputShaft);

  const barrel = cylinderAlongX(
    barrelRadius,
    barrelLength,
    driverMaterial,
    72,
  );
  barrel.userData.role = 'single-rotating-barrel-cam-body';
  inputRotor.add(barrel);

  const grooveTrack = new THREE.Mesh(
    new THREE.TubeGeometry(
      grooveCurve,
      grooveSegments,
      grooveTubeRadius,
      grooveRadialSegments,
      true,
    ),
    grooveMaterial,
  );
  grooveTrack.userData.role = 'one-closed-two-helix-reversing-groove';
  inputRotor.add(grooveTrack);

  const grooveReversalPockets = [0, 0.5].map((parameter, index) => {
    const pocket = new THREE.Mesh(
      new THREE.SphereGeometry(grooveTubeRadius * 1.08, 20, 14),
      grooveMaterial,
    );
    pocket.position.copy(grooveCurve.getPoint(parameter));
    pocket.userData.role = 'joined-end-of-reversing-barrel-groove';
    pocket.userData.end = index === 0 ? 'left' : 'right';
    inputRotor.add(pocket);
    return pocket;
  });

  const camRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.34, 0.16),
    indexMaterial,
  );
  camRotationIndex.position.set(
    barrelHalfLength + 0.045,
    barrelRadius * 0.66,
    0,
  );
  camRotationIndex.userData.role = 'visible-rotation-index-on-barrel-end';
  inputRotor.add(camRotationIndex);

  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(ceilingLength, ceilingHeight, ceilingDepth),
    frameMaterial,
  );
  ceiling.position.set(0, ceilingY, frameZ);
  ceiling.userData.role = 'fixed-overhead-support-from-source-engraving';

  const guideRod = cylinderAlongX(
    guideRodRadius,
    guideRodLength,
    darkMaterial,
    32,
  );
  guideRod.position.y = followerGuideY;
  guideRod.userData.role = 'fixed-horizontal-guide-rod-for-reciprocating-follower';

  const guideSupports = guideSupportCentersX.map((centerX, index) => {
    const support = new THREE.Group();
    support.position.set(centerX, 0, 0);
    support.userData.role = 'fixed-hanging-bearing-for-follower-guide';
    support.userData.side = index === 0 ? 'left' : 'right';
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.18,
        ceilingY - ceilingHeight / 2 - followerGuideY,
        0.3,
      ),
      frameMaterial,
    );
    post.position.set(
      0,
      (ceilingY - ceilingHeight / 2 + followerGuideY) / 2,
      frameZ * 0.42,
    );
    post.userData.role = 'vertical-hanger-from-fixed-overhead-support';
    const bearing = annularSleeveAlongX({
      innerRadius: guideRodRadius + guideBearingClearance,
      length: guideSupportLength,
      material: frameMaterial,
      outerRadius: guideSupportOuterRadius,
    });
    bearing.position.y = followerGuideY;
    bearing.userData.role = 'bored-fixed-bearing-around-follower-guide-rod';
    support.add(post, bearing);
    return { bearing, post, support };
  });

  const follower = new THREE.Group();
  follower.userData.role = 'nonrotating-pin-follower-with-pure-horizontal-travel';
  const followerSleeve = annularSleeveAlongX({
    innerRadius: guideRodRadius + guideBearingClearance,
    length: followerSleeveLength,
    material: drivenMaterial,
    outerRadius: followerSleeveOuterRadius,
  });
  followerSleeve.position.y = followerGuideY;
  followerSleeve.userData.role = 'moving-bored-sleeve-on-fixed-horizontal-guide';

  const followerStem = makeBeam(
    new THREE.Vector3(0, followerStemTopY, 0),
    new THREE.Vector3(0, followerStemBottomY, 0),
    {
      color: PALETTE.driven,
      depth: followerStemDepth,
      thickness: followerStemThickness,
    },
  );
  followerStem.userData.role = 'rigid-drop-arm-from-guide-sleeve-to-groove-pin';

  const followerPin = new THREE.Mesh(
    new THREE.CylinderGeometry(
      followerPinRadius,
      followerPinRadius,
      followerPinLength,
      28,
    ),
    darkMaterial,
  );
  followerPin.position.y = (followerPinTopY + followerTipY) / 2;
  followerPin.userData.role = 'vertical-pin-entering-cylindrical-cam-groove';

  const followerTip = new THREE.Mesh(
    new THREE.SphereGeometry(followerTipRadius, 28, 18),
    drivenMaterial,
  );
  followerTip.scale.y = 0.74;
  followerTip.position.y = followerTipY;
  followerTip.userData.role = 'captured-rounded-tip-centered-in-cam-groove';

  const followerTranslationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.18, 0.08),
    indexMaterial,
  );
  followerTranslationIndex.position.set(
    followerSleeveLength / 2 + 0.045,
    followerGuideY + followerSleeveOuterRadius * 0.58,
    0,
  );
  followerTranslationIndex.userData.role = 'fixed-orientation-index-on-follower-sleeve';
  follower.add(
    followerSleeve,
    followerStem,
    followerPin,
    followerTip,
    followerTranslationIndex,
  );

  const camBearings = camBearingCentersX.map((centerX, index) => {
    const bearing = annularSleeveAlongX({
      innerRadius: camBearingInnerRadius,
      length: camBearingLength,
      material: frameMaterial,
      outerRadius: camBearingOuterRadius,
    });
    bearing.position.set(centerX, camCenterY, 0);
    bearing.userData.role = 'fixed-bearing-for-horizontal-barrel-cam-shaft';
    bearing.userData.side = index === 0 ? 'left' : 'right';
    return bearing;
  });

  const bearingPosts = camBearingCentersX.map((centerX, index) => {
    const post = makeBeam(
      new THREE.Vector3(centerX, baseY, frameZ),
      new THREE.Vector3(centerX, camCenterY, frameZ),
      { thickness: 0.16, depth: 0.22, color: PALETTE.frame },
    );
    post.userData.role = 'fixed-post-supporting-barrel-cam-bearing';
    post.userData.side = index === 0 ? 'left' : 'right';
    return post;
  });

  const baseRail = makeBeam(
    new THREE.Vector3(-1.18, baseY, frameZ),
    new THREE.Vector3(1.18, baseY, frameZ),
    { thickness: 0.19, depth: baseDepth, color: PALETTE.frame },
  );
  baseRail.userData.role = 'fixed-base-under-barrel-cam-bearings';

  root.add(
    input,
    ceiling,
    guideRod,
    ...guideSupports.map(({ support }) => support),
    follower,
    ...camBearings,
    ...bearingPosts,
    baseRail,
  );

  const stateAtDriverAngle = (driverAngle) => {
    const normalizedDriverAngle = positiveModulo(driverAngle, fullTurn);
    const contactLocalAngle = positiveModulo(-driverAngle, fullTurn);
    const leftReversalDistance = angularDistance(contactLocalAngle, 0);
    const rightReversalDistance = angularDistance(contactLocalAngle, Math.PI);
    const atLeftReversal = leftReversalDistance < 1e-10;
    const atRightReversal = rightReversalDistance < 1e-10;
    let grooveSlope;
    if (atLeftReversal) grooveSlope = -grooveSlopeMagnitude;
    else if (atRightReversal) grooveSlope = grooveSlopeMagnitude;
    else grooveSlope = contactLocalAngle < Math.PI
      ? grooveSlopeMagnitude
      : -grooveSlopeMagnitude;
    const followerX = grooveXAtAngle(contactLocalAngle);
    const followerVelocityX = -inputAngularSpeed * grooveSlope;
    const contactPoint = new THREE.Vector3(
      followerX,
      camCenterY + grooveCenterRadius,
      0,
    );
    const camSurfaceVelocity = new THREE.Vector3(
      0,
      0,
      inputAngularSpeed * grooveCenterRadius,
    );
    const followerVelocity = new THREE.Vector3(
      followerVelocityX,
      0,
      0,
    );
    const relativeGrooveVelocity = followerVelocity.clone()
      .sub(camSurfaceVelocity);
    const grooveTangent = new THREE.Vector3(
      grooveSlope,
      0,
      grooveCenterRadius,
    ).normalize();
    const radialNormal = Y_AXIS.clone();
    const flankNormal = new THREE.Vector3().crossVectors(
      radialNormal,
      grooveTangent,
    ).normalize();
    const stage = atLeftReversal
      ? 'left-end-instantaneous-reversal'
      : atRightReversal
        ? 'right-end-instantaneous-reversal'
        : followerVelocityX > 0
          ? 'uniform-rightward-traverse'
          : 'uniform-leftward-traverse';
    return {
      atReversal: atLeftReversal || atRightReversal,
      camSurfaceVelocity,
      contactLocalAngle,
      contactPoint,
      cyclePhase: positiveModulo(
        driverAngle - sourcePoseAngle,
        fullTurn,
      ) / fullTurn,
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      flankNormal,
      flankNormalVelocityError: relativeGrooveVelocity.dot(flankNormal),
      followerAcceleration: new THREE.Vector3(0, 0, 0),
      followerRotation: 0,
      followerVelocity,
      followerX,
      groovePhaseConstraintError: followerX
        - grooveXAtAngle(contactLocalAngle),
      grooveSlidingSpeed: relativeGrooveVelocity.dot(grooveTangent),
      grooveSlope,
      grooveTangent,
      inputRevolutions: (driverAngle - sourcePoseAngle) / fullTurn,
      normalizedDriverAngle,
      radialNormal,
      radialNormalVelocityError: relativeGrooveVelocity.dot(radialNormal),
      relativeGrooveVelocity,
      stage,
      surfaceRadiusError: Math.abs(
        Math.hypot(
          contactPoint.y - camCenterY,
          contactPoint.z,
        ) - grooveCenterRadius
      ),
      uniformSpeedError: Math.abs(followerVelocityX)
        - uniformFollowerSpeed,
      velocityDiscontinuousAtReversal: atLeftReversal || atRightReversal,
    };
  };
  const stateAtTime = (time) => stateAtDriverAngle(
    sourcePoseAngle + inputAngularSpeed * time,
  );

  root.userData.mechanism = 'single-closed-reversing-groove-barrel-cam';
  root.userData.cameraDistanceScale = 1.08;
  root.userData.blocks = {
    barrel,
    baseRail,
    bearingPosts,
    camBearings,
    camRotationIndex,
    ceiling,
    follower,
    followerPin,
    followerSleeve,
    followerStem,
    followerTip,
    followerTranslationIndex,
    grooveReversalPockets,
    grooveTrack,
    guideRod,
    guideSupports,
    input,
    inputRotor,
    inputShaft,
  };
  root.userData.curves = { groove: grooveCurve };
  root.userData.geometry = {
    axis: X_AXIS.clone(),
    barrelHalfLength,
    barrelLength,
    barrelRadius,
    baseDepth,
    baseY,
    camBearingCenterX,
    camBearingCentersX,
    camBearingInnerRadius,
    camBearingLength,
    camBearingOuterRadius,
    camCenterY,
    ceilingDepth,
    ceilingHeight,
    ceilingLength,
    ceilingY,
    cyclePeriod,
    followerAmplitude,
    followerGuideY,
    followerPinLength,
    followerPinRadius,
    followerSleeveLength,
    followerSleeveOuterRadius,
    followerStemBottomY,
    followerStemDepth,
    followerStemThickness,
    followerStemTopY,
    followerTipRadius,
    followerTipY,
    frameZ,
    fullTurn,
    grooveCenterRadius,
    grooveRadialSegments,
    grooveSegments,
    grooveSlopeMagnitude,
    grooveTubeRadius,
    guideBearingClearance,
    guideRodLength,
    guideRodRadius,
    guideSupportCentersX,
    guideSupportLength,
    guideSupportOuterRadius,
    inputAngularSpeed,
    outputStroke,
    shaftLength,
    shaftRadius,
    sourceBarrelAxialWidth,
    sourceBarrelDiameter,
    sourceGrooveTraverse,
    sourceGuideRodSpan,
    sourceGuideSupportSpacing,
    sourcePoseAngle,
    uniformFollowerSpeed,
  };
  root.userData.grooveXAtAngle = grooveXAtAngle;
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.set(state.driverAngle, 0, 0);
    input.userData.angularSpeed = state.driverAngularSpeed;
    follower.position.set(state.followerX, 0, 0);
    follower.rotation.set(0, 0, 0);
    follower.userData.velocity = state.followerVelocity.clone();
    root.userData.contacts = {
      barrelGroove: {
        contactLocalAngle: state.contactLocalAngle,
        contactPoint: state.contactPoint.clone(),
        flankNormal: state.flankNormal.clone(),
        flankNormalVelocityError: state.flankNormalVelocityError,
        oneContinuousClosedGroove: true,
        phaseConstraintError: state.groovePhaseConstraintError,
        radialNormal: state.radialNormal.clone(),
        radialNormalVelocityError: state.radialNormalVelocityError,
        reversalIsInstantaneous: state.atReversal,
        slidingSpeed: state.grooveSlidingSpeed,
        surfaceRadiusError: state.surfaceRadiusError,
        tangent: state.grooveTangent.clone(),
      },
      camShaftBearings: {
        axis: X_AXIS.clone(),
        radialClearance: camBearingInnerRadius - shaftRadius,
      },
      followerGuide: {
        axis: X_AXIS.clone(),
        boreClearance: guideBearingClearance,
        lineError: Math.hypot(follower.position.y, follower.position.z),
        rotationError: 0,
      },
      followerPin: {
        centerError: new THREE.Vector3(
          follower.position.x,
          followerTip.position.y,
          followerTip.position.z,
        ).distanceTo(state.contactPoint),
        captured: true,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(0.8, 3.8, 12));
}

function sixStrokeSerpentineGrooveCamMotion() {
  const base = cylindricalReversingGrooveCamMotion();
  const { root } = base;
  const {
    follower,
    followerPin,
    followerTip,
    grooveReversalPockets: oldGrooveReversalPockets,
    grooveTrack: oldGrooveTrack,
    input,
    inputRotor,
  } = root.userData.blocks;
  const baseGeometry = root.userData.geometry;
  const fullTurn = Math.PI * 2;
  const reciprocationsPerRevolution = 6;
  const halfStrokeCount = reciprocationsPerRevolution * 2;
  const halfStrokeAngle = fullTurn / halfStrokeCount;
  const sourceVisibleWaveCount = 3;
  const sourcePoseAngle = Math.PI / 12;
  const inputAngularSpeed = 0.42;
  const cyclePeriod = fullTurn / inputAngularSpeed;
  const followerAmplitude = 0.37;
  const outputStroke = followerAmplitude * 2;
  const grooveCenterRadius = baseGeometry.barrelRadius - 0.025;
  const grooveSlopeMagnitude = outputStroke / halfStrokeAngle;
  const uniformFollowerSpeed = grooveSlopeMagnitude * inputAngularSpeed;
  const grooveSegments = 768;
  const sourceGrooveTraverse = 60;

  const positiveModulo = (value, modulus) => (
    ((value % modulus) + modulus) % modulus
  );
  const grooveXAtAngle = (angle) => {
    const normalizedAngle = positiveModulo(angle, fullTurn);
    const segmentIndex = Math.min(
      Math.floor(normalizedAngle / halfStrokeAngle),
      halfStrokeCount - 1,
    );
    const segmentFraction = (
      normalizedAngle - segmentIndex * halfStrokeAngle
    ) / halfStrokeAngle;
    return segmentIndex % 2 === 0
      ? -followerAmplitude + outputStroke * segmentFraction
      : followerAmplitude - outputStroke * segmentFraction;
  };
  const grooveSlopeAtAngle = (angle) => {
    const normalizedAngle = positiveModulo(angle, fullTurn);
    const segmentIndex = Math.min(
      Math.floor(normalizedAngle / halfStrokeAngle),
      halfStrokeCount - 1,
    );
    return segmentIndex % 2 === 0
      ? grooveSlopeMagnitude
      : -grooveSlopeMagnitude;
  };
  const angularDistance = (left, right) => Math.abs(Math.atan2(
    Math.sin(left - right),
    Math.cos(left - right),
  ));

  const grooveCurve = new class extends THREE.Curve {
    getPoint(parameter, target = new THREE.Vector3()) {
      const angle = parameter * fullTurn;
      return target.set(
        grooveXAtAngle(angle),
        grooveCenterRadius * Math.cos(angle),
        grooveCenterRadius * Math.sin(angle),
      );
    }
  }();
  grooveCurve.arcLengthDivisions = grooveSegments;

  const grooveMaterial = oldGrooveTrack.material;
  inputRotor.remove(oldGrooveTrack, ...oldGrooveReversalPockets);
  oldGrooveTrack.geometry.dispose();
  for (const pocket of oldGrooveReversalPockets) pocket.geometry.dispose();

  const grooveTrack = new THREE.Mesh(
    new THREE.TubeGeometry(
      grooveCurve,
      grooveSegments,
      baseGeometry.grooveTubeRadius,
      baseGeometry.grooveRadialSegments,
      true,
    ),
    grooveMaterial,
  );
  grooveTrack.userData.role = 'one-closed-twelve-branch-serpentine-barrel-groove';
  inputRotor.add(grooveTrack);

  const grooveReversalPockets = Array.from(
    { length: halfStrokeCount },
    (_, reversalIndex) => {
      const parameter = reversalIndex / halfStrokeCount;
      const pocket = new THREE.Mesh(
        new THREE.SphereGeometry(
          baseGeometry.grooveTubeRadius * 1.06,
          18,
          12,
        ),
        grooveMaterial,
      );
      pocket.position.copy(grooveCurve.getPoint(parameter));
      pocket.userData.role = 'joined-end-of-one-serpentine-half-stroke';
      pocket.userData.reversalIndex = reversalIndex;
      inputRotor.add(pocket);
      return pocket;
    },
  );

  input.userData.role = 'horizontal-shaft-with-six-stroke-serpentine-barrel-cam';
  root.userData.mechanism = 'six-reciprocation-serpentine-groove-barrel-cam';
  const followerPinTopY = followerPin.position.y
    + baseGeometry.followerPinLength / 2;
  const followerTipY = baseGeometry.camCenterY + grooveCenterRadius;
  const followerPinLength = followerPinTopY - followerTipY;
  followerPin.geometry.dispose();
  followerPin.geometry = new THREE.CylinderGeometry(
    baseGeometry.followerPinRadius,
    baseGeometry.followerPinRadius,
    followerPinLength,
    28,
  );
  followerPin.position.y = (followerPinTopY + followerTipY) / 2;
  followerTip.position.y = followerTipY;

  const stateAtDriverAngle = (driverAngle) => {
    const normalizedDriverAngle = positiveModulo(driverAngle, fullTurn);
    const contactLocalAngle = positiveModulo(-driverAngle, fullTurn);
    const nearestRawReversalIndex = Math.round(
      contactLocalAngle / halfStrokeAngle,
    );
    const reversalIndex = positiveModulo(
      nearestRawReversalIndex,
      halfStrokeCount,
    );
    const reversalAngle = reversalIndex * halfStrokeAngle;
    const atReversal = angularDistance(
      contactLocalAngle,
      reversalAngle,
    ) < 1e-10;
    const outgoingSegmentIndex = positiveModulo(
      reversalIndex - 1,
      halfStrokeCount,
    );
    const grooveSlope = atReversal
      ? outgoingSegmentIndex % 2 === 0
        ? grooveSlopeMagnitude
        : -grooveSlopeMagnitude
      : grooveSlopeAtAngle(contactLocalAngle);
    const followerX = grooveXAtAngle(contactLocalAngle);
    const followerVelocityX = -inputAngularSpeed * grooveSlope;
    const contactPoint = new THREE.Vector3(
      followerX,
      baseGeometry.camCenterY + grooveCenterRadius,
      0,
    );
    const camSurfaceVelocity = new THREE.Vector3(
      0,
      0,
      inputAngularSpeed * grooveCenterRadius,
    );
    const followerVelocity = new THREE.Vector3(
      followerVelocityX,
      0,
      0,
    );
    const relativeGrooveVelocity = followerVelocity.clone()
      .sub(camSurfaceVelocity);
    const grooveTangent = new THREE.Vector3(
      grooveSlope,
      0,
      grooveCenterRadius,
    ).normalize();
    const radialNormal = Y_AXIS.clone();
    const flankNormal = new THREE.Vector3().crossVectors(
      radialNormal,
      grooveTangent,
    ).normalize();
    return {
      atReversal,
      camSurfaceVelocity,
      contactLocalAngle,
      contactPoint,
      cyclePhase: positiveModulo(
        driverAngle - sourcePoseAngle,
        fullTurn,
      ) / fullTurn,
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      flankNormal,
      flankNormalVelocityError: relativeGrooveVelocity.dot(flankNormal),
      followerAcceleration: new THREE.Vector3(0, 0, 0),
      followerRotation: 0,
      followerVelocity,
      followerX,
      groovePhaseConstraintError: followerX
        - grooveXAtAngle(contactLocalAngle),
      grooveSlidingSpeed: relativeGrooveVelocity.dot(grooveTangent),
      grooveSlope,
      grooveTangent,
      halfStrokeIndex: Math.floor(
        contactLocalAngle / halfStrokeAngle,
      ),
      inputRevolutions: (driverAngle - sourcePoseAngle) / fullTurn,
      normalizedDriverAngle,
      outputCycles: (driverAngle - sourcePoseAngle) / fullTurn
        * reciprocationsPerRevolution,
      radialNormal,
      radialNormalVelocityError: relativeGrooveVelocity.dot(radialNormal),
      reciprocationIndex: Math.floor(
        contactLocalAngle / (halfStrokeAngle * 2),
      ),
      relativeGrooveVelocity,
      reversalIndex: atReversal ? reversalIndex : null,
      stage: atReversal
        ? 'instantaneous-serpentine-groove-reversal'
        : followerVelocityX > 0
          ? 'uniform-rightward-serpentine-traverse'
          : 'uniform-leftward-serpentine-traverse',
      surfaceRadiusError: Math.abs(
        Math.hypot(
          contactPoint.y - baseGeometry.camCenterY,
          contactPoint.z,
        ) - grooveCenterRadius
      ),
      uniformSpeedError: Math.abs(followerVelocityX)
        - uniformFollowerSpeed,
      velocityDiscontinuousAtReversal: atReversal,
    };
  };
  const stateAtTime = (time) => stateAtDriverAngle(
    sourcePoseAngle + inputAngularSpeed * time,
  );

  root.userData.blocks.grooveTrack = grooveTrack;
  root.userData.blocks.grooveReversalPockets = grooveReversalPockets;
  root.userData.curves = { groove: grooveCurve };
  root.userData.geometry = {
    ...baseGeometry,
    cyclePeriod,
    followerAmplitude,
    followerPinLength,
    followerTipY,
    grooveCenterRadius,
    grooveSegments,
    grooveSlopeMagnitude,
    halfStrokeAngle,
    halfStrokeCount,
    inputAngularSpeed,
    outputStroke,
    reciprocationsPerRevolution,
    sourceGrooveTraverse,
    sourcePoseAngle,
    sourceVisibleWaveCount,
    uniformFollowerSpeed,
  };
  root.userData.grooveXAtAngle = grooveXAtAngle;
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.set(state.driverAngle, 0, 0);
    input.userData.angularSpeed = state.driverAngularSpeed;
    follower.position.set(state.followerX, 0, 0);
    follower.rotation.set(0, 0, 0);
    follower.userData.velocity = state.followerVelocity.clone();
    root.userData.contacts = {
      barrelGroove: {
        contactLocalAngle: state.contactLocalAngle,
        contactPoint: state.contactPoint.clone(),
        flankNormal: state.flankNormal.clone(),
        flankNormalVelocityError: state.flankNormalVelocityError,
        halfStrokesPerInputRevolution: halfStrokeCount,
        oneContinuousClosedGroove: true,
        phaseConstraintError: state.groovePhaseConstraintError,
        radialNormal: state.radialNormal.clone(),
        radialNormalVelocityError: state.radialNormalVelocityError,
        reciprocationsPerInputRevolution: reciprocationsPerRevolution,
        reversalIndex: state.reversalIndex,
        reversalIsInstantaneous: state.atReversal,
        slidingSpeed: state.grooveSlidingSpeed,
        surfaceRadiusError: state.surfaceRadiusError,
        tangent: state.grooveTangent.clone(),
      },
      camShaftBearings: {
        axis: X_AXIS.clone(),
        radialClearance: baseGeometry.camBearingInnerRadius
          - baseGeometry.shaftRadius,
      },
      followerGuide: {
        axis: X_AXIS.clone(),
        boreClearance: baseGeometry.guideBearingClearance,
        lineError: Math.hypot(follower.position.y, follower.position.z),
        rotationError: 0,
      },
      followerPin: {
        centerError: new THREE.Vector3(
          follower.position.x,
          followerTip.position.y,
          followerTip.position.z,
        ).distanceTo(state.contactPoint),
        captured: true,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(0.55, 2.15, 12.5));
}

function threeWiperReciprocatingFrame() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const wiperCount = 3;
  const wiperAngularSpacing = fullTurn / wiperCount;
  const halfStrokeAngle = wiperAngularSpacing / 2;

  // Measurements are taken from the public-domain engraving. The three
  // imperfect raster centers resolve to the intended 30, 150, and 270 degree
  // construction, while the two frame faces are half-turn copies of one
  // another. Working dimensions below retain those proportions and use exact
  // conjugate roller-envelope geometry.
  const sourceRasterShaftCenter = new THREE.Vector2(258, -260);
  const sourceRasterWiperCenters = [
    new THREE.Vector2(342, -203),
    new THREE.Vector2(168, -205),
    new THREE.Vector2(260, -372),
  ];
  const sourceRasterFrameOuterHalfWidth = 237.5;
  const sourceRasterFrameOuterHalfHeight = 177;
  const sourceRasterFrameInnerHalfWidth = 188.5;
  const sourceRasterFrameInnerHalfHeight = 144;
  const sourceRasterHubRadius = 46;
  const sourceRasterWiperHeadRadius = 20;
  const sourceRasterWiperCenterRadius = sourceRasterWiperCenters.reduce(
    (sum, center) => sum + center.distanceTo(sourceRasterShaftCenter),
    0,
  ) / wiperCount;
  const sourceScale = 0.01365;

  const sourcePoseAngle = Math.PI / 6;
  const inputSpeedMagnitude = 0.76;
  const inputAngularSpeed = -inputSpeedMagnitude;
  const cyclePeriod = fullTurn / inputSpeedMagnitude;
  const outputCyclesPerInputRevolution = 3;
  const outputReversalsPerInputRevolution = 6;
  const outputAmplitude = 0.38;
  const outputStroke = outputAmplitude * 2;
  const outputAngularFrequency = outputCyclesPerInputRevolution
    * inputAngularSpeed;

  const wiperCenterRadius = sourceRasterWiperCenterRadius * sourceScale;
  const wiperHeadRadius = sourceRasterWiperHeadRadius * sourceScale;
  const hubRadius = sourceRasterHubRadius * sourceScale;
  const hubDepth = 0.46;
  const wiperHeadDepth = 0.36;
  const wiperArmDepth = 0.2;
  const wiperArmWidth = 0.17;
  const wiperArmInnerRadius = hubRadius * 0.58;
  const wiperArmOuterRadius = wiperCenterRadius - wiperHeadRadius * 0.42;
  const wiperArmLength = wiperArmOuterRadius - wiperArmInnerRadius;
  const shaftRadius = 0.12;
  const shaftLength = 1.5;

  const frameOuterHalfWidth = 3.15;
  const frameOuterHalfHeight = 2.35;
  const frameInnerHalfWidth = 2.43;
  const frameInnerHalfHeight = 1.82;
  const frameOuterCornerRadius = 0.55;
  const frameInnerCornerRadius = 0.38;
  const frameDepth = 0.38;
  const gateThickness = 0.38;
  const gateProfileSegmentCount = 120;
  const transitionTolerance = 1e-10;

  const slideRodRadius = 0.12;
  const slideRodLength = 1.9;
  const guideSleeveCentersX = [-4.25, 4.25];
  const guideSleeveLength = 0.56;
  const guideSleeveInnerRadius = slideRodRadius + 0.028;
  const guideSleeveOuterRadius = 0.28;
  const rearFrameZ = -0.55;
  const baseY = -3.05;
  const baseRailLength = 9.5;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.6,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.11,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.49,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.69,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const frameDisplacementAtDriverAngle = (driverAngle) => (
    outputAmplitude * Math.cos(
      outputCyclesPerInputRevolution * driverAngle,
    )
  );
  const rightGateProfileAtWiperAngle = (wiperAngle) => {
    const frameDisplacement = frameDisplacementAtDriverAngle(wiperAngle);
    const cosine = Math.cos(wiperAngle);
    const sine = Math.sin(wiperAngle);
    const tripleSine = Math.sin(
      outputCyclesPerInputRevolution * wiperAngle,
    );
    const pitchPoint = new THREE.Vector2(
      wiperCenterRadius * cosine - frameDisplacement,
      wiperCenterRadius * sine,
    );
    const pitchTangent = new THREE.Vector2(
      -wiperCenterRadius * sine
        + outputCyclesPerInputRevolution
          * outputAmplitude * tripleSine,
      wiperCenterRadius * cosine,
    );
    const gateNormal = new THREE.Vector2(
      pitchTangent.y,
      -pitchTangent.x,
    ).normalize();
    const profilePoint = pitchPoint.clone().addScaledVector(
      gateNormal,
      wiperHeadRadius,
    );
    return {
      gateNormal,
      pitchPoint,
      pitchTangent,
      profilePoint,
      profileTangent: pitchTangent.clone().normalize(),
      wiperAngle,
    };
  };

  const rightGateProfileSamples = Array.from(
    { length: gateProfileSegmentCount + 1 },
    (_, index) => rightGateProfileAtWiperAngle(
      index / gateProfileSegmentCount * halfStrokeAngle,
    ),
  );
  const leftGateProfileSamples = rightGateProfileSamples.map((sample) => ({
    gateNormal: sample.gateNormal.clone().multiplyScalar(-1),
    pitchPoint: sample.pitchPoint.clone().multiplyScalar(-1),
    pitchTangent: sample.pitchTangent.clone().multiplyScalar(-1),
    profilePoint: sample.profilePoint.clone().multiplyScalar(-1),
    profileTangent: sample.profileTangent.clone().multiplyScalar(-1),
    wiperAngle: sample.wiperAngle + Math.PI,
  }));

  const gateShape = new THREE.Shape();
  gateShape.moveTo(
    rightGateProfileSamples[0].profilePoint.x,
    rightGateProfileSamples[0].profilePoint.y,
  );
  for (const sample of rightGateProfileSamples.slice(1)) {
    gateShape.lineTo(sample.profilePoint.x, sample.profilePoint.y);
  }
  const rightGateOuterSamples = rightGateProfileSamples.map((sample) => (
    sample.profilePoint.clone().addScaledVector(
      sample.gateNormal,
      gateThickness,
    )
  ));
  for (const point of [...rightGateOuterSamples].reverse()) {
    gateShape.lineTo(point.x, point.y);
  }
  gateShape.closePath();

  const slidingFrame = new THREE.Group();
  slidingFrame.userData.axis = X_AXIS.clone();
  slidingFrame.userData.role = 'single-horizontally-reciprocating-rectangular-frame';
  const frameBody = new THREE.Mesh(
    centeredExtrusion(roundedRectangleRingShape({
      innerCornerRadius: frameInnerCornerRadius,
      innerHalfHeight: frameInnerHalfHeight,
      innerHalfWidth: frameInnerHalfWidth,
      outerCornerRadius: frameOuterCornerRadius,
      outerHalfHeight: frameOuterHalfHeight,
      outerHalfWidth: frameOuterHalfWidth,
    }), frameDepth, 0.026),
    drivenMaterial,
  );
  frameBody.userData.role = 'closed-rounded-rectangular-moving-frame-body';

  const rightGate = new THREE.Mesh(
    centeredExtrusion(gateShape, frameDepth * 1.02, 0.014),
    drivenMaterial,
  );
  rightGate.userData.role = 'upper-right-integral-conjugate-wiper-face';
  rightGate.userData.side = 'right';
  const leftGate = rightGate.clone();
  leftGate.rotation.z = Math.PI;
  leftGate.userData.role = 'lower-left-integral-conjugate-wiper-face';
  leftGate.userData.side = 'left';


  const slideRods = [-1, 1].map((sideSign) => {
    const rod = cylinderAlongX(
      slideRodRadius,
      slideRodLength,
      drivenMaterial,
      26,
    );
    rod.position.set(
      sideSign * (frameOuterHalfWidth + slideRodLength / 2 - 0.08),
      0,
      -0.02,
    );
    rod.userData.axis = X_AXIS.clone();
    rod.userData.role = sideSign < 0
      ? 'left-output-slide-rod-fixed-to-frame'
      : 'right-output-slide-rod-fixed-to-frame';
    rod.userData.side = sideSign < 0 ? 'left' : 'right';
    return rod;
  });
  const translationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 18, 12),
    indexMaterial,
  );
  translationIndex.position.set(
    frameOuterHalfWidth - 0.58,
    -frameOuterHalfHeight + 0.24,
    frameDepth / 2 + 0.065,
  );
  translationIndex.userData.role = 'white-index-on-reciprocating-frame';
  slidingFrame.add(
    frameBody,
    rightGate,
    leftGate,
    ...slideRods,
    translationIndex,
  );

  const input = planarRotor();
  input.userData.role = 'continuous-clockwise-shaft-carrying-three-wipers';
  const inputRotor = input.userData.rotor;
  inputRotor.userData.role = 'one-rigid-three-wiper-rotor';
  const wiperArms = [];
  const wiperHeads = [];
  for (let index = 0; index < wiperCount; index += 1) {
    const localAngle = index * wiperAngularSpacing;
    const cosine = Math.cos(localAngle);
    const sine = Math.sin(localAngle);
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(wiperArmLength, wiperArmWidth, wiperArmDepth),
      driverMaterial,
    );
    const armCenterRadius = (wiperArmInnerRadius + wiperArmOuterRadius) / 2;
    arm.position.set(
      armCenterRadius * cosine,
      armCenterRadius * sine,
      0.02,
    );
    arm.rotation.z = localAngle;
    arm.userData.index = index;
    arm.userData.localAngle = localAngle;
    arm.userData.role = 'rigid-radial-wiper-arm';

    const head = cylinderAlongZ(
      wiperHeadRadius,
      wiperHeadDepth,
      driverMaterial,
      40,
    );
    head.position.set(
      wiperCenterRadius * cosine,
      wiperCenterRadius * sine,
      0.03,
    );
    head.userData.index = index;
    head.userData.localAngle = localAngle;
    head.userData.radius = wiperHeadRadius;
    head.userData.role = 'rounded-wiper-head-rigid-with-input-shaft';

    wiperArms.push(arm);
    wiperHeads.push(head);
  }

  const rotorHub = cylinderAlongZ(hubRadius, hubDepth, driverMaterial, 52);
  rotorHub.position.z = 0.025;
  rotorHub.userData.role = 'central-hub-rigid-with-all-three-wipers';
  const rotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(hubRadius * 0.52, 0.055, 0.028),
    indexMaterial,
  );
  rotationIndex.position.set(
    hubRadius * 0.34,
    0,
    hubDepth / 2 + 0.102,
  );
  rotationIndex.userData.role = 'white-phase-index-on-three-wiper-shaft';
  const inputShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
    30,
  );
  inputShaft.position.z = -0.08;
  inputShaft.userData.axis = Z_AXIS.clone();
  inputShaft.userData.role = 'input-shaft-fast-to-all-three-wipers';
  inputRotor.add(
    ...wiperArms,
    ...wiperHeads,
    rotorHub,
    rotationIndex,
    inputShaft,
  );

  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(baseRailLength, 0.16, 0.3),
    frameMaterial,
  );
  baseRail.position.set(0, baseY, rearFrameZ);
  baseRail.userData.role = 'fixed-base-of-three-wiper-demonstrator';
  const shaftPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, -baseY, 0.28),
    frameMaterial,
  );
  shaftPost.position.set(0, baseY / 2, rearFrameZ);
  shaftPost.userData.role = 'fixed-post-holding-three-wiper-input-shaft';
  const shaftBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.07, 9, 40),
    frameMaterial,
  );
  shaftBearing.position.set(0, 0, rearFrameZ + 0.18);
  shaftBearing.userData.axis = Z_AXIS.clone();
  shaftBearing.userData.role = 'fixed-bearing-behind-three-wiper-shaft';

  const guideSleeves = [];
  const guidePosts = [];
  for (const centerX of guideSleeveCentersX) {
    const side = centerX < 0 ? 'left' : 'right';
    const sleeve = annularSleeveAlongX({
      innerRadius: guideSleeveInnerRadius,
      length: guideSleeveLength,
      material: frameMaterial,
      outerRadius: guideSleeveOuterRadius,
    });
    sleeve.position.set(centerX, 0, -0.02);
    sleeve.userData.axis = X_AXIS.clone();
    sleeve.userData.role = `${side}-fixed-horizontal-frame-guide-sleeve`;
    const postHeight = -baseY;
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, postHeight, 0.25),
      frameMaterial,
    );
    post.position.set(centerX, baseY / 2, rearFrameZ);
    post.userData.role = `${side}-fixed-guide-support-post`;
    guideSleeves.push(sleeve);
    guidePosts.push(post);
  }

  const contactMarkers = Array.from({ length: 2 }, (_, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.064, 18, 12),
      indexMaterial,
    );
    marker.userData.contactSlot = index;
    marker.userData.role = 'white-wiper-frame-contact-witness';
    return marker;
  });
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(10.4, 7.1, 0.01),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0, -0.18, rearFrameZ - 0.2);
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-three-wiper-frame-camera-envelope';
  root.add(
    cameraEnvelope,
    baseRail,
    shaftPost,
    shaftBearing,
    ...guideSleeves,
    ...guidePosts,
    slidingFrame,
    input,
    ...contactMarkers,
  );

  const angularDistance = (left, right) => Math.abs(Math.atan2(
    Math.sin(left - right),
    Math.cos(left - right),
  ));
  const activeContactsAtDriverAngle = (
    driverAngle,
    frameDisplacement,
    frameVelocityX,
  ) => {
    const contacts = [];
    for (let index = 0; index < wiperCount; index += 1) {
      const unwrappedWiperAngle = driverAngle
        + index * wiperAngularSpacing;
      let normalizedWiperAngle = THREE.MathUtils.euclideanModulo(
        unwrappedWiperAngle,
        fullTurn,
      );
      if (angularDistance(normalizedWiperAngle, 0) < transitionTolerance) {
        normalizedWiperAngle = 0;
      }
      const candidates = [];
      if (normalizedWiperAngle >= -transitionTolerance
        && normalizedWiperAngle <= halfStrokeAngle + transitionTolerance) {
        candidates.push({
          profileAngle: THREE.MathUtils.clamp(
            normalizedWiperAngle,
            0,
            halfStrokeAngle,
          ),
          side: 'right',
        });
      }
      if (normalizedWiperAngle >= Math.PI - transitionTolerance
        && normalizedWiperAngle
          <= Math.PI + halfStrokeAngle + transitionTolerance) {
        candidates.push({
          profileAngle: THREE.MathUtils.clamp(
            normalizedWiperAngle - Math.PI,
            0,
            halfStrokeAngle,
          ),
          side: 'left',
        });
      }
      for (const candidate of candidates) {
        const rightProfile = rightGateProfileAtWiperAngle(
          candidate.profileAngle,
        );
        const sideSign = candidate.side === 'right' ? 1 : -1;
        const gateNormal2 = rightProfile.gateNormal.clone()
          .multiplyScalar(sideSign);
        const profileTangent2 = rightProfile.profileTangent.clone()
          .multiplyScalar(sideSign);
        const frameLocalPoint2 = rightProfile.profilePoint.clone()
          .multiplyScalar(sideSign);
        const framePoint = new THREE.Vector3(
          frameDisplacement + frameLocalPoint2.x,
          frameLocalPoint2.y,
          0,
        );
        const gateNormal = new THREE.Vector3(
          gateNormal2.x,
          gateNormal2.y,
          0,
        );
        const profileTangent = new THREE.Vector3(
          profileTangent2.x,
          profileTangent2.y,
          0,
        );
        const wiperCenter = new THREE.Vector3(
          wiperCenterRadius * Math.cos(unwrappedWiperAngle),
          wiperCenterRadius * Math.sin(unwrappedWiperAngle),
          0,
        );
        const wiperPoint = wiperCenter.clone().addScaledVector(
          gateNormal,
          wiperHeadRadius,
        );
        const wiperSurfaceVelocity = new THREE.Vector3().crossVectors(
          Z_AXIS.clone().multiplyScalar(inputAngularSpeed),
          wiperPoint,
        );
        const frameVelocity = new THREE.Vector3(frameVelocityX, 0, 0);
        const relativeSurfaceVelocity = wiperSurfaceVelocity.clone().sub(
          frameVelocity,
        );
        contacts.push({
          frameLocalPoint: new THREE.Vector3(
            frameLocalPoint2.x,
            frameLocalPoint2.y,
            0,
          ),
          framePoint,
          frameVelocity,
          gateNormal,
          normalVelocityError: relativeSurfaceVelocity.dot(gateNormal),
          pointCoincidenceError: framePoint.distanceTo(wiperPoint),
          profileAngle: candidate.profileAngle,
          profileTangent,
          relativeSurfaceVelocity,
          side: candidate.side,
          slidingSpeed: relativeSurfaceVelocity.dot(profileTangent),
          unwrappedWiperAngle,
          wiperCenter,
          wiperIndex: index,
          wiperPoint,
          wiperSurfaceVelocity,
        });
      }
    }
    return contacts;
  };

  const stateAtTime = (time) => {
    const driverAngle = sourcePoseAngle + inputAngularSpeed * time;
    const outputPhaseAngle = outputCyclesPerInputRevolution * driverAngle;
    const frameDisplacement = outputAmplitude * Math.cos(outputPhaseAngle);
    const frameVelocityX = -outputAmplitude
      * outputCyclesPerInputRevolution
      * Math.sin(outputPhaseAngle)
      * inputAngularSpeed;
    const frameAccelerationX = -outputAmplitude
      * outputCyclesPerInputRevolution ** 2
      * Math.cos(outputPhaseAngle)
      * inputAngularSpeed ** 2;
    const wiperAngles = Array.from({ length: wiperCount }, (_, index) => (
      driverAngle + index * wiperAngularSpacing
    ));
    const cycleAngle = THREE.MathUtils.euclideanModulo(
      driverAngle,
      wiperAngularSpacing,
    );
    const atRightLimit = angularDistance(cycleAngle, 0)
        < transitionTolerance
      || Math.abs(cycleAngle - wiperAngularSpacing) < transitionTolerance;
    const atLeftLimit = Math.abs(cycleAngle - halfStrokeAngle)
      < transitionTolerance;
    const contacts = activeContactsAtDriverAngle(
      driverAngle,
      frameDisplacement,
      frameVelocityX,
    );
    let stage;
    if (atRightLimit) {
      stage = 'two-wiper-handoff-at-right-frame-limit';
    } else if (atLeftLimit) {
      stage = 'two-wiper-handoff-at-left-frame-limit';
    } else if (frameVelocityX > 0) {
      stage = 'upper-right-wiper-face-drives-frame-right';
    } else {
      stage = 'lower-left-wiper-face-drives-frame-left';
    }
    return {
      atLeftLimit,
      atRightLimit,
      contactCount: contacts.length,
      contacts,
      cycleAngle,
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      frameAcceleration: new THREE.Vector3(frameAccelerationX, 0, 0),
      frameAccelerationX,
      frameDisplacement,
      framePosition: new THREE.Vector3(frameDisplacement, 0, 0),
      frameRotation: 0,
      frameVelocity: new THREE.Vector3(frameVelocityX, 0, 0),
      frameVelocityX,
      outputCyclesPerInputRevolution,
      outputPhaseAngle,
      outputReversalsPerInputRevolution,
      stage,
      tangentialSlidingContact: true,
      velocityDiscontinuous: false,
      wiperAngles,
      wiperCount,
    };
  };

  root.userData.mechanism = 'three-wiper-positive-drive-reciprocating-frame';
  root.userData.blocks = {
    baseRail,
    cameraEnvelope,
    contactMarkers,
    frameBody,
    guidePosts,
    guideSleeves,
    input,
    inputRotor,
    inputShaft,
    leftGate,
    rightGate,
    rotationIndex,
    rotorHub,
    shaftBearing,
    shaftPost,
    slideRods,
    slidingFrame,
    translationIndex,
    wiperArms,
    wiperHeads,
  };
  root.userData.curves = {
    leftGateProfileSamples,
    rightGateProfileSamples,
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    baseRailLength,
    baseY,
    cyclePeriod,
    frameDepth,
    frameInnerCornerRadius,
    frameInnerHalfHeight,
    frameInnerHalfWidth,
    frameOuterCornerRadius,
    frameOuterHalfHeight,
    frameOuterHalfWidth,
    fullTurn,
    gateProfileSegmentCount,
    gateThickness,
    guideSleeveCentersX,
    guideSleeveInnerRadius,
    guideSleeveLength,
    guideSleeveOuterRadius,
    halfStrokeAngle,
    hubDepth,
    hubRadius,
    inputAngularSpeed,
    inputSpeedMagnitude,
    outputAmplitude,
    outputAngularFrequency,
    outputCyclesPerInputRevolution,
    outputReversalsPerInputRevolution,
    outputStroke,
    shaftLength,
    shaftRadius,
    slideRodLength,
    slideRodRadius,
    sourcePoseAngle,
    sourceRasterFrameInnerHalfHeight,
    sourceRasterFrameInnerHalfWidth,
    sourceRasterFrameOuterHalfHeight,
    sourceRasterFrameOuterHalfWidth,
    sourceRasterHubRadius,
    sourceRasterShaftCenter: sourceRasterShaftCenter.clone(),
    sourceRasterWiperCenterRadius,
    sourceRasterWiperCenters: sourceRasterWiperCenters.map(
      (center) => center.clone(),
    ),
    sourceRasterWiperHeadRadius,
    sourceScale,
    transitionTolerance,
    wiperAngularSpacing,
    wiperArmDepth,
    wiperArmInnerRadius,
    wiperArmLength,
    wiperArmOuterRadius,
    wiperArmWidth,
    wiperCenterRadius,
    wiperCount,
    wiperHeadDepth,
    wiperHeadRadius,
  };
  root.userData.activeContactsAtDriverAngle = activeContactsAtDriverAngle;
  root.userData.frameDisplacementAtDriverAngle = (
    frameDisplacementAtDriverAngle
  );
  root.userData.rightGateProfileAtWiperAngle = (
    rightGateProfileAtWiperAngle
  );
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.set(0, 0, state.driverAngle);
    input.userData.angularSpeed = state.driverAngularSpeed;
    inputRotor.userData.angularSpeed = state.driverAngularSpeed;
    slidingFrame.position.copy(state.framePosition);
    slidingFrame.rotation.set(0, 0, 0);
    slidingFrame.userData.velocity = state.frameVelocity.clone();
    contactMarkers.forEach((marker, index) => {
      const contact = state.contacts[index];
      marker.visible = Boolean(contact);
      if (!contact) return;
      marker.position.copy(contact.framePoint);
      marker.position.z = frameDepth / 2 + 0.125;
      marker.userData.side = contact.side;
      marker.userData.wiperIndex = contact.wiperIndex;
    });
    root.userData.contacts = {
      horizontalFrameGuides: {
        axis: X_AXIS.clone(),
        boreClearance: guideSleeveInnerRadius - slideRodRadius,
        frameRotationError: Math.abs(state.frameRotation),
        lineError: Math.hypot(
          state.framePosition.y,
          state.framePosition.z,
        ),
      },
      opposedConjugateFaces: {
        activeContacts: state.contacts.map((contact) => ({
          framePoint: contact.framePoint.clone(),
          gateNormal: contact.gateNormal.clone(),
          normalVelocityError: contact.normalVelocityError,
          pointCoincidenceError: contact.pointCoincidenceError,
          profileAngle: contact.profileAngle,
          side: contact.side,
          slidingSpeed: contact.slidingSpeed,
          wiperIndex: contact.wiperIndex,
          wiperPoint: contact.wiperPoint.clone(),
        })),
        contactCount: state.contactCount,
        halfTurnSymmetry: true,
        positiveDrive: true,
      },
      rigidThreeWiperRotor: {
        angularSpacing: wiperAngularSpacing,
        count: wiperCount,
        oneCommonAngularSpeed: state.driverAngularSpeed,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  const model = finish(root, update, new THREE.Vector3(6.5, 4.2, 12.8));
  cameraEnvelope.castShadow = false;
  cameraEnvelope.receiveShadow = false;
  for (const marker of contactMarkers) {
    marker.castShadow = false;
    marker.receiveShadow = false;
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

function gravityOpenedEccentricPlateShears() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Measurements from Brown's public-domain engraving. Coordinates use the
  // raster's top-left origin; the model is resolved about the jaw pivot with
  // +Y upward. The hatched point in the circular cam is its eccentric shaft.
  const sourceRasterPivot = new THREE.Vector2(322, 325);
  const sourceRasterCamShaft = new THREE.Vector2(75, 391);
  const sourceRasterCamCenter = new THREE.Vector2(75, 414);
  const sourceRasterCamRadius = 52;
  const sourceRasterLeverContactY = 362;
  const sourceRasterLeverTip = new THREE.Vector2(8, 356);
  const sourceRasterUpperBladeInner = new THREE.Vector2(374, 305);
  const sourceRasterUpperJawTip = new THREE.Vector2(502, 270);
  const sourceRasterFixedBladeInner = new THREE.Vector2(375, 343);
  const sourceRasterFixedBladeTip = new THREE.Vector2(507, 318);
  const sourceRasterBaseTopY = 430;
  const sourceRasterBaseRangeX = new THREE.Vector2(134, 498);
  const sourceScale = 0.014;

  const pivotPosition = new THREE.Vector3(0, 0.7, 0);
  const leverContactOffsetY = (
    sourceRasterPivot.y - sourceRasterLeverContactY
  ) * sourceScale;
  const camRadius = sourceRasterCamRadius * sourceScale;
  const camEccentricity = Math.abs(
    sourceRasterCamCenter.y - sourceRasterCamShaft.y
  ) * sourceScale;
  const camShaftOffset = new THREE.Vector2(
    (sourceRasterCamShaft.x - sourceRasterPivot.x) * sourceScale,
    leverContactOffsetY - camRadius + camEccentricity,
  );
  const camShaftPosition = new THREE.Vector3(
    pivotPosition.x + camShaftOffset.x,
    pivotPosition.y + camShaftOffset.y,
    0,
  );
  const sourceCamPhase = -Math.PI / 2;
  const sourceDriveAngle = 0;
  const inputAngularSpeed = 0.72;
  const cyclePeriod = fullTurn / inputAngularSpeed;
  const transitionTolerance = 1e-10;
  const leverContactMinX = (
    sourceRasterLeverTip.x - sourceRasterPivot.x
  ) * sourceScale;
  const leverContactMaxX = -0.13;
  const requiredCamLineDistance = camRadius - leverContactOffsetY;

  const normalizeAngle = (angle) => Math.atan2(
    Math.sin(angle),
    Math.cos(angle),
  );
  const rotateVector2 = (vector, angle) => new THREE.Vector2(
    Math.cos(angle) * vector.x - Math.sin(angle) * vector.y,
    Math.sin(angle) * vector.x + Math.cos(angle) * vector.y,
  );
  const worldPointFromJawLocal = (localPoint, jawAngle) => (
    rotateVector2(localPoint, jawAngle).add(
      new THREE.Vector2(pivotPosition.x, pivotPosition.y),
    )
  );

  const rockerGeometryAtDriveAngle = (rawDriveAngle) => {
    const driveAngle = THREE.MathUtils.euclideanModulo(
      rawDriveAngle,
      fullTurn,
    );
    const camPhase = sourceCamPhase + driveAngle;
    const camCenter = new THREE.Vector2(
      camShaftPosition.x + camEccentricity * Math.cos(camPhase),
      camShaftPosition.y + camEccentricity * Math.sin(camPhase),
    );
    const fromPivot = camCenter.clone().sub(
      new THREE.Vector2(pivotPosition.x, pivotPosition.y),
    );
    const centerDistance = fromPivot.length();
    const ratio = requiredCamLineDistance / centerDistance;
    if (ratio <= 0 || ratio >= 1) {
      throw new RangeError('Movement 130 cam cannot reach its weighted jaw.');
    }
    const centerAngle = Math.atan2(fromPivot.y, fromPivot.x);
    let jawAngle = normalizeAngle(
      centerAngle + Math.PI - Math.asin(ratio),
    );
    if (Math.abs(jawAngle) < 1e-14) jawAngle = 0;
    const contactNormal = new THREE.Vector2(
      Math.sin(jawAngle),
      -Math.cos(jawAngle),
    );
    const contactTangent = new THREE.Vector2(
      Math.cos(jawAngle),
      Math.sin(jawAngle),
    );
    const camCenterDerivative = new THREE.Vector2(
      -camEccentricity * Math.sin(camPhase),
      camEccentricity * Math.cos(camPhase),
    );
    const camCenterSecondDerivative = new THREE.Vector2(
      -camEccentricity * Math.cos(camPhase),
      -camEccentricity * Math.sin(camPhase),
    );
    const constraintDerivative = contactTangent.dot(fromPivot);
    if (Math.abs(constraintDerivative) < 1e-9) {
      throw new RangeError('Movement 130 reached a cam-follower singularity.');
    }
    const jawAnglePerDriveRadian = -contactNormal.dot(
      camCenterDerivative,
    ) / constraintDerivative;
    const constraintSecondJawDerivative = -contactNormal.dot(fromPivot);
    const constraintMixedDerivative = contactTangent.dot(
      camCenterDerivative,
    );
    const constraintSecondDriveDerivative = contactNormal.dot(
      camCenterSecondDerivative,
    );
    const jawAngleSecondPerDriveRadian = -(
      constraintSecondJawDerivative * jawAnglePerDriveRadian ** 2
      + 2 * constraintMixedDerivative * jawAnglePerDriveRadian
      + constraintSecondDriveDerivative
    ) / constraintDerivative;
    const contactPoint = camCenter.clone().addScaledVector(
      contactNormal,
      -camRadius,
    );
    const contactFromPivot = contactPoint.clone().sub(
      new THREE.Vector2(pivotPosition.x, pivotPosition.y),
    );
    const contactLocalX = contactTangent.dot(contactFromPivot);
    const contactLocalY = contactNormal.clone().negate().dot(
      contactFromPivot,
    );
    return {
      camCenter,
      camCenterDerivative,
      camCenterSecondDerivative,
      camPhase,
      contactLocalX,
      contactLocalY,
      contactNormal,
      contactPoint,
      contactTangent,
      driveAngle,
      jawAngle,
      jawAnglePerDriveRadian,
      jawAngleSecondPerDriveRadian,
    };
  };

  const closedDriveAngle = (() => {
    let lower = Math.PI / 2;
    let upper = Math.PI * 3 / 2;
    let lowerDerivative = rockerGeometryAtDriveAngle(
      lower,
    ).jawAnglePerDriveRadian;
    const upperDerivative = rockerGeometryAtDriveAngle(
      upper,
    ).jawAnglePerDriveRadian;
    if (!(lowerDerivative < 0 && upperDerivative > 0)) {
      throw new RangeError('Movement 130 could not bracket full jaw closure.');
    }
    for (let iteration = 0; iteration < 90; iteration += 1) {
      const middle = (lower + upper) / 2;
      const middleDerivative = rockerGeometryAtDriveAngle(
        middle,
      ).jawAnglePerDriveRadian;
      if (middleDerivative <= 0) {
        lower = middle;
        lowerDerivative = middleDerivative;
      } else {
        upper = middle;
      }
    }
    return (lower + upper) / 2;
  })();
  const sourceRockerGeometry = rockerGeometryAtDriveAngle(sourceDriveAngle);
  const closedRockerGeometry = rockerGeometryAtDriveAngle(closedDriveAngle);
  const sourceJawAngle = sourceRockerGeometry.jawAngle;
  const closedJawAngle = closedRockerGeometry.jawAngle;
  const jawStrokeAngle = sourceJawAngle - closedJawAngle;

  const movingBladeInnerLocal = new THREE.Vector2(
    (sourceRasterUpperBladeInner.x - sourceRasterPivot.x) * sourceScale,
    (sourceRasterPivot.y - sourceRasterUpperBladeInner.y) * sourceScale
      - 0.08,
  );
  const sourceUpperJawTipLocal = new THREE.Vector2(
    (sourceRasterUpperJawTip.x - sourceRasterPivot.x) * sourceScale,
    (sourceRasterPivot.y - sourceRasterUpperJawTip.y) * sourceScale,
  );
  const bladeInsertOffset = 0.18;
  const movingBladeTipLocal = sourceUpperJawTipLocal.clone();
  movingBladeTipLocal.y -= bladeInsertOffset;
  const fixedBladeInnerLocal = new THREE.Vector2(
    (sourceRasterFixedBladeInner.x - sourceRasterPivot.x) * sourceScale,
    (sourceRasterPivot.y - sourceRasterFixedBladeInner.y) * sourceScale,
  );
  const fixedBladeTipLocal = rotateVector2(
    movingBladeTipLocal,
    closedJawAngle,
  );
  const sourceFixedBladeTipLocal = new THREE.Vector2(
    (sourceRasterFixedBladeTip.x - sourceRasterPivot.x) * sourceScale,
    (sourceRasterPivot.y - sourceRasterFixedBladeTip.y) * sourceScale,
  );
  const sourceBladeTipGap = movingBladeTipLocal.distanceTo(
    fixedBladeTipLocal,
  );

  const upperJawCenterOfMassLocal = new THREE.Vector2(-1.62, -0.1);
  const gravityForceMagnitude = 1;
  const upperJawDepth = 0.34;
  const fixedJawDepth = 0.42;
  const pivotBoreRadius = 0.145;
  const pivotPinRadius = 0.105;
  const pivotPinLength = 0.82;
  const camDepth = 0.34;
  const camShaftRadius = 0.105;
  const camShaftLength = 0.74;
  const camBearingInnerRadius = camShaftRadius + 0.025;
  const camBearingOuterRadius = 0.235;
  const baseTopY = pivotPosition.y + (
    sourceRasterPivot.y - sourceRasterBaseTopY
  ) * sourceScale;
  const baseLeftX = pivotPosition.x + (
    sourceRasterBaseRangeX.x - sourceRasterPivot.x
  ) * sourceScale;
  const baseRightX = pivotPosition.x + (
    sourceRasterBaseRangeX.y - sourceRasterPivot.x
  ) * sourceScale;

  const stateAtCamKinematics = ({
    driveAngle,
    inputAngularAcceleration = 0,
    inputAngularVelocity,
  }) => {
    const geometry = rockerGeometryAtDriveAngle(driveAngle);
    const jawAngularVelocity = geometry.jawAnglePerDriveRadian
      * inputAngularVelocity;
    const jawAngularAcceleration = (
      geometry.jawAngleSecondPerDriveRadian * inputAngularVelocity ** 2
      + geometry.jawAnglePerDriveRadian * inputAngularAcceleration
    );
    const camCenterVelocity = geometry.camCenterDerivative.clone()
      .multiplyScalar(inputAngularVelocity);
    const camCenterAcceleration = geometry.camCenterSecondDerivative.clone()
      .multiplyScalar(inputAngularVelocity ** 2)
      .addScaledVector(
        geometry.camCenterDerivative,
        inputAngularAcceleration,
      );
    const contactPoint3 = new THREE.Vector3(
      geometry.contactPoint.x,
      geometry.contactPoint.y,
      0,
    );
    const contactFromInputShaft = contactPoint3.clone().sub(
      camShaftPosition,
    );
    const contactFromJawPivot = contactPoint3.clone().sub(pivotPosition);
    const camSurfaceVelocity = new THREE.Vector3(
      -inputAngularVelocity * contactFromInputShaft.y,
      inputAngularVelocity * contactFromInputShaft.x,
      0,
    );
    const jawSurfaceVelocity = new THREE.Vector3(
      -jawAngularVelocity * contactFromJawPivot.y,
      jawAngularVelocity * contactFromJawPivot.x,
      0,
    );
    const contactNormal3 = new THREE.Vector3(
      geometry.contactNormal.x,
      geometry.contactNormal.y,
      0,
    );
    const contactTangent3 = new THREE.Vector3(
      geometry.contactTangent.x,
      geometry.contactTangent.y,
      0,
    );
    const relativeContactVelocity = camSurfaceVelocity.clone().sub(
      jawSurfaceVelocity,
    );
    const movingBladeTip2 = worldPointFromJawLocal(
      movingBladeTipLocal,
      geometry.jawAngle,
    );
    const movingBladeInner2 = worldPointFromJawLocal(
      movingBladeInnerLocal,
      geometry.jawAngle,
    );
    const fixedBladeTip2 = fixedBladeTipLocal.clone().add(
      new THREE.Vector2(pivotPosition.x, pivotPosition.y),
    );
    const fixedBladeInner2 = fixedBladeInnerLocal.clone().add(
      new THREE.Vector2(pivotPosition.x, pivotPosition.y),
    );
    const movingBladeTip = new THREE.Vector3(
      movingBladeTip2.x,
      movingBladeTip2.y,
      0,
    );
    const fixedBladeTip = new THREE.Vector3(
      fixedBladeTip2.x,
      fixedBladeTip2.y,
      0,
    );
    const bladeTipVelocity = new THREE.Vector3(
      -jawAngularVelocity * (movingBladeTip.y - pivotPosition.y),
      jawAngularVelocity * (movingBladeTip.x - pivotPosition.x),
      0,
    );
    const bladeTipGap = movingBladeTip.distanceTo(fixedBladeTip);
    const jawCenterOfMass = worldPointFromJawLocal(
      upperJawCenterOfMassLocal,
      geometry.jawAngle,
    );
    const gravityOpeningTorque = -(
      jawCenterOfMass.x - pivotPosition.x
    ) * gravityForceMagnitude;
    const atOpenLimit = bladeTipGap > sourceBladeTipGap
      - transitionTolerance;
    const atClosedLimit = bladeTipGap < transitionTolerance;
    const stage = atOpenLimit
      ? 'weighted-long-arm-at-open-jaw-limit'
      : atClosedLimit
        ? 'eccentric-cam-at-closed-blade-tip-limit'
        : jawAngularVelocity < 0
          ? 'eccentric-cam-lifts-arm-and-closes-jaws'
          : 'weighted-arm-follows-receding-cam-and-opens-jaws';
    return {
      atClosedLimit,
      atOpenLimit,
      bladeInsertOffset,
      bladeTipGap,
      bladeTipVelocity,
      camCenter: new THREE.Vector3(
        geometry.camCenter.x,
        geometry.camCenter.y,
        0,
      ),
      camCenterAcceleration: new THREE.Vector3(
        camCenterAcceleration.x,
        camCenterAcceleration.y,
        0,
      ),
      camCenterVelocity: new THREE.Vector3(
        camCenterVelocity.x,
        camCenterVelocity.y,
        0,
      ),
      camPhase: geometry.camPhase,
      camRadialContactError: Math.abs(
        geometry.contactPoint.distanceTo(geometry.camCenter) - camRadius
      ),
      camSurfaceVelocity,
      contactCoincidenceError: 0,
      contactLocalX: geometry.contactLocalX,
      contactLocalY: geometry.contactLocalY,
      contactNormal: contactNormal3,
      contactNormalVelocityError: relativeContactVelocity.dot(
        contactNormal3,
      ),
      contactPoint: contactPoint3,
      contactTangent: contactTangent3,
      driveAngle: geometry.driveAngle,
      fixedBladeInner: new THREE.Vector3(
        fixedBladeInner2.x,
        fixedBladeInner2.y,
        0,
      ),
      fixedBladeTip,
      gravityOpeningTorque,
      gravityReturnActive: jawAngularVelocity >= -transitionTolerance,
      inputAngularAcceleration,
      inputAngularVelocity,
      jawAngle: geometry.jawAngle,
      jawAnglePerDriveRadian: geometry.jawAnglePerDriveRadian,
      jawAngleSecondPerDriveRadian:
        geometry.jawAngleSecondPerDriveRadian,
      jawAngularAcceleration,
      jawAngularVelocity,
      jawCenterOfMass: new THREE.Vector3(
        jawCenterOfMass.x,
        jawCenterOfMass.y,
        0,
      ),
      jawSurfaceVelocity,
      leverLineContactError: Math.abs(
        geometry.contactLocalY - leverContactOffsetY
      ),
      movingBladeInner: new THREE.Vector3(
        movingBladeInner2.x,
        movingBladeInner2.y,
        0,
      ),
      movingBladeTip,
      relativeContactVelocity,
      stage,
      tangentialSlidingContact: true,
      tangentialSlidingSpeed: relativeContactVelocity.dot(
        contactTangent3,
      ),
      velocityDiscontinuous: false,
    };
  };

  const stateAtTime = (time) => stateAtCamKinematics({
    driveAngle: sourceDriveAngle + inputAngularSpeed * time,
    inputAngularAcceleration: 0,
    inputAngularVelocity: inputAngularSpeed,
  });

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.6,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.16,
    roughness: 0.67,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const annularDisk = ({ innerRadius, outerRadius, depth, material }) => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerRadius, 0, fullTurn, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, fullTurn, true);
    shape.holes.push(hole);
    return new THREE.Mesh(centeredExtrusion(shape, depth, 0.008), material);
  };

  const upperJawShape = new THREE.Shape();
  upperJawShape.moveTo(leverContactMinX, leverContactOffsetY);
  upperJawShape.lineTo(-0.16, leverContactOffsetY);
  upperJawShape.quadraticCurveTo(0.18, -0.49, 0.38, -0.18);
  upperJawShape.quadraticCurveTo(0.55, 0.08, 0.78, 0.22);
  upperJawShape.lineTo(sourceUpperJawTipLocal.x, sourceUpperJawTipLocal.y);
  upperJawShape.quadraticCurveTo(2.47, 1.02, 2.2, 1.12);
  upperJawShape.lineTo(0.15, 0.82);
  upperJawShape.quadraticCurveTo(-0.32, 0.73, -0.48, 0.2);
  upperJawShape.quadraticCurveTo(-0.55, 0.02, -0.78, -0.03);
  upperJawShape.lineTo(leverContactMinX + 0.12, -0.31);
  upperJawShape.quadraticCurveTo(
    leverContactMinX - 0.08,
    -0.38,
    leverContactMinX,
    leverContactOffsetY,
  );
  upperJawShape.closePath();
  const pivotHole = new THREE.Path();
  pivotHole.absarc(0, 0, pivotBoreRadius, 0, fullTurn, true);
  upperJawShape.holes.push(pivotHole);
  const upperJaw = new THREE.Mesh(
    centeredExtrusion(upperJawShape, upperJawDepth, 0.025),
    drivenMaterial,
  );
  upperJaw.userData.role = 'one-piece-weighted-upper-shear-jaw-and-long-arm';

  const upperJawAssembly = new THREE.Group();
  upperJawAssembly.position.copy(pivotPosition);
  upperJawAssembly.userData.axis = Z_AXIS.clone();
  upperJawAssembly.userData.role = 'gravity-opened-pivoted-upper-jaw';
  const leverContactFace = makeBeam(
    new THREE.Vector3(leverContactMinX + 0.08, leverContactOffsetY, 0.2),
    new THREE.Vector3(leverContactMaxX, leverContactOffsetY, 0.2),
    {
      color: PALETTE.ink,
      depth: 0.075,
      thickness: 0.055,
    },
  );
  leverContactFace.userData.role = 'straight-cam-contact-face-under-long-arm';
  leverContactFace.traverse((object) => {
    if (object.material) object.material = inkMaterial;
  });
  const movingBlade = makeBeam(
    new THREE.Vector3(
      movingBladeInnerLocal.x,
      movingBladeInnerLocal.y,
      0.225,
    ),
    new THREE.Vector3(
      movingBladeTipLocal.x,
      movingBladeTipLocal.y,
      0.225,
    ),
    {
      color: PALETTE.ink,
      depth: 0.09,
      thickness: 0.085,
    },
  );
  movingBlade.userData.role = 'replaceable-moving-upper-shear-blade';
  movingBlade.traverse((object) => {
    if (object.material) object.material = inkMaterial;
  });
  const gravityIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 12),
    whiteMaterial,
  );
  gravityIndex.position.set(-4.05, -0.31, upperJawDepth / 2 + 0.1);
  gravityIndex.userData.role = 'white-index-on-weighted-long-opening-arm';
  const movingBladeTipMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 16, 11),
    whiteMaterial,
  );
  movingBladeTipMarker.position.set(
    movingBladeTipLocal.x,
    movingBladeTipLocal.y,
    0.3,
  );
  movingBladeTipMarker.userData.role = 'white-moving-blade-tip-contact-index';
  upperJawAssembly.add(
    upperJaw,
    leverContactFace,
    movingBlade,
    gravityIndex,
    movingBladeTipMarker,
  );

  const fixedJawShape = new THREE.Shape();
  fixedJawShape.moveTo(fixedBladeInnerLocal.x, fixedBladeInnerLocal.y);
  fixedJawShape.lineTo(fixedBladeTipLocal.x, fixedBladeTipLocal.y);
  fixedJawShape.quadraticCurveTo(2.62, -0.14, 2.36, -0.34);
  fixedJawShape.lineTo(0.98, -0.56);
  fixedJawShape.quadraticCurveTo(0.42, -0.67, 0.48, -0.94);
  fixedJawShape.quadraticCurveTo(0.55, -1.19, 0.96, -1.36);
  fixedJawShape.lineTo(baseRightX - pivotPosition.x, -1.47);
  fixedJawShape.lineTo(0.58, -1.47);
  fixedJawShape.quadraticCurveTo(0.25, -1.12, 0.2, -0.76);
  fixedJawShape.quadraticCurveTo(0.17, -0.42, fixedBladeInnerLocal.x,
    fixedBladeInnerLocal.y);
  fixedJawShape.closePath();
  const fixedJaw = new THREE.Mesh(
    centeredExtrusion(fixedJawShape, fixedJawDepth, 0.024),
    frameMaterial,
  );
  fixedJaw.position.set(pivotPosition.x, pivotPosition.y, -0.13);
  fixedJaw.userData.role = 'fixed-lower-shear-jaw-and-throat';
  const fixedBlade = makeBeam(
    new THREE.Vector3(
      pivotPosition.x + fixedBladeInnerLocal.x,
      pivotPosition.y + fixedBladeInnerLocal.y,
      0.14,
    ),
    new THREE.Vector3(
      pivotPosition.x + fixedBladeTipLocal.x,
      pivotPosition.y + fixedBladeTipLocal.y,
      0.14,
    ),
    {
      color: PALETTE.ink,
      depth: 0.1,
      thickness: 0.085,
    },
  );
  fixedBlade.userData.role = 'fixed-lower-shear-blade';
  fixedBlade.traverse((object) => {
    if (object.material) object.material = inkMaterial;
  });

  const camInput = planarRotor();
  const camRotor = camInput.userData.rotor;
  camInput.position.copy(camShaftPosition);
  camInput.userData.role = 'continuous-eccentric-cam-input';
  camRotor.userData.role = 'one-rigid-eccentric-cam-rotor';
  const camDisk = cylinderAlongZ(camRadius, camDepth, driverMaterial, 64);
  camDisk.position.set(0, -camEccentricity, 0);
  camDisk.userData.radius = camRadius;
  camDisk.userData.role = 'circular-cam-offset-from-input-shaft';
  const camRotationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.068, 17, 11),
    whiteMaterial,
  );
  camRotationIndex.position.set(
    camRadius * 0.42,
    -camEccentricity,
    camDepth / 2 + 0.09,
  );
  camRotationIndex.userData.role = 'white-index-on-rotating-eccentric-cam';
  const camHub = cylinderAlongZ(0.17, camDepth * 1.26, inkMaterial, 28);
  camHub.userData.role = 'hub-at-eccentric-cam-input-axis';
  camRotor.add(camDisk, camRotationIndex, camHub);

  const camShaft = cylinderAlongZ(
    camShaftRadius,
    camShaftLength,
    inkMaterial,
    28,
  );
  camShaft.position.copy(camShaftPosition);
  camShaft.userData.axis = Z_AXIS.clone();
  camShaft.userData.role = 'fixed-axis-through-eccentric-cam';
  const camBearing = annularDisk({
    depth: 0.2,
    innerRadius: camBearingInnerRadius,
    material: frameMaterial,
    outerRadius: camBearingOuterRadius,
  });
  camBearing.position.set(camShaftPosition.x, camShaftPosition.y, -0.28);
  camBearing.userData.axis = Z_AXIS.clone();
  camBearing.userData.role = 'fixed-bored-bearing-behind-cam-shaft';

  const pivotPin = cylinderAlongZ(
    pivotPinRadius,
    pivotPinLength,
    inkMaterial,
    28,
  );
  pivotPin.position.copy(pivotPosition);
  pivotPin.userData.axis = Z_AXIS.clone();
  pivotPin.userData.role = 'fixed-upper-jaw-pivot-pin';
  const pivotBearing = annularDisk({
    depth: 0.2,
    innerRadius: pivotPinRadius + 0.025,
    material: frameMaterial,
    outerRadius: 0.265,
  });
  pivotBearing.position.set(pivotPosition.x, pivotPosition.y, -0.3);
  pivotBearing.userData.axis = Z_AXIS.clone();
  pivotBearing.userData.role = 'fixed-bored-bearing-behind-jaw-pivot';

  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(
      baseRightX - baseLeftX + 0.45,
      0.27,
      0.58,
    ),
    frameMaterial,
  );
  baseRail.position.set(
    (baseLeftX + baseRightX) / 2,
    baseTopY - 0.135,
    -0.38,
  );
  baseRail.userData.role = 'fixed-bed-under-plate-shears';
  const camSupportFoot = new THREE.Mesh(
    new THREE.BoxGeometry(1.62, 0.22, 0.68),
    frameMaterial,
  );
  camSupportFoot.position.set(
    camShaftPosition.x + 0.02,
    baseTopY - 0.11,
    -0.4,
  );
  camSupportFoot.userData.role = 'left-foot-under-eccentric-cam-bearing';
  const camBearingPost = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.3,
      camShaftPosition.y - baseTopY,
      0.36,
    ),
    frameMaterial,
  );
  camBearingPost.position.set(
    camShaftPosition.x,
    (camShaftPosition.y + baseTopY) / 2,
    -0.38,
  );
  camBearingPost.userData.role = 'rear-support-for-cam-shaft-bearing';
  const pivotStand = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.38,
      pivotPosition.y - baseTopY,
      0.42,
    ),
    frameMaterial,
  );
  pivotStand.position.set(
    pivotPosition.x - 0.26,
    (pivotPosition.y + baseTopY) / 2,
    -0.39,
  );
  pivotStand.userData.role = 'fixed-stand-carrying-upper-jaw-pivot';

  const camContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 17, 11),
    whiteMaterial,
  );
  camContactMarker.userData.role = 'white-eccentric-cam-contact-index';
  const fixedBladeTipMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 16, 11),
    whiteMaterial,
  );
  fixedBladeTipMarker.position.set(
    pivotPosition.x + fixedBladeTipLocal.x,
    pivotPosition.y + fixedBladeTipLocal.y,
    0.27,
  );
  fixedBladeTipMarker.userData.role = 'white-fixed-blade-tip-contact-index';
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 5.5, 0.01),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-0.65, 0.08, -0.72);
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-plate-shears-camera-envelope';

  root.add(
    cameraEnvelope,
    baseRail,
    camSupportFoot,
    camBearingPost,
    pivotStand,
    fixedJaw,
    fixedBlade,
    camBearing,
    camShaft,
    pivotBearing,
    pivotPin,
    camInput,
    upperJawAssembly,
    camContactMarker,
    fixedBladeTipMarker,
  );

  root.userData.mechanism = 'gravity-opened-eccentric-cam-plate-shears';
  root.userData.blocks = {
    baseRail,
    camBearing,
    camBearingPost,
    camContactMarker,
    camDisk,
    camHub,
    cameraEnvelope,
    camInput,
    camRotationIndex,
    camRotor,
    camShaft,
    camSupportFoot,
    fixedBlade,
    fixedBladeTipMarker,
    fixedJaw,
    gravityIndex,
    leverContactFace,
    movingBlade,
    movingBladeTipMarker,
    pivotBearing,
    pivotPin,
    pivotStand,
    upperJaw,
    upperJawAssembly,
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    baseLeftX,
    baseRightX,
    baseTopY,
    bladeInsertOffset,
    camBearingInnerRadius,
    camBearingOuterRadius,
    camDepth,
    camEccentricity,
    camRadius,
    camShaftLength,
    camShaftOffset: camShaftOffset.clone(),
    camShaftPosition: camShaftPosition.clone(),
    camShaftRadius,
    closedDriveAngle,
    closedJawAngle,
    cyclePeriod,
    fixedBladeInnerLocal: fixedBladeInnerLocal.clone(),
    fixedBladeTipLocal: fixedBladeTipLocal.clone(),
    fixedJawDepth,
    fullTurn,
    gravityForceMagnitude,
    inputAngularSpeed,
    jawStrokeAngle,
    leverContactMaxX,
    leverContactMinX,
    leverContactOffsetY,
    movingBladeInnerLocal: movingBladeInnerLocal.clone(),
    movingBladeTipLocal: movingBladeTipLocal.clone(),
    pivotBoreRadius,
    pivotPinLength,
    pivotPinRadius,
    pivotPosition: pivotPosition.clone(),
    requiredCamLineDistance,
    sourceBladeTipGap,
    sourceCamPhase,
    sourceDriveAngle,
    sourceFixedBladeTipLocal: sourceFixedBladeTipLocal.clone(),
    sourceJawAngle,
    sourceRasterBaseRangeX: sourceRasterBaseRangeX.clone(),
    sourceRasterBaseTopY,
    sourceRasterCamCenter: sourceRasterCamCenter.clone(),
    sourceRasterCamRadius,
    sourceRasterCamShaft: sourceRasterCamShaft.clone(),
    sourceRasterFixedBladeInner: sourceRasterFixedBladeInner.clone(),
    sourceRasterFixedBladeTip: sourceRasterFixedBladeTip.clone(),
    sourceRasterLeverContactY,
    sourceRasterLeverTip: sourceRasterLeverTip.clone(),
    sourceRasterPivot: sourceRasterPivot.clone(),
    sourceRasterUpperBladeInner: sourceRasterUpperBladeInner.clone(),
    sourceRasterUpperJawTip: sourceRasterUpperJawTip.clone(),
    sourceScale,
    sourceUpperJawTipLocal: sourceUpperJawTipLocal.clone(),
    transitionTolerance,
    upperJawCenterOfMassLocal: upperJawCenterOfMassLocal.clone(),
    upperJawDepth,
  };
  root.userData.rockerGeometryAtDriveAngle = rockerGeometryAtDriveAngle;
  root.userData.stateAtCamKinematics = stateAtCamKinematics;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    camRotor.rotation.set(0, 0, state.driveAngle);
    camInput.userData.angularSpeed = state.inputAngularVelocity;
    camRotor.userData.angularSpeed = state.inputAngularVelocity;
    upperJawAssembly.rotation.set(0, 0, state.jawAngle);
    upperJawAssembly.userData.angularSpeed = state.jawAngularVelocity;
    upperJawAssembly.userData.angularAcceleration = (
      state.jawAngularAcceleration
    );
    camContactMarker.position.copy(state.contactPoint);
    camContactMarker.position.z = 0.3;
    root.userData.contacts = {
      bladeTips: {
        gap: state.bladeTipGap,
        movingPoint: state.movingBladeTip.clone(),
        fixedPoint: state.fixedBladeTip.clone(),
      },
      eccentricCamWeightedArm: {
        camRadialError: state.camRadialContactError,
        contactPoint: state.contactPoint.clone(),
        leverLineError: state.leverLineContactError,
        normal: state.contactNormal.clone(),
        normalVelocityError: state.contactNormalVelocityError,
        slidingSpeed: state.tangentialSlidingSpeed,
        tangent: state.contactTangent.clone(),
      },
      gravityReturn: {
        active: state.gravityReturnActive,
        openingTorque: state.gravityOpeningTorque,
        weightedCenterOfMass: state.jawCenterOfMass.clone(),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  const model = finish(root, update, new THREE.Vector3(5.4, 3.6, 13.6));
  for (const object of [
    cameraEnvelope,
    camContactMarker,
    fixedBladeTipMarker,
    movingBladeTipMarker,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
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

function reuleauxCarrierDiskValveMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const inputSpeedMagnitude = 0.72;
  const inputAngularSpeed = -inputSpeedMagnitude;
  const cyclePeriod = fullTurn / inputSpeedMagnitude;
  const sourcePoseAngle = 0;
  const shaftCenter = new THREE.Vector3(0, 0.35, 0);

  // Raster anchors from Brown's engraving. The disk center coincides with the
  // upper vertex of the tappet; the round boss near the tappet centroid is its
  // fastening to the carrier, not the rotary axis.
  const sourceProfileWidthPixels = 183;
  const sourceCarrierDiskRadiusPixels = 193;
  const sourceInnerHalfWidthPixels = 190;
  const sourceOuterHalfWidthPixels = 215;
  const sourceOuterHalfHeightPixels = 124;
  const sourcePivotPixels = new THREE.Vector2(258, 221);
  const sourceFastenerCenterPixels = new THREE.Vector2(258, 317);
  const profileWidth = 2.9;
  const sourceScale = profileWidth / sourceProfileWidthPixels;
  const carrierDiskRadius = sourceCarrierDiskRadiusPixels * sourceScale;
  const innerHalfWidth = sourceInnerHalfWidthPixels * sourceScale;
  const outerHalfWidth = sourceOuterHalfWidthPixels * sourceScale;
  const outerHalfHeight = sourceOuterHalfHeightPixels * sourceScale;

  const equilateralAltitude = Math.sqrt(3) * profileWidth / 2;
  const camCentroidOffset = profileWidth / Math.sqrt(3);
  const pivotVertex = new THREE.Vector2(0, 0);
  const leftBaseVertex = new THREE.Vector2(
    -profileWidth / 2,
    -equilateralAltitude,
  );
  const rightBaseVertex = new THREE.Vector2(
    profileWidth / 2,
    -equilateralAltitude,
  );
  const camCentroid = new THREE.Vector2(0, -camCentroidOffset);
  const fastenerOffset = new THREE.Vector2(0, -96 * sourceScale);
  const dwellHalfAngle = Math.PI / 6;
  const dwellAngularSpan = dwellHalfAngle * 2;
  const transferAngularSpan = Math.PI - dwellAngularSpan;
  const outputAmplitude = profileWidth / 2;
  const outputStroke = profileWidth;
  const runningClearance = 0.001;
  const railHalfSpacing = profileWidth / 2 + runningClearance;

  const carrierDiskDepth = 0.24;
  const camDepth = 0.36;
  const followerDepth = 0.44;
  const linerDepth = 0.47;
  const linerThickness = 0.08;
  const innerCornerRadius = 0.15;
  const outerCornerRadius = 0.26;
  const bodyHoleHalfHeight = railHalfSpacing + linerThickness;
  const linerStraightHalfWidth = innerHalfWidth - innerCornerRadius;
  const shaftRadius = 0.17;
  const shaftLength = .90;
  const fastenerBossRadius = 0.48;
  const fastenerSquareHalfSize = 0.17;
  const rodRadius = 27 * sourceScale;
  const rodAttachmentCoordinate = outerHalfHeight + 0.16;
  const upperRodOuterCoordinate = 293 * sourceScale;
  const lowerRodOuterCoordinate = 197 * sourceScale;
  const guideRailX = outerHalfWidth + 0.2;
  const guideMinimumY = shaftCenter.y
    - outputAmplitude - outerHalfHeight - 0.18;
  const guideMaximumY = shaftCenter.y
    + outputAmplitude + outerHalfHeight + 0.18;
  const rearFrameZ = -0.74;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.61,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.64,
  });
  const linerMaterial = matte(PALETTE.brass, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.5,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const witnessMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const profileArcs = [
    {
      center: rightBaseVertex.clone(),
      endAngle: Math.PI,
      name: 'right-vertex-centered-left-side-arc',
      radius: profileWidth,
      startAngle: 2 * Math.PI / 3,
    },
    {
      center: pivotVertex.clone(),
      endAngle: 5 * Math.PI / 3,
      name: 'carrier-axis-centered-bottom-dwell-arc',
      radius: profileWidth,
      startAngle: 4 * Math.PI / 3,
    },
    {
      center: leftBaseVertex.clone(),
      endAngle: Math.PI / 3,
      name: 'left-vertex-centered-right-side-arc',
      radius: profileWidth,
      startAngle: 0,
    },
  ];

  const profileShape = new THREE.Shape();
  profileShape.moveTo(pivotVertex.x, pivotVertex.y);
  for (const arc of profileArcs) {
    profileShape.absarc(
      arc.center.x,
      arc.center.y,
      arc.radius,
      arc.startAngle,
      arc.endAngle,
      false,
    );
  }
  profileShape.closePath();

  const input = planarRotor();
  input.position.copy(shaftCenter);
  input.userData.role = 'continuous-carrier-disk-with-rigid-reuleaux-tappet';
  const inputRotor = input.userData.rotor;

  const carrierDisk = cylinderAlongZ(
    carrierDiskRadius,
    carrierDiskDepth,
    driverMaterial,
    72,
  );
  carrierDisk.position.z = -0.34;
  carrierDisk.userData.role = 'circular-carrier-disk-centered-on-cam-vertex';
  inputRotor.add(carrierDisk);

  const carrierFaceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, carrierDiskRadius * 0.72, 0.035),
    witnessMaterial,
  );
  carrierFaceIndex.position.set(
    0,
    carrierDiskRadius * 0.65,
    -0.195,
  );
  carrierFaceIndex.userData.role = 'rotation-index-on-carrier-disk';
  inputRotor.add(carrierFaceIndex);

  const camBody = new THREE.Mesh(
    new THREE.ExtrudeGeometry(profileShape, {depth: camDepth, bevelEnabled: false, curveSegments: 96}).translate(0, 0, -camDepth / 2),
    driverMaterial,
  );
  camBody.position.z = -0.02;
  camBody.userData.role = 'true-three-arc-reuleaux-triangle-tappet';
  inputRotor.add(camBody);

  const fastenerBoss = cylinderAlongZ(
    fastenerBossRadius,
    .485,
    driverMaterial,
    40,
  );
  fastenerBoss.position.set(fastenerOffset.x, fastenerOffset.y, .0025);
  fastenerBoss.userData.role = 'round-tappet-fastener-at-engraved-position';
  inputRotor.add(fastenerBoss);

  const fastenerSquare = new THREE.Mesh(
    new THREE.BoxGeometry(
      fastenerSquareHalfSize * 2,
      fastenerSquareHalfSize * 2,
      0.055,
    ),
    darkMaterial,
  );
  fastenerSquare.position.set(
    fastenerOffset.x,
    fastenerOffset.y,
    camDepth / 2 + 0.065,
  );
  fastenerSquare.userData.role = 'square-fastener-index-rigid-with-tappet';
  inputRotor.add(fastenerSquare);

  const inputShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
  );
  inputShaft.position.z = -.68;
  inputShaft.userData.role = 'fixed-axis-through-carrier-disk-center';
  inputRotor.add(inputShaft);

  const follower = new THREE.Group();
  follower.userData.role = 'nonrotating-positive-return-valve-yoke';
  const followerBody = new THREE.Mesh(
    centeredExtrusion(
      bowedValveYoke({
        innerCornerRadius,
        innerHalfHeight: bodyHoleHalfHeight,
        innerHalfWidth,
        outerCornerRadius,
        outerHalfHeight,
        outerHalfWidth,
      }),
      followerDepth,
      0.012,
    ),
    drivenMaterial,
  );
  followerBody.position.z = 0.2;
  followerBody.userData.role = 'one-piece-positive-return-valve-frame';
  follower.add(followerBody);

  const lowerRailLiner = new THREE.Mesh(
    new THREE.BoxGeometry(
      linerStraightHalfWidth * 2,
      linerThickness,
      linerDepth,
    ),
    linerMaterial,
  );
  lowerRailLiner.position.set(
    0,
    -railHalfSpacing - linerThickness / 2,
    0.2,
  );
  lowerRailLiner.userData.role = 'lower-horizontal-positive-return-rail';
  lowerRailLiner.userData.side = 'lower';
  const upperRailLiner = lowerRailLiner.clone();
  upperRailLiner.position.y = railHalfSpacing + linerThickness / 2;
  upperRailLiner.userData.role = 'upper-horizontal-positive-return-rail';
  upperRailLiner.userData.side = 'upper';
  follower.add(lowerRailLiner, upperRailLiner);

  const upperRodLength = upperRodOuterCoordinate - rodAttachmentCoordinate;
  const upperRod = new THREE.Mesh(
    new THREE.CylinderGeometry(rodRadius, rodRadius, upperRodLength, 28),
    drivenMaterial,
  );
  upperRod.position.set(
    0,
    (rodAttachmentCoordinate + upperRodOuterCoordinate) / 2,
    0.4,
  );
  upperRod.userData.role = 'upper-valve-rod-rigid-with-yoke';
  const lowerRodLength = lowerRodOuterCoordinate - rodAttachmentCoordinate;
  const lowerRod = new THREE.Mesh(
    new THREE.CylinderGeometry(rodRadius, rodRadius, lowerRodLength, 28),
    drivenMaterial,
  );
  lowerRod.position.set(
    0,
    -(rodAttachmentCoordinate + lowerRodOuterCoordinate) / 2,
    0.4,
  );
  lowerRod.userData.role = 'lower-valve-rod-rigid-with-yoke';
  follower.add(upperRod, lowerRod);

  // Brown draws each rod's nut as a hexagon seen face-on: three flats seated
  // on the yoke, their chamfered ends arching away from the yoke toward the
  // rod. The nut is a hexagonal prism whose outboard end is cut by a cone, so
  // each flat ends in an arch that dips toward its corners.
  const nutCorner = 40 * sourceScale;
  const nutApothem = nutCorner * Math.sqrt(3) / 2;
  const nutHeight = 50 * sourceScale;
  const nutChamferDrop = 12 * sourceScale;
  const hexNutGeometry = () => {
    const rings = 12;
    const sides = 72;
    const boundary = (angle) => {
      // Hexagon with a flat facing +Z (the viewer) after the X rotation.
      const sector = Math.PI / 3;
      const local = ((angle - Math.PI / 2 + sector / 2) % sector + sector)
        % sector - sector / 2;
      const r = nutApothem / Math.cos(local);
      return [r * Math.cos(angle), r * Math.sin(angle)];
    };
    const top = (x, y) => {
      const radius = Math.hypot(x, y);
      return nutHeight - Math.max(0, radius - nutApothem)
        / (nutCorner - nutApothem) * nutChamferDrop;
    };
    const positions = [];
    const vertex = (x, y, h) => positions.push(x, h, y);
    const quad = (a, b, c, d) => {
      vertex(...a); vertex(...c); vertex(...b);
      vertex(...a); vertex(...d); vertex(...c);
    };
    for (let j = 0; j < sides; j++) {
      const a0 = 2 * Math.PI * j / sides;
      const a1 = 2 * Math.PI * (j + 1) / sides;
      const b0 = boundary(a0);
      const b1 = boundary(a1);
      // Outboard chamfer/crown surface over concentric rings.
      for (let i = 0; i < rings; i++) {
        const s0 = i / rings;
        const s1 = (i + 1) / rings;
        const p = (b, t) => [b[0] * t, b[1] * t, top(b[0] * t, b[1] * t)];
        quad(p(b0, s0), p(b0, s1), p(b1, s1), p(b1, s0));
      }
      // Side flat up to the arched chamfer line.
      quad([b0[0], b0[1], 0], [b1[0], b1[1], 0],
        [b1[0], b1[1], top(...b1)], [b0[0], b0[1], top(...b0)]);
      // Flat seat on the yoke.
      vertex(0, 0, 0); vertex(b0[0], b0[1], 0); vertex(b1[0], b1[1], 0);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',
      new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  };
  const nutGeometry = hexNutGeometry();
  const attachmentLugs = [];
  for (const signY of [-1, 1]) {
    const lug = new THREE.Mesh(nutGeometry, drivenMaterial);
    lug.position.set(0, signY * (outerHalfHeight - 0.03), 0.40);
    if (signY < 0) lug.rotation.x = Math.PI;
    lug.userData.role = 'hex-nut-valve-rod-yoke-attachment';
    lug.userData.side = signY < 0 ? 'lower' : 'upper';
    attachmentLugs.push(lug);
  }
  follower.add(...attachmentLugs);

  const translationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.075, 0.04),
    witnessMaterial,
  );
  translationIndex.position.set(0, outerHalfHeight + 0.72, 0.36);
  translationIndex.userData.role = 'translation-index-on-valve-rod';
  follower.add(translationIndex);

  const guideRails = [-1, 1].map((signX) => {
    const rail = makeBeam(
      new THREE.Vector3(signX * guideRailX, guideMinimumY - .06, rearFrameZ),
      new THREE.Vector3(signX * guideRailX, guideMaximumY, rearFrameZ),
      { thickness: 0.14, depth: 0.2, color: PALETTE.frame },
    );
    rail.userData.role = 'fixed-vertical-guide-rail-for-valve-yoke';
    rail.userData.side = signX < 0 ? 'left' : 'right';
    return rail;
  });

  const guideShoes = [-1, 1].map((signX) => {
    const shoe = new THREE.Mesh(
      rectangularGuideShoe(),
      drivenMaterial,
    );
    shoe.position.set(signX * guideRailX, 0, rearFrameZ);
    shoe.userData.role = 'sliding-shoe-on-fixed-vertical-guide';
    shoe.userData.side = signX < 0 ? 'left' : 'right';
    return shoe;
  });
  const guideArms = [-1, 1].map(sign => makeBeam(
    new THREE.Vector3(sign * guideRailX, 0, rearFrameZ + .13),
    new THREE.Vector3(sign * (outerHalfWidth + .12), 0, .20),
    {thickness: .14, depth: .14, color: PALETTE.driven},
  ));
  follower.add(...guideShoes, ...guideArms);

  const bearingShape = new THREE.Shape();
  bearingShape.absarc(0, 0, .385, 0, fullTurn, false);
  const bearingBore = new THREE.Path();
  bearingBore.absarc(0, 0, shaftRadius + .003, 0, fullTurn, true);
  bearingShape.holes.push(bearingBore);
  const rearBearing = new THREE.Mesh(
    new THREE.ExtrudeGeometry(bearingShape, {depth: .28, bevelEnabled: false, curveSegments: 64}).translate(0, 0, -.14),
    frameMaterial,
  );
  rearBearing.position.set(shaftCenter.x, shaftCenter.y, rearFrameZ);
  rearBearing.userData.role = 'fixed-rear-bearing-of-carrier-disk';

  const baseY = guideMinimumY - 0.12;
  const baseRail = makeBeam(
    new THREE.Vector3(-guideRailX - 0.38, baseY, rearFrameZ),
    new THREE.Vector3(guideRailX + 0.38, baseY, rearFrameZ),
    { thickness: 0.18, depth: 0.26, color: PALETTE.frame },
  );
  baseRail.userData.role = 'fixed-base-of-reuleaux-valve-drive';
  const bearingSupports = [-1, 1].map((signX) => {
    const support = makeBeam(
      new THREE.Vector3(signX * 1.15, baseY, rearFrameZ),
      rearBearing.position.clone().add(new THREE.Vector3(0, -.26, 0)),
      { thickness: 0.14, depth: 0.2, color: PALETTE.frame },
    );
    support.userData.role = 'rear-A-frame-support-of-carrier-bearing';
    return support;
  });

  const upperContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 18, 12),
    witnessMaterial,
  );
  upperContactMarker.userData.role = 'upper-positive-return-contact-witness';
  const lowerContactMarker = upperContactMarker.clone();
  lowerContactMarker.userData.role = 'lower-positive-return-contact-witness';

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.75, 10.85, 0.01),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0, 0.72, rearFrameZ - 0.25);
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-full-stroke-reuleaux-valve-envelope';

  root.add(
    cameraEnvelope,
    baseRail,
    ...guideRails,
    ...bearingSupports,
    rearBearing,
    input,
    follower,
    lowerContactMarker,
    upperContactMarker,
  );

  const positiveModulo = (value, modulus) => {
    const remainder = value % modulus;
    if (remainder === 0) return 0;
    return remainder < 0 ? remainder + modulus : remainder;
  };
  const pointOnArc = (arc, angle) => new THREE.Vector2(
    arc.center.x + arc.radius * Math.cos(angle),
    arc.center.y + arc.radius * Math.sin(angle),
  );
  const angleOnArc = (angle, arc) => (
    angle >= arc.startAngle - 1e-12
      && angle <= arc.endAngle + 1e-12
  );
  const profileExtremeAtAngle = (driverAngle, maximize) => {
    const direction = new THREE.Vector2(
      Math.sin(driverAngle),
      Math.cos(driverAngle),
    );
    const directionAngle = positiveModulo(
      Math.atan2(direction.y, direction.x) + (maximize ? 0 : Math.PI),
      fullTurn,
    );
    let best = null;
    for (const arc of profileArcs) {
      const candidates = [];
      if (angleOnArc(directionAngle, arc)) {
        candidates.push({ angle: directionAngle, followsArc: true });
      }
      candidates.push(
        { angle: arc.startAngle, followsArc: false },
        { angle: arc.endAngle, followsArc: false },
      );
      for (const candidate of candidates) {
        const point = pointOnArc(arc, candidate.angle);
        const value = point.dot(direction);
        const isBetter = best === null || (maximize
          ? value > best.value + 1e-11
          : value < best.value - 1e-11);
        if (!isBetter) continue;
        const derivativeAnchor = candidate.followsArc
          ? arc.center
          : point;
        best = {
          angle: candidate.angle,
          derivative: derivativeAnchor.x * Math.cos(driverAngle)
            - derivativeAnchor.y * Math.sin(driverAngle),
          followsArc: candidate.followsArc,
          localPoint: point,
          secondDerivative: -derivativeAnchor.x * Math.sin(driverAngle)
            - derivativeAnchor.y * Math.cos(driverAngle),
          segment: arc.name,
          value,
        };
      }
    }
    return best;
  };
  const localToWorld = (point, driverAngle) => new THREE.Vector3(
    shaftCenter.x + point.x * Math.cos(driverAngle)
      - point.y * Math.sin(driverAngle),
    shaftCenter.y + point.x * Math.sin(driverAngle)
      + point.y * Math.cos(driverAngle),
    0,
  );

  const stateAtTime = (time) => {
    const driverAngle = sourcePoseAngle + inputAngularSpeed * time;
    const normalizedDriverAngle = positiveModulo(driverAngle, fullTurn);
    const lowerExtreme = profileExtremeAtAngle(driverAngle, false);
    const upperExtreme = profileExtremeAtAngle(driverAngle, true);
    const supportWidth = upperExtreme.value - lowerExtreme.value;
    const outputDisplacement = (
      lowerExtreme.value + upperExtreme.value
    ) / 2;
    const displacementDerivative = (
      lowerExtreme.derivative + upperExtreme.derivative
    ) / 2;
    const displacementSecondDerivative = (
      lowerExtreme.secondDerivative + upperExtreme.secondDerivative
    ) / 2;
    const followerCenter = new THREE.Vector3(
      shaftCenter.x,
      shaftCenter.y + outputDisplacement,
      0,
    );
    const outputVelocity = new THREE.Vector3(
      0,
      displacementDerivative * inputAngularSpeed,
      0,
    );
    const outputAcceleration = new THREE.Vector3(
      0,
      displacementSecondDerivative * inputAngularSpeed ** 2,
      0,
    );
    const lowerCamPoint = localToWorld(
      lowerExtreme.localPoint,
      driverAngle,
    );
    const upperCamPoint = localToWorld(
      upperExtreme.localPoint,
      driverAngle,
    );
    const lowerRailY = followerCenter.y - railHalfSpacing;
    const upperRailY = followerCenter.y + railHalfSpacing;
    const lowerRailPoint = new THREE.Vector3(
      lowerCamPoint.x,
      lowerRailY,
      0,
    );
    const upperRailPoint = new THREE.Vector3(
      upperCamPoint.x,
      upperRailY,
      0,
    );
    const lowerWitnessPoint = lowerCamPoint.clone().lerp(
      lowerRailPoint,
      0.5,
    );
    const upperWitnessPoint = upperCamPoint.clone().lerp(
      upperRailPoint,
      0.5,
    );
    lowerWitnessPoint.z = followerDepth / 2 + 0.12;
    upperWitnessPoint.z = followerDepth / 2 + 0.12;
    const lowerDwell = normalizedDriverAngle <= dwellHalfAngle + 1e-12
      || normalizedDriverAngle >= fullTurn - dwellHalfAngle - 1e-12;
    const upperDwell = Math.abs(normalizedDriverAngle - Math.PI)
      <= dwellHalfAngle + 1e-12;
    const stage = lowerDwell
      ? 'lower-valve-dwell'
      : upperDwell
        ? 'upper-valve-dwell'
        : outputVelocity.y > 0
          ? 'valve-yoke-translates-up'
          : 'valve-yoke-translates-down';
    const camCentroidWorld = localToWorld(camCentroid, driverAngle);
    return {
      activeProfileSegments: {
        lower: lowerExtreme.segment,
        upper: upperExtreme.segment,
      },
      fastenerWorld: localToWorld(fastenerOffset, driverAngle),
      camCentroidWorld,
      carrierCenter: shaftCenter.clone(),
      constantWidthError: Math.abs(supportWidth - profileWidth),
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      dwell: lowerDwell || upperDwell,
      followerAngularSpeed: 0,
      followerCenter,
      followerRotation: 0,
      inputRevolutions: (driverAngle - sourcePoseAngle) / fullTurn,
      lowerCamPoint,
      lowerRailGap: lowerCamPoint.y - lowerRailY,
      lowerRailPoint,
      lowerRailY,
      lowerSupport: lowerExtreme.value,
      lowerWitnessPoint,
      normalizedDriverAngle,
      outputAcceleration,
      outputDisplacement,
      outputVelocity,
      railContactAlignmentError: Math.abs(
        lowerCamPoint.x - upperCamPoint.x,
      ),
      stage,
      supportWidth,
      upperCamPoint,
      upperRailGap: upperRailY - upperCamPoint.y,
      upperRailPoint,
      upperRailY,
      upperSupport: upperExtreme.value,
      upperWitnessPoint,
    };
  };

  root.userData.mechanism = 'vertex-pivoted-reuleaux-carrier-positive-return-valve';
  root.userData.cameraDistanceScale = 1.08;
  root.userData.hideGround = true;
  root.userData.supportsRestart = true;
  root.userData.minimumDisplayCycleSeconds = 4;
  root.userData.animationTiming = {authoredCyclePeriod: cyclePeriod};
  for (const marker of [carrierFaceIndex, translationIndex, lowerContactMarker, upperContactMarker]) marker.visible = false;
  // Brown draws no guide rods, base, bearing standard or guide shoes: the
  // yoke simply straddles the disk. Keep the ideal guides for the checks but
  // hide them, and let the rail liners read as the frame's own inner edges.
  for (const undrawn of [...guideRails, ...guideShoes, ...guideArms, baseRail, ...bearingSupports, rearBearing]) {
    undrawn.visible = false;
  }
  for (const liner of [lowerRailLiner, upperRailLiner]) liner.material = drivenMaterial;
  root.userData.blocks = {
    attachmentLugs,
    baseRail,
    bearingSupports,
    camBody,
    cameraEnvelope,
    carrierDisk,
    carrierFaceIndex,
    fastenerBoss,
    fastenerSquare,
    follower,
    followerBody,
    guideRails,
    guideShoes,
    guideArms,
    input,
    inputShaft,
    lowerContactMarker,
    lowerRailLiner,
    lowerRod,
    rearBearing,
    translationIndex,
    upperContactMarker,
    upperRailLiner,
    upperRod,
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    bodyHoleHalfHeight,
    camCentroid: camCentroid.clone(),
    camCentroidOffset,
    camDepth,
    carrierDiskDepth,
    carrierDiskRadius,
    cyclePeriod,
    dwellAngularSpan,
    dwellDuration: dwellAngularSpan / inputSpeedMagnitude,
    dwellFractionPerStop: dwellAngularSpan / fullTurn,
    dwellHalfAngle,
    equilateralAltitude,
    fastenerOffset: fastenerOffset.clone(),
    fastenerBossRadius,
    fastenerSquareHalfSize,
    followerDepth,
    fullTurn,
    guideMaximumY,
    guideMinimumY,
    guideRailX,
    innerCornerRadius,
    innerHalfWidth,
    inputAngularSpeed,
    inputSpeedMagnitude,
    leftBaseVertex: leftBaseVertex.clone(),
    linerDepth,
    linerStraightHalfWidth,
    linerThickness,
    lowerRodOuterCoordinate,
    outerCornerRadius,
    outerHalfHeight,
    outerHalfWidth,
    outputAmplitude,
    outputMaximumY: shaftCenter.y + outputAmplitude,
    outputMinimumY: shaftCenter.y - outputAmplitude,
    outputStroke,
    pivotVertex: pivotVertex.clone(),
    profileArcs: profileArcs.map((arc) => ({
      ...arc,
      center: arc.center.clone(),
    })),
    profileWidth,
    railHalfSpacing,
    rearFrameZ,
    rightBaseVertex: rightBaseVertex.clone(),
    rodAttachmentCoordinate,
    rodRadius,
    runningClearance,
    shaftCenter: shaftCenter.clone(),
    shaftLength,
    shaftRadius,
    sourceCarrierDiskRadiusPixels,
    sourceFastenerCenterPixels: sourceFastenerCenterPixels.clone(),
    sourceInnerHalfWidthPixels,
    sourceOuterHalfHeightPixels,
    sourceOuterHalfWidthPixels,
    sourcePivotPixels: sourcePivotPixels.clone(),
    sourcePoseAngle,
    sourceProfileWidthPixels,
    sourceScale,
    transferAngularSpan,
    transferDuration: transferAngularSpan / inputSpeedMagnitude,
    upperRodOuterCoordinate,
  };
  root.userData.profileExtremeAtAngle = profileExtremeAtAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.driverAngle;
    input.userData.angularSpeed = state.driverAngularSpeed;
    inputRotor.userData.angularSpeed = state.driverAngularSpeed;
    follower.position.copy(state.followerCenter);
    follower.rotation.set(0, 0, 0);
    follower.userData.velocity = state.outputVelocity.clone();
    lowerContactMarker.position.copy(state.lowerWitnessPoint);
    upperContactMarker.position.copy(state.upperWitnessPoint);
    root.userData.contacts = {
      carrierAndTappet: {
        carrierCenter: state.carrierCenter.clone(),
        fastenerCenter: state.fastenerWorld.clone(),
        rigidOffset: state.fastenerWorld.distanceTo(
          state.carrierCenter,
        ),
      },
      constantWidthRails: {
        alignmentError: state.railContactAlignmentError,
        lower: {
          camPoint: state.lowerCamPoint.clone(),
          gap: state.lowerRailGap,
          railPoint: state.lowerRailPoint.clone(),
          segment: state.activeProfileSegments.lower,
        },
        supportWidth: state.supportWidth,
        upper: {
          camPoint: state.upperCamPoint.clone(),
          gap: state.upperRailGap,
          railPoint: state.upperRailPoint.clone(),
          segment: state.activeProfileSegments.upper,
        },
        widthError: state.constantWidthError,
      },
      fixedGuides: {
        axis: Y_AXIS.clone(),
        followerRotationError: Math.abs(state.followerRotation),
        guideRailX,
        yokeCenterX: state.followerCenter.x,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  const model = finish(root, update, new THREE.Vector3(.4, .2, 13.6));
  for (const object of [
    cameraEnvelope,
    lowerContactMarker,
    upperContactMarker,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  model.reset = () => update(0);
  root.userData.materialsIgnoreSceneFog = true;
  return model;
}

function toothedAxialFaceCamSpringFollower() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const toothCount = 16;
  const toothPitch = fullTurn / toothCount;
  const slowFlankFraction = 0.76;
  const fastFlankFraction = 1 - slowFlankFraction;
  const inputAngularSpeed = 0.34;
  const wheelRotationPeriod = fullTurn / inputAngularSpeed;
  const toothCyclePeriod = toothPitch / inputAngularSpeed;
  const sourcePoseAngle = 0;
  const wheelCenter = new THREE.Vector3(-1.65, 0.4, 0);

  // Brown draws the cam edge-on. The straight left edge is the back face,
  // the tooth roots begin at x=158, and the tooth tips reach x=200. Eight
  // complete tooth cycles appear on the visible semicircle, hence sixteen
  // equally pitched teeth around the full axial face.
  const sourceWheelTopY = 29;
  const sourceWheelBottomY = 411;
  const sourceWheelCenterY = 220;
  const sourceWheelRadiusPixels = 191;
  const sourceBaseBackX = 124;
  const sourceToothRootX = 158;
  const sourceToothTipX = 200;
  const sourceFollowerAxisY = 212;
  const sourceFixedGuideX = 414;
  const sourceVisibleSemicircleToothCycles = 8;
  const wheelOuterRadius = 2.7;
  const sourceScale = wheelOuterRadius / sourceWheelRadiusPixels;
  const baseThickness = (sourceToothRootX - sourceBaseBackX) * sourceScale;
  const axialStroke = (sourceToothTipX - sourceToothRootX) * sourceScale;
  const baseBackX = -baseThickness / 2;
  const baseFrontX = baseThickness / 2;
  const rimInnerRadius = 2.22;
  const contactRadius = (rimInnerRadius + wheelOuterRadius) / 2;
  const runningClearance = 0.001;

  const shaftRadius = 23.5 * sourceScale;
  const shaftLength = 87 * sourceScale + .05;
  const shaftCenterOffsetX = -60.5 * sourceScale;
  const hubRadius = 50 * sourceScale;
  const hubLength = 18 * sourceScale + .02;
  const followerTipRadius = 0.16;
  const followerRodRadius = 0.11;
  const followerRodLength = 310 * sourceScale - followerTipRadius;
  const movingSpringAnchorOffset = 84 * sourceScale;
  const fixedGuideX = wheelCenter.x + baseBackX + (sourceFixedGuideX - sourceBaseBackX) * sourceScale;
  const fixedSpringAnchorX = fixedGuideX - .20;
  const springRadius = 0.27;
  const springWireRadius = 0.045;
  const springTurnCount = 7;
  const springConstant = 2.4;
  const freeSpringLength = 3.72;
  const baseY = wheelCenter.y - wheelOuterRadius - 0.38;
  const contactY = wheelCenter.y;
  const contactZ = wheelCenter.z + contactRadius;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.61,
  });
  const toothMaterial = matte(PALETTE.driver, {
    metalness: 0.17,
    roughness: 0.56,
    side: THREE.DoubleSide,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.5,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const witnessMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const positiveModulo = (value, modulus) => {
    const remainder = value % modulus;
    if (remainder === 0) return 0;
    return remainder < 0 ? remainder + modulus : remainder;
  };
  const quintic = (value) => (
    value ** 3 * (10 + value * (-15 + value * 6))
  );
  const quinticDerivative = (value) => (
    30 * value ** 2 * (value - 1) ** 2
  );
  const quinticSecondDerivative = (value) => (
    60 * value * (2 * value ** 2 - 3 * value + 1)
  );
  const toothProfileAtAngle = (angle) => {
    const angleWithinTooth = positiveModulo(angle, toothPitch);
    const phase = angleWithinTooth / toothPitch;
    let lift;
    let liftDerivativeByPhase;
    let liftSecondDerivativeByPhase;
    let flank;
    if (phase <= slowFlankFraction) {
      const flankPhase = phase / slowFlankFraction;
      lift = axialStroke * (1 - quintic(flankPhase));
      liftDerivativeByPhase = -axialStroke
        * quinticDerivative(flankPhase) / slowFlankFraction;
      liftSecondDerivativeByPhase = -axialStroke
        * quinticSecondDerivative(flankPhase) / slowFlankFraction ** 2;
      flank = phase === 0
        ? 'tooth-tip'
        : phase === slowFlankFraction
          ? 'tooth-root'
          : 'long-spring-return-flank';
    } else {
      const flankPhase = (
        phase - slowFlankFraction
      ) / fastFlankFraction;
      lift = axialStroke * quintic(flankPhase);
      liftDerivativeByPhase = axialStroke
        * quinticDerivative(flankPhase) / fastFlankFraction;
      liftSecondDerivativeByPhase = axialStroke
        * quinticSecondDerivative(flankPhase) / fastFlankFraction ** 2;
      flank = 'short-cam-driving-flank';
    }
    if (phase < 1e-12 || 1 - phase < 1e-12) {
      lift = axialStroke;
      liftDerivativeByPhase = 0;
      liftSecondDerivativeByPhase = 0;
      flank = 'tooth-tip';
    } else if (Math.abs(phase - slowFlankFraction) < 1e-12) {
      lift = 0;
      liftDerivativeByPhase = 0;
      liftSecondDerivativeByPhase = 0;
      flank = 'tooth-root';
    }
    return {
      angleWithinTooth,
      faceCoordinate: baseFrontX + lift,
      flank,
      lift,
      liftDerivativeByAngle: liftDerivativeByPhase / toothPitch,
      liftSecondDerivativeByAngle: (
        liftSecondDerivativeByPhase / toothPitch ** 2
      ),
      phase,
      toothIndex: Math.floor(
        positiveModulo(angle, fullTurn) / toothPitch
      ),
    };
  };

  const variableFaceRimGeometry = () => {
    const positions = [];
    const angularSegments = toothCount * 128;
    const point = (axialCoordinate, radius, angle) => new THREE.Vector3(
      axialCoordinate,
      radius * Math.sin(angle),
      radius * Math.cos(angle),
    );
    const triangle = (first, second, third) => {
      positions.push(
        ...first.toArray(),
        ...second.toArray(),
        ...third.toArray(),
      );
    };
    const quad = (first, second, third, fourth) => {
      triangle(first, second, third);
      triangle(first, third, fourth);
    };
    for (let index = 0; index < angularSegments; index += 1) {
      const firstAngle = fullTurn * index / angularSegments;
      const secondAngle = fullTurn * (index + 1) / angularSegments;
      const firstFaceX = toothProfileAtAngle(firstAngle).faceCoordinate;
      const secondFaceX = toothProfileAtAngle(secondAngle).faceCoordinate;
      const frontInnerFirst = point(
        firstFaceX,
        rimInnerRadius,
        firstAngle,
      );
      const frontInnerSecond = point(
        secondFaceX,
        rimInnerRadius,
        secondAngle,
      );
      const frontOuterFirst = point(
        firstFaceX,
        wheelOuterRadius,
        firstAngle,
      );
      const frontOuterSecond = point(
        secondFaceX,
        wheelOuterRadius,
        secondAngle,
      );
      const rootInnerFirst = point(
        baseFrontX,
        rimInnerRadius,
        firstAngle,
      );
      const rootInnerSecond = point(
        baseFrontX,
        rimInnerRadius,
        secondAngle,
      );
      const rootOuterFirst = point(
        baseFrontX,
        wheelOuterRadius,
        firstAngle,
      );
      const rootOuterSecond = point(
        baseFrontX,
        wheelOuterRadius,
        secondAngle,
      );
      quad(
        frontInnerFirst,
        frontInnerSecond,
        frontOuterSecond,
        frontOuterFirst,
      );
      quad(
        rootOuterFirst,
        frontOuterFirst,
        frontOuterSecond,
        rootOuterSecond,
      );
      quad(
        frontInnerFirst,
        rootInnerFirst,
        rootInnerSecond,
        frontInnerSecond,
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.userData.angularSegments = angularSegments;
    geometry.userData.toothCount = toothCount;
    return geometry;
  };

  const input = new THREE.Group();
  const inputRotor = new THREE.Group();
  input.add(inputRotor);
  input.position.copy(wheelCenter);
  input.userData.axis = X_AXIS.clone();
  input.userData.rotor = inputRotor;
  input.userData.role = 'continuous-shaft-and-sixteen-tooth-axial-cam-wheel';

  const wheelBody = cylinderAlongX(
    wheelOuterRadius,
    baseThickness,
    driverMaterial,
    80,
  );
  wheelBody.userData.role = 'edge-on-circular-base-of-axial-cam-wheel';
  inputRotor.add(wheelBody);

  const toothedRim = new THREE.Mesh(
    variableFaceRimGeometry(),
    toothMaterial,
  );
  toothedRim.userData.role = 'sixteen-profile-teeth-on-axial-rim-face';
  toothedRim.userData.toothCount = toothCount;
  inputRotor.add(toothedRim);

  const inputShaft = cylinderAlongX(
    shaftRadius,
    shaftLength,
    darkMaterial,
  );
  inputShaft.position.x = shaftCenterOffsetX;
  inputShaft.userData.role = 'input-shaft-of-axial-cam-wheel';
  inputRotor.add(inputShaft);

  const wheelHub = cylinderAlongX(
    hubRadius,
    hubLength,
    driverMaterial,
    40,
  );
  wheelHub.position.x = baseBackX - hubLength / 2 + .01;
  wheelHub.userData.role = 'hub-rigid-with-axial-cam-wheel';
  inputRotor.add(wheelHub);

  const wheelFaceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, wheelOuterRadius * 0.74, 0.085),
    witnessMaterial,
  );
  wheelFaceIndex.position.set(
    baseFrontX + 0.035,
    wheelOuterRadius * 0.46,
    0,
  );
  wheelFaceIndex.userData.role = 'rotation-index-on-axial-cam-wheel';
  inputRotor.add(wheelFaceIndex);

  const follower = new THREE.Group();
  follower.userData.axis = X_AXIS.clone();
  follower.userData.role = 'spring-loaded-axial-profile-follower-rod';
  const followerTip = new THREE.Mesh(
    new THREE.SphereGeometry(followerTipRadius, 24, 16),
    drivenMaterial,
  );
  followerTip.position.x = followerTipRadius;
  followerTip.userData.role = 'rounded-rod-tip-pressed-against-rim-face';

  const followerRod = cylinderAlongX(
    followerRodRadius,
    followerRodLength,
    drivenMaterial,
  );
  followerRod.position.x = followerTipRadius + followerRodLength / 2;
  followerRod.userData.role = 'axially-reciprocating-output-rod';

  const movingSpringCollar = cylinderAlongX(
    springRadius + 0.075,
    0.18,
    drivenMaterial,
    32,
  );
  movingSpringCollar.position.x = movingSpringAnchorOffset - 0.09;
  movingSpringCollar.userData.role = 'moving-seat-compressing-return-spring';

  const followerIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.34, 0.04),
    witnessMaterial,
  );
  followerIndex.position.set(1.22, 0, followerRodRadius + 0.045);
  followerIndex.userData.role = 'translation-index-on-axial-follower';
  follower.add(
    followerTip,
    followerRod,
    movingSpringCollar,
    followerIndex,
  );

  const coil = makeSpringRackCoil({
    turns: springTurnCount, radius: springRadius, wireRadius: springWireRadius,
    referenceSpan: freeSpringLength - 2 * springWireRadius, segments: 256, sides: 12,
  });
  const compressionSpring = new THREE.Mesh(coil.geometry, darkMaterial);
  compressionSpring.rotation.z = -Math.PI / 2;
  compressionSpring.userData.role = 'compression-spring-maintaining-cam-contact';
  compressionSpring.userData.springConstant = springConstant;

  const boredFollowerSleeve = (outerRadius, length) => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerRadius, 0, fullTurn, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, followerRodRadius + .005, 0, fullTurn, true);
    shape.holes.push(hole);
    const sleeve = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
      depth: length, bevelEnabled: false, curveSegments: 64,
    }).translate(0, 0, -length / 2), frameMaterial);
    sleeve.rotation.y = Math.PI / 2;
    return sleeve;
  };
  const fixedGuideSleeve = boredFollowerSleeve(.31, .34);
  fixedGuideSleeve.position.set(fixedGuideX, contactY, contactZ);
  fixedGuideSleeve.userData.role = 'fixed-guide-coaxial-with-follower-rod';
  const fixedSpringSeat = boredFollowerSleeve(springRadius + .075, fixedGuideX - fixedSpringAnchorX);
  fixedSpringSeat.position.set((fixedSpringAnchorX + fixedGuideX) / 2, contactY, contactZ);
  fixedSpringSeat.userData.role = 'fixed-seat-of-compression-spring';

  const guidePost = makeBeam(
    new THREE.Vector3(fixedGuideX, baseY, contactZ),
    new THREE.Vector3(fixedGuideX, contactY - .20, contactZ),
    { thickness: 0.16, depth: 0.24, color: PALETTE.frame },
  );
  guidePost.userData.role = 'fixed-upright-supporting-rod-guide';
  const guideBaseFoot = makeBeam(
    new THREE.Vector3(fixedGuideX, baseY, 0),
    new THREE.Vector3(fixedGuideX, baseY, contactZ),
    { thickness: 0.16, depth: 0.24, color: PALETTE.frame },
  );
  guideBaseFoot.userData.role = 'fixed-depth-foot-below-rod-guide';
  const guideBrace = makeBeam(
    new THREE.Vector3(fixedGuideX - 1.35, baseY, contactZ),
    new THREE.Vector3(fixedGuideX, contactY - 0.25, contactZ),
    { thickness: 0.12, depth: 0.18, color: PALETTE.frame },
  );
  guideBrace.userData.role = 'diagonal-brace-of-follower-guide';
  const guideFrontFoot = makeBeam(
    new THREE.Vector3(fixedGuideX - 1.45, baseY, contactZ),
    new THREE.Vector3(fixedGuideX, baseY, contactZ),
    {thickness: .16, depth: .24, color: PALETTE.frame},
  );
  root.add(guideFrontFoot);

  const baseRail = makeBeam(
    new THREE.Vector3(wheelCenter.x - 3.15, baseY, 0),
    new THREE.Vector3(fixedGuideX + 0.35, baseY, 0),
    { thickness: 0.18, depth: 0.28, color: PALETTE.frame },
  );
  baseRail.userData.role = 'fixed-base-of-axial-face-cam-drive';
  const shaftPedestal = makeBeam(
    new THREE.Vector3(wheelCenter.x - 1.10, baseY, 0),
    new THREE.Vector3(
      wheelCenter.x - 1.10,
      wheelCenter.y - shaftRadius - .06,
      0,
    ),
    { thickness: 0.16, depth: 0.24, color: PALETTE.frame },
  );
  shaftPedestal.userData.role = 'fixed-pedestal-of-cam-wheel-shaft';
  const shaftBearingShape = new THREE.Shape();
  shaftBearingShape.absarc(0, 0, shaftRadius + .14, 0, fullTurn, false);
  const shaftBore = new THREE.Path();
  shaftBore.absarc(0, 0, shaftRadius + .003, 0, fullTurn, true);
  shaftBearingShape.holes.push(shaftBore);
  const shaftBearing = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shaftBearingShape, {depth: .30, bevelEnabled: false, curveSegments: 64}).translate(0, 0, -.15),
    frameMaterial,
  );
  shaftBearing.rotation.y = Math.PI / 2;
  shaftBearing.position.set(
    wheelCenter.x - 1.10,
    wheelCenter.y,
    wheelCenter.z,
  );
  shaftBearing.userData.role = 'fixed-bearing-of-cam-wheel-shaft';

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 18, 12),
    witnessMaterial,
  );
  contactMarker.userData.role = 'axial-rim-follower-contact-witness';

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(9.2, 7.25, 5.9),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-0.15, 0.18, 0.15);
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-full-axial-cam-envelope';

  root.add(
    cameraEnvelope,
    baseRail,
    shaftPedestal,
    shaftBearing,
    guidePost,
    guideBaseFoot,
    guideBrace,
    fixedGuideSleeve,
    fixedSpringSeat,
    input,
    follower,
    compressionSpring,
    contactMarker,
  );

  const stateAtTime = (time) => {
    const driverAngle = sourcePoseAngle + inputAngularSpeed * time;
    const envelope = sphericalFaceFollower(toothProfileAtAngle, driverAngle, contactRadius, followerTipRadius);
    const profile = envelope.p;
    const faceWorldX = wheelCenter.x + profile.faceCoordinate;
    const followerTipPlaneX = wheelCenter.x + envelope.value - followerTipRadius + runningClearance;
    const movingSpringAnchorX = (
      followerTipPlaneX + movingSpringAnchorOffset
    );
    const springLength = fixedSpringAnchorX - movingSpringAnchorX;
    const springCompression = freeSpringLength - springLength;
    const springForce = springConstant * springCompression;
    const axialVelocity = (
      envelope.derivative * inputAngularSpeed
    );
    const axialAcceleration = (
      envelope.secondDerivative * inputAngularSpeed ** 2
    );
    const followerVelocity = new THREE.Vector3(axialVelocity, 0, 0);
    const followerAcceleration = new THREE.Vector3(
      axialAcceleration,
      0,
      0,
    );
    const camMaterialVelocity = new THREE.Vector3(
      0,
      -inputAngularSpeed * envelope.contactZ,
      inputAngularSpeed * envelope.contactY,
    );
    const relativeContactVelocity = followerVelocity.clone().sub(
      camMaterialVelocity
    );
    const faceNormal = new THREE.Vector3(envelope.q, -envelope.contactY, contactRadius - envelope.contactZ).normalize();
    const faceTangent = relativeContactVelocity.clone().normalize();
    const normalVelocityError = relativeContactVelocity.dot(faceNormal);
    const tangentialSlidingSpeed = relativeContactVelocity.dot(faceTangent);
    const camSurfacePoint = new THREE.Vector3(
      faceWorldX,
      wheelCenter.y + envelope.contactY,
      wheelCenter.z + envelope.contactZ,
    );
    const followerTipPoint = new THREE.Vector3(followerTipPlaneX + followerTipRadius, contactY, contactZ)
      .addScaledVector(faceNormal, -followerTipRadius);
    const contactWitnessPoint = camSurfacePoint.clone().lerp(
      followerTipPoint,
      0.5,
    );
    contactWitnessPoint.y += 0.09;
    const stage = profile.flank === 'tooth-tip'
      ? 'tooth-tip-outer-reversal'
      : profile.flank === 'tooth-root'
        ? 'tooth-root-inner-reversal'
        : axialVelocity > 0
          ? 'short-flank-drives-rod-outward'
          : 'spring-returns-rod-on-long-flank';
    return {
      axialAcceleration,
      envelope,
      axialDisplacement: envelope.value - followerTipRadius - baseFrontX,
      axialVelocity,
      camMaterialVelocity,
      camSurfacePoint,
      completedFollowerCycles: (
        driverAngle - sourcePoseAngle
      ) / toothPitch,
      contactGap: followerTipPoint.distanceTo(camSurfacePoint),
      contactWitnessPoint,
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      faceNormal,
      faceSlope: profile.liftDerivativeByAngle,
      faceTangent,
      faceWorldX,
      followerAcceleration,
      followerAngularSpeed: 0,
      followerPosition: new THREE.Vector3(
        followerTipPlaneX,
        contactY,
        contactZ,
      ),
      followerRotation: 0,
      followerTipPlaneX,
      followerTipPoint,
      followerVelocity,
      inputRevolutions: (
        driverAngle - sourcePoseAngle
      ) / fullTurn,
      movingSpringAnchorX,
      normalVelocityError,
      profile,
      relativeContactVelocity,
      springCompression,
      springForce,
      springLength,
      stage,
      tangentialSlidingSpeed,
    };
  };

  // Brown draws only one upright plate carrying the rod, a curved bracket
  // and hatched ground; the shaft is unsupported in the engraving. Keep the
  // measured support blocks for the hardware checks but hide the undrawn
  // pedestal, bearing, base rail, brace and feet, and draw the post, bracket
  // and hatched ground as the plate does.
  for (const undrawn of [baseRail, shaftPedestal, shaftBearing, guideBrace, guideFrontFoot, guideBaseFoot]) {
    undrawn.visible = false;
  }
  const sourcePlate = new THREE.Group();
  sourcePlate.userData.role = 'engraved-upright-bracket-and-hatched-ground';
  const postWidth = 14 * sourceScale;
  const postTop = contactY + 50 * sourceScale;
  const groundY = baseY;
  const hatchDepth = 60 * sourceScale;
  const plateZ = contactZ;
  const upperPost = makeBeam(
    new THREE.Vector3(fixedGuideX, contactY + .31, plateZ),
    new THREE.Vector3(fixedGuideX, postTop, plateZ),
    { thickness: postWidth, depth: 0.24, color: PALETTE.frame },
  );
  upperPost.userData.role = 'upright-plate-above-rod-guide';
  const gussetShape = new THREE.Shape();
  const gussetRun = 110 * sourceScale, gussetRise = 130 * sourceScale;
  gussetShape.moveTo(0, 0);
  gussetShape.lineTo(-gussetRun, 0);
  gussetShape.quadraticCurveTo(-0.18 * gussetRun, 0.12 * gussetRise, 0, gussetRise);
  gussetShape.closePath();
  const gusset = new THREE.Mesh(
    new THREE.ExtrudeGeometry(gussetShape, { depth: 0.05, bevelEnabled: false, curveSegments: 32 })
      .translate(0, 0, -0.025),
    frameMaterial,
  );
  gusset.position.set(fixedGuideX - postWidth / 2, groundY, plateZ);
  gusset.userData.role = 'curved-bracket-stiffening-upright';
  const groundLeftX = wheelCenter.x + baseBackX + (20 - sourceBaseBackX) * sourceScale;
  // The hatched ground is a cut solid: one block the upright stands on.
  const groundBlockRight = fixedGuideX + postWidth / 2;
  const ground = groundBlock(groundBlockRight - groundLeftX, hatchDepth, 0.3, {name: 'engraved-hatched-ground-block'});
  ground.position.set((groundLeftX + groundBlockRight) / 2, groundY - hatchDepth / 2, plateZ);
  sourcePlate.add(upperPost, gusset, ground);
  root.add(sourcePlate);

  root.userData.mechanism = 'sixteen-tooth-axial-face-cam-spring-follower';
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraFov = 10;
  root.userData.hideGround = true;
  root.userData.supportsRestart = true;
  root.userData.minimumDisplayCycleSeconds = toothCount;
  root.userData.animationTiming = {authoredCyclePeriod: wheelRotationPeriod};
  for (const marker of [wheelFaceIndex, followerIndex, contactMarker]) marker.visible = false;
  root.userData.blocks = {
    baseRail,
    cameraEnvelope,
    compressionSpring,
    contactMarker,
    fixedGuideSleeve,
    fixedSpringSeat,
    follower,
    followerIndex,
    followerRod,
    followerTip,
    guideBaseFoot,
    guideFrontFoot,
    guideBrace,
    guidePost,
    input,
    inputRotor,
    inputShaft,
    movingSpringCollar,
    shaftBearing,
    shaftPedestal,
    toothedRim,
    wheelBody,
    wheelFaceIndex,
    wheelHub,
  };
  root.userData.geometry = {
    axialStroke,
    axis: X_AXIS.clone(),
    baseBackX,
    baseFrontX,
    baseThickness,
    baseY,
    contactRadius,
    contactY,
    contactZ,
    fastFlankFraction,
    fixedGuideX,
    fixedSpringAnchorX,
    followerRodLength,
    followerRodRadius,
    followerTipRadius,
    freeSpringLength,
    fullTurn,
    hubLength,
    hubRadius,
    inputAngularSpeed,
    maximumFaceX: baseFrontX + axialStroke,
    minimumFaceX: baseFrontX,
    movingSpringAnchorOffset,
    rimInnerRadius,
    runningClearance,
    shaftCenterOffsetX,
    shaftLength,
    shaftRadius,
    slowFlankFraction,
    sourceBaseBackX,
    sourceFixedGuideX,
    sourceFollowerAxisY,
    sourcePoseAngle,
    sourceScale,
    sourceToothRootX,
    sourceToothTipX,
    sourceVisibleSemicircleToothCycles,
    sourceWheelBottomY,
    sourceWheelCenterY,
    sourceWheelRadiusPixels,
    sourceWheelTopY,
    springConstant,
    springRadius,
    springTurnCount,
    springWireRadius,
    toothCount,
    toothCyclePeriod,
    toothPitch,
    wheelCenter: wheelCenter.clone(),
    wheelOuterRadius,
    wheelRotationPeriod,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.toothProfileAtAngle = toothProfileAtAngle;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.x = state.driverAngle;
    input.userData.angularSpeed = state.driverAngularSpeed;
    inputRotor.userData.angularSpeed = state.driverAngularSpeed;
    follower.position.copy(state.followerPosition);
    follower.rotation.set(0, 0, 0);
    follower.userData.velocity = state.followerVelocity.clone();
    follower.userData.acceleration = state.followerAcceleration.clone();
    compressionSpring.position.set(
      state.movingSpringAnchorX,
      contactY,
      contactZ,
    );
    coil.update(0, state.springLength, 0, 0);
    compressionSpring.userData.length = state.springLength;
    compressionSpring.userData.compression = state.springCompression;
    compressionSpring.userData.force = state.springForce;
    contactMarker.position.copy(state.contactWitnessPoint);
    root.userData.contacts = {
      axialCamFollower: {
        camMaterialVelocity: state.camMaterialVelocity.clone(),
        camPoint: state.camSurfacePoint.clone(),
        faceNormal: state.faceNormal.clone(),
        faceTangent: state.faceTangent.clone(),
        followerPoint: state.followerTipPoint.clone(),
        gap: state.contactGap,
        normalVelocityError: state.normalVelocityError,
        relativeVelocity: state.relativeContactVelocity.clone(),
        slidingSpeed: state.tangentialSlidingSpeed,
      },
      compressionSpring: {
        compression: state.springCompression,
        force: state.springForce,
        length: state.springLength,
        hasPreload: state.springForce > 0,
        trajectoryPrescribed: true,
      },
      fixedRodGuide: {
        axis: X_AXIS.clone(),
        followerAngularSpeed: state.followerAngularSpeed,
        followerRotationError: Math.abs(state.followerRotation),
        radialError: Math.hypot(
          state.followerPosition.y - contactY,
          state.followerPosition.z - contactZ,
        ),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  const model = finish(root, update, new THREE.Vector3(0, 0, 15));
  for (const object of [cameraEnvelope, contactMarker]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  model.reset = () => update(0);
  root.userData.materialsIgnoreSceneFog = true;
  return model;
}

function frenchExpansionEccentricValveFork() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const inputAngularSpeed = 0.56;
  const cyclePeriod = fullTurn / inputAngularSpeed;
  const sourcePoseAngle = 0;
  const shaftCenter = new THREE.Vector3(-2.5, 0.55, 0);
  const forkPivot = new THREE.Vector3(2.5, 0.55, 0);
  const contactPlaneZ = 0.32;

  // Pixel anchors from Brown's engraving. The keyed shaft is visibly offset
  // from the center of a circular eccentric. Two rollers on one rigid fork
  // alternately carry the load as that eccentric turns.
  const sourceShaftCenterX = 83;
  const sourceShaftCenterY = 226;
  const sourceCamCenterX = 96;
  const sourceCamCenterY = 226;
  const sourceForkPivotX = 449;
  const sourceForkPivotY = 231;
  const sourceUpperRollerCenterX = 81;
  const sourceUpperRollerCenterY = 116;
  const sourceLowerRollerCenterX = 80;
  const sourceLowerRollerCenterY = 336;
  const sourceCamRadiusPixels = 84;
  const sourceRollerRadiusPixels = 25;
  const sourceForkPivotDistancePixels = (
    sourceForkPivotX - sourceShaftCenterX
  );
  const sourceRollerHalfSpacingPixels = (
    sourceLowerRollerCenterY - sourceUpperRollerCenterY
  ) / 2;
  const forkPivotDistance = forkPivot.x - shaftCenter.x;
  const sourceScale = forkPivotDistance / sourceForkPivotDistancePixels;
  const eccentricity = (
    sourceCamCenterX - sourceShaftCenterX
  ) * sourceScale;
  const rollerHalfSpacing = sourceRollerHalfSpacingPixels * sourceScale;
  const rollerRadius = sourceRollerRadiusPixels * sourceScale;
  const contactDistance = rollerHalfSpacing;
  const camRadius = contactDistance - rollerRadius;
  const sourceScaledCamRadius = sourceCamRadiusPixels * sourceScale;
  const handoffHalfAngle = 0.02;
  const rollerLocalCenters = {
    lower: new THREE.Vector2(-forkPivotDistance, -rollerHalfSpacing),
    upper: new THREE.Vector2(-forkPivotDistance, rollerHalfSpacing),
  };

  const positiveModulo = (value, modulus) => {
    const remainder = value % modulus;
    if (remainder === 0) return 0;
    return remainder < 0 ? remainder + modulus : remainder;
  };
  const wrapAngle = (angle) => Math.atan2(
    Math.sin(angle),
    Math.cos(angle),
  );
  const rotateVector = (vector, angle) => new THREE.Vector2(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  );
  const quarterTurn = (vector) => new THREE.Vector2(-vector.y, vector.x);
  const quintic = (value) => (
    value ** 3 * (10 + value * (-15 + value * 6))
  );
  const quinticDerivative = (value) => (
    30 * value ** 2 * (value - 1) ** 2
  );
  const quinticSecondDerivative = (value) => (
    60 * value * (2 * value ** 2 - 3 * value + 1)
  );
  const vector3AtContactPlane = (vector) => new THREE.Vector3(
    vector.x,
    vector.y,
    contactPlaneZ,
  );
  const camCenterAtAngle = (driverAngle) => new THREE.Vector2(
    shaftCenter.x + eccentricity * Math.cos(driverAngle),
    shaftCenter.y + eccentricity * Math.sin(driverAngle),
  );

  const branchKinematicsAtAngle = (driverAngle, side) => {
    const camCenter = camCenterAtAngle(driverAngle);
    const localCenter = rollerLocalCenters[side];
    const pivotToCam = camCenter.clone().sub(new THREE.Vector2(
      forkPivot.x,
      forkPivot.y,
    ));
    const localRadius = localCenter.length();
    const pivotToCamRadius = pivotToCam.length();
    const cosine = THREE.MathUtils.clamp(
      (
        localRadius ** 2 + pivotToCamRadius ** 2
          - contactDistance ** 2
      ) / (2 * localRadius * pivotToCamRadius),
      -1,
      1,
    );
    const offsetAngle = Math.acos(cosine);
    const baseAngle = Math.atan2(pivotToCam.y, pivotToCam.x)
      - Math.atan2(localCenter.y, localCenter.x);
    const candidates = [
      wrapAngle(baseAngle + offsetAngle),
      wrapAngle(baseAngle - offsetAngle),
    ];
    const forkAngle = candidates.reduce((best, candidate) => (
      Math.abs(candidate) < Math.abs(best) ? candidate : best
    ));
    const rotatedArm = rotateVector(localCenter, forkAngle);
    const rollerCenter = new THREE.Vector2(
      forkPivot.x + rotatedArm.x,
      forkPivot.y + rotatedArm.y,
    );
    const contactVector = rollerCenter.clone().sub(camCenter);
    const rollerDerivativeByForkAngle = quarterTurn(rotatedArm);
    const camDerivativeByDriverAngle = new THREE.Vector2(
      -eccentricity * Math.sin(driverAngle),
      eccentricity * Math.cos(driverAngle),
    );
    const denominator = contactVector.dot(rollerDerivativeByForkAngle);
    const forkAngleDerivative = contactVector.dot(
      camDerivativeByDriverAngle,
    ) / denominator;
    const relativeDerivative = rollerDerivativeByForkAngle.clone()
      .multiplyScalar(forkAngleDerivative)
      .sub(camDerivativeByDriverAngle);
    const rollerSecondDerivativeByForkAngle = rotatedArm.clone()
      .multiplyScalar(-1);
    const camSecondDerivativeByDriverAngle = new THREE.Vector2(
      -eccentricity * Math.cos(driverAngle),
      -eccentricity * Math.sin(driverAngle),
    );
    const forkAngleSecondDerivative = (
      -relativeDerivative.lengthSq()
      - contactVector.dot(
        rollerSecondDerivativeByForkAngle.clone()
          .multiplyScalar(forkAngleDerivative ** 2)
          .sub(camSecondDerivativeByDriverAngle),
      )
    ) / denominator;
    return {
      forkAngle,
      forkAngleDerivative,
      forkAngleSecondDerivative,
    };
  };

  const forkKinematicsAtAngle = (driverAngle) => {
    const normalizedDriverAngle = positiveModulo(driverAngle, fullTurn);
    const handoffs = [
      {
        center: Math.PI / 2,
        departing: 'upper',
        incoming: 'lower',
      },
      {
        center: Math.PI * 3 / 2,
        departing: 'lower',
        incoming: 'upper',
      },
    ];
    let handoff = null;
    for (const candidate of handoffs) {
      const offset = wrapAngle(normalizedDriverAngle - candidate.center);
      if (Math.abs(offset) <= handoffHalfAngle + 1e-14) {
        handoff = { ...candidate, offset };
        break;
      }
    }

    let forkAngle;
    let forkAngleDerivative;
    let forkAngleSecondDerivative;
    let upperEngagement;
    let lowerEngagement;
    let loadState;
    if (handoff) {
      const departing = branchKinematicsAtAngle(
        driverAngle,
        handoff.departing,
      );
      const incoming = branchKinematicsAtAngle(
        driverAngle,
        handoff.incoming,
      );
      const handoffFraction = (
        handoff.offset + handoffHalfAngle
      ) / (2 * handoffHalfAngle);
      const blend = quintic(handoffFraction);
      const blendDerivative = quinticDerivative(handoffFraction)
        / (2 * handoffHalfAngle);
      const blendSecondDerivative = quinticSecondDerivative(handoffFraction)
        / (2 * handoffHalfAngle) ** 2;
      const angleDifference = incoming.forkAngle - departing.forkAngle;
      const derivativeDifference = incoming.forkAngleDerivative
        - departing.forkAngleDerivative;
      forkAngle = departing.forkAngle + blend * angleDifference;
      forkAngleDerivative = departing.forkAngleDerivative
        + blend * derivativeDifference
        + blendDerivative * angleDifference;
      forkAngleSecondDerivative = departing.forkAngleSecondDerivative
        + blend * (
          incoming.forkAngleSecondDerivative
            - departing.forkAngleSecondDerivative
        )
        + 2 * blendDerivative * derivativeDifference
        + blendSecondDerivative * angleDifference;
      upperEngagement = handoff.departing === 'upper'
        ? 1 - blend
        : blend;
      lowerEngagement = 1 - upperEngagement;
      loadState = 'microscopic-clearance-roller-handoff';
    } else {
      const activeSide = Math.cos(normalizedDriverAngle) >= 0
        ? 'upper'
        : 'lower';
      const branch = branchKinematicsAtAngle(driverAngle, activeSide);
      forkAngle = branch.forkAngle;
      forkAngleDerivative = branch.forkAngleDerivative;
      forkAngleSecondDerivative = branch.forkAngleSecondDerivative;
      upperEngagement = activeSide === 'upper' ? 1 : 0;
      lowerEngagement = activeSide === 'lower' ? 1 : 0;
      loadState = `${activeSide}-roller-drives-fork`;
    }

    const rollerCenter = (side) => {
      const arm = rotateVector(rollerLocalCenters[side], forkAngle);
      return {
        arm,
        center: new THREE.Vector2(
          forkPivot.x + arm.x,
          forkPivot.y + arm.y,
        ),
      };
    };
    return {
      forkAngle,
      forkAngleDerivative,
      forkAngleSecondDerivative,
      loadState,
      lower: rollerCenter('lower'),
      lowerEngagement,
      normalizedDriverAngle,
      upper: rollerCenter('upper'),
      upperEngagement,
    };
  };

  const sourceForkState = forkKinematicsAtAngle(sourcePoseAngle);
  const valveGuideX = sourceForkState.lower.center.x;
  const valveConnectingRodLength = 0.96;
  const valveStemLength = 0.9;

  const contactStateAtAngle = (driverAngle, forkState, side) => {
    const sideState = forkState[side];
    const engagement = side === 'upper'
      ? forkState.upperEngagement
      : forkState.lowerEngagement;
    const camCenter2 = camCenterAtAngle(driverAngle);
    const normal2 = sideState.center.clone().sub(camCenter2).normalize();
    const tangent2 = quarterTurn(normal2);
    const camPoint2 = camCenter2.clone().addScaledVector(normal2, camRadius);
    const rollerPoint2 = sideState.center.clone()
      .addScaledVector(normal2, -rollerRadius);
    const gap = sideState.center.distanceTo(camCenter2) - contactDistance;
    const witness2 = camPoint2.clone().lerp(rollerPoint2, 0.5);
    const forkAngularSpeed = (
      forkState.forkAngleDerivative * inputAngularSpeed
    );
    const forkAngularAcceleration = (
      forkState.forkAngleSecondDerivative * inputAngularSpeed ** 2
    );
    const centerVelocity2 = quarterTurn(sideState.arm)
      .multiplyScalar(forkAngularSpeed);
    const centerAcceleration2 = sideState.arm.clone()
      .multiplyScalar(-(forkAngularSpeed ** 2))
      .addScaledVector(quarterTurn(sideState.arm), forkAngularAcceleration);
    const camPointFromShaft2 = camPoint2.clone().sub(new THREE.Vector2(
      shaftCenter.x,
      shaftCenter.y,
    ));
    const camMaterialVelocity2 = quarterTurn(camPointFromShaft2)
      .multiplyScalar(inputAngularSpeed);
    const virtualRollingAngularSpeed = (
      centerVelocity2.dot(tangent2) - camMaterialVelocity2.dot(tangent2)
    ) / rollerRadius;
    const rollerWorldAngularSpeed = (
      engagement * virtualRollingAngularSpeed
    );
    const rollerLocalAngularSpeed = (
      rollerWorldAngularSpeed - forkAngularSpeed
    );
    const rollerRadiusVector2 = normal2.clone()
      .multiplyScalar(-rollerRadius);
    const rollerMaterialVelocity2 = centerVelocity2.clone().addScaledVector(
      quarterTurn(rollerRadiusVector2),
      rollerWorldAngularSpeed,
    );
    const relativeContactVelocity2 = rollerMaterialVelocity2.clone()
      .sub(camMaterialVelocity2);
    return {
      camMaterialVelocity: new THREE.Vector3(
        camMaterialVelocity2.x,
        camMaterialVelocity2.y,
        0,
      ),
      camPoint: vector3AtContactPlane(camPoint2),
      center: vector3AtContactPlane(sideState.center),
      centerAcceleration: new THREE.Vector3(
        centerAcceleration2.x,
        centerAcceleration2.y,
        0,
      ),
      centerVelocity: new THREE.Vector3(
        centerVelocity2.x,
        centerVelocity2.y,
        0,
      ),
      engaged: engagement > 1 - 1e-12,
      engagement,
      gap,
      normal: new THREE.Vector3(normal2.x, normal2.y, 0),
      normalVelocityError: relativeContactVelocity2.dot(normal2),
      relativeContactVelocity: new THREE.Vector3(
        relativeContactVelocity2.x,
        relativeContactVelocity2.y,
        0,
      ),
      rollerLocalAngularSpeed,
      rollerMaterialVelocity: new THREE.Vector3(
        rollerMaterialVelocity2.x,
        rollerMaterialVelocity2.y,
        0,
      ),
      rollerPoint: vector3AtContactPlane(rollerPoint2),
      rollerWorldAngularSpeed,
      tangent: new THREE.Vector3(tangent2.x, tangent2.y, 0),
      tangentialSlipSpeed: relativeContactVelocity2.dot(tangent2),
      virtualRollingAngularSpeed,
      witnessPoint: vector3AtContactPlane(witness2),
    };
  };

  const kinematicsAtDriverAngle = (driverAngle) => {
    const forkState = forkKinematicsAtAngle(driverAngle);
    const camCenter2 = camCenterAtAngle(driverAngle);
    const upperContact = contactStateAtAngle(
      driverAngle,
      forkState,
      'upper',
    );
    const lowerContact = contactStateAtAngle(
      driverAngle,
      forkState,
      'lower',
    );
    const forkAngularSpeed = (
      forkState.forkAngleDerivative * inputAngularSpeed
    );
    const forkAngularAcceleration = (
      forkState.forkAngleSecondDerivative * inputAngularSpeed ** 2
    );
    const horizontalOffset = lowerContact.center.x - valveGuideX;
    const verticalReach = Math.sqrt(
      valveConnectingRodLength ** 2 - horizontalOffset ** 2,
    );
    const outputY = lowerContact.center.y - verticalReach;
    const outputVelocityY = lowerContact.centerVelocity.y
      + horizontalOffset * lowerContact.centerVelocity.x / verticalReach;
    const outputAccelerationY = lowerContact.centerAcceleration.y
      + (
        lowerContact.centerVelocity.x ** 2
          + horizontalOffset * lowerContact.centerAcceleration.x
      ) / verticalReach
      + horizontalOffset ** 2 * lowerContact.centerVelocity.x ** 2
        / verticalReach ** 3;
    const outputPoint = new THREE.Vector3(
      valveGuideX,
      outputY,
      contactPlaneZ,
    );
    const valveConnectingRodVector = lowerContact.center.clone()
      .sub(outputPoint);
    return {
      camCenter: vector3AtContactPlane(camCenter2),
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      forkAngle: forkState.forkAngle,
      forkAngularAcceleration,
      forkAngularSpeed,
      inputRevolutions: (
        driverAngle - sourcePoseAngle
      ) / fullTurn,
      loadState: forkState.loadState,
      lowerContact,
      normalizedDriverAngle: forkState.normalizedDriverAngle,
      outputAcceleration: new THREE.Vector3(0, outputAccelerationY, 0),
      outputPoint,
      outputVelocity: new THREE.Vector3(0, outputVelocityY, 0),
      stage: Math.abs(outputVelocityY) < 0.002
        ? 'valve-rod-at-stroke-reversal'
        : outputVelocityY > 0
          ? 'valve-rod-rises'
          : 'valve-rod-descends',
      upperContact,
      valveConnectingRodLength: valveConnectingRodVector.length(),
      valveHorizontalGuideError: Math.abs(outputPoint.x - valveGuideX),
    };
  };

  // Integrating the local roller rates makes the visible face indices obey
  // the exact no-slip rate while engaged. An idle roller counter-rotates
  // locally only enough to hold its world orientation steady.
  const rollerSpinSampleCount = 8192;
  const rollerSpinStep = fullTurn / rollerSpinSampleCount;
  const rollerSpinTables = {
    lower: new Float64Array(rollerSpinSampleCount + 1),
    upper: new Float64Array(rollerSpinSampleCount + 1),
  };
  for (let sample = 0; sample < rollerSpinSampleCount; sample += 1) {
    const midpointAngle = (sample + 0.5) * rollerSpinStep;
    const state = kinematicsAtDriverAngle(midpointAngle);
    for (const side of ['lower', 'upper']) {
      rollerSpinTables[side][sample + 1] = (
        rollerSpinTables[side][sample]
          + state[`${side}Contact`].rollerLocalAngularSpeed
            / inputAngularSpeed * rollerSpinStep
      );
    }
  }
  const rollerLocalSpinAtAngle = (driverAngle, side) => {
    const relativeAngle = driverAngle - sourcePoseAngle;
    const completedTurns = Math.floor(relativeAngle / fullTurn);
    const phase = relativeAngle - completedTurns * fullTurn;
    const tableCoordinate = phase / rollerSpinStep;
    const lowerIndex = Math.min(
      Math.floor(tableCoordinate),
      rollerSpinSampleCount - 1,
    );
    const fraction = tableCoordinate - lowerIndex;
    const table = rollerSpinTables[side];
    const withinTurn = THREE.MathUtils.lerp(
      table[lowerIndex],
      table[lowerIndex + 1],
      fraction,
    );
    return completedTurns * table[rollerSpinSampleCount] + withinTurn;
  };

  let outputMinimumY = Infinity;
  let outputMaximumY = -Infinity;
  let maximumHandoffClearance = 0;
  for (let sample = 0; sample <= 4096; sample += 1) {
    const state = kinematicsAtDriverAngle(fullTurn * sample / 4096);
    outputMinimumY = Math.min(outputMinimumY, state.outputPoint.y);
    outputMaximumY = Math.max(outputMaximumY, state.outputPoint.y);
    if (state.loadState === 'microscopic-clearance-roller-handoff') {
      maximumHandoffClearance = Math.max(
        maximumHandoffClearance,
        state.lowerContact.gap,
        state.upperContact.gap,
      );
    }
  }
  for (const center of [Math.PI / 2, Math.PI * 3 / 2]) {
    for (const offset of [-handoffHalfAngle, 0, handoffHalfAngle]) {
      const state = kinematicsAtDriverAngle(center + offset);
      maximumHandoffClearance = Math.max(
        maximumHandoffClearance,
        state.lowerContact.gap,
        state.upperContact.gap,
      );
    }
  }
  const outputStroke = outputMaximumY - outputMinimumY;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.61,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.64,
  });
  const rollerMaterial = matte(PALETTE.brass, {
    metalness: 0.25,
    roughness: 0.47,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.5,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const witnessMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const input = planarRotor();
  input.position.set(shaftCenter.x, shaftCenter.y, 0);
  input.userData.role = 'keyed-crankshaft-with-fixed-expansion-eccentric';
  const inputRotor = input.userData.rotor;

  const camBody = cylinderAlongZ(camRadius, 0.64, driverMaterial, 96);
  camBody.position.set(eccentricity, 0, 0);
  camBody.userData.role = 'circular-expansion-eccentric-offset-from-shaft';
  camBody.userData.radius = camRadius;
  inputRotor.add(camBody);

  const camFaceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(camRadius * 0.72, 0.065, 0.04),
    witnessMaterial,
  );
  camFaceIndex.position.set(
    eccentricity + camRadius * 0.48,
    0,
    0.365,
  );
  camFaceIndex.userData.role = 'rotation-index-on-expansion-eccentric';
  inputRotor.add(camFaceIndex);

  const inputShaft = cylinderAlongZ(0.2, 1.5, darkMaterial, 32);
  inputShaft.userData.role = 'true-crankshaft-axis-through-keyed-eccentric';
  inputRotor.add(inputShaft);

  const shaftKey = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.22, 0.06),
    driverMaterial,
  );
  shaftKey.position.set(0.14, -0.08, 0.79);
  shaftKey.rotation.z = -Math.PI / 4;
  shaftKey.userData.role = 'visible-key-fixing-eccentric-to-crankshaft';
  inputRotor.add(shaftKey);

  const camCenterWitness = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.026, 8, 32),
    witnessMaterial,
  );
  camCenterWitness.position.set(eccentricity, 0, 0.38);
  camCenterWitness.userData.role = 'visible-offset-center-of-eccentric';
  inputRotor.add(camCenterWitness);

  const fork = new THREE.Group();
  fork.position.set(forkPivot.x, forkPivot.y, 0);
  fork.userData.role = 'one-piece-forked-vibrating-valve-arm';
  fork.userData.axis = Z_AXIS.clone();

  const curvedForkMember = (points, role) => {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, y]) => new THREE.Vector3(x, y, 0)),
      false,
      'centripetal',
    );
    const member = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 96, 0.21, 12, false),
      drivenMaterial,
    );
    member.position.z = contactPlaneZ;
    member.scale.z = 0.72;
    member.userData.role = role;
    return member;
  };
  const upperForkArm = curvedForkMember([
    [0, 0.12],
    [-1.65, 0.22],
    [-3.45, 1.18],
    [-forkPivotDistance, rollerHalfSpacing],
  ], 'upper-arm-of-one-piece-captured-eccentric-fork');
  const lowerForkArm = curvedForkMember([
    [0, -0.12],
    [-1.7, -0.2],
    [-3.48, -1.18],
    [-forkPivotDistance, -rollerHalfSpacing],
  ], 'lower-arm-of-one-piece-captured-eccentric-fork');
  const outerForkBow = curvedForkMember([
    [-forkPivotDistance, rollerHalfSpacing],
    [-forkPivotDistance - 0.72, 1.27],
    [-forkPivotDistance - 1.02, 0],
    [-forkPivotDistance - 0.72, -1.27],
    [-forkPivotDistance, -rollerHalfSpacing],
  ], 'outer-bow-rigidly-joining-both-fork-arms');
  fork.add(upperForkArm, lowerForkArm, outerForkBow);

  const forkPivotShaftRadius = 0.19;
  const forkPivotBoss = boredCylinderAlongZ(0.46, 0.5,
    forkPivotShaftRadius + 0.012, drivenMaterial, 48);
  forkPivotBoss.position.z = contactPlaneZ;
  forkPivotBoss.userData.role = 'rocking-boss-of-fork-at-fixed-right-pivot';
  const forkMotionIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.3, 0.04),
    witnessMaterial,
  );
  forkMotionIndex.position.set(0, 0.29, contactPlaneZ + 0.3);
  forkMotionIndex.userData.role = 'rocking-index-on-fork-pivot-boss';
  fork.add(forkPivotBoss, forkMotionIndex);

  const rollerPinRadius = 0.11;
  const makeForkRoller = (side) => {
    const roller = planarRotor();
    const localCenter = rollerLocalCenters[side];
    roller.position.set(localCenter.x, localCenter.y, contactPlaneZ);
    roller.userData.role = `${side}-contact-roller-carried-by-fork`;
    roller.userData.rollerFollower = true;
    roller.userData.side = side;
    const rollerRotor = roller.userData.rotor;
    const wheel = boredCylinderAlongZ(
      rollerRadius,
      0.48,
      rollerPinRadius + 0.012,
      rollerMaterial,
      48,
    );
    wheel.userData.role = `${side}-rolling-wheel-against-eccentric`;
    wheel.userData.radius = rollerRadius;
    const index = new THREE.Mesh(
      new THREE.BoxGeometry(rollerRadius * 0.54, 0.055, 0.038),
      witnessMaterial,
    );
    index.position.set(rollerRadius * 0.51, 0, 0.28);
    index.userData.role = `${side}-roller-no-slip-rotation-index`;
    rollerRotor.add(wheel, index);
    const pin = cylinderAlongZ(rollerPinRadius, 0.86, darkMaterial, 28);
    pin.position.z = 0.02;
    pin.userData.role = `${side}-fixed-pin-carrying-contact-roller`;
    roller.add(pin);
    fork.add(roller);
    return {
      index,
      pin,
      roller,
      rollerRotor,
      wheel,
    };
  };
  const upperRollerAssembly = makeForkRoller('upper');
  const lowerRollerAssembly = makeForkRoller('lower');

  const valveConnectingLink = makeBeam(
    new THREE.Vector3(),
    new THREE.Vector3(0, -valveConnectingRodLength, 0),
    {
      color: PALETTE.driven,
      depth: 0.34,
      jointRadius: 0.18,
      thickness: 0.22,
    },
  );
  valveConnectingLink.userData.role = (
    'articulated-link-from-lower-fork-pin-to-guided-valve-rod'
  );

  const outputSlider = new THREE.Group();
  outputSlider.userData.role = 'vertically-guided-slide-valve-rod';
  outputSlider.userData.axis = Y_AXIS.clone();
  const outputPin = cylinderAlongZ(0.14, 0.58, darkMaterial, 28);
  outputPin.userData.role = 'wrist-pin-at-top-of-guided-valve-rod';
  const valveStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, valveStemLength, 28),
    drivenMaterial,
  );
  valveStem.position.y = -valveStemLength / 2;
  valveStem.userData.role = 'reciprocating-slide-valve-stem';
  const outputIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.31, 0.065, 0.04),
    witnessMaterial,
  );
  outputIndex.position.set(0, -0.62, 0.19);
  outputIndex.userData.role = 'translation-index-on-slide-valve-stem';
  outputSlider.add(outputPin, valveStem, outputIndex);

  const baseY = outputMinimumY - valveStemLength - 0.24;
  const valveGuideY = outputMinimumY - valveStemLength * 0.54;
  const valveGuide = annularSleeveAlongY({
    innerRadius: 0.14,
    length: 0.34,
    material: frameMaterial,
    outerRadius: 0.29,
  });
  valveGuide.position.set(valveGuideX, valveGuideY, contactPlaneZ);
  valveGuide.userData.role = 'fixed-vertical-guide-for-slide-valve-rod';

  const baseRail = makeBeam(
    new THREE.Vector3(shaftCenter.x - 1.65, baseY, -0.42),
    new THREE.Vector3(forkPivot.x + 0.7, baseY, -0.42),
    { thickness: 0.18, depth: 0.28, color: PALETTE.frame },
  );
  baseRail.userData.role = 'fixed-base-of-expansion-eccentric-valve-drive';
  const crankshaftSupport = makeBeam(
    new THREE.Vector3(shaftCenter.x - 0.9, baseY, -0.42),
    new THREE.Vector3(shaftCenter.x - 0.9, shaftCenter.y, -0.42),
    { thickness: 0.15, depth: 0.22, color: PALETTE.frame },
  );
  crankshaftSupport.userData.role = 'fixed-support-of-crankshaft-bearing';
  const crankshaftBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.073, 9, 36),
    frameMaterial,
  );
  crankshaftBearing.position.set(
    shaftCenter.x - 0.9,
    shaftCenter.y,
    -0.42,
  );
  crankshaftBearing.userData.role = 'fixed-rear-bearing-of-crankshaft';
  const pivotSupport = makeBeam(
    new THREE.Vector3(forkPivot.x, baseY, -0.42),
    new THREE.Vector3(forkPivot.x, forkPivot.y, -0.42),
    { thickness: 0.16, depth: 0.24, color: PALETTE.frame },
  );
  pivotSupport.userData.role = 'fixed-upright-support-of-fork-pivot';
  const fixedPivotShaft = cylinderAlongZ(forkPivotShaftRadius, 1.45, darkMaterial, 32);
  fixedPivotShaft.position.set(forkPivot.x, forkPivot.y, 0.02);
  fixedPivotShaft.userData.role = 'fixed-shaft-through-rocking-fork-boss';
  const fixedPivotBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.074, 9, 40),
    frameMaterial,
  );
  fixedPivotBearing.position.set(forkPivot.x, forkPivot.y, -0.43);
  fixedPivotBearing.userData.role = 'fixed-rear-bearing-of-fork-pivot';
  const guideSupport = makeBeam(
    new THREE.Vector3(valveGuideX, baseY, -0.42),
    new THREE.Vector3(valveGuideX, valveGuideY, -0.42),
    { thickness: 0.13, depth: 0.2, color: PALETTE.frame },
  );
  guideSupport.userData.role = 'fixed-support-of-vertical-valve-guide';

  const upperContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 18, 12),
    witnessMaterial,
  );
  upperContactMarker.userData.role = 'upper-roller-contact-gap-witness';
  const lowerContactMarker = upperContactMarker.clone();
  lowerContactMarker.userData.role = 'lower-roller-contact-gap-witness';

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(8.9, 6.45, 1.8),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-0.35, -0.22, -0.28);
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = (
    'invisible-full-stroke-expansion-eccentric-envelope'
  );

  root.add(
    cameraEnvelope,
    baseRail,
    crankshaftSupport,
    crankshaftBearing,
    pivotSupport,
    fixedPivotBearing,
    fixedPivotShaft,
    guideSupport,
    valveGuide,
    input,
    fork,
    valveConnectingLink,
    outputSlider,
    upperContactMarker,
    lowerContactMarker,
  );

  const stateAtTime = (time) => {
    const driverAngle = sourcePoseAngle + inputAngularSpeed * time;
    const state = kinematicsAtDriverAngle(driverAngle);
    state.lowerContact.localSpinAngle = rollerLocalSpinAtAngle(
      driverAngle,
      'lower',
    );
    state.upperContact.localSpinAngle = rollerLocalSpinAtAngle(
      driverAngle,
      'upper',
    );
    state.lowerContact.worldRotation = state.forkAngle
      + state.lowerContact.localSpinAngle;
    state.upperContact.worldRotation = state.forkAngle
      + state.upperContact.localSpinAngle;
    return state;
  };

  root.userData.mechanism = (
    'twin-roller-expansion-eccentric-rocking-valve-fork'
  );
  root.userData.cameraDistanceScale = 1.04;
  root.userData.blocks = {
    baseRail,
    camBody,
    camCenterWitness,
    cameraEnvelope,
    camFaceIndex,
    crankshaftBearing,
    crankshaftSupport,
    fixedPivotBearing,
    fixedPivotShaft,
    fork,
    forkMotionIndex,
    forkPivotBoss,
    guideSupport,
    input,
    inputRotor,
    inputShaft,
    lowerContactMarker,
    lowerForkArm,
    lowerRoller: lowerRollerAssembly.roller,
    lowerRollerIndex: lowerRollerAssembly.index,
    lowerRollerPin: lowerRollerAssembly.pin,
    lowerRollerRotor: lowerRollerAssembly.rollerRotor,
    lowerRollerWheel: lowerRollerAssembly.wheel,
    outerForkBow,
    outputIndex,
    outputPin,
    outputSlider,
    pivotSupport,
    shaftKey,
    upperContactMarker,
    upperForkArm,
    upperRoller: upperRollerAssembly.roller,
    upperRollerIndex: upperRollerAssembly.index,
    upperRollerPin: upperRollerAssembly.pin,
    upperRollerRotor: upperRollerAssembly.rollerRotor,
    upperRollerWheel: upperRollerAssembly.wheel,
    valveConnectingLink,
    valveGuide,
    valveStem,
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    camRadius,
    contactDistance,
    contactPlaneZ,
    cyclePeriod,
    eccentricity,
    forkPivot: forkPivot.clone(),
    forkPivotDistance,
    fullTurn,
    handoffHalfAngle,
    inputAngularSpeed,
    maximumHandoffClearance,
    outputMaximumY,
    outputMinimumY,
    outputStroke,
    rollerHalfSpacing,
    rollerLocalCenters: {
      lower: rollerLocalCenters.lower.clone(),
      upper: rollerLocalCenters.upper.clone(),
    },
    rollerRadius,
    rollerSpinSampleCount,
    shaftCenter: shaftCenter.clone(),
    sourceCamCenterX,
    sourceCamCenterY,
    sourceCamRadiusPixels,
    sourceForkPivotDistancePixels,
    sourceForkPivotX,
    sourceForkPivotY,
    sourceLowerRollerCenterX,
    sourceLowerRollerCenterY,
    sourcePoseAngle,
    sourceRollerHalfSpacingPixels,
    sourceRollerRadiusPixels,
    sourceScale,
    sourceScaledCamRadius,
    sourceShaftCenterX,
    sourceShaftCenterY,
    sourceUpperRollerCenterX,
    sourceUpperRollerCenterY,
    valveConnectingRodLength,
    valveGuideX,
    valveStemLength,
  };
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.set(0, 0, state.driverAngle);
    input.userData.angularSpeed = state.driverAngularSpeed;
    inputRotor.userData.angularSpeed = state.driverAngularSpeed;
    fork.rotation.set(0, 0, state.forkAngle);
    fork.userData.angularSpeed = state.forkAngularSpeed;
    fork.userData.angularAcceleration = state.forkAngularAcceleration;
    upperRollerAssembly.rollerRotor.rotation.set(
      0,
      0,
      state.upperContact.localSpinAngle,
    );
    lowerRollerAssembly.rollerRotor.rotation.set(
      0,
      0,
      state.lowerContact.localSpinAngle,
    );
    upperRollerAssembly.roller.userData.angularSpeed = (
      state.upperContact.rollerWorldAngularSpeed
    );
    lowerRollerAssembly.roller.userData.angularSpeed = (
      state.lowerContact.rollerWorldAngularSpeed
    );
    outputSlider.position.copy(state.outputPoint);
    outputSlider.userData.velocity = state.outputVelocity.clone();
    outputSlider.userData.acceleration = state.outputAcceleration.clone();
    valveConnectingLink.userData.setEndpoints(
      state.lowerContact.center,
      state.outputPoint,
    );
    upperContactMarker.position.copy(state.upperContact.witnessPoint);
    upperContactMarker.position.z = contactPlaneZ + 0.44;
    lowerContactMarker.position.copy(state.lowerContact.witnessPoint);
    lowerContactMarker.position.z = contactPlaneZ + 0.44;
    root.userData.contacts = {
      capturedEccentric: {
        camCenter: state.camCenter.clone(),
        contactDistance,
        loadState: state.loadState,
        lower: state.lowerContact,
        upper: state.upperContact,
      },
      fixedForkPivot: {
        angularAcceleration: state.forkAngularAcceleration,
        angularSpeed: state.forkAngularSpeed,
        axis: Z_AXIS.clone(),
        position: forkPivot.clone(),
      },
      guidedValveRod: {
        axis: Y_AXIS.clone(),
        connectingRodLength: state.valveConnectingRodLength,
        guideError: state.valveHorizontalGuideError,
        outputPoint: state.outputPoint.clone(),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  const model = finish(root, update, new THREE.Vector3(6.7, 4.7, 13.8));
  for (const object of [
    cameraEnvelope,
    lowerContactMarker,
    upperContactMarker,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
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

function sevenArcVariableMotionPointFollower() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.48;
  const sourcePoseAngle = 0;
  const inputAngularSpeed = -0.5;
  const cyclePeriod = fullTurn / Math.abs(inputAngularSpeed);
  const shaftCenter = new THREE.Vector3(0, -0.45, 0);
  const contactPlaneZ = 0.3;
  const sourceCarrierRadius = 5;
  const sourceOuterHubRadius = 1.25;
  const sourceInnerHubRadius = 0.7;
  const sourceFollowerLength = 12.315893;
  const sourceLowerGuideCenterY = 8.044628;
  const sourceUpperGuideCenterY = 13.044628;
  const sourceGuideWidth = 3;
  const sourceGuideHeight = 1;
  const sourceGuideBoltX = 1.05;
  const carrierRadius = sourceCarrierRadius * sourceScale;
  const outerHubRadius = sourceOuterHubRadius * sourceScale;
  const innerHubRadius = sourceInnerHubRadius * sourceScale;
  const followerLength = sourceFollowerLength * sourceScale;
  const followerRodRadius = 0.105;
  const followerTipHalfWidth = 0.5 * sourceScale;
  const followerTipHeight = 0.25 * sourceScale;
  const lowerGuideCenterY = shaftCenter.y
    + sourceLowerGuideCenterY * sourceScale;
  const upperGuideCenterY = shaftCenter.y
    + sourceUpperGuideCenterY * sourceScale;
  const guideWidth = sourceGuideWidth * sourceScale;
  const guideHeight = sourceGuideHeight * sourceScale;
  const guideBoltX = sourceGuideBoltX * sourceScale;
  const followerMass = 1;
  const gravityAcceleration = 9.81;

  // Seven circular arcs measured in the public-domain plate reproduce the
  // asymmetric working edge. The segment count and working order are also
  // confirmed by the source site's animation model; all kinematics below are
  // independently solved from ray/circle intersections.
  const sourceProfileArcs = [
    {
      center: new THREE.Vector2(-0.759858, 2.259817),
      endAngle: 4.622438,
      index: 1,
      name: 'left-point-to-lower-left-arc',
      radius: 4.572146,
      startAngle: 3.538899,
    },
    {
      center: new THREE.Vector2(1.236887, -0.873655),
      endAngle: 4.663261,
      index: 2,
      name: 'lower-left-to-bottom-arc',
      radius: 2.795139,
      startAngle: 3.674561,
    },
    {
      center: new THREE.Vector2(-0.614011, -1.478927),
      endAngle: 6.270753,
      index: 3,
      name: 'bottom-to-lower-right-arc',
      radius: 2.778004,
      startAngle: 5.377134,
    },
    {
      center: new THREE.Vector2(-0.388645, 2.613434),
      endAngle: 6.121049,
      index: 4,
      name: 'lower-right-to-outer-right-arc',
      radius: 4.852437,
      startAngle: 5.266289,
    },
    {
      center: new THREE.Vector2(0.385633, 3.803912),
      endAngle: 5.143462,
      index: 5,
      name: 'upper-concave-dwell-arc',
      radius: 1.617515,
      startAngle: 4.411102,
    },
    {
      center: new THREE.Vector2(-1.36918, -1.843174),
      endAngle: 2.567263,
      index: 6,
      name: 'upper-left-to-left-point-arc',
      radius: 4.295939,
      startAngle: 1.26951,
    },
    {
      center: new THREE.Vector2(2.346821, -0.460279),
      endAngle: 2.001869,
      index: 7,
      name: 'outer-right-to-upper-right-arc',
      radius: 3.076053,
      startAngle: 0.839921,
    },
  ];
  const profileArcs = sourceProfileArcs.map((arc) => ({
    ...arc,
    center: arc.center.clone().multiplyScalar(sourceScale),
    radius: arc.radius * sourceScale,
  }));
  const profileTraversal = [
    { arcIndex: 0, reverse: false },
    { arcIndex: 1, reverse: false },
    { arcIndex: 2, reverse: false },
    { arcIndex: 3, reverse: false },
    { arcIndex: 6, reverse: false },
    { arcIndex: 4, reverse: true },
    { arcIndex: 5, reverse: false },
  ];
  const rawPointOnProfileArc = (arc, angle) => new THREE.Vector2(
    arc.center.x + arc.radius * Math.cos(angle),
    arc.center.y + arc.radius * Math.sin(angle),
  );
  const unadjustedProfileArcs = profileArcs.map((arc) => ({
    ...arc,
    center: arc.center.clone(),
  }));
  const circumcircleThrough = (first, second, third) => {
    const denominator = 2 * (
      first.x * (second.y - third.y)
      + second.x * (third.y - first.y)
      + third.x * (first.y - second.y)
    );
    const firstLength = first.lengthSq();
    const secondLength = second.lengthSq();
    const thirdLength = third.lengthSq();
    const center = new THREE.Vector2(
      (
        firstLength * (second.y - third.y)
        + secondLength * (third.y - first.y)
        + thirdLength * (first.y - second.y)
      ) / denominator,
      (
        firstLength * (third.x - second.x)
        + secondLength * (first.x - third.x)
        + thirdLength * (second.x - first.x)
      ) / denominator,
    );
    return { center, radius: center.distanceTo(first) };
  };
  const correctedJoinPoints = [];
  for (let index = 0; index < profileTraversal.length; index += 1) {
    const currentTraversal = profileTraversal[index];
    const nextTraversal = profileTraversal[
      (index + 1) % profileTraversal.length
    ];
    const currentArc = unadjustedProfileArcs[currentTraversal.arcIndex];
    const nextArc = unadjustedProfileArcs[nextTraversal.arcIndex];
    const currentAngleKey = currentTraversal.reverse
      ? 'startAngle'
      : 'endAngle';
    const nextAngleKey = nextTraversal.reverse
      ? 'endAngle'
      : 'startAngle';
    const joinPoint = rawPointOnProfileArc(
      currentArc,
      currentArc[currentAngleKey],
    ).add(rawPointOnProfileArc(
      nextArc,
      nextArc[nextAngleKey],
    )).multiplyScalar(0.5);
    correctedJoinPoints.push(joinPoint);
  }
  for (let index = 0; index < profileTraversal.length; index += 1) {
    const traversal = profileTraversal[index];
    const unadjustedArc = unadjustedProfileArcs[traversal.arcIndex];
    const correctedArc = profileArcs[traversal.arcIndex];
    const startPoint = correctedJoinPoints[
      (index + profileTraversal.length - 1) % profileTraversal.length
    ];
    const endPoint = correctedJoinPoints[index];
    const middlePoint = rawPointOnProfileArc(
      unadjustedArc,
      (unadjustedArc.startAngle + unadjustedArc.endAngle) / 2,
    );
    const fittedCircle = circumcircleThrough(
      startPoint,
      middlePoint,
      endPoint,
    );
    correctedArc.center.copy(fittedCircle.center);
    correctedArc.radius = fittedCircle.radius;
    const startAngle = THREE.MathUtils.euclideanModulo(
      Math.atan2(
        startPoint.y - correctedArc.center.y,
        startPoint.x - correctedArc.center.x,
      ),
      fullTurn,
    );
    const endAngle = THREE.MathUtils.euclideanModulo(
      Math.atan2(
        endPoint.y - correctedArc.center.y,
        endPoint.x - correctedArc.center.x,
      ),
      fullTurn,
    );
    if (traversal.reverse) {
      correctedArc.endAngle = startAngle;
      correctedArc.startAngle = endAngle;
    } else {
      correctedArc.startAngle = startAngle;
      correctedArc.endAngle = endAngle;
    }
  }
  const positiveModulo = (value, modulus) => {
    const remainder = value % modulus;
    if (remainder === 0) return 0;
    return remainder < 0 ? remainder + modulus : remainder;
  };
  const rotateVector = (vector, angle) => new THREE.Vector2(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  );
  const pointOnArc = (arc, angle) => new THREE.Vector2(
    arc.center.x + arc.radius * Math.cos(angle),
    arc.center.y + arc.radius * Math.sin(angle),
  );
  const sourcePointOnArc = (arc, angle) => new THREE.Vector2(
    arc.center.x + arc.radius * Math.cos(angle),
    arc.center.y + arc.radius * Math.sin(angle),
  );
  const angleWithinArc = (angle, arc, tolerance = 1e-8) => {
    const normalizedAngle = positiveModulo(angle, fullTurn);
    const normalizedStart = positiveModulo(arc.startAngle, fullTurn);
    const normalizedEnd = positiveModulo(arc.endAngle, fullTurn);
    if (normalizedStart <= normalizedEnd) {
      return normalizedAngle >= normalizedStart - tolerance
        && normalizedAngle <= normalizedEnd + tolerance;
    }
    return normalizedAngle >= normalizedStart - tolerance
      || normalizedAngle <= normalizedEnd + tolerance;
  };
  const transitionSpecs = [
    {
      incomingArcIndex: 6,
      name: 'outer-right-corner',
      point: pointOnArc(profileArcs[3], profileArcs[3].endAngle),
    },
    {
      incomingArcIndex: 4,
      name: 'upper-right-corner',
      point: pointOnArc(profileArcs[6], profileArcs[6].endAngle),
    },
    {
      incomingArcIndex: 5,
      name: 'upper-left-corner',
      point: pointOnArc(profileArcs[4], profileArcs[4].startAngle),
    },
    {
      incomingArcIndex: 0,
      name: 'outer-left-point',
      point: pointOnArc(profileArcs[5], profileArcs[5].endAngle),
    },
    {
      incomingArcIndex: 1,
      name: 'lower-left-corner',
      point: pointOnArc(profileArcs[0], profileArcs[0].endAngle),
    },
    {
      incomingArcIndex: 2,
      name: 'bottom-corner',
      point: pointOnArc(profileArcs[1], profileArcs[1].endAngle),
    },
    {
      incomingArcIndex: 3,
      name: 'lower-right-corner',
      point: pointOnArc(profileArcs[2], profileArcs[2].endAngle),
    },
  ].map((transition) => ({
    ...transition,
    angle: positiveModulo(
      Math.atan2(transition.point.y, transition.point.x),
      fullTurn,
    ),
  })).sort((left, right) => left.angle - right.angle);

  let maximumArcJoinError = 0;
  let maximumCorrectedArcJoinError = 0;
  for (let index = 0; index < profileTraversal.length; index += 1) {
    const currentTraversal = profileTraversal[index];
    const nextTraversal = profileTraversal[
      (index + 1) % profileTraversal.length
    ];
    const currentArc = sourceProfileArcs[currentTraversal.arcIndex];
    const nextArc = sourceProfileArcs[nextTraversal.arcIndex];
    const currentEnd = sourcePointOnArc(
      currentArc,
      currentTraversal.reverse
        ? currentArc.startAngle
        : currentArc.endAngle,
    );
    const nextStart = sourcePointOnArc(
      nextArc,
      nextTraversal.reverse
        ? nextArc.endAngle
        : nextArc.startAngle,
    );
    maximumArcJoinError = Math.max(
      maximumArcJoinError,
      currentEnd.distanceTo(nextStart) * sourceScale,
    );
    const correctedCurrentArc = profileArcs[currentTraversal.arcIndex];
    const correctedNextArc = profileArcs[nextTraversal.arcIndex];
    const correctedCurrentEnd = pointOnArc(
      correctedCurrentArc,
      currentTraversal.reverse
        ? correctedCurrentArc.startAngle
        : correctedCurrentArc.endAngle,
    );
    const correctedNextStart = pointOnArc(
      correctedNextArc,
      nextTraversal.reverse
        ? correctedNextArc.endAngle
        : correctedNextArc.startAngle,
    );
    maximumCorrectedArcJoinError = Math.max(
      maximumCorrectedArcJoinError,
      correctedCurrentEnd.distanceTo(correctedNextStart),
    );
  }

  const activeArcIndexAtAngle = (localRayAngle) => {
    const angle = positiveModulo(localRayAngle, fullTurn);
    let activeArcIndex = 3;
    for (const transition of transitionSpecs) {
      if (angle + 1e-12 < transition.angle) break;
      activeArcIndex = transition.incomingArcIndex;
    }
    return activeArcIndex;
  };
  const rayIntersectionsForArc = (localRayAngle, arc) => {
    const direction = new THREE.Vector2(
      Math.cos(localRayAngle),
      Math.sin(localRayAngle),
    );
    const centerProjection = arc.center.dot(direction);
    const discriminant = arc.radius ** 2 - arc.center.lengthSq()
      + centerProjection ** 2;
    if (discriminant < -1e-12) return [];
    const rootOffset = Math.sqrt(Math.max(0, discriminant));
    const roots = [
      centerProjection - rootOffset,
      centerProjection + rootOffset,
    ];
    const intersections = [];
    for (const radius of roots) {
      if (radius <= 0) continue;
      const point = direction.clone().multiplyScalar(radius);
      const circleAngle = Math.atan2(
        point.y - arc.center.y,
        point.x - arc.center.x,
      );
      if (!angleWithinArc(circleAngle, arc)) continue;
      intersections.push({
        arc,
        circleAngle,
        point,
        radius,
      });
    }
    return intersections;
  };
  const profileAtLocalRay = (localRayAngle) => {
    const normalizedAngle = positiveModulo(localRayAngle, fullTurn);
    const activeArcIndex = activeArcIndexAtAngle(normalizedAngle);
    const allIntersections = profileArcs.flatMap((arc) => (
      rayIntersectionsForArc(normalizedAngle, arc)
    ));
    const selectedCandidates = allIntersections.filter(
      ({ arc }) => arc.index - 1 === activeArcIndex,
    );
    const selected = (selectedCandidates.length
      ? selectedCandidates
      : allIntersections
    ).reduce((best, candidate) => (
      best === null || candidate.radius > best.radius ? candidate : best
    ), null);
    if (!selected) throw new Error('seven-arc cam ray misses its profile');
    const direction = new THREE.Vector2(
      Math.cos(normalizedAngle),
      Math.sin(normalizedAngle),
    );
    const angularDirection = new THREE.Vector2(
      -Math.sin(normalizedAngle),
      Math.cos(normalizedAngle),
    );
    const centerProjection = selected.arc.center.dot(direction);
    const centerProjectionDerivative = selected.arc.center.dot(
      angularDirection,
    );
    const denominator = selected.radius - centerProjection;
    const radiusDerivative = centerProjectionDerivative
      * selected.radius / denominator;
    const radiusSecondDerivative = (
      -centerProjection * selected.radius
      + 2 * centerProjectionDerivative * radiusDerivative
      - radiusDerivative ** 2
    ) / denominator;
    const tangent = new THREE.Vector2(
      radiusDerivative * direction.x - selected.radius * direction.y,
      radiusDerivative * direction.y + selected.radius * direction.x,
    ).normalize();
    const outwardNormal = new THREE.Vector2(tangent.y, -tangent.x);
    let nearestCorner = null;
    let nearestCornerDistance = Infinity;
    for (const transition of transitionSpecs) {
      const distance = Math.abs(Math.atan2(
        Math.sin(normalizedAngle - transition.angle),
        Math.cos(normalizedAngle - transition.angle),
      ));
      if (distance < nearestCornerDistance) {
        nearestCorner = transition;
        nearestCornerDistance = distance;
      }
    }
    return {
      activeArc: selected.arc,
      activeArcIndex,
      activeArcName: selected.arc.name,
      atProfileCorner: nearestCornerDistance < 1e-10,
      circleEquationError: Math.abs(
        selected.point.distanceTo(selected.arc.center)
          - selected.arc.radius
      ),
      intersectionCount: allIntersections.length,
      localPoint: selected.point,
      localRayAngle: normalizedAngle,
      nearestCorner,
      nearestCornerDistance,
      outwardNormal,
      radius: selected.radius,
      radiusDerivative,
      radiusSecondDerivative,
      tangent,
    };
  };

  const extremumAngles = [...transitionSpecs.map(({ angle }) => angle)];
  for (const arc of profileArcs) {
    const centerAngle = Math.atan2(arc.center.y, arc.center.x);
    for (const candidate of [centerAngle, centerAngle + Math.PI]) {
      const angle = positiveModulo(candidate, fullTurn);
      if (activeArcIndexAtAngle(angle) === arc.index - 1) {
        extremumAngles.push(angle);
      }
    }
  }
  let outputMinimumRadius = Infinity;
  let outputMaximumRadius = -Infinity;
  let outputMinimumLocalRayAngle = 0;
  let outputMaximumLocalRayAngle = 0;
  for (const angle of extremumAngles) {
    const profile = profileAtLocalRay(angle);
    if (profile.radius < outputMinimumRadius) {
      outputMinimumRadius = profile.radius;
      outputMinimumLocalRayAngle = angle;
    }
    if (profile.radius > outputMaximumRadius) {
      outputMaximumRadius = profile.radius;
      outputMaximumLocalRayAngle = angle;
    }
  }
  const outputStroke = outputMaximumRadius - outputMinimumRadius;
  const minimumOutputCyclePhase = positiveModulo(
    outputMinimumLocalRayAngle - Math.PI / 2,
    fullTurn,
  ) / fullTurn;
  const maximumOutputCyclePhase = positiveModulo(
    outputMaximumLocalRayAngle - Math.PI / 2,
    fullTurn,
  ) / fullTurn;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.61,
  });
  const camMaterial = matte(0xc84e38, {
    metalness: 0.17,
    roughness: 0.56,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.5,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const witnessMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const camShape = new THREE.Shape();
  const firstTraversal = profileTraversal[0];
  const firstArc = profileArcs[firstTraversal.arcIndex];
  const firstAngle = firstTraversal.reverse
    ? firstArc.endAngle
    : firstArc.startAngle;
  const firstPoint = pointOnArc(firstArc, firstAngle);
  camShape.moveTo(firstPoint.x, firstPoint.y);
  for (const traversal of profileTraversal) {
    const arc = profileArcs[traversal.arcIndex];
    camShape.absarc(
      arc.center.x,
      arc.center.y,
      arc.radius,
      traversal.reverse ? arc.endAngle : arc.startAngle,
      traversal.reverse ? arc.startAngle : arc.endAngle,
      traversal.reverse,
    );
  }
  camShape.closePath();

  const input = planarRotor();
  input.position.set(shaftCenter.x, shaftCenter.y, 0);
  input.userData.role = 'uniform-shaft-with-seven-arc-face-cam-carrier';
  const inputRotor = input.userData.rotor;

  const carrierDisk = cylinderAlongZ(
    carrierRadius,
    0.26,
    driverMaterial,
    96,
  );
  carrierDisk.position.z = -0.17;
  carrierDisk.userData.role = 'circular-carrier-behind-variable-motion-cam';
  inputRotor.add(carrierDisk);

  const camPlate = new THREE.Mesh(
    centeredExtrusion(camShape, 0.34, 0.008),
    camMaterial,
  );
  camPlate.position.z = 0.09;
  camPlate.userData.role = 'seven-circular-arc-variable-motion-cam-profile';
  camPlate.userData.profileArcCount = profileArcs.length;
  inputRotor.add(camPlate);

  const outerHub = cylinderAlongZ(
    outerHubRadius,
    0.48,
    driverMaterial,
    48,
  );
  outerHub.position.z = 0.13;
  outerHub.userData.role = 'outer-hub-fast-on-cam-carrier';
  const innerHub = cylinderAlongZ(
    innerHubRadius,
    0.59,
    darkMaterial,
    40,
  );
  innerHub.position.z = 0.16;
  innerHub.userData.role = 'keyed-inner-hub-on-true-cam-axis';
  inputRotor.add(outerHub, innerHub);

  const inputShaft = cylinderAlongZ(0.17, 1.55, darkMaterial, 32);
  inputShaft.userData.role = 'input-shaft-through-seven-arc-cam';
  const shaftKey = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.22, 0.055),
    driverMaterial,
  );
  shaftKey.position.set(0.12, -0.08, 0.81);
  shaftKey.rotation.z = -Math.PI / 4;
  shaftKey.userData.role = 'visible-key-locking-cam-to-input-shaft';
  const camRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(outerHubRadius * 0.7, 0.065, 0.04),
    witnessMaterial,
  );
  camRotationIndex.position.set(
    outerHubRadius * 0.47,
    0,
    0.46,
  );
  camRotationIndex.userData.role = 'rotation-index-on-uniform-cam-driver';
  inputRotor.add(inputShaft, shaftKey, camRotationIndex);

  const follower = new THREE.Group();
  follower.userData.role = 'gravity-held-vertical-point-follower-and-rod';
  follower.userData.axis = Y_AXIS.clone();
  const followerTipShape = new THREE.Shape();
  followerTipShape.moveTo(-followerTipHalfWidth, followerTipHeight);
  followerTipShape.lineTo(0, 0);
  followerTipShape.lineTo(followerTipHalfWidth, followerTipHeight);
  followerTipShape.closePath();
  const followerTip = new THREE.Mesh(
    centeredExtrusion(followerTipShape, 0.34, 0.008),
    drivenMaterial,
  );
  followerTip.position.z = contactPlaneZ;
  followerTip.userData.role = 'sharp-point-resting-directly-on-cam-edge';
  const followerRod = new THREE.Mesh(
    new THREE.CylinderGeometry(
      followerRodRadius,
      followerRodRadius,
      followerLength - followerTipHeight,
      28,
    ),
    drivenMaterial,
  );
  followerRod.position.set(
    0,
    followerTipHeight + (followerLength - followerTipHeight) / 2,
    contactPlaneZ,
  );
  followerRod.userData.role = 'one-piece-vertical-rod-above-point-follower';
  const followerIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.065, 0.04),
    witnessMaterial,
  );
  followerIndex.position.set(0, followerLength * 0.53, contactPlaneZ + 0.15);
  followerIndex.userData.role = 'translation-index-on-point-follower-rod';
  follower.add(followerTip, followerRod, followerIndex);

  const makeFixedGuide = (centerY, side) => {
    const guide = new THREE.Group();
    guide.position.set(shaftCenter.x, centerY, 0);
    guide.userData.role = `fixed-${side}-guide-block-for-vertical-rod`;
    guide.userData.side = side;
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(guideWidth, guideHeight, 0.3),
      frameMaterial,
    );
    bracket.position.z = -0.18;
    bracket.userData.role = `${side}-horizontal-guide-bracket`;
    const sleeve = annularSleeveAlongY({
      innerRadius: followerRodRadius + 0.024,
      length: guideHeight + 0.08,
      material: frameMaterial,
      outerRadius: 0.235,
    });
    sleeve.position.z = contactPlaneZ;
    sleeve.userData.role = `${side}-vertical-guide-bore-around-follower-rod`;
    const bolts = [-1, 1].map((signX) => {
      const bolt = cylinderAlongZ(0.075, 0.42, darkMaterial, 8);
      bolt.position.set(signX * guideBoltX, 0, 0.02);
      bolt.userData.role = `${side}-guide-bracket-bolt`;
      return bolt;
    });
    guide.add(bracket, sleeve, ...bolts);
    return { bolts, bracket, guide, sleeve };
  };
  const lowerGuideAssembly = makeFixedGuide(lowerGuideCenterY, 'lower');
  const upperGuideAssembly = makeFixedGuide(upperGuideCenterY, 'upper');

  const baseY = shaftCenter.y - carrierRadius - 0.42;
  const supportX = carrierRadius + 0.95;
  const supportZ = -0.58;
  const baseRail = makeBeam(
    new THREE.Vector3(-carrierRadius - 0.65, baseY, supportZ),
    new THREE.Vector3(supportX + 0.45, baseY, supportZ),
    { thickness: 0.18, depth: 0.28, color: PALETTE.frame },
  );
  baseRail.userData.role = 'fixed-base-of-seven-arc-cam-and-guides';
  const supportPost = makeBeam(
    new THREE.Vector3(supportX, baseY, supportZ),
    new THREE.Vector3(supportX, upperGuideCenterY + 0.45, supportZ),
    { thickness: 0.17, depth: 0.24, color: PALETTE.frame },
  );
  supportPost.userData.role = 'fixed-rear-post-supporting-cam-and-guides';
  const shaftBearingArm = makeBeam(
    new THREE.Vector3(supportX, shaftCenter.y, supportZ),
    new THREE.Vector3(shaftCenter.x + 0.3, shaftCenter.y, -0.43),
    { thickness: 0.14, depth: 0.2, color: PALETTE.frame },
  );
  shaftBearingArm.userData.role = 'fixed-arm-to-seven-arc-cam-bearing';
  const lowerGuideArm = makeBeam(
    new THREE.Vector3(supportX, lowerGuideCenterY, supportZ),
    new THREE.Vector3(guideWidth / 2, lowerGuideCenterY, -0.2),
    { thickness: 0.12, depth: 0.18, color: PALETTE.frame },
  );
  lowerGuideArm.userData.role = 'fixed-arm-supporting-lower-rod-guide';
  const upperGuideArm = makeBeam(
    new THREE.Vector3(supportX, upperGuideCenterY, supportZ),
    new THREE.Vector3(guideWidth / 2, upperGuideCenterY, -0.2),
    { thickness: 0.12, depth: 0.18, color: PALETTE.frame },
  );
  upperGuideArm.userData.role = 'fixed-arm-supporting-upper-rod-guide';
  const shaftBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.29, 0.07, 9, 40),
    frameMaterial,
  );
  shaftBearing.position.set(shaftCenter.x, shaftCenter.y, -0.43);
  shaftBearing.userData.role = 'fixed-bearing-of-seven-arc-cam-shaft';

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 12),
    witnessMaterial,
  );
  contactMarker.userData.role = 'continuous-point-follower-contact-witness';

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.6, 11.55, 2.1),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0.35, 2.3, -0.25);
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-full-stroke-seven-arc-cam-envelope';

  root.add(
    cameraEnvelope,
    baseRail,
    supportPost,
    shaftBearingArm,
    lowerGuideArm,
    upperGuideArm,
    shaftBearing,
    lowerGuideAssembly.guide,
    upperGuideAssembly.guide,
    input,
    follower,
    contactMarker,
  );

  const stateAtTime = (time) => {
    const driverAngle = sourcePoseAngle + inputAngularSpeed * time;
    const localRayAngle = positiveModulo(
      Math.PI / 2 - driverAngle,
      fullTurn,
    );
    const profile = profileAtLocalRay(localRayAngle);
    const localContactPoint = profile.localPoint;
    const rotatedContactPoint = rotateVector(localContactPoint, driverAngle);
    const contactPoint = new THREE.Vector3(
      shaftCenter.x + rotatedContactPoint.x,
      shaftCenter.y + rotatedContactPoint.y,
      contactPlaneZ,
    );
    const outputY = shaftCenter.y + profile.radius;
    const localRayAngularSpeed = -inputAngularSpeed;
    const outputVelocityY = profile.radiusDerivative
      * localRayAngularSpeed;
    const outputAccelerationY = profile.radiusSecondDerivative
      * localRayAngularSpeed ** 2;
    const worldTangent2 = rotateVector(profile.tangent, driverAngle);
    const worldNormal2 = rotateVector(profile.outwardNormal, driverAngle);
    const tangent = new THREE.Vector3(
      worldTangent2.x,
      worldTangent2.y,
      0,
    );
    const normal = new THREE.Vector3(
      worldNormal2.x,
      worldNormal2.y,
      0,
    );
    const camRadiusVector = contactPoint.clone().sub(new THREE.Vector3(
      shaftCenter.x,
      shaftCenter.y,
      contactPlaneZ,
    ));
    const camMaterialVelocity = new THREE.Vector3(
      -inputAngularSpeed * camRadiusVector.y,
      inputAngularSpeed * camRadiusVector.x,
      0,
    );
    const followerMaterialVelocity = new THREE.Vector3(
      0,
      outputVelocityY,
      0,
    );
    const relativeContactVelocity = followerMaterialVelocity.clone()
      .sub(camMaterialVelocity);
    const normalForce = followerMass * (
      gravityAcceleration + outputAccelerationY
    ) / normal.y;
    const normalizedDriverAngle = positiveModulo(driverAngle, fullTurn);
    const cyclePhase = positiveModulo(
      localRayAngle - Math.PI / 2,
      fullTurn,
    ) / fullTurn;
    return {
      camAngularAcceleration: 0,
      camMaterialVelocity,
      completedCycles: time / cyclePeriod,
      contactGap: contactPoint.distanceTo(new THREE.Vector3(
        shaftCenter.x,
        outputY,
        contactPlaneZ,
      )),
      contactPoint,
      cyclePhase,
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      followerAngularSpeed: 0,
      followerMaterialVelocity,
      followerPosition: new THREE.Vector3(
        shaftCenter.x,
        outputY,
        0,
      ),
      gravityForce: followerMass * gravityAcceleration,
      guideReactionX: -normalForce * normal.x,
      inputRevolutions: (
        driverAngle - sourcePoseAngle
      ) / fullTurn,
      localRayAngularSpeed,
      maintainsContact: normalForce > 0 && normal.y > 0,
      normal,
      normalForce,
      normalVelocityError: relativeContactVelocity.dot(normal),
      normalizedDriverAngle,
      outputAcceleration: new THREE.Vector3(0, outputAccelerationY, 0),
      outputDisplacement: profile.radius - outputMinimumRadius,
      outputVelocity: followerMaterialVelocity.clone(),
      pressureAngle: Math.acos(THREE.MathUtils.clamp(normal.y, -1, 1)),
      profile,
      relativeContactVelocity,
      slidingSpeed: relativeContactVelocity.dot(tangent),
      stage: profile.atProfileCorner
        ? `sharp-profile-transition-${profile.nearestCorner.name}`
        : Math.abs(outputVelocityY) < 1e-10
          ? 'point-follower-at-stroke-reversal'
          : outputVelocityY > 0
            ? 'point-follower-rises'
            : 'point-follower-falls',
      tangent,
    };
  };

  root.userData.mechanism = (
    'seven-arc-variable-motion-plate-cam-gravity-point-follower'
  );
  root.userData.cameraDistanceScale = 1.04;
  root.userData.blocks = {
    baseRail,
    camPlate,
    cameraEnvelope,
    camRotationIndex,
    carrierDisk,
    contactMarker,
    follower,
    followerIndex,
    followerRod,
    followerTip,
    innerHub,
    input,
    inputRotor,
    inputShaft,
    lowerGuide: lowerGuideAssembly.guide,
    lowerGuideArm,
    lowerGuideBolts: lowerGuideAssembly.bolts,
    lowerGuideBracket: lowerGuideAssembly.bracket,
    lowerGuideSleeve: lowerGuideAssembly.sleeve,
    outerHub,
    shaftBearing,
    shaftBearingArm,
    shaftKey,
    supportPost,
    upperGuide: upperGuideAssembly.guide,
    upperGuideArm,
    upperGuideBolts: upperGuideAssembly.bolts,
    upperGuideBracket: upperGuideAssembly.bracket,
    upperGuideSleeve: upperGuideAssembly.sleeve,
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    carrierRadius,
    contactPlaneZ,
    cyclePeriod,
    extremumAngles: [...extremumAngles],
    followerLength,
    followerMass,
    followerRodRadius,
    followerTipHalfWidth,
    followerTipHeight,
    fullTurn,
    gravityAcceleration,
    guideBoltX,
    guideHeight,
    guideWidth,
    inputAngularSpeed,
    innerHubRadius,
    lowerGuideCenterY,
    maximumArcJoinError,
    maximumCorrectedArcJoinError,
    maximumOutputCyclePhase,
    minimumOutputCyclePhase,
    outerHubRadius,
    outputMaximumRadius,
    outputMaximumLocalRayAngle,
    outputMinimumRadius,
    outputMinimumLocalRayAngle,
    outputStroke,
    profileArcCount: profileArcs.length,
    profileArcs: profileArcs.map((arc) => ({
      ...arc,
      center: arc.center.clone(),
    })),
    profileTransitions: transitionSpecs.map((transition) => ({
      ...transition,
      point: transition.point.clone(),
    })),
    profileTraversal: profileTraversal.map((entry) => ({ ...entry })),
    shaftCenter: shaftCenter.clone(),
    sourceCarrierRadius,
    sourceFollowerLength,
    sourceGuideBoltX,
    sourceGuideHeight,
    sourceGuideWidth,
    sourceInnerHubRadius,
    sourceLowerGuideCenterY,
    sourceOuterHubRadius,
    sourcePoseAngle,
    sourceProfileArcs: sourceProfileArcs.map((arc) => ({
      ...arc,
      center: arc.center.clone(),
    })),
    sourceScale,
    sourceUpperGuideCenterY,
    upperGuideCenterY,
  };
  root.userData.profileAtLocalRay = profileAtLocalRay;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.set(0, 0, state.driverAngle);
    input.userData.angularSpeed = state.driverAngularSpeed;
    inputRotor.userData.angularSpeed = state.driverAngularSpeed;
    follower.position.copy(state.followerPosition);
    follower.rotation.set(0, 0, 0);
    follower.userData.velocity = state.outputVelocity.clone();
    follower.userData.acceleration = state.outputAcceleration.clone();
    contactMarker.position.copy(state.contactPoint);
    contactMarker.position.z = contactPlaneZ + 0.42;
    root.userData.contacts = {
      gravityReturn: {
        active: state.maintainsContact,
        followerMass,
        gravityForce: state.gravityForce,
        normalForce: state.normalForce,
      },
      pointCamFollower: {
        camMaterialVelocity: state.camMaterialVelocity.clone(),
        camPoint: state.contactPoint.clone(),
        gap: state.contactGap,
        normal: state.normal.clone(),
        normalVelocityError: state.normalVelocityError,
        profileArc: state.profile.activeArcName,
        relativeVelocity: state.relativeContactVelocity.clone(),
        slidingSpeed: state.slidingSpeed,
        tangent: state.tangent.clone(),
      },
      verticalGuides: {
        axis: Y_AXIS.clone(),
        followerAngularSpeed: state.followerAngularSpeed,
        horizontalError: Math.abs(
          state.followerPosition.x - shaftCenter.x
        ),
        rotationError: Math.abs(follower.rotation.z),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  const model = finish(root, update, new THREE.Vector3(6.8, 4.9, 13.7));
  for (const object of [cameraEnvelope, contactMarker]) {
    object.castShadow = false;
    object.receiveShadow = false;
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

export function createAuthoredCamMovement(movement) {
  switch (movement.id) {
    case 89: return makeEccentricStrap();
    case 90: return eccentricSheaveElongatedTranslatingYoke();
    case 91: return triangularEccentricValveMotion();
    case 96: return heartCamUniformTraverseMotion();
    case 97: return groovedHeartCamPositiveTraverseMotion();
    case 99: return spiralGuideDrillFeedMotion();
    case 106: return cylindricalReversingGrooveCamMotion();
    case 107: return sixStrokeSerpentineGrooveCamMotion();
    case 128: return threeWiperReciprocatingFrame();
    case 130: return gravityOpenedEccentricPlateShears();
    case 135: return reuleauxCarrierDiskValveMotion();
    case 136: return toothedAxialFaceCamSpringFollower();
    case 137: return frenchExpansionEccentricValveFork();
    case 138: return sevenArcVariableMotionPointFollower();
    default: return null;
  }
}
