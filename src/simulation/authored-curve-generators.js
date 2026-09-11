import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function wrapAngle(angle) {
  return THREE.MathUtils.euclideanModulo(angle + Math.PI, FULL_TURN)
    - Math.PI;
}

function cylinderAlongX(radius, length, material, segments = 28) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
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

function makeEyeRod({
  length,
  beamThickness,
  depth,
  eyeMajorRadius,
  eyeTubeRadius,
  material,
  bushingMaterial,
  z,
  role,
}) {
  const group = new THREE.Group();
  group.userData.role = role;
  group.userData.length = length;
  const eyeOuterRadius = eyeMajorRadius + eyeTubeRadius;
  const beamLength = length - 2 * eyeOuterRadius * 0.76;
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(beamLength, beamThickness, depth),
    material,
  );
  beam.position.set(length / 2, 0, z);
  beam.userData.role = `${role}-finite-center-web`;
  group.add(beam);

  const eyes = [];
  const bushings = [];
  for (const [index, station] of [0, length].entries()) {
    const eye = new THREE.Mesh(
      new THREE.TorusGeometry(
        eyeMajorRadius,
        eyeTubeRadius,
        10,
        36,
      ),
      material,
    );
    eye.position.set(station, 0, z);
    eye.userData.role = `${role}-${index === 0 ? 'crank' : 'wrist'}-eye`;
    const bushing = new THREE.Mesh(
      new THREE.TorusGeometry(
        eyeMajorRadius - eyeTubeRadius * 0.55,
        eyeTubeRadius * 0.24,
        8,
        32,
      ),
      bushingMaterial,
    );
    bushing.position.set(station, 0, z + depth * 0.53);
    bushing.userData.role = `${role}-${index === 0 ? 'crank' : 'wrist'}-bushing`;
    eyes.push(eye);
    bushings.push(bushing);
    group.add(eye, bushing);
  }
  group.userData.beam = beam;
  group.userData.eyes = eyes;
  group.userData.bushings = bushings;
  return markShadows(group);
}

function orientBeam(beam, start, end) {
  beam.userData.setEndpoints(start, end);
  return beam;
}

function makeDashedTrajectory(pointAtAngle, z, material) {
  const group = new THREE.Group();
  group.userData.role = 'fixed-analytic-egg-curve-witness';
  group.userData.closed = true;
  group.userData.dashed = true;
  const dashCount = 36;
  const subdivisions = 5;
  const dashFraction = 0.61;
  const segments = [];
  for (let dashIndex = 0; dashIndex < dashCount; dashIndex += 1) {
    const startAngle = FULL_TURN * dashIndex / dashCount;
    const endAngle = startAngle + FULL_TURN * dashFraction / dashCount;
    const points = Array.from(
      { length: subdivisions + 1 },
      (_, pointIndex) => {
        const angle = THREE.MathUtils.lerp(
          startAngle,
          endAngle,
          pointIndex / subdivisions,
        );
        const point = pointAtAngle(angle);
        return new THREE.Vector3(point.x, point.y, z);
      },
    );
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const segment = new THREE.Mesh(
      new THREE.TubeGeometry(curve, subdivisions * 2, 0.021, 7, false),
      material,
    );
    segment.userData.role = 'egg-curve-witness-dash';
    segment.castShadow = false;
    segment.receiveShadow = false;
    segments.push(segment);
    group.add(segment);
  }
  group.userData.segments = segments;
  return group;
}

