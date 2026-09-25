import * as THREE from 'three';
import {plate,poly,circle,polygonClipping,ring} from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function rectangularFrame(
  outerWidth,
  outerHeight,
  thickness,
  depth,
  material,
  rolePrefix,
) {
  const group = new THREE.Group();
  group.userData.role = rolePrefix;
  const horizontalLength = outerWidth - 2 * thickness;
  const verticalLength = outerHeight;
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(horizontalLength, thickness, depth),
    material,
  );
  top.position.y = (outerHeight - thickness) / 2;
  top.userData.role = `${rolePrefix}-top-wall`;
  const bottom = top.clone();
  bottom.position.y = -(outerHeight - thickness) / 2;
  bottom.userData.role = `${rolePrefix}-bottom-wall`;
  const left = new THREE.Mesh(
    new THREE.BoxGeometry(thickness, verticalLength, depth),
    material,
  );
  left.position.x = -(outerWidth - thickness) / 2;
  left.userData.role = `${rolePrefix}-left-wall`;
  const right = left.clone();
  right.position.x = (outerWidth - thickness) / 2;
  right.userData.role = `${rolePrefix}-right-wall`;
  group.add(top, bottom, left, right);
  return { bottom, group, left, right, top };
}

function squarePistonEngine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const sourceScale = 0.22;
  const sourceCrankRadius = 4;
  const sourceCylinderInnerHalfWidth = 16.5;
  const sourceCylinderInnerHalfHeight = 11.5;
  const sourcePistonBOuterHalfWidth = 11.5;
  const sourcePistonBOuterHalfHeight = 11.5;
  const sourcePistonBInnerHalfWidth = 10;
  const sourcePistonBInnerHalfHeight = 10;
  const sourcePistonCHalfWidth = 10;
  const sourcePistonCHalfHeight = 5;
  const crankRadius = sourceCrankRadius * sourceScale;
  const cylinderInnerHalfWidth = sourceCylinderInnerHalfWidth * sourceScale;
  const cylinderInnerHalfHeight = sourceCylinderInnerHalfHeight * sourceScale;
  const pistonBOuterHalfWidth = sourcePistonBOuterHalfWidth * sourceScale;
  const pistonBOuterHalfHeight = sourcePistonBOuterHalfHeight * sourceScale;
  const pistonBInnerHalfWidth = sourcePistonBInnerHalfWidth * sourceScale;
  const pistonBInnerHalfHeight = sourcePistonBInnerHalfHeight * sourceScale;
  const pistonCHalfWidth = sourcePistonCHalfWidth * sourceScale;
  const pistonCHalfHeight = sourcePistonCHalfHeight * sourceScale;
  const cylinderEndClearance = cylinderInnerHalfWidth
    - pistonBOuterHalfWidth - crankRadius;
  const pistonCEndClearance = pistonBInnerHalfHeight
    - pistonCHalfHeight - crankRadius;
  const crankCenter = new THREE.Vector3(0, 0, 0);

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const cosine = Math.cos(inputAngle);
    const sine = Math.sin(inputAngle);
    const crankPin = new THREE.Vector3(
      crankRadius * cosine,
      crankRadius * sine,
      0,
    );
    const crankPinPrime = new THREE.Vector3(
      -crankRadius * sine,
      crankRadius * cosine,
      0,
    );
    const crankPinSecond = new THREE.Vector3(
      -crankRadius * cosine,
      -crankRadius * sine,
      0,
    );
    const crankPinVelocity = crankPinPrime.clone().multiplyScalar(inputSpeed);
    const crankPinAcceleration = crankPinSecond.clone()
      .multiplyScalar(inputSpeed ** 2)
      .addScaledVector(crankPinPrime, inputAcceleration);
    const pistonBCenter = new THREE.Vector3(crankPin.x, 0, 0);
    const pistonBCenterPrime = new THREE.Vector3(crankPinPrime.x, 0, 0);
    const pistonBCenterSecond = new THREE.Vector3(
      crankPinSecond.x,
      0,
      0,
    );
    const pistonBVelocity = pistonBCenterPrime.clone().multiplyScalar(
      inputSpeed,
    );
    const pistonBAcceleration = pistonBCenterSecond.clone()
      .multiplyScalar(inputSpeed ** 2)
      .addScaledVector(pistonBCenterPrime, inputAcceleration);
    const pistonCCenter = crankPin.clone();
    const pistonCRelativeToB = pistonCCenter.clone().sub(pistonBCenter);
    const pistonCRelativePrime = crankPinPrime.clone().sub(
      pistonBCenterPrime,
    );
    const pistonCRelativeSecond = crankPinSecond.clone().sub(
      pistonBCenterSecond,
    );
    const pistonCRelativeVelocity = pistonCRelativePrime.clone()
      .multiplyScalar(inputSpeed);
    const pistonCRelativeAcceleration = pistonCRelativeSecond.clone()
      .multiplyScalar(inputSpeed ** 2)
      .addScaledVector(pistonCRelativePrime, inputAcceleration);

    const pistonBLeftClearance = cylinderInnerHalfWidth
      + pistonBCenter.x - pistonBOuterHalfWidth;
    const pistonBRightClearance = cylinderInnerHalfWidth
      - pistonBCenter.x - pistonBOuterHalfWidth;
    const pistonCBottomClearance = pistonBInnerHalfHeight
      + pistonCRelativeToB.y - pistonCHalfHeight;
    const pistonCTopClearance = pistonBInnerHalfHeight
      - pistonCRelativeToB.y - pistonCHalfHeight;
    const horizontalPistonTorqueArm = -crankPin.y;
    const verticalPistonTorqueArm = crankPin.x;
    const torqueArmNorm = Math.hypot(
      horizontalPistonTorqueArm,
      verticalPistonTorqueArm,
    );
    const horizontalPistonForceDirection = sine > 1e-12
      ? 'left'
      : sine < -1e-12
        ? 'right'
        : 'changeover';
    const verticalPistonForceDirection = cosine > 1e-12
      ? 'up'
      : cosine < -1e-12
        ? 'down'
        : 'changeover';
    const pistonBLeftPortOpening = Math.max(0, -sine);
    const pistonBRightPortOpening = Math.max(0, sine);
    const pistonCTopPortOpening = Math.max(0, -cosine);
    const pistonCBottomPortOpening = Math.max(0, cosine);

    return {
      crankAngle: inputAngle,
      crankAngularAcceleration: inputAcceleration,
      crankAngularSpeed: inputSpeed,
      crankPin,
      crankPinAcceleration,
      crankPinCircleResidual:
        crankPin.lengthSq() - crankRadius ** 2,
      crankPinPrime,
      crankPinSecond,
      crankPinVelocity,
      horizontalPistonForceDirection,
      horizontalPistonTorqueArm,
      inputAcceleration,
      inputAngle,
      inputSpeed,
      maximumAvailableUnitForceTorque:
        Math.max(
          Math.abs(horizontalPistonTorqueArm),
          Math.abs(verticalPistonTorqueArm),
        ),
      pistonBAcceleration,
      pistonBCenter,
      pistonBCenterPrime,
      pistonBCenterSecond,
      pistonBHorizontalClosureResidual: pistonBCenter.x - crankPin.x,
      pistonBLeftClearance,
      pistonBLeftPortOpening,
      pistonBRightClearance,
      pistonBRightPortOpening,
      pistonBVelocity,
      pistonCAbsoluteAcceleration: crankPinAcceleration.clone(),
      pistonCAbsoluteVelocity: crankPinVelocity.clone(),
      pistonCBottomClearance,
      pistonCBottomPortOpening,
      pistonCCenter,
      pistonCCrankWristClosureResidual: pistonCCenter.distanceTo(crankPin),
      pistonCHorizontalNestingResidual: pistonCRelativeToB.x,
      pistonCRelativeAcceleration,
      pistonCRelativePrime,
      pistonCRelativeSecond,
      pistonCRelativeToB,
      pistonCRelativeVelocity,
      pistonCTopClearance,
      pistonCTopPortOpening,
      portOpeningMagnitudeSquared:
        (pistonBLeftPortOpening + pistonBRightPortOpening) ** 2
          + (pistonCTopPortOpening + pistonCBottomPortOpening) ** 2,
      torqueArmNorm,
      torqueArmNormResidual: torqueArmNorm - crankRadius,
      verticalPistonForceDirection,
      verticalPistonTorqueArm,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...stateAtInputAngle(inputAngularSpeed * cycleTime),
      cycleTime,
      phase: cycleTime / cycleDuration,
    };
  };

  const geometry = {
    crankCenter: crankCenter.clone(),
    crankRadius,
    cycleDuration,
    cylinderEndClearance,
    cylinderInnerHalfHeight,
    cylinderInnerHalfWidth,
    inputAngularSpeed,
    pistonBInnerHalfHeight,
    pistonBInnerHalfWidth,
    pistonBOuterHalfHeight,
    pistonBOuterHalfWidth,
    pistonBStroke: 2 * crankRadius,
    pistonCEndClearance,
    pistonCHalfHeight,
    pistonCHalfWidth,
    pistonCStrokeRelativeToB: 2 * crankRadius,
    sourceCrankRadius,
    sourceCylinderInnerHalfHeight,
    sourceCylinderInnerHalfWidth,
    sourcePistonBInnerHalfHeight,
    sourcePistonBInnerHalfWidth,
    sourcePistonBOuterHalfHeight,
    sourcePistonBOuterHalfWidth,
    sourcePistonCHalfHeight,
    sourcePistonCHalfWidth,
    sourceScale,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.24,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.33,
    roughness: 0.42,
  });
  const pistonBMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    roughness: 0.47,
  });
  const pistonCMaterial = matte(PALETTE.driver, {
    metalness: 0.20,
    roughness: 0.46,
  });
  const crankMaterial = matte(0xd9a62b, {
    metalness: 0.23,
    roughness: 0.43,
  });
  const steamMaterial = matte(0xe66f4a, {
    opacity: 0.22,
    roughness: 0.60,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const cylinderBackMaterial = matte(0x4a93a8, {
    opacity: 0.10,
    roughness: 0.66,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const housingWallThickness = 0.34;
  const housingOuterWidth = 2 * cylinderInnerHalfWidth
    + 2 * housingWallThickness;
  const housingOuterHeight = 2 * cylinderInnerHalfHeight
    + 2 * housingWallThickness;
  const cylinderA = rectangularFrame(
    housingOuterWidth,
    housingOuterHeight,
    housingWallThickness,
    0.72,
    frameMaterial,
    'fixed-oblong-square-cylinder-A',
  );
  cylinderA.group.position.z = -0.05;
  root.add(cylinderA.group);

  const cylinderBack = new THREE.Mesh(
    new THREE.PlaneGeometry(
      2 * cylinderInnerHalfWidth,
      2 * cylinderInnerHalfHeight,
    ),
    cylinderBackMaterial,
  );
  cylinderBack.position.z = -0.43;
  cylinderBack.userData.role = 'cutaway-back-of-cylinder-A';
  root.add(cylinderBack);

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(housingOuterWidth + 0.80, 0.28, 1.34),
    frameMaterial,
  );
  foundation.position.set(0, -housingOuterHeight / 2 - 0.14, -0.12);
  foundation.userData.role = 'fixed-foundation-of-square-piston-engine';
  root.add(foundation);

  const pistonBFrameThickness = (
    pistonBOuterHalfWidth - pistonBInnerHalfWidth
  );
  const pistonBParts = rectangularFrame(
    2 * pistonBOuterHalfWidth,
    2 * pistonBOuterHalfHeight,
    pistonBFrameThickness,
    0.58,
    pistonBMaterial,
    'horizontally-sliding-square-frame-piston-B',
  );
  pistonBParts.group.position.z = 0.18;
  root.add(pistonBParts.group);

  const pistonC = new THREE.Group();
  pistonC.userData.role = 'vertically-sliding-piston-C-nested-within-B';
  const pistonCBody = new THREE.Mesh(
    new THREE.BoxGeometry(
      2 * pistonCHalfWidth,
      2 * pistonCHalfHeight,
      0.62,
    ),
    pistonCMaterial,
  );
  pistonCBody.geometry.dispose();
  pistonCBody.geometry = plate(polygonClipping.difference(poly([
    [-pistonCHalfWidth,-pistonCHalfHeight],[pistonCHalfWidth,-pistonCHalfHeight],
    [pistonCHalfWidth,pistonCHalfHeight],[-pistonCHalfWidth,pistonCHalfHeight]]),
  poly(circle([0,0],0.185,128))),-0.31,0.31);
  pistonCBody.position.z = 0.46;
  pistonCBody.userData.role = 'horizontal-body-of-piston-C';
  pistonC.add(pistonCBody);
  const pistonCWristBearing = cylinderAlongZ(0.20, 0.90, whiteMaterial, 28);
  pistonCWristBearing.geometry.dispose();
  pistonCWristBearing.geometry = ring(0.185,0.26,-0.06,0.06,128);
  pistonCWristBearing.rotation.set(0,0,0);
  pistonCWristBearing.position.z = 0.82;
  pistonCWristBearing.userData.role =
    'crank-wrist-a-rigidly-attached-at-center-of-piston-C';
  pistonC.add(pistonCWristBearing);
  root.add(pistonC);

  // Brown's dotted wrist path round b is notation; it is not drawn.
  const crankRotor = new THREE.Group();
  crankRotor.userData.role = 'main-shaft-b-and-crank';
  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.18, 0.34),
    crankMaterial,
  );
  crankArm.position.set(crankRadius / 2, 0, 1.08);
  crankArm.userData.role = 'crank-arm-from-main-shaft-b-to-wrist-a';
  crankRotor.add(crankArm);
  const crankWristA = cylinderAlongZ(0.18, 0.84, whiteMaterial, 28);
  crankWristA.position.set(crankRadius, 0, 0.86);
  crankWristA.userData.role =
    'single-crank-wrist-a-directly-driving-piston-C';
  crankRotor.add(crankWristA);
  root.add(crankRotor);
  const mainShaftB = cylinderAlongZ(0.24, 0.42, darkMaterial, 32);
  mainShaftB.position.z = 1.17;
  mainShaftB.userData.role = 'fixed-axis-main-shaft-b';
  root.add(mainShaftB);

  const makePort = (width, height, x, y, role) => {
    const port = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 0.14),
      darkMaterial,
    );
    port.position.set(x, y, 0.62);
    port.userData.role = role;
    root.add(port);
    return port;
  };
  const sidePortHeight = 8 * sourceScale;
  const sidePortWidth = 0.8 * sourceScale;
  const endPortWidth = 8 * sourceScale;
  const endPortHeight = 0.8 * sourceScale;
  const leftPort = makePort(
    sidePortWidth,
    sidePortHeight,
    -cylinderInnerHalfWidth + sidePortWidth / 2,
    0,
    'fixed-left-steam-port-for-horizontal-piston-B',
  );
  const rightPort = makePort(
    sidePortWidth,
    sidePortHeight,
    cylinderInnerHalfWidth - sidePortWidth / 2,
    0,
    'fixed-right-steam-port-for-horizontal-piston-B',
  );
  const topPort = makePort(
    endPortWidth,
    endPortHeight,
    0,
    pistonBInnerHalfHeight - endPortHeight / 2,
    'fixed-top-steam-port-for-vertical-piston-C',
  );
  const bottomPort = makePort(
    endPortWidth,
    endPortHeight,
    0,
    -pistonBInnerHalfHeight + endPortHeight / 2,
    'fixed-bottom-steam-port-for-vertical-piston-C',
  );

  const makeIndicator = (port, role) => {
    const indicator = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 22, 14),
      steamMaterial,
    );
    indicator.position.copy(port.position);
    indicator.position.z = 0.78;
    indicator.userData.role = role;
    root.add(indicator);
    return indicator;
  };
  const leftPortIndicator = makeIndicator(
    leftPort,
    'left-B-port-admission-indicator',
  );
  const rightPortIndicator = makeIndicator(
    rightPort,
    'right-B-port-admission-indicator',
  );
  const topPortIndicator = makeIndicator(
    topPort,
    'top-C-port-admission-indicator',
  );
  const bottomPortIndicator = makeIndicator(
    bottomPort,
    'bottom-C-port-admission-indicator',
  );

  // Pass 57: the ports are passages cut through the walls instead of dark
  // slabs laid on them. Each of A's side walls has a slot through it, closed
  // outside by a steam chest; B's top and bottom walls (which move with B,
  // as Brown's end ports do) each have a slot through them. A's walls are
  // deepened so B and C lie within the casing's depth, the translucent back
  // is an opaque back cover, and shaft b runs into a bored boss on a front
  // arm from A's top wall (the front cover is removed by Brown's section).
  {
    const portZ = pistonBParts.group.position.z, portHalfZ = 0.15;
    const aBack = -0.41, aFront = 0.80;
    const aDepth = aFront - aBack, aCenterZ = (aFront + aBack) / 2;
    for (const port of [leftPort, rightPort, topPort, bottomPort]) port.visible = false;
    const rect = (x0, y0, x1, y1) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
    // A's walls: deeper; side walls slotted along x (shape x = -local z).
    cylinderA.group.position.z = aCenterZ;
    for (const wall of [cylinderA.top, cylinderA.bottom]) {
      const p = wall.geometry.parameters;
      wall.geometry.dispose();wall.geometry = new THREE.BoxGeometry(p.width, p.height, aDepth);
    }
    const sideHalfY = cylinderInnerHalfHeight + housingWallThickness, slotLocalZ = portZ - aCenterZ;
    for (const wall of [cylinderA.left, cylinderA.right]) {
      const shape = polygonClipping.difference(rect(-aDepth / 2, -sideHalfY, aDepth / 2, sideHalfY),
        rect(-slotLocalZ - portHalfZ, -sidePortHeight / 2, -slotLocalZ + portHalfZ, sidePortHeight / 2));
      wall.geometry.dispose();
      wall.geometry = plate(shape, -housingWallThickness / 2, housingWallThickness / 2).rotateY(Math.PI / 2);
    }
    for (const side of [-1, 1]) {
      const chest = new THREE.Mesh(new THREE.BoxGeometry(0.24, sidePortHeight + 0.30, 2 * portHalfZ + 0.24), frameMaterial);
      chest.position.set(side * (housingOuterWidth / 2 + 0.12), 0, portZ);
      chest.userData.role = `fixed-${side < 0 ? 'left' : 'right'}-steam-chest-over-side-port`;
      root.add(chest);
    }
    // B's top and bottom walls: slotted along y (shape y = -local z).
    for (const wall of [pistonBParts.top, pistonBParts.bottom]) {
      const p = wall.geometry.parameters;
      const shape = polygonClipping.difference(rect(-p.width / 2, -p.depth / 2, p.width / 2, p.depth / 2),
        rect(-endPortWidth / 2, -portHalfZ, endPortWidth / 2, portHalfZ));
      wall.geometry.dispose();
      wall.geometry = plate(shape, -p.height / 2, p.height / 2).rotateX(-Math.PI / 2);
    }
    cylinderBack.visible = false;
    const backCover = new THREE.Mesh(new THREE.BoxGeometry(housingOuterWidth, housingOuterHeight, 0.12), frameMaterial);
    backCover.position.z = aBack - 0.06;
    backCover.userData.role = 'fixed-back-cover-of-cylinder-A';
    root.add(backCover);
    const armFront = 1.52, armBack = 1.40, top = housingOuterHeight / 2;
    mainShaftB.geometry.dispose();
    mainShaftB.geometry = new THREE.CylinderGeometry(0.24, 0.24, armFront - 0.01 - 0.96, 32);
    mainShaftB.position.z = (armFront - 0.01 + 0.96) / 2;
    const arm = new THREE.Mesh(plate(polygonClipping.difference(
      polygonClipping.union(rect(-0.16, 0, 0.16, top), poly(circle([0, 0], 0.40, 64))),
      poly(circle([0, 0], 0.2405, 64))), armBack, armFront), frameMaterial);
    arm.userData.role = 'fixed-front-arm-with-bearing-for-shaft-b';
    const standoff = new THREE.Mesh(new THREE.BoxGeometry(0.32, housingWallThickness, armBack - aFront), frameMaterial);
    standoff.position.set(0, top - housingWallThickness / 2, (armBack + aFront) / 2);
    standoff.userData.role = 'fixed-standoff-joining-front-arm-to-cylinder-A';
    root.add(arm, standoff);
  }

  const update = (time) => {
    const state = stateAtTime(time);
    pistonBParts.group.position.x = state.pistonBCenter.x;
    pistonC.position.copy(state.pistonCCenter);
    crankRotor.rotation.z = state.crankAngle;
    leftPortIndicator.scale.setScalar(
      0.56 + state.pistonBLeftPortOpening,
    );
    rightPortIndicator.scale.setScalar(
      0.56 + state.pistonBRightPortOpening,
    );
    topPortIndicator.scale.setScalar(
      0.56 + state.pistonCTopPortOpening,
    );
    bottomPortIndicator.scale.setScalar(
      0.56 + state.pistonCBottomPortOpening,
    );
  };

  const sourceState = stateAtInputAngle(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'oblong-square-cylinder-with-horizontal-frame-piston-containing-vertical-piston-directly-on-crank-wrist',
    blocks: {
      bottomPort,
      bottomPortIndicator,
      crankArm,
      crankRotor,
      crankWristA,
      cylinderA: cylinderA.group,
      cylinderBack,
      foundation,
      leftPort,
      leftPortIndicator,
      mainShaftB,
      pistonB: pistonBParts.group,
      pistonBBottomWall: pistonBParts.bottom,
      pistonBLeftWall: pistonBParts.left,
      pistonBRightWall: pistonBParts.right,
      pistonBTopWall: pistonBParts.top,
      pistonC,
      pistonCBody,
      pistonCWristBearing,
      rightPort,
      rightPortIndicator,
      topPort,
      topPortIndicator,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      pistonBHorizontalPositionIndependent: false,
      pistonCVerticalPositionWithinBIndependent: false,
    },
    dynamics: {
      portIndicationLaw:
        'Idealized admission markers select the pressure side required for positive counterclockwise torque; Brown supplies no valve gear or timing law.',
      pressureExpansionCutoffExhaustLeakageFrictionInertiaAndLoadsModeled:
        false,
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsPressuresOrLoads: false,
      torqueClaim:
        'No-dead-point geometry is established by the complementary crank moment arms, not by a thermodynamic simulation.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Fixed oblong-square cylinder A contains square frame piston B, which translates horizontally. Horizontal piston C fills B’s inner width and translates vertically relative to B. Crank wrist a is rigidly attached to the center of C; B shares the wrist’s x coordinate while C shares both coordinates, so the two nested orthogonal piston motions are exactly the Cartesian components of the circular wrist path. Horizontal and vertical pressure forces have complementary moment arms -y and x, so they cannot reach a dead point together.',
    motion: {
      crankDirection: 'counterclockwise',
      crankRevolutionsPerCycle: 1,
      cycleDuration,
      inputAngularSpeed,
      pistonBStroke: 2 * crankRadius,
      pistonCStrokeRelativeToB: 2 * crankRadius,
    },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      officialCanvasCyclePeriod: 4,
      officialCanvasCyclesPerMinute: 15,
      officialCanvasModelPresent: true,
      reason:
        'The official Movement 424 page embeds a four-part Canvas model. Its fixed A opening, translating square frame B, piston C attached directly to radius-4 wrist a, exact cosine/sine component motions, four black ports, and counterclockwise crank direction were extracted and independently reconstructed.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      crankAngle: sourceState.crankAngle,
      crankPin: sourceState.crankPin.clone(),
      pistonBCenter: sourceState.pistonBCenter.clone(),
      pistonCCenter: sourceState.pistonCCenter.clone(),
      pistonCRelativeToB: sourceState.pistonCRelativeToB.clone(),
    },
    sourceReference: {
      brownPlate424: {
        crankMainShaftBApproximatePixels: [260, 286],
        crankWristAApproximatePixels: [308, 321],
        cylinderAInnerApproximateBoundsPixels: [45, 125, 481, 414],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 12,
        pistonBApproximateBoundsPixels: [161, 126, 458, 414],
        pistonCApproximateBoundsPixels: [192, 138, 430, 380],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'A is an oblong square cylinder',
          'A contains two pistons B and C',
          'B works horizontally',
          'C works vertically within B',
          'C connects with crank wrist a on main shaft b',
          'the black regions are steam-admission ports',
          'the two pistons rotate the crank without dead points',
        ],
        engravingEvidence:
          'Brown’s plate shows fixed rectangular housing A, an inner square frame B spanning its height, a horizontal piston C spanning B’s width, crank center b, wrist a on C, and four black admission ports at the outer left, right, top, and bottom walls.',
        officialCanvasEvidence:
          'The official model gives A inner half-dimensions (16.5,11.5), B outer half-dimensions (11.5,11.5) and inner half-dimensions (10,10), C half-dimensions (10,5), wrist radius 4, B center x=4*cos(inputAngle), and C center=(4*cos(inputAngle),4*sin(inputAngle)).',
        reconstructionDisclosure:
          'Brown gives no absolute scale, piston depth, seal clearance, port timing, exhaust path, pressure cycle, speed, materials, inertia, or loads. Depth, colors, supports, and idealized port indicators are independently engineered; the planar dimensions and component laws come from the official model.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 424',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      directWristConnection:
        'pistonCCenter=crankWrist=[r*cos(inputAngle),r*sin(inputAngle)]',
      horizontalNesting:
        'pistonBCenter=[crankWrist.x,0], so C has zero horizontal displacement relative to B',
      noDeadPointIdentity:
        'horizontalMomentArm^2+verticalMomentArm^2=(-y)^2+x^2=crankRadius^2',
      verticalNesting:
        'pistonCRelativeToB=[0,crankWrist.y]',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.35, -3.30, -0.95),
    new THREE.Vector3(4.35, 3.20, 1.40),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(4.8, 3.3, 11.8);
  root.userData.groundFloorY = -3.30;
  root.userData.hideGround = true;
  root.userData.solidReview = { qualification: 'Bored piston wrist and finite sliding guides; front cutaway crank/shaft stub avoids passing a fixed shaft through translating C. Rear bearing support and steam sealing/pressure are not modeled.' };
  root.traverse(object=>{for(const material of object.material?[].concat(object.material):[]) material.fog=false;});
  markShadows(root);
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredSquarePistonEngineMovement(movement) {
  if (movement.id !== 424) return null;
  return squarePistonEngine(movement);
}
