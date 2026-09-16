import { correctEndlessMaintainingChain } from './maintaining-clock-parts.js';
import * as THREE from 'three';
import {
  CircularArcCurve3,
  PALETTE,
  circularArcThrough,
  makeBeam,
  makeDynamicMovingBelt,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function signedAngleDifference(angle, reference) {
  return positiveModulo(angle - reference + Math.PI, FULL_TURN) - Math.PI;
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

class LiftedCrossoverSpan extends THREE.Curve {
  constructor(start, end, lift, divisions = 384) {
    super();
    this.start = start.clone();
    this.end = end.clone();
    this.delta = end.clone().sub(start);
    this.lift = lift;
    this.divisions = divisions;
    this.parameters = new Float64Array(divisions + 1);
    this.lengths = new Float64Array(divisions + 1);
    let previous = this.getPoint(0);
    let chordLength = 0;
    for (let index = 1; index <= divisions; index += 1) {
      const parameter = index / divisions;
      const point = this.getPoint(parameter);
      chordLength += point.distanceTo(previous);
      this.parameters[index] = parameter;
      this.lengths[index] = chordLength;
      previous = point;
    }
    this.totalLength = liftedSpanLength(this.delta.length(), lift);
    const correction = this.totalLength / chordLength;
    for (let index = 1; index <= divisions; index += 1) {
      this.lengths[index] *= correction;
    }
  }

  getPoint(parameter, target = new THREE.Vector3()) {
    return target
      .copy(this.start)
      .addScaledVector(this.delta, parameter)
      .addScaledVector(
        Z_AXIS,
        this.lift * Math.sin(Math.PI * parameter) ** 2,
      );
  }

  getTangent(parameter, target = new THREE.Vector3()) {
    return target.copy(this.delta).addScaledVector(
      Z_AXIS,
      this.lift * Math.PI * Math.sin(FULL_TURN * parameter),
    ).normalize();
  }

  parameterAtArcFraction(fraction) {
    const targetLength = THREE.MathUtils.clamp(fraction, 0, 1)
      * this.totalLength;
    let low = 0;
    let high = this.divisions;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (this.lengths[middle] < targetLength) low = middle;
      else high = middle;
    }
    const spanLength = this.lengths[high] - this.lengths[low];
    const local = spanLength > 1e-15
      ? (targetLength - this.lengths[low]) / spanLength
      : 0;
    return THREE.MathUtils.lerp(
      this.parameters[low],
      this.parameters[high],
      local,
    );
  }

  getPointAt(fraction, target = new THREE.Vector3()) {
    return this.getPoint(this.parameterAtArcFraction(fraction), target);
  }

  getTangentAt(fraction, target = new THREE.Vector3()) {
    return this.getTangent(this.parameterAtArcFraction(fraction), target);
  }

  getLength() {
    return this.totalLength;
  }
}

function liftedSpanLength(planarLength, lift) {
  // Composite Simpson integration of |dr/dt|.  Sixty-four panels resolve
  // this very shallow crossover bow to substantially below render precision.
  const panels = 64;
  const speedAt = (parameter) => Math.hypot(
    planarLength,
    lift * Math.PI * Math.sin(FULL_TURN * parameter),
  );
  let sum = speedAt(0) + speedAt(1);
  for (let index = 1; index < panels; index += 1) {
    sum += (index % 2 === 0 ? 2 : 4) * speedAt(index / panels);
  }
  return sum / (3 * panels);
}

class ConstantSpeedChainCurve extends THREE.Curve {
  constructor(segmentRecords) {
    super();
    this.segmentRecords = segmentRecords;
    this.cumulativeLengths = [0];
    for (const record of segmentRecords) {
      this.cumulativeLengths.push(
        this.cumulativeLengths.at(-1) + record.length,
      );
    }
    this.totalLength = this.cumulativeLengths.at(-1);
  }

  segmentAtFraction(fraction) {
    const clamped = THREE.MathUtils.clamp(fraction, 0, 1);
    const distance = clamped * this.totalLength;
    let index = this.segmentRecords.length - 1;
    for (let candidate = 0; candidate < this.segmentRecords.length;
      candidate += 1) {
      if (distance <= this.cumulativeLengths[candidate + 1] + 1e-12) {
        index = candidate;
        break;
      }
    }
    const record = this.segmentRecords[index];
    const localDistance = distance - this.cumulativeLengths[index];
    return {
      fraction: record.length > 1e-15
        ? THREE.MathUtils.clamp(localDistance / record.length, 0, 1)
        : 0,
      index,
      record,
    };
  }

  getPoint(fraction, target = new THREE.Vector3()) {
    const location = this.segmentAtFraction(fraction);
    return location.record.constantParameterSpeed
      ? location.record.curve.getPoint(location.fraction, target)
      : location.record.curve.getPointAt(location.fraction, target);
  }

  getPointAt(fraction, target = new THREE.Vector3()) {
    return this.getPoint(fraction, target);
  }

  getTangent(fraction, target = new THREE.Vector3()) {
    const location = this.segmentAtFraction(fraction);
    return location.record.constantParameterSpeed
      ? location.record.curve.getTangent(location.fraction, target)
      : location.record.curve.getTangentAt(location.fraction, target);
  }

  getTangentAt(fraction, target = new THREE.Vector3()) {
    return this.getTangent(fraction, target);
  }

  getLength() {
    return this.totalLength;
  }

  getLengths(divisions = 200) {
    return Array.from(
      { length: divisions + 1 },
      (_, index) => this.totalLength * index / divisions,
    );
  }

  getUtoTmapping(fraction, distance) {
    if (Number.isFinite(distance)) return distance / this.totalLength;
    return fraction;
  }

  updateArcLengths() {}
}

function commonTangent({
  fromCenter,
  fromRadius,
  hint,
  sigma,
  toCenter,
  toRadius,
}) {
  const displacement = new THREE.Vector2().subVectors(
    toCenter,
    fromCenter,
  );
  const centerDistance = displacement.length();
  const along = displacement.clone().divideScalar(centerDistance);
  const across = new THREE.Vector2(-along.y, along.x);
  const projection = (fromRadius - sigma * toRadius) / centerDistance;
  if (Math.abs(projection) >= 1) {
    throw new RangeError('Pulley spacing does not admit this chain tangent.');
  }
  const perpendicular = Math.sqrt(1 - projection ** 2);
  const candidates = [1, -1].map((side) => {
    const normal = along.clone().multiplyScalar(projection)
      .addScaledVector(across, side * perpendicular);
    return {
      normal,
      score: normal.dot(hint),
    };
  });
  candidates.sort((first, second) => second.score - first.score);
  const normal = candidates[0].normal;
  const start2 = fromCenter.clone().addScaledVector(normal, fromRadius);
  const end2 = toCenter.clone().addScaledVector(
    normal,
    sigma * toRadius,
  );
  const start = new THREE.Vector3(start2.x, start2.y, 0);
  const end = new THREE.Vector3(end2.x, end2.y, 0);
  return {
    direction: end.clone().sub(start).normalize(),
    end,
    normal,
    sigma,
    start,
  };
}

function planarSegmentIntersection(firstStart, firstEnd, secondStart,
  secondEnd) {
  const first = new THREE.Vector2(
    firstEnd.x - firstStart.x,
    firstEnd.y - firstStart.y,
  );
  const second = new THREE.Vector2(
    secondEnd.x - secondStart.x,
    secondEnd.y - secondStart.y,
  );
  const offset = new THREE.Vector2(
    secondStart.x - firstStart.x,
    secondStart.y - firstStart.y,
  );
  const cross = (left, right) => left.x * right.y - left.y * right.x;
  const denominator = cross(first, second);
  const firstParameter = cross(offset, second) / denominator;
  const secondParameter = cross(offset, first) / denominator;
  return { firstParameter, secondParameter };
}

function makeSymmetricPulley({
  color,
  pitchRadius,
  role,
  symmetryOrder,
  width = 0.34,
}) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.userData.axis = Z_AXIS.clone();
  root.userData.pitchRadius = pitchRadius;
  root.userData.role = role;
  root.userData.rotor = rotor;
  root.userData.symmetryOrder = symmetryOrder;

  const bodyMaterial = matte(color, {
    metalness: 0.10,
    roughness: 0.68,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });
  const body = cylinderAlongZ(pitchRadius * 0.84, width, bodyMaterial, 56);
  body.userData.role = `${role}-body`;
  rotor.add(body);
  for (const side of [-1, 1]) {
    const flange = new THREE.Mesh(
      new THREE.TorusGeometry(
        pitchRadius,
        Math.max(0.035, pitchRadius * 0.045),
        10,
        64,
      ),
      darkMaterial,
    );
    flange.position.z = side * width / 2;
    flange.userData.role = `${role}-roughened-flange`;
    rotor.add(flange);
  }
  const groove = new THREE.Mesh(
    new THREE.TorusGeometry(
      pitchRadius,
      Math.max(0.025, pitchRadius * 0.028),
      8,
      64,
    ),
    darkMaterial,
  );
  groove.userData.role = `${role}-chain-groove`;
  rotor.add(groove);
  const hub = cylinderAlongZ(
    Math.max(0.13, pitchRadius * 0.19),
    width * 1.45,
    darkMaterial,
    28,
  );
  hub.userData.role = `${role}-hub`;
  rotor.add(hub);

  const spokes = [];
  const indices = [];
  for (let index = 0; index < symmetryOrder; index += 1) {
    const angle = index * FULL_TURN / symmetryOrder;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(
        pitchRadius * 0.63,
        Math.max(0.055, pitchRadius * 0.075),
        width * 0.38,
      ),
      darkMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * pitchRadius * 0.48,
      Math.sin(angle) * pitchRadius * 0.48,
      width * 0.10,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `${role}-rotation-spoke`;
    rotor.add(spoke);
    spokes.push(spoke);

    const indicator = new THREE.Mesh(
      new THREE.SphereGeometry(
        Math.max(0.045, pitchRadius * 0.065),
        12,
        9,
      ),
      whiteMaterial,
    );
    indicator.position.set(
      Math.cos(angle) * pitchRadius * 0.70,
      Math.sin(angle) * pitchRadius * 0.70,
      width * 0.56,
    );
    indicator.userData.role = `${role}-symmetric-rotation-index`;
    rotor.add(indicator);
    indices.push(indicator);
  }
  root.userData.indices = indices;
  root.userData.spokes = spokes;
  return markShadows(root);
}

