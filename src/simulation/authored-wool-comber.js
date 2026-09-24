import * as THREE from 'three';
import {circle, poly, polygonClipping} from './finite-plate-geometry.js';
import {woolComberNotch} from '../data/wool-comber-notch.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function signedAngularDifference(left, right) {
  return Math.atan2(Math.sin(left - right), Math.cos(left - right));
}

function quinticStep(parameter) {
  return parameter ** 3 * (
    10 + parameter * (-15 + 6 * parameter)
  );
}

function quinticStepDerivative(parameter) {
  return 30 * parameter ** 2 * (1 - parameter) ** 2;
}

function quinticStepSecondDerivative(parameter) {
  return 60 * parameter * (1 - parameter) * (1 - 2 * parameter);
}

function rotate2(vector, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * vector.x - sine * vector.y,
    sine * vector.x + cosine * vector.y,
  );
}

function crossZ2(vector) {
  return new THREE.Vector2(-vector.y, vector.x);
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function tubeBetween2D(start, end, z, radius, material) {
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = new THREE.Vector3(
    end.x - start.x,
    end.y - start.y,
    0,
  );
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), 24),
    material,
  );
  tube.position.set(midpoint.x, midpoint.y, z);
  tube.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  return tube;
}

function curvedTube2D(points, z, radius, material) {
  const curvePoints = points.map(
    (point) => new THREE.Vector3(point.x, point.y, z),
  );
  return new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(curvePoints),
      72,
      radius,
      14,
      false,
    ),
    material,
  );
}

function shapeFromPoints(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    shape.lineTo(points[index].x, points[index].y);
  }
  shape.closePath();
  return shape;
}

function pathFromPoints(points) {
  const path = new THREE.Path();
  path.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    path.lineTo(points[index].x, points[index].y);
  }
  path.closePath();
  return path;
}

function circlePoints(radius, segments = 192) {
  return Array.from({ length: segments }, (_, index) => {
    const angle = index / segments * FULL_TURN;
    return new THREE.Vector2(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
    );
  });
}

function extrudedShape(shape, depth, centerZ, material) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = centerZ;
  return mesh;
}

function lineLoop(points, z, material) {
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map((point) => new THREE.Vector3(point.x, point.y, z)),
  );
  return new THREE.LineLoop(geometry, material);
}

function segmentIntersection(firstStart, firstEnd, secondStart, secondEnd) {
  const firstDirection = firstEnd.clone().sub(firstStart);
  const secondDirection = secondEnd.clone().sub(secondStart);
  const denominator = firstDirection.cross(secondDirection);
  if (Math.abs(denominator) < 1e-12) return null;
  const betweenStarts = secondStart.clone().sub(firstStart);
  const firstParameter = betweenStarts.cross(secondDirection) / denominator;
  const secondParameter = betweenStarts.cross(firstDirection) / denominator;
  if (
    firstParameter <= 1e-8
    || firstParameter >= 1 - 1e-8
    || secondParameter <= 1e-8
    || secondParameter >= 1 - 1e-8
  ) return null;
  return firstStart.clone().addScaledVector(
    firstDirection,
    firstParameter,
  );
}

function trimSingleCutterUndercut(points) {
  const count = points.length;
  for (let first = 0; first < count; first += 1) {
    const firstNext = (first + 1) % count;
    for (let second = first + 2; second < count; second += 1) {
      const secondNext = (second + 1) % count;
      if (first === 0 && secondNext === 0) continue;
      const intersection = segmentIntersection(
        points[first],
        points[firstNext],
        points[second],
        points[secondNext],
      );
      if (!intersection) continue;
      const trimmed = [intersection.clone()];
      let index = secondNext;
      while (index !== firstNext) {
        trimmed.push(points[index].clone());
        index = (index + 1) % count;
      }
      trimmed.push(intersection.clone());
      return {
        discardedPointCount: second - first,
        firstSegmentIndex: first,
        intersection,
        points: trimmed.slice(0, -1),
        secondSegmentIndex: second,
      };
    }
  }
  return {
    discardedPointCount: 0,
    firstSegmentIndex: null,
    intersection: null,
    points: points.map((point) => point.clone()),
    secondSegmentIndex: null,
  };
}

