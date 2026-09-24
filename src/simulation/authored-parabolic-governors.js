import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeDynamicLink,
  markShadows,
  matte,
} from './primitives.js';

import { correctParabolicGovernor } from './governor-274-357-parts.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const GAUSS_NODES = [
  -0.9894009349916499,
  -0.9445750230732326,
  -0.8656312023878318,
  -0.755404408355003,
  -0.6178762444026438,
  -0.4580167776572274,
  -0.2816035507792589,
  -0.09501250983763744,
  0.09501250983763744,
  0.2816035507792589,
  0.4580167776572274,
  0.6178762444026438,
  0.755404408355003,
  0.8656312023878318,
  0.9445750230732326,
  0.9894009349916499,
];

const GAUSS_WEIGHTS = [
  0.027152459411754095,
  0.06225352393864789,
  0.09515851168249279,
  0.12462897125553388,
  0.14959598881657674,
  0.16915651939500254,
  0.1826034150449236,
  0.1894506104550685,
  0.1894506104550685,
  0.1826034150449236,
  0.16915651939500254,
  0.14959598881657674,
  0.12462897125553388,
  0.09515851168249279,
  0.06225352393864789,
  0.027152459411754095,
];

function cylinderAlongX(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongY(radius, length, material, segments = 36) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function torusAroundY(radius, tube, material, radialSegments = 40) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 10, radialSegments),
    material,
  );
  torus.rotation.x = Math.PI / 2;
  return torus;
}

function makeRoller({
  darkMaterial,
  rollerMaterial,
  rollerRadius,
  rollerWidth,
  role,
  whiteMaterial,
}) {
  const assembly = new THREE.Group();
  assembly.userData.axis = Z_AXIS.clone();
  assembly.userData.role = role;

  const rotor = new THREE.Group();
  rotor.userData.role = `${role}-rolling-rotor`;
  const wheel = cylinderAlongZ(
    rollerRadius,
    rollerWidth,
    rollerMaterial,
    48,
  );
  wheel.userData.role = `${role}-anti-friction-wheel-L`;
  rotor.add(wheel);

  const rims = [-1, 1].map((side) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(
        rollerRadius * 0.82,
        rollerRadius * 0.085,
        8,
        40,
      ),
      darkMaterial,
    );
    rim.position.z = side * (rollerWidth / 2 + 0.008);
    rim.userData.role = `${role}-face-rim`;
    rotor.add(rim);
    return rim;
  });
  const faceIndices = [-1, 1].map((side) => {
    const index = new THREE.Mesh(
      new THREE.BoxGeometry(
        rollerRadius * 1.28,
        rollerRadius * 0.18,
        0.025,
      ),
      whiteMaterial,
    );
    index.position.set(
      rollerRadius * 0.20,
      0,
      side * (rollerWidth / 2 + 0.024),
    );
    index.userData.role = `${role}-white-rolling-index`;
    rotor.add(index);
    return index;
  });

  const axle = cylinderAlongZ(
    rollerRadius * 0.29,
    rollerWidth * 1.55,
    darkMaterial,
    30,
  );
  axle.userData.role = `${role}-carriage-axle`;
  assembly.add(rotor, axle);
  assembly.userData.blocks = {
    axle,
    faceIndices,
    rims,
    rotor,
    wheel,
  };
  assembly.userData.rotor = rotor;
  return assembly;
}

function makeFlyball({
  ballRadius,
  ballMaterial,
  role,
  whiteMaterial,
}) {
  const group = new THREE.Group();
  group.userData.role = role;
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius, 42, 28),
    ballMaterial,
  );
  ball.userData.role = `${role}-ball-K`;
  const orbitIndex = new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius * 0.145, 22, 14),
    whiteMaterial,
  );
  orbitIndex.position.set(ballRadius * 0.93, 0, 0);
  orbitIndex.userData.role = `${role}-white-orbit-index`;
  group.add(ball, orbitIndex);
  group.userData.blocks = { ball, orbitIndex };
  return group;
}

function radialWorldState({
  angle,
  angularAcceleration,
  angularSpeed,
  radial,
  radialAcceleration,
  radialSpeed,
  vertical,
  verticalAcceleration,
  verticalSpeed,
}) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    acceleration: new THREE.Vector3(
      radialAcceleration * cosine
        - 2 * radialSpeed * sine * angularSpeed
        - radial * cosine * angularSpeed ** 2
        - radial * sine * angularAcceleration,
      verticalAcceleration,
      -radialAcceleration * sine
        - 2 * radialSpeed * cosine * angularSpeed
        + radial * sine * angularSpeed ** 2
        - radial * cosine * angularAcceleration,
    ),
    position: new THREE.Vector3(
      radial * cosine,
      vertical,
      -radial * sine,
    ),
    velocity: new THREE.Vector3(
      radialSpeed * cosine - radial * sine * angularSpeed,
      verticalSpeed,
      -radialSpeed * sine - radial * cosine * angularSpeed,
    ),
  };
}

