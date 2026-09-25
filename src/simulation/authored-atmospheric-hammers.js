import {correctHammerWorkingParts} from './hammer-working-parts.js';
import * as THREE from 'three';
import {
  plate,
  poly,
  polygonClipping,
  spline,
} from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (10 + x * (-15 + 6 * x));
}

function smootherStepDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * x ** 2 * (1 - x) ** 2;
}

function smootherStepSecondDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * x * (1 - x) * (1 - 2 * x);
}

function setRodBetween(mesh, start, end) {
  const delta = end.clone().sub(start);
  const length = Math.max(0.001, delta.length());
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.y = length;
  mesh.quaternion.setFromUnitVectors(Y_AXIS, delta.normalize());
}

// Brown draws a single cast column: a narrow round-topped loop that embraces
// cylinder B and hammer C, its sides running down into a bell-shaped foot
// that carries the anvil. The column is one plate in the elevation plane,
// centred on the cylinder axis; the crank-A bearing is bracketed to its right
// side. Hole e is shortened to a port through the cylinder wall so the
// cylinder clears the loop.
function buildLoopColumn(root, frame, material, groundY, {
  anvilBottomY,
  axisX,
  cylinderOuterRadius,
}) {
  for (const child of [...frame.children]) {
    child.removeFromParent();
    child.geometry?.dispose();
  }
  const back = -0.46;
  const front = 0.46;
  const inner = 0.56;
  const outer = 0.92;
  const archCenterY = 4.08;
  const arc = (radius, start, end, count = 96) => Array.from(
    {length: count + 1},
    (_, i) => {
      const angle = start + (end - start) * i / count;
      return [radius * Math.cos(angle), archCenterY + radius * Math.sin(angle)];
    },
  );
  const bellOuter = spline([
    [outer, 1.0], [1.0, -0.15], [1.22, -1.15], [1.62, groundY + 0.08],
  ]);
  const outline = [
    ...arc(outer, 0, Math.PI),
    ...bellOuter.map(([x, y]) => [-x, y]),
    [-1.76, groundY + 0.05],
    [-1.76, groundY],
    [1.76, groundY],
    [1.76, groundY + 0.05],
    ...[...bellOuter].reverse(),
  ];
  const opening = [
    ...arc(inner, 0, Math.PI),
    [-inner, -0.95],
    [-0.62, anvilBottomY],
    [0.62, anvilBottomY],
    [inner, -0.95],
  ];
  const column = new THREE.Mesh(
    plate(
      polygonClipping.difference(poly(outline), poly(opening))
        .map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [x + axisX, y]))),
      back,
      front,
    ),
    material,
  );
  column.userData.role = 'single-loop-column-with-bell-foot';
  frame.add(column);
  // The hidden undrawn foundation slab is dropped from the scene entirely.
  root.userData.blocks.foundation.removeFromParent();
  // The crank-A bearing and shaft stub sit clear behind the descending
  // cylinder's end ring; an L bracket seats the bearing on the back of the
  // column's right side. The crank-side parts placed by the shared hammer
  // helper for a front crank are mirrored to the back here.
  const blocks = root.userData.blocks;
  const side = Math.sign(root.userData.geometry.crankCenter.z);
  for (const object of [blocks.crankDisk, blocks.crankPinVisual,
    ...blocks.crankAssembly.children.filter((child) => child.geometry?.type === 'BoxGeometry')]) {
    object.position.z = -side * Math.abs(object.position.z);
  }
  for (const object of [blocks.cylinderDriveLug, blocks.cylinderJointPin]) {
    object.position.z = side * Math.abs(object.position.z);
  }
  const bearing = blocks.crankBearing;
  const bearingLength = 0.14;
  bearing.position.z = side * 0.615;
  bearing.scale.y = bearingLength / 0.18;
  blocks.fixedDriveShaft.position.z = side * 0.75;
  const brackets = root.children.filter((object) =>
    object.isMesh && !object.userData.role
    && object.geometry?.type === 'BoxGeometry');
  const armStart = bearing.position.x + 0.15;
  const armEnd = axisX + inner + 0.14;
  const footX = axisX + inner + 0.04;
  const shapes = [
    [[armEnd - armStart, 0.10, bearingLength], [(armStart + armEnd) / 2, bearing.position.z]],
    [[armEnd - footX, 0.10, 0.62 - (front - 0.02)], [(footX + armEnd) / 2, side * (0.62 + front - 0.02) / 2]],
  ];
  brackets.forEach((bracket, index) => {
    const [size, [x, z]] = shapes[index];
    bracket.geometry.dispose();
    bracket.geometry = new THREE.BoxGeometry(...size);
    bracket.position.set(x, bearing.position.y, z);
    bracket.userData.role = `crank-A-bearing-bracket-${index + 1}`;
  });
  // The crank arm starts outside the fixed shaft stub instead of crossing it.
  const arm = blocks.crankAssembly.children.find((object) =>
    object.geometry?.type === 'BoxGeometry');
  const armInner = 0.12;
  const armParameters = arm.geometry.parameters;
  arm.geometry.dispose();
  arm.geometry = new THREE.BoxGeometry(
    armParameters.width - armInner,
    armParameters.height,
    armParameters.depth,
  );
  arm.position.x = (armParameters.width + armInner) / 2;
  const port = blocks.atmosphericPort;
  const portLength = 0.14;
  port.geometry.computeBoundingBox();
  port.scale.y = portLength / port.geometry.boundingBox.getSize(new THREE.Vector3()).y;
  port.position.x = -(cylinderOuterRadius - 0.10 + portLength / 2);
}

