import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

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

function quinticState(parameter) {
  const u = THREE.MathUtils.clamp(parameter, 0, 1);
  return {
    acceleration: 60 * u * (1 - u) * (1 - 2 * u),
    rate: 30 * u ** 2 * (1 - u) ** 2,
    value: u ** 3 * (10 + u * (-15 + 6 * u)),
  };
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
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

function makeDynamicRod(radius, material) {
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 1, 24),
    material,
  );
  rod.userData.setEndpoints = (start, end) => {
    const direction = end.clone().sub(start);
    rod.position.copy(start).add(end).multiplyScalar(0.5);
    rod.scale.set(1, direction.length(), 1);
    rod.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );
  };
  return rod;
}

function makeCrank({
  crankRadius,
  darkMaterial,
  driverMaterial,
  pinRadius,
  whiteMaterial,
}) {
  const crank = new THREE.Group();
  crank.userData.role =
    'constant-speed-input-crank-with-slot-roller-pin';
  const disk = cylinderAlongZ(0.43, 0.34, driverMaterial, 44);
  disk.userData.role = 'continuous-input-crank-disk';
  crank.add(disk);
  const shaft = cylinderAlongZ(0.14, 0.76, darkMaterial, 28);
  shaft.position.z = -0.03;
  shaft.userData.role = 'fixed-axis-input-crankshaft';
  crank.add(shaft);
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.16, 0.18),
    driverMaterial,
  );
  arm.position.set(crankRadius / 2, 0, 0.29);
  arm.userData.role = 'crank-arm-from-shaft-to-slot-roller';
  crank.add(arm);
  const pin = cylinderAlongZ(pinRadius, 0.38, darkMaterial, 28);
  pin.position.set(crankRadius, 0, 0.42);
  pin.userData.role = 'crank-pin-running-in-synthesized-curved-slot';
  crank.add(pin);
  const pinIndex = cylinderAlongZ(pinRadius * 0.62, 0.10,
    whiteMaterial, 22);
  pinIndex.position.set(crankRadius, 0, 0.66);
  pinIndex.userData.role = 'white-index-on-slot-roller';
  crank.add(pinIndex);
  crank.userData.arm = arm;
  crank.userData.disk = disk;
  crank.userData.pin = pin;
  crank.userData.pinIndex = pinIndex;
  crank.userData.shaft = shaft;
  return markShadows(crank);
}

