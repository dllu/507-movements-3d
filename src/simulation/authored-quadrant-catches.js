import * as THREE from 'three';
import { correctQuadrantCatchInterfaces } from './quadrant-catch-finite-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function smootherStep01(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return u ** 3 * (u * (u * 6 - 15) + 10);
}

function smootherStepFirstDerivative(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * u ** 2 * (u - 1) ** 2;
}

function smootherStepSecondDerivative(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * u * (u - 1) * (2 * u - 1);
}

function rotateVector2(vector, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    vector.x * cosine - vector.y * sine,
    vector.x * sine + vector.y * cosine,
  );
}

function signedAngleBetween(from, to) {
  return Math.atan2(
    from.x * to.y - from.y * to.x,
    from.dot(to),
  );
}

function centeredExtrusion(shape, depth, bevel = 0.012) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevel > 0,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 48,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function interpolateWidth(widths, value) {
  if (widths.length === 1) return widths[0];
  const scaled = THREE.MathUtils.clamp(value, 0, 1) * (widths.length - 1);
  const index = Math.min(Math.floor(scaled), widths.length - 2);
  return THREE.MathUtils.lerp(
    widths[index],
    widths[index + 1],
    scaled - index,
  );
}

function naturalSecondDerivatives(values, parameters) {
  const count = values.length;
  const second = Array(count).fill(0);
  if (count <= 2) return second;
  const interiorCount = count - 2;
  const lower = Array(interiorCount).fill(0);
  const diagonal = Array(interiorCount).fill(0);
  const upper = Array(interiorCount).fill(0);
  const right = Array(interiorCount).fill(0);
  for (let row = 0; row < interiorCount; row += 1) {
    const index = row + 1;
    const previousWidth = parameters[index] - parameters[index - 1];
    const nextWidth = parameters[index + 1] - parameters[index];
    lower[row] = row === 0 ? 0 : previousWidth;
    diagonal[row] = 2 * (previousWidth + nextWidth);
    upper[row] = row === interiorCount - 1 ? 0 : nextWidth;
    right[row] = 6 * (
      (values[index + 1] - values[index]) / nextWidth
      - (values[index] - values[index - 1]) / previousWidth
    );
  }
  for (let row = 1; row < interiorCount; row += 1) {
    const multiplier = lower[row] / diagonal[row - 1];
    diagonal[row] -= multiplier * upper[row - 1];
    right[row] -= multiplier * right[row - 1];
  }
  second[count - 2] = right.at(-1) / diagonal.at(-1);
  for (let row = interiorCount - 2; row >= 0; row -= 1) {
    second[row + 1] = (
      right[row] - upper[row] * second[row + 2]
    ) / diagonal[row];
  }
  return second;
}

function naturalCubicCurve3(points) {
  const parameters = [0];
  for (let index = 1; index < points.length; index += 1) {
    parameters.push(
      parameters.at(-1) + points[index].distanceTo(points[index - 1]),
    );
  }
  const total = parameters.at(-1);
  for (let index = 1; index < parameters.length; index += 1) {
    parameters[index] /= total;
  }
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const zValues = points.map((point) => point.z);
  const xSecond = naturalSecondDerivatives(xValues, parameters);
  const ySecond = naturalSecondDerivatives(yValues, parameters);
  const zSecond = naturalSecondDerivatives(zValues, parameters);

  const intervalAt = (value) => {
    const parameter = THREE.MathUtils.clamp(value, 0, 1);
    let lower = 0;
    let upper = parameters.length - 1;
    while (upper - lower > 1) {
      const middle = Math.floor((lower + upper) / 2);
      if (parameter < parameters[middle]) upper = middle;
      else lower = middle;
    }
    return { index: lower, parameter };
  };
  const coordinateState = (
    values,
    secondDerivatives,
    index,
    parameter,
  ) => {
    const start = parameters[index];
    const end = parameters[index + 1];
    const width = end - start;
    const a = (end - parameter) / width;
    const b = (parameter - start) / width;
    const startSecond = secondDerivatives[index];
    const endSecond = secondDerivatives[index + 1];
    return {
      first: (values[index + 1] - values[index]) / width
        + width * (
          (-3 * a ** 2 + 1) * startSecond
          + (3 * b ** 2 - 1) * endSecond
        ) / 6,
      second: a * startSecond + b * endSecond,
      value: a * values[index] + b * values[index + 1]
        + ((a ** 3 - a) * startSecond
          + (b ** 3 - b) * endSecond) * width ** 2 / 6,
    };
  };
  const derivativesAt = (value) => {
    const { index, parameter } = intervalAt(value);
    const x = coordinateState(xValues, xSecond, index, parameter);
    const y = coordinateState(yValues, ySecond, index, parameter);
    const z = coordinateState(zValues, zSecond, index, parameter);
    return {
      first: new THREE.Vector3(x.first, y.first, z.first),
      point: new THREE.Vector3(x.value, y.value, z.value),
      second: new THREE.Vector3(x.second, y.second, z.second),
    };
  };
  return {
    derivativesAt,
    getPoint: (value) => derivativesAt(value).point,
    getTangent: (value) => derivativesAt(value).first.normalize(),
  };
}

function variableWidthPlate({
  centerline,
  curve: suppliedCurve,
  depth,
  material,
  outlineMaterial,
  role,
  sampleCount = 64,
  widths,
}) {
  const curve = suppliedCurve ?? naturalCubicCurve3(
    centerline.map((point) => new THREE.Vector3(point.x, point.y, 0)),
  );
  const left = [];
  const right = [];
  for (let index = 0; index <= sampleCount; index += 1) {
    const parameter = index / sampleCount;
    const point = curve.getPoint(parameter);
    const tangent = curve.getTangent(parameter).normalize();
    const normal = new THREE.Vector3(-tangent.y, tangent.x, 0);
    const halfWidth = interpolateWidth(widths, parameter);
    left.push(point.clone().addScaledVector(normal, halfWidth));
    right.push(point.clone().addScaledVector(normal, -halfWidth));
  }
  const perimeter = [...left, ...right.reverse()];
  const shape = new THREE.Shape();
  perimeter.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  });
  shape.closePath();

  const group = new THREE.Group();
  group.userData.role = role;
  const plate = new THREE.Mesh(centeredExtrusion(shape, depth), material);
  plate.userData.role = `${role}-plate`;
  const outlineCurve = new THREE.CatmullRomCurve3(
    perimeter.map((point) => new THREE.Vector3(
      point.x,
      point.y,
      depth / 2 + 0.018,
    )),
    true,
    'centripetal',
  );
  const outline = new THREE.Mesh(
    new THREE.TubeGeometry(
      outlineCurve,
      perimeter.length * 2,
      0.017,
      6,
      true,
    ),
    outlineMaterial,
  );
  outline.userData.role = `${role}-dark-outline`;
  group.add(plate, outline);
  return { group, outline, plate };
}

function annularSectorShape(innerRadius, outerRadius, startAngle, endAngle) {
  const shape = new THREE.Shape();
  shape.moveTo(
    outerRadius * Math.cos(startAngle),
    outerRadius * Math.sin(startAngle),
  );
  shape.absarc(0, 0, outerRadius, startAngle, endAngle, false);
  shape.lineTo(
    innerRadius * Math.cos(endAngle),
    innerRadius * Math.sin(endAngle),
  );
  shape.absarc(0, 0, innerRadius, endAngle, startAngle, true);
  shape.closePath();
  return shape;
}

function intervalLaw(phase, start, end) {
  const width = end - start;
  const u = THREE.MathUtils.clamp((phase - start) / width, 0, 1);
  return {
    first: smootherStepFirstDerivative(u) / width,
    second: smootherStepSecondDerivative(u) / width ** 2,
    value: smootherStep01(u),
  };
}

function scalarTransition(phase, start, end, from, to) {
  const law = intervalLaw(phase, start, end);
  const travel = to - from;
  return {
    first: travel * law.first,
    second: travel * law.second,
    value: from + travel * law.value,
  };
}

