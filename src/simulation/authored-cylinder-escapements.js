import cylinderContactData from './baked/cylinder-contact.js';
import {installCylinderContact} from './cylinder-contact-motion.js';
import * as THREE from 'three';
import {correctCylinderWorkingParts, finishCylinderReview} from './cylinder-escapement-working-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function rotate2(point, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
}

function crossZ(point) {
  return new THREE.Vector2(-point.y, point.x);
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function taperedCylinderAlongZ(
  firstRadius,
  secondRadius,
  length,
  material,
  segments = 32,
) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(secondRadius, firstRadius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevelSize = 0.008, curveSegments = 12) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
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

function annularShape(outerRadius, innerRadius) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const opening = new THREE.Path();
  opening.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(opening);
  return shape;
}

function annularSectorShape(
  outerRadius,
  innerRadius,
  startAngle,
  sweep,
  segments = 72,
) {
  const points = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = startAngle + sweep * index / segments;
    points.push(new THREE.Vector2(
      Math.cos(angle) * outerRadius,
      Math.sin(angle) * outerRadius,
    ));
  }
  for (let index = segments; index >= 0; index -= 1) {
    const angle = startAngle + sweep * index / segments;
    points.push(new THREE.Vector2(
      Math.cos(angle) * innerRadius,
      Math.sin(angle) * innerRadius,
    ));
  }
  return polygonShape(points);
}

function beamBetween(start, end, width, depth, material) {
  const direction = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(direction.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(direction.y, direction.x);
  return beam;
}

function edgeTube(points, z, radius, material, role, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, point.y, z)),
    closed,
    'centripetal',
  );
  const edge = new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      Math.max(36, points.length * 2),
      radius,
      8,
      closed,
    ),
    material,
  );
  edge.userData.role = role;
  return edge;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (x * (x * 6 - 15) + 10);
}

function smootherStepDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * x ** 2 * (x - 1) ** 2;
}

function smootherStepSecondDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * x * (2 * x ** 2 - 3 * x + 1);
}

