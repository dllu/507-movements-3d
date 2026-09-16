import { plate, poly, circle, capsule, polygonClipping as clip } from './finite-plate-geometry.js';
import { boredPlanarLinkGeometry } from './bored-planar-link.js';
import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const GAUSS_NODES = [
  -0.9602898564975363,
  -0.7966664774136267,
  -0.5255324099163290,
  -0.1834346424956498,
  0.1834346424956498,
  0.5255324099163290,
  0.7966664774136267,
  0.9602898564975363,
];
const GAUSS_WEIGHTS = [
  0.1012285362903763,
  0.2223810344533745,
  0.3137066458778873,
  0.3626837833783620,
  0.3626837833783620,
  0.3137066458778873,
  0.2223810344533745,
  0.1012285362903763,
];

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

function updateCylinderBetween(cylinder, start, end) {
  const delta = end.clone().sub(start);
  const length = delta.length();
  cylinder.position.copy(start).add(end).multiplyScalar(0.5);
  cylinder.quaternion.setFromUnitVectors(
    Y_AXIS,
    delta.clone().multiplyScalar(1 / length),
  );
  cylinder.scale.set(1, length, 1);
}

function makeDynamicRod(radius, material, role) {
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 1, 22),
    material,
  );
  rod.userData.role = role;
  rod.userData.setEndpoints = (start, end) => {
    updateCylinderBetween(rod, start, end);
  };
  return rod;
}

