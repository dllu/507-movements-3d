import * as THREE from 'three';
import {capsule, circle, poly, polygonClipping} from './finite-plate-geometry.js';
import {woolComberNotch} from '../data/wool-comber-notch.js';
import {createHeartCam217} from './heart-cam-217.js';
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

function flatBandShape(controlPoints, halfWidth, extras = [], holes = []) {
  const path = new THREE.CatmullRomCurve3(
    controlPoints.map((point) => new THREE.Vector3(point.x, point.y, 0)),
  ).getPoints(96);
  const sideA = [];
  const sideB = [];
  path.forEach((point, index) => {
    const next = path[Math.min(index + 1, path.length - 1)];
    const previous = path[Math.max(index - 1, 0)];
    const tangent = new THREE.Vector2(next.x - previous.x, next.y - previous.y).normalize();
    sideA.push([point.x - tangent.y * halfWidth, point.y + tangent.x * halfWidth]);
    sideB.push([point.x + tangent.y * halfWidth, point.y - tangent.x * halfWidth]);
  });
  const outline = polygonClipping.union(poly([...sideA, ...sideB.reverse()]), ...extras);
  if (outline.length !== 1) throw new Error('Flat wool-comber band must be one piece');
  const shape = shapeFromPoints(outline[0][0].slice(0, -1).map((point) => new THREE.Vector2(...point)));
  for (const {center, radius} of holes) {
    shape.holes.push(pathFromPoints(circlePoints(radius, 48).map((point) => point.clone().add(center)).reverse()));
  }
  return {path, shape};
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
  // Plate 218 draws eight notches. Its roller turns 3/8 back and 3/4 forward
  // (the caption's 1:2 ratio), so the net 3/8 advance is three of Brown's
  // eight notches; 217, which draws no notch wheel, keeps the caption's 1/3.
  // The rocker parts are turned by the 15-degree difference so the D pose
  // (plate 218) is unchanged.
  const indexFraction = outputPlateFocus ? 3 / 8 : 1 / 3;
  const rockerBaseOffset = (indexFraction - 1 / 3) * FULL_TURN;
  const followerBaseAngle = THREE.MathUtils.degToRad(30) + rockerBaseOffset;
  const catchPivotRadius = 1.86;
  const catchPivotBaseAngle = THREE.MathUtils.degToRad(187) + rockerBaseOffset;
  // Brown seats G's lug in a shallow notch at F's rim (plate 218 hook contact at
  // 1.03 rim radii); the hook runs just inside the rim so the notches stay shallow.
  const engagedHookRadius = 1.47;
  const engagedHookBaseAngle = THREE.MathUtils.degToRad(245) + rockerBaseOffset;
  const catchTripBossRadiusFromOutput = 1.78;
  const catchTripBossBaseAngle = THREE.MathUtils.degToRad(210) + rockerBaseOffset;
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
  const liftFallStartPhase = outputPlateFocus ? 0.95 : 0.93;
  const backwardAngle = -FULL_TURN * indexFraction;
  const forwardAngleFromD = FULL_TURN * 2 * indexFraction;
  const netOutputAdvance = FULL_TURN * indexFraction;
  const catchLiftAngle = 0.35;
  const inputCycleDuration = 8;
  const inputTravelAngularSpeed = FULL_TURN / inputCycleDuration;
  const sourcePoseInputTravel = backwardEndPhase * FULL_TURN;

  const notchCount = outputPlateFocus ? 8 : 9;
  const notchPitchAngle = FULL_TURN / notchCount;
  const notchPhaseAngle = engagedHookBaseAngle;
  const notchWheelOuterRadius = 1.55;
  const catchHookRadius = 0.09;
  // Length of 218's straight lug from its rounded tip to the bar's centreline.
  const catchLugLength = 0.32;
  const notchRootRadius = engagedHookRadius - catchHookRadius - woolComberNotch.clearance;
  // p99 (218): Brown draws G's lug and F's notches square. The lug is a
  // straight bar (half-width catchHookRadius) with a flat end through the old
  // round tip's lowest point and small rounded corners; its axis is the tip's
  // release direction (square to the hinge radius), so lifting draws it
  // straight out. F's notches are milled to its envelope (square218 below).
  const lugCornerRadius = 0.025;
  const lugRadial = new THREE.Vector2(catchLinkLocal.y, -catchLinkLocal.x).normalize();
  if (lugRadial.dot(engagedHookLocal) < 0) lugRadial.negate();
  const lugOutboard = new THREE.Vector2(lugRadial.y, -lugRadial.x);
  if (lugOutboard.dot(catchLinkLocal) < 0) lugOutboard.negate();
  // Rounded-rectangle lug outline in G's frame (origin at the hinge), from
  // `length` above the tip centre down round the flat end; `inflate` grows it.
  const lugOutline = (length, inflate = 0, arcSamples = 12, flatSamples = 24) => {
    const half = catchHookRadius + inflate, corner = lugCornerRadius + inflate;
    const at = (along, across) => catchLinkLocal.clone()
      .addScaledVector(lugRadial, along).addScaledVector(lugOutboard, across);
    const points = [at(length, half)];
    const cornerAlong = -catchHookRadius + lugCornerRadius;
    const cornerAcross = catchHookRadius - lugCornerRadius;
    for (const side of [1, -1]) {
      for (let i = 0; i <= arcSamples; i += 1) {
        const angle = side > 0 ? Math.PI / 2 * i / arcSamples : Math.PI / 2 + Math.PI / 2 * i / arcSamples;
        points.push(at(cornerAlong - corner * Math.sin(angle), side * cornerAcross + corner * Math.cos(angle)));
      }
      if (side > 0) for (let i = 1; i < flatSamples; i += 1) {
        points.push(at(-half, cornerAcross - 2 * cornerAcross * i / flatSamples));
      }
    }
    points.push(at(length, -half));
    return points;
  };
  const lugTipLocal = outputPlateFocus ? lugOutline(0.2) : null;

  const grooveHalfWidth = 0.155;
  const followerRollerRadius = 0.12;
  const grooveRadialClearance = grooveHalfWidth - followerRollerRadius;
  const grooveSampleCount = 720;
  const camOuterRadius = 5.58;

  // The hinged hook leaves on an oblique arc, so radial notch flanks bind.
  // This offline milled envelope retains two driving flanks with small take-up;
  // playback still prescribes ideal output and catch lift, not passive dynamics.
  const notchProfile = outputPlateFocus && woolComberNotch.square218
    ? woolComberNotch.square218
    : woolComberNotch.profile;
  const cutters = Array.from({length: notchCount}, (_, index) => {
    const angle = notchPhaseAngle + index * notchPitchAngle;
    return poly(notchProfile.map(([x, y]) => [
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
  // 218: the square lug's signed clearance to F's outline, from its sampled
  // tip outline placed by G's hinge (in F's frame) and G's angle relative to F.
  const lugClearanceInWheel = (pivot, angle) => {
    const reach = catchLinkLocal.length() + 0.45;
    const edges = wheelEdges.filter(({a}) => a.distanceTo(pivot) < reach);
    let clearance = Infinity, nearestIsNotch = false;
    for (const local of lugTipLocal) {
      const point = rotate2(local, angle).add(pivot);
      let inside = false, squaredDistance = Infinity, notch = false;
      const ray = point.clone().normalize();
      for (const {a, dx, dy, lengthSquared, notch: edgeNotch} of edges) {
        const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
        const distance = (point.x - a.x - t * dx) ** 2 + (point.y - a.y - t * dy) ** 2;
        if (distance < squaredDistance) {squaredDistance = distance;notch = edgeNotch;}
        // Parity along the outward radial ray, which only meets F's outline
        // beside the point (all such edges lie within reach).
        const denominator = ray.x * dy - ray.y * dx;
        if (Math.abs(denominator) > 1e-15) {
          const ax = a.x - point.x, ay = a.y - point.y;
          const along = (ax * dy - ay * dx) / denominator, u = (ax * ray.y - ay * ray.x) / denominator;
          if (along > 0 && u >= 0 && u < 1) inside = !inside;
        }
      }
      const signed = (inside ? -1 : 1) * Math.sqrt(squaredDistance);
      if (signed < clearance) {clearance = signed;nearestIsNotch = notch;}
    }
    return {clearance, nearestIsNotch};
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
    // p99 (218): the rocker holds still while G lifts out at e and while it
    // drops in at C, so the square lug moves only about its hinge, along its
    // own axis, and F's notches stay square on both flanks.
    const returnStart = outputPlateFocus ? liftRiseEndPhase : forwardEndPhase;
    const returnEnd = outputPlateFocus ? liftFallStartPhase : 1;
    if (phase <= returnStart || phase >= returnEnd) {
      return {
        angle: phase <= returnStart ? netOutputAdvance : 0,
        derivative: 0,
        secondDerivative: 0,
        segment: 'e-to-C-disengaged-return-dwell',
        segmentParameter: phase <= returnStart ? 0 : 1,
      };
    }
    const phaseSpan = returnEnd - returnStart;
    const parameter = (phase - returnStart) / phaseSpan;
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

  // p96 (218): once the rear projection has raised G out of the notch at e,
  // G does not hang in the air: as the caption says, it "is passing over the
  // plain surface between the two notches". Its lug's round tip rests on F's
  // rim (0.0005 running clearance) from lift to drop, so the dwell lift is
  // the angle at which the tip circle clears the rim, not a free 0.35 park.
  // (217 keeps its own law.)
  const catchRideRadius = notchWheelOuterRadius + catchHookRadius + 0.0005;
  const catchHookRadiusAtLift = (lift) => (outputPlateFocus
    ? Math.min(...lugTipLocal.map((point) => catchPivotLocal.clone().add(rotate2(point, -lift)).length()))
      + catchHookRadius
    : catchPivotLocal.clone().add(rotate2(catchLinkLocal, -lift)).length());
  let catchRideFraction = 1;
  if (outputPlateFocus) {
    let low = 0, high = catchLiftAngle;
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const middle = (low + high) / 2;
      if (catchHookRadiusAtLift(middle) < catchRideRadius) low = middle;
      else high = middle;
    }
    catchRideFraction = high / catchLiftAngle;
  }
  const catchLiftLawAtPhase = (phase) => {
    const law = catchLiftShapeAtPhase(phase);
    return {
      derivative: law.derivative * catchRideFraction,
      fraction: law.fraction * catchRideFraction,
      secondDerivative: law.secondDerivative * catchRideFraction,
    };
  };
  const catchLiftShapeAtPhase = (phase) => {
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
    const finiteHook = outputPlateFocus
      ? lugClearanceInWheel(rotate2(catchPivotWorld.clone().sub(outputCenter), -outputAngle), catchAngle - outputAngle)
      : hookClearanceInWheel(rotate2(catchHookFromOutput, -outputAngle));
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
  outputRotor.userData.role = `F-${outputPlateFocus ? 'eight' : 'nine'}-notch-detaching-roller-wheel`;
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
  notchWheel.userData.role = `F-solid-${outputPlateFocus ? 'eight' : 'nine'}-notch-wheel`;
  outputRotor.add(notchWheel);

  // Plate 218 draws H as an open ring round a bored shaft, not a black boss.
  const outputHub = cylinderAlongZ(
    outputPlateFocus ? 0.34 : 0.39,
    0.40,
    outputPlateFocus ? drivenMaterial : darkMaterial,
    40,
  );
  outputHub.position.z = wheelCenterZ;
  outputHub.userData.role = 'F-wheel-hub';
  outputRotor.add(outputHub);
  const outputHubRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.055, 12, 48),
    whiteMaterial,
  );
  outputHubRing.position.z = wheelCenterZ + wheelDepth / 2 + 0.075;
  outputHubRing.userData.role = 'H-source-face-bearing-ring';
  outputHubRing.visible = !outputPlateFocus;
  outputRotor.add(outputHubRing);
  // p93: the fixed H shaft stood 0.58 proud of the rocker and 0.52 behind
  // the wheel, a long black stub in every rotated view. It now runs from just
  // behind the hub (z 0.05) to just proud of the rocker's boss (z 0.57).
  const outputShaft = cylinderAlongZ(0.16, 0.6, darkMaterial, 36);
  outputShaft.position.z = 0.32;
  outputShaft.userData.role = 'H-detaching-roller-shaft';
  outputRotor.add(outputShaft);
  const wheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.74, 0.09, 0.035),
    whiteMaterial,
  );
  wheelIndex.position.set(0.73, 0, wheelCenterZ + wheelDepth / 2 + 0.025);
  wheelIndex.userData.role = 'F-wheel-rotation-index';
  wheelIndex.visible = !outputPlateFocus;
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
    outputPlateFocus
      ? [
        followerLocal,
        followerLocal.clone().multiplyScalar(0.5).addScaledVector(rockerNormal, -0.1),
        new THREE.Vector2(0, 0),
        catchPivotLocal.clone().multiplyScalar(0.5).addScaledVector(rockerNormal, -0.12),
        catchPivotLocal,
      ]
      : [followerLocal, rockerMidpoint, catchPivotLocal],
    0.51,
    0.12,
    drivenMaterial,
  );
  if (outputPlateFocus) {
    // Plate 218 draws the lever as a flat shallow S through boss H, bored
    // for the H shaft and eyed at A and G.
    rockerBody.geometry.dispose();
    const origin = new THREE.Vector2(0, 0);
    const {shape: rockerShape} = flatBandShape(
      [
        followerLocal,
        followerLocal.clone().multiplyScalar(0.5).addScaledVector(rockerNormal, -0.1),
        origin,
        catchPivotLocal.clone().multiplyScalar(0.5).addScaledVector(rockerNormal, -0.12),
        catchPivotLocal,
      ],
      0.1,
      [
        poly(circle([0, 0], 0.3, 64)),
        poly(circle([followerLocal.x, followerLocal.y], 0.19, 48)),
        poly(circle([catchPivotLocal.x, catchPivotLocal.y], 0.2, 48)),
      ],
      [
        {center: origin, radius: 0.175},
        {center: followerLocal, radius: 0.06},
      ],
    );
    rockerBody.geometry = extrudedShape(rockerShape, 0.1, 0, drivenMaterial).geometry;
    rockerBody.material = driverMaterial;
    rockerBody.position.z = 0.52;
  }
  rockerBody.userData.role = 'curved-rocker-link-A-to-G';
  rocker.add(rockerBody);

  // The stud is part of the rocker: it takes the rocker's colour, not the
  // white reserved for markers.
  const followerRoller = cylinderAlongZ(
    followerRollerRadius,
    0.39,
    driverMaterial,
    36,
  );
  followerRoller.position.set(followerLocal.x, followerLocal.y, 0.31);
  followerRoller.userData.role = 'A-stud-running-inside-real-groove';
  rocker.add(followerRoller);
  const followerAxle = cylinderAlongZ(0.055, 0.55, darkMaterial, 24);
  followerAxle.position.set(followerLocal.x, followerLocal.y, 0.40);
  followerAxle.userData.role = 'A-follower-axle';
  rocker.add(followerAxle);

  const rockerPivot = cylinderAlongZ(
    0.27,
    0.20,
    outputPlateFocus ? drivenMaterial : darkMaterial,
    36,
  );
  rockerPivot.position.z = 0.52;
  rockerPivot.userData.role = 'rocker-bearing-about-H';
  rockerPivot.visible = !outputPlateFocus;
  rocker.add(rockerPivot);
  // Plate 218 draws catch G as a flat bar lying beside F's rim and dropping
  // its lug straight into a notch, so G is one extrusion in F's own plane,
  // hung behind the lever on the hinge pin. Plate 217's transmission keeps
  // its separate layer.
  const catchLayerZ = outputPlateFocus ? wheelCenterZ : 1.05;
  const catchDepth = 0.2;
  const catchPivotBearing = cylinderAlongZ(0.15, outputPlateFocus ? 0.47 : 0.25, darkMaterial, 32);
  catchPivotBearing.position.set(
    catchPivotLocal.x,
    catchPivotLocal.y,
    outputPlateFocus ? 0.365 : 1.02,
  );
  catchPivotBearing.userData.role = 'hinged-catch-G-pivot';
  rocker.add(catchPivotBearing);

  const catchLink = new THREE.Group();
  catchLink.userData.role = 'hinged-catch-G';
  root.add(catchLink);
  const catchBar = curvedTube2D(
    [
      new THREE.Vector2(0, 0),
      catchTripBossRelativeLocal,
      catchLinkLocal,
    ],
    catchLayerZ,
    0.095,
    catchMaterial,
  );
  let catchOutlineLocal = null;
  if (outputPlateFocus) {
    // Brown's G: a broad arched bar (width 0.2) bored at its hinge, a rounded
    // knob beyond the lug, and a straight lug as wide as the notch (0.13)
    // whose rounded tip is the milled notch's own seat. G's stud is a round
    // lobe on the bar's outer edge, not a separate pin.
    catchBar.geometry.dispose();
    // The lug's axis is the tip's release direction (square to the hinge
    // radius), so lifting draws it straight out of the notch.
    const radial = lugRadial;
    const lugTop = catchLinkLocal.clone().addScaledVector(radial, catchLugLength);
    const outboard = lugOutboard;
    const knob = lugTop.clone().addScaledVector(outboard, 0.06);
    const gOutward = catchTripBossAbsoluteLocal.clone().normalize();
    const gLobe = catchTripBossRelativeLocal.clone().addScaledVector(gOutward, 0.12);
    const {shape: barShape} = flatBandShape(
      [new THREE.Vector2(0, 0), catchTripBossRelativeLocal, lugTop],
      0.12,
      [
        poly(circle([0, 0], 0.24, 48)),
        poly(circle([knob.x, knob.y], 0.15, 48)),
        poly(lugOutline(catchLugLength).map((point) => [point.x, point.y])),
        poly(circle([gLobe.x, gLobe.y], tripRollerRadius, 32)),
      ],
      [{center: new THREE.Vector2(0, 0), radius: 0.155}],
    );
    catchOutlineLocal = barShape.getPoints();
    catchBar.geometry = extrudedShape(barShape, catchDepth, 0, catchMaterial).geometry;
    catchBar.position.z = catchLayerZ;
  }
  catchBar.userData.role = 'catch-G-curved-arm';
  catchLink.add(catchBar);
  const hookTongueEndLocal = catchLinkLocal.clone().addScaledVector(
    engagedHookLocal.clone().normalize(),
    -0.25,
  );
  const catchHookTongue = tubeBetween2D(
    catchLinkLocal,
    hookTongueEndLocal,
    catchLayerZ,
    catchHookRadius,
    outputPlateFocus ? catchMaterial : darkMaterial,
  );
  catchHookTongue.userData.role = 'G-visible-hook-tongue';
  // Plate 218 draws the lug as the flat end of G itself, with no rod.
  catchHookTongue.visible = !outputPlateFocus;
  catchLink.add(catchHookTongue);
  // 218's hidden hook marks the lug tip in G's plane (the finite seat).
  const catchHookLength = outputPlateFocus ? catchDepth : 0.38;
  const catchHookCenterZ = outputPlateFocus ? catchLayerZ : 0.90;
  const catchHook = cylinderAlongZ(
    catchHookRadius,
    catchHookLength,
    outputPlateFocus ? catchMaterial : darkMaterial,
    28,
  );
  catchHook.position.set(
    catchLinkLocal.x,
    catchLinkLocal.y,
    catchHookCenterZ,
  );
  if (outputPlateFocus) {
    // 218's hidden seat marker is the square lug's own tip (G's outline).
    catchHook.geometry.dispose();
    catchHook.geometry = extrudedShape(
      shapeFromPoints(lugTipLocal.map((point) => point.clone().sub(catchLinkLocal))),
      catchHookLength, 0, catchMaterial,
    ).geometry;
    catchHook.rotation.set(0, 0, 0);
  }
  catchHook.userData.role = 'catch-G-hook-entering-F-notch';
  // On 218 the lug is part of G's outline; no pin enters the notch.
  catchHook.visible = !outputPlateFocus;
  catchLink.add(catchHook);
  const tripRollerLength = outputPlateFocus ? 0.24 : 0.82;
  const tripRollerCenterZ = outputPlateFocus ? catchLayerZ : 0.68;
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
  // On 218, G is the lobe on the bar's outline (the cam is not drawn).
  tripRoller.visible = !outputPlateFocus;
  catchLink.add(tripRoller);
  const catchIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 18, 12),
    whiteMaterial,
  );
  catchIndex.position.set(catchLinkLocal.x, catchLinkLocal.y, 1.11);
  catchIndex.userData.role = 'catch-contact-index';
  catchIndex.visible = !outputPlateFocus;
  catchLink.add(catchIndex);

  const followerContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 18, 12),
    whiteMaterial,
  );
  followerContactMarker.position.z = 0.54;
  followerContactMarker.userData.role = 'groove-contact-marker';
  followerContactMarker.visible = !outputPlateFocus;
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
    followerContactMarker,
    followerRoller,
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
    catchDepth,
    catchLayerZ,
    catchLinkLocal,
    catchLugLength,
    catchLugOutline: lugOutline,
    lugCornerRadius,
    catchOutlineLocal,
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
    + `${outputPlateFocus ? 'eight' : 'nine'}-notch wheel F on detaching-roller shaft H`;
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
  root.userData.notchCountRationale = outputPlateFocus
    ? 'Brown draws the notch wheel schematically with eight notches. Keeping '
      + 'eight, the roller turns 3/8 back and 3/4 forward (the caption\'s 1:2 '
      + 'ratio) so the net 3/8 advance closes on an integer three-notch pitch; '
      + 'the caption\'s 1/3 and 2/3 would need a multiple of three notches.'
    : 'Brown draws the notch wheel schematically. Nine equally spaced notches '
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
    catchContactMarker.visible = !outputPlateFocus && state.catchEngaged;
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
      ? new THREE.Vector3(0, 0, 15)
      : new THREE.Vector3(7.8, 4.8, 15.5),
    root,
    update,
  };
}

// The complete shared 217/218 transmission (cam, lever about H, catch G and
// notch wheel F). Plate 218 presents it; plate 217 presents Brown's
// symmetric heart cam with its stud and lever (heart-cam-217.js). The
// shared transmission is still built with plate 217's orientation for
// offline validation of the plate-218 law.
export function createWoolComberTransmission(movementId = 217) {
  return groovedCamWoolComberRollerMotion(movementId);
}

export function createAuthoredWoolComberMovement(movement) {
  switch (movement.id) {
    case 217:
      return createHeartCam217();
    case 218:
      return groovedCamWoolComberRollerMotion(movement.id);
    default: return null;
  }
}