function parabolicGovernor(movement) {
  const root = new THREE.Group();

  // Measurements use the 525 px public-domain plate. The right side is less
  // obscured by labels and supplies the idealized symmetric dimensions.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.015;
  const sourceRasterAxisX = 272;
  const sourceRasterTopGuidePin = new THREE.Vector2(368, 84);
  // Centre of wheel L's outer circle (pin at 303, 249); pass 51 took the
  // circle's top (306, 229) and so hung the balls 19 px too far below L.
  const sourceRasterRoller = new THREE.Vector2(303, 248);
  const sourceRasterBall = new THREE.Vector2(349, 329);
  const sourceRasterSleevePin = new THREE.Vector2(303, 429);
  const topGuidePinY = 3.8;

  // The working guide is a true quadratic Bezier segment, hence a parabola.
  // Its centerline is offset inward by the rail and roller radii to obtain
  // the exact anti-friction-wheel center path.
  const guideStart = new THREE.Vector2(1.44, topGuidePinY);
  // Control and end fitted (least squares) to nine points on Brown's thin
  // inner band edge from y=116 to y=240 px, with the wheel centre on the
  // plate's L at the source phase; the band runs on into the spindle block.
  const guideControl = new THREE.Vector2(2.3048, 3.0906);
  const guideEnd = new THREE.Vector2(0.2261, 0.5028);
  const guideRadius = 0.085;
  const rollerRadius = 0.235;
  const rollerWidth = 0.36;
  const guideToRollerCenter = guideRadius + rollerRadius;
  const minimumGuideParameter = 0.59;
  const maximumGuideParameter = 0.868;
  const meanGuideParameter = (
    minimumGuideParameter + maximumGuideParameter
  ) / 2;
  const guideParameterAmplitude = (
    maximumGuideParameter - minimumGuideParameter
  ) / 2;

  const sleevePinRadius = 0.48;
  const connectingRodLength = 2.7157;
  const flyballRadius = 0.62;
  const flyballRadialOffset = 0.691;
  const flyballVerticalOffset = -1.2156;
  const spindleRadius = 0.105;
  const spindleBottomY = -2.28;
  const spindleTopY = 4.38;
  const sleeveLength = 0.72;
  const sleeveRadius = 0.34;

  const cyclePeriod = 8;
  const cycleAngularFrequency = FULL_TURN / cyclePeriod;
  const spindleTurnsPerCycle = 2;
  const nominalSpindleAngularSpeed = spindleTurnsPerCycle * FULL_TURN
    / cyclePeriod;
  const spindleAngularSpeedAmplitude = 0.35;

  const guidePointAtParameter = (parameter) => {
    const oneMinus = 1 - parameter;
    return guideStart.clone().multiplyScalar(oneMinus ** 2)
      .addScaledVector(
        guideControl,
        2 * oneMinus * parameter,
      )
      .addScaledVector(guideEnd, parameter ** 2);
  };
  const guideDerivativeAtParameter = (parameter) => guideControl.clone()
    .sub(guideStart)
    .multiplyScalar(2 * (1 - parameter))
    .addScaledVector(
      guideEnd.clone().sub(guideControl),
      2 * parameter,
    );
  const guideSecondDerivative = guideEnd.clone()
    .add(guideStart)
    .addScaledVector(guideControl, -2)
    .multiplyScalar(2);

  const offsetCurveAtParameter = (parameter) => {
    const guideCenter = guidePointAtParameter(parameter);
    const guideDerivative = guideDerivativeAtParameter(parameter);
    const guideSpeed = guideDerivative.length();
    const guideSpeedDerivative = guideDerivative.dot(
      guideSecondDerivative,
    ) / guideSpeed;
    const guideSpeedSecondDerivative = guideSecondDerivative.lengthSq()
        / guideSpeed
      - guideDerivative.dot(guideSecondDerivative) ** 2
        / guideSpeed ** 3;
    const tangent = guideDerivative.clone().multiplyScalar(1 / guideSpeed);
    const tangentDerivative = guideSecondDerivative.clone()
      .multiplyScalar(1 / guideSpeed)
      .addScaledVector(
        guideDerivative,
        -guideSpeedDerivative / guideSpeed ** 2,
      );
    const tangentSecondDerivative = guideSecondDerivative.clone()
      .multiplyScalar(
        -2 * guideSpeedDerivative / guideSpeed ** 2,
      )
      .addScaledVector(
        guideDerivative,
        -guideSpeedSecondDerivative / guideSpeed ** 2
          + 2 * guideSpeedDerivative ** 2 / guideSpeed ** 3,
      );
    const inwardNormal = new THREE.Vector2(tangent.y, -tangent.x);
    const inwardNormalDerivative = new THREE.Vector2(
      tangentDerivative.y,
      -tangentDerivative.x,
    );
    const inwardNormalSecondDerivative = new THREE.Vector2(
      tangentSecondDerivative.y,
      -tangentSecondDerivative.x,
    );
    const rollerCenter = guideCenter.clone().addScaledVector(
      inwardNormal,
      guideToRollerCenter,
    );
    const rollerDerivative = guideDerivative.clone().addScaledVector(
      inwardNormalDerivative,
      guideToRollerCenter,
    );
    const rollerSecondDerivative = guideSecondDerivative.clone()
      .addScaledVector(
        inwardNormalSecondDerivative,
        guideToRollerCenter,
      );
    const contactPoint = guideCenter.clone().addScaledVector(
      inwardNormal,
      guideRadius,
    );
    return {
      contactPoint,
      guideCenter,
      guideDerivative,
      guideSpeed,
      guideSpeedDerivative,
      inwardNormal,
      inwardNormalDerivative,
      rollerCenter,
      rollerDerivative,
      rollerSecondDerivative,
      tangent,
      tangentDerivative,
    };
  };

  const rollerCenterArcLength = (startParameter, endParameter) => {
    if (startParameter === endParameter) return 0;
    const midpoint = (startParameter + endParameter) / 2;
    const halfWidth = (endParameter - startParameter) / 2;
    let integral = 0;
    for (let index = 0; index < GAUSS_NODES.length; index += 1) {
      const parameter = midpoint + halfWidth * GAUSS_NODES[index];
      integral += GAUSS_WEIGHTS[index]
        * offsetCurveAtParameter(parameter).rollerDerivative.length();
    }
    return halfWidth * integral;
  };

  const stateAtPhase = (phase) => {
    const cosine = Math.cos(phase);
    const sine = Math.sin(phase);
    const guideParameter = meanGuideParameter
      + guideParameterAmplitude * cosine;
    const guideParameterSpeed = -guideParameterAmplitude
      * cycleAngularFrequency * sine;
    const guideParameterAcceleration = -guideParameterAmplitude
      * cycleAngularFrequency ** 2 * cosine;
    const offset = offsetCurveAtParameter(guideParameter);
    const rollerCenterSpeed = offset.rollerDerivative.clone()
      .multiplyScalar(guideParameterSpeed);
    const rollerCenterAcceleration = offset.rollerSecondDerivative.clone()
      .multiplyScalar(guideParameterSpeed ** 2)
      .addScaledVector(
        offset.rollerDerivative,
        guideParameterAcceleration,
      );

    const horizontalRodOffset = offset.rollerCenter.x - sleevePinRadius;
    const verticalRodSpan = Math.sqrt(
      connectingRodLength ** 2 - horizontalRodOffset ** 2,
    );
    const sleeveY = offset.rollerCenter.y - verticalRodSpan;
    const horizontalRodOffsetPerParameter = offset.rollerDerivative.x;
    const horizontalRodOffsetSecondPerParameter =
      offset.rollerSecondDerivative.x;
    const sleeveYPerParameter = offset.rollerDerivative.y
      + horizontalRodOffset * horizontalRodOffsetPerParameter
        / verticalRodSpan;
    const sleeveYSecondPerParameter = offset.rollerSecondDerivative.y
      + (
        horizontalRodOffsetPerParameter ** 2
          + horizontalRodOffset * horizontalRodOffsetSecondPerParameter
      ) / verticalRodSpan
      + (
        horizontalRodOffset * horizontalRodOffsetPerParameter
      ) ** 2 / verticalRodSpan ** 3;
    const sleeveSpeed = sleeveYPerParameter * guideParameterSpeed;
    const sleeveAcceleration = sleeveYSecondPerParameter
        * guideParameterSpeed ** 2
      + sleeveYPerParameter * guideParameterAcceleration;

    const spindleAngularSpeed = nominalSpindleAngularSpeed
      - spindleAngularSpeedAmplitude * cosine;
    const spindleAngularAcceleration = spindleAngularSpeedAmplitude
      * cycleAngularFrequency * sine;
    const spindleAngle = nominalSpindleAngularSpeed
        * phase / cycleAngularFrequency
      - spindleAngularSpeedAmplitude / cycleAngularFrequency * sine;

    const rollerArcFromSource = rollerCenterArcLength(
      maximumGuideParameter,
      guideParameter,
    );
    const rollerSpinAngle = -rollerArcFromSource / rollerRadius;
    const centerSpeedPerParameter = offset.rollerDerivative.length();
    const rollerSpinAngularSpeed = -centerSpeedPerParameter
      * guideParameterSpeed / rollerRadius;
    const flyballCenter = offset.rollerCenter.clone().add(
      new THREE.Vector2(flyballRadialOffset, flyballVerticalOffset),
    );
    const lowerRodPin = new THREE.Vector2(sleevePinRadius, sleeveY);
    const connectingRodVector = offset.rollerCenter.clone()
      .sub(lowerRodPin);
    const connectingRodRelativeVelocity = rollerCenterSpeed.clone()
      .sub(new THREE.Vector2(0, sleeveSpeed));
    const connectingRodAngularSpeed = (
      connectingRodVector.x * connectingRodRelativeVelocity.y
        - connectingRodVector.y * connectingRodRelativeVelocity.x
    ) / connectingRodLength ** 2;
    const rollerSurfaceGap = offset.rollerCenter.distanceTo(
      offset.guideCenter,
    ) - guideRadius - rollerRadius;
    const contactTangencyError = offset.tangent.dot(
      offset.rollerCenter.clone().sub(offset.guideCenter),
    );
    const noSlipVelocityError = offset.rollerDerivative.dot(
      offset.tangent,
    ) * guideParameterSpeed
      + rollerRadius * rollerSpinAngularSpeed;

    const radialStateFor = ({
      radial,
      radialAcceleration,
      radialSpeed,
      vertical,
      verticalAcceleration,
      verticalSpeed,
    }, sideIndex) => radialWorldState({
      angle: spindleAngle + sideIndex * Math.PI,
      angularAcceleration: spindleAngularAcceleration,
      angularSpeed: spindleAngularSpeed,
      radial,
      radialAcceleration,
      radialSpeed,
      vertical,
      verticalAcceleration,
      verticalSpeed,
    });
    const localMovingStates = {
      ball: {
        radial: flyballCenter.x,
        radialAcceleration: rollerCenterAcceleration.x,
        radialSpeed: rollerCenterSpeed.x,
        vertical: flyballCenter.y,
        verticalAcceleration: rollerCenterAcceleration.y,
        verticalSpeed: rollerCenterSpeed.y,
      },
      lowerRodPin: {
        radial: sleevePinRadius,
        radialAcceleration: 0,
        radialSpeed: 0,
        vertical: sleeveY,
        verticalAcceleration: sleeveAcceleration,
        verticalSpeed: sleeveSpeed,
      },
      roller: {
        radial: offset.rollerCenter.x,
        radialAcceleration: rollerCenterAcceleration.x,
        radialSpeed: rollerCenterSpeed.x,
        vertical: offset.rollerCenter.y,
        verticalAcceleration: rollerCenterAcceleration.y,
        verticalSpeed: rollerCenterSpeed.y,
      },
    };
    const sides = [0, 1].map((sideIndex) => ({
      azimuth: spindleAngle + sideIndex * Math.PI,
      ball: radialStateFor(localMovingStates.ball, sideIndex),
      lowerRodPin: radialStateFor(
        localMovingStates.lowerRodPin,
        sideIndex,
      ),
      roller: radialStateFor(localMovingStates.roller, sideIndex),
      sideIndex,
    }));

    let stage;
    if (Math.abs(guideParameterSpeed) < 1e-10) {
      stage = guideParameter > meanGuideParameter
        ? 'low-speed-balls-down-and-in-sleeve-down-reversal'
        : 'high-speed-balls-up-and-out-sleeve-up-reversal';
    } else {
      stage = guideParameterSpeed < 0
        ? 'speed-increasing-balls-climbing-outward-sleeve-rising'
        : 'speed-decreasing-balls-descending-inward-sleeve-falling';
    }

    return {
      ballRiseFraction: (
        maximumGuideParameter - guideParameter
      ) / (
        maximumGuideParameter - minimumGuideParameter
      ),
      connectingRodAngularSpeed,
      connectingRodLength: connectingRodVector.length(),
      connectingRodLengthError: connectingRodVector.length()
        - connectingRodLength,
      connectingRodVector,
      contactTangencyError,
      cyclePhase: THREE.MathUtils.euclideanModulo(phase, FULL_TURN)
        / FULL_TURN,
      flyballCenter,
      guideParameter,
      guideParameterAcceleration,
      guideParameterSpeed,
      horizontalRodOffset,
      lowerRodPin,
      noSlipVelocityError,
      offset,
      phase,
      rollerCenterAcceleration,
      rollerCenterArcFromSource: rollerArcFromSource,
      rollerCenterSpeed,
      rollerSpinAngle,
      rollerSpinAngularSpeed,
      rollerSurfaceGap,
      sides,
      sleeveAcceleration,
      sleeveSpeed,
      sleeveY,
      spindleAngle,
      spindleAngularAcceleration,
      spindleAngularSpeed,
      stage,
      verticalRodSpan,
    };
  };
  const stateAtTime = (time) => stateAtPhase(
    cycleAngularFrequency * time,
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.61,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.48,
  });
  const rollerMaterial = matte(PALETTE.brass, {
    metalness: 0.2,
    roughness: 0.53,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const governorRotor = new THREE.Group();
  governorRotor.userData.axis = Y_AXIS.clone();
  governorRotor.userData.role =
    'complete-parabolic-governor-rotating-with-spindle-C-D';
  root.add(governorRotor);

  const spindle = cylinderAlongY(
    spindleRadius,
    spindleTopY - spindleBottomY,
    darkMaterial,
    40,
  );
  spindle.position.y = (spindleTopY + spindleBottomY) / 2;
  spindle.userData.role = 'continuous-vertical-spindle-C-D';
  const spindleIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.72, 0.035),
    whiteMaterial,
  );
  spindleIndex.position.set(
    spindleRadius + 0.024,
    3.11,
    0,
  );
  spindleIndex.userData.role = 'white-spindle-rotation-index';
  governorRotor.add(spindle, spindleIndex);

  const topHead = cylinderAlongY(0.24, 0.34, driverMaterial, 40);
  topHead.position.y = 4.1;
  topHead.userData.role = 'fixed-to-spindle-top-governor-head';
  const topCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 26, 18),
    driverMaterial,
  );
  topCap.position.y = 4.42;
  topCap.userData.role = 'top-spindle-finial-C';
  governorRotor.add(topHead, topCap);

  const shoulderCurves = [0, 1].map((sideIndex) => {
    const sign = sideIndex === 0 ? 1 : -1;
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(sign * 0.12, 4.12, 0),
      new THREE.Vector3(sign * 0.75, 4.17, 0),
      new THREE.Vector3(sign * guideStart.x, guideStart.y, 0),
    );
    const shoulder = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 34, 0.095, 12, false),
      driverMaterial,
    );
    shoulder.userData.role =
      `fixed-spindle-head-to-parabolic-guide-${sideIndex + 1}`;
    governorRotor.add(shoulder);
    return shoulder;
  });

  const sideAssemblies = [0, 1].map((sideIndex) => {
    const side = new THREE.Group();
    side.rotation.y = sideIndex * Math.PI;
    side.userData.azimuthOffset = sideIndex * Math.PI;
    side.userData.role = `parabolic-governor-side-${sideIndex + 1}`;
    governorRotor.add(side);

    const guideCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(guideStart.x, guideStart.y, 0),
      new THREE.Vector3(guideControl.x, guideControl.y, 0),
      new THREE.Vector3(guideEnd.x, guideEnd.y, 0),
    );
    const guide = new THREE.Mesh(
      new THREE.TubeGeometry(guideCurve, 72, guideRadius, 14, false),
      driverMaterial,
    );
    guide.userData.curve = guideCurve;
    guide.userData.isFixedInGovernorRotor = true;
    guide.userData.role =
      `stationary-in-rotor-parabolic-guide-arm-B-${sideIndex + 1}`;
    side.add(guide);

    const guidePin = new THREE.Group();
    guidePin.position.set(guideStart.x, guideStart.y, 0);
    guidePin.userData.axis = Z_AXIS.clone();
    guidePin.userData.role =
      `top-fastening-pin-for-parabolic-guide-${sideIndex + 1}`;
    const guidePinAxle = cylinderAlongZ(0.115, 0.4, darkMaterial, 32);
    const guidePinRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.145, 0.035, 9, 36),
      driverMaterial,
    );
    guidePinRing.position.z = 0.215;
    guidePin.add(guidePinAxle, guidePinRing);
    side.add(guidePin);

    const roller = makeRoller({
      darkMaterial,
      rollerMaterial,
      rollerRadius,
      rollerWidth,
      role: `moving-anti-friction-roller-L-${sideIndex + 1}`,
      whiteMaterial,
    });
    side.add(roller);

    const flyball = makeFlyball({
      ballMaterial: driverMaterial,
      ballRadius: flyballRadius,
      role: `centrifugal-flyball-carriage-K-${sideIndex + 1}`,
      whiteMaterial,
    });
    side.add(flyball);

    const carrierLinks = [-0.13, 0.13].map((planeZ, linkIndex) => {
      const link = makeDynamicLink({
        color: PALETTE.driver,
        depth: 0.075,
        jointRadius: 0.065,
        thickness: 0.085,
      });
      link.userData.planeZ = planeZ;
      link.userData.role =
        `rigid-roller-to-flyball-carrier-${sideIndex + 1}-${linkIndex + 1}`;
      side.add(link);
      return link;
    });

    const connectingRod = makeDynamicLink({
      color: PALETTE.driven,
      depth: 0.105,
      jointRadius: 0.095,
      thickness: 0.085,
    });
    connectingRod.userData.nominalLength = connectingRodLength;
    connectingRod.userData.role =
      `constant-length-connecting-rod-F-${sideIndex + 1}`;
    side.add(connectingRod);

    return {
      carrierLinks,
      connectingRod,
      flyball,
      guide,
      guidePin,
      roller,
      side,
    };
  });

  const sleeveAssembly = new THREE.Group();
  sleeveAssembly.userData.axis = Y_AXIS.clone();
  sleeveAssembly.userData.role =
    'axially-sliding-sleeve-driven-by-both-rods-F';
  governorRotor.add(sleeveAssembly);
  const sleeve = cylinderAlongY(
    sleeveRadius,
    sleeveLength,
    drivenMaterial,
    42,
  );
  sleeve.userData.role = 'sliding-sleeve-on-spindle-C-D';
  const sleeveCrossPin = cylinderAlongX(
    0.085,
    sleevePinRadius * 2,
    drivenMaterial,
    30,
  );
  sleeveCrossPin.userData.role = 'sleeve-cross-pin-joining-both-rods-F';
  const sleeveUpperRing = torusAroundY(
    sleeveRadius * 1.04,
    0.045,
    darkMaterial,
  );
  sleeveUpperRing.position.y = sleeveLength / 2;
  sleeveUpperRing.userData.role = 'sleeve-upper-retaining-ring';
  const sleeveLowerRing = torusAroundY(
    sleeveRadius * 1.11,
    0.055,
    darkMaterial,
  );
  sleeveLowerRing.position.y = -sleeveLength / 2;
  sleeveLowerRing.userData.role = 'sleeve-output-groove-ring';
  const sleeveIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, sleeveLength * 0.38, 0.035),
    whiteMaterial,
  );
  sleeveIndex.position.set(sleeveRadius + 0.025, 0.05, 0);
  sleeveIndex.userData.role = 'white-sleeve-translation-and-rotation-index';
  sleeveAssembly.add(
    sleeve,
    sleeveCrossPin,
    sleeveIndex,
    sleeveLowerRing,
    sleeveUpperRing,
  );

  const lowerBearing = new THREE.Group();
  lowerBearing.position.y = -2.02;
  lowerBearing.userData.role = 'fixed-lower-bearing-for-spindle-D';
  const bearingCollar = cylinderAlongY(0.25, 0.28, frameMaterial, 40);
  const bearingRing = torusAroundY(0.28, 0.055, frameMaterial);
  const bearingPost = makeBeam(
    new THREE.Vector3(0, -0.08, -0.15),
    new THREE.Vector3(0, -0.08, -1.05),
    { color: PALETTE.frame, depth: 0.17, thickness: 0.14 },
  );
  lowerBearing.add(bearingCollar, bearingPost, bearingRing);
  root.add(lowerBearing);
  const base = makeBeam(
    new THREE.Vector3(-2.65, -2.46, -1.05),
    new THREE.Vector3(2.65, -2.46, -1.05),
    { color: PALETTE.frame, depth: 0.28, thickness: 0.2 },
  );
  base.userData.role = 'fixed-governor-display-base';
  const baseStem = makeBeam(
    new THREE.Vector3(0, -2.46, -1.05),
    new THREE.Vector3(0, -2.10, -1.05),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.18 },
  );
  baseStem.userData.role = 'fixed-base-to-lower-bearing-stem';
  root.add(base, baseStem);

  const sourcePointToModel = ({ x, y }, radialSign = 1) =>
    new THREE.Vector2(
      radialSign * (x - sourceRasterAxisX) * sourceScale,
      topGuidePinY
        - (y - sourceRasterTopGuidePin.y) * sourceScale,
    );
  const sourceState = stateAtPhase(0);
  const sourceIdealizationPixelErrors = {
    ball: sourceState.flyballCenter.distanceTo(
      sourcePointToModel(sourceRasterBall),
    ) / sourceScale,
    roller: sourceState.offset.rollerCenter.distanceTo(
      sourcePointToModel(sourceRasterRoller),
    ) / sourceScale,
    sleevePin: sourceState.lowerRodPin.distanceTo(
      sourcePointToModel(sourceRasterSleevePin),
    ) / sourceScale,
    topGuidePin: guideStart.distanceTo(
      sourcePointToModel(sourceRasterTopGuidePin),
    ) / sourceScale,
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    base,
    baseStem,
    lowerBearing,
    governorRotor,
    shoulderCurves,
    sideAssemblies,
    sleeveAssembly,
    spindle,
    spindleIndex,
    topCap,
    topHead,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.35, -2.68, -3.35),
    new THREE.Vector3(3.35, 4.72, 3.35),
  );
  root.userData.geometry = {
    connectingRodLength,
    cyclePeriod,
    flyballRadialOffset,
    flyballRadius,
    flyballVerticalOffset,
    guideControl: guideControl.clone(),
    guideEnd: guideEnd.clone(),
    guideParameterAmplitude,
    guideRadius,
    guideStart: guideStart.clone(),
    guideToRollerCenter,
    maximumGuideParameter,
    meanGuideParameter,
    minimumGuideParameter,
    rollerRadius,
    rollerWidth,
    sleeveLength,
    sleevePinRadius,
    sleeveRadius,
    sourceScale,
    spindleBottomY,
    spindleRadius,
    spindleTopY,
  };
  root.userData.mechanism =
    'two diametrically-opposed flyball-and-roller carriages climb fixed parabolic guide arms B in the rotating spindle head; each anti-friction wheel L stays tangent to its guide while its constant-length rod F raises the common sliding sleeve on spindle C-D; increased spindle speed sends both balls K upward and outward';
  root.userData.movement = movement;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason:
      'The official Movement 274 page marks its animation control unavailable; the guide-contact, roller rolling, constant-length connecting rods, sleeve travel, and a smooth speed excursion were reconstructed independently from the public-domain engraving and description.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate274: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'two fixed-in-rotor parabolic guide arms B, two roller-and-flyball carriages, two constant-length rods F, and one common sleeve sliding on spindle C-D',
      measurementUncertaintyPixels: 5,
      officialAnimationAvailable: false,
      rasterAxisX: sourceRasterAxisX,
      rasterBallCenters: {
        left: { x: 193, y: 331 },
        right: { x: sourceRasterBall.x, y: sourceRasterBall.y },
      },
      rasterRollerCenters: {
        left: { x: 237, y: 248 },
        right: { x: sourceRasterRoller.x, y: sourceRasterRoller.y },
      },
      rasterSleevePinCenters: {
        left: { x: 237, y: 430 },
        right: {
          x: sourceRasterSleevePin.x,
          y: sourceRasterSleevePin.y,
        },
      },
      rasterTopGuidePins: {
        left: { x: 180, y: 85 },
        right: {
          x: sourceRasterTopGuidePin.x,
          y: sourceRasterTopGuidePin.y,
        },
      },
      sourceIdealizationPixelErrors,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 69,
      edition: 21,
      illustrationPage: 68,
      publicationYear: 1908,
    },
    secondaryScan: {
      archiveIdentifier: 'mechanicalmoveme021hisc',
      description:
        'Hiscox figure 302 identifies the device as a parabolic or isochronous governor and says the guide form equalizes grooved-slide motion.',
      figure: 302,
      publicationYear: 1914,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtGuideParameter = (parameter) => {
    const cosine = THREE.MathUtils.clamp(
      (parameter - meanGuideParameter) / guideParameterAmplitude,
      -1,
      1,
    );
    return stateAtPhase(Math.acos(cosine));
  };
  root.userData.stateAtPhase = stateAtPhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cycleAngularFrequency,
    cyclePeriod,
    sourcePhase: 0,
    spindleTurnsPerCycle,
  };
  root.userData.transmission = {
    constraintLaw:
      'rollerCenter = quadraticBezier(guideParameter) + (guideRadius + rollerRadius) * inwardUnitNormal; sleeveY = rollerY - sqrt(connectingRodLength^2 - (rollerRadiusFromAxis - sleevePinRadius)^2)',
    cyclePeriod,
    guideProfile: 'quadratic Bezier parabolic segment',
    nominalSpindleAngularSpeed,
    rollerContact: 'exact external tangency to fixed parabolic guide tube',
    rollerRollingLaw:
      'rollerSpin = -signedOffsetCurveArcLength / rollerRadius',
    spindleAngularSpeedAmplitude,
    stateAtPhase,
    stateAtTime,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    governorRotor.rotation.y = state.spindleAngle;
    governorRotor.userData.angularAcceleration =
      state.spindleAngularAcceleration;
    governorRotor.userData.angularSpeed = state.spindleAngularSpeed;
    sleeveAssembly.position.y = state.sleeveY;
    sleeveAssembly.userData.axialAcceleration = state.sleeveAcceleration;
    sleeveAssembly.userData.axialSpeed = state.sleeveSpeed;

    sideAssemblies.forEach((assembly) => {
      const rollerPoint = new THREE.Vector3(
        state.offset.rollerCenter.x,
        state.offset.rollerCenter.y,
        0,
      );
      const ballPoint = new THREE.Vector3(
        state.flyballCenter.x,
        state.flyballCenter.y,
        0,
      );
      const lowerPinPoint = new THREE.Vector3(
        state.lowerRodPin.x,
        state.lowerRodPin.y,
        0,
      );
      assembly.roller.position.copy(rollerPoint);
      assembly.roller.userData.rotor.rotation.z = state.rollerSpinAngle;
      assembly.roller.userData.angularSpeed =
        state.rollerSpinAngularSpeed;
      assembly.flyball.position.copy(ballPoint);
      assembly.carrierLinks.forEach((link) => {
        const start = rollerPoint.clone().setZ(link.userData.planeZ);
        const end = ballPoint.clone().setZ(link.userData.planeZ);
        link.userData.setEndpoints(start, end);
      });
      assembly.connectingRod.userData.setEndpoints(
        lowerPinPoint,
        rollerPoint,
      );
      assembly.connectingRod.userData.angularSpeed =
        state.connectingRodAngularSpeed;
    });

    root.userData.contacts = {
      parabolicGuides: sideAssemblies.map((assembly, sideIndex) => ({
        contactPointInSidePlane: state.offset.contactPoint.clone(),
        guide: assembly.guide,
        normal: state.offset.inwardNormal.clone(),
        roller: assembly.roller,
        sideIndex,
        surfaceGap: state.rollerSurfaceGap,
        tangencyError: state.contactTangencyError,
      })),
      rods: sideAssemblies.map((assembly, sideIndex) => ({
        length: state.connectingRodLength,
        lengthError: state.connectingRodLengthError,
        rod: assembly.connectingRod,
        sideIndex,
      })),
    };
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  correctParabolicGovernor(root);
  shapeLyreGuidesToPlate(root);
  update(0);
  return {
    root,
    update,
    cameraDirection: root.userData.cameraDirection,
  };
}