function atmosphericHammer(movement) {
  const root = new THREE.Group();
  const cycleDuration = 2.8;
  const crankRadius = 0.68;
  const connectingRodLength = 1.55;
  const cylinderAxisX = 0.38;
  // Brown dots crank A and rod D: they run behind the hammer line, so the
  // crank plane lies behind the column rather than in front of hammer C.
  const crankCenter = new THREE.Vector3(cylinderAxisX, 0.39, -1.0);
  const cylinderDrivePinBottomY = 1.05;
  const cylinderDriveAttachmentOffsetY = 0.42;
  const bottomHorizontalOffset = cylinderAxisX - crankCenter.x;
  const bottomVerticalReach = Math.sqrt(
    connectingRodLength ** 2 - bottomHorizontalOffset ** 2,
  );
  const resolvedCrankCenterY = cylinderDrivePinBottomY + crankRadius
    - bottomVerticalReach;
  crankCenter.y = resolvedCrankCenterY;
  const crankAngularVelocity = FULL_TURN / cycleDuration;
  const cylinderHalfChamberHeight = 1.30;
  const cylinderBottomCenterY = cylinderDrivePinBottomY
    + cylinderDriveAttachmentOffsetY;
  const cylinderInnerRadius = 0.35;
  const cylinderOuterRadius = 0.45;
  const pistonThickness = 0.18;
  const pistonArea = Math.PI * cylinderInnerRadius ** 2;
  const atmosphericPressurePascal = 101325;
  const polytropicExponent = 1.35;
  const hammerImpactPhase = 0.12;
  const hammerLiftStartPhase = hammerImpactPhase;
  const cylinderTopCenterPhase = 0.50;
  const upperAirSealPhase = 0.62;
  const maximumHammerLift = 1.05;
  const upperDrivePhaseSpan = 1 - upperAirSealPhase + hammerImpactPhase;
  const upperDriveDuration = upperDrivePhaseSpan * cycleDuration;
  const bottomCenterUpperDriveProgress = (1 - upperAirSealPhase)
    / upperDrivePhaseSpan;
  const preBlowLift = maximumHammerLift
    * (1 - bottomCenterUpperDriveProgress ** 3);
  const impactSpeed = 3 * maximumHammerLift / upperDriveDuration;
  const pistonContactCenterY = 1.02;
  const hammerHeadHeight = 0.48;
  const anvilTopY = -1.27;
  const hammerHeadContactCenterY = anvilTopY + hammerHeadHeight / 2;
  const movingHammerMassKilogram = 88;
  const gravity = 9.81;
  const groundY = -1.81;

  const crankKinematics = (unwrappedPhase) => {
    const phase = positiveModulo(unwrappedPhase, 1);
    const crankAngle = FULL_TURN * phase - Math.PI / 2;
    const cosine = Math.cos(crankAngle);
    const sine = Math.sin(crankAngle);
    const crankPin = new THREE.Vector3(
      crankCenter.x + crankRadius * cosine,
      crankCenter.y + crankRadius * sine,
      crankCenter.z,
    );
    const horizontalOffset = cylinderAxisX - crankPin.x;
    const verticalReach = Math.sqrt(Math.max(
      0,
      connectingRodLength ** 2 - horizontalOffset ** 2,
    ));
    const cylinderDrivePin = new THREE.Vector3(
      cylinderAxisX,
      crankPin.y + verticalReach,
      crankCenter.z,
    );
    const horizontalOffsetDerivative = crankRadius * sine;
    const horizontalOffsetSecondDerivative = crankRadius * cosine;
    const verticalReachDerivative = -horizontalOffset
      * horizontalOffsetDerivative / verticalReach;
    const verticalReachSecondDerivative = -(
      horizontalOffsetDerivative ** 2
      + horizontalOffset * horizontalOffsetSecondDerivative
    ) / verticalReach - (
      horizontalOffset ** 2 * horizontalOffsetDerivative ** 2
    ) / verticalReach ** 3;
    const sliderDerivativeByAngle = crankRadius * cosine
      + verticalReachDerivative;
    const sliderSecondDerivativeByAngle = -crankRadius * sine
      + verticalReachSecondDerivative;
    const cylinderVelocity = sliderDerivativeByAngle
      * crankAngularVelocity;
    const cylinderAcceleration = sliderSecondDerivativeByAngle
      * crankAngularVelocity ** 2;
    const cylinderCenterY = cylinderDrivePin.y
      + cylinderDriveAttachmentOffsetY;
    const crankPinVelocity = new THREE.Vector3(
      -crankRadius * sine * crankAngularVelocity,
      crankRadius * cosine * crankAngularVelocity,
      0,
    );
    const crankPinAcceleration = new THREE.Vector3(
      -crankRadius * cosine * crankAngularVelocity ** 2,
      -crankRadius * sine * crankAngularVelocity ** 2,
      0,
    );
    return {
      bottomCenterCrossed: phase > 0 && phase < 0.5,
      crankAngle,
      crankAngularVelocity,
      crankPin,
      crankPinAcceleration,
      crankPinVelocity,
      cylinderAcceleration,
      cylinderCenterY,
      cylinderDisplacement: cylinderCenterY - cylinderBottomCenterY,
      cylinderDrivePin,
      cylinderVelocity,
      horizontalOffset,
      phase,
      sliderDerivativeByAngle,
      sliderSecondDerivativeByAngle,
      verticalReach,
      verticalReachDerivative,
      verticalReachSecondDerivative,
    };
  };

  const easedHammerSegment = (
    phase,
    startPhase,
    endPhase,
    startLift,
    endLift,
  ) => {
    const local = THREE.MathUtils.clamp(
      (phase - startPhase) / (endPhase - startPhase),
      0,
      1,
    );
    const duration = (endPhase - startPhase) * cycleDuration;
    const displacement = endLift - startLift;
    return {
      acceleration: displacement * smootherStepSecondDerivative(local)
        / duration ** 2,
      lift: startLift + displacement * smootherStep(local),
      velocity: displacement * smootherStepDerivative(local) / duration,
    };
  };

  const hammerKinematics = (unwrappedPhase) => {
    const phase = positiveModulo(unwrappedPhase, 1);
    let motion;
    let regime;
    if (phase < hammerImpactPhase) {
      const unwrappedUpperDrivePhase = phase + 1;
      const local = (unwrappedUpperDrivePhase - upperAirSealPhase)
        / upperDrivePhaseSpan;
      motion = {
        acceleration: -6 * maximumHammerLift * local
          / upperDriveDuration ** 2,
        lift: maximumHammerLift * (1 - local ** 3),
        velocity: -3 * maximumHammerLift * local ** 2
          / upperDriveDuration,
      };
      regime = 'stored-upper-air-expands-after-bottom-center-and-drives-blow';
    } else if (phase < hammerLiftStartPhase) {
      motion = { acceleration: 0, lift: 0, velocity: 0 };
      regime = 'hammer-at-anvil-while-lower-air-is-trapped';
    } else if (phase < cylinderTopCenterPhase) {
      motion = easedHammerSegment(
        phase,
        hammerLiftStartPhase,
        cylinderTopCenterPhase,
        0,
        maximumHammerLift,
      );
      regime = 'ascending-cylinder-compresses-lower-air-and-lifts-hammer';
    } else if (phase < upperAirSealPhase) {
      motion = {
        acceleration: 0,
        lift: maximumHammerLift,
        velocity: 0,
      };
      regime = 'upper-chamber-takes-in-atmospheric-air-through-port-e';
    } else {
      const local = (phase - upperAirSealPhase) / upperDrivePhaseSpan;
      motion = {
        acceleration: -6 * maximumHammerLift * local
          / upperDriveDuration ** 2,
        lift: maximumHammerLift * (1 - local ** 3),
        velocity: -3 * maximumHammerLift * local ** 2
          / upperDriveDuration,
      };
      regime = 'descending-cylinder-compresses-and-stores-upper-air';
    }
    if (Math.abs(phase - hammerImpactPhase) < 1e-12) {
      regime = 'hammer-C-strikes-anvil-and-impact-removes-downward-velocity';
    }
    const pistonCenterY = pistonContactCenterY + motion.lift;
    const hammerHeadCenterY = hammerHeadContactCenterY + motion.lift;
    return {
      acceleration: motion.acceleration,
      hammerFaceY: hammerHeadCenterY - hammerHeadHeight / 2,
      hammerHeadCenterY,
      impactContact: Math.abs(motion.lift) < 1e-12,
      lift: motion.lift,
      phase,
      pistonCenterY,
      regime,
      velocity: motion.velocity,
    };
  };

  const chamberGeometryAtPhase = (phase) => {
    const crank = crankKinematics(phase);
    const hammer = hammerKinematics(phase);
    const cylinderInnerBottomY = crank.cylinderCenterY
      - cylinderHalfChamberHeight;
    const cylinderInnerTopY = crank.cylinderCenterY
      + cylinderHalfChamberHeight;
    const pistonBottomY = hammer.pistonCenterY - pistonThickness / 2;
    const pistonTopY = hammer.pistonCenterY + pistonThickness / 2;
    const lowerChamberHeight = pistonBottomY - cylinderInnerBottomY;
    const upperChamberHeight = cylinderInnerTopY - pistonTopY;
    return {
      crank,
      cylinderInnerBottomY,
      cylinderInnerTopY,
      hammer,
      lowerChamberHeight,
      lowerChamberVolume: pistonArea * lowerChamberHeight,
      pistonBottomY,
      pistonTopY,
      upperChamberHeight,
      upperChamberVolume: pistonArea * upperChamberHeight,
    };
  };

  const lowerSealGeometry = chamberGeometryAtPhase(hammerImpactPhase);
  const upperSealGeometry = chamberGeometryAtPhase(upperAirSealPhase);
  const lowerReferenceVolume = lowerSealGeometry.lowerChamberVolume;
  const upperReferenceVolume = upperSealGeometry.upperChamberVolume;
  const lowerPolytropicConstant = atmosphericPressurePascal
    * lowerReferenceVolume ** polytropicExponent;
  const upperPolytropicConstant = atmosphericPressurePascal
    * upperReferenceVolume ** polytropicExponent;

  const stateAtPhase = (unwrappedPhase) => {
    const rawPhase = positiveModulo(unwrappedPhase, 1);
    const phase = [0, hammerImpactPhase, hammerLiftStartPhase,
      cylinderTopCenterPhase, upperAirSealPhase].find((boundary) =>
      Math.abs(rawPhase - boundary) < 1e-12) ?? rawPhase;
    const chamber = chamberGeometryAtPhase(phase);
    let lowerPressurePascal = atmosphericPressurePascal;
    let upperPressurePascal = atmosphericPressurePascal;
    let lowerChamberMode = 'vented-through-port-e';
    let upperChamberMode = 'vented-through-port-e';
    if (phase >= hammerImpactPhase && phase < cylinderTopCenterPhase) {
      const sealedLowerPressure = lowerPolytropicConstant
        / chamber.lowerChamberVolume ** polytropicExponent;
      if (sealedLowerPressure >= atmosphericPressurePascal) {
        lowerPressurePascal = sealedLowerPressure;
        lowerChamberMode = 'sealed-lower-charge-compression-and-expansion';
      } else {
        lowerChamberMode =
          'port-e-admits-atmospheric-air-after-lower-charge-expansion';
      }
    }
    if (phase >= upperAirSealPhase || phase < hammerImpactPhase) {
      const sealedUpperPressure = upperPolytropicConstant
        / chamber.upperChamberVolume ** polytropicExponent;
      if (sealedUpperPressure >= atmosphericPressurePascal) {
        upperPressurePascal = sealedUpperPressure;
        upperChamberMode = phase < hammerImpactPhase
          ? 'sealed-upper-charge-expansion-after-bottom-center'
          : 'sealed-upper-charge-compression-before-bottom-center';
      } else {
        upperChamberMode =
          'port-e-admits-atmospheric-air-after-upper-charge-expansion';
      }
    }
    const pneumaticForce = pistonArea
      * (lowerPressurePascal - upperPressurePascal);
    const weightForce = movingHammerMassKilogram * gravity;
    const netAppliedForce = pneumaticForce - weightForce;
    const lowerPolytropicResidual = lowerChamberMode.startsWith('sealed')
      ? lowerPressurePascal * chamber.lowerChamberVolume ** polytropicExponent
        - lowerPolytropicConstant
      : 0;
    const upperPolytropicResidual = upperChamberMode.startsWith('sealed')
      ? upperPressurePascal * chamber.upperChamberVolume ** polytropicExponent
        - upperPolytropicConstant
      : 0;
    return {
      ...chamber,
      lowerChamberMode,
      lowerPolytropicResidual,
      lowerPressurePascal,
      netAppliedForce,
      phase,
      pneumaticForce,
      upperChamberMode,
      upperPolytropicResidual,
      upperPressurePascal,
      weightForce,
    };
  };

  const stateAtTime = (time) => stateAtPhase(time / cycleDuration);
  const bottomState = stateAtPhase(0);
  const storedUpperAirEnergyJoule = (
    bottomState.upperPressurePascal * bottomState.upperChamberVolume
      - atmosphericPressurePascal * upperReferenceVolume
  ) / (polytropicExponent - 1);

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.66,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.46,
    roughness: 0.36,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.22,
    roughness: 0.46,
  });
  const cylinderMaterial = matte(PALETTE.driven, {
    transparent: true,
    opacity: 0.38,
    roughness: 0.30,
    side: THREE.DoubleSide,
  });
  cylinderMaterial.depthWrite = false;
  const hammerMaterial = matte(PALETTE.driver, {
    metalness: 0.27,
    roughness: 0.46,
  });
  const rodMaterial = matte(PALETTE.accent, {
    metalness: 0.36,
    roughness: 0.42,
  });
  const lowerAirMaterial = matte(0x9dd8e6, {
    transparent: true,
    opacity: 0.34,
    roughness: 0.18,
  });
  const upperAirMaterial = matte(0xf0b468, {
    transparent: true,
    opacity: 0.42,
    roughness: 0.18,
  });
  lowerAirMaterial.depthWrite = false;
  upperAirMaterial.depthWrite = false;

  const foundation = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(3.25, 0.18, 1.62),
    frameMaterial,
  ), 'hotchkiss-hammer-foundation');
  foundation.position.set(0, groundY + 0.09, 0);
  root.add(foundation);
  const fixedFrame = addRole(new THREE.Group(),
    'fixed-tall-atmospheric-hammer-frame');
  root.add(fixedFrame);
  for (const side of [-1, 1]) {
    const column = new THREE.Mesh(
      new THREE.BoxGeometry(0.27, 5.47, 0.48),
      frameMaterial,
    );
    column.position.set(side * 1.18, 1.575, -0.18);
    fixedFrame.add(column);
    const flaredFoot = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.25, 0.78),
      frameMaterial,
    );
    flaredFoot.position.set(side * 1.18, groundY + 0.20, -0.12);
    fixedFrame.add(flaredFoot);
  }
  const crown = new THREE.Mesh(
    new THREE.BoxGeometry(2.62, 0.29, 0.62),
    frameMaterial,
  );
  crown.position.set(0, 4.45, -0.18);
  fixedFrame.add(crown);

  const crankAssembly = addRole(new THREE.Group(),
    'constant-speed-driving-crank-A');
  crankAssembly.position.copy(crankCenter);
  root.add(crankAssembly);
  const crankDisk = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(crankRadius * 0.66, crankRadius * 0.66,
      0.22, 40),
    hammerMaterial,
  ), 'crank-A-disk');
  crankDisk.rotation.x = Math.PI / 2;
  crankAssembly.add(crankDisk);
  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.10, 0.12),
    darkMaterial,
  );
  crankArm.position.x = crankRadius / 2;
  crankAssembly.add(crankArm);
  const crankPinVisual = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.095, 0.30, 24),
    rodMaterial,
  ), 'crank-A-pin');
  crankPinVisual.rotation.x = Math.PI / 2;
  crankPinVisual.position.x = crankRadius;
  crankAssembly.add(crankPinVisual);
  const fixedDriveShaft = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 1.34, 28),
    darkMaterial,
  ), 'fixed-rotary-driving-shaft');
  fixedDriveShaft.rotation.x = Math.PI / 2;
  fixedDriveShaft.position.copy(crankCenter);
  fixedDriveShaft.position.z = 0;
  root.add(fixedDriveShaft);

  const connectingRod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 1, 22),
    rodMaterial,
  ), 'constant-length-connecting-rod-D');
  root.add(connectingRod);

  const movingCylinder = addRole(new THREE.Group(),
    'vertically-reciprocating-cylinder-B');
  root.add(movingCylinder);
  const cylinderShell = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      cylinderOuterRadius,
      cylinderOuterRadius,
      cylinderHalfChamberHeight * 2 + 0.16,
      48,
      1,
      true,
      Math.PI * 0.14,
      Math.PI * 1.70,
    ),
    cylinderMaterial,
  ), 'front-cutaway-moving-cylinder-shell-B');
  movingCylinder.add(cylinderShell);
  const cylinderDriveLug = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.28, 0.30),
    drivenMaterial,
  ), 'cylinder-B-drive-lug-for-rod-D');
  cylinderDriveLug.position.set(
    0,
    -cylinderDriveAttachmentOffsetY,
    crankCenter.z,
  );
  movingCylinder.add(cylinderDriveLug);
  const atmosphericPort = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.24, 22),
    matte(PALETTE.white, { roughness: 0.42 }),
  ), 'atmospheric-admission-hole-e');
  atmosphericPort.rotation.z = Math.PI / 2;
  atmosphericPort.position.set(-cylinderOuterRadius - 0.10, 0.20, 0.18);
  movingCylinder.add(atmosphericPort);

  const hammerAssembly = addRole(new THREE.Group(),
    'free-piston-rod-and-hammer-C-assembly');
  root.add(hammerAssembly);
  const piston = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      cylinderInnerRadius,
      cylinderInnerRadius,
      pistonThickness,
      40,
    ),
    hammerMaterial,
  ), 'free-air-piston');
  hammerAssembly.add(piston);
  const pistonSeal = new THREE.Mesh(
    new THREE.TorusGeometry(cylinderInnerRadius * 0.97, 0.028, 8, 44),
    darkMaterial,
  );
  pistonSeal.rotation.x = Math.PI / 2;
  hammerAssembly.add(pistonSeal);
  const hammerHeadOffsetY = hammerHeadContactCenterY
    - pistonContactCenterY;
  const pistonRodTopY = -pistonThickness / 2;
  const pistonRodBottomY = hammerHeadOffsetY + hammerHeadHeight / 2;
  const pistonRod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.068,
      0.068,
      pistonRodTopY - pistonRodBottomY,
      24,
    ),
    darkMaterial,
  ), 'rigid-piston-to-hammer-rod');
  pistonRod.position.y = (pistonRodTopY + pistonRodBottomY) / 2;
  hammerAssembly.add(pistonRod);
  const hammerHead = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.27, hammerHeadHeight, 34),
    hammerMaterial,
  ), 'hammer-head-C');
  hammerHead.position.y = hammerHeadOffsetY;
  hammerAssembly.add(hammerHead);
  const hammerFace = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.045, 34),
    darkMaterial,
  ), 'hammer-C-striking-face');
  hammerFace.position.y = hammerHeadOffsetY - hammerHeadHeight / 2;
  hammerAssembly.add(hammerFace);

  const lowerAirChamber = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      cylinderInnerRadius * 0.91,
      cylinderInnerRadius * 0.91,
      1,
      34,
    ),
    lowerAirMaterial,
  ), 'lower-air-charge-compressed-during-cylinder-ascent');
  root.add(lowerAirChamber);
  const upperAirChamber = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      cylinderInnerRadius * 0.91,
      cylinderInnerRadius * 0.91,
      1,
      34,
    ),
    upperAirMaterial,
  ), 'upper-air-charge-compressed-during-cylinder-descent');
  root.add(upperAirChamber);

  const anvil = addRole(new THREE.Group(), 'fixed-hotchkiss-anvil');
  root.add(anvil);
  const anvilBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.46, 0.42, 36),
    matte(PALETTE.brass, { metalness: 0.36, roughness: 0.43 }),
  );
  anvilBody.position.set(cylinderAxisX, anvilTopY - 0.21, 0);
  anvil.add(anvilBody);
  const anvilFace = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.39, 0.39, 0.052, 38),
    darkMaterial,
  ), 'fixed-anvil-face');
  anvilFace.position.set(cylinderAxisX, anvilTopY - 0.026, 0);
  anvil.add(anvilFace);

  const update = (time) => {
    const state = stateAtTime(time);
    crankAssembly.rotation.z = state.crank.crankAngle;
    movingCylinder.position.set(
      cylinderAxisX,
      state.crank.cylinderCenterY,
      0,
    );
    hammerAssembly.position.set(
      cylinderAxisX,
      state.hammer.pistonCenterY,
      0,
    );
    setRodBetween(
      connectingRod,
      state.crank.crankPin,
      state.crank.cylinderDrivePin,
    );
    lowerAirChamber.scale.y = Math.max(
      0.001,
      state.lowerChamberHeight,
    );
    lowerAirChamber.position.set(
      cylinderAxisX,
      state.cylinderInnerBottomY + state.lowerChamberHeight / 2,
      0,
    );
    upperAirChamber.scale.y = Math.max(
      0.001,
      state.upperChamberHeight,
    );
    upperAirChamber.position.set(
      cylinderAxisX,
      state.pistonTopY + state.upperChamberHeight / 2,
      0,
    );
    lowerAirChamber.visible = state.lowerPressurePascal
      > atmosphericPressurePascal * 1.004;
    upperAirChamber.visible = state.upperPressurePascal
      > atmosphericPressurePascal * 1.004;
    lowerAirMaterial.opacity = 0.24 + 0.25 * THREE.MathUtils.clamp(
      state.lowerPressurePascal / atmosphericPressurePascal - 1,
      0,
      1.6,
    );
    upperAirMaterial.opacity = 0.28 + 0.22 * THREE.MathUtils.clamp(
      state.upperPressurePascal / atmosphericPressurePascal - 1,
      0,
      1.6,
    );
  };

  const sourceState = stateAtPhase(0.82);
  const geometry = {
    anvilTopY,
    atmosphericPressurePascal,
    bottomHorizontalOffset,
    bottomVerticalReach,
    connectingRodLength,
    crankAngularVelocity,
    crankCenter: crankCenter.clone(),
    crankRadius,
    cylinderAxisX,
    cylinderBottomCenterY,
    cylinderDriveAttachmentOffsetY,
    cylinderDrivePinBottomY,
    cylinderHalfChamberHeight,
    cylinderInnerRadius,
    cylinderOuterRadius,
    cylinderTopCenterPhase,
    cycleDuration,
    gravity,
    hammerHeadContactCenterY,
    hammerHeadHeight,
    hammerImpactPhase,
    hammerLiftStartPhase,
    impactKineticEnergyJoule:
      0.5 * movingHammerMassKilogram * impactSpeed ** 2,
    impactImpulseNewtonSecond: movingHammerMassKilogram * impactSpeed,
    impactSpeed,
    lowerPolytropicConstant,
    lowerReferenceVolume,
    maximumHammerLift,
    movingHammerMassKilogram,
    pistonArea,
    pistonContactCenterY,
    pistonThickness,
    polytropicExponent,
    preBlowLift,
    storedUpperAirEnergyJoule,
    upperAirSealPhase,
    upperDriveDuration,
    upperDrivePhaseSpan,
    upperPolytropicConstant,
    upperReferenceVolume,
  };

  root.userData = {
    archetype:
      'hotchkiss-atmospheric-hammer-with-crank-reciprocated-cylinder-free-hammer-piston-alternating-polytropic-air-cushions-and-post-bottom-center-blow',
    blocks: {
      anvil,
      anvilFace,
      atmosphericPort,
      connectingRod,
      crankAssembly,
      crankDisk,
      crankPinVisual,
      cylinderDriveLug,
      cylinderShell,
      fixedDriveShaft,
      fixedFrame,
      foundation,
      hammerAssembly,
      hammerFace,
      hammerHead,
      lowerAirChamber,
      movingCylinder,
      piston,
      pistonRod,
      upperAirChamber,
    },
    chamberGeometryAtPhase,
    crankKinematics,
    degreesOfFreedom: {
      crankAndCylinderIndependent: false,
      cylinderAndHammerPistonIndependent: true,
      independentPrescribedInputs: 1,
      physicalOperatingDegreesOfFreedom: 2,
      pistonAndHammerIndependent: false,
    },
    dynamics: {
      coupledPistonMassDifferentialEquationPortFlowLeakageHeatTransferFrictionFrameFlexAndImpactComplianceSolved:
        false,
      gasModel:
        'Each trapped charge obeys an exact P*V^1.35 constant from its atmospheric sealing volume. Pressure is never drawn below atmosphere because port e supplies air to an expanding vented chamber.',
      motionModel:
        'The driving crank and cylinder use exact in-line slider-crank geometry. The free hammer schedule preserves Brown’s event order, finite impact speed and chamber-volume changes; it is not presented as a numerically integrated prediction of an undocumented mass, port or loss system.',
    },
    fidelity: 'authored',
    geometry,
    hammerKinematics,
    mechanism:
      'Crank A drives vertically reciprocating cylinder B through constant-length rod D. The piston, its rod and hammer C form a second moving assembly. During cylinder ascent a lower atmospheric charge is trapped and compressed to lift the hammer. During descent an upper charge admitted through hole e is trapped and compressed. That stored upper charge crosses bottom center still sealed, expands as the cylinder reverses upward, and drives the hammer blow.',
    motion: {
      cycleDuration,
      motionType:
        'constant-speed-offset-slider-crank-cylinder-with-lower-air-lift-upper-air-compression-and-post-bottom-center-expansion-blow',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      sourcePrescribedAbsoluteTiming: false,
      sourcePrescribedNormalizedTiming: false,
    },
    sourcePose: {
      crankAngle: sourceState.crank.crankAngle,
      cylinderCenterY: sourceState.crank.cylinderCenterY,
      hammerLift: sourceState.hammer.lift,
      upperPressurePascal: sourceState.upperPressurePascal,
    },
    sourceReference: {
      brownPlate471: {
        approximateCrankABoundsPixels: [215, 247, 102, 112],
        approximateCylinderBBoundsPixels: [222, 79, 81, 183],
        approximateFrameBoundsPixels: [137, 13, 228, 496],
        approximateHammerCBoundsPixels: [221, 304, 84, 61],
        approximateRodDBoundsPixels: [281, 173, 50, 147],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 13,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'hammer head C is attached to a piston fitted inside cylinder B',
          'cylinder B is connected by rod D to crank A on the rotary driving shaft',
          'as the cylinder ascends air entering hole e is compressed below the piston and lifts the hammer',
          'as the cylinder descends air entering hole e is compressed above the piston',
          'the upper compressed air is stored to produce the blow by expansion after crank and rod pass bottom center',
        ],
        engravingEvidence:
          'Brown shows a tall open frame, an upper moving cylinder marked B with side hole e, a separate piston rod and hammer C, crank A below, and an oblique connecting rod D from the crank pin to the cylinder.',
        reconstructionDisclosure:
          'Brown gives no dimensions, speed, piston mass, port timing, chamber volumes, compression exponent, pressure, stroke law or impact compliance. A 2.8-second cycle, exact 0.68-radius/1.55-rod in-line crank-slider, four event phases, 1.35 polytropic charges, prescribed free-hammer trajectory, colors and ideal contact are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 471',
    },
    stateAtPhase,
    stateAtTime,
    transmission: {
      crankToCylinder:
        'distance from crank-A pin to cylinder-B drive pin is constant connecting-rod length while the cylinder pin remains on one vertical guide axis',
      lowerAir:
        'atmospheric charge trapped just after the blow is compressed below the piston during cylinder ascent and supplies upward force',
      rigidHammer:
        'free piston, piston rod and hammer C share one translation distinct from cylinder B translation',
      upperAir:
        'air admitted after top center is trapped during cylinder descent; P*V^gamma remains constant across bottom center and through the following expansion/blow interval',
    },
    update,
  };
  correctHammerWorkingParts(root, 471);
  buildLoopColumn(root, fixedFrame, frameMaterial, groundY, {
    anvilBottomY: anvilTopY - 0.47,
    axisX: cylinderAxisX,
    cylinderOuterRadius,
  });
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(cylinderAxisX - 1.85, groundY - 0.05, -1.22),
    new THREE.Vector3(cylinderAxisX + 1.85, 5.08, 1.12),
  );
  root.userData.cameraDistanceScale = 1.00;
  root.userData.cameraDirection = new THREE.Vector3(.7, 1.0, 15);
  root.userData.groundFloorY = groundY;

  markShadows(root);
  for (const object of [cylinderShell, lowerAirChamber, upperAirChamber]) {
    object.castShadow = false;
  }
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredAtmosphericHammerMovement(movement) {
  if (movement.id !== 471) return null;
  return atmosphericHammer(movement);
}