function groovedCamWoolComberRollerMotion(movementId) {
  const root = new THREE.Group();
  const outputPlateFocus = movementId === 218;

  // Brown's two consecutive plates show the face cam separately from the
  // rocker, catch, and notch wheel. They are reconstructed here as one
  // axially layered mechanism. The D pose matches plate 218.
  const camCenter = new THREE.Vector2(0, 0);
  const outputCenter = new THREE.Vector2(0, 3.25);
  const followerArmRadius = 1.95;
  const followerBaseAngle = THREE.MathUtils.degToRad(30);
  const catchPivotRadius = 1.86;
  const catchPivotBaseAngle = THREE.MathUtils.degToRad(187);
  const engagedHookRadius = 1.27;
  const engagedHookBaseAngle = THREE.MathUtils.degToRad(245);
  const catchTripBossRadiusFromOutput = 1.78;
  const catchTripBossBaseAngle = THREE.MathUtils.degToRad(210);
  const followerLocal = new THREE.Vector2(
    followerArmRadius * Math.cos(followerBaseAngle),
    followerArmRadius * Math.sin(followerBaseAngle),
  );
  const catchPivotLocal = new THREE.Vector2(
    catchPivotRadius * Math.cos(catchPivotBaseAngle),
    catchPivotRadius * Math.sin(catchPivotBaseAngle),
  );
  const engagedHookLocal = new THREE.Vector2(
    engagedHookRadius * Math.cos(engagedHookBaseAngle),
    engagedHookRadius * Math.sin(engagedHookBaseAngle),
  );
  const catchLinkLocal = engagedHookLocal.clone().sub(catchPivotLocal);
  const catchTripBossAbsoluteLocal = new THREE.Vector2(
    catchTripBossRadiusFromOutput * Math.cos(catchTripBossBaseAngle),
    catchTripBossRadiusFromOutput * Math.sin(catchTripBossBaseAngle),
  );
  const catchTripBossRelativeLocal = catchTripBossAbsoluteLocal
    .clone()
    .sub(catchPivotLocal);

  // These phase stations also reproduce the engraved cam orientation: e is
  // at twelve o'clock, C is lower-left, and D is the inner bottom cusp.
  const backwardEndPhase = 0.11;
  const forwardEndPhase = 0.55;
  const liftRiseEndPhase = forwardEndPhase + 0.025;
  const liftFallStartPhase = 0.93;
  const backwardAngle = -FULL_TURN / 3;
  const forwardAngleFromD = FULL_TURN * 2 / 3;
  const netOutputAdvance = FULL_TURN / 3;
  const catchLiftAngle = 0.35;
  const inputCycleDuration = 8;
  const inputTravelAngularSpeed = FULL_TURN / inputCycleDuration;
  const sourcePoseInputTravel = backwardEndPhase * FULL_TURN;

  const notchCount = 9;
  const notchPitchAngle = FULL_TURN / notchCount;
  const notchPhaseAngle = engagedHookBaseAngle;
  const notchWheelOuterRadius = 1.55;
  const catchHookRadius = 0.085;
  const notchRootRadius = engagedHookRadius - catchHookRadius - woolComberNotch.clearance;

  const grooveHalfWidth = 0.155;
  const followerRollerRadius = 0.12;
  const grooveRadialClearance = grooveHalfWidth - followerRollerRadius;
  const grooveSampleCount = 720;
  const camOuterRadius = 5.58;

  // The hinged hook leaves on an oblique arc, so radial notch flanks bind.
  // This offline milled envelope retains two driving flanks with small take-up;
  // playback still prescribes ideal output and catch lift, not passive dynamics.
  const cutters = Array.from({length: notchCount}, (_, index) => {
    const angle = notchPhaseAngle + index * notchPitchAngle;
    return poly(woolComberNotch.profile.map(([x, y]) => [
      x * Math.cos(angle) - y * Math.sin(angle),
      x * Math.sin(angle) + y * Math.cos(angle),
    ]));
  });
  const wheelOutline = polygonClipping.difference(poly(circle([0, 0], notchWheelOuterRadius, 384)), ...cutters);
  if (wheelOutline.length !== 1 || wheelOutline[0].length !== 1) throw new Error('Invalid wool-comber notch relief');
  const wheelPoints = wheelOutline[0][0].slice(0, -1).map(point => new THREE.Vector2(...point));
  const wheelEdges = wheelPoints.map((a, i) => {
    const b = wheelPoints[(i + 1) % wheelPoints.length], dx = b.x - a.x, dy = b.y - a.y;
    return {a, b, dx, dy, lengthSquared: dx * dx + dy * dy,
      notch: Math.min(a.length(), b.length()) < notchWheelOuterRadius - 1e-4};
  });
  // Measure the finite circle against every flank, not only the notch root.
  const hookClearanceInWheel = point => {
    let inside = false, squaredDistance = Infinity, nearestIsNotch = false;
    for (const {a, b, dx, dy, lengthSquared, notch} of wheelEdges) {
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
      const distance = (point.x - a.x - t * dx) ** 2 + (point.y - a.y - t * dy) ** 2;
      if (distance < squaredDistance) {squaredDistance = distance;nearestIsNotch = notch;}
      if ((a.y > point.y) !== (b.y > point.y) && point.x < dx * (point.y - a.y) / dy + a.x) inside = !inside;
    }
    return {clearance: (inside ? -1 : 1) * Math.sqrt(squaredDistance) - catchHookRadius,
      nearestIsNotch};
  };

  const rockerLawAtPhase = (phase) => {
    if (phase <= backwardEndPhase) {
      const parameter = phase / backwardEndPhase;
      return {
        angle: backwardAngle * quinticStep(parameter),
        derivative: backwardAngle
          * quinticStepDerivative(parameter) / backwardEndPhase,
        secondDerivative: backwardAngle
          * quinticStepSecondDerivative(parameter)
          / backwardEndPhase ** 2,
        segment: 'C-to-D-backward-one-third-turn',
        segmentParameter: parameter,
      };
    }
    if (phase <= forwardEndPhase) {
      const phaseSpan = forwardEndPhase - backwardEndPhase;
      const parameter = (phase - backwardEndPhase) / phaseSpan;
      return {
        angle: backwardAngle
          + forwardAngleFromD * quinticStep(parameter),
        derivative: forwardAngleFromD
          * quinticStepDerivative(parameter) / phaseSpan,
        secondDerivative: forwardAngleFromD
          * quinticStepSecondDerivative(parameter) / phaseSpan ** 2,
        segment: 'D-to-e-forward-two-thirds-turn',
        segmentParameter: parameter,
      };
    }
    const phaseSpan = 1 - forwardEndPhase;
    const parameter = (phase - forwardEndPhase) / phaseSpan;
    return {
      angle: netOutputAdvance * (1 - quinticStep(parameter)),
      derivative: -netOutputAdvance
        * quinticStepDerivative(parameter) / phaseSpan,
      secondDerivative: -netOutputAdvance
        * quinticStepSecondDerivative(parameter) / phaseSpan ** 2,
      segment: 'e-to-C-disengaged-return-dwell',
      segmentParameter: parameter,
    };
  };

  const catchLiftLawAtPhase = (phase) => {
    if (phase <= forwardEndPhase) {
      return { fraction: 0, derivative: 0, secondDerivative: 0 };
    }
    if (phase < liftRiseEndPhase) {
      const span = liftRiseEndPhase - forwardEndPhase;
      const parameter = (phase - forwardEndPhase) / span;
      return {
        derivative: quinticStepDerivative(parameter) / span,
        fraction: quinticStep(parameter),
        secondDerivative: quinticStepSecondDerivative(parameter) / span ** 2,
      };
    }
    if (phase <= liftFallStartPhase) {
      return { fraction: 1, derivative: 0, secondDerivative: 0 };
    }
    const span = 1 - liftFallStartPhase;
    const parameter = (phase - liftFallStartPhase) / span;
    return {
      derivative: -quinticStepDerivative(parameter) / span,
      fraction: 1 - quinticStep(parameter),
      secondDerivative: -quinticStepSecondDerivative(parameter) / span ** 2,
    };
  };

  const followerPointAtRockerAngle = (rockerAngle) => outputCenter
    .clone()
    .add(rotate2(followerLocal, rockerAngle));

  const rawGroovePointAtPhase = (phase) => {
    const rocker = rockerLawAtPhase(phase);
    return rotate2(
      followerPointAtRockerAngle(rocker.angle),
      phase * FULL_TURN,
    );
  };

  const rawGroovePointAtE = rawGroovePointAtPhase(forwardEndPhase);
  const grooveOrientationOffset = Math.PI / 2
    - Math.atan2(rawGroovePointAtE.y, rawGroovePointAtE.x);

  const groovePointAtPhase = (phase) => rotate2(
    rawGroovePointAtPhase(phase),
    grooveOrientationOffset,
  );

  const grooveDerivativeAtPhase = (phase) => {
    const rocker = rockerLawAtPhase(phase);
    const followerPoint = followerPointAtRockerAngle(rocker.angle);
    const followerRadiusVector = followerPoint.clone().sub(outputCenter);
    const followerDerivative = crossZ2(followerRadiusVector)
      .multiplyScalar(rocker.derivative);
    const rawDerivative = crossZ2(followerPoint)
      .multiplyScalar(FULL_TURN)
      .add(followerDerivative);
    return rotate2(
      rotate2(rawDerivative, phase * FULL_TURN),
      grooveOrientationOffset,
    );
  };

  const grooveCenterline = Array.from(
    { length: grooveSampleCount },
    (_, index) => groovePointAtPhase(index / grooveSampleCount),
  );
  const idealOuterWall = [];
  const innerWall = [];
  for (let index = 0; index < grooveSampleCount; index += 1) {
    const previous = grooveCenterline[
      (index - 1 + grooveSampleCount) % grooveSampleCount
    ];
    const next = grooveCenterline[(index + 1) % grooveSampleCount];
    const tangent = next.clone().sub(previous).normalize();
    const outwardNormal = new THREE.Vector2(tangent.y, -tangent.x);
    idealOuterWall.push(
      grooveCenterline[index].clone().addScaledVector(
        outwardNormal,
        grooveHalfWidth,
      ),
    );
    innerWall.push(
      grooveCenterline[index].clone().addScaledVector(
        outwardNormal,
        -grooveHalfWidth,
      ),
    );
  }
  const cutterEnvelope = trimSingleCutterUndercut(idealOuterWall);
  const outerWall = cutterEnvelope.points;

  const pointAtPhaseE = groovePointAtPhase(forwardEndPhase);
  const rockerAtPhaseE = rockerLawAtPhase(forwardEndPhase);
  const catchTripBossWorldAtE = outputCenter.clone().add(
    rotate2(catchTripBossAbsoluteLocal, rockerAtPhaseE.angle),
  );
  const tripLugRadius = 0.09;
  const tripRollerRadius = 0.09;
  const tripContactDistance = tripLugRadius + tripRollerRadius;
  const outwardAtTrip = catchTripBossWorldAtE.clone().normalize();
  const tripLugWorldAtE = catchTripBossWorldAtE.clone().addScaledVector(
    outwardAtTrip,
    tripContactDistance,
  );
  const driverAngleAtE = -grooveOrientationOffset
    - forwardEndPhase * FULL_TURN;
  const tripLugLocal = rotate2(tripLugWorldAtE, -driverAngleAtE);

  const stateAtInputTravel = (
    inputTravel,
    inputTravelSpeed = inputTravelAngularSpeed,
    inputTravelAcceleration = 0,
  ) => {
    const cycleIndex = Math.floor(inputTravel / FULL_TURN);
    const phaseTravel = positiveModulo(inputTravel, FULL_TURN);
    const phase = phaseTravel / FULL_TURN;
    const rocker = rockerLawAtPhase(phase);
    const catchLift = catchLiftLawAtPhase(phase);
    const phaseSpeed = inputTravelSpeed / FULL_TURN;
    const phaseAcceleration = inputTravelAcceleration / FULL_TURN;
    const rockerAngularSpeed = rocker.derivative * phaseSpeed;
    const rockerAngularAcceleration = rocker.secondDerivative
      * phaseSpeed ** 2 + rocker.derivative * phaseAcceleration;
    const catchLiftSpeed = catchLift.derivative * phaseSpeed;
    const catchLiftAcceleration = catchLift.secondDerivative
      * phaseSpeed ** 2 + catchLift.derivative * phaseAcceleration;
    const catchEngaged = phase <= forwardEndPhase;
    const outputAngle = catchEngaged
      ? cycleIndex * netOutputAdvance + rocker.angle
      : (cycleIndex + 1) * netOutputAdvance;
    const outputAngularSpeed = catchEngaged ? rockerAngularSpeed : 0;
    const outputAngularAcceleration = catchEngaged
      ? rockerAngularAcceleration
      : 0;
    const driverAngle = -grooveOrientationOffset - inputTravel;
    const driverAngularSpeed = -inputTravelSpeed;
    const driverAngularAcceleration = -inputTravelAcceleration;

    const followerWorld = followerPointAtRockerAngle(rocker.angle);
    const grooveLocal = groovePointAtPhase(phase);
    const grooveWorld = rotate2(grooveLocal, driverAngle);
    const grooveTangentWorld = rotate2(
      grooveDerivativeAtPhase(phase),
      driverAngle,
    );
    const followerRadiusVector = followerWorld.clone().sub(outputCenter);
    const followerVelocity = crossZ2(followerRadiusVector)
      .multiplyScalar(rockerAngularSpeed);
    const camSurfaceVelocity = crossZ2(followerWorld)
      .multiplyScalar(driverAngularSpeed);
    const relativeFollowerVelocity = followerVelocity.clone().sub(
      camSurfaceVelocity,
    );
    const grooveNormalWorld = new THREE.Vector2(
      -grooveTangentWorld.y,
      grooveTangentWorld.x,
    ).normalize();

    const catchPivotWorld = outputCenter.clone().add(
      rotate2(catchPivotLocal, rocker.angle),
    );
    const catchAngle = rocker.angle
      - catchLiftAngle * catchLift.fraction;
    const catchHookWorld = catchPivotWorld.clone().add(
      rotate2(catchLinkLocal, catchAngle),
    );
    const catchTripBossWorld = catchPivotWorld.clone().add(
      rotate2(catchTripBossRelativeLocal, catchAngle),
    );
    const catchHookFromOutput = catchHookWorld.clone().sub(outputCenter);
    const catchHookPolarAngle = Math.atan2(
      catchHookFromOutput.y,
      catchHookFromOutput.x,
    );
    const catchHookPolarRadius = catchHookFromOutput.length();
    let nearestNotchAngularDifference = Infinity;
    let nearestNotchIndex = 0;
    for (let index = 0; index < notchCount; index += 1) {
      const notchAngle = notchPhaseAngle + outputAngle
        + index * notchPitchAngle;
      const difference = signedAngularDifference(
        catchHookPolarAngle,
        notchAngle,
      );
      if (Math.abs(difference) < Math.abs(nearestNotchAngularDifference)) {
        nearestNotchAngularDifference = difference;
        nearestNotchIndex = index;
      }
    }
    const finiteHook = hookClearanceInWheel(rotate2(catchHookFromOutput, -outputAngle));
    const hookWithinNotchOpening = finiteHook.nearestIsNotch;
    const catchSolidClearance = finiteHook.clearance;

    const tripLugWorld = rotate2(tripLugLocal, driverAngle);
    const tripSeparation = tripLugWorld.distanceTo(catchTripBossWorld);
    return {
      camSurfaceVelocity,
      catchAngle,
      catchAngularAcceleration: rockerAngularAcceleration
        - catchLiftAngle * catchLiftAcceleration,
      catchAngularSpeed: rockerAngularSpeed
        - catchLiftAngle * catchLiftSpeed,
      catchEngaged,
      catchHookPolarAngle,
      catchHookPolarRadius,
      catchHookWorld,
      catchLiftFraction: catchLift.fraction,
      catchPivotWorld,
      catchSolidClearance,
      catchTripBossWorld,
      cycleIndex,
      driverAngle,
      driverAngularAcceleration,
      driverAngularSpeed,
      followerVelocity,
      followerWorld,
      grooveConstraintError: followerWorld.distanceTo(grooveWorld),
      grooveLocal,
      grooveNormalVelocityError: relativeFollowerVelocity.dot(
        grooveNormalWorld,
      ),
      grooveNormalWorld,
      grooveTangentWorld,
      grooveWorld,
      hookWithinNotchOpening,
      inputTravel,
      inputTravelAcceleration,
      inputTravelSpeed,
      nearestNotchAngularDifference,
      nearestNotchIndex,
      outputAngle,
      outputAngularAcceleration,
      outputAngularSpeed,
      phase,
      phaseTravel,
      relativeFollowerVelocity,
      rockerAngle: rocker.angle,
      rockerAngularAcceleration,
      rockerAngularSpeed,
      segment: rocker.segment,
      segmentParameter: rocker.segmentParameter,
      tripClearance: tripSeparation - tripContactDistance,
      tripContact: tripSeparation <= tripContactDistance + 1e-9,
      tripLugWorld,
      tripSeparation,
    };
  };

  // Plate 218 is drawn at D; plate 217 draws the cam alone with e at twelve
  // o'clock, so 217 starts from that cam orientation.
  const displayStartInputTravel = outputPlateFocus
    ? sourcePoseInputTravel
    : positiveModulo(-grooveOrientationOffset, FULL_TURN);
  const stateAtTime = (time) => stateAtInputTravel(
    displayStartInputTravel + inputTravelAngularSpeed * time,
    inputTravelAngularSpeed,
    0,
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.62,
  });
  const grooveFloorMaterial = matte(0xa94734, {
    metalness: 0.1,
    roughness: 0.72,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.63,
  });
  const catchMaterial = matte(PALETTE.accent, {
    metalness: 0.18,
    roughness: 0.57,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.51,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });
  const grooveLineMaterial = new THREE.LineBasicMaterial({
    color: PALETTE.ink,
  });

  const camRotor = new THREE.Group();
  camRotor.userData.role = 'clockwise-grooved-heart-cam-C-D-B-e';
  root.add(camRotor);

  const camFloorDepth = 0.16;
  const camFloor = cylinderAlongZ(
    camOuterRadius,
    camFloorDepth,
    grooveFloorMaterial,
    160,
  );
  camFloor.position.z = -camFloorDepth / 2;
  camFloor.userData.role = 'continuous-groove-floor-and-rear-carrier';
  camRotor.add(camFloor);

  const camLandDepth = 0.22;
  const outerLandShape = shapeFromPoints(circlePoints(camOuterRadius));
  outerLandShape.holes.push(pathFromPoints([...outerWall].reverse()));
  const outerLand = extrudedShape(
    outerLandShape,
    camLandDepth,
    camLandDepth / 2,
    driverMaterial,
  );
  outerLand.userData.role = 'outer-heart-cam-land-with-actual-groove-hole';
  camRotor.add(outerLand);

  const innerIsland = extrudedShape(
    shapeFromPoints(innerWall),
    camLandDepth,
    camLandDepth / 2,
    driverMaterial,
  );
  innerIsland.userData.role = 'central-heart-cam-island';
  camRotor.add(innerIsland);
  camRotor.add(lineLoop(outerWall, camLandDepth + 0.002, grooveLineMaterial));
  camRotor.add(lineLoop(innerWall, camLandDepth + 0.002, grooveLineMaterial));

  const camShaft = cylinderAlongZ(0.22, 1.18, darkMaterial, 40);
  camShaft.position.z = -0.20;
  camShaft.userData.role = 'cam-input-shaft';
  camRotor.add(camShaft);

  const camIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.72, 0.035),
    whiteMaterial,
  );
  camIndex.position.set(0, camOuterRadius - 0.46, camLandDepth + 0.035);
  camIndex.userData.role = 'cam-rotation-index-at-e';
  camRotor.add(camIndex);

  const tripLug = cylinderAlongZ(
    tripLugRadius,
    0.13,
    driverMaterial,
    28,
  );
  tripLug.position.set(tripLugLocal.x, tripLugLocal.y, 0.315);
  tripLug.userData.role = 'rear-projection-lifting-catch-at-e';
  camRotor.add(tripLug);

  const outputRotor = new THREE.Group();
  outputRotor.position.set(outputCenter.x, outputCenter.y, 0);
  outputRotor.userData.role = 'F-nine-notch-detaching-roller-wheel';
  root.add(outputRotor);

  const wheelShape = shapeFromPoints(wheelPoints);
  const wheelBoreRadius = 0.25;
  wheelShape.holes.push(pathFromPoints(circlePoints(wheelBoreRadius, 64)));
  const wheelDepth = 0.22;
  // Plate 218 puts the rocker in front of F so its complete curved outline is
  // inspectable. Plate 217 keeps that rocker behind F to expose cam A.
  const wheelCenterZ = outputPlateFocus ? 0.25 : 0.78;
  const notchWheel = extrudedShape(
    wheelShape,
    wheelDepth,
    wheelCenterZ,
    drivenMaterial,
  );
  notchWheel.userData.role = 'F-solid-nine-notch-wheel';
  outputRotor.add(notchWheel);

  const outputHub = cylinderAlongZ(0.39, 0.40, darkMaterial, 40);
  outputHub.position.z = wheelCenterZ;
  outputHub.userData.role = 'F-wheel-hub';
  outputRotor.add(outputHub);
  const outputHubRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.055, 12, 48),
    whiteMaterial,
  );
  outputHubRing.position.z = wheelCenterZ + wheelDepth / 2 + 0.075;
  outputHubRing.userData.role = 'H-source-face-bearing-ring';
  outputRotor.add(outputHubRing);
  const outputShaft = cylinderAlongZ(0.16, 1.62, darkMaterial, 36);
  outputShaft.position.z = 0.34;
  outputShaft.userData.role = 'H-detaching-roller-shaft';
  outputRotor.add(outputShaft);
  const wheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.74, 0.09, 0.035),
    whiteMaterial,
  );
  wheelIndex.position.set(0.73, 0, wheelCenterZ + wheelDepth / 2 + 0.025);
  wheelIndex.userData.role = 'F-wheel-rotation-index';
  outputRotor.add(wheelIndex);

  const rocker = new THREE.Group();
  rocker.position.set(outputCenter.x, outputCenter.y, 0);
  rocker.userData.role = 'A-follower-rocker-about-H';
  root.add(rocker);
  const rockerNormal = new THREE.Vector2(
    -Math.sin(followerBaseAngle),
    Math.cos(followerBaseAngle),
  );
  const rockerMidpoint = followerLocal.clone()
    .add(catchPivotLocal)
    .multiplyScalar(0.5)
    .addScaledVector(rockerNormal, 0.34);
  const rockerBody = curvedTube2D(
    [followerLocal, rockerMidpoint, catchPivotLocal],
    0.51,
    0.12,
    drivenMaterial,
  );
  rockerBody.userData.role = 'curved-rocker-link-A-to-G';
  rocker.add(rockerBody);

  const followerRoller = cylinderAlongZ(
    followerRollerRadius,
    0.39,
    whiteMaterial,
    36,
  );
  followerRoller.position.set(followerLocal.x, followerLocal.y, 0.31);
  followerRoller.userData.role = 'A-stud-running-inside-real-groove';
  rocker.add(followerRoller);
  const followerAxle = cylinderAlongZ(0.055, 0.55, darkMaterial, 24);
  followerAxle.position.set(followerLocal.x, followerLocal.y, 0.40);
  followerAxle.userData.role = 'A-follower-axle';
  rocker.add(followerAxle);

  const rockerPivot = cylinderAlongZ(0.27, 0.20, darkMaterial, 36);
  rockerPivot.position.z = 0.52;
  rockerPivot.userData.role = 'rocker-bearing-about-H';
  rocker.add(rockerPivot);
  const catchPivotBearing = cylinderAlongZ(0.15, 0.25, darkMaterial, 32);
  catchPivotBearing.position.set(
    catchPivotLocal.x,
    catchPivotLocal.y,
    1.02,
  );
  catchPivotBearing.userData.role = 'hinged-catch-G-pivot';
  rocker.add(catchPivotBearing);
  const catchPivotRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.17, 0.035, 10, 40),
    whiteMaterial,
  );
  catchPivotRing.position.set(
    catchPivotLocal.x,
    catchPivotLocal.y,
    1.17,
  );
  catchPivotRing.userData.role = 'G-hinge-source-face-ring';
  rocker.add(catchPivotRing);

  const followerSourceRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.04, 10, 40),
    darkMaterial,
  );
  followerSourceRing.position.set(
    followerLocal.x,
    followerLocal.y,
    0.69,
  );
  followerSourceRing.userData.role = 'A-source-face-ring';
  followerSourceRing.visible = outputPlateFocus;
  rocker.add(followerSourceRing);

  const catchLink = new THREE.Group();
  catchLink.userData.role = 'hinged-catch-G';
  root.add(catchLink);
  const catchBar = curvedTube2D(
    [
      new THREE.Vector2(0, 0),
      catchTripBossRelativeLocal,
      catchLinkLocal,
    ],
    1.05,
    0.095,
    catchMaterial,
  );
  catchBar.userData.role = 'catch-G-curved-arm';
  catchLink.add(catchBar);
  const hookTongueEndLocal = catchLinkLocal.clone().addScaledVector(
    engagedHookLocal.clone().normalize(),
    -0.25,
  );
  const catchHookTongue = tubeBetween2D(
    catchLinkLocal,
    hookTongueEndLocal,
    1.05,
    catchHookRadius,
    darkMaterial,
  );
  catchHookTongue.userData.role = 'G-visible-hook-tongue';
  catchLink.add(catchHookTongue);
  const catchHookLength = outputPlateFocus ? 0.94 : 0.38;
  const catchHookCenterZ = outputPlateFocus ? 0.65 : 0.90;
  const catchHook = cylinderAlongZ(
    catchHookRadius,
    catchHookLength,
    darkMaterial,
    28,
  );
  catchHook.position.set(
    catchLinkLocal.x,
    catchLinkLocal.y,
    catchHookCenterZ,
  );
  catchHook.userData.role = 'catch-G-hook-entering-F-notch';
  catchLink.add(catchHook);
  const tripRollerLength = outputPlateFocus ? 0.24 : 0.82;
  const tripRollerCenterZ = outputPlateFocus ? 1.05 : 0.68;
  const tripRoller = cylinderAlongZ(
    tripRollerRadius,
    tripRollerLength,
    catchMaterial,
    28,
  );
  tripRoller.position.set(
    catchTripBossRelativeLocal.x,
    catchTripBossRelativeLocal.y,
    tripRollerCenterZ,
  );
  tripRoller.userData.role = 'G-catch-trip-boss-struck-at-e';
  catchLink.add(tripRoller);
  const catchIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 18, 12),
    whiteMaterial,
  );
  catchIndex.position.set(catchLinkLocal.x, catchLinkLocal.y, 1.11);
  catchIndex.userData.role = 'catch-contact-index';
  catchLink.add(catchIndex);

  const followerContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 18, 12),
    whiteMaterial,
  );
  followerContactMarker.position.z = 0.54;
  followerContactMarker.userData.role = 'groove-contact-marker';
  root.add(followerContactMarker);
  const catchContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 18, 12),
    whiteMaterial,
  );
  catchContactMarker.position.z = wheelCenterZ + wheelDepth / 2 + 0.04;
  catchContactMarker.userData.role = 'engaged-notch-contact-marker';
  root.add(catchContactMarker);
  const tripContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 10),
    whiteMaterial,
  );
  tripContactMarker.position.z = 0.40;
  tripContactMarker.userData.role = 'trip-contact-at-e-marker';
  root.add(tripContactMarker);

  const frameZ = -0.53;
  const upperBearing = cylinderAlongZ(0.46, 0.24, frameMaterial, 40);
  upperBearing.position.set(outputCenter.x, outputCenter.y, frameZ);
  upperBearing.userData.role = 'H-frame-bearing';
  root.add(upperBearing);
  const lowerBearing = cylinderAlongZ(0.42, 0.24, frameMaterial, 40);
  lowerBearing.position.set(camCenter.x, camCenter.y, frameZ);
  lowerBearing.userData.role = 'cam-frame-bearing';
  root.add(lowerBearing);
  const framePost = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 8.6, 0.26),
    frameMaterial,
  );
  framePost.position.set(-5.98, 0.45, frameZ - 0.02);
  framePost.userData.role = 'rear-frame-post';
  root.add(framePost);
  const frameTop = new THREE.Mesh(
    new THREE.BoxGeometry(6.15, 0.28, 0.26),
    frameMaterial,
  );
  frameTop.position.set(-2.96, 5.02, frameZ - 0.02);
  frameTop.userData.role = 'rear-frame-top';
  root.add(frameTop);
  const frameBase = new THREE.Mesh(
    new THREE.BoxGeometry(12.25, 0.34, 0.42),
    frameMaterial,
  );
  frameBase.position.set(0, -5.94, frameZ - 0.08);
  frameBase.userData.role = 'base';
  root.add(frameBase);

  if (outputPlateFocus) {
    camRotor.visible = false;
    lowerBearing.visible = false;
    upperBearing.visible = false;
    framePost.visible = false;
    frameTop.visible = false;
    frameBase.visible = false;
    // The hidden companion cam remains in the scene so its exact conjugate
    // state and resources stay available, while camera fitting follows only
    // the components actually engraved on plate 218.
    root.userData.cameraFitBounds = new THREE.Box3(
      new THREE.Vector3(-2.35, 0.82, -0.18),
      new THREE.Vector3(2.35, 5.62, 1.24),
    );
  }

  const timeToTravel = (travel) => positiveModulo(
    travel - displayStartInputTravel,
    FULL_TURN,
  ) / inputTravelAngularSpeed;
  const canonicalTimes = Object.freeze({
    sourcePoseD: timeToTravel(sourcePoseInputTravel),
    midForward: timeToTravel((backwardEndPhase + forwardEndPhase) / 2 * FULL_TURN),
    eCatchRelease: timeToTravel(forwardEndPhase * FULL_TURN),
    midDwellReturn: timeToTravel((forwardEndPhase + 1) / 2 * FULL_TURN),
    nextCReengagement: timeToTravel(FULL_TURN) || inputCycleDuration,
    nextD: timeToTravel(sourcePoseInputTravel) + inputCycleDuration,
  });

  const blocks = {
    camFloor,
    camIndex,
    camRotor,
    camShaft,
    catchContactMarker,
    catchBar,
    catchHook,
    catchHookTongue,
    catchIndex,
    catchLink,
    catchPivotBearing,
    catchPivotRing,
    followerContactMarker,
    followerRoller,
    followerSourceRing,
    frameBase,
    framePost,
    frameTop,
    innerIsland,
    lowerBearing,
    notchWheel,
    outerLand,
    outputRotor,
    outputShaft,
    outputHubRing,
    rocker,
    rockerBody,
    tripContactMarker,
    tripLug,
    tripRoller,
    upperBearing,
    wheelIndex,
  };

  const solidClearanceAtInputTravel = (inputTravel) => {
    const state = stateAtInputTravel(inputTravel, 0, 0);
    return {
      catchSolidClearance: state.catchSolidClearance,
      followerToEachGrooveWallClearance: grooveRadialClearance,
      rockerToWheelAxialClearance: outputPlateFocus
        ? 0.51 - 0.12 - (wheelCenterZ + wheelDepth / 2)
        : wheelCenterZ - wheelDepth / 2 - (0.51 + 0.12),
      tripClearance: state.tripClearance,
    };
  };

  root.userData.archetype = outputPlateFocus
    ? 'rocking-lever-hinged-catch-nine-notch-wool-comber-roller-output'
    : 'grooved-heart-cam-rocker-lifted-catch-nine-notch-detaching-roller';
  root.userData.blocks = blocks;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.fidelity = 'authored';
  // The suspended cam extends below the default floor plane.
  root.userData.hideGround = true;
  root.userData.geometry = {
    camCenter,
    camLandDepth,
    camOuterRadius,
    catchHookRadius,
    catchHookCenterZ,
    catchHookLength,
    catchLinkLocal,
    catchPivotBaseAngle,
    catchPivotLocal,
    catchPivotRadius,
    catchTripBossAbsoluteLocal,
    catchTripBossBaseAngle,
    catchTripBossRelativeLocal,
    catchTripBossRadiusFromOutput,
    cutterEnvelopeDiscardedPointCount: cutterEnvelope.discardedPointCount,
    cutterEnvelopeFirstSegmentIndex: cutterEnvelope.firstSegmentIndex,
    cutterEnvelopeIntersection: cutterEnvelope.intersection,
    cutterEnvelopeSecondSegmentIndex: cutterEnvelope.secondSegmentIndex,
    engagedHookLocal,
    engagedHookRadius,
    followerArmRadius,
    followerLocal,
    followerRollerRadius,
    grooveCenterline,
    grooveHalfWidth,
    grooveOrientationOffset,
    grooveRadialClearance,
    idealOuterWall,
    innerWall,
    notchCount,
    notchPhaseAngle,
    notchPitchAngle,
    notchRootRadius,
    notchReliefClearance: woolComberNotch.clearance,
    notchReliefProfile: woolComberNotch.profile,
    wheelPoints,
    notchWheelOuterRadius,
    outerWall,
    outputCenter,
    outputPlateFocus,
    pointAtPhaseE,
    tripContactDistance,
    tripLugLocal,
    tripLugRadius,
    tripRollerRadius,
    wheelCenterZ,
    wheelDepth,
  };
  root.userData.mechanism =
    'clockwise grooved heart cam C-D-e; A-rocker; hinged catch G; '
    + 'nine-notch wheel F on detaching-roller shaft H';
  root.userData.motion = {
    backwardAngle,
    backwardEndPhase,
    catchLiftAngle,
    forwardAngleFromD,
    forwardEndPhase,
    inputCycleDuration,
    inputTravelAngularSpeed,
    liftFallStartPhase,
    liftRiseEndPhase,
    netOutputAdvance,
    sourcePoseInputTravel,
  };
  root.userData.notchCountRationale =
    'Brown draws the notch wheel schematically. Nine equally spaced notches '
    + 'are the smallest visually similar count for which the stated net '
    + 'one-third-turn advance closes on an integer three-notch pitch.';
  root.userData.sourceAnimation = {
    available: false,
    durationSeconds: inputCycleDuration,
    sourcePose: 'D-reversal-with-A-below-H-and-G-in-upper-left-notch',
    sourceUrl: `https://507movements.com/mm_${movementId}.html`,
  };
  root.userData.sourceReference = {
    companionPlateUrl: outputPlateFocus
      ? 'https://507movements.com/mm_217.html'
      : 'https://507movements.com/mm_218.html',
    historicalCrossCheck:
      'Fig. 125 cotton-comber notch-wheel motion: grooved cam, lever, '
      + 'hinged finger, and separate finger-lift cam.',
    plate217: {
      height: 525,
      rasterCamCenter: new THREE.Vector2(265, 268),
      rasterC: new THREE.Vector2(180, 314),
      rasterD: new THREE.Vector2(266, 336),
      rasterE: new THREE.Vector2(267, 43),
      width: 525,
    },
    plate218: {
      height: 525,
      rasterCatchPivot: new THREE.Vector2(350, 63),
      rasterCatchTripBoss: new THREE.Vector2(267, 50),
      rasterFollowerA: new THREE.Vector2(241, 492),
      rasterHookContact: new THREE.Vector2(160, 105),
      rasterOutputCenterH: new THREE.Vector2(264, 264),
      rasterWheelOuterRadius: 185,
      schematicVisibleNotchCount: 8,
      width: 525,
    },
  };
  root.userData.presentation = {
    companionDriverVisible: !outputPlateFocus,
    focus: outputPlateFocus
      ? 'plate-218-output-rocker-catch-and-notch-wheel'
      : 'plate-217-grooved-heart-cam-and-complete-transmission',
    plate: movementId,
  };
  root.userData.sharedMechanismKey = 'brown-217-218-wool-comber-roller';
  root.userData.grooveDerivativeAtPhase = grooveDerivativeAtPhase;
  root.userData.groovePointAtPhase = groovePointAtPhase;
  root.userData.rockerLawAtPhase = rockerLawAtPhase;
  root.userData.solidClearanceAtInputTravel =
    solidClearanceAtInputTravel;
  root.userData.stateAtInputTravel = stateAtInputTravel;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    camRotor.rotation.z = state.driverAngle;
    outputRotor.rotation.z = state.outputAngle;
    rocker.rotation.z = state.rockerAngle;
    catchLink.position.set(
      state.catchPivotWorld.x,
      state.catchPivotWorld.y,
      0,
    );
    catchLink.rotation.z = state.catchAngle;
    followerContactMarker.position.x = state.followerWorld.x;
    followerContactMarker.position.y = state.followerWorld.y;
    catchContactMarker.position.x = state.catchHookWorld.x;
    catchContactMarker.position.y = state.catchHookWorld.y;
    catchContactMarker.visible = state.catchEngaged;
    tripContactMarker.position.x = (
      state.tripLugWorld.x + state.catchTripBossWorld.x
    ) / 2;
    tripContactMarker.position.y = (
      state.tripLugWorld.y + state.catchTripBossWorld.y
    ) / 2;
    tripContactMarker.visible = !outputPlateFocus && state.tripContact;
    camRotor.userData.angularSpeed = state.driverAngularSpeed;
    outputRotor.userData.angularSpeed = state.outputAngularSpeed;
    rocker.userData.angularSpeed = state.rockerAngularSpeed;
    catchLink.userData.angularSpeed = state.catchAngularSpeed;
    root.userData.contacts = {
      catchToNotch: state.catchEngaged
        ? {
          angularError: state.nearestNotchAngularDifference,
          notchIndex: state.nearestNotchIndex,
          point: state.catchHookWorld,
        }
        : null,
      followerToGroove: {
        constraintError: state.grooveConstraintError,
        point: state.followerWorld,
      },
      tripAtE: state.tripContact
        ? {
          clearance: state.tripClearance,
          point: state.tripLugWorld.clone().add(
            state.catchTripBossWorld,
          ).multiplyScalar(0.5),
        }
        : null,
    };
    root.userData.kinematics = state;
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
  for (const marker of [
    camIndex,
    catchContactMarker,
    catchIndex,
    followerContactMarker,
    tripContactMarker,
    wheelIndex,
  ]) {
    marker.castShadow = false;
    marker.receiveShadow = false;
  }
  return {
    cameraDirection: outputPlateFocus
      ? new THREE.Vector3(5.2, 2.8, 14.5)
      : new THREE.Vector3(7.8, 4.8, 15.5),
    root,
    update,
  };
}

export function createAuthoredWoolComberMovement(movement) {
  switch (movement.id) {
    case 217:
    case 218:
      return groovedCamWoolComberRollerMotion(movement.id);
    default: return null;
  }
}
