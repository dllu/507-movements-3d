import * as THREE from 'three';
import {plate as finitePlate, poly, circle, ring, polygonClipping as clip} from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
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

function smoothPulse01(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 64 * u ** 3 * (1 - u) ** 3;
}

function smoothPulseFirstDerivative(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 192 * u ** 2 * (1 - u) ** 2 * (1 - 2 * u);
}

function smoothPulseSecondDerivative(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 384 * u * (1 - u) * (1 - 5 * u + 5 * u ** 2);
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

function variableWidthPlate({
  centerline,
  depth,
  material,
  role,
  sampleCount = 72,
  widths,
}) {
  const curve = new THREE.CatmullRomCurve3(
    centerline.map((point) => new THREE.Vector3(point.x, point.y, 0)),
    false,
    'centripetal',
  );
  const left = [];
  const right = [];
  for (let index = 0; index <= sampleCount; index += 1) {
    const parameter = index / sampleCount;
    const point = curve.getPoint(parameter);
    const tangent = curve.getTangent(parameter).normalize();
    const halfWidth = interpolateWidth(widths, parameter);
    const normal = new THREE.Vector3(-tangent.y, tangent.x, 0);
    left.push(point.clone().addScaledVector(normal, halfWidth));
    right.push(point.clone().addScaledVector(normal, -halfWidth));
  }
  const perimeter = [...left, ...right.reverse()];
  const group = new THREE.Group();
  group.userData.role = role;
  const plate = new THREE.Mesh(
    finitePlate(clip.difference(poly(perimeter.map(p=>[p.x,p.y])),poly(circle([0,0],.12,96))),-depth/2,depth/2),
    material,
  );
  plate.userData.role = `${role}-plate`;
  group.add(plate);
  return { group, plate };
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
    u,
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

function sourceScaledDiagonalCatchHandGear({ movementId }) {
  const root = new THREE.Group();
  const isSource182Variant = movementId === 182;

  // Brown supplies two engravings of this one mechanism. Movement 181 is the
  // ascending-stroke pose; Movement 182 is the top-of-cylinder pose after the
  // lower handle has tripped. Each figure below was measured independently,
  // while vectors are re-anchored on common fixed axes so the interpolated 3D
  // mechanism remains rigid instead of inheriting small engraving drift.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.0125;
  const source181CatchPivot = new THREE.Vector2(271, 234);
  const source181UpperPivot = new THREE.Vector2(275, 122);
  const source181LowerPivot = new THREE.Vector2(273, 351);
  const source181PistonRodCenterX = 177;
  const source181TappetCenter = new THREE.Vector2(183, 365);
  const source181UpperWeightPin = new THREE.Vector2(402, 54);
  const source181LowerWeightPin = new THREE.Vector2(137, 422);
  const source181CatchWeightPin = new THREE.Vector2(370, 354);
  const source181LowerFreeTip = new THREE.Vector2(82, 315);
  const source181LowerContact = new THREE.Vector2(177, 320);
  const source181UpperLatchSeat = new THREE.Vector2(202, 137);
  const source181LowerLatchSeat = new THREE.Vector2(354, 348);

  const source182CatchPivot = new THREE.Vector2(270, 236);
  const source182UpperPivot = new THREE.Vector2(273, 120);
  const source182LowerPivot = new THREE.Vector2(269, 351);
  const source182TappetCenter = new THREE.Vector2(184, 79);
  const source182UpperWeightPin = new THREE.Vector2(408, 170);
  const source182LowerWeightPin = new THREE.Vector2(127, 305);
  const source182CatchWeightPin = new THREE.Vector2(370, 359);
  const source182UpperFreeTip = new THREE.Vector2(66, 154);
  const source182UpperContact = new THREE.Vector2(177, 154);

  const source181PointToModel = (point) => new THREE.Vector2(
    (point.x - source181CatchPivot.x) * sourceScale,
    (source181CatchPivot.y - point.y) * sourceScale,
  );
  const modelPointToSource181 = (point) => new THREE.Vector2(
    source181CatchPivot.x + point.x / sourceScale,
    source181CatchPivot.y - point.y / sourceScale,
  );
  const sourceVectorToModel = (point, pivot) => new THREE.Vector2(
    (point.x - pivot.x) * sourceScale,
    (pivot.y - point.y) * sourceScale,
  );
  const modelVectorToSource = (vector) => new THREE.Vector2(
    vector.x / sourceScale,
    -vector.y / sourceScale,
  );

  const catchPivot = source181PointToModel(source181CatchPivot);
  const upperPivot = source181PointToModel(source181UpperPivot);
  const lowerPivot = source181PointToModel(source181LowerPivot);
  const pistonRodX = (source181PistonRodCenterX
    - source181CatchPivot.x) * sourceScale;
  const source181PistonY = source181PointToModel(
    source181TappetCenter,
  ).y;
  const source182PistonY = (
    source182CatchPivot.y - source182TappetCenter.y
  ) * sourceScale;

  const upperWeightLocal = sourceVectorToModel(
    source181UpperWeightPin,
    source181UpperPivot,
  );
  const lowerWeightLocal = sourceVectorToModel(
    source181LowerWeightPin,
    source181LowerPivot,
  );
  const catchWeightLocal = sourceVectorToModel(
    source181CatchWeightPin,
    source181CatchPivot,
  );
  const source182UpperWeightVector = sourceVectorToModel(
    source182UpperWeightPin,
    source182UpperPivot,
  );
  const source182LowerWeightVector = sourceVectorToModel(
    source182LowerWeightPin,
    source182LowerPivot,
  );
  const source182CatchWeightVector = sourceVectorToModel(
    source182CatchWeightPin,
    source182CatchPivot,
  );
  const source181UpperAngle = 0;
  const source181LowerAngle = 0;
  const source182UpperAngle = signedAngleBetween(
    upperWeightLocal,
    source182UpperWeightVector,
  );
  const source182LowerAngle = signedAngleBetween(
    lowerWeightLocal,
    source182LowerWeightVector,
  );
  const stableCatchAngle = 0;
  const catchTripDeflection = 0.085;

  const source182UpperFreeCenterline = [
    [254, 128],
    [229, 141],
    [203, 151],
    [168, 156],
    [126, 156],
    [91, 155],
    [66, 154],
  ].map(([x, y]) => sourceVectorToModel(
    new THREE.Vector2(x, y),
    source182UpperPivot,
  ));
  const upperWorkingCenterline = source182UpperFreeCenterline.map(
    (point) => rotateVector2(point, -source182UpperAngle),
  );
  const lowerWorkingCenterline = [
    [253, 346],
    [228, 338],
    [204, 326],
    [177, 315],
    [143, 309],
    [109, 309],
    [82, 315],
  ].map(([x, y]) => sourceVectorToModel(
    new THREE.Vector2(x, y),
    source181LowerPivot,
  ));

  const upperContactLocal = rotateVector2(
    sourceVectorToModel(source182UpperContact, source182UpperPivot),
    -source182UpperAngle,
  );
  const lowerContactLocal = sourceVectorToModel(
    source181LowerContact,
    source181LowerPivot,
  );
  const upperLatchSeat = source181PointToModel(source181UpperLatchSeat);
  const lowerLatchSeat = source181PointToModel(source181LowerLatchSeat);
  const upperLatchLocal = upperLatchSeat.clone().sub(upperPivot);
  const lowerLatchLocal = rotateVector2(
    lowerLatchSeat.clone().sub(lowerPivot),
    -source182LowerAngle,
  );

  const upperSource182WeightResidual = Math.abs(
    upperWeightLocal.length() - source182UpperWeightVector.length(),
  ) / sourceScale;
  const lowerSource182WeightResidual = Math.abs(
    lowerWeightLocal.length() - source182LowerWeightVector.length(),
  ) / sourceScale;
  const catchSource182WeightResidual = Math.abs(
    catchWeightLocal.length() - source182CatchWeightVector.length(),
  ) / sourceScale;

  const tappetHalfHeight = 0.25;
  const contactRollerRadius = 0.10;
  const latchRollerRadius = 0.105;
  const handleDepth = 0.20;
  const handlePlaneZ = 0.00;
  const upperHandlePlaneZ = -.12;
  const lowerHandlePlaneZ = .12;
  const catchDepth = 0.22;
  const catchPlaneZ = 0.40;
  const frameCenterZ = -0.48;
  const frameDepth = 0.52;
  const cyclePeriod = 18;
  const sequenceBreaks = Object.freeze({
    source181HoldEnd: 0.08,
    upwardApproachEnd: 0.20,
    lowerTripEnd: 0.34,
    upwardOvertravelEnd: 0.44,
    source182HoldEnd: 0.52,
    downwardApproachEnd: 0.64,
    upperTripEnd: 0.78,
    downwardOvertravelEnd: 0.92,
  });

  const baseTopStateLawAtCyclePhase = (phaseValue) => {
    const phase = THREE.MathUtils.clamp(phaseValue, 0, 1);
    if (phase < sequenceBreaks.upwardApproachEnd) {
      return { first: 0, second: 0, value: 0 };
    }
    if (phase < sequenceBreaks.lowerTripEnd) {
      return intervalLaw(
        phase,
        sequenceBreaks.upwardApproachEnd,
        sequenceBreaks.lowerTripEnd,
      );
    }
    if (phase < sequenceBreaks.downwardApproachEnd) {
      return { first: 0, second: 0, value: 1 };
    }
    if (phase < sequenceBreaks.upperTripEnd) {
      const law = intervalLaw(
        phase,
        sequenceBreaks.downwardApproachEnd,
        sequenceBreaks.upperTripEnd,
      );
      return {
        first: -law.first,
        second: -law.second,
        value: 1 - law.value,
      };
    }
    return { first: 0, second: 0, value: 0 };
  };

  const baseCatchLawAtCyclePhase = (phaseValue) => {
    const phase = THREE.MathUtils.clamp(phaseValue, 0, 1);
    let start;
    let end;
    let direction;
    if (
      phase >= sequenceBreaks.upwardApproachEnd
      && phase < sequenceBreaks.lowerTripEnd
    ) {
      start = sequenceBreaks.upwardApproachEnd;
      end = sequenceBreaks.lowerTripEnd;
      direction = 1;
    } else if (
      phase >= sequenceBreaks.downwardApproachEnd
      && phase < sequenceBreaks.upperTripEnd
    ) {
      start = sequenceBreaks.downwardApproachEnd;
      end = sequenceBreaks.upperTripEnd;
      direction = -1;
    } else {
      return { first: 0, second: 0, value: stableCatchAngle };
    }
    const width = end - start;
    const u = THREE.MathUtils.clamp((phase - start) / width, 0, 1);
    return {
      first: direction * catchTripDeflection
        * smoothPulseFirstDerivative(u) / width,
      second: direction * catchTripDeflection
        * smoothPulseSecondDerivative(u) / width ** 2,
      value: stableCatchAngle
        + direction * catchTripDeflection * smoothPulse01(u),
    };
  };

  const stablePoint = (pivot, localPoint, angle) => pivot.clone().add(
    rotateVector2(localPoint, angle),
  );
  const lowerStrikePistonY = stablePoint(
    lowerPivot,
    lowerContactLocal,
    source181LowerAngle,
  ).y - contactRollerRadius - tappetHalfHeight;
  const lowerReleasePistonY = stablePoint(
    lowerPivot,
    lowerContactLocal,
    source182LowerAngle,
  ).y - contactRollerRadius - tappetHalfHeight;
  const upperStrikePistonY = stablePoint(
    upperPivot,
    upperContactLocal,
    source182UpperAngle,
  ).y + contactRollerRadius + tappetHalfHeight;
  const upperReleasePistonY = stablePoint(
    upperPivot,
    upperContactLocal,
    source181UpperAngle,
  ).y + contactRollerRadius + tappetHalfHeight;

  const stageAtCyclePhase = (phase) => {
    if (phase < sequenceBreaks.source181HoldEnd) {
      return 'source-181-ascending-stroke-pose-hold';
    }
    if (phase < sequenceBreaks.upwardApproachEnd) {
      return 'ascending-tappet-approaches-lower-handle';
    }
    if (phase < sequenceBreaks.lowerTripEnd) {
      return 'ascending-tappet-trips-lower-handle-and-releases-upper';
    }
    if (phase < sequenceBreaks.upwardOvertravelEnd) {
      return 'ascending-after-valve-reversal-to-top';
    }
    if (phase < sequenceBreaks.source182HoldEnd) {
      return 'source-182-top-of-cylinder-pose-hold';
    }
    if (phase < sequenceBreaks.downwardApproachEnd) {
      return 'descending-tappet-approaches-upper-handle';
    }
    if (phase < sequenceBreaks.upperTripEnd) {
      return 'descending-tappet-trips-upper-handle-and-releases-lower';
    }
    if (phase < sequenceBreaks.downwardOvertravelEnd) {
      return 'descending-after-valve-reversal-to-bottom';
    }
    return 'source-181-returned-pose-hold';
  };

  const baseStateAtCyclePhase = (phaseValue) => {
    const phase = THREE.MathUtils.clamp(phaseValue, 0, 1);
    const topState = baseTopStateLawAtCyclePhase(phase);
    const upperAngleState = {
      first: (source182UpperAngle - source181UpperAngle) * topState.first,
      second: (source182UpperAngle - source181UpperAngle) * topState.second,
      value: THREE.MathUtils.lerp(
        source181UpperAngle,
        source182UpperAngle,
        topState.value,
      ),
    };
    const lowerAngleState = {
      first: (source182LowerAngle - source181LowerAngle) * topState.first,
      second: (source182LowerAngle - source181LowerAngle) * topState.second,
      value: THREE.MathUtils.lerp(
        source181LowerAngle,
        source182LowerAngle,
        topState.value,
      ),
    };
    const catchAngleState = baseCatchLawAtCyclePhase(phase);
    const upperContact = rigidPointPhaseState(
      upperPivot,
      upperContactLocal,
      upperAngleState,
    );
    const lowerContact = rigidPointPhaseState(
      lowerPivot,
      lowerContactLocal,
      lowerAngleState,
    );
    const upperLatch = rigidPointPhaseState(
      upperPivot,
      upperLatchLocal,
      upperAngleState,
    );
    const lowerLatch = rigidPointPhaseState(
      lowerPivot,
      lowerLatchLocal,
      lowerAngleState,
    );
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
    const catchWeight = rigidPointPhaseState(
      catchPivot,
      catchWeightLocal,
      catchAngleState,
    );
    const upperSeat = rigidPointPhaseState(
      catchPivot,
      upperLatchSeat.clone().sub(catchPivot),
      catchAngleState,
    );
    const lowerSeat = rigidPointPhaseState(
      catchPivot,
      lowerLatchSeat.clone().sub(catchPivot),
      catchAngleState,
    );

    let pistonState;
    if (phase < sequenceBreaks.source181HoldEnd) {
      pistonState = { first: 0, second: 0, value: source181PistonY };
    } else if (phase < sequenceBreaks.upwardApproachEnd) {
      pistonState = scalarTransition(
        phase,
        sequenceBreaks.source181HoldEnd,
        sequenceBreaks.upwardApproachEnd,
        source181PistonY,
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
        source182PistonY,
      );
    } else if (phase < sequenceBreaks.source182HoldEnd) {
      pistonState = { first: 0, second: 0, value: source182PistonY };
    } else if (phase < sequenceBreaks.downwardApproachEnd) {
      pistonState = scalarTransition(
        phase,
        sequenceBreaks.source182HoldEnd,
        sequenceBreaks.downwardApproachEnd,
        source182PistonY,
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
        source181PistonY,
      );
    } else {
      pistonState = { first: 0, second: 0, value: source181PistonY };
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
    const lowerTripActive = stage
      === 'ascending-tappet-trips-lower-handle-and-releases-upper';
    const upperTripActive = stage
      === 'descending-tappet-trips-upper-handle-and-releases-lower';
    const activeContactPoint = lowerTripActive
      ? lowerContact.point.clone()
      : upperTripActive
        ? upperContact.point.clone()
        : null;
    const pistonVelocity = pistonState.first * phaseRate;

    return {
      activeCatch: topState.value < 0.5 ? 'upper-handle' : 'lower-handle',
      activeContact: lowerTripActive
        ? 'lower-handle'
        : upperTripActive
          ? 'upper-handle'
          : null,
      activeContactPoint,
      catchAngle: catchAngleState.value,
      catchAngularAcceleration: catchAngleState.second
        * phaseAccelerationRate,
      catchAngularVelocity: catchAngleState.first * phaseRate,
      catchWeightAcceleration: timeAccelerationVector(
        catchWeight.phaseAcceleration,
      ),
      catchWeightPin: catchWeight.point,
      catchWeightVelocity: timeVector(catchWeight.phaseVelocity),
      lowerEductionOpenFraction: topState.value,
      lowerHandleAngle: lowerAngleState.value,
      lowerHandleAngularAcceleration: lowerAngleState.second
        * phaseAccelerationRate,
      lowerHandleAngularVelocity: lowerAngleState.first * phaseRate,
      lowerHandleContactAcceleration: timeAccelerationVector(
        lowerContact.phaseAcceleration,
      ),
      lowerHandleContactPoint: lowerContact.point,
      lowerHandleContactVelocity: timeVector(lowerContact.phaseVelocity),
      lowerLatchEngagement: topState.value,
      lowerLatchGap: lowerLatch.point.distanceTo(lowerSeat.point),
      lowerLatchPoint: lowerLatch.point,
      lowerLatchSeat: lowerSeat.point,
      lowerSteamOpenFraction: 1 - topState.value,
      lowerTappetContactError: lowerContactError,
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
      topStateAcceleration: topState.second * phaseAccelerationRate,
      topStateBlend: topState.value,
      topStateVelocity: topState.first * phaseRate,
      upperEductionOpenFraction: 1 - topState.value,
      upperHandleAngle: upperAngleState.value,
      upperHandleAngularAcceleration: upperAngleState.second
        * phaseAccelerationRate,
      upperHandleAngularVelocity: upperAngleState.first * phaseRate,
      upperHandleContactAcceleration: timeAccelerationVector(
        upperContact.phaseAcceleration,
      ),
      upperHandleContactPoint: upperContact.point,
      upperHandleContactVelocity: timeVector(upperContact.phaseVelocity),
      upperLatchEngagement: 1 - topState.value,
      upperLatchGap: upperLatch.point.distanceTo(upperSeat.point),
      upperLatchPoint: upperLatch.point,
      upperLatchSeat: upperSeat.point,
      upperSteamOpenFraction: topState.value,
      upperTappetContactError: upperContactError,
      upperWeightAcceleration: timeAccelerationVector(
        upperWeight.phaseAcceleration,
      ),
      upperWeightPin: upperWeight.point,
      upperWeightVelocity: timeVector(upperWeight.phaseVelocity),
    };
  };

  const initialBasePhase = isSource182Variant
    ? (sequenceBreaks.upwardOvertravelEnd
      + sequenceBreaks.source182HoldEnd) / 2
    : 0;
  const publicBasePhaseWrap = initialBasePhase === 0
    ? 1
    : 1 - initialBasePhase;
  const publicSequenceBreaks = isSource182Variant
    ? Object.freeze(Object.fromEntries(
      Object.entries(sequenceBreaks).map(([name, basePhase]) => [
        name,
        positiveModulo(basePhase - initialBasePhase, 1),
      ]),
    ))
    : sequenceBreaks;
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
  const catchLawAtCyclePhase = (phaseValue) => baseCatchLawAtCyclePhase(
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
  const catchMaterial = matte(PALETTE.accent, {
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
  frameSpine.position.set(0.02, 0.02, frameCenterZ);
  frameSpine.userData.role = 'fixed-column-carrying-three-aligned-pivots';
  const pistonGuide = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 7.85, 0.34),
    frameMaterial,
  );
  pistonGuide.position.set(pistonRodX, 0.15, -0.30);
  pistonGuide.userData.role = 'fixed-vertical-guide-behind-piston-rod';
  const upperCrossbar = new THREE.Mesh(
    new THREE.BoxGeometry(
      Math.abs(pistonRodX) + 0.38,
      0.24,
      frameDepth,
    ),
    frameMaterial,
  );
  upperCrossbar.position.set(pistonRodX / 2, 2.22, frameCenterZ);
  upperCrossbar.userData.role = 'upper-fixed-frame-crossbar';
  const lowerCrossbar = upperCrossbar.clone();
  lowerCrossbar.position.y = -2.22;
  lowerCrossbar.userData.role = 'lower-fixed-frame-crossbar';
  root.add(frameSpine, pistonGuide, upperCrossbar, lowerCrossbar);

  const makeHandle = ({
    contactLocal,
    latchLocal,
    pivot,
    planeZ,
    role,
    workingCenterline,
    weightLocal,
  }) => {
    const group = new THREE.Group();
    group.position.set(pivot.x, pivot.y, planeZ);
    group.userData.axis = Z_AXIS.clone();
    group.userData.role = role;
    const working = variableWidthPlate({
      centerline: workingCenterline,
      depth: handleDepth,
      material: handleMaterial,
      role: `${role}-curved-tappet-arm`,
      widths: [0.20, 0.17, 0.145, 0.12],
    });
    const latchCurve = [
      new THREE.Vector2(0, 0),
      latchLocal.clone().multiplyScalar(0.46).add(
        new THREE.Vector2(-0.08, 0.02),
      ),
      latchLocal.clone(),
    ];
    const latchArm = variableWidthPlate({
      centerline: latchCurve,
      depth: handleDepth,
      material: handleMaterial,
      role: `${role}-catch-engaging-finger`,
      sampleCount: 48,
      widths: [0.19, 0.14, 0.10],
    });
    const weightCurve = [
      new THREE.Vector2(0, 0),
      weightLocal.clone().multiplyScalar(0.52),
      weightLocal.clone(),
    ];
    const weightArm = variableWidthPlate({
      centerline: weightCurve,
      depth: handleDepth * 0.86,
      material: handleMaterial,
      role: `${role}-back-weight-arm`,
      sampleCount: 48,
      widths: [0.18, 0.13, 0.075],
    });
    const hub = new THREE.Mesh(ring(.12,.43,-handleDepth*.56,handleDepth*.56,96),handleMaterial);
    hub.userData.role = `${role}-source-scale-rocking-hub`;
    const hubRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.055, 10, 48),
      darkMaterial,
    );
    hubRing.position.z = handleDepth / 2 + 0.035;
    hubRing.userData.role = `${role}-dark-hub-ring`;
    const weightEye = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.055, 10, 36),
      darkMaterial,
    );
    weightEye.position.set(
      weightLocal.x,
      weightLocal.y,
      handleDepth / 2 + 0.032,
    );
    weightEye.userData.role = `${role}-back-weight-eye`;
    const contactRoller = cylinderAlongZ(
      contactRollerRadius,
      handleDepth * 1.18,
      darkMaterial,
      28,
    );
    contactRoller.position.set(contactLocal.x, contactLocal.y, 0);
    contactRoller.userData.role = `${role}-piston-tappet-contact-roller`;
    const latchRollerLength = catchPlaneZ - planeZ + catchDepth * 0.62;
    const latchRoller = cylinderAlongZ(
      latchRollerRadius,
      latchRollerLength,
      darkMaterial,
      28,
    );
    latchRoller.position.set(
      latchLocal.x,
      latchLocal.y,
      latchRollerLength / 2 - handleDepth / 2,
    );
    latchRoller.userData.role = `${role}-roller-entering-diagonal-catch-pocket`;
    const workingTip = cylinderAlongZ(
      0.15,
      handleDepth * 1.04,
      handleMaterial,
      30,
    );
    const lastWorkingPoint = workingCenterline.at(-1);
    workingTip.position.set(lastWorkingPoint.x, lastWorkingPoint.y, 0);
    workingTip.userData.role = `${role}-rounded-working-handle-tip`;
    const index = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.045, 0.028),
      whiteMaterial,
    );
    index.position.set(0.27, 0, handleDepth / 2 + 0.06);
    index.userData.role = `${role}-white-rocking-angle-index`;
    const weightAnchor = new THREE.Object3D();
    weightAnchor.position.set(weightLocal.x, weightLocal.y, 0);
    weightAnchor.userData.role = `${role}-exact-back-weight-pin-anchor`;
    const contactAnchor = new THREE.Object3D();
    contactAnchor.position.set(contactLocal.x, contactLocal.y, 0);
    contactAnchor.userData.role = `${role}-exact-tappet-contact-anchor`;
    const latchAnchor = new THREE.Object3D();
    latchAnchor.position.set(latchLocal.x, latchLocal.y, 0);
    latchAnchor.userData.role = `${role}-exact-latch-roller-anchor`;
    group.add(
      working.group,
      latchArm.group,
      weightArm.group,
      hub,
      hubRing,
      weightEye,
      contactRoller,
      latchRoller,
      workingTip,
      index,
      weightAnchor,
      contactAnchor,
      latchAnchor,
    );
    return {
      contactAnchor,
      contactRoller,
      group,
      hub,
      hubRing,
      index,
      latchAnchor,
      latchArm: latchArm.group,
      latchRoller,
      weightAnchor,
      weightArm: weightArm.group,
      weightEye,
      workingArm: working.group,
      workingTip,
    };
  };

  const upperHandleParts = makeHandle({
    contactLocal: upperContactLocal,
    latchLocal: upperLatchLocal,
    pivot: upperPivot,
    planeZ: upperHandlePlaneZ,
    role: 'upper-backweighted-steam-eduction-valve-handle',
    workingCenterline: upperWorkingCenterline,
    weightLocal: upperWeightLocal,
  });
  const lowerHandleParts = makeHandle({
    contactLocal: lowerContactLocal,
    latchLocal: lowerLatchLocal,
    pivot: lowerPivot,
    planeZ: lowerHandlePlaneZ,
    role: 'lower-backweighted-steam-eduction-valve-handle',
    workingCenterline: lowerWorkingCenterline,
    weightLocal: lowerWeightLocal,
  });

  const catchGroup = new THREE.Group();
  catchGroup.position.set(catchPivot.x, catchPivot.y, catchPlaneZ);
  catchGroup.userData.axis = Z_AXIS.clone();
  catchGroup.userData.role = 'single-center-pivoted-double-ended-diagonal-catch';
  const catchCenterline = [
    [190, 115],
    [194, 151],
    [207, 187],
    [232, 215],
    [271, 234],
    [309, 258],
    [338, 289],
    [357, 323],
    [365, 347],
  ].map(([x, y]) => source181PointToModel(
    new THREE.Vector2(x, y),
  ).sub(catchPivot));
  const catchBackbone = variableWidthPlate({
    centerline: catchCenterline,
    depth: catchDepth,
    material: catchMaterial,
    role: 'source-fitted-s-shaped-diagonal-catch-backbone',
    sampleCount: 88,
    widths: [0.18, 0.20, 0.25, 0.31, 0.38, 0.31, 0.25, 0.20],
  });
  const catchWeightArm = variableWidthPlate({
    centerline: [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.62, -0.48),
      new THREE.Vector2(1.05, -0.95),
      catchWeightLocal.clone(),
    ],
    depth: catchDepth * 0.92,
    material: catchMaterial,
    role: 'diagonal-catch-back-weight-arm',
    sampleCount: 56,
    widths: [0.30, 0.24, 0.18, 0.085],
  });
  const upperHook = new THREE.Mesh(
    centeredExtrusion(
      annularSectorShape(
        latchRollerRadius + 0.025,
        latchRollerRadius + 0.22,
        -Math.PI * 0.22,
        Math.PI * 1.42,
      ),
      catchDepth,
    ),
    catchMaterial,
  );
  upperHook.position.set(
    upperLatchSeat.x - catchPivot.x,
    upperLatchSeat.y - catchPivot.y,
    0,
  );
  upperHook.userData.role = 'upper-hook-pocket-holding-upper-valve-handle';
  const lowerHook = new THREE.Mesh(
    centeredExtrusion(
      annularSectorShape(
        latchRollerRadius + 0.025,
        latchRollerRadius + 0.22,
        Math.PI * 0.78,
        Math.PI * 2.42,
      ),
      catchDepth,
    ),
    catchMaterial,
  );
  lowerHook.position.set(
    lowerLatchSeat.x - catchPivot.x,
    lowerLatchSeat.y - catchPivot.y,
    0,
  );
  lowerHook.userData.role = 'lower-hook-pocket-holding-lower-valve-handle';
  const catchHub = new THREE.Mesh(ring(.12,.36,-catchDepth*.55,catchDepth*.55,96),catchMaterial);
  catchHub.userData.role = 'central-diagonal-catch-pivot-boss';
  const catchEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.052, 10, 36),
    darkMaterial,
  );
  catchEye.position.set(
    catchWeightLocal.x,
    catchWeightLocal.y,
    catchDepth / 2 + 0.035,
  );
  catchEye.userData.role = 'diagonal-catch-back-weight-eye';
  const catchIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.045, 0.028),
    whiteMaterial,
  );
  catchIndex.position.set(0.24, 0, catchDepth / 2 + 0.06);
  catchIndex.userData.role = 'white-diagonal-catch-rocking-index';
  const catchWeightAnchor = new THREE.Object3D();
  catchWeightAnchor.position.set(catchWeightLocal.x, catchWeightLocal.y, 0);
  catchWeightAnchor.userData.role = 'exact-diagonal-catch-weight-pin-anchor';
  const upperSeatAnchor = new THREE.Object3D();
  upperSeatAnchor.position.set(
    upperLatchSeat.x - catchPivot.x,
    upperLatchSeat.y - catchPivot.y,
    0,
  );
  upperSeatAnchor.userData.role = 'exact-upper-diagonal-catch-seat-anchor';
  const lowerSeatAnchor = new THREE.Object3D();
  lowerSeatAnchor.position.set(
    lowerLatchSeat.x - catchPivot.x,
    lowerLatchSeat.y - catchPivot.y,
    0,
  );
  lowerSeatAnchor.userData.role = 'exact-lower-diagonal-catch-seat-anchor';
  catchGroup.add(
    catchBackbone.group,
    catchWeightArm.group,
    upperHook,
    lowerHook,
    catchHub,
    catchEye,
    catchIndex,
    catchWeightAnchor,
    upperSeatAnchor,
    lowerSeatAnchor,
  );

  const pistonGroup = new THREE.Group();
  pistonGroup.position.set(0, source181PistonY, handlePlaneZ);
  pistonGroup.userData.axis = new THREE.Vector3(0, 1, 0);
  pistonGroup.userData.role = 'vertically-reciprocating-piston-rod-and-projecting-tappet';
  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 4.30, 0.24),
    pistonMaterial,
  );
  pistonRod.position.x = pistonRodX;
  pistonRod.position.z = -.39;
  pistonRod.userData.role = 'moving-piston-rod';
  const tappetShoeRightX = -0.40;
  const tappetShoeLeftX = pistonRodX - 0.13;
  const tappet = new THREE.Mesh(
    new THREE.BoxGeometry(
      tappetShoeRightX - tappetShoeLeftX,
      tappetHalfHeight * 2,
      0.56,
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
    0.30 / 2 + 0.025,
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
    const shaftTop = catchPlaneZ + catchDepth / 2 + 0.14;
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
    'fixed-upper-valve-handle-pivot',
  );
  const catchPivotParts = makePivotHardware(
    catchPivot,
    'fixed-central-diagonal-catch-pivot',
  );
  const lowerPivotParts = makePivotHardware(
    lowerPivot,
    'fixed-lower-valve-handle-pivot',
  );

  const makeHangingWeight = (role, z, rodLength) => {
    const group = new THREE.Group();
    group.position.z = z + .24;
    group.userData.role = role;
    const rod = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, rodLength-.12, 0.07),
      darkMaterial,
    );
    rod.position.y = -(rodLength+.12) / 2;
    rod.userData.role = `${role}-vertical-rod`;
    const weight = new THREE.Mesh(
      new THREE.BoxGeometry(0.30, 0.46, 0.24),
      weightMaterial,
    );
    weight.position.y = -rodLength - 0.23;
    weight.userData.role = `${role}-gravity-weight`;
    const eye=new THREE.Mesh(ring(.105,.14,-.035,.035,64),darkMaterial);
    eye.userData.role=`${role}-bored-rod-eye`;group.add(rod,weight,eye);
    return { group, rod, weight };
  };
  const upperWeightParts = makeHangingWeight(
    'upper-handle-hanging-back-weight',
    upperHandlePlaneZ,
    (500-source181UpperWeightPin.y)*sourceScale,
  );
  const lowerWeightParts = makeHangingWeight(
    'lower-handle-hanging-back-weight',
    lowerHandlePlaneZ,
    (500-source181LowerWeightPin.y)*sourceScale,
  );
  const catchWeightParts = makeHangingWeight(
    'diagonal-catch-hanging-back-weight',
    catchPlaneZ,
    (500-source181CatchWeightPin.y)*sourceScale,
  );
  for(const[parent,point]of [[upperHandleParts.group,upperWeightLocal],
    [lowerHandleParts.group,lowerWeightLocal],[catchGroup,catchWeightLocal]]){
    const pin=cylinderAlongZ(.10,.33,darkMaterial,48),head=cylinderAlongZ(.135,.035,darkMaterial,48);
    pin.position.set(point.x,point.y,.135);head.position.set(point.x,point.y,.3175);
    pin.userData.role='back-weight-rod-hinge-pin';head.userData.role='back-weight-rod-retaining-head';parent.add(pin,head);
  }

  const tappetContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 20, 14),
    whiteMaterial,
  );
  tappetContactMarker.userData.role = 'visible-active-piston-tappet-contact';
  const upperLatchMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 18, 12),
    whiteMaterial,
  );
  upperLatchMarker.userData.role = 'visible-upper-handle-catch-engagement';
  const lowerLatchMarker = upperLatchMarker.clone();
  lowerLatchMarker.userData.role = 'visible-lower-handle-catch-engagement';

  root.add(
    upperHandleParts.group,
    lowerHandleParts.group,
    catchGroup,
    pistonGroup,
    upperPivotParts.group,
    catchPivotParts.group,
    lowerPivotParts.group,
    upperWeightParts.group,
    lowerWeightParts.group,
    catchWeightParts.group,
    tappetContactMarker,
    upperLatchMarker,
    lowerLatchMarker,
  );

  const update = (time) => {
    const state = stateAtTime(time);
    upperHandleParts.group.rotation.z = state.upperHandleAngle;
    upperHandleParts.group.userData.angularVelocity =
      state.upperHandleAngularVelocity;
    lowerHandleParts.group.rotation.z = state.lowerHandleAngle;
    lowerHandleParts.group.userData.angularVelocity =
      state.lowerHandleAngularVelocity;
    catchGroup.rotation.z = state.catchAngle;
    catchGroup.userData.angularVelocity = state.catchAngularVelocity;
    pistonGroup.position.y = state.pistonPosition.y;
    pistonGroup.userData.velocity = state.pistonVelocity.clone();
    upperWeightParts.group.position.set(
      state.upperWeightPin.x,
      state.upperWeightPin.y,
      upperHandlePlaneZ+.24,
    );
    lowerWeightParts.group.position.set(
      state.lowerWeightPin.x,
      state.lowerWeightPin.y,
      lowerHandlePlaneZ+.24,
    );
    catchWeightParts.group.position.set(
      state.catchWeightPin.x,
      state.catchWeightPin.y,
      catchPlaneZ+.24,
    );
    tappetContactMarker.visible = Boolean(state.activeContactPoint);
    if (state.activeContactPoint) {
      tappetContactMarker.position.set(
        state.activeContactPoint.x,
        state.activeContactPoint.y,
        handlePlaneZ + handleDepth / 2 + 0.20,
      );
    }
    upperLatchMarker.visible = state.upperLatchEngagement >= 0.5;
    upperLatchMarker.position.set(
      state.upperLatchSeat.x,
      state.upperLatchSeat.y,
      catchPlaneZ + catchDepth / 2 + 0.11,
    );
    lowerLatchMarker.visible = state.lowerLatchEngagement > 0.5;
    lowerLatchMarker.position.set(
      state.lowerLatchSeat.x,
      state.lowerLatchSeat.y,
      catchPlaneZ + catchDepth / 2 + 0.11,
    );
    root.userData.contacts = {
      activeTappetContact: state.activeContact,
      lowerHandle: {
        contactError: state.lowerTappetContactError,
        contactPoint: state.lowerHandleContactPoint.clone(),
      },
      lowerLatch: {
        engagement: state.lowerLatchEngagement,
        gap: state.lowerLatchGap,
      },
      upperHandle: {
        contactError: state.upperTappetContactError,
        contactPoint: state.upperHandleContactPoint.clone(),
      },
      upperLatch: {
        engagement: state.upperLatchEngagement,
        gap: state.upperLatchGap,
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
    source181Ascending: {
      ...baseStateAtCyclePhase(0),
      canonicalStage: 'source-181-lower-steam-and-upper-eduction-open',
    },
    lowerTripMidpoint: {
      ...baseStateAtCyclePhase(
        (sequenceBreaks.upwardApproachEnd
          + sequenceBreaks.lowerTripEnd) / 2,
      ),
      canonicalStage: 'ascending-tappet-switches-the-diagonal-catch',
    },
    source182Top: {
      ...baseStateAtCyclePhase(
        (sequenceBreaks.upwardOvertravelEnd
          + sequenceBreaks.source182HoldEnd) / 2,
      ),
      canonicalStage: 'source-182-upper-steam-and-lower-eduction-open',
    },
    upperTripMidpoint: {
      ...baseStateAtCyclePhase(
        (sequenceBreaks.downwardApproachEnd
          + sequenceBreaks.upperTripEnd) / 2,
      ),
      canonicalStage: 'descending-tappet-restores-source-181-catch-state',
    },
    source181Returned: {
      ...baseStateAtCyclePhase(0.96),
      canonicalStage: 'source-181-returned-after-full-cycle',
    },
  };

  const geometry = {
    axis: Z_AXIS.clone(),
    catchDepth,
    catchPlaneZ,
    catchPivot: catchPivot.clone(),
    catchSource182WeightResidual,
    catchTripDeflection,
    catchWeightLocal: catchWeightLocal.clone(),
    contactRollerRadius,
    cyclePeriod,
    frameCenterZ,
    frameDepth,
    handleDepth,
    handlePlaneZ,
    initialBasePhase,
    latchRollerRadius,
    lowerContactLocal: lowerContactLocal.clone(),
    lowerLatchLocal: lowerLatchLocal.clone(),
    lowerLatchSeat: lowerLatchSeat.clone(),
    lowerPivot: lowerPivot.clone(),
    lowerReleasePistonY,
    lowerSource182WeightResidual,
    lowerStrikePistonY,
    lowerWeightLocal: lowerWeightLocal.clone(),
    movementId,
    pistonRodX,
    publicBasePhaseWrap,
    publicSequenceBreaks,
    sequenceBreaks,
    source181CatchPivot: source181CatchPivot.clone(),
    source181CatchWeightPin: source181CatchWeightPin.clone(),
    source181LowerContact: source181LowerContact.clone(),
    source181LowerFreeTip: source181LowerFreeTip.clone(),
    source181LowerLatchSeat: source181LowerLatchSeat.clone(),
    source181LowerPivot: source181LowerPivot.clone(),
    source181LowerWeightPin: source181LowerWeightPin.clone(),
    source181PistonRodCenterX,
    source181PistonY,
    source181TappetCenter: source181TappetCenter.clone(),
    source181UpperLatchSeat: source181UpperLatchSeat.clone(),
    source181UpperPivot: source181UpperPivot.clone(),
    source181UpperWeightPin: source181UpperWeightPin.clone(),
    source182CatchPivot: source182CatchPivot.clone(),
    source182CatchWeightPin: source182CatchWeightPin.clone(),
    source182LowerPivot: source182LowerPivot.clone(),
    source182LowerWeightPin: source182LowerWeightPin.clone(),
    source182PistonY,
    source182TappetCenter: source182TappetCenter.clone(),
    source182UpperContact: source182UpperContact.clone(),
    source182UpperFreeTip: source182UpperFreeTip.clone(),
    source182UpperPivot: source182UpperPivot.clone(),
    source182UpperWeightPin: source182UpperWeightPin.clone(),
    source182LowerAngle,
    source182UpperAngle,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    tappetShoeLeftX,
    tappetShoeRightX,
    tappetHalfHeight,
    upperContactLocal: upperContactLocal.clone(),
    upperLatchLocal: upperLatchLocal.clone(),
    upperLatchSeat: upperLatchSeat.clone(),
    upperPivot: upperPivot.clone(),
    upperReleasePistonY,
    upperSource182WeightResidual,
    upperStrikePistonY,
    upperWeightLocal: upperWeightLocal.clone(),
  };

  root.userData.archetype = isSource182Variant
    ? 'double-backweighted-valve-handles-center-pivoted-diagonal-catch-piston-tappet-position-182'
    : 'double-backweighted-valve-handles-center-pivoted-diagonal-catch-piston-tappet-position-181';
  root.userData.blocks = {
    catchBackbone: catchBackbone.group,
    catchEye,
    catchGroup,
    catchHub,
    catchIndex,
    catchPivot: catchPivotParts.group,
    catchPivotHead: catchPivotParts.head,
    catchPivotShaft: catchPivotParts.shaft,
    catchPivotSlot: catchPivotParts.slot,
    catchWeight: catchWeightParts.weight,
    catchWeightAnchor,
    catchWeightAssembly: catchWeightParts.group,
    catchWeightArm: catchWeightArm.group,
    catchWeightRod: catchWeightParts.rod,
    frameSpine,
    lowerCrossbar,
    lowerHandle: lowerHandleParts.group,
    lowerHandleContactAnchor: lowerHandleParts.contactAnchor,
    lowerHandleContactRoller: lowerHandleParts.contactRoller,
    lowerHandleHub: lowerHandleParts.hub,
    lowerHandleIndex: lowerHandleParts.index,
    lowerHandleLatchAnchor: lowerHandleParts.latchAnchor,
    lowerHandleLatchArm: lowerHandleParts.latchArm,
    lowerHandleLatchRoller: lowerHandleParts.latchRoller,
    lowerHandleWeightAnchor: lowerHandleParts.weightAnchor,
    lowerHandleWeightArm: lowerHandleParts.weightArm,
    lowerHandleWorkingArm: lowerHandleParts.workingArm,
    lowerHandleWorkingTip: lowerHandleParts.workingTip,
    lowerHook,
    lowerLatchMarker,
    lowerPivot: lowerPivotParts.group,
    lowerPivotHead: lowerPivotParts.head,
    lowerPivotShaft: lowerPivotParts.shaft,
    lowerPivotSlot: lowerPivotParts.slot,
    lowerSeatAnchor,
    lowerWeight: lowerWeightParts.weight,
    lowerWeightAssembly: lowerWeightParts.group,
    lowerWeightRod: lowerWeightParts.rod,
    pistonGroup,
    pistonGuide,
    pistonRod,
    tappet,
    tappetAnchor,
    tappetContactMarker,
    tappetIndex,
    upperCrossbar,
    upperHandle: upperHandleParts.group,
    upperHandleContactAnchor: upperHandleParts.contactAnchor,
    upperHandleContactRoller: upperHandleParts.contactRoller,
    upperHandleHub: upperHandleParts.hub,
    upperHandleIndex: upperHandleParts.index,
    upperHandleLatchAnchor: upperHandleParts.latchAnchor,
    upperHandleLatchArm: upperHandleParts.latchArm,
    upperHandleLatchRoller: upperHandleParts.latchRoller,
    upperHandleWeightAnchor: upperHandleParts.weightAnchor,
    upperHandleWeightArm: upperHandleParts.weightArm,
    upperHandleWorkingArm: upperHandleParts.workingArm,
    upperHandleWorkingTip: upperHandleParts.workingTip,
    upperHook,
    upperLatchMarker,
    upperPivot: upperPivotParts.group,
    upperPivotHead: upperPivotParts.head,
    upperPivotShaft: upperPivotParts.shaft,
    upperPivotSlot: upperPivotParts.slot,
    upperSeatAnchor,
    upperWeight: upperWeightParts.weight,
    upperWeightAssembly: upperWeightParts.group,
    upperWeightRod: upperWeightParts.rod,
  };
  root.userData.cameraDistanceScale = 1.18;
  root.userData.baseStateAtCyclePhase = baseStateAtCyclePhase;
  root.userData.canonicalStates = canonicalStates;
  root.userData.catchLawAtCyclePhase = catchLawAtCyclePhase;
  root.userData.cyclePhaseToBasePhase = cyclePhaseToBasePhase;
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.mechanism = isSource182Variant
    ? 'top-position-descending-piston-tappet-trips-upper-valve-handle-diagonal-catch-releases-lower-backweighted-handle-and-restores-four-valves'
    : 'ascending-piston-tappet-trips-lower-valve-handle-diagonal-catch-releases-upper-backweighted-handle-and-reverses-four-valves';
  root.userData.modelPointToSource181 = modelPointToSource181;
  root.userData.modelVectorToSource = modelVectorToSource;
  root.userData.source181PointToModel = source181PointToModel;
  root.userData.sourceVectorToModel = sourceVectorToModel;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.topStateLawAtCyclePhase = topStateLawAtCyclePhase;
  root.userData.variant = isSource182Variant
    ? 'source-182-top-of-cylinder-initial-pose'
    : 'source-181-ascending-stroke-initial-pose';

  Object.assign(geometry,{upperHandlePlaneZ,lowerHandlePlaneZ});
  // Source cutaway: the engine casing and column are outside this mechanism.
  for(const part of [frameSpine,pistonGuide,upperCrossbar,lowerCrossbar,tappetContactMarker,
    upperLatchMarker,lowerLatchMarker,upperHandleParts.index,lowerHandleParts.index,catchIndex,tappetIndex]){
    part.removeFromParent();part.geometry.dispose();
  }
  Object.assign(root.userData,{hideGround:true,supportsRestart:true,minimumDisplayCycleSeconds:18,
    animationTiming:{authoredCyclePeriod:cyclePeriod},cameraFov:8,reconstructionStatus:'under-review',
    reconstructionNote:'Pivot bores and axial layers are repaired. Tappet and latch geometry and the prescribed switching sequence are still under review.'});
  const motionBounds=new THREE.Box3();
  for(let i=0;i<=128;i++){update(cyclePeriod*i/128);root.updateMatrixWorld(true);motionBounds.union(new THREE.Box3().setFromObject(root,true));}
  root.userData.cameraFitBounds=motionBounds.expandByScalar(.06);

  update(0);
  markShadows(root);
  for (const marker of [
    tappetContactMarker,
    upperLatchMarker,
    lowerLatchMarker,
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

  return {
    cameraDirection: new THREE.Vector3(0, 0, 1),
    root,
    update,
    reset: () => update(0),
  };
}

export function createAuthoredDiagonalCatchMovement(movement) {
  if (movement.id === 181 || movement.id === 182) {
    return sourceScaledDiagonalCatchHandGear({ movementId: movement.id });
  }
  return null;
}