// Brown draws each guide B as a broad lyre band: it curls over its top pin
// and bulges outward; its inner edge is the working parabola the wheel L
// rolls on, and both guides end in a block on the spindle below L. The white
// phase indices and the lower bearing's rear post are not drawn and are
// removed.
function shapeLyreGuidesToPlate(root) {
  const blocks = root.userData.blocks;
  const geometry = root.userData.geometry;
  const material = blocks.sideAssemblies[0].guide.material;
  const guidePoint = (t) => new THREE.Vector2(
    (1 - t) ** 2 * geometry.guideStart.x + 2 * t * (1 - t) * geometry.guideControl.x
      + t * t * geometry.guideEnd.x,
    (1 - t) ** 2 * geometry.guideStart.y + 2 * t * (1 - t) * geometry.guideControl.y
      + t * t * geometry.guideEnd.y,
  );
  // Outer band edge measured on the right half of the 525 px plate; low down
  // it turns in towards the spindle block early enough to clear the raised
  // ball, where Brown's resting pose leaves it hugging the ball's top.
  const outer = new THREE.SplineCurve([
    new THREE.Vector2(1.47, 3.9),
    new THREE.Vector2(1.63, 3.97),
    new THREE.Vector2(1.81, 3.94),
    new THREE.Vector2(1.94, 3.8),
    new THREE.Vector2(2.0, 3.56),
    new THREE.Vector2(2.01, 3.26),
    new THREE.Vector2(1.95, 2.81),
    new THREE.Vector2(1.815, 2.36),
    new THREE.Vector2(1.66, 2.02),
    new THREE.Vector2(1.43, 1.745),
    new THREE.Vector2(1.215, 1.48),
    new THREE.Vector2(1.0, 1.2),
    new THREE.Vector2(0.72, 0.98),
    new THREE.Vector2(0.44, 0.83),
    new THREE.Vector2(0.3, 0.8),
  ]).getPoints(72);
  const innerEdge = Array.from({ length: 61 }, (_, i) => guidePoint(1 - i / 60));
  const shape = new THREE.Shape([...outer, ...innerEdge]);
  const depth = 0.11;
  const bandGeometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth,
  });
  bandGeometry.translate(0, 0, -depth / 2);
  blocks.shoulderCurves.forEach((shoulder, sideIndex) => {
    const sign = sideIndex === 0 ? 1 : -1;
    const shoulderCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sign * 0.1, 4.24, 0),
      new THREE.Vector3(sign * 0.62, 4.2, 0),
      new THREE.Vector3(sign * 1.05, 3.92, 0),
      new THREE.Vector3(sign * geometry.guideStart.x, geometry.guideStart.y, 0),
    ]);
    shoulder.geometry.dispose();
    shoulder.geometry = new THREE.TubeGeometry(shoulderCurve, 40, 0.095, 12, false);
  });
  blocks.sideAssemblies.forEach((assembly, sideIndex) => {
    const band = new THREE.Mesh(bandGeometry, material);
    band.userData.role = `outer-lyre-band-of-guide-arm-B-${sideIndex + 1}`;
    assembly.side.add(band);
    assembly.band = band;
  });
  const hubShape = new THREE.Shape([
    new THREE.Vector2(-0.3, -0.15),
    new THREE.Vector2(0.3, -0.15),
    new THREE.Vector2(0.3, 0.15),
    new THREE.Vector2(-0.3, 0.15),
  ]);
  hubShape.holes.push(new THREE.Path().absarc(0, 0, geometry.spindleRadius + 0.002, 0, Math.PI * 2, true));
  const hubGeometry = new THREE.ExtrudeGeometry(hubShape, {
    bevelEnabled: false,
    curveSegments: 40,
    depth: 0.82,
  });
  hubGeometry.rotateX(-Math.PI / 2);
  const hub = new THREE.Mesh(hubGeometry, material);
  hub.position.y = 0.3;
  hub.userData.role = 'spindle-block-joining-guide-arms-B';
  blocks.governorRotor.add(hub);
  blocks.guideHub = hub;
  const removed = [blocks.spindleIndex, blocks.lowerBearing.children[1]];
  blocks.sleeveAssembly.traverse((object) => {
    if (/^white-/.test(object.userData.role ?? '')) removed.push(object);
  });
  for (const assembly of blocks.sideAssemblies) {
    removed.push(...assembly.roller.userData.blocks.faceIndices,
      assembly.flyball.userData.blocks.orbitIndex);
  }
  for (const object of removed) object.removeFromParent();
  markShadows(root);
}

export function createAuthoredParabolicGovernorMovement(movement) {
  if (movement.id !== 274) return null;
  const result = parabolicGovernor(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