function cylinderEscapementPerspective(movement) {
  const root = new THREE.Group();

  // Brown's 294 is a perspective construction view: the balance staff is a
  // hollow cylinder whose middle working band has a sector cut away. The
  // paired 295 plan establishes the action. Raised, oblique pallets on one
  // escape wheel lock first on the cylinder's outside and then on its inside;
  // the two intervening lip passages impulse the balance in opposite senses.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterAxisCenter = new THREE.Vector2(271, 252);
  const sourceRasterLeftPivotTip = new THREE.Vector2(20, 253);
  const sourceRasterBodyStart = new THREE.Vector2(143, 252);
  const sourceRasterWorkingBandStart = new THREE.Vector2(217, 278);
  const sourceRasterWorkingBandEnd = new THREE.Vector2(276, 290);
  const sourceRasterBodyEnd = new THREE.Vector2(399, 252);
  const sourceRasterRightPivotTip = new THREE.Vector2(516, 253);
  const sourceRasterLeftCollarCenter = new THREE.Vector2(145, 253);
  const sourceRasterRightCollarCenter = new THREE.Vector2(444, 252);
  const sourceRasterOuterRadius = 39;
  const sourceRasterWorkingBandWidth = 59;
  const sourceAxialScale = 0.0093;

  const cylinderCenter = new THREE.Vector2(0, -1.55+cylinderContactData.centerDistance);
  const wheelCenter = new THREE.Vector2(0, -1.55);
  const centerDistance = cylinderCenter.distanceTo(wheelCenter);
  const toothCount = 15;
  const toothPitch = FULL_TURN / toothCount;
  const toothOrbitRadius = cylinderContactData.pointRadius;
  const outerEntryWheelAngle = Math.PI / 2 + toothPitch / 2;
  const entryImpulseAdvance = THREE.MathUtils.degToRad(3);
  const freeDropAdvance = THREE.MathUtils.degToRad(18);
  const entryTotalAdvance = entryImpulseAdvance + freeDropAdvance;
  const exitImpulseAdvance = toothPitch - entryTotalAdvance;
  const innerLockWheelAngle = outerEntryWheelAngle - entryTotalAdvance;
  const outerExitWheelAngle = outerEntryWheelAngle - toothPitch;
  const toothReferencePointAtAngle = (angle) => wheelCenter.clone().add(
    new THREE.Vector2(
      Math.cos(angle) * toothOrbitRadius,
      Math.sin(angle) * toothOrbitRadius,
    ),
  );
  const outerLockPoint = toothReferencePointAtAngle(outerEntryWheelAngle);
  const innerLockPoint = toothReferencePointAtAngle(innerLockWheelAngle);
  const outerExitPoint = toothReferencePointAtAngle(outerExitWheelAngle);
  const cylinderOuterRadius = cylinderContactData.outerRadius;
  const cylinderInnerRadius = cylinderContactData.innerRadius;
  const cylinderWallThickness = cylinderOuterRadius - cylinderInnerRadius;
  const sourceRadialScale = cylinderOuterRadius / sourceRasterOuterRadius;

  const cylinderBodyStartZ = (
    sourceRasterBodyStart.x - sourceRasterAxisCenter.x
  ) * sourceAxialScale;
  const cylinderBodyEndZ = (
    sourceRasterBodyEnd.x - sourceRasterAxisCenter.x
  ) * sourceAxialScale;
  const workingBandStartZ = (
    sourceRasterWorkingBandStart.x - sourceRasterAxisCenter.x
  ) * sourceAxialScale;
  const workingBandEndZ = (
    sourceRasterWorkingBandEnd.x - sourceRasterAxisCenter.x
  ) * sourceAxialScale;
  const workingBandWidth = workingBandEndZ - workingBandStartZ;
  const workingPlaneZ = (workingBandStartZ + workingBandEndZ) / 2;
  const leftTubeLength = workingBandStartZ - cylinderBodyStartZ;
  const rightTubeLength = cylinderBodyEndZ - workingBandEndZ;
  const cylinderShellStartAngle = THREE.MathUtils.degToRad(172);
  const cylinderShellSweep = THREE.MathUtils.degToRad(196);

  const balancePeriod = 4;
  const balanceAmplitude = THREE.MathUtils.degToRad(44);
  const entryStart = 0.18;
  const entryEnd = 0.23;
  const innerLanding = 0.28;
  const exitStart = 0.68;
  const exitEnd = 0.73;
  const outerLanding = exitEnd;

  const sourcePointToModel = ({ x, y }) => new THREE.Vector3(
    cylinderCenter.x,
    cylinderCenter.y
      + (sourceRasterAxisCenter.y - y) * sourceRadialScale,
    (x - sourceRasterAxisCenter.x) * sourceAxialScale,
  );
  const cycleAtTime = (time) => {
    const coordinate = time / balancePeriod;
    const cycleIndex = Math.floor(coordinate);
    return {
      cycleIndex,
      phase: coordinate - cycleIndex,
    };
  };
  const balanceStateAtPhase = (phase) => {
    const argument = FULL_TURN * (phase - 0.25);
    const angularFrequency = FULL_TURN / balancePeriod;
    return {
      angle: balanceAmplitude * Math.sin(argument),
      angularAcceleration: -balanceAmplitude * angularFrequency ** 2
        * Math.sin(argument),
      angularSpeed: balanceAmplitude * angularFrequency
        * Math.cos(argument),
    };
  };
  const steppedAdvance = (phase, start, end, base, amount) => {
    const duration = (end - start) * balancePeriod;
    const progress = (phase - start) / (end - start);
    return {
      advance: base + amount * smootherStep(progress),
      angularAcceleration: -amount
        * smootherStepSecondDerivative(progress) / duration ** 2,
      angularSpeed: -amount
        * smootherStepDerivative(progress) / duration,
      progress: THREE.MathUtils.clamp(progress, 0, 1),
    };
  };
  const wheelStateAtPhase = (phase) => {
    if (phase < entryStart) {
      return {
        advance: 0,
        angularAcceleration: 0,
        angularSpeed: 0,
        event: 'outer-rest',
        progress: 0,
      };
    }
    if (phase < entryEnd) {
      return {
        ...steppedAdvance(
          phase,
          entryStart,
          entryEnd,
          0,
          entryImpulseAdvance,
        ),
        event: 'entry-impulse',
      };
    }
    if (phase < innerLanding) {
      return {
        ...steppedAdvance(
          phase,
          entryEnd,
          innerLanding,
          entryImpulseAdvance,
          freeDropAdvance,
        ),
        event: 'free-drop-inside-cylinder',
      };
    }
    if (phase < exitStart) {
      return {
        advance: entryTotalAdvance,
        angularAcceleration: 0,
        angularSpeed: 0,
        event: 'inner-rest',
        progress: 0,
      };
    }
    if (phase < exitEnd) {
      return {
        ...steppedAdvance(
          phase,
          exitStart,
          exitEnd,
          entryTotalAdvance,
          exitImpulseAdvance,
        ),
        event: 'exit-impulse',
      };
    }
    return {
      advance: toothPitch,
      angularAcceleration: 0,
      angularSpeed: 0,
      event: 'next-outer-rest',
      progress: 1,
    };
  };
  const wheelAngleAtCyclePhase = (cycleIndex, phase) => (
    outerEntryWheelAngle
      - cycleIndex * toothPitch
      - wheelStateAtPhase(phase).advance
  );
  const toothReferencePoint = (wheelAngle, toothIndex) => {
    const angle = wheelAngle + toothIndex * toothPitch;
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * toothOrbitRadius,
      Math.sin(angle) * toothOrbitRadius,
    ));
  };
  const impulseLocalPointAtPhase = (phase) => {
    const balanceState = balanceStateAtPhase(phase);
    const wheelAngle = wheelAngleAtCyclePhase(0, phase);
    return rotate2(
      toothReferencePoint(wheelAngle, 0).sub(cylinderCenter),
      -balanceState.angle,
    );
  };
  const contactFrameAtPhase = (phase) => {
    const epsilon = 1e-6;
    const point = impulseLocalPointAtPhase(phase);
    const tangent = impulseLocalPointAtPhase(phase + epsilon)
      .sub(impulseLocalPointAtPhase(phase - epsilon)).normalize();
    return {
      normal: new THREE.Vector2(-tangent.y, tangent.x),
      point,
      tangent,
    };
  };
  const profilePoints = (start, end, count = 41) => Array.from(
    { length: count },
    (_, index) => impulseLocalPointAtPhase(THREE.MathUtils.lerp(
      start,
      end,
      index / (count - 1),
    )),
  );
  const entryLipPoints = profilePoints(entryStart, entryEnd);
  const exitLipPoints = profilePoints(exitStart, exitEnd);
  const innerLockPoints = profilePoints(innerLanding, exitStart, 57);
  const outerLockPoints = [
    ...profilePoints(outerLanding, 1, 39),
    ...profilePoints(0, entryStart, 27).slice(1),
  ];

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.50,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    roughness: 0.50,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.14,
    roughness: 0.45,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.32,
    roughness: 0.40,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.38 });

  const cylinderAssembly = new THREE.Group();
  cylinderAssembly.position.set(cylinderCenter.x, cylinderCenter.y, 0);
  cylinderAssembly.userData.axis = Z_AXIS.clone();
  cylinderAssembly.userData.role =
    'balance-carried-hollow-cutaway-cylinder-A-B';

  const leftTube = new THREE.Mesh(
    centeredExtrusion(
      annularShape(cylinderOuterRadius, cylinderInnerRadius),
      leftTubeLength,
      0.004,
    ),
    drivenMaterial,
  );
  leftTube.position.z = (cylinderBodyStartZ + workingBandStartZ) / 2;
  leftTube.userData.role = 'full-hollow-cylinder-tube-below-working-band';
  const rightTube = new THREE.Mesh(
    centeredExtrusion(
      annularShape(cylinderOuterRadius, cylinderInnerRadius),
      rightTubeLength,
      0.004,
    ),
    drivenMaterial,
  );
  rightTube.position.z = (workingBandEndZ + cylinderBodyEndZ) / 2;
  rightTube.userData.role = 'full-hollow-cylinder-tube-above-working-band';
  const workingShell = new THREE.Mesh(
    centeredExtrusion(
      annularSectorShape(
        cylinderOuterRadius,
        cylinderInnerRadius,
        cylinderShellStartAngle,
        cylinderShellSweep,
      ),
      workingBandWidth,
      0.003,
    ),
    drivenMaterial,
  );
  workingShell.position.z = workingPlaneZ;
  workingShell.userData.role =
    '196-degree-cylinder-shell-in-central-escape-wheel-band';
  const lowerBandRing = new THREE.Mesh(
    new THREE.TorusGeometry(cylinderOuterRadius, 0.035, 9, 54),
    darkMaterial,
  );
  lowerBandRing.position.z = workingBandStartZ;
  lowerBandRing.userData.role = 'lower-rim-of-perspective-cylinder-window';
  const upperBandRing = new THREE.Mesh(
    new THREE.TorusGeometry(cylinderOuterRadius, 0.035, 9, 54),
    darkMaterial,
  );
  upperBandRing.position.z = workingBandEndZ;
  upperBandRing.userData.role = 'upper-rim-of-perspective-cylinder-window';

  const makeLipRail = (angle, name) => {
    const radial = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
    const rail = beamBetween(
      new THREE.Vector3(
        radial.x * cylinderInnerRadius,
        radial.y * cylinderInnerRadius,
        workingPlaneZ,
      ),
      new THREE.Vector3(
        radial.x * cylinderOuterRadius,
        radial.y * cylinderOuterRadius,
        workingPlaneZ,
      ),
      0.052,
      workingBandWidth + 0.035,
      accentMaterial,
    );
    rail.userData.beveled = true;
    rail.userData.role = name;
    return rail;
  };
  const entryLipRail = makeLipRail(
    cylinderShellStartAngle,
    'beveled-entry-lip-of-cylinder',
  );
  const exitLipRail = makeLipRail(
    cylinderShellStartAngle + cylinderShellSweep,
    'beveled-exit-lip-of-cylinder',
  );

  const entryLipTrace = edgeTube(
    entryLipPoints,
    workingPlaneZ + 0.14,
    0.032,
    accentMaterial,
    'generated-entry-lip-working-contact-trace',
  );
  const exitLipTrace = edgeTube(
    exitLipPoints,
    workingPlaneZ + 0.15,
    0.032,
    accentMaterial,
    'generated-exit-lip-working-contact-trace',
  );
  const outerLockTrace = edgeTube(
    outerLockPoints,
    workingPlaneZ + 0.13,
    0.024,
    indexMaterial,
    'outside-cylinder-frictional-rest-trace',
  );
  const innerLockTrace = edgeTube(
    innerLockPoints,
    workingPlaneZ + 0.13,
    0.024,
    indexMaterial,
    'inside-cylinder-frictional-rest-trace',
  );

  const balanceStaff = cylinderAlongZ(0.105, 4.30, darkMaterial, 30);
  balanceStaff.userData.role = 'balance-staff-through-hollow-cylinder';
  const lowerCollar = cylinderAlongZ(
    cylinderOuterRadius + 0.12,
    0.24,
    drivenMaterial,
    42,
  );
  lowerCollar.position.z = cylinderBodyStartZ - 0.13;
  lowerCollar.userData.role = 'lower-cylinder-collar';
  const lowerCone = taperedCylinderAlongZ(
    0.28,
    cylinderOuterRadius + 0.08,
    0.46,
    drivenMaterial,
    42,
  );
  lowerCone.position.z = cylinderBodyStartZ - 0.46;
  lowerCone.userData.role = 'lower-tapered-cylinder-collet';
  const upperCollar = cylinderAlongZ(
    cylinderOuterRadius + 0.13,
    0.27,
    drivenMaterial,
    42,
  );
  upperCollar.position.z = cylinderBodyEndZ + 0.145;
  upperCollar.userData.role = 'upper-cylinder-collar';
  const upperCone = taperedCylinderAlongZ(
    cylinderOuterRadius + 0.09,
    0.31,
    0.40,
    drivenMaterial,
    42,
  );
  upperCone.position.z = cylinderBodyEndZ + 0.47;
  upperCone.userData.role = 'upper-tapered-balance-collet';

  const balancePlaneZ = cylinderBodyEndZ + 0.92;
  const balanceRim = new THREE.Mesh(
    new THREE.TorusGeometry(1.28, 0.105, 12, 72),
    drivenMaterial,
  );
  balanceRim.position.z = balancePlaneZ;
  balanceRim.userData.role = 'balance-wheel-attached-to-top-of-cylinder';
  const balanceSpokes = [];
  for (let index = 0; index < 3; index += 1) {
    const angle = index * FULL_TURN / 3;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.11, 0.14),
      drivenMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * 0.59,
      Math.sin(angle) * 0.59,
      balancePlaneZ,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `cylinder-balance-spoke-${index + 1}`;
    balanceSpokes.push(spoke);
    cylinderAssembly.add(spoke);
  }
  const balanceIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 18, 14),
    indexMaterial,
  );
  balanceIndex.position.set(0, 1.28, balancePlaneZ + 0.10);
  balanceIndex.userData.role = 'white-index-on-cylinder-balance-wheel';

  cylinderAssembly.add(
    leftTube,
    rightTube,
    workingShell,
    lowerBandRing,
    upperBandRing,
    entryLipRail,
    exitLipRail,
    entryLipTrace,
    exitLipTrace,
    outerLockTrace,
    innerLockTrace,
    balanceStaff,
    lowerCollar,
    lowerCone,
    upperCollar,
    upperCone,
    balanceRim,
    balanceIndex,
  );

  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role =
    'clockwise-fifteen-pallet-cylinder-escape-wheel';
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'stepping-cylinder-escape-wheel-rotor';
  escapeWheel.add(wheelRotor);
  const wheelPlaneZ = workingPlaneZ - 0.72;
  const wheelDepth = 0.24;
  const wheelOuterRadius = 2.58;
  const wheelInnerRadius = 1.97;
  const wheelRim = new THREE.Mesh(
    centeredExtrusion(
      annularShape(wheelOuterRadius, wheelInnerRadius),
      wheelDepth,
      0.007,
      96,
    ),
    driverMaterial,
  );
  wheelRim.position.z = wheelPlaneZ;
  wheelRim.userData.role = 'cylinder-escape-wheel-annular-rim';
  wheelRotor.add(wheelRim);
  const wheelSpokes = [];
  for (let index = 0; index < 5; index += 1) {
    const angle = index * FULL_TURN / 5;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(2.10, 0.18, wheelDepth * 0.82),
      driverMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * 1.05,
      Math.sin(angle) * 1.05,
      wheelPlaneZ,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `cylinder-escape-wheel-spoke-${index + 1}`;
    wheelSpokes.push(spoke);
    wheelRotor.add(spoke);
  }
  const wheelHub = cylinderAlongZ(0.39, 0.72, darkMaterial, 36);
  wheelHub.position.z = wheelPlaneZ;
  wheelHub.userData.role = 'cylinder-escape-wheel-hub';
  const wheelShaft = cylinderAlongZ(0.12, 1.80, darkMaterial, 32);
  wheelShaft.position.z = wheelPlaneZ;
  wheelShaft.userData.role = 'fixed-cylinder-escape-wheel-arbor';
  wheelRotor.add(wheelHub);
  escapeWheel.add(wheelShaft);

  const palletShape = polygonShape([
    new THREE.Vector2(2.67, -0.15),
    new THREE.Vector2(3.10, -0.08),
    new THREE.Vector2(3.05, 0.02),
    new THREE.Vector2(3.09, 0.11),
    new THREE.Vector2(2.70, 0.17),
  ]);
  const palletDepth = 0.20;
  const palletGeometry = centeredExtrusion(palletShape, palletDepth, 0.008);
  const palletAssemblies = [];
  const palletHeads = [];
  const palletStems = [];
  const palletFaceMarks = [];
  for (let index = 0; index < toothCount; index += 1) {
    const palletAssembly = new THREE.Group();
    palletAssembly.rotation.z = index * toothPitch;
    palletAssembly.userData.index = index;
    palletAssembly.userData.role = 'raised-cylinder-wheel-pallet-assembly';
    const stemLength = workingPlaneZ - wheelPlaneZ;
    const stem = cylinderAlongZ(0.082, stemLength, driverMaterial, 20);
    stem.position.set(2.68, 0, (workingPlaneZ + wheelPlaneZ) / 2);
    stem.userData.index = index;
    stem.userData.role = 'short-axial-stem-under-raised-wheel-pallet';
    const head = new THREE.Mesh(palletGeometry, driverMaterial);
    head.position.z = workingPlaneZ;
    head.userData.beveled = true;
    head.userData.index = index;
    head.userData.obliqueWorkingFace = true;
    head.userData.role = 'raised-oblique-beveled-wheel-pallet-a-b-c';
    const faceMark = beamBetween(
      new THREE.Vector3(3.10, -0.08, workingPlaneZ + 0.12),
      new THREE.Vector3(3.05, 0.02, workingPlaneZ + 0.12),
      0.035,
      0.035,
      accentMaterial,
    );
    faceMark.userData.index = index;
    faceMark.userData.role = 'oblique-impulse-face-on-wheel-pallet';
    palletAssembly.add(stem, head, faceMark);
    palletAssemblies.push(palletAssembly);
    palletHeads.push(head);
    palletStems.push(stem);
    palletFaceMarks.push(faceMark);
    wheelRotor.add(palletAssembly);
  }
  const wheelIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 18, 14),
    indexMaterial,
  );
  wheelIndex.position.set(
    toothOrbitRadius,
    0,
    workingPlaneZ + palletDepth / 2 + 0.12,
  );
  wheelIndex.userData.role = 'white-index-on-cylinder-wheel-pallet-zero';
  wheelRotor.add(wheelIndex);

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 18, 14),
    indexMaterial,
  );
  contactMarker.position.z = workingPlaneZ + palletDepth / 2 + 0.16;
  contactMarker.userData.role =
    'white-marker-on-active-cylinder-escapement-contact';

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-parallel-arbor-watch-frame';
  const framePlaneZ = wheelPlaneZ - 0.74;
  const rearStandard = beamBetween(
    new THREE.Vector3(wheelCenter.x, wheelCenter.y - 0.55, framePlaneZ),
    new THREE.Vector3(
      cylinderCenter.x,
      cylinderCenter.y + 1.65,
      framePlaneZ,
    ),
    0.22,
    0.22,
    frameMaterial,
  );
  rearStandard.userData.role = 'fixed-cylinder-watch-plate-standard';
  const wheelBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.075, 10, 40),
    frameMaterial,
  );
  wheelBearing.position.set(wheelCenter.x, wheelCenter.y, framePlaneZ + 0.12);
  wheelBearing.userData.role = 'fixed-escape-wheel-bearing';
  const cylinderBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.075, 10, 40),
    frameMaterial,
  );
  cylinderBearing.position.set(
    cylinderCenter.x,
    cylinderCenter.y,
    framePlaneZ + 0.12,
  );
  cylinderBearing.userData.role = 'fixed-balance-staff-bearing';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.24, 0.86),
    frameMaterial,
  );
  base.position.set(0, wheelCenter.y - 3.42, framePlaneZ + 0.04);
  base.userData.role = 'fixed-cylinder-escapement-frame-base';
  fixedFrame.add(rearStandard, wheelBearing, cylinderBearing, base);

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(8.8, 9.1, 5.6),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0, -0.70, 0.10);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-complete-cylinder-escapement';

  root.add(
    cameraEnvelope,
    fixedFrame,
    escapeWheel,
    cylinderAssembly,
    contactMarker,
  );

  const stateAtTime = (time) => {
    const { cycleIndex, phase } = cycleAtTime(time);
    const balanceState = balanceStateAtPhase(phase);
    const wheelState = wheelStateAtPhase(phase);
    const wheelAngle = wheelAngleAtCyclePhase(cycleIndex, phase);
    const beforeOuterLanding = phase < outerLanding;
    const currentToothIndex = positiveModulo(cycleIndex, toothCount);
    const nextToothIndex = positiveModulo(cycleIndex + 1, toothCount);
    const activeToothIndex = beforeOuterLanding
      ? currentToothIndex
      : nextToothIndex;
    const currentToothPoint = toothReferencePoint(
      wheelAngle,
      currentToothIndex,
    );
    const activeToothPoint = toothReferencePoint(
      wheelAngle,
      activeToothIndex,
    );

    let stage;
    let contactMode;
    if (phase < entryStart) {
      stage = 'wheel-pallet-rests-on-cylinder-outside';
      contactMode = 'outside-frictional-rest';
    } else if (phase < entryEnd) {
      stage = 'entry-lip-impulses-balance';
      contactMode = 'entry-lip-impulse';
    } else if (phase < innerLanding) {
      stage = 'wheel-pallet-drops-through-cylinder-opening';
      contactMode = null;
    } else if (phase < exitStart) {
      stage = 'same-wheel-pallet-rests-on-cylinder-inside';
      contactMode = 'inside-frictional-rest';
    } else if (phase < exitEnd) {
      stage = 'exit-lip-impulses-balance-in-opposite-sense';
      contactMode = 'exit-lip-impulse';
    } else {
      stage = 'next-wheel-pallet-rests-on-cylinder-outside';
      contactMode = 'outside-frictional-rest';
    }

    let contact = null;
    if (
      contactMode === 'outside-frictional-rest'
      || contactMode === 'inside-frictional-rest'
    ) {
      const expectedPoint = activeToothPoint.clone();
      const localPoint = rotate2(
        expectedPoint.clone().sub(cylinderCenter),
        -balanceState.angle,
      );
      const faceTangent = rotate2(
        crossZ(localPoint).normalize(),
        balanceState.angle,
      );
      const faceNormal = new THREE.Vector2(
        -faceTangent.y,
        faceTangent.x,
      );
      const toothVelocity = crossZ(
        expectedPoint.clone().sub(wheelCenter),
      ).multiplyScalar(wheelState.angularSpeed);
      const cylinderVelocity = crossZ(
        expectedPoint.clone().sub(cylinderCenter),
      ).multiplyScalar(balanceState.angularSpeed);
      const relativeVelocity = toothVelocity.clone().sub(cylinderVelocity);
      const expectedRadius = contactMode === 'outside-frictional-rest'
        ? cylinderOuterRadius
        : cylinderInnerRadius;
      contact = {
        cylinderVelocity,
        expectedPoint,
        faceNormal,
        faceTangent,
        localPoint,
        mode: contactMode,
        normalVelocityError: relativeVelocity.dot(faceNormal),
        pointError: activeToothPoint.distanceTo(expectedPoint),
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
        surfaceRadiusError: Math.abs(localPoint.length() - expectedRadius),
        toothVelocity,
      };
    } else if (
      contactMode === 'entry-lip-impulse'
      || contactMode === 'exit-lip-impulse'
    ) {
      const frame = contactFrameAtPhase(phase);
      const expectedPoint = cylinderCenter.clone().add(
        rotate2(frame.point, balanceState.angle),
      );
      const faceTangent = rotate2(frame.tangent, balanceState.angle);
      const faceNormal = rotate2(frame.normal, balanceState.angle);
      const toothVelocity = crossZ(
        currentToothPoint.clone().sub(wheelCenter),
      ).multiplyScalar(wheelState.angularSpeed);
      const cylinderVelocity = crossZ(
        expectedPoint.clone().sub(cylinderCenter),
      ).multiplyScalar(balanceState.angularSpeed);
      const relativeVelocity = toothVelocity.clone().sub(cylinderVelocity);
      contact = {
        cylinderVelocity,
        expectedPoint,
        faceNormal,
        faceTangent,
        localPoint: frame.point,
        mode: contactMode,
        normalVelocityError: relativeVelocity.dot(faceNormal),
        pointError: currentToothPoint.distanceTo(expectedPoint),
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
        surfaceRadiusError: null,
        toothVelocity,
      };
    }

    return {
      activeToothIndex,
      activeToothPoint,
      balanceAngle: balanceState.angle,
      balanceAngularAcceleration: balanceState.angularAcceleration,
      balanceAngularSpeed: balanceState.angularSpeed,
      contact,
      contactActive: contact !== null,
      contactMode,
      currentToothIndex,
      currentToothPoint,
      cycleIndex,
      cyclePhase: phase,
      entryImpulseActive: contactMode === 'entry-lip-impulse',
      exitImpulseActive: contactMode === 'exit-lip-impulse',
      stage,
      wheelAdvance: wheelState.advance,
      wheelAngle,
      wheelAngularAcceleration: wheelState.angularAcceleration,
      wheelAngularSpeed: wheelState.angularSpeed,
      wheelEvent: wheelState.event,
      wheelEventProgress: wheelState.progress,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * balancePeriod,
  );
  const canonicalTimes = {
    outerRest: 0.10 * balancePeriod,
    entryImpulseMiddle: (entryStart + entryEnd) / 2 * balancePeriod,
    insideDropMiddle: (entryEnd + innerLanding) / 2 * balancePeriod,
    innerRest: 0.48 * balancePeriod,
    exitImpulseMiddle: (exitStart + exitEnd) / 2 * balancePeriod,
    nextOuterRest: 0.86 * balancePeriod,
    oneOscillation: balancePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    cylinderAssembly.rotation.z = state.balanceAngle;
    cylinderAssembly.userData.angularAcceleration =
      state.balanceAngularAcceleration;
    cylinderAssembly.userData.angularSpeed = state.balanceAngularSpeed;
    wheelRotor.rotation.z = state.wheelAngle;
    wheelRotor.userData.angularAcceleration =
      state.wheelAngularAcceleration;
    wheelRotor.userData.angularSpeed = state.wheelAngularSpeed;
    contactMarker.visible = state.contactActive && !root.userData.finiteContactReview?.contactMarkersSuppressed;
    if (state.contactActive) {
      contactMarker.position.set(
        state.contact.expectedPoint.x,
        state.contact.expectedPoint.y,
        workingPlaneZ + palletDepth / 2 + 0.16,
      );
    }
    root.userData.contacts = state.contactActive
      ? {
        contactKind: 'prescribed-reference-point',
        finiteSurfaceValidated: false,
        activeToothIndex: state.activeToothIndex,
        mode: state.contactMode,
        normalVelocityError: state.contact.normalVelocityError,
        pointError: state.contact.pointError,
        relativeSlipSpeed: state.contact.relativeSlipSpeed,
        surfaceRadiusError: state.contact.surfaceRadiusError,
      }
      : {
        contactKind: 'prescribed-reference-point',
        finiteSurfaceValidated: false,
        activeToothIndex: state.activeToothIndex,
        mode: null,
        normalVelocityError: null,
        pointError: null,
        relativeSlipSpeed: null,
        surfaceRadiusError: null,
      };
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    'fifteen-pallet-double-beat-cylinder-watch-escapement-perspective';
  root.userData.mechanism =
    'a hollow balance cylinder has two full tubular ends and a 196-degree shell only across its offset central working band; fifteen raised oblique pallets on one clockwise escape wheel lock alternately on the cylinder outside and inside, entering through one beveled lip, dropping across the hollow, and leaving through the opposite lip while the attached balance receives two impulses per oscillation';
  root.userData.transmission = {
    deadBeatFrictionalRest: true,
    direction: 'escape wheel advances clockwise as in Brown 295',
    entryImpulseAdvance,
    exitImpulseAdvance,
    freeDropAdvance,
    impulseCountPerOscillation: 2,
    oscillationAdvance: toothPitch,
    restSequence: ['outside-cylinder', 'inside-cylinder'],
    toothCount,
  };
  root.userData.blocks = {
    balanceIndex,
    balanceRim,
    balanceSpokes,
    balanceStaff,
    base,
    cameraEnvelope,
    contactMarker,
    cylinderAssembly,
    cylinderBearing,
    entryLipRail,
    entryLipTrace,
    escapeWheel,
    exitLipRail,
    exitLipTrace,
    fixedFrame,
    innerLockTrace,
    leftTube,
    lowerBandRing,
    lowerCollar,
    lowerCone,
    outerLockTrace,
    palletAssemblies,
    palletFaceMarks,
    palletHeads,
    palletStems,
    rearStandard,
    rightTube,
    upperBandRing,
    upperCollar,
    upperCone,
    wheelBearing,
    wheelHub,
    wheelIndex,
    wheelRim,
    wheelRotor,
    wheelShaft,
    wheelSpokes,
    workingShell,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contactFrameAtPhase = contactFrameAtPhase;
  root.userData.entryLipPoints = entryLipPoints;
  root.userData.exitLipPoints = exitLipPoints;
  root.userData.geometry = {
    balanceAmplitude,
    balancePeriod,
    balancePlaneZ,
    centerDistance,
    cylinderBodyEndZ,
    cylinderBodyStartZ,
    cylinderCenter: cylinderCenter.clone(),
    cylinderInnerRadius,
    cylinderOuterRadius,
    cylinderShellStartAngle,
    cylinderShellSweep,
    cylinderWallThickness,
    entryEnd,
    entryImpulseAdvance,
    entryStart,
    entryTotalAdvance,
    exitEnd,
    exitImpulseAdvance,
    exitStart,
    freeDropAdvance,
    innerLanding,
    innerLockWheelAngle,
    leftTubeLength,
    outerEntryWheelAngle,
    outerExitWheelAngle,
    outerLanding,
    palletDepth,
    rightTubeLength,
    sourceAxialScale,
    sourceImageHeight,
    sourceImageWidth,
    sourceRadialScale,
    toothCount,
    toothOrbitRadius,
    toothPitch,
    wheelCenter: wheelCenter.clone(),
    wheelDepth,
    wheelInnerRadius,
    wheelOuterRadius,
    wheelPlaneZ,
    workingBandEndZ,
    workingBandStartZ,
    workingBandWidth,
    workingPlaneZ,
  };
  root.userData.impulseLocalPointAtPhase = impulseLocalPointAtPhase;
  root.userData.innerLockPoint = innerLockPoint.clone();
  root.userData.outerExitPoint = outerExitPoint.clone();
  root.userData.outerLockPoint = outerLockPoint.clone();
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'The official movement 294 page supplies Brown’s static perspective cylinder and pairs it with 295 for the operating positions. The offset working-band window, hollow shell, raised beveled pallets, alternating outside/inside frictional rests, two lip impulses, and clockwise one-tooth sequence are reconstructed from those plates and period cylinder-escapement descriptions; exact historic draw and drop angles are not dimensioned.',
    sourceUrl: 'https://507movements.com/mm_294.html',
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    pairedPlate295: {
      labels: ['A', 'B', 'a', 'b', 'c'],
      relation: 'large-scale plan showing successive outside lock, entry, inside lock, exit, and the clockwise wheel direction',
      sourceUrl: 'https://507movements.com/mm_295.html',
    },
    periodReference: {
      description: 'raised triangular pallets lock with dead friction first on the outside and then on the inside; their oblique edges impulse the two cylinder lips alternately',
      figure: 5,
      publicationYear: 1911,
      source: 'Encyclopaedia Britannica, 11th edition, Watch',
    },
    plate294: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'a long hollow cylinder has complete tubular portions on both sides of an axially offset central band where one circumferential sector is removed',
      measurementUncertaintyPixels: 7,
      rasterAxisCenter: sourceRasterAxisCenter.clone(),
      rasterBodyEnd: sourceRasterBodyEnd.clone(),
      rasterBodyStart: sourceRasterBodyStart.clone(),
      rasterLeftCollarCenter: sourceRasterLeftCollarCenter.clone(),
      rasterLeftPivotTip: sourceRasterLeftPivotTip.clone(),
      rasterOuterRadius: sourceRasterOuterRadius,
      rasterRightCollarCenter: sourceRasterRightCollarCenter.clone(),
      rasterRightPivotTip: sourceRasterRightPivotTip.clone(),
      rasterWorkingBandEnd: sourceRasterWorkingBandEnd.clone(),
      rasterWorkingBandStart: sourceRasterWorkingBandStart.clone(),
      rasterWorkingBandWidth: sourceRasterWorkingBandWidth,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 77,
      edition: 21,
      illustrationPage: 76,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: balancePeriod,
    schedule: [
      'pallet-a-outside-frictional-rest',
      'entry-lip-impulse-to-balance',
      'free-drop-across-hollow-cylinder',
      'same-pallet-inside-frictional-rest',
      'exit-lip-impulse-in-opposite-sense',
      'next-pallet-outside-frictional-rest',
    ],
  };
  root.userData.toothReferencePoint = toothReferencePoint;
  root.userData.wheelAngleAtCyclePhase = wheelAngleAtCyclePhase;
  root.userData.wheelStateAtPhase = wheelStateAtPhase;

  correctCylinderWorkingParts(root);
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
  markShadows(root);
  for (const object of [
    balanceIndex,
    cameraEnvelope,
    contactMarker,
    wheelIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';
  return {
    cameraDirection: new THREE.Vector3(8.4, 5.6, 4.8),
    root,
    update,
  };
}

function cylinderEscapementActionDiagram(movement) {
  // 295 is the operating enlargement paired with 294. Reuse the same exact
  // contact law, but remove the long perspective tube and watch frame so the
  // viewer looks directly into one physical cylinder at the working plane.
  // Brown repeats that cylinder three times across the paper to narrate time;
  // those are sequential diagram states, not three simultaneous cylinders.
  const model = cylinderEscapementPerspective(movement);
  const { root, update } = model;
  const oldBlocks = root.userData.blocks;
  const { cylinderAssembly } = oldBlocks;
  root.userData.balanceHubForSectionRemoval=oldBlocks.balanceHub;
  for (const object of [
    oldBlocks.leftTube,
    oldBlocks.rightTube,
    oldBlocks.lowerBandRing,
    oldBlocks.upperBandRing,
    oldBlocks.lowerCollar,
    oldBlocks.lowerCone,
    oldBlocks.upperCollar,
    oldBlocks.upperCone,
    oldBlocks.balanceRim,
    oldBlocks.balanceIndex,
    oldBlocks.balanceStaff,
    ...oldBlocks.balanceSpokes,
  ]) {
    cylinderAssembly.remove(object);
  }
  root.remove(oldBlocks.fixedFrame, oldBlocks.cameraEnvelope);

  const geometry = root.userData.geometry;
  const actionMarkerMaterial = matte(PALETTE.white, { roughness: 0.38 });
  const sectionStaff = cylinderAlongZ(
    0.105,
    0.86,
    matte(PALETTE.ink, { metalness: 0.32, roughness: 0.40 }),
    30,
  );
  sectionStaff.position.z = geometry.workingPlaneZ;
  sectionStaff.userData.role =
    'short-balance-staff-through-enlarged-cylinder-section';
  cylinderAssembly.add(sectionStaff);
  const outsideRestMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 14),
    actionMarkerMaterial,
  );
  outsideRestMarker.position.set(
    root.userData.outerLockPoint.x,
    root.userData.outerLockPoint.y,
    geometry.workingPlaneZ + 0.23,
  );
  outsideRestMarker.userData.role =
    'source-state-a-outside-cylinder-lock-marker';
  const insideRestMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 14),
    actionMarkerMaterial,
  );
  insideRestMarker.position.set(
    root.userData.innerLockPoint.x,
    root.userData.innerLockPoint.y,
    geometry.workingPlaneZ + 0.23,
  );
  insideRestMarker.userData.role =
    'source-state-c-inside-cylinder-lock-marker';
  // Keep Brown's repeated paper states in metadata rather than rendering
  // multiple apparent contacts at once. The active white contact marker from
  // the base model is the sole instantaneous contact indicator.
  const guideMaterial = matte(PALETTE.white, {
    depthWrite: false,
    opacity: 0.34,
    roughness: 0.40,
    transparent: true,
  });
  oldBlocks.outerLockTrace.material = guideMaterial;
  oldBlocks.innerLockTrace.material = guideMaterial;

  const palletLabelMarkers = [];
  for (let index = 0; index < 3; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.065 + index * 0.008, 16, 12),
      actionMarkerMaterial,
    );
    const angle = index * geometry.toothPitch;
    marker.position.set(
      Math.cos(angle) * geometry.toothOrbitRadius,
      Math.sin(angle) * geometry.toothOrbitRadius,
      geometry.workingPlaneZ + 0.20,
    );
    marker.userData.index = index;
    marker.userData.sourceLabel = ['a', 'b', 'c'][index];
    marker.userData.role =
      `white-source-label-marker-for-pallet-${['a', 'b', 'c'][index]}`;
    palletLabelMarkers.push(marker);
    oldBlocks.wheelRotor.add(marker);
  }

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.8, 8.6, 2.6),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0, -0.72, geometry.workingPlaneZ - 0.18);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-enlarged-cylinder-action-view';
  root.add(cameraEnvelope);

  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterCylinderStateCenters = [
    new THREE.Vector2(151, 224),
    new THREE.Vector2(280, 224),
    new THREE.Vector2(404, 221),
  ];
  const sourceRasterPalletLabels = {
    a: new THREE.Vector2(68, 232),
    b: new THREE.Vector2(240, 185),
    c: new THREE.Vector2(410, 201),
  };
  const sourceRasterCylinderLabels = {
    firstA: new THREE.Vector2(126, 242),
    firstB: new THREE.Vector2(191, 218),
    secondA: new THREE.Vector2(355, 204),
    secondB: new THREE.Vector2(459, 225),
  };
  const sourceRasterWheelDirectionArrow = new THREE.Vector2(120, 333);
  const sourceRasterWheelCrown = new THREE.Vector2(276, 290);
  const sourceRasterCylinderOuterRadius = 65;
  const sourcePlanScale = geometry.cylinderOuterRadius
    / sourceRasterCylinderOuterRadius;
  const sourcePlanOrigin = sourceRasterCylinderStateCenters[1];
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    geometry.cylinderCenter.x + (x - sourcePlanOrigin.x) * sourcePlanScale,
    geometry.cylinderCenter.y + (sourcePlanOrigin.y - y) * sourcePlanScale,
  );

  root.userData.archetype =
    'single-cylinder-enlarged-outside-inside-double-beat-action';
  root.userData.mechanism =
    'one physical hollow cylinder is shown in enlarged working-plane section against one clockwise pallet wheel; Brown’s three paper outlines are successive time states, while this animation moves the single cylinder through outside lock a, entry-lip impulse b, inside lock c, and exit-lip impulse before the next pallet arrives';
  root.userData.transmission = {
    ...root.userData.transmission,
    compositeDrawingStateCount: 3,
    physicalCylinderCount: 1,
    sourcePalletLabels: ['a', 'b', 'c'],
    sourceStatesAreSequential: true,
  };
  root.userData.blocks = {
    cameraEnvelope,
    contactMarker: oldBlocks.contactMarker,
    cylinderAssembly,
    cylinderSection: oldBlocks.workingShell,
    entryLipRail: oldBlocks.entryLipRail,
    entryLipTrace: oldBlocks.entryLipTrace,
    escapeWheel: oldBlocks.escapeWheel,
    exitLipRail: oldBlocks.exitLipRail,
    exitLipTrace: oldBlocks.exitLipTrace,
    innerLockTrace: oldBlocks.innerLockTrace,
    outerLockTrace: oldBlocks.outerLockTrace,
    palletAssemblies: oldBlocks.palletAssemblies,
    palletFaceMarks: oldBlocks.palletFaceMarks,
    palletHeads: oldBlocks.palletHeads,
    palletLabelMarkers,
    palletStems: oldBlocks.palletStems,
    palletFeet: oldBlocks.palletFeet,
    sectionStaff,
    wheelHub: oldBlocks.wheelHub,
    wheelIndex: oldBlocks.wheelIndex,
    wheelRim: oldBlocks.wheelRim,
    wheelRotor: oldBlocks.wheelRotor,
    wheelShaft: oldBlocks.wheelShaft,
    wheelSpokes: oldBlocks.wheelSpokes,
  };
  root.userData.geometry = {
    ...geometry,
    compositeDrawingStateCount: 3,
    sourceImageHeight,
    sourceImageWidth,
    sourcePlanScale,
  };
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'The official movement 295 page supplies Brown’s static enlarged composite of three successive cylinder positions over one wheel arc. This model resolves the composite into one moving cylinder and one wheel, retaining labels a/b/c, clockwise direction, alternating outside/inside frictional rests, entry and exit lip impulses, and the intervening drop; exact historic draw and drop angles are not dimensioned.',
    sourceUrl: 'https://507movements.com/mm_295.html',
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    pairedPlate294: {
      relation: 'perspective construction of the hollow cylinder, its offset working-band window, collars, staff, and balance attachment',
      sourceUrl: 'https://507movements.com/mm_294.html',
    },
    periodReference: {
      description: 'each tooth has two engagements, outside and inside, with dead friction during rest and impulse as the tooth face passes a cylinder lip',
      publicationYear: 1904,
      source: 'Watch and Clock Escapements, The Keystone',
    },
    plate295: {
      compositeNotSimultaneous: true,
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'three repeated A/B cylinder outlines narrate successive times above one clockwise wheel arc and pallet labels a, b, c',
      measurementUncertaintyPixels: 9,
      rasterCylinderLabels: Object.fromEntries(Object.entries(
        sourceRasterCylinderLabels,
      ).map(([key, point]) => [key, point.clone()])),
      rasterCylinderOuterRadius: sourceRasterCylinderOuterRadius,
      rasterCylinderStateCenters: sourceRasterCylinderStateCenters
        .map((point) => point.clone()),
      rasterPalletLabels: Object.fromEntries(Object.entries(
        sourceRasterPalletLabels,
      ).map(([key, point]) => [key, point.clone()])),
      rasterWheelCrown: sourceRasterWheelCrown.clone(),
      rasterWheelDirectionArrow: sourceRasterWheelDirectionArrow.clone(),
      sequentialStateCount: 3,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 77,
      edition: 21,
      illustrationPage: 76,
      publicationYear: 1908,
    },
  };
  root.userData.timeline = {
    ...root.userData.timeline,
    sourceCompositeResolution: [
      'left paper state: pallet a outside the cylinder',
      'middle paper state: pallet b passes the entry lip',
      'right paper state: pallet c rests inside then exits',
      'animation: those states occur sequentially on one cylinder',
    ],
  };
  root.userData.cameraDistanceScale = 0.84;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.0, -0.55, -1.20),
    new THREE.Vector3(3.0, 3.05, 1.10),
  );
  root.userData.groundFloorY = geometry.wheelCenter.y
    - geometry.wheelOuterRadius - 0.34;
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  for (const object of [
    cameraEnvelope,
    ...palletLabelMarkers,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  update(0);
  return {
    cameraDirection: new THREE.Vector3(1.8, -1.2, 11.8),
    root,
    update,
  };
}

export function createAuthoredCylinderEscapementMovement(movement) {
  if (movement.id === 294) return finishCylinderReview(installCylinderContact(cylinderEscapementPerspective(movement),294),294);
  if (movement.id === 295) return finishCylinderReview(installCylinderContact(cylinderEscapementActionDiagram(movement),295),295);
  return null;
}
