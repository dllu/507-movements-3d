import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeDynamicCable,
  makeDynamicLink,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function centeredExtrusion(shape, depth, bevel = 0.014) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 1,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function cylinderAlongX(radius, length, material, segments = 48) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function torusAroundX(radius, tube, material, segments = 52) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 9, segments),
    material,
  );
  torus.rotation.y = Math.PI / 2;
  return torus;
}

function quinticWindow(value, start, end) {
  if (value <= start) {
    return { acceleration: 0, position: 0, velocity: 0 };
  }
  if (value >= end) {
    return { acceleration: 0, position: 1, velocity: 0 };
  }
  const duration = end - start;
  const parameter = (value - start) / duration;
  const parameter2 = parameter * parameter;
  const oneMinus = 1 - parameter;
  return {
    acceleration: 60 * parameter * oneMinus * (1 - 2 * parameter)
      / duration ** 2,
    position: parameter2 * parameter
      * (10 - 15 * parameter + 6 * parameter2),
    velocity: 30 * parameter2 * oneMinus ** 2 / duration,
  };
}

function cubicBezierPoint(start, controlA, controlB, end, parameter) {
  const oneMinus = 1 - parameter;
  return new THREE.Vector3()
    .addScaledVector(start, oneMinus ** 3)
    .addScaledVector(controlA, 3 * oneMinus ** 2 * parameter)
    .addScaledVector(controlB, 3 * oneMinus * parameter ** 2)
    .addScaledVector(end, parameter ** 3);
}

function ratchetStarShape({ contactPhase, rootRadius, teeth, tipRadius }) {
  const shape = new THREE.Shape();
  const pitch = FULL_TURN / teeth;
  let first = true;
  const appendPolarPoint = (radius, phase) => {
    // The shape is extruded along local Z and then quarter-turned so that its
    // polar plane becomes global YZ around the cylinder's X axis.
    const x = -radius * Math.sin(phase);
    const y = radius * Math.cos(phase);
    if (first) {
      shape.moveTo(x, y);
      first = false;
    } else {
      shape.lineTo(x, y);
    }
  };
  for (let index = 0; index < teeth; index += 1) {
    const phase = contactPhase + index * pitch;
    appendPolarPoint(rootRadius, phase - pitch * 0.48);
    appendPolarPoint(tipRadius, phase);
    appendPolarPoint(rootRadius, phase + pitch * 0.42);
  }
  shape.closePath();
  return shape;
}

