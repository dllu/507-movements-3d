import * as THREE from 'three';
import {correctClampParts} from './clamp-working-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function cylinderAlongZ(radius, length, material, segments = 34) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function simpsonIntegral(integrand, intervals = 128) {
  const count = intervals % 2 === 0 ? intervals : intervals + 1;
  let weightedSum = integrand(0) + integrand(1);
  for (let index = 1; index < count; index += 1) {
    weightedSum += (index % 2 === 0 ? 2 : 4)
      * integrand(index / count);
  }
  return weightedSum / (3 * count);
}

function cubicSmoothstep(parameter) {
  return parameter * parameter * (3 - 2 * parameter);
}

function cubicSmoothstepDerivative(parameter) {
  return 6 * parameter * (1 - parameter);
}

function makeDynamicLeafStrip({
  color,
  pointCount = 65,
  thickness,
  width,
}) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(pointCount * 4 * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const indices = [];
  for (let pointIndex = 0; pointIndex < pointCount - 1; pointIndex += 1) {
    const first = pointIndex * 4;
    const second = first + 4;
    for (let side = 0; side < 4; side += 1) {
      const nextSide = (side + 1) % 4;
      indices.push(
        first + side,
        second + side,
        second + nextSide,
        first + side,
        second + nextSide,
        first + nextSide,
      );
    }
  }
  indices.push(0, 2, 1, 0, 3, 2);
  const last = (pointCount - 1) * 4;
  indices.push(last, last + 1, last + 2, last, last + 2, last + 3);
  geometry.setIndex(indices);
  const material = matte(color, {
    metalness: 0.22,
    roughness: 0.48,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const widthAxis = new THREE.Vector3(0, 0, 1);
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const corner = new THREE.Vector3();

  mesh.userData.setCenterline = (points) => {
    if (points.length !== pointCount) {
      throw new RangeError(
        `Pickering leaf expected ${pointCount} points, received ${points.length}.`,
      );
    }
    for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
      if (pointIndex === 0) {
        tangent.subVectors(points[1], points[0]);
      } else if (pointIndex === pointCount - 1) {
        tangent.subVectors(points.at(-1), points.at(-2));
      } else {
        tangent.subVectors(points[pointIndex + 1], points[pointIndex - 1]);
      }
      tangent.normalize();
      normal.crossVectors(widthAxis, tangent).normalize();
      const center = points[pointIndex];
      const vertexOffset = pointIndex * 12;
      const signs = [
        [1, 1],
        [-1, 1],
        [-1, -1],
        [1, -1],
      ];
      for (let cornerIndex = 0; cornerIndex < signs.length; cornerIndex += 1) {
        const [widthSign, thicknessSign] = signs[cornerIndex];
        corner.copy(center)
          .addScaledVector(widthAxis, widthSign * width / 2)
          .addScaledVector(normal, thicknessSign * thickness / 2);
        corner.toArray(positions, vertexOffset + cornerIndex * 3);
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    mesh.userData.centerlinePoints = points;
  };
  mesh.userData.pointCount = pointCount;
  mesh.userData.thickness = thickness;
  mesh.userData.width = width;
  return mesh;
}

function pickeringThreeSpringGovernor(movement) {
  const root = new THREE.Group();

  // Brown supplies one front elevation and marks this movement's animation
  // unavailable. Measurements below therefore come from the 525 px public-
  // domain plate. Pickering's patent US36621A supplies the topology hidden by
  // that elevation: a keyed sliding sleeve and weights clamped at the middle of
  // each leaf. The patent's third leaf is omitted because Brown draws two. No geometry is copied from an
  // animation.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.018;
  const sourceRasterSpindleAxisX = 263;
  const sourceRasterTopSpringAnchorY = 78;
  const sourceRasterTopSpringAnchorLeft = new THREE.Vector2(236, 78);
  const sourceRasterTopSpringAnchorRight = new THREE.Vector2(290, 78);
  const sourceRasterBottomSpringAnchorLeft = new THREE.Vector2(232, 391);
  const sourceRasterBottomSpringAnchorRight = new THREE.Vector2(294, 391);
  const sourceRasterBallLeft = new THREE.Vector2(179, 230);
  const sourceRasterBallRight = new THREE.Vector2(351, 230);
  const sourceRasterBallHalfWidth = 37;
  const sourceRasterBallHalfHeight = 21;
  const topAnchorY = 2.8;
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterSpindleAxisX) * sourceScale,
    topAnchorY + (sourceRasterTopSpringAnchorY - y) * sourceScale,
  );

  const meanTopAnchorRadiusPixels = (
    sourceRasterSpindleAxisX - sourceRasterTopSpringAnchorLeft.x
      + sourceRasterTopSpringAnchorRight.x - sourceRasterSpindleAxisX
  ) / 2;
  const meanBottomAnchorRadiusPixels = (
    sourceRasterSpindleAxisX - sourceRasterBottomSpringAnchorLeft.x
      + sourceRasterBottomSpringAnchorRight.x - sourceRasterSpindleAxisX
  ) / 2;
  const meanAnchorRadiusPixels = (
    meanTopAnchorRadiusPixels + meanBottomAnchorRadiusPixels
  ) / 2;
  const meanBallOrbitRadiusPixels = (
    sourceRasterSpindleAxisX - sourceRasterBallLeft.x
      + sourceRasterBallRight.x - sourceRasterSpindleAxisX
  ) / 2;
  const anchorRadius = meanAnchorRadiusPixels * sourceScale;
  const minimumDeflection = (
    meanBallOrbitRadiusPixels - meanAnchorRadiusPixels
  ) * sourceScale;
  const minimumHalfSpan = (
    sourceRasterBottomSpringAnchorLeft.y
      - sourceRasterTopSpringAnchorY
  ) * sourceScale / 2;

  const integrationIntervals = 128;
  const halfSpringLengthAt = (deflection, halfSpan) => simpsonIntegral(
    (parameter) => Math.hypot(
      halfSpan,
      deflection * cubicSmoothstepDerivative(parameter),
    ),
    integrationIntervals,
  );
  const halfSpringMetrics = (deflection, halfSpan) => {
    const integral = (selector) => simpsonIntegral((parameter) => {
      const profileDerivative = cubicSmoothstepDerivative(parameter);
      const radialDerivative = deflection * profileDerivative;
      const speed = Math.hypot(halfSpan, radialDerivative);
      const speedCubed = speed ** 3;
      if (selector === 'length') return speed;
      if (selector === 'spanFirst') return halfSpan / speed;
      if (selector === 'deflectionFirst') {
        return deflection * profileDerivative ** 2 / speed;
      }
      if (selector === 'spanSecond') {
        return deflection ** 2 * profileDerivative ** 2 / speedCubed;
      }
      if (selector === 'mixedSecond') {
        return -halfSpan * deflection * profileDerivative ** 2
          / speedCubed;
      }
      return halfSpan ** 2 * profileDerivative ** 2 / speedCubed;
    }, integrationIntervals);
    return {
      deflectionFirst: integral('deflectionFirst'),
      deflectionSecond: integral('deflectionSecond'),
      length: integral('length'),
      mixedSecond: integral('mixedSecond'),
      spanFirst: integral('spanFirst'),
      spanSecond: integral('spanSecond'),
    };
  };
  const halfSpringLength = halfSpringLengthAt(
    minimumDeflection,
    minimumHalfSpan,
  );
  const halfSpanAtDeflection = (deflection) => {
    let lower = 0;
    let upper = halfSpringLength;
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (halfSpringLengthAt(deflection, middle) < halfSpringLength) {
        lower = middle;
      } else {
        upper = middle;
      }
    }
    return (lower + upper) / 2;
  };
  const halfSpanKinematicsAtDeflection = (deflection) => {
    const halfSpan = halfSpanAtDeflection(deflection);
    const metrics = halfSpringMetrics(deflection, halfSpan);
    const firstDerivative = -metrics.deflectionFirst
      / metrics.spanFirst;
    const secondDerivative = -(
      metrics.deflectionSecond
        + 2 * metrics.mixedSecond * firstDerivative
        + metrics.spanSecond * firstDerivative ** 2
    ) / metrics.spanFirst;
    return {
      firstDerivative,
      halfSpan,
      length: metrics.length,
      secondDerivative,
    };
  };

  // The dashed high-speed pose in Pickering's patent is about 1.7 times the
  // source plate's radial spring deflection. The elastic law is deliberately
  // reduced-order: the three identical leaves contribute a calibrated radial
  // stiffness, while the exact visible centerlines remain inextensible.
  const maximumDeflection = minimumDeflection * 1.72;
  const springFreeDeflection = minimumDeflection * 0.32;
  const ballMass = 1;
  const responseCyclePeriod = 8;
  const rotationsPerResponseCycle = 6;
  const targetMeanSpindleAngularSpeed = FULL_TURN
    * rotationsPerResponseCycle / responseCyclePeriod;
  const unitSpeedAtDeflection = (deflection) => Math.sqrt(
    (deflection - springFreeDeflection)
      / (ballMass * (anchorRadius + deflection)),
  );
  const unitMinimumSpeed = unitSpeedAtDeflection(minimumDeflection);
  const unitMaximumSpeed = unitSpeedAtDeflection(maximumDeflection);
  const springRadialStiffness = (
    targetMeanSpindleAngularSpeed
      / ((unitMinimumSpeed + unitMaximumSpeed) / 2)
  ) ** 2;
  const spindleSpeedAtDeflection = (deflection) => Math.sqrt(
    springRadialStiffness * (deflection - springFreeDeflection)
      / (ballMass * (anchorRadius + deflection)),
  );
  const minimumSpindleAngularSpeed = spindleSpeedAtDeflection(
    minimumDeflection,
  );
  const maximumSpindleAngularSpeed = spindleSpeedAtDeflection(
    maximumDeflection,
  );
  const meanSpindleAngularSpeed = (
    minimumSpindleAngularSpeed + maximumSpindleAngularSpeed
  ) / 2;
  const spindleAngularSpeedAmplitude = (
    maximumSpindleAngularSpeed - minimumSpindleAngularSpeed
  ) / 2;
  const responseAngularFrequency = FULL_TURN / responseCyclePeriod;
  const deflectionAtSpindleSpeed = (spindleAngularSpeed) => {
    const centrifugalCoefficient = ballMass * spindleAngularSpeed ** 2;
    return (
      springRadialStiffness * springFreeDeflection
        + centrifugalCoefficient * anchorRadius
    ) / (springRadialStiffness - centrifugalCoefficient);
  };

  const curvePointAt = (normalized, deflection, halfSpan) => {
    const parameter = THREE.MathUtils.clamp(normalized, 0, 1);
    if (parameter <= 0.5) {
      const halfParameter = parameter * 2;
      return new THREE.Vector3(
        anchorRadius
          + deflection * cubicSmoothstep(halfParameter),
        topAnchorY - halfSpan * halfParameter,
        0,
      );
    }
    const halfParameter = (parameter - 0.5) * 2;
    return new THREE.Vector3(
      anchorRadius
        + deflection * (1 - cubicSmoothstep(halfParameter)),
      topAnchorY - halfSpan * (1 + halfParameter),
      0,
    );
  };
  const curveDerivativeAt = (normalized, deflection, halfSpan) => {
    const parameter = THREE.MathUtils.clamp(normalized, 0, 1);
    if (parameter <= 0.5) {
      const halfParameter = parameter * 2;
      return new THREE.Vector3(
        2 * deflection * cubicSmoothstepDerivative(halfParameter),
        -2 * halfSpan,
        0,
      );
    }
    const halfParameter = (parameter - 0.5) * 2;
    return new THREE.Vector3(
      -2 * deflection * cubicSmoothstepDerivative(halfParameter),
      -2 * halfSpan,
      0,
    );
  };
  const springPointCount = 65;
  const springCenterlineAt = (
    deflection,
    halfSpan,
    pointCount = springPointCount,
  ) => Array.from({ length: pointCount }, (_, index) => curvePointAt(
    index / (pointCount - 1),
    deflection,
    halfSpan,
  ));

  const minimumSpanState = halfSpanKinematicsAtDeflection(
    minimumDeflection,
  );
  const maximumSpanState = halfSpanKinematicsAtDeflection(
    maximumDeflection,
  );
  const sleeveMinimumY = topAnchorY - 2 * minimumSpanState.halfSpan;
  const sleeveMaximumY = topAnchorY - 2 * maximumSpanState.halfSpan;
  const sleeveStroke = sleeveMaximumY - sleeveMinimumY;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.56,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.20,
    roughness: 0.50,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.43,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.69,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const governorRotor = new THREE.Group();
  governorRotor.userData.axis = Y_AXIS.clone();
  governorRotor.userData.role =
    'continuous-pickering-spindle-springs-balls-and-keyed-sleeve-rotor';

  const spindleBottomY = -4.55;
  const spindleTopY = 3.92;
  const spindle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, spindleTopY - spindleBottomY, 38),
    darkMaterial,
  );
  spindle.position.y = (spindleTopY + spindleBottomY) / 2;
  spindle.userData.role = 'continuous-central-governor-spindle';
  const spindleIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.38, 0.055),
    indexMaterial,
  );
  spindleIndex.position.set(0.14, 3.55, 0);
  spindleIndex.userData.role = 'white-spindle-rotation-index';

  const upperHead = new THREE.Group();
  upperHead.userData.role = 'spindle-fixed-upper-spring-collar';
  const upperFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.78, 0.22, 48),
    driverMaterial,
  );
  upperFlange.position.y = topAnchorY;
  upperFlange.userData.role = 'fixed-upper-spring-anchor-flange';
  const upperKeeper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.64, 0.64, 0.18, 48),
    driverMaterial,
  );
  upperKeeper.position.y = topAnchorY + 0.24;
  upperKeeper.userData.role = 'upper-spring-end-keeper-collar';
  const upperCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.48, 0.34, 42),
    driverMaterial,
  );
  upperCap.position.y = topAnchorY + 0.50;
  upperCap.userData.role = 'upper-spindle-head-cap';
  const upperCapRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.055, 10, 48),
    darkMaterial,
  );
  upperCapRing.rotation.x = Math.PI / 2;
  upperCapRing.position.y = topAnchorY + 0.35;
  upperHead.add(upperFlange, upperKeeper, upperCap, upperCapRing);

  const slidingSleeve = new THREE.Group();
  slidingSleeve.position.y = sleeveMinimumY;
  slidingSleeve.userData.axis = Y_AXIS.clone();
  slidingSleeve.userData.role =
    'keyed-axially-sliding-lower-spring-sleeve-rotating-with-spindle';
  const lowerFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.81, 0.81, 0.23, 48),
    accentMaterial,
  );
  lowerFlange.userData.role = 'moving-lower-spring-anchor-flange';
  const lowerKeeper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.66, 0.66, 0.17, 48),
    accentMaterial,
  );
  lowerKeeper.position.y = -0.25;
  lowerKeeper.userData.role = 'lower-spring-end-keeper-collar';
  const sleeveBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.80, 42),
    drivenMaterial,
  );
  sleeveBody.position.y = -0.62;
  sleeveBody.userData.role = 'axially-sliding-keyed-sleeve-body';
  const thrustRingUpper = new THREE.Mesh(
    new THREE.TorusGeometry(0.44, 0.075, 10, 48),
    darkMaterial,
  );
  thrustRingUpper.rotation.x = Math.PI / 2;
  thrustRingUpper.position.y = -0.40;
  thrustRingUpper.userData.role = 'upper-thrust-groove-ring-on-sleeve';
  const thrustRingLower = thrustRingUpper.clone();
  thrustRingLower.position.y = -0.82;
  thrustRingLower.userData.role = 'lower-thrust-groove-ring-on-sleeve';
  const sleeveIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.09, 0.18),
    indexMaterial,
  );
  sleeveIndex.position.set(0.77, 0.12, 0);
  sleeveIndex.userData.role =
    'white-index-showing-sleeve-rotation-and-axial-travel';
  const featherKey = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.70, 0.10),
    darkMaterial,
  );
  featherKey.position.set(0.31, -0.61, 0);
  featherKey.userData.role =
    'spindle-feather-preventing-sleeve-relative-rotation';
  slidingSleeve.add(
    lowerFlange,
    lowerKeeper,
    sleeveBody,
    thrustRingUpper,
    thrustRingLower,
    featherKey,
  );

  const springWidth = 0.20;
  const springThickness = 0.055;
  const initialCenterline = springCenterlineAt(
    minimumDeflection,
    minimumSpanState.halfSpan,
  );
  // Brown's elevation draws two diametrically opposed spring-and-ball
  // profiles and nothing between them; the plate is followed here although
  // Pickering's patent section shows three equally spaced leaves.
  const baseAngles = [0, FULL_TURN / 2];
  const springAssemblies = baseAngles.map((baseAngle, index) => {
    const springPlane = new THREE.Group();
    springPlane.rotation.y = baseAngle;
    springPlane.userData.baseAngle = baseAngle;
    springPlane.userData.role =
      `radial-plane-of-pickering-spring-${index + 1}`;
    const spring = makeDynamicLeafStrip({
      color: PALETTE.driven,
      pointCount: springPointCount,
      thickness: springThickness,
      width: springWidth,
    });
    spring.userData.role =
      `inextensible-compound-curved-flat-leaf-spring-${index + 1}`;
    spring.userData.setCenterline(initialCenterline);
    const ball = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 0.48, 10, 28),
      driverMaterial,
    );
    ball.rotation.z = -Math.PI / 2;
    ball.position.set(
      anchorRadius + minimumDeflection,
      topAnchorY - minimumSpanState.halfSpan,
      0,
    );
    ball.userData.role = `centrifugal-weight-on-leaf-midpoint-${index + 1}`;
    const ballClampPin = cylinderAlongZ(0.115, 0.86, darkMaterial, 30);
    ballClampPin.position.copy(ball.position);
    ballClampPin.userData.role =
      `weight-clamp-keeping-spring-middle-parallel-to-spindle-${index + 1}`;
    const ballIndex = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 16, 12),
      indexMaterial,
    );
    ballIndex.position.set(
      anchorRadius + minimumDeflection + 0.61,
      ball.position.y,
      0,
    );
    ballIndex.userData.role = `white-orbit-index-on-weight-${index + 1}`;
    springPlane.add(spring, ball, ballClampPin);
    governorRotor.add(springPlane);
    return {
      ball,
      ballClampPin,
      ballIndex,
      baseAngle,
      spring,
      springPlane,
    };
  });

  const upperAnchorClamps = [];
  const lowerAnchorClamps = [];
  for (const [index, baseAngle] of baseAngles.entries()) {
    const cosine = Math.cos(baseAngle);
    const sine = Math.sin(baseAngle);
    const upperClamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.42, 0.30),
      darkMaterial,
    );
    upperClamp.position.set(
      anchorRadius * cosine,
      topAnchorY,
      -anchorRadius * sine,
    );
    upperClamp.rotation.y = baseAngle;
    upperClamp.userData.role = `upper-parallel-spring-clamp-${index + 1}`;
    const lowerClamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.42, 0.30),
      darkMaterial,
    );
    lowerClamp.position.set(
      anchorRadius * cosine,
      0,
      -anchorRadius * sine,
    );
    lowerClamp.rotation.y = baseAngle;
    lowerClamp.userData.role = `lower-parallel-spring-clamp-${index + 1}`;
    upperAnchorClamps.push(upperClamp);
    lowerAnchorClamps.push(lowerClamp);
    governorRotor.add(upperClamp);
    slidingSleeve.add(lowerClamp);
  }

  governorRotor.add(
    spindle,
    upperHead,
    slidingSleeve,
  );

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-lower-spindle-bearing-and-pedestal';
  const bearingCenterY = -4.22;
  const bearingHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 0.30, 44),
    frameMaterial,
  );
  bearingHousing.position.y = bearingCenterY;
  bearingHousing.userData.role = 'fixed-lower-spindle-bearing-housing';
  const bearingRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.27, 0.075, 10, 44),
    darkMaterial,
  );
  bearingRing.rotation.x = Math.PI / 2;
  bearingRing.position.y = bearingCenterY + 0.17;
  bearingRing.userData.role = 'fixed-lower-spindle-bearing-ring';
  const pedestalStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.46, 0.48, 38),
    frameMaterial,
  );
  pedestalStem.position.y = bearingCenterY - 0.36;
  pedestalStem.userData.role = 'fixed-governor-pedestal-stem';
  const pedestalFoot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 0.92, 0.20, 48),
    frameMaterial,
  );
  pedestalFoot.position.y = bearingCenterY - 0.70;
  pedestalFoot.userData.role = 'fixed-governor-pedestal-foot';
  fixedFrame.add(
    bearingHousing,
    bearingRing,
    pedestalStem,
    pedestalFoot,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(5.8, 9.8, 5.8),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.y = -0.35;
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-three-spring-governor-response';

  root.add(cameraEnvelope, fixedFrame, governorRotor);

  const pointKinematics = ({
    angle,
    angularAcceleration,
    angularSpeed,
    radius,
    radialAcceleration,
    radialSpeed,
    verticalAcceleration,
    verticalSpeed,
    y,
  }) => {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const radialComponent = radialAcceleration
      - radius * angularSpeed ** 2;
    const tangentialComponent = 2 * radialSpeed * angularSpeed
      + radius * angularAcceleration;
    return {
      acceleration: new THREE.Vector3(
        radialComponent * cosine - tangentialComponent * sine,
        verticalAcceleration,
        -radialComponent * sine - tangentialComponent * cosine,
      ),
      position: new THREE.Vector3(
        radius * cosine,
        y,
        -radius * sine,
      ),
      velocity: new THREE.Vector3(
        radialSpeed * cosine - radius * angularSpeed * sine,
        verticalSpeed,
        -radialSpeed * sine - radius * angularSpeed * cosine,
      ),
    };
  };

  const stateAtTime = (time) => {
    const unwrappedCyclePhase = time / responseCyclePeriod;
    const cycleIndex = Math.floor(unwrappedCyclePhase);
    const cyclePhase = unwrappedCyclePhase - cycleIndex;
    const responseAngle = responseAngularFrequency * time;
    const speedFraction = (1 - Math.cos(responseAngle)) / 2;
    const speedFractionRate = responseAngularFrequency
      * Math.sin(responseAngle) / 2;
    const speedFractionAcceleration = responseAngularFrequency ** 2
      * Math.cos(responseAngle) / 2;
    const spindleAngularSpeed = minimumSpindleAngularSpeed
      + (maximumSpindleAngularSpeed - minimumSpindleAngularSpeed)
        * speedFraction;
    const spindleAngularAcceleration = (
      maximumSpindleAngularSpeed - minimumSpindleAngularSpeed
    ) * speedFractionRate;
    const spindleAngularJerk = (
      maximumSpindleAngularSpeed - minimumSpindleAngularSpeed
    ) * speedFractionAcceleration;
    const governorAngle = meanSpindleAngularSpeed * time
      - spindleAngularSpeedAmplitude
        * Math.sin(responseAngle) / responseAngularFrequency;

    const deflection = deflectionAtSpindleSpeed(spindleAngularSpeed);
    const denominator = springRadialStiffness
      - ballMass * spindleAngularSpeed ** 2;
    const firstDeflectionDerivativeBySpeed = 2 * ballMass
      * spindleAngularSpeed * springRadialStiffness
      * (anchorRadius + springFreeDeflection) / denominator ** 2;
    const secondDeflectionDerivativeBySpeed = 2 * ballMass
      * springRadialStiffness * (anchorRadius + springFreeDeflection)
      / denominator ** 2
      + 8 * ballMass ** 2 * spindleAngularSpeed ** 2
        * springRadialStiffness
        * (anchorRadius + springFreeDeflection) / denominator ** 3;
    const deflectionRate = firstDeflectionDerivativeBySpeed
      * spindleAngularAcceleration;
    const deflectionAcceleration = secondDeflectionDerivativeBySpeed
      * spindleAngularAcceleration ** 2
      + firstDeflectionDerivativeBySpeed * spindleAngularJerk;

    const span = halfSpanKinematicsAtDeflection(deflection);
    const halfSpanRate = span.firstDerivative * deflectionRate;
    const halfSpanAcceleration = span.secondDerivative
      * deflectionRate ** 2
      + span.firstDerivative * deflectionAcceleration;
    const ballOrbitRadius = anchorRadius + deflection;
    const ballCenterY = topAnchorY - span.halfSpan;
    const sleeveY = topAnchorY - 2 * span.halfSpan;
    const sleeveLift = sleeveY - sleeveMinimumY;
    const sleeveVelocityY = -2 * halfSpanRate;
    const sleeveAccelerationY = -2 * halfSpanAcceleration;
    const ballVerticalSpeed = -halfSpanRate;
    const ballVerticalAcceleration = -halfSpanAcceleration;
    const restoringForce = springRadialStiffness
      * (deflection - springFreeDeflection);
    const centrifugalForce = ballMass * spindleAngularSpeed ** 2
      * ballOrbitRadius;
    const ballStates = baseAngles.map((baseAngle, index) => {
      const angle = governorAngle + baseAngle;
      return {
        angle,
        baseAngle,
        index,
        ...pointKinematics({
          angle,
          angularAcceleration: spindleAngularAcceleration,
          angularSpeed: spindleAngularSpeed,
          radialAcceleration: deflectionAcceleration,
          radialSpeed: deflectionRate,
          radius: ballOrbitRadius,
          verticalAcceleration: ballVerticalAcceleration,
          verticalSpeed: ballVerticalSpeed,
          y: ballCenterY,
        }),
      };
    });
    const stage = Math.abs(spindleAngularAcceleration) < 1e-11
      ? Math.cos(responseAngle) >= 0
        ? 'minimum-speed-springs-in-sleeve-down'
        : 'maximum-speed-springs-out-sleeve-up'
      : spindleAngularAcceleration > 0
        ? 'speed-rising-balls-outward-sleeve-rising'
        : 'speed-falling-springs-retracting-sleeve-descending';
    return {
      ballCenterY,
      ballLift: ballCenterY
        - (topAnchorY - minimumSpanState.halfSpan),
      ballOrbitRadius,
      ballStates,
      ballVerticalAcceleration,
      ballVerticalSpeed,
      centrifugalForce,
      cycleIndex,
      cyclePhase,
      deflection,
      deflectionAcceleration,
      deflectionRate,
      elasticEnergy: 0.5 * springRadialStiffness
        * (deflection - springFreeDeflection) ** 2,
      forceEquilibriumResidual: centrifugalForce - restoringForce,
      governorAngle,
      halfSpan: span.halfSpan,
      halfSpanAcceleration,
      halfSpanRate,
      responseAngle,
      restoringForce,
      sleeveAccelerationY,
      sleeveLift,
      sleeveLiftFraction: sleeveLift / sleeveStroke,
      sleeveVelocityY,
      sleeveY,
      speedFraction,
      speedFractionAcceleration,
      speedFractionRate,
      spindleAngularAcceleration,
      spindleAngularJerk,
      spindleAngularSpeed,
      springCenterlineLength: 2 * span.length,
      springLengthError: 2 * (span.length - halfSpringLength),
      stage,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * responseCyclePeriod,
  );
  const canonicalTimes = {
    accelerating: responseCyclePeriod / 4,
    cycleClosure: responseCyclePeriod,
    decelerating: responseCyclePeriod * 3 / 4,
    highSpeed: responseCyclePeriod / 2,
    lowSpeed: 0,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    governorRotor.rotation.y = state.governorAngle;
    governorRotor.userData.angularAcceleration =
      state.spindleAngularAcceleration;
    governorRotor.userData.angularSpeed = state.spindleAngularSpeed;
    slidingSleeve.position.y = state.sleeveY;
    slidingSleeve.userData.axialAcceleration = state.sleeveAccelerationY;
    slidingSleeve.userData.axialSpeed = state.sleeveVelocityY;
    const centerline = springCenterlineAt(
      state.deflection,
      state.halfSpan,
    );
    for (const [index, assembly] of springAssemblies.entries()) {
      assembly.spring.userData.setCenterline(centerline);
      assembly.spring.userData.centerlineLength =
        state.springCenterlineLength;
      assembly.spring.userData.lengthError = state.springLengthError;
      assembly.ball.position.set(
        state.ballOrbitRadius,
        state.ballCenterY,
        0,
      );
      assembly.ball.userData.acceleration =
        state.ballStates[index].acceleration;
      assembly.ball.userData.velocity = state.ballStates[index].velocity;
      assembly.ballClampPin.position.copy(assembly.ball.position);
      assembly.ballIndex.position.set(
        state.ballOrbitRadius + 0.61,
        state.ballCenterY,
        0,
      );
    }
    root.userData.contacts = {
      ballClamps: springAssemblies.map((_, index) => ({
        ballIndex: index,
        curveParameter: 0.5,
        middleTangentRadialComponent: curveDerivativeAt(
          0.5,
          state.deflection,
          state.halfSpan,
        ).x,
      })),
      springAnchors: springAssemblies.map((_, index) => ({
        bottomPoint: curvePointAt(
          1,
          state.deflection,
          state.halfSpan,
        ),
        bottomTangentRadialComponent: curveDerivativeAt(
          1,
          state.deflection,
          state.halfSpan,
        ).x,
        index,
        lengthError: state.springLengthError,
        topPoint: curvePointAt(
          0,
          state.deflection,
          state.halfSpan,
        ),
        topTangentRadialComponent: curveDerivativeAt(
          0,
          state.deflection,
          state.halfSpan,
        ).x,
      })),
      sleeveFeather: {
        axialPosition: state.sleeveY,
        axialSpeed: state.sleeveVelocityY,
        relativeAngularSpeed: 0,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    'three-leaf-spring-pickering-governor-keyed-sliding-sleeve';
  root.userData.mechanism =
    'two diametrically opposed flat leaf springs, as drawn on Brown\u2019s plate (the patent uses three), rotate with the spindle; each centrifugal weight is clamped at its spring midpoint, the upper spring ends are fixed to the spindle collar, and the lower ends raise one keyed nonrotating-relative-to-spindle sliding sleeve as speed increases';
  root.userData.transmission = {
    ballCount: 2,
    feedback: 'higher spindle speed bows both springs outward and raises the common sleeve; lower speed lets their elasticity retract the balls and depress the sleeve',
    lowerSleeveRelativeRotation: 0,
    output: 'axial displacement of the keyed lower sleeve',
    springCount: 2,
  };
  root.userData.blocks = {
    bearingHousing,
    bearingRing,
    cameraEnvelope,
    featherKey,
    fixedFrame,
    governorRotor,
    lowerAnchorClamps,
    lowerFlange,
    lowerKeeper,
    pedestalFoot,
    pedestalStem,
    sleeveBody,
    sleeveIndex,
    slidingSleeve,
    spindle,
    spindleIndex,
    springAssemblies,
    thrustRingLower,
    thrustRingUpper,
    upperAnchorClamps,
    upperCap,
    upperFlange,
    upperHead,
    upperKeeper,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.curveDerivativeAt = curveDerivativeAt;
  root.userData.curvePointAt = curvePointAt;
  root.userData.deflectionAtSpindleSpeed = deflectionAtSpindleSpeed;
  root.userData.geometry = {
    anchorRadius,
    ballMass,
    fullTurn: FULL_TURN,
    halfSpringLength,
    integrationIntervals,
    maximumDeflection,
    maximumHalfSpan: maximumSpanState.halfSpan,
    maximumSpindleAngularSpeed,
    meanAnchorRadiusPixels,
    meanBallOrbitRadiusPixels,
    minimumDeflection,
    minimumHalfSpan,
    minimumSpindleAngularSpeed,
    responseAngularFrequency,
    responseCyclePeriod,
    rotationsPerResponseCycle,
    sleeveMaximumY,
    sleeveMinimumY,
    sleeveStroke,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    spindleBottomY,
    spindleTopY,
    springFreeDeflection,
    springPointCount,
    springRadialStiffness,
    springThickness,
    springWidth,
    targetMeanSpindleAngularSpeed,
    topAnchorY,
  };
  root.userData.halfSpanAtDeflection = halfSpanAtDeflection;
  root.userData.halfSpanKinematicsAtDeflection =
    halfSpanKinematicsAtDeflection;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'The official Movement 287 page exposes only Brown’s static plate and description. The response envelope is independently reconstructed from that plate and Pickering patent US36621A; no proprietary animation geometry or timing is used.',
    sourceUrl: 'https://507movements.com/mm_287.html',
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    patent: {
      date: '1862-10-07',
      figure1: 'axial section showing solid low-speed and dashed high-speed positions',
      figure2: 'transverse section showing three equally spaced springs',
      number: 'US36621A',
      verifiedTopology: 'three flat steel springs have upper ends fixed relative to the spindle, lower ends fixed to a feather-keyed sliding sleeve, and balls clamped at their middle portions; all clamped portions remain parallel to the spindle',
      url: 'https://patents.google.com/patent/US36621A/en',
    },
    plate287: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'the plate draws exactly two spring-and-weight profiles, modelled as two diametrically opposed assemblies; the patent’s third equally spaced assembly is not drawn and is omitted',
      measurementUncertaintyPixels: 7,
      rasterBallHalfHeight: sourceRasterBallHalfHeight,
      rasterBallHalfWidth: sourceRasterBallHalfWidth,
      rasterBallLeft: sourceRasterBallLeft.clone(),
      rasterBallRight: sourceRasterBallRight.clone(),
      rasterBottomSpringAnchorLeft:
        sourceRasterBottomSpringAnchorLeft.clone(),
      rasterBottomSpringAnchorRight:
        sourceRasterBottomSpringAnchorRight.clone(),
      rasterSpindleAxisX: sourceRasterSpindleAxisX,
      rasterTopSpringAnchorLeft: sourceRasterTopSpringAnchorLeft.clone(),
      rasterTopSpringAnchorRight: sourceRasterTopSpringAnchorRight.clone(),
      rasterTopSpringAnchorY: sourceRasterTopSpringAnchorY,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 75,
      edition: 21,
      illustrationPage: 74,
      publicationYear: 1908,
    },
  };
  root.userData.spindleSpeedAtDeflection = spindleSpeedAtDeflection;
  root.userData.springCenterlineAt = springCenterlineAt;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cyclePeriod: responseCyclePeriod,
    rotationsPerCycle: rotationsPerResponseCycle,
    schedule: [
      'speed-rises-balls-bow-outward-sleeve-rises',
      'maximum-speed-maximum-sleeve-lift',
      'speed-falls-springs-retract-balls-sleeve-descends',
      'minimum-speed-minimum-sleeve-height',
    ],
  };

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
    cameraEnvelope,
    sleeveIndex,
    spindleIndex,
    ...springAssemblies.map(({ ballIndex }) => ballIndex),
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  cameraEnvelope.castShadow = false;
  cameraEnvelope.receiveShadow = false;
  root.userData.fidelity = 'authored';
  return {
    cameraDirection: new THREE.Vector3(7.4, 4.8, 11.8),
    root,
    update,
  };
}

export function createAuthoredPickeringGovernorMovement(movement) {
  if (movement.id !== 287) return null;
  const model = pickeringThreeSpringGovernor(movement);
  correctClampParts(model, 287);
  // Brown draws a flat front elevation across the two spring planes.
  model.cameraDirection = new THREE.Vector3(0, 0.3, 14);
  return model;
}