function makeTubeThrough(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, points.length * 3, radius, 10, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function gaussIntegrate(start, end, evaluate) {
  const midpoint = (start + end) / 2;
  const halfSpan = (end - start) / 2;
  let sum = 0;
  for (let index = 0; index < GAUSS_NODES.length; index += 1) {
    sum += GAUSS_WEIGHTS[index]
      * evaluate(midpoint + halfSpan * GAUSS_NODES[index]);
  }
  return halfSpan * sum;
}

function valveReliefGuide(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const valveAmplitude = 0.95;
  const valvePinY = -1.12;
  const rodLength = 3.50;
  const rollerFraction = 1 / 3;
  const rollerRadius = 0.22;
  const guideRailRadius = 0.075;
  const guideClearance = 0.018;
  const guideCenterlineOffset = rollerRadius
    + guideRailRadius + guideClearance;
  const upperPinGuideX = 0;
  const guideAdjustmentY = 0;

  const riseAtValveX = (valveX) => Math.sqrt(
    rodLength ** 2 - valveX ** 2,
  );
  const rollerCenterAtValveX = (valveX) => {
    const rise = riseAtValveX(valveX);
    return new THREE.Vector3(
      valveX * (1 - rollerFraction),
      valvePinY + rollerFraction * rise,
      0.48,
    );
  };
  const centerPathDerivativeAtValveX = (valveX) => {
    const rise = riseAtValveX(valveX);
    return new THREE.Vector3(
      1 - rollerFraction,
      -rollerFraction * valveX / rise,
      0,
    );
  };
  const centerPathUnitTangentAtValveX = (valveX) =>
    centerPathDerivativeAtValveX(valveX).normalize();
  const centerPathUnitNormalAtValveX = (valveX) => {
    const tangent = centerPathUnitTangentAtValveX(valveX);
    return new THREE.Vector3(-tangent.y, tangent.x, 0);
  };
  const guidePointsAtValveX = (valveX) => {
    const center = rollerCenterAtValveX(valveX);
    const normal = centerPathUnitNormalAtValveX(valveX);
    return {
      center,
      lower: center.clone().addScaledVector(
        normal,
        -guideCenterlineOffset,
      ),
      normal,
      tangent: centerPathUnitTangentAtValveX(valveX),
      upper: center.clone().addScaledVector(
        normal,
        guideCenterlineOffset,
      ),
    };
  };
  const centerPathSpeedPerValveX = (valveX) =>
    centerPathDerivativeAtValveX(valveX).length();
  const centerPathSpeedDerivative = (valveX) => {
    const rise = riseAtValveX(valveX);
    const verticalSlope = rollerFraction * valveX / rise;
    const verticalSlopeDerivative = rollerFraction * rodLength ** 2
      / rise ** 3;
    return verticalSlope * verticalSlopeDerivative
      / centerPathSpeedPerValveX(valveX);
  };
  const signedCenterPathLength = (valveX) => gaussIntegrate(
    0,
    valveX,
    centerPathSpeedPerValveX,
  );

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const valveX = valveAmplitude * Math.sin(inputAngle);
    const valveSpeed = valveAmplitude * inputSpeed * Math.cos(inputAngle);
    const valveAcceleration = valveAmplitude * (
      inputAcceleration * Math.cos(inputAngle)
      - inputSpeed ** 2 * Math.sin(inputAngle)
    );
    const rise = riseAtValveX(valveX);
    const upperPinY = valvePinY + rise;
    const upperPinSpeed = -valveX * valveSpeed / rise;
    const upperPinAcceleration = -(
      valveSpeed ** 2 + valveX * valveAcceleration
    ) / rise - valveX ** 2 * valveSpeed ** 2 / rise ** 3;
    const lowerPin = new THREE.Vector3(valveX, valvePinY, 0.48);
    const upperPin = new THREE.Vector3(
      upperPinGuideX,
      upperPinY,
      0.48,
    );
    const lowerPinVelocity = new THREE.Vector3(valveSpeed, 0, 0);
    const upperPinVelocity = new THREE.Vector3(0, upperPinSpeed, 0);
    const lowerPinAcceleration = new THREE.Vector3(
      valveAcceleration,
      0,
      0,
    );
    const upperPinAccelerationVector = new THREE.Vector3(
      0,
      upperPinAcceleration,
      0,
    );
    const rodVector = upperPin.clone().sub(lowerPin);
    const relativePinVelocity = upperPinVelocity.clone()
      .sub(lowerPinVelocity);
    const relativePinAcceleration = upperPinAccelerationVector.clone()
      .sub(lowerPinAcceleration);
    const rollerCenter = lowerPin.clone().lerp(upperPin, rollerFraction);
    const rollerCenterVelocity = lowerPinVelocity.clone().lerp(
      upperPinVelocity,
      rollerFraction,
    );
    const rollerCenterAcceleration = lowerPinAcceleration.clone().lerp(
      upperPinAccelerationVector,
      rollerFraction,
    );
    const guide = guidePointsAtValveX(valveX);
    const pathScale = centerPathSpeedPerValveX(valveX);
    const pathScaleDerivative = centerPathSpeedDerivative(valveX);
    const signedPathSpeed = pathScale * valveSpeed;
    const signedPathAcceleration = pathScale * valveAcceleration
      + pathScaleDerivative * valveSpeed ** 2;
    const rollerAngle = -signedCenterPathLength(valveX) / rollerRadius;
    const rollerAngularSpeed = -signedPathSpeed / rollerRadius;
    const rollerAngularAcceleration = -signedPathAcceleration
      / rollerRadius;
    return {
      guideCenterLocusResidual: rollerCenter.distanceTo(guide.center),
      guideLowerCenterline: guide.lower,
      guideNormal: guide.normal,
      guideTangent: guide.tangent,
      guideUpperCenterline: guide.upper,
      inputAcceleration,
      inputAngle,
      inputSpeed,
      lowerGuideSurfaceGap: rollerCenter.distanceTo(guide.lower)
        - guideRailRadius - rollerRadius,
      lowerPin,
      lowerPinAcceleration,
      lowerPinVelocity,
      relativePinAcceleration,
      relativePinVelocity,
      rodAccelerationConstraintResidual:
        relativePinVelocity.lengthSq()
          + rodVector.dot(relativePinAcceleration),
      rodLengthResidual: rodVector.length() - rodLength,
      rodVector,
      rodVelocityConstraintResidual: rodVector.dot(relativePinVelocity),
      rollerAngle,
      rollerAngularAcceleration,
      rollerAngularSpeed,
      rollerCenter,
      rollerCenterAcceleration,
      rollerCenterVelocity,
      rollerNoSlipResidual: rollerAngularSpeed * rollerRadius
        + signedPathSpeed,
      rollerPathLength: signedCenterPathLength(valveX),
      signedPathAcceleration,
      signedPathSpeed,
      upperGuideSurfaceGap: rollerCenter.distanceTo(guide.upper)
        - guideRailRadius - rollerRadius,
      upperPin,
      upperPinAcceleration,
      upperPinAccelerationVector,
      upperPinSpeed,
      upperPinVelocity,
      valveAcceleration,
      valveDirection: valveSpeed > 1e-10
        ? 'right'
        : valveSpeed < -1e-10
          ? 'left'
          : 'reversal',
      valveSpeed,
      valveX,
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

  const guideUpperPoints = [];
  const guideLowerPoints = [];
  const guideCenterPoints = [];
  for (let index = 0; index <= 180; index += 1) {
    const valveX = THREE.MathUtils.lerp(
      -valveAmplitude - 0.45,
      valveAmplitude + 0.45,
      index / 180,
    );
    const guide = guidePointsAtValveX(valveX);
    guideUpperPoints.push(guide.upper);
    guideLowerPoints.push(guide.lower);
    guideCenterPoints.push(guide.center);
  }
  const rollerPathHalfLength = signedCenterPathLength(valveAmplitude);
  const geometry = {
    cycleDuration,
    guideAdjustmentRange: [-0.26, 0.26],
    guideAdjustmentY,
    guideCenterlineOffset,
    guideClearance,
    guideRailRadius,
    inputAngularSpeed,
    rodLength,
    rollerFraction,
    rollerPathHalfLength,
    rollerRadius,
    upperPinGuideX,
    valveAmplitude,
    valvePinY,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.24,
    roughness: 0.55,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const rodMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.50,
  });
  const valveMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    roughness: 0.48,
  });
  const guideMaterial = matte(0x477b5c, {
    metalness: 0.17,
    roughness: 0.52,
  });
  const rollerMaterial = matte(PALETTE.accent, {
    metalness: 0.30,
    roughness: 0.42,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-valve-seat-and-suspended-guide-frame';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(5.30, 0.20, 1.55),
    frameMaterial,
  );
  base.position.set(0, -2.30, -0.34);
  base.userData.role = 'fixed-slide-valve-foundation';
  fixedFrame.add(base);
  const valveSeat = new THREE.Mesh(
    new THREE.BoxGeometry(4.75, 0.18, 1.26),
    darkMaterial,
  );
  valveSeat.position.set(0, -1.82, 0);
  valveSeat.userData.role = 'fixed-horizontal-valve-seat';
  fixedFrame.add(valveSeat);
  const steamPort = cylinderAlongZ(0.35, 0.30, darkMaterial, 40);
  steamPort.position.set(0, -1.90, 0);
  steamPort.userData.role = 'stationary-steam-port-below-valve-A';
  fixedFrame.add(steamPort);
  for (const side of [-1, 1]) {
    const lower = new THREE.Vector3(side * 1.46, -0.72, -0.38);
    const upper = new THREE.Vector3(side * 0.72, 2.72, -0.38);
    const post = beamBetween(lower, upper, 0.18, 0.26, frameMaterial);
    post.userData.role = 'fixed-tapered-guide-support-standard';
    fixedFrame.add(post);
  }
  const crown = new THREE.Mesh(
    new THREE.BoxGeometry(1.62, 0.18, 0.56),
    frameMaterial,
  );
  crown.position.set(0, 2.72, -0.38);
  crown.userData.role = 'fixed-guide-support-crown';
  fixedFrame.add(crown);
  root.add(fixedFrame);

  const guideAssemblyD = new THREE.Group();
  guideAssemblyD.position.y = guideAdjustmentY;
  guideAssemblyD.userData.role =
    'vertically-adjustable-suspended-two-arc-guide-D';
  guideAssemblyD.userData.adjustmentRange = geometry.guideAdjustmentRange;
  const upperArcD = makeTubeThrough(
    guideUpperPoints,
    guideRailRadius,
    guideMaterial,
    'upper-captured-coupler-locus-arc-D',
  );
  const lowerArcD = makeTubeThrough(
    guideLowerPoints,
    guideRailRadius,
    guideMaterial,
    'lower-load-bearing-coupler-locus-arc-D',
  );
  const guideEndBraces = [0, guideUpperPoints.length - 1].map(index => {
    const brace = beamBetween(guideLowerPoints[index], guideUpperPoints[index],
      0.08, 0.15, guideMaterial);
    brace.userData.role = 'end-web-joining-upper-and-lower-guide-D';
    return brace;
  });
  guideAssemblyD.add(upperArcD, lowerArcD, ...guideEndBraces);
  for (const side of [-1, 1]) {
    const endPoint = side < 0
      ? guideUpperPoints[0]
      : guideUpperPoints[guideUpperPoints.length - 1];
    const hanger = beamBetween(
      new THREE.Vector3(endPoint.x, endPoint.y, 0.46),
      new THREE.Vector3(side * 0.66, 2.45, 0.46),
      0.105,
      0.15,
      guideMaterial,
    );
    hanger.userData.role = 'suspended-vertical-adjustment-hanger-of-D';
    guideAssemblyD.add(hanger);
  }
  const adjustmentStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.74, 24),
    guideMaterial,
  );
  adjustmentStem.position.set(0, 2.63, 0.46);
  adjustmentStem.userData.role = 'vertical-adjustment-screw-for-arcs-D';
  guideAssemblyD.add(adjustmentStem);
  const adjustmentNut = cylinderAlongZ(0.17, 0.14, rollerMaterial, 6);
  adjustmentNut.position.set(0, 2.82, 0.46);
  adjustmentNut.userData.role = 'guide-D-height-adjustment-nut';
  guideAssemblyD.add(adjustmentNut);
  root.add(guideAssemblyD);

  const upperVerticalGuide = new THREE.Group();
  upperVerticalGuide.userData.role = 'fixed-vertical-slot-for-upper-B-pin';
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 1.06, 0.21),
      valveMaterial,
    );
    rail.position.set(side * 0.19, 2.20, 0.45);
    rail.userData.role = 'vertical-slot-side-for-upper-B-pin';
    upperVerticalGuide.add(rail);
  }
  root.add(upperVerticalGuide);

  const valveA = new THREE.Group();
  valveA.position.set(0, valvePinY, 0);
  valveA.userData.role = 'horizontally-sliding-valve-A';
  const valveBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.32, 0.42, 1.08),
    valveMaterial,
  );
  valveBody.position.y = -0.40;
  valveBody.userData.role = 'flat-slide-valve-A-body-on-seat';
  valveA.add(valveBody);
  const valveNeck = new THREE.Mesh(
    plate(clip.difference(clip.union(poly(circle([0, 0.12], 0.18, 64)),
      poly([[-0.28, -0.18], [0.28, -0.18], [0.28, 0.12], [-0.28, 0.12]])),
      poly(circle([0, 0.12], 0.09, 64))), -0.31, -0.02),
    valveMaterial,
  );
  valveNeck.position.y = -0.12;
  valveNeck.userData.role = 'valve-A-neck-to-rod-B-pin';
  valveA.add(valveNeck);
  const lowerPinMarker = cylinderAlongZ(0.08, 1.40, darkMaterial);
  lowerPinMarker.position.z = 0.35;
  lowerPinMarker.userData.role = 'lower-axle-joining-B-to-valve-A';
  valveA.add(lowerPinMarker);
  const valveIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.06, 1.12),
    whiteMaterial,
  );
  valveIndex.position.set(0, -0.25, 0.01);
  valveIndex.userData.role = 'white-valve-A-horizontal-position-index';
  valveA.add(valveIndex);
  root.add(valveA);

  const upperPinSlider = new THREE.Group();
  upperPinSlider.position.set(0, valvePinY + rodLength, 0.48);
  upperPinSlider.userData.role = 'upper-pin-of-B-sliding-only-vertically';
  const upperSliderBlock = new THREE.Mesh(
    plate(clip.difference(poly([[-0.15, -0.21], [0.15, -0.21],
      [0.15, 0.21], [-0.15, 0.21]]), poly(circle([0, 0], 0.09, 64))), -0.17, 0.17),
    valveMaterial,
  );
  upperSliderBlock.userData.role = 'upper-pin-vertical-slider-block';
  upperPinSlider.add(upperSliderBlock);
  const upperPinMarker = cylinderAlongZ(0.08, 1.10, darkMaterial);
  upperPinMarker.position.z = 0;
  upperPinMarker.userData.role = 'upper-axle-of-rod-B';
  upperPinSlider.add(upperPinMarker);
  root.add(upperPinSlider);

  const rodPlaneZ = 0.10;
  const rodOutline = clip.union(capsule([0, 0], [rodLength, 0], 0.10, 32),
    poly(circle([0, 0], 0.17, 64)), poly(circle([rodLength, 0], 0.17, 64)),
    poly(circle([rollerFraction * rodLength, 0], 0.27, 64)));
  const rodHoles = [0, rollerFraction * rodLength, rodLength]
    .map(x => poly(circle([x, 0], 0.09, 64)));
  const rodB = new THREE.Mesh(plate(clip.difference(rodOutline, ...rodHoles), -0.08, 0.08), rodMaterial);
  rodB.userData.role = 'constant-length-relieving-rod-B';
  rodB.userData.setEndpoints = (start, end) => {
    rodB.position.set(start.x, start.y, rodPlaneZ);
    rodB.rotation.z = Math.atan2(end.y - start.y, end.x - start.x);
  };
  const rollerAxle = cylinderAlongZ(0.08, 0.65, darkMaterial);
  rollerAxle.position.set(rollerFraction * rodLength, 0, 0.20);
  rodB.add(rollerAxle);
  root.add(rodB);
  const rollerC = new THREE.Group();
  rollerC.userData.role = 'roller-C-fixed-one-third-along-rod-B';
  const rollerBody = new THREE.Mesh(boredPlanarLinkGeometry({ length: 0, width: 0,
    eyeRadius: rollerRadius, boreRadius: 0.09, depth: 0.26 }), rollerMaterial);
  rollerBody.userData.role = 'roller-C-body-captured-between-arcs-D';
  rollerC.add(rollerBody);
  const rollerIndex = new THREE.Mesh(
    new THREE.BoxGeometry(rollerRadius * 1.45, 0.055, 0.055),
    whiteMaterial,
  );
  rollerIndex.position.set(rollerRadius * 0.25, 0, 0.19);
  rollerIndex.userData.role = 'white-roller-C-rotation-index';
  rollerC.add(rollerIndex);
  root.add(rollerC);

  const update = (time) => {
    const state = stateAtTime(time);
    valveA.position.x = state.valveX;
    upperPinSlider.position.y = state.upperPin.y;
    rodB.userData.setEndpoints(state.lowerPin, state.upperPin);
    rollerC.position.copy(state.rollerCenter);
    rollerC.rotation.z = state.rollerAngle;
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'orthogonal-pin-guided-slide-valve-rod-with-one-third-roller-in-vertically-adjustable-captured-coupler-locus-arcs',
    blocks: {
      adjustmentNut,
      adjustmentStem,
      fixedFrame,
      guideAssemblyD,
      guideEndBraces,
      lowerArcD,
      rodB,
      rollerC,
      rollerBody,
      rollerAxle,
      valveBody,
      valveNeck,
      upperSliderBlock,
      lowerPinMarker,
      upperPinMarker,
      upperArcD,
      upperPinSlider,
      upperVerticalGuide,
      valveA,
      valveSeat,
    },
    degreesOfFreedom: {
      guideHeightConfigurationSettings: 1,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      rodAngleIndependent: false,
      rollerCenterIndependent: false,
      upperPinHeightIndependent: false,
    },
    dynamics: {
      clearanceComplianceSteamPressureLoadsAndBearingFrictionModeled: false,
      loadPath:
        'the suspended lower arc reacts the representative downward load at roller C so rod B need not transmit that full normal load into valve A’s seat',
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Valve A is prescribed to slide horizontally on its fixed seat. Constant-length rod B joins A’s lower horizontal pin to an upper pin constrained in one vertical slot. Roller C is rigidly located one-third along B and follows the resulting exact shallow coupler-locus arc between the two vertically adjustable suspended guides D. The lower guide can carry the downward load at C, relieving normal load and sliding friction at A.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      valveStroke: valveAmplitude * 2,
    },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      officialCanvasCyclePeriod: 4,
      officialCanvasCyclesPerMinute: 15,
      officialCanvasModelPresent: true,
      reason:
        'The official Movement 418 page embeds a seven-part Canvas construction; it was inspected for topology, its 9.75-unit B rod, and C’s one-third placement. This 3D model is independently constructed and uses exact guide curves.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      rodAngle: Math.atan2(
        sourceState.rodVector.y,
        sourceState.rodVector.x,
      ),
      rollerCenter: sourceState.rollerCenter.clone(),
      valveX: sourceState.valveX,
    },
    sourceReference: {
      brownPlate418: {
        adjustableArcsDApproximateBoundsPixels: [149, 75, 386, 358],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 12,
        rodBApproximateBoundsPixels: [230, 92, 300, 399],
        rollerCApproximateCenterPixels: [259, 289],
        valveAApproximateBoundsPixels: [193, 384, 328, 457],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'A is a valve attached to the lower end of rod B',
          'A slides horizontally on its valve seat',
          'B’s upper pin slides in vertical slots',
          'roller C is attached to B',
          'C slides in two suspended arcs D',
          'D is vertically adjustable',
          'the purpose is to limit seat pressure and relieve valve friction',
        ],
        engravingEvidence:
          'Brown’s plate shows the valve and seat at the bottom, nearly vertical rod B, its upper pin captured in a straight vertical slot, roller C lower on B, and a two-sided suspended curved guide assembly D surrounding C.',
        officialCanvasEvidence:
          'The official page’s embedded model uses a 9.75-unit B rod, locates C at 3.25 units from its lower pin, constrains that pin horizontally and the upper pin vertically, and displays C between two close guide arcs. Its separate crank driver is not specified by Brown and is omitted here.',
        reconstructionDisclosure:
          'Brown gives no dimensions, guide-curve equation, roller diameter, adjustment range, pressure, loads, friction coefficient, input law, or timing. The 3.50 rod, one-third roller fraction corroborated by the official model, exact coupler-locus guide offsets, clearances, rail profiles, load-side rolling convention, frame, materials, and four-second display cycle are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 418',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      guideCenterLocus:
        'C=(1-fraction)*lowerPin+fraction*upperPin',
      lowerPinConstraint: 'lowerPin=(valveX,fixedY)',
      rodConstraint:
        'valveX^2+(upperPinY-valvePinY)^2=rodLength^2',
      rollerLoadedContact:
        'rollerAngularSpeed*rollerRadius+signedCenterPathSpeed=0 against the stationary lower guide',
      upperPinConstraint: 'upperPin=(fixedX,variableY)',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.78, -2.43, -1.18),
    new THREE.Vector3(2.78, 3.04, 1.18),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(1.2, 0.6, 12);
  root.userData.hideGround = true;
  root.userData.reconstruction = { rodPlaneZ,
    assumptions: 'The bored rod sits behind the roller guide; finite axles join the separated members. The existing prescribed input and illustrative roller-spin law do not solve steam loads or clearance take-up.' };
  root.traverse(object => { for (const material of [].concat(object.material ?? [])) material.fog = false; });
  root.userData.groundFloorY = -2.43;
  markShadows(root);
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredValveReliefGuideMovement(movement) {
  if (movement.id !== 418) return null;
  return valveReliefGuide(movement);
}