function coltCylinderRatchet(movement) {
  const root = new THREE.Group();

  // Source measurements use the hammer pivot as the 2D origin. Brown's side
  // view collapses the cylinder's depth, so the ratchet contact is completed
  // in 3D from the six-chamber geometry and the 1836 Colt patent description.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.011;
  const sourceRasterHammerPivot = new THREE.Vector2(301, 394);
  const sourceRasterDogPivot = new THREE.Vector2(212, 389);
  const sourceRasterCylinderFrontTop = new THREE.Vector2(7, 98);
  const sourceRasterCylinderRearTop = new THREE.Vector2(112, 98);
  const sourceRasterCylinderFrontBottom = new THREE.Vector2(7, 469);
  const sourceRasterCylinderRearBottom = new THREE.Vector2(112, 469);
  const sourceRasterSpringAnchor = new THREE.Vector2(166, 132);
  const sourceRasterRatchetContactProjection = new THREE.Vector2(128, 247);

  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterHammerPivot.x) * sourceScale,
    (sourceRasterHammerPivot.y - y) * sourceScale,
  );

  const cylinderFrontX = sourcePointToModel(
    sourceRasterCylinderFrontTop,
  ).x;
  const cylinderRearX = sourcePointToModel(
    sourceRasterCylinderRearTop,
  ).x;
  const cylinderLength = cylinderRearX - cylinderFrontX;
  const cylinderCenterX = (cylinderFrontX + cylinderRearX) / 2;
  const cylinderTopY = sourcePointToModel(sourceRasterCylinderRearTop).y;
  const cylinderBottomY = sourcePointToModel(
    sourceRasterCylinderRearBottom,
  ).y;
  const cylinderCenterY = (cylinderTopY + cylinderBottomY) / 2;
  const cylinderRadius = (cylinderTopY - cylinderBottomY) / 2;
  const dogPivotLocal = new THREE.Vector3(
    sourcePointToModel(sourceRasterDogPivot).x,
    sourcePointToModel(sourceRasterDogPivot).y,
    -0.5,
  );
  const ratchetDepth = 0.18;
  const ratchetContactX = cylinderRearX + ratchetDepth;
  const ratchetTipRadius = 0.72;
  const ratchetRootRadius = 0.39;
  const ratchetTeeth = 6;
  const ratchetPitch = FULL_TURN / ratchetTeeth;

  // These three values are the unique source-side branch that makes the
  // rigid hand close at both ends of one tooth pitch and arrive at an exact
  // toggle at full cock. The resulting path is monotonic over the whole
  // 42.3068 degree hammer stroke.
  const ratchetContactPhase = THREE.MathUtils.degToRad(
    303.7738209155182,
  );
  const hammerStroke = THREE.MathUtils.degToRad(42.30677570906087);
  const dogLength = 1.8144064091349419;
  const resetClearance = 0.34;
  const inputCyclePeriod = 4;
  const inputCycleRate = 1 / inputCyclePeriod;
  const fullCylinderPeriod = ratchetTeeth * inputCyclePeriod;
  const cockStart = 0.16;
  const cockEnd = 0.52;
  const fallStart = 0.62;
  const fallEnd = 0.90;
  const unlockStart = 0.08;
  const unlockEnd = 0.15;
  const relockStart = cockEnd;
  const relockEnd = 0.59;
  const lockRetractionDistance = 0.34;

  const dogBaseAtHammerAngle = (hammerAngle) => new THREE.Vector3(
    Math.cos(hammerAngle) * dogPivotLocal.x
      - Math.sin(hammerAngle) * dogPivotLocal.y,
    Math.sin(hammerAngle) * dogPivotLocal.x
      + Math.cos(hammerAngle) * dogPivotLocal.y,
    dogPivotLocal.z,
  );
  const dogBaseDerivativeAtHammerAngle = (hammerAngle) => (
    new THREE.Vector3(
      -Math.sin(hammerAngle) * dogPivotLocal.x
        - Math.cos(hammerAngle) * dogPivotLocal.y,
      Math.cos(hammerAngle) * dogPivotLocal.x
        - Math.sin(hammerAngle) * dogPivotLocal.y,
      0,
    )
  );
  const dogBaseSecondDerivativeAtHammerAngle = (hammerAngle) => (
    new THREE.Vector3(
      -Math.cos(hammerAngle) * dogPivotLocal.x
        + Math.sin(hammerAngle) * dogPivotLocal.y,
      -Math.sin(hammerAngle) * dogPivotLocal.x
        - Math.cos(hammerAngle) * dogPivotLocal.y,
      0,
    )
  );
  const ratchetPointAtWorldPhase = (phase, x = ratchetContactX) => (
    new THREE.Vector3(
      x,
      cylinderCenterY + ratchetTipRadius * Math.cos(phase),
      ratchetTipRadius * Math.sin(phase),
    )
  );
  const ratchetPointDerivativeAtWorldPhase = (phase) => (
    new THREE.Vector3(
      0,
      -ratchetTipRadius * Math.sin(phase),
      ratchetTipRadius * Math.cos(phase),
    )
  );
  const ratchetPointSecondDerivativeAtWorldPhase = (phase) => (
    new THREE.Vector3(
      0,
      -ratchetTipRadius * Math.cos(phase),
      -ratchetTipRadius * Math.sin(phase),
    )
  );

  const engagedClosureAtHammerAngle = (hammerAngle) => {
    const dogBase = dogBaseAtHammerAngle(hammerAngle);
    const xDifference = ratchetContactX - dogBase.x;
    const yDifference = dogBase.y - cylinderCenterY;
    const zDifference = dogBase.z;
    const projectedRadius = Math.hypot(yDifference, zDifference);
    const projectedPhase = Math.atan2(zDifference, yDifference);
    const cosineArgument = THREE.MathUtils.clamp((
      xDifference ** 2
      + projectedRadius ** 2
      + ratchetTipRadius ** 2
      - dogLength ** 2
    ) / (2 * ratchetTipRadius * projectedRadius), -1, 1);
    let worldPhase = projectedPhase + Math.acos(cosineArgument);
    while (worldPhase < ratchetContactPhase - Math.PI) {
      worldPhase += FULL_TURN;
    }
    while (worldPhase > ratchetContactPhase + Math.PI) {
      worldPhase -= FULL_TURN;
    }

    const dogTip = ratchetPointAtWorldPhase(worldPhase);
    const difference = dogBase.clone().sub(dogTip);
    const baseFirst = dogBaseDerivativeAtHammerAngle(hammerAngle);
    const baseSecond = dogBaseSecondDerivativeAtHammerAngle(hammerAngle);
    const tipFirst = ratchetPointDerivativeAtWorldPhase(worldPhase);
    const tipSecond = ratchetPointSecondDerivativeAtWorldPhase(worldPhase);
    const firstHammerPartial = 2 * difference.dot(baseFirst);
    const firstPhasePartial = -2 * difference.dot(tipFirst);
    const secondHammerPartial = 2 * (
      baseFirst.lengthSq() + difference.dot(baseSecond)
    );
    const mixedPartial = -2 * baseFirst.dot(tipFirst);
    const secondPhasePartial = 2 * tipFirst.lengthSq()
      - 2 * difference.dot(tipSecond);
    const phasePerHammer = -firstHammerPartial / firstPhasePartial;
    const phaseSecondPerHammer = -(
      secondHammerPartial
      + 2 * mixedPartial * phasePerHammer
      + secondPhasePartial * phasePerHammer ** 2
    ) / firstPhasePartial;

    return {
      cosineArgument,
      dogBase,
      dogLengthError: dogBase.distanceTo(dogTip) - dogLength,
      dogTip,
      phasePerHammer,
      phaseSecondPerHammer,
      worldPhase,
    };
  };

  const resetDogTip = (hammerAngle, resetProgress) => {
    const dogBase = dogBaseAtHammerAngle(hammerAngle);
    const easedProgress = resetProgress ** 3 * (
      10 - 15 * resetProgress + 6 * resetProgress ** 2
    );
    const targetPhase = ratchetContactPhase
      + ratchetPitch * (1 - easedProgress);
    const clearanceShape = 16 * resetProgress ** 2
      * (1 - resetProgress) ** 2;
    const axialClearance = resetClearance * clearanceShape;
    const tipX = ratchetContactX + axialClearance;
    const xDistance = tipX - dogBase.x;
    const planarReach = Math.sqrt(Math.max(
      dogLength ** 2 - xDistance ** 2,
      0,
    ));
    const target = ratchetPointAtWorldPhase(targetPhase, tipX);
    const planarDirection = new THREE.Vector2(
      target.y - dogBase.y,
      target.z - dogBase.z,
    ).normalize();
    return {
      axialClearance,
      dogBase,
      dogTip: new THREE.Vector3(
        tipX,
        dogBase.y + planarDirection.x * planarReach,
        dogBase.z + planarDirection.y * planarReach,
      ),
      targetPhase,
    };
  };

  const stateAtNormalizedCycle = (normalizedCycle, indexNumber) => {
    const cockMotion = quinticWindow(normalizedCycle, cockStart, cockEnd);
    const fallMotion = quinticWindow(normalizedCycle, fallStart, fallEnd);
    let hammerAngle;
    let hammerAngularSpeed;
    let hammerAngularAcceleration;
    if (normalizedCycle < fallStart) {
      hammerAngle = -hammerStroke * cockMotion.position;
      hammerAngularSpeed = -hammerStroke * cockMotion.velocity
        * inputCycleRate;
      hammerAngularAcceleration = -hammerStroke * cockMotion.acceleration
        * inputCycleRate ** 2;
    } else {
      hammerAngle = -hammerStroke * (1 - fallMotion.position);
      hammerAngularSpeed = hammerStroke * fallMotion.velocity
        * inputCycleRate;
      hammerAngularAcceleration = hammerStroke * fallMotion.acceleration
        * inputCycleRate ** 2;
    }

    const driving = normalizedCycle >= cockStart
      && normalizedCycle <= cockEnd;
    const ready = normalizedCycle < cockStart || normalizedCycle > fallEnd;
    const resetting = normalizedCycle >= fallStart
      && normalizedCycle <= fallEnd;
    let cylinderIncrement;
    let cylinderAngularSpeed = 0;
    let cylinderAngularAcceleration = 0;
    let dogBase;
    let dogTip;
    let dogAxialClearance = 0;
    let dogLengthError;
    let ratchetWorldPhase;
    let phasePerHammer = 0;
    let phaseSecondPerHammer = 0;

    if (driving) {
      const closure = engagedClosureAtHammerAngle(hammerAngle);
      ({
        dogBase,
        dogLengthError,
        dogTip,
        phasePerHammer,
        phaseSecondPerHammer,
        worldPhase: ratchetWorldPhase,
      } = closure);
      cylinderIncrement = ratchetWorldPhase - ratchetContactPhase;
      cylinderAngularSpeed = phasePerHammer * hammerAngularSpeed;
      cylinderAngularAcceleration = phaseSecondPerHammer
        * hammerAngularSpeed ** 2
        + phasePerHammer * hammerAngularAcceleration;
    } else if (ready) {
      cylinderIncrement = normalizedCycle > fallEnd ? ratchetPitch : 0;
      const closure = engagedClosureAtHammerAngle(0);
      dogBase = closure.dogBase;
      dogTip = closure.dogTip;
      dogLengthError = closure.dogLengthError;
      ratchetWorldPhase = ratchetContactPhase;
    } else if (resetting) {
      cylinderIncrement = ratchetPitch;
      const reset = resetDogTip(hammerAngle, fallMotion.position);
      ({ axialClearance: dogAxialClearance, dogBase, dogTip } = reset);
      dogLengthError = dogBase.distanceTo(dogTip) - dogLength;
      ratchetWorldPhase = reset.targetPhase;
    } else {
      cylinderIncrement = ratchetPitch;
      const closure = engagedClosureAtHammerAngle(-hammerStroke);
      dogBase = closure.dogBase;
      dogTip = closure.dogTip;
      dogLengthError = closure.dogLengthError;
      ratchetWorldPhase = ratchetContactPhase + ratchetPitch;
    }

    const cylinderAngle = indexNumber * ratchetPitch + cylinderIncrement;
    const unlockMotion = quinticWindow(
      normalizedCycle,
      unlockStart,
      unlockEnd,
    );
    const relockMotion = quinticWindow(
      normalizedCycle,
      relockStart,
      relockEnd,
    );
    let lockEngagement;
    if (normalizedCycle < unlockStart) lockEngagement = 1;
    else if (normalizedCycle < unlockEnd) {
      lockEngagement = 1 - unlockMotion.position;
    } else if (normalizedCycle < relockStart) lockEngagement = 0;
    else if (normalizedCycle < relockEnd) {
      lockEngagement = relockMotion.position;
    } else lockEngagement = 1;
    const lockRetraction = (1 - lockEngagement) * lockRetractionDistance;
    const nearestIndex = Math.round(cylinderAngle / ratchetPitch);
    const indexAlignmentError = cylinderAngle
      - nearestIndex * ratchetPitch;

    const dogDirection = dogTip.clone().sub(dogBase).normalize();
    const dogBaseVelocity = dogBaseDerivativeAtHammerAngle(hammerAngle)
      .multiplyScalar(hammerAngularSpeed);
    const ratchetContactVelocity = ratchetPointDerivativeAtWorldPhase(
      ratchetWorldPhase,
    ).multiplyScalar(cylinderAngularSpeed);
    const dogTipVelocity = driving
      ? ratchetContactVelocity.clone()
      : new THREE.Vector3();
    const rigidLengthVelocityError = driving
      ? dogTipVelocity.clone().sub(dogBaseVelocity).dot(dogDirection)
      : 0;

    let stage;
    if (normalizedCycle < unlockStart) stage = 'source-ready-cylinder-locked';
    else if (normalizedCycle < cockStart) stage = 'receiver-lock-retracting';
    else if (normalizedCycle <= cockEnd) {
      stage = 'hammer-cocking-dog-driving-one-ratchet-step';
    } else if (normalizedCycle < fallStart) {
      stage = 'full-cock-cylinder-indexed-and-locking';
    } else if (normalizedCycle <= fallEnd) {
      stage = 'hammer-falling-spring-dog-clearing-next-tooth';
    } else stage = 'rest-ready-on-next-ratchet-tooth';

    return {
      cylinderAngle,
      cylinderAngularAcceleration,
      cylinderAngularSpeed,
      cylinderIncrement,
      dogAxialClearance,
      dogBase,
      dogBaseVelocity,
      dogDirection,
      dogLengthError,
      dogTip,
      dogTipVelocity,
      driving,
      hammerAngle,
      hammerAngularAcceleration,
      hammerAngularSpeed,
      indexAlignmentError,
      indexNumber,
      lockEngagement,
      lockRetraction,
      normalizedCycle,
      phasePerHammer,
      phaseSecondPerHammer,
      ratchetContactVelocity,
      ratchetWorldPhase,
      ready,
      resetting,
      rigidLengthVelocityError,
      stage,
    };
  };
  const stateAtTime = (time) => {
    const indexNumber = Math.floor(time / inputCyclePeriod);
    const normalizedCycle = THREE.MathUtils.euclideanModulo(
      time,
      inputCyclePeriod,
    ) / inputCyclePeriod;
    return stateAtNormalizedCycle(normalizedCycle, indexNumber);
  };
  const stateAtInputPhase = (phase) => {
    const indexNumber = Math.floor(phase / FULL_TURN);
    const normalizedCycle = THREE.MathUtils.euclideanModulo(
      phase,
      FULL_TURN,
    ) / FULL_TURN;
    return stateAtNormalizedCycle(normalizedCycle, indexNumber);
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.59,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const dogMaterialColor = PALETTE.accent;
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const cylinder = new THREE.Group();
  cylinder.position.set(cylinderCenterX, cylinderCenterY, 0);
  cylinder.userData.axis = X_AXIS.clone();
  cylinder.userData.role = 'fixed-axis-six-chamber-revolver-cylinder';
  const cylinderRotor = new THREE.Group();
  cylinderRotor.userData.axis = X_AXIS.clone();
  cylinderRotor.userData.role = 'six-step-indexed-cylinder-rotor';
  cylinder.add(cylinderRotor);
  root.add(cylinder);

  const cylinderBody = cylinderAlongX(
    cylinderRadius,
    cylinderLength,
    drivenMaterial,
    72,
  );
  cylinderBody.userData.role = 'six-chamber-cylinder-body';
  cylinderRotor.add(cylinderBody);
  const cylinderEndRings = [-1, 1].map((side) => {
    const ring = torusAroundX(
      cylinderRadius * 0.985,
      0.055,
      darkMaterial,
      64,
    );
    ring.position.x = side * cylinderLength / 2;
    ring.userData.role = side > 0
      ? 'rear-cylinder-edge-ring'
      : 'front-cylinder-edge-ring';
    cylinderRotor.add(ring);
    return ring;
  });
  const chamberStrips = Array.from({ length: ratchetTeeth }, (_, index) => {
    const phase = index * ratchetPitch;
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(cylinderLength * 0.91, 0.045, 0.13),
      darkMaterial,
    );
    strip.position.set(
      0,
      cylinderRadius * 0.96 * Math.cos(phase),
      cylinderRadius * 0.96 * Math.sin(phase),
    );
    strip.rotation.x = phase;
    strip.userData.role = `cylinder-longitudinal-index-strip-${index + 1}`;
    cylinderRotor.add(strip);
    return strip;
  });

  const ratchetShape = ratchetStarShape({
    contactPhase: ratchetContactPhase,
    rootRadius: ratchetRootRadius,
    teeth: ratchetTeeth,
    tipRadius: ratchetTipRadius,
  });
  const ratchet = new THREE.Mesh(
    centeredExtrusion(ratchetShape, ratchetDepth, 0.008),
    drivenMaterial,
  );
  ratchet.rotation.y = Math.PI / 2;
  ratchet.position.x = cylinderLength / 2 + ratchetDepth / 2;
  ratchet.userData.role = 'six-tooth-face-ratchet-b';
  cylinderRotor.add(ratchet);
  const ratchetHub = cylinderAlongX(0.31, ratchetDepth * 1.32, darkMaterial, 36);
  ratchetHub.position.x = cylinderLength / 2 + ratchetDepth / 2;
  ratchetHub.userData.role = 'ratchet-and-cylinder-common-hub';
  cylinderRotor.add(ratchetHub);
  const cylinderRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.64, 0.07),
    whiteMaterial,
  );
  cylinderRotationIndex.position.set(
    cylinderLength / 2 + ratchetDepth + 0.025,
    1.06,
    0,
  );
  cylinderRotationIndex.userData.role = 'white-cylinder-step-index';
  cylinderRotor.add(cylinderRotationIndex);

  const lockingWards = Array.from({ length: ratchetTeeth }, (_, index) => {
    const phase = Math.PI + index * ratchetPitch;
    const ward = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.14, 0.20),
      darkMaterial,
    );
    ward.position.set(
      cylinderLength / 2 + 0.035,
      cylinderRadius * 0.86 * Math.cos(phase),
      cylinderRadius * 0.86 * Math.sin(phase),
    );
    ward.rotation.x = phase;
    ward.userData.role = `cylinder-locking-ward-${index + 1}`;
    cylinderRotor.add(ward);
    return ward;
  });

  const hammer = new THREE.Group();
  hammer.position.z = dogPivotLocal.z;
  hammer.userData.axis = Z_AXIS.clone();
  hammer.userData.role = 'fixed-pivot-hammer-and-tumbler';
  const hammerRotor = new THREE.Group();
  hammerRotor.userData.axis = Z_AXIS.clone();
  hammerRotor.userData.role = 'cocked-and-released-hammer-rotor';
  hammer.add(hammerRotor);
  root.add(hammer);

  const hammerRasterOutline = [
    [242, 66], [302, 48], [352, 64], [392, 76], [425, 62],
    [462, 43], [500, 32], [515, 42], [507, 61], [487, 92],
    [471, 126], [454, 157], [429, 179], [424, 215], [408, 251],
    [386, 287], [365, 322], [383, 347], [405, 374], [419, 407],
    [419, 436], [407, 456], [382, 467], [347, 465], [314, 454],
    [281, 434], [260, 409], [249, 392], [229, 381], [210, 354],
    [211, 330], [224, 303], [240, 280], [260, 269], [286, 264],
    [307, 247], [320, 218], [329, 185], [330, 154], [320, 124],
    [302, 101], [275, 85], [243, 78],
  ];
  const hammerShape = new THREE.Shape();
  const hammerOutlinePoints = [];
  hammerRasterOutline.forEach(([x, y], index) => {
    const point = sourcePointToModel({ x, y });
    if (index === 0) hammerShape.moveTo(point.x, point.y);
    else hammerShape.lineTo(point.x, point.y);
    hammerOutlinePoints.push(new THREE.Vector3(point.x, point.y, 0.31));
  });
  hammerShape.closePath();
  const hammerBody = new THREE.Mesh(
    centeredExtrusion(hammerShape, 0.52, 0.02),
    driverMaterial,
  );
  hammerBody.userData.role = 'source-profiled-hammer-tumbler-body';
  hammerRotor.add(hammerBody);
  const hammerOutline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(hammerOutlinePoints),
    new THREE.LineBasicMaterial({ color: PALETTE.ink }),
  );
  hammerOutline.userData.role = 'dark-hammer-profile-outline';
  hammerRotor.add(hammerOutline);
  const hammerShaft = cylinderAlongZ(0.23, 1.14, darkMaterial, 36);
  hammerShaft.userData.role = 'hammer-pivot-shaft';
  hammerRotor.add(hammerShaft);
  const hammerHub = cylinderAlongZ(0.40, 0.63, driverMaterial, 40);
  hammerHub.userData.role = 'hammer-tumbler-pivot-hub';
  hammerRotor.add(hammerHub);
  const hammerRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.07, 0.032),
    whiteMaterial,
  );
  hammerRotationIndex.position.set(0.55, 0.10, 0.31);
  hammerRotationIndex.userData.role = 'white-hammer-cocking-index';
  hammerRotor.add(hammerRotationIndex);
  const dogPivotPin = cylinderAlongZ(0.14, 0.75, darkMaterial, 30);
  dogPivotPin.position.set(dogPivotLocal.x, dogPivotLocal.y, 0);
  dogPivotPin.userData.role = 'dog-a-pivot-on-hammer-tumbler';
  hammerRotor.add(dogPivotPin);

  const dog = makeDynamicLink({
    color: dogMaterialColor,
    depth: 0.19,
    jointRadius: 0.13,
    thickness: 0.20,
  });
  dog.userData.role = 'spring-biased-rigid-indexing-dog-a';
  root.add(dog);
  const dogTipIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 20, 14),
    whiteMaterial,
  );
  dogTipIndex.userData.role = 'white-dog-ratchet-contact-index';
  root.add(dogTipIndex);

  const springAnchor = new THREE.Vector3(
    sourcePointToModel(sourceRasterSpringAnchor).x,
    sourcePointToModel(sourceRasterSpringAnchor).y,
    -0.34,
  );
  const spring = makeDynamicCable({
    color: PALETTE.brass,
    maxSegments: 14,
    radius: 0.038,
  });
  spring.userData.role = 'cantilever-leaf-spring-c-holding-dog-to-ratchet';
  root.add(spring);
  const springAnchorBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.58, 0.34),
    frameMaterial,
  );
  springAnchorBlock.position.copy(springAnchor);
  springAnchorBlock.position.y += 0.16;
  springAnchorBlock.position.z -= 0.12;
  springAnchorBlock.userData.role = 'fixed-spring-c-anchor';
  root.add(springAnchorBlock);

  const lockBoltEngagedY = cylinderCenterY - cylinderRadius - 0.17;
  const lockBolt = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.48, 0.24),
    frameMaterial,
  );
  lockBolt.position.set(
    cylinderRearX + 0.035,
    lockBoltEngagedY,
    0,
  );
  lockBolt.userData.role =
    'receiver-lock-required-to-hold-cylinder-during-dog-reset';
  root.add(lockBolt);
  const lockSpring = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.035, 7, 24, Math.PI),
    matte(PALETTE.brass, { roughness: 0.55 }),
  );
  lockSpring.rotation.z = Math.PI / 2;
  lockSpring.position.set(
    cylinderRearX + 0.035,
    lockBoltEngagedY - 0.38,
    0,
  );
  lockSpring.userData.role = 'receiver-lock-return-spring';
  root.add(lockSpring);

  const cylinderShaft = cylinderAlongX(0.15, cylinderLength + 0.64,
    darkMaterial, 30);
  cylinderShaft.position.set(cylinderCenterX, cylinderCenterY, 0);
  cylinderShaft.userData.role = 'fixed-cylinder-arbor';
  root.add(cylinderShaft);
  const cylinderBearing = torusAroundX(0.24, 0.065, frameMaterial, 36);
  cylinderBearing.position.set(cylinderFrontX - 0.16, cylinderCenterY, 0);
  cylinderBearing.userData.role = 'fixed-front-cylinder-arbor-bearing';
  root.add(cylinderBearing);

  const baseY = -1.30;
  const frameZ = -1.42;
  const base = makeBeam(
    new THREE.Vector3(-3.58, baseY, frameZ),
    new THREE.Vector3(2.60, baseY, frameZ),
    { color: PALETTE.frame, depth: 0.28, thickness: 0.20 },
  );
  base.userData.role = 'fixed-colt-indexing-display-base';
  const hammerPost = makeBeam(
    new THREE.Vector3(0, baseY, frameZ),
    new THREE.Vector3(0, 0, frameZ),
    { color: PALETTE.frame, depth: 0.23, thickness: 0.18 },
  );
  hammerPost.userData.role = 'fixed-rear-hammer-bearing-post';
  const hammerBearingArm = makeBeam(
    new THREE.Vector3(0, 0, frameZ),
    new THREE.Vector3(0, 0, dogPivotLocal.z - 0.42),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.17 },
  );
  hammerBearingArm.userData.role = 'fixed-hammer-bearing-arm';
  const cylinderPost = makeBeam(
    new THREE.Vector3(cylinderCenterX, baseY, frameZ),
    new THREE.Vector3(cylinderCenterX, cylinderCenterY, frameZ),
    { color: PALETTE.frame, depth: 0.23, thickness: 0.18 },
  );
  cylinderPost.userData.role = 'fixed-cylinder-arbor-support-post';
  root.add(base, cylinderPost, hammerBearingArm, hammerPost);

  const sourceState = stateAtTime(0);
  const sourceIdealizationPixelErrors = {
    cylinderFrontBottom: new THREE.Vector2(
      cylinderFrontX,
      cylinderBottomY,
    ).distanceTo(sourcePointToModel(sourceRasterCylinderFrontBottom))
      / sourceScale,
    cylinderFrontTop: new THREE.Vector2(
      cylinderFrontX,
      cylinderTopY,
    ).distanceTo(sourcePointToModel(sourceRasterCylinderFrontTop))
      / sourceScale,
    cylinderRearBottom: new THREE.Vector2(
      cylinderRearX,
      cylinderBottomY,
    ).distanceTo(sourcePointToModel(sourceRasterCylinderRearBottom))
      / sourceScale,
    cylinderRearTop: new THREE.Vector2(
      cylinderRearX,
      cylinderTopY,
    ).distanceTo(sourcePointToModel(sourceRasterCylinderRearTop))
      / sourceScale,
    dogPivot: new THREE.Vector2(
      sourceState.dogBase.x,
      sourceState.dogBase.y,
    ).distanceTo(sourcePointToModel(sourceRasterDogPivot)) / sourceScale,
    hammerPivot: new THREE.Vector2(0, 0).distanceTo(
      sourcePointToModel(sourceRasterHammerPivot),
    ) / sourceScale,
    ratchetContactProjection: new THREE.Vector2(
      sourceState.dogTip.x,
      sourceState.dogTip.y,
    ).distanceTo(sourcePointToModel(
      sourceRasterRatchetContactProjection,
    )) / sourceScale,
    springAnchor: new THREE.Vector2(
      springAnchor.x,
      springAnchor.y,
    ).distanceTo(sourcePointToModel(sourceRasterSpringAnchor)) / sourceScale,
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    base,
    chamberStrips,
    cylinder,
    cylinderBearing,
    cylinderBody,
    cylinderEndRings,
    cylinderPost,
    cylinderRotationIndex,
    cylinderRotor,
    cylinderShaft,
    dog,
    dogPivotPin,
    dogTipIndex,
    hammer,
    hammerBearingArm,
    hammerBody,
    hammerHub,
    hammerOutline,
    hammerPost,
    hammerRotationIndex,
    hammerRotor,
    hammerShaft,
    lockBolt,
    lockingWards,
    lockSpring,
    ratchet,
    ratchetHub,
    spring,
    springAnchorBlock,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.78, -1.55, -2.28),
    // The source-profiled hammer sweeps farther right when fully cocked than
    // it does in Brown's illustrated rest pose. Include that whole envelope
    // so no mechanically important pose is cropped by the fitted camera.
    new THREE.Vector3(4.56, 4.08, 2.26),
  );
  root.userData.geometry = {
    cockEnd,
    cockStart,
    cylinderBottomY,
    cylinderCenterX,
    cylinderCenterY,
    cylinderFrontX,
    cylinderLength,
    cylinderRadius,
    cylinderRearX,
    cylinderTopY,
    dogLength,
    dogPivotLocal: dogPivotLocal.clone(),
    fallEnd,
    fallStart,
    fullCylinderPeriod,
    hammerStroke,
    inputCyclePeriod,
    lockRetractionDistance,
    ratchetContactPhase,
    ratchetContactX,
    ratchetDepth,
    ratchetPitch,
    ratchetRootRadius,
    ratchetTeeth,
    ratchetTipRadius,
    relockEnd,
    relockStart,
    resetClearance,
    sourceScale,
    unlockEnd,
    unlockStart,
  };
  root.userData.mechanism =
    'one pivoted hammer and tumbler carries one rigid dog a; spring c biases that dog into one six-tooth face ratchet b on the cylinder, each cocking stroke advances exactly one chamber, the receiver lock holds the indexed cylinder, and the spring lets the dog clear and reset over the next tooth during the hammer fall';
  root.userData.movement = movement;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason:
      'The official Movement 277 page marks its animation unavailable. The one-step cocking drive, spring-biased lateral dog reset, and separate cylinder-holding lock were reconstructed independently from Brown’s public-domain plate and Colt patent USX9430.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate277: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'one hammer/tumbler, one pivoted dog a, one leaf spring c, one six-step face ratchet b fixed to the cylinder, and a mechanically required receiver lock omitted from the small detail',
      measurementUncertaintyPixels: 5,
      ratchetContactProjectionUncertaintyPixels: 18,
      rasterCylinderFrontBottom: {
        x: sourceRasterCylinderFrontBottom.x,
        y: sourceRasterCylinderFrontBottom.y,
      },
      rasterCylinderFrontTop: {
        x: sourceRasterCylinderFrontTop.x,
        y: sourceRasterCylinderFrontTop.y,
      },
      rasterCylinderRearBottom: {
        x: sourceRasterCylinderRearBottom.x,
        y: sourceRasterCylinderRearBottom.y,
      },
      rasterCylinderRearTop: {
        x: sourceRasterCylinderRearTop.x,
        y: sourceRasterCylinderRearTop.y,
      },
      rasterDogPivot: {
        x: sourceRasterDogPivot.x,
        y: sourceRasterDogPivot.y,
      },
      rasterHammerPivot: {
        x: sourceRasterHammerPivot.x,
        y: sourceRasterHammerPivot.y,
      },
      rasterRatchetContactProjection: {
        x: sourceRasterRatchetContactProjection.x,
        y: sourceRasterRatchetContactProjection.y,
      },
      rasterSpringAnchor: {
        x: sourceRasterSpringAnchor.x,
        y: sourceRasterSpringAnchor.y,
      },
      sourceIdealizationPixelErrors,
    },
    primaryPatent: {
      evidence:
        'The patent states that drawing back the hammer makes the lifter act on a ratchet tooth until the next chamber aligns; on the hammer fall the lifter moves laterally past the next tooth while the cylinder key holds the new index.',
      patentDate: '1836-02-25',
      patentNumber: 'USX9430',
      title: 'Revolving Gun',
      url: 'https://patents.google.com/patent/USX9430/en',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 71,
      edition: 21,
      illustrationPage: 70,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtInputPhase = stateAtInputPhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    fullCylinderPeriod,
    hammerCyclesPerCylinderTurn: ratchetTeeth,
    inputCyclePeriod,
    sourceTime: 0,
  };
  root.userData.transmission = {
    cylinderStepPerCock: ratchetPitch,
    dogLength,
    engagedClosureAtHammerAngle,
    fullCylinderPeriod,
    hammerStroke,
    inputCyclePeriod,
    ratchetTeeth,
    resetLaw:
      'the dog remains rigid, clears axially under spring deflection on hammer fall, and returns to the next symmetry-equivalent tooth while the receiver lock holds the cylinder',
    stateAtInputPhase,
    stateAtTime,
    stepLaw:
      'one monotonic rigid-dog closure from rest contact to a zero-speed full-cock toggle advances cylinderAngle by exactly 2*pi/6',
  };

  const updateSpring = (state) => {
    const dogSpringPoint = state.dogBase.clone().lerp(state.dogTip, 0.58);
    const controlA = springAnchor.clone().add(new THREE.Vector3(
      0.06,
      -0.78,
      0.02,
    ));
    const controlB = dogSpringPoint.clone().add(new THREE.Vector3(
      0.22 + state.dogAxialClearance * 0.32,
      0.52,
      0.10,
    ));
    const points = Array.from({ length: 15 }, (_, index) => (
      cubicBezierPoint(
        springAnchor,
        controlA,
        controlB,
        dogSpringPoint,
        index / 14,
      )
    ));
    spring.userData.setPoints(points);
    spring.userData.anchor = springAnchor.clone();
    spring.userData.contactPoint = dogSpringPoint;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    hammerRotor.rotation.z = state.hammerAngle;
    hammer.userData.angularAcceleration = state.hammerAngularAcceleration;
    hammer.userData.angularSpeed = state.hammerAngularSpeed;
    cylinderRotor.rotation.x = state.cylinderAngle;
    cylinder.userData.angularAcceleration = state.cylinderAngularAcceleration;
    cylinder.userData.angularSpeed = state.cylinderAngularSpeed;
    dog.userData.setEndpoints(state.dogBase, state.dogTip);
    dog.userData.axialClearance = state.dogAxialClearance;
    dog.userData.lengthError = state.dogLengthError;
    dogTipIndex.position.copy(state.dogTip);
    lockBolt.position.y = lockBoltEngagedY - state.lockRetraction;
    lockBolt.userData.engagement = state.lockEngagement;
    updateSpring(state);
    root.userData.contacts = {
      cylinderLock: {
        alignmentError: state.indexAlignmentError,
        engagement: state.lockEngagement,
        retraction: state.lockRetraction,
      },
      dogRatchet: {
        active: state.driving,
        axialClearance: state.dogAxialClearance,
        contactPoint: state.dogTip.clone(),
        dogLengthError: state.dogLengthError,
        rigidLengthVelocityError: state.rigidLengthVelocityError,
        surfaceVelocityError: state.driving
          ? state.dogTipVelocity.clone().sub(state.ratchetContactVelocity)
          : null,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(7.0, 4.3, 9.4),
  };
}

export function createAuthoredColtRatchetMovement(movement) {
  if (movement.id !== 277) return null;
  const result = coltCylinderRatchet(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