function sliderCrankEggCurve() {
  const root = new THREE.Group();

  // The colored reference animation resolves Brown's undimensioned plate as
  // a 10-unit crank, a 40-unit connecting rod, and a tracing pin 15 units
  // from the crank pin.  Scaling those source dimensions by 0.1 preserves the
  // exact 1:4 and 3:8 ratios while keeping the model consistent with the rest
  // of the catalog.
  const sourceAnimationScale = 0.1;
  const sourceAnimationCrankRadius = 10;
  const sourceAnimationConnectingRodLength = 40;
  const sourceAnimationTracerOffset = 15;
  const crankRadius = sourceAnimationCrankRadius * sourceAnimationScale;
  const connectingRodLength = sourceAnimationConnectingRodLength
    * sourceAnimationScale;
  const tracerOffset = sourceAnimationTracerOffset * sourceAnimationScale;
  const tracerFraction = tracerOffset / connectingRodLength;
  const crankCenter = new THREE.Vector2(0, 0);
  const guideY = 0;
  const rightBranchMinimumReach = Math.sqrt(
    connectingRodLength ** 2 - crankRadius ** 2,
  );
  const cyclePeriod = 9.6;
  const cycleAngularSpeed = FULL_TURN / cyclePeriod;

  // This phase is measured from Brown's original plate: the crank points
  // down and left while the guided wrist remains on the horizontal datum.
  // The exact motion is independent of this presentation phase.
  const sourceInputAngle = -2.18;

  const stateAtInputAngle = (inputAngle) => {
    const resolvedAngle = wrapAngle(inputAngle);
    const cosine = Math.cos(resolvedAngle);
    const sine = Math.sin(resolvedAngle);
    const crankPin = new THREE.Vector2(
      crankCenter.x + crankRadius * cosine,
      crankCenter.y + crankRadius * sine,
    );
    const verticalDifference = guideY - crankPin.y;
    const horizontalReachSquared = connectingRodLength ** 2
      - verticalDifference ** 2;
    if (horizontalReachSquared <= 0) {
      throw new RangeError(
        'Movement 172 left the positive slider-crank assembly branch.',
      );
    }
    const horizontalReach = Math.sqrt(horizontalReachSquared);
    const sliderWrist = new THREE.Vector2(
      crankPin.x + horizontalReach,
      guideY,
    );
    const rodVector = sliderWrist.clone().sub(crankPin);
    const connectingRodAngle = Math.atan2(rodVector.y, rodVector.x);
    const tracerPoint = crankPin.clone().addScaledVector(
      rodVector,
      tracerFraction,
    );

    // Exact first and second derivatives with respect to input angle.  These
    // make the absence of a hidden branch jump or piecewise trace explicit.
    const reachDerivative = -(crankRadius ** 2) * sine * cosine
      / horizontalReach;
    const reachSecondDerivative = -(crankRadius ** 2)
      * (cosine ** 2 - sine ** 2) / horizontalReach
      - crankRadius ** 4 * sine ** 2 * cosine ** 2
        / horizontalReach ** 3;
    const sliderVelocityPerRadian = -crankRadius * sine
      + reachDerivative;
    const sliderAccelerationPerRadianSquared = -crankRadius * cosine
      + reachSecondDerivative;
    const crankVelocityPerRadian = new THREE.Vector2(
      -crankRadius * sine,
      crankRadius * cosine,
    );
    const crankAccelerationPerRadianSquared = new THREE.Vector2(
      -crankRadius * cosine,
      -crankRadius * sine,
    );
    const sliderVelocityVector = new THREE.Vector2(
      sliderVelocityPerRadian,
      0,
    );
    const sliderAccelerationVector = new THREE.Vector2(
      sliderAccelerationPerRadianSquared,
      0,
    );
    const tracerVelocityPerRadian = crankVelocityPerRadian.clone()
      .multiplyScalar(1 - tracerFraction)
      .addScaledVector(sliderVelocityVector, tracerFraction);
    const tracerAccelerationPerRadianSquared =
      crankAccelerationPerRadianSquared.clone()
        .multiplyScalar(1 - tracerFraction)
        .addScaledVector(sliderAccelerationVector, tracerFraction);
    const tracerSpeedPerRadian = tracerVelocityPerRadian.length();
    const tracerCurvature = Math.abs(
      tracerVelocityPerRadian.x
        * tracerAccelerationPerRadianSquared.y
      - tracerVelocityPerRadian.y
        * tracerAccelerationPerRadianSquared.x,
    ) / tracerSpeedPerRadian ** 3;
    const tracerFromCrank = tracerPoint.clone().sub(crankPin);
    const tracerToWrist = sliderWrist.clone().sub(tracerPoint);

    return {
      connectingRodAngle,
      connectingRodAngularVelocityPerRadian:
        -crankRadius * cosine / horizontalReach,
      crankAccelerationPerRadianSquared,
      crankCenter: crankCenter.clone(),
      crankPin,
      crankRadiusError: Math.abs(
        crankCenter.distanceTo(crankPin) - crankRadius
      ),
      crankVelocityPerRadian,
      horizontalReach,
      inputAngle: resolvedAngle,
      positiveBranchMargin: sliderWrist.x - crankPin.x,
      rodLengthError: Math.abs(rodVector.length() - connectingRodLength),
      sliderAccelerationPerRadianSquared,
      sliderGuideError: Math.abs(sliderWrist.y - guideY),
      sliderVelocityPerRadian,
      sliderWrist,
      tracerAccelerationPerRadianSquared,
      tracerCollinearityError: Math.abs(
        tracerFromCrank.x * rodVector.y
          - tracerFromCrank.y * rodVector.x
      ) / connectingRodLength,
      tracerCurvature,
      tracerFractionError: Math.abs(
        tracerFromCrank.dot(rodVector) / rodVector.lengthSq()
          - tracerFraction
      ),
      tracerOffsetError: Math.abs(
        tracerFromCrank.length() - tracerOffset
      ),
      tracerPoint,
      tracerRemainingLengthError: Math.abs(
        tracerToWrist.length()
          - (connectingRodLength - tracerOffset)
      ),
      tracerSpeedPerRadian,
      tracerVelocityPerRadian,
    };
  };

  const stateAtTime = (time) => ({
    ...stateAtInputAngle(sourceInputAngle - cycleAngularSpeed * time),
    inputAngularSpeed: -cycleAngularSpeed,
    time,
  });
  const trajectoryPointAtInputAngle = (angle) => (
    stateAtInputAngle(angle).tracerPoint
  );
  const modelPointFromSourceAnimation = (point) => new THREE.Vector2(
    crankCenter.x + point.x * sourceAnimationScale,
    crankCenter.y - point.y * sourceAnimationScale,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.68,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.18,
    roughness: 0.54,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.61,
  });
  const rodMaterial = matte(PALETTE.driven, {
    metalness: 0.11,
    roughness: 0.62,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.11,
    roughness: 0.56,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });
  const traceMaterial = matte(PALETTE.muted, {
    metalness: 0.02,
    roughness: 0.88,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-crank-bearing-and-horizontal-slider-frame';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(7.75, 0.20, 1.42),
    frameMaterial,
  );
  base.position.set(2.52, -1.46, -0.26);
  base.userData.role = 'fixed-wide-machine-base';
  fixedFrame.add(base);

  const rearFrameZ = -0.48;
  const leftBrace = orientBeam(
    makeBeam(
      new THREE.Vector3(),
      new THREE.Vector3(1, 0, 0),
      { thickness: 0.18, depth: 0.22, color: PALETTE.frame },
    ),
    new THREE.Vector3(-0.83, -1.37, rearFrameZ),
    new THREE.Vector3(-0.18, -0.23, rearFrameZ),
  );
  leftBrace.userData.role = 'fixed-left-crank-bearing-brace';
  const rightBrace = orientBeam(
    makeBeam(
      new THREE.Vector3(),
      new THREE.Vector3(1, 0, 0),
      { thickness: 0.18, depth: 0.22, color: PALETTE.frame },
    ),
    new THREE.Vector3(0.83, -1.37, rearFrameZ),
    new THREE.Vector3(0.18, -0.23, rearFrameZ),
  );
  rightBrace.userData.role = 'fixed-right-crank-bearing-brace';
  fixedFrame.add(leftBrace, rightBrace);

  const bearingCollars = [];
  for (const z of [-0.57, -0.26]) {
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.39, 0.095, 10, 40),
      frameMaterial,
    );
    collar.position.set(crankCenter.x, crankCenter.y, z);
    collar.userData.role = 'fixed-crankshaft-bearing-collar';
    bearingCollars.push(collar);
    fixedFrame.add(collar);
  }

  const guideStartX = 2.52;
  const guideEndX = 6.62;
  const guideLength = guideEndX - guideStartX;
  const guideRailOffset = 0.54;
  const guideRails = [];
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(guideLength, 0.13, 0.23),
      frameMaterial,
    );
    rail.position.set(
      (guideStartX + guideEndX) / 2,
      guideY + side * guideRailOffset,
      -0.20,
    );
    rail.userData.role = 'fixed-horizontal-crosshead-guide-rail';
    rail.userData.guideAxis = new THREE.Vector3(1, 0, 0);
    guideRails.push(rail);
    fixedFrame.add(rail);
  }
  const guideCenterline = new THREE.Mesh(
    new THREE.BoxGeometry(guideLength, 0.025, 0.035),
    traceMaterial,
  );
  guideCenterline.position.set(
    (guideStartX + guideEndX) / 2,
    guideY,
    -0.37,
  );
  guideCenterline.userData.role = 'fixed-slider-axis-witness';
  guideCenterline.castShadow = false;
  guideCenterline.receiveShadow = false;
  fixedFrame.add(guideCenterline);

  const guidePosts = [];
  for (const x of [guideStartX + 0.05, guideEndX - 0.05]) {
    for (const side of [-1, 1]) {
      const post = orientBeam(
        makeBeam(
          new THREE.Vector3(),
          new THREE.Vector3(1, 0, 0),
          { thickness: 0.14, depth: 0.18, color: PALETTE.frame },
        ),
        new THREE.Vector3(x, -1.36, -0.38),
        new THREE.Vector3(x, guideY + side * guideRailOffset, -0.38),
      );
      post.userData.role = 'fixed-slider-guide-support-post';
      guidePosts.push(post);
      fixedFrame.add(post);
    }
  }
  root.add(fixedFrame);

  const inputRotor = new THREE.Group();
  inputRotor.position.set(crankCenter.x, crankCenter.y, 0);
  inputRotor.userData.role = 'uniform-input-crank-rotor';
  inputRotor.userData.axis = Z_AXIS.clone();
  const crankDisk = cylinderAlongZ(0.47, 0.25, driverMaterial, 42);
  crankDisk.position.z = -0.02;
  crankDisk.userData.role = 'uniform-input-crank-disk';
  const crankRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.063, 9, 42),
    darkMaterial,
  );
  crankRim.position.z = 0.12;
  crankRim.userData.role = 'input-crank-disk-rim';
  const inputIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.075, 0.035),
    whiteMaterial,
  );
  inputIndex.position.set(0.30, 0, 0.145);
  inputIndex.userData.role = 'visible-input-crank-angle-index';
  const inputShaft = cylinderAlongZ(0.13, 1.54, darkMaterial, 28);
  inputShaft.position.z = -0.16;
  inputShaft.userData.role = 'single-uniform-input-shaft';
  inputRotor.add(crankDisk, crankRim, inputIndex, inputShaft);

  const rodLayerZ = 0.36;
  const crankArm = makeEyeRod({
    length: crankRadius,
    beamThickness: 0.22,
    depth: 0.18,
    eyeMajorRadius: 0.19,
    eyeTubeRadius: 0.075,
    material: driverMaterial,
    bushingMaterial: darkMaterial,
    z: rodLayerZ - 0.08,
    role: 'single-rigid-uniform-input-crank-arm',
  });
  const crankPin = cylinderAlongZ(0.105, 0.72, accentMaterial, 24);
  crankPin.position.set(crankRadius, 0, 0.25);
  crankPin.userData.role = 'revolute-crank-to-connecting-rod-pin';
  const crankPinAnchor = new THREE.Object3D();
  crankPinAnchor.position.set(crankRadius, 0, rodLayerZ);
  crankPinAnchor.userData.role = 'analytic-crank-pin-center-anchor';
  inputRotor.add(crankArm, crankPin, crankPinAnchor);
  root.add(inputRotor);

  const connectingRod = makeEyeRod({
    length: connectingRodLength,
    beamThickness: 0.18,
    depth: 0.20,
    eyeMajorRadius: 0.19,
    eyeTubeRadius: 0.078,
    material: rodMaterial,
    bushingMaterial: darkMaterial,
    z: rodLayerZ,
    role: 'single-finite-traced-connecting-rod',
  });
  connectingRod.userData.tracerStation = tracerOffset;
  connectingRod.userData.tracerFraction = tracerFraction;
  const rodWristAnchor = new THREE.Object3D();
  rodWristAnchor.position.set(connectingRodLength, 0, rodLayerZ);
  rodWristAnchor.userData.role = 'analytic-connecting-rod-wrist-anchor';
  connectingRod.add(rodWristAnchor);

  const tracerBoss = new THREE.Mesh(
    new THREE.TorusGeometry(0.105, 0.045, 9, 30),
    accentMaterial,
  );
  tracerBoss.position.set(tracerOffset, 0, rodLayerZ + 0.115);
  tracerBoss.userData.role = 'rod-fixed-egg-curve-tracer-boss';
  const tracePlaneZ = 0.66;
  const tracerStylusBaseZ = rodLayerZ + 0.08;
  const tracerStylusLength = tracePlaneZ - tracerStylusBaseZ;
  const tracerStylus = cylinderAlongZ(
    0.052,
    tracerStylusLength,
    accentMaterial,
    18,
  );
  tracerStylus.position.set(
    tracerOffset,
    0,
    (tracePlaneZ + tracerStylusBaseZ) / 2,
  );
  tracerStylus.userData.role = 'rod-fixed-egg-curve-tracer-stylus';
  const tracerTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 20, 14),
    whiteMaterial,
  );
  tracerTip.position.set(tracerOffset, 0, tracePlaneZ);
  tracerTip.userData.role = 'visible-egg-curve-tracing-point';
  const tracerTipAnchor = new THREE.Object3D();
  tracerTipAnchor.position.copy(tracerTip.position);
  tracerTipAnchor.userData.role = 'analytic-egg-curve-tracer-anchor';
  connectingRod.add(
    tracerBoss,
    tracerStylus,
    tracerTip,
    tracerTipAnchor,
  );
  root.add(connectingRod);

  const sliderAssembly = new THREE.Group();
  sliderAssembly.userData.role = 'single-horizontal-guided-crosshead';
  sliderAssembly.userData.guideAxis = new THREE.Vector3(1, 0, 0);
  const sliderBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.70, 0.72, 0.38),
    rodMaterial,
  );
  sliderBody.position.set(0.19, 0, -0.03);
  sliderBody.userData.role = 'guided-crosshead-body';
  const sliderWristEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.21, 0.085, 10, 36),
    rodMaterial,
  );
  sliderWristEye.position.set(0, 0, rodLayerZ);
  sliderWristEye.userData.role = 'crosshead-wrist-eye';
  const sliderWristPin = cylinderAlongZ(0.105, 0.78, darkMaterial, 24);
  sliderWristPin.position.set(0, 0, 0.21);
  sliderWristPin.userData.role = 'connecting-rod-to-crosshead-wrist-pin';
  const sliderWristAnchor = new THREE.Object3D();
  sliderWristAnchor.position.set(0, 0, rodLayerZ);
  sliderWristAnchor.userData.role = 'analytic-horizontal-slider-wrist-anchor';
  const sliderShoes = [];
  for (const side of [-1, 1]) {
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 0.14, 0.48),
      darkMaterial,
    );
    shoe.position.set(0.18, side * 0.45, -0.06);
    shoe.userData.role = 'crosshead-guide-shoe';
    sliderShoes.push(shoe);
    sliderAssembly.add(shoe);
  }
  const pistonRod = cylinderAlongX(0.095, 1.56, darkMaterial, 24);
  pistonRod.position.set(1.05, 0, -0.02);
  pistonRod.userData.role = 'crosshead-output-extension-rod';
  const pistonRodIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.20, 0.11),
    whiteMaterial,
  );
  pistonRodIndex.position.set(1.56, 0, 0.05);
  pistonRodIndex.userData.role = 'visible-crosshead-translation-index';
  sliderAssembly.add(
    sliderBody,
    sliderWristEye,
    sliderWristPin,
    sliderWristAnchor,
    pistonRod,
    pistonRodIndex,
  );
  root.add(sliderAssembly);

  const trajectoryWitness = makeDashedTrajectory(
    trajectoryPointAtInputAngle,
    tracePlaneZ - 0.012,
    traceMaterial,
  );
  const traceSamplePoints = Array.from({ length: 513 }, (_, index) => (
    trajectoryPointAtInputAngle(FULL_TURN * index / 512)
  ));
  trajectoryWitness.userData.points = traceSamplePoints;
  trajectoryWitness.userData.sampleCount = traceSamplePoints.length;
  root.add(trajectoryWitness);

  const canonicalStates = {
    leftDeadCenter: {
      ...stateAtInputAngle(Math.PI),
      stage: 'left-dead-center',
    },
    lowerQuadrature: {
      ...stateAtInputAngle(-Math.PI / 2),
      stage: 'lower-quadrature',
    },
    rightDeadCenter: {
      ...stateAtInputAngle(0),
      stage: 'right-dead-center',
    },
    sourceEngraving: {
      ...stateAtInputAngle(sourceInputAngle),
      stage: 'source-engraving-pose',
    },
    upperQuadrature: {
      ...stateAtInputAngle(Math.PI / 2),
      stage: 'upper-quadrature',
    },
  };

  const geometry = {
    connectingRodLength,
    crankCenter,
    crankRadius,
    cycleAngularSpeed,
    cyclePeriod,
    guideEndX,
    guideRailOffset,
    guideStartX,
    guideY,
    rightBranchMinimumReach,
    rodLayerZ,
    sliderStrokeMaximum: connectingRodLength + crankRadius,
    sliderStrokeMinimum: connectingRodLength - crankRadius,
    sourceAnimationConnectingRodLength,
    sourceAnimationCrankRadius,
    sourceAnimationScale,
    sourceAnimationTracerOffset,
    sourceInputAngle,
    traceHorizontalCenter: tracerOffset,
    traceHorizontalMaximum: crankRadius + tracerOffset,
    traceHorizontalMinimum: -crankRadius + tracerOffset,
    tracePlaneZ,
    traceVerticalMaximum: (1 - tracerFraction) * crankRadius,
    traceVerticalMinimum: -(1 - tracerFraction) * crankRadius,
    tracerFraction,
    tracerOffset,
    tracerStylusBaseZ,
  };

  root.userData.archetype =
    'uniform-slider-crank-intermediate-coupler-point-egg-curve';
  root.userData.cameraDistanceScale = 1.06;
  root.userData.blocks = {
    base,
    bearingCollars,
    connectingRod,
    crankArm,
    crankDisk,
    crankPin,
    crankPinAnchor,
    crankRim,
    fixedFrame,
    guideCenterline,
    guidePosts,
    guideRails,
    inputIndex,
    inputRotor,
    inputShaft,
    pistonRod,
    pistonRodIndex,
    rodWristAnchor,
    sliderAssembly,
    sliderBody,
    sliderShoes,
    sliderWristAnchor,
    sliderWristEye,
    sliderWristPin,
    tracerBoss,
    tracerStylus,
    tracerTip,
    tracerTipAnchor,
    trajectoryWitness,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.mechanism =
    'uniform-crank-finite-rod-horizontal-slider-intermediate-point-egg-curve';
  root.userData.modelPointFromSourceAnimation =
    modelPointFromSourceAnimation;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.traceSamplePoints = traceSamplePoints;
  root.userData.trajectoryPointAtInputAngle =
    trajectoryPointAtInputAngle;

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.inputAngle;
    connectingRod.position.set(
      state.crankPin.x,
      state.crankPin.y,
      0,
    );
    connectingRod.rotation.z = state.connectingRodAngle;
    sliderAssembly.position.set(
      state.sliderWrist.x,
      state.sliderWrist.y,
      0,
    );
    root.userData.kinematics = state;
  };
  update(0);

  markShadows(root);
  for (const object of [
    guideCenterline,
    trajectoryWitness,
    ...trajectoryWitness.userData.segments,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(6.8, 4.4, 11.5),
    root,
    update,
  };
}

export function createAuthoredCurveGeneratorMovement(movement) {
  if (movement.id !== 172) return null;
  return sliderCrankEggCurve();
}
