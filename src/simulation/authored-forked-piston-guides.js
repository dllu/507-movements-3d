import * as THREE from 'three';
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

function makeForkedConnectingRod({
  darkMaterial,
  forkHalfSpacing,
  forkStartFraction,
  length,
  prongDepth,
  rodMaterial,
}) {
  const rod = new THREE.Group();
  rod.userData.nominalLength = length;
  rod.userData.role =
    'one-rigid-connecting-rod-with-two-depth-separated-lower-prongs';
  const stemEnd = length * forkStartFraction;
  const branchLength = Math.min(length * 0.12, 0.52);
  const branchStart = stemEnd - branchLength * 0.52;
  const branchEnd = stemEnd + branchLength * 0.48;

  const stem = new THREE.Mesh(
    new THREE.BoxGeometry(stemEnd, 0.15, 0.16),
    rodMaterial,
  );
  stem.position.x = stemEnd / 2;
  stem.userData.role = 'single-upper-stem-of-forked-connecting-rod';
  const crankBoss = cylinderAlongZ(0.20, 0.20, rodMaterial, 34);
  crankBoss.userData.role = 'forked-rod-upper-crank-eye-boss';
  const crankEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.045, 8, 34),
    darkMaterial,
  );
  crankEye.position.z = 0.11;
  crankEye.userData.role = 'forked-rod-upper-crank-pin-eye';

  const branches = [];
  const prongs = [];
  const wristEyes = [];
  const wristAnchors = [];
  for (const side of [-1, 1]) {
    const sideName = side < 0 ? 'rear' : 'front';
    const branch = beamBetween3D(
      new THREE.Vector3(branchStart, 0, 0),
      new THREE.Vector3(branchEnd, 0, side * forkHalfSpacing),
      0.13,
      prongDepth,
      rodMaterial,
    );
    branch.userData.role = `${sideName}-fork-transition-branch`;
    branches.push(branch);
    const prongLength = length - branchEnd;
    const prong = new THREE.Mesh(
      new THREE.BoxGeometry(prongLength, 0.12, prongDepth),
      rodMaterial,
    );
    prong.position.set(
      (branchEnd + length) / 2,
      0,
      side * forkHalfSpacing,
    );
    prong.userData.role =
      `${sideName}-lower-fork-prong-clearing-prolonged-piston-rod`;
    prongs.push(prong);
    const wristBoss = cylinderAlongZ(0.18, prongDepth, rodMaterial, 32);
    wristBoss.position.set(length, 0, side * forkHalfSpacing);
    wristBoss.userData.role = `${sideName}-fork-wrist-boss`;
    const wristEye = new THREE.Mesh(
      new THREE.TorusGeometry(0.115, 0.040, 8, 32),
      darkMaterial,
    );
    wristEye.position.set(
      length,
      0,
      side * forkHalfSpacing + side * (prongDepth / 2 + 0.014),
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
    stem,
    crankBoss,
    crankEye,
    ...branches,
    ...prongs,
    ...wristEyes,
    crankAnchor,
    centerWristAnchor,
    ...wristAnchors,
  );
  return {
    branches,
    centerWristAnchor,
    crankAnchor,
    prongs,
    rod,
    stem,
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

  const crankPlaneZ = -0.18;
  const connectingRodPlaneZ = 0.62;
  const forkHalfSpacing = 0.28;
  const forkProngDepth = 0.10;
  const pistonRodDepth = 0.14;
  const pistonRodHalfWidth = 5 * engravingScale;
  const pistonRodTopLocalY = 3.38;
  const pistonRodBottomLocalY = -1.46;
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
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.47 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-engine-frame-carrying-crank-bearing-guide-A-and-cylinder';
  const topBeam = new THREE.Mesh(
    new THREE.BoxGeometry(3.65, 0.22, 0.52),
    frameMaterial,
  );
  topBeam.position.set(1.18, 3.42, -0.34);
  topBeam.userData.fixed = true;
  topBeam.userData.role = 'fixed-overhead-engine-frame-beam';
  const frameColumn = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 6.25, 0.58),
    frameMaterial,
  );
  frameColumn.position.set(2.38, 0.35, -0.34);
  frameColumn.userData.fixed = true;
  frameColumn.userData.role = 'fixed-column-supporting-guide-A';
  const bearingHousing = cylinderAlongZ(0.36, 0.68, frameMaterial, 44);
  bearingHousing.position.set(crankCenter.x, crankCenter.y, -0.28);
  bearingHousing.userData.fixed = true;
  bearingHousing.userData.role = 'fixed-overhead-crankshaft-bearing';
  const bearingBore = cylinderAlongZ(0.16, 0.72, darkMaterial, 36);
  bearingBore.position.set(crankCenter.x, crankCenter.y, -0.27);
  bearingBore.userData.fixed = true;
  bearingBore.userData.role = 'fixed-overhead-bearing-bore';

  const guideA = new THREE.Group();
  guideA.position.set(0, guideY, 0);
  guideA.userData.axisX = pistonAxisX;
  guideA.userData.fixed = true;
  guideA.userData.role =
    'fixed-guide-A-centered-on-cylinder-and-piston-rod-axis';
  const guideBracket = new THREE.Mesh(
    new THREE.BoxGeometry(2.30, 0.20, 0.38),
    frameMaterial,
  );
  guideBracket.position.set(1.23, 0, 0.39);
  guideBracket.userData.fixed = true;
  guideBracket.userData.role = 'fixed-horizontal-arm-of-guide-A';
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
    new THREE.BoxGeometry(0.38, 0.28, 0.36),
    frameMaterial,
  );
  guideShoe.position.set(0.15, 0, 0.39);
  guideShoe.userData.fixed = true;
  guideShoe.userData.role = 'fixed-guide-A-bearing-block';
  guideA.add(guideBracket, guideShoe, guideCollar);

  const cylinderRadius = 0.68;
  const cylinderHeight = 2.35;
  const cylinderCenterY = -4.05;
  const cylinderBody = new THREE.Mesh(
    new THREE.CylinderGeometry(
      cylinderRadius,
      cylinderRadius,
      cylinderHeight,
      48,
    ),
    frameMaterial,
  );
  cylinderBody.position.set(0, cylinderCenterY, 0.05);
  cylinderBody.userData.fixed = true;
  cylinderBody.userData.role = 'fixed-cylinder-collinear-with-guide-A';
  const cylinderTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.84, 0.84, 0.15, 48),
    darkMaterial,
  );
  cylinderTop.position.set(0, cylinderCenterY + cylinderHeight / 2, 0.05);
  cylinderTop.userData.fixed = true;
  cylinderTop.userData.role = 'fixed-cylinder-top-cap';
  const gland = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.23, 0.19, 36),
    frameMaterial,
  );
  gland.position.set(0, cylinderCenterY + cylinderHeight / 2 + 0.16, 0.05);
  gland.userData.fixed = true;
  gland.userData.role = 'fixed-piston-rod-gland-on-cylinder-axis';
  const cylinderBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.85, 0.20, 1.05),
    frameMaterial,
  );
  cylinderBase.position.set(0, cylinderCenterY - cylinderHeight / 2, 0.05);
  cylinderBase.userData.fixed = true;
  cylinderBase.userData.role = 'fixed-cylinder-foundation';
  fixedFrame.add(
    topBeam,
    frameColumn,
    bearingHousing,
    bearingBore,
    guideA,
    cylinderBody,
    cylinderTop,
    gland,
    cylinderBase,
  );

  const crankRotor = new THREE.Group();
  crankRotor.position.set(crankCenter.x, crankCenter.y, 0);
  crankRotor.userData.axis = Z_AXIS.clone();
  crankRotor.userData.role =
    'one-rigid-overhead-crank-web-pin-and-live-shaft';
  const crankHub = cylinderAlongZ(0.23, 0.55, driverMaterial, 40);
  crankHub.position.z = crankPlaneZ;
  crankHub.userData.role = 'overhead-crank-hub';
  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.18, 0.18),
    driverMaterial,
  );
  crankArm.position.set(crankRadius / 2, 0, crankPlaneZ);
  crankArm.userData.role = 'rigid-overhead-crank-arm';
  const crankPinBoss = cylinderAlongZ(0.15, 0.26, driverMaterial, 34);
  crankPinBoss.position.set(crankRadius, 0, crankPlaneZ);
  crankPinBoss.userData.role = 'overhead-moving-crank-pin-boss';
  const crankPinShaft = cylinderAlongZ(
    0.11,
    connectingRodPlaneZ - crankPlaneZ + 0.30,
    darkMaterial,
    32,
  );
  crankPinShaft.position.set(
    crankRadius,
    0,
    (connectingRodPlaneZ + crankPlaneZ) / 2,
  );
  crankPinShaft.userData.role = 'crank-pin-to-forked-rod-journal';
  const crankIndex = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius * 0.58, 0.055, 0.034),
    whiteMaterial,
  );
  crankIndex.position.set(
    crankRadius * 0.36,
    0,
    crankPlaneZ + 0.12,
  );
  crankIndex.userData.role = 'white-index-fast-with-overhead-crank';
  const crankPinAnchor = new THREE.Object3D();
  crankPinAnchor.position.set(
    crankRadius,
    0,
    connectingRodPlaneZ,
  );
  crankPinAnchor.userData.role = 'analytic-overhead-crank-pin';
  const liveShaft = cylinderAlongZ(0.13, 1.28, darkMaterial, 36);
  liveShaft.position.z = -0.30;
  liveShaft.userData.role = 'live-overhead-crankshaft';
  crankRotor.add(
    crankHub,
    crankArm,
    crankPinBoss,
    crankPinShaft,
    crankIndex,
    crankPinAnchor,
    liveShaft,
  );

  const forkParts = makeForkedConnectingRod({
    darkMaterial,
    forkHalfSpacing,
    forkStartFraction,
    length: connectingRodLength,
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
    new THREE.BoxGeometry(0.58, 0.25, forkHalfSpacing * 2 + 0.36),
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
  pistonHead.position.set(0, pistonRodBottomLocalY - 0.16, 0.05);
  pistonHead.userData.role = 'piston-rigid-with-prolonged-rod';
  const pistonIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.24, 0.032),
    whiteMaterial,
  );
  pistonIndex.position.set(
    0,
    pistonRodTopLocalY - 0.22,
    connectingRodPlaneZ + pistonRodDepth / 2 + 0.024,
  );
  pistonIndex.userData.role = 'white-index-on-prolonged-piston-rod';
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
    pistonIndex,
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
    crankIndex,
    crankPinAnchor,
    crankPinBoss,
    crankPinShaft,
    crankRotor,
    crosshead,
    cylinderBase,
    cylinderBody,
    cylinderTop,
    fixedFrame,
    forkBranches: forkParts.branches,
    forkCenterWristAnchor: forkParts.centerWristAnchor,
    forkCrankAnchor: forkParts.crankAnchor,
    forkProngs: forkParts.prongs,
    forkWristAnchors: forkParts.wristAnchors,
    forkWristEyes: forkParts.wristEyes,
    forkedConnectingRod: forkParts.rod,
    frameColumn,
    gland,
    guideA,
    guideAxisAnchor,
    guideBracket,
    guideCollar,
    guideShoe,
    liveShaft,
    pistonAssembly,
    pistonHead,
    pistonIndex,
    pistonRod,
    pistonWristAnchor,
    topBeam,
  };
  root.userData.cameraDistanceScale = 1.30;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.28, -5.36, -0.82),
    new THREE.Vector3(2.78, 4.28, 1.08),
  );
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

  update(0);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(7.2, 3.8, 11.8),
    root,
    update,
  };
}

export function createAuthoredForkedPistonGuide(movement) {
  if (movement.id !== 330) return null;
  return ForkedPistonRodGuide(movement);
}