function makeSlottedRocker({
  darkMaterial,
  rockerMaterial,
  slotCurve,
  topJointLocal,
  whiteMaterial,
}) {
  const rocker = new THREE.Group();
  rocker.userData.role =
    'bottom-pivoted-rocker-carrying-one-closed-dwell-cam-slot';
  const slotBody = new THREE.Mesh(
    new THREE.TubeGeometry(slotCurve, 320, 0.29, 14, true),
    rockerMaterial,
  );
  slotBody.userData.role = 'thick-curved-rocker-body-around-slot';
  rocker.add(slotBody);
  const slot = new THREE.Mesh(
    new THREE.TubeGeometry(slotCurve, 320, 0.135, 12, true),
    darkMaterial,
  );
  slot.position.z = 0.18;
  slot.userData.role =
    'single-closed-synthesized-slot-centerline-envelope';
  rocker.add(slot);

  const sampledPoints = slotCurve.points;
  const lowestSlotPoint = sampledPoints.reduce((lowest, point) => (
    point.y < lowest.y ? point : lowest
  ), sampledPoints[0]);
  const highestSlotPoint = sampledPoints.reduce((highest, point) => (
    point.y > highest.y ? point : highest
  ), sampledPoints[0]);
  const lowerArm = beamBetween(
    new THREE.Vector3(0, 0, 0.22),
    new THREE.Vector3(lowestSlotPoint.x, lowestSlotPoint.y, 0.22),
    0.25,
    0.24,
    rockerMaterial,
  );
  lowerArm.userData.role = 'rocker-lower-arm-to-fixed-pivot';
  const upperArm = beamBetween(
    new THREE.Vector3(highestSlotPoint.x, highestSlotPoint.y, 0.22),
    new THREE.Vector3(topJointLocal.x, topJointLocal.y, 0.22),
    0.22,
    0.24,
    rockerMaterial,
  );
  upperArm.userData.role = 'rocker-upper-arm-to-output-joint';
  rocker.add(lowerArm, upperArm);

  const pivotHub = cylinderAlongZ(0.18, 0.72, darkMaterial, 30);
  pivotHub.position.z = 0.14;
  pivotHub.userData.role = 'fixed-bottom-rocker-pivot-bearing';
  const topJoint = cylinderAlongZ(0.15, 0.52, darkMaterial, 28);
  topJoint.position.set(topJointLocal.x, topJointLocal.y, 0.28);
  topJoint.userData.role = 'rocker-top-pin-to-finite-output-rod';
  const topJointIndex = cylinderAlongZ(0.075, 0.10, whiteMaterial, 22);
  topJointIndex.position.set(topJointLocal.x, topJointLocal.y, 0.59);
  topJointIndex.userData.role = 'white-index-on-rocker-output-pin';
  rocker.add(pivotHub, topJoint, topJointIndex);

  rocker.userData.lowerArm = lowerArm;
  rocker.userData.pivotHub = pivotHub;
  rocker.userData.slot = slot;
  rocker.userData.slotBody = slotBody;
  rocker.userData.slotCurve = slotCurve;
  rocker.userData.topJoint = topJoint;
  rocker.userData.topJointIndex = topJointIndex;
  rocker.userData.upperArm = upperArm;
  return markShadows(rocker);
}

