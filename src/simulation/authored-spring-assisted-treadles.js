import * as THREE from 'three';
import { makeBoredPlanarLink } from './bored-planar-link.js';
import { boreBoxAtLocalPoint, boreZCylinder, addZJournal, finishSpringFamily, makePlanarCurledSpring } from './spring-pivot-family-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function cross2(left, right) {
  return left.x * right.y - left.y * right.x;
}

function wrapSignedAngle(angle) {
  return THREE.MathUtils.euclideanModulo(angle + Math.PI, FULL_TURN)
    - Math.PI;
}

function cylinderAlongZ(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function beamBetween(start, end, width, depth, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(delta.y, delta.x);
  return beam;
}

function findPeriodicRoots(evaluate, samples = 7200) {
  const roots = [];
  let previousAngle = 0;
  let previousValue = evaluate(previousAngle);
  for (let index = 1; index <= samples; index += 1) {
    const angle = FULL_TURN * index / samples;
    const value = evaluate(angle);
    if (value * previousValue < 0) {
      let lower = previousAngle;
      let upper = angle;
      let lowerValue = previousValue;
      for (let iteration = 0; iteration < 64; iteration += 1) {
        const middle = (lower + upper) / 2;
        const middleValue = evaluate(middle);
        if (lowerValue * middleValue <= 0) {
          upper = middle;
        } else {
          lower = middle;
          lowerValue = middleValue;
        }
      }
      roots.push((lower + upper) / 2);
    }
    previousAngle = angle;
    previousValue = value;
  }
  return roots;
}

function springAssistedTreadle(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6;
  const crankAngularSpeed = FULL_TURN / cycleDuration;
  const sourceCrankAngle = 2.95;
  const wheelCenter = new THREE.Vector3(1.00, 1.05, 0);
  const treadlePivot = new THREE.Vector3(-2.50, -1.55, 0);
  const crankRadius = 0.62;
  const treadleJointRadius = 3.25;
  const pitmanLength = 2.77;
  const wheelRadius = 1.24;
  const springAnchor = new THREE.Vector3(-0.75, 0.58, 0.79);
  const springRate = 5;
  const springTurns = (4 * Math.PI - .55 - Math.PI/2) / FULL_TURN;
  const springCoilRadius = 0.85;

  const linkageAtCrankAngle = (crankAngle) => {
    const crankRadial = new THREE.Vector3(
      crankRadius * Math.cos(crankAngle),
      crankRadius * Math.sin(crankAngle),
      0,
    );
    const crankPin = wheelCenter.clone().add(crankRadial);
    const groundToCrank = crankPin.clone().sub(treadlePivot);
    const groundToCrankLength = groundToCrank.length();
    const groundAngle = Math.atan2(groundToCrank.y, groundToCrank.x);
    const cosineOffset = THREE.MathUtils.clamp(
      (treadleJointRadius ** 2 + groundToCrankLength ** 2
        - pitmanLength ** 2)
        / (2 * treadleJointRadius * groundToCrankLength),
      -1,
      1,
    );
    const treadleAngle = groundAngle - Math.acos(cosineOffset);
    const treadleRadial = new THREE.Vector3(
      treadleJointRadius * Math.cos(treadleAngle),
      treadleJointRadius * Math.sin(treadleAngle),
      0,
    );
    const treadleJoint = treadlePivot.clone().add(treadleRadial);
    const pitmanVector = treadleJoint.clone().sub(crankPin);
    return {
      crankAngle,
      crankPin,
      crankRadial,
      deadCenterMoment: cross2(crankRadial, pitmanVector),
      groundToCrankLength,
      pitmanVector,
      treadleAngle,
      treadleJoint,
      treadleRadial,
    };
  };

  const deadCenterAngles = findPeriodicRoots((angle) =>
    linkageAtCrankAngle(angle).deadCenterMoment);
  if (deadCenterAngles.length !== 2) {
    throw new Error('Movement 416 must have exactly two crank dead centers');
  }
  const springAttachmentAtCrankAngle = (angle) => {
    const attachment = linkageAtCrankAngle(angle).crankPin.clone();
    attachment.z = springAnchor.z;
    return attachment;
  };
  const deadCenterSpringLengths = deadCenterAngles.map((angle) =>
    springAttachmentAtCrankAngle(angle).distanceTo(springAnchor));
  const springNeutralLength = (
    deadCenterSpringLengths[0] + deadCenterSpringLengths[1]
  ) / 2;

  const stateAtCrankAngle = (
    crankAngle,
    crankSpeed = crankAngularSpeed,
    crankAcceleration = 0,
  ) => {
    const linkage = linkageAtCrankAngle(crankAngle);
    const crankUnit = linkage.crankRadial.clone()
      .multiplyScalar(1 / crankRadius);
    const crankTangent = new THREE.Vector3(-crankUnit.y, crankUnit.x, 0);
    const treadleUnit = linkage.treadleRadial.clone()
      .multiplyScalar(1 / treadleJointRadius);
    const treadleTangent = new THREE.Vector3(
      -treadleUnit.y,
      treadleUnit.x,
      0,
    );
    const pitmanVelocityDenominator = treadleJointRadius
      * linkage.pitmanVector.dot(treadleTangent);
    const treadleAngularSpeed = crankRadius * crankSpeed
      * linkage.pitmanVector.dot(crankTangent)
      / pitmanVelocityDenominator;
    const crankPinVelocity = crankTangent.clone()
      .multiplyScalar(crankRadius * crankSpeed);
    const treadleJointVelocity = treadleTangent.clone()
      .multiplyScalar(treadleJointRadius * treadleAngularSpeed);
    const relativeVelocity = treadleJointVelocity.clone()
      .sub(crankPinVelocity);
    const treadleAngularAcceleration = (
      -relativeVelocity.lengthSq()
      + treadleJointRadius * treadleAngularSpeed ** 2
        * linkage.pitmanVector.dot(treadleUnit)
      + crankRadius * crankAcceleration
        * linkage.pitmanVector.dot(crankTangent)
      - crankRadius * crankSpeed ** 2
        * linkage.pitmanVector.dot(crankUnit)
    ) / pitmanVelocityDenominator;
    const springAttachment = linkage.crankPin.clone();
    springAttachment.z = springAnchor.z;
    const springAxis = springAttachment.clone().sub(springAnchor);
    const springLength = springAxis.length();
    const springExtension = springLength - springNeutralLength;
    const springAxisUnit = springAxis.clone().multiplyScalar(1 / springLength);
    const springForceOnCrank = springAxisUnit.clone()
      .multiplyScalar(-springRate * springExtension);
    const springTorque = cross2(
      linkage.crankRadial,
      springForceOnCrank,
    );
    const tangentialSpringForce = springForceOnCrank.dot(crankTangent);
    const radialSpringForce = springForceOnCrank.dot(crankUnit);
    const springPotentialEnergy = springRate * springExtension ** 2 / 2;
    const angularDistancesToDeadCenters = deadCenterAngles.map((angle) =>
      Math.abs(wrapSignedAngle(crankAngle - angle)));
    return {
      ...linkage,
      angularDistanceToNearestDeadCenter: Math.min(
        ...angularDistancesToDeadCenters,
      ),
      crankAcceleration,
      crankPinVelocity,
      crankSpeed,
      crankTangent,
      crankUnit,
      pitmanLengthResidual: linkage.pitmanVector.length() - pitmanLength,
      pitmanVelocityConstraintResidual: linkage.pitmanVector.dot(
        relativeVelocity,
      ),
      radialSpringForce,
      relativeVelocity,
      springAxis,
      springAxisUnit,
      springAttachment,
      springCondition: springExtension > 1e-10
        ? 'tension'
        : springExtension < -1e-10
          ? 'compression'
          : 'neutral',
      springExtension,
      springForceOnCrank,
      springLength,
      springPotentialEnergy,
      springPower: springTorque * crankSpeed,
      springTorque,
      tangentialSpringForce,
      treadleAngularAcceleration,
      treadleAngularSpeed,
      treadleJointVelocity,
      treadleTangent,
      treadleUnit,
    };
  };

  const deadCenterStates = deadCenterAngles.map((angle) =>
    stateAtCrankAngle(angle));
  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const crankAngle = sourceCrankAngle
      + crankAngularSpeed * cycleTime;
    return {
      ...stateAtCrankAngle(crankAngle),
      cycleTime,
      phase: cycleTime / cycleDuration,
    };
  };

  const centerToSpringAnchorLength = Math.hypot(
    springAnchor.x - wheelCenter.x,
    springAnchor.y - wheelCenter.y,
  );
  const springMinimumLengthAngle = Math.atan2(
    springAnchor.y - wheelCenter.y,
    springAnchor.x - wheelCenter.x,
  );
  const springMaximumLengthAngle = springMinimumLengthAngle + Math.PI;
  const minimumSpringLength = centerToSpringAnchorLength - crankRadius;
  const maximumSpringLength = centerToSpringAnchorLength + crankRadius;
  let minimumTreadleAngle = Infinity;
  let maximumTreadleAngle = -Infinity;
  for (let index = 0; index <= 7200; index += 1) {
    const sample = stateAtCrankAngle(FULL_TURN * index / 7200);
    minimumTreadleAngle = Math.min(minimumTreadleAngle, sample.treadleAngle);
    maximumTreadleAngle = Math.max(maximumTreadleAngle, sample.treadleAngle);
  }

  const geometry = {
    crankAngularSpeed,
    crankRadius,
    cycleDuration,
    deadCenterAngles,
    deadCenterSpringLengths,
    maximumSpringLength,
    maximumTreadleAngle,
    minimumSpringLength,
    minimumTreadleAngle,
    pitmanLength,
    sourceCrankAngle,
    springAnchor,
    springCoilRadius,
    springNeutralLength,
    springRate,
    springTurns,
    springMaximumLengthAngle,
    springMinimumLengthAngle,
    treadleJointRadius,
    treadlePivot,
    wheelCenter,
    wheelRadius,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.26,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.50,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.21,
    roughness: 0.47,
  });
  const springMaterial = matte(PALETTE.accent, {
    metalness: 0.34,
    roughness: 0.38,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-flywheel-and-treadle-bearing-frame';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(6.50, 0.20, 1.06),
    frameMaterial,
  );
  base.position.set(-0.18, -2.34, -0.55);
  base.userData.role = 'fixed-treadle-machine-foundation';
  fixedFrame.add(base);
  const wheelPost = beamBetween(
    new THREE.Vector3(1.00, -2.24, -0.55),
    new THREE.Vector3(1.00, 1.05, -0.55),
    0.22,
    0.25,
    frameMaterial,
  );
  wheelPost.userData.role = 'fixed-flywheel-bearing-standard';
  const wheelBrace = beamBetween(
    new THREE.Vector3(2.05, -2.24, -0.55),
    new THREE.Vector3(1.00, 0.25, -0.55),
    0.15,
    0.20,
    frameMaterial,
  );
  wheelBrace.userData.role = 'fixed-flywheel-standard-brace';
  fixedFrame.add(wheelPost, wheelBrace);
  const wheelBearing = cylinderAlongZ(0.24, 0.45, frameMaterial, 34);
  wheelBearing.position.copy(wheelCenter);
  wheelBearing.position.z = -0.46;
  boreZCylinder(wheelBearing,.24,.114,.45);
  wheelBearing.userData.role = 'fixed-crankshaft-bearing';
  fixedFrame.add(wheelBearing);
  const treadleBearing = cylinderAlongZ(0.18, 0.58, frameMaterial, 30);
  treadleBearing.position.copy(treadlePivot);
  treadleBearing.position.z = -0.35;
  boreZCylinder(treadleBearing,.18,.114,.40);
  treadleBearing.userData.role = 'fixed-treadle-pivot-bearing';
  fixedFrame.add(treadleBearing);
  const springBracket = cylinderAlongZ(0.25, 0.42, frameMaterial, 34);
  springBracket.position.copy(springAnchor);
  springBracket.position.z = 0.05;
  boreZCylinder(springBracket,.25,.114,.42);
  const springStandard=new THREE.Mesh(new THREE.BoxGeometry(.14,2.83,.16),frameMaterial);
  springStandard.position.set(springAnchor.x,-.835,-.22);
  springStandard.userData.role='fixed-spring-anchor-standard';fixedFrame.add(springStandard);
  springBracket.userData.role = 'fixed-curled-spring-A-anchor-bracket';
  fixedFrame.add(springBracket);
  root.add(fixedFrame);

  const flywheelRotor = new THREE.Group();
  flywheelRotor.position.copy(wheelCenter);
  flywheelRotor.userData.role =
    'continuous-full-rotation-flywheel-and-crank-B-rotor';
  const flywheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(wheelRadius, 0.12, 14, 96),
    drivenMaterial,
  );
  flywheelRim.position.z = -0.08;
  flywheelRim.userData.role = 'heavy-flywheel-rim-fast-on-crankshaft';
  flywheelRotor.add(flywheelRim);
  for (let index = 0; index < 4; index += 1) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(wheelRadius * 1.78, 0.11, 0.15),
      drivenMaterial,
    );
    boreBoxAtLocalPoint(spoke,[0,0],.114);
    spoke.rotation.z = index * Math.PI / 4;
    spoke.position.z = -0.08;
    spoke.userData.role = 'flywheel-spoke-fast-on-crankshaft';
    flywheelRotor.add(spoke);
  }
  const flywheelHub = cylinderAlongZ(0.28, 0.50, drivenMaterial, 38);
  flywheelHub.position.z = -0.02;
  boreZCylinder(flywheelHub,.28,.114,.50);
  flywheelHub.userData.role = 'flywheel-hub-fast-on-crankshaft';
  flywheelRotor.add(flywheelHub);
  const crankArm = beamBetween(
    new THREE.Vector3(0, 0, 0.33),
    new THREE.Vector3(crankRadius, 0, 0.33),
    0.17,
    0.18,
    driverMaterial,
  );
  boreBoxAtLocalPoint(crankArm,[-crankRadius/2,0],.114);
  crankArm.userData.role = 'rigid-crank-B-arm';
  flywheelRotor.add(crankArm);
  const crankHub=addZJournal(flywheelRotor,.20,.114,.28,driverMaterial,new THREE.Vector3(0,0,.28),'bored-crank-to-flywheel-hub');
  const crankPin = cylinderAlongZ(0.13, 0.88, whiteMaterial, 26);
  crankPin.position.set(crankRadius, 0, 0.53);
  crankPin.userData.role = 'white-crank-B-pin-and-spring-attachment';
  flywheelRotor.add(crankPin);
  const flywheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.075, 0.045),
    whiteMaterial,
  );
  flywheelIndex.position.set(wheelRadius - 0.27, 0, 0.02);
  flywheelIndex.userData.role = 'white-full-rotation-flywheel-index';
  flywheelRotor.add(flywheelIndex);
  root.add(flywheelRotor);

  const treadleRotor = new THREE.Group();
  treadleRotor.position.copy(treadlePivot);
  treadleRotor.userData.role = 'rocking-foot-treadle-input';
  const treadleBeam = new THREE.Mesh(
    new THREE.BoxGeometry(treadleJointRadius + 0.48, 0.13, 0.30),
    driverMaterial,
  );
  treadleBeam.position.set((treadleJointRadius - 0.48) / 2, 0, 0.06);
  boreBoxAtLocalPoint(treadleBeam,[-(treadleJointRadius-.48)/2,0],.114);
  const treadleHub=addZJournal(treadleRotor,.20,.114,.30,driverMaterial,new THREE.Vector3(0,0,.06),'bored-treadle-hub');
  const treadleShaft=cylinderAlongZ(.11,.92,darkMaterial);treadleShaft.position.copy(treadlePivot).setZ(-.12);root.add(treadleShaft);
  treadleBeam.userData.role = 'rigid-treadle-lever';
  treadleRotor.add(treadleBeam);
  const footPad = new THREE.Mesh(
    new THREE.BoxGeometry(1.32, 0.25, 0.82),
    driverMaterial,
  );
  footPad.position.set(0.76, 0.08, 0.10);
  footPad.userData.role = 'broad-treadle-foot-pad';
  treadleRotor.add(footPad);
  const treadleIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.31, 0.46),
    whiteMaterial,
  );
  treadleIndex.position.set(1.18, 0.15, 0.12);
  treadleIndex.userData.role = 'white-treadle-rocking-index';
  treadleRotor.add(treadleIndex);
  const treadleJointPin = cylinderAlongZ(0.13, 0.68, whiteMaterial, 24);
  treadleJointPin.position.set(treadleJointRadius, 0, 0.25);
  treadleJointPin.userData.role = 'white-treadle-to-pitman-joint';
  treadleRotor.add(treadleJointPin);
  root.add(treadleRotor);

  const pitman = makeBoredPlanarLink({length:pitmanLength,width:.15,eyeRadius:.19,boreRadius:.134,depth:.10},darkMaterial);
  pitman.userData.role = 'constant-length-pitman-from-crank-B-to-treadle';
  root.add(pitman);
  const spring = makePlanarCurledSpring(springMaterial);
  root.add(spring);
  const springAnchorEye=addZJournal(root,.18,.114,.06,springMaterial,springAnchor,'spring-fixed-end-pivot-eye');
  const springCrankEye=addZJournal(root,.18,.134,.06,springMaterial,springAnchor,'spring-crank-end-pivot-eye');
  const springAnchorPin = cylinderAlongZ(0.11, 1.20, darkMaterial, 28);
  springAnchorPin.position.copy(springAnchor).setZ(.65);
  springAnchorPin.userData.role = 'fixed-inner-end-of-curled-spring-A';
  root.add(springAnchorPin);
  const crankShaft = cylinderAlongZ(0.11, 1.16, darkMaterial, 30);
  crankShaft.position.copy(wheelCenter);
  crankShaft.userData.role = 'crankshaft-through-fixed-bearing';
  root.add(crankShaft);

  const update = (time) => {
    const state = stateAtTime(time);
    flywheelRotor.rotation.z = state.crankAngle;
    treadleRotor.rotation.z = state.treadleAngle;
    const pitmanStart = state.crankPin.clone();
    const pitmanEnd = state.treadleJoint.clone();
    pitmanStart.z = 0.49;
    pitmanEnd.z = 0.49;
    pitman.userData.setEndpoints(pitmanStart, pitmanEnd);
    spring.userData.setEndpoints(springAnchor, state.springAttachment);
    springCrankEye.position.copy(state.springAttachment);
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'preloaded-tension-compression-helical-spring-assisted-full-rotation-crank-rocker-treadle-through-both-dead-centers',
    blocks: {
      crankArm,
      crankHub,
      crankPin,
      fixedFrame,
      flywheelIndex,
      flywheelRotor,
      pitman,
      wheelBearing,
      crankShaft,
      treadleShaft,
      treadleHub,
      treadleBearing,
      springAnchorEye,
      springCrankEye,
      spring,
      springAnchorPin,
      treadleJointPin,
      treadleRotor,
    },
    deadCenterStates,
    degreesOfFreedom: {
      elasticEnergyStates: 1,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      pitmanLengthIndependent: false,
      treadleAngleIndependent: false,
    },
    dynamics: {
      gravityDampingInertiaFootLoadsAndBearingFrictionModeled: false,
      helicalSpringLaw: 'force=-springRate*(length-neutralLength)',
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      springPotentialEnergy: '0.5*springRate*extension^2',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Crank B and its flywheel make one continuous turn while a constant-length pitman rocks the treadle through exact four-bar closure. Preloaded helical spring A is stretched at the upper toggle and compressed at the lower toggle; its force therefore gives B positive tangential torque at both zero-leverage dead centers, exchanging stored energy without imposing net work over a complete turn.',
    motion: {
      cycleDuration,
      crankAngularSpeed,
      crankTurnsPerCycle: 1,
      springBehavior:
        'tension at one dead center, compression at the other, neutral between them',
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 416 page marks its Animated control unavailable and supplies only Brown’s static plate.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      crankAngle: sourceState.crankAngle,
      springCondition: sourceState.springCondition,
      treadleAngle: sourceState.treadleAngle,
    },
    sourceReference: {
      brownPlate416: {
        crankBPinApproximatePixels: [270, 164],
        flywheelApproximateBoundsPixels: [213, 48, 469, 304],
        helicalSpringAApproximateBoundsPixels: [92, 126, 274, 267],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 12,
        pitmanApproximateEndpointsPixels: [[270, 164], [350, 439]],
        treadleApproximateBoundsPixels: [39, 428, 364, 465],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the mechanism belongs to a treadle motion',
          'the device assists the crank over the dead centers',
          'A is a helical spring',
          'B is the crank',
          'A tends to move B at right angles to the dead centers',
        ],
        engravingEvidence:
          'Brown’s plate shows one flywheel and crank B, a long pitman from B to a rocking treadle, and a separately anchored spring A whose free end reaches the crankpin.',
        reconstructionDisclosure:
          'Brown fixes the crank, pitman, treadle, spring attachment, and intended dead-center assistance but gives no link lengths, pivot locations, spring rate, preload, dimensions, speed, or force values. The exact crank-rocker proportions, full-turn timing, broad expanding planar spring curl and its prescribed terminal deformation, and neutral spring length halfway between the two toggle lengths are independently engineered. The latter makes the modeled linear spring pull at one dead center and push at the other so both tangential torques have the same sign.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 416',
    },
    stateAtCrankAngle,
    stateAtTime,
    transmission: {
      deadCenterDefinition:
        'cross(crank radial vector, pitman vector)=0',
      fourBarClosure:
        'distance(crank pin B,treadle joint)=constant pitman length',
      springAssistance:
        'cross(crank radial vector,spring force)>0 at both dead centers',
      springWork:
        'spring force derives from 0.5*k*extension^2, so its net work is zero over a closed crank turn',
      velocityClosure:
        'pitmanVector dot (treadleJointVelocity-crankPinVelocity)=0',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.20, -2.48, -1.12),
    new THREE.Vector3(2.55, 2.48, 1.18),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(5.8, 3.8, 10.8);
  root.userData.groundFloorY = -2.48;
  finishSpringFamily(root, cycleDuration);
  markShadows(root);
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredSpringAssistedTreadleMovement(movement) {
  if (movement.id !== 416) return null;
  return springAssistedTreadle(movement);
}