function makeRatchetDisk(radius, depth, toothCount) {
  const shape = new THREE.Shape();
  for (let tooth = 0; tooth < toothCount; tooth += 1) {
    const pitch = FULL_TURN / toothCount;
    const samples = [
      { angle: tooth * pitch - pitch * 0.50, radius: radius * 0.78 },
      { angle: tooth * pitch - pitch * 0.34, radius },
      { angle: tooth * pitch + pitch * 0.38, radius: radius * 0.94 },
      { angle: tooth * pitch + pitch * 0.50, radius: radius * 0.78 },
    ];
    for (const sample of samples) {
      const x = Math.cos(sample.angle) * sample.radius;
      const y = Math.sin(sample.angle) * sample.radius;
      if (tooth === 0 && sample === samples[0]) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  const disk = new THREE.Mesh(
    geometry,
    matte(PALETTE.accent, { metalness: 0.16, roughness: 0.58 }),
  );
  disk.userData.role = 'ratchet-wheel-riding-on-arbor-p';
  return disk;
}

function setRotorAngle(pulley, angle) {
  pulley.userData.rotor.rotation.z = angle;
}

function endlessChainMaintainingPower(movement) {
  const root = new THREE.Group();

  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterOrigin = new THREE.Vector2(278, 103);
  const sourceRasterRatchetP = new THREE.Vector2(193, 102);
  const sourceRasterGoingP = new THREE.Vector2(363, 103);
  const sourceRasterSmallPulley = new THREE.Vector2(203, 286);
  const sourceRasterLargePulley = new THREE.Vector2(340, 362);
  const sourceRasterSmallWeightCenter = new THREE.Vector2(203, 376);
  const sourceRasterLargeWeightCenter = new THREE.Vector2(340, 468);
  const sourceScale = 1 / 60;

  const chainPlaneZ = 0.30;
  const crossoverLift = 0.18;
  const chainRadius = 0.042;
  const markerCount = 21;
  const cycleAdvance = FULL_TURN / 5;
  const targetChainLength = markerCount * cycleAdvance;
  const demonstrationPeriod = 8;
  const mainWeightExcursion = 0.50;
  const ratchetToothCount = 10;
  const ratchetToothPitch = FULL_TURN / ratchetToothCount;
  const referenceSmallY = -0.475;
  const referenceLargeY = -1.725;
  const xCoordinates = {
    A: -85 / 60,
    B: 85 / 60,
    L: 62 / 60,
    S: -75 / 60,
  };
  const radii = {
    A: 1,
    B: 1,
    L: 1.2,
    S: 0.5,
  };
  const pulleyOrder = ['S', 'B', 'L', 'A'];
  const edgeSpecs = [
    {
      from: 'A',
      hint: new THREE.Vector2(-1, 0),
      label: 'b',
      sigma: 1,
      to: 'S',
    },
    {
      from: 'S',
      hint: new THREE.Vector2(1, -1),
      label: 'a',
      sigma: -1,
      to: 'B',
    },
    {
      from: 'B',
      hint: new THREE.Vector2(1, 0),
      label: 'd',
      sigma: 1,
      to: 'L',
    },
    {
      from: 'L',
      hint: new THREE.Vector2(-1, 1),
      label: 'c',
      sigma: -1,
      to: 'A',
    },
  ];

  const buildPath = (topY, smallY, largeY, includeCurve = true) => {
    const centers = {
      A: new THREE.Vector3(xCoordinates.A, topY, chainPlaneZ),
      B: new THREE.Vector3(xCoordinates.B, topY, chainPlaneZ),
      L: new THREE.Vector3(xCoordinates.L, largeY, chainPlaneZ),
      S: new THREE.Vector3(xCoordinates.S, smallY, chainPlaneZ),
    };
    const centers2 = Object.fromEntries(Object.entries(centers).map(
      ([key, center]) => [key, new THREE.Vector2(center.x, center.y)],
    ));
    const edges = edgeSpecs.map((spec) => {
      const tangent = commonTangent({
        fromCenter: centers2[spec.from],
        fromRadius: radii[spec.from],
        hint: spec.hint,
        sigma: spec.sigma,
        toCenter: centers2[spec.to],
        toRadius: radii[spec.to],
      });
      tangent.start.z = chainPlaneZ;
      tangent.end.z = chainPlaneZ;
      const lift = spec.label === 'a' ? crossoverLift : 0;
      const planarLength = tangent.start.distanceTo(tangent.end);
      const curve = includeCurve
        ? lift
          ? new LiftedCrossoverSpan(tangent.start, tangent.end, lift)
          : new THREE.LineCurve3(tangent.start, tangent.end)
        : null;
      return {
        ...spec,
        ...tangent,
        curve,
        length: lift
          ? liftedSpanLength(planarLength, lift)
          : planarLength,
        lift,
      };
    });

    const segmentRecords = [];
    const contacts = {};
    let distance = 0;
    for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
      const edge = edges[edgeIndex];
      if (includeCurve) {
        segmentRecords.push({
          constantParameterSpeed: edge.lift === 0,
          curve: edge.curve,
          kind: 'free-span',
          label: edge.label,
          length: edge.length,
        });
      }
      distance += edge.length;
      const pulleyKey = pulleyOrder[edgeIndex];
      const nextEdge = edges[(edgeIndex + 1) % edges.length];
      const arc = circularArcThrough(
        centers[pulleyKey],
        edge.end,
        nextEdge.start,
        Z_AXIS,
        edge.direction,
      );
      const arcLength = radii[pulleyKey] * Math.abs(arc.sweep);
      contacts[pulleyKey] = {
        entryDistance: distance,
        entryPoint: edge.end.clone(),
        entryTangent: edge.direction.clone(),
        exitDistance: distance + arcLength,
        exitPoint: nextEdge.start.clone(),
        exitTangent: nextEdge.direction.clone(),
        radius: radii[pulleyKey],
        sweep: arc.sweep,
        sweepSign: Math.sign(arc.sweep),
        thetaEntry: Math.atan2(
          edge.end.y - centers[pulleyKey].y,
          edge.end.x - centers[pulleyKey].x,
        ),
      };
      if (includeCurve) {
        segmentRecords.push({
          constantParameterSpeed: true,
          curve: arc,
          kind: 'pulley-contact-arc',
          label: pulleyKey,
          length: arcLength,
        });
      }
      distance += arcLength;
    }
    if (!includeCurve) return { totalLength: distance };
    const curve = new ConstantSpeedChainCurve(segmentRecords);
    const intersection = planarSegmentIntersection(
      edges[1].start,
      edges[1].end,
      edges[3].start,
      edges[3].end,
    );
    const liftedPoint = edges[1].curve.getPoint(
      intersection.firstParameter,
    );
    const rearPoint = edges[3].curve.getPoint(
      intersection.secondParameter,
    );
    return {
      centers,
      contacts,
      crossover: {
        axialClearance: liftedPoint.z - rearPoint.z - 2 * chainRadius,
        firstParameter: intersection.firstParameter,
        liftedPoint,
        rearPoint,
        secondParameter: intersection.secondParameter,
      },
      curve,
      edges,
      segmentRecords,
      totalLength: curve.getLength(),
    };
  };

  const solveIncreasingRoot = (functionAt, target, lower, upper) => {
    let low = lower;
    let high = upper;
    if (!(functionAt(low) <= target && functionAt(high) >= target)) {
      throw new RangeError('The requested chain-length root is not bracketed.');
    }
    for (let iteration = 0; iteration < 58; iteration += 1) {
      const middle = (low + high) / 2;
      if (functionAt(middle) < target) low = middle;
      else high = middle;
    }
    return (low + high) / 2;
  };

  const topY = solveIncreasingRoot(
    (candidateTopY) => buildPath(
      candidateTopY,
      referenceSmallY,
      referenceLargeY,
      false,
    ).totalLength,
    targetChainLength,
    1.80,
    3.20,
  );
  const referencePath = buildPath(
    topY,
    referenceSmallY,
    referenceLargeY,
  );

  const solveSmallPulleyY = (largeY) => {
    if (Math.abs(largeY - referenceLargeY) < 1e-14) {
      return referenceSmallY;
    }
    const lengthAt = (smallY) => buildPath(
      topY,
      smallY,
      largeY,
      false,
    ).totalLength;
    let low = referenceSmallY;
    let high = 0.70;
    let lowValue = lengthAt(low) - targetChainLength;
    let highValue = lengthAt(high) - targetChainLength;
    if (lowValue * highValue > 0) {
      throw new RangeError('Movable tension-pulley chain root is not bracketed.');
    }
    if (lowValue < highValue) {
      [low, high] = [high, low];
      [lowValue, highValue] = [highValue, lowValue];
    }
    for (let iteration = 0; iteration < 52; iteration += 1) {
      const middle = (low + high) / 2;
      const value = lengthAt(middle) - targetChainLength;
      if (value > 0) low = middle;
      else high = middle;
    }
    return (low + high) / 2;
  };

  const contactAngleDelta = (path, key) => signedAngleDifference(
    path.contacts[key].thetaEntry,
    referencePath.contacts[key].thetaEntry,
  );
  const lockedTravelForPath = (path) => {
    const current = path.contacts.A;
    const reference = referencePath.contacts.A;
    return current.entryDistance - reference.entryDistance
      - radii.A * current.sweepSign * contactAngleDelta(path, 'A');
  };
  const pulleyAngleForPath = (path, key, chainTravel) => {
    const current = path.contacts[key];
    const reference = referencePath.contacts[key];
    return contactAngleDelta(path, key)
      - (
        current.entryDistance - reference.entryDistance - chainTravel
      ) / (radii[key] * current.sweepSign);
  };
  const chainTravelForPulleyAngle = (path, key, pulleyAngle) => {
    const current = path.contacts[key];
    const reference = referencePath.contacts[key];
    return current.entryDistance - reference.entryDistance
      + radii[key] * current.sweepSign * (
        pulleyAngle - contactAngleDelta(path, key)
      );
  };

  const halfLargeY = referenceLargeY - mainWeightExcursion;
  const halfSmallY = solveSmallPulleyY(halfLargeY);
  const halfPath = buildPath(topY, halfSmallY, halfLargeY);
  const halfLockedTravel = lockedTravelForPath(halfPath);
  const halfGoingAngle = pulleyAngleForPath(
    halfPath,
    'B',
    halfLockedTravel,
  );
  const finalGoingAngle = cycleAdvance
    / (radii.B * referencePath.contacts.B.sweepSign);
  if (!(finalGoingAngle < halfGoingAngle)) {
    throw new RangeError('Cycle advance must keep the going wheel moving.');
  }

  const rawStateAtTime = (time) => {
    const cycleIndex = Math.floor(time / demonstrationPeriod);
    const localTime = time - cycleIndex * demonstrationPeriod;
    const phase = localTime / demonstrationPeriod;
    const mainDrop = mainWeightExcursion
      * (1 - Math.cos(FULL_TURN * phase)) / 2;
    const largeY = referenceLargeY - mainDrop;
    const smallY = solveSmallPulleyY(largeY);
    const path = buildPath(topY, smallY, largeY);
    const cycleTravel = cycleIndex * cycleAdvance;
    const isWinding = phase > 0.5;
    let chainTravel;
    let desiredGoingAngle;
    if (!isWinding) {
      chainTravel = cycleTravel + lockedTravelForPath(path);
      desiredGoingAngle = pulleyAngleForPath(path, 'B', chainTravel);
    } else {
      const windingProgress = smoothstep(2 * phase - 1);
      const cycleGoingAngle = cycleTravel
        / (radii.B * referencePath.contacts.B.sweepSign);
      desiredGoingAngle = cycleGoingAngle + THREE.MathUtils.lerp(
        halfGoingAngle,
        finalGoingAngle,
        windingProgress,
      );
      chainTravel = chainTravelForPulleyAngle(
        path,
        'B',
        desiredGoingAngle,
      );
    }

    const pulleys = {};
    for (const key of ['A', 'B', 'S', 'L']) {
      const angle = pulleyAngleForPath(path, key, chainTravel);
      const current = path.contacts[key];
      const reference = referencePath.contacts[key];
      const entryAngleDelta = contactAngleDelta(path, key);
      const exitAngleDelta = entryAngleDelta
        + current.sweep - reference.sweep;
      const entrySlipError = (
        current.entryDistance - reference.entryDistance - chainTravel
      ) - radii[key] * current.sweepSign * (
        entryAngleDelta - angle
      );
      const exitSlipError = (
        current.exitDistance - reference.exitDistance - chainTravel
      ) - radii[key] * current.sweepSign * (
        exitAngleDelta - angle
      );
      pulleys[key] = {
        angle,
        center: path.centers[key].clone(),
        contact: current,
        entrySlipError,
        exitSlipError,
        radius: radii[key],
      };
    }
    const ratchetLockedAngle = cycleIndex * cycleAdvance
      / (radii.A * referencePath.contacts.A.sweepSign);
    const freewheelAngle = pulleys.A.angle - ratchetLockedAngle;
    const toothProgress = positiveModulo(
      freewheelAngle / ratchetToothPitch,
      1,
    );
    const pawlLift = isWinding
      ? 0.13 * Math.sin(Math.PI * toothProgress) ** 4
      : 0;
    return {
      chainTravel,
      cycleIndex,
      desiredGoingAngle,
      freewheelAngle,
      isWinding,
      largePulleyY: largeY,
      mainWeightDrop: mainDrop,
      mode: isWinding
        ? 'winding-part-b-down-ratchet-freewheeling-main-weight-rising'
        : 'going-main-weight-descending-ratchet-locked',
      path,
      pawlLift,
      phase,
      pulleys,
      ratchetLockedAngle,
      smallPulleyY: smallY,
      toothProgress,
      windingProgress: isWinding ? smoothstep(2 * phase - 1) : 0,
    };
  };

  const stateAtTime = (time) => {
    const state = rawStateAtTime(time);
    const step = 1e-5;
    const before = rawStateAtTime(time - step);
    const after = rawStateAtTime(time + step);
    const firstDerivative = (afterValue, beforeValue) =>
      (afterValue - beforeValue) / (2 * step);
    const secondDerivative = (afterValue, value, beforeValue) =>
      (afterValue - 2 * value + beforeValue) / (step ** 2);
    const pulleys = Object.fromEntries(['A', 'B', 'S', 'L'].map((key) => [
      key,
      {
        ...state.pulleys[key],
        angularAcceleration: secondDerivative(
          after.pulleys[key].angle,
          state.pulleys[key].angle,
          before.pulleys[key].angle,
        ),
        angularVelocity: firstDerivative(
          after.pulleys[key].angle,
          before.pulleys[key].angle,
        ),
      },
    ]));
    return {
      ...state,
      chainAcceleration: secondDerivative(
        after.chainTravel,
        state.chainTravel,
        before.chainTravel,
      ),
      chainSpeed: firstDerivative(
        after.chainTravel,
        before.chainTravel,
      ),
      largePulleyAcceleration: secondDerivative(
        after.largePulleyY,
        state.largePulleyY,
        before.largePulleyY,
      ),
      largePulleyVelocity: firstDerivative(
        after.largePulleyY,
        before.largePulleyY,
      ),
      pulleys,
      smallPulleyAcceleration: secondDerivative(
        after.smallPulleyY,
        state.smallPulleyY,
        before.smallPulleyY,
      ),
      smallPulleyVelocity: firstDerivative(
        after.smallPulleyY,
        before.smallPulleyY,
      ),
    };
  };

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-clock-frame';
  const railY = topY + 1.36;
  fixedFrame.add(
    makeBeam(
      new THREE.Vector3(-2.70, railY, -0.45),
      new THREE.Vector3(2.70, railY, -0.45),
      { color: PALETTE.frame, depth: 0.28, thickness: 0.20 },
    ),
    makeBeam(
      new THREE.Vector3(xCoordinates.A, railY, -0.45),
      new THREE.Vector3(xCoordinates.A, topY, -0.45),
      { color: PALETTE.frame, depth: 0.24, thickness: 0.18 },
    ),
    makeBeam(
      new THREE.Vector3(xCoordinates.B, railY, -0.45),
      new THREE.Vector3(xCoordinates.B, topY, -0.45),
      { color: PALETTE.frame, depth: 0.24, thickness: 0.18 },
    ),
  );
  const leftAxle = cylinderAlongZ(
    0.13,
    1.28,
    matte(PALETTE.ink, { metalness: 0.30, roughness: 0.42 }),
    24,
  );
  leftAxle.position.set(xCoordinates.A, topY, 0.05);
  leftAxle.userData.role = 'fixed-arbor-p';
  const rightAxle = leftAxle.clone();
  rightAxle.position.x = xCoordinates.B;
  rightAxle.userData.role = 'going-wheel-arbor-P';
  fixedFrame.add(leftAxle, rightAxle);

  const ratchetPulley = makeSymmetricPulley({
    color: PALETTE.driver,
    pitchRadius: radii.A,
    role: 'roughened-ratchet-pulley-p',
    symmetryOrder: 5,
    width: 0.36,
  });
  ratchetPulley.position.copy(referencePath.centers.A);
  ratchetPulley.userData.rotor.add(makeRatchetDisk(
    radii.A * 0.76,
    0.16,
    ratchetToothCount,
  ));
  ratchetPulley.userData.rotor.children.at(-1).position.z = 0.28;

  const goingPulley = makeSymmetricPulley({
    color: PALETTE.driven,
    pitchRadius: radii.B,
    role: 'going-wheel-with-fixed-roughened-pulley-P',
    symmetryOrder: 5,
    width: 0.38,
  });
  goingPulley.position.copy(referencePath.centers.B);

  const smallCarrier = new THREE.Group();
  smallCarrier.userData.role = 'small-tension-weight-and-movable-pulley';
  const smallPulley = makeSymmetricPulley({
    color: PALETTE.accent,
    pitchRadius: radii.S,
    role: 'small-chain-tensioning-pulley',
    symmetryOrder: 5,
    width: 0.30,
  });
  smallCarrier.add(smallPulley);
  const smallHanger = makeBeam(
    new THREE.Vector3(0, -0.12, 0),
    new THREE.Vector3(0, -1.25, 0),
    { color: PALETTE.ink, depth: 0.15, thickness: 0.11 },
  );
  smallHanger.userData.role = 'small-weight-w-hanger';
  const smallWeight = new THREE.Mesh(
    new THREE.BoxGeometry(0.70, 0.82, 0.50),
    matte(PALETTE.accent, { metalness: 0.08, roughness: 0.72 }),
  );
  smallWeight.position.set(0, -1.55, -0.03);
  smallWeight.userData.role = 'small-tension-weight-w';
  smallCarrier.add(smallHanger, smallWeight);

  const largeCarrier = new THREE.Group();
  largeCarrier.userData.role = 'large-main-weight-and-movable-pulley';
  const largePulley = makeSymmetricPulley({
    color: PALETTE.driven,
    pitchRadius: radii.L,
    role: 'large-main-weight-pulley',
    symmetryOrder: 6,
    width: 0.40,
  });
  largeCarrier.add(largePulley);
  const largeHanger = makeBeam(
    new THREE.Vector3(0, -0.20, 0),
    new THREE.Vector3(0, -1.35, 0),
    { color: PALETTE.ink, depth: 0.18, thickness: 0.13 },
  );
  largeHanger.userData.role = 'large-main-weight-W-hanger';
  const largeWeight = new THREE.Mesh(
    new THREE.BoxGeometry(1.48, 1.05, 0.62),
    matte(PALETTE.driver, { metalness: 0.08, roughness: 0.72 }),
  );
  largeWeight.position.set(0, -1.77, -0.05);
  largeWeight.userData.role = 'large-driving-weight-W';
  largeCarrier.add(largeHanger, largeWeight);

  smallCarrier.position.set(
    xCoordinates.S,
    referenceSmallY,
    chainPlaneZ,
  );
  largeCarrier.position.set(
    xCoordinates.L,
    referenceLargeY,
    chainPlaneZ,
  );
  // The carrier translations include the chain-plane z; the rotor geometry
  // itself is local to z = 0.
  ratchetPulley.position.z = chainPlaneZ;
  goingPulley.position.z = chainPlaneZ;

  const chain = makeDynamicMovingBelt(referencePath.curve, {
    closed: true,
    color: PALETTE.ink,
    markerColor: PALETTE.white,
    markerCount,
    radius: chainRadius,
    tubularSegments: 256,
  });
  chain.userData.role = 'single-endless-maintaining-power-chain';
  chain.userData.mechanismChain = true;
  const chainMesh = chain.children.at(-1);
  const chainMarkers = chain.children.slice(0, -1);
  chainMesh.userData.role = 'single-endless-chain-body';
  for (const marker of chainMarkers) {
    marker.userData.role = 'chain-link-index-marker';
  }
  chain.userData.markers = chainMarkers;
  chain.userData.mesh = chainMesh;

  const pawlPivot = referencePath.centers.A.clone().add(
    new THREE.Vector3(0.48, 1.03, 0.34),
  );
  const pawlContact = referencePath.centers.A.clone().add(
    new THREE.Vector3(-0.12, 0.73, 0.34),
  );
  const pawlDirection = pawlContact.clone().sub(pawlPivot);
  const pawlLength = pawlDirection.length();
  const pawl = new THREE.Group();
  pawl.position.copy(pawlPivot);
  pawl.userData.role = 'fixed-click-engaging-ratchet-pulley-p';
  const pawlBody = new THREE.Mesh(
    new THREE.BoxGeometry(pawlLength, 0.13, 0.14),
    matte(PALETTE.ink, { metalness: 0.18, roughness: 0.50 }),
  );
  pawlBody.position.x = pawlLength / 2;
  pawlBody.userData.role = 'ratchet-click-body';
  const pawlTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.28, 4),
    pawlBody.material,
  );
  pawlTip.rotation.z = -Math.PI / 2;
  pawlTip.position.x = pawlLength;
  pawlTip.userData.role = 'ratchet-click-tip';
  const pawlPin = cylinderAlongZ(
    0.14,
    0.28,
    matte(PALETTE.accent, { metalness: 0.12, roughness: 0.58 }),
    24,
  );
  pawlPin.userData.role = 'fixed-click-pivot';
  pawl.add(pawlBody, pawlTip, pawlPin);
  const pawlBaseAngle = Math.atan2(pawlDirection.y, pawlDirection.x);
  pawl.rotation.z = pawlBaseAngle;

  const windingHandle = new THREE.Group();
  windingHandle.userData.role = 'demonstration-handle-pulling-part-b-down';
  const handleRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.055, 9, 28),
    matte(PALETTE.driver, { metalness: 0.10, roughness: 0.60 }),
  );
  handleRing.rotation.x = Math.PI / 2;
  windingHandle.add(handleRing);

  root.add(
    fixedFrame,
    ratchetPulley,
    goingPulley,
    smallCarrier,
    largeCarrier,
    chain,
    pawl,
    windingHandle,
  );

  const update = (time) => {
    const state = rawStateAtTime(time);
    chain.userData.setCurve(state.path.curve);
    chain.userData.updateDistance(state.chainTravel);
    smallCarrier.position.y = state.smallPulleyY;
    largeCarrier.position.y = state.largePulleyY;
    setRotorAngle(ratchetPulley, state.pulleys.A.angle);
    setRotorAngle(goingPulley, state.pulleys.B.angle);
    setRotorAngle(smallPulley, state.pulleys.S.angle);
    setRotorAngle(largePulley, state.pulleys.L.angle);
    pawl.rotation.z = pawlBaseAngle + state.pawlLift;
    windingHandle.visible = state.isWinding;
    if (state.isWinding) {
      const handleFraction = THREE.MathUtils.lerp(
        0.28,
        0.72,
        state.windingProgress,
      );
      windingHandle.position.copy(
        state.path.edges[0].curve.getPointAt(handleFraction),
      );
      windingHandle.position.z += 0.16;
    }
    root.userData.renderState = state;
    root.userData.updateClockInterfaces?.(state);
  };

  const sourcePointToReferenceFront = (point) => new THREE.Vector3(
    (point.x - sourceRasterOrigin.x) * sourceScale,
    topY - (point.y - sourceRasterOrigin.y) * sourceScale,
    chainPlaneZ,
  );

  root.userData.archetype =
    'single-endless-chain-going-barrel-maintaining-power';
  root.userData.blocks = {
    chain,
    chainMarkers,
    chainMesh,
    fixedFrame,
    goingPulley,
    largeCarrier,
    largePulley,
    largeWeight,
    pawl,
    ratchetPulley,
    smallCarrier,
    smallPulley,
    smallWeight,
    windingHandle,
  };
  root.userData.buildPath = buildPath;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.05, -4.85, -0.95),
    new THREE.Vector3(3.05, 4.15, 1.05),
  );
  root.userData.canonicalTimes = {
    cycleClosure: demonstrationPeriod,
    goingMidStroke: demonstrationPeriod * 0.25,
    ratchetLockedBottom: demonstrationPeriod * 0.50,
    windingMidStroke: demonstrationPeriod * 0.75,
  };
  root.userData.geometry = {
    chainPlaneZ,
    chainRadius,
    crossoverLift,
    cycleAdvance,
    demonstrationPeriod,
    finalGoingAngle,
    halfGoingAngle,
    halfLargeY,
    halfSmallY,
    mainWeightExcursion,
    markerCount,
    radii: { ...radii },
    ratchetToothCount,
    ratchetToothPitch,
    referenceLargeY,
    referenceSmallY,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    targetChainLength,
    topY,
    xCoordinates: { ...xCoordinates },
  };
  root.userData.mechanism =
    'one endless chain follows b from ratchet pulley p around small weight w, a to roughened going pulley P, d around main weight W, and c back to p; the click locks p while W descends, then pulling b lets p ratchet forward and raises W while P continues driving the going wheel';
  root.userData.rawStateAtTime = rawStateAtTime;
  root.userData.referencePath = referencePath;
  root.userData.solveSmallPulleyY = solveSmallPulleyY;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'Brown supplies one continuous chain with strands b–a–d–c, fixed upper pulleys p and P, a click and ratchet at p, small tension weight w, large main weight W, and the winding direction. Pitch diameters, masses, depth, winding cadence, and tooth proportions are not dimensioned.',
    sourceUrl: 'https://507movements.com/mm_320.html',
  };
  root.userData.sourcePointToReferenceFront = sourcePointToReferenceFront;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    brownPlate320: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one continuous chain in the ordered loop p–b–w–a–P–d–W–c–p; strands a and c cross without joining',
      measurementUncertaintyPixels: 9,
      rasterGoingPulleyP: sourceRasterGoingP.clone(),
      rasterLargePulley: sourceRasterLargePulley.clone(),
      rasterLargeWeightCenter: sourceRasterLargeWeightCenter.clone(),
      rasterRatchetPulleyP: sourceRasterRatchetP.clone(),
      rasterSmallPulley: sourceRasterSmallPulley.clone(),
      rasterSmallWeightCenter: sourceRasterSmallWeightCenter.clone(),
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod,
    schedule: [
      'main-weight-W-descends-and-drives-going-wheel-P',
      'click-holds-ratchet-pulley-p-stationary',
      'operator-pulls-chain-part-b-down',
      'ratchet-pulley-p-runs-forward-under-click',
      'chain-part-c-raises-main-weight-W',
      'going-wheel-P-never-reverses-or-loses-chain-pressure',
    ],
  };
  root.userData.transmission = {
    chainCount: 1,
    chainOrder: ['p', 'b', 'w', 'a', 'P', 'd', 'W', 'c', 'p'],
    crossover: 'strand a passes axially over strand c without connection',
    goingPhase: 'main weight W descends while click locks ratchet pulley p',
    noSlipLaw: 'pulley surface travel equals the material-coordinate travel of the single chain at both tangent contacts',
    pulleyRoles: {
      A: 'ratchet pulley p on the striking-wheel arbor or frame',
      B: 'roughened pulley P fixed to the going-wheel',
      L: 'movable pulley carrying large main weight W',
      S: 'movable pulley carrying small tension weight w',
    },
    windingPhase: 'pull b down; p freewheels under its click, c raises W, and P continues in its going direction',
  };

  correctEndlessMaintainingChain(root);
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
  chainMesh.castShadow = false;
  chainMesh.receiveShadow = false;
  root.userData.fidelity = 'authored';

  return {
    cameraDirection: new THREE.Vector3(.6, .8, 15),
    root,
    update,
  };
}

export function createAuthoredMaintainingPowerMovement(movement) {
  if (movement.id !== 320) return null;
  return endlessChainMaintainingPower(movement);
}