function rigidPointPhaseState(pivot, localPoint, angleState) {
  const rotated = rotateVector2(localPoint, angleState.value);
  const phaseVelocity = new THREE.Vector2(
    -rotated.y * angleState.first,
    rotated.x * angleState.first,
  );
  const phaseAcceleration = new THREE.Vector2(
    -rotated.x * angleState.first ** 2
      - rotated.y * angleState.second,
    -rotated.y * angleState.first ** 2
      + rotated.x * angleState.second,
  );
  return {
    phaseAcceleration,
    phaseVelocity,
    point: pivot.clone().add(rotated),
    rotated,
  };
}

function rotatingFaceVerticalContact({
  angleState,
  curve,
  fixedX,
  pivot,
}) {
  const rotatedAt = (parameter) => {
    const local = curve.getPoint(parameter);
    return rotateVector2(local, angleState.value);
  };
  const horizontalErrorAt = (parameter) => (
    pivot.x + rotatedAt(parameter).x - fixedX
  );

  let lower = 0;
  let upper = 1;
  let lowerError = horizontalErrorAt(lower);
  let upperError = horizontalErrorAt(upper);
  if (lowerError * upperError > 0) {
    throw new Error(
      `Rotating working face does not cross tappet line x=${fixedX}`,
    );
  }
  for (let iteration = 0; iteration < 52; iteration += 1) {
    const middle = (lower + upper) / 2;
    const middleError = horizontalErrorAt(middle);
    if (lowerError * middleError <= 0) {
      upper = middle;
      upperError = middleError;
    } else {
      lower = middle;
      lowerError = middleError;
    }
  }
  const parameter = (lower + upper) / 2;
  const localState = curve.derivativesAt(parameter);
  const localPoint = localState.point;
  const localFirst = localState.first;
  const localSecond = localState.second;
  const rotatedPoint = rotateVector2(localPoint, angleState.value);
  const rotatedFirst = rotateVector2(localFirst, angleState.value);
  const rotatedSecond = rotateVector2(localSecond, angleState.value);
  const parameterFirst = angleState.first * rotatedPoint.y
    / rotatedFirst.x;
  const fixedParameterSecond = (
    -rotatedPoint.x * angleState.first ** 2
    - rotatedPoint.y * angleState.second
  );
  const mixedParameterSecond = -rotatedFirst.y * angleState.first;
  const parameterSecond = -(
    fixedParameterSecond
    + 2 * mixedParameterSecond * parameterFirst
    + rotatedSecond.x * parameterFirst ** 2
  ) / rotatedFirst.x;
  const phaseVelocityY = rotatedPoint.x * angleState.first
    + rotatedFirst.y * parameterFirst;
  const phaseAccelerationY = (
    -rotatedPoint.y * angleState.first ** 2
    + rotatedPoint.x * angleState.second
    + 2 * rotatedFirst.x * angleState.first * parameterFirst
    + rotatedSecond.y * parameterFirst ** 2
    + rotatedFirst.y * parameterSecond
  );

  return {
    localPoint: new THREE.Vector2(localPoint.x, localPoint.y),
    parameter,
    phaseAcceleration: new THREE.Vector2(0, phaseAccelerationY),
    phaseVelocity: new THREE.Vector2(0, phaseVelocityY),
    point: new THREE.Vector2(
      fixedX,
      pivot.y + rotatedPoint.y,
    ),
  };
}

