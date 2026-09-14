import {boredHorizontalPlate} from './bored-horizontal-plate.js';
import {slottedSectorToothProfiles} from './slotted-sector-teeth.js';
import * as THREE from 'three';
import {
  CircularArcCurve3,
  PALETTE,
  makeBeam,
  makeDynamicMovingBelt,
  makeDynamicLink,
  makePulley,
  markShadows,
  matte,
} from './primitives.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function finish(root, update, cameraDirection = new THREE.Vector3(7, 4, 9)) {
  root.userData.fidelity = 'authored';
  markShadows(root);
  root.traverse((object) => {
    if (!object.userData.cameraFitGuide) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });
  return { root, update, cameraDirection };
}

function centeredExtrusion(shape, depth, bevel = 0.01) {
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

function annularShape(innerRadius, outerRadius) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return shape;
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function cylinderAlongY(radius, length, material, segments = 32) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function horizontalCapsuleRingShape(
  innerRadius,
  outerRadius,
  straightHalfLength,
) {
  const shape = new THREE.Shape();
  shape.moveTo(-straightHalfLength, -outerRadius);
  shape.lineTo(straightHalfLength, -outerRadius);
  shape.absarc(
    straightHalfLength,
    0,
    outerRadius,
    -Math.PI / 2,
    Math.PI / 2,
    false,
  );
  shape.lineTo(-straightHalfLength, outerRadius);
  shape.absarc(
    -straightHalfLength,
    0,
    outerRadius,
    Math.PI / 2,
    Math.PI * 1.5,
    false,
  );
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(straightHalfLength, -innerRadius);
  hole.lineTo(-straightHalfLength, -innerRadius);
  hole.absarc(
    -straightHalfLength,
    0,
    innerRadius,
    -Math.PI / 2,
    Math.PI / 2,
    true,
  );
  hole.lineTo(straightHalfLength, innerRadius);
  hole.absarc(
    straightHalfLength,
    0,
    innerRadius,
    Math.PI / 2,
    -Math.PI / 2,
    true,
  );
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function horizontalCapsuleShape(radius, straightHalfLength) {
  const shape = new THREE.Shape();
  shape.moveTo(-straightHalfLength, -radius);
  shape.lineTo(straightHalfLength, -radius);
  shape.absarc(
    straightHalfLength,
    0,
    radius,
    -Math.PI / 2,
    Math.PI / 2,
    false,
  );
  shape.lineTo(-straightHalfLength, radius);
  shape.absarc(
    -straightHalfLength,
    0,
    radius,
    Math.PI / 2,
    Math.PI * 1.5,
    false,
  );
  shape.closePath();
  return shape;
}

function roundedRectangleRingShape(
  outerHalfWidth,
  outerHalfHeight,
  outerRadius,
  innerHalfWidth,
  innerHalfHeight,
  innerRadius,
  innerCenterY = 0,
) {
  const shape = new THREE.Shape();
  shape.moveTo(-outerHalfWidth + outerRadius, -outerHalfHeight);
  shape.lineTo(outerHalfWidth - outerRadius, -outerHalfHeight);
  shape.quadraticCurveTo(
    outerHalfWidth,
    -outerHalfHeight,
    outerHalfWidth,
    -outerHalfHeight + outerRadius,
  );
  shape.lineTo(outerHalfWidth, outerHalfHeight - outerRadius);
  shape.quadraticCurveTo(
    outerHalfWidth,
    outerHalfHeight,
    outerHalfWidth - outerRadius,
    outerHalfHeight,
  );
  shape.lineTo(-outerHalfWidth + outerRadius, outerHalfHeight);
  shape.quadraticCurveTo(
    -outerHalfWidth,
    outerHalfHeight,
    -outerHalfWidth,
    outerHalfHeight - outerRadius,
  );
  shape.lineTo(-outerHalfWidth, -outerHalfHeight + outerRadius);
  shape.quadraticCurveTo(
    -outerHalfWidth,
    -outerHalfHeight,
    -outerHalfWidth + outerRadius,
    -outerHalfHeight,
  );
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(innerHalfWidth - innerRadius, innerCenterY - innerHalfHeight);
  hole.lineTo(-innerHalfWidth + innerRadius, innerCenterY - innerHalfHeight);
  hole.quadraticCurveTo(
    -innerHalfWidth,
    innerCenterY - innerHalfHeight,
    -innerHalfWidth,
    innerCenterY - innerHalfHeight + innerRadius,
  );
  hole.lineTo(-innerHalfWidth, innerCenterY + innerHalfHeight - innerRadius);
  hole.quadraticCurveTo(
    -innerHalfWidth,
    innerCenterY + innerHalfHeight,
    -innerHalfWidth + innerRadius,
    innerCenterY + innerHalfHeight,
  );
  hole.lineTo(innerHalfWidth - innerRadius, innerCenterY + innerHalfHeight);
  hole.quadraticCurveTo(
    innerHalfWidth,
    innerCenterY + innerHalfHeight,
    innerHalfWidth,
    innerCenterY + innerHalfHeight - innerRadius,
  );
  hole.lineTo(innerHalfWidth, innerCenterY - innerHalfHeight + innerRadius);
  hole.quadraticCurveTo(
    innerHalfWidth,
    innerCenterY - innerHalfHeight,
    innerHalfWidth - innerRadius,
    innerCenterY - innerHalfHeight,
  );
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function pathFromPoints(points, clockwise) {
  const ordered = points.map((point) => point.clone());
  if (THREE.ShapeUtils.isClockWise(ordered) !== clockwise) ordered.reverse();
  const path = new THREE.Path();
  path.moveTo(ordered[0].x, ordered[0].y);
  for (const point of ordered.slice(1)) path.lineTo(point.x, point.y);
  path.closePath();
  return path;
}

function horizontalCapsulePoints(straightHalfLength, radius, capSegments = 18) {
  const points = [new THREE.Vector2(-straightHalfLength, -radius)];
  points.push(new THREE.Vector2(straightHalfLength, -radius));
  for (let step = 1; step <= capSegments; step += 1) {
    const angle = -Math.PI / 2 + step / capSegments * Math.PI;
    points.push(new THREE.Vector2(
      straightHalfLength + radius * Math.cos(angle),
      radius * Math.sin(angle),
    ));
  }
  points.push(new THREE.Vector2(-straightHalfLength, radius));
  for (let step = 1; step <= capSegments; step += 1) {
    const angle = Math.PI / 2 + step / capSegments * Math.PI;
    points.push(new THREE.Vector2(
      -straightHalfLength + radius * Math.cos(angle),
      radius * Math.sin(angle),
    ));
  }
  return points;
}

function transformedPoints(points, angle, offset = new THREE.Vector2()) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return points.map((point) => new THREE.Vector2(
    offset.x + point.x * cosine - point.y * sine,
    offset.y + point.x * sine + point.y * cosine,
  ));
}

function spiralRibbonProfile({
  endRadius,
  halfWidth,
  startRadius,
  sweep,
  segments = 288,
}) {
  const pitch = (endRadius - startRadius) / sweep;
  const centerline = [];
  const inwardBoundary = [];
  const outwardBoundary = [];
  const tangents = [];
  const rightNormals = [];
  for (let segment = 0; segment <= segments; segment += 1) {
    const angle = segment / segments * sweep;
    const radius = startRadius + pitch * angle;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const tangent = new THREE.Vector2(
      pitch * cosine - radius * sine,
      pitch * sine + radius * cosine,
    ).normalize();
    const rightNormal = new THREE.Vector2(tangent.y, -tangent.x);
    const center = new THREE.Vector2(radius * cosine, radius * sine);
    centerline.push(center);
    tangents.push(tangent);
    rightNormals.push(rightNormal);
    outwardBoundary.push(center.clone().addScaledVector(rightNormal, halfWidth));
    inwardBoundary.push(center.clone().addScaledVector(rightNormal, -halfWidth));
  }

  const capSegments = 18;
  const polygon = outwardBoundary.map((point) => point.clone());
  const endCenter = centerline.at(-1);
  const endTangent = tangents.at(-1);
  const endNormal = rightNormals.at(-1);
  for (let step = 1; step <= capSegments; step += 1) {
    const angle = step / capSegments * Math.PI;
    polygon.push(
      endCenter.clone()
        .addScaledVector(endNormal, Math.cos(angle) * halfWidth)
        .addScaledVector(endTangent, Math.sin(angle) * halfWidth),
    );
  }
  for (let index = inwardBoundary.length - 2; index >= 0; index -= 1) {
    polygon.push(inwardBoundary[index].clone());
  }
  const startCenter = centerline[0];
  const startTangent = tangents[0];
  const startNormal = rightNormals[0];
  for (let step = 1; step <= capSegments; step += 1) {
    const angle = Math.PI + step / capSegments * Math.PI;
    polygon.push(
      startCenter.clone()
        .addScaledVector(startNormal, Math.cos(angle) * halfWidth)
        .addScaledVector(startTangent, Math.sin(angle) * halfWidth),
    );
  }
  return {
    centerline,
    inwardBoundary,
    outwardBoundary,
    pitch,
    polygon,
    sweep,
  };
}

function planarRotor() {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.userData.axis = Z_AXIS.clone();
  root.userData.rotor = rotor;
  return root;
}

function ordinaryCrankMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.4;
  const sourceFlywheelOuterRadius = 6;
  const sourceFlywheelInnerRadius = 5;
  const sourceHubRadius = 1;
  const sourceCrankRadius = 3.5;
  const sourceConnectingRodLength = 12.75;
  const sourceCrossheadWidth = 4;
  const sourceCrossheadHeight = 3.25;
  const sourceGuideMinimumX = 6.25;
  const sourceGuideMaximumX = 19;
  const sourceGuideInnerHalfHeight = 1.25;
  const sourceGuideOuterHalfHeight = 2;

  const flywheelOuterRadius = sourceFlywheelOuterRadius * sourceScale;
  const flywheelInnerRadius = sourceFlywheelInnerRadius * sourceScale;
  const hubRadius = sourceHubRadius * sourceScale;
  const crankRadius = sourceCrankRadius * sourceScale;
  const connectingRodLength = sourceConnectingRodLength * sourceScale;
  const crossheadWidth = sourceCrossheadWidth * sourceScale;
  const crossheadHeight = sourceCrossheadHeight * sourceScale;
  const guideMinimumOffset = sourceGuideMinimumX * sourceScale;
  const guideMaximumOffset = sourceGuideMaximumX * sourceScale;
  const guideInnerHalfHeight = sourceGuideInnerHalfHeight * sourceScale;
  const guideOuterHalfHeight = sourceGuideOuterHalfHeight * sourceScale;
  const guideRailThickness = guideOuterHalfHeight - guideInnerHalfHeight;
  const runningClearance = 0.04;
  const guideShoeHalfHeight = guideInnerHalfHeight - runningClearance;

  const inputSpeedMagnitude = 0.92;
  const inputAngularSpeed = -inputSpeedMagnitude;
  const cyclePeriod = fullTurn / inputSpeedMagnitude;
  const sourcePoseAngle = -Math.PI / 3;
  const shaftCenter = new THREE.Vector3(-3.2, 0.45, 0);
  const strokeLineY = shaftCenter.y;
  const outputMinimumX = shaftCenter.x
    + connectingRodLength - crankRadius;
  const outputMaximumX = shaftCenter.x
    + connectingRodLength + crankRadius;
  const outputMidpointX = shaftCenter.x + connectingRodLength;
  const outputStroke = outputMaximumX - outputMinimumX;
  const maximumRodAngle = Math.asin(crankRadius / connectingRodLength);

  const flywheelDepth = 0.44;
  const spokeDepth = 0.34;
  const rodDepth = 0.34;
  const rodPlaneZ = 0.62;
  const pinCenterZ = 0.39;
  const pinLength = 1.28;
  const crankPinRadius = 0.115;
  const wristPinRadius = 0.125;
  const pinBearingClearance = 0.018;
  const crankEyeInnerRadius = crankPinRadius + pinBearingClearance + 0.055;
  const crankEyeOuterRadius = 0.31;
  const wristEyeInnerRadius = wristPinRadius + pinBearingClearance + 0.057;
  const wristEyeOuterRadius = 0.34;
  const eyeLinerDepth = rodDepth + 0.035;
  const shaftRadius = 0.17;
  const shaftLength = 2.35;
  const crossheadFaceDepth = 0.34;
  const crossheadFaceZ = 0.3;
  const guideShoeDepth = 0.3;
  const guideShoeZ = -0.05;
  const guideRailDepth = 0.34;
  const guideRailZ = -0.12;

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
  const linerMaterial = matte(PALETTE.brass, {
    metalness: 0.25,
    roughness: 0.46,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const input = planarRotor();
  input.position.copy(shaftCenter);
  input.userData.role = 'continuous-crankshaft-and-source-proportioned-flywheel';
  const inputRotor = input.userData.rotor;

  const flywheelRim = new THREE.Mesh(
    centeredExtrusion(
      annularShape(flywheelInnerRadius, flywheelOuterRadius),
      flywheelDepth,
      0.008,
    ),
    driverMaterial,
  );
  flywheelRim.userData.role = 'six-to-five-radius-flywheel-rim';
  inputRotor.add(flywheelRim);

  const spokeLength = flywheelInnerRadius - hubRadius * 0.72;
  const spokeCenterRadius = hubRadius * 0.72 + spokeLength / 2;
  const flywheelSpokes = Array.from({ length: 6 }, (_, index) => {
    const spokeAngle = index / 6 * fullTurn;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(spokeLength, 0.18, spokeDepth),
      driverMaterial,
    );
    spoke.position.set(
      Math.cos(spokeAngle) * spokeCenterRadius,
      Math.sin(spokeAngle) * spokeCenterRadius,
      0,
    );
    spoke.rotation.z = spokeAngle;
    spoke.userData.role = 'radial-flywheel-spoke';
    spoke.userData.index = index;
    inputRotor.add(spoke);
    return spoke;
  });

  const rimEdges = [flywheelInnerRadius, flywheelOuterRadius].map((radius) => {
    const edge = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.035, 9, 84),
      darkMaterial,
    );
    edge.position.z = flywheelDepth / 2 + 0.018;
    edge.userData.role = 'front-outline-of-flywheel-rim';
    edge.userData.radius = radius;
    inputRotor.add(edge);
    return edge;
  });

  const shaftHub = cylinderAlongZ(
    hubRadius,
    flywheelDepth + 0.2,
    darkMaterial,
    48,
  );
  shaftHub.userData.role = 'flywheel-hub-at-fixed-shaft-center';
  inputRotor.add(shaftHub);

  const inputShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
  );
  inputShaft.userData.role = 'continuous-input-shaft-through-flywheel';
  inputRotor.add(inputShaft);

  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.18, 0.22),
    darkMaterial,
  );
  crankArm.position.set(crankRadius / 2, 0, 0.27);
  crankArm.userData.role = 'rigid-crank-arm-from-shaft-to-crank-pin';
  inputRotor.add(crankArm);

  const crankPin = cylinderAlongZ(
    crankPinRadius,
    pinLength,
    linerMaterial,
  );
  crankPin.position.set(crankRadius, 0, pinCenterZ);
  crankPin.userData.role = 'crank-pin-through-wheel-arm-and-rod-eye';
  inputRotor.add(crankPin);

  const flywheelFaceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.31, 0.035),
    indexMaterial,
  );
  flywheelFaceIndex.position.set(
    flywheelOuterRadius - 0.18,
    0,
    flywheelDepth / 2 + 0.055,
  );
  flywheelFaceIndex.userData.role = 'visible-rotation-index-on-flywheel-rim';
  inputRotor.add(flywheelFaceIndex);

  const connectingRod = new THREE.Group();
  connectingRod.userData.role = 'finite-length-connecting-rod-with-two-eyes';
  const rodShape = new THREE.Shape();
  rodShape.moveTo(0.2, -0.13);
  rodShape.lineTo(connectingRodLength - 0.24, -0.19);
  rodShape.lineTo(connectingRodLength - 0.24, 0.19);
  rodShape.lineTo(0.2, 0.13);
  rodShape.closePath();
  const rodBody = new THREE.Mesh(
    centeredExtrusion(rodShape, rodDepth, 0.009),
    drivenMaterial,
  );
  rodBody.userData.role = 'tapered-body-of-finite-connecting-rod';

  const crankRodEye = new THREE.Mesh(
    centeredExtrusion(
      annularShape(crankEyeInnerRadius, crankEyeOuterRadius),
      rodDepth,
      0.006,
    ),
    drivenMaterial,
  );
  crankRodEye.userData.role = 'connecting-rod-eye-at-crank-pin';
  const wristRodEye = new THREE.Mesh(
    centeredExtrusion(
      annularShape(wristEyeInnerRadius, wristEyeOuterRadius),
      rodDepth,
      0.006,
    ),
    drivenMaterial,
  );
  wristRodEye.position.x = connectingRodLength;
  wristRodEye.userData.role = 'connecting-rod-eye-at-crosshead-pin';

  const crankEyeLiner = new THREE.Mesh(
    centeredExtrusion(
      annularShape(
        crankPinRadius + pinBearingClearance,
        crankEyeInnerRadius,
      ),
      eyeLinerDepth,
      0.004,
    ),
    linerMaterial,
  );
  crankEyeLiner.userData.role = 'bearing-liner-in-crank-end-eye';
  const wristEyeLiner = new THREE.Mesh(
    centeredExtrusion(
      annularShape(
        wristPinRadius + pinBearingClearance,
        wristEyeInnerRadius,
      ),
      eyeLinerDepth,
      0.004,
    ),
    linerMaterial,
  );
  wristEyeLiner.position.x = connectingRodLength;
  wristEyeLiner.userData.role = 'bearing-liner-in-wrist-end-eye';
  connectingRod.add(
    rodBody,
    crankRodEye,
    wristRodEye,
    crankEyeLiner,
    wristEyeLiner,
  );

  const crosshead = new THREE.Group();
  crosshead.userData.role = 'nonrotating-line-constrained-crosshead';
  const crossheadFace = new THREE.Mesh(
    new THREE.BoxGeometry(
      crossheadWidth,
      crossheadHeight,
      crossheadFaceDepth,
    ),
    drivenMaterial,
  );
  crossheadFace.position.z = crossheadFaceZ;
  crossheadFace.userData.role = 'source-proportioned-front-crosshead-block';

  const guideShoe = new THREE.Mesh(
    new THREE.BoxGeometry(
      crossheadWidth * 0.72,
      guideShoeHalfHeight * 2,
      guideShoeDepth,
    ),
    drivenMaterial,
  );
  guideShoe.position.z = guideShoeZ;
  guideShoe.userData.role = 'rear-crosshead-shoe-captured-between-guides';

  const wristPin = cylinderAlongZ(
    wristPinRadius,
    pinLength,
    linerMaterial,
  );
  wristPin.position.z = pinCenterZ;
  wristPin.userData.role = 'wrist-pin-through-rod-eye-and-crosshead';

  const translationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, crossheadHeight * 0.46, 0.04),
    indexMaterial,
  );
  translationIndex.position.set(
    crossheadWidth * 0.3,
    0,
    crossheadFaceZ + crossheadFaceDepth / 2 + 0.04,
  );
  translationIndex.userData.role = 'visible-translation-index-on-crosshead';
  crosshead.add(crossheadFace, guideShoe, wristPin, translationIndex);

  const guideMinimumX = shaftCenter.x + guideMinimumOffset;
  const guideMaximumX = shaftCenter.x + guideMaximumOffset;
  const guideRailLength = guideMaximumX - guideMinimumX;
  const guideRails = [-1, 1].map((signY) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(
        guideRailLength,
        guideRailThickness,
        guideRailDepth,
      ),
      frameMaterial,
    );
    rail.position.set(
      (guideMinimumX + guideMaximumX) / 2,
      strokeLineY + signY
        * (guideInnerHalfHeight + guideRailThickness / 2),
      guideRailZ,
    );
    rail.userData.role = 'fixed-horizontal-crosshead-guide-rail';
    rail.userData.side = signY < 0 ? 'lower' : 'upper';
    return rail;
  });

  const baseY = shaftCenter.y - flywheelOuterRadius - 0.72;
  const baseZ = -0.78;
  const baseMinimumX = shaftCenter.x - flywheelOuterRadius - 0.48;
  const baseMaximumX = guideMaximumX + 0.38;
  const baseRail = makeBeam(
    new THREE.Vector3(baseMinimumX, baseY, baseZ),
    new THREE.Vector3(baseMaximumX, baseY, baseZ),
    { thickness: 0.17, depth: 0.26, color: PALETTE.frame },
  );
  baseRail.userData.role = 'fixed-base-of-ordinary-crank-motion';

  const rearBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.078, 10, 40),
    frameMaterial,
  );
  rearBearing.position.set(shaftCenter.x, shaftCenter.y, -0.82);
  rearBearing.userData.role = 'fixed-rear-bearing-of-crankshaft';
  const bearingSupports = [-1, 1].map((signX) => {
    const support = makeBeam(
      new THREE.Vector3(shaftCenter.x + signX * 1.1, baseY, baseZ),
      rearBearing.position,
      { thickness: 0.14, depth: 0.21, color: PALETTE.frame },
    );
    support.userData.role = 'rear-A-frame-support-of-crankshaft';
    return support;
  });

  const guideSupports = [guideMinimumX, guideMaximumX].flatMap((x) => (
    guideRails.map((rail) => {
      const support = makeBeam(
        new THREE.Vector3(x, baseY, baseZ),
        new THREE.Vector3(x, rail.position.y, guideRailZ),
        { thickness: 0.12, depth: 0.19, color: PALETTE.frame },
      );
      support.userData.role = 'fixed-support-of-crosshead-guide-rail';
      support.userData.end = x === guideMinimumX ? 'inner' : 'outer';
      support.userData.side = rail.userData.side;
      return support;
    })
  ));

  root.add(
    baseRail,
    ...bearingSupports,
    rearBearing,
    ...guideSupports,
    ...guideRails,
    input,
    connectingRod,
    crosshead,
  );

  const stateAtDriverAngle = (driverAngle) => {
    const cosine = Math.cos(driverAngle);
    const sine = Math.sin(driverAngle);
    const crankVertical = crankRadius * sine;
    const rodHorizontal = Math.sqrt(
      connectingRodLength ** 2 - crankVertical ** 2,
    );
    const crankX = shaftCenter.x + crankRadius * cosine;
    const crankY = shaftCenter.y + crankVertical;
    const sliderX = crankX + rodHorizontal;
    const crankPoint = new THREE.Vector3(crankX, crankY, rodPlaneZ);
    const wristPoint = new THREE.Vector3(sliderX, strokeLineY, rodPlaneZ);
    const crankPinAxisPoint = new THREE.Vector3(
      crankX,
      crankY,
      pinCenterZ,
    );
    const wristPinAxisPoint = new THREE.Vector3(
      sliderX,
      strokeLineY,
      pinCenterZ,
    );
    const rodAngle = Math.atan2(-crankVertical, rodHorizontal);
    const crankVerticalDerivative = crankRadius * cosine;
    const rodHorizontalDerivative = -crankVertical
      * crankVerticalDerivative / rodHorizontal;
    const displacementDerivative = -crankRadius * sine
      + rodHorizontalDerivative;
    const verticalDerivativeSecond = -crankRadius * sine;
    const derivativeProduct = crankVertical * crankVerticalDerivative;
    const derivativeProductDerivative = crankRadius ** 2
      * (cosine ** 2 - sine ** 2);
    const rodHorizontalSecondDerivative = -derivativeProductDerivative
      / rodHorizontal
      - derivativeProduct ** 2 / rodHorizontal ** 3;
    const displacementSecondDerivative = -crankRadius * cosine
      + rodHorizontalSecondDerivative;
    const outputVelocity = new THREE.Vector3(
      displacementDerivative * inputAngularSpeed,
      0,
      0,
    );
    const outputAcceleration = new THREE.Vector3(
      displacementSecondDerivative * inputAngularSpeed ** 2,
      0,
      0,
    );
    const crankVelocity = new THREE.Vector3(
      -crankRadius * sine * inputAngularSpeed,
      crankRadius * cosine * inputAngularSpeed,
      0,
    );
    const crankAcceleration = new THREE.Vector3(
      -crankRadius * cosine * inputAngularSpeed ** 2,
      -crankRadius * sine * inputAngularSpeed ** 2,
      0,
    );
    const rodAngularSpeed = -crankVerticalDerivative
      / rodHorizontal * inputAngularSpeed;
    const rodAngularAcceleration = (
      -verticalDerivativeSecond / rodHorizontal
      - crankVertical * crankVerticalDerivative ** 2
        / rodHorizontal ** 3
    ) * inputAngularSpeed ** 2;
    const normalizedDriverAngle = THREE.MathUtils.euclideanModulo(
      driverAngle,
      fullTurn,
    );
    const outerDeadCenter = Math.abs(Math.sin(normalizedDriverAngle)) < 1e-10
      && Math.cos(normalizedDriverAngle) > 0;
    const innerDeadCenter = Math.abs(Math.sin(normalizedDriverAngle)) < 1e-10
      && Math.cos(normalizedDriverAngle) < 0;
    const stage = outerDeadCenter
      ? 'outer-dead-center'
      : innerDeadCenter
        ? 'inner-dead-center'
        : outputVelocity.x > 0
          ? 'crosshead-outward-stroke'
          : 'crosshead-inward-stroke';
    return {
      crankAcceleration,
      crankPinAxisPoint,
      crankPoint,
      crankRadiusError: Math.abs(
        crankPoint.clone().setZ(0).distanceTo(
          shaftCenter.clone().setZ(0),
        ) - crankRadius,
      ),
      crankVelocity,
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      followerAngularSpeed: 0,
      guideShoeCenter: new THREE.Vector3(sliderX, strokeLineY, guideShoeZ),
      inputRevolutions: (driverAngle - sourcePoseAngle) / fullTurn,
      lowerGuideGap: runningClearance,
      normalizedDriverAngle,
      outputAcceleration,
      outputDisplacement: sliderX - outputMidpointX,
      outputVelocity,
      rodAngle,
      rodAngularAcceleration,
      rodAngularSpeed,
      rodCenter: crankPoint.clone().lerp(wristPoint, 0.5),
      rodHorizontal,
      rodLengthError: Math.abs(crankPoint.distanceTo(wristPoint)
        - connectingRodLength),
      sliderGuideError: Math.abs(wristPoint.y - strokeLineY),
      sliderPosition: new THREE.Vector3(sliderX, strokeLineY, 0),
      stage,
      upperGuideGap: runningClearance,
      wristPinAxisPoint,
      wristPoint,
    };
  };
  const stateAtTime = (time) => stateAtDriverAngle(
    sourcePoseAngle + inputAngularSpeed * time,
  );

  root.userData.mechanism = 'ordinary-finite-rod-crank-slider';
  root.userData.blocks = {
    baseRail,
    bearingSupports,
    connectingRod,
    crankArm,
    crankEyeLiner,
    crankPin,
    crankRodEye,
    crosshead,
    crossheadFace,
    flywheelFaceIndex,
    flywheelRim,
    flywheelSpokes,
    guideRails,
    guideShoe,
    guideSupports,
    input,
    inputShaft,
    rearBearing,
    rimEdges,
    rodBody,
    shaftHub,
    translationIndex,
    wristEyeLiner,
    wristPin,
    wristRodEye,
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    baseMaximumX,
    baseMinimumX,
    baseY,
    connectingRodLength,
    crankEyeInnerRadius,
    crankEyeOuterRadius,
    crankPinRadius,
    crankRadius,
    crossheadFaceDepth,
    crossheadFaceZ,
    crossheadHeight,
    crossheadWidth,
    cyclePeriod,
    eyeLinerDepth,
    flywheelDepth,
    flywheelInnerRadius,
    flywheelOuterRadius,
    fullTurn,
    guideInnerHalfHeight,
    guideMaximumX,
    guideMaximumOffset,
    guideMinimumX,
    guideMinimumOffset,
    guideOuterHalfHeight,
    guideRailDepth,
    guideRailThickness,
    guideRailZ,
    guideShoeDepth,
    guideShoeHalfHeight,
    guideShoeZ,
    hubRadius,
    inputAngularSpeed,
    inputSpeedMagnitude,
    maximumRodAngle,
    outputMaximumX,
    outputMidpointX,
    outputMinimumX,
    outputStroke,
    pinBearingClearance,
    pinCenterZ,
    pinLength,
    rodDepth,
    rodPlaneZ,
    runningClearance,
    shaftCenter: shaftCenter.clone(),
    shaftLength,
    shaftRadius,
    sourceConnectingRodLength,
    sourceCrankRadius,
    sourceCrossheadHeight,
    sourceCrossheadWidth,
    sourceFlywheelInnerRadius,
    sourceFlywheelOuterRadius,
    sourceGuideInnerHalfHeight,
    sourceGuideMaximumX,
    sourceGuideMinimumX,
    sourceGuideOuterHalfHeight,
    sourceHubRadius,
    sourcePoseAngle,
    sourceScale,
    spokeCenterRadius,
    spokeDepth,
    spokeLength,
    strokeLineY,
    wristEyeInnerRadius,
    wristEyeOuterRadius,
    wristPinRadius,
  };
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.driverAngle;
    input.userData.angularSpeed = state.driverAngularSpeed;
    connectingRod.position.copy(state.crankPoint);
    connectingRod.rotation.set(0, 0, state.rodAngle);
    connectingRod.userData.angularSpeed = state.rodAngularSpeed;
    crosshead.position.copy(state.sliderPosition);
    crosshead.rotation.set(0, 0, 0);
    crosshead.userData.velocity = state.outputVelocity.clone();
    root.userData.contacts = {
      crankPin: {
        axis: Z_AXIS.clone(),
        axisPoint: state.crankPinAxisPoint.clone(),
        centerError: 0,
        crankPoint: state.crankPoint.clone(),
        rodEyePoint: state.crankPoint.clone(),
      },
      sliderGuides: {
        axis: X_AXIS.clone(),
        guideError: state.sliderGuideError,
        lowerGap: state.lowerGuideGap,
        rotationError: 0,
        shoeCenter: state.guideShoeCenter.clone(),
        upperGap: state.upperGuideGap,
      },
      wristPin: {
        axis: Z_AXIS.clone(),
        axisPoint: state.wristPinAxisPoint.clone(),
        centerError: 0,
        crossheadPoint: state.wristPoint.clone(),
        rodEyePoint: state.wristPoint.clone(),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(8.4, 4.6, 11.4));
}

function scotchYokeCrankMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.42;
  const sourceDiskRadius = 4;
  const sourceCrankRadius = 3;
  const sourceWristRadius = 0.5;
  const sourceHubInnerRadius = 0.5;
  const sourceHubOuterRadius = 0.75;
  const sourceSlotEndCenter = 4.05;
  const sourceSlotHalfHeight = 0.5;
  const sourceYokeOuterHalfHeight = 1;
  const sourceStemHalfWidth = 0.5;
  const sourceGuideCenterOffset = 5;
  const sourceRenderedStemEndOffset = 9;

  const diskRadius = sourceDiskRadius * sourceScale;
  const crankRadius = sourceCrankRadius * sourceScale;
  const wristRadius = sourceWristRadius * sourceScale;
  const hubInnerRadius = sourceHubInnerRadius * sourceScale;
  const hubOuterRadius = sourceHubOuterRadius * sourceScale;
  const slotEndCenter = sourceSlotEndCenter * sourceScale;
  const slotHalfHeight = sourceSlotHalfHeight * sourceScale;
  const slotHalfLength = slotEndCenter + slotHalfHeight;
  const yokeOuterHalfHeight = sourceYokeOuterHalfHeight * sourceScale;
  const yokeOuterHalfLength = slotEndCenter + yokeOuterHalfHeight;
  const yokeWallThickness = yokeOuterHalfHeight - slotHalfHeight;
  const stemRadius = sourceStemHalfWidth * sourceScale;
  const guideCenterOffset = sourceGuideCenterOffset * sourceScale;
  const renderedStemEndOffset = sourceRenderedStemEndOffset * sourceScale;
  const stemStartOffset = yokeOuterHalfHeight - 0.055;
  const stemLength = renderedStemEndOffset - stemStartOffset;

  const inputSpeedMagnitude = 0.94;
  const inputAngularSpeed = -inputSpeedMagnitude;
  const cyclePeriod = fullTurn / inputSpeedMagnitude;
  const sourcePoseAngle = 0.72;
  const shaftCenter = new THREE.Vector3(0, 0.2, 0);
  const strokeLineX = shaftCenter.x;
  const outputMinimumY = shaftCenter.y - crankRadius;
  const outputMaximumY = shaftCenter.y + crankRadius;
  const outputStroke = outputMaximumY - outputMinimumY;
  const minimumSlotEndClearance = slotEndCenter - crankRadius;

  const diskDepth = 0.34;
  const diskCenterZ = -0.06;
  const diskFrontZ = diskCenterZ + diskDepth / 2;
  const shaftRadius = hubInnerRadius;
  const shaftLength = 1.38;
  const shaftCenterZ = -0.44;
  const crankArmDepth = 0.16;
  const crankArmZ = diskFrontZ + crankArmDepth / 2 - 0.008;
  const wristLength = 0.91;
  const wristCenterZ = 0.49;
  const yokeDepth = 0.34;
  const yokePlaneZ = 0.55;
  const stemPlaneZ = yokePlaneZ;
  const outlineDepth = 0.026;
  const outlineThickness = 0.034;
  const guideRunningClearance = 0.026;
  const guideInnerRadius = stemRadius + guideRunningClearance;
  const guideOuterRadius = guideInnerRadius + 0.14;
  const guideSleeveLength = 0.46;
  const frameHalfWidth = yokeOuterHalfLength + 0.58;
  const frameHalfHeight = guideCenterOffset + 0.62;
  const frameZ = -0.74;

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
  const wristMaterial = matte(PALETTE.brass, {
    metalness: 0.25,
    roughness: 0.46,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const input = planarRotor();
  input.position.copy(shaftCenter);
  input.userData.role = 'continuous-crankshaft-and-source-four-radius-disk';
  const inputRotor = input.userData.rotor;

  const diskBody = cylinderAlongZ(
    diskRadius,
    diskDepth,
    driverMaterial,
    96,
  );
  diskBody.position.z = diskCenterZ;
  diskBody.userData.role = 'source-four-radius-solid-crank-disk';
  inputRotor.add(diskBody);

  const diskOuterRim = new THREE.Mesh(
    new THREE.TorusGeometry(diskRadius - 0.035, 0.043, 10, 96),
    darkMaterial,
  );
  diskOuterRim.position.z = diskFrontZ + 0.018;
  diskOuterRim.userData.role = 'front-outline-of-solid-crank-disk';
  inputRotor.add(diskOuterRim);

  const inputShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
    48,
  );
  inputShaft.position.z = shaftCenterZ;
  inputShaft.userData.role = 'input-shaft-ending-behind-slotted-yoke';
  inputRotor.add(inputShaft);

  const shaftHub = cylinderAlongZ(
    hubOuterRadius,
    diskDepth + 0.17,
    darkMaterial,
    48,
  );
  shaftHub.position.z = diskCenterZ + 0.035;
  shaftHub.userData.role = 'three-quarter-radius-hub-on-crank-disk';
  inputRotor.add(shaftHub);

  const hubFace = cylinderAlongZ(
    hubInnerRadius,
    0.045,
    driverMaterial,
    40,
  );
  hubFace.position.z = diskFrontZ + 0.102;
  hubFace.userData.role = 'half-radius-center-face-of-source-hub';
  inputRotor.add(hubFace);

  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.17, crankArmDepth),
    darkMaterial,
  );
  crankArm.position.set(crankRadius / 2, 0, crankArmZ);
  crankArm.userData.role = 'rigid-three-radius-crank-arm-to-wrist';
  inputRotor.add(crankArm);

  const crankWrist = cylinderAlongZ(
    wristRadius,
    wristLength,
    wristMaterial,
    48,
  );
  crankWrist.position.set(crankRadius, 0, wristCenterZ);
  crankWrist.userData.role = 'single-crank-wrist-sliding-in-horizontal-slot';
  inputRotor.add(crankWrist);

  const wristCap = new THREE.Mesh(
    new THREE.TorusGeometry(wristRadius * 0.69, 0.028, 8, 40),
    darkMaterial,
  );
  wristCap.position.set(
    crankRadius,
    0,
    wristCenterZ + wristLength / 2 + 0.012,
  );
  wristCap.userData.role = 'front-index-on-the-single-crank-wrist';
  inputRotor.add(wristCap);

  const diskRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(diskRadius * 0.42, 0.085, 0.034),
    indexMaterial,
  );
  diskRotationIndex.position.set(
    diskRadius * 0.73,
    0,
    diskFrontZ + 0.046,
  );
  diskRotationIndex.userData.role = 'visible-angular-index-on-crank-disk';
  inputRotor.add(diskRotationIndex);

  const yoke = new THREE.Group();
  yoke.userData.role = 'nonrotating-horizontal-slot-yoke-with-vertical-stems';

  const yokeBody = new THREE.Mesh(
    centeredExtrusion(
      horizontalCapsuleRingShape(
        slotHalfHeight,
        yokeOuterHalfHeight,
        slotEndCenter,
      ),
      yokeDepth,
      0.006,
    ),
    drivenMaterial,
  );
  yokeBody.position.z = yokePlaneZ;
  yokeBody.userData.role = 'source-proportioned-horizontal-capsule-yoke';
  yoke.add(yokeBody);

  const slotOutline = new THREE.Mesh(
    centeredExtrusion(
      horizontalCapsuleRingShape(
        slotHalfHeight,
        slotHalfHeight + outlineThickness,
        slotEndCenter,
      ),
      outlineDepth,
      0.002,
    ),
    darkMaterial,
  );
  slotOutline.position.z = yokePlaneZ + yokeDepth / 2 + 0.016;
  slotOutline.userData.role = 'front-outline-of-straight-horizontal-slot';
  yoke.add(slotOutline);

  const outerOutline = new THREE.Mesh(
    centeredExtrusion(
      horizontalCapsuleRingShape(
        yokeOuterHalfHeight - outlineThickness,
        yokeOuterHalfHeight,
        slotEndCenter,
      ),
      outlineDepth,
      0.002,
    ),
    darkMaterial,
  );
  outerOutline.position.z = yokePlaneZ + yokeDepth / 2 + 0.017;
  outerOutline.userData.role = 'front-outline-of-horizontal-yoke-body';
  yoke.add(outerOutline);

  const upperStem = cylinderAlongY(
    stemRadius,
    stemLength,
    drivenMaterial,
    40,
  );
  upperStem.position.set(
    0,
    (stemStartOffset + renderedStemEndOffset) / 2,
    stemPlaneZ,
  );
  upperStem.userData.role = 'upper-round-stem-rigid-with-yoke';
  const lowerStem = cylinderAlongY(
    stemRadius,
    stemLength,
    drivenMaterial,
    40,
  );
  lowerStem.position.set(
    0,
    -(stemStartOffset + renderedStemEndOffset) / 2,
    stemPlaneZ,
  );
  lowerStem.userData.role = 'lower-round-stem-rigid-with-yoke';
  yoke.add(upperStem, lowerStem);

  const translationIndex = new THREE.Mesh(
    centeredExtrusion(
      annularShape(stemRadius * 0.96, stemRadius + 0.026),
      0.075,
      0.003,
    ),
    indexMaterial,
  );
  translationIndex.rotation.x = Math.PI / 2;
  translationIndex.position.set(0, guideCenterOffset + 0.5, stemPlaneZ);
  translationIndex.userData.role = 'visible-translation-index-on-upper-stem';
  yoke.add(translationIndex);

  const guideSleeves = [-1, 1].map((signY) => {
    const sleeve = new THREE.Mesh(
      centeredExtrusion(
        annularShape(guideInnerRadius, guideOuterRadius),
        guideSleeveLength,
        0.006,
      ),
      frameMaterial,
    );
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.set(
      strokeLineX,
      shaftCenter.y + signY * guideCenterOffset,
      stemPlaneZ,
    );
    sleeve.userData.role = 'fixed-annular-guide-for-vertical-yoke-stem';
    sleeve.userData.side = signY < 0 ? 'lower' : 'upper';
    return sleeve;
  });

  const rearFrameRails = [
    makeBeam(
      new THREE.Vector3(-frameHalfWidth, shaftCenter.y - frameHalfHeight, frameZ),
      new THREE.Vector3(-frameHalfWidth, shaftCenter.y + frameHalfHeight, frameZ),
      { thickness: 0.15, depth: 0.22, color: PALETTE.frame },
    ),
    makeBeam(
      new THREE.Vector3(frameHalfWidth, shaftCenter.y - frameHalfHeight, frameZ),
      new THREE.Vector3(frameHalfWidth, shaftCenter.y + frameHalfHeight, frameZ),
      { thickness: 0.15, depth: 0.22, color: PALETTE.frame },
    ),
    makeBeam(
      new THREE.Vector3(-frameHalfWidth, shaftCenter.y - frameHalfHeight, frameZ),
      new THREE.Vector3(frameHalfWidth, shaftCenter.y - frameHalfHeight, frameZ),
      { thickness: 0.15, depth: 0.22, color: PALETTE.frame },
    ),
    makeBeam(
      new THREE.Vector3(-frameHalfWidth, shaftCenter.y + frameHalfHeight, frameZ),
      new THREE.Vector3(frameHalfWidth, shaftCenter.y + frameHalfHeight, frameZ),
      { thickness: 0.15, depth: 0.22, color: PALETTE.frame },
    ),
  ];
  for (const [index, rail] of rearFrameRails.entries()) {
    rail.userData.role = 'fixed-rear-frame-around-scotch-yoke';
    rail.userData.index = index;
  }

  const guideBrackets = guideSleeves.flatMap((sleeve) => (
    [-1, 1].map((signX) => {
      const bracket = makeBeam(
        new THREE.Vector3(
          signX * frameHalfWidth,
          sleeve.position.y,
          frameZ,
        ),
        new THREE.Vector3(
          signX * guideOuterRadius,
          sleeve.position.y,
          stemPlaneZ - guideOuterRadius * 0.66,
        ),
        { thickness: 0.12, depth: 0.18, color: PALETTE.frame },
      );
      bracket.userData.role = 'fixed-bracket-supporting-stem-guide';
      bracket.userData.side = sleeve.userData.side;
      return bracket;
    })
  ));

  const rearBearing = new THREE.Mesh(
    new THREE.TorusGeometry(hubOuterRadius + 0.06, 0.073, 10, 44),
    frameMaterial,
  );
  rearBearing.position.set(shaftCenter.x, shaftCenter.y, -0.78);
  rearBearing.userData.role = 'fixed-rear-bearing-of-scotch-yoke-crankshaft';

  const bearingBrackets = [-1, 1].map((signX) => {
    const bracket = makeBeam(
      new THREE.Vector3(signX * frameHalfWidth, shaftCenter.y, frameZ),
      rearBearing.position,
      { thickness: 0.13, depth: 0.2, color: PALETTE.frame },
    );
    bracket.userData.role = 'fixed-bracket-supporting-crankshaft-bearing';
    return bracket;
  });

  const cameraFitGuides = [-1, 1].map((signY) => {
    const guide = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 6),
      new THREE.MeshBasicMaterial({
        color: PALETTE.paper,
        depthWrite: false,
        opacity: 0,
        transparent: true,
      }),
    );
    guide.position.set(
      shaftCenter.x,
      shaftCenter.y + signY * (renderedStemEndOffset + crankRadius),
      stemPlaneZ,
    );
    guide.userData.cameraFitGuide = true;
    guide.userData.side = signY < 0 ? 'lower' : 'upper';
    return guide;
  });

  root.add(
    ...cameraFitGuides,
    ...rearFrameRails,
    ...bearingBrackets,
    rearBearing,
    ...guideBrackets,
    ...guideSleeves,
    input,
    yoke,
  );

  const stateAtDriverAngle = (driverAngle) => {
    const cosine = Math.cos(driverAngle);
    const sine = Math.sin(driverAngle);
    const pinX = shaftCenter.x + crankRadius * cosine;
    const pinY = shaftCenter.y + crankRadius * sine;
    const yokeCenter = new THREE.Vector3(strokeLineX, pinY, 0);
    const slotCenter = new THREE.Vector3(strokeLineX, pinY, yokePlaneZ);
    const pinAxisPoint = new THREE.Vector3(pinX, pinY, wristCenterZ);
    const pinSlotCenter = new THREE.Vector3(pinX, pinY, yokePlaneZ);
    const relativeSlotX = pinX - slotCenter.x;
    const outputVelocity = new THREE.Vector3(
      0,
      crankRadius * cosine * inputAngularSpeed,
      0,
    );
    const outputAcceleration = new THREE.Vector3(
      0,
      -crankRadius * sine * inputAngularSpeed ** 2,
      0,
    );
    const pinVelocity = new THREE.Vector3(
      -crankRadius * sine * inputAngularSpeed,
      crankRadius * cosine * inputAngularSpeed,
      0,
    );
    const pinAcceleration = new THREE.Vector3(
      -crankRadius * cosine * inputAngularSpeed ** 2,
      -crankRadius * sine * inputAngularSpeed ** 2,
      0,
    );
    const relativeSlidingVelocity = new THREE.Vector3(
      pinVelocity.x,
      0,
      0,
    );
    const relativeSlidingAcceleration = new THREE.Vector3(
      pinAcceleration.x,
      0,
      0,
    );
    const upperPinPoint = new THREE.Vector3(
      pinX,
      pinY + wristRadius,
      yokePlaneZ,
    );
    const lowerPinPoint = new THREE.Vector3(
      pinX,
      pinY - wristRadius,
      yokePlaneZ,
    );
    const upperWallPoint = new THREE.Vector3(
      pinX,
      slotCenter.y + slotHalfHeight,
      yokePlaneZ,
    );
    const lowerWallPoint = new THREE.Vector3(
      pinX,
      slotCenter.y - slotHalfHeight,
      yokePlaneZ,
    );
    const driveDirectionY = Math.abs(outputVelocity.y) > 1e-10
      ? outputVelocity.y
      : outputAcceleration.y;
    const normalizedDriverAngle = THREE.MathUtils.euclideanModulo(
      driverAngle,
      fullTurn,
    );
    const atVerticalDeadCenter = Math.abs(cosine) < 1e-10;
    const stage = atVerticalDeadCenter && sine > 0
      ? 'upper-dead-center'
      : atVerticalDeadCenter && sine < 0
        ? 'lower-dead-center'
        : outputVelocity.y > 0
          ? 'yoke-upstroke'
          : 'yoke-downstroke';
    return {
      activeSlotWall: driveDirectionY >= 0 ? 'upper' : 'lower',
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      guideCenterlineError: Math.abs(yokeCenter.x - strokeLineX),
      guideRadialClearance: guideRunningClearance,
      inputRevolutions: (driverAngle - sourcePoseAngle) / fullTurn,
      lowerGuideAxisPoint: new THREE.Vector3(
        strokeLineX,
        shaftCenter.y - guideCenterOffset,
        stemPlaneZ,
      ),
      lowerPinPoint,
      lowerSurfaceGap: lowerPinPoint.y - lowerWallPoint.y,
      lowerWallPoint,
      normalizedDriverAngle,
      outputAcceleration,
      outputDisplacement: yokeCenter.y - shaftCenter.y,
      outputPosition: yokeCenter.clone(),
      outputVelocity,
      pinAcceleration,
      pinAxisPoint,
      pinPathError: Math.abs(
        Math.hypot(pinX - shaftCenter.x, pinY - shaftCenter.y)
          - crankRadius,
      ),
      pinSlotCenter,
      pinVelocity,
      relativeSlidingAcceleration,
      relativeSlidingVelocity,
      relativeSlotX,
      slotCenter,
      slotEndClearance: slotEndCenter - Math.abs(relativeSlotX),
      slotVerticalFitError: Math.abs(slotHalfHeight - wristRadius),
      stage,
      upperGuideAxisPoint: new THREE.Vector3(
        strokeLineX,
        shaftCenter.y + guideCenterOffset,
        stemPlaneZ,
      ),
      upperPinPoint,
      upperSurfaceGap: upperWallPoint.y - upperPinPoint.y,
      upperWallPoint,
      yokeAngularSpeed: 0,
      yokeCenter,
      yokeRotation: 0,
    };
  };
  const stateAtTime = (time) => stateAtDriverAngle(
    sourcePoseAngle + inputAngularSpeed * time,
  );

  root.userData.mechanism = 'vertical-stroke-horizontal-slot-scotch-yoke';
  root.userData.blocks = {
    bearingBrackets,
    cameraFitGuides,
    crankArm,
    crankWrist,
    diskBody,
    diskOuterRim,
    diskRotationIndex,
    guideBrackets,
    guideSleeves,
    hubFace,
    input,
    inputShaft,
    lowerStem,
    outerOutline,
    rearBearing,
    rearFrameRails,
    shaftHub,
    slotOutline,
    translationIndex,
    upperStem,
    wristCap,
    yoke,
    yokeBody,
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    crankArmDepth,
    crankArmZ,
    crankRadius,
    cyclePeriod,
    diskCenterZ,
    diskDepth,
    diskFrontZ,
    diskRadius,
    frameHalfHeight,
    frameHalfWidth,
    frameZ,
    fullTurn,
    guideAxis: Y_AXIS.clone(),
    guideCenterOffset,
    guideInnerRadius,
    guideOuterRadius,
    guideRunningClearance,
    guideSleeveLength,
    hubInnerRadius,
    hubOuterRadius,
    inputAngularSpeed,
    inputSpeedMagnitude,
    minimumSlotEndClearance,
    outlineDepth,
    outlineThickness,
    outputMaximumY,
    outputMinimumY,
    outputStroke,
    renderedStemEndOffset,
    shaftCenter: shaftCenter.clone(),
    shaftCenterZ,
    shaftLength,
    shaftRadius,
    slotEndCenter,
    slotHalfHeight,
    slotHalfLength,
    sourceCrankRadius,
    sourceDiskRadius,
    sourceGuideCenterOffset,
    sourceHubInnerRadius,
    sourceHubOuterRadius,
    sourcePoseAngle,
    sourceRenderedStemEndOffset,
    sourceScale,
    sourceSlotEndCenter,
    sourceSlotHalfHeight,
    sourceStemHalfWidth,
    sourceWristRadius,
    sourceYokeOuterHalfHeight,
    stemLength,
    stemPlaneZ,
    stemRadius,
    stemStartOffset,
    strokeLineX,
    wristCenterZ,
    wristLength,
    wristRadius,
    yokeDepth,
    yokeOuterHalfHeight,
    yokeOuterHalfLength,
    yokePlaneZ,
    yokeWallThickness,
  };
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.driverAngle;
    input.userData.angularSpeed = state.driverAngularSpeed;
    yoke.position.copy(state.yokeCenter);
    yoke.rotation.set(0, 0, 0);
    yoke.userData.angularSpeed = 0;
    yoke.userData.velocity = state.outputVelocity.clone();
    root.userData.contacts = {
      crankWristSlot: {
        activeWall: state.activeSlotWall,
        axis: Z_AXIS.clone(),
        endClearance: state.slotEndClearance,
        lowerPinPoint: state.lowerPinPoint.clone(),
        lowerSurfaceGap: state.lowerSurfaceGap,
        lowerWallPoint: state.lowerWallPoint.clone(),
        pinAxisPoint: state.pinAxisPoint.clone(),
        pinCenter: state.pinSlotCenter.clone(),
        upperPinPoint: state.upperPinPoint.clone(),
        upperSurfaceGap: state.upperSurfaceGap,
        upperWallPoint: state.upperWallPoint.clone(),
      },
      stemGuides: {
        axis: Y_AXIS.clone(),
        centerlineError: state.guideCenterlineError,
        lowerAxisPoint: state.lowerGuideAxisPoint.clone(),
        radialClearance: state.guideRadialClearance,
        rotationError: state.yokeRotation,
        upperAxisPoint: state.upperGuideAxisPoint.clone(),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(4.8, 2.6, 12));
}

function variableCrankSpiralPlateMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.45;
  const sourceRearPlateRadius = 5.25;
  const sourceFrontPlateRadius = 5;
  const sourceHubOuterRadius = 1;
  const sourceShaftRadius = 0.5;
  const sourceGrooveMinimumRadius = 1.75;
  const sourceGrooveMaximumRadius = 4.25;
  const sourceGrooveHalfWidth = 0.25;
  const sourceBoltHeadRadius = 0.5;
  const sourceSpiralTurnCount = 2;
  const sourceRadialSlotCount = 6;

  const rearPlateRadius = sourceRearPlateRadius * sourceScale;
  const frontPlateRadius = sourceFrontPlateRadius * sourceScale;
  const hubOuterRadius = sourceHubOuterRadius * sourceScale;
  const shaftRadius = sourceShaftRadius * sourceScale;
  const grooveMinimumRadius = sourceGrooveMinimumRadius * sourceScale;
  const grooveMaximumRadius = sourceGrooveMaximumRadius * sourceScale;
  const grooveHalfWidth = sourceGrooveHalfWidth * sourceScale;
  const radialSlotHalfWidth = grooveHalfWidth;
  const boltShankRadius = grooveHalfWidth;
  const boltHeadRadius = sourceBoltHeadRadius * sourceScale;
  const spiralTurnCount = sourceSpiralTurnCount;
  const spiralSweep = spiralTurnCount * fullTurn;
  const spiralPitch = (
    grooveMaximumRadius - grooveMinimumRadius
  ) / spiralSweep;
  const radialSlotCount = sourceRadialSlotCount;
  const radialSlotAngularPitch = fullTurn / radialSlotCount;
  const radialSlotStraightHalfLength = (
    grooveMaximumRadius - grooveMinimumRadius
  ) / 2;
  const radialSlotCenterRadius = (
    grooveMinimumRadius + grooveMaximumRadius
  ) / 2;

  const rearAngularSpeed = -0.28;
  const adjustmentAngularSpeed = 0.46;
  const adjustmentCyclePeriod = fullTurn / adjustmentAngularSpeed;
  const sourceAdjustmentFraction = 0.9;
  const sourceAdjustmentPhase = Math.acos(
    1 - 2 * sourceAdjustmentFraction,
  );
  const sourceSpiralParameter = spiralSweep * sourceAdjustmentFraction;
  const sourcePinAngle = Math.PI * 4 / 3;
  const sourceRearPlateAngle = THREE.MathUtils.euclideanModulo(
    sourcePinAngle - sourceSpiralParameter + Math.PI,
    fullTurn,
  ) - Math.PI;
  const shaftCenter = new THREE.Vector3(0, 0.42, 0);

  const rearPlateDepth = 0.28;
  const rearPlateZ = -0.18;
  const rearPlateBackZ = rearPlateZ - rearPlateDepth / 2;
  const rearPlateFrontZ = rearPlateZ + rearPlateDepth / 2;
  const frontPlateDepth = 0.25;
  const frontPlateZ = 0.17;
  const frontPlateBackZ = frontPlateZ - frontPlateDepth / 2;
  const frontPlateFrontZ = frontPlateZ + frontPlateDepth / 2;
  const interPlateGap = frontPlateBackZ - rearPlateFrontZ;
  const boreRunningClearance = 0.018;
  const plateBoreRadius = shaftRadius + boreRunningClearance;
  const shaftLength = 2.1;
  const shaftCenterZ = -0.22;
  const boltShankLength = 0.9;
  const boltShankCenterZ = 0.035;
  const boltHeadDepth = 0.16;
  const boltHeadZ = frontPlateFrontZ + boltHeadDepth / 2 + 0.018;
  const boltRearNutRadius = boltHeadRadius * 0.78;
  const boltRearNutDepth = 0.14;
  const boltRearNutZ = rearPlateBackZ - boltRearNutDepth / 2 - 0.014;
  const grooveEdgeRadius = 0.014;
  const outlineDepth = 0.026;
  const outlineThickness = 0.035;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    opacity: 0.86,
    roughness: 0.62,
    transparent: true,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.5,
  });
  const boltMaterial = matte(PALETTE.brass, {
    metalness: 0.28,
    roughness: 0.45,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const grooveProfile = spiralRibbonProfile({
    endRadius: grooveMaximumRadius,
    halfWidth: grooveHalfWidth,
    startRadius: grooveMinimumRadius,
    sweep: spiralSweep,
    segments: 288,
  });

  const rearPlateShape = new THREE.Shape();
  rearPlateShape.absarc(0, 0, rearPlateRadius, 0, fullTurn, false);
  const rearBore = new THREE.Path();
  rearBore.absarc(0, 0, plateBoreRadius, 0, fullTurn, true);
  rearPlateShape.holes.push(
    rearBore,
    pathFromPoints(grooveProfile.polygon, true),
  );

  const frontPlateShape = new THREE.Shape();
  frontPlateShape.absarc(0, 0, frontPlateRadius, 0, fullTurn, false);
  const frontBore = new THREE.Path();
  frontBore.absarc(0, 0, plateBoreRadius, 0, fullTurn, true);
  frontPlateShape.holes.push(frontBore);
  const radialSlotRecords = [];
  const baseSlotPoints = horizontalCapsulePoints(
    radialSlotStraightHalfLength,
    radialSlotHalfWidth,
    20,
  );
  for (let index = 0; index < radialSlotCount; index += 1) {
    const angle = index * radialSlotAngularPitch;
    const center = new THREE.Vector2(
      radialSlotCenterRadius * Math.cos(angle),
      radialSlotCenterRadius * Math.sin(angle),
    );
    const points = transformedPoints(baseSlotPoints, angle, center);
    const path = pathFromPoints(points, true);
    frontPlateShape.holes.push(path);
    radialSlotRecords.push({ angle, center, index, path, points });
  }

  const rear = planarRotor();
  rear.position.copy(shaftCenter);
  rear.userData.role = 'rear-two-turn-spiral-groove-plate-and-shaft';
  const rearRotor = rear.userData.rotor;

  const rearPlate = new THREE.Mesh(
    centeredExtrusion(rearPlateShape, rearPlateDepth, 0.006),
    drivenMaterial,
  );
  rearPlate.position.z = rearPlateZ;
  rearPlate.userData.role = 'rear-plate-with-real-two-turn-spiral-through-groove';
  rearPlate.userData.cutShape = rearPlateShape;
  rearPlate.userData.grooveProfile = grooveProfile;
  rearRotor.add(rearPlate);

  const rearOuterRim = new THREE.Mesh(
    new THREE.TorusGeometry(rearPlateRadius - 0.035, 0.043, 10, 108),
    darkMaterial,
  );
  rearOuterRim.position.z = rearPlateFrontZ + 0.018;
  rearOuterRim.userData.role = 'front-outline-of-five-and-quarter-radius-rear-plate';
  rearRotor.add(rearOuterRim);

  const grooveBoundaryEdges = [
    grooveProfile.inwardBoundary,
    grooveProfile.outwardBoundary,
  ].map((boundary, index) => {
    const curve = new THREE.CatmullRomCurve3(
      boundary.map((point) => new THREE.Vector3(
        point.x,
        point.y,
        rearPlateFrontZ + 0.025,
      )),
      false,
      'centripetal',
    );
    const edge = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 288, grooveEdgeRadius, 6, false),
      darkMaterial,
    );
    edge.userData.role = 'visible-boundary-of-two-turn-spiral-groove';
    edge.userData.side = index === 0 ? 'inward' : 'outward';
    edge.userData.curve = curve;
    return edge;
  });
  rearRotor.add(...grooveBoundaryEdges);

  const rearHub = cylinderAlongZ(
    hubOuterRadius,
    rearPlateDepth + 0.13,
    drivenMaterial,
    56,
  );
  rearHub.position.z = rearPlateZ - 0.015;
  rearHub.userData.role = 'hub-rigid-with-rear-spiral-plate';
  rearRotor.add(rearHub);

  const inputShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
    48,
  );
  inputShaft.position.z = shaftCenterZ;
  inputShaft.userData.role = 'common-center-shaft-rigid-with-rear-plate';
  rearRotor.add(inputShaft);

  const rearRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.075, 0.035),
    indexMaterial,
  );
  rearRotationIndex.position.set(
    rearPlateRadius - 0.28,
    0,
    rearPlateFrontZ + 0.052,
  );
  rearRotationIndex.userData.role = 'rotation-index-on-rear-spiral-plate';
  rearRotor.add(rearRotationIndex);

  const front = planarRotor();
  front.position.copy(shaftCenter);
  front.userData.role = 'front-six-radial-slot-adjusting-plate';
  const frontRotor = front.userData.rotor;

  const frontPlate = new THREE.Mesh(
    centeredExtrusion(frontPlateShape, frontPlateDepth, 0.006),
    driverMaterial,
  );
  frontPlate.position.z = frontPlateZ;
  frontPlate.renderOrder = 1;
  frontPlate.userData.role = 'front-plate-with-six-real-radial-through-slots';
  frontPlate.userData.cutShape = frontPlateShape;
  frontPlate.userData.radialSlotRecords = radialSlotRecords;
  frontRotor.add(frontPlate);

  const frontOuterRim = new THREE.Mesh(
    new THREE.TorusGeometry(frontPlateRadius - 0.034, 0.043, 10, 108),
    darkMaterial,
  );
  frontOuterRim.position.z = frontPlateFrontZ + 0.018;
  frontOuterRim.userData.role = 'front-outline-of-five-radius-slot-plate';
  frontRotor.add(frontOuterRim);

  const radialSlotOutlines = radialSlotRecords.map((record) => {
    const outline = new THREE.Mesh(
      centeredExtrusion(
        horizontalCapsuleRingShape(
          radialSlotHalfWidth,
          radialSlotHalfWidth + outlineThickness,
          radialSlotStraightHalfLength,
        ),
        outlineDepth,
        0.002,
      ),
      darkMaterial,
    );
    outline.position.set(
      record.center.x,
      record.center.y,
      frontPlateFrontZ + 0.021,
    );
    outline.rotation.z = record.angle;
    outline.userData.role = 'front-outline-of-real-radial-slot';
    outline.userData.index = record.index;
    return outline;
  });
  frontRotor.add(...radialSlotOutlines);

  const frontHub = new THREE.Mesh(
    centeredExtrusion(
      annularShape(plateBoreRadius, hubOuterRadius),
      frontPlateDepth + 0.12,
      0.006,
    ),
    driverMaterial,
  );
  frontHub.position.z = frontPlateZ + 0.015;
  frontHub.renderOrder = 2;
  frontHub.userData.role = 'loose-front-hub-turning-around-common-shaft';
  frontRotor.add(frontHub);

  const frontRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.078, 0.036),
    indexMaterial,
  );
  frontRotationIndex.position.set(
    frontPlateRadius - 0.31,
    0,
    frontPlateFrontZ + 0.055,
  );
  frontRotationIndex.userData.role = 'unique-rotation-index-on-front-slot-plate';
  frontRotor.add(frontRotationIndex);

  const bolt = new THREE.Group();
  bolt.userData.role = 'single-bolt-through-spiral-groove-and-one-radial-slot';
  const boltShank = cylinderAlongZ(
    boltShankRadius,
    boltShankLength,
    boltMaterial,
    40,
  );
  boltShank.position.z = boltShankCenterZ;
  boltShank.userData.role = 'quarter-radius-close-fitting-bolt-shank';
  const boltHead = cylinderAlongZ(
    boltHeadRadius,
    boltHeadDepth,
    boltMaterial,
    48,
  );
  boltHead.position.z = boltHeadZ;
  boltHead.userData.role = 'half-radius-front-head-of-adjustable-crank-bolt';
  const boltHeadRing = new THREE.Mesh(
    new THREE.TorusGeometry(boltHeadRadius * 0.67, 0.026, 8, 44),
    darkMaterial,
  );
  boltHeadRing.position.z = boltHeadZ + boltHeadDepth / 2 + 0.012;
  boltHeadRing.userData.role = 'front-index-ring-on-adjustable-crank-bolt';
  const boltHeadKey = new THREE.Mesh(
    new THREE.BoxGeometry(boltHeadRadius * 0.72, 0.065, 0.035),
    darkMaterial,
  );
  boltHeadKey.position.set(
    boltHeadRadius * 0.14,
    0,
    boltHeadZ + boltHeadDepth / 2 + 0.032,
  );
  boltHeadKey.userData.role = 'radial-key-on-adjustable-crank-bolt-head';
  const boltRearNut = cylinderAlongZ(
    boltRearNutRadius,
    boltRearNutDepth,
    darkMaterial,
    6,
  );
  boltRearNut.position.z = boltRearNutZ;
  boltRearNut.userData.role = 'rear-nut-retaining-bolt-through-both-plates';
  bolt.add(
    boltShank,
    boltHead,
    boltHeadRing,
    boltHeadKey,
    boltRearNut,
  );

  const rearBearing = new THREE.Mesh(
    new THREE.TorusGeometry(hubOuterRadius + 0.08, 0.078, 10, 48),
    frameMaterial,
  );
  rearBearing.position.set(shaftCenter.x, shaftCenter.y, -1.06);
  rearBearing.userData.role = 'fixed-rear-bearing-of-variable-crank-shaft';
  const baseY = shaftCenter.y - rearPlateRadius - 0.64;
  const baseZ = -0.92;
  const baseRail = makeBeam(
    new THREE.Vector3(-3.05, baseY, baseZ),
    new THREE.Vector3(3.05, baseY, baseZ),
    { thickness: 0.17, depth: 0.27, color: PALETTE.frame },
  );
  baseRail.userData.role = 'fixed-base-of-variable-crank-demonstrator';
  const bearingSupports = [-1, 1].map((signX) => {
    const support = makeBeam(
      new THREE.Vector3(signX * 1.25, baseY, baseZ),
      rearBearing.position,
      { thickness: 0.15, depth: 0.22, color: PALETTE.frame },
    );
    support.userData.role = 'rear-A-frame-support-of-variable-crank-bearing';
    return support;
  });

  root.add(
    baseRail,
    ...bearingSupports,
    rearBearing,
    rear,
    front,
    bolt,
  );

  const stateAtAdjustmentPhase = (
    adjustmentPhase,
    rearPlateAngle = sourceRearPlateAngle,
  ) => {
    const phaseCosine = Math.cos(adjustmentPhase);
    const phaseSine = Math.sin(adjustmentPhase);
    const adjustmentFraction = (1 - phaseCosine) / 2;
    const adjustmentFractionRate = phaseSine
      * adjustmentAngularSpeed / 2;
    const adjustmentFractionAcceleration = phaseCosine
      * adjustmentAngularSpeed ** 2 / 2;
    const spiralParameter = spiralSweep * adjustmentFraction;
    const relativePlateAngularSpeed = spiralSweep * adjustmentFractionRate;
    const relativePlateAngularAcceleration = spiralSweep
      * adjustmentFractionAcceleration;
    const frontPlateAngle = rearPlateAngle + spiralParameter;
    const frontPlateAngularSpeed = rearAngularSpeed
      + relativePlateAngularSpeed;
    const frontPlateAngularAcceleration = relativePlateAngularAcceleration;
    const boltRadius = grooveMinimumRadius
      + (grooveMaximumRadius - grooveMinimumRadius) * adjustmentFraction;
    const boltRadiusRate = (grooveMaximumRadius - grooveMinimumRadius)
      * adjustmentFractionRate;
    const boltRadiusAcceleration = (
      grooveMaximumRadius - grooveMinimumRadius
    ) * adjustmentFractionAcceleration;
    const boltAngle = frontPlateAngle;
    const cosine = Math.cos(boltAngle);
    const sine = Math.sin(boltAngle);
    const boltCenter = new THREE.Vector3(
      shaftCenter.x + boltRadius * cosine,
      shaftCenter.y + boltRadius * sine,
      boltShankCenterZ,
    );
    const boltSlotCenter = new THREE.Vector3(
      boltCenter.x,
      boltCenter.y,
      frontPlateZ,
    );
    const boltGrooveCenter = new THREE.Vector3(
      boltCenter.x,
      boltCenter.y,
      rearPlateZ,
    );
    const boltVelocity = new THREE.Vector3(
      boltRadiusRate * cosine
        - boltRadius * sine * frontPlateAngularSpeed,
      boltRadiusRate * sine
        + boltRadius * cosine * frontPlateAngularSpeed,
      0,
    );
    const radialAcceleration = boltRadiusAcceleration
      - boltRadius * frontPlateAngularSpeed ** 2;
    const transverseAcceleration = 2 * boltRadiusRate
      * frontPlateAngularSpeed
      + boltRadius * frontPlateAngularAcceleration;
    const boltAcceleration = new THREE.Vector3(
      radialAcceleration * cosine - transverseAcceleration * sine,
      radialAcceleration * sine + transverseAcceleration * cosine,
      0,
    );

    const rearLocalGroovePoint = new THREE.Vector3(
      boltRadius * Math.cos(spiralParameter),
      boltRadius * Math.sin(spiralParameter),
      rearPlateZ,
    );
    const frontLocalSlotPoint = new THREE.Vector3(
      boltRadius,
      0,
      frontPlateZ,
    );
    const rearWorldGroovePoint = rearLocalGroovePoint.clone()
      .setZ(0)
      .applyAxisAngle(Z_AXIS, rearPlateAngle)
      .add(new THREE.Vector3(shaftCenter.x, shaftCenter.y, rearPlateZ));
    const frontWorldSlotPoint = frontLocalSlotPoint.clone()
      .setZ(0)
      .applyAxisAngle(Z_AXIS, frontPlateAngle)
      .add(new THREE.Vector3(shaftCenter.x, shaftCenter.y, frontPlateZ));

    const localGrooveTangent = new THREE.Vector2(
      spiralPitch * Math.cos(spiralParameter)
        - boltRadius * Math.sin(spiralParameter),
      spiralPitch * Math.sin(spiralParameter)
        + boltRadius * Math.cos(spiralParameter),
    ).normalize();
    const localGrooveRightNormal = new THREE.Vector2(
      localGrooveTangent.y,
      -localGrooveTangent.x,
    );
    const grooveRightNormal = new THREE.Vector3(
      localGrooveRightNormal.x,
      localGrooveRightNormal.y,
      0,
    ).applyAxisAngle(Z_AXIS, rearPlateAngle);
    const grooveTangent = new THREE.Vector3(
      localGrooveTangent.x,
      localGrooveTangent.y,
      0,
    ).applyAxisAngle(Z_AXIS, rearPlateAngle);
    const slotNormal = new THREE.Vector3(-sine, cosine, 0);
    const grooveRightPinPoint = boltGrooveCenter.clone()
      .addScaledVector(grooveRightNormal, boltShankRadius);
    const grooveLeftPinPoint = boltGrooveCenter.clone()
      .addScaledVector(grooveRightNormal, -boltShankRadius);
    const slotLeftPinPoint = boltSlotCenter.clone()
      .addScaledVector(slotNormal, boltShankRadius);
    const slotRightPinPoint = boltSlotCenter.clone()
      .addScaledVector(slotNormal, -boltShankRadius);
    const atAdjustmentEnd = Math.abs(phaseSine) < 1e-10;
    const stage = atAdjustmentEnd && phaseCosine > 0
      ? 'minimum-crank-throw'
      : atAdjustmentEnd && phaseCosine < 0
        ? 'maximum-crank-throw'
        : adjustmentFractionRate > 0
          ? 'bolt-adjusting-outward'
          : 'bolt-adjusting-inward';
    return {
      adjustmentCycleFraction: THREE.MathUtils.euclideanModulo(
        adjustmentPhase,
        fullTurn,
      ) / fullTurn,
      adjustmentFraction,
      adjustmentFractionAcceleration,
      adjustmentFractionRate,
      adjustmentPhase,
      boltAcceleration,
      boltAngle,
      boltAxisPoint: boltCenter.clone(),
      boltCenter,
      boltGrooveCenter,
      boltRadius,
      boltRadiusAcceleration,
      boltRadiusRate,
      boltSlotCenter,
      boltVelocity,
      frontAngularAcceleration: frontPlateAngularAcceleration,
      frontAngularSpeed: frontPlateAngularSpeed,
      frontLocalSlotPoint,
      frontPlateAngle,
      frontSlotConstraintError: frontWorldSlotPoint.distanceTo(boltSlotCenter),
      frontWorldSlotPoint,
      grooveLeftPinPoint,
      grooveLeftWallPoint: grooveLeftPinPoint.clone(),
      groovePitchError: Math.abs(
        boltRadius - grooveMinimumRadius - spiralPitch * spiralParameter,
      ),
      grooveRightNormal,
      grooveRightPinPoint,
      grooveRightWallPoint: grooveRightPinPoint.clone(),
      grooveTangent,
      innerEndpointClearance: boltRadius - grooveMinimumRadius,
      outerEndpointClearance: grooveMaximumRadius - boltRadius,
      pinGrooveSideGap: grooveHalfWidth - boltShankRadius,
      pinSlotSideGap: radialSlotHalfWidth - boltShankRadius,
      rearAngularSpeed,
      rearLocalGroovePoint,
      rearPlateAngle,
      rearSpiralConstraintError: rearWorldGroovePoint.distanceTo(
        boltGrooveCenter,
      ),
      rearWorldGroovePoint,
      relativePlateAngle: spiralParameter,
      relativePlateAngularAcceleration,
      relativePlateAngularSpeed,
      selectedRadialSlotIndex: 0,
      slotLeftPinPoint,
      slotLeftWallPoint: slotLeftPinPoint.clone(),
      slotNormal,
      slotRightPinPoint,
      slotRightWallPoint: slotRightPinPoint.clone(),
      spiralParameter,
      spiralTurnsTraversed: spiralParameter / fullTurn,
      stage,
    };
  };
  const stateAtTime = (time) => stateAtAdjustmentPhase(
    sourceAdjustmentPhase + adjustmentAngularSpeed * time,
    sourceRearPlateAngle + rearAngularSpeed * time,
  );

  root.userData.mechanism = 'two-plate-spiral-slot-variable-crank';
  root.userData.blocks = {
    baseRail,
    bearingSupports,
    bolt,
    boltHead,
    boltHeadKey,
    boltHeadRing,
    boltRearNut,
    boltShank,
    front,
    frontHub,
    frontOuterRim,
    frontPlate,
    frontRotationIndex,
    grooveBoundaryEdges,
    inputShaft,
    radialSlotOutlines,
    rear,
    rearBearing,
    rearHub,
    rearOuterRim,
    rearPlate,
    rearRotationIndex,
  };
  root.userData.geometry = {
    adjustmentAngularSpeed,
    adjustmentCyclePeriod,
    axis: Z_AXIS.clone(),
    baseY,
    baseZ,
    boltHeadDepth,
    boltHeadRadius,
    boltHeadZ,
    boltRearNutDepth,
    boltRearNutRadius,
    boltRearNutZ,
    boltShankCenterZ,
    boltShankLength,
    boltShankRadius,
    boreRunningClearance,
    frontPlateBackZ,
    frontPlateDepth,
    frontPlateFrontZ,
    frontPlateRadius,
    frontPlateZ,
    fullTurn,
    grooveHalfWidth,
    grooveMaximumRadius,
    grooveMinimumRadius,
    groovePitch: spiralPitch,
    hubOuterRadius,
    interPlateGap,
    outlineDepth,
    outlineThickness,
    plateBoreRadius,
    radialSlotAngularPitch,
    radialSlotCenterRadius,
    radialSlotCount,
    radialSlotHalfWidth,
    radialSlotStraightHalfLength,
    rearAngularSpeed,
    rearPlateBackZ,
    rearPlateDepth,
    rearPlateFrontZ,
    rearPlateRadius,
    rearPlateZ,
    shaftCenter: shaftCenter.clone(),
    shaftCenterZ,
    shaftLength,
    shaftRadius,
    sourceAdjustmentFraction,
    sourceAdjustmentPhase,
    sourceBoltHeadRadius,
    sourceFrontPlateRadius,
    sourceGrooveHalfWidth,
    sourceGrooveMaximumRadius,
    sourceGrooveMinimumRadius,
    sourceHubOuterRadius,
    sourcePinAngle,
    sourceRadialSlotCount,
    sourceRearPlateAngle,
    sourceRearPlateRadius,
    sourceScale,
    sourceShaftRadius,
    sourceSpiralParameter,
    sourceSpiralTurnCount,
    spiralSweep,
    spiralTurnCount,
  };
  root.userData.grooveProfile = grooveProfile;
  root.userData.radialSlotRecords = radialSlotRecords;
  root.userData.stateAtAdjustmentPhase = stateAtAdjustmentPhase;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    rearRotor.rotation.z = state.rearPlateAngle;
    rear.userData.angularSpeed = state.rearAngularSpeed;
    frontRotor.rotation.z = state.frontPlateAngle;
    front.userData.angularSpeed = state.frontAngularSpeed;
    bolt.position.set(state.boltCenter.x, state.boltCenter.y, 0);
    bolt.rotation.set(0, 0, state.frontPlateAngle);
    bolt.userData.velocity = state.boltVelocity.clone();
    root.userData.contacts = {
      axialStack: {
        axis: Z_AXIS.clone(),
        frontPlateBackZ,
        interPlateGap,
        rearPlateFrontZ,
      },
      radialSlot: {
        innerEndpointClearance: state.innerEndpointClearance,
        leftPinPoint: state.slotLeftPinPoint.clone(),
        leftWallPoint: state.slotLeftWallPoint.clone(),
        rightPinPoint: state.slotRightPinPoint.clone(),
        rightWallPoint: state.slotRightWallPoint.clone(),
        selectedSlotIndex: state.selectedRadialSlotIndex,
        sideGap: state.pinSlotSideGap,
        slotNormal: state.slotNormal.clone(),
        outerEndpointClearance: state.outerEndpointClearance,
      },
      spiralGroove: {
        leftPinPoint: state.grooveLeftPinPoint.clone(),
        leftWallPoint: state.grooveLeftWallPoint.clone(),
        pitchError: state.groovePitchError,
        rightNormal: state.grooveRightNormal.clone(),
        rightPinPoint: state.grooveRightPinPoint.clone(),
        rightWallPoint: state.grooveRightWallPoint.clone(),
        sideGap: state.pinGrooveSideGap,
        tangent: state.grooveTangent.clone(),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(6.6, 4.3, 10.8));
}

function inclinedDiskVerticalFollowerMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceProjectedDiskSlope = 0.23;
  const sourceFollowerRadiusRatio = 0.8;
  const diskTiltAngle = Math.atan(sourceProjectedDiskSlope);
  const diskRadius = 2.25;
  const diskDepth = 0.24;
  const followerRadius = diskRadius * sourceFollowerRadiusRatio;
  const contactShoeRadius = 0.16;
  const liftAmplitude = followerRadius * Math.tan(diskTiltAngle);
  const outputStroke = 2 * liftAmplitude;
  const inputSpeedMagnitude = 0.82;
  const inputAngularSpeed = -inputSpeedMagnitude;
  const cyclePeriod = fullTurn / inputSpeedMagnitude;
  const sourcePoseAngle = 0;
  const diskCenter = new THREE.Vector3(0, 0.46, 0);
  const diskSurfaceOffset = diskDepth / 2;
  const followerMidpointY = diskCenter.y
    + (diskSurfaceOffset + contactShoeRadius) / Math.cos(diskTiltAngle);
  const outputMinimumY = followerMidpointY - liftAmplitude;
  const outputMaximumY = followerMidpointY + liftAmplitude;

  const shaftRadius = 0.17;
  const shaftLength = 2.72;
  const shaftCenterY = -0.86;
  const hubHeight = 0.55;
  const hubCenterY = diskCenter.y - 0.36;
  const diskRimTubeRadius = 0.046;
  const rodRadius = 0.105;
  const rodLength = 3.05;
  const rodBottomOffset = 0.56;
  const rodCenterOffset = rodBottomOffset + rodLength / 2;
  const forkArmHeight = 0.58;
  const forkArmWidth = 0.13;
  const forkArmDepth = 0.09;
  const forkHalfSpacing = 0.17;
  const forkPivotY = 0.25;
  const guideRunningClearance = 0.026;
  const guideInnerRadius = rodRadius + guideRunningClearance;
  const guideOuterRadius = 0.28;
  const guideLength = 0.48;
  const guideCenterY = 2.58;
  const bearingInnerRadius = shaftRadius + 0.026;
  const bearingOuterRadius = 0.38;
  const bearingLength = 0.52;
  const bearingCenterY = -1.18;
  const framePostX = 3.04;
  const frameTopY = 3.04;
  const baseY = -2.34;
  const frameZ = -0.82;

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
  const shoeMaterial = matte(PALETTE.brass, {
    metalness: 0.25,
    roughness: 0.46,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const input = new THREE.Group();
  const inputRotor = new THREE.Group();
  input.add(inputRotor);
  input.position.copy(diskCenter);
  input.userData.axis = Y_AXIS.clone();
  input.userData.rotor = inputRotor;
  input.userData.role = 'upright-shaft-with-rigidly-inclined-disk';

  const inputShaft = cylinderAlongY(
    shaftRadius,
    shaftLength,
    darkMaterial,
    48,
  );
  inputShaft.position.y = shaftCenterY - diskCenter.y;
  inputShaft.userData.role = 'continuous-upright-input-shaft-through-disk-center';
  inputRotor.add(inputShaft);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.4, hubHeight, 48),
    driverMaterial,
  );
  hub.position.y = hubCenterY - diskCenter.y;
  hub.userData.role = 'tapered-hub-clamping-oblique-disk-to-upright-shaft';
  inputRotor.add(hub);

  const diskTiltGroup = new THREE.Group();
  diskTiltGroup.rotation.z = diskTiltAngle;
  diskTiltGroup.userData.role = 'fixed-tilt-carrier-rigid-with-input-rotor';
  inputRotor.add(diskTiltGroup);

  const diskBody = new THREE.Mesh(
    new THREE.CylinderGeometry(diskRadius, diskRadius, diskDepth, 112),
    driverMaterial,
  );
  diskBody.userData.role = 'solid-oblique-disk-driving-upright-follower';
  diskTiltGroup.add(diskBody);

  const diskRim = new THREE.Mesh(
    new THREE.TorusGeometry(
      diskRadius - diskRimTubeRadius,
      diskRimTubeRadius,
      10,
      112,
    ),
    darkMaterial,
  );
  diskRim.rotation.x = Math.PI / 2;
  diskRim.position.y = diskSurfaceOffset + 0.018;
  diskRim.userData.role = 'visible-rim-on-upper-face-of-oblique-disk';
  diskTiltGroup.add(diskRim);

  const diskRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.034, 0.085),
    indexMaterial,
  );
  diskRotationIndex.position.set(
    diskRadius - 0.34,
    diskSurfaceOffset + 0.044,
    0,
  );
  diskRotationIndex.userData.role = 'visible-rotation-index-on-oblique-disk-face';
  diskTiltGroup.add(diskRotationIndex);

  const shaftRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.3, 0.07),
    indexMaterial,
  );
  shaftRotationIndex.position.set(
    shaftRadius + 0.018,
    bearingCenterY - diskCenter.y - 0.56,
    0,
  );
  shaftRotationIndex.userData.role = 'visible-index-on-upright-input-shaft';
  inputRotor.add(shaftRotationIndex);

  const follower = new THREE.Group();
  follower.userData.role = 'vertically-guided-rod-with-rounded-contact-shoe';

  const contactShoe = new THREE.Mesh(
    new THREE.SphereGeometry(contactShoeRadius, 40, 24),
    shoeMaterial,
  );
  contactShoe.userData.role = 'rounded-shoe-resting-on-oblique-disk-surface';

  const forkArms = [-1, 1].map((signZ) => {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(forkArmWidth, forkArmHeight, forkArmDepth),
      drivenMaterial,
    );
    arm.position.set(0, forkArmHeight / 2 + 0.04, signZ * forkHalfSpacing);
    arm.userData.role = 'fork-arm-supporting-rounded-follower-shoe';
    arm.userData.side = signZ < 0 ? 'rear' : 'front';
    return arm;
  });

  const forkBridge = new THREE.Mesh(
    new THREE.BoxGeometry(forkArmWidth * 1.35, 0.15, forkHalfSpacing * 2.45),
    drivenMaterial,
  );
  forkBridge.position.y = forkArmHeight + 0.04;
  forkBridge.userData.role = 'bridge-joining-the-two-follower-fork-arms';

  const forkPivot = cylinderAlongZ(
    0.075,
    forkHalfSpacing * 2 + forkArmDepth + 0.12,
    darkMaterial,
    32,
  );
  forkPivot.position.y = forkPivotY;
  forkPivot.userData.role = 'cross-pin-through-follower-shoe-fork';

  const followerRod = cylinderAlongY(
    rodRadius,
    rodLength,
    drivenMaterial,
    36,
  );
  followerRod.position.y = rodCenterOffset;
  followerRod.userData.role = 'upright-output-rod-in-fixed-guide';

  const translationIndex = cylinderAlongY(
    rodRadius + 0.018,
    0.075,
    indexMaterial,
    36,
  );
  translationIndex.position.y = rodCenterOffset + 0.42;
  translationIndex.userData.role = 'visible-translation-index-on-upright-rod';

  follower.add(
    contactShoe,
    ...forkArms,
    forkBridge,
    forkPivot,
    followerRod,
    translationIndex,
  );

  const followerGuide = new THREE.Mesh(
    centeredExtrusion(
      annularShape(guideInnerRadius, guideOuterRadius),
      guideLength,
      0.006,
    ),
    frameMaterial,
  );
  followerGuide.rotation.x = Math.PI / 2;
  followerGuide.position.set(followerRadius, guideCenterY, 0);
  followerGuide.userData.role = 'fixed-annular-guide-for-upright-follower-rod';

  const shaftBearing = new THREE.Mesh(
    centeredExtrusion(
      annularShape(bearingInnerRadius, bearingOuterRadius),
      bearingLength,
      0.006,
    ),
    frameMaterial,
  );
  shaftBearing.rotation.x = Math.PI / 2;
  shaftBearing.position.set(0, bearingCenterY, 0);
  shaftBearing.userData.role = 'fixed-annular-bearing-for-upright-input-shaft';

  const baseRail = makeBeam(
    new THREE.Vector3(-1.25, baseY, frameZ),
    new THREE.Vector3(3.46, baseY, frameZ),
    { thickness: 0.18, depth: 0.28, color: PALETTE.frame },
  );
  baseRail.userData.role = 'fixed-base-of-inclined-disk-demonstrator';

  const framePost = makeBeam(
    new THREE.Vector3(framePostX, baseY, frameZ),
    new THREE.Vector3(framePostX, frameTopY, frameZ),
    { thickness: 0.18, depth: 0.27, color: PALETTE.frame },
  );
  framePost.userData.role = 'fixed-side-post-supporting-both-upright-guides';

  const shaftBearingBrackets = [-1, 1].map((signZ) => {
    const bracket = makeBeam(
      new THREE.Vector3(
        framePostX,
        bearingCenterY,
        frameZ + signZ * 0.13,
      ),
      new THREE.Vector3(
        bearingOuterRadius,
        bearingCenterY,
        signZ * bearingOuterRadius * 0.55,
      ),
      { thickness: 0.13, depth: 0.2, color: PALETTE.frame },
    );
    bracket.userData.role = 'fixed-bracket-supporting-upright-shaft-bearing';
    return bracket;
  });

  const followerGuideBrackets = [-1, 1].map((signZ) => {
    const bracket = makeBeam(
      new THREE.Vector3(
        framePostX,
        guideCenterY,
        frameZ + signZ * 0.13,
      ),
      new THREE.Vector3(
        followerRadius + guideOuterRadius,
        guideCenterY,
        signZ * guideOuterRadius * 0.55,
      ),
      { thickness: 0.13, depth: 0.2, color: PALETTE.frame },
    );
    bracket.userData.role = 'fixed-bracket-supporting-follower-guide';
    return bracket;
  });

  root.add(
    baseRail,
    framePost,
    ...shaftBearingBrackets,
    ...followerGuideBrackets,
    shaftBearing,
    followerGuide,
    input,
    follower,
  );

  const stateAtDriverAngle = (driverAngle) => {
    const cosine = Math.cos(driverAngle);
    const sine = Math.sin(driverAngle);
    const diskNormal = new THREE.Vector3(
      -Math.sin(diskTiltAngle) * cosine,
      Math.cos(diskTiltAngle),
      Math.sin(diskTiltAngle) * sine,
    );
    const outputDisplacement = liftAmplitude * cosine;
    const shoeCenterY = followerMidpointY + outputDisplacement;
    const shoeCenter = new THREE.Vector3(
      diskCenter.x + followerRadius,
      shoeCenterY,
      diskCenter.z,
    );
    const contactPoint = shoeCenter.clone()
      .addScaledVector(diskNormal, -contactShoeRadius);
    const diskLocalContactPoint = contactPoint.clone()
      .sub(diskCenter)
      .applyAxisAngle(Y_AXIS, -driverAngle)
      .applyAxisAngle(Z_AXIS, -diskTiltAngle);
    const surfaceRadialDistance = Math.hypot(
      diskLocalContactPoint.x,
      diskLocalContactPoint.z,
    );
    const outputVelocity = new THREE.Vector3(
      0,
      -liftAmplitude * sine * inputAngularSpeed,
      0,
    );
    const outputAcceleration = new THREE.Vector3(
      0,
      -liftAmplitude * cosine * inputAngularSpeed ** 2,
      0,
    );
    const diskSurfaceVelocity = new THREE.Vector3().crossVectors(
      Y_AXIS,
      contactPoint.clone().sub(diskCenter),
    ).multiplyScalar(inputAngularSpeed);
    const relativeContactVelocity = outputVelocity.clone()
      .sub(diskSurfaceVelocity);
    const normalizedDriverAngle = THREE.MathUtils.euclideanModulo(
      driverAngle,
      fullTurn,
    );
    const atDeadCenter = Math.abs(sine) < 1e-10;
    const stage = atDeadCenter && cosine > 0
      ? 'upper-dead-center'
      : atDeadCenter && cosine < 0
        ? 'lower-dead-center'
        : outputVelocity.y > 0
          ? 'follower-rising'
          : 'follower-descending';
    return {
      contactNormal: diskNormal.clone(),
      contactPlaneError: Math.abs(
        diskNormal.dot(contactPoint.clone().sub(diskCenter))
          - diskSurfaceOffset,
      ),
      contactPoint,
      diskLocalContactPoint,
      diskNormal,
      diskSurfaceVelocity,
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      followerAngularSpeed: 0,
      followerGuideError: Math.hypot(
        shoeCenter.x - diskCenter.x - followerRadius,
        shoeCenter.z - diskCenter.z,
      ),
      followerPosition: new THREE.Vector3(
        shoeCenter.x,
        shoeCenter.y,
        shoeCenter.z,
      ),
      inputRevolutions: (driverAngle - sourcePoseAngle) / fullTurn,
      normalVelocityError: Math.abs(relativeContactVelocity.dot(diskNormal)),
      normalizedDriverAngle,
      outputAcceleration,
      outputDisplacement,
      outputVelocity,
      relativeContactVelocity,
      shoeCenter,
      shoeSurfaceGap: Math.abs(
        diskNormal.dot(shoeCenter.clone().sub(diskCenter))
          - diskSurfaceOffset - contactShoeRadius,
      ),
      stage,
      surfaceRadialClearance: diskRadius - surfaceRadialDistance,
      surfaceRadialDistance,
    };
  };
  const stateAtTime = (time) => stateAtDriverAngle(
    sourcePoseAngle + inputAngularSpeed * time,
  );

  root.userData.mechanism = 'upright-shaft-inclined-disk-vertical-follower';
  root.userData.blocks = {
    baseRail,
    contactShoe,
    diskBody,
    diskRim,
    diskRotationIndex,
    diskTiltGroup,
    follower,
    followerGuide,
    followerGuideBrackets,
    followerRod,
    forkArms,
    forkBridge,
    forkPivot,
    framePost,
    hub,
    input,
    inputShaft,
    shaftBearing,
    shaftBearingBrackets,
    shaftRotationIndex,
    translationIndex,
  };
  root.userData.geometry = {
    axis: Y_AXIS.clone(),
    baseY,
    bearingCenterY,
    bearingInnerRadius,
    bearingLength,
    bearingOuterRadius,
    contactShoeRadius,
    cyclePeriod,
    diskCenter: diskCenter.clone(),
    diskDepth,
    diskRadius,
    diskRimTubeRadius,
    diskSurfaceOffset,
    diskTiltAngle,
    followerMidpointY,
    followerRadius,
    forkArmDepth,
    forkArmHeight,
    forkArmWidth,
    forkHalfSpacing,
    forkPivotY,
    framePostX,
    frameTopY,
    frameZ,
    fullTurn,
    guideCenterY,
    guideInnerRadius,
    guideLength,
    guideOuterRadius,
    guideRunningClearance,
    hubCenterY,
    hubHeight,
    inputAngularSpeed,
    inputSpeedMagnitude,
    liftAmplitude,
    outputMaximumY,
    outputMinimumY,
    outputStroke,
    rodBottomOffset,
    rodCenterOffset,
    rodLength,
    rodRadius,
    shaftCenterY,
    shaftLength,
    shaftRadius,
    sourceFollowerRadiusRatio,
    sourcePoseAngle,
    sourceProjectedDiskSlope,
  };
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.y = state.driverAngle;
    input.userData.angularSpeed = state.driverAngularSpeed;
    follower.position.copy(state.followerPosition);
    follower.rotation.set(0, 0, 0);
    follower.userData.angularSpeed = 0;
    follower.userData.velocity = state.outputVelocity.clone();
    root.userData.contacts = {
      diskShoe: {
        contactNormal: state.contactNormal.clone(),
        contactPlaneError: state.contactPlaneError,
        contactPoint: state.contactPoint.clone(),
        normalVelocityError: state.normalVelocityError,
        shoeCenter: state.shoeCenter.clone(),
        shoeSurfaceGap: state.shoeSurfaceGap,
        surfaceRadialClearance: state.surfaceRadialClearance,
      },
      followerGuide: {
        axis: Y_AXIS.clone(),
        centerlineError: state.followerGuideError,
        radialClearance: guideRunningClearance,
        rotationError: 0,
      },
      shaftBearing: {
        axis: Y_AXIS.clone(),
        radialClearance: bearingInnerRadius - shaftRadius,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(7.2, 4.9, 9.8));
}

function endlessGrooveVibratingArmMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.58;
  const sourceDiskRadius = 5;
  const sourcePivotDistance = 7.75;
  const sourceCrankRadius = 3.1;
  const sourceGrooveCapRadius = 1.55;
  const sourceGrooveStraightHalfLength = sourceCrankRadius
    - sourceGrooveCapRadius;
  const sourceCrankPinRadius = 0.23;
  const sourceGrooveRunningClearance = 0.035;
  const sourceArmWallThickness = 0.62;
  const sourceDiskHubRadius = 0.78;
  const sourceDiskShaftRadius = 0.42;
  const sourcePivotHubRadius = 0.82;
  const sourcePivotShaftRadius = 0.48;

  const diskRadius = sourceDiskRadius * sourceScale;
  const pivotDistance = sourcePivotDistance * sourceScale;
  const crankRadius = sourceCrankRadius * sourceScale;
  const grooveCapRadius = sourceGrooveCapRadius * sourceScale;
  const grooveStraightHalfLength = sourceGrooveStraightHalfLength
    * sourceScale;
  const crankPinRadius = sourceCrankPinRadius * sourceScale;
  const grooveRunningClearance = sourceGrooveRunningClearance * sourceScale;
  const grooveHalfWidth = crankPinRadius + grooveRunningClearance;
  const armWallThickness = sourceArmWallThickness * sourceScale;
  const diskHubRadius = sourceDiskHubRadius * sourceScale;
  const diskShaftRadius = sourceDiskShaftRadius * sourceScale;
  const pivotHubRadius = sourcePivotHubRadius * sourceScale;
  const pivotShaftRadius = sourcePivotShaftRadius * sourceScale;
  const grooveOuterRadius = grooveCapRadius + grooveHalfWidth;
  const grooveInnerRadius = grooveCapRadius - grooveHalfWidth;
  const armOuterRadius = grooveOuterRadius + armWallThickness;

  const inputSpeedMagnitude = 0.72;
  const inputAngularSpeed = -inputSpeedMagnitude;
  const cyclePeriod = fullTurn / inputSpeedMagnitude;
  const sourcePoseAngle = -1.42;
  const shaftCenter = new THREE.Vector3(-1.2, 0.65, 0);
  const pivotCenter = new THREE.Vector3(
    shaftCenter.x + pivotDistance,
    shaftCenter.y,
    0,
  );

  const diskDepth = 0.34;
  const diskCenterZ = -0.34;
  const diskFrontZ = diskCenterZ + diskDepth / 2;
  const diskShaftLength = 1.56;
  const diskShaftCenterZ = -0.58;
  const crankArmDepth = 0.15;
  const crankArmZ = -0.075;
  const crankPinLength = 1.08;
  const crankPinCenterZ = 0.3;
  const grooveFloorDepth = 0.16;
  const grooveFloorCenterZ = 0.13;
  const grooveFloorFrontZ = grooveFloorCenterZ + grooveFloorDepth / 2;
  const grooveLandDepth = 0.18;
  const grooveLandCenterZ = 0.31;
  const grooveLandFrontZ = grooveLandCenterZ + grooveLandDepth / 2;
  const outlineDepth = 0.025;
  const outlineThickness = 0.035;
  const pivotHubDepth = 0.56;
  const pivotHubCenterZ = 0.18;
  const pivotShaftLength = 1.44;
  const pivotShaftCenterZ = -0.16;
  const neckJoinX = -pivotDistance
    + grooveStraightHalfLength
    + armOuterRadius
    - 0.09;
  const neckHalfWidthAtPivot = 0.31;
  const neckHalfWidthAtBody = 0.58;
  const baseY = shaftCenter.y - diskRadius - 0.44;
  const frameZ = -0.82;
  const frameLeftX = shaftCenter.x - diskRadius - 0.34;
  const frameRightX = pivotCenter.x + 0.64;

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
  const grooveMaterial = matte(0x244658, {
    metalness: 0.11,
    roughness: 0.72,
  });
  const pinMaterial = matte(PALETTE.brass, {
    metalness: 0.28,
    roughness: 0.45,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const input = planarRotor();
  input.position.copy(shaftCenter);
  input.userData.role = 'continuous-disk-with-one-fixed-eccentric-crank-pin';
  const inputRotor = input.userData.rotor;

  const diskBody = cylinderAlongZ(
    diskRadius,
    diskDepth,
    driverMaterial,
    96,
  );
  diskBody.position.z = diskCenterZ;
  diskBody.userData.role = 'source-proportioned-circular-driver-disk';
  inputRotor.add(diskBody);

  const diskOuterRim = new THREE.Mesh(
    new THREE.TorusGeometry(diskRadius - 0.04, 0.05, 10, 96),
    darkMaterial,
  );
  diskOuterRim.position.z = diskFrontZ + 0.018;
  diskOuterRim.userData.role = 'front-outline-of-circular-driver-disk';
  inputRotor.add(diskOuterRim);

  const diskShaft = cylinderAlongZ(
    diskShaftRadius,
    diskShaftLength,
    darkMaterial,
    48,
  );
  diskShaft.position.z = diskShaftCenterZ;
  diskShaft.userData.role = 'input-shaft-through-circular-disk';
  inputRotor.add(diskShaft);

  const diskHub = cylinderAlongZ(
    diskHubRadius,
    diskDepth + 0.18,
    darkMaterial,
    48,
  );
  diskHub.position.z = diskCenterZ + 0.035;
  diskHub.userData.role = 'central-hub-of-circular-driver-disk';
  inputRotor.add(diskHub);

  const diskHubFace = cylinderAlongZ(
    diskShaftRadius,
    0.05,
    driverMaterial,
    40,
  );
  diskHubFace.position.z = diskFrontZ + 0.105;
  diskHubFace.userData.role = 'visible-center-face-of-driver-hub';
  inputRotor.add(diskHubFace);

  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.15, crankArmDepth),
    darkMaterial,
  );
  crankArm.position.set(crankRadius / 2, 0, crankArmZ);
  crankArm.userData.role = 'single-rigid-radius-from-disk-center-to-crank-pin';
  inputRotor.add(crankArm);

  const crankPin = cylinderAlongZ(
    crankPinRadius,
    crankPinLength,
    pinMaterial,
    48,
  );
  crankPin.position.set(crankRadius, 0, crankPinCenterZ);
  crankPin.userData.role = 'single-fixed-crank-pin-sliding-around-endless-groove';
  inputRotor.add(crankPin);

  const crankPinIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      crankPinRadius * 0.58,
      crankPinRadius * 0.58,
      0.03,
    ),
    indexMaterial,
  );
  crankPinIndex.position.set(
    crankRadius + crankPinRadius * 0.34,
    0,
    crankPinCenterZ + crankPinLength / 2 + 0.012,
  );
  crankPinIndex.userData.role = 'index-showing-crank-pin-is-fixed-not-free-rolling';
  inputRotor.add(crankPinIndex);

  const diskRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(diskRadius * 0.48, 0.085, 0.032),
    indexMaterial,
  );
  diskRotationIndex.position.set(
    diskRadius * 0.69,
    0,
    diskFrontZ + 0.052,
  );
  diskRotationIndex.userData.role = 'visible-angular-index-on-driver-disk';
  inputRotor.add(diskRotationIndex);

  const rocker = new THREE.Group();
  rocker.position.copy(pivotCenter);
  rocker.userData.role = 'one-pivoted-arm-with-one-recessed-endless-groove';

  const grooveFloor = new THREE.Mesh(
    centeredExtrusion(
      horizontalCapsuleShape(
        armOuterRadius,
        grooveStraightHalfLength,
      ),
      grooveFloorDepth,
      0.008,
    ),
    grooveMaterial,
  );
  grooveFloor.position.set(
    -pivotDistance,
    0,
    grooveFloorCenterZ,
  );
  grooveFloor.userData.role = 'solid-backplate-floor-beneath-one-endless-groove';
  rocker.add(grooveFloor);

  const outerLand = new THREE.Mesh(
    centeredExtrusion(
      horizontalCapsuleRingShape(
        grooveOuterRadius,
        armOuterRadius,
        grooveStraightHalfLength,
      ),
      grooveLandDepth,
      0.008,
    ),
    drivenMaterial,
  );
  outerLand.position.set(-pivotDistance, 0, grooveLandCenterZ);
  outerLand.userData.role = 'raised-outer-land-around-one-closed-groove';
  rocker.add(outerLand);

  const centralIsland = new THREE.Mesh(
    centeredExtrusion(
      horizontalCapsuleShape(
        grooveInnerRadius,
        grooveStraightHalfLength,
      ),
      grooveLandDepth,
      0.008,
    ),
    drivenMaterial,
  );
  centralIsland.position.set(-pivotDistance, 0, grooveLandCenterZ);
  centralIsland.userData.role = 'raised-central-island-backed-by-the-same-arm';
  rocker.add(centralIsland);

  const outerBodyOutline = new THREE.Mesh(
    centeredExtrusion(
      horizontalCapsuleRingShape(
        armOuterRadius - outlineThickness,
        armOuterRadius,
        grooveStraightHalfLength,
      ),
      outlineDepth,
      0.002,
    ),
    darkMaterial,
  );
  outerBodyOutline.position.set(
    -pivotDistance,
    0,
    grooveLandFrontZ + outlineDepth / 2,
  );
  outerBodyOutline.userData.role = 'front-outline-of-vibrating-arm-body';
  rocker.add(outerBodyOutline);

  const outerGrooveWall = new THREE.Mesh(
    centeredExtrusion(
      horizontalCapsuleRingShape(
        grooveOuterRadius,
        grooveOuterRadius + outlineThickness,
        grooveStraightHalfLength,
      ),
      outlineDepth,
      0.002,
    ),
    darkMaterial,
  );
  outerGrooveWall.position.set(
    -pivotDistance,
    0,
    grooveLandFrontZ + outlineDepth / 2,
  );
  outerGrooveWall.userData.role = 'outer-wall-outline-of-the-single-endless-groove';
  rocker.add(outerGrooveWall);

  const innerGrooveWall = new THREE.Mesh(
    centeredExtrusion(
      horizontalCapsuleRingShape(
        grooveInnerRadius - outlineThickness,
        grooveInnerRadius,
        grooveStraightHalfLength,
      ),
      outlineDepth,
      0.002,
    ),
    darkMaterial,
  );
  innerGrooveWall.position.set(
    -pivotDistance,
    0,
    grooveLandFrontZ + outlineDepth / 2,
  );
  innerGrooveWall.userData.role = 'inner-wall-outline-of-the-single-endless-groove';
  rocker.add(innerGrooveWall);

  const neckShape = new THREE.Shape();
  neckShape.moveTo(-pivotHubRadius * 0.42, neckHalfWidthAtPivot);
  neckShape.lineTo(neckJoinX, neckHalfWidthAtBody);
  neckShape.lineTo(neckJoinX, -neckHalfWidthAtBody);
  neckShape.lineTo(-pivotHubRadius * 0.42, -neckHalfWidthAtPivot);
  neckShape.closePath();

  const neckBackplate = new THREE.Mesh(
    centeredExtrusion(neckShape, grooveFloorDepth, 0.008),
    grooveMaterial,
  );
  neckBackplate.position.z = grooveFloorCenterZ;
  neckBackplate.userData.role = 'rigid-backplate-neck-from-groove-to-pivot';
  rocker.add(neckBackplate);

  const neckFace = new THREE.Mesh(
    centeredExtrusion(neckShape, grooveLandDepth, 0.008),
    drivenMaterial,
  );
  neckFace.position.z = grooveLandCenterZ;
  neckFace.userData.role = 'rigid-raised-neck-from-groove-to-pivot';
  rocker.add(neckFace);

  const pivotHub = cylinderAlongZ(
    pivotHubRadius,
    pivotHubDepth,
    drivenMaterial,
    48,
  );
  pivotHub.position.z = pivotHubCenterZ;
  pivotHub.userData.role = 'rocker-eye-turning-about-fixed-right-hand-pivot';
  rocker.add(pivotHub);

  const pivotHubOutline = new THREE.Mesh(
    new THREE.TorusGeometry(
      pivotHubRadius - 0.035,
      0.04,
      10,
      48,
    ),
    darkMaterial,
  );
  pivotHubOutline.position.z = pivotHubCenterZ + pivotHubDepth / 2 + 0.012;
  pivotHubOutline.userData.role = 'front-outline-of-rocker-pivot-eye';
  rocker.add(pivotHubOutline);

  const rockerIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.34, 0.032),
    indexMaterial,
  );
  rockerIndex.position.set(
    neckJoinX * 0.46,
    0,
    grooveLandFrontZ + 0.04,
  );
  rockerIndex.userData.role = 'visible-index-on-the-vibrating-arm';
  rocker.add(rockerIndex);

  const pivotShaft = cylinderAlongZ(
    pivotShaftRadius,
    pivotShaftLength,
    darkMaterial,
    48,
  );
  pivotShaft.position.set(
    pivotCenter.x,
    pivotCenter.y,
    pivotShaftCenterZ,
  );
  pivotShaft.userData.role = 'fixed-right-hand-rocker-pivot-shaft';

  const baseRail = makeBeam(
    new THREE.Vector3(frameLeftX, baseY, frameZ),
    new THREE.Vector3(frameRightX, baseY, frameZ),
    { thickness: 0.17, depth: 0.24, color: PALETTE.frame },
  );
  baseRail.userData.role = 'fixed-base-supporting-both-parallel-shafts';

  const bearingCenters = [shaftCenter, pivotCenter];
  const framePosts = bearingCenters.map((center, index) => {
    const post = makeBeam(
      new THREE.Vector3(center.x, baseY, frameZ),
      new THREE.Vector3(center.x, center.y, frameZ),
      { thickness: 0.16, depth: 0.24, color: PALETTE.frame },
    );
    post.userData.role = index === 0
      ? 'fixed-post-supporting-driver-shaft'
      : 'fixed-post-supporting-rocker-pivot';
    return post;
  });

  const frameBraces = bearingCenters.map((center, index) => {
    const baseX = index === 0
      ? center.x - diskRadius * 0.7
      : center.x + 0.52;
    const brace = makeBeam(
      new THREE.Vector3(baseX, baseY, frameZ),
      new THREE.Vector3(center.x, center.y - 0.08, frameZ),
      { thickness: 0.12, depth: 0.2, color: PALETTE.frame },
    );
    brace.userData.role = 'fixed-diagonal-bearing-brace';
    brace.userData.index = index;
    return brace;
  });

  const driverBearing = new THREE.Mesh(
    new THREE.TorusGeometry(diskHubRadius + 0.055, 0.072, 10, 48),
    frameMaterial,
  );
  driverBearing.position.set(shaftCenter.x, shaftCenter.y, frameZ + 0.04);
  driverBearing.userData.role = 'fixed-rear-bearing-of-driver-shaft';

  const rockerBearing = new THREE.Mesh(
    new THREE.TorusGeometry(pivotHubRadius + 0.055, 0.072, 10, 48),
    frameMaterial,
  );
  rockerBearing.position.set(pivotCenter.x, pivotCenter.y, frameZ + 0.04);
  rockerBearing.userData.role = 'fixed-rear-bearing-of-rocker-pivot';

  root.add(
    baseRail,
    ...framePosts,
    ...frameBraces,
    driverBearing,
    rockerBearing,
    pivotShaft,
    input,
    rocker,
  );

  const clampUnit = (value) => Math.max(-1, Math.min(1, value));
  const angleDifference = (angleA, angleB) => Math.atan2(
    Math.sin(angleA - angleB),
    Math.cos(angleA - angleB),
  );
  const rightCapCenterDistance = pivotDistance - grooveStraightHalfLength;
  const leftCapCenterDistance = pivotDistance + grooveStraightHalfLength;
  const rightShoulderRadius = Math.hypot(
    rightCapCenterDistance,
    grooveCapRadius,
  );
  const leftShoulderRadius = Math.hypot(
    leftCapCenterDistance,
    grooveCapRadius,
  );
  const minimumPinPivotRadius = pivotDistance - crankRadius;
  const maximumPinPivotRadius = pivotDistance + crankRadius;
  const grooveHalfPerimeter = 2 * grooveStraightHalfLength
    + Math.PI * grooveCapRadius;
  const groovePerimeter = grooveHalfPerimeter * 2;

  const configurationAtDriverAngle = (driverAngle) => {
    const normalizedDriverAngle = THREE.MathUtils.euclideanModulo(
      driverAngle,
      fullTurn,
    );
    const cosine = Math.cos(driverAngle);
    const sine = Math.sin(driverAngle);
    const crankPoint = new THREE.Vector3(
      shaftCenter.x + crankRadius * cosine,
      shaftCenter.y + crankRadius * sine,
      crankPinCenterZ,
    );
    const pinFromPivot = new THREE.Vector2(
      crankPoint.x - pivotCenter.x,
      crankPoint.y - pivotCenter.y,
    );
    const pinPivotRadius = pinFromPivot.length();
    const branchSign = normalizedDriverAngle <= Math.PI ? 1 : -1;
    let grooveX;
    let grooveY;
    let normalX;
    let normalY;
    let grooveRegion;
    let branchProgress;

    if (pinPivotRadius <= rightShoulderRadius) {
      const cosineAlpha = clampUnit((
        rightCapCenterDistance ** 2
        + grooveCapRadius ** 2
        - pinPivotRadius ** 2
      ) / (2 * grooveCapRadius * rightCapCenterDistance));
      const alpha = Math.acos(cosineAlpha);
      grooveX = -rightCapCenterDistance
        + grooveCapRadius * Math.cos(alpha);
      grooveY = branchSign * grooveCapRadius * Math.sin(alpha);
      normalX = Math.cos(alpha);
      normalY = branchSign * Math.sin(alpha);
      grooveRegion = 'right-rounded-return';
      branchProgress = grooveCapRadius * alpha;
    } else if (pinPivotRadius < leftShoulderRadius) {
      grooveX = -Math.sqrt(Math.max(
        0,
        pinPivotRadius ** 2 - grooveCapRadius ** 2,
      ));
      grooveY = branchSign * grooveCapRadius;
      normalX = 0;
      normalY = branchSign;
      grooveRegion = 'straight-traverse';
      branchProgress = Math.PI / 2 * grooveCapRadius
        + (-rightCapCenterDistance - grooveX);
    } else {
      const cosineAlpha = clampUnit((
        leftCapCenterDistance ** 2
        + grooveCapRadius ** 2
        - pinPivotRadius ** 2
      ) / (2 * grooveCapRadius * leftCapCenterDistance));
      const alpha = Math.acos(cosineAlpha);
      grooveX = -leftCapCenterDistance
        + grooveCapRadius * Math.cos(alpha);
      grooveY = branchSign * grooveCapRadius * Math.sin(alpha);
      normalX = Math.cos(alpha);
      normalY = branchSign * Math.sin(alpha);
      grooveRegion = 'left-rounded-return';
      branchProgress = Math.PI / 2 * grooveCapRadius
        + 2 * grooveStraightHalfLength
        + grooveCapRadius * (alpha - Math.PI / 2);
    }

    if (branchSign < 0) branchProgress = grooveHalfPerimeter - branchProgress;
    const grooveProgress = branchSign > 0
      ? branchProgress
      : grooveHalfPerimeter + branchProgress;
    const groovePointLocal = new THREE.Vector2(grooveX, grooveY);
    const grooveNormalLocal = new THREE.Vector2(normalX, normalY).normalize();
    const grooveTangentLocal = new THREE.Vector2(
      -grooveNormalLocal.y,
      grooveNormalLocal.x,
    );
    const worldPolarAngle = Math.atan2(pinFromPivot.y, pinFromPivot.x);
    const localPolarAngle = Math.atan2(grooveY, grooveX);
    const armAngle = angleDifference(worldPolarAngle, localPolarAngle);
    const armCosine = Math.cos(armAngle);
    const armSine = Math.sin(armAngle);
    const reconstructedCrankPoint = new THREE.Vector3(
      pivotCenter.x + armCosine * grooveX - armSine * grooveY,
      pivotCenter.y + armSine * grooveX + armCosine * grooveY,
      crankPinCenterZ,
    );
    const nearestSegmentX = THREE.MathUtils.clamp(
      grooveX + pivotDistance,
      -grooveStraightHalfLength,
      grooveStraightHalfLength,
    );
    const capsuleDistance = Math.hypot(
      grooveX + pivotDistance - nearestSegmentX,
      grooveY,
    );
    return {
      armAngle,
      branch: branchSign > 0 ? 'upper' : 'lower',
      crankPoint,
      driverAngle,
      grooveCenterlineError: capsuleDistance - grooveCapRadius,
      grooveNormalLocal,
      groovePointLocal,
      grooveProgress,
      grooveRegion,
      grooveTangentLocal,
      normalizedDriverAngle,
      pinFromPivot,
      pinPivotRadius,
      reconstructedCrankPoint,
      reconstructionError: reconstructedCrankPoint.distanceTo(crankPoint),
    };
  };

  const derivativeStep = 0.00002;
  const rotateLocalVector = (vector, angle) => {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return new THREE.Vector2(
      cosine * vector.x - sine * vector.y,
      sine * vector.x + cosine * vector.y,
    );
  };
  const localPointToWorld = (point, armAngle, z = crankPinCenterZ) => {
    const rotated = rotateLocalVector(point, armAngle);
    return new THREE.Vector3(
      pivotCenter.x + rotated.x,
      pivotCenter.y + rotated.y,
      z,
    );
  };

  const stateAtDriverAngle = (driverAngle) => {
    const configuration = configurationAtDriverAngle(driverAngle);
    const before = configurationAtDriverAngle(driverAngle - derivativeStep);
    const after = configurationAtDriverAngle(driverAngle + derivativeStep);
    const finiteArmAngleDerivative = angleDifference(
      after.armAngle,
      before.armAngle,
    ) / (2 * derivativeStep);
    const driverPointDerivativeWorld = new THREE.Vector2(
      -crankRadius * Math.sin(driverAngle),
      crankRadius * Math.cos(driverAngle),
    );
    const driverPointDerivativeLocal = rotateLocalVector(
      driverPointDerivativeWorld,
      -configuration.armAngle,
    );
    const rotatedGroovePoint = new THREE.Vector2(
      -configuration.groovePointLocal.y,
      configuration.groovePointLocal.x,
    );
    const derivativeDenominator = configuration.grooveNormalLocal.dot(
      rotatedGroovePoint,
    );
    const armAngleDerivative = Math.abs(derivativeDenominator) > 0.000001
      ? configuration.grooveNormalLocal.dot(driverPointDerivativeLocal)
        / derivativeDenominator
      : finiteArmAngleDerivative;
    const armAngleSecondDerivative = (
      angleDifference(after.armAngle, configuration.armAngle)
      - angleDifference(configuration.armAngle, before.armAngle)
    ) / derivativeStep ** 2;
    const armAngularSpeed = armAngleDerivative * inputAngularSpeed;
    const armAngularAcceleration = armAngleSecondDerivative
      * inputAngularSpeed ** 2;
    const cosine = Math.cos(driverAngle);
    const sine = Math.sin(driverAngle);
    const crankPinVelocity = new THREE.Vector3(
      -crankRadius * sine * inputAngularSpeed,
      crankRadius * cosine * inputAngularSpeed,
      0,
    );
    const crankPinAcceleration = new THREE.Vector3(
      -crankRadius * cosine * inputAngularSpeed ** 2,
      -crankRadius * sine * inputAngularSpeed ** 2,
      0,
    );
    const armPointVelocity = new THREE.Vector3(
      -armAngularSpeed * configuration.pinFromPivot.y,
      armAngularSpeed * configuration.pinFromPivot.x,
      0,
    );
    const relativeVelocityWorld = crankPinVelocity.clone().sub(
      armPointVelocity,
    );
    const armCosine = Math.cos(configuration.armAngle);
    const armSine = Math.sin(configuration.armAngle);
    const relativeVelocityLocal = new THREE.Vector2(
      armCosine * relativeVelocityWorld.x
        + armSine * relativeVelocityWorld.y,
      -armSine * relativeVelocityWorld.x
        + armCosine * relativeVelocityWorld.y,
    );
    const grooveNormalVelocity = relativeVelocityLocal.dot(
      configuration.grooveNormalLocal,
    );
    const centerlineSlidingSpeed = relativeVelocityLocal.dot(
      configuration.grooveTangentLocal,
    );
    const normalWorld = rotateLocalVector(
      configuration.grooveNormalLocal,
      configuration.armAngle,
    );
    const tangentWorld = rotateLocalVector(
      configuration.grooveTangentLocal,
      configuration.armAngle,
    );
    const wallContacts = [
      { name: 'outer', sign: 1 },
      { name: 'inner', sign: -1 },
    ].map(({ name, sign }) => {
      const pinSurfaceLocal = configuration.groovePointLocal.clone()
        .addScaledVector(configuration.grooveNormalLocal, sign * crankPinRadius);
      const wallPointLocal = configuration.groovePointLocal.clone()
        .addScaledVector(configuration.grooveNormalLocal, sign * grooveHalfWidth);
      const pinSurfaceOffsetWorld = rotateLocalVector(
        configuration.grooveNormalLocal.clone().multiplyScalar(
          sign * crankPinRadius,
        ),
        configuration.armAngle,
      );
      const pinSurfaceVelocity = crankPinVelocity.clone().add(
        new THREE.Vector3(
          -inputAngularSpeed * pinSurfaceOffsetWorld.y,
          inputAngularSpeed * pinSurfaceOffsetWorld.x,
          0,
        ),
      );
      const wallFromPivotWorld = rotateLocalVector(
        wallPointLocal,
        configuration.armAngle,
      );
      const wallVelocity = new THREE.Vector3(
        -armAngularSpeed * wallFromPivotWorld.y,
        armAngularSpeed * wallFromPivotWorld.x,
        0,
      );
      const surfaceRelativeVelocity = pinSurfaceVelocity.clone().sub(
        wallVelocity,
      );
      return {
        name,
        normalVelocityError: surfaceRelativeVelocity.x * normalWorld.x
          + surfaceRelativeVelocity.y * normalWorld.y,
        pinSurfacePoint: localPointToWorld(
          pinSurfaceLocal,
          configuration.armAngle,
        ),
        surfaceGap: grooveHalfWidth - crankPinRadius,
        surfaceSlipSpeed: surfaceRelativeVelocity.x * tangentWorld.x
          + surfaceRelativeVelocity.y * tangentWorld.y,
        wallPoint: localPointToWorld(
          wallPointLocal,
          configuration.armAngle,
        ),
      };
    });
    const outputReferenceLocal = new THREE.Vector2(neckJoinX * 0.46, 0);
    const outputReferencePoint = localPointToWorld(
      outputReferenceLocal,
      configuration.armAngle,
      grooveLandFrontZ,
    );
    return {
      ...configuration,
      armAngleDerivative,
      armAngleSecondDerivative,
      armAngularAcceleration,
      armAngularSpeed,
      centerlineSlidingSpeed,
      crankPinAcceleration,
      crankPinAngularSpeed: inputAngularSpeed,
      crankPinVelocity,
      driverAngularSpeed: inputAngularSpeed,
      grooveNormalVelocity,
      inputRevolutions: (driverAngle - sourcePoseAngle) / fullTurn,
      innerWallClearance: grooveRunningClearance,
      outerWallClearance: grooveRunningClearance,
      outputReferencePoint,
      relativeVelocityLocal,
      relativeVelocityWorld,
      stage: `${configuration.branch}-${configuration.grooveRegion}`,
      wallContacts,
    };
  };
  const stateAtTime = (time) => stateAtDriverAngle(
    sourcePoseAngle + inputAngularSpeed * time,
  );

  const rightShoulderAngle = Math.acos(clampUnit((
    pivotDistance ** 2
    + crankRadius ** 2
    - rightShoulderRadius ** 2
  ) / (2 * pivotDistance * crankRadius)));
  const leftShoulderAngle = Math.acos(clampUnit((
    pivotDistance ** 2
    + crankRadius ** 2
    - leftShoulderRadius ** 2
  ) / (2 * pivotDistance * crankRadius)));
  let outputMinimumAngle = Infinity;
  let outputMaximumAngle = -Infinity;
  let outputMinimumDriverAngle = 0;
  let outputMaximumDriverAngle = 0;
  for (let sample = 0; sample <= 4096; sample += 1) {
    const driverAngle = sample / 4096 * fullTurn;
    const armAngle = configurationAtDriverAngle(driverAngle).armAngle;
    if (armAngle < outputMinimumAngle) {
      outputMinimumAngle = armAngle;
      outputMinimumDriverAngle = driverAngle;
    }
    if (armAngle > outputMaximumAngle) {
      outputMaximumAngle = armAngle;
      outputMaximumDriverAngle = driverAngle;
    }
  }
  const outputAngularStroke = outputMaximumAngle - outputMinimumAngle;

  const grooveCenterlinePoints = horizontalCapsulePoints(
    grooveStraightHalfLength,
    grooveCapRadius,
    64,
  ).map((point) => point.add(new THREE.Vector2(-pivotDistance, 0)));
  const grooveOuterWallPoints = horizontalCapsulePoints(
    grooveStraightHalfLength,
    grooveOuterRadius,
    64,
  ).map((point) => point.add(new THREE.Vector2(-pivotDistance, 0)));
  const grooveInnerWallPoints = horizontalCapsulePoints(
    grooveStraightHalfLength,
    grooveInnerRadius,
    64,
  ).map((point) => point.add(new THREE.Vector2(-pivotDistance, 0)));

  root.userData.mechanism = 'fixed-crank-pin-in-endless-groove-vibrating-arm';
  root.userData.blocks = {
    baseRail,
    centralIsland,
    crankArm,
    crankPin,
    crankPinIndex,
    diskBody,
    diskHub,
    diskHubFace,
    diskOuterRim,
    diskRotationIndex,
    diskShaft,
    driverBearing,
    frameBraces,
    framePosts,
    grooveFloor,
    innerGrooveWall,
    input,
    neckBackplate,
    neckFace,
    outerBodyOutline,
    outerGrooveWall,
    outerLand,
    pivotHub,
    pivotHubOutline,
    pivotShaft,
    rocker,
    rockerBearing,
    rockerIndex,
  };
  root.userData.geometry = {
    armOuterRadius,
    armWallThickness,
    axis: Z_AXIS.clone(),
    baseY,
    crankArmDepth,
    crankArmZ,
    crankPinCenterZ,
    crankPinLength,
    crankPinRadius,
    crankRadius,
    cyclePeriod,
    diskCenterZ,
    diskDepth,
    diskFrontZ,
    diskHubRadius,
    diskRadius,
    diskShaftCenterZ,
    diskShaftLength,
    diskShaftRadius,
    frameLeftX,
    frameRightX,
    frameZ,
    fullTurn,
    grooveCapRadius,
    grooveFloorCenterZ,
    grooveFloorDepth,
    grooveFloorFrontZ,
    grooveHalfPerimeter,
    grooveHalfWidth,
    grooveInnerRadius,
    grooveLandCenterZ,
    grooveLandDepth,
    grooveLandFrontZ,
    grooveOuterRadius,
    groovePerimeter,
    grooveRunningClearance,
    grooveStraightHalfLength,
    inputAngularSpeed,
    inputSpeedMagnitude,
    leftCapCenterDistance,
    leftShoulderAngle,
    leftShoulderRadius,
    maximumPinPivotRadius,
    minimumPinPivotRadius,
    neckHalfWidthAtBody,
    neckHalfWidthAtPivot,
    neckJoinX,
    outlineDepth,
    outlineThickness,
    outputAngularStroke,
    outputMaximumAngle,
    outputMaximumDriverAngle,
    outputMinimumAngle,
    outputMinimumDriverAngle,
    pivotCenter: pivotCenter.clone(),
    pivotDistance,
    pivotHubCenterZ,
    pivotHubDepth,
    pivotHubRadius,
    pivotShaftCenterZ,
    pivotShaftLength,
    pivotShaftRadius,
    rightCapCenterDistance,
    rightShoulderAngle,
    rightShoulderRadius,
    shaftCenter: shaftCenter.clone(),
    sourceArmWallThickness,
    sourceCrankPinRadius,
    sourceCrankRadius,
    sourceDiskHubRadius,
    sourceDiskRadius,
    sourceDiskShaftRadius,
    sourceGrooveCapRadius,
    sourceGrooveRunningClearance,
    sourceGrooveStraightHalfLength,
    sourcePivotDistance,
    sourcePivotHubRadius,
    sourcePivotShaftRadius,
    sourcePoseAngle,
    sourceScale,
  };
  root.userData.profiles = {
    grooveCenterlinePoints,
    grooveInnerWallPoints,
    grooveOuterWallPoints,
  };
  root.userData.configurationAtDriverAngle = configurationAtDriverAngle;
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.driverAngle;
    input.userData.angularSpeed = state.driverAngularSpeed;
    crankPin.userData.angularSpeed = state.crankPinAngularSpeed;
    rocker.rotation.set(0, 0, state.armAngle);
    rocker.userData.angularSpeed = state.armAngularSpeed;
    rocker.userData.angularAcceleration = state.armAngularAcceleration;
    root.userData.contacts = {
      crankPinGroove: {
        captive: true,
        centerlineError: state.grooveCenterlineError,
        centerlineSlidingSpeed: state.centerlineSlidingSpeed,
        closed: true,
        grooveNormalVelocity: state.grooveNormalVelocity,
        groovePoint: state.crankPoint.clone(),
        pinFixedToDisk: true,
        pinOrbitError: Math.abs(
          state.crankPoint.distanceTo(new THREE.Vector3(
            shaftCenter.x,
            shaftCenter.y,
            crankPinCenterZ,
          )) - crankRadius,
        ),
        pinPoint: state.crankPoint.clone(),
        recessed: true,
        wallContacts: state.wallContacts.map((contact) => ({
          ...contact,
          pinSurfacePoint: contact.pinSurfacePoint.clone(),
          wallPoint: contact.wallPoint.clone(),
        })),
      },
      driverShaftBearing: {
        axis: Z_AXIS.clone(),
        radialClearance: diskHubRadius + 0.055 - diskShaftRadius,
      },
      rockerPivotBearing: {
        axis: Z_AXIS.clone(),
        centerError: Math.hypot(
          rocker.position.x - pivotCenter.x,
          rocker.position.y - pivotCenter.y,
        ),
        radialClearance: pivotHubRadius - pivotShaftRadius,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(6.2, 3.7, 13.8));
}

function crankAndSlottedLeverQuickReturnMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.3;
  const sourceDriverDiskRadius = 5;
  const sourceDriverHubRadius = 2;
  const sourceDriverShaftRadius = 1.2;
  const sourceCrankRadius = 5.5;
  const sourceCrankPinRadius = 1;
  const sourcePivotDistance = 11.258724;
  const sourceSlotNearCapDistance = 5.508724;
  const sourceSlotFarCapDistance = 17.008724;
  const sourceSlotHalfWidth = 1;
  const sourceLeverBodyHalfWidth = 2;
  const sourceLeverPivotRadius = 2;
  const sourceOutputHalfWidth = 1;
  const sourceOutputLength = 10;
  const sourceOutputTipLength = 1.05;
  const sourcePinRunningClearance = 0.018;

  const driverDiskRadius = sourceDriverDiskRadius * sourceScale;
  const driverHubRadius = sourceDriverHubRadius * sourceScale;
  const driverShaftRadius = sourceDriverShaftRadius * sourceScale;
  const crankRadius = sourceCrankRadius * sourceScale;
  const nominalCrankPinRadius = sourceCrankPinRadius * sourceScale;
  const pinRunningClearance = sourcePinRunningClearance * sourceScale;
  const crankPinRadius = nominalCrankPinRadius - pinRunningClearance;
  const pivotDistance = sourcePivotDistance * sourceScale;
  const slotNearCapDistance = sourceSlotNearCapDistance * sourceScale;
  const slotFarCapDistance = sourceSlotFarCapDistance * sourceScale;
  const slotHalfWidth = sourceSlotHalfWidth * sourceScale;
  const leverBodyHalfWidth = sourceLeverBodyHalfWidth * sourceScale;
  const leverPivotRadius = sourceLeverPivotRadius * sourceScale;
  const outputHalfWidth = sourceOutputHalfWidth * sourceScale;
  const outputLength = sourceOutputLength * sourceScale;
  const outputTipLength = sourceOutputTipLength * sourceScale;

  const inputSpeedMagnitude = 0.72;
  const inputAngularSpeed = -inputSpeedMagnitude;
  const cyclePeriod = fullTurn / inputSpeedMagnitude;
  const sourcePoseAngle = Math.PI * 2 / 3;
  const shaftCenter = new THREE.Vector3(-1.7, 0.65, 0);
  const pivotCenter = new THREE.Vector3(
    shaftCenter.x + pivotDistance,
    shaftCenter.y,
    0,
  );
  const tangentCrankAngle = Math.acos(crankRadius / pivotDistance);
  const maximumArmAngle = Math.asin(crankRadius / pivotDistance);
  const minimumArmAngle = -maximumArmAngle;
  const outputAngularStroke = maximumArmAngle - minimumArmAngle;
  const quickReturnDriverSweep = tangentCrankAngle * 2;
  const cuttingDriverSweep = fullTurn - quickReturnDriverSweep;
  const quickReturnDuration = quickReturnDriverSweep / inputSpeedMagnitude;
  const cuttingDuration = cuttingDriverSweep / inputSpeedMagnitude;
  const quickReturnRatio = cuttingDuration / quickReturnDuration;
  const minimumPinPivotRadius = pivotDistance - crankRadius;
  const maximumPinPivotRadius = pivotDistance + crankRadius;

  const diskDepth = 0.36;
  const diskCenterZ = -0.46;
  const diskFrontZ = diskCenterZ + diskDepth / 2;
  const crankArmDepth = 0.17;
  const crankArmZ = -0.17;
  const driverShaftLength = 1.62;
  const driverShaftCenterZ = -0.48;
  const leverDepth = 0.22;
  const leverCenterZ = 0.12;
  const leverFrontZ = leverCenterZ + leverDepth / 2;
  const slotOutlineDepth = 0.035;
  const slotOutlineCenterZ = leverFrontZ + slotOutlineDepth / 2;
  const slotOutlineThickness = 0.038;
  const crankPinLength = 1.18;
  const crankPinCenterZ = -0.02;
  const crankPinFrontZ = crankPinCenterZ + crankPinLength / 2;
  const crankPinHubRadius = crankPinRadius * 0.34;
  const pivotHubDepth = 0.48;
  const pivotHubCenterZ = 0.12;
  const pivotShaftRadius = driverShaftRadius * 0.82;
  const pivotShaftLength = 1.48;
  const pivotShaftCenterZ = -0.33;
  const frameZ = -0.93;
  const baseY = shaftCenter.y - driverDiskRadius - 0.7;
  const frameLeftX = shaftCenter.x - driverDiskRadius - 0.35;
  const frameRightX = pivotCenter.x + 0.62;

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
  const pinMaterial = matte(PALETTE.brass, {
    metalness: 0.28,
    roughness: 0.45,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const input = planarRotor();
  input.position.copy(shaftCenter);
  input.userData.role = 'continuous-clockwise-crank-driving-one-slotted-lever';
  const inputRotor = input.userData.rotor;

  const driverDisk = cylinderAlongZ(
    driverDiskRadius,
    diskDepth,
    driverMaterial,
    96,
  );
  driverDisk.position.z = diskCenterZ;
  driverDisk.userData.role = 'source-five-radius-quick-return-driver-disk';
  inputRotor.add(driverDisk);

  const driverDiskRim = new THREE.Mesh(
    new THREE.TorusGeometry(driverDiskRadius - 0.04, 0.05, 10, 96),
    darkMaterial,
  );
  driverDiskRim.position.z = diskFrontZ + 0.018;
  driverDiskRim.userData.role = 'front-outline-of-quick-return-driver-disk';
  inputRotor.add(driverDiskRim);

  const driverShaft = cylinderAlongZ(
    driverShaftRadius,
    driverShaftLength,
    darkMaterial,
    44,
  );
  driverShaft.position.z = driverShaftCenterZ;
  driverShaft.userData.role = 'continuous-input-shaft-of-quick-return-crank';
  inputRotor.add(driverShaft);

  const driverHub = cylinderAlongZ(
    driverHubRadius,
    0.46,
    driverMaterial,
    56,
  );
  driverHub.position.z = -0.19;
  driverHub.userData.role = 'source-two-radius-input-hub';
  inputRotor.add(driverHub);

  const driverHubOutline = new THREE.Mesh(
    new THREE.TorusGeometry(driverHubRadius - 0.035, 0.04, 10, 56),
    darkMaterial,
  );
  driverHubOutline.position.z = 0.055;
  driverHubOutline.userData.role = 'front-outline-of-input-hub';
  inputRotor.add(driverHubOutline);

  const sourceCrankPinLocal = new THREE.Vector3(
    crankRadius * Math.cos(sourcePoseAngle),
    crankRadius * Math.sin(sourcePoseAngle),
    crankArmZ,
  );
  const crankArm = makeBeam(
    new THREE.Vector3(0, 0, crankArmZ),
    sourceCrankPinLocal,
    {
      thickness: 0.17,
      depth: crankArmDepth,
      color: PALETTE.driver,
    },
  );
  crankArm.userData.role = 'rigid-crank-arm-from-input-axis-to-fixed-pin';
  inputRotor.add(crankArm);

  const diskRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(driverDiskRadius * 0.38, 0.065, 0.032),
    indexMaterial,
  );
  diskRotationIndex.position.set(
    driverDiskRadius * 0.76,
    0,
    diskFrontZ + 0.055,
  );
  diskRotationIndex.userData.role = 'visible-index-on-continuous-input-disk';
  inputRotor.add(diskRotationIndex);

  const crankPin = new THREE.Group();
  crankPin.position.copy(sourceCrankPinLocal);
  crankPin.position.z = crankPinCenterZ;
  crankPin.userData.role = 'fixed-crank-pin-sliding-along-one-straight-slot';
  inputRotor.add(crankPin);

  const crankPinBody = cylinderAlongZ(
    crankPinRadius,
    crankPinLength,
    pinMaterial,
    48,
  );
  crankPinBody.userData.role = 'source-one-radius-circular-crank-pin';
  crankPin.add(crankPinBody);

  const crankPinRim = new THREE.Mesh(
    new THREE.TorusGeometry(
      crankPinRadius - 0.024,
      0.032,
      9,
      48,
    ),
    darkMaterial,
  );
  crankPinRim.position.z = crankPinLength / 2 + 0.012;
  crankPinRim.userData.role = 'front-rim-of-fixed-crank-pin';
  crankPin.add(crankPinRim);

  const crankPinHub = cylinderAlongZ(
    crankPinHubRadius,
    crankPinLength + 0.12,
    darkMaterial,
    30,
  );
  crankPinHub.userData.role = 'journal-through-fixed-crank-pin';
  crankPin.add(crankPinHub);

  const crankPinIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      crankPinRadius * 0.72,
      Math.max(0.035, crankPinRadius * 0.14),
      0.03,
    ),
    indexMaterial,
  );
  crankPinIndex.position.set(
    crankPinRadius * 0.36,
    0,
    crankPinLength / 2 + 0.047,
  );
  crankPinIndex.userData.role = 'visible-index-showing-pin-is-rigid-with-crank';
  crankPin.add(crankPinIndex);

  const leverShape = new THREE.Shape();
  leverShape.moveTo(-slotFarCapDistance, -leverBodyHalfWidth);
  leverShape.lineTo(0, -leverBodyHalfWidth);
  leverShape.absarc(
    0,
    0,
    leverBodyHalfWidth,
    -Math.PI / 2,
    Math.PI / 2,
    false,
  );
  leverShape.lineTo(-slotFarCapDistance, leverBodyHalfWidth);
  leverShape.absarc(
    -slotFarCapDistance,
    0,
    leverBodyHalfWidth,
    Math.PI / 2,
    Math.PI * 1.5,
    false,
  );
  leverShape.closePath();

  const slotHole = new THREE.Path();
  slotHole.moveTo(-slotNearCapDistance, -slotHalfWidth);
  slotHole.lineTo(-slotFarCapDistance, -slotHalfWidth);
  slotHole.absarc(
    -slotFarCapDistance,
    0,
    slotHalfWidth,
    -Math.PI / 2,
    Math.PI / 2,
    true,
  );
  slotHole.lineTo(-slotNearCapDistance, slotHalfWidth);
  slotHole.absarc(
    -slotNearCapDistance,
    0,
    slotHalfWidth,
    Math.PI / 2,
    -Math.PI / 2,
    true,
  );
  slotHole.closePath();
  leverShape.holes.push(slotHole);

  const rocker = new THREE.Group();
  rocker.position.copy(pivotCenter);
  rocker.userData.role = 'pivoted-slotted-lever-producing-quick-return';

  const leverBody = new THREE.Mesh(
    centeredExtrusion(leverShape, leverDepth, 0.018),
    drivenMaterial,
  );
  leverBody.position.z = leverCenterZ;
  leverBody.userData.role = 'single-rigid-slotted-lever-body';
  rocker.add(leverBody);

  const slotRimShape = new THREE.Shape();
  const slotOuterRadius = slotHalfWidth + slotOutlineThickness;
  slotRimShape.moveTo(-slotNearCapDistance, -slotOuterRadius);
  slotRimShape.lineTo(-slotFarCapDistance, -slotOuterRadius);
  slotRimShape.absarc(
    -slotFarCapDistance,
    0,
    slotOuterRadius,
    -Math.PI / 2,
    Math.PI / 2,
    true,
  );
  slotRimShape.lineTo(-slotNearCapDistance, slotOuterRadius);
  slotRimShape.absarc(
    -slotNearCapDistance,
    0,
    slotOuterRadius,
    Math.PI / 2,
    -Math.PI / 2,
    true,
  );
  slotRimShape.closePath();

  const slotRimHole = new THREE.Path();
  slotRimHole.moveTo(-slotFarCapDistance, -slotHalfWidth);
  slotRimHole.lineTo(-slotNearCapDistance, -slotHalfWidth);
  slotRimHole.absarc(
    -slotNearCapDistance,
    0,
    slotHalfWidth,
    -Math.PI / 2,
    Math.PI / 2,
    false,
  );
  slotRimHole.lineTo(-slotFarCapDistance, slotHalfWidth);
  slotRimHole.absarc(
    -slotFarCapDistance,
    0,
    slotHalfWidth,
    Math.PI / 2,
    Math.PI * 1.5,
    false,
  );
  slotRimHole.closePath();
  slotRimShape.holes.push(slotRimHole);

  const slotRim = new THREE.Mesh(
    centeredExtrusion(slotRimShape, slotOutlineDepth, 0.005),
    darkMaterial,
  );
  slotRim.position.z = slotOutlineCenterZ;
  slotRim.userData.role = 'dark-outline-of-one-open-straight-slot';
  rocker.add(slotRim);

  const extensionStartX = Math.sqrt(
    leverPivotRadius ** 2 - outputHalfWidth ** 2,
  );
  const outputExtension = new THREE.Mesh(
    new THREE.BoxGeometry(
      outputLength - extensionStartX,
      outputHalfWidth * 2,
      leverDepth,
    ),
    drivenMaterial,
  );
  outputExtension.position.set(
    (outputLength + extensionStartX) / 2,
    0,
    leverCenterZ,
  );
  outputExtension.userData.role = 'rigid-output-arm-of-quick-return-lever';
  rocker.add(outputExtension);

  const outputTipShape = new THREE.Shape();
  outputTipShape.moveTo(outputLength, -outputHalfWidth);
  outputTipShape.lineTo(outputLength + outputTipLength, 0);
  outputTipShape.lineTo(outputLength, outputHalfWidth);
  outputTipShape.closePath();
  const outputTip = new THREE.Mesh(
    centeredExtrusion(outputTipShape, leverDepth, 0.012),
    drivenMaterial,
  );
  outputTip.position.z = leverCenterZ;
  outputTip.userData.role = 'pointed-tool-end-of-rocking-quick-return-output';
  rocker.add(outputTip);

  const pivotHub = cylinderAlongZ(
    leverPivotRadius,
    pivotHubDepth,
    drivenMaterial,
    56,
  );
  pivotHub.position.z = pivotHubCenterZ;
  pivotHub.userData.role = 'source-two-radius-slotted-lever-pivot-boss';
  rocker.add(pivotHub);

  const pivotHubOutline = new THREE.Mesh(
    new THREE.TorusGeometry(
      leverPivotRadius - 0.035,
      0.04,
      10,
      56,
    ),
    darkMaterial,
  );
  pivotHubOutline.position.z = pivotHubCenterZ + pivotHubDepth / 2 + 0.012;
  pivotHubOutline.userData.role = 'front-outline-of-slotted-lever-pivot';
  rocker.add(pivotHubOutline);

  const pivotIndex = new THREE.Mesh(
    new THREE.BoxGeometry(leverPivotRadius * 0.68, 0.055, 0.032),
    indexMaterial,
  );
  pivotIndex.position.set(
    leverPivotRadius * 0.34,
    0,
    pivotHubCenterZ + pivotHubDepth / 2 + 0.05,
  );
  pivotIndex.userData.role = 'visible-index-on-oscillating-slotted-lever';
  rocker.add(pivotIndex);

  const outputIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, outputHalfWidth * 1.45, 0.032),
    indexMaterial,
  );
  outputIndex.position.set(
    outputLength * 0.78,
    0,
    leverFrontZ + 0.05,
  );
  outputIndex.userData.role = 'visible-index-on-quick-return-output-arm';
  rocker.add(outputIndex);

  const pivotShaft = cylinderAlongZ(
    pivotShaftRadius,
    pivotShaftLength,
    darkMaterial,
    40,
  );
  pivotShaft.position.set(
    pivotCenter.x,
    pivotCenter.y,
    pivotShaftCenterZ,
  );
  pivotShaft.userData.role = 'fixed-shaft-through-slotted-lever-pivot';

  const baseRail = makeBeam(
    new THREE.Vector3(frameLeftX, baseY, frameZ),
    new THREE.Vector3(frameRightX, baseY, frameZ),
    { thickness: 0.18, depth: 0.27, color: PALETTE.frame },
  );
  baseRail.userData.role = 'fixed-base-of-quick-return-demonstrator';

  const framePosts = [shaftCenter.x, pivotCenter.x].map((x, index) => {
    const post = makeBeam(
      new THREE.Vector3(x, baseY, frameZ),
      new THREE.Vector3(x, shaftCenter.y, frameZ),
      { thickness: 0.16, depth: 0.24, color: PALETTE.frame },
    );
    post.userData.role = 'fixed-post-supporting-quick-return-shaft';
    post.userData.side = index === 0 ? 'driver' : 'lever-pivot';
    return post;
  });

  const frameCrossbar = makeBeam(
    new THREE.Vector3(shaftCenter.x, shaftCenter.y, frameZ),
    new THREE.Vector3(pivotCenter.x, pivotCenter.y, frameZ),
    { thickness: 0.14, depth: 0.22, color: PALETTE.frame },
  );
  frameCrossbar.userData.role = 'fixed-crossbar-holding-offset-shaft-centers';

  const driverBearing = new THREE.Mesh(
    new THREE.TorusGeometry(driverHubRadius + 0.07, 0.075, 10, 52),
    frameMaterial,
  );
  driverBearing.position.set(shaftCenter.x, shaftCenter.y, frameZ + 0.03);
  driverBearing.userData.role = 'fixed-rear-bearing-of-input-crank-shaft';

  const pivotBearing = new THREE.Mesh(
    new THREE.TorusGeometry(leverPivotRadius + 0.07, 0.075, 10, 52),
    frameMaterial,
  );
  pivotBearing.position.set(pivotCenter.x, pivotCenter.y, frameZ + 0.03);
  pivotBearing.userData.role = 'fixed-rear-bearing-of-slotted-lever-pivot';

  root.add(
    baseRail,
    ...framePosts,
    frameCrossbar,
    driverBearing,
    pivotBearing,
    pivotShaft,
    input,
    rocker,
  );

  const localPointToWorld = (
    point,
    armAngle,
    z = leverCenterZ,
  ) => {
    const cosine = Math.cos(armAngle);
    const sine = Math.sin(armAngle);
    return new THREE.Vector3(
      pivotCenter.x + point.x * cosine - point.y * sine,
      pivotCenter.y + point.x * sine + point.y * cosine,
      z,
    );
  };

  const configurationAtDriverAngle = (driverAngle) => {
    const crankAngle = sourcePoseAngle + driverAngle;
    const crankCosine = Math.cos(crankAngle);
    const crankSine = Math.sin(crankAngle);
    const crankPoint = new THREE.Vector3(
      shaftCenter.x + crankRadius * crankCosine,
      shaftCenter.y + crankRadius * crankSine,
      crankPinCenterZ,
    );
    const pinFromPivot = new THREE.Vector2(
      crankPoint.x - pivotCenter.x,
      crankPoint.y - pivotCenter.y,
    );
    const pinPivotRadius = pinFromPivot.length();
    const armAngle = Math.atan2(
      -crankRadius * crankSine,
      pivotDistance - crankRadius * crankCosine,
    );
    const slotAxis = new THREE.Vector3(
      -Math.cos(armAngle),
      -Math.sin(armAngle),
      0,
    );
    const slotNormal = new THREE.Vector3(
      -Math.sin(armAngle),
      Math.cos(armAngle),
      0,
    );
    const armAngleDerivative = (
      crankRadius ** 2
      - pivotDistance * crankRadius * crankCosine
    ) / pinPivotRadius ** 2;
    const armAngleSecondDerivative = pivotDistance * crankRadius
      * (pivotDistance ** 2 - crankRadius ** 2)
      * crankSine / pinPivotRadius ** 4;
    const crankSweepSinceQuickStart = THREE.MathUtils.euclideanModulo(
      tangentCrankAngle - crankAngle,
      fullTurn,
    );
    const quickReturn = crankSweepSinceQuickStart < quickReturnDriverSweep;
    const stage = quickReturn
      ? 'quick-return-sweep'
      : 'slow-cutting-sweep';
    const stageProgress = quickReturn
      ? crankSweepSinceQuickStart / quickReturnDriverSweep
      : (crankSweepSinceQuickStart - quickReturnDriverSweep)
        / cuttingDriverSweep;
    return {
      armAngle,
      armAngleDerivative,
      armAngleSecondDerivative,
      crankAngle,
      crankPoint,
      crankSweepSinceQuickStart,
      driverAngle,
      pinFromPivot,
      pinPivotRadius,
      quickReturn,
      slotAxis,
      slotCoordinate: -pinPivotRadius,
      slotNormal,
      stage,
      stageProgress,
    };
  };

  const stateAtDriverAngle = (driverAngle) => {
    const configuration = configurationAtDriverAngle(driverAngle);
    const crankRadiusVector = configuration.crankPoint.clone()
      .sub(new THREE.Vector3(
        shaftCenter.x,
        shaftCenter.y,
        crankPinCenterZ,
      ));
    const crankPinVelocity = new THREE.Vector3(
      -crankRadiusVector.y * inputAngularSpeed,
      crankRadiusVector.x * inputAngularSpeed,
      0,
    );
    const crankPinAcceleration = crankRadiusVector.clone()
      .multiplyScalar(-(inputAngularSpeed ** 2));
    const armAngularSpeed = configuration.armAngleDerivative
      * inputAngularSpeed;
    const armAngularAcceleration = configuration.armAngleSecondDerivative
      * inputAngularSpeed ** 2;
    const pinFromPivot3D = configuration.crankPoint.clone().sub(
      new THREE.Vector3(
        pivotCenter.x,
        pivotCenter.y,
        crankPinCenterZ,
      ),
    );
    const leverVelocityAtPin = new THREE.Vector3(
      -pinFromPivot3D.y * armAngularSpeed,
      pinFromPivot3D.x * armAngularSpeed,
      0,
    );
    const relativeCenterVelocity = crankPinVelocity.clone()
      .sub(leverVelocityAtPin);
    const centerlineNormalError = configuration.pinFromPivot.x
        * configuration.slotNormal.x
      + configuration.pinFromPivot.y * configuration.slotNormal.y;
    const centerlineNormalVelocity = relativeCenterVelocity.dot(
      configuration.slotNormal,
    );
    const centerlineSlidingSpeed = relativeCenterVelocity.dot(
      configuration.slotAxis,
    );
    const slotDistanceRate = pivotDistance * crankRadius
      * Math.sin(configuration.crankAngle)
      / configuration.pinPivotRadius * inputAngularSpeed;
    const wallContacts = [-1, 1].map((sideSign) => {
      const wallPoint = configuration.crankPoint.clone().addScaledVector(
        configuration.slotNormal,
        sideSign * slotHalfWidth,
      );
      const pinSurfacePoint = configuration.crankPoint.clone().addScaledVector(
        configuration.slotNormal,
        sideSign * crankPinRadius,
      );
      const wallRadiusVector = wallPoint.clone().sub(new THREE.Vector3(
        pivotCenter.x,
        pivotCenter.y,
        crankPinCenterZ,
      ));
      const wallSurfaceVelocity = new THREE.Vector3(
        -wallRadiusVector.y * armAngularSpeed,
        wallRadiusVector.x * armAngularSpeed,
        0,
      );
      const pinSurfaceOffset = pinSurfacePoint.clone()
        .sub(configuration.crankPoint);
      const pinSurfaceVelocity = crankPinVelocity.clone().add(
        new THREE.Vector3(
          -pinSurfaceOffset.y * inputAngularSpeed,
          pinSurfaceOffset.x * inputAngularSpeed,
          0,
        ),
      );
      const wallToPinNormal = configuration.slotNormal.clone()
        .multiplyScalar(-sideSign);
      const relativeSurfaceVelocity = pinSurfaceVelocity.clone()
        .sub(wallSurfaceVelocity);
      return {
        centerDistance: slotHalfWidth,
        normalVelocityError: relativeSurfaceVelocity.dot(wallToPinNormal),
        pinSurfacePoint,
        pinSurfaceVelocity,
        side: sideSign < 0 ? 'lower' : 'upper',
        surfaceGap: slotHalfWidth - crankPinRadius,
        surfaceSlipSpeed: relativeSurfaceVelocity.dot(
          configuration.slotAxis,
        ),
        wallPoint,
        wallSurfaceVelocity,
        wallToPinNormal,
      };
    });
    const outputPoint = localPointToWorld(
      new THREE.Vector2(outputLength + outputTipLength, 0),
      configuration.armAngle,
      leverCenterZ,
    );
    const outputRadiusVector = outputPoint.clone().sub(new THREE.Vector3(
      pivotCenter.x,
      pivotCenter.y,
      leverCenterZ,
    ));
    const outputVelocity = new THREE.Vector3(
      -outputRadiusVector.y * armAngularSpeed,
      outputRadiusVector.x * armAngularSpeed,
      0,
    );
    const outputAcceleration = new THREE.Vector3(
      -outputRadiusVector.y * armAngularAcceleration
        - outputRadiusVector.x * armAngularSpeed ** 2,
      outputRadiusVector.x * armAngularAcceleration
        - outputRadiusVector.y * armAngularSpeed ** 2,
      0,
    );
    return {
      ...configuration,
      armAngularAcceleration,
      armAngularSpeed,
      centerlineNormalError,
      centerlineNormalVelocity,
      centerlineSlidingSpeed,
      crankPinAcceleration,
      crankPinAngularSpeed: inputAngularSpeed,
      crankPinVelocity,
      driverAngularSpeed: inputAngularSpeed,
      inputRevolutions: driverAngle / fullTurn,
      leverVelocityAtPin,
      outputAcceleration,
      outputPoint,
      outputVelocity,
      pinFixedToCrank: true,
      relativeCenterVelocity,
      slotDistanceRate,
      wallContacts,
    };
  };
  const stateAtTime = (time) => stateAtDriverAngle(
    inputAngularSpeed * time,
  );

  root.userData.mechanism = 'offset-crank-and-slotted-lever-quick-return';
  root.userData.cameraDistanceScale = 1.03;
  root.userData.blocks = {
    baseRail,
    crankArm,
    crankPin,
    crankPinBody,
    crankPinHub,
    crankPinIndex,
    crankPinRim,
    diskRotationIndex,
    driverBearing,
    driverDisk,
    driverDiskRim,
    driverHub,
    driverHubOutline,
    driverShaft,
    frameCrossbar,
    framePosts,
    input,
    leverBody,
    outputExtension,
    outputIndex,
    outputTip,
    pivotBearing,
    pivotHub,
    pivotHubOutline,
    pivotIndex,
    pivotShaft,
    rocker,
    slotRim,
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    baseY,
    crankArmDepth,
    crankArmZ,
    crankPinCenterZ,
    crankPinFrontZ,
    crankPinHubRadius,
    crankPinLength,
    crankPinRadius,
    crankRadius,
    cuttingDriverSweep,
    cuttingDuration,
    cyclePeriod,
    diskCenterZ,
    diskDepth,
    diskFrontZ,
    driverDiskRadius,
    driverHubRadius,
    driverShaftCenterZ,
    driverShaftLength,
    driverShaftRadius,
    frameLeftX,
    frameRightX,
    frameZ,
    fullTurn,
    inputAngularSpeed,
    inputSpeedMagnitude,
    leverBodyHalfWidth,
    leverCenterZ,
    leverDepth,
    leverFrontZ,
    leverPivotRadius,
    maximumArmAngle,
    maximumPinPivotRadius,
    minimumArmAngle,
    minimumPinPivotRadius,
    nominalCrankPinRadius,
    outputAngularStroke,
    outputHalfWidth,
    outputLength,
    outputTipLength,
    pinRunningClearance,
    pivotCenter: pivotCenter.clone(),
    pivotDistance,
    pivotHubCenterZ,
    pivotHubDepth,
    pivotShaftCenterZ,
    pivotShaftLength,
    pivotShaftRadius,
    quickReturnDriverSweep,
    quickReturnDuration,
    quickReturnRatio,
    shaftCenter: shaftCenter.clone(),
    slotFarCapDistance,
    slotHalfWidth,
    slotNearCapDistance,
    slotOutlineCenterZ,
    slotOutlineDepth,
    slotOutlineThickness,
    sourceCrankPinRadius,
    sourceCrankRadius,
    sourceDriverDiskRadius,
    sourceDriverHubRadius,
    sourceDriverShaftRadius,
    sourceLeverBodyHalfWidth,
    sourceLeverPivotRadius,
    sourceOutputHalfWidth,
    sourceOutputLength,
    sourceOutputTipLength,
    sourcePinRunningClearance,
    sourcePivotDistance,
    sourcePoseAngle,
    sourceScale,
    sourceSlotFarCapDistance,
    sourceSlotHalfWidth,
    sourceSlotNearCapDistance,
    tangentCrankAngle,
  };
  root.userData.configurationAtDriverAngle = configurationAtDriverAngle;
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.driverAngle;
    input.userData.angularSpeed = state.driverAngularSpeed;
    crankPin.userData.angularSpeed = state.crankPinAngularSpeed;
    rocker.rotation.set(0, 0, state.armAngle);
    rocker.userData.angularSpeed = state.armAngularSpeed;
    rocker.userData.angularAcceleration = state.armAngularAcceleration;
    root.userData.contacts = {
      crankPinSlot: {
        centerlineNormalError: state.centerlineNormalError,
        centerlineNormalVelocity: state.centerlineNormalVelocity,
        centerlineSlidingSpeed: state.centerlineSlidingSpeed,
        captive: true,
        oneStraightSlot: true,
        pinFixedToCrank: true,
        pinOrbitError: Math.abs(
          state.crankPoint.distanceTo(new THREE.Vector3(
            shaftCenter.x,
            shaftCenter.y,
            crankPinCenterZ,
          )) - crankRadius,
        ),
        slotCoordinate: state.slotCoordinate,
        slotDistanceRate: state.slotDistanceRate,
        wallContacts: state.wallContacts.map((contact) => ({
          ...contact,
          pinSurfacePoint: contact.pinSurfacePoint.clone(),
          pinSurfaceVelocity: contact.pinSurfaceVelocity.clone(),
          wallPoint: contact.wallPoint.clone(),
          wallSurfaceVelocity: contact.wallSurfaceVelocity.clone(),
          wallToPinNormal: contact.wallToPinNormal.clone(),
        })),
      },
      driverShaftBearing: {
        axis: Z_AXIS.clone(),
        radialClearance: driverHubRadius + 0.07 - driverShaftRadius,
      },
      rockerPivotBearing: {
        axis: Z_AXIS.clone(),
        centerError: Math.hypot(
          rocker.position.x - pivotCenter.x,
          rocker.position.y - pivotCenter.y,
        ),
        radialClearance: leverPivotRadius - pivotShaftRadius,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(6.5, 3.8, 14.2));
}

function vibratingSlottedLeverHorizontalBarMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.27;
  const sourceSliderHalfLength = 15;
  const sourceSliderHalfHeight = 1;
  const sourceSliderTravel = 4.041452;
  const sourcePivotHeight = 7;
  const sourceCeilingHeight = 9;
  const sourceCeilingHalfLength = 6;
  const sourceSlotNearCapDistance = 4.541452;
  const sourceSlotFarCapDistance = 10.541452;
  const sourceSlotHalfWidth = 0.5;
  const sourceSlotBodyRadius = 1.1;
  const sourceLeverPivotRadius = 1.1;
  const sourceLeverPivotShaftRadius = 0.5;
  const sourceLeverNeckStartDistance = 0.921954;
  const sourceLeverNeckEndDistance = 3.619497;
  const sourceLeverExtensionStartDistance = 11.463406;
  const sourceLeverLength = 24;
  const sourceLeverStemHalfWidth = 0.6;
  const sourceGuideCenterDistance = 9.5;
  const sourceGuidePlateHalfWidth = 1;
  const sourceGuidePlateHalfHeight = 3;
  const sourceGuideBoltOffset = 2;
  const sourceGuideBoltRadius = 0.4;
  const sourcePinRunningClearance = 0.018;

  const sliderHalfLength = sourceSliderHalfLength * sourceScale;
  const sliderHalfHeight = sourceSliderHalfHeight * sourceScale;
  const sliderTravel = sourceSliderTravel * sourceScale;
  const pivotHeight = sourcePivotHeight * sourceScale;
  const ceilingHeight = sourceCeilingHeight * sourceScale;
  const ceilingHalfLength = sourceCeilingHalfLength * sourceScale;
  const slotNearCapDistance = sourceSlotNearCapDistance * sourceScale;
  const slotFarCapDistance = sourceSlotFarCapDistance * sourceScale;
  const slotHalfWidth = sourceSlotHalfWidth * sourceScale;
  const slotBodyRadius = sourceSlotBodyRadius * sourceScale;
  const leverPivotRadius = sourceLeverPivotRadius * sourceScale;
  const leverPivotShaftRadius = sourceLeverPivotShaftRadius * sourceScale;
  const leverNeckStartDistance = sourceLeverNeckStartDistance * sourceScale;
  const leverNeckEndDistance = sourceLeverNeckEndDistance * sourceScale;
  const leverExtensionStartDistance = sourceLeverExtensionStartDistance
    * sourceScale;
  const leverLength = sourceLeverLength * sourceScale;
  const leverStemHalfWidth = sourceLeverStemHalfWidth * sourceScale;
  const guideCenterDistance = sourceGuideCenterDistance * sourceScale;
  const guidePlateHalfWidth = sourceGuidePlateHalfWidth * sourceScale;
  const guidePlateHalfHeight = sourceGuidePlateHalfHeight * sourceScale;
  const guideBoltOffset = sourceGuideBoltOffset * sourceScale;
  const guideBoltRadius = sourceGuideBoltRadius * sourceScale;
  const pinRunningClearance = sourcePinRunningClearance * sourceScale;
  const nominalPinRadius = slotHalfWidth;
  const sliderPinRadius = nominalPinRadius - pinRunningClearance;

  const cyclePeriod = 12;
  const leftStrokePhaseEnd = 0.4;
  const leftDwellPhaseEnd = 0.5;
  const rightStrokePhaseEnd = 0.9;
  const sliderLineY = -0.15;
  const pivotCenter = new THREE.Vector3(
    0,
    sliderLineY + pivotHeight,
    0,
  );
  const ceilingY = sliderLineY + ceilingHeight;
  const rightLeverAngle = Math.atan2(-pivotHeight, sliderTravel);
  const leftLeverAngle = Math.atan2(-pivotHeight, -sliderTravel);
  const leverAngularStroke = rightLeverAngle - leftLeverAngle;
  const minimumPinPivotRadius = pivotHeight;
  const maximumPinPivotRadius = Math.hypot(pivotHeight, sliderTravel);

  const sliderDepth = 0.24;
  const sliderCenterZ = -0.08;
  const sliderFrontZ = sliderCenterZ + sliderDepth / 2;
  const leverDepth = 0.21;
  const leverCenterZ = 0.18;
  const leverFrontZ = leverCenterZ + leverDepth / 2;
  const slotOutlineDepth = 0.035;
  const slotOutlineCenterZ = leverFrontZ + slotOutlineDepth / 2;
  const slotOutlineThickness = 0.032;
  const sliderPinLength = 1.05;
  const sliderPinCenterZ = 0.1;
  const sliderPinFrontZ = sliderPinCenterZ + sliderPinLength / 2;
  const sliderPinHubRadius = sliderPinRadius * 0.34;
  const pivotHubDepth = 0.47;
  const pivotHubCenterZ = 0.14;
  const pivotShaftLength = 1.36;
  const pivotShaftCenterZ = -0.27;
  const frameZ = -0.75;
  const guidePlateDepth = 0.12;
  const guideFrontZ = 0.42;
  const guideBackZ = -0.4;
  const guideVerticalClearance = 0.035;
  const guideDepthClearance = Math.min(
    guideFrontZ - guidePlateDepth / 2 - sliderFrontZ,
    sliderCenterZ - sliderDepth / 2
      - (guideBackZ + guidePlateDepth / 2),
  );

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
  const pinMaterial = matte(PALETTE.brass, {
    metalness: 0.28,
    roughness: 0.45,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

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

  const slider = new THREE.Group();
  slider.position.set(sliderTravel, sliderLineY, 0);
  slider.userData.role = 'guided-horizontal-bar-with-one-fixed-slot-pin';

  const sliderBar = new THREE.Mesh(
    new THREE.BoxGeometry(
      sliderHalfLength * 2,
      sliderHalfHeight * 2,
      sliderDepth,
    ),
    drivenMaterial,
  );
  sliderBar.position.z = sliderCenterZ;
  sliderBar.userData.role = 'source-thirty-unit-horizontal-sliding-bar';
  slider.add(sliderBar);

  const sliderEndCaps = [-1, 1].map((sideSign) => {
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, sliderHalfHeight * 1.86, sliderDepth + 0.02),
      darkMaterial,
    );
    cap.position.set(sideSign * (sliderHalfLength - 0.06), 0, sliderCenterZ);
    cap.userData.role = 'dark-end-edge-of-horizontal-sliding-bar';
    cap.userData.side = sideSign < 0 ? 'left' : 'right';
    slider.add(cap);
    return cap;
  });

  const sliderIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, sliderHalfHeight * 1.42, 0.032),
    indexMaterial,
  );
  sliderIndex.position.set(
    -sliderHalfLength * 0.72,
    0,
    sliderFrontZ + 0.035,
  );
  sliderIndex.userData.role = 'visible-nonrotating-index-on-horizontal-bar';
  slider.add(sliderIndex);

  const sliderPin = new THREE.Group();
  sliderPin.position.z = sliderPinCenterZ;
  sliderPin.userData.role = 'single-pin-fixed-rigidly-to-horizontal-bar';
  slider.add(sliderPin);

  const sliderPinBody = cylinderAlongZ(
    sliderPinRadius,
    sliderPinLength,
    pinMaterial,
    44,
  );
  sliderPinBody.userData.role = 'circular-pin-sliding-along-lever-slot';
  sliderPin.add(sliderPinBody);

  const sliderPinRim = new THREE.Mesh(
    new THREE.TorusGeometry(
      sliderPinRadius - 0.018,
      0.025,
      9,
      44,
    ),
    darkMaterial,
  );
  sliderPinRim.position.z = sliderPinLength / 2 + 0.012;
  sliderPinRim.userData.role = 'front-rim-of-horizontal-bar-pin';
  sliderPin.add(sliderPinRim);

  const sliderPinHub = cylinderAlongZ(
    sliderPinHubRadius,
    sliderPinLength + 0.1,
    darkMaterial,
    28,
  );
  sliderPinHub.userData.role = 'journal-through-horizontal-bar-pin';
  sliderPin.add(sliderPinHub);

  const sliderPinIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      sliderPinRadius * 0.72,
      Math.max(0.03, sliderPinRadius * 0.16),
      0.028,
    ),
    indexMaterial,
  );
  sliderPinIndex.position.set(
    sliderPinRadius * 0.36,
    0,
    sliderPinLength / 2 + 0.042,
  );
  sliderPinIndex.userData.role = 'visible-index-showing-pin-does-not-rotate';
  sliderPin.add(sliderPinIndex);

  const rocker = new THREE.Group();
  rocker.position.copy(pivotCenter);
  rocker.rotation.z = rightLeverAngle;
  rocker.userData.role = 'top-pivoted-vibrating-slotted-driving-lever';

  const slotStraightHalfLength = (
    slotFarCapDistance - slotNearCapDistance
  ) / 2;
  const slotMidpointDistance = (
    slotNearCapDistance + slotFarCapDistance
  ) / 2;
  const slotHousing = new THREE.Mesh(
    centeredExtrusion(horizontalCapsuleRingShape(
      slotHalfWidth,
      slotBodyRadius,
      slotStraightHalfLength,
    ), leverDepth, 0.015),
    driverMaterial,
  );
  slotHousing.position.set(slotMidpointDistance, 0, leverCenterZ);
  slotHousing.userData.role = 'one-open-straight-slot-in-vibrating-lever';
  rocker.add(slotHousing);

  const slotRim = new THREE.Mesh(
    centeredExtrusion(horizontalCapsuleRingShape(
      slotHalfWidth,
      slotHalfWidth + slotOutlineThickness,
      slotStraightHalfLength,
    ), slotOutlineDepth, 0.004),
    darkMaterial,
  );
  slotRim.position.set(slotMidpointDistance, 0, slotOutlineCenterZ);
  slotRim.userData.role = 'dark-outline-of-vibrating-lever-slot';
  rocker.add(slotRim);

  const leverNeck = makeBeam(
    new THREE.Vector3(leverNeckStartDistance, 0, leverCenterZ),
    new THREE.Vector3(leverNeckEndDistance, 0, leverCenterZ),
    {
      thickness: leverStemHalfWidth * 2,
      depth: leverDepth,
      color: PALETTE.driver,
    },
  );
  leverNeck.userData.role = 'narrow-neck-between-pivot-and-slotted-body';
  rocker.add(leverNeck);

  const leverExtension = makeBeam(
    new THREE.Vector3(leverExtensionStartDistance, 0, leverCenterZ),
    new THREE.Vector3(leverLength, 0, leverCenterZ),
    {
      thickness: leverStemHalfWidth * 2,
      depth: leverDepth,
      color: PALETTE.driver,
    },
  );
  leverExtension.userData.role = 'long-handle-of-vibrating-slotted-lever';
  rocker.add(leverExtension);

  const leverEndCap = cylinderAlongZ(
    leverStemHalfWidth,
    leverDepth,
    driverMaterial,
    28,
  );
  leverEndCap.position.set(leverLength, 0, leverCenterZ);
  leverEndCap.userData.role = 'rounded-end-of-vibrating-lever-handle';
  rocker.add(leverEndCap);

  const leverPivotHub = cylinderAlongZ(
    leverPivotRadius,
    pivotHubDepth,
    driverMaterial,
    52,
  );
  leverPivotHub.position.z = pivotHubCenterZ;
  leverPivotHub.userData.role = 'source-one-point-one-radius-lever-pivot-boss';
  rocker.add(leverPivotHub);

  const leverPivotOutline = new THREE.Mesh(
    new THREE.TorusGeometry(
      leverPivotRadius - 0.03,
      0.035,
      10,
      52,
    ),
    darkMaterial,
  );
  leverPivotOutline.position.z = pivotHubCenterZ + pivotHubDepth / 2 + 0.012;
  leverPivotOutline.userData.role = 'front-outline-of-vibrating-lever-pivot';
  rocker.add(leverPivotOutline);

  const leverPivotIndex = new THREE.Mesh(
    new THREE.BoxGeometry(leverPivotRadius * 0.68, 0.05, 0.03),
    indexMaterial,
  );
  leverPivotIndex.position.set(
    leverPivotRadius * 0.34,
    0,
    pivotHubCenterZ + pivotHubDepth / 2 + 0.046,
  );
  leverPivotIndex.userData.role = 'visible-index-on-vibrating-driving-lever';
  rocker.add(leverPivotIndex);

  const leverHandleIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, leverStemHalfWidth * 1.42, 0.03),
    indexMaterial,
  );
  leverHandleIndex.position.set(
    leverLength * 0.83,
    0,
    leverFrontZ + 0.045,
  );
  leverHandleIndex.userData.role = 'visible-index-on-long-vibrating-handle';
  rocker.add(leverHandleIndex);

  const pivotShaft = cylinderAlongZ(
    leverPivotShaftRadius,
    pivotShaftLength,
    darkMaterial,
    36,
  );
  pivotShaft.position.set(
    pivotCenter.x,
    pivotCenter.y,
    pivotShaftCenterZ,
  );
  pivotShaft.userData.role = 'fixed-shaft-suspending-vibrating-lever';

  const ceilingRail = makeBeam(
    new THREE.Vector3(-ceilingHalfLength, ceilingY, frameZ),
    new THREE.Vector3(ceilingHalfLength, ceilingY, frameZ),
    { thickness: 0.15, depth: 0.25, color: PALETTE.frame },
  );
  ceilingRail.userData.role = 'fixed-overhead-support-of-hanging-lever';

  const pivotBrackets = [-1, 1].map((sideSign) => {
    const bracket = makeBeam(
      new THREE.Vector3(
        sideSign * leverPivotRadius * 0.82,
        ceilingY,
        frameZ,
      ),
      new THREE.Vector3(
        sideSign * leverPivotRadius * 0.45,
        pivotCenter.y,
        frameZ + 0.03,
      ),
      { thickness: 0.1, depth: 0.18, color: PALETTE.frame },
    );
    bracket.userData.role = 'fixed-bracket-hanging-lever-pivot';
    return bracket;
  });

  const pivotBearing = new THREE.Mesh(
    new THREE.TorusGeometry(leverPivotRadius + 0.055, 0.06, 10, 48),
    frameMaterial,
  );
  pivotBearing.position.set(pivotCenter.x, pivotCenter.y, frameZ + 0.03);
  pivotBearing.userData.role = 'fixed-rear-bearing-of-hanging-lever';

  const guideBrackets = [];
  const guideBolts = [];
  for (const sideSign of [-1, 1]) {
    const guideCenterX = sideSign * guideCenterDistance;
    const bracket = new THREE.Group();
    bracket.position.set(guideCenterX, sliderLineY, 0);
    bracket.userData.role = 'fixed-sandwich-guide-for-horizontal-bar';
    bracket.userData.side = sideSign < 0 ? 'left' : 'right';
    for (const z of [guideBackZ, guideFrontZ]) {
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(
          guidePlateHalfWidth * 2,
          guidePlateHalfHeight * 2,
          guidePlateDepth,
        ),
        frameMaterial,
      );
      plate.position.z = z;
      plate.userData.role = 'fixed-front-or-back-guide-plate';
      plate.userData.face = z < 0 ? 'back' : 'front';
      bracket.add(plate);
    }
    for (const verticalSign of [-1, 1]) {
      const wearBlock = new THREE.Mesh(
        new THREE.BoxGeometry(
          guidePlateHalfWidth * 1.7,
          0.075,
          guideFrontZ - guideBackZ - guidePlateDepth,
        ),
        frameMaterial,
      );
      wearBlock.position.set(
        0,
        verticalSign * (
          sliderHalfHeight + guideVerticalClearance + 0.0375
        ),
        (guideFrontZ + guideBackZ) / 2,
      );
      wearBlock.userData.role = 'fixed-wear-face-constraining-bar-height';
      bracket.add(wearBlock);
    }
    for (const verticalSign of [-1, 1]) {
      const bolt = cylinderAlongZ(
        guideBoltRadius,
        guidePlateDepth + 0.08,
        darkMaterial,
        28,
      );
      bolt.position.set(0, verticalSign * guideBoltOffset, guideFrontZ + 0.05);
      bolt.userData.role = 'source-guide-plate-fastener';
      bolt.userData.side = verticalSign < 0 ? 'lower' : 'upper';
      bracket.add(bolt);
      guideBolts.push(bolt);
    }
    guideBrackets.push(bracket);
  }

  const cameraFitPoints = [
    new THREE.Vector3(-sliderHalfLength - sliderTravel, sliderLineY, 0),
    new THREE.Vector3(sliderHalfLength + sliderTravel, sliderLineY, 0),
    new THREE.Vector3(
      pivotCenter.x + leverLength * Math.cos(leftLeverAngle),
      pivotCenter.y + leverLength * Math.sin(leftLeverAngle),
      leverCenterZ,
    ),
    new THREE.Vector3(
      pivotCenter.x + leverLength * Math.cos(rightLeverAngle),
      pivotCenter.y + leverLength * Math.sin(rightLeverAngle),
      leverCenterZ,
    ),
  ];
  const cameraFitGuides = cameraFitPoints.map((point, index) => {
    const guide = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshBasicMaterial({
        color: PALETTE.paper,
        depthWrite: false,
        opacity: 0,
        transparent: true,
      }),
    );
    guide.position.copy(point);
    guide.userData.cameraFitGuide = true;
    guide.userData.index = index;
    return guide;
  });

  root.add(
    ...cameraFitGuides,
    ceilingRail,
    ...pivotBrackets,
    pivotBearing,
    pivotShaft,
    ...guideBrackets,
    slider,
    rocker,
  );

  const motionAtTime = (time) => {
    const cycleIndex = Math.floor(time / cyclePeriod);
    const cycleTime = time - cycleIndex * cyclePeriod;
    const phase = cycleTime / cyclePeriod;
    let sliderX;
    let sliderVelocity;
    let sliderAcceleration;
    let stage;
    if (phase < leftStrokePhaseEnd) {
      const duration = cyclePeriod * leftStrokePhaseEnd;
      const progress = phase / leftStrokePhaseEnd;
      sliderX = sliderTravel * (1 - 2 * smootherStep(progress));
      sliderVelocity = -2 * sliderTravel
        * smootherStepDerivative(progress) / duration;
      sliderAcceleration = -2 * sliderTravel
        * smootherStepSecondDerivative(progress) / duration ** 2;
      stage = 'leftward-bar-stroke';
    } else if (phase < leftDwellPhaseEnd) {
      sliderX = -sliderTravel;
      sliderVelocity = 0;
      sliderAcceleration = 0;
      stage = 'left-end-dwell';
    } else if (phase < rightStrokePhaseEnd) {
      const duration = cyclePeriod
        * (rightStrokePhaseEnd - leftDwellPhaseEnd);
      const progress = (phase - leftDwellPhaseEnd)
        / (rightStrokePhaseEnd - leftDwellPhaseEnd);
      sliderX = sliderTravel * (2 * smootherStep(progress) - 1);
      sliderVelocity = 2 * sliderTravel
        * smootherStepDerivative(progress) / duration;
      sliderAcceleration = 2 * sliderTravel
        * smootherStepSecondDerivative(progress) / duration ** 2;
      stage = 'rightward-bar-stroke';
    } else {
      sliderX = sliderTravel;
      sliderVelocity = 0;
      sliderAcceleration = 0;
      stage = 'right-end-dwell';
    }
    return {
      cycleIndex,
      cycleTime,
      phase,
      sliderAcceleration,
      sliderVelocity,
      sliderX,
      stage,
    };
  };

  const stateAtSliderPosition = (
    sliderX,
    sliderVelocity = 0,
    sliderAcceleration = 0,
    stage = 'position-query',
  ) => {
    const clampedSliderX = THREE.MathUtils.clamp(
      sliderX,
      -sliderTravel,
      sliderTravel,
    );
    const pinPoint = new THREE.Vector3(
      clampedSliderX,
      sliderLineY,
      sliderPinCenterZ,
    );
    const pinFromPivot = new THREE.Vector2(
      clampedSliderX - pivotCenter.x,
      sliderLineY - pivotCenter.y,
    );
    const pinPivotRadius = pinFromPivot.length();
    const leverAngle = Math.atan2(pinFromPivot.y, pinFromPivot.x);
    const slotAxis = new THREE.Vector3(
      Math.cos(leverAngle),
      Math.sin(leverAngle),
      0,
    );
    const slotNormal = new THREE.Vector3(
      -slotAxis.y,
      slotAxis.x,
      0,
    );
    const leverAngularSpeed = pivotHeight
      / pinPivotRadius ** 2 * sliderVelocity;
    const leverAngularAcceleration = pivotHeight
        / pinPivotRadius ** 2 * sliderAcceleration
      - 2 * pivotHeight * clampedSliderX
        / pinPivotRadius ** 4 * sliderVelocity ** 2;
    const pinVelocity = new THREE.Vector3(sliderVelocity, 0, 0);
    const pinAcceleration = new THREE.Vector3(sliderAcceleration, 0, 0);
    const pinFromPivot3D = new THREE.Vector3(
      pinFromPivot.x,
      pinFromPivot.y,
      0,
    );
    const leverVelocityAtPin = new THREE.Vector3(
      -pinFromPivot3D.y * leverAngularSpeed,
      pinFromPivot3D.x * leverAngularSpeed,
      0,
    );
    const relativeCenterVelocity = pinVelocity.clone()
      .sub(leverVelocityAtPin);
    const centerlineNormalError = pinFromPivot3D.dot(slotNormal);
    const centerlineNormalVelocity = relativeCenterVelocity.dot(slotNormal);
    const centerlineSlidingSpeed = relativeCenterVelocity.dot(slotAxis);
    const slotDistanceRate = clampedSliderX * sliderVelocity
      / pinPivotRadius;
    const wallContacts = [-1, 1].map((sideSign) => {
      const wallPoint = pinPoint.clone().addScaledVector(
        slotNormal,
        sideSign * slotHalfWidth,
      );
      const pinSurfacePoint = pinPoint.clone().addScaledVector(
        slotNormal,
        sideSign * sliderPinRadius,
      );
      const wallRadiusVector = wallPoint.clone().sub(new THREE.Vector3(
        pivotCenter.x,
        pivotCenter.y,
        sliderPinCenterZ,
      ));
      const wallSurfaceVelocity = new THREE.Vector3(
        -wallRadiusVector.y * leverAngularSpeed,
        wallRadiusVector.x * leverAngularSpeed,
        0,
      );
      const pinSurfaceVelocity = pinVelocity.clone();
      const wallToPinNormal = slotNormal.clone().multiplyScalar(-sideSign);
      const relativeSurfaceVelocity = pinSurfaceVelocity.clone()
        .sub(wallSurfaceVelocity);
      return {
        centerDistance: slotHalfWidth,
        normalVelocityError: relativeSurfaceVelocity.dot(wallToPinNormal),
        pinSurfacePoint,
        pinSurfaceVelocity,
        side: sideSign < 0 ? 'lower' : 'upper',
        surfaceGap: slotHalfWidth - sliderPinRadius,
        surfaceSlipSpeed: relativeSurfaceVelocity.dot(slotAxis),
        wallPoint,
        wallSurfaceVelocity,
        wallToPinNormal,
      };
    });
    const leverTip = new THREE.Vector3(
      pivotCenter.x + leverLength * slotAxis.x,
      pivotCenter.y + leverLength * slotAxis.y,
      leverCenterZ,
    );
    const leverTipVelocity = new THREE.Vector3(
      -(leverTip.y - pivotCenter.y) * leverAngularSpeed,
      (leverTip.x - pivotCenter.x) * leverAngularSpeed,
      0,
    );
    return {
      centerlineNormalError,
      centerlineNormalVelocity,
      centerlineSlidingSpeed,
      leverAngle,
      leverAngularAcceleration,
      leverAngularSpeed,
      leverTip,
      leverTipVelocity,
      pinAcceleration,
      pinAngularSpeed: 0,
      pinFixedToSlider: true,
      pinFromPivot,
      pinPivotRadius,
      pinPoint,
      pinVelocity,
      relativeCenterVelocity,
      sliderAcceleration,
      sliderVelocity,
      sliderX: clampedSliderX,
      slotAxis,
      slotCoordinate: pinPivotRadius,
      slotDistanceRate,
      slotNormal,
      stage,
      wallContacts,
    };
  };

  const stateAtTime = (time) => {
    const motion = motionAtTime(time);
    return {
      ...stateAtSliderPosition(
        motion.sliderX,
        motion.sliderVelocity,
        motion.sliderAcceleration,
        motion.stage,
      ),
      cycleIndex: motion.cycleIndex,
      cycleTime: motion.cycleTime,
      phase: motion.phase,
    };
  };

  root.userData.mechanism = 'pivoted-slotted-lever-guided-horizontal-bar';
  root.userData.cameraDistanceScale = 1.04;
  root.userData.blocks = {
    cameraFitGuides,
    ceilingRail,
    guideBolts,
    guideBrackets,
    leverEndCap,
    leverExtension,
    leverHandleIndex,
    leverNeck,
    leverPivotHub,
    leverPivotIndex,
    leverPivotOutline,
    pivotBearing,
    pivotBrackets,
    pivotShaft,
    rocker,
    slider,
    sliderBar,
    sliderEndCaps,
    sliderIndex,
    sliderPin,
    sliderPinBody,
    sliderPinHub,
    sliderPinIndex,
    sliderPinRim,
    slotHousing,
    slotRim,
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    ceilingHalfLength,
    ceilingY,
    cyclePeriod,
    frameZ,
    fullTurn,
    guideBackZ,
    guideBoltOffset,
    guideBoltRadius,
    guideCenterDistance,
    guideDepthClearance,
    guideFrontZ,
    guidePlateDepth,
    guidePlateHalfHeight,
    guidePlateHalfWidth,
    guideVerticalClearance,
    leftDwellPhaseEnd,
    leftLeverAngle,
    leftStrokePhaseEnd,
    leverAngularStroke,
    leverCenterZ,
    leverDepth,
    leverExtensionStartDistance,
    leverFrontZ,
    leverLength,
    leverNeckEndDistance,
    leverNeckStartDistance,
    leverPivotRadius,
    leverPivotShaftRadius,
    leverStemHalfWidth,
    maximumPinPivotRadius,
    minimumPinPivotRadius,
    nominalPinRadius,
    pinRunningClearance,
    pivotCenter: pivotCenter.clone(),
    pivotHeight,
    pivotHubCenterZ,
    pivotHubDepth,
    pivotShaftCenterZ,
    pivotShaftLength,
    rightLeverAngle,
    rightStrokePhaseEnd,
    sliderCenterZ,
    sliderDepth,
    sliderFrontZ,
    sliderHalfHeight,
    sliderHalfLength,
    sliderLineY,
    sliderPinCenterZ,
    sliderPinFrontZ,
    sliderPinHubRadius,
    sliderPinLength,
    sliderPinRadius,
    sliderTravel,
    slotBodyRadius,
    slotFarCapDistance,
    slotHalfWidth,
    slotMidpointDistance,
    slotNearCapDistance,
    slotOutlineCenterZ,
    slotOutlineDepth,
    slotOutlineThickness,
    slotStraightHalfLength,
    sourceCeilingHalfLength,
    sourceCeilingHeight,
    sourceGuideBoltOffset,
    sourceGuideBoltRadius,
    sourceGuideCenterDistance,
    sourceGuidePlateHalfHeight,
    sourceGuidePlateHalfWidth,
    sourceLeverExtensionStartDistance,
    sourceLeverLength,
    sourceLeverNeckEndDistance,
    sourceLeverNeckStartDistance,
    sourceLeverPivotRadius,
    sourceLeverPivotShaftRadius,
    sourceLeverStemHalfWidth,
    sourcePinRunningClearance,
    sourcePivotHeight,
    sourceScale,
    sourceSliderHalfHeight,
    sourceSliderHalfLength,
    sourceSliderTravel,
    sourceSlotBodyRadius,
    sourceSlotFarCapDistance,
    sourceSlotHalfWidth,
    sourceSlotNearCapDistance,
  };
  root.userData.motionAtTime = motionAtTime;
  root.userData.stateAtSliderPosition = stateAtSliderPosition;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    slider.position.set(state.sliderX, sliderLineY, 0);
    slider.rotation.set(0, 0, 0);
    slider.userData.velocity = state.pinVelocity.clone();
    sliderPin.userData.angularSpeed = state.pinAngularSpeed;
    rocker.rotation.set(0, 0, state.leverAngle);
    rocker.userData.angularSpeed = state.leverAngularSpeed;
    rocker.userData.angularAcceleration = state.leverAngularAcceleration;
    root.userData.contacts = {
      pinSlot: {
        centerlineNormalError: state.centerlineNormalError,
        centerlineNormalVelocity: state.centerlineNormalVelocity,
        centerlineSlidingSpeed: state.centerlineSlidingSpeed,
        oneStraightSlot: true,
        pinFixedToSlider: true,
        slotCoordinate: state.slotCoordinate,
        slotDistanceRate: state.slotDistanceRate,
        wallContacts: state.wallContacts.map((contact) => ({
          ...contact,
          pinSurfacePoint: contact.pinSurfacePoint.clone(),
          pinSurfaceVelocity: contact.pinSurfaceVelocity.clone(),
          wallPoint: contact.wallPoint.clone(),
          wallSurfaceVelocity: contact.wallSurfaceVelocity.clone(),
          wallToPinNormal: contact.wallToPinNormal.clone(),
        })),
      },
      sliderGuides: {
        axis: X_AXIS.clone(),
        depthClearance: guideDepthClearance,
        lineError: Math.abs(state.pinPoint.y - sliderLineY),
        rotationError: 0,
        verticalClearance: guideVerticalClearance,
      },
      vibratingLeverPivot: {
        axis: Z_AXIS.clone(),
        centerError: Math.hypot(
          rocker.position.x - pivotCenter.x,
          rocker.position.y - pivotCenter.y,
        ),
        radialClearance: leverPivotRadius - leverPivotShaftRadius,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(6.2, 3.8, 14.6));
}

function crankPinSlottedSectorRackMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.5;
  const sourceDriverDiskRadius = 5;
  const sourceCrankRadius = 4;
  const sourceCenterDistance = 6.5;
  const sourceSectorPitchRadius = 5;
  const sourceCrankPinRadius = 0.748;
  const sourceSlotHalfWidth = 0.75;
  const sourceSlotNearCapDistance = 2.25;
  const sourceSlotFarCapDistance = 10.75;
  const sourcePivotRadius = 0.8;
  const sourceRackHalfLength = 15.148795;
  const sourceGuideCenterX = 10.909426;
  const sourceRackReferenceY = -6.5;
  const sourceRackBodyBottom = -0.5;
  const sourceRackToothRootY = 1.5 - 1.25 * (10 / 23);
  const sourceRackToothTipY = 1.5 + 10 / 23;
  const sourceEquivalentSectorTeeth = 23;

  const driverDiskRadius = sourceDriverDiskRadius * sourceScale;
  const crankRadius = sourceCrankRadius * sourceScale;
  const centerDistance = sourceCenterDistance * sourceScale;
  const sectorPitchRadius = sourceSectorPitchRadius * sourceScale;
  const crankPinRadius = sourceCrankPinRadius * sourceScale;
  const slotHalfWidth = sourceSlotHalfWidth * sourceScale;
  const slotNearCapDistance = sourceSlotNearCapDistance * sourceScale;
  const slotFarCapDistance = sourceSlotFarCapDistance * sourceScale;
  const pivotRadius = sourcePivotRadius * sourceScale;
  const rackHalfLength = sourceRackHalfLength * sourceScale;
  const guideCenterX = sourceGuideCenterX * sourceScale;
  const rackReferenceY = sourceRackReferenceY * sourceScale;
  const rackBodyBottom = sourceRackBodyBottom * sourceScale;
  const rackToothRootY = sourceRackToothRootY * sourceScale;
  const rackToothTipY = sourceRackToothTipY * sourceScale;
  const rackBodyHeight = rackToothRootY - rackBodyBottom;
  const rackBodyCenterY = (rackToothRootY + rackBodyBottom) / 2;
  const sectorEquivalentTeeth = sourceEquivalentSectorTeeth;
  const sectorAngularPitch = fullTurn / sectorEquivalentTeeth;
  const rackLinearPitch = sectorPitchRadius * sectorAngularPitch;
  const sectorToothCount = 11;
  const rackToothCount = 10;
  const sectorRootRadius = 2.08;
  const sectorOuterRadius = sectorPitchRadius + 2 * sectorPitchRadius / sectorEquivalentTeeth;
  const sectorWebInnerRadius = 1.02;
  const sectorStartAngle = -Math.PI / 2 - sectorAngularPitch * 5.25;
  const sectorEndAngle = -Math.PI / 2 + sectorAngularPitch * 5.25;
  const rockerHalfSwing = Math.asin(crankRadius / centerDistance);
  const rockerAngularStroke = rockerHalfSwing * 2;
  const rackHalfTravel = sectorPitchRadius * rockerHalfSwing;
  const rackStroke = rackHalfTravel * 2;
  const minimumPinPivotRadius = centerDistance - crankRadius;
  const maximumPinPivotRadius = centerDistance + crankRadius;
  const slotEndRunningClearance = Math.min(
    minimumPinPivotRadius - slotNearCapDistance,
    slotFarCapDistance - maximumPinPivotRadius,
  );
  const pinSideRunningClearance = slotHalfWidth - crankPinRadius;
  const pivotCenter = new THREE.Vector3(0, 0, 0);
  const driverCenter = new THREE.Vector3(0, centerDistance, 0);
  const pitchContactPoint = new THREE.Vector3(
    pivotCenter.x,
    pivotCenter.y - sectorPitchRadius,
    0.2,
  );
  const sourcePoseInputAngle = 0;
  const sourcePoseRockerAngle = Math.atan2(
    centerDistance,
    crankRadius,
  ) - Math.PI / 2;
  const sourcePoseRackX = sectorPitchRadius * sourcePoseRockerAngle;
  const inputAngularSpeed = -fullTurn / 4;
  const cyclePeriod = fullTurn / Math.abs(inputAngularSpeed);

  const diskDepth = 0.3;
  const diskCenterZ = -0.14;
  const diskFrontZ = diskCenterZ + diskDepth / 2;
  const driverShaftRadius = 0.25;
  const driverShaftLength = 1.55;
  const driverShaftCenterZ = -0.52;
  const driverHubRadius = 0.48;
  const crankArmDepth = 0.2;
  const crankArmCenterZ = 0.13;
  const crankPinLength = 1.2;
  const crankPinCenterZ = 0.14;
  const crankPinFrontZ = crankPinCenterZ + crankPinLength / 2;
  const rockerDepth = 0.28;
  const rockerCenterZ = 0.2;
  const rockerFrontZ = rockerCenterZ + rockerDepth / 2;
  const pivotShaftRadius = 0.23;
  const pivotShaftLength = 1.45;
  const pivotShaftCenterZ = -0.34;
  const rackDepth = 0.3;
  const rackCenterZ = rockerCenterZ;
  const rackFrontZ = rackCenterZ + rackDepth / 2;
  const guidePlateDepth = 0.11;
  const frameZ = -0.82;

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
  const pinMaterial = matte(PALETTE.brass, {
    metalness: 0.28,
    roughness: 0.45,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const input = planarRotor();
  input.position.copy(driverCenter);
  input.userData.role = 'one-continuously-rotating-crank-disk';
  const inputRotor = input.userData.rotor;
  inputRotor.userData.role = 'one-rigid-disk-crank-and-fixed-pin-rotor';

  const driverDisk = cylinderAlongZ(
    driverDiskRadius,
    diskDepth,
    driverMaterial,
    104,
  );
  driverDisk.position.z = diskCenterZ;
  driverDisk.userData.role = 'source-five-radius-crank-disk';
  inputRotor.add(driverDisk);

  const driverDiskRim = new THREE.Mesh(
    new THREE.TorusGeometry(driverDiskRadius - 0.045, 0.055, 10, 104),
    darkMaterial,
  );
  driverDiskRim.position.z = diskFrontZ + 0.016;
  driverDiskRim.userData.role = 'front-outline-of-crank-disk';
  inputRotor.add(driverDiskRim);

  const driverShaft = cylinderAlongZ(
    driverShaftRadius,
    driverShaftLength,
    darkMaterial,
    44,
  );
  driverShaft.position.z = driverShaftCenterZ;
  driverShaft.userData.role = 'continuous-input-shaft-through-crank-disk';
  inputRotor.add(driverShaft);

  const driverHub = cylinderAlongZ(
    driverHubRadius,
    diskDepth + 0.19,
    driverMaterial,
    52,
  );
  driverHub.position.z = diskCenterZ + 0.015;
  driverHub.userData.role = 'crank-disk-hub-on-fixed-axis';
  inputRotor.add(driverHub);

  const driverHubOutline = new THREE.Mesh(
    new THREE.TorusGeometry(driverHubRadius - 0.035, 0.045, 10, 56),
    darkMaterial,
  );
  driverHubOutline.position.z = diskFrontZ + 0.06;
  driverHubOutline.userData.role = 'front-outline-of-crank-disk-hub';
  inputRotor.add(driverHubOutline);

  const crankArm = makeBeam(
    new THREE.Vector3(0, 0, crankArmCenterZ),
    new THREE.Vector3(crankRadius, 0, crankArmCenterZ),
    {
      color: PALETTE.ink,
      depth: crankArmDepth,
      thickness: 0.17,
    },
  );
  crankArm.userData.role = 'rigid-four-unit-crank-radius';
  inputRotor.add(crankArm);

  const diskRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.34, 0.035),
    indexMaterial,
  );
  diskRotationIndex.position.set(
    driverDiskRadius * 0.72,
    driverDiskRadius * 0.36,
    diskFrontZ + 0.058,
  );
  diskRotationIndex.rotation.z = -Math.atan2(0.72, 0.36);
  diskRotationIndex.userData.role = 'visible-index-on-continuous-crank-disk';
  inputRotor.add(diskRotationIndex);

  const crankPin = new THREE.Group();
  crankPin.position.set(crankRadius, 0, crankPinCenterZ);
  crankPin.userData.role = 'one-fixed-crank-pin-sliding-in-one-slot';
  inputRotor.add(crankPin);

  const crankPinBody = cylinderAlongZ(
    crankPinRadius,
    crankPinLength,
    pinMaterial,
    48,
  );
  crankPinBody.userData.role = 'source-one-half-radius-fixed-crank-pin';
  crankPin.add(crankPinBody);

  const crankPinRim = new THREE.Mesh(
    new THREE.TorusGeometry(crankPinRadius - 0.022, 0.032, 9, 48),
    darkMaterial,
  );
  crankPinRim.position.z = crankPinLength / 2 + 0.012;
  crankPinRim.userData.role = 'front-rim-of-fixed-crank-pin';
  crankPin.add(crankPinRim);

  const crankPinIndex = new THREE.Mesh(
    new THREE.BoxGeometry(crankPinRadius * 0.72, 0.045, 0.032),
    indexMaterial,
  );
  crankPinIndex.position.set(
    crankPinRadius * 0.34,
    0,
    crankPinLength / 2 + 0.048,
  );
  crankPinIndex.userData.role = 'index-showing-pin-is-fixed-to-crank-disk';
  crankPin.add(crankPinIndex);

  const rocker = new THREE.Group();
  rocker.position.copy(pivotCenter);
  rocker.userData.role = 'one-rigid-slotted-arm-and-toothed-sector';

  const slotCenterY = (slotNearCapDistance + slotFarCapDistance) / 2;
  const slotStraightHalfLength = (
    slotFarCapDistance - slotNearCapDistance
  ) / 2;
  const slotBodyHalfWidth = slotHalfWidth + 0.24;
  const slotBodyShape = horizontalCapsuleRingShape(
    slotHalfWidth,
    slotBodyHalfWidth,
    slotStraightHalfLength,
  );
  const slottedArm = new THREE.Mesh(
    centeredExtrusion(slotBodyShape, rockerDepth, 0),
    drivenMaterial,
  );
  slottedArm.position.set(0, slotCenterY, rockerCenterZ);
  slottedArm.rotation.z = Math.PI / 2;
  slottedArm.userData.role = 'single-straight-ended-slot-in-sector-arm';
  rocker.add(slottedArm);

  const slotOutlineShape = horizontalCapsuleRingShape(
    slotHalfWidth - 0.04,
    slotBodyHalfWidth + 0.04,
    slotStraightHalfLength,
  );
  const slotOutline = new THREE.Mesh(
    centeredExtrusion(slotOutlineShape, 0.035, 0.004),
    darkMaterial,
  );
  slotOutline.position.set(0, slotCenterY, rockerFrontZ + 0.022);
  slotOutline.rotation.z = Math.PI / 2;
  slotOutline.userData.role = 'front-outline-of-one-straight-slot';
  rocker.add(slotOutline);

  const slotFaceShape = horizontalCapsuleRingShape(
    slotHalfWidth + 0.018,
    slotBodyHalfWidth - 0.035,
    slotStraightHalfLength,
  );
  const slotFace = new THREE.Mesh(
    centeredExtrusion(slotFaceShape, 0.025, 0.003),
    drivenMaterial,
  );
  slotFace.position.set(0, slotCenterY, rockerFrontZ + 0.047);
  slotFace.rotation.z = Math.PI / 2;
  slotFace.userData.role = 'blue-face-inside-dark-slot-outline';
  rocker.add(slotFace);

  const armNeck = makeBeam(
    new THREE.Vector3(0, pivotRadius * 0.72, rockerCenterZ),
    new THREE.Vector3(
      0,
      slotNearCapDistance - slotBodyHalfWidth * 0.34,
      rockerCenterZ,
    ),
    {
      color: PALETTE.driven,
      depth: rockerDepth,
      thickness: slotBodyHalfWidth * 1.2,
    },
  );
  armNeck.userData.role = 'rigid-neck-uniting-slot-and-sector-pivot';
  rocker.add(armNeck);

  const annularSectorShape = (
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
  ) => {
    const shape = new THREE.Shape();
    shape.moveTo(
      Math.cos(startAngle) * innerRadius,
      Math.sin(startAngle) * innerRadius,
    );
    shape.lineTo(
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
  };

  const sectorRim = new THREE.Mesh(
    centeredExtrusion(
      annularSectorShape(
        sectorWebInnerRadius,
        sectorRootRadius,
        sectorStartAngle,
        sectorEndAngle,
      ),
      rockerDepth,
      0.012,
    ),
    drivenMaterial,
  );
  sectorRim.position.z = rockerCenterZ;
  sectorRim.userData.role = 'open-webbed-eleven-tooth-sector-rim';
  sectorRim.userData.equivalentFullGearTeeth = sectorEquivalentTeeth;
  sectorRim.userData.gearSector = true;
  sectorRim.userData.pitchRadius = sectorPitchRadius;
  sectorRim.userData.teeth = sectorToothCount;
  rocker.add(sectorRim);

  const sectorSpokeAngles = [-2.55, -1.57, -0.59];
  const sectorSpokes = sectorSpokeAngles.map((angle, index) => {
    const spoke = makeBeam(
      new THREE.Vector3(
        Math.cos(angle) * pivotRadius * 0.72,
        Math.sin(angle) * pivotRadius * 0.72,
        rockerCenterZ,
      ),
      new THREE.Vector3(
        Math.cos(angle) * (sectorRootRadius - 0.12),
        Math.sin(angle) * (sectorRootRadius - 0.12),
        rockerCenterZ,
      ),
      {
        color: PALETTE.driven,
        depth: rockerDepth,
        thickness: 0.2,
      },
    );
    spoke.userData.role = 'rigid-open-sector-web-spoke';
    spoke.userData.index = index;
    return spoke;
  });
  rocker.add(...sectorSpokes);

  const toothProfiles = slottedSectorToothProfiles();
  const sectorToothShape = new THREE.Shape(toothProfiles.tooth);
  const sectorToothGeometry = centeredExtrusion(sectorToothShape, rockerDepth, 0);
  const sectorTeeth = Array.from(
    { length: sectorToothCount },
    (_, toothIndex) => {
      const tooth = new THREE.Mesh(
        sectorToothGeometry.clone(),
        drivenMaterial,
      );
      const centeredIndex = toothIndex - (sectorToothCount - 1) / 2;
      tooth.rotation.z = -Math.PI / 2
        + centeredIndex * sectorAngularPitch;
      tooth.position.z = rockerCenterZ;
      tooth.userData.role = 'tooth-of-rigid-oscillating-sector';
      tooth.userData.index = toothIndex;
      tooth.userData.pitchAngle = tooth.rotation.z;
      rocker.add(tooth);
      return tooth;
    },
  );

  const pivotHub = cylinderAlongZ(
    pivotRadius,
    0.52,
    drivenMaterial,
    56,
  );
  pivotHub.position.z = rockerCenterZ;
  pivotHub.userData.role = 'sector-pivot-hub-with-fixed-axis';
  rocker.add(pivotHub);

  const pivotHubOutline = new THREE.Mesh(
    new THREE.TorusGeometry(pivotRadius - 0.035, 0.045, 10, 56),
    darkMaterial,
  );
  pivotHubOutline.position.z = rockerCenterZ + 0.28;
  pivotHubOutline.userData.role = 'front-outline-of-sector-pivot-hub';
  rocker.add(pivotHubOutline);

  const sectorRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.068, 0.032),
    indexMaterial,
  );
  sectorRotationIndex.position.set(
    0,
    -sectorPitchRadius * 0.66,
    rockerCenterZ + 0.33,
  );
  sectorRotationIndex.userData.role =
    'visible-index-on-oscillating-sector-web';
  rocker.add(sectorRotationIndex);

  const rack = new THREE.Group();
  rack.position.set(sourcePoseRackX, rackReferenceY, 0);
  rack.userData.role = 'one-horizontally-guided-reciprocating-rack';
  rack.userData.linearPitch = rackLinearPitch;
  rack.userData.toothCount = rackToothCount;

  const rackBody = new THREE.Mesh(
    new THREE.BoxGeometry(
      rackHalfLength * 2,
      rackBodyHeight,
      rackDepth,
    ),
    drivenMaterial,
  );
  rackBody.position.set(0, rackBodyCenterY, rackCenterZ);
  rackBody.userData.role = 'source-thirty-unit-horizontal-rack-bar';
  rack.add(rackBody);

  const rackEndCaps = [-1, 1].map((sideSign) => {
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, rackBodyHeight * 0.82, rackDepth + 0.04),
      darkMaterial,
    );
    cap.position.set(
      sideSign * rackHalfLength,
      rackBodyCenterY,
      rackCenterZ,
    );
    cap.userData.role = 'dark-end-of-reciprocating-rack';
    cap.userData.side = sideSign < 0 ? 'left' : 'right';
    rack.add(cap);
    return cap;
  });

  const rackPitchLocalY = -sectorPitchRadius - rackReferenceY;
  const rackToothShape = new THREE.Shape(toothProfiles.rack.map(p =>
    new THREE.Vector2(p.x, p.y + rackPitchLocalY)));
  const rackToothGeometry = centeredExtrusion(rackToothShape, rackDepth, 0);
  const rackTeeth = Array.from({ length: rackToothCount }, (_, toothIndex) => {
    const tooth = new THREE.Mesh(rackToothGeometry.clone(), drivenMaterial);
    const centeredIndex = toothIndex - (rackToothCount - 1) / 2;
    tooth.position.set(
      centeredIndex * rackLinearPitch,
      0,
      rackCenterZ,
    );
    tooth.userData.role = 'tooth-of-horizontal-reciprocating-rack';
    tooth.userData.index = toothIndex;
    tooth.userData.pitchPosition = tooth.position.x;
    rack.add(tooth);
    return tooth;
  });

  const rackIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.16, 0.032),
    indexMaterial,
  );
  rackIndex.position.set(
    rackHalfLength * 0.66,
    rackBodyCenterY,
    rackFrontZ + 0.035,
  );
  rackIndex.userData.role = 'visible-index-on-translating-rack';
  rack.add(rackIndex);

  const pivotShaft = cylinderAlongZ(
    pivotShaftRadius,
    pivotShaftLength,
    darkMaterial,
    40,
  );
  pivotShaft.position.set(
    pivotCenter.x,
    pivotCenter.y,
    pivotShaftCenterZ,
  );
  pivotShaft.userData.role = 'fixed-shaft-through-sector-pivot';

  const driverBearing = new THREE.Mesh(
    new THREE.TorusGeometry(driverHubRadius + 0.08, 0.08, 10, 56),
    frameMaterial,
  );
  driverBearing.position.set(
    driverCenter.x,
    driverCenter.y,
    frameZ + 0.04,
  );
  driverBearing.userData.role = 'fixed-rear-bearing-of-crank-disk';

  const pivotBearing = new THREE.Mesh(
    new THREE.TorusGeometry(pivotRadius + 0.08, 0.08, 10, 56),
    frameMaterial,
  );
  pivotBearing.position.set(
    pivotCenter.x,
    pivotCenter.y,
    frameZ + 0.04,
  );
  pivotBearing.userData.role = 'fixed-rear-bearing-of-sector-pivot';

  const rearCenterRail = makeBeam(
    new THREE.Vector3(pivotCenter.x, pivotCenter.y, frameZ),
    new THREE.Vector3(driverCenter.x, driverCenter.y, frameZ),
    { color: PALETTE.frame, depth: 0.2, thickness: 0.17 },
  );
  rearCenterRail.userData.role = 'fixed-rail-holding-crank-and-sector-centers';

  const lowerFrameY = rackReferenceY + rackBodyBottom - 0.42;
  const lowerFrameRail = makeBeam(
    new THREE.Vector3(-guideCenterX - 0.9, lowerFrameY, frameZ),
    new THREE.Vector3(guideCenterX + 0.9, lowerFrameY, frameZ),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.18 },
  );
  lowerFrameRail.userData.role = 'fixed-base-supporting-two-rack-guides';

  const pivotFramePost = makeBeam(
    new THREE.Vector3(pivotCenter.x, lowerFrameY, frameZ),
    new THREE.Vector3(pivotCenter.x, pivotCenter.y, frameZ),
    { color: PALETTE.frame, depth: 0.2, thickness: 0.17 },
  );
  pivotFramePost.userData.role = 'fixed-post-supporting-sector-pivot';

  const rackGuideAssemblies = [-1, 1].map((sideSign) => {
    const guide = new THREE.Group();
    guide.position.set(sideSign * guideCenterX, rackReferenceY, 0);
    guide.userData.role = 'fixed-bored-guide-around-horizontal-rack';
    guide.userData.side = sideSign < 0 ? 'left' : 'right';

    const plateHeight = 2.1875;
    const plateWidth = 0.625;
    const frontPlate = new THREE.Mesh(
      new THREE.BoxGeometry(plateWidth, plateHeight, guidePlateDepth),
      frameMaterial,
    );
    frontPlate.position.set(0, 0.125, rackFrontZ + 0.12);
    frontPlate.userData.role = 'front-strap-of-fixed-rack-guide';

    const rearPlate = new THREE.Mesh(
      new THREE.BoxGeometry(plateWidth, plateHeight, guidePlateDepth),
      frameMaterial,
    );
    rearPlate.position.set(0, 0.125, rackCenterZ - rackDepth / 2 - 0.12);
    rearPlate.userData.role = 'rear-strap-of-fixed-rack-guide';

    const guideShoes = [-1, 1].map((verticalSign) => {
      const shoe = new THREE.Mesh(
        new THREE.BoxGeometry(
          plateWidth,
          0.12,
          rackDepth + 0.32,
        ),
        darkMaterial,
      );
      shoe.position.set(
        0,
        verticalSign < 0
          ? rackBodyBottom - 0.08
          : rackToothRootY + 0.08,
        rackCenterZ,
      );
      shoe.userData.role = 'fixed-wear-shoe-constraining-rack-translation';
      shoe.userData.side = verticalSign < 0 ? 'lower' : 'upper';
      return shoe;
    });

    const guideBolts = [-0.68, 0.93].map((offsetY, boltIndex) => {
      const bolt = cylinderAlongZ(0.085, 0.18, darkMaterial, 24);
      bolt.position.set(0, offsetY, rackFrontZ + 0.21);
      bolt.userData.role = 'fixed-bolt-in-rack-guide-strap';
      bolt.userData.index = boltIndex;
      return bolt;
    });
    guide.add(frontPlate, rearPlate, ...guideShoes, ...guideBolts);
    return guide;
  });

  const pitchContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 18, 12),
    indexMaterial,
  );
  pitchContactMarker.position.copy(pitchContactPoint);
  pitchContactMarker.position.z = rackFrontZ + 0.16;
  pitchContactMarker.userData.role = 'fixed-marker-at-sector-rack-pitch-contact';
  pitchContactMarker.castShadow = false;
  pitchContactMarker.receiveShadow = false;

  const cameraFitPoints = [
    new THREE.Vector3(
      -rackHalfLength - rackHalfTravel - 0.25,
      rackReferenceY + rackBodyCenterY,
      0,
    ),
    new THREE.Vector3(
      rackHalfLength + rackHalfTravel + 0.25,
      rackReferenceY + rackBodyCenterY,
      0,
    ),
    new THREE.Vector3(
      driverCenter.x,
      driverCenter.y + driverDiskRadius + 0.2,
      0,
    ),
  ];
  const cameraFitGuides = cameraFitPoints.map((point, index) => {
    const guide = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshBasicMaterial({
        color: PALETTE.paper,
        depthWrite: false,
        opacity: 0,
        transparent: true,
      }),
    );
    guide.position.copy(point);
    guide.userData.cameraFitGuide = true;
    guide.userData.index = index;
    return guide;
  });

  root.add(
    ...cameraFitGuides,
    lowerFrameRail,
    pivotFramePost,
    rearCenterRail,
    driverBearing,
    pivotBearing,
    pivotShaft,
    ...rackGuideAssemblies,
    pitchContactMarker,
    input,
    rocker,
    rack,
  );

  const configurationAtInputAngle = (inputAngle) => {
    const crankAngle = sourcePoseInputAngle + inputAngle;
    const crankCosine = Math.cos(crankAngle);
    const crankSine = Math.sin(crankAngle);
    const pinPoint = new THREE.Vector3(
      driverCenter.x + crankRadius * crankCosine,
      driverCenter.y + crankRadius * crankSine,
      crankPinCenterZ,
    );
    const pinFromPivot = new THREE.Vector2(
      pinPoint.x - pivotCenter.x,
      pinPoint.y - pivotCenter.y,
    );
    const pinPivotRadiusSquared = pinFromPivot.lengthSq();
    const pinPivotRadius = Math.sqrt(pinPivotRadiusSquared);
    const rockerAngle = Math.atan2(pinFromPivot.y, pinFromPivot.x)
      - Math.PI / 2;
    const rockerAnglePerInputRadian = (
      crankRadius ** 2
        + centerDistance * crankRadius * crankSine
    ) / pinPivotRadiusSquared;
    const rockerAngleSecondPerInputRadian = centerDistance * crankRadius
      * (centerDistance ** 2 - crankRadius ** 2)
      * crankCosine / pinPivotRadiusSquared ** 2;
    const slotAxis = new THREE.Vector3(
      pinFromPivot.x / pinPivotRadius,
      pinFromPivot.y / pinPivotRadius,
      0,
    );
    const slotNormal = new THREE.Vector3(
      -slotAxis.y,
      slotAxis.x,
      0,
    );
    const rackX = sectorPitchRadius * rockerAngle;
    return {
      crankAngle,
      crankCosine,
      crankSine,
      inputAngle,
      pinFromPivot,
      pinPivotRadius,
      pinPivotRadiusSquared,
      pinPoint,
      rackX,
      rockerAngle,
      rockerAnglePerInputRadian,
      rockerAngleSecondPerInputRadian,
      slotAxis,
      slotCoordinate: pinPivotRadius,
      slotNormal,
    };
  };

  const stateAtInputKinematics = ({
    inputAngle,
    inputAngularAcceleration,
    inputAngularVelocity,
  }) => {
    const configuration = configurationAtInputAngle(inputAngle);
    const pinVelocity = new THREE.Vector3(
      -crankRadius * configuration.crankSine * inputAngularVelocity,
      crankRadius * configuration.crankCosine * inputAngularVelocity,
      0,
    );
    const pinAcceleration = new THREE.Vector3(
      -crankRadius * configuration.crankCosine
          * inputAngularVelocity ** 2
        - crankRadius * configuration.crankSine
          * inputAngularAcceleration,
      -crankRadius * configuration.crankSine
          * inputAngularVelocity ** 2
        + crankRadius * configuration.crankCosine
          * inputAngularAcceleration,
      0,
    );
    const rockerAngularSpeed = configuration.rockerAnglePerInputRadian
      * inputAngularVelocity;
    const rockerAngularAcceleration =
      configuration.rockerAngleSecondPerInputRadian
        * inputAngularVelocity ** 2
      + configuration.rockerAnglePerInputRadian
        * inputAngularAcceleration;
    const leverVelocityAtPin = new THREE.Vector3(
      -configuration.pinFromPivot.y * rockerAngularSpeed,
      configuration.pinFromPivot.x * rockerAngularSpeed,
      0,
    );
    const relativeCenterVelocity = pinVelocity.clone().sub(
      leverVelocityAtPin,
    );
    const centerlineNormalError = configuration.pinFromPivot.x
        * configuration.slotNormal.x
      + configuration.pinFromPivot.y * configuration.slotNormal.y;
    const centerlineNormalVelocity = relativeCenterVelocity.dot(
      configuration.slotNormal,
    );
    const centerlineSlidingSpeed = relativeCenterVelocity.dot(
      configuration.slotAxis,
    );
    const slotDistanceRate = configuration.pinFromPivot.x * pinVelocity.x
        + configuration.pinFromPivot.y * pinVelocity.y;
    const resolvedSlotDistanceRate = slotDistanceRate
      / configuration.pinPivotRadius;
    const rackVelocityX = sectorPitchRadius * rockerAngularSpeed;
    const rackAccelerationX = sectorPitchRadius
      * rockerAngularAcceleration;
    const sectorPitchSurfaceVelocity = new THREE.Vector3(
      sectorPitchRadius * rockerAngularSpeed,
      0,
      0,
    );
    const rackPitchSurfaceVelocity = new THREE.Vector3(
      rackVelocityX,
      0,
      0,
    );
    const wallContacts = [-1, 1].map((sideSign) => {
      const wallPoint = configuration.pinPoint.clone().addScaledVector(
        configuration.slotNormal,
        sideSign * slotHalfWidth,
      );
      const pinSurfacePoint = configuration.pinPoint.clone().addScaledVector(
        configuration.slotNormal,
        sideSign * crankPinRadius,
      );
      const wallRadiusVector = wallPoint.clone().sub(new THREE.Vector3(
        pivotCenter.x,
        pivotCenter.y,
        crankPinCenterZ,
      ));
      const wallSurfaceVelocity = new THREE.Vector3(
        -wallRadiusVector.y * rockerAngularSpeed,
        wallRadiusVector.x * rockerAngularSpeed,
        0,
      );
      const pinSurfaceOffset = pinSurfacePoint.clone().sub(
        configuration.pinPoint,
      );
      const pinSurfaceVelocity = pinVelocity.clone().add(new THREE.Vector3(
        -pinSurfaceOffset.y * inputAngularVelocity,
        pinSurfaceOffset.x * inputAngularVelocity,
        0,
      ));
      const wallToPinNormal = configuration.slotNormal.clone()
        .multiplyScalar(-sideSign);
      const relativeSurfaceVelocity = pinSurfaceVelocity.clone().sub(
        wallSurfaceVelocity,
      );
      return {
        centerDistance: slotHalfWidth,
        normalVelocityError: relativeSurfaceVelocity.dot(wallToPinNormal),
        pinSurfacePoint,
        pinSurfaceVelocity,
        side: sideSign < 0 ? 'left-wall' : 'right-wall',
        surfaceGap: pinSideRunningClearance,
        surfaceSlipSpeed: relativeSurfaceVelocity.dot(
          configuration.slotAxis,
        ),
        wallPoint,
        wallSurfaceVelocity,
        wallToPinNormal,
      };
    });
    const reversalTolerance = 1e-10;
    let stage;
    if (Math.abs(rackVelocityX) <= reversalTolerance) {
      stage = 'toothed-sector-and-rack-at-reversal';
    } else if (rackVelocityX > 0) {
      stage = 'toothed-sector-drives-rack-right';
    } else {
      stage = 'toothed-sector-drives-rack-left';
    }
    return {
      ...configuration,
      centerlineNormalError,
      centerlineNormalVelocity,
      centerlineSlidingSpeed,
      gearRackPhaseError: configuration.rackX
        - sectorPitchRadius * configuration.rockerAngle,
      inputAngularAcceleration,
      inputAngularVelocity,
      inputRevolutions: inputAngle / fullTurn,
      leverVelocityAtPin,
      pinAcceleration,
      pinAngularSpeed: inputAngularVelocity,
      pinFixedToCrankDisk: true,
      pinVelocity,
      pitchContactPoint: pitchContactPoint.clone(),
      pitchLineVelocityError: sectorPitchSurfaceVelocity.clone().sub(
        rackPitchSurfaceVelocity,
      ),
      rackAccelerationX,
      rackPitchSurfaceVelocity,
      rackVelocityX,
      relativeCenterVelocity,
      resolvedSlotDistanceRate,
      rockerAngularAcceleration,
      rockerAngularSpeed,
      sectorPitchSurfaceVelocity,
      slotDistanceRate: resolvedSlotDistanceRate,
      stage,
      velocityDiscontinuous: false,
      wallContacts,
    };
  };

  const stateAtInputAngle = (inputAngle) => stateAtInputKinematics({
    inputAngle,
    inputAngularAcceleration: 0,
    inputAngularVelocity: inputAngularSpeed,
  });
  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
  );

  root.userData.mechanism = 'crank-pin-slotted-sector-horizontal-rack';
  root.userData.cameraDistanceScale = 1.03;
  root.userData.hideGround = true;
  root.userData.supportsRestart = true;
  // The engraved pin almost fills the slot. A 0.001-unit radial running gap
  // bounds the ideal centreline constraint error to about 0.045 source pixels.
  // These old overlays narrowed the actual opening and crossed the pin.
  for (const detail of [slotOutline, slotFace, crankArm, diskRotationIndex,
    crankPinIndex, sectorRotationIndex, rackIndex, pitchContactMarker]) {
    detail.visible = false;
  }
  root.userData.animationTiming = {authoredCyclePeriod: cyclePeriod};
  root.userData.minimumDisplayCycleSeconds = cyclePeriod;
  root.userData.toothProfiles = toothProfiles;
  root.userData.blocks = {
    armNeck,
    cameraFitGuides,
    crankArm,
    crankPin,
    crankPinBody,
    crankPinIndex,
    crankPinRim,
    diskRotationIndex,
    driverBearing,
    driverDisk,
    driverDiskRim,
    driverHub,
    driverHubOutline,
    driverShaft,
    input,
    inputRotor,
    lowerFrameRail,
    pitchContactMarker,
    pivotBearing,
    pivotFramePost,
    pivotHub,
    pivotHubOutline,
    pivotShaft,
    rack,
    rackBody,
    rackEndCaps,
    rackGuideAssemblies,
    rackIndex,
    rackTeeth,
    rearCenterRail,
    rocker,
    sectorRim,
    sectorRotationIndex,
    sectorSpokes,
    sectorTeeth,
    slotFace,
    slotOutline,
    slottedArm,
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    centerDistance,
    crankArmCenterZ,
    crankArmDepth,
    crankPinCenterZ,
    crankPinFrontZ,
    crankPinLength,
    crankPinRadius,
    crankRadius,
    cyclePeriod,
    diskCenterZ,
    diskDepth,
    diskFrontZ,
    driverCenter: driverCenter.clone(),
    driverDiskRadius,
    driverHubRadius,
    driverShaftCenterZ,
    driverShaftLength,
    driverShaftRadius,
    frameZ,
    fullTurn,
    guideCenterX,
    inputAngularSpeed,
    maximumPinPivotRadius,
    minimumPinPivotRadius,
    pinSideRunningClearance,
    pitchContactPoint: pitchContactPoint.clone(),
    pivotCenter: pivotCenter.clone(),
    pivotRadius,
    pivotShaftCenterZ,
    pivotShaftLength,
    pivotShaftRadius,
    rackBodyBottom,
    rackBodyCenterY,
    rackBodyHeight,
    rackCenterZ,
    rackDepth,
    rackFrontZ,
    rackHalfLength,
    rackHalfTravel,
    rackLinearPitch,
    rackReferenceY,
    rackStroke,
    rackToothCount,
    rackToothRootY,
    rackToothTipY,
    rockerAngularStroke,
    rockerCenterZ,
    rockerDepth,
    rockerFrontZ,
    rockerHalfSwing,
    sectorAngularPitch,
    sectorEndAngle,
    sectorEquivalentTeeth,
    sectorOuterRadius,
    sectorPitchRadius,
    sectorRootRadius,
    sectorStartAngle,
    sectorToothCount,
    sectorWebInnerRadius,
    slotBodyHalfWidth,
    slotCenterY,
    slotEndRunningClearance,
    slotFarCapDistance,
    slotHalfWidth,
    slotNearCapDistance,
    slotStraightHalfLength,
    sourceCenterDistance,
    sourceCrankPinRadius,
    sourceCrankRadius,
    sourceDriverDiskRadius,
    sourceEquivalentSectorTeeth,
    sourceGuideCenterX,
    sourcePivotRadius,
    sourcePoseInputAngle,
    sourcePoseRackX,
    sourcePoseRockerAngle,
    sourceRackBodyBottom,
    sourceRackHalfLength,
    sourceRackReferenceY,
    sourceRackToothRootY,
    sourceRackToothTipY,
    sourceScale,
    sourceSectorPitchRadius,
    sourceSlotFarCapDistance,
    sourceSlotHalfWidth,
    sourceSlotNearCapDistance,
  };
  root.userData.configurationAtInputAngle = configurationAtInputAngle;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtInputKinematics = stateAtInputKinematics;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.set(0, 0, state.inputAngle);
    input.userData.angularSpeed = state.inputAngularVelocity;
    rocker.rotation.set(0, 0, state.rockerAngle);
    rocker.userData.angularSpeed = state.rockerAngularSpeed;
    rocker.userData.angularAcceleration = state.rockerAngularAcceleration;
    rack.position.set(state.rackX, rackReferenceY, 0);
    rack.userData.velocity = new THREE.Vector3(state.rackVelocityX, 0, 0);
    rack.userData.acceleration = new THREE.Vector3(
      state.rackAccelerationX,
      0,
      0,
    );
    root.userData.contacts = {
      crankPinStraightSlot: {
        centerlineNormalError: state.centerlineNormalError,
        centerlineNormalVelocity: state.centerlineNormalVelocity,
        centerlineSlidingSpeed: state.centerlineSlidingSpeed,
        oneFixedCrankPin: true,
        oneStraightSlot: true,
        pinSideRunningClearance,
        slotCoordinate: state.slotCoordinate,
        slotEndRunningClearance,
        wallContacts: state.wallContacts.map((contact) => ({
          ...contact,
          pinSurfacePoint: contact.pinSurfacePoint.clone(),
          pinSurfaceVelocity: contact.pinSurfaceVelocity.clone(),
          wallPoint: contact.wallPoint.clone(),
          wallSurfaceVelocity: contact.wallSurfaceVelocity.clone(),
          wallToPinNormal: contact.wallToPinNormal.clone(),
        })),
      },
      sectorRackPitchLine: {
        contactPoint: state.pitchContactPoint.clone(),
        phaseError: state.gearRackPhaseError,
        rackSurfaceVelocity: state.rackPitchSurfaceVelocity.clone(),
        sectorSurfaceVelocity: state.sectorPitchSurfaceVelocity.clone(),
        velocityError: state.pitchLineVelocityError.clone(),
      },
      rackGuides: {
        axis: X_AXIS.clone(),
        lineError: Math.abs(rack.position.y - rackReferenceY),
        rotationError: Math.abs(rack.rotation.z),
      },
      sectorPivot: {
        axis: Z_AXIS.clone(),
        centerError: rocker.position.distanceTo(pivotCenter),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);

  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  const model = finish(root, update, new THREE.Vector3(.2, .15, 15.8));
  model.reset = () => update(0);
  pitchContactMarker.castShadow = false;
  pitchContactMarker.receiveShadow = false;
  return model;
}

function twinObliqueRodTogglePressMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.016;
  const sourceRasterAxisX = 270;
  const sourceRasterUpperLinkY = 235;
  const sourceRasterLowerLinkY = 346;
  const sourceRasterHoleRadius = 52;
  const sourceRasterUpperDiskRadius = 79;
  const sourceRasterPlatenHalfWidth = 159;
  const sourceRasterColumnHalfSpan = 168;
  const sourceRasterHandleLength = 233;
  const sourceRasterHandleY = 137;
  const sourceRasterTopFrameY = 72;
  const sourceRasterPlatenCenterY = 385;
  const sourceRasterBedTopY = 482;
  const sourceOpenRelativeAngle = Math.PI * 2 / 3;

  const upperLinkY = 1.1;
  const openDiskSeparation = (
    sourceRasterLowerLinkY - sourceRasterUpperLinkY
  ) * sourceScale;
  const linkHoleRadius = sourceRasterHoleRadius * sourceScale;
  const upperDiskRadius = sourceRasterUpperDiskRadius * sourceScale;
  const platenHalfWidth = sourceRasterPlatenHalfWidth * sourceScale;
  const columnHalfSpan = sourceRasterColumnHalfSpan * sourceScale;
  const handleOuterRadius = sourceRasterHandleLength * sourceScale;
  const handleY = upperLinkY + (
    sourceRasterUpperLinkY - sourceRasterHandleY
  ) * sourceScale;
  const topFrameY = upperLinkY + (
    sourceRasterUpperLinkY - sourceRasterTopFrameY
  ) * sourceScale;
  const lowerDiskToPlatenCenter = (
    sourceRasterPlatenCenterY - sourceRasterLowerLinkY
  ) * sourceScale;
  const bedTopY = upperLinkY - (
    sourceRasterBedTopY - sourceRasterUpperLinkY
  ) * sourceScale;
  const openChordLength = 2 * linkHoleRadius
    * Math.sin(sourceOpenRelativeAngle / 2);
  const linkLength = Math.hypot(openDiskSeparation, openChordLength);
  const closedDiskSeparation = linkLength;
  const platenStroke = closedDiskSeparation - openDiskSeparation;
  const openLowerDiskY = upperLinkY - openDiskSeparation;
  const closedLowerDiskY = upperLinkY - closedDiskSeparation;
  const minimumRodSeparation = 2 * linkHoleRadius
    * Math.cos(sourceOpenRelativeAngle / 2);
  const cyclePeriod = 10;
  const cycleAngularSpeed = fullTurn / cyclePeriod;
  const rodThickness = 0.17;
  const rodJointRadius = 0.15;
  const upperDiskDepth = 0.28;
  const lowerDiskDepth = 0.24;
  const platenHeight = 0.58;
  const platenDepth = 2.28;
  const upperShaftRadius = 0.19;
  const upperShaftTopY = topFrameY + 0.95;
  const upperShaftBottomY = upperLinkY - 0.18;
  const upperShaftLength = upperShaftTopY - upperShaftBottomY;
  const upperShaftCenterY = (
    upperShaftTopY + upperShaftBottomY
  ) / 2;
  const upperBellHeight = 1.18;
  const upperBellCenterY = upperLinkY + upperDiskDepth / 2
    + upperBellHeight / 2 - 0.02;
  const upperNeckRadius = 0.39;
  const upperNeckHeight = Math.max(
    0.46,
    handleY - (upperBellCenterY + upperBellHeight / 2) + 0.22,
  );
  const upperNeckCenterY = handleY - upperNeckHeight / 2 + 0.08;
  const handleInnerRadius = 0.22;
  const handleGripLength = 0.72;
  const handleLocalAngle = -sourceOpenRelativeAngle;
  const lowerPlatenCenterLocalY = -lowerDiskToPlatenCenter;
  const lowerPlatenBottomLocalY = lowerPlatenCenterLocalY
    - platenHeight / 2;
  const lowerPlatenTopLocalY = lowerPlatenCenterLocalY
    + platenHeight / 2;
  const closedPlatenBottomY = closedLowerDiskY
    + lowerPlatenBottomLocalY;
  const workpieceHeight = closedPlatenBottomY - bedTopY;
  const workpieceTopY = bedTopY + workpieceHeight;
  const frameDepth = 2.48;
  const frameBackZ = -1.1;

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
  const pinMaterial = matte(PALETTE.brass, {
    metalness: 0.28,
    roughness: 0.45,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const upperInput = new THREE.Group();
  upperInput.userData.axis = Y_AXIS.clone();
  upperInput.userData.role =
    'fixed-height-upper-disk-with-horizontal-hand-lever';
  const upperRotor = new THREE.Group();
  upperRotor.userData.role =
    'one-rigid-upper-disk-bell-shaft-and-lever-rotor';
  upperInput.add(upperRotor);
  upperInput.userData.rotor = upperRotor;

  const upperDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(
      upperDiskRadius,
      upperDiskRadius,
      upperDiskDepth,
      80,
    ),
    driverMaterial,
  );
  upperDisk.position.y = upperLinkY;
  upperDisk.userData.role = 'upper-rotating-link-hole-disk';
  upperRotor.add(upperDisk);

  const horizontalTorus = (radius, tube, material, segments = 72) => {
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 10, segments),
      material,
    );
    torus.rotation.x = Math.PI / 2;
    return torus;
  };

  const upperDiskRims = [-1, 1].map((sideSign) => {
    const rim = horizontalTorus(
      upperDiskRadius - 0.045,
      0.05,
      darkMaterial,
      80,
    );
    rim.position.y = upperLinkY + sideSign * upperDiskDepth / 2;
    rim.userData.role = 'edge-outline-of-upper-rotating-disk';
    rim.userData.side = sideSign < 0 ? 'lower' : 'upper';
    upperRotor.add(rim);
    return rim;
  });

  const upperBell = new THREE.Mesh(
    new THREE.CylinderGeometry(
      upperNeckRadius,
      upperDiskRadius * 0.82,
      upperBellHeight,
      72,
    ),
    driverMaterial,
  );
  upperBell.position.y = upperBellCenterY;
  upperBell.userData.role = 'flared-body-rigid-with-upper-disk';
  upperRotor.add(upperBell);

  const upperBellRim = horizontalTorus(
    upperDiskRadius * 0.82 - 0.035,
    0.045,
    darkMaterial,
    72,
  );
  upperBellRim.position.y = upperBellCenterY - upperBellHeight / 2 + 0.02;
  upperBellRim.userData.role = 'outline-of-flared-upper-press-body';
  upperRotor.add(upperBellRim);

  const upperNeck = new THREE.Mesh(
    new THREE.CylinderGeometry(
      upperNeckRadius,
      upperNeckRadius,
      upperNeckHeight,
      52,
    ),
    driverMaterial,
  );
  upperNeck.position.y = upperNeckCenterY;
  upperNeck.userData.role = 'upper-rotor-neck-carrying-hand-lever';
  upperRotor.add(upperNeck);

  const upperShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(
      upperShaftRadius,
      upperShaftRadius,
      upperShaftLength,
      40,
    ),
    darkMaterial,
  );
  upperShaft.position.y = upperShaftCenterY;
  upperShaft.userData.role =
    'vertical-shaft-rotating-without-axial-translation';
  upperRotor.add(upperShaft);

  const handleStart = new THREE.Vector3(
    Math.cos(handleLocalAngle) * handleInnerRadius,
    handleY,
    -Math.sin(handleLocalAngle) * handleInnerRadius,
  );
  const handleEnd = new THREE.Vector3(
    Math.cos(handleLocalAngle) * handleOuterRadius,
    handleY,
    -Math.sin(handleLocalAngle) * handleOuterRadius,
  );
  const handLever = makeBeam(handleStart, handleEnd, {
    color: PALETTE.driver,
    depth: 0.2,
    jointRadius: 0.13,
    thickness: 0.17,
  });
  handLever.userData.role =
    'horizontal-hand-lever-rigid-with-upper-disk';
  upperRotor.add(handLever);

  const handleGripStartRadius = handleOuterRadius - handleGripLength;
  const handleGrip = makeBeam(
    new THREE.Vector3(
      Math.cos(handleLocalAngle) * handleGripStartRadius,
      handleY,
      -Math.sin(handleLocalAngle) * handleGripStartRadius,
    ),
    handleEnd,
    {
      color: PALETTE.ink,
      depth: 0.25,
      jointRadius: 0.14,
      thickness: 0.22,
    },
  );
  handleGrip.userData.role = 'dark-grip-at-end-of-upper-disk-lever';
  upperRotor.add(handleGrip);

  const upperRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.035, 0.12),
    indexMaterial,
  );
  upperRotationIndex.position.set(
    upperDiskRadius * 0.91,
    upperLinkY + upperDiskDepth / 2 + 0.04,
    0,
  );
  upperRotationIndex.userData.role =
    'visible-index-on-rotating-upper-disk';
  upperRotor.add(upperRotationIndex);

  const makeHorizontalSocket = (role) => {
    const socket = new THREE.Group();
    socket.userData.role = role;
    const ring = horizontalTorus(rodJointRadius + 0.035, 0.045, darkMaterial, 36);
    ring.userData.role = 'dark-rim-of-link-rod-hole';
    const liner = new THREE.Mesh(
      new THREE.CylinderGeometry(
        rodJointRadius * 0.66,
        rodJointRadius * 0.66,
        0.08,
        30,
      ),
      pinMaterial,
    );
    liner.userData.role = 'brass-liner-in-link-rod-hole';
    socket.add(ring, liner);
    return socket;
  };

  const upperSockets = [1, -1].map((sideSign, index) => {
    const socket = makeHorizontalSocket(
      'upper-hole-revolving-with-fixed-height-disk',
    );
    socket.position.set(sideSign * linkHoleRadius, upperLinkY, 0);
    socket.userData.index = index;
    upperRotor.add(socket);
    return socket;
  });

  const lowerAssembly = new THREE.Group();
  lowerAssembly.position.y = openLowerDiskY;
  lowerAssembly.userData.role =
    'guided-nonrotating-lower-disk-and-platen';

  const lowerDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(
      upperDiskRadius,
      upperDiskRadius,
      lowerDiskDepth,
      80,
    ),
    drivenMaterial,
  );
  lowerDisk.userData.role = 'lower-nonrotating-link-hole-disk';
  lowerAssembly.add(lowerDisk);

  const lowerDiskRims = [-1, 1].map((sideSign) => {
    const rim = horizontalTorus(
      upperDiskRadius - 0.045,
      0.05,
      darkMaterial,
      80,
    );
    rim.position.y = sideSign * lowerDiskDepth / 2;
    rim.userData.role = 'edge-outline-of-lower-nonrotating-disk';
    rim.userData.side = sideSign < 0 ? 'lower' : 'upper';
    lowerAssembly.add(rim);
    return rim;
  });

  const lowerSockets = [1, -1].map((sideSign, index) => {
    const socket = makeHorizontalSocket(
      'lower-hole-translating-with-nonrotating-disk',
    );
    socket.position.set(sideSign * linkHoleRadius, 0, 0);
    socket.userData.index = index;
    lowerAssembly.add(socket);
    return socket;
  });

  const lowerDiskPedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(
      upperDiskRadius * 0.72,
      upperDiskRadius * 0.92,
      Math.max(0.18, lowerDiskToPlatenCenter - platenHeight / 2),
      64,
    ),
    drivenMaterial,
  );
  lowerDiskPedestal.position.y = (
    lowerPlatenTopLocalY - lowerDiskDepth / 2
  ) / 2;
  lowerDiskPedestal.userData.role =
    'rigid-pedestal-between-lower-disk-and-platen';
  lowerAssembly.add(lowerDiskPedestal);

  const platen = new THREE.Mesh(
    new THREE.BoxGeometry(
      platenHalfWidth * 2,
      platenHeight,
      platenDepth,
    ),
    drivenMaterial,
  );
  platen.position.y = lowerPlatenCenterLocalY;
  platen.userData.role = 'flat-guided-press-platen';
  lowerAssembly.add(platen);

  const platenFrontBand = new THREE.Mesh(
    new THREE.BoxGeometry(
      platenHalfWidth * 0.98,
      platenHeight * 0.72,
      0.055,
    ),
    darkMaterial,
  );
  platenFrontBand.position.set(
    0,
    lowerPlatenCenterLocalY,
    platenDepth / 2 + 0.035,
  );
  platenFrontBand.userData.role = 'front-outline-band-of-moving-platen';
  lowerAssembly.add(platenFrontBand);

  const platenMotionIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.17, 0.032),
    indexMaterial,
  );
  platenMotionIndex.position.set(
    platenHalfWidth * 0.68,
    lowerPlatenCenterLocalY,
    platenDepth / 2 + 0.085,
  );
  platenMotionIndex.userData.role =
    'visible-index-on-downward-moving-platen';
  lowerAssembly.add(platenMotionIndex);

  const linkRods = [-1, 1].map((sideSign, index) => {
    const upperAngle = sideSign < 0
      ? sourceOpenRelativeAngle
      : sourceOpenRelativeAngle + Math.PI;
    const lowerX = sideSign < 0 ? linkHoleRadius : -linkHoleRadius;
    const rod = makeBeam(
      new THREE.Vector3(
        Math.cos(upperAngle) * linkHoleRadius,
        upperLinkY,
        -Math.sin(upperAngle) * linkHoleRadius,
      ),
      new THREE.Vector3(lowerX, openLowerDiskY, 0),
      {
        color: PALETTE.driven,
        depth: rodThickness,
        jointRadius: rodJointRadius,
        thickness: rodThickness,
      },
    );
    rod.userData.role = 'one-of-two-equal-oblique-toggle-bars';
    rod.userData.index = index;
    rod.userData.nominalLength = linkLength;
    return rod;
  });

  const columnBottomY = bedTopY - 0.12;
  const columnTopY = topFrameY - 0.1;
  const columnHeight = columnTopY - columnBottomY;
  const frameColumns = [-1, 1].map((sideSign) => {
    const column = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, columnHeight, 0.3),
      frameMaterial,
    );
    column.position.set(
      sideSign * columnHalfSpan,
      (columnTopY + columnBottomY) / 2,
      frameBackZ,
    );
    column.userData.role = 'fixed-column-guiding-and-supporting-press';
    column.userData.side = sideSign < 0 ? 'left' : 'right';
    return column;
  });

  const topFrameRails = [-0.18, 0.07, 0.31].map((offsetY, index) => {
    const rail = new THREE.Mesh(
      boredHorizontalPlate({
        outline: [
          [-(columnHalfSpan + .31 - index * .09), -(frameDepth - index * .18) / 2],
          [columnHalfSpan + .31 - index * .09, -(frameDepth - index * .18) / 2],
          [columnHalfSpan + .31 - index * .09, (frameDepth - index * .18) / 2],
          [-(columnHalfSpan + .31 - index * .09), (frameDepth - index * .18) / 2],
        ],
        holes: [{x:0, z:-frameBackZ * .52, radius:upperShaftRadius + .02}],
        depth:.18,
      }),
      frameMaterial,
    );
    rail.position.set(0, topFrameY + offsetY, frameBackZ * 0.52);
    rail.userData.role = 'layer-of-fixed-overhead-press-frame';
    rail.userData.index = index;
    return rail;
  });

  const upperBearingRing = horizontalTorus(
    0.48,
    0.1,
    frameMaterial,
    56,
  );
  upperBearingRing.position.set(0, topFrameY - 0.43, 0);
  upperBearingRing.userData.role =
    'fixed-thrust-bearing-capturing-upper-disk-axially';

  const upperBearingCollar = new THREE.Mesh(
    boredHorizontalPlate({
      outline:Array.from({length:128},(_,i)=>[.55*Math.cos(i*Math.PI/64),.55*Math.sin(i*Math.PI/64)]),
      holes:[{x:0,z:0,radius:upperShaftRadius+.02}],depth:.25,
    }),
    frameMaterial,
  );
  upperBearingCollar.position.y = topFrameY - 0.31;
  upperBearingCollar.userData.role =
    'fixed-collar-around-upper-rotor-shaft';

  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(
      platenHalfWidth * 1.18,
      0.32,
      platenDepth * 1.12,
    ),
    frameMaterial,
  );
  bed.position.set(0, bedTopY - 0.16, 0);
  bed.userData.role = 'fixed-bed-below-moving-platen';

  const workpiece = new THREE.Mesh(
    new THREE.BoxGeometry(
      platenHalfWidth * 0.86,
      workpieceHeight,
      platenDepth * 0.76,
    ),
    pinMaterial,
  );
  workpiece.position.set(0, bedTopY + workpieceHeight / 2, 0);
  workpiece.userData.role = 'stationary-workpiece-on-press-bed';

  const frameFeet = [-1, 0, 1].map((sideSign, index) => {
    const footWidth = sideSign === 0 ? 1.34 : 0.76;
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(footWidth, 0.2, 0.86),
      frameMaterial,
    );
    foot.position.set(
      sideSign * columnHalfSpan,
      bedTopY - 0.42,
      frameBackZ,
    );
    foot.userData.role = sideSign === 0
      ? 'fixed-center-anvil-foot'
      : 'fixed-foot-under-press-column';
    foot.userData.index = index;
    return foot;
  });

  const guideClearance = 0.06;
  const platenGuideCentersX = [-1, 1].map(
    (sideSign) => sideSign * (platenHalfWidth + guideClearance + 0.1),
  );
  const platenGuides = platenGuideCentersX.map((x, index) => {
    const guide = new THREE.Group();
    guide.position.set(x, openLowerDiskY + lowerPlatenCenterLocalY, 0);
    guide.userData.role = 'fixed-vertical-guide-at-platen-edge';
    guide.userData.side = index === 0 ? 'left' : 'right';
    for (const z of [-1, 1]) {
      const shoe = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, platenHeight * 1.75, 0.16),
        darkMaterial,
      );
      shoe.position.z = z * (platenDepth / 2 + 0.09);
      shoe.userData.role = 'fixed-wear-shoe-constraining-platen';
      guide.add(shoe);
    }
    return guide;
  });

  const cameraFitPoints = [
    new THREE.Vector3(-handleOuterRadius - 0.25, handleY, 0),
    new THREE.Vector3(handleOuterRadius + 0.25, handleY, 0),
    new THREE.Vector3(0, handleY, -handleOuterRadius - 0.25),
    new THREE.Vector3(0, handleY, handleOuterRadius + 0.25),
    new THREE.Vector3(
      0,
      closedLowerDiskY + lowerPlatenBottomLocalY - 0.2,
      0,
    ),
    new THREE.Vector3(0, topFrameY + 0.52, 0),
  ];
  const cameraFitGuides = cameraFitPoints.map((point, index) => {
    const guide = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshBasicMaterial({
        color: PALETTE.paper,
        depthWrite: false,
        opacity: 0,
        transparent: true,
      }),
    );
    guide.position.copy(point);
    guide.userData.cameraFitGuide = true;
    guide.userData.index = index;
    return guide;
  });

  root.add(
    ...cameraFitGuides,
    ...frameFeet,
    bed,
    workpiece,
    ...frameColumns,
    ...topFrameRails,
    upperBearingRing,
    upperBearingCollar,
    ...platenGuides,
    upperInput,
    lowerAssembly,
    ...linkRods,
  );

  const pointOnHorizontalCircle = (radius, angle, y) => (
    new THREE.Vector3(
      radius * Math.cos(angle),
      y,
      -radius * Math.sin(angle),
    )
  );

  const stateAtUpperPhaseKinematics = ({
    upperPhase,
    upperPhaseAcceleration,
    upperPhaseVelocity,
  }) => {
    const chordLengthSquared = 2 * linkHoleRadius ** 2
      * (1 - Math.cos(upperPhase));
    const chordLength = Math.sqrt(Math.max(0, chordLengthSquared));
    const diskSeparation = Math.sqrt(
      linkLength ** 2 - chordLengthSquared,
    );
    const diskSeparationPerPhase = -(linkHoleRadius ** 2)
      * Math.sin(upperPhase) / diskSeparation;
    const diskSeparationSecondPerPhase =
      -(linkHoleRadius ** 2) * Math.cos(upperPhase) / diskSeparation
      - linkHoleRadius ** 4 * Math.sin(upperPhase) ** 2
        / diskSeparation ** 3;
    const diskSeparationVelocity = diskSeparationPerPhase
      * upperPhaseVelocity;
    const diskSeparationAcceleration = diskSeparationSecondPerPhase
        * upperPhaseVelocity ** 2
      + diskSeparationPerPhase * upperPhaseAcceleration;
    const lowerDiskY = upperLinkY - diskSeparation;
    const lowerDiskVelocityY = -diskSeparationVelocity;
    const lowerDiskAccelerationY = -diskSeparationAcceleration;
    const downwardDisplacement = diskSeparation - openDiskSeparation;
    const downwardVelocity = diskSeparationVelocity;
    const downwardAcceleration = diskSeparationAcceleration;
    const platenWorkpieceGap = lowerDiskY + lowerPlatenBottomLocalY
      - workpieceTopY;
    const upperJointPoints = [];
    const lowerJointPoints = [];
    const upperJointVelocities = [];
    const lowerJointVelocities = [];
    const upperJointAccelerations = [];
    const lowerJointAccelerations = [];
    const rodLengthErrors = [];
    const rodLengthRateErrors = [];
    const rodLengthAccelerationErrors = [];
    for (let index = 0; index < 2; index += 1) {
      const upperAngle = upperPhase + index * Math.PI;
      const lowerAngle = index * Math.PI;
      const upperPoint = pointOnHorizontalCircle(
        linkHoleRadius,
        upperAngle,
        upperLinkY,
      );
      const lowerPoint = pointOnHorizontalCircle(
        linkHoleRadius,
        lowerAngle,
        lowerDiskY,
      );
      const upperVelocity = new THREE.Vector3(
        -linkHoleRadius * Math.sin(upperAngle) * upperPhaseVelocity,
        0,
        -linkHoleRadius * Math.cos(upperAngle) * upperPhaseVelocity,
      );
      const lowerVelocity = new THREE.Vector3(
        0,
        lowerDiskVelocityY,
        0,
      );
      const upperAcceleration = new THREE.Vector3(
        -linkHoleRadius * Math.cos(upperAngle) * upperPhaseVelocity ** 2
          - linkHoleRadius * Math.sin(upperAngle)
            * upperPhaseAcceleration,
        0,
        linkHoleRadius * Math.sin(upperAngle) * upperPhaseVelocity ** 2
          - linkHoleRadius * Math.cos(upperAngle)
            * upperPhaseAcceleration,
      );
      const lowerAcceleration = new THREE.Vector3(
        0,
        lowerDiskAccelerationY,
        0,
      );
      const rodVector = lowerPoint.clone().sub(upperPoint);
      const relativeVelocity = lowerVelocity.clone().sub(upperVelocity);
      const relativeAcceleration = lowerAcceleration.clone().sub(
        upperAcceleration,
      );
      const actualLength = rodVector.length();
      upperJointPoints.push(upperPoint);
      lowerJointPoints.push(lowerPoint);
      upperJointVelocities.push(upperVelocity);
      lowerJointVelocities.push(lowerVelocity);
      upperJointAccelerations.push(upperAcceleration);
      lowerJointAccelerations.push(lowerAcceleration);
      rodLengthErrors.push(actualLength - linkLength);
      rodLengthRateErrors.push(
        rodVector.dot(relativeVelocity) / actualLength,
      );
      rodLengthAccelerationErrors.push(
        (
          relativeVelocity.lengthSq()
            + rodVector.dot(relativeAcceleration)
        ) / actualLength,
      );
    }
    const handleAngle = upperPhase + handleLocalAngle;
    const handleEndPoint = pointOnHorizontalCircle(
      handleOuterRadius,
      handleAngle,
      handleY,
    );
    const rodsClosestSeparation = 2 * linkHoleRadius
      * Math.cos(upperPhase / 2);
    const downwardTravelPerClosingRadian = upperPhase > 1e-12
      ? -diskSeparationPerPhase
      : 0;
    const idealHandleForceRatio = downwardTravelPerClosingRadian > 1e-12
      ? handleOuterRadius / downwardTravelPerClosingRadian
      : Infinity;
    const atOpenLimit = Math.abs(
      upperPhase - sourceOpenRelativeAngle
    ) < 1e-10;
    const atClosedLimit = upperPhase < 1e-10;
    let stage;
    if (atOpenLimit && Math.abs(upperPhaseVelocity) < 1e-10) {
      stage = 'two-oblique-bars-at-open-press-limit';
    } else if (atClosedLimit && Math.abs(upperPhaseVelocity) < 1e-10) {
      stage = 'two-bars-perpendicular-at-closed-press-limit';
    } else if (upperPhaseVelocity < 0) {
      stage = 'upper-disk-turns-bars-toward-perpendicular';
    } else {
      stage = 'upper-disk-returns-bars-to-oblique-open-position';
    }
    return {
      atClosedLimit,
      atOpenLimit,
      chordLength,
      chordLengthSquared,
      diskSeparation,
      diskSeparationAcceleration,
      diskSeparationPerPhase,
      diskSeparationSecondPerPhase,
      diskSeparationVelocity,
      downwardAcceleration,
      downwardDisplacement,
      downwardTravelPerClosingRadian,
      downwardVelocity,
      handleAngle,
      handleEndPoint,
      idealHandleForceRatio,
      lowerDiskAccelerationY,
      lowerDiskVelocityY,
      lowerDiskY,
      lowerJointAccelerations,
      lowerJointPoints,
      lowerJointVelocities,
      lowerRotation: 0,
      platenInContact: platenWorkpieceGap < 1e-10,
      platenWorkpieceGap: Math.max(0, platenWorkpieceGap),
      rodLengthAccelerationErrors,
      rodLengthErrors,
      rodLengthRateErrors,
      rodsClosestSeparation,
      stage,
      upperAxialTranslation: 0,
      upperJointAccelerations,
      upperJointPoints,
      upperJointVelocities,
      upperPhase,
      upperPhaseAcceleration,
      upperPhaseVelocity,
      velocityDiscontinuous: false,
    };
  };

  const motionAtTime = (time) => {
    const cycleAngle = cycleAngularSpeed * time;
    const upperPhase = sourceOpenRelativeAngle
      * (1 + Math.cos(cycleAngle)) / 2;
    const upperPhaseVelocity = -sourceOpenRelativeAngle
      * cycleAngularSpeed * Math.sin(cycleAngle) / 2;
    const upperPhaseAcceleration = -sourceOpenRelativeAngle
      * cycleAngularSpeed ** 2 * Math.cos(cycleAngle) / 2;
    return {
      cycleAngle,
      upperPhase,
      upperPhaseAcceleration,
      upperPhaseVelocity,
    };
  };
  const stateAtTime = (time) => {
    const motion = motionAtTime(time);
    return {
      ...stateAtUpperPhaseKinematics(motion),
      cycleAngle: motion.cycleAngle,
      cycleIndex: Math.floor(time / cyclePeriod),
      cycleTime: THREE.MathUtils.euclideanModulo(time, cyclePeriod),
    };
  };

  root.userData.mechanism = 'fixed-upper-rotor-two-oblique-rod-toggle-press';
  root.userData.cameraDistanceScale = 1.04;
  root.userData.hideGround = true;
  root.userData.supportsRestart = true;
  root.userData.minimumDisplayCycleSeconds = 4;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4, bedTopY - .6, -2.5),
    new THREE.Vector3(4, topFrameY + 1, 4),
  );
  root.userData.animationTiming = {authoredCyclePeriod:cyclePeriod};
  upperRotationIndex.visible = false;
  platenMotionIndex.visible = false;
  root.userData.blocks = {
    bed,
    cameraFitGuides,
    frameColumns,
    frameFeet,
    handLever,
    handleGrip,
    linkRods,
    lowerAssembly,
    lowerDisk,
    lowerDiskPedestal,
    lowerDiskRims,
    lowerSockets,
    platen,
    platenFrontBand,
    platenGuides,
    platenMotionIndex,
    topFrameRails,
    upperBearingCollar,
    upperBearingRing,
    upperBell,
    upperBellRim,
    upperDisk,
    upperDiskRims,
    upperInput,
    upperNeck,
    upperRotationIndex,
    upperRotor,
    upperShaft,
    upperSockets,
    workpiece,
  };
  root.userData.geometry = {
    axis: Y_AXIS.clone(),
    bedTopY,
    closedDiskSeparation,
    closedLowerDiskY,
    columnHalfSpan,
    cycleAngularSpeed,
    cyclePeriod,
    frameBackZ,
    frameDepth,
    handleGripLength,
    handleInnerRadius,
    handleLocalAngle,
    handleOuterRadius,
    handleY,
    linkHoleRadius,
    linkLength,
    lowerDiskDepth,
    lowerDiskToPlatenCenter,
    lowerPlatenBottomLocalY,
    lowerPlatenCenterLocalY,
    lowerPlatenTopLocalY,
    minimumRodSeparation,
    openChordLength,
    openDiskSeparation,
    openLowerDiskY,
    platenDepth,
    platenGuideCentersX,
    platenHalfWidth,
    platenHeight,
    platenStroke,
    rodJointRadius,
    rodThickness,
    sourceOpenRelativeAngle,
    sourceRasterAxisX,
    sourceRasterBedTopY,
    sourceRasterColumnHalfSpan,
    sourceRasterHandleLength,
    sourceRasterHandleY,
    sourceRasterHoleRadius,
    sourceRasterLowerLinkY,
    sourceRasterPlatenCenterY,
    sourceRasterPlatenHalfWidth,
    sourceRasterTopFrameY,
    sourceRasterUpperDiskRadius,
    sourceRasterUpperLinkY,
    sourceScale,
    topFrameY,
    upperBellCenterY,
    upperBellHeight,
    upperDiskDepth,
    upperDiskRadius,
    upperLinkY,
    upperNeckCenterY,
    upperNeckHeight,
    upperNeckRadius,
    upperShaftBottomY,
    upperShaftCenterY,
    upperShaftLength,
    upperShaftRadius,
    upperShaftTopY,
    workpieceHeight,
    workpieceTopY,
  };
  root.userData.motionAtTime = motionAtTime;
  root.userData.stateAtTime = stateAtTime;
  root.userData.stateAtUpperPhaseKinematics =
    stateAtUpperPhaseKinematics;

  const update = (time) => {
    const state = stateAtTime(time);
    upperRotor.rotation.set(0, state.upperPhase, 0);
    upperInput.userData.angularSpeed = state.upperPhaseVelocity;
    upperInput.userData.axialVelocity = 0;
    lowerAssembly.position.set(0, state.lowerDiskY, 0);
    lowerAssembly.rotation.set(0, 0, 0);
    lowerAssembly.userData.velocity = new THREE.Vector3(
      0,
      state.lowerDiskVelocityY,
      0,
    );
    lowerAssembly.userData.acceleration = new THREE.Vector3(
      0,
      state.lowerDiskAccelerationY,
      0,
    );
    linkRods.forEach((rod, index) => {
      rod.userData.setEndpoints(
        state.upperJointPoints[index],
        state.lowerJointPoints[index],
      );
      rod.userData.lengthError = state.rodLengthErrors[index];
      rod.userData.lengthRateError = state.rodLengthRateErrors[index];
    });
    root.userData.contacts = {
      lowerPlatenGuides: {
        axis: Y_AXIS.clone(),
        lateralError: Math.hypot(
          lowerAssembly.position.x,
          lowerAssembly.position.z,
        ),
        rotationError: Math.hypot(
          lowerAssembly.rotation.x,
          lowerAssembly.rotation.y,
          lowerAssembly.rotation.z,
        ),
      },
      platenWorkpiece: {
        gap: state.platenWorkpieceGap,
        inContact: state.platenInContact,
      },
      obliqueRodJoints: state.rodLengthErrors.map((lengthError, index) => ({
        accelerationError: state.rodLengthAccelerationErrors[index],
        lengthError,
        lowerPoint: state.lowerJointPoints[index].clone(),
        rateError: state.rodLengthRateErrors[index],
        upperPoint: state.upperJointPoints[index].clone(),
      })),
      upperThrustBearing: {
        axis: Y_AXIS.clone(),
        axialTranslation: state.upperAxialTranslation,
        centerError: Math.hypot(upperInput.position.x, upperInput.position.z),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);

  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  const model = finish(root, update, new THREE.Vector3(.2, .35, 12));
  model.reset = () => update(0);
  return model;
}

function leverDrivenTogglePunchPressMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.54;

  // Source coordinates are expressed about the hand-lever pivot.  The two
  // equal toggle links join a fixed upper pivot to a vertically guided punch,
  // while the offset lever pin locates their knee through one connecting link.
  const sourceTopPivot = new THREE.Vector2(-2.75, 4.637165);
  const sourceStrokeX = -2.75;
  const sourceStrokeLineTopY = -1.938634;
  const sourceStrokeLineBottomY = -10.711698;
  const sourceLeverPin = new THREE.Vector2(-0.883883, 0.883883);
  const sourceToggleLinkLength = 4.141288;
  const sourceConnectingLinkLength = 3.616301;
  const sourceLinkBranchReference = new THREE.Vector2(
    -4.828114,
    1.055028,
  );
  const sourceLeverEndDirection = new THREE.Vector2(
    0.122805,
    -2.573501,
  );
  const sourceLeverStartAngle = 0;
  const sourceLeverEndAngle = Math.atan2(
    sourceLeverEndDirection.y,
    sourceLeverEndDirection.x,
  );
  const sourceHandleLength = 10;
  const sourceHandleLocalAngle = THREE.MathUtils.degToRad(35);
  const sourceRamLength = 3.729589;
  const sourceFrameBaseY = -9;

  const topPivot = new THREE.Vector3(
    sourceTopPivot.x * sourceScale,
    sourceTopPivot.y * sourceScale,
    0,
  );
  const strokeX = sourceStrokeX * sourceScale;
  const strokeLineTopY = sourceStrokeLineTopY * sourceScale;
  const strokeLineBottomY = sourceStrokeLineBottomY * sourceScale;
  const leverPinLocal = new THREE.Vector3(
    sourceLeverPin.x * sourceScale,
    sourceLeverPin.y * sourceScale,
    0,
  );
  const toggleLinkLength = sourceToggleLinkLength * sourceScale;
  const connectingLinkLength = sourceConnectingLinkLength * sourceScale;
  const linkBranchReference = new THREE.Vector3(
    sourceLinkBranchReference.x * sourceScale,
    sourceLinkBranchReference.y * sourceScale,
    0,
  );
  const handleLength = sourceHandleLength * sourceScale;
  const handleLocalAngle = sourceHandleLocalAngle;
  const handleLocalEnd = new THREE.Vector3(
    Math.cos(handleLocalAngle) * handleLength,
    Math.sin(handleLocalAngle) * handleLength,
    0,
  );
  const ramLength = sourceRamLength * sourceScale;
  const frameBaseY = sourceFrameBaseY * sourceScale;

  const circleIntersections = (firstCenter, firstRadius,
    secondCenter, secondRadius) => {
    const centerVector = secondCenter.clone().sub(firstCenter);
    const centerDistance = centerVector.length();
    const along = (
      firstRadius ** 2 - secondRadius ** 2 + centerDistance ** 2
    ) / (2 * centerDistance);
    const perpendicularDistance = Math.sqrt(Math.max(
      0,
      firstRadius ** 2 - along ** 2,
    ));
    const unit = centerVector.divideScalar(centerDistance);
    const perpendicular = new THREE.Vector3(-unit.y, unit.x, 0);
    const base = firstCenter.clone().addScaledVector(unit, along);
    return [
      base.clone().addScaledVector(perpendicular, perpendicularDistance),
      base.clone().addScaledVector(perpendicular, -perpendicularDistance),
    ];
  };
  const closestPoint = (points, reference) => (
    points[0].distanceToSquared(reference)
      <= points[1].distanceToSquared(reference)
      ? points[0]
      : points[1]
  );
  const rotatePlanar = (point, angle) => point.clone().applyAxisAngle(
    Z_AXIS,
    angle,
  );

  // The published endpoint is rounded.  Reconstruct the lever-pin endpoint
  // from the exact collinear toggle pose, then retain the source branch.  The
  // reconciliation is about one microradian and removes residual side load at
  // the punch limit.
  const deadCenterKnee = new THREE.Vector3(
    strokeX,
    topPivot.y - toggleLinkLength,
    0,
  );
  const sourceEndPin = rotatePlanar(leverPinLocal, sourceLeverEndAngle);
  const exactEndPin = closestPoint(
    circleIntersections(
      new THREE.Vector3(),
      leverPinLocal.length(),
      deadCenterKnee,
      connectingLinkLength,
    ),
    sourceEndPin,
  );
  const leverStartAngle = sourceLeverStartAngle;
  const leverEndAngle = Math.atan2(exactEndPin.y, exactEndPin.x)
    - Math.atan2(leverPinLocal.y, leverPinLocal.x);
  const sourceEndAngleReconciliation = leverEndAngle - sourceLeverEndAngle;
  const leverAngularTravel = leverStartAngle - leverEndAngle;

  const solveRows = (firstRow, secondRow, firstValue, secondValue) => {
    const determinant = firstRow.x * secondRow.y
      - firstRow.y * secondRow.x;
    return new THREE.Vector3(
      (firstValue * secondRow.y - firstRow.y * secondValue)
        / determinant,
      (firstRow.x * secondValue - firstValue * secondRow.x)
        / determinant,
      0,
    );
  };

  const linkageAtLeverMotion = (
    leverAngle,
    leverAngularSpeed,
    leverAngularAcceleration,
  ) => {
    const leverPinPosition = rotatePlanar(leverPinLocal, leverAngle);
    const angularVelocity = Z_AXIS.clone().multiplyScalar(
      leverAngularSpeed,
    );
    const angularAcceleration = Z_AXIS.clone().multiplyScalar(
      leverAngularAcceleration,
    );
    const leverPinVelocity = new THREE.Vector3().crossVectors(
      angularVelocity,
      leverPinPosition,
    );
    const leverPinAcceleration = new THREE.Vector3().crossVectors(
      angularAcceleration,
      leverPinPosition,
    ).add(new THREE.Vector3().crossVectors(
      angularVelocity,
      leverPinVelocity,
    ));
    const kneePosition = closestPoint(
      circleIntersections(
        leverPinPosition,
        connectingLinkLength,
        topPivot,
        toggleLinkLength,
      ),
      linkBranchReference,
    );
    const connectingVector = kneePosition.clone().sub(leverPinPosition);
    const upperToggleVector = kneePosition.clone().sub(topPivot);
    const kneeVelocity = solveRows(
      connectingVector,
      upperToggleVector,
      connectingVector.dot(leverPinVelocity),
      0,
    );
    const connectingRelativeVelocity = kneeVelocity.clone().sub(
      leverPinVelocity,
    );
    const kneeAcceleration = solveRows(
      connectingVector,
      upperToggleVector,
      connectingVector.dot(leverPinAcceleration)
        - connectingRelativeVelocity.lengthSq(),
      -kneeVelocity.lengthSq(),
    );

    const horizontalOffset = strokeX - kneePosition.x;
    const lowerVerticalProjection = Math.sqrt(Math.max(
      0,
      toggleLinkLength ** 2 - horizontalOffset ** 2,
    ));
    const sliderPinPosition = new THREE.Vector3(
      strokeX,
      kneePosition.y - lowerVerticalProjection,
      0,
    );
    const lowerToggleVector = sliderPinPosition.clone().sub(kneePosition);
    const sliderVelocityY = lowerToggleVector.dot(kneeVelocity)
      / lowerToggleVector.y;
    const sliderPinVelocity = new THREE.Vector3(0, sliderVelocityY, 0);
    const lowerRelativeVelocity = sliderPinVelocity.clone().sub(
      kneeVelocity,
    );
    const sliderAccelerationY = (
      lowerToggleVector.dot(kneeAcceleration)
        - lowerRelativeVelocity.lengthSq()
    ) / lowerToggleVector.y;
    const sliderPinAcceleration = new THREE.Vector3(
      0,
      sliderAccelerationY,
      0,
    );
    const handleEndPosition = rotatePlanar(handleLocalEnd, leverAngle);
    const handleEndVelocity = new THREE.Vector3().crossVectors(
      angularVelocity,
      handleEndPosition,
    );
    const handleEndAcceleration = new THREE.Vector3().crossVectors(
      angularAcceleration,
      handleEndPosition,
    ).add(new THREE.Vector3().crossVectors(
      angularVelocity,
      handleEndVelocity,
    ));

    const connectingLengthError = connectingVector.length()
      - connectingLinkLength;
    const upperToggleLengthError = upperToggleVector.length()
      - toggleLinkLength;
    const lowerToggleLengthError = lowerToggleVector.length()
      - toggleLinkLength;
    const connectingLengthRateError = connectingVector.dot(
      connectingRelativeVelocity,
    ) / connectingLinkLength;
    const upperToggleLengthRateError = upperToggleVector.dot(
      kneeVelocity,
    ) / toggleLinkLength;
    const lowerToggleLengthRateError = lowerToggleVector.dot(
      lowerRelativeVelocity,
    ) / toggleLinkLength;
    const connectingRelativeAcceleration = kneeAcceleration.clone().sub(
      leverPinAcceleration,
    );
    const lowerRelativeAcceleration = sliderPinAcceleration.clone().sub(
      kneeAcceleration,
    );
    const connectingLengthAccelerationError = (
      connectingRelativeVelocity.lengthSq()
        + connectingVector.dot(connectingRelativeAcceleration)
    ) / connectingLinkLength;
    const upperToggleLengthAccelerationError = (
      kneeVelocity.lengthSq()
        + upperToggleVector.dot(kneeAcceleration)
    ) / toggleLinkLength;
    const lowerToggleLengthAccelerationError = (
      lowerRelativeVelocity.lengthSq()
        + lowerToggleVector.dot(lowerRelativeAcceleration)
    ) / toggleLinkLength;
    const upperDirectionFromKnee = topPivot.clone().sub(kneePosition)
      .normalize();
    const lowerDirectionFromKnee = sliderPinPosition.clone()
      .sub(kneePosition).normalize();
    const toggleIncludedAngle = Math.acos(THREE.MathUtils.clamp(
      upperDirectionFromKnee.dot(lowerDirectionFromKnee),
      -1,
      1,
    ));
    return {
      connectingLengthAccelerationError,
      connectingLengthError,
      connectingLengthRateError,
      connectingRelativeAcceleration,
      connectingRelativeVelocity,
      connectingVector,
      handleEndAcceleration,
      handleEndPosition,
      handleEndVelocity,
      horizontalKneeOffset: kneePosition.x - strokeX,
      kneeAcceleration,
      kneePosition,
      kneeVelocity,
      leverPinAcceleration,
      leverPinPosition,
      leverPinVelocity,
      lowerRelativeAcceleration,
      lowerRelativeVelocity,
      lowerToggleLengthAccelerationError,
      lowerToggleLengthError,
      lowerToggleLengthRateError,
      lowerToggleVector,
      sliderAccelerationY,
      sliderPinAcceleration,
      sliderPinPosition,
      sliderPinVelocity,
      sliderVelocityY,
      toggleIncludedAngle,
      toggleStraightnessError: Math.PI - toggleIncludedAngle,
      upperToggleLengthAccelerationError,
      upperToggleLengthError,
      upperToggleLengthRateError,
      upperToggleVector,
    };
  };

  const openLinkage = linkageAtLeverMotion(leverStartAngle, 0, 0);
  const closedLinkage = linkageAtLeverMotion(leverEndAngle, 0, 0);
  const openSliderY = openLinkage.sliderPinPosition.y;
  const closedSliderY = closedLinkage.sliderPinPosition.y;
  const punchStroke = openSliderY - closedSliderY;
  const punchTipLocalY = -ramLength;
  const workpieceTopY = closedSliderY + punchTipLocalY;
  const workpieceHeight = 0.11;
  const dieTopY = workpieceTopY - workpieceHeight;
  const dieHeight = 0.34;

  const cyclePeriod = 8;
  const sourceCyclePhase = 0;
  const closingEndPhase = 0.4;
  const returnStartPhase = 0.5;
  const returnEndPhase = 0.9;
  const strokePhaseDuration = 0.4;
  const strokeTime = strokePhaseDuration * cyclePeriod;
  const quintic = (unit) => unit ** 3 * (
    10 + unit * (-15 + 6 * unit)
  );
  const quinticFirst = (unit) => 30 * unit ** 2 * (1 - unit) ** 2;
  const quinticSecond = (unit) => 60 * unit * (1 - unit)
    * (1 - 2 * unit);
  const motionAtRawCyclePhase = (rawCyclePhase) => {
    const cyclePhase = THREE.MathUtils.euclideanModulo(rawCyclePhase, 1);
    let leverAngle;
    let leverAngularSpeed;
    let leverAngularAcceleration;
    let motionProgress;
    let stage;
    if (cyclePhase < closingEndPhase) {
      const unit = cyclePhase / strokePhaseDuration;
      motionProgress = quintic(unit);
      leverAngle = THREE.MathUtils.lerp(
        leverStartAngle,
        leverEndAngle,
        motionProgress,
      );
      leverAngularSpeed = (leverEndAngle - leverStartAngle)
        * quinticFirst(unit) / strokeTime;
      leverAngularAcceleration = (leverEndAngle - leverStartAngle)
        * quinticSecond(unit) / strokeTime ** 2;
      stage = 'hand-lever-closes-toggle-toward-dead-center';
    } else if (cyclePhase < returnStartPhase) {
      motionProgress = 1;
      leverAngle = leverEndAngle;
      leverAngularSpeed = 0;
      leverAngularAcceleration = 0;
      stage = 'punch-held-at-toggle-dead-center';
    } else if (cyclePhase < returnEndPhase) {
      const unit = (cyclePhase - returnStartPhase) / strokePhaseDuration;
      const returnProgress = quintic(unit);
      motionProgress = 1 - returnProgress;
      leverAngle = THREE.MathUtils.lerp(
        leverEndAngle,
        leverStartAngle,
        returnProgress,
      );
      leverAngularSpeed = (leverStartAngle - leverEndAngle)
        * quinticFirst(unit) / strokeTime;
      leverAngularAcceleration = (leverStartAngle - leverEndAngle)
        * quinticSecond(unit) / strokeTime ** 2;
      stage = 'hand-lever-returns-and-raises-punch';
    } else {
      motionProgress = 0;
      leverAngle = leverStartAngle;
      leverAngularSpeed = 0;
      leverAngularAcceleration = 0;
      stage = 'open-punch-dwell';
    }
    return {
      cyclePhase,
      leverAngle,
      leverAngularAcceleration,
      leverAngularSpeed,
      motionProgress,
      rawCyclePhase,
      stage,
    };
  };
  const stateAtRawCyclePhase = (rawCyclePhase) => {
    const motion = motionAtRawCyclePhase(rawCyclePhase);
    const linkage = linkageAtLeverMotion(
      motion.leverAngle,
      motion.leverAngularSpeed,
      motion.leverAngularAcceleration,
    );
    const unitLeverMotion = linkageAtLeverMotion(
      motion.leverAngle,
      1,
      0,
    );
    const punchTravelPerLeverRadian = unitLeverMotion.sliderVelocityY;
    const idealPunchForceMultiplier = Math.abs(
      punchTravelPerLeverRadian
    ) < 1e-10
      ? Infinity
      : handleLength / Math.abs(punchTravelPerLeverRadian);
    const punchDisplacement = openSliderY
      - linkage.sliderPinPosition.y;
    const punchTipPosition = linkage.sliderPinPosition.clone().add(
      new THREE.Vector3(0, punchTipLocalY, 0),
    );
    const punchTipVelocity = linkage.sliderPinVelocity.clone();
    const punchTipAcceleration = linkage.sliderPinAcceleration.clone();
    const punchWorkpieceGap = punchTipPosition.y - workpieceTopY;
    const atDeadCenter = Math.abs(linkage.horizontalKneeOffset) < 1e-9
      && Math.abs(linkage.toggleStraightnessError) < 2e-8;
    const atOpenLimit = Math.abs(
      motion.leverAngle - leverStartAngle
    ) < 1e-10;
    return {
      ...motion,
      ...linkage,
      atDeadCenter,
      atOpenLimit,
      idealPunchForceMultiplier,
      punchDisplacement,
      punchTipAcceleration,
      punchTipPosition,
      punchTipVelocity,
      punchTravelPerLeverRadian,
      punchWorkpieceGap: Math.max(0, punchWorkpieceGap),
      rawPunchWorkpieceGap: punchWorkpieceGap,
      workpieceContact: punchWorkpieceGap < 1e-9,
    };
  };
  const stateAtTime = (time) => stateAtRawCyclePhase(
    time / cyclePeriod + sourceCyclePhase,
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.11,
    roughness: 0.62,
  });
  const drivenDarkMaterial = matte(0x174f69, {
    metalness: 0.15,
    roughness: 0.54,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.69,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const workMaterial = matte(PALETTE.brass, {
    metalness: 0.25,
    roughness: 0.48,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const framePlaneZ = -0.58;
  const frameDepth = 0.48;
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-c-frame-and-toggle-support';
  const baseWidth = 7.15;
  const baseHeight = 0.52;
  const baseCenterX = -0.72;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(baseWidth, baseHeight, 1.65),
    frameMaterial,
  );
  base.position.set(
    baseCenterX,
    frameBaseY - baseHeight / 2,
    framePlaneZ,
  );
  base.userData.role = 'wide-fixed-base-of-punching-machine';
  fixedFrame.add(base);

  const leftSpineX = strokeX - 0.55;
  const leftSpineTopY = topPivot.y + 0.55;
  const leftSpineBottomY = frameBaseY + 0.12;
  const leftSpine = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.30,
      leftSpineTopY - leftSpineBottomY,
      frameDepth,
    ),
    frameMaterial,
  );
  leftSpine.position.set(
    leftSpineX,
    (leftSpineTopY + leftSpineBottomY) / 2,
    framePlaneZ,
  );
  leftSpine.userData.role = 'fixed-left-spine-carrying-toggle-and-ram-guides';
  fixedFrame.add(leftSpine);
  const topPivotBracket = makeBeam(
    new THREE.Vector3(leftSpineX, topPivot.y, framePlaneZ),
    new THREE.Vector3(topPivot.x, topPivot.y, framePlaneZ),
    {
      color: PALETTE.frame,
      depth: frameDepth,
      jointRadius: 0.16,
      thickness: 0.28,
    },
  );
  topPivotBracket.userData.role = 'fixed-overhang-to-upper-toggle-pivot';
  fixedFrame.add(topPivotBracket);

  const rightColumnX = 0.92;
  const rightColumnBottomY = frameBaseY + 0.12;
  const rightColumnTopY = -0.76;
  const rightColumn = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.62,
      rightColumnTopY - rightColumnBottomY,
      1.15,
    ),
    frameMaterial,
  );
  rightColumn.position.set(
    rightColumnX,
    (rightColumnTopY + rightColumnBottomY) / 2,
    framePlaneZ,
  );
  rightColumn.userData.role = 'fixed-right-column-supporting-hand-lever';
  fixedFrame.add(rightColumn);
  const rightShoulder = makeBeam(
    new THREE.Vector3(rightColumnX, rightColumnTopY, framePlaneZ),
    new THREE.Vector3(0.22, 0.12, framePlaneZ),
    {
      color: PALETTE.frame,
      depth: 1.05,
      jointRadius: 0.23,
      thickness: 0.56,
    },
  );
  rightShoulder.userData.role = 'fixed-sloped-shoulder-to-lever-bearing';
  fixedFrame.add(rightShoulder);
  const leverBearingBracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.82, 1.1),
    frameMaterial,
  );
  leverBearingBracket.position.set(0.18, -0.12, framePlaneZ);
  leverBearingBracket.userData.role = 'fixed-bearing-block-at-hand-lever-pivot';
  fixedFrame.add(leverBearingBracket);

  const guideCentersY = [
    openSliderY - ramLength * 0.43,
    openSliderY - ramLength * 0.71,
  ];
  const ramRadius = 0.105;
  const guideClearance = 0.035;
  const ramGuideBlocks = [];
  for (const [guideIndex, guideY] of guideCentersY.entries()) {
    const spineTie = makeBeam(
      new THREE.Vector3(leftSpineX, guideY, framePlaneZ),
      new THREE.Vector3(strokeX, guideY, framePlaneZ),
      {
        color: PALETTE.frame,
        depth: frameDepth,
        jointRadius: 0.08,
        thickness: 0.20,
      },
    );
    spineTie.userData.role = 'fixed-tie-from-spine-to-ram-guide';
    spineTie.userData.guideIndex = guideIndex;
    fixedFrame.add(spineTie);
    for (const horizontalSign of [-1, 1]) {
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.34, 0.62),
        drivenDarkMaterial,
      );
      block.position.set(
        strokeX + horizontalSign * (ramRadius + guideClearance + 0.11),
        guideY,
        0,
      );
      block.userData.role = 'fixed-wear-block-guiding-punch-ram';
      block.userData.guideIndex = guideIndex;
      block.userData.side = horizontalSign < 0 ? 'left' : 'right';
      fixedFrame.add(block);
      ramGuideBlocks.push(block);
    }
  }

  const dieWidth = 1.28;
  const dieDepth = 1.08;
  const dieHoleRadius = 0.19;
  const dieShape = new THREE.Shape();
  dieShape.moveTo(-dieWidth / 2, -dieDepth / 2);
  dieShape.lineTo(dieWidth / 2, -dieDepth / 2);
  dieShape.lineTo(dieWidth / 2, dieDepth / 2);
  dieShape.lineTo(-dieWidth / 2, dieDepth / 2);
  dieShape.closePath();
  const dieHole = new THREE.Path();
  dieHole.absarc(0, 0, dieHoleRadius, 0, fullTurn, true);
  dieShape.holes.push(dieHole);
  const dieGeometry = centeredExtrusion(dieShape, dieHeight, 0.012);
  dieGeometry.rotateX(Math.PI / 2);
  const dieBlock = new THREE.Mesh(dieGeometry, darkMaterial);
  dieBlock.position.set(
    strokeX,
    dieTopY - dieHeight / 2,
    0,
  );
  dieBlock.userData.role = 'fixed-die-with-real-punch-clearance-hole';
  dieBlock.userData.actualThroughHole = true;
  const workpiece = new THREE.Mesh(
    new THREE.BoxGeometry(dieWidth * 0.9, workpieceHeight, dieDepth * 0.88),
    workMaterial,
  );
  workpiece.position.set(
    strokeX,
    workpieceTopY - workpieceHeight / 2,
    0,
  );
  workpiece.userData.role = 'stationary-sheet-on-punch-die';
  fixedFrame.add(dieBlock, workpiece);

  const leverPlaneZ = 0.50;
  const connectorPlaneZ = 0.47;
  const togglePlaneZ = 0.14;
  const jointPinCenterZ = 0.30;
  const jointPinLength = 0.92;
  const leverAssembly = new THREE.Group();
  leverAssembly.userData.axis = Z_AXIS.clone();
  leverAssembly.userData.role = 'rigid-hand-lever-and-offset-driving-arm';
  const handleBeam = makeBeam(
    new THREE.Vector3(0, 0, leverPlaneZ),
    new THREE.Vector3(
      handleLocalEnd.x,
      handleLocalEnd.y,
      leverPlaneZ,
    ),
    {
      color: PALETTE.driver,
      depth: 0.26,
      jointRadius: 0.17,
      thickness: 0.22,
    },
  );
  handleBeam.userData.role = 'long-input-hand-lever';
  const handleGripLength = 0.78;
  const handleUnit = handleLocalEnd.clone().normalize();
  const gripStart = handleLocalEnd.clone().addScaledVector(
    handleUnit,
    -handleGripLength,
  );
  const handleGrip = makeBeam(
    new THREE.Vector3(gripStart.x, gripStart.y, leverPlaneZ),
    new THREE.Vector3(
      handleLocalEnd.x,
      handleLocalEnd.y,
      leverPlaneZ,
    ),
    {
      color: PALETTE.ink,
      depth: 0.32,
      jointRadius: 0.18,
      thickness: 0.28,
    },
  );
  handleGrip.userData.role = 'dark-hand-grip-at-end-of-input-lever';
  const offsetArm = makeBeam(
    new THREE.Vector3(0, 0, leverPlaneZ),
    new THREE.Vector3(
      leverPinLocal.x,
      leverPinLocal.y,
      leverPlaneZ,
    ),
    {
      color: PALETTE.driver,
      depth: 0.28,
      jointRadius: 0.18,
      thickness: 0.24,
    },
  );
  offsetArm.userData.role = 'offset-arm-carrying-connecting-link-pin';
  const leverHub = cylinderAlongZ(0.28, 0.62, darkMaterial, 36);
  leverHub.position.z = leverPlaneZ;
  leverHub.userData.role = 'hub-of-hand-lever-on-fixed-pivot';
  const leverPin = cylinderAlongZ(0.13, jointPinLength, darkMaterial, 28);
  leverPin.position.set(
    leverPinLocal.x,
    leverPinLocal.y,
    jointPinCenterZ,
  );
  leverPin.userData.role = 'pin-on-offset-input-lever';
  const leverRotationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 12),
    indexMaterial,
  );
  leverRotationIndex.position.copy(handleLocalEnd).multiplyScalar(0.68);
  leverRotationIndex.position.z = leverPlaneZ + 0.18;
  leverRotationIndex.userData.role = 'white-index-on-hand-lever';
  leverAssembly.add(
    handleBeam,
    handleGrip,
    offsetArm,
    leverHub,
    leverPin,
    leverRotationIndex,
  );

  const connectingLink = makeDynamicLink({
    thickness: 0.18,
    depth: 0.24,
    color: PALETTE.driven,
    jointRadius: 0.18,
  });
  connectingLink.userData.role =
    'lever-to-toggle-knee-horizontal-connecting-link';
  const upperToggleLink = makeDynamicLink({
    thickness: 0.22,
    depth: 0.26,
    color: 0x174f69,
    jointRadius: 0.20,
  });
  upperToggleLink.userData.role = 'upper-equal-link-of-punch-toggle';
  const lowerToggleLink = makeDynamicLink({
    thickness: 0.22,
    depth: 0.26,
    color: PALETTE.driven,
    jointRadius: 0.20,
  });
  lowerToggleLink.userData.role = 'lower-equal-link-of-punch-toggle';

  const topPivotPin = cylinderAlongZ(
    0.15,
    jointPinLength,
    darkMaterial,
    30,
  );
  topPivotPin.position.set(topPivot.x, topPivot.y, jointPinCenterZ);
  topPivotPin.userData.role = 'fixed-upper-toggle-pivot-pin';
  const topPivotRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.065, 10, 40),
    frameMaterial,
  );
  topPivotRing.position.set(topPivot.x, topPivot.y, -0.05);
  topPivotRing.userData.role = 'fixed-bearing-at-upper-toggle-pivot';
  const leverPivotShaft = cylinderAlongZ(
    0.16,
    1.22,
    darkMaterial,
    32,
  );
  leverPivotShaft.position.z = 0.04;
  leverPivotShaft.userData.role = 'fixed-axis-shaft-of-hand-lever';
  const leverPivotRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.085, 10, 44),
    frameMaterial,
  );
  leverPivotRing.position.z = -0.08;
  leverPivotRing.userData.role = 'fixed-bearing-around-hand-lever-pivot';
  const kneePin = cylinderAlongZ(
    0.15,
    jointPinLength,
    darkMaterial,
    30,
  );
  kneePin.position.z = jointPinCenterZ;
  kneePin.userData.role = 'shared-pin-at-toggle-knee';

  const punchAssembly = new THREE.Group();
  punchAssembly.userData.role = 'vertically-guided-nonrotating-punch-ram';
  punchAssembly.userData.translationAxis = Y_AXIS.clone();
  const lowerJointPin = cylinderAlongZ(
    0.15,
    jointPinLength,
    darkMaterial,
    30,
  );
  lowerJointPin.position.z = jointPinCenterZ;
  lowerJointPin.userData.role = 'pin-joining-lower-toggle-to-punch';
  const punchTipLength = 0.38;
  const ramBodyLength = ramLength - punchTipLength;
  const punchRam = cylinderAlongY(
    ramRadius,
    ramBodyLength,
    drivenMaterial,
    30,
  );
  punchRam.position.set(
    0,
    -ramBodyLength / 2,
    togglePlaneZ,
  );
  punchRam.userData.role = 'solid-vertical-punch-ram';
  const punchTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.19, punchTipLength, 28),
    drivenMaterial,
  );
  punchTip.rotation.z = Math.PI;
  punchTip.position.set(
    0,
    -ramLength + punchTipLength / 2,
    togglePlaneZ,
  );
  punchTip.userData.role = 'pointed-working-end-of-punch';
  const sliderBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.76, 0.58),
    drivenDarkMaterial,
  );
  sliderBlock.position.set(0, -ramLength * 0.61, togglePlaneZ);
  sliderBlock.userData.role = 'guide-block-rigid-with-punch-ram';
  const punchMotionIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.08, 0.034),
    indexMaterial,
  );
  punchMotionIndex.position.set(
    ramRadius + 0.08,
    -ramLength * 0.48,
    togglePlaneZ + 0.31,
  );
  punchMotionIndex.userData.role = 'white-index-on-guided-punch';
  punchAssembly.add(
    lowerJointPin,
    punchRam,
    punchTip,
    sliderBlock,
    punchMotionIndex,
  );

  const punchContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 18, 12),
    indexMaterial,
  );
  punchContactMarker.userData.role =
    'white-marker-at-moving-punch-tip';
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(10.8, 8.8, 0.01),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0.05, -1.05, 0);
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-envelope-of-full-lever-sweep';

  root.add(
    cameraEnvelope,
    fixedFrame,
    topPivotPin,
    topPivotRing,
    leverPivotShaft,
    leverPivotRing,
    leverAssembly,
    connectingLink,
    upperToggleLink,
    lowerToggleLink,
    kneePin,
    punchAssembly,
    punchContactMarker,
  );

  root.userData.mechanism =
    'hand-lever-equal-link-dead-center-toggle-punch-press';
  root.userData.cameraDistanceScale = 1.02;
  root.userData.blocks = {
    base,
    cameraEnvelope,
    connectingLink,
    dieBlock,
    fixedFrame,
    handleBeam,
    handleGrip,
    kneePin,
    leftSpine,
    leverAssembly,
    leverBearingBracket,
    leverHub,
    leverPin,
    leverPivotRing,
    leverPivotShaft,
    leverRotationIndex,
    lowerJointPin,
    lowerToggleLink,
    offsetArm,
    punchAssembly,
    punchContactMarker,
    punchMotionIndex,
    punchRam,
    punchTip,
    ramGuideBlocks,
    rightColumn,
    rightShoulder,
    sliderBlock,
    topPivotBracket,
    topPivotPin,
    topPivotRing,
    upperToggleLink,
    workpiece,
  };
  root.userData.geometry = {
    baseCenterX,
    baseHeight,
    baseWidth,
    closedSliderY,
    closingEndPhase,
    connectingLinkLength,
    connectorPlaneZ,
    cyclePeriod,
    deadCenterKnee,
    dieDepth,
    dieHeight,
    dieHoleRadius,
    dieTopY,
    dieWidth,
    frameBaseY,
    frameDepth,
    framePlaneZ,
    guideCentersY,
    handleLength,
    handleLocalAngle,
    handleLocalEnd,
    jointPinCenterZ,
    jointPinLength,
    leverAngularTravel,
    leverEndAngle,
    leverPinLocal,
    leverPlaneZ,
    leverStartAngle,
    linkBranchReference,
    openSliderY,
    punchStroke,
    punchTipLength,
    punchTipLocalY,
    ramLength,
    ramRadius,
    returnEndPhase,
    returnStartPhase,
    sourceConnectingLinkLength,
    sourceCyclePhase,
    sourceEndAngleReconciliation,
    sourceFrameBaseY,
    sourceHandleLength,
    sourceHandleLocalAngle,
    sourceLeverEndAngle,
    sourceLeverEndDirection,
    sourceLeverPin,
    sourceLeverStartAngle,
    sourceLinkBranchReference,
    sourceRamLength,
    sourceScale,
    sourceStrokeLineBottomY,
    sourceStrokeLineTopY,
    sourceStrokeX,
    sourceToggleLinkLength,
    sourceTopPivot,
    strokeLineBottomY,
    strokeLineTopY,
    strokePhaseDuration,
    strokeTime,
    strokeX,
    toggleLinkLength,
    togglePlaneZ,
    topPivot,
    workpieceHeight,
    workpieceTopY,
  };
  root.userData.linkageAtLeverMotion = linkageAtLeverMotion;
  root.userData.motionAtRawCyclePhase = motionAtRawCyclePhase;
  root.userData.stateAtRawCyclePhase = stateAtRawCyclePhase;
  root.userData.stateAtTime = stateAtTime;

  const pointInPlane = (point, z) => new THREE.Vector3(
    point.x,
    point.y,
    z,
  );
  const update = (time) => {
    const state = stateAtTime(time);
    leverAssembly.rotation.set(0, 0, state.leverAngle);
    connectingLink.userData.setEndpoints(
      pointInPlane(state.leverPinPosition, connectorPlaneZ),
      pointInPlane(state.kneePosition, connectorPlaneZ),
    );
    upperToggleLink.userData.setEndpoints(
      pointInPlane(topPivot, togglePlaneZ),
      pointInPlane(state.kneePosition, togglePlaneZ),
    );
    lowerToggleLink.userData.setEndpoints(
      pointInPlane(state.kneePosition, togglePlaneZ),
      pointInPlane(state.sliderPinPosition, togglePlaneZ),
    );
    kneePin.position.set(
      state.kneePosition.x,
      state.kneePosition.y,
      jointPinCenterZ,
    );
    punchAssembly.position.set(
      state.sliderPinPosition.x,
      state.sliderPinPosition.y,
      0,
    );
    punchAssembly.rotation.set(0, 0, 0);
    punchContactMarker.position.copy(state.punchTipPosition);
    punchContactMarker.position.z = togglePlaneZ + 0.34;
    leverAssembly.userData.angularSpeed = state.leverAngularSpeed;
    leverAssembly.userData.angularAcceleration =
      state.leverAngularAcceleration;
    punchAssembly.userData.velocity = state.sliderPinVelocity.clone();
    punchAssembly.userData.acceleration =
      state.sliderPinAcceleration.clone();
    root.userData.contacts = {
      connectingLinkPins: {
        accelerationError: state.connectingLengthAccelerationError,
        lengthError: state.connectingLengthError,
        rateError: state.connectingLengthRateError,
      },
      lowerTogglePins: {
        accelerationError: state.lowerToggleLengthAccelerationError,
        lengthError: state.lowerToggleLengthError,
        rateError: state.lowerToggleLengthRateError,
      },
      punchDie: {
        gap: state.punchWorkpieceGap,
        inContact: state.workpieceContact,
        punchPoint: state.punchTipPosition.clone(),
        workpiecePoint: new THREE.Vector3(
          strokeX,
          workpieceTopY,
          0,
        ),
      },
      punchVerticalGuides: {
        axis: Y_AXIS.clone(),
        lateralError: Math.abs(punchAssembly.position.x - strokeX),
        rotationError: Math.hypot(
          punchAssembly.rotation.x,
          punchAssembly.rotation.y,
          punchAssembly.rotation.z,
        ),
      },
      toggleDeadCenter: {
        horizontalKneeOffset: state.horizontalKneeOffset,
        includedAngle: state.toggleIncludedAngle,
        straightnessError: state.toggleStraightnessError,
      },
      upperTogglePins: {
        accelerationError: state.upperToggleLengthAccelerationError,
        lengthError: state.upperToggleLengthError,
        rateError: state.upperToggleLengthRateError,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);

  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  const model = finish(root, update, new THREE.Vector3(6.6, 4.4, 14.6));
  cameraEnvelope.castShadow = false;
  cameraEnvelope.receiveShadow = false;
  punchContactMarker.castShadow = false;
  punchContactMarker.receiveShadow = false;
  return model;
}

function frontDiskRearFramedYokeMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Proportions measured from Brown's front elevation. The disk radius is the
  // source unit; the broad yoke is intentionally different from movement 93's
  // narrow capsule yoke and sits behind the opaque driver disk.
  const sourceScale = 0.235;
  const sourceDiskRadius = 10;
  const sourceCrankRadius = 5.6;
  const sourceWristRadius = 0.88;
  const sourceHubBoreRadius = 1.7;
  const sourceHubOuterRadius = 3.15;
  const sourceYokeOuterHalfWidth = 10.6;
  const sourceYokeOuterHalfHeight = 6.05;
  const sourceYokeOuterCornerRadius = 2.75;
  const sourceYokeInnerHalfWidth = 8.85;
  const sourceYokeInnerHalfHeight = 3.1;
  const sourceYokeInnerCornerRadius = 2.05;
  const sourceYokeFrameCenterOffsetY = -2.95;
  const sourceYokeHoleCenterOffsetY = -2.2;
  const sourceGrooveEndCenter = 8;
  const sourceGrooveHalfHeight = sourceWristRadius;
  const sourceGrooveOuterHalfHeight = 1.95;
  const sourceStemHalfWidth = 1.08;
  const sourceUpperStemMinimumY = 2.85;
  const sourceUpperStemMaximumY = 16.5;
  const sourceLowerStemMinimumY = -22.5;
  const sourceLowerStemMaximumY = -8.8;

  const diskRadius = sourceDiskRadius * sourceScale;
  const crankRadius = sourceCrankRadius * sourceScale;
  const wristRadius = sourceWristRadius * sourceScale;
  const hubBoreRadius = sourceHubBoreRadius * sourceScale;
  const hubOuterRadius = sourceHubOuterRadius * sourceScale;
  const yokeOuterHalfWidth = sourceYokeOuterHalfWidth * sourceScale;
  const yokeOuterHalfHeight = sourceYokeOuterHalfHeight * sourceScale;
  const yokeOuterCornerRadius = sourceYokeOuterCornerRadius * sourceScale;
  const yokeInnerHalfWidth = sourceYokeInnerHalfWidth * sourceScale;
  const yokeInnerHalfHeight = sourceYokeInnerHalfHeight * sourceScale;
  const yokeInnerCornerRadius = sourceYokeInnerCornerRadius * sourceScale;
  const yokeFrameCenterOffsetY =
    sourceYokeFrameCenterOffsetY * sourceScale;
  const yokeHoleCenterOffsetY =
    sourceYokeHoleCenterOffsetY * sourceScale;
  const yokeHoleOffsetWithinFrame =
    yokeHoleCenterOffsetY - yokeFrameCenterOffsetY;
  const grooveEndCenter = sourceGrooveEndCenter * sourceScale;
  const grooveHalfHeight = sourceGrooveHalfHeight * sourceScale;
  const grooveOuterHalfHeight =
    sourceGrooveOuterHalfHeight * sourceScale;
  const stemHalfWidth = sourceStemHalfWidth * sourceScale;
  const upperStemMinimumY = sourceUpperStemMinimumY * sourceScale;
  const upperStemMaximumY = sourceUpperStemMaximumY * sourceScale;
  const lowerStemMinimumY = sourceLowerStemMinimumY * sourceScale;
  const lowerStemMaximumY = sourceLowerStemMaximumY * sourceScale;

  const sourcePoseAngle = 1.752;
  const inputSpeedMagnitude = 0.92;
  const inputAngularSpeed = -inputSpeedMagnitude;
  const inputAngularAcceleration = 0;
  const cyclePeriod = fullTurn / inputSpeedMagnitude;
  const shaftCenter = new THREE.Vector3(0, 0, 0);
  const outputMinimumY = shaftCenter.y - crankRadius;
  const outputMaximumY = shaftCenter.y + crankRadius;
  const outputStroke = outputMaximumY - outputMinimumY;
  const minimumGrooveEndClearance = grooveEndCenter - crankRadius;

  const diskDepth = 0.42;
  const diskCenterZ = 0.26;
  const diskBackZ = diskCenterZ - diskDepth / 2;
  const diskFrontZ = diskCenterZ + diskDepth / 2;
  const yokeDepth = 0.30;
  const yokePlaneZ = -0.32;
  const yokeBackZ = yokePlaneZ - yokeDepth / 2;
  const yokeFrontZ = yokePlaneZ + yokeDepth / 2;
  const grooveDepth = 0.34;
  const groovePlaneZ = -0.30;
  const stemDepth = 0.27;
  const shaftRadius = hubBoreRadius * 0.72;
  const shaftLength = 1.78;
  const shaftCenterZ = -0.30;
  const wristLength = 1.08;
  const wristCenterZ = 0.05;
  const wristBackZ = wristCenterZ - wristLength / 2;
  const wristFrontZ = wristCenterZ + wristLength / 2;
  const outlineDepth = 0.028;
  const outlineThickness = 0.045;
  const guideRunningClearance = 0.028;
  const guideCheekWidth = 0.19;
  const guideCheekHeight = 0.38;
  const guideCheekDepth = 0.44;
  const upperGuideY = 2.34;
  const lowerGuideY = -3.75;
  const fixedFrameZ = -0.86;
  const fixedFrameHalfWidth = 3.02;
  const fixedFrameMinimumY = -4.78;
  const fixedFrameMaximumY = 3.25;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.61,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.49,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.70,
  });
  const wristMaterial = matte(PALETTE.brass, {
    metalness: 0.24,
    roughness: 0.45,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.45 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-rear-bearing-frame-and-two-vertical-yoke-guides';

  const rearSideColumns = [-1, 1].map((side) => {
    const column = makeBeam(
      new THREE.Vector3(
        side * fixedFrameHalfWidth,
        fixedFrameMinimumY,
        fixedFrameZ,
      ),
      new THREE.Vector3(
        side * fixedFrameHalfWidth,
        fixedFrameMaximumY,
        fixedFrameZ,
      ),
      { thickness: 0.14, depth: 0.20, color: PALETTE.frame },
    );
    column.userData.role = 'fixed-rear-side-column-outside-moving-yoke';
    column.userData.side = side < 0 ? 'left' : 'right';
    return column;
  });
  const rearCrossRails = [fixedFrameMinimumY, fixedFrameMaximumY].map(
    (y, index) => {
      const rail = makeBeam(
        new THREE.Vector3(-fixedFrameHalfWidth, y, fixedFrameZ),
        new THREE.Vector3(fixedFrameHalfWidth, y, fixedFrameZ),
        { thickness: 0.14, depth: 0.20, color: PALETTE.frame },
      );
      rail.userData.role = 'fixed-rear-cross-rail';
      rail.userData.side = index === 0 ? 'lower' : 'upper';
      return rail;
    },
  );
  const rearBearing = new THREE.Mesh(
    new THREE.TorusGeometry(hubOuterRadius + 0.09, 0.075, 10, 52),
    frameMaterial,
  );
  rearBearing.position.set(shaftCenter.x, shaftCenter.y, -0.70);
  rearBearing.userData.role = 'fixed-bearing-behind-front-mounted-disk';
  const bearingBrackets = [-1, 1].map((side) => {
    const bracket = makeBeam(
      new THREE.Vector3(
        side * fixedFrameHalfWidth,
        shaftCenter.y,
        fixedFrameZ,
      ),
      rearBearing.position,
      { thickness: 0.12, depth: 0.18, color: PALETTE.frame },
    );
    bracket.userData.role = 'fixed-bracket-to-disk-shaft-bearing';
    bracket.userData.side = side < 0 ? 'left' : 'right';
    return bracket;
  });

  const guideRecords = [
    { centerY: lowerGuideY, side: 'lower' },
    { centerY: upperGuideY, side: 'upper' },
  ];
  const guideCheeks = guideRecords.flatMap(({ centerY, side }) => (
    [-1, 1].map((signX) => {
      const cheek = new THREE.Mesh(
        new THREE.BoxGeometry(
          guideCheekWidth,
          guideCheekHeight,
          guideCheekDepth,
        ),
        frameMaterial,
      );
      cheek.position.set(
        signX * (
          stemHalfWidth
          + guideRunningClearance
          + guideCheekWidth / 2
        ),
        centerY,
        -0.39,
      );
      cheek.userData.role = 'fixed-cheek-guiding-rectangular-yoke-stem';
      cheek.userData.guide = side;
      cheek.userData.side = signX < 0 ? 'left' : 'right';
      return cheek;
    })
  ));
  const guideBackPlates = guideRecords.map(({ centerY, side }) => {
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(1.28, guideCheekHeight + 0.14, 0.12),
      frameMaterial,
    );
    plate.position.set(0, centerY, -0.67);
    plate.userData.role = 'fixed-backplate-supporting-yoke-guide-cheeks';
    plate.userData.guide = side;
    return plate;
  });
  fixedFrame.add(
    ...rearSideColumns,
    ...rearCrossRails,
    rearBearing,
    ...bearingBrackets,
    ...guideBackPlates,
    ...guideCheeks,
  );

  const input = planarRotor();
  input.position.copy(shaftCenter);
  input.userData.role = 'continuous-front-disk-and-back-reaching-wrist';
  const inputRotor = input.userData.rotor;

  const diskBody = cylinderAlongZ(
    diskRadius,
    diskDepth,
    driverMaterial,
    112,
  );
  diskBody.position.z = diskCenterZ;
  diskBody.userData.role = 'source-solid-front-driver-disk';
  const diskOuterRim = new THREE.Mesh(
    new THREE.TorusGeometry(diskRadius - 0.035, 0.045, 10, 112),
    darkMaterial,
  );
  diskOuterRim.position.z = diskFrontZ + 0.018;
  diskOuterRim.userData.role = 'dark-front-outline-of-driver-disk';
  const inputShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
    48,
  );
  inputShaft.position.z = shaftCenterZ;
  inputShaft.userData.role = 'fixed-axis-shaft-through-disk-and-rear-bearing';
  const shaftHub = cylinderAlongZ(
    hubOuterRadius,
    diskDepth + 0.18,
    darkMaterial,
    64,
  );
  shaftHub.position.z = diskCenterZ + 0.025;
  shaftHub.userData.role = 'source-large-annular-disk-hub';
  const hubFace = cylinderAlongZ(
    hubBoreRadius,
    0.052,
    driverMaterial,
    52,
  );
  hubFace.position.z = diskFrontZ + 0.112;
  hubFace.userData.role = 'recessed-center-face-inside-dark-hub';

  const crankWrist = cylinderAlongZ(
    wristRadius,
    wristLength,
    wristMaterial,
    48,
  );
  crankWrist.position.set(crankRadius, 0, wristCenterZ);
  crankWrist.userData.role =
    'single-disk-wrist-reaching-backward-into-yoke-groove';
  const wristFace = cylinderAlongZ(
    wristRadius * 0.78,
    0.045,
    indexMaterial,
    40,
  );
  wristFace.position.set(crankRadius, 0, wristFrontZ + 0.024);
  wristFace.userData.role = 'visible-white-face-of-eccentric-wrist';
  const diskRotationIndex = cylinderAlongZ(
    0.075,
    0.045,
    indexMaterial,
    28,
  );
  diskRotationIndex.position.set(0, -diskRadius * 0.78, diskFrontZ + 0.025);
  diskRotationIndex.userData.role = 'secondary-visible-disk-rotation-index';
  inputRotor.add(
    diskBody,
    diskOuterRim,
    inputShaft,
    shaftHub,
    hubFace,
    crankWrist,
    wristFace,
    diskRotationIndex,
  );

  const yoke = new THREE.Group();
  yoke.userData.role =
    'nonrotating-broad-framed-yoke-behind-front-driver-disk';

  const yokeBody = new THREE.Mesh(
    centeredExtrusion(
      roundedRectangleRingShape(
        yokeOuterHalfWidth,
        yokeOuterHalfHeight,
        yokeOuterCornerRadius,
        yokeInnerHalfWidth,
        yokeInnerHalfHeight,
        yokeInnerCornerRadius,
        yokeHoleOffsetWithinFrame,
      ),
      yokeDepth,
      0.012,
    ),
    drivenMaterial,
  );
  yokeBody.position.set(0, yokeFrameCenterOffsetY, yokePlaneZ);
  yokeBody.userData.role =
    'source-broad-asymmetric-rounded-rectangle-yoke-frame';

  const grooveBridge = new THREE.Mesh(
    centeredExtrusion(
      horizontalCapsuleRingShape(
        grooveHalfHeight,
        grooveOuterHalfHeight,
        grooveEndCenter,
      ),
      grooveDepth,
      0.010,
    ),
    drivenMaterial,
  );
  grooveBridge.position.z = groovePlaneZ;
  grooveBridge.userData.role =
    'straight-horizontal-through-groove-bridge-capturing-wrist';

  const grooveOutline = new THREE.Mesh(
    centeredExtrusion(
      horizontalCapsuleRingShape(
        grooveHalfHeight,
        grooveHalfHeight + outlineThickness,
        grooveEndCenter,
      ),
      outlineDepth,
      0.003,
    ),
    darkMaterial,
  );
  grooveOutline.position.z = groovePlaneZ + grooveDepth / 2 + 0.018;
  grooveOutline.userData.role = 'front-outline-of-straight-yoke-groove';

  const yokeOuterOutline = new THREE.Mesh(
    centeredExtrusion(
      roundedRectangleRingShape(
        yokeOuterHalfWidth,
        yokeOuterHalfHeight,
        yokeOuterCornerRadius,
        yokeOuterHalfWidth - outlineThickness,
        yokeOuterHalfHeight - outlineThickness,
        yokeOuterCornerRadius - outlineThickness,
      ),
      outlineDepth,
      0.003,
    ),
    darkMaterial,
  );
  yokeOuterOutline.position.set(
    0,
    yokeFrameCenterOffsetY,
    yokeFrontZ + 0.018,
  );
  yokeOuterOutline.userData.role = 'front-outline-of-broad-yoke-frame';

  const yokeInnerOutline = new THREE.Mesh(
    centeredExtrusion(
      roundedRectangleRingShape(
        yokeInnerHalfWidth + outlineThickness,
        yokeInnerHalfHeight + outlineThickness,
        yokeInnerCornerRadius + outlineThickness,
        yokeInnerHalfWidth,
        yokeInnerHalfHeight,
        yokeInnerCornerRadius,
      ),
      outlineDepth,
      0.003,
    ),
    darkMaterial,
  );
  yokeInnerOutline.position.set(
    0,
    yokeHoleCenterOffsetY,
    yokeFrontZ + 0.019,
  );
  yokeInnerOutline.userData.role = 'front-outline-of-yoke-inner-opening';

  const makeStem = (minimumY, maximumY, side) => {
    const halfLength = (maximumY - minimumY) / 2;
    const stem = new THREE.Mesh(
      centeredExtrusion(
        horizontalCapsuleShape(
          stemHalfWidth,
          halfLength - stemHalfWidth,
        ),
        stemDepth,
        0.008,
      ),
      drivenMaterial,
    );
    stem.rotation.z = Math.PI / 2;
    stem.position.set(0, (minimumY + maximumY) / 2, yokePlaneZ);
    stem.userData.role = `rigid-${side}-rectilinear-output-stem`;
    stem.userData.side = side;
    return stem;
  };
  const upperStem = makeStem(
    upperStemMinimumY,
    upperStemMaximumY,
    'upper',
  );
  const lowerStem = makeStem(
    lowerStemMinimumY,
    lowerStemMaximumY,
    'lower',
  );
  const translationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(stemHalfWidth * 1.55, 0.09, 0.038),
    indexMaterial,
  );
  translationIndex.position.set(
    0,
    upperStemMaximumY - stemHalfWidth * 1.75,
    yokeFrontZ + 0.042,
  );
  translationIndex.userData.role = 'visible-index-on-translating-upper-stem';
  yoke.add(
    yokeBody,
    grooveBridge,
    grooveOutline,
    yokeOuterOutline,
    yokeInnerOutline,
    upperStem,
    lowerStem,
    translationIndex,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.20, 14.20, 2.40),
    new THREE.MeshBasicMaterial({
      color: PALETTE.paper,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0, -0.70, -0.10);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;

  root.add(cameraEnvelope, fixedFrame, yoke, input);

  const stateAtDriverKinematics = ({
    driverAngle,
    cyclePhase = null,
    inputAngularAcceleration: angularAcceleration =
      inputAngularAcceleration,
    inputAngularSpeed: angularSpeed = inputAngularSpeed,
  }) => {
    const cosine = Math.cos(driverAngle);
    const sine = Math.sin(driverAngle);
    const crankVector = new THREE.Vector3(
      crankRadius * cosine,
      crankRadius * sine,
      0,
    );
    const pinPosition = shaftCenter.clone().add(crankVector);
    const pinVelocity = new THREE.Vector3(
      -crankRadius * sine * angularSpeed,
      crankRadius * cosine * angularSpeed,
      0,
    );
    const pinAcceleration = new THREE.Vector3(
      -crankRadius * (
        cosine * angularSpeed ** 2 + sine * angularAcceleration
      ),
      crankRadius * (
        -sine * angularSpeed ** 2 + cosine * angularAcceleration
      ),
      0,
    );
    const yokePosition = new THREE.Vector3(
      shaftCenter.x,
      pinPosition.y,
      0,
    );
    const outputVelocity = new THREE.Vector3(0, pinVelocity.y, 0);
    const outputAcceleration = new THREE.Vector3(
      0,
      pinAcceleration.y,
      0,
    );
    const relativeSlotPosition = new THREE.Vector3(
      pinPosition.x - yokePosition.x,
      0,
      0,
    );
    const relativeSlidingVelocity = new THREE.Vector3(
      pinVelocity.x,
      0,
      0,
    );
    const relativeSlidingAcceleration = new THREE.Vector3(
      pinAcceleration.x,
      0,
      0,
    );
    const pinAxisPoint = new THREE.Vector3(
      pinPosition.x,
      pinPosition.y,
      wristCenterZ,
    );
    const pinGrooveCenter = new THREE.Vector3(
      pinPosition.x,
      pinPosition.y,
      groovePlaneZ,
    );
    const grooveCenter = new THREE.Vector3(
      yokePosition.x,
      yokePosition.y,
      groovePlaneZ,
    );
    const upperPinPoint = pinGrooveCenter.clone();
    upperPinPoint.y += wristRadius;
    const lowerPinPoint = pinGrooveCenter.clone();
    lowerPinPoint.y -= wristRadius;
    const upperWallPoint = pinGrooveCenter.clone();
    upperWallPoint.y = grooveCenter.y + grooveHalfHeight;
    const lowerWallPoint = pinGrooveCenter.clone();
    lowerWallPoint.y = grooveCenter.y - grooveHalfHeight;
    const normalVelocityError = pinVelocity.y - outputVelocity.y;
    const normalAccelerationError =
      pinAcceleration.y - outputAcceleration.y;
    const driveDirectionY = Math.abs(outputVelocity.y) > 1e-10
      ? outputVelocity.y
      : outputAcceleration.y;
    const atDeadCenter = Math.abs(cosine) < 1e-10;
    const normalizedCyclePhase = cyclePhase === null
      ? THREE.MathUtils.euclideanModulo(
        sourcePoseAngle - driverAngle,
        fullTurn,
      ) / fullTurn
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    const stage = atDeadCenter && sine > 0
      ? 'upper-rectilinear-reversal-while-disk-continues'
      : atDeadCenter && sine < 0
        ? 'lower-rectilinear-reversal-while-disk-continues'
        : outputVelocity.y > 0
          ? 'rear-yoke-upstroke-from-front-disk-wrist'
          : 'rear-yoke-downstroke-from-front-disk-wrist';

    return {
      activeGrooveWall: driveDirectionY >= 0 ? 'upper' : 'lower',
      crankRadiusError: crankVector.length() - crankRadius,
      crankVector,
      cyclePhase: normalizedCyclePhase,
      diskAngle: driverAngle,
      diskAngularAcceleration: angularAcceleration,
      diskAngularSpeed: angularSpeed,
      diskRevolutions: (sourcePoseAngle - driverAngle) / fullTurn,
      grooveCenter,
      grooveEndClearance:
        grooveEndCenter - Math.abs(relativeSlotPosition.x),
      guideAccelerationError: Math.hypot(
        outputAcceleration.x,
        outputAcceleration.z,
      ),
      guidePositionError: Math.hypot(
        yokePosition.x - shaftCenter.x,
        yokePosition.z,
      ),
      guideVelocityError: Math.hypot(
        outputVelocity.x,
        outputVelocity.z,
      ),
      lowerPinPoint,
      lowerSurfaceGap: lowerPinPoint.y - lowerWallPoint.y,
      lowerWallPoint,
      normalAccelerationError,
      normalVelocityError,
      outputAcceleration,
      outputDisplacement: yokePosition.y - shaftCenter.y,
      outputVelocity,
      pinAcceleration,
      pinAxisPoint,
      pinGrooveCenter,
      pinPathError: pinPosition.distanceTo(shaftCenter) - crankRadius,
      pinPosition,
      pinVelocity,
      relativeSlidingAcceleration,
      relativeSlidingVelocity,
      relativeSlotPosition,
      stage,
      upperPinPoint,
      upperSurfaceGap: upperWallPoint.y - upperPinPoint.y,
      upperWallPoint,
      yokeAngularAcceleration: 0,
      yokeAngularSpeed: 0,
      yokePosition,
      yokeRotation: 0,
    };
  };
  const stateAtDriverAngle = (driverAngle) => stateAtDriverKinematics({
    driverAngle,
  });
  const stateAtCyclePhase = (cyclePhase) => stateAtDriverKinematics({
    cyclePhase,
    driverAngle: sourcePoseAngle - fullTurn * cyclePhase,
  });
  const stateAtTime = (time) => stateAtDriverKinematics({
    cyclePhase: time / cyclePeriod,
    driverAngle: sourcePoseAngle + inputAngularSpeed * time,
  });
  const timeAtCyclePhase = (cyclePhase) => (
    THREE.MathUtils.euclideanModulo(cyclePhase, 1) * cyclePeriod
  );

  const sourceState = stateAtCyclePhase(0);
  const canonicalStates = {
    leftMidstroke: stateAtDriverAngle(Math.PI),
    lowerDeadCenter: stateAtDriverAngle(Math.PI * 1.5),
    rightMidstroke: stateAtDriverAngle(0),
    source: sourceState,
    upperDeadCenter: stateAtDriverAngle(Math.PI / 2),
  };

  root.userData.mechanism =
    'front-disk-back-reaching-wrist-broad-rear-framed-yoke';
  root.userData.blocks = {
    bearingBrackets,
    cameraEnvelope,
    crankWrist,
    diskBody,
    diskOuterRim,
    diskRotationIndex,
    fixedFrame,
    grooveBridge,
    grooveOutline,
    guideBackPlates,
    guideCheeks,
    hubFace,
    input,
    inputShaft,
    lowerStem,
    rearBearing,
    rearCrossRails,
    rearSideColumns,
    shaftHub,
    translationIndex,
    upperStem,
    wristFace,
    yoke,
    yokeBody,
    yokeInnerOutline,
    yokeOuterOutline,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    crankRadius,
    cyclePeriod,
    diskBackZ,
    diskCenterZ,
    diskDepth,
    diskFrontZ,
    diskRadius,
    fixedFrameMaximumY,
    fixedFrameMinimumY,
    fixedFrameFrontZ: fixedFrameZ + 0.10,
    fixedFrameZ,
    fullTurn,
    grooveDepth,
    grooveEndCenter,
    grooveHalfHeight,
    grooveOuterHalfHeight,
    groovePlaneZ,
    guideAxis: Y_AXIS.clone(),
    guideCheekDepth,
    guideCheekHeight,
    guideCheekWidth,
    guideRunningClearance,
    hubBoreRadius,
    hubOuterRadius,
    inputAngularAcceleration,
    inputAngularSpeed,
    inputSpeedMagnitude,
    lowerGuideY,
    lowerStemMaximumY,
    lowerStemMinimumY,
    minimumGrooveEndClearance,
    outlineDepth,
    outlineThickness,
    outputMaximumY,
    outputMinimumY,
    outputStroke,
    shaftCenter: shaftCenter.clone(),
    shaftCenterZ,
    shaftLength,
    shaftRadius,
    sourceCrankRadius,
    sourceDiskRadius,
    sourceGrooveEndCenter,
    sourceGrooveHalfHeight,
    sourceGrooveOuterHalfHeight,
    sourceHubBoreRadius,
    sourceHubOuterRadius,
    sourceLowerStemMaximumY,
    sourceLowerStemMinimumY,
    sourcePoseAngle,
    sourceScale,
    sourceStemHalfWidth,
    sourceUpperStemMaximumY,
    sourceUpperStemMinimumY,
    sourceWristRadius,
    sourceYokeFrameCenterOffsetY,
    sourceYokeHoleCenterOffsetY,
    sourceYokeInnerCornerRadius,
    sourceYokeInnerHalfHeight,
    sourceYokeInnerHalfWidth,
    sourceYokeOuterCornerRadius,
    sourceYokeOuterHalfHeight,
    sourceYokeOuterHalfWidth,
    stemDepth,
    stemHalfWidth,
    upperGuideY,
    upperStemMaximumY,
    upperStemMinimumY,
    wristBackZ,
    wristCenterZ,
    wristFrontZ,
    wristLength,
    wristRadius,
    yokeBackZ,
    yokeDepth,
    yokeFrameCenterOffsetY,
    yokeFrontZ,
    yokeHoleCenterOffsetY,
    yokeHoleOffsetWithinFrame,
    yokeInnerCornerRadius,
    yokeInnerHalfHeight,
    yokeInnerHalfWidth,
    yokeOuterCornerRadius,
    yokeOuterHalfHeight,
    yokeOuterHalfWidth,
    yokePlaneZ,
  };
  root.userData.outputLaw =
    'straight-horizontal-groove-sinusoidal-rectilinear-stroke';
  root.userData.shapedGrooveUniformMotionNote = true;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtDriverKinematics = stateAtDriverKinematics;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeAtCyclePhase = timeAtCyclePhase;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.diskAngle;
    input.userData.angularSpeed = state.diskAngularSpeed;
    yoke.position.copy(state.yokePosition);
    yoke.rotation.set(0, 0, 0);
    yoke.userData.velocity = state.outputVelocity.clone();
    yoke.userData.acceleration = state.outputAcceleration.clone();
    root.userData.contacts = {
      crankWristGroove: {
        activeWall: state.activeGrooveWall,
        axis: Z_AXIS.clone(),
        endClearance: state.grooveEndClearance,
        lowerPinPoint: state.lowerPinPoint.clone(),
        lowerSurfaceGap: state.lowerSurfaceGap,
        lowerWallPoint: state.lowerWallPoint.clone(),
        normalAccelerationError: state.normalAccelerationError,
        normalVelocityError: state.normalVelocityError,
        pinAxisPoint: state.pinAxisPoint.clone(),
        pinCenter: state.pinGrooveCenter.clone(),
        slidingAcceleration: state.relativeSlidingAcceleration.x,
        slidingSpeed: state.relativeSlidingVelocity.x,
        upperPinPoint: state.upperPinPoint.clone(),
        upperSurfaceGap: state.upperSurfaceGap,
        upperWallPoint: state.upperWallPoint.clone(),
      },
      diskShaft: {
        angularAcceleration: state.diskAngularAcceleration,
        angularSpeed: state.diskAngularSpeed,
        axialDisplacement: 0,
        center: shaftCenter.clone(),
      },
      yokeGuides: {
        axis: Y_AXIS.clone(),
        positionError: state.guidePositionError,
        rotationError: state.yokeRotation,
        runningClearance: guideRunningClearance,
        velocityError: state.guideVelocityError,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);

  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  const model = finish(root, update, new THREE.Vector3(6.8, 4.5, 13.8));
  cameraEnvelope.castShadow = false;
  cameraEnvelope.receiveShadow = false;
  diskRotationIndex.castShadow = false;
  diskRotationIndex.receiveShadow = false;
  translationIndex.castShadow = false;
  translationIndex.receiveShadow = false;
  wristFace.castShadow = false;
  wristFace.receiveShadow = false;
  return model;
}

function slottedBellCrankVariableVerticalMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Exact dimensions exposed by the official Movement 156 animation. The
  // source coordinate system is already Cartesian (positive y is upward).
  const sourceScale = 0.42;
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceDiskCenter = new THREE.Vector2(0, 0);
  const sourceDiskRadius = 4;
  const sourceDiskHubRadius = 0.5;
  const sourceCrankPin = new THREE.Vector2(-2.489644, 2.08906);
  const sourceCrankPinRadius = 0.5;
  const sourceBellPivot = new THREE.Vector2(1.552914, -5.795555);
  const sourceSlotNearCapDistance = 2;
  const sourceSlotFarCapDistance = 10;
  const sourceSlotHalfWidth = 0.5;
  const sourceSlotBodyRadius = 1.25;
  const sourceBellOutputPoint = new THREE.Vector2(0, 6.072478);
  const sourceConnectingRodLength = 14.75;
  const sourceOutputGuideX = 6.710457;
  const sourceOutputGuideTopY = -15.968596;
  const sourceOutputGuideBottomY = -24.082066;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = -fullTurn / cyclePeriod;

  const diskCenter = sourceDiskCenter.clone().multiplyScalar(sourceScale);
  const diskRadius = sourceDiskRadius * sourceScale;
  const diskHubRadius = sourceDiskHubRadius * sourceScale;
  const crankPinLocal = sourceCrankPin.clone().multiplyScalar(sourceScale);
  const crankRadius = crankPinLocal.length();
  const crankPinNominalRadius = sourceCrankPinRadius * sourceScale;
  const pinRunningClearance = 0.022;
  const crankPinRadius = crankPinNominalRadius - pinRunningClearance;
  const bellPivot = sourceBellPivot.clone().multiplyScalar(sourceScale);
  const pivotDistance = bellPivot.length();
  const slotNearCapDistance = sourceSlotNearCapDistance * sourceScale;
  const slotFarCapDistance = sourceSlotFarCapDistance * sourceScale;
  const slotHalfWidth = sourceSlotHalfWidth * sourceScale;
  const slotBodyRadius = sourceSlotBodyRadius * sourceScale;
  const slotMidpointDistance = (
    slotNearCapDistance + slotFarCapDistance
  ) / 2;
  const slotStraightHalfLength = (
    slotFarCapDistance - slotNearCapDistance
  ) / 2;
  const bellOutputLength = sourceBellOutputPoint.y * sourceScale;
  const connectingRodLength = sourceConnectingRodLength * sourceScale;
  const outputGuideX = sourceOutputGuideX * sourceScale;
  const outputGuideTopY = sourceOutputGuideTopY * sourceScale;
  const outputGuideBottomY = sourceOutputGuideBottomY * sourceScale;
  const sourceCrankAngle = Math.atan2(
    sourceCrankPin.y,
    sourceCrankPin.x,
  );
  const minimumSlotCoordinate = pivotDistance - crankRadius;
  const maximumSlotCoordinate = pivotDistance + crankRadius;

  const diskCenterZ = -0.16;
  const diskDepth = 0.3;
  const diskFrontZ = diskCenterZ + diskDepth / 2;
  const leverCenterZ = 0.34;
  const leverDepth = 0.27;
  const leverFrontZ = leverCenterZ + leverDepth / 2;
  const slotOutlineDepth = 0.035;
  const slotOutlineZ = leverFrontZ + slotOutlineDepth / 2 + 0.004;
  const outputRodPlaneZ = 0.76;
  const crankPinBackZ = diskCenterZ - diskDepth / 2 - 0.06;
  const crankPinFrontZ = outputRodPlaneZ + 0.12;
  const crankPinLength = crankPinFrontZ - crankPinBackZ;
  const crankPinCenterZ = (crankPinBackZ + crankPinFrontZ) / 2;
  const pivotShaftLength = 1.42;
  const pivotShaftCenterZ = 0.08;
  const frameZ = -0.72;
  const outputGuideHalfGap = 0.34;
  const outputSliderHalfWidth = 0.26;
  const outputSliderHalfHeight = 0.23;
  const outputSliderDepth = 0.3;
  const outputGuideRailTopY = outputGuideTopY
    + outputSliderHalfHeight + 0.18;
  const outputGuideRailBottomY = outputGuideBottomY - 0.12;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.63,
  });
  const outputMaterial = matte(PALETTE.brass, {
    metalness: 0.14,
    roughness: 0.57,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.68,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const input = new THREE.Group();
  input.position.set(diskCenter.x, diskCenter.y, 0);
  input.userData.axis = Z_AXIS.clone();
  input.userData.role = 'uniformly-clockwise-rotating-input-disk';
  const inputRotor = new THREE.Group();
  input.add(inputRotor);
  const driverDisk = cylinderAlongZ(
    diskRadius,
    diskDepth,
    driverMaterial,
    80,
  );
  driverDisk.position.z = diskCenterZ;
  driverDisk.userData.role = 'source-four-unit-radius-driver-disk';
  inputRotor.add(driverDisk);
  const driverRim = new THREE.Mesh(
    new THREE.TorusGeometry(diskRadius, 0.045, 9, 80),
    darkMaterial,
  );
  driverRim.position.z = diskFrontZ + 0.025;
  driverRim.userData.role = 'dark-outline-of-driver-disk';
  inputRotor.add(driverRim);
  const driverHub = cylinderAlongZ(
    diskHubRadius,
    diskDepth * 1.52,
    darkMaterial,
    42,
  );
  driverHub.position.z = diskCenterZ;
  driverHub.userData.role = 'driver-disk-hub';
  inputRotor.add(driverHub);
  const driverIndex = makeBeam(
    new THREE.Vector3(
      diskHubRadius * 1.3,
      0,
      diskFrontZ + 0.06,
    ),
    new THREE.Vector3(
      diskRadius * 0.72,
      0,
      diskFrontZ + 0.06,
    ),
    { color: PALETTE.white, depth: 0.03, thickness: 0.065 },
  );
  driverIndex.userData.role = 'white-index-on-uniform-input-disk';
  inputRotor.add(driverIndex);
  const driverShaft = cylinderAlongZ(
    diskHubRadius * 0.58,
    1.42,
    darkMaterial,
    36,
  );
  driverShaft.position.z = -0.31;
  driverShaft.userData.role = 'uniformly-rotating-input-shaft';
  inputRotor.add(driverShaft);

  const crankPin = new THREE.Group();
  crankPin.position.set(
    crankPinLocal.x,
    crankPinLocal.y,
    crankPinCenterZ,
  );
  crankPin.userData.axis = Z_AXIS.clone();
  crankPin.userData.role = 'disk-fixed-wrist-pin-sliding-in-bell-slot';
  const crankPinBody = cylinderAlongZ(
    crankPinRadius,
    crankPinLength,
    outputMaterial,
    36,
  );
  crankPinBody.userData.role = 'long-wrist-pin-bridging-disk-and-slot-planes';
  crankPin.add(crankPinBody);
  const crankPinRim = new THREE.Mesh(
    new THREE.TorusGeometry(crankPinRadius, 0.03, 9, 36),
    darkMaterial,
  );
  crankPinRim.position.z = crankPinLength / 2 + 0.012;
  crankPinRim.userData.role = 'front-rim-of-disk-wrist-pin';
  crankPin.add(crankPinRim);
  const crankPinFace = new THREE.Mesh(
    new THREE.CircleGeometry(crankPinRadius * 0.62, 32),
    indexMaterial,
  );
  crankPinFace.position.z = crankPinLength / 2 + 0.034;
  crankPinFace.userData.role = 'white-face-of-slot-driving-wrist-pin';
  crankPin.add(crankPinFace);
  inputRotor.add(crankPin);

  const lever = new THREE.Group();
  lever.position.set(bellPivot.x, bellPivot.y, 0);
  lever.userData.axis = Z_AXIS.clone();
  lever.userData.role = 'fixed-pivot-right-angle-slotted-bell-crank';
  const slottedArm = new THREE.Mesh(
    centeredExtrusion(horizontalCapsuleRingShape(
      slotHalfWidth,
      slotBodyRadius,
      slotStraightHalfLength,
    ), leverDepth, 0.015),
    drivenMaterial,
  );
  slottedArm.position.set(-slotMidpointDistance, 0, leverCenterZ);
  slottedArm.userData.role = 'one-open-radial-slot-in-bell-crank-arm';
  lever.add(slottedArm);
  const slotInnerOutline = new THREE.Mesh(
    centeredExtrusion(horizontalCapsuleRingShape(
      slotHalfWidth - 0.03,
      slotHalfWidth + 0.038,
      slotStraightHalfLength,
    ), slotOutlineDepth, 0.004),
    darkMaterial,
  );
  slotInnerOutline.position.set(
    -slotMidpointDistance,
    0,
    slotOutlineZ,
  );
  slotInnerOutline.userData.role = 'dark-outline-of-open-bell-crank-slot';
  lever.add(slotInnerOutline);
  const slotOuterOutline = new THREE.Mesh(
    centeredExtrusion(horizontalCapsuleRingShape(
      slotBodyRadius - 0.035,
      slotBodyRadius + 0.018,
      slotStraightHalfLength,
    ), slotOutlineDepth, 0.004),
    darkMaterial,
  );
  slotOuterOutline.position.set(
    -slotMidpointDistance,
    0,
    slotOutlineZ - 0.004,
  );
  slotOuterOutline.userData.role = 'dark-outer-outline-of-slotted-arm';
  lever.add(slotOuterOutline);

  const bellOutputArm = makeBeam(
    new THREE.Vector3(0, slotBodyRadius * 0.5, leverCenterZ),
    new THREE.Vector3(0, bellOutputLength, leverCenterZ),
    {
      color: PALETTE.driven,
      depth: leverDepth,
      thickness: slotBodyRadius * 1.08,
    },
  );
  bellOutputArm.userData.role = 'perpendicular-output-arm-of-bell-crank';
  lever.add(bellOutputArm);
  const leverPivotHub = cylinderAlongZ(
    slotBodyRadius,
    0.54,
    drivenMaterial,
    56,
  );
  leverPivotHub.position.z = leverCenterZ;
  leverPivotHub.userData.role = 'coaxial-bell-crank-pivot-hub';
  lever.add(leverPivotHub);
  const leverPivotRing = new THREE.Mesh(
    new THREE.TorusGeometry(slotBodyRadius * 0.73, 0.06, 10, 52),
    darkMaterial,
  );
  leverPivotRing.position.z = leverCenterZ + 0.31;
  leverPivotRing.userData.role = 'front-ring-of-fixed-bell-crank-pivot';
  lever.add(leverPivotRing);
  const bellOutputHub = cylinderAlongZ(
    sourceCrankPinRadius * sourceScale * 1.34,
    0.48,
    drivenMaterial,
    44,
  );
  bellOutputHub.position.set(0, bellOutputLength, leverCenterZ + 0.08);
  bellOutputHub.userData.role = 'bell-crank-to-connecting-rod-joint-hub';
  lever.add(bellOutputHub);
  const bellOutputRing = new THREE.Mesh(
    new THREE.TorusGeometry(
      sourceCrankPinRadius * sourceScale * 0.92,
      0.045,
      9,
      40,
    ),
    darkMaterial,
  );
  bellOutputRing.position.set(0, bellOutputLength, outputRodPlaneZ + 0.016);
  bellOutputRing.userData.role = 'front-ring-of-output-rod-joint';
  lever.add(bellOutputRing);
  const bellOutputPin = cylinderAlongZ(
    sourceCrankPinRadius * sourceScale * 0.47,
    outputRodPlaneZ - leverCenterZ + 0.55,
    darkMaterial,
    30,
  );
  bellOutputPin.position.set(
    0,
    bellOutputLength,
    (outputRodPlaneZ + leverCenterZ) / 2,
  );
  bellOutputPin.userData.role = 'pin-joining-bell-crank-to-connecting-rod';
  lever.add(bellOutputPin);
  const leverIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      slotBodyRadius * 0.9,
      0.065,
      0.032,
    ),
    indexMaterial,
  );
  leverIndex.position.set(
    0,
    bellOutputLength * 0.68,
    leverFrontZ + 0.055,
  );
  leverIndex.rotation.z = Math.PI / 2;
  leverIndex.userData.role = 'white-index-on-oscillating-bell-crank';
  lever.add(leverIndex);

  const pivotShaft = cylinderAlongZ(
    diskHubRadius * 0.72,
    pivotShaftLength,
    darkMaterial,
    38,
  );
  pivotShaft.position.set(
    bellPivot.x,
    bellPivot.y,
    pivotShaftCenterZ,
  );
  pivotShaft.userData.role = 'fixed-shaft-through-bell-crank-pivot';

  const sourceStateGeometry = (() => {
    const pin = crankPinLocal.clone();
    const pinFromPivot = pin.clone().sub(bellPivot);
    const leverAngle = Math.atan2(pinFromPivot.y, pinFromPivot.x) - Math.PI;
    const outputPoint = new THREE.Vector2(
      bellPivot.x - Math.sin(leverAngle) * bellOutputLength,
      bellPivot.y + Math.cos(leverAngle) * bellOutputLength,
    );
    const horizontalSpan = outputGuideX - outputPoint.x;
    const verticalSpan = Math.sqrt(
      connectingRodLength ** 2 - horizontalSpan ** 2,
    );
    return {
      leverAngle,
      outputPoint,
      sliderPoint: new THREE.Vector2(
        outputGuideX,
        outputPoint.y - verticalSpan,
      ),
    };
  })();
  const connectingRod = makeDynamicLink({
    color: PALETTE.brass,
    depth: 0.22,
    jointRadius: 0.24,
    thickness: 0.22,
  });
  connectingRod.userData.role =
    'fixed-length-link-from-bell-crank-to-guided-output';
  connectingRod.userData.setEndpoints(
    new THREE.Vector3(
      sourceStateGeometry.outputPoint.x,
      sourceStateGeometry.outputPoint.y,
      outputRodPlaneZ,
    ),
    new THREE.Vector3(
      sourceStateGeometry.sliderPoint.x,
      sourceStateGeometry.sliderPoint.y,
      outputRodPlaneZ,
    ),
  );

  const outputSlider = new THREE.Group();
  outputSlider.position.set(
    sourceStateGeometry.sliderPoint.x,
    sourceStateGeometry.sliderPoint.y,
    outputRodPlaneZ,
  );
  outputSlider.userData.role = 'strictly-vertical-guided-output-slider';
  const outputSliderShoe = new THREE.Mesh(
    new THREE.BoxGeometry(
      outputSliderHalfWidth * 2,
      outputSliderHalfHeight * 2,
      outputSliderDepth,
    ),
    outputMaterial,
  );
  outputSliderShoe.position.z = -0.08;
  outputSliderShoe.userData.role = 'output-crosshead-between-fixed-guides';
  outputSlider.add(outputSliderShoe);
  const outputSliderPin = cylinderAlongZ(
    0.115,
    0.62,
    darkMaterial,
    30,
  );
  outputSliderPin.userData.role = 'connecting-rod-to-output-slider-pin';
  outputSlider.add(outputSliderPin);
  const outputMotionIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.07, 0.038),
    indexMaterial,
  );
  outputMotionIndex.position.set(0, 0, outputSliderDepth / 2 + 0.035);
  outputMotionIndex.userData.role = 'white-index-on-vertical-output-slider';
  outputSlider.add(outputMotionIndex);

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-bearings-and-output-guide-frame';
  const baseY = outputGuideRailBottomY - 0.34;
  const frameLeftX = -2.9;
  const frameRightX = outputGuideX + 0.78;
  const baseRail = makeBeam(
    new THREE.Vector3(frameLeftX, baseY, frameZ),
    new THREE.Vector3(frameRightX, baseY, frameZ),
    { color: PALETTE.frame, depth: 0.25, thickness: 0.18 },
  );
  baseRail.userData.role = 'fixed-base-under-complete-output-stroke';
  const driverPost = makeBeam(
    new THREE.Vector3(-2.45, baseY, frameZ),
    new THREE.Vector3(-2.45, 0, frameZ),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.16 },
  );
  driverPost.userData.role = 'rear-post-supporting-input-disk-axis';
  const driverBearingBridge = makeBeam(
    new THREE.Vector3(-2.45, 0, frameZ),
    new THREE.Vector3(0, 0, frameZ),
    { color: PALETTE.frame, depth: 0.2, thickness: 0.14 },
  );
  driverBearingBridge.userData.role = 'fixed-input-bearing-crossbar';
  const pivotPost = makeBeam(
    new THREE.Vector3(bellPivot.x, baseY, frameZ),
    new THREE.Vector3(bellPivot.x, bellPivot.y, frameZ),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.16 },
  );
  pivotPost.userData.role = 'rear-post-supporting-bell-crank-pivot';
  const centerCrossbar = makeBeam(
    new THREE.Vector3(0, 0, frameZ),
    new THREE.Vector3(bellPivot.x, bellPivot.y, frameZ),
    { color: PALETTE.frame, depth: 0.18, thickness: 0.13 },
  );
  centerCrossbar.userData.role = 'fixed-crossbar-between-mechanism-centers';
  const driverBearing = new THREE.Mesh(
    new THREE.TorusGeometry(diskHubRadius * 1.1, 0.065, 10, 44),
    frameMaterial,
  );
  driverBearing.position.set(0, 0, frameZ + 0.035);
  driverBearing.userData.role = 'fixed-rear-input-shaft-bearing';
  const pivotBearing = new THREE.Mesh(
    new THREE.TorusGeometry(diskHubRadius * 1.15, 0.07, 10, 44),
    frameMaterial,
  );
  pivotBearing.position.set(bellPivot.x, bellPivot.y, frameZ + 0.035);
  pivotBearing.userData.role = 'fixed-rear-bell-crank-bearing';
  const outputGuideRails = [-1, 1].map((sideSign) => {
    const rail = makeBeam(
      new THREE.Vector3(
        outputGuideX + sideSign * outputGuideHalfGap,
        outputGuideRailBottomY,
        frameZ + 0.1,
      ),
      new THREE.Vector3(
        outputGuideX + sideSign * outputGuideHalfGap,
        outputGuideRailTopY,
        frameZ + 0.1,
      ),
      { color: PALETTE.frame, depth: 0.17, thickness: 0.12 },
    );
    rail.userData.role = 'fixed-rail-constraining-output-slider';
    rail.userData.side = sideSign < 0 ? 'left' : 'right';
    return rail;
  });
  const outputGuideCrossbars = [
    outputGuideRailTopY,
    outputGuideRailBottomY,
  ].map(
    (guideY, index) => {
      const crossbar = makeBeam(
        new THREE.Vector3(
          outputGuideX - outputGuideHalfGap,
          guideY,
          frameZ + 0.1,
        ),
        new THREE.Vector3(
          outputGuideX + outputGuideHalfGap,
          guideY,
          frameZ + 0.1,
        ),
        { color: PALETTE.frame, depth: 0.17, thickness: 0.12 },
      );
      crossbar.userData.index = index;
      crossbar.userData.role = 'fixed-output-guide-end-crossbar';
      return crossbar;
    },
  );
  fixedFrame.add(
    baseRail,
    driverPost,
    driverBearingBridge,
    pivotPost,
    centerCrossbar,
    driverBearing,
    pivotBearing,
    ...outputGuideRails,
    ...outputGuideCrossbars,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.7, 13.4, 2.15),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0.25, -4.05, 0.05);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-complete-linkage-and-stroke-envelope';

  root.add(
    cameraEnvelope,
    fixedFrame,
    pivotShaft,
    input,
    lever,
    connectingRod,
    outputSlider,
  );

  const stateAtDriverKinematics = ({
    driverAngle,
    driverAngularAcceleration = 0,
    driverAngularSpeed = inputAngularSpeed,
  }) => {
    const crankAngle = sourceCrankAngle + driverAngle;
    const crankRadiusVector = new THREE.Vector2(
      Math.cos(crankAngle) * crankRadius,
      Math.sin(crankAngle) * crankRadius,
    );
    const crankPoint2 = diskCenter.clone().add(crankRadiusVector);
    const crankPoint = new THREE.Vector3(
      crankPoint2.x,
      crankPoint2.y,
      crankPinCenterZ,
    );
    const crankPinVelocity2 = new THREE.Vector2(
      -crankRadiusVector.y * driverAngularSpeed,
      crankRadiusVector.x * driverAngularSpeed,
    );
    const crankPinAcceleration2 = new THREE.Vector2(
      -crankRadiusVector.x * driverAngularSpeed ** 2
        - crankRadiusVector.y * driverAngularAcceleration,
      -crankRadiusVector.y * driverAngularSpeed ** 2
        + crankRadiusVector.x * driverAngularAcceleration,
    );
    const pinFromPivot = crankPoint2.clone().sub(bellPivot);
    const slotCoordinate = pinFromPivot.length();
    const slotAxis2 = pinFromPivot.clone().multiplyScalar(1 / slotCoordinate);
    const slotNormal2 = new THREE.Vector2(-slotAxis2.y, slotAxis2.x);
    const leverAngle = Math.atan2(pinFromPivot.y, pinFromPivot.x) - Math.PI;
    const radialDotVelocity = pinFromPivot.dot(crankPinVelocity2);
    const radialCrossVelocity = pinFromPivot.x * crankPinVelocity2.y
      - pinFromPivot.y * crankPinVelocity2.x;
    const leverAngularSpeed = radialCrossVelocity / slotCoordinate ** 2;
    const leverAngularAcceleration = (
      pinFromPivot.x * crankPinAcceleration2.y
        - pinFromPivot.y * crankPinAcceleration2.x
    ) / slotCoordinate ** 2
      - 2 * radialDotVelocity * radialCrossVelocity
        / slotCoordinate ** 4;
    const slotCoordinateSpeed = radialDotVelocity / slotCoordinate;
    const slotCoordinateAcceleration = (
      crankPinVelocity2.lengthSq()
        + pinFromPivot.dot(crankPinAcceleration2)
    ) / slotCoordinate
      - radialDotVelocity ** 2 / slotCoordinate ** 3;
    const slotAxis = new THREE.Vector3(slotAxis2.x, slotAxis2.y, 0);
    const slotNormal = new THREE.Vector3(slotNormal2.x, slotNormal2.y, 0);
    const pinFromPivot3 = new THREE.Vector3(
      pinFromPivot.x,
      pinFromPivot.y,
      0,
    );
    const crankPinVelocity = new THREE.Vector3(
      crankPinVelocity2.x,
      crankPinVelocity2.y,
      0,
    );
    const crankPinAcceleration = new THREE.Vector3(
      crankPinAcceleration2.x,
      crankPinAcceleration2.y,
      0,
    );
    const leverVelocityAtPin = new THREE.Vector3(
      -pinFromPivot.y * leverAngularSpeed,
      pinFromPivot.x * leverAngularSpeed,
      0,
    );
    const relativePinVelocity = crankPinVelocity.clone().sub(
      leverVelocityAtPin,
    );
    const reconstructedPinAcceleration = slotAxis.clone().multiplyScalar(
      slotCoordinateAcceleration
        - slotCoordinate * leverAngularSpeed ** 2,
    ).addScaledVector(
      slotNormal,
      slotCoordinate * leverAngularAcceleration
        + 2 * slotCoordinateSpeed * leverAngularSpeed,
    );
    const pinLocal = pinFromPivot.clone().rotateAround(
      new THREE.Vector2(),
      -leverAngle,
    );

    const outputRadiusVector2 = new THREE.Vector2(
      -Math.sin(leverAngle) * bellOutputLength,
      Math.cos(leverAngle) * bellOutputLength,
    );
    const bellOutputPoint2 = bellPivot.clone().add(outputRadiusVector2);
    const bellOutputPoint = new THREE.Vector3(
      bellOutputPoint2.x,
      bellOutputPoint2.y,
      outputRodPlaneZ,
    );
    const bellOutputVelocity2 = new THREE.Vector2(
      -outputRadiusVector2.y * leverAngularSpeed,
      outputRadiusVector2.x * leverAngularSpeed,
    );
    const bellOutputAcceleration2 = new THREE.Vector2(
      -outputRadiusVector2.y * leverAngularAcceleration
        - outputRadiusVector2.x * leverAngularSpeed ** 2,
      outputRadiusVector2.x * leverAngularAcceleration
        - outputRadiusVector2.y * leverAngularSpeed ** 2,
    );
    const horizontalRodSpan = outputGuideX - bellOutputPoint2.x;
    const verticalRodSpan = Math.sqrt(Math.max(
      0,
      connectingRodLength ** 2 - horizontalRodSpan ** 2,
    ));
    const horizontalRodSpanSpeed = -bellOutputVelocity2.x;
    const horizontalRodSpanAcceleration = -bellOutputAcceleration2.x;
    const verticalRodSpanSpeed = -horizontalRodSpan
      * horizontalRodSpanSpeed / verticalRodSpan;
    const verticalRodSpanAcceleration = -(
      horizontalRodSpanSpeed ** 2
        + horizontalRodSpan * horizontalRodSpanAcceleration
    ) / verticalRodSpan
      - (
        horizontalRodSpan * horizontalRodSpanSpeed
      ) ** 2 / verticalRodSpan ** 3;
    const outputSliderY = bellOutputPoint2.y - verticalRodSpan;
    const outputSliderVelocityY = bellOutputVelocity2.y
      - verticalRodSpanSpeed;
    const outputSliderAccelerationY = bellOutputAcceleration2.y
      - verticalRodSpanAcceleration;
    const outputSliderPoint = new THREE.Vector3(
      outputGuideX,
      outputSliderY,
      outputRodPlaneZ,
    );
    const outputSliderVelocity = new THREE.Vector3(
      0,
      outputSliderVelocityY,
      0,
    );
    const outputSliderAcceleration = new THREE.Vector3(
      0,
      outputSliderAccelerationY,
      0,
    );
    const connectingRodVector = outputSliderPoint.clone().sub(
      bellOutputPoint,
    );
    const connectingRodRelativeVelocity = outputSliderVelocity.clone().sub(
      new THREE.Vector3(
        bellOutputVelocity2.x,
        bellOutputVelocity2.y,
        0,
      ),
    );
    const connectingRodRelativeAcceleration = outputSliderAcceleration
      .clone().sub(new THREE.Vector3(
        bellOutputAcceleration2.x,
        bellOutputAcceleration2.y,
        0,
      ));
    const connectingRodAngularSpeed = (
      connectingRodVector.x * connectingRodRelativeVelocity.y
        - connectingRodVector.y * connectingRodRelativeVelocity.x
    ) / connectingRodLength ** 2;
    const connectingRodAngularAcceleration = (
      connectingRodVector.x * connectingRodRelativeAcceleration.y
        - connectingRodVector.y * connectingRodRelativeAcceleration.x
    ) / connectingRodLength ** 2
      - 2 * connectingRodVector.dot(connectingRodRelativeVelocity)
        * (
          connectingRodVector.x * connectingRodRelativeVelocity.y
            - connectingRodVector.y * connectingRodRelativeVelocity.x
        ) / connectingRodLength ** 4;
    const wallContacts = [-1, 1].map((sideSign) => {
      const wallPoint = crankPoint.clone().addScaledVector(
        slotNormal,
        sideSign * slotHalfWidth,
      );
      const pinSurfacePoint = crankPoint.clone().addScaledVector(
        slotNormal,
        sideSign * crankPinRadius,
      );
      const wallRadiusVector = wallPoint.clone().sub(new THREE.Vector3(
        bellPivot.x,
        bellPivot.y,
        crankPinCenterZ,
      ));
      const wallSurfaceVelocity = new THREE.Vector3(
        -wallRadiusVector.y * leverAngularSpeed,
        wallRadiusVector.x * leverAngularSpeed,
        0,
      );
      const pinSurfaceOffset = pinSurfacePoint.clone().sub(crankPoint);
      const pinSurfaceVelocity = crankPinVelocity.clone().add(
        new THREE.Vector3(
          -pinSurfaceOffset.y * driverAngularSpeed,
          pinSurfaceOffset.x * driverAngularSpeed,
          0,
        ),
      );
      const wallToPinNormal = slotNormal.clone().multiplyScalar(-sideSign);
      const relativeSurfaceVelocity = pinSurfaceVelocity.clone().sub(
        wallSurfaceVelocity,
      );
      return {
        centerDistance: slotHalfWidth,
        normalVelocityError: relativeSurfaceVelocity.dot(wallToPinNormal),
        pinSurfacePoint,
        pinSurfaceVelocity,
        side: sideSign < 0 ? 'clockwise-wall' : 'counterclockwise-wall',
        surfaceGap: slotHalfWidth - crankPinRadius,
        surfaceSlipSpeed: relativeSurfaceVelocity.dot(slotAxis),
        wallPoint,
        wallSurfaceVelocity,
        wallToPinNormal,
      };
    });
    return {
      bellOutputAcceleration: new THREE.Vector3(
        bellOutputAcceleration2.x,
        bellOutputAcceleration2.y,
        0,
      ),
      bellOutputPoint,
      bellOutputVelocity: new THREE.Vector3(
        bellOutputVelocity2.x,
        bellOutputVelocity2.y,
        0,
      ),
      connectingRodAngle: Math.atan2(
        connectingRodVector.y,
        connectingRodVector.x,
      ),
      connectingRodAngularAcceleration,
      connectingRodAngularSpeed,
      connectingRodLengthError: connectingRodVector.length()
        - connectingRodLength,
      connectingRodRelativeAcceleration,
      connectingRodRelativeVelocity,
      connectingRodVector,
      crankAngle,
      crankPinAcceleration,
      crankPinVelocity,
      crankPoint,
      driverAngle,
      driverAngularAcceleration,
      driverAngularSpeed,
      inputRevolutions: driverAngle / fullTurn,
      leverAngle,
      leverAngularAcceleration,
      leverAngularSpeed,
      leverVelocityAtPin,
      localPinCenterlineError: pinLocal.y,
      localPinX: pinLocal.x,
      maximumSlotEndClearance: slotFarCapDistance - slotCoordinate,
      minimumSlotEndClearance: slotCoordinate - slotNearCapDistance,
      outputGuideAccelerationError: outputSliderAcceleration.x,
      outputGuidePositionError: outputSliderPoint.x - outputGuideX,
      outputGuideVelocityError: outputSliderVelocity.x,
      outputSliderAcceleration,
      outputSliderPoint,
      outputSliderVelocity,
      pinAccelerationConstraintError: crankPinAcceleration.clone().sub(
        reconstructedPinAcceleration,
      ).length(),
      pinFromPivot,
      pinOrbitError: crankRadiusVector.length() - crankRadius,
      relativePinVelocity,
      slotAxis,
      slotCenterlineError: pinFromPivot3.dot(slotNormal),
      slotCenterlineVelocityError: relativePinVelocity.dot(slotNormal),
      slotCoordinate,
      slotCoordinateAcceleration,
      slotCoordinateSpeed,
      slotNormal,
      verticalRodSpan,
      verticalRodSpanAcceleration,
      verticalRodSpanSpeed,
      wallContacts,
    };
  };
  const stateAtDriverAngle = (driverAngle) => stateAtDriverKinematics({
    driverAngle,
  });
  const stateAtCyclePhase = (phase) => stateAtDriverAngle(-fullTurn * phase);
  const stateAtTime = (time) => stateAtDriverAngle(inputAngularSpeed * time);

  const extrema = [];
  const extremaSamples = 4096;
  let previousPhase = 0;
  let previousVelocity = stateAtCyclePhase(previousPhase)
    .outputSliderVelocity.y;
  for (let sample = 1; sample <= extremaSamples; sample += 1) {
    const phase = sample / extremaSamples;
    const velocity = stateAtCyclePhase(phase).outputSliderVelocity.y;
    if (previousVelocity * velocity < 0) {
      let lower = previousPhase;
      let upper = phase;
      let lowerVelocity = previousVelocity;
      for (let iteration = 0; iteration < 64; iteration += 1) {
        const middle = (lower + upper) / 2;
        const middleVelocity = stateAtCyclePhase(middle)
          .outputSliderVelocity.y;
        if (lowerVelocity * middleVelocity <= 0) {
          upper = middle;
        } else {
          lower = middle;
          lowerVelocity = middleVelocity;
        }
      }
      const extremumPhase = (lower + upper) / 2;
      const extremumState = stateAtCyclePhase(extremumPhase);
      extrema.push({
        phase: extremumPhase,
        sliderY: extremumState.outputSliderPoint.y,
        type: extremumState.outputSliderAcceleration.y > 0
          ? 'lower-turning-point'
          : 'upper-turning-point',
      });
    }
    previousPhase = phase;
    previousVelocity = velocity;
  }
  extrema.sort((left, right) => left.phase - right.phase);
  const lowerExtremum = extrema.reduce((lowest, extremum) => (
    !lowest || extremum.sliderY < lowest.sliderY ? extremum : lowest
  ), null);
  const upperExtremum = extrema.reduce((highest, extremum) => (
    !highest || extremum.sliderY > highest.sliderY ? extremum : highest
  ), null);
  const outputStroke = upperExtremum.sliderY - lowerExtremum.sliderY;
  const shortStrokeFraction = THREE.MathUtils.euclideanModulo(
    upperExtremum.phase - lowerExtremum.phase,
    1,
  );
  const longStrokeFraction = 1 - shortStrokeFraction;
  const canonicalStates = {
    lower: stateAtCyclePhase(lowerExtremum.phase),
    source: stateAtCyclePhase(0),
    upper: stateAtCyclePhase(upperExtremum.phase),
  };
  const canonicalTimes = {
    lower: lowerExtremum.phase * cyclePeriod,
    nextSource: cyclePeriod,
    source: 0,
    upper: upperExtremum.phase * cyclePeriod,
  };

  root.userData.mechanism =
    'rotary-disk-slotted-bell-crank-guided-variable-reciprocator';
  root.userData.cameraDistanceScale = 1.02;
  root.userData.blocks = {
    baseRail,
    bellOutputArm,
    bellOutputHub,
    bellOutputPin,
    bellOutputRing,
    cameraEnvelope,
    centerCrossbar,
    connectingRod,
    crankPin,
    crankPinBody,
    crankPinFace,
    crankPinRim,
    driverBearing,
    driverBearingBridge,
    driverDisk,
    driverHub,
    driverIndex,
    driverPost,
    driverRim,
    driverShaft,
    fixedFrame,
    input,
    inputRotor,
    lever,
    leverIndex,
    leverPivotHub,
    leverPivotRing,
    outputGuideCrossbars,
    outputGuideRails,
    outputMotionIndex,
    outputSlider,
    outputSliderPin,
    outputSliderShoe,
    pivotBearing,
    pivotPost,
    pivotShaft,
    slotInnerOutline,
    slotOuterOutline,
    slottedArm,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    baseY,
    bellOutputLength,
    bellPivot: bellPivot.clone(),
    connectingRodLength,
    crankPinBackZ,
    crankPinCenterZ,
    crankPinFrontZ,
    crankPinLength,
    crankPinLocal: crankPinLocal.clone(),
    crankPinNominalRadius,
    crankPinRadius,
    crankRadius,
    cyclePeriod,
    diskCenter: diskCenter.clone(),
    diskCenterZ,
    diskDepth,
    diskFrontZ,
    diskHubRadius,
    diskRadius,
    frameLeftX,
    frameRightX,
    frameZ,
    fullTurn,
    inputAngularSpeed,
    leverCenterZ,
    leverDepth,
    leverFrontZ,
    longStrokeFraction,
    maximumSlotCoordinate,
    minimumSlotCoordinate,
    outputGuideBottomY,
    outputGuideHalfGap,
    outputGuideRailBottomY,
    outputGuideRailTopY,
    outputGuideTopY,
    outputGuideX,
    outputRodPlaneZ,
    outputSliderDepth,
    outputSliderHalfHeight,
    outputSliderHalfWidth,
    outputStroke,
    pinRunningClearance,
    pivotDistance,
    pivotShaftCenterZ,
    pivotShaftLength,
    shortStrokeFraction,
    slotBodyRadius,
    slotFarCapDistance,
    slotHalfWidth,
    slotMidpointDistance,
    slotNearCapDistance,
    slotOutlineDepth,
    slotOutlineZ,
    slotStraightHalfLength,
    sourceBellOutputPoint: sourceBellOutputPoint.clone(),
    sourceBellPivot: sourceBellPivot.clone(),
    sourceConnectingRodLength,
    sourceCrankAngle,
    sourceCrankPin: sourceCrankPin.clone(),
    sourceCrankPinRadius,
    sourceCyclesPerMinute,
    sourceDiskCenter: sourceDiskCenter.clone(),
    sourceDiskHubRadius,
    sourceDiskRadius,
    sourceImageHeight,
    sourceImageWidth,
    sourceOutputGuideBottomY,
    sourceOutputGuideTopY,
    sourceOutputGuideX,
    sourceScale,
    sourceSlotBodyRadius,
    sourceSlotFarCapDistance,
    sourceSlotHalfWidth,
    sourceSlotNearCapDistance,
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtDriverKinematics = stateAtDriverKinematics;
  root.userData.stateAtTime = stateAtTime;
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.driverAngle;
    input.userData.angularSpeed = state.driverAngularSpeed;
    driverShaft.userData.angularSpeed = state.driverAngularSpeed;
    crankPin.userData.angularSpeed = state.driverAngularSpeed;
    lever.rotation.z = state.leverAngle;
    lever.userData.angularSpeed = state.leverAngularSpeed;
    lever.userData.angularAcceleration = state.leverAngularAcceleration;
    connectingRod.userData.setEndpoints(
      state.bellOutputPoint,
      state.outputSliderPoint,
    );
    connectingRod.userData.angularSpeed = state.connectingRodAngularSpeed;
    outputSlider.position.copy(state.outputSliderPoint);
    outputSlider.userData.velocity = state.outputSliderVelocity.clone();
    outputSlider.userData.acceleration = state.outputSliderAcceleration.clone();
    root.userData.contacts = {
      bellCrankPivot: {
        axis: Z_AXIS.clone(),
        centerError: Math.hypot(
          lever.position.x - bellPivot.x,
          lever.position.y - bellPivot.y,
        ),
      },
      connectingRod: {
        angularSpeed: state.connectingRodAngularSpeed,
        bottomPoint: state.outputSliderPoint.clone(),
        length: connectingRodLength,
        lengthError: state.connectingRodLengthError,
        topPoint: state.bellOutputPoint.clone(),
      },
      crankPinSlot: {
        centerlineError: state.slotCenterlineError,
        centerlineVelocityError: state.slotCenterlineVelocityError,
        localCenterlineError: state.localPinCenterlineError,
        maximumEndClearance: state.maximumSlotEndClearance,
        minimumEndClearance: state.minimumSlotEndClearance,
        pinAccelerationConstraintError: state.pinAccelerationConstraintError,
        pinFixedToDisk: true,
        pinOrbitError: state.pinOrbitError,
        runningClearance: pinRunningClearance,
        slotCoordinate: state.slotCoordinate,
        slotCoordinateSpeed: state.slotCoordinateSpeed,
        wallContacts: state.wallContacts.map((contact) => ({
          ...contact,
          pinSurfacePoint: contact.pinSurfacePoint.clone(),
          pinSurfaceVelocity: contact.pinSurfaceVelocity.clone(),
          wallPoint: contact.wallPoint.clone(),
          wallSurfaceVelocity: contact.wallSurfaceVelocity.clone(),
          wallToPinNormal: contact.wallToPinNormal.clone(),
        })),
      },
      outputSliderGuides: {
        accelerationError: state.outputGuideAccelerationError,
        axis: Y_AXIS.clone(),
        positionError: state.outputGuidePositionError,
        rotationError: 0,
        velocityError: state.outputGuideVelocityError,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  const model = finish(root, update, new THREE.Vector3(6.5, 4.2, 13.8));
  cameraEnvelope.castShadow = false;
  cameraEnvelope.receiveShadow = false;
  crankPinFace.castShadow = false;
  crankPinFace.receiveShadow = false;
  driverIndex.traverse((object) => {
    object.castShadow = false;
    object.receiveShadow = false;
  });
  leverIndex.castShadow = false;
  leverIndex.receiveShadow = false;
  outputMotionIndex.castShadow = false;
  outputMotionIndex.receiveShadow = false;
  return model;
}

function connectingRodBellCrankVariableVerticalMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Exact construction exposed by the official Movement 157 animation. Its
  // Cartesian coordinates define both finite connecting rods and the open
  // assembly branch of the four-bar linkage.
  const sourceScale = 0.17;
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceDiskCenter = new THREE.Vector2(0, 0);
  const sourceDiskRadius = 10;
  const sourceDiskHubRadius = 1.5;
  const sourceCrankPin = new THREE.Vector2(0, 8);
  const sourceCrankPinRadius = 1;
  const sourceInputConnectingRodLength = 24;
  const sourceBellPivot = new THREE.Vector2(21, 1);
  const sourceBellInputReference = new THREE.Vector2(21, 13);
  const sourceBellInputArm = new THREE.Vector2(0, 12);
  const sourceBellOutputArm = new THREE.Vector2(12, 0);
  const sourceOutputConnectingRodLength = 44;
  const sourceOutputGuideStart = new THREE.Vector2(33, -20.11748);
  const sourceOutputGuideEnd = new THREE.Vector2(33, -49.845681);
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = fullTurn / cyclePeriod;

  const diskCenter = sourceDiskCenter.clone().multiplyScalar(sourceScale);
  const diskRadius = sourceDiskRadius * sourceScale;
  const diskHubRadius = sourceDiskHubRadius * sourceScale;
  const crankPinLocal = sourceCrankPin.clone().multiplyScalar(sourceScale);
  const crankRadius = crankPinLocal.length();
  const crankPinRadius = sourceCrankPinRadius * sourceScale;
  const inputConnectingRodLength = sourceInputConnectingRodLength
    * sourceScale;
  const bellPivot = sourceBellPivot.clone().multiplyScalar(sourceScale);
  const bellInputReference = sourceBellInputReference.clone()
    .multiplyScalar(sourceScale);
  const bellInputArmLength = sourceBellInputArm.length() * sourceScale;
  const bellOutputArmLength = sourceBellOutputArm.length() * sourceScale;
  const outputConnectingRodLength = sourceOutputConnectingRodLength
    * sourceScale;
  const outputGuideX = sourceOutputGuideStart.x * sourceScale;
  const outputGuideTopY = sourceOutputGuideStart.y * sourceScale;
  const outputGuideBottomY = sourceOutputGuideEnd.y * sourceScale;
  const fixedCenterDistance = diskCenter.distanceTo(bellPivot);
  const sourceCrankAngle = Math.atan2(crankPinLocal.y, crankPinLocal.x);

  const diskCenterZ = -0.28;
  const diskDepth = 0.32;
  const diskFrontZ = diskCenterZ + diskDepth / 2;
  const bellCenterZ = 0.24;
  const bellDepth = 0.28;
  const bellFrontZ = bellCenterZ + bellDepth / 2;
  const connectingRodPlaneZ = 0.72;
  const crankPinBackZ = diskCenterZ - diskDepth / 2 - 0.06;
  const crankPinFrontZ = connectingRodPlaneZ + 0.14;
  const crankPinLength = crankPinFrontZ - crankPinBackZ;
  const crankPinCenterZ = (crankPinBackZ + crankPinFrontZ) / 2;
  const bellJointPinLength = connectingRodPlaneZ - bellCenterZ + 0.52;
  const bellJointPinCenterZ = (connectingRodPlaneZ + bellCenterZ) / 2;
  const pivotShaftLength = 1.48;
  const pivotShaftCenterZ = 0.03;
  const frameZ = -0.76;
  const outputGuideHalfGap = 0.31;
  const outputSliderHalfWidth = 0.245;
  const outputSliderHalfHeight = 0.225;
  const outputSliderDepth = 0.30;

  const stateAtDriverKinematics = ({
    driverAngle,
    driverAngularAcceleration = 0,
    driverAngularSpeed = inputAngularSpeed,
  }) => {
    const crankAngle = sourceCrankAngle + driverAngle;
    const crankRadiusVector2 = new THREE.Vector2(
      Math.cos(crankAngle) * crankRadius,
      Math.sin(crankAngle) * crankRadius,
    );
    const crankPoint2 = diskCenter.clone().add(crankRadiusVector2);
    const crankPinVelocity2 = new THREE.Vector2(
      -crankRadiusVector2.y * driverAngularSpeed,
      crankRadiusVector2.x * driverAngularSpeed,
    );
    const crankPinAcceleration2 = new THREE.Vector2(
      -crankRadiusVector2.x * driverAngularSpeed ** 2
        - crankRadiusVector2.y * driverAngularAcceleration,
      -crankRadiusVector2.y * driverAngularSpeed ** 2
        + crankRadiusVector2.x * driverAngularAcceleration,
    );

    const centersVector2 = bellPivot.clone().sub(crankPoint2);
    const centersDistance = centersVector2.length();
    const centersAxis2 = centersVector2.clone()
      .multiplyScalar(1 / centersDistance);
    const centersNormal2 = new THREE.Vector2(
      -centersAxis2.y,
      centersAxis2.x,
    );
    const intersectionAlong = (
      inputConnectingRodLength ** 2
        - bellInputArmLength ** 2
        + centersDistance ** 2
    ) / (2 * centersDistance);
    const intersectionHeight = Math.sqrt(Math.max(
      0,
      inputConnectingRodLength ** 2 - intersectionAlong ** 2,
    ));
    const intersectionBase2 = crankPoint2.clone()
      .addScaledVector(centersAxis2, intersectionAlong);
    const bellInputPoint2 = intersectionBase2.clone()
      .addScaledVector(centersNormal2, intersectionHeight);
    const rejectedBellInputPoint2 = intersectionBase2.clone()
      .addScaledVector(centersNormal2, -intersectionHeight);
    const bellInputRadius2 = bellInputPoint2.clone().sub(bellPivot);
    const inputConnectingRodVector2 = bellInputPoint2.clone()
      .sub(crankPoint2);
    const bellInputPerpendicular2 = new THREE.Vector2(
      -bellInputRadius2.y,
      bellInputRadius2.x,
    );
    const velocityDenominator = inputConnectingRodVector2.dot(
      bellInputPerpendicular2,
    );
    const bellAngularSpeed = inputConnectingRodVector2.dot(
      crankPinVelocity2,
    ) / velocityDenominator;
    const bellInputVelocity2 = bellInputPerpendicular2.clone()
      .multiplyScalar(bellAngularSpeed);
    const inputConnectingRodRelativeVelocity2 = bellInputVelocity2.clone()
      .sub(crankPinVelocity2);
    const bellAngularAcceleration = (
      inputConnectingRodVector2.dot(
        crankPinAcceleration2.clone().addScaledVector(
          bellInputRadius2,
          bellAngularSpeed ** 2,
        ),
      ) - inputConnectingRodRelativeVelocity2.lengthSq()
    ) / velocityDenominator;
    const bellInputAcceleration2 = bellInputPerpendicular2.clone()
      .multiplyScalar(bellAngularAcceleration)
      .addScaledVector(bellInputRadius2, -(bellAngularSpeed ** 2));
    const inputConnectingRodRelativeAcceleration2 = bellInputAcceleration2
      .clone().sub(crankPinAcceleration2);
    const inputConnectingRodAngularSpeed = (
      inputConnectingRodVector2.x
        * inputConnectingRodRelativeVelocity2.y
      - inputConnectingRodVector2.y
        * inputConnectingRodRelativeVelocity2.x
    ) / inputConnectingRodLength ** 2;
    const inputConnectingRodAngularAcceleration = (
      inputConnectingRodVector2.x
        * inputConnectingRodRelativeAcceleration2.y
      - inputConnectingRodVector2.y
        * inputConnectingRodRelativeAcceleration2.x
    ) / inputConnectingRodLength ** 2
      - 2 * inputConnectingRodVector2.dot(
        inputConnectingRodRelativeVelocity2,
      ) * (
        inputConnectingRodVector2.x
          * inputConnectingRodRelativeVelocity2.y
        - inputConnectingRodVector2.y
          * inputConnectingRodRelativeVelocity2.x
      ) / inputConnectingRodLength ** 4;

    const bellAngle = Math.atan2(
      bellInputRadius2.y,
      bellInputRadius2.x,
    ) - Math.PI / 2;
    const bellOutputRadius2 = new THREE.Vector2(
      bellInputRadius2.y,
      -bellInputRadius2.x,
    ).multiplyScalar(bellOutputArmLength / bellInputArmLength);
    const bellOutputPoint2 = bellPivot.clone().add(bellOutputRadius2);
    const bellOutputPerpendicular2 = new THREE.Vector2(
      -bellOutputRadius2.y,
      bellOutputRadius2.x,
    );
    const bellOutputVelocity2 = bellOutputPerpendicular2.clone()
      .multiplyScalar(bellAngularSpeed);
    const bellOutputAcceleration2 = bellOutputPerpendicular2.clone()
      .multiplyScalar(bellAngularAcceleration)
      .addScaledVector(bellOutputRadius2, -(bellAngularSpeed ** 2));

    const horizontalOutputSpan = outputGuideX - bellOutputPoint2.x;
    const verticalOutputSpan = Math.sqrt(Math.max(
      0,
      outputConnectingRodLength ** 2 - horizontalOutputSpan ** 2,
    ));
    const horizontalOutputSpanVelocity = -bellOutputVelocity2.x;
    const horizontalOutputSpanAcceleration = -bellOutputAcceleration2.x;
    const verticalOutputSpanVelocity = -horizontalOutputSpan
      * horizontalOutputSpanVelocity / verticalOutputSpan;
    const verticalOutputSpanAcceleration = -(
      horizontalOutputSpanVelocity ** 2
        + horizontalOutputSpan * horizontalOutputSpanAcceleration
    ) / verticalOutputSpan
      - (horizontalOutputSpan * horizontalOutputSpanVelocity) ** 2
        / verticalOutputSpan ** 3;
    const outputSliderY = bellOutputPoint2.y - verticalOutputSpan;
    const outputSliderVelocityY = bellOutputVelocity2.y
      - verticalOutputSpanVelocity;
    const outputSliderAccelerationY = bellOutputAcceleration2.y
      - verticalOutputSpanAcceleration;

    const crankPoint = new THREE.Vector3(
      crankPoint2.x,
      crankPoint2.y,
      connectingRodPlaneZ,
    );
    const bellInputPoint = new THREE.Vector3(
      bellInputPoint2.x,
      bellInputPoint2.y,
      connectingRodPlaneZ,
    );
    const bellOutputPoint = new THREE.Vector3(
      bellOutputPoint2.x,
      bellOutputPoint2.y,
      connectingRodPlaneZ,
    );
    const outputSliderPoint = new THREE.Vector3(
      outputGuideX,
      outputSliderY,
      connectingRodPlaneZ,
    );
    const crankPinVelocity = new THREE.Vector3(
      crankPinVelocity2.x,
      crankPinVelocity2.y,
      0,
    );
    const crankPinAcceleration = new THREE.Vector3(
      crankPinAcceleration2.x,
      crankPinAcceleration2.y,
      0,
    );
    const bellInputVelocity = new THREE.Vector3(
      bellInputVelocity2.x,
      bellInputVelocity2.y,
      0,
    );
    const bellInputAcceleration = new THREE.Vector3(
      bellInputAcceleration2.x,
      bellInputAcceleration2.y,
      0,
    );
    const bellOutputVelocity = new THREE.Vector3(
      bellOutputVelocity2.x,
      bellOutputVelocity2.y,
      0,
    );
    const bellOutputAcceleration = new THREE.Vector3(
      bellOutputAcceleration2.x,
      bellOutputAcceleration2.y,
      0,
    );
    const outputSliderVelocity = new THREE.Vector3(
      0,
      outputSliderVelocityY,
      0,
    );
    const outputSliderAcceleration = new THREE.Vector3(
      0,
      outputSliderAccelerationY,
      0,
    );
    const outputConnectingRodVector = outputSliderPoint.clone()
      .sub(bellOutputPoint);
    const outputConnectingRodRelativeVelocity = outputSliderVelocity.clone()
      .sub(bellOutputVelocity);
    const outputConnectingRodRelativeAcceleration = outputSliderAcceleration
      .clone().sub(bellOutputAcceleration);
    const outputConnectingRodAngularSpeed = (
      outputConnectingRodVector.x
        * outputConnectingRodRelativeVelocity.y
      - outputConnectingRodVector.y
        * outputConnectingRodRelativeVelocity.x
    ) / outputConnectingRodLength ** 2;
    const outputConnectingRodAngularAcceleration = (
      outputConnectingRodVector.x
        * outputConnectingRodRelativeAcceleration.y
      - outputConnectingRodVector.y
        * outputConnectingRodRelativeAcceleration.x
    ) / outputConnectingRodLength ** 2
      - 2 * outputConnectingRodVector.dot(
        outputConnectingRodRelativeVelocity,
      ) * (
        outputConnectingRodVector.x
          * outputConnectingRodRelativeVelocity.y
        - outputConnectingRodVector.y
          * outputConnectingRodRelativeVelocity.x
      ) / outputConnectingRodLength ** 4;
    const inputConnectingRodVector = new THREE.Vector3(
      inputConnectingRodVector2.x,
      inputConnectingRodVector2.y,
      0,
    );
    const inputConnectingRodRelativeVelocity = new THREE.Vector3(
      inputConnectingRodRelativeVelocity2.x,
      inputConnectingRodRelativeVelocity2.y,
      0,
    );
    const inputConnectingRodRelativeAcceleration = new THREE.Vector3(
      inputConnectingRodRelativeAcceleration2.x,
      inputConnectingRodRelativeAcceleration2.y,
      0,
    );
    return {
      assemblyOrientation: centersVector2.x
          * inputConnectingRodVector2.y
        - centersVector2.y * inputConnectingRodVector2.x,
      bellAngle,
      bellAngularAcceleration,
      bellAngularSpeed,
      bellArmPerpendicularityError: bellInputRadius2.dot(
        bellOutputRadius2,
      ),
      bellInputAcceleration,
      bellInputAccelerationConstraintError:
        bellInputRadius2.dot(bellInputAcceleration2)
          + bellInputVelocity2.lengthSq(),
      bellInputArmLengthError: bellInputRadius2.length()
        - bellInputArmLength,
      bellInputPoint,
      bellInputVelocity,
      bellInputVelocityConstraintError: bellInputRadius2.dot(
        bellInputVelocity2,
      ),
      bellOutputAcceleration,
      bellOutputArmLengthError: bellOutputRadius2.length()
        - bellOutputArmLength,
      bellOutputPoint,
      bellOutputVelocity,
      branchReferenceMargin: rejectedBellInputPoint2.distanceTo(
        bellInputReference,
      ) - bellInputPoint2.distanceTo(bellInputReference),
      centersDistance,
      crankAngle,
      crankPinAcceleration,
      crankPinVelocity,
      crankPoint,
      crankPinOrbitError: crankRadiusVector2.length() - crankRadius,
      driverAngle,
      driverAngularAcceleration,
      driverAngularSpeed,
      inputConnectingRodAccelerationConstraintError:
        inputConnectingRodVector2.dot(
          inputConnectingRodRelativeAcceleration2,
        ) + inputConnectingRodRelativeVelocity2.lengthSq(),
      inputConnectingRodAngle: Math.atan2(
        inputConnectingRodVector2.y,
        inputConnectingRodVector2.x,
      ),
      inputConnectingRodAngularAcceleration,
      inputConnectingRodAngularSpeed,
      inputConnectingRodLengthError: inputConnectingRodVector2.length()
        - inputConnectingRodLength,
      inputConnectingRodRelativeAcceleration,
      inputConnectingRodRelativeVelocity,
      inputConnectingRodVector,
      inputConnectingRodVelocityConstraintError:
        inputConnectingRodVector2.dot(
          inputConnectingRodRelativeVelocity2,
        ),
      inputRevolutions: driverAngle / fullTurn,
      intersectionHeight,
      innerClosureMargin: centersDistance
        - Math.abs(inputConnectingRodLength - bellInputArmLength),
      outerClosureMargin: inputConnectingRodLength + bellInputArmLength
        - centersDistance,
      outputConnectingRodAccelerationConstraintError:
        outputConnectingRodVector.dot(
          outputConnectingRodRelativeAcceleration,
        ) + outputConnectingRodRelativeVelocity.lengthSq(),
      outputConnectingRodAngle: Math.atan2(
        outputConnectingRodVector.y,
        outputConnectingRodVector.x,
      ),
      outputConnectingRodAngularAcceleration,
      outputConnectingRodAngularSpeed,
      outputConnectingRodLengthError: outputConnectingRodVector.length()
        - outputConnectingRodLength,
      outputConnectingRodRelativeAcceleration,
      outputConnectingRodRelativeVelocity,
      outputConnectingRodVector,
      outputConnectingRodVelocityConstraintError:
        outputConnectingRodVector.dot(
          outputConnectingRodRelativeVelocity,
        ),
      outputGuideAccelerationError: outputSliderAcceleration.x,
      outputGuidePositionError: outputSliderPoint.x - outputGuideX,
      outputGuideVelocityError: outputSliderVelocity.x,
      outputSliderAcceleration,
      outputSliderPoint,
      outputSliderVelocity,
      rejectedBellInputPoint: new THREE.Vector3(
        rejectedBellInputPoint2.x,
        rejectedBellInputPoint2.y,
        connectingRodPlaneZ,
      ),
      verticalOutputSpan,
      verticalOutputSpanAcceleration,
      verticalOutputSpanVelocity,
      velocityDenominator,
    };
  };
  const stateAtDriverAngle = (driverAngle) => stateAtDriverKinematics({
    driverAngle,
  });
  const stateAtCyclePhase = (phase) => stateAtDriverAngle(fullTurn * phase);
  const stateAtTime = (time) => stateAtDriverAngle(inputAngularSpeed * time);

  const extrema = [];
  const extremaSamples = 4096;
  let previousPhase = 0;
  let previousVelocity = stateAtCyclePhase(previousPhase)
    .outputSliderVelocity.y;
  for (let sample = 1; sample <= extremaSamples; sample += 1) {
    const phase = sample / extremaSamples;
    const velocity = stateAtCyclePhase(phase).outputSliderVelocity.y;
    if (previousVelocity * velocity < 0) {
      let lower = previousPhase;
      let upper = phase;
      let lowerVelocity = previousVelocity;
      for (let iteration = 0; iteration < 64; iteration += 1) {
        const middle = (lower + upper) / 2;
        const middleVelocity = stateAtCyclePhase(middle)
          .outputSliderVelocity.y;
        if (lowerVelocity * middleVelocity <= 0) {
          upper = middle;
        } else {
          lower = middle;
          lowerVelocity = middleVelocity;
        }
      }
      const extremumPhase = (lower + upper) / 2;
      const state = stateAtCyclePhase(extremumPhase);
      extrema.push({
        phase: extremumPhase,
        sliderY: state.outputSliderPoint.y,
        type: state.outputSliderAcceleration.y > 0
          ? 'lower-turning-point'
          : 'upper-turning-point',
      });
    }
    previousPhase = phase;
    previousVelocity = velocity;
  }
  extrema.sort((left, right) => left.phase - right.phase);
  const lowerExtremum = extrema.find(({ type }) => (
    type === 'lower-turning-point'
  ));
  const upperExtremum = extrema.find(({ type }) => (
    type === 'upper-turning-point'
  ));
  const outputStroke = upperExtremum.sliderY - lowerExtremum.sliderY;
  const shortStrokeFraction = THREE.MathUtils.euclideanModulo(
    lowerExtremum.phase - upperExtremum.phase,
    1,
  );
  const longStrokeFraction = 1 - shortStrokeFraction;
  const canonicalStates = {
    lower: stateAtCyclePhase(lowerExtremum.phase),
    source: stateAtCyclePhase(0),
    upper: stateAtCyclePhase(upperExtremum.phase),
  };
  const canonicalTimes = {
    lower: lowerExtremum.phase * cyclePeriod,
    nextSource: cyclePeriod,
    source: 0,
    upper: upperExtremum.phase * cyclePeriod,
  };

  const outputGuideRailTopY = Math.max(
    outputGuideTopY,
    upperExtremum.sliderY + outputSliderHalfHeight + 0.18,
  );
  const outputGuideRailBottomY = Math.min(
    outputGuideBottomY,
    lowerExtremum.sliderY - outputSliderHalfHeight - 0.18,
  );
  const baseY = outputGuideRailBottomY - 0.34;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.63,
  });
  const connectingRodMaterial = matte(PALETTE.brass, {
    metalness: 0.14,
    roughness: 0.57,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.68,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const input = new THREE.Group();
  input.position.set(diskCenter.x, diskCenter.y, 0);
  input.userData.axis = Z_AXIS.clone();
  input.userData.role = 'uniformly-counterclockwise-rotating-input-disk';
  const inputRotor = new THREE.Group();
  input.add(inputRotor);
  const driverDisk = cylinderAlongZ(
    diskRadius,
    diskDepth,
    driverMaterial,
    80,
  );
  driverDisk.position.z = diskCenterZ;
  driverDisk.userData.role = 'source-ten-unit-radius-driver-disk';
  inputRotor.add(driverDisk);
  const driverRim = new THREE.Mesh(
    new THREE.TorusGeometry(diskRadius, 0.048, 9, 80),
    darkMaterial,
  );
  driverRim.position.z = diskFrontZ + 0.026;
  driverRim.userData.role = 'dark-outline-of-driver-disk';
  inputRotor.add(driverRim);
  const driverHub = cylinderAlongZ(
    diskHubRadius,
    diskDepth * 1.55,
    darkMaterial,
    42,
  );
  driverHub.position.z = diskCenterZ;
  driverHub.userData.role = 'driver-disk-hub';
  inputRotor.add(driverHub);
  const driverIndex = makeBeam(
    new THREE.Vector3(0, diskHubRadius * 1.25, diskFrontZ + 0.06),
    new THREE.Vector3(0, diskRadius * 0.70, diskFrontZ + 0.06),
    { color: PALETTE.white, depth: 0.03, thickness: 0.065 },
  );
  driverIndex.userData.role = 'white-index-on-uniform-input-disk';
  inputRotor.add(driverIndex);
  const driverShaft = cylinderAlongZ(
    diskHubRadius * 0.58,
    1.48,
    darkMaterial,
    36,
  );
  driverShaft.position.z = -0.34;
  driverShaft.userData.role = 'uniformly-rotating-input-shaft';
  inputRotor.add(driverShaft);

  const crankPin = new THREE.Group();
  crankPin.position.set(
    crankPinLocal.x,
    crankPinLocal.y,
    crankPinCenterZ,
  );
  crankPin.userData.axis = Z_AXIS.clone();
  crankPin.userData.role = 'disk-fixed-wrist-pin-of-input-connecting-rod';
  const crankPinBody = cylinderAlongZ(
    crankPinRadius,
    crankPinLength,
    connectingRodMaterial,
    38,
  );
  crankPinBody.userData.role = 'wrist-pin-bridging-disk-and-front-rod-plane';
  crankPin.add(crankPinBody);
  const crankPinRim = new THREE.Mesh(
    new THREE.TorusGeometry(crankPinRadius, 0.031, 9, 38),
    darkMaterial,
  );
  crankPinRim.position.z = crankPinLength / 2 + 0.012;
  crankPinRim.userData.role = 'front-rim-of-disk-wrist-pin';
  crankPin.add(crankPinRim);
  const crankPinFace = new THREE.Mesh(
    new THREE.CircleGeometry(crankPinRadius * 0.62, 32),
    indexMaterial,
  );
  crankPinFace.position.z = crankPinLength / 2 + 0.034;
  crankPinFace.userData.role = 'white-face-of-input-wrist-pin';
  crankPin.add(crankPinFace);
  inputRotor.add(crankPin);

  const bellCrank = new THREE.Group();
  bellCrank.position.set(bellPivot.x, bellPivot.y, 0);
  bellCrank.userData.axis = Z_AXIS.clone();
  bellCrank.userData.role = 'fixed-pivot-rigid-right-angle-bell-crank';
  const bellArmThickness = 0.34;
  const bellInputArm = makeBeam(
    new THREE.Vector3(0, 0.22, bellCenterZ),
    new THREE.Vector3(0, bellInputArmLength, bellCenterZ),
    {
      color: PALETTE.driven,
      depth: bellDepth,
      thickness: bellArmThickness,
    },
  );
  bellInputArm.userData.role = 'finite-input-arm-of-bell-crank';
  bellCrank.add(bellInputArm);
  const bellOutputArm = makeBeam(
    new THREE.Vector3(0.22, 0, bellCenterZ),
    new THREE.Vector3(bellOutputArmLength, 0, bellCenterZ),
    {
      color: PALETTE.driven,
      depth: bellDepth,
      thickness: bellArmThickness,
    },
  );
  bellOutputArm.userData.role = 'perpendicular-output-arm-of-bell-crank';
  bellCrank.add(bellOutputArm);
  const bellPivotHub = cylinderAlongZ(
    0.30,
    0.56,
    drivenMaterial,
    52,
  );
  bellPivotHub.position.z = bellCenterZ;
  bellPivotHub.userData.role = 'central-hub-rigid-with-bell-crank';
  bellCrank.add(bellPivotHub);
  const bellPivotRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.215, 0.055, 10, 48),
    darkMaterial,
  );
  bellPivotRing.position.z = bellCenterZ + 0.31;
  bellPivotRing.userData.role = 'front-ring-of-fixed-bell-crank-pivot';
  bellCrank.add(bellPivotRing);
  const bellInputHub = cylinderAlongZ(
    0.22,
    0.48,
    drivenMaterial,
    40,
  );
  bellInputHub.position.set(0, bellInputArmLength, bellCenterZ + 0.08);
  bellInputHub.userData.role = 'bell-input-joint-hub';
  bellCrank.add(bellInputHub);
  const bellOutputHub = cylinderAlongZ(
    0.22,
    0.48,
    drivenMaterial,
    40,
  );
  bellOutputHub.position.set(bellOutputArmLength, 0, bellCenterZ + 0.08);
  bellOutputHub.userData.role = 'bell-output-joint-hub';
  bellCrank.add(bellOutputHub);
  const bellInputPin = cylinderAlongZ(
    0.105,
    bellJointPinLength,
    darkMaterial,
    30,
  );
  bellInputPin.position.set(
    0,
    bellInputArmLength,
    bellJointPinCenterZ,
  );
  bellInputPin.userData.role = 'pin-joining-input-rod-to-bell-crank';
  bellCrank.add(bellInputPin);
  const bellOutputPin = cylinderAlongZ(
    0.105,
    bellJointPinLength,
    darkMaterial,
    30,
  );
  bellOutputPin.position.set(
    bellOutputArmLength,
    0,
    bellJointPinCenterZ,
  );
  bellOutputPin.userData.role = 'pin-joining-output-rod-to-bell-crank';
  bellCrank.add(bellOutputPin);
  const bellIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, bellInputArmLength * 0.42, 0.034),
    indexMaterial,
  );
  bellIndex.position.set(
    0,
    bellInputArmLength * 0.64,
    bellFrontZ + 0.052,
  );
  bellIndex.userData.role = 'white-index-on-oscillating-bell-crank';
  bellCrank.add(bellIndex);

  const pivotShaft = cylinderAlongZ(
    0.15,
    pivotShaftLength,
    darkMaterial,
    36,
  );
  pivotShaft.position.set(
    bellPivot.x,
    bellPivot.y,
    pivotShaftCenterZ,
  );
  pivotShaft.userData.role = 'fixed-shaft-through-bell-crank-pivot';

  const inputConnectingRod = makeDynamicLink({
    color: PALETTE.brass,
    depth: 0.20,
    jointRadius: 0.205,
    thickness: 0.17,
  });
  inputConnectingRod.userData.role =
    'finite-connecting-rod-substituted-for-movement-156-slot';
  inputConnectingRod.userData.setEndpoints(
    canonicalStates.source.crankPoint,
    canonicalStates.source.bellInputPoint,
  );
  const outputConnectingRod = makeDynamicLink({
    color: PALETTE.brass,
    depth: 0.20,
    jointRadius: 0.205,
    thickness: 0.17,
  });
  outputConnectingRod.userData.role =
    'finite-link-from-bell-crank-to-guided-output';
  outputConnectingRod.userData.setEndpoints(
    canonicalStates.source.bellOutputPoint,
    canonicalStates.source.outputSliderPoint,
  );

  const outputSlider = new THREE.Group();
  outputSlider.position.copy(canonicalStates.source.outputSliderPoint);
  outputSlider.userData.role = 'strictly-vertical-guided-output-slider';
  const outputSliderShoe = new THREE.Mesh(
    new THREE.BoxGeometry(
      outputSliderHalfWidth * 2,
      outputSliderHalfHeight * 2,
      outputSliderDepth,
    ),
    connectingRodMaterial,
  );
  outputSliderShoe.position.z = -0.08;
  outputSliderShoe.userData.role = 'output-crosshead-between-fixed-guides';
  outputSlider.add(outputSliderShoe);
  const outputSliderPin = cylinderAlongZ(0.112, 0.62, darkMaterial, 30);
  outputSliderPin.userData.role = 'output-rod-to-slider-pin';
  outputSlider.add(outputSliderPin);
  const outputMotionIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.065, 0.038),
    indexMaterial,
  );
  outputMotionIndex.position.set(0, 0, outputSliderDepth / 2 + 0.035);
  outputMotionIndex.userData.role = 'white-index-on-vertical-output-slider';
  outputSlider.add(outputMotionIndex);

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-disk-bell-pivot-and-output-guide-frame';
  const frameLeftX = -2.15;
  const frameRightX = outputGuideX + 0.78;
  const baseRail = makeBeam(
    new THREE.Vector3(frameLeftX, baseY, frameZ),
    new THREE.Vector3(frameRightX, baseY, frameZ),
    { color: PALETTE.frame, depth: 0.25, thickness: 0.18 },
  );
  baseRail.userData.role = 'fixed-base-under-complete-output-stroke';
  const driverPost = makeBeam(
    new THREE.Vector3(-2.02, baseY, frameZ),
    new THREE.Vector3(-2.02, diskCenter.y, frameZ),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.16 },
  );
  driverPost.userData.role = 'rear-post-supporting-input-disk-axis';
  const driverBearingBridge = makeBeam(
    new THREE.Vector3(-2.02, diskCenter.y, frameZ),
    new THREE.Vector3(diskCenter.x, diskCenter.y, frameZ),
    { color: PALETTE.frame, depth: 0.20, thickness: 0.14 },
  );
  driverBearingBridge.userData.role = 'fixed-input-bearing-crossbar';
  const pivotPost = makeBeam(
    new THREE.Vector3(bellPivot.x, baseY, frameZ),
    new THREE.Vector3(bellPivot.x, bellPivot.y, frameZ),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.16 },
  );
  pivotPost.userData.role = 'rear-post-supporting-bell-crank-pivot';
  const driverBearing = new THREE.Mesh(
    new THREE.TorusGeometry(diskHubRadius * 1.10, 0.065, 10, 44),
    frameMaterial,
  );
  driverBearing.position.set(diskCenter.x, diskCenter.y, frameZ + 0.035);
  driverBearing.userData.role = 'fixed-rear-input-shaft-bearing';
  const pivotBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.255, 0.065, 10, 44),
    frameMaterial,
  );
  pivotBearing.position.set(bellPivot.x, bellPivot.y, frameZ + 0.035);
  pivotBearing.userData.role = 'fixed-rear-bell-crank-bearing';
  const outputGuideRails = [-1, 1].map((sideSign) => {
    const rail = makeBeam(
      new THREE.Vector3(
        outputGuideX + sideSign * outputGuideHalfGap,
        outputGuideRailBottomY,
        frameZ + 0.10,
      ),
      new THREE.Vector3(
        outputGuideX + sideSign * outputGuideHalfGap,
        outputGuideRailTopY,
        frameZ + 0.10,
      ),
      { color: PALETTE.frame, depth: 0.17, thickness: 0.12 },
    );
    rail.userData.role = 'fixed-rail-constraining-output-slider';
    rail.userData.side = sideSign < 0 ? 'left' : 'right';
    return rail;
  });
  const outputGuideCrossbars = [
    outputGuideRailTopY,
    outputGuideRailBottomY,
  ].map((guideY, index) => {
    const crossbar = makeBeam(
      new THREE.Vector3(
        outputGuideX - outputGuideHalfGap,
        guideY,
        frameZ + 0.10,
      ),
      new THREE.Vector3(
        outputGuideX + outputGuideHalfGap,
        guideY,
        frameZ + 0.10,
      ),
      { color: PALETTE.frame, depth: 0.17, thickness: 0.12 },
    );
    crossbar.userData.index = index;
    crossbar.userData.role = 'fixed-output-guide-end-crossbar';
    return crossbar;
  });
  fixedFrame.add(
    baseRail,
    driverPost,
    driverBearingBridge,
    pivotPost,
    driverBearing,
    pivotBearing,
    ...outputGuideRails,
    ...outputGuideCrossbars,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(9.0, 13.2, 2.30),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(2.05, -3.70, 0.04);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-complete-four-bar-and-stroke-envelope';

  root.add(
    cameraEnvelope,
    fixedFrame,
    pivotShaft,
    input,
    bellCrank,
    inputConnectingRod,
    outputConnectingRod,
    outputSlider,
  );

  root.userData.mechanism =
    'rotary-disk-connecting-rod-bell-crank-guided-variable-reciprocator';
  root.userData.cameraDistanceScale = 1.02;
  root.userData.blocks = {
    baseRail,
    bellCrank,
    bellIndex,
    bellInputArm,
    bellInputHub,
    bellInputPin,
    bellOutputArm,
    bellOutputHub,
    bellOutputPin,
    bellPivotHub,
    bellPivotRing,
    cameraEnvelope,
    crankPin,
    crankPinBody,
    crankPinFace,
    crankPinRim,
    driverBearing,
    driverBearingBridge,
    driverDisk,
    driverHub,
    driverIndex,
    driverPost,
    driverRim,
    driverShaft,
    fixedFrame,
    input,
    inputConnectingRod,
    inputRotor,
    outputConnectingRod,
    outputGuideCrossbars,
    outputGuideRails,
    outputMotionIndex,
    outputSlider,
    outputSliderPin,
    outputSliderShoe,
    pivotBearing,
    pivotPost,
    pivotShaft,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    baseY,
    bellCenterZ,
    bellDepth,
    bellFrontZ,
    bellInputArmLength,
    bellInputReference: bellInputReference.clone(),
    bellJointPinCenterZ,
    bellJointPinLength,
    bellOutputArmLength,
    bellPivot: bellPivot.clone(),
    connectingRodPlaneZ,
    crankPinBackZ,
    crankPinCenterZ,
    crankPinFrontZ,
    crankPinLength,
    crankPinLocal: crankPinLocal.clone(),
    crankPinRadius,
    crankRadius,
    cyclePeriod,
    diskCenter: diskCenter.clone(),
    diskCenterZ,
    diskDepth,
    diskFrontZ,
    diskHubRadius,
    diskRadius,
    fixedCenterDistance,
    frameLeftX,
    frameRightX,
    frameZ,
    fullTurn,
    inputAngularSpeed,
    inputConnectingRodLength,
    longStrokeFraction,
    outputConnectingRodLength,
    outputGuideBottomY,
    outputGuideHalfGap,
    outputGuideRailBottomY,
    outputGuideRailTopY,
    outputGuideTopY,
    outputGuideX,
    outputSliderDepth,
    outputSliderHalfHeight,
    outputSliderHalfWidth,
    outputStroke,
    pivotShaftCenterZ,
    pivotShaftLength,
    shortStrokeFraction,
    sourceBellInputArm: sourceBellInputArm.clone(),
    sourceBellInputReference: sourceBellInputReference.clone(),
    sourceBellOutputArm: sourceBellOutputArm.clone(),
    sourceBellPivot: sourceBellPivot.clone(),
    sourceCrankAngle,
    sourceCrankPin: sourceCrankPin.clone(),
    sourceCrankPinRadius,
    sourceCyclesPerMinute,
    sourceDiskCenter: sourceDiskCenter.clone(),
    sourceDiskHubRadius,
    sourceDiskRadius,
    sourceImageHeight,
    sourceImageWidth,
    sourceInputConnectingRodLength,
    sourceOutputConnectingRodLength,
    sourceOutputGuideEnd: sourceOutputGuideEnd.clone(),
    sourceOutputGuideStart: sourceOutputGuideStart.clone(),
    sourceScale,
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtDriverKinematics = stateAtDriverKinematics;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.driverAngle;
    input.userData.angularSpeed = state.driverAngularSpeed;
    driverShaft.userData.angularSpeed = state.driverAngularSpeed;
    crankPin.userData.angularSpeed = state.driverAngularSpeed;
    bellCrank.rotation.z = state.bellAngle;
    bellCrank.userData.angularSpeed = state.bellAngularSpeed;
    bellCrank.userData.angularAcceleration = state.bellAngularAcceleration;
    inputConnectingRod.userData.setEndpoints(
      state.crankPoint,
      state.bellInputPoint,
    );
    inputConnectingRod.userData.angularSpeed =
      state.inputConnectingRodAngularSpeed;
    inputConnectingRod.userData.angularAcceleration =
      state.inputConnectingRodAngularAcceleration;
    outputConnectingRod.userData.setEndpoints(
      state.bellOutputPoint,
      state.outputSliderPoint,
    );
    outputConnectingRod.userData.angularSpeed =
      state.outputConnectingRodAngularSpeed;
    outputConnectingRod.userData.angularAcceleration =
      state.outputConnectingRodAngularAcceleration;
    outputSlider.position.copy(state.outputSliderPoint);
    outputSlider.userData.velocity = state.outputSliderVelocity.clone();
    outputSlider.userData.acceleration = state.outputSliderAcceleration.clone();
    root.userData.contacts = {
      bellCrankPivot: {
        axis: Z_AXIS.clone(),
        centerError: Math.hypot(
          bellCrank.position.x - bellPivot.x,
          bellCrank.position.y - bellPivot.y,
        ),
      },
      bellInputJoint: {
        accelerationConstraintError:
          state.bellInputAccelerationConstraintError,
        armLengthError: state.bellInputArmLengthError,
        position: state.bellInputPoint.clone(),
        velocityConstraintError: state.bellInputVelocityConstraintError,
      },
      bellOutputJoint: {
        armLengthError: state.bellOutputArmLengthError,
        perpendicularityError: state.bellArmPerpendicularityError,
        position: state.bellOutputPoint.clone(),
      },
      driverWrist: {
        orbitError: state.crankPinOrbitError,
        pinFixedToDisk: true,
        position: state.crankPoint.clone(),
      },
      inputConnectingRod: {
        accelerationConstraintError:
          state.inputConnectingRodAccelerationConstraintError,
        angularSpeed: state.inputConnectingRodAngularSpeed,
        endPoint: state.bellInputPoint.clone(),
        length: inputConnectingRodLength,
        lengthError: state.inputConnectingRodLengthError,
        startPoint: state.crankPoint.clone(),
        velocityConstraintError:
          state.inputConnectingRodVelocityConstraintError,
      },
      outputConnectingRod: {
        accelerationConstraintError:
          state.outputConnectingRodAccelerationConstraintError,
        angularSpeed: state.outputConnectingRodAngularSpeed,
        endPoint: state.outputSliderPoint.clone(),
        length: outputConnectingRodLength,
        lengthError: state.outputConnectingRodLengthError,
        startPoint: state.bellOutputPoint.clone(),
        velocityConstraintError:
          state.outputConnectingRodVelocityConstraintError,
      },
      outputSliderGuides: {
        accelerationError: state.outputGuideAccelerationError,
        axis: Y_AXIS.clone(),
        positionError: state.outputGuidePositionError,
        rotationError: 0,
        velocityError: state.outputGuideVelocityError,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  const model = finish(root, update, new THREE.Vector3(6.5, 4.4, 14.0));
  for (const object of [
    bellIndex,
    cameraEnvelope,
    crankPinFace,
    driverIndex,
    outputMotionIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return model;
}

function treadleDrivenContinuousDiskMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Exact dimensions and open assembly branch exposed by the official
  // Movement 158 animation. The disk is used as the uniform phase coordinate;
  // the same pin-jointed crank-rocker transmits power reversibly from treadle
  // to disk as described by Brown.
  const sourceScale = 0.18;
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceDiskCenter = new THREE.Vector2(0, 0);
  const sourceDiskRadius = 10;
  const sourceDiskHubRadius = 1.5;
  const sourceCrankPin = new THREE.Vector2(6, 0);
  const sourceCrankPinRadius = 0.5;
  const sourceConnectingRodLength = 13;
  const sourceTreadlePivot = new THREE.Vector2(12, -17);
  const sourceTreadlePinReference = new THREE.Vector2(-9, -17);
  const sourceTreadlePinLocal = new THREE.Vector2(-21, 0);
  const sourceTreadleFootLocal = new THREE.Vector2(-28, 0);
  const sourceTreadleHalfThickness = 0.5;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const diskAngularSpeed = fullTurn / cyclePeriod;

  const diskCenter = sourceDiskCenter.clone().multiplyScalar(sourceScale);
  const diskRadius = sourceDiskRadius * sourceScale;
  const diskHubRadius = sourceDiskHubRadius * sourceScale;
  const crankPinLocal = sourceCrankPin.clone().multiplyScalar(sourceScale);
  const crankRadius = crankPinLocal.length();
  const crankPinRadius = sourceCrankPinRadius * sourceScale;
  const connectingRodLength = sourceConnectingRodLength * sourceScale;
  const treadlePivot = sourceTreadlePivot.clone().multiplyScalar(sourceScale);
  const treadlePinReference = sourceTreadlePinReference.clone()
    .multiplyScalar(sourceScale);
  const treadlePinRadius = sourceTreadlePinLocal.length() * sourceScale;
  const treadleFootRadius = sourceTreadleFootLocal.length() * sourceScale;
  const treadleThickness = sourceTreadleHalfThickness * sourceScale * 2;
  const fixedCenterDistance = diskCenter.distanceTo(treadlePivot);
  const sourceCrankAngle = Math.atan2(crankPinLocal.y, crankPinLocal.x);

  const diskCenterZ = -0.20;
  const diskDepth = 0.34;
  const diskFrontZ = diskCenterZ + diskDepth / 2;
  const treadleCenterZ = 0.26;
  const treadleDepth = 0.24;
  const treadleFrontZ = treadleCenterZ + treadleDepth / 2;
  const connectingRodPlaneZ = 0.68;
  const crankPinBackZ = diskCenterZ - diskDepth / 2 - 0.06;
  const crankPinFrontZ = connectingRodPlaneZ + 0.14;
  const crankPinLength = crankPinFrontZ - crankPinBackZ;
  const crankPinCenterZ = (crankPinBackZ + crankPinFrontZ) / 2;
  const treadleJointPinLength = connectingRodPlaneZ - treadleCenterZ + 0.50;
  const treadleJointPinCenterZ = (connectingRodPlaneZ + treadleCenterZ) / 2;
  const treadlePivotShaftLength = 1.44;
  const treadlePivotShaftCenterZ = 0.03;
  const frameZ = -0.72;

  const stateAtDiskKinematics = ({
    diskAngle,
    diskAngularAcceleration = 0,
    diskAngularVelocity = diskAngularSpeed,
  }) => {
    const crankAngle = sourceCrankAngle + diskAngle;
    const crankRadiusVector2 = new THREE.Vector2(
      Math.cos(crankAngle) * crankRadius,
      Math.sin(crankAngle) * crankRadius,
    );
    const crankPoint2 = diskCenter.clone().add(crankRadiusVector2);
    const crankPointVelocity2 = new THREE.Vector2(
      -crankRadiusVector2.y * diskAngularVelocity,
      crankRadiusVector2.x * diskAngularVelocity,
    );
    const crankPointAcceleration2 = new THREE.Vector2(
      -crankRadiusVector2.x * diskAngularVelocity ** 2
        - crankRadiusVector2.y * diskAngularAcceleration,
      -crankRadiusVector2.y * diskAngularVelocity ** 2
        + crankRadiusVector2.x * diskAngularAcceleration,
    );

    const centersVector2 = treadlePivot.clone().sub(crankPoint2);
    const centersDistance = centersVector2.length();
    const centersAxis2 = centersVector2.clone()
      .multiplyScalar(1 / centersDistance);
    const centersNormal2 = new THREE.Vector2(
      -centersAxis2.y,
      centersAxis2.x,
    );
    const intersectionAlong = (
      connectingRodLength ** 2
        - treadlePinRadius ** 2
        + centersDistance ** 2
    ) / (2 * centersDistance);
    const intersectionHeight = Math.sqrt(Math.max(
      0,
      connectingRodLength ** 2 - intersectionAlong ** 2,
    ));
    const intersectionBase2 = crankPoint2.clone()
      .addScaledVector(centersAxis2, intersectionAlong);
    const treadlePinPoint2 = intersectionBase2.clone()
      .addScaledVector(centersNormal2, -intersectionHeight);
    const rejectedTreadlePinPoint2 = intersectionBase2.clone()
      .addScaledVector(centersNormal2, intersectionHeight);
    const treadlePinRadiusVector2 = treadlePinPoint2.clone()
      .sub(treadlePivot);
    const connectingRodVector2 = treadlePinPoint2.clone()
      .sub(crankPoint2);
    const treadlePinPerpendicular2 = new THREE.Vector2(
      -treadlePinRadiusVector2.y,
      treadlePinRadiusVector2.x,
    );
    const velocityDenominator = connectingRodVector2.dot(
      treadlePinPerpendicular2,
    );
    const treadleAngularSpeed = connectingRodVector2.dot(
      crankPointVelocity2,
    ) / velocityDenominator;
    const treadlePinVelocity2 = treadlePinPerpendicular2.clone()
      .multiplyScalar(treadleAngularSpeed);
    const connectingRodRelativeVelocity2 = treadlePinVelocity2.clone()
      .sub(crankPointVelocity2);
    const treadleAngularAcceleration = (
      connectingRodVector2.dot(
        crankPointAcceleration2.clone().addScaledVector(
          treadlePinRadiusVector2,
          treadleAngularSpeed ** 2,
        ),
      ) - connectingRodRelativeVelocity2.lengthSq()
    ) / velocityDenominator;
    const treadlePinAcceleration2 = treadlePinPerpendicular2.clone()
      .multiplyScalar(treadleAngularAcceleration)
      .addScaledVector(
        treadlePinRadiusVector2,
        -(treadleAngularSpeed ** 2),
      );
    const connectingRodRelativeAcceleration2 = treadlePinAcceleration2
      .clone().sub(crankPointAcceleration2);
    const connectingRodAngularSpeed = (
      connectingRodVector2.x * connectingRodRelativeVelocity2.y
        - connectingRodVector2.y * connectingRodRelativeVelocity2.x
    ) / connectingRodLength ** 2;
    const connectingRodAngularAcceleration = (
      connectingRodVector2.x * connectingRodRelativeAcceleration2.y
        - connectingRodVector2.y * connectingRodRelativeAcceleration2.x
    ) / connectingRodLength ** 2
      - 2 * connectingRodVector2.dot(connectingRodRelativeVelocity2)
        * (
          connectingRodVector2.x * connectingRodRelativeVelocity2.y
            - connectingRodVector2.y * connectingRodRelativeVelocity2.x
        ) / connectingRodLength ** 4;

    const treadleAngle = Math.atan2(
      treadlePinRadiusVector2.y,
      treadlePinRadiusVector2.x,
    ) - Math.PI;
    const treadleFootRadiusVector2 = treadlePinRadiusVector2.clone()
      .multiplyScalar(treadleFootRadius / treadlePinRadius);
    const treadleFootPoint2 = treadlePivot.clone()
      .add(treadleFootRadiusVector2);
    const treadleFootVelocity2 = new THREE.Vector2(
      -treadleFootRadiusVector2.y * treadleAngularSpeed,
      treadleFootRadiusVector2.x * treadleAngularSpeed,
    );
    const treadleFootAcceleration2 = new THREE.Vector2(
      -treadleFootRadiusVector2.y * treadleAngularAcceleration
        - treadleFootRadiusVector2.x * treadleAngularSpeed ** 2,
      treadleFootRadiusVector2.x * treadleAngularAcceleration
        - treadleFootRadiusVector2.y * treadleAngularSpeed ** 2,
    );

    const crankPoint = new THREE.Vector3(
      crankPoint2.x,
      crankPoint2.y,
      connectingRodPlaneZ,
    );
    const treadlePinPoint = new THREE.Vector3(
      treadlePinPoint2.x,
      treadlePinPoint2.y,
      connectingRodPlaneZ,
    );
    const treadleFootPoint = new THREE.Vector3(
      treadleFootPoint2.x,
      treadleFootPoint2.y,
      treadleCenterZ,
    );
    const crankPointVelocity = new THREE.Vector3(
      crankPointVelocity2.x,
      crankPointVelocity2.y,
      0,
    );
    const crankPointAcceleration = new THREE.Vector3(
      crankPointAcceleration2.x,
      crankPointAcceleration2.y,
      0,
    );
    const treadlePinVelocity = new THREE.Vector3(
      treadlePinVelocity2.x,
      treadlePinVelocity2.y,
      0,
    );
    const treadlePinAcceleration = new THREE.Vector3(
      treadlePinAcceleration2.x,
      treadlePinAcceleration2.y,
      0,
    );
    const treadleFootVelocity = new THREE.Vector3(
      treadleFootVelocity2.x,
      treadleFootVelocity2.y,
      0,
    );
    const treadleFootAcceleration = new THREE.Vector3(
      treadleFootAcceleration2.x,
      treadleFootAcceleration2.y,
      0,
    );
    const connectingRodVector = new THREE.Vector3(
      connectingRodVector2.x,
      connectingRodVector2.y,
      0,
    );
    const connectingRodRelativeVelocity = new THREE.Vector3(
      connectingRodRelativeVelocity2.x,
      connectingRodRelativeVelocity2.y,
      0,
    );
    const connectingRodRelativeAcceleration = new THREE.Vector3(
      connectingRodRelativeAcceleration2.x,
      connectingRodRelativeAcceleration2.y,
      0,
    );
    return {
      assemblyOrientation: centersVector2.x * connectingRodVector2.y
        - centersVector2.y * connectingRodVector2.x,
      branchReferenceMargin: rejectedTreadlePinPoint2.distanceTo(
        treadlePinReference,
      ) - treadlePinPoint2.distanceTo(treadlePinReference),
      centersDistance,
      connectingRodAccelerationConstraintError: connectingRodVector2.dot(
        connectingRodRelativeAcceleration2,
      ) + connectingRodRelativeVelocity2.lengthSq(),
      connectingRodAngle: Math.atan2(
        connectingRodVector2.y,
        connectingRodVector2.x,
      ),
      connectingRodAngularAcceleration,
      connectingRodAngularSpeed,
      connectingRodLengthError: connectingRodVector2.length()
        - connectingRodLength,
      connectingRodRelativeAcceleration,
      connectingRodRelativeVelocity,
      connectingRodVector,
      connectingRodVelocityConstraintError: connectingRodVector2.dot(
        connectingRodRelativeVelocity2,
      ),
      crankAngle,
      crankOrbitError: crankRadiusVector2.length() - crankRadius,
      crankPoint,
      crankPointAcceleration,
      crankPointVelocity,
      diskAngle,
      diskAngularAcceleration,
      diskAngularVelocity,
      diskRevolutions: diskAngle / fullTurn,
      footArcRadiusError: treadleFootRadiusVector2.length()
        - treadleFootRadius,
      footRadialAccelerationError: treadleFootRadiusVector2.dot(
        treadleFootAcceleration2,
      ) + treadleFootVelocity2.lengthSq(),
      footRadialVelocityError: treadleFootRadiusVector2.dot(
        treadleFootVelocity2,
      ),
      innerClosureMargin: centersDistance
        - Math.abs(connectingRodLength - treadlePinRadius),
      intersectionHeight,
      outerClosureMargin: connectingRodLength + treadlePinRadius
        - centersDistance,
      rejectedTreadlePinPoint: new THREE.Vector3(
        rejectedTreadlePinPoint2.x,
        rejectedTreadlePinPoint2.y,
        connectingRodPlaneZ,
      ),
      treadleAngle,
      treadleAngularAcceleration,
      treadleAngularSpeed,
      treadleFootAcceleration,
      treadleFootPoint,
      treadleFootVelocity,
      treadlePinAcceleration,
      treadlePinAccelerationConstraintError:
        treadlePinRadiusVector2.dot(treadlePinAcceleration2)
          + treadlePinVelocity2.lengthSq(),
      treadlePinPoint,
      treadlePinRadiusError: treadlePinRadiusVector2.length()
        - treadlePinRadius,
      treadlePinVelocity,
      treadlePinVelocityConstraintError: treadlePinRadiusVector2.dot(
        treadlePinVelocity2,
      ),
      treadleRigidCollinearityError:
        treadlePinRadiusVector2.x * treadleFootRadiusVector2.y
          - treadlePinRadiusVector2.y * treadleFootRadiusVector2.x,
      velocityDenominator,
    };
  };
  const stateAtDiskAngle = (diskAngle) => stateAtDiskKinematics({ diskAngle });
  const stateAtCyclePhase = (phase) => stateAtDiskAngle(fullTurn * phase);
  const stateAtTime = (time) => stateAtDiskAngle(diskAngularSpeed * time);

  const extrema = [];
  const extremaSamples = 4096;
  let previousPhase = 0;
  let previousSpeed = stateAtCyclePhase(previousPhase).treadleAngularSpeed;
  for (let sample = 1; sample <= extremaSamples; sample += 1) {
    const phase = sample / extremaSamples;
    const speed = stateAtCyclePhase(phase).treadleAngularSpeed;
    if (previousSpeed * speed < 0) {
      let lower = previousPhase;
      let upper = phase;
      let lowerSpeed = previousSpeed;
      for (let iteration = 0; iteration < 64; iteration += 1) {
        const middle = (lower + upper) / 2;
        const middleSpeed = stateAtCyclePhase(middle).treadleAngularSpeed;
        if (lowerSpeed * middleSpeed <= 0) {
          upper = middle;
        } else {
          lower = middle;
          lowerSpeed = middleSpeed;
        }
      }
      const extremumPhase = (lower + upper) / 2;
      const state = stateAtCyclePhase(extremumPhase);
      extrema.push({
        angle: state.treadleAngle,
        footY: state.treadleFootPoint.y,
        phase: extremumPhase,
        type: state.treadleAngularAcceleration > 0
          ? 'raised-treadle'
          : 'lowered-treadle',
      });
    }
    previousPhase = phase;
    previousSpeed = speed;
  }
  extrema.sort((left, right) => left.phase - right.phase);
  const raisedExtremum = extrema.find(({ type }) => (
    type === 'raised-treadle'
  ));
  const loweredExtremum = extrema.find(({ type }) => (
    type === 'lowered-treadle'
  ));
  const treadleAngularStroke = loweredExtremum.angle - raisedExtremum.angle;
  const treadleFootArcStroke = treadleFootRadius * treadleAngularStroke;
  const workingStrokeFraction = THREE.MathUtils.euclideanModulo(
    loweredExtremum.phase - raisedExtremum.phase,
    1,
  );
  const returnStrokeFraction = 1 - workingStrokeFraction;
  const canonicalStates = {
    lowered: stateAtCyclePhase(loweredExtremum.phase),
    raised: stateAtCyclePhase(raisedExtremum.phase),
    source: stateAtCyclePhase(0),
  };
  const canonicalTimes = {
    lowered: loweredExtremum.phase * cyclePeriod,
    nextSource: cyclePeriod,
    raised: raisedExtremum.phase * cyclePeriod,
    source: 0,
  };

  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.63,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const rodMaterial = matte(PALETTE.brass, {
    metalness: 0.14,
    roughness: 0.57,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.68,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const disk = new THREE.Group();
  disk.position.set(diskCenter.x, diskCenter.y, 0);
  disk.userData.axis = Z_AXIS.clone();
  disk.userData.role = 'continuously-rotating-disk-output';
  const diskRotor = new THREE.Group();
  disk.add(diskRotor);
  const diskBody = cylinderAlongZ(
    diskRadius,
    diskDepth,
    drivenMaterial,
    80,
  );
  diskBody.position.z = diskCenterZ;
  diskBody.userData.role = 'source-ten-unit-radius-output-disk';
  diskRotor.add(diskBody);
  const diskRim = new THREE.Mesh(
    new THREE.TorusGeometry(diskRadius, 0.048, 9, 80),
    darkMaterial,
  );
  diskRim.position.z = diskFrontZ + 0.026;
  diskRim.userData.role = 'dark-outline-of-output-disk';
  diskRotor.add(diskRim);
  const diskHub = cylinderAlongZ(
    diskHubRadius,
    diskDepth * 1.55,
    darkMaterial,
    42,
  );
  diskHub.position.z = diskCenterZ;
  diskHub.userData.role = 'output-disk-hub';
  diskRotor.add(diskHub);
  const diskIndex = makeBeam(
    new THREE.Vector3(diskHubRadius * 1.25, 0, diskFrontZ + 0.06),
    new THREE.Vector3(diskRadius * 0.70, 0, diskFrontZ + 0.06),
    { color: PALETTE.white, depth: 0.03, thickness: 0.065 },
  );
  diskIndex.userData.role = 'white-index-showing-continuous-disk-rotation';
  diskRotor.add(diskIndex);
  const diskShaft = cylinderAlongZ(
    diskHubRadius * 0.58,
    1.48,
    darkMaterial,
    36,
  );
  diskShaft.position.z = -0.32;
  diskShaft.userData.role = 'continuously-rotating-disk-shaft';
  diskRotor.add(diskShaft);

  const crankPin = new THREE.Group();
  crankPin.position.set(
    crankPinLocal.x,
    crankPinLocal.y,
    crankPinCenterZ,
  );
  crankPin.userData.axis = Z_AXIS.clone();
  crankPin.userData.role = 'disk-fixed-crank-pin-of-thirteen-unit-rod';
  const crankPinBody = cylinderAlongZ(
    crankPinRadius,
    crankPinLength,
    rodMaterial,
    34,
  );
  crankPinBody.userData.role = 'crank-pin-bridging-disk-and-rod-planes';
  crankPin.add(crankPinBody);
  const crankPinRim = new THREE.Mesh(
    new THREE.TorusGeometry(crankPinRadius, 0.027, 9, 34),
    darkMaterial,
  );
  crankPinRim.position.z = crankPinLength / 2 + 0.012;
  crankPinRim.userData.role = 'front-rim-of-disk-crank-pin';
  crankPin.add(crankPinRim);
  const crankPinFace = new THREE.Mesh(
    new THREE.CircleGeometry(crankPinRadius * 0.62, 30),
    indexMaterial,
  );
  crankPinFace.position.z = crankPinLength / 2 + 0.034;
  crankPinFace.userData.role = 'white-face-of-disk-crank-pin';
  crankPin.add(crankPinFace);
  diskRotor.add(crankPin);

  const treadle = new THREE.Group();
  treadle.position.set(treadlePivot.x, treadlePivot.y, 0);
  treadle.userData.axis = Z_AXIS.clone();
  treadle.userData.role = 'fixed-pivot-reciprocating-curvilinear-treadle';
  const treadleBeam = makeBeam(
    new THREE.Vector3(-treadleFootRadius, 0, treadleCenterZ),
    new THREE.Vector3(0, 0, treadleCenterZ),
    {
      color: PALETTE.driver,
      depth: treadleDepth,
      thickness: treadleThickness,
    },
  );
  treadleBeam.userData.role = 'rigid-twenty-eight-unit-treadle-beam';
  treadle.add(treadleBeam);
  const treadleFootPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.24, 0.34),
    driverMaterial,
  );
  treadleFootPlate.position.set(-treadleFootRadius + 0.28, 0.06, treadleCenterZ);
  treadleFootPlate.userData.role = 'broad-pressure-end-of-treadle';
  treadle.add(treadleFootPlate);
  const treadlePivotHub = cylinderAlongZ(
    0.28,
    0.54,
    driverMaterial,
    48,
  );
  treadlePivotHub.position.z = treadleCenterZ;
  treadlePivotHub.userData.role = 'hub-rigid-with-treadle-at-fixed-pivot';
  treadle.add(treadlePivotHub);
  const treadlePivotRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.20, 0.052, 10, 46),
    darkMaterial,
  );
  treadlePivotRing.position.z = treadleCenterZ + 0.30;
  treadlePivotRing.userData.role = 'front-ring-of-treadle-pivot';
  treadle.add(treadlePivotRing);
  const treadlePinHub = cylinderAlongZ(
    0.185,
    0.44,
    driverMaterial,
    38,
  );
  treadlePinHub.position.set(-treadlePinRadius, 0, treadleCenterZ + 0.07);
  treadlePinHub.userData.role = 'treadle-connecting-rod-joint-hub';
  treadle.add(treadlePinHub);
  const treadleJointPin = cylinderAlongZ(
    0.09,
    treadleJointPinLength,
    darkMaterial,
    28,
  );
  treadleJointPin.position.set(
    -treadlePinRadius,
    0,
    treadleJointPinCenterZ,
  );
  treadleJointPin.userData.role = 'pin-joining-rod-to-treadle';
  treadle.add(treadleJointPin);
  const treadleIndex = new THREE.Mesh(
    new THREE.BoxGeometry(treadleFootRadius * 0.18, 0.055, 0.032),
    indexMaterial,
  );
  treadleIndex.position.set(
    -treadleFootRadius * 0.72,
    treadleThickness / 2 + 0.015,
    treadleFrontZ + 0.045,
  );
  treadleIndex.userData.role = 'white-index-on-rocking-treadle';
  treadle.add(treadleIndex);

  const treadlePivotShaft = cylinderAlongZ(
    0.14,
    treadlePivotShaftLength,
    darkMaterial,
    34,
  );
  treadlePivotShaft.position.set(
    treadlePivot.x,
    treadlePivot.y,
    treadlePivotShaftCenterZ,
  );
  treadlePivotShaft.userData.role = 'fixed-shaft-through-treadle-pivot';

  const connectingRod = makeDynamicLink({
    color: PALETTE.brass,
    depth: 0.19,
    jointRadius: 0.17,
    thickness: 0.15,
  });
  connectingRod.userData.role =
    'finite-thirteen-unit-rod-between-disk-and-treadle';
  connectingRod.userData.setEndpoints(
    canonicalStates.source.crankPoint,
    canonicalStates.source.treadlePinPoint,
  );

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-disk-standard-and-treadle-pedestal';
  const baseY = treadlePivot.y - 0.54;
  const frameLeftX = -3.28;
  const frameRightX = treadlePivot.x + 0.76;
  const baseRail = makeBeam(
    new THREE.Vector3(frameLeftX, baseY, frameZ),
    new THREE.Vector3(frameRightX, baseY, frameZ),
    { color: PALETTE.frame, depth: 0.25, thickness: 0.18 },
  );
  baseRail.userData.role = 'fixed-ground-rail-under-treadle-mechanism';
  const diskStandLeft = makeBeam(
    new THREE.Vector3(-0.92, baseY, frameZ),
    new THREE.Vector3(-0.40, -0.82, frameZ),
    { color: PALETTE.frame, depth: 0.20, thickness: 0.14 },
  );
  diskStandLeft.userData.role = 'left-leg-of-disk-standard';
  const diskStandRight = makeBeam(
    new THREE.Vector3(0.92, baseY, frameZ),
    new THREE.Vector3(0.40, -0.82, frameZ),
    { color: PALETTE.frame, depth: 0.20, thickness: 0.14 },
  );
  diskStandRight.userData.role = 'right-leg-of-disk-standard';
  const diskBearing = new THREE.Mesh(
    new THREE.TorusGeometry(diskHubRadius * 1.10, 0.065, 10, 44),
    frameMaterial,
  );
  diskBearing.position.set(diskCenter.x, diskCenter.y, frameZ + 0.035);
  diskBearing.userData.role = 'fixed-rear-bearing-of-disk-shaft';
  const treadlePedestal = makeBeam(
    new THREE.Vector3(treadlePivot.x, baseY, frameZ),
    new THREE.Vector3(treadlePivot.x, treadlePivot.y, frameZ),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.28 },
  );
  treadlePedestal.userData.role = 'fixed-pedestal-under-treadle-pivot';
  const treadlePedestalBrace = makeBeam(
    new THREE.Vector3(treadlePivot.x + 0.48, baseY, frameZ),
    new THREE.Vector3(treadlePivot.x, treadlePivot.y, frameZ),
    { color: PALETTE.frame, depth: 0.20, thickness: 0.13 },
  );
  treadlePedestalBrace.userData.role = 'diagonal-brace-of-treadle-pedestal';
  const treadleBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.235, 0.060, 10, 42),
    frameMaterial,
  );
  treadleBearing.position.set(
    treadlePivot.x,
    treadlePivot.y,
    frameZ + 0.035,
  );
  treadleBearing.userData.role = 'fixed-rear-treadle-bearing';
  fixedFrame.add(
    baseRail,
    diskStandLeft,
    diskStandRight,
    diskBearing,
    treadlePedestal,
    treadlePedestalBrace,
    treadleBearing,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.0, 6.2, 2.25),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-0.15, -0.86, 0.03);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-complete-disk-and-treadle-sweep-envelope';

  root.add(
    cameraEnvelope,
    fixedFrame,
    treadlePivotShaft,
    disk,
    treadle,
    connectingRod,
  );

  root.userData.mechanism =
    'reciprocating-treadle-finite-connecting-rod-continuous-disk-crank-rocker';
  root.userData.cameraDistanceScale = 1.02;
  root.userData.blocks = {
    baseRail,
    cameraEnvelope,
    connectingRod,
    crankPin,
    crankPinBody,
    crankPinFace,
    crankPinRim,
    disk,
    diskBearing,
    diskBody,
    diskHub,
    diskIndex,
    diskRim,
    diskRotor,
    diskShaft,
    diskStandLeft,
    diskStandRight,
    fixedFrame,
    treadle,
    treadleBeam,
    treadleBearing,
    treadleFootPlate,
    treadleIndex,
    treadleJointPin,
    treadlePedestal,
    treadlePedestalBrace,
    treadlePinHub,
    treadlePivotHub,
    treadlePivotRing,
    treadlePivotShaft,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    baseY,
    connectingRodLength,
    connectingRodPlaneZ,
    crankPinBackZ,
    crankPinCenterZ,
    crankPinFrontZ,
    crankPinLength,
    crankPinLocal: crankPinLocal.clone(),
    crankPinRadius,
    crankRadius,
    cyclePeriod,
    diskAngularSpeed,
    diskCenter: diskCenter.clone(),
    diskCenterZ,
    diskDepth,
    diskFrontZ,
    diskHubRadius,
    diskRadius,
    fixedCenterDistance,
    frameLeftX,
    frameRightX,
    frameZ,
    fullTurn,
    returnStrokeFraction,
    sourceConnectingRodLength,
    sourceCrankAngle,
    sourceCrankPin: sourceCrankPin.clone(),
    sourceCrankPinRadius,
    sourceCyclesPerMinute,
    sourceDiskCenter: sourceDiskCenter.clone(),
    sourceDiskHubRadius,
    sourceDiskRadius,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    sourceTreadleFootLocal: sourceTreadleFootLocal.clone(),
    sourceTreadleHalfThickness,
    sourceTreadlePinLocal: sourceTreadlePinLocal.clone(),
    sourceTreadlePinReference: sourceTreadlePinReference.clone(),
    sourceTreadlePivot: sourceTreadlePivot.clone(),
    treadleCenterZ,
    treadleDepth,
    treadleFootArcStroke,
    treadleFootRadius,
    treadleFrontZ,
    treadleJointPinCenterZ,
    treadleJointPinLength,
    treadlePinRadius,
    treadlePinReference: treadlePinReference.clone(),
    treadlePivot: treadlePivot.clone(),
    treadlePivotShaftCenterZ,
    treadlePivotShaftLength,
    treadleThickness,
    treadleAngularStroke,
    workingStrokeFraction,
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtDiskAngle = stateAtDiskAngle;
  root.userData.stateAtDiskKinematics = stateAtDiskKinematics;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    diskRotor.rotation.z = state.diskAngle;
    disk.userData.angularSpeed = state.diskAngularVelocity;
    diskShaft.userData.angularSpeed = state.diskAngularVelocity;
    crankPin.userData.angularSpeed = state.diskAngularVelocity;
    treadle.rotation.z = state.treadleAngle;
    treadle.userData.angularSpeed = state.treadleAngularSpeed;
    treadle.userData.angularAcceleration = state.treadleAngularAcceleration;
    connectingRod.userData.setEndpoints(
      state.crankPoint,
      state.treadlePinPoint,
    );
    connectingRod.userData.angularSpeed = state.connectingRodAngularSpeed;
    connectingRod.userData.angularAcceleration =
      state.connectingRodAngularAcceleration;
    root.userData.contacts = {
      connectingRod: {
        accelerationConstraintError:
          state.connectingRodAccelerationConstraintError,
        angularSpeed: state.connectingRodAngularSpeed,
        diskPoint: state.crankPoint.clone(),
        length: connectingRodLength,
        lengthError: state.connectingRodLengthError,
        treadlePoint: state.treadlePinPoint.clone(),
        velocityConstraintError: state.connectingRodVelocityConstraintError,
      },
      diskCrankPin: {
        orbitError: state.crankOrbitError,
        pinFixedToDisk: true,
        position: state.crankPoint.clone(),
      },
      treadleFootPath: {
        accelerationError: state.footRadialAccelerationError,
        center: treadlePivot.clone(),
        radius: treadleFootRadius,
        radiusError: state.footArcRadiusError,
        velocityError: state.footRadialVelocityError,
      },
      treadlePin: {
        accelerationConstraintError:
          state.treadlePinAccelerationConstraintError,
        position: state.treadlePinPoint.clone(),
        radius: treadlePinRadius,
        radiusError: state.treadlePinRadiusError,
        velocityConstraintError: state.treadlePinVelocityConstraintError,
      },
      treadlePivot: {
        axis: Z_AXIS.clone(),
        centerError: Math.hypot(
          treadle.position.x - treadlePivot.x,
          treadle.position.y - treadlePivot.y,
        ),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  const model = finish(root, update, new THREE.Vector3(6.8, 4.6, 11.8));
  for (const object of [
    cameraEnvelope,
    crankPinFace,
    diskIndex,
    treadleIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return model;
}

function cordAndPulleyTreadleDiskMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Movement 159 has no published animation geometry, so these reference
  // points are measured from the public-domain 525 px engraving. Coordinates
  // below are converted to Brown units with the ten-unit disk radius used by
  // the adjacent Movement 158 model. The cord is the single route visible in
  // the plate: crank eye -> clockwise upper wrap -> treadle eye.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterDiskCenter = new THREE.Vector2(113, 266);
  const sourceRasterDiskRadius = 90;
  const sourceRasterCrankEye = new THREE.Vector2(178, 303);
  const sourceRasterGuideCenter = new THREE.Vector2(279, 106);
  const sourceRasterGuidePitchRadius = 45;
  const sourceRasterTreadlePivot = new THREE.Vector2(457, 352);
  const sourceRasterTreadleEye = new THREE.Vector2(319, 389);
  const sourceRasterTreadleFoot = new THREE.Vector2(169, 426);
  const sourceRasterGroundY = 457;
  const sourceUnitsPerPixel = 10 / sourceRasterDiskRadius;
  const sourcePointFromRaster = (point) => new THREE.Vector2(
    (point.x - sourceRasterDiskCenter.x) * sourceUnitsPerPixel,
    (sourceRasterDiskCenter.y - point.y) * sourceUnitsPerPixel,
  );
  const sourceDiskCenter = new THREE.Vector2(0, 0);
  const sourceDiskRadius = 10;
  const sourceDiskHubRadius = 1.35;
  const sourceCrankEye = sourcePointFromRaster(sourceRasterCrankEye);
  const sourceCrankRadius = sourceCrankEye.length();
  const sourceCrankAngle = Math.atan2(sourceCrankEye.y, sourceCrankEye.x);
  const sourceCrankEyeRadius = 0.72;
  const sourceGuideCenter = sourcePointFromRaster(sourceRasterGuideCenter);
  const sourceGuidePitchRadius = sourceRasterGuidePitchRadius
    * sourceUnitsPerPixel;
  const sourceTreadlePivot = sourcePointFromRaster(
    sourceRasterTreadlePivot,
  );
  const sourceTreadleEye = sourcePointFromRaster(sourceRasterTreadleEye);
  const sourceTreadleEyeVector = sourceTreadleEye.clone().sub(
    sourceTreadlePivot,
  );
  const sourceTreadleEyeRadius = sourceTreadleEyeVector.length();
  const sourceTreadleAngle = Math.atan2(
    -sourceTreadleEyeVector.y,
    -sourceTreadleEyeVector.x,
  );
  const sourceTreadleFootRadius = 33;
  const sourceGroundY = (
    sourceRasterDiskCenter.y - sourceRasterGroundY
  ) * sourceUnitsPerPixel;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const diskAngularSpeed = fullTurn / cyclePeriod;

  const sourceScale = 0.16;
  const diskCenter = sourceDiskCenter.clone().multiplyScalar(sourceScale);
  const diskRadius = sourceDiskRadius * sourceScale;
  const diskHubRadius = sourceDiskHubRadius * sourceScale;
  const crankEyeLocal = sourceCrankEye.clone().multiplyScalar(sourceScale);
  const crankRadius = sourceCrankRadius * sourceScale;
  const crankEyeRadius = sourceCrankEyeRadius * sourceScale;
  const guideCenter = sourceGuideCenter.clone().multiplyScalar(sourceScale);
  const guidePitchRadius = sourceGuidePitchRadius * sourceScale;
  const treadlePivot = sourceTreadlePivot.clone().multiplyScalar(sourceScale);
  const treadleEyeRadius = sourceTreadleEyeRadius * sourceScale;
  const treadleFootRadius = sourceTreadleFootRadius * sourceScale;
  const baseY = sourceGroundY * sourceScale;

  const diskCenterZ = -0.30;
  const diskDepth = 0.34;
  const diskFrontZ = diskCenterZ + diskDepth / 2;
  const treadleCenterZ = 0.17;
  const treadleDepth = 0.24;
  const treadleThickness = 0.17;
  const treadleFrontZ = treadleCenterZ + treadleDepth / 2;
  const cordPlaneZ = 0.64;
  const cordRadius = 0.045;
  const cordMarkerCount = 8;
  const cordTubularSegments = 288;
  const guideWidth = 0.42;
  const frameZ = -0.82;
  const crankPinBackZ = diskCenterZ - diskDepth / 2 - 0.05;
  const crankPinFrontZ = cordPlaneZ + 0.16;
  const crankPinLength = crankPinFrontZ - crankPinBackZ;
  const crankPinCenterZ = (crankPinFrontZ + crankPinBackZ) / 2;
  const treadleEyePinLength = cordPlaneZ - treadleCenterZ + 0.42;
  const treadleEyePinCenterZ = (cordPlaneZ + treadleCenterZ) / 2;
  const treadlePivotShaftLength = 1.58;

  const clockwiseTangent = (point) => new THREE.Vector2(
    point.y - guideCenter.y,
    -(point.x - guideCenter.x),
  ).multiplyScalar(1 / guidePitchRadius);

  const tangentCandidates = (external) => {
    const offset = external.clone().sub(guideCenter);
    const distanceSquared = offset.lengthSq();
    if (distanceSquared <= guidePitchRadius ** 2) {
      throw new RangeError('Movement 159 cord endpoint entered its guide pulley.');
    }
    const base = offset.clone().multiplyScalar(
      guidePitchRadius ** 2 / distanceSquared,
    );
    const side = new THREE.Vector2(-offset.y, offset.x).multiplyScalar(
      guidePitchRadius * Math.sqrt(
        distanceSquared - guidePitchRadius ** 2,
      ) / distanceSquared,
    );
    return [
      guideCenter.clone().add(base).add(side),
      guideCenter.clone().add(base).sub(side),
    ];
  };

  const selectClockwiseTangency = (external, startsAtExternal) => {
    const selections = tangentCandidates(external).map((point) => {
      const spanTangent = startsAtExternal
        ? point.clone().sub(external).normalize()
        : external.clone().sub(point).normalize();
      return {
        alignment: spanTangent.dot(clockwiseTangent(point)),
        point,
        spanTangent,
      };
    });
    selections.sort((left, right) => right.alignment - left.alignment);
    return selections[0];
  };

  const crankPointAtDiskAngle = (diskAngle) => new THREE.Vector2(
    diskCenter.x + crankRadius * Math.cos(sourceCrankAngle + diskAngle),
    diskCenter.y + crankRadius * Math.sin(sourceCrankAngle + diskAngle),
  );
  const treadleEyeAtAngle = (treadleAngle) => new THREE.Vector2(
    treadlePivot.x - treadleEyeRadius * Math.cos(treadleAngle),
    treadlePivot.y - treadleEyeRadius * Math.sin(treadleAngle),
  );

  const cordMetricsAtAngles = (diskAngle, treadleAngle) => {
    const crankPoint2 = crankPointAtDiskAngle(diskAngle);
    const treadleEyePoint2 = treadleEyeAtAngle(treadleAngle);
    const start = selectClockwiseTangency(crankPoint2, true);
    const end = selectClockwiseTangency(treadleEyePoint2, false);
    const startAngle = Math.atan2(
      start.point.y - guideCenter.y,
      start.point.x - guideCenter.x,
    );
    const endAngle = Math.atan2(
      end.point.y - guideCenter.y,
      end.point.x - guideCenter.x,
    );
    let wrapSweep = endAngle - startAngle;
    while (wrapSweep >= 0) wrapSweep -= fullTurn;
    while (wrapSweep < -fullTurn) wrapSweep += fullTurn;
    const crankSpanLength = crankPoint2.distanceTo(start.point);
    const wrapLength = -wrapSweep * guidePitchRadius;
    const treadleSpanLength = end.point.distanceTo(treadleEyePoint2);
    return {
      crankPoint2,
      crankSpanLength,
      endAngle,
      endAlignment: end.alignment,
      endTangent2: end.spanTangent,
      guideExit2: end.point,
      guideEntry2: start.point,
      startAngle,
      startAlignment: start.alignment,
      startTangent2: start.spanTangent,
      totalLength: crankSpanLength + wrapLength + treadleSpanLength,
      treadleEyePoint2,
      treadleSpanLength,
      wrapLength,
      wrapSweep,
    };
  };

  const sourceCordMetrics = cordMetricsAtAngles(0, sourceTreadleAngle);
  const nominalCordLength = sourceCordMetrics.totalLength;
  const guidePulleyAngleFromMetrics = (metrics) => (
    metrics.crankSpanLength - sourceCordMetrics.crankSpanLength
  ) / guidePitchRadius + Math.atan2(
    Math.sin(metrics.startAngle - sourceCordMetrics.startAngle),
    Math.cos(metrics.startAngle - sourceCordMetrics.startAngle),
  );
  const treadleAngleLowerLimit = -0.55;
  const treadleAngleUpperLimit = 1.18;
  const rootIterations = 54;
  const solveTreadleAngle = (diskAngle) => {
    let lower = treadleAngleLowerLimit;
    let upper = treadleAngleUpperLimit;
    let lowerError = cordMetricsAtAngles(diskAngle, lower).totalLength
      - nominalCordLength;
    const upperError = cordMetricsAtAngles(diskAngle, upper).totalLength
      - nominalCordLength;
    if (lowerError * upperError > 0) {
      throw new RangeError('Movement 159 lost its taut-cord assembly branch.');
    }
    for (let iteration = 0; iteration < rootIterations; iteration += 1) {
      const middle = (lower + upper) / 2;
      const middleError = cordMetricsAtAngles(
        diskAngle,
        middle,
      ).totalLength - nominalCordLength;
      if (lowerError * middleError <= 0) {
        upper = middle;
      } else {
        lower = middle;
        lowerError = middleError;
      }
    }
    return (lower + upper) / 2;
  };

  class OpenPulleyCordCurve extends THREE.Curve {
    constructor(metrics) {
      super();
      const toPoint3 = (point) => new THREE.Vector3(
        point.x,
        point.y,
        cordPlaneZ,
      );
      this.startPoint = toPoint3(metrics.crankPoint2);
      this.guideEntry = toPoint3(metrics.guideEntry2);
      this.guideExit = toPoint3(metrics.guideExit2);
      this.endPoint = toPoint3(metrics.treadleEyePoint2);
      this.wrap = new CircularArcCurve3(
        new THREE.Vector3(guideCenter.x, guideCenter.y, cordPlaneZ),
        this.guideEntry.clone().sub(new THREE.Vector3(
          guideCenter.x,
          guideCenter.y,
          cordPlaneZ,
        )),
        Z_AXIS,
        metrics.wrapSweep,
      );
      this.curves = [
        new THREE.LineCurve3(this.startPoint, this.guideEntry),
        this.wrap,
        new THREE.LineCurve3(this.guideExit, this.endPoint),
      ];
      this.segmentLengths = [
        metrics.crankSpanLength,
        metrics.wrapLength,
        metrics.treadleSpanLength,
      ];
      this.transitionDistances = [
        metrics.crankSpanLength,
        metrics.crankSpanLength + metrics.wrapLength,
      ];
      this.totalLength = metrics.totalLength;
      this.closed = false;
    }

    segmentAtDistance(rawDistance) {
      const distance = THREE.MathUtils.clamp(rawDistance, 0, this.totalLength);
      let segmentStart = 0;
      for (let index = 0; index < this.curves.length; index += 1) {
        const length = this.segmentLengths[index];
        if (distance <= segmentStart + length || index === 2) {
          return {
            curve: this.curves[index],
            index,
            localFraction: length > 0
              ? THREE.MathUtils.clamp(
                (distance - segmentStart) / length,
                0,
                1,
              )
              : 0,
          };
        }
        segmentStart += length;
      }
      throw new RangeError('Movement 159 cord segment lookup failed.');
    }

    getPoint(fraction, target = new THREE.Vector3()) {
      return this.getPointAtDistance(fraction * this.totalLength, target);
    }

    getPointAt(fraction, target = new THREE.Vector3()) {
      return this.getPoint(fraction, target);
    }

    getPointAtDistance(distance, target = new THREE.Vector3()) {
      const segment = this.segmentAtDistance(distance);
      return segment.curve.getPoint(segment.localFraction, target);
    }

    getTangent(fraction, target = new THREE.Vector3()) {
      return this.getTangentAtDistance(fraction * this.totalLength, target);
    }

    getTangentAt(fraction, target = new THREE.Vector3()) {
      return this.getTangent(fraction, target);
    }

    getTangentAtDistance(distance, target = new THREE.Vector3()) {
      const segment = this.segmentAtDistance(distance);
      return segment.curve.getTangent(segment.localFraction, target);
    }

    getLength() {
      return this.totalLength;
    }
  }

  const cordCurveFromMetrics = (metrics) => new OpenPulleyCordCurve(metrics);
  const derivativeAngleStep = 0.0001;
  const stateAtDiskKinematics = ({
    diskAngle,
    diskAngularAcceleration = 0,
    diskAngularVelocity = diskAngularSpeed,
  }) => {
    const treadleAngle = solveTreadleAngle(diskAngle);
    const metrics = cordMetricsAtAngles(diskAngle, treadleAngle);
    const beforeTreadleAngle = solveTreadleAngle(
      diskAngle - derivativeAngleStep,
    );
    const afterTreadleAngle = solveTreadleAngle(
      diskAngle + derivativeAngleStep,
    );
    const beforeMetrics = cordMetricsAtAngles(
      diskAngle - derivativeAngleStep,
      beforeTreadleAngle,
    );
    const afterMetrics = cordMetricsAtAngles(
      diskAngle + derivativeAngleStep,
      afterTreadleAngle,
    );
    const crankRadiusVectorForDerivative = metrics.crankPoint2.clone().sub(
      diskCenter,
    );
    const crankPointPerDiskRadian = new THREE.Vector2(
      -crankRadiusVectorForDerivative.y,
      crankRadiusVectorForDerivative.x,
    );
    const treadleEyeRadiusVectorForDerivative = metrics.treadleEyePoint2
      .clone().sub(treadlePivot);
    const treadleEyePerRadian = new THREE.Vector2(
      -treadleEyeRadiusVectorForDerivative.y,
      treadleEyeRadiusVectorForDerivative.x,
    );
    const velocityConstraintDenominator = metrics.endTangent2.dot(
      treadleEyePerRadian,
    );
    const treadleAnglePerDiskRadian = metrics.startTangent2.dot(
      crankPointPerDiskRadian,
    ) / velocityConstraintDenominator;
    const treadleAngleSecondDerivative = (
      afterTreadleAngle - 2 * treadleAngle + beforeTreadleAngle
    ) / derivativeAngleStep ** 2;
    const treadleAngularSpeed = treadleAnglePerDiskRadian
      * diskAngularVelocity;
    const treadleAngularAcceleration = treadleAngleSecondDerivative
      * diskAngularVelocity ** 2
      + treadleAnglePerDiskRadian * diskAngularAcceleration;

    const crankAngle = sourceCrankAngle + diskAngle;
    const crankRadiusVector2 = metrics.crankPoint2.clone().sub(diskCenter);
    const crankPointVelocity2 = new THREE.Vector2(
      -crankRadiusVector2.y * diskAngularVelocity,
      crankRadiusVector2.x * diskAngularVelocity,
    );
    const crankPointAcceleration2 = new THREE.Vector2(
      -crankRadiusVector2.x * diskAngularVelocity ** 2
        - crankRadiusVector2.y * diskAngularAcceleration,
      -crankRadiusVector2.y * diskAngularVelocity ** 2
        + crankRadiusVector2.x * diskAngularAcceleration,
    );
    const treadleEyeRadiusVector2 = metrics.treadleEyePoint2.clone().sub(
      treadlePivot,
    );
    const treadleEyePerpendicular2 = new THREE.Vector2(
      -treadleEyeRadiusVector2.y,
      treadleEyeRadiusVector2.x,
    );
    const treadleEyeVelocity2 = treadleEyePerpendicular2.clone()
      .multiplyScalar(treadleAngularSpeed);
    const treadleEyeAcceleration2 = treadleEyePerpendicular2.clone()
      .multiplyScalar(treadleAngularAcceleration)
      .addScaledVector(
        treadleEyeRadiusVector2,
        -(treadleAngularSpeed ** 2),
      );
    const treadleFootRadiusVector2 = new THREE.Vector2(
      -treadleFootRadius * Math.cos(treadleAngle),
      -treadleFootRadius * Math.sin(treadleAngle),
    );
    const treadleFootPoint2 = treadlePivot.clone().add(
      treadleFootRadiusVector2,
    );
    const treadleFootPerpendicular2 = new THREE.Vector2(
      -treadleFootRadiusVector2.y,
      treadleFootRadiusVector2.x,
    );
    const treadleFootVelocity2 = treadleFootPerpendicular2.clone()
      .multiplyScalar(treadleAngularSpeed);
    const treadleFootAcceleration2 = treadleFootPerpendicular2.clone()
      .multiplyScalar(treadleAngularAcceleration)
      .addScaledVector(
        treadleFootRadiusVector2,
        -(treadleAngularSpeed ** 2),
      );

    const startCordSpeed = crankPointVelocity2.dot(metrics.startTangent2);
    const endCordSpeed = treadleEyeVelocity2.dot(metrics.endTangent2);
    const guidePulleyAngle = guidePulleyAngleFromMetrics(metrics);
    const beforeGuidePulleyAngle = guidePulleyAngleFromMetrics(beforeMetrics);
    const afterGuidePulleyAngle = guidePulleyAngleFromMetrics(afterMetrics);
    const guidePulleyAnglePerDiskRadian = -metrics.startTangent2.dot(
      crankPointPerDiskRadian,
    ) / guidePitchRadius;
    const guidePulleyAngleSecondDerivative = (
      afterGuidePulleyAngle
        - 2 * guidePulleyAngle
        + beforeGuidePulleyAngle
    ) / derivativeAngleStep ** 2;
    const guidePulleyAngularSpeed = -startCordSpeed / guidePitchRadius;
    const guidePulleyAngularAcceleration = (
      guidePulleyAngleSecondDerivative * diskAngularVelocity ** 2
        + guidePulleyAnglePerDiskRadian * diskAngularAcceleration
    );
    const cordAcceleration = -guidePulleyAngularAcceleration
      * guidePitchRadius;
    const constraintSlopeStep = 0.00001;
    const constraintSlope = (
      cordMetricsAtAngles(
        diskAngle,
        treadleAngle + constraintSlopeStep,
      ).totalLength
        - cordMetricsAtAngles(
          diskAngle,
          treadleAngle - constraintSlopeStep,
        ).totalLength
    ) / (2 * constraintSlopeStep);
    const cordCurve = cordCurveFromMetrics(metrics);
    const crankPoint = new THREE.Vector3(
      metrics.crankPoint2.x,
      metrics.crankPoint2.y,
      cordPlaneZ,
    );
    const treadleEyePoint = new THREE.Vector3(
      metrics.treadleEyePoint2.x,
      metrics.treadleEyePoint2.y,
      cordPlaneZ,
    );
    const treadleFootPoint = new THREE.Vector3(
      treadleFootPoint2.x,
      treadleFootPoint2.y,
      treadleCenterZ,
    );
    const toVector3 = (point) => new THREE.Vector3(point.x, point.y, 0);
    return {
      assemblyBranchMargin: Math.min(
        metrics.crankPoint2.distanceTo(guideCenter) - guidePitchRadius,
        metrics.treadleEyePoint2.distanceTo(guideCenter) - guidePitchRadius,
      ),
      constraintSlope,
      cordAcceleration,
      cordCurve,
      cordLength: metrics.totalLength,
      cordLengthError: metrics.totalLength - nominalCordLength,
      cordSpeed: (startCordSpeed + endCordSpeed) / 2,
      cordSpeedConstraintError: startCordSpeed - endCordSpeed,
      cordTransitionDistances: cordCurve.transitionDistances.slice(),
      crankAngle,
      crankOrbitError: crankRadiusVector2.length() - crankRadius,
      crankPoint,
      crankPointAcceleration: toVector3(crankPointAcceleration2),
      crankPointVelocity: toVector3(crankPointVelocity2),
      crankSpanLength: metrics.crankSpanLength,
      diskAngle,
      diskAngularAcceleration,
      diskAngularVelocity,
      diskRevolutions: diskAngle / fullTurn,
      endCordSpeed,
      footArcRadiusError: treadleFootRadiusVector2.length()
        - treadleFootRadius,
      footRadialAccelerationError: treadleFootRadiusVector2.dot(
        treadleFootAcceleration2,
      ) + treadleFootVelocity2.lengthSq(),
      footRadialVelocityError: treadleFootRadiusVector2.dot(
        treadleFootVelocity2,
      ),
      guideEntry: cordCurve.guideEntry.clone(),
      guideExit: cordCurve.guideExit.clone(),
      guidePulleyAngle,
      guidePulleyAnglePerDiskRadian,
      guidePulleyAngleSecondDerivative,
      guidePulleyAngularAcceleration,
      guidePulleyAngularSpeed,
      guidePulleyNoSlipSpeedError: guidePulleyAngularSpeed
        * guidePitchRadius + startCordSpeed,
      guideWrapLength: metrics.wrapLength,
      guideWrapSweep: metrics.wrapSweep,
      ropeCount: 1,
      stage: Math.abs(treadleAngularSpeed) < 1e-8
        ? 'treadle-at-reversal'
        : treadleAngularSpeed > 0
          ? 'treadle-descends-and-pulls-crank-cord'
          : 'flywheel-returns-treadle-through-crank-cord',
      startCordSpeed,
      startTangencyAlignment: metrics.startAlignment,
      endTangencyAlignment: metrics.endAlignment,
      treadleAngle,
      treadleAnglePerDiskRadian,
      treadleAngleSecondDerivative,
      treadleAngularAcceleration,
      treadleAngularSpeed,
      treadleEyeAcceleration: toVector3(treadleEyeAcceleration2),
      treadleEyePoint,
      treadleEyeRadiusError: treadleEyeRadiusVector2.length()
        - treadleEyeRadius,
      treadleEyeRadialAccelerationError: treadleEyeRadiusVector2.dot(
        treadleEyeAcceleration2,
      ) + treadleEyeVelocity2.lengthSq(),
      treadleEyeRadialVelocityError: treadleEyeRadiusVector2.dot(
        treadleEyeVelocity2,
      ),
      treadleEyeVelocity: toVector3(treadleEyeVelocity2),
      treadleFootAcceleration: toVector3(treadleFootAcceleration2),
      treadleFootPoint,
      treadleFootVelocity: toVector3(treadleFootVelocity2),
      treadleSpanLength: metrics.treadleSpanLength,
      velocityConstraintDenominator,
    };
  };
  const stateAtDiskAngle = (diskAngle) => stateAtDiskKinematics({ diskAngle });
  const stateAtCyclePhase = (phase) => stateAtDiskAngle(fullTurn * phase);
  const stateAtTime = (time) => stateAtDiskAngle(diskAngularSpeed * time);

  const extrema = [];
  const extremaSamples = 2048;
  let previousPhase = 0;
  let previousSpeed = stateAtCyclePhase(0).treadleAngularSpeed;
  for (let sample = 1; sample <= extremaSamples; sample += 1) {
    const phase = sample / extremaSamples;
    const speed = stateAtCyclePhase(phase).treadleAngularSpeed;
    if (previousSpeed * speed < 0) {
      let lower = previousPhase;
      let upper = phase;
      let lowerSpeed = previousSpeed;
      for (let iteration = 0; iteration < 48; iteration += 1) {
        const middle = (lower + upper) / 2;
        const middleSpeed = stateAtCyclePhase(middle).treadleAngularSpeed;
        if (lowerSpeed * middleSpeed <= 0) {
          upper = middle;
        } else {
          lower = middle;
          lowerSpeed = middleSpeed;
        }
      }
      const extremumPhase = (lower + upper) / 2;
      const state = stateAtCyclePhase(extremumPhase);
      extrema.push({
        angle: state.treadleAngle,
        footY: state.treadleFootPoint.y,
        phase: extremumPhase,
        type: state.treadleAngularAcceleration > 0
          ? 'raised-treadle'
          : 'lowered-treadle',
      });
    }
    previousPhase = phase;
    previousSpeed = speed;
  }
  const raisedExtremum = extrema.find(({ type }) => (
    type === 'raised-treadle'
  ));
  const loweredExtremum = extrema.find(({ type }) => (
    type === 'lowered-treadle'
  ));
  const canonicalTimes = {
    lowered: loweredExtremum.phase * cyclePeriod,
    nextSource: cyclePeriod,
    raised: raisedExtremum.phase * cyclePeriod,
    source: 0,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [name, stateAtTime(time)]),
  );
  const treadleAngularStroke = loweredExtremum.angle - raisedExtremum.angle;
  const treadleFootArcStroke = treadleFootRadius * treadleAngularStroke;
  const workingStrokeFraction = THREE.MathUtils.euclideanModulo(
    loweredExtremum.phase - raisedExtremum.phase,
    1,
  );
  const returnStrokeFraction = 1 - workingStrokeFraction;

  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.63,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.68,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const disk = new THREE.Group();
  disk.position.set(diskCenter.x, diskCenter.y, 0);
  disk.userData.axis = Z_AXIS.clone();
  disk.userData.role = 'continuous-flywheel-disk-driven-by-treadle-cord';
  const diskRotor = new THREE.Group();
  disk.add(diskRotor);
  const diskBody = cylinderAlongZ(diskRadius, diskDepth, drivenMaterial, 80);
  diskBody.position.z = diskCenterZ;
  diskBody.userData.role = 'plate-proportioned-ten-unit-flywheel-disk';
  const diskRim = new THREE.Mesh(
    new THREE.TorusGeometry(diskRadius, 0.052, 9, 80),
    darkMaterial,
  );
  diskRim.position.z = diskFrontZ + 0.026;
  diskRim.userData.role = 'dark-flywheel-rim';
  const diskHub = cylinderAlongZ(
    diskHubRadius,
    diskDepth * 1.55,
    darkMaterial,
    42,
  );
  diskHub.position.z = diskCenterZ;
  diskHub.userData.role = 'flywheel-hub';
  const diskIndex = makeBeam(
    new THREE.Vector3(diskHubRadius * 1.28, 0, diskFrontZ + 0.065),
    new THREE.Vector3(diskRadius * 0.73, 0, diskFrontZ + 0.065),
    { color: PALETTE.white, depth: 0.032, thickness: 0.07 },
  );
  diskIndex.userData.role = 'white-index-showing-continuous-disk-spin';
  const diskShaft = cylinderAlongZ(
    diskHubRadius * 0.58,
    1.62,
    darkMaterial,
    36,
  );
  diskShaft.position.z = -0.35;
  diskShaft.userData.role = 'continuous-disk-shaft';
  diskRotor.add(diskBody, diskRim, diskHub, diskIndex, diskShaft);

  const crankEye = new THREE.Group();
  crankEye.position.set(crankEyeLocal.x, crankEyeLocal.y, 0);
  crankEye.userData.axis = Z_AXIS.clone();
  crankEye.userData.role = 'rotating-cord-anchor-eye-on-disk';
  const crankEyePin = cylinderAlongZ(
    crankEyeRadius * 0.72,
    crankPinLength,
    darkMaterial,
    32,
  );
  crankEyePin.position.z = crankPinCenterZ;
  crankEyePin.userData.role = 'pin-bridging-flywheel-and-cord-planes';
  const crankEyeRing = new THREE.Mesh(
    new THREE.TorusGeometry(crankEyeRadius, 0.038, 10, 40),
    darkMaterial,
  );
  crankEyeRing.position.z = cordPlaneZ;
  crankEyeRing.userData.role = 'cord-fastening-eye-at-crank-radius';
  const crankCordKnot = new THREE.Mesh(
    new THREE.SphereGeometry(cordRadius * 1.65, 12, 9),
    indexMaterial,
  );
  crankCordKnot.position.z = cordPlaneZ;
  crankCordKnot.userData.role = 'fixed-material-crank-end-of-cord';
  crankEye.add(crankEyePin, crankEyeRing, crankCordKnot);
  diskRotor.add(crankEye);

  const treadle = new THREE.Group();
  treadle.position.set(treadlePivot.x, treadlePivot.y, 0);
  treadle.userData.axis = Z_AXIS.clone();
  treadle.userData.role = 'fixed-pivot-reciprocating-treadle-driver';
  const treadleBeam = makeBeam(
    new THREE.Vector3(-treadleFootRadius, 0, treadleCenterZ),
    new THREE.Vector3(0, 0, treadleCenterZ),
    {
      color: PALETTE.driver,
      depth: treadleDepth,
      thickness: treadleThickness,
    },
  );
  treadleBeam.userData.role = 'plate-proportioned-rigid-treadle-beam';
  const treadleFootPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.25, 0.35),
    driverMaterial,
  );
  treadleFootPlate.position.set(
    -treadleFootRadius + 0.30,
    0.055,
    treadleCenterZ,
  );
  treadleFootPlate.userData.role = 'broad-pressure-end-of-treadle';
  const treadlePivotHub = cylinderAlongZ(0.27, 0.56, driverMaterial, 46);
  treadlePivotHub.position.z = treadleCenterZ;
  treadlePivotHub.userData.role = 'hub-rigid-with-treadle';
  const treadlePivotRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.20, 0.052, 10, 44),
    darkMaterial,
  );
  treadlePivotRing.position.z = treadleFrontZ + 0.18;
  treadlePivotRing.userData.role = 'front-ring-at-fixed-treadle-pivot';
  const treadleEyeHub = cylinderAlongZ(0.18, 0.43, driverMaterial, 36);
  treadleEyeHub.position.set(-treadleEyeRadius, 0, treadleCenterZ + 0.06);
  treadleEyeHub.userData.role = 'treadle-cord-attachment-hub';
  const treadleEyePin = cylinderAlongZ(
    0.085,
    treadleEyePinLength,
    darkMaterial,
    28,
  );
  treadleEyePin.position.set(
    -treadleEyeRadius,
    0,
    treadleEyePinCenterZ,
  );
  treadleEyePin.userData.role = 'pin-joining-cord-eye-to-treadle';
  const treadleEyeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.035, 9, 34),
    darkMaterial,
  );
  treadleEyeRing.position.set(-treadleEyeRadius, 0, cordPlaneZ);
  treadleEyeRing.userData.role = 'cord-fastening-eye-on-treadle';
  const treadleCordKnot = new THREE.Mesh(
    new THREE.SphereGeometry(cordRadius * 1.65, 12, 9),
    indexMaterial,
  );
  treadleCordKnot.position.set(-treadleEyeRadius, 0, cordPlaneZ);
  treadleCordKnot.userData.role = 'fixed-material-treadle-end-of-cord';
  const treadleIndex = new THREE.Mesh(
    new THREE.BoxGeometry(treadleFootRadius * 0.14, 0.055, 0.035),
    indexMaterial,
  );
  treadleIndex.position.set(
    -treadleFootRadius * 0.72,
    treadleThickness / 2 + 0.016,
    treadleFrontZ + 0.05,
  );
  treadleIndex.userData.role = 'white-index-on-rocking-treadle';
  treadle.add(
    treadleBeam,
    treadleFootPlate,
    treadlePivotHub,
    treadlePivotRing,
    treadleEyeHub,
    treadleEyePin,
    treadleEyeRing,
    treadleCordKnot,
    treadleIndex,
  );

  const treadlePivotShaft = cylinderAlongZ(
    0.14,
    treadlePivotShaftLength,
    darkMaterial,
    34,
  );
  treadlePivotShaft.position.set(treadlePivot.x, treadlePivot.y, -0.02);
  treadlePivotShaft.userData.role = 'fixed-shaft-through-treadle-pivot';

  const guidePulley = makePulley({
    color: PALETTE.accent,
    grooves: 1,
    radius: guidePitchRadius,
    spokes: 5,
    width: guideWidth,
  });
  guidePulley.position.set(guideCenter.x, guideCenter.y, cordPlaneZ);
  guidePulley.userData.role = 'single-fixed-axis-cord-redirecting-pulley';
  const guidePulleyRotor = guidePulley.userData.rotor;
  const guideIndex = makeBeam(
    new THREE.Vector3(guidePitchRadius * 0.25, 0, guideWidth / 2 + 0.075),
    new THREE.Vector3(guidePitchRadius * 0.72, 0, guideWidth / 2 + 0.075),
    { color: PALETTE.white, depth: 0.035, thickness: 0.065 },
  );
  guideIndex.userData.role = 'white-index-showing-guide-pulley-cord-travel';
  guidePulleyRotor.add(guideIndex);
  const guideShaft = cylinderAlongZ(0.13, 1.66, darkMaterial, 34);
  guideShaft.position.set(guideCenter.x, guideCenter.y, -0.03);
  guideShaft.userData.role = 'fixed-overhead-guide-pulley-shaft';

  const sourceCordCurve = cordCurveFromMetrics(sourceCordMetrics);
  const cord = makeDynamicMovingBelt(sourceCordCurve, {
    closed: false,
    color: PALETTE.belt,
    markerColor: PALETTE.white,
    markerCount: cordMarkerCount,
    radius: cordRadius,
    tubularSegments: cordTubularSegments,
  });
  cord.userData.closed = false;
  cord.userData.mechanismRope = true;
  cord.userData.ropeCount = 1;
  cord.userData.role =
    'one-open-constant-length-cord-from-crank-over-guide-to-treadle';
  const cordMarkers = cord.children.filter((object) => (
    object.userData.isFlowMarker === true
  ));
  const cordMesh = cord.children.find((object) => (
    object.geometry?.type === 'TubeGeometry'
  ));
  const cordMarkerMaterialDistances = cordMarkers.map((marker, index) => {
    const distance = nominalCordLength * (index + 1) / (cordMarkerCount + 1);
    marker.userData.materialDistance = distance;
    marker.userData.role = `fixed-material-cord-marker-${index + 1}`;
    return distance;
  });
  cordMesh.userData.role = 'single-visible-continuous-cord-tube';

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'fixed-disk-treadle-and-overhead-guide-supports';
  const frameLeftX = -2.12;
  const frameRightX = treadlePivot.x + 0.78;
  const baseRail = makeBeam(
    new THREE.Vector3(frameLeftX, baseY, frameZ),
    new THREE.Vector3(frameRightX, baseY, frameZ),
    { color: PALETTE.frame, depth: 0.25, thickness: 0.18 },
  );
  baseRail.userData.role = 'engraving-height-fixed-base-rail';
  const diskStandLeft = makeBeam(
    new THREE.Vector3(-0.92, baseY, frameZ),
    new THREE.Vector3(-0.38, -0.82, frameZ),
    { color: PALETTE.frame, depth: 0.21, thickness: 0.14 },
  );
  const diskStandRight = makeBeam(
    new THREE.Vector3(0.92, baseY, frameZ),
    new THREE.Vector3(0.38, -0.82, frameZ),
    { color: PALETTE.frame, depth: 0.21, thickness: 0.14 },
  );
  diskStandLeft.userData.role = 'left-leg-of-flywheel-standard';
  diskStandRight.userData.role = 'right-leg-of-flywheel-standard';
  const diskBearing = new THREE.Mesh(
    new THREE.TorusGeometry(diskHubRadius * 1.12, 0.065, 10, 44),
    frameMaterial,
  );
  diskBearing.position.set(diskCenter.x, diskCenter.y, frameZ + 0.035);
  diskBearing.userData.role = 'fixed-rear-flywheel-bearing';
  const treadlePedestal = makeBeam(
    new THREE.Vector3(treadlePivot.x, baseY, frameZ),
    new THREE.Vector3(treadlePivot.x, treadlePivot.y, frameZ),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.28 },
  );
  treadlePedestal.userData.role = 'fixed-right-treadle-pedestal';
  const treadlePedestalBrace = makeBeam(
    new THREE.Vector3(treadlePivot.x + 0.48, baseY, frameZ),
    new THREE.Vector3(treadlePivot.x, treadlePivot.y, frameZ),
    { color: PALETTE.frame, depth: 0.20, thickness: 0.13 },
  );
  treadlePedestalBrace.userData.role = 'right-pedestal-brace';
  const treadleBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.235, 0.060, 10, 42),
    frameMaterial,
  );
  treadleBearing.position.set(treadlePivot.x, treadlePivot.y, frameZ + 0.035);
  treadleBearing.userData.role = 'fixed-rear-treadle-bearing';
  const guideSupportPost = makeBeam(
    new THREE.Vector3(guideCenter.x + 0.38, baseY, frameZ - 0.02),
    new THREE.Vector3(guideCenter.x, guideCenter.y, frameZ - 0.02),
    { color: PALETTE.frame, depth: 0.20, thickness: 0.12 },
  );
  guideSupportPost.userData.role = 'rear-support-of-single-overhead-guide';
  const guideBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.062, 10, 42),
    frameMaterial,
  );
  guideBearing.position.set(guideCenter.x, guideCenter.y, frameZ + 0.035);
  guideBearing.userData.role = 'fixed-rear-bearing-of-guide-pulley';
  fixedFrame.add(
    baseRail,
    diskStandLeft,
    diskStandRight,
    diskBearing,
    treadlePedestal,
    treadlePedestalBrace,
    treadleBearing,
    guideSupportPost,
    guideBearing,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(9.25, 10.25, 2.8),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(2.35, -1.05, 0.02);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-complete-cord-treadle-and-disk-sweeps';

  root.add(
    cameraEnvelope,
    fixedFrame,
    guideShaft,
    treadlePivotShaft,
    disk,
    treadle,
    guidePulley,
    cord,
  );

  const cordMaterialPointAtDiskAngle = (diskAngle, materialDistance) => {
    const treadleAngle = solveTreadleAngle(diskAngle);
    const curve = cordCurveFromMetrics(cordMetricsAtAngles(
      diskAngle,
      treadleAngle,
    ));
    const distance = THREE.MathUtils.clamp(
      materialDistance,
      0,
      nominalCordLength,
    );
    const segment = curve.segmentAtDistance(distance);
    return {
      distance,
      position: curve.getPointAtDistance(distance),
      region: [
        'crank-to-guide-straight-span',
        'clockwise-upper-guide-wrap',
        'guide-to-treadle-straight-span',
      ][segment.index],
      tangent: curve.getTangentAtDistance(distance),
    };
  };
  const cordMaterialPointAtTime = (time, materialDistance) => (
    cordMaterialPointAtDiskAngle(diskAngularSpeed * time, materialDistance)
  );

  root.userData.mechanism =
    'treadle-crank-single-cord-fixed-guide-pulley-drive';
  root.userData.cameraDistanceScale = 1.02;
  root.userData.blocks = {
    baseRail,
    cameraEnvelope,
    cord,
    cordMarkers,
    cordMesh,
    crankCordKnot,
    crankEye,
    crankEyePin,
    crankEyeRing,
    disk,
    diskBearing,
    diskBody,
    diskHub,
    diskIndex,
    diskRim,
    diskRotor,
    diskShaft,
    diskStandLeft,
    diskStandRight,
    fixedFrame,
    guideBearing,
    guideIndex,
    guidePulley,
    guidePulleyRotor,
    guideShaft,
    guideSupportPost,
    treadle,
    treadleBeam,
    treadleBearing,
    treadleCordKnot,
    treadleEyeHub,
    treadleEyePin,
    treadleEyeRing,
    treadleFootPlate,
    treadleIndex,
    treadlePedestal,
    treadlePedestalBrace,
    treadlePivotHub,
    treadlePivotRing,
    treadlePivotShaft,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.cordMaterialPointAtDiskAngle = cordMaterialPointAtDiskAngle;
  root.userData.cordMaterialPointAtTime = cordMaterialPointAtTime;
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    baseY,
    cordMarkerCount,
    cordMarkerMaterialDistances,
    cordPlaneZ,
    cordRadius,
    cordTubularSegments,
    crankEyeLocal: crankEyeLocal.clone(),
    crankEyeRadius,
    crankPinBackZ,
    crankPinCenterZ,
    crankPinFrontZ,
    crankPinLength,
    crankRadius,
    cyclePeriod,
    derivativeAngleStep,
    diskAngularSpeed,
    diskCenter: diskCenter.clone(),
    diskCenterZ,
    diskDepth,
    diskFrontZ,
    diskHubRadius,
    diskRadius,
    frameLeftX,
    frameRightX,
    frameZ,
    fullTurn,
    guideCenter: guideCenter.clone(),
    guidePitchRadius,
    guideWidth,
    nominalCordLength,
    returnStrokeFraction,
    rootIterations,
    sourceCrankAngle,
    sourceCrankEye: sourceCrankEye.clone(),
    sourceCrankEyeRadius,
    sourceCrankRadius,
    sourceCyclesPerMinute,
    sourceDiskCenter: sourceDiskCenter.clone(),
    sourceDiskHubRadius,
    sourceDiskRadius,
    sourceGroundY,
    sourceGuideCenter: sourceGuideCenter.clone(),
    sourceGuidePitchRadius,
    sourceImageHeight,
    sourceImageWidth,
    sourceRasterCrankEye: sourceRasterCrankEye.clone(),
    sourceRasterDiskCenter: sourceRasterDiskCenter.clone(),
    sourceRasterDiskRadius,
    sourceRasterGroundY,
    sourceRasterGuideCenter: sourceRasterGuideCenter.clone(),
    sourceRasterGuidePitchRadius,
    sourceRasterTreadleEye: sourceRasterTreadleEye.clone(),
    sourceRasterTreadleFoot: sourceRasterTreadleFoot.clone(),
    sourceRasterTreadlePivot: sourceRasterTreadlePivot.clone(),
    sourceScale,
    sourceTreadleAngle,
    sourceTreadleEye: sourceTreadleEye.clone(),
    sourceTreadleEyeRadius,
    sourceTreadleFootRadius,
    sourceTreadlePivot: sourceTreadlePivot.clone(),
    sourceUnitsPerPixel,
    treadleAngleLowerLimit,
    treadleAngleUpperLimit,
    treadleAngularStroke,
    treadleCenterZ,
    treadleDepth,
    treadleEyePinCenterZ,
    treadleEyePinLength,
    treadleEyeRadius,
    treadleFootArcStroke,
    treadleFootRadius,
    treadleFrontZ,
    treadlePivot: treadlePivot.clone(),
    treadlePivotShaftLength,
    treadleThickness,
    workingStrokeFraction,
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtDiskAngle = stateAtDiskAngle;
  root.userData.stateAtDiskKinematics = stateAtDiskKinematics;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    diskRotor.rotation.z = state.diskAngle;
    disk.userData.angularSpeed = state.diskAngularVelocity;
    diskShaft.userData.angularSpeed = state.diskAngularVelocity;
    crankEye.userData.angularSpeed = state.diskAngularVelocity;
    treadle.rotation.z = state.treadleAngle;
    treadle.userData.angularSpeed = state.treadleAngularSpeed;
    treadle.userData.angularAcceleration = state.treadleAngularAcceleration;
    guidePulleyRotor.rotation.z = state.guidePulleyAngle;
    guidePulley.userData.angularSpeed = state.guidePulleyAngularSpeed;
    guidePulley.userData.angularAcceleration =
      state.guidePulleyAngularAcceleration;
    cord.userData.setCurve(state.cordCurve);
    cord.userData.updateDistance(0);
    root.userData.ropeContacts = [{
      arc: state.cordCurve.curves[1],
      axis: Z_AXIS.clone(),
      object: guidePulley,
      radius: guidePitchRadius,
    }];
    root.userData.contacts = {
      cordCrankAnchor: {
        attached: true,
        position: state.crankPoint.clone(),
      },
      cordGuidePulley: {
        arc: state.cordCurve.curves[1],
        axis: Z_AXIS.clone(),
        entry: state.guideEntry.clone(),
        exit: state.guideExit.clone(),
        noSlipSpeedError: state.guidePulleyNoSlipSpeedError,
        pitchRadius: guidePitchRadius,
        tangentAlignment: Math.min(
          state.startTangencyAlignment,
          state.endTangencyAlignment,
        ),
      },
      cordTreadleAnchor: {
        attached: true,
        position: state.treadleEyePoint.clone(),
      },
      treadlePivot: {
        axis: Z_AXIS.clone(),
        centerError: Math.hypot(
          treadle.position.x - treadlePivot.x,
          treadle.position.y - treadlePivot.y,
        ),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  const model = finish(root, update, new THREE.Vector3(7.2, 4.8, 13.8));
  for (const object of [
    cameraEnvelope,
    crankCordKnot,
    diskIndex,
    guideIndex,
    treadleCordKnot,
    treadleIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return model;
}

function springReturnTreadleFullWrapPulleyMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Measurements from Brown's 525 px plate. The band is one open piece with
  // both ends attached: spring eye -> one complete clockwise pulley wrap ->
  // treadle eye. Keeping the winding number explicit is important here; a
  // shortest-path arc would erase the defining full turn around the pulley.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterPulleyCenter = new THREE.Vector2(319, 252);
  const sourceRasterPulleyPitchRadius = 43;
  const sourceRasterSpringRoot = new THREE.Vector2(32, 181);
  const sourceRasterSpringEye = new THREE.Vector2(362, 104);
  const sourceRasterSpringTail = new THREE.Vector2(420, 129);
  const sourceRasterTreadlePivot = new THREE.Vector2(160, 413);
  const sourceRasterTreadleEye = new THREE.Vector2(360, 381);
  const sourceRasterTreadleFoot = new THREE.Vector2(453, 376);
  const sourceRasterGroundY = 459;
  const sourceUnitsPerPixel = 0.018;
  const sourcePointFromRaster = (point) => new THREE.Vector2(
    (point.x - sourceRasterPulleyCenter.x) * sourceUnitsPerPixel,
    (sourceRasterPulleyCenter.y - point.y) * sourceUnitsPerPixel,
  );
  const pulleyCenter = new THREE.Vector2(0, 0);
  const pulleyPitchRadius = sourceRasterPulleyPitchRadius
    * sourceUnitsPerPixel;
  const sourceSpringRoot = sourcePointFromRaster(sourceRasterSpringRoot);
  const sourceSpringEye = new THREE.Vector2(
    pulleyCenter.x + pulleyPitchRadius,
    sourcePointFromRaster(sourceRasterSpringEye).y,
  );
  const sourceSpringTail = sourcePointFromRaster(sourceRasterSpringTail);
  const sourceSpringTailVector = sourceSpringTail.clone().sub(
    sourceSpringEye,
  );
  const treadlePivot = sourcePointFromRaster(sourceRasterTreadlePivot);
  const sourceTreadleEye = sourcePointFromRaster(sourceRasterTreadleEye);
  const sourceTreadleEyeVector = sourceTreadleEye.clone().sub(treadlePivot);
  const sourceTreadleFoot = sourcePointFromRaster(sourceRasterTreadleFoot);
  const sourceTreadleFootVector = sourceTreadleFoot.clone().sub(treadlePivot);
  const treadleEyeRadius = sourceTreadleEyeVector.length();
  const treadleFootRadius = sourceTreadleFootVector.length();
  const sourceTreadleAngle = Math.atan2(
    sourceTreadleFootVector.y,
    sourceTreadleFootVector.x,
  );
  const baseY = (
    sourceRasterPulleyCenter.y - sourceRasterGroundY
  ) * sourceUnitsPerPixel;
  const treadleAngularStroke = 0.24;
  const cyclePeriod = 4;
  const cycleAngularSpeed = fullTurn / cyclePeriod;
  const springStiffness = 1.7;

  const pulleyCenterZ = 0.48;
  const pulleyWidth = 0.42;
  const bandPlaneZ = pulleyCenterZ;
  const bandRadius = 0.048;
  const bandMarkerCount = 9;
  const bandTubularSegments = 320;
  const treadleCenterZ = 0.05;
  const treadleDepth = 0.30;
  const treadleThickness = 0.19;
  const treadleFrontZ = treadleCenterZ + treadleDepth / 2;
  const springCenterZ = 0.05;
  const springDepth = 0.30;
  const springThickness = 0.15;
  const frameZ = -0.68;
  const springClampDepth = 1.08;

  const rotateVector2 = (vector, angle) => new THREE.Vector2(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  );
  const clockwiseTangent = (point) => new THREE.Vector2(
    point.y - pulleyCenter.y,
    -(point.x - pulleyCenter.x),
  ).multiplyScalar(1 / pulleyPitchRadius);
  const tangentCandidates = (external) => {
    const offset = external.clone().sub(pulleyCenter);
    const distanceSquared = offset.lengthSq();
    if (distanceSquared <= pulleyPitchRadius ** 2) {
      throw new RangeError('Movement 160 band endpoint entered its pulley.');
    }
    const base = offset.clone().multiplyScalar(
      pulleyPitchRadius ** 2 / distanceSquared,
    );
    const side = new THREE.Vector2(-offset.y, offset.x).multiplyScalar(
      pulleyPitchRadius * Math.sqrt(
        distanceSquared - pulleyPitchRadius ** 2,
      ) / distanceSquared,
    );
    return [
      pulleyCenter.clone().add(base).add(side),
      pulleyCenter.clone().add(base).sub(side),
    ];
  };
  const selectClockwiseExitTangency = (external) => {
    const selections = tangentCandidates(external).map((point) => {
      const spanTangent = external.clone().sub(point).normalize();
      return {
        alignment: spanTangent.dot(clockwiseTangent(point)),
        point,
        spanTangent,
      };
    });
    selections.sort((left, right) => right.alignment - left.alignment);
    return selections[0];
  };
  const treadlePointAtOffset = (sourceVector, treadleOffset) => (
    treadlePivot.clone().add(rotateVector2(sourceVector, treadleOffset))
  );
  const lowerRouteAtTreadleOffset = (treadleOffset) => {
    const treadleEyePoint2 = treadlePointAtOffset(
      sourceTreadleEyeVector,
      treadleOffset,
    );
    const exit = selectClockwiseExitTangency(treadleEyePoint2);
    const exitAngle = Math.atan2(
      exit.point.y - pulleyCenter.y,
      exit.point.x - pulleyCenter.x,
    );
    const principalExitAngle = Math.atan2(
      Math.sin(exitAngle),
      Math.cos(exitAngle),
    );
    const wrapSweep = principalExitAngle - fullTurn;
    const wrapLength = -wrapSweep * pulleyPitchRadius;
    const treadleSpanLength = exit.point.distanceTo(treadleEyePoint2);
    return {
      exitAlignment: exit.alignment,
      exitAngle,
      exitTangent2: exit.spanTangent,
      pulleyExit2: exit.point,
      treadleEyePoint2,
      treadleSpanLength,
      wrapLength,
      wrapSweep,
    };
  };
  const sourceLowerRoute = lowerRouteAtTreadleOffset(0);
  const sourceSpringSpanLength = sourceSpringEye.y - pulleyCenter.y;
  const nominalBandLength = sourceSpringSpanLength
    + sourceLowerRoute.wrapLength
    + sourceLowerRoute.treadleSpanLength;
  const routeAtTreadleOffset = (treadleOffset) => {
    const lower = lowerRouteAtTreadleOffset(treadleOffset);
    const springSpanLength = nominalBandLength
      - lower.wrapLength
      - lower.treadleSpanLength;
    const springEyePoint2 = new THREE.Vector2(
      pulleyCenter.x + pulleyPitchRadius,
      pulleyCenter.y + springSpanLength,
    );
    const pulleyEntry2 = new THREE.Vector2(
      pulleyCenter.x + pulleyPitchRadius,
      pulleyCenter.y,
    );
    return {
      ...lower,
      pulleyEntry2,
      springEyePoint2,
      springSpanLength,
      totalLength: springSpanLength
        + lower.wrapLength
        + lower.treadleSpanLength,
    };
  };

  class FullWrapBandCurve extends THREE.Curve {
    constructor(route) {
      super();
      const toPoint3 = (point) => new THREE.Vector3(
        point.x,
        point.y,
        bandPlaneZ,
      );
      this.startPoint = toPoint3(route.springEyePoint2);
      this.pulleyEntry = toPoint3(route.pulleyEntry2);
      this.pulleyExit = toPoint3(route.pulleyExit2);
      this.endPoint = toPoint3(route.treadleEyePoint2);
      this.wrap = new CircularArcCurve3(
        new THREE.Vector3(pulleyCenter.x, pulleyCenter.y, bandPlaneZ),
        this.pulleyEntry.clone().sub(new THREE.Vector3(
          pulleyCenter.x,
          pulleyCenter.y,
          bandPlaneZ,
        )),
        Z_AXIS,
        route.wrapSweep,
      );
      this.curves = [
        new THREE.LineCurve3(this.startPoint, this.pulleyEntry),
        this.wrap,
        new THREE.LineCurve3(this.pulleyExit, this.endPoint),
      ];
      this.segmentLengths = [
        route.springSpanLength,
        route.wrapLength,
        route.treadleSpanLength,
      ];
      this.transitionDistances = [
        route.springSpanLength,
        route.springSpanLength + route.wrapLength,
      ];
      this.totalLength = route.totalLength;
      this.closed = false;
    }

    segmentAtDistance(rawDistance) {
      const distance = THREE.MathUtils.clamp(
        rawDistance,
        0,
        this.totalLength,
      );
      let segmentStart = 0;
      for (let index = 0; index < this.curves.length; index += 1) {
        const length = this.segmentLengths[index];
        if (distance <= segmentStart + length || index === 2) {
          return {
            curve: this.curves[index],
            index,
            localFraction: length > 0
              ? THREE.MathUtils.clamp(
                (distance - segmentStart) / length,
                0,
                1,
              )
              : 0,
          };
        }
        segmentStart += length;
      }
      throw new RangeError('Movement 160 band segment lookup failed.');
    }

    getPoint(fraction, target = new THREE.Vector3()) {
      return this.getPointAtDistance(fraction * this.totalLength, target);
    }

    getPointAt(fraction, target = new THREE.Vector3()) {
      return this.getPoint(fraction, target);
    }

    getPointAtDistance(distance, target = new THREE.Vector3()) {
      const segment = this.segmentAtDistance(distance);
      return segment.curve.getPoint(segment.localFraction, target);
    }

    getTangent(fraction, target = new THREE.Vector3()) {
      return this.getTangentAtDistance(fraction * this.totalLength, target);
    }

    getTangentAt(fraction, target = new THREE.Vector3()) {
      return this.getTangent(fraction, target);
    }

    getTangentAtDistance(distance, target = new THREE.Vector3()) {
      const segment = this.segmentAtDistance(distance);
      return segment.curve.getTangent(segment.localFraction, target);
    }

    getLength() {
      return this.totalLength;
    }
  }

  const bandCurveFromRoute = (route) => new FullWrapBandCurve(route);
  const stateAtCyclePhase = (phase) => {
    const cycleAngle = fullTurn * phase;
    const treadleOffset = -0.5 * treadleAngularStroke
      * (1 - Math.cos(cycleAngle));
    const treadleAngularSpeed = -0.5 * treadleAngularStroke
      * cycleAngularSpeed * Math.sin(cycleAngle);
    const treadleAngularAcceleration = -0.5 * treadleAngularStroke
      * cycleAngularSpeed ** 2 * Math.cos(cycleAngle);
    const route = routeAtTreadleOffset(treadleOffset);
    const treadleEyeRadiusVector2 = route.treadleEyePoint2.clone().sub(
      treadlePivot,
    );
    const treadleEyePerpendicular2 = new THREE.Vector2(
      -treadleEyeRadiusVector2.y,
      treadleEyeRadiusVector2.x,
    );
    const treadleEyeVelocity2 = treadleEyePerpendicular2.clone()
      .multiplyScalar(treadleAngularSpeed);
    const treadleEyeAcceleration2 = treadleEyePerpendicular2.clone()
      .multiplyScalar(treadleAngularAcceleration)
      .addScaledVector(
        treadleEyeRadiusVector2,
        -(treadleAngularSpeed ** 2),
      );
    const treadleFootPoint2 = treadlePointAtOffset(
      sourceTreadleFootVector,
      treadleOffset,
    );
    const treadleFootRadiusVector2 = treadleFootPoint2.clone().sub(
      treadlePivot,
    );
    const treadleFootPerpendicular2 = new THREE.Vector2(
      -treadleFootRadiusVector2.y,
      treadleFootRadiusVector2.x,
    );
    const treadleFootVelocity2 = treadleFootPerpendicular2.clone()
      .multiplyScalar(treadleAngularSpeed);
    const treadleFootAcceleration2 = treadleFootPerpendicular2.clone()
      .multiplyScalar(treadleAngularAcceleration)
      .addScaledVector(
        treadleFootRadiusVector2,
        -(treadleAngularSpeed ** 2),
      );
    const treadleCordSpeed = treadleEyeVelocity2.dot(
      route.exitTangent2,
    );
    const springEyeVelocityY = -treadleCordSpeed;

    const pulleyToEye2 = route.treadleEyePoint2.clone().sub(pulleyCenter);
    const pulleyToEyeDistance = pulleyToEye2.length();
    const eyeRadialSpeed = pulleyToEye2.dot(
      treadleEyeVelocity2,
    ) / pulleyToEyeDistance;
    const eyePolarSpeed = (
      pulleyToEye2.x * treadleEyeVelocity2.y
        - pulleyToEye2.y * treadleEyeVelocity2.x
    ) / pulleyToEyeDistance ** 2;
    const tangentLength = route.treadleSpanLength;
    const exitAngleSpeed = eyePolarSpeed
      + pulleyPitchRadius * eyeRadialSpeed
        / (pulleyToEyeDistance * tangentLength);
    const exitRadial2 = route.pulleyExit2.clone().sub(pulleyCenter)
      .multiplyScalar(1 / pulleyPitchRadius);
    const exitTangentDerivative2 = exitRadial2.clone()
      .multiplyScalar(exitAngleSpeed);
    const treadleCordAcceleration = treadleEyeAcceleration2.dot(
      route.exitTangent2,
    ) + treadleEyeVelocity2.dot(exitTangentDerivative2);
    const springEyeAccelerationY = -treadleCordAcceleration;
    const bandCurve = bandCurveFromRoute(route);
    const springEyePoint = new THREE.Vector3(
      route.springEyePoint2.x,
      route.springEyePoint2.y,
      bandPlaneZ,
    );
    const springEyeVelocity = new THREE.Vector3(
      0,
      springEyeVelocityY,
      0,
    );
    const springEyeAcceleration = new THREE.Vector3(
      0,
      springEyeAccelerationY,
      0,
    );
    const treadleEyePoint = new THREE.Vector3(
      route.treadleEyePoint2.x,
      route.treadleEyePoint2.y,
      bandPlaneZ,
    );
    const treadleFootPoint = new THREE.Vector3(
      treadleFootPoint2.x,
      treadleFootPoint2.y,
      treadleCenterZ,
    );
    const springDeflection = sourceSpringEye.y - route.springEyePoint2.y;
    const bandSpeed = treadleCordSpeed;
    const pulleyAngle = (
      route.springSpanLength - sourceSpringSpanLength
    ) / pulleyPitchRadius;
    const pulleyAngularSpeed = -bandSpeed / pulleyPitchRadius;
    const pulleyAngularAcceleration = springEyeAccelerationY
      / pulleyPitchRadius;
    const toVector3 = (vector) => new THREE.Vector3(vector.x, vector.y, 0);
    const stage = Math.abs(treadleAngularSpeed) < 1e-10
      ? Math.cos(cycleAngle) >= 0
        ? 'raised-treadle-awaiting-foot-pressure'
        : 'depressed-treadle-spring-ready-to-return'
      : treadleAngularSpeed < 0
        ? 'foot-depresses-treadle-and-deflects-spring'
        : 'spring-elevates-treadle-for-next-stroke';
    return {
      bandAcceleration: treadleCordAcceleration,
      bandCount: 1,
      bandCurve,
      bandLength: route.totalLength,
      bandLengthError: route.totalLength - nominalBandLength,
      bandSpeed,
      bandSpeedConstraintError: -springEyeVelocityY - treadleCordSpeed,
      bandTransitionDistances: bandCurve.transitionDistances.slice(),
      cycleAngle,
      exitAngle: route.exitAngle,
      exitAngleSpeed,
      exitTangencyAlignment: route.exitAlignment,
      pulleyAngle,
      pulleyAngularAcceleration,
      pulleyAngularSpeed,
      pulleyEntry: bandCurve.pulleyEntry.clone(),
      pulleyExit: bandCurve.pulleyExit.clone(),
      pulleyNoSlipAccelerationError: pulleyAngularAcceleration
        * pulleyPitchRadius + treadleCordAcceleration,
      pulleyNoSlipSpeedError: pulleyAngularSpeed
        * pulleyPitchRadius + bandSpeed,
      pulleyWrapLength: route.wrapLength,
      pulleyWrapSweep: route.wrapSweep,
      springDeflection,
      springElasticEnergy: 0.5 * springStiffness * springDeflection ** 2,
      springEyeAcceleration,
      springEyePoint,
      springEyeVelocity,
      springRestoringForce: springStiffness * springDeflection,
      springSpanLength: route.springSpanLength,
      stage,
      treadleAngle: sourceTreadleAngle + treadleOffset,
      treadleAngularAcceleration,
      treadleAngularSpeed,
      treadleEyeAcceleration: toVector3(treadleEyeAcceleration2),
      treadleEyePoint,
      treadleEyeRadiusError: treadleEyeRadiusVector2.length()
        - treadleEyeRadius,
      treadleEyeRadialAccelerationError: treadleEyeRadiusVector2.dot(
        treadleEyeAcceleration2,
      ) + treadleEyeVelocity2.lengthSq(),
      treadleEyeRadialVelocityError: treadleEyeRadiusVector2.dot(
        treadleEyeVelocity2,
      ),
      treadleEyeVelocity: toVector3(treadleEyeVelocity2),
      treadleFootAcceleration: toVector3(treadleFootAcceleration2),
      treadleFootArcRadiusError: treadleFootRadiusVector2.length()
        - treadleFootRadius,
      treadleFootPoint,
      treadleFootRadialAccelerationError: treadleFootRadiusVector2.dot(
        treadleFootAcceleration2,
      ) + treadleFootVelocity2.lengthSq(),
      treadleFootRadialVelocityError: treadleFootRadiusVector2.dot(
        treadleFootVelocity2,
      ),
      treadleFootVelocity: toVector3(treadleFootVelocity2),
      treadleOffset,
      treadleSpanLength: route.treadleSpanLength,
    };
  };
  const stateAtTime = (time) => stateAtCyclePhase(time / cyclePeriod);
  const canonicalTimes = {
    depressed: cyclePeriod / 2,
    nextRaised: cyclePeriod,
    pressMidstroke: cyclePeriod / 4,
    raised: 0,
    returnMidstroke: cyclePeriod * 3 / 4,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );
  const maximumSpringDeflection = canonicalStates.depressed.springDeflection;
  const pulleyAngularStroke = maximumSpringDeflection / pulleyPitchRadius;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.68,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const pulley = makePulley({
    color: PALETTE.driven,
    grooves: 1,
    radius: pulleyPitchRadius,
    spokes: 5,
    width: pulleyWidth,
  });
  pulley.position.set(pulleyCenter.x, pulleyCenter.y, pulleyCenterZ);
  pulley.userData.role = 'single-fixed-axis-pulley-driven-alternately-by-band';
  const pulleyRotor = pulley.userData.rotor;
  const pulleyIndex = makeBeam(
    new THREE.Vector3(
      pulleyPitchRadius * 0.22,
      0,
      pulleyWidth / 2 + 0.075,
    ),
    new THREE.Vector3(
      pulleyPitchRadius * 0.76,
      0,
      pulleyWidth / 2 + 0.075,
    ),
    { color: PALETTE.white, depth: 0.035, thickness: 0.07 },
  );
  pulleyIndex.userData.role =
    'white-index-showing-alternating-pulley-rotation';
  pulleyRotor.add(pulleyIndex);
  const pulleyShaft = cylinderAlongZ(0.15, 1.58, darkMaterial, 36);
  pulleyShaft.position.set(pulleyCenter.x, pulleyCenter.y, 0.02);
  pulleyShaft.userData.role = 'fixed-pulley-shaft';

  const treadle = new THREE.Group();
  treadle.position.set(treadlePivot.x, treadlePivot.y, 0);
  treadle.userData.axis = Z_AXIS.clone();
  treadle.userData.role = 'fixed-pivot-foot-depressed-treadle';
  const treadleBeam = makeBeam(
    new THREE.Vector3(0, 0, treadleCenterZ),
    new THREE.Vector3(
      sourceTreadleFootVector.x,
      sourceTreadleFootVector.y,
      treadleCenterZ,
    ),
    {
      color: PALETTE.driver,
      depth: treadleDepth,
      thickness: treadleThickness,
    },
  );
  treadleBeam.userData.role = 'plate-proportioned-rigid-treadle-beam';
  const treadlePivotHub = cylinderAlongZ(0.28, 0.62, driverMaterial, 44);
  treadlePivotHub.position.z = treadleCenterZ;
  treadlePivotHub.userData.role = 'hub-rigid-with-treadle';
  const treadleEyeHub = cylinderAlongZ(0.19, 0.46, driverMaterial, 36);
  treadleEyeHub.position.set(
    sourceTreadleEyeVector.x,
    sourceTreadleEyeVector.y,
    treadleCenterZ + 0.06,
  );
  treadleEyeHub.userData.role = 'raised-band-eye-on-treadle';
  const treadleEyePinLength = bandPlaneZ - treadleCenterZ + 0.42;
  const treadleEyePin = cylinderAlongZ(
    0.082,
    treadleEyePinLength,
    darkMaterial,
    28,
  );
  treadleEyePin.position.set(
    sourceTreadleEyeVector.x,
    sourceTreadleEyeVector.y,
    (bandPlaneZ + treadleCenterZ) / 2,
  );
  treadleEyePin.userData.role = 'pin-joining-band-to-treadle-eye';
  const treadleEyeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.17, 0.036, 9, 36),
    darkMaterial,
  );
  treadleEyeRing.position.set(
    sourceTreadleEyeVector.x,
    sourceTreadleEyeVector.y,
    bandPlaneZ,
  );
  treadleEyeRing.userData.role = 'band-fastening-ring-on-treadle';
  const treadleBandKnot = new THREE.Mesh(
    new THREE.SphereGeometry(bandRadius * 1.65, 12, 9),
    indexMaterial,
  );
  treadleBandKnot.position.copy(treadleEyeRing.position);
  treadleBandKnot.userData.role = 'fixed-material-treadle-end-of-band';
  const footAngle = Math.atan2(
    sourceTreadleFootVector.y,
    sourceTreadleFootVector.x,
  );
  const treadleFootPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.94, 0.27, 0.42),
    driverMaterial,
  );
  treadleFootPlate.position.set(
    sourceTreadleFootVector.x - 0.27 * Math.cos(footAngle),
    sourceTreadleFootVector.y - 0.27 * Math.sin(footAngle) + 0.035,
    treadleCenterZ,
  );
  treadleFootPlate.rotation.z = footAngle;
  treadleFootPlate.userData.role = 'broad-pressure-end-of-treadle';
  const treadleIndex = makeBeam(
    new THREE.Vector3(
      sourceTreadleFootVector.x * 0.66,
      sourceTreadleFootVector.y * 0.66 + 0.075,
      treadleFrontZ + 0.055,
    ),
    new THREE.Vector3(
      sourceTreadleFootVector.x * 0.82,
      sourceTreadleFootVector.y * 0.82 + 0.075,
      treadleFrontZ + 0.055,
    ),
    { color: PALETTE.white, depth: 0.035, thickness: 0.06 },
  );
  treadleIndex.userData.role = 'white-index-on-rocking-treadle';
  treadle.add(
    treadleBeam,
    treadlePivotHub,
    treadleEyeHub,
    treadleEyePin,
    treadleEyeRing,
    treadleBandKnot,
    treadleFootPlate,
    treadleIndex,
  );
  const treadlePivotShaft = cylinderAlongZ(0.14, 1.34, darkMaterial, 34);
  treadlePivotShaft.position.set(treadlePivot.x, treadlePivot.y, -0.03);
  treadlePivotShaft.userData.role = 'fixed-treadle-pivot-shaft';

  const createDynamicLeafSpring = () => {
    const segmentCount = 72;
    const positions = new Float32Array((segmentCount + 1) * 4 * 3);
    const indices = [];
    for (let segment = 0; segment < segmentCount; segment += 1) {
      const current = segment * 4;
      const next = (segment + 1) * 4;
      indices.push(
        current, next, current + 1,
        next, next + 1, current + 1,
        current + 2, current + 3, next + 2,
        next + 2, current + 3, next + 3,
        current, current + 2, next,
        next, current + 2, next + 2,
        current + 1, next + 1, current + 3,
        next + 1, next + 3, current + 3,
      );
    }
    indices.push(
      0, 1, 2,
      2, 1, 3,
      segmentCount * 4, segmentCount * 4 + 2, segmentCount * 4 + 1,
      segmentCount * 4 + 2, segmentCount * 4 + 3,
      segmentCount * 4 + 1,
    );
    const geometry = new THREE.BufferGeometry();
    const positionAttribute = new THREE.BufferAttribute(positions, 3);
    positionAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', positionAttribute);
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, driverMaterial);
    mesh.userData.role = 'flexing-cantilever-return-leaf-spring';
    const rootPoint = new THREE.Vector3(
      sourceSpringRoot.x,
      sourceSpringRoot.y,
      springCenterZ,
    );
    const updateTip = (tipY) => {
      const tipPoint = new THREE.Vector3(
        sourceSpringEye.x,
        tipY,
        springCenterZ,
      );
      const control1 = new THREE.Vector3(
        sourceSpringRoot.x + 1.72,
        sourceSpringRoot.y + 0.72,
        springCenterZ,
      );
      const control2 = new THREE.Vector3(
        sourceSpringEye.x - 1.42,
        tipY + 0.20,
        springCenterZ,
      );
      const curve = new THREE.CubicBezierCurve3(
        rootPoint,
        control1,
        control2,
        tipPoint,
      );
      const halfThickness = springThickness / 2;
      const halfDepth = springDepth / 2;
      for (let index = 0; index <= segmentCount; index += 1) {
        const fraction = index / segmentCount;
        const center = curve.getPoint(fraction);
        const tangent = curve.getTangent(fraction);
        const normal = new THREE.Vector3(-tangent.y, tangent.x, 0)
          .normalize();
        const upper = center.clone().addScaledVector(normal, halfThickness);
        const lower = center.clone().addScaledVector(normal, -halfThickness);
        const offset = index * 12;
        positions.set([upper.x, upper.y, springCenterZ + halfDepth], offset);
        positions.set([lower.x, lower.y, springCenterZ + halfDepth], offset + 3);
        positions.set([upper.x, upper.y, springCenterZ - halfDepth], offset + 6);
        positions.set([lower.x, lower.y, springCenterZ - halfDepth], offset + 9);
      }
      positionAttribute.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      mesh.userData.centerline = curve;
      mesh.userData.tipPoint = tipPoint;
    };
    mesh.userData.rootPoint = rootPoint;
    mesh.userData.segmentCount = segmentCount;
    mesh.userData.setTipY = updateTip;
    updateTip(sourceSpringEye.y);
    return mesh;
  };
  const leafSpring = createDynamicLeafSpring();
  const springTail = makeBeam(
    new THREE.Vector3(
      sourceSpringEye.x,
      sourceSpringEye.y,
      springCenterZ,
    ),
    new THREE.Vector3(
      sourceSpringTail.x,
      sourceSpringTail.y,
      springCenterZ,
    ),
    {
      color: PALETTE.driver,
      depth: springDepth,
      thickness: springThickness,
    },
  );
  springTail.userData.role = 'short-free-tail-beyond-spring-band-eye';
  const springEyePinLength = bandPlaneZ - springCenterZ + 0.40;
  const springEyePin = cylinderAlongZ(
    0.08,
    springEyePinLength,
    darkMaterial,
    28,
  );
  springEyePin.position.set(
    sourceSpringEye.x,
    sourceSpringEye.y,
    (bandPlaneZ + springCenterZ) / 2,
  );
  springEyePin.userData.role = 'pin-joining-band-to-leaf-spring';
  const springEyeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.17, 0.036, 9, 36),
    darkMaterial,
  );
  springEyeRing.position.set(
    sourceSpringEye.x,
    sourceSpringEye.y,
    bandPlaneZ,
  );
  springEyeRing.userData.role = 'band-fastening-ring-on-return-spring';
  const springBandKnot = new THREE.Mesh(
    new THREE.SphereGeometry(bandRadius * 1.65, 12, 9),
    indexMaterial,
  );
  springBandKnot.position.copy(springEyeRing.position);
  springBandKnot.userData.role = 'fixed-material-spring-end-of-band';

  const sourceBandCurve = bandCurveFromRoute(routeAtTreadleOffset(0));
  const band = makeDynamicMovingBelt(sourceBandCurve, {
    closed: false,
    color: PALETTE.belt,
    markerColor: PALETTE.white,
    markerCount: bandMarkerCount,
    radius: bandRadius,
    tubularSegments: bandTubularSegments,
  });
  band.userData.bandCount = 1;
  band.userData.closed = false;
  band.userData.mechanismBelt = true;
  band.userData.role =
    'one-open-constant-length-band-with-one-full-pulley-wrap';
  const bandMarkers = band.children.filter((object) => (
    object.userData.isFlowMarker === true
  ));
  const bandMesh = band.children.find((object) => (
    object.geometry?.type === 'TubeGeometry'
  ));
  const bandMarkerMaterialDistances = bandMarkers.map((marker, index) => {
    const distance = nominalBandLength * (index + 1)
      / (bandMarkerCount + 1);
    marker.userData.materialDistance = distance;
    marker.userData.role = `fixed-material-band-marker-${index + 1}`;
    return distance;
  });
  bandMesh.userData.role = 'single-visible-full-wrap-band-tube';

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'fixed-rear-supports-for-treadle-pulley-and-spring';
  const baseRail = makeBeam(
    new THREE.Vector3(treadlePivot.x - 1.10, baseY, frameZ),
    new THREE.Vector3(sourceTreadleFoot.x + 0.72, baseY, frameZ),
    { color: PALETTE.frame, depth: 0.25, thickness: 0.18 },
  );
  baseRail.userData.role = 'ground-level-fixed-base-rail';
  const treadlePedestal = makeBeam(
    new THREE.Vector3(treadlePivot.x, baseY, frameZ),
    new THREE.Vector3(treadlePivot.x, treadlePivot.y, frameZ),
    { color: PALETTE.frame, depth: 0.24, thickness: 0.34 },
  );
  treadlePedestal.userData.role = 'fixed-treadle-pivot-pedestal';
  const treadlePedestalFoot = new THREE.Mesh(
    new THREE.BoxGeometry(1.10, 0.20, 0.48),
    frameMaterial,
  );
  treadlePedestalFoot.position.set(treadlePivot.x, baseY + 0.09, frameZ);
  treadlePedestalFoot.userData.role = 'treadle-pedestal-foot';
  const treadleBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.065, 10, 42),
    frameMaterial,
  );
  treadleBearing.position.set(
    treadlePivot.x,
    treadlePivot.y,
    frameZ + 0.04,
  );
  treadleBearing.userData.role = 'fixed-rear-treadle-bearing';
  const pulleyPost = makeBeam(
    new THREE.Vector3(pulleyCenter.x - 0.18, baseY, frameZ),
    new THREE.Vector3(pulleyCenter.x, pulleyCenter.y, frameZ),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.14 },
  );
  pulleyPost.userData.role = 'rear-fixed-pulley-bearing-post';
  const pulleyBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.065, 10, 42),
    frameMaterial,
  );
  pulleyBearing.position.set(pulleyCenter.x, pulleyCenter.y, frameZ + 0.04);
  pulleyBearing.userData.role = 'fixed-rear-pulley-bearing';
  const springClamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.82, springClampDepth),
    frameMaterial,
  );
  springClamp.position.set(
    sourceSpringRoot.x - 0.10,
    sourceSpringRoot.y,
    (frameZ + springCenterZ) / 2,
  );
  springClamp.userData.role = 'fixed-left-cantilever-spring-clamp';
  fixedFrame.add(
    baseRail,
    treadlePedestal,
    treadlePedestalFoot,
    treadleBearing,
    pulleyPost,
    pulleyBearing,
    springClamp,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(9.8, 7.4, 2.6),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-1.10, -0.48, 0.02);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-full-treadle-and-spring-strokes';

  root.add(
    cameraEnvelope,
    fixedFrame,
    pulleyShaft,
    treadlePivotShaft,
    pulley,
    treadle,
    leafSpring,
    springTail,
    springEyePin,
    springEyeRing,
    springBandKnot,
    band,
  );

  const bandMaterialPointAtCyclePhase = (phase, materialDistance) => {
    const state = stateAtCyclePhase(phase);
    const distance = THREE.MathUtils.clamp(
      materialDistance,
      0,
      nominalBandLength,
    );
    const segment = state.bandCurve.segmentAtDistance(distance);
    return {
      distance,
      position: state.bandCurve.getPointAtDistance(distance),
      region: [
        'spring-to-pulley-straight-span',
        'one-complete-clockwise-pulley-wrap',
        'pulley-to-treadle-straight-span',
      ][segment.index],
      tangent: state.bandCurve.getTangentAtDistance(distance),
    };
  };
  const bandMaterialPointAtTime = (time, materialDistance) => (
    bandMaterialPointAtCyclePhase(time / cyclePeriod, materialDistance)
  );

  root.userData.mechanism =
    'spring-return-treadle-single-full-wrap-band-alternating-pulley';
  root.userData.cameraDistanceScale = 1.01;
  root.userData.bandContacts = [{
    arc: sourceBandCurve.curves[1],
    axis: Z_AXIS.clone(),
    object: pulley,
    radius: pulleyPitchRadius,
    windingNumber: -1,
  }];
  root.userData.blocks = {
    band,
    bandMarkers,
    bandMesh,
    baseRail,
    cameraEnvelope,
    fixedFrame,
    leafSpring,
    pulley,
    pulleyBearing,
    pulleyIndex,
    pulleyPost,
    pulleyRotor,
    pulleyShaft,
    springBandKnot,
    springClamp,
    springEyePin,
    springEyeRing,
    springTail,
    treadle,
    treadleBandKnot,
    treadleBeam,
    treadleBearing,
    treadleEyeHub,
    treadleEyePin,
    treadleEyeRing,
    treadleFootPlate,
    treadleIndex,
    treadlePedestal,
    treadlePedestalFoot,
    treadlePivotHub,
    treadlePivotShaft,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.bandMaterialPointAtCyclePhase =
    bandMaterialPointAtCyclePhase;
  root.userData.bandMaterialPointAtTime = bandMaterialPointAtTime;
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    bandMarkerCount,
    bandMarkerMaterialDistances,
    bandPlaneZ,
    bandRadius,
    bandTubularSegments,
    baseY,
    cycleAngularSpeed,
    cyclePeriod,
    frameZ,
    fullTurn,
    maximumSpringDeflection,
    nominalBandLength,
    pulleyAngularStroke,
    pulleyCenter: pulleyCenter.clone(),
    pulleyCenterZ,
    pulleyPitchRadius,
    pulleyWidth,
    sourceImageHeight,
    sourceImageWidth,
    sourceRasterGroundY,
    sourceRasterPulleyCenter: sourceRasterPulleyCenter.clone(),
    sourceRasterPulleyPitchRadius,
    sourceRasterSpringEye: sourceRasterSpringEye.clone(),
    sourceRasterSpringRoot: sourceRasterSpringRoot.clone(),
    sourceRasterSpringTail: sourceRasterSpringTail.clone(),
    sourceRasterTreadleEye: sourceRasterTreadleEye.clone(),
    sourceRasterTreadleFoot: sourceRasterTreadleFoot.clone(),
    sourceRasterTreadlePivot: sourceRasterTreadlePivot.clone(),
    sourceSpringEye: sourceSpringEye.clone(),
    sourceSpringRoot: sourceSpringRoot.clone(),
    sourceSpringSpanLength,
    sourceSpringTail: sourceSpringTail.clone(),
    sourceSpringTailVector: sourceSpringTailVector.clone(),
    sourceTreadleAngle,
    sourceTreadleEye: sourceTreadleEye.clone(),
    sourceTreadleEyeVector: sourceTreadleEyeVector.clone(),
    sourceTreadleFoot: sourceTreadleFoot.clone(),
    sourceTreadleFootVector: sourceTreadleFootVector.clone(),
    sourceUnitsPerPixel,
    springClampDepth,
    springCenterZ,
    springDepth,
    springStiffness,
    springThickness,
    treadleAngularStroke,
    treadleCenterZ,
    treadleDepth,
    treadleEyePinLength,
    treadleEyeRadius,
    treadleFootRadius,
    treadleFrontZ,
    treadlePivot: treadlePivot.clone(),
    treadleThickness,
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    treadle.rotation.z = state.treadleOffset;
    treadle.userData.angularAcceleration = state.treadleAngularAcceleration;
    treadle.userData.angularSpeed = state.treadleAngularSpeed;
    pulleyRotor.rotation.z = state.pulleyAngle;
    pulley.userData.angularAcceleration = state.pulleyAngularAcceleration;
    pulley.userData.angularSpeed = state.pulleyAngularSpeed;
    leafSpring.userData.setTipY(state.springEyePoint.y);
    springTail.userData.setEndpoints(
      new THREE.Vector3(
        state.springEyePoint.x,
        state.springEyePoint.y,
        springCenterZ,
      ),
      new THREE.Vector3(
        state.springEyePoint.x + sourceSpringTailVector.x,
        state.springEyePoint.y + sourceSpringTailVector.y,
        springCenterZ,
      ),
    );
    for (const object of [springEyePin, springEyeRing, springBandKnot]) {
      object.position.y = state.springEyePoint.y;
    }
    band.userData.setCurve(state.bandCurve);
    band.userData.updateDistance(0);
    root.userData.bandContacts = [{
      arc: state.bandCurve.curves[1],
      axis: Z_AXIS.clone(),
      object: pulley,
      radius: pulleyPitchRadius,
      windingNumber: -1,
    }];
    root.userData.contacts = {
      bandPulley: {
        arc: state.bandCurve.curves[1],
        axis: Z_AXIS.clone(),
        entry: state.pulleyEntry.clone(),
        exit: state.pulleyExit.clone(),
        noSlipAccelerationError: state.pulleyNoSlipAccelerationError,
        noSlipSpeedError: state.pulleyNoSlipSpeedError,
        pitchRadius: pulleyPitchRadius,
        tangentAlignment: state.exitTangencyAlignment,
        windingNumber: -1,
      },
      bandSpringAnchor: {
        attached: true,
        position: state.springEyePoint.clone(),
      },
      bandTreadleAnchor: {
        attached: true,
        position: state.treadleEyePoint.clone(),
      },
      treadlePivot: {
        axis: Z_AXIS.clone(),
        centerError: Math.hypot(
          treadle.position.x - treadlePivot.x,
          treadle.position.y - treadlePivot.y,
        ),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  const model = finish(root, update, new THREE.Vector3(7.8, 4.8, 13.2));
  for (const object of [
    bandMarkers,
    cameraEnvelope,
    pulleyIndex,
    springBandKnot,
    treadleBandKnot,
    treadleIndex,
  ].flat()) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return model;
}

function quadratureTwinCrankShaftCoupling() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const quarterTurn = Math.PI / 2;
  const cyclePeriod = 4;
  const inputAngularSpeed = -fullTurn / cyclePeriod;
  const sourcePoseAngle = THREE.MathUtils.degToRad(70);

  // Brown's perspective view shows two parallel shafts, one above the other.
  // Each shaft carries a crank in each of two axial planes. Corresponding
  // cranks have equal throws and are joined by equal rods, so each plane is a
  // parallelogram four-bar. The second plane is exactly a quarter-turn out of
  // phase with the first: when either four-bar is at dead center, the other
  // has its maximum moment arm.
  const centerDistance = 5.8;
  const crankRadius = 1.08;
  const frontDiskRadius = 1.52;
  const frontDiskDepth = 0.34;
  const shaftRadius = 0.16;
  const shaftLength = 3.45;
  const hubRadius = 0.30;
  const hubDepth = 0.54;
  const upperShaftCenter = new THREE.Vector3(0, centerDistance / 2, 0);
  const lowerShaftCenter = new THREE.Vector3(0, -centerDistance / 2, 0);

  const frontDiskCenterZ = 0.68;
  const frontRodPlaneZ = 1.22;
  const rearCrankPlaneZ = -0.76;
  const rearRodPlaneZ = -1.20;
  const frontPinCenterZ = 0.96;
  const frontPinLength = 0.82;
  const rearPinCenterZ = -0.98;
  const rearPinLength = 0.68;
  const crankPinRadius = 0.105;
  const pinBearingClearance = 0.014;
  const rodEyeInnerRadius = crankPinRadius + pinBearingClearance + 0.035;
  const rodEyeOuterRadius = 0.245;
  const connectingRodDepth = 0.19;
  const rearCrankDepth = 0.23;
  const rearCrankEyeOuterRadius = 0.255;
  const rearCrankEyeInnerRadius = shaftRadius + 0.045;
  const rearCrankPinEyeInnerRadius = rodEyeInnerRadius;
  const bearingRadius = 0.34;
  const rearBearingZ = -1.56;
  const frontBearingZ = 0.28;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.60,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.60,
  });
  const rodMaterial = matte(PALETTE.brass, {
    metalness: 0.18,
    roughness: 0.54,
  });
  const linerMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.16,
    roughness: 0.64,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const twoEyePlateShape = (
    eyeSeparation,
    outerRadius,
    firstInnerRadius,
    secondInnerRadius = firstInnerRadius,
  ) => {
    const shape = horizontalCapsuleShape(outerRadius, eyeSeparation / 2);
    const firstHole = new THREE.Path();
    firstHole.absarc(
      -eyeSeparation / 2,
      0,
      firstInnerRadius,
      0,
      fullTurn,
      true,
    );
    const secondHole = new THREE.Path();
    secondHole.absarc(
      eyeSeparation / 2,
      0,
      secondInnerRadius,
      0,
      fullTurn,
      true,
    );
    shape.holes.push(firstHole, secondHole);
    return shape;
  };

  const makeConnectingRod = (role, planeZ) => {
    const group = new THREE.Group();
    group.userData.role = role;
    group.userData.nominalLength = centerDistance;
    group.userData.planeZ = planeZ;
    const body = new THREE.Mesh(
      centeredExtrusion(
        twoEyePlateShape(
          centerDistance,
          rodEyeOuterRadius,
          rodEyeInnerRadius,
        ),
        connectingRodDepth,
        0.007,
      ),
      rodMaterial,
    );
    body.userData.role = `${role}-rigid-two-eye-plate`;
    const liners = [-1, 1].map((sideSign, index) => {
      const liner = new THREE.Mesh(
        centeredExtrusion(
          annularShape(crankPinRadius + pinBearingClearance, rodEyeInnerRadius),
          connectingRodDepth + 0.025,
          0.003,
        ),
        linerMaterial,
      );
      liner.position.x = sideSign * centerDistance / 2;
      liner.userData.role = `${role}-${index === 0 ? 'upper' : 'lower'}-eye-liner`;
      return liner;
    });
    group.add(body, ...liners);
    group.userData.body = body;
    group.userData.liners = liners;
    group.userData.setEndpoints = (start, end) => {
      const direction = new THREE.Vector3().subVectors(end, start);
      const actualLength = direction.length();
      group.position.copy(start).add(end).multiplyScalar(0.5);
      group.rotation.set(0, 0, Math.atan2(direction.y, direction.x));
      group.userData.actualLength = actualLength;
      group.userData.lengthError = Math.abs(actualLength - centerDistance);
      group.userData.startPoint = start.clone();
      group.userData.endPoint = end.clone();
    };
    return group;
  };

  const makeShaftAssembly = (center, material, role) => {
    const assembly = new THREE.Group();
    assembly.position.copy(center);
    assembly.userData.role = role;
    assembly.userData.axis = Z_AXIS.clone();
    const rotor = new THREE.Group();
    rotor.userData.role = `${role}-rigid-rotor`;
    assembly.add(rotor);

    const shaft = cylinderAlongZ(shaftRadius, shaftLength, linerMaterial, 36);
    shaft.userData.role = `${role}-continuous-shaft-joining-both-crank-planes`;

    const frontDisk = cylinderAlongZ(
      frontDiskRadius,
      frontDiskDepth,
      material,
      72,
    );
    frontDisk.position.z = frontDiskCenterZ;
    frontDisk.userData.role = `${role}-front-crank-disk`;

    const frontRim = new THREE.Mesh(
      new THREE.TorusGeometry(frontDiskRadius, 0.045, 10, 84),
      linerMaterial,
    );
    frontRim.position.z = frontDiskCenterZ + frontDiskDepth / 2 + 0.022;
    frontRim.userData.role = `${role}-front-disk-outline`;

    const frontHub = cylinderAlongZ(hubRadius, hubDepth, linerMaterial, 40);
    frontHub.position.z = frontDiskCenterZ;
    frontHub.userData.role = `${role}-front-shaft-hub`;

    const frontRotationIndex = new THREE.Mesh(
      new THREE.BoxGeometry(crankRadius * 0.72, 0.095, 0.036),
      indexMaterial,
    );
    frontRotationIndex.position.set(
      crankRadius * 0.52,
      0,
      frontDiskCenterZ + frontDiskDepth / 2 + 0.048,
    );
    frontRotationIndex.userData.role = `${role}-visible-front-disk-rotation-index`;

    const frontPin = cylinderAlongZ(
      crankPinRadius,
      frontPinLength,
      linerMaterial,
      30,
    );
    frontPin.position.set(crankRadius, 0, frontPinCenterZ);
    frontPin.userData.role = `${role}-front-plane-crank-pin`;
    frontPin.userData.localPhase = 0;

    const rearCrank = new THREE.Mesh(
      centeredExtrusion(
        twoEyePlateShape(
          crankRadius,
          rearCrankEyeOuterRadius,
          rearCrankEyeInnerRadius,
          rearCrankPinEyeInnerRadius,
        ),
        rearCrankDepth,
        0.007,
      ),
      material,
    );
    rearCrank.position.set(
      Math.cos(quarterTurn) * crankRadius / 2,
      Math.sin(quarterTurn) * crankRadius / 2,
      rearCrankPlaneZ,
    );
    rearCrank.rotation.z = quarterTurn;
    rearCrank.userData.role = `${role}-rear-crank-quarter-turn-from-front-pin`;
    rearCrank.userData.localPhase = quarterTurn;

    const rearHub = cylinderAlongZ(
      rearCrankEyeOuterRadius * 0.92,
      rearCrankDepth + 0.12,
      linerMaterial,
      36,
    );
    rearHub.position.z = rearCrankPlaneZ;
    rearHub.userData.role = `${role}-rear-crank-shaft-hub`;

    const rearPin = cylinderAlongZ(
      crankPinRadius,
      rearPinLength,
      linerMaterial,
      30,
    );
    rearPin.position.set(
      Math.cos(quarterTurn) * crankRadius,
      Math.sin(quarterTurn) * crankRadius,
      rearPinCenterZ,
    );
    rearPin.userData.role = `${role}-rear-plane-crank-pin`;
    rearPin.userData.localPhase = quarterTurn;

    rotor.add(
      shaft,
      frontDisk,
      frontRim,
      frontHub,
      frontRotationIndex,
      frontPin,
      rearCrank,
      rearHub,
      rearPin,
    );
    assembly.userData.rotor = rotor;
    assembly.userData.parts = {
      frontDisk,
      frontHub,
      frontPin,
      frontRim,
      frontRotationIndex,
      rearCrank,
      rearHub,
      rearPin,
      shaft,
    };
    return assembly;
  };

  const inputShaft = makeShaftAssembly(
    upperShaftCenter,
    driverMaterial,
    'upper-input-shaft',
  );
  const outputShaft = makeShaftAssembly(
    lowerShaftCenter,
    drivenMaterial,
    'lower-output-shaft',
  );
  const inputRotor = inputShaft.userData.rotor;
  const outputRotor = outputShaft.userData.rotor;
  const frontRod = makeConnectingRod(
    'front-parallelogram-connecting-rod',
    frontRodPlaneZ,
  );
  const rearRod = makeConnectingRod(
    'rear-quadrature-parallelogram-connecting-rod',
    rearRodPlaneZ,
  );

  const fixedBearings = [upperShaftCenter, lowerShaftCenter].flatMap(
    (center, shaftIndex) => [frontBearingZ, rearBearingZ].map((bearingZ) => {
      const bearing = new THREE.Mesh(
        new THREE.TorusGeometry(bearingRadius, 0.072, 10, 44),
        frameMaterial,
      );
      bearing.position.set(center.x, center.y, bearingZ);
      bearing.userData.role = `${shaftIndex === 0 ? 'upper' : 'lower'}-${
        bearingZ === frontBearingZ ? 'front' : 'rear'
      }-fixed-shaft-bearing`;
      return bearing;
    }),
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.0, 10.2, 3.8),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-complete-movement-230-envelope';

  root.add(
    ...fixedBearings,
    inputShaft,
    outputShaft,
    frontRod,
    rearRod,
    cameraEnvelope,
  );

  const pointState = (center, phase, planeZ) => {
    const cosine = Math.cos(phase);
    const sine = Math.sin(phase);
    const radial = new THREE.Vector3(
      crankRadius * cosine,
      crankRadius * sine,
      0,
    );
    const point = center.clone().add(radial).setZ(planeZ);
    const velocity = new THREE.Vector3(
      -crankRadius * sine * inputAngularSpeed,
      crankRadius * cosine * inputAngularSpeed,
      0,
    );
    const acceleration = new THREE.Vector3(
      -crankRadius * cosine * inputAngularSpeed ** 2,
      -crankRadius * sine * inputAngularSpeed ** 2,
      0,
    );
    return { acceleration, phase, point, radial, velocity };
  };

  const stateAtDriverAngle = (driverAngle) => {
    const drivenAngle = driverAngle;
    const frontPhase = driverAngle;
    const rearPhase = driverAngle + quarterTurn;
    const frontUpper = pointState(
      upperShaftCenter,
      frontPhase,
      frontRodPlaneZ,
    );
    const frontLower = pointState(
      lowerShaftCenter,
      frontPhase,
      frontRodPlaneZ,
    );
    const rearUpper = pointState(
      upperShaftCenter,
      rearPhase,
      rearRodPlaneZ,
    );
    const rearLower = pointState(
      lowerShaftCenter,
      rearPhase,
      rearRodPlaneZ,
    );
    const frontRodVector = frontLower.point.clone().sub(frontUpper.point);
    const rearRodVector = rearLower.point.clone().sub(rearUpper.point);
    const frontRodLength = frontRodVector.length();
    const rearRodLength = rearRodVector.length();
    const frontNormalizedLeverage = Math.abs(Math.cos(frontPhase));
    const rearNormalizedLeverage = Math.abs(Math.cos(rearPhase));
    const combinedNormalizedLeverage = Math.hypot(
      frontNormalizedLeverage,
      rearNormalizedLeverage,
    );
    const strongestPairNormalizedLeverage = Math.max(
      frontNormalizedLeverage,
      rearNormalizedLeverage,
    );
    const deadCenterTolerance = 1e-10;
    const frontAtDeadCenter = frontNormalizedLeverage <= deadCenterTolerance;
    const rearAtDeadCenter = rearNormalizedLeverage <= deadCenterTolerance;
    const stage = frontAtDeadCenter
      ? 'front-pair-at-dead-center-rear-pair-at-quadrature'
      : rearAtDeadCenter
        ? 'rear-pair-at-dead-center-front-pair-at-quadrature'
        : 'both-quadrature-pairs-transmitting';
    const normalizedDriverAngle = THREE.MathUtils.euclideanModulo(
      driverAngle,
      fullTurn,
    );
    return {
      combinedNormalizedLeverage,
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      driverRevolutions: (driverAngle - sourcePoseAngle) / fullTurn,
      drivenAngle,
      drivenAngularSpeed: inputAngularSpeed,
      frontAtDeadCenter,
      frontLower,
      frontNormalizedLeverage,
      frontPhase,
      frontPinRelativeAccelerationError: frontUpper.acceleration.distanceTo(
        frontLower.acceleration,
      ),
      frontPinRelativeVelocityError: frontUpper.velocity.distanceTo(
        frontLower.velocity,
      ),
      frontRodAngle: Math.atan2(frontRodVector.y, frontRodVector.x),
      frontRodAngularSpeed: 0,
      frontRodCenter: frontUpper.point.clone().lerp(frontLower.point, 0.5),
      frontRodLength,
      frontRodLengthError: Math.abs(frontRodLength - centerDistance),
      frontRodVector,
      frontUpper,
      inputOutputPhaseError: Math.atan2(
        Math.sin(drivenAngle - driverAngle),
        Math.cos(drivenAngle - driverAngle),
      ),
      normalizedDriverAngle,
      rearAtDeadCenter,
      rearLower,
      rearNormalizedLeverage,
      rearPhase,
      rearPinRelativeAccelerationError: rearUpper.acceleration.distanceTo(
        rearLower.acceleration,
      ),
      rearPinRelativeVelocityError: rearUpper.velocity.distanceTo(
        rearLower.velocity,
      ),
      rearRodAngle: Math.atan2(rearRodVector.y, rearRodVector.x),
      rearRodAngularSpeed: 0,
      rearRodCenter: rearUpper.point.clone().lerp(rearLower.point, 0.5),
      rearRodLength,
      rearRodLengthError: Math.abs(rearRodLength - centerDistance),
      rearRodVector,
      rearUpper,
      shaftAngularRatio: 1,
      simultaneousDeadCenter: frontAtDeadCenter && rearAtDeadCenter,
      stage,
      strongestPairNormalizedLeverage,
    };
  };
  const stateAtTime = (time) => stateAtDriverAngle(
    sourcePoseAngle + inputAngularSpeed * time,
  );

  root.userData.archetype =
    'quadrature-two-plane-parallelogram-crank-coupling';
  root.userData.mechanism = root.userData.archetype;
  root.userData.blocks = {
    cameraEnvelope,
    connectingRods: [frontRod, rearRod],
    fixedBearings,
    frontCrankDisks: [
      inputShaft.userData.parts.frontDisk,
      outputShaft.userData.parts.frontDisk,
    ],
    frontCrankPins: [
      inputShaft.userData.parts.frontPin,
      outputShaft.userData.parts.frontPin,
    ],
    frontRod,
    inputRotor,
    inputShaft,
    outputRotor,
    outputShaft,
    rearCrankArms: [
      inputShaft.userData.parts.rearCrank,
      outputShaft.userData.parts.rearCrank,
    ],
    rearCrankPins: [
      inputShaft.userData.parts.rearPin,
      outputShaft.userData.parts.rearPin,
    ],
    rearRod,
    rotationIndexes: [
      inputShaft.userData.parts.frontRotationIndex,
      outputShaft.userData.parts.frontRotationIndex,
    ],
    shafts: [inputShaft, outputShaft],
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    bearingRadius,
    centerDistance,
    connectingRodDepth,
    crankPinRadius,
    crankRadius,
    cyclePeriod,
    frontBearingZ,
    frontDiskCenterZ,
    frontDiskDepth,
    frontDiskRadius,
    frontPinCenterZ,
    frontPinLength,
    frontRodPlaneZ,
    fullTurn,
    hubDepth,
    hubRadius,
    inputAngularSpeed,
    lowerShaftCenter: lowerShaftCenter.clone(),
    minimumGuaranteedNormalizedLeverage: Math.SQRT1_2,
    pinBearingClearance,
    quarterTurn,
    rearBearingZ,
    rearCrankDepth,
    rearCrankPlaneZ,
    rearPinCenterZ,
    rearPinLength,
    rearRodPlaneZ,
    rodEyeInnerRadius,
    rodEyeOuterRadius,
    shaftLength,
    shaftRadius,
    sourceImageHeight: 525,
    sourceImageWidth: 525,
    sourcePoseAngle,
    upperShaftCenter: upperShaftCenter.clone(),
  };
  root.userData.sourceReference = {
    plate230: {
      connectedRodCount: 2,
      crankPairsInSeparateAxialPlanes: true,
      crankPairsQuarterTurnApart: true,
      frontCrankDisks: 2,
      officialAnimationAvailable: false,
      parallelShaftCount: 2,
      rearExposedCrankArms: 2,
      statedFlywheelRequired: false,
      statedOutputMotion: 'circular',
    },
  };
  root.userData.transmission = {
    connectedRodCount: 2,
    crankPairPhaseOffset: quarterTurn,
    flywheelRequired: false,
    inputOutputAngularRatio: 1,
    inputOutputDirection: 'same',
    simultaneousDeadCentersPerTurn: 0,
    singlePairDeadCentersPerTurn: 2,
    topology: 'two-quarter-phased-parallelogram-four-bars',
  };
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;

  const pinContact = (pointStateValue, pinCenterZ, pinLength) => ({
    axis: Z_AXIS.clone(),
    axisPoint: pointStateValue.point.clone().setZ(pinCenterZ),
    axialCaptureMargin: pinLength / 2
      - Math.abs(pointStateValue.point.z - pinCenterZ)
      - connectingRodDepth / 2,
    centerError: 0,
    crankPoint: pointStateValue.point.clone(),
    rodEyePoint: pointStateValue.point.clone(),
    velocity: pointStateValue.velocity.clone(),
  });

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.driverAngle;
    outputRotor.rotation.z = state.drivenAngle;
    inputShaft.userData.angularSpeed = state.driverAngularSpeed;
    outputShaft.userData.angularSpeed = state.drivenAngularSpeed;
    frontRod.userData.setEndpoints(
      state.frontUpper.point,
      state.frontLower.point,
    );
    rearRod.userData.setEndpoints(
      state.rearUpper.point,
      state.rearLower.point,
    );
    frontRod.userData.angularSpeed = state.frontRodAngularSpeed;
    frontRod.userData.velocity = state.frontUpper.velocity.clone();
    rearRod.userData.angularSpeed = state.rearRodAngularSpeed;
    rearRod.userData.velocity = state.rearUpper.velocity.clone();
    root.userData.contacts = {
      frontLowerPin: pinContact(
        state.frontLower,
        frontPinCenterZ,
        frontPinLength,
      ),
      frontUpperPin: pinContact(
        state.frontUpper,
        frontPinCenterZ,
        frontPinLength,
      ),
      rearLowerPin: pinContact(
        state.rearLower,
        rearPinCenterZ,
        rearPinLength,
      ),
      rearUpperPin: pinContact(
        state.rearUpper,
        rearPinCenterZ,
        rearPinLength,
      ),
      shaftCoupling: {
        angularRatio: state.shaftAngularRatio,
        phaseError: state.inputOutputPhaseError,
        simultaneousDeadCenter: state.simultaneousDeadCenter,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  const model = finish(root, update, new THREE.Vector3(7.8, 4.6, 12.4));
  for (const object of [cameraEnvelope, ...root.userData.blocks.rotationIndexes]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return model;
}

function dragLinkDoubleCrankMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const cyclePeriod = 4;
  const inputAngularSpeed = -fullTurn / cyclePeriod;
  const sourcePoseAngle = THREE.MathUtils.degToRad(70);

  // A drag-link is the double-crank inversion of a Grashof four-bar. The
  // fixed bearing link must be the shortest member; both links adjacent to it
  // can then make complete turns. These proportions reproduce Brown's long
  // input crank, hanging coupler, and shorter output crank while retaining a
  // strict (non-change-point) Grashof margin through the entire revolution.
  const groundLength = 1.4;
  const inputCrankLength = 2.6;
  const couplerLength = 2.7;
  const outputCrankLength = 2.0;
  const strictGrashofMargin = inputCrankLength + outputCrankLength
    - groundLength - couplerLength;
  const minimumMovingCenterDistance = inputCrankLength - groundLength;
  const maximumMovingCenterDistance = inputCrankLength + groundLength;
  const innerTriangleClearance = minimumMovingCenterDistance
    - Math.abs(couplerLength - outputCrankLength);
  const outerTriangleClearance = couplerLength + outputCrankLength
    - maximumMovingCenterDistance;

  const inputPivot = new THREE.Vector3(-groundLength / 2, -0.58, 0);
  const outputPivot = new THREE.Vector3(groundLength / 2, -0.58, 0);
  const groundPlaneZ = -0.03;
  const inputCrankPlaneZ = -0.30;
  const outputCrankPlaneZ = 0.20;
  const couplerPlaneZ = 0.55;
  const crankDepth = 0.18;
  const groundDepth = 0.12;
  const couplerDepth = 0.20;
  const groundEyeOuterRadius = 0.285;
  const crankEyeOuterRadius = 0.255;
  const couplerEyeOuterRadius = 0.285;
  const shaftRadius = 0.16;
  const pivotEyeInnerRadius = shaftRadius + 0.045;
  const crankPinRadius = 0.105;
  const pinBearingClearance = 0.014;
  const movingEyeInnerRadius = crankPinRadius + pinBearingClearance + 0.034;
  const inputCrankPinCenterZ = 0.125;
  const inputCrankPinLength = 1.12;
  const outputCrankPinCenterZ = 0.375;
  const outputCrankPinLength = 0.62;
  const inputShaftCenterZ = -1.02;
  const outputShaftCenterZ = 1.02;
  const shaftLength = 1.65;
  const pivotHubRadius = 0.27;
  const pivotHubDepth = 0.40;
  const bearingRadius = 0.34;
  const inputBearingZ = -0.14;
  const outputBearingZ = 0.07;
  const axialClearances = {
    groundToInputCrank: groundPlaneZ - groundDepth / 2
      - (inputCrankPlaneZ + crankDepth / 2),
    groundToOutputCrank: outputCrankPlaneZ - crankDepth / 2
      - (groundPlaneZ + groundDepth / 2),
    inputCrankToOutputCrank: outputCrankPlaneZ - crankDepth / 2
      - (inputCrankPlaneZ + crankDepth / 2),
    inputCrankToOutputShaft: outputShaftCenterZ - shaftLength / 2
      - (inputCrankPlaneZ + crankDepth / 2),
    inputShaftToOutputCrank: outputCrankPlaneZ - crankDepth / 2
      - (inputShaftCenterZ + shaftLength / 2),
    outputCrankToCoupler: couplerPlaneZ - couplerDepth / 2
      - (outputCrankPlaneZ + crankDepth / 2),
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.60,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.60,
  });
  const couplerMaterial = matte(PALETTE.brass, {
    metalness: 0.18,
    roughness: 0.54,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.15,
    roughness: 0.66,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.44,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const twoEyePlateShape = (
    eyeSeparation,
    outerRadius,
    firstInnerRadius,
    secondInnerRadius = firstInnerRadius,
  ) => {
    const shape = horizontalCapsuleShape(outerRadius, eyeSeparation / 2);
    const firstHole = new THREE.Path();
    firstHole.absarc(
      -eyeSeparation / 2,
      0,
      firstInnerRadius,
      0,
      fullTurn,
      true,
    );
    const secondHole = new THREE.Path();
    secondHole.absarc(
      eyeSeparation / 2,
      0,
      secondInnerRadius,
      0,
      fullTurn,
      true,
    );
    shape.holes.push(firstHole, secondHole);
    return shape;
  };

  const groundPlate = new THREE.Mesh(
    centeredExtrusion(
      twoEyePlateShape(
        groundLength,
        groundEyeOuterRadius,
        pivotEyeInnerRadius,
      ),
      groundDepth,
      0.008,
    ),
    frameMaterial,
  );
  groundPlate.position.set(0, inputPivot.y, groundPlaneZ);
  groundPlate.userData.role = 'shortest-fixed-link-between-parallel-shaft-bearings';

  const groundEyeLiners = [inputPivot, outputPivot].map((pivot, index) => {
    const liner = new THREE.Mesh(
      centeredExtrusion(
        annularShape(shaftRadius + 0.012, pivotEyeInnerRadius),
        groundDepth + 0.025,
        0.003,
      ),
      darkMaterial,
    );
    liner.position.set(pivot.x, pivot.y, groundPlaneZ);
    liner.userData.role = `${index === 0 ? 'input' : 'output'}-fixed-bearing-liner`;
    return liner;
  });

  const fixedBearings = [inputPivot, outputPivot].map((pivot, index) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(bearingRadius, 0.07, 10, 44),
      frameMaterial,
    );
    bearing.position.set(
      pivot.x,
      pivot.y,
      index === 0 ? inputBearingZ : outputBearingZ,
    );
    bearing.userData.role = `${index === 0 ? 'input' : 'output'}-fixed-shaft-bearing`;
    return bearing;
  });

  const makeCrankAssembly = ({
    center,
    crankLength,
    material,
    crankPlane,
    crankPinCenter,
    crankPinLength,
    role,
    shaftCenterZ,
  }) => {
    const assembly = new THREE.Group();
    assembly.position.copy(center);
    assembly.userData.role = role;
    assembly.userData.axis = Z_AXIS.clone();
    const rotor = new THREE.Group();
    rotor.userData.role = `${role}-rigid-rotor`;
    assembly.add(rotor);

    const crank = new THREE.Mesh(
      centeredExtrusion(
        twoEyePlateShape(
          crankLength,
          crankEyeOuterRadius,
          pivotEyeInnerRadius,
          movingEyeInnerRadius,
        ),
        crankDepth,
        0.008,
      ),
      material,
    );
    crank.position.set(crankLength / 2, 0, crankPlane);
    crank.userData.role = `${role}-two-eye-full-rotation-crank`;

    const shaft = cylinderAlongZ(
      shaftRadius,
      shaftLength,
      darkMaterial,
      36,
    );
    shaft.position.z = shaftCenterZ;
    shaft.userData.role = `${role}-shaft`;

    const hub = cylinderAlongZ(
      pivotHubRadius,
      pivotHubDepth,
      darkMaterial,
      40,
    );
    hub.position.z = crankPlane;
    hub.userData.role = `${role}-pivot-hub`;

    const crankPin = cylinderAlongZ(
      crankPinRadius,
      crankPinLength,
      darkMaterial,
      30,
    );
    crankPin.position.set(crankLength, 0, crankPinCenter);
    crankPin.userData.role = `${role}-coupler-pin`;

    const rotationIndex = new THREE.Mesh(
      new THREE.BoxGeometry(crankLength * 0.42, 0.085, 0.034),
      indexMaterial,
    );
    rotationIndex.position.set(
      crankLength * 0.52,
      0,
      crankPlane + crankDepth / 2 + 0.045,
    );
    rotationIndex.userData.role = `${role}-visible-rotation-index`;

    rotor.add(crank, shaft, hub, crankPin, rotationIndex);
    assembly.userData.rotor = rotor;
    assembly.userData.parts = {
      crank,
      crankPin,
      hub,
      rotationIndex,
      shaft,
    };
    return assembly;
  };

  const inputShaft = makeCrankAssembly({
    center: inputPivot,
    crankLength: inputCrankLength,
    crankPinCenter: inputCrankPinCenterZ,
    crankPinLength: inputCrankPinLength,
    crankPlane: inputCrankPlaneZ,
    material: driverMaterial,
    role: 'input-drag-link-crankshaft',
    shaftCenterZ: inputShaftCenterZ,
  });
  const outputShaft = makeCrankAssembly({
    center: outputPivot,
    crankLength: outputCrankLength,
    crankPinCenter: outputCrankPinCenterZ,
    crankPinLength: outputCrankPinLength,
    crankPlane: outputCrankPlaneZ,
    material: drivenMaterial,
    role: 'output-drag-link-crankshaft',
    shaftCenterZ: outputShaftCenterZ,
  });
  const inputRotor = inputShaft.userData.rotor;
  const outputRotor = outputShaft.userData.rotor;

  const coupler = new THREE.Group();
  coupler.userData.role = 'hanging-rigid-drag-link-coupler';
  const couplerBody = new THREE.Mesh(
    centeredExtrusion(
      twoEyePlateShape(
        couplerLength,
        couplerEyeOuterRadius,
        movingEyeInnerRadius,
      ),
      couplerDepth,
      0.008,
    ),
    couplerMaterial,
  );
  couplerBody.userData.role = 'two-eye-coupler-plate';
  const couplerEyeLiners = [-1, 1].map((sideSign, index) => {
    const liner = new THREE.Mesh(
      centeredExtrusion(
        annularShape(
          crankPinRadius + pinBearingClearance,
          movingEyeInnerRadius,
        ),
        couplerDepth + 0.025,
        0.003,
      ),
      darkMaterial,
    );
    liner.position.x = sideSign * couplerLength / 2;
    liner.userData.role = `${index === 0 ? 'input' : 'output'}-coupler-eye-liner`;
    return liner;
  });
  coupler.add(couplerBody, ...couplerEyeLiners);
  coupler.userData.setEndpoints = (inputPoint, outputPoint) => {
    const vector = new THREE.Vector3().subVectors(outputPoint, inputPoint);
    const actualLength = vector.length();
    coupler.position.copy(inputPoint).add(outputPoint).multiplyScalar(0.5);
    coupler.rotation.set(0, 0, Math.atan2(vector.y, vector.x));
    coupler.userData.actualLength = actualLength;
    coupler.userData.lengthError = Math.abs(actualLength - couplerLength);
    coupler.userData.inputPoint = inputPoint.clone();
    coupler.userData.outputPoint = outputPoint.clone();
  };

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 6.8, 4.2),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0.25, 0.45, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-complete-movement-231-envelope';

  root.add(
    groundPlate,
    ...groundEyeLiners,
    ...fixedBearings,
    inputShaft,
    outputShaft,
    coupler,
    cameraEnvelope,
  );

  const solvePosition = (driverAngle) => {
    const driverCosine = Math.cos(driverAngle);
    const driverSine = Math.sin(driverAngle);
    const inputRadial = new THREE.Vector3(
      inputCrankLength * driverCosine,
      inputCrankLength * driverSine,
      0,
    );
    const inputPin = inputPivot.clone().add(inputRadial).setZ(couplerPlaneZ);
    const fromOutputPivotToInputPin = inputPin.clone()
      .setZ(0)
      .sub(outputPivot);
    const movingCenterDistance = fromOutputPivotToInputPin.length();
    const centerDirection = fromOutputPivotToInputPin.clone()
      .multiplyScalar(1 / movingCenterDistance);
    const intersectionAlongCenter = (
      outputCrankLength ** 2
      - couplerLength ** 2
      + movingCenterDistance ** 2
    ) / (2 * movingCenterDistance);
    const intersectionHeightSquared = outputCrankLength ** 2
      - intersectionAlongCenter ** 2;
    const intersectionHeight = Math.sqrt(Math.max(0, intersectionHeightSquared));
    const centerPerpendicular = new THREE.Vector3(
      -centerDirection.y,
      centerDirection.x,
      0,
    );
    // The minus branch is the open assembly drawn by Brown: at the source
    // pose both crank pins lie above the fixed bearing link and the coupler
    // descends from the input pin toward the output pin.
    const outputPin = outputPivot.clone()
      .addScaledVector(centerDirection, intersectionAlongCenter)
      .addScaledVector(centerPerpendicular, -intersectionHeight)
      .setZ(couplerPlaneZ);
    const outputRadial = outputPin.clone().setZ(0).sub(outputPivot);
    const drivenPrincipalAngle = Math.atan2(outputRadial.y, outputRadial.x);
    const drivenAngle = drivenPrincipalAngle + fullTurn * Math.round(
      (driverAngle - drivenPrincipalAngle) / fullTurn,
    );
    return {
      circleBranchCross: fromOutputPivotToInputPin.clone()
        .cross(outputRadial).z,
      centerDirection,
      drivenAngle,
      drivenPrincipalAngle,
      inputPin,
      inputRadial,
      intersectionAlongCenter,
      intersectionHeight,
      intersectionHeightSquared,
      innerCircleClearance: movingCenterDistance
        - Math.abs(couplerLength - outputCrankLength),
      movingCenterDistance,
      outerCircleClearance: couplerLength + outputCrankLength
        - movingCenterDistance,
      outputPin,
      outputRadial,
    };
  };

  const sourceDrivenAngle = solvePosition(sourcePoseAngle).drivenAngle;
  const stateAtDriverAngle = (driverAngle) => {
    const position = solvePosition(driverAngle);
    const {
      drivenAngle,
      inputPin,
      inputRadial,
      outputPin,
      outputRadial,
    } = position;
    const driverUnit = inputRadial.clone().multiplyScalar(1 / inputCrankLength);
    const drivenUnit = outputRadial.clone().multiplyScalar(1 / outputCrankLength);
    const driverTangent = new THREE.Vector3(-driverUnit.y, driverUnit.x, 0);
    const drivenTangent = new THREE.Vector3(-drivenUnit.y, drivenUnit.x, 0);
    const couplerVector = outputPin.clone().sub(inputPin);
    const drivenDerivativeDenominator = outputCrankLength
      * couplerVector.dot(drivenTangent);
    const drivenDerivativeByDriver = inputCrankLength
      * couplerVector.dot(driverTangent)
      / drivenDerivativeDenominator;
    const relativeDerivativeByDriver = drivenTangent.clone()
      .multiplyScalar(outputCrankLength * drivenDerivativeByDriver)
      .addScaledVector(driverTangent, -inputCrankLength);
    const drivenSecondDerivativeByDriver = -(
      relativeDerivativeByDriver.lengthSq()
      + couplerVector.dot(
        drivenUnit.clone().multiplyScalar(
          -outputCrankLength * drivenDerivativeByDriver ** 2,
        ).addScaledVector(driverUnit, inputCrankLength),
      )
    ) / drivenDerivativeDenominator;

    const inputPinVelocity = driverTangent.clone().multiplyScalar(
      inputCrankLength * inputAngularSpeed,
    );
    const inputPinAcceleration = driverUnit.clone().multiplyScalar(
      -inputCrankLength * inputAngularSpeed ** 2,
    );
    const drivenAngularSpeed = drivenDerivativeByDriver * inputAngularSpeed;
    const drivenAngularAcceleration = drivenSecondDerivativeByDriver
      * inputAngularSpeed ** 2;
    const outputPinVelocity = drivenTangent.clone().multiplyScalar(
      outputCrankLength * drivenAngularSpeed,
    );
    const outputPinAcceleration = drivenUnit.clone().multiplyScalar(
      -outputCrankLength * drivenAngularSpeed ** 2,
    ).addScaledVector(
      drivenTangent,
      outputCrankLength * drivenAngularAcceleration,
    );
    const relativeVelocity = outputPinVelocity.clone().sub(inputPinVelocity);
    const relativeAcceleration = outputPinAcceleration.clone()
      .sub(inputPinAcceleration);
    const couplerAngularSpeed = couplerVector.clone()
      .cross(relativeVelocity).z / couplerLength ** 2;
    const couplerAngularAcceleration = couplerVector.clone()
      .cross(relativeAcceleration).z / couplerLength ** 2;
    const couplerCenterVelocity = inputPinVelocity.clone()
      .add(outputPinVelocity)
      .multiplyScalar(0.5);
    const couplerCenterAcceleration = inputPinAcceleration.clone()
      .add(outputPinAcceleration)
      .multiplyScalar(0.5);
    const couplerActualLength = couplerVector.length();
    const speedTolerance = 1e-10;
    const stage = drivenDerivativeByDriver > 1 + speedTolerance
      ? 'output-rotating-faster-than-input'
      : drivenDerivativeByDriver < 1 - speedTolerance
        ? 'output-rotating-slower-than-input'
        : 'instantaneous-unit-speed-ratio';
    return {
      ...position,
      couplerAccelerationConstraintError: Math.abs(
        relativeVelocity.lengthSq()
          + couplerVector.dot(relativeAcceleration),
      ),
      couplerActualLength,
      couplerAngle: Math.atan2(couplerVector.y, couplerVector.x),
      couplerAngularAcceleration,
      couplerAngularSpeed,
      couplerCenter: inputPin.clone().lerp(outputPin, 0.5),
      couplerCenterAcceleration,
      couplerCenterVelocity,
      couplerLengthError: Math.abs(couplerActualLength - couplerLength),
      couplerVector,
      couplerVelocityConstraintError: Math.abs(
        couplerVector.dot(relativeVelocity),
      ),
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      driverRevolutions: (driverAngle - sourcePoseAngle) / fullTurn,
      drivenAngularAcceleration,
      drivenAngularSpeed,
      drivenDerivativeByDriver,
      drivenDerivativeDenominator,
      drivenRevolutions: (drivenAngle - sourceDrivenAngle) / fullTurn,
      drivenSecondDerivativeByDriver,
      inputPinAcceleration,
      inputPinRadiusError: Math.abs(inputRadial.length() - inputCrankLength),
      inputPinVelocity,
      normalizedDriverAngle: THREE.MathUtils.euclideanModulo(
        driverAngle,
        fullTurn,
      ),
      outputPinAcceleration,
      outputPinRadiusError: Math.abs(outputRadial.length() - outputCrankLength),
      outputPinVelocity,
      relativeAcceleration,
      relativeVelocity,
      stage,
    };
  };
  const stateAtTime = (time) => stateAtDriverAngle(
    sourcePoseAngle + inputAngularSpeed * time,
  );

  root.userData.archetype = 'strict-grashof-drag-link-double-crank';
  root.userData.mechanism = root.userData.archetype;
  root.userData.cameraDistanceScale = 0.82;
  root.userData.blocks = {
    cameraEnvelope,
    coupler,
    couplerBody,
    couplerEyeLiners,
    fixedBearings,
    groundEyeLiners,
    groundPlate,
    inputCrank: inputShaft.userData.parts.crank,
    inputCrankPin: inputShaft.userData.parts.crankPin,
    inputRotor,
    inputShaft,
    outputCrank: outputShaft.userData.parts.crank,
    outputCrankPin: outputShaft.userData.parts.crankPin,
    outputRotor,
    outputShaft,
    rotationIndexes: [
      inputShaft.userData.parts.rotationIndex,
      outputShaft.userData.parts.rotationIndex,
    ],
    shafts: [
      inputShaft.userData.parts.shaft,
      outputShaft.userData.parts.shaft,
    ],
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    axialClearances,
    bearingRadius,
    inputBearingZ,
    couplerDepth,
    couplerEyeOuterRadius,
    couplerLength,
    couplerPlaneZ,
    crankDepth,
    crankEyeOuterRadius,
    inputCrankPinCenterZ,
    inputCrankPinLength,
    crankPinRadius,
    inputCrankPlaneZ,
    cyclePeriod,
    fullTurn,
    groundDepth,
    groundEyeOuterRadius,
    groundLength,
    groundPlaneZ,
    innerTriangleClearance,
    inputAngularSpeed,
    inputCrankLength,
    inputPivot: inputPivot.clone(),
    inputShaftCenterZ,
    maximumMovingCenterDistance,
    minimumMovingCenterDistance,
    movingEyeInnerRadius,
    outerTriangleClearance,
    outputCrankLength,
    outputCrankPinCenterZ,
    outputCrankPinLength,
    outputCrankPlaneZ,
    outputBearingZ,
    outputPivot: outputPivot.clone(),
    outputShaftCenterZ,
    pinBearingClearance,
    pivotEyeInnerRadius,
    pivotHubDepth,
    pivotHubRadius,
    shaftLength,
    shaftRadius,
    sourceDrivenAngle,
    sourceImageHeight: 525,
    sourceImageWidth: 525,
    sourcePoseAngle,
    strictGrashofMargin,
  };
  root.userData.sourceReference = {
    plate231: {
      connectedCouplerCount: 1,
      fixedBearingLinkCount: 1,
      fullRotationCrankCount: 2,
      hangingCoupler: true,
      officialAnimationAvailable: false,
      parallelShaftCount: 2,
      shaftExtensionsShownOnOppositeSides: true,
      statedInputMotion: 'circular',
      statedOutputMotion: 'circular',
    },
  };
  root.userData.transmission = {
    averageOutputTurnsPerInputTurn: 1,
    assemblyBranch: 'open-minus-circle-intersection',
    inputOutputDirection: 'same',
    instantaneousSpeedRatioVariable: true,
    strictGrashof: true,
    strictGrashofMargin,
    topology: 'fixed-shortest-link-double-crank-four-bar',
  };
  root.userData.solvePosition = solvePosition;
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;

  const pinContact = (point, velocity, pinCenterZ, pinLength) => ({
    axis: Z_AXIS.clone(),
    axialCaptureMargin: pinLength / 2
      - Math.abs(couplerPlaneZ - pinCenterZ)
      - couplerDepth / 2,
    centerError: 0,
    crankPoint: point.clone(),
    rodEyePoint: point.clone(),
    velocity: velocity.clone(),
  });

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.driverAngle;
    outputRotor.rotation.z = state.drivenAngle;
    inputShaft.userData.angularSpeed = state.driverAngularSpeed;
    outputShaft.userData.angularAcceleration = state.drivenAngularAcceleration;
    outputShaft.userData.angularSpeed = state.drivenAngularSpeed;
    coupler.userData.setEndpoints(state.inputPin, state.outputPin);
    coupler.userData.angularAcceleration = state.couplerAngularAcceleration;
    coupler.userData.angularSpeed = state.couplerAngularSpeed;
    coupler.userData.velocity = state.couplerCenterVelocity.clone();
    root.userData.contacts = {
      couplerInputPin: pinContact(
        state.inputPin,
        state.inputPinVelocity,
        inputCrankPinCenterZ,
        inputCrankPinLength,
      ),
      couplerOutputPin: pinContact(
        state.outputPin,
        state.outputPinVelocity,
        outputCrankPinCenterZ,
        outputCrankPinLength,
      ),
      fixedInputPivot: {
        axis: Z_AXIS.clone(),
        axisPoint: inputPivot.clone(),
        centerError: 0,
      },
      fixedOutputPivot: {
        axis: Z_AXIS.clone(),
        axisPoint: outputPivot.clone(),
        centerError: 0,
      },
      fourBarClosure: {
        accelerationConstraintError: state.couplerAccelerationConstraintError,
        couplerLengthError: state.couplerLengthError,
        velocityConstraintError: state.couplerVelocityConstraintError,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  const model = finish(root, update, new THREE.Vector3(7.8, 5.0, 12.2));
  for (const object of [cameraEnvelope, ...root.userData.blocks.rotationIndexes]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return model;
}

export function createAuthoredCrankMovement(movement) {
  switch (movement.id) {
    case 92: return ordinaryCrankMotion();
    case 93: return scotchYokeCrankMotion();
    case 94: return variableCrankSpiralPlateMotion();
    case 95: return inclinedDiskVerticalFollowerMotion();
    case 98: return endlessGrooveVibratingArmMotion();
    case 100: return crankAndSlottedLeverQuickReturnMotion();
    case 101: return vibratingSlottedLeverHorizontalBarMotion();
    case 131: return crankPinSlottedSectorRackMotion();
    case 132: return twinObliqueRodTogglePressMotion();
    case 140: return leverDrivenTogglePunchPressMotion();
    case 146: return frontDiskRearFramedYokeMotion();
    case 156: return slottedBellCrankVariableVerticalMotion();
    case 157: return connectingRodBellCrankVariableVerticalMotion();
    case 158: return treadleDrivenContinuousDiskMotion();
    case 159: return cordAndPulleyTreadleDiskMotion();
    case 160: return springReturnTreadleFullWrapPulleyMotion();
    case 230: return quadratureTwinCrankShaftCoupling();
    case 231: return dragLinkDoubleCrankMotion();
    default: return null;
  }
}