function intermittentShuttleDrive(movement) {
  const root = new THREE.Group();

  // Brown gives only the topology.  A positive curved groove is synthesized
  // by inverse kinematics: at each constant-speed crank angle, the pin's
  // world point is transformed into the current rocker coordinates.  The
  // resulting one-cycle locus is the rigid slot that exactly realizes the
  // chosen two-dwell rocker law.
  const cycleDuration = 6;
  const crankCenter = new THREE.Vector2(0.78, 0.20);
  const rockerPivot = new THREE.Vector2(0, -2.00);
  const crankRadius = 1.22;
  const crankReferenceAngle = THREE.MathUtils.degToRad(150);
  const crankAngularSpeed = FULL_TURN / cycleDuration;
  const rockerAmplitude = THREE.MathUtils.degToRad(9);
  const topJointRadius = 3.75;
  const topJointLocal = new THREE.Vector2(0, topJointRadius);
  const guideY = rockerPivot.y + topJointRadius + 0.08;
  const connectingRodLength = 2.42;
  const pinRadius = 0.12;
  const sourcePoseLawPhase = 0.35;
  const rightDwellEnd = 0.25;
  const leftwardStrokeEnd = 0.45;
  const leftDwellEnd = 0.75;
  const rightwardStrokeEnd = 0.95;
  const slotSampleCount = 360;

  const rockerLawAtPhase = (unwrappedLawPhase) => {
    const lawPhase = positiveModulo(unwrappedLawPhase, 1);
    let stage;
    let angle;
    let angularSpeed;
    let angularAcceleration;
    let progress;
    if (lawPhase < rightDwellEnd) {
      stage = 'right-end-output-dwell';
      angle = -rockerAmplitude;
      angularSpeed = 0;
      angularAcceleration = 0;
      progress = 0;
    } else if (lawPhase < leftwardStrokeEnd) {
      stage = 'leftward-output-stroke';
      const width = leftwardStrokeEnd - rightDwellEnd;
      progress = (lawPhase - rightDwellEnd) / width;
      const motion = quinticState(progress);
      const duration = width * cycleDuration;
      angle = -rockerAmplitude + 2 * rockerAmplitude * motion.value;
      angularSpeed = 2 * rockerAmplitude * motion.rate / duration;
      angularAcceleration = 2 * rockerAmplitude
        * motion.acceleration / duration ** 2;
    } else if (lawPhase < leftDwellEnd) {
      stage = 'left-end-output-dwell';
      angle = rockerAmplitude;
      angularSpeed = 0;
      angularAcceleration = 0;
      progress = 1;
    } else if (lawPhase < rightwardStrokeEnd) {
      stage = 'rightward-output-return-stroke';
      const width = rightwardStrokeEnd - leftDwellEnd;
      progress = (lawPhase - leftDwellEnd) / width;
      const motion = quinticState(progress);
      const duration = width * cycleDuration;
      angle = rockerAmplitude - 2 * rockerAmplitude * motion.value;
      angularSpeed = -2 * rockerAmplitude * motion.rate / duration;
      angularAcceleration = -2 * rockerAmplitude
        * motion.acceleration / duration ** 2;
    } else {
      stage = 'right-end-output-dwell';
      angle = -rockerAmplitude;
      angularSpeed = 0;
      angularAcceleration = 0;
      progress = 0;
    }
    return {
      angle,
      angularAcceleration,
      angularSpeed,
      lawPhase,
      progress,
      stage,
    };
  };

  const crankPinWorldAtPhase = (driverPhase) => crankCenter.clone().add(
    rotate2(
      new THREE.Vector2(crankRadius, 0),
      crankReferenceAngle + FULL_TURN * driverPhase,
    ),
  );
  const slotLocalAtDriverPhase = (driverPhase) => {
    const rockerState = rockerLawAtPhase(
      driverPhase + sourcePoseLawPhase,
    );
    return rotate2(
      crankPinWorldAtPhase(driverPhase).sub(rockerPivot),
      -rockerState.angle,
    );
  };
  const slotSamples = Array.from(
    { length: slotSampleCount },
    (_, index) => {
      const driverPhase = index / slotSampleCount;
      const point = slotLocalAtDriverPhase(driverPhase);
      return new THREE.Vector3(point.x, point.y, 0.38);
    },
  );
  const slotCurve = new THREE.CatmullRomCurve3(
    slotSamples,
    true,
    'centripetal',
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.51,
  });
  const rockerMaterial = matte(PALETTE.brass, {
    metalness: 0.22,
    roughness: 0.47,
  });
  const outputMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.53,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.65,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.42,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.38 });

  const crank = makeCrank({
    crankRadius,
    darkMaterial,
    driverMaterial,
    pinRadius,
    whiteMaterial,
  });
  crank.position.set(crankCenter.x, crankCenter.y, 0);
  root.add(crank);
  const rocker = makeSlottedRocker({
    darkMaterial,
    rockerMaterial,
    slotCurve,
    topJointLocal,
    whiteMaterial,
  });
  rocker.position.set(rockerPivot.x, rockerPivot.y, 0);
  root.add(rocker);

  const connectingRod = makeDynamicRod(0.075, rockerMaterial);
  connectingRod.userData.role =
    'finite-link-from-rocker-top-to-horizontal-shuttle-slide';
  root.add(markShadows(connectingRod));
  const outputSlider = new THREE.Group();
  outputSlider.userData.role =
    'intermittently-reciprocating-horizontal-shuttle-carriage';
  const shuttleBar = new THREE.Mesh(
    new THREE.BoxGeometry(3.70, 0.22, 0.28),
    outputMaterial,
  );
  shuttleBar.position.set(-0.48, 0.27, 0);
  shuttleBar.userData.role = 'sewing-machine-or-printing-press-output-slide';
  const sliderJoint = cylinderAlongZ(0.14, 0.46, darkMaterial, 28);
  sliderJoint.position.z = 0.28;
  sliderJoint.userData.role = 'output-rod-to-slider-pin';
  const outputIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.32, 0.06),
    whiteMaterial,
  );
  outputIndex.position.set(-1.95, 0.27, 0.20);
  outputIndex.userData.role =
    'white-index-making-output-strokes-and-dwells-legible';
  outputSlider.add(shuttleBar, sliderJoint, outputIndex);
  root.add(markShadows(outputSlider));

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'fixed-frame-carrying-crank-rocker-and-horizontal-slide-guides';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(7.30, 0.22, 1.28),
    frameMaterial,
  );
  base.position.set(-1.0, -2.35, -0.32);
  base.userData.role = 'fixed-machine-base';
  fixedFrame.add(base);
  const rockerBoss = cylinderAlongZ(0.30, 0.20, frameMaterial, 34);
  rockerBoss.position.set(rockerPivot.x, rockerPivot.y, -0.24);
  rockerBoss.userData.role = 'fixed-rocker-bearing-boss';
  const crankBoss = cylinderAlongZ(0.30, 0.20, frameMaterial, 34);
  crankBoss.position.set(crankCenter.x, crankCenter.y, -0.24);
  crankBoss.userData.role = 'fixed-crank-bearing-boss';
  fixedFrame.add(rockerBoss, crankBoss);
  const guideLength = 5.85;
  const guides = [-1, 1].map((side) => {
    const guide = new THREE.Mesh(
      new THREE.BoxGeometry(guideLength, 0.075, 0.12),
      darkMaterial,
    );
    guide.position.set(-1.98, guideY + 0.27 + side * 0.19, -0.07);
    guide.userData.side = side;
    guide.userData.role = 'fixed-horizontal-shuttle-guide-rail';
    fixedFrame.add(guide);
    return guide;
  });
  root.add(markShadows(fixedFrame));

  const stateAtTime = (time) => {
    const cycleCoordinate = time / cycleDuration;
    const cyclePhase = positiveModulo(cycleCoordinate, 1);
    const inputAngle = crankReferenceAngle + FULL_TURN * cycleCoordinate;
    const inputPinWorld = crankCenter.clone().add(rotate2(
      new THREE.Vector2(crankRadius, 0),
      inputAngle,
    ));
    const rockerState = rockerLawAtPhase(
      cyclePhase + sourcePoseLawPhase,
    );
    const slotLocalPoint = rotate2(
      inputPinWorld.clone().sub(rockerPivot),
      -rockerState.angle,
    );
    const reconstructedPinWorld = rockerPivot.clone().add(rotate2(
      slotLocalPoint,
      rockerState.angle,
    ));
    const topJointWorld = rockerPivot.clone().add(rotate2(
      topJointLocal,
      rockerState.angle,
    ));
    const topJointVelocity = new THREE.Vector2(
      -topJointRadius * Math.cos(rockerState.angle)
        * rockerState.angularSpeed,
      -topJointRadius * Math.sin(rockerState.angle)
        * rockerState.angularSpeed,
    );
    const verticalDifference = guideY - topJointWorld.y;
    const horizontalReach = Math.sqrt(
      Math.max(0, connectingRodLength ** 2 - verticalDifference ** 2),
    );
    const sliderJointWorld = new THREE.Vector2(
      topJointWorld.x - horizontalReach,
      guideY,
    );
    const verticalDifferenceRate = -topJointVelocity.y;
    const sliderVelocity = topJointVelocity.x
      + verticalDifference * verticalDifferenceRate / horizontalReach;
    return {
      cycleCoordinate,
      cyclePhase,
      dwellActive: /dwell/.test(rockerState.stage),
      inputAngle,
      inputAngularSpeed: crankAngularSpeed,
      inputPinWorld,
      lawPhase: rockerState.lawPhase,
      outputStage: rockerState.stage,
      reconstructedPinWorld,
      rockerAngle: rockerState.angle,
      rockerAngularAcceleration: rockerState.angularAcceleration,
      rockerAngularSpeed: rockerState.angularSpeed,
      sliderJointWorld,
      sliderVelocity,
      slotLocalPoint,
      slotPinClosureError: reconstructedPinWorld.distanceTo(inputPinWorld),
      strokeActive: /stroke/.test(rockerState.stage),
      topJointVelocity,
      topJointWorld,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    crank.rotation.z = state.inputAngle;
    rocker.rotation.z = state.rockerAngle;
    outputSlider.position.set(
      state.sliderJointWorld.x,
      state.sliderJointWorld.y,
      0.32,
    );
    connectingRod.userData.setEndpoints(
      new THREE.Vector3(state.topJointWorld.x, state.topJointWorld.y, 0.48),
      new THREE.Vector3(
        state.sliderJointWorld.x,
        state.sliderJointWorld.y,
        0.48,
      ),
    );
    root.userData.contacts = {
      crankPinToCurvedSlot: {
        active: true,
        drivingRocker: state.strokeActive,
        pinCenterWorld: state.inputPinWorld.clone(),
        reconstructedSlotPointWorld: state.reconstructedPinWorld.clone(),
        slotCenterlineError: state.slotPinClosureError,
      },
      outputRodToRocker: {
        active: true,
        joint: state.topJointWorld.clone(),
      },
      outputRodToSlider: {
        active: true,
        guideError: Math.abs(state.sliderJointWorld.y - guideY),
        joint: state.sliderJointWorld.clone(),
        lengthError: state.topJointWorld.distanceTo(
          state.sliderJointWorld,
        ) - connectingRodLength,
      },
    };
    root.userData.kinematics = state;
  };

  const rightDwellState = rockerLawAtPhase(0.10);
  const leftDwellState = rockerLawAtPhase(0.60);
  const rightSlider = (() => {
    const top = rockerPivot.clone().add(rotate2(
      topJointLocal,
      rightDwellState.angle,
    ));
    return top.x - Math.sqrt(
      connectingRodLength ** 2 - (guideY - top.y) ** 2,
    );
  })();
  const leftSlider = (() => {
    const top = rockerPivot.clone().add(rotate2(
      topJointLocal,
      leftDwellState.angle,
    ));
    return top.x - Math.sqrt(
      connectingRodLength ** 2 - (guideY - top.y) ** 2,
    );
  })();

  root.userData = {
    archetype:
      'constant-speed-crank-pin-in-synthesized-two-dwell-curved-slot-rocker-driving-finite-rod-shuttle',
    blocks: {
      base,
      connectingRod,
      crank,
      crankBoss,
      fixedFrame,
      guides,
      outputIndex,
      outputSlider,
      rocker,
      rockerBoss,
      shuttleBar,
      sliderJoint,
    },
    constraintResiduals: {
      crankRadiusAtReference:
        crankPinWorldAtPhase(0).distanceTo(crankCenter) - crankRadius,
      leftDwellAngle:
        leftDwellState.angle - rockerAmplitude,
      outputStrokeIdentity:
        rightSlider - leftSlider
          - 2 * topJointRadius * Math.sin(rockerAmplitude),
      rightDwellAngle:
        rightDwellState.angle + rockerAmplitude,
      slotCycleClosure:
        slotLocalAtDriverPhase(0).distanceTo(
          slotLocalAtDriverPhase(1),
        ),
    },
    constraints: {
      crank:
        'The input crank turns continuously at constant angular speed and carries one roller at a fixed radius.',
      output:
        'A finite connecting rod joins the rocker top pin to a carriage constrained to one horizontal guide line.',
      rocker:
        'The rocker has one fixed bottom pivot and one rotational coordinate with two exact constant-angle dwell intervals.',
      slot:
        'One rigid closed slot is the inverse-kinematic locus R(-theta(phi))*(pin(phi)-rockerPivot), so its transformed centerline contains the crank pin at every phase.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'rocker angle selected by slot profile',
        'finite-rod output carriage position',
      ],
      independentPrescribedInputs: 1,
      inputs: ['constant-speed crank angle'],
      note:
        'The positive grooved cam closes the chain; during each dwell the pin continues around the slot while rocker and output remain exactly stationary.',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid crank, roller, grooved rocker, rod, carriage, and frame',
        'positive centerline constraint with zero roller/slot clearance',
        'constant input angular speed',
        'quintic strokes with zero velocity and acceleration at dwell boundaries',
        'inertia, friction, impact, elastic deformation, and load omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless positive-cam kinematic synthesis',
    },
    fidelity: 'authored',
    geometry: {
      connectingRodLength,
      crankCenter: crankCenter.clone(),
      crankRadius,
      crankReferenceAngle,
      guideY,
      leftSlider,
      pinRadius,
      rightSlider,
      rockerAmplitude,
      rockerPivot: rockerPivot.clone(),
      slotSampleCount,
      sourcePoseLawPhase,
      topJointLocal: topJointLocal.clone(),
      topJointRadius,
    },
    mechanism:
      'one-constant-speed-crank-roller-runs-in-one-curved-positive-cam-slot-on-a-bottom-pivoted-rocker-whose-top-pin-and-finite-rod-drive-one-horizontally-guided-shuttle-through-alternating-strokes-and-dwells',
    motion: {
      cycleDuration,
      inputDirection: 'counterclockwise continuously',
      leftDwellFraction: leftDwellEnd - leftwardStrokeEnd,
      leftwardStrokeFraction: leftwardStrokeEnd - rightDwellEnd,
      outputStroke: rightSlider - leftSlider,
      rightDwellFraction: rightDwellEnd + 1 - rightwardStrokeEnd,
      rightwardStrokeFraction: rightwardStrokeEnd - leftDwellEnd,
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 397 page marks Animated unavailable and provides only Brown’s static engraving.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate397: {
        crankCenterApproximatePixels: [381, 242],
        crankPinApproximatePixels: [300, 195],
        crankRadiusApproximatePixels: 94,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 7,
        outputGuideApproximateYPixels: 81,
        rockerPivotApproximatePixels: [327, 407],
        rockerTopJointApproximatePixels: [327, 108],
      },
      constructionEvidence: {
        engravingEvidence:
          'The plate shows one fixed-axis crank and roller, one long curved slot in a bottom-pivoted rocker, a top joint, one finite horizontal link, and one guided rectilinear output bar.',
        explicitInBrownDescription: [
          'continuous circular input',
          'intermittent rectilinear reciprocating output',
          'used to drive sewing-machine shuttles',
          'also applied to three-revolution cylinder printing presses',
        ],
        reconstructionDisclosure:
          'Brown supplies no animation, dimensions, slot coordinates, dwell fractions, crank direction, or speed. The exact inverse-kinematic slot, two 30-percent dwells, two 20-percent quintic strokes, and all display timing are independently synthesized.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 397',
    },
    slotSynthesis: {
      curve: slotCurve,
      localPointAtDriverPhase: slotLocalAtDriverPhase,
      law:
        'q(phi)=R(-theta(phi))*(C+r*[cos(phi),sin(phi)]-O)',
      samples: slotSamples.map((point, index) => ({
        driverPhase: index / slotSampleCount,
        point: new THREE.Vector2(point.x, point.y),
      })),
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      lawPhaseIntervals: {
        leftDwell: [leftwardStrokeEnd, leftDwellEnd],
        leftwardStroke: [rightDwellEnd, leftwardStrokeEnd],
        rightDwell: [[0, rightDwellEnd], [rightwardStrokeEnd, 1]],
        rightwardStroke: [leftDwellEnd, rightwardStrokeEnd],
      },
      sourcePoseLawPhase,
    },
    transmission: {
      outputLaw:
        'x=s_top.x-sqrt(Lrod^2-(yguide-s_top.y)^2)',
      slotLaw:
        'worldPin=O+R(theta)*q; q is fixed in the slotted rocker',
      stageSequence:
        'right dwell -> leftward stroke -> left dwell -> rightward stroke -> right dwell',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.10, -2.62, -0.72),
    new THREE.Vector3(2.75, 2.34, 1.02),
  );
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraDirection = new THREE.Vector3(7.4, 5.4, 13.4);
  root.userData.groundFloorY = -2.48;
  update(0);
  return { root, update };
}

export function createAuthoredIntermittentShuttleDriveMovement(movement) {
  if (movement.id !== 397) return null;
  return intermittentShuttleDrive(movement);
}