function sourceScaledQuadrantHandGear({ movementId }) {
  const root = new THREE.Group();
  const isSource184Variant = movementId === 184;

  // Brown's drawings have no animation.  All locks below are measured from
  // the two 525 px engravings.  Each figure has its own small drawing drift,
  // so directions are measured in the corresponding raster and re-anchored
  // to the common fixed axes from 183.  This preserves two genuinely rigid
  // handle/quadrant assemblies instead of morphing one drawing into another.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.0125;
  const source183UpperPivot = new THREE.Vector2(275, 129);
  const source183LowerPivot = new THREE.Vector2(283, 353);
  const source183Origin = source183UpperPivot.clone()
    .add(source183LowerPivot).multiplyScalar(0.5);
  const source183PistonRodCenterX = 177;
  const source183TappetCenter = new THREE.Vector2(181, 365);
  const source183UpperWeightPin = new THREE.Vector2(400, 45);
  const source183LowerWeightPin = new THREE.Vector2(142, 421);
  const source183LowerFreeTip = new THREE.Vector2(74, 313);
  const source183LowerContact = new THREE.Vector2(177, 313);
  const source183BottomLatchPoint = new THREE.Vector2(337, 260);

  const source184UpperPivot = new THREE.Vector2(277, 96);
  const source184LowerPivot = new THREE.Vector2(281, 320);
  const source184Origin = source184UpperPivot.clone()
    .add(source184LowerPivot).multiplyScalar(0.5);
  const source184TappetCenter = new THREE.Vector2(180, 87);
  const source184UpperWeightPin = new THREE.Vector2(377, 201);
  const source184LowerWeightPin = new THREE.Vector2(181, 238);
  const source184UpperFreeTip = new THREE.Vector2(84, 145);
  const source184UpperContact = new THREE.Vector2(177, 145);
  const source184TopLatchPoint = new THREE.Vector2(347, 218);

  const source183PointToModel = (point) => new THREE.Vector2(
    (point.x - source183Origin.x) * sourceScale,
    (source183Origin.y - point.y) * sourceScale,
  );
  const modelPointToSource183 = (point) => new THREE.Vector2(
    source183Origin.x + point.x / sourceScale,
    source183Origin.y - point.y / sourceScale,
  );
  const source184PointToModel = (point) => new THREE.Vector2(
    (point.x - source184Origin.x) * sourceScale,
    (source184Origin.y - point.y) * sourceScale,
  );
  const sourceVectorToModel = (point, pivot) => new THREE.Vector2(
    (point.x - pivot.x) * sourceScale,
    (pivot.y - point.y) * sourceScale,
  );
  const modelVectorToSource = (vector) => new THREE.Vector2(
    vector.x / sourceScale,
    -vector.y / sourceScale,
  );

  const upperPivot = source183PointToModel(source183UpperPivot);
  const lowerPivot = source183PointToModel(source183LowerPivot);
  const pistonRodX = (
    source183PistonRodCenterX - source183Origin.x
  ) * sourceScale;
  const source183PistonY = source183PointToModel(source183TappetCenter).y;
  const source184PistonY = source184PointToModel(source184TappetCenter).y;

  const upperWeightLocal = sourceVectorToModel(
    source183UpperWeightPin,
    source183UpperPivot,
  );
  const lowerWeightLocal = sourceVectorToModel(
    source183LowerWeightPin,
    source183LowerPivot,
  );
  const source184UpperWeightVector = sourceVectorToModel(
    source184UpperWeightPin,
    source184UpperPivot,
  );
  const source184LowerWeightVector = sourceVectorToModel(
    source184LowerWeightPin,
    source184LowerPivot,
  );
  const source183UpperAngle = 0;
  const source183LowerAngle = 0;
  const source184UpperAngle = signedAngleBetween(
    upperWeightLocal,
    source184UpperWeightVector,
  );
  const source184LowerAngle = signedAngleBetween(
    lowerWeightLocal,
    source184LowerWeightVector,
  );

  const source184UpperWorkingCenterline = [
    [277, 96],
    [255, 109],
    [238, 130],
    [215, 142],
    [184, 145],
    [148, 145],
    [112, 145],
    [84, 145],
  ].map(([x, y]) => sourceVectorToModel(
    new THREE.Vector2(x, y),
    source184UpperPivot,
  ));
  const upperWorkingCenterline = source184UpperWorkingCenterline.map(
    (point) => rotateVector2(point, -source184UpperAngle),
  );
  const lowerWorkingCenterline = [
    [283, 353],
    [260, 342],
    [236, 328],
    [211, 316],
    [177, 313],
    [140, 312],
    [103, 312],
    [74, 313],
  ].map(([x, y]) => sourceVectorToModel(
    new THREE.Vector2(x, y),
    source183LowerPivot,
  ));
  const upperWorkingCurve = naturalCubicCurve3(
    upperWorkingCenterline.map((point) => new THREE.Vector3(
      point.x,
      point.y,
      0,
    )),
  );
  const lowerWorkingCurve = naturalCubicCurve3(
    lowerWorkingCenterline.map((point) => new THREE.Vector3(
      point.x,
      point.y,
      0,
    )),
  );

  const upperContactLocal = rotateVector2(
    sourceVectorToModel(source184UpperContact, source184UpperPivot),
    -source184UpperAngle,
  );
  const lowerContactLocal = sourceVectorToModel(
    source183LowerContact,
    source183LowerPivot,
  );
  const upperSlidingContactX = upperPivot.x + sourceVectorToModel(
    source184UpperContact,
    source184UpperPivot,
  ).x;
  const lowerSlidingContactX = lowerPivot.x + lowerContactLocal.x;

  const bottomLatchPoint = source183PointToModel(
    source183BottomLatchPoint,
  );
  const lowerBottomHookLocal = bottomLatchPoint.clone().sub(lowerPivot);
  const upperBottomSeatLocal = bottomLatchPoint.clone().sub(upperPivot);
  const topLatchPoint = source184PointToModel(source184TopLatchPoint);
  const upperTopHookLocal = rotateVector2(
    topLatchPoint.clone().sub(upperPivot),
    -source184UpperAngle,
  );
  const lowerTopSeatLocal = rotateVector2(
    topLatchPoint.clone().sub(lowerPivot),
    -source184LowerAngle,
  );

  const upperSource184WeightResidual = Math.abs(
    upperWeightLocal.length() - source184UpperWeightVector.length(),
  ) / sourceScale;
  const lowerSource184WeightResidual = Math.abs(
    lowerWeightLocal.length() - source184LowerWeightVector.length(),
  ) / sourceScale;

  const handleDepth = 0.20;
  const handlePlaneZ = 0;
  const upperQuadrantDepth = 0.22;
  const upperQuadrantPlaneZ = 0.24;
  const lowerQuadrantDepth = 0.22;
  const lowerQuadrantPlaneZ = 0.52;
  const upperQuadrantInnerRadius = 1.24;
  const upperQuadrantOuterRadius = 2.02;
  const upperQuadrantStartAngle = -1.20;
  const upperQuadrantEndAngle = 0.42;
  const lowerQuadrantInnerRadius = 1.04;
  const lowerQuadrantOuterRadius = 1.62;
  const lowerQuadrantStartAngle = 0.78;
  const lowerQuadrantEndAngle = 2.36;
  const frameCenterZ = -0.48;
  const frameDepth = 0.52;
  const tappetHalfHeight = 0.27;
  const contactRollerRadius = 0.105;
  const latchPinRadius = 0.095;
  const cyclePeriod = 18;
  const sequenceBreaks = Object.freeze({
    source183HoldEnd: 0.08,
    upwardApproachEnd: 0.20,
    lowerTripEnd: 0.34,
    upwardOvertravelEnd: 0.44,
    source184HoldEnd: 0.52,
    downwardApproachEnd: 0.64,
    upperTripEnd: 0.78,
    downwardOvertravelEnd: 0.92,
  });
  // The tappet drives only the part of each quadrant-handle swing for which
  // its curved face crosses the piston line. Once that face has run clear,
  // the back weights and mutually engaging quadrants complete the transfer.
  const lowerDrivenTopState = 0.64;
  const upperDrivenTopState = 0.56;

  const baseTopStateLawAtCyclePhase = (phaseValue) => {
    const phase = THREE.MathUtils.clamp(phaseValue, 0, 1);
    if (phase < sequenceBreaks.upwardApproachEnd) {
      return { first: 0, second: 0, value: 0 };
    }
    if (phase < sequenceBreaks.lowerTripEnd) {
      return scalarTransition(
        phase,
        sequenceBreaks.upwardApproachEnd,
        sequenceBreaks.lowerTripEnd,
        0,
        lowerDrivenTopState,
      );
    }
    if (phase < sequenceBreaks.upwardOvertravelEnd) {
      return scalarTransition(
        phase,
        sequenceBreaks.lowerTripEnd,
        sequenceBreaks.upwardOvertravelEnd,
        lowerDrivenTopState,
        1,
      );
    }
    if (phase < sequenceBreaks.downwardApproachEnd) {
      return { first: 0, second: 0, value: 1 };
    }
    if (phase < sequenceBreaks.upperTripEnd) {
      return scalarTransition(
        phase,
        sequenceBreaks.downwardApproachEnd,
        sequenceBreaks.upperTripEnd,
        1,
        upperDrivenTopState,
      );
    }
    if (phase < sequenceBreaks.downwardOvertravelEnd) {
      return scalarTransition(
        phase,
        sequenceBreaks.upperTripEnd,
        sequenceBreaks.downwardOvertravelEnd,
        upperDrivenTopState,
        0,
      );
    }
    return { first: 0, second: 0, value: 0 };
  };

  const staticAngleState = (value) => ({ first: 0, second: 0, value });
  const lowerStrikeContact = rotatingFaceVerticalContact({
    angleState: staticAngleState(source183LowerAngle),
    curve: lowerWorkingCurve,
    fixedX: lowerSlidingContactX,
    pivot: lowerPivot,
  });
  const lowerReleaseContact = rotatingFaceVerticalContact({
    angleState: staticAngleState(THREE.MathUtils.lerp(
      source183LowerAngle,
      source184LowerAngle,
      lowerDrivenTopState,
    )),
    curve: lowerWorkingCurve,
    fixedX: lowerSlidingContactX,
    pivot: lowerPivot,
  });
  const upperStrikeContact = rotatingFaceVerticalContact({
    angleState: staticAngleState(source184UpperAngle),
    curve: upperWorkingCurve,
    fixedX: upperSlidingContactX,
    pivot: upperPivot,
  });
  const upperReleaseContact = rotatingFaceVerticalContact({
    angleState: staticAngleState(THREE.MathUtils.lerp(
      source183UpperAngle,
      source184UpperAngle,
      upperDrivenTopState,
    )),
    curve: upperWorkingCurve,
    fixedX: upperSlidingContactX,
    pivot: upperPivot,
  });
  const lowerStrikePistonY = lowerStrikeContact.point.y
    - contactRollerRadius - tappetHalfHeight;
  const lowerReleasePistonY = lowerReleaseContact.point.y
    - contactRollerRadius - tappetHalfHeight;
  const upperStrikePistonY = upperStrikeContact.point.y
    + contactRollerRadius + tappetHalfHeight;
  const upperReleasePistonY = upperReleaseContact.point.y
    + contactRollerRadius + tappetHalfHeight;

  const stageAtCyclePhase = (phase) => {
    if (phase < sequenceBreaks.source183HoldEnd) {
      return 'source-183-ascending-stroke-pose-hold';
    }
    if (phase < sequenceBreaks.upwardApproachEnd) {
      return 'ascending-tappet-approaches-lower-quadrant-handle';
    }
    if (phase < sequenceBreaks.lowerTripEnd) {
      return 'ascending-tappet-trips-lower-quadrant-and-releases-upper';
    }
    if (phase < sequenceBreaks.upwardOvertravelEnd) {
      return 'ascending-after-quadrant-transfer-to-top';
    }
    if (phase < sequenceBreaks.source184HoldEnd) {
      return 'source-184-top-of-cylinder-pose-hold';
    }
    if (phase < sequenceBreaks.downwardApproachEnd) {
      return 'descending-tappet-approaches-upper-quadrant-handle';
    }
    if (phase < sequenceBreaks.upperTripEnd) {
      return 'descending-tappet-trips-upper-quadrant-and-releases-lower';
    }
    if (phase < sequenceBreaks.downwardOvertravelEnd) {
      return 'descending-after-quadrant-transfer-to-bottom';
    }
    return 'source-183-returned-pose-hold';
  };

  const baseStateAtCyclePhase = (phaseValue) => {
    const phase = THREE.MathUtils.clamp(phaseValue, 0, 1);
    const topState = baseTopStateLawAtCyclePhase(phase);
    const lowerTripActive = phase >= sequenceBreaks.upwardApproachEnd
      && phase < sequenceBreaks.lowerTripEnd;
    const upperTripActive = phase >= sequenceBreaks.downwardApproachEnd
      && phase < sequenceBreaks.upperTripEnd;
    const upperAngleState = {
      first: (source184UpperAngle - source183UpperAngle) * topState.first,
      second: (source184UpperAngle - source183UpperAngle) * topState.second,
      value: THREE.MathUtils.lerp(
        source183UpperAngle,
        source184UpperAngle,
        topState.value,
      ),
    };
    const lowerAngleState = {
      first: (source184LowerAngle - source183LowerAngle) * topState.first,
      second: (source184LowerAngle - source183LowerAngle) * topState.second,
      value: THREE.MathUtils.lerp(
        source183LowerAngle,
        source184LowerAngle,
        topState.value,
      ),
    };
    const upperRigidContact = rigidPointPhaseState(
      upperPivot,
      upperContactLocal,
      upperAngleState,
    );
    const lowerRigidContact = rigidPointPhaseState(
      lowerPivot,
      lowerContactLocal,
      lowerAngleState,
    );
    // During a trip, the material contact point slides along the rotating
    // curved face while its world x-coordinate remains on the narrow tappet.
    // Outside contact, retain a stable source-locus point for diagnostics.
    const upperContact = upperTripActive
      ? rotatingFaceVerticalContact({
        angleState: upperAngleState,
        curve: upperWorkingCurve,
        fixedX: upperSlidingContactX,
        pivot: upperPivot,
      })
      : {
        localPoint: upperContactLocal.clone(),
        parameter: null,
        phaseAcceleration: new THREE.Vector2(
          0,
          upperRigidContact.phaseAcceleration.y,
        ),
        phaseVelocity: new THREE.Vector2(0, upperRigidContact.phaseVelocity.y),
        point: new THREE.Vector2(
          upperSlidingContactX,
          upperRigidContact.point.y,
        ),
      };
    const lowerContact = lowerTripActive
      ? rotatingFaceVerticalContact({
        angleState: lowerAngleState,
        curve: lowerWorkingCurve,
        fixedX: lowerSlidingContactX,
        pivot: lowerPivot,
      })
      : {
        localPoint: lowerContactLocal.clone(),
        parameter: null,
        phaseAcceleration: new THREE.Vector2(
          0,
          lowerRigidContact.phaseAcceleration.y,
        ),
        phaseVelocity: new THREE.Vector2(0, lowerRigidContact.phaseVelocity.y),
        point: new THREE.Vector2(
          lowerSlidingContactX,
          lowerRigidContact.point.y,
        ),
      };
    const upperWeight = rigidPointPhaseState(
      upperPivot,
      upperWeightLocal,
      upperAngleState,
    );
    const lowerWeight = rigidPointPhaseState(
      lowerPivot,
      lowerWeightLocal,
      lowerAngleState,
    );
    const lowerBottomHook = rigidPointPhaseState(
      lowerPivot,
      lowerBottomHookLocal,
      lowerAngleState,
    );
    const upperBottomSeat = rigidPointPhaseState(
      upperPivot,
      upperBottomSeatLocal,
      upperAngleState,
    );
    const upperTopHook = rigidPointPhaseState(
      upperPivot,
      upperTopHookLocal,
      upperAngleState,
    );
    const lowerTopSeat = rigidPointPhaseState(
      lowerPivot,
      lowerTopSeatLocal,
      lowerAngleState,
    );

    let pistonState;
    if (phase < sequenceBreaks.source183HoldEnd) {
      pistonState = { first: 0, second: 0, value: source183PistonY };
    } else if (phase < sequenceBreaks.upwardApproachEnd) {
      pistonState = scalarTransition(
        phase,
        sequenceBreaks.source183HoldEnd,
        sequenceBreaks.upwardApproachEnd,
        source183PistonY,
        lowerStrikePistonY,
      );
    } else if (phase < sequenceBreaks.lowerTripEnd) {
      pistonState = {
        first: lowerContact.phaseVelocity.y,
        second: lowerContact.phaseAcceleration.y,
        value: lowerContact.point.y
          - contactRollerRadius - tappetHalfHeight,
      };
    } else if (phase < sequenceBreaks.upwardOvertravelEnd) {
      pistonState = scalarTransition(
        phase,
        sequenceBreaks.lowerTripEnd,
        sequenceBreaks.upwardOvertravelEnd,
        lowerReleasePistonY,
        source184PistonY,
      );
    } else if (phase < sequenceBreaks.source184HoldEnd) {
      pistonState = { first: 0, second: 0, value: source184PistonY };
    } else if (phase < sequenceBreaks.downwardApproachEnd) {
      pistonState = scalarTransition(
        phase,
        sequenceBreaks.source184HoldEnd,
        sequenceBreaks.downwardApproachEnd,
        source184PistonY,
        upperStrikePistonY,
      );
    } else if (phase < sequenceBreaks.upperTripEnd) {
      pistonState = {
        first: upperContact.phaseVelocity.y,
        second: upperContact.phaseAcceleration.y,
        value: upperContact.point.y
          + contactRollerRadius + tappetHalfHeight,
      };
    } else if (phase < sequenceBreaks.downwardOvertravelEnd) {
      pistonState = scalarTransition(
        phase,
        sequenceBreaks.upperTripEnd,
        sequenceBreaks.downwardOvertravelEnd,
        upperReleasePistonY,
        source183PistonY,
      );
    } else {
      pistonState = { first: 0, second: 0, value: source183PistonY };
    }

    const phaseRate = 1 / cyclePeriod;
    const phaseAccelerationRate = phaseRate ** 2;
    const timeVector = (vector) => vector.clone().multiplyScalar(phaseRate);
    const timeAccelerationVector = (vector) => vector.clone().multiplyScalar(
      phaseAccelerationRate,
    );
    const tappetTopY = pistonState.value + tappetHalfHeight;
    const tappetBottomY = pistonState.value - tappetHalfHeight;
    const lowerContactError = tappetTopY
      - (lowerContact.point.y - contactRollerRadius);
    const upperContactError = tappetBottomY
      - (upperContact.point.y + contactRollerRadius);
    const stage = stageAtCyclePhase(phase);
    const activeContactPoint = lowerTripActive
      ? lowerContact.point.clone()
      : upperTripActive
        ? upperContact.point.clone()
        : null;
    const pistonVelocity = pistonState.first * phaseRate;

    return {
      activeContact: lowerTripActive
        ? 'lower-quadrant-handle'
        : upperTripActive
          ? 'upper-quadrant-handle'
          : null,
      activeContactPoint,
      activeQuadrantLatch: topState.value < 0.5
        ? 'lower-quadrant-retains-upper-handle'
        : 'upper-quadrant-retains-lower-handle',
      bottomLatchEngagement: 1 - topState.value,
      bottomLatchGap: lowerBottomHook.point.distanceTo(upperBottomSeat.point),
      lowerBottomHookPoint: lowerBottomHook.point,
      lowerEductionOpenFraction: topState.value,
      lowerHandleAngle: lowerAngleState.value,
      lowerHandleAngularAcceleration: lowerAngleState.second
        * phaseAccelerationRate,
      lowerHandleAngularVelocity: lowerAngleState.first * phaseRate,
      lowerHandleContactAcceleration: timeAccelerationVector(
        lowerContact.phaseAcceleration,
      ),
      lowerHandleContactLocalPoint: lowerContact.localPoint,
      lowerHandleContactParameter: lowerContact.parameter,
      lowerHandleContactPoint: lowerContact.point,
      lowerHandleContactVelocity: timeVector(lowerContact.phaseVelocity),
      lowerSteamOpenFraction: 1 - topState.value,
      lowerTappetContactError: lowerContactError,
      lowerTopSeatPoint: lowerTopSeat.point,
      lowerWeightAcceleration: timeAccelerationVector(
        lowerWeight.phaseAcceleration,
      ),
      lowerWeightPin: lowerWeight.point,
      lowerWeightVelocity: timeVector(lowerWeight.phaseVelocity),
      phase,
      pistonAcceleration: pistonState.second * phaseAccelerationRate,
      pistonDirection: Math.abs(pistonVelocity) < 1e-12
        ? 0
        : Math.sign(pistonVelocity),
      pistonPosition: new THREE.Vector3(
        pistonRodX,
        pistonState.value,
        handlePlaneZ,
      ),
      pistonVelocity: new THREE.Vector3(0, pistonVelocity, 0),
      stage,
      tappetBottomY,
      tappetTopY,
      topLatchEngagement: topState.value,
      topLatchGap: upperTopHook.point.distanceTo(lowerTopSeat.point),
      topStateAcceleration: topState.second * phaseAccelerationRate,
      topStateBlend: topState.value,
      topStateVelocity: topState.first * phaseRate,
      upperBottomSeatPoint: upperBottomSeat.point,
      upperEductionOpenFraction: 1 - topState.value,
      upperHandleAngle: upperAngleState.value,
      upperHandleAngularAcceleration: upperAngleState.second
        * phaseAccelerationRate,
      upperHandleAngularVelocity: upperAngleState.first * phaseRate,
      upperHandleContactAcceleration: timeAccelerationVector(
        upperContact.phaseAcceleration,
      ),
      upperHandleContactLocalPoint: upperContact.localPoint,
      upperHandleContactParameter: upperContact.parameter,
      upperHandleContactPoint: upperContact.point,
      upperHandleContactVelocity: timeVector(upperContact.phaseVelocity),
      upperSteamOpenFraction: topState.value,
      upperTappetContactError: upperContactError,
      upperTopHookPoint: upperTopHook.point,
      upperWeightAcceleration: timeAccelerationVector(
        upperWeight.phaseAcceleration,
      ),
      upperWeightPin: upperWeight.point,
      upperWeightVelocity: timeVector(upperWeight.phaseVelocity),
    };
  };

  const initialBasePhase = isSource184Variant
    ? (sequenceBreaks.upwardOvertravelEnd
      + sequenceBreaks.source184HoldEnd) / 2
    : 0;
  const publicBasePhaseWrap = initialBasePhase === 0
    ? 1
    : 1 - initialBasePhase;
  const publicSequenceBreaks = initialBasePhase === 0
    ? sequenceBreaks
    : Object.freeze(Object.fromEntries(
      Object.entries(sequenceBreaks).map(([name, basePhase]) => [
        name,
        positiveModulo(basePhase - initialBasePhase, 1),
      ]),
    ));
  const cyclePhaseToBasePhase = (cyclePhase) => (
    cyclePhase === 1 && initialBasePhase === 0
      ? 1
      : positiveModulo(cyclePhase + initialBasePhase, 1)
  );
  const stateAtCyclePhase = (phaseValue) => {
    const cyclePhase = THREE.MathUtils.clamp(phaseValue, 0, 1);
    const basePhase = cyclePhaseToBasePhase(cyclePhase);
    return {
      ...baseStateAtCyclePhase(basePhase),
      basePhase,
      cyclePhase,
      phase: cyclePhase,
    };
  };
  const topStateLawAtCyclePhase = (phaseValue) => baseTopStateLawAtCyclePhase(
    cyclePhaseToBasePhase(THREE.MathUtils.clamp(phaseValue, 0, 1)),
  );
  const stateAtTime = (time) => stateAtCyclePhase(
    positiveModulo(time, cyclePeriod) / cyclePeriod,
  );

  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.20,
    roughness: 0.54,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.72,
  });
  const pistonMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.62,
  });
  const handleMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.60,
  });
  const upperQuadrantMaterial = matte(PALETTE.accent, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const lowerQuadrantMaterial = matte(PALETTE.brass, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const weightMaterial = matte(PALETTE.brass, {
    metalness: 0.18,
    roughness: 0.56,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });

  const frameSpine = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 4.55, frameDepth),
    frameMaterial,
  );
  frameSpine.position.set(0, 0, frameCenterZ);
  frameSpine.userData.role = 'fixed-column-carrying-two-quadrant-handle-pivots';
  const pistonGuide = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 7.15, 0.34),
    frameMaterial,
  );
  pistonGuide.position.set(pistonRodX, 0.05, -0.30);
  pistonGuide.userData.role = 'fixed-vertical-guide-behind-piston-rod';
  const upperCrossbar = new THREE.Mesh(
    new THREE.BoxGeometry(Math.abs(pistonRodX) + 0.42, 0.24, frameDepth),
    frameMaterial,
  );
  upperCrossbar.position.set(pistonRodX / 2, 2.13, frameCenterZ);
  upperCrossbar.userData.role = 'upper-fixed-frame-crossbar';
  const lowerCrossbar = upperCrossbar.clone();
  lowerCrossbar.position.y = -2.13;
  lowerCrossbar.userData.role = 'lower-fixed-frame-crossbar';
  root.add(frameSpine, pistonGuide, upperCrossbar, lowerCrossbar);

  const makeHandle = ({
    contactLocal,
    pivot,
    role,
    weightLocal,
    workingCenterline,
    workingCurve,
  }) => {
    const group = new THREE.Group();
    group.position.set(pivot.x, pivot.y, handlePlaneZ);
    group.userData.axis = Z_AXIS.clone();
    group.userData.role = role;
    const working = variableWidthPlate({
      centerline: workingCenterline,
      curve: workingCurve,
      depth: handleDepth,
      material: handleMaterial,
      outlineMaterial: darkMaterial,
      role: `${role}-curved-piston-tappet-arm`,
      widths: [0.20, 0.18, 0.14, 0.11],
    });
    const weight = variableWidthPlate({
      centerline: [
        new THREE.Vector2(0, 0),
        weightLocal.clone().multiplyScalar(0.48),
        weightLocal.clone(),
      ],
      depth: handleDepth * 0.88,
      material: handleMaterial,
      outlineMaterial: darkMaterial,
      role: `${role}-back-weight-arm`,
      sampleCount: 44,
      widths: [0.19, 0.13, 0.075],
    });
    const hub = cylinderAlongZ(0.42, handleDepth * 1.18, handleMaterial, 44);
    hub.userData.role = `${role}-source-scale-rocking-hub`;
    const hubRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.055, 10, 48),
      darkMaterial,
    );
    hubRing.position.z = handleDepth / 2 + 0.035;
    hubRing.userData.role = `${role}-dark-hub-ring`;
    const contactRoller = cylinderAlongZ(
      contactRollerRadius,
      handleDepth * 1.20,
      darkMaterial,
      28,
    );
    contactRoller.position.set(contactLocal.x, contactLocal.y, 0);
    contactRoller.visible = false;
    contactRoller.userData.role = `${role}-hidden-source-contact-locus-anchor`;
    const weightEye = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.052, 10, 36),
      darkMaterial,
    );
    weightEye.position.set(
      weightLocal.x,
      weightLocal.y,
      handleDepth / 2 + 0.032,
    );
    weightEye.userData.role = `${role}-back-weight-eye`;
    const workingTip = cylinderAlongZ(
      0.15,
      handleDepth * 1.04,
      handleMaterial,
      30,
    );
    const lastWorkingPoint = workingCenterline.at(-1);
    workingTip.position.set(lastWorkingPoint.x, lastWorkingPoint.y, 0);
    workingTip.userData.role = `${role}-rounded-working-tip`;
    const index = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.045, 0.028),
      whiteMaterial,
    );
    index.position.set(0.27, 0, handleDepth / 2 + 0.06);
    index.userData.role = `${role}-white-rocking-angle-index`;
    const contactAnchor = new THREE.Object3D();
    contactAnchor.position.set(contactLocal.x, contactLocal.y, 0);
    contactAnchor.userData.role = `${role}-exact-tappet-contact-anchor`;
    const weightAnchor = new THREE.Object3D();
    weightAnchor.position.set(weightLocal.x, weightLocal.y, 0);
    weightAnchor.userData.role = `${role}-exact-back-weight-pin-anchor`;
    group.add(
      working.group,
      weight.group,
      hub,
      hubRing,
      contactRoller,
      weightEye,
      workingTip,
      index,
      contactAnchor,
      weightAnchor,
    );
    return {
      contactAnchor,
      contactRoller,
      group,
      hub,
      hubRing,
      index,
      weightAnchor,
      weightArm: weight.group,
      weightEye,
      workingArm: working.group,
      workingTip,
    };
  };

  const upperHandleParts = makeHandle({
    contactLocal: upperContactLocal,
    pivot: upperPivot,
    role: 'upper-backweighted-quadrant-valve-handle',
    weightLocal: upperWeightLocal,
    workingCenterline: upperWorkingCenterline,
    workingCurve: upperWorkingCurve,
  });
  const lowerHandleParts = makeHandle({
    contactLocal: lowerContactLocal,
    pivot: lowerPivot,
    role: 'lower-backweighted-quadrant-valve-handle',
    weightLocal: lowerWeightLocal,
    workingCenterline: lowerWorkingCenterline,
    workingCurve: lowerWorkingCurve,
  });

  const makeQuadrant = ({
    depth,
    endAngle,
    innerRadius,
    material,
    planeZ,
    role,
    startAngle,
    outerRadius,
  }) => {
    const group = new THREE.Group();
    group.position.z = planeZ - handlePlaneZ;
    group.userData.axis = Z_AXIS.clone();
    group.userData.role = role;
    const band = new THREE.Mesh(
      centeredExtrusion(
        annularSectorShape(innerRadius, outerRadius, startAngle, endAngle),
        depth,
      ),
      material,
    );
    band.userData.role = `${role}-annular-sector-band`;
    const makeSpoke = (angle, suffix) => {
      const direction = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
      const spoke = variableWidthPlate({
        centerline: [
          direction.clone().multiplyScalar(0.18),
          direction.clone().multiplyScalar(innerRadius * 0.62),
          direction.clone().multiplyScalar((innerRadius + outerRadius) / 2),
        ],
        depth: depth * 0.94,
        material,
        outlineMaterial: darkMaterial,
        role: `${role}-${suffix}-radial-arm`,
        sampleCount: 36,
        widths: [0.20, 0.15, 0.12],
      });
      spoke.group.position.z = -0.008;
      return spoke;
    };
    const startSpoke = makeSpoke(startAngle, 'start');
    const endSpoke = makeSpoke(endAngle, 'end');
    const outerPoints = [];
    const innerPoints = [];
    for (let index = 0; index <= 52; index += 1) {
      const angle = THREE.MathUtils.lerp(startAngle, endAngle, index / 52);
      outerPoints.push(new THREE.Vector3(
        outerRadius * Math.cos(angle),
        outerRadius * Math.sin(angle),
        depth / 2 + 0.018,
      ));
      innerPoints.push(new THREE.Vector3(
        innerRadius * Math.cos(angle),
        innerRadius * Math.sin(angle),
        depth / 2 + 0.018,
      ));
    }
    const outerOutline = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(outerPoints),
        104,
        0.018,
        6,
        false,
      ),
      darkMaterial,
    );
    outerOutline.userData.role = `${role}-outer-arc-outline`;
    const innerOutline = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(innerPoints),
        104,
        0.018,
        6,
        false,
      ),
      darkMaterial,
    );
    innerOutline.userData.role = `${role}-inner-arc-outline`;
    const indexAngle = (startAngle + endAngle) / 2;
    const index = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.045, 0.028),
      whiteMaterial,
    );
    index.position.set(
      (innerRadius + outerRadius) / 2 * Math.cos(indexAngle),
      (innerRadius + outerRadius) / 2 * Math.sin(indexAngle),
      depth / 2 + 0.058,
    );
    index.rotation.z = indexAngle + Math.PI / 2;
    index.userData.role = `${role}-white-sector-index`;
    group.add(
      band,
      startSpoke.group,
      endSpoke.group,
      outerOutline,
      innerOutline,
      index,
    );
    return {
      band,
      endSpoke: endSpoke.group,
      group,
      index,
      innerOutline,
      outerOutline,
      startSpoke: startSpoke.group,
    };
  };

  const upperQuadrantParts = makeQuadrant({
    depth: upperQuadrantDepth,
    endAngle: upperQuadrantEndAngle,
    innerRadius: upperQuadrantInnerRadius,
    material: upperQuadrantMaterial,
    outerRadius: upperQuadrantOuterRadius,
    planeZ: upperQuadrantPlaneZ,
    role: 'upper-handle-rigid-hollow-quadrant',
    startAngle: upperQuadrantStartAngle,
  });
  const lowerQuadrantParts = makeQuadrant({
    depth: lowerQuadrantDepth,
    endAngle: lowerQuadrantEndAngle,
    innerRadius: lowerQuadrantInnerRadius,
    material: lowerQuadrantMaterial,
    outerRadius: lowerQuadrantOuterRadius,
    planeZ: lowerQuadrantPlaneZ,
    role: 'lower-handle-rigid-hollow-quadrant',
    startAngle: lowerQuadrantStartAngle,
  });
  upperHandleParts.group.add(upperQuadrantParts.group);
  lowerHandleParts.group.add(lowerQuadrantParts.group);

  const makeLatchAnchor = (parent, local, role) => {
    const anchor = new THREE.Object3D();
    anchor.position.set(local.x, local.y, 0);
    anchor.userData.role = role;
    parent.add(anchor);
    return anchor;
  };
  const lowerBottomHookAnchor = makeLatchAnchor(
    lowerHandleParts.group,
    lowerBottomHookLocal,
    'lower-quadrant-bottom-pose-hook-anchor',
  );
  const upperBottomSeatAnchor = makeLatchAnchor(
    upperHandleParts.group,
    upperBottomSeatLocal,
    'upper-handle-bottom-pose-retaining-pin-anchor',
  );
  const upperTopHookAnchor = makeLatchAnchor(
    upperHandleParts.group,
    upperTopHookLocal,
    'upper-quadrant-top-pose-hook-anchor',
  );
  const lowerTopSeatAnchor = makeLatchAnchor(
    lowerHandleParts.group,
    lowerTopSeatLocal,
    'lower-handle-top-pose-retaining-pin-anchor',
  );

  const latchSpan = lowerQuadrantPlaneZ - upperQuadrantPlaneZ
    + lowerQuadrantDepth * 0.62;
  const makeLatchPin = (anchor, role) => {
    const pin = cylinderAlongZ(latchPinRadius, latchSpan, darkMaterial, 28);
    pin.position.z = (upperQuadrantPlaneZ + lowerQuadrantPlaneZ) / 2;
    pin.userData.role = role;
    anchor.add(pin);
    return pin;
  };
  const upperBottomSeatPin = makeLatchPin(
    upperBottomSeatAnchor,
    'upper-handle-pin-retained-by-lower-quadrant-at-source-183',
  );
  const lowerTopSeatPin = makeLatchPin(
    lowerTopSeatAnchor,
    'lower-handle-pin-retained-by-upper-quadrant-at-source-184',
  );

  const pistonGroup = new THREE.Group();
  pistonGroup.position.set(0, source183PistonY, handlePlaneZ);
  pistonGroup.userData.axis = new THREE.Vector3(0, 1, 0);
  pistonGroup.userData.role = 'vertically-reciprocating-piston-rod-and-projecting-tappet';
  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 4.10, 0.24),
    pistonMaterial,
  );
  pistonRod.position.x = pistonRodX;
  pistonRod.userData.role = 'moving-piston-rod';
  const tappetShoeRightX = -1.03;
  const tappetShoeLeftX = pistonRodX - 0.13;
  const tappet = new THREE.Mesh(
    new THREE.BoxGeometry(
      tappetShoeRightX - tappetShoeLeftX,
      tappetHalfHeight * 2,
      0.32,
    ),
    pistonMaterial,
  );
  tappet.position.x = (tappetShoeLeftX + tappetShoeRightX) / 2;
  tappet.userData.role = 'source-projecting-piston-rod-tappet-shoe';
  const tappetIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, tappetHalfHeight * 1.15, 0.028),
    whiteMaterial,
  );
  tappetIndex.position.set(
    tappetShoeRightX - 0.09,
    0,
    0.32 / 2 + 0.025,
  );
  tappetIndex.userData.role = 'white-index-on-moving-piston-tappet';
  const tappetAnchor = new THREE.Object3D();
  tappetAnchor.position.set(pistonRodX, 0, 0);
  tappetAnchor.userData.role = 'exact-source-tappet-center-anchor';
  pistonGroup.add(pistonRod, tappet, tappetIndex, tappetAnchor);

  const makePivotHardware = (pivot, role) => {
    const group = new THREE.Group();
    group.position.set(pivot.x, pivot.y, 0);
    group.userData.fixed = true;
    group.userData.role = role;
    const shaftBottom = frameCenterZ - frameDepth / 2;
    const shaftTop = lowerQuadrantPlaneZ + lowerQuadrantDepth / 2 + 0.16;
    const shaft = cylinderAlongZ(0.11, shaftTop - shaftBottom, darkMaterial, 28);
    shaft.position.z = (shaftTop + shaftBottom) / 2;
    shaft.userData.role = `${role}-fixed-shaft`;
    const head = cylinderAlongZ(0.20, 0.13, darkMaterial, 36);
    head.position.z = shaftTop + 0.02;
    head.userData.role = `${role}-fixed-round-head`;
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.045, 0.026),
      whiteMaterial,
    );
    slot.position.z = shaftTop + 0.095;
    slot.rotation.z = Math.PI / 2;
    slot.userData.role = `${role}-fixed-white-slot`;
    group.add(shaft, head, slot);
    return { group, head, shaft, slot };
  };
  const upperPivotParts = makePivotHardware(
    upperPivot,
    'fixed-upper-quadrant-handle-pivot',
  );
  const lowerPivotParts = makePivotHardware(
    lowerPivot,
    'fixed-lower-quadrant-handle-pivot',
  );

  const makeHangingWeight = (role) => {
    const group = new THREE.Group();
    group.position.z = handlePlaneZ;
    group.userData.role = role;
    const foregroundZ = lowerQuadrantPlaneZ
      + lowerQuadrantDepth / 2 + 0.16;
    const connector = cylinderAlongZ(
      0.045,
      foregroundZ - handlePlaneZ,
      darkMaterial,
      18,
    );
    connector.position.z = (foregroundZ - handlePlaneZ) / 2;
    connector.userData.role = `${role}-depth-bridging-eye-pin`;
    const rodLength = 1.04;
    const rod = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, rodLength, 0.07),
      darkMaterial,
    );
    rod.position.set(0, -rodLength / 2, foregroundZ);
    rod.userData.role = `${role}-vertical-rod`;
    const weight = new THREE.Mesh(
      new THREE.BoxGeometry(0.30, 0.46, 0.24),
      weightMaterial,
    );
    weight.position.set(0, -rodLength - 0.23, foregroundZ);
    weight.userData.role = `${role}-gravity-weight`;
    group.add(connector, rod, weight);
    return {
      connector,
      foregroundZ,
      group,
      rod,
      weight,
    };
  };
  const upperWeightParts = makeHangingWeight(
    'upper-quadrant-handle-hanging-back-weight',
  );
  const lowerWeightParts = makeHangingWeight(
    'lower-quadrant-handle-hanging-back-weight',
  );

  const tappetContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 20, 14),
    whiteMaterial,
  );
  tappetContactMarker.userData.role = 'visible-active-piston-tappet-contact';
  const bottomLatchMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 18, 12),
    whiteMaterial,
  );
  bottomLatchMarker.userData.role = 'visible-source-183-lower-quadrant-latch';
  const topLatchMarker = bottomLatchMarker.clone();
  topLatchMarker.userData.role = 'visible-source-184-upper-quadrant-latch';

  root.add(
    upperHandleParts.group,
    lowerHandleParts.group,
    pistonGroup,
    upperPivotParts.group,
    lowerPivotParts.group,
    upperWeightParts.group,
    lowerWeightParts.group,
    tappetContactMarker,
    bottomLatchMarker,
    topLatchMarker,
  );

  const update = (time) => {
    const state = stateAtTime(time);
    upperHandleParts.group.rotation.z = state.upperHandleAngle;
    upperHandleParts.group.userData.angularVelocity =
      state.upperHandleAngularVelocity;
    lowerHandleParts.group.rotation.z = state.lowerHandleAngle;
    lowerHandleParts.group.userData.angularVelocity =
      state.lowerHandleAngularVelocity;
    pistonGroup.position.y = state.pistonPosition.y;
    pistonGroup.userData.velocity = state.pistonVelocity.clone();
    upperWeightParts.group.position.set(
      state.upperWeightPin.x,
      state.upperWeightPin.y,
      handlePlaneZ,
    );
    lowerWeightParts.group.position.set(
      state.lowerWeightPin.x,
      state.lowerWeightPin.y,
      handlePlaneZ,
    );
    tappetContactMarker.visible = false;
    if (state.activeContactPoint) {
      tappetContactMarker.position.set(
        state.activeContactPoint.x,
        state.activeContactPoint.y,
        lowerQuadrantPlaneZ + lowerQuadrantDepth / 2 + 0.18,
      );
    }
    bottomLatchMarker.visible = false;
    bottomLatchMarker.position.set(
      (state.lowerBottomHookPoint.x + state.upperBottomSeatPoint.x) / 2,
      (state.lowerBottomHookPoint.y + state.upperBottomSeatPoint.y) / 2,
      lowerQuadrantPlaneZ + lowerQuadrantDepth / 2 + 0.12,
    );
    topLatchMarker.visible = false;
    topLatchMarker.position.set(
      (state.upperTopHookPoint.x + state.lowerTopSeatPoint.x) / 2,
      (state.upperTopHookPoint.y + state.lowerTopSeatPoint.y) / 2,
      lowerQuadrantPlaneZ + lowerQuadrantDepth / 2 + 0.12,
    );
    root.userData.contacts = {
      activeTappetContact: state.activeContact,
      bottomQuadrantLatch: {
        engagement: state.bottomLatchEngagement,
        gap: state.bottomLatchGap,
      },
      lowerHandle: {
        contactError: state.lowerTappetContactError,
        contactPoint: state.lowerHandleContactPoint.clone(),
      },
      topQuadrantLatch: {
        engagement: state.topLatchEngagement,
        gap: state.topLatchGap,
      },
      upperHandle: {
        contactError: state.upperTappetContactError,
        contactPoint: state.upperHandleContactPoint.clone(),
      },
    };
    root.userData.kinematics = state;
    root.userData.valves = {
      lowerEductionOpenFraction: state.lowerEductionOpenFraction,
      lowerSteamOpenFraction: state.lowerSteamOpenFraction,
      upperEductionOpenFraction: state.upperEductionOpenFraction,
      upperSteamOpenFraction: state.upperSteamOpenFraction,
    };
  };

  const canonicalStates = {
    source183Ascending: {
      ...baseStateAtCyclePhase(0),
      canonicalStage: 'source-183-lower-steam-and-upper-eduction-open',
    },
    lowerTripMidpoint: {
      ...baseStateAtCyclePhase(
        (sequenceBreaks.upwardApproachEnd
          + sequenceBreaks.lowerTripEnd) / 2,
      ),
      canonicalStage: 'ascending-lower-quadrant-releases-upper-handle',
    },
    source184Top: {
      ...baseStateAtCyclePhase(
        (sequenceBreaks.upwardOvertravelEnd
          + sequenceBreaks.source184HoldEnd) / 2,
      ),
      canonicalStage: 'source-184-upper-steam-and-lower-eduction-open',
    },
    upperTripMidpoint: {
      ...baseStateAtCyclePhase(
        (sequenceBreaks.downwardApproachEnd
          + sequenceBreaks.upperTripEnd) / 2,
      ),
      canonicalStage: 'descending-upper-quadrant-releases-lower-handle',
    },
    source183Returned: {
      ...baseStateAtCyclePhase(0.96),
      canonicalStage: 'source-183-returned-after-full-cycle',
    },
  };

  const geometry = {
    axis: Z_AXIS.clone(),
    bottomLatchPoint: bottomLatchPoint.clone(),
    contactRollerRadius,
    cyclePeriod,
    frameCenterZ,
    frameDepth,
    handleDepth,
    handlePlaneZ,
    initialBasePhase,
    latchPinRadius,
    lowerBottomHookLocal: lowerBottomHookLocal.clone(),
    lowerContactLocal: lowerContactLocal.clone(),
    lowerDrivenTopState,
    lowerPivot: lowerPivot.clone(),
    lowerQuadrantDepth,
    lowerQuadrantEndAngle,
    lowerQuadrantInnerRadius,
    lowerQuadrantOuterRadius,
    lowerQuadrantPlaneZ,
    lowerQuadrantStartAngle,
    lowerReleasePistonY,
    lowerSource184WeightResidual,
    lowerStrikePistonY,
    lowerSlidingContactX,
    lowerTopSeatLocal: lowerTopSeatLocal.clone(),
    lowerWeightLocal: lowerWeightLocal.clone(),
    movementId,
    pistonRodX,
    publicBasePhaseWrap,
    publicSequenceBreaks,
    sequenceBreaks,
    source183BottomLatchPoint: source183BottomLatchPoint.clone(),
    source183LowerAngle,
    source183LowerContact: source183LowerContact.clone(),
    source183LowerFreeTip: source183LowerFreeTip.clone(),
    source183LowerPivot: source183LowerPivot.clone(),
    source183LowerWeightPin: source183LowerWeightPin.clone(),
    source183Origin: source183Origin.clone(),
    source183PistonRodCenterX,
    source183PistonY,
    source183TappetCenter: source183TappetCenter.clone(),
    source183UpperAngle,
    source183UpperPivot: source183UpperPivot.clone(),
    source183UpperWeightPin: source183UpperWeightPin.clone(),
    source184LowerAngle,
    source184LowerPivot: source184LowerPivot.clone(),
    source184LowerWeightPin: source184LowerWeightPin.clone(),
    source184Origin: source184Origin.clone(),
    source184PistonY,
    source184TappetCenter: source184TappetCenter.clone(),
    source184TopLatchPoint: source184TopLatchPoint.clone(),
    source184UpperAngle,
    source184UpperContact: source184UpperContact.clone(),
    source184UpperFreeTip: source184UpperFreeTip.clone(),
    source184UpperPivot: source184UpperPivot.clone(),
    source184UpperWeightPin: source184UpperWeightPin.clone(),
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    tappetHalfHeight,
    tappetShoeLeftX,
    tappetShoeRightX,
    topLatchPoint: topLatchPoint.clone(),
    upperBottomSeatLocal: upperBottomSeatLocal.clone(),
    upperContactLocal: upperContactLocal.clone(),
    upperDrivenTopState,
    upperPivot: upperPivot.clone(),
    upperQuadrantDepth,
    upperQuadrantEndAngle,
    upperQuadrantInnerRadius,
    upperQuadrantOuterRadius,
    upperQuadrantPlaneZ,
    upperQuadrantStartAngle,
    upperReleasePistonY,
    upperSlidingContactX,
    upperSource184WeightResidual,
    upperStrikePistonY,
    upperTopHookLocal: upperTopHookLocal.clone(),
    upperWeightLocal: upperWeightLocal.clone(),
    weightForegroundZ: upperWeightParts.foregroundZ,
  };

  root.userData.archetype = isSource184Variant
    ? 'double-backweighted-valve-handles-mutually-latching-quadrants-piston-tappet-position-184'
    : 'double-backweighted-valve-handles-mutually-latching-quadrants-piston-tappet-position-183';
  root.userData.baseStateAtCyclePhase = baseStateAtCyclePhase;
  root.userData.blocks = {
    bottomLatchMarker,
    frameSpine,
    lowerBottomHookAnchor,
    lowerCrossbar,
    lowerHandle: lowerHandleParts.group,
    lowerHandleContactAnchor: lowerHandleParts.contactAnchor,
    lowerHandleContactRoller: lowerHandleParts.contactRoller,
    lowerHandleHub: lowerHandleParts.hub,
    lowerHandleIndex: lowerHandleParts.index,
    lowerHandleWeightAnchor: lowerHandleParts.weightAnchor,
    lowerHandleWeightArm: lowerHandleParts.weightArm,
    lowerHandleWorkingArm: lowerHandleParts.workingArm,
    lowerHandleWorkingTip: lowerHandleParts.workingTip,
    lowerPivot: lowerPivotParts.group,
    lowerPivotHead: lowerPivotParts.head,
    lowerPivotShaft: lowerPivotParts.shaft,
    lowerPivotSlot: lowerPivotParts.slot,
    lowerQuadrant: lowerQuadrantParts.group,
    lowerQuadrantBand: lowerQuadrantParts.band,
    lowerQuadrantEndSpoke: lowerQuadrantParts.endSpoke,
    lowerQuadrantIndex: lowerQuadrantParts.index,
    lowerQuadrantStartSpoke: lowerQuadrantParts.startSpoke,
    lowerTopSeatAnchor,
    lowerTopSeatPin,
    lowerWeight: lowerWeightParts.weight,
    lowerWeightAssembly: lowerWeightParts.group,
    lowerWeightConnector: lowerWeightParts.connector,
    lowerWeightRod: lowerWeightParts.rod,
    pistonGroup,
    pistonGuide,
    pistonRod,
    tappet,
    tappetAnchor,
    tappetContactMarker,
    tappetIndex,
    topLatchMarker,
    upperBottomSeatAnchor,
    upperBottomSeatPin,
    upperCrossbar,
    upperHandle: upperHandleParts.group,
    upperHandleContactAnchor: upperHandleParts.contactAnchor,
    upperHandleContactRoller: upperHandleParts.contactRoller,
    upperHandleHub: upperHandleParts.hub,
    upperHandleIndex: upperHandleParts.index,
    upperHandleWeightAnchor: upperHandleParts.weightAnchor,
    upperHandleWeightArm: upperHandleParts.weightArm,
    upperHandleWorkingArm: upperHandleParts.workingArm,
    upperHandleWorkingTip: upperHandleParts.workingTip,
    upperPivot: upperPivotParts.group,
    upperPivotHead: upperPivotParts.head,
    upperPivotShaft: upperPivotParts.shaft,
    upperPivotSlot: upperPivotParts.slot,
    upperQuadrant: upperQuadrantParts.group,
    upperQuadrantBand: upperQuadrantParts.band,
    upperQuadrantEndSpoke: upperQuadrantParts.endSpoke,
    upperQuadrantIndex: upperQuadrantParts.index,
    upperQuadrantStartSpoke: upperQuadrantParts.startSpoke,
    upperTopHookAnchor,
    upperWeight: upperWeightParts.weight,
    upperWeightAssembly: upperWeightParts.group,
    upperWeightConnector: upperWeightParts.connector,
    upperWeightRod: upperWeightParts.rod,
  };
  // Contact points remain available in userData for diagnostics. The engraving
  // has no floating contact spheres or ground beneath this sectional mechanism.
  root.userData.hideGround = true;
  root.userData.cameraDistanceScale = 1.16;
  root.userData.canonicalStates = canonicalStates;
  root.userData.cyclePhaseToBasePhase = cyclePhaseToBasePhase;
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.mechanism = isSource184Variant
    ? 'top-position-descending-piston-tappet-trips-upper-quadrant-handle-releases-lower-backweighted-quadrant-handle-and-restores-four-valves'
    : 'ascending-piston-tappet-trips-lower-quadrant-handle-releases-upper-backweighted-quadrant-handle-and-reverses-four-valves';
  root.userData.modelPointToSource183 = modelPointToSource183;
  root.userData.modelVectorToSource = modelVectorToSource;
  root.userData.source183PointToModel = source183PointToModel;
  root.userData.source184PointToModel = source184PointToModel;
  root.userData.sourceVectorToModel = sourceVectorToModel;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.topStateLawAtCyclePhase = topStateLawAtCyclePhase;
  root.userData.variant = isSource184Variant
    ? 'source-184-top-of-cylinder-initial-pose'
    : 'source-183-ascending-stroke-initial-pose';

  update(0);
  markShadows(root);
  for (const marker of [
    bottomLatchMarker,
    tappetContactMarker,
    topLatchMarker,
  ]) {
    marker.castShadow = false;
  }
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;

  const finiteUpdate = correctQuadrantCatchInterfaces(root, update);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update: finiteUpdate,
  };
}

export function createAuthoredQuadrantCatchMovement(movement) {
  if (movement.id !== 183 && movement.id !== 184) return null;
  return sourceScaledQuadrantHandGear({ movementId: movement.id });
}
